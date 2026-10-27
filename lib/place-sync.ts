import { createHash } from "node:crypto";
import {
  matchPlace,
  type PlaceCandidate,
  type StoreIdentity,
} from "./place-matching";

export type Platform = "naver" | "kakao";

export type SyncStore = StoreIdentity & {
  naverPlaceId: string | null;
  kakaoPlaceId: string | null;
};

export type SyncResult = {
  storeId: number;
  platform: Platform;
  fingerprint: string;
  checkedAt: string;
  status: "matched" | "unmatched" | "ambiguous" | "error" | "conflict";
  reason: string;
  candidate?: PlaceCandidate;
  candidates: PlaceCandidate[];
  applied: boolean;
};

type SyncDependencies = {
  lookup: (store: SyncStore, platform: Platform) => Promise<PlaceCandidate[]>;
  apply?: (
    store: SyncStore,
    platform: Platform,
    candidate: PlaceCandidate,
  ) => Promise<boolean>;
  now?: () => Date;
};

// Never match a truncated lookup: an omitted candidate could change ambiguity.
const MAX_CANDIDATES = 100;

export function fingerprintStore(store: SyncStore): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        store.id,
        store.name,
        store.address,
        store.phoneNumber,
        store.position.lat,
        store.position.lng,
        store.naverPlaceId,
        store.kakaoPlaceId,
      ]),
    )
    .digest("hex");
}

function snapshotStore(store: SyncStore): SyncStore {
  return { ...store, position: { ...store.position } };
}

function snapshotCandidate(candidate: PlaceCandidate): PlaceCandidate {
  // Copy only report evidence, not extra provider response fields.
  return {
    id: candidate.id,
    name: candidate.name,
    address: candidate.address,
    phoneNumber: candidate.phoneNumber,
    lat: candidate.lat,
    lng: candidate.lng,
    url: candidate.url,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCoordinate(value: unknown, limit: number): boolean {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) <= limit)
  );
}

function isProviderCandidate(
  value: unknown,
  platform: Platform,
): value is PlaceCandidate {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    value.id.trim() !== value.id ||
    !/^[1-9][0-9]*$/.test(value.id) ||
    typeof value.name !== "string" ||
    typeof value.address !== "string" ||
    (value.phoneNumber !== null && typeof value.phoneNumber !== "string") ||
    !isCoordinate(value.lat, 90) ||
    !isCoordinate(value.lng, 180)
  ) {
    return false;
  }
  return (
    value.url ===
    (platform === "naver"
      ? `https://m.place.naver.com/place/${value.id}/home`
      : `https://place.map.kakao.com/${value.id}`)
  );
}

function existingPlaceId(store: SyncStore, platform: Platform): string | null {
  return platform === "naver" ? store.naverPlaceId : store.kakaoPlaceId;
}

