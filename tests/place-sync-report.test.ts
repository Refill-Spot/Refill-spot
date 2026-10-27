import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlaceCandidate } from "../lib/place-matching";
import {
  fingerprintStore,
  type Platform,
  type SyncStore,
} from "../lib/place-sync";
import {
  canResumeStoredResult,
  toStoredSyncResult,
  type StoredSyncResult,
} from "../lib/place-sync-report";

const checkedAt = "2026-10-24T15:00:00.000Z";
const day = 86_400_000;
const store: SyncStore = {
  id: 1,
  name: "무한리필 강남점",
  address: "서울특별시 강남구 테헤란로 10 역삼동",
  phoneNumber: "02-1234-5678",
  position: { lat: 37.5, lng: 127 },
  naverPlaceId: null,
  kakaoPlaceId: null,
};

function summary(platform: Platform, identity = store): StoredSyncResult {
  const reference = {
    id: "123",
    url:
      platform === "naver"
        ? "https://m.place.naver.com/place/123/home"
        : "https://place.map.kakao.com/123",
  };
  return {
    storeId: identity.id,
    platform,
    fingerprint: fingerprintStore(identity),
    checkedAt,
    status: "matched",
    reason: "phone-name-local-address",
    candidate: { ...reference },
    candidates: [{ ...reference }],
    applied: false,
  };
}

for (const platform of ["naver", "kakao"] as const) {
  test(`${platform}: serialization strips business fields and all extra properties`, () => {
    const expected = summary(platform);
    const place: PlaceCandidate = {
      ...expected.candidate!,
      name: "provider-business-name",
      address: "provider-business-address",
      phoneNumber: "02-9876-5432",
      lat: 37.5123456,
      lng: 127.1234567,
    };
    const raw = {
      ...expected,
      candidate: { ...place, providerSecret: "private-provider-response" },
      candidates: [
        { ...place, providerCategory: "provider-business-category" },
      ],
      providerResponse: { name: place.name, address: place.address },
    };
    const stored = toStoredSyncResult(raw);
    assert.deepEqual(stored, expected);
    assert.doesNotMatch(
      JSON.stringify(stored),
      /provider-|"(?:phoneNumber|address|name|lat|lng)"|37\.5123456|127\.1234567|02-9876-5432/,
    );
    const untrustedStored = {
      ...stored,
      providerResponse: raw.providerResponse,
      candidate: raw.candidate,
      candidates: raw.candidates,
    };
    assert.deepEqual(toStoredSyncResult(untrustedStored), expected);
    raw.candidate.id = "456";
    raw.candidates[0].url = "https://untrusted.test/456";
    assert.deepEqual(
      stored,
      expected,
      "Stored references must be independent copies",
    );
  });

  test(`${platform}: resume rejects invalid, cross-provider and inconsistent references`, () => {
    const saved = summary(platform);
    const reference = saved.candidate!;
    const otherUrl =
      platform === "naver"
        ? "https://place.map.kakao.com/123"
        : "https://m.place.naver.com/place/123/home";
    for (const invalid of [
      { ...reference, id: "0" },
      { ...reference, id: "01" },
      { ...reference, id: "-1" },
      { ...reference, id: "123 " },
      { ...reference, id: "456" },
      { ...reference, url: otherUrl },
      { ...reference, url: `${reference.url}?extra=1` },
      { ...reference, url: reference.url.replace("https:", "http:") },
      { ...reference, url: "https://untrusted.test/123" },
      { ...reference, name: "unexpected retained business data" },
      { id: reference.id },
      null,
      "123",
    ]) {
      assert.equal(
        canResumeStoredResult(
          store,
          platform,
          { ...saved, candidate: invalid, candidates: [invalid] },
          new Date(checkedAt),
        ),
        false,
        JSON.stringify(invalid),
      );
      assert.equal(
        canResumeStoredResult(
          store,
          platform,
          { ...saved, candidates: [reference, invalid] },
          new Date(checkedAt),
        ),
        false,
        "Every reference must be valid, not only the selected one",
      );
    }
    for (const invalid of [
      { ...saved, candidate: undefined },
      { ...saved, candidates: [] },
      {
        ...saved,
        candidates: [{ id: "456", url: reference.url.replace("123", "456") }],
      },
      { ...saved, providerResponse: "unexpected retained data" },
      { ...saved, candidates: Array(101).fill(reference) },
    ])
      assert.equal(
        canResumeStoredResult(store, platform, invalid, new Date(checkedAt)),
        false,
      );
  });

  test(`${platform}: resume enforces the 24-hour boundary and rejects future or invalid clocks`, () => {
    const saved = summary(platform);
    const time = Date.parse(checkedAt);
    assert.equal(
      canResumeStoredResult(store, platform, saved, new Date(time + day)),
      true,
    );
    for (const now of [
      new Date(time + day + 1),
      new Date(time - 1),
      new Date(NaN),
    ])
      assert.equal(canResumeStoredResult(store, platform, saved, now), false);
    for (const invalidTime of [
      "not-a-date",
      "2026-02-30T00:00:00.000Z",
      "2026-10-24T15:00:00",
    ])
      assert.equal(
        canResumeStoredResult(
          store,
          platform,
          { ...saved, checkedAt: invalidTime },
          new Date(time),
        ),
        false,
      );
    assert.equal(
      canResumeStoredResult(
        store,
        platform,
        { ...saved, checkedAt: "2026-10-25T00:00:00.000+09:00" },
        new Date(time),
      ),
      true,
    );
  });

  test(`${platform}: forged applied summaries cannot skip a null or different database ID`, () => {
    const forged = { ...summary(platform), applied: true };
    assert.equal(
      canResumeStoredResult(store, platform, forged, new Date(checkedAt)),
      false,
    );
    const field = platform === "naver" ? "naverPlaceId" : "kakaoPlaceId";
    for (const id of ["123", "456"]) {
      const linked = { ...store, [field]: id };
      const saved = { ...summary(platform, linked), applied: true };
      assert.equal(
        canResumeStoredResult(linked, platform, saved, new Date(checkedAt)),
        id === "123",
      );
      assert.equal(
        canResumeStoredResult(
          linked,
          platform,
          { ...saved, applied: false },
          new Date(checkedAt),
        ),
        id === "123",
      );
    }
  });

  test(`${platform}: resume requires the current store, provider and identity fingerprint`, () => {
    const saved = summary(platform);
    for (const invalid of [
      { ...saved, storeId: 2 },
      { ...saved, platform: platform === "naver" ? "kakao" : "naver" },
      { ...saved, fingerprint: "forged" },
      { ...saved, status: "error" },
      { ...saved, status: "conflict" },
    ])
      assert.equal(
        canResumeStoredResult(store, platform, invalid, new Date(checkedAt)),
        false,
      );
    assert.equal(
      canResumeStoredResult(
        { ...store, address: "변경된 주소" },
        platform,
        saved,
        new Date(checkedAt),
      ),
      false,
    );
  });

  test(`${platform}: nonmatched summaries must not claim a selected or applied place`, () => {
    for (const status of ["unmatched", "ambiguous"] as const) {
      const saved = { ...summary(platform), status, candidate: undefined };
      assert.equal(
        canResumeStoredResult(store, platform, saved, new Date(checkedAt)),
        true,
      );
      assert.equal(
        canResumeStoredResult(
          store,
          platform,
          { ...saved, applied: true },
          new Date(checkedAt),
        ),
        false,
      );
      assert.equal(
        canResumeStoredResult(
          store,
          platform,
          { ...saved, candidate: saved.candidates[0] },
          new Date(checkedAt),
        ),
        false,
      );
    }
  });
}
