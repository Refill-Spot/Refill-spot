import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

test("unverified rating filters and sorting are rejected before database access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ratings-test.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("Rating filter rejection must not call external services");
  };
  try {
    const { GET } = await import("../app/api/stores/route");
    const { POST } = await import("../app/api/stores/filter/route");
    for (const query of [
      "minRating=4",
      "sort=rating",
      "lat=37&lng=127&minRating=1",
    ]) {
      const response = await GET(
        new NextRequest(`http://localhost/api/stores?${query}`),
      );
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "EXTERNAL_RATINGS_UNAVAILABLE");
    }
    for (const body of [{ minRating: 4 }, { sort: "rating" }]) {
      const response = await POST(
        new NextRequest("http://localhost/api/stores/filter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      assert.equal(response.status, 503);
      const result = await response.json();
      assert.equal(result.success, false);
      assert.equal(result.error.code, "EXTERNAL_RATINGS_UNAVAILABLE");
    }
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
