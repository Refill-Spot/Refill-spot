import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as reviewImages from "../lib/review-images";

const USER_ID = "12345678-1234-4234-9234-123456789abc";
const OTHER_USER_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const BUCKET_URL =
  "https://example.supabase.co/storage/v1/object/public/custom-review-images";
const FILE_A = "11111111-1111-4111-8111-111111111111.jpg";
const FILE_B = "22222222-2222-4222-9222-222222222222.png";
const IMAGE_A = `${BUCKET_URL}/${USER_ID}/${FILE_A}`;
const IMAGE_B = `${BUCKET_URL}/${USER_ID}/${FILE_B}`;
const LEGACY_IMAGE = `${BUCKET_URL}/${USER_ID}/prior-photo.jpeg`;
const OTHER_IMAGE = `${BUCKET_URL}/${OTHER_USER_ID}/${FILE_A}`;
const EXTERNAL_IMAGE = "https://external.example/photo.jpg";
const PAYLOAD = { rating: 4.5, content: "리뷰 내용", imageUrls: [IMAGE_A] };

test("managed image names retain exact owner, bucket and URL boundaries", () => {
  const managed = `${BUCKET_URL}/${USER_ID}/managed-${FILE_A}`;
  assert.equal(
    reviewImages.getOwnedReviewImagePath(managed, USER_ID, BUCKET_URL),
    `${USER_ID}/managed-${FILE_A}`,
  );
  for (const invalid of [
    managed.replace(USER_ID, OTHER_USER_ID),
    managed.replace("managed-", "%6danaged-"),
    `${managed}?download=1`,
    `${managed}#fragment`,
    managed.replace("managed-", "managed-not-a-uuid-"),
    managed.replace(BUCKET_URL, "https://external.example"),
  ]) {
    assert.equal(
      reviewImages.getOwnedReviewImagePath(invalid, USER_ID, BUCKET_URL),
      null,
    );
  }
});

type Method = "POST" | "GET" | "DELETE";
type Review = {
  id: number;
  user_id: string;
  store_id: number;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
  image_urls: string[];
  detailed_ratings?: Record<string, number>;
  profiles: { username: string; avatar_url: string | null } | null;
};
type Query = {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  selection?: string;
  filters: [string, unknown][];
  values?: Record<string, unknown>;
  ordering?: [string, unknown];
  limit?: number;
};
type Result = { data: unknown; error: unknown };
type Handler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<NextResponse>;
type Options = {
  user?: { id: string } | null;
  authError?: unknown;
  throwAuth?: boolean;
  store?: { id: number } | null;
  storeError?: unknown;
  existing?: Review | null;
  existingError?: unknown;
  recent?: { created_at: string }[];
  recentError?: unknown;
  mutationError?: unknown;
  mutationData?: Review | null;
  throwMutation?: boolean;
  profiles?: Review["profiles"];
  getReviews?: Review[];
  getError?: unknown;
  likes?: { review_id: number; user_id: string }[];
  likeError?: unknown;
  imageInfo?: unknown;
  imageInfoError?: unknown;
  throwImageInfo?: boolean;
  beforeMutation?: (query: Query) => void;
};

