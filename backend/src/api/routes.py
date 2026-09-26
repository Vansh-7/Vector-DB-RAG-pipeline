import asyncio
import io
import json
import random
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pypdf
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sklearn.decomposition import PCA
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from ai.chunker import chunker
from ai.embedder import embedder
from ai.generator import llm_generator
from ai.reranker import cross_encoder
from api import schemas
from auth.dependencies import get_current_user
from core.indexes.hnsw import HNSWIndex
from core.logger import logger
from core.types import SearchResult, VectorItem
from db.models import Document, User
from db.session import get_db


router = APIRouter()


MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_TEXT_CHARACTERS = 2_000_000

ALLOWED_FILE_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
}


# ---------------------------------------------------------------------------
# Per-user visualization state
#
# This is intentionally process-local because the Vector DB itself is
# process-local in V1 and we run exactly one Uvicorn worker.
# ---------------------------------------------------------------------------

_pca_models: dict[int, tuple[PCA, float]] = {}


# ---------------------------------------------------------------------------
# Validation / normalization helpers
# ---------------------------------------------------------------------------


def _normalize_category(category: str) -> str:
    normalized = category.strip() or "general"

    if len(normalized) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category must not exceed 100 characters.",
        )

    return normalized


def _validate_embedding(embedding: list[float]) -> None:
    if len(embedding) != state.DEFAULT_DIMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Embedding must contain exactly "
                f"{state.DEFAULT_DIMS} dimensions."
            ),
        )


def _new_vector_id() -> int:
    return int(uuid.uuid4().int >> 64)


# ---------------------------------------------------------------------------
# Tenant helpers
# ---------------------------------------------------------------------------


async def _get_ready_document_ids(
    session: AsyncSession,
    user_id: int,
) -> set[int]:
    """
    Returns document IDs belonging to this user that are safe to retrieve.

    Only 'ready' documents participate in RAG. This means vectors left behind
    by a failed or partially deleted document do not become searchable.
    """
    result = await session.scalars(
        select(Document.id).where(
            Document.user_id == user_id,
            Document.status == "ready",
        )
    )

    return set(result.all())


def _is_searchable_for_user(
    item: VectorItem,
    user_id: int,
    ready_document_ids: set[int],
) -> bool:
    if getattr(item, "user_id", None) != user_id:
        return False

    document_id = getattr(item, "document_id", None)

    # Raw /insert vectors are user-owned but are not attached to a Document.
    if document_id is None:
        return True

    return document_id in ready_document_ids


def _search_user_vectors(
    query: np.ndarray,
    user_id: int,
    ready_document_ids: set[int],
    k: int,
) -> list[SearchResult]:
    """
    V1 tenant-aware ANN strategy.

    The HNSW index is still shared across users, so we over-fetch candidates,
    enforce tenant ownership, then return the user's top results.

    Long-term this should evolve to tenant-aware collections/namespaces or
    filter-aware ANN search.
    """
    total_vectors = state.vector_db.size()

    if total_vectors == 0:
        return []

    candidate_k = min(
        total_vectors,
        max(200, k * 50),
    )

    candidates = state.vector_db.search(
        query,
        k=candidate_k,
    )

    user_results = [
        result
        for result in candidates
        if _is_searchable_for_user(
            result.item,
            user_id,
            ready_document_ids,
        )
    ]

    return user_results[:k]


async def _get_searchable_user_items(
    user_id: int,
    ready_document_ids: set[int],
) -> list[VectorItem]:
    async with state.db_lock:
        items = state.vector_db.get_all_items()

    return [
        item
        for item in items
        if _is_searchable_for_user(
            item,
            user_id,
            ready_document_ids,
        )
    ]


async def _get_all_user_items(
    user_id: int,
) -> list[VectorItem]:
    async with state.db_lock:
        items = state.vector_db.get_all_items()

    return [
        item
        for item in items
        if getattr(item, "user_id", None) == user_id
    ]


