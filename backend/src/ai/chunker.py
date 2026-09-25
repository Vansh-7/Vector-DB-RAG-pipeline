from typing import List

import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter


class TokenAwareTextSplitter:
    """
    It hierarchically divides text to respect strict LLM token limits
    while preserving the semantic structure of the content.
    """

    def __init__(
        self,
        max_tokens_per_chunk: int = 250,
        token_overlap: int = 50,
        encoding_model: str = "cl100k_base",
    ):
        # Initialize the tokenizer encoding
        self._encoding = tiktoken.get_encoding(encoding_model)

        # Private method to accurately count tokens
        def _calculate_token_length(text: str) -> int:
            return len(self._encoding.encode(text))

        # The core recursive splitting engine
        self._splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "\n", ". ", " ", ""],
            chunk_size=max_tokens_per_chunk,
            chunk_overlap=token_overlap,
            length_function=_calculate_token_length,
        )

    def split_text(self, document_content: str) -> List[str]:
        """
        Recursively processes a raw document string into a list of token-aware,
        overlapping text chunks.
        """
        return self._splitter.split_text(document_content)


# Initialize a global instance for the API router to consume
chunker = TokenAwareTextSplitter()