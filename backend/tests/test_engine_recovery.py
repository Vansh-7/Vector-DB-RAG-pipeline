import asyncio
import pickle

import numpy as np
import pytest

import api.state as state
from core.indexes.brute_force import BruteForceIndex
from core.indexes.hnsw import HNSWIndex
from core.indexes.kd_tree import KDTreeIndex
from core.types import VectorItem
from core.wal import WriteAheadLog
from services.engine import configure_engine

ALGORITHMS = ["hnsw", "kdtree", "exact"]


def record(item_id=1, user_id=1):
    return VectorItem(
        id=item_id,
        user_id=user_id,
        document_id=100 + user_id,
        metadata=f"owner {user_id}",
        category="test",
        embedding=[1.0, 0.0, 0.0],
    )


def recover(snapshot, wal, **kwargs):
    from core.recovery import recover_engine

    return recover_engine(str(snapshot), str(wal), dimensions=3, **kwargs)


@pytest.mark.parametrize("algorithm", ALGORITHMS)
@pytest.mark.parametrize("metric", ["cosine", "euclidean", "manhattan"])
def test_self_describing_snapshot_recovers_configuration_and_all_owners(
    tmp_path, algorithm, metric
):
    from core.recovery import build_engine

    index = build_engine(algorithm, metric, 3)
    index.insert(record())
    index.insert(record(2, 2))
    index.insert(record(3))
    index.remove(3)
    snapshot, wal = tmp_path / "vectors.pkl", tmp_path / "vectors.wal"
    index.save(str(snapshot))
    with snapshot.open("rb") as stream:
        envelope = pickle.load(stream)
    assert envelope["format"] == "neuebit.vector.snapshot"
    assert envelope["version"] == 1
    assert (envelope["algorithm"], envelope["metric"], envelope["dimensions"]) == (
        algorithm,
        metric,
        3,
    )
    restored, recovered_algorithm, recovered_metric = recover(snapshot, wal)
    assert (recovered_algorithm, recovered_metric) == (algorithm, metric)
    assert [item.model_dump() for item in restored.get_all_items()] == [
        record().model_dump(),
        record(2, 2).model_dump(),
    ]
    assert restored.contains_id(3)
    assert {r.item.user_id for r in restored.search(np.array([1, 0, 0]), 2)} == {1, 2}


@pytest.mark.parametrize(
    "source,destination", [("hnsw", "exact"), ("hnsw", "kdtree"), ("exact", "hnsw")]
)
def test_switch_save_restart_and_wal_preserve_records(tmp_path, monkeypatch, source, destination):
    from core.recovery import build_engine

    original = build_engine(source, "cosine", 3)
    original.insert(record())
    monkeypatch.setattr(state, "vector_db", original)
    monkeypatch.setattr(state, "DEFAULT_DIMS", 3)
    monkeypatch.setattr(state, "ACTIVE_ALGORITHM", source)
    monkeypatch.setattr(state, "ACTIVE_METRIC", "cosine")
    snapshot, wal_path = tmp_path / "vectors.pkl", tmp_path / "vectors.wal"
    original.save(str(snapshot))
    asyncio.run(configure_engine(destination, "manhattan", 1))
    # A switch is process-local until a successful snapshot; mutations still use the WAL.
    wal = WriteAheadLog(str(wal_path))
    wal.log_insert(record(2, 2))
    state.vector_db.insert(record(2, 2))
    crashed, algorithm, metric = recover(snapshot, wal_path)
    assert (algorithm, metric) == (source, "cosine")
    assert [item.user_id for item in crashed.get_all_items()] == [1, 2]
    state.vector_db.save(str(snapshot))
    wal.log_delete(1)
    restored, algorithm, metric = recover(snapshot, wal_path)
    assert (algorithm, metric) == (destination, "manhattan")
    assert [item.model_dump() for item in restored.get_all_items()] == [record(2, 2).model_dump()]


@pytest.mark.parametrize("algorithm", ALGORITHMS)
@pytest.mark.parametrize("wrapper", [False, True])
def test_legacy_snapshots_require_explicit_missing_metadata_and_migrate_safely(
    tmp_path, algorithm, wrapper
):
    from core.recovery import build_engine
    from core.snapshots import SnapshotError

    index = build_engine(algorithm, "euclidean", 3)
    index.insert(record())
    if algorithm == "hnsw":
        legacy = {
            "nodes": index.nodes,
            "entry_point_id": index.entry_point_id,
            "top_layer": index.top_layer,
            "tombstones": {9},
        }
    else:
        legacy = {1: record()}
        if wrapper:
            legacy = {"items": legacy, "tombstones": {9}}
    snapshot, wal = tmp_path / "legacy.pkl", tmp_path / "vectors.wal"
    snapshot.write_bytes(pickle.dumps(legacy))
    previous = snapshot.read_bytes()
    with pytest.raises(SnapshotError, match="LEGACY_VECTOR"):
        recover(snapshot, wal)
    assert snapshot.read_bytes() == previous
    restored, recovered_algorithm, metric = recover(
        snapshot, wal, legacy_algorithm=algorithm, legacy_metric="euclidean"
    )
    assert (recovered_algorithm, metric) == (algorithm, "euclidean")
    assert restored.get_item(1).model_dump() == record().model_dump()
    assert snapshot.read_bytes() == previous  # Migration never rewrites while loading.
    restored.save(str(snapshot))
    assert recover(snapshot, wal)[1:] == (algorithm, "euclidean")


