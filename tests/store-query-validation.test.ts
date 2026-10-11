import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as apiResponse from "../lib/api-response";
import * as distance from "../lib/distance";
import * as reviewSummary from "../lib/review-summary";
import * as validations from "../lib/validations";

type Handler = (request: NextRequest) => Promise<NextResponse>;
type StoreQuery = Promise<{ data: unknown; error: unknown }> & {
  select: () => StoreQuery;
  or: (filter: string) => StoreQuery;
};
type TestStore = {
  id: number;
  name: string;
  address: string;
  position_lat: number;
  position_lng: number;
  categories: unknown;
  distance_km: number;
};

function store(id: number, overrides: Partial<TestStore> = {}): TestStore {
  return {
    id,
    name: "Zero 카페",
    address: "테스트 주소",
    position_lat: 0,
    position_lng: 0,
    categories: ["카페"],
    distance_km: 0,
    ...overrides,
  };
}

// 실제 라우트를 격리하여 로드합니다. DB, 쿠키, 네트워크는 접근하지 않습니다.
function loadRoute(
  path: string,
  options: {
    stores?: unknown;
    storeError?: unknown;
    reviews?: unknown;
    reviewError?: unknown;
    throwStoreQuery?: boolean;
  } = {},
) {
  const calls = {
    clients: 0,
    rpc: [] as Array<{ name: string; args: unknown }>,
    tables: [] as string[],
    reviewIds: [] as number[],
    search: "",
  };
  const storeResult = {
    data: options.stores === undefined ? [] : options.stores,
    error: options.storeError ?? null,
  };
  const storeQuery: StoreQuery = Object.assign(Promise.resolve(storeResult), {
    select: (): StoreQuery => storeQuery,
    or: (filter: string): StoreQuery => {
      calls.search = filter;
      return storeQuery;
    },
  });
  const supabase = {
    rpc: async (name: string, args?: unknown) => {
      calls.rpc.push({ name, args: structuredClone(args) });
      if (options.throwStoreQuery) {
        throw new Error("Mock database failure");
      }
      return storeResult;
    },
    from: (table: string) => {
      calls.tables.push(table);
      if (options.throwStoreQuery) {
        throw new Error("Mock database failure");
      }
      if (table === "stores") {
        return storeQuery;
      }
      assert.equal(table, "reviews");
      return {
        select: () => ({
          in: async (_column: string, ids: number[]) => {
            calls.reviewIds = [...ids];
            return {
              data: options.reviews === undefined ? [] : options.reviews,
              error: options.reviewError ?? null,
            };
          },
        }),
      };
    },
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/api-response": apiResponse,
    "@/lib/distance": distance,
    "@/lib/review-summary": reviewSummary,
    "@/lib/validations": validations,
    "@/lib/supabase/server": {
      createServerSupabaseClient: async () => {
        calls.clients += 1;
        return supabase;
      },
    },
    "@/lib/stores": {
      mapStoreFromDb: (row: TestStore, storeDistance?: string | null) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        categories: Array.isArray(row.categories)
          ? row.categories.map((item) =>
              typeof item === "string" ? item : item.category.name,
            )
          : [],
        distance: storeDistance ?? null,
      }),
    },
    "next/server": { NextResponse },
  };
  const exported: { GET?: Handler; POST?: Handler } = {};
  const compiled = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText;
  runInNewContext(compiled, {
    exports: exported,
    URL,
    console: { error: () => {} },
    require: (specifier: string) => {
      assert.ok(Object.hasOwn(dependencies, specifier), specifier);
      return dependencies[specifier];
    },
  });
  const handler = exported.GET ?? exported.POST;
  assert.ok(handler);
  return { handler, calls };
}

function getRequest(query: string) {
  return new NextRequest(`http://localhost/api/stores?${query}`);
}

function postRequest(body: string) {
  return new NextRequest("http://localhost/api/stores/filter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("GET rejects malformed, out-of-bounds and ambiguous parameters before DB access", async () => {
  const { handler, calls } = loadRoute("app/api/stores/route.ts");
  for (const query of [
    "lat=0",
    "lng=0",
    "lat=&lng=0",
    "lat=0&lng=",
    "lat=abc&lng=0",
    "lat=NaN&lng=0",
    "lat=Infinity&lng=0",
    "lat=1e309&lng=0",
    "lat=91&lng=0",
    "lat=-91&lng=0",
    "lat=0&lng=181",
    "lat=0&lng=-181",
    "lat=1junk&lng=0",
    "lat=0x10&lng=0",
    "lat=0&lat=1&lng=0",
    "radius=",
    "radius=0",
    "radius=-1",
    "radius=50.01",
    "radius=Infinity",
    "radius=5junk",
    "page=",
    "page=0",
    "page=-1",
    "page=1.5",
    "page=1junk",
    "page=10001",
    "page=9007199254740992",
    "page=1e3",
    "limit=0",
    "limit=-1",
    "limit=101",
    "limit=2.5",
    "limit=10junk",
    "limit=NaN",
    "minRating=NaN",
    "minRating=-1",
    "minRating=6",
    "minRating=4junk",
    "sort=unknown",
    "sort=default&sort=rating",
    "categories=",
    "categories=카페,,한식",
    "categories=%20",
    `categories=${"a".repeat(51)}`,
    `categories=${Array(21).fill("카페").join(",")}`,
    `query=${"a".repeat(101)}`,
    "query=a%00b",
    "unknown=1",
    "__proto__=1",
    "lat=bad&lng=0&minRating=4",
  ]) {
    const response = await handler(getRequest(query));
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).success, false, query);
  }
  assert.equal(calls.clients, 0);
  assert.deepEqual(calls.rpc, []);
});

