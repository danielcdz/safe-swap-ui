"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, TriangleAlert, Wallet } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/wallet-provider";
import { EXPECTED_NETWORK } from "@/lib/wallet";
import { cn } from "@/lib/utils";

/** Where a connected user lands: the order book. */
const POST_CONNECT_ROUTE = "/p2p/orders";

export function ConnectWalletButton() {
  const router = useRouter();
  const { address, connecting, error, ready, wrongNetwork, network, connect } =
    useWallet();

  // A restored session should not strand the user on the connect screen.
  React.useEffect(() => {
    if (address && !wrongNetwork) router.replace(POST_CONNECT_ROUTE);
  }, [address, wrongNetwork, router]);

  const notInstalled = error?.code === "not-installed";

  return (
    <div className="flex w-full flex-col gap-3">
      {wrongNetwork ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-start text-xs text-warning"
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            Freighter is on {network}. Switch it to {EXPECTED_NETWORK.label} to
            continue.
          </span>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-start text-xs text-destructive"
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : null}

      {notInstalled ? (
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          <Download aria-hidden className="size-4" />
          Install Freighter
        </a>
      ) : (
        <Button
          size="lg"
          className="w-full"
          onClick={connect}
          // `ready` gates the button until the silent restore has settled, so
          // a returning user never sees "Connect" flash before their session.
          disabled={connecting || !ready}
          aria-busy={connecting}
        >
          {connecting ? (
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
      )}
    </div>
  );
}
