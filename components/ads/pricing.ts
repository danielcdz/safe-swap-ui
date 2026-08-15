import { MOCK_ORDERS } from "@/components/p2p/mock-orders";
import { bookModeFor, type AdSide } from "./types";

/**
 * Mid-market, taken from the two best prices currently in the book. A real
 * build reads this from an index; the fixtures put it at parity.
 */
export const MARKET_PRICE = (() => {
  const asks = MOCK_ORDERS.filter((o) => o.mode === "buy").map((o) => o.price);
  const bids = MOCK_ORDERS.filter((o) => o.mode === "sell").map((o) => o.price);
  return (Math.min(...asks) + Math.max(...bids)) / 2;
})();

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

/**
 * The price this ad is bidding against, and which direction wins.
 *
 * Selling competes with other sellers, and buyers take the cheapest — so the
 * benchmark is the lowest ask, and undercutting it wins. Buying is the mirror.
 */
export function competingPrice(side: AdSide) {
  const mode = bookModeFor(side);
  const prices = MOCK_ORDERS.filter((o) => o.mode === mode).map((o) => o.price);
  if (prices.length === 0) return null;

  return side === "sell"
    ? { label: "Lowest competing price", value: Math.min(...prices), beat: "below" as const }
    : { label: "Highest competing price", value: Math.max(...prices), beat: "above" as const };
}
