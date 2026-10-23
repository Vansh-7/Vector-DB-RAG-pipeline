import asyncio
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from ai.embedder import embedder
from core.indexes.hnsw import HNSWIndex
from core.logger import logger
from core.types import VectorItem
from services.errors import DomainError
from services.retrieval import get_ready_document_ids, get_searchable_user_items


def _run_benchmark_suite(
    items: list[VectorItem], test_vec: np.ndarray, active_algorithm: str, active_metric: str
) -> tuple[list[dict[str, Any]], list[dict[str, int]] | None]:
    subset = items[: min(5000, len(items))]
    configurations = [
        ("hnsw", "HNSW Graph"),
        ("kdtree", "KD-Tree"),
        ("exact", "Brute Force (Exact Match)"),
    ]
    benchmarks: list[dict[str, Any]] = []
    hnsw_engine: HNSWIndex | None = None
    for algorithm, display_name in configurations:
        engine = state.build_engine(algorithm, active_metric)
        for item in subset:
            engine.insert(item)
        search_k = min(5, len(subset))
        start = time.perf_counter()
        for _ in range(5):
            engine.search(test_vec, k=search_k)
        elapsed = (time.perf_counter() - start) / 5
        latency_ms = elapsed * 1000
        # Preserve the existing inverse-latency estimate from five sequential queries.
        throughput_qps = 1 / elapsed if elapsed > 0 else 0
        benchmarks.append(
            {
                "name": algorithm,
                "displayName": display_name,
                "latencyMs": round(latency_ms, 2),
                "throughputQps": round(throughput_qps, 0),
                "isActive": active_algorithm == algorithm,
            }
        )
        if algorithm == "hnsw" and isinstance(engine, HNSWIndex):
            hnsw_engine = engine
    topology: list[dict[str, int]] | None = None
    if active_algorithm == "hnsw" and hnsw_engine is not None:
        layer_stats: dict[int, dict[str, int]] = {}
        for node_id, node in hnsw_engine.nodes.items():
            if node_id in hnsw_engine.tombstones:
                continue
            for level, edges in enumerate(node.neighbors):
                stats = layer_stats.setdefault(level, {"nodes": 0, "edges": 0})
                stats["nodes"] += 1
                stats["edges"] += len(edges)
        topology = [
            {
                "level": level,
                "nodes": layer_stats[level]["nodes"],
                "edges": layer_stats[level]["edges"],
            }
            for level in sorted(layer_stats)
        ]
    return (benchmarks, topology)


async def get_benchmarks(q: str | None, user_id: int, session: AsyncSession) -> dict[str, Any]:
    ready_document_ids = await get_ready_document_ids(session, user_id)
    items = await get_searchable_user_items(user_id, ready_document_ids)
    if not items:
        return {
            "algorithms": [
                {
                    "name": "hnsw",
                    "displayName": "HNSW Graph",
                    "latencyMs": 0.0,
                    "throughputQps": 0.0,
                    "isActive": state.ACTIVE_ALGORITHM == "hnsw",
                },
                {
                    "name": "kdtree",
                    "displayName": "KD-Tree",
                    "latencyMs": 0.0,
                    "throughputQps": 0.0,
                    "isActive": state.ACTIVE_ALGORITHM == "kdtree",
                },
                {
                    "name": "exact",
                    "displayName": "Brute Force (Exact Match)",
                    "latencyMs": 0.0,
                    "throughputQps": 0.0,
                    "isActive": state.ACTIVE_ALGORITHM == "exact",
                },
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "topology": None,
        }
    if q:
        try:
            query_vector = await embedder.embed_text(q)
            test_vec = np.asarray(query_vector, dtype=float)
        except Exception as exc:
            logger.exception(f"Benchmark query embedding failed user_id={user_id}: {exc}")
            raise DomainError(
                kind="unavailable", message="Embedding service is unavailable."
            ) from exc
    else:
        test_vec = np.asarray(items[0].embedding, dtype=float)
    benchmarks, topology = await asyncio.to_thread(
        _run_benchmark_suite, items, test_vec, state.ACTIVE_ALGORITHM, state.ACTIVE_METRIC
    )
    return {
        "algorithms": benchmarks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "topology": topology,
    }
