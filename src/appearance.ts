/**
 * The appearance model, shared by the server (kv + rpc + cli) and the frontend
 * (settings section + content script). Everything here is pure so it can be
 * unit-tested without a bb server or a DOM.
 *
 * The knob names and ranges mirror monocode's `src/lib/appearance.ts`: hue
 * 0-360 (default 240), saturation 0-100 (default 0), sidebar opacity 0.15-1
 * (default 0.85), blur 1-64 (default 24), main-pane glass (default on).
 * Phase two adds independent pane and wallpaper controls beside those original
 * knobs; normalization keeps older kv rows forward-compatible.
 */
import { z } from "zod";

export const WALLPAPER_PRESETS = [
  "aurora",
  "forest",
  "sunset",
  "ocean",
  "mono",
] as const;

export type WallpaperPreset = (typeof WALLPAPER_PRESETS)[number];

export const RANGES = {
  hue: { min: 0, max: 360, step: 1 },
  saturation: { min: 0, max: 100, step: 1 },
  accentHue: { min: 0, max: 360, step: 1 },
  accentSaturation: { min: 0, max: 100, step: 1 },
  accentLightness: { min: 20, max: 85, step: 1 },
  sidebarOpacity: { min: 0.15, max: 1, step: 0.01 },
  blur: { min: 1, max: 64, step: 1 },
  paneOpacity: { min: 0.15, max: 1, step: 0.01 },
  paneBlur: { min: 0, max: 64, step: 1 },
  overlayOpacity: { min: 0.85, max: 1, step: 0.01 },
  chromeOpacity: { min: 0, max: 1, step: 0.01 },
  chromeFade: { min: 0, max: 96, step: 1 },
  chromeBlur: { min: 0, max: 48, step: 1 },
  wallpaperBrightness: { min: 0.3, max: 1.6, step: 0.01 },
  wallpaperBlur: { min: 0, max: 40, step: 1 },
  wallpaperSaturation: { min: 0, max: 2, step: 0.01 },
  dim: { min: 0, max: 0.8, step: 0.01 },
  interactiveVibrancy: { min: 0, max: 100, step: 1 },
} as const;

/**
 * The nine vibrant thread colours (monocode `src/lib/tabGroups.ts`), as the
 * accent swatch row. Index 0 is monocode's neutral; the rest are the palette
 * brief §4.2 names.
 */
export const ACCENT_SWATCHES: ReadonlyArray<{
  name: string;
  hue: number;
  saturation: number;
  lightness: number;
}> = [
  { name: "Slate", hue: 210, saturation: 8, lightness: 58 },
  { name: "Blue", hue: 211, saturation: 92, lightness: 62 },
  { name: "Coral", hue: 12, saturation: 80, lightness: 58 },
  { name: "Amber", hue: 45, saturation: 90, lightness: 55 },
  { name: "Green", hue: 142, saturation: 55, lightness: 50 },
  { name: "Pink", hue: 330, saturation: 70, lightness: 62 },
  { name: "Violet", hue: 280, saturation: 55, lightness: 62 },
  { name: "Teal", hue: 175, saturation: 55, lightness: 48 },
  { name: "Orange", hue: 25, saturation: 85, lightness: 58 },
];

