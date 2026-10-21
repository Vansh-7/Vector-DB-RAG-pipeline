from typing import AsyncIterator

from groq import (
    APIConnectionError,
    InternalServerError,
    RateLimitError,
)

from ai.providers.base import LLMProvider


RETRYABLE_ERRORS = (
    RateLimitError,
    APIConnectionError,
    InternalServerError,
)


class FallbackProvider:
    def __init__(self, primary: LLMProvider, fallback: LLMProvider):
        self.primary = primary
        self.fallback = fallback

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        emitted_text = False

        # Try iterating over the primary stream.
        try:
            async for text in self.primary.stream(messages):
                if text:
                    emitted_text = True
                    yield text
            return
        except RETRYABLE_ERRORS:
            if emitted_text:
                raise

        # Otherwise, stream from the fallback provider
        async for text in self.fallback.stream(messages):
            if text:
                yield text