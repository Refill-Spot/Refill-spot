import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as imageUtils from "../lib/image-utils";
import * as managedImageUpload from "../lib/managed-image-upload";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OLD_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";
const BUCKET = "profile-images";
const BUCKET_URL = `https://ykztepbfcocxmtotrdbk.supabase.co/storage/v1/object/public/${BUCKET}`;
const OLD_PATH = `${USER_ID}/${OLD_ID}.jpg`;
const NEW_PATH = `${USER_ID}/managed-${FILE_ID}.jpg`;
const OLD_URL = `${BUCKET_URL}/${OLD_PATH}`;
const NEW_URL = `${BUCKET_URL}/${NEW_PATH}`;
const OTHER_URL = `${BUCKET_URL}/${USER_ID}/${OLD_ID}.png`;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const NOT_NEEDED = { status: "not_needed", count: 0 };
const DEFERRED = {
  status: "deferred",
  count: 1,
  reason: "cleanup_unconfirmed",
};
const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
};
const routeCode = ts.transpileModule(
  readFileSync("app/api/profile/avatar/route.ts", "utf8"),
  { compilerOptions },
).outputText;

type Method = "POST" | "DELETE";
type Query = {
  table: string;
  operation: "select" | "update";
  selection?: string;
  values?: { avatar_url: string | null };
  filters: ["eq" | "is", string, unknown][];
};
type ProfileState = { exists: boolean; avatarUrl: string | null };
type RouteOptions = {
  user?: { id: string } | null;
  authError?: unknown;
  avatarUrl?: string | null;
  noProfile?: boolean;
  profileError?: unknown;
  uploadData?: { path: string } | null;
  uploadError?: unknown;
  updateError?: unknown;
  noUpdatedRow?: boolean;
  throwAt?:
    | "client"
    | "auth"
    | "lookup"
    | "bucketUrl"
    | "upload"
    | "finalize"
    | "update";
  commitUploadThenThrow?: boolean;
  commitUpdateThenFail?: "throw" | "error";
  beforeUpdate?: (state: ProfileState) => void;
  afterUpdate?: (state: ProfileState) => void;
};
type Handler = (request: NextRequest) => Promise<NextResponse>;

