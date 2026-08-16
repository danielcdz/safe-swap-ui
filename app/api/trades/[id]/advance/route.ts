import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import {
  advanceTrade,
  type AdvanceFailure,
  type TradeAction,
} from "@/lib/trades/queries";

const REASONS: Record<AdvanceFailure, { status: number; error: string }> = {
  "not-found": { status: 404, error: "Trade not found." },
  stale: {
    status: 409,
    error: "This trade has already moved on. Reload to see where it is.",
  },
  "not-your-turn": { status: 403, error: "It is the other side's turn." },
  "not-cancellable": {
    status: 400,
    error: "Payment has already been sent — raise a dispute instead.",
  },
  "not-disputable": {
    status: 400,
    error: "Nothing has moved yet. Cancel instead.",
  },
  terminal: { status: 400, error: "This trade is finished." },
};

/** Moves a trade one step, or cancels or disputes it. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getSessionAddress();
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { action, from, txHash } = (body ?? {}) as {
    action?: unknown;
    from?: unknown;
    txHash?: unknown;
  };

  if (action !== "next" && action !== "cancel" && action !== "dispute") {
    return NextResponse.json(
      { error: "action must be next, cancel or dispute." },
      { status: 400 },
    );
  }
  if (typeof from !== "string" || !from) {
    return NextResponse.json(
      { error: "from is required — it guards against double submits." },
      { status: 400 },
    );
  }
  if (txHash !== undefined && txHash !== null && typeof txHash !== "string") {
    return NextResponse.json({ error: "txHash must be a string." }, { status: 400 });
  }

  try {
    const result = await advanceTrade({
      id,
      viewer,
      from,
      action: action as TradeAction,
      txHash: typeof txHash === "string" ? txHash.trim().toLowerCase() : null,
    });

    if (typeof result === "string") {
      const { status, error } = REASONS[result];
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("trades advance failed", error);
    return NextResponse.json(
      { error: "Could not update the trade." },
      { status: 500 },
    );
  }
}
