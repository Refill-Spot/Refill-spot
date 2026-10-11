import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { StoreFilters } from "../hooks/use-stores";
import { filtersToURLParams } from "../lib/api-utils";
import type { LocationResult } from "../lib/location-search";
import ko from "../public/locales/ko.json";

type Element = { type: unknown; props: Record<string, any> };
type Coordinates = { lat: number; lng: number };
type FilterProps = {
  userLocation?: Coordinates | null;
  initialFilters?: StoreFilters;
};

function loadModule(path: string, dependencies: Record<string, unknown>) {
  const exported: Record<string, any> = {};
  const compiled = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  runInNewContext(compiled.outputText, {
    exports: exported,
    AbortController,
    URLSearchParams,
    window: { location: { pathname: "/map" } },
    console: { error: () => {} },
    fetch: () => {
      throw new Error("Distance filter tests must not call external services");
    },
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

// Isolate the actual component and hook with the same dependency-injection convention as favorites tests.
function hookHarness() {
  const states: any[] = [];
  const refs: Array<{ current: any }> = [];
  const callbacks: Array<{ value: any; dependencies: unknown[] }> = [];
  const effects: Array<{
    dependencies?: unknown[];
    cleanup?: () => void;
  }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let effectIndex = 0;
  let pendingEffects: Array<() => void> = [];
  let dirty = false;
  const same = (left: unknown[] | undefined, right: unknown[] | undefined) =>
    left !== undefined &&
    right !== undefined &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]));

  const hooks = {
    useId: () => "test-filter",
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
      for (let attempt = 0; attempt < 10; attempt += 1) {
        stateIndex = refIndex = callbackIndex = effectIndex = 0;
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

function text(node: unknown): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (node && typeof node === "object" && "props" in node) {
    return text((node as Element).props.children);
  }
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}

function loadFilters({
  query = "",
  filters = {},
  props = {},
  currentLocation = { lat: 0, lng: 127 },
}: {
  query?: string;
  filters?: StoreFilters;
  props?: FilterProps;
  currentLocation?: Coordinates;
} = {}) {
  const harness = hookHarness();
  const applied: StoreFilters[] = [];
  const updates: StoreFilters[] = [];
  const redirects: string[] = [];
  let searchParams = new URLSearchParams(query);
  let mergedFilters = { ...filters };
  let geolocationCalls = 0;
  let resets = 0;
  const updateFilters = (patch: StoreFilters) => {
    updates.push(patch);
    mergedFilters = { ...mergedFilters, ...patch };
  };
  const onApplyFilters = (patch: StoreFilters) => applied.push(patch);
  const geolocation = {
    isLoading: false,
    getCurrentPosition: async () => {
      geolocationCalls += 1;
      return currentLocation;
    },
  };
  const router = { replace: (url: string) => redirects.push(url) };
  const jsx = (type: unknown, elementProps: Element["props"]) => ({
    type,
    props: elementProps,
  });
  const { default: SearchFilters } = loadModule(
    "components/search-filters.tsx",
    {
      react: harness.hooks,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/components/ui/button": { Button: "Button" },
      "@/components/ui/checkbox": { Checkbox: "Checkbox" },
      "@/components/ui/input": { Input: "Input" },
      "@/components/ui/label": { Label: "Label" },
      "@/components/ui/separator": { Separator: "Separator" },
      "@/components/ui/slider": { Slider: "Slider" },
      "@/hooks/use-geolocation": { useGeolocation: () => geolocation },
      "@/lib/api-utils": { filtersToURLParams },
      "@/lib/store": {
        useStoreStore: () => ({
          filters: mergedFilters,
          updateFilters,
          resetFilters: () => {
            resets += 1;
            mergedFilters = {};
          },
        }),
      },
      "@/public/locales/ko.json": { default: ko },
      "lucide-react": { Loader2: "Loader2", MapPin: "MapPin", Star: "Star" },
      "next/navigation": {
        useRouter: () => router,
        useSearchParams: () => searchParams,
      },
    },
  );
  const render = () =>
    harness.render<Element>(() => SearchFilters({ ...props, onApplyFilters }));
  const control = (type: unknown) => {
    const element = elements(render()).find((item) => item.type === type);
    assert.ok(element, `Missing ${String(type)} control`);
    return element;
  };
  const button = (label: string) => {
    const element = elements(render()).find(
      (item) => item.type === "Button" && text(item.props.children) === label,
    );
    assert.ok(element, `Missing ${label} button`);
    return element;
  };
  return {
    applied,
    updates,
    redirects,
    render,
    control,
    button,
    submit: () => render().props.onSubmit({ preventDefault: () => {} }),
    setQuery: (queryString: string) => {
      searchParams = new URLSearchParams(queryString);
    },
    get filters() {
      return mergedFilters;
    },
    get geolocationCalls() {
      return geolocationCalls;
    },
    get resets() {
      return resets;
    },
  };
}

function assertDistanceCleared(harness: ReturnType<typeof loadFilters>) {
  for (const key of ["latitude", "longitude", "maxDistance"] as const) {
    assert.equal(Object.hasOwn(harness.updates[0], key), true);
    assert.equal(harness.filters[key], undefined);
    assert.equal(harness.applied[0][key], undefined);
  }
  const params = new URL(harness.redirects[0], "http://localhost").searchParams;
  for (const key of ["lat", "lng", "distance", "radius", "rating"]) {
    assert.equal(params.has(key), false);
  }
}

test("distance without a location is disabled, explained, and cleared from merging state", () => {
  const harness = loadFilters({
    query: "distance=5&q=restaurant&categories=한식&rating=4",
    filters: { latitude: 37, longitude: 127, maxDistance: 5, minRating: 4 },
  });
  const slider = harness.control("Slider");
  assert.equal(slider.props.disabled, true);
  assert.equal(slider.props["aria-valuetext"], "위치 필요");
  const description = elements(harness.render()).find(
    (element) => element.props.id === slider.props["aria-describedby"],
  );
  assert.ok(description);
  assert.match(text(description), /위치를 설정하세요/);
  harness.submit();
  assertDistanceCleared(harness);
  assert.equal(harness.filters.minRating, 0);
  assert.equal(harness.filters.query, "restaurant");
  assert.deepEqual(Array.from(harness.filters.categories || []), ["한식"]);
  assert.equal(harness.geolocationCalls, 0);
  const ratingFieldset = elements(harness.render()).find(
    (element) => element.type === "fieldset" && element.props.disabled,
  );
  assert.ok(ratingFieldset);
  assert.match(text(ratingFieldset), /외부 평점 검증 전/);
});

test("partial, blank, nonfinite, and out-of-range URL coordinates do not activate distance", () => {
  for (const query of [
    "lat=37&distance=5",
    "lng=127&distance=5",
    "lat=&lng=127&radius=5",
    "lat=%20&lng=127&distance=5",
    "lat=NaN&lng=127&distance=5",
    "lat=Infinity&lng=127&distance=5",
    "lat=91&lng=127&distance=5",
    "lat=37&lng=-181&distance=5",
  ]) {
    const harness = loadFilters({
      query,
      filters: { latitude: 37, longitude: 127, maxDistance: 4 },
    });
    assert.equal(harness.control("Slider").props.disabled, true, query);
    harness.submit();
    assertDistanceCleared(harness);
    assert.equal(harness.geolocationCalls, 0);
  }
});

test("valid zero URL coordinates enable distance and serialize the displayed default radius", () => {
  for (const [lat, lng] of [
    [0, 0],
    [0, 127],
    [37, 0],
  ]) {
    const harness = loadFilters({ query: `lat=${lat}&lng=${lng}` });
    const slider = harness.control("Slider");
    assert.equal(slider.props.disabled, false);
    assert.equal(slider.props["aria-describedby"], undefined);
    assert.equal(slider.props["aria-valuetext"], "3km");
    harness.submit();
    assert.equal(harness.filters.latitude, lat);
    assert.equal(harness.filters.longitude, lng);
    assert.equal(harness.filters.maxDistance, 3);
    const params = new URL(harness.redirects[0], "http://localhost")
      .searchParams;
    assert.equal(params.get("lat"), String(lat));
    assert.equal(params.get("lng"), String(lng));
    assert.equal(params.get("distance"), "3");
    assert.equal(harness.geolocationCalls, 0);
  }
});

test("selected coordinates take precedence over old URL and store coordinates", () => {
  const harness = loadFilters({
    query: "lat=37&lng=127&distance=5",
    props: { userLocation: { lat: 0, lng: 0 } },
    filters: { latitude: 38, longitude: 128, maxDistance: 5 },
  });
  harness.control("Slider").props.onValueChange([3]);
  harness.submit();
  assert.equal(harness.filters.latitude, 0);
  assert.equal(harness.filters.longitude, 0);
  assert.equal(harness.filters.maxDistance, 3);
  const params = new URL(harness.redirects[0], "http://localhost").searchParams;
  assert.equal(params.get("lat"), "0");
  assert.equal(params.get("lng"), "0");
  assert.equal(params.get("distance"), "3");
  assert.equal(harness.geolocationCalls, 0);
});

test("explicit initial zero coordinates count as a location, unlike stale store coordinates", () => {
  const harness = loadFilters({
    props: { initialFilters: { latitude: 0, longitude: 127 } },
    filters: { latitude: 38, longitude: 128 },
  });
  assert.equal(harness.control("Slider").props.disabled, false);
  harness.submit();
  assert.equal(harness.filters.latitude, 0);
  assert.equal(harness.filters.longitude, 127);
});

test("current-location selection overrides the old URL with exactly one geolocation call", async () => {
  const harness = loadFilters({
    query: "lat=37&lng=127&distance=4",
    props: { userLocation: { lat: 38, lng: 128 } },
    currentLocation: { lat: 0, lng: 0 },
  });
  await harness.button(ko.use_current_location).props.onClick();
  assert.equal(harness.geolocationCalls, 1);
  assert.equal(harness.updates.length, 1);
  assert.equal(harness.filters.latitude, 0);
  assert.equal(harness.filters.longitude, 0);
  assert.equal(harness.filters.maxDistance, 4);
  const params = new URL(harness.redirects[0], "http://localhost").searchParams;
  assert.equal(params.get("lat"), "0");
  assert.equal(params.get("lng"), "0");
  assert.equal(params.get("distance"), "4");
});

test("removed query and categories clear merging state rather than surviving apply", () => {
  const harness = loadFilters({
    query: "q=old&categories=한식&lat=37&lng=127&distance=5",
    filters: { query: "old", categories: ["한식"], maxDistance: 5 },
  });
  harness.control("Input").props.onChange({ target: { value: "   " } });
  const category = elements(harness.render()).find(
    (element) =>
      element.type === "Checkbox" && element.props.id.endsWith("-korean"),
  );
  assert.ok(category);
  category.props.onCheckedChange();
  harness.control("Slider").props.onValueChange([3]);
  harness.submit();
  assert.equal(harness.filters.query, undefined);
  assert.equal(harness.filters.categories, undefined);
  assert.equal(harness.filters.maxDistance, 3);
  const params = new URL(harness.redirects[0], "http://localhost").searchParams;
  assert.equal(params.has("q"), false);
  assert.equal(params.has("categories"), false);
  assert.equal(params.get("distance"), "3");
});

test("URL changes synchronize controls without overwriting local edits on ordinary renders", () => {
  const harness = loadFilters({
    query: "lat=37&lng=127&distance=5&q=old&categories=한식",
  });
  harness.control("Input").props.onChange({ target: { value: "local edit" } });
  assert.equal(harness.control("Input").props.value, "local edit");
  harness.setQuery("lat=37&lng=127&radius=2&q=new&categories=카페");
  assert.equal(harness.control("Input").props.value, "new");
  assert.equal(harness.control("Slider").props.value[0], 2);
  harness.submit();
  assert.equal(harness.filters.maxDistance, 2);
  assert.deepEqual(Array.from(harness.filters.categories || []), ["카페"]);
  harness.setQuery("lat=37&lng=127&distance=Infinity");
  assert.equal(harness.control("Slider").props.value[0], 3);
  assert.equal(harness.control("Input").props.value, "");
});

test("reset drops invalid coordinates and distance, but preserves the valid selected zero location", () => {
  const invalid = loadFilters({ query: "lat=37&distance=5" });
  invalid.button(ko.reset).props.onClick();
  assert.equal(invalid.redirects[0], "/map");
  assert.equal(invalid.resets, 1);
  assert.deepEqual(Object.keys(invalid.applied[0]), []);

  const selected = loadFilters({
    query: "lat=37&lng=127&distance=5",
    props: { userLocation: { lat: 0, lng: 0 } },
  });
  selected.button(ko.reset).props.onClick();
  assert.equal(selected.redirects[0], "/map?lat=0&lng=0");
  assert.equal(selected.resets, 1);
  assert.equal(selected.geolocationCalls, 0);
});

function loadLocationHook() {
  const harness = hookHarness();
  const selected: Array<[number, number, number]> = [];
  const redirects: string[] = [];
  const toasts: Array<Record<string, any>> = [];
  const searches: Array<{
    query: string;
    options: { mode: string; signal: AbortSignal };
    resolve: (places: LocationResult[]) => void;
  }> = [];
  let closed = 0;
  const router = { push: (url: string) => redirects.push(url) };
  const toast = (message: Record<string, any>) => toasts.push(message);
  const onCustomLocationSet = (lat: number, lng: number, radius: number) => {
    selected.push([lat, lng, radius]);
  };
  const onDialogClose = () => {
    closed += 1;
  };
  const { useLocationSearch } = loadModule("hooks/use-location-search.ts", {
    react: harness.hooks,
    "@/components/ui/use-toast": { useToast: () => ({ toast }) },
    "next/navigation": { useRouter: () => router },
    "@/lib/location-search": {
      searchLocations: (
        query: string,
        options: { mode: string; signal: AbortSignal },
      ) =>
        new Promise<LocationResult[]>((resolve) =>
          searches.push({ query, options, resolve }),
        ),
    },
  });
  return {
    selected,
    redirects,
    toasts,
    searches,
    render: (withCallback = true) =>
      harness.render(() =>
        useLocationSearch({
          onCustomLocationSet: withCallback ? onCustomLocationSet : undefined,
          onDialogClose,
        }),
      ),
    cleanup: harness.cleanup,
    get closed() {
      return closed;
    },
  };
}

const zeroPlace: LocationResult = {
  id: "zero",
  name: "선택 위치",
  address: "",
  lat: 0,
  lng: 0,
};

test("location selection uses supplied zero coordinates and the latest bounded radius without provider calls", () => {
  const harness = loadLocationHook();
  const hook = harness.render();
  hook.setRadiusInput(50);
  hook.handlePlaceSelect(zeroPlace);
  assert.deepEqual(harness.selected, [[0, 0, 50]]);
  assert.equal(harness.searches.length, 0);
  assert.equal(harness.closed, 1);
  assert.equal(harness.render().selectedPlace.id, "zero");

  for (const [input, expected] of [
    [0, 1],
    [100, 50],
    [NaN, 5],
  ]) {
    const current = harness.render(false);
    current.setRadiusInput(input);
    current.handlePlaceSelect(zeroPlace);
    assert.equal(
      harness.redirects.at(-1),
      `/map?lat=0&lng=0&distance=${expected}`,
    );
  }
  assert.equal(harness.searches.length, 0);
});

test("popular-location search keeps the latest radius and direct selection cancels stale results", async () => {
  const harness = loadLocationHook();
  const popular = { name: "인기 위치", address: "서울 중구" };
  const pending = harness.render().handlePopularLocationSelect(popular);
  assert.equal(harness.searches.length, 1);
  assert.equal(harness.searches[0].options.mode, "address");
  harness.render().setRadiusInput(7);
  harness.searches[0].resolve([zeroPlace]);
  await pending;
  assert.deepEqual(harness.selected, [[0, 0, 7]]);

  const stale = harness.render().handlePopularLocationSelect(popular);
  harness.render().handlePlaceSelect({ ...zeroPlace, lat: 37, lng: 127 });
  assert.equal(harness.searches[1].options.signal.aborted, true);
  harness.searches[1].resolve([{ ...zeroPlace, lat: 38, lng: 128 }]);
  await stale;
  assert.deepEqual(harness.selected, [
    [0, 0, 7],
    [37, 127, 7],
  ]);
  assert.equal(harness.searches.length, 2);
  assert.equal(harness.render().isLoading, false);
  harness.cleanup();
});

test("invalid selected coordinates never invoke the callback, navigation, or providers", () => {
  const harness = loadLocationHook();
  for (const [lat, lng] of [
    [NaN, 127],
    [91, 127],
    [37, 181],
    [37, Infinity],
  ]) {
    harness.render().handlePlaceSelect({ ...zeroPlace, lat, lng });
  }
  assert.equal(harness.selected.length, 0);
  assert.equal(harness.redirects.length, 0);
  assert.equal(harness.searches.length, 0);
  assert.equal(harness.closed, 0);
  assert.equal(harness.toasts.length, 4);
  assert.ok(harness.toasts.every((toast) => toast.variant === "destructive"));
});
