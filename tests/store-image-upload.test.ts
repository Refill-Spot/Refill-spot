import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as imageUtils from "../lib/image-utils";

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const BUCKET = "custom-store-images";
const BUCKET_URL = `https://example.supabase.co/storage/v1/object/public/${BUCKET}`;
const UPLOADED_URL = `${BUCKET_URL}/42/${FILE_ID}.jpg`;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.from("RIFF1234WEBP");
const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
};
const routeCode = ts.transpileModule(
  readFileSync("app/api/stores/[id]/upload/route.ts", "utf8"),
  { compilerOptions },
).outputText;

type RouteOptions = {
  user?: { id: string } | null;
  authError?: unknown;
  store?: { id: number } | null;
  storeError?: unknown;
  uploadData?: { path: string } | null;
  uploadError?: unknown;
  throwAt?: "client" | "auth" | "store" | "upload" | "url";
};
type Handler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<NextResponse>;

// Execute the real route with real multipart/image validation and isolated
// identity, DB and Storage mocks. No credentials, network or live writes exist.
function loadRoute(options: RouteOptions = {}) {
  const calls = {
    clients: 0,
    auth: 0,
    queries: [] as {
      table: string;
      selection?: string;
      filters: [string, unknown][];
    }[],
    buckets: [] as string[],
    uploads: [] as { path: string; file: File; options: unknown }[],
    urls: [] as string[],
    removed: [] as string[][],
    events: [] as string[],
  };
  const failAt = (stage: RouteOptions["throwAt"]) => {
    if (options.throwAt === stage) throw new Error(`private ${stage} details`);
  };
  const supabase = {
    auth: {
      getUser: async () => {
        calls.auth++;
        failAt("auth");
        return {
          data: {
            user:
              options.user === undefined
                ? { id: "regular-user" }
                : options.user,
          },
          error: options.authError ?? null,
        };
      },
    },
    from(table: string) {
      assert.equal(table, "stores");
      const query = {
        table,
        selection: "",
        filters: [] as [string, unknown][],
      };
      calls.queries.push(query);
      const builder = {
        select(selection: string) {
          query.selection = selection;
          return builder;
        },
        eq(column: string, value: unknown) {
          query.filters.push([column, value]);
          return builder;
        },
        async maybeSingle() {
          calls.events.push("store");
          failAt("store");
          return {
            data: options.store === undefined ? { id: 42 } : options.store,
            error: options.storeError ?? null,
          };
        },
      };
      return builder;
    },
    storage: {
      from(bucket: string) {
        calls.buckets.push(bucket);
        return {
          async upload(path: string, file: File, uploadOptions: unknown) {
            calls.events.push("upload");
            calls.uploads.push({
              path,
              file,
              options: structuredClone(uploadOptions),
            });
            failAt("upload");
            return {
              data:
                options.uploadData === undefined
                  ? { path }
                  : options.uploadData,
              error: options.uploadError ?? null,
            };
          },
          getPublicUrl(path: string) {
            calls.urls.push(path);
            failAt("url");
            return { data: { publicUrl: `${BUCKET_URL}/${path}` } };
          },
          async remove(paths: string[]) {
            calls.removed.push([...paths]);
            throw new Error("Destructive cleanup is forbidden");
          },
        };
      },
    },
  };
  const exported = {} as { POST: Handler };
  runInNewContext(routeCode, {
    exports: exported,
    process: { env: { SUPABASE_STORAGE_BUCKET_STORE_IMAGES: BUCKET } },
    console: { error() {} },
    require(name: string) {
      if (name === "@/lib/image-utils") return imageUtils;
      if (name === "next/server") return { NextResponse };
      if (name === "uuid") return { v4: () => FILE_ID };
      if (name === "@/lib/supabase/server")
        return {
          createServerSupabaseClient: async () => {
            calls.clients++;
            failAt("client");
            return supabase;
          },
        };
      throw new Error(`Unexpected route dependency: ${name}`);
    },
  });
  return {
    calls,
    async invoke(request = imageRequest(), id = "42") {
      const response = await exported.POST(request, {
        params: Promise.resolve({ id }),
      });
      return { response, body: await response.json() };
    },
  };
}

function multipart(formData: FormData) {
  return new NextRequest("https://refill.example/api/stores/42/upload", {
    method: "POST",
    body: formData,
  });
}

