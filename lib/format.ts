/** Shared number/address formatting. Explicit locales keep SSR and the client
 *  in agreement, and every figure that lands in a column is tabular-nums. */

const fiatFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const assetFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// USDC trades within a cent of parity, so two decimals would flatten every
// offer to 1.00. Three is enough to separate them and matches the convention.
const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** $3,000 */
export function formatFiat(value: number) {
  return fiatFormatter.format(value);
}

/** 4,820.50 */
export function formatAsset(value: number) {
  return assetFormatter.format(value);
}

/** 1.002 */
export function formatPrice(value: number) {
  return priceFormatter.format(value);
}

/** GDRX…UJUJ — 4 head, 4 tail, per the brand's address convention. */
export function truncateAddress(address: string, head = 4, tail = 4) {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
