import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

export type VerifyMethod = "wallet" | "email" | "phone" | "id";
export type VerifyStatus = "unverified" | "pending" | "verified";

export const VERIFY_METHODS: VerifyMethod[] = ["wallet", "email", "phone", "id"];

const UNVERIFIED: Record<VerifyMethod, VerifyStatus> = {
  wallet: "unverified",
  email: "unverified",
  phone: "unverified",
  id: "unverified",
};

/** Every method's status, with the ones never requested filled in. */
export async function listVerifications(
  address: string,
): Promise<Record<VerifyMethod, VerifyStatus>> {
  const { data, error } = await supabaseAdmin()
    .from("trader_verifications")
    .select("method, status")
    .eq("trader_address", address);

  if (error) {
    throw new Error(`Could not load verifications: ${error.message}`);
  }

  const statuses = { ...UNVERIFIED };
  for (const row of (data ?? []) as { method: VerifyMethod; status: VerifyStatus }[]) {
    statuses[row.method] = row.status;
  }
  return statuses;
}

export type RequestFailure = "unknown-method" | "not-requestable" | "already-done";

/**
 * Records that a trader has asked to verify a method.
 *
 * It can only ever reach `pending`. Nothing a client sends may set `verified`,
 * because the ID check feeds the public badge on the order book — the mark
 * other traders read as "someone checked this person's documents". An endpoint
 * that granted it on request would be a forgery service, and it would be worse
 * than the localStorage version it replaces: that lie at least stayed inside
 * the liar's own browser.
 *
 * `verified` is set in exactly two places: the login path, for `wallet`, where
 * a checked SEP-53 signature *is* the proof; and, in future, whatever provider
 * actually performs the check.
 */
export async function requestVerification(
  address: string,
  method: string,
): Promise<{ status: VerifyStatus } | RequestFailure> {
  if (!VERIFY_METHODS.includes(method as VerifyMethod)) return "unknown-method";
  // Proven by signature at sign-in; there is nothing to request.
  if (method === "wallet") return "not-requestable";

  const current = await listVerifications(address);
  if (current[method as VerifyMethod] !== "unverified") return "already-done";

  const { error } = await supabaseAdmin()
    .from("trader_verifications")
    .upsert(
      { trader_address: address, method, status: "pending", verified_at: null },
      { onConflict: "trader_address,method" },
    );

  if (error) throw new Error(`Could not request verification: ${error.message}`);
  return { status: "pending" };
}
