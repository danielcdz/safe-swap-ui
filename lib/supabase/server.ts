import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client. **Server only** — the `server-only` import above
 * makes importing this from a client component a build error.
 *
 * Uses a secret key (`sb_secret_…`) rather than the legacy service_role JWT.
 * Both bypass RLS through the same Postgres role, but a secret key rotates and
 * revokes independently, and Supabase refuses it from a browser — so a leak
 * into client code fails loudly instead of silently working.
 *
 * Every table has RLS enabled with no policies, so this key is the only way
 * in; see docs/SUPABASE-SCHEMA.md §4. Bypassing RLS means authorisation is
 * this codebase's job: derive the actor from the session, never from a
 * request body.
 */
let client: SupabaseClient | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  client = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    // No session to persist or refresh: this client is a trusted backend
    // caller, not a signed-in user.
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return client;
}
