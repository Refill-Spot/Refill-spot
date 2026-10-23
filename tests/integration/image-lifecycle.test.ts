import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import {
  MANAGED_IMAGE_PROJECT_ORIGIN,
  parseManagedImageDeletionClaims,
  parseManagedImageFinalization,
  parseManagedImageReservation,
  type ManagedImageDeletionClaim,
  type ManagedImageReservation,
} from "../../lib/image-lifecycle";

// Explicit integration command, not in tests/*.test.ts. The parent owns this
// disposable, network-none container and must supply its exact name. This suite
// creates/drops only its own fresh database; it never starts/removes containers,
// installs packages, contacts Supabase, or proves physical Storage semantics.
const container = process.env.IMAGE_LIFECYCLE_TEST_CONTAINER;
if (!container || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container)) {
  throw new Error(
    "Set IMAGE_LIFECYCLE_TEST_CONTAINER to an isolated PostgreSQL container; integration tests do not skip.",
  );
}
const database = `image_lifecycle_qa_${process.pid}_${Date.now()}`;
const OWNER = "12345678-1234-4234-9234-123456789abc";
const OTHER = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const LEGACY_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const LEGACY_PATH = `${OWNER}/managed-${LEGACY_ID}.jpg`;
const LEGACY_URL = `${MANAGED_IMAGE_PROJECT_ORIGIN}/storage/v1/object/public/review-images/${LEGACY_PATH}`;
const core = readFileSync(
  resolve("supabase/migrations/202610110005_managed_image_lifecycle.sql"),
  "utf8",
);
const guards = readFileSync(
  resolve("supabase/migrations/202610110006_managed_image_storage_guards.sql"),
  "utf8",
);
const uploadOperation = readFileSync(
  resolve(
    "supabase/migrations/202610110007_guard_managed_upload_operation.sql",
  ),
  "utf8",
);
const reservationLimit = readFileSync(
  resolve(
    "supabase/migrations/202610110008_bound_managed_image_reservations.sql",
  ),
  "utf8",
);
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
let rowId = 10;

function startDocker(args: string[], input?: string) {
  const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") stderr += `stdin: ${error.message}\n`;
  });
  const timer = setTimeout(() => child.kill(), 45000);
  const done = new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolveResult, reject) => {
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolveResult({ code, stdout, stderr });
    });
  });
  if (input !== undefined) child.stdin.end(input);
  return { child, done, output: () => ({ stdout, stderr }) };
}

function psqlArgs(db = database) {
  return [
    "exec",
    "-i",
    container!,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    db,
    "-qAt",
    "-v",
    "ON_ERROR_STOP=1",
  ];
}

async function execute(sql: string, db = database) {
  return startDocker(psqlArgs(db), `set statement_timeout = '30s';\n${sql}\n`)
    .done;
}

async function sql(command: string, db = database) {
  const result = await execute(command, db);
  assert.equal(
    result.code,
    0,
    `SQL failed:\n${result.stderr}\n${result.stdout}`,
  );
  return result.stdout.trim();
}

function identity(
  role: "authenticated" | "anon" | "service_role",
  owner = OWNER,
) {
  return `set request.jwt.claim.role = ${quote(role)}; set request.jwt.claim.sub = ${quote(owner)}; set role ${role};`;
}

async function rejected(command: string, expected: RegExp) {
  const result = await execute(command);
  assert.notEqual(result.code, 0, "SQL unexpectedly succeeded");
  assert.match(result.stderr, expected);
}

async function jsonRows<T>(command: string, caller?: string): Promise<T[]> {
  return JSON.parse(
    await sql(
      `${caller ?? ""}\nwith r as (${command}) select coalesce(json_agg(row_to_json(r)), '[]'::json) from r;`,
    ),
  );
}

async function reserve(bucket = "review-images", extension = "jpg") {
  const rows = await jsonRows(
    `select * from public.reserve_managed_image(${quote(bucket)}, ${quote(extension)})`,
    identity("authenticated"),
  );
  const parsed = parseManagedImageReservation(rows, {
    ownerId: OWNER,
    bucketId: bucket as "review-images" | "profile-images",
    extension: extension as "jpg" | "png" | "webp",
  });
  assert.ok(
    parsed,
    "Reservation SQL response must satisfy the production parser",
  );
  return parsed;
}

function insertObject(
  asset: ManagedImageReservation,
  metadata = '{"mimetype":"image/jpeg","size":128}',
  operation: string | null = "object.upload",
) {
  return `${operation === null ? "" : `set storage.operation = ${quote(operation)};`}
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values (${quote(asset.bucket_id)}, ${quote(asset.object_path)}, ${quote(OWNER)}::uuid, ${quote(OWNER)}, ${quote(metadata)}::jsonb);`;
}

async function ready() {
  const asset = await reserve();
  await sql(identity("authenticated") + insertObject(asset));
  const rows = await jsonRows(
    `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid)`,
    identity("authenticated"),
  );
  assert.ok(parseManagedImageFinalization(rows, asset));
  return asset;
}

async function makeDue(asset: ManagedImageReservation) {
  await sql(`update public.managed_image_assets set cleanup_after = clock_timestamp() - interval '1 second'
    where asset_id = ${quote(asset.asset_id)}::uuid;`);
}

async function claim() {
  const rows = await jsonRows(
    "select * from public.claim_managed_image_deletions(20)",
    identity("service_role"),
  );
  const parsed = parseManagedImageDeletionClaims(rows);
  assert.ok(parsed, "Claim SQL response must satisfy the production parser");
  return parsed;
}

async function acknowledge(asset: ManagedImageDeletionClaim, deleted: boolean) {
  return jsonRows<{
    asset_id: string;
    state: string;
    retry_after: string | null;
  }>(
    `select * from public.acknowledge_managed_image_deletion(${quote(asset.asset_id)}::uuid,
      ${quote(asset.lease_token)}::uuid, ${deleted}, ${deleted ? "null" : "'permission_denied'"})`,
    identity("service_role"),
  );
}

async function count(asset: ManagedImageReservation) {
  return sql(`select ref_count::text || ':' || (select count(*) from public.managed_image_references r where r.asset_id = a.asset_id)
    from public.managed_image_assets a where a.asset_id = ${quote(asset.asset_id)}::uuid;`);
}