// Run the actual route and bounded multipart/image validation. DB identity,
// references and Storage are isolated in-memory mocks, never live data writes.
function loadRoute(options: RouteOptions = {}) {
  const state: ProfileState = {
    exists: !options.noProfile,
    avatarUrl: options.avatarUrl === undefined ? OLD_URL : options.avatarUrl,
  };
  const objects = new Set([OLD_PATH]);
  const calls = {
    clients: 0,
    auth: 0,
    queries: [] as Query[],
    buckets: [] as string[],
    urls: [] as string[],
    uploads: [] as { path: string; file: File; options: unknown }[],
    removed: [] as string[][],
    errors: [] as unknown[][],
  };
  const failAt = (stage: RouteOptions["throwAt"]) => {
    if (options.throwAt === stage) throw new Error(`private ${stage} details`);
  };
  const supabase = {
    async rpc(name: string, args: Record<string, string>) {
      const row = {
        asset_id: FILE_ID,
        bucket_id: BUCKET,
        object_path: NEW_PATH,
        canonical_url: NEW_URL,
      };
      if (name === "reserve_managed_image") {
        assert.deepEqual(args, { p_bucket_id: BUCKET, p_extension: "jpg" });
        return { data: [{ ...row, state: "uploading" }], error: null };
      }
      assert.equal(name, "finalize_managed_image");
      assert.equal(args.p_asset_id, FILE_ID);
      failAt("finalize");
      return {
        data: [{ ...row, state: "ready", storage_object_id: FILE_ID }],
        error: null,
      };
    },
    auth: {
      async getUser() {
        calls.auth++;
        failAt("auth");
        return {
          data: {
            user: options.user === undefined ? { id: USER_ID } : options.user,
          },
          error: options.authError ?? null,
        };
      },
    },
    from(table: string) {
      assert.equal(table, "profiles");
      const query: Query = { table, operation: "select", filters: [] };
      calls.queries.push(query);
      const builder = {
        select(selection: string) {
          query.selection = selection;
          return builder;
        },
        update(values: { avatar_url: string | null }) {
          query.operation = "update";
          query.values = structuredClone(values);
          return builder;
        },
        eq(column: string, value: unknown) {
          query.filters.push(["eq", column, value]);
          return builder;
        },
        is(column: string, value: unknown) {
          query.filters.push(["is", column, value]);
          return builder;
        },
        async maybeSingle() {
          if (query.operation === "select") {
            failAt("lookup");
            return {
              data: state.exists ? { avatar_url: state.avatarUrl } : null,
              error: options.profileError ?? null,
            };
          }
          options.beforeUpdate?.(state);
          failAt("update");
          if (options.updateError) {
            return { data: null, error: options.updateError };
          }
          const matches =
            state.exists &&
            !options.noUpdatedRow &&
            query.filters.every(([, column, value]) =>
              column === "id"
                ? value === USER_ID
                : column === "avatar_url" && value === state.avatarUrl,
            );
          if (matches) state.avatarUrl = query.values!.avatar_url;
          if (options.commitUpdateThenFail === "throw") {
            throw new Error("private response lost after DB commit");
          }
          if (options.commitUpdateThenFail === "error") {
            return {
              data: null,
              error: { message: "private DB commit status unknown" },
            };
          }
          options.afterUpdate?.(state);
          return { data: matches ? { id: USER_ID } : null, error: null };
        },
      };
      return builder;
    },
    storage: {
      from(bucket: string) {
        calls.buckets.push(bucket);
        return {
          getPublicUrl(path: string) {
            calls.urls.push(path);
            failAt("bucketUrl");
            return { data: { publicUrl: `${BUCKET_URL}/${path}` } };
          },
          async upload(path: string, file: File, uploadOptions: unknown) {
            calls.uploads.push({
              path,
              file,
              options: structuredClone(uploadOptions),
            });
            if (options.commitUploadThenThrow) {
              objects.add(path);
              throw new Error("private response lost after Storage commit");
            }
            failAt("upload");
            const data =
              options.uploadData === undefined ? { path } : options.uploadData;
            const error = options.uploadError ?? null;
            if (!error && data) objects.add(path);
            return { data, error };
          },
          async remove(paths: string[]) {
            calls.removed.push([...paths]);
            throw new Error("Unsafe Storage deletion must never be attempted");
          },
        };
      },
    },
  };
  const exported = {} as Record<Method, Handler>;
  runInNewContext(routeCode, {
    exports: exported,
    process: { env: { SUPABASE_STORAGE_BUCKET_PROFILE_IMAGES: BUCKET } },
    console: { error: (...args: unknown[]) => calls.errors.push(args) },
    require(name: string) {
      if (name === "@/lib/image-utils") return imageUtils;
      if (name === "@/lib/managed-image-upload") return managedImageUpload;
      if (name === "next/server") return { NextResponse };
      if (name === "@/lib/supabase/server") {
        return {
          createServerSupabaseClient: async () => {
            calls.clients++;
            failAt("client");
            return supabase;
          },
        };
      }
      throw new Error(`Unexpected route dependency: ${name}`);
    },
  });
  return {
    calls,
    state,
    objects,
    async invoke(method: Method = "POST", request?: NextRequest) {
      const response = await exported[method](
        request ??
          (method === "POST"
            ? imageRequest()
            : new NextRequest("https://refill.example/api/profile/avatar", {
                method,
              })),
      );
      return { response, body: await response.json() };
    },
  };
}

function multipart(formData: FormData) {
  return new NextRequest("https://refill.example/api/profile/avatar", {
    method: "POST",
    body: formData,
  });
}

function imageRequest(bytes = JPEG, type = "image/jpeg", name = "avatar.jpg") {
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type }), name);
  return multipart(formData);
}