function imageRequest(bytes = JPEG, type = "image/jpeg", name = "store.jpg") {
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type }), name);
  return multipart(formData);
}

function noUpload(calls: ReturnType<typeof loadRoute>["calls"]) {
  assert.deepEqual(calls.uploads, []);
  assert.deepEqual(calls.urls, []);
  assert.deepEqual(calls.buckets, []);
  assert.deepEqual(calls.removed, []);
}

test("store image route rejects noncanonical and unsafe IDs before authentication or body reads", async () => {
  for (const id of [
    "",
    "0",
    "-1",
    "01",
    "1.5",
    "1e3",
    "0x10",
    " 42",
    "42 ",
    "42junk",
    "../42",
    "42/../1",
    "NaN",
    "Infinity",
    "9007199254740992",
  ]) {
    const route = loadRoute();
    const request = imageRequest();
    assert.equal((await route.invoke(request, id)).response.status, 400, id);
    assert.equal(route.calls.clients, 0, id);
    assert.equal(request.bodyUsed, false, id);
    noUpload(route.calls);
  }
});

test("positive safe-integer IDs address the exact numeric store before upload; regular users remain allowed", async () => {
  for (const id of ["1", "42", String(Number.MAX_SAFE_INTEGER)]) {
    const route = loadRoute();
    const { response, body } = await route.invoke(imageRequest(), id);
    assert.equal(response.status, 200);
    assert.deepEqual(route.calls.queries, [
      { table: "stores", selection: "id", filters: [["id", Number(id)]] },
    ]);
    assert.deepEqual(route.calls.events, ["store", "upload"]);
    assert.equal(body.url, `${BUCKET_URL}/${id}/${FILE_ID}.jpg`);
    assert.deepEqual(route.calls.removed, []);
  }
});

test("missing users and auth errors with a returned user cannot upload or query stores", async () => {
  for (const options of [
    { user: null },
    { authError: { message: "private auth details" } },
  ]) {
    const route = loadRoute(options);
    const request = imageRequest();
    const { response, body } = await route.invoke(request);
    assert.equal(response.status, 401);
    assert.equal(JSON.stringify(body).includes("private"), false);
    assert.equal(request.bodyUsed, false);
    assert.deepEqual(route.calls.queries, []);
    noUpload(route.calls);
  }
});

test("store image uploads require bounded, well-formed multipart requests", async () => {
  for (const request of [
    new NextRequest("https://refill.example/upload", {
      method: "POST",
      body: "not multipart",
    }),
    new NextRequest("https://refill.example/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
    }),
    new NextRequest("https://refill.example/upload", {
      method: "POST",
      body: "missing boundary",
      headers: { "content-type": "multipart/form-data" },
    }),
    new NextRequest("https://refill.example/upload", {
      method: "POST",
      body: "broken",
      headers: { "content-type": "multipart/form-data; boundary=test" },
    }),
  ]) {
    const route = loadRoute();
    assert.equal((await route.invoke(request)).response.status, 400);
    noUpload(route.calls);
  }
  const declared = imageRequest();
  declared.headers.set(
    "content-length",
    String(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 64 * 1024 + 1),
  );
  const encoded = imageRequest(
    Buffer.alloc(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 64 * 1024 + 1),
  );
  const streamed = new NextRequest(encoded.url, {
    method: "POST",
    headers: encoded.headers,
    body: await encoded.arrayBuffer(),
  });
  for (const request of [declared, streamed]) {
    const route = loadRoute();
    assert.equal((await route.invoke(request)).response.status, 413);
    noUpload(route.calls);
  }
  assert.equal(declared.bodyUsed, false);
});

test("exactly one binary file field is required, not duplicates, missing files or strings", async () => {
  const empty = new FormData();
  const string = new FormData();
  string.append("file", "store.jpg");
  const duplicate = new FormData();
  for (let index = 0; index < 2; index++)
    duplicate.append(
      "file",
      new Blob([JPEG], { type: "image/jpeg" }),
      "store.jpg",
    );
  for (const formData of [empty, string, duplicate]) {
    const route = loadRoute();
    assert.equal(
      (await route.invoke(multipart(formData))).response.status,
      400,
    );
    assert.deepEqual(route.calls.queries, []);
    noUpload(route.calls);
  }
});

