from fastapi import APIRouter, HTTPException
import numpy as np

from vectordb.api.schemas import InsertRequest, SearchRequest, SearchResultItem
from vectordb.api.state import vector_db, db_lock
from vectordb.core.types import VectorItem

router = APIRouter()

@router.post("/insert", status_code=201)
async def insert_vector(request: InsertRequest):
    """Inserts a new vector into the HNSW graph safely."""
    item = VectorItem(
        id=request.id,
        metadata=request.metadata,
        category=request.category,
        embedding=request.embedding
    )
    
    # Acquire the lock to prevent graph corruption during concurrent writes
    async with db_lock:
        try:
            vector_db.insert(item)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Insertion failed: {str(e)}")
            
    return {"status": "success", "message": f"Successfully inserted item {request.id}"}

@router.post("/search", response_model=list[SearchResultItem])
async def search_vectors(request: SearchRequest):
    """Queries the HNSW graph for the top-K nearest neighbors."""
    # Convert the raw Python list of floats into a fast NumPy array
    query_arr = np.array(request.embedding, dtype=float)
    
    # Reads generally do not mutate the graph, so we skip the lock for faster concurrent reads
    try:
        results = vector_db.search(query_arr, k=request.k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
        
    # Map our internal SearchResult objects to the clean API Response schema
    response = []
    for res in results:
        response.append(SearchResultItem(
            id=res.item.id,
            distance=res.distance,
            metadata=res.item.metadata,
            category=res.item.category
        ))
        
    return response

@router.get("/status")
async def get_db_status():
    """Returns the current health and metrics of the Vector DB."""
    return {
        "engine": "HNSW",
        "top_layer": vector_db.top_layer,
        "total_nodes": len(vector_db.nodes)
    }