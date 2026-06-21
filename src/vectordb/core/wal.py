import json
import os
from vectordb.core.types import VectorItem
from vectordb.core.indexes.base import BaseIndex
from vectordb.core.logger import logger

class WriteAheadLog:
    """
    Ensures Database Durability. Logs every INSERT and DELETE operation to disk 
    BEFORE modifying the in-memory graph. Used for crash recovery.
    """
    
    def __init__(self, filepath: str = "vector_database.wal"):
        self.filepath = filepath

    def log_insert(self, item: VectorItem) -> None:
        """Appends an INSERT operation to the WAL."""
        with open(self.filepath, "a") as f:
            record = {"op": "INSERT", "item": item.model_dump()}
            f.write(json.dumps(record) + "\n")

    def log_delete(self, item_id: int) -> None:
        """Appends a DELETE operation to the WAL."""
        with open(self.filepath, "a") as f:
            record = {"op": "DELETE", "item_id": item_id}
            f.write(json.dumps(record) + "\n")

    def replay(self, index: BaseIndex) -> None:
        """Replays the WAL on the given index to restore unsaved state."""
        if not os.path.exists(self.filepath):
            return
        
        logger.info(f"Replaying Write-Ahead Log from {self.filepath}...")
        operations_applied = 0
        
        with open(self.filepath, "r") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                    if record["op"] == "INSERT":
                        # Restore the VectorItem and insert it back into the index
                        item = VectorItem(**record["item"])
                        index.insert(item)
                    elif record["op"] == "DELETE":
                        index.remove(record["item_id"])
                    operations_applied += 1
                except Exception as e:
                    logger.error(f"Failed to replay WAL record: {e}")
                
        logger.info(f"Successfully replayed {operations_applied} operations from WAL.")

    def clear(self) -> None:
        """
        Clears the WAL. This should ONLY be called immediately after 
        the main database has successfully saved its state to the .pkl file.
        """
        if os.path.exists(self.filepath):
            os.remove(self.filepath)
            logger.info("Write-Ahead Log cleared after successful DB snapshot.")