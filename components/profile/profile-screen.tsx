"use client";

import * as React from "react";
import {
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { WalletBadge } from "@/components/ui/wallet-badge";
import { MARKET } from "@/components/p2p/types";
import { formatAsset, joinedLabel, truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/wallet/wallet-provider";
import {
  removeAvatar,
  updateAvatar,
  updateNickname,
  useProfile,
} from "./profile-store";
import { AvatarDialog } from "./avatar-dialog";
import { useTraderStats } from "./stats-store";
import { validateNickname } from "@/lib/nickname";
import { VerificationDialog } from "./verification-dialog";
import {
  isVerified,
  useVerification,
  VERIFICATION_METHODS,
  verifiedCount,
} from "./verification";

function Metric({
  label,
  value,
  unit,
  hint,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        {icon}
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

export function ProfileScreen() {
  const profile = useProfile();
  const stats = useTraderStats();
  const { address } = useWallet();
  const statuses = useVerification();
  const verified = isVerified(statuses);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const nickname = profile?.nickname ?? null;
  const draftError = validateNickname(draft) ?? saveError;

  // Focusing is not state, so it is safe to do from an effect.
  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    setDraft(nickname ?? "");
    setSaveError(undefined);
    setEditing(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (validateNickname(draft)) return;

    setSaving(true);
    // The server decides. Writing optimistically and reverting would be worse
    // than a moment of latency on a name other traders will see.
    const failure = await updateNickname(draft.trim());
    setSaving(false);

    if (failure) {
      setSaveError(failure);
      return;
    }
    setEditing(false);
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // A profile is an identity, and identity here is the wallet. Without one
  // there is nothing to show — every hook above has already run.
  if (!address) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Connect a wallet to see your profile.
          </p>
          <Link href="/" className={buttonVariants({ size: "sm" })}>
            Connect wallet
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      {/* Identity */}
      <section className="flex flex-col items-start gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAvatarOpen(true)}
            disabled={!profile}
            aria-label="Change your profile picture"
            className="group relative block cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden disabled:pointer-events-none"
          >
            <WalletBadge
              address={address}
              size="xl"
              src={profile?.avatarUrl}
            />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera aria-hidden className="size-6 text-white" />
            </span>
          </button>
          <span
            aria-hidden
            className="pointer-events-none absolute -end-1 -bottom-1 size-5 rounded-full bg-primary ring-4 ring-card"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {editing ? (
            <form onSubmit={save} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  maxLength={20}
                  aria-label="Nickname"
                  aria-invalid={draftError ? true : undefined}
                  aria-describedby={draftError ? "nickname-error" : undefined}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setSaveError(undefined);
                  }}
                  disabled={saving}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditing(false);
                  }}
                  className={cn(
                    "w-full max-w-64 rounded-full bg-primary/5 px-4 py-1.5 text-lg font-semibold outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    draftError && "ring-1 ring-destructive/45 ring-inset",
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={Boolean(validateNickname(draft)) || saving}
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                >
                  <X aria-hidden className="size-4" />
                  Cancel
                </Button>
              </div>
              {draftError ? (
                <p
                  id="nickname-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {draftError}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {nickname ?? truncateAddress(address)}
              </h1>
              {verified ? (
                <BadgeCheck
                  className="size-5 shrink-0 text-primary"
                  aria-label="Verified trader"
                />
              ) : null}
              <button
                type="button"
                onClick={startEditing}
                disabled={!profile}
                aria-label="Edit nickname"
                title="Edit nickname"
                className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
              >
                <Pencil aria-hidden className="size-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={copyAddress}
            title={address}
            aria-label="Copy your wallet address"
            className="group inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-hidden"
          >
            <span className="font-mono">
              {truncateAddress(address, 6, 6)}
            </span>
            {copied ? (
              <Check aria-hidden className="size-3.5 text-primary" />
            ) : (
              <Copy
                aria-hidden
                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            )}
          </button>

          <span className="text-xs text-muted-foreground">
            Trading since {profile ? joinedLabel(profile.joinedAt) : "—"}
          </span>
        </div>

        <Button
          variant={verified ? "ghost" : "primary"}
          size="sm"
          className={cn(
            "shrink-0",
            verified && "border-success/30 bg-success/10 text-success hover:bg-success/15",
          )}
          onClick={() => setVerifyOpen(true)}
        >
          {verified ? (
            <>
              <BadgeCheck aria-hidden className="size-4" />
              Verified
            </>
          ) : (
            <>
              <ShieldCheck aria-hidden className="size-4" />
              Get verified · {verifiedCount(statuses)}/
              {VERIFICATION_METHODS.length}
            </>
          )}
        </Button>
      </section>

      {/* Record — every figure is computed from this trader's own trades by
          the `trader_stats` view, on read. Someone who has never traded sees
          zeroes, with the hint saying why: a bare 0% completion would read as
          having failed everything rather than as having done nothing.

          There is no Rating tile. Reviews are thumbs up/down, so there is no
          rating to compute, and deriving stars from the feedback percentage
          would be inventing a number. Positive feedback is the real measure. */}
      <h2 className="mt-8 mb-3 text-sm font-semibold">Trading record</h2>
      <section
        aria-label="Trading record"
        className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
      >
        <Metric
          label="Trades"
          value={String(stats.totalTrades)}
          hint="Completed all-time"
        />
        <Metric
          label="Completion"
          value={(stats.completionRate ?? 0).toFixed(1)}
          unit="%"
          hint={
            stats.completionRate === null
              ? "No closed trades yet"
              : "Orders taken that settled"
          }
        />
        <Metric
          label="Avg. release"
          value={String(stats.avgReleaseMinutes ?? 0)}
          unit="min"
          hint={
            stats.avgReleaseMinutes === null
              ? "No completed trades yet"
              : "From payment to release"
          }
        />
        <Metric
          label="30-day volume"
          value={formatAsset(stats.volume30d)}
          unit={MARKET.asset}
        />
        <Metric
          label="All-time volume"
          value={formatAsset(stats.volumeAllTime)}
          unit={MARKET.asset}
        />
        <Metric
          label="Positive feedback"
          value={(stats.positiveFeedback ?? 0).toFixed(1)}
          unit="%"
          hint={
            stats.reviewCount === 0
              ? "No reviews yet"
              : `Across ${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"}`
          }
        />
      </section>

      {avatarOpen ? (
        <AvatarDialog
          address={address}
          currentUrl={profile?.avatarUrl ?? null}
          onSave={updateAvatar}
          onRemove={removeAvatar}
          onDismiss={() => setAvatarOpen(false)}
        />
      ) : null}

      <VerificationDialog
        open={verifyOpen}
        onDismiss={() => setVerifyOpen(false)}
      />
    </main>
  );
}
