/**
 * The Accent row: the nine vibrant thread colours as swatches, a live preview
 * chip, and H/S/L sliders for anything not in the palette. User colours are
 * inline custom properties, never Tailwind colour classes.
 */
import { ACCENT_SWATCHES, RANGES, type Appearance } from "../appearance.js";
import { cn } from "../lib/utils.js";
import { Row, Slider } from "./rows.js";

function hsl(hue: number, saturation: number, lightness: number): string {
  return `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
}

export function AccentRow({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  const current = hsl(
    appearance.accentHue,
    appearance.accentSaturation,
    appearance.accentLightness,
  );

  return (
    <>
      <Row
        label="Accent"
        description="The colour of focus rings, links, selected rows, and the focused thread's rail."
      >
        <div className="flex items-center gap-2">
          <span
            data-testid="liquid-glass-accent-preview"
            aria-label={`Accent preview ${current}`}
            className="size-5 rounded-full border border-border"
            style={{ background: current }}
          />
          <div className="flex gap-1">
            {ACCENT_SWATCHES.map((swatch) => {
              const isActive =
                Math.round(appearance.accentHue) === swatch.hue &&
                Math.round(appearance.accentSaturation) === swatch.saturation;
              return (
                <button
                  key={swatch.name}
                  type="button"
                  aria-label={swatch.name}
                  aria-pressed={isActive}
                  onClick={() =>
                    onChange({
                      accentHue: swatch.hue,
                      accentSaturation: swatch.saturation,
                      accentLightness: swatch.lightness,
                    })
                  }
                  className={cn(
                    "size-5 rounded-full border transition-transform",
                    isActive ? "border-foreground scale-110" : "border-border",
                  )}
                  style={{ background: hsl(swatch.hue, swatch.saturation, swatch.lightness) }}
                />
              );
            })}
          </div>
        </div>
      </Row>
      <Row label="Accent hue" description="Fine-tune the accent away from the swatches.">
        <Slider
          label="Accent hue"
          value={Math.round(appearance.accentHue)}
          display={`${Math.round(appearance.accentHue)}°`}
          min={RANGES.accentHue.min}
          max={RANGES.accentHue.max}
          onChange={(accentHue) => onChange({ accentHue })}
        />
      </Row>
      <Row label="Accent saturation" description="How vivid the accent is.">
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
        label="Accent lightness"
        description="Clamped per palette so accent text stays at or above 4.5:1 on the shell."
      >
        <Slider
          label="Accent lightness"
          value={Math.round(appearance.accentLightness)}
          display={`${Math.round(appearance.accentLightness)}%`}
          min={RANGES.accentLightness.min}
          max={RANGES.accentLightness.max}
          onChange={(accentLightness) => onChange({ accentLightness })}
        />
      </Row>
    </>
  );
}
