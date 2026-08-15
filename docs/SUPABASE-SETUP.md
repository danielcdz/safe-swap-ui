# Supabase setup

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
