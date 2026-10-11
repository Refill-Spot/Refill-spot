import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { create } from "zustand";
import type { StoreFilters } from "../hooks/use-stores";
import { extractFiltersFromURL } from "../lib/api-utils";
import { coordinateSchema } from "../lib/validations";

type Element = { type: unknown; props: Record<string, any> };
type Coordinates = { latitude: number; longitude: number };

// Execute the actual store, hooks and page with isolated dependencies and no live I/O.
function loadModule(
  path: string,
  dependencies: Record<string, unknown>,
  globals: Record<string, unknown> = {},
) {
  const exported: Record<string, any> = {};
  const compiled = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const forbidden = () => {
    throw new Error(
      "Coordinate dispatch tests must not call external services",
    );
  };
  runInNewContext(compiled.outputText, {
    exports: exported,
    AbortController,
    DOMException,
    Error,
    URLSearchParams,
    window: { location: { pathname: "/map" } },
    navigator: {},
    console: { error: () => {}, log: () => {}, warn: () => {} },
    fetch: forbidden,
    setTimeout: forbidden,
    clearTimeout: forbidden,
    ...globals,
    require: (id: string) => {
      assert.ok(
        Object.hasOwn(dependencies, id),
        `Unexpected dependency: ${id}`,
      );
      return dependencies[id];
    },
  });
  return exported;
}

function hookHarness() {
  const states: any[] = [];
  const refs: Array<{ current: any }> = [];
  const callbacks: Array<{ value: any; dependencies: unknown[] }> = [];
  const memos: Array<{ value: any; dependencies: unknown[] }> = [];
  const effects: Array<{
    dependencies?: unknown[];
    cleanup?: () => void;
  }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let memoIndex = 0;
  let effectIndex = 0;
  let pendingEffects: Array<() => void> = [];
  let dirty = false;
  const same = (left: unknown[] | undefined, right: unknown[] | undefined) =>
    left !== undefined &&
    right !== undefined &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]));
  const hooks = {
    Suspense: "Suspense",
    memo: (component: unknown) => component,
    useState: (initial: any) => {
      const index = stateIndex++;
      if (!(index in states)) {
        states[index] = typeof initial === "function" ? initial() : initial;
      }
      return [
        states[index],
        (update: any) => {
          const next =
            typeof update === "function" ? update(states[index]) : update;
          if (!Object.is(next, states[index])) {
            states[index] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef: (initial: any) => {
      const index = refIndex++;
      refs[index] ??= { current: initial };
      return refs[index];
    },
    useCallback: (callback: any, dependencies: unknown[]) => {
      const index = callbackIndex++;
      if (!same(callbacks[index]?.dependencies, dependencies)) {
        callbacks[index] = { value: callback, dependencies: [...dependencies] };
      }
      return callbacks[index].value;
    },
    useMemo: (factory: () => unknown, dependencies: unknown[]) => {
      const index = memoIndex++;
      if (!same(memos[index]?.dependencies, dependencies)) {
        memos[index] = { value: factory(), dependencies: [...dependencies] };
      }
      return memos[index].value;
    },
    useEffect: (
      callback: () => void | (() => void),
      dependencies?: unknown[],
    ) => {
      const index = effectIndex++;
      if (!same(effects[index]?.dependencies, dependencies)) {
        pendingEffects.push(() => {
          effects[index]?.cleanup?.();
          const cleanup = callback();
          effects[index] = {
            dependencies: dependencies && [...dependencies],
            cleanup: typeof cleanup === "function" ? cleanup : undefined,
          };
        });
      }
    },
  };
  return {
    hooks,
    render<T>(callback: () => T): T {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        stateIndex = refIndex = callbackIndex = memoIndex = effectIndex = 0;
        dirty = false;
        pendingEffects = [];
        const result = callback();
        for (const effect of pendingEffects) effect();
        if (!dirty) return result;
      }
      throw new Error("Unexpected render loop");
    },
    cleanup: () => effects.forEach((effect) => effect.cleanup?.()),
  };
}

function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}

const zeroPairs: Coordinates[] = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 127 },
  { latitude: 37, longitude: 0 },
  { latitude: -90, longitude: -180 },
  { latitude: 90, longitude: 180 },
];
const invalidPairs: StoreFilters[] = [
  { latitude: 0 },
  { longitude: 0 },
  { latitude: undefined, longitude: undefined },
  { latitude: NaN, longitude: 127 },
  { latitude: 37, longitude: Infinity },
  { latitude: -Infinity, longitude: 0 },
  { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: -181 },
];

