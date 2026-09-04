import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";

import type { rpcContract } from "../../server.js";
import { RANGES, type Appearance } from "../appearance.js";
import {
  APPEARANCE_EVENT,
  readBbThemeMode,
  writeBbThemeMode,
  type BbThemeMode,
} from "../theme-mode.js";
import { ActionButton, Row, Segmented, Slider, Toggle } from "./rows.js";
import { ComposerDockRow, ContextMeterRow } from "./ComposerDockRow.js";
import { AccentPicker } from "./colours/AccentPicker.js";
import { BlurControls } from "./colours/BlurControls.js";
import { TransparencyControls } from "./colours/GlassControls.js";
import { Section, Subsection } from "./colours/Section.js";
import { ShellTintPicker } from "./colours/ShellTintPicker.js";
import { ThemeCards } from "./colours/ThemeCards.js";
import { WallpaperCards } from "./colours/WallpaperCards.js";
import { WallpaperFilterControls } from "./colours/WallpaperFilterControls.js";

const THEME_MODES: ReadonlyArray<{ value: BbThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

type AppearanceState = Appearance & {
  activeThemeId: string | null;
  updatedAt: number;
};

export function AppearanceSection() {
  const rpc = useRpc<typeof rpcContract>();
  const [appearance, setAppearance] = useState<AppearanceState | null>(null);
  const [mode, setMode] = useState<BbThemeMode>(() => readBbThemeMode());

  const load = useCallback(async () => {
    try {
      setAppearance(await rpc.call("getAppearance", null));
    } catch (error) {
      toast.error(`Could not load the Liquid Glass appearance: ${String(error)}`);
    }
  }, [rpc]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime("appearance", () => {
    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
    void load();
  });

  const apply = useCallback(
    (patch: Partial<Appearance>) => {
      setAppearance((current) => (current ? { ...current, ...patch } : current));
      void rpc
        .call("setAppearance", patch)
        .then(() => window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT)))
        .catch((error: unknown) => {
          toast.error(`Could not save that change: ${String(error)}`);
          void load();
        });
    },
    [load, rpc],
  );

  const applyTheme = useCallback(
    async (id: "liquid-glass" | "liquid-glass-light") => {
      try {
        const result = await rpc.call("applyTheme", { id });
        setAppearance((current) =>
          current ? { ...current, activeThemeId: result.activeThemeId } : current,
        );
        window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
        toast.success(`${id === "liquid-glass" ? "Liquid Glass" : "Liquid Glass Light"} applied`);
      } catch (error) {
        toast.error(`Could not apply that palette: ${String(error)}`);
      }
    },
    [rpc],
  );

  const reset = useCallback(() => {
    void rpc
      .call("resetAppearance", null)
      .then((result) => {
        setAppearance(result);
        window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
      })
      .catch((error: unknown) => {
        toast.error(`Could not reset: ${String(error)}`);
        void load();
      });
  }, [load, rpc]);

  if (!appearance) {
    return <p className="text-sm text-muted-foreground">Loading appearance…</p>;
  }

  const light = appearance.activeThemeId === "plugin:liquid-glass:liquid-glass-light";
  const palette = light ? "light" : "dark";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <Section title="Theme" hint="Palette, shell colour and accent, in one place.">
        <Subsection title="Palette" hint="Dark or Light glass.">
          <ThemeCards
            appearance={appearance}
            activeThemeId={appearance.activeThemeId}
            onApply={applyTheme}
          />
        </Subsection>
        <Row label="Follow the system" description="Switch palette with the OS.">
          <Segmented label="Follow the system" value={mode} options={THEME_MODES} onChange={(next) => {
            setMode(next);
            writeBbThemeMode(next);
          }} />
        </Row>
        <ShellTintPicker appearance={appearance} light={light} onChange={apply} />
        <AccentPicker appearance={appearance} palette={palette} onChange={apply} />
        <Row
          label="Interactive vibrancy"
          description="Strengthens accent washes on interactive controls."
        >
          <Slider
            label="Interactive vibrancy"
            value={Math.round(appearance.interactiveVibrancy)}
            display={`${Math.round(appearance.interactiveVibrancy)}%`}
            min={RANGES.interactiveVibrancy.min}
            max={RANGES.interactiveVibrancy.max}
            onChange={(interactiveVibrancy) => apply({ interactiveVibrancy })}
          />
        </Row>
      </Section>

      <Section title="Transparency" hint="How solid each surface family is.">
        <TransparencyControls appearance={appearance} onChange={apply} />
      </Section>

      <Section title="Blur" hint="Menus, dialogs and cards are not blur-controlled here — they use a fixed backdrop blur.">
        <BlurControls appearance={appearance} onChange={apply} />
      </Section>

      <Section title="Wallpaper" hint="Preset gradient, an image URL, or a file on this machine.">
        <WallpaperCards
          appearance={appearance}
          onChange={apply}
          onTestPath={(path) => rpc.call("testWallpaper", { path })}
        />
        <WallpaperFilterControls appearance={appearance} onChange={apply} />
      </Section>

      <Section title="Phones">
        <Row
          label="Solid panels on phones"
          description="On small screens the main pane, sheets, the sidebar drawer and the side panel go nearly solid so text stays readable over the wallpaper."
        >
          <Toggle
            label="Solid panels on phones"
            on={appearance.compactSolidPanes}
            onChange={(compactSolidPanes) => apply({ compactSolidPanes })}
          />
        </Row>
      </Section>

      <Section title="Composer" hint="What sits between the chat and the prompt box.">
        <ComposerDockRow />
        <ContextMeterRow />
      </Section>

      <div className="flex justify-end">
        <ActionButton onClick={reset}>Reset to monocode defaults</ActionButton>
      </div>
    </div>
  );
}
