from typing import AsyncGenerator, List
from ollama import AsyncClient

class RagGenerator:
    """
    A LLM orchestrator.
    Handles strict prompt construction, hallucination prevention,
    and asynchronous streaming generation for a real-time user experience.
    """

    def __init__(self, model_name: str = "qwen2.5:7b"):
        self.model_name = model_name
        self._client = AsyncClient()

        # The System Prompt acts as a strict guardrail against hallucinations
        # with forced citations and tone alignment + Chain of thought
        self._system_prompt = (
            "You are an expert, truthful AI assistant. "
            "Use the following retrieved context to answer the user's question. "
            "When answering, you must cite the specific chunk you used by "
            "including its number in brackets (e.g., '[2]'). "
            "Maintain a professional and objective tone. "
            "If you cannot find the exact answer in the context, strictly say: "
            "'I do not have enough information to answer that.' Do not guess or invent facts.\n\n"
            "CRITICAL INSTRUCTION: Before providing your final answer, you MUST write out your "
            "step-by-step logical deduction inside <thinking>...</thinking> XML tags. "
            "Analyze dates, timelines, and relationships explicitly before concluding.\n\n"
            "Context:\n"
            "{context}"
        )

    def _build_context(self, chunks: List[str]) -> str:
        """
        Safely formats and concatenates retrieved chunks into a numbered context string.
        """
        if not chunks:
            return "No relevant context found."

        formatted_chunks = [f"[{i + 1}] {chunk}" for i, chunk in enumerate(chunks)]
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
                    # 'yield' spits out the word instantly without pausing the function
                    yield chunk["message"]["content"]

        except Exception as e:
            # Safely yield the error so the stream doesn't abruptly crash the frontend
            yield f"\n[Error: LLM generation failed: {e}]"


# Initialize a global instance for the API router to consume
llm_generator = RagGenerator()