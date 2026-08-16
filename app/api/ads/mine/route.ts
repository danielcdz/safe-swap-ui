import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { listAdsFor } from "@/lib/ads/queries";

/** The signed-in trader's own ads, including how each appears in the book. */
export async function GET() {
  const advertiser = await getSessionAddress();
  if (!advertiser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const ads = await listAdsFor(advertiser);
    return NextResponse.json(
      { ads },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("ads/mine GET failed", error);
    return NextResponse.json({ error: "Could not load your ads." }, { status: 500 });
  }
}
