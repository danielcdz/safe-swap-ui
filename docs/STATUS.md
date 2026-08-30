# SafeSwap — where the build is

A snapshot for whoever picks this up next: what works, what is deliberately
absent, and what is unresolved. [`CLAUDE.md`](../CLAUDE.md) is the orientation
document; the detailed files below stay authoritative for their own areas.

| Document | Covers |
|---|---|
| [`UI-REBUILD-SPEC.md`](./UI-REBUILD-SPEC.md) | Design system, layout, component inventory |
| [`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md) | Database shape and the reasoning behind it |
| [`SUPABASE-SETUP.md`](./SUPABASE-SETUP.md) | MCP connection, clearing test data |
| [`WALLET-AUTH.md`](./WALLET-AUTH.md) | Freighter connection and SEP-53 sign-in |
| [`TRADES-PLAN.md`](./TRADES-PLAN.md) | Manual settlement design and build order |

Last updated 2026-08-30, on `feat/chat-attachments`.

---

## 1. What actually works

**A wallet signs in, and the server can prove who it is.** Freighter connects,
signs a SEP-53 challenge, and the server verifies the signature and issues an
httpOnly session. Every write derives its actor from that session, never from
a request body — verified by attempting cross-account writes and watching them
fail.

**Ads are real.** Publishing writes to Postgres, the order book reads from it,
taking an ad down removes it from the book, and your own ads are excluded from
the book you browse.

**Trades are real, end to end, for both parties.** Taking an ad opens a trade,
reserves the inventory atomically, and walks a four-step manual settlement:
buyer marks the fiat sent, seller confirms it arrived, seller sends the USDC,
buyer confirms receipt. Each step is gated to the one role that can honestly
perform it. Cancelling is allowed only before anything has moved; past that
the exit is a dispute. A stale `from` status loses the race rather than
skipping a step.

**Chat is real, and carries images.** Messages live in `trade_messages`, poll
on a 3s chained timeout, and are readable only by the trade's two participants.
System events land in the same stream, and so do attachments: the buyer can
paste, drop or pick a screenshot of the transfer, capped at 20 per trade. The
bytes go to a private bucket and come back through a route that re-checks the
session — never a signed URL, which would work for anyone holding it. The
format and dimensions recorded are read out of the bytes rather than taken from
the upload's declared type.

The UI says plainly that a screenshot is not proof of payment. It is the
easiest thing in the conversation to fake, and the seller still has to see the
money in their own account.

**Identity and verification are real.** First sign-in creates the trader.
Nicknames persist and can be edited. Verification state lives in
`trader_verifications` — see §3 for what "real" means there.

### Routes

| Route | State |
|---|---|
| `/` | Wallet connect — the front door |
| `/p2p/orders` | Order book, from the database |
| `/p2p/ads/new` | Three-step ad wizard, publishes for real |
| `/dashboard` | Your trades and ads, from the database |
| `/profile` | Identity, record, verification |
| `/trades/[id]` | A live manual trade: steps, chat, counterparty |
| `POST /api/auth/challenge`, `POST /api/auth/verify`, `GET`/`DELETE /api/auth/session` | Sign-in |
| `GET`/`PATCH /api/traders/me` | Your trader record — nickname only |
| `GET`/`POST /api/traders/me/verifications` | Request a check; only the server grants one |
| `GET`/`POST /api/ads`, `GET /api/ads/mine`, `DELETE /api/ads/[id]` | Ads |
| `GET`/`POST /api/trades` | Your trades; open one against an ad |
| `GET /api/trades/[id]`, `POST /api/trades/[id]/advance` | One trade, and its state machine |
| `GET`/`POST /api/trades/[id]/messages` | Chat — JSON posts text, multipart posts an image |
| `GET /api/trades/[id]/messages/[messageId]/image` | An attachment's bytes, for a participant |

### Database

Seven tables and two views, RLS enabled everywhere with no policies — a
deny-all, since access runs through the server's secret key. Both views are
`security_invoker`. See [`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md) §4 before
"fixing" the advisor's INFO lints.

**There is no seed data, deliberately.** The book is empty until someone
publishes an ad. `npm run db:reset` clears test data between runs.

---

## 2. Deliberately absent

