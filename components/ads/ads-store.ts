"use client";

import * as React from "react";
import { createScopedStore } from "@/lib/scoped-store";
import type { AdSide, PriceType } from "./types";

export interface Ad {
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

const EMPTY: Ad[] = [];

async function loadAds(): Promise<Ad[]> {
  const response = await fetch("/api/ads/mine", { cache: "no-store" });
  // 401 simply means signed out.
  return response.ok ? ((await response.json()) as { ads: Ad[] }).ads : EMPTY;
}

/**
 * Ads you have published.
 *
 * Scoped to the session, so switching accounts does not show one trader's ads
 * to another.
 */
const store = createScopedStore<Ad[]>(loadAds, EMPTY);

export function useAds() {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

export const invalidateAds = store.invalidate;

/** Takes an ad down. Resolves with an error message, or undefined on success. */
export async function removeAd(id: string): Promise<string | undefined> {
  try {
    const response = await fetch(`/api/ads/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      return body.error ?? "Could not take the ad down.";
    }
    store.set(store.getSnapshot().filter((ad) => ad.id !== id));
    return undefined;
  } catch {
    return "Could not reach the server.";
  }
}
