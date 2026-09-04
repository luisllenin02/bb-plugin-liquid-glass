import { RANGES, type Appearance } from "../../appearance.js";
import { Row, Slider } from "../rows.js";

/** The "Transparency" group: how solid each surface family is. */
export function TransparencyControls({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}) {
  const sidebarOpacityPercent = Math.round(appearance.sidebarOpacity * 100);
  const paneOpacityPercent = Math.round(appearance.paneOpacity * 100);
  const overlayOpacityPercent = Math.round(appearance.overlayOpacity * 100);
  const chromeOpacityPercent = Math.round(appearance.chromeOpacity * 100);
  const chromeFadeDisabled = appearance.chromeOpacity === 0;
  return (
    <div>
      <Row label="Sidebar" description="How solid the sidebar is.">
        <Slider
          label="Sidebar"
          value={sidebarOpacityPercent}
          display={`${sidebarOpacityPercent}%`}
          min={Math.round(RANGES.sidebarOpacity.min * 100)}
          max={Math.round(RANGES.sidebarOpacity.max * 100)}
          onChange={(percent) => onChange({ sidebarOpacity: percent / 100 })}
        />
      </Row>
      <Row label="Main pane" description="How solid the thread and editor area is.">
        <Slider
          label="Main pane"
          value={paneOpacityPercent}
          display={`${paneOpacityPercent}%`}
          min={Math.round(RANGES.paneOpacity.min * 100)}
          max={Math.round(RANGES.paneOpacity.max * 100)}
          onChange={(percent) => onChange({ paneOpacity: percent / 100 })}
        />
      </Row>
      <Row
        label="Menus, sheets and cards"
        description="How solid menus, dialogs, drawers, cards and the phone status pills are."
      >
        <Slider
          label="Menus, sheets and cards"
          value={overlayOpacityPercent}
          display={`${overlayOpacityPercent}%`}
          min={Math.round(RANGES.overlayOpacity.min * 100)}
          max={Math.round(RANGES.overlayOpacity.max * 100)}
          onChange={(percent) => onChange({ overlayOpacity: percent / 100 })}
        />
      </Row>
      <Row
        label="Header and dock tint"
        description="How much colour the top bar and the bar around the prompt add. 0 leaves them clear."
      >
        <Slider
          label="Header and dock tint"
          value={chromeOpacityPercent}
          display={`${chromeOpacityPercent}%`}
          min={Math.round(RANGES.chromeOpacity.min * 100)}
          max={Math.round(RANGES.chromeOpacity.max * 100)}
          onChange={(percent) => onChange({ chromeOpacity: percent / 100 })}
        />
      </Row>
      <fieldset
        aria-label="Tint depth controls"
        disabled={chromeFadeDisabled}
        className="m-0 border-0 p-0 disabled:opacity-50"
      >
        <Row
          label="Tint depth"
          description={
            chromeFadeDisabled
              ? "No effect while the tint is 0."
              : "How far that tint reaches before it fades out."
          }
        >
          <Slider
            label="Tint depth"
            value={Math.round(appearance.chromeFade)}
            display={`${Math.round(appearance.chromeFade)} px`}
            min={RANGES.chromeFade.min}
            max={RANGES.chromeFade.max}
            onChange={(chromeFade) => onChange({ chromeFade })}
          />
        </Row>
      </fieldset>
      <Row
        label="Prompt box, collapsed"
        description="How solid the thread prompt box is when it is one line tall."
      >
        <Slider
          label="Prompt box, collapsed"
          value={Math.round(appearance.composerIdleOpacity * 100)}
          display={`${Math.round(appearance.composerIdleOpacity * 100)}%`}
          min={Math.round(RANGES.composerIdleOpacity.min * 100)}
          max={Math.round(RANGES.composerIdleOpacity.max * 100)}
          onChange={(percent) => onChange({ composerIdleOpacity: percent / 100 })}
        />
      </Row>
      <Row
        label="Prompt box, expanded"
        description="How solid it is once it grows. 100% keeps typing on a solid surface."
      >
        <Slider
          label="Prompt box, expanded"
          value={Math.round(appearance.composerFocusOpacity * 100)}
          display={`${Math.round(appearance.composerFocusOpacity * 100)}%`}
          min={Math.round(RANGES.composerFocusOpacity.min * 100)}
          max={Math.round(RANGES.composerFocusOpacity.max * 100)}
          onChange={(percent) => onChange({ composerFocusOpacity: percent / 100 })}
        />
      </Row>
    </div>
  );
}
