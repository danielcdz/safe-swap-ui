import type { OrderMode } from "./types";

/**
 * Buy is green, sell is red — the exchange convention.
 *
 * One map for every surface that states which side of a trade you're on, so
 * the two sides can't drift apart across screens. Note this is about the
 * *side*, not about danger: destructive actions keep the tinted `danger`
 * button, and workflow actions inside a trade stay `primary` so red never
 * means two different things in the same view.
 */
export const SIDE_TONE = {
  buy: {
    label: "Buy",
    /** Solid button variant for the side's call to action. */
    button: "primary",
    /** Selected-tab tone for a buy/sell switch. */
    tab: "primary",
    /** Small badge stating the side. */
    pill: "bg-primary/10 text-primary",
    /** Text-only label, e.g. a card eyebrow. */
    text: "text-primary",
  },
  sell: {
    label: "Sell",
    button: "sell",
    tab: "destructive",
    pill: "bg-destructive/10 text-destructive",
    text: "text-destructive",
  },
} as const satisfies Record<
  OrderMode,
  {
    label: string;
    button: "primary" | "sell";
    tab: "primary" | "destructive";
    pill: string;
    text: string;
  }
>;
