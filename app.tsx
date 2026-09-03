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

/**
 * The host writes the active palette's CSS into this `<style>` element
 * (apps/app/src/lib/themes/index.ts). Observing it is how the content script
 * learns about a theme switch without polling the server.
 */
export const HOST_THEME_STYLE_ID = "bb-app-theme";

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

const THREAD_SCROLL_SELECTOR = '[data-thread-window] .thread-scrollbar';
const THREAD_COMPOSER_SELECTOR = '[data-follow-up-composer]';
const THREAD_COMPOSER_COLLAPSED_ATTRIBUTE = 'data-lg-thread-composer-collapsed';

/**
 * The host already owns the compact follow-up composer presentation. Bridge
 * the thread's scroll position to that presentation instead of duplicating
 * its layout rules in the theme.
 */
function installThreadComposerScrollBehavior(signal: AbortSignal): () => void {
  const attached = new Map<HTMLElement, () => void>();
  const lastScrollTop = new WeakMap<HTMLElement, number>();

  const update = (scrollArea: HTMLElement): void => {
    const thread = scrollArea.closest<HTMLElement>('[data-thread-window]');
    const composer = thread?.querySelector<HTMLElement>(THREAD_COMPOSER_SELECTOR);
    if (!thread || !composer) return;

    const current = scrollArea.scrollTop;
    const previous = lastScrollTop.get(scrollArea) ?? current;
    lastScrollTop.set(scrollArea, current);
    const distanceFromBottom =
      scrollArea.scrollHeight - scrollArea.clientHeight - current;

    if (composer.contains(document.activeElement) || distanceFromBottom <= 8) {
      thread.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
      return;
    }

    if (current < previous - 2) {
      thread.setAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE, '');
    }
  };

  const scan = (): void => {
    const currentAreas = new Set(
      Array.from(document.querySelectorAll<HTMLElement>(THREAD_SCROLL_SELECTOR)),
    );

    for (const scrollArea of currentAreas) {
      if (attached.has(scrollArea)) continue;
      lastScrollTop.set(scrollArea, scrollArea.scrollTop);
      const onScroll = () => update(scrollArea);
      scrollArea.addEventListener('scroll', onScroll, { passive: true });
      attached.set(scrollArea, () =>
        scrollArea.removeEventListener('scroll', onScroll),
      );
    }

    for (const [scrollArea, detach] of attached) {
      if (currentAreas.has(scrollArea)) continue;
      detach();
      attached.delete(scrollArea);
      scrollArea
        .closest<HTMLElement>('[data-thread-window]')
        ?.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    target
      .closest<HTMLElement>(THREAD_COMPOSER_SELECTOR)
      ?.closest<HTMLElement>('[data-thread-window]')
      ?.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
  };

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('focusin', onFocusIn, true);
  scan();

  const dispose = (): void => {
    observer.disconnect();
    document.removeEventListener('focusin', onFocusIn, true);
    for (const [scrollArea, detach] of attached) {
      detach();
      scrollArea
        .closest<HTMLElement>('[data-thread-window]')
        ?.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
    }
    attached.clear();
  };
  signal.addEventListener('abort', dispose, { once: true });
  return dispose;
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

      // No timers: three signals cover every way the appearance can change.
      // 1. This window edits it — the settings section fires this event after
      //    each write and when the server's realtime signal arrives.
      window.addEventListener(APPEARANCE_EVENT, () => void paint(), { signal });

      // 2. The palette switches (Settings, `bb theme set`, another client) —
      //    the host rewrites its theme <style>; repaint when that text changes.
      const styleObserver = new MutationObserver(() => void paint());
      const observeThemeStyle = (): boolean => {
        const style = document.getElementById(HOST_THEME_STYLE_ID);
        if (!style) return false;
        styleObserver.observe(style, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        return true;
      };
      const headObserver = new MutationObserver(() => {
        if (!observeThemeStyle()) return;
        headObserver.disconnect();
        // The host creates the element and fills it in the same tick, before
        // the style observer above could see that first write.
        void paint();
      });
      if (!observeThemeStyle()) {
        headObserver.observe(document.head, { childList: true });
      }

      // 3. Edits made on another device — refetch once when this window comes
      //    back into view rather than while nobody is looking at it.
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") void paint();
      };
      document.addEventListener("visibilitychange", onVisibilityChange, {
        signal,
      });

      return () => {
        disposed = true;
        styleObserver.disconnect();
        headObserver.disconnect();
        clearVars();
      };
    },
  });

  app.contentScripts.register({
    id: "thread-composer-scroll-state",
    mount({ signal }) {
      return installThreadComposerScrollBehavior(signal);
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
