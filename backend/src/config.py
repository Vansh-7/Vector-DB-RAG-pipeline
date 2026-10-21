
import os
from dataclasses import dataclass, field
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


def _get_operator_user_ids() -> frozenset[int]:
    raw_ids = os.getenv("OPERATOR_USER_IDS", "")
    ids: set[int] = set()

    for value in raw_ids.split(","):
        value = value.strip()

        if not value:
            continue

        if (
            not value.isascii()
            or not value.isdecimal()
            or int(value) < 1
        ):
            raise ValueError(
                "OPERATOR_USER_IDS must contain "
                "positive integer user IDs."
            )

        ids.add(int(value))

    return frozenset(ids)


def _get_llm_provider_selection() -> tuple[str, str]:
    """
    Read and validate the configured LLM provider combination.

    Supported configurations:
        ollama + none
        groq   + none
        groq   + gemini
    """

    provider = os.getenv(
        "LLM_PROVIDER",
        "ollama",
    ).strip().lower()

    fallback = os.getenv(
        "LLM_FALLBACK_PROVIDER",
        "none",
    ).strip().lower()

    if provider not in {"ollama", "groq"}:
        raise ValueError(
            "LLM_PROVIDER must be 'ollama' or 'groq'."
        )

    if fallback not in {"none", "gemini"}:
        raise ValueError(
            "LLM_FALLBACK_PROVIDER must be "
            "'none' or 'gemini'."
        )

    if provider != "groq" and fallback == "gemini":
        raise ValueError(
            "Gemini fallback requires "
            "LLM_PROVIDER='groq'."
        )

    return provider, fallback


@dataclass(frozen=True)
class Settings:
    # CORS
    cors_origins: tuple[str, ...]

    # Ollama / embedding / reranking
    ollama_host: str
    embedding_model: str
    llm_model: str
    reranker_model: str

    # LLM provider configuration
    llm_provider: str
    llm_fallback_provider: str
    groq_model: str
    gemini_model: str

    # Hosted provider credentials
    groq_api_key: str = field(repr=False)
    gemini_api_key: str = field(repr=False)

    # Vector DB persistence
    vector_data_dir: str
    vector_db_file: str
    vector_wal_file: str

    # PostgreSQL
    database_url: str = field(repr=False)

    # Authentication
    jwt_secret_key: str = field(repr=False)
    jwt_access_token_expire_minutes: int

    # Vector engine operator access
    operator_user_ids: frozenset[int]


def load_settings() -> Settings:
    """
    Load application configuration from environment variables.

    Environment values are read at application startup.
    Provider compatibility is validated here.

    Provider-specific API key validation is handled
    later by the provider factory.
    """

    vector_data_dir = os.getenv(
        "VECTOR_DATA_DIR",
        ".",
    )

    data_dir = Path(vector_data_dir)

    llm_provider, llm_fallback_provider = (
        _get_llm_provider_selection()
    )

    return Settings(
        # CORS
        cors_origins=_get_cors_origins(),

        # Ollama connection
        ollama_host=os.getenv(
            "OLLAMA_HOST",
            "http://localhost:11434",
        ),

        # Embedding model
        embedding_model=os.getenv(
            "EMBEDDING_MODEL",
            "nomic-embed-text",
        ),

        # Local Ollama LLM
        llm_model=os.getenv(
            "LLM_MODEL",
            "qwen2.5:7b",
        ),

        # Reranking model
        reranker_model=os.getenv(
            "RERANKER_MODEL",
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
        ),

        # LLM provider selection
        llm_provider=llm_provider,
        llm_fallback_provider=llm_fallback_provider,

        # Hosted LLM model IDs
        groq_model=os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
        ).strip(),

        gemini_model=os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash-lite",
        ).strip(),

        # Hosted provider API credentials
        groq_api_key=os.getenv(
            "GROQ_API_KEY",
            "",
        ).strip(),

        gemini_api_key=os.getenv(
            "GEMINI_API_KEY",
            "",
        ).strip(),

        # Vector database persistence
        vector_data_dir=vector_data_dir,

        vector_db_file=os.getenv(
            "VECTOR_DB_FILE",
            str(data_dir / "vector_database.pkl"),
        ),

        vector_wal_file=os.getenv(
            "VECTOR_WAL_FILE",
            str(data_dir / "vector_database.wal"),
        ),

        # PostgreSQL
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://"
            "nabla:nabla_dev@localhost:5432/nabla",
        ),

        # Authentication
        jwt_secret_key=os.getenv(
            "JWT_SECRET_KEY",
            "",
        ),

        jwt_access_token_expire_minutes=int(
            os.getenv(
                "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
                "60",
            )
        ),

        # Vector engine operator permissions
        operator_user_ids=_get_operator_user_ids(),
    )


# Application-wide startup configuration
settings = load_settings()
