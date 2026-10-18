import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { StorageApiError } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as cleanup from "../lib/image-cleanup";
import {
  MANAGED_IMAGE_PROJECT_ORIGIN,
  MANAGED_IMAGE_RPC,
  type ManagedImageDeletionClaim,
} from "../lib/image-lifecycle";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const OWNER = "12345678-1234-4234-9234-123456789abc";
const ASSET = "11111111-1111-4111-8111-111111111111";
const SECOND_ASSET = "22222222-2222-4222-9222-222222222222";
const OBJECT = "33333333-3333-4333-a333-333333333333";
const TOKEN = "44444444-4444-4444-b444-444444444444";
const SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SERVICE_KEY = "private-service-role-key-for-in-memory-tests";
const ENDPOINT = "https://refill.example/api/internal/images/cleanup";
const ENVIRONMENT = {
  CRON_SECRET: SECRET,
  SUPABASE_URL: MANAGED_IMAGE_PROJECT_ORIGIN,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
};
const EMPTY_COUNTS = { claimed: 0, deleted: 0, failed: 0 };

function claim(assetId = ASSET): ManagedImageDeletionClaim {
  const path = `${OWNER}/managed-${assetId}.jpg`;
  return {
    asset_id: assetId,
    bucket_id: "review-images",
    object_path: path,
    canonical_url:
      `${MANAGED_IMAGE_PROJECT_ORIGIN}/storage/v1/object/public/` +
      `review-images/${path}`,
    storage_object_id: OBJECT,
    lease_token: TOKEN,
    lease_expires_at: new Date(NOW + 300_000).toISOString(),
    attempt_count: 1,
  };
}
const CLAIM = claim();
const SECOND_CLAIM = claim(SECOND_ASSET);

type Result = { data: unknown; error: unknown };
type AckParameters = {
  p_asset_id: string;
  p_lease_token: string;
  p_deleted: boolean;
  p_error: string | null;
};
type Options = {
  claims?: unknown;
  claimError?: unknown;
  afterClaim?: () => void;
  throwClaim?: boolean;
  throwClient?: boolean;
  info?: (path: string, occurrence: number) => Result | Promise<Result>;
  remove?: (paths: string[]) => Result | Promise<Result>;
  acknowledge?: (parameters: AckParameters) => Result | Promise<Result>;
  now?: () => number;
};

function objectInfo(image = CLAIM): Result {
  return {
    data: {
      id: image.storage_object_id,
      name: image.object_path,
      bucketId: image.bucket_id,
      version: "unversioned-backend-identifier",
      archivedAt: null,
      isDeleteMarker: false,
      isVersioned: false,
    },
    error: null,
  };
}

function absent(): Result {
  return {
    data: null,
    error: new StorageApiError(
      "private object details must not escape",
      404,
      "404",
      "storage",
      "NoSuchKey",
    ),
  };
}

function request(
  authorization: string | null = `Bearer ${SECRET}`,
  url = ENDPOINT,
  body?: string,
  method = "POST",
) {
  return new NextRequest(url, {
    method,
    headers: authorization ? { Authorization: authorization } : {},
    body,
  });
}

// All provider calls are in-memory. This does not activate lifecycle guards,
// call live Storage or claim SQL/physical-deletion concurrency verification.
function harness(options: Options = {}) {
  const calls = {
    clients: [] as {
      origin: string;
      key: string;
      options: cleanup.ImageCleanupClientOptions;
    }[],
    rpc: [] as { name: string; parameters: Record<string, unknown> }[],
    buckets: [] as string[],
    info: [] as string[],
    remove: [] as string[][],
    acknowledgements: [] as AckParameters[],
  };
  const removed = new Set<string>();
  const infoOccurrences = new Map<string, number>();
  const client: cleanup.ImageCleanupClient = {
    async rpc(name, parameters) {
      calls.rpc.push({ name, parameters: structuredClone(parameters) });
      if (name === MANAGED_IMAGE_RPC.claim) {
        assert.deepEqual(parameters, { p_limit: 20 });
        if (options.throwClaim) throw new Error("private claim failure");
        options.afterClaim?.();
        return {
          data: options.claims === undefined ? [CLAIM] : options.claims,
          error: options.claimError ?? null,
        };
      }
      assert.equal(name, MANAGED_IMAGE_RPC.acknowledge);
      const ack = parameters as AckParameters;
      calls.acknowledgements.push(structuredClone(ack));
      if (options.acknowledge) return options.acknowledge(ack);
      return {
        data: [
          {
            asset_id: ack.p_asset_id,
            state: ack.p_deleted ? "deleted" : "deleting",
            retry_after: ack.p_deleted
              ? null
              : new Date(NOW + 300_000).toISOString(),
          },
        ],
        error: null,
      };
    },
    storage: {
      from(bucket) {
        calls.buckets.push(bucket);
        return {
          async info(path) {
            calls.info.push(path);
            const occurrence = (infoOccurrences.get(path) ?? 0) + 1;
            infoOccurrences.set(path, occurrence);
            if (options.info) return options.info(path, occurrence);
            if (removed.has(path)) return absent();
            return objectInfo(
              path === SECOND_CLAIM.object_path ? SECOND_CLAIM : CLAIM,
            );
          },
          async remove(paths) {
            calls.remove.push([...paths]);
            if (options.remove) return options.remove(paths);
            for (const path of paths) removed.add(path);
            return { data: [], error: null };
          },
        };
      },
    },
  };
  const dependencies: cleanup.ImageCleanupDependencies = {
    createClient(origin, key, clientOptions) {
      calls.clients.push({ origin, key, options: clientOptions });
      if (options.throwClient) throw new Error("private client details");
      return client;
    },
    async fetch() {
      throw new Error("Test attempted a network call");
    },
    now: options.now ?? (() => NOW),
  };
  return {
    calls,
    dependencies,
    run(
      input = request(),
      environment: cleanup.ImageCleanupEnvironment = ENVIRONMENT,
    ) {
      return cleanup.handleImageCleanupRequest(
        input,
        environment,
        dependencies,
      );
    },
  };
}