function assertFailure(body: Record<string, unknown>) {
  assert.equal(typeof body.error, "string");
  assert.equal(Object.hasOwn(body, "url"), false);
  assert.equal(Object.hasOwn(body, "success"), false);
  assert.equal(JSON.stringify(body).includes("private"), false);
}

function assertCas(route: ReturnType<typeof loadRoute>, old: string | null) {
  assert.deepEqual(route.calls.queries, [
    {
      table: "profiles",
      operation: "select",
      selection: "avatar_url",
      filters: [["eq", "id", USER_ID]],
    },
    {
      table: "profiles",
      operation: "update",
      selection: "id",
      values: { avatar_url: route.state.avatarUrl },
      filters: [
        ["eq", "id", USER_ID],
        [old === null ? "is" : "eq", "avatar_url", old],
      ],
    },
  ]);
}

for (const method of ["POST", "DELETE"] as const) {
  test(`${method} authentication and profile lookup failures never mutate references or remove files`, async () => {
    for (const [options, status] of [
      [{ user: null }, 401],
      [{ authError: { message: "private auth details" } }, 401],
      [{ noProfile: true }, 404],
      [{ profileError: { message: "private DB details" } }, 500],
      [{ throwAt: "client" }, 500],
      [{ throwAt: "auth" }, 500],
      [{ throwAt: "lookup" }, 500],
      [{ throwAt: "bucketUrl" }, 500],
    ] as [RouteOptions, number][]) {
      const route = loadRoute(options);
      const { response, body } = await route.invoke(method);
      assert.equal(response.status, status);
      assertFailure(body);
      assert.deepEqual(body.imageCleanup, NOT_NEEDED);
      assert.equal(
        route.calls.queries.some((query) => query.operation === "update"),
        false,
      );
      assert.deepEqual(route.calls.uploads, []);
      assert.deepEqual(route.calls.removed, []);
      assert.equal(route.state.avatarUrl, OLD_URL);
    }
  });

  test(`${method} unknown mutation responses never claim that a file is detached, including committed changes`, async () => {
    for (const options of [
      { updateError: { message: "private database details" } },
      { throwAt: "update" },
      { commitUpdateThenFail: "throw" },
      { commitUpdateThenFail: "error" },
    ] as RouteOptions[]) {
      const route = loadRoute(options);
      const { response, body } = await route.invoke(method);
      assert.equal(response.status, 500);
      assertFailure(body);
      assert.equal(Object.hasOwn(body, "imageCleanup"), false);
      assert.match(body.error, /상태를 확인하지 못했습니다/);
      assert.match(body.error, /새로고침/);
      assert.equal(body.error.includes("연결되지 않은"), false);
      assert.equal(body.error.includes("삭제는 보류"), false);
      assert.deepEqual(route.calls.removed, []);
      assert.equal(route.objects.has(OLD_PATH), true);
      if (method === "POST") assert.equal(route.objects.has(NEW_PATH), true);
      assert.equal(
        route.state.avatarUrl,
        options.commitUpdateThenFail
          ? method === "POST"
            ? NEW_URL
            : null
          : OLD_URL,
      );
    }
  });

  test(`${method} CAS conflicts preserve the concurrent reference and retain every object`, async () => {
    for (const missing of [false, true]) {
      const route = loadRoute({
        beforeUpdate(state) {
          state.avatarUrl = OTHER_URL;
          if (missing) state.exists = false;
        },
      });
      const { response, body } = await route.invoke(method);
      assert.equal(response.status, 409);
      assertFailure(body);
      assert.deepEqual(
        body.imageCleanup,
        method === "POST" ? DEFERRED : NOT_NEEDED,
      );
      assert.equal(route.state.avatarUrl, OTHER_URL);
      assert.deepEqual(route.calls.removed, []);
      assert.equal(route.objects.has(OLD_PATH), true);
      assert.deepEqual(route.calls.queries[1].filters, [
        ["eq", "id", USER_ID],
        ["eq", "avatar_url", OLD_URL],
      ]);
      if (method === "POST") {
        assert.equal(route.objects.has(NEW_PATH), true);
        assert.match(body.error, /실제 삭제는 보류/);
      }
    }
  });

  test(`${method} reattachment and shared profile, review and store references do not authorize physical removal`, async () => {
    const shared = new Map([
      ["another-profile", OLD_URL],
      ["review", OLD_URL],
      ["store", OLD_URL],
    ]);
    const route = loadRoute({
      afterUpdate(state) {
        // A later request reattaches the old object after this CAS mutation.
        state.avatarUrl = OLD_URL;
      },
    });
    const { response, body } = await route.invoke(method);
    assert.equal(response.status, 200);
    assert.deepEqual(body.imageCleanup, DEFERRED);
    assert.equal(route.state.avatarUrl, OLD_URL);
    assert.equal(route.objects.has(OLD_PATH), true);
    assert.equal(shared.size, 3);
    assert.deepEqual([...shared.values()], [OLD_URL, OLD_URL, OLD_URL]);
    assert.deepEqual(route.calls.removed, []);
    assert.equal(route.calls.queries.length, 2);
    assert.equal(
      route.calls.queries.every((query) => query.table === "profiles"),
      true,
    );
  });
}

