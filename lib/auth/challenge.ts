import "server-only";

import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EXPECTED_NETWORK } from "@/lib/wallet";

/** Short: the user signs immediately or starts over. */
const CHALLENGE_TTL_SECONDS = 120;

/**
 * The text the wallet signs.
 *
 * It states the domain, address, network and expiry in plain language, because
 * Freighter shows this string to the user verbatim — a signing prompt they
 * cannot read is a prompt they cannot judge.
 *
 * The domain is load-bearing beyond readability: it stops a phishing origin
 * collecting a signature and replaying it against us, since the message the
 * user approved names where it was meant to go.
 */
function buildChallengeMessage(input: {
  address: string;
  nonce: string;
  domain: string;
  expiresAt: Date;
}) {
  return [
    `${input.domain} wants you to sign in with your Stellar account:`,
    input.address,
    "",
    "Sign this message to prove you control this wallet. It authorises no",
    "transaction and moves no funds.",
    "",
    `Network: ${EXPECTED_NETWORK.label}`,
    `Nonce: ${input.nonce}`,
    `Expires: ${input.expiresAt.toISOString()}`,
  ].join("\n");
}

export interface IssuedChallenge {
  message: string;
  nonce: string;
  expiresAt: string;
}

export async function issueChallenge(
  address: string,
  domain: string,
): Promise<IssuedChallenge> {
  const supabase = supabaseAdmin();
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);
  const message = buildChallengeMessage({ address, nonce, domain, expiresAt });

  const { error } = await supabase.from("auth_challenges").insert({
    nonce,
    address,
    message,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(`Could not issue challenge: ${error.message}`);

  // Opportunistic cleanup — indexed, cheap, and saves a scheduled job. Failure
  // here is not worth failing a login over.
  void supabase
    .from("auth_challenges")
    .delete()
    .lt("expires_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  return { message, nonce, expiresAt: expiresAt.toISOString() };
}

export interface ConsumedChallenge {
  address: string;
  message: string;
}

/**
 * Burns the nonce and returns the address it was issued to alongside the exact
 * message that was signed.
 *
 * Single-use is enforced by the database in one statement, so two requests
 * racing the same nonce cannot both succeed. Returns null when the nonce is
 * unknown, expired, or already spent.
 */
export async function consumeChallenge(
  nonce: string,
): Promise<ConsumedChallenge | null> {
  const { data, error } = await supabaseAdmin().rpc("consume_auth_challenge", {
    p_nonce: nonce,
  });

  if (error) throw new Error(`Could not consume challenge: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.address || !row?.message) return null;

  return { address: row.address, message: row.message };
}
