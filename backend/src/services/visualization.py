import numpy as np

import api.state as state
from core.logger import logger


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
