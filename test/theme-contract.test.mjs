import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

const palettes = {
  dark: await readFile(new URL("themes/liquid-glass.css", root), "utf8"),
  light: await readFile(new URL("themes/liquid-glass-light.css", root), "utf8"),
};

import { ACCENT_SWATCHES, DEFAULT_APPEARANCE, resolveVars } from "../src/appearance.ts";
import { contrastRatio, hex, hslToRgb } from "./color.mjs";
import {
  CUSTOM_ACCENT_BOUNDARIES,
  LG_KNOBS,
  REQUIRED_TOKENS,
  TEXT_TOKENS,
  percent,
} from "./theme-contract-fixtures.mjs";

import {
  colorOf,
  declarations,
  glassBackdrop,
  knobDefault,
  resolve,
  tintLayers,
  wallpaperTransmission,
} from "./css.mjs";

test("manifest contributes both Liquid Glass palettes plus a server and an app", () => {
  assert.equal(manifest.name, "bb-plugin-liquid-glass");
  assert.equal(manifest.bb.server, "./server.ts");
  assert.equal(manifest.bb.app, "./app.tsx");
  assert.deepEqual(manifest.bb.skills, []);
  assert.deepEqual(
    manifest.bb.themes.map((theme) => theme.id),
    ["liquid-glass", "liquid-glass-light"],
  );
  for (const theme of manifest.bb.themes) {
    assert.ok(theme.name && theme.description);
    assert.match(theme.css, /^\.\/themes\/.+\.css$/);
    assert.match(theme.codeTheme.dark, /^\.\/themes\/.+\.json$/);
    assert.match(theme.codeTheme.light, /^\.\/themes\/.+\.json$/);
  }
  assert.equal(manifest.engines.bb, ">=0.41");
  assert.equal(manifest.engines.bbPluginSdk, ">=0.4.8");
  assert.equal(manifest.version, "0.5.19");
  assert.ok(manifest.dependencies.zod, "zod must be a runtime dependency");
  for (const dependency of ["clsx", "tailwind-merge"]) {
    assert.ok(
      manifest.dependencies[dependency] || manifest.devDependencies[dependency],
      `${dependency} must be declared (host-provided; dev pin is fine)`,
    );
  }
  assert.match(manifest.scripts.test, /node --test test\/\*\.test\.mjs && vitest run/);
});

