"use client";

import * as React from "react";
import type { EscrowStatus } from "./types";

const STORAGE_KEY = "safeswap:open-orders";

export interface OpenOrder {
  orderId: string;
  /** The amount as typed in the book, in that side's own denomination. */
  amount: number;
  method: string;
  status: EscrowStatus;
  createdAt: number;
  /**
   * What the offer looked like when the trade was opened.
   *
   * Denormalised for the same reason `trades` is in the database: an ad can be
   * edited or taken down, and this row has to keep showing what was agreed.
   * It also means the list renders without a lookup per row.
   */
  snapshot?: {
    mode: "buy" | "sell";
    price: number;
    nickname: string;
    address: string;
  };
}

/**
 * Open trades, held on the client.
 *
 * An external store rather than component state: the list has to outlive
 * route changes, and `useSyncExternalStore` gives an empty server snapshot
 * with the real one after hydration, so restoring from localStorage can't
 * cause a mismatch.
 *
 * Seam: this is where a real persistence layer plugs in.
 */
const EMPTY: OpenOrder[] = [];
let orders: OpenOrder[] = EMPTY;
const listeners = new Set<() => void>();

function read(): OpenOrder[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as OpenOrder[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Private mode or a full quota — the list simply won't survive a reload.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: OpenOrder[]) {
  orders = next;
  write();
  emit();
}

// Runs when the bundle loads on the client, before the first render. React
// still hydrates against the server snapshot, then re-reads this one.
if (typeof window !== "undefined") orders = read();

function handleStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  orders = read();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

/** One open trade per order — reopening the same offer replaces its record. */
export function openOrder(record: OpenOrder) {
  commit([
    record,
    ...orders.filter((order) => order.orderId !== record.orderId),
  ]);
}

export function setOpenOrderStatus(orderId: string, status: EscrowStatus) {
  if (!orders.some((order) => order.orderId === orderId)) return;
  commit(
    orders.map((order) =>
      order.orderId === orderId ? { ...order, status } : order,
    ),
  );
}

export function removeOpenOrder(orderId: string) {
  commit(orders.filter((order) => order.orderId !== orderId));
}

export function useOpenOrders() {
  return React.useSyncExternalStore(
    subscribe,
    () => orders,
    () => EMPTY,
  );
}

/** Which statuses count as still in flight. Shared by the panel and summary. */
export const OPEN_STATUSES: EscrowStatus[] = ["pending", "funded", "disputed"];

export function isOpenStatus(status: EscrowStatus) {
  return OPEN_STATUSES.includes(status);
}