test("invalid sizes, unsupported types and forged image signatures never reach Storage", async () => {
  for (const [bytes, type] of [
    [Buffer.alloc(0), "image/jpeg"],
    [Buffer.alloc(imageUtils.MAX_IMAGE_UPLOAD_BYTES + 1), "image/jpeg"],
    [JPEG, "image/svg+xml"],
    [JPEG, "image/gif"],
    [JPEG, "text/html"],
    [JPEG, "application/octet-stream"],
    [JPEG, ""],
    [PNG, "image/jpeg"],
    [JPEG, "image/png"],
    [Buffer.from("RIFF1234WAVE"), "image/webp"],
    [JPEG.subarray(0, 2), "image/jpeg"],
  ] as const) {
    const route = loadRoute();
    assert.equal(
      (await route.invoke(imageRequest(bytes, type))).response.status,
      400,
      type,
    );
    assert.deepEqual(route.calls.queries, []);
    noUpload(route.calls);
  }
});

test("validated MIME types determine generated extensions, never the supplied filename", async () => {
  for (const [bytes, type, mime, extension] of [
    [JPEG, "image/jpeg", "image/jpeg", "jpg"],
    [JPEG, "image/jpg", "image/jpeg", "jpg"],
    [PNG, "image/png", "image/png", "png"],
    [WEBP, "image/webp", "image/webp", "webp"],
  ] as const) {
    const route = loadRoute();
    const { response, body } = await route.invoke(
      imageRequest(bytes, type, "../../store.svg?path=other/file"),
    );
    assert.equal(response.status, 200);
    assert.equal(route.calls.uploads.length, 1);
    const upload = route.calls.uploads[0];
    assert.equal(upload.path, `42/${FILE_ID}.${extension}`);
    assert.deepEqual(upload.options, {
      cacheControl: "3600",
      upsert: false,
      contentType: mime,
    });
    assert.deepEqual(Buffer.from(await upload.file.arrayBuffer()), bytes);
    assert.ok(route.calls.buckets.every((bucket) => bucket === BUCKET));
    assert.deepEqual(route.calls.urls, [upload.path]);
    assert.equal(body.url, `${BUCKET_URL}/${upload.path}`);
  }
});

test("an exact 5 MiB image is accepted without rejecting multipart framing overhead", async () => {
  const bytes = Buffer.alloc(imageUtils.MAX_IMAGE_UPLOAD_BYTES);
  JPEG.copy(bytes);
  const route = loadRoute();
  assert.equal((await route.invoke(imageRequest(bytes))).response.status, 200);
  assert.equal(
    route.calls.uploads[0].file.size,
    imageUtils.MAX_IMAGE_UPLOAD_BYTES,
  );
});

test("missing targets and failed target lookups cannot upload", async () => {
  for (const [options, status] of [
    [{ store: null }, 404],
    [{ storeError: { message: "private database details" } }, 500],
  ] as const) {
    const route = loadRoute(options);
    const { response, body } = await route.invoke();
    assert.equal(response.status, status);
    assert.equal(JSON.stringify(body).includes("private"), false);
    noUpload(route.calls);
  }
});

test("failed uploads and missing upload results never claim success or expose backend errors", async () => {
  for (const options of [
    { uploadError: { message: "private Storage policy details" } },
    { uploadData: null },
  ]) {
    const route = loadRoute(options);
    const { response, body } = await route.invoke();
    assert.equal(response.status, 500);
    assert.equal(typeof body.error, "string");
    assert.equal(Object.hasOwn(body, "url"), false);
    assert.equal(JSON.stringify(body).includes("private"), false);
    assert.deepEqual(route.calls.urls, []);
    assert.deepEqual(route.calls.removed, []);
  }
});

test("unexpected dependency failures are sanitized and never initiate destructive cleanup", async () => {
  for (const throwAt of ["client", "auth", "store", "upload", "url"] as const) {
    const route = loadRoute({ throwAt });
    const { response, body } = await route.invoke();
    assert.equal(response.status, 500, throwAt);
    assert.equal(typeof body.error, "string");
    assert.equal(Object.hasOwn(body, "url"), false);
    assert.equal(JSON.stringify(body).includes("private"), false);
    assert.deepEqual(route.calls.removed, []);
  }
});

