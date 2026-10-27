import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { mapStoredExternalRatings } from "../lib/external-ratings";
import {
  generateKakaoMapUrl,
  generateMapPlatformUrls,
  generateNaverMapUrl,
  hasVerifiedPlaceId,
} from "../lib/map-platform-urls";
import type { Store, StoreFromDb } from "../types/store";

function store(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    name: "  무한리필 강남점  ",
    address: "  서울 강남구 테헤란로 10  ",
    categories: [],
    rating: mapStoredExternalRatings({ naver_rating: 4.8, kakao_rating: 3.2 }),
    position: { lat: 37.5, lng: 127, x: 127, y: 37.5 },
    refillItems: null,
    openHours: null,
    phoneNumber: null,
    ...overrides,
  };
}

const providers = [
  {
    key: "naver",
    field: "naverPlaceId",
    label: "네이버",
    generate: generateNaverMapUrl,
  },
  {
    key: "kakao",
    field: "kakaoPlaceId",
    label: "카카오맵",
    generate: generateKakaoMapUrl,
  },
] as const;

for (const provider of providers) {
  function searchTerm(value: Store): string {
    const url = new URL(provider.generate(value));
    assert.equal(url.hash, "");
    if (provider.key === "kakao") {
      assert.equal(url.origin, "https://m.map.kakao.com");
      assert.equal(url.pathname, "/actions/searchView");
      assert.deepEqual([...url.searchParams.keys()], ["q"]);
      return url.searchParams.get("q")!;
    }
    assert.equal(url.origin, "https://m.map.naver.com");
    assert.equal(url.pathname, "/search");
    assert.deepEqual([...url.searchParams.keys()], ["query"]);
    return url.searchParams.get("query")!;
  }

  test(`${provider.key} searches with region and name, omitting street and building`, () => {
    const value = store();
    assert.equal(searchTerm(value), "서울 강남구 무한리필 강남점");
    assert.equal(
      generateMapPlatformUrls(value)[provider.key],
      provider.generate(value),
    );
    assert.equal(
      searchTerm(store({ address: "부산 해운대구 센텀로 20" })),
      "부산 해운대구 무한리필 강남점",
    );
  });

  test(`${provider.key} safely encodes query syntax and Unicode`, () => {
    const name = `밥집 𠮷/분점?x=1&isCorrectAnswer=true#<script>"'!()*%`;
    assert.equal(searchTerm(store({ name })), `서울 강남구 ${name}`);
    assert.doesNotMatch(
      provider.generate(store({ name })),
      /[?&]isCorrectAnswer=/,
    );
    assert.match(provider.generate(store({ name })), /%F0%A0%AE%B7/);
  });

  test(`${provider.key} handles missing search parts`, () => {
    assert.equal(searchTerm(store({ address: " \t\n " })), "무한리필 강남점");
    assert.equal(
      searchTerm(store({ name: " \t " })),
      "서울 강남구 테헤란로 10",
    );
    assert.equal(searchTerm(store({ name: "", address: "" })), "");
  });

  test(`${provider.key} uses only validated numeric place IDs for detail links`, () => {
    const value = store({ [provider.field]: "17287242" });
    assert.equal(
      provider.generate(value),
      provider.key === "kakao"
        ? "https://place.map.kakao.com/17287242"
        : "https://m.place.naver.com/place/17287242/home",
    );
    for (const id of [
      null,
      undefined,
      "",
      "0",
      "0123",
      "-1",
      "12.3",
      " 123 ",
      "123/evil",
      "https://evil.test",
      "123?redirect=evil",
      "123\n",
    ]) {
      assert.equal(hasVerifiedPlaceId(id), false);
      assert.equal(
        searchTerm(store({ [provider.field]: id })),
        "서울 강남구 무한리필 강남점",
      );
    }
  });
}

