import asyncio
import errno
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

import api.state as state
from core import snapshots
from core.recovery import build_engine, recover_engine
from core.types import VectorItem
from core.wal import WriteAheadLog
from services import engine as engine_service
from services.errors import DomainError


def item(identity=1, owner=1):
    return VectorItem(
        id=identity,
        user_id=owner,
        document_id=owner + 10,
        embedding=[1, 0, 0],
        metadata="owned",
        category="test",
    )


@pytest.fixture(params=["hnsw", "kdtree", "exact"])
def storage(request, tmp_path, monkeypatch):
    index = build_engine(request.param, "euclidean", 3)
    index.insert(item())
    snapshot, wal_path = tmp_path / "vectors.pkl", tmp_path / "vectors.wal"
    index.save(str(snapshot))
    wal = WriteAheadLog(str(wal_path))
    wal.log_insert(item(2, 2))
    index.insert(item(2, 2))
    monkeypatch.setattr(state, "vector_db", index)
    monkeypatch.setattr(state, "wal", wal)
    monkeypatch.setattr(state, "DB_FILE", str(snapshot))
    return index, snapshot, wal_path, request.param


@pytest.mark.parametrize("failure", ["serialize", "disk-full", "permission", "replace", "sync"])
def test_failed_snapshot_preserves_wal_and_previous_snapshot(storage, monkeypatch, failure):
    _, snapshot, wal_path, _ = storage
    previous, previous_wal = snapshot.read_bytes(), wal_path.read_bytes()

    def fail(*args, **kwargs):
        if failure == "serialize":
            args[1].write(b"partial pickle")
        raise OSError(errno.ENOSPC if failure == "disk-full" else errno.EACCES, "simulated")

    if failure == "serialize":
        monkeypatch.setattr(snapshots.pickle, "dump", fail)
    elif failure == "replace":
        monkeypatch.setattr(os, "replace", fail)
    elif failure == "sync":
        monkeypatch.setattr(os, "fsync", fail)
    else:
        import tempfile

        monkeypatch.setattr(tempfile, "mkstemp", fail)
    with pytest.raises(DomainError, match="Database snapshot failed"):
        asyncio.run(engine_service.save_database(1))
    assert snapshot.read_bytes() == previous
    assert wal_path.read_bytes() == previous_wal
    assert sorted(p.name for p in snapshot.parent.iterdir()) == ["vectors.pkl", "vectors.wal"]


def test_atomic_save_orders_file_sync_replace_directory_sync_then_wal_clear(storage, monkeypatch):
    _, snapshot, wal_path, _ = storage
    from core import storage as disk_storage

    events = []
    real_sync, real_replace = os.fsync, os.replace

    def sync(fd):
        events.append("file-sync")
        real_sync(fd)

    def replace(source, destination):
        assert Path(source).parent == snapshot.parent
        assert Path(source) != snapshot
        assert wal_path.exists()
        events.append("replace")
        real_replace(source, destination)

    def parent_sync(path):
        events.append("directory-sync")

    monkeypatch.setattr(os, "fsync", sync)
    monkeypatch.setattr(os, "replace", replace)
    monkeypatch.setattr(disk_storage, "sync_directory", parent_sync)
    asyncio.run(engine_service.save_database(1))
    assert events[:3] == ["file-sync", "replace", "directory-sync"]
    assert not wal_path.exists()
    recovered, _, _ = recover_engine(str(snapshot), str(wal_path), dimensions=3)
    assert [(record.id, record.user_id) for record in recovered.get_all_items()] == [(1, 1), (2, 2)]


def test_interrupted_temporary_snapshot_is_not_used_for_recovery(storage):
    _, snapshot, wal_path, algorithm = storage
    snapshot.with_name(".vectors.pkl.interrupted.tmp").write_bytes(b"partial")
    recovered, name, _ = recover_engine(str(snapshot), str(wal_path), dimensions=3)
    assert name == algorithm
    assert [(record.id, record.user_id) for record in recovered.get_all_items()] == [(1, 1), (2, 2)]


