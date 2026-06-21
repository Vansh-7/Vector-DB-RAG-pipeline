import os
import numpy as np
import pytest

from vectordb.core.indexes.kd_tree import KDTreeIndex
from vectordb.core.metrics import euclidean_distance
from vectordb.core.types import VectorItem

@pytest.fixture
def kd_tree_index() -> KDTreeIndex:
    """Provides a fresh KD-Tree index for each test. Requires dimension size."""
    return KDTreeIndex(distance_metric=euclidean_distance, dims=128)

def test_kdtree_insertion_and_search(kd_tree_index: KDTreeIndex) -> None:
    """Tests spatial partitioning and exact distance matching."""
    for i in range(50):
        noise_vector = np.random.rand(128)
        item = VectorItem(id=i, metadata=f"Noise {i}", category="test", embedding=noise_vector.tolist())
        kd_tree_index.insert(item)
        
    target_vector = np.random.rand(128)
    target_item = VectorItem(id=999, metadata="Target", category="test", embedding=target_vector.tolist())
    kd_tree_index.insert(target_item)
        
    results = kd_tree_index.search(target_vector, k=3)
    
    assert len(results) > 0
    assert results[0].item.id == 999
    assert results[0].distance == pytest.approx(0.0, abs=1e-5)

def test_kdtree_removal_and_rebuild(kd_tree_index: KDTreeIndex) -> None:
    """Tests if the tree correctly wipes and reconstructs itself on deletion."""
    item = VectorItem(id=1, metadata="Target", category="test", embedding=np.random.rand(128).tolist())
    kd_tree_index.insert(item)
    
    assert 1 in kd_tree_index._active_items
    assert kd_tree_index.root is not None
    
    success = kd_tree_index.remove(1)
    
    assert success is True
    assert 1 not in kd_tree_index._active_items
    assert kd_tree_index.root is None  # Tree should be completely empty now

def test_kdtree_persistence(kd_tree_index: KDTreeIndex, tmp_path: pytest.TempPathFactory) -> None:
    """Tests disk I/O and spatial reconstruction on load."""
    item = VectorItem(id=1, metadata="Test", category="test", embedding=np.random.rand(128).tolist())
    kd_tree_index.insert(item)
    
    filepath = os.path.join(tmp_path, "test_kd.pkl")
    kd_tree_index.save(filepath)
    
    new_index = KDTreeIndex(distance_metric=euclidean_distance, dims=128)
    new_index.load(filepath)
    
    assert 1 in new_index._active_items
    assert new_index.root is not None  # Proves _rebuild() was called during load