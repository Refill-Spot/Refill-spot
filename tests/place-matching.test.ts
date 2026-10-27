import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchPlace,
  type PlaceCandidate,
  type PlaceMatchResult,
  type StoreIdentity,
} from "../lib/place-matching";

function store(overrides: Partial<StoreIdentity> = {}): StoreIdentity {
  return {
    id: 1,
    name: "무한리필 강남점",
    address: "서울특별시 강남구 테헤란로 10 역삼동",
    phoneNumber: "02-1234-5678",
    position: { lat: 37.5, lng: 127 },
    ...overrides,
  };
}

function candidate(overrides: Partial<PlaceCandidate> = {}): PlaceCandidate {
  const id = overrides.id ?? "123";
  return {
    id,
    name: "무한리필 강남점",
    address: "서울 강남구 테헤란로 10 역삼동",
    phoneNumber: "02-1234-5678",
    lat: 37.5,
    lng: 127,
    url: `https://place.map.kakao.com/${id}`,
    ...overrides,
  };
}

function assertMatched(
  result: PlaceMatchResult,
  reason: string,
): PlaceCandidate {
  assert.equal(result.status, "matched");
  if (result.status !== "matched")
    throw new Error("Expected a matched identity");
  assert.equal(result.reason, reason);
  return result.candidate;
}

function assertUnmatched(
  value: StoreIdentity,
  values: readonly PlaceCandidate[],
): void {
  assert.equal(matchPlace(value, values).status, "unmatched");
}

test("exact phone, name and local address identify a canonical Kakao or Naver place", () => {
  for (const url of [
    "https://place.map.kakao.com/123",
    "https://m.place.naver.com/place/123/home",
  ]) {
    const place = candidate({ url, lat: null, lng: null });
    assert.strictEqual(
      assertMatched(matchPlace(store(), [place]), "phone-name-local-address"),
      place,
    );
  }
});

test("phone punctuation, full-width digits and explicit Korean country codes normalize exactly", () => {
  for (const phoneNumber of [
    " (02) 1234.5678 ",
    "０２－１２３４－５６７８",
    "+82 2 1234 5678",
    "+82 (0)2-1234-5678",
    "0082-2-1234-5678",
  ]) {
    assertMatched(
      matchPlace(store(), [candidate({ phoneNumber, lat: null, lng: null })]),
      "phone-name-local-address",
    );
  }
});

test("name normalization handles NFKC, case, whitespace and punctuation without losing branches", () => {
  const value = store({ name: "ＳＨＡＢＵ・샤브 & 무한리필 (강남점)" });
  const place = candidate({
    name: "shabu 샤브무한리필—강남점",
    phoneNumber: null,
  });
  assertMatched(matchPlace(value, [place]), "exact-name-nearby-district");
  assertUnmatched(value, [candidate({ name: "shabu 샤브무한리필 강북점" })]);
});

test("prefix brand expansion preserves a complete branch and needs phone corroboration", () => {
  const place = candidate({
    name: "프리미엄 무한리필 강남점",
    lat: null,
    lng: null,
  });
  assertMatched(matchPlace(store(), [place]), "phone-name-local-address");
  assertUnmatched(store({ phoneNumber: null }), [
    { ...place, lat: 37.5, lng: 127 },
  ]);
  assertUnmatched(store({ name: "맛집" }), [
    candidate({ name: "프리미엄 맛집" }),
  ]);
  assertUnmatched(store({ name: "가나다라" }), [
    candidate({ name: "프리미엄가나다라" }),
  ]);
  assertMatched(
    matchPlace(store({ name: "가나다라마" }), [
      candidate({ name: "프리미엄가나다라마" }),
    ]),
    "phone-name-local-address",
  );
  assertUnmatched(store(), [candidate({ name: "무한리필 강남점 별관" })]);
});

test("observed expanded 채선당 brand preserves ordered prefix and complete branch suffix", () => {
  const value = store({
    name: "채선당올림픽공원점",
    address: "서울특별시 강동구 강동대로 성내동",
    phoneNumber: "02-484-4759",
  });
  const place = candidate({
    name: "채선당 월남쌈&샤브샤브 올림픽공원점",
    address: "서울 강동구 강동대로 143-22 1층",
    phoneNumber: "02 484 4759",
    lat: null,
    lng: null,
  });
  assertMatched(matchPlace(value, [place]), "phone-name-local-address");
  assertUnmatched({ ...value, phoneNumber: null }, [
    { ...place, lat: 37.5, lng: 127 },
  ]);
  assertUnmatched(value, [{ ...place, address: "서울 강동구" }]);
  for (const name of [
    "채선당 월남쌈&샤브샤브 잠실공원점",
    "채선당 월남쌈&샤브샤브 신올림픽공원점",
    "채선당 월남쌈&샤브샤브 올림픽공원2호점",
    "채선당월남쌈샤브샤브잠실공원점",
  ])
    assertUnmatched(value, [{ ...place, name }]);
});

