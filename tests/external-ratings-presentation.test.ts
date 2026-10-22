import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExternalRatings } from "../components/external-ratings";
import { mapStoredExternalRatings } from "../lib/external-ratings";

function textContent(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

test("comparison shows both providers without publishing unverified scores", () => {
  const html = renderToStaticMarkup(
    createElement(ExternalRatings, {
      ratings: mapStoredExternalRatings({
        naver_rating: 4.8,
        kakao_rating: 3.2,
      }),
    }),
  );
  const text = textContent(html);
  assert.match(text, /네이버 · 저장된 평점 검증 필요/);
  assert.match(text, /카카오 · 저장된 평점 검증 필요/);
  assert.match(text, /외부 평점 자동 연동은 현재 지원되지 않습니다/);
  assert.doesNotMatch(text, /4\.8|3\.2/);
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
  const text = textContent(html);
  assert.match(text, /네이버 · 평점 정보 없음/);
  assert.match(text, /카카오 · 평점 데이터 확인 필요/);
  assert.doesNotMatch(text, /0점|9점/);
});

test("provider panels use distinct green and yellow surfaces with dark text", () => {
  const html = renderToStaticMarkup(
    createElement(ExternalRatings, { ratings: mapStoredExternalRatings({}) }),
  );
  const naver = html.match(/<span class="([^"]+)"><strong>네이버<\/strong>/);
  const kakao = html.match(/<span class="([^"]+)"><strong>카카오<\/strong>/);
  assert.ok(naver);
  assert.ok(kakao);
  assert.match(naver[1], /\bbg-green-50\b/);
  assert.match(naver[1], /\btext-green-900\b/);
  assert.match(kakao[1], /\bbg-yellow-50\b/);
  assert.match(kakao[1], /\btext-yellow-950\b/);
  assert.doesNotMatch(kakao[1], /\btext-white\b/);
});
