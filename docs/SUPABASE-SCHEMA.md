# SafeSwap — database

For where the build stands overall, see [`STATUS.md`](./STATUS.md).

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
| Applied | 2026-08-30 |
| Tables | 7, all with RLS enabled |
| Views | `trader_stats`, `order_book` — both `security_invoker` |
| Storage | one bucket, `trade-attachments` — private, no policies |
| Seed data | **none, deliberately** — the book is empty until someone publishes |
| App wiring | ads, order book, identity, verification, manual trades and chat — with image attachments — are all live. Escrow is not. |

Migrations, matching `supabase/migrations/` by filename:

| Version | Name |
|---|---|
| `20260815222826` | `initial_schema` |
| `20260815222905` | `harden_touch_updated_at_search_path` |
| `20260815232347` | `auth_challenges` |
| `20260815232531` | `auth_challenges_store_message` |
| `20260816173341` | `order_book_view` |
| `20260816222447` | `manual_trade_states` |
| `20260816222506` | `manual_trade_columns` |
| `20260816222528` | `open_trade_function` |
| `20260816222730` | `reserve_inventory_separately` |
| `20260816234721` | `drop_trader_payment_details` |
| `20260817000912` | `views_respect_caller_rls` |
| `20260830152147` | `message_image_kind` |
| `20260830152201` | `trade_message_attachments` |

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
| `traders` | 5 | 2 | 0 | Identity only — address, nickname, joined_at. **No payment details**, see §3. |
| `trader_verifications` | 5 | 0 | 1 | One row per trader per method |
| `ads` | 16 | 8 | 1 | Standing terms that fill the order book |
| `trades` | 16+ | 5 | 3 | A specific agreement, moving through manual settlement or escrow |
| `trade_messages` | 11 | 5 | 2 | Chat, with escrow events and receipt images in the same stream |
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
| `escrow_status` | `pending`, `funded`, `disputed`, `released`, `cancelled`, plus the manual states `open`, `fiat_sent`, `fiat_confirmed`, `asset_sent`, `completed` |
| `message_kind` | `text`, `system`, `image` |
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

### Payment details are not stored at all

`traders` briefly gained `sinpe_phone`, `bank_name` and `bank_account`, then
dropped them again (`20260816234721`). Traders exchange those in the trade
chat instead.

The best way to protect PII is not to hold it. A stored SINPE number is
exactly what a scraper wants, has to be defended on every endpoint forever,
and can be handed to the wrong counterparty by any future bug. Held only in a
trade's messages, the same detail is disclosed by the person it belongs to, to
one counterparty, scoped to one trade. Do not reintroduce the columns.

### An attachment is a message, and its bytes are not in Postgres

`message_kind` gained `image` rather than a `trade_attachments` table. The chat
is one ordered stream and a receipt belongs in it, next to the sentence that
explains it — a second table would have to be merged back into that order on
every read.

The row carries the mime, byte count and dimensions; the bytes live in the
`trade-attachments` bucket under `{trade_id}/{uuid}`. Dimensions are stored
because the bubble has to reserve its space before the image loads, and the
five columns are all-or-nothing (`messages_attachment_matches_kind`) — a
half-populated row renders as a broken bubble with nothing left to say whether
the object was ever uploaded.

The mime is the one read out of the bytes by `lib/trades/image.ts`, not the one
the upload declared. A `.png` extension on a text file is one `mv` away, and
SVG stays out by never matching an image signature rather than by being named
in a deny-list.

### Inventory is reserved separately from the total

`ads.reserved_amount` is its own column rather than a decrement of
`total_amount`. Decrementing the total breaks `ads_limit_within_inventory` —
an ad with `max_limit` 900 and 300 left is not a valid row — and lowering
`max_limit` to compensate would silently rewrite the advertiser's terms.

`open_trade()` reserves in a single statement, so two takers cannot each claim
the last of an ad. `release_trade_reservation()` gives it back on cancel.
Deleting a trade does **not**, which is why `scripts/db-reset.mjs` zeroes the
column explicitly.

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

**RLS is enabled on all seven tables with zero policies.** This is a deny-all,
not an unfinished job.

Because identity is a wallet, `auth.uid()` is always null and a policy has
nothing to match on. Access runs through the Next.js server using a **secret
key** (`sb_secret_…`), which bypasses RLS.

Secret keys replace the legacy `service_role` JWT, which is deprecated at the
end of 2026. Both bypass RLS through the same Postgres role, but a secret key
can be rotated and revoked on its own, and Supabase rejects it outright when
sent from a browser — so a leak into client code fails loudly rather than
quietly working.

The advisor therefore reports **seven `rls_enabled_no_policy` INFO lints, and
they are expected.** Do not "fix" them by dropping RLS.

**Storage follows the same rule.** `trade-attachments` is private and
`storage.objects` has RLS enabled with no policies, so the secret key is the
only way to an object and the app decides who may have one. The browser is
never handed a storage URL: bytes come back through
`/api/trades/[id]/messages/[messageId]/image`, which re-checks the session.
A signed URL would have been less code and wrong — it goes on working for
whoever holds it long after the check that produced it is over. The bucket also
carries its own `file_size_limit` and `allowed_mime_types`, behind the
handler's validation rather than instead of it.

**Views must be `security_invoker`.** A Postgres view defaults to
`SECURITY DEFINER`, running as its creator and so bypassing the deny-all on
the tables underneath — and `anon` holds SELECT on both views. `order_book`
and `trader_stats` were fixed in `20260817000912`; a view added without it
starts wrong. The two remaining WARNs are on `rls_auto_enable`, Supabase's own
event-trigger helper, which does nothing when called outside a DDL trigger.

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

- **Seed data — deliberately none.** The book is empty until someone publishes
  an ad. Do not add fixtures to make screens look populated;
  `npm run db:reset` is there to get back to empty.
- **Trader statistics.** `trader_stats` computes them; the profile screen still
  reads fixtures from `components/profile/mock-profile.ts`.
- **No payment-methods table** — they are a `text[]` on `ads`, GIN-indexed for
  filtering. Promote to a table if they need metadata.
- **No auth or Realtime.** Realtime is the plausible next one, for chat and
  escrow status; note it would need the JWT approach in §4.
- **No retention policy on attachments.** A receipt lives as long as its
  message does. Purging them some days after a trade settles would be the
  stronger privacy posture, but it needs a scheduled job this project does not
  have yet.
- **Escrow/chain state.** `trades.escrow_contract_id` is the only slot for it.
  Trustless Work calls, XDR signing and Horizon polling are long-running and
  do not belong in a route handler — that is a separate service decision.

---

## 7. Suggested order of work

1. Point the profile at `trader_stats` so the record stops being fixtures.
2. Move domain types from `components/*/types.ts` to `lib/domain/` so route
   handlers can import them without reaching into UI folders.
3. Settle where escrow runs — `trades.escrow_contract_id` is the only slot for
   it, and a route handler is a poor fit for long-running chain work.
4. Regenerate TypeScript types after every migration.
