"use client";

import * as React from "react";
import { createScopedStore } from "@/lib/scoped-store";

export interface TraderProfile {
  address: string;
  nickname: string;
  joinedAt: string;
}

async function loadProfile(): Promise<TraderProfile | null> {
  const response = await fetch("/api/traders/me", { cache: "no-store" });
  // 401 simply means signed out — not an error worth surfacing.
  return response.ok ? ((await response.json()) as TraderProfile) : null;
}

/**
 * The signed-in trader's record.
 *
 * Scoped to the session: switching accounts drops this immediately rather than
 * serving the previous trader's nickname under the new address.
 */
const store = createScopedStore<TraderProfile | null>(loadProfile, null);

export function useProfile() {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/** Convenience for the many places that only need the display name. */
export function useNickname() {
  return useProfile()?.nickname ?? null;
}

/**
 * Renames the signed-in trader. Resolves with an error message, or undefined
 * on success. The server decides — this does not write optimistically, because
 * a name that silently reverted would be worse than a moment of latency.
 */
export async function updateNickname(
  nickname: string,
): Promise<string | undefined> {
  try {
    const response = await fetch("/api/traders/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname }),
    });

    const data = (await response.json()) as TraderProfile & { error?: string };
    if (!response.ok) return data.error ?? "Could not save.";

    store.set(data);
    return undefined;
  } catch {
    return "Could not reach the server.";
  }
}


export const refreshProfile = store.invalidate;
