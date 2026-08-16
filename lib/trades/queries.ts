import "server-only";

import { randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { bookModeFor, type AdSide } from "@/components/ads/types";
import { roleFor, type TradeRole } from "@/components/trade/types";

/** Human-readable and unique enough; the id stays the real key. */
function newReference() {
  return `SS${String(randomInt(0, 10_000_000_000)).padStart(10, "0")}`;
}

export interface TradeParticipant {
  address: string;
  nickname: string;
}

export interface PaymentDetails {
  sinpePhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
}

export interface TradeRecord {
  id: string;
  reference: string;
  status: string;
  settlement: "manual" | "escrow";
  /** The viewer's side of the asset. */
  role: TradeRole;
  price: number;
  fiatAmount: number;
  assetAmount: number;
  paymentMethod: string;
  windowMinutes: number;
  terms: string;
  buyer: TradeParticipant;
  seller: TradeParticipant;
  /**
   * Where the buyer sends the fiat.
   *
   * Only the *seller's* details are ever disclosed, and only to the two people
   * in this trade. The seller needs nothing from the buyer but a wallet
   * address, which is already public — so the buyer's own details stay private.
   */
  sellerPaymentDetails: PaymentDetails;
  assetTxHash: string | null;
  createdAt: string;
  fiatSentAt: string | null;
  fiatConfirmedAt: string | null;
  assetSentAt: string | null;
  settledAt: string | null;
}

interface TradeRow {
  id: string;
  reference: string;
  status: string;
  settlement: "manual" | "escrow";
  maker: string;
  taker: string;
  price: string | number;
  fiat_amount: string | number;
  asset_amount: string | number;
  payment_method: string;
  window_minutes: number;
  asset_tx_hash: string | null;
  created_at: string;
  fiat_sent_at: string | null;
  fiat_confirmed_at: string | null;
  asset_sent_at: string | null;
  settled_at: string | null;
  ads: { side: AdSide; terms: string } | { side: AdSide; terms: string }[];
}

const one = <T>(value: T | T[]): T => (Array.isArray(value) ? value[0] : value);

/**
 * Loads a trade for one of its two participants.
 *
 * Returns null for anyone else — a trade is private to the two people in it,
 * and an id that is not yours is indistinguishable from one that does not
 * exist.
 */
export async function getTradeFor(
  id: string,
  viewer: string,
): Promise<TradeRecord | null> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("trades")
    .select("*, ads!inner(side, terms)")
    .eq("id", id)
    .or(`maker.eq.${viewer},taker.eq.${viewer}`)
    .maybeSingle();

  if (error) throw new Error(`Could not load the trade: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as TradeRow;
  const ad = one(row.ads);
  const isMaker = row.maker === viewer;
  const role = roleFor(ad.side, isMaker);

  // Whoever is not the viewer.
  const makerRole = roleFor(ad.side, true);
  const sellerAddress = makerRole === "seller" ? row.maker : row.taker;
  const buyerAddress = makerRole === "seller" ? row.taker : row.maker;

  const { data: people, error: peopleError } = await supabase
    .from("traders")
    .select("address, nickname, sinpe_phone, bank_name, bank_account")
    .in("address", [row.maker, row.taker]);

  if (peopleError) {
    throw new Error(`Could not load participants: ${peopleError.message}`);
  }

  type Person = {
    address: string;
    nickname: string;
    sinpe_phone: string | null;
    bank_name: string | null;
    bank_account: string | null;
  };
  const byAddress = new Map((people as Person[]).map((p) => [p.address, p]));
  const sellerRow = byAddress.get(sellerAddress);
  const buyerRow = byAddress.get(buyerAddress);

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    settlement: row.settlement,
    role,
    price: Number(row.price),
    fiatAmount: Number(row.fiat_amount),
    assetAmount: Number(row.asset_amount),
    paymentMethod: row.payment_method,
    windowMinutes: row.window_minutes,
    terms: ad.terms,
    buyer: {
      address: buyerAddress,
      nickname: buyerRow?.nickname ?? "Unknown",
    },
    seller: {
      address: sellerAddress,
      nickname: sellerRow?.nickname ?? "Unknown",
    },
    sellerPaymentDetails: {
      sinpePhone: sellerRow?.sinpe_phone ?? null,
      bankName: sellerRow?.bank_name ?? null,
      bankAccount: sellerRow?.bank_account ?? null,
    },
    assetTxHash: row.asset_tx_hash,
    createdAt: row.created_at,
    fiatSentAt: row.fiat_sent_at,
    fiatConfirmedAt: row.fiat_confirmed_at,
    assetSentAt: row.asset_sent_at,
    settledAt: row.settled_at,
  };
}

export type OpenTradeFailure =
  | "ad-not-found"
  | "own-ad"
  | "unsupported-method"
  | "below-minimum"
  | "above-maximum"
  | "insufficient";

export interface OpenTradeInput {
  adId: string;
  taker: string;
  /** As typed in the book, in whichever unit that side makes natural. */
  amount: number;
  paymentMethod: string;
}

/**
 * Opens a trade against an ad.
 *
 * Amounts are derived from the ad's own price, never taken from the caller —
 * a client that could name the price could name a favourable one.
 */
export async function openTrade(
  input: OpenTradeInput,
): Promise<{ id: string } | OpenTradeFailure> {
  const supabase = supabaseAdmin();

  const { data: ad, error } = await supabase
    .from("ads")
    .select("id, advertiser, side, price, min_limit, max_limit, payment_methods, status")
    .eq("id", input.adId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`Could not load the ad: ${error.message}`);
  if (!ad) return "ad-not-found";
  if (ad.advertiser === input.taker) return "own-ad";
  if (!(ad.payment_methods as string[]).includes(input.paymentMethod)) {
    return "unsupported-method";
  }

  // The taker types fiat when buying and USDC when selling.
  const price = Number(ad.price);
  const takerBuys = bookModeFor(ad.side as AdSide) === "buy";
  const fiatAmount = takerBuys ? input.amount : input.amount * price;
  const assetAmount = takerBuys ? input.amount / price : input.amount;

  if (fiatAmount < Number(ad.min_limit)) return "below-minimum";
  if (fiatAmount > Number(ad.max_limit)) return "above-maximum";

  const { data: id, error: rpcError } = await supabase.rpc("open_trade", {
    p_ad_id: input.adId,
    p_taker: input.taker,
    p_reference: newReference(),
    p_fiat_amount: Number(fiatAmount.toFixed(2)),
    p_asset_amount: Number(assetAmount.toFixed(7)),
    p_method: input.paymentMethod,
  });

  if (rpcError) throw new Error(rpcError.message);
  // The reservation refused: not enough unreserved inventory left.
  if (!id) return "insufficient";

  return { id: id as string };
}
