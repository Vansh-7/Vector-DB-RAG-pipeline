from pydantic import BaseModel, ConfigDict, Field
from typing import List

class VectorItem(BaseModel):
    """
    Represents a single document or chunk stored in the Vector DB
    """
    id: int = Field(..., description="Unique identifier for the vector item")
    metadata: str = Field(..., description="Text content, title, or description of the chunk")
    category: str = Field(..., description="Category or tag (e.g., 'cs', 'math', 'doc')")
    embedding: list[float] = Field(..., description="The high-dimensional vector representation")
    
class SearchResult(BaseModel):
    """
    Represents a single matched item returned from a search query.
    """
    distance: float = Field(..., description="The calculated distance from the query vector (lower is usually better)")
    item: VectorItem = Field(..., description="The underlying vector item that matched")
    
    # Add this config to bypass hot-reloading memory mismatches
    model_config = ConfigDict(arbitrary_types_allowed=True)