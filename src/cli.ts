/**
 * `bb liquid-glass` — the terminal half of the settings section. Output is
 * bounded: `show` prints one line per key, `presets` prints the five preset
 * names, and nothing here streams a file.
 *
 * `show` prints the names the settings UI uses; `set` accepts those and the
 * internal names they replaced, forever, so a script written against an older
 * build keeps working. Only the CLI vocabulary moved — the stored keys and the
 * `--lg-*` variables are unchanged.
 */
import {
  ACCENT_SWATCHES,
  DEFAULT_APPEARANCE,
  RANGES,
  WALLPAPER_PRESETS,
  clamp,
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
    summary: "Set one appearance key, e.g. `set sidebarBlur 32` or `set wallpaper ocean`.",
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

/**
 * The name `show` prints, for each internal key whose name the settings UI
 * changed. Every key not listed here prints under its own name.
 */
export const DISPLAY_NAMES: Readonly<Record<string, keyof Appearance>> = {
  sidebarBlur: "blur",
  headerTint: "chromeOpacity",
  headerTintDepth: "chromeFade",
  headerBlur: "chromeBlur",
  menuOpacity: "overlayOpacity",
  promptCollapsedOpacity: "composerIdleOpacity",
  promptExpandedOpacity: "composerFocusOpacity",
  wallpaperWash: "dim",
  accentWash: "interactiveVibrancy",
};

const NAME_FOR_KEY = new Map<string, string>(
  Object.entries(DISPLAY_NAMES).map(([display, key]) => [key, display]),
);

/** What `show` calls one stored key. */
export function displayName(key: string): string {
  return NAME_FOR_KEY.get(key) ?? key;
}

/** Every name `set` documents, in the order `show` prints them. */
export const DISPLAY_KEYS = Object.keys(DEFAULT_APPEARANCE).map(displayName);

/**
 * The two knobs phase three retired. `set` still takes them: `paneBlur` adds
 * into `wallpaperBlur` (the sum was always what rendered), and `paneGlass`
 * moves `paneOpacity` to where the toggle used to pin it.
 */
const RETIRED_PANE_BLUR = { min: 0, max: 64 };
const PANE_GLASS_OFF_OPACITY = 0.96;

const NUMERIC_KEYS = Object.keys(RANGES) as Array<keyof typeof RANGES>;

const LABEL_WIDTH = 24;

export function formatAppearance(appearance: Appearance): string {
  return Object.entries(appearance)
    .map(
      ([key, value]) =>
        `${displayName(key).padEnd(LABEL_WIDTH)} ${value === null ? "(unset)" : String(value)}`,
    )
    .join("\n");
}

export function formatPresets(): string {
  return [
    `wallpaper: ${[...WALLPAPER_PRESETS, "custom"].join(", ")}`,
    `accent:    ${ACCENT_SWATCHES.map((swatch) => swatch.name.toLowerCase()).join(", ")}`,
  ].join("\n");
}

export type ParsedSet =
  | { ok: true; patch: AppearancePatch; note?: string }
  | { ok: false; error: string };

function parseBoolean(raw: string): boolean | null {
  if (raw === "on" || raw === "true") return true;
  if (raw === "off" || raw === "false") return false;
  return null;
}

/**
 * `set paneBlur N` → the wallpaper blur it used to be added to. The old knob
 * fed the same `blur()` as `wallpaperBlur`, so the sum is what the user saw.
 */
function setRetiredPaneBlur(raw: string, current: Appearance): ParsedSet {
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false, error: "paneBlur takes a number." };
  if (value < RETIRED_PANE_BLUR.min || value > RETIRED_PANE_BLUR.max) {
    return {
      ok: false,
      error: `paneBlur must be between ${RETIRED_PANE_BLUR.min} and ${RETIRED_PANE_BLUR.max}.`,
    };
  }
  const total = current.wallpaperBlur + value;
  const wallpaperBlur = clamp(total, RANGES.wallpaperBlur.min, RANGES.wallpaperBlur.max);
  const capped = wallpaperBlur !== total ? ` (capped from ${total})` : "";
  return {
    ok: true,
    patch: { wallpaperBlur },
    note:
      `Note: paneBlur is retired — it and wallpaperBlur were one blur. ` +
      `Set wallpaperBlur to ${wallpaperBlur}${capped}.`,
  };
}

/**
 * `set paneGlass on|off` → the pane opacity the toggle used to pin. "off" was
 * 0.96; "on" restores the default unless the pane is already glassier than the
 * toggle's own floor, in which case there is nothing to restore.
 */
function setRetiredPaneGlass(raw: string, current: Appearance): ParsedSet {
  const on = parseBoolean(raw);
  if (on === null) return { ok: false, error: "paneGlass takes on|off." };
  if (!on) {
    return {
      ok: true,
      patch: { paneOpacity: PANE_GLASS_OFF_OPACITY },
      note: `Note: paneGlass is retired — set paneOpacity to ${PANE_GLASS_OFF_OPACITY} instead.`,
    };
  }
  if (current.paneOpacity < PANE_GLASS_OFF_OPACITY) {
    return {
      ok: true,
      patch: {},
      note:
        `Note: paneGlass is retired — paneOpacity is already ${current.paneOpacity}, ` +
        `below the ${PANE_GLASS_OFF_OPACITY} the toggle used to pin, so nothing changed.`,
    };
  }
  return {
    ok: true,
    patch: { paneOpacity: DEFAULT_APPEARANCE.paneOpacity },
    note:
      `Note: paneGlass is retired — set paneOpacity to the default ` +
      `${DEFAULT_APPEARANCE.paneOpacity} instead.`,
  };
}

/** `set <key> <value>` → a validated patch, or a message naming what is wrong. */
export function parseSet(
  key: string,
  raw: string,
  current: Appearance = DEFAULT_APPEARANCE,
): ParsedSet {
  if (key === "paneBlur") return setRetiredPaneBlur(raw, current);
  if (key === "paneGlass") return setRetiredPaneGlass(raw, current);

  const canonical: string = DISPLAY_NAMES[key] ?? key;

  if (canonical === "compactSolidPanes") {
    const value = parseBoolean(raw);
    if (value === null) return { ok: false, error: `${key} takes on|off.` };
    return { ok: true, patch: { compactSolidPanes: value } };
  }
  if (canonical === "wallpaper") {
    const allowed = [...WALLPAPER_PRESETS, "custom"] as string[];
    if (!allowed.includes(raw)) {
      return { ok: false, error: `wallpaper takes ${allowed.join("|")}.` };
    }
    return { ok: true, patch: { wallpaper: raw as Appearance["wallpaper"] } };
  }
  if (canonical === "wallpaperUrl" || canonical === "wallpaperPath") {
    return { ok: true, patch: { [canonical]: raw === "" || raw === "null" ? null : raw } };
  }
  if (canonical === "accent") {
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
  const numeric = NUMERIC_KEYS.find((candidate) => candidate === canonical);
  if (!numeric) {
    return {
      ok: false,
      error: `Unknown key "${key}". Known keys: ${DISPLAY_KEYS.join(", ")}, accent.`,
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
  "Keys: " + DISPLAY_KEYS.join(", ") + ", accent",
].join("\n");
