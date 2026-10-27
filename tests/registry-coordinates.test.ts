import assert from "node:assert/strict";
import { test } from "node:test";
import {
  registryCoordinates,
  coordinateDistanceMeters,
} from "../lib/registry-coordinates";
test("official registry sample aligns with independently stored branch location", () => {
  const result = registryCoordinates("210707.335293497", "447221.029850905");
  assert.ok(
    coordinateDistanceMeters(result, { lat: 37.5272419, lng: 127.1217769 }) <
      10,
  );
  assert.ok(Math.abs(result.lat - 37.5272868669) < 1e-7);
  assert.ok(Math.abs(result.lng - 127.1217978686) < 1e-7);
});
test("missing, nonfinite, swapped and outside-region coordinates are rejected", () => {
  for (const [x, y] of [
    ["", "447221"],
    [" ", "447221"],
    ["NaN", "447221"],
    ["Infinity", "447221"],
    ["0", "447221"],
    ["447221", "210707"],
    ["1", "1"],
  ])
    assert.throws(() => registryCoordinates(x, y));
});
test("distance detects large movements instead of silently treating them as correction", () => {
  assert.ok(
    coordinateDistanceMeters(
      { lat: 37.52, lng: 127.12 },
      { lat: 37.54, lng: 127.12 },
    ) > 2000,
  );
});
