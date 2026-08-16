import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { validateNickname } from "@/lib/nickname";

const UNAUTHENTICATED = { error: "Not authenticated." };

/** The signed-in trader's own record. */
export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("traders")
    .select("address, nickname, joined_at")
    .eq("address", address)
    .single();

  if (error || !data) {
    console.error("traders/me GET failed", error);
    return NextResponse.json({ error: "Trader not found." }, { status: 404 });
  }

  return NextResponse.json(
    { address: data.address, nickname: data.nickname, joinedAt: data.joined_at },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Renames the signed-in trader.
 *
 * The address comes from the session, so the request body cannot choose whose
 * nickname to change — `.eq("address", address)` is scoped to the caller and
 * there is no path where a body field could widen it.
 */
export async function PATCH(request: NextRequest) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const nickname = (body as { nickname?: unknown })?.nickname;
  if (typeof nickname !== "string") {
    return NextResponse.json({ error: "nickname is required." }, { status: 400 });
  }

  // Revalidated here even though the form checks it — the client's opinion is
  // advisory, and the database CHECK would otherwise reject with a message no
  // user should have to read.
  const trimmed = nickname.trim();
  const invalid = validateNickname(trimmed);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("traders")
    .update({ nickname: trimmed })
    .eq("address", address)
    .select("address, nickname, joined_at")
    .single();

  if (error || !data) {
    console.error("traders/me PATCH failed", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json(
    { address: data.address, nickname: data.nickname, joinedAt: data.joined_at },
    { headers: { "cache-control": "no-store" } },
  );
}
