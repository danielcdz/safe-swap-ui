-- Store the exact message that was issued.
--
-- Verification must hash precisely the bytes the wallet signed. Rebuilding
-- that string at verify time means every input — expiry formatting, the Host
-- header, the network label — has to reproduce identically, and any drift
-- fails as an invalid signature with no clue why. Storing it removes the
-- reconstruction entirely.
alter table public.auth_challenges add column message text not null;

drop function if exists public.consume_auth_challenge(text);

create or replace function public.consume_auth_challenge(p_nonce text)
returns table (address text, message text)
language sql
security invoker
set search_path = ''
as $$
  update public.auth_challenges
     set consumed_at = now()
   where nonce = p_nonce
     and consumed_at is null
     and expires_at > now()
  returning auth_challenges.address, auth_challenges.message;
$$;
