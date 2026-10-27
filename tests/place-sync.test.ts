import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlaceCandidate } from "../lib/place-matching";
import {
  canReuseResult,
  fingerprintStore,
  syncStorePlatform,
  type Platform,
  type SyncResult,
  type SyncStore,
} from "../lib/place-sync";

const checkedAt = "2026-10-24T15:00:00.000Z";
const now = () => new Date(checkedAt);
const day = 86_400_000;
const platforms: Platform[] = ["naver", "kakao"];

function store(overrides: Partial<SyncStore> = {}): SyncStore {
  return {
    id: 1,
    name: "무한리필 강남점",
    address: "서울특별시 강남구 테헤란로 10 역삼동",
    phoneNumber: "02-1234-5678",
    position: { lat: 37.5, lng: 127 },
    naverPlaceId: null,
    kakaoPlaceId: null,
    ...overrides,
  };
}

function candidate(
  platform: Platform = "kakao",
  overrides: Partial<PlaceCandidate> = {},
): PlaceCandidate {
  const id = overrides.id ?? "123";
  return {
    id,
    name: "무한리필 강남점",
    address: "서울 강남구 테헤란로 10 역삼동",
    phoneNumber: "02-1234-5678",
    lat: 37.5,
    lng: 127,
    url:
      platform === "naver"
        ? `https://m.place.naver.com/place/${id}/home`
        : `https://place.map.kakao.com/${id}`,
    ...overrides,
  };
}

async function matchedResult(
  value = store(),
  platform: Platform = "kakao",
): Promise<SyncResult> {
  return syncStorePlatform(value, platform, {
    lookup: async () => [candidate(platform)],
    now,
  });
}

for (const platform of platforms) {
  test(`${platform}: dry run preserves evidence without changing the store`, async () => {
    const value = store();
    const before = structuredClone(value);
    const place = candidate(platform);
    const result = await syncStorePlatform(value, platform, {
      lookup: async (snapshot, selectedPlatform) => {
        assert.deepEqual(snapshot, before);
        assert.equal(selectedPlatform, platform);
        return [Object.assign({}, place, { providerSecret: "not-evidence" })];
      },
      now,
    });
    assert.equal(result.status, "matched");
    assert.equal(result.storeId, value.id);
    assert.equal(result.platform, platform);
    assert.equal(result.checkedAt, checkedAt);
    assert.equal(result.fingerprint, fingerprintStore(before));
    assert.equal(result.applied, false);
    assert.deepEqual(result.candidate, place);
    assert.deepEqual(result.candidates, [place]);
    assert.deepEqual(value, before);
    assert.doesNotMatch(JSON.stringify(result), /providerSecret|not-evidence/);
  });

  test(`${platform}: apply receives the original identity and IDs despite mutations during lookup`, async () => {
    const value = store();
    const expected = structuredClone(value);
    const place = candidate(platform);
    let writes = 0;
    const result = await syncStorePlatform(value, platform, {
      lookup: async (lookupSnapshot) => {
        lookupSnapshot.name = "조회 인수 변경";
        lookupSnapshot.position.lat = 0;
        lookupSnapshot.naverPlaceId = "888";
        value.name = "호출자 원본 변경";
        value.position.lng = 0;
        value.kakaoPlaceId = "999";
        return [place];
      },
      apply: async (snapshot, selectedPlatform, selectedCandidate) => {
        writes++;
        assert.deepEqual(snapshot, expected);
        assert.equal(selectedPlatform, platform);
        assert.deepEqual(selectedCandidate, place);
        selectedCandidate.name = "저장 인수 변경";
        return true;
      },
      now,
    });
    assert.equal(writes, 1);
    assert.equal(result.status, "matched");
    assert.equal(result.applied, true);
    assert.equal(result.fingerprint, fingerprintStore(expected));
    assert.deepEqual(result.candidate, place);
    assert.deepEqual(result.candidates, [place]);
  });

  test(`${platform}: a different existing ID conflicts, but the same ID can be reverified`, async () => {
    const field = platform === "naver" ? "naverPlaceId" : "kakaoPlaceId";
    let writes = 0;
    for (const existingId of ["456", "123"]) {
      const value = store({ [field]: existingId });
      const before = structuredClone(value);
      const result = await syncStorePlatform(value, platform, {
        lookup: async () => [candidate(platform)],
        apply: async (snapshot) => {
          writes++;
          assert.deepEqual(snapshot, before);
          return true;
        },
        now,
      });
      assert.equal(
        result.status,
        existingId === "123" ? "matched" : "conflict",
      );
      assert.equal(result.applied, existingId === "123");
      assert.deepEqual(result.candidates, [candidate(platform)]);
      assert.deepEqual(value, before);
      if (existingId !== "123") {
        assert.equal(writes, 0);
        assert.equal(result.reason, "existing-id-conflict");
      }
    }
    assert.equal(writes, 1);
  });

  test(`${platform}: the other platform's existing ID does not block a match`, async () => {
    const value = store(
      platform === "naver" ? { kakaoPlaceId: "456" } : { naverPlaceId: "456" },
    );
    const result = await matchedResult(value, platform);
    assert.equal(result.status, "matched");
    assert.equal(result.applied, false);
  });

  test(`${platform}: cross-provider evidence cannot be matched or partially ignored`, async () => {
    const other = platform === "naver" ? "kakao" : "naver";
    let writes = 0;
    for (const values of [
      [candidate(other)],
      [candidate(platform), candidate(other, { id: "456" })],
    ]) {
      const result = await syncStorePlatform(store(), platform, {
        lookup: async () => values,
        apply: async () => {
          writes++;
          return true;
        },
        now,
      });
      assert.equal(result.status, "error");
      assert.equal(result.reason, "invalid-provider-candidates");
      assert.equal(result.applied, false);
      assert.deepEqual(
        result.candidates,
        values.filter((value) => value.url === candidate(platform).url),
      );
    }
    assert.equal(writes, 0);
  });
}

