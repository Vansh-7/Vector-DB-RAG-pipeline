from typing import AsyncIterator
from google import genai
from google.genai import types

class GeminiProvider:
    def __init__(self, model_name: str, api_key: str):
        self.model_name = model_name
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=60_000,),
        )
        
    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        if (len(messages) != 2
        or messages[0].get("role") != "system"
        or messages[1].get("role") != "user"):
            raise ValueError("GeminiProvider expects a system message followed by a user message.")
        
        system_prompt = messages[0].get("content", "")
        user_prompt   = messages[1].get("content", "")
        
        if (not isinstance(system_prompt, str)
            or not system_prompt.strip()
            or not isinstance(user_prompt, str)
            or not user_prompt.strip()):
            raise ValueError("GeminiProvider requires non-empty text messages.")
        
        response = await self.client.aio.models.generate_content_stream(
            model=self.model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=1024,
            )
        )
        
        finish_reason: types.FinishReason | None = None

        async for chunk in response:
            # Check whether Gemini reported a termination reason.
            if chunk.candidates:
                candidate = chunk.candidates[0]

                if candidate.finish_reason is not None:
                    finish_reason = candidate.finish_reason

            # Preserve the existing streaming behavior.
            if chunk.text:
                yield chunk.text

        # The stream has now ended.
        if finish_reason != types.FinishReason.STOP:
            raise RuntimeError(
                f"Gemini generation did not complete normally: {finish_reason}"
            )