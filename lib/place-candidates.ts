import { z } from "zod";
import type { PlaceCandidate, StoreIdentity } from "./place-matching";

const positiveId = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .refine((id) => id.trim() === id);
const storeId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const text = z.string().trim().min(1);
const storeSchema = z.object({
  id: storeId,
  name: text,
  address: text,
  phoneNumber: z.string().nullable(),
  // Invalid numeric coordinates omit the geographic bias, rather than becoming 0.
  position: z.object({
    lat: z.custom<number>((value) => typeof value === "number"),
    lng: z.custom<number>((value) => typeof value === "number"),
  }),
});
const storesSchema = z
  .array(storeSchema)
  .max(5)
  .refine(
    (stores) => new Set(stores.map((store) => store.id)).size === stores.length,
  );
const apiKeySchema = z.string().trim().min(1).max(512).regex(/^\S+$/);

function coordinateSchema(limit: number) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) &&
          Number.isFinite(Number(value)) &&
          Math.abs(Number(value)) <= limit),
    )
    .transform((value) => (value === "" ? null : Number(value)));
}

const kakaoResponseSchema = z.object({
  documents: z
    .array(
      z.object({
        id: positiveId,
        place_name: text,
        road_address_name: z.string(),
        address_name: z.string(),
        phone: z.string(),
        x: coordinateSchema(180),
        y: coordinateSchema(90),
      }),
    )
    .max(15),
});

function searchQuery(store: Pick<StoreIdentity, "name" | "address">): string {
  return `${store.address.trim().split(/\s+/).slice(0, 2).join(" ")} ${store.name.trim()}`;
}

