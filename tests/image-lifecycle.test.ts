import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  getManagedImageCandidateIds,
  MANAGED_IMAGE_PROJECT_ORIGIN,
  parseManagedImageDeletionAcknowledgement,
  parseManagedImageDeletionClaims,
  parseManagedImageFinalization,
  parseManagedImageReservation,
  parseManagedImageUrl,
  type ManagedImageReservation,
} from "../lib/image-lifecycle";

const OWNER = "12345678-1234-4234-9234-123456789abc";
const ASSET = "11111111-1111-4111-8111-111111111111";
const SECOND_ASSET = "22222222-2222-4222-9222-222222222222";
const OBJECT = "33333333-3333-4333-a333-333333333333";
const TOKEN = "44444444-4444-4444-b444-444444444444";
const PATH = `${OWNER}/managed-${ASSET}.jpg`;
const URL = `${MANAGED_IMAGE_PROJECT_ORIGIN}/storage/v1/object/public/review-images/${PATH}`;
const RESERVATION: ManagedImageReservation = {
  asset_id: ASSET,
  bucket_id: "review-images",
  object_path: PATH,
  canonical_url: URL,
  state: "uploading",
};
const EXPECTED = {
  ownerId: OWNER,
  bucketId: "review-images" as const,
  extension: "jpg" as const,
};
const FINALIZED = {
  ...RESERVATION,
  state: "ready",
  storage_object_id: OBJECT,
};
const CLAIM = {
  asset_id: ASSET,
  bucket_id: "review-images",
  object_path: PATH,
  canonical_url: URL,
  storage_object_id: OBJECT,
  lease_token: TOKEN,
  lease_expires_at: "2026-10-11T12:00:00.123456+00:00",
  attempt_count: 1,
};

// Pure syntax/protocol tests are not PostgreSQL concurrency evidence. Real SQL
// tests live in integration/image-lifecycle.test.ts and require an isolated PG
// container; production Storage API completion semantics remain separate.
test("quota migration preserves reservation provenance checks and confines changes to admission", () => {
  const core = readFileSync(
    resolve("supabase/migrations/202610110005_managed_image_lifecycle.sql"),
    "utf8",
  );
  const migration = readFileSync(
    resolve(
      "supabase/migrations/202610110008_bound_managed_image_reservations.sql",
    ),
    "utf8",
  );
  const reservationBody = (source: string) => {
    const match = source.match(
      /function public\.reserve_managed_image\(p_bucket_id text, p_extension text\)[\s\S]*?as \$function\$([\s\S]*?)\$function\$;/,
    );
    assert.ok(match);
    return match[1].trim();
  };
  const admission =
    /\n  insert into public\.managed_image_reservation_owners[\s\S]*?  end if;\n\n/;
  const updated = reservationBody(migration);
  const quota = updated.match(admission)?.[0];
  assert.ok(quota, "Quota must run inside the security-definer RPC");
  assert.match(quota, /values \(caller_id\)/);
  assert.match(
    quota,
    /on conflict \(owner_id\) do update set owner_id = excluded\.owner_id/,
  );
  assert.match(
    quota,
    /a\.owner_id = caller_id and a\.state = 'uploading'\) >= 20/,
  );
  assert.match(quota, /errcode = '54000'/);
  assert.ok(updated.indexOf(quota) < updated.indexOf("for attempt in 1..10"));
  assert.equal(updated.replace(admission, ""), reservationBody(core));
  assert.match(
    migration,
    /alter table public\.managed_image_reservation_owners enable row level security/,
  );
  assert.match(
    migration,
    /revoke all on public\.managed_image_reservation_owners\s+from public, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(
    migration,
    /pg_advisory|delete from|create policy|grant /i,
  );
  assert.equal(
    (migration.match(/create or replace function /g) ?? []).length,
    1,
  );
});

test("browser-stripped controls cannot hide managed reference candidates", () => {
  for (const control of ["\t", "\n", "\r"]) {
    for (const alias of [
      URL.replace("managed-", `man${control}aged-`),
      URL.replace(ASSET, `${ASSET.slice(0, 12)}${control}${ASSET.slice(12)}`),
      URL.replace(".jpg", `.j${control}pg`),
    ]) {
      assert.equal(new globalThis.URL(alias).href, URL);
      assert.deepEqual(getManagedImageCandidateIds(alias), [ASSET]);
      assert.equal(parseManagedImageUrl(alias), null);
    }
  }
});

