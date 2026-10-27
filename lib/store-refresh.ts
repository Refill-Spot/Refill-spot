import type { MenuItem } from "../types/menu";
import { coordinateDistanceMeters } from "./registry-coordinates";

export interface StoreRefreshRow {
  id: number;
  name: string;
  address: string;
  phone_number: string | null;
  position_lat: number | null;
  position_lng: number | null;
  position_x?: number | null;
  position_y?: number | null;
  updated_at: string;
  refill_items?: unknown;
  open_hours?: string | null;
  break_time?: string | null;
  [field: string]: unknown;
}

export interface StoreSourceLink {
  storeId: number;
  status: "historical_candidate" | "ambiguous";
  candidates: Array<{ sourceId: string; [field: string]: unknown }>;
}

export interface StoreSourceMapping {
  records: StoreSourceLink[];
}

export interface StoreLiveObservation {
  sourceId: string;
  status: "success" | "source_unavailable" | "missing_menu" | "parse_failure";
  observedAt: string;
  name?: string;
  address?: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  menuItems?: Array<{ name: string; price: string; price_numeric?: number }>;
  openHours?: string;
  breakTime?: string;
  eligibility?: {
    status: string;
    scope: string;
    // External JSON must be checked before any offering reaches refill_items.
    offerings?: unknown;
    [field: string]: unknown;
  };
}

export interface StoreLiveVerification {
  records: StoreLiveObservation[];
}

export interface StoreRefreshUpdates {
  address?: string;
  phone_number?: string;
  refill_items?: MenuItem[];
  open_hours?: string;
  break_time?: string;
  position_lat?: number;
  position_lng?: number;
  position_x?: number;
  position_y?: number;
  geom?: string;
}

export type StoreRefreshField = keyof StoreRefreshUpdates;
export interface StoreRefreshFieldDecision {
  status: "update" | "hold" | "unchanged";
  reason: string;
}

export interface StoreRefreshDecision {
  storeId: number;
  sourceId?: string;
  observedAt?: string;
  status: "update" | "hold";
  reason: string;
  reasons: string[];
  updates: StoreRefreshUpdates;
  fields: Record<StoreRefreshField, StoreRefreshFieldDecision>;
  coordinateDistanceMeters?: number;
}

export interface StoreRefreshPlan {
  generatedAt: string;
  rows: StoreRefreshDecision[];
  counts: {
    total: number;
    changed: number;
    held: number;
    coordinateUpdated: number;
    coordinateSkipped: number;
  };
}

const refreshFields: StoreRefreshField[] = [
  "address",
  "phone_number",
  "refill_items",
  "open_hours",
  "break_time",
  "position_lat",
  "position_lng",
  "position_x",
  "position_y",
  "geom",
];
const coordinateFields: StoreRefreshField[] = [
  "position_lat",
  "position_lng",
  "position_x",
  "position_y",
  "geom",
];
const districts = new Set([
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구",
]);
const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
const maximumAge = 86_400_000;
const numericTolerance = 1e-9;

