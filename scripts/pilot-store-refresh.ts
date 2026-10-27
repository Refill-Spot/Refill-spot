import { readFile, writeFile } from "node:fs/promises";

async function main() {
  process.loadEnvFile(".env");
  const key = process.env.KAKAO_API_KEY;
  if (!key) throw Error("Missing Kakao credentials");
  const audit = JSON.parse(
    await readFile("logs/store-data-audit.json", "utf8"),
  );
  const rows = JSON.parse(
    await readFile("logs/store-data-audit-input.json", "utf8"),
  ) as Array<{
    id: number;
    name: string;
    address: string;
    phone_number: string | null;
    position_lat: number;
    position_lng: number;
  }>;
  const ids = new Set<number>([
    1851,
    1848,
    1853,
    1974,
    1976,
    2041,
    ...(audit.issueStoreIds.missing_open_hours ?? []).slice(0, 2),
    ...(audit.issueStoreIds.missing_phone_number ?? []).slice(0, 2),
    ...(audit.issueStoreIds.no_menu_items ?? []).slice(0, 2),
  ]);
  const selected = rows.filter((row) => ids.has(row.id));
  const results = [];
  for (const row of selected) {
    const variants = [
      {
        kind: "existing-region-and-coordinate-bias",
        query: `${row.address.trim().split(/\s+/).slice(0, 2).join(" ")} ${row.name}`,
        nearby: true,
      },
      {
        kind: "city-and-name-without-coordinate-bias",
        query: `${row.address.trim().split(/\s+/)[0]} ${row.name}`,
        nearby: false,
      },
    ];
    const observations = [];
    for (const variant of variants) {
      const url = new URL(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
      );
      url.searchParams.set("query", variant.query);
      url.searchParams.set("size", "15");
      if (variant.nearby) {
        url.searchParams.set("x", String(row.position_lng));
        url.searchParams.set("y", String(row.position_lat));
        url.searchParams.set("radius", "2000");
      }
      const observedAt = new Date().toISOString();
      try {
        const response = await fetch(url, {
          headers: { Authorization: `KakaoAK ${key}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          observations.push({
            kind: variant.kind,
            query: variant.query,
            observedAt,
            outcome: "error",
            httpStatus: response.status,
          });
          continue;
        }
        const body = await response.json();
        if (
          !Array.isArray(body.documents) ||
          typeof body.meta?.is_end !== "boolean"
        )
          throw Error("Invalid response");
        observations.push({
          kind: variant.kind,
          query: variant.query,
          observedAt,
          outcome: body.documents.length
            ? "candidates"
            : "no-result-not-closure",
          complete: body.meta.is_end,
          totalCount: body.meta.total_count,
          candidates: body.documents.map((item: Record<string, unknown>) => ({
            id: item.id,
            url: `https://place.map.kakao.com/${encodeURIComponent(String(item.id))}`,
          })),
        });
      } catch {
        observations.push({
          kind: variant.kind,
          query: variant.query,
          observedAt,
          outcome: "error",
          error: "request-or-response-failed",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    results.push({
      storeId: row.id,
      storedName: row.name,
      storedAddress: row.address,
      storedPhone: row.phone_number,
      observations,
      approvedUpdates: [],
    });
  }
  const report = {
    runAt: new Date().toISOString(),
    source: "Kakao official keyword API",
    mode: "read-only-candidate-pilot",
    totalStores: selected.length,
    limitations: [
      "Search visibility is not proof of current operation or closure.",
      "No menus, prices, hours, or unlimited-refill claims were refreshed.",
      "Candidate generation is not identity verification; no database updates approved.",
      "Only external place IDs and URLs are retained; external names, addresses, phones and coordinates are not cached.",
    ],
    results,
  };
  await writeFile(
    "logs/store-refresh-pilot.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        stores: selected.length,
        observations: results.map((result) => ({
          id: result.storeId,
          queries: result.observations.map((observation) => ({
            kind: observation.kind,
            outcome: observation.outcome,
            count:
              "totalCount" in observation ? observation.totalCount : undefined,
            complete:
              "complete" in observation ? observation.complete : undefined,
          })),
        })),
        databaseWrites: 0,
      },
      null,
      2,
    ),
  );
}

main().catch(() => {
  console.error("Refresh pilot failed; no database writes performed.");
  process.exitCode = 1;
});
