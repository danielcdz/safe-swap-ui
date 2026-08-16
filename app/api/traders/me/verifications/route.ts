import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import {
  listVerifications,
  requestVerification,
  type RequestFailure,
} from "@/lib/verifications/queries";

const UNAUTHENTICATED = { error: "Not authenticated." };

const REASONS: Record<RequestFailure, { status: number; error: string }> = {
  "unknown-method": { status: 400, error: "Unknown verification method." },
  "not-requestable": {
    status: 400,
    error: "Wallet ownership is proven when you sign in.",
  },
  "already-done": {
    status: 409,
    error: "That check is already under way.",
  },
};

/** The caller's own verification progress. */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  try {
    return NextResponse.json(
      { verifications: await listVerifications(address) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("verifications GET failed", error);
    return NextResponse.json(
      { error: "Could not load your verifications." },
      { status: 500 },
    );
  }
}

/**
 * Asks for a check to be run. The result is always `pending` — see
 * requestVerification for why a client can never reach `verified`.
 */
export async function POST(request: NextRequest) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { method } = (body ?? {}) as { method?: unknown };
  if (typeof method !== "string") {
    return NextResponse.json({ error: "method is required." }, { status: 400 });
  }

  try {
    const result = await requestVerification(address, method);
    if (typeof result === "string") {
      const { status, error } = REASONS[result];
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json({ verifications: await listVerifications(address) });
  } catch (error) {
    console.error("verifications POST failed", error);
    return NextResponse.json(
      { error: "Could not request the check." },
      { status: 500 },
    );
  }
}
