"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfoTipProps {
  /** Accessible name for the trigger, e.g. "About available and limits". */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Small (i) affordance for explaining a term in place.
 *
 * Opens on hover, focus, or tap — pointer-only tooltips are unreachable by
 * keyboard and invisible on touch, so all three paths are wired. Escape and
 * blur dismiss it.
 */
export function InfoTip({ label, children, className }: InfoTipProps) {
  const [open, setOpen] = React.useState(false);
  const tipId = React.useId();

  return (
    <span
      data-slot="info-tip"
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="grid size-4 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
      >
        <Info aria-hidden className="size-3.5" />
      </button>

      {open ? (
        <span
          id={tipId}
          role="tooltip"
          // Resets the uppercase/tracking a column header would otherwise
          // pass down to the tooltip copy.
          className="absolute top-full left-0 z-50 mt-2 w-72 rounded-xl border border-border bg-popover p-3 text-xs leading-relaxed font-normal tracking-normal normal-case text-popover-foreground shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
