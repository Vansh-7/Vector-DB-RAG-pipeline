import asyncio
import importlib
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi.testclient import TestClient
from test_retrieval_service import FakeIndex

import api.state as state
from auth.dependencies import get_current_user
from core.indexes.hnsw import HNSWIndex
from core.metrics import euclidean_distance
from core.types import SearchResult, VectorItem
from db.session import get_db


@pytest.fixture
def search_services(monkeypatch):
    search = importlib.import_module("services.search")
    visualization = importlib.import_module("services.visualization")
    benchmarks = importlib.import_module("services.benchmarks")
    rows = [
        (2, 2, 21, [10, 10]),
        (3, 1, 12, [100, 100]),
        (4, 1, 13, [200, 200]),
        (5, 1, 14, [300, 300]),
        (6, 1, None, [0, 0]),
        (1, 1, 11, [2, 0]),
        (7, 1, 11, [0, 2]),
    ]
    results = [
        SearchResult(
            distance=float(i),
            item=VectorItem(
                id=item_id,
                user_id=owner,
                document_id=document,
                metadata=f"text-{item_id}",
                category="test",
                embedding=embedding,
            ),
        )
        for i, (item_id, owner, document, embedding) in enumerate(rows)
    ]
    index = FakeIndex(results)
    statements = []

    async def scalars(statement):
        statements.append(statement)
        params = statement.compile().params
        assert params["status_1"] == "ready"
        return SimpleNamespace(all=lambda: [11] if params["user_id_1"] == 1 else [21])

    session = SimpleNamespace(scalars=scalars)
    monkeypatch.setattr(state, "vector_db", index)
    monkeypatch.setattr(state, "DEFAULT_DIMS", 2)
    monkeypatch.setattr(state, "pca_models", {})
    monkeypatch.setattr(state, "ACTIVE_ALGORITHM", "hnsw")
    monkeypatch.setattr(state, "ACTIVE_METRIC", "euclidean")
    monkeypatch.setattr(search.embedder, "embed_text", AsyncMock(return_value=[2.0, 0.0]))
    return search, visualization, benchmarks, session, index, statements


def test_search_preserves_raw_results_order_distance_k_and_tenant_scope(search_services):
    search, _, _, session, index, _ = search_services
    result = asyncio.run(search.search_vectors([2.0, 0.0], 2, 1, session))
    assert [row.item.id for row in result] == [6, 1]
    assert [row.distance for row in result] == [4.0, 5.0]
    assert index.search_calls[0][0].tolist() == [2.0, 0.0]
    assert index.search_calls[0][1] == 7
    bob = asyncio.run(search.search_vectors([10.0, 10.0], 2, 2, session))
    assert [row.item.id for row in bob] == [2]


def test_raw_dimension_validation_precedes_ready_lookup(search_services):
    search, _, _, session, _, statements = search_services
    with pytest.raises(search.DomainError) as error:
        asyncio.run(search.search_vectors([1.0], 2, 1, session))
    assert error.value.kind == "invalid"
    assert statements == []


def test_text_search_uses_visualizations_shared_projection(search_services):
    search, visualization, _, session, _, _ = search_services
    sample = asyncio.run(visualization.get_vectors_sample(2000, 1, session))
    result = asyncio.run(search.search_vectors_by_text("query", 2, 1, session))
    assert [row.item.id for row in result["results"]] == [6, 1]
    assert result["query_vector"] == [2.0, 0.0]
    point = next(point for point in sample["vectors"] if point["id"] == "1")
    assert result["query_2d"] == pytest.approx([point["x"], point["y"]])


@pytest.mark.parametrize(
    "failure,kind", [("embed", "unavailable"), ("dimension", "internal"), ("index", "internal")]
)
def test_text_search_preserves_failure_categories(search_services, monkeypatch, failure, kind):
    search, _, _, session, index, _ = search_services
    if failure == "embed":
        monkeypatch.setattr(search.embedder, "embed_text", AsyncMock(side_effect=RuntimeError()))
    elif failure == "dimension":
        monkeypatch.setattr(search.embedder, "embed_text", AsyncMock(return_value=[1.0]))
    else:
        monkeypatch.setattr(index, "search", lambda *args, **kw: 1 / 0)
    with pytest.raises(search.DomainError) as error:
        asyncio.run(search.search_vectors_by_text("query", 2, 1, session))
    assert error.value.kind == kind


@pytest.mark.parametrize("n,count", [(0, 1), (1, 1), (2000, 3), (10000, 3)])
def test_visualization_is_scoped_and_preserves_sampling_and_payload(search_services, n, count):
    _, visualization, _, session, _, _ = search_services
    result = asyncio.run(visualization.get_vectors_sample(n, 1, session))
    assert set(result) == {"vectors", "count"}
    assert result["count"] == 3
    assert len(result["vectors"]) == count
    assert {point["id"] for point in result["vectors"]} <= {"6", "1", "7"}
    assert all(set(point) == {"id", "x", "y", "category", "payload"} for point in result["vectors"])


def test_visualization_upper_sampling_bound_is_5000(search_services, monkeypatch):
    _, visualization, _, session, index, _ = search_services
    item = index.results[-1]
    index.results = [item, index.results[-2]] * 2500 + [item]
    seen = []

    def sample(items, n):
        seen.append(n)
        return items[:n]

    monkeypatch.setattr(visualization.random, "sample", sample)
    result = asyncio.run(visualization.get_vectors_sample(10000, 1, session))
    assert seen == [5000]
    assert len(result["vectors"]) == 5000
    assert result["count"] == 5001


