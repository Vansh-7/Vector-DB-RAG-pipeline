import numpy as np
import os

from vectordb.core.types import SearchResult, VectorItem
from vectordb.core.indexes.base import BaseIndex
from vectordb.core.indexes.hnsw import HNSWIndex
from vectordb.core.indexes.bm25 import BM25Index
from vectordb.core.logger import logger

class HybridIndex(BaseIndex):
    """
    State-of-the-Art Hybrid Search Engine.
    Combines Dense Vectors (HNSW/Semantic) with Sparse Vectors (BM25/Keyword)
    using Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, dense_index: HNSWIndex, sparse_index: BM25Index, rrf_k: int = 60):
        self.dense = dense_index
        self.sparse = sparse_index
        self.rrf_k = rrf_k  # Smoothing constant for Reciprocal Rank Fusion (Standard is 60)

    def insert(self, item: VectorItem) -> None:
        """Inserts the item into BOTH underlying indexes."""
        self.dense.insert(item)
        self.sparse.insert(item)

    def search(self, query_vector: np.ndarray, query_text: str, k: int = 5) -> list[SearchResult]:
        """
        Executes parallel dense and sparse searches, then fuses results.
        Note: This API diverges slightly from BaseIndex as it requires both vector and text.
        """
        # 1. Get Top K candidates from both engines (Fetch more to ensure good overlap)
        fetch_k = max(k * 2, 20) 
        dense_results = self.dense.search(query_vector, k=fetch_k)
        sparse_results = self.sparse.search(query_text, k=fetch_k)

        # 2. Reciprocal Rank Fusion (RRF)
        # RRF Score = 1 / (rank + rrf_k)
        rrf_scores: dict[int, float] = {}
        items_map: dict[int, VectorItem] = {}

        # Process Dense Ranks
        for rank, res in enumerate(dense_results):
            doc_id = res.item.id
            items_map[doc_id] = res.item
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (rank + 1 + self.rrf_k))

        # Process Sparse Ranks
        for rank, res in enumerate(sparse_results):
            doc_id = res.item.id
            items_map[doc_id] = res.item
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (rank + 1 + self.rrf_k))

        # 3. Sort by highest combined RRF score
        fused = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        # 4. Format outputs. We invert the RRF score so it mimics a "distance" metric (lower is better)
        final_results = []
        for doc_id, rrf_score in fused[:k]:
            pseudo_distance = 1.0 / rrf_score  
            final_results.append(SearchResult(distance=pseudo_distance, item=items_map[doc_id]))

        return final_results

    def remove(self, item_id: int) -> bool:
        """Soft-deletes from both engines."""
        d_removed = self.dense.remove(item_id)
        s_removed = self.sparse.remove(item_id)
        return d_removed or s_removed

    def save(self, filepath: str) -> None:
        """Saves both indexes. Appends _dense and _sparse to the base filepath."""
        base, ext = os.path.splitext(filepath)
        self.dense.save(f"{base}_dense{ext}")
        self.sparse.save(f"{base}_sparse{ext}")

    def load(self, filepath: str) -> None:
        """Loads both indexes."""
        base, ext = os.path.splitext(filepath)
        self.dense.load(f"{base}_dense{ext}")
        self.sparse.load(f"{base}_sparse{ext}")