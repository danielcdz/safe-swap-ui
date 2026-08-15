"use client";

import * as React from "react";
import { Button, type ButtonProps } from "./button";
import { Dialog } from "./dialog";

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

/** Confirmation for actions that can't be undone. */
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

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onDismiss={onDismiss}
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={onDismiss}>
            {dismissLabel}
          </Button>
          <Button ref={confirmRef} variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
