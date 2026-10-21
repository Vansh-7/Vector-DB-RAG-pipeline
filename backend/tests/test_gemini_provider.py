
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from google.genai import types

import ai.providers.gemini as gemini_module


MODEL = "gemini-2.5-flash-lite"

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


def make_chunk(text=None, finish_reason=None, *, candidates=True):
    return SimpleNamespace(
        text=text,
        candidates=(
            [
                SimpleNamespace(
                    finish_reason=finish_reason,
                )
            ]
            if candidates
            else []
        ),
    )


async def fake_stream(*chunks):
    for chunk in chunks:
        yield chunk


async def collect(provider, messages=None):
    if messages is None:
        messages = MESSAGES

    return [
        text
        async for text in provider.stream(messages)
    ]


@pytest.fixture
def gemini_harness(monkeypatch):
    """
    Replace genai.Client with a fake client.

    generate_content_stream is awaitable and returns
    an asynchronous stream.
    """
    generate = AsyncMock()

    client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(
                generate_content_stream=generate,
            )
        )
    )

    constructor = Mock(return_value=client)

    monkeypatch.setattr(
        gemini_module.genai,
        "Client",
        constructor,
    )

    provider = gemini_module.GeminiProvider(
        model_name=MODEL,
        api_key="fake-gemini-key",
    )

    return provider, generate, constructor


def test_client_configuration(gemini_harness):
    _, _, constructor = gemini_harness

    constructor.assert_called_once()

    kwargs = constructor.call_args.kwargs

    assert kwargs["api_key"] == "fake-gemini-key"
    assert kwargs["http_options"].timeout == 60_000


def test_successful_streaming(gemini_harness):
    provider, generate, _ = gemini_harness

    generate.return_value = fake_stream(
        make_chunk("Hello"),
        make_chunk(" world"),
        make_chunk(
            None,
            types.FinishReason.STOP,
        ),
    )

    result = asyncio.run(collect(provider))

    assert result == ["Hello", " world"]

    generate.assert_awaited_once()

    kwargs = generate.await_args.kwargs

    assert kwargs["model"] == MODEL
    assert kwargs["contents"] == MESSAGES[1]["content"]

    config = kwargs["config"]

    assert (
        config.system_instruction
        == MESSAGES[0]["content"]
    )
    assert config.max_output_tokens == 1024


def test_empty_chunks_are_ignored(gemini_harness):
    provider, generate, _ = gemini_harness

    generate.return_value = fake_stream(
        make_chunk(None),
        make_chunk(""),
        make_chunk("Hello", candidates=False),
        make_chunk(
            None,
            types.FinishReason.STOP,
        ),
    )

    result = asyncio.run(collect(provider))

    assert result == ["Hello"]


@pytest.mark.parametrize(
    "messages",
    [
        [],
        [
            {"role": "user", "content": "Hello"},
        ],
        [
            {"role": "user", "content": "Question"},
            {"role": "system", "content": "Instructions"},
        ],
        [
            {"role": "system", "content": "Instructions"},
            {"role": "assistant", "content": "Answer"},
        ],
    ],
)
def test_invalid_message_structure(
    gemini_harness,
    messages,
):
    provider, generate, _ = gemini_harness

    with pytest.raises(
        ValueError,
        match="expects a system message",
    ):
        asyncio.run(collect(provider, messages))

    generate.assert_not_awaited()


@pytest.mark.parametrize(
    "messages",
    [
        [
            {"role": "system", "content": ""},
            {"role": "user", "content": "Question"},
        ],
        [
            {"role": "system", "content": "Instructions"},
            {"role": "user", "content": "   "},
        ],
        [
            {"role": "system", "content": None},
            {"role": "user", "content": "Question"},
        ],
    ],
)
def test_empty_or_invalid_content(
    gemini_harness,
    messages,
):
    provider, generate, _ = gemini_harness

    with pytest.raises(
        ValueError,
        match="non-empty text messages",
    ):
        asyncio.run(collect(provider, messages))

    generate.assert_not_awaited()


@pytest.mark.parametrize(
    "finish_reason",
    [
        types.FinishReason.MAX_TOKENS,
        types.FinishReason.SAFETY,
        types.FinishReason.RECITATION,
    ],
)
def test_abnormal_completion_raises(
    gemini_harness,
    finish_reason,
):
    provider, generate, _ = gemini_harness

    generate.return_value = fake_stream(
        make_chunk("Partial response"),
        make_chunk(None, finish_reason),
    )

    with pytest.raises(
        RuntimeError,
        match="did not complete normally",
    ):
        asyncio.run(collect(provider))


def test_missing_finish_reason_raises(gemini_harness):
    provider, generate, _ = gemini_harness

    generate.return_value = fake_stream(
        make_chunk("Hello"),
        make_chunk(" world"),
    )

    with pytest.raises(
        RuntimeError,
        match="did not complete normally",
    ):
        asyncio.run(collect(provider))


def test_partial_text_then_max_tokens_raises(
    gemini_harness,
):
    provider, generate, _ = gemini_harness

    generate.return_value = fake_stream(
        make_chunk("Partial answer"),
        make_chunk(
            None,
            types.FinishReason.MAX_TOKENS,
        ),
    )

    async def run():
        stream = provider.stream(MESSAGES)

        first = await anext(stream)
        assert first == "Partial answer"

        with pytest.raises(
            RuntimeError,
            match="did not complete normally",
        ):
            await anext(stream)

    asyncio.run(run())


def test_sdk_error_propagates(gemini_harness):
    provider, generate, _ = gemini_harness

    generate.side_effect = RuntimeError(
        "Simulated Gemini failure"
    )

    with pytest.raises(
        RuntimeError,
        match="Simulated Gemini failure",
    ):
        asyncio.run(collect(provider))
