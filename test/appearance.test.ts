import { describe, expect, it } from "vitest";

import { contrastRatio, hslToRgb } from "./color.mjs";
import {
  ACCENT_SWATCHES,
  DEFAULT_APPEARANCE,
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
      "--lg-pane-blur": "24px",
      "--lg-overlay-a": "0.94",
      "--lg-chrome-a": "0.72",
      "--lg-chrome-fade": "40px",
      "--lg-chrome-blur": "20px",
      "--lg-wp-brightness": "1",
      "--lg-wp-blur": "0px",
      "--lg-wp-sat": "1.1",
      "--lg-dim": "0.35",
      "--lg-vibrancy": "70",
    });
    expect(attributes).toEqual({
      "data-lg-wallpaper": "aurora",
      "data-lg-pane-glass": "on",
      "data-lg-compact-solid": "on",
    });
    for (const name of Object.keys(vars)) {
      expect(MANAGED_VARS).toContain(name as (typeof MANAGED_VARS)[number]);
    }
  });

  it("turns the pane-glass toggle off", () => {
    const { attributes } = resolveVars(
      { ...DEFAULT_APPEARANCE, paneGlass: false },
      "dark",
    );
    expect(attributes["data-lg-pane-glass"]).toBe("off");
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