test("absent, weak or wrong-project configuration fails before client or claim", async () => {
  const invalid: cleanup.ImageCleanupEnvironment[] = [
    {},
    ...[undefined, "", " ", "example", "a".repeat(64), `${SECRET}\n`].map(
      (secret) => ({ ...ENVIRONMENT, CRON_SECRET: secret }),
    ),
    ...[
      undefined,
      "",
      MANAGED_IMAGE_PROJECT_ORIGIN.replace("https:", "http:"),
      "https://another-project.supabase.co",
      `${MANAGED_IMAGE_PROJECT_ORIGIN}/`,
    ].map((origin) => ({ ...ENVIRONMENT, SUPABASE_URL: origin })),
    ...[undefined, "", " ", ` ${SERVICE_KEY}`, SECRET].map((key) => ({
      ...ENVIRONMENT,
      SUPABASE_SERVICE_ROLE_KEY: key,
    })),
  ];
  for (const environment of invalid) {
    for (const method of ["GET", "POST"]) {
      const worker = harness();
      assert.deepEqual(
        await worker.run(
          request(`Bearer ${SECRET}`, ENDPOINT, undefined, method),
          environment,
        ),
        { status: 503, counts: EMPTY_COUNTS },
      );
      assert.equal(worker.calls.clients.length, 0);
      assert.equal(worker.calls.rpc.length, 0);
    }
  }
});

test("an unset cron secret never authenticates the literal Bearer undefined", async () => {
  for (const method of ["GET", "POST"]) {
    const worker = harness();
    assert.deepEqual(
      await worker.run(
        request("Bearer undefined", ENDPOINT, undefined, method),
        { ...ENVIRONMENT, CRON_SECRET: undefined },
      ),
      { status: 503, counts: EMPTY_COUNTS },
    );
    assert.equal(worker.calls.clients.length, 0);
    assert.equal(worker.calls.rpc.length, 0);
  }
});

test("bearer authentication rejects missing, wrong and alternate credentials before claim", async () => {
  for (const authorization of [
    null,
    "",
    `Bearer ${SECRET.slice(1)}`,
    `Bearer ${SECRET.replace(/^0/, "1")}`,
    `bearer ${SECRET}`,
    `Basic ${SECRET}`,
  ]) {
    for (const method of ["GET", "POST"]) {
      const worker = harness();
      assert.equal(
        (await worker.run(request(authorization, ENDPOINT, undefined, method)))
          .status,
        401,
      );
      assert.equal(worker.calls.clients.length, 0);
      assert.equal(worker.calls.rpc.length, 0);
    }
  }
  for (const method of ["GET", "POST"]) {
    const worker = harness();
    const cookieRequest = new NextRequest(`${ENDPOINT}?secret=${SECRET}`, {
      method,
      headers: { Cookie: `CRON_SECRET=${SECRET}` },
    });
    assert.equal((await worker.run(cookieRequest)).status, 401);
    assert.equal(worker.calls.clients.length, 0);
    assert.equal(worker.calls.rpc.length, 0);
  }
});

test("caller paths, selectors and batch limits are rejected before client creation", async () => {
  for (const input of [
    request(`Bearer ${SECRET}`, `${ENDPOINT}?limit=100`),
    request(`Bearer ${SECRET}`, `${ENDPOINT}?object_path=${CLAIM.object_path}`),
    request(`Bearer ${SECRET}`, ENDPOINT, JSON.stringify({ p_limit: 1 })),
    request(`Bearer ${SECRET}`, ENDPOINT, JSON.stringify([CLAIM.object_path])),
    request(`Bearer ${SECRET}`, `${ENDPOINT}?limit=100`, undefined, "GET"),
    request(
      `Bearer ${SECRET}`,
      `${ENDPOINT}?object_path=${CLAIM.object_path}`,
      undefined,
      "GET",
    ),
    ...["HEAD", "PUT", "PATCH", "DELETE"].map((method) =>
      request(`Bearer ${SECRET}`, ENDPOINT, undefined, method),
    ),
  ]) {
    const worker = harness();
    assert.equal((await worker.run(input)).status, 400);
    assert.equal(worker.calls.clients.length, 0);
    assert.equal(worker.calls.rpc.length, 0);
  }
});

