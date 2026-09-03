/**
 * bb's light/dark mode is a client-side setting (`localStorage["bb.theme"]`,
 * read through a jotai `atomWithStorage`). The originating tab never receives
 * its own `storage` event, so a synthetic one is dispatched — exactly what the
 * marketplace Theme Toggle plugin does.
 */
export type BbThemeMode = "light" | "dark" | "system";

export const BB_THEME_KEY = "bb.theme";

/** Same-window nudge from the settings section to the content script. */
export const APPEARANCE_EVENT = "liquid-glass:appearance";

export function readBbThemeMode(): BbThemeMode {
  try {
    const stored = localStorage.getItem(BB_THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function writeBbThemeMode(mode: BbThemeMode): void {
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(BB_THEME_KEY);
    localStorage.setItem(BB_THEME_KEY, mode);
  } catch {
    /* private mode — the class toggle below still applies */
  }
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: BB_THEME_KEY,
      oldValue: previous,
      newValue: mode,
      storageArea: globalThis.localStorage,
    }),
  );
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}
