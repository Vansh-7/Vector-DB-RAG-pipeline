from pathlib import Path
import pytest

from config import load_settings


def test_default_config(monkeypatch) -> None:
    env_vars = [
        "CORS_ORIGINS",
        "OLLAMA_HOST",
        "EMBEDDING_MODEL",
        "LLM_MODEL",
        "RERANKER_MODEL",
        "VECTOR_DATA_DIR",
        "VECTOR_DB_FILE",
        "VECTOR_WAL_FILE",
        "OPERATOR_USER_IDS",
        "LLM_PROVIDER",
        "LLM_FALLBACK_PROVIDER",
        "GROQ_MODEL",
        "GEMINI_MODEL"
    ]

    for env_var in env_vars:
        monkeypatch.delenv(env_var, raising=False)

    settings = load_settings()

    assert settings.ollama_host == "http://localhost:11434"
    assert settings.embedding_model == "nomic-embed-text"
    assert settings.llm_model == "qwen2.5:7b"
    assert settings.vector_db_file == "vector_database.pkl"
    assert settings.vector_wal_file == "vector_database.wal"
    assert settings.operator_user_ids == frozenset()
    assert settings.llm_provider == "ollama"
    assert settings.llm_fallback_provider == "none"


def test_vector_data_directory(monkeypatch) -> None:
    monkeypatch.setenv("VECTOR_DATA_DIR", "/data")
    monkeypatch.delenv("VECTOR_DB_FILE", raising=False)
    monkeypatch.delenv("VECTOR_WAL_FILE", raising=False)

    settings = load_settings()

    assert settings.vector_data_dir == "/data"
    assert Path(settings.vector_db_file) == Path("/data") / "vector_database.pkl"
    assert Path(settings.vector_wal_file) == Path("/data") / "vector_database.wal"


def test_config_can_be_overridden(monkeypatch) -> None:
    monkeypatch.setenv("OLLAMA_HOST", "http://ollama:11434")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("VECTOR_DB_FILE", "/data/test.pkl")
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://nabla.example.com,https://admin.example.com",
    )

    settings = load_settings()

    assert settings.ollama_host == "http://ollama:11434"
    assert settings.llm_model == "test-model"
    assert settings.vector_db_file == "/data/test.pkl"
    assert settings.cors_origins == (
        "https://nabla.example.com",
        "https://admin.example.com",
    )


def test_operator_ids_must_be_positive_integers(monkeypatch) -> None:
    monkeypatch.setenv("OPERATOR_USER_IDS", "2, 7,2")
    assert load_settings().operator_user_ids == frozenset({2, 7})

    for invalid in ("0", "-1", "1,alice", "1.5"):
        monkeypatch.setenv("OPERATOR_USER_IDS", invalid)
        with pytest.raises(ValueError, match="OPERATOR_USER_IDS"):
            load_settings()


@pytest.mark.parametrize(
    "provider,fallback",
    [
        ("ollama", "none"),
        ("groq", "none"),
        ("groq", "gemini"),
    ],
)
def test_valid_provider_configuration(
    monkeypatch,
    provider,
    fallback,
):
    monkeypatch.setenv("LLM_PROVIDER", provider)
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", fallback)

    settings = load_settings()

    assert settings.llm_provider == provider
    assert settings.llm_fallback_provider == fallback


@pytest.mark.parametrize(
    "provider,fallback,error",
    [
        ("gemini", "none", "LLM_PROVIDER"),
        ("unknown", "none", "LLM_PROVIDER"),
        ("groq", "unknown", "LLM_FALLBACK_PROVIDER"),
        ("ollama", "gemini", "Gemini fallback requires"),
    ],
)
def test_invalid_provider_configuration(
    monkeypatch,
    provider,
    fallback,
    error,
):
    monkeypatch.setenv("LLM_PROVIDER", provider)
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", fallback)

    with pytest.raises(ValueError, match=error):
        load_settings()


def test_provider_names_are_normalized(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", " GROQ ")
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", " GEMINI ")

    settings = load_settings()

    assert settings.llm_provider == "groq"
    assert settings.llm_fallback_provider == "gemini"


def test_model_identifiers_preserve_case(monkeypatch):
    monkeypatch.setenv("GROQ_MODEL", "Custom/Groq-Model")
    monkeypatch.setenv("GEMINI_MODEL", "Custom/Gemini-Model")

    settings = load_settings()

    assert settings.groq_model == "Custom/Groq-Model"
    assert settings.gemini_model == "Custom/Gemini-Model"


def test_secrets_are_excluded_from_repr(monkeypatch):
    monkeypatch.setenv(
        "GROQ_API_KEY",
        "fake-super-secret-groq-key",
    )
    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "fake-super-secret-gemini-key",
    )
    monkeypatch.setenv(
        "JWT_SECRET_KEY",
        "fake-super-secret-jwt-key",
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:secret-password@localhost/db",
    )

    settings = load_settings()
    representation = repr(settings)

    assert "fake-super-secret-groq-key" not in representation
    assert "fake-super-secret-gemini-key" not in representation
    assert "fake-super-secret-jwt-key" not in representation
    assert "secret-password" not in representation
