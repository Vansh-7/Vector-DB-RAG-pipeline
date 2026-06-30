from abc import ABC, abstractmethod

import numpy as np

from vectordb.core.types import SearchResult, VectorItem


class BaseIndex(ABC):
    """
    Abstract Base Class for all Vector Database indexing algorithms.
    Ensures that BruteForce, KDTree, and HNSW all expose the exact same API.
    """

    @abstractmethod
    def insert(self, item: VectorItem) -> None:
        pass

    @abstractmethod
    def search(self, query: np.ndarray, k: int = 5) -> list[SearchResult]:
        pass

    @abstractmethod
    def remove(self, item_id: int) -> bool:
        pass
    
    @abstractmethod
    def save(self, filepath: str) -> None:
        pass

    @abstractmethod
    def load(self, filepath: str) -> None:
        pass

    @abstractmethod
    def size(self) -> int:
        """Returns the number of active (non-deleted) items in the index."""
        pass

    @abstractmethod
    def get_all_items(self) -> list[VectorItem]:
        """Returns all active items for re-insertion into another engine."""
        pass
