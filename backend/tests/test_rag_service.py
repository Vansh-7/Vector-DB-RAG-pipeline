import asyncio
import importlib
import json
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient
from groq import APIConnectionError

import api.state as state
from ai.generator import RagGenerator
from ai.providers.fallback import FallbackProvider
from auth.dependencies import get_current_user
from core.types import SearchResult, VectorItem
from db.models import Conversation, Message
from db.session import get_db


class ChatSession:
    def __init__(self, conversation, events, name):
        self.conversation = conversation
        self.events = events
        self.name = name
        self.pending = []
        self.messages = []
        self.fail_commit = False
        self.closed = False

    def add(self, item):
        assert not self.closed
        if isinstance(item, Conversation):
            item.id = 42
            self.conversation = item
        else:
            self.pending.append(item)

    async def flush(self):
        self.events.append((self.name, "flush"))

    async def scalar(self, statement):
        assert not self.closed
        params = statement.compile().params
        self.events.append((self.name, "lookup", params))
        if self.conversation and params == {"id_1": 42, "user_id_1": 1}:
            return self.conversation
        return None

    async def scalars(self, statement):
        assert not self.closed
        assert statement.compile().params == {"user_id_1": 1, "status_1": "ready"}
        return SimpleNamespace(all=lambda: [11])

    async def commit(self):
        assert not self.closed
        self.events.append((self.name, "commit"))
        if self.fail_commit:
            raise RuntimeError("database failed")
        self.messages.extend(self.pending)
        self.pending.clear()

    async def refresh(self, item):
        pass

    async def rollback(self):
        self.pending.clear()
        self.events.append((self.name, "rollback"))

    async def __aenter__(self):
        self.events.append((self.name, "enter"))
        return self

    async def __aexit__(self, *args):
        self.closed = True


@pytest.fixture
def rag(monkeypatch):
    service = importlib.import_module("services.rag")
    events = []
    conversation = Conversation(id=42, user_id=1, title="Owned chat")
    request = ChatSession(conversation, events, "request")
    stream = ChatSession(conversation, events, "stream")
    candidates = [
        SearchResult(
            distance=float(item_id),
            item=VectorItem(
                id=item_id,
                user_id=user_id,
                document_id=document_id,
                metadata=text,
                category="test",
                embedding=[0.5] * 768,
            ),
        )
        for item_id, user_id, document_id, text in [
            (2, 2, 21, "Bob secret"),
            (3, 1, 12, "processing"),
            (4, 1, 13, "failed"),
            (5, 1, 14, "deleting"),
            (6, 1, None, "Alice raw"),
            (1, 1, 11, "Alice ready"),
        ]
    ]

    def search(query, k):
        events.append(("ann", k))
        return candidates

    monkeypatch.setattr(state, "vector_db", SimpleNamespace(size=lambda: 1500, search=search))
    monkeypatch.setattr(state, "pca_models", {})

    async def embed(question):
        assert [(item.role, item.content) for item in request.messages] == [("user", "Question?")]
        events.append(("embed", question))
        return [0.5] * 768

    main_thread = threading.get_ident()

    def rerank(question, results, top_n):
        assert threading.get_ident() != main_thread
        assert question == "Question?"
        assert top_n == 2
        assert [result.item.id for result in results] == [6, 1]
        return [(2.0, results[0]), (1.0, results[1])]

    async def generate(question, chunks):
        assert chunks == ["Alice raw", "Alice ready"]
        yield '{"type": "token", "data": " Complete "}\n'
        yield '{"type": "token", "data": "answer "}\n'

    monkeypatch.setattr(service.embedder, "embed_text", embed)
    monkeypatch.setattr(service.cross_encoder, "rerank", rerank)
    monkeypatch.setattr(service.llm_generator, "generate_stream", generate)
    monkeypatch.setattr(service, "AsyncSessionLocal", lambda: stream)
    return service, request, stream, events


async def prepare(rag, conversation_id=42, user_id=1, question=" Question? "):
    service, request, _, _ = rag
    return await service.ask_question(question, 2, conversation_id, user_id, request)


