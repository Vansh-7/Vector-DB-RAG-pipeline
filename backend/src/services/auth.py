from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import create_access_token, hash_password, verify_password
from db.models import User
from services.errors import DomainError


async def register(email: str, password: str, session: AsyncSession) -> User:
    email = email.lower().strip()
    existing_user = await session.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise DomainError(kind="conflict", message="Email is already registered.")
    user = User(email=email, password_hash=hash_password(password))
    session.add(user)
    try:
        await session.commit()
        await session.refresh(user)
    except IntegrityError:
        await session.rollback()
        raise DomainError(kind="conflict", message="Email is already registered.")
    return user


async def login(email: str, password: str, session: AsyncSession) -> str:
    email = email.lower().strip()
    user = await session.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise DomainError(kind="unauthorized", message="Invalid email or password.")
    if not user.is_active:
        raise DomainError(kind="forbidden", message="User account is disabled.")
    return create_access_token(user.id)
