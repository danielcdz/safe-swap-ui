import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { listMessages, postMessage, MESSAGE_MAX } from "@/lib/trades/messages";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const author = await getSessionAddress();
  if (!author) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

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
    const message = await postMessage(id, author, body);
    if (!message) {
      return NextResponse.json({ error: "Trade not found." }, { status: 404 });
    }
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("messages POST failed", error);
    return NextResponse.json({ error: "Could not send." }, { status: 500 });
  }
}