def test_preparation_is_eager_and_stream_uses_fresh_session_after_request_closes(rag):
    _, request, stream_session, events = rag

    async def run():
        iterator = await prepare(rag)
        assert [message.role for message in request.messages] == ["user"]
        assert ("ann", 1000) in events  # broad_k=20, existing multiplier=50
        assert stream_session.messages == []
        request.closed = True
        return [chunk async for chunk in iterator]

    chunks = asyncio.run(run())
    payloads = [json.loads(chunk) for chunk in chunks]
    assert [event["type"] for event in payloads] == ["conversation", "sources", "token", "token"]
    assert payloads[0] == {"type": "conversation", "data": {"id": 42, "title": "Owned chat"}}
    assert all(chunk.endswith("\n") for chunk in chunks)
    sources = payloads[1]["data"]
    assert [source["vectorId"] for source in sources] == ["6", "1"]
    assert sources[0] == {
        "vectorId": "6",
        "documentId": None,
        "category": "test",
        "score": 2.0,
        "snippet": "Alice raw",
    }
    assistant = stream_session.messages[0]
    assert isinstance(assistant, Message)
    assert (assistant.role, assistant.content, assistant.conversation_id) == (
        "assistant",
        "Complete answer",
        42,
    )
    assert assistant.sources == sources
    assert events.index(("request", "commit")) < events.index(("embed", "Question?"))


def test_new_conversation_is_created_before_user_turn(rag):
    _, request, stream, events = rag
    iterator = asyncio.run(prepare(rag, conversation_id=None))
    assert request.conversation.user_id == 1
    assert request.conversation.title == "Question?"
    assert request.messages[0].conversation_id == 42
    assert ("request", "flush") in events
    assert stream.messages == []
    asyncio.run(iterator.aclose())


def test_foreign_conversation_fails_before_embedding_and_stream(rag):
    service, request, stream, events = rag
    with pytest.raises(service.DomainError, match="Conversation not found") as error:
        asyncio.run(prepare(rag, user_id=2))
    assert error.value.kind == "not_found"
    assert request.messages == stream.messages == []
    assert not any(event[0] == "embed" for event in events)


@pytest.mark.parametrize(
    "failure,kind",
    [
        ("empty", "invalid"),
        ("commit", "internal"),
        ("embed", "unavailable"),
        ("dims", "internal"),
        ("rerank", "internal"),
    ],
)
def test_request_time_failures_remain_eager(rag, monkeypatch, failure, kind):
    service, request, stream, _ = rag
    question = "   " if failure == "empty" else " Question? "
    if failure == "commit":
        request.fail_commit = True
    elif failure == "embed":
        monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(side_effect=RuntimeError()))
    elif failure == "dims":
        monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(return_value=[1.0]))
    elif failure == "rerank":
        monkeypatch.setattr(service.cross_encoder, "rerank", lambda *args, **kw: 1 / 0)
    with pytest.raises(service.DomainError) as error:
        asyncio.run(prepare(rag, question=question))
    assert error.value.kind == kind
    assert stream.messages == []
    assert len(request.messages) == (0 if failure in {"empty", "commit"} else 1)


@pytest.mark.parametrize(
    "mode", ["error-event", "exception", "empty", "whitespace", "cancel", "disconnect"]
)
def test_incomplete_or_failed_streams_never_persist_assistant(rag, monkeypatch, mode):
    service, _, stream, _ = rag

    async def generate(question, chunks):
        if mode == "empty":
            return
        yield (
            json.dumps({"type": "token", "data": "  " if mode == "whitespace" else "partial"})
            + "\n"
        )
        if mode == "error-event":
            yield '{"type":"error","data":"LLM generation failed."}\n'
        elif mode == "exception":
            raise RuntimeError("private upstream details")
        elif mode == "cancel":
            raise asyncio.CancelledError()

    monkeypatch.setattr(service.llm_generator, "generate_stream", generate)

    async def run():
        iterator = await prepare(rag)
        if mode == "disconnect":
            assert json.loads(await anext(iterator))["type"] == "conversation"
            await anext(iterator)  # sources
            await anext(iterator)  # first token
            await iterator.aclose()
            return []
        return [chunk async for chunk in iterator]

    if mode == "cancel":
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(run())
    else:
        chunks = asyncio.run(run())
        assert "private upstream details" not in "".join(chunks)
        if mode == "exception":
            assert json.loads(chunks[-1]) == {"type": "error", "data": "LLM generation failed."}
    assert stream.messages == []


