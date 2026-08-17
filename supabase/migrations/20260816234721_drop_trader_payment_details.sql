-- Payment details are exchanged in the trade chat, between the two people who
-- need them, and are never stored.
--
-- Dropping the columns rather than leaving them unused is the point: data that
-- does not exist cannot leak, cannot be subpoenaed, and cannot be shown to the
-- wrong counterparty by a future bug. The CHECK constraints go with them.
--
-- The chat messages themselves may contain what two traders chose to send each
-- other. That is their disclosure to make, scoped to one trade, and readable
-- only by its two participants.
alter table public.traders
  drop column if exists sinpe_phone,
  drop column if exists bank_name,
  drop column if exists bank_account;
