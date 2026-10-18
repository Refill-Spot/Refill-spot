import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as managedImageUpload from "../lib/managed-image-upload";
import {
  generateThumbnailUrl,
  getOwnedProfileImagePath,
  MAX_IMAGE_UPLOAD_BYTES,
  readImageUploadFormData,
  validateImageUpload,
} from "../lib/image-utils";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function imageFile(bytes: Buffer, type = "image/jpeg", name = "avatar.jpg") {
  return new File([bytes], name, { type });
}

async function expectInvalid(value: unknown, error: string) {
  assert.deepEqual(await validateImageUpload(value), { valid: false, error });
}

test("image upload requires an actual named binary file", async () => {
  for (const value of [
    null,
    undefined,
    "avatar.jpg",
    {},
    { name: "avatar.jpg", size: 4, type: "image/jpeg" },
    new Blob([jpeg], { type: "image/jpeg" }),
    imageFile(jpeg, "image/jpeg", ""),
  ]) {
    await expectInvalid(value, "invalid_file");
  }
});

test("supported signatures produce canonical MIME types and safe extensions", async () => {
  for (const [type, bytes, contentType, extension] of [
    ["image/jpeg", jpeg, "image/jpeg", "jpg"],
    ["image/jpg", jpeg, "image/jpeg", "jpg"],
    ["image/png", png, "image/png", "png"],
    ["image/webp", webp, "image/webp", "webp"],
  ] as const) {
    const file = imageFile(bytes, type, "../../avatar.svg?path=other/file");
    const result = await validateImageUpload(file);
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.file, file);
      assert.equal(result.contentType, contentType);
      assert.equal(result.extension, extension);
    }
  }
});

test("a filename extension cannot bypass the MIME allowlist", async () => {
  for (const type of [
    "",
    "image/svg+xml",
    "image/gif",
    "text/html",
    "application/octet-stream",
  ]) {
    await expectInvalid(
      imageFile(jpeg, type, "avatar.jpg"),
      "unsupported_type",
    );
  }
});

test("empty images are rejected", async () => {
  await expectInvalid(imageFile(Buffer.alloc(0)), "invalid_size");
});

test("the exact 5 MiB file boundary is allowed, one byte over is rejected", async () => {
  const bytes = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES);
  jpeg.copy(bytes);
  assert.equal((await validateImageUpload(imageFile(bytes))).valid, true);
  await expectInvalid(
    imageFile(Buffer.concat([bytes, Buffer.from([0])])),
    "invalid_size",
  );
});

test("claimed image MIME types must match the file signature", async () => {
  for (const file of [
    imageFile(Buffer.from("<html>not an image</html>")),
    imageFile(png, "image/jpeg"),
    imageFile(jpeg, "image/png"),
    imageFile(png, "image/webp"),
  ]) {
    await expectInvalid(file, "invalid_content");
  }
});

test("truncated signatures and incorrect WebP identifiers are rejected", async () => {
  for (const file of [
    imageFile(jpeg.subarray(0, 2)),
    imageFile(png.subarray(0, 7), "image/png"),
    imageFile(webp.subarray(0, 11), "image/webp"),
    imageFile(Buffer.from("RIFF1234WAVE"), "image/webp"),
  ]) {
    await expectInvalid(file, "invalid_content");
  }
});

test("unreadable file contents are not accepted as successful validation", async () => {
  class UnreadableFile extends File {
    slice(): never {
      throw new Error("Cannot read file");
    }
  }
  await expectInvalid(
    new UnreadableFile([jpeg], "avatar.jpg", { type: "image/jpeg" }),
    "invalid_content",
  );
});

function uploadRequest(formData: FormData) {
  return new Request("http://localhost/upload", {
    method: "POST",
    body: formData,
  });
}

test("multipart parsing preserves avatar and review file fields", async () => {
  for (const [field, maxFiles, count] of [
    ["file", 1, 1],
    ["images", 5, 5],
  ] as const) {
    const formData = new FormData();
    for (let index = 0; index < count; index++) {
      formData.append(
        field,
        new Blob([png], { type: "image/png" }),
        `photo-${index}.png`,
      );
    }
    const result = await readImageUploadFormData(
      uploadRequest(formData),
      maxFiles,
    );
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.formData.getAll(field).length, count);
      for (const file of result.formData.getAll(field)) {
        assert.equal((await validateImageUpload(file)).valid, true);
      }
    }
  }
});

