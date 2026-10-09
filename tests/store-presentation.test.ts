import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatStoreDistance,
  getRepresentativeMenu,
} from "../lib/store-presentation";
import type { MenuItem } from "../types/menu";

const menu = (name: string, price: string, recommended = false): MenuItem => ({
  name,
  price,
  type: "성인 저녁",
  order: 0,
  price_numeric: 0,
  is_recommended: recommended,
});

test("representative menu prioritizes an actual priced recommendation", () => {
  const ordinary = menu("점심", "12,900원");
  const recommended = menu("저녁", "19,900원", true);
  assert.equal(
    getRepresentativeMenu({ refillItems: [ordinary, recommended] }),
    recommended,
  );
});

test("unpriced recommendation cannot hide an available price", () => {
  const unpriced = menu("추천 메뉴", "  ", true);
  const priced = menu("고기", "19,900원");
  assert.equal(
    getRepresentativeMenu({ refillItems: [unpriced, priced] }),
    priced,
  );
});

test("missing prices preserve menu information without fabricating a price", () => {
  const unpriced = menu("고기", "");
  assert.equal(getRepresentativeMenu({ refillItems: [unpriced] }), unpriced);
  assert.equal(getRepresentativeMenu({ refillItems: [] }), undefined);
  assert.equal(getRepresentativeMenu({ refillItems: null }), undefined);
});

test("distance adds units only to numeric values, including zero", () => {
  assert.equal(formatStoreDistance(" 1.25 "), "1.25km");
  assert.equal(formatStoreDistance("0"), "0km");
  assert.equal(formatStoreDistance("1.2km"), "1.2km");
  assert.equal(formatStoreDistance("350m"), "350m");
  assert.equal(formatStoreDistance("  "), null);
  assert.equal(formatStoreDistance(null), null);
  assert.equal(formatStoreDistance(undefined), null);
});
