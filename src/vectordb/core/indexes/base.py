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
        """
        Inserts a single VectorItem into the index.

        Args:
            item (VectorItem): The document/chunk and its embedding.
        """
        pass

    @abstractmethod
    def search(self, query: np.ndarray, k: int = 5) -> list[SearchResult]:
        """
        Searches the index for the 'k' closest items to the query vector.

        Args:
            query (np.ndarray): The high-dimensional query vector.
            k (int): The number of top results to return. Default is 5.

        Returns:
            list[SearchResult]: A list of matched items and their distances,
                                sorted from closest to furthest.
        """
        pass

    @abstractmethod
    def remove(self, item_id: int) -> bool:
        """
        Removes an item from the index by its ID.

        Args:
            item_id (int): The unique ID of the item to remove.

        Returns:
            bool: True if removed successfully, False if the item was not found.
        """
        pass
    
    @abstractmethod
    def save(self, filepath: str) -> None:
        """Serializes and saves the index to disk."""
        pass

    @abstractmethod
    def load(self, filepath: str) -> None:
        """Loads the index from disk into memory."""
        pass