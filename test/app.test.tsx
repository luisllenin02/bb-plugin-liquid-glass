// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import {
  loadPluginApp,
  mountPluginContentScripts,
  renderSlot,
} from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "../src/appearance.js";

const app = await loadPluginApp(() => import("../app.js"));

const reply = (patch: Record<string, unknown> = {}) => ({
  ...DEFAULT_APPEARANCE,
  activeThemeId: "plugin:liquid-glass:liquid-glass",
  updatedAt: 0,
  ...patch,
});

function renderSection(overrides: Record<string, unknown> = {}) {
  return renderSlot(
    app.settingsSections[0]!,
    {},
    {
      rpc: {
        getAppearance: () => reply(),
        setAppearance: () => reply(),
        resetAppearance: () => reply(),
        applyTheme: (input: unknown) => ({
          activeThemeId: `plugin:liquid-glass:${(input as { id: string }).id}`,
        }),
        testWallpaper: () => ({ ok: true, detail: "Readable image/png, 12 KB." }),
        ...overrides,
      },
    },
  );
}

describe("the Liquid Glass settings section", () => {
  it("registers with the expected id and title", () => {
    expect(app.settingsSections).toHaveLength(1);
    expect(app.settingsSections[0]!.id).toBe("appearance");
    expect(app.settingsSections[0]!.title).toBe("Liquid Glass");
  });

  it("renders monocode's Appearance rows plus Accent and Wallpaper", async () => {
    const slot = renderSection();
    for (const label of [
      "Theme",
      "Sidebar opacity",
      "Blur radius",
      "Hue",
      "Saturation",
      "Main pane glass",
      "Pane opacity",
      "Pane blur",
      "Overlay opacity",
      "Chrome opacity",
      "Chrome fade",
      "Chrome blur",
      "Compact solid panes",
      "Accent",
      "Wallpaper",
      "Wallpaper brightness",
      "Wallpaper blur",
      "Wallpaper saturation",
      "Wallpaper dim",
      "Interactive vibrancy",
    ]) {
      expect(await slot.findByText(label)).toBeTruthy();
    }
    expect(await slot.findByText("Reset to monocode defaults")).toBeTruthy();
    slot.lifecycle.unmount();
  });

  it("disables the pane controls while main-pane glass is off", async () => {
    const slot = renderSection({ getAppearance: () => reply({ paneGlass: false }) });
    const group = await slot.findByLabelText("Main pane glass controls");
    expect(group.hasAttribute("disabled")).toBe(true);
    expect((await slot.findByLabelText("Pane opacity")).matches(":disabled")).toBe(true);
    expect((await slot.findByLabelText("Pane blur")).matches(":disabled")).toBe(true);
    slot.lifecycle.unmount();
  });

  it("clamps a wallpaper slider before writing the patch", async () => {
    const slot = renderSection();
    fireEvent.change(await slot.findByLabelText("Wallpaper brightness"), {
      target: { value: "999" },
    });
    await waitFor(() =>
      expect(
        slot.inspection.rpcCalls.find((call) => call.method === "setAppearance")?.input,
      ).toEqual({ wallpaperBrightness: 1.6 }),
    );
    slot.lifecycle.unmount();
  });

  it("sends a slider change through setAppearance as the clamped value", async () => {
    const slot = renderSection();
    const slider = await slot.findByLabelText("Blur radius");
    fireEvent.change(slider, { target: { value: "40" } });
    await waitFor(() =>
      expect(
        slot.inspection.rpcCalls.some(
          (call) => call.method === "setAppearance" && (call.input as { blur?: number }).blur === 40,
        ),
      ).toBe(true),
    );
    // The slider itself carries the host range, so a value outside it is impossible.
    expect(slider.getAttribute("min")).toBe("1");
    expect(slider.getAttribute("max")).toBe("64");
    slot.lifecycle.unmount();
  });

  it("round-trips a stored sidebar opacity without clamping it to solid", async () => {
    const stored = renderSection({ getAppearance: () => reply({ sidebarOpacity: 0.85 }) });
    const storedSlider = await stored.findByLabelText("Sidebar opacity") as HTMLInputElement;
    expect(storedSlider.value).toBe("85");
    expect(storedSlider.min).toBe("15");
    expect(storedSlider.max).toBe("100");
    stored.lifecycle.unmount();

    const dragged = renderSection({ getAppearance: () => reply({ sidebarOpacity: 0.84 }) });
    fireEvent.change(await dragged.findByLabelText("Sidebar opacity"), {
      target: { value: "85" },
    });
    await waitFor(() =>
      expect(
        dragged.inspection.rpcCalls.find((call) => call.method === "setAppearance")?.input,
      ).toEqual({ sidebarOpacity: 0.85 }),
    );
    dragged.lifecycle.unmount();
  });

  it("writes overlay controls and clamps all three chrome rows", async () => {
    const slot = renderSection();
    fireEvent.change(await slot.findByLabelText("Overlay opacity"), {
      target: { value: "97" },
    });
    fireEvent.click(await slot.findByLabelText("Compact solid panes"));
    fireEvent.change(await slot.findByLabelText("Chrome opacity"), { target: { value: "999" } });
    fireEvent.change(await slot.findByLabelText("Chrome fade"), { target: { value: "999" } });
    fireEvent.change(await slot.findByLabelText("Chrome blur"), { target: { value: "999" } });
    await waitFor(() => {
      const writes = slot.inspection.rpcCalls
        .filter((call) => call.method === "setAppearance")
        .map((call) => call.input);
      expect(writes).toContainEqual({ overlayOpacity: 0.97 });
      expect(writes).toContainEqual({ compactSolidPanes: false });
      expect(writes).toContainEqual({ chromeOpacity: 1 });
      expect(writes).toContainEqual({ chromeFade: 96 });
      expect(writes).toContainEqual({ chromeBlur: 48 });
    });
    slot.lifecycle.unmount();
  });

  it("sets all three accent fields from one swatch", async () => {
    const slot = renderSection();
    fireEvent.click(await slot.findByLabelText("Violet"));
    await waitFor(() =>
      expect(
        slot.inspection.rpcCalls.find((call) => call.method === "setAppearance")?.input,
      ).toEqual({ accentHue: 280, accentSaturation: 55, accentLightness: 62 }),
    );
    slot.lifecycle.unmount();
  });

  it("retains the exact Monokai swatch selection after rerender", async () => {
    const slot = renderSection();
    const swatch = await slot.findByLabelText("Monokai Green");
    fireEvent.click(swatch);

    await waitFor(() => {
      expect(swatch.getAttribute("aria-pressed")).toBe("true");
      expect(swatch.className).toContain("ring-primary");
      expect((slot.getByLabelText("Accent custom colour picker") as HTMLInputElement).value).toBe(
        "#a6e22e",
      );
    });
    slot.lifecycle.unmount();
  });

  it("retains the exact ramp shade and roving tab stop after rerender", async () => {
    const slot = renderSection();
    const ramp = await slot.findByRole("radiogroup", { name: "Red shades" });
    const shades = ramp.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const shade = shades[3]!;
    const exactHex = shade.getAttribute("aria-label")!.split(" ").at(-1)!;
    fireEvent.click(shade);

    await waitFor(() => {
      expect(shade.getAttribute("aria-checked")).toBe("true");
      expect(shade.className).toContain("ring-foreground");
      expect(shade.tabIndex).toBe(0);
      expect((slot.getByLabelText("Accent custom colour picker") as HTMLInputElement).value).toBe(
        exactHex,
      );
    });
    for (const other of Array.from(shades)) {
      if (other !== shade) expect(other.tabIndex).toBe(-1);
    }
    slot.lifecycle.unmount();
  });

  it("rejects an invalid custom accent hex without writing", async () => {
    const slot = renderSection();
    const field = await slot.findByLabelText("Accent custom hex");
    fireEvent.change(field, { target: { value: "#nope" } });
    fireEvent.blur(field);
    expect(await slot.findByText("Use #rrggbb.")).toBeTruthy();
    expect(
      slot.inspection.rpcCalls.some((call) => call.method === "setAppearance"),
    ).toBe(false);
    slot.lifecycle.unmount();
  });

  it("applies the selected palette only from its Apply button", async () => {
    const slot = renderSection();
    expect(
      slot.inspection.rpcCalls.some((call) => call.method === "applyTheme"),
    ).toBe(false);
    fireEvent.click(await slot.findByText("Apply"));
    await waitFor(() =>
      expect(
        slot.inspection.rpcCalls.find((call) => call.method === "applyTheme")?.input,
      ).toEqual({ id: "liquid-glass-light" }),
    );
    slot.lifecycle.unmount();
  });

  it("keeps the fine-adjustment sliders in Advanced, collapsed by default", async () => {
    const slot = renderSection();
    const summary = await slot.findByText("Advanced");
    const details = summary.closest("details");
    expect(details?.hasAttribute("open")).toBe(false);
    fireEvent.click(summary);
    expect(details?.hasAttribute("open")).toBe(true);
    expect(await slot.findByLabelText("Accent lightness")).toBeTruthy();
    slot.lifecycle.unmount();
  });

  it("moves keyboard focus across each hue ramp", async () => {
    const slot = renderSection();
    const ramp = await slot.findByRole("radiogroup", { name: "Red shades" });
    const buttons = ramp.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons[0]!.focus();
    fireEvent.keyDown(buttons[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    slot.lifecycle.unmount();
  });

  it("selects a wallpaper preset and tests a local path", async () => {
    const slot = renderSection();
    fireEvent.click(await slot.findByLabelText("ocean"));
    await waitFor(() =>
      expect(
        slot.inspection.rpcCalls.find((call) => call.method === "setAppearance")?.input,
      ).toEqual({ wallpaper: "ocean" }),
    );
    fireEvent.click(await slot.findByText("Test"));
    expect(await slot.findByText("Readable image/png, 12 KB.")).toBeTruthy();
    slot.lifecycle.unmount();
  });

  it("calls resetAppearance from the reset button", async () => {
    const slot = renderSection();
    fireEvent.click(await slot.findByText("Reset to monocode defaults"));
    await waitFor(() =>
      expect(
        slot.inspection.rpcCalls.some((call) => call.method === "resetAppearance"),
      ).toBe(true),
    );
    slot.lifecycle.unmount();
  });

  it("writes bb's own light/dark key and dispatches the storage event", async () => {
    const slot = renderSection();
    const events: StorageEvent[] = [];
    const listener = (event: Event) => events.push(event as StorageEvent);
    window.addEventListener("storage", listener);
    fireEvent.click(await slot.findByText("Light"));
    expect(localStorage.getItem("bb.theme")).toBe("light");
    expect(events.at(-1)?.key).toBe("bb.theme");
    window.removeEventListener("storage", listener);
    slot.lifecycle.unmount();
  });
});

describe("the liquid-glass-vars content script", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-lg-wallpaper");
    document.documentElement.removeAttribute("data-lg-pane-glass");
    document.documentElement.removeAttribute("data-lg-compact-solid");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is registered", () => {
    expect(app.contentScripts.map((script) => script.id)).toEqual(["liquid-glass-vars"]);
  });

  it("paints the vars for our palette and removes them on dispose", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true, result: reply({ blur: 40, paneGlass: false }) }),
    });
    const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
    const root = document.documentElement;
    await waitFor(() => expect(root.style.getPropertyValue("--lg-blur")).toBe("40px"));
    expect(root.style.getPropertyValue("--lg-pane-a")).toBe("0.85");
    expect(root.style.getPropertyValue("--lg-pane-blur")).toBe("24px");
    expect(root.style.getPropertyValue("--lg-overlay-a")).toBe("0.94");
    expect(root.style.getPropertyValue("--lg-wp-brightness")).toBe("1");
    expect(root.style.getPropertyValue("--lg-wp-blur")).toBe("0px");
    expect(root.style.getPropertyValue("--lg-wp-sat")).toBe("1.1");
    expect(root.style.getPropertyValue("--lg-vibrancy")).toBe("70");
    expect(root.style.getPropertyValue("--lg-accent-l")).toBe("62%");
    expect(root.getAttribute("data-lg-pane-glass")).toBe("off");
    expect(root.getAttribute("data-lg-compact-solid")).toBe("on");
    expect(root.getAttribute("data-lg-wallpaper")).toBe("aurora");

    await mounted.lifecycle.dispose();
    expect(root.style.getPropertyValue("--lg-blur")).toBe("");
    expect(root.style.getPropertyValue("--lg-pane-blur")).toBe("");
    expect(root.style.getPropertyValue("--lg-overlay-a")).toBe("");
    expect(root.style.getPropertyValue("--lg-wp-brightness")).toBe("");
    expect(root.style.getPropertyValue("--lg-vibrancy")).toBe("");
    expect(root.getAttribute("data-lg-wallpaper")).toBeNull();
    expect(root.getAttribute("data-lg-compact-solid")).toBeNull();
  });

  it("paints nothing while another plugin's theme is active", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: true,
        result: reply({ activeThemeId: "plugin:vercel-theme:vercel" }),
      }),
    });
    const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(document.documentElement.style.getPropertyValue("--lg-blur")).toBe("");
    await mounted.lifecycle.dispose();
  });

  it("cache-busts the wallpaper route with the server's updatedAt", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: true,
        result: reply({
          wallpaper: "custom",
          wallpaperPath: "/tmp/wall.png",
          updatedAt: 1_712_000_000_123,
        }),
      }),
    });
    const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
    const root = document.documentElement;
    await waitFor(() =>
      expect(root.style.getPropertyValue("--lg-wallpaper-custom")).toBe(
        'url("/api/v1/plugins/liquid-glass/http/wallpaper?v=1712000000123")',
      ),
    );
    expect(root.getAttribute("data-lg-wallpaper")).toBe("custom");
    await mounted.lifecycle.dispose();
    expect(root.style.getPropertyValue("--lg-wallpaper-custom")).toBe("");
  });

  it("resolves an accessible accent pair when the light palette is active", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: true,
        result: reply({ activeThemeId: "plugin:liquid-glass:liquid-glass-light" }),
      }),
    });
    const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--lg-accent-l")).toBe("45%"),
    );
    expect(document.documentElement.style.getPropertyValue("--lg-primary-fg-l")).toBe(
      "100%",
    );
    await mounted.lifecycle.dispose();
  });
});
