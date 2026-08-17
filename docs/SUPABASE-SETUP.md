# Supabase setup

For where the build stands overall, see [`STATUS.md`](./STATUS.md).

How to connect. For what is actually in the database and why, see
[`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md).

## Connecting the MCP server

`.mcp.json` in the repo root declares the Supabase MCP server. It holds **no
secrets** — both values are read from the environment, so the file is safe to
commit and share.

Export both in your shell profile (`~/.zshrc`), then restart the Claude Code
session so the server is picked up at startup:

```sh
export SUPABASE_PROJECT_REF="your-project-ref"     # from the project URL
export SUPABASE_ACCESS_TOKEN="sbp_..."             # Account → Access Tokens
```

The token is a **personal access token with account-level reach**, not a
project anon key. Never paste it into a chat, a commit, or `.mcp.json`.

The server runs with write access — it can apply migrations and execute SQL
against the project. Two habits keep that safe:

1. **Every schema change lands in `supabase/migrations/` first**, then gets
   applied. The repo stays the source of truth, and the change is reviewable.
2. **Point it at a development project**, not the one holding real trades.

To make it read-only instead, add `--read-only` to the args in `.mcp.json`.

## Conventions

- Migrations are timestamped SQL files in `supabase/migrations/`.
- Identity is the **Stellar public key**, not a `users.id`. There is no
  Supabase Auth session — see the auth note in the schema migration.
- **RLS is enabled on every table**, from the first migration.

---

## Clearing test data

Beta testing fills the tables with throwaway ads and half-finished trades.
`scripts/db-reset.mjs` clears them.

```bash
npm run db:reset                    # dry run — counts what would go
npm run db:reset -- --yes           # trades, chat, and reviews
npm run db:reset -- --all --yes     # also ads and traders
npm run db:reset -- --all --yes --keep GABC...,GDEF...
```

**Dry run is the default.** Nothing is deleted without `--yes`, and the
project ref is printed on every run — the mistake worth guarding against is
pointing it at the wrong database, which no confirmation prompt catches if you
cannot see where you are aimed. It also refuses to run under
`NODE_ENV=production`.

Two things the order is load-bearing for:

- **Trades go first.** `trades.ad_id` and `trades.maker/taker` are
  `ON DELETE RESTRICT`, so no ad or trader can be removed while a trade still
  points at it. `trade_messages` and `trade_reviews` cascade from `trades`,
  and `trader_verifications` cascades from `traders`.
- **Reservations are released.** Open trades hold `ads.reserved_amount`.
  Deleting the trade does not give it back, so the reset zeroes it — otherwise
  an ad shows less available than it has, permanently, with nothing left in the
  database to explain why.

`--keep` preserves the listed traders *and* their ads, which is what you want
for your own account: wipe everyone else's noise, keep your identity, nickname,
and listings.
