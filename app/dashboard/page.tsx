import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { AdsPanel } from "@/components/dashboard/ads-panel";
import { OrdersPanel } from "@/components/dashboard/orders-panel";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your trades and published ads.",
};

export default function DashboardPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Everything you have in flight — trades and the ads that attract
            them.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <OrdersPanel />
          <AdsPanel />
        </div>
      </main>
    </>
  );
}
