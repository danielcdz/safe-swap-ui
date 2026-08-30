"use client";

import * as React from "react";
import { createScopedStore } from "@/lib/scoped-store";

/** Mirrors `TraderStats` in lib/traders/stats.ts, which is server-only. */
export interface TraderStats {
  totalTrades: number;
  /** Null when nothing has closed yet — not the same as nought percent. */
  completionRate: number | null;
  avgReleaseMinutes: number | null;
  positiveFeedback: number | null;
  volume30d: number;
  volumeAllTime: number;
  reviewCount: number;
}

/** What a trader who has never traded has, and the server snapshot. */
export const NO_STATS: TraderStats = {
  totalTrades: 0,
  completionRate: null,
  avgReleaseMinutes: null,
  positiveFeedback: null,
  volume30d: 0,
  volumeAllTime: 0,
  reviewCount: 0,
};

async function loadStats(): Promise<TraderStats> {
  const response = await fetch("/api/traders/me/stats", { cache: "no-store" });
  // 401 simply means signed out — not an error worth surfacing.
  if (!response.ok) return NO_STATS;
  const data = (await response.json()) as { stats: TraderStats };
  return data.stats;
}

/**
 * The signed-in trader's record.
 *
 * Scoped to the session for the same reason the profile is: a record left over
 * from the previous wallet would render one trader's history under another's
 * address.
 */
const store = createScopedStore<TraderStats>(loadStats, NO_STATS);

export function useTraderStats() {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/** Force a re-read, e.g. once a trade settles. */
export const refreshTraderStats = store.invalidate;
