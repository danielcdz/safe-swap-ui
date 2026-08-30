-- An attachment is a message kind, not a second table: the chat is one ordered
-- stream and an image belongs in it alongside the conversation and the system
-- events. Extending the enum mirrors how escrow_status gained the manual
-- states rather than being replaced.
--
-- Alone in its own migration because a new enum value cannot be referenced by
-- the same transaction that adds it -- the reason manual_trade_states and
-- manual_trade_columns are also split.
alter type message_kind add value 'image';
