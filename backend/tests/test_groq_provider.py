
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from groq import APIConnectionError

import ai.providers.groq as groq_module


MESSAGES = [
    {
        "role": "system",
        "content": "Answer using the provided context.",
    },
    {
        "role": "user",
        "content": "What is NeueBit?",
    },
]

MODEL = "openai/gpt-oss-120b"

REQUEST = httpx.Request(
    "POST",
    "https://api.groq.com/openai/v1/chat/completions",
)


def make_chunk(text=None, *, has_choices=True):
    if not has_choices:
        return SimpleNamespace(choices=[])

    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                delta=SimpleNamespace(content=text)
            )
        ]
    )


async def fake_stream(*chunks):
    for chunk in chunks:
        yield chunk


async def collect(provider):
    return [
        text
        async for text in provider.stream(MESSAGES)
    ]


@pytest.fixture
def groq_harness(monkeypatch):
    """
    Replace the real Groq SDK client with a fake client.

    The create method is awaitable and returns an
    asynchronous iterator, matching the SDK contract.
    """
    create = AsyncMock()

    client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(
                create=create,
            )
        )
    )

    constructor = Mock(return_value=client)

    monkeypatch.setattr(
        groq_module,
        "AsyncGroq",
        constructor,
    )

    provider = groq_module.GroqProvider(
        model_name=MODEL,
        api_key="fake-groq-key",
    )

    return provider, create, constructor


def test_client_configuration(groq_harness):
    _, _, constructor = groq_harness

    constructor.assert_called_once_with(
        api_key="fake-groq-key",
        max_retries=0,
        timeout=60.0,
    )


def test_successful_streaming(groq_harness):
    provider, create, _ = groq_harness

    create.return_value = fake_stream(
        make_chunk("Hello"),
        make_chunk(" world"),
    )

    result = asyncio.run(collect(provider))

    assert result == ["Hello", " world"]

    create.assert_awaited_once_with(
        model=MODEL,
        messages=MESSAGES,
        stream=True,
    )


def test_empty_chunks_are_ignored(groq_harness):
    provider, create, _ = groq_harness

    create.return_value = fake_stream(
        make_chunk(None),
        make_chunk(""),
        make_chunk(has_choices=False),
        make_chunk("Hello"),
    )

    result = asyncio.run(collect(provider))

    assert result == ["Hello"]


def test_empty_stream(groq_harness):
    provider, create, _ = groq_harness

    create.return_value = fake_stream()

    result = asyncio.run(collect(provider))

    # Documents current behavior:
    # GroqProvider currently accepts an empty stream.
    assert result == []


def test_api_connection_failure_propagates(groq_harness):
    provider, create, _ = groq_harness

    create.side_effect = APIConnectionError(
        request=REQUEST,
    )

    with pytest.raises(APIConnectionError):
        asyncio.run(collect(provider))


def test_midstream_failure_propagates(groq_harness):
    provider, create, _ = groq_harness

    async def failing_stream():
        yield make_chunk("Partial answer")

        raise APIConnectionError(
            request=REQUEST,
        )

    create.return_value = failing_stream()

    async def run():
        stream = provider.stream(MESSAGES)

        first = await anext(stream)
        assert first == "Partial answer"

        with pytest.raises(APIConnectionError):
            await anext(stream)

    asyncio.run(run())


def test_request_uses_configured_model(groq_harness):
    provider, create, _ = groq_harness

    create.return_value = fake_stream(
        make_chunk("Answer"),
    )

    asyncio.run(collect(provider))

    assert create.await_args.kwargs["model"] == MODEL
    assert create.await_args.kwargs["stream"] is True
