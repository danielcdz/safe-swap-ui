import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MOCK_ORDERS } from "@/components/p2p/mock-orders";
import { TradeScreen } from "@/components/trade/trade-screen";
import { buildTrade } from "@/components/trade/build-trade";

export const metadata: Metadata = {
  title: "Trade",
  description: "Active escrow-secured trade.",
};

/**
 * The amount and payment method are chosen in the order book and travel here
 * as search params — there is no backend to create the order against yet, so
 * the URL is what carries the trade.
 */
export default async function TradePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ amount?: string; method?: string }>;
}) {
  const { id } = await params;
  const { amount, method } = await searchParams;

  const order = MOCK_ORDERS.find((candidate) => candidate.id === id);
  if (!order) notFound();

  const trade = buildTrade(order, Number(amount), method);

  return (
    <>
      <AppHeader />
      <TradeScreen trade={trade} />
    </>
  );
}
