import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { getSafeReturnUrl } from "../lib/utils";
import { GET } from "../app/auth/callback/route";

const origin = "https://refill.example";

test("internal return paths work without a browser and malformed escapes never throw", () => {
  assert.equal(
    getSafeReturnUrl("/map?query=강남 역", "/"),
    "/map?query=강남 역",
  );
  assert.equal(getSafeReturnUrl("%2Ffavorites", "/"), "/favorites");
  assert.equal(getSafeReturnUrl("/map?query=%", "/"), "/");
  assert.equal(
    getSafeReturnUrl(`${origin}/favorites`, "/", origin),
    `${origin}/favorites`,
  );
});

test("external, encoded and control-character redirect targets fail closed", () => {
  for (const target of [
    "https://attacker.example/reset-password",
    "//attacker.example",
    "/\\attacker.example",
    "%2F%2Fattacker.example",
    "%252F%252Fattacker.example",
    "/%252fattacker.example",
    "javascript:alert(1)",
    "/%0d%0aLocation:https://attacker.example",
    " https://attacker.example",
    "/".repeat(2049),
  ]) {
    assert.equal(getSafeReturnUrl(target, "/", origin), "/", target);
  }
});

test("password recovery never forwards an authorization code outside this site", async () => {
  for (const target of [
    "https://attacker.example/reset-password",
    "//attacker.example/reset-password",
    "/%2fattacker.example/reset-password",
    "/map",
  ]) {
    const url = new URL("/auth/callback", origin);
    url.searchParams.set("code", "test-recovery-code");
    url.searchParams.set("type", "recovery");
    url.searchParams.set("next", target);
    const response = await GET(new NextRequest(url));
    const destination = new URL(response.headers.get("location")!);
    assert.equal(destination.origin, origin);
    assert.equal(destination.pathname, "/reset-password");
    assert.equal(destination.searchParams.get("code"), "test-recovery-code");
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
});
