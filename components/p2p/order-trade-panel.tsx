"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat, formatPrice } from "@/lib/format";
import { invalidateTrades } from "@/components/trade/trades-store";
import { MARKET, type P2POrder } from "./types";
import { SIDE_TONE } from "./side";

/** Small currency chip. USDC gets the brand tint, fiat stays neutral. */
function UnitChip({ unit }: { unit: string }) {
  const isAsset = unit === MARKET.asset;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-full text-[10px] font-bold",
          isAsset
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        $
      </span>
      <span className="text-sm font-semibold">{unit}</span>
    </span>
  );
}

function AmountBox({
  label,
  children,
  unit,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        {children}
        <UnitChip unit={unit} />
      </div>
    </div>
  );
}

/**
 * Inline trade form. Expands under its row so a trade can be sized without
 * leaving the book.
 *
 * The amount is entered in whichever currency the side makes natural — fiat
 * when buying, USDC when selling — and the opposite figure is derived. The
 * ceiling is the lesser of the trader's stated limit and what their remaining
 * inventory is actually worth, which is the one place `available` and `limits`
 * interact rather than just sit side by side.
 */
export function OrderTradePanel({
  order,
  id,
}: {
  order: P2POrder;
  id: string;
}) {
  const router = useRouter();
  const isBuy = order.mode === "buy";

  const [input, setInput] = React.useState("");
  const [method, setMethod] = React.useState(order.paymentMethods[0]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | undefined>();

  const inventoryValue = order.available * order.price;
  const maxUsd = Math.min(order.limits.max, inventoryValue);
  const cappedByInventory = inventoryValue < order.limits.max;

  // Limits are quoted in fiat; when selling, the input is USDC, so convert.
  const minInput = isBuy ? order.limits.min : order.limits.min / order.price;
  const maxInput = isBuy ? maxUsd : maxUsd / order.price;

  const amount = Number(input.replace(/[^\d.]/g, "")) || 0;
  const output = isBuy ? amount / order.price : amount * order.price;

  const inputUnit = isBuy ? MARKET.fiat : MARKET.asset;
  const outputUnit = isBuy ? MARKET.asset : MARKET.fiat;

  const tooSmall = amount > 0 && amount < minInput;
  const tooLarge = amount > maxInput;
  const invalid = tooSmall || tooLarge;
  const canSubmit = amount > 0 && !invalid && Boolean(method) && !submitting;

  const range = isBuy
    ? `${formatFiat(minInput)} – ${formatFiat(maxInput)}`
    : `${formatAsset(minInput)} – ${formatAsset(maxInput)} ${MARKET.asset}`;

  /**
   * Opens the trade on the server, which reserves the inventory and works out
   * the amounts from the ad's own price. The response is a trade id — the
   * screen no longer reconstructs a trade from the URL.
   */
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(undefined);

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adId: order.id, amount, paymentMethod: method }),
      });

      const body = (await response.json()) as { id?: string; error?: string };

      if (!response.ok) {
        setSubmitError(
          response.status === 401
            ? "Connect your wallet to open a trade."
            : (body.error ?? "Could not open the trade."),
        );
        setSubmitting(false);
        return;
      }

      invalidateTrades();
      router.push(`/trades/${body.id}`);
    } catch {
      setSubmitError("Could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <div
      id={id}
      role="region"
      aria-label={`Trade with ${order.trader.nickname}`}
      className="grid gap-8 border-t border-border px-5 py-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:px-6"
    >
      {/* Trader's terms */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Trader&apos;s terms
        </h3>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {order.terms}
        </p>
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
          <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>
            SafeSwap does not hold funds. You and the advertiser transfer
            directly, so only confirm a step once the money has arrived.
            Escrow is coming soon.
          </span>
        </p>
      </div>

      {/* Trade form */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Price
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {formatPrice(order.price)} {MARKET.fiat}
          </span>
        </div>

        <AmountBox
          label={
            <label htmlFor={`${id}-amount`}>
              {isBuy ? "You pay" : "You sell"}
            </label>
          }
          unit={inputUnit}
        >
          <input
            id={`${id}-amount`}
            inputMode="decimal"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={range}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-limit`}
            className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/70"
          />
          <button
            type="button"
            onClick={() => setInput(String(Math.floor(maxInput * 100) / 100))}
            className="shrink-0 cursor-pointer rounded-full px-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            All
          </button>
          <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
        </AmountBox>

        <p
          id={`${id}-limit`}
          className={cn(
            "px-1 text-xs",
            invalid ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {tooSmall
            ? `Minimum is ${range.split(" – ")[0]}.`
            : tooLarge
              ? `Maximum is ${range.split(" – ")[1]}.`
              : `Limit ${range}`}
          {!invalid && cappedByInventory ? (
            <span className="text-muted-foreground/80">
              {" "}
              · capped by remaining {MARKET.asset}
            </span>
          ) : null}
        </p>

        <AmountBox label="You receive" unit={outputUnit}>
          <span className="min-w-0 flex-1 truncate text-2xl font-semibold tabular-nums">
            {formatAsset(output)}
          </span>
        </AmountBox>

        <div
          role="radiogroup"
          aria-label="Payment method"
          className="flex flex-col gap-2"
        >
          <span className="px-1 text-xs font-medium text-muted-foreground">
            Payment method
          </span>
          <div className="flex flex-wrap gap-2">
            {order.paymentMethods.map((paymentMethod) => {
              const selected = paymentMethod === method;
              return (
                <button
                  key={paymentMethod}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(paymentMethod)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {paymentMethod}
                </button>
              );
            })}
          </div>
        </div>

        {submitError ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {submitError}
          </p>
        ) : null}

        <Button
          size="lg"
          variant={SIDE_TONE[order.mode].button}
          className="mt-1 w-full"
          disabled={!canSubmit}
          aria-busy={submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Opening trade…
            </>
          ) : (
            `${SIDE_TONE[order.mode].label} ${MARKET.asset}`
          )}
        </Button>
      </div>
    </div>
  );
}