// Extract and execute the production UI handler, rather than a test copy of its
// behavior. React rendering and unrelated store-details actions are out of scope.
const uiSource = ts.createSourceFile(
  "components/store-details.tsx",
  readFileSync("components/store-details.tsx", "utf8"),
  ts.ScriptTarget.ES2022,
  true,
  ts.ScriptKind.TSX,
);
let uploadInitializer: ts.Expression | undefined;
function findUploadHandler(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "handleImageUpload"
  ) {
    uploadInitializer = node.initializer;
  }
  ts.forEachChild(node, findUploadHandler);
}
findUploadHandler(uiSource);
assert.ok(
  uploadInitializer,
  "The production store image upload handler must exist",
);
const uiCode = ts.transpileModule(
  `export const handleImageUpload = ${uploadInitializer.getText(uiSource)};`,
  { compilerOptions },
).outputText;

type UiOptions = {
  images?: string[];
  noStore?: boolean;
  uploading?: boolean;
  responseStatus?: number;
  responseBody?: unknown;
  updateError?: unknown;
  updateData?: { id: number } | null;
  throwAt?: "fetch" | "json" | "update";
};
function loadUi(options: UiOptions = {}) {
  const calls = {
    uploads: [] as { url: string; file: FormDataEntryValue | null }[],
    updates: [] as { image_urls: string[] }[],
    refreshed: [] as number[],
    toasts: [] as { title: string; description: string; variant?: string }[],
    uploading: [] as boolean[],
    removed: [] as string[][],
    events: [] as string[],
  };
  const failAt = (stage: UiOptions["throwAt"]) => {
    if (options.throwAt === stage) throw new Error(`private ${stage} details`);
  };
  const builder = {
    update(value: { image_urls: string[] }) {
      calls.events.push("update");
      calls.updates.push(structuredClone(value));
      return builder;
    },
    eq(column: string, value: number) {
      assert.equal(column, "id");
      assert.equal(value, 42);
      return builder;
    },
    select(columns: string) {
      assert.equal(columns, "id");
      return builder;
    },
    async maybeSingle() {
      failAt("update");
      return {
        data:
          options.updateData === undefined ? { id: 42 } : options.updateData,
        error: options.updateError ?? null,
      };
    },
  };
  const exported = {} as {
    handleImageUpload: (event: {
      target: { files: File[] | null; value: string };
    }) => Promise<void>;
  };
  const globals: Record<string, unknown> = {
    exports: exported,
    FormData,
    currentStore: options.noStore
      ? null
      : { id: 42, imageUrls: options.images },
    uploading: options.uploading ?? false,
    setUploading(value: boolean) {
      calls.uploading.push(value);
      globals.uploading = value;
    },
    toast(value: (typeof calls.toasts)[number]) {
      calls.toasts.push(structuredClone(value));
      calls.events.push("toast");
    },
    fetchStoreById(id: number) {
      calls.refreshed.push(id);
      calls.events.push("refresh");
    },
    async fetch(url: string, request: { method: string; body: FormData }) {
      assert.equal(request.method, "POST");
      calls.events.push("upload");
      calls.uploads.push({ url, file: request.body.get("file") });
      failAt("fetch");
      const status = options.responseStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        async json() {
          failAt("json");
          return options.responseBody === undefined
            ? { url: UPLOADED_URL }
            : options.responseBody;
        },
      };
    },
    supabaseBrowser: {
      from(table: string) {
        assert.equal(table, "stores");
        return builder;
      },
      storage: {
        from() {
          return {
            async remove(paths: string[]) {
              calls.removed.push([...paths]);
              throw new Error("Destructive cleanup is forbidden");
            },
          };
        },
      },
    },
  };
  runInNewContext(uiCode, globals);
  const input = {
    files: [new File([JPEG], "store.jpg", { type: "image/jpeg" })] as
      File[] | null,
    value: "store.jpg",
  };
  return {
    calls,
    input,
    invoke: () => exported.handleImageUpload({ target: input }),
  };
}

function assertUiFailure(ui: ReturnType<typeof loadUi>) {
  assert.equal(ui.calls.toasts.length, 1);
  assert.equal(ui.calls.toasts[0].variant, "destructive");
  assert.equal(
    ui.calls.toasts.some((toast) => toast.title === "업로드 성공"),
    false,
  );
  assert.deepEqual(ui.calls.refreshed, []);
  assert.deepEqual(ui.calls.removed, []);
  assert.deepEqual(ui.calls.uploading, [true, false]);
  assert.equal(ui.input.value, "");
}

