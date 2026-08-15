"use client";

import * as React from "react";

/**
 * Hydration-safe mounted flag: the server snapshot is false, the client's is
 * true. Anything whose output depends on the local clock or timezone has to
 * wait for this, or SSR and hydration disagree.
 */
export function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
