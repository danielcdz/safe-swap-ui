"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { ShieldMark, WordmarkText } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.08, staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const mark: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE } },
};

/**
 * The front door. SafeSwap is wallet-only, so this screen has exactly one
 * thing to say and one thing to do — the mark holds the centre, the connect
 * action sits under it, and everything else stays out of the way.
 */
export function ConnectScreen() {
  const reduced = useReducedMotion();

  return (
    <main className="bg-aurora bg-grain relative isolate flex min-h-dvh w-full flex-col overflow-hidden">
      <ThemeToggle className="fixed end-4 bottom-4 z-50 bg-card shadow-lg" />
      <motion.div
        variants={container}
        initial={reduced ? false : "hidden"}
        animate="show"
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-12 px-4 py-12"
      >
        {/* The mark seated in concentric rings over a slow brand glow. */}
        <motion.div
          variants={mark}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative grid size-36 place-items-center">
            <span
              aria-hidden
              className="animate-breathe absolute size-28 rounded-full bg-primary/25 blur-3xl"
            />
            <span
              aria-hidden
              className="absolute size-36 rounded-full border border-primary/10"
            />
            <span
              aria-hidden
              className="absolute size-28 rounded-full border border-primary/20"
            />
            <span className="relative rounded-full bg-gradient-to-b from-primary/40 via-border to-border p-px shadow-xl shadow-primary/10">
              <span className="grid size-20 place-items-center rounded-full bg-card">
                <ShieldMark className="h-10 w-auto" />
              </span>
            </span>
          </div>

          <WordmarkText className="text-xl" />
        </motion.div>

        <motion.div
          variants={item}
          className="flex w-full max-w-xs flex-col items-center gap-4"
        >
          <ConnectWalletButton />

          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
          >
            Get Freighter
            <ExternalLink aria-hidden className="size-3" />
          </a>
        </motion.div>
      </motion.div>
    </main>
  );
}
