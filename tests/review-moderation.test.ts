import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest, NextResponse } from "next/server";
import ts from "typescript";
import * as apiResponse from "../lib/api-response";

type Method = "PATCH" | "DELETE";
type User = { id: string };
type AdminCheck = {
  isAdmin: boolean;
  user: User | null;
  error?: string | null;
  status?: number;
};
type Review = {
  id: number;
  user_id: string;
  profiles: { username: string } | { username: string }[] | null;
  review_reports: { id: number; status: string; reason: string }[] | null;
};
type Report = {
  id: number;
  review_id: number;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
};
type Update = {
  status: string;
  reviewed_by: string;
  reviewed_at: string;
};
type Query = {
  table: string;
  selection?: string;
  filters: [string, unknown][];
  update?: Update;
};
type Handler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<NextResponse>;
type Options = {
  adminCheck?: AdminCheck;
  user?: User | null;
  authError?: unknown;
  review?: Review | null;
  fetchError?: unknown;
  updatedReports?: Report[] | null;
  updateError?: unknown;
  rpcError?: unknown;
  throwGate?: boolean;
  throwQuery?: boolean;
  throwRpc?: boolean;
};

const ADMIN = { id: "verified-admin-id" };
const REVIEW: Review = {
  id: 12,
  user_id: "review-author-id",
  profiles: { username: "review author" },
  review_reports: [
    { id: 101, status: "pending", reason: "spam" },
    { id: 102, status: "reviewed", reason: "duplicate" },
  ],
};
const routePath = "app/api/admin/reviews/[id]/route.ts";
const compiledRoute = ts.transpileModule(
  readFileSync(resolve(routePath), "utf8"),
  {
    fileName: routePath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

// Load the production handler with isolated auth/DB boundaries; no network or DB access.
function loadRoute(options: Options = {}) {
  const calls = {
    gateRequests: [] as NextRequest[],
    clientRequests: [] as NextRequest[],
    auth: 0,
    queries: [] as Query[],
    rpc: [] as { name: string; args: unknown }[],
    events: [] as string[],
    errors: [] as unknown[][],
  };
  const adminCheck = options.adminCheck ?? {
    isAdmin: true,
    user: ADMIN,
    status: 200,
  };
  const review = options.review === undefined ? REVIEW : options.review;
  let gateVerified = false;
  const supabase = {
    auth: {
      getUser: async () => {
        calls.auth += 1;
        calls.events.push("getUser");
        return {
          data: { user: options.user === undefined ? ADMIN : options.user },
          error: options.authError ?? null,
        };
      },
    },
    from: (table: string) => {
      assert.ok(gateVerified, "privileged queries require a verified admin");
      calls.events.push(table);
      const query: Query = { table, filters: [] };
      calls.queries.push(query);
      if (options.throwQuery) throw new Error("private backend query details");
      if (table === "reviews") {
        const builder = {
          select: (selection: string) => {
            query.selection = selection;
            return builder;
          },
          eq: (column: string, value: unknown) => {
            query.filters.push([column, value]);
            return builder;
          },
          single: async () => ({
            data: review,
            error: options.fetchError ?? null,
          }),
        };
        return builder;
      }
      assert.equal(table, "review_reports");
      const builder = {
        update: (update: Update) => {
          query.update = structuredClone(update);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          query.filters.push([column, value]);
          return builder;
        },
        select: async () => ({
          data:
            options.updatedReports === undefined
              ? [{ id: 101, review_id: 12, ...query.update }]
              : options.updatedReports,
          error: options.updateError ?? null,
        }),
      };
      return builder;
    },
    rpc: async (name: string, args: unknown) => {
      assert.ok(gateVerified, "privileged RPC requires a verified admin");
      calls.events.push("rpc");
      calls.rpc.push({ name, args: structuredClone(args) });
      if (options.throwRpc)
        throw new Error("private RPC implementation details");
      return { error: options.rpcError ?? null };
    },
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextRequest, NextResponse },
    "@/lib/api-response": apiResponse,
    "@/lib/auth-utils": {
      checkAdminAccessForAPI: async (request: NextRequest) => {
        calls.gateRequests.push(request);
        calls.events.push("adminCheck");
        if (options.throwGate) throw new Error("private auth backend details");
        gateVerified = adminCheck.isAdmin && !!adminCheck.user;
        return adminCheck;
      },
    },
    "@/lib/supabase/server": {
      createRouteHandlerSupabaseClient: (request: NextRequest) => {
        assert.ok(gateVerified, "client must not bypass the admin gate");
        assert.equal(request, calls.gateRequests.at(-1));
        calls.clientRequests.push(request);
        calls.events.push("client");
        return supabase;
      },
    },
  };
  const handlers: Partial<Record<Method, Handler>> = {};
  runInNewContext(compiledRoute, {
    exports: handlers,
    console: { error: (...args: unknown[]) => calls.errors.push(args) },
    require: (specifier: string) => {
      assert.ok(Object.hasOwn(dependencies, specifier), specifier);
      return dependencies[specifier];
    },
  });
  assert.ok(handlers.PATCH);
  assert.ok(handlers.DELETE);
  return {
    calls,
    invoke: async (
      method: Method,
      id = "12",
      body = '{"action":"approve"}',
    ) => {
      const request = new NextRequest("http://localhost/api/admin/reviews/12", {
        method,
        headers: {
          "Content-Type": "application/json",
          cookie: "untrusted-user-id=not-the-verified-admin",
        },
        ...(method === "PATCH" ? { body } : {}),
      });
      const response = await handlers[method]!(request, {
        params: Promise.resolve({ id }),
      });
      return { response, request, body: await response.json() };
    },
  };
}

function assertNoPrivilegedAccess(
  calls: ReturnType<typeof loadRoute>["calls"],
) {
  assert.deepEqual(calls.clientRequests, []);
  assert.equal(calls.auth, 0);
  assert.deepEqual(calls.queries, []);
  assert.deepEqual(calls.rpc, []);
}

for (const [action, status, message] of [
  ["approve", "reviewed", "신고가 승인되어 처리되었습니다."],
  ["reject", "dismissed", "신고가 기각되었습니다."],
]) {
  test(`PATCH ${action} updates only pending reports as the verified admin`, async () => {
    const { invoke, calls } = loadRoute();
    const { response, request, body } = await invoke(
      "PATCH",
      "12",
      JSON.stringify({ action }),
    );
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.message, message);
    assert.equal(calls.gateRequests[0], request);
    assert.equal(calls.clientRequests[0], request);
    assert.deepEqual(calls.events, [
      "adminCheck",
      "client",
      "reviews",
      "review_reports",
    ]);
    assert.deepEqual(calls.queries[0].filters, [["id", 12]]);
    const update = calls.queries[1].update!;
    assert.equal(update.status, status);
    assert.equal(update.reviewed_by, ADMIN.id);
    assert.equal(
      new Date(update.reviewed_at).toISOString(),
      update.reviewed_at,
    );
    assert.deepEqual(calls.queries[1].filters, [
      ["review_id", 12],
      ["status", "pending"],
    ]);
    assert.deepEqual(body.data.updated_reports, [
      { id: 101, review_id: 12, ...update },
    ]);
    assert.deepEqual(calls.rpc, []);
  });
}

