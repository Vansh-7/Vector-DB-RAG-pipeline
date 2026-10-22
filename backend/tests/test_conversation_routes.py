from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient

from auth.dependencies import get_current_user
from db.models import Conversation, Message
from db.session import get_db
from main import app


@pytest.fixture
def conversation_client():
    user = SimpleNamespace(id=7)
    now = datetime.now(timezone.utc)
    session = SimpleNamespace(
        scalar=AsyncMock(),
        scalars=AsyncMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
        rollback=AsyncMock(),
        delete=AsyncMock(),
    )

    def add(conversation):
        conversation.id = 42
        conversation.created_at = now
        conversation.updated_at = now

    session.add = Mock(side_effect=add)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: session
    try:
        yield TestClient(app), session, user
    finally:
        app.dependency_overrides.clear()


def test_conversation_lifecycle_through_aggregate_router(conversation_client):
    client, session, user = conversation_client
    response = client.post("/api/v1/conversations", json={"title": "  My   chat  "})
    assert response.status_code == 201
    assert response.json()["title"] == "My chat"
    conversation = session.add.call_args.args[0]
    assert conversation.user_id == user.id
    assert response.json()["id"] == conversation.id

    session.scalars.return_value = SimpleNamespace(all=lambda: [conversation])
    response = client.get("/api/v1/conversations")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [conversation.id]
    list_query = session.scalars.await_args.args[0]
    assert list_query.compile().params["user_id_1"] == user.id

    message = Message(
        id=1, conversation_id=conversation.id, role="user", content="Hello",
        created_at=conversation.created_at,
    )
    session.scalar.return_value = conversation
    session.scalars.return_value = SimpleNamespace(all=lambda: [message])
    response = client.get(f"/api/v1/conversations/{conversation.id}/messages")
    assert response.status_code == 200
    assert response.json()[0]["content"] == "Hello"

    response = client.patch(
        f"/api/v1/conversations/{conversation.id}", json={"title": " Renamed   chat "},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed chat"

    response = client.delete(f"/api/v1/conversations/{conversation.id}")
    assert response.status_code == 200
    assert response.json() == {"deleted_conversation_id": conversation.id}
    session.delete.assert_awaited_once_with(conversation)
    assert session.commit.await_count == 3
    for call in session.scalar.await_args_list:
        params = call.args[0].compile().params
        assert params["user_id_1"] == user.id
        assert params["id_1"] == conversation.id
    session.rollback.assert_not_awaited()


@pytest.mark.parametrize(
    "method,suffix",
    [("GET", "/messages"), ("PATCH", ""), ("DELETE", "")],
)
def test_unowned_conversation_is_not_exposed(conversation_client, method, suffix):
    client, session, user = conversation_client
    session.scalar.return_value = None
    response = client.request(
        method, f"/api/v1/conversations/99{suffix}", json={"title": "Other chat"},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Conversation not found."}
    query = session.scalar.await_args.args[0]
    assert query.column_descriptions[0]["entity"] is Conversation
    assert query.compile().params == {"id_1": 99, "user_id_1": user.id}
    session.scalars.assert_not_awaited()
    session.commit.assert_not_awaited()
    session.delete.assert_not_awaited()