test("canonical parser preserves exact project, bucket, owner and immutable key", () => {
  assert.deepEqual(parseManagedImageUrl(URL), {
    assetId: ASSET,
    ownerId: OWNER,
    bucketId: "review-images",
    objectPath: PATH,
    extension: "jpg",
    canonicalUrl: URL,
  });
  for (const extension of ["jpg", "png", "webp"]) {
    const profile = URL.replace("review-images", "profile-images").replace(
      /jpg$/,
      extension,
    );
    assert.equal(parseManagedImageUrl(profile)?.bucketId, "profile-images");
    assert.equal(parseManagedImageUrl(profile)?.extension, extension);
  }
});

test("canonical parser rejects URL normalization, other projects and legacy names", () => {
  for (const invalid of [
    null,
    42,
    {},
    URL.replace("https:", "http:"),
    URL.replace("ykztepbfcocxmtotrdbk", "another-project"),
    URL.replace("supabase.co/", "supabase.co:443/"),
    URL.replace("https://", "https://user@"),
    URL.replace("public/", "sign/"),
    URL.replace("review-images", "refill-spot-images"),
    URL.replace("review-images", "image"),
    URL.replace("managed-", ""),
    URL.replace("managed-", "%6danaged-"),
    URL.replace("/managed-", "/x/../managed-"),
    URL.replace("/managed-", "%2fmanaged-"),
    URL.replace(".jpg", ".jpeg"),
    URL.replace(ASSET, ASSET.replace("-4111-", "-3111-")),
    `${URL}?download=1`,
    `${URL}#photo`,
    `${URL}\n`,
    ` ${URL}`,
  ]) {
    assert.equal(parseManagedImageUrl(invalid), null, String(invalid));
  }
});

test("alias detector finds encoded, traversal and multiple candidates without accepting them", () => {
  assert.deepEqual(getManagedImageCandidateIds(null), []);
  assert.deepEqual(getManagedImageCandidateIds(`${OWNER}/${ASSET}.jpg`), []);
  assert.deepEqual(
    getManagedImageCandidateIds(URL.replace("managed-", "%6d%61naged%2d")),
    [ASSET],
  );
  assert.deepEqual(
    getManagedImageCandidateIds(URL.replace("/managed-", "/../managed-")),
    [ASSET],
  );
  assert.deepEqual(
    getManagedImageCandidateIds(
      `${URL}?next=MANAGED-${SECOND_ASSET.toUpperCase()}.PNG#managed-${ASSET}.jpg`,
    ),
    [ASSET, SECOND_ASSET],
  );
  assert.deepEqual(
    getManagedImageCandidateIds(`%00%C3%ZZmanaged-${ASSET}.jpg`),
    [ASSET],
  );
  assert.deepEqual(getManagedImageCandidateIds(`%256danaged-${ASSET}.jpg`), []);
});

test("reservation parser requires a single matching uploading row", () => {
  assert.deepEqual(
    parseManagedImageReservation([RESERVATION], EXPECTED),
    RESERVATION,
  );
  for (const invalid of [
    null,
    {},
    RESERVATION,
    [],
    [RESERVATION, RESERVATION],
    [FINALIZED],
  ]) {
    assert.equal(parseManagedImageReservation(invalid, EXPECTED), null);
  }
  for (const patch of [
    { asset_id: SECOND_ASSET },
    { bucket_id: "profile-images" },
    { object_path: `${OWNER}/${ASSET}.jpg` },
    { canonical_url: `${URL}?alias=1` },
  ]) {
    assert.equal(
      parseManagedImageReservation([{ ...RESERVATION, ...patch }], EXPECTED),
      null,
    );
  }
  assert.equal(
    parseManagedImageReservation([RESERVATION], {
      ...EXPECTED,
      ownerId: OBJECT,
    }),
    null,
  );
  assert.equal(
    parseManagedImageReservation([RESERVATION], {
      ...EXPECTED,
      extension: "png",
    }),
    null,
  );
});

