-- Manual settlement: the states a trade moves through when both transfers are
-- performed by the users themselves.
--
-- Added to the existing enum rather than replacing it. Escrow is deferred, not
-- removed — `pending`, `funded`, `released` and `escrow_contract_id` all stay
-- for when it returns.
--
-- Separate migration because ALTER TYPE ... ADD VALUE cannot be used in the
-- same transaction that then references the new value.
alter type escrow_status add value if not exists 'open';
alter type escrow_status add value if not exists 'fiat_sent';
alter type escrow_status add value if not exists 'fiat_confirmed';
alter type escrow_status add value if not exists 'asset_sent';
alter type escrow_status add value if not exists 'completed';
