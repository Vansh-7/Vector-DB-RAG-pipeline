import asyncio
import json
from typing import AsyncIterator

from ai.generator import RagGenerator


class FakeProvider:
    async def stream(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncIterator[str]:
        yield "Hello"
        yield " world"


def test_generator_streams_ndjson():
    generator = RagGenerator(provider=FakeProvider())

    async def collect():
        return [
            chunk
            async for chunk in generator.generate_stream(
                "What is NeueBit?",
                ["NeueBit is a custom vector search platform."],
            )
        ]

    chunks = asyncio.run(collect())

    events = [json.loads(chunk) for chunk in chunks]

    assert events == [
        {"type": "token", "data": "Hello"},
        {"type": "token", "data": " world"},
    ]

    assert all(chunk.endswith("\n") for chunk in chunks)
    
    
class FailingProvider:
    async def stream(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncIterator[str]:

        yield "Partial answer"

        raise RuntimeError("Sensitive upstream error details")
    
def test_generator_handles_provider_failure():
    generator = RagGenerator(provider=FailingProvider())

    async def collect():
        return [
            chunk
            async for chunk in generator.generate_stream(
                "What is NeueBit?",
                ["NeueBit uses a custom vector database."],
            )
        ]

    chunks = asyncio.run(collect())

    events = [json.loads(chunk) for chunk in chunks]

    assert events == [
        {
            "type": "token",
            "data": "Partial answer",
        },
        {
            "type": "error",
            "data": "LLM generation failed.",
        },
    ]

    assert all(chunk.endswith("\n") for chunk in chunks)

    assert "Sensitive upstream error details" not in "".join(chunks)