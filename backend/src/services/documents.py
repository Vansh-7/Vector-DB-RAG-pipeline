import asyncio
import io
from typing import Any

import pypdf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from ai.chunker import chunker
from ai.embedder import embedder
from core.logger import logger
from core.types import VectorItem
from db.models import Document
from services.errors import DomainError
from services.validation import _normalize_category, _unique_vector_id, _validate_embedding

MAX_TEXT_CHARACTERS = 2_000_000
MAX_PDF_PAGES = 200
MAX_PDF_CONTENT_BYTES = 8 * 1024 * 1024
MAX_DOCUMENT_CHUNKS = 2_048
EMBEDDING_BATCH_SIZE = 16
MAX_PDF_OPERATIONS = 100_000
MAX_PDF_RESOURCE_OBJECTS = 10_000
MAX_PDF_RESOURCE_DEPTH = 32
# Set parser output bounds once, never change shared settings per request.
for _filter_limit in (
    "ZLIB_MAX_OUTPUT_LENGTH",
    "LZW_MAX_OUTPUT_LENGTH",
    "RUN_LENGTH_MAX_OUTPUT_LENGTH",
    "MAX_ARRAY_BASED_STREAM_OUTPUT_LENGTH",
    "FLATE_MAX_BUFFER_SIZE",
):
    setattr(pypdf.filters, _filter_limit, MAX_PDF_CONTENT_BYTES)


async def _create_document(
    session: AsyncSession, *, user_id: int, name: str, category: str, source_type: str
) -> Document:
    document = Document(
        user_id=user_id,
        name=name,
        category=category,
        source_type=source_type,
        status="processing",
        chunk_count=0,
    )
    session.add(document)
    try:
        await session.commit()
        await session.refresh(document)
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Failed creating document metadata for user_id={user_id}: {exc}")
        raise DomainError(
            kind="internal", message="Failed to initialize document ingestion."
        ) from exc
    return document


async def _mark_document_failed(session: AsyncSession, document_id: int) -> None:
    try:
        await session.rollback()
        document = await session.get(Document, document_id)
        if document is None:
            return
        document.status = "failed"
        document.chunk_count = 0
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Failed marking document_id={document_id} as failed: {exc}")


async def _compensate_vector_inserts(item_ids: list[int]) -> None:
    """
    Best-effort compensation for vectors written before an ingestion failed.

    PostgreSQL and our custom Vector DB cannot share one ACID transaction.
    Compensating WAL DELETE operations keep recovery semantics consistent.
    """
    if not item_ids:
        return
    async with state.db_lock:
        for item_id in item_ids:
            try:
                state.wal.log_delete(item_id)
                state.vector_db.remove(item_id)
            except Exception as exc:
                logger.exception(f"Failed compensating vector_id={item_id}: {exc}")


async def _insert_document_chunks(
    *,
    chunks: list[str],
    user_id: int,
    document_id: int,
    category: str,
    attempted_item_ids: list[int],
) -> None:
    if len(chunks) > MAX_DOCUMENT_CHUNKS:
        raise DomainError(kind="too_large", message="Document exceeds the chunk limit.")
    for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        batch = chunks[start : start + EMBEDDING_BATCH_SIZE]
        vectors = await embedder.embed_batch(batch)
        if len(vectors) != len(batch):
            raise RuntimeError("Embedding count does not match chunk count.")
        async with state.db_lock:
            for chunk, vector in zip(batch, vectors):
                try:
                    _validate_embedding(vector)
                except DomainError as exc:
                    raise RuntimeError("Embedding model returned an invalid vector.") from exc
                item_id = _unique_vector_id()
                # Track the attempt before either durable or in-memory mutation.
                attempted_item_ids.append(item_id)
                item = VectorItem(
                    id=item_id,
                    metadata=chunk,
                    category=category,
                    embedding=vector,
                    user_id=user_id,
                    document_id=document_id,
                )
                # Durable intent must precede index mutation, including compensation.
                state.wal.log_insert(item)
                state.vector_db.insert(item)