const REVIEW: Review = {
  id: 12,
  user_id: USER_ID,
  store_id: 42,
  rating: 5,
  content: "원래 리뷰",
  created_at: "2020-01-01T00:00:00.000Z",
  updated_at: "2020-01-02T00:00:00.000Z",
  image_urls: [IMAGE_A],
  profiles: { username: "review author", avatar_url: null },
};
const routePath = "app/api/stores/[id]/reviews/route.ts";
const compiledRoute = ts.transpileModule(
  readFileSync(resolve(routePath), "utf8"),
  {
    fileName: routePath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

// Execute production handlers with mocked request identity, DB and Storage.
// No credentials, network requests, DB writes or Storage writes are involved.
function loadRoute(options: Options = {}) {
  const calls = {
    clientRequests: [] as NextRequest[],
    auth: 0,
    queries: [] as Query[],
    buckets: [] as string[],
    publicUrlPaths: [] as string[],
    imageInfoPaths: [] as string[],
    removed: [] as string[][],
    events: [] as string[],
    errors: [] as unknown[][],
    warnings: [] as unknown[][],
  };
  const existing = options.existing === undefined ? REVIEW : options.existing;
  function result(query: Query, single: boolean): Result {
    calls.events.push(`${query.operation}:${query.table}`);
    if (query.table === "stores") {
      return {
        data: options.store === undefined ? { id: 42 } : options.store,
        error: options.storeError ?? null,
      };
    }
    if (query.table === "review_likes") {
      return { data: options.likes ?? [], error: options.likeError ?? null };
    }
    assert.equal(query.table, "reviews");
    if (query.operation !== "select") {
      options.beforeMutation?.(query);
      if (options.throwMutation) throw new Error("private mutation details");
      let data = options.mutationData;
      if (data === undefined) {
        data = { ...REVIEW, ...query.values } as Review;
        if (options.profiles !== undefined) data.profiles = options.profiles;
      }
      return { data, error: options.mutationError ?? null };
    }
    if (single) {
      return { data: existing, error: options.existingError ?? null };
    }
    if (query.selection === "created_at") {
      return { data: options.recent ?? [], error: options.recentError ?? null };
    }
    return {
      data: options.getReviews ?? [REVIEW],
      error: options.getError ?? null,
    };
  }
  const supabase = {
    auth: {
      getUser: async () => {
        calls.auth += 1;
        if (options.throwAuth) throw new Error("private auth details");
        return {
          data: {
            user: options.user === undefined ? { id: USER_ID } : options.user,
          },
          error: options.authError ?? null,
        };
      },
    },
    from: (table: string) => {
      const query: Query = { table, operation: "select", filters: [] };
      calls.queries.push(query);
      const builder = {
        select: (selection: string) => {
          query.selection = selection;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          query.filters.push([column, value]);
          return builder;
        },
        in: (column: string, value: unknown) => {
          query.filters.push([column, value]);
          return builder;
        },
        order: (column: string, value: unknown) => {
          query.ordering = [column, value];
          return builder;
        },
        limit: (value: number) => {
          query.limit = value;
          return builder;
        },
        update: (values: Record<string, unknown>) => {
          query.operation = "update";
          query.values = structuredClone(values);
          return builder;
        },
        insert: (values: Record<string, unknown>) => {
          query.operation = "insert";
          query.values = structuredClone(values);
          return builder;
        },
        delete: () => {
          query.operation = "delete";
          return builder;
        },
        single: async () => result(query, true),
        maybeSingle: async () => result(query, true),
        then: (
          resolveResult: (value: Result) => unknown,
          rejectResult: (error: unknown) => unknown,
        ) =>
          Promise.resolve()
            .then(() => result(query, false))
            .then(resolveResult, rejectResult),
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => {
        calls.buckets.push(bucket);
        return {
          getPublicUrl: (path: string) => {
            calls.publicUrlPaths.push(path);
            return { data: { publicUrl: `${BUCKET_URL}/${path}` } };
          },
          info: async (path: string) => {
            calls.imageInfoPaths.push(path);
            if (options.throwImageInfo)
              throw new Error("private image lookup details");
            return {
              data:
                options.imageInfo === undefined
                  ? { id: "stored-image-id", name: path, bucketId: bucket }
                  : options.imageInfo,
              error: options.imageInfoError ?? null,
            };
          },
          remove: async (paths: string[]) => {
            calls.removed.push(paths);
            throw new Error("Unsafe storage deletion must never be attempted");
          },
        };
      },
    },
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextRequest, NextResponse },
    "@/lib/review-images": reviewImages,
    "@/lib/supabase/server": {
      createRouteHandlerSupabaseClient: (request: NextRequest) => {
        calls.clientRequests.push(request);
        return supabase;
      },
    },
  };
  const handlers: Partial<Record<Method, Handler>> = {};
  runInNewContext(compiledRoute, {
    exports: handlers,
    console: {
      error: (...args: unknown[]) => calls.errors.push(args),
      warn: (...args: unknown[]) => calls.warnings.push(args),
    },
    require: (specifier: string) => {
      assert.ok(Object.hasOwn(dependencies, specifier), specifier);
      return dependencies[specifier];
    },
  });
  return {
    calls,
    invoke: async (
      method: Method = "POST",
      body: unknown = PAYLOAD,
      id = "42",
      rawBody?: string,
    ) => {
      const request = new NextRequest(
        `https://refill.example/api/stores/${id}/reviews`,
        {
          method,
          ...(method === "POST"
            ? {
                headers: { "content-type": "application/json" },
                body: rawBody ?? JSON.stringify(body),
              }
            : {}),
        },
      );
      const handler = handlers[method];
      assert.ok(handler);
      const response = await handler(request, {
        params: Promise.resolve({ id }),
      });
      return { response, body: await response.json(), request };
    },
  };
}

function assertNoMutation(calls: ReturnType<typeof loadRoute>["calls"]) {
  assert.equal(
    calls.queries.some((query) => query.operation !== "select"),
    false,
  );
  assert.deepEqual(calls.removed, []);
}

test("only literal generated paths in the configured bucket and own directory are authorized", () => {
  for (const extension of ["jpg", "png", "webp"]) {
    const name = FILE_A.replace(/jpg$/, extension);
    const imageUrl = `${BUCKET_URL}/${USER_ID}/${name}`;
    assert.equal(
      reviewImages.getOwnedReviewImagePath(imageUrl, USER_ID, `${BUCKET_URL}/`),
      `${USER_ID}/${name}`,
    );
    assert.equal(
      reviewImages.validateReviewImageUrls([imageUrl], USER_ID, BUCKET_URL)
        .valid,
      true,
    );
  }
  for (const imageUrl of [
    OTHER_IMAGE,
    EXTERNAL_IMAGE,
    IMAGE_A.replace("custom-review-images", "other-bucket"),
    IMAGE_A.replace(
      "example.supabase.co",
      "example.supabase.co.attacker.example",
    ),
    IMAGE_A.replace("https://", "https://user:password@"),
    IMAGE_A.replace("https://", "http://"),
    IMAGE_A.replace(FILE_A, `../${FILE_A}`),
    IMAGE_A.replace(FILE_A, `%2e%2e/${FILE_A}`),
    IMAGE_A.replace(FILE_A, `${OTHER_USER_ID}%2f${FILE_A}`),
    IMAGE_A.replace(FILE_A, `folder\\${FILE_A}`),
    `${IMAGE_A}?download=1`,
    `${IMAGE_A}#image`,
    ` ${IMAGE_A}`,
    IMAGE_A.replace(FILE_A, "11111111-1111-5111-8111-111111111111.jpg"),
    IMAGE_A.replace(FILE_A, "11111111-1111-4111-1111-111111111111.jpg"),
    LEGACY_IMAGE,
    IMAGE_A.replace(".jpg", ".svg"),
    null,
    42,
    {},
  ]) {
    assert.equal(
      reviewImages.getOwnedReviewImagePath(imageUrl, USER_ID, BUCKET_URL),
      null,
      String(imageUrl),
    );
    assert.equal(
      reviewImages.validateReviewImageUrls([imageUrl], USER_ID, BUCKET_URL)
        .valid,
      false,
      String(imageUrl),
    );
  }
  assert.equal(
    reviewImages.getOwnedReviewImagePath(IMAGE_A, "../user", BUCKET_URL),
    null,
  );
  assert.equal(
    reviewImages.getOwnedReviewImagePath(
      IMAGE_A,
      USER_ID,
      "invalid bucket URL",
    ),
    null,
  );
});

test("unchanged prior same-user legacy images survive edits but do not authorize forged URLs", () => {
  assert.deepEqual(
    reviewImages.validateReviewImageUrls(
      [LEGACY_IMAGE, IMAGE_B],
      USER_ID,
      BUCKET_URL,
      [LEGACY_IMAGE],
    ),
    { valid: true, imageUrls: [LEGACY_IMAGE, IMAGE_B] },
  );
  for (const forged of [OTHER_IMAGE, EXTERNAL_IMAGE, `${IMAGE_A}?download=1`]) {
    assert.equal(
      reviewImages.validateReviewImageUrls([forged], USER_ID, BUCKET_URL, [
        forged,
      ]).valid,
      false,
    );
  }
  assert.equal(
    reviewImages.validateReviewImageUrls(
      [LEGACY_IMAGE.replace("prior-photo", "new-photo")],
      USER_ID,
      BUCKET_URL,
      [LEGACY_IMAGE],
    ).valid,
    false,
  );
});

test("image array validation rejects wrong types and excess attachments", () => {
  for (const images of [
    null,
    false,
    IMAGE_A,
    {},
    [null],
    Array(6).fill(IMAGE_A),
  ]) {
    assert.equal(
      reviewImages.validateReviewImageUrls(images, USER_ID, BUCKET_URL).valid,
      false,
    );
  }
  assert.equal(
    reviewImages.validateReviewImageUrls(
      Array(5).fill(IMAGE_A),
      USER_ID,
      BUCKET_URL,
    ).valid,
    true,
  );
});

test("cleanup only accounts for unique owned generated images actually detached", () => {
  assert.deepEqual(
    reviewImages.getReviewImageCleanup(
      [IMAGE_A, IMAGE_B, IMAGE_B, OTHER_IMAGE, EXTERNAL_IMAGE, LEGACY_IMAGE],
      [IMAGE_A],
      USER_ID,
      BUCKET_URL,
    ),
    { status: "deferred", count: 1, reason: "cleanup_unconfirmed" },
  );
  assert.deepEqual(
    reviewImages.getReviewImageCleanup(
      [OTHER_IMAGE, EXTERNAL_IMAGE, LEGACY_IMAGE],
      [],
      USER_ID,
      BUCKET_URL,
    ),
    { status: "not_needed", count: 0 },
  );
  assert.deepEqual(
    reviewImages.getReviewImageCleanup(
      [IMAGE_A],
      [IMAGE_A],
      USER_ID,
      BUCKET_URL,
    ),
    { status: "not_needed", count: 0 },
  );
});

test("all methods reject malformed/nonpositive/unsafe IDs before accessing auth or DB", async () => {
  for (const method of ["POST", "GET", "DELETE"] as const) {
    for (const id of [
      "42oops",
      "4.2",
      "-1",
      "0",
      "01",
      "1e2",
      " 42",
      "9007199254740992",
    ]) {
      const { invoke, calls } = loadRoute();
      const { response } = await invoke(method, PAYLOAD, id);
      assert.equal(response.status, 400, `${method} ${id}`);
      assert.deepEqual(calls.clientRequests, []);
      assert.equal(calls.auth, 0);
      assert.deepEqual(calls.queries, []);
    }
  }
});

test("POST/DELETE require verified request identity before any DB or Storage access", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    for (const options of [
      { user: null },
      { authError: { message: "private auth error" } },
    ]) {
      const { invoke, calls } = loadRoute(options);
      const { response, request } = await invoke(method);
      assert.equal(response.status, 401);
      assert.equal(calls.clientRequests[0], request);
      assert.equal(calls.auth, 1);
      assert.deepEqual(calls.queries, []);
      assert.deepEqual(calls.buckets, []);
    }
  }
});

