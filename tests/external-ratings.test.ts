import assert from "node:assert/strict";
import { test } from "node:test";
import {
  externalRatingLabel,
  mapStoredExternalRating,
  mapStoredExternalRatings,
} from "../lib/external-ratings";

test("missing external ratings never become zero-star scores", () => {
  for (const value of [null, undefined, 0]) {
    const rating = mapStoredExternalRating(value);
    assert.equal(rating.score, null);
    assert.equal(rating.status, "unavailable");
    assert.equal(externalRatingLabel(rating), "평점 정보 없음");
  }
});

test("legacy values are preserved without claiming verification or provenance", () => {
  for (const value of [0.5, 4.7, 5]) {
    const rating = mapStoredExternalRating(value);
    assert.equal(rating.score, value);
    assert.equal(rating.status, "unverified");
    assert.equal(rating.sourceUrl, null);
    assert.equal(rating.checkedAt, null);
    assert.equal(rating.reviewCount, null);
    assert.equal(externalRatingLabel(rating), "저장된 평점 검증 필요");
    assert.ok(!externalRatingLabel(rating).includes(String(value)));
  }
});

test("invalid stored values are distinguished from absent ratings", () => {
  for (const value of [-1, 5.1, NaN, Infinity, "4.5", "", {}, true]) {
    const rating = mapStoredExternalRating(value);
    assert.equal(rating.status, "invalid");
    assert.equal(rating.score, null);
    assert.equal(externalRatingLabel(rating), "평점 데이터 확인 필요");
  }
});

test("provider scores remain independent and original records stay untouched", () => {
  const row = Object.freeze({
    naver_rating: 4.8,
    kakao_rating: null,
    updated_at: "2026-10-09T00:00:00Z",
  });
  const ratings = mapStoredExternalRatings(row);
  assert.equal(ratings.naver.score, 4.8);
  assert.equal(ratings.naver.status, "unverified");
  assert.equal(ratings.kakao.score, null);
  assert.equal(ratings.kakao.status, "unavailable");
  assert.equal(ratings.naver.checkedAt, null);
  assert.deepEqual(row, {
    naver_rating: 4.8,
    kakao_rating: null,
    updated_at: "2026-10-09T00:00:00Z",
  });
  assert.ok(!("averageRating" in ratings));
});
