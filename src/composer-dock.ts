/**
 * Composer dock — a minimize control for the plugin banner stack (goal,
 * todos, workflow runs, context meter) that the host renders above the
 * prompt box. Minimized, the stack is replaced by a single slim strip of
 * live status pills, so the chat keeps the space while the status stays
 * visible. The banners stay mounted (only hidden), so their plugins keep
 * updating and the pills mirror them.
 */

export const DOCK_STORAGE_KEY = "liquid-glass:composer-dock-collapsed";
export const DOCK_COLLAPSED_ATTRIBUTE = "data-lg-dock-collapsed";
export const DOCK_CLASS = "lg-dock";
const STACK_SELECTOR = "[data-app-composer] > .grid";
const MAX_PILL_CHARS = 28;

const CSS = `
[${DOCK_COLLAPSED_ATTRIBUTE}] > .grid { display: none; }
.${DOCK_CLASS} {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  height: 14px; margin-bottom: -6px;
}
[${DOCK_COLLAPSED_ATTRIBUTE}] > .${DOCK_CLASS} { height: 24px; margin-bottom: 0; }
.${DOCK_CLASS}-pills {
  display: none; flex: 1 1 auto; min-width: 0; align-items: center; gap: 6px;
  overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
  padding-right: 14px;
  mask-image: linear-gradient(to right, black calc(100% - 18px), transparent);
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 18px), transparent);
}
.${DOCK_CLASS}-pills::-webkit-scrollbar { display: none; }
[${DOCK_COLLAPSED_ATTRIBUTE}] > .${DOCK_CLASS} > .${DOCK_CLASS}-pills { display: flex; }
.${DOCK_CLASS}-pill {
  display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto;
  height: 22px; padding: 0 9px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--popover);
  color: var(--popover-foreground); font: 500 11px/1 ui-sans-serif, system-ui, sans-serif;
  font-variant-numeric: tabular-nums; letter-spacing: 0.01em; white-space: nowrap;
  cursor: pointer; max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
}
.${DOCK_CLASS}-pill svg { width: 12px; height: 12px; flex: 0 0 auto; }
.${DOCK_CLASS}-pill[data-tone="live"] { border-color: color-mix(in srgb, var(--primary) 60%, var(--border)); }
.${DOCK_CLASS}-pill[data-tone="alert"] { border-color: color-mix(in srgb, var(--destructive, #e5484d) 60%, var(--border)); }
.${DOCK_CLASS}-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted-foreground); flex: 0 0 auto; }
.${DOCK_CLASS}-pill[data-tone="live"] .${DOCK_CLASS}-dot { background: var(--primary); }
.${DOCK_CLASS}-pill[data-tone="alert"] .${DOCK_CLASS}-dot { background: var(--destructive, #e5484d); }
.${DOCK_CLASS}-toggle {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
  margin-left: auto; width: 22px; height: 14px; border: 0; border-radius: 7px;
  background: transparent; color: var(--muted-foreground); cursor: pointer; padding: 0; opacity: 0.7;
}
.${DOCK_CLASS}-toggle:hover, .${DOCK_CLASS}-toggle:focus-visible { opacity: 1; color: var(--foreground); outline: none; background: var(--accent, transparent); }
[${DOCK_COLLAPSED_ATTRIBUTE}] > .${DOCK_CLASS} > .${DOCK_CLASS}-toggle { height: 22px; width: 24px; border-radius: 999px; border: 1px solid var(--border); background: var(--popover); }
.${DOCK_CLASS}-toggle svg { width: 12px; height: 12px; transition: transform 160ms ease; }
[${DOCK_COLLAPSED_ATTRIBUTE}] > .${DOCK_CLASS} > .${DOCK_CLASS}-toggle svg { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .${DOCK_CLASS}-toggle svg { transition: none; } }
`;

const CHEVRON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(DOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(DOCK_STORAGE_KEY, "1");
    else window.localStorage.removeItem(DOCK_STORAGE_KEY);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
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

/** One pill per banner; a banner that stacks several cards (workflow runs) yields one per card. */
function leavesOf(stack: Element): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(stack.children)) {
    if (child.classList.contains(DOCK_CLASS)) continue;
    const nested = child.matches("section.space-y-2, div.space-y-2")
      ? Array.from(child.children)
      : [];
    if (nested.length > 0) out.push(...nested);
    else out.push(child);
  }
  return out;
}

