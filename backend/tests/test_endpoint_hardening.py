import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute, iter_route_contexts
from fastapi.testclient import TestClient
from starlette.requests import Request

import api.state as state
import auth.security as security
from auth.dependencies import get_current_user
from core.types import VectorItem
from db.session import get_db
from main import app
from services import engine


def test_anonymous_status_is_only_liveness_and_does_not_read_shared_index(monkeypatch):
    def forbidden():
        raise AssertionError("public liveness read tenant data")

    monkeypatch.setattr(
        state, "vector_db", SimpleNamespace(size=forbidden, get_all_items=forbidden)
    )
    response = TestClient(app).get("/api/v1/status")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_authenticated_status_count_is_owned_and_does_not_expose_other_users(monkeypatch):
    records = [
        VectorItem(id=i, user_id=owner, metadata="private", category="test", embedding=[1])
        for i, owner in [(1, 1), (2, 2), (3, 2)]
    ]
    monkeypatch.setattr(state, "vector_db", SimpleNamespace(get_all_items=lambda: records))
    assert asyncio.run(engine.get_db_status(1))["total_docs"] == 1
    assert asyncio.run(engine.get_db_status(2))["total_docs"] == 2
    assert asyncio.run(engine.get_db_status(3))["total_docs"] == 0


@pytest.mark.parametrize("authorization", ["Bearer invalid", "Basic invalid"])
def test_invalid_optional_status_credentials_do_not_downgrade_to_liveness(
    authorization, monkeypatch
):
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(jwt_secret_key="test-only-secret-long-enough-for-hs256"),
    )
    response = TestClient(app).get("/api/v1/status", headers={"Authorization": authorization})
    assert response.status_code == 401


def test_valid_jwt_status_keeps_frontend_shape_and_uses_database_user(monkeypatch):
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(
            jwt_secret_key="test-only-secret-long-enough-for-hs256",
            jwt_access_token_expire_minutes=5,
        ),
    )
    record = VectorItem(id=1, user_id=1, metadata="private", category="test", embedding=[1])
    monkeypatch.setattr(state, "vector_db", SimpleNamespace(get_all_items=lambda: [record]))
    session = SimpleNamespace(get=AsyncMock(return_value=SimpleNamespace(id=1, is_active=True)))
    app.dependency_overrides[get_db] = lambda: session
    try:
        response = TestClient(app).get(
            "/api/v1/status", headers={"Authorization": "Bearer " + security.create_access_token(1)}
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {
        "engine": state.ACTIVE_ALGORITHM,
        "metric": state.ACTIVE_METRIC,
        "total_docs": 1,
    }
    assert session.get.await_args.args[1] == 1


def test_user_rate_budget_is_isolated_and_expires():
    from api.limits import Limiter

    now = [0.0]
    limiter = Limiter(clock=lambda: now[0])
    first = limiter.acquire("ask", 1, maximum=1, concurrent=1)
    limiter.release(first)
    with pytest.raises(HTTPException) as error:
        limiter.acquire("ask", 1, maximum=1, concurrent=1)
    assert error.value.status_code == 429
    assert error.value.headers == {"Retry-After": "60"}
    other = limiter.acquire("ask", 2, maximum=1, concurrent=1)
    limiter.release(other)
    now[0] = 60.0
    limiter.release(limiter.acquire("ask", 1, maximum=1, concurrent=1))


def test_concurrent_budget_is_scoped_and_release_does_not_reset_rate():
    from api.limits import Limiter

    limiter = Limiter()
    first = limiter.acquire("ingestion", 1, maximum=3, concurrent=1)
    with pytest.raises(HTTPException) as error:
        limiter.acquire("ingestion", 1, maximum=3, concurrent=1)
    assert error.value.status_code == 429
    limiter.release(limiter.acquire("ingestion", 2, maximum=3, concurrent=1))
    limiter.release(first)
    limiter.release(limiter.acquire("ingestion", 1, maximum=3, concurrent=1))


def test_auth_ip_budget_ignores_arbitrary_forwarded_header():
    from api.limits import auth_limiter, login_limit

    auth_limiter.entries.clear()
    for i in range(10):
        request = Request(
            {
                "type": "http",
                "client": ("192.0.2.10", 123),
                "headers": [(b"x-forwarded-for", f"198.51.100.{i}".encode())],
            }
        )

        async def accepted():
            guard = login_limit(request)
            await anext(guard)
            await guard.aclose()

        asyncio.run(accepted())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            anext(
                login_limit(Request({"type": "http", "client": ("192.0.2.10", 123), "headers": []}))
            )
        )
    assert error.value.status_code == 429


