import { ACCENT_SWATCHES, RANGES, type Appearance, type Palette } from "../../appearance.js";
import {
  appearancePatchFromHex,
  generateHueRamps,
  hslToHex,
} from "../../lib/color.js";
import { cn } from "../../lib/utils.js";
import { Row, Slider } from "../rows.js";
import { CustomColourControl } from "./CustomColourControl.js";
import { Subsection } from "./Section.js";

/**
 * Mirrors the contrast clamp in ../../appearance.ts's (unexported) resolveAccent,
 * so the brightness slider can show the same reachable band and effective value
 * the theme actually renders, without editing that file.
 */
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

/** Every accentLightness step (within RANGES.accentLightness) that clears the 4.5:1 contrast floor against the canvas. */
function reachableAccentSteps(hue: number, saturation: number, palette: Palette): number[] {
  const canvas = hslToRgb(hue, saturation, CANVAS_LIGHTNESS[palette]);
  const steps: number[] = [];
  for (let l = RANGES.accentLightness.min; l <= RANGES.accentLightness.max; l += 1) {
    if (contrast(hslToRgb(hue, saturation, l), canvas) >= 4.5) steps.push(l);
  }
  return steps;
}

/** The readable band the theme actually draws from, for the slider's min/max. */
export function reachableAccentBand(
  hue: number,
  saturation: number,
  palette: Palette,
): { min: number; max: number } {
  const steps = reachableAccentSteps(hue, saturation, palette);
  if (steps.length === 0) {
    const fallback = palette === "dark" ? RANGES.accentLightness.max : RANGES.accentLightness.min;
    return { min: fallback, max: fallback };
  }
  return { min: steps[0]!, max: steps[steps.length - 1]! };
}

/** The value resolveAccent would actually render for a requested lightness. */
export function effectiveAccentLightness(
  hue: number,
  saturation: number,
  requested: number,
  palette: Palette,
): number {
  const canvas = hslToRgb(hue, saturation, CANVAS_LIGHTNESS[palette]);
  const candidates = Array.from(
    { length: RANGES.accentLightness.max - RANGES.accentLightness.min + 1 },
    (_, index) => RANGES.accentLightness.min + index,
  ).sort((a, b) => Math.abs(a - requested) - Math.abs(b - requested));
  return (
    candidates.find((candidate) => contrast(hslToRgb(hue, saturation, candidate), canvas) >= 4.5) ??
    (palette === "dark" ? RANGES.accentLightness.max : RANGES.accentLightness.min)
  );
}

const MONOKAI_SWATCHES = [
  { name: "Green", hex: "#a6e22e" },
  { name: "Yellow", hex: "#e6db74" },
  { name: "Orange", hex: "#fd971f" },
  { name: "Pink", hex: "#f92672" },
  { name: "Purple", hex: "#ae81ff" },
  { name: "Cyan", hex: "#66d9ef" },
] as const;

const RAMPS = generateHueRamps();