function text(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

// Deliberately no case folding, transliteration, or branch/suffix removal.
export function normalizeStoreRefreshName(value: unknown): string {
  return text(value).replace(/[\s\p{P}]/gu, "");
}

function normalizedPhone(value: unknown): string | null {
  let valueText = text(value);
  if (!valueText || !/^[+\d\s().-]+$/.test(valueText)) return null;
  valueText = valueText.replace(/[\s().-]/g, "");
  if (valueText.startsWith("+82")) valueText = `0${valueText.slice(3)}`;
  return /^0\d{8,11}$/.test(valueText) ? valueText : null;
}

function seoulAddress(value: unknown) {
  const address = text(value).replace(/\s+/g, " ");
  const region = address.match(
    /^(?:대한민국 )?(?:서울특별시|서울시|서울) ([가-힣]+구)(?: |$)/,
  );
  if (!region || !districts.has(region[1])) return null;
  // A second city/district label is ambiguous, not corroborating address text.
  const rest = address.slice(region[0].length);
  if (
    /(?:서울특별시|서울시|서울)\s|(?:^|[\s,(])[가-힣]+구(?=$|[\s,)])/.test(rest)
  )
    return null;
  const road = rest.match(
    /(?:^|[\s,(])([가-힣A-Za-z0-9·]+(?:대로|로|길))(?:\s+(\d+(?:-\d+)?))?(?=$|[\s,)])/,
  );
  const lot = rest.match(
    /(?:^|[\s,(])([가-힣A-Za-z0-9·]+(?:동(?:\d+가)?|\d+가))\s+(?:산\s*)?(\d+(?:-\d+)?)(?=$|[\s,)])/,
  );
  const neighborhoods = [
    ...rest.matchAll(
      /(?:^|[\s,(])([가-힣A-Za-z0-9·]+(?:동(?:\d+가)?|\d+가))(?=$|[\s,)])/g,
    ),
  ].map((match) => match[1]);
  return {
    address,
    district: region[1],
    road: road?.[1],
    roadNumber: road?.[2],
    lot: lot ? `${lot[1]} ${lot[2]}` : undefined,
    neighborhoods,
    complete: Boolean(road?.[2] || lot),
  };
}

function addressMatches(
  current: NonNullable<ReturnType<typeof seoulAddress>>,
  source: NonNullable<ReturnType<typeof seoulAddress>>,
) {
  const sameRoad = Boolean(
    current.road &&
    current.road === source.road &&
    (!current.roadNumber ||
      !source.roadNumber ||
      current.roadNumber === source.roadNumber),
  );
  const roadConflict = Boolean(current.road && source.road && !sameRoad);
  const sameNeighborhood =
    !roadConflict &&
    current.neighborhoods.some((name) => source.neighborhoods.includes(name));
  return { street: sameRoad, neighborhood: sameNeighborhood };
}

function isoTime(value: unknown): number {
  // A timezone is required: the host's local timezone is not observation evidence.
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return NaN;
  const time = Date.parse(value);
  // Date.parse normalizes impossible dates such as February 30; reject those too.
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
    ? time
    : NaN;
}

function validCoordinatePair(lat: unknown, lng: unknown): lat is number {
  // Bounding box only; the independently matched Seoul address establishes district.
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 37.4 &&
    lat <= 37.72 &&
    lng >= 126.73 &&
    lng <= 127.27
  );
}

function parseMenu(value: unknown): MenuItem[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const result: MenuItem[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.name !== "string" ||
      typeof item.price !== "string"
    )
      return null;
    const name = item.name.trim();
    const price = item.price.trim();
    const amount =
      price === "무료"
        ? 0
        : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\s*원?$/.test(price)
          ? Number(price.replace(/[,\s원]/g, ""))
          : NaN;
    if (
      !name ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (item.price_numeric !== undefined &&
        (typeof item.price_numeric !== "number" ||
          !Number.isFinite(item.price_numeric) ||
          Math.abs(item.price_numeric - amount) > numericTolerance))
    )
      return null;
    // Text stays literal; scope/evidence is checked before calling this mapper.
    result.push({
      name,
      type: "",
      order: result.length,
      price,
      price_numeric: amount,
      is_recommended: false,
    });
  }
  return result;
}

function confirmedRefillMenus(value: unknown): {
  items?: MenuItem[];
  reason: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { reason: "refill-eligibility-not-confirmed-existing-preserved" };
  const eligibility = value as Record<string, unknown>;
  if (eligibility.status !== "confirmed")
    return { reason: "refill-eligibility-not-confirmed-existing-preserved" };
  if (eligibility.scope !== "main_meal" && eligibility.scope !== "buffet")
    return { reason: "refill-meal-scope-required-existing-preserved" };
  if (!Array.isArray(eligibility.offerings) || !eligibility.offerings.length)
    return {
      reason: "refill-offerings-missing-or-malformed-existing-preserved",
    };
  for (const value of eligibility.offerings) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return {
        reason: "refill-offerings-missing-or-malformed-existing-preserved",
      };
    const offering = value as Record<string, unknown>;
    if (
      (offering.scope !== "main_meal" && offering.scope !== "buffet") ||
      typeof offering.evidenceText !== "string" ||
      !offering.evidenceText.trim()
    )
      return {
        reason: "refill-offering-scope-or-evidence-invalid-existing-preserved",
      };
  }
  const items = parseMenu(eligibility.offerings);
  return items
    ? {
        items,
        reason: "confirmed-main-meal-or-buffet-offerings-with-explicit-prices",
      }
    : { reason: "refill-offering-price-or-menu-malformed-existing-preserved" };
}

