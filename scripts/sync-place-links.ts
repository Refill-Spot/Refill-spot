import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  createNaverLookupCode,
  fetchKakaoCandidates,
  parseNaverLookupOutput,
} from "../lib/place-candidates";
import {
  syncStorePlatform,
  type Platform,
  type SyncStore,
} from "../lib/place-sync";
import {
  canResumeStoredResult,
  toStoredSyncResult,
  type StoredSyncResult,
} from "../lib/place-sync-report";

const run = promisify(execFile);
const usage = `Usage: pnpm places:sync [--platform both|naver|kakao] [--ids 1851,1852]
  [--limit 10] [--report logs/place-links.json] [--resume] [--apply]

Default: read-only discovery and matching; no database writes.
--apply: persist matched IDs with an identity/previous-ID compare-and-set.
Requires the place-ID migrations first. Ambiguous/missing places are NOT linked.
Naver discovery uses installed Aside CLI public rendered search results.
Kakao discovery uses KAKAO_API_KEY. Reports store only IDs/URLs and sync metadata.
Version-2 checkpoints resume within 24 hours; apply freshly checks unapplied links.
Credentials are loaded from .env (or --config-env), never written to the report.
`;

async function main() {
  const { values } = parseArgs({
    options: {
      platform: { type: "string", default: "both" },
      ids: { type: "string" },
      limit: { type: "string" },
      report: { type: "string", default: "logs/place-links.json" },
      "config-env": { type: "string", default: ".env" },
      resume: { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (!["both", "naver", "kakao"].includes(values.platform!)) {
    throw Error("Invalid --platform (use both, naver or kakao)");
  }
  const ids = values.ids?.split(",").map(Number);
  if (ids?.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw Error("--ids must contain positive integer store IDs");
  }
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit <= 0)) {
    throw Error("--limit must be a positive integer");
  }
  try {
    process.loadEnvFile(values["config-env"]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw Error("Cannot load environment file");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = values.apply
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw Error("Supabase credentials missing (apply requires service role)");
  const platforms: Platform[] =
    values.platform === "both"
      ? ["kakao", "naver"]
      : [values.platform as Platform];
  if (platforms.includes("kakao") && !process.env.KAKAO_API_KEY)
    throw Error("KAKAO_API_KEY missing");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (values.apply) {
    const { error } = await db
      .from("stores")
      .select("id,naver_place_id,kakao_place_id")
      .limit(1);
    if (error)
      throw Error(
        "Place-ID schema unavailable; apply migrations before --apply",
      );
  }

  const stores: SyncStore[] = [];
  for (let offset = 0; stores.length < limit; offset += 500) {
    let query = db
      .from("stores")
      .select("*")
      .order("id")
      .range(offset, offset + 499);
    if (ids) query = query.in("id", ids);
    const { data, error } = await query;
    if (error || !data) throw Error("Store read failed");
    for (const row of data) {
      if (stores.length >= limit) break;
      stores.push({
        id: row.id,
        name: row.name,
        address: row.address,
        phoneNumber: row.phone_number ?? null,
        position: { lat: row.position_lat, lng: row.position_lng },
        naverPlaceId: row.naver_place_id ?? null,
        kakaoPlaceId: row.kakao_place_id ?? null,
      });
    }
    if (data.length < 500) break;
  }
  if (ids && stores.length === 0) throw Error("No requested stores found");
  const reportPath = resolve(values.report!);
  const results = new Map<string, StoredSyncResult>();
  if (values.resume) {
    try {
      const saved = JSON.parse(await readFile(reportPath, "utf8"));
      if (saved.version !== 2 || !Array.isArray(saved.results))
        throw Error("Invalid report");
      const storesById = new Map(stores.map((store) => [store.id, store]));
      for (const item of saved.results) {
        const store = storesById.get(item?.storeId);
        if (
          !store ||
          !platforms.includes(item.platform) ||
          !canResumeStoredResult(store, item.platform, item, new Date()) ||
          (values.apply && !item.applied)
        )
          continue;
        results.set(
          `${item.storeId}:${item.platform}`,
          toStoredSyncResult(item),
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw Error("Cannot resume invalid report");
    }
  }
  async function checkpoint() {
    await mkdir(dirname(reportPath), { recursive: true });
    const temporary = `${reportPath}.${process.pid}.tmp`;
    await writeFile(
      temporary,
      JSON.stringify(
        {
          version: 2,
          updatedAt: new Date().toISOString(),
          mode: values.apply ? "apply" : "dry-run",
          totalStores: stores.length,
          platforms,
          pendingLookups: stores.length * platforms.length - results.size,
          results: [...results.values()].map(toStoredSyncResult),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await rename(temporary, reportPath);
  }

  const naverCache = new Map<
    number,
    ReturnType<typeof parseNaverLookupOutput>[number]
  >();
  const failures: Record<Platform, number> = { naver: 0, kakao: 0 };
  const stopped = new Set<Platform>();
  for (let index = 0; index < stores.length; index++) {
    const store = stores[index];
    for (const platform of platforms) {
      if (stopped.has(platform)) continue;
      const resultKey = `${store.id}:${platform}`;
      const previous = results.get(resultKey);
      if (
        previous &&
        canResumeStoredResult(store, platform, previous, new Date()) &&
        (!values.apply || previous.applied)
      )
        continue;
      const result = await syncStorePlatform(store, platform, {
        lookup: async (identity, provider) => {
          if (provider === "kakao") {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return fetchKakaoCandidates(identity, process.env.KAKAO_API_KEY!);
          }
          if (!naverCache.has(store.id)) {
            // One rendered search per CLI deadline: multiple navigations can exceed
            // Aside's 120-second session limit even when each page eventually loads.
            const batch = [store];
            try {
              const { stdout } = await run(
                "aside",
                ["repl", createNaverLookupCode(batch)],
                {
                  timeout: 120_000,
                  maxBuffer: 4 * 1024 * 1024,
                  windowsHide: true,
                },
              );
              const parsed = parseNaverLookupOutput(stdout);
              for (const item of parsed) naverCache.set(item.storeId, item);
            } catch {
              for (const item of batch)
                naverCache.set(item.id, {
                  storeId: item.id,
                  candidates: [],
                  error: "browser_lookup_failed",
                });
            }
          }
          const found = naverCache.get(store.id);
          if (!found || found.error) throw Error("Naver lookup unavailable");
          return found.candidates;
        },
        apply: values.apply
          ? async (identity, provider, candidate) => {
              const field =
                provider === "naver" ? "naver_place_id" : "kakao_place_id";
              const previousId =
                provider === "naver"
                  ? identity.naverPlaceId
                  : identity.kakaoPlaceId;
              let update = db
                .from("stores")
                .update({ [field]: candidate.id })
                .eq("id", identity.id)
                .eq("name", identity.name)
                .eq("address", identity.address)
                .eq("position_lat", identity.position.lat)
                .eq("position_lng", identity.position.lng);
              update =
                identity.phoneNumber === null
                  ? update.is("phone_number", null)
                  : update.eq("phone_number", identity.phoneNumber);
              update =
                previousId === null
                  ? update.is(field, null)
                  : update.eq(field, previousId);
              const { data, error } = await update.select("id");
              if (error) throw Error("Place link write failed");
              return data?.length === 1;
            }
          : undefined,
      });
      results.set(resultKey, toStoredSyncResult(result));
      await checkpoint();
      console.log(
        `${store.id} ${platform}: ${result.status}${result.applied ? " (saved)" : ""}`,
      );
      failures[platform] =
        result.status === "error" ? failures[platform] + 1 : 0;
      if (failures[platform] >= 3) {
        stopped.add(platform);
        console.error(
          `${platform}: stopped after 3 consecutive errors; checkpoint retained for --resume`,
        );
      }
    }
  }
  await checkpoint();
  const summary = [...results.values()].reduce<Record<string, number>>(
    (counts, result) => {
      const key = `${result.platform}:${result.status}`;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    },
    {},
  );
  console.log(
    JSON.stringify({
      stores: stores.length,
      mode: values.apply ? "apply" : "dry-run",
      summary,
      pendingLookups: stores.length * platforms.length - results.size,
      report: values.report,
    }),
  );
  if (
    [...results.values()].some(
      (result) => result.status === "error" || result.status === "conflict",
    )
  )
    process.exitCode = 2;
}

main().catch(() => {
  // Do not log exception objects: SDK/process errors can contain keys, headers or profile paths.
  console.error(
    "Place synchronization failed. Check arguments (--help), credentials, schema and report permissions.",
  );
  process.exitCode = 1;
});
