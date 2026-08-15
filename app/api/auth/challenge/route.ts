import { NextResponse, type NextRequest } from "next/server";
import { issueChallenge } from "@/lib/auth/challenge";
import { isStellarAddress } from "@/lib/wallet";

/**
 * Issues a single-use message for the wallet to sign.
 *
 * Unauthenticated by design — anyone may ask for a challenge. Asking proves
 * nothing and grants nothing; only a valid signature over the returned message
 * does, and that is `/api/auth/verify`.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const address = (body as { address?: unknown })?.address;
  if (typeof address !== "string" || !isStellarAddress(address)) {
    return NextResponse.json(
      { error: "A valid Stellar address is required." },
      { status: 400 },
    );
  }

  try {
    // The host we were actually reached on, so the signed message names the
    // origin the user is looking at.
    const domain = request.headers.get("host") ?? "safeswap";
    const challenge = await issueChallenge(address, domain);
    return NextResponse.json(challenge, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("auth/challenge failed", error);
    return NextResponse.json(
      { error: "Could not issue a challenge." },
      { status: 500 },
    );
  }
}
