"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { MARKET } from "@/components/p2p/types";
import { SIDE_TONE } from "@/components/p2p/side";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat, formatPrice, truncateAddress } from "@/lib/format";
import type { Trade } from "./types";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{children}</span>
    </div>
  );
}

export function TradeSummary({ trade }: { trade: Trade }) {
  const [copied, setCopied] = React.useState(false);
  const isBuy = trade.mode === "buy";

  async function copyReference() {
    await navigator.clipboard.writeText(trade.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      data-slot="trade-summary"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3">
        <span
          className={cn(
            "text-xs font-semibold tracking-wider uppercase",
            SIDE_TONE[trade.mode].text,
          )}
        >
          {SIDE_TONE[trade.mode].label} {MARKET.asset}
        </span>

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatFiat(trade.fiatAmount)}
          </span>
          <span className="text-sm text-muted-foreground">{MARKET.fiat}</span>
        </div>

        <button
          type="button"
          onClick={copyReference}
          aria-label="Copy order reference"
          className="group inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
        >
          <span className="font-mono">{trade.reference}</span>
          {copied ? (
            <Check aria-hidden className="size-3 text-primary" />
          ) : (
            <Copy
              aria-hidden
              className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </button>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2.5">
        <Row label="Price">
          <span className="tabular-nums">
            {formatPrice(trade.price)} {MARKET.fiat}
          </span>
        </Row>
        <Row label={isBuy ? "You receive" : "You sell"}>
          <span className="tabular-nums">
            {formatAsset(trade.assetAmount)} {MARKET.asset}
          </span>
        </Row>
        <Row label="Payment method">{trade.paymentMethod}</Row>
      </div>

      <div className="h-px bg-border" />

      <Row label="Counterparty">
        <span className="inline-flex items-center gap-2">
          <WalletBadge
            address={trade.counterparty.address}
            size="sm"
            className="size-6 text-[9px]"
          />
          <span className="flex flex-col items-end">
            <span>{trade.counterparty.nickname}</span>
            <span
              className={cn("font-mono text-xs font-normal text-muted-foreground")}
            >
              {truncateAddress(trade.counterparty.address)}
            </span>
          </span>
        </span>
      </Row>
    </section>
  );
}
