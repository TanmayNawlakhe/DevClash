from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, status

from app.schemas.search import SearchRequest, SearchResponse
from app.services.search_service import semantic_search
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/repos", tags=["search"])


def _validate_repo_id(repo_id: str) -> ObjectId:
    try:
        return ObjectId(repo_id)
    except (InvalidId, Exception) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid repo id format",
        ) from exc


@router.post("/{repo_id}/search", response_model=SearchResponse)
async def search_repo(repo_id: str, request: SearchRequest) -> SearchResponse:
    """Semantic search over a repo's embeddings.

    Returns files and functions ordered as a dependency flow
    (entry points first, leaf nodes last).

    Example query: "Give me the flow of auth"
    """
    _validate_repo_id(repo_id)

    try:
        result = await semantic_search(
            repo_id=repo_id,
            query=request.query,
            top_files=request.top_files,
            top_functions=request.top_functions,
            min_score=request.min_score,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return SearchResponse(**result)