test("POST replaces only the avatar reference using CAS and reports owned previous-file cleanup as deferred", async () => {
  const route = loadRoute();
  const { response, body } = await route.invoke();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { url: NEW_URL, imageCleanup: DEFERRED });
  assert.equal(route.state.avatarUrl, NEW_URL);
  assertCas(route, OLD_URL);
  assert.deepEqual(route.calls.buckets, [BUCKET, BUCKET]);
  assert.equal(route.calls.uploads[0].path, NEW_PATH);
  assert.deepEqual(route.calls.uploads[0].options, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  assert.deepEqual(
    Buffer.from(await route.calls.uploads[0].file.arrayBuffer()),
    JPEG,
  );
  assert.equal(route.objects.has(OLD_PATH), true);
  assert.equal(route.objects.has(NEW_PATH), true);
  assert.deepEqual(route.calls.removed, []);
});

test("DELETE detaches only the avatar reference using CAS, without claiming physical deletion", async () => {
  const route = loadRoute();
  const { response, body } = await route.invoke("DELETE");
  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, imageCleanup: DEFERRED });
  assert.equal(route.state.avatarUrl, null);
  assertCas(route, OLD_URL);
  assert.equal(route.objects.has(OLD_PATH), true);
  assert.deepEqual(route.calls.uploads, []);
  assert.deepEqual(route.calls.removed, []);
});

test("successful changes report no cleanup candidate for empty, external, other-owner, legacy and ambiguous URLs", async () => {
  for (const avatarUrl of [
    null,
    "https://external.example/avatar.jpg",
    `${BUCKET_URL}/other-user/${OLD_ID}.jpg`,
    `${BUCKET_URL}/${USER_ID}/avatar.jpg`,
    `${OLD_URL}?download=1`,
    `${OLD_URL}#fragment`,
    `${BUCKET_URL}/${USER_ID}/nested/${OLD_ID}.jpg`,
    OLD_URL.replace(BUCKET, "another-bucket"),
  ]) {
    for (const method of ["POST", "DELETE"] as const) {
      const route = loadRoute({ avatarUrl });
      const { response, body } = await route.invoke(method);
      assert.equal(response.status, 200);
      assert.deepEqual(body.imageCleanup, NOT_NEEDED);
      assertCas(route, avatarUrl);
      assert.deepEqual(route.calls.removed, []);
    }
  }
});

test("POST does not mark a still-attached object as a cleanup candidate", async () => {
  const route = loadRoute({ avatarUrl: NEW_URL });
  const { response, body } = await route.invoke();
  assert.equal(response.status, 200);
  assert.deepEqual(body.imageCleanup, NOT_NEEDED);
  assert.equal(route.state.avatarUrl, NEW_URL);
  assert.deepEqual(route.calls.removed, []);
});