test("anonymous and non-admin requests are denied before privileged access or body parsing", async () => {
  for (const method of ["PATCH", "DELETE"] as const) {
    for (const adminCheck of [
      {
        isAdmin: false,
        user: null,
        error: "로그인이 필요합니다.",
        status: 401,
      },
      {
        isAdmin: false,
        user: { id: "non-admin" },
        error: "관리자 권한이 필요합니다.",
        status: 403,
      },
      {
        isAdmin: false,
        user: ADMIN,
        error: "프로필을 찾을 수 없습니다.",
        status: 404,
      },
    ]) {
      const { invoke, calls } = loadRoute({ adminCheck });
      const { response, body } = await invoke(
        method,
        "invalid-id",
        "invalid JSON",
      );
      assert.equal(response.status, adminCheck.status, method);
      assert.deepEqual(body, {
        success: false,
        error: { code: "error", message: adminCheck.error },
      });
      assert.equal(calls.gateRequests.length, 1);
      assertNoPrivilegedAccess(calls);
    }
  }
});

test("a successful admin flag without a verified identity fails closed", async () => {
  for (const method of ["PATCH", "DELETE"] as const) {
    const { invoke, calls } = loadRoute({
      adminCheck: { isAdmin: true, user: null },
    });
    const { response, body } = await invoke(method);
    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assertNoPrivilegedAccess(calls);
  }
});

