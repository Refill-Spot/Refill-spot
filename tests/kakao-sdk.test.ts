import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { loadKakaoMaps } from "../lib/kakao-sdk";
import { searchLocations } from "../lib/location-search";

const TEST_KEY = "a".repeat(32);

function readyMaps() {
  return {
    Map: class {},
    MarkerClusterer: class {},
    services: {
      Places: class {},
      Geocoder: class {},
      Status: { OK: "OK", ZERO_RESULT: "ZERO_RESULT", ERROR: "ERROR" },
    },
  };
}

function installHarness(t: TestContext) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const previousKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY;
  const browser: { kakao?: { maps: any } } = {};
  const scripts: FakeScript[] = [];
  let appendCount = 0;

  class FakeScript extends EventTarget {
    src = "";
    async = false;
    removed = false;

    remove() {
      this.removed = true;
      const index = scripts.indexOf(this);
      if (index !== -1) {
        scripts.splice(index, 1);
      }
    }
  }

  const document = {
    baseURI: "http://localhost:3100/",
    scripts,
    createElement(tag: string) {
      assert.equal(tag, "script");
      return new FakeScript();
    },
    head: {
      appendChild(script: FakeScript) {
        appendCount += 1;
        scripts.push(script);
        return script;
      },
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: browser,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });
  process.env.NEXT_PUBLIC_KAKAO_API_KEY = TEST_KEY;
  t.after(() => {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    if (previousDocument) {
      Object.defineProperty(globalThis, "document", previousDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
    if (previousKey === undefined) {
      delete process.env.NEXT_PUBLIC_KAKAO_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_KAKAO_API_KEY = previousKey;
    }
  });

  return {
    browser,
    scripts,
    get appendCount() {
      return appendCount;
    },
    addExisting(src: string) {
      const script = new FakeScript();
      script.src = src;
      scripts.push(script);
      return script;
    },
    complete(script = scripts[0]) {
      const maps = readyMaps();
      browser.kakao = {
        maps: {
          load: (callback: () => void) => {
            browser.kakao = { maps };
            callback();
          },
        },
      };
      script.dispatchEvent(new Event("load"));
      return maps;
    },
  };
}

test("concurrent consumers share one promise, script, and initialization", async (t) => {
  const harness = installHarness(t);
  const first = loadKakaoMaps();
  const second = loadKakaoMaps();
  assert.equal(first, second);
  assert.equal(harness.scripts.length, 1);
  assert.equal(harness.appendCount, 1);
  const script = harness.scripts[0];
  const url = new URL(script.src);
  assert.equal(url.origin, "https://dapi.kakao.com");
  assert.equal(url.pathname, "/v2/maps/sdk.js");
  assert.equal(url.searchParams.get("appkey"), TEST_KEY);
  assert.equal(url.searchParams.get("autoload"), "false");
  assert.equal(url.searchParams.get("libraries"), "services,clusterer");

  let initialized = 0;
  let callback: (() => void) | undefined;
  harness.browser.kakao = {
    maps: {
      load: (loaded: () => void) => {
        initialized += 1;
        callback = loaded;
      },
    },
  };
  script.dispatchEvent(new Event("load"));
  script.dispatchEvent(new Event("load"));
  assert.equal(initialized, 1);
  const maps = readyMaps();
  harness.browser.kakao = { maps };
  callback!();
  assert.equal(await first, maps);
  assert.equal(await second, maps);
  assert.equal(await loadKakaoMaps(), maps);
  assert.equal(harness.appendCount, 1);
});

test("map and location search consumers share the same SDK load", async (t) => {
  const harness = installHarness(t);
  const mapConsumer = loadKakaoMaps();
  const searchConsumer = searchLocations("서울역");
  assert.equal(harness.appendCount, 1);
  const maps = harness.complete();
  let calls = 0;
  maps.services.Places = class {
    keywordSearch(
      query: string,
      callback: (data: unknown, status: string) => void,
    ) {
      calls += 1;
      assert.equal(query, "서울역");
      callback(
        [
          {
            id: "123",
            place_name: "서울역",
            address_name: "서울 중구",
            y: "37.55",
            x: "126.97",
          },
        ],
        "OK",
      );
    }
  };
  assert.equal(await mapConsumer, maps);
  assert.equal((await searchConsumer)[0].id, "kakao:place:123");
  assert.equal(calls, 1);
  assert.equal(harness.appendCount, 1);
});

test("canceling one consumer during SDK loading does not cancel map initialization", async (t) => {
  const harness = installHarness(t);
  const mapConsumer = loadKakaoMaps();
  const controller = new AbortController();
  const searchConsumer = searchLocations("서울역", {
    signal: controller.signal,
  });
  const rejection = assert.rejects(searchConsumer, { name: "AbortError" });
  controller.abort();
  await rejection;
  assert.equal(harness.scripts[0].removed, false);
  const maps = harness.complete();
  let calls = 0;
  maps.services.Places = class {
    keywordSearch() {
      calls += 1;
    }
  };
  assert.equal(await mapConsumer, maps);
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.equal(harness.appendCount, 1);
});

test("a fully loaded SDK is reused without adding a script", async (t) => {
  const harness = installHarness(t);
  const maps = readyMaps();
  harness.browser.kakao = { maps };
  assert.equal(await loadKakaoMaps(), maps);
  assert.equal(harness.scripts.length, 0);
});

test("Map alone or missing clustering cannot be mistaken for a ready SDK", async (t) => {
  const harness = installHarness(t);
  for (const maps of [
    { Map: class {} },
    { ...readyMaps(), MarkerClusterer: undefined },
  ]) {
    harness.browser.kakao = { maps };
    const pending = loadKakaoMaps();
    assert.equal(harness.scripts.length, 1);
    const script = harness.scripts[0];
    const rejection = assert.rejects(pending, /라이브러리/);
    harness.browser.kakao = {
      maps: { ...maps, load: (callback: () => void) => callback() },
    };
    script.dispatchEvent(new Event("load"));
    await rejection;
    assert.equal(script.removed, true);
    assert.equal(harness.scripts.length, 0);
  }
});

test("invalid or missing keys cause no script request and never enter errors", async (t) => {
  const harness = installHarness(t);
  for (const key of [undefined, "", "  ", "demo", "invalid-secret-key"]) {
    if (key === undefined) {
      delete process.env.NEXT_PUBLIC_KAKAO_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_KAKAO_API_KEY = key;
    }
    await assert.rejects(loadKakaoMaps(), (error: Error) => {
      assert.match(error.message, /API 키/);
      if (key?.trim()) {
        assert.ok(!error.message.includes(key));
      }
      return true;
    });
    assert.equal(harness.appendCount, 0);
  }
});

test("script failure removes only the owned script and a later call can retry", async (t) => {
  const harness = installHarness(t);
  const unrelated = harness.addExisting("https://example.com/other.js");
  const pending = loadKakaoMaps();
  const failedScript = harness.scripts[1];
  const rejection = assert.rejects(pending, (error: Error) => {
    assert.match(error.message, /불러오지 못/);
    assert.ok(!error.message.includes(TEST_KEY));
    return true;
  });
  failedScript.dispatchEvent(new Event("error"));
  await rejection;
  assert.equal(failedScript.removed, true);
  assert.equal(unrelated.removed, false);
  const retry = loadKakaoMaps();
  const maps = harness.complete(harness.scripts[1]);
  assert.equal(await retry, maps);
  assert.equal(harness.appendCount, 2);
  assert.equal(harness.scripts.length, 2);
});

test("script and initialization timeouts clean up and ignore stale callbacks", async (t) => {
  const harness = installHarness(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const initialize of [false, true]) {
    let staleCallback: (() => void) | undefined;
    const pending = loadKakaoMaps();
    const failedScript = harness.scripts[0];
    if (initialize) {
      harness.browser.kakao = {
        maps: {
          load: (callback: () => void) => {
            staleCallback = callback;
          },
        },
      };
      failedScript.dispatchEvent(new Event("load"));
    }
    const rejection = assert.rejects(pending, { name: "TimeoutError" });
    t.mock.timers.tick(10_000);
    await rejection;
    assert.equal(failedScript.removed, true);
    assert.equal(harness.scripts.length, 0);
    staleCallback?.();
    const retry = loadKakaoMaps();
    const maps = harness.complete();
    assert.equal(await retry, maps);
    harness.scripts[0].remove();
    harness.browser.kakao = undefined;
  }
});

test("an existing protocol-relative script is adopted without duplication", async (t) => {
  const harness = installHarness(t);
  const existing = harness.addExisting(
    `//dapi.kakao.com/v2/maps/sdk.js?appkey=${TEST_KEY}&autoload=false&libraries=services,clusterer`,
  );
  const pending = loadKakaoMaps();
  assert.equal(harness.appendCount, 0);
  assert.equal(harness.scripts.length, 1);
  const maps = harness.complete(existing);
  assert.equal(await pending, maps);
  assert.equal(existing.removed, false);
});

test("failure of an adopted script does not remove it or create another", async (t) => {
  const harness = installHarness(t);
  const existing = harness.addExisting(
    `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${TEST_KEY}`,
  );
  const pending = loadKakaoMaps();
  const rejection = assert.rejects(pending, /불러오지 못/);
  existing.dispatchEvent(new Event("error"));
  await rejection;
  assert.equal(existing.removed, false);
  assert.equal(harness.appendCount, 0);
  const retry = loadKakaoMaps();
  const maps = harness.complete(existing);
  assert.equal(await retry, maps);
  assert.equal(harness.scripts.length, 1);
});

test("an existing bootstrap namespace is initialized using its script", async (t) => {
  const harness = installHarness(t);
  harness.addExisting(
    `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${TEST_KEY}&autoload=false`,
  );
  const maps = readyMaps();
  let initialized = 0;
  harness.browser.kakao = {
    maps: {
      load: (callback: () => void) => {
        initialized += 1;
        harness.browser.kakao = { maps };
        callback();
      },
    },
  };
  assert.equal(await loadKakaoMaps(), maps);
  assert.equal(initialized, 1);
  assert.equal(harness.appendCount, 0);
});

test("missing bootstrap or throwing initialization is rejected and cleaned up", async (t) => {
  const harness = installHarness(t);
  for (const maps of [
    undefined,
    {
      load: () => {
        throw new Error(TEST_KEY);
      },
    },
  ]) {
    harness.browser.kakao = maps ? { maps } : undefined;
    const pending = loadKakaoMaps();
    const script = harness.scripts[0];
    const rejection = assert.rejects(pending, (error: Error) => {
      assert.match(error.message, /초기화/);
      assert.ok(!error.message.includes(TEST_KEY));
      return true;
    });
    script.dispatchEvent(new Event("load"));
    await rejection;
    assert.equal(script.removed, true);
  }
});

test("server-side callers fail without inspecting server credentials", async (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Reflect.deleteProperty(globalThis, "window");
  t.after(() => {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    }
  });
  await assert.rejects(loadKakaoMaps(), /브라우저/);
});
