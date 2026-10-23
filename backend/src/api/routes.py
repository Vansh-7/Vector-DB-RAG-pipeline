from pathlib import Path
from typing import Any

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
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from auth.dependencies import get_current_user, get_operator_user
from core.logger import logger
from core.types import SearchResult
from db.models import Document, User
from db.session import get_db
from services import benchmarks as benchmarks_service
from services import documents as documents_service
from services import engine as engine_service
from services import rag as rag_service
from services import search as search_service
from services import vectors as vectors_service
from services import visualization as visualization_service
from services.errors import DomainError
from services.validation import _normalize_category

router = APIRouter()


MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_TEXT_CHARACTERS = 2_000_000

ALLOWED_FILE_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
}


# ---------------------------------------------------------------------------
# Validation / normalization helpers
# ---------------------------------------------------------------------------








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
    try:
        result = await documents_service.list_documents(session, current_user.id)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
    try:
        result = await documents_service.delete_document(
            document_id, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
        result = await vectors_service.insert_vector(
            request.payload,
            request.category,
            request.embedding,
            request.id,
            current_user.id,
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
    try:
        result = await vectors_service.clear_user_data(current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
    try:
        result = await vectors_service.delete_vector(item_id, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.post(
    "/save",
    status_code=status.HTTP_200_OK,
)
async def save_database(
    current_user: User = Depends(get_operator_user),
) -> dict[str, str]:
    """
    Creates a global vector snapshot.

    Only configured operators may snapshot the shared index.
    """
    try:
        result = await engine_service.save_database(current_user.id)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
    try:
        results = await search_service.search_vectors(
            request.embedding, request.k, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return [_to_search_result_item(result) for result in results]


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
        result = await search_service.search_vectors_by_text(
            request.text, request.k, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.TextSearchResponse(
        results=[_to_search_result_item(row) for row in result["results"]],
        query_vector=result["query_vector"],
        query_2d=result["query_2d"],
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
    try:
        result = await visualization_service.get_vectors_sample(
            n, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.VectorSampleResponse(**result)


# ---------------------------------------------------------------------------
# Benchmark
# ---------------------------------------------------------------------------




@router.get(
    "/benchmark",
    response_model=schemas.BenchmarkResponse,
)
async def get_benchmarks(
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.BenchmarkResponse:
    try:
        result = await benchmarks_service.get_benchmarks(q, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.BenchmarkResponse(**result)


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
    return await engine_service.get_db_status()


# ---------------------------------------------------------------------------
# Global engine configuration
# ---------------------------------------------------------------------------


@router.post("/engine/configure")
async def configure_engine(
    algorithm: str,
    metric: str,
    current_user: User = Depends(get_operator_user),
) -> dict[str, Any]:
    """
    Reconfigures the shared vector engine.

    Only configured operators may rebuild the shared index.
    """
    try:
        result = await engine_service.configure_engine(algorithm, metric, current_user.id)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
    try:
        result = await documents_service.ingest_document(
            request.text, request.category, request.title, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.IngestResponse(**result)


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
    try:
        filename = Path(file.filename or "").name.strip()
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must have a filename.",
            )
        if len(filename) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is too long."
            )
        extension = Path(filename).suffix.lower()
        if extension not in ALLOWED_FILE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .pdf, .txt and .md files are supported.",
            )
        normalized_category = _normalize_category(category)
        try:
            content = await file.read(MAX_UPLOAD_BYTES + 1)
        except Exception as exc:
            logger.exception(f"Upload read failed user_id={current_user.id}: {exc}")
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
        result = await documents_service.ingest_file(
            content, filename, extension, normalized_category, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.IngestResponse(**result)


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------



@router.post("/ask")
async def ask_question(
    request: schemas.AskRequest,
    current_user: User = Depends(
        get_current_user
    ),
    session: AsyncSession = Depends(
        get_db
    ),
) -> StreamingResponse:
    try:
        stream = await rag_service.ask_question(
            request.question, request.k, request.conversation_id, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return StreamingResponse(stream, media_type="application/x-ndjson")
