import Link from "next/link";
import { Plus } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WalletMenu } from "@/components/wallet/wallet-menu";

/**
 * Top bar for the application screens.
 */
export function AppHeader() {
  return (
    <header
      data-slot="app-header"
      className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur"
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link
            href="/p2p/orders"
            aria-label="SafeSwap — order book"
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
          >
            <Wordmark />
          </Link>
          <AppNav />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/p2p/ads/new"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">Post ad</span>
          </Link>
          <WalletMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
