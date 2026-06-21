import asyncio
import os

from vectordb.core.indexes.hnsw import HNSWIndex
from vectordb.core.indexes.bm25 import BM25Index
from vectordb.core.indexes.hybrid import HybridIndex
from vectordb.core.metrics import cosine_distance
from vectordb.core.wal import WriteAheadLog
from vectordb.core.logger import logger


# 1. Initialize the Global Database Engine
# We will use our advanced HNSW index as the default engine.
dense_engine = HNSWIndex(distance_metric=cosine_distance, m=16, ef_construction=200)
sparse_engine = BM25Index(k1=1.5, b=0.75)

# 2. Wrap them in the SOTA hybrid engine
vector_db = HybridIndex(dense_index=dense_engine, sparse_index=sparse_engine)

# 3. Initialize the Write-Ahead Log (WAL)
wal = WriteAheadLog(filepath="vector_database.wal")

# 4. CRASH RECOVERY BOOT SEQUENCE
DB_FILE = "vector_database.pkl"
# Note: HybridIndex automatically appends _dense and _sparse to this filename
vector_db.load(DB_FILE)

# Replay any operations that happened after the last snapshot
wal.replay(vector_db)

# 5. Initialize the Concurrency Lock
# Any operation that mutates the internal graph (like inserting or deleting)
# MUST acquire this lock first.
db_lock = asyncio.Lock()