test("unmatched and ambiguous evidence never invokes apply or clears existing IDs", async () => {
  const value = store({ naverPlaceId: "987", kakaoPlaceId: "654" });
  const before = structuredClone(value);
  let writes = 0;
  for (const [values, status] of [
    [[], "unmatched"],
    [[candidate("kakao", { name: "다른식당 역삼점" })], "unmatched"],
    [[candidate(), candidate("kakao", { id: "456" })], "ambiguous"],
  ] as const) {
    const result = await syncStorePlatform(value, "kakao", {
      lookup: async () => [...values],
      apply: async () => {
        writes++;
        return true;
      },
      now,
    });
    assert.equal(result.status, status);
    assert.equal(result.applied, false);
    assert.equal(result.candidate, undefined);
    assert.deepEqual(result.candidates, values);
    assert.deepEqual(value, before);
    assert.equal(canReuseResult(value, "kakao", result, now()), true);
  }
  assert.equal(writes, 0);
});

test("lookup failures are sanitized regardless of the thrown value", async () => {
  const secret =
    "Bearer super-secret https://provider.test/?api_key=credential";
  let writes = 0;
  for (const thrown of [new Error(secret), secret, { body: secret }, null]) {
    const value = store({ kakaoPlaceId: "123" });
    const before = structuredClone(value);
    const result = await syncStorePlatform(value, "kakao", {
      lookup: async () => {
        throw thrown;
      },
      apply: async () => {
        writes++;
        return true;
      },
      now,
    });
    assert.equal(result.status, "error");
    assert.equal(result.reason, "lookup-failed");
    assert.equal(result.applied, false);
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(value, before);
    assert.doesNotMatch(
      JSON.stringify(result),
      /Bearer|super-secret|api_key|credential/,
    );
    assert.equal(canReuseResult(value, "kakao", result, now()), false);
  }
  assert.equal(writes, 0);
});

