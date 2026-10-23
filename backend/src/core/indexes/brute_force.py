from typing import Callable
import numpy as np

from core.types import SearchResult, VectorItem
from core.snapshots import load_snapshot, save_snapshot
# Import our base contract and data types
from core.indexes.base import BaseIndex, DuplicateVectorID

class BruteForceIndex(BaseIndex):
    """
    Exact Nearest Neighbor search.
    Compares the query vector against every single item in the database.
    """

    algorithm = "exact"

    def __init__(self, distance_metric: Callable[[np.ndarray, np.ndarray], float]) -> None:
        """
        Args:
            distance_metric: The function to use for calculating distance
                             (e.g., cosine_distance from metrics.py)
        """
        # We use a dictionary mapping ID -> VectorItem for O(1) lookups and easy deletions
        self.items: dict[int, VectorItem] = {}
        self.embeddings: dict[int, np.ndarray] = {}
        self.distance_metric = distance_metric
        self.tombstones: set[int] = set()

    def contains_id(self, item_id: int) -> bool:
        return item_id in self.items or item_id in self.tombstones

    def get_item(self, item_id: int) -> VectorItem | None:
        return self.items.get(item_id)

    def insert(self, item: VectorItem) -> None:
        """Insert a new identity; updates and retired-ID reuse are forbidden."""
        if self.contains_id(item.id):
            raise DuplicateVectorID("Vector ID is unavailable.")
        self.items[item.id] = item
        self.embeddings[item.id] = np.array(item.embedding, dtype=float)

    def search(self, query: np.ndarray, k: int = 5) -> list[SearchResult]:
        """
        Calculates the distance to all items and returns the top K.
        """
        if not self.items:
            return []

        results = []

        # Calculate the distance from the query to every item
        for item in self.items.values():
            item_vector = self.embeddings[item.id]
            dist = self.distance_metric(query, item_vector)
            results.append(SearchResult(distance=dist, item=item))

        # Sort the results by distance (lowest distance = closest match)
        results.sort(key=lambda x: x.distance)

        # Return only the top K items
        return results[:k]

    def remove(self, item_id: int) -> bool:
        """Deletes an item if it exists."""
        if item_id in self.items:
            self.tombstones.add(item_id)
            del self.items[item_id]
            if item_id in self.embeddings:
                del self.embeddings[item_id]
            return True
        return False
    
    def size(self) -> int:
        return len(self.items)

    def get_all_items(self) -> list[VectorItem]:
        return list(self.items.values())

    def _snapshot_state(self):
        return {"items": self.items, "tombstones": self.tombstones}

    def _restore_state(self, saved):
        self.items = saved["items"]
        self.tombstones = saved["tombstones"]
        self.embeddings = {item.id: np.array(item.embedding, dtype=float)
                           for item in self.items.values()}

    def save(self, filepath: str) -> None:
        save_snapshot(self, filepath)

    def load(self, filepath: str) -> None:
        load_snapshot(self, filepath)
