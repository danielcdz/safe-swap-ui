import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSessionAddress } from "@/lib/auth/session";
import { getTradeFor } from "@/lib/trades/queries";
import { ManualTradeScreen } from "@/components/trade/manual-trade-screen";

export const metadata: Metadata = {
  title: "Trade",
  description: "An active peer-to-peer trade.",
};

/**
 * A trade, for one of its two participants.
 *
 * The id is a trade id — it used to be an ad id, back when the flow was mocked
 * and the trade existed only in the URL.
 */
export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getSessionAddress();
  if (!viewer) redirect("/");

  const { id } = await params;
  const trade = await getTradeFor(id, viewer);
  // 404 rather than 403 for a trade that is not yours: confirming it exists
  // would leak that two particular wallets are trading.
  if (!trade) notFound();

  return (
    <>
      <AppHeader />
      <ManualTradeScreen initial={trade} />
    </>
  );
}