test("POST retains a confirmed upload when finalization fails before mutation", async () => {
  const route = loadRoute({ throwAt: "finalize" });
  const { response, body } = await route.invoke();
  assert.equal(response.status, 500);
  assertFailure(body);
  assert.deepEqual(body.imageCleanup, {
    ...DEFERRED,
    reason: "managed_finalization_unconfirmed",
  });
  assert.match(body.error, /파일 정리는 보류/);
  assert.match(body.error, /저장소 파일은 삭제하지 않았습니다/);
  assert.equal(route.state.avatarUrl, OLD_URL);
  assert.equal(route.objects.has(NEW_PATH), true);
  assert.equal(route.calls.queries.length, 1);
  assert.deepEqual(route.calls.removed, []);
});

test("failed or unacknowledged uploads remain failures without claiming an absent object", async () => {
  for (const options of [
    { uploadError: { message: "private Storage error" } },
    { uploadData: null },
    { throwAt: "upload" },
    { commitUploadThenThrow: true },
  ] as RouteOptions[]) {
    const route = loadRoute(options);
    const { response, body } = await route.invoke();
    assert.equal(response.status, 500);
    assertFailure(body);
    assert.equal(Object.hasOwn(body, "imageCleanup"), false);
    assert.match(body.error, /확인하지 못했습니다/);
    assert.equal(body.error.includes("연결되지 않은"), false);
    assert.equal(route.state.avatarUrl, OLD_URL);
    assert.equal(route.calls.queries.length, 1);
    assert.deepEqual(route.calls.removed, []);
    if (options.commitUploadThenThrow) {
      assert.equal(route.objects.has(NEW_PATH), true);
    }
  }
});

test("POST validates a single bounded image before querying or uploading", async () => {
  const missing = new FormData();
  const duplicate = new FormData();
  duplicate.append("file", new Blob([JPEG], { type: "image/jpeg" }), "one.jpg");
  duplicate.append("file", new Blob([JPEG], { type: "image/jpeg" }), "two.jpg");
  const notFile = new FormData();
  notFile.append("file", "not a file");
  for (const request of [
    multipart(missing),
    multipart(duplicate),
    multipart(notFile),
    imageRequest(Buffer.alloc(0)),
    imageRequest(JPEG, "image/svg+xml", "avatar.svg"),
    imageRequest(Buffer.from("GIF89a")),
    imageRequest(Buffer.alloc(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 1)),
    new NextRequest("https://refill.example/api/profile/avatar", {
      method: "POST",
      body: "not multipart",
      headers: { "content-type": "application/json" },
    }),
  ]) {
    const route = loadRoute();
    const { response, body } = await route.invoke("POST", request);
    assert.equal(response.status, 400);
    assertFailure(body);
    assert.deepEqual(body.imageCleanup, NOT_NEEDED);
    assert.deepEqual(route.calls.queries, []);
    assert.deepEqual(route.calls.uploads, []);
    assert.deepEqual(route.calls.removed, []);
  }
});

test("POST rejects oversized declared and streamed multipart bodies without Storage writes", async () => {
  const declared = imageRequest();
  declared.headers.set(
    "content-length",
    String(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 64 * 1024 + 1),
  );
  const formData = new FormData();
  formData.append(
    "file",
    new Blob(
      [Buffer.alloc(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 64 * 1024 + 1)],
      {
        type: "image/jpeg",
      },
    ),
    "large.jpg",
  );
  const encoded = multipart(formData);
  const streamed = new NextRequest(
    "https://refill.example/api/profile/avatar",
    {
      method: "POST",
      headers: { "content-type": encoded.headers.get("content-type")! },
      body: await encoded.arrayBuffer(),
    },
  );
  for (const request of [declared, streamed]) {
    const route = loadRoute();
    const { response, body } = await route.invoke("POST", request);
    assert.equal(response.status, 413);
    assertFailure(body);
    assert.deepEqual(body.imageCleanup, NOT_NEEDED);
    assert.deepEqual(route.calls.queries, []);
    assert.deepEqual(route.calls.uploads, []);
    assert.deepEqual(route.calls.removed, []);
  }
  assert.equal(declared.bodyUsed, false);
  assert.equal(streamed.body!.locked, false);
});

