import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * A readable placeholder built from the tail of the address, e.g. `Trader-4W37`.
 * Satisfies both the database CHECK (3–20 chars) and `validateNickname()`.
 */
export function defaultNickname(address: string) {
  return `Trader-${address.slice(-4)}`;
}

/**
 * Creates the trader on first successful login.
 *
 * `ignoreDuplicates` matters: a returning user must keep the nickname they
 * chose. An ordinary upsert would overwrite it with the generated placeholder
 * on every single sign-in.
 *
 * The wallet verification is recorded at the same time, because a verified
 * SEP-53 signature *is* proof of wallet ownership — that step is complete by
 * definition once we reach here. The other methods stay unverified.
 */
export async function ensureTrader(address: string) {
  const supabase = supabaseAdmin();

  const { error: traderError } = await supabase
    .from("traders")
    .upsert(
      { address, nickname: defaultNickname(address) },
      { onConflict: "address", ignoreDuplicates: true },
    );

  if (traderError) {
    throw new Error(`Could not create trader: ${traderError.message}`);
  }

  const { error: verificationError } = await supabase
    .from("trader_verifications")
    .upsert(
      {
        trader_address: address,
        method: "wallet",
        status: "verified",
        verified_at: new Date().toISOString(),
      },
      { onConflict: "trader_address,method" },
    );

  if (verificationError) {
    throw new Error(
      `Could not record wallet verification: ${verificationError.message}`,
    );
  }
}
