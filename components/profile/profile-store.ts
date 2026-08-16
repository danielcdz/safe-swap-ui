"use client";

import * as React from "react";

export interface TraderProfile {
  address: string;
  nickname: string;
  joinedAt: string;
}

/**
 * The signed-in trader's record, served from the API.
 *
 * An external store rather than component state so the wallet menu and the
 * profile screen read one value and a rename updates both at once. It replaced
 * a localStorage-backed store: a nickname other traders will see belongs to
 * the database, not to this browser.
 */
let profile: TraderProfile | null = null;
let status: "idle" | "loading" | "ready" = "idle";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function load() {
  status = "loading";
  try {
    const response = await fetch("/api/traders/me", { cache: "no-store" });
    // 401 simply means signed out — not an error worth surfacing.
    profile = response.ok ? ((await response.json()) as TraderProfile) : null;
  } catch {
    profile = null;
  } finally {
    status = "ready";
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // First subscriber pulls; later ones reuse what is already here.
  if (status === "idle") void load();
  return () => {
    listeners.delete(listener);
  };
}

export function useProfile() {
  return React.useSyncExternalStore(
    subscribe,
    () => profile,
    () => null,
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
export async function updateNickname(nickname: string): Promise<string | undefined> {
  try {
    const response = await fetch("/api/traders/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname }),
    });

    const data = (await response.json()) as TraderProfile & { error?: string };
    if (!response.ok) return data.error ?? "Could not save.";

    profile = data;
    emit();
    return undefined;
  } catch {
    return "Could not reach the server.";
  }
}

/** Called after sign-in or sign-out so the next read refetches. */
export function refreshProfile() {
  status = "idle";
  profile = null;
  emit();
}
