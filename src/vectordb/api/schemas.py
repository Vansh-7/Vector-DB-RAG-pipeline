from pydantic import BaseModel, Field

class InsertRequest(BaseModel):
    """Payload for inserting a new chunk into the database."""
    id: int = Field(..., description="Unique ID for the document chunk")
    metadata: str = Field(..., description="The actual text content of the chunk")
    category: str = Field(..., description="Category tag (e.g., 'documentation')")
    embedding: list[float] = Field(..., description="The high-dimensional vector array")

class SearchRequest(BaseModel):
    """Payload for querying the database."""
    embedding: list[float] = Field(..., description="The query vector to search for")
    k: int = Field(default=5, ge=1, le=100, description="Number of results to return")

class SearchResultItem(BaseModel):
    """The formatted response returned to the user/LLM."""
    id: int
    distance: float
    metadata: str
    category: str