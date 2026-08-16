import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getTradeFor } from "./queries";

export const MESSAGE_MAX = 2000;

export interface TradeMessageRecord {
  id: string;
  kind: "text" | "system";
  /** Null for system messages. */
  author: string | null;
  body: string;
  createdAt: string;
}

interface MessageRow {
  id: string;
  kind: "text" | "system";
  author: string | null;
  body: string;
  created_at: string;
}

const toMessage = (row: MessageRow): TradeMessageRecord => ({
  id: row.id,
  kind: row.kind,
  author: row.author,
  body: row.body,
  createdAt: row.created_at,
});

/**
 * Every message on a trade, oldest first.
 *
 * Returns null when the viewer is not a participant — the same 404-shaped
 * refusal the trade itself uses, so nobody can confirm a trade exists by
 * asking for its messages.
 */
export async function listMessages(
  tradeId: string,
  viewer: string,
): Promise<TradeMessageRecord[] | null> {
  const trade = await getTradeFor(tradeId, viewer);
  if (!trade) return null;

  const { data, error } = await supabaseAdmin()
    .from("trade_messages")
    .select("id, kind, author, body, created_at")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load messages: ${error.message}`);
  return (data as MessageRow[]).map(toMessage);
}

export async function postMessage(
  tradeId: string,
  author: string,
  body: string,
): Promise<TradeMessageRecord | null> {
  const trade = await getTradeFor(tradeId, author);
  if (!trade) return null;

  const { data, error } = await supabaseAdmin()
    .from("trade_messages")
    .insert({ trade_id: tradeId, kind: "text", author, body })
    .select("id, kind, author, body, created_at")
    .single();

  if (error) throw new Error(`Could not send: ${error.message}`);
  return toMessage(data as MessageRow);
}

/**
 * Records a state change in the conversation.
 *
 * Chat is the transaction surface here, so escrow-style events belong in the
 * same stream rather than a separate log the users would have to reconcile.
 * A failure is logged, never thrown — losing the note must not fail the
 * transition that produced it.
 */
export async function postSystemMessage(tradeId: string, body: string) {
  const { error } = await supabaseAdmin()
    .from("trade_messages")
    .insert({ trade_id: tradeId, kind: "system", author: null, body });

  if (error) console.error("system message not recorded", error);
}