test("a multipart string field is not promoted into an uploaded file", async () => {
  const formData = new FormData();
  formData.append("images", "photo.png");
  const result = await readImageUploadFormData(uploadRequest(formData), 5);
  assert.equal(result.valid, true);
  if (result.valid) {
    await expectInvalid(result.formData.get("images"), "invalid_file");
  }
});

test("non-multipart, missing bodies, missing boundaries, and malformed bodies are rejected", async () => {
  for (const request of [
    new Request("http://localhost/upload", {
      method: "POST",
      body: "not multipart",
    }),
    new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
    }),
    new Request("http://localhost/upload", {
      method: "POST",
      body: "missing boundary",
      headers: { "content-type": "multipart/form-data" },
    }),
    new Request("http://localhost/upload", {
      method: "POST",
      body: "broken body",
      headers: { "content-type": "multipart/form-data; boundary=test" },
    }),
  ]) {
    assert.deepEqual(await readImageUploadFormData(request, 1), {
      valid: false,
      error: "invalid_request",
    });
  }
});

test("consumed or locked upload streams are rejected as malformed requests", async () => {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([jpeg], { type: "image/jpeg" }),
    "photo.jpg",
  );
  const consumed = uploadRequest(formData);
  await consumed.arrayBuffer();
  assert.deepEqual(await readImageUploadFormData(consumed, 1), {
    valid: false,
    error: "invalid_request",
  });

  const locked = uploadRequest(formData);
  const reader = locked.body!.getReader();
  try {
    assert.deepEqual(await readImageUploadFormData(locked, 1), {
      valid: false,
      error: "invalid_request",
    });
  } finally {
    reader.releaseLock();
    await locked.arrayBuffer();
  }
});

test("an interrupted request stream is not treated as a parsed upload", async () => {
  const request = new Request("http://localhost/upload", {
    method: "POST",
    body: "unused",
    headers: { "content-type": "multipart/form-data; boundary=test" },
  });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("Interrupted upload"));
    },
  });
  Object.defineProperty(request, "body", { value: body });
  assert.deepEqual(await readImageUploadFormData(request, 1), {
    valid: false,
    error: "invalid_request",
  });
  assert.equal(body.locked, false);
});

test("malformed and misleading content lengths are rejected", async () => {
  for (const contentLength of [
    "-1",
    "1.5",
    "not-a-number",
    "9007199254740992",
    "1",
  ]) {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([jpeg], { type: "image/jpeg" }),
      "photo.jpg",
    );
    const request = uploadRequest(formData);
    request.headers.set("content-length", contentLength);
    assert.deepEqual(await readImageUploadFormData(request, 1), {
      valid: false,
      error: "invalid_request",
    });
  }
});

test("an honest declared multipart length is accepted", async () => {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([jpeg], { type: "image/jpeg" }),
    "photo.jpg",
  );
  const original = uploadRequest(formData);
  const bytes = await original.arrayBuffer();
  const headers = new Headers(original.headers);
  headers.set("content-length", String(bytes.byteLength));
  const request = new Request(original.url, {
    method: "POST",
    body: bytes,
    headers,
  });
  assert.equal((await readImageUploadFormData(request, 1)).valid, true);
});

test("oversized declared bodies are rejected before consuming the upload stream", async () => {
  for (const maxFiles of [1, 5]) {
    const formData = new FormData();
    formData.append("file", "unused");
    const request = uploadRequest(formData);
    request.headers.set(
      "content-length",
      String(MAX_IMAGE_UPLOAD_BYTES * maxFiles + 64 * 1024 + 1),
    );
    assert.deepEqual(await readImageUploadFormData(request, maxFiles), {
      valid: false,
      error: "body_too_large",
    });
    assert.equal(request.bodyUsed, false);
  }
});

