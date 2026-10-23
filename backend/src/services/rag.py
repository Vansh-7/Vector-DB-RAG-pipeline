import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import api.state as state
from ai.embedder import embedder
from ai.generator import llm_generator
from ai.reranker import cross_encoder
from core.logger import logger
from db.models import Conversation, Message
from db.session import AsyncSessionLocal
from services.errors import DomainError
from services.retrieval import get_ready_document_ids, search_user_vectors
from services.visualization import project_query_for_user


def _conversation_title_from_question(question: str) -> str:
    normalized = " ".join(question.split()).strip()
    if not normalized:
        return "New chat"
    return normalized[:80]


async def _prepare_chat_turn(
    session: AsyncSession, *, user_id: int, question: str, conversation_id: int | None
) -> Conversation:
    """
    Resolves or creates the user's conversation and persists
    the user's message before the RAG pipeline starts.
    """
    if conversation_id is None:
        conversation = Conversation(
            user_id=user_id, title=_conversation_title_from_question(question)
        )
        session.add(conversation)
        await session.flush()
    else:
        conversation = await session.scalar(
            select(Conversation).where(
                Conversation.id == conversation_id, Conversation.user_id == user_id
            )
        )
        if conversation is None:
            raise DomainError(kind="not_found", message="Conversation not found.")
    conversation.updated_at = datetime.now(timezone.utc)
    session.add(
        Message(conversation_id=conversation.id, role="user", content=question, sources=None)
    )
    try:
        await session.commit()
        await session.refresh(conversation)
    except Exception as exc:
        await session.rollback()
        logger.exception(f"Failed saving user message user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="Failed to persist chat message.") from exc
    return conversation


async def ask_question(
    question: str, k: int, conversation_id: int | None, user_id: int, session: AsyncSession
) -> AsyncIterator[str]:
    question = question.strip()
    if not question:
        raise DomainError(kind="invalid", message="Question cannot be empty.")
    # Preserve the durable user turn before embedding, retrieval or generation.
    conversation = await _prepare_chat_turn(
        session, user_id=user_id, question=question, conversation_id=conversation_id
    )
    try:
        question_vector = await embedder.embed_text(question)
    except Exception as exc:
        logger.exception(f"Question embedding failed user_id={user_id}: {exc}")
        raise DomainError(kind="unavailable", message="Embedding service is unavailable.") from exc
    if len(question_vector) != state.DEFAULT_DIMS:
        raise DomainError(kind="internal", message="Embedding model returned an invalid vector.")
    question_arr = np.asarray(question_vector, dtype=float)
    ready_document_ids = await get_ready_document_ids(session, user_id)
    try:
        broad_k = max(20, k * 4)
        raw_results = search_user_vectors(
            query=question_arr, user_id=user_id, ready_document_ids=ready_document_ids, k=broad_k
        )
        if raw_results:
            reranked = await asyncio.to_thread(cross_encoder.rerank, question, raw_results, top_n=k)
            best_results = [(score, result) for score, result in reranked if score > 0]
        else:
            best_results = []
    except Exception as exc:
        logger.exception(f"RAG retrieval failed user_id={user_id}: {exc}")
        raise DomainError(kind="internal", message="RAG retrieval failed.") from exc
    query_2d = project_query_for_user(user_id, question_arr)
    sources = [
        {
            "vectorId": str(result.item.id),
            "documentId": getattr(result.item, "document_id", None),
            "category": result.item.category,
            "score": float(score),
            "snippet": result.item.metadata,
        }
        for score, result in best_results
    ]
    best_chunks = [result.item.metadata for _, result in best_results]

    async def response_stream() -> AsyncIterator[str]:
        yield (
            json.dumps(
                {
                    "type": "conversation",
                    "data": {"id": conversation.id, "title": conversation.title},
                }
            )
            + "\n"
        )
        yield (json.dumps({"type": "sources", "data": sources}) + "\n")
        if query_2d is not None:
            yield (json.dumps({"type": "query_2d", "data": query_2d}) + "\n")
        assistant_parts: list[str] = []
        generation_failed = False
        try:
            async for chunk in llm_generator.generate_stream(question, best_chunks):
                try:
                    event = json.loads(chunk)
                    event_type = event.get("type")
                    if event_type == "token":
                        token = str(event.get("data", ""))
                        assistant_parts.append(token)
                    elif event_type == "error":
                        generation_failed = True
                except (json.JSONDecodeError, TypeError):
                    logger.warning("LLM emitted an invalid stream event.")
                yield chunk
        except asyncio.CancelledError:
            # A disconnected client must not leave an incomplete assistant turn.
            logger.info(f"RAG stream cancelled conversation_id={conversation.id}")
            raise
        except Exception as exc:
            generation_failed = True
            logger.exception(f"LLM stream failed conversation_id={conversation.id}: {exc}")
            yield (json.dumps({"type": "error", "data": "LLM generation failed."}) + "\n")
        if not generation_failed and assistant_parts:
            assistant_text = "".join(assistant_parts).strip()
            if assistant_text:
                try:
                    # Streaming outlives request preparation: use a fresh DB session.
                    async with AsyncSessionLocal() as stream_session:
                        owned_conversation = await stream_session.scalar(
                            select(Conversation).where(
                                Conversation.id == conversation.id, Conversation.user_id == user_id
                            )
                        )
                        if owned_conversation is not None:
                            stream_session.add(
                                Message(
                                    conversation_id=conversation.id,
                                    role="assistant",
                                    content=assistant_text,
                                    sources=sources or None,
                                )
                            )
                            owned_conversation.updated_at = datetime.now(timezone.utc)
                            await stream_session.commit()
                except Exception as exc:
                    # The answer already reached the client; retain successful delivery.
                    logger.exception(
                        f"Failed persisting assistant message "
                        f"conversation_id={conversation.id}: {exc}"
                    )

    logger.info(
        f"RAG response started user_id={user_id}, "
        f"conversation_id={conversation.id}, context_chunks={len(best_results)}"
    )
    return response_stream()
