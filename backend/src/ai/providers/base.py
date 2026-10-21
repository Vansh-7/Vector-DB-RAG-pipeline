from typing import AsyncIterator, Protocol

class LLMProvider(Protocol):
    """
    Common interface for all LLM providers.

    Each provider (Ollama, Gemini, etc.) must implement
    stream() and asynchronously yield plain-text chunks.
    """
    
    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """
        Stream generated text chunks from an LLM.

        Args:
            messages: Conversation messages containing
                      roles (system/user) and content.

        Yields:
            Plain-text chunks of the generated response.
        """
        ...