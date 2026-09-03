/**
 * Liquid Glass — frontend half.
 *
 * Two registrations: a content script that writes the `--lg-*` custom
 * properties onto `document.documentElement` while one of this plugin's
 * palettes is active, and the Settings → Liquid Glass section that changes
 * them.
 */
import { definePluginApp } from "@get-bb/plugin-sdk/app";

import {
  MANAGED_ATTRIBUTES,
  MANAGED_VARS,
  normalize,
  paletteForThemeId,
  resolveVars,
} from "./src/appearance.js";
import { APPEARANCE_EVENT } from "./src/theme-mode.js";
import { AppearanceSection } from "./src/components/AppearanceSection.js";

/** Theme changes have no plugin event, so re-check the active theme on a timer. */
const RECHECK_MS = 30_000;

type AppearanceReply = Record<string, unknown> & {
  activeThemeId: string | null;
  /** Bumped by the server on every write; cache-busts the wallpaper route. */
  updatedAt?: unknown;
};

async function fetchAppearance(pluginId: string): Promise<AppearanceReply | null> {
  const response = await fetch(`/api/v1/plugins/${pluginId}/rpc/getAppearance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "null",
  });
  const envelope: unknown = await response.json();
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    (envelope as { ok?: unknown }).ok !== true
  ) {
    return null;
  }
  return (envelope as { result: AppearanceReply }).result;
}

function clearVars(): void {
  const root = document.documentElement;
  for (const name of MANAGED_VARS) root.style.removeProperty(name);
  for (const name of MANAGED_ATTRIBUTES) root.removeAttribute(name);
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "liquid-glass-vars",
    mount({ pluginId, signal }) {
      let disposed = false;

      const paint = async () => {
        if (disposed) return;
        let reply: AppearanceReply | null = null;
        try {
          reply = await fetchAppearance(pluginId);
        } catch {
          return; // a transient fetch failure keeps the last painted values
        }
        if (disposed || reply === null) return;
        const palette = paletteForThemeId(reply.activeThemeId);
        if (palette === null) {
          clearVars();
          return;
        }
        const updatedAt = typeof reply.updatedAt === "number" ? reply.updatedAt : 0;
        const { vars, attributes } = resolveVars(normalize(reply), palette, updatedAt);
        const root = document.documentElement;
        for (const [name, value] of Object.entries(vars)) {
          root.style.setProperty(name, value);
        }
        for (const [name, value] of Object.entries(attributes)) {
          root.setAttribute(name, value);
        }
      };

      void paint();
      const timer = setInterval(() => void paint(), RECHECK_MS);
      // The settings section fires this after every write and on the realtime
      // signal, so the window repaints without waiting for the next poll.
      window.addEventListener(APPEARANCE_EVENT, () => void paint(), { signal });

      return () => {
        disposed = true;
        clearInterval(timer);
        clearVars();
      };
    },
  });

  app.slots.settingsSection({
    id: "appearance",
    title: "Liquid Glass",
    description:
      "The shell tint, accent, glass opacity, and wallpaper for the Liquid Glass palettes.",
    component: AppearanceSection,
  });
});
