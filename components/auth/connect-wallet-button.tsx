"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Where a connected user lands: the order book. Not built yet. */
const POST_CONNECT_ROUTE = "/p2p/orders";

/**
 * Seam: stands in for the Freighter connector (`useWallet()`), which is out of
 * scope for the UI rebuild. Resolves after a beat so the pending state — the
 * window where the wallet extension has the user's attention — is honest.
 */
async function mockConnectWallet() {
  await new Promise((resolve) => setTimeout(resolve, 1100));
}

export function ConnectWalletButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    setPending(true);
    try {
      await mockConnectWallet();
      router.push(POST_CONNECT_ROUTE);
    } catch {
      setError("Couldn't reach your wallet. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Button
        size="lg"
        className="w-full"
        onClick={handleConnect}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Waiting for wallet…
          </>
        ) : (
          <>
            <Wallet aria-hidden className="size-4" />
            Connect wallet
          </>
        )}
      </Button>
    </div>
  );
}
