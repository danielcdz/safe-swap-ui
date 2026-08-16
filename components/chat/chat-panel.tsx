"use client";

import * as React from "react";
import { Check, CheckCheck, Send, ShieldAlert, X } from "lucide-react";
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

function Bubble({ message }: { message: TradeMessage }) {
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

  return (
    <li className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[78%] flex-col gap-1">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            outgoing
              ? "rounded-br-md bg-chat-bubble-outgoing text-chat-bubble-outgoing-foreground"
              : "rounded-bl-md bg-muted text-foreground",
          )}
        >
          {message.text}
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
  counterparty: { address: string; nickname: string };
  messages: TradeMessage[];
  onSend: (text: string) => void;
  sending?: boolean;
  /** Shown above the composer when a send fails. */
  error?: string | null;
  className?: string;
}

/**
 * Trade chat. Chat is a transaction surface here, not a side feature — it is
 * where the two sides actually coordinate the off-chain leg, so escrow events
 * land in the same stream as the conversation.
 */
export function ChatPanel({
  counterparty,
  messages,
  onSend,
  sending = false,
  error = null,
  className,
}: ChatPanelProps) {
  const [draft, setDraft] = React.useState("");
  const [noticeOpen, setNoticeOpen] = React.useState(true);
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section
      data-slot="chat-panel"
      aria-label={`Chat with ${counterparty.nickname}`}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative shrink-0">
          <WalletBadge address={counterparty.address} size="sm" />
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

      {/* Safety notice — the one thing that loses people money if ignored. */}
      {noticeOpen ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-border bg-warning/10 px-4 py-2.5 text-xs text-warning">
          <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
          <p className="flex-1">
            Never send funds until you have checked the other side&rsquo;s transfer
            actually arrived. SafeSwap holds nothing.
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
          <Bubble key={message.id} message={message} />
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

      {/* Composer */}
      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
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
    </section>
  );
}