test("the worker creates a dedicated non-session service client with fixed bounded claims", async () => {
  const worker = harness({ claims: [] });
  assert.deepEqual(await worker.run(), { status: 200, counts: EMPTY_COUNTS });
  assert.equal(worker.calls.clients.length, 1);
  const client = worker.calls.clients[0];
  assert.equal(client.origin, MANAGED_IMAGE_PROJECT_ORIGIN);
  assert.equal(client.key, SERVICE_KEY);
  assert.deepEqual(client.options.auth, {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  });
  assert.deepEqual(client.options.db, {
    retry: false,
    timeout: cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS,
  });
  assert.equal(typeof client.options.global.fetch, "function");
  assert.deepEqual(worker.calls.rpc, [
    { name: MANAGED_IMAGE_RPC.claim, parameters: { p_limit: 20 } },
  ]);
  assert.equal(worker.calls.buckets.length, 0);
});

test("claim/client errors do not leak details or reach Storage", async () => {
  for (const options of [
    { claimError: { message: "private SQL details" } },
    { throwClaim: true },
    { throwClient: true },
  ]) {
    const worker = harness(options);
    assert.deepEqual(await worker.run(), { status: 502, counts: EMPTY_COUNTS });
    assert.equal(worker.calls.buckets.length, 0);
    assert.equal(worker.calls.info.length, 0);
    assert.equal(worker.calls.remove.length, 0);
  }
});

