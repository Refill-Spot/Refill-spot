import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { buildStagingReview, parseCrawlerStaging } from "../lib/crawler-staging";

const usage = `Usage: node --import tsx scripts/check-crawler-staging.ts <local-export.json>
Offline validation only. No network, database access, environment loading or writes.
Output contains aggregate counts only. Confirmed source evidence is NOT currentness
verification; every record still needs review and publication is never allowed.
`;

function fail(error: string) {
  console.error(
    JSON.stringify({ valid: false, publicationAllowed: false, reviewRequired: true, error }),
  );
  process.exitCode = 1;
}

async function main() {
  let args;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: { help: { type: "boolean", default: false } },
    });
  } catch {
    fail("invalid_arguments");
    return;
  }
  if (args.values.help) {
    console.log(usage);
    return;
  }
  if (args.positionals.length !== 1) {
    fail("one_local_json_path_required");
    return;
  }
  const [path] = args.positionals;
  // Reject URL, UNC and device paths; a Windows drive path is still local.
  if (
    /^[\/\\]{2}/.test(path) ||
    (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\/\\]/i.test(path))
  ) {
    fail("local_file_path_required");
    return;
  }
  let input: unknown;
  try {
    input = JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail("cannot_read_local_json");
    return;
  }
  let data;
  try {
    data = parseCrawlerStaging(input);
  } catch {
    // Zod/JSON/filesystem messages can contain untrusted text or private paths.
    fail("invalid_staging_export");
    return;
  }
  const { records: _records, ...summary } = buildStagingReview(data);
  console.log(JSON.stringify({ valid: true, schemaVersion: data.schemaVersion, ...summary }, null, 2));
}

main().catch(() => fail("staging_check_failed"));
