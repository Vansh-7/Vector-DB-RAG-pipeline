from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
import api.state as state
from core.logger import logger
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Server booting up... Database already loaded at import time.")
    yield
    logger.info("Shutdown signal received! Saving database to disk securely...")
    try:
        state.vector_db.save(state.DB_FILE)
        logger.info("Database saved safely. Goodbye!")
    except Exception as e:
        logger.error(f"CRITICAL ERROR: Failed to save database: {e}")

app = FastAPI(
    title="Custom Vector DB & RAG API",
    description="A high-performance Vector Database built from scratch.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")