test("malformed JSON and payload types return 400 rather than throwing or persisting", async () => {
  for (const rawBody of ["{", "", "undefined"]) {
    const { invoke, calls } = loadRoute();
    const { response } = await invoke("POST", PAYLOAD, "42", rawBody);
    assert.equal(response.status, 400);
    assert.deepEqual(calls.queries, []);
    assert.deepEqual(calls.errors, []);
  }
  for (const body of [
    null,
    [],
    "review",
    42,
    false,
    {},
    { ...PAYLOAD, rating: "5" },
    { ...PAYLOAD, rating: true },
    { ...PAYLOAD, rating: 0 },
    { ...PAYLOAD, rating: 5.1 },
    { ...PAYLOAD, rating: null },
    { ...PAYLOAD, content: 42 },
    { ...PAYLOAD, content: "  " },
    { ...PAYLOAD, content: {} },
    { ...PAYLOAD, imageUrls: [42] },
    { ...PAYLOAD, imageUrls: null },
    { ...PAYLOAD, imageUrls: Array(6).fill(IMAGE_A) },
    { ...PAYLOAD, keywords: "keyword" },
    { ...PAYLOAD, atmosphere: [null] },
    { ...PAYLOAD, menus: {} },
    { ...PAYLOAD, detailedRatings: [] },
    { ...PAYLOAD, detailedRatings: null },
    { ...PAYLOAD, detailedRatings: { taste: "5" } },
    { ...PAYLOAD, detailedRatings: { taste: 0 } },
    { ...PAYLOAD, detailedRatings: { taste: 6 } },
  ]) {
    const { invoke, calls } = loadRoute();
    const { response } = await invoke("POST", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(calls.queries, []);
    assertNoMutation(calls);
  }
});

test("forged images are rejected for both create and edit without persistence", async () => {
  for (const existing of [null, REVIEW]) {
    for (const imageUrl of [
      OTHER_IMAGE,
      EXTERNAL_IMAGE,
      LEGACY_IMAGE,
      `${IMAGE_A}?download=1`,
    ]) {
      const { invoke, calls } = loadRoute({ existing });
      const { response } = await invoke("POST", {
        ...PAYLOAD,
        imageUrls: [imageUrl],
      });
      assert.equal(response.status, 400);
      assertNoMutation(calls);
      assert.deepEqual(calls.buckets, [reviewImages.REVIEW_IMAGES_BUCKET]);
      assert.deepEqual(calls.publicUrlPaths, [""]);
      const lookup = calls.queries.find((query) => query.table === "reviews");
      assert.deepEqual(lookup?.filters, [
        ["store_id", 42],
        ["user_id", USER_ID],
      ]);
    }
  }
});

test("editing basic review fields preserves omitted images and metadata", async () => {
  const { invoke, calls } = loadRoute({
    existing: {
      ...REVIEW,
      image_urls: [IMAGE_A],
      detailed_ratings: { taste: 5, price: 3 },
    },
  });
  const { response } = await invoke("POST", {
    rating: 4,
    content: "Changed",
    detailedRatings: { taste: 4 },
  });
  assert.equal(response.status, 200);
  const update = calls.queries.find((query) => query.operation === "update")!;
  assert.deepEqual(update.values?.image_urls, [IMAGE_A]);
  assert.deepEqual(update.values?.detailed_ratings, { taste: 4, price: 3 });
  for (const key of ["keywords", "atmosphere", "menus"]) {
    assert.equal(Object.hasOwn(update.values!, key), false);
  }
});

test("create preserves ratings, details, cooldown checks and the success response", async () => {
  const payload = {
    ...PAYLOAD,
    keywords: ["친절"],
    atmosphere: ["조용함"],
    menus: ["커피"],
    detailedRatings: { taste: 5, price: 1 },
  };
  const { invoke, calls } = loadRoute({ existing: null });
  const { response, body } = await invoke("POST", payload);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "리뷰가 등록되었습니다.");
  assert.equal(body.review.rating, 4.5);
  assert.equal(body.review.user.id, USER_ID);
  assert.equal(Object.hasOwn(body, "imageCleanup"), false);
  const insert = calls.queries.find((query) => query.operation === "insert");
  assert.deepEqual(insert?.values, {
    user_id: USER_ID,
    store_id: 42,
    rating: 4.5,
    content: PAYLOAD.content,
    image_urls: [IMAGE_A],
    keywords: ["친절"],
    atmosphere: ["조용함"],
    detailed_ratings: { taste: 5, price: 1 },
    menus: ["커피"],
  });
  const recent = calls.queries.find(
    (query) => query.selection === "created_at",
  );
  assert.deepEqual(recent?.filters, [["user_id", USER_ID]]);
  assert.equal(recent?.limit, 1);
  assert.deepEqual(calls.removed, []);
});

