import { RANGES, type Appearance } from "../../appearance.js";
import { Row, Slider } from "../rows.js";

/** The "Blur" group: the three distinct backdrop blurs. */
export function BlurControls({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  return (
    <div>
      <Row label="Sidebar frost" description="Blurs whatever is behind the sidebar.">
        <Slider
          label="Sidebar frost"
          value={Math.round(appearance.blur)}
          display={String(Math.round(appearance.blur))}
          min={RANGES.blur.min}
          max={RANGES.blur.max}
          onChange={(blur) => onChange({ blur })}
        />
      </Row>
      <Row
        label="Header and prompt box frost"
        description="Blurs whatever is behind the top bar and the prompt boxes."
      >
        <Slider
          label="Header and prompt box frost"
          value={Math.round(appearance.chromeBlur)}
          display={`${Math.round(appearance.chromeBlur)} px`}
          min={RANGES.chromeBlur.min}
          max={RANGES.chromeBlur.max}
          onChange={(chromeBlur) => onChange({ chromeBlur })}
        />
      </Row>
      <Row
        label="Wallpaper blur"
        description="Softens the wallpaper. One blur, applied once to the wallpaper layer, so typing and scrolling stay quick."
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
    </div>
  );
}