function loadStore(providerError?: Error) {
  const calls: Array<{ kind: "all" | "filtered"; filters?: StoreFilters }> = [];
  const sentinel = [{ id: 1, name: "Selected stores" }];
  const forbidden = () => {
    throw new Error("Unrelated store action called");
  };
  const { useStoreStore: store } = loadModule("lib/store.ts", {
    zustand: { create },
    "@/lib/api-utils": {
      fetchAllStores: async () => {
        calls.push({ kind: "all" });
        return sentinel;
      },
      fetchFilteredStores: async (filters: StoreFilters) => {
        calls.push({ kind: "filtered", filters: structuredClone(filters) });
        if (providerError) throw providerError;
        return sentinel;
      },
    },
    "@/lib/validations": { coordinateSchema },
    "@/lib/stores": { getStoreById: forbidden, mapStoreFromDb: forbidden },
    "@/lib/supabase/client": { supabaseBrowser: { from: forbidden } },
  });
  return { store, calls };
}

function loadStoresHook(providerError?: Error, initialFilters?: StoreFilters) {
  const harness = hookHarness();
  const calls: Array<{ kind: "all" | "filtered"; filters?: StoreFilters }> = [];
  const toasts: Array<Record<string, any>> = [];
  const toast = (message: Record<string, any>) => toasts.push(message);
  const t = (key: string) => key;
  const { useFetchStores } = loadModule("hooks/use-stores.ts", {
    react: harness.hooks,
    "@/components/ui/use-toast": { useToast: () => ({ toast }) },
    "@/hooks/use-translation": { useTranslation: () => ({ t }) },
    "@/lib/validations": { coordinateSchema },
    "@/lib/api-utils": {
      fetchAllStores: async () => {
        calls.push({ kind: "all" });
        return [{ id: 2 }];
      },
      fetchFilteredStores: async (filters: StoreFilters) => {
        calls.push({ kind: "filtered", filters: structuredClone(filters) });
        if (providerError) throw providerError;
        return [{ id: 1 }];
      },
    },
  });
  const render = () => harness.render(() => useFetchStores(initialFilters));
  render();
  return { calls, toasts, render, cleanup: harness.cleanup };
}

test("Zustand dispatch preserves zero/boundary coordinate pairs and rejects invalid locations", async () => {
  for (const coordinates of zeroPairs) {
    const { store, calls } = loadStore();
    store.setState({ filters: { ...coordinates, maxDistance: 3 } });
    await store.getState().fetchFilteredStores();
    assert.deepEqual(calls, [
      { kind: "filtered", filters: { ...coordinates, maxDistance: 3 } },
    ]);
    assert.equal(store.getState().stores[0].id, 1);
    assert.equal(store.getState().loading, false);
  }
  for (const filters of [{}, ...invalidPairs]) {
    const { store, calls } = loadStore();
    store.setState({ filters });
    await store.getState().fetchFilteredStores();
    assert.deepEqual(calls, [{ kind: "all" }]);
  }
});

test("Zustand explicit coordinate clears are not merged back and provider failures remain errors", async () => {
  const cleared = loadStore();
  cleared.store.setState({
    filters: { latitude: 37, longitude: 127, maxDistance: 5 },
  });
  cleared.store.getState().updateFilters({
    latitude: undefined,
    longitude: undefined,
    maxDistance: undefined,
  });
  await setImmediate();
  assert.deepEqual(cleared.calls, [{ kind: "all" }]);
  assert.equal(cleared.store.getState().filters.latitude, undefined);
  assert.equal(cleared.store.getState().filters.longitude, undefined);
  assert.equal(cleared.store.getState().filters.maxDistance, undefined);

  const failed = loadStore(new Error("Provider unavailable"));
  failed.store.setState({ filters: zeroPairs[0] });
  await failed.store.getState().fetchFilteredStores();
  assert.equal(failed.calls.length, 1);
  assert.equal(failed.calls[0].kind, "filtered");
  assert.equal(failed.store.getState().error, "Provider unavailable");
  assert.equal(failed.store.getState().loading, false);
});