test("finalization parser requires the original reservation and authoritative object id", () => {
  assert.deepEqual(
    parseManagedImageFinalization([FINALIZED], RESERVATION),
    FINALIZED,
  );
  for (const patch of [
    { state: "uploading" },
    { state: "deleting" },
    { storage_object_id: null },
    { storage_object_id: "not-an-object-id" },
    { asset_id: SECOND_ASSET },
    { canonical_url: URL.replace("review-images", "profile-images") },
  ]) {
    assert.equal(
      parseManagedImageFinalization([{ ...FINALIZED, ...patch }], RESERVATION),
      null,
    );
  }
  assert.equal(
    parseManagedImageFinalization([FINALIZED], {
      ...RESERVATION,
      object_path: "other-path",
    }),
    null,
  );
});

test("claim parser accepts empty and bounded valid batches without exposing state assumptions", () => {
  assert.deepEqual(parseManagedImageDeletionClaims([]), []);
  assert.deepEqual(parseManagedImageDeletionClaims([CLAIM]), [CLAIM]);
  const second = {
    ...CLAIM,
    asset_id: SECOND_ASSET,
    object_path: PATH.replace(ASSET, SECOND_ASSET),
    canonical_url: URL.replace(ASSET, SECOND_ASSET),
    attempt_count: 2,
  };
  assert.deepEqual(parseManagedImageDeletionClaims([CLAIM, second]), [
    CLAIM,
    second,
  ]);
});

test("claim parser rejects whole malformed batches and never salvages legacy paths", () => {
  for (const patch of [
    { object_path: `${OWNER}/${ASSET}.jpg` },
    { canonical_url: URL.replace("ykztepbfcocxmtotrdbk", "another-project") },
    { storage_object_id: undefined },
    { lease_token: null },
    { lease_token: `${TOKEN.slice(0, 14)}3${TOKEN.slice(15)}` },
    { lease_expires_at: "2026-10-11T12:00:00" },
    { lease_expires_at: "not-a-date" },
    { lease_expires_at: "2026-13-99T25:00:00Z" },
    { attempt_count: 0 },
    { attempt_count: 1.5 },
    { attempt_count: "1" },
    { attempt_count: 2147483648 },
  ]) {
    assert.equal(
      parseManagedImageDeletionClaims([CLAIM, { ...CLAIM, ...patch }]),
      null,
    );
    assert.equal(
      parseManagedImageDeletionClaims([{ ...CLAIM, ...patch }]),
      null,
    );
  }
  assert.equal(parseManagedImageDeletionClaims([CLAIM, CLAIM]), null);
  assert.equal(parseManagedImageDeletionClaims(Array(101).fill(CLAIM)), null);
  assert.equal(parseManagedImageDeletionClaims({ claims: [CLAIM] }), null);
});

test("ack parser distinguishes durable deletion from retry without implying physical success", () => {
  const deleted = { asset_id: ASSET, state: "deleted", retry_after: null };
  const retry = {
    asset_id: ASSET,
    state: "deleting",
    retry_after: "2026-10-11T12:05:00Z",
  };
  assert.deepEqual(
    parseManagedImageDeletionAcknowledgement([deleted], ASSET, true),
    deleted,
  );
  assert.deepEqual(
    parseManagedImageDeletionAcknowledgement([retry], ASSET, false),
    retry,
  );
  assert.equal(
    parseManagedImageDeletionAcknowledgement([retry], ASSET, true),
    null,
  );
  assert.equal(
    parseManagedImageDeletionAcknowledgement([deleted], ASSET, false),
    null,
  );
  assert.equal(
    parseManagedImageDeletionAcknowledgement([deleted], SECOND_ASSET, true),
    null,
  );
  assert.equal(
    parseManagedImageDeletionAcknowledgement(
      [{ ...retry, retry_after: null }],
      ASSET,
      false,
    ),
    null,
  );
  assert.equal(
    parseManagedImageDeletionAcknowledgement(
      [{ ...deleted, state: "ready" }],
      ASSET,
      true,
    ),
    null,
  );
});