function session(name: string) {
  const running = startDocker(psqlArgs());
  running.child.stdin.write(
    `set application_name = ${quote(name)}; set statement_timeout = '15s'; set lock_timeout = '12s';\n`,
  );
  return {
    ...running,
    send: (command: string) => running.child.stdin.write(command + "\n"),
    async marker(value: string) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (running.output().stdout.includes(value)) return;
        if (running.child.exitCode !== null) {
          throw new Error(
            `Session exited before ${value}: ${running.output().stderr}`,
          );
        }
        await delay(25);
      }
      throw new Error(
        `Session did not reach ${value}: ${running.output().stderr}`,
      );
    },
    close() {
      if (!running.child.stdin.destroyed)
        running.child.stdin.end("rollback;\n\\q\n");
    },
  };
}

async function waitForLock(name: string) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const waiting = await sql(`select count(*) from pg_catalog.pg_stat_activity
      where datname = current_database() and application_name = ${quote(name)}
        and state = 'active' and wait_event_type = 'Lock';`);
    if (waiting === "1") return;
    await delay(25);
  }
  throw new Error(
    `Session ${name} never reached the actual PostgreSQL lock wait`,
  );
}

const fixture = `
do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $roles$;
alter role anon nobypassrls;
alter role authenticated nobypassrls;
alter role service_role bypassrls;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as
  'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
create function auth.role() returns text language sql stable as
  'select nullif(current_setting(''request.jwt.claim.role'', true), '''')';
create function storage.allow_only_operation(p_operation text) returns boolean language sql stable as
  'select coalesce(current_setting(''storage.operation'', true) = p_operation, false)';
create table public.profiles (id uuid primary key, avatar_url text);
create table public.stores (id bigint primary key, image_urls text[]);
create table public.reviews (id bigint primary key, user_id uuid references public.profiles(id) on delete cascade,
  store_id bigint references public.stores(id) on delete cascade, image_urls text[]);
create table storage.buckets (id text primary key, versioning_status text not null default 'DISABLED');
insert into storage.buckets (id) values ('review-images'), ('profile-images');
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, owner_id text, metadata jsonb, version text, archived_at timestamptz,
  is_delete_marker boolean not null default false, is_versioned boolean not null default false);
create index idx_objects_bucket_id_name on storage.objects (bucket_id, name collate "C");
create index name_prefix_search on storage.objects (name text_pattern_ops);
create index idx_objects_bucket_id_name_lower on storage.objects (bucket_id, lower(name) collate "C");
create unique index objects_bucket_id_name_version_key on storage.objects (bucket_id, name collate "C", version) nulls not distinct;
create unique index idx_objects_current_version on storage.objects (bucket_id, name collate "C") where (archived_at is null);
create unique index idx_objects_null_version on storage.objects (bucket_id, name collate "C") where (not is_versioned);
create index idx_objects_delete_markers on storage.objects (bucket_id, name collate "C") where is_delete_marker;
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select, insert, update, delete, truncate on public.profiles, public.reviews, public.stores to authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
create policy old_public_read on storage.objects for select to public using (true);
create policy old_user_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('review-images', 'profile-images') and split_part(name, '/', 1) = auth.uid()::text
);
create policy old_user_update on storage.objects for update to authenticated using (
  split_part(name, '/', 1) = auth.uid()::text
) with check (split_part(name, '/', 1) = auth.uid()::text);
create policy old_user_delete on storage.objects for delete to authenticated using (
  split_part(name, '/', 1) = auth.uid()::text
);
insert into public.profiles values (${quote(OWNER)}::uuid, null), (${quote(OTHER)}::uuid, null);
insert into public.stores values (1, array[${quote(LEGACY_URL)}]);
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('review-images', ${quote(LEGACY_PATH)}, ${quote(OWNER)}::uuid, ${quote(OWNER)}, '{"mimetype":"image/jpeg","size":128}'::jsonb);
`;

