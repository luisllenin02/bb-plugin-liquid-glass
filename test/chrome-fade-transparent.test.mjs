import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const file of ["themes/liquid-glass.css", "themes/liquid-glass-light.css"]) {
  test(`${file} chrome tint fades to transparent, not to the pane alpha`, () => {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    // Tint gradients only: the phone new-thread blend masks its backdrop with
    // a gradient too, and a mask has no tint stop to check.
    const lines = css.split("\n").filter((line) => /linear-gradient\(to (?:top|bottom),/.test(line) && !/mask-image/.test(line));
    assert.equal(lines.length, 2, "header and dock gradients present");
    for (const line of lines) {
      assert.match(line, /var\(--lg-chrome-a, 0\.72\)\) 0, hsl\(var\(--glass-h\) var\(--glass-s\) var\(--glass-l\) \/ 0\) var\(--lg-chrome-fade, 40px\)\)/, "end stop is fully transparent");
      assert.doesNotMatch(line, /--glass-pane-a/, "end stop must not stack the pane alpha");
    }
  });
}

test("the chrome opacity dial reaches fully transparent", async () => {
  const src = readFileSync(new URL("../src/appearance.ts", import.meta.url), "utf8");
  assert.match(src, /chromeOpacity: \{ min: 0, max: 1, step: 0\.01 \}/);
});
