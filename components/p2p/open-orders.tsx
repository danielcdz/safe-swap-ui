"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EscrowStatusBadge } from "@/components/trade/escrow-status-badge";
import { buildTrade } from "@/components/trade/build-trade";
import {
  removeOpenOrder,
  useOpenOrders,
} from "@/components/trade/open-orders-store";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat } from "@/lib/format";
import { MOCK_ORDERS } from "./mock-orders";
import { MARKET } from "./types";

/**
 * Trades already in flight, surfaced above the book so leaving a trade screen
 * doesn't strand it. Renders nothing when there are none.
 */
export function OpenOrders() {
  const openOrders = useOpenOrders();

  const rows = openOrders.flatMap((record) => {
    const order = MOCK_ORDERS.find(
      (candidate) => candidate.id === record.orderId,
    );
    if (!order) return [];
    return [{ record, trade: buildTrade(order, record.amount, record.method) }];
  });

  if (rows.length === 0) return null;

  return (
    <section
      data-slot="open-orders"
      aria-label="Your open orders"
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Your open orders</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
          {rows.length} active
        </span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map(({ record, trade }) => {
          const settled = record.status === "released";
          const href = `/trades/${record.orderId}?amount=${record.amount}&method=${encodeURIComponent(record.method)}`;

          return (
            <li
              key={record.orderId}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
            >
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {trade.mode === "buy" ? "Buy" : "Sell"}
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
                {settled ? "View" : "Resume"}
              </Link>

              <button
                type="button"
                aria-label={`Remove ${trade.counterparty.nickname} order from this list`}
                title="Remove from list — the escrow is unaffected"
                onClick={() => removeOpenOrder(record.orderId)}
                className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
