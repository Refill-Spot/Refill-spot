import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  buildStagingReview,
  parseCrawlerStaging,
  type CrawlerStaging,
  type CrawlerStagingStore,
} from "../lib/crawler-staging";

const now = new Date("2026-10-25T04:54:00.000Z");

function ordinaryStore(): CrawlerStagingStore {
  return {
    name: "Synthetic ordinary menu fixture",
    address: null,
    latitude: null,
    longitude: null,
    phoneNumber: null,
    menuItems: [{ name: "냉면", price: "6000원" }],
    price: null,
    priceDetails: [],
    openHours: null,
    openHoursRaw: null,
    breakTime: null,
    lastOrder: null,
    holiday: null,
    eligibility: {
      sourceId: null,
      sourceUrl: null,
      observedAt: null,
      status: "unknown",
      scope: "unknown",
      parseStatus: "legacy_unverified",
      currentness: "unverified",
      evidence: [],
      conditions: [],
      offerings: [],
    },
  };
}

function confirmedStore(
  scope: "main_meal" | "buffet" | "side_refill" = "main_meal",
): CrawlerStagingStore {
  const text =
    scope === "side_refill"
      ? "공깃밥 무한리필, 식사 주문 시에만 제공"
      : "삼겹살 무한리필 2인 이상 90분 19000원";
  return {
    ...ordinaryStore(),
    name: "Synthetic confirmed evidence fixture",
    address: "Synthetic address",
    latitude: 37.5,
    longitude: 127,
    phoneNumber: "02-000-0000",
    price: "19000원",
    openHours: "11:00-22:00",
    eligibility: {
      sourceId: "fixture-1",
      sourceUrl: "https://example.org/fixture-1",
      observedAt: "2020-01-01T00:00:00Z",
      status: "confirmed",
      scope,
      parseStatus: "parsed",
      currentness: "unverified",
      evidence: [{ text, kind: "menu", status: "confirmed", scope }],
      conditions: [text],
      offerings: [{ name: text, price: "19000원", scope, evidenceText: text }],
    },
  };
}

function staging(...stores: CrawlerStagingStore[]): CrawlerStaging {
  return { schemaVersion: 1, stores };
}

function review(...stores: CrawlerStagingStore[]) {
  return buildStagingReview(parseCrawlerStaging(staging(...stores), now));
}

test("ordinary menus stay separate and never become refill offerings or app rows", () => {
  const input = staging(ordinaryStore());
  const parsed = parseCrawlerStaging(input, now);
  assert.deepEqual(parsed, input);
  assert.deepEqual(parsed.stores[0].menuItems, [{ name: "냉면", price: "6000원" }]);
  assert.deepEqual(parsed.stores[0].eligibility.offerings, []);
  assert.equal("refill_items" in parsed.stores[0], false);
  assert.equal("refillItems" in parsed.stores[0], false);
  const result = buildStagingReview(parsed);
  assert.equal(result.countsByEligibility.unknown, 1);
  assert.equal(result.countsByScope.main_meal, 0);
  assert.deepEqual(result.records[0].reviewReasons, [
    "currentness_unverified",
    "eligibility_unconfirmed",
    "meal_scope_required",
    "missing_public_details",
  ]);
});

test("side refills are not counted as full meals or buffets", () => {
  const input = staging(confirmedStore("side_refill"));
  const parsed = parseCrawlerStaging(input, now);
  assert.equal(parsed.stores[0].eligibility.offerings[0].scope, "side_refill");
  const result = buildStagingReview(parsed);
  assert.deepEqual(result.countsByScope, {
    main_meal: 0,
    buffet: 0,
    side_refill: 1,
    unknown: 0,
  });
  assert.equal(result.reviewRequiredFlags.mealScopeRequired, true);
  assert.equal(result.records[0].publicationStatus, "needs_review");
  assert.deepEqual(result.records[0].reviewReasons, [
    "currentness_unverified",
    "meal_scope_required",
  ]);
});

test("preserves verbatim conditions, evidence, opaque menus and nullable provenance", () => {
  const store = confirmedStore();
  store.eligibility.evidence[0].text = "  주말 제외\n2인 이상 / 90분  ";
  store.eligibility.conditions = ["  주말 제외\n2인 이상 / 90분  ", "추가 주문 필수"];
  store.eligibility.offerings[0].evidenceText = store.eligibility.evidence[0].text;
  store.menuItems = [
    {
      name: "냉면",
      price: "6000원",
      sourceMetadata: { original: ["  그대로  ", null, 1] },
      seasonal: true,
    },
    {},
  ];
  store.priceDetails = [null, "원문", 19000, { condition: "2인 이상" }, ["주말"]];
  store.openHoursRaw = " 매일 11:00 ~ 22:00 ";
  store.breakTime = "15:00-17:00";
  store.lastOrder = "21:00";
  store.holiday = "매주 월요일";
  const input = staging(store, ordinaryStore());
  const original = structuredClone(input);
  const parsed = parseCrawlerStaging(input, now);
  buildStagingReview(parsed);
  assert.deepEqual(parsed, original);
  assert.deepEqual(input, original);
  assert.equal(parsed.stores[1].eligibility.sourceId, null);
  assert.equal(parsed.stores[1].eligibility.sourceUrl, null);
  assert.equal(parsed.stores[1].eligibility.observedAt, null);
});

