from fastapi import APIRouter

from api.routers import (
    auth,
    benchmarks,
    conversations,
    documents,
    engine,
    ingestion,
    rag,
    search,
    vectors,
    visualization,
)

router = APIRouter()

# Preserve the original interleaved V1 route registration order.
router.include_router(documents.router)
router.include_router(vectors.router)
router.include_router(engine.snapshot_router)
router.include_router(search.router)
router.include_router(visualization.router)
router.include_router(benchmarks.router)
router.include_router(engine.router)
router.include_router(ingestion.router)
router.include_router(rag.router)
router.include_router(auth.router)
router.include_router(conversations.router)
