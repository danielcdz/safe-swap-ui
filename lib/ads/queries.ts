import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { isPaymentMethod } from "@/lib/payment-methods";
import { bookModeFor, type AdSide, type PriceType } from "@/components/ads/types";
import type { P2POrder } from "@/components/p2p/types";
import { avatarUrl } from "@/lib/avatar-url";

/** A row of `public.order_book` as PostgREST returns it. */
interface BookRow {
  id: string;
  advertiser: string;
  side: AdSide;
  price_type: PriceType;
  price: string | number;
  margin_percent: string | number | null;
  total_amount: string | number;
  min_limit: string | number;
  max_limit: string | number;
  window_minutes: number;
  payment_methods: string[];
  terms: string;
  nickname: string;
  verified: boolean;
  ops_count: number;
  completion_rate: string | number | null;
  positive_feedback: string | number | null;
  avatar_path: string | null;
}

type Advertiser = { nickname: string; avatar_path: string | null };

/** Postgres numerics arrive as strings to preserve precision. */
const num = (value: string | number) => Number(value);
const maybeNum = (value: string | number | null) =>
  value === null ? null : Number(value);

/**
 * Maps a book row to what the UI renders.
 *
 * `mode` is the side the *viewer* takes, so it inverts the advertiser's side —
 * the one place that conversion happens.
 */
function toOrder(row: BookRow): P2POrder {
  return {
    id: row.id,
    mode: bookModeFor(row.side),
    trader: {
      nickname: row.nickname,
      address: row.advertiser,
      verified: row.verified,
      avatarUrl: avatarUrl(row.advertiser, row.avatar_path),
      // No rating model yet: reviews are thumbs up/down, not stars.
      rating: null,
      opsCount: row.ops_count,
      completionRate: maybeNum(row.completion_rate),
    },
    price: num(row.price),
    available: num(row.total_amount),
    limits: { min: num(row.min_limit), max: num(row.max_limit) },
    windowMinutes: row.window_minutes,
    paymentMethods: row.payment_methods,
    terms: row.terms,
  };
}

export interface BookFilters {
  /** The side the viewer wants to take. */
  mode: "buy" | "sell";
  /** Exclude this trader's own ads — you cannot trade with yourself. */
  excludeAdvertiser?: string | null;
  paymentMethod?: string | null;
}

export async function listBook(filters: BookFilters): Promise<P2POrder[]> {
  // The viewer buying means the advertiser is selling.
  const side: AdSide = filters.mode === "buy" ? "sell" : "buy";

  let query = supabaseAdmin()
    .from("order_book")
    .select("*")
    .eq("side", side)
    // Best price depends on the side: cheapest to buy, highest to sell.
    .order("price", { ascending: filters.mode === "buy" });

  if (filters.excludeAdvertiser) {
    query = query.neq("advertiser", filters.excludeAdvertiser);
  }
  if (filters.paymentMethod && isPaymentMethod(filters.paymentMethod)) {
    query = query.contains("payment_methods", [filters.paymentMethod]);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load the order book: ${error.message}`);

  return (data as BookRow[]).map(toOrder);
}

export interface AdRecord {
  id: string;
  side: AdSide;
  priceType: PriceType;
  price: number;
  margin: number | null;
  totalAmount: number;
  limits: { min: number; max: number };
  windowMinutes: number;
  paymentMethods: string[];
  terms: string;
  autoReply: string | null;
  createdAt: string;
}

interface AdRow {
  id: string;
  side: AdSide;
  price_type: PriceType;
  price: string | number;
  margin_percent: string | number | null;
  total_amount: string | number;
  min_limit: string | number;
  max_limit: string | number;
  window_minutes: number;
  payment_methods: string[];
  terms: string;
  auto_reply: string | null;
  created_at: string;
}

function toAd(row: AdRow): AdRecord {
  return {
    id: row.id,
    side: row.side,
    priceType: row.price_type,
    price: num(row.price),
    margin: maybeNum(row.margin_percent),
    totalAmount: num(row.total_amount),
    limits: { min: num(row.min_limit), max: num(row.max_limit) },
    windowMinutes: row.window_minutes,
    paymentMethods: row.payment_methods,
    terms: row.terms,
    autoReply: row.auto_reply,
    createdAt: row.created_at,
  };
}

export async function listAdsFor(advertiser: string): Promise<AdRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("ads")
    .select("*")
    .eq("advertiser", advertiser)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load your ads: ${error.message}`);
  return (data as AdRow[]).map(toAd);
}

export interface AdDraft {
  side: AdSide;
  priceType: PriceType;
  price: number;
  margin: number | null;
  totalAmount: number;
  minLimit: number;
  maxLimit: number;
  windowMinutes: number;
  paymentMethods: string[];
  terms: string;
  autoReply: string | null;
}

export async function createAd(
  advertiser: string,
  draft: AdDraft,
): Promise<AdRecord> {
  const { data, error } = await supabaseAdmin()
    .from("ads")
    .insert({
      advertiser,
      side: draft.side,
      price_type: draft.priceType,
      price: draft.price,
      margin_percent: draft.priceType === "floating" ? draft.margin : null,
      total_amount: draft.totalAmount,
      min_limit: draft.minLimit,
      max_limit: draft.maxLimit,
      window_minutes: draft.windowMinutes,
      payment_methods: draft.paymentMethods,
      terms: draft.terms,
      auto_reply: draft.autoReply,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toAd(data as AdRow);
}

/**
 * Takes an ad down.
 *
 * Closed rather than deleted: `trades.ad_id` is `on delete restrict`, so an ad
 * with history cannot be removed, and a trade must keep pointing at the terms
 * it was opened under. The book only shows `active`, so a closed ad disappears
 * from it either way.
 *
 * Scoped to the advertiser, so it cannot take down someone else's ad.
 */
export async function closeAd(
  advertiser: string,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("ads")
    .update({ status: "closed" })
    .eq("id", id)
    .eq("advertiser", advertiser)
    .eq("status", "active")
    .select("id");

  if (error) throw new Error(`Could not take the ad down: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * One order by ad id, for the trade screen.
 *
 * Deliberately not filtered by status: a trade opened against an ad that has
 * since been taken down must still render. The book filters status; this does
 * not.
 */
export async function getOrderById(id: string): Promise<P2POrder | null> {
  const { data, error } = await supabaseAdmin()
    .from("ads")
    .select(
      "id, advertiser, side, price_type, price, margin_percent, total_amount," +
        " min_limit, max_limit, window_minutes, payment_methods, terms," +
        " traders!inner(nickname, avatar_path)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load the ad: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as AdRow & {
    advertiser: string;
    traders: Advertiser | Advertiser[];
  };
  const trader = Array.isArray(row.traders) ? row.traders[0] : row.traders;

  return toOrder({
    ...row,
    nickname: trader?.nickname ?? "Unknown",
    avatar_path: trader?.avatar_path ?? null,
    // The trust block belongs to the book. A trade screen already shows the
    // counterparty's record in its own right.
    verified: false,
    ops_count: 0,
    completion_rate: null,
    positive_feedback: null,
  } as BookRow);
}
