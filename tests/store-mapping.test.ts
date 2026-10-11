import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { StoreFromDb } from "../types/store";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
let mapStoreFromDb: (typeof import("../lib/stores"))["mapStoreFromDb"];
before(async () => {
  ({ mapStoreFromDb } = await import("../lib/stores"));
});

const store: StoreFromDb = {
  id: 1,
  name: "Test store",
  address: "Test address",
  naver_rating: null,
  kakao_rating: null,
  position_lat: 0,
  position_lng: 0,
  position_x: 0,
  position_y: 0,
  refill_items: null,
  open_hours: null,
  phone_number: null,
  break_time: null,
  categories: [],
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};
const menu = {
  name: "Lunch",
  type: "regular",
  order: 1,
  price: "10000",
  price_numeric: 10000,
  is_recommended: false,
};

test("store mapping retains zero distance and valid persisted menu representations", () => {
  assert.equal(mapStoreFromDb(store, 0).distance, "0");
  for (const value of [[menu], JSON.stringify([menu])]) {
    assert.deepEqual(
      mapStoreFromDb({ ...store, refill_items: value }).refillItems,
      [menu],
    );
  }
});

test("malformed menu JSON cannot reach array-based rendering", () => {
  for (const value of [
    "{",
    { name: "Not an array" },
    [{ name: "Missing price" }],
  ]) {
    assert.equal(
      mapStoreFromDb({ ...store, refill_items: value }).refillItems,
      null,
    );
  }
});