test("expanded names require disjoint three-character prefix and branch suffix", () => {
  const value = store({ name: "채선당올림픽공원점" });
  assertMatched(
    matchPlace(value, [
      candidate({ name: "채선당 월남쌈샤브샤브 올림픽공원점" }),
    ]),
    "phone-name-local-address",
  );
  assertUnmatched(value, [
    candidate({ name: "채선당월남쌈샤브샤브올림픽공원점" }),
  ]);
  assertUnmatched(store({ name: "채선올림픽공원점" }), [
    candidate({ name: "채선 월남쌈 올림픽공원점" }),
  ]);
  assertUnmatched(store({ name: "채선당서울점" }), [
    candidate({ name: "채선당월남쌈부산점" }),
  ]);
  assertUnmatched(store({ name: "가나다점" }), [
    candidate({ name: "가나다브랜드나다점" }),
  ]);
});

test("a shared chain phone never resolves different branches or unrelated names", () => {
  for (const name of [
    "무한리필 역삼점",
    "무한리필 신강남점",
    "무한리필 강남2호점",
    "다른식당 강남점",
  ])
    assertUnmatched(store(), [candidate({ name })]);
  assertUnmatched(store(), [candidate({ name: "무한리필" })]);
  assertUnmatched(store({ name: "무한리필" }), [
    candidate({ name: "무한리필 강남점" }),
  ]);
  assertUnmatched(store({ name: "채선당강남점" }), [
    candidate({ name: "채선당신강남점" }),
  ]);
  assertUnmatched(store({ name: "채선당 강남점" }), [
    candidate({ name: "채선당 월남쌈 신강남점" }),
  ]);
});

test("district alone, a shared province or a bare street number cannot corroborate phone matching", () => {
  for (const address of [
    "서울 강남구",
    "서울",
    "강남구 10",
    "서울 강남구 삼성로 10",
    "부산 해운대구 테헤란로 10 역삼동",
  ])
    assertUnmatched(store(), [candidate({ address, lat: null, lng: null })]);
});

test("explicit province, city, district, neighborhood and same-street number disagreements veto", () => {
  for (const address of [
    "부산 강남구 테헤란로 10 역삼동",
    "서울 서초구 테헤란로 10 역삼동",
    "서울 강남구 테헤란로 11 역삼동",
    "서울 강남구 테헤란로 10 삼성동",
  ])
    assertUnmatched(store(), [candidate({ address })]);
  assertUnmatched(store({ address: "경기 수원시 영통구 광교로 10" }), [
    candidate({ address: "경기 용인시 영통구 광교로 10" }),
  ]);
  assertUnmatched(store({ address: "서울 중구 중앙로 10" }), [
    candidate({ address: "인천 중구 중앙로 10" }),
  ]);
});

test("province aliases and shared local street or neighborhood corroborate independently", () => {
  for (const [full, short, district] of [
    ["서울특별시", "서울", "강남구"],
    ["부산광역시", "부산", "해운대구"],
    ["대구광역시", "대구", "중구"],
    ["인천광역시", "인천", "연수구"],
    ["광주광역시", "광주", "북구"],
    ["대전광역시", "대전", "유성구"],
    ["울산광역시", "울산", "남구"],
    ["경기도", "경기", "수원시"],
    ["강원특별자치도", "강원", "춘천시"],
    ["강원도", "강원", "춘천시"],
    ["충청북도", "충북", "청주시"],
    ["충청남도", "충남", "천안시"],
    ["전북특별자치도", "전북", "전주시"],
    ["전라북도", "전북", "전주시"],
    ["전라남도", "전남", "목포시"],
    ["경상북도", "경북", "포항시"],
    ["경상남도", "경남", "창원시"],
    ["제주특별자치도", "제주", "제주시"],
    ["제주도", "제주", "제주시"],
  ]) {
    assertMatched(
      matchPlace(store({ address: `${full} ${district} 중앙로 10` }), [
        candidate({ address: `${short} ${district} 중앙로 10` }),
      ]),
      "phone-name-local-address",
    );
  }
  assertMatched(
    matchPlace(store({ address: "세종특별자치시 조치원읍 새내로 10" }), [
      candidate({ address: "세종 조치원읍 새내로 10" }),
    ]),
    "phone-name-local-address",
  );
  assertMatched(
    matchPlace(store({ address: "서울 강남구 역삼동 123-4" }), [
      candidate({ address: "서울 강남구 역삼동 123-4", lat: null, lng: null }),
    ]),
    "phone-name-local-address",
  );
  assertUnmatched(store({ address: "서울 강남구 역삼동 123-4" }), [
    candidate({ address: "서울 강남구 역삼동 123-5" }),
  ]);
});