test("unknown, needs_review and ended records cannot carry offerings", () => {
  for (const status of ["unknown", "needs_review", "ended"] as const) {
    for (const parseStatus of ["parsed", "missing_section", "parse_error", "legacy_unverified"] as const) {
      const store = confirmedStore();
      store.eligibility.status = status;
      store.eligibility.parseStatus = parseStatus;
      assert.throws(() => parseCrawlerStaging(staging(store), now), `${status}/${parseStatus}`);
      store.eligibility.offerings = [];
      assert.equal(parseCrawlerStaging(staging(store), now).stores[0].eligibility.status, status);
    }
  }
});

test("confirmed records require source identity, URL, observation, parsed evidence and offerings", () => {
  for (const field of ["sourceId", "sourceUrl", "observedAt"] as const) {
    for (const value of [null, ""]) {
      const store = confirmedStore();
      store.eligibility[field] = value;
      assert.throws(() => parseCrawlerStaging(staging(store), now), `${field}: ${value}`);
    }
  }
  for (const field of ["evidence", "offerings"] as const) {
    const store = confirmedStore();
    store.eligibility[field] = [];
    assert.throws(() => parseCrawlerStaging(staging(store), now), field);
  }
  for (const parseStatus of ["parse_error", "missing_section", "legacy_unverified"] as const) {
    const store = confirmedStore();
    store.eligibility.parseStatus = parseStatus;
    assert.throws(() => parseCrawlerStaging(staging(store), now), parseStatus);
  }
});

test("rejects unsafe or malformed source URLs regardless of eligibility status", () => {
  const urls = [
    "javascript:alert(1)",
    "file:///tmp/export.json",
    "ftp://example.org/source",
    "//example.org/source",
    "example.org/source",
    "https://",
    "https://exa mple.org/source",
    "https://user:private-password@example.org/source",
    "https://user@example.org/source",
    "https://:private-password@example.org/source",
    "https://@example.org/source",
    "https://example.org\\@elsewhere.test/source",
    "https://example.org/source\n",
    " https://example.org/source",
    "https://example.org/\tprivate",
  ];
  for (const sourceUrl of urls) {
    for (const fixture of [ordinaryStore, confirmedStore]) {
      const store = fixture();
      store.eligibility.sourceUrl = sourceUrl;
      assert.throws(() => parseCrawlerStaging(staging(store), now), sourceUrl);
    }
  }
  for (const sourceUrl of [
    "http://example.org/source",
    "https://example.org:8443/source?item=1#evidence",
    "https://example.org/source?contact=someone@example.org",
  ]) {
    const store = confirmedStore();
    store.eligibility.sourceUrl = sourceUrl;
    assert.equal(parseCrawlerStaging(staging(store), now).stores[0].eligibility.sourceUrl, sourceUrl);
  }
});

test("rejects invalid, incomplete, timezone-free and future observation times", () => {
  for (const observedAt of [
    "not-a-date",
    "2026-02-29T00:00:00Z",
    "2026-02-30T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-10-25T24:00:00Z",
    "2026-10-25T04:54:00+24:00",
    "2026-10-25",
    "2026-10-25T04:54:00",
    "2026-10-25T04:54Z",
    "2026-10-25T13:54:00+0900",
    "2026-10-25T04:54:00.001Z",
    "2026-10-25T13:54:00.001+09:00",
  ]) {
    for (const fixture of [ordinaryStore, confirmedStore]) {
      const store = fixture();
      store.eligibility.observedAt = observedAt;
      assert.throws(() => parseCrawlerStaging(staging(store), now), observedAt);
    }
  }
  for (const observedAt of [
    "2024-02-29T00:00:00Z",
    "2026-10-25T04:54:00.000Z",
    "2026-10-25T13:54:00+09:00",
    "2026-10-25T00:54:00-04:00",
  ]) {
    const store = confirmedStore();
    store.eligibility.observedAt = observedAt;
    assert.equal(parseCrawlerStaging(staging(store), now).stores[0].eligibility.observedAt, observedAt);
  }
  assert.throws(() => parseCrawlerStaging(staging(), new Date(NaN)), /clock/);
});

