// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { loadPluginApp, mountPluginContentScripts } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "../src/appearance.js";
import { HOME_ATTRIBUTE } from "../src/home-shell.js";

const app = await loadPluginApp(() => import("../app.js"));

let disposeMounted: (() => Promise<void>) | null = null;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({
        ok: true,
        result: { ...DEFAULT_APPEARANCE, activeThemeId: "plugin:liquid-glass:liquid-glass", updatedAt: 0 },
      }),
    })),
  );
});

afterEach(async () => {
  await disposeMounted?.();
  disposeMounted = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const home = () => {
  const element = document.createElement("div");
  element.setAttribute("data-testid", "root-compose-compact-home");
  return element;
};

describe("the home-shell content script", () => {
  it("flags the document only while the new-thread home screen is mounted", async () => {
    const shell = document.createElement("div");
    shell.setAttribute("data-testid", "app-layout-content-shell");
    document.body.appendChild(shell);

    const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
    disposeMounted = () => mounted.lifecycle.dispose();
    expect(mounted.inspection.mountedIds).toContain("home-shell");
    expect(document.documentElement.hasAttribute(HOME_ATTRIBUTE)).toBe(false);

    const screen = home();
    shell.appendChild(screen);
    await waitFor(() => expect(document.documentElement.hasAttribute(HOME_ATTRIBUTE)).toBe(true));

    screen.remove();
    await waitFor(() => expect(document.documentElement.hasAttribute(HOME_ATTRIBUTE)).toBe(false));
  });

  it("sees a home screen that was already mounted, and clears the flag on dispose", async () => {
    document.body.appendChild(home());
    const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
    disposeMounted = () => mounted.lifecycle.dispose();
    await waitFor(() => expect(document.documentElement.hasAttribute(HOME_ATTRIBUTE)).toBe(true));

    await mounted.lifecycle.dispose();
    disposeMounted = null;
    expect(document.documentElement.hasAttribute(HOME_ATTRIBUTE)).toBe(false);
  });
});
