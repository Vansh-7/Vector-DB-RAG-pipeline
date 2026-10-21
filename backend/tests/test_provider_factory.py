
from dataclasses import replace
from unittest.mock import Mock

import pytest

import ai.providers.factory as factory
from ai.providers.fallback import FallbackProvider
from config import load_settings


@pytest.fixture
def base_config(monkeypatch):
    """Produce a predictable configuration for each test."""
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", "none")

    return replace(
        load_settings(),
        groq_api_key="",
        gemini_api_key="",
    )


@pytest.fixture
def constructors(monkeypatch):
    """
    Mock provider constructors so tests never initialize
    real HTTP clients.
    """
    mocks = {
        "ollama": Mock(return_value=object()),
        "groq": Mock(return_value=object()),
        "gemini": Mock(return_value=object()),
    }

    monkeypatch.setattr(
        factory, "OllamaProvider", mocks["ollama"]
    )
    monkeypatch.setattr(
        factory, "GroqProvider", mocks["groq"]
    )
    monkeypatch.setattr(
        factory, "GeminiProvider", mocks["gemini"]
    )

    return mocks


def test_default_uses_ollama(base_config, constructors):
    provider = factory.build_llm_provider(base_config)

    assert provider is constructors["ollama"].return_value

    constructors["ollama"].assert_called_once_with(
        model_name=base_config.llm_model,
        host=base_config.ollama_host,
    )

    constructors["groq"].assert_not_called()
    constructors["gemini"].assert_not_called()


def test_groq_without_fallback(base_config, constructors):
    config = replace(
        base_config,
        llm_provider="groq",
        llm_fallback_provider="none",
        groq_api_key="fake-groq-key",
    )

    provider = factory.build_llm_provider(config)

    assert provider is constructors["groq"].return_value

    constructors["groq"].assert_called_once_with(
        model_name=config.groq_model,
        api_key="fake-groq-key",
    )

    constructors["ollama"].assert_not_called()
    constructors["gemini"].assert_not_called()


def test_groq_with_gemini_fallback(base_config, constructors):
    config = replace(
        base_config,
        llm_provider="groq",
        llm_fallback_provider="gemini",
        groq_api_key="fake-groq-key",
        gemini_api_key="fake-gemini-key",
    )

    provider = factory.build_llm_provider(config)

    assert isinstance(provider, FallbackProvider)
    assert provider.primary is constructors["groq"].return_value
    assert provider.fallback is constructors["gemini"].return_value

    constructors["groq"].assert_called_once_with(
        model_name=config.groq_model,
        api_key="fake-groq-key",
    )

    constructors["gemini"].assert_called_once_with(
        model_name=config.gemini_model,
        api_key="fake-gemini-key",
    )


def test_missing_groq_key(base_config, constructors):
    config = replace(
        base_config,
        llm_provider="groq",
        groq_api_key="",
    )

    with pytest.raises(ValueError, match="GROQ_API_KEY"):
        factory.build_llm_provider(config)

    constructors["groq"].assert_not_called()
    constructors["gemini"].assert_not_called()


def test_missing_gemini_key(base_config, constructors):
    config = replace(
        base_config,
        llm_provider="groq",
        llm_fallback_provider="gemini",
        groq_api_key="fake-groq-key",
        gemini_api_key="",
    )

    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        factory.build_llm_provider(config)

    # Credentials are checked before any client is built.
    constructors["groq"].assert_not_called()
    constructors["gemini"].assert_not_called()


def test_groq_only_does_not_require_gemini_key(
    base_config, constructors
):
    config = replace(
        base_config,
        llm_provider="groq",
        llm_fallback_provider="none",
        groq_api_key="fake-groq-key",
        gemini_api_key="",
    )

    provider = factory.build_llm_provider(config)

    assert provider is constructors["groq"].return_value
    constructors["gemini"].assert_not_called()


@pytest.mark.parametrize(
    "primary,fallback,error",
    [
        ("ollama", "gemini", "Ollama does not support"),
        ("groq", "unknown", "Groq supports only"),
        ("unknown", "none", "Unsupported LLM_PROVIDER"),
    ],
)
def test_invalid_provider_combinations(
    base_config,
    constructors,
    primary,
    fallback,
    error,
):
    config = replace(
        base_config,
        llm_provider=primary,
        llm_fallback_provider=fallback,
        groq_api_key="fake-groq-key",
        gemini_api_key="fake-gemini-key",
    )

    with pytest.raises(ValueError, match=error):
        factory.build_llm_provider(config)

    constructors["ollama"].assert_not_called()
    constructors["groq"].assert_not_called()
    constructors["gemini"].assert_not_called()
