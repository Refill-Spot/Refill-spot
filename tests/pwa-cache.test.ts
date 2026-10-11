import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as pwaCache from "../lib/pwa-cache.mjs";
import {
  apiResponse,
  errorResponse,
  successResponse,
} from "../lib/api-response";

const origin = "https://refill.example";
const safeManifest = [
  { url: "/offline", revision: "offline-build-1" },
  { url: "/_next/static/chunks/app.123.js", revision: "js-build-1" },
  { url: "/_next/static/css/app.123.css", revision: "css-build-1" },
  { url: "/_next/static/media/font.123.woff2", revision: "font-build-1" },
];
const unsafeManifest = [
  "/",
  "/profile",
  "/favorites",
  "/api/favorites",
  "/api/my-reviews",
  "/offline?token=private",
  "/offline.html",
  "/_next/static/chunks/app.js?token=private",
  "/_next/static/../../api/favorites.js",
  "/_next/static/chunks/app.js.map",
  "/_next/static/media/private-photo.png",
  "/_next/data/build/profile.json",
  "/_next/image?url=private-avatar.jpg&w=128&q=75",
  "/images/private-avatar.jpg",
  "/worker-old.js",
  "/fallback-old.js",
  "https://private.example/_next/static/photo.js",
  "https://project.supabase.co/storage/v1/object/sign/private/photo.jpg?token=test",
].map((url) => ({ url, revision: "private-build-1" }));

class WorkerEvent extends Event {
  readonly promises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.promises.push(promise);
  }

  async done() {
    let completed = 0;
    while (completed < this.promises.length) {
      const pending = this.promises.slice(completed);
      completed = this.promises.length;
      await Promise.all(pending);
    }
  }
}

class WorkerFetchEvent extends WorkerEvent {
  readonly request: Request;
  readonly preloadResponse = Promise.resolve(undefined);
  response: Promise<Response> | undefined;

  constructor(request: Request) {
    super("fetch");
    this.request = request;
  }

  respondWith(response: Promise<Response>) {
    assert.equal(this.response, undefined);
    this.response = Promise.resolve(response);
  }
}

// Node cannot construct navigation/image Requests. Preserve these browser-only
// properties through clone(), including the worker's requestWillFetch plugin.
const NativeRequest = Request;
class BrowserRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
    if (input instanceof NativeRequest) {
      Object.defineProperties(this, {
        mode: { value: input.mode, configurable: true },
        destination: { value: input.destination, configurable: true },
      });
    }
  }

  override clone() {
    const request = new BrowserRequest(super.clone());
    Object.defineProperties(request, {
      mode: { value: this.mode, configurable: true },
      destination: { value: this.destination, configurable: true },
    });
    return request;
  }
}

function memoryCacheStorage() {
  const stored = new Map<string, Map<string, Response>>();
  const writes: string[] = [];
  const reads: string[] = [];
  const deleted: string[] = [];
  const key = (request: RequestInfo | URL) =>
    new URL(
      request instanceof NativeRequest ? request.url : String(request),
      origin,
    ).href;
  const match = (entries: Map<string, Response>, request: RequestInfo | URL) =>
    entries.get(key(request))?.clone();
  const storage = {
    keys: async () => [...stored.keys()],
    delete: async (name: string) => {
      deleted.push(name);
      return stored.delete(name);
    },
    open: async (name: string) => {
      let entries = stored.get(name);
      if (!entries) {
        entries = new Map();
        stored.set(name, entries);
      }
      const cache = entries;
      return {
        match: async (request: RequestInfo | URL) => {
          reads.push(key(request));
          return match(cache, request);
        },
        put: async (request: RequestInfo | URL, response: Response) => {
          writes.push(key(request));
          cache.set(key(request), response.clone());
        },
        keys: async () => [...cache.keys()].map((url) => new Request(url)),
        delete: async (request: RequestInfo | URL) =>
          cache.delete(key(request)),
      };
    },
    match: async (
      request: RequestInfo | URL,
      options?: MultiCacheQueryOptions,
    ) => {
      reads.push(key(request));
      const names = options?.cacheName
        ? [options.cacheName]
        : [...stored.keys()];
      for (const name of names) {
        const entries = stored.get(name);
        const response = entries && match(entries, request);
        if (response) return response;
      }
      return undefined;
    },
  };
  return { storage, stored, writes, reads, deleted };
}

type RequestOptions = {
  mode?: RequestMode;
  destination?: RequestDestination;
  headers?: HeadersInit;
  method?: string;
  body?: string;
};

