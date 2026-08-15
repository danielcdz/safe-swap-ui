"use client";

import * as React from "react";

/**
 * Persisted collapse state, keyed so several panels can each remember their
 * own. Backed by an external store for the same reason the orders list is:
 * reading localStorage during render is a hydration mismatch, and
 * `useSyncExternalStore` gives an empty server snapshot with the real one
 * after hydration.
 */
const values = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

function listenersFor(key: string) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function emit(key: string) {
  for (const listener of listenersFor(key)) listener();
}

export function setCollapsed(key: string, next: boolean) {
  values.set(key, next);
  try {
    window.localStorage.setItem(key, String(next));
  } catch {
    // Private mode or a full quota — the preference won't survive a reload.
  }
  emit(key);
}

export function useCollapsed(key: string) {
  const subscribe = React.useCallback(
    (listener: () => void) => {
      const set = listenersFor(key);
      set.add(listener);

      // First subscriber for this key hydrates it. The default is false, so
      // only a stored `true` is a change worth announcing.
      if (!values.has(key)) {
        const stored = read(key);
        values.set(key, stored);
        if (stored) listener();
      }

      function handleStorage(event: StorageEvent) {
        if (event.key !== key) return;
        values.set(key, read(key));
        emit(key);
      }

      window.addEventListener("storage", handleStorage);
      return () => {
        set.delete(listener);
        window.removeEventListener("storage", handleStorage);
      };
    },
    [key],
  );

  const collapsed = React.useSyncExternalStore(
    subscribe,
    () => values.get(key) ?? false,
    () => false,
  );

  const toggle = React.useCallback(
    (next: boolean) => setCollapsed(key, next),
    [key],
  );

  return [collapsed, toggle] as const;
}