test("requires every schema-v1 store and eligibility field even when nullable", () => {
  for (const field of Object.keys(ordinaryStore())) {
    const store = ordinaryStore();
    delete (store as Partial<CrawlerStagingStore>)[field as keyof CrawlerStagingStore];
    assert.throws(() => parseCrawlerStaging(staging(store), now), field);
  }
  for (const field of Object.keys(ordinaryStore().eligibility)) {
    const store = ordinaryStore();
    delete (store.eligibility as Partial<CrawlerStagingStore["eligibility"]>)[field as keyof CrawlerStagingStore["eligibility"]];
    assert.throws(() => parseCrawlerStaging(staging(store), now), field);
  }
});

test("rejects unexpected fields, incompatible schema versions, invalid enums and wrong shapes", () => {
  const store = confirmedStore();
  const invalidInputs: unknown[] = [
    null,
    [],
    { stores: [] },
    { schemaVersion: 1 },
    { schemaVersion: "1", stores: [] },
    { schemaVersion: 2, stores: [] },
    { ...staging(), extra: true },
    staging({ ...store, extra: true } as CrawlerStagingStore),
    staging({ ...store, refill_items: store.menuItems } as CrawlerStagingStore),
    staging({ ...store, name: "" }),
    staging({ ...store, menuItems: [null] } as unknown as CrawlerStagingStore),
    staging({ ...store, menuItems: ["menu"] } as unknown as CrawlerStagingStore),
    staging({ ...store, priceDetails: {} } as unknown as CrawlerStagingStore),
  ];
  for (const eligibility of [
    { ...store.eligibility, status: "published" },
    { ...store.eligibility, scope: "meal" },
    { ...store.eligibility, parseStatus: "success" },
    { ...store.eligibility, currentness: "verified" },
    { ...store.eligibility, extra: "secret" },
    { ...store.eligibility, conditions: [null] },
    { ...store.eligibility, evidence: [{ ...store.eligibility.evidence[0], extra: true }] },
    { ...store.eligibility, evidence: [{ ...store.eligibility.evidence[0], text: "" }] },
    { ...store.eligibility, evidence: [{ ...store.eligibility.evidence[0], kind: "inferred" }] },
    { ...store.eligibility, offerings: [{ ...store.eligibility.offerings[0], scope: "unknown" }] },
    { ...store.eligibility, offerings: [{ ...store.eligibility.offerings[0], evidenceText: "" }] },
    { ...store.eligibility, offerings: [{ ...store.eligibility.offerings[0], extra: true }] },
    { ...store.eligibility, offerings: [{ ...store.eligibility.offerings[0], price: 19000 }] },
  ]) {
    invalidInputs.push({ schemaVersion: 1, stores: [{ ...store, eligibility }] });
  }
  for (const input of invalidInputs) {
    assert.throws(() => parseCrawlerStaging(input, now));
  }
});

test("validates finite coordinate ranges without rejecting valid zero or boundary coordinates", () => {
  for (const [latitude, longitude] of [[0, 0], [-90, -180], [90, 180], [null, null]]) {
    const store = { ...ordinaryStore(), latitude, longitude };
    assert.equal(parseCrawlerStaging(staging(store), now).stores.length, 1);
  }
  for (const [latitude, longitude] of [[90.001, 0], [-90.001, 0], [0, 180.001], [0, -180.001], [NaN, 0], [0, Infinity]]) {
    assert.throws(() => parseCrawlerStaging(staging({ ...ordinaryStore(), latitude, longitude }), now));
  }
  assert.throws(() => parseCrawlerStaging({ schemaVersion: 1, stores: [{ ...ordinaryStore(), latitude: "37.5" }] }, now));
  const result = review({ ...confirmedStore(), latitude: 0, longitude: 0 });
  assert.deepEqual(result.records[0].missingRequiredPublicDetails, []);
});

