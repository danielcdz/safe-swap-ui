"use client";

import * as React from "react";
import { Landmark, Pencil, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  hasAnyPaymentDetail,
  validatePaymentDetails,
  type PaymentDetailsErrors,
} from "@/lib/payment-details";
import { updateProfile, type TraderProfile } from "./profile-store";

/**
 * Where buyers send fiat.
 *
 * A trader who only sells USDC never receives fiat and can leave this empty —
 * but anyone advertising to sell needs it, because a buyer with nowhere to
 * send money cannot complete their side.
 */
export function PaymentDetailsCard({ profile }: { profile: TraderProfile }) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<PaymentDetailsErrors>({});
  const [draft, setDraft] = React.useState({
    sinpePhone: profile.sinpePhone ?? "",
    bankName: profile.bankName ?? "",
    bankAccount: profile.bankAccount ?? "",
  });

  const configured = hasAnyPaymentDetail(profile);

  function startEditing() {
    setDraft({
      sinpePhone: profile.sinpePhone ?? "",
      bankName: profile.bankName ?? "",
      bankAccount: profile.bankAccount ?? "",
    });
    setErrors({});
    setEditing(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    const found = validatePaymentDetails(draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSaving(true);
    const failure = await updateProfile(draft);
    setSaving(false);

    if (failure) {
      setErrors({ form: failure });
      return;
    }
    setEditing(false);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Payment details</h2>
          <p className="text-xs text-muted-foreground">
            Shared only with the counterparty of an active trade, so they can
            pay you. Never shown on the order book.
          </p>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            <Pencil aria-hidden className="size-4" />
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-4">
          <TextField
            label="SINPE Móvil"
            inputMode="tel"
            placeholder="8888-8888"
            value={draft.sinpePhone}
            error={errors.sinpePhone}
            disabled={saving}
            icon={<Smartphone className="size-4" />}
            onChange={(event) =>
              setDraft((d) => ({ ...d, sinpePhone: event.target.value }))
            }
          />

          <TextField
            label="Bank"
            placeholder="BAC Credomatic"
            value={draft.bankName}
            error={errors.bankName}
            disabled={saving}
            icon={<Landmark className="size-4" />}
            onChange={(event) =>
              setDraft((d) => ({ ...d, bankName: event.target.value }))
            }
          />

          <TextField
            label="Account number"
            placeholder="CR00 0000 0000 0000 0000 00"
            value={draft.bankAccount}
            error={errors.bankAccount}
            disabled={saving}
            onChange={(event) =>
              setDraft((d) => ({ ...d, bankAccount: event.target.value }))
            }
          />

          {errors.form ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.form}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} aria-busy={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : configured ? (
        <dl className="flex flex-col gap-2.5 text-sm">
          {profile.sinpePhone ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <Smartphone aria-hidden className="size-4" />
                SINPE Móvil
              </dt>
              <dd className="font-medium tabular-nums">{profile.sinpePhone}</dd>
            </div>
          ) : null}
          {profile.bankName ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <Landmark aria-hidden className="size-4" />
                {profile.bankName}
              </dt>
              <dd className="truncate font-medium tabular-nums">
                {profile.bankAccount}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
          <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>
            No payment details yet. Add at least one before advertising to sell
            USDC — a buyer with nowhere to send money cannot finish the trade.
          </span>
        </p>
      )}
    </section>
  );
}
