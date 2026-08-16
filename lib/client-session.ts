"use client";

/**
 * The wallet address the server has verified, published for anything that
 * caches per-account data.
 *
 * Client caches have to know *whose* data they hold. Without this, switching
 * accounts in the extension leaves every module-level cache serving the
 * previous account's nickname and ads under the new account's address.
 *
 * The wallet provider is the only writer.
 */
let scope: string | null = null;
const listeners = new Set<() => void>();

export function getSessionScope() {
  return scope;
}

export function setSessionScope(address: string | null) {
  if (scope === address) return;
  scope = address;
  for (const listener of listeners) listener();
}

export function subscribeSessionScope(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
