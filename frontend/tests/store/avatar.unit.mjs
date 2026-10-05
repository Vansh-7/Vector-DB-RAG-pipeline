import assert from "node:assert/strict";
import { test } from "node:test";
import { AVATAR_COUNT, getAvatarIndex, getAvatarInitial } from "../../src/lib/avatar.ts";

test("the same account always gets the same portrait, including equivalent string IDs", () => {
  for (const id of [0, 1, 42, 123456, "account-42"]) {
    assert.equal(getAvatarIndex(id), getAvatarIndex(id));
    assert.equal(getAvatarIndex(id), getAvatarIndex(String(id)));
  }
});

test("account IDs distribute across the whole local portrait family", () => {
  const variants = Array.from({ length: 256 }, (_, index) => getAvatarIndex(index + 1));
  assert.equal(new Set(variants).size, AVATAR_COUNT);
  for (let index = 0; index < AVATAR_COUNT; index++) {
    assert.ok(variants.filter((value) => value === index).length >= 20);
  }
});

test("unavailable IDs use initials without inventing an avatar identity", () => {
  for (const id of [null, undefined, "", "  ", NaN, Infinity]) assert.equal(getAvatarIndex(id), null);
  assert.equal(getAvatarInitial(" reader@example.com"), "R");
  assert.equal(getAvatarInitial(null), "U");
  assert.equal(getAvatarInitial(""), "U");
});
