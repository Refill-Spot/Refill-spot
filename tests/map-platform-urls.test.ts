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
} from "../lib/map-platform-urls";
import type { Store } from "../types/store";

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
    name: "네이버지도",
    origin: "https://map.naver.com",
    path: "/p/search/",
    generate: generateNaverMapUrl,
    mark: "N",
    background: "#087F3E",
    foreground: "text-white",
  },
  {
    key: "kakao",
    name: "카카오맵",
    origin: "https://map.kakao.com",
    path: "/link/search/",
    generate: generateKakaoMapUrl,
    mark: "카카오",
    background: "#FEE500",
    foreground: "text-[#191919]",
  },
] as const;

for (const provider of providers) {
  function searchTerm(value: Store): string {
    const url = new URL(provider.generate(value));
    assert.equal(url.origin, provider.origin);
    assert.ok(url.pathname.startsWith(provider.path));
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    const encodedTerm = url.pathname.slice(provider.path.length);
    assert.doesNotMatch(encodedTerm, /[/!?&#'"()*<>\s]/);
    return decodeURIComponent(encodedTerm);
  }

  test(`${provider.key} searches the trimmed name and address, not a presumed place`, () => {
    const value = store();
    assert.equal(searchTerm(value), "무한리필 강남점 서울 강남구 테헤란로 10");
    assert.equal(
      generateMapPlatformUrls(value)[provider.key],
      provider.generate(value),
    );
    assert.notEqual(
      provider.generate(value),
      provider.generate(store({ address: "부산 해운대구 센텀로 20" })),
    );
  });

  test(`${provider.key} encodes URL syntax and Unicode as a single search term`, () => {
    const value = store({
      name: `밥집 𠮷/분점?x=1&isCorrectAnswer=true#<script>"'!()*%`,
      address: "  서울 중구 /?redirect=https://example.com&한글=값#지점  ",
    });
    assert.equal(searchTerm(value), `${value.name} ${value.address.trim()}`);
    assert.match(provider.generate(value), /%F0%A0%AE%B7/);
    assert.match(provider.generate(value), /%22%27%21%28%29%2A%25/);
    assert.doesNotMatch(provider.generate(value), /[?&]isCorrectAnswer=/);
  });

  test(`${provider.key} omits empty search parts without adding spaces or undefined`, () => {
    assert.equal(searchTerm(store({ address: " \t\n " })), "무한리필 강남점");
    assert.equal(
      searchTerm(store({ name: " \t " })),
      "서울 강남구 테헤란로 10",
    );
    assert.equal(searchTerm(store({ name: "", address: "" })), "");
  });
}

type Element = { type: unknown; props: Record<string, any> };
type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  platform: "naver" | "kakao";
};

// Inspect the production JSX tree without a browser, portal, or external request.
const dialogExports = {} as {
  PlatformViewDialog: (props: DialogProps) => Element;
};
const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
const dialogSource = readFileSync(
  "components/platform-view-dialog.tsx",
  "utf8",
);
runInNewContext(
  ts.transpileModule(dialogSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  {
    exports: dialogExports,
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/components/ui/button") return { Button: "Button" };
      if (name === "@/components/ui/dialog")
        return Object.fromEntries(
          [
            "Dialog",
            "DialogContent",
            "DialogDescription",
            "DialogHeader",
            "DialogTitle",
          ].map((key) => [key, key]),
        );
      if (name === "@/lib/map-platform-urls")
        return { generateNaverMapUrl, generateKakaoMapUrl };
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

for (const provider of providers) {
  test(`${provider.key} dialog links to search results with explicit identity and rating limitations`, () => {
    const changes: boolean[] = [];
    const value = store();
    const onOpenChange = (open: boolean) => changes.push(open);
    const tree = dialogExports.PlatformViewDialog({
      open: true,
      onOpenChange,
      store: value,
      platform: provider.key,
    });
    const { elements, text } = inspect(tree);
    assert.equal(tree.type, "Dialog");
    assert.equal(tree.props.open, true);
    assert.equal(tree.props.onOpenChange, onOpenChange);
    assert.ok(text.includes(value.name.trim()));
    assert.ok(text.includes(value.address.trim()));
    assert.match(text, /외부 사이트에서 직접 확인/);
    assert.match(text, /이 가게로 확인된 상세 페이지가 아닙니다/);
    assert.match(text, /주소와 지점명을 비교해 같은 가게인지 확인/);
    assert.match(text, /외부 평점은 자동으로 가져오거나 표시하지 않습니다/);
    assert.ok(text.includes(`제공 여부는 ${provider.name}에서 직접 확인`));
    assert.doesNotMatch(text, /4\.8|3\.2|저장된 평점 검증 필요|로딩 중/);
    assert.equal(
      elements.some((element) => element.type === "iframe"),
      false,
    );
    assert.doesNotMatch(
      dialogSource,
      /iframe|Loader2|window\.open|useState|95vh/,
    );
    assert.ok(elements.some((element) => element.type === "DialogDescription"));

    const links = elements.filter((element) => element.type === "a");
    assert.equal(links.length, 1);
    assert.equal(links[0].props.href, provider.generate(value));
    assert.equal(links[0].props.target, "_blank");
    assert.equal(links[0].props.rel, "noopener noreferrer");
    assert.equal(
      inspect(links[0]).text,
      `${provider.name} 검색 결과 열기 (새 탭)`,
    );

    const linkButton = elements.find(
      (element) => element.type === "Button" && element.props.asChild,
    );
    assert.ok(linkButton);
    assert.ok(
      linkButton.props.className.includes(`bg-[${provider.background}]`),
    );
    assert.ok(linkButton.props.className.includes(provider.foreground));
    const mark = elements.find(
      (element) =>
        element.type === "span" && element.props.children === provider.mark,
    );
    assert.ok(mark);
    assert.equal(mark.props["aria-hidden"], "true");
    assert.ok(mark.props.className.includes(`bg-[${provider.background}]`));
    assert.ok(mark.props.className.includes(provider.foreground));
    if (provider.key === "kakao") {
      assert.doesNotMatch(linkButton.props.className, /text-white/);
      assert.doesNotMatch(mark.props.className, /text-white/);
    }

    const close = elements.find(
      (element) =>
        element.type === "Button" && element.props.children === "닫기",
    );
    assert.ok(close);
    close.props.onClick();
    assert.deepEqual(changes, [false]);
  });
}

test("missing address is disclosed rather than claiming a matched location", () => {
  const { text } = inspect(
    dialogExports.PlatformViewDialog({
      open: true,
      onOpenChange: () => {},
      store: store({ address: "   " }),
      platform: "naver",
    }),
  );
  assert.match(text, /주소 정보 없음/);
  assert.match(text, /주소와 지점명을 비교/);
});
