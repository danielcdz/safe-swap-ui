import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/server";
import { validateNickname } from "@/lib/nickname";
import {
  normalisePaymentDetails,
  validatePaymentDetails,
} from "@/lib/payment-details";

const UNAUTHENTICATED = { error: "Not authenticated." };

const COLUMNS = "address, nickname, joined_at, sinpe_phone, bank_name, bank_account";

interface TraderRow {
  address: string;
  nickname: string;
  joined_at: string;
  sinpe_phone: string | null;
  bank_name: string | null;
  bank_account: string | null;
}

/**
 * These are the caller's *own* details, which is the only context in which
 * they are returned in full. A counterparty sees the seller's via the trade,
 * and nobody else sees them at all.
 */
function toProfile(row: TraderRow) {
  return {
    address: row.address,
    nickname: row.nickname,
    joinedAt: row.joined_at,
    sinpePhone: row.sinpe_phone,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
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
 * Updates the signed-in trader.
 *
 * Accepts any subset of the editable fields. The address comes from the
 * session, so the body cannot choose whose record to change — the update is
 * scoped with `.eq("address", address)` and no body field can widen it.
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

  const input = (body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("nickname" in input) {
    if (typeof input.nickname !== "string") {
      return NextResponse.json({ error: "nickname must be a string." }, { status: 400 });
    }
    const trimmed = input.nickname.trim();
    const invalid = validateNickname(trimmed);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    patch.nickname = trimmed;
  }

  const touchesPayment =
    "sinpePhone" in input || "bankName" in input || "bankAccount" in input;

  if (touchesPayment) {
    const details = {
      sinpePhone: input.sinpePhone as string | null | undefined,
      bankName: input.bankName as string | null | undefined,
      bankAccount: input.bankAccount as string | null | undefined,
    };

    for (const value of Object.values(details)) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return NextResponse.json(
          { error: "Payment details must be strings." },
          { status: 400 },
        );
      }
    }

    const errors = validatePaymentDetails(details);
    const first = Object.values(errors)[0];
    if (first) return NextResponse.json({ error: first, errors }, { status: 400 });

    Object.assign(patch, normalisePaymentDetails(details));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("traders")
    .update(patch)
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
