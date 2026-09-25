import asyncio
from config import settings

from core.indexes.hnsw import HNSWIndex
from core.indexes.kd_tree import KDTreeIndex
from core.indexes.brute_force import BruteForceIndex
from core.indexes.base import BaseIndex
from core.metrics import cosine_distance, euclidean_distance, manhattan_distance
from core.wal import WriteAheadLog
from core.logger import logger

METRICS = {
    "cosine": cosine_distance,
    "euclidean": euclidean_distance,
    "manhattan": manhattan_distance,
}

DEFAULT_DIMS = 768


def build_engine(algorithm: str, metric: str) -> BaseIndex:
    dist_fn = METRICS.get(metric, cosine_distance)
    if algorithm == "hnsw":
        return HNSWIndex(distance_metric=dist_fn, m=16, ef_construction=200)
    elif algorithm == "kdtree":
        return KDTreeIndex(distance_metric=dist_fn, dims=DEFAULT_DIMS)
    elif algorithm == "exact":
        return BruteForceIndex(distance_metric=dist_fn)
    else:
        return HNSWIndex(distance_metric=dist_fn, m=16, ef_construction=200)


ACTIVE_ALGORITHM = "hnsw"
ACTIVE_METRIC = "cosine"
vector_db: BaseIndex = build_engine(ACTIVE_ALGORITHM, ACTIVE_METRIC)

WAL_FILE = settings.vector_wal_file
DB_FILE = settings.vector_db_file

wal = WriteAheadLog(filepath=WAL_FILE)
vector_db.load(DB_FILE)
wal.replay(vector_db)

db_lock = asyncio.Lock()
# PCA State for projecting queries
pca_model = None
pca_max_val = 1.0