test("unauthenticated POST never consumes the upload body", async () => {
  const route = loadRoute({ user: null });
  const request = imageRequest();
  const { response } = await route.invoke("POST", request);
  assert.equal(response.status, 401);
  assert.equal(request.bodyUsed, false);
  assert.deepEqual(route.calls.queries, []);
  assert.deepEqual(route.calls.buckets, []);
});

const uiSource = ts.createSourceFile(
  "components/profile-image-upload.tsx",
  readFileSync("components/profile-image-upload.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const uiInitializers = new Map<string, ts.Expression>();
function findUiHandlers(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    ["handleFileSelect", "handleDeleteImage"].includes(node.name.text) &&
    node.initializer
  ) {
    uiInitializers.set(node.name.text, node.initializer);
  }
  ts.forEachChild(node, findUiHandlers);
}
findUiHandlers(uiSource);
assert.equal(uiInitializers.size, 2, "The real avatar UI handlers must exist");
const uiCode = ts.transpileModule(
  [...uiInitializers]
    .map(
      ([name, initializer]) =>
        `export const ${name} = ${initializer.getText(uiSource)};`,
    )
    .join("\n"),
  { compilerOptions },
).outputText;

type UiOptions = {
  avatarUrl?: string | null;
  responseStatus?: number;
  responseBody?: unknown;
  throwAt?: "fetch" | "json";
};
function loadUi(options: UiOptions = {}) {
  const calls = {
    requests: [] as {
      url: string;
      method: Method;
      file?: FormDataEntryValue | null;
    }[],
    toasts: [] as { title: string; description: string; variant?: string }[],
    uploading: [] as boolean[],
    callbacks: [] as string[],
    reloads: 0,
  };
  const failAt = (stage: UiOptions["throwAt"]) => {
    if (options.throwAt === stage) throw new Error(`private ${stage} details`);
  };
  const exported = {} as {
    handleFileSelect: (file: File) => Promise<void>;
    handleDeleteImage: () => Promise<void>;
  };
  runInNewContext(uiCode, {
    exports: exported,
    FormData,
    console: { error() {} },
    profile: {
      avatar_url: options.avatarUrl === undefined ? OLD_URL : options.avatarUrl,
    },
    useCallback: (handler: unknown) => handler,
    setIsUploading: (value: boolean) => calls.uploading.push(value),
    onUploadComplete: (url: string) => calls.callbacks.push(url),
    toast: (value: (typeof calls.toasts)[number]) =>
      calls.toasts.push(structuredClone(value)),
    window: { location: { reload: () => calls.reloads++ } },
    async fetch(url: string, request: { method: Method; body?: FormData }) {
      calls.requests.push({
        url,
        method: request.method,
        ...(request.body ? { file: request.body.get("file") } : {}),
      });
      failAt("fetch");
      const status = options.responseStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        async json() {
          failAt("json");
          return options.responseBody === undefined
            ? request.method === "POST"
              ? { url: NEW_URL, imageCleanup: DEFERRED }
              : { success: true, imageCleanup: DEFERRED }
            : options.responseBody;
        },
      };
    },
  });
  return {
    calls,
    invoke(method: Method = "POST", file?: File) {
      return method === "POST"
        ? exported.handleFileSelect(
            file ?? new File([JPEG], "avatar.jpg", { type: "image/jpeg" }),
          )
        : exported.handleDeleteImage();
    },
  };
}