def test_visualization_payload_truncation_and_zero_scale_are_preserved(search_services):
    _, visualization, _, session, index, _ = search_services
    for result in index.results:
        result.item.metadata = "a" * 101
        result.item.embedding = [1.0, 1.0]
    with pytest.warns(RuntimeWarning, match="invalid value encountered in divide"):
        result = asyncio.run(visualization.get_vectors_sample(2000, 1, session))
    assert all(point["payload"] == "a" * 100 + "..." for point in result["vectors"])
    assert all(point["x"] == point["y"] == 0 for point in result["vectors"])
    assert state.pca_models[1][1] == 1.0


def test_benchmark_uses_only_eligible_items_and_runs_off_thread(search_services, monkeypatch):
    _, _, benchmarks, session, _, _ = search_services
    inserted = []
    searched = []
    main_thread = threading.get_ident()

    def build(algorithm, metric):
        assert threading.get_ident() != main_thread
        assert metric == "euclidean"
        owned = []
        inserted.append((algorithm, owned))

        def query(vector, k):
            searched.append((algorithm, vector.tolist(), k))
            return []

        return SimpleNamespace(insert=lambda item: owned.append(item.id), search=query)

    monkeypatch.setattr(state, "build_engine", build)
    result = asyncio.run(benchmarks.get_benchmarks(None, 1, session))
    assert inserted == [("hnsw", [6, 1, 7]), ("kdtree", [6, 1, 7]), ("exact", [6, 1, 7])]
    assert len(searched) == 15
    assert all(query == [0.0, 0.0] and k == 3 for _, query, k in searched)
    assert [row["name"] for row in result["algorithms"]] == ["hnsw", "kdtree", "exact"]
    assert [row["isActive"] for row in result["algorithms"]] == [True, False, False]
    assert all(
        set(row) == {"name", "displayName", "latencyMs", "throughputQps", "isActive"}
        for row in result["algorithms"]
    )
    assert set(result) == {"algorithms", "timestamp", "topology"}


def test_empty_benchmark_preserves_zero_results_without_embedding(search_services, monkeypatch):
    _, _, benchmarks, session, index, _ = search_services
    index.results = []
    embed = AsyncMock(side_effect=AssertionError("must not embed empty index"))
    monkeypatch.setattr(benchmarks.embedder, "embed_text", embed)
    result = asyncio.run(benchmarks.get_benchmarks("query", 1, session))
    assert [(row["latencyMs"], row["throughputQps"]) for row in result["algorithms"]] == [
        (0, 0)
    ] * 3
    assert result["topology"] is None
    embed.assert_not_awaited()


def test_benchmark_embedding_failure_remains_unavailable(search_services, monkeypatch):
    _, _, benchmarks, session, _, _ = search_services
    monkeypatch.setattr(benchmarks.embedder, "embed_text", AsyncMock(side_effect=RuntimeError()))
    with pytest.raises(benchmarks.DomainError) as error:
        asyncio.run(benchmarks.get_benchmarks("query", 1, session))
    assert error.value.kind == "unavailable"


def test_benchmark_workload_cap_and_inverse_latency_calculation(search_services, monkeypatch):
    _, _, benchmarks, _, index, _ = search_services
    counts = []
    calls = []

    def build(algorithm, metric):
        items = []
        counts.append(items)
        return SimpleNamespace(
            insert=items.append, search=lambda query, k: calls.append((algorithm, k))
        )

    monkeypatch.setattr(state, "build_engine", build)
    times = iter([0.0, 0.01, 1.0, 1.01, 2.0, 2.01])
    monkeypatch.setattr(benchmarks.time, "perf_counter", lambda: next(times))
    rows, topology = benchmarks._run_benchmark_suite(
        [index.results[-1].item] * 5001, np.zeros(2), "exact", "cosine"
    )
    assert [len(items) for items in counts] == [5000, 5000, 5000]
    assert len(calls) == 15 and all(k == 5 for _, k in calls)
    assert all(row["latencyMs"] == 2.0 and row["throughputQps"] == 500 for row in rows)
    assert topology is None


def test_hnsw_topology_fields_stay_user_scoped(search_services, monkeypatch):
    _, _, benchmarks, session, _, _ = search_services
    original = state.build_engine

    def build(algorithm, metric):
        if algorithm == "hnsw":
            return HNSWIndex(euclidean_distance)
        return original(algorithm, metric)

    monkeypatch.setattr(state, "build_engine", build)
    result = asyncio.run(benchmarks.get_benchmarks(None, 1, session))
    assert result["topology"][0]["nodes"] == 3
    assert all(set(layer) == {"level", "nodes", "edges"} for layer in result["topology"])


@pytest.mark.parametrize(
    "path,body,code,detail",
    [
        (
            "/api/v1/search",
            {"embedding": [1.0]},
            400,
            "Embedding must contain exactly 2 dimensions.",
        ),
        ("/api/v1/search/text", {"text": "query"}, 503, "Embedding service is unavailable."),
    ],
)
def test_search_http_error_contract(search_services, monkeypatch, path, body, code, detail):
    from main import app

    search, _, _, session, _, _ = search_services
    monkeypatch.setattr(search.embedder, "embed_text", AsyncMock(side_effect=RuntimeError()))
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    app.dependency_overrides[get_db] = lambda: session
    try:
        response = TestClient(app).post(path, json=body)
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == code
    assert response.json() == {"detail": detail}
