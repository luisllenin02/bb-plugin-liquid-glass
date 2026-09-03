/**
 * Composer dock — keeps the plugin banner stack (goal, todos, workflow runs,
 * context meter) that the host renders above the prompt box out of the
 * chat's way. Three presentations:
 *
 * - `cards`: the host's stack, untouched.
 * - `stack`: the cards tuck behind the prompt box as a translucent deck. Each
 *   shows only its header strip; hovering or clicking a card lifts it to full
 *   height, a second click puts it back.
 * - `pills`: one slim row of live status pills; tapping a pill opens just
 *   that card beneath the row, tapping again puts it away.
 *
 * The cards stay mounted in every mode, so their plugins keep updating. Mode
 * is a per-browser preference: `auto` (pills on phones and touch screens,
 * cards on desktop), `cards`, `stack`, or `pills`.
 */

export type DockMode = "auto" | "cards" | "stack" | "pills";
export type DockPresentation = Exclude<DockMode, "auto">;

export const DOCK_MODE_KEY = "liquid-glass:composer-dock";
export const DOCK_MODE_EVENT = "liquid-glass:composer-dock-change";
/** Pills mode marker on the composer. */
export const DOCK_COLLAPSED_ATTRIBUTE = "data-lg-dock-collapsed";
/** Stack mode marker on the composer. */
export const DOCK_STACK_ATTRIBUTE = "data-lg-dock-stack";
export const DOCK_HIDDEN_ATTRIBUTE = "data-lg-dock-hidden";
export const DOCK_EMPTY_ATTRIBUTE = "data-lg-dock-empty";
/** Written onto the composer element on every scan: how many cards sit above the prompt box. */
export const DOCK_CARDS_ATTRIBUTE = "data-lg-dock-cards";
export const DOCK_LEAF_ATTRIBUTE = "data-lg-dock-leaf";
export const DOCK_DEPTH_ATTRIBUTE = "data-lg-dock-depth";
export const DOCK_OPEN_ATTRIBUTE = "data-lg-dock-open";
export const DOCK_CLASS = "lg-dock";
export const COMPACT_MEDIA = "(max-width: 767px), (pointer: coarse)";
const STACK_SELECTOR = "[data-app-composer] > .grid";
const MAX_PILL_CHARS = 28;
const INTERACTIVE_SELECTOR = "button, a, input, textarea, select, [role='button'], [contenteditable]";

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

/* Stack: a translucent deck tucked behind the prompt box. The last card is
   the front of the deck, flush against the prompt box; earlier cards sit
   behind it, each narrower and showing only a header strip. */
