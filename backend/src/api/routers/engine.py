from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    status,
)

from api.errors import to_http_error
from api.limits import operator_limit
from auth.dependencies import get_operator_user, get_optional_user
from db.models import User
from services import engine as engine_service
from services.errors import DomainError

router = APIRouter()

# The snapshot operation precedes search in the original V1 registry.
snapshot_router = APIRouter()


@snapshot_router.post(
    "/save", status_code=status.HTTP_200_OK, dependencies=[Depends(operator_limit)]
)
async def save_database(current_user: User = Depends(get_operator_user)) -> dict[str, str]:
    """
    Creates a global vector snapshot.

    Only configured operators may snapshot the shared index.
    """
    try:
        result = await engine_service.save_database(current_user.id)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.get("/status")
async def get_db_status(current_user: User | None = Depends(get_optional_user)) -> dict[str, Any]:
    """
    Public liveness for Docker healthchecks.

    Authenticated callers also receive engine, metric and their own active vector count.
    """
    return await engine_service.get_db_status(current_user.id if current_user is not None else None)


@router.post("/engine/configure", dependencies=[Depends(operator_limit)])
async def configure_engine(
    algorithm: str, metric: str, current_user: User = Depends(get_operator_user)
) -> dict[str, Any]:
    """
    Reconfigures the shared vector engine.

    Only configured operators may rebuild the shared index.
    """
    try:
        result = await engine_service.configure_engine(algorithm, metric, current_user.id)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result
