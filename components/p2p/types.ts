/** The side the viewer takes. A "buy" offer lets the viewer buy USDC. */
export type OrderMode = "buy" | "sell";

export interface OrderTrader {
  /** Pseudonymous handle. Traders are wallets, not people — no real names. */
  nickname: string;
  /** Stellar public key. Shown truncated and mono, copyable. */
  address: string;
  verified: boolean;
  /**
   * Null until there is a rating model. Reviews are thumbs up/down, not
   * stars, so there is nothing honest to put here yet — and a fabricated
   * number in the trust block is worse than an absent one.
   */
  rating: number | null;
  opsCount: number;
  /** Share of orders that completed, 0–100. Null before any have settled. */
  completionRate: number | null;
}

export interface OrderLimits {
  min: number;
  max: number;
}

export interface P2POrder {
  id: string;
  mode: OrderMode;
  trader: OrderTrader;
  /** USD per USDC — trades within a cent of parity. */
  price: number;
  /** USDC the trader still has on offer. */
  available: number;
  /** Order size the trader accepts, in USD. */
  limits: OrderLimits;
  /** Payment window, minutes. */
  windowMinutes: number;
  paymentMethods: string[];
  /** Free text the trader sets — conditions they expect you to follow. */
  terms: string;
}

/** MVP scope: a single market. The asset chip states it rather than
 *  offering a selector. */
export const MARKET = { asset: "USDC", fiat: "USD" } as const;
