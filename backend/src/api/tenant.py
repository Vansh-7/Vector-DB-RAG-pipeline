import numpy as np

import api.state as state
from core.types import SearchResult, VectorItem


def belongs_to_user(item: VectorItem, user_id: int,) -> bool:
    return getattr(item, "user_id", None) == user_id


def get_user_items(user_id: int) -> list[VectorItem]:
    return [
        item
        for item in state.vector_db.get_all_items()
        if belongs_to_user(item, user_id)
    ]


def search_user_vectors(query: np.ndarray, user_id: int, k: int,) -> list[SearchResult]:
    total_vectors = state.vector_db.size()

    if total_vectors == 0:
        return []

    # V1 tenant strategy:
    # over-fetch ANN candidates, then enforce ownership.
    candidate_k = min(
        total_vectors,
        max(100, k * 20),
    )

    candidates = state.vector_db.search(
        query,
        k=candidate_k,
    )

    user_results = [
        result
        for result in candidates
        if belongs_to_user(result.item, user_id)
    ]

    return user_results[:k]