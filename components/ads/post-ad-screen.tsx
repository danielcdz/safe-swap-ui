"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { NumberField } from "@/components/ui/number-field";
import { TabBar } from "@/components/ui/tab-bar";
import { MARKET } from "@/components/p2p/types";
import { PAYMENT_METHODS } from "@/components/p2p/mock-orders";
import { SIDE_TONE } from "@/components/p2p/side";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat, formatPrice } from "@/lib/format";
import { publishAd } from "./ads-store";
import {
  competingPrice,
  MARGIN_BOUNDS,
  MARKET_PRICE,
  PRICE_BOUNDS,
  PRICE_STEP,
  priceFromMargin,
} from "./pricing";
import type { Ad, AdSide, PriceType } from "./types";

const STEPS = [
  "Type & price",
  "Amount & payment",
  "Terms & auto-reply",
] as const;

const WINDOW_OPTIONS = [10, 15, 20, 30];

interface AdForm {
  side: AdSide;
  priceType: PriceType;
  price: string;
  margin: string;
  totalAmount: string;
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  windowMinutes: number;
  terms: string;
  autoReply: string;
}

const INITIAL_FORM: AdForm = {
  side: "sell",
  priceType: "fixed",
  price: MARKET_PRICE.toFixed(3),
  margin: "0.0",
  totalAmount: "",
  minLimit: "",
  maxLimit: "",
  paymentMethods: [],
  windowMinutes: 15,
  terms: "",
  autoReply: "",
};

/* -- shared bits ---------------------------------------------------------- */

