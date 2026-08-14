# SafeSwap — UI Rebuild Spec

A self-contained design + frontend spec for rebuilding the SafeSwap interface from scratch. **This is the build spec for this repo (`safe-swap-ui`)** — the UI is being rewritten here, clean, from the design system described below.

**Scope:** UI only. Wallet connectors, escrow/blockchain calls, API routes, and database wiring are deliberately excluded — see [Out of scope](#out-of-scope) for the seams to leave open.

---

## 0. Source repository

Everything in this document was extracted from the **previous** SafeSwap app — a working Next.js 16 codebase that lives in a *separate repository on the same machine*. When this spec is ambiguous, read the real file rather than guessing.

```
This repo:      /Users/danielcdz/Repos/safe-swap-ui        ← the rebuild (you are here)

Source repo:    /Users/danielcdz/Repos/SafeSwap            ← reference only, do not edit
Source app:     /Users/danielcdz/Repos/SafeSwap/p2p-safe-swap
Source branch:  main @ 7673a6d
Extracted:      2026-08-13
```

> **The source repo is read-only for this project.** It is a separate, active codebase with its own workflow and ticket process. Read from it freely; never write to it.

All source paths in this document are **relative to the source app root** unless stated otherwise. To read one, prefix it:

```bash
# e.g. "app/globals.css" →
/Users/danielcdz/Repos/SafeSwap/p2p-safe-swap/app/globals.css
```

The highest-value files, in the order you'd want them:

| What | Path |
|---|---|
| **All design tokens** — brand palette, semantic light/dark, radius, gradient, scrollbar | `app/globals.css` |
| Root layout, font loading, providers, metadata | `app/layout.tsx` |
| Persistent shell — fixed elements, nav suppression | `frontend/components/app-shell.tsx` |
| Bottom navigation | `frontend/components/ui/bottom-nav.tsx` |
| Button variants (`cva`) | `frontend/components/ui/Button/Button.variants.ts` |
| Brand SVG marks | `frontend/components/brand/Logo.tsx` |
| `cn()` helper | `lib/utils.ts` |
| shadcn config — style, base color, aliases | `components.json` |
| Tailwind v4 / PostCSS config | `postcss.config.mjs` |
| Path aliases | `tsconfig.json` |
| Font assets **+ license** | `app/fonts/` |
| Project/agent onboarding, stack rules, gotchas | `AGENTS.md` |
| Product scope, sprint plans, progress | `../docs/` (repo root, not app root) |

> If the source repo is unavailable, this document stands on its own — every token value, class string, and behavior needed for the rebuild is reproduced inline below.

---

## 1. Product context

SafeSwap is a **peer-to-peer marketplace for buying and selling USDC on Stellar** against fiat rails (bank transfer, SINPE Móvil in Costa Rica; the current mock data also shows SEPA/Bizum/Revolut against EUR).

The mechanic that shapes every screen: **two strangers trade, and an escrow contract sits between them.** A trade moves through a fixed lifecycle —

```
deploy → fund → approve → release
                    ↘ dispute
```

Three consequences for the UI, and they're the reason the interface looks the way it does:

1. **Trust signals are load-bearing.** Every counterparty is shown with a rating, an operation count, a verification mark, and a truncated wallet address that can be copied. A user decides whether to trade based on this block.
2. **State must always be visible.** A user with money in escrow needs to know exactly which stage they're at. Hence the stepper, the status badges, and the per-message payment states.
3. **Chat is a transaction surface, not a side feature.** Payments and payment *requests* are rendered inline as first-class message bubbles with their own actions (Pay / Reject / View receipt). Chat is where the trade actually happens.

The product is **mobile-first**. Every application screen is capped at `max-w-md` (448px) and centered — it reads as a phone app even on desktop. Only the marketing landing page widens.

### Screens to rebuild

| Route | Source | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing. Only full-width screen; bottom nav hidden |
| `/p2p/orders` | `app/p2p/orders/page.tsx` | Order book — buy/sell tabs, sorted by best price. Primary entry point |
| `/p2p/orders/[id]` | `app/p2p/orders/[id]/page.tsx` | Single order detail + amount entry |
| `/trades/[id]` | `app/trades/[id]/page.tsx` | Active trade — escrow stepper + actions |
| `/chat/[id]` | `app/chat/[id]/page.tsx` | Trade chat with inline payment bubbles. `h-dvh`, no page padding |
| `/wallet` | `app/wallet/page.tsx` | Balance, quick actions, recent activity |
| `/transactions` | `app/transactions/page.tsx` | Full transaction history, searchable + tabbed |
| `/escrow/[id]/admin` | `app/escrow/[id]/admin/page.tsx` | Admin/dispute-resolver form. Internal-facing |

The richest screen to study is `app/p2p/orders/page.tsx` — it holds the mock order fixtures, the buy/sell mode state, and the chat hand-off. Mock data worth porting lives there (`MOCK_ORDERS`, `MOCK_MESSAGES`) and in `app/wallet/page.tsx` (`mockTransactions`).

---

## 2. Tech stack (UI layer)

| Concern | Choice | Version |
|---|---|---|
| Framework | Next.js, App Router | 16.2.6 |
| UI runtime | React | 19.2.4 |
| Language | TypeScript (`strict: true`) | ^5 |
| Styling | Tailwind CSS **v4** — CSS-first config, no `tailwind.config.js` | ^4 |
| PostCSS | `@tailwindcss/postcss` | ^4 |
| Component base | shadcn/ui, `new-york` style, `neutral` base, CSS variables on | — |
| Variants | `class-variance-authority` | ^0.7.1 |
| Class merging | `clsx` + `tailwind-merge` via a `cn()` helper | ^2.1.1 / ^3.6.0 |
| Icons | `lucide-react` | ^1.17.0 |
| Animation | `framer-motion` | ^12.42.2 |
| Theming | `next-themes` (class strategy) | ^0.4.6 |
| Font loading | `next/font/local` (self-hosted Satoshi) | — |

```bash
npm i react react-dom next class-variance-authority clsx tailwind-merge \
      lucide-react framer-motion next-themes
npm i -D tailwindcss @tailwindcss/postcss typescript @types/react @types/react-dom @types/node
```

**Tailwind v4 note:** there is no JS config file. Everything is declared in CSS via `@import "tailwindcss"` and an `@theme inline { … }` block. `postcss.config.mjs` is the entire build config:

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

### Path aliases

`tsconfig.json` maps `@/*` → `./*`. Components live under a non-standard `frontend/` directory (a project choice, not a Next convention), so imports read `@/frontend/components/...`.

**Recommendation for the rebuild:** drop `frontend/` and use the conventional `components/` at the root. It bought nothing and forced a custom alias into every import. The `components.json` aliases would then simplify to the shadcn defaults.

---

## 3. Design tokens

> **Source: `app/globals.css`** (129 lines — the entire design system). Read it in full; it is the single most important file to port.

### 3.1 Brand palette (theme-independent)

*`app/globals.css` → `@theme inline` block, lines 29–40.*

The raw identity colors. Named after the SafeSwap Visual Identity guide.

| Token | Hex | Role |
|---|---|---|
| `--color-ink` | `#101b1d` | Primary dark — near-black with a green cast |
| `--color-ink-deep` | `#0a1213` | Deepest surface (dark-mode canvas) |
| `--color-ink-700` | `#16282a` | Raised dark surface |
| `--color-green` | `#01a78f` | **Persian Green — the primary brand color** |
| `--color-green-dark` | `#016b5b` | Deep green, hover/pressed |
| `--color-green-deep` | `#02201a` | Near-black green, outgoing chat bubbles |
| `--color-mint` | `#5fd6ac` | Mint — secondary/accent |
| `--color-mint-soft` | `#9ce7cc` | Soft mint |
| `--color-mint-pale` | `#e6fbf2` | Palest mint — dark-mode text, light accent fill |
| `--color-spark` | `#1446f0` | Electric blue — reserved highlight |

> Two of these are currently **declared but never used**: `--color-spark` and most of the `ink`/`mint` scale. Components consume the semantic layer below exclusively. Keep them declared as the identity reference, but don't expect them in component code.

### 3.2 Semantic tokens

*`app/globals.css` → `:root` (lines 48–70) and `.dark` (lines 73–94).*

Components reference **only** these. This is what makes theming work — never hardcode a brand hex in a component.

| Token | Light | Dark |
|---|---|---|
| `background` | `#f5fcf9` | `#0a1213` |
| `foreground` | `#101b1d` | `#e6fbf2` |
| `card` | `#ffffff` | `#101b1d` |
| `card-foreground` | `#101b1d` | `#e6fbf2` |
| `popover` | `#ffffff` | `#101b1d` |
| `popover-foreground` | `#101b1d` | `#e6fbf2` |
| `primary` | `#01a78f` | `#01a78f` |
| `primary-foreground` | `#ffffff` | `#ffffff` |
| `secondary` | `#5fd6ac` | `#5fd6ac` |
| `secondary-foreground` | `#101b1d` | `#101b1d` |
| `muted` | `#ebf4f0` | `#16282a` |
| `muted-foreground` | `#54615b` | `#7f9a93` |
| `accent` | `#e6fbf2` | `#16282a` |
| `accent-foreground` | `#016b5b` | `#e6fbf2` |
| `destructive` | `#ff5957` | `#ff5957` |
| `border` | `#d2ded8` | `#1c2e2c` |
| `input` | `#d2ded8` | `#1c2e2c` |
| `ring` | `#01a78f` | `#5fd6ac` |
| `chat-bubble-outgoing` | `#02201a` | `#016b5b` |
| `chat-bubble-outgoing-foreground` | `#e6fbf2` | `#e6fbf2` |

Light mode is a **green-tinted neutral** — the background is `#f5fcf9`, not white; cards are pure white and float above it. Dark mode is an **ink canvas with mint text**, mirroring the marketing landing.

`primary`, `secondary`, and `destructive` hold constant across themes. Only surfaces, text, and borders swap.

### 3.3 Radius

Base `--radius: 0.75rem` (12px), with a derived scale:

| Token | Value |
|---|---|
| `--radius-sm` | `calc(var(--radius) - 4px)` → 8px |
| `--radius-md` | `calc(var(--radius) - 2px)` → 10px |
| `--radius-lg` | `var(--radius)` → 12px |
| `--radius-xl` | `calc(var(--radius) + 4px)` → 16px |

In practice the UI leans on Tailwind's own scale more than these tokens: **cards use `rounded-2xl`** (16px), **buttons, pills, tabs, badges, and avatars are always `rounded-full`**, chat bubbles are `rounded-2xl` with one corner tightened to `rounded-*-md` to point at the speaker.

The fully-rounded button is a defining trait of the brand. Keep it.

### 3.4 Typography

**Satoshi Variable**, self-hosted, weights 300–900, loaded via `next/font/local` with `display: "swap"` and exposed as `--font-satoshi`.

```
--font-sans: var(--font-satoshi), ui-sans-serif, system-ui, sans-serif;
```

Assets to copy into the new repo (`app/fonts/`):
- `Satoshi-Variable.woff2` (42KB)
- `SATOSHI-LICENSE.txt` — **copy this too; the license requires it**

Observed type scale:

| Use | Classes |
|---|---|
| Landing h1 | `text-4xl sm:text-5xl font-bold leading-tight tracking-tight` |
| Page title | `text-lg font-semibold` |
| Section heading | `text-base font-semibold` |
| Hero number (price, balance) | `text-3xl font-semibold tracking-tight tabular-nums` |
| Card price | `text-xl sm:text-3xl font-bold leading-tight` |
| Payment amount | `text-2xl font-bold leading-tight` |
| Body | `text-sm` |
| Secondary / meta | `text-sm text-muted-foreground` |
| Labels, pills | `text-xs font-medium` |
| Eyebrow / overline | `text-xs font-semibold uppercase tracking-wider` |
| Date group | `text-[11px] uppercase tracking-[0.18em]` |
| Timestamps | `text-[11px] tabular-nums` |

Two rules worth enforcing:
- **`tabular-nums` on every number that sits in a column** — amounts, prices, timestamps. Prevents the jitter that makes a financial list feel cheap.
- **`font-mono` for wallet addresses**, always truncated as `GDRX…UJUJ` (4 head, 4 tail, `…` separator) with the full value in a `title` attribute and a click-to-copy affordance.

### 3.5 Global CSS

```css
@import "tailwindcss";

@theme inline {
  /* semantic → CSS var indirection, brand palette, radius scale, --font-sans */
}

:root  { /* light semantic values */ }
.dark  { /* dark semantic values  */ }

* { border-color: var(--border); }

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

Two global flourishes, both worth keeping:

**Brand gradient text** — used on the landing headline:
```css
@layer components {
  .text-grad {
    background: linear-gradient(100deg, #5fd6ac 0%, #01a78f 55%, #5fd6ac 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}
```

**Themed scrollbar** — 10px, gradient thumb (`#01a78f → #016b5b`), fully rounded, with a 2px background-colored border that insets it from the track.

---

## 4. Layout architecture

> **Sources:** `app/layout.tsx`, `frontend/components/app-shell.tsx`, `frontend/components/ui/bottom-nav.tsx`

### Root layout

```
<html class={satoshi.variable} suppressHydrationWarning>
  <body class="min-h-full flex flex-col">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  </body>
</html>
```

`suppressHydrationWarning` on `<html>` is required by `next-themes`. Metadata uses a title template: `"%s · SafeSwap"`.

### App shell

A persistent frame with three fixed elements:

| Element | Position |
|---|---|
| Wallet actions (connect, testnet setup) | `fixed right-4 top-4 z-50`, stacked column, right-aligned |
| Bottom navigation | `fixed inset-x-0 bottom-0 z-40` |
| Theme toggle | `fixed right-4 z-50` — `bottom-20` when nav is visible, `bottom-4` when not |

Content gets `pb-16` to clear the nav. The nav and its padding are **suppressed on `/`** so the landing page runs full-bleed.

### Page container

Every application screen:

```jsx
<main className="mx-auto flex min-h-full w-full max-w-md flex-col bg-background px-4 py-6">
```

Variations: chat uses `h-dvh` with no padding (the input bar must sit at the true viewport bottom); the landing uses `max-w-xl` centered with `px-6 py-16`.

### Bottom navigation

4 items — Home (`/`), Orders (`/p2p/orders`), Wallet (`/wallet`), Transactions (`/transactions`). Icons: `Home`, `ArrowLeftRight`, `Wallet`, `Receipt`.

- Container: `h-16 max-w-md`, `border-t border-border bg-card`, items `justify-around`
- Respects the notch: `pb-[env(safe-area-inset-bottom)]`
- Item: icon `size-5` above a `text-xs` label, `gap-1`, `rounded-full` hit area, `min-w-16`
- Active: `text-primary font-medium` + `aria-current="page"`. Inactive: `text-muted-foreground font-normal`
- Active matching is prefix-based (`/p2p/orders/abc` keeps Orders lit), except `/` which matches exactly

---

## 5. Component inventory

### Button — the primitive

`cva`-based, three variants × three sizes.

Base: `inline-flex items-center justify-center rounded-full font-semibold tracking-wide transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-97 cursor-pointer select-none`

| Variant | Treatment |
|---|---|
| `primary` | `bg-primary text-white shadow-xs`, hover `bg-primary/90`, active `bg-primary/95` |
| `ghost` | Transparent with `border-zinc-200` outline, hover `bg-zinc-50` |
| `danger` | `bg-red-50 text-red-600 border-red-100`, dark `bg-red-950/20 text-red-400` |

| Size | Metrics |
|---|---|
| `sm` | `text-xs`, `px-3 py-1`, `min-h-[28px]` |
| `md` | `text-sm`, `px-5 py-1.5`, `min-h-[34px]` (default) |
| `lg` | `text-base`, `px-6 py-2`, `min-h-[40px]`, `sm:px-7` |

The `active:scale-97` press feedback is a nice touch — keep it.

> **Two flaws to fix in the rebuild.** (1) The component takes a **`label` string prop instead of `children`**, so it can't wrap an icon — which is why the theme toggle bypasses it and hand-styles a `<button>` with `buttonVariants()`. Switch to `children`. (2) `ghost` and `danger` hardcode `zinc-*` and `red-*` instead of using `border`/`muted`/`destructive` tokens, so they don't follow the green-tinted theme. Rewrite them against semantic tokens.

### Cards

`bg-card rounded-2xl border border-border p-5 shadow-sm`, contents in a `flex flex-col gap-5`. Interactive cards add `cursor-pointer transition-colors hover:border-primary/40` plus a focus ring — **hover changes the border, not the background.** Alongside `role="button"`, `tabIndex={0}`, and Enter/Space handling.

### Component list

All paths below are under `frontend/components/`.

| Component | Source | Notes |
|---|---|---|
| **Button** | `ui/Button/` — `Button.tsx`, `Button.variants.ts`, `types/index.ts` | See spec above. |
| **TransactionCard** | `TransactionCard/TransactionCard.tsx` (+ `types/`, `utils/`) | The order-book card. Avatar + copyable mono address + verified badge + `★ rating · N ops`, large right-aligned price, available/window/limits rows, payment-method pills, action button. Dense but readable — the anchor of the whole design. |
| **BestPriceCard** | `p2p/best-price-card.tsx` | Header stat block. Eyebrow label, `text-3xl tabular-nums` price, pair label, and an order-count pill (`bg-primary/10 text-primary rounded-full`) with a trend icon. |
| **P2POrderList** | `p2p/p2p-order-list.tsx` | Composes BestPriceCard + TabBar + a Reveal-staggered card list. Holds the best-price sort logic. |
| **TabBar** | `ui/tab-bar.tsx` | Pill segmented control. Track `bg-primary/5 rounded-full p-1`; active tab `bg-primary/15 font-medium text-primary`. Full roving-tabindex keyboard support (arrows, Home, End) with proper `role="tablist"`/`role="tab"`. |
| **SearchBar** | `ui/search-bar.tsx` | `rounded-full bg-primary/5 px-4 py-2`, leading `Search` icon, transparent borderless input, `focus-within:ring-2`. |
| **WalletBadge** | `ui/wallet-badge.tsx` | Deterministic avatar. Hashes the address to pick from 4 token-based color pairs and derives 2-letter initials. `size-9` (sm) / `size-11` (md). |
| **TransactionRow** | `ui/transaction-row.tsx` | Badge + truncated address + memo + right-aligned signed amount (`+`/`−` with a true minus `−`) over a clock-icon timestamp. Incoming amounts are `text-primary`. |
| **TransactionList** | `ui/transaction-list.tsx` | Search + tab filtering over day-grouped rows. Owns the `Transaction`/`TransactionTab` types. |
| **DateGroup / DateSeparator** | `ui/date-group.tsx`, `chat/date-separator.tsx` | Wide-tracked uppercase micro-label for day grouping. |
| **ThemeToggle** | `ui/theme-toggle.tsx` | `size-10 rounded-full bg-card shadow-lg`, Sun/Moon swap. Uses `useSyncExternalStore` for a hydration-safe mounted flag — worth copying, it avoids the usual flash. |
| **EscrowStepper** | `trade/escrow-stepper.tsx` | Vertical `<ol>` timeline. 4 states: `completed` (filled primary + check), `current` (primary tint, ring, spinner), `pending` (bordered outline + dot), `disputed` (destructive tint + triangle). Connecting rail turns primary once a step completes. Timestamps via `Intl.DateTimeFormat`, `aria-current="step"`, screen-reader status text. |
| **EscrowStatusBadge** | `escrows/status-badge.tsx` | `rounded-full border px-2.5 py-0.5 text-xs font-semibold` — amber/blue/red/green for pending/funded/disputed/released. |
| **EscrowStatusPanel** | `escrows/escrow-status-panel.tsx` | Status summary strip. Types in `escrows/types.ts`. |
| **ChatScreen** | `chat/chat-screen.tsx` | Composition root for chat: header, dispute banner, scrolling `role="log"` message area, input bar. Day-grouping in `chat/utils.ts`, types in `chat/types.ts`. |
| **ChatHeader** | `chat/chat-header.tsx` | Back arrow, `WalletBadge`, truncated address, online dot, copy-address button with a check-mark confirmation, dispute trigger. |
| **ChatMessageBubble** | `chat/chat-message-bubble.tsx` | `max-w-[78%] rounded-2xl px-4 py-2.5`. Outgoing: `bg-chat-bubble-outgoing` with the bottom-right corner tightened; incoming: `bg-muted`, bottom-left tightened. Delivery ticks (single = sent, double = delivered/read, primary when read). |
| **PaymentBubble** | `PaymentBubble/PaymentBubble.tsx` (+ `types/`, `utils/`) | The distinctive one. Fixed `w-72` card *inside* the chat stream, three-part: header (circular direction icon + type label + `text-2xl` amount), optional quoted memo, hairline divider, then a status footer on a tinted band carrying the actions — Pay/Reject when pending, "View receipt →" when completed, an X and destructive text when rejected. |
| **ChatInputBar** | `chat/chat-input-bar.tsx` | `border-t` bar: a "Pay" button, an auto-grow `textarea` (`min-h-10 max-h-32`, Enter sends / Shift+Enter newlines), and a Send button disabled until non-empty. |
| **RaiseDisputeDialog** | `chat/raise-dispute-dialog.tsx` | Modal with reason textarea + submitting/error states. |
| **Reveal** | `motion/reveal.tsx` | Framer Motion scroll-entrance wrapper. |
| **Logo** | `brand/Logo.tsx` | `ShieldMark` (two-tone SVG, shield + bidirectional arrows forming an S) and `Wordmark` (mark + "**Safe**Swap", bold/regular split). |
| **BottomNav** | `ui/bottom-nav.tsx` | See §4. |
| **AppShell** | `app-shell.tsx` | See §4. |
| **ThemeProvider** | `theme-provider.tsx` | Thin `next-themes` wrapper. |

Wallet-facing components (`wallet/ConnectWalletButton.tsx`, `wallet/WalletSummary.tsx`, `wallet/SetupTestnetButton.tsx`) are **presentational shells over excluded logic** — `WalletSummary` is worth reading for the balance-card layout and quick-action row; the other two are connector-bound (see §9).

### Brand mark

The `ShieldMark` SVG uses **fixed brand hex fills** (`#01a78f` top, `#5fd6ac` bottom) that deliberately do *not* follow the theme — the mark stays on-brand on any surface. Only the wordmark text uses `text-foreground`. Copy the SVG paths verbatim from `frontend/components/brand/Logo.tsx`; they come from the official identity guide.

---

## 6. Motion

> **Source:** `frontend/components/motion/reveal.tsx`

Framer Motion, used sparingly. One shared `Reveal` wrapper:

- Variants: `up` (`opacity 0→1`, `y 24→0`) and `scale` (`opacity 0→1`, `scale 0.96→1`)
- Transition: `duration: 0.6`, custom ease `[0.22, 1, 0.36, 1]`
- Trigger: `whileInView`, `once: true`, `margin: "-60px"`
- **Honors `prefers-reduced-motion`** — returns a plain `<div>` when reduced

List stagger: `delay={Math.min(index, 6) * 0.06}` — caps at the 7th item so long lists don't crawl.

Everything else is CSS: `transition-colors`, `transition-all duration-200`, `active:scale-97`. `disableTransitionOnChange` on the ThemeProvider prevents a color-transition sweep during theme switches.

---

## 7. Conventions to carry over

**The `cn()` helper** (`lib/utils.ts`) — every component merges classes through it:
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

**`data-slot` attributes** on component roots (`data-slot="tab-bar"`, `"chat-screen"`, …) — shadcn convention, gives styling and testing hooks.

**Props pattern:** extend `React.ComponentProps<"div">`, destructure `className`, spread `...props` last.

**Server-first:** components are RSC by default; `"use client"` only where hooks, `window`, or handlers are needed. Presentational components (BestPriceCard, TransactionRow, WalletBadge, ChatMessageBubble, DateGroup, EscrowStatusBadge) stay server components.

**Accessibility** — consistently strong in the existing code; hold the line:
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1|2` on everything interactive
- `aria-label` on all icon-only buttons; `aria-hidden` on decorative SVGs
- `aria-current="page"` / `"step"` for nav and stepper
- `role="log" aria-live="polite"` on the message list; `role="alert"` on errors
- Full keyboard support on the tab bar; Enter/Space on clickable cards
- `sr-only` text where color alone would carry meaning (stepper statuses)

**Empty states** are designed, not forgotten: `rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground`.

---

## 8. Known inconsistencies — fix these in the rebuild

Carrying these forward would be a mistake. Each is small and worth resolving on day one.

1. **Mixed languages.** UI copy is mostly English, but Spanish is hardcoded in `frontend/components/escrows/status-badge.tsx` (`Pendiente`, `Financiado`, `En disputa`, `Liberado`) and `app/transactions/page.tsx` (`Conecta tu wallet…`, `Cargando transacciones…`, `Anterior`, `Página`). Pick one language, or commit to real i18n.
2. **Half-built i18n.** A `lang?: "es" | "en"` prop backed by per-component `translations` objects exists in `TransactionCard/utils/index.ts`, `PaymentBubble/utils/index.ts`, and `chat/chat-screen.tsx` — and nowhere else. Either adopt an i18n library or drop the prop.
3. **Tokens bypassed.** `ui/Button/Button.variants.ts` (`ghost`, `danger`) and `escrows/status-badge.tsx` use raw `zinc-*`/`red-*`/`amber-*`/`blue-*`/`green-*` scales instead of semantic tokens, so they ignore the green-tinted theme. Define `warning`/`info`/`success` semantic tokens and route these through them.
4. **Button can't take children** — `ui/Button/Button.tsx` renders a `label` prop. See the consequence in `ui/theme-toggle.tsx`, which hand-rolls a `<button>` with `buttonVariants()` to fit an icon.
5. **Dead tokens.** `--color-spark` and most of the `ink`/`mint` scale in `app/globals.css` are declared but unreferenced anywhere in `app/` or `frontend/`. Either use them or trim to what ships.
6. **Two competing folder conventions.** `frontend/components/ui/bottom-nav.tsx` (kebab-case, flat) sits beside `frontend/components/TransactionCard/TransactionCard.tsx` (PascalCase folder with `types/` and `utils/` subfolders). Pick one. Kebab-case files with co-located types is the more common Next.js convention.
7. **`frontend/` directory** is non-standard and buys nothing (see §2). Alias defined in `tsconfig.json`, consumed in `components.json`.

---

## 9. Out of scope

Deliberately excluded — leave clean seams and mock the data.

| Excluded | Source (do **not** port) | Seam to leave |
|---|---|---|
| Wallet connection (Freighter / `@stellar/freighter-api`) | `frontend/lib/wallet-context.tsx`, `frontend/lib/wallet-setup.ts` | A `useWallet()`-shaped hook returning `{ publicKey, signTransaction }`; stub `publicKey` with a constant address |
| Escrow lifecycle (Trustless Work API) | `frontend/lib/escrow-{deployment,funding,release,dispute,balance,approve-milestone}.ts` | Async action handlers that resolve after a timeout and drive a status state machine |
| Stellar SDK, Horizon, XDR signing | `frontend/lib/stellar-transaction.ts`, `lib/trustless-work.ts` | None — UI never touches these |
| Supabase / persistence | `lib/supabase.ts` (currently unimported) | Local state or fixtures |
| API routes, `TW_API_KEY` | `app/api/**` | None |
| Escrow data fetching | `frontend/components/escrows/{client,use-escrows,adapters}.ts` | A hook returning a fixture array + `isLoading`/`error` |
| `localStorage` trade state | `app/p2p/orders/page.tsx`, `app/trades/[id]/page.tsx` | None — treat as component state |

Chat, orders, and wallet balances are **already mocked** in the current codebase, so those fixtures port over directly (see the note under [Screens to rebuild](#screens-to-rebuild)).

The status vocabularies the UI must render are worth fixing up front, since they drive the visual states:

```ts
type EscrowStatus       = "pending" | "funded" | "disputed" | "released";   // escrows/types.ts
type EscrowStepStatus   = "completed" | "current" | "pending" | "disputed"; // trade/escrow-stepper.tsx
type PaymentStatus      = "pending" | "completed" | "rejected";            // PaymentBubble/types/index.ts
type DeliveryStatus     = "sent" | "delivered" | "read";                   // chat/types.ts
type OrderMode          = "buy" | "sell";                                  // p2p/types.ts
```

Domain type definitions worth reading before modeling your own — they're UI-shaped and connector-free: `frontend/components/p2p/types.ts` (`P2POrder`), `frontend/components/chat/types.ts` (`ChatMessage`), `frontend/components/ui/transaction-list.tsx` (`Transaction`).

---

## 10. Rebuild checklist

Each step names the file to copy from, relative to `/Users/danielcdz/Repos/SafeSwap/p2p-safe-swap/`.

- [ ] `create-next-app` — TypeScript, App Router, Tailwind v4 → compare `package.json`, `postcss.config.mjs`, `tsconfig.json`
- [ ] Copy `app/fonts/Satoshi-Variable.woff2` **and** `app/fonts/SATOSHI-LICENSE.txt`; wire `next/font/local` per `app/layout.tsx`
- [ ] Port `app/globals.css` in full — `@theme inline`, `:root`/`.dark`, `.text-grad`, scrollbar
- [ ] Add `cn()` helper ← `lib/utils.ts`
- [ ] `next-themes` provider + `suppressHydrationWarning` ← `app/layout.tsx`, `frontend/components/theme-provider.tsx`
- [ ] Copy `ShieldMark` SVG paths verbatim ← `frontend/components/brand/Logo.tsx`
- [ ] Button primitive — **with `children` and semantic tokens** (fixes #3, #4) ← `frontend/components/ui/Button/Button.variants.ts`
- [ ] Primitives ← `frontend/components/ui/`: `wallet-badge`, `tab-bar`, `search-bar`, `date-group`, `theme-toggle`
- [ ] AppShell + BottomNav ← `frontend/components/app-shell.tsx`, `ui/bottom-nav.tsx`
- [ ] Domain components ← `TransactionCard/`, `p2p/best-price-card.tsx`, `trade/escrow-stepper.tsx`, `escrows/status-badge.tsx`
- [ ] Chat surface ← `frontend/components/chat/*` + `PaymentBubble/PaymentBubble.tsx`
- [ ] `Reveal` wrapper with reduced-motion handling ← `frontend/components/motion/reveal.tsx`
- [ ] Screens in order: landing → orders → wallet → transactions → trade → chat ← `app/*/page.tsx`
- [ ] Decide language/i18n policy before writing copy (#1, #2)
- [ ] Verify both themes on every screen; check contrast on `muted-foreground` over `background`
