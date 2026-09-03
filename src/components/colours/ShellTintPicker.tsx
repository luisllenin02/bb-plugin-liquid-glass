import type { Appearance } from "../../appearance.js";
import { hexToHsl, hslToHex } from "../../lib/color.js";
import { cn } from "../../lib/utils.js";
import { CustomColourControl } from "./CustomColourControl.js";
import { Subsection } from "./Section.js";
import { WALLPAPER_PREVIEWS } from "./WallpaperCards.js";

const SHELL_TINTS = [
  { name: "Neutral", hue: 240, saturation: 0 },
  { name: "Slate", hue: 215, saturation: 18 },
  { name: "Graphite", hue: 220, saturation: 8 },
  { name: "Warm", hue: 25, saturation: 16 },
  { name: "Sepia", hue: 38, saturation: 30 },
  { name: "Ocean", hue: 205, saturation: 28 },
  { name: "Forest", hue: 145, saturation: 24 },
  { name: "Plum", hue: 285, saturation: 22 },
] as const;

export function ShellTintPicker({
  appearance,
  light,
  onChange,
}: {
  appearance: Appearance;
  light: boolean;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  const currentHex = hslToHex({ h: appearance.hue, s: appearance.saturation, l: 50 });
  const wallpaper = appearance.wallpaper === "custom" ? "aurora" : appearance.wallpaper;

  return (
    <Subsection
      title="Shell tint"
      hint="A quiet cast over the shell; Neutral is monocode's hue 240 / 0%."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SHELL_TINTS.map((tint) => {
          const selected =
            Math.round(appearance.hue) === tint.hue &&
            Math.round(appearance.saturation) === tint.saturation;
          return (
            <button
              key={tint.name}
              type="button"
              aria-label={`Shell ${tint.name}`}
              aria-pressed={selected}
              onClick={() => onChange({ hue: tint.hue, saturation: tint.saturation })}
              className={cn(
                "overflow-hidden rounded-lg border p-1.5 text-left transition-transform",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:scale-[1.02]",
              )}
            >
              <span
                aria-hidden
                className="flex h-10 overflow-hidden rounded-md"
                style={{ background: WALLPAPER_PREVIEWS[wallpaper] }}
              >
                <span
                  className="w-1/3 border-r border-border"
                  style={{
                    backgroundColor: `hsl(${tint.hue} ${tint.saturation}% ${
                      light ? 97 : 9
                    }% / ${appearance.sidebarOpacity})`,
                  }}
                />
                <span
                  className="flex-1"
                  style={{
                    backgroundColor: `hsl(${tint.hue} ${tint.saturation}% ${
                      light ? 97 : 9
                    }% / ${appearance.paneOpacity})`,
                  }}
                />
              </span>
              <span className="mt-1 block text-xs text-foreground">{tint.name}</span>
            </button>
          );
        })}
      </div>
      <CustomColourControl
        label="Shell custom"
        value={currentHex}
        onChange={(hex) => {
          const hsl = hexToHsl(hex);
          onChange({ hue: Math.round(hsl.h), saturation: Math.round(hsl.s) });
        }}
      />
    </Subsection>
  );
}
