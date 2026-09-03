import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const file of ["themes/liquid-glass.css", "themes/liquid-glass-light.css"]) {
  test(`${file} chrome tint fades to transparent, not to the pane alpha`, () => {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const gradients = css.match(/linear-gradient\(to (?:top|bottom), hsl\([^)]*\/ var\(--lg-chrome-a, 0\.72\)\) 0, hsl\([^)]*\/ ([^)]*)\) var\(--lg-chrome-fade, 40px\)\)/g) ?? [];
    assert.equal(gradients.length, 2, "header and dock gradients present");
    for (const gradient of gradients) {
      assert.match(gradient, /\/ 0\) var\(--lg-chrome-fade/, "end stop is fully transparent");
      assert.doesNotMatch(gradient, /--glass-pane-a/, "end stop must not stack the pane alpha");
    }
  });
}

test("the chrome opacity dial reaches fully transparent", async () => {
  const src = readFileSync(new URL("../src/appearance.ts", import.meta.url), "utf8");
  assert.match(src, /chromeOpacity: \{ min: 0, max: 1, step: 0\.01 \}/);
});
