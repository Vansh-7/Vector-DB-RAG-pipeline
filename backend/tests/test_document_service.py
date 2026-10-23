import asyncio
import importlib
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pypdf
import pytest
from fastapi.testclient import TestClient
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

import api.state as state
from auth.dependencies import get_current_user
from core.types import VectorItem
from db.session import get_db


class DocumentSession:
    def __init__(self, events):
        self.events = events
        self.document = None
        self.commits = 0
        self.fail_commit = None
        self.statements = []
        self.deleted = []

    def add(self, document):
        document.id = 77
        self.document = document

    async def commit(self):
        self.commits += 1
        self.events.append(("commit", self.document.status))
        if self.commits == self.fail_commit:
            raise RuntimeError("database unavailable")

    async def refresh(self, item):
        pass

    async def rollback(self):
        self.events.append(("rollback",))

    async def get(self, model, item_id):
        return self.document

    async def scalar(self, statement):
        self.statements.append(statement)
        params = statement.compile().params
        if self.document and params == {"id_1": self.document.id, "user_id_1": 1}:
            return self.document
        return None

    async def scalars(self, statement):
        self.statements.append(statement)
        return SimpleNamespace(all=lambda: [self.document] if self.document else [])

    async def delete(self, item):
        self.deleted.append(item.id)


class DocumentIndex:
    def __init__(self, events):
        self.events = events
        self.items = []
        self.fail_insert = None
        self.fail_remove = False

    def get_all_items(self):
        assert state.db_lock.locked()
        return list(self.items)

    def insert(self, item):
        assert state.db_lock.locked()
        self.events.append(("insert", item.id))
        self.items.append(item)
        if len(self.items) == self.fail_insert:
            raise RuntimeError("partially inserted")

    def remove(self, item_id):
        assert state.db_lock.locked()
        self.events.append(("remove", item_id))
        if self.fail_remove:
            raise RuntimeError("delete failed")
        self.items = [item for item in self.items if item.id != item_id]
        return True


@pytest.fixture
def documents(monkeypatch):
    service = importlib.import_module("services.documents")
    events = []
    index = DocumentIndex(events)
    session = DocumentSession(events)

    def log_insert(item):
        assert state.db_lock.locked()
        events.append(("wal_insert", item.id))

    def log_delete(item_id):
        assert state.db_lock.locked()
        events.append(("wal_delete", item_id))

    monkeypatch.setattr(state, "vector_db", index)
    monkeypatch.setattr(state, "wal", SimpleNamespace(log_insert=log_insert, log_delete=log_delete))
    monkeypatch.setattr(state, "pca_models", {1: (object(), 1), 2: (object(), 2)})
    monkeypatch.setattr(service.chunker, "split_text", lambda text: ["first", "second"])
    monkeypatch.setattr(
        service.embedder, "embed_batch", AsyncMock(return_value=[[0.1] * 768, [0.2] * 768])
    )
    return service, session, index, events


def ingest(documents):
    service, session, _, _ = documents
    return asyncio.run(
        service.ingest_document(
            text="  document  ",
            category="  research ",
            title="  Title  ",
            user_id=1,
            session=session,
        )
    )


def test_text_ingestion_commits_processing_then_ready_and_wal_before_memory(documents):
    _, session, index, events = documents
    result = ingest(documents)
    assert result == {
        "document_id": 77,
        "status": "ready",
        "chunk_count": 2,
        "message": "Document ingested successfully.",
    }
    assert session.document.name == "Title"
    assert session.document.category == "research"
    assert session.document.source_type == "text"
    assert [item.metadata for item in index.items] == ["first", "second"]
    assert all(item.user_id == 1 and item.document_id == 77 for item in index.items)
    first_id, second_id = [item.id for item in index.items]
    assert events == [
        ("commit", "processing"),
        ("wal_insert", first_id),
        ("insert", first_id),
        ("wal_insert", second_id),
        ("insert", second_id),
        ("commit", "ready"),
    ]
    assert set(state.pca_models) == {2}