test("UI blocks a fourth image before issuing an upload request, including stores already above the limit", async () => {
  for (const count of [3, 4]) {
    const ui = loadUi({
      images: Array.from(
        { length: count },
        (_, index) => `existing-${index}.jpg`,
      ),
    });
    await ui.invoke();
    assert.deepEqual(ui.calls.uploads, []);
    assert.deepEqual(ui.calls.updates, []);
    assert.deepEqual(ui.calls.refreshed, []);
    assert.deepEqual(ui.calls.uploading, []);
    assert.equal(ui.calls.toasts[0].variant, "destructive");
    assert.match(ui.calls.toasts[0].description, /최대 3장/);
    assert.equal(ui.input.value, "");
  }
});

test("UI appends the uploaded URL without truncation and reports success only after a returned DB row", async () => {
  for (const images of [
    undefined,
    [],
    ["first.jpg"],
    ["first.jpg", "second.jpg"],
  ]) {
    const ui = loadUi({ images });
    await ui.invoke();
    assert.equal(ui.calls.uploads[0].url, "/api/stores/42/upload");
    assert.deepEqual(
      Buffer.from(await (ui.calls.uploads[0].file as File).arrayBuffer()),
      JPEG,
    );
    assert.deepEqual(ui.calls.updates, [
      { image_urls: [...(images ?? []), UPLOADED_URL] },
    ]);
    assert.deepEqual(ui.calls.refreshed, [42]);
    assert.deepEqual(ui.calls.events, ["upload", "update", "refresh", "toast"]);
    assert.equal(ui.calls.toasts[0].title, "업로드 성공");
    assert.deepEqual(ui.calls.uploading, [true, false]);
    assert.equal(ui.input.value, "");
  }
});

test("UI persistence errors, zero updated rows and rejected updates retain the upload and report failure explicitly", async () => {
  for (const options of [
    { updateError: { message: "private DB policy details" } },
    { updateData: null },
    { throwAt: "update" as const },
  ]) {
    const ui = loadUi({ images: ["prior.jpg"], ...options });
    await ui.invoke();
    assert.equal(ui.calls.uploads.length, 1);
    assert.deepEqual(ui.calls.updates, [
      { image_urls: ["prior.jpg", UPLOADED_URL] },
    ]);
    assertUiFailure(ui);
    assert.match(
      ui.calls.toasts[0].description,
      /매장 사진 저장을 확인하지 못했습니다/,
    );
    assert.match(
      ui.calls.toasts[0].description,
      /연결되지 않은 업로드 파일은 저장소에 남아 있습니다/,
    );
    assert.equal(ui.calls.toasts[0].description.includes("private"), false);
  }
});

test("UI failed uploads, invalid URL responses and transport errors never update stores or fake success", async () => {
  for (const options of [
    {
      responseStatus: 500,
      responseBody: { error: "이미지 업로드에 실패했습니다." },
    },
    { responseStatus: 401, responseBody: { error: "로그인이 필요합니다." } },
    { responseBody: {} },
    { responseBody: { url: "" } },
    { responseBody: { url: 42 } },
    { responseBody: null },
    { throwAt: "fetch" as const },
    { throwAt: "json" as const },
  ]) {
    const ui = loadUi(options);
    await ui.invoke();
    assert.deepEqual(ui.calls.updates, []);
    assertUiFailure(ui);
    assert.equal(
      ui.calls.toasts[0].description.includes("저장소에 남아"),
      false,
    );
    assert.equal(ui.calls.toasts[0].description.includes("private"), false);
  }
});

test("UI ignores empty selections, missing stores and attempts during an active upload", async () => {
  for (const options of [{ noStore: true }, { uploading: true }]) {
    const ui = loadUi(options);
    await ui.invoke();
    assert.deepEqual(ui.calls.events, []);
    assert.deepEqual(ui.calls.uploading, []);
  }
  for (const files of [null, []]) {
    const ui = loadUi();
    ui.input.files = files;
    await ui.invoke();
    assert.deepEqual(ui.calls.events, []);
    assert.deepEqual(ui.calls.uploading, []);
  }
});
