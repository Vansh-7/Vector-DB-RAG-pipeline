from typing import Any

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from ai.embedder import embedder
from core.logger import logger
from core.types import SearchResult
from services.errors import DomainError
from services.retrieval import get_ready_document_ids, search_user_vectors
from services.validation import _validate_embedding, _validate_text_length
from services.visualization import project_query_for_user


async def search_vectors(
    embedding: list[float], k: int, user_id: int, session: AsyncSession
) -> list[SearchResult]:
    _validate_embedding(embedding)
    query_arr = np.asarray(embedding, dtype=float)
    ready_document_ids = await get_ready_document_ids(session, user_id)
    try:
        results = search_user_vectors(
            query=query_arr, user_id=user_id, ready_document_ids=ready_document_ids, k=k
        )
    except Exception as exc:
        logger.exception(f"Vector search failed user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Vector search failed.") from exc
    return results


async def search_vectors_by_text(
    text: str, k: int, user_id: int, session: AsyncSession
) -> dict[str, Any]:
    _validate_text_length(text, 10_000, "Search text")
    try:
        query_vector = await embedder.embed_text(text)
    except Exception as exc:
        logger.exception(f"Query embedding failed user_id={user_id}: {exc}")
        raise DomainError(kind="unavailable", message="Embedding service is unavailable.") from exc
    try:
        _validate_embedding(query_vector)
    except DomainError as exc:
        raise DomainError(
            kind="internal", message="Embedding model returned an invalid vector."
        ) from exc
    query_arr = np.asarray(query_vector, dtype=float)
    ready_document_ids = await get_ready_document_ids(session, user_id)
    try:
        results = search_user_vectors(
            query=query_arr, user_id=user_id, ready_document_ids=ready_document_ids, k=k
        )
    except Exception as exc:
        logger.exception(f"Text vector search failed user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Vector search failed.") from exc
    query_2d = project_query_for_user(user_id, query_arr)
    return {"results": results, "query_vector": query_vector, "query_2d": query_2d}
