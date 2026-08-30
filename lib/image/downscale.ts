"use client";

/**
 * Re-encodes an image small enough to send, in the browser, before upload.
 *
 * Two things fall out of this that are worth naming.
 *
 * **It drops EXIF.** A phone photo of a bank receipt can carry the GPS
 * coordinates of where it was taken, and this feature exists so people can
 * show a stranger their transfer reference. Re-encoding through a canvas keeps
 * only pixels. It runs on the client, so it is not a guarantee — but the data
 * it protects belongs to the uploader, whose browser is a reasonable place to
 * protect it.
 *
 * **It is unconditional.** Even an already-small image is re-encoded, because
 * skipping that for small files is exactly how the metadata would survive.
 */

/** Enough to read an account number off a screenshot, far below the 4MB cap. */
const MAX_EDGE = 1600;

/** Avatars render at 80px at the largest, so this is generous for retina. */
export const AVATAR_SIZE = 256;

const QUALITY = 0.85;

export interface Encoded {
  blob: Blob;
  width: number;
  height: number;
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // `from-image` applies the EXIF orientation tag. Without it a photo taken
    // sideways re-encodes sideways: the tag was what held it upright, and
    // re-encoding is precisely what throws the tag away.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image could not be read. Try a JPEG, PNG or WebP.");
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

/**
 * WebP holds screenshot text better than JPEG at the same size, and a receipt
 * is mostly text. `toBlob` falls back to PNG where WebP is unsupported, which
 * is why the result is checked rather than assumed.
 */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp");
  const blob =
    webp?.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg");

  if (!blob) throw new Error("That image could not be processed.");
  return blob;
}

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("That image could not be processed.");

  return { canvas, context };
}

/** Scaled to fit within `MAX_EDGE`, aspect ratio kept. */
export async function downscaleImage(file: File): Promise<Encoded> {
  const bitmap = await decode(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const { canvas, context } = surface(width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return { blob: await encode(canvas), width, height };
}

/**
 * Centre-cropped square, for an avatar.
 *
 * Cropping here rather than with CSS means every badge in the app gets a
 * square to work with, whatever was uploaded — and the bytes stored are the
 * bytes shown, so a portrait photo is not carried around at full height to be
 * hidden by `object-cover` on every screen it appears on.
 */
export async function cropSquare(
  file: File,
  size = AVATAR_SIZE,
): Promise<Encoded> {
  const bitmap = await decode(file);

  const edge = Math.min(bitmap.width, bitmap.height);
  const left = (bitmap.width - edge) / 2;
  const top = (bitmap.height - edge) / 2;
  // Never upscale: a 64px picture blown up to 256 is just a blurrier file.
  const side = Math.max(1, Math.round(Math.min(size, edge)));

  const { canvas, context } = surface(side, side);
  context.drawImage(bitmap, left, top, edge, edge, 0, 0, side, side);
  bitmap.close();

  return { blob: await encode(canvas), width: side, height: side };
}
