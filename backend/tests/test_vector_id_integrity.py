import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

import api.state as state
from auth.dependencies import get_current_user
from core.indexes.brute_force import BruteForceIndex
from core.indexes.hnsw import HNSWIndex
from core.indexes.kd_tree import KDTreeIndex
from core.metrics import euclidean_distance
from core.types import VectorItem
from core.wal import WriteAheadLog
from services import documents, validation, vectors
from services import engine as engine_service
from services.errors import DomainError


def make_index(algorithm):
    if algorithm == "hnsw":
        return HNSWIndex(euclidean_distance)
    if algorithm == "kdtree":
        return KDTreeIndex(euclidean_distance, dims=3)
    return BruteForceIndex(euclidean_distance)


def item(item_id=7, user_id=1):
    return VectorItem(
        id=item_id,
        user_id=user_id,
        document_id=11,
        metadata="private original",
        category="research",
        embedding=[1.0, 0.0, 0.0],
    )


@pytest.fixture(params=["hnsw", "kdtree", "exact"])
def index(request, monkeypatch, tmp_path):
    engine = make_index(request.param)
    engine.insert(item())
    wal = WriteAheadLog(str(tmp_path / "vectors.wal"))
    monkeypatch.setattr(state, "vector_db", engine)
    monkeypatch.setattr(state, "wal", wal)
    monkeypatch.setattr(state, "DEFAULT_DIMS", 3)
    return engine, wal, request.param


@pytest.mark.parametrize("user_id", [1, 2])
def test_existing_id_is_private_conflict_before_wal_and_preserves_record(index, user_id):
    engine, wal, _ = index
    original = item().model_dump()
    with pytest.raises(DomainError) as error:
        asyncio.run(vectors.insert_vector("replacement", "other", [0, 1, 0], "7", user_id))
    assert error.value.kind == "conflict"
    assert str(error.value) == "Vector ID is unavailable."
    assert not Path(wal.filepath).exists()
    assert [record.model_dump() for record in engine.get_all_items()] == [original]
    assert len(engine.search(np.array([1, 0, 0]), 10)) == 1


def test_core_insert_rejects_duplicate_without_overwrite_or_extra_nodes(index):
    engine, _, _ = index
    with pytest.raises(ValueError):
        engine.insert(item(user_id=2))
    assert engine.size() == 1
    assert [result.item.user_id for result in engine.search(np.array([1, 0, 0]), 10)] == [1]


def test_deleted_id_remains_reserved_across_snapshot_reload(index, tmp_path):
    engine, wal, algorithm = index
    assert engine.remove(7)
    path = tmp_path / "snapshot.pkl"
    engine.save(str(path))
    restored = make_index(algorithm)
    restored.load(str(path))
    state.vector_db = restored
    with pytest.raises(DomainError) as error:
        asyncio.run(vectors.insert_vector("new", "other", [0, 1, 0], "7", 2))
    assert error.value.kind == "conflict"
    assert restored.size() == 0
    assert not Path(wal.filepath).exists()


def test_generated_raw_id_retries_collision_under_lock(index, monkeypatch):
    engine, _, _ = index
    ids = iter([7, 8])
    monkeypatch.setattr(validation.uuid, "uuid4", lambda: SimpleNamespace(int=next(ids) << 64))
    asyncio.run(vectors.insert_vector("new", "other", [0, 1, 0], None, 2))
    assert [(record.id, record.user_id) for record in engine.get_all_items()] == [(7, 1), (8, 2)]


def test_generated_document_id_retries_before_tracking_or_wal(index, monkeypatch):
    engine, wal, _ = index
    ids = iter([7, 8])
    monkeypatch.setattr(validation.uuid, "uuid4", lambda: SimpleNamespace(int=next(ids) << 64))
    monkeypatch.setattr(documents.embedder, "embed_batch", AsyncMock(return_value=[[0, 1, 0]]))
    attempted = []
    asyncio.run(
        documents._insert_document_chunks(
            chunks=["chunk"],
            user_id=2,
            document_id=22,
            category="new",
            attempted_item_ids=attempted,
        )
    )
    assert attempted == [8]
    assert [record.id for record in engine.get_all_items()] == [7, 8]
    assert '"id": 7' not in Path(wal.filepath).read_text()


