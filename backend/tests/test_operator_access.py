import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from auth.dependencies import get_current_user, get_operator_user
from db.models import User
from main import app


def _user(user_id: int) -> User:
    return User(id=user_id, email=f"user{user_id}@example.com", password_hash="unused")


@pytest.mark.parametrize("operator_ids", [frozenset(), frozenset({1})])
@pytest.mark.parametrize(
    "path,params",
    [
        ("/api/v1/save", None),
        ("/api/v1/engine/configure", {"algorithm": "hnsw", "metric": "cosine"}),
    ],
)
def test_shared_operations_reject_regular_users(monkeypatch, path, params, operator_ids) -> None:
    monkeypatch.setattr(
        "auth.dependencies.settings",
        SimpleNamespace(operator_user_ids=operator_ids),
    )
    app.dependency_overrides[get_current_user] = lambda: _user(2)
    try:
        response = TestClient(app).post(path, params=params)
        assert response.status_code == 403
        assert response.json()["detail"] == "Operator access required for shared-index operations."
    finally:
        app.dependency_overrides.clear()


def test_allowlisted_operator_passes_guard(monkeypatch) -> None:
    monkeypatch.setattr(
        "auth.dependencies.settings",
        SimpleNamespace(operator_user_ids=frozenset({1})),
    )
    user = _user(1)
    assert asyncio.run(get_operator_user(user)) is user


def test_allowlisted_operator_can_save(monkeypatch) -> None:
    import api.state as state

    saved = []
    cleared = []

    class FakeDB:
        def save(self, path) -> None:
            saved.append(path)

    class FakeWAL:
        def clear(self) -> None:
            cleared.append(True)

    monkeypatch.setattr(
        "auth.dependencies.settings", SimpleNamespace(operator_user_ids=frozenset({1}))
    )
    monkeypatch.setattr(state, "vector_db", FakeDB())
    monkeypatch.setattr(state, "wal", FakeWAL())
    app.dependency_overrides[get_current_user] = lambda: _user(1)
    try:
        response = TestClient(app).post("/api/v1/save")
        assert response.status_code == 200
        assert saved == [state.DB_FILE]
        assert cleared == [True]
    finally:
        app.dependency_overrides.clear()
