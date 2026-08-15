"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { truncateAddress } from "@/lib/format";
import { useNickname } from "@/components/profile/profile-store";
import { CONNECTED_ADDRESS } from "@/lib/wallet";
import { cn } from "@/lib/utils";

/**
 * The connected-wallet chip and its menu. Disconnecting is the dApp's logout —
 * there is no session beyond the wallet.
 */
export function WalletMenu() {
  const router = useRouter();
  const nickname = useNickname();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Dismiss on any press outside the menu.
  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Per the ARIA menu pattern, opening moves focus into the menu.
  React.useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(CONNECTED_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Seam: the real disconnect clears the connector's session and any cached
   * public key. Until then, leaving for the connect screen is the whole flow.
   */
  function handleDisconnect() {
    setOpen(false);
    router.push("/");
  }

  const items = [
    {
      key: "profile",
      icon: UserRound,
      label: "Profile",
      onSelect: () => {
        setOpen(false);
        router.push("/profile");
      },
      destructive: false,
    },
    {
      key: "dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      onSelect: () => {
        setOpen(false);
        router.push("/dashboard");
      },
      destructive: false,
    },
    {
      key: "copy",
      icon: copied ? Check : Copy,
      label: copied ? "Copied" : "Copy address",
      onSelect: handleCopy,
      destructive: false,
    },
    {
      key: "disconnect",
      icon: LogOut,
      label: "Disconnect",
      onSelect: handleDisconnect,
      destructive: true,
    },
  ];

  function handleItemKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
      return;
    }

    const count = items.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      itemRefs.current[(index + 1) % count]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      itemRefs.current[(index - 1 + count) % count]?.focus();
    }
  }

  return (
    <div ref={containerRef} data-slot="wallet-menu" className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Wallet ${truncateAddress(CONNECTED_ADDRESS)} — open menu`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card py-1 ps-1 pe-2 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden sm:pe-3"
      >
        <WalletBadge
          address={CONNECTED_ADDRESS}
          size="sm"
          className="size-7 text-[10px]"
        />
        <span className="hidden font-mono text-xs sm:inline">
          {truncateAddress(CONNECTED_ADDRESS)}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Wallet"
          className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <WalletBadge
              address={CONNECTED_ADDRESS}
              size="sm"
              className="size-8"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {nickname}
                <span
                  aria-label="Connected"
                  className="size-1.5 shrink-0 rounded-full bg-primary"
                />
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {truncateAddress(CONNECTED_ADDRESS, 6, 6)}
              </span>
            </div>
          </div>

          <div role="separator" className="my-1 h-px bg-border" />

          {items.map(({ key, icon: Icon, label, onSelect, destructive }, index) => (
            <button
              key={key}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role="menuitem"
              type="button"
              onClick={onSelect}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "hover:bg-muted",
              )}
            >
              <Icon
                aria-hidden
                className={cn("size-4", key === "copy" && copied && "text-primary")}
              />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