test("cooldown prevents only new reviews and never deletes uploaded images", async () => {
  const recent = [{ created_at: new Date(Date.now() - 60_000).toISOString() }];
  const create = loadRoute({ existing: null, recent });
  const { response, body } = await create.invoke();
  assert.equal(response.status, 429);
  assert.ok(body.remainingTime > 0 && body.remainingTime <= 10);
  assertNoMutation(create.calls);
  const edit = loadRoute({ recent });
  assert.equal((await edit.invoke()).response.status, 200);
  assert.equal(
    edit.calls.queries.some((query) => query.selection === "created_at"),
    false,
  );
});

test("edits preserve prior attachments and explicitly defer only owned detached images after persistence", async () => {
  const existing = {
    ...REVIEW,
    image_urls: [IMAGE_A, IMAGE_B, LEGACY_IMAGE, OTHER_IMAGE, EXTERNAL_IMAGE],
  };
  const { invoke, calls } = loadRoute({ existing });
  const { response, body } = await invoke("POST", {
    ...PAYLOAD,
    imageUrls: [IMAGE_A, LEGACY_IMAGE],
  });
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "리뷰가 업데이트되었습니다.");
  assert.deepEqual(body.imageCleanup, {
    status: "deferred",
    count: 1,
    reason: "cleanup_unconfirmed",
  });
  const update = calls.queries.find((query) => query.operation === "update");
  assert.deepEqual(update?.filters, [
    ["id", 12],
    ["store_id", 42],
    ["user_id", USER_ID],
    ["updated_at", REVIEW.updated_at],
  ]);
  assert.deepEqual(update?.values?.image_urls, [IMAGE_A, LEGACY_IMAGE]);
  assert.ok(
    Date.parse(String(update?.values?.updated_at)) >
      Date.parse(REVIEW.updated_at),
  );
  assert.deepEqual(calls.events, [
    "select:stores",
    "select:reviews",
    "update:reviews",
  ]);
  assert.deepEqual(calls.removed, []);
});

