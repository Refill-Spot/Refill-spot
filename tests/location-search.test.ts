import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { searchLocations } from "../lib/location-search";

type Callback = (data: unknown, status: string) => void;
interface SearchCall {
  query: string;
  callback: Callback;
  options: { size: number; page: number };
}

function installServices(t: TestContext) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const previousKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY;
  const keywords: SearchCall[] = [];
  const addresses: SearchCall[] = [];
  const services = {
    Status: { OK: "OK", ZERO_RESULT: "ZERO_RESULT", ERROR: "ERROR" },
    Places: class {
      keywordSearch(
        query: string,
        callback: Callback,
        options: SearchCall["options"],
      ) {
        keywords.push({ query, callback, options });
      }
    },
    Geocoder: class {
      addressSearch(
        query: string,
        callback: Callback,
        options: SearchCall["options"],
      ) {
        addresses.push({ query, callback, options });
      }
    },
  };
  const browser = {
    kakao: { maps: { Map: class {}, MarkerClusterer: class {}, services } },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get scripts() {
        throw new Error("A ready SDK must not request scripts");
      },
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Provider results must not be persisted");
    },
  });
  Object.defineProperty(browser, "localStorage", {
    get() {
      throw new Error("Provider results must not be persisted");
    },
  });
  process.env.NEXT_PUBLIC_KAKAO_API_KEY = "a".repeat(32);
  t.after(() => {
    for (const [name, descriptor] of [
      ["window", previousWindow],
      ["document", previousDocument],
      ["localStorage", previousStorage],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, name);
      }
    }
    if (previousKey === undefined) {
      delete process.env.NEXT_PUBLIC_KAKAO_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_KAKAO_API_KEY = previousKey;
    }
  });
  return { browser, services, keywords, addresses };
}

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: "123",
    place_name: "서울역",
    road_address_name: "서울 중구 한강대로 405",
    address_name: "서울 중구 봉래동2가",
    y: "37.5547",
    x: "126.9706",
    ...overrides,
  };
}

test("keyword search trims input, bounds the request, and returns coordinates directly", async (t) => {
  const harness = installServices(t);
  const pending = searchLocations("  서울역  ");
  await Promise.resolve();
  assert.equal(harness.keywords.length, 1);
  const call = harness.keywords[0];
  assert.equal(call.query, "서울역");
  assert.deepEqual(call.options, { size: 5, page: 1 });
  call.callback([place()], "OK");
  assert.deepEqual(await pending, [
    {
      id: "kakao:place:123",
      name: "서울역",
      address: "서울 중구 한강대로 405",
      lat: 37.5547,
      lng: 126.9706,
    },
  ]);
  assert.equal(harness.addresses.length, 0);
});

test("short, empty, and overlimit queries make no provider requests", async (t) => {
  const harness = installServices(t);
  for (const query of ["", "  ", "서", "  서 "]) {
    assert.deepEqual(await searchLocations(query), []);
  }
  await assert.rejects(searchLocations("가".repeat(101)), /100자 이하/);
  assert.equal(harness.keywords.length, 0);
  assert.equal(harness.addresses.length, 0);
  const pending = searchLocations(`  ${"가".repeat(100)}  `);
  await Promise.resolve();
  assert.equal(harness.keywords[0].query.length, 100);
  harness.keywords[0].callback([], "OK");
  assert.deepEqual(await pending, []);
  assert.equal(harness.addresses.length, 0);
});

test("only keyword ZERO_RESULT falls back to exactly one address request", async (t) => {
  const harness = installServices(t);
  const pending = searchLocations("서울 중구 한강대로 405");
  await Promise.resolve();
  const keyword = harness.keywords[0];
  keyword.callback([], "ZERO_RESULT");
  keyword.callback([], "ZERO_RESULT");
  keyword.callback([place()], "OK");
  assert.equal(harness.addresses.length, 1);
  const address = harness.addresses[0];
  assert.equal(address.query, "서울 중구 한강대로 405");
  assert.deepEqual(address.options, { size: 5, page: 1 });
  address.callback(
    [
      {
        address_name: "서울 중구 봉래동2가",
        road_address: { address_name: "서울 중구 한강대로 405" },
        y: "37.5547",
        x: "126.9706",
      },
    ],
    "OK",
  );
  assert.deepEqual(await pending, [
    {
      id: "kakao:address:서울 중구 한강대로 405:37.5547:126.9706",
      name: "서울 중구 한강대로 405",
      address: "서울 중구 한강대로 405",
      lat: 37.5547,
      lng: 126.9706,
    },
  ]);
});

