import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function command(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/sync-place-links.ts", ...args],
    {
      encoding: "utf8",
      timeout: 20_000,
      env: {
        ...process.env,
        SUPABASE_SERVICE_ROLE_KEY: "never-print-this-test-key",
      },
    },
  );
}

test("sync help is offline and explains dry run versus write mode", () => {
  const result = command(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no database writes/);
  assert.match(result.stdout, /--apply/);
  assert.match(result.stdout, /--resume/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /never-print-this-test-key/,
  );
});

for (const args of [
  ["--platform", "other"],
  ["--ids", "-1"],
  ["--ids", "1,,2"],
  ["--limit", "0"],
  ["--limit", "1.5"],
  ["--unknown"],
]) {
  test(`sync rejects invalid arguments before network access: ${args.join(" ")}`, () => {
    const result = command(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Place synchronization failed/);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /never-print-this-test-key/,
    );
  });
}