for (const method of ["POST", "DELETE"] as const) {
  test(`avatar UI ${method} success describes reference mutation and pending physical cleanup`, async () => {
    const ui = loadUi();
    await ui.invoke(method);
    assert.equal(ui.calls.requests[0].url, "/api/profile/avatar");
    assert.equal(ui.calls.requests[0].method, method);
    assert.equal(ui.calls.toasts.length, 1);
    assert.equal(ui.calls.toasts[0].variant, undefined);
    assert.match(ui.calls.toasts[0].description, /연결/);
    assert.match(ui.calls.toasts[0].description, /실제 삭제는 보류 중/);
    assert.equal(
      ui.calls.toasts[0].description.includes("삭제되었습니다"),
      false,
    );
    assert.deepEqual(ui.calls.callbacks, method === "POST" ? [NEW_URL] : []);
    assert.equal(ui.calls.reloads, 1);
    assert.deepEqual(ui.calls.uploading, [true, false]);
  });

  test(`avatar UI ${method} not_needed success does not invent pending physical cleanup`, async () => {
    const ui = loadUi({
      responseBody:
        method === "POST"
          ? { url: NEW_URL, imageCleanup: NOT_NEEDED }
          : { success: true, imageCleanup: NOT_NEEDED },
    });
    await ui.invoke(method);
    assert.equal(ui.calls.toasts[0].variant, undefined);
    assert.match(ui.calls.toasts[0].description, /연결/);
    assert.equal(ui.calls.toasts[0].description.includes("보류"), false);
    assert.equal(
      ui.calls.toasts[0].description.includes("삭제되었습니다"),
      false,
    );
  });

  test(`avatar UI ${method} HTTP errors, invalid acknowledgements and unknown transport failures never show success`, async () => {
    for (const options of [
      {
        responseStatus: 500,
        responseBody: {
          error:
            "프로필 이미지 변경 상태를 확인하지 못했습니다. 새로고침하여 확인해 주세요.",
        },
      },
      {
        responseStatus: 409,
        responseBody: {
          error:
            "다른 요청으로 변경되었습니다. 업로드 파일의 실제 삭제는 보류되었습니다.",
          imageCleanup: method === "POST" ? DEFERRED : NOT_NEEDED,
        },
      },
      { responseStatus: 401, responseBody: { error: "로그인이 필요합니다." } },
      { responseBody: null },
      { responseBody: {} },
      { responseBody: { url: "", success: false } },
      { responseBody: { url: 42, success: "true" } },
      { throwAt: "fetch" },
      { throwAt: "json" },
    ] as UiOptions[]) {
      const ui = loadUi(options);
      await ui.invoke(method);
      assert.equal(ui.calls.toasts.length, 1);
      assert.equal(ui.calls.toasts[0].variant, "destructive");
      assert.equal(
        ui.calls.toasts[0].title,
        method === "POST" ? "업로드 실패" : "삭제 실패",
      );
      assert.equal(ui.calls.toasts[0].description.includes("private"), false);
      if (options.throwAt || !options.responseStatus) {
        assert.match(
          ui.calls.toasts[0].description,
          /상태를 확인하지 못했습니다/,
        );
        assert.match(ui.calls.toasts[0].description, /새로고침/);
      }
      assert.deepEqual(ui.calls.callbacks, []);
      assert.equal(ui.calls.reloads, 0);
      assert.deepEqual(ui.calls.uploading, [true, false]);
    }
  });
}

test("avatar UI rejects unsupported and oversized uploads without a request", async () => {
  for (const file of [
    new File([JPEG], "avatar.svg", { type: "image/svg+xml" }),
    new File(
      [Buffer.alloc(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 1)],
      "large.jpg",
      {
        type: "image/jpeg",
      },
    ),
  ]) {
    const ui = loadUi();
    await ui.invoke("POST", file);
    assert.deepEqual(ui.calls.requests, []);
    assert.deepEqual(ui.calls.uploading, []);
    assert.deepEqual(ui.calls.callbacks, []);
    assert.equal(ui.calls.reloads, 0);
    assert.equal(ui.calls.toasts[0].variant, "destructive");
  }
});

test("avatar UI does not issue DELETE without a current reference", async () => {
  const ui = loadUi({ avatarUrl: null });
  await ui.invoke("DELETE");
  assert.deepEqual(ui.calls.requests, []);
  assert.deepEqual(ui.calls.uploading, []);
  assert.deepEqual(ui.calls.toasts, []);
  assert.equal(ui.calls.reloads, 0);
});
