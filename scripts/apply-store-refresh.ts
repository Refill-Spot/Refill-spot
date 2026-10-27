import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  buildStoreRefreshPlan,
  verifyStoreRefreshResult,
  type StoreLiveVerification,
  type StoreRefreshDecision,
  type StoreRefreshPlan,
  type StoreRefreshRow,
  type StoreRefreshUpdates,
  type StoreSourceMapping,
} from "../lib/store-refresh";

const usage = `Usage: node --import tsx scripts/apply-store-refresh.ts [--apply] [--resume]
  [--observations logs/store-live-verification.json]
  [--mapping logs/recovered-source-links.json]
  [--report logs/store-refresh-apply.json] [--config-env .env]

Default: dry-run; loads all 439 current database rows, never writes the database.
--apply requires SUPABASE_SERVICE_ROLE_KEY and saves an exclusive full backup first.
Every update uses an identity/updated_at compare-and-set and full-row read-back.
Coordinate CAS bounds allow only +/-1e-10 numeric serialization error.
refill_items accepts only confirmed explicit main_meal/buffet offerings with evidence.
General menuItems stay local staging; side-refill offerings are never published here.
--resume regenerates from current rows and current observation files, not saved updates.
Interrupted/unverified prior writes are held for review, never automatically retried.
No deletions, inferred coordinates, ratings/photos updates or currentness assertions.
`;

type ReceiptStatus =
  | "held"
  | "planned"
  | "write_pending"
  | "written_unverified"
  | "applied"
  | "conflict"
  | "failed";
interface Receipt {
  storeId: number;
  sourceId?: string;
  status: ReceiptStatus;
  reason: string;
  fields: StoreRefreshDecision["fields"];
  updates: StoreRefreshUpdates;
  observedAt?: string;
  attemptedAt?: string;
  verifiedAt?: string;
  invalidatedPlaceIds?: string[];
  verificationMismatches?: string[];
  after?: StoreRefreshRow;
}
interface PreviousReport {
  version: number;
  runId: string;
  receipts: Array<{ storeId: number; status: ReceiptStatus }>;
}

class RefreshFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readJson(path: string, code: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new RefreshFailure(code);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      resume: { type: "boolean", default: false },
      observations: {
        type: "string",
        default: "logs/store-live-verification.json",
      },
      mapping: { type: "string", default: "logs/recovered-source-links.json" },
      report: { type: "string", default: "logs/store-refresh-apply.json" },
      "config-env": { type: "string", default: ".env" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  try {
    process.loadEnvFile(values["config-env"]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new RefreshFailure("environment-file-unavailable");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = values.apply
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new RefreshFailure(
      "database-credentials-missing-apply-requires-service-role",
    );
  const observations = (await readJson(
    values.observations!,
    "observations-file-invalid",
  )) as StoreLiveVerification;
  const mapping = (await readJson(
    values.mapping!,
    "mapping-file-invalid",
  )) as StoreSourceMapping;
  const reportPath = resolve(values.report!);
  if (
    [values.observations!, values.mapping!, values["config-env"]!].some(
      (path) => resolve(path) === reportPath,
    )
  )
    throw new RefreshFailure("report-must-not-overwrite-inputs");
  let previous: PreviousReport | undefined;
  if (values.resume) {
    const saved = (await readJson(
      reportPath,
      "resume-report-unavailable",
    )) as PreviousReport;
    if (
      saved?.version !== 1 ||
      typeof saved.runId !== "string" ||
      !Array.isArray(saved.receipts) ||
      saved.receipts.some(
        (receipt) =>
          !receipt ||
          !Number.isSafeInteger(receipt.storeId) ||
          typeof receipt.status !== "string",
      )
    )
      throw new RefreshFailure("resume-report-invalid");
    previous = saved;
  }
  // Disable automatic mutation retries, including SDK retries on transient failures.
  const db = createClient(url, key, {
    db: { retry: false },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }),
    },
  });
  const stores: StoreRefreshRow[] = [];
  let expectedTotal: number | undefined;
  for (let offset = 0; ; offset += 200) {
    const { data, error, count } = await db
      .from("stores")
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(offset, offset + 199);
    if (error || !data || typeof count !== "number")
      throw new RefreshFailure("database-snapshot-read-failed");
    if (expectedTotal === undefined) expectedTotal = count;
    if (count !== expectedTotal)
      throw new RefreshFailure("database-count-changed-during-snapshot");
    stores.push(...(data as StoreRefreshRow[]));
    if (stores.length >= expectedTotal) break;
    if (data.length !== 200)
      throw new RefreshFailure("database-pagination-incomplete");
  }
  if (
    stores.length !== 439 ||
    stores.length !== expectedTotal ||
    new Set(stores.map((store) => store.id)).size !== stores.length
  )
    throw new RefreshFailure("expected-all-439-unique-stores");
  if (
    stores.some(
      (store) =>
        !Number.isSafeInteger(store.id) ||
        typeof store.name !== "string" ||
        typeof store.address !== "string" ||
        typeof store.updated_at !== "string" ||
        !(
          store.phone_number === null || typeof store.phone_number === "string"
        ) ||
        !Object.hasOwn(store, "position_lat") ||
        !Object.hasOwn(store, "position_lng"),
    )
  )
    throw new RefreshFailure("database-snapshot-contract-invalid");
  let plan: StoreRefreshPlan;
  try {
    plan = buildStoreRefreshPlan(stores, mapping, observations);
  } catch {
    throw new RefreshFailure("refresh-input-contract-invalid");
  }
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  const backupPath = `${reportPath}.${runId}.backup.json`;
  const unfinished = new Set(
    previous?.receipts
      .filter((receipt) =>
        ["write_pending", "written_unverified", "failed"].includes(
          receipt.status,
        ),
      )
      .map((receipt) => receipt.storeId) ?? [],
  );
  const receipts: Receipt[] = plan.rows.map((row) => ({
    storeId: row.storeId,
    sourceId: row.sourceId,
    observedAt: row.observedAt,
    status: unfinished.has(row.storeId)
      ? "held"
      : row.status === "update"
        ? "planned"
        : "held",
    reason: unfinished.has(row.storeId)
      ? "previous-write-unverified-review-required"
      : row.reason,
    fields: row.fields,
    updates: row.updates,
  }));
  const counts = () => {
    const changed = receipts.filter((receipt) => receipt.status === "applied");
    const planned = receipts.filter((receipt) => receipt.status === "planned");
    const coordinates = (receipt: Receipt) =>
      ["position_lat", "position_lng", "position_x", "position_y", "geom"].some(
        (field) => Object.hasOwn(receipt.updates, field),
      );
    return {
      total: receipts.length,
      changed: changed.length,
      planned: planned.length,
      held: receipts.filter((receipt) => receipt.status === "held").length,
      conflicts: receipts.filter((receipt) => receipt.status === "conflict")
        .length,
      unverified: receipts.filter((receipt) =>
        ["write_pending", "written_unverified", "failed"].includes(
          receipt.status,
        ),
      ).length,
      coordinateUpdated: changed.filter(coordinates).length,
      coordinatePlanned: planned.filter(coordinates).length,
      coordinateSkipped: receipts.length - changed.filter(coordinates).length,
      placeIdsInvalidated: changed.reduce(
        (sum, receipt) => sum + (receipt.invalidatedPlaceIds?.length ?? 0),
        0,
      ),
    };
  };
  await mkdir(dirname(reportPath), { recursive: true });
  // Exclusive and complete before the first remote write; never overwrite a backup.
  await writeFile(
    backupPath,
    JSON.stringify(
      {
        version: 1,
        runId,
        createdAt: plan.generatedAt,
        mode: values.apply ? "apply" : "dry-run",
        rows: stores,
        mapping,
        observations,
        plan,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  let phase = values.apply ? "applying" : "dry-run";
  let failureCode: string | undefined;
  async function checkpoint() {
    const temporary = `${reportPath}.${runId}.tmp`;
    await writeFile(
      temporary,
      JSON.stringify(
        {
          version: 1,
          runId,
          previousRunId: previous?.runId,
          updatedAt: new Date().toISOString(),
          generatedAt: plan.generatedAt,
          mode: values.apply ? "apply" : "dry-run",
          phase,
          failureCode,
          backup: backupPath,
          allStoresAccounted: receipts.length === stores.length,
          counts: counts(),
          receipts,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    await rename(temporary, reportPath);
  }
  await checkpoint();
  if (values.apply) {
    try {
      for (let index = 0; index < stores.length; index++) {
        const receipt = receipts[index];
        if (receipt.status !== "planned") continue;
        const before = stores[index];
        // Recheck freshness against the execution clock, even on a long-running apply.
        const fresh = buildStoreRefreshPlan([before], mapping, observations)
          .rows[0];
        if (fresh.status !== "update") {
          receipt.status = "held";
          receipt.reason = fresh.reason;
          receipt.fields = fresh.fields;
          receipt.updates = {};
          await checkpoint();
          continue;
        }
        receipt.updates = fresh.updates;
        receipt.fields = fresh.fields;
        receipt.attemptedAt = new Date().toISOString();
        receipt.status = "write_pending";
        await checkpoint();
        let query = db
          .from("stores")
          .update({ ...fresh.updates, updated_at: receipt.attemptedAt })
          .eq("id", before.id);
        for (const field of [
          "name",
          "address",
          "phone_number",
          "updated_at",
        ] as const) {
          query =
            before[field] === null
              ? query.is(field, null)
              : query.eq(field, before[field]!);
        }
        for (const field of ["position_lat", "position_lng"] as const) {
          const coordinate = before[field];
          if (coordinate === null) query = query.is(field, null);
          else {
            if (!Number.isFinite(coordinate))
              throw new RefreshFailure("invalid-coordinate-compare-and-set");
            // PostgREST can round float8 JSON output. Bound only that numeric
            // round-trip error; identity and updated_at remain exact CAS guards.
            query = query
              .gte(field, coordinate - 1e-10)
              .lte(field, coordinate + 1e-10);
          }
        }
        const { data, error } = await query.select("id");
        if (error || !data) {
          receipt.reason = "write-outcome-unverified-no-retry";
          throw new RefreshFailure("database-write-failed-or-outcome-unknown");
        }
        if (data.length === 0) {
          receipt.status = "conflict";
          receipt.reason = "compare-and-set-conflict-no-retry";
          await checkpoint();
          continue;
        }
        if (data.length !== 1 || data[0].id !== before.id)
          throw new RefreshFailure("unexpected-write-cardinality");
        receipt.status = "written_unverified";
        receipt.reason = "awaiting-full-row-verification";
        await checkpoint();
        const { data: after, error: readError } = await db
          .from("stores")
          .select("*")
          .eq("id", before.id)
          .single();
        if (readError || !after)
          throw new RefreshFailure("post-write-read-failed");
        const verification = verifyStoreRefreshResult(
          before,
          fresh.updates,
          after as StoreRefreshRow,
          receipt.attemptedAt,
        );
        receipt.after = after as StoreRefreshRow;
        receipt.invalidatedPlaceIds = verification.invalidatedPlaceIds;
        receipt.verificationMismatches = verification.mismatches;
        if (!verification.valid) {
          receipt.status = "failed";
          receipt.reason = "post-write-verification-failed-no-retry";
          await checkpoint();
          throw new RefreshFailure("post-write-verification-failed");
        }
        receipt.status = "applied";
        receipt.reason = "full-row-read-back-verified";
        receipt.verifiedAt = new Date().toISOString();
        await checkpoint();
      }
      phase = "complete";
      await checkpoint();
    } catch (error) {
      phase = "aborted";
      failureCode =
        error instanceof RefreshFailure
          ? error.code
          : "unexpected-apply-failure-outcome-may-be-unverified";
      // Persist the last known state without logging SDK errors, keys or headers.
      try {
        await checkpoint();
      } catch {
        /* The exclusive backup remains the recovery source. */
      }
      console.error(
        JSON.stringify({
          error: failureCode,
          runId,
          counts: counts(),
          report: values.report,
        }),
      );
      process.exitCode = 1;
      return;
    }
  }
  console.log(
    JSON.stringify({
      mode: values.apply ? "apply" : "dry-run",
      runId,
      counts: counts(),
      report: values.report,
      backup: backupPath,
    }),
  );
  if (
    receipts.some(
      (receipt) =>
        receipt.status === "conflict" || unfinished.has(receipt.storeId),
    )
  )
    process.exitCode = 2;
}

main().catch((error: unknown) => {
  // Never expose raw exception messages: transport/SDK failures may embed secrets.
  console.error(
    JSON.stringify({
      error:
        error instanceof RefreshFailure
          ? error.code
          : "store-refresh-failed-check-local-receipts-and-help",
      databaseWritesMayBeUnverified: true,
    }),
  );
  process.exitCode = 1;
});
