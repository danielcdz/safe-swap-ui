/**
 * The rails SafeSwap supports for USDC/USD.
 *
 * A product decision, not data — which is why it is a constant rather than a
 * table or something derived from whatever ads happen to exist. It was
 * previously inferred from the order fixtures, so an empty book meant an empty
 * filter.
 *
 * All of these settle in dollars. Colón rails such as SINPE Móvil belong to a
 * different market, not to this list.
 */
export const PAYMENT_METHODS = [
  "BAC Credomatic",
  "Banco Nacional",
  "Scotiabank",
  "Wise",
  "Zelle",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