function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  tip,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
  tip?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 ps-1">
        <label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
        </label>
        {tip ? <InfoTip label={`About ${label}`}>{tip}</InfoTip> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="ps-1 text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="ps-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function StaticChip({ label, tone }: { label: string; tone: "asset" | "fiat" }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2.5">
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-full text-[10px] font-bold",
          tone === "asset"
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        $
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center",
              index < STEPS.length - 1 && "flex-1",
            )}
          >
            <span
              className="flex items-center gap-2.5"
              aria-current={active ? "step" : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary/15 text-primary ring-2 ring-primary/30",
                  !done && !active && "border border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm md:inline",
                  active ? "font-medium" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              <span className="sr-only">
                Step {index + 1}: {label}
                {done ? " — done" : ""}
              </span>
            </span>

            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-3 h-px flex-1",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* -- screen --------------------------------------------------------------- */

export function PostAdScreen() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<AdForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = React.useState(false);

  function set<K extends keyof AdForm>(key: K, value: AdForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const resolvedPrice =
    form.priceType === "fixed"
      ? Number(form.price) || 0
      : priceFromMargin(Number(form.margin) || 0);

  const competing = competingPrice(form.side);
  const totalAmount = Number(form.totalAmount) || 0;
  const minLimit = Number(form.minLimit) || 0;
  const maxLimit = Number(form.maxLimit) || 0;
  const inventoryValue = totalAmount * resolvedPrice;

  const priceError =
    resolvedPrice < PRICE_BOUNDS.min || resolvedPrice > PRICE_BOUNDS.max
      ? `Price must be between ${formatPrice(PRICE_BOUNDS.min)} and ${formatPrice(PRICE_BOUNDS.max)}.`
      : undefined;

  const amountError =
    form.totalAmount !== "" && totalAmount <= 0
      ? "Enter how much you're offering."
      : undefined;

  const limitError =
    form.maxLimit !== "" && maxLimit <= minLimit
      ? "The maximum must be above the minimum."
      : form.maxLimit !== "" && totalAmount > 0 && maxLimit > inventoryValue
        ? `Your ${formatAsset(totalAmount)} ${MARKET.asset} is only worth ${formatFiat(inventoryValue)}.`
        : undefined;

  const stepValid = [
    !priceError && resolvedPrice > 0,
    totalAmount > 0 &&
      minLimit > 0 &&
      maxLimit > minLimit &&
      !limitError &&
      form.paymentMethods.length > 0,
    true,
  ];

  function togglePayment(method: string) {
    set(
      "paymentMethods",
      form.paymentMethods.includes(method)
        ? form.paymentMethods.filter((m) => m !== method)
        : [...form.paymentMethods, method],
    );
  }

  /** Seam: the real publish writes the ad to the order book service. */
  async function handlePublish() {
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const draft: Omit<Ad, "id" | "createdAt"> = {
      side: form.side,
      priceType: form.priceType,
      price: Number(resolvedPrice.toFixed(3)),
      margin:
        form.priceType === "floating" ? Number(form.margin) || 0 : undefined,
      totalAmount,
      limits: { min: minLimit, max: maxLimit },
      windowMinutes: form.windowMinutes,
      paymentMethods: form.paymentMethods,
      terms: form.terms.trim() || "No special conditions.",
      autoReply: form.autoReply.trim() || undefined,
    };

    publishAd(draft);
    router.push("/p2p/orders");
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/p2p/orders"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-5")}
      >
        <ArrowLeft aria-hidden className="size-4" />
        Order book
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">Post an ad</h1>
      <p className="mt-1 mb-7 text-sm text-muted-foreground">
        Publish standing terms so counterparties can trade with you directly.
      </p>

      <Steps current={step} />

      <div className="mt-7 flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        {step === 0 ? (
          <>
            <TabBar
              tabs={["I want to buy", "I want to sell"]}
              activeIndex={form.side === "buy" ? 0 : 1}
              activeTone={SIDE_TONE[form.side].tab}
              onChange={(index) => set("side", index === 0 ? "buy" : "sell")}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Asset">
                <StaticChip label={MARKET.asset} tone="asset" />
              </Field>
              <Field
                label="With fiat"
                tip={
                  <>
                    This build runs a single {MARKET.asset}/{MARKET.fiat}{" "}
                    market, so both sides are fixed. Another currency would be a
                    separate market, not an option here.
                  </>
                }
              >
                <StaticChip label={MARKET.fiat} tone="fiat" />
              </Field>
            </div>

            <Field label="Price type">
              <div
                role="radiogroup"
                aria-label="Price type"
                className="flex flex-wrap gap-2"
              >
                {(["fixed", "floating"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={form.priceType === type}
                    onClick={() => set("priceType", type)}
                    className={cn(
                      "cursor-pointer rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden",
                      form.priceType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </Field>

            {form.priceType === "fixed" ? (
              <Field
                label="Fixed price"
                htmlFor="ad-price"
                error={priceError}
                hint={`Between ${formatPrice(PRICE_BOUNDS.min)} and ${formatPrice(PRICE_BOUNDS.max)} ${MARKET.fiat}.`}
              >
                <NumberField
                  id="ad-price"
                  value={form.price}
                  onChange={(value) => set("price", value)}
                  step={PRICE_STEP}
                  decimals={3}
                  min={PRICE_BOUNDS.min}
                  max={PRICE_BOUNDS.max}
                  suffix={MARKET.fiat}
                  invalid={Boolean(priceError)}
                  className="max-w-xs"
                />
              </Field>
            ) : (
              <Field
                label="Margin on market"
                htmlFor="ad-margin"
                error={priceError}
                hint={`Market is ${formatPrice(MARKET_PRICE)} ${MARKET.fiat}. Your price moves with it.`}
              >
                <NumberField
                  id="ad-margin"
                  value={form.margin}
                  onChange={(value) => set("margin", value)}
                  step={0.1}
                  decimals={1}
                  min={MARGIN_BOUNDS.min}
                  max={MARGIN_BOUNDS.max}
                  suffix="%"
                  invalid={Boolean(priceError)}
                  className="max-w-xs"
                />
              </Field>
            )}

            <div className="h-px bg-border" />

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Your price
                </span>
                <span
                  className={cn(
                    "text-3xl font-semibold tracking-tight tabular-nums",
                    SIDE_TONE[form.side].text,
                  )}
                >
                  {formatPrice(resolvedPrice)}
                </span>
              </div>

              {competing ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {competing.label}
                  </span>
                  <span className="text-3xl font-semibold tracking-tight tabular-nums text-muted-foreground">
                    {formatPrice(competing.value)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Price {competing.beat} this to lead the book.
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field
              label={`Total ${MARKET.asset}`}
              htmlFor="ad-total"
              error={amountError}
              hint={
                totalAmount > 0
                  ? `Worth ${formatFiat(inventoryValue)} at your price.`
                  : `How much ${MARKET.asset} this ad offers in total.`
              }
            >
              <NumberField
                id="ad-total"
                value={form.totalAmount}
                onChange={(value) => set("totalAmount", value)}
                step={100}
                decimals={2}
                min={0}
                suffix={MARKET.asset}
                placeholder="0.00"
                invalid={Boolean(amountError)}
                className="max-w-xs"
              />
            </Field>

            <Field
              label="Order limits"
              error={limitError}
              tip={
                <>
                  The smallest and largest single trade you&apos;ll accept, in{" "}
                  {MARKET.fiat}. Separate from your total — the total is
                  inventory, limits cap one trade.
                </>
              }
              hint={`Per-trade minimum and maximum, in ${MARKET.fiat}.`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <NumberField
                  aria-label={`Minimum order in ${MARKET.fiat}`}
                  value={form.minLimit}
                  onChange={(value) => set("minLimit", value)}
                  step={10}
                  decimals={0}
                  min={0}
                  suffix={MARKET.fiat}
                  placeholder="Min"
                  className="w-44"
                />
                <span aria-hidden className="text-muted-foreground">
                  –
                </span>
                <NumberField
                  aria-label={`Maximum order in ${MARKET.fiat}`}
                  value={form.maxLimit}
                  onChange={(value) => set("maxLimit", value)}
                  step={100}
                  decimals={0}
                  min={0}
                  suffix={MARKET.fiat}
                  placeholder="Max"
                  invalid={Boolean(limitError)}
                  className="w-44"
                />
              </div>
            </Field>

            <Field
              label="Payment methods"
              hint="Pick at least one. Counterparties filter the book by these."
            >
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const selected = form.paymentMethods.includes(method);
                  return (
                    <button
                      key={method}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => togglePayment(method)}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Payment window"
              hint="How long the counterparty has to pay before the trade can be cancelled."
            >
              <div
                role="radiogroup"
                aria-label="Payment window"
                className="flex flex-wrap gap-2"
              >
                {WINDOW_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    role="radio"
                    aria-checked={form.windowMinutes === minutes}
                    onClick={() => set("windowMinutes", minutes)}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden",
                      form.windowMinutes === minutes
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field
              label="Your terms"
              htmlFor="ad-terms"
              hint="Shown to anyone who opens your ad. Conditions you expect them to follow."
            >
              <textarea
                id="ad-terms"
                rows={4}
                value={form.terms}
                onChange={(event) => set("terms", event.target.value)}
                placeholder="e.g. Payment must come from an account in your own name."
                className="resize-none rounded-2xl bg-primary/5 px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              />
            </Field>

            <Field
              label="Auto-reply"
              htmlFor="ad-auto-reply"
              hint="Optional. Sent as your first chat message when someone opens a trade."
            >
              <textarea
                id="ad-auto-reply"
                rows={3}
                value={form.autoReply}
                onChange={(event) => set("autoReply", event.target.value)}
                placeholder="e.g. Hi! Send the transfer and drop the reference here."
                className="resize-none rounded-2xl bg-primary/5 px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              />
            </Field>

            <div className="h-px bg-border" />

            <div className="flex flex-col gap-2.5">
              <h2 className="text-base font-semibold">Review</h2>
              {[
                [
                  "Side",
                  `${SIDE_TONE[form.side].label} ${MARKET.asset} for ${MARKET.fiat}`,
                ],
                [
                  "Price",
                  `${formatPrice(resolvedPrice)} ${MARKET.fiat}${
                    form.priceType === "floating"
                      ? ` (${Number(form.margin) >= 0 ? "+" : ""}${form.margin}% on market)`
                      : ""
                  }`,
                ],
                ["Total", `${formatAsset(totalAmount)} ${MARKET.asset}`],
                [
                  "Order limits",
                  `${formatFiat(minLimit)} – ${formatFiat(maxLimit)}`,
                ],
                ["Payment", form.paymentMethods.join(", ") || "—"],
                ["Window", `${form.windowMinutes} min`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-end font-medium">{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="lg"
          disabled={step === 0}
          onClick={() => setStep((current) => current - 1)}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            size="lg"
            disabled={!stepValid[step]}
            onClick={() => setStep((current) => current + 1)}
          >
            Next
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            variant={SIDE_TONE[form.side].button}
            disabled={submitting || !stepValid[0] || !stepValid[1]}
            aria-busy={submitting}
            onClick={handlePublish}
          >
            {submitting ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Publishing…
              </>
            ) : (
              "Post ad"
            )}
          </Button>
        )}
      </div>
    </main>
  );
}
