import json
import math
import os
from pathlib import Path

from core.indexes.base import BaseIndex, DuplicateVectorID
from core.logger import logger
from core.storage import sync_directory
from core.types import VectorItem


class WriteAheadLog:
    """
    Ensures Database Durability. Logs every INSERT and DELETE operation to disk 
    BEFORE modifying the in-memory graph. Used for crash recovery.
    """
    
    def __init__(self, filepath: str = "vector_database.wal"):
        self.filepath = filepath
        self._failed = False

    def _check_writable(self):
        if self._failed:
            raise OSError("WAL write failed; restart and recover before further mutations.")

    def _append(self, record):
        self._check_writable()
        encoded = (json.dumps(record, allow_nan=False) + "\n").encode("utf-8")
        existed = Path(self.filepath).exists()
        try:
            with open(self.filepath, "a+b") as stream:
                stream.seek(0, os.SEEK_END)
                previous_size = stream.tell()
                try:
                    stream.write(encoded)
                    stream.flush()
                    os.fsync(stream.fileno())
                except Exception:
                    # An unsuccessful append must not leave a partial record. Even if
                    # rollback succeeds, stop writes until recovery resolves durability.
                    stream.seek(previous_size)
                    stream.truncate()
                    stream.flush()
                    os.fsync(stream.fileno())
                    raise
            if not existed:
                sync_directory(Path(self.filepath).parent)
        except Exception:
            self._failed = True
            raise

    def log_insert(self, item: VectorItem) -> None:
        """Appends an INSERT operation to the WAL."""
        self._append({"op": "INSERT", "item": item.model_dump()})

    def log_delete(self, item_id: int) -> None:
        """Appends a DELETE operation to the WAL."""
        self._append({"op": "DELETE", "item_id": item_id})

    def replay(self, index: BaseIndex) -> None:
        """Replays the WAL on the given index to restore unsaved state."""
        if not os.path.exists(self.filepath):
            return
        
        logger.info(f"Replaying Write-Ahead Log from {self.filepath}...")
        operations_applied = 0
        
        with open(self.filepath, "r", encoding="utf-8") as f:
            for number, line in enumerate(f, start=1):
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                    if not line.endswith("\n"):
                        raise ValueError("Incomplete WAL record.")
                    if record["op"] == "INSERT":
                        # Restore the VectorItem and insert it back into the index
                        item = VectorItem(**record["item"])
                        dimensions = getattr(index, "dimensions", getattr(index, "dims", None))
                        if ((dimensions is not None and len(item.embedding) != dimensions)
                                or not all(math.isfinite(value) for value in item.embedding)):
                            raise ValueError("Invalid WAL embedding.")
                        existing = index.get_item(item.id)
                        if existing is not None:
                            if existing.model_dump() != item.model_dump():
                                raise DuplicateVectorID("Conflicting vector identity in WAL.")
                        elif not index.contains_id(item.id):
                            index.insert(item)
                    elif record["op"] == "DELETE":
                        if type(record["item_id"]) is not int:
                            raise ValueError("Invalid WAL identity.")
                        index.remove(record["item_id"])
                    else:
                        raise ValueError("Unknown WAL operation.")
                    operations_applied += 1
                except DuplicateVectorID:
                    raise
                except Exception as e:
                    raise ValueError(
                        f"Invalid WAL record at line {number}; recovery aborted."
                    ) from e
                
        logger.info(f"Successfully replayed {operations_applied} operations from WAL.")

    def clear(self) -> None:
        """
        Clears the WAL. This should ONLY be called immediately after 
        the main database has successfully saved its state to the .pkl file.
        """
        self._check_writable()
        if os.path.exists(self.filepath):
            os.remove(self.filepath)
            sync_directory(Path(self.filepath).parent)
            logger.info("Write-Ahead Log cleared after successful DB snapshot.")
