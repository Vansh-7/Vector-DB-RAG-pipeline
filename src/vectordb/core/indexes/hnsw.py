import math
import random
import heapq
import numpy as np
from typing import Callable

from vectordb.core.indexes.base import BaseIndex
from src.vectordb.core.types import VectorItem, SearchResult

class HNSWNode:
    """Represents a single document inside the HNSW graph layers."""
    __slots__ = ['item', 'max_layer', 'neighbors']
    
    def __init__(self, item: VectorItem, max_layer: int):
        self.item = item
        self.max_layer = max_layer
        # A list of lists. neighbors[0] = connections at layer 0, etc.
        self.neighbors: list[list[int]] = [[] for _ in range(max_layer + 1)]


class HNSWIndex(BaseIndex):
    """
    Hierarchical Navigable Small World Graph.
    Approximate Nearest Neighbor (ANN) search. Achieves O(log N) search time 
    even in extremely high dimensions (e.g., 768D or 1536D).
    """
    
    def __init__(self, distance_metric: Callable[[np.ndarray, np.ndarray], float], m: int = 16, ef_construction: int = 200):
        self.distance_metric = distance_metric
        self.m = m                 # Max connections per node per layer
        self.m0 = 2 * m            # Max connections specifically at layer 0 (the dense bottom layer)
        self.ef_construction = ef_construction # Beam search width during insertion
        self.ml = 1.0 / math.log(m) # Level generation multiplier
        
        self.nodes: dict[int, HNSWNode] = {}
        self.entry_point_id: int | None = None
        self.top_layer: int = -1

    def _random_level(self) -> int:
        """Assigns a random max layer for a new node. Higher layers are exponentially rarer."""
        return math.floor(-math.log(random.uniform(0.0001, 1.0)) * self.ml)

    def _search_layer(self, query: np.ndarray, entry_point: int, ef: int, layer: int) -> list[tuple[float, int]]:
        """Greedy beam search across a single specific layer of the graph."""
        visited = {entry_point}
        
        # Min-heap to explore the closest candidates first
        candidates = [] 
        # Max-heap to keep track of the 'ef' closest items found so far
        found = []      
        
        ep_node = self.nodes[entry_point]
        dist = self.distance_metric(query, np.array(ep_node.item.embedding))
        
        heapq.heappush(candidates, (dist, entry_point))
        heapq.heappush(found, (-dist, entry_point)) # Negative for max-heap
        
        while candidates:
            # Get the closest candidate to explore
            cand_dist, cand_id = heapq.heappop(candidates)
            
            # If our best candidate is further than the worst point in our 'found' list, we can stop
            if len(found) >= ef and cand_dist > -found[0][0]:
                break
                
            cand_node = self.nodes[cand_id]
            if layer >= len(cand_node.neighbors):
                continue
                
            # Check all neighbors of this candidate at the current layer
            for neighbor_id in cand_node.neighbors[layer]:
                if neighbor_id in visited or neighbor_id not in self.nodes:
                    continue
                visited.add(neighbor_id)
                
                neighbor_node = self.nodes[neighbor_id]
                n_dist = self.distance_metric(query, np.array(neighbor_node.item.embedding))
                
                # If we haven't hit our beam width 'ef', or this neighbor is closer than our worst find
                if len(found) < ef or n_dist < -found[0][0]:
                    heapq.heappush(candidates, (n_dist, neighbor_id))
                    heapq.heappush(found, (-n_dist, neighbor_id))
                    
                    if len(found) > ef:
                        heapq.heappop(found) # Drop the furthest node
                        
        # Unpack the max-heap, flip signs back to positive, and sort closest first
        res = [( -d, idx ) for d, idx in found]
        res.sort(key=lambda x: x[0])
        return res

    def insert(self, item: VectorItem) -> None:
        """Inserts a document into the multilayer graph."""
        item_id = item.id
        level = self._random_level()
        new_node = HNSWNode(item, level)
        self.nodes[item_id] = new_node
        
        # First node inserted becomes the entry point
        if self.entry_point_id is None:
            self.entry_point_id = item_id
            self.top_layer = level
            return
            
        ep = self.entry_point_id
        query_emb = np.array(item.embedding)
        
        # Phase 1: Fast zoom down from the top layer to the new node's max layer
        for lc in range(self.top_layer, level, -1):
            if lc < len(self.nodes[ep].neighbors):
                W = self._search_layer(query_emb, ep, ef=1, layer=lc)
                if W:
                    ep = W[0][1] # Best match becomes the entry point for the next layer down
                    
        # Phase 2: Insert into all assigned layers (from its max level down to 0)
        for lc in range(min(self.top_layer, level), -1, -1):
            # Find the best candidates to connect to
            W = self._search_layer(query_emb, ep, ef=self.ef_construction, layer=lc)
            max_m = self.m0 if lc == 0 else self.m
            
            # Form connections (edges)
            selected_neighbors = [idx for _, idx in W[:max_m]]
            new_node.neighbors[lc] = selected_neighbors
            
            # Make the connections bidirectional
            for n_id in selected_neighbors:
                if n_id not in self.nodes:
                    continue
                neighbor_node = self.nodes[n_id]
                
                # Expand neighbor's layer list if needed
                while len(neighbor_node.neighbors) <= lc:
                    neighbor_node.neighbors.append([])
                    
                neighbor_node.neighbors[lc].append(item_id)
                
                # Enforce max connection limits on the neighbor
                if len(neighbor_node.neighbors[lc]) > max_m:
                    n_emb = np.array(neighbor_node.item.embedding)
                    # Recalculate distances to all its neighbors and keep the closest
                    distances = []
                    for c_id in neighbor_node.neighbors[lc]:
                        if c_id in self.nodes:
                            d = self.distance_metric(n_emb, np.array(self.nodes[c_id].item.embedding))
                            distances.append((d, c_id))
                    distances.sort()
                    neighbor_node.neighbors[lc] = [idx for _, idx in distances[:max_m]]
                    
            if W:
                ep = W[0][1]
                
        # If this node's level is higher than the graph's current top, it becomes the new entry point
        if level > self.top_layer:
            self.top_layer = level
            self.entry_point_id = item_id

    def search(self, query: np.ndarray, k: int = 5, ef_search: int = 50) -> list[SearchResult]:
        """Searches the graph for the closest items."""
        if self.entry_point_id is None:
            return []
            
        ep = self.entry_point_id
        
        # Zoom down the highway to layer 0
        for lc in range(self.top_layer, 0, -1):
            if lc < len(self.nodes[ep].neighbors):
                W = self._search_layer(query, ep, ef=1, layer=lc)
                if W:
                    ep = W[0][1]
                    
        # Wide beam search at the bottom layer to guarantee accuracy
        W = self._search_layer(query, ep, ef=max(ef_search, k), layer=0)
        
        results = []
        for d, idx in W[:k]:
            if idx in self.nodes:
                results.append(SearchResult(distance=d, item=self.nodes[idx].item))
                
        return results

    def remove(self, item_id: int) -> bool:
        """Removes an item and cleans up its graph edges."""
        if item_id not in self.nodes:
            return False
            
        # Remove from all neighbors' connection lists
        for node in self.nodes.values():
            for layer_conns in node.neighbors:
                if item_id in layer_conns:
                    layer_conns.remove(item_id)
                    
        # If we deleted the entry point, assign a new one
        if self.entry_point_id == item_id:
            self.entry_point_id = None
            for n_id in self.nodes.keys():
                if n_id != item_id:
                    self.entry_point_id = n_id
                    break
                    
        del self.nodes[item_id]
        return True