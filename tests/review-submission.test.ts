import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Surface = "dialog" | "inline";
type Element = { type: unknown; props: Record<string, any> };
type Reply = {
  ok: boolean;
  status: number;
  statusText: string;
  payload?: any;
  json: () => Promise<any>;
};
type Outcome = Reply | Error | Promise<Reply>;

const STORE_ID = 17;
const USER = { id: "review-author", email: "reviewer@example.test" };
const EXISTING_URL = "https://media.example.test/existing.png";
const UPLOADED_URL = "https://media.example.test/uploaded.png";
const DRAFT = "Keep this review text after a failed request.";
const jsx = (type: unknown, props: Record<string, any>): Element => ({
  type,
  props,
});
const compiled = new Map<string, string>();

function reply(status: number, payload: unknown): Reply {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    payload,
    json: async () => payload,
  };
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

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

// Execute production components and the real review hook; all HTTP and UI boundaries are isolated.
function loadUi(
  surface: Surface,
  editing = false,
  existingUrls = [EXISTING_URL],
  metadata: Record<string, unknown> = {},
) {
  const states: any[] = [];
  const refs: Array<{ current: any }> = [];
  const callbacks: Array<{ dependencies: unknown[]; value: unknown }> = [];
  const effects: Array<{
    dependencies: unknown[];
    cleanup?: () => void;
  }> = [];
  const pendingEffects: Array<() => void> = [];
  const uploadPlans: Outcome[] = [];
  const savePlans: Outcome[] = [];
  const uploads: File[][] = [];
  const saves: Array<{ url: string; method: string; body: any }> = [];
  const toasts: Array<Record<string, any>> = [];
  const closed: boolean[] = [];
  const listeners = new Set<(event: { key: string }) => void>();
  const listenerCalls = { added: 0, removed: 0 };
  const userReview = {
    id: 9,
    rating: 3,
    content: "Existing review",
    imageUrls: existingUrls,
    ...metadata,
    createdAt: "2026-01-01T00:00:00Z",
    user: { ...USER, username: "Reviewer", avatar_url: "" },
  };
  let persistedReview: any = editing ? userReview : null;
  let tree: Element;
  let stateIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let effectIndex = 0;
  let dirty = false;
  let changed = 0;
  let storeReads = 0;
  let previewId = 0;
  const props: Record<string, any> =
    surface === "dialog"
      ? {
          open: true,
          storeId: STORE_ID,
          storeName: "Test store",
          existingReview: editing ? userReview : null,
          onOpenChange: (open: boolean) => {
            closed.push(open);
            props.open = open;
          },
          onReviewSubmitted: () => {
            changed++;
          },
        }
      : {
          storeId: STORE_ID,
          storeName: "Test store",
          showWriteForm: true,
          onShowWriteFormChange: (open: boolean) => {
            closed.push(open);
            props.showWriteForm = open;
          },
          onReviewChanged: () => {
            changed++;
          },
        };
  const sameDependencies = (a: unknown[], b?: unknown[]) =>
    !!b &&
    a.length === b.length &&
    a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState: (initial: any) => {
      const index = stateIndex++;
      if (!(index in states))
        states[index] = typeof initial === "function" ? initial() : initial;
      return [
        states[index],
        (value: any) => {
          const next =
            typeof value === "function" ? value(states[index]) : value;
          if (!Object.is(next, states[index])) dirty = true;
          states[index] = next;
        },
      ];
    },
    useRef: (initial: any) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback: (callback: unknown, dependencies: unknown[]) => {
      const index = callbackIndex++;
      if (!sameDependencies(dependencies, callbacks[index]?.dependencies)) {
        callbacks[index] = { dependencies, value: callback };
      }
      return callbacks[index].value;
    },
    useEffect: (
      callback: () => void | (() => void),
      dependencies: unknown[],
    ) => {
      const index = effectIndex++;
      if (sameDependencies(dependencies, effects[index]?.dependencies)) return;
      const previous = effects[index];
      effects[index] = { dependencies };
      pendingEffects.push(() => {
        previous?.cleanup?.();
        const cleanup = callback();
        if (typeof cleanup === "function") effects[index].cleanup = cleanup;
      });
    },
  };
  class MockFormData {
    files: File[] = [];
    append(name: string, file: File) {
      assert.equal(name, "images");
      this.files.push(file);
    }
  }
  async function planned(plans: Outcome[], fallback: Reply): Promise<Reply> {
    const outcome = plans.length ? plans.shift()! : fallback;
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
  const fetch = async (url: string, options: Record<string, any> = {}) => {
    if (url === `/api/stores/${STORE_ID}` && !options.method) {
      storeReads++;
      return reply(200, { success: true, data: { refillItems: [] } });
    }
    if (url === `/api/stores/${STORE_ID}/reviews` && !options.method) {
      return reply(200, { reviews: persistedReview ? [persistedReview] : [] });
    }
    if (url === "/api/reviews/images/upload") {
      assert.equal(options.method, "POST");
      assert.ok(options.body instanceof MockFormData);
      uploads.push([...options.body.files]);
      return planned(
        uploadPlans,
        reply(200, { imageUrls: options.body.files.map(() => UPLOADED_URL) }),
      );
    }
    if (url === `/api/stores/${STORE_ID}/reviews`) {
      const body =
        options.method === "DELETE" ? null : JSON.parse(options.body);
      saves.push({ url, method: options.method, body });
      const response = await planned(savePlans, reply(201, { success: true }));
      if (response.ok && response.payload?.success === true) {
        persistedReview =
          options.method === "DELETE" ? null : { ...userReview, ...body };
      }
      return response;
    }
    throw new Error(
      `Unplanned HTTP request: ${options.method ?? "GET"} ${url}`,
    );
  };
  // Hook dependency functions retain stable identities, as in the production providers.
  const translate = (key: string) => key;
  const toast = (value: Record<string, any>) => toasts.push(value);
  const dependencies: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "next/image": { default: "Image" },
    "next/link": { default: "Link" },
    "date-fns": { formatDistanceToNow: () => "recently" },
    "date-fns/locale": { enUS: {}, ko: {} },
    "@/contexts/AuthContext": {
      useAuth: () => ({ user: USER, profile: null }),
    },
    "@/hooks/use-translation": {
      useTranslation: () => ({ t: translate, locale: "ko" }),
    },
    "@/components/ui/use-toast": { useToast: () => ({ toast }) },
    "@/lib/image-utils": { shouldBeUnoptimized: () => false },
    "@/lib/logger": { logger: { error: () => {} } },
  };
  const globals = {
    Error,
    FormData: MockFormData,
    URL: {
      createObjectURL: () => `blob:review-preview-${++previewId}`,
      revokeObjectURL: () => {},
    },
    fetch,
    console: { log: () => {}, error: () => {} },
    window: {
      addEventListener(
        name: string,
        listener: (event: { key: string }) => void,
      ) {
        assert.equal(name, "keydown");
        listeners.add(listener);
        listenerCalls.added++;
      },
      removeEventListener(
        name: string,
        listener: (event: { key: string }) => void,
      ) {
        assert.equal(name, "keydown");
        assert.ok(listeners.delete(listener));
        listenerCalls.removed++;
      },
    },
  };
  function load(path: string) {
    if (!compiled.has(path)) {
      compiled.set(
        path,
        ts.transpileModule(readFileSync(resolve(path), "utf8"), {
          fileName: path,
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      );
    }
    const exports: Record<string, any> = {};
    runInNewContext(compiled.get(path)!, {
      ...globals,
      exports,
      require(name: string) {
        if (Object.hasOwn(dependencies, name)) return dependencies[name];
        if (
          name === "lucide-react" ||
          name.startsWith("@/components/ui/") ||
          name === "@/components/review-report-dialog"
        ) {
          return new Proxy({}, { get: (_target, key) => String(key) });
        }
        throw new Error(`Unexpected dependency: ${name}`);
      },
    });
    return exports;
  }
  if (surface === "inline")
    dependencies["@/hooks/use-reviews"] = load("hooks/use-reviews.ts");
  const Component =
    surface === "dialog"
      ? load("components/review-write-dialog.tsx").ReviewWriteDialog
      : load("components/store-reviews.tsx").StoreReviews;
  function render() {
    let passes = 0;
    do {
      assert.ok(++passes < 20, "Render/effect loop detected");
      dirty = false;
      stateIndex = refIndex = callbackIndex = effectIndex = 0;
      tree = Component(props);
      pendingEffects.splice(0).forEach((effect) => effect());
    } while (dirty);
    return tree;
  }
  const form = () => {
    const result = elements(tree).find((element) => element.type === "form");
    assert.ok(result, "Review form must remain open");
    return result;
  };
  const content = () =>
    elements(form()).find((element) => element.type === "Textarea")!;
  function fill(withImage = true) {
    const stars = elements(form()).filter(
      (element) =>
        element.type === "button" &&
        elements(element.props.children).some((child) => child.type === "Star"),
    );
    stars[3].props.onClick();
    render();
    content().props.onChange({ target: { value: DRAFT } });
    render();
    if (surface === "dialog") {
      elements(form())
        .find((element) => element.type === "Checkbox")!
        .props.onCheckedChange(true);
      render();
      for (const label of ["무료주차", "혼밥", "좋음"]) {
        elements(form())
          .find(
            (element) =>
              element.type === "button" &&
              text(element.props.children) === label,
          )!
          .props.onClick();
        render();
      }
      elements(form())
        .find(
          (element) =>
            element.type === "Input" && element.props.type !== "file",
        )!
        .props.onChange({ target: { value: "Keep an unfinished menu name" } });
      render();
    }
    if (!withImage) return;
    const file = { name: "review.png", type: "image/png", size: 100 } as File;
    elements(form())
      .find(
        (element) => element.type === "Input" && element.props.type === "file",
      )!
      .props.onChange({ target: { files: [file] } });
    render();
    return file;
  }
  const draft = () => ({
    content: content().props.value,
    previews: elements(form())
      .filter((element) => element.type === "Image")
      .map((element) => element.props.src),
    rating: elements(form()).filter(
      (element) =>
        element.type === "Star" &&
        element.props.className.includes("fill-yellow-400"),
    ).length,
    menus: elements(form())
      .filter((element) => element.type === "Checkbox" && element.props.checked)
      .map((element) => element.props.id),
    unfinishedMenu: elements(form())
      .filter(
        (element) => element.type === "Input" && element.props.type !== "file",
      )
      .map((element) => element.props.value),
    choices: elements(form())
      .filter(
        (element) =>
          element.type === "button" &&
          ["무료주차", "혼밥", "좋음"].includes(text(element.props.children)),
      )
      .map((element) => [
        text(element.props.children),
        element.props.className,
      ]),
  });
  render();
  return {
    uploads,
    saves,
    uploadPlans,
    savePlans,
    toasts,
    closed,
    listenerCalls,
    listeners,
    render,
    form,
    content,
    fill,
    draft,
    tree: () => tree,
    replaceExistingReview: (value: Record<string, unknown>) => {
      props.existingReview = { ...props.existingReview, ...value };
      render();
    },
    changed: () => changed,
    storeReads: () => storeReads,
    submit: () => form().props.onSubmit({ preventDefault() {} }),
    key: (key: string) => {
      for (const listener of listeners) listener({ key });
    },
    flush: async () => {
      await setImmediate();
      render();
    },
  };
}

function assertFailure(
  ui: ReturnType<typeof loadUi>,
  before: ReturnType<ReturnType<typeof loadUi>["draft"]>,
) {
  assert.deepEqual(ui.draft(), before);
  assert.equal(ui.closed.length, 0);
  assert.equal(ui.changed(), 0);
  assert.ok(ui.toasts.length > 0);
  assert.ok(
    ui.toasts.every((toast) => toast.variant === "destructive"),
    "Failure must never announce success",
  );
  assert.equal(ui.content().props.disabled, false);
}

for (const surface of ["dialog", "inline"] as const) {
  for (const editing of [false, true]) {
    const mode = `${surface} ${editing ? "edit" : "create"}`;
    test(`${mode}: reviews without new files save with POST and preserve existing images`, async () => {
      const ui = loadUi(surface, editing);
      await ui.flush();
      ui.fill(false);
      await ui.submit();
      await ui.flush();
      assert.equal(ui.uploads.length, 0);
      assert.equal(ui.saves.length, 1);
      assert.equal(ui.saves[0].method, "POST");
      assert.equal(ui.saves[0].body.content, DRAFT);
      assert.deepEqual(
        ui.saves[0].body.imageUrls,
        editing ? [EXISTING_URL] : [],
      );
      assert.equal(ui.changed(), 1);
      assert.equal(ui.toasts.length, 1);
      assert.notEqual(ui.toasts[0].variant, "destructive");
      assert.deepEqual(
        ui.closed,
        surface === "dialog" || !editing ? [false] : [],
      );
    });

    test(`${mode}: failed upload aborts saving and retains the full draft for retry`, async () => {
      const ui = loadUi(surface, editing);
      await ui.flush();
      const file = ui.fill();
      const before = ui.draft();
      ui.uploadPlans.push(reply(500, { error: "Upload failed" }));
      await ui.submit();
      await ui.flush();
      assert.equal(ui.uploads.length, 1);
      assert.equal(ui.saves.length, 0);
      assertFailure(ui, before);
      await ui.submit();
      await ui.flush();
      assert.equal(ui.uploads.length, 2);
      assert.equal(ui.uploads[1][0], file);
      assert.equal(ui.saves.length, 1);
      assert.equal(ui.saves[0].method, "POST");
      assert.equal(ui.saves[0].body.content, DRAFT);
      assert.deepEqual(ui.saves[0].body.imageUrls, [
        ...(editing ? [EXISTING_URL] : []),
        UPLOADED_URL,
      ]);
      assert.equal(ui.changed(), 1);
    });

    test(`${mode}: failed save retains selected files and reuses successful uploads on retry`, async () => {
      const ui = loadUi(surface, editing);
      await ui.flush();
      ui.fill();
      const before = ui.draft();
      ui.savePlans.push(reply(500, { error: "Save failed" }));
      await ui.submit();
      await ui.flush();
      assertFailure(ui, before);
      assert.equal(ui.uploads.length, 1);
      assert.equal(ui.saves.length, 1);
      assert.equal(ui.saves[0].method, "POST");
      assert.equal(ui.saves[0].body.rating, 4);
      assert.equal(ui.saves[0].body.content, DRAFT);
      if (surface === "dialog") {
        assert.deepEqual(ui.saves[0].body.menus, before.menus);
        assert.deepEqual(ui.saves[0].body.keywords, ["무료주차"]);
        assert.deepEqual(ui.saves[0].body.atmosphere, ["혼밥"]);
        assert.deepEqual(
          ui.saves[0].body.detailedRatings,
          editing ? { taste: 4 } : { taste: 4, price: 3, service: 3 },
        );
      }
      await ui.submit();
      await ui.flush();
      assert.equal(
        ui.uploads.length,
        1,
        "Retry must not upload the same files again",
      );
      assert.equal(ui.saves.length, 2);
      assert.deepEqual(ui.saves[1], ui.saves[0]);
      assert.equal(ui.changed(), 1);
      assert.equal(
        ui.toasts.filter((toast) => toast.variant !== "destructive").length,
        1,
      );
    });

    test(`${mode}: synchronous and rerendered duplicate submissions are blocked through upload and save`, async () => {
      const ui = loadUi(surface, editing);
      await ui.flush();
      ui.fill();
      const before = ui.draft();
      const upload = deferred<Reply>();
      const save = deferred<Reply>();
      ui.uploadPlans.push(upload.promise);
      ui.savePlans.push(save.promise);
      const staleSubmit = ui.form().props.onSubmit;
      const event = { preventDefault() {} };
      const first = staleSubmit(event);
      await staleSubmit(event);
      ui.render();
      await ui.submit();
      assert.equal(ui.uploads.length, 1);
      assert.equal(ui.saves.length, 0);
      assert.equal(ui.content().props.disabled, true);
      assert.equal(
        elements(ui.form()).find((element) => element.props.type === "submit")!
          .props.disabled,
        true,
      );
      if (surface === "dialog") {
        ui.tree().props.onOpenChange(false);
        assert.equal(
          ui.closed.length,
          0,
          "Escape/overlay closure must not discard an in-flight draft",
        );
      }
      upload.resolve(reply(200, { imageUrls: [UPLOADED_URL] }));
      await ui.flush();
      await staleSubmit(event);
      await ui.submit();
      assert.equal(ui.saves.length, 1);
      assert.equal(ui.content().props.disabled, true);
      save.resolve(reply(500, { error: "Save failed" }));
      await first;
      await ui.flush();
      assertFailure(ui, before);
      await ui.submit();
      await ui.flush();
      assert.equal(ui.uploads.length, 1);
      assert.equal(ui.saves.length, 2);
      assert.equal(ui.changed(), 1);
    });

    test(`${mode}: malformed upload responses and transport failures never become empty-image success`, async () => {
      const invalidJson: Reply = {
        ...reply(200, undefined),
        json: async () => {
          throw new SyntaxError("Invalid JSON");
        },
      };
      for (const outcome of [
        reply(200, null),
        reply(200, {}),
        reply(200, { imageUrls: [] }),
        reply(200, { imageUrls: [42] }),
        reply(200, { imageUrls: [" "] }),
        reply(200, { imageUrls: [UPLOADED_URL, UPLOADED_URL] }),
        invalidJson,
        new Error("Connection lost"),
      ]) {
        const ui = loadUi(surface, editing);
        await ui.flush();
        ui.fill();
        const before = ui.draft();
        ui.uploadPlans.push(outcome);
        await ui.submit();
        await ui.flush();
        assert.equal(ui.saves.length, 0);
        assert.equal(ui.toasts.length, 1);
        assertFailure(ui, before);
      }
    });

    test(`${mode}: thrown save requests preserve the draft and release the submission lock`, async () => {
      const ui = loadUi(surface, editing);
      await ui.flush();
      ui.fill();
      const before = ui.draft();
      ui.savePlans.push(new Error("Connection lost"));
      await ui.submit();
      await ui.flush();
      assertFailure(ui, before);
      await ui.submit();
      await ui.flush();
      assert.equal(ui.uploads.length, 1);
      assert.equal(ui.saves.length, 2);
      assert.equal(ui.changed(), 1);
    });
  }
}

for (const surface of ["dialog", "inline"] as const) {
  for (const editing of [false, true]) {
    test(`${surface} ${editing ? "edit" : "create"}: both HTTP status and explicit body success are required`, async () => {
      for (const outcome of [
        reply(500, { success: true }),
        reply(429, { error: "Wait before writing another review" }),
        reply(200, { success: false, error: "Save rejected" }),
        reply(200, { success: "true" }),
        reply(200, null),
        {
          ...reply(200, undefined),
          json: async () => {
            throw new SyntaxError("Invalid JSON");
          },
        },
      ]) {
        const ui = loadUi(surface, editing);
        await ui.flush();
        ui.fill();
        const before = ui.draft();
        ui.savePlans.push(outcome);
        await ui.submit();
        await ui.flush();
        assertFailure(ui, before);
        assert.equal(ui.saves[0].method, "POST");
        assert.equal(ui.toasts.length, 1);
        if (outcome.payload?.error)
          assert.equal(ui.toasts[0].description, outcome.payload.error);
      }
    });
  }
}

test("dialog menu fallback is stable across draft edits without repeated effects or resets", async () => {
  const ui = loadUi("dialog");
  await ui.flush();
  ui.fill();
  const before = ui.draft();
  for (let index = 0; index < 10; index++) ui.render();
  await ui.flush();
  assert.equal(ui.storeReads(), 1);
  assert.deepEqual(ui.draft(), before);
  assert.equal(before.content, DRAFT);
  assert.deepEqual(before.menus, ["바지락칼국수"]);
});

test("inline image keyboard navigation uses fresh indices without rebinding listeners", async () => {
  const urls = [
    "https://media.example.test/one.png",
    "https://media.example.test/two.png",
    "https://media.example.test/three.png",
  ];
  const ui = loadUi("inline", true, urls);
  await ui.flush();
  assert.equal(ui.listeners.size, 0);
  const gallery = elements(ui.tree()).find(
    (element) =>
      element.type === "button" &&
      elements(element.props.children).some(
        (child) =>
          child.type === "Image" && child.props.alt === "리뷰 이미지 1",
      ),
  )!;
  gallery.props.onClick({ preventDefault() {}, stopPropagation() {} });
  ui.render();
  const enlarged = () =>
    elements(ui.tree()).find(
      (element) =>
        element.type === "Image" && element.props.alt === "확대된 리뷰 이미지",
    )!.props.src;
  assert.equal(enlarged(), urls[0]);
  assert.equal(ui.listeners.size, 1);
  assert.equal(ui.listenerCalls.added, 1);
  ui.key("ArrowLeft");
  ui.key("ArrowLeft");
  ui.render();
  assert.equal(enlarged(), urls[1]);
  for (let index = 0; index < 3; index++) ui.key("ArrowRight");
  ui.render();
  assert.equal(enlarged(), urls[1]);
  const thumbnail = elements(ui.tree()).find(
    (element) =>
      element.type === "button" &&
      elements(element.props.children).some(
        (child) => child.type === "Image" && child.props.alt === "썸네일 3",
      ),
  )!;
  thumbnail.props.onClick();
  ui.render();
  assert.equal(enlarged(), urls[2]);
  ui.key("ArrowRight");
  ui.render();
  assert.equal(enlarged(), urls[0]);
  assert.equal(ui.listenerCalls.added, 1);
  assert.equal(ui.listenerCalls.removed, 0);
  ui.key("Escape");
  ui.render();
  assert.equal(ui.listeners.size, 0);
  assert.equal(ui.listenerCalls.removed, 1);
});

for (const surface of ["dialog", "inline"] as const) {
  for (const editing of [false, true]) {
    test(`${surface} ${editing ? "edit" : "create"}: successful persistence distinguishes deferred image cleanup`, async () => {
      for (const [imageCleanup, expectedNotice] of [
        [
          { deferred: true, count: 2, reason: "atomic_cleanup_unavailable" },
          true,
        ],
        [{ deferred: false, count: 2 }, false],
        [{ deferred: true, count: 0 }, false],
        [{ deferred: true, count: "2" }, false],
        [undefined, false],
      ] as const) {
        const ui = loadUi(surface, editing);
        await ui.flush();
        ui.fill(false);
        ui.savePlans.push(reply(200, { success: true, imageCleanup }));
        await ui.submit();
        await ui.flush();
        assert.equal(ui.changed(), 1);
        assert.equal(ui.toasts.length, 1);
        assert.notEqual(ui.toasts[0].variant, "destructive");
        assert.equal(
          ui.toasts[0].description.includes("파일 정리는 보류되었습니다"),
          expectedNotice,
        );
        if (expectedNotice) assert.ok(ui.toasts[0].description.includes("2개"));
      }
    });
  }

  test(`${surface}: blank required content never uploads or saves`, async () => {
    const ui = loadUi(surface);
    await ui.flush();
    ui.fill();
    ui.content().props.onChange({ target: { value: "  " } });
    ui.render();
    const before = ui.draft();
    assert.equal(ui.content().props.required, true);
    if (surface === "dialog") assert.match(text(ui.form()), /방문 후기.*필수/);
    await ui.submit();
    await ui.flush();
    assert.equal(ui.uploads.length, 0);
    assert.equal(ui.saves.length, 0);
    assertFailure(ui, before);
  });
}

test("inline deletion requires HTTP and body success and displays the route's error", async () => {
  for (const outcome of [
    reply(500, { success: true }),
    reply(409, { error: "Review changed; reload first" }),
    reply(200, { success: false, error: "Delete rejected" }),
    reply(200, { success: "true" }),
    reply(200, null),
    {
      ...reply(200, undefined),
      json: async () => {
        throw new SyntaxError("Invalid JSON");
      },
    },
  ]) {
    const ui = loadUi("inline", true);
    await ui.flush();
    const before = ui.draft();
    ui.savePlans.push(outcome);
    await elements(ui.form())
      .find(
        (element) =>
          element.type === "Button" &&
          text(element.props.children) === "delete_review",
      )!
      .props.onClick();
    await ui.flush();
    assertFailure(ui, before);
    assert.equal(ui.saves[0].method, "DELETE");
    assert.equal(ui.toasts.length, 1);
    if (outcome.payload?.error)
      assert.equal(ui.toasts[0].description, outcome.payload.error);
  }
});

test("inline deletion reports persisted success with a separate deferred-file-cleanup notice", async () => {
  const ui = loadUi("inline", true);
  await ui.flush();
  ui.savePlans.push(
    reply(200, {
      success: true,
      imageCleanup: {
        deferred: true,
        count: 1,
        reason: "atomic_cleanup_unavailable",
      },
    }),
  );
  await elements(ui.form())
    .find(
      (element) =>
        element.type === "Button" &&
        text(element.props.children) === "delete_review",
    )!
    .props.onClick();
  await ui.flush();
  assert.equal(ui.saves[0].method, "DELETE");
  assert.equal(ui.changed(), 1);
  assert.deepEqual(ui.closed, [false]);
  assert.equal(ui.toasts.length, 1);
  assert.notEqual(ui.toasts[0].variant, "destructive");
  assert.match(ui.toasts[0].description, /1개의 파일 정리는 보류되었습니다/);
});

test("dialog edit hydrates available metadata and preserves partial detailed ratings", async () => {
  const metadata = {
    keywords: ["무료주차"],
    atmosphere: ["혼밥"],
    detailedRatings: { taste: 4, price: 2 },
    menus: ["영양밥", "Special menu"],
  };
  const ui = loadUi("dialog", true, [EXISTING_URL], metadata);
  await ui.flush();
  assert.deepEqual(ui.draft().menus, ["영양밥", "custom-Special menu"]);
  assert.ok(
    ui
      .draft()
      .choices.find(([label]) => label === "무료주차")![1]
      .includes("bg-blue-100"),
  );
  assert.ok(
    ui
      .draft()
      .choices.find(([label]) => label === "혼밥")![1]
      .includes("bg-blue-100"),
  );
  const taste = elements(ui.form()).find(
    (element) =>
      element.type === "button" && text(element.props.children) === "좋음",
  )!;
  assert.ok(taste.props.className.includes("bg-orange-50"));
  await ui.submit();
  await ui.flush();
  assert.equal(ui.changed(), 1);
  for (const key of [
    "keywords",
    "atmosphere",
    "detailedRatings",
    "menus",
  ] as const) {
    assert.deepEqual(ui.saves[0].body[key], metadata[key]);
  }
});

test("dialog edit omits unknown untouched metadata and images rather than sending defaults", async () => {
  const ui = loadUi("dialog", true, [], { imageUrls: undefined });
  await ui.flush();
  ui.content().props.onChange({ target: { value: DRAFT } });
  ui.render();
  await ui.submit();
  await ui.flush();
  assert.equal(ui.changed(), 1);
  assert.deepEqual(ui.saves[0].body, { rating: 3, content: DRAFT });
});

test("dialog edit keeps known empty metadata empty without requiring replacement selections", async () => {
  const metadata = {
    keywords: [],
    atmosphere: [],
    detailedRatings: {},
    menus: [],
  };
  const ui = loadUi("dialog", true, [], metadata);
  await ui.flush();
  await ui.submit();
  await ui.flush();
  assert.equal(ui.changed(), 1);
  for (const key of [
    "keywords",
    "atmosphere",
    "detailedRatings",
    "menus",
  ] as const) {
    assert.deepEqual(ui.saves[0].body[key], metadata[key]);
  }
});

test("dialog edit includes only explicitly edited unknown detailed-rating keys", async () => {
  const ui = loadUi("dialog", true, [EXISTING_URL], {
    detailedRatings: { taste: 2 },
  });
  await ui.flush();
  elements(ui.form())
    .find(
      (element) =>
        element.type === "button" && text(element.props.children) === "만족",
    )!
    .props.onClick();
  ui.render();
  await ui.submit();
  await ui.flush();
  assert.equal(ui.changed(), 1);
  assert.deepEqual(ui.saves[0].body.detailedRatings, { taste: 2, price: 4 });
  assert.ok(!Object.hasOwn(ui.saves[0].body, "keywords"));
  assert.ok(!Object.hasOwn(ui.saves[0].body, "atmosphere"));
  assert.ok(!Object.hasOwn(ui.saves[0].body, "menus"));
});

test("dialog caller object-identity changes do not reset an edited or failed draft", async () => {
  const ui = loadUi("dialog", true);
  await ui.flush();
  ui.fill();
  const before = ui.draft();
  ui.replaceExistingReview({});
  assert.deepEqual(ui.draft(), before);
  ui.savePlans.push(reply(500, { error: "Save failed" }));
  await ui.submit();
  await ui.flush();
  ui.replaceExistingReview({});
  assertFailure(ui, before);
  assert.equal(ui.storeReads(), 1);
});

test("dialog metadata arriving after editing starts is not replaced by uninitialized defaults", async () => {
  const ui = loadUi("dialog", true, [], { imageUrls: undefined });
  await ui.flush();
  ui.content().props.onChange({ target: { value: DRAFT } });
  ui.render();
  ui.replaceExistingReview({
    keywords: ["무료주차"],
    menus: ["영양밥"],
    detailedRatings: { taste: 4 },
    imageUrls: [EXISTING_URL],
  });
  await ui.submit();
  await ui.flush();
  assert.equal(ui.changed(), 1);
  assert.deepEqual(ui.saves[0].body, { rating: 3, content: DRAFT });
});

for (const failureStage of ["upload", "save"] as const) {
  test(`dialog food and signage selections use one upload workflow and survive ${failureStage} failure`, async () => {
    const ui = loadUi("dialog");
    await ui.flush();
    const food = ui.fill();
    const menu = {
      name: "signage.webp",
      type: "image/webp",
      size: 100,
    } as File;
    elements(ui.form())
      .find(
        (element) =>
          element.type === "Input" && element.props.id === "menu-images",
      )!
      .props.onChange({ target: { files: [menu] } });
    ui.render();
    const before = ui.draft();
    assert.equal(before.previews.length, 2);
    const menuUrl = "https://media.example.test/signage.webp";
    if (failureStage === "upload") {
      ui.uploadPlans.push(reply(500, { error: "Upload failed" }));
    } else {
      ui.uploadPlans.push(reply(200, { imageUrls: [UPLOADED_URL, menuUrl] }));
      ui.savePlans.push(reply(500, { error: "Save failed" }));
    }
    await ui.submit();
    await ui.flush();
    assertFailure(ui, before);
    assert.deepEqual(ui.uploads[0], [food, menu]);
    if (failureStage === "upload") {
      assert.equal(ui.saves.length, 0);
      ui.uploadPlans.push(reply(200, { imageUrls: [UPLOADED_URL, menuUrl] }));
    }
    await ui.submit();
    await ui.flush();
    assert.equal(ui.changed(), 1);
    assert.equal(ui.uploads.length, failureStage === "upload" ? 2 : 1);
    assert.deepEqual(ui.saves[ui.saves.length - 1].body.imageUrls, [
      UPLOADED_URL,
      menuUrl,
    ]);
    assert.ok(
      !Object.hasOwn(ui.saves[ui.saves.length - 1].body, "menuImageUrls"),
    );
  });
}

test("dialog enforces the five-image limit across existing, food, and signage photos", async () => {
  const existing = [
    EXISTING_URL,
    "https://media.example.test/existing-2.png",
    "https://media.example.test/existing-3.png",
  ];
  const ui = loadUi("dialog", true, existing);
  await ui.flush();
  ui.fill();
  const signageInput = () =>
    elements(ui.form()).find(
      (element) =>
        element.type === "Input" && element.props.id === "menu-images",
    )!;
  const signage = { name: "menu.png", type: "image/png", size: 100 } as File;
  const other = { name: "other.png", type: "image/png", size: 100 } as File;
  signageInput().props.onChange({ target: { files: [signage, other] } });
  ui.render();
  assert.equal(ui.draft().previews.length, 4);
  assert.equal(ui.toasts.length, 1);
  assert.equal(ui.toasts[0].variant, "destructive");
  signageInput().props.onChange({ target: { files: [signage] } });
  ui.render();
  assert.equal(ui.draft().previews.length, 5);
  elements(ui.form())
    .find(
      (element) => element.type === "Input" && element.props.type === "file",
    )!
    .props.onChange({ target: { files: [other] } });
  ui.render();
  assert.equal(ui.draft().previews.length, 5);
  assert.equal(ui.toasts.length, 2);
  const signageUrl = "https://media.example.test/menu.png";
  ui.uploadPlans.push(reply(200, { imageUrls: [UPLOADED_URL, signageUrl] }));
  await ui.submit();
  await ui.flush();
  assert.equal(ui.changed(), 1);
  assert.deepEqual(ui.saves[0].body.imageUrls, [
    ...existing,
    UPLOADED_URL,
    signageUrl,
  ]);
});
