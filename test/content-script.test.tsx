// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import {
  loadPluginApp,
  mountPluginContentScripts,
} from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "../src/appearance.js";
import { APPEARANCE_EVENT } from "../src/theme-mode.js";

const app = await loadPluginApp(() => import("../app.js"));

const reply = () => ({
  ok: true,
  result: {
    ...DEFAULT_APPEARANCE,
    activeThemeId: "plugin:liquid-glass:liquid-glass",
    updatedAt: 0,
  },
});

let fetchMock: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState = "visible";
let disposeMounted: (() => Promise<void>) | null = null;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({ json: async () => reply() }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  document.getElementById("bb-app-theme")?.remove();
});

afterEach(async () => {
  await disposeMounted?.();
  disposeMounted = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const mount = async () => {
  const mounted = await mountPluginContentScripts(app, {
    pluginId: "liquid-glass",
  });
  disposeMounted = () => mounted.lifecycle.dispose();
  return mounted;
};

describe("the liquid-glass-vars content script", () => {
  it("paints once on mount and never on a timer", async () => {
    vi.useFakeTimers();
    const mounted = await mount();
    expect(mounted.inspection.mountedIds).toContain("liquid-glass-vars");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.getPropertyValue("--lg-hue")).not.toBe("");
    await mounted.lifecycle.dispose();
    expect(document.documentElement.style.getPropertyValue("--lg-hue")).toBe("");
  });

  it("repaints when the host rewrites its theme style element", async () => {
    const mounted = await mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // The style element appears after mount, as on a cold page load, and the
    // host fills it in the same tick.
    const style = document.createElement("style");
    style.id = "bb-app-theme";
    document.head.appendChild(style);
    style.textContent = ":root { --canvas: black }";
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // A later palette switch rewrites the text.
    style.textContent = ":root { --canvas: white }";
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    // Nothing else fires while the page is idle.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await mounted.lifecycle.dispose();
    disposeMounted = null;
  });

  it("repaints on the appearance event and when the window becomes visible", async () => {
    const mounted = await mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await mounted.lifecycle.dispose();
    disposeMounted = null;
  });
});
