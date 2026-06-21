import uuid
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

# Import our AI Engines
from vectordb.ai.chunker import chunker
from vectordb.ai.embedder import embedder
from vectordb.ai.generator import llm_generator
from vectordb.ai.reranker import cross_encoder

# Import State and Schemas
from vectordb.api import schemas
from vectordb.api.state import db_lock, vector_db
from vectordb.core.types import VectorItem
from vectordb.core.logger import logger

router = APIRouter()

# Core Database API (Low-Level)
@router.post("/insert", status_code=201)
async def insert_vector(request: schemas.InsertRequest) -> dict[str, Any]:
    """Inserts a new vector into the HNSW graph safely."""
    logger.info(f"Incoming insert request for Document ID: {request.id}")
    item = VectorItem(
        id=request.id,
        metadata=request.metadata,
        category=request.category,
        embedding=request.embedding,
    )

    # Acquire the lock to prevent graph corruption during concurrent writes
    async with db_lock:
        try:
            vector_db.insert(item)
            logger.debug(f"Successfully inserted VectorItem {request.id} into HNSW graph.")
        except Exception as e:
            logger.error(f"Insertion failed for ID {request.id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Insertion failed: {str(e)}")

    return {"status": "success", "message": f"Successfully inserted item {request.id}"}


@router.post("/search", response_model=list[schemas.SearchResultItem])
async def search_vectors(request: schemas.SearchRequest) -> Any:
    """Queries the HNSW graph for the top-K nearest neighbors."""
    logger.info(f"Search request received. Fetching top {request.k} neighbors.")
    
    # Convert the raw Python list of floats into a fast NumPy array
    query_arr = np.array(request.embedding, dtype=float)

    # Reads generally do not mutate the graph, so we skip the lock for faster concurrent reads
    try:
        results = vector_db.search(query_arr, k=request.k)
        logger.debug(f"Search completed successfully. Found {len(results)} results.")
    except Exception as e:
        logger.error(f"Database search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    # Map our internal SearchResult objects to the clean API Response schema
    response = []
    for res in results:
        response.append(
            schemas.SearchResultItem(
                id=res.item.id,
                distance=res.distance,
                metadata=res.item.metadata,
                category=res.item.category,
            )
        )

    return response


@router.get("/status")
async def get_db_status() -> dict[str, Any]:
    """Returns the current health and metrics of the Vector DB."""
    logger.info("Status endpoint pinged.")
    return {"engine": "HNSW", "top_layer": vector_db.top_layer, "total_nodes": len(vector_db.nodes)}


# RAG Application API (High-Level)
@router.post("/ingest", status_code=201)
async def ingest_document(request: schemas.IngestRequest) -> dict[str, Any]:
    """
    Instead of manually inserting vectors, users insert raw text.
    We chunk it, embed it concurrently, and insert it into the HNSW graph.
    """
    logger.info(f"Ingestion request received for category: {request.category}")
    try:
        # 1. Chunk the massive raw document into token-safe pieces
        chunks = chunker.split_text(request.text)
        logger.debug(f"Document successfully split into {len(chunks)} chunks.")

        # 2. Vectorize all chunks concurrently (Extremely fast)
        vectors = await embedder.embed_batch(chunks)
        logger.debug("Successfully embedded all chunks.")

        # 3. Safely insert into the DB preventing race conditions
        async with db_lock:
            for chunk, vector in zip(chunks, vectors):
                # Generates a guaranteed unique 64-bit integer
                item_id = int(uuid.uuid4().int >> 64)

                item = VectorItem(
                    id=item_id, metadata=chunk, category=request.category, embedding=vector
                )
                vector_db.insert(item)
                
        logger.info(f"Successfully ingested {len(chunks)} chunks into the database.")
        return {"message": f"Successfully ingested document into {len(chunks)} searchable chunks."}

    except Exception as e:
        logger.error(f"Ingestion pipeline failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")


@router.post("/ask")
async def ask_question(request: schemas.AskRequest) -> Any:
    """
    Advanced RAG: Embeds -> Broad HNSW Search -> Cross-Encoder Re-Ranking -> CoT LLM Stream
    """
    logger.info(f"RAG Question received: '{request.question}'")
    try:
        question_vector = await embedder.embed_text(request.question)
    except Exception as e:
        logger.error(f"Failed to embed user question: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to embed question: {e}")

    try:
        # 1. BROAD SEARCH: Ask HNSW for 10 results instead of just 'k'
        broad_k = max(10, request.k * 2)
        raw_results = vector_db.search(np.array(question_vector, dtype=float), k=broad_k)
        broad_chunks = [result.item.metadata for result in raw_results]
        logger.debug(f"Broad search retrieved {len(broad_chunks)} chunks. Beginning Re-ranking.")

        # 2. RE-RANKING: Let the Cross-Encoder score and filter down to exactly 'k' results
        best_chunks = cross_encoder.rerank(request.question, broad_chunks, top_n=request.k)
        logger.info(f"Successfully re-ranked and selected top {request.k} context chunks.")

    except Exception as e:
        logger.error(f"RAG Database search or reranking failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database search failed: {e}")

    # 3. Stream the LLM response (Chain-of-Thought!)
    logger.info("Initializing LLM Chain-of-Thought stream...")
    return StreamingResponse(
        llm_generator.generate_stream(request.question, best_chunks), 
        media_type="text/event-stream"
    )