from typing import AsyncIterator
from groq import AsyncGroq

class GroqProvider:
    def __init__(self, model_name: str, api_key: str):
        self.model_name = model_name
        self.client = AsyncGroq(
            api_key=api_key, 
            max_retries=0,
            timeout=60.0,
        )
        
    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            stream=True
        )
        
        async for chunk in response:
            if not chunk.choices:
                continue

            content = chunk.choices[0].delta.content

            if content:
                yield content

