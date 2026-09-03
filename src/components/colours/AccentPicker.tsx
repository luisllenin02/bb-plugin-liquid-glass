import { ACCENT_SWATCHES, type Appearance } from "../../appearance.js";
import {
  appearancePatchFromHex,
  generateHueRamps,
  hslToHex,
} from "../../lib/color.js";
import { cn } from "../../lib/utils.js";
import { CustomColourControl } from "./CustomColourControl.js";
import { Subsection } from "./Section.js";

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
  onChange,
}: {
  appearance: Appearance;
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

  return (
    <Subsection
      title="Accent"
      hint="Focus rings, links, selected rows, and the focused thread rail."
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
    </Subsection>
  );
}
