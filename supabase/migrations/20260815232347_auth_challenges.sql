-- Single-use login challenges.
--
-- No foreign key to traders: a wallet authenticates before it has a trader
-- row, and the first successful login is what creates one.
create table public.auth_challenges (
  nonce       text primary key,
  address     text not null check (address ~ '^G[A-Z2-7]{55}$'),
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  constraint auth_challenges_expiry_after_issue check (expires_at > issued_at)
);

create index auth_challenges_expires_at_idx on public.auth_challenges (expires_at);

alter table public.auth_challenges enable row level security;

-- Burns a challenge and returns the address it was issued to, or nothing.
--
-- One statement so the check and the burn cannot interleave: two requests
-- racing the same nonce means exactly one UPDATE matches `consumed_at is
-- null`, and the loser gets zero rows. Doing this as SELECT-then-UPDATE would
-- let both pass.
create or replace function public.consume_auth_challenge(p_nonce text)
returns text
language sql
security invoker
set search_path = ''
as $$
  update public.auth_challenges
     set consumed_at = now()
   where nonce = p_nonce
     and consumed_at is null
     and expires_at > now()
  returning address;
$$;
