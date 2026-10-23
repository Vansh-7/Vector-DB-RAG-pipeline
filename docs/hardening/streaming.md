# RAG stream persistence

The existing NDJSON event types remain: conversation, sources, optional query_2d,
token and error. Tokens describe generated text, not an already committed
assistant message. After successful nonempty generation, the server opens a fresh
session, checks conversation ownership again, and commits the assistant message.
Normal stream EOF after nonempty successful generation therefore follows commit.
Empty/whitespace output does not create an assistant message.

Intentional wire change: failure to confirm persistence, including a disappeared
conversation, now ends with the existing `error` event:

```json
{"type":"error","data":"Answer generated, but saving could not be confirmed. Reload the conversation before retrying."}
```

An interrupted connection during commit can leave its outcome uncertain; reload
history before retrying to avoid assuming either success or failure. A generation
error, cancellation or disconnect does not deliberately commit a completed
assistant turn. Cancellation during a commit can itself have an uncertain database
outcome; a distributed commit cannot be undone by claiming cancellation guarantees.
The durable user-message timing, sources, retrieval filtering and provider fallback
are unchanged. No internal database detail is sent to clients.

The current frontend parser already handles `error` events. For frontend-redesign,
retain generated text as unsaved/error state when this terminal event arrives;
never display a saved/completed indicator solely because tokens were received.
No frontend branch was edited by this backend change.
