-- Profile pictures. A trader can set one; everyone they trade with sees it.
--
-- The bytes go to a private bucket and are served through a route that checks
-- the session, the same as trade attachments. A public bucket would be simpler
-- and would also put a face on a permanent, guessable URL keyed by wallet
-- address -- a stranger could link the two without ever signing in. Visible to
-- traders is the intent; visible to the internet is not.
alter table traders
  add column avatar_path text,
  add column avatar_mime text;

comment on column traders.avatar_path is
  'Object name in the private trader-avatars bucket. Null means no picture, and the UI falls back to the address-derived badge.';

-- Half a picture is no picture: the serving route needs both to answer.
alter table traders add constraint traders_avatar_complete
  check ((avatar_path is null) = (avatar_mime is null));

alter table traders add constraint traders_avatar_mime
  check (avatar_mime is null
         or avatar_mime in ('image/jpeg', 'image/png', 'image/webp'));

-- 1MB: the client crops to a square thumbnail before uploading, so anything
-- near this is already something other than what we asked for.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trader-avatars', 'trader-avatars', false, 1048576,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The book is where a face does the most work, so the view carries it. Column
-- appended, so the existing ones keep their position for `create or replace`.
create or replace view public.order_book
with (security_invoker = on) as
 SELECT a.id,
    a.advertiser,
    a.side,
    a.price_type,
    a.price,
    a.margin_percent,
    (a.total_amount - a.reserved_amount)::numeric(20,7) AS total_amount,
    a.min_limit,
    a.max_limit,
    a.window_minutes,
    a.payment_methods,
    a.terms,
    a.created_at,
    t.nickname,
    COALESCE(v.status = 'verified'::verify_status, false) AS verified,
    COALESCE(s.total_trades, 0::bigint) AS ops_count,
    s.completion_rate,
    s.positive_feedback,
    t.avatar_path
   FROM ads a
     JOIN traders t ON t.address = a.advertiser
     LEFT JOIN trader_verifications v ON v.trader_address = a.advertiser AND v.method = 'id'::verify_method
     LEFT JOIN trader_stats s ON s.address = a.advertiser
  WHERE a.status = 'active'::ad_status AND (a.total_amount - a.reserved_amount) > 0::numeric;
