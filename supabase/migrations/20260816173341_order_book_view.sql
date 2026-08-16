-- The order book, assembled once.
--
-- A book row is an ad plus the advertiser's trust block, which lives across
-- three places: traders, trader_verifications and the trader_stats view.
-- Doing that join here means the API and any future consumer cannot assemble
-- it differently.
--
-- `side` is the ADVERTISER's side. The tab a row appears under is the
-- opposite, and that inversion stays in one TypeScript function
-- (bookModeFor) rather than being duplicated here — see
-- docs/UI-REBUILD-SPEC.md §5.3.
create view public.order_book as
select
  a.id,
  a.advertiser,
  a.side,
  a.price_type,
  a.price,
  a.margin_percent,
  a.total_amount,
  a.min_limit,
  a.max_limit,
  a.window_minutes,
  a.payment_methods,
  a.terms,
  a.created_at,
  t.nickname,
  -- Only the government ID check earns the public mark, matching the rule the
  -- UI enforces.
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
where a.status = 'active';
