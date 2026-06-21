import asyncio
from typing import List

from ollama import AsyncClient


class Embedder:
    """
    An asynchronous, production-ready service to handle vector embeddings using Ollama.
    """

    def __init__(self, model_name: str = "nomic-embed-text"):
        self.model_name = model_name
        self.client = AsyncClient()

    async def embed_text(self, text: str) -> List[float]:
        """
        Converts a single string of text into a high-dimensional vector asynchronously.
        """
        try:
            # We now 'await' the response so the server isn't blocked
            response = await self.client.embeddings(model=self.model_name, prompt=text)
            return [float(x) for x in response["embedding"]]
        except Exception as e:
            raise RuntimeError(f"Failed to connect to Ollama embedding model: {e}")

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        True concurrent batch processing for rapid document ingestion.
        """
        # Create a list of async tasks
        tasks = [self.embed_text(text) for text in texts]

        # asyncio.gather executes all tasks concurrently rather than one by one
        return await asyncio.gather(*tasks)


# Initialize a global instance to be used across the app routes
embedder = Embedder()