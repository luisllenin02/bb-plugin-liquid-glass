/**
 * Composer dock — keeps the plugin banner stack (goal, todos, workflow runs,
 * context meter) that the host renders above the prompt box out of the
 * chat's way. Three presentations:
 *
 * - `cards`: the host's stack, untouched.
 * - `stack`: the cards tuck behind the prompt box as a translucent deck. Each
 *   shows only its header strip; hovering or clicking a card lifts it to full
 *   height and pushes the cards in front of it down, a second click puts it
 *   back. A rail on the deck's right edge lists the cards: hovering an entry
 *   previews that card, clicking it brings the card to the front.
 * - `pills`: one slim row of live status pills; tapping a pill opens just
 *   that card beneath the row, tapping again puts it away.
 *
 * The context meter can leave the stack altogether and sit under the prompt
 * box as a slim bar that expands on hover or click.
 *
 * The cards stay mounted in every mode, so their plugins keep updating. Mode
 * and meter placement are per-browser preferences: mode is `auto` (pills on
 * phones and touch screens, cards on desktop), `cards`, `stack`, or `pills`.
 */

export type DockMode = "auto" | "cards" | "stack" | "pills";
export type DockPresentation = Exclude<DockMode, "auto">;
export type MeterPlacement = "stack" | "under";

export const DOCK_MODE_KEY = "liquid-glass:composer-dock";
export const METER_PLACEMENT_KEY = "liquid-glass:context-meter";
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
export const DOCK_FIRST_ATTRIBUTE = "data-lg-dock-first";
export const DOCK_OPEN_ATTRIBUTE = "data-lg-dock-open";
export const DOCK_PREVIEW_ATTRIBUTE = "data-lg-dock-preview";
export const METER_ATTRIBUTE = "data-lg-dock-context";
export const METER_HOST_ATTRIBUTE = "data-lg-dock-context-host";
export const DOCK_UI_ATTRIBUTE = "data-lg-dock-ui";
export const DOCK_CLASS = "lg-dock";
export const RAIL_CLASS = "lg-deck-rail";
export const COMPACT_MEDIA = "(max-width: 767px), (pointer: coarse)";
const STACK_SELECTOR = "[data-app-composer] > .grid";
const MAX_PILL_CHARS = 28;
const MAX_RAIL_CHARS = 48;
const INTERACTIVE_SELECTOR = "button, a, input, textarea, select, [role='button'], [contenteditable]";
const GLASS = "hsl(var(--glass-h, 240) var(--glass-s, 0%) var(--glass-l, 9%)";

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
/* The grid stays unpositioned so the composer is the containing block for
   both the rail and the under-prompt meter. */
[${DOCK_STACK_ATTRIBUTE}] > .grid { row-gap: 0; margin-bottom: -10px; }
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}] {
  position: relative;
  z-index: calc(12 - var(--lg-dock-depth, 0));
  max-height: 38px;
  overflow: hidden;
  margin-top: -16px;
  border-radius: 12px;
  transform: scale(calc(1 - var(--lg-dock-depth, 0) * 0.035));
  transform-origin: 50% 100%;
  background-color: ${GLASS} / 0.55) !important;
  -webkit-backdrop-filter: blur(var(--lg-chrome-blur, 20px)) saturate(1.2);
  backdrop-filter: blur(var(--lg-chrome-blur, 20px)) saturate(1.2);
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.08), 0 -2px 10px hsl(0 0% 0% / 0.25);
  cursor: pointer;
  transition:
    max-height 220ms cubic-bezier(0.2, 0, 0, 1),
    margin 220ms cubic-bezier(0.2, 0, 0, 1),
    transform 220ms cubic-bezier(0.2, 0, 0, 1),
    opacity 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_FIRST_ATTRIBUTE}] { margin-top: 0; }
