-- Image attachments for trade chat: a buyer showing the transfer reference for
-- the fiat leg. The bytes live in a private Storage bucket; the row carries
-- everything needed to render the bubble without reaching for the object.

alter table trade_messages
  add column attachment_path   text,
  add column attachment_mime   text,
  add column attachment_bytes  integer,
  add column attachment_width  integer,
  add column attachment_height integer;

comment on column trade_messages.attachment_path is
  'Object name in the private trade-attachments bucket. Never leaves the server.';
comment on column trade_messages.attachment_width is
  'Stored so the bubble can reserve space and not reflow as the image loads.';

-- An image may carry no caption; text and system still have to say something.
alter table trade_messages drop constraint trade_messages_body_check;
alter table trade_messages add constraint trade_messages_body_check
  check (char_length(body) <= 2000
         and (kind = 'image' or char_length(body) >= 1));

-- An image message is fully described, anything else carries no attachment.
-- Half-populated rows would render as a broken bubble with no way to tell
-- whether the object was ever uploaded.
alter table trade_messages add constraint messages_attachment_matches_kind
  check (
    case when kind = 'image'
      then attachment_path is not null and attachment_mime is not null
           and attachment_bytes is not null
           and attachment_width is not null and attachment_height is not null
      else attachment_path is null and attachment_mime is null
           and attachment_bytes is null
           and attachment_width is null and attachment_height is null
    end
  );

-- The server sniffs magic bytes before it ever gets here; this holds the same
-- line for anything else that writes to the table. SVG is absent on purpose --
-- it executes script.
alter table trade_messages add constraint messages_attachment_mime
  check (attachment_mime is null
         or attachment_mime in ('image/jpeg', 'image/png', 'image/webp'));

alter table trade_messages add constraint messages_attachment_bytes
  check (attachment_bytes is null
         or (attachment_bytes > 0 and attachment_bytes <= 4194304));

-- Private, and with no policies on storage.objects -- the same deny-all as
-- every table, for the same reason: identity is a wallet, so there is nothing
-- for a policy to match on and the secret key is the only way in.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-attachments', 'trade-attachments', false, 4194304,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
