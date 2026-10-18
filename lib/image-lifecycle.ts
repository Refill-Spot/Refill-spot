// Deployment-bound contract. A filename alone never proves registry membership.
// Do not use these parsers to select objects for deletion outside a claim RPC.
export const MANAGED_IMAGE_PROJECT_ORIGIN =
  "https://ykztepbfcocxmtotrdbk.supabase.co";
export const MANAGED_IMAGE_BUCKETS = [
  "review-images",
  "profile-images",
] as const;
export const MANAGED_IMAGE_EXTENSIONS = ["jpg", "png", "webp"] as const;
export const MANAGED_IMAGE_RPC = {
  reserve: "reserve_managed_image",
  finalize: "finalize_managed_image",
  claim: "claim_managed_image_deletions",
  acknowledge: "acknowledge_managed_image_deletion",
} as const;

export type ManagedImageBucket = (typeof MANAGED_IMAGE_BUCKETS)[number];
export type ManagedImageExtension = (typeof MANAGED_IMAGE_EXTENSIONS)[number];
export type ManagedImageState = "uploading" | "ready" | "deleting" | "deleted";

const UUID_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ASSET_UUID_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UUID = new RegExp(`^${UUID_SOURCE}$`);
const ASSET_UUID = new RegExp(`^${ASSET_UUID_SOURCE}$`);
const CANONICAL_URL = new RegExp(
  "^https://ykztepbfcocxmtotrdbk\\.supabase\\.co/storage/v1/object/public/" +
    `(review-images|profile-images)/(${UUID_SOURCE})/managed-(${ASSET_UUID_SOURCE})\\.(jpg|png|webp)$`,
);
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export type ManagedImageUrl = {
  assetId: string;
  ownerId: string;
  bucketId: ManagedImageBucket;
  objectPath: string;
  extension: ManagedImageExtension;
  canonicalUrl: string;
};

export function parseManagedImageUrl(value: unknown): ManagedImageUrl | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = CANONICAL_URL.exec(value);
  // JS $ also matches before a trailing newline. Require the entire raw input.
  if (match?.[0] !== value) {
    return null;
  }
  const [, bucketId, ownerId, assetId, extension] = match;
  return {
    assetId,
    ownerId,
    bucketId: bucketId as ManagedImageBucket,
    objectPath: `${ownerId}/managed-${assetId}.${extension}`,
    extension: extension as ManagedImageExtension,
    canonicalUrl: value,
  };
}

// Mirrors SQL alias detection, not URL acceptance. Decode ASCII escapes once;
// malformed/non-ASCII escapes remain literal. Every candidate is checked, so a
// canonical path cannot hide a second managed asset in a query or fragment.
export function getManagedImageCandidateIds(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  const decoded = value
    .replace(/[\t\n\r]/g, "")
    .replace(/%[0-9a-f]{2}/gi, (escape) => {
      const byte = Number.parseInt(escape.slice(1), 16);
      return byte >= 1 && byte <= 127 ? String.fromCharCode(byte) : escape;
    });
  const candidates = new RegExp(
    `managed-(${ASSET_UUID_SOURCE})\\.(jpg|png|webp)`,
    "gi",
  );
  return [
    ...new Set(
      [...decoded.matchAll(candidates)].map((m) => m[1].toLowerCase()),
    ),
  ];
}

export type ManagedImageReservation = {
  asset_id: string;
  bucket_id: ManagedImageBucket;
  object_path: string;
  canonical_url: string;
  state: "uploading";
};
export type ManagedImageFinalization = Omit<
  ManagedImageReservation,
  "state"
> & {
  state: "ready";
  storage_object_id: string;
};
export type ManagedImageDeletionClaim = Omit<
  ManagedImageReservation,
  "state"
> & {
  storage_object_id: string;
  lease_token: string;
  lease_expires_at: string;
  attempt_count: number;
};
export type ManagedImageDeletionAcknowledgement = {
  asset_id: string;
  state: "deleting" | "deleted";
  retry_after: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function singleRow(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value.length === 1 ? record(value[0]) : null;
}

function validUuid(value: unknown, pattern = UUID): value is string {
  return (
    typeof value === "string" && pattern.test(value) && value.length === 36
  );
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    TIMESTAMP.test(value) &&
    !value.endsWith("\n") &&
    Number.isFinite(Date.parse(value))
  );
}

