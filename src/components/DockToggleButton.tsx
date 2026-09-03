import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  COMPACT_MEDIA,
  DOCK_CARDS_ATTRIBUTE,
  DOCK_MODE_EVENT,
  nextDockMode,
  resolveDockMode,
  writeDockMode,
  type DockPresentation,
} from "../composer-dock.js";
import { cn } from "../lib/utils.js";

/**
 * One glyph per state, each showing the next step and drawn on the host's
 * 24-grid at its stroke. Cards: double chevron up (tuck into a deck). Stack:
 * chevron up onto a bar (hide into pills). Pills: double chevron down (show
 * the cards again).
 */
const GLYPHS: Record<DockPresentation, { path: string; label: string }> = {
  cards: {
    path: "M18 13s-4.4 5-6 5-6-5-6-5M18 6s-4.4 5-6 5-6-5-6-5",
    label: "Tuck status cards behind the prompt box",
  },
  stack: {
    path: "M6 5h12M18 17s-4.4-5-6-5-6 5-6 5",
    label: "Hide status cards into pills",
  },
  pills: {
    path: "M6 11s4.4-5 6-5 6 5 6 5M6 18s4.4-5 6-5 6 5 6 5",
    label: "Show status cards",
  },
};

const HOST_ACTIONS_SELECTOR =
  "[data-promptbox-input-region] > [data-promptbox-standard-actions][data-promptbox-expanded-only]";
/** The host pins its chevron cluster at right 13px; sit just left of it. */
const HOST_ACTIONS_RIGHT_PX = 13;
const GAP_PX = 2;


/**
 * Composer action: cycles the status cards above the prompt box through
 * cards, deck, and pills for this device. It renders nothing in the action row; instead
 * it portals a ghost glyph into the prompt box's top-right corner, beside the
 * host's collapse chevron, marked `data-promptbox-expanded-only` so it shows
 * and hides exactly when that chevron does. Hidden while the composer has no
 * cards to fold.
 */
export function DockToggleButton() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [presentation, setPresentation] = useState<DockPresentation>(() => resolveDockMode());
  const [cards, setCards] = useState(false);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setPresentation(resolveDockMode());
    window.addEventListener(DOCK_MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    const media =
      typeof window.matchMedia === "function" ? window.matchMedia(COMPACT_MEDIA) : null;
    media?.addEventListener("change", sync);
    return () => {
      window.removeEventListener(DOCK_MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
      media?.removeEventListener("change", sync);
    };
  }, []);

  // The dock content script counts this composer's cards onto the composer
  // element; watch that one attribute rather than the whole stack.
  useEffect(() => {
    const composer = rootRef.current?.closest<HTMLElement>("[data-app-composer]");
    if (!composer) return;
    const read = () => setCards((Number(composer.getAttribute(DOCK_CARDS_ATTRIBUTE)) || 0) > 0);
    read();
    const observer = new MutationObserver(read);
    observer.observe(composer, { attributes: true, attributeFilter: [DOCK_CARDS_ATTRIBUTE] });
    return () => observer.disconnect();
  }, []);

  // Own a small absolutely positioned slot in the prompt box's input region,
  // left of the host's chevron cluster, sized from that cluster's width.
  useEffect(() => {
    const promptbox = rootRef.current?.closest<HTMLElement>("[data-promptbox]");
    const region = promptbox?.querySelector<HTMLElement>("[data-promptbox-input-region]");
    if (!region) return;
    const slot = document.createElement("div");
    slot.setAttribute("data-lg-dock-glyph", "");
    slot.setAttribute("data-promptbox-expanded-only", "");
    slot.className = "absolute top-2 z-20 flex items-center";
    region.append(slot);

    const hostActions = region.querySelector<HTMLElement>(HOST_ACTIONS_SELECTOR);
    const place = () => {
      const width = hostActions?.offsetWidth ?? 0;
      slot.style.right = `${HOST_ACTIONS_RIGHT_PX + width + (width > 0 ? GAP_PX : 0)}px`;
    };
    place();
    const resize =
      hostActions && typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    if (hostActions && resize) resize.observe(hostActions);
    setMount(slot);
    return () => {
      resize?.disconnect();
      slot.remove();
      setMount(null);
    };
  }, []);

  const { path, label } = GLYPHS[presentation];
  const glyph =
    mount && cards
      ? createPortal(
          <button
            type="button"
            aria-label={label}
            aria-pressed={presentation !== "cards"}
            data-lg-dock-state={presentation}
            title={label}
            onClick={() => writeDockMode(nextDockMode(presentation))}
            className={cn(
              "inline-flex h-8 w-6 cursor-pointer items-center justify-center rounded-md",
              "text-muted-foreground transition-colors duration-150 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-3.5"
            >
              <path d={path} />
            </svg>
          </button>,
          mount,
        )
      : null;

  return (
    <span ref={rootRef} hidden>
      {glyph}
    </span>
  );
}
