import asyncio

from vectordb.core.indexes.hnsw import HNSWIndex
from vectordb.core.metrics import cosine_distance

# 1. Initialize the Global Database Engine
# We will use our advanced HNSW index as the default engine.
vector_db = HNSWIndex(distance_metric=cosine_distance, m=16, ef_construction=200)

# 2. Initialize the Concurrency Lock
# Any operation that mutates the internal graph (like inserting or deleting)
# MUST acquire this lock first.
db_lock = asyncio.Lock()