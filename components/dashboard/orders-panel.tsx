"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TabBar } from "@/components/ui/tab-bar";
import { EscrowStatusBadge } from "@/components/trade/escrow-status-badge";
import {
  isOpenStatus,
  removeOpenOrder,
  setOpenOrderStatus,
  useOpenOrders,
} from "@/components/trade/open-orders-store";
import type { EscrowStatus } from "@/components/trade/types";
import { MARKET } from "@/components/p2p/types";
import { SIDE_TONE } from "@/components/p2p/side";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat } from "@/lib/format";
import { Panel, PanelEmpty } from "./panel";

export function OrdersPanel() {
  const orders = useOpenOrders();
  const [tabIndex, setTabIndex] = React.useState(0);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const showingOpen = tabIndex === 0;

  // Records written before snapshots existed cannot be rendered, and there is
  // nothing left to look them up in — skip rather than guess.
  const all = orders.flatMap((record) => {
    if (!record.snapshot) return [];
    const { mode, price, nickname } = record.snapshot;
    const isBuy = mode === "buy";
    return [
      {
        record,
        mode,
        nickname,
        fiatAmount: isBuy ? record.amount : record.amount * price,
        assetAmount: isBuy ? record.amount / price : record.amount,
      },
    ];
  });

  const rows = all.filter(
    ({ record }) => isOpenStatus(record.status) === showingOpen,
  );
  const openCount = all.filter(({ record }) => isOpenStatus(record.status)).length;
  const confirmingRow = all.find((row) => row.record.orderId === confirming);

  function closeOrder(orderId: string, status: EscrowStatus) {
    // Same rule as the trade screen: an order can only be cancelled before the
    // fiat leg moves. Past that, the × just clears a finished row.
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
      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map(({ record, mode, nickname, fiatAmount, assetAmount }) => {
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
                    SIDE_TONE[mode].pill,
                  )}
                >
                  {SIDE_TONE[mode].label}
                </span>

                <div className="flex min-w-40 flex-1 flex-col">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatFiat(fiatAmount)}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {formatAsset(assetAmount)} {MARKET.asset}
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {nickname} · {record.method}
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
                      ? `Cancel order with ${nickname}`
                      : `Remove order with ${nickname} from this list`
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
        <PanelEmpty>
          <p>
            {showingOpen
              ? "No orders in flight."
              : "Nothing closed yet."}
          </p>
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
        title="Cancel this order?"
        description={
          confirmingRow ? (
            <>
              The escrow refunds {formatAsset(confirmingRow.assetAmount)}{" "}
              {MARKET.asset} to {confirmingRow.nickname} and
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
    </Panel>
  );
}
