import assert from "node:assert/strict";
import { test } from "node:test";
import { getMapPreviewPosition } from "../lib/map-preview-position";

const viewport = { width: 1000, height: 600 };
const card = { width: 320, height: 240 };

test("preview follows the marker with a visible gap", () => {
  assert.deepEqual(getMapPreviewPosition({ x: 400, y: 300 }, viewport, card), {
    left: 424,
    top: 258,
  });
});

test("preview flips left when the right side has insufficient room", () => {
  assert.deepEqual(getMapPreviewPosition({ x: 900, y: 300 }, viewport, card), {
    left: 556,
    top: 258,
  });
});

test("preview stays inside every edge even when the marker is offscreen", () => {
  for (const x of [-100, 0, 500, 1000, 1200]) {
    for (const y of [-100, 0, 300, 600, 800]) {
      const result = getMapPreviewPosition({ x, y }, viewport, card);
      assert.ok(result.left >= 12);
      assert.ok(result.top >= 12);
      assert.ok(result.left + card.width <= viewport.width - 12);
      assert.ok(result.top + card.height <= viewport.height - 12);
    }
  }
});

test("preview accommodates a narrow map and its maximum-height card", () => {
  assert.deepEqual(
    getMapPreviewPosition(
      { x: 100, y: 80 },
      { width: 280, height: 200 },
      { width: 256, height: 176 },
    ),
    { left: 12, top: 12 },
  );
});
