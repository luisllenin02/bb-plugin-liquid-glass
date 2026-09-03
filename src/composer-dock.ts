/**
 * Composer dock — keeps the plugin banner stack (goal, todos, workflow runs,
 * context meter) that the host renders above the prompt box out of the
 * chat's way. In pill mode the stack is replaced by one slim row of live
 * status pills; tapping a pill opens just that card beneath the row, and
 * tapping it again puts the card away. There is no extra chrome: the pills
 * are the control. The cards stay mounted (only hidden), so their plugins
 * keep updating and the pills mirror them.
 *
 * Mode is a per-browser preference: `auto` (pills on phones and touch
 * screens, cards on desktop), `pills`, or `cards`.
 */

export type DockMode = "auto" | "pills" | "cards";

export const DOCK_MODE_KEY = "liquid-glass:composer-dock";
export const DOCK_MODE_EVENT = "liquid-glass:composer-dock-change";
export const DOCK_COLLAPSED_ATTRIBUTE = "data-lg-dock-collapsed";
export const DOCK_HIDDEN_ATTRIBUTE = "data-lg-dock-hidden";
export const DOCK_EMPTY_ATTRIBUTE = "data-lg-dock-empty";
/** Written onto the composer element on every scan: how many cards sit above the prompt box. */
export const DOCK_CARDS_ATTRIBUTE = "data-lg-dock-cards";
export const DOCK_CLASS = "lg-dock";
export const COMPACT_MEDIA = "(max-width: 767px), (pointer: coarse)";
const STACK_SELECTOR = "[data-app-composer] > .grid";
const MAX_PILL_CHARS = 28;

const CSS = `
[${DOCK_COLLAPSED_ATTRIBUTE}] > .grid[${DOCK_EMPTY_ATTRIBUTE}] { display: none; }
[${DOCK_COLLAPSED_ATTRIBUTE}] > .grid [${DOCK_HIDDEN_ATTRIBUTE}] { display: none; }
.${DOCK_CLASS} { display: flex; align-items: center; min-width: 0; height: 24px; }
.${DOCK_CLASS}-pills {
  display: flex; flex: 1 1 auto; min-width: 0; align-items: center; gap: 6px;
  overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
  padding-right: 14px;
  mask-image: linear-gradient(to right, black calc(100% - 18px), transparent);
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 18px), transparent);
}
.${DOCK_CLASS}-pills::-webkit-scrollbar { display: none; }
.${DOCK_CLASS}-pill {
  display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto;
  height: 22px; padding: 0 9px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--popover);
  color: var(--popover-foreground); font: 500 11px/1 ui-sans-serif, system-ui, sans-serif;
  font-variant-numeric: tabular-nums; letter-spacing: 0.01em; white-space: nowrap;
  cursor: pointer; max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
}
.${DOCK_CLASS}-pill:focus-visible { outline: 2px solid var(--ring, var(--primary)); outline-offset: 1px; }
.${DOCK_CLASS}-pill svg { width: 12px; height: 12px; flex: 0 0 auto; }
.${DOCK_CLASS}-pill[data-tone="live"] { border-color: color-mix(in srgb, var(--primary) 60%, var(--border)); }
.${DOCK_CLASS}-pill[data-tone="alert"] { border-color: color-mix(in srgb, var(--destructive, #e5484d) 60%, var(--border)); }
.${DOCK_CLASS}-pill[data-active="true"] { background: var(--accent); color: var(--accent-foreground, var(--foreground)); border-color: color-mix(in srgb, var(--foreground) 24%, var(--border)); }
.${DOCK_CLASS}-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted-foreground); flex: 0 0 auto; }
.${DOCK_CLASS}-pill[data-tone="live"] .${DOCK_CLASS}-dot { background: var(--primary); }
.${DOCK_CLASS}-pill[data-tone="alert"] .${DOCK_CLASS}-dot { background: var(--destructive, #e5484d); }
`;

export function readDockMode(): DockMode {
  try {
    const value = window.localStorage.getItem(DOCK_MODE_KEY);
    return value === "pills" || value === "cards" ? value : "auto";
  } catch {
    return "auto";
  }
}

export function writeDockMode(mode: DockMode): void {
  try {
    if (mode === "auto") window.localStorage.removeItem(DOCK_MODE_KEY);
    else window.localStorage.setItem(DOCK_MODE_KEY, mode);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(DOCK_MODE_EVENT));
}

function compact(text: string): string {
  return text.length > MAX_PILL_CHARS ? `${text.slice(0, MAX_PILL_CHARS - 1)}…` : text;
}

/** `textContent` runs adjacent labels together ("GoalPaused0 of 4"); join text nodes with spaces instead. */
function visibleText(root: Element): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue?.replace(/\s+/g, " ").trim();
    if (value) parts.push(value);
  }
  return parts.join(" ").replace(/\s+([,.:])/g, "$1").replace(/~\s+/g, "~");
}

