import { NextResponse } from "next/server";
import { destroySession, getSessionAddress } from "@/lib/auth/session";

/** Who the server believes is calling, or null. */
export async function GET() {
  const address = await getSessionAddress();
  return NextResponse.json(
    { address },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Logout. Clears the cookie; the wallet connection itself is a client concern. */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ address: null });
}
