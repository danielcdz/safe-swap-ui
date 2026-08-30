"use client";

import * as React from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";

export interface AvatarDialogProps {
  address: string;
  /** The picture they have now, if any. */
  currentUrl: string | null;
  onSave: (file: File) => Promise<string | undefined>;
  onRemove: () => Promise<string | undefined>;
  onDismiss: () => void;
}

/**
 * Choosing a profile picture.
 *
 * Mounted only while open, so the chosen file and its preview URL go away with
 * the component rather than being reset by hand.
 */
export function AvatarDialog({
  address,
  currentUrl,
  onSave,
  onRemove,
  onDismiss,
}: AvatarDialogProps) {
  const [chosen, setChosen] = React.useState<{ file: File; url: string } | null>(
    null,
  );
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pickRef = React.useRef<HTMLButtonElement>(null);

  // Revokes the previous preview when it is replaced, and the last one when
  // the dialog goes away.
  React.useEffect(() => {
    if (!chosen) return;
    return () => URL.revokeObjectURL(chosen.url);
  }, [chosen]);

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
    if (!file) return;
    setError(null);
    setChosen({ file, url: URL.createObjectURL(file) });
  };

  async function run(action: () => Promise<string | undefined>) {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);

    if (failure) {
      setError(failure);
      return;
    }
    onDismiss();
  }

  const preview = chosen?.url ?? currentUrl;

  return (
    <Dialog
      open
      title="Profile picture"
      description="Shown to the traders you deal with, next to your name. It will be cropped to a square."
      onDismiss={onDismiss}
      initialFocusRef={pickRef}
      className="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onDismiss} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => chosen && run(() => onSave(chosen.file))}
            disabled={!chosen || busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save picture"
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <button
          ref={pickRef}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={currentUrl ? "Change your picture" : "Choose a picture"}
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
          className="group relative cursor-pointer rounded-full focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-60"
        >
          <span
            className={cn(
              "relative block size-32 overflow-hidden rounded-full",
              dragging
                ? "ring-2 ring-primary ring-offset-4 ring-offset-popover"
                : "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-popover",
            )}
          >
            {preview ? (
              // A local object URL, or our own session-checked route.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              // What they have now *is* the derived badge, so it stands in as
              // the preview rather than being dimmed behind an icon.
              <WalletBadge
                address={address}
                size="xl"
                className="size-full text-4xl"
              />
            )}

            {/* The only thing over the face, and only while it is wanted. */}
            <span
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/65 text-xs font-medium text-white transition-opacity",
                dragging
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              <Camera aria-hidden className="size-6" />
              {dragging ? "Drop it" : "Change"}
            </span>
          </span>

          {/* Always visible: a hover-only affordance does not exist on a
              touch screen, and it sits clear of the face rather than on it. */}
          <span
            aria-hidden
            className="absolute -end-1 -bottom-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm ring-4 ring-popover"
          >
            <Camera className="size-4" />
          </span>
        </button>

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

        <p className="text-center text-xs text-muted-foreground">
          Click to choose, or drop or paste an image. PNG, JPEG or WebP.
        </p>

        {currentUrl && !chosen ? (
          <button
            type="button"
            onClick={() => run(onRemove)}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remove picture
          </button>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="w-full rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
