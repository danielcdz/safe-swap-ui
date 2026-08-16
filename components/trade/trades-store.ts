"use client";

import * as React from "react";
import { createScopedStore } from "@/lib/scoped-store";
import type { TradeRole } from "./types";

export interface TradeSummary {
  id: string;
  reference: string;
  status: string;
  settlement: "manual" | "escrow";
  role: TradeRole;
  counterparty: { address: string; nickname: string };
  price: number;
  fiatAmount: number;
  assetAmount: number;
  paymentMethod: string;
  createdAt: string;
}

const EMPTY: TradeSummary[] = [];

async function loadTrades(): Promise<TradeSummary[]> {
  const response = await fetch("/api/trades", { cache: "no-store" });
  // 401 simply means signed out.
  return response.ok
    ? ((await response.json()) as { trades: TradeSummary[] }).trades
    : EMPTY;
}

/**
 * Your trades, from the database.
 *
 * Replaces the localStorage open-orders store. A trade has two sides, so it
 * was never the client's to own: the other party advancing it has to show up
 * here, and a record confined to one browser could not do that.
 *
 * Scoped to the session, so switching wallets does not show one trader's
 * trades to another.
 */
const store = createScopedStore<TradeSummary[]>(loadTrades, EMPTY);

export function useTrades() {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/** Refetch after opening, cancelling, or advancing a trade. */
export const invalidateTrades = store.invalidate;
