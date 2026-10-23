import asyncio
import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from test_document_service import DocumentIndex, DocumentSession

import api.state as state
from auth.dependencies import get_current_user
from core.types import VectorItem
from db.models import Document
from db.session import get_db


class VectorSession(DocumentSession):
    async def execute(self, statement):
        self.statements.append(statement)
        self.events.append(("delete_metadata", statement.compile().params))


@pytest.fixture
def vectors(monkeypatch):
    service = importlib.import_module("services.vectors")
    events = []
    index = DocumentIndex(events)
    index.items = [
        VectorItem(
            id=item_id,
            user_id=owner,
            document_id=document,
            metadata=f"vector-{item_id}",
            category="test",
            embedding=[0.5] * 768,
        )
        for item_id, owner, document in [
            (1, 1, 11),
            (2, 2, 21),
            (3, 1, 12),
            (4, 1, None),
            (5, 2, None),
        ]
    ]
    session = VectorSession(events)
    session.document = Document(
        id=11,
        user_id=1,
        name="Owned",
        status="ready",
        chunk_count=3,
        source_type="text",
        category="test",
    )

    def wal_insert(item):
        assert state.db_lock.locked()
        events.append(("wal_insert", item.id))

    def wal_delete(item_id):
        assert state.db_lock.locked()
        events.append(("wal_delete", item_id))

    monkeypatch.setattr(state, "vector_db", index)
    monkeypatch.setattr(state, "wal", SimpleNamespace(log_insert=wal_insert, log_delete=wal_delete))
    monkeypatch.setattr(state, "pca_models", {1: (object(), 1), 2: (object(), 2)})
    return service, session, index, events


def insert(vectors, **kwargs):
    service, _, _, _ = vectors
    values = dict(
        payload="raw text", category=" test ", embedding=[0.5] * 768, item_id="99", user_id=1
    )
    values.update(kwargs)
    return asyncio.run(service.insert_vector(**values))


def test_insert_keeps_ownership_raw_vector_and_wal_order(vectors):
    _, _, index, events = vectors
    result = insert(vectors)
    assert result == {"status": "success", "message": "Successfully inserted item 99"}
    item = index.items[-1]
    assert (item.id, item.user_id, item.document_id, item.metadata, item.category) == (
        99,
        1,
        None,
        "raw text",
        "test",
    )
    assert events == [("wal_insert", 99), ("insert", 99)]
    assert set(state.pca_models) == {2}


def test_insert_embeds_payload_and_generates_id_when_omitted(vectors, monkeypatch):
    service, _, index, _ = vectors
    embed = AsyncMock(return_value=[0.25] * 768)
    monkeypatch.setattr(service.embedder, "embed_text", embed)
    insert(vectors, embedding=None, item_id=None, category="  ")
    assert index.items[-1].embedding == [0.25] * 768
    assert index.items[-1].category == "general"
    assert 0 <= index.items[-1].id < 2**64
    embed.assert_awaited_once_with("raw text")


@pytest.mark.parametrize(
    "values,message",
    [
        ({"item_id": "invalid"}, "Vector ID must be an integer."),
        ({"embedding": [0.1]}, "Embedding must contain exactly 768 dimensions."),
        ({"category": "x" * 101}, "Category must not exceed 100 characters."),
    ],
    ids=["id", "dimension", "category"],
)
def test_invalid_insert_has_no_wal_or_index_side_effect(vectors, values, message):
    service, _, index, events = vectors
    with pytest.raises(service.DomainError) as error:
        insert(vectors, **values)
    assert error.value.kind == "invalid"
    assert str(error.value) == message
    assert len(index.items) == 5
    assert events == []
    assert set(state.pca_models) == {1, 2}


def test_wal_failure_prevents_raw_vector_mutation(vectors, monkeypatch):
    service, _, index, events = vectors
    monkeypatch.setattr(state.wal, "log_insert", lambda item: (_ for _ in ()).throw(OSError()))
    with pytest.raises(service.DomainError, match="Vector insertion failed"):
        insert(vectors)
    assert len(index.items) == 5
    assert events == []


def test_partial_raw_insert_retains_existing_durable_intent_semantics(vectors):
    service, _, index, events = vectors
    index.fail_insert = 6
    with pytest.raises(service.DomainError, match="Vector insertion failed"):
        insert(vectors)
    assert events == [("wal_insert", 99), ("insert", 99)]
    assert index.items[-1].id == 99
    assert set(state.pca_models) == {1, 2}


