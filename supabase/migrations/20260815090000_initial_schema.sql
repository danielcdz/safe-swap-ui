-- SafeSwap — initial schema
--
-- Identity is the Stellar public key. There is no Supabase Auth session: users
-- authenticate by signing a challenge with their wallet, which the Next.js
-- server verifies before touching this database. Consequently `auth.uid()` is
-- always null here and RLS cannot identify a caller on its own.
--
-- So: RLS is enabled on every table and NO permissive policies are defined.
-- That denies anon and authenticated outright, and access happens only through
-- the server using the service-role key. If the browser is ever given direct
-- access, mint a JWT carrying the wallet address and add policies reading
-- `auth.jwt() ->> 'wallet_address'` — do not loosen this by dropping RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----

create type ad_side          as enum ('buy', 'sell');
create type price_type       as enum ('fixed', 'floating');
create type ad_status        as enum ('active', 'paused', 'closed');
create type escrow_status    as enum ('pending', 'funded', 'disputed', 'released', 'cancelled');
create type message_kind     as enum ('text', 'system');
create type verify_method    as enum ('wallet', 'email', 'phone', 'id');
create type verify_status    as enum ('unverified', 'pending', 'verified');

-- -------------------------------------------------------------- traders ----

create table public.traders (
  address     text primary key
              check (address ~ '^G[A-Z2-7]{55}$'),
  nickname    text not null
              check (char_length(trim(nickname)) between 3 and 20),
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.traders.address is
  'Stellar public key — the identity for the whole system, not a surrogate id.';

-- Verification is per method; only `id` grants the public Verified mark, which
-- mirrors the rule the UI enforces. See docs/UI-REBUILD-SPEC.md section 5.4.
create table public.trader_verifications (
  trader_address text not null references public.traders(address) on delete cascade,
  method         verify_method not null,
  status         verify_status not null default 'unverified',
  verified_at    timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (trader_address, method)
);

-- ------------------------------------------------------------------ ads ----

create table public.ads (
  id              uuid primary key default gen_random_uuid(),
  advertiser      text not null references public.traders(address) on delete cascade,

  side            ad_side not null,
  status          ad_status not null default 'active',

  price_type      price_type not null,
  -- Resolved USD per USDC. For a floating ad this is recomputed from margin.
  price           numeric(12, 6) not null check (price > 0),
  margin_percent  numeric(5, 2),

  -- Inventory, in USDC.
  total_amount    numeric(20, 7) not null check (total_amount > 0),
  -- Per-trade window, in USD.
  min_limit       numeric(20, 2) not null check (min_limit > 0),
  max_limit       numeric(20, 2) not null,

  window_minutes  integer not null check (window_minutes between 5 and 120),
  payment_methods text[] not null check (array_length(payment_methods, 1) > 0),

  terms           text not null default '',
  auto_reply      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint ads_limits_ordered check (max_limit > min_limit),

  -- The invariant the UI enforces in two places: you cannot accept a single
  -- trade larger than your remaining inventory is worth. Encoded here so it
  -- holds regardless of which client wrote the row.
  constraint ads_limit_within_inventory
    check (max_limit <= total_amount * price),

  -- A floating ad needs its margin; a fixed one must not carry a stale value.
  constraint ads_margin_matches_type
    check ((price_type = 'floating') = (margin_percent is not null))
);

create index ads_book_idx
  on public.ads (side, price)
  where status = 'active';

create index ads_payment_methods_idx
  on public.ads using gin (payment_methods);

create index ads_advertiser_idx on public.ads (advertiser);

-- ---------------------------------------------------------------- trades ----

create table public.trades (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  ad_id           uuid not null references public.ads(id) on delete restrict,

  -- Denormalised from the ad on purpose: an ad can be edited or taken down,
  -- and a trade must remain a faithful record of what was agreed.
  maker           text not null references public.traders(address) on delete restrict,
  taker           text not null references public.traders(address) on delete restrict,
  price           numeric(12, 6) not null check (price > 0),
  fiat_amount     numeric(20, 2) not null check (fiat_amount > 0),
  asset_amount    numeric(20, 7) not null check (asset_amount > 0),
  payment_method  text not null,
  window_minutes  integer not null,

  status          escrow_status not null default 'pending',
  escrow_contract_id text,

  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  settled_at      timestamptz,
  updated_at      timestamptz not null default now(),

  constraint trades_parties_differ check (maker <> taker),

  -- Terminal states must record when they happened, and only then.
  constraint trades_settled_when_terminal
    check ((status in ('released', 'cancelled')) = (settled_at is not null))
);

create index trades_taker_idx  on public.trades (taker, status);
create index trades_maker_idx  on public.trades (maker, status);
create index trades_open_idx   on public.trades (status)
  where status in ('pending', 'funded', 'disputed');

-- -------------------------------------------------------------- messages ----

-- Chat is a transaction surface here, so escrow events share the stream with
-- the conversation. A system message has no author.
create table public.trade_messages (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades(id) on delete cascade,
  kind        message_kind not null default 'text',
  author      text references public.traders(address) on delete set null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),

  constraint messages_author_matches_kind
    check ((kind = 'system') = (author is null))
);