test("useFetchStores routes zero pairs to filtering and incomplete/nonfinite pairs to no-location fetching", async () => {
  for (const coordinates of zeroPairs) {
    const harness = loadStoresHook();
    harness.render().setFilters(coordinates);
    harness.render();
    await setImmediate();
    assert.deepEqual(harness.calls, [
      { kind: "filtered", filters: coordinates },
    ]);
    assert.equal(harness.render().stores[0].id, 1);
    assert.equal(harness.render().loading, false);
    harness.cleanup();
  }
  for (const filters of [{}, ...invalidPairs]) {
    const harness = loadStoresHook();
    harness.render().setFilters(filters);
    harness.render();
    await setImmediate();
    assert.deepEqual(harness.calls, [{ kind: "all" }]);
    harness.cleanup();
  }
});

test("useFetchStores respects explicit undefined clears after a zero location was applied", async () => {
  const harness = loadStoresHook();
  harness.render().setFilters({ latitude: 0, longitude: 0, maxDistance: 3 });
  harness.render();
  await setImmediate();
  harness.render().setFilters({
    latitude: undefined,
    longitude: undefined,
    maxDistance: undefined,
    categories: ["카페"],
  });
  harness.render();
  await setImmediate();
  assert.deepEqual(harness.calls[1], {
    kind: "filtered",
    filters: {
      latitude: undefined,
      longitude: undefined,
      maxDistance: undefined,
      categories: ["카페"],
    },
  });
  assert.equal(harness.render().error, null);
  harness.cleanup();
});

test("useFetchStores reports query/coordinate provider failures without retrying or returning all stores", async () => {
  for (const filters of [
    { query: "카페" },
    { latitude: 0, longitude: 0, maxDistance: 3 },
  ]) {
    const harness = loadStoresHook(new Error("Provider unavailable"));
    harness.render().setFilters(filters);
    harness.render();
    await setImmediate();
    assert.deepEqual(harness.calls, [{ kind: "filtered", filters }]);
    assert.equal(harness.render().error, "Provider unavailable");
    assert.equal(harness.render().loading, false);
    assert.equal(harness.render().stores.length, 0);
    assert.equal(harness.toasts[0].description, "Provider unavailable");
    harness.cleanup();
  }
});

function loadMapHook(query = "", providerError: string | null = null) {
  const harness = hookHarness();
  const updates: StoreFilters[] = [];
  const redirects: string[] = [];
  const toasts: Array<Record<string, any>> = [];
  const timers: Array<() => void> = [];
  let searchParams = new URLSearchParams(query);
  let filters: StoreFilters = {};
  let resets = 0;
  let refetches = 0;
  const setFilters = (patch: StoreFilters) => {
    updates.push(structuredClone(patch));
    filters = Object.keys(patch).length ? { ...filters, ...patch } : {};
  };
  const resetFilters = () => {
    resets += 1;
    filters = {};
  };
  const refetch = () => {
    refetches += 1;
  };
  const router = { replace: (url: string) => redirects.push(url) };
  const toast = (message: Record<string, any>) => toasts.push(message);
  const t = (key: string) => key;
  const { useMapView } = loadModule(
    "hooks/use-map-view.ts",
    {
      react: harness.hooks,
      "@/components/ui/use-toast": { useToast: () => ({ toast }) },
      "@/hooks/use-translation": { useTranslation: () => ({ t }) },
      "@/lib/api-utils": { extractFiltersFromURL },
      "@/lib/validations": { coordinateSchema },
      "./use-stores": {
        useFetchStores: () => ({
          stores: [],
          loading: false,
          error: providerError,
          setFilters,
          resetFilters,
          refetch,
        }),
      },
      "next/navigation": {
        useRouter: () => router,
        useSearchParams: () => searchParams,
      },
    },
    {
      setTimeout: (callback: () => void) => {
        timers.push(callback);
        return timers.length;
      },
      clearTimeout: () => {},
    },
  );
  const render = () => harness.render(() => useMapView());
  render();
  return {
    render,
    updates,
    redirects,
    toasts,
    timers,
    cleanup: harness.cleanup,
    setQuery: (query: string) => {
      searchParams = new URLSearchParams(query);
      return render();
    },
    get filters() {
      return filters;
    },
    get resets() {
      return resets;
    },
    get refetches() {
      return refetches;
    },
  };
}