test("both methods reject non-positive, partial, non-decimal and unsafe IDs before queries", async () => {
  for (const method of ["PATCH", "DELETE"] as const) {
    for (const id of [
      "",
      "0",
      "000",
      "-1",
      "+12",
      "12.0",
      "12.5",
      "12abc",
      "12/34",
      "12;DELETE",
      "1e3",
      "0x10",
      "NaN",
      "Infinity",
      " 12",
      "12 ",
      "12\n",
      "12\r\n",
      "12\u0000",
      "１２",
      "9007199254740992",
      "9007199254740993",
      "9".repeat(400),
    ]) {
      const { invoke, calls } = loadRoute();
      const { response, body } = await invoke(method, id);
      assert.equal(response.status, 400, `${method} ${JSON.stringify(id)}`);
      assert.equal(body.success, false);
      assert.equal(calls.gateRequests.length, 1);
      assertNoPrivilegedAccess(calls);
    }
  }
});

test("valid decimal ID boundaries are passed to queries and RPCs as exact numbers", async () => {
  for (const method of ["PATCH", "DELETE"] as const) {
    for (const id of ["1", "0012", String(Number.MAX_SAFE_INTEGER)]) {
      const { invoke, calls } = loadRoute();
      const { response } = await invoke(method, id);
      assert.equal(response.status, 200, `${method} ${id}`);
      assert.deepEqual(calls.queries[0].filters, [["id", Number(id)]]);
      if (method === "PATCH") {
        assert.deepEqual(calls.queries[1].filters, [
          ["review_id", Number(id)],
          ["status", "pending"],
        ]);
      } else {
        assert.deepEqual(calls.rpc[0].args, {
          review_id: Number(id),
          admin_user_id: ADMIN.id,
        });
      }
    }
  }
});

test("PATCH rejects malformed JSON before obtaining a database client", async () => {
  for (const input of [
    "",
    "{",
    '{"action":"approve"',
    '{"action":"reject",}',
    "not JSON",
  ]) {
    const { invoke, calls } = loadRoute();
    const { response, body } = await invoke("PATCH", "12", input);
    assert.equal(response.status, 400, input);
    assert.equal(body.success, false);
    assertNoPrivilegedAccess(calls);
  }
});

test("PATCH accepts only approve/reject actions in an object body", async () => {
  for (const input of [
    null,
    false,
    1,
    "approve",
    [],
    [{ action: "approve" }],
    {},
    { action: null },
    { action: true },
    { action: 1 },
    { action: [] },
    { action: {} },
    { action: "" },
    { action: "dismiss" },
    { action: "APPROVE" },
    { action: "reject " },
    { action: "delete" },
  ]) {
    const { invoke, calls } = loadRoute();
    const { response, body } = await invoke(
      "PATCH",
      "12",
      JSON.stringify(input),
    );
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(body.success, false);
    assertNoPrivilegedAccess(calls);
  }
});

test("missing reviews or failed lookups never update reports or invoke deletion", async () => {
  for (const method of ["PATCH", "DELETE"] as const) {
    for (const options of [
      { review: null },
      { fetchError: { message: "private database details" } },
    ]) {
      const { invoke, calls } = loadRoute(options);
      const { response, body } = await invoke(method);
      assert.equal(response.status, 404);
      assert.equal(body.success, false);
      assert.equal(calls.queries.length, 1);
      assert.deepEqual(calls.rpc, []);
      assert.equal(
        JSON.stringify(body).includes("private database details"),
        false,
      );
    }
  }
});

