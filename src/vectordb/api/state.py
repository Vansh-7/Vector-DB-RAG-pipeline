import asyncio
import os

from vectordb.core.indexes.hnsw import HNSWIndex
from vectordb.core.metrics import cosine_distance
from vectordb.core.wal import WriteAheadLog
from vectordb.core.logger import logger


# 1. Initialize the Global Database Engine
# We will use our advanced HNSW index as the default engine.
vector_db = HNSWIndex(distance_metric=cosine_distance, m=16, ef_construction=200)

# 2. Initialize the Write-Ahead Log (WAL)
wal = WriteAheadLog(filepath="vector_database.wal")

# 3. CRASH RECOVERY BOOT SEQUENCE
# First, load the base snapshot if it exists
DB_FILE = "vector_database.pkl"
if os.path.exists(DB_FILE):
    vector_db.load(DB_FILE)

# Second, replay any operations that happened after the last snapshot
wal.replay(vector_db)

# 4. Initialize the Concurrency Lock
# Any operation that mutates the internal graph (like inserting or deleting)
# MUST acquire this lock first.
db_lock = asyncio.Lock()