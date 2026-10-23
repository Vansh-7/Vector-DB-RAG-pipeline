from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from api.limits import ingestion_limit
from auth.dependencies import get_current_user
from core.logger import logger
from db.models import User
from db.session import get_db
from services import documents as documents_service
from services.errors import DomainError
from services.validation import _normalize_category

router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FILE_EXTENSIONS = {".pdf", ".txt", ".md"}


@router.post(
    "/ingest",
    response_model=schemas.IngestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ingestion_limit)],
)
async def ingest_document(
    request: schemas.IngestRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.IngestResponse:
    try:
        result = await documents_service.ingest_document(
            request.text, request.category, request.title, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.IngestResponse(**result)


@router.post(
    "/ingest/file",
    response_model=schemas.IngestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ingestion_limit)],
)
async def ingest_file(
    category: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.IngestResponse:
    try:
        filename = Path(file.filename or "").name.strip()
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must have a filename.",
            )
        if len(filename) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is too long."
            )
        extension = Path(filename).suffix.lower()
        if extension not in ALLOWED_FILE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .pdf, .txt and .md files are supported.",
            )
        normalized_category = _normalize_category(category)
        try:
            content = await file.read(MAX_UPLOAD_BYTES + 1)
        except Exception as exc:
            logger.exception(f"Upload read failed user_id={current_user.id}: {exc}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to read uploaded file."
            ) from exc
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds the 10 MB upload limit.",
            )
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty."
            )
        result = await documents_service.ingest_file(
            content, filename, extension, normalized_category, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.IngestResponse(**result)
