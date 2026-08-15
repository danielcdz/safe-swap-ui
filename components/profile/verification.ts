"use client";

import * as React from "react";

export type VerificationStatus = "unverified" | "pending" | "verified";
export type MethodId = "wallet" | "email" | "phone" | "id";

export interface VerificationMethod {
  id: MethodId;
  label: string;
  description: string;
  /** Only this step earns the public Verified mark. */
  grantsBadge?: boolean;
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
  },
  {
    id: "phone",
    label: "Phone number",
    description: "SMS alerts while a trade is live.",
  },
  {
    id: "id",
    label: "Government ID",
    description: "Raises your order limits and earns the Verified mark.",
    grantsBadge: true,
  },
];

const DEFAULTS: Record<MethodId, VerificationStatus> = {
  wallet: "verified",
  email: "verified",
  phone: "unverified",
  id: "unverified",
};

const STORAGE_KEY = "safeswap:verification";

/**
 * Verification progress, persisted client-side like the other user state.
 *
 * Seam: a real build reads this from the KYC provider and never trusts the
 * client for it — the statuses here only drive the UI.
 */
const listeners = new Set<() => void>();
let statuses: Record<MethodId, VerificationStatus> = DEFAULTS;

function read(): Record<MethodId, VerificationStatus> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<MethodId, VerificationStatus>>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

if (typeof window !== "undefined") statuses = read();

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  statuses = read();
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

export function setMethodStatus(id: MethodId, status: VerificationStatus) {
  statuses = { ...statuses, [id]: status };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  } catch {
    // Progress won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useVerification() {
  return React.useSyncExternalStore(
    subscribe,
    () => statuses,
    () => DEFAULTS,
  );
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