test(
  "managed image lifecycle: actual PostgreSQL DML, RLS and READ COMMITTED locks",
  { timeout: 240000 },
  async (t) => {
    const network = await startDocker(
      ["inspect", "--format", "{{.HostConfig.NetworkMode}}", container!],
      "",
    ).done;
    assert.equal(network.code, 0, network.stderr);
    assert.equal(
      network.stdout.trim(),
      "none",
      "Integration container must have --network none",
    );
    await sql(`create database ${database};`, "postgres");
    try {
      await sql(fixture);
      await t.test(
        "unverified catalog types abort the core installation",
        async () => {
          await sql(
            "alter table storage.objects alter column metadata type text using metadata::text;",
          );
          await rejected(
            core,
            /require verified storage\.objects\.metadata of type jsonb/,
          );
          assert.equal(
            await sql(
              "select to_regclass('public.managed_image_assets') is null;",
            ),
            "t",
          );
          await sql(
            "alter table storage.objects alter column metadata type jsonb using metadata::jsonb;",
          );
        },
      );
      await t.test(
        "missing version metadata and nullable versioning flags abort installation",
        async () => {
          for (const [table, column] of [
            ["objects", "version"],
            ["objects", "archived_at"],
            ["objects", "is_delete_marker"],
            ["objects", "is_versioned"],
            ["buckets", "versioning_status"],
          ]) {
            await sql(
              `alter table storage.${table} rename column ${column} to unverified_column;`,
            );
            try {
              await rejected(
                core,
                new RegExp(
                  `require verified storage\\.${table}\\.${column} of type`,
                ),
              );
              assert.equal(
                await sql(
                  "select to_regclass('public.managed_image_assets') is null;",
                ),
                "t",
              );
            } finally {
              await sql(
                `alter table storage.${table} rename column unverified_column to ${column};`,
              );
            }
          }
          for (const column of ["is_delete_marker", "is_versioned"]) {
            await sql(
              `alter table storage.objects alter column ${column} drop not null;`,
            );
            try {
              await rejected(
                core,
                new RegExp(
                  `require verified storage\\.objects\\.${column} of type boolean`,
                ),
              );
            } finally {
              await sql(
                `alter table storage.objects alter column ${column} set not null;`,
              );
            }
          }
        },
      );
      await t.test(
        "installation requires the exact verified current, unversioned and NULLS NOT DISTINCT version indexes",
        async () => {
          for (const name of [
            "idx_objects_current_version",
            "idx_objects_null_version",
            "objects_bucket_id_name_version_key",
          ]) {
            const definition = await sql(
              `select pg_get_indexdef(${quote(`storage.${name}`)}::regclass);`,
            );
            await sql(`drop index storage.${name};`);
            try {
              await rejected(
                core,
                /current\/unversioned\/version uniqueness is unverified/,
              );
              assert.equal(
                await sql(
                  "select to_regclass('public.managed_image_assets') is null;",
                ),
                "t",
              );
            } finally {
              await sql(definition + ";");
            }
          }
          const currentIndex = await sql(
            "select pg_get_indexdef('storage.idx_objects_current_version'::regclass);",
          );
          for (const replacement of [
            'create unique index idx_objects_current_version on storage.objects (bucket_id, name collate "C");',
            'create index idx_objects_current_version on storage.objects (bucket_id, name collate "C") where archived_at is null;',
            'create unique index idx_objects_current_version on storage.objects (bucket_id, name collate "C") where archived_at is null and not is_delete_marker;',
            'create unique index idx_objects_current_version on storage.objects (bucket_id, lower(name) collate "C") where archived_at is null;',
            'create unique index idx_objects_current_version on storage.objects (bucket_id, name collate "default") where archived_at is null;',
          ]) {
            await sql(
              `drop index storage.idx_objects_current_version; ${replacement}`,
            );
            try {
              await rejected(
                core,
                /current\/unversioned\/version uniqueness is unverified/,
              );
            } finally {
              await sql(
                `drop index storage.idx_objects_current_version; ${currentIndex};`,
              );
            }
          }
          const versionIndex = await sql(
            "select pg_get_indexdef('storage.objects_bucket_id_name_version_key'::regclass);",
          );
          await sql(
            'drop index storage.objects_bucket_id_name_version_key; create unique index objects_bucket_id_name_version_key on storage.objects (bucket_id, name collate "C", version);',
          );
          try {
            await rejected(
              core,
              /current\/unversioned\/version uniqueness is unverified/,
            );
          } finally {
            await sql(
              `drop index storage.objects_bucket_id_name_version_key; ${versionIndex};`,
            );
          }
        },
      );
      await t.test(
        "installation requires both existing managed buckets to have versioning DISABLED",
        async () => {
          for (const bucket of ["review-images", "profile-images"]) {
            await sql(
              `update storage.buckets set versioning_status = 'ENABLED' where id = ${quote(bucket)};`,
            );
            try {
              await rejected(
                core,
                /Both managed image buckets must have versioning DISABLED/,
              );
              assert.equal(
                await sql(
                  "select to_regclass('public.managed_image_assets') is null;",
                ),
                "t",
              );
            } finally {
              await sql(
                `update storage.buckets set versioning_status = 'DISABLED' where id = ${quote(bucket)};`,
              );
            }
          }
        },
      );
      await sql(core);
      await t.test(
        "core installs disabled; absent guards and completion attestation block activation",
        async () => {
          await rejected(
            identity("authenticated") +
              "select * from public.reserve_managed_image('review-images','jpg');",
            /not activated/,
          );
          await rejected(
            "select public.activate_managed_image_lifecycle(false);",
            /completed-upload semantics/,
          );
          await rejected(
            "select public.activate_managed_image_lifecycle(true);",
            /Missing or altered restrictive Storage guard/,
          );
          assert.equal(
            await sql("select enabled from public.managed_image_control;"),
            "f",
          );
          await rejected(
            "set role authenticated;\n" + guards,
            /must be owner of table objects/,
          );
          assert.equal(
            await sql(
              "select count(*) from pg_policy where polname like 'managed_images_%';",
            ),
            "0",
          );
        },
      );
      await sql(guards);
      await t.test(
        "upload hardening requires the exact operation helper and a disabled lifecycle",
        async () => {
          await sql(
            "alter function storage.allow_only_operation(text) rename to fixture_allow_only_operation;",
          );
          try {
            const expected =
              /require storage\.allow_only_operation\(text\) returning boolean/;
            await rejected(uploadOperation, expected);
            for (const [argument, result, body] of [
              ["integer", "boolean", "select true"],
              ["text", "text", "select 'true'::text"],
              ["text", "setof boolean", "select true"],
            ]) {
              await sql(
                `create function storage.allow_only_operation(${argument}) returns ${result} language sql as ${quote(body)};`,
              );
              try {
                await rejected(uploadOperation, expected);
              } finally {
                await sql(
                  `drop function storage.allow_only_operation(${argument});`,
                );
              }
            }
          } finally {
            await sql(
              "alter function storage.fixture_allow_only_operation(text) rename to allow_only_operation;",
            );
          }
          await sql("update public.managed_image_control set enabled = true;");
          try {
            await rejected(uploadOperation, /lifecycle must be disabled/);
          } finally {
            await sql(
              "update public.managed_image_control set enabled = false;",
            );
          }
        },
      );
      const insertFunctionIdentity = `select row(p.oid, p.proowner, p.proacl)::text
        from pg_catalog.pg_proc p
        where p.oid = 'public.managed_image_storage_insert_allowed(text,text,text,uuid)'::regprocedure;`;
      const originalInsertFunction = await sql(insertFunctionIdentity);
      const reservationFunctionIdentity = `select row(p.oid, p.proowner, p.proacl)::text
        from pg_catalog.pg_proc p
        where p.oid = 'public.reserve_managed_image(text,text)'::regprocedure;`;
      const originalReservationFunction = await sql(
        reservationFunctionIdentity,
      );
      await sql(uploadOperation);
      await sql(reservationLimit);
      assert.equal(await sql(insertFunctionIdentity), originalInsertFunction);
      assert.equal(
        await sql(reservationFunctionIdentity),
        originalReservationFunction,
      );
      assert.equal(
        await sql("select enabled from public.managed_image_control;"),
        "f",
      );
      // Synthetic attestation is ONLY for this metadata stub; not a production
      // certification of Storage.upload, signed uploads, S3 or backend fencing.
      await sql("select public.activate_managed_image_lifecycle(true);");

      await t.test(
        "enabled, suspended or missing managed buckets fail every runtime RPC closed",
        async () => {
          const checks = [
            [
              identity("authenticated"),
              "perform public.reserve_managed_image('review-images', 'jpg');",
            ],
            [
              identity("authenticated"),
              `perform public.finalize_managed_image(${quote(LEGACY_ID)}::uuid);`,
            ],
            [
              identity("service_role"),
              "perform public.claim_managed_image_deletions(20);",
            ],
            [
              identity("service_role"),
              `perform public.acknowledge_managed_image_deletion(${quote(LEGACY_ID)}::uuid, ${quote(LEGACY_ID)}::uuid, true, null);`,
            ],
            ["", "perform public.activate_managed_image_lifecycle(true);"],
          ];
          for (const bucket of ["review-images", "profile-images"]) {
            for (const status of ["ENABLED", "SUSPENDED", null]) {
              const mutation =
                status === null
                  ? `delete from storage.buckets where id = ${quote(bucket)};`
                  : `update storage.buckets set versioning_status = ${quote(status)} where id = ${quote(bucket)};`;
              await sql(`begin; ${mutation}
                ${checks
                  .map(
                    ([caller, command]) => `${caller}
                  do $test$ begin
                    begin ${command}
                    exception when others then
                      if sqlerrm not like '%Both managed image buckets must have versioning DISABLED%' then raise; end if;
                      return;
                    end;
                    raise exception 'Unverified bucket configuration unexpectedly allowed a lifecycle RPC';
                  end $test$;
                  reset role;`,
                  )
                  .join("\n")}
                rollback;`);
            }
          }
          assert.equal(
            await sql(
              "select count(*) from storage.buckets where versioning_status = 'DISABLED';",
            ),
            "2",
          );
        },
      );

      await t.test(
        "actual partial indexes uniquely constrain current rows, unversioned rows and null version tokens",
        async () => {
          for (const [
            suffix,
            firstVersion,
            secondVersion,
            archived,
            versioned,
            constraint,
          ] of [
            [
              "current",
              "first",
              "second",
              false,
              true,
              "idx_objects_current_version",
            ],
            [
              "unversioned",
              "first",
              "second",
              true,
              false,
              "idx_objects_null_version",
            ],
            [
              "version",
              "same",
              "same",
              true,
              true,
              "objects_bucket_id_name_version_key",
            ],
            [
              "null-version",
              null,
              null,
              true,
              true,
              "objects_bucket_id_name_version_key",
            ],
          ] as const) {
            const path = `${OWNER}/schema-contract-${suffix}.jpg`;
            const values = (version: string | null) =>
              `('review-images', ${quote(path)}, ${version === null ? "null" : quote(version)}, ${archived ? "clock_timestamp()" : "null"}, ${versioned})`;
            await sql(
              `insert into storage.objects (bucket_id, name, version, archived_at, is_versioned) values ${values(firstVersion)};`,
            );
            await rejected(
              `insert into storage.objects (bucket_id, name, version, archived_at, is_versioned) values ${values(secondVersion)};`,
              new RegExp(constraint),
            );
            assert.equal(
              await sql(
                `select count(*) from storage.objects where name = ${quote(path)};`,
              ),
              "1",
            );
          }
        },
      );

      await t.test(
        "API roles cannot write registry, ledger, pins/control or worker RPCs",
        async () => {
          for (const table of [
            "managed_image_assets",
            "managed_image_references",
            "managed_image_legacy_ids",
            "managed_image_control",
            "managed_image_reservation_owners",
          ]) {
            await rejected(
              identity("authenticated") + `delete from public.${table};`,
              /permission denied/,
            );
            await rejected(
              identity("service_role") + `delete from public.${table};`,
              /permission denied/,
            );
          }
          await rejected(
            identity("anon") +
              "select * from public.reserve_managed_image('review-images','jpg');",
            /permission denied/,
          );
          await rejected(
            identity("authenticated") +
              "select * from public.claim_managed_image_deletions();",
            /permission denied/,
          );
          await rejected(
            identity("authenticated") +
              "select public.activate_managed_image_lifecycle(true);",
            /permission denied/,
          );
          await rejected(
            identity("authenticated") +
              "select * from public.reserve_managed_image('refill-spot-images','jpg');",
            /Unsupported/,
          );
        },
      );

      await t.test(
        "legacy prefix-shaped names are pinned, attachable and never adopted",
        async () => {
          assert.equal(
            await sql(
              `select count(*) from public.managed_image_legacy_ids where asset_id = ${quote(LEGACY_ID)}::uuid;`,
            ),
            "1",
          );
          await sql(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(LEGACY_URL)} where id = ${quote(OWNER)}::uuid;
        update storage.objects set metadata = metadata || '{"legacy":true}'::jsonb where name = ${quote(LEGACY_PATH)};`,
          );
          assert.equal(
            await sql("select count(*) from public.managed_image_assets;"),
            "0",
          );
          assert.deepEqual(await claim(), []);
          await rejected(
            `insert into public.managed_image_assets (asset_id, owner_id, bucket_id, extension, object_path)
        values (${quote(LEGACY_ID)}::uuid, ${quote(OWNER)}::uuid, 'review-images', 'jpg', ${quote(LEGACY_PATH)});`,
            /non-legacy/,
          );
        },
      );

      await t.test(
        "reservation quota is per owner across buckets and cannot be bypassed by API roles",
        async () => {
          const owner = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
          const other = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
          await sql(`${identity("authenticated", owner)}
            do $test$ begin
              for i in 1..20 loop
                perform public.reserve_managed_image(
                  case when i % 2 = 0 then 'profile-images' else 'review-images' end, 'jpg');
              end loop;
            end $test$;`);
          for (const bucket of ["review-images", "profile-images"]) {
            await rejected(
              identity("authenticated", owner) +
                `select * from public.reserve_managed_image(${quote(bucket)}, 'webp');`,
              /reservation limit reached/,
            );
          }
          await sql(
            identity("authenticated", other) +
              "select * from public.reserve_managed_image('review-images', 'png');",
          );
          assert.equal(
            await sql(`select count(*) from public.managed_image_assets
            where owner_id = ${quote(owner)}::uuid and state = 'uploading';`),
            "20",
          );
          assert.equal(
            await sql(`select count(*) from public.managed_image_assets
            where owner_id = ${quote(other)}::uuid and state = 'uploading';`),
            "1",
          );
          for (const role of [
            "anon",
            "authenticated",
            "service_role",
          ] as const) {
            for (const command of [
              "select * from public.managed_image_reservation_owners for update;",
              `insert into public.managed_image_reservation_owners values (${quote(owner)}::uuid);`,
              "update public.managed_image_reservation_owners set owner_id = owner_id;",
              "truncate public.managed_image_reservation_owners;",
              `insert into public.managed_image_assets (asset_id, owner_id, bucket_id, extension, object_path)
                values (gen_random_uuid(), ${quote(owner)}::uuid, 'review-images', 'jpg', 'bypass');`,
            ]) {
              await rejected(
                identity(role, owner) + command,
                /permission denied/,
              );
            }
          }
          await rejected(
            identity("service_role", owner) +
              "select * from public.reserve_managed_image('review-images', 'jpg');",
            /permission denied/,
          );
          await rejected(
            identity("authenticated", "") +
              "select * from public.reserve_managed_image('review-images', 'jpg');",
            /Authenticated image owner required/,
          );

          // Finalizing a proven completed upload frees exactly one slot.
          const [asset] =
            await jsonRows<ManagedImageReservation>(`select asset_id, bucket_id,
            object_path, canonical_url, state from public.managed_image_assets
            where owner_id = ${quote(owner)}::uuid limit 1`);
          await sql(`${identity("authenticated", owner)} set storage.operation = 'object.upload';
            insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
            values (${quote(asset.bucket_id)}, ${quote(asset.object_path)}, ${quote(owner)}::uuid,
              ${quote(owner)}, '{"mimetype":"image/jpeg","size":128}'::jsonb);
            select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid);
            select * from public.reserve_managed_image('profile-images', 'jpg');`);
          await rejected(
            identity("authenticated", owner) +
              "select * from public.reserve_managed_image('review-images', 'jpg');",
            /reservation limit reached/,
          );
        },
      );

      await t.test(
        "concurrent direct RPC admissions serialize and stale snapshots cannot exceed quota",
        async () => {
          for (const [isolation, owner, initial, expected] of [
            [
              "read committed",
              "cccccccc-cccc-4ccc-9ccc-cccccccccccc",
              19,
              /reservation limit reached/,
            ],
            [
              "repeatable read",
              "dddddddd-dddd-4ddd-9ddd-dddddddddddd",
              19,
              /could not serialize access/,
            ],
            [
              "read committed",
              "cccccccc-cccc-4ccc-accc-cccccccccccc",
              0,
              /reservation limit reached/,
            ],
          ] as const) {
            await sql(`${identity("authenticated", owner)}
              do $test$ begin for i in 1..${initial} loop
                perform public.reserve_managed_image('review-images', 'jpg');
              end loop; end $test$;`);
            const holder = session(
              `quota_holder_${isolation.replaceAll(" ", "_")}`,
            );
            const name = `quota_waiter_${isolation.replaceAll(" ", "_")}`;
            const waiter = session(name);
            try {
              waiter.send(`begin isolation level ${isolation}; ${identity("authenticated", owner)}
                select count(*) from public.profiles; select 'quota-snapshot';`);
              await waiter.marker("quota-snapshot");
              holder.send(`begin; ${identity("authenticated", owner)}
                do $test$ begin for i in 1..${20 - initial} loop
                  perform public.reserve_managed_image('review-images', 'jpg');
                end loop; end $test$;
                select 'quota-held';`);
              await holder.marker("quota-held");
              waiter.send(
                "select * from public.reserve_managed_image('profile-images', 'png'); commit;\n\\q",
              );
              await waitForLock(name);
              // A different owner is not blocked by the held admission lock.
              await sql(
                identity("authenticated", OTHER) +
                  "select * from public.reserve_managed_image('review-images', 'jpg');",
              );
              holder.send("commit;\n\\q");
              assert.equal((await holder.done).code, 0);
              const denied = await waiter.done;
              assert.notEqual(denied.code, 0);
              assert.match(denied.stderr, expected);
              assert.equal(
                await sql(`select count(*) from public.managed_image_assets
                where owner_id = ${quote(owner)}::uuid and state = 'uploading';`),
                "20",
              );
            } finally {
              holder.close();
              waiter.close();
            }
          }
        },
      );

      await t.test(
        "managed INSERT admits only standard uploads, never signing, signed-upload or missing operations",
        async () => {
          const deniedOperations = [
            "object.sign_upload_url",
            "object.upload_signed",
            "sign_upload_url",
            "upload_signed",
            "object.upload.other",
            "",
            null,
          ];
          for (const bucket of ["review-images", "profile-images"]) {
            const asset = await reserve(bucket);
            for (const operation of deniedOperations) {
              // Each execute opens a new session, so null leaves the operation
              // genuinely absent rather than inheriting an earlier upload.
              await rejected(
                identity("authenticated") +
                  insertObject(asset, undefined, operation),
                /row-level security/,
              );
            }
            assert.equal(
              await sql(
                `select count(*) from storage.objects where bucket_id = ${quote(bucket)} and name = ${quote(asset.object_path)};`,
              ),
              "0",
            );
            await sql(identity("authenticated") + insertObject(asset));
            const rows = await jsonRows(
              `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid)`,
              identity("authenticated"),
            );
            assert.ok(parseManagedImageFinalization(rows, asset));
            for (const operation of deniedOperations) {
              await rejected(
                identity("authenticated") +
                  insertObject(asset, undefined, operation),
                /row-level security/,
              );
            }
          }
          for (const [index, operation] of deniedOperations.entries()) {
            const operationSetting =
              operation === null
                ? ""
                : `set storage.operation = ${quote(operation)};`;
            const path = `${OWNER}/legacy-operation-${index}.jpg`;
            await sql(`${identity("authenticated")} ${operationSetting}
              insert into storage.objects (bucket_id, name, owner, owner_id)
              values ('review-images', ${quote(path)}, ${quote(OWNER)}::uuid, ${quote(OWNER)});`);
            const updated = await jsonRows<{ name: string }>(
              `update storage.objects set metadata = metadata || '{"operationGuardLegacy":true}'::jsonb
                where name = ${quote(LEGACY_PATH)} returning name`,
              identity("authenticated") + operationSetting,
            );
            assert.deepEqual(updated, [{ name: LEGACY_PATH }]);
          }
        },
      );

      await t.test(
        "reserve/finalize enforce owner, metadata, immutable keys and idempotency",
        async () => {
          const asset = await reserve();
          await rejected(
            identity("authenticated") +
              `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid);`,
            /unverified/,
          );
          await rejected(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;`,
            /not attachable: uploading/,
          );
          await rejected(
            identity("authenticated", OTHER) + insertObject(asset),
            /row-level security/,
          );
          await sql(
            identity("authenticated") + insertObject(asset, '{"size":128}'),
          );
          await rejected(
            identity("authenticated") +
              `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid);`,
            /metadata is unverified/,
          );
          await sql(
            `update storage.objects set metadata = '{"mimetype":"image/jpeg","size":128}'::jsonb where name = ${quote(asset.object_path)};`,
          );
          await rejected(
            identity("authenticated", OTHER) +
              `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid);`,
            /not owned/,
          );
          const first = await jsonRows(
            `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid)`,
            identity("authenticated"),
          );
          const second = await jsonRows(
            `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid)`,
            identity("authenticated"),
          );
          assert.deepEqual(first, second);
          await rejected(
            `update public.managed_image_assets set owner_id = ${quote(OTHER)}::uuid where asset_id = ${quote(asset.asset_id)}::uuid;`,
            /immutable/,
          );
          assert.equal(await count(asset), "0:0");
        },
      );

      await t.test(
        "archived history, delete markers and versioned current rows cannot finalize or count as current",
        async () => {
          const asset = await reserve();
          const finalize = `select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid)`;
          for (const version of ["history-first", "history-second"]) {
            await sql(identity("authenticated") + insertObject(asset));
            await sql(`update storage.objects set version = ${quote(version)}, archived_at = clock_timestamp()
              where bucket_id = ${quote(asset.bucket_id)} and name = ${quote(asset.object_path)} and archived_at is null;`);
            await rejected(
              identity("authenticated") + finalize + ";",
              /current unversioned non-delete-marker object is unverified/,
            );
            assert.equal(await count(asset), "0:0");
            await sql(
              `update storage.objects set is_versioned = true where name = ${quote(asset.object_path)} and version = ${quote(version)};`,
            );
          }
          await rejected(
            identity("authenticated") + finalize + ";",
            /current unversioned non-delete-marker object is unverified/,
          );
          await rejected(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;`,
            /not attachable: uploading/,
          );
          assert.equal(await count(asset), "0:0");
          assert.ok(
            !(await claim()).some((entry) => entry.asset_id === asset.asset_id),
          );
          await sql(identity("authenticated") + insertObject(asset));
          for (const flags of [
            "is_delete_marker = true, is_versioned = false",
            "is_delete_marker = true, is_versioned = true",
            "is_delete_marker = false, is_versioned = true",
          ]) {
            await sql(
              `update storage.objects set ${flags} where name = ${quote(asset.object_path)} and archived_at is null;`,
            );
            await rejected(
              identity("authenticated") + finalize + ";",
              /current unversioned non-delete-marker object is unverified/,
            );
            assert.equal(await count(asset), "0:0");
          }
          await sql(`update storage.objects set is_versioned = false, version = 'unversioned-backend-identifier'
            where name = ${quote(asset.object_path)} and archived_at is null;`);
          const currentId = await sql(
            `select id from storage.objects where name = ${quote(asset.object_path)} and archived_at is null;`,
          );
          const rows = await jsonRows(finalize, identity("authenticated"));
          assert.equal(
            parseManagedImageFinalization(rows, asset)?.storage_object_id,
            currentId,
          );
          assert.equal(
            await sql(
              `select count(*) from storage.objects where name = ${quote(asset.object_path)};`,
            ),
            "3",
          );
          await sql(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;`,
          );
          assert.equal(await count(asset), "1:1");
          await sql(
            identity("authenticated") +
              `update public.profiles set avatar_url = null where id = ${quote(OWNER)}::uuid;`,
          );
        },
      );

      await t.test(
        "NoSuchKey cannot justify positive acknowledgement over hidden archived, versioned or delete-marker metadata",
        async () => {
          const asset = await ready();
          await makeDue(asset);
          const lease = (await claim()).find(
            (entry) => entry.asset_id === asset.asset_id,
          );
          assert.ok(lease);
          // The default-path info API may hide these rows behind NoSuchKey.
          // This suite tests the SQL veto, not actual Storage API semantics.
          for (const mutation of [
            `update storage.objects set archived_at = clock_timestamp() where id = ${quote(lease.storage_object_id)}::uuid;`,
            `update storage.objects set is_versioned = true where id = ${quote(lease.storage_object_id)}::uuid;`,
            `update storage.objects set is_delete_marker = true where id = ${quote(lease.storage_object_id)}::uuid;`,
            `insert into storage.objects (bucket_id, name, version, archived_at, is_versioned)
              values (${quote(lease.bucket_id)}, ${quote(lease.object_path)}, 'hidden-history', clock_timestamp(), true);`,
            `update storage.objects set archived_at = clock_timestamp(), is_versioned = true where id = ${quote(lease.storage_object_id)}::uuid;
              insert into storage.objects (bucket_id, name, version, is_versioned, is_delete_marker)
                values (${quote(lease.bucket_id)}, ${quote(lease.object_path)}, 'new-delete-marker', true, true);`,
          ]) {
            const state = await sql(`begin;
              ${mutation}
              ${identity("service_role")}
              do $test$ begin
                begin perform public.acknowledge_managed_image_deletion(${quote(lease.asset_id)}::uuid, ${quote(lease.lease_token)}::uuid, true, null);
                exception when others then
                  if sqlerrm not like '%archived/versioned/delete-marker metadata prevents deletion acknowledgement%' then raise; end if;
                  return;
                end;
                raise exception 'Hidden Storage version metadata unexpectedly allowed a positive acknowledgement';
              end $test$;
              reset role;
              select state from public.managed_image_assets where asset_id = ${quote(asset.asset_id)}::uuid;
              rollback;`);
            assert.equal(state, "deleting");
          }
          await acknowledge(lease, false);
        },
      );

      await t.test(
        "all three sinks count unique references and preserve transaction rollback/cascades",
        async () => {
          const asset = await ready();
          const store = rowId++;
          const review = rowId++;
          await sql(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;
        insert into public.stores values (${store}, array[${quote(asset.canonical_url)},${quote(asset.canonical_url)}]);
        insert into public.reviews values (${review}, ${quote(OWNER)}::uuid, ${store}, array[${quote(asset.canonical_url)}]);`,
          );
          assert.equal(await count(asset), "3:3");
          const temporaryProfile = "12121212-1212-4212-8212-121212121212";
          const cascadeReview = rowId++;
          await sql(
            identity("authenticated") +
              `insert into public.profiles values (${quote(temporaryProfile)}::uuid, ${quote(asset.canonical_url)});
        insert into public.reviews values (${cascadeReview}, ${quote(temporaryProfile)}::uuid, ${store}, array[${quote(asset.canonical_url)}]);`,
          );
          assert.equal(await count(asset), "5:5");
          await sql(
            identity("authenticated") +
              `delete from public.profiles where id = ${quote(temporaryProfile)}::uuid;
        update public.stores set image_urls = array[${quote(asset.canonical_url)}] where id = ${store};`,
          );
          assert.equal(await count(asset), "3:3");
          await sql(
            identity("authenticated") +
              `update public.reviews set image_urls = array[]::text[] where id = ${review};`,
          );
          assert.equal(await count(asset), "2:2");
          await sql(
            identity("authenticated") +
              `update public.reviews set image_urls = array[${quote(asset.canonical_url)}] where id = ${review};`,
          );
          await sql(
            identity("authenticated") +
              `begin; update public.profiles set avatar_url = null where id = ${quote(OWNER)}::uuid; rollback;`,
          );
          assert.equal(await count(asset), "3:3");
          await sql(
            identity("authenticated") +
              `update public.reviews set id = ${review + 10000} where id = ${review};`,
          );
          assert.equal(await count(asset), "3:3");
          await sql(
            identity("authenticated") +
              `delete from public.stores where id = ${store};`,
          );
          assert.equal(await count(asset), "1:1");
          await sql(
            identity("authenticated") +
              `update public.profiles set avatar_url = null where id = ${quote(OWNER)}::uuid;`,
          );
          assert.equal(await count(asset), "0:0");
          assert.equal(
            await sql(
              `select cleanup_after > clock_timestamp() from public.managed_image_assets where asset_id = ${quote(asset.asset_id)}::uuid;`,
            ),
            "t",
          );
          await rejected("truncate public.reviews;", /TRUNCATE would bypass/);
        },
      );

      await t.test(
        "aliases and unreserved names are rejected on direct DML",
        async () => {
          const asset = await ready();
          for (const alias of [
            asset.canonical_url + "?download=1",
            asset.canonical_url.replace("managed-", "%6danaged-"),
            asset.canonical_url.replace("/managed-", "/x/../managed-"),
            asset.canonical_url.replace("public/", "sign/"),
            asset.canonical_url.replace(
              "ykztepbfcocxmtotrdbk",
              "untrusted-project",
            ),
          ]) {
            await rejected(
              identity("authenticated") +
                `update public.profiles set avatar_url = ${quote(alias)} where id = ${quote(OWNER)}::uuid;`,
              /exact project canonical URL/,
            );
          }
          await rejected(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url.replace(asset.asset_id, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"))} where id = ${quote(OWNER)}::uuid;`,
            /no reservation/,
          );
          assert.equal(await count(asset), "0:0");
        },
      );

      await t.test(
        "browser-stripped controls are detected and rejected in all three reference sinks",
        async () => {
          const asset = await ready();
          for (const control of ["\t", "\n", "\r"]) {
            for (const alias of [
              asset.canonical_url.replace("managed-", `man${control}aged-`),
              asset.canonical_url.replace(
                asset.asset_id,
                `${asset.asset_id.slice(0, 12)}${control}${asset.asset_id.slice(12)}`,
              ),
              asset.canonical_url.replace(".jpg", `.j${control}pg`),
            ]) {
              assert.equal(new URL(alias).href, asset.canonical_url);
              assert.equal(
                await sql(
                  `select public.managed_image_candidate_ids(${quote(alias)})::text;`,
                ),
                asset.asset_id,
              );
              for (const mutation of [
                `update public.profiles set avatar_url = ${quote(alias)} where id = ${quote(OWNER)}::uuid;`,
                `update public.stores set image_urls = array[${quote(alias)}] where id = 1;`,
                `insert into public.reviews values (987654, ${quote(OWNER)}::uuid, 1, array[${quote(alias)}]);`,
              ]) {
                await rejected(
                  identity("authenticated") + mutation,
                  /exact project canonical URL/,
                );
              }
            }
          }
          assert.equal(await count(asset), "0:0");
        },
      );

      await t.test(
        "restrictive Storage guards block managed overwrite/delete/move but preserve legacy access",
        async () => {
          const asset = await ready();
          const updates = await jsonRows(
            `update storage.objects set metadata = metadata || '{"changed":true}'::jsonb
        where name = ${quote(asset.object_path)} returning id`,
            identity("authenticated"),
          );
          assert.deepEqual(updates, []);
          const deletes = await jsonRows(
            `delete from storage.objects where name = ${quote(asset.object_path)} returning id`,
            identity("authenticated"),
          );
          assert.deepEqual(deletes, []);
          await rejected(
            identity("authenticated") + insertObject(asset),
            /row-level security/,
          );
          await rejected(
            identity("authenticated") +
              `update storage.objects set name = ${quote(`${OWNER}/managed-dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg`)} where name = ${quote(LEGACY_PATH)};`,
            /row-level security/,
          );
          assert.equal(
            await sql(
              `select count(*) from storage.objects where name = ${quote(asset.object_path)};`,
            ),
            "1",
          );
        },
      );

      await t.test(
        "old uploading reservations remain protected irrespective of age",
        async () => {
          const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
          await sql(`insert into public.managed_image_assets (asset_id, owner_id, bucket_id, extension, object_path, created_at)
        values (${quote(id)}::uuid, ${quote(OWNER)}::uuid, 'review-images', 'jpg',
        ${quote(`${OWNER}/managed-${id}.jpg`)}, '1970-01-01T00:00:00Z');`);
          assert.deepEqual(await claim(), []);
          assert.equal(
            await sql(
              `select state from public.managed_image_assets where asset_id = ${quote(id)}::uuid;`,
            ),
            "uploading",
          );
        },
      );

      await t.test(
        "ready-only claims, retry leases, stale acknowledgements and permanent tombstones",
        async () => {
          const asset = await ready();
          await makeDue(asset);
          const [first] = await claim();
          assert.equal(first.asset_id, asset.asset_id);
          assert.deepEqual(await claim(), []);
          const [failed] = await acknowledge(first, false);
          assert.equal(failed.state, "deleting");
          assert.ok(failed.retry_after);
          assert.deepEqual(await claim(), []);
          await rejected(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;`,
            /not attachable: deleting/,
          );
          await sql(
            `update public.managed_image_assets set retry_after = clock_timestamp() - interval '1 second' where asset_id = ${quote(asset.asset_id)}::uuid;`,
          );
          const [second] = await claim();
          assert.notEqual(second.lease_token, first.lease_token);
          assert.equal(second.attempt_count, 2);
          await rejected(
            identity("service_role") +
              `select * from public.acknowledge_managed_image_deletion(${quote(first.asset_id)}::uuid,${quote(first.lease_token)}::uuid,true);`,
            /stale or expired/,
          );
          await sql(
            `update public.managed_image_assets set lease_expires_at = clock_timestamp() - interval '1 second' where asset_id = ${quote(asset.asset_id)}::uuid;`,
          );
          await rejected(
            identity("service_role") +
              `select * from public.acknowledge_managed_image_deletion(${quote(second.asset_id)}::uuid,${quote(second.lease_token)}::uuid,true);`,
            /stale or expired/,
          );
          const [third] = await claim();
          const acknowledged = await acknowledge(third, true);
          assert.deepEqual(await acknowledge(third, true), acknowledged);
          assert.equal(acknowledged[0].state, "deleted");
          await rejected(
            `update public.managed_image_assets set state = 'ready' where asset_id = ${quote(asset.asset_id)}::uuid;`,
            /irreversible/,
          );
          await rejected(
            `delete from public.managed_image_assets where asset_id = ${quote(asset.asset_id)}::uuid;`,
            /cannot be deleted/,
          );
          await rejected(
            "truncate public.managed_image_assets cascade;",
            /TRUNCATE would bypass/,
          );
          await rejected(
            identity("authenticated") +
              `update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;`,
            /not attachable: deleted/,
          );
          assert.equal(
            await sql(
              `select count(*) from storage.objects where name = ${quote(asset.object_path)};`,
            ),
            "1",
            "DB acknowledgement never deletes Storage metadata",
          );
        },
      );

      await t.test(
        "claim-first rejects a trigger whose READ COMMITTED statement snapshot predates claim commit",
        async () => {
          const asset = await ready();
          await makeDue(asset);
          const holder = session("lifecycle_claim_holder");
          const writer = session("lifecycle_stale_attach");
          try {
            holder.send(
              `begin; ${identity("service_role")} select * from public.claim_managed_image_deletions(20); select 'claim-held';`,
            );
            await holder.marker("claim-held");
            writer.send(
              `${identity("authenticated")} update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid;\n\\q`,
            );
            await waitForLock("lifecycle_stale_attach");
            holder.send("commit;\n\\q");
            const denied = await writer.done;
            assert.notEqual(denied.code, 0);
            assert.match(denied.stderr, /not attachable: deleting/);
            assert.equal(await count(asset), "0:0");
            assert.equal(
              await sql(
                `select state from public.managed_image_assets where asset_id = ${quote(asset.asset_id)}::uuid;`,
              ),
              "deleting",
            );
          } finally {
            holder.close();
            writer.close();
          }
        },
      );

      await t.test(
        "attach-first holds the asset lock; worker skips it and later observes the reference",
        async () => {
          const asset = await ready();
          await makeDue(asset);
          const holder = session("lifecycle_attach_holder");
          try {
            holder.send(
              `begin; ${identity("authenticated")} update public.profiles set avatar_url = ${quote(asset.canonical_url)} where id = ${quote(OWNER)}::uuid; select 'attach-held';`,
            );
            await holder.marker("attach-held");
            assert.deepEqual(await claim(), []);
            holder.send("commit;\n\\q");
            assert.equal((await holder.done).code, 0);
            assert.deepEqual(await claim(), []);
            assert.equal(await count(asset), "1:1");
            await sql(
              identity("authenticated") +
                `update public.profiles set avatar_url = null where id = ${quote(OWNER)}::uuid;`,
            );
          } finally {
            holder.close();
          }
        },
      );

      await t.test(
        "Storage INSERT guard waits on the same row and rejects a stale uploading snapshot",
        async () => {
          const asset = await reserve();
          await sql(identity("authenticated") + insertObject(asset));
          const finalizer = session("lifecycle_finalize_holder");
          const writer = session("lifecycle_stale_storage_insert");
          try {
            finalizer.send(
              `begin; ${identity("authenticated")} select * from public.finalize_managed_image(${quote(asset.asset_id)}::uuid); select 'finalize-held';`,
            );
            await finalizer.marker("finalize-held");
            writer.send(
              identity("authenticated") + insertObject(asset) + "\n\\q",
            );
            await waitForLock("lifecycle_stale_storage_insert");
            finalizer.send("commit;\n\\q");
            const denied = await writer.done;
            assert.notEqual(denied.code, 0);
            assert.match(denied.stderr, /row-level security/);
          } finally {
            finalizer.close();
            writer.close();
          }
        },
      );

      await t.test(
        "after activation, an altered policy definition or disabled trigger fails closed",
        async () => {
          const missingGuardCheck = `do $test$ begin
        begin perform public.reserve_managed_image('review-images','jpg');
        exception when others then
          if sqlerrm not like '%Missing or altered restrictive Storage guard%' then raise; end if;
          return;
        end;
        raise exception 'An altered Storage guard unexpectedly allowed a reservation';
      end $test$;`;
          await sql(`begin; set request.jwt.claim.role = 'authenticated'; set request.jwt.claim.sub = ${quote(OWNER)};
        alter policy managed_images_insert_guard on storage.objects with check (true);
        ${missingGuardCheck} rollback;`);
          await sql(`begin; set request.jwt.claim.role = 'authenticated'; set request.jwt.claim.sub = ${quote(OWNER)};
        drop policy managed_images_insert_guard on storage.objects;
        create policy managed_images_insert_guard on storage.objects as permissive for insert to public
          with check (public.managed_image_storage_insert_allowed(bucket_id,name,owner_id,owner));
        ${missingGuardCheck} rollback;`);
          await sql(`begin; alter table public.reviews disable trigger managed_image_review_references;
        do $test$ begin
          begin perform public.activate_managed_image_lifecycle(true);
          exception when others then
            if sqlerrm not like '%Missing or altered managed image reference trigger%' then raise; end if;
            return;
          end;
          raise exception 'A disabled reference trigger unexpectedly allowed activation';
        end $test$; rollback;`);
        },
      );
    } finally {
      await sql(`drop database ${database} with (force);`, "postgres");
    }
  },
);
