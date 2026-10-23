from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.errors import to_http_error
from auth.dependencies import get_current_user, is_operator
from auth.schemas import (
    CurrentUserResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from db.models import User
from db.session import get_db
from services import auth as auth_service
from services.errors import DomainError

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> User:
    try:
        result = await auth_service.register(request.email, request.password, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return result


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        token = await auth_service.login(request.email, request.password, session)
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return TokenResponse(access_token=token)


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        is_operator=is_operator(current_user),
    )
