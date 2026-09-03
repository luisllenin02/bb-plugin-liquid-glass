import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const palettes = ["themes/liquid-glass.css", "themes/liquid-glass-light.css"];

for (const file of palettes) {
  test(`${file} hides the closed mobile sidebar panel behind the pane glass`, () => {
    const css = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const start = css.indexOf("@media (max-width: 767px), (pointer: coarse) {");
    assert.ok(start >= 0, "compact media block present");
    const compact = css.slice(start);
    assert.match(
      compact,
      /\[data-sidebar="panel"\]\[data-state="closed"\]:not\(\[data-vaul-animate="false"\]\)\s*\{[^}]*visibility:\s*hidden/,
      "closed, not-swiping panel is hidden",
    );
    assert.match(
      compact,
      /\[data-sidebar="panel"\]\[data-state="open"\],\s*\[data-sidebar="panel"\]\[data-vaul-animate="false"\]\s*\{[^}]*visibility:\s*visible/,
      "open or swiping panel stays visible",
    );
    // A swipe must never be blanked: the hidden rule is scoped by :not().
    assert.doesNotMatch(compact, /\[data-sidebar="panel"\]\[data-state="closed"\]\s*\{/);
  });
}