@pytest.mark.parametrize("failure", ["embedding", "count", "dimension", "partial", "commit"])
def test_failed_ingestion_compensates_attempts_and_keeps_failed_metadata(
    documents,
    monkeypatch,
    failure,
):
    service, session, index, events = documents
    if failure == "embedding":
        service.embedder.embed_batch.side_effect = RuntimeError("embedding unavailable")
    elif failure == "count":
        service.embedder.embed_batch.return_value = [[0.1] * 768]
    elif failure == "dimension":
        service.embedder.embed_batch.return_value = [[0.1] * 768, [0.2]]
    elif failure == "partial":
        index.fail_insert = 2
    else:
        session.fail_commit = 2
    with pytest.raises(Exception, match="Document ingestion failed") as error:
        ingest(documents)
    assert error.value.kind == "internal"
    assert session.document.status == "failed"
    assert session.document.chunk_count == 0
    assert index.items == []
    attempted = [event[1] for event in events if event[0] == "wal_insert"]
    assert [event[1] for event in events if event[0] == "wal_delete"] == attempted
    for item_id in attempted:
        assert events.index(("wal_delete", item_id)) < events.index(("remove", item_id))
    assert ("rollback",) in events
    assert set(state.pca_models) == {2}


def test_failed_metadata_creation_rolls_back_before_any_vector_work(documents):
    _, session, index, events = documents
    session.fail_commit = 1
    with pytest.raises(Exception, match="Failed to initialize document ingestion"):
        ingest(documents)
    assert index.items == []
    assert events == [("commit", "processing"), ("rollback",)]


def test_wal_failure_compensates_attempt_before_index_insertion(documents, monkeypatch):
    service, session, index, events = documents

    def fail_insert(item):
        events.append(("wal_attempt", item.id))
        raise OSError("disk full")

    monkeypatch.setattr(state.wal, "log_insert", fail_insert)
    with pytest.raises(service.DomainError, match="Document ingestion failed"):
        ingest(documents)
    attempted = next(event[1] for event in events if event[0] == "wal_attempt")
    assert ("wal_delete", attempted) in events
    assert ("remove", attempted) in events
    assert not any(event[0] == "insert" for event in events)
    assert index.items == []
    assert session.document.status == "failed"


def test_empty_chunk_output_marks_ingestion_failed(documents, monkeypatch):
    service, session, index, _ = documents
    monkeypatch.setattr(service.chunker, "split_text", lambda text: [])
    with pytest.raises(service.DomainError, match="Document ingestion failed"):
        ingest(documents)
    assert session.document.status == "failed"
    assert index.items == []


def test_compensation_continues_after_one_failed_delete(documents, monkeypatch):
    service, _, index, events = documents

    def remove(item_id):
        events.append(("remove", item_id))
        if item_id == 1:
            raise RuntimeError("first delete failed")

    monkeypatch.setattr(index, "remove", remove)
    asyncio.run(service._compensate_vector_inserts([1, 2]))
    assert events == [("wal_delete", 1), ("remove", 1), ("wal_delete", 2), ("remove", 2)]


@pytest.mark.parametrize(
    "text,category,kind",
    [("  ", "x", "invalid"), ("x" * 2_000_001, "x", "too_large"), ("x", "x" * 101, "invalid")],
    ids=["empty", "too-large", "category"],
)
def test_text_validation_precedes_metadata_creation(documents, text, category, kind):
    service, session, _, events = documents
    with pytest.raises(Exception) as error:
        asyncio.run(service.ingest_document(text, category, None, 1, session))
    assert error.value.kind == kind
    assert events == []


@pytest.mark.parametrize(
    "extension,content,expected",
    [
        (".txt", b"  hello\nworld  ", "hello\nworld"),
        (".md", b"  # heading  ", "# heading"),
    ],
)
def test_file_ingestion_preserves_file_metadata(
    documents, extension, content, expected, monkeypatch
):
    service, session, _, _ = documents
    seen = []
    monkeypatch.setattr(
        service.chunker, "split_text", lambda text: seen.append(text) or ["first", "second"]
    )
    result = asyncio.run(
        service.ingest_file(content, "upload" + extension, extension, "research", 1, session)
    )
    assert seen == [expected]
    assert session.document.source_type == "file"
    assert session.document.name == "upload" + extension
    assert result["message"] == "upload" + extension + " ingested successfully."


