import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

test("public exploration renders without an authentication backend", async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    for (const path of [
      "/",
      "/map?search=coffee",
      "/store/12",
      "/auth/callback",
      "/profile-public",
      "/favorites-public",
      "/my-reviews-public",
      "/administrator",
    ]) {
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
      "/profile/settings",
      "/favorites?from=map",
      "/my-reviews?sort=recent",
      "/my-reviews/history",
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

const AUTH_COOKIE = "sb-example-auth-token";
const VERIFIED_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "verified@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2025-01-01T00:00:00.000Z",
};

function installAuthBackend(
  t: TestContext,
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousKey;
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, "https://example.supabase.co");
      return handler(url, init);
    },
  );
}

function storedSession(expired = false) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
      sub: VERIFIED_USER.id,
      exp: expired ? 1 : 4102444800,
      role: "authenticated",
    })}.test-signature`,
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expired ? 1 : 4102444800,
    // 저장된 ID가 아닌 /auth/v1/user에서 검증한 ID만 사용해야 한다.
    user: { ...VERIFIED_USER, id: "untrusted-cookie-user" },
  };
}

function authenticatedRequest(path: string, expired = false) {
  const encoded = `base64-${Buffer.from(
    JSON.stringify(storedSession(expired)),
  ).toString("base64url")}`;
  return new NextRequest(`http://localhost${path}`, {
    headers: { cookie: `${AUTH_COOKIE}=${encoded}` },
  });
}

test("missing backend configuration fails closed without blocking login", async (t) => {
  installAuthBackend(t, () => {
    assert.fail("missing configuration must not send requests");
  });
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  for (const path of [
    "/profile",
    "/favorites",
    "/my-reviews",
    "/admin/stores",
  ]) {
    const response = await middleware(
      new NextRequest(`http://localhost${path}`),
    );
    assert.equal(response.status, 307);
    const destination = new URL(response.headers.get("location")!);
    assert.equal(destination.origin, "http://localhost");
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("returnUrl"), path);
  }
  for (const path of ["/login", "/register", "/forgot-password"]) {
    const response = await middleware(
      new NextRequest(`http://localhost${path}`),
    );
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
});

test("a rejected or unreachable identity backend never trusts cookie users", async (t) => {
  let unreachable = false;
  installAuthBackend(t, (url) => {
    assert.equal(url.pathname, "/auth/v1/user");
    if (unreachable) throw new Error("authentication unavailable");
    return Response.json({ message: "invalid token" }, { status: 401 });
  });

  for (const failure of [false, true]) {
    unreachable = failure;
    for (const path of ["/profile", "/favorites", "/my-reviews", "/admin"]) {
      const response = await middleware(authenticatedRequest(path));
      assert.equal(
        new URL(response.headers.get("location")!).pathname,
        "/login",
      );
    }
    const response = await middleware(authenticatedRequest("/login"));
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
});

test("administrator authorization uses the verified user and denies profile errors", async (t) => {
  let profileStatus = 200;
  let isAdmin = false;
  installAuthBackend(t, (url) => {
    if (url.pathname === "/auth/v1/user") return Response.json(VERIFIED_USER);
    assert.equal(url.pathname, "/rest/v1/profiles");
    assert.equal(url.searchParams.get("id"), `eq.${VERIFIED_USER.id}`);
    return Response.json(
      profileStatus === 200
        ? { role: isAdmin ? "admin" : "user", is_admin: isAdmin }
        : { message: "profile unavailable" },
      { status: profileStatus },
    );
  });

  for (const status of [200, 500]) {
    profileStatus = status;
    const response = await middleware(authenticatedRequest("/admin/stores"));
    assert.equal(
      new URL(response.headers.get("location")!).pathname,
      "/unauthorized",
    );
  }
  profileStatus = 200;
  isAdmin = true;
  const response = await middleware(authenticatedRequest("/admin/stores"));
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("authenticated login preserves safe return paths and rejects external or looping redirects", async (t) => {
  installAuthBackend(t, (url) => {
    assert.equal(url.pathname, "/auth/v1/user");
    return Response.json(VERIFIED_USER);
  });

  const safePath = "/favorites?from=map#saved";
  const safeResponse = await middleware(
    authenticatedRequest(`/login?returnUrl=${encodeURIComponent(safePath)}`),
  );
  assert.equal(
    safeResponse.headers.get("location"),
    `http://localhost${safePath}`,
  );

  for (const returnUrl of [
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "/folder/..//evil.example/path",
    "javascript:alert(1)",
    "/\n/evil.example",
    "/login?returnUrl=/login",
    "/auth/callback?next=/login",
    "/register",
    "/forgot-password",
  ]) {
    const response = await middleware(
      authenticatedRequest(`/login?returnUrl=${encodeURIComponent(returnUrl)}`),
    );
    assert.equal(response.headers.get("location"), "http://localhost/");
  }
});

test("all session cookie chunks are read before verifying identity", async (t) => {
  let verifications = 0;
  installAuthBackend(t, (url) => {
    assert.equal(url.pathname, "/auth/v1/user");
    verifications += 1;
    return Response.json(VERIFIED_USER);
  });
  const session = storedSession();
  session.user.user_metadata = { padding: "x".repeat(900) };
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const chunks = encoded.match(/.{1,128}/g)!;
  assert.ok(chunks.length > 5);
  const request = new NextRequest("http://localhost/profile", {
    headers: {
      cookie: chunks
        .map((value, index) => `${AUTH_COOKIE}.${index}=${value}`)
        .join("; "),
    },
  });
  const response = await middleware(request);
  assert.equal(verifications, 1);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("refreshed cookies reach downstream requests and redirect responses", async (t) => {
  installAuthBackend(t, (url) => {
    if (url.pathname === "/auth/v1/token") {
      assert.equal(url.searchParams.get("grant_type"), "refresh_token");
      return Response.json({ ...storedSession(), user: VERIFIED_USER });
    }
    assert.equal(url.pathname, "/auth/v1/user");
    return Response.json(VERIFIED_USER);
  });

  for (const path of ["/profile", "/login?returnUrl=%2Ffavorites"]) {
    const request = authenticatedRequest(path, true);
    const oldCookie = request.cookies.get(AUTH_COOKIE)!.value;
    const response = await middleware(request);
    const refreshedCookie = response.cookies.get(AUTH_COOKIE);
    assert.ok(refreshedCookie);
    assert.notEqual(refreshedCookie.value, oldCookie);
    assert.equal(
      request.cookies.get(AUTH_COOKIE)?.value,
      refreshedCookie.value,
    );
    if (path === "/profile") {
      assert.equal(response.headers.get("x-middleware-next"), "1");
      assert.equal(
        response.headers.get("x-middleware-request-cookie"),
        request.headers.get("cookie"),
      );
    } else {
      assert.equal(
        response.headers.get("location"),
        "http://localhost/favorites",
      );
    }
  }
});

test("invalid refresh tokens are removed on the login redirect", async (t) => {
  installAuthBackend(t, (url) => {
    assert.equal(url.pathname, "/auth/v1/token");
    return Response.json(
      { code: "refresh_token_not_found", message: "Invalid Refresh Token" },
      { status: 400 },
    );
  });

  const response = await middleware(authenticatedRequest("/my-reviews", true));
  assert.equal(new URL(response.headers.get("location")!).pathname, "/login");
  const removedCookie = response.cookies.get(AUTH_COOKIE);
  assert.ok(removedCookie);
  assert.equal(removedCookie.value, "");
  assert.equal(removedCookie.maxAge, 0);
});
