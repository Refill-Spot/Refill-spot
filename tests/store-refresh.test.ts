import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildStoreRefreshPlan,
  normalizeStoreRefreshName,
  verifyStoreRefreshResult,
  type StoreLiveObservation,
  type StoreLiveVerification,
  type StoreRefreshRow,
  type StoreSourceMapping,
} from "../lib/store-refresh";

const now = "2026-10-25T12:00:00.000Z";
const day = 86_400_000;
const oldMenu = [
  {
    name: "기존 메뉴",
    type: "",
    order: 0,
    price: "1,000원",
    price_numeric: 1000,
    is_recommended: true,
  },
];

function point(lng: number, lat: number, srid = 4326, little = true): string {
  const bytes = new Uint8Array(25);
  const view = new DataView(bytes.buffer);
  bytes[0] = little ? 1 : 0;
  view.setUint32(1, 0x20000001, little);
  view.setUint32(5, srid, little);
  view.setFloat64(9, lng, little);
  view.setFloat64(17, lat, little);
  return Buffer.from(bytes).toString("hex");
}

function geoPoint(lng: number, lat: number) {
  return {
    type: "Point",
    crs: { type: "name", properties: { name: "EPSG:4326" } },
    coordinates: [lng, lat],
  };
}

function row(overrides: Partial<StoreRefreshRow> = {}): StoreRefreshRow {
  return {
    id: 1848,
    name: "맛집 강남점",
    address: "서울특별시 강남구 테헤란로 역삼동",
    phone_number: "02-1234-5678",
    position_lat: 37.5,
    position_lng: 127,
    position_x: 127,
    position_y: 37.5,
    geom: point(127, 37.5),
    refill_items: structuredClone(oldMenu),
    open_hours: "기존 영업시간",
    break_time: "기존 휴식시간",
    naver_rating: 4.5,
    kakao_rating: 4,
    naver_place_id: "123",
    kakao_place_id: "456",
    image_urls: ["https://example.com/old.jpg"],
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function observation(
  overrides: Partial<StoreLiveObservation> = {},
): StoreLiveObservation {
  return {
    sourceId: "source-1",
    status: "success",
    observedAt: now,
    name: "맛집 강남점",
    address: "서울 강남구 테헤란로 10 (역삼동)",
    phone: "02-1234-5678",
    lat: 37.5001,
    lng: 127.0001,
    menuItems: [{ name: "일반 식사", price: "12,000원", price_numeric: 12000 }],
    ...overrides,
  };
}

function offering(
  name = "샤브 무한리필",
  price = "12,000원",
  extra: Record<string, unknown> = {},
) {
  return {
    name,
    price,
    scope: "main_meal",
    evidenceText: `${name} ${price} 무한리필 제공`,
    ...extra,
  };
}

function confirmedEligibility(offerings: unknown, scope = "main_meal") {
  return { status: "confirmed", scope, offerings };
}

function mapping(): StoreSourceMapping {
  return {
    records: [
      {
        storeId: 1848,
        status: "historical_candidate",
        candidates: [{ sourceId: "source-1" }],
      },
    ],
  };
}

function decision(current = row(), source = observation()) {
  return buildStoreRefreshPlan([current], mapping(), { records: [source] }, now)
    .rows[0];
}

function assertHeld(
  current: StoreRefreshRow,
  source: StoreLiveObservation,
  reason: string,
) {
  const result = decision(current, source);
  assert.equal(result.status, "hold");
  assert.equal(result.reason, reason);
  assert.deepEqual(result.updates, {});
  assert.ok(
    Object.values(result.fields).every((field) => field.status === "hold"),
  );
}

test("all 439 input rows receive a stable decision; inputs are not mutated", () => {
  const stores = Array.from({ length: 439 }, (_, index) =>
    row({ id: 1848 + index }),
  );
  const links = mapping();
  const observed = { records: [observation()] };
  const before = structuredClone({ stores, links, observed });
  const plan = buildStoreRefreshPlan(stores, links, observed, now);
  assert.equal(plan.rows.length, 439);
  assert.deepEqual(
    plan.rows.map((item) => item.storeId),
    stores.map((item) => item.id),
  );
  assert.equal(plan.counts.changed, 1);
  assert.equal(plan.counts.held, 438);
  assert.equal(plan.counts.coordinateUpdated, 1);
  assert.equal(plan.counts.coordinateSkipped, 438);
  assert.equal(plan.rows[1].reason, "source-mapping-missing");
  assert.deepEqual({ stores, links, observed }, before);
});

test("only NFKC, punctuation and whitespace are ignored; branches and case remain significant", () => {
  assert.equal(normalizeStoreRefreshName("맛집（강남점） Ａ"), "맛집강남점A");
  const result = decision(
    row({ name: "맛집 (강남점)" }),
    observation({ name: "맛집강남점" }),
  );
  assert.equal(result.status, "update");
  assert.equal(Object.hasOwn(result.updates, "name"), false);
  for (const name of [
    "맛집",
    "맛집 강남역점",
    "맛집 강남점★",
    "맛집 강남점 추가",
    "다른 식당",
  ])
    assertHeld(row(), observation({ name }), "current-source-name-mismatch");
  assertHeld(
    row({ name: "SHOP 강남점" }),
    observation({ name: "shop 강남점" }),
    "current-source-name-mismatch",
  );
});

test("full Seoul district and numbered road/lot address are mandatory", () => {
  for (const address of [
    "강남구 테헤란로 10",
    "경기도 성남시 강남구 테헤란로 10",
    "서울 강남구 테헤란로",
    "서울 강남구 역삼동",
    "서울 가짜구 테헤란로 10",
    "서울 강남구 서울 서초구 테헤란로 10",
    "서울 강남구 (서초구) 테헤란로 10",
  ])
    assertHeld(
      row(),
      observation({ address }),
      "source-address-not-full-seoul-address",
    );
  assertHeld(
    row(),
    observation({ address: "서울 서초구 테헤란로 10" }),
    "seoul-district-mismatch",
  );
  assertHeld(
    row({ address: "경기도 과천시 테헤란로 10" }),
    observation(),
    "current-seoul-district-unrecognized",
  );
  assert.equal(
    decision(
      row({ phone_number: null }),
      observation({ phone: null, address: "서울특별시 강남구 역삼동 123-4" }),
    ).status,
    "update",
  );
});

test("same name and district alone do not establish a branch identity", () => {
  assertHeld(
    row({ phone_number: null }),
    observation({ phone: null, address: "서울 강남구 학동로 55 논현동" }),
    "identity-not-corroborated",
  );
  assert.equal(
    decision(row({ phone_number: null }), observation({ phone: null })).status,
    "update",
  );
  assert.equal(
    decision(row(), observation({ address: "서울 강남구 학동로 55 논현동" }))
      .status,
    "update",
    "exact phone corroborates identity within the same district",
  );
  assertHeld(
    row({ address: "서울 강남구 테헤란로 20 역삼동", phone_number: null }),
    observation({ phone: null }),
    "identity-not-corroborated",
  );
});

test("conflicting normal phones veto even perfect name/street matches", () => {
  assertHeld(
    row(),
    observation({ phone: "02-9999-8888" }),
    "explicit-phone-conflict",
  );
  assertHeld(
    row(),
    observation({ phone: "010-9999-8888" }),
    "explicit-phone-conflict",
  );
  const result = decision(row(), observation({ phone: "+82 2 1234 5678" }));
  assert.equal(result.status, "update");
  assert.equal(result.updates.phone_number, "+82 2 1234 5678");
});

test("0507 vs actual exception requires matching street and never replaces the phone", () => {
  for (const [current, source] of [
    ["0507-1234-5678", "02-1234-5678"],
    ["02-1234-5678", "0507-1234-5678"],
  ]) {
    const result = decision(
      row({ phone_number: current }),
      observation({ phone: source }),
    );
    assert.equal(result.status, "update");
    assert.equal(result.fields.phone_number.status, "hold");
    assert.equal(Object.hasOwn(result.updates, "phone_number"), false);
    assert.ok(
      result.reasons.includes(
        "0507-versus-actual-phone-address-corroborated-phone-preserved",
      ),
    );
    assertHeld(
      row({ phone_number: current }),
      observation({ phone: source, address: "서울 강남구 역삼동 123-4" }),
      "explicit-phone-conflict",
    );
  }
  assertHeld(
    row({ phone_number: "0507-1111-2222" }),
    observation({ phone: "0507-3333-4444" }),
    "explicit-phone-conflict",
  );
});

test("missing/malformed source phone never clears a phone; malformed existing phone is preserved", () => {
  for (const phone of [null, "", "전화번호 없음"]) {
    const result = decision(row(), observation({ phone }));
    assert.equal(result.status, "update");
    assert.equal(Object.hasOwn(result.updates, "phone_number"), false);
  }
  assert.equal(
    decision(row({ phone_number: null })).updates.phone_number,
    "02-1234-5678",
  );
  assert.equal(
    decision(row({ phone_number: "알 수 없음" })).fields.phone_number.status,
    "hold",
  );
});

test("missing, ambiguous, duplicate and shared source associations are held", () => {
  const stores = [row()];
  for (const records of [
    [],
    [{ ...mapping().records[0], status: "ambiguous" as const }],
    [{ ...mapping().records[0], candidates: [] }],
    [
      {
        ...mapping().records[0],
        candidates: [{ sourceId: "a" }, { sourceId: "b" }],
      },
    ],
    [...mapping().records, ...mapping().records],
  ]) {
    assert.equal(
      buildStoreRefreshPlan(
        stores,
        { records },
        { records: [observation()] },
        now,
      ).rows[0].status,
      "hold",
    );
  }
  assert.equal(
    buildStoreRefreshPlan(stores, mapping(), { records: [] }, now).rows[0]
      .reason,
    "source-observation-missing",
  );
  assert.equal(
    buildStoreRefreshPlan(
      stores,
      mapping(),
      { records: [observation(), observation()] },
      now,
    ).rows[0].reason,
    "source-observation-ambiguous",
  );
  const links = mapping();
  links.records.push({ ...links.records[0], storeId: 1849 });
  assert.ok(
    buildStoreRefreshPlan(
      [row(), row({ id: 1849 })],
      links,
      { records: [observation()] },
      now,
    ).rows.every((item) => item.reason === "source-shared-by-multiple-stores"),
  );
  assert.ok(
    buildStoreRefreshPlan(
      [row(), row()],
      mapping(),
      { records: [observation()] },
      now,
    ).rows.every((item) => item.reason === "invalid-or-duplicate-store-id"),
  );
});

test("unavailable sources and missing menus are holds, never closure/deletion signals", () => {
  for (const status of [
    "source_unavailable",
    "missing_menu",
    "parse_failure",
  ] as const)
    assertHeld(row(), observation({ status }), `source-${status}`);
});

test("observation time requires explicit timezone and rejects expired/future/impossible times", () => {
  assertHeld(
    row(),
    observation({
      observedAt: new Date(Date.parse(now) - day - 1).toISOString(),
    }),
    "observation-expired",
  );
  assertHeld(
    row(),
    observation({ observedAt: new Date(Date.parse(now) + 1).toISOString() }),
    "observation-from-future",
  );
  for (const observedAt of [
    "",
    "not-a-date",
    "2026-10-25T12:00:00",
    "2026-02-30T12:00:00Z",
  ])
    assertHeld(row(), observation({ observedAt }), "observation-time-invalid");
  assert.equal(
    decision(
      row(),
      observation({
        observedAt: new Date(Date.parse(now) - day).toISOString(),
      }),
    ).status,
    "update",
  );
  assert.equal(
    decision(row(), observation({ observedAt: "2026-10-25T21:00:00+09:00" }))
      .status,
    "update",
  );
});

test("only explicit confirmed main-meal/buffet offerings map to the unlimited-refill app contract", () => {
  const result = decision(
    row(),
    observation({ eligibility: confirmedEligibility([offering()]) }),
  );
  assert.deepEqual(result.updates.refill_items, [
    {
      name: "샤브 무한리필",
      type: "",
      order: 0,
      price: "12,000원",
      price_numeric: 12000,
      is_recommended: false,
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(result.updates),
    /eligibility|verifiedCurrentness|browser_verified|rating|image_urls|place_id/,
  );
  assert.equal(
    decision(
      row(),
      observation({
        eligibility: confirmedEligibility(
          [offering("뷔페", "무료", { scope: "buffet" })],
          "buffet",
        ),
      }),
    ).updates.refill_items?.[0].price_numeric,
    0,
  );
  assert.equal(
    decision(
      row(),
      observation({
        eligibility: confirmedEligibility([
          offering("무료 메뉴", "0원", { price_numeric: 0 }),
        ]),
      }),
    ).updates.refill_items?.[0].price_numeric,
    0,
  );
  assert.equal(
    decision(
      row(),
      observation({
        eligibility: confirmedEligibility([
          offering("소수 가격", "1234.5원", { price_numeric: 1234.5 }),
        ]),
      }),
    ).updates.refill_items?.[0].price_numeric,
    1234.5,
  );
});

test("ordinary priced menus cannot imply unlimited-refill eligibility", () => {
  for (const eligibility of [
    undefined,
    { status: "verified", scope: "all-menu" },
    { status: "unknown", scope: "main_meal" },
    { status: "confirmed", scope: "main_meal" },
    confirmedEligibility([]),
  ]) {
    const result = decision(row(), observation({ eligibility }));
    assert.equal(Object.hasOwn(result.updates, "refill_items"), false);
    assert.equal(result.fields.refill_items.status, "hold");
  }
  const source = observation({
    menuItems: [{ name: "무한리필이라는 이름도 근거 아님", price: "12,000원" }],
  });
  assert.equal(
    Object.hasOwn(decision(row(), source).updates, "refill_items"),
    false,
  );
});

test("side-refill, missing scopes and missing evidence never appear under the main-meal refill heading", () => {
  for (const eligibility of [
    confirmedEligibility([offering()], "side_refill"),
    confirmedEligibility([offering()], "unknown"),
    confirmedEligibility([
      offering("반찬", "1000원", { scope: "side_refill" }),
    ]),
    confirmedEligibility([
      offering(),
      offering("반찬", "1000원", { scope: "side_refill" }),
    ]),
    confirmedEligibility([offering("메뉴", "1000원", { scope: undefined })]),
    confirmedEligibility([offering("메뉴", "1000원", { evidenceText: " " })]),
    confirmedEligibility([
      offering("메뉴", "1000원", { evidenceText: undefined }),
    ]),
  ]) {
    const result = decision(row(), observation({ eligibility }));
    assert.equal(Object.hasOwn(result.updates, "refill_items"), false);
    assert.equal(result.fields.refill_items.status, "hold");
  }
});

test("empty or any malformed confirmed offerings preserve the complete previous menu", () => {
  const malformed: unknown[] = [
    undefined,
    [],
    null,
    "[]",
    [null],
    [offering("", "1000원")],
    [offering("메뉴", "변동", { price_numeric: 0 })],
    [offering("메뉴", "문의")],
    [offering("메뉴", "12,00원")],
    [offering("메뉴", "-1원")],
    [offering("메뉴", "1000원", { price_numeric: Infinity })],
    [offering("메뉴", "1000원", { price_numeric: NaN })],
    [offering("메뉴", "1000원", { price_numeric: 999 })],
    [offering("좋은 메뉴", "1000원"), offering("모르는 메뉴", "시가")],
  ];
  for (const offerings of malformed) {
    const result = decision(
      row(),
      observation({
        eligibility: confirmedEligibility(offerings),
      }),
    );
    assert.equal(
      result.status,
      "update",
      "other verified fields can still update",
    );
    assert.equal(result.fields.refill_items.status, "hold");
    assert.equal(Object.hasOwn(result.updates, "refill_items"), false);
  }
});

test("untrusted menu strings remain literal text and cannot execute or escape the update allowlist", () => {
  const attack =
    '<img src=x onerror="globalThis.compromised=true"><script>throw 1</script>';
  const source = observation({
    menuItems: [{ name: attack, price: "12000원" }],
    eligibility: confirmedEligibility([offering(attack, "12000원")]),
  });
  Object.assign(source, {
    image_urls: [],
    naver_rating: 0,
    nameUpdate: "공격",
  });
  const result = decision(row(), source);
  assert.equal(result.updates.refill_items?.[0].name, attack);
  assert.equal((globalThis as Record<string, unknown>).compromised, undefined);
  assert.equal(Object.hasOwn(result.updates, "image_urls"), false);
  assert.equal(Object.hasOwn(result.updates, "naver_rating"), false);
  assert.equal(Object.hasOwn(result.updates, "name"), false);
});

test("dated/partial/unsupported hours are preserved rather than made evergreen", () => {
  for (const openHours of [
    "10월 25일 일요일 11:00-22:00",
    "2026-10-25 (일) 11:00-22:00",
    "10/25(일) 11:00-22:00",
    "오늘 11:00-22:00",
    "월: 11:00-22:00",
    "매일 25:00-26:00",
    "매일 24:00-01:00",
    "매일 24:00-24:00",
    "매일 00:00-24:01",
    "매일 11:00-11:00",
    "매일 11:00-22:00 공휴일 휴무",
  ]) {
    const result = decision(
      row(),
      observation({ openHours, breakTime: "15:00-17:00" }),
    );
    assert.equal(Object.hasOwn(result.updates, "open_hours"), false);
    assert.equal(Object.hasOwn(result.updates, "break_time"), false);
    assert.equal(result.fields.open_hours.status, "hold");
  }
});

test("explicit recurring daily/full-week hours map into supported weekday formatting", () => {
  const result = decision(
    row(),
    observation({
      openHours: "매일 11:00 ~ 22:00",
      breakTime: "매일 15:00-17:00",
    }),
  );
  assert.equal(
    result.updates.open_hours,
    ["월", "화", "수", "목", "금", "토", "일"]
      .map((day) => `${day}: 11:00-22:00`)
      .join(", "),
  );
  assert.match(result.updates.break_time!, /^월: 15:00-17:00, 화:/);
  assert.equal(
    decision(row(), observation({ openHours: "매일 00:00-24:00" })).updates
      .open_hours,
    ["월", "화", "수", "목", "금", "토", "일"]
      .map((day) => `${day}: 00:00-24:00`)
      .join(", "),
  );
  const weekly = ["월", "화", "수", "목", "금", "토", "일"]
    .map((day) => `${day}: 00:00-24:00`)
    .join("\n");
  assert.match(
    decision(row(), observation({ openHours: weekly })).updates.open_hours!,
    /일: 00:00-24:00$/,
  );
  assert.equal(
    Object.hasOwn(
      decision(row(), observation({ openHours: `${weekly}\n월: 11:00-22:00` }))
        .updates,
      "open_hours",
    ),
    false,
  );
});

test("date-labelled seven-day observations cannot become an evergreen weekly schedule", () => {
  const openHours = [
    "오늘 10월 25일 일요일: 00:00-24:00",
    "10월 26일 월요일: 00:00-24:00",
    "10월 27일 화요일: 00:00-24:00",
    "10월 28일 수요일: 00:00-24:00",
    "10월 29일 목요일: 00:00-24:00",
    "10월 30일 금요일: 00:00-24:00",
    "10월 31일 토요일: 00:00-24:00",
  ].join("\n");
  const result = decision(row(), observation({ openHours }));
  assert.equal(Object.hasOwn(result.updates, "open_hours"), false);
  assert.equal(
    result.fields.open_hours.reason,
    "dated-or-exception-hours-not-recurring",
  );
});

test("missing, zero, nonfinite, out-of-Seoul and moved coordinates hold only coordinate fields", () => {
  for (const [lat, lng] of [
    [undefined, undefined],
    [null, null],
    [0, 0],
    [NaN, 127],
    [37.5, Infinity],
    [38, 127],
    [37.5, 128],
    [37.502, 127],
  ] as const) {
    const result = decision(row(), observation({ lat, lng }));
    assert.equal(result.status, "update");
    assert.equal(result.fields.address.status, "update");
    for (const field of [
      "position_lat",
      "position_lng",
      "position_x",
      "position_y",
      "geom",
    ] as const) {
      assert.equal(result.fields[field].status, "hold");
      assert.equal(Object.hasOwn(result.updates, field), false);
    }
  }
  assert.equal(
    decision(row({ position_lat: null })).fields.position_lat.reason,
    "current-coordinates-cannot-bound-movement",
  );
});

test("100m distance gate uses unrounded distance, not a rounded near-boundary measurement", () => {
  const latitudeFor = (meters: number) =>
    37.5 + (meters / 6_371_000) * (180 / Math.PI);
  const within = decision(
    row(),
    observation({ lat: latitudeFor(99.999), lng: 127 }),
  );
  assert.equal(within.fields.position_lat.status, "update");
  const beyond = decision(
    row(),
    observation({ lat: latitudeFor(100.001), lng: 127 }),
  );
  assert.equal(beyond.fields.position_lat.status, "hold");
  assert.ok(beyond.coordinateDistanceMeters! > 100);
});

test("coordinates, coordinate mirrors and geom all come directly from the same observed point", () => {
  const result = decision();
  assert.equal(result.updates.position_lat, 37.5001);
  assert.equal(result.updates.position_lng, 127.0001);
  assert.equal(result.updates.position_x, 127.0001);
  assert.equal(result.updates.position_y, 37.5001);
  assert.equal(result.updates.geom, "SRID=4326;POINT(127.0001 37.5001)");
});

test("identical verified fields produce a hold/no-op instead of timestamp-only writes", () => {
  const source = observation({
    address: row().address + " 10",
    lat: 37.5,
    lng: 127,
  });
  const first = decision(row(), source);
  const current = row({ ...first.updates, geom: point(127, 37.5) });
  const result = decision(current, source);
  assert.equal(result.status, "hold");
  assert.equal(result.reason, "no-safe-field-changes");
  assert.deepEqual(result.updates, {});
  const geoJsonCurrent = { ...current, geom: geoPoint(127, 37.5) };
  assert.deepEqual(decision(geoJsonCurrent, source).updates, {});
});

test("read-back verifies EWKB endian, SRID, point and numeric tolerance", () => {
  const before = row();
  const updates = decision().updates;
  for (const little of [true, false]) {
    const after = row({
      ...updates,
      updated_at: now,
      position_lat: updates.position_lat! + 1e-12,
      geom: point(updates.position_lng!, updates.position_lat!, 4326, little),
    });
    assert.equal(
      verifyStoreRefreshResult(before, updates, after, now).valid,
      true,
    );
  }
  for (const geom of [
    point(127.0001, 37.5001, 3857),
    point(127.0001, 37.51),
    "bad",
    "SRID=4326;POINT(127.0001 37.5001)",
  ]) {
    const after = row({ ...updates, updated_at: now, geom });
    assert.ok(
      verifyStoreRefreshResult(before, updates, after, now).mismatches.includes(
        "geom",
      ),
    );
  }
  const after = row({
    ...updates,
    updated_at: now,
    position_lat: 37.6,
    geom: point(127.0001, 37.5001),
  });
  assert.ok(
    verifyStoreRefreshResult(before, updates, after, now).mismatches.includes(
      "position_lat",
    ),
  );
});

test("read-back accepts explicitly referenced two-dimensional GeoJSON Point and rounded numeric columns", () => {
  const before = row();
  const updates = {
    position_lat: 37.53792796173072,
    position_lng: 127.13677717620435,
    position_x: 127.13677717620435,
    position_y: 37.53792796173072,
    geom: "SRID=4326;POINT(127.13677717620435 37.53792796173072)",
  };
  const after = row({
    ...updates,
    position_lat: 37.5379279617307,
    position_lng: 127.136777176204,
    position_x: 127.136777176204,
    position_y: 37.5379279617307,
    geom: geoPoint(updates.position_lng, updates.position_lat),
    updated_at: now,
  });
  assert.equal(
    verifyStoreRefreshResult(before, updates, after, now).valid,
    true,
  );
});

test("GeoJSON verification rejects absent/wrong CRS, non-Point, extra dimensions and nonfinite/non-numeric coordinates", () => {
  const before = row();
  const updates = decision().updates;
  const valid = geoPoint(updates.position_lng!, updates.position_lat!);
  for (const geom of [
    { type: "Point", coordinates: valid.coordinates },
    { ...valid, crs: null },
    { ...valid, crs: { type: "name", properties: { name: "EPSG:3857" } } },
    { ...valid, crs: { type: "other", properties: { name: "EPSG:4326" } } },
    { ...valid, crs: { type: "name", properties: {} } },
    { ...valid, type: "LineString" },
    ...[
      [],
      [127.0001],
      [127.0001, 37.5001, 0],
      ["127.0001", 37.5001],
      [127.0001, NaN],
      [Infinity, 37.5001],
      [37.5001, 127.0001],
      [127.0001, 37.6],
    ].map((coordinates) => ({ ...valid, coordinates })),
  ]) {
    const result = verifyStoreRefreshResult(
      before,
      updates,
      row({ ...updates, geom, updated_at: now }),
      now,
    );
    assert.ok(result.mismatches.includes("geom"));
  }
});

test("full-row verification preserves ratings/photos/name/unknown fields and narrowly allows trigger ID invalidation", () => {
  const before = row({ custom_field: { nested: [1, "keep"] } });
  const updates = { address: "서울 강남구 테헤란로 10" };
  const after = {
    ...structuredClone(before),
    ...updates,
    updated_at: now,
    naver_place_id: null,
    kakao_place_id: null,
  };
  const pass = verifyStoreRefreshResult(before, updates, after, now);
  assert.equal(pass.valid, true);
  assert.deepEqual(pass.invalidatedPlaceIds, [
    "naver_place_id",
    "kakao_place_id",
  ]);
  for (const patch of [
    { image_urls: [] },
    { naver_rating: 4.4 },
    { name: "변경" },
    { phone_number: null },
    { custom_field: null },
    { kakao_place_id: "789" },
    { updated_at: "2026-10-24T12:00:00Z" },
  ]) {
    assert.equal(
      verifyStoreRefreshResult(before, updates, { ...after, ...patch }, now)
        .valid,
      false,
    );
  }
  assert.equal(
    verifyStoreRefreshResult(
      before,
      {},
      { ...before, updated_at: now, naver_place_id: null },
      now,
    ).valid,
    false,
    "menu-only/no identity changes must not invalidate links",
  );
});

async function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/apply-store-refresh.ts", ...args],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("CLI fixture timeout"));
    }, 30_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

for (const mode of [
  "dry-run",
  "apply",
  "geojson-apply",
  "coordinate-roundtrip",
  "coordinate-conflict",
  "conflict",
  "write-failure",
  "verification-failure",
  "resume-fresh",
  "resume-unverified",
  "no-service-role",
  "incomplete-snapshot",
  "backup-failure",
] as const) {
  test(`CLI ${mode}: paginated all-store snapshot, backup, CAS, checkpoints and safe failure behavior`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "refill-store-refresh-"));
    const reportPath =
      mode === "backup-failure"
        ? join(dir, "blocked", "report.json")
        : join(dir, "report.json");
    const observationPath = join(dir, "observations.json");
    const mappingPath = join(dir, "mapping.json");
    if (mode === "backup-failure")
      await writeFile(join(dir, "blocked"), "not a directory");
    const stores = Array.from(
      { length: mode === "incomplete-snapshot" ? 438 : 439 },
      (_, index) =>
        row({
          id: 1848 + index,
          phone_number: index === 1 ? null : "02-1234-5678",
          position_lat: index === 1 ? null : 37.5,
          position_lng: index === 1 ? null : 127,
        }),
    );
    const links: StoreSourceMapping = {
      records: stores.map((store, index) => ({
        storeId: store.id,
        status: index < 2 ? "historical_candidate" : "ambiguous",
        candidates: index < 2 ? [{ sourceId: `source-${index + 1}` }] : [],
      })),
    };
    const observations: StoreLiveVerification = {
      records: [
        observation({ observedAt: new Date(Date.now() - 1000).toISOString() }),
        observation({
          sourceId: "source-2",
          observedAt: new Date(Date.now() - 1000).toISOString(),
          lat: null,
          lng: null,
        }),
      ],
    };
    if (mode.startsWith("resume")) {
      links.records[1].status = "ambiguous";
      if (mode === "resume-fresh") observations.records[0].name = "바뀐 업체";
      await writeFile(
        reportPath,
        JSON.stringify({
          version: 1,
          runId: "old-run",
          receipts: [
            {
              storeId: 1848,
              status:
                mode === "resume-unverified" ? "written_unverified" : "planned",
              updates: { name: "FORGED-SAVED-UPDATE", naver_rating: 0 },
            },
          ],
        }),
      );
    }
    await writeFile(observationPath, JSON.stringify(observations));
    await writeFile(mappingPath, JSON.stringify(links));
    const patches: Array<{ url: URL; body: Record<string, unknown> }> = [];
    const offsets: number[] = [];
    let serverFailure: unknown;
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, "http://localhost");
        res.setHeader("content-type", "application/json");
        assert.equal(url.pathname, "/rest/v1/stores");
        if (req.method === "GET") {
          const idFilter = url.searchParams.get("id");
          if (idFilter) {
            const current = stores.find(
              (store) => `eq.${store.id}` === idFilter,
            );
            assert.ok(current);
            res.end(JSON.stringify(current));
          } else {
            const offset = Number(url.searchParams.get("offset") ?? 0);
            const limit = Number(url.searchParams.get("limit") ?? 200);
            offsets.push(offset);
            res.setHeader(
              "content-range",
              `${offset}-${Math.min(offset + limit, stores.length) - 1}/${stores.length}`,
            );
            res.end(JSON.stringify(stores.slice(offset, offset + limit)));
          }
        } else if (req.method === "PATCH") {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw) as Record<string, unknown>;
          assert.equal(
            Object.hasOwn(body, "refill_items"),
            false,
            "ordinary menuItems must never be published as refill offerings",
          );
          patches.push({ url, body });
          const saved = JSON.parse(await readFile(reportPath, "utf8"));
          const backup = JSON.parse(await readFile(saved.backup, "utf8"));
          assert.equal(
            backup.rows.length,
            439,
            "backup must exist before the first patch",
          );
          const current = stores.find(
            (store) => `eq.${store.id}` === url.searchParams.get("id"),
          );
          assert.ok(current);
          for (const field of ["name", "address", "phone_number", "updated_at"])
            assert.equal(
              url.searchParams.get(field),
              current[field] === null ? "is.null" : `eq.${current[field]}`,
            );
          for (const field of ["position_lat", "position_lng"] as const) {
            const coordinate: number | null = current[field];
            assert.deepEqual(
              url.searchParams.getAll(field),
              coordinate === null
                ? ["is.null"]
                : [`gte.${coordinate - 1e-10}`, `lte.${coordinate + 1e-10}`],
            );
          }
          if (
            current.id === 1848 &&
            ["coordinate-roundtrip", "coordinate-conflict"].includes(mode)
          ) {
            // Simulate float8 precision hidden by JSON, or a larger concurrent edit.
            current.position_lat =
              current.position_lat! +
              (mode === "coordinate-roundtrip" ? 5e-11 : 2e-10);
          }
          const coordinatesMatch = (
            ["position_lat", "position_lng"] as const
          ).every((field) => {
            const bounds = url.searchParams.getAll(field);
            if (current[field] === null)
              return bounds.length === 1 && bounds[0] === "is.null";
            const lower = Number(
              bounds.find((value) => value.startsWith("gte."))?.slice(4),
            );
            const upper = Number(
              bounds.find((value) => value.startsWith("lte."))?.slice(4),
            );
            return (
              Number.isFinite(lower) &&
              Number.isFinite(upper) &&
              current[field]! >= lower &&
              current[field]! <= upper
            );
          });
          assert.ok(
            saved.receipts.some(
              (receipt: { storeId: number; status: string }) =>
                receipt.storeId === current.id &&
                receipt.status === "write_pending",
            ),
          );
          if (mode === "write-failure") {
            res.writeHead(503).end(
              JSON.stringify({
                message: "DO-NOT-LOG-SERVER-SECRET",
                code: "XX000",
              }),
            );
            return;
          }
          if (
            !coordinatesMatch ||
            (mode === "conflict" && current.id === 1848)
          ) {
            res.end("[]");
            return;
          }
          Object.assign(current, body, {
            naver_place_id: null,
            kakao_place_id: null,
          });
          if (typeof body.geom === "string")
            current.geom =
              mode === "geojson-apply"
                ? geoPoint(
                    body.position_lng as number,
                    body.position_lat as number,
                  )
                : point(
                    body.position_lng as number,
                    body.position_lat as number,
                  );
          if (mode === "verification-failure") current.image_urls = [];
          res.end(JSON.stringify([{ id: current.id }]));
        } else throw Error("Unexpected method");
      } catch (error) {
        serverFailure = error;
        res.writeHead(500).end("{}");
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
        SUPABASE_SERVICE_ROLE_KEY: "private-fixture-key",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
      } as NodeJS.ProcessEnv;
      if (mode === "no-service-role") delete env.SUPABASE_SERVICE_ROLE_KEY;
      const args = [
        "--report",
        reportPath,
        "--mapping",
        mappingPath,
        "--observations",
        observationPath,
        "--config-env",
        join(dir, "missing-env"),
      ];
      if (mode !== "dry-run") args.push("--apply");
      if (mode.startsWith("resume")) args.push("--resume");
      const result = await runCli(args, env);
      assert.equal(serverFailure, undefined);
      assert.doesNotMatch(
        result.output,
        /private-fixture-key|fixture-anon-key|DO-NOT-LOG-SERVER-SECRET|FORGED-SAVED-UPDATE/,
      );
      if (mode === "no-service-role") {
        assert.equal(result.code, 1);
        assert.equal(offsets.length, 0);
        assert.equal(patches.length, 0);
        return;
      }
      assert.deepEqual(offsets, [0, 200, 400]);
      if (mode === "incomplete-snapshot" || mode === "backup-failure") {
        assert.equal(result.code, 1);
        assert.equal(patches.length, 0);
        return;
      }
      const serialized = await readFile(reportPath, "utf8");
      assert.doesNotMatch(
        serialized,
        /private-fixture-key|fixture-anon-key|DO-NOT-LOG-SERVER-SECRET|FORGED-SAVED-UPDATE/,
      );
      const saved = JSON.parse(serialized);
      assert.equal(saved.allStoresAccounted, true);
      assert.equal(saved.receipts.length, 439);
      const backup = JSON.parse(await readFile(saved.backup, "utf8"));
      assert.equal(backup.rows.length, 439);
      assert.equal(backup.rows[0].address, row().address);
      if (mode === "dry-run") {
        assert.equal(result.code, 0, result.output);
        assert.equal(patches.length, 0);
        assert.equal(saved.counts.changed, 0);
        assert.equal(saved.counts.planned, 2);
      } else if (mode.startsWith("resume")) {
        assert.equal(
          result.code,
          mode === "resume-unverified" ? 2 : 0,
          result.output,
        );
        assert.equal(patches.length, 0);
        assert.equal(saved.previousRunId, "old-run");
        assert.equal(
          saved.receipts[0].reason,
          mode === "resume-unverified"
            ? "previous-write-unverified-review-required"
            : "current-source-name-mismatch",
        );
      } else if (
        ["apply", "geojson-apply", "coordinate-roundtrip"].includes(mode)
      ) {
        assert.equal(result.code, 0, result.output);
        assert.equal(patches.length, 2);
        assert.equal(saved.phase, "complete");
        assert.equal(saved.counts.changed, 2);
        assert.equal(saved.counts.coordinateUpdated, 1);
        assert.equal(saved.counts.coordinateSkipped, 438);
        assert.equal(saved.counts.placeIdsInvalidated, 4);
        assert.equal(saved.receipts[0].status, "applied");
        assert.equal(saved.receipts[0].after.naver_rating, 4.5);
        assert.deepEqual(saved.receipts[0].after.image_urls, row().image_urls);
      } else if (mode === "conflict" || mode === "coordinate-conflict") {
        assert.equal(result.code, 2, result.output);
        assert.equal(patches.length, 2, "conflicting row is never retried");
        assert.equal(saved.counts.conflicts, 1);
        assert.equal(saved.counts.changed, 1);
      } else {
        assert.equal(result.code, 1, result.output);
        assert.equal(
          patches.length,
          1,
          "unexpected failure aborts subsequent writes without retries",
        );
        assert.equal(saved.phase, "aborted");
        assert.equal(saved.counts.changed, 0);
        assert.equal(saved.counts.unverified, 1);
        assert.equal(saved.receipts[1].status, "planned");
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(dir, { recursive: true, force: true });
    }
  });
}
