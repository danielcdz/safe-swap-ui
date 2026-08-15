import type { OrderMode } from "@/components/p2p/types";

/** What the advertiser wants to do. */
export type AdSide = OrderMode;

export type PriceType = "fixed" | "floating";

export interface Ad {
  id: string;
  side: AdSide;
  priceType: PriceType;
  /** Resolved USD per USDC — for a floating ad this is market × (1 + margin). */
  price: number;
  /** Percent above or below market, only when `priceType` is floating. */
  margin?: number;
  /** USDC put on offer. */
  totalAmount: number;
  /** Order size accepted, in USD. */
  limits: { min: number; max: number };
  windowMinutes: number;
  paymentMethods: string[];
  terms: string;
  /** Sent as the opening chat message when someone takes the ad. */
  autoReply?: string;
  createdAt: number;
}

/**
 * An ad's side and the side it presents in the book are opposites.
 *
 * `P2POrder.mode` is *the side the viewer takes*, so an "I want to sell" ad is
 * what a viewer buys from — it lists under Buy. Getting this backwards puts
 * every ad on the wrong tab, so route through here rather than passing the
 * side along untranslated.
 */
export function bookModeFor(side: AdSide): OrderMode {
  return side === "sell" ? "buy" : "sell";
}
