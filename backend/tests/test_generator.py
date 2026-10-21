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