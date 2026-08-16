# SafeSwap — database

What exists in Supabase, and why it is shaped this way. Companion to
[`UI-REBUILD-SPEC.md`](./UI-REBUILD-SPEC.md) (the frontend) and
[`SUPABASE-SETUP.md`](./SUPABASE-SETUP.md) (connecting the MCP server).

Where this document and the database disagree, the database wins — say so and
fix the document.

---

## 0. Current state

| | |
|---|---|
| Project ref | `wxgwzrlkdajxtplnixfd` |
| API URL | `https://wxgwzrlkdajxtplnixfd.supabase.co` |
| Postgres | 17.6 |
| Applied | 2026-08-15 |
| Tables | 6, all with RLS enabled |
| Rows | **0 — nothing is seeded** |
| App wiring | **none yet** — the UI still reads its mock files |

Migrations, matching `supabase/migrations/` by filename:

| Version | Name |
|---|---|
| `20260815222826` | `initial_schema` |
| `20260815222905` | `harden_touch_updated_at_search_path` |

> **Filenames must match applied versions.** They diverged once already,
> because the repo files were written before the migrations were applied and
> the timestamps were guesses. If they drift, a `supabase db push` will try to
> re-apply work that is already live.

---

## 1. The idea everything hangs off

**Identity is the Stellar wallet address.** There is no `users` table, no
surrogate `id`, and no Supabase Auth row. `traders.address` is the primary key
and every other table references it by that 56-character key.

That single decision explains most of what follows: the address format CHECK,
the absence of RLS policies, and why access runs through the server.

It also means **an address is only trustworthy once it has been verified** —
the server must derive the actor from a signed session, never from a request
body. See [`WALLET-AUTH.md`](./WALLET-AUTH.md).

---

## 2. Shape

```
traders ──┬──< trader_verifications     (one row per method)
          │
          ├──< ads ──< trades ──┬──< trade_messages
          │                     └──< trade_reviews
          │
          └── also referenced as maker, taker, author, reviewer, subject

trader_stats (view) = traders ⋈ trades ⋈ trade_reviews
```

| Table | Cols | CHECKs | FKs | Holds |
|---|---|---|---|---|
| `traders` | 5 | 2 | 0 | Identity only — address, nickname, joined_at |
| `trader_verifications` | 5 | 0 | 1 | One row per trader per method |
| `ads` | 16 | 8 | 1 | Standing terms that fill the order book |
| `trades` | 16 | 5 | 3 | A specific agreement, moving through escrow |
| `trade_messages` | 6 | 2 | 2 | Chat, with escrow events in the same stream |
| `trade_reviews` | 6 | 1 | 3 | One review per counterparty per trade |

`trader_stats` is a **view**, not columns: total trades, completion rate,
average release minutes, positive feedback, and 30-day volume, all computed
from trades on read. Cached columns drift from the trades that produced them;
a view cannot. Swap for a materialized view if the read cost ever shows up.

### Enums

| Type | Values |
|---|---|
| `ad_side` | `buy`, `sell` |
| `ad_status` | `active`, `paused`, `closed` |
| `price_type` | `fixed`, `floating` |
| `escrow_status` | `pending`, `funded`, `disputed`, `released`, `cancelled` |
| `message_kind` | `text`, `system` |
| `verify_method` | `wallet`, `email`, `phone`, `id` |
| `verify_status` | `unverified`, `pending`, `verified` |

