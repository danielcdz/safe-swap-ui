import * as React from "react";

/**
 * Persistent frame around every screen. Application screens bring their own
 * `AppHeader`; the connect screen runs chrome-free. This stays as the seam for
 * anything that has to sit outside the page — a toast region, a nav rail.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="app-shell" className="flex min-h-full flex-1 flex-col">
      {children}
    </div>
  );
}
