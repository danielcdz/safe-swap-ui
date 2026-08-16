/**
 * Seam: the signed-in trader's public record. A real build derives these from
 * settled escrows on-chain; the numbers here are fixtures.
 *
 * Address, nickname and joined date are deliberately absent — those are real
 * now, served from `traders`. Only the statistics remain fixtures, because
 * they need settled trades that do not exist yet.
 *
 * `joinedAt` is a plain date string formatted with a pinned timezone — a
 * timestamp would render differently on the server and the client.
 */
export const PROFILE = {
  rating: 4.91,
  totalTrades: 184,
  completionRate: 98.9,
  avgReleaseMinutes: 12,
  volume30d: 42500,
  positiveFeedback: 99.2,
} as const;

const joinedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Pinned to UTC so the server and client agree. A timestamp formatted in the
 * viewer's zone would be a hydration mismatch.
 */
export function joinedLabel(isoDate: string) {
  return joinedFormatter.format(new Date(isoDate));
}
