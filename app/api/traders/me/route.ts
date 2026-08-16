import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { validateNickname } from "@/lib/nickname";

const UNAUTHENTICATED = { error: "Not authenticated." };

const COLUMNS = "address, nickname, joined_at";

interface TraderRow {
  address: string;
  nickname: string;
  joined_at: string;
}

/**
 * A trader is only an address, a name, and a join date.
 *
 * Payment details are deliberately absent: they are agreed in the trade chat,
 * between the two people who need them, and never stored here.
 */
function toProfile(row: TraderRow) {
  return {
    address: row.address,
    nickname: row.nickname,
    joinedAt: row.joined_at,
  };
}

export async function GET() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("traders")
    .select(COLUMNS)
    .eq("address", address)
    .single();

  if (error || !data) {
    console.error("traders/me GET failed", error);
    return NextResponse.json({ error: "Trader not found." }, { status: 404 });
  }

  return NextResponse.json(toProfile(data as unknown as TraderRow), {
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Renames the signed-in trader.
 *
 * The address comes from the session, so the body cannot choose whose record
 * to change — the update is scoped with `.eq("address", address)` and no body
 * field can widen it.
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

  const { nickname } = (body ?? {}) as { nickname?: unknown };
  if (typeof nickname !== "string") {
    return NextResponse.json({ error: "nickname is required." }, { status: 400 });
  }

  const trimmed = nickname.trim();
  const invalid = validateNickname(trimmed);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("traders")
    .update({ nickname: trimmed })
    .eq("address", address)
    .select(COLUMNS)
    .single();

  if (error || !data) {
    console.error("traders/me PATCH failed", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json(toProfile(data as unknown as TraderRow), {
    headers: { "cache-control": "no-store" },
  });
}
