"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCollapsed } from "@/lib/use-collapsed";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title: string;
  /** localStorage key for this panel's collapse state. */
  storageKey: string;
  /** Sits next to the title — a count, tabs. */
  lead?: React.ReactNode;
  /** Sits left of the collapse toggle — a count, an action. */
  trailing?: React.ReactNode;
  /** Shown in place of `trailing` while collapsed, when the two differ. */
  collapsedTrailing?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Collapsible section shell. Each dashboard panel folds independently and
 * remembers it, so a long orders list can be tucked away without hiding ads.
 */
export function Panel({
  title,
  storageKey,
  lead,
  trailing,
  collapsedTrailing,
  children,
}: PanelProps) {
  const [collapsed, setCollapsed] = useCollapsed(storageKey);
  const bodyId = React.useId();

  return (
    <section
      data-slot="dashboard-panel"
      aria-label={title}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 px-5 py-3",
          !collapsed && "border-b border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {!collapsed ? lead : null}
        </div>

        <div className="flex items-center gap-2">
          {collapsed ? (collapsedTrailing ?? trailing) : trailing}

          <Button
            variant="ghost"
            size="sm"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "Show" : "Hide"}
            {collapsed ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronUp aria-hidden className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

/** Shared empty treatment for panel bodies. */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