export const appearanceSchema = z
  .object({
    hue: z.number().min(RANGES.hue.min).max(RANGES.hue.max),
    saturation: z.number().min(RANGES.saturation.min).max(RANGES.saturation.max),
    accentHue: z.number().min(RANGES.accentHue.min).max(RANGES.accentHue.max),
    accentSaturation: z.number().min(RANGES.accentSaturation.min).max(RANGES.accentSaturation.max),
    accentLightness: z.number().min(RANGES.accentLightness.min).max(RANGES.accentLightness.max),
    sidebarOpacity: z.number().min(RANGES.sidebarOpacity.min).max(RANGES.sidebarOpacity.max),
    paneGlass: z.boolean(),
    blur: z.number().min(RANGES.blur.min).max(RANGES.blur.max),
    paneOpacity: z
      .number()
      .min(RANGES.paneOpacity.min)
      .max(RANGES.paneOpacity.max),
    paneBlur: z.number().min(RANGES.paneBlur.min).max(RANGES.paneBlur.max),
    overlayOpacity: z
      .number()
      .min(RANGES.overlayOpacity.min)
      .max(RANGES.overlayOpacity.max),
    chromeOpacity: z.number().min(RANGES.chromeOpacity.min).max(RANGES.chromeOpacity.max),
    chromeFade: z.number().min(RANGES.chromeFade.min).max(RANGES.chromeFade.max),
    chromeBlur: z.number().min(RANGES.chromeBlur.min).max(RANGES.chromeBlur.max),
    compactSolidPanes: z.boolean(),
    wallpaper: z.enum([...WALLPAPER_PRESETS, "custom"]),
    wallpaperUrl: z.string().nullable(),
    wallpaperPath: z.string().nullable(),
    wallpaperBrightness: z
      .number()
      .min(RANGES.wallpaperBrightness.min)
      .max(RANGES.wallpaperBrightness.max),
    wallpaperBlur: z
      .number()
      .min(RANGES.wallpaperBlur.min)
      .max(RANGES.wallpaperBlur.max),
    wallpaperSaturation: z
      .number()
      .min(RANGES.wallpaperSaturation.min)
      .max(RANGES.wallpaperSaturation.max),
    dim: z.number().min(RANGES.dim.min).max(RANGES.dim.max),
    interactiveVibrancy: z
      .number()
      .min(RANGES.interactiveVibrancy.min)
      .max(RANGES.interactiveVibrancy.max),
  })
  .strict();

export type Appearance = z.infer<typeof appearanceSchema>;

export const appearancePatchSchema = appearanceSchema.partial().strict();
export type AppearancePatch = z.infer<typeof appearancePatchSchema>;

export const DEFAULT_APPEARANCE: Appearance = {
  hue: 240,
  saturation: 0,
  accentHue: 211,
  accentSaturation: 92,
  accentLightness: 62,
  sidebarOpacity: 0.85,
  paneGlass: true,
  blur: 24,
  paneOpacity: 0.85,
  paneBlur: 24,
  overlayOpacity: 0.94,
  chromeOpacity: 0.72,
  chromeFade: 40,
  chromeBlur: 20,
  compactSolidPanes: true,
  wallpaper: "aurora",
  wallpaperUrl: null,
  wallpaperPath: null,
  wallpaperBrightness: 1,
  wallpaperBlur: 0,
  wallpaperSaturation: 1.1,
  dim: 0.35,
  interactiveVibrancy: 70,
};

export type Palette = "dark" | "light";

export const THEME_ID_PREFIX = "plugin:liquid-glass:";

/**
 * Which palette an active bb theme id selects, or null when the active theme
 * is not one of ours (in which case the content script writes nothing).
 */
export function paletteForThemeId(themeId: string | null): Palette | null {
  if (themeId === `${THEME_ID_PREFIX}liquid-glass`) return "dark";
  if (themeId === `${THEME_ID_PREFIX}liquid-glass-light`) return "light";
  return null;
}

/**
 * Retained for consumers of the phase-one appearance module. Contrast is no
 * longer enforced with a hue-independent sub-band; `resolveVars` searches this
 * full user-facing range using the actual accent and canvas colours.
 */
