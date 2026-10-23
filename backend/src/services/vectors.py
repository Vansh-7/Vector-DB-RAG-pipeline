from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from ai.embedder import embedder
from core.logger import logger
from core.types import VectorItem
from db.models import Document
from services.errors import DomainError
from services.retrieval import get_all_user_items
from services.validation import (
    _normalize_category,
    _unique_vector_id,
    _validate_embedding,
    _validate_text_length,
)


async def insert_vector(
    payload: str, category: str, embedding: list[float] | None, item_id: str | None, user_id: int
) -> dict[str, Any]:
    """
    Inserts a raw vector owned by the authenticated user.

    This endpoint remains useful for demonstrating the custom Vector DB API,
    although normal RAG documents should use /ingest or /ingest/file.
    """
    _validate_text_length(payload, 8_000, "Raw vector payload")
    try:
        vector_id = int(item_id) if item_id is not None else None
    except ValueError as exc:
        raise DomainError(kind="invalid", message="Vector ID must be an integer.") from exc
    try:
        if embedding is None:
            embedding = await embedder.embed_text(payload)
        _validate_embedding(embedding)
        category = _normalize_category(category)
        async with state.db_lock:
            if vector_id is None:
                vector_id = _unique_vector_id()
            elif state.vector_db.contains_id(vector_id):
                raise DomainError(kind="conflict", message="Vector ID is unavailable.")
            item = VectorItem(
                id=vector_id,
                metadata=payload,
                category=category,
                embedding=embedding,
                user_id=user_id,
                document_id=None,
            )
            # Durable intent precedes the shared index mutation.
            state.wal.log_insert(item)
            state.vector_db.insert(item)
        state.pca_models.pop(user_id, None)
        logger.info(f"Inserted vector_id={vector_id} for user_id={user_id}")
        return {"status": "success", "message": f"Successfully inserted item {vector_id}"}
    except DomainError:
        raise
    except Exception as exc:
        logger.exception(f"Vector insert failed user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Vector insertion failed.") from exc


async def clear_user_data(user_id: int, session: AsyncSession) -> dict[str, Any]:
    """
    Clears vectors and document metadata belonging only to the current user.

    It MUST NOT rebuild the global index or clear the global WAL because those
    contain data for other tenants.
    """
    user_items = await get_all_user_items(user_id)
    try:
        async with state.db_lock:
            for item in user_items:
                state.wal.log_delete(item.id)
                state.vector_db.remove(item.id)
    except Exception as exc:
        logger.exception(f"Failed clearing vectors for user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Failed to clear user vector data.") from exc
    try:
        await session.execute(delete(Document).where(Document.user_id == user_id))
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Failed clearing document metadata for user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Document metadata cleanup failed.") from exc
    state.pca_models.pop(user_id, None)
    return {"deleted": len(user_items), "message": "Your vector data was cleared successfully."}


async def delete_vector(item_id: int, user_id: int, session: AsyncSession) -> dict[str, Any]:
    """
    Deletes one vector only when it belongs to the authenticated user.
    """
    async with state.db_lock:
        item = next(
            (candidate for candidate in state.vector_db.get_all_items() if candidate.id == item_id),
            None,
        )
        if item is None or getattr(item, "user_id", None) != user_id:
            raise DomainError(kind="not_found", message="Vector not found.")
        try:
            state.wal.log_delete(item_id)
            removed = state.vector_db.remove(item_id)
            if not removed:
                raise RuntimeError("Vector could not be removed.")
        except Exception as exc:
            logger.exception(f"Vector deletion failed vector_id={item_id}: {exc}")
            raise DomainError(kind="internal", message="Vector deletion failed.") from exc
    document_id = getattr(item, "document_id", None)
    # Metadata failure must not report an already durable deletion as unsuccessful.
    if document_id is not None:
        try:
            document = await session.scalar(
                select(Document).where(Document.id == document_id, Document.user_id == user_id)
            )
            if document is not None and document.chunk_count > 0:
                document.chunk_count -= 1
                await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error(f"Failed updating chunk_count document_id={document_id}: {exc}")
    state.pca_models.pop(user_id, None)
    return {"deleted": 1, "message": f"Successfully deleted item {item_id}"}
