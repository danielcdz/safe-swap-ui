"use client";

/**
 * SUPERSEDED by manual-trade-screen.tsx, and kept deliberately.
 *
 * This is the escrow composition: the lifecycle, the stepper wired to
 * ESCROW_STEPS, and the release/dispute actions. Escrow is deferred rather
 * than abandoned, so the assembled version stays here as the starting point
 * for bringing it back. Nothing routes to it.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { MARKET } from "@/components/p2p/types";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatAsset } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import { setOpenOrderStatus, useOpenOrders } from "./open-orders-store";
import { EscrowStatusBadge } from "./escrow-status-badge";
import { EscrowStepper } from "./escrow-stepper";
import { TradeSummary } from "./trade-summary";
import type { EscrowStatus, Trade, TradeMessage } from "./types";

/** Stage 2 = deploy and fund are done; the fiat leg is what's outstanding. */
const INITIAL_STAGE = 2;

/** How far along a stored status says the lifecycle already is. */
const STAGE_BY_STATUS: Record<EscrowStatus, number> = {
  pending: 2,
  funded: 3,
  disputed: 3,
  cancelled: 2,
  released: 4,
};

/** Runs inside a lazy state initializer, so reading the clock here is fine. */
function initialMessages(trade: Trade): TradeMessage[] {
  const now = Date.now();
  return [
    {
      id: "sys-1",
      author: "system",
      text: `Escrow deployed · ${trade.assetAmount.toFixed(2)} ${MARKET.asset} locked`,
      timestamp: now - 2 * 60_000,
    },
    {
      id: "msg-1",
      author: "counterparty",
      text: `Hi! I've got the ${MARKET.asset} in escrow. Send the ${trade.paymentMethod} transfer whenever you're ready and drop the reference here.`,
      timestamp: now - 60_000,
    },
  ];
}

function statusFor(stage: number, disputed: boolean): EscrowStatus {
  if (disputed) return "disputed";
  if (stage >= 4) return "released";
  if (stage >= 3) return "funded";
  return "pending";
}

/** What the screen is asking of you right now. */
function headingFor({
  cancelled,
  disputed,
  settled,
  isBuy,
  stage,
}: {
  cancelled: boolean;
  disputed: boolean;
  settled: boolean;
  isBuy: boolean;
  stage: number;
}) {
  if (cancelled) return "Order cancelled";
  if (disputed) return "Trade in dispute";
  if (settled) return "Trade complete";
  if (isBuy) return stage === 2 ? "Send your payment" : "Waiting for release";
  return stage === 2 ? "Waiting for payment" : `Release the ${MARKET.asset}`;
}

/** Countdown against the trader's payment window. */
function Countdown({ minutes }: { minutes: number }) {
  const mounted = useMounted();
  const [deadline] = React.useState(() => Date.now() + minutes * 60_000);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;

  const remaining = Math.max(0, deadline - now);
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");

  return (
    <span className="tabular-nums">
      {mm}:{ss}
    </span>
  );
}

