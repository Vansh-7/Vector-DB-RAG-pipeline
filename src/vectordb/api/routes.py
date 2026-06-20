import numpy as np
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

# Import State and Schemas
from src.vectordb.api.state import vector_db, db_lock
from src.vectordb.api import schemas
from src.vectordb.core.types import VectorItem

# Import our AI Engines
from src.vectordb.ai.embedder import embedder
from src.vectordb.ai.chunker import document_splitter
from src.vectordb.ai.generator import llm_generator

router = APIRouter()

# Core Database API (Low-Level)
@router.post("/insert", status_code=201)
async def insert_vector(request: schemas.InsertRequest):
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

@router.post("/search", response_model=list[schemas.SearchResultItem])
async def search_vectors(request: schemas.SearchRequest):
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
        response.append(schemas.SearchResultItem(
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
  
# RAG Application API (High-Level)  
@router.post("/ingest", status_code=201)
async def ingest_document(request: schemas.IngestRequest):
    """
    Instead of manually inserting vectors, users insert raw text.
    We chunk it, embed it concurrently, and insert it into the HNSW graph.
    """
    try:
        # 1. Chunk the massive raw document into token-safe pieces
        chunks = document_splitter.split_text(request.text)
        
        # 2. Vectorize all chunks concurrently (Extremely fast)
        vectors = await embedder.embed_batch(chunks)
        
        # 3. Safely insert into the DB preventing race conditions
        async with db_lock:
            for chunk, vector in zip(chunks, vectors):
                # Generates a guaranteed unique 64-bit integer
                item_id = int(uuid.uuid4().int >> 64) 
                
                item = VectorItem(
                    id=item_id, 
                    metadata=chunk, 
                    category=request.category, 
                    embedding=vector
                )
                vector_db.insert(item)
                
        return {"message": f"Successfully ingested document into {len(chunks)} searchable chunks."}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

@router.post("/ask")
async def ask_question(request: schemas.AskRequest):
    """
    The RAG Crown Jewel: Embeds the question, searches the HNSW graph,
    and streams the LLM response back in real-time.
    """
    # 1. Convert the human question into a mathematical vector
    try:
        question_vector = await embedder.embed_text(request.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to embed question: {e}")

    # 2. Search the vector database for the closest semantic chunks
    try:
        # No db_lock needed for searching!
        raw_results = vector_db.search(np.array(question_vector, dtype=float), k=request.k)
        
        # Extract just the raw text strings from the search results
        # Depending on how your SearchResult is structured, this might be result.item.metadata
        retrieved_chunks = [result.item.metadata for result in raw_results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database search failed: {e}")

    # 3. Stream the LLM response back to the client using Server-Sent Events (SSE)
    return StreamingResponse(
        llm_generator.generate_stream(request.question, retrieved_chunks),
        media_type="text/event-stream"
    )