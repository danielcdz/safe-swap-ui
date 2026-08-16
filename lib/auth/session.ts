import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { isStellarAddress } from "@/lib/wallet";

const COOKIE_NAME = "safeswap_session";
const ISSUER = "safeswap";
const AUDIENCE = "safeswap-app";

/** Long enough to trade without re-signing, short enough to bound a theft. */
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(value);
}

/**
 * Issues the session cookie for an address that has *already* been proven —
 * only call this after a signature has been verified.
 *
 * The address is the sole claim. It is signed rather than stored server-side
 * because that is all a session needs to carry here.
 */
export async function createSession(address: string) {
  const token = await new SignJWT({ address })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * The verified wallet address for this request, or null.
 *
 * **This is the only trustworthy source of "who is calling".** Route handlers
 * must derive `traders.address`, `ads.advertiser`, `trades.taker` and friends
 * from here — never from the request body, which any caller can forge.
 */
export async function getSessionAddress(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const address = payload.address;
    return typeof address === "string" && isStellarAddress(address)
      ? address
      : null;
  } catch {
    // Expired, tampered with, or signed by a different secret.
    return null;
  }
}

/** For routes that cannot proceed without an authenticated wallet. */
export async function requireSessionAddress(): Promise<string> {
  const address = await getSessionAddress();
  if (!address) throw new Error("Not authenticated");
  return address;
}