@pytest.mark.parametrize(
    "key,value",
    [
        ("algorithm", "unknown"),
        ("metric", "unknown"),
        ("version", 999),
        ("dimensions", 0),
        ("state", {}),
        ("format", "other"),
    ],
)
def test_invalid_metadata_fails_closed_and_preserves_snapshot(tmp_path, key, value):
    from core.recovery import build_engine
    from core.snapshots import SnapshotError

    snapshot, wal = tmp_path / "vectors.pkl", tmp_path / "vectors.wal"
    build_engine("exact", "cosine", 3).save(str(snapshot))
    envelope = pickle.loads(snapshot.read_bytes())
    envelope[key] = value
    snapshot.write_bytes(pickle.dumps(envelope))
    previous = snapshot.read_bytes()
    with pytest.raises(SnapshotError):
        recover(snapshot, wal)
    assert snapshot.read_bytes() == previous


@pytest.mark.parametrize("contents", [b"", b"not a pickle", b"\x80\x04\x95"])
def test_corrupted_snapshot_never_becomes_empty_working_database(tmp_path, contents):
    from core.snapshots import SnapshotError

    snapshot = tmp_path / "vectors.pkl"
    snapshot.write_bytes(contents)
    with pytest.raises(SnapshotError):
        recover(snapshot, tmp_path / "vectors.wal")
    assert snapshot.read_bytes() == contents


def test_legacy_wrong_engine_hint_fails_without_modifying_data(tmp_path):
    from core.snapshots import SnapshotError

    snapshot = tmp_path / "vectors.pkl"
    graph = HNSWIndex(state.METRICS["cosine"])
    graph.insert(record())
    snapshot.write_bytes(
        pickle.dumps({"nodes": graph.nodes, "entry_point_id": 1, "top_layer": graph.top_layer})
    )
    with pytest.raises(SnapshotError):
        recover(
            snapshot, tmp_path / "vectors.wal", legacy_algorithm="exact", legacy_metric="cosine"
        )


def test_kdtree_cosine_metric_does_not_use_invalid_axis_distance_pruning():
    index = KDTreeIndex(state.METRICS["cosine"], dims=3)
    for item_id, embedding in enumerate([[10, 1, 0], [100, 0, 0], [-1, 0, 0]]):
        index.insert(record(item_id).model_copy(update={"embedding": embedding}))
    assert index.search(np.array([1, 0, 0]), 1)[0].item.id == 1


@pytest.mark.parametrize("index_class", [HNSWIndex, BruteForceIndex])
def test_direct_load_rejects_incompatible_snapshot_without_erasing_active_index(
    tmp_path, index_class
):
    from core.snapshots import SnapshotError

    target = index_class(state.METRICS["cosine"])
    target.insert(record())
    other = KDTreeIndex(state.METRICS["euclidean"], dims=3)
    snapshot = tmp_path / "other.pkl"
    other.save(str(snapshot))
    with pytest.raises(SnapshotError):
        target.load(str(snapshot))
    assert target.get_item(1).user_id == 1


def test_startup_rejects_snapshot_dimensions_incompatible_with_embedding_model(tmp_path):
    from core.recovery import build_engine, recover_engine
    from core.snapshots import SnapshotError

    snapshot = tmp_path / "vectors.pkl"
    index = build_engine("exact", "cosine", 3)
    index.insert(record())
    index.save(str(snapshot))
    previous = snapshot.read_bytes()
    with pytest.raises(SnapshotError, match="dimensions"):
        recover_engine(str(snapshot), str(tmp_path / "vectors.wal"), dimensions=768)
    assert snapshot.read_bytes() == previous


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_empty_engine_keeps_configured_dimensions(tmp_path, algorithm):
    from core.recovery import build_engine

    snapshot = tmp_path / "empty.pkl"
    build_engine(algorithm, "euclidean", 3).save(str(snapshot))
    assert pickle.loads(snapshot.read_bytes())["dimensions"] == 3
    assert recover(snapshot, tmp_path / "vectors.wal")[1:] == (algorithm, "euclidean")
