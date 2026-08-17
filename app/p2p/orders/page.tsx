import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ActivitySummary } from "@/components/p2p/activity-summary";
import { OrderBook } from "@/components/p2p/order-book";
import { MARKET } from "@/components/p2p/types";

export const metadata: Metadata = {
  title: "Orders",
  description: `Buy and sell ${MARKET.asset} peer-to-peer, wallet to wallet.`,
};

export default function OrdersPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {MARKET.asset} order book
          </h1>
          <p className="text-sm text-muted-foreground">
            Trade directly with another wallet. Transfers are manual for now —
            SafeSwap does not hold your {MARKET.asset}.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <ActivitySummary />
          <OrderBook />
        </div>
      </main>
    </>
  );
}
