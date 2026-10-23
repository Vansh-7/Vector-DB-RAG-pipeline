from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.ext.asyncio import AsyncSession

from api import schemas
from api.errors import to_http_error
from auth.dependencies import get_current_user
from core.types import SearchResult
from db.models import User
from db.session import get_db
from services import search as search_service
from services.errors import DomainError

router = APIRouter()


def _to_search_result_item(result: SearchResult) -> schemas.SearchResultItem:
    return schemas.SearchResultItem(
        id=str(result.item.id),
        distance=float(result.distance),
        metadata=result.item.metadata,
        category=result.item.category,
        document_id=getattr(result.item, "document_id", None),
    )


@router.post("/search", response_model=list[schemas.SearchResultItem])
async def search_vectors(
    request: schemas.SearchRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[schemas.SearchResultItem]:
    try:
        results = await search_service.search_vectors(
            request.embedding, request.k, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return [_to_search_result_item(result) for result in results]


@router.post("/search/text", response_model=schemas.TextSearchResponse)
async def search_vectors_by_text(
    request: schemas.TextSearchRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> schemas.TextSearchResponse:
    try:
        result = await search_service.search_vectors_by_text(
            request.text, request.k, current_user.id, session
        )
    except DomainError as exc:
        raise to_http_error(exc) from exc
    return schemas.TextSearchResponse(
        results=[_to_search_result_item(row) for row in result["results"]],
        query_vector=result["query_vector"],
        query_2d=result["query_2d"],
    )
