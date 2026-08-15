"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  decimals?: number;
  min?: number;
  max?: number;
  /** Unit shown inside the field, e.g. "USD" or "%". */
  suffix?: string;
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Pill number input with decrement/increment. Typing stays free-form so a
 * half-entered value isn't clamped out from under the cursor; the steppers
 * clamp, and the parent validates.
 */
export function NumberField({
  value,
  onChange,
  step = 1,
  decimals = 2,
  min,
  max,
  suffix,
  placeholder,
  id,
  invalid,
  className,
  ...props
}: NumberFieldProps) {
  function nudge(direction: 1 | -1) {
    const current = Number(value) || 0;
    let next = current + direction * step;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next.toFixed(decimals));
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-primary/5 py-1.5 ps-1.5 pe-1.5 transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card",
        invalid && "ring-1 ring-destructive/45 ring-inset",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => nudge(-1)}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <Minus aria-hidden className="size-4" />
      </button>

      <input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        className="w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground"
        {...props}
      />

      {suffix ? (
        <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>
      ) : null}

      <button
        type="button"
        aria-label="Increase"
        onClick={() => nudge(1)}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
