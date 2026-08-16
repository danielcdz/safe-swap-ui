import { bookModeFor, type AdSide } from "./types";
import type { P2POrder } from "@/components/p2p/types";

/**
 * Mid-market for USDC/USD.
 *
 * A constant, not something derived from the book. USDC is a stablecoin
 * pegged to the dollar, so parity is the reference regardless of how many ads
 * happen to exist — and an empty book would otherwise produce NaN. A real
 * build reads this from a price index.
 */
export const MARKET_PRICE = 1.0;

/** How far from mid-market an ad may be priced. */
export const PRICE_BOUNDS = {
  min: Number((MARKET_PRICE * 0.95).toFixed(3)),
  max: Number((MARKET_PRICE * 1.05).toFixed(3)),
};

export const MARGIN_BOUNDS = { min: -5, max: 5 };

/** Smallest meaningful move for a near-parity asset quoted to 3 decimals. */
export const PRICE_STEP = 0.001;

export function priceFromMargin(margin: number) {
  return MARKET_PRICE * (1 + margin / 100);
}

export interface CompetingPrice {
  label: string;
  value: number;
  beat: "below" | "above";
}

/**
 * The price this ad is bidding against, given the live book.
 *
 * Selling competes with other sellers, and buyers take the cheapest — so the
 * benchmark is the lowest ask, and undercutting it wins. Buying is the mirror.
 * Returns null when nothing is listed on that side.
 */
export function competingPrice(
  side: AdSide,
  book: P2POrder[],
): CompetingPrice | null {
  const mode = bookModeFor(side);
  const prices = book.filter((o) => o.mode === mode).map((o) => o.price);
  if (prices.length === 0) return null;

  return side === "sell"
    ? { label: "Lowest competing price", value: Math.min(...prices), beat: "below" }
    : { label: "Highest competing price", value: Math.max(...prices), beat: "above" };
}
