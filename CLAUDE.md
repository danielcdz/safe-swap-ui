# SafeSwap — working context

Read this before changing anything. It is the orientation document; the files
in [`docs/`](./docs) stay authoritative for their own areas.

**SafeSwap is a peer-to-peer marketplace for trading USDC on Stellar against
fiat.** Two people agree terms in an order book, then settle the two legs
themselves — fiat by bank transfer or SINPE Móvil, USDC wallet to wallet.
The app coordinates and records. It never holds funds.

---

## 1. Tech stack

| | |
|---|---|
| Framework | Next.js 16.2.6, App Router, Turbopack |
| Runtime | React 19.2.4, TypeScript strict |
| Styling | Tailwind CSS v4 — **CSS-first, there is no `tailwind.config.js`** |
| Components | `class-variance-authority`, `clsx` + `tailwind-merge` via `cn()` |
| Icons / motion | `lucide-react`, `framer-motion`, `next-themes` |
| Font | Satoshi Variable, self-hosted through `next/font/local` |
| Database | Supabase Postgres 17.6, project `wxgwzrlkdajxtplnixfd` |
| Wallet | `@stellar/freighter-api` 6, `@stellar/stellar-sdk` 16 |
| Sessions | `jose` — HS256 JWT in an httpOnly cookie |
| Deploy | Vercel Pro |

Design tokens live in `app/globals.css`. Tailwind v4 takes its configuration
from CSS, so adding a colour means adding a token there, not editing a JS
config that does not exist.

### Commands

```bash
npm run dev        # localhost:3000
npm run build      # also the typecheck — run it before claiming done
npm run lint
npm run db:reset   # clear test data; dry run unless you pass --yes
```

### Environment

Three variables, in `.env.local` (see `.env.example`). None are
`NEXT_PUBLIC_`, and none may become so.

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — an `sb_secret_…` key, **not** the legacy
  `service_role` JWT
- `SESSION_SECRET` — at least 32 characters or the code refuses to start

---

## 2. The one security rule

**The server derives who is acting from the session cookie. Never from the
request body.**

`getSessionAddress()` in `lib/auth/session.ts` is the only trustworthy answer
to "who is calling". Every route handler scopes its writes with it —
`.eq("address", address)`, `advertiser: address`, `taker: address`. A body
field naming an address is a body field a caller can forge.

This is load-bearing because RLS cannot help here. Identity is a Stellar
public key, so `auth.uid()` is always null and a policy has nothing to match
on. Every table therefore has RLS enabled with **zero policies** — a deny-all —
and the server's secret key is the only way in. Authorisation is this
codebase's job, not the database's.

The Supabase advisor reports seven `rls_enabled_no_policy` INFO lints as a
result. They are expected. Do not "fix" them by dropping RLS.

---

## 3. Two inversions that decide who sends money

Get either backwards and the app tells the wrong person to pay.

**`bookModeFor(adSide)`** — an ad's side is the *advertiser's*. An ad to sell
USDC appears under the **Buy** tab, because the person browsing is the one
buying. `components/ads/types.ts`.

**`roleFor(adSide, isMaker)`** — maker/taker says who advertised, not who
buys. An ad to sell means the advertiser is the seller and the taker is the
buyer; an ad to buy is the mirror. `components/trade/types.ts`.

Both live alone in one place each, deliberately.

---

## 4. How state is held

**Server state lives in Postgres and is read through the API.** There is no
client-side source of truth for anything two people share.

**Client caches are scoped to the session.** `lib/scoped-store.ts` binds a
cached value to the signed-in address and drops it synchronously when that
changes. This exists because of a real bug: a module-level cache that fetches
once keeps serving the previous account's nickname and ads after a wallet
switch, rendering one trader's data under another's address. Any new
per-account cache must use it — `components/ads/ads-store.ts` is the pattern.

**Anything external or persisted goes through `useSyncExternalStore`**, which
gives an empty server snapshot and the real one after hydration. Reading
`localStorage` during render is a hydration mismatch.

**What is still in `localStorage`, legitimately:** panel collapse state
(`lib/use-collapsed.ts`) and the wallet reconnect hint. Both are one browser's
preference. Nothing else belongs there.

---

## 5. React rules this codebase has been bitten by

- No `Date.now()` in a render body. Resolve timestamps once, at creation, or
  in a lazy state initialiser.
- No `setState` in an effect body. Derive it instead.
- Anything timezone- or locale-dependent renders only after mount
  (`lib/use-mounted.ts`), because the server cannot know the viewer's zone.
- Poll with a **chained** `setTimeout`, not `setInterval`, so a slow response
  cannot pile requests up behind it. See
  `components/trade/use-trade-messages.ts`.

---

## 6. Where things are

```
app/
  api/            route handlers — auth, traders, ads, trades
  p2p/orders/     the order book
  p2p/ads/new/    three-step ad wizard
  dashboard/      your ads and trades
  profile/        identity, verification
  trades/[id]/    a live trade: steps, chat
components/
  ui/             button, dialog, text-field… the primitives
  wallet/         Freighter connection, session restore, the header chip
  p2p/            order book, rows, the inline trade panel
  ads/            ad composition and the ads store
  trade/          trade screens, chat wiring, stores
  profile/        profile screen, verification
  dashboard/      panels
lib/
  auth/           session JWT, SEP-53 challenge, trader bootstrap
  ads/            ad and order-book queries
  trades/         trade queries, state machine, messages
  supabase/       the privileged server client
  scoped-store.ts client cache bound to the session
scripts/
  db-reset.mjs    clear test data
supabase/
  migrations/     mirrors what is applied; filenames must match versions
docs/             see below
```

