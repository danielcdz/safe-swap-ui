import type { OrderMode } from "@/components/p2p/types";

/**
 * `cancelled` extends the spec's four-state vocabulary — an order dropped
 * before the fiat leg never reaches any of the others, and the escrow refunds
 * rather than releasing.
 */
export type EscrowStatus =
  | "pending"
  | "funded"
  | "disputed"
  | "released"
  | "cancelled";
export type EscrowStepStatus = "completed" | "current" | "pending" | "disputed";

/**
 * The escrow lifecycle, as the spec fixes it: deploy → fund → approve →
 * release, with dispute branching off. `stage` is the index of the first step
 * still outstanding.
 */
export const ESCROW_STEPS = [
  {
    label: "Escrow deployed",
    description: "Contract created on Stellar.",
  },
  {
    label: "USDC locked",
    description: "The seller's USDC is held by the contract.",
  },
  {
    label: "Payment sent",
    description: "The buyer transfers the fiat amount off-chain.",
  },
  {
    label: "USDC released",
    description: "Escrow pays out once the seller confirms.",
  },
] as const;

export interface TradeMessage {
  id: string;
  author: "self" | "counterparty" | "system";
  text: string;
  /** Epoch ms, resolved once when the message is created — never at render. */
  timestamp: number;
  delivery?: "sent" | "delivered" | "read";
}

export interface Trade {
  /** The order this trade came from — also the open-orders key. */
  orderId: string;
  reference: string;
  mode: OrderMode;
  /** Fiat leg, USD. */
  fiatAmount: number;
  /** Asset leg, USDC. */
  assetAmount: number;
  price: number;
  paymentMethod: string;
  windowMinutes: number;
  counterparty: {
    nickname: string;
    address: string;
    verified: boolean;
    opsCount: number;
  };
}

/** Stable per-order reference — no clock, so it survives hydration. */
export function tradeReference(orderId: string) {
  let hash = 0;
  for (let i = 0; i < orderId.length; i += 1) {
    hash = (hash * 31 + orderId.charCodeAt(i)) % 10_000_000_000;
  }
  return `SS${String(hash).padStart(10, "0")}`;
}
