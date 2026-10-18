import { timingSafeEqual } from "node:crypto";
import { StorageApiError } from "@supabase/supabase-js";
import {
  MANAGED_IMAGE_PROJECT_ORIGIN,
  MANAGED_IMAGE_RPC,
  parseManagedImageDeletionAcknowledgement,
  parseManagedImageDeletionClaims,
  type ManagedImageBucket,
  type ManagedImageDeletionClaim,
} from "./image-lifecycle";

export const IMAGE_CLEANUP_BATCH_LIMIT = 20;
export const IMAGE_CLEANUP_NETWORK_TIMEOUT_MS = 5_000;
export const IMAGE_CLEANUP_EXECUTION_BUDGET_MS = 45_000;
const LEASE_MARGIN_MS = 1_000;

type ProviderResult = { data: unknown; error: unknown };
type CleanupStorage = {
  info(path: string): Promise<ProviderResult>;
  remove(paths: string[]): Promise<ProviderResult>;
};

// This deliberately exposes neither sessions nor arbitrary table queries.
export type ImageCleanupClient = {
  rpc(
    name: typeof MANAGED_IMAGE_RPC.claim | typeof MANAGED_IMAGE_RPC.acknowledge,
    parameters: Record<string, unknown>,
  ): PromiseLike<ProviderResult>;
  storage: { from(bucket: ManagedImageBucket): CleanupStorage };
};

export type ImageCleanupClientOptions = {
  auth: {
    persistSession: false;
    autoRefreshToken: false;
    detectSessionInUrl: false;
  };
  db: { retry: false; timeout: number };
  global: { fetch: typeof fetch };
};

export type ImageCleanupEnvironment = {
  CRON_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export type ImageCleanupDependencies = {
  createClient(
    origin: string,
    serviceRoleKey: string,
    options: ImageCleanupClientOptions,
  ): ImageCleanupClient;
  fetch?: typeof fetch;
  now?: () => number;
};

export type ImageCleanupCounts = {
  claimed: number;
  deleted: number;
  failed: number;
};

type CleanupResult = { status: number; counts: ImageCleanupCounts };

function validSecret(value: string | undefined): value is string {
  // Deploy with at least 32 random bytes, encoded as hex or base64url. Reject
  // blanks, short examples and repeated-character placeholders, not trim them.
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{32,256}$/.test(value) &&
    !/\s/.test(value) &&
    new Set(value).size >= 8
  );
}

function authorized(request: Request, secret: string): boolean {
  const supplied = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (supplied?.length !== expected.length) {
    return false;
  }
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

// Applied to both RPC and Storage, including response body consumption. Never
// follow a redirect carrying a service credential outside the known project.
export function createImageCleanupFetch(fetcher: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (
      url.origin !== MANAGED_IMAGE_PROJECT_ORIGIN ||
      url.username ||
      url.password
    ) {
      throw new Error("cleanup_origin_rejected");
    }
    const upstreamSignal =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const timeout = AbortSignal.timeout(IMAGE_CLEANUP_NETWORK_TIMEOUT_MS);
    return fetcher(input, {
      ...init,
      signal: upstreamSignal
        ? AbortSignal.any([upstreamSignal, timeout])
        : timeout,
      redirect: "error",
      cache: "no-store",
    });
  };
}

function hasOperationTime(
  claim: ManagedImageDeletionClaim,
  now: () => number,
  deadline: number,
): boolean {
  return (
    Math.min(Date.parse(claim.lease_expires_at), deadline) >
    now() + IMAGE_CLEANUP_NETWORK_TIMEOUT_MS + LEASE_MARGIN_MS
  );
}

function isAbsent(result: ProviderResult): boolean {
  // Generic 404s, legacy not_found, missing buckets, permission failures and
  // network errors do not prove absence. The SDK preserves the provider code.
  // Even NoSuchKey can hide a versioning delete marker. The SQL claim/ack RPCs
  // must verify both buckets remain DISABLED, and positive ack must veto any
  // archived/versioned/delete-marker metadata at this exact claimed path.
  return (
    result.data === null &&
    result.error instanceof StorageApiError &&
    result.error.code === "NoSuchKey" &&
    ((result.error.status === 404 &&
      (result.error.statusCode === "404" ||
        result.error.statusCode === "NoSuchKey")) ||
      // This project's observed SDK envelope uses HTTP 400 with provider 404.
      (result.error.status === 400 && result.error.statusCode === "404"))
  );
}

function isExactObject(
  result: ProviderResult,
  claim: ManagedImageDeletionClaim,
): boolean {
  if (
    result.error !== null ||
    result.data === null ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    return false;
  }
  const object = result.data as Record<string, unknown>;
  return (
    object.id === claim.storage_object_id &&
    object.name === claim.object_path &&
    object.bucketId === claim.bucket_id &&
    // storage-js 2.117.3 info() camelizes these documented optional fields.
    // Missing flags cannot attest this newer schema's unversioned semantics.
    // `version` itself is a backend identifier, including for unversioned files.
    object.archivedAt === null &&
    object.isDeleteMarker === false &&
    object.isVersioned === false
  );
}