def test_pdf_parser_extracts_real_text(documents):
    service, _, _, _ = documents
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 72 720 Td (Hello NeueBit) Tj ET")
    page[NameObject("/Contents")] = stream
    content = io.BytesIO()
    writer.write(content)
    assert service._extract_file_text(content.getvalue(), ".pdf") == "Hello NeueBit"


@pytest.mark.parametrize(
    "content,extension,message",
    [
        (b"\xff", ".txt", "Text files must use UTF-8 encoding."),
        (b"not a pdf", ".pdf", "Unable to parse the uploaded document."),
        (b"   ", ".md", "No readable text could be extracted from the document."),
    ],
)
def test_file_parse_failures_do_not_create_metadata(documents, content, extension, message):
    service, session, _, events = documents
    with pytest.raises(Exception) as error:
        asyncio.run(
            service.ingest_file(content, "file" + extension, extension, "general", 1, session)
        )
    assert str(error.value) == message
    assert error.value.kind == "invalid"
    assert events == []


def test_document_delete_uses_owner_and_wal_and_preserves_other_items(documents):
    service, session, index, events = documents
    ingest(documents)
    foreign = VectorItem(
        id=900, user_id=2, document_id=77, metadata="Bob", category="general", embedding=[0.0] * 768
    )
    raw = foreign.model_copy(update={"id": 901, "user_id": 1, "document_id": None})
    index.items.extend([foreign, raw])
    events.clear()
    result = asyncio.run(service.delete_document(77, 1, session))
    assert result == {"deleted_document_id": 77, "deleted_chunks": 2}
    assert [item.id for item in index.items] == [900, 901]
    assert events[0] == ("commit", "deleting")
    assert session.deleted == [77]
    assert session.statements[0].compile().params == {"id_1": 77, "user_id_1": 1}


def test_foreign_document_delete_returns_not_found_without_mutation(documents):
    service, session, _, events = documents
    ingest(documents)
    events.clear()
    with pytest.raises(Exception, match="Document not found") as error:
        asyncio.run(service.delete_document(77, 2, session))
    assert error.value.kind == "not_found"
    assert events == []
    assert session.deleted == []


def test_delete_failure_marks_document_failed_before_retrieval(documents):
    service, session, index, _ = documents
    ingest(documents)
    index.fail_remove = True
    with pytest.raises(Exception, match="Failed to delete document"):
        asyncio.run(service.delete_document(77, 1, session))
    assert session.document.status == "failed"
    assert session.deleted == []
    from services.retrieval import is_searchable_for_user

    assert not is_searchable_for_user(index.items[0], 1, set())


def test_document_list_query_remains_user_scoped_and_created_desc(documents):
    service, session, _, _ = documents
    ingest(documents)
    result = asyncio.run(service.list_documents(session=session, user_id=1))
    assert [document.id for document in result] == [77]
    statement = session.statements[0]
    assert statement.compile().params == {"user_id_1": 1}
    assert "documents.created_at DESC" in str(statement)


@pytest.mark.parametrize(
    "filename,content,code,detail",
    [
        ("file.exe", b"data", 400, "Only .pdf, .txt and .md files are supported."),
        ("a" * 256 + ".txt", b"data", 400, "Filename is too long."),
        ("file.txt", b"", 400, "Uploaded file is empty."),
        ("file.txt", b"x" * (10 * 1024 * 1024 + 1), 413, "File exceeds the 10 MB upload limit."),
        ("file.txt", b"\xff", 400, "Text files must use UTF-8 encoding."),
    ],
    ids=["extension", "filename", "empty", "too-large", "encoding"],
)
def test_upload_http_validation_contract(documents, filename, content, code, detail):
    from main import app

    _, session, _, _ = documents
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    app.dependency_overrides[get_db] = lambda: session
    try:
        response = TestClient(app).post(
            "/api/v1/ingest/file", data={"category": "testing"}, files={"file": (filename, content)}
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == code
    assert response.json() == {"detail": detail}
    assert session.document is None