test("explicit address mode skips Places and ZERO_RESULT resolves as no matches", async (t) => {
  const harness = installServices(t);
  const pending = searchLocations("없는 주소", { mode: "address" });
  await Promise.resolve();
  assert.equal(harness.keywords.length, 0);
  assert.equal(harness.addresses.length, 1);
  harness.addresses[0].callback([], "ZERO_RESULT");
  assert.deepEqual(await pending, []);
});

test("provider errors reject instead of becoming no matches or triggering retries", async (t) => {
  const harness = installServices(t);
  for (const mode of ["keyword", "address"] as const) {
    for (const status of ["ERROR", "UNAUTHORIZED", "QUOTA_EXCEEDED"]) {
      const keywordsBefore = harness.keywords.length;
      const addressesBefore = harness.addresses.length;
      const pending = searchLocations("서울역", { mode });
      await Promise.resolve();
      const calls = mode === "keyword" ? harness.keywords : harness.addresses;
      const rejection = assert.rejects(pending, /인증 또는 사용량 제한/);
      calls[calls.length - 1].callback([], status);
      await rejection;
      assert.equal(
        harness.keywords.length,
        keywordsBefore + (mode === "keyword" ? 1 : 0),
      );
      assert.equal(
        harness.addresses.length,
        addressesBefore + (mode === "address" ? 1 : 0),
      );
    }
  }
});

test("address fallback failure is an error and cannot trigger a third request", async (t) => {
  const harness = installServices(t);
  const pending = searchLocations("서울역");
  await Promise.resolve();
  harness.keywords[0].callback([], "ZERO_RESULT");
  const rejection = assert.rejects(pending, /인증 또는 사용량 제한/);
  harness.addresses[0].callback([], "ERROR");
  await rejection;
  harness.keywords[0].callback([], "ZERO_RESULT");
  harness.addresses[0].callback([], "ZERO_RESULT");
  assert.equal(harness.keywords.length, 1);
  assert.equal(harness.addresses.length, 1);
});

test("invalid coordinates are discarded while zero and geographic boundaries are valid", async (t) => {
  const harness = installServices(t);
  const pending = searchLocations("좌표 검색");
  await Promise.resolve();
  const invalid = [
    NaN,
    Infinity,
    "NaN",
    "Infinity",
    "",
    " ",
    null,
    undefined,
    true,
    {},
  ];
  harness.keywords[0].callback(
    [
      ...invalid.map((y, index) => place({ id: `bad-lat-${index}`, y })),
      ...invalid.map((x, index) => place({ id: `bad-lng-${index}`, x })),
      place({ id: "bad-lat", y: 90.001 }),
      place({ id: "bad-lng", x: -180.001 }),
      place({ id: "zero", y: "0", x: 0 }),
      place({ id: "north-east", y: 90, x: 180 }),
      place({ id: "south-west", y: -90, x: -180 }),
    ],
    "OK",
  );
  const results = await pending;
  assert.deepEqual(
    results.map(({ lat, lng }) => [lat, lng]),
    [
      [0, 0],
      [90, 180],
      [-90, -180],
    ],
  );
  assert.equal(harness.addresses.length, 0);
});

test("results are capped at five unique places and stable ids do not depend on result order", async (t) => {
  const harness = installServices(t);
  const data = Array.from({ length: 7 }, (_, index) =>
    place({ id: String(index) }),
  );
  const first = searchLocations("서울역");
  await Promise.resolve();
  harness.keywords[0].callback([data[0], data[0], ...data.slice(1)], "OK");
  const firstResults = await first;
  assert.equal(firstResults.length, 5);
  assert.deepEqual(
    firstResults.map(({ id }) => id),
    [0, 1, 2, 3, 4].map((id) => `kakao:place:${id}`),
  );
  const second = searchLocations("서울역");
  await Promise.resolve();
  harness.keywords[1].callback([data[4], data[0]], "OK");
  const secondResults = await second;
  assert.equal(secondResults[0].id, firstResults[4].id);
  assert.equal(harness.keywords.length, 2);
});

test("places without provider ids and addresses have deterministic coordinate-bearing ids", async (t) => {
  const harness = installServices(t);
  const pending = searchLocations("서울역");
  await Promise.resolve();
  harness.keywords[0].callback(
    [
      place({ id: undefined, road_address_name: "" }),
      place({ id: undefined, road_address_name: "", y: "38" }),
    ],
    "OK",
  );
  const results = await pending;
  assert.equal(
    results[0].id,
    "kakao:address:서울 중구 봉래동2가:37.5547:126.9706",
  );
  assert.notEqual(results[0].id, results[1].id);

  const addressPending = searchLocations("서울 중구", { mode: "address" });
  await Promise.resolve();
  harness.addresses[0].callback(
    [
      {
        address: { address_name: "서울 중구" },
        y: "0",
        x: "0",
      },
    ],
    "OK",
  );
  assert.deepEqual(await addressPending, [
    {
      id: "kakao:address:서울 중구:0:0",
      name: "서울 중구",
      address: "서울 중구",
      lat: 0,
      lng: 0,
    },
  ]);
});

