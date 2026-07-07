import os
import pytest

# Set env vars to isolate the test database BEFORE importing the app
os.environ["VECTOR_DB_FILE"] = "test_vector_database.pkl"
os.environ["VECTOR_WAL_FILE"] = "test_vector_database.wal"

from fastapi.testclient import TestClient

# Import your FastAPI app from main
from vectordb.main import app

# Create a test client that mimics a user's browser or Postman
client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_test_db():
    # Setup
    yield
    # Teardown: remove the test files
    if os.path.exists("test_vector_database.pkl"):
        os.remove("test_vector_database.pkl")
    if os.path.exists("test_vector_database.wal"):
        os.remove("test_vector_database.wal")

def test_status_endpoint() -> None:
    """Tests if the server boots up and the status endpoint returns 200 OK."""
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert "engine" in data
    assert "total_docs" in data

def test_insert_and_search_endpoints() -> None:
    """Tests the full lifecycle of inserting a vector via HTTP and searching for it."""
    # 1. Insert a document via the API
    insert_payload = {
        "id": 777,
        "metadata": "API Test Document",
        "category": "testing",
        "embedding": [0.5] * 768  # A dummy 768-dimensional vector
    }
    insert_response = client.post("/api/v1/insert", json=insert_payload)
    assert insert_response.status_code == 201
    assert insert_response.json()["status"] == "success"

    # 2. Search for that exact vector via the API
    search_payload = {
        "text": "API Test Document",
        "embedding": [0.5] * 768,
        "k": 10  # Increase k to ensure we find our inserted doc even if other data exists
    }
    search_response = client.post("/api/v1/search", json=search_payload)
    assert search_response.status_code == 200

    # 3. Verify the results
    results = search_response.json()
    assert len(results) > 0
    # The database contains real data, so our dummy vector might not be the absolute #1 result.
    # We verify it exists in the top k results instead.
    assert any(r["id"] == 777 for r in results), "Inserted document ID 777 not found in search results"
    matching_doc = next(r for r in results if r["id"] == 777)
    assert matching_doc["metadata"] == "API Test Document"