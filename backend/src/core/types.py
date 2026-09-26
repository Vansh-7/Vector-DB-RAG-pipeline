from pydantic import BaseModel, ConfigDict, Field

class VectorItem(BaseModel):
    """
    Represents a single document chunk stored in the Vector DB.
    """

    id: int = Field(..., description="Unique identifier for the vector item",)
    metadata: str = Field(..., description="Text content of the chunk",)
    category: str = Field(..., description="Category or tag",)
    embedding: list[float] = Field(..., description="High-dimensional vector representation",)
    user_id: int | None = Field(default=None, description="Owner of this vector chunk",)
    document_id: int | None = Field(default=None, description="PostgreSQL document record this chunk belongs to",)


class SearchResult(BaseModel):
    """
    Represents a single matched item returned from a search query.
    """

    distance: float = Field(..., description="The calculated distance from the query vector (lower is usually better)")
    item: VectorItem = Field(..., description="The underlying vector item that matched")

    # Add this config to bypass hot-reloading memory mismatches
    model_config = ConfigDict(arbitrary_types_allowed=True)