test("useMapView initializes and updates zero coordinates from the URL, clearing stale location/distance on removal", () => {
  const harness = loadMapHook("lat=0&lng=0&distance=3");
  assert.deepEqual(structuredClone(harness.render().userLocation), {
    lat: 0,
    lng: 0,
  });
  harness.setQuery("lat=37&lng=0&distance=2");
  assert.deepEqual(structuredClone(harness.render().userLocation), {
    lat: 37,
    lng: 0,
  });
  harness.setQuery("categories=카페&distance=3");
  assert.equal(harness.render().userLocation, null);
  assert.equal(harness.filters.latitude, undefined);
  assert.equal(harness.filters.longitude, undefined);
  assert.equal(harness.filters.maxDistance, undefined);
  harness.setQuery("");
  assert.deepEqual(harness.filters, {});
  harness.cleanup();
});

test("useMapView accepts zero custom locations and rejects incomplete/nonfinite/out-of-range URLs and manual locations", () => {
  for (const coordinates of zeroPairs) {
    const harness = loadMapHook();
    harness
      .render()
      .setCustomLocation(coordinates.latitude, coordinates.longitude, 3);
    const params = new URLSearchParams(harness.redirects.at(-1)?.split("?")[1]);
    assert.equal(params.get("lat"), String(coordinates.latitude));
    assert.equal(params.get("lng"), String(coordinates.longitude));
    assert.equal(params.get("distance"), "3");
    assert.deepEqual(structuredClone(harness.render().userLocation), {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
    });
    harness.cleanup();
  }
  for (const query of [
    "lat=0",
    "lng=0",
    "lat=Infinity&lng=0",
    "lat=0&lng=NaN",
    "lat=91&lng=0",
    "lat=0&lng=181",
  ]) {
    const harness = loadMapHook(`${query}&distance=3`);
    assert.equal(harness.render().userLocation, null);
    assert.equal(harness.filters.latitude, undefined);
    assert.equal(harness.filters.longitude, undefined);
    assert.equal(harness.filters.maxDistance, undefined);
    harness.cleanup();
  }
  for (const coordinates of invalidPairs.filter(
    (pair) => pair.latitude !== undefined && pair.longitude !== undefined,
  )) {
    const harness = loadMapHook();
    harness
      .render()
      .setCustomLocation(coordinates.latitude, coordinates.longitude);
    assert.equal(harness.redirects.length, 0);
    assert.equal(harness.updates.length, 1); // Initial URL synchronization only.
    assert.equal(harness.render().userLocation, null);
    assert.equal(harness.toasts.at(-1)?.variant, "destructive");
    harness.cleanup();
  }
});

test("useMapView apply serializes zero pairs, distinguishes omitted coordinates from explicit clears, and disables distance without location", () => {
  const harness = loadMapHook("lat=37&lng=127&distance=5");
  harness.render().applyFilters({
    latitude: 0,
    longitude: 0,
    maxDistance: 3,
    categories: ["카페"],
  });
  let params = new URLSearchParams(harness.redirects.at(-1)?.split("?")[1]);
  assert.equal(params.get("lat"), "0");
  assert.equal(params.get("lng"), "0");
  assert.equal(params.get("distance"), "3");
  assert.deepEqual(structuredClone(harness.render().userLocation), {
    lat: 0,
    lng: 0,
  });

  harness.render().applyFilters({ categories: ["카페"], maxDistance: 2 });
  assert.equal(harness.filters.latitude, 0);
  assert.equal(harness.filters.longitude, 0);
  for (const clear of [
    { latitude: undefined, longitude: undefined },
    { latitude: undefined },
    { latitude: 0 },
    { latitude: NaN, longitude: 0 },
  ]) {
    harness.render().setCustomLocation(37, 127, 5);
    harness
      .render()
      .applyFilters({ ...clear, maxDistance: 3, categories: ["카페"] });
    assert.equal(harness.filters.latitude, undefined);
    assert.equal(harness.filters.longitude, undefined);
    assert.equal(harness.filters.maxDistance, undefined);
    assert.equal(harness.render().userLocation, null);
    params = new URLSearchParams(harness.redirects.at(-1)?.split("?")[1]);
    assert.equal(params.has("lat"), false);
    assert.equal(params.has("lng"), false);
    assert.equal(params.has("distance"), false);
  }
  harness.render().applyFilters({ categories: ["한식"], maxDistance: 5 });
  assert.equal(harness.filters.maxDistance, undefined);
  harness.render().applyFilters({});
  assert.equal(harness.redirects.at(-1), "/map");
  assert.equal(harness.render().userLocation, null);
  harness.cleanup();
});

