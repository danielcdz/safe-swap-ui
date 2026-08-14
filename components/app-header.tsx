import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WalletMenu } from "@/components/wallet/wallet-menu";

/**
 * Top bar for the application screens. Navigation items land here as the
 * other screens are built — for now the wordmark is the only route.
 */
export function AppHeader() {
  return (
    <header
      data-slot="app-header"
      className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur"
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/p2p/orders"
          aria-label="SafeSwap — order book"
          className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
        >
          <Wordmark />
        </Link>

        <div className="flex items-center gap-3">
          <WalletMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