test("cleanup uses returned persisted attachments, not merely the requested edit", async () => {
  const { invoke, calls } = loadRoute({ mutationData: REVIEW });
  const { response, body } = await invoke("POST", {
    ...PAYLOAD,
    imageUrls: [],
  });
  assert.equal(response.status, 200);
  assert.deepEqual(body.imageCleanup, { status: "not_needed", count: 0 });
  assert.deepEqual(calls.removed, []);
});

test("same-millisecond edits advance the optimistic version even when the prior clock is ahead", async () => {
  const updatedAt = new Date(Date.now() + 60_000).toISOString();
  const { invoke, calls } = loadRoute({
    existing: { ...REVIEW, updated_at: updatedAt },
  });
  assert.equal((await invoke()).response.status, 200);
  const update = calls.queries.find((query) => query.operation === "update");
  assert.equal(
    Date.parse(String(update?.values?.updated_at)),
    Date.parse(updatedAt) + 1,
  );
});

test("RLS denial and concurrent edit/delete returning no rows are conflicts, not success", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    const { invoke, calls } = loadRoute({ mutationData: null });
    const { response, body } = await invoke(method, {
      ...PAYLOAD,
      imageUrls: [],
    });
    assert.equal(response.status, 409);
    assert.equal(Object.hasOwn(body, "success"), false);
    assert.equal(Object.hasOwn(body, "imageCleanup"), false);
    assert.deepEqual(calls.removed, []);
    const mutation = calls.queries.find(
      (query) => query.operation !== "select",
    );
    assert.ok(
      mutation?.filters.some(
        ([column, value]) =>
          column === "updated_at" && value === REVIEW.updated_at,
      ),
    );
    assert.ok(
      mutation?.filters.some(
        ([column, value]) => column === "user_id" && value === USER_ID,
      ),
    );
  }
});

