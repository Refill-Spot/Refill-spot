import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExternalRatings } from "../components/external-ratings";
import { mapStoredExternalRatings } from "../lib/external-ratings";

test("comparison shows both providers without publishing unverified scores", () => {
  const html = renderToStaticMarkup(
    createElement(ExternalRatings, {
      ratings: mapStoredExternalRatings({
        naver_rating: 4.8,
        kakao_rating: 3.2,
      }),
    }),
  );
  assert.match(html, /네이버/);
  assert.match(html, /카카오/);
  assert.match(html, /저장된 평점 검증 필요/);
  assert.match(html, /외부 평점 자동 연동은 현재 지원되지 않습니다/);
  assert.doesNotMatch(html, /4\.8|3\.2/);
});

test("comparison distinguishes missing values from malformed data", () => {
  const html = renderToStaticMarkup(
    createElement(ExternalRatings, {
      ratings: mapStoredExternalRatings({
        naver_rating: null,
        kakao_rating: 9,
      }),
    }),
  );
  assert.match(html, /네이버 · 평점 정보 없음/);
  assert.match(html, /카카오 · 평점 데이터 확인 필요/);
  assert.doesNotMatch(html, /0점|9점/);
});