export const ACCENT_LIGHTNESS_BAND: Record<Palette, { min: number; max: number }> = {
  dark: { min: RANGES.accentLightness.min, max: RANGES.accentLightness.max },
  light: { min: RANGES.accentLightness.min, max: RANGES.accentLightness.max },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const CANVAS_LIGHTNESS: Record<Palette, number> = { dark: 9, light: 97 };

function hslToRgb(hue: number, saturation: number, lightness: number): number[] {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r, g, b] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
    : section < 3 ? [0, chroma, x]
    : section < 4 ? [0, x, chroma]
    : section < 5 ? [x, 0, chroma]
    : [chroma, 0, x];
  const offset = l - chroma / 2;
  return [(r + offset) * 255, (g + offset) * 255, (b + offset) * 255];
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: number[], second: number[]): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function resolveAccent(
  appearance: Appearance,
  palette: Palette,
): { hue: number; saturation: number; lightness: number; foregroundLightness: number } {
  const hue = Math.round(clamp(appearance.accentHue, 0, 360));
  const saturation = Math.round(clamp(appearance.accentSaturation, 0, 100));
  const requested = Math.round(clamp(appearance.accentLightness, 20, 85));
  const canvas = hslToRgb(
    Math.round(clamp(appearance.hue, 0, 360)),
    Math.round(clamp(appearance.saturation, 0, 100)),
    CANVAS_LIGHTNESS[palette],
  );
  const candidates = Array.from(
    { length: RANGES.accentLightness.max - RANGES.accentLightness.min + 1 },
    (_, index) => RANGES.accentLightness.min + index,
  ).sort((a, b) => Math.abs(a - requested) - Math.abs(b - requested));
  const lightness = candidates.find(
    (candidate) => contrast(hslToRgb(hue, saturation, candidate), canvas) >= 4.5,
  ) ?? (palette === "dark" ? RANGES.accentLightness.max : RANGES.accentLightness.min);
  const accent = hslToRgb(hue, saturation, lightness);
  const foregroundLightness = contrast([0, 0, 0], accent) >= contrast([255, 255, 255], accent)
    ? 0
    : 100;
  return { hue, saturation, lightness, foregroundLightness };
}

/**
 * Coerce anything stored or received into a valid Appearance. Both schemas are
 * strict, and the RPC reply carries two extra fields (`activeThemeId`,
 * `updatedAt`), so unknown keys are dropped before validation rather than
 * failing the whole row.
 */
export function normalize(input: unknown): Appearance {
  if (typeof input !== "object" || input === null) return DEFAULT_APPEARANCE;
  const source = input as Record<string, unknown>;
  const known: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_APPEARANCE)) {
    if (key in source) known[key] = source[key];
  }
  const parsed = appearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, ...known });
  return parsed.success ? parsed.data : DEFAULT_APPEARANCE;
}

/**
 * The `--lg-*` custom properties and `data-lg-*` attributes for one appearance
 * on one palette. Pure: the content script only applies what this returns and
 * removes exactly these keys on dispose. `updatedAt` is the server's write
 * stamp, which only reaches the custom-wallpaper URL as its cache-buster.
 */
