import uuid

import api.state as state
from services.errors import DomainError


def _normalize_category(category: str) -> str:
    normalized = category.strip() or "general"
    if len(normalized) > 100:
        raise DomainError(kind="invalid", message="Category must not exceed 100 characters.")
    return normalized


def _validate_embedding(embedding: list[float]) -> None:
    if len(embedding) != state.DEFAULT_DIMS:
        raise DomainError(
            kind="invalid",
            message=f"Embedding must contain exactly {state.DEFAULT_DIMS} dimensions.",
        )


def _new_vector_id() -> int:
    return int(uuid.uuid4().int >> 64)
