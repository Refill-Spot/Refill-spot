import assert from "node:assert/strict";
import { test } from "node:test";
import {
  storeIdQuerySchema,
  favoriteSchema,
  paginationQuerySchema,
  contactQuerySchema,
} from "../lib/validations";

test("favorite removal never truncates malformed identifiers into another store ID", () => {
  for (const value of [
    "12junk",
    "12.5",
    "1e2",
    "-1",
    "0",
    " ",
    null,
    "9007199254740992",
  ]) {
    assert.equal(
      storeIdQuerySchema.safeParse(value).success,
      false,
      String(value),
    );
  }
  assert.equal(storeIdQuerySchema.parse("12"), 12);
});

test("favorite creation requires a positive safe integer store identifier", () => {
  const schema = favoriteSchema.pick({ store_id: true });
  for (const value of [
    "12",
    0,
    -1,
    2.5,
    Infinity,
    NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(schema.safeParse({ store_id: value }).success, false);
  }
  assert.deepEqual(schema.parse({ store_id: 12, user_id: "ignored" }), {
    store_id: 12,
  });
});

test("administrative pagination and contact filters reject malformed inputs", () => {
  for (const query of [
    { page: "-1" },
    { page: "2junk" },
    { page: "1.5" },
    { limit: "0" },
    { limit: "101" },
    { page: "10001" },
  ]) {
    assert.equal(paginationQuerySchema.safeParse(query).success, false);
  }
  assert.equal(
    contactQuerySchema.safeParse({ status: "anything" }).success,
    false,
  );
  assert.equal(
    contactQuerySchema.safeParse({ type: "anything" }).success,
    false,
  );
  assert.deepEqual(
    contactQuerySchema.parse({
      page: "2",
      limit: "5",
      status: "pending",
      type: "inquiry",
    }),
    { page: 2, limit: 5, status: "pending", type: "inquiry" },
  );
});
