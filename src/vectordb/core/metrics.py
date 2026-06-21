import numpy as np

def euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculates the Euclidean distance between two vectors.
    Equivalent to the straight-line distance.
    """
    return float(np.linalg.norm(a - b))


def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculates the Cosine distance (1 - cosine similarity).
    Values range from 0.0 (identical direction) to 2.0 (opposite direction).
    """
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    # Prevent division by zero if a vector is completely empty [0, 0, ...]
    if norm_a < 1e-9 or norm_b < 1e-9:
        return 1.0

    similarity = np.dot(a, b) / (norm_a * norm_b)

    # Clip to avoid floating point inaccuracies (e.g., similarity = 1.0000000000000002)
    similarity = np.clip(similarity, -1.0, 1.0)

    return float(1.0 - similarity)


def manhattan_distance(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculates the Manhattan (L1) distance.
    Equivalent to the sum of absolute differences across all dimensions.
    """
    return float(np.sum(np.abs(a - b)))