test("useMapView search preserves zero coordinates but cannot revive explicitly cleared location or distance", () => {
  const harness = loadMapHook("lat=0&lng=0&distance=3");
  harness.render().handleSearch("  카페  ");
  let params = new URLSearchParams(harness.redirects.at(-1)?.split("?")[1]);
  assert.equal(params.get("q"), "카페");
  assert.equal(params.get("lat"), "0");
  assert.equal(params.get("lng"), "0");
  assert.equal(params.get("distance"), "5");
  harness.render().applyFilters({
    latitude: undefined,
    longitude: undefined,
    maxDistance: undefined,
    categories: ["카페"],
  });
  harness.render().handleSearch("tea");
  params = new URLSearchParams(harness.redirects.at(-1)?.split("?")[1]);
  assert.equal(params.get("q"), "tea");
  assert.equal(params.has("lat"), false);
  assert.equal(params.has("lng"), false);
  assert.equal(params.has("distance"), false);
  assert.equal(harness.filters.latitude, undefined);
  assert.equal(harness.filters.longitude, undefined);
  assert.equal(harness.filters.maxDistance, undefined);
  harness.cleanup();
});

test("useMapView exposes API errors without scheduling a filter reset or automatic fallback", () => {
  const harness = loadMapHook("lat=0&lng=0&distance=3", "Provider unavailable");
  assert.equal(harness.render().error, "Provider unavailable");
  assert.equal(harness.resets, 0);
  assert.equal(harness.refetches, 0);
  assert.equal(harness.timers.length, 0);
  assert.equal(harness.filters.latitude, 0);
  assert.equal(harness.filters.longitude, 0);
  harness.cleanup();
});

function loadMapPage(query = "lat=37&lng=127", providerFailure = false) {
  const harness = hookHarness();
  const calls: string[] = [];
  const saved: Array<Record<string, any>> = [];
  const toasts: Array<Record<string, any>> = [];
  const searchParams = new URLSearchParams(query);
  const jsx = (type: unknown, props: Element["props"]) => ({ type, props });
  const logger = { debug: () => {}, info: () => {}, error: () => {} };
  const router = { replace: () => {} };
  const toast = (message: Record<string, any>) => toasts.push(message);
  const { default: MapPage } = loadModule(
    "app/map/page.tsx",
    {
      react: harness.hooks,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/components/error-boundary": { ErrorBoundary: "ErrorBoundary" },
      "@/components/header": { default: "Header" },
      "@/components/kakao-map": { default: "KakaoMap" },
      "@/components/search-filters": { default: "SearchFilters" },
      "@/components/skeleton-loader": {
        StoreListSkeleton: "StoreListSkeleton",
      },
      "@/components/store-list": { default: "StoreList" },
      "@/components/ui/button": { Button: "Button" },
      "@/components/ui/drawer": {
        Drawer: "Drawer",
        DrawerClose: "DrawerClose",
        DrawerContent: "DrawerContent",
        DrawerDescription: "DrawerDescription",
        DrawerHeader: "DrawerHeader",
        DrawerTitle: "DrawerTitle",
      },
      "@/components/ui/sheet": {
        Sheet: "Sheet",
        SheetContent: "SheetContent",
        SheetDescription: "SheetDescription",
        SheetHeader: "SheetHeader",
        SheetTitle: "SheetTitle",
      },
      "@/components/ui/use-toast": { useToast: () => ({ toast }) },
      "@/hooks/use-geolocation": { useGeolocation: () => ({}) },
      "@/hooks/use-media-query": { useMediaQuery: () => true },
      "@/lib/location-storage": {
        getUserLocation: () => null,
        isLocationValid: () => false,
        saveUserLocation: (location: Record<string, any>) =>
          saved.push(structuredClone(location)),
      },
      "@/lib/logger": { apiLogger: logger, geolocationLogger: logger },
      "@/lib/map-selection": {
        reconcileSelectedStore: (selection: unknown) => selection,
      },
      "@/lib/validations": { coordinateSchema },
      "lucide-react": {
        List: "List",
        Loader2: "Loader2",
        Map: "Map",
        SlidersHorizontal: "SlidersHorizontal",
        X: "X",
      },
      "next/navigation": {
        useRouter: () => router,
        useSearchParams: () => searchParams,
      },
    },
    {
      setTimeout: () => 1,
      clearTimeout: () => {},
      fetch: async (url: string) => {
        calls.push(url);
        return providerFailure
          ? { ok: false, status: 503, text: async () => "Provider unavailable" }
          : {
              ok: true,
              status: 200,
              json: async () => ({
                success: true,
                data: [{ id: 1, name: "카페", address: "테스트" }],
                pagination: { page: 1, hasMore: false },
              }),
            };
      },
    },
  );
  const content = MapPage().props.children;
  const render = () =>
    harness.render<Element>(() => content.type(content.props));
  const header = () => {
    const element = elements(render()).find(
      (element) => element.type === "Header",
    );
    assert.ok(element, "Missing header callbacks");
    return element;
  };
  render();
  return { render, header, calls, saved, toasts, cleanup: harness.cleanup };
}

