import { describe, expect, it } from "vitest";

import { contrastRatio, hslToRgb } from "./color.mjs";
import {
  ACCENT_SWATCHES,
  DEFAULT_APPEARANCE,
  MANAGED_ATTRIBUTES,
  MANAGED_VARS,
  customWallpaperImage,
  normalize,
  paletteForThemeId,
  resolveVars,
} from "../src/appearance.js";

const percent = (value: string) => Number.parseFloat(value);

describe("palette resolution", () => {
  it("maps only this plugin's theme ids", () => {
    expect(paletteForThemeId("plugin:liquid-glass:liquid-glass")).toBe("dark");
    expect(paletteForThemeId("plugin:liquid-glass:liquid-glass-light")).toBe("light");
    expect(paletteForThemeId("plugin:vercel-theme:vercel")).toBeNull();
    expect(paletteForThemeId("nord")).toBeNull();
    expect(paletteForThemeId(null)).toBeNull();
  });
});

describe("contrast-aware accent resolution", () => {
  const customBoundaries = [
    { name: "custom achromatic minimum", hue: 0, saturation: 0, lightness: 20 },
    { name: "custom red maximum", hue: 360, saturation: 100, lightness: 85 },
    { name: "custom yellow", hue: 60, saturation: 100, lightness: 50 },
    { name: "custom cyan", hue: 180, saturation: 100, lightness: 50 },
  ];

  it.each(["dark", "light"] as const)(
    "%s palette clears 4.5:1 for every swatch and custom boundary",
    (palette) => {
      for (const choice of [...ACCENT_SWATCHES, ...customBoundaries]) {
        const appearance = {
          ...DEFAULT_APPEARANCE,
          accentHue: choice.hue,
          accentSaturation: choice.saturation,
          accentLightness: choice.lightness,
        };
        const vars = resolveVars(appearance, palette).vars;
        const accent = hslToRgb(
          Number(vars["--lg-accent-h"]),
          percent(vars["--lg-accent-s"]),
          percent(vars["--lg-accent-l"]),
        );
        const canvas = hslToRgb(
          Number(vars["--lg-hue"]),
          percent(vars["--lg-sat"]),
          palette === "dark" ? 9 : 97,
        );
        const foreground = hslToRgb(0, 0, percent(vars["--lg-primary-fg-l"]));
        expect(
          contrastRatio(accent, canvas),
          `${palette} ${choice.name} primary on canvas`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(foreground, accent),
          `${palette} ${choice.name} foreground on primary`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("preserves an already-accessible accent and adjusts only when needed", () => {
    const dark = resolveVars(DEFAULT_APPEARANCE, "dark");
    expect(dark.vars["--lg-accent-l"]).toBe("62%");
    const light = resolveVars(DEFAULT_APPEARANCE, "light");
    expect(light.vars["--lg-accent-l"]).toBe("45%");
    expect(light.vars["--lg-primary-fg-l"]).toBe("100%");
  });
});

describe("resolveVars", () => {
  it("emits every managed variable with monocode's defaults", () => {
    const { vars, attributes } = resolveVars(DEFAULT_APPEARANCE, "dark");
    expect(vars).toMatchObject({
      "--lg-hue": "240",
      "--lg-sat": "0%",
      "--lg-accent-h": "211",
      "--lg-accent-s": "92%",
      "--lg-accent-l": "62%",
      "--lg-primary-fg-l": "0%",
      "--lg-sidebar-a": "0.85",
      "--lg-pane-a": "0.85",
      "--lg-blur": "24px",
      "--lg-overlay-a": "0.94",
      "--lg-chrome-a": "0.72",
      "--lg-chrome-fade": "40px",
      "--lg-chrome-blur": "20px",
      "--lg-composer-idle-a": "0.6",
      "--lg-composer-focus-a": "1",
      "--lg-wp-brightness": "1",
      "--lg-wp-blur": "24px",
      "--lg-wp-sat": "1.1",
      "--lg-dim": "0.35",
      "--lg-vibrancy": "70",
    });
    expect(attributes).toEqual({
      "data-lg-wallpaper": "aurora",
      "data-lg-compact-solid": "on",
    });
    for (const name of Object.keys(vars)) {
      expect(MANAGED_VARS).toContain(name as (typeof MANAGED_VARS)[number]);
    }
  });

  it("emits no variable or attribute for the retired pane-glass knobs", () => {
    const { vars, attributes } = resolveVars(DEFAULT_APPEARANCE, "dark");
    expect(vars).not.toHaveProperty("--lg-pane-blur");
    expect(attributes).not.toHaveProperty("data-lg-pane-glass");
    expect(MANAGED_VARS).not.toContain("--lg-pane-blur" as never);
    expect(MANAGED_ATTRIBUTES).not.toContain("data-lg-pane-glass" as never);
  });

  it("falls back to a preset when custom is selected with no usable source", () => {
    const { vars, attributes } = resolveVars(
      { ...DEFAULT_APPEARANCE, wallpaper: "custom" },
      "dark",
    );
    expect(attributes["data-lg-wallpaper"]).toBe("aurora");
    expect(vars["--lg-wallpaper-custom"]).toBeUndefined();
  });

  it("serves a local wallpaper through the plugin route, not the raw path", () => {
    const { vars, attributes } = resolveVars(
      { ...DEFAULT_APPEARANCE, wallpaper: "custom", wallpaperPath: "/tmp/a.png" },
      "dark",
      1_712_000_000_000,
    );
    expect(attributes["data-lg-wallpaper"]).toBe("custom");
    expect(vars["--lg-wallpaper-custom"]).toBe(
      'url("/api/v1/plugins/liquid-glass/http/wallpaper?v=1712000000000")',
    );
  });

  it("MANAGED_VARS matches exactly the keys resolveVars can produce", () => {
    // Only a custom wallpaper backed by a local path adds `--lg-wallpaper-custom`;
    // this is the one call that exercises every key at once.
    const { vars } = resolveVars(
      { ...DEFAULT_APPEARANCE, wallpaper: "custom", wallpaperPath: "/tmp/a.png" },
      "dark",
      1,
    );
    expect(Object.keys(vars).sort()).toEqual([...MANAGED_VARS].sort());
  });

  it("changes the wallpaper URL when the server's updatedAt moves", () => {
    const local = {
      ...DEFAULT_APPEARANCE,
      wallpaper: "custom" as const,
      wallpaperPath: "/tmp/a.png",
    };
    // Same path, different write: the route URL has to differ or the browser
    // keeps painting the picture it already cached.
    const first = resolveVars(local, "dark", 1).vars["--lg-wallpaper-custom"];
    const second = resolveVars({ ...local, wallpaperPath: "/tmp/b.png" }, "dark", 2)
      .vars["--lg-wallpaper-custom"];
    expect(first).toBe('url("/api/v1/plugins/liquid-glass/http/wallpaper?v=1")');
    expect(second).toBe('url("/api/v1/plugins/liquid-glass/http/wallpaper?v=2")');
    expect(second).not.toBe(first);
  });
});

describe("customWallpaperImage", () => {
  it("accepts an https url and rejects other schemes", () => {
    expect(
      customWallpaperImage({
        ...DEFAULT_APPEARANCE,
        wallpaper: "custom",
        wallpaperUrl: "https://example.test/a.jpg",
      }),
    ).toBe('url("https://example.test/a.jpg")');
    expect(
      customWallpaperImage({
        ...DEFAULT_APPEARANCE,
        wallpaper: "custom",
        wallpaperUrl: "javascript:alert(1)",
      }),
    ).toBeNull();
    expect(
      customWallpaperImage({
        ...DEFAULT_APPEARANCE,
        wallpaper: "custom",
        wallpaperUrl: 'file:///etc/passwd"); background: url("x',
      }),
    ).toBeNull();
  });

  it("defaults the cache-buster to 0 and rounds a non-integer stamp", () => {
    const local = {
      ...DEFAULT_APPEARANCE,
      wallpaper: "custom" as const,
      wallpaperPath: "/tmp/a.png",
    };
    expect(customWallpaperImage(local)).toBe(
      'url("/api/v1/plugins/liquid-glass/http/wallpaper?v=0")',
    );
    expect(customWallpaperImage(local, 12.7)).toBe(
      'url("/api/v1/plugins/liquid-glass/http/wallpaper?v=13")',
    );
    expect(customWallpaperImage(local, Number.NaN)).toBe(
      'url("/api/v1/plugins/liquid-glass/http/wallpaper?v=0")',
    );
  });
});

describe("normalize", () => {
  it("migrates a partial old row and rejects an out-of-range one", () => {
    expect(normalize({ blur: 40 })).toEqual({ ...DEFAULT_APPEARANCE, blur: 40 });
    expect(normalize({ blur: 4000 })).toEqual(DEFAULT_APPEARANCE);
    expect(normalize(undefined)).toEqual(DEFAULT_APPEARANCE);
  });
});

/**
 * `paneBlur` was added into the same `blur()` as `wallpaperBlur`, and
 * `paneGlass: false` zeroed that contribution while pinning the main pane at
 * 0.96. The migration has to land on exactly the pixels the old row rendered.
 */
describe("the retired paneBlur/paneGlass migration", () => {
  /** What the old stylesheet put in `blur()` for a stored row. */
  const renderedBlur = (row: { wallpaperBlur?: number; paneBlur?: number; paneGlass?: boolean }) =>
    (row.wallpaperBlur ?? 0) + (row.paneGlass === false ? 0 : (row.paneBlur ?? 24));

  const storedRow = {
    hue: 240,
    saturation: 0,
    accentHue: 338.38862559241704,
    accentSaturation: 94.61883408071749,
    accentLightness: 56.27450980392157,
    sidebarOpacity: 0.15,
    paneGlass: true,
    blur: 1,
    paneOpacity: 0.23,
    paneBlur: 12,
    overlayOpacity: 0.85,
    chromeOpacity: 0,
    chromeFade: 13,
    chromeBlur: 10,
    composerIdleOpacity: 0.44,
    composerFocusOpacity: 0.75,
    compactSolidPanes: false,
    wallpaper: "custom" as const,
    wallpaperUrl: null,
    wallpaperPath: "/home/pictures/wall.jpeg",
    wallpaperBrightness: 0.87,
    wallpaperBlur: 0,
    wallpaperSaturation: 0.73,
    dim: 0.15,
    interactiveVibrancy: 100,
  };

  it("folds paneBlur into wallpaperBlur and drops both retired keys", () => {
    const migrated = normalize(storedRow);
    expect(migrated.wallpaperBlur).toBe(renderedBlur(storedRow));
    expect(migrated.wallpaperBlur).toBe(12);
    expect(migrated).not.toHaveProperty("paneBlur");
    expect(migrated).not.toHaveProperty("paneGlass");
  });

  it("round-trips a pre-migration row to identical rendered vars", () => {
    for (const palette of ["dark", "light"] as const) {
      const { vars, attributes } = resolveVars(normalize(storedRow), palette, 7);
      // Every var the old row rendered, at the value it rendered it at. The
      // wallpaper blur is the sum the two old knobs always fed one `blur()`.
      expect(vars["--lg-wp-blur"]).toBe(`${renderedBlur(storedRow)}px`);
      expect(vars["--lg-pane-a"]).toBe("0.23");
      expect(vars["--lg-blur"]).toBe("1px");
      expect(vars["--lg-overlay-a"]).toBe("0.85");
      expect(vars["--lg-sidebar-a"]).toBe("0.15");
      expect(vars["--lg-chrome-a"]).toBe("0");
      expect(vars["--lg-chrome-fade"]).toBe("13px");
      expect(vars["--lg-chrome-blur"]).toBe("10px");
      expect(vars["--lg-composer-idle-a"]).toBe("0.44");
      expect(vars["--lg-composer-focus-a"]).toBe("0.75");
      expect(vars["--lg-wp-brightness"]).toBe("0.87");
      expect(vars["--lg-wp-sat"]).toBe("0.73");
      expect(vars["--lg-dim"]).toBe("0.15");
      expect(vars["--lg-vibrancy"]).toBe("100");
      expect(attributes["data-lg-compact-solid"]).toBe("off");
      expect(attributes["data-lg-wallpaper"]).toBe("custom");
    }
  });

  it("normalizing twice is a no-op", () => {
    const once = normalize(storedRow);
    expect(normalize(once)).toEqual(once);
  });

  it("pins the pane at 0.96 and drops the pane blur when glass was off", () => {
    const off = { ...storedRow, paneGlass: false };
    const migrated = normalize(off);
    expect(migrated.paneOpacity).toBe(0.96);
    expect(migrated.wallpaperBlur).toBe(renderedBlur(off));
    expect(migrated.wallpaperBlur).toBe(0);
    expect(resolveVars(migrated, "dark").vars["--lg-pane-a"]).toBe("0.96");
  });

  it("keeps a fresh install rendering the old default total", () => {
    // Old: wallpaperBlur 0 + paneBlur 24. New: wallpaperBlur 24, one knob.
    expect(DEFAULT_APPEARANCE.wallpaperBlur).toBe(renderedBlur({}));
    expect(resolveVars(DEFAULT_APPEARANCE, "dark").vars["--lg-wp-blur"]).toBe("24px");
  });

  it("migrates a row that carries only one of the retired keys", () => {
    // paneGlass alone: the pane blur it gated was still at its old default.
    expect(normalize({ paneGlass: true }).wallpaperBlur).toBe(24);
    expect(normalize({ paneGlass: false }).wallpaperBlur).toBe(0);
    expect(normalize({ paneGlass: false }).paneOpacity).toBe(0.96);
    // paneBlur alone: glass was on by default, so it still adds.
    expect(normalize({ paneBlur: 40, wallpaperBlur: 0 }).wallpaperBlur).toBe(40);
  });

  it("caps a migrated sum at the wallpaper blur range instead of failing the row", () => {
    // A rejected row falls back to the defaults wholesale, which would reset
    // every other knob the user set; clamping keeps the rest of the row.
    const migrated = normalize({ ...storedRow, wallpaperBlur: 40, paneBlur: 64 });
    // 104px asked; the merged knob's ceiling is the old pane-blur ceiling, 64.
    expect(migrated.wallpaperBlur).toBe(64);
    expect(migrated.paneOpacity).toBe(0.23);
    expect(migrated.dim).toBe(0.15);
  });

  it("never lets a retired or unknown key reset another value to its default", () => {
    const migrated = normalize({ ...storedRow, someRetiredKnob: 3 });
    expect(migrated.sidebarOpacity).toBe(0.15);
    expect(migrated.blur).toBe(1);
    expect(migrated.overlayOpacity).toBe(0.85);
    expect(migrated.wallpaperBlur).toBe(12);
  });

  it("leaves a new-format row alone", () => {
    const current = { ...DEFAULT_APPEARANCE, wallpaperBlur: 10, paneOpacity: 0.4 };
    expect(normalize(current)).toEqual(current);
  });
});