test("streamed multipart bodies are bounded even without a content length", async () => {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 64 * 1024 + 1)], {
      type: "image/jpeg",
    }),
    "photo.jpg",
  );
  // Use received wire bytes: cancelling Node's outgoing FormData encoder can
  // reject after it has closed, unlike an incoming HTTP request body.
  const encoded = uploadRequest(formData);
  const request = new Request("http://localhost/upload", {
    method: "POST",
    headers: { "content-type": encoded.headers.get("content-type")! },
    body: await encoded.arrayBuffer(),
  });
  assert.equal(request.headers.get("content-length"), null);
  assert.deepEqual(await readImageUploadFormData(request, 1), {
    valid: false,
    error: "body_too_large",
  });
  assert.equal(request.body!.locked, false);
});

test("multipart framing overhead does not reject an exact 5 MiB image", async () => {
  const formData = new FormData();
  const bytes = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES);
  jpeg.copy(bytes);
  formData.append(
    "file",
    new Blob([bytes], { type: "image/jpeg" }),
    "photo.jpg",
  );
  const result = await readImageUploadFormData(uploadRequest(formData), 1);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(
      (await validateImageUpload(result.formData.get("file"))).valid,
      true,
    );
  }
});

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const fileId = "33333333-3333-4333-8333-333333333333";
const bucketUrl = "https://project.supabase.co/storage/v1/object/public/image/";

test("only the current user's generated avatar paths can be removed", () => {
  for (const extension of ["jpg", "jpeg", "png", "webp", "JPEG"]) {
    const path = `${userId}/${fileId}.${extension}`;
    assert.equal(
      getOwnedProfileImagePath(`${bucketUrl}${path}`, userId, bucketUrl),
      path,
    );
  }
});

test("external URLs and other owners or buckets cannot authorize deletion", () => {
  const path = `${userId}/${fileId}.jpg`;
  for (const url of [
    null,
    "not a URL",
    `https://external.example/${path}`,
    `https://project.supabase.co.evil.example/storage/v1/object/public/image/${path}`,
    `http://project.supabase.co/storage/v1/object/public/image/${path}`,
    `https://user:password@project.supabase.co/storage/v1/object/public/image/${path}`,
    `https://project.supabase.co/storage/v1/object/public/other/${path}`,
    `https://project.supabase.co/storage/v1/object/sign/image/${path}`,
    `${bucketUrl}${otherUserId}/${fileId}.jpg`,
    `${bucketUrl}${userId}-suffix/${fileId}.jpg`,
  ]) {
    assert.equal(getOwnedProfileImagePath(url, userId, bucketUrl), null);
  }
});

test("avatar deletion rejects arbitrary, nested, encoded, or query-suffixed filenames", () => {
  for (const fileName of [
    "avatar.jpg",
    `${fileId}.svg`,
    `${fileId}.jpg/extra`,
    `nested/${fileId}.jpg`,
    `${fileId}.jpg?download=1`,
    `${fileId}.jpg#fragment`,
    `${fileId}.jpg%2fextra`,
    `${fileId.replace("3", "%33")}.jpg`,
    `../${otherUserId}/${fileId}.jpg`,
  ]) {
    assert.equal(
      getOwnedProfileImagePath(
        `${bucketUrl}${userId}/${fileName}`,
        userId,
        bucketUrl,
      ),
      null,
    );
  }
  assert.equal(
    getOwnedProfileImagePath(
      `${bucketUrl}${userId}/${fileId}.jpg`,
      "../other",
      bucketUrl,
    ),
    null,
  );
  assert.equal(
    getOwnedProfileImagePath(
      `${bucketUrl}${userId}/${fileId}.jpg`,
      userId,
      "invalid",
    ),
    null,
  );
});

test("server-side thumbnails do not initialize a browser client or alter the source URL", () => {
  const originalUrl = `${bucketUrl}${userId}/${fileId}.jpg?download=1`;
  assert.equal(generateThumbnailUrl(originalUrl), originalUrl);
});

test("browser thumbnails preserve Supabase transform URLs without a browser client dependency", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  try {
    assert.equal(
      generateThumbnailUrl(`${bucketUrl}${userId}/${fileId}.jpg?download=1`, {
        width: 80,
        height: 80,
        quality: 75,
      }),
      `https://project.supabase.co/storage/v1/render/image/public/image/${userId}/${fileId}.jpg?width=80&height=80&resize=cover&quality=75`,
    );
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    if (previousUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  }
});

