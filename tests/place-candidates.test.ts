import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext, Script } from "node:vm";
import {
  createNaverLookupCode,
  fetchKakaoCandidates,
  parseNaverLookupOutput,
} from "../lib/place-candidates";
import type { PlaceCandidate, StoreIdentity } from "../lib/place-matching";

function store(overrides: Partial<StoreIdentity> = {}): StoreIdentity {
  return {
    id: 1,
    name: "  채선당 월남쌈&샤브샤브 올림픽공원점  ",
    address: "  서울특별시 강동구 강동대로 143-22 삼광빌딩 1층  ",
    phoneNumber: "02-484-4759",
    position: { lat: 37.522, lng: 127.118 },
    ...overrides,
  };
}

function kakaoDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "123456",
    place_name: "채선당 월남쌈&샤브샤브 올림픽공원점",
    road_address_name: "서울특별시 강동구 강동대로 143-22",
    address_name: "서울특별시 강동구 성내동 448-19",
    phone: "02-484-4759",
    x: "127.118",
    y: "37.522",
    place_url: "https://untrusted.example/never-use-this",
    ...overrides,
  };
}

function jsonFetch(body: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
}

test("Kakao uses official keyword search, bounded geographic bias and authorization header only", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://dapi.kakao.com");
    assert.equal(url.pathname, "/v2/local/search/keyword.json");
    assert.equal(
      url.searchParams.get("query"),
      "서울특별시 강동구 채선당 월남쌈&샤브샤브 올림픽공원점",
    );
    assert.equal(url.searchParams.get("size"), "15");
    assert.equal(url.searchParams.get("x"), "127.118");
    assert.equal(url.searchParams.get("y"), "37.522");
    assert.equal(url.searchParams.get("radius"), "2000");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "KakaoAK private-api-key",
    );
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(init.signal.aborted, false);
    assert.doesNotMatch(String(input), /private-api-key|삼광빌딩/);
    return new Response(JSON.stringify({ documents: [kakaoDocument()] }));
  };
  assert.deepEqual(
    await fetchKakaoCandidates(store(), "private-api-key", fetchImpl),
    [
      {
        id: "123456",
        name: "채선당 월남쌈&샤브샤브 올림픽공원점",
        address:
          "서울특별시 강동구 강동대로 143-22 서울특별시 강동구 성내동 448-19",
        phoneNumber: "02-484-4759",
        lat: 37.522,
        lng: 127.118,
        url: "https://place.map.kakao.com/123456",
      },
    ],
  );
  assert.equal(calls, 1);
});

test("Kakao omits all geographic parameters for invalid, nonfinite or zero coordinates", async () => {
  for (const position of [
    { lat: 0, lng: 127 },
    { lat: 37, lng: 0 },
    { lat: NaN, lng: 127 },
    { lat: 37, lng: Infinity },
    { lat: -Infinity, lng: 127 },
    { lat: 90.1, lng: 127 },
    { lat: 37, lng: 180.1 },
    { lat: -90.1, lng: 127 },
    { lat: 37, lng: -180.1 },
  ]) {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      for (const parameter of ["x", "y", "radius"])
        assert.equal(url.searchParams.has(parameter), false);
      return new Response('{"documents":[]}');
    };
    assert.deepEqual(
      await fetchKakaoCandidates(store({ position }), "key", fetchImpl),
      [],
    );
  }
});

test("Kakao does not duplicate identical addresses or turn empty coordinates and phones into zero", async () => {
  const result = await fetchKakaoCandidates(
    store(),
    "key",
    jsonFetch({
      documents: [
        kakaoDocument({
          road_address_name: " 서울 강동구   성내동 1 ",
          address_name: "서울 강동구 성내동 1",
          x: "  ",
          y: "",
          phone: " ",
        }),
      ],
    }),
  );
  assert.equal(result[0].address, "서울 강동구 성내동 1");
  assert.equal(result[0].lat, null);
  assert.equal(result[0].lng, null);
  assert.equal(result[0].phoneNumber, null);
  const roadless = await fetchKakaoCandidates(
    store(),
    "key",
    jsonFetch({ documents: [kakaoDocument({ road_address_name: "" })] }),
  );
  assert.equal(roadless[0].address, "서울특별시 강동구 성내동 448-19");
});