def test_wal_replay_skips_identical_snapshot_inserts_and_does_not_resurrect_deletes(index):
    engine, wal, _ = index
    wal.log_insert(item())
    wal.log_insert(item(8, 2))
    wal.log_delete(8)
    wal.replay(engine)
    wal.replay(engine)
    assert [record.model_dump() for record in engine.get_all_items()] == [item().model_dump()]
    assert engine.size() == 1
    with pytest.raises(ValueError):
        engine.insert(item(8, 2))


def test_cross_user_collision_http_response_is_409_without_private_data(index):
    from main import app

    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=2)
    try:
        response = TestClient(app).post(
            "/api/v1/insert",
            json={"id": "7", "payload": "replacement", "category": "other", "embedding": [0, 1, 0]},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 409
    assert response.json() == {"detail": "Vector ID is unavailable."}


def test_concurrent_collisions_acknowledge_only_one_new_insert(index):
    engine, wal, _ = index

    async def run():
        return await asyncio.gather(
            vectors.insert_vector("Alice", "test", [0, 1, 0], "8", 1),
            vectors.insert_vector("Bob", "test", [0, 0, 1], "8", 2),
            return_exceptions=True,
        )

    results = asyncio.run(run())
    assert sum(isinstance(result, DomainError) for result in results) == 1
    assert engine.size() == 2
    assert len(Path(wal.filepath).read_text().splitlines()) == 1


def test_generator_exhaustion_never_logs_or_overwrites(index, monkeypatch):
    engine, wal, _ = index
    monkeypatch.setattr(validation.uuid, "uuid4", lambda: SimpleNamespace(int=7 << 64))
    with pytest.raises(DomainError, match="Unable to allocate a unique vector ID"):
        asyncio.run(vectors.insert_vector("new", "other", [0, 1, 0], None, 2))
    assert [record.model_dump() for record in engine.get_all_items()] == [item().model_dump()]
    assert not Path(wal.filepath).exists()


def test_conflicting_replay_fails_instead_of_overwriting_another_tenant(index):
    engine, wal, _ = index
    wal.log_insert(item(user_id=2))
    with pytest.raises(ValueError, match="Conflicting vector identity"):
        wal.replay(engine)
    assert [record.model_dump() for record in engine.get_all_items()] == [item().model_dump()]


@pytest.mark.parametrize("destination", ["hnsw", "kdtree", "exact"])
def test_engine_switch_keeps_retired_ids_reserved(index, monkeypatch, tmp_path, destination):
    engine, _, _ = index
    engine.remove(7)
    monkeypatch.setattr(state, "ACTIVE_ALGORITHM", "hnsw")
    monkeypatch.setattr(state, "ACTIVE_METRIC", "cosine")
    asyncio.run(engine_service.configure_engine(destination, "euclidean", 1))
    path = tmp_path / "switched.pkl"
    state.vector_db.save(str(path))
    restored = make_index(destination)
    restored.load(str(path))
    state.vector_db = restored
    assert state.vector_db.size() == 0
    with pytest.raises(DomainError) as error:
        asyncio.run(vectors.insert_vector("replacement", "other", [0, 1, 0], "7", 2))
    assert error.value.kind == "conflict"


def test_retired_ids_without_graph_nodes_do_not_expand_hnsw_search(monkeypatch):
    graph = HNSWIndex(euclidean_distance)
    monkeypatch.setattr(graph, "_random_level", lambda: 0)
    graph.insert(item())
    graph.tombstones.update(range(1000, 11000))
    original = graph._search_layer
    widths = []

    def search_layer(query, entry_point, ef, layer):
        widths.append(ef)
        return original(query, entry_point, ef, layer)

    monkeypatch.setattr(graph, "_search_layer", search_layer)
    assert graph.search(np.array([1, 0, 0]), 1)[0].item.id == 7
    assert widths == [50]
