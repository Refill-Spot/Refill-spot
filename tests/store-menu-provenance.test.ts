import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { MenuItem } from "../types/menu";
import type { StoreFromDb } from "../types/store";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
let mapStoreFromDb: (typeof import("../lib/stores"))["mapStoreFromDb"];
before(async () => {
  ({ mapStoreFromDb } = await import("../lib/stores"));
});

const store: StoreFromDb = {
  id: 2267,
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

const menu: MenuItem = {
  name: "성인 저녁 무한리필",
  type: "성인 저녁 (주말 포함)",
  order: 1,
  price: "19,900원 / 1인",
  price_numeric: 19900,
  is_recommended: true,
};

test("public store mapping hides provenance without losing menus or mutating stored data", () => {
  const menus = [
    { ...menu, type: "browser_verified" },
    { ...menu, order: 2, type: " \t browser_verified\n" },
    { ...menu, order: 3 },
    { ...menu, order: 4, type: "Adult dinner" },
  ];
  const original = structuredClone(menus);
  const expected = [
    { ...menus[0], type: "" },
    { ...menus[1], type: "" },
    menus[2],
    menus[3],
  ];

  for (const value of [menus, JSON.stringify(menus)]) {
    const result = mapStoreFromDb({ ...store, refill_items: value });
    assert.deepEqual(result.refillItems, expected);
    assert.deepEqual(menus, original);
  }
});

test("provenance matching is trimmed and case-sensitive, not an English or underscore filter", () => {
  for (const type of [
    "regular",
    " Adult dinner ",
    "성인 저녁 (주말 포함)",
    "adult_dinner",
    "Browser_Verified",
    " BROWSER_VERIFIED ",
    "browser_verified menu",
    "browser_verified_special",
    "",
    "   ",
  ]) {
    for (const value of [
      [{ ...menu, type }],
      JSON.stringify([{ ...menu, type }]),
    ]) {
      assert.deepEqual(
        mapStoreFromDb({ ...store, refill_items: value }).refillItems,
        [{ ...menu, type }],
      );
    }
  }
});

test("provenance normalization changes only the menu type field", () => {
  const item = {
    ...menu,
    name: "browser_verified 메뉴 설명",
    type: "browser_verified",
    price: "browser_verified / 가격 문의",
    price_numeric: 0,
  };

  assert.deepEqual(
    mapStoreFromDb({ ...store, refill_items: [item] }).refillItems,
    [{ ...item, type: "" }],
  );
});

test("normalization preserves malformed menu rejection instead of coercing or partially accepting data", () => {
  const { type: _type, ...missingType } = menu;
  for (const value of [
    { ...menu, type: "browser_verified" },
    [missingType],
    [{ ...menu, type: null }],
    [{ ...menu, type: 123 }],
    [{ ...menu, type: "browser_verified", price: 19900 }],
    [{ ...menu, type: "browser_verified", price_numeric: "19900" }],
    [{ ...menu, type: "browser_verified", order: "1" }],
    [{ ...menu, type: "browser_verified", is_recommended: "true" }],
    [{ ...menu, type: "browser_verified" }, { name: "Incomplete menu" }],
  ]) {
    for (const representation of [value, JSON.stringify(value)]) {
      assert.equal(
        mapStoreFromDb({ ...store, refill_items: representation }).refillItems,
        null,
      );
    }
  }

  assert.equal(
    mapStoreFromDb({ ...store, refill_items: "{" }).refillItems,
    null,
  );
});
