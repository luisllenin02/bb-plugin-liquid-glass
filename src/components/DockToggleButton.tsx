import { useEffect, useRef, useState } from "react";

import {
  COMPACT_MEDIA,
  DOCK_CARDS_ATTRIBUTE,
  DOCK_MODE_EVENT,
  readDockMode,
  writeDockMode,
} from "../composer-dock.js";
import { cn } from "../lib/utils.js";

/** Chevron-up-to-line: fold the cards up into pills. */
const FOLD =
  "M3 3.5h10M8 12.5V6.5M5 9.5l3-3 3 3";
/** Chevron-down-from-line: unfold the pills back into cards. */
const UNFOLD =
  "M3 3.5h10M8 6.5v6M5 9.5l3 3 3-3";

function compactNow(): boolean {
  const mode = readDockMode();
  if (mode !== "auto") return mode === "pills";
  return typeof window.matchMedia === "function" && window.matchMedia(COMPACT_MEDIA).matches;
}

/**
 * Composer action: folds the status cards above the prompt box into pills
 * and back, for this device. Sits in the prompt box's own action row, so it
 * never competes with the cards for space. Renders nothing while the
 * composer has no cards to fold.
 */
export function DockToggleButton() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [pills, setPills] = useState(() => compactNow());
  const [cards, setCards] = useState(false);

  useEffect(() => {
    const sync = () => setPills(compactNow());
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

  if (!cards) return <span ref={rootRef} hidden />;

  const label = pills ? "Show status cards" : "Fold status cards into pills";
  return (
    <span ref={rootRef} className="inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pills}
        title={label}
        onClick={() => writeDockMode(pills ? "cards" : "pills")}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border",
          "text-muted-foreground transition-colors hover:bg-state-hover hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "max-md:pointer-coarse:h-10 max-md:pointer-coarse:w-9",
          pills && "bg-state-active text-foreground",
        )}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4"
        >
          <path d={pills ? UNFOLD : FOLD} />
        </svg>
      </button>
    </span>
  );
}
