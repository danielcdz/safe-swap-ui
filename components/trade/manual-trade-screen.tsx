"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  Clock,
  Loader2,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MARKET } from "@/components/p2p/types";
import { SIDE_TONE } from "@/components/p2p/side";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat, formatPrice, truncateAddress } from "@/lib/format";
import type { TradeRecord } from "@/lib/trades/queries";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useTradeMessages } from "./use-trade-messages";
import { invalidateTrades } from "./trades-store";
import { EscrowStatusBadge } from "./escrow-status-badge";
import { EscrowStepper } from "./escrow-stepper";
import { MANUAL_STEPS, stageOf, type TradeRole } from "./types";

/** How often the screen re-reads the trade, so each side sees the other move. */
const POLL_MS = 3000;

const TERMINAL = new Set(["completed", "cancelled", "released"]);

function headingFor(trade: TradeRecord) {
  if (trade.status === "completed") return "Trade complete";
  if (trade.status === "cancelled") return "Trade cancelled";
  if (trade.status === "disputed") return "Trade in dispute";

  const step = MANUAL_STEPS[stageOf(trade.status)];
  if (!step) return "Trade";
  if (step.actor === trade.role) return step.action.replace(/^I've /, "Send ");

  const other = trade.role === "buyer" ? trade.seller : trade.buyer;
  return `Waiting for ${other.nickname}`;
}

/** Inline, copyable — for a value that belongs inside a sentence. */
function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={`Copy ${value}`}
      className="group inline-flex cursor-pointer items-center gap-1 rounded font-medium text-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
    >
      {value}
      {copied ? (
        <Check aria-hidden className="size-3.5 shrink-0 text-primary" />
      ) : (
        <Copy
          aria-hidden
          className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </button>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        aria-label={`Copy ${label}`}
        className="group inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full font-medium transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
      >
        <span className="truncate">{value}</span>
        {copied ? (
          <Check aria-hidden className="size-3.5 shrink-0 text-primary" />
        ) : (
          <Copy
            aria-hidden
            className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </button>
    </div>
  );
}

/**
 * A trade settled by hand.
 *
 * Both transfers are performed by the users themselves — SafeSwap holds
 * nothing and moves nothing. The screen's job is to make it unambiguous whose
 * turn it is and what they are trusting.
 */
export function ManualTradeScreen({ initial }: { initial: TradeRecord }) {
  const router = useRouter();
  const [trade, setTrade] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState("");
  const [confirming, setConfirming] = React.useState<"cancel" | "dispute" | null>(
    null,
  );

  const finished = TERMINAL.has(trade.status);
  const stage = stageOf(trade.status);
  const step = MANUAL_STEPS[stage];
  const myTurn = !finished && trade.status !== "disputed" && step?.actor === trade.role;
  const counterparty = trade.role === "buyer" ? trade.seller : trade.buyer;

  // Poll so each side sees the other's moves. Stops once nothing more can
  // happen — a finished trade has no further transitions to wait for.
  React.useEffect(() => {
    if (finished) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/trades/${trade.id}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { trade: TradeRecord };
        setTrade(data.trade);
      } catch {
        // Transient — the next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [trade.id, finished]);

  async function act(action: "next" | "cancel" | "dispute") {
    setPending(true);
    setError(null);
    setConfirming(null);

    try {
      const response = await fetch(`/api/trades/${trade.id}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          from: trade.status,
          txHash: txHash.trim() || undefined,
        }),
      });

      const body = (await response.json()) as { status?: string; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not update the trade.");
        // A stale status means the other side moved — re-read rather than
        // leaving the screen showing a step that has already happened.
        if (response.status === 409) router.refresh();
        return;
      }

      setTxHash("");
      const fresh = await fetch(`/api/trades/${trade.id}`, { cache: "no-store" });
      if (fresh.ok) setTrade(((await fresh.json()) as { trade: TradeRecord }).trade);
    } catch {
      setError("Could not reach the server.");
    } finally {
      // The dashboard list caches; this trade just changed state in it.
      invalidateTrades();
      setPending(false);
    }
  }

  const chat = useTradeMessages(trade.id, trade.viewer);

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-5")}
      >
        <ArrowLeft aria-hidden className="size-4" />
        Dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {headingFor(trade)}
            </h1>
            <EscrowStatusBadge
              status={
                trade.status === "completed"
                  ? "released"
                  : trade.status === "cancelled"
                    ? "cancelled"
                    : trade.status === "disputed"
                      ? "disputed"
                      : trade.status === "open"
                        ? "pending"
                        : "funded"
              }
            />
          </div>

          {/* SafeSwap holds nothing. Whoever moves first is trusting the other
              side, and that should be stated rather than implied. */}
          <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
            <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
            <span>
              SafeSwap does not hold funds. Both transfers are made directly
              between you and {counterparty.nickname} — only confirm a step once
              you have checked the money actually arrived.
            </span>
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {/* Summary */}
            <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3">
                <span
                  className={cn(
                    "text-xs font-semibold tracking-wider uppercase",
                    SIDE_TONE[trade.role === "buyer" ? "buy" : "sell"].text,
                  )}
                >
                  {trade.role === "buyer" ? "Buying" : "Selling"} {MARKET.asset}
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">
                    {formatFiat(trade.fiatAmount)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {MARKET.fiat}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {trade.reference}
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium tabular-nums">
                    {formatPrice(trade.price)} {MARKET.fiat}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {trade.role === "buyer" ? "You receive" : "You send"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatAsset(trade.assetAmount)} {MARKET.asset}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Payment method</span>
                  <span className="font-medium">{trade.paymentMethod}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Counterparty</span>
                  <span className="inline-flex items-center gap-2">
                    <WalletBadge
                      address={counterparty.address}
                      size="sm"
                      className="size-6 text-[9px]"
                    />
                    <span className="flex flex-col items-end">
                      <span className="font-medium">{counterparty.nickname}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {truncateAddress(counterparty.address)}
                      </span>
                    </span>
                  </span>
                </div>
              </div>
            </section>

            {/* Steps — escrow deferred, not gone */}
            <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Settlement</h2>
                <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Escrow coming soon
                </span>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Transfers are manual for now. Escrow will hold the{" "}
                {MARKET.asset} automatically in a future release.
              </p>

              <EscrowStepper
                steps={MANUAL_STEPS}
                stage={stage}
                disputed={trade.status === "disputed"}
                halted={trade.status === "cancelled"}
              />
            </section>
          </div>

          {/* What the actor needs in hand to do their part */}
          {trade.role === "buyer" && !finished && stage === 0 ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Smartphone aria-hidden className="size-4 text-primary" />
                Send {formatFiat(trade.fiatAmount)} to {counterparty.nickname}
              </h2>
              {/* SafeSwap never holds the account details, so it cannot show
                  them here. The two of you agree them in the chat. */}
              <p className="text-sm text-muted-foreground">
                Ask {counterparty.nickname} in the chat where to send it — a
                SINPE Móvil number or a bank account. Include the reference{" "}
                <CopyValue value={trade.reference} /> so they can match your
                transfer.
              </p>
              <p className="flex items-start gap-2 text-xs text-warning">
                <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                Only use details {counterparty.nickname} sends in this chat.
                Nobody from SafeSwap will ever message you asking for a payment.
              </p>
            </section>
          ) : null}

          {trade.role === "seller" && !finished && stage === 2 ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Wallet aria-hidden className="size-4 text-primary" />
                Send {formatAsset(trade.assetAmount)} {MARKET.asset} to{" "}
                {counterparty.nickname}
              </h2>
              <CopyLine label="Wallet" value={trade.buyer.address} />
              <label className="mt-1 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Transaction hash (optional)
                </span>
                <input
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value)}
                  placeholder="64 hex characters"
                  className="rounded-full bg-primary/5 px-4 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                />
                <span className="text-xs text-muted-foreground">
                  Recording it lets {counterparty.nickname} verify the transfer
                  themselves.
                </span>
              </label>
            </section>
          ) : null}

          {trade.assetTxHash ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <CopyLine label="USDC transaction" value={trade.assetTxHash} />
            </section>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="sm:min-w-56"
              disabled={!myTurn || pending}
              aria-busy={pending}
              onClick={() => act("next")}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  Working…
                </>
              ) : finished ? (
                headingFor(trade)
              ) : myTurn ? (
                step.action
              ) : (
                <>
                  <Clock aria-hidden className="size-4" />
                  Waiting for {counterparty.nickname}
                </>
              )}
            </Button>

            {!finished && trade.status === "open" ? (
              <Button
                variant="danger"
                size="lg"
                onClick={() => setConfirming("cancel")}
              >
                Cancel trade
              </Button>
            ) : null}

            {!finished && trade.status !== "open" && trade.status !== "disputed" ? (
              <Button
                variant="danger"
                size="lg"
                onClick={() => setConfirming("dispute")}
              >
                Raise dispute
              </Button>
            ) : null}
          </div>
        </div>

        <ChatPanel
          counterparty={counterparty}
          messages={chat.messages}
          onSend={chat.send}
          sending={chat.sending}
          error={chat.error}
          className="h-[26rem] lg:sticky lg:top-20 lg:h-[min(36rem,calc(100dvh-8rem))]"
        />
      </div>

      <ConfirmDialog
        open={confirming === "cancel"}
        title="Cancel this trade?"
        description={`The ${MARKET.asset} returns to ${counterparty.nickname}'s offer and this trade closes. Only do this if nothing has been sent.`}
        confirmLabel="Cancel trade"
        dismissLabel="Keep trade"
        onConfirm={() => act("cancel")}
        onDismiss={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "dispute"}
        title="Raise a dispute?"
        description="Use this when the other side is unresponsive or something has gone wrong. The trade freezes where it is."
        confirmLabel="Raise dispute"
        dismissLabel="Go back"
        onConfirm={() => act("dispute")}
        onDismiss={() => setConfirming(null)}
      />
    </main>
  );
}

export type { TradeRole };
