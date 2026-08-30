-- trader_stats was written against the escrow vocabulary and never revisited
-- when manual settlement landed. Three things were wrong with it.
--
-- 1. It counted only `released`. A manual trade finishes as `completed`, so
--    the view reported zero for every real trade in the database.
-- 2. Average release time measured `settled_at - paid_at`, and nothing in the
--    manual flow ever writes `paid_at` -- `fiat_sent_at` is its equivalent.
-- 3. Joining trades and reviews in one query multiplied them together: a
--    trader with 3 trades and 2 reviews counted 6 trades, and their volume
--    doubled. Invisible today because there are no reviews yet, and wrong the
--    moment there is one. The two aggregates are now computed separately.
--
-- Also adds all-time volume, and the review count -- the latter so a caller
-- can tell "no reviews yet" from "reviewed, and none were positive". Both are
-- appended, so the existing columns keep their position for `create or
-- replace`.
--
-- security_invoker stays on: without it the view runs as its creator and
-- bypasses the deny-all RLS on the tables underneath.
create or replace view public.trader_stats
with (security_invoker = on) as
with trades_by_trader as (
  select
    t.address,
    count(*) filter (where tr.status in ('released', 'completed')) as settled,
    count(*) filter (where tr.status in ('released', 'completed', 'cancelled')) as closed,
    round(
      avg(
        extract(epoch from tr.settled_at - coalesce(tr.paid_at, tr.fiat_sent_at)) / 60
      ) filter (
        where tr.status in ('released', 'completed')
          and coalesce(tr.paid_at, tr.fiat_sent_at) is not null
      )
    )::integer as avg_release_minutes,
    coalesce(sum(tr.asset_amount) filter (
      where tr.status in ('released', 'completed')
        and tr.settled_at > now() - interval '30 days'
    ), 0) as volume_30d,
    coalesce(sum(tr.asset_amount) filter (
      where tr.status in ('released', 'completed')
    ), 0) as volume_all_time
  from traders t
  left join trades tr on tr.maker = t.address or tr.taker = t.address
  group by t.address
),
reviews_by_trader as (
  select
    t.address,
    count(rv.*) as review_count,
    count(*) filter (where rv.positive) as positive
  from traders t
  left join trade_reviews rv on rv.subject = t.address
  group by t.address
)
select
  tt.address,
  tt.settled as total_trades,
  -- Null rather than zero when nothing has closed: a trader with no settled
  -- and no cancelled trades has no completion rate, which is not the same as
  -- a rate of nought.
  round(100.0 * tt.settled / nullif(tt.closed, 0), 1) as completion_rate,
  tt.avg_release_minutes,
  round(100.0 * rt.positive / nullif(rt.review_count, 0), 1) as positive_feedback,
  tt.volume_30d,
  tt.volume_all_time,
  rt.review_count
from trades_by_trader tt
join reviews_by_trader rt on rt.address = tt.address;
