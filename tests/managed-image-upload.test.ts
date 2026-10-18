import assert from "node:assert/strict";
import { File } from "node:buffer";
import { test } from "node:test";
import {
  MANAGED_IMAGE_PROJECT_ORIGIN,
  type ManagedImageBucket,
  type ManagedImageExtension,
  type ManagedImageReservation,
} from "../lib/image-lifecycle";
import { MAX_IMAGE_UPLOAD_BYTES } from "../lib/image-utils";
import {
  ManagedImageUploadError,
  uploadManagedImage,
} from "../lib/managed-image-upload";

const OWNER = "12345678-1234-4234-9234-123456789abc";
const OTHER_OWNER = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ASSET = "11111111-1111-4111-8111-111111111111";
const OTHER_ASSET = "22222222-2222-4222-9222-222222222222";
const OBJECT = "33333333-3333-4333-a333-333333333333";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function reservation(
  bucketId: ManagedImageBucket = "review-images",
  extension: ManagedImageExtension = "jpg",
  ownerId = OWNER,
): ManagedImageReservation {
  const objectPath = `${ownerId}/managed-${ASSET}.${extension}`;
  return {
    asset_id: ASSET,
    bucket_id: bucketId,
    object_path: objectPath,
    canonical_url:
      `${MANAGED_IMAGE_PROJECT_ORIGIN}/storage/v1/object/public/` +
      `${bucketId}/${objectPath}`,
    state: "uploading",
  };
}

function imageFile(bytes = JPEG, type = "image/jpeg", name = "image.jpg") {
  return new File([bytes], name, { type });
}

type MockOptions = {
  reserveData?: unknown;
  reserveError?: unknown;
  reserveThrows?: boolean;
  storageThrows?: boolean;
  uploadData?: unknown;
  uploadError?: unknown;
  uploadThrows?: boolean;
  finalizeData?: unknown;
  finalizeError?: unknown;
  finalizeThrows?: boolean;
};

// These are protocol tests only: no live credentials, DB or Storage writes.
function mockClient(options: MockOptions = {}, row = reservation()) {
  const finalized = { ...row, state: "ready", storage_object_id: OBJECT };
  const calls = {
    events: [] as string[],
    rpcs: [] as { name: string; args: Record<string, unknown> }[],
    buckets: [] as string[],
    uploads: [] as {
      path: string;
      file: unknown;
      options: Record<string, unknown>;
    }[],
    removes: [] as string[][],
    publicUrls: [] as string[],
  };
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.events.push(name);
      calls.rpcs.push({ name, args });
      if (name === "reserve_managed_image") {
        if (options.reserveThrows) throw new Error("Reservation timed out");
        return {
          data: Object.hasOwn(options, "reserveData")
            ? options.reserveData
            : [row],
          error: options.reserveError ?? null,
        };
      }
      assert.equal(name, "finalize_managed_image");
      if (options.finalizeThrows) throw new Error("Finalization timed out");
      return {
        data: Object.hasOwn(options, "finalizeData")
          ? options.finalizeData
          : [finalized],
        error: options.finalizeError ?? null,
      };
    },
    storage: {
      from(bucket: string) {
        calls.buckets.push(bucket);
        if (options.storageThrows)
          throw new Error("Storage client unavailable");
        return {
          async upload(
            path: string,
            file: unknown,
            uploadOptions: Record<string, unknown>,
          ) {
            calls.events.push("upload");
            calls.uploads.push({ path, file, options: uploadOptions });
            if (options.uploadThrows) throw new Error("Upload timed out");
            return {
              data: Object.hasOwn(options, "uploadData")
                ? options.uploadData
                : { path, id: OBJECT, fullPath: `${bucket}/${path}` },
              error: options.uploadError ?? null,
            };
          },
          async remove(paths: string[]) {
            calls.removes.push(paths);
            throw new Error("Rollback deletion is prohibited");
          },
          getPublicUrl(path: string) {
            calls.publicUrls.push(path);
            throw new Error("Unverified URL generation is prohibited");
          },
        };
      },
    },
  };
  return {
    client: client as unknown as Parameters<typeof uploadManagedImage>[0],
    calls,
    finalized,
  };
}

