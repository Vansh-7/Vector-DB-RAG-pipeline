from sentence_transformers import CrossEncoder
from typing import List, Tuple

class AdvancedReRanker:
    """
    A Cross-Encoder that scores the logical relevance 
    between a query and retrieved chunks.
    """
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        # This will download a tiny, highly accurate model on first run
        self.encoder = CrossEncoder(model_name)

    def rerank(self, query: str, chunks: List[str], top_n: int = 3) -> List[str]:
        """
        Takes a broad list of chunks, scores them against the query, 
        and returns only the most logically relevant ones.
        """
        if not chunks:
            return []

        # Create pairs of [Question, Chunk]
        pairs = [[query, chunk] for chunk in chunks]
        
        # The model scores how well the chunk answers the question
        scores = self.encoder.predict(pairs)
        
        # Combine chunks with their scores and sort them highest to lowest
        scored_chunks = list(zip(scores, chunks))
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        
        # Return only the top_n most relevant chunks text
        return [chunk for score, chunk in scored_chunks[:top_n]]

# Global instance
cross_encoder = AdvancedReRanker()