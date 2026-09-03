import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { beforeEach, describe, expect, it } from "vitest";

import plugin from "../server.js";
import { DEFAULT_APPEARANCE } from "../src/appearance.js";

async function boot(stored?: unknown) {
  const { bb, harness } = createFakePluginHost({
    pluginId: "liquid-glass",
    sdk: {
      theme: {
        get: async () => ({ themeId: "plugin:liquid-glass:liquid-glass" }),
        set: async (themeId) => ({ themeId }),
      },
    },
  });
  if (stored !== undefined) await bb.storage.kv.set("appearance", stored);
  await plugin(bb);
  return harness;
}

let harness: Awaited<ReturnType<typeof boot>>;

beforeEach(async () => {
  harness = await boot();
});

describe("getAppearance", () => {
  it("returns monocode's defaults and the active theme id", async () => {
    const result = (await harness.behavior.callRpc("getAppearance", null)) as Record<
      string,
      unknown
    >;
    expect(result).toMatchObject(DEFAULT_APPEARANCE);
    expect(result.activeThemeId).toBe("plugin:liquid-glass:liquid-glass");
  });

  it("fills every phase-two default when reading an old kv row", async () => {
    const oldHarness = await boot({ blur: 40, hue: 300 });
    const result = await oldHarness.behavior.callRpc("getAppearance", null);
    expect(result).toMatchObject({
      ...DEFAULT_APPEARANCE,
      blur: 40,
      hue: 300,
      paneOpacity: 0.85,
      paneBlur: 24,
      overlayOpacity: 0.94,
      compactSolidPanes: true,
      wallpaperBrightness: 1,
      wallpaperBlur: 0,
      wallpaperSaturation: 1.1,
      interactiveVibrancy: 70,
    });
  });
});

describe("setAppearance", () => {
  it("persists a patch, leaves the rest alone, and publishes the signal", async () => {
    await harness.behavior.callRpc("setAppearance", { blur: 40, hue: 300 });
    const after = (await harness.behavior.callRpc("getAppearance", null)) as Record<
      string,
      unknown
    >;
    expect(after).toMatchObject({ ...DEFAULT_APPEARANCE, blur: 40, hue: 300 });
    expect(harness.realtimeSignals).toContainEqual(
      expect.objectContaining({ channel: "appearance" }),
    );
  });

  it("accepts the phase-two range boundaries", async () => {
    const patch = {
      paneOpacity: 0.15,
      paneBlur: 64,
      wallpaperBrightness: 1.6,
      wallpaperBlur: 40,
      wallpaperSaturation: 0,
      interactiveVibrancy: 100,
      overlayOpacity: 1,
      compactSolidPanes: false,
    };
    await expect(harness.behavior.callRpc("setAppearance", patch)).resolves.toMatchObject(
      patch,
    );
  });

  it("rejects every out-of-range value", async () => {
    for (const patch of [
      { blur: 0 },
      { blur: 65 },
      { hue: 361 },
      { saturation: -1 },
      { sidebarOpacity: 0.1 },
      { sidebarOpacity: 1.2 },
      { paneOpacity: 0.14 },
      { paneOpacity: 1.01 },
      { paneBlur: -1 },
      { paneBlur: 65 },
      { overlayOpacity: 0.84 },
      { overlayOpacity: 1.01 },
      { wallpaperBrightness: 0.29 },
      { wallpaperBrightness: 1.61 },
      { wallpaperBlur: -1 },
      { wallpaperBlur: 41 },
      { wallpaperSaturation: -0.01 },
      { wallpaperSaturation: 2.01 },
      { dim: 0.9 },
      { interactiveVibrancy: -1 },
      { interactiveVibrancy: 101 },
      { wallpaper: "nebula" },
      { paneGlass: "yes" },
      { compactSolidPanes: "yes" },
      { nonsense: 1 },
    ]) {
      await expect(harness.behavior.callRpc("setAppearance", patch)).rejects.toThrow();
    }
    const after = await harness.behavior.callRpc("getAppearance", null);
    expect(after).toMatchObject(DEFAULT_APPEARANCE);
  });
});

describe("resetAppearance", () => {
  it("restores the defaults and publishes", async () => {
    await harness.behavior.callRpc("setAppearance", { blur: 64, paneGlass: false });
    const before = harness.realtimeSignals.length;
    const result = await harness.behavior.callRpc("resetAppearance", null);
    expect(result).toMatchObject(DEFAULT_APPEARANCE);
    expect(harness.realtimeSignals.length).toBe(before + 1);
  });
});

