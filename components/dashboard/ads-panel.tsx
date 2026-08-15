"use client";

import Link from "next/link";
import { Clock, Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { removeAd, useAds } from "@/components/ads/ads-store";
import { bookModeFor } from "@/components/ads/types";
import { MARKET } from "@/components/p2p/types";
import { SIDE_TONE } from "@/components/p2p/side";
import { cn } from "@/lib/utils";
import { formatAsset, formatFiat, formatPrice } from "@/lib/format";
import { Panel, PanelEmpty } from "./panel";

export function AdsPanel() {
  const ads = useAds();

  return (
    <Panel
      title="Ads"
      storageKey="safeswap:dashboard-ads-collapsed"
      trailing={
        <>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
            {ads.length} live
          </span>
          <Link
            href="/p2p/ads/new"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Plus aria-hidden className="size-4" />
            New ad
          </Link>
        </>
      }
    >
      {ads.length > 0 ? (
        <ul className="divide-y divide-border">
          {ads.map((ad) => (
            <li
              key={ad.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
            >
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  SIDE_TONE[ad.side].pill,
                )}
              >
                {SIDE_TONE[ad.side].label}
              </span>

              <div className="flex min-w-40 flex-1 flex-col">
                <span className="text-sm font-semibold tabular-nums">
                  {formatPrice(ad.price)} {MARKET.fiat}
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {formatAsset(ad.totalAmount)} {MARKET.asset}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {formatFiat(ad.limits.min)} – {formatFiat(ad.limits.max)} ·{" "}
                  {ad.paymentMethods.join(", ")}
                </span>
              </div>

              {ad.priceType === "floating" ? (
                <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {(ad.margin ?? 0) >= 0 ? "+" : ""}
                  {ad.margin}% floating
                </span>
              ) : null}

              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Clock aria-hidden className="size-3" />
                {ad.windowMinutes} min
              </span>

              {/* Which tab of the book this ad shows up under — the opposite
                  of your own side, since the book is written from the taker's
                  point of view. */}
              <span className="text-xs text-muted-foreground">
                Listed under {bookModeFor(ad.side) === "buy" ? "Buy" : "Sell"}
              </span>

              <button
                type="button"
                aria-label={`Take down ${SIDE_TONE[ad.side].label} ad at ${formatPrice(ad.price)}`}
                title="Take down"
                onClick={() => removeAd(ad.id)}
                className="grid size-7 cursor-pointer place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <PanelEmpty>
          <p>No ads published. Post one to let others trade with you.</p>
          <Link
            href="/p2p/ads/new"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus aria-hidden className="size-4" />
            Post an ad
          </Link>
        </PanelEmpty>
      )}
    </Panel>
  );
}
