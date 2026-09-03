import { useEffect, useState } from "react";

import {
  DOCK_MODE_EVENT,
  readDockMode,
  readMeterPlacement,
  writeDockMode,
  writeMeterPlacement,
  type DockMode,
  type MeterPlacement,
} from "../composer-dock.js";
import { cn } from "../lib/utils.js";
import { Row } from "./rows.js";

const OPTIONS: { value: DockMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "cards", label: "Cards" },
  { value: "stack", label: "Stack" },
  { value: "pills", label: "Pills" },
];

const METER_OPTIONS: { value: MeterPlacement; label: string }[] = [
  { value: "under", label: "Under the prompt" },
  { value: "stack", label: "With the cards" },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            value === option.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Where the Context Meter bar lives; per-browser like the dock mode. */
export function ContextMeterRow() {
  const [placement, setPlacement] = useState<MeterPlacement>(() => readMeterPlacement());
  useEffect(() => {
    const sync = () => setPlacement(readMeterPlacement());
    window.addEventListener(DOCK_MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DOCK_MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <Row
      label="Context meter"
      description="Under the prompt keeps the context bar as a slim marker in the row below the prompt box; hover or click it to read the numbers. With the cards leaves it in the status stack. Saved on this device."
    >
      <Segmented
        label="Context meter"
        value={placement}
        options={METER_OPTIONS}
        onChange={(next) => {
          writeMeterPlacement(next);
          setPlacement(next);
        }}
      />
    </Row>
  );
}

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
      description="Stack tucks the goal, todo, and workflow cards behind the prompt box as a see-through deck; hover or click a card to read it, and use the rail on its right edge to bring a card to the front. Pills fold them into one line; tap a pill to open its card. Auto uses pills on phones and cards on desktop. Saved on this device."
    >
      <Segmented
        label="Status above the prompt"
        value={mode}
        options={OPTIONS}
        onChange={(next) => {
          writeDockMode(next);
          setMode(next);
        }}
      />
    </Row>
  );
}