test("PATCH rejects reviews with no reports without issuing an update", async () => {
  for (const reports of [null, []]) {
    const { invoke, calls } = loadRoute({
      review: { ...REVIEW, review_reports: reports },
    });
    const { response, body } = await invoke("PATCH");
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(calls.queries.length, 1);
  }
});

test("PATCH does not report success when RLS or concurrent moderation changes zero rows", async () => {
  for (const action of ["approve", "reject"]) {
    for (const updatedReports of [null, []]) {
      const { invoke, calls } = loadRoute({ updatedReports });
      const { response, body } = await invoke(
        "PATCH",
        "12",
        JSON.stringify({ action }),
      );
      assert.equal(response.status, 409);
      assert.equal(body.success, false);
      assert.equal(Object.hasOwn(body, "data"), false);
      assert.equal(calls.queries.length, 2);
      assert.deepEqual(calls.queries[1].filters, [
        ["review_id", 12],
        ["status", "pending"],
      ]);
    }
  }
});

test("PATCH update failures use a generic response without backend error details", async () => {
  const { invoke, calls } = loadRoute({
    updateError: {
      message: "private constraint details",
      code: "42501",
      details: "private schema",
    },
  });
  const { response, body } = await invoke("PATCH");
  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    success: false,
    error: { code: "error", message: "신고 상태 업데이트에 실패했습니다." },
  });
  assert.equal(calls.queries.length, 2);
  assert.equal(calls.errors.length, 1);
});

test("DELETE preserves the privileged RPC and response shape with verified identity", async () => {
  for (const profiles of [
    { username: "review author" },
    [{ username: "review author" }],
  ]) {
    const { invoke, calls } = loadRoute({ review: { ...REVIEW, profiles } });
    const { response, request, body } = await invoke("DELETE");
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      data: {
        message: "리뷰가 성공적으로 삭제되었습니다.",
        deletedReview: {
          id: 12,
          userId: REVIEW.user_id,
          username: "review author",
        },
      },
    });
    assert.equal(calls.gateRequests[0], request);
    assert.equal(calls.clientRequests[0], request);
    assert.equal(calls.auth, 1);
    assert.deepEqual(calls.events, [
      "adminCheck",
      "client",
      "getUser",
      "reviews",
      "rpc",
    ]);
    assert.deepEqual(calls.rpc, [
      {
        name: "delete_review_as_admin",
        args: { review_id: 12, admin_user_id: ADMIN.id },
      },
    ]);
  }
});

test("DELETE denies missing, failed or mismatched request identities before review access", async () => {
  for (const options of [
    { user: null },
    { user: ADMIN, authError: { message: "invalid token" } },
    { user: { id: "different-user" } },
  ]) {
    const { invoke, calls } = loadRoute(options);
    const { response, body } = await invoke("DELETE");
    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(calls.auth, 1);
    assert.deepEqual(calls.queries, []);
    assert.deepEqual(calls.rpc, []);
  }
});

test("DELETE RPC errors do not expose raw backend messages, codes or details", async () => {
  const { invoke, calls } = loadRoute({
    rpcError: {
      message: "private SQL function definition",
      code: "42883",
      details: "private table and user IDs",
      hint: "private schema hint",
    },
  });
  const { response, body } = await invoke("DELETE");
  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    success: false,
    error: { code: "error", message: "리뷰 삭제에 실패했습니다." },
  });
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.errors.length, 1);
});

test("thrown auth, query and RPC failures remain generic and never report success", async () => {
  for (const method of ["PATCH", "DELETE"] as const) {
    for (const options of [{ throwGate: true }, { throwQuery: true }]) {
      const { invoke, calls } = loadRoute(options);
      const { response, body } = await invoke(method);
      assert.equal(response.status, 500);
      assert.deepEqual(body, {
        success: false,
        error: { code: "error", message: "서버 오류가 발생했습니다." },
      });
      assert.deepEqual(calls.rpc, []);
      if (options.throwGate) assertNoPrivilegedAccess(calls);
    }
  }
  const { invoke } = loadRoute({ throwRpc: true });
  const { response, body } = await invoke("DELETE");
  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    success: false,
    error: { code: "error", message: "서버 오류가 발생했습니다." },
  });
});
