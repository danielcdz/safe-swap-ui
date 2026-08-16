"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TabBar } from "@/components/ui/tab-bar";
import { TradeStatusBadge } from "@/components/trade/trade-status-badge";
import {
  invalidateTrades,
  useTrades,
  type TradeSummary,
} from "@/components/trade/trades-store";
import { isInFlight, type TradeStatus } from "@/components/trade/types";
import { MARKET } from "@/components/p2p/types";
import { SIDE_TONE } from "@/components/p2p/side";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat } from "@/lib/format";
import { Panel, PanelEmpty } from "./panel";

/** The viewer's side of the asset, in the book's own vocabulary. */
const modeFor = (role: TradeSummary["role"]) =>
  role === "buyer" ? "buy" : "sell";

export function OrdersPanel() {
  const trades = useTrades();
  const [tabIndex, setTabIndex] = React.useState(0);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const showingOpen = tabIndex === 0;

  const rows = trades.filter((trade) => isInFlight(trade.status) === showingOpen);
  const openCount = trades.filter((trade) => isInFlight(trade.status)).length;
  const confirmingRow = trades.find((trade) => trade.id === confirming);

  /**
   * Cancelling goes through the same endpoint the trade screen uses, so the
   * rules live in one place — past `open` the API refuses, because by then the
   * money may already have moved and the way out is a dispute.
   */
  async function confirmCancel() {
    if (!confirmingRow) return;
    setCancelling(true);
    setError(null);

    try {
      const response = await fetch(`/api/trades/${confirmingRow.id}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", from: confirmingRow.status }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Could not cancel the trade.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      // Either way the row may have moved on — the counterparty could have
      // advanced it while this dialog was open.
      invalidateTrades();
      setCancelling(false);
      setConfirming(null);
    }
  }

  return (
    <Panel
      title="Orders"
      storageKey="safeswap:dashboard-orders-collapsed"
      lead={
        <TabBar
          size="sm"
          tabs={["Open", "Past"]}
          activeIndex={tabIndex}
          onChange={setTabIndex}
        />
      }
      trailing={
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
          {rows.length} {showingOpen ? "active" : "closed"}
        </span>
      }
      collapsedTrailing={
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
          {openCount} open
        </span>
      }
    >
      {error ? (
        <p
          role="alert"
          className="border-b border-border bg-destructive/10 px-5 py-2.5 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map((trade) => {
            const mode = modeFor(trade.role);
            // Only before anything has moved. Past that a trade cannot be
            // withdrawn, and a past row has nothing left to close.
            const cancellable = trade.status === "open";

            return (
              <li
                key={trade.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
              >
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    SIDE_TONE[mode].pill,
                  )}
                >
                  {SIDE_TONE[mode].label}
                </span>

                <div className="flex min-w-40 flex-1 flex-col">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatFiat(trade.fiatAmount)}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {formatAsset(trade.assetAmount)} {MARKET.asset}
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {trade.counterparty.nickname} · {trade.paymentMethod}
                  </span>
                </div>

                <TradeStatusBadge status={trade.status as TradeStatus} />

                <Link
                  href={`/trades/${trade.id}`}
                  className={cn(buttonVariants({ size: "sm" }), "min-w-20")}
                >
                  {showingOpen ? "Resume" : "View"}
                </Link>

                {cancellable ? (
                  <button
                    type="button"
                    aria-label={`Cancel trade with ${trade.counterparty.nickname}`}
                    title="Cancel trade"
                    onClick={() => setConfirming(trade.id)}
                    className="grid size-7 cursor-pointer place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                ) : (
                  <span aria-hidden className="size-7" />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <PanelEmpty>
          <p>{showingOpen ? "No trades in flight." : "Nothing closed yet."}</p>
          {showingOpen ? (
            <Link
              href="/p2p/orders"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Browse the order book
            </Link>
          ) : null}
        </PanelEmpty>
      )}

      <ConfirmDialog
        open={confirmingRow !== undefined}
        title="Cancel this trade?"
        description={
          confirmingRow ? (
            <>
              This closes the trade with {confirmingRow.counterparty.nickname}{" "}
              and returns {formatAsset(confirmingRow.assetAmount)}{" "}
              {MARKET.asset} to the offer. Cancelling often can affect your
              completion rate.
            </>
          ) : null
        }
        confirmLabel={cancelling ? "Cancelling…" : "Cancel trade"}
        dismissLabel="Keep trade"
        onConfirm={confirmCancel}
        onDismiss={() => setConfirming(null)}
      />
    </Panel>
  );
}
