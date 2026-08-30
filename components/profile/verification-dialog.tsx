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
  requestVerification,
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
  const [busy, setBusy] = React.useState<MethodId | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Records the request and stops there.
   *
   * Seam: completing a check is the provider's job — an email round trip, an
   * SMS code, a document review. None of them are wired up, so a requested
   * method stays `pending`. It does not fake its way to verified: the badge is
   * what other traders read as "someone checked this person", and the app has
   * checked nothing.
   */
  async function startVerification(id: MethodId) {
    setBusy(id);
    setError(null);
    setError((await requestVerification(id)) ?? null);
    setBusy(null);
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
      {error ? (
        <p role="alert" className="mb-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <p className="mb-3 text-xs text-muted-foreground">
        Your wallet is already proven — signing in is the proof. The rest
        arrive with their providers in a later release; nothing here can grant
        a badge before then.
      </p>

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
                  {method.soon ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Soon
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
                  Requested
                </span>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0"
                  // Nothing on the other side of the request yet. A working
                  // button here would put the trader in `pending` for a check
                  // nobody is going to carry out.
                  disabled={!method.requestable || method.soon || busy !== null}
                  aria-busy={busy === method.id}
                  onClick={() => startVerification(method.id)}
                >
                  {method.soon
                    ? "Soon"
                    : busy === method.id
                      ? "Requesting…"
                      : "Verify"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
