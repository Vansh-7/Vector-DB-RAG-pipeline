from typing import Callable
import os
import pickle
import numpy as np

from vectordb.core.types import SearchResult, VectorItem
from vectordb.core.logger import logger
# Import our base contract and data types
from vectordb.core.indexes.base import BaseIndex

class BruteForceIndex(BaseIndex):
    """
    Exact Nearest Neighbor search.
    Compares the query vector against every single item in the database.
    """

    def __init__(self, distance_metric: Callable[[np.ndarray, np.ndarray], float]) -> None:
        """
        Args:
            distance_metric: The function to use for calculating distance
                             (e.g., cosine_distance from metrics.py)
        """
        # We use a dictionary mapping ID -> VectorItem for O(1) lookups and easy deletions
        self.items: dict[int, VectorItem] = {}
        self.distance_metric = distance_metric

    def insert(self, item: VectorItem) -> None:
        """Adds or updates an item in the dictionary."""
        self.items[item.id] = item

    def search(self, query: np.ndarray, k: int = 5) -> list[SearchResult]:
        """
        Calculates the distance to all items and returns the top K.
        """
        if not self.items:
            return []

        results = []

        # Calculate the distance from the query to every item
        for item in self.items.values():
            # Convert the stored list[float] back to a numpy array for the math
            item_vector = np.array(item.embedding)
            dist = self.distance_metric(query, item_vector)
            results.append(SearchResult(distance=dist, item=item))

        # Sort the results by distance (lowest distance = closest match)
        results.sort(key=lambda x: x.distance)

        # Return only the top K items
        return results[:k]

    def remove(self, item_id: int) -> bool:
        """Deletes an item if it exists."""
        if item_id in self.items:
            del self.items[item_id]
            return True
        return False
    
    def save(self, filepath: str) -> None:
        """Serializes and saves the items dictionary to disk."""
        with open(filepath, "wb") as f:
            pickle.dump(self.items, f)
        logger.info(f"BruteForce Index successfully saved to {filepath} ({len(self.items)} items).")

    def load(self, filepath: str) -> None:
        """Loads the items dictionary from disk."""
        if not os.path.exists(filepath):
            logger.warning(f"Index file {filepath} not found. Starting with a fresh database.")
            return
            
        with open(filepath, "rb") as f:
            self.items = pickle.load(f)
        logger.info(f"BruteForce Index successfully loaded from {filepath} ({len(self.items)} items).")