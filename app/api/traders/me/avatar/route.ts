import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import {
  AVATAR_MAX_BYTES,
  clearAvatar,
  setAvatar,
  type AvatarRefusal,
} from "@/lib/traders/avatar";
import { getTrader } from "@/lib/traders/profile";

const UNAUTHENTICATED = { error: "Not authenticated." };

const REFUSALS: Record<AvatarRefusal, string> = {
  "too-large": `Pictures are limited to ${Math.round(AVATAR_MAX_BYTES / 1024)}KB.`,
  "not-an-image": "That file is not a JPEG, PNG or WebP image.",
};

/**
 * Sets or replaces the signed-in trader's picture.
 *
 * Whose picture is decided by the session, never the body — the same rule as
 * every other write here. Returns the whole profile so the client can replace
 * its cached copy rather than guess at the new URL.
 */
export async function POST(request: NextRequest) {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

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
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: REFUSALS["too-large"] },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await setAvatar(address, bytes);
    if (!result.ok) {
      return NextResponse.json({ error: REFUSALS[result.reason] }, { status: 400 });
    }

    return NextResponse.json(await getTrader(address), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("traders/me/avatar POST failed", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

/** Removes it, falling back to the address-derived badge. */
export async function DELETE() {
  const address = await getSessionAddress();
  if (!address) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  try {
    await clearAvatar(address);
    return NextResponse.json(await getTrader(address), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("traders/me/avatar DELETE failed", error);
    return NextResponse.json({ error: "Could not remove." }, { status: 500 });
  }
}
