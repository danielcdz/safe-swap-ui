import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { avatarUrl } from "@/lib/avatar-url";

export const TRADER_COLUMNS = "address, nickname, joined_at, avatar_path";

export interface TraderRow {
  address: string;
  nickname: string;
  joined_at: string;
  avatar_path: string | null;
}

export interface TraderProfile {
  address: string;
  nickname: string;
  joinedAt: string;
  /** Null when they have not set a picture; the badge falls back. */
  avatarUrl: string | null;
}

/**
 * A trader is an address, a name, a join date and a picture.
 *
 * Payment details are deliberately absent: they are agreed in the trade chat,
 * between the two people who need them, and never stored here. The storage
 * path does not travel either — only the URL that re-checks the session.
 */
export const toProfile = (row: TraderRow): TraderProfile => ({
  address: row.address,
  nickname: row.nickname,
  joinedAt: row.joined_at,
  avatarUrl: avatarUrl(row.address, row.avatar_path),
});

export async function getTrader(
  address: string,
): Promise<TraderProfile | null> {
  const { data, error } = await supabaseAdmin()
    .from("traders")
    .select(TRADER_COLUMNS)
    .eq("address", address)
    .maybeSingle();

  if (error) throw new Error(`Could not load the trader: ${error.message}`);
  return data ? toProfile(data as unknown as TraderRow) : null;
}
