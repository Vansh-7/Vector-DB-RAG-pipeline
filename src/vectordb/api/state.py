import asyncio
import os

from vectordb.core.indexes.hnsw import HNSWIndex
from vectordb.core.indexes.kd_tree import KDTreeIndex
from vectordb.core.indexes.brute_force import BruteForceIndex
from vectordb.core.indexes.base import BaseIndex
from vectordb.core.metrics import cosine_distance, euclidean_distance, manhattan_distance
from vectordb.core.wal import WriteAheadLog
from vectordb.core.logger import logger

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

WAL_FILE = os.getenv("VECTOR_WAL_FILE", "vector_database.wal")
DB_FILE = os.getenv("VECTOR_DB_FILE", "vector_database.pkl")

wal = WriteAheadLog(filepath=WAL_FILE)
vector_db.load(DB_FILE)
wal.replay(vector_db)

db_lock = asyncio.Lock()