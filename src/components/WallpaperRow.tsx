/**
 * The Wallpaper row: five preset thumbnails drawn as CSS gradients, a URL
 * field, a local-path field with a Test button that hits the plugin's bounded
 * wallpaper route, and the dim slider that sits over whichever is chosen.
 */
import { useState } from "react";

import { RANGES, WALLPAPER_PRESETS, type Appearance } from "../appearance.js";
import { cn } from "../lib/utils.js";
import { ActionButton, Row, Slider, TextField } from "./rows.js";

/** Thumbnail approximations of the presets in themes/liquid-glass*.css. */
const PREVIEWS: Record<(typeof WALLPAPER_PRESETS)[number], string> = {
  aurora:
    "radial-gradient(120% 120% at 15% 10%, hsl(178 85% 45%), transparent 60%), radial-gradient(120% 120% at 85% 85%, hsl(318 85% 58%), transparent 60%), linear-gradient(160deg, hsl(215 60% 22%), hsl(272 70% 38%))",
  forest:
    "radial-gradient(120% 120% at 10% 10%, hsl(202 90% 58%), transparent 60%), linear-gradient(170deg, hsl(150 55% 22%), hsl(142 70% 34%))",
  sunset:
    "radial-gradient(120% 120% at 20% 90%, hsl(12 90% 58%), transparent 62%), linear-gradient(200deg, hsl(288 60% 40%), hsl(38 95% 58%))",
  ocean:
    "radial-gradient(120% 120% at 15% 10%, hsl(196 95% 55%), transparent 62%), linear-gradient(165deg, hsl(214 70% 22%), hsl(172 80% 40%))",
  mono: "linear-gradient(170deg, hsl(0 0% 62%), hsl(0 0% 22%))",
};

export function WallpaperRow({
  appearance,
  onChange,
  onTestPath,
}: {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
  onTestPath: (path: string) => Promise<{ ok: boolean; detail: string }>;
}) {
  const [testResult, setTestResult] = useState<string | null>(null);

  return (
    <>
      <Row
        label="Wallpaper"
        description="Painted on the window floor, behind every translucent pane."
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {WALLPAPER_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset}
              aria-pressed={appearance.wallpaper === preset}
              onClick={() => onChange({ wallpaper: preset })}
              className={cn(
                "h-8 w-12 rounded-md border transition-transform",
                appearance.wallpaper === preset
                  ? "border-primary scale-105"
                  : "border-border",
              )}
              style={{ background: PREVIEWS[preset] }}
            />
          ))}
          <button
            type="button"
            aria-label="custom"
            aria-pressed={appearance.wallpaper === "custom"}
            onClick={() => onChange({ wallpaper: "custom" })}
            className={cn(
              "h-8 w-12 rounded-md border text-2xs text-muted-foreground transition-colors",
              appearance.wallpaper === "custom"
                ? "border-primary text-foreground"
                : "border-border",
            )}
          >
            Custom
          </button>
        </div>
      </Row>
      <Row
        label="Wallpaper URL"
        description="An https:// image. Used when Wallpaper is set to Custom."
      >
        <TextField
          label="Wallpaper URL"
          value={appearance.wallpaperUrl ?? ""}
          placeholder="https://…"
          onCommit={(next) => onChange({ wallpaperUrl: next.trim() === "" ? null : next.trim() })}
        />
      </Row>
      <Row
        label="Wallpaper file"
        description="An absolute path on the bb server, up to 20 MB, png/jpg/webp/avif/gif. Used when no URL is set."
      >
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <TextField
              label="Wallpaper file"
              value={appearance.wallpaperPath ?? ""}
              placeholder="/home/…/wallpaper.jpg"
              onCommit={(next) =>
                onChange({ wallpaperPath: next.trim() === "" ? null : next.trim() })
              }
            />
            <ActionButton
              onClick={() => {
                void onTestPath(appearance.wallpaperPath ?? "").then((result) =>
                  setTestResult(result.detail),
                );
              }}
            >
              Test
            </ActionButton>
          </div>
          {testResult ? (
            <span className="text-2xs text-muted-foreground">{testResult}</span>
          ) : null}
        </div>
      </Row>
      <Row
        label="Wallpaper brightness"
        description="Brightens or darkens the wallpaper itself; extremes can reduce contrast through transparent panes."
      >
        <Slider
          label="Wallpaper brightness"
          value={Math.round(appearance.wallpaperBrightness * 100)}
          display={`${Math.round(appearance.wallpaperBrightness * 100)}%`}
          min={Math.round(RANGES.wallpaperBrightness.min * 100)}
          max={Math.round(RANGES.wallpaperBrightness.max * 100)}
          onChange={(percent) => onChange({ wallpaperBrightness: percent / 100 })}
        />
      </Row>
      <Row
        label="Wallpaper blur"
        description="Softens detail in the wallpaper before pane glass is applied; higher values cost more to composite."
      >
        <Slider
          label="Wallpaper blur"
          value={Math.round(appearance.wallpaperBlur)}
          display={String(Math.round(appearance.wallpaperBlur))}
          min={RANGES.wallpaperBlur.min}
          max={RANGES.wallpaperBlur.max}
          onChange={(wallpaperBlur) => onChange({ wallpaperBlur })}
        />
      </Row>
      <Row
        label="Wallpaper saturation"
        description="Controls wallpaper colour intensity without changing the interface accent."
      >
        <Slider
          label="Wallpaper saturation"
          value={Math.round(appearance.wallpaperSaturation * 100)}
          display={`${Math.round(appearance.wallpaperSaturation * 100)}%`}
          min={Math.round(RANGES.wallpaperSaturation.min * 100)}
          max={Math.round(RANGES.wallpaperSaturation.max * 100)}
          onChange={(percent) => onChange({ wallpaperSaturation: percent / 100 })}
        />
      </Row>
      <Row
        label="Wallpaper dim"
        description="How far the wallpaper is pushed back before the panes go over it."
      >
        <Slider
          label="Wallpaper dim"
          value={Math.round(appearance.dim * 100)}
          display={`${Math.round(appearance.dim * 100)}%`}
          min={Math.round(RANGES.dim.min * 100)}
          max={Math.round(RANGES.dim.max * 100)}
          onChange={(percent) => onChange({ dim: percent / 100 })}
        />
      </Row>
    </>
  );
}