| Area | Why | What it would take |
|---|---|---|
| **Escrow** | Deferred for a fast MVP, not abandoned | Trustless Work calls, XDR signing, Horizon. `components/trade/trade-screen.tsx` keeps the assembled composition — marked `SUPERSEDED`, unrouted, **do not delete**. |
| **Stored payment details** | Never storing them is the protection | Nothing. Traders exchange SINPE numbers and account numbers in the trade chat. The columns existed briefly and were dropped in `20260816234721`. |
| **On-chain verification** | The buyer can check the hash themselves | Reading Horizon for the recorded `asset_tx_hash`. |
| **Real verification checks** | No provider is wired up | Email round trip, SMS code, KYC vendor. A request reaches `pending` and stops. |
| **Rating** | No model — reviews are thumbs up/down | A rating model, or keep omitting it rather than inventing a number. |
| **Trader statistics on the profile** | `trader_stats` computes them | Point the profile screen at the view; it still reads fixtures. |
| **Public trader profile** | — | `/traders/[address]` does not exist, though the profile's record tiles are already its shape. |

---

## 3. Verification is a boundary, not a badge

A trader can **request** a check. Only the server can **grant** one.

`wallet` is granted at sign-in, because a verified SEP-53 signature *is* proof
of wallet ownership. Everything else stays `pending` until a provider exists.
`requestVerification` cannot reach `verified` by any path a client controls.

This matters because `order_book.verified` reads `trader_verifications` for
`method='id'`, and that flag is what other traders see when deciding whom to
trust. The dialog used to grant it on a 1.6s timer in localStorage; persisting
that as written would have turned a UI mock into a working forgery service.

---

## 4. Open decisions

**The payment rails and the market currency disagree.** Rails are Costa Rican
(SINPE Móvil and local banks) while `MARKET.fiat` is `USD`. SINPE Móvil settles
in colones, so an ad quotes dollars against a colón rail. Either the market
becomes CRC, or a second CRC market is added and the rails split. This is the
most visible unresolved thing in the product.

**Escrow does not obviously belong in a route handler.** Chain work is
long-running and stateful; serverless limits make it a poor fit. A separate
service is the likely answer, and nothing has been committed either way.

**Domain types live under `components/`.** Route handlers import `P2POrder`
from `components/p2p/types`, which reads backwards. Moving them to
`lib/domain/` has been deferred twice; it gets more expensive the longer it
waits.

**Chat transport is polling.** A payment window runs 10–30 minutes against an
800s maximum function duration, so a streamed connection could not outlive a
trade. Swapping it means changing `use-trade-messages.ts` and nothing else.

---

## 5. Things that already cost time

Collected so they are not rediscovered. Fuller notes live in
[`CLAUDE.md`](../CLAUDE.md) §8.

- **The Supabase Data API must stay enabled** — `supabase-js` speaks
  PostgREST. With it off, every query fails as `PGRST002` while the database is
  healthy and MCP keeps working.
- **`SESSION_SECRET` must be ≥32 characters**, or the code refuses it.
- **Client caches must be scoped to the signed-in account.**
  `lib/scoped-store.ts` exists because of exactly that bug — and the first fix
  was itself buggy, bailing during in-flight loads so the signed-in account
  never loaded at all on a cold page.
- **Signed-in state comes from the session, not a localStorage flag.** The
  header once offered "Connect wallet" over a fully signed-in app because the
  chip keyed off the extension while everything else keyed off the cookie.
- **Stellar addresses are 56 characters.** Three original fixtures were 55 and
  the database CHECK caught them.
- **Nickname validation must be Unicode** (`\p{L}\p{N}`). An ASCII-only regex
  rejected "José" and "Andrés" — a bug for a Costa Rica product.
- **Views default to `SECURITY DEFINER`**, which bypasses the RLS underneath
  them.
- **Storage does not cascade from Postgres.** Deleting a trade leaves its
  attachments behind; `npm run db:reset` sweeps the bucket for exactly the
  reason it also zeroes `reserved_amount`.
- **React purity**: no `Date.now()` in a render body, no `setState` in an
  effect body, nothing timezone-dependent before mount.

---

## 6. Suggested next steps

1. **Walk one trade end to end in a browser, with two real Freighter wallets.**
   Nothing else on this list matters if the extension handshake is broken —
   see §7.
2. **Resolve the currency question.** It is the one thing making the current
   book incoherent.
3. **Point the profile at `trader_stats`** so the record stops being fixtures.
4. **Move domain types to `lib/domain/`** before the import count grows again.
5. **Then escrow**, once the service question is settled.

---

## 7. Testing reality

Server behaviour is well covered. Sign-in, the ads API, the trade state
machine, chat, verification, cross-account isolation, and the disclosure
boundaries were each verified against the running server with generated
keypairs.

**The Freighter extension itself has never been exercised.** `requestAccess`,
the signing prompt, a rejected prompt, and the wrong-network warning are
verified by types and code review only, because that needs a browser. Every
automated test signs with a keypair directly, which proves the server half of
the handshake and nothing about the extension half.
