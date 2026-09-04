import { RANGES, type Appearance } from "../../appearance.js";
import { Row, Slider } from "../rows.js";

/** The "Wallpaper" group's filters, below the preset/custom-image picker. */
export function WallpaperFilterControls({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  return (
    <div>
      <Row label="Wallpaper brightness" description="Brightens or darkens the wallpaper.">
        <Slider
          label="Wallpaper brightness"
          value={Math.round(appearance.wallpaperBrightness * 100)}
          display={`${Math.round(appearance.wallpaperBrightness * 100)}%`}
          min={Math.round(RANGES.wallpaperBrightness.min * 100)}
          max={Math.round(RANGES.wallpaperBrightness.max * 100)}
          onChange={(percent) => onChange({ wallpaperBrightness: percent / 100 })}
        />
      </Row>
      <Row label="Wallpaper colour" description="How vivid the wallpaper's colours are. 0 is greyscale.">
        <Slider
          label="Wallpaper colour"
          value={Math.round(appearance.wallpaperSaturation * 100)}
          display={`${Math.round(appearance.wallpaperSaturation * 100)}%`}
          min={Math.round(RANGES.wallpaperSaturation.min * 100)}
          max={Math.round(RANGES.wallpaperSaturation.max * 100)}
          onChange={(percent) => onChange({ wallpaperSaturation: percent / 100 })}
        />
      </Row>
      <Row
        label="Wallpaper wash"
        description="Fades the wallpaper toward black in Dark and toward white in Light, behind every panel."
      >
        <Slider
          label="Wallpaper wash"
          value={Math.round(appearance.dim * 100)}
          display={`${Math.round(appearance.dim * 100)}%`}
          min={Math.round(RANGES.dim.min * 100)}
          max={Math.round(RANGES.dim.max * 100)}
          onChange={(percent) => onChange({ dim: percent / 100 })}
        />
      </Row>
    </div>
  );
}
