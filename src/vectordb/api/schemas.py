from pydantic import BaseModel, Field


class InsertRequest(BaseModel):
    """Payload for inserting a new chunk into the database."""

    category: str = Field(..., description="Category tag (e.g., 'documentation')")
    payload: str = Field(..., description="The actual text content of the chunk")
    id: str | None = Field(default=None, description="Optional ID")
    embedding: list[float] | None = Field(default=None, description="Optional embedding array")


class SearchRequest(BaseModel):
    """Payload for querying the database."""

    embedding: list[float] = Field(..., description="The query vector to search for")
    k: int = Field(default=5, ge=1, le=100, description="Number of results to return")


class SearchResultItem(BaseModel):
    """The formatted response returned to the user/LLM."""

    id: str
    distance: float
    metadata: str
    category: str


class IngestRequest(BaseModel):
    text: str = Field(
        ..., description="The raw document text to be ingested into the RAG pipeline."
    )
    category: str = Field(default="general", description="Optional category for the document.")


class AskRequest(BaseModel):
    question: str = Field(..., description="The user's plain-text question.")
    k: int = Field(default=5, ge=1, le=20, description="Number of context chunks to retrieve.")

class TextSearchRequest(BaseModel):
    text: str = Field(..., description="The query string to embed and search for")
    k: int = Field(default=5, ge=1, le=100, description="Number of results to return")

class TextSearchResponse(BaseModel):
    results: list[SearchResultItem]
    query_vector: list[float]

class VectorPoint2D(BaseModel):
    id: str
    x: float
    y: float
    category: str
    payload: str | None = None

class VectorSampleResponse(BaseModel):
    vectors: list[VectorPoint2D]
    count: int

class AlgorithmBenchmark(BaseModel):
    name: str
    displayName: str
    latencyMs: float
    throughputQps: float
    isActive: bool

class BenchmarkResponse(BaseModel):
    algorithms: list[AlgorithmBenchmark]
    timestamp: str