export async function syncStorePlatform(
  store: SyncStore,
  platform: Platform,
  deps: SyncDependencies,
): Promise<SyncResult> {
  const snapshot = snapshotStore(store);
  const base = {
    storeId: snapshot.id,
    platform,
    fingerprint: fingerprintStore(snapshot),
    candidates: [] as PlaceCandidate[],
    applied: false,
  };
  let checkedAt: string;
  try {
    checkedAt = (deps.now ? deps.now() : new Date()).toISOString();
  } catch {
    return {
      ...base,
      checkedAt: new Date().toISOString(),
      status: "error",
      reason: "clock-failed",
    };
  }
  const result = { ...base, checkedAt };
  if (platform !== "naver" && platform !== "kakao") {
    return { ...result, status: "error", reason: "invalid-platform" };
  }

  let values: PlaceCandidate[];
  try {
    values = await deps.lookup(snapshotStore(snapshot), platform);
  } catch {
    return { ...result, status: "error", reason: "lookup-failed" };
  }
  if (!Array.isArray(values)) {
    return {
      ...result,
      status: "error",
      reason: "invalid-provider-candidates",
    };
  }
  try {
    result.candidates = values
      .slice(0, MAX_CANDIDATES)
      .filter((candidate) => isProviderCandidate(candidate, platform))
      .map(snapshotCandidate);
  } catch {
    return {
      ...result,
      status: "error",
      reason: "invalid-provider-candidates",
    };
  }
  if (values.length > MAX_CANDIDATES) {
    return { ...result, status: "error", reason: "candidate-limit-exceeded" };
  }
  if (result.candidates.length !== values.length) {
    return {
      ...result,
      status: "error",
      reason: "invalid-provider-candidates",
    };
  }

  let match: ReturnType<typeof matchPlace>;
  try {
    match = matchPlace(snapshot, result.candidates);
  } catch {
    return { ...result, status: "error", reason: "matching-failed" };
  }
  if (match.status !== "matched") return { ...result, ...match };

  const matched = { ...result, ...match };
  const currentId = existingPlaceId(snapshot, platform);
  if (currentId !== null && currentId !== match.candidate.id) {
    return { ...matched, status: "conflict", reason: "existing-id-conflict" };
  }
  if (!deps.apply) return matched;

  try {
    const applied = await deps.apply(
      snapshot,
      platform,
      snapshotCandidate(match.candidate),
    );
    return applied === true
      ? { ...matched, applied: true }
      : { ...matched, status: "conflict", reason: "apply-conflict" };
  } catch {
    return { ...matched, status: "error", reason: "apply-failed" };
  }
}

function timestampMilliseconds(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return null;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > monthDays[month - 1] ||
    Number(value.slice(11, 13)) > 23
  ) {
    return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function sameCandidate(left: PlaceCandidate, right: PlaceCandidate): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.address === right.address &&
    left.phoneNumber === right.phoneNumber &&
    left.lat === right.lat &&
    left.lng === right.lng &&
    left.url === right.url
  );
}

// Reuse resumes evidence, not persistence. An --apply caller must still process
// matched results with applied === false rather than skipping those checkpoints.
export function canReuseResult(
  store: SyncStore,
  platform: Platform,
  result: unknown,
  now: Date,
  maxAgeMs = 86_400_000,
): boolean {
  try {
    if (
      (platform !== "naver" && platform !== "kakao") ||
      !isRecord(result) ||
      result.storeId !== store.id ||
      result.platform !== platform ||
      result.fingerprint !== fingerprintStore(store) ||
      typeof result.reason !== "string" ||
      typeof result.applied !== "boolean" ||
      !Number.isFinite(maxAgeMs) ||
      maxAgeMs < 0
    ) {
      return false;
    }
    if (
      result.status !== "matched" &&
      result.status !== "unmatched" &&
      result.status !== "ambiguous"
    ) {
      return false;
    }
    const checkedAt = timestampMilliseconds(result.checkedAt);
    const nowMs = now.getTime();
    if (
      checkedAt === null ||
      !Number.isFinite(nowMs) ||
      checkedAt > nowMs ||
      nowMs - checkedAt > maxAgeMs ||
      !Array.isArray(result.candidates) ||
      result.candidates.length > MAX_CANDIDATES ||
      !result.candidates.every((value) => isProviderCandidate(value, platform))
    ) {
      return false;
    }
    const match = matchPlace(store, result.candidates);
    if (result.status !== "matched") {
      return (
        result.candidate === undefined &&
        result.applied === false &&
        match.status === result.status
      );
    }
    if (!isProviderCandidate(result.candidate, platform)) return false;
    const currentId = existingPlaceId(store, platform);
    if (currentId !== null && currentId !== result.candidate.id) return false;
    if (result.applied && currentId !== result.candidate.id) return false;
    return (
      match.status === "matched" &&
      sameCandidate(match.candidate, result.candidate)
    );
  } catch {
    // Parsed reports are untrusted; malformed evidence must trigger fresh lookup.
    return false;
  }
}
