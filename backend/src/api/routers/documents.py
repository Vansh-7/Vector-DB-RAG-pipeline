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
from db.models import Document, User
from db.session import get_db
from services import documents as documents_service
from services.errors import DomainError

router = APIRouter()


@router.get("/documents", response_model=list[schemas.DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
) -> list[Document]:
    """
    Returns only documents owned by the authenticated user.
    """
    try:
        result = await documents_service.list_documents(session, current_user.id)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Deletes one user-owned document and all of its vector chunks.

    We first mark the document 'deleting'. Retrieval only considers 'ready'
    documents, so even if deletion partially fails the document stops entering
    RAG context.
    """
    try:
        result = await documents_service.delete_document(document_id, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result
