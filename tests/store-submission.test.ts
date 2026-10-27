import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest } from "next/server";
import ts from "typescript";
import * as responses from "../lib/api-response";
import * as validations from "../lib/validations";

const validReport = {
  type: "store_registration",
  name: "Private visitor",
  email: "private-visitor@example.com",
  storeName: "서울 리필 식당",
  storeAddress: "서울특별시 마포구 양화로 10, 2층",
  message: "고기와 채소를 90분 동안 무한리필하며 가격은 2만원입니다.",
  reportKind: "new_store",
  refillScope: "meal",
} as const;

function compile(path: string, jsx = false) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
  }).outputText;
}

const routeCode = compile("app/api/contact/route.ts");
const pageCode = compile("app/contact/page.tsx", true);

function loadRoute(
  options: {
    insertError?: unknown;
    isAdmin?: boolean;
    rows?: Array<Record<string, unknown>>;
  } = {},
) {
  const writes: Array<Record<string, unknown>> = [];
  const tables: string[] = [];
  const calls = { clients: 0, adminChecks: 0 };
  const handlers = {} as {
    POST(request: NextRequest): Promise<Response>;
    GET(request: NextRequest): Promise<Response>;
  };
  runInNewContext(routeCode, {
    exports: handlers,
    URL,
    console: { error() {} },
    require(name: string) {
      if (name === "@/lib/api-response") return responses;
      if (name === "@/lib/validations") return validations;
      if (name === "@/lib/logger") return { apiLogger: { error() {} } };
      if (name === "@/lib/auth-utils")
        return {
          async checkAdminAccessForAPI() {
            calls.adminChecks++;
            return { isAdmin: options.isAdmin === true, status: 403 };
          },
        };
      if (name === "@/lib/supabase/server")
        return {
          createRouteHandlerSupabaseClient() {
            calls.clients++;
            return {
              from(table: string) {
                tables.push(table);
                assert.equal(
                  table,
                  "contacts",
                  "submissions never write stores",
                );
                return {
                  async insert(value: Record<string, unknown>) {
                    writes.push(value);
                    return { error: options.insertError || null };
                  },
                  select() {
                    return {
                      order() {
                        return this;
                      },
                      eq() {
                        return this;
                      },
                      async range() {
                        return {
                          data: options.rows || [],
                          error: null,
                          count: options.rows?.length || 0,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { ...handlers, writes, tables, calls };
}

function request(body: unknown) {
  return new NextRequest("https://refill.example/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const invalidAddresses = [
  "부산광역시 중구 중앙대로 10",
  "경기도 하남시 서울로 10",
  "서울로 10",
  "서울시 강남구 테헤란로 10",
  "서울특별시청 강남구 테헤란로 10",
  "서울맛집 강남구 테헤란로 10",
  "가짜서울 강남구 테헤란로 10",
  "서울특별시 분당구 정자로 10",
  "서울 중동구 중앙로 10",
  "서울 중구역 중앙로 10",
  "서울 강남구청 테헤란로 10",
  "중구 중앙로 10",
  "서울 중구",
  "서울 강남구/서초구 테헤란로 10",
  "서울 강남구 서초구 테헤란로 10",
  "서울 강남구 서초구/송파구 테헤란로 10",
];
const invalidLinks = [
  "javascript:alert(1)",
  "data:text/html,hello",
  "ftp://example.com/menu",
  "//example.com/menu",
  "https:example.com/menu",
  "https://user:secret@example.com/menu",
  "http://user@example.com/menu",
  "https://@example.com/menu",
  "https://:@example.com/menu",
  "https://example.com/\nforged-label",
  "https://example.com/a b",
  "https://",
  `https://example.com/${"a".repeat(2048)}`,
];
const invalidDates = [
  "2025-02-29",
  "2024-02-30",
  "2024-04-31",
  "2024-13-01",
  "2024-00-01",
  "2024-01-00",
  "2024-1-01",
  "2024-01-1",
  "2024-01-01T00:00:00Z",
  "0000-01-01",
  "9999-12-31",
  "not-a-date",
];

test("store reports reject non-Seoul, invented city names and ambiguous district addresses before persistence", async () => {
  for (const storeAddress of invalidAddresses) {
    const body = { ...validReport, storeAddress };
    assert.equal(
      validations.contactSubmissionSchema.safeParse(body).success,
      false,
      storeAddress,
    );
    const route = loadRoute();
    assert.equal((await route.POST(request(body))).status, 400, storeAddress);
    assert.equal(route.calls.clients, 0, storeAddress);
    assert.equal(route.writes.length, 0);
  }
});

test("all 25 Seoul districts accept short/full city names and surrounding whitespace with address details", () => {
  const districts = [
    "종로구",
    "중구",
    "용산구",
    "성동구",
    "광진구",
    "동대문구",
    "중랑구",
    "성북구",
    "강북구",
    "도봉구",
    "노원구",
    "은평구",
    "서대문구",
    "마포구",
    "양천구",
    "강서구",
    "구로구",
    "금천구",
    "영등포구",
    "동작구",
    "관악구",
    "서초구",
    "강남구",
    "송파구",
    "강동구",
  ];
  for (const district of districts) {
    for (const city of ["서울 ", "서울특별시   ", "서울특별시"]) {
      const result = validations.contactSubmissionSchema.safeParse({
        ...validReport,
        storeAddress: `  ${city}${district}  중앙로 10  `,
      });
      assert.equal(result.success, true, `${city}${district}`);
    }
  }
});

test("unsafe/overlong evidence links and invalid/future local dates never reach persistence", async () => {
  const cases = [
    ...invalidLinks.map((evidenceUrl) => ({ evidenceUrl })),
    ...invalidDates.map((observedDate) => ({ observedDate })),
  ];
  for (const fields of cases) {
    const body = { ...validReport, ...fields };
    assert.equal(
      validations.contactSubmissionSchema.safeParse(body).success,
      false,
      JSON.stringify(fields),
    );
    const route = loadRoute();
    assert.equal(
      (await route.POST(request(body))).status,
      400,
      JSON.stringify(fields),
    );
    assert.equal(route.writes.length, 0);
    assert.equal(route.calls.clients, 0);
  }
});

test("observed dates follow the Seoul calendar rather than UTC and permit real leap days", (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-10-24T14:59:59Z"),
  });
  const parseDate = (observedDate: string) =>
    validations.contactSubmissionSchema.safeParse({
      ...validReport,
      observedDate,
    }).success;
  assert.equal(parseDate("2026-10-24"), true);
  assert.equal(parseDate("2026-10-25"), false);
  t.mock.timers.tick(1000);
  assert.equal(parseDate("2026-10-25"), true);
  assert.equal(parseDate("2026-10-26"), false);
  assert.equal(parseDate("2024-02-29"), true);
});

test("store reports require an explicit supported scope and a substantive original description", async () => {
  for (const fields of [
    { refillScope: undefined },
    { refillScope: "" },
    { refillScope: "all" },
    { storeName: " " },
    { storeAddress: undefined },
    { message: "무한리필" },
    { message: "!!! ... --- !!! ... ---" },
    { message: "가 나 다 라 마 바 사 아 자" },
    { reportKind: "publish" },
  ]) {
    const route = loadRoute();
    assert.equal(
      (await route.POST(request({ ...validReport, ...fields }))).status,
      400,
    );
    assert.equal(route.writes.length, 0);
  }
});

test("new and correction reports retain descriptions and labelled metadata, remain pending, and never publish or expose private details", async () => {
  const scopes = {
    meal: "식사·주메뉴 무한리필",
    buffet: "뷔페",
    side: "반찬·사이드만 리필",
    unknown: "확인 필요·모름",
  };
  for (const [refillScope, label] of Object.entries(scopes)) {
    for (const reportKind of ["new_store", "correction"]) {
      const route = loadRoute();
      const response = await route.POST(
        request({
          ...validReport,
          refillScope,
          reportKind,
          evidenceUrl: "http://example.com/menu?source=report",
          observedDate: "2024-02-29",
          status: "completed",
          verified: true,
          store_id: 7,
        }),
      );
      assert.equal(response.status, 201);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.deepEqual(route.tables, ["contacts"]);
      assert.equal(route.writes.length, 1);
      const inserted = route.writes[0];
      assert.equal(inserted.type, "store_registration");
      assert.equal(inserted.status, "pending");
      assert.equal(inserted.name, validReport.name);
      assert.equal(inserted.email, validReport.email);
      assert.equal(inserted.store_address, validReport.storeAddress);
      assert.equal(inserted.store_name, validReport.storeName);
      assert.equal(inserted.store_id, undefined);
      assert.equal(inserted.verified, undefined);
      const message = String(inserted.message);
      assert.ok(
        message.startsWith(`${validReport.message}\n\n[서버 생성 제보 정보`),
      );
      assert.ok(
        message.includes(
          `제보 종류: ${reportKind === "correction" ? "기존 정보 수정" : "신규 가게"}`,
        ),
      );
      assert.ok(message.includes(`무한리필 범위: ${label}`));
      assert.ok(
        message.includes(
          "근거 URL (제보자 제공·미검증): http://example.com/menu?source=report",
        ),
      );
      assert.ok(
        message.includes("확인한 날짜 (제보자 제공·미검증): 2024-02-29"),
      );
      assert.ok(
        message.endsWith("처리: 검토 대기 — 제보 즉시 등록·수정되지 않습니다."),
      );
      const result = await response.json();
      assert.equal(result.success, true);
      assert.match(result.data.message, /검토/);
      assert.match(result.data.message, /즉시 등록·수정되지 않습니다/);
      assert.ok(!JSON.stringify(result).includes(validReport.name));
      assert.ok(!JSON.stringify(result).includes(validReport.email));
    }
  }
});

test("optional report metadata may be absent or blank, but is never presented as verified", async () => {
  const withoutKind = { ...validReport, reportKind: undefined };
  for (const fields of [{}, { evidenceUrl: " ", observedDate: " " }]) {
    const route = loadRoute();
    const response = await route.POST(request({ ...withoutKind, ...fields }));
    assert.equal(response.status, 201);
    assert.match(String(route.writes[0].message), /제보 종류: 미제공/);
    assert.match(
      String(route.writes[0].message),
      /근거 URL \(제보자 제공·미검증\): 미제공/,
    );
    assert.match(
      String(route.writes[0].message),
      /확인한 날짜 \(제보자 제공·미검증\): 미제공/,
    );
  }
  const route = loadRoute();
  assert.equal(
    (
      await route.POST(
        request({ ...validReport, evidenceUrl: "https://example.com/메뉴" }),
      )
    ).status,
    201,
  );
  const prefix = "https://example.com/";
  const evidenceUrl = prefix + "a".repeat(2048 - prefix.length);
  assert.equal(
    (await route.POST(request({ ...validReport, evidenceUrl }))).status,
    201,
  );
  assert.ok(String(route.writes[1].message).includes(evidenceUrl));
});

test("the final stored description including server metadata is bounded to 5,000 characters", async () => {
  const overhead = validations.buildContactMessage({
    ...validReport,
    message: "",
  }).length;
  const message = "가".repeat(5000 - overhead);
  const route = loadRoute();
  assert.equal(
    (await route.POST(request({ ...validReport, message }))).status,
    201,
  );
  assert.equal(String(route.writes[0].message).length, 5000);
  const overflow = loadRoute();
  assert.equal(
    (await overflow.POST(request({ ...validReport, message: `${message}가` })))
      .status,
    400,
  );
  assert.equal(overflow.writes.length, 0);
});

test("inquiries and feedback keep their existing short-message and non-Seoul behavior", async () => {
  for (const type of ["inquiry", "feedback"]) {
    const route = loadRoute();
    const response = await route.POST(
      request({
        type,
        name: validReport.name,
        email: validReport.email,
        message: "문",
        storeAddress: "부산 중구 중앙대로 10",
      }),
    );
    assert.equal(response.status, 201);
    assert.equal(route.writes[0].message, "문");
    assert.equal(route.writes[0].status, "pending");
  }
});

test("failed report persistence returns an error without private database details or a publication claim", async () => {
  const route = loadRoute({
    insertError: { message: "private database details" },
  });
  const response = await route.POST(request(validReport));
  assert.equal(response.status, 500);
  const result = await response.json();
  assert.equal(result.success, false);
  assert.ok(!JSON.stringify(result).includes("private database details"));
});

test("contact listing remains admin-only and historical messages are not rewritten", async () => {
  const denied = loadRoute();
  const url = new NextRequest("https://refill.example/api/contact");
  assert.equal((await denied.GET(url)).status, 403);
  assert.equal(denied.calls.adminChecks, 1);
  assert.equal(denied.calls.clients, 0);
  const historical = {
    id: 1,
    type: "store_registration",
    status: "pending",
    name: "Historical visitor",
    email: "historical@example.com",
    message: "이전 형식의 가게 등록 설명",
  };
  const allowed = loadRoute({ isAdmin: true, rows: [historical] });
  const response = await allowed.GET(url);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.contacts, [historical]);
  assert.equal(allowed.writes.length, 0);
});

type Element = { type: unknown; props: Record<string, any> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}
function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string") return tree;
  if (!tree || typeof tree !== "object" || !("props" in tree)) return "";
  return text((tree as Element).props.children);
}
function loadPage() {
  const states: any[] = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const toasts: Array<Record<string, string>> = [];
  let stateIndex = 0;
  const component = {} as { default(): Element };
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  runInNewContext(pageCode, {
    exports: component,
    console: { error() {} },
    async fetch(url: string, options: { body: string }) {
      requests.push({ url, body: JSON.parse(options.body) });
      return { json: async () => ({ success: true }) };
    },
    require(name: string) {
      if (name === "react/jsx-runtime")
        return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name === "react")
        return {
          useState(initial: unknown) {
            const index = stateIndex++;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (value: any) => {
                states[index] =
                  typeof value === "function" ? value(states[index]) : value;
              },
            ];
          },
        };
      if (name === "@/lib/validations") return validations;
      if (name === "next/navigation")
        return { useRouter: () => ({ back() {} }) };
      if (name === "@/components/ui/use-toast")
        return {
          useToast: () => ({
            toast: (value: Record<string, string>) => toasts.push(value),
          }),
        };
      if (name === "lucide-react")
        return { ArrowLeft: "icon", Mail: "icon", Store: "icon" };
      if (name.startsWith("@/components/ui/"))
        return Object.fromEntries(
          [
            "Button",
            "Card",
            "CardContent",
            "CardDescription",
            "CardHeader",
            "CardTitle",
            "Input",
            "Label",
            "Textarea",
          ].map((key) => [key, key]),
        );
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  function render() {
    stateIndex = 0;
    return component.default();
  }
  function field(name: string) {
    const found = elements(render()).find(
      (element) => element.props.name === name,
    );
    assert.ok(found, `missing field ${name}`);
    return found;
  }
  return {
    render,
    field,
    requests,
    toasts,
    change(name: string, value: string) {
      field(name).props.onChange({ target: { name, value } });
    },
    async submit() {
      const form = elements(render()).find(
        (element) => element.type === "form",
      );
      assert.ok(form);
      await form.props.onSubmit({ preventDefault() {} });
    },
  };
}

test("the real contact form requests reviewed new/correction reports without promising automatic registration", async () => {
  const ui = loadPage();
  const copy = text(ui.render());
  assert.match(copy, /서울 가게 신규 제보·정보 수정/);
  assert.match(copy, /검토 후/);
  assert.match(copy, /제보 즉시 등록되는 것은 아닙니다/);
  assert.match(copy, /공개 자료 수집과 이용자 제보/);
  assert.match(copy, /이름·이메일·연락처는 문의 응대용이며 공개하지 않습니다/);
  assert.equal(ui.field("refillScope").props.value, "");
  ui.change("name", validReport.name);
  ui.change("email", validReport.email);
  ui.change("storeName", validReport.storeName);
  ui.change("storeAddress", validReport.storeAddress);
  ui.change("message", validReport.message);
  await ui.submit();
  assert.equal(ui.requests.length, 0, "scope must be selected explicitly");
  ui.change("refillScope", "side");
  ui.change("reportKind", "correction");
  await ui.submit();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, "/api/contact");
  assert.equal(ui.requests[0].body.type, "store_registration");
  assert.equal(ui.requests[0].body.reportKind, "correction");
  assert.equal(ui.requests[0].body.refillScope, "side");
  assert.equal(ui.requests[0].body.message, validReport.message);
  assert.match(ui.toasts.at(-1)?.title || "", /검토 대기/);
  assert.match(
    ui.toasts.at(-1)?.description || "",
    /즉시 등록·수정되는 것은 아닙니다/,
  );
  assert.equal(ui.field("storeName").props.value, "");
});

test("switching from a draft report to an inquiry does not submit hidden invalid report fields", async () => {
  const ui = loadPage();
  ui.change("evidenceUrl", "javascript:alert(1)");
  ui.change("observedDate", "9999-12-31");
  ui.change("type", "inquiry");
  assert.equal(
    elements(ui.render()).some(
      (element) => element.props.name === "refillScope",
    ),
    false,
  );
  ui.change("name", validReport.name);
  ui.change("email", validReport.email);
  ui.change("message", "문");
  await ui.submit();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].body.type, "inquiry");
  for (const name of [
    "reportKind",
    "refillScope",
    "evidenceUrl",
    "observedDate",
  ]) {
    assert.equal(name in ui.requests[0].body, false);
  }
});
