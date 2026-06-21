import numpy as np
import pytest
from scipy.spatial import distance

# Import your custom math engine
from vectordb.core.metrics import (
    euclidean_distance,
    cosine_distance,
    manhattan_distance,
)

@pytest.fixture
def random_vectors() -> tuple[np.ndarray, np.ndarray]:
    """Fixture to generate high-dimensional vectors for testing."""
    # We use 768 dimensions, the standard for models like Nomic and BERT
    v1 = np.random.rand(768).astype(np.float32)
    v2 = np.random.rand(768).astype(np.float32)
    return v1, v2

def test_euclidean_distance(random_vectors: tuple[np.ndarray, np.ndarray]) -> None:
    v1, v2 = random_vectors
    custom_dist = euclidean_distance(v1, v2)
    scipy_dist = distance.euclidean(v1, v2)
    
    # We use pytest.approx to handle microscopic floating-point rounding differences
    assert custom_dist == pytest.approx(scipy_dist, rel=1e-5), "Euclidean math is incorrect!"

def test_cosine_distance(random_vectors: tuple[np.ndarray, np.ndarray]) -> None:
    v1, v2 = random_vectors
    custom_dist = cosine_distance(v1, v2)
    scipy_dist = distance.cosine(v1, v2)
    
    assert custom_dist == pytest.approx(scipy_dist, rel=1e-5), "Cosine math is incorrect!"

def test_manhattan_distance(random_vectors: tuple[np.ndarray, np.ndarray]) -> None:
    v1, v2 = random_vectors
    custom_dist = manhattan_distance(v1, v2)
    scipy_dist = distance.cityblock(v1, v2)
    
    assert custom_dist == pytest.approx(scipy_dist, rel=1e-5), "Manhattan math is incorrect!"