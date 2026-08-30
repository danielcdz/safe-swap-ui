"use client";

import * as React from "react";
import { downscaleImage } from "@/lib/image/downscale";
import type { TradeMessage } from "./types";

/**
 * How often the conversation refreshes.
 *
 * Polling rather than SSE or a socket: a trade's payment window runs 10–30
 * minutes against an 800s maximum function duration, so a streamed connection
 * could not outlive a trade and would need reconnection logic anyway — for
 * latency imperceptible next to a bank transfer. Swapping the transport means
 * changing this file and nothing else.
 */
const POLL_MS = 3000;

interface ApiMessage {
  id: string;
  kind: "text" | "system" | "image";
  author: string | null;
  body: string;
  createdAt: string;
  attachment?: { mime: string; bytes: number; width: number; height: number };
}

/** Maps a stored message to the shape the bubbles render. */
function toBubble(
  message: ApiMessage,
  viewer: string,
  tradeId: string,
): TradeMessage {
  return {
    id: message.id,
    author:
      message.kind === "system"
        ? "system"
        : message.author === viewer
          ? "self"
          : "counterparty",
    text: message.body,
    timestamp: new Date(message.createdAt).getTime(),
    // Stored at all means it reached the server; there is no read receipt yet.
    delivery:
      message.kind !== "system" && message.author === viewer
        ? "sent"
        : undefined,
    ...(message.attachment
      ? {
          image: {
            // Our route, not a storage URL: it re-checks the session on every
            // request, and it is stable enough for the browser to cache.
            url: `/api/trades/${tradeId}/messages/${message.id}/image`,
            width: message.attachment.width,
            height: message.attachment.height,
          },
        }
      : {}),
  };
}

export function useTradeMessages(tradeId: string, viewer: string) {
  const [messages, setMessages] = React.useState<TradeMessage[]>([]);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/trades/${tradeId}/messages`, {
          cache: "no-store",
          signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { messages: ApiMessage[] };
        setMessages(data.messages.map((m) => toBubble(m, viewer, tradeId)));
      } catch {
        // Transient; the next tick tries again.
      }
    },
    [tradeId, viewer],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    // Chained rather than an interval: each poll waits for the previous one, so
    // a slow response cannot pile requests up behind it. The first run is on a
    // zero-delay timer so nothing sets state directly in the effect body.
    async function tick() {
      await load(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(tick, POLL_MS);
    }

    timer = setTimeout(tick, 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [load]);

  const send = React.useCallback(
    async (text: string) => {
      setSending(true);
      setError(null);
      try {
        const response = await fetch(`/api/trades/${tradeId}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? "Could not send.");
          return;
        }
        // Re-read rather than appending optimistically: the poll would
        // otherwise briefly show the message twice, once local and once stored.
        await load();
      } catch {
        setError("Could not reach the server.");
      } finally {
        setSending(false);
      }
    },
    [tradeId, load],
  );

  /**
   * Posts an image to the same endpoint as text — a message is a message, and
   * multipart rather than JSON is what says which kind. Re-reads afterwards
   * for the same reason `send` does.
   *
   * Returns whether it landed, so a caller that is doing something *else* on
   * the strength of the receipt — advancing the trade, say — can decline to.
   */
  const sendImage = React.useCallback(
    async (file: File): Promise<boolean> => {
      setUploading(true);
      setError(null);
      try {
        const { blob } = await downscaleImage(file);

        const form = new FormData();
        form.append("file", blob, "receipt");

        // No content-type header: the browser has to set the multipart
        // boundary itself.
        const response = await fetch(`/api/trades/${tradeId}/messages`, {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? "Could not send the image.");
          return false;
        }
        await load();
        return true;
      } catch (cause) {
        // downscaleImage explains itself — an unreadable file is the common
        // case and the message says what to try instead.
        setError(
          cause instanceof Error ? cause.message : "Could not reach the server.",
        );
        return false;
      } finally {
        setUploading(false);
      }
    },
    [tradeId, load],
  );

  // So a caller can open a fresh surface — the proof dialog — without a
  // failure from an earlier send greeting them there.
  const clearError = React.useCallback(() => setError(null), []);

  return { messages, send, sendImage, sending, uploading, error, clearError };
}
