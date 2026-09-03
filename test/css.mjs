/** Reads a Liquid Glass palette out of its CSS the way a browser would. */
import assert from "node:assert/strict";

import { contrastRatio, hslToRgb, over, relativeLuminance } from "./color.mjs";

/** Declarations of the first `:root, .light, .dark` block. */
export function declarations(css) {
  const block = css.match(/:root,\n\.light,\n\.dark \{([\s\S]*?)\n\}/);
  assert.ok(block, "the palette must open with a :root, .light, .dark block");
  const map = new Map();
  for (const [, name, value] of `${block[1]}\n`.matchAll(/(--[\w-]+):\s*([\s\S]*?);\n/g)) {
    map.set(name, value.trim());
  }
  return map;
}

/** Splits a var() argument list at its top-level comma. */
export function splitVar(inner) {
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "(") depth += 1;
    else if (inner[i] === ")") depth -= 1;
    else if (inner[i] === "," && depth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  return [inner.trim(), null];
}

/**
 * Resolves a declaration to a literal, the way a browser would with the
 * frontend disabled: an `--lg-*` reference takes its declared fallback, any
 * other reference takes the palette's own value.
 */
export function resolve(value, decls, seen = new Set()) {
  let out = "";
  for (let i = 0; i < value.length; ) {
    const at = value.indexOf("var(", i);
    if (at === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    let depth = 0;
    let end = at + 3;
    for (; end < value.length; end += 1) {
      if (value[end] === "(") depth += 1;
      else if (value[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const [name, fallback] = splitVar(value.slice(at + 4, end));
    assert.ok(
      !name.startsWith("--lg-") || fallback !== null,
      `${name} must be referenced with a fallback`,
    );
    const replacement =
      name.startsWith("--lg-") ? fallback
      : decls.has(name) && !seen.has(name) ? decls.get(name)
      : fallback;
    assert.ok(replacement !== null && replacement !== undefined, `cannot resolve ${name}`);
    out += resolve(replacement, decls, new Set([...seen, name]));
    i = end + 1;
  }
  return out;
}

/** A resolved token as [r, g, b] plus its alpha. */
export function colorOf(decls, token) {
  assert.ok(decls.has(token), `${token} must be declared`);
  return parseColor(resolve(decls.get(token), decls), token);
}

export function parseColor(literal, label) {
  const value = literal.trim();
  const hsl = value.match(
    /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+)\s*)?\)$/,
  );
  if (hsl) {
    return {
      rgb: hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3])),
      alpha: hsl[4] === undefined ? 1 : Number(hsl[4]),
    };
  }
  const six = value.match(/^#([0-9a-f]{6})$/i);
  if (six) {
    return {
      rgb: six[1].match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)),
      alpha: 1,
    };
  }
  throw new assert.AssertionError({
    message: `${label} must resolve to an hsl() or six-digit hex, got "${value}"`,
  });
}

/** The default of an `--lg-*` knob, read from the first fallback that names it. */
export function knobDefault(css, knob) {
  const match = css.match(new RegExp(`var\\(${knob},\\s*([^),]+)\\)`));
  assert.ok(match, `${knob} must be referenced with a fallback`);
  return match[1].trim();
}

/**
 * How many tinted layers a palette actually stacks between the wallpaper and
 * the content of one pane.
 *
 * The host nests its surfaces: `body` and `<main data-sidebar="inset">` both
 * carry `bg-background`, and the sidebar carries `bg-sidebar` on the fixed
 * panel, its inner column, SidebarContent and each sticky tier. Every one of
 * those composites the pane tint again, so "0.85 glass" silently becomes
 * 0.9995 and the wallpaper disappears. A palette that means to be glass has to
 * collapse each stack to exactly one tinted layer; these are the rules that do
 * it, and their absence is what this function measures.
 */
const COLLAPSE_RULES = {
  "--background": /\nbody \{\n  background-color: transparent;\n\}/,
  "--sidebar": /\n\.bg-sidebar \.bg-sidebar \{\n  background-color: transparent;\n(?:.*\n)*?\}/,
};

/** The host's own nesting depth for each pane token, when nothing collapses it. */
const HOST_NESTING = { "--background": 2, "--sidebar": 4 };

export function tintLayers(css, paneToken) {
  const rule = COLLAPSE_RULES[paneToken];
  assert.ok(rule, `no collapse contract is defined for ${paneToken}`);
  return rule.test(css) ? 1 : HOST_NESTING[paneToken];
}

/** The fraction of the wallpaper still visible through a pane, 0-1. */
export function wallpaperTransmission(css, decls, paneToken) {
  const pane = colorOf(decls, paneToken);
  return (1 - pane.alpha) ** tintLayers(css, paneToken);
}

/**
 * The worst backdrop a text token faces on the shipped default wallpaper: every
 * translucent bloom of the `aurora` preset stacked at its peak alpha over the
 * preset's own base (they sit in different corners, so this over-states the
 * overlap on purpose), the default dim over that, and the pane stack -- as many
 * tinted layers as the CSS really produces -- over the result.
 */
export function glassBackdrop(css, decls, mode, paneToken) {
  const preset = resolve(decls.get("--glass-aurora"), decls);
  const stops = [...preset.matchAll(/hsl\([^)]*\)/g)].map((match) =>
    parseColor(match[0], "aurora stop"),
  );
  const opaque = stops.filter((stop) => stop.alpha === 1);
  const translucent = stops.filter((stop) => stop.alpha < 1);
  assert.ok(opaque.length >= 2 && translucent.length >= 2, "aurora needs layered stops");

  // The brightest opaque base stop, then the blooms in reverse paint order.
  const base = opaque.reduce((brightest, stop) =>
    relativeLuminance(stop.rgb) > relativeLuminance(brightest.rgb) ? stop : brightest,
  ).rgb;
  const wallpaper = translucent
    .slice()
    .reverse()
    .reduce((backdrop, stop) => over(stop.rgb, stop.alpha, backdrop), base);

  const dim = Number(knobDefault(css, "--lg-dim"));
  const dimmed = over(mode === "dark" ? [0, 0, 0] : [255, 255, 255], dim, wallpaper);
  const pane = colorOf(decls, paneToken);
  let backdrop = dimmed;
  for (let layer = tintLayers(css, paneToken); layer > 0; layer -= 1) {
    backdrop = over(pane.rgb, pane.alpha, backdrop);
  }
  return backdrop;
}