test("POST rejects malformed JSON and invalid filters before DB access", async () => {
  const { handler, calls } = loadRoute("app/api/stores/filter/route.ts");
  for (const body of ["", "{", "null", "[]", "1", '"query"', "{}"]) {
    assert.equal((await handler(postRequest(body))).status, 400, body);
  }
  for (const body of [
    { latitude: 0 },
    { longitude: 0 },
    { latitude: null, longitude: 0 },
    { latitude: "0", longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { maxDistance: 0 },
    { maxDistance: 50.1 },
    { categories: "카페" },
    { categories: [""] },
    { categories: [" "] },
    { categories: [1] },
    { categories: ["a".repeat(51)] },
    { categories: Array(21).fill("카페") },
    { query: "a".repeat(101) },
    { query: "a\u0000b" },
    { minRating: -1 },
    { minRating: 6 },
    { minRating: "4" },
    { sort: "unknown" },
    { sort: null },
    { unknown: true },
    { page: 0 },
    { limit: 1000000 },
    { latitude: null, minRating: 4 },
  ]) {
    const response = await handler(postRequest(JSON.stringify(body)));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).success, false);
  }
  assert.equal(calls.clients, 0);
  assert.deepEqual(calls.tables, []);
});

test("schemas reject non-finite numbers without converting missing or blank coordinates to zero", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(
      validations.storeFilterSchema.safeParse({ latitude: value, longitude: 0 })
        .success,
      false,
    );
    assert.equal(
      validations.storeFilterSchema.safeParse({ maxDistance: value }).success,
      false,
    );
    assert.equal(
      validations.radiusSearchSchema.safeParse({ lat: value, lng: 0 }).success,
      false,
    );
  }
  for (const value of [null, true, "", " ", "1junk"]) {
    assert.equal(
      validations.radiusSearchSchema.safeParse({ lat: value, lng: "0" })
        .success,
      false,
    );
  }
  assert.equal(
    validations.radiusSearchSchema.safeParse({ lng: "0" }).success,
    false,
  );
  assert.equal(
    validations.radiusSearchSchema.safeParse({ lat: 0, lng: 0, radius: 50000 })
      .success,
    true,
  );
  assert.equal(
    validations.storeQuerySchema.safeParse({
      lat: "-90",
      lng: "180",
      radius: "50",
      page: "10000",
      limit: "100",
    }).success,
    true,
  );
  assert.equal(
    validations.storeFilterSchema.safeParse({
      latitude: 90,
      longitude: -180,
      maxDistance: 50,
      categories: [],
    }).success,
    true,
  );
});

test("valid external-rating filters and sorts remain 503 before DB access", async () => {
  const get = loadRoute("app/api/stores/route.ts");
  const post = loadRoute("app/api/stores/filter/route.ts");
  for (const query of [
    "minRating=4",
    "sort=rating",
    "lat=0&lng=0&minRating=1",
  ]) {
    const response = await get.handler(getRequest(query));
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json()).error.code,
      "EXTERNAL_RATINGS_UNAVAILABLE",
    );
  }
  for (const body of [{ minRating: 4 }, { sort: "rating" }]) {
    const response = await post.handler(postRequest(JSON.stringify(body)));
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json()).error.code,
      "EXTERNAL_RATINGS_UNAVAILABLE",
    );
  }
  assert.equal(get.calls.clients, 0);
  assert.equal(post.calls.clients, 0);
});

test("search escaping keeps regex metacharacters, wildcards and filter syntax literal", () => {
  for (const query of [
    "100%_*",
    "a.b[c](d)+?^$|{x}\\",
    'a",address.not.is.null,or(name.eq."x',
    "카페:한식",
  ]) {
    const filter = validations.buildStoreSearchFilter(query);
    const parts = filter.match(
      /^name\.imatch\.("(?:\\.|[^"\\])*"),address\.imatch\.("(?:\\.|[^"\\])*")$/,
    );
    assert.ok(parts, filter);
    assert.equal(parts[1], parts[2]);
    const pattern = new RegExp(JSON.parse(parts[1]), "i");
    assert.equal(pattern.test(`prefix ${query} suffix`), true, query);
    assert.equal(pattern.test("unrelated cafe"), false, query);
  }
});

