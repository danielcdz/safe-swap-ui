create type settlement_kind as enum ('manual', 'escrow');

alter table public.trades
  add column settlement        settlement_kind not null default 'manual',
  add column fiat_sent_at      timestamptz,
  add column fiat_confirmed_at timestamptz,
  add column asset_sent_at     timestamptz,
  -- Recorded so the buyer can verify the transfer on a block explorer rather
  -- than taking the seller's word. The app does not read Horizon yet.
  add column asset_tx_hash     text
    check (asset_tx_hash is null or asset_tx_hash ~ '^[0-9a-f]{64}$');

comment on column public.trades.settlement is
  'manual = both transfers performed by the users. escrow = held by contract, deferred.';

-- The existing constraint assumed the escrow vocabulary. A manual trade ends
-- at `completed`, and `released` remains valid for when escrow returns.
alter table public.trades drop constraint trades_settled_when_terminal;

alter table public.trades add constraint trades_settled_when_terminal
  check (
    (status in ('released', 'cancelled', 'completed')) = (settled_at is not null)
  );

-- Payment details: where a buyer actually sends the fiat.
--
-- PII. Disclosed only to the counterparty of an active trade — never through
-- the order book, and never on a public profile. The API enforces that; these
-- columns simply hold it.
alter table public.traders
  add column sinpe_phone  text check (sinpe_phone is null or sinpe_phone ~ '^[0-9+ -]{8,20}$'),
  add column bank_name    text check (bank_name is null or char_length(bank_name) between 2 and 60),
  add column bank_account text check (bank_account is null or char_length(bank_account) between 4 and 40);

comment on column public.traders.sinpe_phone is
  'PII — disclose only to an active trade counterparty.';