def _to_search_result_item(
    result: SearchResult,
) -> schemas.SearchResultItem:
    return schemas.SearchResultItem(
        id=str(result.item.id),
        distance=float(result.distance),
        metadata=result.item.metadata,
        category=result.item.category,
        document_id=getattr(
            result.item,
            "document_id",
            None,
        ),
    )


# ---------------------------------------------------------------------------
# PCA helpers
# ---------------------------------------------------------------------------


def _project_query_for_user(
    user_id: int,
    query: np.ndarray,
) -> list[float] | None:
    pca_state = _pca_models.get(user_id)

    if pca_state is None:
        return None

    try:
        pca_model, max_val = pca_state

        raw_2d = pca_model.transform(
            query.reshape(1, -1)
        )

        projected = raw_2d / max_val

        return [
            float(projected[0][0]),
            float(projected[0][1]),
        ]

    except Exception as exc:
        logger.warning(
            f"Failed PCA projection for user_id={user_id}: {exc}"
        )

        return None


# ---------------------------------------------------------------------------
# Document lifecycle helpers
# ---------------------------------------------------------------------------


async def _create_document(
    session: AsyncSession,
    *,
    user_id: int,
    name: str,
    category: str,
    source_type: str,
) -> Document:
    document = Document(
        user_id=user_id,
        name=name,
        category=category,
        source_type=source_type,
        status="processing",
        chunk_count=0,
    )

    session.add(document)

    try:
        await session.commit()
        await session.refresh(document)

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Failed creating document metadata "
            f"for user_id={user_id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize document ingestion.",
        ) from exc

    return document


async def _mark_document_failed(
    session: AsyncSession,
    document_id: int,
) -> None:
    try:
        await session.rollback()

        document = await session.get(
            Document,
            document_id,
        )

        if document is None:
            return

        document.status = "failed"
        document.chunk_count = 0

        await session.commit()

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Failed marking document_id={document_id} "
            f"as failed: {exc}"
        )


async def _compensate_vector_inserts(
    item_ids: list[int],
) -> None:
    """
    Best-effort compensation for vectors written before an ingestion failed.

    PostgreSQL and our custom Vector DB cannot share one ACID transaction.
    Compensating WAL DELETE operations keep recovery semantics consistent.
    """
    if not item_ids:
        return

    async with state.db_lock:
        for item_id in item_ids:
            try:
                # WAL before in-memory mutation.
                state.wal.log_delete(item_id)
                state.vector_db.remove(item_id)

            except Exception as exc:
                logger.exception(
                    f"Failed compensating vector_id={item_id}: {exc}"
                )


async def _insert_document_chunks(
    *,
    chunks: list[str],
    user_id: int,
    document_id: int,
    category: str,
    attempted_item_ids: list[int],
) -> None:
    vectors = await embedder.embed_batch(chunks)

    if len(vectors) != len(chunks):
        raise RuntimeError(
            "Embedding count does not match chunk count."
        )

    async with state.db_lock:
        for chunk, vector in zip(chunks, vectors):
            if len(vector) != state.DEFAULT_DIMS:
                raise RuntimeError(
                    "Embedding model returned an unexpected dimension."
                )

            item_id = _new_vector_id()

            # Track before WAL/index mutations so a partially successful
            # operation can receive a compensating DELETE.
            attempted_item_ids.append(item_id)

            item = VectorItem(
                id=item_id,
                metadata=chunk,
                category=category,
                embedding=vector,
                user_id=user_id,
                document_id=document_id,
            )

            # WAL first: durable intent before mutating the index.
            state.wal.log_insert(item)
            state.vector_db.insert(item)


# ---------------------------------------------------------------------------
# File parsing
# ---------------------------------------------------------------------------


def _extract_file_text(
    content: bytes,
    extension: str,
) -> str:
    if extension == ".pdf":
        pdf_reader = pypdf.PdfReader(
            io.BytesIO(content)
        )

        pages: list[str] = []

        for page in pdf_reader.pages:
            page_text = page.extract_text()

            if page_text:
                pages.append(page_text)

        return "\n".join(pages).strip()

    return content.decode("utf-8").strip()


# ---------------------------------------------------------------------------
# Document routes
# ---------------------------------------------------------------------------


