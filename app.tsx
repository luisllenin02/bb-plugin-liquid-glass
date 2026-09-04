/**
 * Liquid Glass — frontend half.
 *
 * Registrations: a content script that writes the `--lg-*` custom
 * properties onto `document.documentElement` while one of this plugin's
 * palettes is active, the composer scroll and dock content scripts, and the
 * Settings → Liquid Glass section that changes the appearance.
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
import { DOCK_ATTRIBUTE_FILTER, installComposerDock } from "./src/composer-dock.js";
import { installHomeShellMarker } from "./src/home-shell.js";
import { DockToggleButton } from "./src/components/DockToggleButton.js";

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
const THREAD_WINDOW_SELECTOR = '[data-thread-window]';
const THREAD_COMPOSER_SELECTOR = '[data-follow-up-composer]';
const THREAD_COMPOSER_COLLAPSED_ATTRIBUTE = 'data-lg-thread-composer-collapsed';
const COMPOSER_COLLAPSE_DELAY_MS = 48;

/**
 * One document-wide MutationObserver for the whole plugin. Both content
 * scripts have to notice a newly mounted thread or composer, and two observers
 * on `document.body` mean the engine queues every mutation twice and two
 * full-document scans compete in the same frame. A watcher says which records
 * could change what it renders; the dirty ones run once, in the next frame.
 */
type DocumentWatcher = {
  wants(record: MutationRecord): boolean;
  scan(): void;
};

const watchers = new Set<DocumentWatcher>();
const dirtyWatchers = new Set<DocumentWatcher>();
let documentObserver: MutationObserver | null = null;
let watcherFrame: number | null = null;
/**
 * Bumped whenever nodes are added or removed anywhere. Per-frame code caches
 * DOM lookups against this stamp instead of repeating them: while the element
 * tree is unchanged, a cached answer is the same answer.
 */
let treeVersion = 0;

function flushWatchers(): void {
  watcherFrame = null;
  const due = Array.from(dirtyWatchers);
  dirtyWatchers.clear();
  for (const watcher of due) if (watchers.has(watcher)) watcher.scan();
}

function watchDocument(watcher: DocumentWatcher): () => void {
  watchers.add(watcher);
  if (documentObserver === null) {
    documentObserver = new MutationObserver((records) => {
      let structural = false;
      for (const record of records) {
        if (record.type === 'childList') structural = true;
        // Every watcher is already due: the rest of the burst is only worth
        // reading for the tree stamp.
        if (dirtyWatchers.size === watchers.size) continue;
        for (const candidate of watchers) {
          if (!dirtyWatchers.has(candidate) && candidate.wants(record)) {
            dirtyWatchers.add(candidate);
          }
        }
      }
      if (structural) treeVersion += 1;
      if (dirtyWatchers.size > 0 && watcherFrame === null) {
        watcherFrame = window.requestAnimationFrame(flushWatchers);
      }
    });
    documentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      // The union of what the watchers need: only the dock reads attributes.
      attributeFilter: DOCK_ATTRIBUTE_FILTER,
    });
  }
  return () => {
    watchers.delete(watcher);
    dirtyWatchers.delete(watcher);
    if (watchers.size > 0) return;
    documentObserver?.disconnect();
    documentObserver = null;
    if (watcherFrame !== null) {
      window.cancelAnimationFrame(watcherFrame);
      watcherFrame = null;
    }
  };
}

/**
 * The host already owns the compact follow-up composer presentation. Bridge
 * the thread's scroll position to that presentation instead of duplicating
 * its layout rules in the theme.
 */
