import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { create } from "zustand";
import type { useStoreStore } from "../lib/store";
import * as validations from "../lib/validations";

type StoreHook = typeof useStoreStore;
type QueryResult = { data: any; error: unknown };
type QueryCall = {
  table: string;
  operation: "select" | "insert" | "delete";
  columns?: string;
  filters: Array<[string, unknown]>;
  signal?: AbortSignal;
};
type QueryPlan = {
  table: string;
  operation?: QueryCall["operation"];
  result: QueryResult | Promise<QueryResult>;
  started?: () => void;
};
type QueryChain = {
  select: (columns: string) => QueryChain;
  eq: (column: string, value: unknown) => QueryChain;
  in: (column: string, value: unknown) => QueryChain;
  delete: () => QueryChain;
  insert: () => QueryChain;
  maybeSingle: () => QueryChain;
  abortSignal: (signal: AbortSignal) => QueryChain;
  then: (
    onFulfilled: (result: QueryResult) => unknown,
    onRejected: (error: unknown) => unknown,
  ) => Promise<unknown>;
};
type ProfileQuery = {
  select: () => ProfileQuery;
  eq: () => ProfileQuery;
  abortSignal: () => ProfileQuery;
  maybeSingle: () => Promise<QueryResult>;
};
type Element = { type: unknown; props: Record<string, any> };

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, rejectPromise) => {
    resolvePromise = resolve;
    reject = rejectPromise;
  });
  return { promise, resolve: resolvePromise, reject };
}

const success = (data: any): QueryResult => ({ data, error: null });
const failure = (message: string): QueryResult => ({
  data: null,
  error: new Error(message),
});