test("CAS failure returns conflict; apply exceptions return sanitized error", async () => {
  const value = store();
  const before = structuredClone(value);
  for (const failsWithException of [false, true]) {
    let writes = 0;
    const result = await syncStorePlatform(value, "kakao", {
      lookup: async () => [candidate()],
      apply: async () => {
        writes++;
        if (failsWithException)
          throw Error("service-role-token raw provider body");
        return false;
      },
      now,
    });
    assert.equal(writes, 1);
    assert.equal(result.status, failsWithException ? "error" : "conflict");
    assert.equal(
      result.reason,
      failsWithException ? "apply-failed" : "apply-conflict",
    );
    assert.equal(result.applied, false);
    assert.deepEqual(result.candidate, candidate());
    assert.deepEqual(result.candidates, [candidate()]);
    assert.deepEqual(value, before);
    assert.doesNotMatch(
      JSON.stringify(result),
      /service-role-token|raw provider/,
    );
    assert.equal(canReuseResult(value, "kakao", result, now()), false);
  }
});

test("malformed candidate URLs and objects fail closed without applying", async () => {
  const invalid: unknown[] = [
    null,
    "123",
    {},
    candidate("kakao", { id: "0123" }),
    candidate("kakao", { url: "https://place.map.kakao.com/456" }),
    candidate("kakao", {
      url: "https://place.map.kakao.com/123?redirect=evil",
    }),
    candidate("kakao", { url: "https://place.map.kakao.com/123#evil" }),
    candidate("kakao", { url: "https://place.map.kakao.com.evil.test/123" }),
    candidate("kakao", { url: "https://secret@place.map.kakao.com/123" }),
    candidate("kakao", { url: "http://place.map.kakao.com/123" }),
    candidate("kakao", { lat: Number.NaN }),
    candidate("kakao", { lng: 181 }),
    { ...candidate(), name: null },
    { ...candidate(), phoneNumber: 212345678 },
    { ...candidate(), lat: "37.5" },
  ];
  let writes = 0;
  for (const entry of invalid) {
    const result = await syncStorePlatform(store(), "kakao", {
      lookup: async () => [entry] as PlaceCandidate[],
      apply: async () => {
        writes++;
        return true;
      },
      now,
    });
    assert.equal(result.status, "error");
    assert.equal(result.reason, "invalid-provider-candidates");
    assert.equal(result.applied, false);
    assert.deepEqual(result.candidates, []);
  }
  for (const values of [null, {}, "provider body"]) {
    const result = await syncStorePlatform(store(), "kakao", {
      lookup: async () => values as unknown as PlaceCandidate[],
      now,
    });
    assert.equal(result.status, "error");
    assert.equal(result.reason, "invalid-provider-candidates");
  }
  assert.equal(writes, 0);
});

test("audit evidence is bounded and an over-limit lookup is never matched after truncation", async () => {
  const values = Array.from({ length: 101 }, (_, index) =>
    candidate("kakao", { id: String(index + 1) }),
  );
  let writes = 0;
  const result = await syncStorePlatform(store(), "kakao", {
    lookup: async () => values,
    apply: async () => {
      writes++;
      return true;
    },
    now,
  });
  assert.equal(result.status, "error");
  assert.equal(result.reason, "candidate-limit-exceeded");
  assert.equal(result.applied, false);
  assert.equal(writes, 0);
  assert.deepEqual(result.candidates, values.slice(0, 100));
});

test("fingerprints include every identity component and both existing IDs", () => {
  const value = store();
  const original = fingerprintStore(value);
  assert.match(original, /^[0-9a-f]{64}$/);
  const reordered = {
    kakaoPlaceId: null,
    position: { lng: 127, lat: 37.5 },
    address: value.address,
    name: value.name,
    id: 1,
    naverPlaceId: null,
    phoneNumber: value.phoneNumber,
  };
  assert.equal(fingerprintStore(reordered), original);
  for (const change of [
    { id: 2 },
    { name: "무한리필 역삼점" },
    { address: "서울 강남구 삼성로 10" },
    { phoneNumber: null },
    { position: { lat: 37.51, lng: 127 } },
    { position: { lat: 37.5, lng: 127.01 } },
    { naverPlaceId: "123" },
    { kakaoPlaceId: "123" },
  ]) {
    assert.notEqual(fingerprintStore(store(change)), original);
  }
});

