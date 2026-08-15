import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextFieldProps extends React.ComponentProps<"input"> {
  label: string;
  /** Leading glyph. Rendered decorative — pass a lucide icon. */
  icon?: React.ReactNode;
  /** Trailing slot, e.g. a password reveal toggle. */
  trailing?: React.ReactNode;
  /** Inline validation message. Presence also marks the field invalid. */
  error?: string;
  /** Right-aligned affordance next to the label, e.g. "Forgot?". */
  labelAction?: React.ReactNode;
}

/**
 * Pill text input. Follows the same shape language as the search bar —
 * `rounded-full` on a `primary/5` wash, no hard border at rest, ring on focus.
 */
export function TextField({
  label,
  icon,
  trailing,
  error,
  labelAction,
  id,
  className,
  ...props
}: TextFieldProps) {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const errorId = `${fieldId}-error`;

  return (
    <div data-slot="text-field" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 ps-1 pe-1">
        <label htmlFor={fieldId} className="text-xs font-medium">
          {label}
        </label>
        {labelAction}
      </div>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full bg-primary/5 px-4 py-2.5 transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card",
          error && "ring-1 ring-destructive/45 ring-inset",
          className,
        )}
      >
        {icon ? (
          <span aria-hidden className="shrink-0 text-muted-foreground">
            {icon}
          </span>
        ) : null}

        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          {...props}
        />

        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>

      {error ? (
        <p id={errorId} className="ps-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
