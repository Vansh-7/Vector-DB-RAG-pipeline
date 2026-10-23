import asyncio
from pathlib import Path
from typing import Any

from config import settings
from core.indexes.base import BaseIndex
from core.recovery import build_engine as create_engine
from core.recovery import recover_engine
from core.snapshots import METRICS as METRICS
from core.wal import WriteAheadLog

DEFAULT_DIMS = 768


def build_engine(algorithm: str, metric: str) -> BaseIndex:
    return create_engine(algorithm, metric, DEFAULT_DIMS)


WAL_FILE = settings.vector_wal_file
DB_FILE = settings.vector_db_file

Path(DB_FILE).parent.mkdir(parents=True, exist_ok=True)
Path(WAL_FILE).parent.mkdir(parents=True, exist_ok=True)

# Recovery failure aborts startup rather than publishing an empty replacement.
vector_db, ACTIVE_ALGORITHM, ACTIVE_METRIC = recover_engine(
    DB_FILE, WAL_FILE, dimensions=DEFAULT_DIMS,
    legacy_algorithm=settings.legacy_vector_algorithm,
    legacy_metric=settings.legacy_vector_metric,
)
wal = WriteAheadLog(filepath=WAL_FILE)

db_lock = asyncio.Lock()
# PCA State for projecting queries
pca_models: dict[int, tuple[Any, float]] = {}
