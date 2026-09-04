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

const DOCK = '[data-testid="root-compose-compact-composer"]';

for (const file of palettes) {
  test(`${file} blends the phone new-thread dock instead of boxing it`, async () => {
    const css = await readFile(new URL(`themes/${file}`, root), "utf8");
    const compact = compactMedia(css);

    // The dock and the host's bg-background wrapper paint nothing themselves:
    // both used to end in a hard edge (blur box, hairline, pane rectangle).
    const clear = compact.match(/html \[data-testid="root-compose-compact-composer"\],\n\s*html \[data-testid="root-compose-compact-composer"\] > \.bg-background \{([^}]+)\}/);
    assert.ok(clear, "dock and wrapper share one clearing rule");
    for (const prop of ["background-color: transparent", "background-image: none", "backdrop-filter: none", "box-shadow: none"]) {
      assert.match(clear[1], new RegExp(`${prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} !important`));
    }

    // The glass lives on a pseudo element that starts above the dock and is
    // masked to nothing at its top, so tint and blur fade together.
    const blend = compact.match(/html \[data-testid="root-compose-compact-composer"\]::before \{([^}]+)\}/);
    assert.ok(blend, "dock ::before blend rule present");
    assert.match(blend[1], /top: calc\(-1 \* var\(--lg-home-fade, 56px\)\)/);
    assert.match(blend[1], /z-index: -1/);
    assert.match(blend[1], /backdrop-filter: blur\(var\(--lg-chrome-blur, 20px\)\)/);
    assert.doesNotMatch(blend[1], /saturate/, "no saturate: it shifts colour at the box edge");
    assert.match(blend[1], /mask-image: linear-gradient\(to bottom, hsl\(0 0% 0% \/ 0\) 0, hsl\(0 0% 0% \/ 1\) var\(--lg-home-fade, 56px\)\)/);
    assert.match(blend[1], /background-color: hsl\(var\(--glass-h\) var\(--glass-s\) var\(--glass-l\) \/ var\(--lg-home-dock-a, max\(var\(--lg-chrome-a, 0\.72\), var\(--glass-pane-a\)\)\)\)/);
    assert.doesNotMatch(blend[1], /box-shadow/);

    // The safe-area strip is painted from the un-clipped layout shell, only
    // while the home screen is mounted, sized to exactly the inset.
    const strip = compact.match(/html\[data-lg-home\] \[data-testid="app-layout-content-shell"\] \{([^}]+)\}/);
    assert.ok(strip, "home-scoped safe-area strip rule present");
    assert.match(strip[1], /background-position: bottom/);
    assert.match(strip[1], /background-size: 100% var\(--bb-safe-area-bottom, env\(safe-area-inset-bottom, 0px\)\)/);
    assert.match(strip[1], /var\(--lg-home-dock-a, max\(var\(--lg-chrome-a, 0\.72\), var\(--glass-pane-a\)\)\)/);

    // The list fades out before the host clips it, so no bright row ends in
    // a hard cut under the environment strip.
    const list = compact.match(/html \[data-testid="root-compose-compact-scroll-viewport"\] \{([^}]+)\}/);
    assert.ok(list, "scroll viewport fade rule present");
    assert.match(list[1], /mask-image: linear-gradient\(to bottom, hsl\(0 0% 0% \/ 1\) calc\(100% - var\(--lg-home-list-fade, 64px\)\), hsl\(0 0% 0% \/ 0\) 100%\)/);

    // Nothing inside the dock tries to reach the screen edge any more: the
    // host clips it there, which is what drew the old line.
    assert.doesNotMatch(compact, /root-compose-compact-composer"\] \{[^}]*bottom: calc\(-1/);

    // Reduced transparency turns the blend solid.
    assert.match(css, /prefers-reduced-transparency: reduce\) \{\n[^\n]*--lg-home-dock-a: 1;/);

    // The desktop chrome rule is untouched; the blend is phone-only.
    assert.equal(css.indexOf(`${DOCK}::before`), css.indexOf(`${DOCK}::before`, css.indexOf("@media (max-width: 767px)")));
  });
}
