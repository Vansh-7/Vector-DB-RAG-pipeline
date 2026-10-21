
from ai.providers.base import LLMProvider
from ai.providers.fallback import FallbackProvider
from ai.providers.gemini import GeminiProvider
from ai.providers.groq import GroqProvider
from ai.providers.ollama import OllamaProvider
from config import Settings


def build_llm_provider(config: Settings) -> LLMProvider:
    """
    Construct the configured LLM provider.

    Supported configurations:
        ollama + none
        groq   + none
        groq   + gemini

    Raises:
        ValueError: If the provider configuration is invalid
                    or a required API key is missing.
    """

    # --------------------------------------------------
    # 1. Local Ollama inference
    # --------------------------------------------------
    if config.llm_provider == "ollama":

        if config.llm_fallback_provider != "none":
            raise ValueError(
                "Ollama does not support an LLM fallback. "
                "Set LLM_FALLBACK_PROVIDER=none."
            )

        return OllamaProvider(
            model_name=config.llm_model,
            host=config.ollama_host,
        )

    # --------------------------------------------------
    # 2. Hosted Groq inference
    # --------------------------------------------------
    if config.llm_provider == "groq":

        # Validate the requested fallback configuration.
        if config.llm_fallback_provider not in {
            "none",
            "gemini",
        }:
            raise ValueError(
                "Groq supports only 'none' or 'gemini' "
                "as LLM_FALLBACK_PROVIDER."
            )

        # Validate required credentials before
        # constructing any provider clients.
        if not config.groq_api_key.strip():
            raise ValueError(
                "GROQ_API_KEY is required when "
                "LLM_PROVIDER=groq."
            )

        if (
            config.llm_fallback_provider == "gemini"
            and not config.gemini_api_key.strip()
        ):
            raise ValueError(
                "GEMINI_API_KEY is required when "
                "LLM_FALLBACK_PROVIDER=gemini."
            )

        # Construct primary provider.
        groq_llm = GroqProvider(
            model_name=config.groq_model,
            api_key=config.groq_api_key,
        )

        # Groq without fallback.
        if config.llm_fallback_provider == "none":
            return groq_llm

        # Groq with Gemini fallback.
        gemini_llm = GeminiProvider(
            model_name=config.gemini_model,
            api_key=config.gemini_api_key,
        )

        return FallbackProvider(
            primary=groq_llm,
            fallback=gemini_llm,
        )

    # --------------------------------------------------
    # 3. Unsupported primary provider
    # --------------------------------------------------
    raise ValueError(f"Unsupported LLM_PROVIDER: {config.llm_provider!r}.")