test("Kakao validates stores and keys before issuing requests without exposing their values", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    throw new Error("must not fetch");
  };
  for (const value of [
    store({ id: 0 }),
    store({ name: " " }),
    store({ address: "" }),
    { ...store(), position: { lat: "37", lng: 127 } },
    { ...store(), phoneNumber: 123 },
  ]) {
    await assert.rejects(
      fetchKakaoCandidates(
        value as StoreIdentity,
        "private-api-key",
        fetchImpl,
      ),
      /^Error: INVALID_STORE_INPUT$/,
    );
  }
  for (const key of ["", "  ", "secret\nheader"]) {
    await assert.rejects(
      fetchKakaoCandidates(store(), key, fetchImpl),
      /^Error: INVALID_KAKAO_API_KEY$/,
    );
  }
  assert.equal(calls, 0);
});

test("Kakao distinguishes valid empty results from malformed or non-OK responses", async () => {
  assert.deepEqual(
    await fetchKakaoCandidates(store(), "key", jsonFetch({ documents: [] })),
    [],
  );
  const invalidBodies = [
    null,
    {},
    { documents: {} },
    { documents: [null] },
    { documents: [kakaoDocument({ id: "0" })] },
    { documents: [kakaoDocument({ id: "0123" })] },
    { documents: [kakaoDocument({ id: "123\n" })] },
    { documents: [kakaoDocument({ id: "123/456" })] },
    { documents: [kakaoDocument({ place_name: " " })] },
    { documents: [kakaoDocument({ x: "NaN" })] },
    { documents: [kakaoDocument({ x: "0x10" })] },
    { documents: [kakaoDocument({ x: null })] },
    { documents: [kakaoDocument({ x: "180.1" })] },
    { documents: [kakaoDocument({ y: "-90.1" })] },
    { documents: [kakaoDocument({ phone: null })] },
    {
      documents: [kakaoDocument({ road_address_name: "", address_name: " " })],
    },
    { documents: Array.from({ length: 16 }, () => kakaoDocument()) },
  ];
  for (const body of invalidBodies) {
    await assert.rejects(
      fetchKakaoCandidates(store(), "key", jsonFetch(body)),
      /^Error: KAKAO_INVALID_RESPONSE$/,
    );
  }
  const failedFetch: typeof fetch = async () =>
    new Response("private raw response", { status: 401 });
  await assert.rejects(
    fetchKakaoCandidates(store(), "key", failedFetch),
    /^Error: KAKAO_HTTP_ERROR$/,
  );
  const invalidJson: typeof fetch = async () =>
    new Response("private raw response");
  await assert.rejects(
    fetchKakaoCandidates(store(), "key", invalidJson),
    /^Error: KAKAO_INVALID_RESPONSE$/,
  );
});

test("Kakao network failures never print credentials or propagate raw errors", async (t) => {
  const errorLog = t.mock.method(console, "error", () => {});
  const log = t.mock.method(console, "log", () => {});
  const failedFetch: typeof fetch = async () => {
    throw new Error("private-api-key private response");
  };
  await assert.rejects(
    fetchKakaoCandidates(store(), "private-api-key", failedFetch),
    /^Error: KAKAO_REQUEST_FAILED$/,
  );
  assert.equal(errorLog.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 0);
});

test("Kakao times out after 15 seconds even if fetch ignores its abort signal", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const signals: AbortSignal[] = [];
  const stalled: typeof fetch = async (_input, init) => {
    if (init?.signal) signals.push(init.signal);
    return new Promise<Response>(() => {});
  };
  const pending = fetchKakaoCandidates(store(), "key", stalled);
  const rejected = assert.rejects(pending, /^Error: KAKAO_TIMEOUT$/);
  t.mock.timers.tick(14_999);
  assert.equal(signals[0].aborted, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(signals[0].aborted, true);
});

test("Kakao deadline also bounds body parsing", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stalledBody: typeof fetch = async () =>
    ({ ok: true, json: () => new Promise(() => {}) }) as Response;
  const pending = fetchKakaoCandidates(store(), "key", stalledBody);
  const rejected = assert.rejects(pending, /^Error: KAKAO_TIMEOUT$/);
  await Promise.resolve();
  t.mock.timers.tick(15_000);
  await rejected;
});