@pytest.mark.parametrize("failure", [RuntimeError, asyncio.CancelledError])
def test_user_guard_releases_slot_after_error_or_cancel(failure):
    from api.limits import ingestion_limit, user_limiter

    user_limiter.entries.clear()

    async def run():
        guard = ingestion_limit(SimpleNamespace(id=1))
        await anext(guard)
        with pytest.raises(failure):
            await guard.athrow(failure())
        again = ingestion_limit(SimpleNamespace(id=1))
        await anext(again)
        await again.aclose()

    asyncio.run(run())


def test_sensitive_routes_have_admission_controls_without_losing_jwt_guards():
    expected = {
        "register": "register_limit",
        "login": "login_limit",
        "insert_vector": "vector_insert_limit",
        "ingest_document": "ingestion_limit",
        "ingest_file": "ingestion_limit",
        "ask_question": "rag_limit",
        "search_vectors": "search_limit",
        "search_vectors_by_text": "search_limit",
        "get_benchmarks": "benchmark_limit",
        "get_vectors_sample": "visualization_limit",
    }
    for route in iter_route_contexts(app.routes):
        if isinstance(route.original_route, APIRoute) and route.name in expected:
            calls = [dependency.call for dependency in route.dependant.dependencies]
            assert expected[route.name] in [call.__name__ for call in calls]
            if route.name not in {"register", "login"}:
                assert get_current_user in calls


def test_http_login_limit_rejects_before_password_work(monkeypatch):
    from services import auth as auth_service
    from services.errors import DomainError

    login = AsyncMock(side_effect=DomainError("unauthorized", "Invalid email or password."))
    monkeypatch.setattr(auth_service, "login", login)
    app.dependency_overrides[get_db] = lambda: SimpleNamespace()
    try:
        client = TestClient(app)
        for _ in range(10):
            assert (
                client.post(
                    "/api/v1/auth/login",
                    json={"email": "test@example.com", "password": "wrong-password"},
                ).status_code
                == 401
            )
        response = client.post(
            "/api/v1/auth/login", json={"email": "test@example.com", "password": "wrong-password"}
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) >= 1
    assert login.await_count == 10


def test_http_user_limit_preserves_another_users_allowance(monkeypatch):
    from services import documents

    ingest = AsyncMock(
        return_value={
            "document_id": 1,
            "status": "ready",
            "chunk_count": 1,
            "message": "Document ingested successfully.",
        }
    )
    monkeypatch.setattr(documents, "ingest_document", ingest)

    async def user(request: Request):
        return SimpleNamespace(id=int(request.headers.get("test-user", "1")))

    app.dependency_overrides[get_current_user] = user
    app.dependency_overrides[get_db] = lambda: SimpleNamespace()
    try:
        client = TestClient(app)
        for _ in range(10):
            assert client.post("/api/v1/ingest", json={"text": "text"}).status_code == 201
        assert client.post("/api/v1/ingest", json={"text": "text"}).status_code == 429
        assert (
            client.post(
                "/api/v1/ingest", json={"text": "text"}, headers={"test-user": "2"}
            ).status_code
            == 201
        )
    finally:
        app.dependency_overrides.clear()
    assert ingest.await_count == 11


@pytest.mark.parametrize("cancel", [False, True])
def test_stream_slot_lasts_through_body_and_releases_on_completion_or_cancel(monkeypatch, cancel):
    from api.limits import user_limiter
    from services import rag

    async def run():
        entered, finish = asyncio.Event(), asyncio.Event()

        async def answer(*args):
            async def stream():
                yield '{"type":"token","data":"text"}\n'
                entered.set()
                await finish.wait()

            return stream()

        monkeypatch.setattr(rag, "ask_question", answer)
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
        app.dependency_overrides[get_db] = lambda: SimpleNamespace()
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                request = asyncio.create_task(client.post("/api/v1/ask", json={"question": "hi"}))
                await asyncio.wait_for(entered.wait(), timeout=5)
                assert user_limiter.entries[("rag", 1)].active == 1
                if cancel:
                    request.cancel()
                    with pytest.raises(asyncio.CancelledError):
                        await request
                else:
                    finish.set()
                    assert (await request).status_code == 200
                assert user_limiter.entries[("rag", 1)].active == 0
        finally:
            app.dependency_overrides.clear()

    asyncio.run(run())


def test_bounded_counter_eviction_never_discards_active_slots():
    from api.limits import Limiter

    limiter = Limiter(max_entries=2)
    first = limiter.acquire("ask", 1, maximum=3, concurrent=1)
    idle = limiter.acquire("ask", 2, maximum=3, concurrent=1)
    limiter.release(idle)
    third = limiter.acquire("ask", 3, maximum=3, concurrent=1)
    assert ("ask", 1) in limiter.entries
    assert ("ask", 2) not in limiter.entries
    assert len(limiter.entries) == 2
    limiter.release(first)
    limiter.release(third)
