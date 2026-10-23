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
from services import benchmarks as benchmarks_service
from services.errors import DomainError

router = APIRouter()


@router.get("/benchmark", response_model=schemas.BenchmarkResponse)
async def get_benchmarks(
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.BenchmarkResponse:
    try:
        result = await benchmarks_service.get_benchmarks(q, current_user.id, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.BenchmarkResponse(**result)
