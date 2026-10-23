from fastapi import (
    APIRouter,
    Depends,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from auth.dependencies import get_current_user
from db.models import User
from db.session import get_db
from services import rag as rag_service
from services.errors import DomainError

router = APIRouter()


@router.post("/ask")
async def ask_question(
    request: schemas.AskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    try:
        stream = await rag_service.ask_question(
            request.question, request.k, request.conversation_id, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return StreamingResponse(stream, media_type="application/x-ndjson")
