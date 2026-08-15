import { CONNECTED_ADDRESS } from "@/lib/wallet";

/**
 * Seam: the signed-in trader's public record. A real build derives these from
 * settled escrows on-chain; the numbers here are fixtures.
 *
 * `joinedAt` is a plain date string formatted with a pinned timezone — a
 * timestamp would render differently on the server and the client.
 */
export const PROFILE = {
  nickname: "TicoSwapper",
  address: CONNECTED_ADDRESS,
  joinedAt: "2025-03-14",
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

export function joinedLabel() {
  return joinedFormatter.format(new Date(`${PROFILE.joinedAt}T00:00:00Z`));
}
