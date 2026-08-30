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
const QUALITY = 0.85;

export interface Downscaled {
  blob: Blob;
  width: number;
  height: number;
}

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, QUALITY),
  );

export async function downscaleImage(file: File): Promise<Downscaled> {
  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the EXIF orientation tag. Without it a photo taken
    // sideways re-encodes sideways: the tag was what held it upright, and
    // re-encoding is precisely what throws the tag away.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image could not be read. Try a JPEG, PNG or WebP.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("That image could not be processed.");

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // WebP holds screenshot text better than JPEG at the same size, and a
  // receipt is mostly text. `toBlob` falls back to PNG where it is unsupported,
  // which is why the result is checked rather than assumed.
  const webp = await encode(canvas, "image/webp");
  const blob =
    webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg");

  if (!blob) throw new Error("That image could not be processed.");

  return { blob, width, height };
}
