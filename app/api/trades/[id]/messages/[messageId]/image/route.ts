import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { readImageMessage } from "@/lib/trades/attachments";

/**
 * The bytes behind an image message.
 *
 * A proxy rather than a signed URL. A signed URL works for whoever holds it,
 * cookie or not, until it expires — and a bank receipt sitting behind a link
 * that outlives the session check is the leak this whole feature has to avoid.
 * This URL re-checks the session on every request instead.
 *
 * Being stable also makes it cacheable: the bytes behind a message id never
 * change, so each browser fetches a given image exactly once. A freshly signed
 * URL on every 3s poll would miss the CDN cache every time.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const viewer = await getSessionAddress();
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id, messageId } = await params;

  try {
    const image = await readImageMessage(id, messageId, viewer);
    if (!image) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return new NextResponse(image.bytes, {
      headers: {
        "content-type": image.mime,
        "content-length": String(image.bytes.byteLength),
        // Private: the response is scoped to one session. Immutable: the bytes
        // behind a message id never change.
        "cache-control": "private, max-age=31536000, immutable",
        "content-disposition": "inline",
        // The mime came from the bytes, not the uploader — but say so anyway.
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("attachment GET failed", error);
    return NextResponse.json(
      { error: "Could not load the image." },
      { status: 500 },
    );
  }
}
