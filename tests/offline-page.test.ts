import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("offline screen offers retry without claiming private data is cached", () => {
  type Element = { type: unknown; props: Record<string, any> };
  const exports: Record<string, () => Element> = {};
  let reloads = 0;
  const destinations: string[] = [];
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const source = ts.transpileModule(
    readFileSync("app/offline/page.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    window: { location: { reload: () => reloads++ } },
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "next/navigation")
        return {
          useRouter: () => ({
            push: (path: string) => destinations.push(path),
          }),
        };
      if (name === "@/components/ui/button") return { Button: "button" };
      if (name === "@/components/ui/card")
        return Object.fromEntries(
          [
            "Card",
            "CardContent",
            "CardDescription",
            "CardHeader",
            "CardTitle",
          ].map((key) => [key, key]),
        );
      if (name === "lucide-react")
        return { WifiOff: "icon", RefreshCw: "icon" };
      throw Error(`Unexpected dependency ${name}`);
    },
  });
  const buttons: Element[] = [];
  const texts: string[] = [];
  function visit(node: unknown) {
    if (typeof node === "string") texts.push(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object" && "props" in node) {
      const element = node as Element;
      if (element.type === "button") buttons.push(element);
      visit(element.props.children);
    }
  }
  visit(exports.default());
  assert.match(texts.join(""), /사용자 데이터는 오프라인에 저장하지 않습니다/);
  assert.equal(buttons.length, 2);
  buttons[0].props.onClick();
  assert.equal(reloads, 1);
  buttons[1].props.onClick();
  assert.deepEqual(destinations, ["/"]);
});