test("every declared asset exists and the icon is inert", async () => {
  const declared = [
    manifest.bb.branding.icon,
    manifest.bb.server,
    manifest.bb.app,
    ...manifest.bb.themes.flatMap((theme) => [
      theme.css,
      theme.codeTheme.dark,
      theme.codeTheme.light,
    ]),
  ];
  await Promise.all(
    declared.map((path) => access(new URL(path.replace(/^\.\//, ""), root))),
  );

  const icon = await readFile(new URL("assets/icon.svg", root), "utf8");
  assert.match(icon, /^<svg[\s\S]*<\/svg>\s*$/);
  assert.doesNotMatch(icon, /<script|<style|\bon\w+=|javascript:|<[?!]/i);
});

for (const [mode, css] of Object.entries(palettes)) {
  const decls = declarations(css);

  test(`${mode} palette declares the full token contract`, () => {
    assert.match(css, new RegExp(`color-scheme: ${mode};`));
    for (const token of REQUIRED_TOKENS) {
      assert.ok(decls.has(token), `${token} must be declared`);
    }
    assert.doesNotMatch(css, /@theme|@apply|@tailwind|<script/);
    assert.doesNotMatch(css, /font-family/);
  });

  test(`${mode} palette parameterises every --lg-* knob with a fallback`, () => {
    for (const knob of LG_KNOBS) {
      assert.ok(
        css.includes(`var(${knob},`),
        `${knob} must be referenced with a fallback`,
      );
    }
    for (const [, reference] of css.matchAll(/var\(\s*(--lg-[\w-]+)\s*\)/g)) {
      assert.fail(`${reference} is referenced without a fallback`);
    }
    // Anchors are built from the knobs, not frozen hexes.
    assert.match(resolve(decls.get("--canvas"), decls), /^hsl\(240 0% (9|97)%\)$/);
    assert.equal(
      knobDefault(css, "--lg-blur"),
      "24px",
      "blur defaults to monocode's 24px",
    );
    assert.equal(knobDefault(css, "--lg-wp-brightness"), "1");
    assert.equal(knobDefault(css, "--lg-wp-blur"), "0px");
    assert.equal(knobDefault(css, "--lg-wp-sat"), "1.1");
    assert.equal(knobDefault(css, "--lg-vibrancy"), "70");
    assert.equal(knobDefault(css, "--lg-sidebar-a"), "0.85");
    assert.equal(knobDefault(css, "--lg-pane-a"), "0.85");
    assert.equal(knobDefault(css, "--lg-overlay-a"), "0.94");
    assert.equal(knobDefault(css, "--lg-chrome-a"), "0.72");
    assert.equal(knobDefault(css, "--lg-chrome-fade"), "40px");
    assert.equal(knobDefault(css, "--lg-chrome-blur"), "20px");
    assert.equal(knobDefault(css, "--lg-hue"), "240");
    assert.equal(knobDefault(css, "--lg-sat"), "0%");
    assert.equal(knobDefault(css, "--lg-accent-h"), "211");
    assert.equal(knobDefault(css, "--lg-accent-s"), "92%");
    assert.equal(knobDefault(css, "--lg-accent-l"), mode === "dark" ? "62%" : "38%");
    assert.equal(
      knobDefault(css, "--lg-primary-fg-l"),
      mode === "dark" ? "0%" : "100%",
    );
    assert.equal(knobDefault(css, "--lg-dim"), mode === "dark" ? "0.35" : "0.1");
    assert.match(
      decls.get("--secondary"),
      /var\(--primary\).*18%.*var\(--lg-vibrancy, 70\).*var\(--canvas\)/,
    );
    assert.match(
      decls.get("--accent"),
      /var\(--primary\).*12%.*var\(--lg-vibrancy, 70\).*var\(--canvas\)/,
    );
    assert.match(
      decls.get("--surface-selected"),
      /var\(--primary\).*14%.*var\(--lg-vibrancy, 70\)/,
    );
  });

  test(`${mode} palette consumes AA-safe runtime pairs for every selectable accent`, () => {
    assert.equal(
      decls.get("--primary"),
      "hsl(var(--glass-accent-h) var(--glass-accent-s) var(--glass-accent-l))",
    );
    assert.match(
      decls.get("--primary-foreground"),
      /var\(--lg-primary-fg-l, (?:0|100)%\)/,
    );
    for (const choice of [...ACCENT_SWATCHES, ...CUSTOM_ACCENT_BOUNDARIES]) {
      const vars = resolveVars(
        {
          ...DEFAULT_APPEARANCE,
          accentHue: choice.hue,
          accentSaturation: choice.saturation,
          accentLightness: choice.lightness,
        },
        mode,
      ).vars;
      const accent = hslToRgb(
        Number(vars["--lg-accent-h"]),
        percent(vars["--lg-accent-s"]),
        percent(vars["--lg-accent-l"]),
      );
      const canvas = hslToRgb(
        Number(vars["--lg-hue"]),
        percent(vars["--lg-sat"]),
        mode === "dark" ? 9 : 97,
      );
      const foreground = hslToRgb(0, 0, percent(vars["--lg-primary-fg-l"]));
      assert.ok(
        contrastRatio(accent, canvas) >= 4.5,
        `${mode} ${choice.name} primary must clear the canvas`,
      );
      assert.ok(
        contrastRatio(foreground, accent) >= 4.5,
        `${mode} ${choice.name} foreground must clear the primary`,
      );
    }
  });

  test(`${mode} palette clears WCAG AA on the default canvas`, () => {
    const canvas = colorOf(decls, "--canvas").rgb;
    for (const token of TEXT_TOKENS) {
      const ratio = contrastRatio(colorOf(decls, token).rgb, canvas);
      console.log(
        `  ${mode}  ${token.padEnd(20)} on --canvas ${hex(canvas)} = ${ratio.toFixed(2)}:1`,
      );
      assert.ok(ratio >= 4.5, `${token} on --canvas is ${ratio.toFixed(2)}:1, below 4.5:1`);
    }
    const onPrimary = contrastRatio(
      colorOf(decls, "--primary-foreground").rgb,
      colorOf(decls, "--primary").rgb,
    );
    console.log(
      `  ${mode}  --primary-foreground on --primary        = ${onPrimary.toFixed(2)}:1`,
    );
    assert.ok(onPrimary >= 4.5, "--primary-foreground on --primary is below 4.5:1");
    const onDestructive = contrastRatio(
      colorOf(decls, "--destructive-foreground").rgb,
      colorOf(decls, "--destructive").rgb,
    );
    console.log(
      `  ${mode}  --destructive-foreground on --destructive = ${onDestructive.toFixed(2)}:1`,
    );
    assert.ok(
      onDestructive >= 4.5,
      "--destructive-foreground on --destructive is below 4.5:1",
    );
  });

  test(`${mode} palette clears WCAG AA on the default wallpaper's glass`, () => {
    for (const surface of ["--sidebar", "--background"]) {
      const backdrop = glassBackdrop(css, decls, mode, surface);
      for (const token of TEXT_TOKENS) {
        const ratio = contrastRatio(colorOf(decls, token).rgb, backdrop);
        console.log(
          `  ${mode}  ${token.padEnd(20)} on ${surface.padEnd(12)} ${hex(backdrop)} = ${ratio.toFixed(2)}:1`,
        );
        assert.ok(
          ratio >= 4.5,
          `${token} on ${surface} over aurora is ${ratio.toFixed(2)}:1, below 4.5:1`,
        );
      }
    }
  });

  test(`${mode} palette paints the wallpaper layer and its presets`, () => {
    assert.match(css, /^html \{/m);
    assert.match(css, /background-attachment: fixed, fixed;/);
    assert.match(css, /var\(--lg-wallpaper, var\(--glass-aurora\)\)/);
    assert.match(
      css,
      /filter: brightness\(var\(--lg-wp-brightness, 1\)\) saturate\(var\(--lg-wp-sat, 1\.1\)\) blur\(var\(--lg-wp-blur, 0px\)\);/,
    );
    assert.match(css, /inset: calc\(-1 \* var\(--lg-wp-blur, 0px\)\);/);
    for (const preset of ["aurora", "forest", "sunset", "ocean", "mono"]) {
      assert.match(
        css,
        new RegExp(`html\\[data-lg-wallpaper="${preset}"\\] \\{ --lg-wallpaper: var\\(--glass-${preset}\\); \\}`),
      );
      const layers = resolve(decls.get(`--glass-${preset}`), decls);
      assert.ok(
        (layers.match(/gradient\(/g) ?? []).length >= 2,
        `${preset} must be a layered gradient`,
      );
    }
    assert.match(css, /html\[data-lg-wallpaper="custom"\]/);
    assert.match(css, /var\(--lg-wallpaper-custom, var\(--glass-aurora\)\)/);
    assert.match(css, /html\[data-lg-pane-glass="on"\]/);
    assert.match(css, /html\[data-lg-pane-glass="off"\]/);
    assert.doesNotMatch(
      css,
      /html\[data-lg-pane-glass="on"\] main\[data-sidebar="inset"\] \{/,
      "split panes must not allocate a full-height backdrop-filter layer",
    );
    assert.match(css, /@supports not \(backdrop-filter: blur\(1px\)\)/);
  });

  test(`${mode} palette strengthens the sidebar row states`, () => {
    assert.match(
      css,
      /\.bb-sidebar-open-in-split-row \{\n\s*--bb-sidebar-open-in-split-background: color-mix\(in oklab, var\(--primary\) 10%, var\(--sidebar\)\);\n\s*outline: 1px dashed color-mix\(in oklab, var\(--primary\) 50%, transparent\);\n\s*outline-offset: -1px;\n\}/,
    );
    assert.match(
      css,
      /\.bb-sidebar-selected-row \{\n\s*box-shadow: inset 3px 0 0 var\(--primary\);\n\}/,
    );
    assert.match(
      css,
      /\[data-thread-pane-state="focused"\] \{\n\s*box-shadow: inset 3px 0 0 var\(--thread-accent, var\(--primary\)\);\n\}/,
    );
    // The focused row paints --sidebar-accent at full strength and the
    // open-in-split row at a quarter, so the accent itself must be strong.
    const accent = colorOf(decls, "--sidebar-accent");
    assert.ok(
      accent.alpha >= 0.1 && accent.alpha <= 0.12,
      `--sidebar-accent alpha is ${accent.alpha}, outside the 0.10-0.12 contract`,
    );
  });

  test(`${mode} palette keeps sheets solid and fades chrome backgrounds without touching layout`, () => {
    for (const selector of [
      '[data-radix-popper-content-wrapper] > *', '[role="dialog"]',
      '[role="menu"]', '[role="listbox"]', '[data-bb-portaled-overlay]',
      '[data-secondary-panel-shelf]', '[data-vaul-drawer-direction]',
      '[data-sonner-toast]', '[cmdk-root]',
      '[data-testid="root-compose-compact-home"]',
      '[data-testid="root-compose-compact-composer"]', '[data-scroll-footer]',
      '[data-app-composer]', '[data-follow-up-composer-footer]',
      '[data-promptbox]', 'button[aria-label="Scroll to latest event"]',
      'header.bg-surface-scrim', '[data-testid="route-loading-skeleton"]',
    ]) assert.ok(css.includes(selector), `${selector} must be covered`);
    assert.match(css, /--glass-overlay-a: var\(--lg-overlay-a, 0\.94\)/);
    assert.match(css, /backdrop-filter: blur\(32px\) saturate\(1\.2\)/);
    assert.match(css, /body \{ position: relative; isolation: isolate; background-color: var\(--canvas\); \}/);
    assert.match(css, /\[data-testid="route-loading-skeleton"\] \{ background-color: var\(--canvas\); \}/);
    assert.match(css, /@media \(max-width: 767px\), \(pointer: coarse\)/);
    assert.match(css, /data-lg-compact-solid="on"[\s\S]*?\/ 0\.96\)/);
    const chrome = css.slice(css.indexOf(":is(header.bg-surface-scrim"), css.indexOf("/* `data-promptbox-shell`"));
    assert.match(chrome, /backdrop-filter: blur\(var\(--lg-chrome-blur, 20px\)\)/);
    assert.match(chrome, /:is\(header\.bg-surface-scrim, \[data-secondary-panel-shelf\]\) \{[\s\S]*?linear-gradient\(to bottom,[\s\S]*?var\(--lg-chrome-fade, 40px\)[\s\S]*?box-shadow: inset 0 -1px 0/);
    assert.match(chrome, /:is\(\[data-testid="root-compose-compact-composer"\],[\s\S]*?\) \{[\s\S]*?linear-gradient\(to top,[\s\S]*?var\(--lg-chrome-fade, 40px\)[\s\S]*?box-shadow: inset 0 1px 0/);
    assert.doesNotMatch(chrome, /::before|::after|(?:-webkit-)?mask-image/);
    assert.doesNotMatch(chrome, /(?:^|;)\s*(?:position|inset|display|overflow|contain|isolation|height|min-height|flex|transform)\s*:/m);
    assert.doesNotMatch(chrome, /--glass-overlay-a/);
    assert.match(css, /\[data-promptbox\][\s\S]*min\(1, calc\(var\(--lg-chrome-a, 0\.72\) \+ 0\.12\)\)/);
    assert.match(css, /html \[data-promptbox\] \{[^}]*background-color:[^}]*\}/);
    assert.match(
      css,
      /html \[data-promptbox-shell\] \{\n\s*background-color: transparent;\n\s*background-image: none;\n\s*-webkit-backdrop-filter: none;\n\s*backdrop-filter: none;\n\s*box-shadow: none;\n\}/,
    );
    assert.match(
      css,
      /html \[data-follow-up-composer-footer\] \{\n\s*background-color: transparent;\n\s*background-image: none;\n\s*-webkit-backdrop-filter: none;\n\s*backdrop-filter: none;\n\s*box-shadow: none;\n\}/,
    );
    assert.match(css, /html \[data-thread-window\] \.sticky\.bottom-0 > \.bg-sidebar,/);
    assert.match(css, /html \[data-thread-window\] \.chat-prompt-box/);
    assert.doesNotMatch(
      css.replace(/\/\*[\s\S]*?\*\//g, ""),
      /:has\(/,
      "no :has() selectors: a :has() anchored inside a thread pane forces a full pane re-match on every mutation, which lagged typing and menu opening",
    );
    assert.match(
      css,
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?interpolate-size: allow-keywords;[\s\S]*?height 120ms cubic-bezier\(0\.2, 0, 0, 1\)/,
      "composer compaction must ease automatic height changes without overriding reduced motion",
    );
    assert.match(css, /html \[data-thread-window\] \.sticky\.bottom-0 > \.bg-background/);
    assert.match(css, /html \[data-thread-window\] \.sticky\.bottom-0 \[data-overflow-fade="above"\]/);
    assert.match(css, /background-color: transparent !important/);
    assert.match(css, /display: none !important/);
    assert.match(
      css,
      /:is\(\[role="tooltip"\], \[data-radix-popper-content-wrapper\] > \.bg-primary\) \{\n\s*color: var\(--foreground\);\n\}/,
    );
    assert.match(
      css,
      /html :is\(\[role="menu"\], \[role="listbox"\], \[data-radix-popper-content-wrapper\] > \*\) \{\n\s*-webkit-backdrop-filter: none;\n\s*backdrop-filter: none;\n\}/,
      "popper-positioned popups (menus, tooltips, popovers, selects) must not wait on a backdrop-filter raster",
    );
    assert.doesNotMatch(
      css,
      /data-lg-compact-solid="on"\] :is\([^{]*\[role="menu"\]/,
      "the compact-solid rule must not re-blur menus and popups",
    );
    assert.match(
      css,
      /\[data-testid="root-compose-compact-home"\] \{\n\s*background-color: transparent;\n\s*-webkit-backdrop-filter: none;\n\s*backdrop-filter: none;\n\s*box-shadow: none;\n\}/,
    );
    assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*background-image: none/);
    assert.match(
      css,
      /html \[data-promptbox-shell\] > \.grid \{\n\s*grid-template-columns: minmax\(0, 1fr\);\n\}\nhtml \[data-promptbox-shell\] > \.grid > \* \{\n\s*min-width: 0;\n\s*max-width: 100%;\n\}/,
      "the composer banner stack must size its column to the pane so cards cannot overflow a phone viewport",
    );
    assert.match(
      css,
      /\[data-sidebar="panel"\]\[data-state="closed"\]:not\(\[data-vaul-animate="false"\]\) \{\n\s*visibility: hidden;\n\s*transition: visibility 0s;\n\s*\}/,
      "the closed mobile sidebar must hide immediately so it does not ghost through the pane while the page slides back",
    );
    for (const token of ["--card", "--popover", "--surface-raised"]) {
      assert.match(decls.get(token), /var\(--glass-overlay-a\)/);
    }
    assert.match(decls.get("--surface-raised-solid"), /var\(--canvas\)/);
  });

  test(`${mode} palette stacks exactly one tinted layer per pane`, () => {
    // The host paints `body` and `<main data-sidebar="inset">` with
    // `bg-background`, and nests four `bg-sidebar` elements down the sidebar.
    // Without these two rules each layer composites again and the wallpaper is
    // gone: 2.25% through the main pane, 0.05% through the sidebar.
    assert.match(css, /\nbody \{\n  background-color: transparent;\n\}/);
    assert.match(
      css,
      /\n\.bg-sidebar \.bg-sidebar \{\n  background-color: transparent;\n  -webkit-backdrop-filter: none;\n  backdrop-filter: none;\n\}/,
    );
    // A sticky header still has to hide the rows scrolling under it.
    assert.match(
      css,
      /\n\.bg-sidebar \.sticky\.bg-sidebar,\n\.bg-sidebar \[data-sidebar-sticky-tier\] \{/,
    );

    for (const surface of ["--background", "--sidebar"]) {
      assert.equal(
        tintLayers(css, surface),
        1,
        `${surface} must reach the wallpaper through one tinted layer`,
      );
      const transmission = wallpaperTransmission(css, decls, surface);
      console.log(
        `  ${mode}  ${surface.padEnd(12)} passes ${(transmission * 100).toFixed(2)}% of the wallpaper`,
      );
      assert.ok(
        Math.abs(transmission - 0.15) < 0.005,
        `${surface} passes ${(transmission * 100).toFixed(2)}% of the wallpaper, not monocode's 15%`,
      );
    }
  });

  test(`${mode} palette frosts panes without compositing every nested card`, () => {
    assert.ok(css.includes(".bg-sidebar"), ".bg-sidebar must carry the frosted treatment");
    const blurs = [
      ...css.matchAll(/backdrop-filter: blur\(var\(--lg-blur, 24px\)\) saturate\(1\.3\)/g),
    ];
    assert.ok(blurs.length >= 4, "pane and sticky blur must read the knob");
    assert.doesNotMatch(
      css,
      /\.bg-popover,\n\.bg-card \{[\s\S]*backdrop-filter/,
      "nested cards must not allocate individual backdrop-filter layers",
    );
    assert.match(css, /inset 0 1px 0 hsl\(0 0% 100% \/ 0\.06\)/);
    const sidebar = colorOf(decls, "--sidebar");
    assert.equal(sidebar.alpha, 0.85, "the sidebar defaults to monocode's 0.85");
    // Nested sidebar layers must not blur again: three stacked blurs cost three
    // compositing passes and read as a single opaque pane.
    assert.match(
      css,
      /\.bg-sidebar \.bg-sidebar \{[^}]*backdrop-filter: none;/,
    );
  });
}

test("code themes are valid, match their palettes, and are AA-readable", async () => {
  for (const [file, type] of [
    ["liquid-glass-dark-code.json", "dark"],
    ["liquid-glass-light-code.json", "light"],
  ]) {
    const theme = JSON.parse(await readFile(new URL(`themes/${file}`, root), "utf8"));
    const decls = declarations(palettes[type]);
    const background = colorOf(decls, "--canvas").rgb;
    assert.equal(theme.type, type);
    assert.equal(theme.colors["editor.background"], hex(background));
    assert.equal(theme.colors["editor.foreground"], hex(colorOf(decls, "--ink").rgb));
    assert.ok(theme.tokenColors.length >= 10);
    for (const token of theme.tokenColors) {
      const foreground = token.settings.foreground;
      if (foreground === undefined) continue;
      const rgb = foreground
        .slice(1, 7)
        .match(/.{2}/g)
        .map((pair) => Number.parseInt(pair, 16));
      const ratio = contrastRatio(rgb, background);
      assert.ok(
        ratio >= 4.5,
        `${type} token ${foreground} is ${ratio.toFixed(2)}:1 on ${hex(background)}`,
      );
    }
  }
});
