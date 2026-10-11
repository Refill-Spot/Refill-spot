import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest } from "next/server";
import ts from "typescript";
import * as responses from "../lib/api-response";
import * as validations from "../lib/validations";

const code = ts.transpileModule(
  readFileSync("app/api/contact/route.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

function loadContactRoute(error: unknown = null) {
  const writes: Record<string, unknown>[] = [];
  const exported = {} as { POST(request: NextRequest): Promise<Response> };
  runInNewContext(code, {
    exports: exported,
    URL,
    console,
    require(name: string) {
      if (name === "@/lib/api-response") return responses;
      if (name === "@/lib/validations") return validations;
      if (name === "@/lib/logger") return { apiLogger: { error() {} } };
      if (name === "@/lib/auth-utils") return {};
      if (name === "@/lib/supabase/server")
        return {
          createRouteHandlerSupabaseClient: () => ({
            from(table: string) {
              assert.equal(table, "contacts");
              return {
                async insert(value: Record<string, unknown>) {
                  writes.push(value);
                  return { error };
                },
              };
            },
          }),
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { post: exported.POST, writes };
}

const validContact = {
  type: "inquiry",
  name: "Visitor",
  email: "visitor@example.com",
  message: "A question",
};
function request(body: unknown) {
  return new NextRequest("https://refill.example/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("public contact submission requires INSERT only, never a SELECT of personal data", async () => {
  const route = loadContactRoute();
  const response = await route.post(
    request({ ...validContact, status: "completed" }),
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).success, true);
  assert.equal(route.writes.length, 1);
  assert.equal(route.writes[0].status, "pending");
});

test("failed contact persistence is not reported as a successful submission", async () => {
  const route = loadContactRoute({ message: "private database details" });
  const response = await route.post(request(validContact));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).success, false);
});

test("invalid contact payloads never reach persistence", async () => {
  for (const body of [
    null,
    [],
    {},
    { ...validContact, name: " " },
    { ...validContact, email: "invalid" },
    { ...validContact, name: {} },
    { ...validContact, type: "store_registration" },
    { ...validContact, message: "a".repeat(5001) },
  ]) {
    const route = loadContactRoute();
    assert.equal((await route.post(request(body))).status, 400);
    assert.equal(route.writes.length, 0);
  }
});
