"use client";

import * as React from "react";
import { PROFILE } from "./mock-profile";

const STORAGE_KEY = "safeswap:nickname";

/**
 * The nickname, overridable and persisted.
 *
 * An external store rather than component state, for the same reason as the
 * rest: it has to outlive route changes and be readable from more than one
 * screen, and `useSyncExternalStore` keeps the localStorage read out of
 * render. The server snapshot is the fixture value.
 *
 * Seam: a real build writes this to the trader's profile record.
 */
const listeners = new Set<() => void>();
let nickname: string = PROFILE.nickname;

function read() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || PROFILE.nickname;
  } catch {
    return PROFILE.nickname;
  }
}

if (typeof window !== "undefined") nickname = read();

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  nickname = read();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function setNickname(next: string) {
  nickname = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Won't survive a reload, but the session keeps it.
  }
  for (const listener of listeners) listener();
}

export function useNickname() {
  return React.useSyncExternalStore(
    subscribe,
    () => nickname,
    () => PROFILE.nickname,
  );
}

/**
 * Unicode letter and number classes, not ASCII ranges — this market writes
 * names like José and Andrés, and rejecting them would be a bug, not a rule.
 * A leading separator is still disallowed.
 */
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

/** Returns an error message, or undefined when the value is acceptable. */
export function validateNickname(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 3) return "At least 3 characters.";
  if (trimmed.length > 20) return "At most 20 characters.";
  if (!NICKNAME_PATTERN.test(trimmed)) {
    return "Letters and numbers, plus spaces . _ - after the first character.";
  }
  return undefined;
}
