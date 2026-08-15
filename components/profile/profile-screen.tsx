"use client";

import * as React from "react";
import { BadgeCheck, Check, Copy, Star } from "lucide-react";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { MARKET } from "@/components/p2p/types";
import { formatAsset, truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { joinedLabel, PROFILE } from "./mock-profile";

function Metric({
  label,
  value,
  unit,
  hint,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        {icon}
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

export function ProfileScreen() {
  const [copied, setCopied] = React.useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(PROFILE.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      {/* Identity */}
      <section className="flex flex-col items-start gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <WalletBadge address={PROFILE.address} size="xl" />
          <span
            aria-hidden
            className="absolute -end-1 -bottom-1 size-5 rounded-full bg-primary ring-4 ring-card"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {PROFILE.nickname}
            </h1>
            {PROFILE.verified ? (
              <BadgeCheck
                className="size-5 shrink-0 text-primary"
                aria-label="Verified trader"
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={copyAddress}
            title={PROFILE.address}
            aria-label="Copy your wallet address"
            className="group inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
          >
            <span className="font-mono">
              {truncateAddress(PROFILE.address, 6, 6)}
            </span>
            {copied ? (
              <Check aria-hidden className="size-3.5 text-primary" />
            ) : (
              <Copy
                aria-hidden
                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            )}
          </button>

          <span className="text-xs text-muted-foreground">
            Trading since {joinedLabel()}
          </span>
        </div>

        {PROFILE.verified ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              "border-success/30 bg-success/10 text-success",
            )}
          >
            <BadgeCheck aria-hidden className="size-3.5" />
            Verified
          </span>
        ) : null}
      </section>

      {/* Record */}
      <h2 className="mt-8 mb-3 text-sm font-semibold">Trading record</h2>
      <section
        aria-label="Trading record"
        className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
      >
        <Metric
          label="Rating"
          value={PROFILE.rating.toFixed(2)}
          icon={
            <Star aria-hidden className="size-5 fill-current text-primary" />
          }
          hint={`${PROFILE.positiveFeedback}% positive feedback`}
        />
        <Metric
          label="Trades"
          value={String(PROFILE.totalTrades)}
          hint="Completed all-time"
        />
        <Metric
          label="Completion"
          value={PROFILE.completionRate.toFixed(1)}
          unit="%"
          hint="Orders taken that settled"
        />
        <Metric
          label="Avg. release"
          value={String(PROFILE.avgReleaseMinutes)}
          unit="min"
          hint="From payment to release"
        />
        <Metric
          label="30-day volume"
          value={formatAsset(PROFILE.volume30d)}
          unit={MARKET.asset}
        />
        <Metric
          label="Positive feedback"
          value={PROFILE.positiveFeedback.toFixed(1)}
          unit="%"
          hint="Across all counterparties"
        />
      </section>
    </main>
  );
}
