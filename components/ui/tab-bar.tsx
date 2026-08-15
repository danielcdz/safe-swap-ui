"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabBarProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** `sm` fits inside a section header; `md` stands alone. */
  size?: "sm" | "md";
  /** Tone of the selected tab — lets a buy/sell switch carry its side colour. */
  activeTone?: "primary" | "destructive";
}

const toneClasses = {
  primary: "bg-primary/15 font-medium text-primary",
  destructive: "bg-destructive/15 font-medium text-destructive",
} as const;

const sizeClasses = {
  sm: "px-3.5 py-1 text-xs",
  md: "px-6 py-2 text-sm",
} as const;

/** Pill segmented control with a full roving tabindex. */
export function TabBar({
  tabs,
  activeIndex,
  onChange,
  size = "md",
  activeTone = "primary",
  className,
  ...props
}: TabBarProps) {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    onChange(next);
    tabRefs.current[next]?.focus();
  }

  if (tabs.length === 0) return null;

  return (
    <div
      data-slot="tab-bar"
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/5 p-1",
        className,
      )}
      {...props}
    >
      {tabs.map((label, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={label}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            data-slot="tab-bar-tab"
            data-state={isActive ? "active" : "inactive"}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "cursor-pointer rounded-full whitespace-nowrap transition-colors",
              sizeClasses[size],
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:outline-hidden",
              isActive
                ? toneClasses[activeTone]
                : "font-normal text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
