"use client";

import { useEffect, useState } from "react";

interface Props {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}

export default function QuantityInput({
  value,
  onCommit,
  min = 1,
  max = 99,
  className = "",
  ariaLabel = "Cantidad",
}: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      aria-label={ariaLabel}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        setDraft(raw);
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n) && n >= min && n <= max && n !== value) onCommit(n);
      }}
      onBlur={() => {
        const n = parseInt(draft, 10);
        const clamped = Math.min(max, Math.max(min, Number.isNaN(n) ? min : n));
        if (clamped !== value) onCommit(clamped);
        setDraft(String(clamped));
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
}