test("exact name plus nearby coordinates and district works without matching phones", () => {
  for (const [storePhone, candidatePhone] of [
    [null, null],
    ["02-1234-5678", null],
    [null, "02-1234-5678"],
    ["", " "],
  ] as const) {
    assertMatched(
      matchPlace(store({ phoneNumber: storePhone }), [
        candidate({
          phoneNumber: candidatePhone,
          address: "서울 강남구",
          lat: 37.5002,
        }),
      ]),
      "exact-name-nearby-district",
    );
  }
  assertUnmatched(store({ phoneNumber: null }), [
    candidate({ phoneNumber: null, address: "서울" }),
  ]);
  assertUnmatched(store({ phoneNumber: null }), [
    candidate({ phoneNumber: null, address: "서울 서초구" }),
  ]);
  assertUnmatched(store({ phoneNumber: null }), [
    candidate({ phoneNumber: null, lat: 37.6 }),
  ]);
});

test("different explicit phone numbers veto even an exact name, address and position", () => {
  assertUnmatched(store(), [candidate({ phoneNumber: "02-1234-5679" })]);
  assertUnmatched(store({ phoneNumber: "1544-1234" }), [
    candidate({ phoneNumber: "1544-5678" }),
  ]);
  for (const phoneNumber of [
    "call 02-1234-5678",
    "02-1234-5678 ext 2",
    "123",
    "+",
    "not a phone",
  ]) {
    assertUnmatched(store(), [candidate({ phoneNumber })]);
    assertUnmatched(store({ phoneNumber }), [candidate()]);
  }
});

test("100 metre ceiling is unrounded and does not accept 100.4 metres", () => {
  const value = store({ phoneNumber: null });
  for (const meters of [0, 50, 99.999, 100.001, 100.4, 101, 500]) {
    const latitude = value.position.lat + (meters / 6371000) * (180 / Math.PI);
    const result = matchPlace(value, [
      candidate({ phoneNumber: null, lat: latitude }),
    ]);
    assert.equal(
      result.status,
      meters <= 100 ? "matched" : "unmatched",
      `${meters} metres`,
    );
  }
});

test("invalid or placeholder coordinates never provide distance evidence on either side", () => {
  const invalidPositions = [
    { lat: null, lng: 127 },
    { lat: 37.5, lng: null },
    { lat: NaN, lng: 127 },
    { lat: 37.5, lng: NaN },
    { lat: Infinity, lng: 127 },
    { lat: 37.5, lng: -Infinity },
    { lat: 90.001, lng: 127 },
    { lat: -90.001, lng: 127 },
    { lat: 37.5, lng: 180.001 },
    { lat: 37.5, lng: -180.001 },
    { lat: 0, lng: 127 },
    { lat: 37.5, lng: 0 },
    { lat: 0, lng: 0 },
  ];
  for (const position of invalidPositions) {
    assertUnmatched(store({ phoneNumber: null }), [
      candidate({ phoneNumber: null, ...position }),
    ]);
    if (position.lat !== null && position.lng !== null) {
      assertUnmatched(
        store({
          phoneNumber: null,
          position: { lat: position.lat, lng: position.lng },
        }),
        [candidate({ phoneNumber: null })],
      );
    }
  }
  assertMatched(
    matchPlace(store({ position: { lat: 0, lng: 0 } }), [
      candidate({ lat: null, lng: null }),
    ]),
    "phone-name-local-address",
  );
});

test("valid coordinate range boundaries are not confused with placeholders", () => {
  for (const position of [
    { lat: 90, lng: 180 },
    { lat: -90, lng: -180 },
  ]) {
    assertMatched(
      matchPlace(store({ phoneNumber: null, position }), [
        candidate({ phoneNumber: null, ...position }),
      ]),
      "exact-name-nearby-district",
    );
  }
});

test("place IDs and store IDs must be canonical positive numeric identities", () => {
  for (const id of [
    "",
    "0",
    "00",
    "0123",
    "-1",
    "+1",
    "1.5",
    "1e3",
    "１２３",
    " 123",
    "123 ",
    "123\n",
    "123/evil",
    "123?next=evil",
  ]) {
    assertUnmatched(store(), [candidate({ id })]);
  }
  for (const id of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(matchPlace(store({ id }), [candidate()]), {
      status: "unmatched",
      reason: "invalid-store-identity",
    });
  }
  for (const id of ["1", "123", "99999999999999999999999999"]) {
    assertMatched(
      matchPlace(store(), [candidate({ id })]),
      "phone-name-local-address",
    );
  }
});

