import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useCanvasStore } from "../../src/store/canvasStore.ts";

afterEach(() => useCanvasStore.getState().clearAll());

test("clearAll resets retrieval inspection together in one store update", () => {
  const store = useCanvasStore.getState();
  store.setHighlighted(["source-1", "source-2"], { "source-1": 0.1, "source-2": 0.2 });
  store.setQueryPoint({ x: 40, y: 50 });
  const updates = [];
  const unsubscribe = useCanvasStore.subscribe(({ highlightedIds, highlightedScores, queryPoint, sourceQueryHandoff }) => {
    updates.push({ highlightedIds, highlightedScores, queryPoint, sourceQueryHandoff });
  });
  try {
    store.clearAll();
    assert.deepEqual(updates, [{ highlightedIds: [], highlightedScores: {}, queryPoint: null, sourceQueryHandoff: null }]);
    assert.equal(useCanvasStore.getState().setHighlighted, store.setHighlighted);
    assert.equal(useCanvasStore.getState().setQueryPoint, store.setQueryPoint);
  } finally {
    unsubscribe();
  }
});

test("source handoff replaces an old projection but keeps the cited vector and score", () => {
  const store = useCanvasStore.getState();
  store.setQueryPoint({ x: 1, y: 2 });
  store.beginSourceHandoff("cited-vector", 0.8, "Original question?");
  const handoff = useCanvasStore.getState().sourceQueryHandoff;
  assert.equal(useCanvasStore.getState().queryPoint, null);
  assert.deepEqual(handoff, { query: "Original question?", status: "pending" });
  store.finishSourceHandoff(handoff, { x: 40, y: 50 });
  assert.deepEqual(useCanvasStore.getState().highlightedIds, ["cited-vector"]);
  assert.deepEqual(useCanvasStore.getState().highlightedScores, { "cited-vector": 0.8 });
  assert.deepEqual(useCanvasStore.getState().queryPoint, { x: 40, y: 50 });
  assert.equal(useCanvasStore.getState().sourceQueryHandoff.status, "ready");
});

test("projection failure retains the original citation without a stale query point", () => {
  const store = useCanvasStore.getState();
  store.beginSourceHandoff("cited-vector", 0.8, "Original question?");
  store.finishSourceHandoff(useCanvasStore.getState().sourceQueryHandoff, null);
  assert.deepEqual(useCanvasStore.getState().highlightedIds, ["cited-vector"]);
  assert.deepEqual(useCanvasStore.getState().highlightedScores, { "cited-vector": 0.8 });
  assert.equal(useCanvasStore.getState().queryPoint, null);
  assert.equal(useCanvasStore.getState().sourceQueryHandoff.status, "unavailable");
});

test("late projections cannot restore a reset or overwrite a newer handoff or Search", () => {
  const store = useCanvasStore.getState();
  for (const replacement of ["reset", "source", "search"]) {
    store.beginSourceHandoff("old-vector", 0.8, "Older question?");
    const oldHandoff = useCanvasStore.getState().sourceQueryHandoff;
    if (replacement === "reset") store.clearAll();
    if (replacement === "source") store.beginSourceHandoff("new-vector", 0.4, "New question?");
    if (replacement === "search") {
      store.setHighlighted(["search-result"], { "search-result": 0.2 });
      store.setQueryPoint({ x: 10, y: 20 });
    }
    const expected = useCanvasStore.getState();
    store.finishSourceHandoff(oldHandoff, { x: 100, y: 200 });
    assert.equal(useCanvasStore.getState(), expected);
    store.finishSourceHandoff(oldHandoff, null);
    assert.equal(useCanvasStore.getState(), expected);
  }
});

test("a source with no originating question never starts a projection request", () => {
  useCanvasStore.getState().beginSourceHandoff("cited-vector", 0.8, null);
  assert.equal(useCanvasStore.getState().sourceQueryHandoff, null);
  assert.deepEqual(useCanvasStore.getState().highlightedIds, ["cited-vector"]);
});

test("clearAll also clears a source-only handoff and can be repeated", () => {
  useCanvasStore.getState().setHighlighted(["source-1"], { "source-1": 0.8 });
  useCanvasStore.getState().clearAll();
  useCanvasStore.getState().clearAll();
  const { highlightedIds, highlightedScores, queryPoint } = useCanvasStore.getState();
  assert.deepEqual({ highlightedIds, highlightedScores, queryPoint }, {
    highlightedIds: [], highlightedScores: {}, queryPoint: null,
  });
});
