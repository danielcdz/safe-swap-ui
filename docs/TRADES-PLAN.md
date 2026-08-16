# Trades without escrow — MVP plan

A prototype that lets two wallets find each other, agree terms, talk, and
settle by **manual transfer** in both directions. Escrow is deferred, not
removed.

Decided 2026-08-16. See [`STATUS.md`](./STATUS.md) for where the build stands.

---

## 0. The honest framing

Escrow was the reason a trade was safe. Without it, **someone has to move
first and carry the risk that the other side never does.** That is acceptable
for a prototype among testers; it is not a detail to leave implied.

Two consequences the UI must own:

1. ✅ A standing notice on the trade screen: funds are not held by SafeSwap, and
   the first mover is trusting the counterparty.
2. ✅ **"Escrow coming soon"** on the escrow panel, so the absence reads as
   deliberate rather than missing.

**Nothing escrow-related gets deleted.** `EscrowStepper`,
`EscrowStatusBadge`, `ESCROW_STEPS`, the `escrow_status` values and the
`escrow_contract_id` column all stay. The manual flow runs alongside them.

---

## 1. What a manual trade actually is

Two independent transfers, each with a sender and a confirmer:

| Leg | From → To | Rail |
|---|---|---|
| Fiat | buyer → seller | SINPE Móvil or bank transfer |
| Asset | seller → buyer | wallet → wallet, on Stellar |

Neither is performed by the app. Both are claimed by the sender and confirmed
by the receiver.

### States

| State | Who acts next | Notes |
|---|---|---|
| `open` | Buyer sends fiat | Cancellable by either side |
| `fiat_sent` | Seller confirms receipt | Buyer claims they paid |
| `fiat_confirmed` | Seller sends USDC | Seller has the money |
| `asset_sent` | Buyer confirms receipt | Seller records the tx hash |
| `completed` | — | |
| `cancelled` | — | Only from `open` |
| `disputed` | — | Any time from `fiat_sent` |

Cancelling is only honest before any money moves — the same rule the escrow
flow already uses.

### Who is the buyer

`maker` is the advertiser, `taker` opened the trade. Who **buys USDC** depends
on the ad's side:

| Ad side | Maker is | Taker is |
|---|---|---|
| `sell` | seller | buyer |
| `buy` | buyer | seller |

This is a second inversion alongside `bookModeFor`, and it belongs in **one**
function — `roleFor(adSide, isMaker)` — or it will be gotten backwards
somewhere and silently show the wrong party the wrong button.

---

## 2. Schema

**Extend, do not replace.** New values are added to the existing status enum
so escrow states survive:

```
alter type escrow_status add value 'fiat_sent';
alter type escrow_status add value 'fiat_confirmed';
alter type escrow_status add value 'asset_sent';
alter type escrow_status add value 'completed';
alter type escrow_status add value 'open';
```

**`trades` gains:**

- `settlement` — `'manual' | 'escrow'`, default `manual`
- `fiat_sent_at`, `fiat_confirmed_at`, `asset_sent_at`
- `asset_tx_hash` — the Stellar transaction, so the buyer can verify it on a
  block explorer rather than taking the seller's word

**`traders` gains payment details**, since the buyer needs somewhere to send
money:

- `sinpe_phone`
- `bank_account`
- `bank_name`

> **This is PII in the database.** It is only ever disclosed to the
> counterparty of an active trade, never through the order book or a public
> profile. The API must enforce that, because a trader's payment details are
> exactly the thing a scraper would want.

**Inventory must decrement atomically.** Nothing currently stops two takers
each claiming an ad's full amount. One `UPDATE` that checks and decrements and
returns nothing when there is not enough — the same single-statement pattern
as `consume_auth_challenge`. Cancelling returns the amount.

---

## 3. API

```
POST   /api/trades                    open one against an ad; taker = session
GET    /api/trades/[id]               participants only
POST   /api/trades/[id]/advance       one step, validated against your role
GET    /api/trades/[id]/messages      participants only
POST   /api/trades/[id]/messages
GET    /api/traders/me                gains payment details
PATCH  /api/traders/me                gains payment details
```

Every route authorises on "am I maker or taker of this trade", the same shape
as the ads routes. **`advance` validates the actor against the state**: only
the buyer can claim the fiat was sent, only the seller can confirm it.

---

## 4. Chat

Messages live in `trade_messages`, which already exists and is unused. System
messages (state changes) share the stream with conversation, as the UI already
assumes.

**Transport: polling**, every 3 seconds while the trade screen is open, behind
a single `useTradeMessages()` hook.

Why not SSE, given Vercel Pro allows it: a trade's payment window is 10–30
minutes and the maximum function duration is 800 seconds, so an SSE connection
**cannot outlive a trade**. Reconnection logic would be required regardless,
for latency that is imperceptible next to a bank transfer. Swapping the
transport later touches one file.

Why not Supabase Realtime: the browser holds our cookie, not a Supabase
session. Using it would mean minting Supabase-compatible JWTs and adding RLS
policies — reversing the "browser never talks to Supabase" posture for a
problem polling solves.

---

## 5. Build order

1. Migration — states, timestamps, `settlement`, payment details, atomic
   inventory decrement
2. `roleFor()` and `POST /api/trades`
3. ✅ Trade screen reads a real trade, for both parties
4. ✅ Messages: table-backed, polling, both sides
5. ✅ `advance` with per-role validation, the trust notice, and "escrow coming
   soon"
6. ✅ Payment details on the profile, disclosed only to an active counterparty
7. Retire `open-orders-store` — the last localStorage holdout

---

## 6. Deliberately out of scope

- Escrow itself — deferred, and every piece of it stays in the tree
- Verifying the Stellar transaction on-chain. The hash is recorded and
  displayed so the buyer can check it themselves; the app does not read
  Horizon yet.
- Dispute resolution beyond marking a trade disputed
- Any automated transfer, in either direction
