import uuid
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from vectordb.ai.chunker import chunker
from vectordb.ai.embedder import embedder
from vectordb.ai.generator import llm_generator
from vectordb.ai.reranker import cross_encoder

from vectordb.api import schemas
import vectordb.api.state as state
from vectordb.core.types import VectorItem
from vectordb.core.logger import logger

router = APIRouter()


@router.post("/insert", status_code=201)
async def insert_vector(request: schemas.InsertRequest) -> dict[str, Any]:
    """Inserts a new vector into the active index."""
    logger.info(f"Incoming insert request for Document ID: {request.id}")
    item = VectorItem(
        id=request.id,
        metadata=request.metadata,
        category=request.category,
        embedding=request.embedding,
    )

    async with state.db_lock:
        try:
            state.wal.log_insert(item)
            state.vector_db.insert(item)
            logger.debug(f"Successfully inserted VectorItem {request.id}.")
        except Exception as e:
            logger.error(f"Insertion failed for ID {request.id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Insertion failed: {str(e)}")

    return {"status": "success", "message": f"Successfully inserted item {request.id}"}


@router.post("/search", response_model=list[schemas.SearchResultItem])
async def search_vectors(request: schemas.SearchRequest) -> Any:
    """Queries the active index for the top-K nearest neighbors."""
    logger.info(f"Search request received. Fetching top {request.k} neighbors.")

    query_arr = np.array(request.embedding, dtype=float)

    try:
        results = state.vector_db.search(query_arr, k=request.k)
        logger.debug(f"Search completed successfully. Found {len(results)} results.")
    except Exception as e:
        logger.error(f"Database search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

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



@router.post("/search/text", response_model=list[schemas.SearchResultItem])
async def search_vectors_by_text(request: schemas.TextSearchRequest) -> Any:
    logger.info(f"Text search request received. Fetching top {request.k} neighbors.")
    try:
        query_vector = await embedder.embed_text(request.text)
    except Exception as e:
        logger.error(f"Failed to embed text query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to embed query: {e}")

    query_arr = np.array(query_vector, dtype=float)

    try:
        results = state.vector_db.search(query_arr, k=request.k)
    except Exception as e:
        logger.error(f"Database search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

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
    return {
        "engine": state.ACTIVE_ALGORITHM,
        "metric": state.ACTIVE_METRIC,
        "total_docs": state.vector_db.size(),
    }


@router.post("/engine/configure")
async def configure_engine(algorithm: str, metric: str) -> dict[str, Any]:
    """
    Switches the active index algorithm and distance metric.
    Re-inserts all existing items into the new engine.
    """
    if algorithm not in ("hnsw", "kdtree", "exact"):
        raise HTTPException(400, f"Unknown algorithm: {algorithm}")
    if metric not in state.METRICS:
        raise HTTPException(400, f"Unknown metric: {metric}")

    async with state.db_lock:
        old_items = state.vector_db.get_all_items()
        new_engine = state.build_engine(algorithm, metric)
        for item in old_items:
            new_engine.insert(item)
        state.vector_db = new_engine
        state.ACTIVE_ALGORITHM = algorithm
        state.ACTIVE_METRIC = metric

    logger.info(f"Engine reconfigured: {algorithm} / {metric} ({len(old_items)} items re-inserted)")
    return {"algorithm": algorithm, "metric": metric, "total_docs": state.vector_db.size()}


@router.post("/ingest", status_code=201)
async def ingest_document(request: schemas.IngestRequest) -> dict[str, Any]:
    """Chunks text, embeds it, and inserts it into the active DB."""
    logger.info(f"Ingestion request received for category: {request.category}")
    try:
        chunks = chunker.split_text(request.text)
        logger.debug(f"Document successfully split into {len(chunks)} chunks.")

        vectors = await embedder.embed_batch(chunks)
        logger.debug("Successfully embedded all chunks.")

        async with state.db_lock:
            for chunk, vector in zip(chunks, vectors):
                item_id = int(uuid.uuid4().int >> 64)

                item = VectorItem(
                    id=item_id, metadata=chunk, category=request.category, embedding=vector
                )

                state.wal.log_insert(item)
                state.vector_db.insert(item)

        logger.info(f"Successfully ingested {len(chunks)} chunks into the database.")
        return {"message": f"Successfully ingested document into {len(chunks)} searchable chunks."}

    except Exception as e:
        logger.error(f"Ingestion pipeline failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")


@router.post("/ask")
async def ask_question(request: schemas.AskRequest) -> Any:
    """
    Advanced RAG: Embeds -> Broad Search -> Cross-Encoder Re-Ranking -> CoT LLM Stream
    """
    logger.info(f"RAG Question received: '{request.question}'")
    try:
        question_vector = await embedder.embed_text(request.question)
    except Exception as e:
        logger.error(f"Failed to embed user question: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to embed question: {e}")

    try:
        broad_k = max(10, request.k * 2)
        raw_results = state.vector_db.search(
            np.array(question_vector, dtype=float),
            k=broad_k,
        )
        broad_chunks = [result.item.metadata for result in raw_results]
        logger.debug(f"Broad search retrieved {len(broad_chunks)} chunks. Beginning Re-ranking.")

        best_chunks = cross_encoder.rerank(request.question, broad_chunks, top_n=request.k)
        logger.info(f"Successfully re-ranked and selected top {request.k} context chunks.")

    except Exception as e:
        logger.error(f"RAG Database search or reranking failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database search failed: {e}")

    logger.info("Initializing LLM Chain-of-Thought stream...")
    return StreamingResponse(
        llm_generator.generate_stream(request.question, best_chunks),
        media_type="text/event-stream"
    )
