import { NextResponse, type NextRequest } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { consumeChallenge } from "@/lib/auth/challenge";
import { createSession } from "@/lib/auth/session";
import { isStellarAddress } from "@/lib/wallet";

/** One message for every failure, so this endpoint is not a probing oracle. */
const REJECTED = "Signature could not be verified.";

/**
 * Verifies a SEP-53 signature over a challenge we issued and, only then,
 * establishes a session.
 *
 * The address is taken from the *stored challenge*, never from the request
 * body — a caller cannot nominate who they are, only prove it.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { nonce, signature } = (body ?? {}) as {
    nonce?: unknown;
    signature?: unknown;
  };

  if (typeof nonce !== "string" || typeof signature !== "string") {
    return NextResponse.json(
      { error: "nonce and signature are required." },
      { status: 400 },
    );
  }

  try {
    // Burns the nonce whether or not the signature proves out, so a failed
    // attempt cannot be retried against the same challenge.
    const challenge = await consumeChallenge(nonce);
    if (!challenge || !isStellarAddress(challenge.address)) {
      return NextResponse.json({ error: REJECTED }, { status: 401 });
    }

    let verified = false;
    try {
      // SEP-53: prefixes with "Stellar Signed Message:\n", SHA-256s it, and
      // checks the ed25519 signature. The SDK does all of that.
      verified = Keypair.fromPublicKey(challenge.address).verifyMessage(
        challenge.message,
        Buffer.from(signature, "base64"),
      );
    } catch {
      // Malformed base64 or a signature of the wrong length.
      verified = false;
    }

    if (!verified) {
      return NextResponse.json({ error: REJECTED }, { status: 401 });
    }

    await createSession(challenge.address);
    return NextResponse.json(
      { address: challenge.address },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("auth/verify failed", error);
    return NextResponse.json({ error: REJECTED }, { status: 500 });
  }
}
