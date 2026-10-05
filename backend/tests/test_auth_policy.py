from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from auth.schemas import LoginRequest, RegisterRequest


@pytest.mark.parametrize(
    "password",
    ["Aa1!aaa", "aaaaaaaa1!", "AAAAAAAA1!", "Aaaaaaaa!", "Aaaaaaaa1", "Aaaaaaa1 ",
     "Àaaaaaa1!", "AÀÀÀÀÀÀ1!", "Aaaaaaa1é", "Aa1!" + "a" * 125],
)
def test_registration_rejects_each_missing_requirement(password):
    with pytest.raises(ValidationError):
        RegisterRequest(email="user@example.com", password=password)


@pytest.mark.parametrize("password", ["Aa1!aaaa", "Aa1!" + "a" * 124, "Aaaaaaa1€", "Aaaaaaa1🙂"])
def test_registration_accepts_valid_passwords(password):
    assert RegisterRequest(email="user@example.com", password=password).password == password


def test_existing_password_remains_valid_for_login():
    assert LoginRequest(email="user@example.com", password="legacy-password").password == "legacy-password"


@pytest.fixture
def auth_client(monkeypatch):
    from api.auth_routes import router
    from db.session import get_db

    session = SimpleNamespace(
        scalar=AsyncMock(return_value=None),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    def add(user):
        user.id = 1
        user.is_active = True
        user.created_at = datetime.now(timezone.utc)
        session.scalar.return_value = user

    session.add = add
    monkeypatch.setattr("api.auth_routes.create_access_token", lambda user_id: "test-session-token")
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_db] = lambda: session
    return TestClient(app), session


def test_registration_endpoint_enforces_policy_without_frontend(auth_client):
    client, session = auth_client
    response = client.post("/api/v1/auth/register", json={"email": "user@example.com", "password": "aaaaaaaa"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "password"]
    session.scalar.assert_not_awaited()
    session.commit.assert_not_awaited()


def test_register_login_and_duplicate_account(auth_client):
    client, session = auth_client
    credentials = {"email": "User@example.com", "password": "Aa1!aaaa"}
    response = client.post("/api/v1/auth/register", json=credentials)
    assert response.status_code == 201
    assert response.json()["email"] == "user@example.com"
    assert session.scalar.return_value.password_hash != credentials["password"]
    session.commit.assert_awaited_once()
    response = client.post("/api/v1/auth/login", json=credentials)
    assert response.status_code == 200
    assert response.json()["access_token"] == "test-session-token"
    assert client.post("/api/v1/auth/register", json=credentials).status_code == 409
    assert client.post("/api/v1/auth/login", json={**credentials, "password": "wrong-password"}).status_code == 401
    session.commit.assert_awaited_once()


def test_registration_endpoint_rejects_invalid_email(auth_client):
    client, session = auth_client
    assert client.post("/api/v1/auth/register", json={"email": "invalid", "password": "Aa1!aaaa"}).status_code == 422
    session.commit.assert_not_awaited()
