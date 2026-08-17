-- First cut of open_trade, which decremented `ads.total_amount` to reserve
-- inventory. Superseded by 20260816222730_reserve_inventory_separately, which
-- explains why: decrementing collides with the ads_limit_within_inventory
-- check. Left in place so the applied history and the repo agree.
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
  v_ad     public.ads%rowtype;
  v_trade  uuid;
begin
  update public.ads
     set total_amount = total_amount - p_asset_amount
   where id = p_ad_id
     and status = 'active'
     and total_amount >= p_asset_amount
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
     set total_amount = total_amount + v_trade.asset_amount
   where id = v_trade.ad_id;

  return true;
end;
$$;
