from src.config import load_settings


def test_default_config(monkeypatch) -> None:
    env_vars = [
        "CORS_ORIGINS",
        "OLLAMA_HOST",
        "EMBEDDING_MODEL",
        "LLM_MODEL",
        "RERANKER_MODEL",
        "VECTOR_DB_FILE",
        "VECTOR_WAL_FILE",
    ]

    for env_var in env_vars:
        monkeypatch.delenv(env_var, raising=False)

    settings = load_settings()

    assert settings.ollama_host == "http://localhost:11434"
    assert settings.embedding_model == "nomic-embed-text"
    assert settings.llm_model == "qwen2.5:7b"
    assert settings.vector_db_file == "vector_database.pkl"
    assert settings.vector_wal_file == "vector_database.wal"


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