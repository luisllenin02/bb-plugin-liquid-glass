/**
 * `bb liquid-glass` — the terminal half of the settings section. Output is
 * bounded: `show` prints one line per key, `presets` prints the five preset
 * names, and nothing here streams a file.
 */
import {
  ACCENT_SWATCHES,
  DEFAULT_APPEARANCE,
  RANGES,
  WALLPAPER_PRESETS,
  type Appearance,
  type AppearancePatch,
} from "./appearance.js";

export const CLI_COMMANDS = [
  {
    name: "show",
    summary: "Print the current Liquid Glass appearance.",
    usage: "bb liquid-glass show",
  },
  {
    name: "set",
    summary: "Set one appearance key, e.g. `set blur 32` or `set wallpaper ocean`.",
    usage: "bb liquid-glass set <key> <value>",
  },
  {
    name: "reset",
    summary: "Restore the monocode defaults.",
    usage: "bb liquid-glass reset",
  },
  {
    name: "presets",
    summary: "List the wallpaper presets and the accent swatches.",
    usage: "bb liquid-glass presets",
  },
];

const NUMERIC_KEYS = Object.keys(RANGES) as Array<keyof typeof RANGES>;

export function formatAppearance(appearance: Appearance): string {
  return Object.entries(appearance)
    .map(([key, value]) => `${key.padEnd(18)} ${value === null ? "(unset)" : String(value)}`)
    .join("\n");
}

export function formatPresets(): string {
  return [
    `wallpaper: ${[...WALLPAPER_PRESETS, "custom"].join(", ")}`,
    `accent:    ${ACCENT_SWATCHES.map((swatch) => swatch.name.toLowerCase()).join(", ")}`,
  ].join("\n");
}

export type ParsedSet =
  | { ok: true; patch: AppearancePatch }
  | { ok: false; error: string };

/** `set <key> <value>` → a validated patch, or a message naming what is wrong. */
export function parseSet(key: string, raw: string): ParsedSet {
  if (key === "paneGlass" || key === "compactSolidPanes") {
    if (raw !== "on" && raw !== "off" && raw !== "true" && raw !== "false") {
      return { ok: false, error: `${key} takes on|off.` };
    }
    return { ok: true, patch: { [key]: raw === "on" || raw === "true" } };
  }
  if (key === "wallpaper") {
    const allowed = [...WALLPAPER_PRESETS, "custom"] as string[];
    if (!allowed.includes(raw)) {
      return { ok: false, error: `wallpaper takes ${allowed.join("|")}.` };
    }
    return { ok: true, patch: { wallpaper: raw as Appearance["wallpaper"] } };
  }
  if (key === "wallpaperUrl" || key === "wallpaperPath") {
    return { ok: true, patch: { [key]: raw === "" || raw === "null" ? null : raw } };
  }
  if (key === "accent") {
    const swatch = ACCENT_SWATCHES.find(
      (candidate) => candidate.name.toLowerCase() === raw.toLowerCase(),
    );
    if (!swatch) {
      return {
        ok: false,
        error: `accent takes ${ACCENT_SWATCHES.map((s) => s.name.toLowerCase()).join("|")}.`,
      };
    }
    return {
      ok: true,
      patch: {
        accentHue: swatch.hue,
        accentSaturation: swatch.saturation,
        accentLightness: swatch.lightness,
      },
    };
  }
  const numeric = NUMERIC_KEYS.find((candidate) => candidate === key);
  if (!numeric) {
    return {
      ok: false,
      error: `Unknown key "${key}". Known keys: ${Object.keys(DEFAULT_APPEARANCE).join(", ")}, accent.`,
    };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false, error: `${key} takes a number.` };
  const range = RANGES[numeric];
  if (value < range.min || value > range.max) {
    return { ok: false, error: `${key} must be between ${range.min} and ${range.max}.` };
  }
  return { ok: true, patch: { [numeric]: value } };
}

export const CLI_USAGE = [
  "Usage:",
  ...CLI_COMMANDS.map((command) => `  ${command.usage}`),
  "",
  "Keys: " + Object.keys(DEFAULT_APPEARANCE).join(", ") + ", accent",
].join("\n");
