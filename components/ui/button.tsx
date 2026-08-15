import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The SafeSwap button. Fully rounded is a brand trait, not a style choice —
 * every variant and size stays `rounded-full`.
 *
 * Two deliberate departures from the original implementation:
 *  - takes `children`, so it can wrap icons (the old `label` prop forced the
 *    theme toggle to hand-roll a native button);
 *  - variants are written against semantic tokens, so they follow the
 *    green-tinted theme instead of the raw zinc/red scales.
 */
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-200 select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-97 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95",
        // The sell side of a trade. Solid, so it reads as a peer of `primary`
        // rather than as the tinted `danger` used for destructive actions.
        sell: "bg-destructive text-white shadow-xs hover:bg-destructive/90 active:bg-destructive/95",
        ghost:
          "border border-solid border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground active:bg-muted/70",
        danger:
          "border border-solid border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/20",
      },
      size: {
        sm: "min-h-[28px] px-3 py-1 text-xs",
        md: "min-h-[34px] px-5 py-1.5 text-sm",
        lg: "min-h-[40px] px-6 py-2 text-base sm:px-7",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
