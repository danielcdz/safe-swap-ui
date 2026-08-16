/**
 * The network SafeSwap expects a wallet to be on.
 *
 * Testnet for now. This is the single declaration — the provider refuses to
 * sign when Freighter reports anything else, rather than signing against the
 * wrong chain, which is the bug the previous app shipped by hardcoding the
 * passphrase at the call site.
 */
export const EXPECTED_NETWORK = {
  /** Freighter's `network` value. */
  name: "TESTNET",
  /** Well-known constant; also `Networks.TESTNET` in @stellar/stellar-sdk. */
  passphrase: "Test SDF Network ; September 2015",
  label: "Testnet",
} as const;

export type WalletErrorCode =
  | "not-installed"
  | "rejected"
  | "wrong-network"
  | "sign-failed"
  | "unknown";

export class WalletError extends Error {
  readonly code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

/** Shape check only. A real address also carries a CRC16 checksum. */
export function isStellarAddress(value: string) {
  return /^G[A-Z2-7]{55}$/.test(value);
}
