import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../app/api/stores/ratings/route";

test("ratings GET reports unavailable providers without caching or fabricated scores", async () => {
  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.success, false);
  assert.deepEqual(body, {
    success: false,
    error: {
      code: "EXTERNAL_RATINGS_UNAVAILABLE",
      message: "외부 평점 제공 경로가 연결되지 않았습니다.",
    },
    data: {
      naver: { status: "unsupported" },
      kakao: { status: "unsupported" },
    },
  });

  for (const field of ["naverRating", "kakaoRating", "averageRating"]) {
    assert.equal(Object.hasOwn(body.data, field), false);
  }
  for (const provider of [body.data.naver, body.data.kakao]) {
    assert.equal(
      Object.values(provider).some((value) => typeof value === "number"),
      false,
    );
  }
});
