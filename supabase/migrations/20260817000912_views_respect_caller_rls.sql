-- `order_book` and `trader_stats` were SECURITY DEFINER, the Postgres default.
-- A view defined that way runs as its creator, so it bypasses the deny-all RLS
-- on the tables underneath it — and `anon` holds SELECT on both. Anyone with a
-- publishable key could have read them straight from /rest/v1, going around
-- the app entirely.
--
-- Nothing confidential was exposed: both views carry order-book data the app
-- shows to everyone anyway. But the guarantee written in the schema doc is
-- "the secret key is the only way in", and these two were a hole in it.
--
-- security_invoker makes the view run as whoever queries it. The app's secret
-- key bypasses RLS through its own role, so it is unaffected; `anon` now meets
-- the same deny-all as every table.
alter view public.order_book set (security_invoker = on);
alter view public.trader_stats set (security_invoker = on);
