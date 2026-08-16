import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { getTradeFor } from "@/lib/trades/queries";

/**
 * A trade, for one of its two participants.
 *
 * Anyone else gets 404 rather than 403: a trade is private, and confirming
 * that an id exists would leak that two particular wallets are trading.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getSessionAddress();
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const trade = await getTradeFor(id, viewer);
    if (!trade) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }
    return NextResponse.json(
      { trade },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("trades GET failed", error);
    return NextResponse.json(
      { error: "Could not load the trade." },
      { status: 500 },
    );
  }
}
