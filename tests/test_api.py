import pytest
from fastapi.testclient import TestClient

# Import your FastAPI app from main
from main import app

# Create a test client that mimics a user's browser or Postman
client = TestClient(app)

def test_status_endpoint() -> None:
    """Tests if the server boots up and the status endpoint returns 200 OK."""
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert "engine" in data
    assert "total_nodes" in data

def test_insert_and_search_endpoints() -> None:
    """Tests the full lifecycle of inserting a vector via HTTP and searching for it."""
    # 1. Insert a document via the API
    insert_payload = {
        "id": 777,
        "metadata": "API Test Document",
        "category": "testing",
        "embedding": [0.5] * 128  # A dummy 128-dimensional vector
    }
    insert_response = client.post("/api/v1/insert", json=insert_payload)
    assert insert_response.status_code == 201
    assert insert_response.json()["status"] == "success"

    # 2. Search for that exact vector via the API
    search_payload = {
        "embedding": [0.5] * 128,
        "k": 1
    }
    search_response = client.post("/api/v1/search", json=search_payload)
    assert search_response.status_code == 200
    
    # 3. Verify the results
    results = search_response.json()
    assert len(results) > 0
    assert results[0]["id"] == 777
    assert results[0]["metadata"] == "API Test Document"