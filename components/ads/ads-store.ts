"use client";

import * as React from "react";
import type { Ad } from "./types";

const STORAGE_KEY = "safeswap:ads";

/**
 * Ads you've published, held on the client.
 *
 * Same shape as the open-orders store, and for the same reason: the list has
 * to outlive route changes, and `useSyncExternalStore` gives an empty server
 * snapshot with the real one after hydration.
 *
 * Seam: this is where a real persistence layer plugs in.
 */
const EMPTY: Ad[] = [];
let ads: Ad[] = EMPTY;
const listeners = new Set<() => void>();

function read(): Ad[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Ad[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next: Ad[]) {
  ads = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
  } catch {
    // Private mode or a full quota — the list won't survive a reload.
  }
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") ads = read();

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  ads = read();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * The store owns record identity — the caller describes the ad, this assigns
 * the id and timestamp. Keeps clock reads out of component bodies, where they
 * are impure.
 */
export function publishAd(draft: Omit<Ad, "id" | "createdAt">) {
  const createdAt = Date.now();
  const id = `ad-${createdAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  commit([{ ...draft, id, createdAt }, ...ads]);
}

export function removeAd(id: string) {
  commit(ads.filter((ad) => ad.id !== id));
}

export function useAds() {
  return React.useSyncExternalStore(
    subscribe,
    () => ads,
    () => EMPTY,
  );
}