describe("applyTheme", () => {
  it("qualifies a declared palette id and switches it only on the RPC call", async () => {
    expect(harness.inspection.sdk.callsTo("theme.set")).toEqual([]);
    await expect(
      harness.behavior.callRpc("applyTheme", { id: "liquid-glass-light" }),
    ).resolves.toEqual({
      activeThemeId: "plugin:liquid-glass:liquid-glass-light",
    });
    expect(harness.inspection.sdk.callsTo("theme.set")).toEqual([
      ["plugin:liquid-glass:liquid-glass-light"],
    ]);
  });

  it("rejects an undeclared palette before calling the SDK", async () => {
    await expect(
      harness.behavior.callRpc("applyTheme", { id: "some-other-theme" }),
    ).rejects.toThrow();
    expect(harness.inspection.sdk.callsTo("theme.set")).toEqual([]);
  });
});

describe("the wallpaper route", () => {
  it("404s when no path is set", async () => {
    const response = await harness.behavior.fetchHttp("GET", "/wallpaper");
    expect(response.status).toBe(404);
  });

  it("404s on a relative path, a missing file, and an unsupported extension", async () => {
    const dir = await mkdtemp(join(tmpdir(), "liquid-glass-"));
    for (const wallpaperPath of [
      "relative/a.png",
      join(dir, "missing.png"),
      join(dir, "notes.txt"),
    ]) {
      await writeFile(join(dir, "notes.txt"), "not an image");
      await harness.behavior.callRpc("setAppearance", { wallpaperPath });
      const response = await harness.behavior.fetchHttp("GET", "/wallpaper");
      expect(response.status, wallpaperPath).toBe(404);
    }
  });

  it("serves a real image with its content type and no-cache", async () => {
    const dir = await mkdtemp(join(tmpdir(), "liquid-glass-"));
    const file = join(dir, "wall.png");
    await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await harness.behavior.callRpc("setAppearance", { wallpaperPath: file });
    const response = await harness.behavior.fetchHttp("GET", "/wallpaper");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(new Uint8Array(await response.arrayBuffer())).toHaveLength(4);
  });

  it("ignores a path supplied as a query parameter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "liquid-glass-"));
    const file = join(dir, "wall.png");
    await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const response = await harness.behavior.fetchHttp(
      "GET",
      `/wallpaper?path=${encodeURIComponent(file)}`,
    );
    expect(response.status).toBe(404);
  });
});

describe("the bb liquid-glass command", () => {
  it("shows, sets, resets, and lists presets", async () => {
    const show = await harness.behavior.runCli(["show"]);
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain("sidebarOpacity");

    const set = await harness.behavior.runCli(["set", "wallpaper", "ocean"]);
    expect(set.exitCode).toBe(0);
    expect(set.stdout).toContain("ocean");

    const paneOpacity = await harness.behavior.runCli([
      "set",
      "paneOpacity",
      "0.72",
    ]);
    expect(paneOpacity.exitCode).toBe(0);
    expect(paneOpacity.stdout).toContain("0.72");

    const overlayOpacity = await harness.behavior.runCli([
      "set",
      "overlayOpacity",
      "0.97",
    ]);
    expect(overlayOpacity.exitCode).toBe(0);
    expect(overlayOpacity.stdout).toContain("0.97");

    const compact = await harness.behavior.runCli([
      "set",
      "compactSolidPanes",
      "off",
    ]);
    expect(compact.exitCode).toBe(0);
    expect(compact.stdout).toContain("false");

    const accent = await harness.behavior.runCli(["set", "accent", "violet"]);
    expect(accent.exitCode).toBe(0);
    expect(accent.stdout).toContain("280");

    const presets = await harness.behavior.runCli(["presets"]);
    expect(presets.stdout).toContain("aurora, forest, sunset, ocean, mono, custom");

    const reset = await harness.behavior.runCli(["reset"]);
    expect(reset.exitCode).toBe(0);
    const after = await harness.behavior.callRpc("getAppearance", null);
    expect(after).toMatchObject(DEFAULT_APPEARANCE);
  });

  it("refuses an unknown key, an out-of-range value, and an unknown command", async () => {
    expect((await harness.behavior.runCli(["set", "nope", "1"])).exitCode).toBe(2);
    expect((await harness.behavior.runCli(["set", "blur", "999"])).exitCode).toBe(2);
    expect((await harness.behavior.runCli(["wat"])).exitCode).toBe(2);
  });
});
