import math
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
    if not all(math.isfinite(value) for value in embedding):
        raise DomainError(kind="invalid", message="Embedding values must be finite numbers.")


def _validate_text_length(text: str, maximum: int, label: str) -> None:
    if len(text) > maximum:
        raise DomainError(
            kind="too_large", message=f"{label} must not exceed {maximum} characters."
        )


def _new_vector_id() -> int:
    return int(uuid.uuid4().int >> 64)


def _unique_vector_id() -> int:
    """Allocate while the caller holds the existing shared mutation lock."""
    for _ in range(16):
        candidate = _new_vector_id()
        if not state.vector_db.contains_id(candidate):
            return candidate
    raise DomainError(kind="internal", message="Unable to allocate a unique vector ID.")
