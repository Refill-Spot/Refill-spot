import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function main() {
  process.loadEnvFile(".env");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw Error("Missing database configuration");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("stores")
      .select("*")
      .order("id")
      .range(offset, offset + 499);
    if (error || !data) throw Error("Store read failed");
    rows.push(...data);
    if (data.length < 500) break;
  }
  const empty = (value: unknown) =>
    value == null || (typeof value === "string" && !value.trim());
  const normalize = (value: unknown) =>
    String(value ?? "")
      .normalize("NFKC")
      .replace(/[\s\p{P}\p{S}]/gu, "")
      .toLowerCase();
  const issues: Record<string, number[]> = {};
  const flag = (kind: string, id: number) => {
    (issues[kind] ??= []).push(id);
  };
  const exactGroups = new Map<string, number[]>();
  const coordinateGroups = new Map<string, number[]>();
  const menuTypes = new Set<string>();
  const provenanceFields = new Set<string>();
  for (const row of rows) {
    const id = Number(row.id);
    for (const field of Object.keys(row))
      if (
        /source|verified|checked|observed|collected|updated_at|created_at/.test(
          field,
        )
      )
        provenanceFields.add(field);
    for (const field of ["name", "address", "phone_number", "open_hours"])
      if (empty(row[field])) flag(`missing_${field}`, id);
    const address = String(row.address ?? "");
    if (/아이동반|무선인터넷|단체이용|예약가능/.test(address))
      flag("address_contains_non_address_label", id);
    if (!/(?:로|길)\s*\d|(?:동|읍|면|리)\s*\d/.test(address))
      flag("address_without_street_or_lot_number", id);
    const region = address.trim().split(/\s+/).slice(0, 2);
    if (region.length < 2 || !/(?:시|군|구)$/.test(region[1]))
      flag("unrecognized_second_address_region", id);
    const lat = row.position_lat;
    const lng = row.position_lng;
    const valid =
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat !== 0 &&
      lng !== 0 &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;
    if (!valid) flag("invalid_or_placeholder_coordinates", id);
    else if (lat < 33 || lat > 39 || lng < 124 || lng > 132)
      flag("coordinates_outside_expected_korea_bounds", id);
    if (
      typeof row.phone_number === "string" &&
      row.phone_number.replace(/\D/g, "").startsWith("0507")
    )
      flag("virtual_0507_phone", id);
    const group = `${normalize(row.name)}|${normalize(row.address)}`;
    exactGroups.set(group, [...(exactGroups.get(group) ?? []), id]);
    if (valid) {
      const coordinates = `${lat},${lng}`;
      coordinateGroups.set(coordinates, [
        ...(coordinateGroups.get(coordinates) ?? []),
        id,
      ]);
    }
    let menus = row.refill_items;
    if (typeof menus === "string") {
      try {
        menus = JSON.parse(menus);
      } catch {
        flag("malformed_menu_json", id);
        menus = undefined;
      }
    }
    if (!Array.isArray(menus) || !menus.length) flag("no_menu_items", id);
    else {
      for (const menu of menus) {
        if (menu && typeof menu.type === "string") menuTypes.add(menu.type);
      }
      if (menus.some((menu) => menu?.type === "browser_verified"))
        flag("contains_unattributed_browser_verified_menu_label", id);
    }
  }
  const dates = (field: string) => {
    const values = rows
      .map((row) => row[field])
      .filter(
        (v): v is string =>
          typeof v === "string" && Number.isFinite(Date.parse(v)),
      )
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    return {
      earliest: values[0] ?? null,
      latest: values.at(-1) ?? null,
      missingOrInvalid: rows.length - values.length,
    };
  };
  const report = {
    auditedAt: new Date().toISOString(),
    totalStores: rows.length,
    limitations: [
      "Database timestamps do not establish real-world verification dates.",
      "Address/coordinate flags are quality signals, not proof of incorrect identity or closure.",
      "A browser_verified label without source and observation date is not freshness evidence.",
    ],
    provenanceFields: [...provenanceFields].sort(),
    databaseDates: {
      created_at: dates("created_at"),
      updated_at: dates("updated_at"),
    },
    rowsWithIdenticalCreatedAndUpdated: rows.filter(
      (row) => row.created_at === row.updated_at,
    ).length,
    counts: Object.fromEntries(
      Object.entries(issues).map(([kind, ids]) => [kind, ids.length]),
    ),
    issueStoreIds: issues,
    duplicateNameAddressGroups: [...exactGroups.values()].filter(
      (ids) => ids.length > 1,
    ),
    sharedCoordinateGroups: [...coordinateGroups.values()].filter(
      (ids) => ids.length > 1,
    ),
    menuTypeValues: [...menuTypes].sort(),
  };
  await mkdir("logs", { recursive: true });
  await writeFile(
    "logs/store-data-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  // A bounded public-store snapshot preserves the exact inputs for the pilot, not auth/profile data.
  const snapshot = rows.map((row) =>
    Object.fromEntries(
      [
        "id",
        "name",
        "address",
        "phone_number",
        "position_lat",
        "position_lng",
        "open_hours",
        "refill_items",
        "created_at",
        "updated_at",
      ].map((field) => [field, row[field]]),
    ),
  );
  await writeFile(
    "logs/store-data-audit-input.json",
    JSON.stringify(snapshot, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      { ...report, issueStoreIds: undefined, menuTypeValues: undefined },
      null,
      2,
    ),
  );
}

main().catch(() => {
  console.error("Store data audit failed; no database writes performed.");
  process.exitCode = 1;
});
