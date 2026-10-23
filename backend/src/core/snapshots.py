"""Versioned snapshots of trusted local vector state, never uploaded pickle files."""

import pickle
from pathlib import Path

import numpy as np

from core.metrics import cosine_distance, euclidean_distance, manhattan_distance
from core.storage import atomic_write
from core.types import VectorItem

METRICS = {
    "cosine": cosine_distance,
    "euclidean": euclidean_distance,
    "manhattan": manhattan_distance,
}
FORMAT = "neuebit.vector.snapshot"


class SnapshotError(ValueError):
    """Persistence could not be validated; serving an empty index is unsafe."""


def metric_name(index):
    for name, function in METRICS.items():
        if index.distance_metric is function:
            return name
    raise SnapshotError("Snapshot uses an unsupported distance metric.")


def save_snapshot(index, filepath):
    state = index._snapshot_state()
    items = (
        [node.item for node in state["nodes"].values()]
        if index.algorithm == "hnsw"
        else list(state["items"].values())
    )
    dimensions = getattr(
        index, "dims", getattr(index, "dimensions", len(items[0].embedding) if items else 768)
    )
    envelope = {
        "format": FORMAT,
        "version": 1,
        "algorithm": index.algorithm,
        "metric": metric_name(index),
        "dimensions": dimensions,
        "state": state,
    }
    validate_snapshot(envelope)
    atomic_write(
        filepath, lambda stream: pickle.dump(envelope, stream, protocol=pickle.HIGHEST_PROTOCOL)
    )


def validate_snapshot(envelope):
    try:
        if envelope["format"] != FORMAT or type(envelope["version"]) is not int:
            raise ValueError("Invalid snapshot format.")
        if envelope["version"] != 1:
            raise ValueError("Unsupported snapshot version.")
        algorithm, metric, dims = (
            envelope["algorithm"],
            envelope["metric"],
            envelope["dimensions"],
        )
        if algorithm not in {"hnsw", "kdtree", "exact"} or metric not in METRICS:
            raise ValueError("Unsupported snapshot engine or metric.")
        if type(dims) is not int or dims < 1:
            raise ValueError("Invalid snapshot dimensions.")
        saved = envelope["state"]
        tombstones = saved["tombstones"]
        if not isinstance(tombstones, set) or any(type(i) is not int for i in tombstones):
            raise ValueError("Invalid retired identities.")
        records = saved["nodes"] if algorithm == "hnsw" else saved["items"]
        if not isinstance(records, dict):
            raise ValueError("Invalid snapshot records.")
        for identity, value in records.items():
            item = value.item if algorithm == "hnsw" else value
            if type(identity) is not int or not isinstance(item, VectorItem) or item.id != identity:
                raise ValueError("Invalid vector identity.")
            if len(item.embedding) != dims or not np.isfinite(item.embedding).all():
                raise ValueError("Invalid persisted embedding.")
            if algorithm != "hnsw" and identity in tombstones:
                raise ValueError("Active vector also marked deleted.")
        if algorithm == "hnsw":
            if type(saved.get("m", 16)) is not int or saved.get("m", 16) < 2:
                raise ValueError("Invalid graph connection limit.")
            if (
                type(saved.get("ef_construction", 200)) is not int
                or saved.get("ef_construction", 200) < 1
            ):
                raise ValueError("Invalid graph construction width.")
            entry, top = saved["entry_point_id"], saved["top_layer"]
            if records:
                if entry not in records or type(top) is not int or top < 0:
                    raise ValueError("Invalid graph entry point.")
                if records[entry].max_layer != top:
                    raise ValueError("Invalid graph top layer.")
            elif entry is not None or top != -1:
                raise ValueError("Invalid empty graph.")
            for node in records.values():
                if type(node.max_layer) is not int or not 0 <= node.max_layer <= top:
                    raise ValueError("Invalid graph node layer.")
                if len(node.neighbors) < node.max_layer + 1:
                    raise ValueError("Invalid graph adjacency.")
                if any(neighbor not in records for layer in node.neighbors for neighbor in layer):
                    raise ValueError("Missing graph neighbor.")
        return envelope
    except (KeyError, TypeError, AttributeError, ValueError) as exc:
        raise SnapshotError(f"Invalid vector snapshot: {exc}") from exc


def read_snapshot(filepath, *, legacy_algorithm=None, legacy_metric=None, dimensions=768):
    try:
        with open(filepath, "rb") as stream:
            saved = pickle.load(stream)
            if stream.read(1):
                raise SnapshotError("Unexpected trailing snapshot data.")
        if not isinstance(saved, dict):
            raise SnapshotError("Unsupported vector snapshot.")
        if "format" in saved:
            return validate_snapshot(saved)
        if not legacy_algorithm or not legacy_metric:
            raise SnapshotError(
                "Legacy snapshots require LEGACY_VECTOR_ALGORITHM and LEGACY_VECTOR_METRIC."
            )
        is_graph = "nodes" in saved
        if is_graph != (legacy_algorithm == "hnsw"):
            raise SnapshotError("Legacy snapshot does not match LEGACY_VECTOR_ALGORITHM.")
        if is_graph:
            body = dict(saved)
            body.setdefault("tombstones", set())
            items = [node.item for node in saved["nodes"].values()]
        else:
            body = saved if "items" in saved else {"items": saved, "tombstones": set()}
            items = list(body["items"].values())
        inferred_dims = len(items[0].embedding) if items else dimensions
        return validate_snapshot(
            {
                "format": FORMAT,
                "version": 1,
                "algorithm": legacy_algorithm,
                "metric": legacy_metric,
                "dimensions": inferred_dims,
                "state": body,
            }
        )
    except SnapshotError:
        raise
    except Exception as exc:
        raise SnapshotError("Vector snapshot could not be read; original file preserved.") from exc


def load_snapshot(index, filepath):
    if not Path(filepath).exists():
        return
    saved = read_snapshot(
        filepath,
        legacy_algorithm=index.algorithm,
        legacy_metric=metric_name(index),
        dimensions=getattr(index, "dims", 768),
    )
    if saved["algorithm"] != index.algorithm:
        raise SnapshotError("Snapshot belongs to a different vector engine.")
    arguments = {"distance_metric": METRICS[saved["metric"]]}
    if index.algorithm == "kdtree":
        arguments["dims"] = saved["dimensions"]
    temporary = type(index)(**arguments)
    temporary.dimensions = saved["dimensions"]
    temporary._restore_state(saved["state"])
    index.__dict__.update(temporary.__dict__)