Route handlers import domain types from `components/*/types.ts`, which reads
backwards. Moving them to `lib/domain/` has been deferred twice; it gets more
expensive the longer it waits.

---

## 7. Conventions

- **Migrations** are applied through the Supabase MCP server and mirrored into
  `supabase/migrations/` **under the same filename as the applied version**.
  They have drifted twice; a mismatch makes `supabase db push` try to re-apply
  live work.
- **No seed data.** The order book is empty until someone publishes an ad.
  That is the honest state, not a bug — do not add fixtures to make screens
  look populated.
- **Prices render to 3 decimals** (`lib/format.ts`); a P2P spread is often
  fractions of a cent.
- **Sell is red, buy is green**, consistently, including buttons and tags.
  `components/p2p/side.ts`.
- **Destructive actions are `variant="danger"`**; `sell` is its own solid
  variant so the two stay distinguishable.
- Comments explain **why**, not what. Match the density of the file you are in.

---

## 8. Things that will waste your time

- **The Supabase Data API must stay enabled.** `supabase-js` speaks PostgREST.
  With it off every query fails as `PGRST002` while the database is healthy
  and MCP keeps working, which looks like a key problem and is not.
- **Stellar public keys are 56 characters.** `/^G[A-Z2-7]{55}$/`.
- **Views need `security_invoker = on`.** A Postgres view defaults to running
  as its creator, which bypasses the deny-all RLS underneath it. Both views
  were fixed; a new one starts wrong.
- **`ads.reserved_amount` is separate from `total_amount`** on purpose.
  Decrementing the total would break `ads_limit_within_inventory`, and
  lowering `max_limit` to compensate would silently rewrite the advertiser's
  terms.
- **`trades.ad_id` and `trades.maker/taker` are `ON DELETE RESTRICT`.**
  Nothing upstream can be deleted while a trade points at it.
- **Freighter has never been exercised by any automated test.** Every test
  signs with a generated keypair against the API. The extension handshake —
  `requestAccess`, the signing prompt, rejection, wrong network — is verified
  by code review only. It needs a browser.

---

## 9. What is real, what is not

**Real:** wallet sign-in via SEP-53, ads, the order book, manual trades end to
end for both parties, chat backed by `trade_messages`, verification state,
nicknames.

**Deliberately not built yet:**

- **Escrow.** Deferred, not abandoned. Every piece stays in the tree —
  `components/trade/trade-screen.tsx` is marked `SUPERSEDED` and kept as the
  assembled composition to restart from. Do not delete it. The UI says
  "escrow coming soon" and warns that SafeSwap holds nothing.
- **Verification checks.** A trader can *request* one; only the server can
  grant one. `wallet` is granted at sign-in because a checked signature is the
  proof. Everything else stays `pending` until a provider exists. **Never add
  a path that lets a client reach `verified`** — the ID check feeds the public
  badge on the order book.
- **On-chain verification** of the USDC transfer. The hash is recorded and
  shown so the buyer can check it themselves.
- **Rating.** Reviews are thumbs up/down, so `rating` is null and the UI omits
  it rather than inventing a number.

**Payment details are never stored.** Traders exchange a SINPE number or bank
account in the trade chat. The columns existed briefly and were dropped
(`20260816234721`). Do not reintroduce them: data that does not exist cannot
leak or be shown to the wrong counterparty.

---

## 10. Open questions

**The market currency and the payment rails disagree.** Rails are Costa Rican
— SINPE Móvil settles in colones — while `MARKET.fiat` is `USD`, so an ad
quotes dollars against a colón rail. Either the market becomes CRC or a second
CRC market is added and the rails split. This is the most visible unresolved
thing in the product.

**Escrow probably does not belong in a route handler.** Chain work is
long-running and stateful; serverless limits make it a poor fit. A separate
service is likely, and nothing is committed either way.

**Testnet is hardcoded** in `lib/wallet.ts`. A deployed build still requires
Freighter on Testnet.

---

## 11. The documents

| Document | Covers |
|---|---|
| [`docs/STATUS.md`](./docs/STATUS.md) | What works today, what is next |
| [`docs/UI-REBUILD-SPEC.md`](./docs/UI-REBUILD-SPEC.md) | Design system, layout, components |
| [`docs/SUPABASE-SCHEMA.md`](./docs/SUPABASE-SCHEMA.md) | Database shape and reasoning |
| [`docs/SUPABASE-SETUP.md`](./docs/SUPABASE-SETUP.md) | MCP connection, clearing test data |
| [`docs/WALLET-AUTH.md`](./docs/WALLET-AUTH.md) | Freighter and SEP-53 sign-in |
| [`docs/TRADES-PLAN.md`](./docs/TRADES-PLAN.md) | Manual settlement design |