test("successful delete reports deferred cleanup and never removes foreign or shared files", async () => {
  const existing = {
    ...REVIEW,
    image_urls: [
      IMAGE_A,
      IMAGE_A,
      IMAGE_B,
      OTHER_IMAGE,
      EXTERNAL_IMAGE,
      LEGACY_IMAGE,
    ],
  };
  const { invoke, calls } = loadRoute({ existing, mutationData: existing });
  const { response, body } = await invoke("DELETE");
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "리뷰가 삭제되었습니다.");
  assert.deepEqual(body.imageCleanup, {
    status: "deferred",
    count: 2,
    reason: "cleanup_unconfirmed",
  });
  const deletion = calls.queries.find((query) => query.operation === "delete");
  assert.deepEqual(deletion?.filters, [
    ["id", 12],
    ["user_id", USER_ID],
    ["store_id", 42],
    ["updated_at", REVIEW.updated_at],
  ]);
  assert.equal(deletion?.selection, "id, image_urls");
  assert.deepEqual(calls.events, ["select:reviews", "delete:reviews"]);
  assert.deepEqual(calls.removed, []);
});

test("RLS-hidden shared references and concurrent reattachment cannot authorize Storage deletion", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    const sharedReferences = new Set([IMAGE_A]);
    const { invoke, calls } = loadRoute({
      beforeMutation: () => sharedReferences.add(IMAGE_B),
      existing: { ...REVIEW, image_urls: [IMAGE_A, IMAGE_B] },
      ...(method === "DELETE"
        ? { mutationData: { ...REVIEW, image_urls: [IMAGE_A, IMAGE_B] } }
        : {}),
    });
    const { response, body } = await invoke(method, {
      ...PAYLOAD,
      imageUrls: [],
    });
    assert.equal(response.status, 200);
    assert.equal(sharedReferences.size, 2);
    assert.equal(body.imageCleanup.status, "deferred");
    assert.deepEqual(calls.removed, []);
    // No RLS-filtered "absence of references" SELECT is treated as deletion authority.
    assert.equal(
      calls.queries.some((query) =>
        query.filters.some(([column]) => column === "image_urls"),
      ),
      false,
    );
  }
});