/* A lifted card: full height, pulled forward, and it pushes the cards in
   front of it down by the overlap so no header sits under its bottom edge. */
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}]:hover,
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_OPEN_ATTRIBUTE}="true"],
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_PREVIEW_ATTRIBUTE}="true"] {
  max-height: 70vh;
  z-index: 20;
  transform: translateY(-2px);
  cursor: default;
  background-color: ${GLASS} / 0.92) !important;
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.12), 0 10px 28px hsl(0 0% 0% / 0.38);
}
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}]:not([${DOCK_DEPTH_ATTRIBUTE}="0"]):hover,
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}]:not([${DOCK_DEPTH_ATTRIBUTE}="0"])[${DOCK_OPEN_ATTRIBUTE}="true"],
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}]:not([${DOCK_DEPTH_ATTRIBUTE}="0"])[${DOCK_PREVIEW_ATTRIBUTE}="true"] {
  margin-bottom: 16px;
}
[${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}][${DOCK_OPEN_ATTRIBUTE}="true"] { cursor: pointer; }
/* While one card is up, the others step back. */
[${DOCK_STACK_ATTRIBUTE}] > .grid:hover [${DOCK_LEAF_ATTRIBUTE}]:not(:hover):not([${DOCK_OPEN_ATTRIBUTE}="true"]):not([${DOCK_PREVIEW_ATTRIBUTE}="true"]),
[${DOCK_STACK_ATTRIBUTE}] > .grid[data-lg-dock-previewing] [${DOCK_LEAF_ATTRIBUTE}]:not([${DOCK_PREVIEW_ATTRIBUTE}="true"]) {
  opacity: 0.72;
}

/* Rail: one tick per card on the deck's right edge, back to front, top to
   bottom. Hovering it opens a list; hovering an entry previews the card and
   clicking one brings it to the front. Its bottom is set from the deck's
   bottom edge by the script; its top follows the deck as cards lift. */
[${DOCK_STACK_ATTRIBUTE}] { position: relative; }
.${RAIL_CLASS} {
  position: absolute; top: 4px; right: -16px; width: 14px;
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px;
  z-index: 25;
}
.${RAIL_CLASS}-tick {
  width: 4px; height: 12px; border-radius: 2px; border: 0; padding: 0;
  background: var(--muted-foreground); opacity: 0.45; cursor: pointer;
  transition: opacity 150ms ease, transform 150ms ease, height 150ms ease;
}
.${RAIL_CLASS}-tick[data-front="true"] { opacity: 1; height: 16px; background: var(--primary); }
.${RAIL_CLASS}:hover .${RAIL_CLASS}-tick, .${RAIL_CLASS}-tick:hover { opacity: 0.9; }
.${RAIL_CLASS}-tick:hover { transform: scaleX(1.6); }
.${RAIL_CLASS}-menu {
  position: absolute; right: 20px; bottom: 0; display: none; flex-direction: column; gap: 2px;
  min-width: 200px; max-width: min(380px, 70vw); padding: 6px; border-radius: 10px;
  border: 1px solid var(--border);
  background: ${GLASS} / 0.94);
  -webkit-backdrop-filter: blur(var(--lg-chrome-blur, 20px)) saturate(1.2);
  backdrop-filter: blur(var(--lg-chrome-blur, 20px)) saturate(1.2);
  box-shadow: 0 10px 28px hsl(0 0% 0% / 0.38);
  z-index: 40;
}
.${RAIL_CLASS}:hover .${RAIL_CLASS}-menu, .${RAIL_CLASS}:focus-within .${RAIL_CLASS}-menu { display: flex; }
.${RAIL_CLASS}-item {
  display: flex; align-items: center; gap: 8px; min-width: 0; padding: 5px 8px; border: 0;
  border-radius: 6px; background: transparent; color: var(--foreground); text-align: left;
  font: 500 12px/1.2 ui-sans-serif, system-ui, sans-serif; cursor: pointer;
}
.${RAIL_CLASS}-item > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${RAIL_CLASS}-item::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto;
  background: var(--muted-foreground); opacity: 0.6;
}
.${RAIL_CLASS}-item[data-front="true"]::before { background: var(--primary); opacity: 1; }
.${RAIL_CLASS}-item:hover, .${RAIL_CLASS}-item:focus-visible { background: var(--accent); outline: none; }

/* Context meter under the prompt box: a slim bar in the footer row that
   grows to show its numbers on hover or click. */
