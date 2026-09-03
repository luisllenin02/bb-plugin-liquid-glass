import { useState } from "react";

import { WALLPAPER_PRESETS, type Appearance } from "../../appearance.js";
import { cn } from "../../lib/utils.js";
import { ActionButton, Row, TextField } from "../rows.js";

export const WALLPAPER_PREVIEWS: Record<(typeof WALLPAPER_PRESETS)[number], string> = {
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

export function WallpaperCards({
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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {WALLPAPER_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={preset}
            aria-pressed={appearance.wallpaper === preset}
            onClick={() => onChange({ wallpaper: preset })}
            className={cn(
              "overflow-hidden rounded-lg border p-1.5 text-left transition-transform",
              appearance.wallpaper === preset
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:scale-[1.02]",
            )}
          >
            <span
              aria-hidden
              className="block h-14 rounded-md"
              style={{ background: WALLPAPER_PREVIEWS[preset] }}
            />
            <span className="mt-1 block text-xs capitalize text-foreground">{preset}</span>
          </button>
        ))}
        <button
          type="button"
          aria-label="custom"
          aria-pressed={appearance.wallpaper === "custom"}
          onClick={() => onChange({ wallpaper: "custom" })}
          className={cn(
            "rounded-lg border p-1.5 text-left transition-colors",
            appearance.wallpaper === "custom"
              ? "border-primary ring-1 ring-primary"
              : "border-border",
          )}
        >
          <span className="grid h-14 place-items-center rounded-md bg-muted text-xs text-muted-foreground">
            URL / file
          </span>
          <span className="mt-1 block text-xs text-foreground">Custom</span>
        </button>
      </div>
      <Row label="Wallpaper URL" description="An https:// image. Used when Wallpaper is set to Custom.">
        <TextField
          label="Wallpaper URL"
          value={appearance.wallpaperUrl ?? ""}
          placeholder="https://…"
          onCommit={(next) =>
            onChange({ wallpaperUrl: next.trim() === "" ? null : next.trim() })
          }
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
    </div>
  );
}
