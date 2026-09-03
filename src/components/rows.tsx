/**
 * The settings primitives, shaped like monocode's Appearance page: a labelled
 * row with a description on the left and one control on the right. Token
 * classes only — user-chosen colours travel as inline custom properties.
 */
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";

export function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <input
        type="range"
        aria-label={label}
        className="h-1.5 w-40 cursor-pointer accent-primary"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(event) => {
          const requested = Number(event.target.value);
          onChange(Math.min(max, Math.max(min, requested)));
        }}
      />
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
        {display}
      </span>
    </>
  );
}

export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-5 w-9 rounded-full border border-border transition-colors",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-3.5 rounded-full bg-background transition-all",
          on ? "left-4.5" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs transition-colors",
            option.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      spellCheck={false}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit(event.currentTarget.value);
      }}
      className="w-64 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
    />
  );
}

export function ActionButton({
  children,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "quiet";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border border-border px-2.5 py-1 text-xs transition-colors",
        tone === "default"
          ? "bg-secondary text-secondary-foreground hover:bg-accent"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
