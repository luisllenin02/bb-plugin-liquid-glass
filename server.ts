/**
 * Liquid Glass — server half.
 *
 * The palettes themselves are declarative (`bb.themes` in package.json); this
 * file owns the user's appearance: one kv row, three RPCs, one realtime signal,
 * one bounded wallpaper route, and the `bb liquid-glass` CLI command.
 */
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

import {
  DEFAULT_APPEARANCE,
  appearancePatchSchema,
  appearanceSchema,
  normalize,
  type Appearance,
} from "./src/appearance.js";
import {
  CLI_COMMANDS,
  CLI_USAGE,
  formatAppearance,
  formatPresets,
  parseSet,
} from "./src/cli.js";
import { checkWallpaper, wallpaperResponse } from "./src/wallpaper.js";

const APPEARANCE_KEY = "appearance";
export const APPEARANCE_CHANNEL = "appearance";

const appearanceWithThemeSchema = appearanceSchema.extend({
  /** The active bb theme id, so the frontend only paints for our palettes. */
  activeThemeId: z.string().nullable(),
  /** Bumped on every write; the frontend uses it to cache-bust the wallpaper. */
  updatedAt: z.number(),
});

const paletteIdSchema = z.enum(["liquid-glass", "liquid-glass-light"]);

export const rpcContract = defineRpcContract({
  getAppearance: { input: z.null(), output: appearanceWithThemeSchema },
  setAppearance: { input: appearancePatchSchema, output: appearanceWithThemeSchema },
  resetAppearance: { input: z.null(), output: appearanceWithThemeSchema },
  applyTheme: {
    input: z.object({ id: paletteIdSchema }).strict(),
    output: z.object({ activeThemeId: z.string() }).strict(),
  },
  testWallpaper: {
    input: z.object({ path: z.string() }).strict(),
    output: z.object({ ok: z.boolean(), detail: z.string() }).strict(),
  },
});

export default function plugin(bb: BbPluginApi) {
  let updatedAt = 0;

  async function read(): Promise<Appearance> {
    const stored = await bb.storage.kv.get<unknown>(APPEARANCE_KEY);
    if (stored === undefined) return DEFAULT_APPEARANCE;
    const migrated = normalize(stored);
    // Older rows do not have the phase-two controls. Persist the normalized
    // shape once so subsequent reads (including CLI `show`) see a complete row.
    if (!appearanceSchema.safeParse(stored).success) {
      await bb.storage.kv.set(APPEARANCE_KEY, migrated);
    }
    return migrated;
  }

  async function activeThemeId(): Promise<string | null> {
    try {
      const theme = await bb.sdk.theme.get();
      return theme.themeId ?? null;
    } catch (error) {
      // A theme read is not worth failing an appearance read over; the content
      // script simply keeps whatever it last resolved.
      bb.log.warn(`could not read the active theme: ${String(error)}`);
      return null;
    }
  }

  async function decorate(appearance: Appearance) {
    return { ...appearance, activeThemeId: await activeThemeId(), updatedAt };
  }

  async function write(patch: unknown, reason: string) {
    const parsed = appearancePatchSchema.parse(patch);
    const next = appearanceSchema.parse({ ...(await read()), ...parsed });
    await bb.storage.kv.set(APPEARANCE_KEY, next);
    updatedAt = Date.now();
    bb.realtime.publish(APPEARANCE_CHANNEL, { reason });
    return next;
  }

  bb.rpc.register(rpcContract, {
    async getAppearance() {
      return decorate(await read());
    },
    async setAppearance(patch) {
      return decorate(await write(patch, "set"));
    },
    async resetAppearance() {
      await bb.storage.kv.set(APPEARANCE_KEY, DEFAULT_APPEARANCE);
      updatedAt = Date.now();
      bb.realtime.publish(APPEARANCE_CHANNEL, { reason: "reset" });
      return decorate(DEFAULT_APPEARANCE);
    },
    async applyTheme({ id }) {
      const activeThemeId = `plugin:liquid-glass:${id}`;
      await bb.sdk.theme.set(activeThemeId);
      bb.realtime.publish(APPEARANCE_CHANNEL, { reason: "theme" });
      return { activeThemeId };
    },
    async testWallpaper({ path }) {
      const check = await checkWallpaper(path);
      return {
        ok: check.ok,
        detail: check.ok
          ? `Readable ${check.contentType}, ${(check.bytes / 1024).toFixed(0)} KB.`
          : check.reason,
      };
    },
  });

  bb.http.route("GET", "/wallpaper", () => wallpaperResponse(read));

  bb.cli.register({
    name: "liquid-glass",
    summary: "Read and change the Liquid Glass appearance (shell tint, accent, wallpaper).",
    commands: CLI_COMMANDS,
    async run(argv) {
      const [command, ...rest] = argv;
      if (command === undefined || command === "help") {
        return { exitCode: 0, stdout: CLI_USAGE };
      }
      if (command === "show") {
        return { exitCode: 0, stdout: formatAppearance(await read()) };
      }
      if (command === "presets") {
        return { exitCode: 0, stdout: formatPresets() };
      }
      if (command === "reset") {
        await bb.storage.kv.set(APPEARANCE_KEY, DEFAULT_APPEARANCE);
        updatedAt = Date.now();
        bb.realtime.publish(APPEARANCE_CHANNEL, { reason: "reset" });
        return { exitCode: 0, stdout: formatAppearance(DEFAULT_APPEARANCE) };
      }
      if (command === "set") {
        const [key, ...valueParts] = rest;
        if (key === undefined || valueParts.length === 0) {
          return { exitCode: 2, stderr: "Usage: bb liquid-glass set <key> <value>" };
        }
        const parsed = parseSet(key, valueParts.join(" "));
        if (!parsed.ok) return { exitCode: 2, stderr: parsed.error };
        return { exitCode: 0, stdout: formatAppearance(await write(parsed.patch, "cli")) };
      }
      return { exitCode: 2, stderr: `Unknown command "${command}".\n${CLI_USAGE}` };
    },
  });

  bb.log.info("liquid-glass appearance surfaces registered");
}
