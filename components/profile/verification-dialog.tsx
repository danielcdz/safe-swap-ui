"use client";

import * as React from "react";
import {
  BadgeCheck,
  IdCard,
  Loader2,
  Mail,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  setMethodStatus,
  useVerification,
  VERIFICATION_METHODS,
  verifiedCount,
  type MethodId,
} from "./verification";

const ICONS: Record<MethodId, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  email: Mail,
  phone: Smartphone,
  id: IdCard,
};

export function VerificationDialog({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const statuses = useVerification();
  const done = verifiedCount(statuses);

  /**
   * Seam: each of these opens the provider's flow — an email round trip, an
   * SMS code, a document upload and review. Mocked as submit-then-approve so
   * the pending state is reachable.
   */
  function startVerification(id: MethodId) {
    setMethodStatus(id, "pending");
    setTimeout(() => setMethodStatus(id, "verified"), 1600);
  }

  return (
    <Dialog
      open={open}
      onDismiss={onDismiss}
      title="Verify your account"
      description={`${done} of ${VERIFICATION_METHODS.length} complete. Each step raises what counterparties can see about you — and the government ID check raises your order limits.`}
      className="max-w-lg"
      footer={
        <Button variant="ghost" onClick={onDismiss}>
          Close
        </Button>
      }
    >
      <ul className="flex flex-col gap-2">
        {VERIFICATION_METHODS.map((method) => {
          const status = statuses[method.id];
          const Icon = ICONS[method.id];

          return (
            <li
              key={method.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  status === "verified"
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {method.label}
                  {method.grantsBadge ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary uppercase">
                      Badge
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {method.description}
                </span>
              </div>

              {status === "verified" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  <BadgeCheck aria-hidden className="size-3.5" />
                  Verified
                </span>
              ) : status === "pending" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  In review
                </span>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => startVerification(method.id)}
                >
                  Verify
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
