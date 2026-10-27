import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { syncStorePlatform, type SyncStore } from "../lib/place-sync";
import { toStoredSyncResult } from "../lib/place-sync-report";
import type { PlaceCandidate } from "../lib/place-matching";

const store: SyncStore = {
  id: 1851,
  name: "채선당올림픽공원점",
  address: "서울특별시 강동구 강동대로 성내동",
  phoneNumber: "02-484-4759",
  position: { lat: 37.5272419, lng: 127.1217769 },
  naverPlaceId: null,
  kakaoPlaceId: null,
};
const candidate: PlaceCandidate = {
  id: "17287242",
  name: "채선당월남쌈&샤브샤브 올림픽공원점",
  address: "서울 강동구 강동대로 143-22",
  phoneNumber: "02-484-4759",
  lat: 37.5272419,
  lng: 127.1217769,
  url: "https://place.map.kakao.com/17287242",
};
const reference = { id: candidate.id, url: candidate.url };

for (const mode of [
  "apply",
  "conflict",
  "dry-run",
  "already-applied",
  "linked-unapplied",
  "forged-applied",
  "unmatched-apply",
  "ambiguous-apply",
  "existing-id-conflict",
  "version-1",
] as const) {
  test(`CLI ${mode}: resume summaries without replaying provider evidence`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "refill-place-sync-"));
    const report = join(dir, "report.json");
    const preload = join(dir, "preload.mjs");
    const lookups = join(dir, "lookups.txt");
    const apply = mode !== "dry-run" && mode !== "version-1";
    const rejected = mode === "version-1";
    const skipped = mode === "dry-run" || mode === "already-applied";
    const conflict = mode === "conflict" || mode === "existing-id-conflict";
    const evidenceStore = {
      ...store,
      kakaoPlaceId:
        mode === "already-applied" || mode === "linked-unapplied"
          ? candidate.id
          : null,
    };
    const currentStore = {
      ...evidenceStore,
      ...(mode === "existing-id-conflict" ? { kakaoPlaceId: "999" } : {}),
    };
    const evidence = await syncStorePlatform(evidenceStore, "kakao", {
      lookup: async () => [candidate],
      now: () => new Date(Date.now() - 60_000),
    });
    assert.equal(evidence.status, "matched");
    const summary = toStoredSyncResult(evidence);
    summary.applied = mode === "already-applied" || mode === "forged-applied";
    if (mode === "unmatched-apply" || mode === "ambiguous-apply") {
      summary.status = mode === "unmatched-apply" ? "unmatched" : "ambiguous";
      summary.reason =
        mode === "unmatched-apply"
          ? "no-high-confidence-match"
          : "multiple-high-confidence-place-ids";
      delete summary.candidate;
      summary.candidates =
        mode === "unmatched-apply"
          ? []
          : [reference, { id: "2", url: "https://place.map.kakao.com/2" }];
    }
    const initialReport = { version: rejected ? 1 : 2, results: [summary] };
    await writeFile(report, JSON.stringify(initialReport));
    await writeFile(lookups, "");
    await writeFile(
      preload,
      `import { appendFile } from "node:fs/promises";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.hostname !== "dapi.kakao.com") return originalFetch(input, init);
  if (url.pathname !== "/v2/local/search/keyword.json") throw new Error("Unexpected Kakao lookup");
  await appendFile(${JSON.stringify(lookups)}, "kakao");
  return new Response(JSON.stringify(${JSON.stringify({
    documents: [
      {
        id: candidate.id,
        place_name: candidate.name,
        road_address_name: candidate.address,
        address_name: "",
        phone: candidate.phoneNumber,
        x: String(candidate.lng),
        y: String(candidate.lat),
      },
    ],
  })}), { status: 200, headers: { "content-type": "application/json" } });
};
`,
    );
    const patches: { url: URL; body: unknown }[] = [];
    let unexpected = false;
    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, "http://localhost");
      res.setHeader("content-type", "application/json");
      if (url.pathname !== "/rest/v1/stores") {
        unexpected = true;
        res.writeHead(404).end("{}");
      } else if (req.method === "GET") {
        res.end(
          JSON.stringify([
            {
              id: currentStore.id,
              name: currentStore.name,
              address: currentStore.address,
              phone_number: currentStore.phoneNumber,
              position_lat: currentStore.position.lat,
              position_lng: currentStore.position.lng,
              naver_place_id: currentStore.naverPlaceId,
              kakao_place_id: currentStore.kakaoPlaceId,
            },
          ]),
        );
      } else if (req.method === "PATCH") {
        let body = "";
        for await (const chunk of req) body += chunk;
        patches.push({ url, body: JSON.parse(body) });
        res.end(JSON.stringify(mode === "conflict" ? [] : [{ id: store.id }]));
      } else {
        unexpected = true;
        res.writeHead(405).end("{}");
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      const args = [
        "--import",
        pathToFileURL(preload).href,
        "--import",
        "tsx",
        "scripts/sync-place-links.ts",
        "--platform",
        "kakao",
        "--ids",
        "1851",
        "--resume",
        "--report",
        report,
        "--config-env",
        join(dir, "no-env"),
      ];
      if (apply) args.push("--apply");
      const result = await new Promise<{ code: number | null; output: string }>(
        (resolve, reject) => {
          const child = spawn(process.execPath, args, {
            env: {
              ...process.env,
              NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
              SUPABASE_SERVICE_ROLE_KEY: "test-private-key",
              KAKAO_API_KEY: "must-not-call-live-api",
            },
            stdio: ["ignore", "pipe", "pipe"],
          });
          let output = "";
          child.stdout.on("data", (chunk) => {
            output += chunk;
          });
          child.stderr.on("data", (chunk) => {
            output += chunk;
          });
          const timer = setTimeout(() => {
            child.kill();
            reject(Error("CLI exceeded fixture timeout"));
          }, 30_000);
          child.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ code, output });
          });
        },
      );
      assert.equal(result.code, rejected ? 1 : conflict ? 2 : 0, result.output);
      assert.doesNotMatch(
        result.output,
        /test-private-key|must-not-call-live-api/,
      );
      assert.equal(unexpected, false);
      assert.equal(
        await readFile(lookups, "utf8"),
        skipped || rejected ? "" : "kakao",
        "apply/conflict must perform a fresh mocked provider lookup",
      );
      assert.equal(
        patches.length,
        apply && !skipped && mode !== "existing-id-conflict" ? 1 : 0,
      );
      if (patches.length) {
        const patch = patches[0];
        assert.deepEqual(patch.body, { kakao_place_id: candidate.id });
        for (const [field, expected] of Object.entries({
          id: "eq.1851",
          name: `eq.${store.name}`,
          address: `eq.${store.address}`,
          phone_number: `eq.${store.phoneNumber}`,
          position_lat: `eq.${store.position.lat}`,
          position_lng: `eq.${store.position.lng}`,
          kakao_place_id:
            currentStore.kakaoPlaceId === null
              ? "is.null"
              : `eq.${currentStore.kakaoPlaceId}`,
        }))
          assert.equal(patch.url.searchParams.get(field), expected);
      }
      const serialized = await readFile(report, "utf8");
      const saved = JSON.parse(serialized);
      if (rejected) {
        assert.deepEqual(saved, initialReport);
        return;
      }
      assert.equal(saved.version, 2);
      assert.equal(saved.results.length, 1);
      assert.equal(saved.results[0].status, conflict ? "conflict" : "matched");
      assert.equal(saved.results[0].applied, apply && !conflict);
      assert.deepEqual(saved.results[0].candidate, reference);
      assert.deepEqual(saved.results[0].candidates, [reference]);
      if (skipped) {
        assert.equal(saved.results[0].checkedAt, evidence.checkedAt);
      } else {
        assert.ok(
          Date.parse(saved.results[0].checkedAt) >
            Date.parse(evidence.checkedAt),
        );
      }
      assert.equal(saved.pendingLookups, 0);
      assert.doesNotMatch(
        serialized,
        /"(?:name|address|phoneNumber|lat|lng|place_name|phone|x|y)"|test-private-key|must-not-call-live-api/,
      );
      for (const value of [
        candidate.name,
        candidate.address,
        candidate.phoneNumber!,
        String(candidate.lat),
        String(candidate.lng),
        store.name,
        store.address,
      ])
        assert.equal(
          serialized.includes(value),
          false,
          `Report retained ${value}`,
        );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(dir, { recursive: true, force: true });
    }
  });
}