test("GET accepts zero coordinates and applies literal query and category filters", async () => {
  const query = "100%_*(안녕)";
  const { handler, calls } = loadRoute("app/api/stores/route.ts", {
    stores: [
      store(1, {
        name: `카페 ${query}`,
        categories: [{ category: { name: "카페" } }],
      }),
      store(2, { name: "다른 카페" }),
      store(3, { name: `카페 ${query}`, categories: JSON.stringify(["한식"]) }),
    ],
    reviews: [
      { store_id: 1, rating: 4 },
      { store_id: 1, rating: 5 },
    ],
  });
  const response = await handler(
    getRequest(
      new URLSearchParams({
        lat: "0",
        lng: "0",
        radius: "50",
        categories: " 카페 ",
        query,
      }).toString(),
    ),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.rpc, [
    {
      name: "get_stores_within_radius",
      args: { user_lat: 0, user_lng: 0, radius_km: 50 },
    },
  ]);
  assert.deepEqual(calls.reviewIds, [1]);
  assert.deepEqual(
    body.data.map((row: { id: number }) => row.id),
    [1],
  );
  assert.equal(body.data[0].distance, "0");
  assert.equal(body.data[0].avgRating, 4.5);
  assert.equal(body.data[0].reviewCount, 2);
});

test("GET without coordinates applies filters and bounded pagination before reviewing only the page", async () => {
  const { handler, calls } = loadRoute("app/api/stores/route.ts", {
    stores: [store(1), store(2), store(3, { categories: ["한식"] })],
  });
  const response = await handler(
    getRequest("categories=카페&query=zero&page=2&limit=1"),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls.rpc[0].name, "get_default_recommended_stores");
  assert.deepEqual(
    body.data.map((row: { id: number }) => row.id),
    [2],
  );
  assert.deepEqual(calls.reviewIds, [2]);
  assert.deepEqual(body.pagination, {
    page: 2,
    limit: 1,
    total: 2,
    hasMore: false,
    totalPages: 2,
  });
  assert.equal(body.data[0].reviewCount, 0);
  assert.equal(Object.hasOwn(body.data[0], "avgRating"), false);
});

test("POST filters and sorts around zero coordinates without dropping zero distance or mutating rows", async () => {
  const query = '카페%,or(name.eq."x")';
  const stores = [
    store(1, { name: query, position_lng: 0.001 }),
    store(2, { name: query }),
    store(3, { name: query, position_lat: 1 }),
    store(4, { name: query, categories: ["한식"] }),
    store(5, { name: query, position_lat: NaN }),
  ];
  const { handler, calls } = loadRoute("app/api/stores/filter/route.ts", {
    stores,
  });
  const response = await handler(
    postRequest(
      JSON.stringify({
        latitude: 0,
        longitude: 0,
        maxDistance: 1,
        minRating: 0,
        categories: [" 카페 "],
        query,
        sort: "distance",
      }),
    ),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls.search, validations.buildStoreSearchFilter(query));
  assert.deepEqual(
    body.data.map((row: { id: number }) => row.id),
    [2, 1],
  );
  assert.equal(body.data[0].distance, "0");
  assert.equal(body.data[1].distance, "0.11");
  assert.equal(
    stores.some((row) => Object.hasOwn(row, "distance")),
    false,
  );
});

test("distance-only POST filters retain the current no-coordinate behavior", async () => {
  const { handler } = loadRoute("app/api/stores/filter/route.ts", {
    stores: [store(1)],
  });
  const response = await handler(
    postRequest(JSON.stringify({ maxDistance: 3, sort: "distance" })),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data[0].distance, null);
});

test("empty store results succeed while null results, DB errors and thrown failures return 500", async () => {
  for (const path of [
    "app/api/stores/route.ts",
    "app/api/stores/filter/route.ts",
  ]) {
    const request = () =>
      path.includes("/filter/")
        ? postRequest('{"query":"카페"}')
        : getRequest("lat=0&lng=0");
    const empty = loadRoute(path);
    const response = await empty.handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, []);
    assert.deepEqual(empty.calls.reviewIds, []);
    assert.equal(empty.calls.tables.includes("reviews"), false);
    for (const options of [
      { stores: null },
      {
        stores: [store(1)],
        storeError: { message: "private database details" },
      },
      { throwStoreQuery: true },
    ]) {
      const failure = loadRoute(path, options);
      const response = await failure.handler(request());
      const body = await response.json();
      assert.equal(response.status, 500);
      assert.equal(body.success, false);
      assert.equal(body.error.code, "database_error");
      assert.equal(Object.hasOwn(body.error, "details"), false);
    }
  }
});

test("review-query failure or missing data does not fabricate zero reviews or use partial ratings", async () => {
  for (const options of [
    { reviews: [{ store_id: 1, rating: 5 }], reviewError: { code: "failed" } },
    { reviews: null },
    { reviews: [{ store_id: 1, rating: NaN }] },
  ]) {
    const { handler } = loadRoute("app/api/stores/route.ts", {
      stores: [store(1)],
      ...options,
    });
    const response = await handler(getRequest("lat=0&lng=0"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(Object.hasOwn(body.data[0], "avgRating"), false);
    assert.equal(Object.hasOwn(body.data[0], "reviewCount"), false);
  }
});
