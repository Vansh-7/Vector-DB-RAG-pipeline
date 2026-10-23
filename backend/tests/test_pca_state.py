import asyncio
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock

import numpy as np
import pytest
from fastapi import HTTPException, UploadFile
from sklearn.decomposition import PCA

import api.routes as routes
import api.state as state
from api import schemas
from core.types import VectorItem
from db.models import Document
from services import documents


class FakeIndex:
    def __init__(self):
        self.items = [
            VectorItem(
                id=item_id, user_id=user_id, document_id=document_id,
                embedding=embedding, metadata=f"point-{item_id}", category="testing",
            )
            for item_id, user_id, document_id, embedding in [
                (1, 1, 11, [0.0, 0.0]), (2, 1, 11, [2.0, 0.0]), (3, 1, 11, [0.0, 2.0]),
                (4, 2, 21, [10.0, 10.0]), (5, 2, 21, [14.0, 10.0]),
                (6, 2, 21, [10.0, 14.0]), (7, 1, 12, [1000.0, 1000.0]),
            ]
        ]

    def get_all_items(self):
        return list(self.items)

    def insert(self, item):
        self.items.append(item)

    def remove(self, item_id):
        self.items = [item for item in self.items if item.id != item_id]
        return True


class FakeSession:
    def __init__(self):
        self.document = Document(
            id=11, user_id=1, name="Owned document", category="testing",
            source_type="text", status="ready", chunk_count=3,
        )

    async def scalars(self, statement):
        params = statement.compile().params
        assert params["status_1"] == "ready"
        return SimpleNamespace(all=lambda: {1: [11], 2: [21]}[params["user_id_1"]])

    async def scalar(self, statement):
        return self.document

    async def get(self, model, item_id):
        return self.document

    def add(self, document):
        document.id = 77
        self.document = document

    async def commit(self):
        pass

    async def refresh(self, item):
        pass

    async def rollback(self):
        pass

    async def delete(self, item):
        pass

    async def execute(self, statement):
        pass


@pytest.fixture
def pca_environment(monkeypatch):
    index = FakeIndex()
    monkeypatch.setattr(state, "vector_db", index)
    monkeypatch.setattr(state, "pca_models", {})
    monkeypatch.setattr(state, "wal", SimpleNamespace(log_insert=lambda item: None,
                                                    log_delete=lambda item_id: None))
    return index, FakeSession()


def _sample(session, user_id=1, n=2000):
    return asyncio.run(routes.get_vectors_sample(
        n=n, current_user=SimpleNamespace(id=user_id), session=session,
    ))


def test_visualization_fits_shared_pca_using_only_eligible_vectors(pca_environment):
    _, session = pca_environment
    response = _sample(session)
    assert response.count == 3
    assert [point.id for point in response.vectors] == ["1", "2", "3"]
    model, scale = state.pca_models[1]
    assert model.mean_ == pytest.approx([2 / 3, 2 / 3])
    assert scale == pytest.approx(np.sqrt(2))
    assert np.abs([[point.x, point.y] for point in response.vectors]) == pytest.approx(
        np.array([[0, 2 / 3], [1, 1 / 3], [1, 1 / 3]])
    )
    assert set(response.model_dump()) == {"vectors", "count"}
    assert set(response.vectors[0].model_dump()) == {"id", "x", "y", "category", "payload"}


def test_query_projection_uses_model_and_normalization_from_shared_state(pca_environment):
    model = PCA(n_components=2).fit([[10, 10], [12, 10], [10, 12]])
    state.pca_models[1] = (model, float(np.sqrt(2)))
    projected = routes._project_query_for_user(1, np.array([12.0, 10.0]))
    assert np.abs(projected) == pytest.approx([1, 1 / 3])


def test_users_keep_separate_fits_and_query_projections(pca_environment):
    _, session = pca_environment
    alice = _sample(session, 1)
    bob = _sample(session, 2)
    assert set(state.pca_models) == {1, 2}
    assert state.pca_models[1][0].mean_ == pytest.approx([2 / 3, 2 / 3])
    assert state.pca_models[2][0].mean_ == pytest.approx([34 / 3, 34 / 3])
    assert routes._project_query_for_user(1, np.array([2.0, 0.0])) == pytest.approx(
        [alice.vectors[1].x, alice.vectors[1].y]
    )
    assert routes._project_query_for_user(2, np.array([14.0, 10.0])) == pytest.approx(
        [bob.vectors[1].x, bob.vectors[1].y]
    )


@pytest.mark.parametrize("count", [0, 1])
def test_insufficient_vectors_clear_only_the_users_stale_cache(pca_environment, count):
    index, session = pca_environment
    index.items = index.items[:count]
    other_cache = (object(), 2.0)
    state.pca_models.update({1: (object(), 1.0), 2: other_cache})
    response = _sample(session)
    assert response.count == count
    assert 1 not in state.pca_models
    assert state.pca_models[2] is other_cache
    if count:
        assert [response.vectors[0].x, response.vectors[0].y] == [0.0, 0.0]
    else:
        assert response.model_dump() == {"vectors": [], "count": 0}


def test_sampling_one_vector_does_not_keep_a_stale_fit(pca_environment):
    _, session = pca_environment
    state.pca_models[1] = (object(), 1.0)
    response = _sample(session, n=1)
    assert response.count == 3
    assert len(response.vectors) == 1
    assert 1 not in state.pca_models


def test_failed_and_missing_query_projections_return_none(pca_environment):
    model = PCA(n_components=2).fit([[0, 0], [2, 0], [0, 2]])
    state.pca_models[1] = (model, 1.0)
    assert routes._project_query_for_user(1, np.ones(3)) is None
    assert routes._project_query_for_user(999, np.ones(2)) is None


@pytest.mark.parametrize(
    "operation",
    ["insert", "delete_vector", "delete_document", "clear", "ingest_text", "ingest_file",
     "ingest_text_failure", "ingest_file_failure"],
)
def test_mutations_invalidate_only_the_relevant_users_cache(
    pca_environment, monkeypatch, operation,
):
    _, session = pca_environment
    other_cache = (object(), 2.0)
    state.pca_models.update({1: (object(), 1.0), 2: other_cache})
    user = SimpleNamespace(id=1)
    monkeypatch.setattr(documents.chunker, "split_text", lambda text: ["one chunk"])
    embed = AsyncMock(return_value=[[0.5] * 768])
    if operation.endswith("failure"):
        embed.side_effect = RuntimeError("Embedding unavailable")
    monkeypatch.setattr(documents.embedder, "embed_batch", embed)

    async def mutate():
        if operation == "insert":
            await routes.insert_vector(
                schemas.InsertRequest(category="testing", payload="raw", embedding=[0.5] * 768),
                current_user=user,
            )
        elif operation == "delete_vector":
            await routes.delete_vector(1, current_user=user, session=session)
        elif operation == "delete_document":
            await routes.delete_document(11, current_user=user, session=session)
        elif operation == "clear":
            await routes.clear_user_data(current_user=user, session=session)
        elif operation.startswith("ingest_text"):
            await routes.ingest_document(
                schemas.IngestRequest(text="document", category="testing"),
                current_user=user, session=session,
            )
        else:
            await routes.ingest_file(
                category="testing", file=UploadFile(filename="test.txt", file=io.BytesIO(b"text")),
                current_user=user, session=session,
            )

    if operation.endswith("failure"):
        with pytest.raises(HTTPException) as error:
            asyncio.run(mutate())
        assert error.value.status_code == 500
    else:
        asyncio.run(mutate())
    assert 1 not in state.pca_models
    assert state.pca_models[2] is other_cache
