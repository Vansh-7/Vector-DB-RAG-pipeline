from typing import List
from sentence_transformers import CrossEncoder

class AdvancedReRanker:
    """
    A Cross-Encoder that scores the logical relevance
    between a query and retrieved chunks.
    """

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        # This will download a tiny, highly accurate model on first run
        self.encoder = CrossEncoder(model_name)

    def rerank(self, query: str, results: list, top_n: int = 3) -> list:
        """
        Takes a broad list of SearchResult items, scores them against the query,
        and returns a list of tuples containing (score, SearchResult).
        """
        if not results:
            return []

        # Create pairs of [Question, Chunk]
        pairs = [[query, res.item.metadata] for res in results]

        # The model scores how well the chunk answers the question
        scores = self.encoder.predict(pairs)

        # Combine items with their scores and sort them highest to lowest
        scored_chunks = list(zip(scores, results))
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        # Return the top_n most relevant tuples
        return scored_chunks[:top_n]


# Global instance
cross_encoder = AdvancedReRanker()