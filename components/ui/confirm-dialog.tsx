"use client";

import * as React from "react";
import { Button, type ButtonProps } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  dismissLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm: () => void;
  onDismiss: () => void;
}

/**
 * Modal confirmation for actions that can't be undone. Escape and a backdrop
 * press dismiss; focus moves to the confirm button on open and returns to
 * whatever opened it on close.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  dismissLabel = "Go back",
  confirmVariant = "danger",
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const openerRef = React.useRef<Element | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    confirmRef.current?.focus();

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
  }, [open, onDismiss]);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-popover p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <div
          id={descriptionId}
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onDismiss}>
            {dismissLabel}
          </Button>
          <Button ref={confirmRef} variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
