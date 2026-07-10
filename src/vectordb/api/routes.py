import uuid
from typing import Any
import io

import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import pypdf

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
    item_id = request.id if request.id is not None else int(uuid.uuid4().int >> 64)
    logger.info(f"Incoming insert request for Document ID: {item_id}")

    try:
        embedding = request.embedding
        if not embedding:
            embedding = await embedder.embed_text(request.payload)

        item = VectorItem(
            id=item_id,
            metadata=request.payload,
            category=request.category,
            embedding=embedding,
        )

        async with state.db_lock:
            state.wal.log_insert(item)
            state.vector_db.insert(item)
            logger.debug(f"Successfully inserted VectorItem {item_id}.")

        return {"status": "success", "message": f"Successfully inserted item {item_id}"}
    except Exception as e:
        logger.error(f"Insertion failed for ID {item_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Insertion failed: {str(e)}")

@router.delete("/vectors/all", status_code=200)
async def clear_database() -> dict[str, Any]:
    """Clears the entire database."""
    async with state.db_lock:
        total = state.vector_db.size()
        state.vector_db = state.build_engine(state.ACTIVE_ALGORITHM, state.ACTIVE_METRIC)
        state.wal.clear()
        logger.info(f"Database cleared. {total} items removed.")
        return {"deleted": total, "message": "Database cleared successfully"}

@router.post("/save", status_code=200)
async def save_database() -> dict[str, Any]:
    """Saves the database to disk manually."""
    async with state.db_lock:
        try:
            state.vector_db.save(state.DB_FILE)
            state.wal.clear()
            logger.info("Database saved to disk manually.")
            return {"message": "Database saved to disk successfully."}
        except Exception as e:
            logger.error(f"Save failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")


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


@router.get("/vectors/sample", response_model=schemas.VectorSampleResponse)
async def get_vectors_sample(n: int = 2000) -> Any:
    """Returns a sample of vectors with PCA-projected 2D coordinates for canvas rendering."""
    logger.info(f"Sample vectors requested. Limit: {n}")
    from sklearn.decomposition import PCA
    import random

    async with state.db_lock:
        items = state.vector_db.get_all_items()

    # Take a random sample if we exceed n
    if len(items) > n:
        items = random.sample(items, n)

    if not items:
        return {"vectors": [], "count": state.vector_db.size()}

    embeddings = np.array([item.embedding for item in items])

    # Handle the case where we have fewer vectors than dimensions for PCA
    n_components = min(2, len(items), embeddings.shape[1] if embeddings.ndim > 1 else 2)

    if n_components < 2:
         # Fallback to random coordinates if we literally only have 1 point
         coords = np.array([[0.0, 0.0] for _ in items])
    else:
         pca = PCA(n_components=2)
         # standardize scaling between -1 and 1 approximately
         coords = pca.fit_transform(embeddings)
         max_val = np.max(np.abs(coords)) if np.max(np.abs(coords)) > 0 else 1
         coords = coords / max_val

    vectors_2d = []
    for i, item in enumerate(items):
        vectors_2d.append(schemas.VectorPoint2D(
            id=str(item.id),
            x=float(coords[i, 0]),
            y=float(coords[i, 1]),
            category=item.category,
            payload=item.metadata[:100] + "..." if len(item.metadata) > 100 else item.metadata
        ))

    return {"vectors": vectors_2d, "count": state.vector_db.size()}

