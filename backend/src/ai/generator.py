from typing import AsyncGenerator, List
import json
from ollama import AsyncClient
from config import settings

class RagGenerator:
    """
    A LLM orchestrator.
    Handles strict prompt construction, hallucination prevention,
    and asynchronous streaming generation for a real-time user experience.
    """

    def __init__(self, model_name: str, ollama_host: str):
        self.model_name = model_name
        self._client = AsyncClient(host=ollama_host)

        # The System Prompt acts as a strict guardrail against hallucinations
        # with tone alignment + Chain of thought
        self._system_prompt = (
            "You are an expert, truthful AI assistant. "
            "Answer the user's question using only the retrieved context below. "
            "Maintain a professional and objective tone. "
            "Give the final answer directly and do not expose hidden reasoning "
            "or chain-of-thought. "
            "If the retrieved context does not contain enough information, say: "
            "'I do not have enough information to answer that.' "
            "Do not guess or invent facts.\n\n"
            "Context:\n"
            "{context}"
        )

    def _build_context(self, chunks: List[str]) -> str:
        """
        Safely formats and concatenates retrieved chunks into a context string.
        """
        if not chunks:
            return "No relevant context found."

        formatted_chunks = [f"Context Chunk {i + 1}:\n{chunk}" for i, chunk in enumerate(chunks)]
        return "\n\n".join(formatted_chunks)

    async def generate_stream(self, question: str, retrieved_chunks: List[str]) -> AsyncGenerator[str, None]:
        """
        Asynchronously generates and yields a response chunk-by-chunk using the local LLM.
        """
        # 1. Assemble the structured context
        context_string = self._build_context(retrieved_chunks)

        # 2. Inject context into the system guardrail
        system_message = self._system_prompt.format(context=context_string)

        try:
            # 3. Call the LLM asynchronously with stream=True
            response_stream = await self._client.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": question},
                ],
                stream=True,
            )

            # 4. Asynchronously iterate over the stream and yield tokens immediately
            async for chunk in response_stream:
                if "message" in chunk and "content" in chunk["message"]:
                    # Yield JSON line
                    yield json.dumps({"type": "token", "data": chunk["message"]["content"]}) + "\n"

        except Exception as e:
            # Safely yield the error so the stream doesn't abruptly crash the frontend
            yield json.dumps({"type": "error", "data": f"LLM generation failed: {e}"}) + "\n"


# Initialize a global instance for the API router to consume
llm_generator = RagGenerator(
    model_name=settings.llm_model,
    ollama_host=settings.ollama_host,
)
