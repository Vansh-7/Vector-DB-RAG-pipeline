from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from auth.dependencies import get_current_user
from core.logger import logger
from db.models import Conversation, Message, User
from db.session import get_db


router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
)


def _normalize_title(title: str | None,) -> str:
    if title is None:
        return "New chat"

    normalized = " ".join(title.split()).strip()

    if not normalized:
        return "New chat"

    return normalized[:255]


async def _get_owned_conversation(
    session: AsyncSession, conversation_id: int, user_id: int,
) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
    )

    if conversation is None:
        # 404 avoids revealing another user's conversation.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return conversation


@router.post(
    "",
    response_model=schemas.ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    request: schemas.ConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Conversation:
    conversation = Conversation(
        user_id=current_user.id,
        title=_normalize_title(
            request.title
        ),
    )

    session.add(conversation)

    try:
        await session.commit()
        await session.refresh(
            conversation
        )

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Failed creating conversation "
            f"user_id={current_user.id}: {exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation.",
        ) from exc

    return conversation


@router.get(
    "",
    response_model=list[
        schemas.ConversationResponse
    ],
)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    result = await session.scalars(
        select(Conversation)
        .where(
            Conversation.user_id
            == current_user.id
        )
        .order_by(
            Conversation.updated_at.desc(),
            Conversation.id.desc(),
        )
    )

    return list(
        result.all()
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=list[
        schemas.MessageResponse
    ],
)
async def list_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Message]:
    await _get_owned_conversation(
        session,
        conversation_id,
        current_user.id,
    )

    result = await session.scalars(
        select(Message)
        .where(
            Message.conversation_id
            == conversation_id
        )
        .order_by(
            Message.created_at.asc(),
            Message.id.asc(),
        )
    )

    return list(
        result.all()
    )


@router.patch(
    "/{conversation_id}",
    response_model=schemas.ConversationResponse,
)
async def update_conversation(
    conversation_id: int,
    request: schemas.ConversationUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Conversation:
    conversation = (
        await _get_owned_conversation(
            session,
            conversation_id,
            current_user.id,
        )
    )

    title = " ".join(
        request.title.split()
    ).strip()

    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation title cannot be empty.",
        )

    conversation.title = (
        title[:255]
    )

    try:
        await session.commit()
        await session.refresh(
            conversation
        )

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Conversation rename failed "
            f"conversation_id={conversation_id}: "
            f"{exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update conversation.",
        ) from exc

    return conversation


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    conversation = (
        await _get_owned_conversation(
            session,
            conversation_id,
            current_user.id,
        )
    )

    try:
        await session.delete(
            conversation
        )

        await session.commit()

    except Exception as exc:
        await session.rollback()

        logger.exception(
            f"Conversation deletion failed "
            f"conversation_id={conversation_id}: "
            f"{exc}"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation.",
        ) from exc

    return {
        "deleted_conversation_id": conversation_id,
    }