function combineAddresses(road: string, address: string): string {
  return [
    ...new Set(
      [road, address]
        .map((value) => value.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ].join(" ");
}

export async function fetchKakaoCandidates(
  store: StoreIdentity,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaceCandidate[]> {
  const parsedStore = storeSchema.safeParse(store);
  if (!parsedStore.success) throw new Error("INVALID_STORE_INPUT");
  const parsedKey = apiKeySchema.safeParse(apiKey);
  if (!parsedKey.success) throw new Error("INVALID_KAKAO_API_KEY");

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", searchQuery(parsedStore.data));
  url.searchParams.set("size", "15");
  const { lat, lng } = parsedStore.data.position;
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("radius", "2000");
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("KAKAO_TIMEOUT"));
    }, 15_000);
  });
  try {
    return await Promise.race([
      (async () => {
        let response: Response;
        try {
          response = await fetchImpl(url.toString(), {
            headers: { Authorization: `KakaoAK ${parsedKey.data}` },
            signal: controller.signal,
          });
        } catch {
          throw new Error(
            controller.signal.aborted
              ? "KAKAO_TIMEOUT"
              : "KAKAO_REQUEST_FAILED",
          );
        }
        if (!response.ok) throw new Error("KAKAO_HTTP_ERROR");
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error("KAKAO_INVALID_RESPONSE");
        }
        const parsed = kakaoResponseSchema.safeParse(body);
        if (!parsed.success) throw new Error("KAKAO_INVALID_RESPONSE");
        return parsed.data.documents.map((document) => {
          const address = combineAddresses(
            document.road_address_name,
            document.address_name,
          );
          if (!address) throw new Error("KAKAO_INVALID_RESPONSE");
          return {
            id: document.id,
            name: document.place_name,
            address,
            phoneNumber: document.phone.trim() || null,
            lat: document.y,
            lng: document.x,
            url: `https://place.map.kakao.com/${document.id}`,
          };
        });
      })(),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const naverErrorSchema = z.enum([
  "NAVER_BROWSER_UNAVAILABLE",
  "NAVER_UNEXPECTED_PAGE",
  "NAVER_BLOCKED",
  "NAVER_TIMEOUT",
  "NAVER_INVALID_RESULT",
  "NAVER_LOOKUP_FAILED",
]);
const naverCandidateSchema = z
  .object({
    id: positiveId,
    name: text.max(1_000),
    address: text.max(5_000),
    phoneNumber: z.string().trim().min(1).max(100).nullable(),
    lat: z.number().finite().min(-90).max(90).nullable(),
    lng: z.number().finite().min(-180).max(180).nullable(),
    url: z.string(),
  })
  .strict()
  .refine(
    (candidate) =>
      candidate.url === `https://m.place.naver.com/place/${candidate.id}/home`,
  );
const naverResultsSchema = z
  .array(
    z
      .object({
        storeId,
        candidates: z
          .array(naverCandidateSchema)
          .max(100)
          .refine(
            (candidates) =>
              new Set(candidates.map((candidate) => candidate.id)).size ===
              candidates.length,
          ),
        error: naverErrorSchema.optional(),
      })
      .strict()
      .refine((result) => !result.error || result.candidates.length === 0),
  )
  .max(5)
  .refine(
    (results) =>
      new Set(results.map((result) => result.storeId)).size === results.length,
  );

export function createNaverLookupCode(stores: StoreIdentity[]): string {
  const parsed = storesSchema.safeParse(stores);
  if (!parsed.success) throw new Error("INVALID_STORE_INPUT");
  const requests = parsed.data.map((store) => ({
    storeId: store.id,
    query: searchQuery(store),
  }));
  return String.raw`await (async () => {
  const requests = ${JSON.stringify(requests)};
  const results = [];
  let page;
  try {
    await listBrowserTabs();
    if (requests.length) page = await openTab("https://m.map.naver.com/search?query=" + encodeURIComponent(requests[0].query));
    for (const [index, request] of requests.entries()) {
      try {
        const target = "https://m.map.naver.com/search?query=" + encodeURIComponent(request.query);
        if (index > 0) await page.goto(target, { waitUntil: "domcontentloaded", timeout: 15000 });
        const current = new URL(page.url());
        const title = await page.title();
        if (current.origin !== "https://m.map.naver.com" ||
            !/^\/search\/?$/.test(current.pathname) ||
            current.searchParams.get("query") !== request.query ||
            typeof title !== "string" || !title.trim()) {
          throw new Error("NAVER_UNEXPECTED_PAGE");
        }
        await snapshot(page, { interactive: true });
        const deadline = Date.now() + 15000;
        let complete = false;
        do {
          const state = await page.evaluate(() => {
            const visible = (element) => !!element && element.getClientRects().length > 0 &&
              getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden";
            const bodyText = document.body ? document.body.innerText : "";
            const blocked = /captcha|access denied|forbidden|too many requests|비정상적인 접근|자동입력 방지|접근이 (?:제한|차단)|보안 확인|로봇이 아닙니다/i.test(document.title + "\n" + bodyText);
            const empty = bodyText.split(/\r?\n/).some((line) => /^(?:검색\s*결과가\s*없습니다|검색\s*결과가\s*없어요|검색\s*결과\s*없음|검색하신\s*장소를\s*찾을\s*수\s*없습니다)[.!]?$/.test(line.trim()));
            const candidates = [];
            const seen = new Set();
            let malformed = false;
            for (const anchor of document.querySelectorAll("a[href]")) {
              const match = /^https:\/\/m\.place\.naver\.com\/place\/([1-9][0-9]*)\/home$/.exec(anchor.getAttribute("href") || "");
              if (!match || !visible(anchor)) continue;
              const item = anchor.closest("li");
              if (!item || !visible(item)) { malformed = true; continue; }
              const strong = item.querySelector("strong");
              const name = strong && visible(strong) ? strong.textContent.trim().replace(/\s+/g, " ") : "";
              const share = item.querySelector("button[data-kakaotalk-title]");
              const lines = share ? (share.getAttribute("data-kakaotalk-title") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
              const sharePhone = lines.length > 1 && /^\+?[0-9][0-9\s().-]*$/.test(lines[1]) ? lines[1] : null;
              const tel = item.querySelector('a[href^="tel:"]');
              let phoneNumber = sharePhone;
              if (!phoneNumber && tel) {
                try { phoneNumber = decodeURIComponent((tel.getAttribute("href") || "").slice(4).split("?")[0]).trim() || null; }
                catch { malformed = true; }
              }
              let address = lines.slice(sharePhone ? 2 : 1).join(" ");
              if (!address) {
                const button = Array.from(item.querySelectorAll("button")).find((element) => visible(element) && /^주소보기/.test(element.innerText.trim()));
                address = button ? button.innerText.trim().replace(/^주소보기\s*[:：]?\s*/, "").replace(/\s+/g, " ") : "";
              }
              if (!name || !address) { malformed = true; continue; }
              if (!seen.has(match[1])) {
                seen.add(match[1]);
                candidates.push({ id: match[1], name, address, phoneNumber, lat: null, lng: null,
                  url: "https://m.place.naver.com/place/" + match[1] + "/home" });
              }
              if (candidates.length > 100) { malformed = true; break; }
            }
            return { candidates, blocked, empty, malformed };
          });
          if (state.blocked) throw new Error("NAVER_BLOCKED");
          if (state.malformed) throw new Error("NAVER_INVALID_RESULT");
          if (state.candidates.length) {
            results.push({ storeId: request.storeId, candidates: state.candidates });
            complete = true;
            break;
          }
          if (state.empty) {
            results.push({ storeId: request.storeId, candidates: [] });
            complete = true;
            break;
          }
          const remaining = deadline - Date.now();
          if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(500, remaining)));
        } while (Date.now() < deadline);
        if (!complete) throw new Error("NAVER_TIMEOUT");
      } catch (error) {
        const code = error instanceof Error && ["NAVER_UNEXPECTED_PAGE", "NAVER_BLOCKED", "NAVER_TIMEOUT", "NAVER_INVALID_RESULT"].includes(error.message)
          ? error.message : "NAVER_LOOKUP_FAILED";
        results.push({ storeId: request.storeId, candidates: [], error: code });
      }
    }
  } catch {
    for (const request of requests.slice(results.length)) {
      results.push({ storeId: request.storeId, candidates: [], error: "NAVER_BROWSER_UNAVAILABLE" });
    }
  } finally {
    if (page && typeof page.close === "function") {
      try { await page.close(); } catch {}
    }
  }
  console.log("PLACE_CANDIDATES_JSON:" + JSON.stringify(results));
})()`;
}

export function parseNaverLookupOutput(
  stdout: string,
): Array<{ storeId: number; candidates: PlaceCandidate[]; error?: string }> {
  if (typeof stdout !== "string" || stdout.length > 2_000_000) {
    throw new Error("INVALID_NAVER_OUTPUT");
  }
  const marker = "PLACE_CANDIDATES_JSON:";
  const markerIndex = stdout.indexOf(marker);
  if (
    markerIndex < 0 ||
    stdout.indexOf(marker, markerIndex + marker.length) >= 0
  ) {
    throw new Error("INVALID_NAVER_OUTPUT");
  }
  const output = stdout.slice(markerIndex + marker.length).trimStart();
  if (!output.startsWith("[")) throw new Error("INVALID_NAVER_OUTPUT");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let end = -1;
  for (let index = 0; index < output.length; index++) {
    const character = output[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
    } else if (character === "[" || character === "{") {
      depth++;
    } else if (character === "]" || character === "}") {
      depth--;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("INVALID_NAVER_OUTPUT");
  let value: unknown;
  try {
    value = JSON.parse(output.slice(0, end));
  } catch {
    throw new Error("INVALID_NAVER_OUTPUT");
  }
  const parsed = naverResultsSchema.safeParse(value);
  if (!parsed.success) throw new Error("INVALID_NAVER_OUTPUT");
  return parsed.data;
}
