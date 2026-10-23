from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from auth.dependencies import get_current_user
from db.models import Conversation, Message, User
from db.session import get_db
from services import conversations as conversation_service
from services.errors import DomainError

router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
)


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
    try:
        result = await conversation_service.create_conversation(
            request.title, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.get(
    "",
    response_model=list[schemas.ConversationResponse],
)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Conversation]:
    try:
        result = await conversation_service.list_conversations(current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.get(
    "/{conversation_id}/messages",
    response_model=list[schemas.MessageResponse],
)
async def list_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[Message]:
    try:
        result = await conversation_service.list_messages(conversation_id, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


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
    try:
        result = await conversation_service.update_conversation(
            conversation_id, request.title, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        result = await conversation_service.delete_conversation(
            conversation_id, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result
