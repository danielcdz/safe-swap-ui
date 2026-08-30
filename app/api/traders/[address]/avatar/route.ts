import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { readAvatar } from "@/lib/traders/avatar";
import { isStellarAddress } from "@/lib/wallet";

/**
 * A trader's picture.
 *
 * Any signed-in trader may fetch any other's — a face is only worth having if
 * the counterparty can see it. What this deliberately is *not* is public: the
 * bucket is private and this route checks the session, so a picture cannot be
 * pulled off a guessable URL and tied to a wallet address by a stranger.
 *
 * The URL carries a version token so that replacing a picture hands every
 * client a *different* URL — which is what makes the long cache safe, rather
 * than any promise about this one. The token is not checked: a stale URL
 * serves the current picture, which beats a broken image on a page that was
 * open when the owner changed it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const viewer = await getSessionAddress();
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { address } = await params;
  if (!isStellarAddress(address)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const avatar = await readAvatar(address);
    if (!avatar) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return new NextResponse(avatar.bytes, {
      headers: {
        "content-type": avatar.mime,
        "content-length": String(avatar.bytes.byteLength),
        "cache-control": "private, max-age=31536000, immutable",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("avatar GET failed", error);
    return NextResponse.json(
      { error: "Could not load the picture." },
      { status: 500 },
    );
  }
}
