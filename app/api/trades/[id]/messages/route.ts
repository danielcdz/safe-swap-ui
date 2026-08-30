import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { listMessages, postMessage, MESSAGE_MAX } from "@/lib/trades/messages";
import {
  addImageMessage,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_PER_TRADE,
  type AttachmentRefusal,
} from "@/lib/trades/attachments";

/** The conversation, for a participant. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getSessionAddress();
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const messages = await listMessages(id, viewer);
    // Not a participant is indistinguishable from not existing.
    if (!messages) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }
    return NextResponse.json(
      { messages },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("messages GET failed", error);
    return NextResponse.json(
      { error: "Could not load messages." },
      { status: 500 },
    );
  }
}

/**
 * Post a message.
 *
 * An image is a kind of message rather than a separate resource, so it posts
 * here too and the body shape says which: multipart carries a file, JSON
 * carries text.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const author = await getSessionAddress();
  if (!author) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  const upload = request.headers
    .get("content-type")
    ?.startsWith("multipart/form-data");

  return upload
    ? postImage(request, id, author)
    : postText(request, id, author);
}

async function postText(request: NextRequest, tradeId: string, author: string) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const raw = (payload as { body?: unknown })?.body;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }

  const body = raw.trim();
  if (!body) {
    return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  }
  if (body.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Messages are limited to ${MESSAGE_MAX} characters.` },
      { status: 400 },
    );
  }

  try {
    const message = await postMessage(tradeId, author, body);
    if (!message) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("messages POST failed", error);
    return NextResponse.json({ error: "Could not send." }, { status: 500 });
  }
}

const MEGABYTES = Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024);

/** A refusal the caller can do something about, and what to tell them. */
const REFUSALS: Record<AttachmentRefusal, { status: number; error: string }> = {
  // Same 404 the rest of the trade uses: a stranger learns nothing.
  "not-participant": { status: 404, error: "Trade not found." },
  "too-large": { status: 400, error: `Images are limited to ${MEGABYTES}MB.` },
  "not-an-image": {
    status: 400,
    error: "That file is not a JPEG, PNG or WebP image.",
  },
  "too-many": {
    status: 400,
    error: `A trade can hold ${ATTACHMENTS_PER_TRADE} images.`,
  },
};

async function postImage(request: NextRequest, tradeId: string, author: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  // Checked before the bytes are read, and again from the bytes themselves.
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: REFUSALS["too-large"].error },
      { status: 400 },
    );
  }

  const raw = form.get("caption");
  const caption = typeof raw === "string" ? raw.trim() : "";
  if (caption.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Captions are limited to ${MESSAGE_MAX} characters.` },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await addImageMessage(tradeId, author, bytes, caption);

    if (!result.ok) {
      const { status, error } = REFUSALS[result.reason];
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json({ message: result.message }, { status: 201 });
  } catch (error) {
    console.error("image message POST failed", error);
    return NextResponse.json({ error: "Could not send." }, { status: 500 });
  }
}