const reviewUploadBucket = "review-images";
const reviewUploadBucketUrl = `https://ykztepbfcocxmtotrdbk.supabase.co/storage/v1/object/public/${reviewUploadBucket}`;
const reviewUploadRouteCode = ts.transpileModule(
  readFileSync("app/api/reviews/images/upload/route.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

type UploadOutcome =
  "success" | "error" | "error_with_data" | "missing_data" | "throw";

// Execute the actual upload route and real multipart/image validation with
// isolated identity and Storage mocks. No network or live writes are involved.
function loadReviewUploadRoute(
  outcomes: UploadOutcome[] = [],
  throwFinalizationAt?: number,
) {
  const calls = {
    buckets: [] as string[],
    uploads: [] as { path: string; file: File; options: unknown }[],
    urls: [] as string[],
    removed: [] as string[][],
  };
  const storage = {
    async upload(path: string, file: File, options: unknown) {
      const index = calls.uploads.length;
      calls.uploads.push({ path, file, options: structuredClone(options) });
      const outcome = outcomes[index] ?? "success";
      if (outcome === "throw") throw new Error("private upload details");
      return {
        data:
          outcome === "success" || outcome === "error_with_data"
            ? { path }
            : null,
        error:
          outcome === "error" || outcome === "error_with_data"
            ? new Error("private upload details")
            : null,
      };
    },
    async remove(paths: string[]) {
      calls.removed.push([...paths]);
      throw new Error("Unsafe storage deletion must never be attempted");
    },
  };
  let nextFileId = 0;
  const reservations = new Map<string, Record<string, string>>();
  const exported = {} as {
    POST: (request: NextRequest) => Promise<NextResponse>;
  };
  runInNewContext(reviewUploadRouteCode, {
    exports: exported,
    process: {
      env: { SUPABASE_STORAGE_BUCKET_REVIEW_IMAGES: reviewUploadBucket },
    },
    console: { error() {} },
    require(name: string) {
      if (name === "next/server") return { NextResponse };
      if (name === "@/lib/managed-image-upload") return managedImageUpload;
      if (name === "@/lib/image-utils") {
        return { readImageUploadFormData, validateImageUpload };
      }
      if (name === "@/lib/supabase/server") {
        return {
          createServerSupabaseClient: async () => ({
            async rpc(name: string, args: Record<string, string>) {
              if (name === "reserve_managed_image") {
                const assetId = `33333333-3333-4333-8333-${String(++nextFileId).padStart(12, "0")}`;
                const objectPath = `${userId}/managed-${assetId}.${args.p_extension}`;
                const row = {
                  asset_id: assetId,
                  bucket_id: args.p_bucket_id,
                  object_path: objectPath,
                  canonical_url: `${reviewUploadBucketUrl}/${objectPath}`,
                  state: "uploading",
                };
                reservations.set(assetId, row);
                return { data: [row], error: null };
              }
              assert.equal(name, "finalize_managed_image");
              const row = reservations.get(args.p_asset_id);
              assert.ok(row);
              calls.urls.push(row.object_path);
              if (calls.urls.length === throwFinalizationAt) {
                throw new Error("private finalization details");
              }
              return {
                data: [
                  { ...row, state: "ready", storage_object_id: row.asset_id },
                ],
                error: null,
              };
            },
            auth: {
              getUser: async () => ({
                data: { user: { id: userId } },
                error: null,
              }),
            },
            storage: {
              from(bucket: string) {
                calls.buckets.push(bucket);
                return storage;
              },
            },
          }),
        };
      }
      throw new Error(`Unexpected route dependency: ${name}`);
    },
  });
  return {
    calls,
    async invoke(count = 3) {
      const formData = new FormData();
      for (let index = 0; index < count; index++) {
        formData.append(
          "images",
          new Blob([jpeg], { type: "image/jpeg" }),
          `photo-${index}.jpg`,
        );
      }
      const response = await exported.POST(
        new NextRequest("https://refill.example/api/reviews/images/upload", {
          method: "POST",
          body: formData,
        }),
      );
      return { response, body: await response.json() };
    },
  };
}

test("review image route propagates first-upload failures without claiming confirmed uploads", async () => {
  for (const outcome of [
    "error",
    "error_with_data",
    "missing_data",
    "throw",
  ] as const) {
    const route = loadReviewUploadRoute([outcome]);
    const { response, body } = await route.invoke();
    assert.equal(response.status, 500, outcome);
    assert.equal(Object.hasOwn(body, "imageUrls"), false);
    assert.equal(Object.hasOwn(body, "imageCleanup"), false);
    assert.match(body.error, /업로드 요청을 완료하지 못했습니다/);
    assert.equal(JSON.stringify(body).includes("private"), false);
    assert.equal(route.calls.uploads.length, 1);
    assert.deepEqual(route.calls.urls, []);
    assert.deepEqual(route.calls.removed, []);
  }
});

test("review image route defers cleanup when the second upload fails and counts only confirmed uploads", async () => {
  for (const outcome of ["error", "error_with_data", "missing_data"] as const) {
    const route = loadReviewUploadRoute(["success", outcome]);
    const { response, body } = await route.invoke();
    assert.equal(response.status, 500, outcome);
    assert.equal(Object.hasOwn(body, "imageUrls"), false);
    assert.deepEqual(body.imageCleanup, {
      status: "deferred",
      count: 1,
      reason: "cleanup_unconfirmed",
    });
    assert.match(body.error, /업로드 요청을 완료하지 못했습니다/);
    assert.match(body.error, /확인된 이미지 1개의 파일 정리는 보류 중/);
    assert.match(body.error, /다시 시도/);
    assert.equal(JSON.stringify(body).includes("private"), false);
    assert.equal(route.calls.uploads.length, 2);
    assert.equal(route.calls.urls.length, 1);
    assert.deepEqual(route.calls.removed, []);
  }
});

test("review image route propagates exceptions after success without deleting confirmed objects", async () => {
  for (const [
    outcomes,
    throwPublicUrlAt,
    confirmedCount,
    uploadCount,
    urlCount,
  ] of [
    [["success", "throw"], undefined, 1, 2, 1],
    [["success", "success", "throw"], undefined, 2, 3, 2],
    [["success"], 1, 1, 1, 1],
    [["success", "success"], 2, 2, 2, 2],
  ] as const) {
    const route = loadReviewUploadRoute([...outcomes], throwPublicUrlAt);
    const { response, body } = await route.invoke();
    assert.equal(response.status, 500);
    assert.equal(Object.hasOwn(body, "imageUrls"), false);
    assert.deepEqual(body.imageCleanup, {
      status: "deferred",
      count: confirmedCount,
      reason: throwPublicUrlAt
        ? "managed_finalization_unconfirmed"
        : "cleanup_unconfirmed",
    });
    assert.ok(
      body.error.includes(
        `확인된 이미지 ${confirmedCount}개의 파일 정리는 보류 중`,
      ),
    );
    assert.equal(JSON.stringify(body).includes("private"), false);
    assert.equal(route.calls.uploads.length, uploadCount);
    assert.equal(route.calls.urls.length, urlCount);
    assert.deepEqual(route.calls.removed, []);
  }
});

test("review image route returns successful URLs only when every upload succeeds", async () => {
  const route = loadReviewUploadRoute();
  const { response, body } = await route.invoke();
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(body, "error"), false);
  assert.equal(Object.hasOwn(body, "imageCleanup"), false);
  assert.deepEqual(
    body.imageUrls,
    route.calls.uploads.map(({ path }) => `${reviewUploadBucketUrl}/${path}`),
  );
  assert.deepEqual(route.calls.buckets, Array(3).fill(reviewUploadBucket));
  assert.equal(route.calls.uploads.length, 3);
  assert.equal(new Set(route.calls.urls).size, 3);
  assert.deepEqual(route.calls.removed, []);
  for (const upload of route.calls.uploads) {
    assert.ok(upload.path.startsWith(`${userId}/`));
    assert.equal(upload.file.type, "image/jpeg");
    assert.deepEqual(upload.options, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });
  }
});
