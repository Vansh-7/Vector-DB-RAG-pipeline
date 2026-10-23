from typing import Any

import api.state as state
from core.logger import logger
from services.errors import DomainError
from services.retrieval import get_all_user_items


async def save_database(user_id: int) -> dict[str, str]:
    """
    Creates a global vector snapshot.

    Only configured operators may snapshot the shared index.
    """
    try:
        async with state.db_lock:
            state.vector_db.save(state.DB_FILE)
            # Clear recovery intent only after the snapshot succeeded.
            state.wal.clear()
    except Exception as exc:
        logger.exception(f"Manual vector snapshot failed: {exc}")
        raise DomainError(kind="internal", message="Database snapshot failed.") from exc
    logger.info(f"Manual vector snapshot requested by user_id={user_id}")
    return {"message": "Database saved to disk successfully."}


async def get_db_status(user_id: int | None = None) -> dict[str, Any]:
    """
    Kept public because the Docker HEALTHCHECK calls this endpoint.

    Authenticated summaries count only the caller's active vector records.
    """
    if user_id is None:
        return {"status": "ok"}
    items = await get_all_user_items(user_id)
    return {
        "engine": state.ACTIVE_ALGORITHM,
        "metric": state.ACTIVE_METRIC,
        "total_docs": len(items),
    }


async def configure_engine(algorithm: str, metric: str, user_id: int) -> dict[str, Any]:
    """
    Reconfigures the shared vector engine.

    Only configured operators may rebuild the shared index.
    """
    if algorithm not in ("hnsw", "kdtree", "exact"):
        raise DomainError(kind="invalid", message=f"Unknown algorithm: {algorithm}")
    if metric not in state.METRICS:
        raise DomainError(kind="invalid", message=f"Unknown metric: {metric}")
    async with state.db_lock:
        old_items = state.vector_db.get_all_items()
        new_engine = state.build_engine(algorithm, metric)
        for item in old_items:
            new_engine.insert(item)
        new_engine.tombstones.update(getattr(state.vector_db, "tombstones", set()))
        state.vector_db = new_engine
        state.ACTIVE_ALGORITHM = algorithm
        state.ACTIVE_METRIC = metric
    logger.info(f"Engine reconfigured to {algorithm}/{metric} by user_id={user_id}")
    return {"algorithm": algorithm, "metric": metric, "total_docs": state.vector_db.size()}