[${METER_HOST_ATTRIBUTE}] { position: relative; }
[${METER_ATTRIBUTE}="under"] {
  position: absolute !important; left: 50%; bottom: 3px; transform: translateX(-50%);
  width: 96px; height: 18px; margin: 0 !important; padding: 0 7px !important;
  display: flex !important; align-items: center; gap: 6px; z-index: 30;
  border-radius: 999px; overflow: hidden; opacity: 0.85; cursor: pointer;
  background-color: ${GLASS} / 0.55);
  transition: width 200ms cubic-bezier(0.2, 0, 0, 1), opacity 160ms ease, background-color 160ms ease;
}
[${METER_ATTRIBUTE}="under"] > * { flex: 0 0 auto; }
[${METER_ATTRIBUTE}="under"] > .flex-1, [${METER_ATTRIBUTE}="under"] > [class*="rounded-full"] { flex: 1 1 auto; min-width: 0; }
[${METER_ATTRIBUTE}="under"] > span { display: none; }
[${METER_ATTRIBUTE}="under"]:hover, [${METER_ATTRIBUTE}="under"][${DOCK_OPEN_ATTRIBUTE}="true"] {
  width: min(44%, 320px); opacity: 1; background-color: ${GLASS} / 0.92);
}
[${METER_ATTRIBUTE}="under"]:hover > span, [${METER_ATTRIBUTE}="under"][${DOCK_OPEN_ATTRIBUTE}="true"] > span { display: inline; }
@media (prefers-reduced-motion: reduce) {
  [${DOCK_STACK_ATTRIBUTE}] [${DOCK_LEAF_ATTRIBUTE}], .${RAIL_CLASS}-tick, [${METER_ATTRIBUTE}="under"] { transition: none; }
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

export function readMeterPlacement(): MeterPlacement {
  try {
    return window.localStorage.getItem(METER_PLACEMENT_KEY) === "stack" ? "stack" : "under";
  } catch {
    return "under";
  }
}

export function writeMeterPlacement(placement: MeterPlacement): void {
  try {
    if (placement === "under") window.localStorage.removeItem(METER_PLACEMENT_KEY);
    else window.localStorage.setItem(METER_PLACEMENT_KEY, placement);
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

function compact(text: string, max = MAX_PILL_CHARS): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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

/**
 * The first row of a banner is its status line; bodies and progress bars are
 * noise here. A banner that is only one row (the context meter: a bar plus
 * its numbers) is its own header.
 */
function headerOf(banner: Element): Element {
  const explicit = banner.querySelector('[class*="header-row"], [class*="header"], header');
  if (explicit) return explicit;
  for (const child of Array.from(banner.children)) {
    if (visibleText(child) !== "") return child.children.length > 0 && visibleText(child) === visibleText(banner) ? banner : child;
  }
  return banner;
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

/** The Context Meter banner: a progress bar plus "~123k / 260k". */
export function isContextMeter(leaf: Element): boolean {
  if (leaf.closest('[data-bb-plugin="context-meter"]')) return true;
  return (
    /\d+\s*k\s*\/\s*\d+\s*k/i.test(visibleText(leaf)) &&
    leaf.querySelector('[class*="rounded-full"]') !== null
  );
}

function isGroup(element: Element): boolean {
  return element.matches("section.space-y-2, div.space-y-2");
}

function isUi(element: Element): boolean {
  return element.hasAttribute(DOCK_UI_ATTRIBUTE) || element.classList.contains(DOCK_CLASS);
}

/**
 * A unit is one grid item of the host stack: a card, or a group of cards a
 * plugin stacks together (workflow runs). The host wraps each banner in a
 * `display: contents` div, so the grid item is that wrapper's child.
 */
type Unit = { item: HTMLElement; leaves: Element[] };

function unitsOf(stack: Element, skip: (leaf: Element) => boolean): Unit[] {
  const units: Unit[] = [];
  const leavesIn = (element: Element): Element[] =>
    isGroup(element)
      ? Array.from(element.children).flatMap((child) => leavesIn(child))
      : [element];
  const visit = (element: Element): void => {
    if (isUi(element)) return;
    if (element.classList.contains("contents")) {
      for (const child of Array.from(element.children)) visit(child);
      return;
    }
    const leaves = leavesIn(element).filter(
      (leaf) => !skip(leaf) && visibleText(headerOf(leaf)) !== "",
    );
    if (leaves.length > 0) units.push({ item: element as HTMLElement, leaves });
  };
  for (const child of Array.from(stack.children)) visit(child);
  return units;
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

function setAttr(element: Element, name: string, value: string | null): void {
  if (value === null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function clearDeckMarks(stack: Element, composer: Element): void {
  for (const element of Array.from(stack.querySelectorAll<HTMLElement>(`[${DOCK_LEAF_ATTRIBUTE}]`))) {
    element.removeAttribute(DOCK_LEAF_ATTRIBUTE);
    element.removeAttribute(DOCK_DEPTH_ATTRIBUTE);
    element.removeAttribute(DOCK_FIRST_ATTRIBUTE);
    element.removeAttribute(DOCK_OPEN_ATTRIBUTE);
    element.removeAttribute(DOCK_PREVIEW_ATTRIBUTE);
    element.style.removeProperty("--lg-dock-depth");
  }
  for (const item of Array.from(stack.querySelectorAll<HTMLElement>("[data-lg-dock-order]"))) {
    item.style.removeProperty("order");
    item.removeAttribute("data-lg-dock-order");
  }
  stack.removeAttribute("data-lg-dock-previewing");
  composer.querySelector(`:scope > .${RAIL_CLASS}`)?.remove();
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

type DeckState = {
  expanded: Set<number>;
  /** Original index of the card whose unit sits at the front; null = the last unit. */
  front: number | null;
  preview: number | null;
};

/**
 * Stack: order the units so the chosen one is at the front (last), then mark
 * each card with its depth (0 = front). Card indices stay the original ones
 * so open/preview state survives reordering.
 */
function markDeck(stack: Element, units: Unit[], state: DeckState): Element[] {
  const all = units.flatMap((unit) => unit.leaves);
  const indexOf = new Map<Element, number>(all.map((leaf, index) => [leaf, index]));
  let frontUnit = units.length - 1;
  if (state.front !== null) {
    const found = units.findIndex((unit) => unit.leaves.some((leaf) => indexOf.get(leaf) === state.front));
    if (found >= 0) frontUnit = found;
    else state.front = null;
  }
  const sequence = [...units.slice(frontUnit + 1), ...units.slice(0, frontUnit + 1)];
  const visual = sequence.flatMap((unit) => unit.leaves);
  sequence.forEach((unit, position) => {
    const order = String(position);
    if (unit.item.style.order !== order) unit.item.style.order = order;
    setAttr(unit.item, "data-lg-dock-order", order);
  });
  const last = visual.length - 1;
  visual.forEach((leaf, position) => {
    const element = leaf as HTMLElement;
    const index = indexOf.get(leaf) ?? position;
    const depth = String(last - position);
    setAttr(element, DOCK_LEAF_ATTRIBUTE, String(index));
    setAttr(element, DOCK_DEPTH_ATTRIBUTE, depth);
    setAttr(element, DOCK_FIRST_ATTRIBUTE, position === 0 ? "" : null);
    if (element.style.getPropertyValue("--lg-dock-depth") !== depth) {
      element.style.setProperty("--lg-dock-depth", depth);
    }
    setAttr(element, DOCK_OPEN_ATTRIBUTE, state.expanded.has(index) ? "true" : "false");
    setAttr(element, DOCK_PREVIEW_ATTRIBUTE, state.preview === index ? "true" : null);
  });
  setAttr(stack, "data-lg-dock-previewing", state.preview === null ? null : "");
  return visual;
}

/** The rail on the deck's right edge, reconciled in place like the pills. */
function renderRail(
  composer: HTMLElement,
  stack: HTMLElement,
  visual: Element[],
  state: DeckState,
  handlers: { preview(index: number | null): void; front(index: number): void },
): void {
  let rail = composer.querySelector<HTMLElement>(`:scope > .${RAIL_CLASS}`);
  if (!rail) {
    rail = document.createElement("div");
    rail.className = RAIL_CLASS;
    rail.setAttribute(DOCK_UI_ATTRIBUTE, "");
    rail.setAttribute("role", "toolbar");
    rail.setAttribute("aria-label", "Cards in the deck");
    const menu = document.createElement("div");
    menu.className = `${RAIL_CLASS}-menu`;
    menu.setAttribute("role", "menu");
    rail.append(menu);
    rail.addEventListener("click", (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-index]");
      if (!target) return;
      event.stopPropagation();
      handlers.front(Number(target.dataset.index));
    });
    rail.addEventListener("pointerover", (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(`.${RAIL_CLASS}-item`);
      if (target) handlers.preview(Number(target.dataset.index));
    });
    rail.addEventListener("pointerleave", () => handlers.preview(null));
    composer.append(rail);
  }
  // Anchor the ticks to the deck's bottom edge (the prompt box top), whatever
  // sits below the stack in this composer.
  const bottom = `${Math.max(0, Math.round(composer.getBoundingClientRect().bottom - stack.getBoundingClientRect().bottom)) + 14}px`;
  if (rail.style.bottom !== bottom) rail.style.bottom = bottom;
  const menu = rail.querySelector<HTMLElement>(`.${RAIL_CLASS}-menu`);
  if (!menu) return;
  const frontIndex = Number(visual[visual.length - 1]?.getAttribute(DOCK_LEAF_ATTRIBUTE) ?? -1);
  const ticks = new Map<string, HTMLElement>();
  for (const tick of Array.from(rail.querySelectorAll<HTMLElement>(`.${RAIL_CLASS}-tick`))) {
    ticks.set(tick.dataset.index ?? "", tick);
  }
  const items = new Map<string, HTMLElement>();
  for (const item of Array.from(menu.querySelectorAll<HTMLElement>(`.${RAIL_CLASS}-item`))) {
    items.set(item.dataset.index ?? "", item);
  }
  let tickCursor: HTMLElement | null = null;
  let itemCursor: HTMLElement | null = null;
  for (const leaf of visual) {
    const key = leaf.getAttribute(DOCK_LEAF_ATTRIBUTE) ?? "";
    const index = Number(key);
    const text = compact(visibleText(headerOf(leaf)), MAX_RAIL_CHARS);
    const front = index === frontIndex ? "true" : "false";

    let tick = ticks.get(key) ?? null;
    if (!tick) {
      tick = document.createElement("button");
      tick.setAttribute("type", "button");
      tick.className = `${RAIL_CLASS}-tick`;
      tick.dataset.index = key;
    }
    ticks.delete(key);
    setAttr(tick, "data-front", front);
    const tickTitle = `${text} — bring to the front`;
    if (tick.title !== tickTitle) tick.title = tickTitle;
    tick.setAttribute("aria-label", tickTitle);
    const tickAnchor: ChildNode | null = tickCursor ? tickCursor.nextSibling : rail.firstChild;
    if (tick !== tickAnchor) rail.insertBefore(tick, tickAnchor);
    tickCursor = tick;

    let item = items.get(key) ?? null;
    if (!item) {
      item = document.createElement("button");
      item.setAttribute("type", "button");
      item.className = `${RAIL_CLASS}-item`;
      item.setAttribute("role", "menuitem");
      item.dataset.index = key;
      item.append(document.createElement("span"));
    }
    items.delete(key);
    setAttr(item, "data-front", front);
    const label = item.firstElementChild;
    if (label && label.textContent !== text) label.textContent = text;
    const itemAnchor: ChildNode | null = itemCursor ? itemCursor.nextSibling : menu.firstChild;
    if (item !== itemAnchor) menu.insertBefore(item, itemAnchor);
    itemCursor = item;
  }
  for (const stale of ticks.values()) stale.remove();
  for (const stale of items.values()) stale.remove();
  // The menu must stay last so the ticks come before it.
  if (rail.lastElementChild !== menu) rail.append(menu);
}

export function installComposerDock(signal: AbortSignal): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-lg-composer-dock", "");
  style.textContent = CSS;
  document.head.append(style);

  const media =
    typeof window.matchMedia === "function" ? window.matchMedia(COMPACT_MEDIA) : null;
  const stateByComposer = new WeakMap<HTMLElement, DeckState>();
  const composersWithListener = new WeakSet<Element>();
  let mode = readDockMode();
  let meterPlacement = readMeterPlacement();
  let pendingFrame: number | null = null;

  const stateOf = (composer: HTMLElement): DeckState => {
    let state = stateByComposer.get(composer);
    if (!state) {
      state = { expanded: new Set(), front: null, preview: null };
      stateByComposer.set(composer, state);
    }
    return state;
  };

  const toggleIndex = (composer: HTMLElement, index: number): void => {
    const { expanded } = stateOf(composer);
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

  // A click on a deck card's own surface pins it open or puts it back, and a
  // click on the under-prompt meter pins it wide; clicks on the cards' own
  // controls (edit, close, expand) pass through.
  const onComposerClick = (event: Event): void => {
    const target = event.target as Element | null;
    const composer = target?.closest<HTMLElement>("[data-app-composer]");
    if (!composer) return;
    if (target?.closest(`.${RAIL_CLASS}`)) return;
    const control = target?.closest(INTERACTIVE_SELECTOR);
    const meter = target?.closest<HTMLElement>(`[${METER_ATTRIBUTE}="under"]`);
    if (meter) {
      if (control && meter.contains(control)) return;
      setAttr(meter, DOCK_OPEN_ATTRIBUTE, meter.getAttribute(DOCK_OPEN_ATTRIBUTE) === "true" ? null : "true");
      return;
    }
    if (!composer.hasAttribute(DOCK_STACK_ATTRIBUTE)) return;
    const leaf = target?.closest<HTMLElement>(`[${DOCK_LEAF_ATTRIBUTE}]`);
    if (!leaf) return;
    if (control && leaf.contains(control)) return;
    toggleIndex(composer, Number(leaf.getAttribute(DOCK_LEAF_ATTRIBUTE)));
  };

  const ensureDock = (composer: HTMLElement, stack: Element): HTMLElement => {
    let dock = composer.querySelector<HTMLElement>(`:scope > .${DOCK_CLASS}`);
    if (!dock) {
      dock = document.createElement("div");
      dock.className = DOCK_CLASS;
      dock.setAttribute("data-lg-composer-dock", "");
      dock.setAttribute(DOCK_UI_ATTRIBUTE, "");
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
    clearDeckMarks(stack, composer);
  };

  /** The meter leaves the stack only where there is a footer row to sit in and a pointer to hover with. */
  const placeMeter = (composer: HTMLElement, stack: Element): Element | null => {
    const previous = stack.querySelector(`[${METER_ATTRIBUTE}]`);
    const under =
      meterPlacement === "under" &&
      !(media?.matches ?? false) &&
      composer.querySelector("[data-follow-up-composer-footer]") !== null;
    const meter = under
      ? unitsOf(stack, () => false)
          .flatMap((unit) => unit.leaves)
          .find((leaf) => isContextMeter(leaf)) ?? null
      : null;
    if (previous && previous !== meter) {
      previous.removeAttribute(METER_ATTRIBUTE);
      previous.removeAttribute(DOCK_OPEN_ATTRIBUTE);
    }
    if (meter) setAttr(meter, METER_ATTRIBUTE, "under");
    setAttr(composer, METER_HOST_ATTRIBUTE, meter ? "" : null);
    return meter;
  };

  const scan = (): void => {
    const presentation = resolveDockMode(mode);
    for (const stack of Array.from(document.querySelectorAll<HTMLElement>(STACK_SELECTOR))) {
      const composer = stack.parentElement;
      if (!composer) continue;
      if (!composersWithListener.has(composer)) {
        composer.addEventListener("click", onComposerClick);
        composersWithListener.add(composer);
      }
      const meter = placeMeter(composer, stack);
      const units = unitsOf(stack, (leaf) => leaf === meter);
      const leaves = units.flatMap((unit) => unit.leaves);
      setAttr(composer, DOCK_CARDS_ATTRIBUTE, String(leaves.length));
      if (presentation === "cards" || leaves.length === 0) {
        release(composer, stack);
        continue;
      }
      const state = stateOf(composer);
      for (const index of Array.from(state.expanded)) if (index >= leaves.length) state.expanded.delete(index);
      if (state.preview !== null && state.preview >= leaves.length) state.preview = null;
      if (presentation === "stack") {
        composer.querySelector(`:scope > .${DOCK_CLASS}`)?.remove();
        composer.removeAttribute(DOCK_COLLAPSED_ATTRIBUTE);
        clearHiddenMarks(stack);
        composer.setAttribute(DOCK_STACK_ATTRIBUTE, "");
        const visual = markDeck(stack, units, state);
        renderRail(composer, stack, visual, state, {
          preview: (index) => {
            if (state.preview === index) return;
            state.preview = index;
            scan();
          },
          front: (index) => {
            state.front = index;
            scan();
          },
        });
        continue;
      }
      composer.removeAttribute(DOCK_STACK_ATTRIBUTE);
      clearDeckMarks(stack, composer);
      composer.setAttribute(DOCK_COLLAPSED_ATTRIBUTE, "");
      markHidden(stack, leaves, state.expanded);
      renderPills(ensureDock(composer, stack), leaves, state.expanded);
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
    meterPlacement = readMeterPlacement();
    scan();
  };

  // The stack re-renders as runs progress; one scan per frame keeps the pills,
  // deck, and rail current without doing work on every mutation record.
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
      composer.removeAttribute(METER_HOST_ATTRIBUTE);
      for (const meter of Array.from(stack.querySelectorAll(`[${METER_ATTRIBUTE}]`))) {
        meter.removeAttribute(METER_ATTRIBUTE);
        meter.removeAttribute(DOCK_OPEN_ATTRIBUTE);
      }
      composer.removeEventListener("click", onComposerClick);
    }
    style.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