interface FakeElement {
  textContent: string;
  innerText: string;
  shown: boolean;
  getClientRects(): unknown[];
  getAttribute(name: string): string | null;
  closest(selector: string): FakeElement | null;
  querySelector(selector: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
}

function element(
  text = "",
  attributes: Record<string, string> = {},
  shown = true,
): FakeElement {
  return {
    textContent: text,
    innerText: text,
    shown,
    getClientRects: () => (shown ? [{}] : []),
    getAttribute: (name) => attributes[name] ?? null,
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

function placeAnchor(
  options: {
    id?: string;
    href?: string;
    name?: string;
    share?: string | null;
    addressButton?: string;
    tel?: string;
    shown?: boolean;
    omitItem?: boolean;
  } = {},
): FakeElement {
  const anchor = element(
    "",
    {
      href:
        options.href ??
        `https://m.place.naver.com/place/${options.id ?? "123456"}/home`,
    },
    options.shown ?? true,
  );
  const item = element();
  const strong = element(options.name ?? "채선당 월남쌈&샤브샤브 올림픽공원점");
  const shareText =
    options.share === undefined
      ? "채선당 월남쌈&샤브샤브 올림픽공원점\n02-484-4759\n서울특별시 강동구 강동대로 143-22 삼광빌딩 1층 채선당"
      : options.share;
  const share =
    shareText === null
      ? null
      : element("공유", { "data-kakaotalk-title": shareText });
  const button = options.addressButton ? element(options.addressButton) : null;
  const tel = options.tel ? element("전화", { href: options.tel }) : null;
  anchor.closest = (selector) =>
    selector === "li" && !options.omitItem ? item : null;
  const selectors: Record<string, FakeElement | null> = {
    strong,
    "button[data-kakaotalk-title]": share,
    'a[href^="tel:"]': tel,
  };
  item.querySelector = (selector) => selectors[selector] ?? null;
  item.querySelectorAll = (selector) =>
    selector === "button"
      ? [share, button].filter((value): value is FakeElement => value !== null)
      : [];
  return anchor;
}

function documentFixture(
  anchors: FakeElement[] = [],
  bodyText = "장소 검색 결과",
) {
  return {
    title: "네이버 지도",
    body: { innerText: bodyText },
    querySelectorAll: (selector: string) =>
      selector === "a[href]" ? anchors : [],
  };
}

type FakeDocument = ReturnType<typeof documentFixture>;
interface BrowserScenario {
  documents?: FakeDocument[];
  gotoError?: string;
  titleError?: string;
  url?: string;
  title?: string;
}

async function executeLookup(
  stores: StoreIdentity[],
  scenarios: BrowserScenario[],
  options: {
    listError?: boolean;
    openError?: boolean;
    closeError?: boolean;
    withoutClose?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const logs: string[] = [];
  let clock = 0;
  let requestIndex = -1;
  let pollIndex = 0;
  let currentUrl = "";
  const sandbox: Record<string, unknown> = {
    URL,
    Date: { now: () => clock },
    setTimeout: (callback: () => void, delay: number) => {
      clock += delay;
      callback();
      return 0;
    },
    console: { log: (message: string) => logs.push(message) },
    document: documentFixture(),
    getComputedStyle: (node: FakeElement) => ({
      display: node.shown ? "block" : "none",
      visibility: "visible",
    }),
  };
  const page = {
    goto: async (url: string, init: { timeout: number; waitUntil: string }) => {
      calls.push(`goto:${url}`);
      assert.deepEqual(init.timeout, 15_000);
      assert.equal(init.waitUntil, "domcontentloaded");
      requestIndex++;
      pollIndex = 0;
      currentUrl = url;
      if (scenarios[requestIndex]?.gotoError)
        throw new Error(scenarios[requestIndex].gotoError);
    },
    url: () => {
      calls.push("url");
      return scenarios[requestIndex]?.url ?? currentUrl;
    },
    title: async () => {
      calls.push("title");
      if (scenarios[requestIndex]?.titleError)
        throw new Error(scenarios[requestIndex].titleError);
      return scenarios[requestIndex]?.title ?? "네이버 지도";
    },
    evaluate: async (callback: () => unknown) => {
      calls.push("evaluate");
      const documents = scenarios[requestIndex]?.documents ?? [
        documentFixture(),
      ];
      sandbox.document = documents[Math.min(pollIndex++, documents.length - 1)];
      return callback();
    },
    ...(options.withoutClose
      ? {}
      : {
          close: async () => {
            calls.push("close-own-page");
            if (options.closeError) throw new Error("private close error");
          },
        }),
  };
  sandbox.listBrowserTabs = async () => {
    calls.push("listBrowserTabs");
    if (options.listError) throw new Error("private profile error");
    return [
      {
        targetId: "unrelated-user-tab",
        url: "https://private.example/profile",
      },
    ];
  };
  sandbox.openTab = async (url: string) => {
    calls.push(`openTab:${url}`);
    if (options.openError) throw new Error("private browser error");
    requestIndex = 0;
    currentUrl = url;
    return page;
  };
  sandbox.snapshot = async (_page: unknown, init: { interactive: boolean }) => {
    calls.push("snapshot");
    assert.equal(_page, page);
    assert.equal(init.interactive, true);
    return "PRIVATE RAW SNAPSHOT NEVER LOG";
  };
  await runInNewContext(
    `(async () => { ${createNaverLookupCode(stores)} })()`,
    sandbox,
  );
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /private|PRIVATE|unrelated-user-tab/i);
  return { results: parseNaverLookupOutput(logs[0]), calls, logs, clock };
}

test("Naver generated code validates a five-store batch and includes only minimal query data", () => {
  assert.throws(
    () =>
      createNaverLookupCode(
        Array.from({ length: 6 }, (_, i) => store({ id: i + 1 })),
      ),
    /^Error: INVALID_STORE_INPUT$/,
  );
  assert.throws(
    () => createNaverLookupCode([store(), store()]),
    /^Error: INVALID_STORE_INPUT$/,
  );
  assert.throws(
    () => createNaverLookupCode([store({ name: "" })]),
    /^Error: INVALID_STORE_INPUT$/,
  );
  const code = createNaverLookupCode([
    store({
      name: '상호 "\\\n${throw new Error("injection")} 𠮷',
      phoneNumber: "private-phone-value",
    }),
  ]);
  assert.match(code, /^await \(async \(\) =>/);
  assert.doesNotThrow(() => new Script(`(async () => { ${code} })()`));
  assert.doesNotMatch(
    code,
    /attachBrowserTab|attachActiveBrowserTab|private-phone-value|삼광빌딩|__NEXT_DATA__|__INITIAL_STATE__|\.fetch\(|api\.place|className/,
  );
  assert.ok(
    code.indexOf("await listBrowserTabs()") < code.indexOf("await openTab("),
  );
  assert.match(code, /snapshot\(page, \{ interactive: true \}\)/);
});

test("Naver extracts visible public place links and share metadata without guessing coordinates or URLs", async () => {
  const valid = placeAnchor();
  const result = await executeLookup(
    [store()],
    [
      {
        documents: [
          documentFixture([
            valid,
            placeAnchor(),
            placeAnchor({ id: "0" }),
            placeAnchor({
              href: "https://m.place.naver.com/place/88/home?tracking=1",
            }),
            placeAnchor({ href: "https://evil.example/place/77/home" }),
            placeAnchor({ id: "99", shown: false }),
          ]),
        ],
      },
    ],
  );
  assert.deepEqual(result.results, [
    {
      storeId: 1,
      candidates: [
        {
          id: "123456",
          name: "채선당 월남쌈&샤브샤브 올림픽공원점",
          address: "서울특별시 강동구 강동대로 143-22 삼광빌딩 1층 채선당",
          phoneNumber: "02-484-4759",
          lat: null,
          lng: null,
          url: "https://m.place.naver.com/place/123456/home",
        },
      ],
    },
  ]);
  assert.deepEqual(result.calls.slice(0, 6), [
    "listBrowserTabs",
    `openTab:https://m.map.naver.com/search?query=${encodeURIComponent("서울특별시 강동구 채선당 월남쌈&샤브샤브 올림픽공원점")}`,
    "url",
    "title",
    "snapshot",
    "evaluate",
  ]);
  assert.equal(result.calls.at(-1), "close-own-page");
});

test("Naver falls back to a public address button and tel link when share metadata is unavailable", async () => {
  const result = await executeLookup(
    [store()],
    [
      {
        documents: [
          documentFixture([
            placeAnchor({
              share: null,
              addressButton: "주소보기\n서울 강동구 강동대로 143-22",
              tel: "tel:02-484-4759",
            }),
          ]),
        ],
      },
    ],
  );
  assert.equal(
    result.results[0].candidates[0].address,
    "서울 강동구 강동대로 143-22",
  );
  assert.equal(result.results[0].candidates[0].phoneNumber, "02-484-4759");
  const noPhone = await executeLookup(
    [store()],
    [
      {
        documents: [
          documentFixture([
            placeAnchor({
              share: "채선당\n서울 강동구 강동대로 143-22",
            }),
          ]),
        ],
      },
    ],
  );
  assert.equal(
    noPhone.results[0].candidates[0].address,
    "서울 강동구 강동대로 143-22",
  );
  assert.equal(noPhone.results[0].candidates[0].phoneNumber, null);
});

test("Naver polls loading UI, accepts explicit visible no-results only, and reports timeouts", async () => {
  const loaded = await executeLookup(
    [store()],
    [
      {
        documents: [
          documentFixture([], "검색 중..."),
          documentFixture([placeAnchor()]),
        ],
      },
    ],
  );
  assert.equal(loaded.results[0].candidates.length, 1);
  assert.equal(loaded.calls.filter((call) => call === "evaluate").length, 2);
  const empty = await executeLookup(
    [store()],
    [{ documents: [documentFixture([], "검색 결과가 없습니다.")] }],
  );
  assert.deepEqual(empty.results, [{ storeId: 1, candidates: [] }]);
  const timeout = await executeLookup(
    [store()],
    [{ documents: [documentFixture([], "검색 중...")] }],
  );
  assert.deepEqual(timeout.results, [
    { storeId: 1, candidates: [], error: "NAVER_TIMEOUT" },
  ]);
  assert.equal(timeout.clock, 15_000);
});

test("Naver never treats blocked, redirected, or malformed pages as an unmatched store", async () => {
  const cases: Array<{ scenario: BrowserScenario; error: string }> = [
    {
      scenario: {
        documents: [
          documentFixture([], "검색 결과가 없습니다.\n자동입력 방지 CAPTCHA"),
        ],
      },
      error: "NAVER_BLOCKED",
    },
    {
      scenario: { url: "https://nid.naver.com/login" },
      error: "NAVER_UNEXPECTED_PAGE",
    },
    {
      scenario: { url: "https://m.map.naver.com/search?query=wrong" },
      error: "NAVER_UNEXPECTED_PAGE",
    },
    { scenario: { title: "" }, error: "NAVER_UNEXPECTED_PAGE" },
    {
      scenario: { documents: [documentFixture([placeAnchor({ name: "" })])] },
      error: "NAVER_INVALID_RESULT",
    },
    {
      scenario: {
        documents: [documentFixture([placeAnchor({ share: null })])],
      },
      error: "NAVER_INVALID_RESULT",
    },
    {
      scenario: {
        documents: [documentFixture([placeAnchor({ omitItem: true })])],
      },
      error: "NAVER_INVALID_RESULT",
    },
    {
      scenario: {
        documents: [
          documentFixture(
            Array.from({ length: 101 }, (_, index) =>
              placeAnchor({ id: String(index + 1) }),
            ),
          ),
        ],
      },
      error: "NAVER_INVALID_RESULT",
    },
  ];
  for (const { scenario, error } of cases) {
    const result = await executeLookup([store()], [scenario]);
    assert.deepEqual(result.results, [{ storeId: 1, candidates: [], error }]);
  }
});

test("Naver processes sequentially in one owned tab, sanitizes per-store failures and closes only its page", async () => {
  const stores = Array.from({ length: 5 }, (_, index) =>
    store({ id: index + 1, name: `식당 ${index + 1}` }),
  );
  const result = await executeLookup(
    stores,
    [
      { titleError: "private profile error" },
      ...stores
        .slice(1)
        .map(() => ({ documents: [documentFixture([placeAnchor()])] })),
    ],
    { closeError: true },
  );
  assert.deepEqual(result.results[0], {
    storeId: 1,
    candidates: [],
    error: "NAVER_LOOKUP_FAILED",
  });
  assert.deepEqual(
    result.results.map((entry) => entry.storeId),
    [1, 2, 3, 4, 5],
  );
  assert.ok(
    result.results.slice(1).every((entry) => entry.candidates.length === 1),
  );
  assert.equal(
    result.calls.filter((call) => call.startsWith("openTab:")).length,
    1,
  );
  assert.equal(
    result.calls.filter((call) => call.startsWith("goto:")).length,
    4,
  );
  assert.equal(
    result.calls.filter((call) => call === "close-own-page").length,
    1,
  );
  const withoutClose = await executeLookup(
    [store()],
    [{ documents: [documentFixture([], "검색 결과가 없습니다.")] }],
    { withoutClose: true },
  );
  assert.deepEqual(withoutClose.results, [{ storeId: 1, candidates: [] }]);
});

test("Naver browser initialization failures are explicit and do not expose tab or profile data", async () => {
  for (const options of [{ listError: true }, { openError: true }]) {
    const result = await executeLookup(
      [store(), store({ id: 2 })],
      [],
      options,
    );
    assert.deepEqual(result.results, [
      { storeId: 1, candidates: [], error: "NAVER_BROWSER_UNAVAILABLE" },
      { storeId: 2, candidates: [], error: "NAVER_BROWSER_UNAVAILABLE" },
    ]);
    assert.equal(result.calls.includes("close-own-page"), false);
  }
  const empty = await executeLookup([], []);
  assert.deepEqual(empty.results, []);
  assert.deepEqual(empty.calls, ["listBrowserTabs"]);
});

const naverCandidate: PlaceCandidate = {
  id: "123456",
  name: "채선당 올림픽공원점",
  address: "서울 강동구 강동대로 143-22",
  phoneNumber: null,
  lat: null,
  lng: null,
  url: "https://m.place.naver.com/place/123456/home",
};
const marker = "PLACE_CANDIDATES_JSON:";

test("Naver output parser extracts exactly one marker and validates candidate and error contracts", () => {
  const results = [
    { storeId: 1, candidates: [naverCandidate] },
    { storeId: 2, candidates: [], error: "NAVER_TIMEOUT" },
  ];
  assert.deepEqual(
    parseNaverLookupOutput(
      `CLI preamble\r\n${marker}${JSON.stringify(results)}\r\nCLI done`,
    ),
    results,
  );
  assert.deepEqual(
    parseNaverLookupOutput(
      `Receipt: ${marker}${JSON.stringify(results)} (done)`,
    ),
    results,
  );
  const bracketedName = [
    {
      storeId: 1,
      candidates: [{ ...naverCandidate, name: '식당 ] } " \\ 지점' }],
    },
  ];
  assert.deepEqual(
    parseNaverLookupOutput(
      `Receipt: ${marker}${JSON.stringify(bracketedName)} (done)`,
    ),
    bracketedName,
  );
  for (const raw of [
    "",
    JSON.stringify(results),
    `${marker}{`,
    `${marker}[]\n${marker}[]`,
    `${marker}[`,
    `${marker}[}]`,
  ]) {
    assert.throws(
      () => parseNaverLookupOutput(raw),
      /^Error: INVALID_NAVER_OUTPUT$/,
    );
  }
  const invalidResults = [
    {},
    [{ storeId: 1, candidates: [], rawSnapshot: "private raw output" }],
    [{ storeId: 1, candidates: [], error: "private raw provider error" }],
    [{ storeId: 1, candidates: [naverCandidate], error: "NAVER_TIMEOUT" }],
    [{ storeId: 0, candidates: [] }],
    [
      { storeId: 1, candidates: [] },
      { storeId: 1, candidates: [] },
    ],
    [{ storeId: 1, candidates: [naverCandidate, naverCandidate] }],
    ...[
      { id: "0123" },
      { id: 123456 },
      { name: " " },
      { address: "" },
      { phoneNumber: "" },
      { lat: 91 },
      { lng: "NaN" },
      { url: "https://evil.example/123456" },
      { url: "https://m.place.naver.com/place/999/home" },
      { url: "https://m.place.naver.com/place/123456/home?redirect=evil" },
      { rawBody: "private" },
    ].map((override) => [
      { storeId: 1, candidates: [{ ...naverCandidate, ...override }] },
    ]),
    Array.from({ length: 6 }, (_, index) => ({
      storeId: index + 1,
      candidates: [],
    })),
  ];
  for (const value of invalidResults) {
    assert.throws(
      () => parseNaverLookupOutput(marker + JSON.stringify(value)),
      /^Error: INVALID_NAVER_OUTPUT$/,
    );
  }
});
