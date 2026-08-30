import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getTradeFor } from "./queries";

export const MESSAGE_MAX = 2000;

export type MessageKind = "text" | "system" | "image";

/** What an image message carries beyond its caption. */
export interface MessageAttachment {
  mime: string;
  bytes: number;
  width: number;
  height: number;
}

export interface TradeMessageRecord {
  id: string;
  kind: MessageKind;
  /** Null for system messages. */
  author: string | null;
  body: string;
  createdAt: string;
  /** Present only on image messages. */
  attachment?: MessageAttachment;
}

export interface MessageRow {
  id: string;
  kind: MessageKind;
  author: string | null;
  body: string;
  created_at: string;
  attachment_mime: string | null;
  attachment_bytes: number | null;
  attachment_width: number | null;
  attachment_height: number | null;
}

/**
 * The columns a message is read through.
 *
 * `attachment_path` is deliberately absent. The bytes are served back through
 * a route of ours that re-checks the session; handing the client a storage
 * location instead would be handing it something that outlives the check.
 */
export const MESSAGE_COLUMNS =
  "id, kind, author, body, created_at, attachment_mime, attachment_bytes, attachment_width, attachment_height";

export const toMessage = (row: MessageRow): TradeMessageRecord => ({
  id: row.id,
  kind: row.kind,
  author: row.author,
  body: row.body,
  createdAt: row.created_at,
  ...(row.kind === "image" && row.attachment_mime !== null
    ? {
        attachment: {
          mime: row.attachment_mime,
          bytes: row.attachment_bytes ?? 0,
          width: row.attachment_width ?? 0,
          height: row.attachment_height ?? 0,
        },
      }
    : {}),
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
    .select(MESSAGE_COLUMNS)
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load messages: ${error.message}`);
  return (data as unknown as MessageRow[]).map(toMessage);
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
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) throw new Error(`Could not send: ${error.message}`);
  return toMessage(data as unknown as MessageRow);
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
