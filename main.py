from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI

# Import your routes, state, and logger
from vectordb.api.routes import router
from vectordb.api.state import vector_db
from vectordb.core.logger import logger

# The permanent file where your database will live on your hard drive
DB_FILEPATH = "vector_database.pkl"

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # STARTUP LOGIC
    logger.info("Server booting up... Attempting to load database from disk.")
    try:
        vector_db.load(DB_FILEPATH)
    except Exception as e:
        logger.error(f"Failed to load database: {e}")
        
    # The server runs while it is 'yielding'
    yield
    
    # SHUTDOWN LOGIC
    logger.info("Shutdown signal received! Saving database to disk securely...")
    try:
        vector_db.save(DB_FILEPATH)
        logger.info("Database saved safely. Goodbye!")
    except Exception as e:
        logger.error(f"CRITICAL ERROR: Failed to save database: {e}")

# Initialize FastAPI with the lifespan manager
app = FastAPI(
    title="Custom Vector DB & RAG API",
    description="A high-performance Vector Database built from scratch.",
    version="1.0.0",
    lifespan=lifespan
)

# Attach your API endpoints
app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    # We use reload=False in production, but keep it True for testing
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)