export function TradeScreen({ trade }: { trade: Trade }) {
  const isBuy = trade.mode === "buy";
  const [localStage, setLocalStage] = React.useState(INITIAL_STAGE);
  const [localDisputed, setLocalDisputed] = React.useState(false);
  const [localCancelled, setLocalCancelled] = React.useState(false);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [messages, setMessages] = React.useState<TradeMessage[]>(() =>
    initialMessages(trade),
  );

  // Resume has to land where the trade actually is. The stored record sets
  // the floor; anything done in this session can only move it forward.
  const stored = useOpenOrders().find(
    (record) => record.orderId === trade.orderId,
  );
  const stage = Math.max(
    localStage,
    stored ? STAGE_BY_STATUS[stored.status] : INITIAL_STAGE,
  );
  const disputed = localDisputed || stored?.status === "disputed";
  const cancelled = localCancelled || stored?.status === "cancelled";

  const status: EscrowStatus = cancelled
    ? "cancelled"
    : statusFor(stage, disputed);

  function push(message: Omit<TradeMessage, "id" | "timestamp">) {
    const timestamp = Date.now();
    setMessages((current) => [
      ...current,
      { ...message, id: `m-${current.length + 1}`, timestamp },
    ]);
  }

  function handleSend(text: string) {
    push({ author: "self", text, delivery: "sent" });
  }

  /** Advances the stepper and keeps the open-orders record in step. */
  function advanceTo(next: number) {
    setLocalStage(next);
    setOpenOrderStatus(trade.orderId, statusFor(next, false));
  }

  /**
   * Seam: each of these stands in for an escrow call — approve-milestone and
   * release on the Trustless Work API. The counterparty reply is mocked so the
   * lifecycle is walkable end to end.
   */
  async function advance() {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    if (isBuy && stage === 2) {
      advanceTo(3);
      push({ author: "system", text: "Payment marked as sent" });
      setTimeout(() => {
        advanceTo(4);
        push({ author: "system", text: `${MARKET.asset} released from escrow` });
      }, 2500);
    } else if (!isBuy && stage === 2) {
      advanceTo(3);
      push({ author: "system", text: "Payment confirmed received" });
    } else if (stage === 3) {
      advanceTo(4);
      push({ author: "system", text: `${MARKET.asset} released from escrow` });
    }

    setPending(false);
  }

  function raiseDispute() {
    setLocalDisputed(true);
    setOpenOrderStatus(trade.orderId, "disputed");
    push({ author: "system", text: "Dispute raised — a resolver was notified" });
  }

  /** Seam: the real cancel refunds the escrow to the seller and closes it. */
  function cancelOrder() {
    setLocalCancelled(true);
    setConfirmingCancel(false);
    setOpenOrderStatus(trade.orderId, "cancelled");
    push({
      author: "system",
      text: `Order cancelled — ${MARKET.asset} refunded from escrow`,
    });
  }

  const actionLabel = isBuy
    ? stage === 2
      ? "I've sent the payment"
      : `Waiting for ${trade.counterparty.nickname}`
    : stage === 2
      ? "Confirm payment received"
      : `Release ${MARKET.asset}`;

  const settled = stage >= 4;
  const closed = settled || cancelled;
  const actionDisabled =
    pending || disputed || closed || (isBuy && stage > 2);

  const heading = headingFor({ cancelled, disputed, settled, isBuy, stage });

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/p2p/orders"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-5")}
      >
        <ArrowLeft aria-hidden className="size-4" />
        Order book
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:items-start">
        {/* Order state */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
            <EscrowStatusBadge status={status} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <TradeSummary trade={trade} />

            <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">Escrow</h2>
                {!closed && !disputed ? (
                  <span className="text-xs text-muted-foreground">
                    Window <Countdown minutes={trade.windowMinutes} />
                  </span>
                ) : null}
              </div>

              <EscrowStepper
                stage={Math.min(stage, 3)}
                disputed={disputed}
                halted={cancelled}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="sm:min-w-56"
              disabled={actionDisabled}
              aria-busy={pending}
              onClick={advance}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  Confirming…
                </>
              ) : cancelled ? (
                "Order cancelled"
              ) : settled ? (
                "Trade complete"
              ) : (
                actionLabel
              )}
            </Button>

            {/* Cancelling is only honest before the fiat leg moves; once it
                has, the way out is a dispute. */}
            {!closed && !disputed && stage === 2 ? (
              <Button
                variant="danger"
                size="lg"
                onClick={() => setConfirmingCancel(true)}
              >
                Cancel order
              </Button>
            ) : null}

            {!closed && !disputed && stage > 2 ? (
              <Button variant="danger" size="lg" onClick={raiseDispute}>
                Raise dispute
              </Button>
            ) : null}
          </div>
        </div>

        {/* Chat */}
        <ChatPanel
          counterparty={{
            address: trade.counterparty.address,
            nickname: trade.counterparty.nickname,
          }}
          messages={messages}
          onSend={handleSend}
          // Capped rather than viewport-filling: an uncapped panel sets the
          // grid row height, stretching the page past the fold on tall screens
          // and cropping the composer.
          className="h-[26rem] lg:sticky lg:top-20 lg:h-[min(36rem,calc(100dvh-8rem))]"
        />
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel this order?"
        description={
          <>
            The escrow refunds {formatAsset(trade.assetAmount)} {MARKET.asset}{" "}
            to {trade.counterparty.nickname} and this order closes. Cancelling
            often can affect your completion rate.
          </>
        }
        confirmLabel="Cancel order"
        dismissLabel="Keep order"
        onConfirm={cancelOrder}
        onDismiss={() => setConfirmingCancel(false)}
      />
    </main>
  );
}
