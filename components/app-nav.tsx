"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/p2p/orders", label: "Market" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {ITEMS.map(({ href, label }) => {
        // Prefix match so a trade or the ad form keeps its section lit.
        const active =
          pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden",
              active
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