@router.get(
    "/documents",
    response_model=list[schemas.DocumentResponse],
)
async def list_documents(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Document]:
    """
    Returns only documents owned by the authenticated user.
    """
    result = await session.scalars(
        select(Document)
        .where(
            Document.user_id == current_user.id
        )
        .order_by(
            Document.created_at.desc()
        )
    )

    return list(result.all())


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Deletes one user-owned document and all of its vector chunks.

    We first mark the document 'deleting'. Retrieval only considers 'ready'
    documents, so even if deletion partially fails the document stops entering
    RAG context.
    """
    document = await session.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
    )

    if document is None:
        # 404 instead of 403 avoids revealing whether another user's
        # document exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    document.status = "deleting"

    try:
        await session.commit()
    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Failed preparing document deletion "
            f"document_id={document_id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document.",
        ) from exc

    try:
        async with state.db_lock:
            user_items = [
                item
                for item in state.vector_db.get_all_items()
                if getattr(item, "user_id", None)
                == current_user.id
                and getattr(item, "document_id", None)
                == document_id
            ]

            for item in user_items:
                # WAL first.
                state.wal.log_delete(item.id)
                state.vector_db.remove(item.id)

    except Exception as exc:
        logger.exception(
            f"Vector cleanup failed for "
            f"document_id={document_id}: {exc}"
        )

        await _mark_document_failed(
            session,
            document_id,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document.",
        ) from exc

    try:
        document = await session.get(
            Document,
            document_id,
        )

        if document is not None:
            await session.delete(document)

        await session.commit()

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"PostgreSQL document deletion failed "
            f"document_id={document_id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document deletion was incomplete.",
        ) from exc

    _pca_models.pop(
        current_user.id,
        None,
    )

    logger.info(
        f"Deleted document_id={document_id} "
        f"for user_id={current_user.id}"
    )

    return {
        "deleted_document_id": document_id,
        "deleted_chunks": len(user_items),
    }


# ---------------------------------------------------------------------------
# Direct Vector DB routes
# ---------------------------------------------------------------------------


@router.post(
    "/insert",
    status_code=status.HTTP_201_CREATED,
)
async def insert_vector(
    request: schemas.InsertRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Inserts a raw vector owned by the authenticated user.

    This endpoint remains useful for demonstrating the custom Vector DB API,
    although normal RAG documents should use /ingest or /ingest/file.
    """
    try:
        item_id = (
            int(request.id)
            if request.id is not None
            else _new_vector_id()
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vector ID must be an integer.",
        ) from exc

    try:
        embedding = request.embedding

        if embedding is None:
            embedding = await embedder.embed_text(
                request.payload
            )

        _validate_embedding(embedding)

        item = VectorItem(
            id=item_id,
            metadata=request.payload,
            category=_normalize_category(
                request.category
            ),
            embedding=embedding,
            user_id=current_user.id,
            document_id=None,
        )

        async with state.db_lock:
            state.wal.log_insert(item)
            state.vector_db.insert(item)

        _pca_models.pop(
            current_user.id,
            None,
        )

        logger.info(
            f"Inserted vector_id={item_id} "
            f"for user_id={current_user.id}"
        )

        return {
            "status": "success",
            "message": (
                f"Successfully inserted item {item_id}"
            ),
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception(
            f"Vector insert failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vector insertion failed.",
        ) from exc


@router.delete(
    "/vectors/all",
    status_code=status.HTTP_200_OK,
)
async def clear_user_data(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Clears vectors and document metadata belonging only to the current user.

    It MUST NOT rebuild the global index or clear the global WAL because those
    contain data for other tenants.
    """
    user_items = await _get_all_user_items(
        current_user.id
    )

    try:
        async with state.db_lock:
            for item in user_items:
                state.wal.log_delete(item.id)
                state.vector_db.remove(item.id)

    except Exception as exc:
        logger.exception(
            f"Failed clearing vectors "
            f"for user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear user vector data.",
        ) from exc

    try:
        await session.execute(
            delete(Document).where(
                Document.user_id == current_user.id
            )
        )

        await session.commit()

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Failed clearing document metadata "
            f"for user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document metadata cleanup failed.",
        ) from exc

    _pca_models.pop(
        current_user.id,
        None,
    )

    return {
        "deleted": len(user_items),
        "message": "Your vector data was cleared successfully.",
    }


@router.delete(
    "/vectors/{item_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_vector(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Deletes one vector only when it belongs to the authenticated user.
    """
    async with state.db_lock:
        item = next(
            (
                candidate
                for candidate in state.vector_db.get_all_items()
                if candidate.id == item_id
            ),
            None,
        )

        if (
            item is None
            or getattr(item, "user_id", None)
            != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vector not found.",
            )

        try:
            # Fixes the old delete durability bug:
            # WAL must happen BEFORE index mutation.
            state.wal.log_delete(item_id)

            removed = state.vector_db.remove(
                item_id
            )

            if not removed:
                raise RuntimeError(
                    "Vector could not be removed."
                )

        except Exception as exc:
            logger.exception(
                f"Vector deletion failed "
                f"vector_id={item_id}: {exc}"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Vector deletion failed.",
            ) from exc

    document_id = getattr(
        item,
        "document_id",
        None,
    )

    # Keep document chunk_count approximately consistent.
    # A failure here should not pretend the durable vector deletion failed.
    if document_id is not None:
        try:
            document = await session.scalar(
                select(Document).where(
                    Document.id == document_id,
                    Document.user_id
                    == current_user.id,
                )
            )

            if (
                document is not None
                and document.chunk_count > 0
            ):
                document.chunk_count -= 1
                await session.commit()

        except Exception as exc:
            await session.rollback()

            logger.error(
                f"Failed updating chunk_count "
                f"document_id={document_id}: {exc}"
            )

    _pca_models.pop(
        current_user.id,
        None,
    )

    return {
        "deleted": 1,
        "message": f"Successfully deleted item {item_id}",
    }


@router.post(
    "/save",
    status_code=status.HTTP_200_OK,
)
async def save_database(
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """
    Creates a global vector snapshot.

    This remains an authenticated operational endpoint for V1.
    Long-term it should be restricted to an admin/operator role.
    """
    try:
        async with state.db_lock:
            state.vector_db.save(
                state.DB_FILE
            )

            # Safe only after successful snapshot.
            state.wal.clear()

    except Exception as exc:
        logger.exception(
            f"Manual vector snapshot failed: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database snapshot failed.",
        ) from exc

    logger.info(
        f"Manual vector snapshot requested "
        f"by user_id={current_user.id}"
    )

    return {
        "message": "Database saved to disk successfully."
    }


# ---------------------------------------------------------------------------
# Search routes
# ---------------------------------------------------------------------------


@router.post(
    "/search",
    response_model=list[schemas.SearchResultItem],
)
async def search_vectors(
    request: schemas.SearchRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[schemas.SearchResultItem]:
    _validate_embedding(
        request.embedding
    )

    query_arr = np.asarray(
        request.embedding,
        dtype=float,
    )

    ready_document_ids = (
        await _get_ready_document_ids(
            session,
            current_user.id,
        )
    )

    try:
        results = _search_user_vectors(
            query=query_arr,
            user_id=current_user.id,
            ready_document_ids=ready_document_ids,
            k=request.k,
        )

    except Exception as exc:
        logger.exception(
            f"Vector search failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vector search failed.",
        ) from exc

    return [
        _to_search_result_item(result)
        for result in results
    ]


@router.post(
    "/search/text",
    response_model=schemas.TextSearchResponse,
)
async def search_vectors_by_text(
    request: schemas.TextSearchRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.TextSearchResponse:
    try:
        query_vector = await embedder.embed_text(
            request.text
        )

    except Exception as exc:
        logger.exception(
            f"Query embedding failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service is unavailable.",
        ) from exc

    if len(query_vector) != state.DEFAULT_DIMS:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Embedding model returned an invalid vector.",
        )

    query_arr = np.asarray(
        query_vector,
        dtype=float,
    )

    ready_document_ids = (
        await _get_ready_document_ids(
            session,
            current_user.id,
        )
    )

    try:
        results = _search_user_vectors(
            query=query_arr,
            user_id=current_user.id,
            ready_document_ids=ready_document_ids,
            k=request.k,
        )

    except Exception as exc:
        logger.exception(
            f"Text vector search failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vector search failed.",
        ) from exc

    response_items = [
        _to_search_result_item(result)
        for result in results
    ]

    query_2d = _project_query_for_user(
        current_user.id,
        query_arr,
    )

    return schemas.TextSearchResponse(
        results=response_items,
        query_vector=query_vector,
        query_2d=query_2d,
    )


# ---------------------------------------------------------------------------
# Vector visualization
# ---------------------------------------------------------------------------


@router.get(
    "/vectors/sample",
    response_model=schemas.VectorSampleResponse,
)
async def get_vectors_sample(
    n: int = 2000,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.VectorSampleResponse:
    n = max(
        1,
        min(n, 5000),
    )

    ready_document_ids = (
        await _get_ready_document_ids(
            session,
            current_user.id,
        )
    )

    items = await _get_searchable_user_items(
        current_user.id,
        ready_document_ids,
    )

    total_count = len(items)

    if total_count > n:
        items = random.sample(
            items,
            n,
        )

    if not items:
        _pca_models.pop(
            current_user.id,
            None,
        )

        return schemas.VectorSampleResponse(
            vectors=[],
            count=0,
        )

    embeddings = np.asarray(
        [
            item.embedding
            for item in items
        ],
        dtype=float,
    )

    if len(items) < 2:
        coords = np.zeros(
            (len(items), 2),
            dtype=float,
        )

        _pca_models.pop(
            current_user.id,
            None,
        )

    else:
        pca = PCA(
            n_components=2
        )

        coords = pca.fit_transform(
            embeddings
        )

        max_val = float(
            np.max(
                np.abs(coords)
            )
        )

        if max_val <= 0:
            max_val = 1.0

        coords = coords / max_val

        _pca_models[
            current_user.id
        ] = (
            pca,
            max_val,
        )

    vectors_2d = [
        schemas.VectorPoint2D(
            id=str(item.id),
            x=float(coords[index, 0]),
            y=float(coords[index, 1]),
            category=item.category,
            payload=(
                item.metadata[:100] + "..."
                if len(item.metadata) > 100
                else item.metadata
            ),
        )
        for index, item in enumerate(items)
    ]

    return schemas.VectorSampleResponse(
        vectors=vectors_2d,
        count=total_count,
    )


# ---------------------------------------------------------------------------
# Benchmark
# ---------------------------------------------------------------------------


def _run_benchmark_suite(
    items: list[VectorItem],
    test_vec: np.ndarray,
    active_algorithm: str,
    active_metric: str,
) -> tuple[
    list[schemas.AlgorithmBenchmark],
    list[schemas.HnswLayerStats] | None,
]:
    subset = items[
        : min(
            5000,
            len(items),
        )
    ]

    configurations = [
        (
            "hnsw",
            "HNSW Graph",
        ),
        (
            "kdtree",
            "KD-Tree",
        ),
        (
            "exact",
            "Brute Force (Exact Match)",
        ),
    ]

    benchmarks: list[
        schemas.AlgorithmBenchmark
    ] = []

    hnsw_engine: HNSWIndex | None = None

    for algorithm, display_name in configurations:
        engine = state.build_engine(
            algorithm,
            active_metric,
        )

        for item in subset:
            engine.insert(item)

        search_k = min(
            5,
            len(subset),
        )

        start = time.perf_counter()

        for _ in range(5):
            engine.search(
                test_vec,
                k=search_k,
            )

        elapsed = (
            time.perf_counter()
            - start
        ) / 5

        latency_ms = elapsed * 1000

        throughput_qps = (
            1 / elapsed
            if elapsed > 0
            else 0
        )

        benchmarks.append(
            schemas.AlgorithmBenchmark(
                name=algorithm,
                displayName=display_name,
                latencyMs=round(
                    latency_ms,
                    2,
                ),
                throughputQps=round(
                    throughput_qps,
                    0,
                ),
                isActive=(
                    active_algorithm
                    == algorithm
                ),
            )
        )

        if (
            algorithm == "hnsw"
            and isinstance(
                engine,
                HNSWIndex,
            )
        ):
            hnsw_engine = engine

    topology: list[
        schemas.HnswLayerStats
    ] | None = None

    if (
        active_algorithm == "hnsw"
        and hnsw_engine is not None
    ):
        layer_stats: dict[
            int,
            dict[str, int],
        ] = {}

        for node_id, node in hnsw_engine.nodes.items():
            if (
                node_id
                in hnsw_engine.tombstones
            ):
                continue

            for level, edges in enumerate(
                node.neighbors
            ):
                stats = layer_stats.setdefault(
                    level,
                    {
                        "nodes": 0,
                        "edges": 0,
                    },
                )

                stats["nodes"] += 1
                stats["edges"] += len(
                    edges
                )

        topology = [
            schemas.HnswLayerStats(
                level=level,
                nodes=layer_stats[level][
                    "nodes"
                ],
                edges=layer_stats[level][
                    "edges"
                ],
            )
            for level in sorted(
                layer_stats
            )
        ]

    return (
        benchmarks,
        topology,
    )


@router.get(
    "/benchmark",
    response_model=schemas.BenchmarkResponse,
)
async def get_benchmarks(
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.BenchmarkResponse:
    ready_document_ids = (
        await _get_ready_document_ids(
            session,
            current_user.id,
        )
    )

    items = await _get_searchable_user_items(
        current_user.id,
        ready_document_ids,
    )

    if not items:
        return schemas.BenchmarkResponse(
            algorithms=[
                schemas.AlgorithmBenchmark(
                    name="hnsw",
                    displayName="HNSW Graph",
                    latencyMs=0.0,
                    throughputQps=0.0,
                    isActive=(
                        state.ACTIVE_ALGORITHM
                        == "hnsw"
                    ),
                ),
                schemas.AlgorithmBenchmark(
                    name="kdtree",
                    displayName="KD-Tree",
                    latencyMs=0.0,
                    throughputQps=0.0,
                    isActive=(
                        state.ACTIVE_ALGORITHM
                        == "kdtree"
                    ),
                ),
                schemas.AlgorithmBenchmark(
                    name="exact",
                    displayName="Brute Force (Exact Match)",
                    latencyMs=0.0,
                    throughputQps=0.0,
                    isActive=(
                        state.ACTIVE_ALGORITHM
                        == "exact"
                    ),
                ),
            ],
            timestamp=datetime.now(
                timezone.utc
            ).isoformat(),
            topology=None,
        )

    if q:
        try:
            query_vector = (
                await embedder.embed_text(q)
            )

            test_vec = np.asarray(
                query_vector,
                dtype=float,
            )

        except Exception as exc:
            logger.exception(
                f"Benchmark query embedding failed "
                f"user_id={current_user.id}: {exc}"
            )

            raise HTTPException(
                status_code=(
                    status.HTTP_503_SERVICE_UNAVAILABLE
                ),
                detail="Embedding service is unavailable.",
            ) from exc

    else:
        test_vec = np.asarray(
            items[0].embedding,
            dtype=float,
        )

    benchmarks, topology = await asyncio.to_thread(
        _run_benchmark_suite,
        items,
        test_vec,
        state.ACTIVE_ALGORITHM,
        state.ACTIVE_METRIC,
    )

    return schemas.BenchmarkResponse(
        algorithms=benchmarks,
        timestamp=datetime.now(
            timezone.utc
        ).isoformat(),
        topology=topology,
    )


# ---------------------------------------------------------------------------
# Public health endpoint
# ---------------------------------------------------------------------------


@router.get("/status")
async def get_db_status() -> dict[str, Any]:
    """
    Kept public because the Docker HEALTHCHECK calls this endpoint.

    total_docs currently means total active vector chunks across the shared
    index, preserving the existing frontend/API contract.
    """
    return {
        "engine": state.ACTIVE_ALGORITHM,
        "metric": state.ACTIVE_METRIC,
        "total_docs": state.vector_db.size(),
    }


# ---------------------------------------------------------------------------
# Global engine configuration
# ---------------------------------------------------------------------------


@router.post("/engine/configure")
async def configure_engine(
    algorithm: str,
    metric: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Reconfigures the shared vector engine.

    This is an authenticated operational endpoint in V1.
    Long-term this should require an explicit admin/operator role.
    """
    if algorithm not in (
        "hnsw",
        "kdtree",
        "exact",
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown algorithm: {algorithm}",
        )

    if metric not in state.METRICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown metric: {metric}",
        )

    async with state.db_lock:
        old_items = (
            state.vector_db.get_all_items()
        )

        new_engine = state.build_engine(
            algorithm,
            metric,
        )

        for item in old_items:
            new_engine.insert(item)

        state.vector_db = new_engine
        state.ACTIVE_ALGORITHM = algorithm
        state.ACTIVE_METRIC = metric

    logger.info(
        f"Engine reconfigured to "
        f"{algorithm}/{metric} "
        f"by user_id={current_user.id}"
    )

    return {
        "algorithm": algorithm,
        "metric": metric,
        "total_docs": state.vector_db.size(),
    }


# ---------------------------------------------------------------------------
# Text ingestion
# ---------------------------------------------------------------------------


@router.post(
    "/ingest",
    response_model=schemas.IngestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_document(
    request: schemas.IngestRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.IngestResponse:
    raw_text = request.text.strip()

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text cannot be empty.",
        )

    if len(raw_text) > MAX_TEXT_CHARACTERS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Text document is too large.",
        )

    category = _normalize_category(
        request.category
    )

    title = (
        request.title or "Pasted text"
    ).strip()

    if not title:
        title = "Pasted text"

    title = title[:255]

    document = await _create_document(
        session,
        user_id=current_user.id,
        name=title,
        category=category,
        source_type="text",
    )

    attempted_item_ids: list[int] = []

    try:
        chunks = chunker.split_text(
            raw_text
        )

        if not chunks:
            raise RuntimeError(
                "Document chunker produced no chunks."
            )

        await _insert_document_chunks(
            chunks=chunks,
            user_id=current_user.id,
            document_id=document.id,
            category=category,
            attempted_item_ids=attempted_item_ids,
        )

        document.status = "ready"
        document.chunk_count = len(
            chunks
        )

        await session.commit()
        await session.refresh(
            document
        )

        _pca_models.pop(
            current_user.id,
            None,
        )

        logger.info(
            f"Text document ingested "
            f"document_id={document.id}, "
            f"user_id={current_user.id}, "
            f"chunks={len(chunks)}"
        )

        return schemas.IngestResponse(
            document_id=document.id,
            status=document.status,
            chunk_count=document.chunk_count,
            message="Document ingested successfully.",
        )

    except Exception as exc:
        logger.exception(
            f"Text ingestion failed "
            f"document_id={document.id}: {exc}"
        )

        await _compensate_vector_inserts(
            attempted_item_ids
        )

        await _mark_document_failed(
            session,
            document.id,
        )

        _pca_models.pop(
            current_user.id,
            None,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document ingestion failed.",
        ) from exc


# ---------------------------------------------------------------------------
# File ingestion
# ---------------------------------------------------------------------------


@router.post(
    "/ingest/file",
    response_model=schemas.IngestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_file(
    category: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.IngestResponse:
    filename = Path(
        file.filename or ""
    ).name.strip()

    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )

    if len(filename) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is too long.",
        )

    extension = Path(
        filename
    ).suffix.lower()

    if (
        extension
        not in ALLOWED_FILE_EXTENSIONS
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only .pdf, .txt and .md "
                "files are supported."
            ),
        )

    normalized_category = (
        _normalize_category(category)
    )

    try:
        content = await file.read(
            MAX_UPLOAD_BYTES + 1
        )

    except Exception as exc:
        logger.exception(
            f"Upload read failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file.",
        ) from exc

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 10 MB upload limit.",
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        text_content = await asyncio.to_thread(
            _extract_file_text,
            content,
            extension,
        )

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text files must use UTF-8 encoding.",
        ) from exc

    except Exception as exc:
        logger.exception(
            f"Document parsing failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to parse the uploaded document.",
        ) from exc

    if not text_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No readable text could be "
                "extracted from the document."
            ),
        )

    document = await _create_document(
        session,
        user_id=current_user.id,
        name=filename,
        category=normalized_category,
        source_type="file",
    )

    attempted_item_ids: list[int] = []

    try:
        chunks = chunker.split_text(
            text_content
        )

        if not chunks:
            raise RuntimeError(
                "Document chunker produced no chunks."
            )

        await _insert_document_chunks(
            chunks=chunks,
            user_id=current_user.id,
            document_id=document.id,
            category=normalized_category,
            attempted_item_ids=attempted_item_ids,
        )

        document.status = "ready"
        document.chunk_count = len(
            chunks
        )

        await session.commit()
        await session.refresh(
            document
        )

        _pca_models.pop(
            current_user.id,
            None,
        )

        logger.info(
            f"File document ingested "
            f"document_id={document.id}, "
            f"user_id={current_user.id}, "
            f"chunks={len(chunks)}"
        )

        return schemas.IngestResponse(
            document_id=document.id,
            status=document.status,
            chunk_count=document.chunk_count,
            message=(
                f"{document.name} ingested successfully."
            ),
        )

    except Exception as exc:
        logger.exception(
            f"File ingestion failed "
            f"document_id={document.id}: {exc}"
        )

        await _compensate_vector_inserts(
            attempted_item_ids
        )

        await _mark_document_failed(
            session,
            document.id,
        )

        _pca_models.pop(
            current_user.id,
            None,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document ingestion failed.",
        ) from exc


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------


@router.post("/ask")
async def ask_question(
    request: schemas.AskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    try:
        question_vector = (
            await embedder.embed_text(
                request.question
            )
        )

    except Exception as exc:
        logger.exception(
            f"Question embedding failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service is unavailable.",
        ) from exc

    question_arr = np.asarray(
        question_vector,
        dtype=float,
    )

    ready_document_ids = (
        await _get_ready_document_ids(
            session,
            current_user.id,
        )
    )

    try:
        broad_k = max(
            20,
            request.k * 4,
        )

        raw_results = _search_user_vectors(
            query=question_arr,
            user_id=current_user.id,
            ready_document_ids=ready_document_ids,
            k=broad_k,
        )

        if raw_results:
            reranked = await asyncio.to_thread(
                cross_encoder.rerank,
                request.question,
                raw_results,
                top_n=request.k,
            )

            best_results = [
                (
                    score,
                    result,
                )
                for score, result in reranked
                if score > 0
            ]

        else:
            best_results = []

    except Exception as exc:
        logger.exception(
            f"RAG retrieval failed "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RAG retrieval failed.",
        ) from exc

    query_2d = _project_query_for_user(
        current_user.id,
        question_arr,
    )

    async def response_stream():
        sources = [
            {
                "vectorId": str(
                    result.item.id
                ),
                "documentId": getattr(
                    result.item,
                    "document_id",
                    None,
                ),
                "category": result.item.category,
                "score": float(score),
                "snippet": result.item.metadata,
            }
            for score, result in best_results
        ]

        yield (
            json.dumps(
                {
                    "type": "sources",
                    "data": sources,
                }
            )
            + "\n"
        )

        if query_2d is not None:
            yield (
                json.dumps(
                    {
                        "type": "query_2d",
                        "data": query_2d,
                    }
                )
                + "\n"
            )

        best_chunks = [
            result.item.metadata
            for _, result in best_results
        ]

        async for chunk in (
            llm_generator.generate_stream(
                request.question,
                best_chunks,
            )
        ):
            yield chunk

    logger.info(
        f"RAG response started "
        f"user_id={current_user.id}, "
        f"context_chunks={len(best_results)}"
    )

    return StreamingResponse(
        response_stream(),
        media_type="application/x-ndjson",
    )