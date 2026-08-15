import { TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { MARKET, type OrderMode } from "./types";

export interface MarketStatsProps {
  mode: OrderMode;
  bestPrice: number | null;
  offersCount: number;
  avgWindowMinutes: number | null;
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Market summary above the book. Reflects what the filters actually left
 * visible, so the headline price is always a price you can act on.
 */
export function MarketStats({
  mode,
  bestPrice,
  offersCount,
  avgWindowMinutes,
}: MarketStatsProps) {
  return (
    <section
      data-slot="market-stats"
      aria-label="Market summary"
      className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3"
    >
      <Stat label={mode === "buy" ? "Best buy price" : "Best sell price"}>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {bestPrice === null ? "—" : formatPrice(bestPrice)}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {MARKET.fiat} / {MARKET.asset}
          </span>
        </div>
      </Stat>

      <Stat label="Offers">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {offersCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <TrendingUp aria-hidden className="size-3.5" />
            live
          </span>
        </div>
      </Stat>

      <Stat label="Avg. release">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {avgWindowMinutes === null ? "—" : avgWindowMinutes}
          </span>
          <span className="text-sm font-medium text-muted-foreground">min</span>
        </div>
      </Stat>
    </section>
  );
}
