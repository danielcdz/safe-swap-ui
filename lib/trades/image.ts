/**
 * Reads an image's real format and dimensions out of its header bytes.
 *
 * The declared `Content-Type` on an upload is a claim by the caller, and a
 * `.png` extension on a text file is one `mv` away — so the mime we store, and
 * the type we later serve it back as, comes from the bytes themselves. SVG
 * never matches any of these signatures, which is how it stays out: it is
 * markup that executes script, not a picture.
 *
 * Dimensions come from the same read. They are stored so the chat bubble can
 * reserve space before the image loads, and the upper bound below also keeps a
 * decompression bomb — a small file that expands to something enormous — from
 * reaching the counterparty's browser.
 */

/** Sane bounds. Below the Postgres integer ceiling and far above any receipt. */
const MAX_EDGE = 20_000;

export interface ImageInfo {
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

/** Start-of-frame markers, which is where JPEG keeps its dimensions. */
const SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

function jpeg(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  // The frame header is not at a fixed offset: EXIF, ICC profiles and comments
  // come first and vary in size, so the segment chain has to be walked.
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];
    // Padding between segments is legal and repeats 0xFF.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // End of image, or the start of entropy-coded scan data we cannot walk.
    if (marker === 0xd9 || marker === 0xda) return null;

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;

    if (SOF.has(marker)) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }

    offset += 2 + length;
  }

  return null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function png(bytes: Uint8Array, view: DataView) {
  if (bytes.length < 24) return null;
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
  // IHDR is required to be the first chunk, so this offset is fixed.
  if (ascii(bytes, 12, 16) !== "IHDR") return null;

  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function webp(bytes: Uint8Array, view: DataView) {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") return null;

  // Each variant keeps its dimensions at a different depth, so the length each
  // one needs is checked against that variant rather than the largest of them.
  switch (ascii(bytes, 12, 16)) {
    // Lossy: dimensions follow the 3-byte sync code, 14 bits each.
    case "VP8 ": {
      if (bytes.length < 30) return null;
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    // Lossless: 14 bits each, packed into one little-endian word, stored -1.
    case "VP8L": {
      if (bytes.length < 25) return null;
      if (bytes[20] !== 0x2f) return null;
      const packed = view.getUint32(21, true);
      return {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }
    // Extended: 24-bit canvas size, also stored -1.
    case "VP8X": {
      if (bytes.length < 30) return null;
      const read = (at: number) =>
        (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + 1;
      return { width: read(24), height: read(27) };
    }
    default:
      return null;
  }
}

/** The format and size of an image, or null if the bytes are not one we take. */
export function inspectImage(bytes: Uint8Array): ImageInfo | null {
  // Enough to read a container's fourcc. Each parser enforces its own floor.
  if (bytes.length < 16) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const candidates = [
    ["image/jpeg", jpeg(bytes)],
    ["image/png", png(bytes, view)],
    ["image/webp", webp(bytes, view)],
  ] as const;

  for (const [mime, size] of candidates) {
    if (!size) continue;
    const { width, height } = size;
    if (width < 1 || height < 1) return null;
    if (width > MAX_EDGE || height > MAX_EDGE) return null;
    return { mime, width, height };
  }

  return null;
}
