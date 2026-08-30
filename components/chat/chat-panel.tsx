"use client";

import * as React from "react";
import {
  Check,
  CheckCheck,
  ImageUp,
  Loader2,
  Paperclip,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import type { TradeMessage } from "@/components/trade/types";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** What the file picker offers, and what the server will actually accept. */
const ACCEPT = "image/jpeg,image/png,image/webp";

function Timestamp({ timestamp }: { timestamp: number }) {
  const mounted = useMounted();
  // Formatting depends on the viewer's timezone, so it can only run after
  // hydration — the server has no way to know it.
  if (!mounted) return <span className="text-[11px] tabular-nums">&nbsp;</span>;
  return (
    <span className="text-[11px] tabular-nums">
      {timeFormatter.format(timestamp)}
    </span>
  );
}

function DeliveryTicks({ status }: { status: TradeMessage["delivery"] }) {
  if (!status) return null;
  const Icon = status === "sent" ? Check : CheckCheck;
  return (
    <Icon
      aria-label={status}
      className={cn("size-3.5", status === "read" && "text-primary")}
    />
  );
}

/**
 * What a screen reader is told an attachment is. Outgoing and incoming read
 * differently for the same reason the bubbles look different — "your receipt"
 * and "theirs" are not interchangeable in a conversation about who has paid.
 */
function imageAlt(message: TradeMessage, counterpartyName: string) {
  if (message.text) return message.text;
  return message.author === "self"
    ? "Receipt you sent"
    : `Receipt from ${counterpartyName}`;
}

function Bubble({
  message,
  counterpartyName,
  onOpenImage,
}: {
  message: TradeMessage;
  counterpartyName: string;
  onOpenImage: (image: { url: string; alt: string }) => void;
}) {
  if (message.author === "system") {
    return (
      <li className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">
          {message.text}
        </span>
      </li>
    );
  }

  const outgoing = message.author === "self";
  const alt = message.image ? imageAlt(message, counterpartyName) : "";

  return (
    <li className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[78%] flex-col gap-1">
        <div
          className={cn(
            "overflow-hidden rounded-2xl text-sm leading-relaxed",
            outgoing
              ? "rounded-br-md bg-chat-bubble-outgoing text-chat-bubble-outgoing-foreground"
              : "rounded-bl-md bg-muted text-foreground",
            // An image sits in a thin frame; text keeps the roomier padding.
            message.image ? "p-1" : "px-4 py-2.5",
          )}
        >
          {message.image ? (
            <button
              type="button"
              onClick={() =>
                onOpenImage({ url: message.image!.url, alt })
              }
              className="block cursor-zoom-in overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the
                  bytes come from our own session-checked route, which next/image
                  cannot optimise and should not try to. */}
              <img
                src={message.image.url}
                width={message.image.width}
                height={message.image.height}
                alt={alt}
                loading="lazy"
                decoding="async"
                // The intrinsic size above is what reserves the space, so the
                // conversation does not jump as images arrive.
                className="h-auto w-full max-w-[280px] rounded-xl object-contain"
              />
            </button>
          ) : null}

          {message.text ? (
            <p className={cn(message.image && "px-3 pt-2 pb-1")}>
              {message.text}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center gap-1 px-1 text-muted-foreground",
            outgoing && "justify-end",
          )}
        >
          <Timestamp timestamp={message.timestamp} />
          {outgoing ? <DeliveryTicks status={message.delivery} /> : null}
        </div>
      </div>
    </li>
  );
}

export interface ChatPanelProps {
  counterparty: { address: string; nickname: string; avatarUrl?: string | null };
  messages: TradeMessage[];
  onSend: (text: string) => void;
  /** Omitted where attachments are not wired up; the affordances hide. */
  onSendImage?: (file: File) => void | Promise<unknown>;
  sending?: boolean;
  uploading?: boolean;
  /** Shown above the composer when a send fails. */
  error?: string | null;
  className?: string;
}

/**
 * Trade chat. Chat is a transaction surface here, not a side feature — it is
 * where the two sides actually coordinate the off-chain leg, so escrow events
 * land in the same stream as the conversation, and so does the receipt image
 * the buyer sends to show the transfer went out.
 */
