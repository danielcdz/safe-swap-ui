"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TabBar } from "@/components/ui/tab-bar";
import { EscrowStatusBadge } from "@/components/trade/escrow-status-badge";
import { buildTrade } from "@/components/trade/build-trade";
import {
  removeOpenOrder,
  setOpenOrderStatus,
  useOpenOrders,
} from "@/components/trade/open-orders-store";
import type { EscrowStatus } from "@/components/trade/types";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat } from "@/lib/format";
import { MOCK_ORDERS } from "./mock-orders";
import { MARKET } from "./types";
import { SIDE_TONE } from "./side";

/**
 * Still in flight. A dispute is unresolved, so it belongs here rather than in
 * history — only a released or cancelled order is genuinely done with.
 */
const OPEN_STATUSES: EscrowStatus[] = ["pending", "funded", "disputed"];

function isOpen(status: EscrowStatus) {
  return OPEN_STATUSES.includes(status);
}

/**
 * Your trades, surfaced above the book so leaving a trade screen doesn't
 * strand one. Renders nothing until there is something to show.
 */
export function OpenOrders() {
  const orders = useOpenOrders();
  const [tabIndex, setTabIndex] = React.useState(0);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const showingOpen = tabIndex === 0;

  const all = orders.flatMap((record) => {
    const order = MOCK_ORDERS.find(
      (candidate) => candidate.id === record.orderId,
    );
    if (!order) return [];
    return [{ record, trade: buildTrade(order, record.amount, record.method) }];
  });

  const rows = all.filter(({ record }) => isOpen(record.status) === showingOpen);
  const confirmingRow = all.find((row) => row.record.orderId === confirming);

  function closeOrder(orderId: string, status: EscrowStatus) {
    // Same rule as the trade screen: an order can only be cancelled before the
    // fiat leg moves. Past that, the × just clears the row from this list.
    if (status === "pending") {
      setConfirming(orderId);
      return;
    }
    removeOpenOrder(orderId);
  }

  function confirmCancel() {
    if (!confirming) return;
    setOpenOrderStatus(confirming, "cancelled");
    setConfirming(null);
  }

  if (all.length === 0) return null;

  return (
    <section
      data-slot="open-orders"
      aria-label="Your orders"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Your orders</h2>
          <TabBar
            size="sm"
            tabs={["Open", "Past"]}
            activeIndex={tabIndex}
            onChange={setTabIndex}
          />
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
          {rows.length} {showingOpen ? "active" : "closed"}
        </span>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map(({ record, trade }) => {
            const cancellable = record.status === "pending";
            const href = `/trades/${record.orderId}?amount=${record.amount}&method=${encodeURIComponent(record.method)}`;

            return (
              <li
                key={record.orderId}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
              >
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    SIDE_TONE[trade.mode].pill,
                  )}
                >
                  {SIDE_TONE[trade.mode].label}
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

                <EscrowStatusBadge status={record.status} />

                <Link
                  href={href}
                  className={cn(buttonVariants({ size: "sm" }), "min-w-20")}
                >
                  {showingOpen ? "Resume" : "View"}
                </Link>

                <button
                  type="button"
                  aria-label={
                    cancellable
                      ? `Cancel order with ${trade.counterparty.nickname}`
                      : `Remove order with ${trade.counterparty.nickname} from this list`
                  }
                  title={cancellable ? "Cancel order" : "Remove from list"}
                  onClick={() => closeOrder(record.orderId, record.status)}
                  className="grid size-7 cursor-pointer place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-5">
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            {showingOpen
              ? "No orders in flight. Open one from the book below."
              : "Nothing closed yet."}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmingRow !== undefined}
        title="Cancel this order?"
        description={
          confirmingRow ? (
            <>
              The escrow refunds {formatAsset(confirmingRow.trade.assetAmount)}{" "}
              {MARKET.asset} to {confirmingRow.trade.counterparty.nickname} and
              this order closes. Cancelling often can affect your completion
              rate.
            </>
          ) : null
        }
        confirmLabel="Cancel order"
        dismissLabel="Keep order"
        onConfirm={confirmCancel}
        onDismiss={() => setConfirming(null)}
      />
    </section>
  );
}