def _pdf_resource_bytes(roots, seen: set[int]) -> int:
    """Preflight text resources before pypdf can suppress nested form errors."""
    stack = [(root, 0) for root in roots if root is not None]
    total = 0
    while stack:
        value, depth = stack.pop()
        value = value.get_object()
        if isinstance(value, pypdf.generic.NullObject) or id(value) in seen:
            continue
        seen.add(id(value))
        if depth > MAX_PDF_RESOURCE_DEPTH or len(seen) > MAX_PDF_RESOURCE_OBJECTS:
            raise DomainError(kind="too_large", message="PDF resource complexity limit exceeded.")
        if isinstance(value, pypdf.generic.StreamObject):
            if value.get("/Subtype") == "/Image":
                continue  # Text extraction does not decode images.
            total += len(value.get_data())
            if total > MAX_PDF_CONTENT_BYTES:
                raise DomainError(
                    kind="too_large", message="PDF content exceeds the decoded size limit."
                )
        if isinstance(value, pypdf.generic.DictionaryObject):
            stack.extend((child, depth + 1) for child in value.values())
        elif isinstance(value, pypdf.generic.ArrayObject):
            stack.extend((child, depth + 1) for child in value)
    return total


def _extract_file_text(content: bytes, extension: str) -> str:
    if extension == ".pdf":
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(content))
            if len(pdf_reader.pages) > MAX_PDF_PAGES:
                raise DomainError(kind="too_large", message="PDF exceeds the page limit.")
            pages: list[str] = []
            characters = decoded_bytes = 0
            visited: set[int] = set()
            operations = text_work = 0
            budget_exceeded = False

            def check_work(*args):
                nonlocal operations, budget_exceeded
                operations += 1
                budget_exceeded |= operations > MAX_PDF_OPERATIONS
                if budget_exceeded:
                    raise DomainError(
                        kind="too_large", message="PDF extraction work limit exceeded."
                    )

            def count_text(text, *args):
                nonlocal text_work, budget_exceeded
                text_work += len(text)
                budget_exceeded |= text_work > MAX_TEXT_CHARACTERS * 4
                if budget_exceeded:
                    raise DomainError(
                        kind="too_large", message="PDF extraction work limit exceeded."
                    )

            def check_after(*args):
                # pypdf may catch an exception inside a Form. Re-raise outside
                # that handler and check again after extraction; never accept truncation.
                if budget_exceeded:
                    raise DomainError(
                        kind="too_large", message="PDF extraction work limit exceeded."
                    )

            for page in pdf_reader.pages:
                decoded_bytes += _pdf_resource_bytes(
                    [page.get("/Contents"), page.get("/Resources")], visited
                )
                if decoded_bytes > MAX_PDF_CONTENT_BYTES:
                    raise DomainError(
                        kind="too_large", message="PDF content exceeds the decoded size limit."
                    )
                page_text = page.extract_text(
                    visitor_operand_before=check_work,
                    visitor_operand_after=check_after,
                    visitor_text=count_text,
                )
                check_after()
                if page_text:
                    characters += len(page_text) + (1 if pages else 0)
                    if characters > MAX_TEXT_CHARACTERS:
                        raise DomainError(
                            kind="too_large", message="Extracted document text is too large."
                        )
                    pages.append(page_text)
            return "\n".join(pages).strip()
        except pypdf.errors.LimitReachedError as exc:
            raise DomainError(
                kind="too_large", message="PDF decompression limit exceeded."
            ) from exc
    text = content.decode("utf-8").strip()
    if len(text) > MAX_TEXT_CHARACTERS:
        raise DomainError(kind="too_large", message="Extracted document text is too large.")
    return text


async def list_documents(session: AsyncSession, user_id: int) -> list[Document]:
    """
    Returns only documents owned by the authenticated user.
    """
    result = await session.scalars(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc())
    )
    return list(result.all())


async def delete_document(document_id: int, user_id: int, session: AsyncSession) -> dict[str, Any]:
    """
    Deletes one user-owned document and all of its vector chunks.

    We first mark the document 'deleting'. Retrieval only considers 'ready'
    documents, so even if deletion partially fails the document stops entering
    RAG context.
    """
    document = await session.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if document is None:
        raise DomainError(kind="not_found", message="Document not found.")
    document.status = "deleting"
    try:
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Failed preparing document deletion document_id={document_id}: {exc}")
        raise DomainError(kind="internal", message="Failed to delete document.") from exc
    try:
        async with state.db_lock:
            user_items = [
                item
                for item in state.vector_db.get_all_items()
                if getattr(item, "user_id", None) == user_id
                and getattr(item, "document_id", None) == document_id
            ]
            for item in user_items:
                state.wal.log_delete(item.id)
                state.vector_db.remove(item.id)
    except Exception as exc:
        logger.exception(f"Vector cleanup failed for document_id={document_id}: {exc}")
        await _mark_document_failed(session, document_id)
        raise DomainError(kind="internal", message="Failed to delete document.") from exc
    try:
        document = await session.get(Document, document_id)
        if document is not None:
            await session.delete(document)
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception(f"PostgreSQL document deletion failed document_id={document_id}: {exc}")
        raise DomainError(kind="internal", message="Document deletion was incomplete.") from exc
    state.pca_models.pop(user_id, None)
    logger.info(f"Deleted document_id={document_id} for user_id={user_id}")
    return {"deleted_document_id": document_id, "deleted_chunks": len(user_items)}


