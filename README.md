# SafeSwap

A peer-to-peer marketplace for trading **USDC on Stellar** against fiat.

Two people agree terms in an order book, then settle the two legs themselves —
fiat by bank transfer or SINPE Móvil, USDC wallet to wallet. The app
coordinates and records. **It never holds funds.**

Escrow is coming; this build is deliberately without it, so the manual flow
can be tested end to end first.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev                  # localhost:3000
```

You will need [Freighter](https://www.freighter.app/) with the network set to
**Testnet**. Sign-in is a SEP-53 signature — no password, no email.

| Command | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build; also the typecheck |
| `npm run lint` | ESLint |
| `npm run db:reset` | Clear test data — dry run unless you pass `--yes` |

## Environment

Three variables, none of them `NEXT_PUBLIC_`:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — an `sb_secret_…` key, not the legacy `service_role` JWT
- `SESSION_SECRET` — at least 32 characters (`openssl rand -base64 32`)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
Postgres · Stellar SDK + Freighter · deployed on Vercel.

## Documentation

**Start with [`CLAUDE.md`](./CLAUDE.md)** — the orientation document, and what
to read before changing anything.

| Document | Covers |
|---|---|
| [`docs/STATUS.md`](./docs/STATUS.md) | What works today, what is next |
| [`docs/UI-REBUILD-SPEC.md`](./docs/UI-REBUILD-SPEC.md) | Design system, layout, components |
| [`docs/SUPABASE-SCHEMA.md`](./docs/SUPABASE-SCHEMA.md) | Database shape and reasoning |
| [`docs/SUPABASE-SETUP.md`](./docs/SUPABASE-SETUP.md) | MCP connection, clearing test data |
| [`docs/WALLET-AUTH.md`](./docs/WALLET-AUTH.md) | Freighter and SEP-53 sign-in |
| [`docs/TRADES-PLAN.md`](./docs/TRADES-PLAN.md) | Manual settlement design |