@pytest.mark.parametrize("operation", ["insert", "delete"])
def test_crash_after_synced_wal_before_memory_mutation(storage, operation):
    _, snapshot, wal_path, _ = storage
    wal = WriteAheadLog(str(wal_path))
    if operation == "insert":
        wal.log_insert(item(3))
    else:
        wal.log_delete(1)
    restored, _, _ = recover_engine(str(snapshot), str(wal_path), dimensions=3)
    expected = [(1, 1), (2, 2), (3, 1)] if operation == "insert" else [(2, 2)]
    assert [(record.id, record.user_id) for record in restored.get_all_items()] == expected
    assert wal_path.exists()


@pytest.mark.parametrize(
    "record",
    [
        b'{"op":"INSERT"',
        b'{"op":"UNKNOWN"}\n',
        b'{"op":"DELETE","item_id":"bad"}\n',
        b'{"op":"INSERT","item":{}}\n',
    ],
)
def test_invalid_wal_aborts_recovery_and_is_preserved(storage, record):
    _, snapshot, wal_path, _ = storage
    with wal_path.open("ab") as stream:
        stream.write(record)
    before = wal_path.read_bytes()
    with pytest.raises(ValueError, match="WAL"):
        recover_engine(str(snapshot), str(wal_path), dimensions=3)
    assert wal_path.read_bytes() == before


def test_wal_append_syncs_before_acknowledgment(tmp_path, monkeypatch):
    events = []
    real_fsync = os.fsync

    def sync(fd):
        events.append("sync")
        assert json.loads(Path(tmp_path / "vectors.wal").read_text())["op"] == "INSERT"
        real_fsync(fd)

    monkeypatch.setattr(os, "fsync", sync)
    WriteAheadLog(str(tmp_path / "vectors.wal")).log_insert(item())
    assert events


def test_failed_wal_sync_poison_prevents_later_acknowledgments_or_clear(tmp_path, monkeypatch):
    wal = WriteAheadLog(str(tmp_path / "vectors.wal"))
    wal.log_insert(item())
    previous = Path(wal.filepath).read_bytes()

    def fail(fd):
        raise OSError(errno.ENOSPC, "disk full")

    monkeypatch.setattr(os, "fsync", fail)
    with pytest.raises(OSError):
        wal.log_insert(item(2, 2))
    assert Path(wal.filepath).read_bytes() == previous
    with pytest.raises(OSError, match="WAL"):
        wal.log_delete(1)
    with pytest.raises(OSError, match="WAL"):
        wal.clear()
    assert Path(wal.filepath).read_bytes() == previous


def test_directory_sync_failure_after_replace_keeps_wal_for_idempotent_recovery(
    storage, monkeypatch
):
    from core import storage as disk_storage

    _, snapshot, wal_path, _ = storage
    original_wal = wal_path.read_bytes()

    def fail(path):
        raise OSError(errno.EIO, "directory sync failed")

    monkeypatch.setattr(disk_storage, "sync_directory", fail)
    with pytest.raises(DomainError):
        asyncio.run(engine_service.save_database(1))
    assert wal_path.read_bytes() == original_wal
    recovered, _, _ = recover_engine(str(snapshot), str(wal_path), dimensions=3)
    assert [(record.id, record.user_id) for record in recovered.get_all_items()] == [(1, 1), (2, 2)]


@pytest.mark.parametrize("operation", ["insert", "delete"])
def test_abrupt_process_exit_after_wal_recovers_all_engines(storage, operation):
    _, snapshot, wal_path, _ = storage
    code = """
import os, sys
from core.types import VectorItem
from core.wal import WriteAheadLog
wal = WriteAheadLog(sys.argv[1])
if sys.argv[2] == 'insert':
    wal.log_insert(VectorItem(id=3, user_id=1, document_id=11,
                             embedding=[1,0,0], metadata='owned', category='test'))
else:
    wal.log_delete(1)
os._exit(0)
"""
    subprocess.run(
        [sys.executable, "-c", code, str(wal_path), operation],
        env={
            **os.environ,
            "PYTHONPATH": str(Path(__file__).parents[1] / "src"),
            "PYTHONDONTWRITEBYTECODE": "1",
        },
        check=True,
        capture_output=True,
        timeout=30,
    )
    recovered, _, _ = recover_engine(str(snapshot), str(wal_path), dimensions=3)
    expected = [(1, 1), (2, 2), (3, 1)] if operation == "insert" else [(2, 2)]
    assert [(record.id, record.user_id) for record in recovered.get_all_items()] == expected
