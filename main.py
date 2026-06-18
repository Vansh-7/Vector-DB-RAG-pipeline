import uvicorn
from fastapi import FastAPI
from vectordb.api.routes import router as api_router

# Initialize the FastAPI Application
app = FastAPI(
    title="Custom Vector DB API",
    description="An end-to-end asynchronous Vector Database API powered by a custom HNSW engine.",
    version="0.1.0"
)

# Mount our specific API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def health_check():
    """A simple welcome page."""
    return {
        "message": "Vector DB is running smoothly.",
        "docs": "Navigate to /docs for the interactive Swagger UI."
    }

def main():
    """
    Entry point for running the server locally via `uv run main.py`.
    """
    print("Starting Vector DB Server on http://localhost:8000")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()