create index trade_messages_trade_idx on public.trade_messages (trade_id, created_at);

-- --------------------------------------------------------------- reviews ----

-- One review per counterparty per trade; backs the rating and feedback figures
-- shown on a profile.
create table public.trade_reviews (
  trade_id    uuid not null references public.trades(id) on delete cascade,
  reviewer    text not null references public.traders(address) on delete cascade,
  subject     text not null references public.traders(address) on delete cascade,
  positive    boolean not null,
  comment     text,
  created_at  timestamptz not null default now(),
  primary key (trade_id, reviewer),
  constraint reviews_not_self check (reviewer <> subject)
);

create index trade_reviews_subject_idx on public.trade_reviews (subject);

-- ----------------------------------------------------- derived statistics ----

-- A view, not columns: these must never drift from the trades that produced
-- them. Swap for a materialized view if the read cost shows up.
create view public.trader_stats as
select
  t.address,
  count(*) filter (where tr.status = 'released')                     as total_trades,
  round(
    100.0 * count(*) filter (where tr.status = 'released')
    / nullif(count(*) filter (where tr.status in ('released', 'cancelled')), 0),
    1
  )                                                                  as completion_rate,
  round(
    avg(extract(epoch from (tr.settled_at - tr.paid_at)) / 60)
      filter (where tr.status = 'released' and tr.paid_at is not null)
  )::int                                                             as avg_release_minutes,
  round(
    100.0 * count(*) filter (where rv.positive)
    / nullif(count(rv.*), 0),
    1
  )                                                                  as positive_feedback,
  coalesce(
    sum(tr.asset_amount) filter (
      where tr.status = 'released' and tr.settled_at > now() - interval '30 days'
    ),
    0
  )                                                                  as volume_30d
from public.traders t
left join public.trades tr on tr.maker = t.address or tr.taker = t.address
left join public.trade_reviews rv on rv.subject = t.address
group by t.address;

-- ------------------------------------------------------------ updated_at ----

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger traders_touch          before update on public.traders
  for each row execute function public.touch_updated_at();
create trigger verifications_touch    before update on public.trader_verifications
  for each row execute function public.touch_updated_at();
create trigger ads_touch              before update on public.ads
  for each row execute function public.touch_updated_at();
create trigger trades_touch           before update on public.trades
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS ----

-- Enabled with no permissive policies: anon and authenticated get nothing, and
-- the server's service-role key bypasses RLS. Deliberate — see the header.
alter table public.traders              enable row level security;
alter table public.trader_verifications enable row level security;
alter table public.ads                  enable row level security;
alter table public.trades               enable row level security;
alter table public.trade_messages       enable row level security;
alter table public.trade_reviews        enable row level security;
