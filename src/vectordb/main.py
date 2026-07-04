from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from vectordb.api.routes import router
import vectordb.api.state as state
from vectordb.core.logger import logger

DB_FILEPATH = "vector_database.pkl"

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Server booting up... Database already loaded at import time.")
    yield
    logger.info("Shutdown signal received! Saving database to disk securely...")
    try:
        state.vector_db.save(DB_FILEPATH)
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
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)