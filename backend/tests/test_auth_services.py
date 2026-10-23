import asyncio
import importlib
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.exc import IntegrityError

import auth.security as security
from db.models import Conversation, Message, User


@pytest.fixture
def services():
    return importlib.import_module("services.auth"), importlib.import_module(
        "services.conversations"
    )


@pytest.fixture
def session():
    result = SimpleNamespace(
        scalar=AsyncMock(return_value=None),
        scalars=AsyncMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
        rollback=AsyncMock(),
        delete=AsyncMock(),
        added=[],
    )

    def add(item):
        item.id = 42
        item.created_at = datetime.now(timezone.utc)
        if isinstance(item, User):
            item.is_active = True
        else:
            item.updated_at = item.created_at
        result.added.append(item)

    result.add = Mock(side_effect=add)
    return result


def test_register_normalizes_email_and_uses_existing_password_hashing(services, session):
    auth, _ = services
    user = asyncio.run(auth.register(" User@EXAMPLE.com ", "Aa1!aaaa", session))
    assert user.email == "user@example.com"
    assert user.id == 42
    assert user.password_hash != "Aa1!aaaa"
    assert security.verify_password("Aa1!aaaa", user.password_hash)
    assert session.scalar.await_args.args[0].compile().params == {"email_1": "user@example.com"}
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(user)


def test_duplicate_registration_is_conflict_before_mutation(services, session):
    auth, _ = services
    session.scalar.return_value = User(id=7)
    with pytest.raises(auth.DomainError) as error:
        asyncio.run(auth.register("user@example.com", "Aa1!aaaa", session))
    assert error.value.kind == "conflict"
    session.add.assert_not_called()
    session.commit.assert_not_awaited()


def test_duplicate_registration_race_rolls_back(services, session):
    auth, _ = services
    session.commit.side_effect = IntegrityError("insert", {}, RuntimeError("unique email"))
    with pytest.raises(auth.DomainError) as error:
        asyncio.run(auth.register("user@example.com", "Aa1!aaaa", session))
    assert error.value.kind == "conflict"
    session.rollback.assert_awaited_once()


def test_login_uses_user_id_as_existing_jwt_subject_and_accepts_legacy_password(
    services,
    session,
    monkeypatch,
):
    auth, _ = services
    monkeypatch.setattr(
        security,
        "settings",
        SimpleNamespace(
            jwt_secret_key="local-test-secret-" * 4, jwt_access_token_expire_minutes=30
        ),
    )
    session.scalar.return_value = User(
        id=7,
        email="user@example.com",
        is_active=True,
        password_hash=security.hash_password("legacy-password"),
    )
    token = asyncio.run(auth.login(" User@EXAMPLE.com ", "legacy-password", session))
    assert security.decode_access_token(token) == 7
    assert session.scalar.await_args.args[0].compile().params == {"email_1": "user@example.com"}
    session.commit.assert_not_awaited()


@pytest.mark.parametrize(
    "kind,expected",
    [("missing", "unauthorized"), ("password", "unauthorized"), ("disabled", "forbidden")],
)
def test_login_failure_categories_remain_unchanged(services, session, kind, expected):
    auth, _ = services
    if kind != "missing":
        session.scalar.return_value = User(
            id=7,
            is_active=kind != "disabled",
            password_hash=security.hash_password("legacy-password"),
        )
    with pytest.raises(auth.DomainError) as error:
        asyncio.run(
            auth.login(
                "user@example.com",
                "wrong-password" if kind == "password" else "legacy-password",
                session,
            )
        )
    assert error.value.kind == expected
    session.commit.assert_not_awaited()


@pytest.mark.parametrize(
    "title,expected",
    [(None, "New chat"), ("   ", "New chat"), ("  My   chat ", "My chat"), ("a" * 256, "a" * 255)],
    ids=["omitted", "blank", "normalized", "truncated"],
)
def test_conversation_creation_retains_title_and_owner_rules(services, session, title, expected):
    _, conversations = services
    conversation = asyncio.run(conversations.create_conversation(title, 7, session))
    assert (conversation.user_id, conversation.title) == (7, expected)
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(conversation)