def test_delete_owned_vector_updates_metadata_and_only_own_pca(vectors):
    service, session, index, events = vectors
    result = asyncio.run(service.delete_vector(1, 1, session))
    assert result == {"deleted": 1, "message": "Successfully deleted item 1"}
    assert [item.id for item in index.items] == [2, 3, 4, 5]
    assert events[:2] == [("wal_delete", 1), ("remove", 1)]
    assert session.document.chunk_count == 2
    assert session.statements[0].compile().params == {"id_1": 11, "user_id_1": 1}
    assert set(state.pca_models) == {2}


@pytest.mark.parametrize("item_id", [2, 5, 999])
def test_foreign_and_missing_vectors_are_not_disclosed_or_mutated(vectors, item_id):
    service, session, index, events = vectors
    with pytest.raises(service.DomainError, match="Vector not found") as error:
        asyncio.run(service.delete_vector(item_id, 1, session))
    assert error.value.kind == "not_found"
    assert len(index.items) == 5
    assert events == []


def test_metadata_failure_does_not_undo_durable_vector_delete(vectors):
    service, session, index, events = vectors
    session.fail_commit = 1
    result = asyncio.run(service.delete_vector(1, 1, session))
    assert result["deleted"] == 1
    assert 1 not in [item.id for item in index.items]
    assert ("rollback",) in events
    assert set(state.pca_models) == {2}


@pytest.mark.parametrize("failure", ["wal", "remove"])
def test_failed_vector_delete_keeps_error_and_wal_order(vectors, monkeypatch, failure):
    service, session, index, events = vectors
    if failure == "wal":
        monkeypatch.setattr(
            state.wal, "log_delete", lambda item_id: (_ for _ in ()).throw(OSError("disk full"))
        )
    else:
        monkeypatch.setattr(index, "remove", lambda item_id: False)
    with pytest.raises(service.DomainError, match="Vector deletion failed"):
        asyncio.run(service.delete_vector(1, 1, session))
    assert [item.id for item in index.items] == [1, 2, 3, 4, 5]
    assert events == ([] if failure == "wal" else [("wal_delete", 1)])
    assert session.commits == 0


def test_clear_includes_raw_and_non_ready_owned_items_and_preserves_bob(vectors):
    service, session, index, events = vectors
    result = asyncio.run(service.clear_user_data(1, session))
    assert result == {"deleted": 3, "message": "Your vector data was cleared successfully."}
    assert [item.id for item in index.items] == [2, 5]
    assert events == [
        ("wal_delete", 1),
        ("remove", 1),
        ("wal_delete", 3),
        ("remove", 3),
        ("wal_delete", 4),
        ("remove", 4),
        ("delete_metadata", {"user_id_1": 1}),
        ("commit", "ready"),
    ]
    assert set(state.pca_models) == {2}


def test_clear_failure_keeps_other_users_and_existing_partial_progress(vectors, monkeypatch):
    service, session, index, events = vectors
    original_remove = index.remove

    def remove(item_id):
        if item_id == 3:
            raise RuntimeError("second delete failed")
        return original_remove(item_id)

    monkeypatch.setattr(index, "remove", remove)
    with pytest.raises(service.DomainError, match="Failed to clear user vector data"):
        asyncio.run(service.clear_user_data(1, session))
    assert [item.id for item in index.items] == [2, 3, 4, 5]
    assert not any(event[0] == "delete_metadata" for event in events)
    assert set(state.pca_models) == {1, 2}


def test_clear_metadata_failure_rolls_back_after_vector_deletions(vectors):
    service, session, index, events = vectors
    session.fail_commit = 1
    with pytest.raises(service.DomainError, match="Document metadata cleanup failed"):
        asyncio.run(service.clear_user_data(1, session))
    assert [item.id for item in index.items] == [2, 5]
    assert ("rollback",) in events
    assert set(state.pca_models) == {1, 2}


@pytest.mark.parametrize(
    "failure,expected",
    [
        ("embedding", "Vector insertion failed."),
        ("dimension", "Embedding must contain exactly 768 dimensions."),
    ],
)
def test_insert_http_error_status_is_preserved(vectors, monkeypatch, failure, expected):
    from main import app

    service, session, _, _ = vectors
    if failure == "embedding":
        monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(side_effect=RuntimeError()))
    body = {"payload": "raw", "category": "test"}
    if failure == "dimension":
        body["embedding"] = [1.0]
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    app.dependency_overrides[get_db] = lambda: session
    try:
        result = TestClient(app).post("/api/v1/insert", json=body)
    finally:
        app.dependency_overrides.clear()
    assert result.status_code == (500 if failure == "embedding" else 400)
    assert result.json() == {"detail": expected}
