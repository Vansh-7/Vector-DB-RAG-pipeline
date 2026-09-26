from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

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
    document_id: int | None = None


class IngestRequest(BaseModel):
    text: str = Field(
        ...,
        description="Raw document text to ingest.",
    )
    category: str = Field(
        default="general",
        description="Document category.",
    )
    title: str | None = Field(
        default=None,
        description="Optional display name for pasted text.",
    )


class AskRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The user's plain-text question.",
    )

    k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of context chunks to retrieve.",
    )

    conversation_id: int | None = Field(
        default=None,
        ge=1,
        description=(
            "Existing conversation to append to. "
            "Omit to create a new conversation."
        ),
    )

class ConversationCreateRequest(BaseModel):
    title: str | None = Field(
        default=None,
        max_length=255,
    )


class ConversationUpdateRequest(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    sources: list[dict[str, Any]] | None = None
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )
class TextSearchRequest(BaseModel):
    text: str = Field(..., description="The query string to embed and search for")
    k: int = Field(default=5, ge=1, le=100, description="Number of results to return")

class TextSearchResponse(BaseModel):
    results: list[SearchResultItem]
    query_vector: list[float]
    query_2d: list[float] | None = None

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

class HnswLayerStats(BaseModel):
    level: int
    nodes: int
    edges: int

class BenchmarkResponse(BaseModel):
    algorithms: list[AlgorithmBenchmark]
    timestamp: str
    topology: list[HnswLayerStats] | None = None
    
class DocumentResponse(BaseModel):
    id: int
    name: str
    category: str
    source_type: str
    status: str
    chunk_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class IngestResponse(BaseModel):
    document_id: int
    status: str
    chunk_count: int
    message: str
