import asyncio
import importlib
from types import SimpleNamespace

import numpy as np
import pytest

import api.state as state
from core.indexes.brute_force import BruteForceIndex
from core.metrics import euclidean_distance
from core.types import VectorItem
from core.wal import WriteAheadLog


class Engine:
    def __init__(self, events, items=()):
        self.events = events
        self.items = list(items)
        self.fail_save = False
        self.fail_insert = False

    def size(self):
        return len(self.items)

    def get_all_items(self):
        assert state.db_lock.locked()
        return list(self.items)

    def insert(self, item):
        assert state.db_lock.locked()
        if self.fail_insert:
            raise RuntimeError("build insert failed")
        self.items.append(item)

    def save(self, path):
        assert state.db_lock.locked()
        self.events.append(("save", path))
        if self.fail_save:
            raise OSError("snapshot failed")


@pytest.fixture
def engine_service(monkeypatch):
    service = importlib.import_module("services.engine")
    events = []
    items = [
        VectorItem(id=1, user_id=1, metadata="Alice", category="test", embedding=[1, 0]),
        VectorItem(id=2, user_id=2, metadata="Bob", category="test", embedding=[0, 1]),
    ]
    engine = Engine(events, items)

    def clear():
        assert state.db_lock.locked()
        events.append(("clear_wal",))

    monkeypatch.setattr(state, "vector_db", engine)
    monkeypatch.setattr(state, "wal", SimpleNamespace(clear=clear))
    monkeypatch.setattr(state, "ACTIVE_ALGORITHM", "hnsw")
    monkeypatch.setattr(state, "ACTIVE_METRIC", "cosine")
    monkeypatch.setattr(state, "pca_models", {1: (object(), 1), 2: (object(), 2)})
    return service, engine, events


def test_status_remains_public_shared_index_summary(engine_service):
    service, _, _ = engine_service
    assert asyncio.run(service.get_db_status()) == {
        "engine": "hnsw",
        "metric": "cosine",
        "total_docs": 2,
    }


def test_snapshot_is_saved_before_wal_clear_under_existing_lock(engine_service):
    service, _, events = engine_service
    assert asyncio.run(service.save_database(1)) == {
        "message": "Database saved to disk successfully."
    }
    assert events == [("save", state.DB_FILE), ("clear_wal",)]
    assert not state.db_lock.locked()


def test_failed_snapshot_never_clears_wal(engine_service):
    service, engine, events = engine_service
    engine.fail_save = True
    with pytest.raises(service.DomainError, match="Database snapshot failed") as error:
        asyncio.run(service.save_database(1))
    assert error.value.kind == "internal"
    assert events == [("save", state.DB_FILE)]
    assert not state.db_lock.locked()


@pytest.mark.parametrize("algorithm", ["hnsw", "kdtree", "exact"])
def test_engine_switch_preserves_all_tenants_and_only_one_active_index(
    engine_service, monkeypatch, algorithm
):
    service, original, events = engine_service
    built = Engine(events)
    calls = []

    def build(name, metric):
        assert state.vector_db is original
        assert state.db_lock.locked()
        calls.append((name, metric))
        return built

    monkeypatch.setattr(state, "build_engine", build)
    result = asyncio.run(service.configure_engine(algorithm, "euclidean", 1))
    assert calls == [(algorithm, "euclidean")]
    assert state.vector_db is built
    assert [(item.id, item.user_id) for item in built.items] == [(1, 1), (2, 2)]
    assert result == {"algorithm": algorithm, "metric": "euclidean", "total_docs": 2}
    assert (state.ACTIVE_ALGORITHM, state.ACTIVE_METRIC) == (algorithm, "euclidean")
    assert set(state.pca_models) == {1, 2}


@pytest.mark.parametrize(
    "algorithm,metric,message",
    [
        ("unknown", "cosine", "Unknown algorithm: unknown"),
        ("exact", "unknown", "Unknown metric: unknown"),
    ],
)
def test_invalid_engine_configuration_preserves_active_state(
    engine_service, algorithm, metric, message
):
    service, original, _ = engine_service
    with pytest.raises(service.DomainError) as error:
        asyncio.run(service.configure_engine(algorithm, metric, 1))
    assert error.value.kind == "invalid"
    assert str(error.value) == message
    assert state.vector_db is original


@pytest.mark.parametrize("failure", ["construction", "insertion"])
def test_failed_engine_build_keeps_original_singleton_and_configuration(
    engine_service, monkeypatch, failure
):
    service, original, events = engine_service
    built = Engine(events)
    built.fail_insert = True

    def build(*args):
        if failure == "construction":
            raise RuntimeError("construction failed")
        return built

    monkeypatch.setattr(state, "build_engine", build)
    with pytest.raises(RuntimeError):
        asyncio.run(service.configure_engine("exact", "euclidean", 1))
    assert state.vector_db is original
    assert (state.ACTIVE_ALGORITHM, state.ACTIVE_METRIC) == ("hnsw", "cosine")
    assert [item.id for item in original.items] == [1, 2]
    assert not state.db_lock.locked()


def test_real_snapshot_and_subsequent_wal_recovery_use_only_temporary_paths(
    engine_service, monkeypatch, tmp_path
):
    service, original, _ = engine_service
    index = BruteForceIndex(euclidean_distance)
    for item in original.items:
        index.insert(item)
    snapshot = tmp_path / "snapshot.pkl"
    wal_path = tmp_path / "mutations.wal"
    wal = WriteAheadLog(str(wal_path))
    wal.log_insert(original.items[0])
    monkeypatch.setattr(state, "vector_db", index)
    monkeypatch.setattr(state, "wal", wal)
    monkeypatch.setattr(state, "DB_FILE", str(snapshot))
    asyncio.run(service.save_database(1))
    assert snapshot.exists()
    assert not wal_path.exists()
    third = original.items[0].model_copy(update={"id": 3, "embedding": [2.0, 0.0]})
    wal.log_insert(third)
    index.insert(third)
    wal.log_delete(1)
    index.remove(1)
    recovered = BruteForceIndex(euclidean_distance)
    recovered.load(str(snapshot))
    wal.replay(recovered)
    assert [(item.id, item.user_id) for item in recovered.get_all_items()] == [(2, 2), (3, 1)]
    assert recovered.search(np.array([2.0, 0.0]), 1)[0].item.id == 3
