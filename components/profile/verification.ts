"use client";

import * as React from "react";
import { createScopedStore } from "@/lib/scoped-store";

export type VerificationStatus = "unverified" | "pending" | "verified";
export type MethodId = "wallet" | "email" | "phone" | "id";

export interface VerificationMethod {
  id: MethodId;
  label: string;
  description: string;
  /** Only this step earns the public Verified mark. */
  grantsBadge?: boolean;
  /** Whether a trader can ask for it themselves. */
  requestable?: boolean;
}

export const VERIFICATION_METHODS: VerificationMethod[] = [
  {
    id: "wallet",
    label: "Wallet ownership",
    description: "Proven when you signed in with your Stellar wallet.",
  },
  {
    id: "email",
    label: "Email address",
    description: "Where trade and dispute notifications go.",
    requestable: true,
  },
  {
    id: "phone",
    label: "Phone number",
    description: "SMS alerts while a trade is live.",
    requestable: true,
  },
  {
    id: "id",
    label: "Government ID",
    description: "Raises your order limits and earns the Verified mark.",
    grantsBadge: true,
    requestable: true,
  },
];

/** Nothing is verified until the server says so. */
const NONE: Record<MethodId, VerificationStatus> = {
  wallet: "unverified",
  email: "unverified",
  phone: "unverified",
  id: "unverified",
};

async function loadVerifications() {
  const response = await fetch("/api/traders/me/verifications", {
    cache: "no-store",
  });
  // 401 simply means signed out.
  if (!response.ok) return NONE;
  const data = (await response.json()) as {
    verifications: Record<MethodId, VerificationStatus>;
  };
  return data.verifications;
}

/**
 * Verification progress, from the database.
 *
 * It used to live in localStorage, which made the badge meaningless: a mark
 * only your own browser could see is not evidence of anything to a
 * counterparty, and clearing site data reset it. The statuses are still only
 * ever *written* by the server — see lib/verifications/queries.ts.
 */
const store = createScopedStore<Record<MethodId, VerificationStatus>>(
  loadVerifications,
  NONE,
);

export function useVerification() {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/**
 * Asks for a check. Resolves with an error message, or undefined on success.
 *
 * The result is `pending`, never `verified` — the server refuses to grant a
 * badge on request, so this cannot report one either.
 */
export async function requestVerification(
  method: MethodId,
): Promise<string | undefined> {
  try {
    const response = await fetch("/api/traders/me/verifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method }),
    });

    const data = (await response.json()) as {
      verifications?: Record<MethodId, VerificationStatus>;
      error?: string;
    };
    if (!response.ok) return data.error ?? "Could not request the check.";

    if (data.verifications) store.set(data.verifications);
    return undefined;
  } catch {
    return "Could not reach the server.";
  }
}

/** The public mark. Only the ID check earns it — the rest are contact details. */
export function isVerified(record: Record<MethodId, VerificationStatus>) {
  return VERIFICATION_METHODS.filter((method) => method.grantsBadge).every(
    (method) => record[method.id] === "verified",
  );
}

export function verifiedCount(record: Record<MethodId, VerificationStatus>) {
  return VERIFICATION_METHODS.filter(
    (method) => record[method.id] === "verified",
  ).length;
}