// Compile the actual modules with isolated dependencies; no real client, fetch or writes exist.
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
  runInNewContext(compiled.outputText, {
    exports: exported,
    AbortController,
    Error,
    URL,
    URLSearchParams,
    console: { error: () => {}, log: () => {} },
    fetch: () => {
      throw new Error("Live fetch is forbidden in favorites tests");
    },
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

function loadStore(fetchMock?: typeof fetch) {
  const plans: QueryPlan[] = [];
  const calls: QueryCall[] = [];
  const supabase = {
    from: (table: string) => {
      const call: QueryCall = { table, operation: "select", filters: [] };
      const query: QueryChain = {
        select: (columns: string) => {
          call.columns = columns;
          return query;
        },
        eq: (column: string, value: unknown) => {
          call.filters.push([column, value]);
          return query;
        },
        in: (column: string, value: unknown) => {
          call.filters.push([column, value]);
          return query;
        },
        delete: () => {
          call.operation = "delete";
          return query;
        },
        insert: () => {
          call.operation = "insert";
          return query;
        },
        maybeSingle: () => query,
        abortSignal: (signal: AbortSignal) => {
          call.signal = signal;
          return query;
        },
        then: (
          onFulfilled: (result: QueryResult) => unknown,
          onRejected: (error: unknown) => unknown,
        ) => {
          calls.push(call);
          const plan = plans.shift();
          assert.ok(plan, `Unplanned ${table} ${call.operation}`);
          assert.equal(table, plan.table);
          assert.equal(call.operation, plan.operation ?? "select");
          plan.started?.();
          // Deliberately ignore aborts: late responses must be harmless even without transport cancellation.
          return Promise.resolve(plan.result).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };
  const unexpected = () => {
    throw new Error("Unrelated store action called");
  };
  const { useStoreStore: store } = loadModule(
    "lib/store.ts",
    {
      zustand: { create },
      "@/lib/validations": validations,
      "@/lib/supabase/client": { supabaseBrowser: supabase },
      "@/lib/api-utils": {
        fetchAllStores: unexpected,
        fetchFilteredStores: unexpected,
      },
      "@/lib/stores": {
        getStoreById: unexpected,
        mapStoreFromDb: (row: any) => ({ ...row }),
      },
    },
    fetchMock ? { fetch: fetchMock } : {},
  ) as { useStoreStore: StoreHook };
  return { store, plans, calls };
}

test("store-detail review writes use the validated route and propagate failed saves", async () => {
  for (const status of [200, 400, 500]) {
    let refreshes = 0;
    const { store, calls } = loadStore(async (input, options) => {
      assert.equal(input, "/api/stores/12/reviews");
      assert.equal(options?.method, "POST");
      assert.deepEqual(JSON.parse(String(options?.body)), {
        rating: 4,
        content: "Review",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Save denied" }),
        { status },
      );
    });
    store.setState({
      fetchReviews: async () => {
        refreshes++;
      },
    });
    await assert.rejects(
      store.getState().saveReview(12, 4, "Review"),
      /Save denied/,
    );
    assert.equal(refreshes, 0);
    assert.equal(calls.length, 0);
  }
});

test("store-detail review save waits for its refresh after confirmed persistence", async () => {
  const refresh = deferred<void>();
  const { store } = loadStore(
    async () => new Response(JSON.stringify({ success: true })),
  );
  store.setState({ fetchReviews: () => refresh.promise });
  let settled = false;
  const pending = store
    .getState()
    .saveReview(12, 4, "Review")
    .then(() => {
      settled = true;
    });
  await setImmediate();
  assert.equal(settled, false);
  refresh.resolve();
  await pending;
  assert.equal(settled, true);
});

function favoriteState(store: StoreHook) {
  const state = store.getState();
  return {
    owner: state.favoritesOwnerId,
    version: state.favoritesOwnerVersion,
    request: state.favoritesRequestId,
    ids: Array.from(state.favorites, (item) => item.id),
    loading: state.favoritesLoading,
    loaded: state.favoritesLoaded,
    error: state.favoritesError,
  };
}

function savedStore(id: number, name = `Store ${id}`) {
  return {
    id,
    name,
    categories: [],
    address: "Test address",
    position: { lat: 0, lng: 0 },
    rating: {},
  };
}

for (const staleOutcome of ["success", "error", "rejection"] as const) {
  for (const finishCurrentFirst of [false, true]) {
    test(`late A ${staleOutcome} cannot alter B state (${finishCurrentFirst ? "B finished" : "B loading"})`, async () => {
      const { store, plans, calls } = loadStore();
      const old = deferred<QueryResult>();
      const current = deferred<QueryResult>();
      const oldStarted = deferred<void>();
      const currentStarted = deferred<void>();
      plans.push(
        {
          table: "favorites",
          result: old.promise,
          started: () => oldStarted.resolve(),
        },
        {
          table: "favorites",
          result: current.promise,
          started: () => currentStarted.resolve(),
        },
        { table: "stores", result: success([savedStore(2)]) },
      );
      store.getState().setFavoritesOwner("A");
      const requestA = store.getState().fetchFavorites("A");
      await oldStarted.promise;
      store.getState().setFavoritesOwner("B");
      const requestB = store.getState().fetchFavorites("B");
      await currentStarted.promise;
      assert.equal(calls[0].signal?.aborted, true);
      if (finishCurrentFirst) {
        current.resolve(success([{ store_id: 2 }]));
        await requestB;
      }
      const before = favoriteState(store);
      if (staleOutcome === "rejection")
        old.reject(new Error("late A rejection"));
      else
        old.resolve(
          staleOutcome === "error"
            ? failure("late A error")
            : success([{ store_id: 1 }]),
        );
      await requestA;
      assert.deepEqual(favoriteState(store), before);
      if (!finishCurrentFirst) {
        current.resolve(success([{ store_id: 2 }]));
        await requestB;
      }
      assert.deepEqual(favoriteState(store).ids, [2]);
      assert.equal(calls.filter((call) => call.table === "stores").length, 1);
      assert.deepEqual(calls[1].filters, [["user_id", "B"]]);
    });
  }
}

for (const staleOutcome of [
  success([savedStore(1)]),
  failure("old details failed"),
]) {
  test(`late store-details result cannot replay A after B loads (${staleOutcome.error ? "error" : "success"})`, async () => {
    const { store, plans } = loadStore();
    const oldDetails = deferred<QueryResult>();
    const started = deferred<void>();
    plans.push(
      { table: "favorites", result: success([{ store_id: 1 }]) },
      {
        table: "stores",
        result: oldDetails.promise,
        started: () => started.resolve(),
      },
      { table: "favorites", result: success([]) },
    );
    store.getState().setFavoritesOwner("A");
    const requestA = store.getState().fetchFavorites("A");
    await started.promise;
    store.getState().setFavoritesOwner("B");
    await store.getState().fetchFavorites("B");
    const before = favoriteState(store);
    oldDetails.resolve(staleOutcome);
    await requestA;
    assert.deepEqual(favoriteState(store), before);
  });
}

test("late A success cannot clear B load failure or publish an empty success", async () => {
  const { store, plans } = loadStore();
  const old = deferred<QueryResult>();
  const started = deferred<void>();
  plans.push(
    {
      table: "favorites",
      result: old.promise,
      started: () => started.resolve(),
    },
    { table: "favorites", result: failure("B failed") },
  );
  store.getState().setFavoritesOwner("A");
  const requestA = store.getState().fetchFavorites("A");
  await started.promise;
  store.getState().setFavoritesOwner("B");
  await store.getState().fetchFavorites("B");
  const before = favoriteState(store);
  assert.equal(before.error, "B failed");
  old.resolve(success([]));
  await requestA;
  assert.deepEqual(favoriteState(store), before);
});

for (const changeOwner of [false, true]) {
  test(`request identity protects ${changeOwner ? "A to B to A" : "same-account retry"} from older completion`, async () => {
    const { store, plans } = loadStore();
    const old = deferred<QueryResult>();
    const started = deferred<void>();
    plans.push(
      {
        table: "favorites",
        result: old.promise,
        started: () => started.resolve(),
      },
      { table: "favorites", result: success([]) },
    );
    store.getState().setFavoritesOwner("A");
    const oldRequest = store.getState().fetchFavorites("A");
    await started.promise;
    if (changeOwner) {
      store.getState().setFavoritesOwner("B");
      store.getState().setFavoritesOwner("A");
    }
    await store.getState().fetchFavorites("A");
    const before = favoriteState(store);
    old.resolve(failure("obsolete request"));
    await oldRequest;
    assert.deepEqual(favoriteState(store), before);
  });
}

test("logout clears cached favorites and invalidates pending results without permitting stale fetches", async () => {
  const { store, plans, calls } = loadStore();
  plans.push(
    { table: "favorites", result: success([{ store_id: 1 }]) },
    { table: "stores", result: success([savedStore(1)]) },
  );
  store.getState().setFavoritesOwner("A");
  await store.getState().fetchFavorites("A");
  const late = deferred<QueryResult>();
  const started = deferred<void>();
  plans.push({
    table: "favorites",
    result: late.promise,
    started: () => started.resolve(),
  });
  const pending = store.getState().fetchFavorites("A");
  await started.promise;
  store.getState().setFavoritesOwner(null);
  const loggedOut = favoriteState(store);
  assert.equal(loggedOut.owner, null);
  assert.deepEqual(loggedOut.ids, []);
  assert.equal(loggedOut.loading, false);
  assert.equal(loggedOut.loaded, false);
  assert.equal(loggedOut.error, null);
  assert.equal(calls[2].signal?.aborted, true);
  late.resolve(success([{ store_id: 1 }]));
  await pending;
  await store.getState().fetchFavorites("A");
  assert.deepEqual(favoriteState(store), loggedOut);
  assert.equal(calls.length, 3);
});

test("load failures remain distinct from a successfully loaded empty list and retry clears error", async () => {
  const { store, plans } = loadStore();
  store.getState().setFavoritesOwner("A");
  for (const result of [failure("cannot load favorites"), success(null)]) {
    plans.push({ table: "favorites", result });
    await store.getState().fetchFavorites("A");
    assert.equal(store.getState().favoritesLoading, false);
    assert.equal(store.getState().favoritesLoaded, false);
    assert.ok(store.getState().favoritesError);
  }
  plans.push(
    { table: "favorites", result: success([{ store_id: 1 }]) },
    { table: "stores", result: success(null) },
  );
  await store.getState().fetchFavorites("A");
  assert.ok(store.getState().favoritesError);
  plans.push({ table: "favorites", result: success([]) });
  await store.getState().fetchFavorites("A");
  assert.equal(store.getState().favoritesLoaded, true);
  assert.equal(store.getState().favoritesError, null);
  assert.deepEqual(favoriteState(store).ids, []);
});

for (const operation of ["select", "delete", "insert"] as const) {
  test(`${operation} errors propagate to the actual toggleFavorite caller`, async () => {
    const { store, plans, calls } = loadStore();
    store.getState().setFavoritesOwner("A");
    const error = new Error(`${operation} rejected`);
    if (operation !== "select") {
      plans.push({
        table: "favorites",
        result: success(operation === "delete" ? { id: 7 } : null),
      });
    }
    plans.push({
      table: "favorites",
      operation,
      result: { data: null, error },
    });
    await assert.rejects(
      store.getState().toggleFavorite(1, "A"),
      (caught) => caught === error,
    );
    assert.equal(calls.length, operation === "select" ? 1 : 2);
    assert.equal(store.getState().favoritesLoading, false);
  });
}

test("successful mutation waits for favorites refresh rather than reporting before it settles", async () => {
  const { store, plans } = loadStore();
  const refresh = deferred<QueryResult>();
  const started = deferred<void>();
  plans.push(
    { table: "favorites", result: success({ id: 7 }) },
    { table: "favorites", operation: "delete", result: success(null) },
    {
      table: "favorites",
      result: refresh.promise,
      started: () => started.resolve(),
    },
  );
  store.getState().setFavoritesOwner("A");
  let settled = false;
  const mutation = store
    .getState()
    .toggleFavorite(1, "A")
    .then(() => {
      settled = true;
    });
  await started.promise;
  assert.equal(settled, false);
  assert.equal(store.getState().favoritesLoading, true);
  refresh.resolve(success([]));
  await mutation;
  assert.equal(settled, true);
  assert.equal(store.getState().favoritesLoaded, true);
});

test("account changes during mutation lookup prevent a write and mismatched callers cannot query", async () => {
  const { store, plans, calls } = loadStore();
  const lookup = deferred<QueryResult>();
  const started = deferred<void>();
  plans.push({
    table: "favorites",
    result: lookup.promise,
    started: () => started.resolve(),
  });
  store.getState().setFavoritesOwner("A");
  const mutation = store.getState().toggleFavorite(1, "A");
  const rejection = assert.rejects(mutation, /사용자가 변경되었습니다/);
  await started.promise;
  store.getState().setFavoritesOwner("B");
  store.getState().setFavoritesOwner("A");
  lookup.resolve(success({ id: 7 }));
  await rejection;
  await assert.rejects(
    store.getState().toggleFavorite(1, "B"),
    /로그인이 필요합니다/,
  );
  assert.equal(calls.length, 1);
});

test("late completed mutation cannot refresh or change the next account", async () => {
  const { store, plans, calls } = loadStore();
  const deletion = deferred<QueryResult>();
  const started = deferred<void>();
  plans.push(
    { table: "favorites", result: success({ id: 7 }) },
    {
      table: "favorites",
      operation: "delete",
      result: deletion.promise,
      started: () => started.resolve(),
    },
    { table: "favorites", result: success([]) },
  );
  store.getState().setFavoritesOwner("A");
  const mutation = store.getState().toggleFavorite(1, "A");
  const rejection = assert.rejects(mutation, /사용자가 변경되었습니다/);
  await started.promise;
  store.getState().setFavoritesOwner("B");
  await store.getState().fetchFavorites("B");
  const before = favoriteState(store);
  deletion.resolve(success(null));
  await rejection;
  assert.deepEqual(favoriteState(store), before);
  assert.equal(calls.length, 3);
});

const jsxRuntime = {
  jsx: (type: unknown, props: Record<string, any>) => ({ type, props }),
  jsxs: (type: unknown, props: Record<string, any>) => ({ type, props }),
};

function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return "";
  return text((tree as Element).props.children);
}

function loadPage(store: StoreHook, userId: string | null, loading = false) {
  const toasts: Array<Record<string, any>> = [];
  const redirects: string[] = [];
  const effects: Array<() => void> = [];
  let effectDependencies: unknown[] | undefined;
  const router = {
    replace: (path: string) => redirects.push(path),
    push: () => {},
    back: () => {},
  };
  const toast = (value: Record<string, any>) => toasts.push(value);
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    react: {
      useEffect: (callback: () => void, dependencies: unknown[]) => {
        if (
          !effectDependencies ||
          dependencies.some(
            (value, index) => !Object.is(value, effectDependencies?.[index]),
          )
        ) {
          effects.push(callback);
          effectDependencies = dependencies;
        }
      },
      useState: (initial: unknown) => [initial, () => {}],
    },
    "next/image": { default: "Image" },
    "next/navigation": { useRouter: () => router },
    "@/contexts/AuthContext": {
      useAuth: () => ({ user: userId ? { id: userId } : null, loading }),
    },
    "@/hooks/use-pwa-detection": {
      usePWADetection: () => ({ navigateConditionally: () => {} }),
    },
    "@/components/ui/use-toast": { useToast: () => ({ toast }) },
    "@/lib/store": {
      useStoreStore: Object.assign(() => store.getState(), {
        getState: store.getState,
      }),
    },
    "@/lib/image-utils": { shouldBeUnoptimized: () => false },
  };
  for (const [id, names] of [
    ["@/components/external-ratings", ["ExternalRatings"]],
    [
      "@/components/ui/alert-dialog",
      [
        "AlertDialog",
        "AlertDialogAction",
        "AlertDialogCancel",
        "AlertDialogContent",
        "AlertDialogDescription",
        "AlertDialogFooter",
        "AlertDialogHeader",
        "AlertDialogTitle",
        "AlertDialogTrigger",
      ],
    ],
    ["@/components/ui/badge", ["Badge"]],
    ["@/components/ui/button", ["Button"]],
    ["@/components/ui/card", ["Card", "CardContent"]],
    ["@/components/ui/separator", ["Separator"]],
    [
      "@/components/ui/tooltip",
      ["Tooltip", "TooltipContent", "TooltipProvider", "TooltipTrigger"],
    ],
    [
      "lucide-react",
      ["ChevronLeft", "Heart", "MapPin", "Navigation", "Trash2", "Utensils"],
    ],
  ] as Array<[string, string[]]>) {
    dependencies[id] = Object.fromEntries(names.map((name) => [name, name]));
  }
  const Page = loadModule("app/favorites/page.tsx", dependencies).default;
  return { render: () => Page() as Element, effects, toasts, redirects };
}

test("favorites page hides unauthenticated, loading and mismatched-owner cached data before redirect", () => {
  const { store } = loadStore();
  store.setState({
    favoritesOwnerId: "A",
    favoritesLoaded: true,
    favorites: [savedStore(1, "Private A favorite")] as any,
  });
  for (const [userId, loading] of [
    [null, false],
    ["B", false],
    ["A", true],
  ] as const) {
    const page = loadPage(store, userId, loading);
    const tree = page.render();
    assert.equal(text(tree).includes("Private A favorite"), false);
    assert.equal(text(tree).includes("저장된 즐겨찾기가 없습니다"), false);
    assert.equal(
      elements(tree).some((item) =>
        item.props.className?.includes("animate-spin"),
      ),
      true,
    );
    if (!userId && !loading) {
      page.effects[0]();
      assert.deepEqual(page.redirects, ["/login"]);
    }
  }
});

test("favorites page renders load error with retry rather than a false empty result", async () => {
  const { store, plans } = loadStore();
  store.getState().setFavoritesOwner("A");
  plans.push({ table: "favorites", result: failure("private DB error") });
  await store.getState().fetchFavorites("A");
  const page = loadPage(store, "A");
  const tree = page.render();
  assert.ok(elements(tree).some((item) => item.props.role === "alert"));
  assert.match(text(tree), /즐겨찾기를 불러오지 못했습니다/);
  assert.equal(text(tree).includes("저장된 즐겨찾기가 없습니다"), false);
  assert.equal(text(tree).includes("private DB error"), false);
  const retry = elements(tree).find(
    (item) => item.type === "Button" && text(item) === "다시 시도",
  );
  assert.ok(retry);
  plans.push({ table: "favorites", result: success([]) });
  await retry.props.onClick();
  assert.match(text(page.render()), /저장된 즐겨찾기가 없습니다/);
});

test("batched invalidation and same-account restoration trigger a new load instead of a permanent spinner", async () => {
  const { store, plans } = loadStore();
  store.getState().setFavoritesOwner("A");
  store.setState({ favoritesLoaded: true });
  const page = loadPage(store, "A");
  page.render();
  store.getState().setFavoritesOwner(null);
  store.getState().setFavoritesOwner("A");
  page.render();
  assert.equal(page.effects.length, 2);
  plans.push({ table: "favorites", result: success([]) });
  page.effects[1]();
  await setImmediate();
  assert.equal(store.getState().favoritesLoaded, true);
  assert.match(text(page.render()), /저장된 즐겨찾기가 없습니다/);
});

test("failed delete produces only an error toast, never a success toast", async () => {
  const { store, plans } = loadStore();
  store.setState({
    favoritesOwnerId: "A",
    favoritesLoaded: true,
    favorites: [savedStore(1)] as any,
  });
  plans.push(
    { table: "favorites", result: success({ id: 7 }) },
    {
      table: "favorites",
      operation: "delete",
      result: failure("delete denied"),
    },
  );
  const page = loadPage(store, "A");
  const remove = elements(page.render()).find(
    (item) => item.type === "AlertDialogAction",
  );
  assert.ok(remove);
  await remove.props.onClick();
  assert.equal(page.toasts.length, 1);
  assert.equal(page.toasts[0].variant, "destructive");
  assert.equal(page.toasts[0].title, "오류");
});

test("late delete from the previous account cannot toast or refresh the new account", async () => {
  const { store, plans } = loadStore();
  const deletion = deferred<QueryResult>();
  const started = deferred<void>();
  store.getState().setFavoritesOwner("A");
  store.setState({ favoritesLoaded: true, favorites: [savedStore(1)] as any });
  plans.push(
    { table: "favorites", result: success({ id: 7 }) },
    {
      table: "favorites",
      operation: "delete",
      result: deletion.promise,
      started: () => started.resolve(),
    },
  );
  const page = loadPage(store, "A");
  const remove = elements(page.render()).find(
    (item) => item.type === "AlertDialogAction",
  );
  assert.ok(remove);
  const removing = remove.props.onClick();
  await started.promise;
  store.getState().setFavoritesOwner("B");
  const before = favoriteState(store);
  deletion.resolve(success(null));
  await removing;
  assert.deepEqual(favoriteState(store), before);
  assert.deepEqual(page.toasts, []);
});

function loadAuth(store: StoreHook) {
  const states: any[] = [];
  const refs: Array<{ current: any }> = [];
  const publications: Array<{ userId: string | null; ownerId: string | null }> =
    [];
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const effects: Array<() => void | (() => void)> = [];
  const signOutResult = deferred<{ error: unknown }>();
  let listener!: (event: string, session: unknown) => void;
  let verifiedUser: { id: string; email: string } | null = null;
  let stateIndex = 0;
  let refIndex = 0;
  let firstRender = true;
  let nextTimer = 1;
  const supabase = {
    auth: {
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getUser: async () => ({ data: { user: verifiedUser }, error: null }),
      signOut: () => signOutResult.promise,
    },
    from: (table: string) => {
      assert.equal(table, "profiles");
      const query: ProfileQuery = {
        select: () => query,
        eq: () => query,
        abortSignal: () => query,
        maybeSingle: async () => success({ username: "Test user" }),
      };
      return query;
    },
  };
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    react: {
      createContext: () => ({ Provider: "AuthProvider" }),
      useContext: () => {},
      useCallback: (callback: unknown) => callback,
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [
          states[index],
          (value: any) => {
            states[index] = value;
            if (index === 0)
              publications.push({
                userId: value?.id ?? null,
                ownerId: store.getState().favoritesOwnerId,
              });
          },
        ];
      },
      useRef: (initial: unknown) => {
        const index = refIndex++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
      useEffect: (callback: () => void | (() => void)) => {
        if (firstRender) effects.push(callback);
      },
    },
    "@/components/ui/use-toast": { useToast: () => ({ toast: () => {} }) },
    "@/lib/logger": { authLogger: { error: () => {}, debug: () => {} } },
    "@/lib/store": { useStoreStore: store },
    "@/lib/supabase/client": { supabaseBrowser: supabase },
    "@/lib/utils": { getSafeReturnUrl: () => "/" },
    "@supabase/supabase-js": { AuthError: class extends Error {} },
    "next/navigation": {
      useRouter: () => ({ replace: () => {}, refresh: () => {} }),
    },
  };
  const { AuthProvider } = loadModule(
    "contexts/AuthContext.tsx",
    dependencies,
    {
      window: {
        location: {
          origin: "https://test.invalid",
          pathname: "/favorites",
          search: "",
        },
      },
      setTimeout: (callback: () => void, delay: number) => {
        const id = nextTimer++;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id: number) => timers.delete(id),
    },
  );
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    const tree = AuthProvider({ children: null }) as Element;
    firstRender = false;
    return tree.props.value;
  };
  render();
  const cleanup = effects[0]();
  const authenticate = async (id: string) => {
    verifiedUser = { id, email: `${id}@test.invalid` };
    listener("SIGNED_IN", { user: verifiedUser });
    for (const [timerId, timer] of [...timers]) {
      if (timer.delay === 0) {
        timers.delete(timerId);
        timer.callback();
      }
    }
    await setImmediate();
  };
  return {
    render,
    authenticate,
    publications,
    listener,
    signOutResult,
    cleanup,
  };
}

test("AuthContext clears favorites before publishing changed/null user and before signout resolves", async () => {
  const { store } = loadStore();
  const auth = loadAuth(store);
  await auth.authenticate("A");
  store.setState({ favorites: [savedStore(1)] as any, favoritesLoaded: true });
  const accountChange = auth.authenticate("B");
  assert.equal(store.getState().favoritesOwnerId, null);
  assert.deepEqual(favoriteState(store).ids, []);
  await accountChange;
  assert.equal(store.getState().favoritesOwnerId, "B");
  const signout = auth.render().signOut();
  assert.equal(store.getState().favoritesOwnerId, null);
  auth.signOutResult.resolve({ error: null });
  await signout;
  for (const publication of auth.publications)
    assert.equal(publication.ownerId, publication.userId);
  assert.equal(auth.render().user, null);
  if (typeof auth.cleanup === "function") auth.cleanup();
});

test("SIGNED_OUT event invalidates cached and in-flight favorites before publishing null", async () => {
  const { store, plans } = loadStore();
  const auth = loadAuth(store);
  await auth.authenticate("A");
  store.setState({ favorites: [savedStore(1)] as any, favoritesLoaded: true });
  const late = deferred<QueryResult>();
  const started = deferred<void>();
  plans.push({
    table: "favorites",
    result: late.promise,
    started: () => started.resolve(),
  });
  const request = store.getState().fetchFavorites("A");
  await started.promise;
  auth.listener("SIGNED_OUT", null);
  const before = favoriteState(store);
  assert.equal(before.owner, null);
  assert.deepEqual(before.ids, []);
  assert.equal(auth.publications.at(-1)?.ownerId, null);
  late.resolve(failure("late after logout"));
  await request;
  assert.deepEqual(favoriteState(store), before);
  if (typeof auth.cleanup === "function") auth.cleanup();
});

test("failed signout restores only verified ownership, never cached prior-account favorites", async () => {
  const { store } = loadStore();
  const auth = loadAuth(store);
  await auth.authenticate("A");
  store.setState({ favorites: [savedStore(1)] as any, favoritesLoaded: true });
  const signout = auth.render().signOut();
  const error = new Error("signout unavailable");
  const rejection = assert.rejects(signout, (caught) => caught === error);
  assert.equal(store.getState().favoritesOwnerId, null);
  auth.signOutResult.resolve({ error });
  await rejection;
  assert.equal(store.getState().favoritesOwnerId, "A");
  assert.equal(store.getState().favoritesLoaded, false);
  assert.deepEqual(favoriteState(store).ids, []);
  assert.equal(auth.render().user.id, "A");
  if (typeof auth.cleanup === "function") auth.cleanup();
});
