
import asyncio
from typing import AsyncIterator

import httpx
import pytest
from groq import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    InternalServerError,
    RateLimitError,
)

from ai.providers.fallback import FallbackProvider


MESSAGES = [
    {"role": "system", "content": "Answer using the context."},
    {"role": "user", "content": "What is NeueBit?"},
]

REQUEST = httpx.Request(
    "POST",
    "https://api.groq.com/openai/v1/chat/completions",
)


class FakeProvider:
    """
    A configurable fake LLM provider.

    Each step is either:
    - a string to yield
    - an exception to raise

    Example:
        FakeProvider(["Hello", " world"])
        FakeProvider([APIConnectionError(request=REQUEST)])
        FakeProvider(["Partial", APIConnectionError(request=REQUEST)])
    """

    def __init__(self, steps: list[str | BaseException]):
        self.steps = steps
        self.calls = 0

    async def stream(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncIterator[str]:
        self.calls += 1

        for step in self.steps:
            if isinstance(step, BaseException):
                raise step

            yield step


async def collect(provider: FallbackProvider) -> list[str]:
    return [
        text
        async for text in provider.stream(MESSAGES)
    ]


# ---------------------------------------------------------
# 1. Primary succeeds -> fallback must not run
# ---------------------------------------------------------

def test_primary_success():
    primary = FakeProvider(["Hello", " world"])
    fallback = FakeProvider(["Fallback answer"])

    provider = FallbackProvider(primary, fallback)

    result = asyncio.run(collect(provider))

    assert result == ["Hello", " world"]
    assert primary.calls == 1
    assert fallback.calls == 0


# ---------------------------------------------------------
# 2. Connection error before output -> use fallback
# ---------------------------------------------------------

def test_connection_error_triggers_fallback():
    error = APIConnectionError(request=REQUEST)

    primary = FakeProvider([error])
    fallback = FakeProvider(["Gemini answer"])

    provider = FallbackProvider(primary, fallback)

    result = asyncio.run(collect(provider))

    assert result == ["Gemini answer"]
    assert primary.calls == 1
    assert fallback.calls == 1


# ---------------------------------------------------------
# 3. Rate limit (429) -> use fallback
# ---------------------------------------------------------

def test_rate_limit_triggers_fallback():
    response = httpx.Response(
        429,
        request=REQUEST,
    )

    error = RateLimitError(
        "Rate limit exceeded",
        response=response,
        body=None,
    )

    primary = FakeProvider([error])
    fallback = FakeProvider(["Gemini answer"])

    provider = FallbackProvider(primary, fallback)

    result = asyncio.run(collect(provider))

    assert result == ["Gemini answer"]
    assert fallback.calls == 1


# ---------------------------------------------------------
# 4. Timeout -> use fallback
# ---------------------------------------------------------

def test_timeout_triggers_fallback():
    error = APITimeoutError(request=REQUEST)

    primary = FakeProvider([error])
    fallback = FakeProvider(["Recovered"])

    provider = FallbackProvider(primary, fallback)

    result = asyncio.run(collect(provider))

    assert result == ["Recovered"]
    assert fallback.calls == 1


# ---------------------------------------------------------
# 5. Server error (5xx) -> use fallback
# ---------------------------------------------------------

def test_server_error_triggers_fallback():
    response = httpx.Response(
        503,
        request=REQUEST,
    )

    error = InternalServerError(
        "Service unavailable",
        response=response,
        body=None,
    )

    primary = FakeProvider([error])
    fallback = FakeProvider(["Backup response"])

    provider = FallbackProvider(primary, fallback)

    result = asyncio.run(collect(provider))

    assert result == ["Backup response"]
    assert fallback.calls == 1


# ---------------------------------------------------------
# 6. Primary fails AFTER emitting text -> no fallback
# ---------------------------------------------------------

def test_midstream_failure_does_not_fallback():
    error = APIConnectionError(request=REQUEST)

    primary = FakeProvider([
        "Partial answer",
        error,
    ])

    fallback = FakeProvider(["Gemini answer"])

    provider = FallbackProvider(primary, fallback)

    async def run():
        stream = provider.stream(MESSAGES)

        first_chunk = await anext(stream)
        assert first_chunk == "Partial answer"

        with pytest.raises(APIConnectionError):
            await anext(stream)

    asyncio.run(run())

    assert primary.calls == 1
    assert fallback.calls == 0


# ---------------------------------------------------------
# 7. Authentication failure (401) -> no fallback
# ---------------------------------------------------------

def test_authentication_error_does_not_fallback():
    response = httpx.Response(
        401,
        request=REQUEST,
    )

    error = AuthenticationError(
        "Invalid API key",
        response=response,
        body=None,
    )

    primary = FakeProvider([error])
    fallback = FakeProvider(["Should not run"])

    provider = FallbackProvider(primary, fallback)

    with pytest.raises(AuthenticationError):
        asyncio.run(collect(provider))

    assert fallback.calls == 0


# ---------------------------------------------------------
# 8. Both providers fail -> propagate fallback error
# ---------------------------------------------------------

def test_both_providers_fail():
    primary = FakeProvider([
        APIConnectionError(request=REQUEST),
    ])

    fallback = FakeProvider([
        RuntimeError("Gemini unavailable"),
    ])

    provider = FallbackProvider(primary, fallback)

    with pytest.raises(
        RuntimeError,
        match="Gemini unavailable",
    ):
        asyncio.run(collect(provider))

    assert primary.calls == 1
    assert fallback.calls == 1


# ---------------------------------------------------------
# 9. Cancellation -> do not activate fallback
# ---------------------------------------------------------

def test_cancellation_does_not_trigger_fallback():
    primary = FakeProvider([
        asyncio.CancelledError(),
    ])

    fallback = FakeProvider(["Should not run"])

    provider = FallbackProvider(primary, fallback)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(collect(provider))

    assert fallback.calls == 0


# ---------------------------------------------------------
# 10. Empty text chunks -> filter them out
# ---------------------------------------------------------

def test_empty_chunks_are_ignored():
    primary = FakeProvider([
        "",
        "Hello",
        "",
        " world",
    ])

    fallback = FakeProvider(["Should not run"])

    provider = FallbackProvider(primary, fallback)

    result = asyncio.run(collect(provider))

    assert result == ["Hello", " world"]
    assert fallback.calls == 0
