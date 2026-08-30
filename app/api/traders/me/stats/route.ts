import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { getTraderStats } from "@/lib/traders/stats";

/**
 * The signed-in trader's record.
 *
 * Scoped to the session like every other write and read here — there is no
 * address parameter, so nobody can ask for someone else's record. A public
 * profile would be a different route with a different disclosure decision.
 */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    return NextResponse.json(
      { stats: await getTraderStats(address) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("traders/me/stats GET failed", error);
    return NextResponse.json(
      { error: "Could not load your record." },
      { status: 500 },
    );
  }
}