function SwatchButton({
  name,
  hex,
  selected,
  onPick,
}: {
  name: string;
  hex: string;
  selected: boolean;
  onPick: (hex: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={selected}
      onClick={() => onPick(hex)}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-sm border border-border"
        style={{ backgroundColor: hex }}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{hex}</span>
    </button>
  );
}

function HueRampRow({
  name,
  steps,
  current,
  onPick,
}: {
  name: string;
  steps: ReadonlyArray<{ hex: string }>;
  current: string;
  onPick: (hex: string) => void;
}) {
  const selectedIndex = steps.findIndex((step) => step.hex === current);
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs text-muted-foreground">{name}</span>
      <div
        role="radiogroup"
        aria-label={`${name} shades`}
        className="flex h-9 flex-1 overflow-hidden rounded-md"
      >
        {steps.map((step, index) => {
          const selected = step.hex === current;
          return (
            <button
              key={step.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${name} ${step.hex}`}
              tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
              title={`${name} ${step.hex}`}
              onClick={() => onPick(step.hex)}
              onKeyDown={(event) => {
                const buttons = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    '[role="radio"]',
                  ) ?? [],
                );
                let next = index;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") next += 1;
                else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next -= 1;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = buttons.length - 1;
                else return;
                event.preventDefault();
                const resolved = (next + buttons.length) % buttons.length;
                buttons[resolved]?.focus();
                const nextStep = steps[resolved];
                if (nextStep) onPick(nextStep.hex);
              }}
              className={cn(
                "group relative flex-1 outline-none transition-[flex-grow] duration-200 ease-out hover:flex-[1.6] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "z-10 ring-2 ring-inset ring-foreground" : "",
              )}
              style={{ backgroundColor: step.hex }}
            >
              <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-background/60 font-mono text-[9px] text-foreground group-hover:flex group-focus-visible:flex">
                {step.hex}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AccentPicker({
  appearance,
  palette,
  onChange,
}: {
  appearance: Appearance;
  palette: Palette;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  const current = hslToHex({
    h: appearance.accentHue,
    s: appearance.accentSaturation,
    l: appearance.accentLightness,
  });
  const pick = (hex: string) => onChange(appearancePatchFromHex(hex));
  const paletteSwatches = ACCENT_SWATCHES.map((swatch) => ({
    ...swatch,
    hex: hslToHex({ h: swatch.hue, s: swatch.saturation, l: swatch.lightness }),
  }));

  const band = reachableAccentBand(appearance.accentHue, appearance.accentSaturation, palette);
  const effective = effectiveAccentLightness(
    appearance.accentHue,
    appearance.accentSaturation,
    appearance.accentLightness,
    palette,
  );

  return (
    <Subsection
      title="Accent colour"
      hint="Links, focus rings, selected rows and the focused-thread rail."
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {paletteSwatches.map((swatch) => (
          <SwatchButton
            key={swatch.name}
            name={swatch.name}
            hex={swatch.hex}
            selected={swatch.hex === current}
            onPick={() =>
              onChange({
                accentHue: swatch.hue,
                accentSaturation: swatch.saturation,
                accentLightness: swatch.lightness,
              })
            }
          />
        ))}
      </div>
      <p className="text-2xs text-muted-foreground">
        Monokai vivid · classic Monokai theme CSS
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {MONOKAI_SWATCHES.map((swatch) => (
          <SwatchButton
            key={`monokai-${swatch.name}`}
            name={`Monokai ${swatch.name}`}
            hex={swatch.hex}
            selected={swatch.hex === current}
            onPick={pick}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {RAMPS.map((ramp) => (
          <HueRampRow
            key={ramp.name}
            name={ramp.name}
            steps={ramp.steps}
            current={current}
            onPick={pick}
          />
        ))}
      </div>
      <CustomColourControl label="Accent custom" value={current} onChange={pick} />
      <Row label="Accent hue" description="Fine-tune the selected accent hue.">
        <Slider
          label="Accent hue"
          value={Math.round(appearance.accentHue)}
          display={`${Math.round(appearance.accentHue)}°`}
          min={RANGES.accentHue.min}
          max={RANGES.accentHue.max}
          onChange={(accentHue) => onChange({ accentHue })}
        />
      </Row>
      <Row label="Accent saturation" description="Fine-tune accent vividness.">
        <Slider
          label="Accent saturation"
          value={Math.round(appearance.accentSaturation)}
          display={`${Math.round(appearance.accentSaturation)}%`}
          min={RANGES.accentSaturation.min}
          max={RANGES.accentSaturation.max}
          onChange={(accentSaturation) => onChange({ accentSaturation })}
        />
      </Row>
      <Row
        label="Accent brightness"
        description="How light the accent is. Values outside the readable band snap to the nearest readable one."
      >
        <Slider
          label="Accent brightness"
          value={effective}
          display={`${effective}%`}
          min={band.min}
          max={band.max}
          onChange={(accentLightness) => onChange({ accentLightness })}
        />
      </Row>
    </Subsection>
  );
}