test("nonexistent delete remains idempotent with no mutation or cleanup", async () => {
  const { invoke, calls } = loadRoute({ existing: null });
  const { response, body } = await invoke("DELETE");
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(Object.hasOwn(body, "imageCleanup"), false);
  assertNoMutation(calls);
});

test("lookup, cooldown and mutation failures remain generic and never delete images", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    for (const options of [
      { throwAuth: true },
      { existingError: { message: "private lookup details" } },
      { mutationError: { message: "private SQL details", code: "42501" } },
      { throwMutation: true },
    ]) {
      const { invoke, calls } = loadRoute(options);
      const { response, body } = await invoke(method, {
        ...PAYLOAD,
        imageUrls: [],
      });
      assert.equal(response.status, 500);
      assert.equal(Object.hasOwn(body, "success"), false);
      assert.equal(Object.hasOwn(body, "imageCleanup"), false);
      assert.equal(JSON.stringify(body).includes("private"), false);
      assert.deepEqual(calls.removed, []);
      assert.equal(calls.errors.length, 1);
    }
  }
  const { invoke, calls } = loadRoute({
    existing: null,
    recentError: { message: "private recent-query details" },
  });
  assert.equal((await invoke()).response.status, 500);
  assertNoMutation(calls);
});

test("missing stores, insert conflicts and absent returned rows never claim success or cleanup", async () => {
  for (const options of [
    { store: null },
    { storeError: { message: "not found" } },
  ]) {
    const { invoke, calls } = loadRoute(options);
    assert.equal((await invoke()).response.status, 404);
    assertNoMutation(calls);
  }
  for (const options of [
    {
      mutationError: { code: "23505", message: "private unique constraint" },
      expected: 409,
    },
    { mutationData: null, expected: 500 },
    {
      mutationError: { code: "42501", message: "private RLS details" },
      expected: 500,
    },
  ]) {
    const { invoke, calls } = loadRoute({ existing: null, ...options });
    const { response, body } = await invoke();
    assert.equal(response.status, options.expected);
    assert.equal(Object.hasOwn(body, "success"), false);
    assert.equal(Object.hasOwn(body, "imageCleanup"), false);
    assert.deepEqual(calls.removed, []);
  }
});

test("missing profile relations do not turn a successfully persisted review into an API failure", async () => {
  for (const existing of [null, REVIEW]) {
    const { invoke, calls } = loadRoute({ existing, profiles: null });
    const { response, body } = await invoke();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.review.user, {
      id: USER_ID,
      username: "사용자",
      avatar_url: null,
    });
    assert.deepEqual(calls.removed, []);
  }
});

