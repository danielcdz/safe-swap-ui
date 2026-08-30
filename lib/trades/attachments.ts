import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inspectImage } from "./image";
import {
  MESSAGE_COLUMNS,
  toMessage,
  type MessageRow,
  type TradeMessageRecord,
} from "./messages";
import { getTradeFor } from "./queries";

/**
 * Where receipt images live. Private, and with no policies on
 * `storage.objects` — the same deny-all as every table, so the secret key is
 * the only way in and authorisation stays this codebase's job.
 */
export const BUCKET = "trade-attachments";

/**
 * 4MB, under Vercel's ~4.5MB request body ceiling for a serverless function.
 * The browser downscales before sending, so a phone screenshot arrives two
 * orders of magnitude below this — the cap is for what the browser did not
 * produce. The bucket and a CHECK on the row hold the same line.
 */
export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

/** Enough for a receipt and a correction; not enough to be free file hosting. */
export const ATTACHMENTS_PER_TRADE = 20;

const EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AttachmentRefusal =
  | "not-participant"
  | "too-large"
  | "not-an-image"
  | "too-many";

export type AddImageResult =
  | { ok: true; message: TradeMessageRecord }
  | { ok: false; reason: AttachmentRefusal };

/**
 * Stores an image and posts it into the trade's conversation.
 *
 * The mime and dimensions recorded are the ones read out of the bytes, not the
 * ones the caller declared — see `inspectImage`.
 */
export async function addImageMessage(
  tradeId: string,
  author: string,
  bytes: Uint8Array,
  caption: string,
): Promise<AddImageResult> {
  // Participation is checked first so a stranger gets the same refusal
  // whatever they send, and learns nothing about the trade from the shape of
  // the answer.
  const trade = await getTradeFor(tradeId, author);
  if (!trade) return { ok: false, reason: "not-participant" };

  if (bytes.byteLength > ATTACHMENT_MAX_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  const image = inspectImage(bytes);
  if (!image) return { ok: false, reason: "not-an-image" };

  const supabase = supabaseAdmin();

  const { count, error: countError } = await supabase
    .from("trade_messages")
    .select("id", { count: "exact", head: true })
    .eq("trade_id", tradeId)
    .eq("kind", "image");

  if (countError) {
    throw new Error(`Could not count attachments: ${countError.message}`);
  }
  if ((count ?? 0) >= ATTACHMENTS_PER_TRADE) {
    return { ok: false, reason: "too-many" };
  }

  // A random name under a trade-scoped folder: the path never reaches a
  // client, and grouping by trade makes the reset sweep one list-and-remove.
  const path = `${tradeId}/${randomUUID()}.${EXTENSION[image.mime]}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: image.mime,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Could not store the image: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from("trade_messages")
    .insert({
      trade_id: tradeId,
      kind: "image",
      author,
      body: caption,
      attachment_path: path,
      attachment_mime: image.mime,
      attachment_bytes: bytes.byteLength,
      attachment_width: image.width,
      attachment_height: image.height,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) {
    // Nothing points at the object now and nothing ever will. An orphan in a
    // private bucket is invisible and never collected, so it goes here.
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`Could not send: ${error.message}`);
  }

  return { ok: true, message: toMessage(data as unknown as MessageRow) };
}

export interface StoredImage {
  bytes: ArrayBuffer;
  mime: string;
}

/**
 * The bytes behind an image message, for a participant.
 *
 * Null when the viewer is not in the trade, or the message is not an image on
 * this trade — the same refusal shape as everything else, so a stranger cannot
 * learn that an attachment exists.
 */
export async function readImageMessage(
  tradeId: string,
  messageId: string,
  viewer: string,
): Promise<StoredImage | null> {
  const trade = await getTradeFor(tradeId, viewer);
  if (!trade) return null;

  const supabase = supabaseAdmin();

  const { data: row, error } = await supabase
    .from("trade_messages")
    .select("attachment_path, attachment_mime")
    .eq("id", messageId)
    .eq("trade_id", tradeId)
    .eq("kind", "image")
    .maybeSingle();

  if (error) throw new Error(`Could not load the attachment: ${error.message}`);
  if (!row?.attachment_path) return null;

  const { data, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(row.attachment_path as string);

  // The row says the object is there. If it is not, that is a broken invariant
  // and worth a 500 — not a 404 that would read as "no such attachment".
  if (downloadError || !data) {
    throw new Error(
      `Attachment missing from storage: ${downloadError?.message ?? "no body"}`,
    );
  }

  return {
    bytes: await data.arrayBuffer(),
    mime: row.attachment_mime as string,
  };
}