test("review counts eligibility, scope and absent public details without ever auto-publishing", () => {
  const unknown = ordinaryStore();
  const ended = ordinaryStore();
  ended.eligibility.status = "ended";
  ended.eligibility.parseStatus = "missing_section";
  const parseError = ordinaryStore();
  parseError.eligibility.status = "needs_review";
  parseError.eligibility.parseStatus = "parse_error";
  parseError.address = "  ";
  parseError.phoneNumber = "";
  parseError.openHours = "\t";
  const result = review(
    confirmedStore(),
    confirmedStore("buffet"),
    confirmedStore("side_refill"),
    unknown,
    ended,
    parseError,
  );
  assert.equal(result.totalStores, 6);
  assert.deepEqual(result.countsByEligibility, { confirmed: 3, needs_review: 1, ended: 1, unknown: 1 });
  assert.deepEqual(result.countsByScope, { main_meal: 1, buffet: 1, side_refill: 1, unknown: 3 });
  assert.deepEqual(result.missingRequiredPublicDetails, {
    address: 3,
    latitude: 3,
    longitude: 3,
    phoneNumber: 3,
    price: 3,
    openHours: 3,
  });
  assert.deepEqual(result.publicationStatusCounts, { needs_review: 6 });
  assert.equal(result.publicationAllowed, false);
  assert.equal(result.reviewRequired, true);
  assert.deepEqual(result.reviewRequiredFlags, {
    currentnessUnverified: true,
    unconfirmedEligibility: true,
    mealScopeRequired: true,
    missingPublicDetails: true,
  });
  for (const [index, record] of result.records.entries()) {
    assert.equal(record.storeIndex, index);
    assert.equal(record.currentness, "unverified");
    assert.equal(record.publicationStatus, "needs_review");
    assert.ok(record.reviewReasons.includes("currentness_unverified"));
  }
  assert.deepEqual(result.records[0].reviewReasons, ["currentness_unverified"]);
  assert.deepEqual(result.records[1].reviewReasons, ["currentness_unverified"]);
  assert.deepEqual(result.records[5].missingRequiredPublicDetails, ["address", "latitude", "longitude", "phoneNumber", "price", "openHours"]);
});

test("empty staging has no queued records and still grants no publication permission", () => {
  const result = review();
  assert.equal(result.totalStores, 0);
  assert.deepEqual(result.records, []);
  assert.equal(result.publicationAllowed, false);
  assert.equal(result.reviewRequired, false);
  assert.equal(Object.values(result.countsByEligibility).reduce((a, b) => a + b, 0), 0);
});

function runCli(args: string[], preload?: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      ...(preload ? ["--import", pathToFileURL(preload).href] : []),
      "--import", "tsx", "scripts/check-crawler-staging.ts", ...args,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Staging CLI exceeded fixture timeout"));
    }, 30_000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

test("offline CLI emits only sanitized aggregates with review flags and leaves the export unchanged", async () => {
  const dir = await mkdtemp(join(tmpdir(), "refill-staging-"));
  const file = join(dir, "private-input.json");
  const preload = join(dir, "offline.mjs");
  try {
    const store = confirmedStore();
    store.name = "private-business-name";
    store.eligibility.sourceId = "private-source-identity";
    store.eligibility.sourceUrl = "https://example.org/private-source?token=private-token";
    store.eligibility.evidence[0].text = "private-provider-text";
    const original = JSON.stringify(staging(store));
    await writeFile(file, original);
    await writeFile(preload, `import { Socket } from "node:net";
const forbidden = () => { throw Error("Network is forbidden in offline staging validation"); };
globalThis.fetch = forbidden;
Socket.prototype.connect = forbidden;
`);
    const result = await runCli([file], preload);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.equal(output.schemaVersion, 1);
    assert.equal(output.totalStores, 1);
    assert.deepEqual(output.countsByEligibility, { confirmed: 1, needs_review: 0, ended: 0, unknown: 0 });
    assert.deepEqual(output.publicationStatusCounts, { needs_review: 1 });
    assert.equal(output.publicationAllowed, false);
    assert.equal(output.reviewRequiredFlags.currentnessUnverified, true);
    assert.equal("records" in output, false);
    assert.doesNotMatch(result.stdout, /private-|sourceId|sourceUrl|evidenceText|menuItems|refill_items/);
    assert.equal(await readFile(file, "utf8"), original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI errors are nonzero, sanitized and never echo invalid values or input paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "refill-staging-errors-"));
  const file = join(dir, "private-input-path.json");
  try {
    for (const content of [
      "malformed-json-private-text",
      JSON.stringify({ schemaVersion: 1, stores: [], "private-extra-key": "private-secret" }),
      JSON.stringify(staging({ ...confirmedStore(), eligibility: { ...confirmedStore().eligibility, sourceUrl: "https://user:private-secret@example.org/" } })),
    ]) {
      await writeFile(file, content);
      const result = await runCli([file]);
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      const output = JSON.parse(result.stderr);
      assert.equal(output.valid, false);
      assert.equal(output.reviewRequired, true);
      assert.equal(output.publicationAllowed, false);
      assert.doesNotMatch(result.stderr, /private-|example\.org|user|ZodError/);
    }
    for (const args of [[], [file, file], ["https://example.org/private-token"], ["\\\\private-server\\share\\private-file.json"], ["--apply"]]) {
      const result = await runCli(args);
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.doesNotMatch(result.stderr, /private-|example\.org|--apply/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
