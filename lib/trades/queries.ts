import "server-only";

import { randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { avatarUrl } from "@/lib/avatar-url";
import { postSystemMessage } from "./messages";
import { bookModeFor, type AdSide } from "@/components/ads/types";
import {
  MANUAL_STEPS,
  roleFor,
  stageOf,
  type TradeRole,
} from "@/components/trade/types";

/** Human-readable and unique enough; the id stays the real key. */
function newReference() {
  return `SS${String(randomInt(0, 10_000_000_000)).padStart(10, "0")}`;
}

export interface TradeParticipant {
  address: string;
  nickname: string;
  /** Null when they have not set a picture; the badge falls back. */
  avatarUrl: string | null;
}

export interface TradeRecord {
  id: string;
  reference: string;
  /** The address this record was loaded for — which bubble is "mine". */
  viewer: string;
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
   * Note: there is no payment-detail field, by design. Where the fiat goes is
   * agreed in the trade chat between the two people who need to know, so the
   * app never stores a phone number or an account number at all.
   */
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
    .select("address, nickname, avatar_path")
    .in("address", [row.maker, row.taker]);

  if (peopleError) {
    throw new Error(`Could not load participants: ${peopleError.message}`);
  }

  type Person = {
    address: string;
    nickname: string;
    avatar_path: string | null;
  };
  const byAddress = new Map((people as Person[]).map((p) => [p.address, p]));
  const sellerRow = byAddress.get(sellerAddress);
  const buyerRow = byAddress.get(buyerAddress);

  return {
    id: row.id,
    reference: row.reference,
    viewer,
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
      avatarUrl: avatarUrl(buyerAddress, buyerRow?.avatar_path ?? null),
    },
    seller: {
      address: sellerAddress,
      nickname: sellerRow?.nickname ?? "Unknown",
      avatarUrl: avatarUrl(sellerAddress, sellerRow?.avatar_path ?? null),
    },
    assetTxHash: row.asset_tx_hash,
    createdAt: row.created_at,
    fiatSentAt: row.fiat_sent_at,
    fiatConfirmedAt: row.fiat_confirmed_at,
    assetSentAt: row.asset_sent_at,
    settledAt: row.settled_at,
  };
}

/* -- listing --------------------------------------------------------------- */

export interface TradeSummary {
  id: string;
  reference: string;
  status: string;
  settlement: "manual" | "escrow";
  /** The viewer's side of the asset — what the row is labelled Buy or Sell by. */
  role: TradeRole;
  counterparty: TradeParticipant;
  price: number;
  fiatAmount: number;
  assetAmount: number;
  paymentMethod: string;
  createdAt: string;
}

/**
 * Every trade the viewer is in, newest first.
 *
 * Both sides of a trade see the same row from their own perspective — the
 * role, and therefore the Buy/Sell label, inverts between them.
 */
export async function listTradesFor(viewer: string): Promise<TradeSummary[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("trades")
    .select(
      "id, reference, status, settlement, maker, taker, price, fiat_amount," +
        " asset_amount, payment_method, created_at, ads!inner(side)",
    )
    .or(`maker.eq.${viewer},taker.eq.${viewer}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load trades: ${error.message}`);
  if (!data?.length) return [];

  type Row = Omit<TradeRow, "ads"> & { ads: { side: AdSide } | { side: AdSide }[] };
  const rows = data as unknown as Row[];

  // One lookup for every counterparty rather than one per row.
  const others = rows.map((row) => (row.maker === viewer ? row.taker : row.maker));
  const { data: people, error: peopleError } = await supabase
    .from("traders")
    .select("address, nickname, avatar_path")
    .in("address", [...new Set(others)]);

  if (peopleError) {
    throw new Error(`Could not load participants: ${peopleError.message}`);
  }

  const counterparties = new Map(
    (
      people as {
        address: string;
        nickname: string;
        avatar_path: string | null;
      }[]
    ).map((p) => [p.address, p]),
  );

  return rows.map((row) => {
    const isMaker = row.maker === viewer;
    const other = isMaker ? row.taker : row.maker;
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      settlement: row.settlement,
      role: roleFor(one(row.ads).side, isMaker),
      counterparty: {
        address: other,
        nickname: counterparties.get(other)?.nickname ?? "Unknown",
        avatarUrl: avatarUrl(other, counterparties.get(other)?.avatar_path ?? null),
      },
      price: Number(row.price),
      fiatAmount: Number(row.fiat_amount),
      assetAmount: Number(row.asset_amount),
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
    };
  });
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

  // The chat is the only place payment details exist, so say so up front
  // rather than leaving the buyer to work out why nothing is displayed.
  await postSystemMessage(
    id as string,
    "Trade opened. Agree the payment details here — SafeSwap does not store them.",
  );

  return { id: id as string };
}

