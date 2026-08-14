"use client";

import * as React from "react";
import { BadgeCheck, Check, ChevronUp, Clock, Copy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { cn } from "@/lib/utils";
import {
  formatAsset,
  formatFiat,
  formatPrice,
  truncateAddress,
} from "@/lib/format";
import { MARKET, type P2POrder } from "./types";
import { OrderTradePanel } from "./order-trade-panel";

/** Shared by the row and the column header so the two stay locked together. */
export const ORDER_GRID =
  "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,auto)]";

/** Small label that only shows once the row stacks on narrow screens. */
function StackLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs text-muted-foreground lg:hidden">{children}</span>
  );
}

export interface OrderRowProps {
  order: P2POrder;
  open: boolean;
  onToggle: () => void;
}

export function OrderRow({ order, open, onToggle }: OrderRowProps) {
  const [copied, setCopied] = React.useState(false);
  const { trader } = order;
  const panelId = `trade-panel-${order.id}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(trader.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      data-slot="order-row"
      data-state={open ? "open" : "closed"}
      className={cn(
        "transition-colors",
        open && "bg-muted/30 ring-1 ring-primary/20 ring-inset",
      )}
    >
      <div
        className={cn(
          "grid gap-5 px-5 py-5 transition-colors lg:items-center lg:gap-6 lg:px-6",
          !open && "hover:bg-muted/40",
          ORDER_GRID,
        )}
      >
        {/* Advertiser — the trust block. Identity, track record, on-chain address. */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative shrink-0">
            <WalletBadge address={trader.address} size="lg" />
            <span
              aria-hidden
              className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full bg-primary ring-2 ring-card"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">
                {trader.nickname}
              </span>
              {trader.verified ? (
                <BadgeCheck
                  className="size-4 shrink-0 text-primary"
                  aria-label="Verified trader"
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
              <Star aria-hidden className="size-3 fill-current text-primary" />
              <span>{trader.rating.toFixed(2)}</span>
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
              <span>{trader.opsCount} ops</span>
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
              <span>{trader.completionRate}% completion</span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              title={trader.address}
              aria-label={`Copy ${trader.nickname}'s wallet address`}
              className="group inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
            >
              <span className="font-mono">{truncateAddress(trader.address)}</span>
              {copied ? (
                <Check aria-hidden className="size-3 shrink-0 text-primary" />
              ) : (
                <Copy
                  aria-hidden
                  className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              )}
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="flex flex-col gap-0.5">
          <StackLabel>Price</StackLabel>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatPrice(order.price)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {MARKET.fiat}
            </span>
          </div>
        </div>

        {/* Available / limits / payment window */}
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <StackLabel>Available</StackLabel>
            <span className="text-sm font-semibold tabular-nums">
              {formatAsset(order.available)}
            </span>
            <span className="text-xs text-muted-foreground">{MARKET.asset}</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatFiat(order.limits.min)} – {formatFiat(order.limits.max)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Clock aria-hidden className="size-3" />
            {order.windowMinutes} min
          </span>
        </div>

        {/* Payment methods */}
        <div className="flex flex-col gap-1.5">
          <StackLabel>Payment</StackLabel>
          <div className="flex flex-wrap gap-1.5">
            {order.paymentMethods.map((method) => (
              <span
                key={method}
                className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {method}
              </span>
            ))}
          </div>
        </div>

        {/* Trade */}
        <Button
          variant={open ? "ghost" : "primary"}
          className="w-full lg:w-auto lg:min-w-32 lg:justify-self-end"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {open ? (
            <>
              Hide
              <ChevronUp aria-hidden className="size-4" />
            </>
          ) : (
            `${order.mode === "buy" ? "Buy" : "Sell"} ${MARKET.asset}`
          )}
        </Button>
      </div>

      {open ? <OrderTradePanel order={order} id={panelId} /> : null}
    </div>
  );
}
