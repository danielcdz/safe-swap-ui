"use client";

import * as React from "react";
import type { AdSide, PriceType } from "./types";

/**
 * Ads you have published, served by the API.
 *
 * Replaced a localStorage store: an ad is an offer other traders act on, so it
 * belongs to the database, not to one browser.
 */
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
let ads: Ad[] = EMPTY;
let status: "idle" | "loading" | "ready" = "idle";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function load() {
  status = "loading";
  try {
    const response = await fetch("/api/ads/mine", { cache: "no-store" });
    // 401 simply means signed out.
    ads = response.ok ? ((await response.json()) as { ads: Ad[] }).ads : EMPTY;
  } catch {
    ads = EMPTY;
  } finally {
    status = "ready";
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (status === "idle") void load();
  return () => {
    listeners.delete(listener);
  };
}

export function useAds() {
  return React.useSyncExternalStore(
    subscribe,
    () => ads,
    () => EMPTY,
  );
}

/** Re-fetch on the next read, e.g. after publishing. */
export function invalidateAds() {
  status = "idle";
  void load();
}

/** Takes an ad down. Resolves with an error message, or undefined on success. */
export async function removeAd(id: string): Promise<string | undefined> {
  try {
    const response = await fetch(`/api/ads/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      return body.error ?? "Could not take the ad down.";
    }
    ads = ads.filter((ad) => ad.id !== id);
    emit();
    return undefined;
  } catch {
    return "Could not reach the server.";
  }
}