/* -- advancing ------------------------------------------------------------ */

export type AdvanceFailure =
  | "not-found"
  | "stale"
  | "not-your-turn"
  | "not-cancellable"
  | "not-disputable"
  | "terminal";

export type TradeAction = "next" | "cancel" | "dispute";

/** Which timestamp column a status transition stamps. */
const STAMP: Record<string, string> = {
  fiat_sent: "fiat_sent_at",
  fiat_confirmed: "fiat_confirmed_at",
  asset_sent: "asset_sent_at",
};

const TERMINAL = new Set(["completed", "cancelled", "released"]);

/** What each transition says in the conversation. */
const SYSTEM_NOTE: Record<string, string> = {
  fiat_sent: "Buyer marked the payment as sent",
  fiat_confirmed: "Seller confirmed the payment arrived",
  asset_sent: "Seller sent the USDC",
  completed: "Buyer confirmed the USDC arrived — trade complete",
  cancelled: "Trade cancelled",
  disputed: "Dispute raised",
};

/**
 * Moves a trade one step.
 *
 * `from` is the status the caller believes the trade is in. The update matches
 * on it, so a double submit — or two tabs racing — advances exactly once; the
 * loser gets `stale` rather than skipping a step.
 */
export async function advanceTrade(input: {
  id: string;
  viewer: string;
  from: string;
  action: TradeAction;
  txHash?: string | null;
}): Promise<{ status: string } | AdvanceFailure> {
  const supabase = supabaseAdmin();

  const trade = await getTradeFor(input.id, input.viewer);
  if (!trade) return "not-found";
  if (trade.status !== input.from) return "stale";
  if (TERMINAL.has(trade.status)) return "terminal";

  let next: string;
  const patch: Record<string, unknown> = {};

  if (input.action === "cancel") {
    // Only honest before anything has moved — the same rule the escrow flow
    // uses. Past `open`, the way out is a dispute.
    if (trade.status !== "open") return "not-cancellable";
    next = "cancelled";
    patch.settled_at = new Date().toISOString();
  } else if (input.action === "dispute") {
    if (trade.status === "open") return "not-disputable";
    next = "disputed";
  } else {
    const stage = stageOf(trade.status);
    const step = MANUAL_STEPS[stage];
    if (!step) return "terminal";

    // The actor for this step is fixed: only the buyer can claim they paid,
    // only the seller can confirm it arrived.
    if (step.actor !== trade.role) return "not-your-turn";

    next = MANUAL_STEPS[stage + 1]?.status ?? "completed";
    if (STAMP[next]) patch[STAMP[next]] = new Date().toISOString();
    if (next === "completed") patch.settled_at = new Date().toISOString();
    if (input.txHash) patch.asset_tx_hash = input.txHash;
  }

  const { data, error } = await supabase
    .from("trades")
    .update({ status: next, ...patch })
    .eq("id", input.id)
    .eq("status", input.from)
    .select("status");

  if (error) throw new Error(`Could not advance the trade: ${error.message}`);
  if (!data?.length) return "stale";

  await postSystemMessage(input.id, SYSTEM_NOTE[next] ?? `Trade moved to ${next}`);

  // Cancelling frees the inventory the trade was holding.
  if (next === "cancelled") {
    const { error: releaseError } = await supabase.rpc(
      "release_trade_reservation",
      { p_trade_id: input.id },
    );
    if (releaseError) {
      console.error("reservation not released", releaseError);
    }
  }

  return { status: next };
}
