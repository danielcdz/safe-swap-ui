import { cn } from "@/lib/utils";
import type { EscrowStatus } from "./types";

const STATUS = {
  pending: { label: "Awaiting payment", className: "border-warning/30 bg-warning/10 text-warning" },
  funded: { label: "Payment sent", className: "border-info/30 bg-info/10 text-info" },
  disputed: {
    label: "In dispute",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  released: { label: "Released", className: "border-success/30 bg-success/10 text-success" },
  cancelled: {
    label: "Cancelled",
    className: "border-border bg-muted text-muted-foreground",
  },
} as const satisfies Record<EscrowStatus, { label: string; className: string }>;

export function EscrowStatusBadge({
  status,
  className,
}: {
  status: EscrowStatus;
  className?: string;
}) {
  const { label, className: tone } = STATUS[status];
  return (
    <span
      data-slot="escrow-status-badge"
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
