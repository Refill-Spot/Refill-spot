import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

test("public exploration renders without an authentication backend", async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    for (const path of ["/", "/map", "/store/12", "/auth/callback"]) {
      const response = await middleware(
        new NextRequest(`http://localhost${path}`),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-middleware-next"), "1");
    }
  } finally {
    if (url === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = url;
    }
    if (key === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = key;
    }
  }
});

test("protected routes still redirect anonymous visitors to login", async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  try {
    for (const path of [
      "/profile",
      "/favorites?from=map",
      "/admin",
      "/admin/stores",
    ]) {
      const response = await middleware(
        new NextRequest(`http://localhost${path}`),
      );
      assert.equal(response.status, 307);
      const destination = new URL(response.headers.get("location")!);
      assert.equal(destination.pathname, "/login");
      assert.equal(destination.searchParams.get("returnUrl"), path);
    }
  } finally {
    if (url === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = url;
    }
    if (key === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = key;
    }
  }
});
