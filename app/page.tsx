import { ConnectScreen } from "@/components/auth/connect-screen";

/**
 * Wallet connect is the front door — SafeSwap runs as a dApp, so there is no
 * marketing landing and no credential flow. Title and description come from
 * the root layout's defaults.
 */
export default function HomePage() {
  return <ConnectScreen />;
}
