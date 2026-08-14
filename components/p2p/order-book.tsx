"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { TabBar } from "@/components/ui/tab-bar";
import { cn } from "@/lib/utils";
import { MARKET, type OrderMode } from "./types";
import { MOCK_ORDERS, PAYMENT_METHODS } from "./mock-orders";
import { MarketStats } from "./market-stats";
import { ORDER_GRID, OrderRow } from "./order-row";

const EASE = [0.22, 1, 0.36, 1] as const;
const MODES: OrderMode[] = ["buy", "sell"];
const ALL_METHODS = "all";

const COLUMNS: { label: string; tip?: React.ReactNode }[] = [
  { label: "Advertiser" },
  { label: "Price" },
  {
    label: "Available / Limits",
    tip: (
      <>
        <strong className="font-semibold text-foreground">Available</strong> is
        the total {MARKET.asset} left on this offer.{" "}
        <strong className="font-semibold text-foreground">Limits</strong> are
        the smallest and largest single trade the trader accepts, in{" "}
        {MARKET.fiat} — so an offer holding plenty of {MARKET.asset} can still
        cap how much you take in one go.
      </>
    ),
  },
  { label: "Payment" },
  { label: "Trade" },
];

export function OrderBook() {
  const reduced = useReducedMotion();
  const [modeIndex, setModeIndex] = React.useState(0);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<string>(ALL_METHODS);
  // Only one trade panel is open at a time, so the state lives here.
  const [openId, setOpenId] = React.useState<string | null>(null);

  const mode = MODES[modeIndex];
  const hasFilters = amount.trim() !== "" || method !== ALL_METHODS;

  const orders = React.useMemo(() => {
    const wanted = Number(amount.replace(/[^\d.]/g, ""));

    return MOCK_ORDERS.filter((order) => order.mode === mode)
      .filter(
        (order) =>
          method === ALL_METHODS || order.paymentMethods.includes(method),
      )
      .filter(
        (order) =>
          !wanted || (wanted >= order.limits.min && wanted <= order.limits.max),
      )
      .sort((a, b) =>
        // Best price depends on which side you're on: cheapest to buy,
        // highest to sell.
        mode === "buy" ? a.price - b.price : b.price - a.price,
      );
  }, [mode, amount, method]);

  const avgWindowMinutes = orders.length
    ? Math.round(
        orders.reduce((total, order) => total + order.windowMinutes, 0) /
          orders.length,
      )
    : null;

  // Any change to what's listed collapses the open panel — leaving it open
  // would resurface a half-filled form for an offer that scrolled away.
  function changeMode(index: number) {
    setModeIndex(index);
    setOpenId(null);
  }

  function changeAmount(value: string) {
    setAmount(value);
    setOpenId(null);
  }

  function changeMethod(value: string) {
    setMethod(value);
    setOpenId(null);
  }

  function clearFilters() {
    setAmount("");
    setMethod(ALL_METHODS);
    setOpenId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <TabBar
            tabs={["Buy", "Sell"]}
            activeIndex={modeIndex}
            onChange={changeMode}
          />

          {/* MVP is a single market — the chip states it instead of offering
              a selector nothing else would fill. */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              $
            </span>
            <span className="text-sm font-semibold">{MARKET.asset}</span>
            <span className="text-xs text-muted-foreground">
              / {MARKET.fiat}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <span aria-hidden className="text-sm text-muted-foreground">
              $
            </span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(event) => changeAmount(event.target.value)}
              placeholder="Amount"
              aria-label={`Filter by transaction amount in ${MARKET.fiat}`}
              className="w-28 bg-transparent text-sm text-foreground tabular-nums outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="relative">
            <select
              value={method}
              onChange={(event) => changeMethod(event.target.value)}
              aria-label="Filter by payment method"
              className="cursor-pointer appearance-none rounded-full bg-primary/5 py-2 ps-4 pe-9 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value={ALL_METHODS}>All payments</option>
              {PAYMENT_METHODS.map((paymentMethod) => (
                <option key={paymentMethod} value={paymentMethod}>
                  {paymentMethod}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <MarketStats
        mode={mode}
        bestPrice={orders[0]?.price ?? null}
        offersCount={orders.length}
        avgWindowMinutes={avgWindowMinutes}
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <div
          className={cn(
            "hidden border-b border-border px-6 py-3 lg:grid lg:gap-6",
            ORDER_GRID,
          )}
        >
          {COLUMNS.map(({ label, tip }) => (
            <span
              key={label}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
                label === "Trade" && "justify-self-end",
              )}
            >
              {label}
              {tip ? <InfoTip label={`About ${label}`}>{tip}</InfoTip> : null}
            </span>
          ))}
        </div>

        {orders.length > 0 ? (
          <div className="divide-y divide-border">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                open={order.id === openId}
                onToggle={() =>
                  setOpenId((current) =>
                    current === order.id ? null : order.id,
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No {mode} offers match these filters.
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