test("GET preserves public reviews, image attachments and user-specific like counts", async () => {
  const { invoke, calls } = loadRoute({
    likes: [
      { review_id: 12, user_id: USER_ID },
      { review_id: 12, user_id: OTHER_USER_ID },
    ],
  });
  const { response, body } = await invoke("GET");
  assert.equal(response.status, 200);
  assert.equal(body.totalReviews, 1);
  assert.deepEqual(body.reviews[0].imageUrls, [IMAGE_A]);
  assert.equal(body.reviews[0].likeCount, 2);
  assert.equal(body.reviews[0].isLikedByUser, true);
  assertNoMutation(calls);
  const anonymous = loadRoute({ user: null });
  const result = await anonymous.invoke("GET");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.reviews[0].isLikedByUser, false);
});

test("new attachments must exist at the exact authenticated Storage path before persistence", async () => {
  const { invoke, calls } = loadRoute({ existing: null });
  const { response } = await invoke("POST", {
    ...PAYLOAD,
    imageUrls: [IMAGE_A, IMAGE_A],
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.imageInfoPaths, [`${USER_ID}/${FILE_A}`]);
  assert.deepEqual(calls.removed, []);
  for (const options of [
    { imageInfo: null },
    { imageInfoError: { message: "private Storage RLS denial" } },
    { throwImageInfo: true },
    { imageInfo: {} },
    {
      imageInfo: {
        id: "id",
        name: `${OTHER_USER_ID}/${FILE_A}`,
        bucketId: reviewImages.REVIEW_IMAGES_BUCKET,
      },
    },
    {
      imageInfo: {
        id: "id",
        name: `${USER_ID}/${FILE_A}`,
        bucketId: "other-bucket",
      },
    },
  ]) {
    const route = loadRoute({ existing: null, ...options });
    const result = await route.invoke();
    assert.equal(result.response.status, 400);
    assert.equal(Object.hasOwn(result.body, "success"), false);
    assert.equal(JSON.stringify(result.body).includes("private"), false);
    assert.deepEqual(route.calls.imageInfoPaths, [`${USER_ID}/${FILE_A}`]);
    assertNoMutation(route.calls);
  }
});

test("available authoritative ownership metadata must match, never custom uploader metadata", async () => {
  const file = {
    id: "id",
    name: `${USER_ID}/${FILE_A}`,
    bucketId: reviewImages.REVIEW_IMAGES_BUCKET,
  };
  for (const key of ["owner", "ownerId", "owner_id"]) {
    for (const owner of [OTHER_USER_ID, null, ""]) {
      const { invoke, calls } = loadRoute({
        existing: null,
        imageInfo: { ...file, [key]: owner, metadata: { ownerId: USER_ID } },
      });
      assert.equal((await invoke()).response.status, 400);
      assertNoMutation(calls);
    }
    const matching = loadRoute({
      existing: null,
      imageInfo: { ...file, [key]: USER_ID },
    });
    assert.equal((await matching.invoke()).response.status, 200);
  }
  // The documented info response omits owner. Exact path + identity + existence
  // are accepted; deployment must separately verify namespace-enforcing RLS.
  const noOwner = loadRoute({
    existing: null,
    imageInfo: { ...file, metadata: { ownerId: OTHER_USER_ID } },
  });
  assert.equal((await noOwner.invoke()).response.status, 200);
});

test("validated unchanged prior attachments do not require metadata or reauthorize external URLs", async () => {
  const existing = { ...REVIEW, image_urls: [IMAGE_A, LEGACY_IMAGE] };
  const { invoke, calls } = loadRoute({ existing, throwImageInfo: true });
  const { response } = await invoke("POST", {
    ...PAYLOAD,
    imageUrls: [IMAGE_A, LEGACY_IMAGE],
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.imageInfoPaths, []);
  const edited = loadRoute({ existing });
  assert.equal(
    (await edited.invoke("POST", { ...PAYLOAD, imageUrls: [IMAGE_A, IMAGE_B] }))
      .response.status,
    200,
  );
  assert.deepEqual(edited.calls.imageInfoPaths, [`${USER_ID}/${FILE_B}`]);
  const forged = loadRoute({
    existing: { ...REVIEW, image_urls: [EXTERNAL_IMAGE] },
  });
  assert.equal(
    (await forged.invoke("POST", { ...PAYLOAD, imageUrls: [EXTERNAL_IMAGE] }))
      .response.status,
    400,
  );
  assert.deepEqual(forged.calls.imageInfoPaths, []);
  assertNoMutation(forged.calls);
});
