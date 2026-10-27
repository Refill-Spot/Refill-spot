import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  registryCoordinates,
  coordinateDistanceMeters,
} from "../lib/registry-coordinates";

// Deliberately limited to the independently reviewed branch. Never infer other
// store associations from a name-only match or historical crawler ID.
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply"))
    throw Error("Unexpected arguments");
  process.loadEnvFile(".env");
  const evidence = JSON.parse(
    await readFile("logs/registry-store1851.json", "utf8"),
  );
  if (
    evidence.httpStatus !== 200 ||
    evidence.code !== "0" ||
    evidence.total !== 1 ||
    evidence.records.length !== 1
  )
    throw Error("Invalid registry response");
  const age = Date.now() - Date.parse(evidence.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > 86400000)
    throw Error("Stale registry observation");
  const item = evidence.records[0];
  if (
    item.id !== "3240000-101-2004-00022" ||
    item.name !== "채선당" ||
    item.status !== "영업/정상" ||
    item.address !== "서울특별시 강동구 강동대로 143-22, 1층 (성내동)" ||
    item.phone !== "02-484-4759"
  )
    throw Error("Reviewed registry identity changed");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: old, error } = await db
    .from("stores")
    .select("*")
    .eq("id", 1851)
    .single();
  if (error || !old) throw Error("Cannot read production row");
  if (
    old.name !== "채선당올림픽공원점" ||
    old.phone_number !== item.phone ||
    !["서울특별시 강동구 강동대로 성내동", item.address].includes(old.address)
  )
    throw Error("Production identity mismatch");
  const coords = registryCoordinates(item.x, item.y);
  const distance = coordinateDistanceMeters(
    { lat: old.position_lat, lng: old.position_lng },
    coords,
  );
  if (!Number.isFinite(distance) || distance > 100)
    throw Error("Movement exceeds reviewed correction threshold");
  const update = {
    address: item.address,
    position_lat: coords.lat,
    position_lng: coords.lng,
    position_x: coords.lng,
    position_y: coords.lat,
  };
  const sameValue = (actual: unknown, expected: unknown) =>
    typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) < 1e-10
      : actual === expected;
  const unchanged = Object.entries(update).every(([k, v]) => sameValue(old[k], v));
  console.log(
    JSON.stringify({
      storeId: 1851,
      mode: args.includes("--apply") ? "apply" : "dry-run",
      distanceMeters: distance,
      unchanged,
      fields: Object.keys(update),
    }),
  );
  if (!args.includes("--apply") || unchanged) return;
  await mkdir("logs", { recursive: true });
  const receipt = `logs/registry-store1851-${Date.now()}`;
  await writeFile(
    receipt + "-backup.json",
    JSON.stringify(
      {
        before: old,
        planned: update,
        source: {
          registryId: item.id,
          observedAt: evidence.observedAt,
          registryUpdatedAt: item.updatedAt,
          crs: "EPSG:5174",
        },
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  const { data: changed, error: writeError } = await db
    .from("stores")
    .update(update)
    .eq("id", old.id)
    .eq("name", old.name)
    .eq("address", old.address)
    .eq("phone_number", old.phone_number)
    .eq("position_lat", old.position_lat)
    .eq("position_lng", old.position_lng)
    .eq("updated_at", old.updated_at)
    .select("id");
  if (writeError || changed?.length !== 1)
    throw Error("Write failed or concurrent edit; inspect backup");
  const { data: after, error: readError } = await db
    .from("stores")
    .select("*")
    .eq("id", 1851)
    .single();
  if (readError || !after) throw Error("Post-write read failed");
  const pass =
    Object.entries(update).every(([k, v]) => sameValue(after[k], v)) &&
    ["name", "phone_number", "refill_items", "open_hours", "image_urls"].every(
      (k) => JSON.stringify(after[k]) === JSON.stringify(old[k]),
    );
  await writeFile(
    receipt + "-verification.json",
    JSON.stringify({ verified: pass, after }, null, 2),
    { flag: "wx" },
  );
  if (!pass) throw Error("Post-write mismatch; inspect verification receipt");
  console.log(
    JSON.stringify({
      applied: 1,
      verified: true,
      backup: receipt + "-backup.json",
      otherFieldsPreserved: true,
    }),
  );
}
main().catch(() => {
  console.error(
    "Registry update did not complete verification. Inspect local receipts; no automatic retry.",
  );
  process.exitCode = 1;
});
