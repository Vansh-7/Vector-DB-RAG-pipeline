from fastapi import HTTPException

from services.errors import DomainError

_STATUS_CODES = {
    "invalid": 400,
    "unauthorized": 401,
    "forbidden": 403,
    "not_found": 404,
    "conflict": 409,
    "too_large": 413,
    "internal": 500,
    "unavailable": 503,
}


def to_http_error(error: DomainError) -> HTTPException:
    return HTTPException(status_code=_STATUS_CODES[error.kind], detail=error.message)
