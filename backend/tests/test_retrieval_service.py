import asyncio
import importlib
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

import api.state as state
from auth.dependencies import get_current_user
from core.types import SearchResult, VectorItem
from db.models import Conversation
from db.session import get_db


def _service():
    return importlib.import_module("services.retrieval")


class FakeIndex:
    def __init__(self, results, total=None):
        self.results = results
        self.total = len(results) if total is None else total
        self.search_calls = []

    def size(self):
        return self.total

    def search(self, query, k):
        self.search_calls.append((query, k))
        return self.results[:k]

    def get_all_items(self):
        assert state.db_lock.locked(), "Enumeration must use the existing shared lock"
        return [result.item for result in self.results]


class FakeSession:
    def __init__(self):
        self.statements = []
        self.added = []
        self.conversation = Conversation(id=42, user_id=1, title="Owned chat")

    async def scalars(self, statement):
        self.statements.append(statement)
        return SimpleNamespace(all=lambda: [11, 11])

    async def scalar(self, statement):
        self.statements.append(statement)
        return self.conversation

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        pass

    async def refresh(self, item):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


@pytest.fixture
def index(monkeypatch):
    # Alice: ready 11, processing 12, failed 13, deleting 14, orphan 99.
    # Bob: ready 21. ANN order deliberately differs from ID/distance order.
    rows = [
        (2, 2, 21, "bob-ready"),
        (3, 1, 12, "alice-processing"),
        (4, 1, 13, "alice-failed"),
        (5, 1, 14, "alice-deleting"),
        (6, 1, None, "alice-raw"),
        (1, 1, 11, "alice-ready"),
        (7, 2, None, "bob-raw"),
        (8, 1, 99, "alice-orphan"),
        (9, None, None, "unowned-raw"),
    ]
    results = [
        SearchResult(
            distance=float(10 - item_id),
            item=VectorItem(
                id=item_id, user_id=owner, document_id=document,
                metadata=text, category="testing", embedding=[0.5] * 768,
            ),
        )
        for item_id, owner, document, text in rows
    ]
    fake = FakeIndex(results)
    monkeypatch.setattr(state, "vector_db", fake)
    return fake


def test_alice_retrieves_only_ready_and_owned_raw_vectors_in_ann_order(index):
    results = _service().search_user_vectors(np.ones(768), 1, {11}, k=5)
    assert [result.item.id for result in results] == [6, 1]


def test_bob_cannot_retrieve_alices_document_or_raw_vectors(index):
    results = _service().search_user_vectors(np.ones(768), 2, {21}, k=5)
    assert [result.item.id for result in results] == [2, 7]


@pytest.mark.parametrize(
    "item_id,expected",
    [(1, True), (2, False), (3, False), (4, False), (5, False),
     (6, True), (7, False), (8, False), (9, False)],
    ids=["ready", "other-user", "processing", "failed", "deleting",
         "owned-raw", "other-raw", "orphan", "unowned-raw"],
)
def test_item_eligibility_enforces_owner_and_ready_document(index, item_id, expected):
    item = next(result.item for result in index.results if result.item.id == item_id)
    assert _service().is_searchable_for_user(item, 1, {11, 21}) is expected


def test_ready_document_query_filters_owner_and_ready_status():
    session = FakeSession()
    assert asyncio.run(_service().get_ready_document_ids(session, 7)) == {11}
    statement = session.statements[0]
    assert [column.name for column in statement.selected_columns] == ["id"]
    assert statement.compile().params == {"user_id_1": 7, "status_1": "ready"}


def test_empty_index_does_not_search(monkeypatch):
    index = FakeIndex([])
    monkeypatch.setattr(state, "vector_db", index)
    assert _service().search_user_vectors(np.ones(768), 1, {11}, k=5) == []
    assert index.search_calls == []


@pytest.mark.parametrize("total,k,expected", [(50, 5, 50), (1000, 1, 200), (1000, 5, 250)])
def test_ann_overfetch_preserves_floor_multiplier_and_index_cap(index, total, k, expected):
    index.total = total
    query = np.ones(768)
    results = _service().search_user_vectors(query, 1, {11}, k=k)
    assert index.search_calls[0][0] is query
    assert index.search_calls[0][1] == expected
    assert [result.item.id for result in results] == ([6] if k == 1 else [6, 1])


def test_searchable_enumeration_uses_same_eligibility_and_shared_lock(index):
    items = asyncio.run(_service().get_searchable_user_items(1, {11}))
    assert [item.id for item in items] == [6, 1]


def test_cleanup_enumeration_includes_all_owned_non_ready_items(index):
    items = asyncio.run(_service().get_all_user_items(1))
    assert [item.id for item in items] == [3, 4, 5, 6, 1, 8]


def test_ask_filters_before_reranker_and_llm_and_preserves_ndjson(index, monkeypatch):
    # Require the service first: the initial RED run must fail before any inference work.
    _service()
    from main import app
    from services import rag as rag_service

    session = FakeSession()
    monkeypatch.setattr(rag_service.embedder, "embed_text", AsyncMock(return_value=[0.5] * 768))
    monkeypatch.setattr(rag_service, "AsyncSessionLocal", lambda: session)

    def rerank(question, results, top_n):
        assert [result.item.id for result in results] == [6, 1]
        return [(1.0, result) for result in results[:top_n]]

    async def generate(question, chunks):
        assert chunks == ["alice-raw", "alice-ready"]
        yield json.dumps({"type": "token", "data": "Safe answer"}) + "\n"

    monkeypatch.setattr(rag_service.cross_encoder, "rerank", rerank)
    monkeypatch.setattr(rag_service.llm_generator, "generate_stream", generate)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    app.dependency_overrides[get_db] = lambda: session
    try:
        response = TestClient(app).post(
            "/api/v1/ask", json={"question": "What is mine?", "k": 2, "conversation_id": 42},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-ndjson"
    assert response.text.endswith("\n")
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [event["type"] for event in events] == ["conversation", "sources", "token"]
    assert events[0] == {"type": "conversation", "data": {"id": 42, "title": "Owned chat"}}
    assert [source["vectorId"] for source in events[1]["data"]] == ["6", "1"]
    assert set(events[1]["data"][0]) == {"vectorId", "documentId", "category", "score", "snippet"}
    assert events[-1] == {"type": "token", "data": "Safe answer"}