def test_assistant_database_failure_does_not_change_delivered_answer(rag):
    _, _, stream, _ = rag
    stream.fail_commit = True

    async def run():
        return [json.loads(chunk) async for chunk in await prepare(rag)]

    events = asyncio.run(run())
    assert [event["type"] for event in events] == ["conversation", "sources", "token", "token"]
    assert stream.messages == []


def test_groq_fallback_uses_only_filtered_context_and_persists_completed_answer(rag, monkeypatch):
    service, _, stream, _ = rag
    seen = []

    class Provider:
        def __init__(self, fail):
            self.fail = fail

        async def stream(self, messages):
            seen.append(messages)
            if self.fail:
                raise APIConnectionError(request=httpx.Request("POST", "https://example.test"))
            yield "Fallback answer"

    generator = RagGenerator(FallbackProvider(Provider(True), Provider(False)))
    monkeypatch.setattr(service, "llm_generator", generator)

    async def run():
        return [json.loads(chunk) async for chunk in await prepare(rag)]

    result = asyncio.run(run())
    assert result[-1] == {"type": "token", "data": "Fallback answer"}
    assert len(seen) == 2
    for messages in seen:
        prompt = messages[0]["content"]
        assert "Alice raw" in prompt and "Alice ready" in prompt
        assert not any(
            text in prompt for text in ["Bob secret", "processing", "failed", "deleting"]
        )
    assert stream.messages[0].content == "Fallback answer"


def test_non_positive_reranker_scores_never_enter_sources_or_llm(rag, monkeypatch):
    service, _, stream, _ = rag
    monkeypatch.setattr(
        service.cross_encoder,
        "rerank",
        lambda question, results, top_n: [(0.0, results[0]), (-1.0, results[1])],
    )
    seen = []

    async def generate(question, chunks):
        seen.extend(chunks)
        yield '{"type":"token","data":"No context"}\n'

    monkeypatch.setattr(service.llm_generator, "generate_stream", generate)

    async def run():
        return [json.loads(chunk) async for chunk in await prepare(rag)]

    result = asyncio.run(run())
    assert result[1] == {"type": "sources", "data": []}
    assert seen == []
    assert stream.messages[0].sources is None


def test_query_projection_uses_shared_user_cache_in_stream(rag, monkeypatch):
    from sklearn.decomposition import PCA

    model = PCA(n_components=2).fit([[0, 0], [2, 0], [0, 2]])
    monkeypatch.setattr(state, "DEFAULT_DIMS", 2)
    state.pca_models[1] = (model, float(np.sqrt(2)))
    service, _, _, _ = rag
    monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(return_value=[2.0, 0.0]))

    async def run():
        return [json.loads(chunk) async for chunk in await prepare(rag)]

    events = asyncio.run(run())
    assert events[2]["type"] == "query_2d"
    assert np.abs(events[2]["data"]) == pytest.approx([1, 1 / 3])


@pytest.mark.parametrize(
    "failure,code,detail",
    [
        ("empty", 400, "Question cannot be empty."),
        ("foreign", 404, "Conversation not found."),
        ("embed", 503, "Embedding service is unavailable."),
        ("dims", 500, "Embedding model returned an invalid vector."),
        ("commit", 500, "Failed to persist chat message."),
    ],
)
def test_rag_http_failures_occur_before_stream_headers(rag, monkeypatch, failure, code, detail):
    from main import app

    service, request, stream, _ = rag
    if failure == "embed":
        monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(side_effect=RuntimeError()))
    elif failure == "dims":
        monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(return_value=[1.0]))
    elif failure == "commit":
        request.fail_commit = True
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=2 if failure == "foreign" else 1
    )
    app.dependency_overrides[get_db] = lambda: request
    try:
        response = TestClient(app).post(
            "/api/v1/ask",
            json={
                "question": "   " if failure == "empty" else "Question?",
                "k": 2,
                "conversation_id": 42,
            },
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == code
    assert response.json() == {"detail": detail}
    assert response.headers["content-type"] == "application/json"
    assert stream.messages == []


def test_conversation_deleted_during_stream_is_not_recreated(rag):
    _, _, session, _ = rag
    session.conversation = None

    async def run():
        return [json.loads(chunk) async for chunk in await prepare(rag)]

    result = asyncio.run(run())
    assert result[-1]["type"] == "token"
    assert session.messages == []
