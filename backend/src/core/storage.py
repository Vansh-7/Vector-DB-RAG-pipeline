"""Local filesystem commit primitives used under the existing vector lock."""

import errno
import os
import tempfile
from pathlib import Path


def sync_directory(path):
    # Windows does not expose a portable directory fsync through Python's os API.
    if os.name == "nt":
        return
    try:
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    except OSError as exc:
        if exc.errno not in {errno.EINVAL, errno.ENOTSUP}:
            raise


def atomic_write(filepath, serialize):
    destination = Path(filepath)
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent
    )
    try:
        with os.fdopen(descriptor, "wb") as stream:
            serialize(stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
        sync_directory(destination.parent)
    finally:
        # Remove only this operation's exact temporary path, never other recovery files.
        Path(temporary).unlink(missing_ok=True)
