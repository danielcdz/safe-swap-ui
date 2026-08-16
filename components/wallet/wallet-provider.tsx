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
  /** What the extension reports. Claimed, not proven. */
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  /** True once the silent restore attempt has finished. */
  ready: boolean;
  connecting: boolean;
  authenticating: boolean;
  error: WalletError | null;
  /** Connected, but Freighter is pointed somewhere we won't sign against. */
  wrongNetwork: boolean;
  /**
   * The address the *server* has verified by signature. This is the one that
   * means "signed in" — `address` alone proves nothing.
   */
  sessionAddress: string | null;
}

export interface WalletContextValue extends WalletState {
  /** Connect the wallet only. Resolves with the address, or null on failure. */
  connect: () => Promise<string | null>;
  /** Connect if needed, then prove ownership to the server. */
  signIn: () => Promise<void>;
  /** Drop the server session and the wallet connection. */
  signOut: () => Promise<void>;
  clearError: () => void;
  signTransaction: (xdr: string) => Promise<string>;
  /** SEP-53 signature, normalised to base64. */
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

/**
 * Signs with an explicitly passed address rather than reading state.
 *
 * `signIn` connects and signs within one call, and React state set during that
 * call is not readable until the next render — so the address has to travel as
 * an argument or the signature would be requested for a stale account.
 */
async function signMessageAs(address: string, message: string): Promise<string> {
  const result = await freighterSignMessage(message, { address });

  const errorMessage = errorMessageOf(result);
  if (errorMessage) throw toWalletError(new Error(errorMessage), "sign-failed");

  const { signedMessage } = result;
  if (!signedMessage) {
    throw new WalletError("sign-failed", "Freighter returned no signature.");
  }

  // Union across Freighter versions: base64 string in v4, Buffer in v3.
  return typeof signedMessage === "string"
    ? signedMessage
    : Buffer.from(signedMessage).toString("base64");
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WalletState>({
    address: null,
    network: null,
    networkPassphrase: null,
    ready: false,
    connecting: false,
    authenticating: false,
    error: null,
    wrongNetwork: false,
    sessionAddress: null,
  });

  const patch = React.useCallback((next: Partial<WalletState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const watcher = new WatchWalletChanges(WATCH_INTERVAL_MS);

    async function restoreWallet() {
      const installed = await isConnected();
      if (cancelled) return;

      if (errorMessageOf(installed) || !installed.isConnected) {
        patch({ ready: true });
        return;
      }

      // Only restore if this browser connected before. getAddress() does not
      // prompt, but skipping it avoids waking the extension for new visitors.
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
        wrongNetwork:
          Boolean(net.network) && net.network !== EXPECTED_NETWORK.name,
        ready: true,
      });

      watcher.watch(({ address, network, networkPassphrase }) => {
        if (cancelled) return;
        const next = isStellarAddress(address ?? "") ? address : null;

        setState((current) => ({
          ...current,
          address: next,
          network: network ?? null,
          networkPassphrase: networkPassphrase ?? null,
          wrongNetwork: Boolean(network) && network !== EXPECTED_NETWORK.name,
          // Switching accounts in the extension must not leave the previous
          // account's session standing — the session belongs to an address,
          // not to the browser.
          sessionAddress:
            current.sessionAddress && current.sessionAddress !== next
              ? null
              : current.sessionAddress,
        }));
      });
    }

    // Ask the server who it thinks we are, independently of the extension: the
    // cookie can outlive a load where Freighter is slow or locked.
    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { address: string | null };
        if (!cancelled && data.address) patch({ sessionAddress: data.address });
      } catch {
        // Offline, or the route is unavailable — stay unauthenticated.
      }
    }

    void restoreWallet();
    void restoreSession();

    return () => {
      cancelled = true;
      watcher.stop();
    };
  }, [patch]);

  const connect = React.useCallback(async (): Promise<string | null> => {
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

      if (network && network !== EXPECTED_NETWORK.name) return null;
      return access.address;
    } catch (error) {
      patch({ connecting: false, error: toWalletError(error, "unknown") });
      return null;
    }
  }, [patch]);

  const signOut = React.useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // The cookie expires on its own; losing the round trip is not fatal.
    }
    // Freighter has no revoke API — this drops our session. The origin stays on
    // the extension's allow list until the user removes it there.
    window.localStorage.removeItem(RECONNECT_KEY);
    patch({
      address: null,
      network: null,
      networkPassphrase: null,
      wrongNetwork: false,
      sessionAddress: null,
      error: null,
    });
  }, [patch]);

  const signIn = React.useCallback(async () => {
    patch({ authenticating: true, error: null });

    try {
      const address = state.address ?? (await connect());
      // connect() has already recorded why, including a wrong network.
      if (!address) {
        patch({ authenticating: false });
        return;
      }

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!challengeResponse.ok) {
        throw new WalletError("unknown", "Could not start sign-in.");
      }

      const { message, nonce } = (await challengeResponse.json()) as {
        message: string;
        nonce: string;
      };

      const signature = await signMessageAs(address, message);

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nonce, signature }),
      });

      if (!verifyResponse.ok) {
        throw new WalletError(
          "sign-failed",
          "The server could not verify that signature.",
        );
      }

      const verified = (await verifyResponse.json()) as { address: string };
      patch({ sessionAddress: verified.address, authenticating: false });
    } catch (error) {
      patch({ authenticating: false, error: toWalletError(error, "unknown") });
    }
  }, [state.address, connect, patch]);

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
        // The wallet's own passphrase, not a hardcoded one — a mismatched
        // passphrase produces a signature for the wrong network.
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
    async (message: string) => signMessageAs(assertSignable(), message),
    [assertSignable],
  );

  const value = React.useMemo<WalletContextValue>(
    () => ({
      ...state,
      connect,
      signIn,
      signOut,
      clearError,
      signTransaction,
      signMessage,
    }),
    [state, connect, signIn, signOut, clearError, signTransaction, signMessage],
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
