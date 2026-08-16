-- Reserve inventory instead of decrementing it.
--
-- The previous migration subtracted from `total_amount` on every open trade,
-- which collides with `ads_limit_within_inventory` (max_limit <= total_amount
-- * price): an ad offering "max 900 per trade" fails that check once inventory
-- drains to 300. Lowering max_limit to compensate would silently rewrite the
-- advertiser's stated terms, which is worse.
--
-- So `total_amount` stays what the advertiser offered, and `reserved_amount`
-- tracks what open trades have committed. Available is the difference.
alter table public.ads
  add column reserved_amount numeric(20, 7) not null default 0
    check (reserved_amount >= 0),
  add constraint ads_reserved_within_total check (reserved_amount <= total_amount);

create or replace function public.open_trade(
  p_ad_id        uuid,
  p_taker        text,
  p_reference    text,
  p_fiat_amount  numeric,
  p_asset_amount numeric,
  p_method       text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ad    public.ads%rowtype;
  v_trade uuid;
begin
  -- Reserve first. A row comes back only if the ad was active and had enough
  -- unreserved inventory. Two concurrent callers for the same last units means
  -- exactly one matches; the loser gets nothing.
  update public.ads
     set reserved_amount = reserved_amount + p_asset_amount
   where id = p_ad_id
     and status = 'active'
     and total_amount - reserved_amount >= p_asset_amount
  returning * into v_ad;

  if not found then
    return null;
  end if;

  if v_ad.advertiser = p_taker then
    raise exception 'cannot trade with yourself' using errcode = 'check_violation';
  end if;

  insert into public.trades (
    reference, ad_id, maker, taker, price,
    fiat_amount, asset_amount, payment_method, window_minutes,
    status, settlement
  )
  values (
    p_reference, p_ad_id, v_ad.advertiser, p_taker, v_ad.price,
    p_fiat_amount, p_asset_amount, p_method, v_ad.window_minutes,
    'open', 'manual'
  )
  returning id into v_trade;

  return v_trade;
end;
$$;

-- Cancelling frees the reservation. Guarded so a double release cannot drive
-- reserved_amount negative.
create or replace function public.release_trade_reservation(p_trade_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trade public.trades%rowtype;
begin
  select * into v_trade from public.trades where id = p_trade_id;
  if not found then
    return false;
  end if;

  update public.ads
     set reserved_amount = greatest(0, reserved_amount - v_trade.asset_amount)
   where id = v_trade.ad_id;

  return true;
end;
$$;

-- The book must advertise what is actually takeable, not what was originally
-- offered. Recreated rather than replaced: CREATE OR REPLACE VIEW cannot change
-- a column's type, and the subtraction widens numeric(20,7) to numeric — hence
-- the cast back.
drop view public.order_book;

create view public.order_book as
select
  a.id,
  a.advertiser,
  a.side,
  a.price_type,
  a.price,
  a.margin_percent,
  (a.total_amount - a.reserved_amount)::numeric(20, 7) as total_amount,
  a.min_limit,
  a.max_limit,
  a.window_minutes,
  a.payment_methods,
  a.terms,
  a.created_at,
  t.nickname,
  coalesce(v.status = 'verified', false) as verified,
  coalesce(s.total_trades, 0)            as ops_count,
  s.completion_rate,
  s.positive_feedback
from public.ads a
join public.traders t
  on t.address = a.advertiser
left join public.trader_verifications v
  on v.trader_address = a.advertiser and v.method = 'id'
left join public.trader_stats s
  on s.address = a.advertiser
where a.status = 'active'
  and a.total_amount - a.reserved_amount > 0;