test("pre-aborted searches and aborts while waiting for SDK never call a provider", async (t) => {
  const harness = installServices(t);
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(
    searchLocations("서울역", { signal: preAborted.signal }),
    { name: "AbortError" },
  );
  const controller = new AbortController();
  const pending = searchLocations("서울역", { signal: controller.signal });
  const rejection = assert.rejects(pending, { name: "AbortError" });
  controller.abort();
  await rejection;
  assert.equal(harness.keywords.length, 0);
  assert.equal(harness.addresses.length, 0);
});

test("aborting an outstanding keyword search ignores stale results and fallback", async (t) => {
  const harness = installServices(t);
  const controller = new AbortController();
  const pending = searchLocations("서울역", { signal: controller.signal });
  await Promise.resolve();
  const rejection = assert.rejects(pending, { name: "AbortError" });
  controller.abort();
  await rejection;
  harness.keywords[0].callback([place()], "OK");
  harness.keywords[0].callback([], "ZERO_RESULT");
  assert.equal(harness.keywords.length, 1);
  assert.equal(harness.addresses.length, 0);
});

test("aborting the fallback suppresses its late response without affecting a new search", async (t) => {
  const harness = installServices(t);
  const controller = new AbortController();
  const stale = searchLocations("이전 검색", { signal: controller.signal });
  await Promise.resolve();
  harness.keywords[0].callback([], "ZERO_RESULT");
  const rejection = assert.rejects(stale, { name: "AbortError" });
  controller.abort();
  await rejection;
  const current = searchLocations("서울역");
  await Promise.resolve();
  harness.addresses[0].callback(
    [{ address_name: "이전 위치", y: 0, x: 0 }],
    "OK",
  );
  harness.keywords[1].callback([place()], "OK");
  assert.equal((await current)[0].name, "서울역");
  assert.equal(harness.addresses.length, 1);
});

test("request timeouts bound keyword and fallback waits and ignore late callbacks", async (t) => {
  const harness = installServices(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const fallback of [false, true]) {
    const pending = searchLocations("서울역");
    await Promise.resolve();
    const keyword = harness.keywords[harness.keywords.length - 1];
    if (fallback) {
      t.mock.timers.tick(9_000);
      keyword.callback([], "ZERO_RESULT");
    }
    const rejection = assert.rejects(pending, { name: "TimeoutError" });
    t.mock.timers.tick(fallback ? 1_000 : 10_000);
    await rejection;
    keyword.callback([place()], "OK");
    keyword.callback([], "ZERO_RESULT");
    if (fallback) {
      harness.addresses[0].callback([], "OK");
    }
  }
  assert.equal(harness.keywords.length, 2);
  assert.equal(harness.addresses.length, 1);
});

test("SDK errors propagate rather than being swallowed as empty search results", async (t) => {
  const harness = installServices(t);
  delete process.env.NEXT_PUBLIC_KAKAO_API_KEY;
  await assert.rejects(searchLocations("서울역"), /API 키/);
  assert.equal(harness.keywords.length, 0);
  assert.equal(harness.addresses.length, 0);
});

test("malformed OK responses resolve without an address fallback", async (t) => {
  const harness = installServices(t);
  for (const data of [
    null,
    {},
    [
      null,
      {},
      place({ place_name: "", road_address_name: "", address_name: "" }),
    ],
  ]) {
    const pending = searchLocations("서울역");
    await Promise.resolve();
    harness.keywords[harness.keywords.length - 1].callback(data, "OK");
    assert.deepEqual(await pending, []);
  }
  assert.equal(harness.addresses.length, 0);
});

test("synchronous provider exceptions reject and do not retry", async (t) => {
  const harness = installServices(t);
  harness.services.Places.prototype.keywordSearch = () => {
    throw new Error("provider failure");
  };
  await assert.rejects(searchLocations("서울역"), /인증 또는 사용량 제한/);
  assert.equal(harness.addresses.length, 0);
  harness.services.Geocoder.prototype.addressSearch = () => {
    throw new Error("provider failure");
  };
  await assert.rejects(
    searchLocations("서울역", { mode: "address" }),
    /인증 또는 사용량 제한/,
  );
});
