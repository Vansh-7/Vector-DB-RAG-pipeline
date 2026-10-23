import asyncio
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pypdf
import pytest
from fastapi.testclient import TestClient
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NullObject,
    NumberObject,
)
from test_document_service import documents as documents
from test_document_service import ingest
from test_rag_service import prepare
from test_rag_service import rag as rag
from test_vector_service import insert
from test_vector_service import vectors as vectors

import api.state as state
from auth.dependencies import get_current_user
from core.types import VectorItem
from db.session import get_db
from services import search, validation
from services.errors import DomainError


def pdf_content(text="PDF text", pages=1, compress=False):
    writer = pypdf.PdfWriter()
    for _ in range(pages):
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
        stream.set_data(f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = stream.flate_encode() if compress else stream
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize("extension", [".txt", ".md", ".pdf"])
def test_extracted_text_limit_rejects_before_metadata_or_inference(
    documents, monkeypatch, extension
):
    service, session, _, events = documents
    monkeypatch.setattr(service, "MAX_TEXT_CHARACTERS", 10)
    content = pdf_content("x" * 11) if extension == ".pdf" else b"x" * 11
    with pytest.raises(DomainError) as error:
        asyncio.run(
            service.ingest_file(content, "file" + extension, extension, "general", 1, session)
        )
    assert error.value.kind == "too_large"
    assert events == []
    service.embedder.embed_batch.assert_not_awaited()


def test_pdf_page_budget_rejects_before_text_extraction(documents, monkeypatch):
    service, session, _, events = documents
    monkeypatch.setattr(service, "MAX_PDF_PAGES", 2, raising=False)
    with pytest.raises(DomainError) as error:
        asyncio.run(
            service.ingest_file(pdf_content(pages=3), "file.pdf", ".pdf", "test", 1, session)
        )
    assert error.value.kind == "too_large"
    assert events == []


def test_compressed_pdf_decoded_content_budget(documents, monkeypatch):
    service, session, _, events = documents
    monkeypatch.setattr(service, "MAX_PDF_CONTENT_BYTES", 64, raising=False)
    with pytest.raises(DomainError) as error:
        asyncio.run(
            service.ingest_file(
                pdf_content("x" * 512, compress=True), "file.pdf", ".pdf", "test", 1, session
            )
        )
    assert error.value.kind == "too_large"
    assert events == []


def test_pdf_decompression_limit_is_reported_as_size_error(documents, monkeypatch):
    service, session, _, _ = documents
    monkeypatch.setattr(pypdf.filters, "ZLIB_MAX_OUTPUT_LENGTH", 64)
    with pytest.raises(DomainError) as error:
        asyncio.run(
            service.ingest_file(
                pdf_content("x" * 512, compress=True), "file.pdf", ".pdf", "test", 1, session
            )
        )
    assert error.value.kind == "too_large"


@pytest.mark.parametrize("file_upload", [False, True])
def test_excessive_chunks_are_failed_without_embedding_or_truncation(
    documents, monkeypatch, file_upload
):
    service, session, index, _ = documents
    monkeypatch.setattr(service, "MAX_DOCUMENT_CHUNKS", 1, raising=False)
    with pytest.raises(DomainError) as error:
        if file_upload:
            asyncio.run(service.ingest_file(b"text", "file.txt", ".txt", "general", 1, session))
        else:
            ingest(documents)
    assert error.value.kind == "too_large"
    assert session.document.status == "failed"
    assert session.document.chunk_count == 0
    assert index.items == []
    service.embedder.embed_batch.assert_not_awaited()


def test_embedding_batches_are_bounded_and_all_chunks_are_preserved(documents, monkeypatch):
    service, session, index, _ = documents
    monkeypatch.setattr(service, "EMBEDDING_BATCH_SIZE", 2, raising=False)
    monkeypatch.setattr(service.chunker, "split_text", lambda _: [str(i) for i in range(5)])
    batches = []

    async def embed(chunks):
        batches.append(list(chunks))
        return [[0.1] * 768 for _ in chunks]

    monkeypatch.setattr(service.embedder, "embed_batch", embed)
    ingest(documents)
    assert batches == [["0", "1"], ["2", "3"], ["4"]]
    assert [item.metadata for item in index.items] == [str(i) for i in range(5)]
    assert session.document.chunk_count == 5


def test_later_embedding_batch_failure_compensates_only_this_document(documents, monkeypatch):
    service, session, index, events = documents
    foreign = VectorItem(id=999, user_id=2, metadata="Bob", category="test", embedding=[0.5] * 768)
    index.items.append(foreign)
    monkeypatch.setattr(service, "EMBEDDING_BATCH_SIZE", 2, raising=False)
    monkeypatch.setattr(service.chunker, "split_text", lambda _: ["a", "b", "c"])
    calls = []

    async def embed(chunks):
        calls.append(list(chunks))
        if len(calls) == 2:
            raise ConnectionError("inference unavailable")
        return [[0.1] * 768 for _ in chunks]

    monkeypatch.setattr(service.embedder, "embed_batch", embed)
    with pytest.raises(DomainError):
        ingest(documents)
    assert index.items == [foreign]
    assert session.document.status == "failed"
    assert len([event for event in events if event[0] == "wal_delete"]) == 2
    assert set(state.pca_models) == {2}


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_raw_vectors_are_rejected_without_wal_or_mutation(vectors, value):
    _, _, index, events = vectors
    with pytest.raises(DomainError) as error:
        insert(vectors, embedding=[value] + [0.1] * 767)
    assert error.value.kind == "invalid"
    assert len(index.items) == 5
    assert events == []


def test_oversized_raw_payload_is_rejected_before_embedding(vectors, monkeypatch):
    service, _, _, events = vectors
    embed = AsyncMock(return_value=[0.1] * 768)
    monkeypatch.setattr(service.embedder, "embed_text", embed)
    with pytest.raises(DomainError) as error:
        insert(vectors, payload="x" * 8001, embedding=None)
    assert error.value.kind == "too_large"
    embed.assert_not_awaited()
    assert events == []


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_document_embeddings_are_compensated(documents, value):
    service, session, index, _ = documents
    service.embedder.embed_batch.return_value = [[0.1] * 768, [value] + [0.1] * 767]
    with pytest.raises(DomainError):
        ingest(documents)
    assert index.items == []
    assert session.document.status == "failed"


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_nonfinite_search_input_is_rejected_before_retrieval(value):
    with pytest.raises(DomainError, match="finite"):
        asyncio.run(search.search_vectors([value] + [0.0] * 767, 5, 1, SimpleNamespace()))


def test_search_text_is_bounded_before_inference(monkeypatch):
    embed = AsyncMock(return_value=[0.1] * 768)
    monkeypatch.setattr(search.embedder, "embed_text", embed)
    with pytest.raises(DomainError) as error:
        asyncio.run(search.search_vectors_by_text("x" * 10001, 5, 1, SimpleNamespace()))
    assert error.value.kind == "too_large"
    embed.assert_not_awaited()


def test_finite_embedding_at_boundary_remains_valid():
    validation._validate_embedding([0.0] * 768)


def test_pdf_nested_form_is_included_in_decoded_budget(documents, monkeypatch):
    service, _, _, _ = documents
    monkeypatch.setattr(service, "MAX_PDF_CONTENT_BYTES", 64)
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    form = DecodedStreamObject()
    form.set_data(b" " * 512)
    form[NameObject("/Subtype")] = NameObject("/Form")
    form[NameObject("/BBox")] = ArrayObject(
        [NumberObject(0), NumberObject(0), NumberObject(612), NumberObject(792)]
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/XObject"): DictionaryObject({NameObject("/Fm0"): form.flate_encode()})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"/Fm0 Do")
    page[NameObject("/Contents")] = stream
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(DomainError) as error:
        service._extract_file_text(output.getvalue(), ".pdf")
    assert error.value.kind == "too_large"


def test_pdf_null_contents_entry_remains_supported(documents):
    service, _, _, _ = documents
    reader = pypdf.PdfReader(io.BytesIO(pdf_content("Valid text")))
    writer = pypdf.PdfWriter()
    writer.add_page(reader.pages[0])
    page = writer.pages[0]
    page[NameObject("/Contents")] = ArrayObject(
        [NullObject(), writer._add_object(page["/Contents"])]
    )
    output = io.BytesIO()
    writer.write(output)
    assert service._extract_file_text(output.getvalue(), ".pdf") == "Valid text"


def test_batch_cancellation_compensates_owned_attempts_and_propagates(documents, monkeypatch):
    service, session, index, events = documents
    foreign = VectorItem(id=999, user_id=2, metadata="Bob", category="test", embedding=[0.5] * 768)
    index.items.append(foreign)
    monkeypatch.setattr(service, "EMBEDDING_BATCH_SIZE", 1)
    calls = []

    async def embed(chunks):
        calls.append(list(chunks))
        if len(calls) == 2:
            raise asyncio.CancelledError()
        return [[0.1] * 768]

    monkeypatch.setattr(service.embedder, "embed_batch", embed)
    with pytest.raises(asyncio.CancelledError):
        ingest(documents)
    assert index.items == [foreign]
    assert session.document.status == "failed"
    assert len([event for event in events if event[0] == "wal_delete"]) == 1
    assert set(state.pca_models) == {2}


def test_pdf_operator_work_budget(documents, monkeypatch):
    service, _, _, _ = documents
    monkeypatch.setattr(service, "MAX_PDF_OPERATIONS", 1, raising=False)
    with pytest.raises(DomainError) as error:
        service._extract_file_text(pdf_content("Valid text"), ".pdf")
    assert error.value.kind == "too_large"


def test_valid_compressed_pdf_ingests_all_content(documents):
    service, session, index, _ = documents
    result = asyncio.run(
        service.ingest_file(
            pdf_content("Valid NeueBit document", compress=True),
            "valid.pdf",
            ".pdf",
            "test",
            1,
            session,
        )
    )
    assert result["status"] == "ready"
    assert len(index.items) == result["chunk_count"] == 2
    assert session.document.source_type == "file"


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_nonfinite_question_model_output_never_reaches_retrieval(rag, monkeypatch, value):
    service, request, stream, events = rag
    monkeypatch.setattr(service.embedder, "embed_text", AsyncMock(return_value=[value] * 768))
    with pytest.raises(DomainError, match="Embedding model returned an invalid vector") as error:
        asyncio.run(prepare(rag))
    assert error.value.kind == "internal"
    assert [message.role for message in request.messages] == ["user"]
    assert stream.messages == []
    assert not any(event[0] == "ann" for event in events)


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_nonfinite_text_search_model_output_never_reaches_retrieval(monkeypatch, value):
    monkeypatch.setattr(search.embedder, "embed_text", AsyncMock(return_value=[value] * 768))
    with pytest.raises(DomainError, match="Embedding model returned an invalid vector") as error:
        asyncio.run(search.search_vectors_by_text("valid", 5, 1, SimpleNamespace()))
    assert error.value.kind == "internal"


@pytest.mark.parametrize("value", ["NaN", "Infinity"])
def test_nonfinite_raw_embedding_http_error_is_safe(vectors, value):
    from main import app

    _, session, index, events = vectors
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    app.dependency_overrides[get_db] = lambda: session
    body = '{"id":"99","category":"test","payload":"raw","embedding":[' + value
    body += ",0" * 767 + "]}"
    try:
        response = TestClient(app).post(
            "/api/v1/insert", content=body, headers={"content-type": "application/json"}
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 400
    assert response.json() == {"detail": "Embedding values must be finite numbers."}
    assert len(index.items) == 5
    assert events == []
