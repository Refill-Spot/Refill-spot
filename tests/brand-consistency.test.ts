import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const brandSurfaces = [
  "app/announcements/page.tsx",
  "app/login/page.tsx",
  "app/api/og/route.tsx",
];

for (const path of brandSurfaces) {
  test(`${path} uses the shared brand mark instead of a local SVG`, () => {
    const source = readFileSync(path, "utf8");

    assert.match(
      source,
      /import \{ BrandMark \} from "@\/components\/brand-mark"/,
    );
    assert.match(source, /<BrandMark\s/);
    assert.doesNotMatch(source, /<svg\b|<path\b|M4 4v5h/);
  });
}

test("login and OG logo labels use the same display name as the header", () => {
  for (const path of ["app/login/page.tsx", "app/api/og/route.tsx"]) {
    const source = readFileSync(path, "utf8");

    assert.match(source, />\s*Refill Spot\s*<\//);
    assert.doesNotMatch(source, /Refill-spot/);
  }
});

test("the shared OG brand mark renders as a PNG without browser APIs", async () => {
  const exports: Record<string, (props: { size: number }) => ReactElement> = {};
  const compiled = ts.transpileModule(
    readFileSync("components/brand-mark.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  runInNewContext(compiled.outputText, {
    exports,
    require(name: string) {
      if (name === "react/jsx-runtime") return jsxRuntime;
      throw Error(`Unexpected dependency ${name}`);
    },
  });
  const response = new ImageResponse(
    createElement(exports.BrandMark, { size: 48 }),
    {
      width: 48,
      height: 48,
    },
  );
  const png = Buffer.from(await response.arrayBuffer());

  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(
    png.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  assert.equal(png.readUInt32BE(16), 48);
  assert.equal(png.readUInt32BE(20), 48);
});
