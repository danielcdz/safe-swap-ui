"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAds } from "@/components/ads/ads-store";
import { useTrades } from "@/components/trade/trades-store";
import { isInFlight } from "@/components/trade/types";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * High-level only. The book is for finding a counterparty, so this reports
 * how much is in flight and hands off — the rows, tabs, and actions all live
 * in the dashboard.
 */
export function ActivitySummary() {
  const trades = useTrades();
  const ads = useAds();

  if (trades.length === 0 && ads.length === 0) return null;

  const open = trades.filter((trade) => isInFlight(trade.status)).length;
  const disputed = trades.filter(
    (trade) => trade.status === "disputed",
  ).length;

  return (
    <section
      data-slot="activity-summary"
      aria-label="Your activity"
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
        <Stat label="Open trades" value={open} />
        <Stat label="Live ads" value={ads.length} />
        {disputed > 0 ? (
          <Stat label="In dispute" value={disputed} tone="destructive" />
        ) : null}
      </div>

      <Link
        href="/dashboard"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Dashboard
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