async function expectFailure(
  mock: ReturnType<typeof mockClient>,
  stage: ManagedImageUploadError["stage"],
  uploadState: ManagedImageUploadError["uploadState"],
  file: unknown = imageFile(),
  bucketId = "review-images",
) {
  await assert.rejects(
    uploadManagedImage(mock.client, { ownerId: OWNER, bucketId, file }),
    (error: unknown) => {
      assert.ok(error instanceof ManagedImageUploadError);
      assert.equal(error.stage, stage);
      assert.equal(error.uploadState, uploadState);
      return true;
    },
  );
  assert.deepEqual(mock.calls.removes, []);
  assert.deepEqual(mock.calls.publicUrls, []);
}

test("invalid files fail before any reservation or Storage access", async () => {
  for (const file of [
    null,
    "image.jpg",
    imageFile(JPEG, "image/svg+xml"),
    imageFile(Buffer.alloc(0)),
    imageFile(Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1)),
    imageFile(Buffer.from("not a jpeg")),
  ]) {
    const mock = mockClient();
    await expectFailure(mock, "validation", "not_attempted", file);
    assert.deepEqual(mock.calls.rpcs, []);
    assert.deepEqual(mock.calls.buckets, []);
    assert.deepEqual(mock.calls.uploads, []);
  }
});

test("unsupported bucket configuration has no unmanaged fallback", async () => {
  for (const bucket of [
    "image",
    "custom-review-images",
    "",
    "review-images/",
  ]) {
    const mock = mockClient();
    await expectFailure(
      mock,
      "validation",
      "not_attempted",
      imageFile(),
      bucket,
    );
    assert.deepEqual(mock.calls.events, []);
    assert.deepEqual(mock.calls.buckets, []);
  }
});

test("missing or inactive lifecycle reservation fails closed", async () => {
  for (const options of [
    { reserveError: { code: "PGRST202", message: "Function not found" } },
    { reserveError: { code: "42501", message: "Lifecycle inactive" } },
    { reserveError: { message: "Storage guard verification failed" } },
    { reserveThrows: true },
  ]) {
    const mock = mockClient(options);
    await expectFailure(mock, "reserve", "not_attempted");
    assert.deepEqual(mock.calls.events, ["reserve_managed_image"]);
    assert.deepEqual(mock.calls.buckets, []);
    assert.deepEqual(mock.calls.uploads, []);
  }
});

test("malformed reservations cannot initiate an upload", async () => {
  const row = reservation();
  for (const reserveData of [
    null,
    undefined,
    false,
    {},
    row,
    [],
    [row, row],
    [{ ...row, asset_id: OTHER_ASSET }],
    [{ ...row, state: "ready" }],
    [{ ...row, canonical_url: `${row.canonical_url}?download=1` }],
  ]) {
    const mock = mockClient({ reserveData });
    await expectFailure(mock, "reserve", "not_attempted");
    assert.deepEqual(mock.calls.events, ["reserve_managed_image"]);
    assert.deepEqual(mock.calls.buckets, []);
  }
});

test("reservation must match authenticated owner, bucket and validated extension", async () => {
  for (const row of [
    reservation("review-images", "jpg", OTHER_OWNER),
    reservation("profile-images"),
    reservation("review-images", "png"),
  ]) {
    const mock = mockClient({ reserveData: [row] });
    await expectFailure(mock, "reserve", "not_attempted");
    assert.equal(mock.calls.uploads.length, 0);
  }
});

test("legacy or changed reserved object names are rejected, never repaired", async () => {
  const row = reservation();
  for (const objectPath of [
    row.object_path.replace("managed-", ""),
    row.object_path.replace("managed-", "%6danaged-"),
    row.object_path.replace("/managed-", "/x/../managed-"),
    row.object_path.replace(ASSET, OTHER_ASSET),
    `${row.object_path}\n`,
  ]) {
    const mock = mockClient({
      reserveData: [{ ...row, object_path: objectPath }],
    });
    await expectFailure(mock, "reserve", "not_attempted");
    assert.equal(mock.calls.uploads.length, 0);
  }
});

test("Storage client failure before upload remains not attempted", async () => {
  const mock = mockClient({ storageThrows: true });
  await expectFailure(mock, "upload", "not_attempted");
  assert.deepEqual(mock.calls.events, ["reserve_managed_image"]);
  assert.deepEqual(mock.calls.uploads, []);
});

