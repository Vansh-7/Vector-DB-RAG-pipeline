"""Build and recover one engine before publishing the application singleton."""

from pathlib import Path

from core.indexes.brute_force import BruteForceIndex
from core.indexes.hnsw import HNSWIndex
from core.indexes.kd_tree import KDTreeIndex
from core.snapshots import METRICS, SnapshotError, read_snapshot
from core.wal import WriteAheadLog


def build_engine(algorithm, metric, dimensions=768):
    if metric not in METRICS:
        raise SnapshotError("Unsupported distance metric.")
    if algorithm == "hnsw":
        index = HNSWIndex(METRICS[metric], m=16, ef_construction=200)
    elif algorithm == "kdtree":
        index = KDTreeIndex(METRICS[metric], dims=dimensions)
    elif algorithm == "exact":
        index = BruteForceIndex(METRICS[metric])
    else:
        raise SnapshotError("Unsupported vector engine.")
    index.dimensions = dimensions
    return index


def recover_engine(
    filepath, wal_path, *, dimensions=768, legacy_algorithm=None, legacy_metric=None
):
    algorithm, metric = "hnsw", "cosine"
    saved = None
    if Path(filepath).exists():
        saved = read_snapshot(
            filepath,
            legacy_algorithm=legacy_algorithm,
            legacy_metric=legacy_metric,
            dimensions=dimensions,
        )
        if saved["dimensions"] != dimensions:
            raise SnapshotError("Snapshot dimensions do not match configured embedding dimensions.")
        algorithm, metric = saved["algorithm"], saved["metric"]
    index = build_engine(algorithm, metric, dimensions)
    if saved is not None:
        index._restore_state(saved["state"])
    WriteAheadLog(wal_path).replay(index)
    return index, algorithm, metric