test("a failing or invalid clock returns only a sanitized error without lookup", async () => {
  let lookups = 0;
  for (const clock of [
    () => new Date(Number.NaN),
    () => {
      throw Error("secret clock details");
    },
  ]) {
    const result = await syncStorePlatform(store(), "kakao", {
      lookup: async () => {
        lookups++;
        return [candidate()];
      },
      now: clock,
    });
    assert.equal(result.status, "error");
    assert.equal(result.reason, "clock-failed");
    assert.equal(result.applied, false);
    assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
    assert.doesNotMatch(JSON.stringify(result), /secret clock details/);
  }
  assert.equal(lookups, 0);
});

test("reuse respects TTL boundaries, future timestamps, provider and identity changes", async () => {
  const value = store();
  const result = await matchedResult(value);
  assert.equal(canReuseResult(value, "kakao", result, now()), true);
  assert.equal(
    canReuseResult(value, "kakao", result, new Date(+now() + day)),
    true,
  );
  assert.equal(
    canReuseResult(value, "kakao", result, new Date(+now() + day + 1)),
    false,
  );
  assert.equal(
    canReuseResult(value, "kakao", result, new Date(+now() - 1)),
    false,
  );
  assert.equal(canReuseResult(value, "naver", result, now()), false);
  assert.equal(
    canReuseResult(value, "kakao", { ...result, storeId: 2 }, now()),
    false,
  );
  assert.equal(
    canReuseResult(value, "kakao", { ...result, fingerprint: "forged" }, now()),
    false,
  );
  for (const change of [
    { id: 2 },
    { name: "무한리필 역삼점" },
    { address: "서울 강남구 삼성로 10" },
    { phoneNumber: null },
    { position: { lat: 37.51, lng: 127 } },
    { position: { lat: 37.5, lng: 127.01 } },
    { naverPlaceId: "123" },
    { kakaoPlaceId: "123" },
  ]) {
    assert.equal(canReuseResult(store(change), "kakao", result, now()), false);
  }
  assert.equal(canReuseResult(value, "kakao", result, now(), 0), true);
  assert.equal(
    canReuseResult(value, "kakao", result, new Date(+now() + 1), 0),
    false,
  );
  for (const maxAge of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(canReuseResult(value, "kakao", result, now(), maxAge), false);
  }
  assert.equal(
    canReuseResult(value, "kakao", result, new Date(Number.NaN)),
    false,
  );
});

test("a dry-run match is reusable evidence, not proof an --apply write happened", async () => {
  const value = store();
  const result = await matchedResult(value);
  assert.equal(result.applied, false);
  assert.equal(canReuseResult(value, "kakao", result, now()), true);
  let writes = 0;
  if (result.status === "matched" && !result.applied) {
    await syncStorePlatform(value, "kakao", {
      lookup: async () => [candidate()],
      apply: async () => {
        writes++;
        return true;
      },
      now,
    });
  }
  assert.equal(writes, 1);
});

test("an applied checkpoint cannot hide a cleared database link", async () => {
  const value = store();
  const result = await matchedResult(value);
  assert.equal(
    canReuseResult(value, "kakao", { ...result, applied: true }, now()),
    false,
  );
  const linked = store({ kakaoPlaceId: "123" });
  const linkedResult = await matchedResult(linked);
  assert.equal(
    canReuseResult(linked, "kakao", { ...linkedResult, applied: true }, now()),
    true,
  );
});