async function loadWorker(
  context: TestContext,
  manifest = [...safeManifest, ...unsafeManifest],
) {
  const memory = memoryCacheStorage();
  const listeners = new Map<string, ((event: WorkerEvent) => unknown)[]>();
  const networkCalls: { request: Request; options?: RequestInit }[] = [];
  let online = true;
  let status = 200;
  let claims = 0;
  let skips = 0;
  const worker = {
    __SW_MANIFEST: manifest,
    location: new URL(`${origin}/sw.js`),
    registration: { scope: `${origin}/` },
    caches: memory.storage,
    clients: {
      claim: async () => {
        claims++;
      },
    },
    skipWaiting: async () => {
      skips++;
    },
    addEventListener: (
      name: string,
      listener: (event: WorkerEvent) => unknown,
    ) => {
      const callbacks = listeners.get(name) ?? [];
      callbacks.push(listener);
      listeners.set(name, callbacks);
    },
  };
  const globals = {
    self: worker,
    location: worker.location,
    registration: worker.registration,
    caches: worker.caches,
    ExtendableEvent: WorkerEvent,
    FetchEvent: WorkerFetchEvent,
    Request: BrowserRequest,
    fetch: async (input: RequestInfo | URL, options?: RequestInit) => {
      const request =
        input instanceof NativeRequest ? input : new Request(input, options);
      networkCalls.push({ request, options });
      if (!online) throw new TypeError("Network unavailable");
      const url = new URL(request.url);
      const body =
        url.pathname === "/offline"
          ? "public offline document"
          : `network:${request.headers.get("Cookie") ?? "public"}`;
      const response = new Response(body, { status });
      Object.defineProperty(response, "url", { value: request.url });
      return response;
    },
  };
  const previousGlobals = Object.keys(globals).map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const previousNodeEnv = process.env.NODE_ENV;
  // Exercise the same library code paths as the production worker bundle.
  Reflect.set(process.env, "NODE_ENV", "production");
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true });
  }
  context.after(() => {
    for (const [name, descriptor] of previousGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    if (previousNodeEnv === undefined)
      Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
  });

  // Only the browser platform is simulated. The actual worker constructs real
  // Serwist strategies, precaching, routes and fallback plugins from the package.
  const serwist = await import("serwist");
  const compiled = ts.transpileModule(
    readFileSync(resolve("worker/index.js"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  );
  runInNewContext(compiled.outputText, {
    exports: {},
    ...globals,
    URL,
    process,
    require: (id: string) => {
      if (id === "serwist") return serwist;
      assert.equal(id, "../lib/pwa-cache.mjs");
      return pwaCache;
    },
  });

  function dispatch(name: string, event: WorkerEvent) {
    const callbacks = listeners.get(name);
    assert.ok(callbacks?.length, `actual worker registers ${name}`);
    for (const callback of callbacks) callback(event);
    return event.done();
  }

  return {
    ...memory,
    networkCalls,
    setOnline: (value: boolean) => {
      online = value;
    },
    setStatus: (value: number) => {
      status = value;
    },
    claims: () => claims,
    skips: () => skips,
    install: () => dispatch("install", new WorkerEvent("install")),
    activate: () => dispatch("activate", new WorkerEvent("activate")),
    cacheUrls: (urls: string[]) => {
      const event = new WorkerEvent("message");
      Object.assign(event, {
        data: { type: "CACHE_URLS", payload: { urlsToCache: urls } },
      });
      return dispatch("message", event);
    },
    fetch: async (path: string, options: RequestOptions = {}) => {
      const request = new Request(new URL(path, origin), {
        headers: options.headers,
        method: options.method,
        body: options.body,
      });
      if (options.mode) {
        Object.defineProperty(request, "mode", {
          value: options.mode,
          configurable: true,
        });
      }
      if (options.destination) {
        Object.defineProperty(request, "destination", {
          value: options.destination,
          configurable: true,
        });
      }
      const event = new WorkerFetchEvent(request);
      const done = dispatch("fetch", event);
      assert.ok(event.response, "actual worker must respond to the request");
      try {
        return await event.response;
      } finally {
        await done;
      }
    },
  };
}

test("Serwist next config retains registration, build checks and existing webpack settings", async () => {
  let captured: Record<string, any> | undefined;
  const exported: { default?: Record<string, any> } = {};
  const compiled = ts.transpileModule(
    readFileSync(resolve("next.config.mjs"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  );
  runInNewContext(compiled.outputText, {
    exports: exported,
    process: { env: { NODE_ENV: "production" } },
    require: (id: string) => {
      if (id === "@serwist/next") {
        return {
          default: (options: Record<string, any>) => {
            captured = options;
            return (config: Record<string, any>) => config;
          },
        };
      }
      if (id === "node:crypto") return { randomUUID: () => "offline-build-1" };
      assert.equal(id, "./lib/pwa-cache.mjs");
      return pwaCache;
    },
  });
  assert.ok(captured);
  const { validateInjectManifestOptions } = await import("@serwist/next");
  const options = validateInjectManifestOptions(captured);
  assert.equal(options.disable, false);
  assert.equal(options.swSrc, "worker/index.js");
  assert.equal(options.swDest, "public/sw.js");
  assert.equal(options.swUrl, "/sw.js");
  assert.equal(options.scope, "/");
  assert.equal(options.register, true);
  assert.equal(options.cacheOnNavigation, false);
  assert.equal(options.reloadOnOnline, true);
  assert.equal(options.globPublicPatterns.length, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(options.additionalPrecacheEntries)),
    [{ url: "/offline", revision: "offline-build-1" }],
  );
  assert.ok(options.manifestTransforms);
  const filtered = await options.manifestTransforms[0](
    [...safeManifest, ...unsafeManifest].map((entry) => ({
      ...entry,
      size: 100,
    })),
    undefined,
  );
  assert.deepEqual(
    filtered.manifest.map((entry) => entry.url),
    safeManifest.map((entry) => entry.url),
  );
  assert.deepEqual(filtered.warnings, []);
  const config = exported.default;
  assert.ok(config);
  assert.equal(config.eslint.ignoreDuringBuilds, false);
  assert.equal(config.typescript.ignoreBuildErrors, false);
  const apiHeaders = (await config.headers()).find(
    (rule: { source: string }) => rule.source === "/api/:path*",
  );
  assert.ok(apiHeaders);
  const headers = new Headers(
    apiHeaders.headers.map(({ key, value }: { key: string; value: string }) => [
      key,
      value,
    ]),
  );
  assert.equal(headers.get("cache-control"), "private, no-store");
  assert.equal(headers.get("pragma"), "no-cache");
  assert.equal(headers.get("expires"), "0");
  assert.equal(config.images.minimumCacheTTL, 2678400);
  assert.deepEqual(
    Array.from(
      config.images.remotePatterns,
      (pattern: { hostname: string }) => pattern.hostname,
    ),
    ["placeholder.com", "via.placeholder.com", "dummyimage.com", "example.com"],
  );
  const webpack = config.webpack(
    {
      experiments: { layers: true },
      optimization: { splitChunks: { cacheGroups: { custom: true } } },
    },
    { isServer: false },
  );
  assert.equal(webpack.experiments.layers, true);
  assert.equal(webpack.experiments.asyncWebAssembly, true);
  assert.equal(webpack.optimization.splitChunks.cacheGroups.custom, true);
  assert.equal(webpack.optimization.splitChunks.cacheGroups.default, false);
  assert.equal(webpack.optimization.splitChunks.cacheGroups.vendors, false);
});

test("actual worker installs only safe build resources and the public offline document", async (context) => {
  const worker = await loadWorker(context);
  await worker.install();
  assert.equal(worker.skips(), 1);
  assert.deepEqual(
    worker.networkCalls
      .map(({ request }) => new URL(request.url).pathname)
      .sort(),
    safeManifest.map(({ url }) => url).sort(),
  );
  assert.equal(worker.writes.length, safeManifest.length);
  assert.ok(
    worker.writes.every((url) =>
      pwaCache.isSafePrecacheEntry(new URL(url).pathname),
    ),
  );
  worker.setOnline(false);
  const asset = await worker.fetch("/_next/static/chunks/app.123.js");
  assert.equal(await asset.text(), "network:public");
  // Private variants must never match a public precache entry.
  await assert.rejects(
    worker.fetch("/_next/static/chunks/app.123.js?token=private"),
  );
});

test("API, RSC, navigation and private images fetch the current account without cache reads or writes", async (context) => {
  const worker = await loadWorker(context);
  await worker.install();
  const requests: [string, RequestOptions][] = [
    ["/api", {}],
    ["/api/stores?limit=20", {}],
    ["/api/stores/12/reviews?sort=latest", {}],
    ["/api/favorites", {}],
    ["/api/my-reviews", {}],
    ["/api/favorites", { method: "POST", body: "store=12" }],
    ["/api/stores/12/reviews/1", { method: "PUT", body: "review=updated" }],
    ["/api/profile", { method: "PATCH", body: "name=updated" }],
    ["/api/favorites/12", { method: "DELETE" }],
    ["/api/auth/callback?code=test", {}],
    ["https://other.example/api/reviews", {}],
    ["/profile", { mode: "navigate" }],
    ["/favorites", { headers: { RSC: "1" } }],
    ["/my-reviews", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } }],
    ["/offline", { headers: { RSC: "1" } }],
    ["/_next/static/chunks/app.123.js", { headers: { RSC: "1" } }],
    [
      "/_next/image?url=https%3A%2F%2Fprivate.example%2Favatar.jpg&w=128&q=75",
      {},
    ],
    ["/images/private-avatar.jpg?token=account-a", { destination: "image" }],
    [
      "https://project.supabase.co/storage/v1/object/sign/private/photo.jpg?token=test",
      { destination: "image" },
    ],
    ["https://project.supabase.co/rest/v1/reviews?user_id=eq.account-a", {}],
    ["https://project.supabase.co/auth/v1/user", {}],
    ["https://third-party.example/data.json", {}],
  ];
  const writesBefore = [...worker.writes];
  const readsBefore = [...worker.reads];
  for (const account of ["account-a", "account-b"]) {
    for (const [path, options] of requests) {
      const headers = new Headers(options.headers);
      headers.set("Cookie", `session=${account}`);
      const response = await worker.fetch(path, { ...options, headers });
      assert.equal(
        await response.text(),
        new URL(path, origin).pathname === "/offline"
          ? "public offline document"
          : `network:session=${account}`,
        path,
      );
      const fetched = worker.networkCalls.at(-1);
      assert.ok(fetched);
      assert.equal(fetched.request.cache, "no-store", path);
      assert.equal(
        fetched.request.headers.get("Cookie"),
        `session=${account}`,
        path,
      );
      assert.equal(fetched.request.method, options.method ?? "GET", path);
      if (options.body) {
        assert.equal(await fetched.request.clone().text(), options.body, path);
      }
    }
  }
  assert.deepEqual(worker.writes, writesBefore);
  assert.deepEqual(worker.reads, readsBefore);
});

test("offline fallback is document-only; API, RSC and private images never replay account A data", async (context) => {
  const worker = await loadWorker(context);
  await worker.install();
  const privatePaths: [string, RequestOptions][] = [
    ["/api/favorites", {}],
    ["/api/my-reviews", {}],
    ["/api/favorites", { mode: "navigate" }],
    ["/profile", { headers: { RSC: "1" } }],
    ["/offline", { headers: { RSC: "1" } }],
    ["/_next/static/chunks/app.123.js", { headers: { RSC: "1" } }],
    [
      "/_next/image?url=private-avatar.jpg&w=128&q=75",
      { destination: "image" },
    ],
    ["https://private.example/photo.jpg", { destination: "image" }],
    ["https://other.example/profile", { mode: "navigate" }],
  ];
  const oldPrivateCache = await worker.storage.open("api-favorites");
  for (const [path] of privatePaths) {
    await oldPrivateCache.put(
      new URL(path, origin),
      new Response("account-a private data"),
    );
  }
  const writesBefore = [...worker.writes];
  worker.setOnline(false);
  for (const path of ["/", "/profile", "/favorites", "/unknown", "/offline"]) {
    const response = await worker.fetch(path, { mode: "navigate" });
    assert.equal(await response.text(), "public offline document", path);
  }
  for (const [path, options] of privatePaths) {
    await assert.rejects(
      worker.fetch(path, {
        ...options,
        headers: {
          ...Object.fromEntries(new Headers(options.headers)),
          Cookie: "session=account-b",
        },
      }),
      path,
    );
  }
  assert.deepEqual(worker.writes, writesBefore);
});

test("online documents and HTTP errors are returned unchanged instead of the offline fallback", async (context) => {
  const worker = await loadWorker(context);
  await worker.install();
  const writesBefore = [...worker.writes];
  const response = await worker.fetch("/profile", {
    mode: "navigate",
    headers: { Cookie: "session=account-b" },
  });
  assert.equal(await response.text(), "network:session=account-b");
  worker.setStatus(503);
  const failure = await worker.fetch("/profile", { mode: "navigate" });
  assert.equal(failure.status, 503);
  assert.equal(await failure.text(), "network:public");
  assert.deepEqual(worker.writes, writesBefore);
});

test("CACHE_URLS messages cannot populate private runtime caches", async (context) => {
  const worker = await loadWorker(context);
  await worker.install();
  const writesBefore = [...worker.writes];
  const readsBefore = [...worker.reads];
  await worker.cacheUrls([
    `${origin}/api/favorites`,
    `${origin}/profile`,
    `${origin}/_next/image?url=private-avatar.jpg&w=128&q=75`,
  ]);
  assert.deepEqual(worker.writes, writesBefore);
  assert.deepEqual(worker.reads, readsBefore);
});

test(
  "activation waits for exact obsolete-cache deletion before claiming clients and preserves unrelated caches",
  { timeout: 5000 },
  async (context) => {
    const worker = await loadWorker(context);
    await worker.install();
    const obsolete = [
      "api-stores",
      "api-store-details",
      "api-store-reviews",
      "api-favorites",
      "api-my-reviews",
      "api-announcements",
      "images",
      "start-url",
      "pages",
      "pages-rsc",
      "pages-rsc-prefetch",
      "next-data",
    ];
    assert.deepEqual(pwaCache.obsoleteRuntimeCacheNames, obsolete);
    const preserved = [
      "workbox-precache-v2-https://refill.example/",
      "workbox-precache-v1-https://refill.example/",
      "another-app",
      "api-favorites-other-app",
      "other-app-pages",
      "images-public",
      "static-style-assets",
      "next-static-js-assets",
      "static-js-assets",
    ];
    for (const name of [...obsolete, ...preserved]) {
      const cache = await worker.storage.open(name);
      await cache.put(
        `${origin}/api/favorites`,
        new Response("account-a private favorites"),
      );
    }
    const originalPreservedEntries = preserved.map((name) =>
      worker.stored.get(name),
    );
    let allowDeletion!: () => void;
    const pendingDeletion = new Promise<void>((resolve) => {
      allowDeletion = resolve;
    });
    let signalStarted!: () => void;
    const deletionsStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const deleteCache = worker.storage.delete;
    let started = 0;
    worker.storage.delete = async (name) => {
      if (++started === obsolete.length) signalStarted();
      await pendingDeletion;
      return deleteCache(name);
    };
    const activation = worker.activate();
    let completed = false;
    const completion = activation.then(() => {
      completed = true;
    });
    await deletionsStarted;
    assert.equal(completed, false);
    assert.equal(worker.claims(), 0);
    allowDeletion();
    await completion;
    assert.equal(completed, true);
    assert.equal(worker.claims(), 1);
    assert.deepEqual(worker.deleted.sort(), obsolete.sort());
    for (const name of obsolete)
      assert.equal(worker.stored.has(name), false, name);
    assert.deepEqual(
      preserved.map((name) => worker.stored.get(name)),
      originalPreservedEntries,
    );
    const deletedBefore = [...worker.deleted];
    await worker.activate();
    assert.deepEqual(worker.deleted, deletedBefore);
    assert.equal(worker.claims(), 2);
    worker.setOnline(false);
    assert.equal(
      await (await worker.fetch("/profile", { mode: "navigate" })).text(),
      "public offline document",
    );
  },
);

test("failed obsolete-cache deletion rejects activation without claiming clients", async (context) => {
  const worker = await loadWorker(context);
  const failure = new Error("cache storage unavailable");
  await worker.storage.open("api-favorites");
  worker.storage.delete = async () => {
    throw failure;
  };
  await assert.rejects(worker.activate(), failure);
  assert.equal(worker.claims(), 0);
  assert.equal(worker.stored.has("api-favorites"), true);
});

test("shared API helpers retain data, error, and status contracts without caching", async () => {
  const data = { id: 12, favorites: [1, 2] };
  for (const response of [
    successResponse(data, 201),
    apiResponse.success(data, 201),
  ]) {
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), { success: true, data });
  }
  const error = {
    code: "forbidden",
    message: "Not allowed",
    details: { id: 12 },
  };
  for (const response of [
    errorResponse(error, 403),
    apiResponse.error(error, 403),
  ]) {
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), { success: false, error });
  }
  const plainError = errorResponse("Failed");
  assert.equal(plainError.status, 500);
  assert.equal(plainError.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await plainError.json(), {
    success: false,
    error: { code: "error", message: "Failed" },
  });
});