/** The first row of a banner is its status line; bodies and progress bars are noise here. */
function headerOf(banner: Element): Element {
  return (
    banner.querySelector('[class*="header-row"], [class*="header"], header') ??
    banner.firstElementChild ??
    banner
  );
}

function toneOf(banner: Element, text: string): "live" | "alert" | "idle" {
  const status = banner.getAttribute("data-status") ?? "";
  const haystack = `${status} ${text}`;
  if (/blocked|error|fail/i.test(haystack)) return "alert";
  if (
    /running|active|agents|working/i.test(haystack) ||
    banner.getAttribute("data-full-active") === "true" ||
    banner.querySelector('.animate-pulse, [data-running="true"]') !== null
  ) {
    return "live";
  }
  return "idle";
}

/**
 * One pill per card. The host wraps each banner in a `display: contents` div
 * (often empty when a plugin has nothing to show), and a plugin may stack
 * several cards in one `space-y-2` group (workflow runs); look through both.
 */
function isWrapper(element: Element): boolean {
  return (
    element.classList.contains("contents") ||
    element.matches("section.space-y-2, div.space-y-2")
  );
}

function leavesOf(stack: Element): Element[] {
  const out: Element[] = [];
  const visit = (element: Element): void => {
    if (element.classList.contains(DOCK_CLASS)) return;
    if (isWrapper(element)) {
      for (const child of Array.from(element.children)) visit(child);
      return;
    }
    out.push(element);
  };
  for (const child of Array.from(stack.children)) visit(child);
  return out;
}

/**
 * Reconcile pills in place, keyed by card index. Workflow cards re-render
 * every second (elapsed time), so replacing the pill nodes would detach the
 * element under a finger mid-tap; updating text and state keeps them stable.
 */
function renderPills(dock: HTMLElement, leaves: Element[], expanded: Set<number>): void {
  const pills = dock.querySelector<HTMLElement>(`.${DOCK_CLASS}-pills`);
  if (!pills) return;
  const existing = new Map<string, HTMLElement>();
  for (const pill of Array.from(pills.querySelectorAll<HTMLElement>(`.${DOCK_CLASS}-pill`))) {
    existing.set(pill.dataset.index ?? "", pill);
  }
  let cursor: HTMLElement | null = null;
  leaves.forEach((leaf, index) => {
    const header = headerOf(leaf);
    const full = visibleText(header);
    const text = compact(full);
    if (!text) return;
    const key = String(index);
    const tone = toneOf(leaf, full);
    const icon = header.querySelector("svg");
    const active = expanded.has(index);
    let pill = existing.get(key) ?? null;
    if (!pill) {
      pill = document.createElement("button");
      pill.setAttribute("type", "button");
      pill.className = `${DOCK_CLASS}-pill`;
      pill.dataset.index = key;
      pill.append(document.createElement("span"), document.createTextNode(""));
    }
    existing.delete(key);
    if (pill.dataset.tone !== tone) pill.dataset.tone = tone;
    const activeValue = active ? "true" : "false";
    if (pill.dataset.active !== activeValue) {
      pill.dataset.active = activeValue;
      pill.setAttribute("aria-pressed", activeValue);
    }
    const title = active ? `${full} — tap to put the card away` : `${full} — tap to open the card`;
    if (pill.title !== title) pill.title = title;
    const lead = pill.firstChild as Element | null;
    const wantIcon = icon !== null;
    const hasIcon = lead?.tagName?.toLowerCase() === "svg";
    if (wantIcon && !hasIcon && lead) lead.replaceWith(icon.cloneNode(true));
    else if (!wantIcon && (hasIcon || !lead?.classList.contains(`${DOCK_CLASS}-dot`)) && lead) {
      const dot = document.createElement("span");
      dot.className = `${DOCK_CLASS}-dot`;
      lead.replaceWith(dot);
    }
    const label = pill.lastChild;
    if (label && label.nodeType === Node.TEXT_NODE) {
      if (label.nodeValue !== text) label.nodeValue = text;
    } else {
      pill.append(document.createTextNode(text));
    }
    const anchor: ChildNode | null = cursor ? cursor.nextSibling : pills.firstChild;
    if (pill !== anchor) pills.insertBefore(pill, anchor);
    cursor = pill;
  });
  for (const stale of existing.values()) stale.remove();
}

function clearMarks(stack: Element): void {
  stack.removeAttribute(DOCK_EMPTY_ATTRIBUTE);
  for (const marked of Array.from(stack.querySelectorAll(`[${DOCK_HIDDEN_ATTRIBUTE}]`))) {
    marked.removeAttribute(DOCK_HIDDEN_ATTRIBUTE);
  }
}

