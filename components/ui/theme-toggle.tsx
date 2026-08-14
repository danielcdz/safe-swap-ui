"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Icon toggle that flips between the light and dark brand themes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  // Hydration-safe "mounted" flag: server snapshot is false, client is true.
  // Avoids a setState-in-effect while still deferring theme-dependent output
  // until after hydration.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("bg-card text-foreground shadow-lg", className)}
    >
      {mounted && isDark ? (
        <Sun className="size-5" />
      ) : (
        <Moon className={cn("size-5", !mounted && "opacity-0")} />
      )}
    </Button>
  );
}
