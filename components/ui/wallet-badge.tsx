"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface WalletBadgeProps extends React.ComponentProps<"div"> {
  address: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** The trader's picture. Falls back to the derived badge when absent. */
  src?: string | null;
}

const sizeClasses = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-12 text-sm",
  xl: "size-20 text-2xl",
} as const;

/** Token-based pairs only — the avatar has to survive both themes. */
const badgeColors = [
  "bg-muted text-muted-foreground",
  "bg-primary/15 text-primary",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
] as const;

function hashAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash + address.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return hash;
}

function getInitials(address: string): string {
  const normalized = address.replace(/^0x/i, "").replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length >= 2) return normalized.slice(0, 2).toUpperCase();
  return address.slice(0, 2).toUpperCase();
}

/**
 * A trader's face: their picture if they have set one, otherwise a badge
 * derived from the address — same wallet, same colours, same letters.
 *
 * The fallback is not a placeholder to be replaced later. Most traders will
 * never upload anything, and an address-derived badge is still recognisable
 * between one trade and the next, which is the job.
 */
export function WalletBadge({
  address,
  size = "md",
  src = null,
  className,
  ...props
}: WalletBadgeProps) {
  // A picture can be removed while a page still holds its URL. Falling back
  // beats a broken-image icon where a face should be.
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      data-slot="wallet-badge"
      title={address}
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        sizeClasses[size],
        badgeColors[hashAddress(address) % badgeColors.length],
        className,
      )}
      {...props}
    >
      {showImage ? (
        // The bytes come from our own session-checked route, which next/image
        // cannot optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        getInitials(address)
      )}
    </div>
  );
}
