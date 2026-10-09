import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeReviews } from "../lib/review-summary";

test("review summary averages valid ratings and rounds to one decimal", () => {
  assert.deepEqual(
    summarizeReviews([{ rating: 1 }, { rating: 2 }, { rating: 5 }]),
    { avgRating: 2.7, reviewCount: 3 },
  );
});

test("invalid ratings and malformed rows do not contribute to aggregates", () => {
  const reviews = [
    { rating: 4 },
    { rating: 5 },
    ...[0, -1, 0.5, 5.1, NaN, Infinity, -Infinity, "4", null, true].map(
      (rating) => ({ rating }),
    ),
    {},
    null,
    undefined,
    "review",
  ];

  assert.deepEqual(summarizeReviews(reviews), {
    avgRating: 4.5,
    reviewCount: 2,
  });
});

test("a successful empty query reports zero reviews without a zero-star rating", () => {
  const summary = summarizeReviews([], null);

  assert.deepEqual(summary, { reviewCount: 0 });
  assert.equal(Object.hasOwn(summary, "avgRating"), false);
});

test("failed queries never claim zero reviews or use partially returned data", () => {
  const error = { code: "query_failed", message: "Reviews unavailable" };

  for (const reviews of [null, [], [{ rating: 5 }]]) {
    const summary = summarizeReviews(reviews, error);

    assert.deepEqual(summary, {});
    assert.equal(Object.hasOwn(summary, "reviewCount"), false);
    assert.equal(Object.hasOwn(summary, "avgRating"), false);
  }
});

test("missing or malformed results remain unavailable rather than empty", () => {
  for (const reviews of [null, undefined, {}, "reviews"]) {
    assert.deepEqual(summarizeReviews(reviews), {});
  }
});

test("nonempty results with no valid rating are not represented as zero reviews", () => {
  assert.deepEqual(summarizeReviews([{ rating: NaN }, { rating: 0 }]), {});
});

test("recomputing after create and delete updates both aggregate fields", () => {
  const firstReview = { rating: 2 };
  const newReview = { rating: 5 };

  assert.deepEqual(summarizeReviews([firstReview]), {
    avgRating: 2,
    reviewCount: 1,
  });
  assert.deepEqual(summarizeReviews([firstReview, newReview]), {
    avgRating: 3.5,
    reviewCount: 2,
  });
  assert.deepEqual(summarizeReviews([newReview]), {
    avgRating: 5,
    reviewCount: 1,
  });
  assert.deepEqual(summarizeReviews([]), { reviewCount: 0 });
});