test("map page sends zero coordinates through the actual API URL and filter application", async () => {
  const initial = loadMapPage("lat=0&lng=0&distance=3");
  await setImmediate();
  let params = new URLSearchParams(initial.calls[0].split("?")[1]);
  assert.equal(params.get("lat"), "0");
  assert.equal(params.get("lng"), "0");
  assert.equal(params.get("radius"), "3");
  initial.cleanup();

  for (const coordinates of zeroPairs) {
    const harness = loadMapPage();
    await setImmediate();
    harness.header().props.onApplyFilters({
      ...coordinates,
      maxDistance: 3,
      categories: ["카페"],
    });
    await setImmediate();
    params = new URLSearchParams(harness.calls.at(-1)?.split("?")[1]);
    assert.equal(params.get("lat"), String(coordinates.latitude));
    assert.equal(params.get("lng"), String(coordinates.longitude));
    assert.equal(params.get("radius"), "3");
    assert.equal(params.get("categories"), "카페");
    assert.deepEqual(structuredClone(harness.header().props.userLocation), {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
    });
    assert.deepEqual(harness.saved.at(-1), {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      source: "gps",
    });
    harness.cleanup();
  }
});

test("map page falls back only for omitted coordinates, never explicit clearing or invalid coordinate pairs", async () => {
  const omitted = loadMapPage("lat=0&lng=0");
  await setImmediate();
  omitted
    .header()
    .props.onApplyFilters({ categories: ["카페"], maxDistance: 2 });
  await setImmediate();
  const params = new URLSearchParams(omitted.calls.at(-1)?.split("?")[1]);
  assert.equal(params.get("lat"), "0");
  assert.equal(params.get("lng"), "0");
  assert.equal(params.get("radius"), "2");
  omitted.cleanup();

  for (const filters of invalidPairs) {
    const harness = loadMapPage();
    await setImmediate();
    const originalCalls = harness.calls.length;
    const originalSaves = harness.saved.length;
    harness.header().props.onApplyFilters({
      ...filters,
      categories: ["카페"],
      maxDistance: undefined,
    });
    await setImmediate();
    assert.equal(harness.calls.length, originalCalls);
    assert.equal(harness.saved.length, originalSaves);
    assert.equal(harness.header().props.userLocation, null);
    assert.equal(harness.toasts.at(-1)?.title, "위치 정보 필요");
    assert.equal(harness.toasts.at(-1)?.variant, "destructive");
    harness.cleanup();
  }
});

test("map page provider failure keeps the error visible and never refetches unfiltered stores", async () => {
  const harness = loadMapPage("lat=0&lng=0", true);
  await setImmediate();
  assert.equal(harness.calls.length, 1);
  const alerts = elements(harness.render()).filter(
    (element) => element.props.role === "alert",
  );
  // The isolated tree contains both responsive results containers; CSS and the
  // closed Drawer hide the inactive one in the browser.
  assert.equal(alerts.length, 2);
  for (const alert of alerts) {
    assert.match(String(alert.props.children), /불러오지 못했습니다/);
  }
  assert.equal(harness.calls.length, 1);
  assert.equal(
    harness.toasts.some((message) => message.variant === "destructive"),
    true,
  );
  harness.cleanup();
});
