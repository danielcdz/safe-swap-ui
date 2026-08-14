/** The side the viewer takes. A "buy" offer lets the viewer buy USDC. */
export type OrderMode = "buy" | "sell";

export interface OrderTrader {
  /** Pseudonymous handle. Traders are wallets, not people — no real names. */
  nickname: string;
  /** Stellar public key. Shown truncated and mono, copyable. */
  address: string;
  verified: boolean;
  rating: number;
  opsCount: number;
  /** Share of this trader's orders that completed, 0–100. */
  completionRate: number;
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
}

/** MVP scope: a single market. The asset chip states it rather than
 *  offering a selector. */
export const MARKET = { asset: "USDC", fiat: "USD" } as const;
