# SafeSwap — where the build is

A snapshot for whoever picks this up next: what works, what is still fake, and
what is unresolved. The detailed documents stay authoritative for their own
areas — this one is the index.

| Document | Covers |
|---|---|
| [`UI-REBUILD-SPEC.md`](./UI-REBUILD-SPEC.md) | Design system, layout, component inventory |
| [`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md) | Database shape and the reasoning behind it |
| [`SUPABASE-SETUP.md`](./SUPABASE-SETUP.md) | Connecting the MCP server |
| [`WALLET-AUTH.md`](./WALLET-AUTH.md) | Freighter connection and SEP-53 sign-in |

Last updated 2026-08-16, on `feat/supabase-integration` (28 commits ahead of
`main`).

---

## 1. What actually works

**A wallet signs in, and the server can prove who it is.** Freighter connects,
signs a SEP-53 challenge, and the server verifies it and issues an httpOnly
session. Every write derives its actor from that session, never from a request
body — verified by attempting the cross-account writes and watching them fail.

**Ads are real.** Publishing writes to Postgres, the order book reads from it,
and taking an ad down removes it from the book. Your own ads are excluded from
the book you browse.

**Identity is real.** First sign-in creates the trader; the nickname persists
and can be renamed.

### Routes

| Route | State |
|---|---|
| `/` | Wallet connect — the front door |
| `/p2p/orders` | Order book, served from the database |
| `/p2p/ads/new` | Three-step ad wizard, publishes for real |
| `/dashboard` | Your orders and ads |
| `/profile` | Identity and record |
| `/trades/[id]` | Escrow state + chat |
| `POST /api/auth/challenge`, `POST /api/auth/verify`, `GET`/`DELETE /api/auth/session` | Sign-in |
| `GET`/`PATCH /api/traders/me` | Your trader record |
| `GET`/`POST /api/ads`, `GET /api/ads/mine`, `DELETE /api/ads/[id]` | Ads |

### Database

Seven tables plus two views, RLS on all of them with no policies — a deny-all,
since access runs through the server's secret key. See
[`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md) §4 before "fixing" the advisor's
INFO lints.

**There is no seed data, deliberately.** The book is empty until someone
publishes an ad. That is the honest state, not a bug.

---

## 2. What is still fake

| Area | Where | What it would take |
|---|---|---|
| **Trades** | `components/trade/open-orders-store.ts` | The last localStorage store. A trade is not written to `trades` — the schema is ready, the wiring is not. |
| **Escrow** | `advance()`, `cancelOrder()`, `raiseDispute()` in `trade-screen.tsx` | Trustless Work calls, XDR signing, Horizon. Long-running and stateful, so probably not a route handler. |
| **Chat** | `trade-screen.tsx` | Messages are component state. `trade_messages` exists and is unused. |
| **Trader statistics** | `components/profile/mock-profile.ts` | Rating, volume, completion. `trader_stats` computes most of it; the profile screen still reads fixtures. |
| **Verification** | `components/profile/verification.ts` | Client-held, so fine for the UI and meaningless as a boundary. Only the wallet step is genuinely proven. |
| **Rating** | — | No model at all. Reviews are thumbs up/down, not stars, so `rating` is null everywhere and the UI omits it rather than inventing a number. |

---

## 3. Open decisions

**The payment rails and the market currency disagree.** Rails are Costa Rican
(SINPE Móvil and local banks) while `MARKET.fiat` is `USD`. SINPE Móvil settles
in colones, so an ad currently quotes dollars against a colón rail. Either the
market becomes CRC, or a second CRC market is added and the rails split. This
is the most visible unresolved thing in the product.

**Escrow does not belong in a route handler.** Chain work is long-running and
stateful; serverless execution limits make it a poor fit. A separate service is
the likely answer, and nothing has been committed either way.

**Domain types live under `components/`.** Route handlers import `P2POrder`
from `components/p2p/types`, which reads backwards. Moving them to
`lib/domain/` was deferred once already — 22 files import them, and doing it
mid-feature was churn. It gets more expensive the longer it waits.

**No public trader profile.** `/traders/[address]` does not exist, though the
profile's record tiles are already the shape it needs.

---

## 4. Things that already cost time

Each of these is written up where it belongs; collected here so they are not
rediscovered.

- **The Supabase Data API must be enabled.** `supabase-js` speaks PostgREST.
  With it off, every query fails as `PGRST002` while the database is healthy
  and MCP keeps working — which makes it look like a key problem.
- **`SESSION_SECRET` must be ≥32 characters**, or the code refuses it.
- **Client caches must be scoped to the signed-in account.** A module-level
  cache that fetches once will serve the previous trader's data after an
  account switch, under the new trader's address. `lib/scoped-store.ts` exists
  because of exactly that bug.
- **Stellar addresses are 56 characters.** Three original fixtures were 55 and
  the database CHECK caught them.
- **React purity rules bite here**: no `Date.now()` in a render body, no
  `setState` in an effect body, and anything timezone-dependent renders only
  after mount.

---

## 5. Suggested next steps

1. **Resolve the currency question.** Everything else about ads is done, and
   this is the one thing that makes the current book incoherent.
2. **Write trades to the database.** The schema is ready; `open-orders-store`
   is the last localStorage holdout, and doing it retires the snapshot
   workaround in the dashboard.
3. **Move chat into `trade_messages`.** Realtime becomes plausible at that
   point, which is the strongest argument for having enabled the Data API.
4. **Point the profile at `trader_stats`** so the record stops being fixtures.
5. **Then escrow**, once the service question is settled.

---

## 6. Testing reality

Server behaviour is well covered — sign-in, the ads API, and cross-account
isolation were each verified against the running server with generated
keypairs, and the account-scoping fix was tested directly.

**The Freighter extension itself has never been exercised.** `requestAccess`,
the signing prompt, a rejected prompt, and the wrong-network warning are
verified by types and code review only, because that needs a browser. The
account-switch fix in particular is worth clicking through with two accounts.
