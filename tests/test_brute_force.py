import os
import numpy as np
import pytest

from vectordb.core.indexes.brute_force import BruteForceIndex
from vectordb.core.metrics import euclidean_distance
from vectordb.core.types import VectorItem

@pytest.fixture
def brute_force_index() -> BruteForceIndex:
    """Provides a fresh Brute Force index for each test."""
    return BruteForceIndex(distance_metric=euclidean_distance)

def test_bf_insertion_and_search(brute_force_index: BruteForceIndex) -> None:
    """Tests if Brute Force correctly finds the exact match in a linear scan."""
    for i in range(50):
        noise_vector = np.random.rand(128)
        item = VectorItem(id=i, metadata=f"Noise {i}", category="test", embedding=noise_vector.tolist())
        brute_force_index.insert(item)
        
    target_vector = np.random.rand(128)
    target_item = VectorItem(id=999, metadata="Target", category="test", embedding=target_vector.tolist())
    brute_force_index.insert(target_item)
        
    results = brute_force_index.search(target_vector, k=3)
    
    assert len(results) > 0
    assert results[0].item.id == 999
    assert results[0].distance == pytest.approx(0.0, abs=1e-5)

def test_bf_removal(brute_force_index: BruteForceIndex) -> None:
    """Tests if items are successfully deleted from the flat dictionary."""
    item = VectorItem(id=1, metadata="Target", category="test", embedding=np.random.rand(128).tolist())
    brute_force_index.insert(item)
    
    assert 1 in brute_force_index.items
    success = brute_force_index.remove(1)
    
    assert success is True
    assert 1 not in brute_force_index.items
    assert len(brute_force_index.search(np.array(item.embedding), k=1)) == 0

def test_bf_persistence(brute_force_index: BruteForceIndex, tmp_path: pytest.TempPathFactory) -> None:
    """Tests disk I/O for the Brute Force dictionary."""
    item = VectorItem(id=1, metadata="Test", category="test", embedding=np.random.rand(128).tolist())
    brute_force_index.insert(item)
    
    filepath = os.path.join(tmp_path, "test_bf.pkl")
    brute_force_index.save(filepath)
    
    new_index = BruteForceIndex(distance_metric=euclidean_distance)
    new_index.load(filepath)
    assert 1 in new_index.items