/** Hide every card except the expanded ones; a wrapper with no visible card hides too. */
function markLeaves(stack: Element, leaves: Element[], expanded: Set<number>): void {
  let visible = 0;
  const wrappers = new Map<Element, boolean>();
  leaves.forEach((leaf, index) => {
    const show = expanded.has(index);
    if (show) visible += 1;
    leaf.toggleAttribute(DOCK_HIDDEN_ATTRIBUTE, !show);
    for (let parent = leaf.parentElement; parent && parent !== stack; parent = parent.parentElement) {
      wrappers.set(parent, (wrappers.get(parent) ?? false) || show);
    }
  });
  for (const [wrapper, anyVisible] of wrappers) {
    wrapper.toggleAttribute(DOCK_HIDDEN_ATTRIBUTE, !anyVisible);
  }
  stack.toggleAttribute(DOCK_EMPTY_ATTRIBUTE, visible === 0);
}

export function installComposerDock(signal: AbortSignal): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-lg-composer-dock", "");
  style.textContent = CSS;
  document.head.append(style);

  const media =
    typeof window.matchMedia === "function" ? window.matchMedia(COMPACT_MEDIA) : null;
  const expandedByComposer = new WeakMap<HTMLElement, Set<number>>();
  let mode = readDockMode();
  let pendingFrame: number | null = null;

  const isCompact = (): boolean =>
    mode === "pills" || (mode === "auto" && (media?.matches ?? false));

  const expandedOf = (composer: HTMLElement): Set<number> => {
    let set = expandedByComposer.get(composer);
    if (!set) {
      set = new Set();
      expandedByComposer.set(composer, set);
    }
    return set;
  };

  const onPillClick = (event: Event): void => {
    const pill = (event.target as Element | null)?.closest<HTMLElement>(`.${DOCK_CLASS}-pill`);
    const composer = pill?.closest<HTMLElement>("[data-app-composer]");
    if (!pill || !composer) return;
    const index = Number(pill.dataset.index);
    const expanded = expandedOf(composer);
    if (expanded.has(index)) expanded.delete(index);
    else expanded.add(index);
    scan();
  };

  const ensureDock = (composer: HTMLElement, stack: Element): HTMLElement => {
    let dock = composer.querySelector<HTMLElement>(`:scope > .${DOCK_CLASS}`);
    if (!dock) {
      dock = document.createElement("div");
      dock.className = DOCK_CLASS;
      dock.setAttribute("data-lg-composer-dock", "");
      dock.setAttribute("role", "toolbar");
      dock.setAttribute("aria-label", "Status");
      const pills = document.createElement("div");
      pills.className = `${DOCK_CLASS}-pills`;
      pills.addEventListener("click", onPillClick);
      dock.append(pills);
      composer.insertBefore(dock, stack);
    }
    return dock;
  };

  const release = (composer: HTMLElement, stack: Element): void => {
    composer.querySelector(`:scope > .${DOCK_CLASS}`)?.remove();
    composer.removeAttribute(DOCK_COLLAPSED_ATTRIBUTE);
    clearMarks(stack);
  };

  const scan = (): void => {
    const compactNow = isCompact();
    for (const stack of Array.from(document.querySelectorAll<HTMLElement>(STACK_SELECTOR))) {
      const composer = stack.parentElement;
      if (!composer) continue;
      const leaves = leavesOf(stack).filter((leaf) => visibleText(headerOf(leaf)) !== "");
      const count = String(leaves.length);
      if (composer.getAttribute(DOCK_CARDS_ATTRIBUTE) !== count) {
        composer.setAttribute(DOCK_CARDS_ATTRIBUTE, count);
      }
      if (!compactNow || leaves.length === 0) {
        release(composer, stack);
        continue;
      }
      const expanded = expandedOf(composer);
      for (const index of Array.from(expanded)) if (index >= leaves.length) expanded.delete(index);
      composer.setAttribute(DOCK_COLLAPSED_ATTRIBUTE, "");
      markLeaves(stack, leaves, expanded);
      renderPills(ensureDock(composer, stack), leaves, expanded);
    }
  };

  const scheduleScan = (): void => {
    if (pendingFrame !== null) return;
    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = null;
      scan();
    });
  };

  const onModeChange = (): void => {
    mode = readDockMode();
    scan();
  };

  // The stack re-renders as runs progress; one scan per frame keeps the pills
  // current without doing work on every mutation record.
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-status", "data-full-active", "data-open"],
  });
  window.addEventListener(DOCK_MODE_EVENT, onModeChange);
  window.addEventListener("storage", onModeChange);
  media?.addEventListener("change", scan);
  scan();

  const dispose = (): void => {
    observer.disconnect();
    window.removeEventListener(DOCK_MODE_EVENT, onModeChange);
    window.removeEventListener("storage", onModeChange);
    media?.removeEventListener("change", scan);
    if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    for (const stack of Array.from(document.querySelectorAll<HTMLElement>(STACK_SELECTOR))) {
      const composer = stack.parentElement;
      if (!composer) continue;
      release(composer, stack);
      composer.removeAttribute(DOCK_CARDS_ATTRIBUTE);
    }
    style.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