function rowIdentity(row: Record<string, unknown>): ManagedImageUrl | null {
  const url = parseManagedImageUrl(row.canonical_url);
  return url &&
    row.asset_id === url.assetId &&
    row.bucket_id === url.bucketId &&
    row.object_path === url.objectPath
    ? url
    : null;
}

export function parseManagedImageReservation(
  data: unknown,
  expected: {
    ownerId: string;
    bucketId: ManagedImageBucket;
    extension: ManagedImageExtension;
  },
): ManagedImageReservation | null {
  const row = singleRow(data);
  const url = row && rowIdentity(row);
  if (
    !row ||
    !url ||
    row.state !== "uploading" ||
    url.ownerId !== expected.ownerId ||
    url.bucketId !== expected.bucketId ||
    url.extension !== expected.extension
  ) {
    return null;
  }
  return {
    asset_id: url.assetId,
    bucket_id: url.bucketId,
    object_path: url.objectPath,
    canonical_url: url.canonicalUrl,
    state: "uploading",
  };
}

export function parseManagedImageFinalization(
  data: unknown,
  expected: ManagedImageReservation,
): ManagedImageFinalization | null {
  const row = singleRow(data);
  const url = row && rowIdentity(row);
  if (
    !row ||
    !url ||
    row.state !== "ready" ||
    row.asset_id !== expected.asset_id ||
    row.bucket_id !== expected.bucket_id ||
    row.object_path !== expected.object_path ||
    row.canonical_url !== expected.canonical_url ||
    !validUuid(row.storage_object_id)
  ) {
    return null;
  }
  return {
    asset_id: url.assetId,
    bucket_id: url.bucketId,
    object_path: url.objectPath,
    canonical_url: url.canonicalUrl,
    state: "ready",
    storage_object_id: row.storage_object_id,
  };
}

// Reject an entire malformed batch. Never salvage a path that did not originate
// from this exact project/cohort, including legacy UUID-shaped filenames.
export function parseManagedImageDeletionClaims(
  data: unknown,
): ManagedImageDeletionClaim[] | null {
  if (!Array.isArray(data) || data.length > 100) {
    return null;
  }
  const seen = new Set<string>();
  const claims: ManagedImageDeletionClaim[] = [];
  for (const value of data) {
    const row = record(value);
    const url = row && rowIdentity(row);
    if (
      !row ||
      !url ||
      seen.has(url.assetId) ||
      !validUuid(row.storage_object_id) ||
      !validUuid(row.lease_token, ASSET_UUID) ||
      !validTimestamp(row.lease_expires_at) ||
      typeof row.attempt_count !== "number" ||
      !Number.isSafeInteger(row.attempt_count) ||
      row.attempt_count < 1 ||
      row.attempt_count > 2147483647
    ) {
      return null;
    }
    seen.add(url.assetId);
    claims.push({
      asset_id: url.assetId,
      bucket_id: url.bucketId,
      object_path: url.objectPath,
      canonical_url: url.canonicalUrl,
      storage_object_id: row.storage_object_id,
      lease_token: row.lease_token,
      lease_expires_at: row.lease_expires_at,
      attempt_count: row.attempt_count,
    });
  }
  return claims;
}

export function parseManagedImageDeletionAcknowledgement(
  data: unknown,
  expectedAssetId: string,
  deleted: boolean,
): ManagedImageDeletionAcknowledgement | null {
  const row = singleRow(data);
  if (
    row?.asset_id !== expectedAssetId ||
    !validUuid(row.asset_id, ASSET_UUID) ||
    row.state !== (deleted ? "deleted" : "deleting") ||
    (deleted ? row.retry_after !== null : !validTimestamp(row.retry_after))
  ) {
    return null;
  }
  return {
    asset_id: row.asset_id,
    state: deleted ? "deleted" : "deleting",
    retry_after: row.retry_after as string | null,
  };
}
