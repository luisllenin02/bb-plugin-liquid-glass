import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const palettes = ["liquid-glass.css", "liquid-glass-light.css"];

function compactMedia(css) {
  const start = css.indexOf("@media (max-width: 767px), (pointer: coarse)");
  assert.notEqual(start, -1, "compact media rule must exist");
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}" && --depth === 0) return css.slice(open + 1, index);
  }
  assert.fail("compact media rule must close");
}

for (const file of palettes) {
  test(`${file} keeps the mobile sidebar at its selected glass opacity`, async () => {
    const css = await readFile(new URL(`themes/${file}`, root), "utf8");
    const compact = compactMedia(css);
    const solidRule = compact.match(/([^{}]+)\{[^{}]*\/ 0\.96\);[^{}]*\}/);
    assert.ok(solidRule, "compact main/home rule must remain near-solid");
    assert.match(solidRule[1], /main\[data-sidebar="inset"\]/);
    assert.match(solidRule[1], /root-compose-compact-home/);
    assert.match(solidRule[1], /\[role="dialog"\]/);
    assert.doesNotMatch(solidRule[1], /\[data-app-composer\]/);
    assert.match(css, /\[data-app-composer\][\s\S]*var\(--lg-chrome-a, 0\.72\)/);
    assert.match(solidRule[1], /\[data-vaul-drawer-direction\]:not\(\[data-sidebar="panel"\]\)/);
    assert.doesNotMatch(solidRule[1], /\[data-sidebar="sidebar"\]/);
    assert.doesNotMatch(solidRule[1], /\[data-sidebar="panel"\]\[data-vaul-drawer-direction\]/);

    const sidebarRule = compact.match(/([^{}]*\[data-sidebar="sidebar"\][^{}]*)\{([^{}]+)\}/);
    assert.ok(sidebarRule, "compact sidebar glass rule must exist");
    assert.match(sidebarRule[1], /\[data-sidebar="sidebar"\]\[data-mobile="true"\]/);
    assert.match(sidebarRule[1], /\[data-sidebar="panel"\]\[data-vaul-drawer-direction\]/);
    assert.match(sidebarRule[2], /\/ var\(--lg-sidebar-a, 0\.85\)\)/);
    assert.match(sidebarRule[2], /blur\(var\(--lg-blur, 24px\)\) saturate\(1\.3\)/);
    assert.doesNotMatch(sidebarRule[2], /\/ (?:0\.9[6-9]|1(?:\.0+)?)\)/);
    assert.match(css, /\[data-vaul-drawer-direction\]:not\(\[data-sidebar="panel"\]\)/);

    for (const [, selector, declarations] of compact.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/\[data-sidebar="sidebar"\]|\[data-sidebar="panel"\]\[data-vaul-drawer-direction\]/.test(selector)) {
        assert.doesNotMatch(declarations, /\/ (?:0\.9[6-9]|1(?:\.0+)?)\)/);
        assert.match(declarations, /\/ var\(--lg-sidebar-a, 0\.85\)\)/);
      }
    }
  });
}
