from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from auth.dependencies import get_current_user
from db.models import User
from db.session import get_db
from services import visualization as visualization_service
from services.errors import DomainError

router = APIRouter()


@router.get("/vectors/sample", response_model=schemas.VectorSampleResponse)
async def get_vectors_sample(
    n: int = 2000,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.VectorSampleResponse:
    try:
        result = await visualization_service.get_vectors_sample(n, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.VectorSampleResponse(**result)
