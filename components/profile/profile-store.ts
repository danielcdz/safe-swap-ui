"use client";

import * as React from "react";
import { cropSquare } from "@/lib/image/downscale";
import { createScopedStore } from "@/lib/scoped-store";

export interface TraderProfile {
  address: string;
  nickname: string;
  joinedAt: string;
  /** Null when they have not set a picture; the badge falls back. */
  avatarUrl: string | null;
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


/**
 * Sets the trader's picture.
 *
 * The image is cropped square and re-encoded in the browser first, which also
 * strips EXIF — a profile photo is exactly the kind of file that arrives with
 * the coordinates of someone's home in it.
 */
export async function updateAvatar(file: File): Promise<string | undefined> {
  try {
    const { blob } = await cropSquare(file);

    const form = new FormData();
    // No content-type header: the browser sets the multipart boundary.
    form.append("file", blob, "avatar");

    const response = await fetch("/api/traders/me/avatar", {
      method: "POST",
      body: form,
    });

    const data = (await response.json()) as TraderProfile & { error?: string };
    if (!response.ok) return data.error ?? "Could not save.";

    store.set(data);
    return undefined;
  } catch (cause) {
    // cropSquare explains itself when a file cannot be decoded.
    return cause instanceof Error ? cause.message : "Could not reach the server.";
  }
}

/** Drops it, back to the address-derived badge. */
export async function removeAvatar(): Promise<string | undefined> {
  try {
    const response = await fetch("/api/traders/me/avatar", { method: "DELETE" });
    const data = (await response.json()) as TraderProfile & { error?: string };
    if (!response.ok) return data.error ?? "Could not remove.";

    store.set(data);
    return undefined;
  } catch {
    return "Could not reach the server.";
  }
}

export const refreshProfile = store.invalidate;
