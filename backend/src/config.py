import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
)


def _get_cors_origins() -> tuple[str, ...]:
    raw_origins = os.getenv("CORS_ORIGINS")

    if not raw_origins:
        return DEFAULT_CORS_ORIGINS

    return tuple(
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    )


@dataclass(frozen=True)
class Settings:
    cors_origins: tuple[str, ...]
    ollama_host: str
    embedding_model: str
    llm_model: str
    reranker_model: str
    vector_data_dir: str
    vector_db_file: str
    vector_wal_file: str


def load_settings() -> Settings:
    vector_data_dir = os.getenv("VECTOR_DATA_DIR", ".")
    data_dir = Path(vector_data_dir)

    return Settings(
        cors_origins=_get_cors_origins(),
        ollama_host=os.getenv(
            "OLLAMA_HOST",
            "http://localhost:11434",
        ),
        embedding_model=os.getenv(
            "EMBEDDING_MODEL",
            "nomic-embed-text",
        ),
        llm_model=os.getenv(
            "LLM_MODEL",
            "qwen2.5:7b",
        ),
        reranker_model=os.getenv(
            "RERANKER_MODEL",
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
        ),
        vector_data_dir=vector_data_dir,
        vector_db_file=os.getenv(
            "VECTOR_DB_FILE",
            str(data_dir / "vector_database.pkl"),
        ),
        vector_wal_file=os.getenv(
            "VECTOR_WAL_FILE",
            str(data_dir / "vector_database.wal"),
        ),
    )


settings = load_settings()