@router.get("/benchmark", response_model=schemas.BenchmarkResponse)
async def get_benchmarks() -> Any:
    """Returns live performance metrics for all index algorithms via dynamic benchmark generation."""
    logger.info("Live benchmark requested.")
    import time

    async with state.db_lock:
        items = state.vector_db.get_all_items()

    if not items:
        # Fallback if DB is completely empty to avoid errors
        from vectordb.api.schemas import AlgorithmBenchmark
        algorithms = [
            AlgorithmBenchmark(name="hnsw", displayName="HNSW Graph", latencyMs=0.0, throughputQps=0.0, isActive=(state.ACTIVE_ALGORITHM == "hnsw")),
            AlgorithmBenchmark(name="kdtree", displayName="KD-Tree", latencyMs=0.0, throughputQps=0.0, isActive=(state.ACTIVE_ALGORITHM == "kdtree")),
            AlgorithmBenchmark(name="exact", displayName="Brute Force (Exact Match)", latencyMs=0.0, throughputQps=0.0, isActive=(state.ACTIVE_ALGORITHM == "exact")),
        ]
        from datetime import datetime, timezone
        return {"algorithms": algorithms, "timestamp": datetime.now(timezone.utc).isoformat()}

    # Use first available vector to run a quick test
    test_vec = np.array(items[0].embedding, dtype=float)

    def test_algo(name: str, display: str, EngineClass) -> dict[str, Any]:
        engine = EngineClass(distance_metric=state.vector_db.distance_metric, **({"dims": state.DEFAULT_DIMS} if name == "kdtree" else {"m": 16, "ef_construction": 200} if name == "hnsw" else {}))
        # Insert a subset to test latency safely
        subset = items[:min(500, len(items))]
        for item in subset:
            engine.insert(item)

        # Run 5 iterations to average
        start_time = time.perf_counter()
        for _ in range(5):
            engine.search(test_vec, k=5)
        end_time = time.perf_counter()

        avg_latency_s = (end_time - start_time) / 5
        latency_ms = avg_latency_s * 1000
        qps = 1 / avg_latency_s if avg_latency_s > 0 else 0

        from vectordb.api.schemas import AlgorithmBenchmark
        return AlgorithmBenchmark(
            name=name,
            displayName=display,
            latencyMs=round(latency_ms, 2),
            throughputQps=round(qps, 0),
            isActive=(state.ACTIVE_ALGORITHM == name)
        )

    from vectordb.core.indexes.hnsw import HNSWIndex
    from vectordb.core.indexes.kd_tree import KDTreeIndex
    from vectordb.core.indexes.brute_force import BruteForceIndex

    benchmarks = [
        test_algo("hnsw", "HNSW Graph", HNSWIndex),
        test_algo("kdtree", "KD-Tree", KDTreeIndex),
        test_algo("exact", "Brute Force (Exact Match)", BruteForceIndex)
    ]

    from datetime import datetime, timezone
    return {"algorithms": benchmarks, "timestamp": datetime.now(timezone.utc).isoformat()}


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

@router.post("/ingest/file", status_code=201)
async def ingest_file(category: str = Form(...), file: UploadFile = File(...)) -> dict[str, Any]:
    """Extracts text from a file (.txt, .md, .pdf), chunks it, embeds it, and inserts into DB."""
    logger.info(f"File ingestion request received for: {file.filename} (Category: {category})")

    text_content = ""
    try:
        content = await file.read()

        if file.filename and file.filename.lower().endswith(".pdf"):
            logger.debug("Parsing PDF file using pypdf...")
            pdf_reader = pypdf.PdfReader(io.BytesBytesIO(content) if hasattr(io, 'BytesBytesIO') else io.BytesIO(content))
            text_content = "\n".join(page.extract_text() for page in pdf_reader.pages if page.extract_text())
        else:
            logger.debug("Parsing text/markdown file...")
            text_content = content.decode("utf-8")

        if not text_content.strip():
            raise ValueError("Could not extract any text from the file.")

    except Exception as e:
        logger.error(f"File reading/parsing failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to read file. Please ensure it is a valid PDF or Text file. Error: {e}")

    try:
        chunks = chunker.split_text(text_content)
        logger.debug(f"Document successfully split into {len(chunks)} chunks.")

        vectors = await embedder.embed_batch(chunks)
        logger.debug("Successfully embedded all chunks.")

        async with state.db_lock:
            for chunk, vector in zip(chunks, vectors):
                item_id = int(uuid.uuid4().int >> 64)
                item = VectorItem(
                    id=item_id, metadata=chunk, category=category, embedding=vector
                )
                state.wal.log_insert(item)
                state.vector_db.insert(item)

        logger.info(f"Successfully ingested {len(chunks)} chunks into the database.")
        return {"message": f"Successfully ingested {file.filename} into {len(chunks)} searchable chunks."}

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
