import * as React from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Persistent frame around every screen.
 *
 * Currently it only carries the theme toggle. The bottom navigation (and the
 * `pb-16` content padding it needs, suppressed on `/`) lands here once the
 * application screens exist — at which point the toggle moves to `bottom-20`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="app-shell" className="flex min-h-full flex-1 flex-col">
      {children}
      <ThemeToggle className="fixed right-4 bottom-4 z-50" />
    </div>
  );
}
