from typing import AsyncIterator
from ollama import AsyncClient

class OllamaProvider:
    def __init__(self, model_name: str, host: str):
        self.model_name = model_name
        self.client = AsyncClient(host=host)
        
    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        # 1. Call the LLM asynchronously with stream=True
        response_stream = await self.client.chat(
            model=self.model_name,
            messages=messages,
            stream=True,
        )

        # 2. Asynchronously iterate over the stream and yield 
        async for chunk in response_stream:
            content = chunk.message.content

            if content:
                yield content