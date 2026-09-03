import { useEffect, useState } from "react";

import { normalizeHex } from "../../lib/color.js";

export function CustomColourControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDraft(value);
    setError(false);
  }, [value]);

  const commit = (candidate: string) => {
    const normalized = normalizeHex(candidate);
    if (normalized === null) {
      setError(true);
      return;
    }
    setDraft(normalized);
    setError(false);
    onChange(normalized);
  };

  return (
    <div className="flex flex-wrap items-start gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Custom</span>
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={normalizeHex(value) ?? "#4298f7"}
          onChange={(event) => commit(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-md border border-border bg-background p-0.5"
        />
      </label>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-6 rounded-md border border-border"
            style={{ backgroundColor: normalizeHex(draft) ?? value }}
          />
          <input
            type="text"
            aria-label={`${label} hex`}
            aria-invalid={error}
            value={draft}
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(false);
            }}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(event.currentTarget.value);
            }}
            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground"
          />
        </div>
        {error ? (
          <span role="alert" className="text-2xs text-destructive">
            Use #rrggbb.
          </span>
        ) : null}
      </div>
    </div>
  );
}
