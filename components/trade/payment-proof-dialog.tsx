"use client";

import * as React from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MARKET } from "@/components/p2p/types";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";

export interface PaymentProofDialogProps {
  counterpartyName: string;
  /** An upload or the advance itself is in flight. */
  busy?: boolean;
  /** Why the last attempt did not land. */
  error?: string | null;
  onConfirm: (file: File | null) => void;
  onDismiss: () => void;
}

/**
 * The buyer's last step before saying they have paid: attach the transfer
 * screenshot, which goes into the trade chat.
 *
 * **The receipt is optional and the confirmation is not conditional on it.**
 * A screenshot is the easiest thing in this trade to fake, so requiring one
 * would buy no safety while blocking a state change on an upload — and the
 * buyer really has sent the money either way. It is here because this is the
 * moment the proof is worth something, not because it proves anything.
 *
 * Mounted only while open, so the chosen file and its preview URL are
 * discarded with the component rather than reset by hand.
 */
export function PaymentProofDialog({
  counterpartyName,
  busy = false,
  error = null,
  onConfirm,
  onDismiss,
}: PaymentProofDialogProps) {
  const [chosen, setChosen] = React.useState<{ file: File; url: string } | null>(
    null,
  );
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropRef = React.useRef<HTMLButtonElement>(null);

  // Revokes the previous preview when it is replaced, and the last one when
  // the dialog goes away.
  React.useEffect(() => {
    if (!chosen) return;
    return () => URL.revokeObjectURL(chosen.url);
  }, [chosen]);

  // Pasting is how a desktop screenshot actually arrives. The listener is on
  // the window because the dialog's own focus sits on a button, not a field.
  React.useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (file) setChosen({ file, url: URL.createObjectURL(file) });
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const choose = (file: File | null | undefined) => {
    if (file) setChosen({ file, url: URL.createObjectURL(file) });
  };

  return (
    <Dialog
      open
      title="I&rsquo;ve sent the payment"
      description={
        <>
          Attach a screenshot of the transfer so {counterpartyName} can match it
          against their account. It goes into the trade chat.{" "}
          <span className="text-foreground">Optional</span> — they will check
          their own account before sending the {MARKET.asset} either way.
        </>
      }
      onDismiss={onDismiss}
      initialFocusRef={dropRef}
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onDismiss} disabled={busy}>
            Go back
          </Button>
          <Button
            onClick={() => onConfirm(chosen?.file ?? null)}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              "I've sent the payment"
            )}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          choose(event.target.files?.[0]);
          // Cleared so picking the same file again still fires onChange.
          event.target.value = "";
        }}
      />

      {chosen ? (
        <figure className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local
              object URL, which next/image cannot take. */}
          <img
            src={chosen.url}
            alt="The receipt you are about to send"
            className="max-h-48 w-full rounded-lg object-contain"
          />
          <figcaption className="flex items-center gap-2 px-1 pb-0.5">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {chosen.file.name || "Pasted image"}
            </span>
            <button
              type="button"
              onClick={() => setChosen(null)}
              disabled={busy}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-40"
            >
              <X aria-hidden className="size-3.5" />
              Remove
            </button>
          </figcaption>
        </figure>
      ) : (
        <button
          ref={dropRef}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          <ImageUp aria-hidden className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">Attach a receipt</span>
          <span className="text-xs text-muted-foreground">
            Paste, drop, or choose a PNG, JPEG or WebP
          </span>
        </button>
      )}

      {error ? (
        <div className="mt-3 flex flex-col items-start gap-1.5">
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
          <button
            type="button"
            onClick={() => onConfirm(null)}
            disabled={busy}
            className="cursor-pointer px-1 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Confirm without a receipt
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}
