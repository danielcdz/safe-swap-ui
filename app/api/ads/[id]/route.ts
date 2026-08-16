import { NextResponse } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { closeAd } from "@/lib/ads/queries";

/**
 * Takes an ad down.
 *
 * Scoped to the caller, so a valid session cannot remove someone else's ad —
 * an id that is not yours simply matches nothing and returns 404.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const advertiser = await getSessionAddress();
  if (!advertiser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const removed = await closeAd(advertiser, id);
    if (!removed) {
      return NextResponse.json({ error: "Ad not found." }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    console.error("ads DELETE failed", error);
    return NextResponse.json({ error: "Could not take the ad down." }, { status: 500 });
  }
}
