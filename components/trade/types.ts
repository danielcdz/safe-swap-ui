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
  /**
   * An attached image, served through our own route rather than a storage URL.
   * `text` is its caption when there is one, and is otherwise empty. The
   * dimensions are the stored ones, so the bubble can hold its space before
   * the image arrives.
   */
  image?: { url: string; width: number; height: number };
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

/* -- who is on which side ------------------------------------------------- */

export type TradeRole = "buyer" | "seller";

/**
 * Which side of the asset a participant is on.
 *
 * `maker`/`taker` says who advertised, not who buys. An ad to **sell** USDC
 * means the advertiser is the seller and whoever takes it is the buyer; an ad
 * to **buy** is the mirror.
 *
 * This is the second inversion in the codebase, after `bookModeFor`, and it
 * decides who is shown which action at every step of a trade. It lives here
 * alone — getting it backwards would tell the wrong person to send money.
 */
export function roleFor(adSide: "buy" | "sell", isMaker: boolean): TradeRole {
  const makerRole: TradeRole = adSide === "sell" ? "seller" : "buyer";
  if (isMaker) return makerRole;
  return makerRole === "seller" ? "buyer" : "seller";
}

/** The states a manual trade moves through, in order. */
export const MANUAL_STEPS = [
  {
    status: "open",
    label: "Trade opened",
    description: "Terms agreed. Nothing has moved yet.",
    actor: "buyer" as TradeRole,
    action: "I've sent the payment",
  },
  {
    status: "fiat_sent",
    label: "Payment sent",
    description: "The buyer says the transfer is on its way.",
    actor: "seller" as TradeRole,
    action: "Confirm payment received",
  },
  {
    status: "fiat_confirmed",
    label: "Payment confirmed",
    description: "The seller has the money and now sends the USDC.",
    actor: "seller" as TradeRole,
    action: "I've sent the USDC",
  },
  {
    status: "asset_sent",
    label: "USDC sent",
    description: "Verify it arrived in your wallet, then confirm.",
    actor: "buyer" as TradeRole,
    action: "Confirm USDC received",
  },
] as const;

export type ManualStatus =
  | "open"
  | "fiat_sent"
  | "fiat_confirmed"
  | "asset_sent"
  | "completed";

/** Every state a stored trade can be in, including the two exits. */
export type TradeStatus = ManualStatus | "cancelled" | "disputed";

/**
 * Whether a trade still needs someone to do something.
 *
 * `disputed` counts as in flight: it is stalled, not finished, and it is the
 * one state a trader most needs to see near the top of their list.
 */
export function isInFlight(status: string) {
  return status !== "completed" && status !== "cancelled";
}

/** The step index a status corresponds to; `completed` is past the last one. */
export function stageOf(status: string) {
  const index = MANUAL_STEPS.findIndex((step) => step.status === status);
  return index === -1 ? MANUAL_STEPS.length : index;
}