def owned_conversation(session):
    conversation = Conversation(id=42, user_id=7, title="Owned")
    session.scalar.return_value = conversation
    return conversation


def test_conversation_list_uses_owner_and_stable_updated_order(services, session):
    _, conversations = services
    owned = owned_conversation(session)
    session.scalars.return_value = SimpleNamespace(all=lambda: [owned])
    result = asyncio.run(conversations.list_conversations(7, session))
    assert result == [owned]
    statement = session.scalars.await_args.args[0]
    assert statement.compile().params == {"user_id_1": 7}
    assert "conversations.updated_at DESC, conversations.id DESC" in str(statement)


def test_message_list_verifies_ownership_before_stable_message_order(services, session):
    _, conversations = services
    owned_conversation(session)
    messages = [
        Message(id=1, conversation_id=42, role="user", content="Hello"),
        Message(id=2, conversation_id=42, role="assistant", content="Answer"),
    ]
    session.scalars.return_value = SimpleNamespace(all=lambda: messages)
    assert asyncio.run(conversations.list_messages(42, 7, session)) == messages
    assert session.scalar.await_args.args[0].compile().params == {"id_1": 42, "user_id_1": 7}
    statement = session.scalars.await_args.args[0]
    assert statement.compile().params == {"conversation_id_1": 42}
    assert "messages.created_at ASC, messages.id ASC" in str(statement)


@pytest.mark.parametrize("operation", ["messages", "rename", "delete"])
def test_cross_user_conversation_operations_are_not_found_without_side_effect(
    services, session, operation
):
    _, conversations = services
    functions = {
        "messages": lambda: conversations.list_messages(42, 7, session),
        "rename": lambda: conversations.update_conversation(42, "Title", 7, session),
        "delete": lambda: conversations.delete_conversation(42, 7, session),
    }
    with pytest.raises(conversations.DomainError) as error:
        asyncio.run(functions[operation]())
    assert error.value.kind == "not_found"
    assert str(error.value) == "Conversation not found."
    assert session.scalar.await_args.args[0].compile().params == {"id_1": 42, "user_id_1": 7}
    session.scalars.assert_not_awaited()
    session.commit.assert_not_awaited()
    session.delete.assert_not_awaited()


def test_conversation_rename_and_delete_preserve_result(services, session):
    _, conversations = services
    conversation = owned_conversation(session)
    assert (
        asyncio.run(conversations.update_conversation(42, " Renamed   chat ", 7, session))
        is conversation
    )
    assert conversation.title == "Renamed chat"
    assert asyncio.run(conversations.delete_conversation(42, 7, session)) == {
        "deleted_conversation_id": 42
    }
    session.delete.assert_awaited_once_with(conversation)
    assert session.commit.await_count == 2


def test_empty_rename_is_invalid_before_commit(services, session):
    _, conversations = services
    owned_conversation(session)
    with pytest.raises(conversations.DomainError) as error:
        asyncio.run(conversations.update_conversation(42, "   ", 7, session))
    assert error.value.kind == "invalid"
    session.commit.assert_not_awaited()


@pytest.mark.parametrize(
    "operation,message",
    [
        ("create", "Failed to create conversation."),
        ("rename", "Failed to update conversation."),
        ("delete", "Failed to delete conversation."),
    ],
)
def test_conversation_write_failures_rollback_and_preserve_error(
    services, session, operation, message
):
    _, conversations = services
    owned_conversation(session)
    session.commit.side_effect = RuntimeError("database failed")
    functions = {
        "create": lambda: conversations.create_conversation("Title", 7, session),
        "rename": lambda: conversations.update_conversation(42, "Title", 7, session),
        "delete": lambda: conversations.delete_conversation(42, 7, session),
    }
    with pytest.raises(conversations.DomainError) as error:
        asyncio.run(functions[operation]())
    assert error.value.kind == "internal"
    assert str(error.value) == message
    session.rollback.assert_awaited_once()
