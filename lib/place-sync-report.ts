import { z } from "zod";
import {
  fingerprintStore,
  type Platform,
  type SyncResult,
  type SyncStore,
} from "./place-sync";

type PlaceReference = { id: string; url: string };

export type StoredSyncResult = Omit<SyncResult, "candidate" | "candidates"> & {
  candidate?: PlaceReference;
  candidates: PlaceReference[];
};

// Provider evidence is transient. Only IDs/URLs and local sync metadata may
// cross the report boundary, including when rewriting an untrusted checkpoint.
export function toStoredSyncResult(
  result: SyncResult | StoredSyncResult,
): StoredSyncResult {
  return {
    storeId: result.storeId,
    platform: result.platform,
    fingerprint: result.fingerprint,
    checkedAt: result.checkedAt,
    status: result.status,
    reason: result.reason,
    ...(result.candidate
      ? { candidate: { id: result.candidate.id, url: result.candidate.url } }
      : {}),
    candidates: result.candidates.map(({ id, url }) => ({ id, url })),
    applied: result.applied,
  };
}

const referenceSchema = z
  .object({ id: z.string().regex(/^[1-9][0-9]*$/), url: z.string() })
  .strict();
const resultSchema = z
  .object({
    storeId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    platform: z.enum(["naver", "kakao"]),
    fingerprint: z.string(),
    checkedAt: z.string().datetime({ offset: true }),
    status: z.enum(["matched", "unmatched", "ambiguous"]),
    reason: z.string(),
    candidate: referenceSchema.optional(),
    candidates: z.array(referenceSchema).max(100),
    applied: z.boolean(),
  })
  .strict();

function isProviderReference(
  value: PlaceReference,
  platform: Platform,
): boolean {
  return (
    value.url ===
    (platform === "naver"
      ? `https://m.place.naver.com/place/${value.id}/home`
      : `https://place.map.kakao.com/${value.id}`)
  );
}

// A resumable summary can save a dry-run lookup, never prove a new write's
// identity. Apply must fetch/match again unless the exact ID is already linked.
export function canResumeStoredResult(
  store: SyncStore,
  platform: Platform,
  result: unknown,
  now: Date,
): result is StoredSyncResult {
  try {
    const parsed = resultSchema.safeParse(result);
    if (!parsed.success) return false;
    const saved = parsed.data;
    const checkedAt = Date.parse(saved.checkedAt);
    const age = now.getTime() - checkedAt;
    if (
      saved.storeId !== store.id ||
      saved.platform !== platform ||
      saved.fingerprint !== fingerprintStore(store) ||
      !Number.isFinite(checkedAt) ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 86_400_000 ||
      !saved.candidates.every((value) => isProviderReference(value, platform))
    ) {
      return false;
    }
    if (saved.status !== "matched") {
      return saved.candidate === undefined && saved.applied === false;
    }
    const candidate = saved.candidate;
    if (
      !candidate ||
      !isProviderReference(candidate, platform) ||
      !saved.candidates.some(
        (value) => value.id === candidate.id && value.url === candidate.url,
      )
    ) {
      return false;
    }
    const currentId =
      platform === "naver" ? store.naverPlaceId : store.kakaoPlaceId;
    return (
      (currentId === null || currentId === candidate.id) &&
      (!saved.applied || currentId === candidate.id)
    );
  } catch {
    return false;
  }
}
