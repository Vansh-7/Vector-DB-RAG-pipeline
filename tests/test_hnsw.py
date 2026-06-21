import os
import numpy as np
import pytest

from vectordb.core.indexes.hnsw import HNSWIndex
from vectordb.core.metrics import euclidean_distance
from vectordb.core.types import VectorItem

@pytest.fixture
def hnsw_index() -> HNSWIndex:
    """Provides a fresh HNSW index for each test."""
    return HNSWIndex(distance_metric=euclidean_distance, m=16, ef_construction=100)

def test_hnsw_insertion_and_search(hnsw_index: HNSWIndex) -> None:
    """Tests if the graph can ingest vectors and retrieve the exact closest match."""
    
    # 1. Insert 50 random noise vectors first to build the graph
    for i in range(50):
        noise_vector = np.random.rand(128)
        item = VectorItem(id=i, metadata=f"Noise {i}", category="test", embedding=noise_vector.tolist())
        hnsw_index.insert(item)
        
    # 2. Create a distinct target vector FROM THE SAME DISTRIBUTION
    target_vector = np.random.rand(128)
    target_item = VectorItem(id=999, metadata="Target", category="test", embedding=target_vector.tolist())
    
    # 3. Insert the target into the populated graph
    hnsw_index.insert(target_item)
        
    # 4. Search for the exact target vector
    results = hnsw_index.search(target_vector, k=3)
    
    # The top result MUST be our target item
    assert len(results) > 0
    assert results[0].item.id == 999
    assert results[0].distance == pytest.approx(0.0, abs=1e-5)

def test_hnsw_persistence(hnsw_index: HNSWIndex, tmp_path: pytest.TempPathFactory) -> None:
    """Tests if the database can survive being saved to disk and reloaded."""
    # Insert dummy data
    item = VectorItem(id=1, metadata="Test", category="test", embedding=np.random.rand(128).tolist())
    hnsw_index.insert(item)
    
    # Use Pytest's built-in temporary directory for safe testing
    filepath = os.path.join(tmp_path, "test_db.pkl")
    
    # Save, wipe the index, and reload
    hnsw_index.save(filepath)
    assert os.path.exists(filepath)
    
    # Create a brand new, empty index and load the file
    new_index = HNSWIndex(distance_metric=euclidean_distance)
    new_index.load(filepath)
    
    # Verify the state was perfectly restored
    assert len(new_index.nodes) == 1
    assert 1 in new_index.nodes
    assert new_index.entry_point_id == 1