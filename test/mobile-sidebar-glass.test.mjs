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
  test(`${file} makes the phone sidebar, side panel, and new-thread prompt box solid sheets`, async () => {
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

    // On a phone the sidebar and side panel are sheets over the thread: solid,
    // unblurred, and above the pane, so nothing reads through them.
    const sheetRule = compact.match(/([^{}]*\[data-sidebar="panel"\]\[data-vaul-drawer-direction\][^{}]*)\{([^{}]+)\}/);
    assert.ok(sheetRule, "compact sheet rule must exist");
    assert.match(sheetRule[1], /\[data-secondary-panel-shelf\]/);
    assert.match(sheetRule[2], /\/ max\(var\(--lg-sidebar-a, 0\.85\), 0\.82\)\)/, "tint floor so a glassy desktop setting cannot leave the thread legible");
    assert.match(sheetRule[2], /blur\(max\(var\(--lg-blur, 24px\), 20px\)\) saturate\(1\.3\)/, "blur floor: the sheet is frosted, not clear and not black");
    const innerRule = compact.match(/([^{}]*\[data-sidebar="sidebar"\]\[data-mobile="true"\][^{}]*)\{([^{}]+)\}/);
    assert.ok(innerRule, "inner sidebar surfaces must be cleared so tints do not stack");
    assert.match(innerRule[2], /background-color: transparent/);
    assert.match(
      compact,
      /html \[data-sidebar="panel"\]\[data-state="open"\],\s*html \[data-secondary-panel-shelf\]\[data-state="shelf"\] \{\s*z-index: 40 !important;/,
      "open sidebar and side panel must sit above the pane",
    );
    assert.match(
      compact,
      /html \[data-secondary-panel-shelf\]\[data-state="closed"\] \{\s*visibility: hidden;\s*transition: visibility 0s;/,
      "the closed side panel must hide at once",
    );
    assert.match(
      compact,
      /html \[data-testid="root-compose-compact-composer"\],\s*html \[data-root-compose-mobile-recents\] \.sticky \{\s*background-color: hsl\(var\(--glass-h\) var\(--glass-s\) var\(--glass-l\) \/ 0\.82\) !important;\s*background-image: none !important;\s*-webkit-backdrop-filter: blur\(20px\)/,
      "the new-thread dock and Recent heading must be frosted on a phone",
    );
    assert.match(css, /\[data-vaul-drawer-direction\]:not\(\[data-sidebar="panel"\]\)/);
    assert.match(
      compact,
      /body::before \{\s*background-size: 100% 100%;\s*background-attachment: scroll;/,
      "on a phone the wallpaper is stretched to the screen so a landscape image keeps its colour field",
    );
  });
}
