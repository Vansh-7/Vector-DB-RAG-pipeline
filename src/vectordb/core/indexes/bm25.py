import math
import re
import pickle
import os
from collections import Counter

from vectordb.core.types import SearchResult, VectorItem
from vectordb.core.indexes.base import BaseIndex
from vectordb.core.logger import logger

class BM25Index(BaseIndex):
    """
    Sparse Information Retrieval Index using the Okapi BM25 algorithm.
    Perfect for exact keyword matching (TF-IDF evolved).
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1  # Term frequency saturation parameter
        self.b = b    # Length normalization parameter
        
        self.documents: dict[int, VectorItem] = {}
        self.doc_lengths: dict[int, int] = {}
        self.doc_term_freqs: dict[int, Counter] = {}
        
        self.df: Counter = Counter()  # Document Frequency: how many docs contain term X
        self.avgdl: float = 0.0       # Average document length
        self.total_docs: int = 0
        
        self.tombstones: set[int] = set() # Support soft deletes

    def _tokenize(self, text: str) -> list[str]:
        """Simple tokenizer: lowercase and strip non-alphanumeric."""
        text = text.lower()
        return re.findall(r'\b\w+\b', text)

    def insert(self, item: VectorItem) -> None:
        """Indexes a document's text for sparse retrieval."""
        item_id = item.id
        
        # If it was previously deleted, revive it
        if item_id in self.tombstones:
            self.tombstones.remove(item_id)
            
        tokens = self._tokenize(item.metadata)
        length = len(tokens)
        freqs = Counter(tokens)
        
        self.documents[item_id] = item
        self.doc_lengths[item_id] = length
        self.doc_term_freqs[item_id] = freqs
        
        # Update Document Frequencies
        for term in freqs.keys():
            self.df[term] += 1
            
        # Update Average Document Length dynamically
        total_length = (self.avgdl * self.total_docs) + length
        self.total_docs += 1
        self.avgdl = total_length / self.total_docs

    def search(self, query: str, k: int = 5) -> list[SearchResult]:
        """Scores documents against the query using Okapi BM25."""
        if self.total_docs == 0:
            return []

        query_tokens = self._tokenize(query)
        scores: dict[int, float] = {doc_id: 0.0 for doc_id in self.documents if doc_id not in self.tombstones}

        for token in query_tokens:
            if token not in self.df:
                continue
                
            # Calculate Inverse Document Frequency (IDF)
            # Added 0.5 to numerator/denominator for smoothing
            idf = math.log(
                1 + (self.total_docs - self.df[token] + 0.5) / (self.df[token] + 0.5)
            )

            for doc_id, freqs in self.doc_term_freqs.items():
                if doc_id in self.tombstones:
                    continue
                    
                tf = freqs.get(token, 0)
                if tf == 0:
                    continue

                # Calculate Term Frequency (TF) Component
                dl = self.doc_lengths[doc_id]
                tf_comp = (tf * (self.k1 + 1)) / (
                    tf + self.k1 * (1 - self.b + self.b * (dl / self.avgdl))
                )
                
                scores[doc_id] += idf * tf_comp

        # Sort by highest score (unlike distance, higher BM25 score is better)
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for doc_id, score in sorted_docs[:k]:
            if score > 0.0:  # Only return documents that actually matched something
                # We invert the score so it acts like a "distance" for API consistency (lower is better)
                results.append(SearchResult(distance=-score, item=self.documents[doc_id]))

        return results

    def remove(self, item_id: int) -> bool:
        if item_id not in self.documents or item_id in self.tombstones:
            return False
        self.tombstones.add(item_id)
        return True

    def save(self, filepath: str) -> None:
        state = {
            "documents": self.documents,
            "doc_lengths": self.doc_lengths,
            "doc_term_freqs": self.doc_term_freqs,
            "df": self.df,
            "avgdl": self.avgdl,
            "total_docs": self.total_docs,
            "tombstones": self.tombstones
        }
        with open(filepath, "wb") as f:
            pickle.dump(state, f)
        logger.info(f"BM25 Index saved to {filepath}.")

    def load(self, filepath: str) -> None:
        if not os.path.exists(filepath):
            return
        with open(filepath, "rb") as f:
            state = pickle.load(f)
        self.documents = state["documents"]
        self.doc_lengths = state["doc_lengths"]
        self.doc_term_freqs = state["doc_term_freqs"]
        self.df = state["df"]
        self.avgdl = state["avgdl"]
        self.total_docs = state["total_docs"]
        self.tombstones = state.get("tombstones", set())