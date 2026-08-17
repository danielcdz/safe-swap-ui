import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import {
  listTradesFor,
  openTrade,
  type OpenTradeFailure,
} from "@/lib/trades/queries";

/** The viewer's own trades. Scoped to the session, so there is nothing to pass. */
export async function GET() {
  const viewer = await getSessionAddress();
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    return NextResponse.json(
      { trades: await listTradesFor(viewer) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("trades GET failed", error);
    return NextResponse.json(
      { error: "Could not load your trades." },
      { status: 500 },
    );
  }
}

/** Each refusal gets its own message — these are user mistakes, not attacks. */
const REASONS: Record<OpenTradeFailure, { status: number; error: string }> = {
  "ad-not-found": { status: 404, error: "That offer is no longer available." },
  "own-ad": { status: 400, error: "You cannot trade with yourself." },
  "unsupported-method": {
    status: 400,
    error: "That payment method is not accepted on this offer.",
  },
  "below-minimum": { status: 400, error: "That is below the trader's minimum." },
  "above-maximum": { status: 400, error: "That is above the trader's maximum." },
  insufficient: {
    status: 409,
    error: "Not enough left on this offer — someone else took it first.",
  },
};

/** Opens a trade against an ad. The taker is the session, never the body. */
export async function POST(request: NextRequest) {
  const taker = await getSessionAddress();
  if (!taker) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { adId, amount, paymentMethod } = (body ?? {}) as {
    adId?: unknown;
    amount?: unknown;
    paymentMethod?: unknown;
  };

  if (typeof adId !== "string" || !adId) {
    return NextResponse.json({ error: "adId is required." }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number." },
      { status: 400 },
    );
  }
  if (typeof paymentMethod !== "string" || !paymentMethod) {
    return NextResponse.json(
      { error: "paymentMethod is required." },
      { status: 400 },
    );
  }

  try {
    const result = await openTrade({ adId, taker, amount, paymentMethod });

    if (typeof result === "string") {
      const { status, error } = REASONS[result];
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("trades POST failed", error);
    return NextResponse.json(
      { error: "Could not open the trade." },
      { status: 500 },
    );
  }
}
