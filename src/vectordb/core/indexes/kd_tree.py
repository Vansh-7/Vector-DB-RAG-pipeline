import heapq
import numpy as np
from typing import Callable

from vectordb.core.indexes.base import BaseIndex
from vectordb.core.types import VectorItem, SearchResult

class KDNode:
    """A single node in the KD-Tree."""
    # __slots__ is an industry trick to save memory when creating thousands of objects
    __slots__ = ['item', 'left', 'right']

    def __init__(self, item: VectorItem):
        self.item = item
        self.left: 'KDNode | None' = None
        self.right: 'KDNode | None' = None


class KDTreeIndex(BaseIndex):
    """
    K-Dimensional Tree for exact nearest neighbor search.
    Achieves O(log N) search time for low dimensions, but degrades to Brute Force 
    in extremely high dimensions (The Curse of Dimensionality).
    """
    
    def __init__(self, distance_metric: Callable[[np.ndarray, np.ndarray], float], dims: int):
        self.distance_metric = distance_metric
        self.dims = dims
        self.root: KDNode | None = None
        
        # We keep a dictionary of active items. Deleting a node from a binary tree 
        # is mathematically complex and can unbalance it, so industry standard 
        # is to just rebuild the tree from active items upon deletion.
        self._active_items: dict[int, VectorItem] = {}

    def insert(self, item: VectorItem) -> None:
        self._active_items[item.id] = item
        self.root = self._insert_node(self.root, item, depth=0)

    def _insert_node(self, node: KDNode | None, item: VectorItem, depth: int) -> KDNode:
        if node is None:
            return KDNode(item)
            
        # Determine which axis (dimension) to split on at this depth
        axis = depth % self.dims
        
        if item.embedding[axis] < node.item.embedding[axis]:
            node.left = self._insert_node(node.left, item, depth + 1)
        else:
            node.right = self._insert_node(node.right, item, depth + 1)
            
        return node

    def search(self, query: np.ndarray, k: int = 5) -> list[SearchResult]:
        if self.root is None:
            return []
            
        # Python's built-in heapq is a MIN-heap, but we need a MAX-heap to drop the 
        # worst (furthest) items. The trick: store distances as negative numbers!
        # Heap elements will be tuples: (-distance, item_id, item)
        heap: list[tuple[float, int, VectorItem]] = []
        
        self._knn_search(self.root, query, k, depth=0, heap=heap)
        
        # Unpack the heap and flip the negative distances back to positive
        results = [
            SearchResult(distance=-neg_dist, item=item)
            for neg_dist, _, item in heap
        ]
        
        # Sort from closest (lowest distance) to furthest
        results.sort(key=lambda x: x.distance)
        return results

    def _knn_search(self, node: KDNode | None, query: np.ndarray, k: int, depth: int, heap: list):
        if node is None:
            return
            
        # Calculate distance to current node
        node_vector = np.array(node.item.embedding)
        dist = self.distance_metric(query, node_vector)
        
        # If heap isn't full, or this distance is better (smaller) than the worst one we have
        if len(heap) < k or dist < -heap[0][0]:
            heapq.heappush(heap, (-dist, node.item.id, node.item))
            if len(heap) > k:
                heapq.heappop(heap) # Drop the worst match
                
        axis = depth % self.dims
        axis_diff = query[axis] - node.item.embedding[axis]
        
        # Check the side of the splitting plane the query falls on
        closer_node = node.left if axis_diff < 0 else node.right
        farther_node = node.right if axis_diff < 0 else node.left
        
        # Always search the side closer to the query first
        self._knn_search(closer_node, query, k, depth + 1, heap)
        
        # PRUNING STEP: Only search the farther side if the distance to the splitting 
        # boundary is less than our current worst match. If it's further, we can safely 
        # ignore millions of nodes on that side!
        if len(heap) < k or abs(axis_diff) < -heap[0][0]:
            self._knn_search(farther_node, query, k, depth + 1, heap)

    def remove(self, item_id: int) -> bool:
        if item_id not in self._active_items:
            return False
            
        del self._active_items[item_id]
        self._rebuild()
        return True
        
    def _rebuild(self) -> None:
        """Wipes and rebuilds the tree from scratch (called on deletion)."""
        self.root = None
        for item in self._active_items.values():
            self.root = self._insert_node(self.root, item, depth=0)