[${DOCK_STACK_ATTRIBUTE}] > .grid { row-gap: 0; margin-bottom: -10px; position: relative; z-index: 0; }
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}] {
  position: relative;
  z-index: calc(12 - var(--lg-dock-depth, 0));
  max-height: 38px;
  overflow: hidden;
  margin-top: -16px;
  border-radius: 12px;
  transform: scale(calc(1 - var(--lg-dock-depth, 0) * 0.035));
  transform-origin: 50% 100%;
  background-color: hsl(var(--glass-h, 240) var(--glass-s, 0%) var(--glass-l, 9%) / 0.55) !important;
  -webkit-backdrop-filter: blur(var(--lg-chrome-blur, 20px)) saturate(1.2);
  backdrop-filter: blur(var(--lg-chrome-blur, 20px)) saturate(1.2);
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.08), 0 -2px 10px hsl(0 0% 0% / 0.25);
  cursor: pointer;
  transition: max-height 220ms cubic-bezier(0.2, 0, 0, 1), transform 220ms cubic-bezier(0.2, 0, 0, 1), background-color 160ms ease;
}
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_DEPTH_ATTRIBUTE}="first"] { margin-top: 0; }
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}]:hover,
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_OPEN_ATTRIBUTE}="true"] {
  max-height: 70vh;
  z-index: 20;
  transform: none;
  cursor: default;
  background-color: hsl(var(--glass-h, 240) var(--glass-s, 0%) var(--glass-l, 9%) / 0.92) !important;
}
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_OPEN_ATTRIBUTE}="true"] { cursor: pointer; }
@media (prefers-reduced-motion: reduce) {
  [${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}] { transition: none; }
}
`;

export function readDockMode(): DockMode {
  try {
    const value = window.localStorage.getItem(DOCK_MODE_KEY);
    return value === "pills" || value === "cards" || value === "stack" ? value : "auto";
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

/** What `auto` means here and now, so the glyph and the dock agree. */
export function resolveDockMode(mode: DockMode = readDockMode()): DockPresentation {
  if (mode !== "auto") return mode;
  const phone =
    typeof window.matchMedia === "function" && window.matchMedia(COMPACT_MEDIA).matches;
  return phone ? "pills" : "cards";
}

/** Cards → stack (minimize) → pills (hide) → cards. */
export function nextDockMode(current: DockPresentation): DockPresentation {
  if (current === "cards") return "stack";
  if (current === "stack") return "pills";
  return "cards";
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
 * One card per leaf. The host wraps each banner in a `display: contents` div
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
  return out.filter((leaf) => visibleText(headerOf(leaf)) !== "");
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

function clearDeckMarks(stack: Element): void {
  for (const element of Array.from(stack.querySelectorAll<HTMLElement>(`[${DOCK_LEAF_ATTRIBUTE}]`))) {
    element.removeAttribute(DOCK_LEAF_ATTRIBUTE);
    element.removeAttribute(DOCK_DEPTH_ATTRIBUTE);
    element.removeAttribute(DOCK_OPEN_ATTRIBUTE);
    element.style.removeProperty("--lg-dock-depth");
  }
}

function clearHiddenMarks(stack: Element): void {
  stack.removeAttribute(DOCK_EMPTY_ATTRIBUTE);
  for (const element of Array.from(stack.querySelectorAll(`[${DOCK_HIDDEN_ATTRIBUTE}]`))) {
    element.removeAttribute(DOCK_HIDDEN_ATTRIBUTE);
  }
}

/** Pills: hide every card except the expanded ones; a wrapper with no visible card hides too. */
function markHidden(stack: Element, leaves: Element[], expanded: Set<number>): void {
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

/** Stack: depth 0 is the front card (last, against the prompt box); earlier cards sit deeper. */
function markDeck(stack: Element, leaves: Element[], expanded: Set<number>): void {
  const last = leaves.length - 1;
  leaves.forEach((leaf, index) => {
    const element = leaf as HTMLElement;
    const depth = String(last - index);
    if (element.getAttribute(DOCK_LEAF_ATTRIBUTE) !== String(index)) {
      element.setAttribute(DOCK_LEAF_ATTRIBUTE, String(index));
    }
    const tier = index === 0 ? "first" : depth;
    if (element.getAttribute(DOCK_DEPTH_ATTRIBUTE) !== tier) {
      element.setAttribute(DOCK_DEPTH_ATTRIBUTE, tier);
    }
    if (element.style.getPropertyValue("--lg-dock-depth") !== depth) {
      element.style.setProperty("--lg-dock-depth", depth);
    }
    const open = expanded.has(index) ? "true" : "false";
    if (element.getAttribute(DOCK_OPEN_ATTRIBUTE) !== open) {
      element.setAttribute(DOCK_OPEN_ATTRIBUTE, open);
    }
  });
}

export function installComposerDock(signal: AbortSignal): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-lg-composer-dock", "");
  style.textContent = CSS;
  document.head.append(style);

  const media =
    typeof window.matchMedia === "function" ? window.matchMedia(COMPACT_MEDIA) : null;
  const expandedByComposer = new WeakMap<HTMLElement, Set<number>>();
  const stacksWithListener = new WeakSet<Element>();
  let mode = readDockMode();
  let pendingFrame: number | null = null;

  const expandedOf = (composer: HTMLElement): Set<number> => {
    let set = expandedByComposer.get(composer);
    if (!set) {
      set = new Set();
      expandedByComposer.set(composer, set);
    }
    return set;
  };

  const toggleIndex = (composer: HTMLElement, index: number): void => {
    const expanded = expandedOf(composer);
    if (expanded.has(index)) expanded.delete(index);
    else expanded.add(index);
    scan();
  };

  const onPillClick = (event: Event): void => {
    const pill = (event.target as Element | null)?.closest<HTMLElement>(`.${DOCK_CLASS}-pill`);
    const composer = pill?.closest<HTMLElement>("[data-app-composer]");
    if (!pill || !composer) return;
    toggleIndex(composer, Number(pill.dataset.index));
  };

  // In the deck, a click on a card's own surface pins it open or puts it
  // back; clicks on the card's controls (edit, close, expand) pass through.
  const onDeckClick = (event: Event): void => {
    const target = event.target as Element | null;
    const composer = target?.closest<HTMLElement>("[data-app-composer]");
    if (!composer || !composer.hasAttribute(DOCK_STACK_ATTRIBUTE)) return;
    const leaf = target?.closest<HTMLElement>(`[${DOCK_LEAF_ATTRIBUTE}]`);
    if (!leaf) return;
    const control = target?.closest(INTERACTIVE_SELECTOR);
    if (control && leaf.contains(control)) return;
    toggleIndex(composer, Number(leaf.getAttribute(DOCK_LEAF_ATTRIBUTE)));
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
    composer.removeAttribute(DOCK_STACK_ATTRIBUTE);
    clearHiddenMarks(stack);
    clearDeckMarks(stack);
  };

  const scan = (): void => {
    const presentation = resolveDockMode(mode);
    for (const stack of Array.from(document.querySelectorAll<HTMLElement>(STACK_SELECTOR))) {
      const composer = stack.parentElement;
      if (!composer) continue;
      const leaves = leavesOf(stack);
      const count = String(leaves.length);
      if (composer.getAttribute(DOCK_CARDS_ATTRIBUTE) !== count) {
        composer.setAttribute(DOCK_CARDS_ATTRIBUTE, count);
      }
      if (presentation === "cards" || leaves.length === 0) {
        release(composer, stack);
        continue;
      }
      const expanded = expandedOf(composer);
      for (const index of Array.from(expanded)) if (index >= leaves.length) expanded.delete(index);
      if (!stacksWithListener.has(stack)) {
        stack.addEventListener("click", onDeckClick);
        stacksWithListener.add(stack);
      }
      if (presentation === "stack") {
        composer.querySelector(`:scope > .${DOCK_CLASS}`)?.remove();
        composer.removeAttribute(DOCK_COLLAPSED_ATTRIBUTE);
        clearHiddenMarks(stack);
        composer.setAttribute(DOCK_STACK_ATTRIBUTE, "");
        markDeck(stack, leaves, expanded);
        continue;
      }
      composer.removeAttribute(DOCK_STACK_ATTRIBUTE);
      clearDeckMarks(stack);
      composer.setAttribute(DOCK_COLLAPSED_ATTRIBUTE, "");
      markHidden(stack, leaves, expanded);
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
  // and deck current without doing work on every mutation record.
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
      stack.removeEventListener("click", onDeckClick);
    }
    style.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
