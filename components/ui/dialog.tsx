"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  onDismiss: () => void;
  /** Focused on open; falls back to the panel itself. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Actions row, right-aligned under the body. */
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Modal shell. Escape and a backdrop press dismiss, focus moves in on open and
 * returns to the opener on close, and the page behind is scroll-locked.
 */
export function Dialog({
  open,
  title,
  description,
  onDismiss,
  initialFocusRef,
  footer,
  className,
  children,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const openerRef = React.useRef<Element | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    (initialFocusRef?.current ?? panelRef.current)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onDismiss, initialFocusRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div aria-hidden className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-popover p-5 shadow-xl outline-none",
          className,
        )}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>

        {description ? (
          <div
            id={descriptionId}
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
          >
            {description}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {footer ? (
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
