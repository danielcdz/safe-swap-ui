"use client";

import { getSessionScope, subscribeSessionScope } from "./client-session";

/**
 * A client cache bound to the signed-in account.
 *
 * The bug this exists to prevent: a module-level cache that fetches once and
 * never again keeps serving the first account's data after the user switches
 * wallets. The address on screen updates — it comes from the extension — while
 * the nickname and ads do not, so one account's data renders under another's
 * identity.
 *
 * Here the cached value carries the scope it was loaded under. When the
 * session changes the value is dropped immediately, rather than waiting for a
 * refetch, so nothing renders stale data even for one frame.
 */
export function createScopedStore<T>(load: () => Promise<T>, empty: T) {
  let value: T = empty;
  /** `undefined` means never loaded, which is distinct from `null` (signed out). */
  let loadedFor: string | null | undefined = undefined;
  let loading = false;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  async function refresh() {
    const target = getSessionScope();
    loading = true;

    let next: T;
    try {
      next = await load();
    } catch {
      next = empty;
    }

    loading = false;

    // The account may have changed while this was in flight. Discard the
    // answer rather than attributing it to whoever is signed in now — and load
    // again for whoever is signed in, because `ensureFresh` bailed out while
    // this request was running. Without that second call the new account never
    // loads at all: on a cold page the scope starts null, this fetches, and
    // the session restores mid-flight.
    if (getSessionScope() !== target) {
      ensureFresh();
      return;
    }

    value = next;
    loadedFor = target;
    emit();
  }

  function ensureFresh() {
    if (loading) return;
    if (loadedFor !== getSessionScope()) void refresh();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);

    const stopWatchingScope = subscribeSessionScope(() => {
      // Drop first, reload second: the old value belongs to an account that is
      // no longer signed in.
      value = empty;
      loadedFor = undefined;
      emit();
      ensureFresh();
    });

    ensureFresh();

    return () => {
      listeners.delete(listener);
      stopWatchingScope();
    };
  }

  return {
    subscribe,
    getSnapshot: () => value,
    getServerSnapshot: () => empty,
    /** Force a refetch, e.g. after a write. */
    invalidate() {
      loadedFor = undefined;
      ensureFresh();
    },
    /** Replace the cached value after a write that already returned it. */
    set(next: T) {
      value = next;
      loadedFor = getSessionScope();
      emit();
    },
  };
}