function storedMenus(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function timeRange(value: string): string | null {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*[-~–]\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
  if (
    startHour > 23 ||
    startMinute > 59 ||
    endHour > 24 ||
    endMinute > 59 ||
    (endHour === 24 && endMinute !== 0) ||
    (startHour === endHour && startMinute === endMinute)
  )
    return null;
  return `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}-${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
}

function recurringHours(value: unknown): { value?: string; reason: string } {
  const input = text(value);
  if (!input) return { reason: "hours-not-observed" };
  // Dated pages describe exceptions/one calendar week. Never make them evergreen.
  // Do not join an ending time's minutes to the next line's weekday (00\n일:).
  if (
    /\d[^\S\r\n]*[월일년]|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|(?:^|\s)\d{1,2}[./]\d{1,2}(?:[.\s(]|$)|오늘|내일|공휴일|임시|이번/.test(
      input,
    )
  )
    return { reason: "dated-or-exception-hours-not-recurring" };
  const daily = input.match(/^매일\s*:?\s*(.+)$/);
  if (daily) {
    const range = timeRange(daily[1]);
    return range
      ? {
          value: dayNames.map((day) => `${day}: ${range}`).join(", "),
          reason: "explicit-daily-schedule",
        }
      : { reason: "unsupported-hours-format" };
  }
  const entries = input
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const schedule = new Map<string, string>();
  for (const entry of entries) {
    const match = entry.match(
      /^(?:매주\s*)?([월화수목금토일])(?:요일)?\s*:\s*(.+)$/,
    );
    const range = match ? timeRange(match[2]) : null;
    if (!match || !range || schedule.has(match[1]))
      return { reason: "unsupported-or-incomplete-weekly-hours" };
    schedule.set(match[1], range);
  }
  return schedule.size === 7
    ? {
        value: dayNames.map((day) => `${day}: ${schedule.get(day)}`).join(", "),
        reason: "explicit-weekly-schedule",
      }
    : { reason: "unsupported-or-incomplete-weekly-hours" };
}

export function storeRefreshValuesEqual(
  actual: unknown,
  expected: unknown,
  tolerance = 0,
): boolean {
  if (typeof actual === "number" && typeof expected === "number")
    return (
      Number.isFinite(actual) &&
      Number.isFinite(expected) &&
      Math.abs(actual - expected) <= tolerance
    );
  if (actual === expected) return true;
  if (Array.isArray(actual) && Array.isArray(expected))
    return (
      actual.length === expected.length &&
      actual.every((value, index) =>
        storeRefreshValuesEqual(value, expected[index], tolerance),
      )
    );
  if (
    !actual ||
    !expected ||
    typeof actual !== "object" ||
    typeof expected !== "object" ||
    Array.isArray(actual) ||
    Array.isArray(expected)
  )
    return false;
  const a = actual as Record<string, unknown>;
  const b = expected as Record<string, unknown>;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every(
      (key) =>
        Object.hasOwn(b, key) &&
        storeRefreshValuesEqual(a[key], b[key], tolerance),
    )
  );
}

function heldDecision(
  store: StoreRefreshRow,
  reason: string,
  sourceId?: string,
): StoreRefreshDecision {
  return {
    storeId: store.id,
    sourceId,
    status: "hold",
    reason,
    reasons: [reason],
    updates: {},
    fields: Object.fromEntries(
      refreshFields.map((field) => [field, { status: "hold", reason }]),
    ) as StoreRefreshDecision["fields"],
  };
}

/** Produces exactly one decision for every input row. No I/O and no input mutation. */
export function buildStoreRefreshPlan(
  currentRows: readonly StoreRefreshRow[],
  mapping: StoreSourceMapping,
  observations: StoreLiveVerification,
  now: Date | string | number = new Date(),
): StoreRefreshPlan {
  if (
    !Array.isArray(currentRows) ||
    !Array.isArray(mapping?.records) ||
    !Array.isArray(observations?.records)
  )
    throw Error("Invalid store refresh inputs");
  const nowTime =
    now instanceof Date
      ? now.getTime()
      : typeof now === "string"
        ? isoTime(now)
        : now;
  if (!Number.isFinite(nowTime)) throw Error("Invalid store refresh clock");
  const links = new Map<number, StoreSourceLink[]>();
  const sourceOwners = new Map<string, Set<number>>();
  const observed = new Map<string, StoreLiveObservation[]>();
  const idCounts = new Map<number, number>();
  for (const row of currentRows)
    idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
  for (const link of mapping.records) {
    if (!link || !Number.isSafeInteger(link.storeId)) continue;
    links.set(link.storeId, [...(links.get(link.storeId) ?? []), link]);
    for (const candidate of Array.isArray(link.candidates)
      ? link.candidates
      : []) {
      if (typeof candidate?.sourceId !== "string" || !candidate.sourceId.trim())
        continue;
      const owners = sourceOwners.get(candidate.sourceId) ?? new Set<number>();
      owners.add(link.storeId);
      sourceOwners.set(candidate.sourceId, owners);
    }
  }
  for (const observation of observations.records) {
    if (!observation || typeof observation.sourceId !== "string") continue;
    observed.set(observation.sourceId, [
      ...(observed.get(observation.sourceId) ?? []),
      observation,
    ]);
  }
  const rows = currentRows.map((store): StoreRefreshDecision => {
    if (
      !Number.isSafeInteger(store.id) ||
      store.id <= 0 ||
      idCounts.get(store.id) !== 1
    )
      return heldDecision(store, "invalid-or-duplicate-store-id");
    const mappings = links.get(store.id);
    if (!mappings?.length) return heldDecision(store, "source-mapping-missing");
    const link = mappings[0];
    if (
      mappings.length !== 1 ||
      link.status !== "historical_candidate" ||
      !Array.isArray(link.candidates) ||
      link.candidates.length !== 1
    )
      return heldDecision(store, "source-mapping-ambiguous");
    const sourceId = link.candidates[0]?.sourceId;
    if (typeof sourceId !== "string" || !sourceId.trim())
      return heldDecision(store, "source-mapping-missing");
    if (sourceOwners.get(sourceId)?.size !== 1)
      return heldDecision(store, "source-shared-by-multiple-stores", sourceId);
    const evidence = observed.get(sourceId);
    if (!evidence?.length)
      return heldDecision(store, "source-observation-missing", sourceId);
    if (evidence.length !== 1)
      return heldDecision(store, "source-observation-ambiguous", sourceId);
    const source = evidence[0];
    if (source.status !== "success")
      return heldDecision(
        store,
        `source-${["source_unavailable", "missing_menu", "parse_failure"].includes(source.status) ? source.status : "invalid-status"}`,
        sourceId,
      );
    const age = nowTime - isoTime(source.observedAt);
    if (!Number.isFinite(age))
      return heldDecision(store, "observation-time-invalid", sourceId);
    if (age < 0)
      return heldDecision(store, "observation-from-future", sourceId);
    if (age > maximumAge)
      return heldDecision(store, "observation-expired", sourceId);
    const name = normalizeStoreRefreshName(store.name);
    if (!name || name !== normalizeStoreRefreshName(source.name))
      return heldDecision(store, "current-source-name-mismatch", sourceId);
    const currentAddress = seoulAddress(store.address);
    const sourceAddress = seoulAddress(source.address);
    if (!sourceAddress?.complete)
      return heldDecision(
        store,
        "source-address-not-full-seoul-address",
        sourceId,
      );
    if (!currentAddress)
      return heldDecision(
        store,
        "current-seoul-district-unrecognized",
        sourceId,
      );
    if (currentAddress.district !== sourceAddress.district)
      return heldDecision(store, "seoul-district-mismatch", sourceId);
    const addressMatch = addressMatches(currentAddress, sourceAddress);
    const currentPhone = normalizedPhone(store.phone_number);
    const sourcePhone = normalizedPhone(source.phone);
    const samePhone = Boolean(currentPhone && currentPhone === sourcePhone);
    const phoneConflict = Boolean(currentPhone && sourcePhone && !samePhone);
    const virtualException =
      phoneConflict &&
      currentPhone!.startsWith("0507") !== sourcePhone!.startsWith("0507") &&
      addressMatch.street;
    if (phoneConflict && !virtualException)
      return heldDecision(store, "explicit-phone-conflict", sourceId);
    if (!samePhone && !addressMatch.street && !addressMatch.neighborhood)
      return heldDecision(store, "identity-not-corroborated", sourceId);
    const decision = heldDecision(store, "no-safe-field-changes", sourceId);
    decision.observedAt = source.observedAt;
    decision.reasons = [
      samePhone
        ? "exact-name-district-phone-match"
        : "exact-name-district-address-match",
    ];
    if (virtualException)
      decision.reasons.push(
        "0507-versus-actual-phone-address-corroborated-phone-preserved",
      );
    const set = <K extends StoreRefreshField>(
      field: K,
      value: StoreRefreshUpdates[K],
      reason: string,
    ) => {
      const before =
        field === "refill_items" ? storedMenus(store[field]) : store[field];
      if (
        storeRefreshValuesEqual(
          before,
          value,
          coordinateFields.includes(field) ? numericTolerance : 0,
        )
      ) {
        decision.fields[field] = {
          status: "unchanged",
          reason: "already-matches-observation",
        };
      } else {
        decision.updates[field] = value;
        decision.fields[field] = { status: "update", reason };
      }
    };
    const hold = (field: StoreRefreshField, reason: string) => {
      decision.fields[field] = { status: "hold", reason };
    };
    set("address", sourceAddress.address, "verified-full-source-address");
    if (!sourcePhone) hold("phone_number", "source-phone-missing-or-malformed");
    else if (virtualException)
      hold("phone_number", "0507-phone-not-overwritten");
    else if (text(store.phone_number) && !samePhone)
      hold("phone_number", "existing-phone-not-replaceable");
    else
      set(
        "phone_number",
        text(source.phone),
        "verified-matching-or-previously-absent-phone",
      );
    // refill_items is rendered under the unlimited-refill heading. General
    // source.menuItems remain staging only and cannot imply refill eligibility.
    const refill = confirmedRefillMenus(source.eligibility);
    if (refill.items) set("refill_items", refill.items, refill.reason);
    else hold("refill_items", refill.reason);
    for (const [field, value] of [
      ["open_hours", source.openHours],
      ["break_time", source.breakTime],
    ] as const) {
      const hours = recurringHours(value);
      if (hours.value) set(field, hours.value, hours.reason);
      else hold(field, hours.reason);
    }
    let coordinateHold: string | undefined;
    if (!validCoordinatePair(source.lat, source.lng))
      coordinateHold = "source-coordinates-missing-or-outside-seoul";
    else if (!validCoordinatePair(store.position_lat, store.position_lng))
      coordinateHold = "current-coordinates-cannot-bound-movement";
    else {
      const lat = source.lat!;
      const lng = source.lng!;
      const distance = coordinateDistanceMeters(
        { lat: store.position_lat!, lng: store.position_lng! },
        { lat, lng },
      );
      decision.coordinateDistanceMeters = distance;
      if (!Number.isFinite(distance) || distance > 100)
        coordinateHold = "coordinate-movement-exceeds-100m";
      else {
        set("position_lat", lat, "observed-coordinates-within-100m");
        set("position_lng", lng, "observed-coordinates-within-100m");
        set("position_x", lng, "observed-longitude-mirror");
        set("position_y", lat, "observed-latitude-mirror");
        const geometry = `SRID=4326;POINT(${lng} ${lat})`;
        if (matchesObservedGeometry(store.geom, lng, lat))
          decision.fields.geom = {
            status: "unchanged",
            reason: "already-matches-observation",
          };
        else set("geom", geometry, "same-observed-wgs84-point");
      }
    }
    if (coordinateHold)
      for (const field of coordinateFields) hold(field, coordinateHold);
    if (Object.keys(decision.updates).length) {
      decision.status = "update";
      decision.reason = "safe-verified-field-updates";
    }
    decision.reasons.push(
      ...new Set(
        Object.values(decision.fields)
          .filter((field) => field.status === "hold")
          .map((field) => field.reason),
      ),
    );
    return decision;
  });
  const changed = rows.filter((row) => row.status === "update").length;
  const coordinateUpdated = rows.filter((row) =>
    coordinateFields.some((field) => row.fields[field].status === "update"),
  ).length;
  return {
    generatedAt: new Date(nowTime).toISOString(),
    rows,
    counts: {
      total: rows.length,
      changed,
      held: rows.length - changed,
      coordinateUpdated,
      coordinateSkipped: rows.length - coordinateUpdated,
    },
  };
}

function matchesObservedGeometry(
  value: unknown,
  lng: number,
  lat: number,
): boolean {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const geometry = value as Record<string, unknown>;
    if (
      geometry.type !== "Point" ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length !== 2 ||
      !geometry.coordinates.every(
        (coordinate) =>
          typeof coordinate === "number" && Number.isFinite(coordinate),
      ) ||
      !geometry.crs ||
      typeof geometry.crs !== "object" ||
      Array.isArray(geometry.crs)
    )
      return false;
    const crs = geometry.crs as Record<string, unknown>;
    if (
      crs.type !== "name" ||
      !crs.properties ||
      typeof crs.properties !== "object" ||
      Array.isArray(crs.properties) ||
      (crs.properties as Record<string, unknown>).name !== "EPSG:4326"
    )
      return false;
    return (
      Math.abs(geometry.coordinates[0] - lng) <= numericTolerance &&
      Math.abs(geometry.coordinates[1] - lat) <= numericTolerance
    );
  }
  if (typeof value !== "string") return false;
  const hex = value.replace(/^\\x/, "");
  if (!/^[\da-f]{50}$/i.test(hex)) return false;
  const bytes = Uint8Array.from(hex.match(/../g)!, (pair) =>
    Number.parseInt(pair, 16),
  );
  if (bytes[0] !== 0 && bytes[0] !== 1) return false;
  const view = new DataView(bytes.buffer);
  const little = bytes[0] === 1;
  return (
    view.getUint32(1, little) === 0x20000001 &&
    view.getUint32(5, little) === 4326 &&
    Math.abs(view.getFloat64(9, little) - lng) <= numericTolerance &&
    Math.abs(view.getFloat64(17, little) - lat) <= numericTolerance
  );
}

/** Read-back verification includes every untouched column, not just the write payload. */
export function verifyStoreRefreshResult(
  before: StoreRefreshRow,
  updates: StoreRefreshUpdates,
  after: StoreRefreshRow,
  updatedAt: string,
): { valid: boolean; mismatches: string[]; invalidatedPlaceIds: string[] } {
  const mismatches: string[] = [];
  const invalidatedPlaceIds: string[] = [];
  const identityChanged = [
    "address",
    "phone_number",
    "position_lat",
    "position_lng",
  ].some(
    (field) =>
      Object.hasOwn(updates, field) &&
      !storeRefreshValuesEqual(
        before[field],
        updates[field as StoreRefreshField],
      ),
  );
  for (const field of new Set([
    ...Object.keys(before),
    ...Object.keys(after),
    ...Object.keys(updates),
    "updated_at",
  ])) {
    if (field === "updated_at") {
      if (
        !Number.isFinite(isoTime(after.updated_at)) ||
        isoTime(after.updated_at) !== isoTime(updatedAt)
      )
        mismatches.push(field);
    } else if (field === "geom" && Object.hasOwn(updates, "geom")) {
      // PostGIS serializes EWKT as EWKB or an explicitly referenced GeoJSON point.
      if (
        !matchesObservedGeometry(
          after.geom,
          updates.position_lng ?? before.position_lng!,
          updates.position_lat ?? before.position_lat!,
        )
      )
        mismatches.push(field);
    } else if (Object.hasOwn(updates, field)) {
      const tolerance =
        coordinateFields.includes(field as StoreRefreshField) ||
        field === "refill_items"
          ? numericTolerance
          : 0;
      if (
        !storeRefreshValuesEqual(
          after[field],
          updates[field as StoreRefreshField],
          tolerance,
        )
      )
        mismatches.push(field);
    } else if (!storeRefreshValuesEqual(after[field], before[field])) {
      if (
        identityChanged &&
        ["naver_place_id", "kakao_place_id"].includes(field) &&
        typeof before[field] === "string" &&
        after[field] === null
      )
        invalidatedPlaceIds.push(field);
      else mismatches.push(field);
    }
  }
  return { valid: mismatches.length === 0, mismatches, invalidatedPlaceIds };
}
