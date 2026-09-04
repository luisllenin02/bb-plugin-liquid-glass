/**
 * Marks the document while the new-thread home screen is mounted.
 *
 * The theme paints the phone's safe-area strip below the new-thread dock from
 * the layout content shell, because two host wrappers clip everything inside
 * the home screen at that boundary. The shell is shared with every other
 * screen, so the theme scopes that paint to `html[data-lg-home]`; this script
 * is what sets it. One `querySelector` per mutation frame, only when nodes
 * were added or removed, and only a write when the answer changed.
 */
import type { WatchDocument } from "./composer-dock.js";

export const HOME_ATTRIBUTE = "data-lg-home";
export const HOME_SELECTOR = '[data-testid="root-compose-compact-home"]';

export function installHomeShellMarker(signal: AbortSignal, watch: WatchDocument): () => void {
  const root = document.documentElement;
  let present: boolean | null = null;

  const scan = (): void => {
    const now = document.querySelector(HOME_SELECTOR) !== null;
    if (now === present) return;
    present = now;
    if (now) root.setAttribute(HOME_ATTRIBUTE, "");
    else root.removeAttribute(HOME_ATTRIBUTE);
  };

  const unwatch = watch({
    wants: (record) => record.type === "childList",
    scan,
  });
  scan();

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    unwatch();
    root.removeAttribute(HOME_ATTRIBUTE);
    present = null;
  };
  signal.addEventListener("abort", dispose, { once: true });
  return dispose;
}