test("the entire malformed or excessive batch is rejected before any Storage access", async () => {
  const tooMany = Array.from({ length: 21 }, (_, index) =>
    claim(
      `${(index + 1).toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    ),
  );
  for (const claims of [
    null,
    {},
    [CLAIM, { ...SECOND_CLAIM, object_path: `${OWNER}/legacy.jpg` }],
    [CLAIM, { ...SECOND_CLAIM, storage_object_id: null }],
    [
      CLAIM,
      { ...SECOND_CLAIM, canonical_url: "https://another-project/image" },
    ],
    [CLAIM, { ...SECOND_CLAIM, lease_expires_at: "not-a-timestamp" }],
    [CLAIM, CLAIM],
    tooMany,
  ]) {
    const worker = harness({ claims });
    assert.deepEqual(await worker.run(), { status: 502, counts: EMPTY_COUNTS });
    assert.equal(worker.calls.buckets.length, 0);
    assert.equal(worker.calls.info.length, 0);
    assert.equal(worker.calls.remove.length, 0);
    assert.equal(worker.calls.acknowledgements.length, 0);
  }
});

test("expired or insufficient leases do not initiate Storage calls or stale acks", async () => {
  for (const remaining of [-1, 0, 1_000, 6_000]) {
    const worker = harness({
      claims: [
        { ...CLAIM, lease_expires_at: new Date(NOW + remaining).toISOString() },
      ],
    });
    assert.deepEqual(await worker.run(), {
      status: 502,
      counts: { claimed: 1, deleted: 0, failed: 1 },
    });
    assert.equal(worker.calls.buckets.length, 0);
    assert.equal(worker.calls.info.length, 0);
    assert.equal(worker.calls.acknowledgements.length, 0);
  }
});

test("the total budget includes claim RPC time and leaves remaining claims unconfirmed without Storage or fake acks", async () => {
  let clock = NOW;
  const claims = Array.from({ length: 20 }, (_, index) =>
    claim(
      `${(index + 1).toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    ),
  );
  const worker = harness({
    claims,
    now: () => clock,
    afterClaim() {
      clock += cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS;
    },
    info(_path, occurrence) {
      clock += cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS;
      return occurrence === 1 ? objectInfo(claims[0]) : absent();
    },
    remove() {
      clock += cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS;
      return { data: [], error: null };
    },
    acknowledge(parameters) {
      clock += cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS;
      return {
        data: [
          {
            asset_id: parameters.p_asset_id,
            state: "deleted",
            retry_after: null,
          },
        ],
        error: null,
      };
    },
  });
  assert.deepEqual(await worker.run(), {
    status: 502,
    counts: { claimed: 20, deleted: 1, failed: 19 },
  });
  assert.equal(clock - NOW, 5 * cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS);
  assert.ok(clock - NOW < cleanup.IMAGE_CLEANUP_EXECUTION_BUDGET_MS);
  assert.deepEqual(worker.calls.buckets, [claims[0].bucket_id]);
  assert.deepEqual(worker.calls.info, [
    claims[0].object_path,
    claims[0].object_path,
  ]);
  assert.deepEqual(worker.calls.remove, [[claims[0].object_path]]);
  assert.deepEqual(worker.calls.acknowledgements, [
    {
      p_asset_id: claims[0].asset_id,
      p_lease_token: claims[0].lease_token,
      p_deleted: true,
      p_error: null,
    },
  ]);
});

test("claim RPC elapsed time cannot reset the deadline or start objects without four-call room", async () => {
  const lastStart =
    cleanup.IMAGE_CLEANUP_EXECUTION_BUDGET_MS -
    4 * cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS -
    1_000;
  for (const elapsed of [
    lastStart,
    lastStart + 1,
    cleanup.IMAGE_CLEANUP_EXECUTION_BUDGET_MS,
  ]) {
    let clock = NOW;
    const worker = harness({
      claims: [CLAIM, SECOND_CLAIM],
      now: () => clock,
      afterClaim() {
        clock += elapsed;
      },
    });
    assert.deepEqual(await worker.run(), {
      status: 502,
      counts: { claimed: 2, deleted: 0, failed: 2 },
    });
    assert.equal(worker.calls.rpc.length, 1);
    assert.equal(worker.calls.buckets.length, 0);
    assert.equal(worker.calls.info.length, 0);
    assert.equal(worker.calls.remove.length, 0);
    assert.equal(worker.calls.acknowledgements.length, 0);
  }
});

test("budget exhaustion between operations stops Storage and both success/failure acknowledgements", async () => {
  for (const stage of ["info", "remove", "confirmation", "info-error"]) {
    let clock = NOW;
    const worker = harness({
      claims: [CLAIM, SECOND_CLAIM],
      now: () => clock,
      info(_path, occurrence) {
        if (stage === "info" || stage === "info-error") {
          clock = NOW + cleanup.IMAGE_CLEANUP_EXECUTION_BUDGET_MS;
          return stage === "info-error"
            ? { data: null, error: new Error("private info failure") }
            : objectInfo();
        }
        if (occurrence === 1) return objectInfo();
        clock = NOW + cleanup.IMAGE_CLEANUP_EXECUTION_BUDGET_MS;
        return absent();
      },
      remove() {
        if (stage === "remove") {
          clock = NOW + cleanup.IMAGE_CLEANUP_EXECUTION_BUDGET_MS;
        }
        return { data: [], error: null };
      },
    });
    assert.deepEqual(await worker.run(), {
      status: 502,
      counts: { claimed: 2, deleted: 0, failed: 2 },
    });
    assert.deepEqual(worker.calls.buckets, [CLAIM.bucket_id]);
    assert.deepEqual(
      worker.calls.info,
      stage === "confirmation"
        ? [CLAIM.object_path, CLAIM.object_path]
        : [CLAIM.object_path],
    );
    assert.deepEqual(
      worker.calls.remove,
      stage === "remove" || stage === "confirmation"
        ? [[CLAIM.object_path]]
        : [],
    );
    assert.equal(worker.calls.acknowledgements.length, 0);
    assert.equal(worker.calls.rpc.length, 1);
  }
});

test("an expired lease after info prevents removal and after removal prevents successful ack", async () => {
  let clock = NOW;
  const beforeRemoval = harness({
    now: () => clock,
    info() {
      clock = NOW + 300_001;
      return objectInfo();
    },
  });
  assert.equal((await beforeRemoval.run()).counts.failed, 1);
  assert.equal(beforeRemoval.calls.remove.length, 0);
  assert.equal(beforeRemoval.calls.acknowledgements.length, 0);

  clock = NOW;
  const afterRemoval = harness({
    now: () => clock,
    remove() {
      clock = NOW + 300_001;
      return { data: [], error: null };
    },
  });
  assert.equal((await afterRemoval.run()).counts.deleted, 0);
  assert.equal(afterRemoval.calls.info.length, 1);
  assert.equal(afterRemoval.calls.acknowledgements.length, 0);

  clock = NOW;
  const afterConfirmation = harness({
    now: () => clock,
    info(_path, occurrence) {
      if (occurrence === 1) return objectInfo();
      clock = NOW + 300_001;
      return absent();
    },
  });
  assert.equal((await afterConfirmation.run()).counts.deleted, 0);
  assert.equal(afterConfirmation.calls.acknowledgements.length, 0);
});

test("unknown or mismatched authoritative identity never reaches removal", async () => {
  const validData = objectInfo().data as Record<string, unknown>;
  for (const data of [
    null,
    undefined,
    {},
    [],
    { ...validData, id: SECOND_ASSET },
    { ...validData, id: undefined },
    { ...validData, name: SECOND_CLAIM.object_path },
    { ...validData, bucketId: "profile-images" },
    { ...validData, isDeleteMarker: true },
    { ...validData, isDeleteMarker: undefined },
    { ...validData, isDeleteMarker: null },
    { ...validData, isDeleteMarker: "false" },
    { ...validData, isVersioned: true },
    { ...validData, isVersioned: undefined },
    { ...validData, isVersioned: null },
    { ...validData, isVersioned: "false" },
    { ...validData, archivedAt: new Date(NOW).toISOString() },
    { ...validData, archivedAt: undefined },
    { ...validData, archivedAt: false },
    { metadata: validData },
  ]) {
    const worker = harness({ info: () => ({ data, error: null }) });
    assert.equal((await worker.run()).counts.failed, 1);
    assert.equal(worker.calls.remove.length, 0);
    assert.deepEqual(worker.calls.acknowledgements, [
      {
        p_asset_id: ASSET,
        p_lease_token: TOKEN,
        p_deleted: false,
        p_error: "storage_identity_unconfirmed",
      },
    ]);
  }
});

test("permission, network, timeout and generic info errors never prove object absence", async () => {
  for (const error of [
    new StorageApiError("private", 401, "401", "storage", "InvalidJWT"),
    new StorageApiError("private", 403, "403", "storage", "AccessDenied"),
    new StorageApiError("private", 404, "404", "storage", "NoSuchBucket"),
    new StorageApiError("private", 404, "404", "storage", "not_found"),
    new StorageApiError("private", 404, "404"),
    new StorageApiError("private", 400, "404"),
    new StorageApiError("private", 400, "404", "storage", "not_found"),
    new StorageApiError("private", 400, "400", "storage", "NoSuchKey"),
    new StorageApiError("private", 400, "NoSuchKey", "storage", "NoSuchKey"),
    new StorageApiError("private", 403, "404", "storage", "NoSuchKey"),
    new StorageApiError("private", 500, "500", "storage", "InternalError"),
    new Error("private network error"),
    new DOMException("private timeout", "TimeoutError"),
    {
      name: "StorageApiError",
      status: 404,
      statusCode: "404",
      code: "NoSuchKey",
    },
  ]) {
    const worker = harness({ info: () => ({ data: null, error }) });
    assert.equal((await worker.run()).counts.deleted, 0);
    assert.equal(worker.calls.remove.length, 0);
    assert.equal(worker.calls.acknowledgements[0].p_deleted, false);
    assert.equal(
      worker.calls.acknowledgements[0].p_error,
      "storage_identity_unconfirmed",
    );
  }
  for (const error of [
    new Error("private"),
    new DOMException("private", "TimeoutError"),
  ]) {
    const worker = harness({
      info() {
        throw error;
      },
    });
    assert.equal((await worker.run()).counts.failed, 1);
    assert.equal(worker.calls.remove.length, 0);
    assert.equal(
      worker.calls.acknowledgements[0].p_error,
      "storage_info_failed",
    );
  }
});

test("remove failure or unknown result preserves failure even if a request could have committed", async () => {
  for (const result of [
    { data: null, error: new Error("private removal failure") },
    { data: [], error: new DOMException("private timeout", "TimeoutError") },
    { data: null, error: null },
    { data: {}, error: null },
    absent(),
  ]) {
    const worker = harness({ remove: () => result });
    assert.equal((await worker.run()).counts.failed, 1);
    assert.deepEqual(worker.calls.remove, [[CLAIM.object_path]]);
    assert.equal(worker.calls.info.length, 1);
    assert.equal(worker.calls.acknowledgements[0].p_deleted, false);
    assert.equal(
      worker.calls.acknowledgements[0].p_error,
      "storage_remove_failed",
    );
  }
  const worker = harness({
    remove() {
      throw new Error("private request committed but response was lost");
    },
  });
  assert.equal((await worker.run()).counts.deleted, 0);
  assert.equal(worker.calls.acknowledgements[0].p_deleted, false);
});

test("a remove response alone is insufficient; confirmed absence is required", async () => {
  for (const after of [
    objectInfo(),
    objectInfo(SECOND_CLAIM),
    { data: null, error: null },
    { data: null, error: new StorageApiError("private", 403, "403") },
    { data: null, error: new DOMException("private", "TimeoutError") },
    { data: null, error: new StorageApiError("private", 404, "404") },
  ]) {
    const worker = harness({
      info: (_path, occurrence) => (occurrence === 1 ? objectInfo() : after),
    });
    assert.equal((await worker.run()).counts.deleted, 0);
    assert.deepEqual(worker.calls.info, [CLAIM.object_path, CLAIM.object_path]);
    assert.equal(worker.calls.acknowledgements[0].p_deleted, false);
    assert.equal(
      worker.calls.acknowledgements[0].p_error,
      "storage_absence_unconfirmed",
    );
  }
});

test("remove markers, archived versions and missing flags never become physical deletion even with subsequent NoSuchKey", async () => {
  const removedObject = {
    id: CLAIM.storage_object_id,
    name: CLAIM.object_path,
    version: "unversioned-backend-identifier",
    archived_at: null,
    is_delete_marker: false,
    is_versioned: false,
  };
  for (const object of [
    { ...removedObject, is_delete_marker: true },
    { ...removedObject, is_delete_marker: undefined },
    { ...removedObject, is_delete_marker: null },
    { ...removedObject, is_versioned: true },
    { ...removedObject, is_versioned: undefined },
    { ...removedObject, is_versioned: null },
    { ...removedObject, archived_at: new Date(NOW).toISOString() },
    { ...removedObject, archived_at: undefined },
    { ...removedObject, id: SECOND_ASSET },
    { ...removedObject, name: SECOND_CLAIM.object_path },
    {},
    null,
    [],
  ]) {
    const worker = harness({
      info: (_path, occurrence) => (occurrence === 1 ? objectInfo() : absent()),
      remove: () => ({ data: [object], error: null }),
    });
    assert.deepEqual(await worker.run(), {
      status: 502,
      counts: { claimed: 1, deleted: 0, failed: 1 },
    });
    assert.deepEqual(worker.calls.remove, [[CLAIM.object_path]]);
    assert.equal(worker.calls.info.length, 1);
    assert.deepEqual(worker.calls.acknowledgements, [
      {
        p_asset_id: ASSET,
        p_lease_token: TOKEN,
        p_deleted: false,
        p_error: "storage_remove_failed",
      },
    ]);
  }
  const worker = harness({
    info: (_path, occurrence) => (occurrence === 1 ? objectInfo() : absent()),
    remove: () => ({ data: [removedObject], error: null }),
  });
  assert.equal((await worker.run()).counts.deleted, 1);
});

test("NoSuchKey cannot report deletion when SQL rejects hidden version metadata", async () => {
  for (const alreadyAbsent of [true, false]) {
    const worker = harness({
      info: (_path, occurrence) =>
        alreadyAbsent || occurrence > 1 ? absent() : objectInfo(),
      acknowledge(parameters) {
        assert.equal(parameters.p_deleted, true);
        return {
          data: null,
          error: {
            message:
              "Storage archived/versioned/delete-marker metadata prevents deletion acknowledgement",
          },
        };
      },
    });
    assert.deepEqual(await worker.run(), {
      status: 502,
      counts: { claimed: 1, deleted: 0, failed: 1 },
    });
    assert.equal(worker.calls.remove.length, alreadyAbsent ? 0 : 1);
    assert.equal(worker.calls.acknowledgements.length, 1);
  }
});

test("confirmed deletion uses only the claim's exact bucket/path and successful parsed ack", async () => {
  const worker = harness();
  assert.deepEqual(await worker.run(), {
    status: 200,
    counts: { claimed: 1, deleted: 1, failed: 0 },
  });
  assert.deepEqual(worker.calls.buckets, ["review-images"]);
  assert.deepEqual(worker.calls.info, [CLAIM.object_path, CLAIM.object_path]);
  assert.deepEqual(worker.calls.remove, [[CLAIM.object_path]]);
  assert.deepEqual(worker.calls.acknowledgements, [
    {
      p_asset_id: ASSET,
      p_lease_token: TOKEN,
      p_deleted: true,
      p_error: null,
    },
  ]);
});

test("profile-image claims use their own exact bucket, never the review-image bucket", async () => {
  const profileClaim: ManagedImageDeletionClaim = {
    ...CLAIM,
    bucket_id: "profile-images",
    canonical_url: CLAIM.canonical_url.replace(
      "review-images",
      "profile-images",
    ),
  };
  const worker = harness({
    claims: [profileClaim],
    info: (_path, occurrence) =>
      occurrence === 1 ? objectInfo(profileClaim) : absent(),
  });
  assert.equal((await worker.run()).counts.deleted, 1);
  assert.deepEqual(worker.calls.buckets, ["profile-images"]);
  assert.deepEqual(worker.calls.remove, [[profileClaim.object_path]]);
});

test("NoSuchKey with a positive guarded SQL acknowledgement needs no remove", async () => {
  for (const statusCode of ["404", "NoSuchKey"]) {
    const worker = harness({
      info: () => ({
        data: null,
        error: new StorageApiError(
          "private",
          404,
          statusCode,
          "storage",
          "NoSuchKey",
        ),
      }),
    });
    assert.deepEqual(await worker.run(), {
      status: 200,
      counts: { claimed: 1, deleted: 1, failed: 0 },
    });
    assert.equal(worker.calls.info.length, 1);
    assert.equal(worker.calls.remove.length, 0);
    assert.equal(worker.calls.acknowledgements[0].p_deleted, true);
  }
  const conflicting = harness({
    info: () => ({ data: objectInfo().data, error: absent().error }),
  });
  assert.equal((await conflicting.run()).counts.failed, 1);
  assert.equal(conflicting.calls.remove.length, 0);
});

test("the observed HTTP 400/provider 404 NoSuchKey envelope requires guarded SQL acknowledgement", async () => {
  const observedAbsent = () => ({
    data: null,
    error: new StorageApiError("private", 400, "404", "storage", "NoSuchKey"),
  });
  const alreadyAbsent = harness({ info: observedAbsent });
  assert.deepEqual(await alreadyAbsent.run(), {
    status: 200,
    counts: { claimed: 1, deleted: 1, failed: 0 },
  });
  assert.equal(alreadyAbsent.calls.remove.length, 0);
  assert.equal(alreadyAbsent.calls.acknowledgements[0].p_deleted, true);

  const afterRemoval = harness({
    info: (_path, occurrence) =>
      occurrence === 1 ? objectInfo() : observedAbsent(),
  });
  assert.deepEqual(await afterRemoval.run(), {
    status: 200,
    counts: { claimed: 1, deleted: 1, failed: 0 },
  });
  assert.deepEqual(afterRemoval.calls.remove, [[CLAIM.object_path]]);
  assert.equal(afterRemoval.calls.acknowledgements[0].p_deleted, true);
});

test("stale, malformed or unknown successful-deletion acknowledgement is a failure", async () => {
  for (const acknowledge of [
    () => ({
      data: null,
      error: { message: "stale or expired private lease" },
    }),
    () => ({ data: [], error: null }),
    () => ({
      data: [{ asset_id: SECOND_ASSET, state: "deleted", retry_after: null }],
      error: null,
    }),
    () => ({
      data: [
        {
          asset_id: ASSET,
          state: "deleting",
          retry_after: new Date(NOW).toISOString(),
        },
      ],
      error: null,
    }),
    () => {
      throw new Error("private ack response was lost");
    },
  ]) {
    const worker = harness({ acknowledge });
    assert.deepEqual(await worker.run(), {
      status: 502,
      counts: { claimed: 1, deleted: 0, failed: 1 },
    });
    assert.equal(worker.calls.remove.length, 1);
    assert.equal(worker.calls.acknowledgements.length, 1);
    assert.equal(worker.calls.acknowledgements[0].p_deleted, true);
  }
});

test("failed retry acknowledgement never converts an unsuccessful deletion to success", async () => {
  for (const acknowledge of [
    () => ({ data: null, error: new Error("private stale lease") }),
    () => ({
      data: [{ asset_id: ASSET, state: "deleted", retry_after: null }],
      error: null,
    }),
    () => {
      throw new Error("private ack network error");
    },
  ]) {
    const worker = harness({
      info: () => ({ data: null, error: null }),
      acknowledge,
    });
    assert.equal((await worker.run()).counts.failed, 1);
    assert.equal(worker.calls.remove.length, 0);
    assert.equal(worker.calls.acknowledgements[0].p_deleted, false);
  }
});

test("partial batches report independent ack-confirmed successes and failures only", async () => {
  const worker = harness({
    claims: [CLAIM, SECOND_CLAIM],
    info(path, occurrence) {
      if (path === SECOND_CLAIM.object_path) {
        return {
          data: null,
          error: new StorageApiError("private", 403, "403"),
        };
      }
      return occurrence === 1 ? objectInfo() : absent();
    },
  });
  assert.deepEqual(await worker.run(), {
    status: 502,
    counts: { claimed: 2, deleted: 1, failed: 1 },
  });
  assert.deepEqual(worker.calls.remove, [[CLAIM.object_path]]);
  assert.equal(worker.calls.acknowledgements.length, 2);
  assert.equal(
    worker.calls.acknowledgements.find((ack) => ack.p_asset_id === ASSET)
      ?.p_deleted,
    true,
  );
  assert.equal(
    worker.calls.acknowledgements.find((ack) => ack.p_asset_id === SECOND_ASSET)
      ?.p_deleted,
    false,
  );
});

test("all twenty valid claims are processed without enlarging the requested limit", async () => {
  const claims = Array.from({ length: 20 }, (_, index) =>
    claim(
      `${(index + 1).toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    ),
  );
  const worker = harness({ claims, info: absent });
  assert.deepEqual(await worker.run(), {
    status: 200,
    counts: { claimed: 20, deleted: 20, failed: 0 },
  });
  assert.equal(worker.calls.info.length, 20);
  assert.equal(worker.calls.remove.length, 0);
  assert.equal(worker.calls.acknowledgements.length, 20);
});

test("network wrapper bounds time, preserves cancellation, rejects foreign origins and redirects", async () => {
  const observed: RequestInit[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    observed.push(init ?? {});
    return new Response("{}", { status: 200 });
  };
  const bounded = cleanup.createImageCleanupFetch(fetcher);
  await bounded(`${MANAGED_IMAGE_PROJECT_ORIGIN}/rest/v1/rpc/test`);
  assert.ok(observed[0].signal instanceof AbortSignal);
  assert.equal(observed[0].redirect, "error");
  assert.equal(observed[0].cache, "no-store");
  const cancelled = new AbortController();
  cancelled.abort();
  await bounded(
    new Request(`${MANAGED_IMAGE_PROJECT_ORIGIN}/storage/v1/object/info/test`, {
      signal: cancelled.signal,
    }),
  );
  assert.equal(observed[1].signal?.aborted, true);
  for (const url of [
    "https://other-project.supabase.co/rest/v1/rpc/test",
    `${MANAGED_IMAGE_PROJECT_ORIGIN.replace("https://", "https://user@")}/rest/v1/rpc/test`,
    MANAGED_IMAGE_PROJECT_ORIGIN.replace("https:", "http:"),
  ]) {
    await assert.rejects(bounded(url), /cleanup_origin_rejected/);
  }
  assert.equal(observed.length, 2);
});

test("the network deadline aborts an unresponsive fetch without waiting or making live calls", async (context) => {
  const deadlines: number[] = [];
  context.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    deadlines.push(milliseconds);
    return AbortSignal.abort(
      new DOMException("private timeout", "TimeoutError"),
    );
  });
  const blocked: typeof fetch = async (_input, init) => {
    assert.ok(init?.signal);
    init.signal.throwIfAborted();
    throw new Error("Expected the configured timeout to abort this request");
  };
  await assert.rejects(
    cleanup.createImageCleanupFetch(blocked)(
      `${MANAGED_IMAGE_PROJECT_ORIGIN}/rest/v1/rpc/test`,
    ),
    (error: unknown) =>
      error instanceof DOMException && error.name === "TimeoutError",
  );
  assert.deepEqual(deadlines, [cleanup.IMAGE_CLEANUP_NETWORK_TIMEOUT_MS]);
});

const routeCode = ts.transpileModule(
  readFileSync("app/api/internal/images/cleanup/route.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

function loadRoute(
  options: Options = {},
  environment: cleanup.ImageCleanupEnvironment = ENVIRONMENT,
) {
  const worker = harness(options);
  const exported = {} as {
    GET(input: NextRequest): Promise<NextResponse>;
    POST(input: NextRequest): Promise<NextResponse>;
    dynamic: string;
  };
  const logs: unknown[][] = [];
  const imported: string[] = [];
  runInNewContext(routeCode, {
    exports: exported,
    process: { env: environment },
    console: {
      log: (...values: unknown[]) => logs.push(values),
      warn: (...values: unknown[]) => logs.push(values),
      error: (...values: unknown[]) => logs.push(values),
    },
    require(name: string) {
      imported.push(name);
      if (name === "server-only") return {};
      if (name === "@supabase/supabase-js") {
        return { createClient: worker.dependencies.createClient };
      }
      if (name === "next/server") return { NextResponse };
      if (name === "@/lib/image-cleanup") {
        return {
          handleImageCleanupRequest(
            input: Request,
            environment: cleanup.ImageCleanupEnvironment,
            dependencies: cleanup.ImageCleanupDependencies,
          ) {
            return cleanup.handleImageCleanupRequest(input, environment, {
              ...dependencies,
              now: () => NOW,
              fetch: worker.dependencies.fetch,
            });
          },
        };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { route: exported, worker, logs, imported };
}

test("the actual Next GET and POST routes are dynamic, server-only and counts-only without cookies or secret logs", async () => {
  for (const method of ["GET", "POST"] as const) {
    const { route, worker, logs, imported } = loadRoute({
      claims: [],
      claimError: {
        message: `${SERVICE_KEY} private SQL ${CLAIM.canonical_url}`,
      },
    });
    assert.ok(imported.includes("server-only"));
    assert.equal(route.dynamic, "force-dynamic");
    const unauthorized = await route[method](
      request(null, ENDPOINT, undefined, method),
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await unauthorized.json(), EMPTY_COUNTS);
    assert.equal(worker.calls.clients.length, 0);
    const response = await route[method](
      request(`Bearer ${SECRET}`, ENDPOINT, undefined, method),
    );
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), EMPTY_COUNTS);
    assert.deepEqual(logs, []);
    assert.equal(worker.calls.clients[0].key, SERVICE_KEY);
    assert.equal(
      imported.some(
        (name) =>
          name.includes("supabase/server") || name.includes("next/headers"),
      ),
      false,
    );
  }
});

test("the actual Vercel cron GET route deletes only the exact database claim and acknowledges it", async () => {
  const { route, worker, logs } = loadRoute();
  const response = await route.GET(
    request(`Bearer ${SECRET}`, ENDPOINT, undefined, "GET"),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    claimed: 1,
    deleted: 1,
    failed: 0,
  });
  assert.deepEqual(worker.calls.rpc, [
    { name: MANAGED_IMAGE_RPC.claim, parameters: { p_limit: 20 } },
    {
      name: MANAGED_IMAGE_RPC.acknowledge,
      parameters: {
        p_asset_id: CLAIM.asset_id,
        p_lease_token: CLAIM.lease_token,
        p_deleted: true,
        p_error: null,
      },
    },
  ]);
  assert.deepEqual(worker.calls.buckets, [CLAIM.bucket_id]);
  assert.deepEqual(worker.calls.remove, [[CLAIM.object_path]]);
  assert.deepEqual(worker.calls.info, [CLAIM.object_path, CLAIM.object_path]);
  assert.deepEqual(logs, []);
});

test("the actual GET and POST routes fail closed when CRON_SECRET is not configured", async () => {
  for (const method of ["GET", "POST"] as const) {
    const { route, worker } = loadRoute(
      {},
      { ...ENVIRONMENT, CRON_SECRET: undefined },
    );
    const response = await route[method](
      request("Bearer undefined", ENDPOINT, undefined, method),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), EMPTY_COUNTS);
    assert.equal(worker.calls.clients.length, 0);
    assert.equal(worker.calls.rpc.length, 0);
  }
});

test("Vercel schedules only one daily Hobby-compatible cleanup invocation", () => {
  assert.deepEqual(JSON.parse(readFileSync("vercel.json", "utf8")), {
    crons: [{ path: "/api/internal/images/cleanup", schedule: "0 3 * * *" }],
  });
});