`escrow_status` matches the UI's `EscrowStatus` exactly, `cancelled` included.
`ad_side` is the **advertiser's** side — the book shows the opposite, see
[the inversion note](./UI-REBUILD-SPEC.md#53-an-ads-side-is-the-inverse-of-its-book-tab).

---

## 3. Decisions worth not re-litigating

### Trades copy from ads on purpose

`trades` duplicates price, amounts, and payment method rather than joining to
`ads`. That is deliberate: an ad is edited and taken down constantly, and a
trade has to stay a faithful record of what was agreed at the time. Joining
would silently reprice yesterday's trade when the advertiser changes their
mind.

### Deletes protect money, not conversation

| Relationship | On delete | Why |
|---|---|---|
| trader → ads | `cascade` | An ad is an offer; it dies with its author |
| ad → trades | `restrict` | An ad with trades against it cannot be deleted |
| trader → trades | `restrict` | A trader who has traded cannot be deleted |
| trade → messages, reviews | `cascade` | Conversation belongs to its trade |
| message → author | `set null` | The message survives; the byline goes |

### Rules live in the database, not only the app

The app is one of several things that will eventually write here, so the
invariants are constraints:

- **`max_limit <= total_amount * price`** — the clamp. The UI enforces it in
  the ad wizard and the trade panel; this makes it hold regardless of client.
- **A floating ad must carry a margin; a fixed one must not.** No stale values.
- **A terminal trade must have `settled_at`, and only a terminal trade may.**
- **A system message has no author; a text message must have one.**
- **`address ~ '^G[A-Z2-7]{55}$'`** — a *shape* check. A real Stellar address
  also carries a CRC16 checksum, which only validation at signing time proves.

---

## 4. Security posture

**RLS is enabled on all six tables with zero policies.** This is a deny-all,
not an unfinished job.

Because identity is a wallet, `auth.uid()` is always null and a policy has
nothing to match on. Access runs through the Next.js server using a **secret
key** (`sb_secret_…`), which bypasses RLS.

Secret keys replace the legacy `service_role` JWT, which is deprecated at the
end of 2026. Both bypass RLS through the same Postgres role, but a secret key
can be rotated and revoked on its own, and Supabase rejects it outright when
sent from a browser — so a leak into client code fails loudly rather than
quietly working.

The advisor therefore reports **six `rls_enabled_no_policy` INFO lints, and
they are expected.** Do not "fix" them by dropping RLS.

If the browser is ever given direct access, the move is: mint a JWT signed
with the project's JWT secret carrying the wallet address, then add policies
reading `auth.jwt() ->> 'wallet_address'`.

`touch_updated_at` has `search_path` pinned to empty. A function with a
mutable search_path can be hijacked by a caller pointing it at their own
schema. That was the only WARN and it is cleared.

---

## 5. Gotchas that already cost time

- **Three fixture wallet addresses were 55 characters.** Stellar keys are 56.
  They came verbatim from the old source repo and were never valid; the
  address CHECK caught them on first contact. Fixed in
  `components/p2p/mock-orders.ts` — if you add fixtures, they must match the
  regex or inserts will fail.
- **`apply_migration` can return a Cloudflare 502.** It is retryable, but
  **check state before retrying** (`list_migrations`, count tables/enums)
  rather than re-running blind. The failed attempt rolled back cleanly; a
  blind retry against a partial apply would not have.
- **`pgcrypto` is not needed.** `gen_random_uuid()` is core from Postgres 13.
- **`rls_auto_enable`** already exists in `public` — a Supabase event trigger,
  not ours.
- **The Data API has to be on.** `supabase-js` speaks PostgREST, so with the
  Data API disabled every query fails as `PGRST002` while the database itself
  is perfectly healthy — MCP keeps working, which makes it look like a key
  problem. The postgrest logs name it outright:
  `db-schemas=pg_pgrst_no_exposed_schemas`. Enabling it costs nothing
  security-wise: RLS with no policies still denies everyone without the secret
  key. Going the other way — Data API off, direct Postgres via an ORM — means
  dropping supabase-js.

---

## 6. Not built yet

- **Seed data.** Every table is empty. The fixtures in
  `components/p2p/mock-orders.ts` and `components/profile/mock-profile.ts` are
  the obvious source.
- **App wiring.** Nothing in the app talks to Supabase. The four seams are
  `components/p2p/mock-orders.ts`, `components/trade/open-orders-store.ts`,
  `components/ads/ads-store.ts`, and `components/profile/mock-profile.ts`.
- **No payment-methods table** — they are a `text[]` on `ads`, GIN-indexed for
  filtering. Promote to a table if they need metadata.
- **No auth, storage, or Realtime.** Realtime is the plausible next one, for
  chat and escrow status; note it would need the JWT approach in §4.
- **Escrow/chain state.** `trades.escrow_contract_id` is the only slot for it.
  Trustless Work calls, XDR signing and Horizon polling are long-running and
  do not belong in a route handler — that is a separate service decision.

---

## 7. Suggested order of work

1. Seed traders and ads from the fixtures.
2. Add the Supabase server client and env vars (`SUPABASE_URL`,
   `SUPABASE_SECRET_KEY` — server-only, never `NEXT_PUBLIC_`).
3. Move domain types from `components/*/types.ts` to `lib/domain/` so route
   handlers can import them without reaching into UI folders.
4. Replace the four seams with queries, one at a time, order book first.
5. Regenerate TypeScript types after every migration.
