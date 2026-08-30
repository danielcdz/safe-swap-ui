import "server-only";

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inspectImage } from "@/lib/image/inspect";

/** Private, no policies — the same deny-all as every table. */
export const AVATAR_BUCKET = "trader-avatars";

/** The client crops to a small square first; this is the backstop. */
export const AVATAR_MAX_BYTES = 1024 * 1024;

const EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AvatarRefusal = "too-large" | "not-an-image";

export type SetAvatarResult =
  | { ok: true; path: string }
  | { ok: false; reason: AvatarRefusal };

async function currentPath(address: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("traders")
    .select("avatar_path")
    .eq("address", address)
    .maybeSingle();

  return (data as { avatar_path: string | null } | null)?.avatar_path ?? null;
}

/**
 * Sets or replaces the trader's picture.
 *
 * The row is pointed at the new object before the old one is removed. Done the
 * other way round, a failure in between would leave the row naming a file that
 * no longer exists — a broken picture rather than none at all.
 */
export async function setAvatar(
  address: string,
  bytes: Uint8Array,
): Promise<SetAvatarResult> {
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  // The format is read from the bytes, never from what the upload claimed.
  const image = inspectImage(bytes);
  if (!image) return { ok: false, reason: "not-an-image" };

  const supabase = supabaseAdmin();
  const previous = await currentPath(address);
  const path = `${address}/${randomUUID()}.${EXTENSION[image.mime]}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, {
      contentType: image.mime,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Could not store the picture: ${uploadError.message}`);
  }

  const { error } = await supabase
    .from("traders")
    .update({ avatar_path: path, avatar_mime: image.mime })
    .eq("address", address);

  if (error) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    throw new Error(`Could not save the picture: ${error.message}`);
  }

  if (previous) await supabase.storage.from(AVATAR_BUCKET).remove([previous]);

  return { ok: true, path };
}

/** Drops the picture; the UI falls back to the address-derived badge. */
export async function clearAvatar(address: string): Promise<void> {
  const supabase = supabaseAdmin();
  const path = await currentPath(address);

  const { error } = await supabase
    .from("traders")
    .update({ avatar_path: null, avatar_mime: null })
    .eq("address", address);

  if (error) throw new Error(`Could not remove the picture: ${error.message}`);

  if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

export interface StoredAvatar {
  bytes: ArrayBuffer;
  mime: string;
}

/**
 * A trader's picture, for any signed-in caller.
 *
 * Deliberately not scoped to the viewer's own address: a face is only useful
 * if the counterparty can see it. Null when there is none, or the object has
 * gone — the badge falls back rather than the page breaking.
 */
export async function readAvatar(
  address: string,
): Promise<StoredAvatar | null> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("traders")
    .select("avatar_path, avatar_mime")
    .eq("address", address)
    .maybeSingle();

  if (error) throw new Error(`Could not load the picture: ${error.message}`);

  const row = data as {
    avatar_path: string | null;
    avatar_mime: string | null;
  } | null;
  if (!row?.avatar_path) return null;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .download(row.avatar_path);

  if (downloadError || !blob) return null;

  return {
    bytes: await blob.arrayBuffer(),
    mime: row.avatar_mime ?? "image/webp",
  };
}
