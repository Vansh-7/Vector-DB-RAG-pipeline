import random
from typing import Any

import numpy as np
from sklearn.decomposition import PCA
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from core.logger import logger
from services.retrieval import get_ready_document_ids, get_searchable_user_items


def project_query_for_user(user_id: int, query: np.ndarray) -> list[float] | None:
    pca_state = state.pca_models.get(user_id)
    if pca_state is None:
        return None
    try:
        pca_model, max_val = pca_state
        raw_2d = pca_model.transform(query.reshape(1, -1))
        projected = raw_2d / max_val
        return [float(projected[0][0]), float(projected[0][1])]
    except Exception as exc:
        logger.warning(f"Failed PCA projection for user_id={user_id}: {exc}")
        return None


async def get_vectors_sample(n: int, user_id: int, session: AsyncSession) -> dict[str, Any]:
    n = max(1, min(n, 5000))
    ready_document_ids = await get_ready_document_ids(session, user_id)
    items = await get_searchable_user_items(user_id, ready_document_ids)
    total_count = len(items)
    if total_count > n:
        items = random.sample(items, n)
    if not items:
        state.pca_models.pop(user_id, None)
        return {"vectors": [], "count": 0}
    embeddings = np.asarray([item.embedding for item in items], dtype=float)
    if len(items) < 2:
        coords = np.zeros((len(items), 2), dtype=float)
        state.pca_models.pop(user_id, None)
    else:
        pca = PCA(n_components=2)
        coords = pca.fit_transform(embeddings)
        max_val = float(np.max(np.abs(coords)))
        if max_val <= 0:
            max_val = 1.0
        coords = coords / max_val
        state.pca_models[user_id] = (pca, max_val)
    vectors_2d = [
        {
            "id": str(item.id),
            "x": float(coords[index, 0]),
            "y": float(coords[index, 1]),
            "category": item.category,
            "payload": item.metadata[:100] + "..." if len(item.metadata) > 100 else item.metadata,
        }
        for index, item in enumerate(items)
    ]
    return {"vectors": vectors_2d, "count": total_count}
