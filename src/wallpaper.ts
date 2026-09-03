/**
 * The bounded wallpaper route. It serves exactly one file — the absolute path
 * the user saved in `appearance.wallpaperPath` — and nothing else. A path never
 * arrives from the request, so there is no traversal surface: the request
 * carries only a cache-busting `?v=`, which is ignored.
 */
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";

import type { Appearance } from "./appearance.js";

export const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024;

export const WALLPAPER_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

export type WallpaperCheck =
  | { ok: true; path: string; contentType: string; bytes: number }
  | { ok: false; reason: string };

/** Everything the route refuses, in one testable place. */
export async function checkWallpaper(path: string | null): Promise<WallpaperCheck> {
  const candidate = path?.trim() ?? "";
  if (!candidate) return { ok: false, reason: "No wallpaper file is set." };
  if (!isAbsolute(candidate)) {
    return { ok: false, reason: "The wallpaper path must be absolute." };
  }
  const contentType = WALLPAPER_CONTENT_TYPES[extname(candidate).toLowerCase()];
  if (!contentType) {
    return {
      ok: false,
      reason: `Unsupported image type. Use ${Object.keys(WALLPAPER_CONTENT_TYPES).join(", ")}.`,
    };
  }
  let bytes: number;
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return { ok: false, reason: "That path is not a file." };
    bytes = info.size;
  } catch {
    return { ok: false, reason: "No file at that path." };
  }
  if (bytes > MAX_WALLPAPER_BYTES) {
    return {
      ok: false,
      reason: `The image is ${(bytes / 1024 / 1024).toFixed(1)} MB; the limit is 20 MB.`,
    };
  }
  return { ok: true, path: candidate, contentType, bytes };
}

/** Builds the route's Response for the current appearance. */
export async function wallpaperResponse(
  read: () => Promise<Appearance>,
): Promise<Response> {
  const appearance = await read();
  const check = await checkWallpaper(appearance.wallpaperPath);
  if (!check.ok) {
    return new Response(check.reason, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const body = await readFile(check.path);
  // The content script appends the server's write stamp as `?v=`, so every
  // change to the wallpaper is a new URL; the bytes behind one URL never
  // change and can sit in the browser cache instead of reloading with the
  // page. The ETag lets a stale cache revalidate without the body.
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "content-type": check.contentType,
      "content-length": String(check.bytes),
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${check.bytes}-${body.length}"`,
    },
  });
}