export function ChatPanel({
  counterparty,
  messages,
  onSend,
  onSendImage,
  sending = false,
  uploading = false,
  error = null,
  className,
}: ChatPanelProps) {
  const [draft, setDraft] = React.useState("");
  const [noticeOpen, setNoticeOpen] = React.useState(true);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<{
    url: string;
    alt: string;
  } | null>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  /**
   * Sends a file, showing it above the composer until the server has it.
   *
   * The preview deliberately does not go in the message list: that list only
   * ever renders what came back from the server, which is what keeps a message
   * from appearing twice when the next poll lands.
   */
  const attach = React.useCallback(
    async (file: File | null | undefined) => {
      if (!file || !onSendImage) return;

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      try {
        await onSendImage(file);
      } finally {
        URL.revokeObjectURL(objectUrl);
        setPreview(null);
      }
    },
    [onSendImage],
  );

  const canAttach = Boolean(onSendImage) && !uploading;

  return (
    <section
      data-slot="chat-panel"
      aria-label={`Chat with ${counterparty.nickname}`}
      onDragOver={(event) => {
        if (!canAttach || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // Ignore the leave events fired while crossing between children.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!canAttach) return;
        event.preventDefault();
        setDragging(false);
        void attach(event.dataTransfer.files[0]);
      }}
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative shrink-0">
          <WalletBadge
            address={counterparty.address}
            size="sm"
            src={counterparty.avatarUrl}
          />
          <span
            aria-hidden
            className="absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">
            {counterparty.nickname}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            <span className="font-mono">
              {truncateAddress(counterparty.address)}
            </span>
            {" · "}
            trade counterparty
          </span>
        </div>
      </div>

      {/* Safety notice — the one thing that loses people money if ignored.
          Attachments make it matter more, not less: a screenshot is the easiest
          thing in this conversation to fake. */}
      {noticeOpen ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-border bg-warning/10 px-4 py-2.5 text-xs text-warning">
          <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
          <p className="flex-1">
            Never send funds until you have checked the other side&rsquo;s transfer
            actually arrived in your account. A screenshot is not proof of
            payment, and SafeSwap holds nothing.
          </p>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setNoticeOpen(false)}
            className="shrink-0 cursor-pointer rounded-full p-0.5 transition-colors hover:bg-warning/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* Messages */}
      <ul
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            counterpartyName={counterparty.nickname}
            onOpenImage={setLightbox}
          />
        ))}
      </ul>

      {error ? (
        <p
          role="alert"
          className="shrink-0 border-t border-border bg-destructive/10 px-4 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      {/* Pending upload, held outside the list until the server has it. */}
      {preview ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local
              object URL, which next/image cannot take. */}
          <img
            src={preview}
            alt=""
            className="size-10 rounded-lg border border-border object-cover"
          />
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            Sending image…
          </span>
        </div>
      ) : null}

      {/* Composer */}
      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
        {onSendImage ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                void attach(event.target.files?.[0]);
                // Cleared so picking the same file again still fires onChange.
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!canAttach}
              aria-label="Attach an image"
              title="Attach an image"
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-40"
            >
              <Paperclip aria-hidden className="size-4" />
            </button>
          </>
        ) : null}

        <textarea
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          onPaste={(event) => {
            if (!canAttach) return;
            // The main path in practice: a transfer screenshot is pasted, not
            // saved to disk and then picked.
            const file = Array.from(event.clipboardData.files).find((entry) =>
              entry.type.startsWith("image/"),
            );
            if (!file) return;
            event.preventDefault();
            void attach(file);
          }}
          placeholder="Message…"
          aria-label="Write a message"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-primary/5 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />

        <button
          type="button"
          onClick={submit}
          disabled={draft.trim() === "" || sending}
          aria-label="Send message"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden active:scale-97 disabled:pointer-events-none disabled:opacity-40"
        >
          <Send aria-hidden className="size-4" />
        </button>
      </div>

      {/* Drop target */}
      {dragging ? (
        <div
          aria-hidden
          className="absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/85"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <ImageUp aria-hidden className="size-5" />
            Drop the image here
          </span>
        </div>
      ) : null}

      <Dialog
        open={lightbox !== null}
        title={lightbox?.alt ?? ""}
        onDismiss={() => setLightbox(null)}
        className="max-w-3xl"
      >
        {lightbox ? (
          // eslint-disable-next-line @next/next/no-img-element -- see above.
          <img
            src={lightbox.url}
            alt=""
            className="max-h-[70dvh] w-full rounded-xl object-contain"
          />
        ) : null}
      </Dialog>
    </section>
  );
}
