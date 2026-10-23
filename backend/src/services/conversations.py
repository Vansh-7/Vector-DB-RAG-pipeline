from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import logger
from db.models import Conversation, Message
from services.errors import DomainError


def _normalize_title(title: str | None) -> str:
    if title is None:
        return "New chat"
    normalized = " ".join(title.split()).strip()
    if not normalized:
        return "New chat"
    return normalized[:255]


async def _get_owned_conversation(
    session: AsyncSession, conversation_id: int, user_id: int
) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user_id
        )
    )
    if conversation is None:
        raise DomainError(kind="not_found", message="Conversation not found.")
    return conversation


async def create_conversation(
    title: str | None, user_id: int, session: AsyncSession
) -> Conversation:
    conversation = Conversation(user_id=user_id, title=_normalize_title(title))
    session.add(conversation)
    try:
        await session.commit()
        await session.refresh(conversation)
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Failed creating conversation user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Failed to create conversation.") from exc
    return conversation


async def list_conversations(user_id: int, session: AsyncSession) -> list[Conversation]:
    result = await session.scalars(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    )
    return list(result.all())


async def list_messages(conversation_id: int, user_id: int, session: AsyncSession) -> list[Message]:
    await _get_owned_conversation(session, conversation_id, user_id)
    result = await session.scalars(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    return list(result.all())


async def update_conversation(
    conversation_id: int, title: str, user_id: int, session: AsyncSession
) -> Conversation:
    conversation = await _get_owned_conversation(session, conversation_id, user_id)
    title = " ".join(title.split()).strip()
    if not title:
        raise DomainError(kind="invalid", message="Conversation title cannot be empty.")
    conversation.title = title[:255]
    try:
        await session.commit()
        await session.refresh(conversation)
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Conversation rename failed conversation_id={conversation_id}: {exc}")
        raise DomainError(kind="internal", message="Failed to update conversation.") from exc
    return conversation


async def delete_conversation(
    conversation_id: int, user_id: int, session: AsyncSession
) -> dict[str, Any]:
    conversation = await _get_owned_conversation(session, conversation_id, user_id)
    try:
        await session.delete(conversation)
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Conversation deletion failed conversation_id={conversation_id}: {exc}")
        raise DomainError(kind="internal", message="Failed to delete conversation.") from exc
    return {"deleted_conversation_id": conversation_id}