function renderPills(dock: HTMLElement, stack: Element): void {
  const pills = dock.querySelector<HTMLElement>(`.${DOCK_CLASS}-pills`);
  if (!pills) return;
  const keys: string[] = [];
  const nodes: HTMLElement[] = [];
  for (const leaf of leavesOf(stack)) {
    const header = headerOf(leaf);
    const full = visibleText(header);
    const text = compact(full);
    if (!text) continue;
    const tone = toneOf(leaf, full);
    const icon = header.querySelector("svg");
    keys.push(`${tone}|${text}|${icon ? "i" : ""}`);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `${DOCK_CLASS}-pill`;
    pill.dataset.tone = tone;
    pill.title = full;
    if (icon) pill.append(icon.cloneNode(true));
    else {
      const dot = document.createElement("span");
      dot.className = `${DOCK_CLASS}-dot`;
      pill.append(dot);
    }
    pill.append(document.createTextNode(text));
    nodes.push(pill);
  }
  const signature = keys.join(" ");
  if (pills.dataset.signature === signature) return;
  pills.dataset.signature = signature;
  pills.replaceChildren(...nodes);
}

function ensureDock(
  composer: HTMLElement,
  stack: Element,
  collapsed: boolean,
  onToggle: () => void,
): void {
  let dock = composer.querySelector<HTMLElement>(`:scope > .${DOCK_CLASS}`);
  if (!dock) {
    dock = document.createElement("div");
    dock.className = DOCK_CLASS;
    dock.setAttribute("data-lg-composer-dock", "");
    const pills = document.createElement("div");
    pills.className = `${DOCK_CLASS}-pills`;
    pills.addEventListener("click", onToggle);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `${DOCK_CLASS}-toggle`;
    toggle.innerHTML = CHEVRON;
    toggle.addEventListener("click", onToggle);
    dock.append(pills, toggle);
    composer.insertBefore(dock, stack);
  }
  const toggle = dock.querySelector<HTMLButtonElement>(`.${DOCK_CLASS}-toggle`);
  if (toggle) {
    const label = collapsed ? "Show status cards" : "Minimize status cards";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
  if (collapsed) {
    composer.setAttribute(DOCK_COLLAPSED_ATTRIBUTE, "");
    renderPills(dock, stack);
  } else {
    composer.removeAttribute(DOCK_COLLAPSED_ATTRIBUTE);
  }
}

export function installComposerDock(signal: AbortSignal): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-lg-composer-dock", "");
  style.textContent = CSS;
  document.head.append(style);

  let collapsed = readCollapsed();
  let pendingFrame: number | null = null;

  const scan = (): void => {
    for (const stack of Array.from(document.querySelectorAll<HTMLElement>(STACK_SELECTOR))) {
      const composer = stack.parentElement;
      if (!composer) continue;
      const dock = composer.querySelector<HTMLElement>(`:scope > .${DOCK_CLASS}`);
      if (leavesOf(stack).length === 0) {
        dock?.remove();
        composer.removeAttribute(DOCK_COLLAPSED_ATTRIBUTE);
        continue;
      }
      ensureDock(composer, stack, collapsed, toggle);
    }
  };

  const scheduleScan = (): void => {
    if (pendingFrame !== null) return;
    pendingFrame = window.requestAnimationFrame(() => {
      pendingFrame = null;
      scan();
    });
  };

  function toggle(): void {
    collapsed = !collapsed;
    writeCollapsed(collapsed);
    scan();
  }

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
  scan();

  const dispose = (): void => {
    observer.disconnect();
    if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    for (const dock of Array.from(document.querySelectorAll(`.${DOCK_CLASS}`))) dock.remove();
    for (const composer of Array.from(document.querySelectorAll(`[${DOCK_COLLAPSED_ATTRIBUTE}]`))) {
      composer.removeAttribute(DOCK_COLLAPSED_ATTRIBUTE);
    }
    style.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