type Element = { type: unknown; props: Record<string, any> };
const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
const componentExports = {} as {
  PlatformLinks: (props: { store: Store }) => Element;
};
const source = readFileSync("components/platform-links.tsx", "utf8");
runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  {
    exports: componentExports,
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/components/ui/button") return { Button: "Button" };
      if (name === "@/lib/map-platform-urls")
        return { generateNaverMapUrl, generateKakaoMapUrl, hasVerifiedPlaceId };
      if (name === "lucide-react")
        return { ExternalLink: "ExternalLink", MapPin: "MapPin" };
      throw Error(`Unexpected dependency ${name}`);
    },
  },
);
function inspect(root: Element) {
  const elements: Element[] = [];
  const texts: string[] = [];
  function visit(node: unknown) {
    if (typeof node === "string") texts.push(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object" && "props" in node) {
      const element = node as Element;
      elements.push(element);
      visit(element.props.children);
    }
  }
  visit(root);
  return { elements, text: texts.join("") };
}

for (const ids of [
  {},
  { naverPlaceId: "123" },
  { kakaoPlaceId: "456" },
  { naverPlaceId: "123", kakaoPlaceId: "456" },
  { naverPlaceId: "invalid", kakaoPlaceId: "-1" },
]) {
  test(`direct links distinguish verified detail and unverified search: ${JSON.stringify(ids)}`, () => {
    const value = store(ids);
    const { elements, text } = inspect(
      componentExports.PlatformLinks({ store: value }),
    );
    const links = elements.filter((e) => e.type === "a");
    assert.equal(links.length, 2);
    providers.forEach((provider, index) => {
      assert.equal(links[index].props.href, provider.generate(value));
      assert.equal(links[index].props.target, "_blank");
      assert.equal(links[index].props.rel, "noopener noreferrer");
      assert.ok(
        inspect(links[index]).text.includes(
          `${provider.label}에서 ${hasVerifiedPlaceId(value[provider.field]) ? "리뷰 확인" : "검색"}`,
        ),
      );
      assert.match(inspect(links[index]).text, /새 탭에서 열림/);
      assert.equal(links[index].props.onClick, undefined);
    });
    const allVerified =
      hasVerifiedPlaceId(value.naverPlaceId) &&
      hasVerifiedPlaceId(value.kakaoPlaceId);
    assert.equal(text.includes("주소와 지점명을"), !allVerified);
    assert.match(text, /외부 평점과 리뷰의 제공 여부는 각 플랫폼에 따라/);
    assert.doesNotMatch(text, /4\.8|3\.2/);
    assert.ok(
      !elements.some((e) => e.type === "iframe" || e.type === "Dialog"),
    );
  });
}

test("both detail surfaces use shared direct links without obsolete modal state", () => {
  for (const path of [
    "components/store-details.tsx",
    "app/store/[id]/page.tsx",
  ]) {
    const content = readFileSync(path, "utf8");
    assert.match(content, /<PlatformLinks store=/);
    assert.doesNotMatch(
      content,
      /PlatformViewDialog|setExternalPlatform|setShowNaverPlatform|setShowKakaoPlatform/,
    );
  }
});

test("database place IDs survive store mapping into direct link destinations", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  const { mapStoreFromDb } = await import("../lib/stores");
  const row: StoreFromDb = {
    id: 1851,
    name: "채선당올림픽공원점",
    address: "서울특별시 강동구 강동대로 성내동",
    naver_rating: null,
    kakao_rating: null,
    naver_place_id: "12862730",
    kakao_place_id: "17287242",
    position_lat: 37.5272419,
    position_lng: 127.1217769,
    position_x: 127.1217769,
    position_y: 37.5272419,
    categories: [],
    refill_items: null,
    open_hours: null,
    phone_number: "02-484-4759",
    break_time: null,
    created_at: "",
    updated_at: "",
  };
  const mapped = mapStoreFromDb(row);
  assert.equal(mapped.naverPlaceId, row.naver_place_id);
  assert.equal(mapped.kakaoPlaceId, row.kakao_place_id);
  assert.deepEqual(generateMapPlatformUrls(mapped), {
    naver: "https://m.place.naver.com/place/12862730/home",
    kakao: "https://place.map.kakao.com/17287242",
  });
  const unlinked = mapStoreFromDb({
    ...row,
    naver_place_id: undefined,
    kakao_place_id: null,
  });
  assert.equal(unlinked.naverPlaceId, null);
  assert.equal(unlinked.kakaoPlaceId, null);
  assert.equal(
    new URL(generateKakaoMapUrl(unlinked)).searchParams.get("q"),
    "서울특별시 강동구 채선당올림픽공원점",
  );
});
