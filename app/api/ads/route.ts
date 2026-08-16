import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress } from "@/lib/auth/session";
import { createAd, listBook, type AdDraft } from "@/lib/ads/queries";
import { isPaymentMethod } from "@/lib/payment-methods";

/**
 * The order book.
 *
 * Readable without a session — browsing offers is public. When there *is* a
 * session, the caller's own ads are filtered out: you cannot trade with
 * yourself, and a row you can never act on is noise.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") === "sell" ? "sell" : "buy";
  const paymentMethod = request.nextUrl.searchParams.get("paymentMethod");

  try {
    const viewer = await getSessionAddress();
    const orders = await listBook({
      mode,
      excludeAdvertiser: viewer,
      paymentMethod,
    });
    return NextResponse.json(
      { orders },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("ads GET failed", error);
    return NextResponse.json(
      { error: "Could not load the order book." },
      { status: 500 },
    );
  }
}

/** Publishes an ad for the signed-in trader. */
export async function POST(request: NextRequest) {
  const advertiser = await getSessionAddress();
  if (!advertiser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const draft = parseDraft(body);
  if (typeof draft === "string") {
    return NextResponse.json({ error: draft }, { status: 400 });
  }

  try {
    const ad = await createAd(advertiser, draft);
    return NextResponse.json({ ad }, { status: 201 });
  } catch (error) {
    // The database enforces the real invariants — the limit clamp, the
    // margin/price-type pairing. Surface a violation as a 400, not a 500.
    const message = error instanceof Error ? error.message : "Could not publish.";
    const isConstraint = /violates check constraint|violates/i.test(message);
    console.error("ads POST failed", error);
    return NextResponse.json(
      { error: isConstraint ? "Those ad terms are not valid." : "Could not publish." },
      { status: isConstraint ? 400 : 500 },
    );
  }
}

/** Returns a draft, or a message explaining what is wrong. */
function parseDraft(body: unknown): AdDraft | string {
  const b = (body ?? {}) as Record<string, unknown>;

  const side = b.side;
  if (side !== "buy" && side !== "sell") return "side must be buy or sell.";

  const priceType = b.priceType;
  if (priceType !== "fixed" && priceType !== "floating") {
    return "priceType must be fixed or floating.";
  }

  const numbers = {
    price: b.price,
    totalAmount: b.totalAmount,
    minLimit: b.minLimit,
    maxLimit: b.maxLimit,
    windowMinutes: b.windowMinutes,
  };
  for (const [key, value] of Object.entries(numbers)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return `${key} must be a positive number.`;
    }
  }

  const methods = b.paymentMethods;
  if (
    !Array.isArray(methods) ||
    methods.length === 0 ||
    !methods.every((m) => typeof m === "string" && isPaymentMethod(m))
  ) {
    return "paymentMethods must be a non-empty list of supported methods.";
  }

  const margin = priceType === "floating" ? Number(b.margin ?? 0) : null;
  if (priceType === "floating" && !Number.isFinite(margin as number)) {
    return "margin must be a number for a floating ad.";
  }

  return {
    side,
    priceType,
    price: numbers.price as number,
    margin,
    totalAmount: numbers.totalAmount as number,
    minLimit: numbers.minLimit as number,
    maxLimit: numbers.maxLimit as number,
    windowMinutes: numbers.windowMinutes as number,
    paymentMethods: methods as string[],
    terms: typeof b.terms === "string" ? b.terms.trim() : "",
    autoReply:
      typeof b.autoReply === "string" && b.autoReply.trim()
        ? b.autoReply.trim()
        : null,
  };
}