test("unacknowledged upload results are unknown, never finalized or removed", async () => {
  for (const options of [
    { uploadData: null },
    { uploadData: false },
    { uploadData: undefined },
    { uploadData: {} },
    {
      uploadData: {
        path: reservation().object_path.replace(ASSET, OTHER_ASSET),
      },
    },
    { uploadError: { message: "Storage request failed" } },
    { uploadThrows: true },
  ]) {
    const mock = mockClient(options);
    await expectFailure(mock, "upload", "unknown");
    assert.deepEqual(mock.calls.events, ["reserve_managed_image", "upload"]);
    assert.equal(mock.calls.uploads[0].path, reservation().object_path);
    assert.equal(mock.calls.uploads[0].options.upsert, false);
  }
});

test("finalization rejection or timeout retains confirmed upload state", async () => {
  for (const options of [
    { finalizeError: { message: "Lifecycle inactive" } },
    { finalizeError: { message: "Object metadata unverified" } },
    { finalizeThrows: true },
  ]) {
    const mock = mockClient(options);
    await expectFailure(mock, "finalize", "confirmed");
    assert.deepEqual(mock.calls.events, [
      "reserve_managed_image",
      "upload",
      "finalize_managed_image",
    ]);
    assert.equal(mock.calls.uploads.length, 1);
  }
});

test("finalization must confirm the exact reservation, ready state and metadata id", async () => {
  const row = reservation();
  const ready = { ...row, state: "ready", storage_object_id: OBJECT };
  for (const finalizeData of [
    null,
    undefined,
    ready,
    [],
    [ready, ready],
    [row],
    [{ ...ready, state: "deleting" }],
    [{ ...ready, storage_object_id: null }],
    [{ ...ready, storage_object_id: "not-a-metadata-id" }],
    [{ ...ready, asset_id: OTHER_ASSET }],
    [{ ...ready, object_path: row.object_path.replace(OWNER, OTHER_OWNER) }],
    [
      {
        ...ready,
        canonical_url: row.canonical_url.replace(OWNER, OTHER_OWNER),
      },
    ],
    [{ ...ready, bucket_id: "profile-images" }],
    [{ ...ready, canonical_url: `${row.canonical_url}\n` }],
  ]) {
    const mock = mockClient({ finalizeData });
    await expectFailure(mock, "finalize", "confirmed");
    assert.equal(mock.calls.rpcs.length, 2);
    assert.equal(mock.calls.uploads.length, 1);
  }
});

test("successful managed uploads use only the exact reserved path and canonical result", async () => {
  for (const bucket of ["review-images", "profile-images"] as const) {
    for (const [bytes, mime, contentType, extension] of [
      [JPEG, "image/jpeg", "image/jpeg", "jpg"],
      [JPEG, "image/jpg", "image/jpeg", "jpg"],
      [PNG, "image/png", "image/png", "png"],
      [WEBP, "image/webp", "image/webp", "webp"],
    ] as const) {
      const row = reservation(bucket, extension);
      const mock = mockClient({}, row);
      const file = imageFile(
        bytes,
        mime,
        "../../untrusted-file.svg?other=path",
      );
      const result = await uploadManagedImage(mock.client, {
        ownerId: OWNER,
        bucketId: bucket,
        file,
      });
      assert.deepEqual(result, mock.finalized);
      assert.equal(result.canonical_url, row.canonical_url);
      assert.deepEqual(mock.calls.events, [
        "reserve_managed_image",
        "upload",
        "finalize_managed_image",
      ]);
      assert.deepEqual(mock.calls.rpcs, [
        {
          name: "reserve_managed_image",
          args: { p_bucket_id: bucket, p_extension: extension },
        },
        { name: "finalize_managed_image", args: { p_asset_id: ASSET } },
      ]);
      assert.deepEqual(mock.calls.buckets, [bucket]);
      assert.deepEqual(mock.calls.uploads, [
        {
          path: row.object_path,
          file,
          options: { contentType, cacheControl: "3600", upsert: false },
        },
      ]);
      assert.deepEqual(mock.calls.removes, []);
      assert.deepEqual(mock.calls.publicUrls, []);
    }
  }
});
