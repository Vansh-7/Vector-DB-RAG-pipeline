from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import api.state as state
from api.auth_routes import router as auth_router
from api.routes import router
from config import settings
from core.logger import logger
from db.session import close_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Server booting up... Database already loaded at import time.")
    yield
    logger.info("Shutdown signal received. Saving vector database...")

    try:
        async with state.db_lock:
            state.vector_db.save(state.DB_FILE)
            state.wal.clear()

        logger.info("Vector database snapshot saved successfully.")

    except Exception as e:
        logger.error(
            f"CRITICAL ERROR: Failed to save vector database: {e}"
        )

    finally:
        try:
            await close_db()
            logger.info("PostgreSQL connection pool closed.")
        except Exception as e:
            logger.error(
                f"Failed to close PostgreSQL connection pool: {e}"
            )

    logger.info("Application shutdown complete.")


app = FastAPI(
    title="Custom Vector DB & RAG API",
    description="A high-performance Vector Database built from scratch.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")