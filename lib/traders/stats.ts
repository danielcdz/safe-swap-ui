import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * A trader's record, computed from their trades on read by `trader_stats`.
 *
 * Counts and volumes are always numbers — nought is a true answer to "how many
 * trades have you settled". The three rates are nullable on purpose: a trader
 * with nothing closed has *no* completion rate, which is a different fact from
 * a completion rate of nought, and how to say so is the caller's decision.
 */
export interface TraderStats {
  totalTrades: number;
  completionRate: number | null;
  avgReleaseMinutes: number | null;
  positiveFeedback: number | null;
  volume30d: number;
  volumeAllTime: number;
  reviewCount: number;
}

/** A trader who has never traded. */
export const NO_STATS: TraderStats = {
  totalTrades: 0,
  completionRate: null,
  avgReleaseMinutes: null,
  positiveFeedback: null,
  volume30d: 0,
  volumeAllTime: 0,
  reviewCount: 0,
};

const COLUMNS =
  "total_trades, completion_rate, avg_release_minutes, positive_feedback, volume_30d, volume_all_time, review_count";

// Postgres `numeric` can arrive as either a JSON number or a string depending
// on the column, so neither is assumed.
const count = (value: unknown): number => {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const rate = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function getTraderStats(address: string): Promise<TraderStats> {
  const { data, error } = await supabaseAdmin()
    .from("trader_stats")
    .select(COLUMNS)
    .eq("address", address)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the trading record: ${error.message}`);
  }
  // The view has a row per trader, so this means no trader — an empty record
  // is the honest answer rather than a failure.
  if (!data) return NO_STATS;

  const row = data as Record<string, unknown>;
  return {
    totalTrades: count(row.total_trades),
    completionRate: rate(row.completion_rate),
    avgReleaseMinutes: rate(row.avg_release_minutes),
    positiveFeedback: rate(row.positive_feedback),
    volume30d: count(row.volume_30d),
    volumeAllTime: count(row.volume_all_time),
    reviewCount: count(row.review_count),
  };
}
