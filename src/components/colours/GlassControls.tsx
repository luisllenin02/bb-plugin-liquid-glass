import { RANGES, type Appearance } from "../../appearance.js";
import type { BbThemeMode } from "../../theme-mode.js";
import { Row, Segmented, Slider, Toggle } from "../rows.js";

const THEME_MODES: ReadonlyArray<{ value: BbThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export function GlassControls({
  appearance,
  mode,
  onModeChange,
  onChange,
}: {
  appearance: Appearance;
  mode: BbThemeMode;
  onModeChange: (mode: BbThemeMode) => void;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  const opacityPercent = Math.round(appearance.sidebarOpacity * 100);
  const paneOpacityPercent = Math.round(appearance.paneOpacity * 100);
  const overlayOpacityPercent = Math.round(appearance.overlayOpacity * 100);
  return (
    <div>
      <Row
        label="Theme"
        description="System follows the OS appearance; palette cards below switch Liquid Glass itself."
      >
        <Segmented label="Theme" value={mode} options={THEME_MODES} onChange={onModeChange} />
      </Row>
      <Row label="Sidebar opacity" description="How much wallpaper shows through the sidebar.">
        <Slider
          label="Sidebar opacity"
          value={opacityPercent}
          display={`${opacityPercent}%`}
          min={Math.round(RANGES.sidebarOpacity.min * 100)}
          max={Math.round(RANGES.sidebarOpacity.max * 100)}
          onChange={(percent) => onChange({ sidebarOpacity: percent / 100 })}
        />
      </Row>
      <Row label="Blur radius" description="Background blur behind the sidebar, cards, and popovers.">
        <Slider
          label="Blur radius"
          value={Math.round(appearance.blur)}
          display={String(Math.round(appearance.blur))}
          min={RANGES.blur.min}
          max={RANGES.blur.max}
          onChange={(blur) => onChange({ blur })}
        />
      </Row>
      <Row label="Main pane glass" description="Extend translucency to threads and editors.">
        <Toggle
          label="Main pane glass"
          on={appearance.paneGlass}
          onChange={(paneGlass) => onChange({ paneGlass })}
        />
      </Row>
      <fieldset
        aria-label="Main pane glass controls"
        disabled={!appearance.paneGlass}
        className="ml-4 border-l border-border pl-4 disabled:opacity-50"
      >
        <Row label="Pane opacity" description="The main pane tint while glass is on.">
          <Slider
            label="Pane opacity"
            value={paneOpacityPercent}
            display={`${paneOpacityPercent}%`}
            min={Math.round(RANGES.paneOpacity.min * 100)}
            max={Math.round(RANGES.paneOpacity.max * 100)}
            onChange={(percent) => onChange({ paneOpacity: percent / 100 })}
          />
        </Row>
        <Row label="Pane blur" description="Wallpaper blur behind the main pane.">
          <Slider
            label="Pane blur"
            value={Math.round(appearance.paneBlur)}
            display={String(Math.round(appearance.paneBlur))}
            min={RANGES.paneBlur.min}
            max={RANGES.paneBlur.max}
            onChange={(paneBlur) => onChange({ paneBlur })}
          />
        </Row>
      </fieldset>
      <Row label="Overlay opacity" description="Keeps menus, sheets, and sticky chrome unreadable through the glass.">
        <Slider
          label="Overlay opacity"
          value={overlayOpacityPercent}
          display={`${overlayOpacityPercent}%`}
          min={Math.round(RANGES.overlayOpacity.min * 100)}
          max={Math.round(RANGES.overlayOpacity.max * 100)}
          onChange={(percent) => onChange({ overlayOpacity: percent / 100 })}
        />
      </Row>
      <Row label="Compact solid panes" description="Main pane and sheets go near-solid on phones; the sidebar keeps its glass.">
        <Toggle
          label="Compact solid panes"
          on={appearance.compactSolidPanes}
          onChange={(compactSolidPanes) => onChange({ compactSolidPanes })}
        />
      </Row>
      <Row label="Wallpaper brightness" description="Brighten or darken the wallpaper itself.">
        <Slider
          label="Wallpaper brightness"
          value={Math.round(appearance.wallpaperBrightness * 100)}
          display={`${Math.round(appearance.wallpaperBrightness * 100)}%`}
          min={Math.round(RANGES.wallpaperBrightness.min * 100)}
          max={Math.round(RANGES.wallpaperBrightness.max * 100)}
          onChange={(percent) => onChange({ wallpaperBrightness: percent / 100 })}
        />
      </Row>
      <Row label="Wallpaper blur" description="Soften wallpaper detail before pane glass.">
        <Slider
          label="Wallpaper blur"
          value={Math.round(appearance.wallpaperBlur)}
          display={String(Math.round(appearance.wallpaperBlur))}
          min={RANGES.wallpaperBlur.min}
          max={RANGES.wallpaperBlur.max}
          onChange={(wallpaperBlur) => onChange({ wallpaperBlur })}
        />
      </Row>
      <Row label="Wallpaper saturation" description="Wallpaper colour intensity.">
        <Slider
          label="Wallpaper saturation"
          value={Math.round(appearance.wallpaperSaturation * 100)}
          display={`${Math.round(appearance.wallpaperSaturation * 100)}%`}
          min={Math.round(RANGES.wallpaperSaturation.min * 100)}
          max={Math.round(RANGES.wallpaperSaturation.max * 100)}
          onChange={(percent) => onChange({ wallpaperSaturation: percent / 100 })}
        />
      </Row>
      <Row label="Wallpaper dim" description="Push the wallpaper back before panes go over it.">
        <Slider
          label="Wallpaper dim"
          value={Math.round(appearance.dim * 100)}
          display={`${Math.round(appearance.dim * 100)}%`}
          min={Math.round(RANGES.dim.min * 100)}
          max={Math.round(RANGES.dim.max * 100)}
          onChange={(percent) => onChange({ dim: percent / 100 })}
        />
      </Row>
      <Row label="Interactive vibrancy" description="Strengthens accent washes on interactive controls.">
        <Slider
          label="Interactive vibrancy"
          value={Math.round(appearance.interactiveVibrancy)}
          display={`${Math.round(appearance.interactiveVibrancy)}%`}
          min={RANGES.interactiveVibrancy.min}
          max={RANGES.interactiveVibrancy.max}
          onChange={(interactiveVibrancy) => onChange({ interactiveVibrancy })}
        />
      </Row>
    </div>
  );
}
