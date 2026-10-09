import assert from "node:assert/strict";
import { test } from "node:test";
import { mapStoredExternalRatings } from "../lib/external-ratings";
import { reconcileSelectedStore } from "../lib/map-selection";
import type { Store } from "../types/store";

function store(id: number, overrides: Partial<Store> = {}): Store {
  return {
    id,
    name: `가게 ${id}`,
    address: "서울시 중구",
    categories: ["한식"],
    rating: mapStoredExternalRatings({}),
    position: { lat: 37.5, lng: 127, x: 127, y: 37.5 },
    refillItems: null,
    openHours: null,
    phoneNumber: null,
    ...overrides,
  };
}

test("a marker selected during replacement cannot survive an excluding response", () => {
  const oldMarker = store(1);
  const acceptedStores = [store(2), store(3)];

  assert.equal(reconcileSelectedStore(oldMarker, acceptedStores), null);
});

test("a retained selection uses the accepted object and its refreshed preview data", () => {
  const oldMarker = store(1, { distance: "5", avgRating: 2, reviewCount: 1 });
  const refreshed = store(1, {
    name: "새 가게 이름",
    address: "새 주소",
    distance: "0.2",
    avgRating: 4.5,
    reviewCount: 12,
    position: { lat: 37.6, lng: 127.1, x: 127.1, y: 37.6 },
  });

  const selected = reconcileSelectedStore(oldMarker, [store(2), refreshed]);

  assert.equal(selected, refreshed);
  assert.notEqual(selected, oldMarker);
  assert.equal(selected?.distance, "0.2");
  assert.equal(selected?.name, "새 가게 이름");
  assert.deepEqual(selected?.position, refreshed.position);
  assert.equal(oldMarker.distance, "5");
});

test("a delayed old marker click resolves against the current accepted results", () => {
  const oldMarker = store(1);
  const refreshed = store(1, { phoneNumber: "02-1234-5678" });

  assert.equal(reconcileSelectedStore(oldMarker, [refreshed]), refreshed);
  assert.equal(reconcileSelectedStore(oldMarker, [store(2)]), null);
});

test("empty results and an unselected result list never create a preview", () => {
  assert.equal(reconcileSelectedStore(store(1), []), null);
  assert.equal(reconcileSelectedStore(null, [store(1)]), null);
  assert.equal(reconcileSelectedStore(null, []), null);
});