test("reuse rejects malformed report shapes, statuses and timestamps without throwing", async () => {
  const value = store();
  const result = await matchedResult(value);
  for (const malformed of [
    null,
    [],
    true,
    123,
    "report",
    {},
    ...[undefined, null, {}, "unknown", "error", "conflict"].map((status) => ({
      ...result,
      status,
    })),
    ...[
      undefined,
      null,
      {},
      "",
      "not-a-date",
      "2026-02-30T15:00:00.000Z",
      "2026-10-24T24:00:00.000Z",
      "2026-10-24",
      "0",
    ].map((timestamp) => ({ ...result, checkedAt: timestamp })),
    { ...result, applied: "false" },
    { ...result, reason: {} },
    { ...result, candidates: null },
    { ...result, candidates: [null] },
    { ...result, candidates: Array(101).fill(candidate()) },
  ]) {
    assert.equal(canReuseResult(value, "kakao", malformed, now()), false);
  }
  const offsetTimestamp = { ...result, checkedAt: "2026-10-25T00:00:00+09:00" };
  assert.equal(canReuseResult(value, "kakao", offsetTimestamp, now()), true);
  assert.equal(
    canReuseResult(value, "kakao", JSON.parse(JSON.stringify(result)), now()),
    true,
  );
});

test("reuse revalidates the entire matched evidence and rejects forged candidates", async () => {
  const value = store();
  const result = await matchedResult(value);
  const forgeries: unknown[] = [
    undefined,
    null,
    {},
    "123",
    { ...candidate(), id: 123 },
    { ...candidate(), name: null },
    { ...candidate(), address: [] },
    { ...candidate(), phoneNumber: {} },
    { ...candidate(), lat: "37.5" },
    candidate("naver"),
    candidate("kakao", { name: "무한리필 역삼점" }),
    candidate("kakao", { address: "부산 해운대구 센텀로 20" }),
    candidate("kakao", { phoneNumber: "02-9999-9999" }),
    candidate("kakao", { lat: null, lng: null, phoneNumber: null }),
  ];
  for (const forged of forgeries) {
    assert.equal(
      canReuseResult(value, "kakao", { ...result, candidate: forged }, now()),
      false,
    );
    assert.equal(
      canReuseResult(
        value,
        "kakao",
        { ...result, candidate: forged, candidates: [forged] },
        now(),
      ),
      false,
    );
  }
  assert.equal(
    canReuseResult(
      value,
      "kakao",
      { ...result, candidate: candidate("kakao", { id: "456" }) },
      now(),
    ),
    false,
  );
  assert.equal(
    canReuseResult(
      value,
      "kakao",
      {
        ...result,
        candidates: [candidate(), candidate("kakao", { id: "456" })],
      },
      now(),
    ),
    false,
  );
  const existing = store({ kakaoPlaceId: "456" });
  assert.equal(
    canReuseResult(
      existing,
      "kakao",
      { ...result, fingerprint: fingerprintStore(existing) },
      now(),
    ),
    false,
  );
});

test("unmatched and ambiguous reports with impossible applied/candidate state are not reusable", async () => {
  const value = store();
  const matched = await matchedResult(value);
  for (const status of ["unmatched", "ambiguous"]) {
    assert.equal(
      canReuseResult(
        value,
        "kakao",
        { ...matched, status, candidate: undefined },
        now(),
      ),
      false,
    );
  }
  for (const values of [[], [candidate(), candidate("kakao", { id: "456" })]]) {
    const result = await syncStorePlatform(value, "kakao", {
      lookup: async () => values,
      now,
    });
    assert.equal(canReuseResult(value, "kakao", result, now()), true);
    assert.equal(
      canReuseResult(value, "kakao", { ...result, applied: true }, now()),
      false,
    );
    assert.equal(
      canReuseResult(
        value,
        "kakao",
        { ...result, candidate: candidate() },
        now(),
      ),
      false,
    );
    assert.equal(
      canReuseResult(
        value,
        "kakao",
        {
          ...result,
          status: result.status === "unmatched" ? "ambiguous" : "unmatched",
        },
        now(),
      ),
      false,
    );
    assert.equal(
      canReuseResult(value, "kakao", result, new Date(+now() + day + 1)),
      false,
    );
  }
});
