import { RANGES, type Appearance } from "../../appearance.js";
import { Row, Slider } from "../rows.js";

export function AdvancedControls({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Advanced</summary>
      <p className="mt-1 text-xs text-muted-foreground">
        Sliders for fine adjustment; the picker above covers most needs.
      </p>
      <div className="mt-2">
        <Row label="Hue" description="Fine-tune the shell tint hue.">
          <Slider
            label="Hue"
            value={Math.round(appearance.hue)}
            display={`${Math.round(appearance.hue)}°`}
            min={RANGES.hue.min}
            max={RANGES.hue.max}
            onChange={(hue) => onChange({ hue })}
          />
        </Row>
        <Row label="Saturation" description="Fine-tune the shell tint saturation.">
          <Slider
            label="Saturation"
            value={Math.round(appearance.saturation)}
            display={`${Math.round(appearance.saturation)}%`}
            min={RANGES.saturation.min}
            max={RANGES.saturation.max}
            onChange={(saturation) => onChange({ saturation })}
          />
        </Row>
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
        <Row label="Accent lightness" description="Fine-tune accent lightness.">
          <Slider
            label="Accent lightness"
            value={Math.round(appearance.accentLightness)}
            display={`${Math.round(appearance.accentLightness)}%`}
            min={RANGES.accentLightness.min}
            max={RANGES.accentLightness.max}
            onChange={(accentLightness) => onChange({ accentLightness })}
          />
        </Row>
      </div>
    </details>
  );
}
