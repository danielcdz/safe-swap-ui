"use client";

import * as React from "react";
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signMessage as freighterSignMessage,
  signTransaction as freighterSignTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import {
  EXPECTED_NETWORK,
  isStellarAddress,
  WalletError,
  type WalletErrorCode,
} from "@/lib/wallet";

/**
 * Remembers that the user connected before, so a reload can restore silently
 * via `getAddress()` — which does not prompt. Never trusted as identity: the
 * address is always re-read from the extension.
 */
const RECONNECT_KEY = "safeswap:wallet-connected";

/** How often WatchWalletChanges polls the extension. */
const WATCH_INTERVAL_MS = 1500;

export interface WalletState {
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  /** True once the silent restore attempt has finished. */
  ready: boolean;
  connecting: boolean;
  error: WalletError | null;
  /** Connected, but Freighter is pointed somewhere we won't sign against. */
  wrongNetwork: boolean;
}

export interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
  /** Returns the signed XDR. */
  signTransaction: (xdr: string) => Promise<string>;
  /** SEP-53 message signature, normalised to base64. */
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = React.createContext<WalletContextValue | null>(null);

/** Every freighter-api call resolves with `{ ...result, error? }` — it never throws. */
function errorMessageOf(result: { error?: unknown }): string | null {
  const { error } = result;
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Freighter returned an error";
}

function toWalletError(error: unknown, fallback: WalletErrorCode): WalletError {
  if (error instanceof WalletError) return error;
  const message = error instanceof Error ? error.message : String(error);
  // Freighter reports a dismissed prompt as a plain error string.
  const rejected = /reject|denied|declin|cancel/i.test(message);
  return new WalletError(rejected ? "rejected" : fallback, message);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WalletState>({
    address: null,
    network: null,
    networkPassphrase: null,
    ready: false,
    connecting: false,
    error: null,
    wrongNetwork: false,
  });

  const patch = React.useCallback((next: Partial<WalletState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  // Silent restore, then watch for account and network switches. Both live in
  // one effect because the watcher should only run once we know the extension
  // is there.
  React.useEffect(() => {
    let cancelled = false;
    const watcher = new WatchWalletChanges(WATCH_INTERVAL_MS);

    async function restore() {
      const installed = await isConnected();
      if (cancelled) return;

      if (errorMessageOf(installed) || !installed.isConnected) {
        patch({ ready: true });
        return;
      }

      // Only attempt a restore if this browser connected before. getAddress()
      // does not prompt, but skipping it avoids waking the extension for
      // first-time visitors.
      if (window.localStorage.getItem(RECONNECT_KEY) !== "true") {
        patch({ ready: true });
        return;
      }

      const result = await getAddress();
      if (cancelled) return;

      if (errorMessageOf(result) || !isStellarAddress(result.address ?? "")) {
        patch({ ready: true });
        return;
      }

      const net = await getNetwork();
      if (cancelled) return;

      patch({
        address: result.address,
        network: net.network ?? null,
        networkPassphrase: net.networkPassphrase ?? null,
        wrongNetwork: Boolean(net.network) && net.network !== EXPECTED_NETWORK.name,
        ready: true,
      });

      watcher.watch(({ address, network, networkPassphrase }) => {
        if (cancelled) return;
        // An empty address means the extension was locked or access revoked.
        setState((current) => ({
          ...current,
          address: isStellarAddress(address ?? "") ? address : null,
          network: network ?? null,
          networkPassphrase: networkPassphrase ?? null,
          wrongNetwork: Boolean(network) && network !== EXPECTED_NETWORK.name,
        }));
      });
    }

    void restore();

    return () => {
      cancelled = true;
      watcher.stop();
    };
  }, [patch]);

  const connect = React.useCallback(async () => {
    patch({ connecting: true, error: null });

    try {
      const installed = await isConnected();
      if (errorMessageOf(installed) || !installed.isConnected) {
        throw new WalletError(
          "not-installed",
          "Freighter isn't installed in this browser.",
        );
      }

      const access = await requestAccess();
      const accessError = errorMessageOf(access);
      if (accessError) throw toWalletError(new Error(accessError), "rejected");
      if (!isStellarAddress(access.address ?? "")) {
        throw new WalletError("unknown", "Freighter did not return an address.");
      }

      const net = await getNetwork();
      const network = net.network ?? null;

      window.localStorage.setItem(RECONNECT_KEY, "true");
      patch({
        address: access.address,
        network,
        networkPassphrase: net.networkPassphrase ?? null,
        wrongNetwork: Boolean(network) && network !== EXPECTED_NETWORK.name,
        connecting: false,
      });
    } catch (error) {
      patch({ connecting: false, error: toWalletError(error, "unknown") });
    }
  }, [patch]);

  const disconnect = React.useCallback(() => {
    // Freighter has no "revoke" API — this drops our session. The origin stays
    // on the extension's allow list until the user removes it there.
    window.localStorage.removeItem(RECONNECT_KEY);
    patch({
      address: null,
      network: null,
      networkPassphrase: null,
      wrongNetwork: false,
      error: null,
    });
  }, [patch]);

  const clearError = React.useCallback(() => patch({ error: null }), [patch]);

  /** Shared guard: never sign without an address, and never on the wrong chain. */
  const assertSignable = React.useCallback(() => {
    if (!state.address) {
      throw new WalletError("unknown", "Connect a wallet first.");
    }
    if (state.network && state.network !== EXPECTED_NETWORK.name) {
      throw new WalletError(
        "wrong-network",
        `Switch Freighter to ${EXPECTED_NETWORK.label}. It's on ${state.network}.`,
      );
    }
    return state.address;
  }, [state.address, state.network]);

  const signTransaction = React.useCallback(
    async (xdr: string) => {
      const address = assertSignable();
      const result = await freighterSignTransaction(xdr, {
        address,
        // The wallet's own passphrase, not a hardcoded one — signing with a
        // mismatched passphrase produces a signature for the wrong network.
        networkPassphrase:
          state.networkPassphrase ?? EXPECTED_NETWORK.passphrase,
      });

      const message = errorMessageOf(result);
      if (message) throw toWalletError(new Error(message), "sign-failed");
      if (!result.signedTxXdr) {
        throw new WalletError("sign-failed", "Freighter returned no signature.");
      }
      return result.signedTxXdr;
    },
    [assertSignable, state.networkPassphrase],
  );

  const signMessage = React.useCallback(
    async (message: string) => {
      const address = assertSignable();
      const result = await freighterSignMessage(message, { address });

      const errorMessage = errorMessageOf(result);
      if (errorMessage) throw toWalletError(new Error(errorMessage), "sign-failed");

      const { signedMessage } = result;
      if (!signedMessage) {
        throw new WalletError("sign-failed", "Freighter returned no signature.");
      }

      // The return type is a union across Freighter versions: a base64 string
      // in v4+, a Buffer in v3. Normalise so callers only ever see base64.
      return typeof signedMessage === "string"
        ? signedMessage
        : Buffer.from(signedMessage).toString("base64");
    },
    [assertSignable],
  );

  const value = React.useMemo<WalletContextValue>(
    () => ({
      ...state,
      connect,
      disconnect,
      clearError,
      signTransaction,
      signMessage,
    }),
    [state, connect, disconnect, clearError, signTransaction, signMessage],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = React.useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return context;
}
