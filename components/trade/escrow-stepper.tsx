import { Check, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESCROW_STEPS, type EscrowStepStatus } from "./types";

interface Step {
  readonly label: string;
  readonly description: string;
}

const DOT = {
  completed: "bg-primary text-primary-foreground",
  current: "bg-primary/15 text-primary ring-2 ring-primary/30",
  pending: "border border-border bg-card text-muted-foreground",
  disputed: "bg-destructive/15 text-destructive ring-2 ring-destructive/30",
} as const satisfies Record<EscrowStepStatus, string>;

const SR_LABEL = {
  completed: "Completed",
  current: "In progress",
  pending: "Not started",
  disputed: "Disputed",
} as const satisfies Record<EscrowStepStatus, string>;

function statusOf(
  index: number,
  stage: number,
  disputed: boolean,
  halted: boolean,
): EscrowStepStatus {
  if (index < stage) return "completed";
  if (index === stage) {
    if (disputed) return "disputed";
    // A cancelled lifecycle has no step in progress — nothing is spinning.
    return halted ? "pending" : "current";
  }
  return "pending";
}

/**
 * Vertical timeline of the escrow lifecycle. The connecting rail turns primary
 * behind every step that has completed, so progress reads at a glance.
 */
export function EscrowStepper({
  stage,
  disputed = false,
  halted = false,
  steps = ESCROW_STEPS,
}: {
  stage: number;
  disputed?: boolean;
  /** Lifecycle stopped short — cancelled rather than in progress. */
  halted?: boolean;
  /**
   * Defaults to the escrow lifecycle. The manual settlement flow passes its
   * own steps; the escrow ones stay for when escrow returns.
   */
  steps?: readonly Step[];
}) {
  return (
    <ol data-slot="escrow-stepper" className="flex flex-col">
      {steps.map((step, index) => {
        const status = statusOf(index, stage, disputed, halted);
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.label}
            aria-current={status === "current" ? "step" : undefined}
            className={cn("relative flex gap-3.5", !isLast && "pb-5")}
          >
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 left-[15px] h-[calc(100%-1.75rem)] w-px",
                  index < stage ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}

            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                DOT[status],
              )}
            >
              {status === "completed" ? (
                <Check className="size-4" />
              ) : status === "current" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : status === "disputed" ? (
                <TriangleAlert className="size-4" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>

            <div className="flex flex-col gap-0.5 pt-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  status === "pending" && "text-muted-foreground",
                )}
              >
                {step.label}
                <span className="sr-only"> — {SR_LABEL[status]}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {step.description}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