function installThreadComposerScrollBehavior(signal: AbortSignal): () => void {
  const attached = new Map<HTMLElement, () => void>();
  const lastScrollTop = new WeakMap<HTMLElement, number>();
  const pendingFrames = new Map<HTMLElement, number>();
  const pendingCollapseTimers = new Map<HTMLElement, number>();
  let pendingWindowFrame: number | null = null;
  let lastWindowScrollTop =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;

  // Both scroll paths need a thread's follow-up composer on every frame, and
  // `querySelector` on a thread window walks the whole transcript to find it.
  // The answer can only change when nodes move, so cache it against the tree
  // stamp: during a scroll gesture that is one lookup, not one per frame.
  const composerByThread = new WeakMap<
    HTMLElement,
    { version: number; composer: HTMLElement | null }
  >();
  const composerOf = (thread: HTMLElement): HTMLElement | null => {
    const cached = composerByThread.get(thread);
    if (cached !== undefined && cached.version === treeVersion) return cached.composer;
    const composer = thread.querySelector<HTMLElement>(THREAD_COMPOSER_SELECTOR);
    composerByThread.set(thread, { version: treeVersion, composer });
    return composer;
  };

  // Same again for the threads that scroll with the window (phones): finding
  // them cost a document-wide query plus a descendant query per thread on
  // every scroll frame.
  let windowThreads: HTMLElement[] = [];
  let windowThreadsVersion = -1;
  const windowScrolledThreads = (): HTMLElement[] => {
    if (windowThreadsVersion === treeVersion) return windowThreads;
    windowThreadsVersion = treeVersion;
    const found = document.querySelectorAll<HTMLElement>(THREAD_WINDOW_SELECTOR);
    windowThreads = [];
    for (let index = 0; index < found.length; index += 1) {
      const thread = found[index];
      if (!thread.querySelector(THREAD_SCROLL_SELECTOR)) windowThreads.push(thread);
    }
    return windowThreads;
  };

  const cancelPendingCollapse = (thread: HTMLElement): void => {
    const timer = pendingCollapseTimers.get(thread);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    pendingCollapseTimers.delete(thread);
  };

  const scheduleCollapse = (thread: HTMLElement): void => {
    // Do not rearm on every scroll event. One brief guard gives the browser a
    // frame to settle its scroll position, while still responding to the first
    // upward movement rather than the end of the gesture.
    if (pendingCollapseTimers.has(thread)) return;
    const timer = window.setTimeout(() => {
      pendingCollapseTimers.delete(thread);
      thread.setAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE, '');
    }, COMPOSER_COLLAPSE_DELAY_MS);
    pendingCollapseTimers.set(thread, timer);
  };

  const setScrollState = (
    thread: HTMLElement,
    current: number,
    previous: number,
    distanceFromBottom: number,
  ): void => {
    // Focus does not pin the composer open: reading back through the thread
    // with the caret still in the box compacts it like any other scroll.
    // Focusing the box (onFocusIn) and reaching the bottom both expand it.
    if (distanceFromBottom <= 8) {
      cancelPendingCollapse(thread);
      if (thread.hasAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE)) {
        thread.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
      }
      return;
    }

    if (current < previous - 2) {
      if (!thread.hasAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE)) {
        scheduleCollapse(thread);
      }
    } else if (current > previous + 2) {
      cancelPendingCollapse(thread);
    }
  };

  const update = (scrollArea: HTMLElement): void => {
    const thread = scrollArea.closest<HTMLElement>(THREAD_WINDOW_SELECTOR);
    if (!thread || composerOf(thread) === null) return;

    const current = scrollArea.scrollTop;
    const previous = lastScrollTop.get(scrollArea) ?? current;
    lastScrollTop.set(scrollArea, current);
    const distanceFromBottom =
      scrollArea.scrollHeight - scrollArea.clientHeight - current;
    setScrollState(thread, current, previous, distanceFromBottom);
  };

  const scheduleUpdate = (scrollArea: HTMLElement): void => {
    if (pendingFrames.has(scrollArea)) return;
    const frame = window.requestAnimationFrame(() => {
      pendingFrames.delete(scrollArea);
      update(scrollArea);
    });
    pendingFrames.set(scrollArea, frame);
  };

  const updateWindowScroll = (): void => {
    const current =
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    const previous = lastWindowScrollTop;
    lastWindowScrollTop = current;
    // Nothing folds with the window on this page: skip the height reads too.
    const threads = windowScrolledThreads();
    if (threads.length === 0) return;
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    for (const thread of threads) {
      if (composerOf(thread) === null) continue;
      setScrollState(thread, current, previous, documentHeight - viewportHeight - current);
    }
  };

  const scan = (): void => {
    const currentAreas = new Set(
      Array.from(document.querySelectorAll<HTMLElement>(THREAD_SCROLL_SELECTOR)),
    );

    for (const scrollArea of currentAreas) {
      if (attached.has(scrollArea)) continue;
      lastScrollTop.set(scrollArea, scrollArea.scrollTop);
      const onScroll = () => scheduleUpdate(scrollArea);
      scrollArea.addEventListener('scroll', onScroll, { passive: true });
      attached.set(scrollArea, () => {
        scrollArea.removeEventListener('scroll', onScroll);
        const frame = pendingFrames.get(scrollArea);
        if (frame !== undefined) {
          window.cancelAnimationFrame(frame);
          pendingFrames.delete(scrollArea);
        }
      });
    }

    for (const [scrollArea, detach] of attached) {
      if (currentAreas.has(scrollArea)) continue;
      detach();
      attached.delete(scrollArea);
      const thread = scrollArea.closest<HTMLElement>(THREAD_WINDOW_SELECTOR);
      if (thread) {
        cancelPendingCollapse(thread);
        thread.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
      }
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const thread = target
      .closest<HTMLElement>(THREAD_COMPOSER_SELECTOR)
      ?.closest<HTMLElement>(THREAD_WINDOW_SELECTOR);
    if (!thread) return;
    cancelPendingCollapse(thread);
    thread.removeAttribute(THREAD_COMPOSER_COLLAPSED_ATTRIBUTE);
  };

  // Panel activation and portalled pickers can produce dozens of DOM mutations
  // in one interaction. Scanning the entire document for every callback made
  // those interactions compete with rendering; one scan in the next frame
  // keeps newly mounted threads discoverable without extending the input task.
  // Only added or removed nodes can change which scroll areas exist — text and
  // attribute records (a streaming reply) cannot, so they cost nothing here.
  const unwatch = watchDocument({
    wants: (record) => record.type === 'childList',
    scan,
  });
  document.addEventListener('focusin', onFocusIn, true);
  const onWindowScroll = (): void => {
    if (pendingWindowFrame !== null) return;
    pendingWindowFrame = window.requestAnimationFrame(() => {
      pendingWindowFrame = null;
      updateWindowScroll();
    });
  };
  window.addEventListener('scroll', onWindowScroll, { passive: true });
  scan();

  const dispose = (): void => {
    unwatch();
    document.removeEventListener('focusin', onFocusIn, true);
    window.removeEventListener('scroll', onWindowScroll);
    for (const frame of pendingFrames.values()) window.cancelAnimationFrame(frame);
    pendingFrames.clear();
    for (const timer of pendingCollapseTimers.values()) window.clearTimeout(timer);
    pendingCollapseTimers.clear();
    if (pendingWindowFrame !== null) {
      window.cancelAnimationFrame(pendingWindowFrame);
      pendingWindowFrame = null;
    }
    for (const [scrollArea, detach] of attached) {
      detach();
      scrollArea
        .closest<HTMLElement>(THREAD_WINDOW_SELECTOR)
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

  // Fold the goal/todo/workflow/context cards above the prompt box into one
  // line of live status pills (phones by default; a per-browser setting).
  app.contentScripts.register({
    id: "composer-dock",
    mount({ signal }) {
      return installComposerDock(signal, watchDocument);
    },
  });

  // Flag the document while the new-thread home screen is mounted, so the
  // theme can paint the phone's safe-area strip under its dock from the one
  // ancestor the host does not clip (see the compact media block).
  app.contentScripts.register({
    id: "home-shell",
    mount({ signal }) {
      return installHomeShellMarker(signal, watchDocument);
    },
  });

  // The fold/unfold button lives in the prompt box's own action row.
  app.composer.customize({
    id: "composer-dock",
    scopes: ["thread"],
    actions: [{ id: "toggle", component: DockToggleButton }],
  });

  app.slots.settingsSection({
    id: "appearance",
    title: "Liquid Glass",
    description:
      "The shell tint, accent, glass opacity, and wallpaper for the Liquid Glass palettes.",
    component: AppearanceSection,
  });
});