async def ingest_document(
    text: str, category: str, title: str | None, user_id: int, session: AsyncSession
) -> dict[str, Any]:
    raw_text = text.strip()
    if not raw_text:
        raise DomainError(kind="invalid", message="Document text cannot be empty.")
    if len(raw_text) > MAX_TEXT_CHARACTERS:
        raise DomainError(kind="too_large", message="Text document is too large.")
    category = _normalize_category(category)
    title = (title or "Pasted text").strip()
    if not title:
        title = "Pasted text"
    title = title[:255]
    document = await _create_document(
        session, user_id=user_id, name=title, category=category, source_type="text"
    )
    attempted_item_ids: list[int] = []
    try:
        chunks = await asyncio.to_thread(chunker.split_text, raw_text)
        if not chunks:
            raise RuntimeError("Document chunker produced no chunks.")
        await _insert_document_chunks(
            chunks=chunks,
            user_id=user_id,
            document_id=document.id,
            category=category,
            attempted_item_ids=attempted_item_ids,
        )
        document.status = "ready"
        document.chunk_count = len(chunks)
        await session.commit()
        await session.refresh(document)
        state.pca_models.pop(user_id, None)
        logger.info(
            f"Text document ingested document_id={document.id}, "
            f"user_id={user_id}, chunks={len(chunks)}"
        )
        return {
            "document_id": document.id,
            "status": document.status,
            "chunk_count": document.chunk_count,
            "message": "Document ingested successfully.",
        }
    except (Exception, asyncio.CancelledError) as exc:
        logger.exception(f"Text ingestion failed document_id={document.id}: {exc}")
        await _compensate_vector_inserts(attempted_item_ids)
        await _mark_document_failed(session, document.id)
        state.pca_models.pop(user_id, None)
        if isinstance(exc, (DomainError, asyncio.CancelledError)):
            raise
        raise DomainError(kind="internal", message="Document ingestion failed.") from exc


async def ingest_file(
    content: bytes,
    filename: str,
    extension: str,
    category: str,
    user_id: int,
    session: AsyncSession,
) -> dict[str, Any]:
    normalized_category = category
    try:
        text_content = await asyncio.to_thread(_extract_file_text, content, extension)
    except UnicodeDecodeError as exc:
        raise DomainError(kind="invalid", message="Text files must use UTF-8 encoding.") from exc
    except DomainError:
        raise
    except Exception as exc:
        logger.exception(f"Document parsing failed user_id={user_id}: {exc}")
        raise DomainError(kind="invalid", message="Unable to parse the uploaded document.") from exc
    if not text_content:
        raise DomainError(
            kind="invalid", message="No readable text could be extracted from the document."
        )
    document = await _create_document(
        session, user_id=user_id, name=filename, category=normalized_category, source_type="file"
    )
    attempted_item_ids: list[int] = []
    try:
        chunks = await asyncio.to_thread(chunker.split_text, text_content)
        if not chunks:
            raise RuntimeError("Document chunker produced no chunks.")
        await _insert_document_chunks(
            chunks=chunks,
            user_id=user_id,
            document_id=document.id,
            category=normalized_category,
            attempted_item_ids=attempted_item_ids,
        )
        document.status = "ready"
        document.chunk_count = len(chunks)
        await session.commit()
        await session.refresh(document)
        state.pca_models.pop(user_id, None)
        logger.info(
            f"File document ingested document_id={document.id}, "
            f"user_id={user_id}, chunks={len(chunks)}"
        )
        return {
            "document_id": document.id,
            "status": document.status,
            "chunk_count": document.chunk_count,
            "message": f"{document.name} ingested successfully.",
        }
    except (Exception, asyncio.CancelledError) as exc:
        logger.exception(f"File ingestion failed document_id={document.id}: {exc}")
        await _compensate_vector_inserts(attempted_item_ids)
        await _mark_document_failed(session, document.id)
        state.pca_models.pop(user_id, None)
        if isinstance(exc, (DomainError, asyncio.CancelledError)):
            raise
        raise DomainError(kind="internal", message="Document ingestion failed.") from exc
