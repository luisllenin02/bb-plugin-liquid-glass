import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";

import type { rpcContract } from "../../server.js";
import type { Appearance } from "../appearance.js";
import {
  APPEARANCE_EVENT,
  readBbThemeMode,
  writeBbThemeMode,
  type BbThemeMode,
} from "../theme-mode.js";
import { ActionButton } from "./rows.js";
import { AccentPicker } from "./colours/AccentPicker.js";
import { AdvancedControls } from "./colours/AdvancedControls.js";
import { GlassControls } from "./colours/GlassControls.js";
import { Section, Subsection } from "./colours/Section.js";
import { ShellTintPicker } from "./colours/ShellTintPicker.js";
import { ThemeCards } from "./colours/ThemeCards.js";
import { WallpaperCards } from "./colours/WallpaperCards.js";

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

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <Section title="Glass" hint="Transparency, blur, wallpaper filters, and interaction strength.">
        <GlassControls
          appearance={appearance}
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            writeBbThemeMode(next);
          }}
          onChange={apply}
        />
      </Section>

      <Section title="Colours" hint="Pick a palette, accent, and shell tint without chasing sliders.">
        <Subsection title="Palettes" hint="Apply switches bb only after your explicit click.">
          <ThemeCards
            appearance={appearance}
            activeThemeId={appearance.activeThemeId}
            onApply={applyTheme}
          />
        </Subsection>
        <AccentPicker appearance={appearance} onChange={apply} />
        <ShellTintPicker appearance={appearance} light={light} onChange={apply} />
      </Section>

      <Section title="Wallpaper" hint="Gradient presets or your own image behind every glass pane.">
        <WallpaperCards
          appearance={appearance}
          onChange={apply}
          onTestPath={(path) => rpc.call("testWallpaper", { path })}
        />
      </Section>

      <AdvancedControls appearance={appearance} onChange={apply} />

      <div className="flex justify-end">
        <ActionButton onClick={reset}>Reset to monocode defaults</ActionButton>
      </div>
    </div>
  );
}
