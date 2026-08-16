/**
 * The rails SafeSwap supports.
 *
 * A product decision, not data — which is why it is a constant rather than a
 * table or something derived from whatever ads happen to exist.
 *
 * Costa Rican rails only: SINPE Móvil plus the local banks. International
 * options (Wise, Zelle) were dropped to keep the first market local.
 *
 * Note this sits uneasily with `MARKET.fiat` still being USD — SINPE Móvil
 * settles in colones. See the note in docs/UI-REBUILD-SPEC.md §1.
 */
export const PAYMENT_METHODS = [
  "SINPE Móvil",
  "BAC Credomatic",
  "Banco Nacional",
  "Banco Popular",
  "Scotiabank",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