async function acknowledge(
  client: ImageCleanupClient,
  claim: ManagedImageDeletionClaim,
  deleted: boolean,
  error: string | null,
  now: () => number,
  deadline: number,
): Promise<boolean> {
  if (!hasOperationTime(claim, now, deadline)) {
    return false;
  }
  try {
    const result = await client.rpc(MANAGED_IMAGE_RPC.acknowledge, {
      p_asset_id: claim.asset_id,
      p_lease_token: claim.lease_token,
      p_deleted: deleted,
      p_error: error,
    });
    return (
      result.error === null &&
      parseManagedImageDeletionAcknowledgement(
        result.data,
        claim.asset_id,
        deleted,
      ) !== null
    );
  } catch {
    return false;
  }
}

async function deleteClaim(
  client: ImageCleanupClient,
  claim: ManagedImageDeletionClaim,
  now: () => number,
  deadline: number,
): Promise<boolean> {
  // An expired lease must not initiate even an info request. SQL keeps the
  // deleting fence after failures and expiration; this worker never clears it.
  if (!hasOperationTime(claim, now, deadline)) {
    return false;
  }
  let failure = "storage_info_failed";
  try {
    const storage = client.storage.from(claim.bucket_id);
    const before = await storage.info(claim.object_path);
    if (isAbsent(before)) {
      return acknowledge(client, claim, true, null, now, deadline);
    }
    if (!isExactObject(before, claim)) {
      failure = "storage_identity_unconfirmed";
    } else if (!hasOperationTime(claim, now, deadline)) {
      return false;
    } else {
      failure = "storage_remove_failed";
      const removed = await storage.remove([claim.object_path]);
      if (
        removed.error === null &&
        Array.isArray(removed.data) &&
        removed.data.every(
          (object) =>
            object !== null &&
            typeof object === "object" &&
            !Array.isArray(object) &&
            object.id === claim.storage_object_id &&
            object.name === claim.object_path &&
            // remove() returns raw FileObject fields, unlike info(). A marker
            // response must never become success merely because info is 404.
            object.archived_at === null &&
            object.is_delete_marker === false &&
            object.is_versioned === false,
        )
      ) {
        if (!hasOperationTime(claim, now, deadline)) {
          return false;
        }
        failure = "storage_absence_unconfirmed";
        const after = await storage.info(claim.object_path);
        if (isAbsent(after)) {
          // A stale, failed or malformed ack is a failure even after Storage
          // removal. A later lease can retry and confirm the absent object.
          return acknowledge(client, claim, true, null, now, deadline);
        }
      }
    }
  } catch {
    // Do not persist or log raw provider errors, paths, URLs or personal data.
  }
  await acknowledge(client, claim, false, failure, now, deadline);
  return false;
}

export async function handleImageCleanupRequest(
  request: Request,
  environment: ImageCleanupEnvironment,
  dependencies: ImageCleanupDependencies,
): Promise<CleanupResult> {
  const counts: ImageCleanupCounts = { claimed: 0, deleted: 0, failed: 0 };
  const secret = environment.CRON_SECRET;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !validSecret(secret) ||
    environment.SUPABASE_URL !== MANAGED_IMAGE_PROJECT_ORIGIN ||
    typeof serviceRoleKey !== "string" ||
    serviceRoleKey.length === 0 ||
    serviceRoleKey.trim() !== serviceRoleKey ||
    /\s/.test(serviceRoleKey) ||
    serviceRoleKey === secret
  ) {
    return { status: 503, counts };
  }
  if (!authorized(request, secret)) {
    return { status: 401, counts };
  }
  // The caller cannot supply paths, selectors or limits, including via query.
  if (
    (request.method !== "GET" && request.method !== "POST") ||
    new URL(request.url).search !== "" ||
    request.body !== null
  ) {
    return { status: 400, counts };
  }

  const now = dependencies.now ?? Date.now;
  // Include client setup and the claim RPC in the total request budget.
  const deadline = now() + IMAGE_CLEANUP_EXECUTION_BUDGET_MS;
  try {
    const client = dependencies.createClient(
      MANAGED_IMAGE_PROJECT_ORIGIN,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        db: { retry: false, timeout: IMAGE_CLEANUP_NETWORK_TIMEOUT_MS },
        global: {
          fetch: createImageCleanupFetch(dependencies.fetch ?? fetch),
        },
      },
    );
    if (
      now() + IMAGE_CLEANUP_NETWORK_TIMEOUT_MS + LEASE_MARGIN_MS >=
      deadline
    ) {
      return { status: 502, counts };
    }
    const result = await client.rpc(MANAGED_IMAGE_RPC.claim, {
      p_limit: IMAGE_CLEANUP_BATCH_LIMIT,
    });
    const claims =
      result.error === null
        ? parseManagedImageDeletionClaims(result.data)
        : null;
    if (!claims || claims.length > IMAGE_CLEANUP_BATCH_LIMIT) {
      return { status: 502, counts };
    }
    counts.claimed = claims.length;
    counts.failed = claims.length;
    // Validate the ENTIRE batch first. Start an object only with room for
    // info/remove/info/ack at their worst-case timeouts plus a response margin.
    // Unstarted claims remain failed/unconfirmed; their durable leases retry.
    for (const claim of claims) {
      if (
        now() + 4 * IMAGE_CLEANUP_NETWORK_TIMEOUT_MS + LEASE_MARGIN_MS >=
        deadline
      ) {
        break;
      }
      if (await deleteClaim(client, claim, now, deadline)) {
        counts.deleted++;
        counts.failed--;
      }
    }
    return { status: counts.failed === 0 ? 200 : 502, counts };
  } catch {
    return { status: 502, counts };
  }
}
