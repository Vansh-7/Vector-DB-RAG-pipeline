import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from core.types import SearchResult, VectorItem
from db.models import Document


async def get_ready_document_ids(
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


def is_searchable_for_user(
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


def search_user_vectors(
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
        if is_searchable_for_user(
            result.item,
            user_id,
            ready_document_ids,
        )
    ]

    return user_results[:k]


async def get_searchable_user_items(
    user_id: int,
    ready_document_ids: set[int],
) -> list[VectorItem]:
    async with state.db_lock:
        items = state.vector_db.get_all_items()

    return [
        item
        for item in items
        if is_searchable_for_user(
            item,
            user_id,
            ready_document_ids,
        )
    ]


async def get_all_user_items(
    user_id: int,
) -> list[VectorItem]:
    async with state.db_lock:
        items = state.vector_db.get_all_items()

    return [
        item
        for item in items
        if getattr(item, "user_id", None) == user_id
    ]