export function resolveVars(
  appearance: Appearance,
  palette: Palette,
  updatedAt = 0,
): { vars: Record<string, string>; attributes: Record<string, string> } {
  const accent = resolveAccent(appearance, palette);
  const vars: Record<string, string> = {
    "--lg-hue": String(Math.round(clamp(appearance.hue, RANGES.hue.min, RANGES.hue.max))),
    "--lg-sat": `${Math.round(
      clamp(appearance.saturation, RANGES.saturation.min, RANGES.saturation.max),
    )}%`,
    "--lg-accent-h": String(accent.hue),
    "--lg-accent-s": `${accent.saturation}%`,
    "--lg-accent-l": `${accent.lightness}%`,
    "--lg-primary-fg-l": `${accent.foregroundLightness}%`,
    "--lg-sidebar-a": String(
      clamp(
        appearance.sidebarOpacity,
        RANGES.sidebarOpacity.min,
        RANGES.sidebarOpacity.max,
      ),
    ),
    "--lg-pane-a": String(
      clamp(
        appearance.paneOpacity,
        RANGES.paneOpacity.min,
        RANGES.paneOpacity.max,
      ),
    ),
    "--lg-blur": `${Math.round(clamp(appearance.blur, RANGES.blur.min, RANGES.blur.max))}px`,
    "--lg-pane-blur": `${Math.round(
      clamp(appearance.paneBlur, RANGES.paneBlur.min, RANGES.paneBlur.max),
    )}px`,
    "--lg-overlay-a": String(
      clamp(appearance.overlayOpacity, RANGES.overlayOpacity.min, RANGES.overlayOpacity.max),
    ),
    "--lg-chrome-a": String(
      clamp(appearance.chromeOpacity, RANGES.chromeOpacity.min, RANGES.chromeOpacity.max),
    ),
    "--lg-chrome-fade": `${Math.round(
      clamp(appearance.chromeFade, RANGES.chromeFade.min, RANGES.chromeFade.max),
    )}px`,
    "--lg-chrome-blur": `${Math.round(
      clamp(appearance.chromeBlur, RANGES.chromeBlur.min, RANGES.chromeBlur.max),
    )}px`,
    "--lg-wp-brightness": String(
      clamp(
        appearance.wallpaperBrightness,
        RANGES.wallpaperBrightness.min,
        RANGES.wallpaperBrightness.max,
      ),
    ),
    "--lg-wp-blur": `${Math.round(
      clamp(appearance.wallpaperBlur, RANGES.wallpaperBlur.min, RANGES.wallpaperBlur.max),
    )}px`,
    "--lg-wp-sat": String(
      clamp(
        appearance.wallpaperSaturation,
        RANGES.wallpaperSaturation.min,
        RANGES.wallpaperSaturation.max,
      ),
    ),
    "--lg-dim": String(clamp(appearance.dim, RANGES.dim.min, RANGES.dim.max)),
    "--lg-vibrancy": String(
      Math.round(
        clamp(
          appearance.interactiveVibrancy,
          RANGES.interactiveVibrancy.min,
          RANGES.interactiveVibrancy.max,
        ),
      ),
    ),
  };

  const custom = customWallpaperImage(appearance, updatedAt);
  if (custom !== null) vars["--lg-wallpaper-custom"] = custom;

  return {
    vars,
    attributes: {
      "data-lg-wallpaper": custom === null && appearance.wallpaper === "custom"
        ? "aurora"
        : appearance.wallpaper,
      "data-lg-pane-glass": appearance.paneGlass ? "on" : "off",
      "data-lg-compact-solid": appearance.compactSolidPanes ? "on" : "off",
    },
  };
}

/** Every key `resolveVars` can produce, so dispose can remove all of them. */
export const MANAGED_VARS = [
  "--lg-hue",
  "--lg-sat",
  "--lg-accent-h",
  "--lg-accent-s",
  "--lg-accent-l",
  "--lg-primary-fg-l",
  "--lg-sidebar-a",
  "--lg-pane-a",
  "--lg-blur",
  "--lg-pane-blur",
  "--lg-overlay-a",
  "--lg-chrome-a",
  "--lg-chrome-fade",
  "--lg-chrome-blur",
  "--lg-wp-brightness",
  "--lg-wp-blur",
  "--lg-wp-sat",
  "--lg-dim",
  "--lg-vibrancy",
  "--lg-wallpaper-custom",
] as const;

export const MANAGED_ATTRIBUTES = [
  "data-lg-wallpaper",
  "data-lg-pane-glass",
  "data-lg-compact-solid",
] as const;

/**
 * The CSS image for a custom wallpaper: the user's URL, or the plugin's own
 * bounded wallpaper route for a local file. Returns null when `wallpaper` is a
 * preset or when neither source is set, so the caller falls back to a preset
 * rather than painting a broken image.
 *
 * The route serves whichever path is stored, so its URL is byte-identical from
 * one image to the next and the browser would keep the cached picture. The
 * server's `updatedAt` rides along as `?v=` to break that cache; the route
 * itself ignores the query, so the parameter can never select a file.
 */
export function customWallpaperImage(
  appearance: Appearance,
  updatedAt = 0,
): string | null {
  if (appearance.wallpaper !== "custom") return null;
  const url = appearance.wallpaperUrl?.trim();
  if (url) {
    if (!/^https?:\/\//i.test(url)) return null;
    return `url("${url.replace(/["\\]/g, "")}")`;
  }
  if (appearance.wallpaperPath?.trim()) {
    const version = Number.isFinite(updatedAt) ? Math.max(0, Math.round(updatedAt)) : 0;
    return `url("/api/v1/plugins/liquid-glass/http/wallpaper?v=${version}")`;
  }
  return null;
}
