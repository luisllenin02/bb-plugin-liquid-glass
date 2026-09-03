import { useEffect, useState } from "react";

import {
  DOCK_MODE_EVENT,
  readDockMode,
  writeDockMode,
  type DockMode,
} from "../composer-dock.js";
import { cn } from "../lib/utils.js";
import { Row } from "./rows.js";

const OPTIONS: { value: DockMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "pills", label: "Pills" },
  { value: "cards", label: "Cards" },
];

/**
 * Per-browser choice (not part of the shared appearance record): the phone
 * and the desktop usually want different answers.
 */
export function ComposerDockRow() {
  const [mode, setMode] = useState<DockMode>(() => readDockMode());
  useEffect(() => {
    const sync = () => setMode(readDockMode());
    window.addEventListener(DOCK_MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DOCK_MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Row
      label="Status above the prompt"
      description="Pills fold the goal, todo, workflow, and context cards into one line; tap a pill to open its card. Auto uses pills on phones and cards on desktop. Saved on this device."
    >
      <div
        role="radiogroup"
        aria-label="Status above the prompt"
        className="inline-flex rounded-md border border-border p-0.5"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            className={cn(
              "rounded px-2.5 py-1 text-xs transition-colors",
              mode === option.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => {
              writeDockMode(option.value);
              setMode(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Row>
  );
}
