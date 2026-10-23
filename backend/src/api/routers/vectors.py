from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from api.limits import vector_insert_limit
from auth.dependencies import get_current_user
from db.models import User
from db.session import get_db
from services import vectors as vectors_service
from services.errors import DomainError

router = APIRouter()


@router.post(
    "/insert", status_code=status.HTTP_201_CREATED, dependencies=[Depends(vector_insert_limit)]
)
async def insert_vector(
    request: schemas.InsertRequest, current_user: User = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Inserts a raw vector owned by the authenticated user.

    This endpoint remains useful for demonstrating the custom Vector DB API,
    although normal RAG documents should use /ingest or /ingest/file.
    """
    try:
        result = await vectors_service.insert_vector(
            request.payload, request.category, request.embedding, request.id, current_user.id
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.delete("/vectors/all", status_code=status.HTTP_200_OK)
async def clear_user_data(
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """
    Clears vectors and document metadata belonging only to the current user.

    It MUST NOT rebuild the global index or clear the global WAL because those
    contain data for other tenants.
    """
    try:
        result = await vectors_service.clear_user_data(current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.delete("/vectors/{item_id}", status_code=status.HTTP_200_OK)
async def delete_vector(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Deletes one vector only when it belongs to the authenticated user.
    """
    try:
        result = await vectors_service.delete_vector(item_id, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result
