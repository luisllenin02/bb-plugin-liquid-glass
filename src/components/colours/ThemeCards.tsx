import { useState } from "react";

import type { Appearance } from "../../appearance.js";
import { hslToHex } from "../../lib/color.js";
import { cn } from "../../lib/utils.js";
import { WALLPAPER_PREVIEWS } from "./WallpaperCards.js";

const THEMES = [
  {
    id: "liquid-glass",
    name: "Liquid Glass",
    note: "Deep neutral glass with bright text and vibrant accents.",
    light: false,
  },
  {
    id: "liquid-glass-light",
    name: "Liquid Glass Light",
    note: "Pale glass with dark ink and the same wallpaper controls.",
    light: true,
  },
] as const;

function ThemePreview({
  appearance,
  light,
}: {
  appearance: Appearance;
  light: boolean;
}) {
  const wallpaper = appearance.wallpaper === "custom" ? "aurora" : appearance.wallpaper;
  const accent = hslToHex({
    h: appearance.accentHue,
    s: appearance.accentSaturation,
    l: appearance.accentLightness,
  });
  const shell = `hsl(${appearance.hue} ${appearance.saturation}% ${
    light ? 97 : 9
  }% / ${appearance.sidebarOpacity})`;
  const pane = `hsl(${appearance.hue} ${appearance.saturation}% ${
    light ? 97 : 9
  }% / ${appearance.paneOpacity})`;

  return (
    <span
      aria-hidden
      className="flex h-16 w-28 shrink-0 overflow-hidden rounded-md border border-border"
      style={{ background: WALLPAPER_PREVIEWS[wallpaper] }}
    >
      <span className="flex w-7 flex-col items-center gap-1 pt-2" style={{ background: shell }}>
        {[0.7, 1, 0.6].map((opacity, index) => (
          <span
            key={opacity}
            className="size-1.5 rounded-full"
            style={{ backgroundColor: accent, opacity, marginLeft: index === 1 ? 6 : 0 }}
          />
        ))}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-2" style={{ background: pane }}>
        <span className="h-1 w-8 rounded-full" style={{ backgroundColor: accent }} />
        <span className="h-1 w-12 rounded-full bg-foreground/40" />
        <span className="h-1 w-9 rounded-full bg-foreground/25" />
      </span>
    </span>
  );
}

export function ThemeCards({
  appearance,
  activeThemeId,
  onApply,
}: {
  appearance: Appearance;
  activeThemeId: string | null;
  onApply: (id: (typeof THEMES)[number]["id"]) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {THEMES.map((theme) => {
        const active = activeThemeId === `plugin:liquid-glass:${theme.id}`;
        return (
          <div
            key={theme.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border p-3",
              active ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <ThemePreview appearance={appearance} light={theme.light} />
            <div className="min-w-36 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{theme.name}</span>
                {active ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-2xs text-secondary-foreground">
                    Active
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{theme.note}</p>
            </div>
            {!active ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setBusy(theme.id);
                  void onApply(theme.id).finally(() => setBusy(null));
                }}
                className="ml-auto rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground hover:bg-accent disabled:opacity-50"
              >
                {busy === theme.id ? "Applying…" : "Apply"}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
