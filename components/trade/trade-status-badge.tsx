import { cn } from "@/lib/utils";
import type { TradeStatus } from "./types";

/**
 * A manual trade's state, in its own words.
 *
 * Distinct from EscrowStatusBadge, which speaks the contract's five states.
 * Collapsing these seven onto those five would lose exactly the distinctions a
 * trader is watching for — whether the money has moved, and whose turn it is.
 */
const STATUS = {
  open: {
    label: "Awaiting payment",
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  fiat_sent: {
    label: "Payment sent",
    className: "border-info/30 bg-info/10 text-info",
  },
  fiat_confirmed: {
    label: "Payment confirmed",
    className: "border-info/30 bg-info/10 text-info",
  },
  asset_sent: {
    label: "USDC sent",
    className: "border-info/30 bg-info/10 text-info",
  },
  completed: {
    label: "Completed",
    className: "border-success/30 bg-success/10 text-success",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  disputed: {
    label: "In dispute",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
} as const satisfies Record<TradeStatus, { label: string; className: string }>;

export function TradeStatusBadge({
  status,
  className,
}: {
  status: TradeStatus;
  className?: string;
}) {
  const tone = STATUS[status] ?? STATUS.open;
  return (
    <span
      data-slot="trade-status-badge"
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tone.className,
        className,
      )}
    >
      {tone.label}
    </span>
  );
}