test("only exact canonical HTTPS place URLs are accepted", () => {
  for (const url of [
    "http://place.map.kakao.com/123",
    "https://place.map.kakao.com/124",
    "https://place.map.kakao.com/0123",
    "https://place.map.kakao.com/123/",
    "https://place.map.kakao.com/123?x=1",
    "https://place.map.kakao.com/123?",
    "https://place.map.kakao.com/123#reviews",
    "https://place.map.kakao.com/123#",
    "https://user:password@place.map.kakao.com/123",
    "https://@place.map.kakao.com/123",
    "https://place.map.kakao.com:443/123",
    "https://place.map.kakao.com:8443/123",
    "https://place.map.kakao.com.evil.test/123",
    "https://place.map.kakao.com/%31%32%33",
    "https://place.map.kakao.com/a/../123",
    "https://PLACE.MAP.KAKAO.COM/123",
    "https://place.map.kakao.com/123\n",
    " https://place.map.kakao.com/123",
    "https://m.place.naver.com/restaurant/123/home",
    "https://m.place.naver.com/place/123",
    "https://m.place.naver.com/place/124/home",
    "https://m.place.naver.com/place/123/home?entry=pll",
    "https://m.place.naver.com/place/123/home#",
    "https://m.place.naver.com:443/place/123/home",
    "https://user@m.place.naver.com/place/123/home",
    "javascript:alert(1)",
  ])
    assertUnmatched(store(), [candidate({ url })]);
});

test("multiple qualifying IDs are ambiguous regardless of candidate ordering or route", () => {
  const first = candidate();
  const second = candidate({ id: "456", phoneNumber: null });
  for (const places of [
    [first, second],
    [second, first],
  ]) {
    assert.deepEqual(matchPlace(store(), places), {
      status: "ambiguous",
      reason: "multiple-high-confidence-place-ids",
    });
  }
});

test("identical IDs deduplicate only consistent identities and select a stable representative", () => {
  const first = candidate();
  const equivalent = candidate({
    name: "무한리필 (강남점)",
    address: "서울특별시 강남구 테헤란로 10 역삼동",
    phoneNumber: "(02) 1234 5678",
  });
  const forward = matchPlace(store(), [first, first, equivalent]);
  const reverse = matchPlace(store(), [equivalent, first, first]);
  assertMatched(forward, "phone-name-local-address");
  assert.deepEqual(forward, reverse);
  for (const conflicting of [
    candidate({ name: "무한리필 역삼점" }),
    candidate({ address: "서울 서초구 테헤란로 10" }),
    candidate({ phoneNumber: "02-9999-8888" }),
    candidate({ phoneNumber: null }),
    candidate({ lat: 37.5001 }),
    candidate({ lng: 127.0001 }),
    candidate({ lat: null }),
    candidate({ url: "https://m.place.naver.com/place/123/home" }),
    candidate({ url: "https://evil.test/123" }),
  ]) {
    for (const places of [
      [first, conflicting],
      [conflicting, first],
    ]) {
      assert.deepEqual(matchPlace(store(), places), {
        status: "ambiguous",
        reason: "conflicting-duplicate-place-id",
      });
    }
  }
});

test("nonmatches and invalid candidates do not get selected by list ordering", () => {
  const matching = candidate();
  const unrelated = candidate({ id: "456", name: "다른식당" });
  const invalid = candidate({ id: "0" });
  for (const places of [
    [unrelated, invalid, matching],
    [matching, invalid, unrelated],
  ]) {
    assert.strictEqual(
      assertMatched(matchPlace(store(), places), "phone-name-local-address"),
      matching,
    );
  }
  assert.deepEqual(matchPlace(store(), []), {
    status: "unmatched",
    reason: "no-high-confidence-match",
  });
  assertUnmatched(store({ name: " " }), [matching]);
  assertUnmatched(store({ address: " " }), [matching]);
  assertUnmatched(store(), [candidate({ name: "" })]);
  assertUnmatched(store(), [candidate({ address: "" })]);
});

test("matching is pure and leaves frozen input objects and arrays unchanged", () => {
  const value = store();
  Object.freeze(value.position);
  Object.freeze(value);
  const places = [candidate(), candidate({ id: "456", name: "다른식당" })];
  const before = structuredClone({ value, places });
  places.forEach(Object.freeze);
  Object.freeze(places);
  assertMatched(matchPlace(value, places), "phone-name-local-address");
  assertMatched(matchPlace(value, places), "phone-name-local-address");
  assert.deepEqual({ value, places }, before);
});

test("audit reasons are stable identifiers and contain no input identity information", () => {
  const value = store();
  const results = [
    matchPlace(value, [candidate()]),
    matchPlace(value, []),
    matchPlace(value, [candidate(), candidate({ id: "456" })]),
    matchPlace(value, [candidate(), candidate({ address: "서울 서초구" })]),
  ];
  for (const result of results) {
    assert.match(result.reason, /^[a-z]+(?:-[a-z]+)*$/);
    for (const pii of [value.name, value.address, value.phoneNumber!])
      assert.ok(!result.reason.includes(pii));
  }
});
