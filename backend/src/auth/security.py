from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from config import settings


JWT_ALGORITHM = "HS256"

password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    return password_hasher.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(user_id: int) -> str:
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY is not configured."
        )

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> int:
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY is not configured."
        )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[JWT_ALGORITHM],
        )

        subject = payload.get("sub")

        if subject is None:
            raise InvalidTokenError(
                "Missing token subject."
            )

        return int(subject)

    except (InvalidTokenError, ValueError) as exc:
        raise ValueError("Invalid access token.") from exc