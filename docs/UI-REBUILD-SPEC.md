# SafeSwap — UI Spec

The design system and frontend architecture of **this repo** (`safe-swap-ui`), as built.

This started as a plan for rebuilding the SafeSwap interface from an earlier codebase. It is now a description of what exists, with the places we deliberately diverged from that earlier app recorded as decisions rather than debt. Where this document and the code disagree, the code wins — say so and fix the document.

**Scope:** UI only. Wallet connectors, escrow/blockchain calls, API routes, and database wiring are deliberately excluded — see [Out of scope](#9-out-of-scope) for the seams left open.

For where the build actually stands, start at [`STATUS.md`](./STATUS.md). Ads, the order book and identity are served from Supabase ([`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md)); sign-in is real ([`WALLET-AUTH.md`](./WALLET-AUTH.md)). Trades and chat are real too, including image attachments; escrow is still deferred.

---

## 0. Source repository

The original extraction came from the **previous** SafeSwap app — a working Next.js 16 codebase in a *separate repository on the same machine*. It remains useful reference for the screens not built yet.

```
This repo:      /Users/danielcdz/Repos/safe-swap-ui        ← the rebuild (you are here)

Source repo:    /Users/danielcdz/Repos/SafeSwap            ← reference only, do not edit
Source app:     /Users/danielcdz/Repos/SafeSwap/p2p-safe-swap
Source branch:  main @ 7673a6d
Extracted:      2026-08-13
```

> **The source repo is read-only for this project.** It is a separate, active codebase with its own workflow and ticket process. Read from it freely; never write to it.

Its most useful remaining files, for screens still to come:

| What | Path (relative to the source app root) |
|---|---|
| Chat message bubbles, payment bubbles, input bar | `frontend/components/chat/`, `frontend/components/PaymentBubble/` |
| Transaction history list and rows | `frontend/components/ui/transaction-{row,list}.tsx` |
| Wallet balance card and quick actions | `frontend/components/wallet/WalletSummary.tsx` |
| Escrow admin / dispute resolver form | `app/escrow/[id]/admin/page.tsx` |

Its design tokens, layout shell, and button variants have all been superseded by what is documented below — read this document for those, not the source.

---

## 1. Product context

SafeSwap is a **peer-to-peer marketplace for buying and selling USDC on Stellar** against fiat.

The mechanic that shapes every screen: **two strangers trade, and an escrow contract sits between them.** A trade moves through a fixed lifecycle —

```
deploy → fund → approve → release
                    ↘ dispute
                    ↘ cancel (only before the fiat leg moves)
```

Three consequences for the interface, and they are the reason it looks the way it does:

1. **Trust signals are load-bearing.** Every counterparty is shown with a handle, a rating, an operation count, a completion rate, a verification mark, and a truncated wallet address that can be copied. A user decides whether to trade on that block alone.
2. **State must always be visible.** A user with money in escrow needs to know exactly which stage they are at — hence the stepper, the status badges, the countdown, and the persistent open-orders list.
3. **Chat is a transaction surface, not a side feature.** Escrow events land in the same stream as the conversation, because the off-chain leg is coordinated there.

### Layout posture

**Desktop-first, capped at `max-w-[1400px]`.** The earlier app capped every screen at `max-w-md` (448px) and read as a phone app even on desktop. That was dropped: the order book is a dense, multi-column table that needs the width, and the trade screen runs order state and chat side by side. Every screen still collapses to a single column below `lg`.

### Screens

| Route | File | Status |
|---|---|---|
| `/` | `app/page.tsx` | **Built** — wallet connect. The front door; there is no marketing landing |
| `/p2p/orders` | `app/p2p/orders/page.tsx` | **Built** — the book, plus a high-level activity summary |
| `/p2p/ads/new` | `app/p2p/ads/new/page.tsx` | **Built** — three-step ad wizard |
| `/trades/[id]` | `app/trades/[id]/page.tsx` | **Built** — escrow state + chat |
| `/dashboard` | `app/dashboard/page.tsx` | **Built** — your orders and ads, in full |
| `/profile` | `app/profile/page.tsx` | **Built** — identity and trading record |
| `/wallet` | — | Not built — balance, quick actions, recent activity |
| `/transactions` | — | Not built — full history, searchable + tabbed |
| `/escrow/[id]/admin` | — | Not built — dispute resolver form, internal-facing |

### Information architecture

**Market** finds a counterparty, **Dashboard** holds what's yours, the trade
screen sits between them, and **Profile** is who you are to everyone else.

The book carries only a high-level read of your activity — open orders, live
ads, and disputes when non-zero — and hands off. Rows, tabs, and actions live
in the dashboard. That split exists because the book is a place you scan for
someone to trade with; your own state competing for the same screen made both
harder to read.

**Market scope: USDC/USD only.** A single market, stated by a chip rather than offered as a selector.

**Payment rails are Costa Rican only** (`lib/payment-methods.ts`): SINPE Móvil, BAC Credomatic, Banco Nacional, Banco Popular, Scotiabank. Wise and Zelle were dropped to keep the first market local.

> **Open inconsistency.** SINPE Móvil settles in colones, while `MARKET.fiat` is `USD`. Either the market becomes CRC, or a second CRC market is added and the rails split between them. Until then an ad quotes dollars against a colón rail, which is not something a real trader could act on.

**Copy is English throughout.** The earlier app mixed English with hardcoded Spanish and a half-built per-component `lang` prop; neither was carried over. Adopting a real i18n library is still an open decision.

---

## 2. Tech stack

| Concern | Choice | Version |
|---|---|---|
| Framework | Next.js, App Router | 16.2.6 |
| UI runtime | React | 19.2.4 |
| Language | TypeScript (`strict: true`) | ^5 |
| Styling | Tailwind CSS **v4** — CSS-first config, no `tailwind.config.js` | ^4 |
| PostCSS | `@tailwindcss/postcss` | ^4 |
| Component base | shadcn/ui conventions, `new-york` style, `neutral` base, CSS variables on | — |
| Variants | `class-variance-authority` | ^0.7.1 |
| Class merging | `clsx` + `tailwind-merge` via a `cn()` helper | ^2.1.1 / ^3.6.0 |
| Icons | `lucide-react` | ^1.17.0 |
| Animation | `framer-motion` | ^12.42.2 |
| Theming | `next-themes` (class strategy) | ^0.4.6 |
| Font loading | `next/font/local` (self-hosted Satoshi) | — |

**No Radix.** Every interactive primitive here — tooltip, menu, dialog, tabs — is hand-rolled against the ARIA patterns. Worth revisiting only if something needs collision detection or a portal.

**Tailwind v4 note:** there is no JS config file. Everything is declared in CSS via `@import "tailwindcss"` and an `@theme inline { … }` block. `postcss.config.mjs` is the entire build config.

**ESLint** uses `eslint-config-next`'s native flat configs (`eslint-config-next/core-web-vitals` and `/typescript`), spread directly. `FlatCompat` does not work with v16 of that package.

### Path aliases

`tsconfig.json` maps `@/*` → `./*`. Components live in a conventional `components/` at the repo root — the earlier app's non-standard `frontend/` directory was dropped, which removed a custom alias from every import.

---

## 3. Design tokens

> **Source: `app/globals.css`** — the entire design system. Read it in full; it is the most important file in the repo.

### 3.1 Brand palette (theme-independent)

The raw identity colors, named after the SafeSwap Visual Identity guide.

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
| `--color-spark` | `#1446f0` | Electric blue — now the light-theme `info` value |

Components consume the semantic layer below, never these directly. The one exception is the brand mark, whose fills are fixed hex on purpose.

### 3.2 Semantic tokens

Components reference **only** these. Never hardcode a brand hex in a component.

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
| `success` | `#01875f` | `#5fd6ac` |
| `warning` | `#b06c00` | `#f0b429` |
| `info` | `#1446f0` | `#7c9bff` |
| `border` | `#d2ded8` | `#1c2e2c` |
| `input` | `#d2ded8` | `#1c2e2c` |
| `ring` | `#01a78f` | `#5fd6ac` |
| `chat-bubble-outgoing` | `#02201a` | `#016b5b` |
| `chat-bubble-outgoing-foreground` | `#e6fbf2` | `#e6fbf2` |

Light mode is a **green-tinted neutral** — the background is `#f5fcf9`, not white; cards are pure white and float above it. Dark mode is an **ink canvas with mint text**.

`primary`, `secondary`, and `destructive` hold constant across themes. Only surfaces, text, borders, and the status trio swap.

**`success` / `warning` / `info` exist so escrow states stop reaching for raw `amber-*`/`blue-*`/`green-*` scales**, which ignored the green-tinted theme. `info` finally gives `--color-spark` a job.

Both themes also set **`color-scheme`** (`light` / `dark`), so native controls — `<select>` popups in particular — follow the theme instead of rendering a white list on an ink page.

### 3.3 Atmosphere tokens

Used by the connect screen, theme-tuned so the ink canvas and the green-tinted light canvas each get the right intensity:

| Token | Role |
|---|---|
| `--aurora-a` / `-b` / `-c` | Three offset radial washes behind the page |
| `--grain-opacity` | Film-grain overlay strength (`0.035` light, `0.05` dark) |

### 3.4 Radius

Base `--radius: 0.75rem` (12px), with `--radius-sm/md/lg/xl` derived from it.

In practice the UI leans on Tailwind's own scale: **cards and panels are `rounded-2xl`** (16px), **buttons, pills, tabs, badges, inputs, and avatars are always `rounded-full`**, chat bubbles are `rounded-2xl` with one corner tightened to `rounded-*-md` to point at the speaker.

The fully-rounded button is a defining trait of the brand. Keep it.

### 3.5 Typography

**Satoshi Variable**, self-hosted, weights 300–900, loaded via `next/font/local` with `display: "swap"` and exposed as `--font-satoshi`.

Assets in `app/fonts/`: `Satoshi-Variable.woff2` and `SATOSHI-LICENSE.txt` — **the license must ship with the font.**

The browser tab icon is `app/icon.svg`, a Next file convention, so no metadata wiring is needed. It carries the `ShieldMark` paths centred in a square viewBox — the mark is taller than wide, and a browser would otherwise stretch it into a square tab slot. Keep those paths in step with `components/brand/logo.tsx`.

| Use | Classes |
|---|---|
| Page title | `text-2xl font-bold tracking-tight` |
| Hero number (amount, best price) | `text-3xl font-semibold tracking-tight tabular-nums` |
| Amount input / row price | `text-2xl font-semibold tabular-nums` |
| Section heading | `text-base font-semibold` |
| Body | `text-sm` |
| Secondary / meta | `text-sm text-muted-foreground` |
| Labels, pills | `text-xs font-medium` |
| Eyebrow / column header | `text-xs font-semibold uppercase tracking-wider` |
| Micro-label | `text-[11px] uppercase tracking-[0.18em]` |
| Timestamps | `text-[11px] tabular-nums` |

Two rules worth enforcing:

- **`tabular-nums` on every number that sits in a column** — amounts, prices, counts, timestamps. Prevents the jitter that makes a financial list feel cheap.
- **`font-mono` for wallet addresses**, always truncated as `GDRX…UJUJ` (4 head, 4 tail, `…` separator) via `truncateAddress()`, with the full value in a `title` attribute and a click-to-copy affordance.

### 3.6 Global CSS beyond tokens

- `.text-grad` — brand gradient text (Persian Green → Mint), used on the connect headline.
- `.bg-aurora` — three offset radial washes; atmosphere instead of a flat fill.
- `.bg-grain` — `::after` film-grain overlay; stops large flat areas banding.
- `.animate-breathe` — slow pulse behind the brand mark, disabled under `prefers-reduced-motion`.
- Themed scrollbar — 10px, gradient thumb (`#01a78f → #016b5b`), fully rounded, inset by a 2px background-colored border.

---

## 4. Layout architecture

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

`suppressHydrationWarning` on `<html>` is required by `next-themes`. Metadata uses a title template: `"%s · SafeSwap"`, defaulting to `"SafeSwap — P2P USDC on Stellar"`.

`AppShell` is currently just the flex frame. It stays as the seam for anything that must sit outside the page — a toast region, a nav rail.

### App header

`components/app-header.tsx` — used by the application screens, not by the connect screen.

- `sticky top-0 z-40`, `border-b border-border`, `bg-background/85 backdrop-blur`
- `h-16`, inner container `max-w-[1400px]` with `px-4 sm:px-6`
- Left: wordmark, then `AppNav` — Market and Dashboard, prefix-matched so a trade or the ad form keeps its section lit. Hidden below `sm`.
- Right: a **Post ad** link, `WalletMenu`, `ThemeToggle`

**There is no bottom navigation.** The earlier app's four-item mobile nav (Home / Orders / Wallet / Transactions) does not fit a desktop layout, and its Home item has no target now that `/` is the connect screen.

**The wallet menu doubles as the user menu** — Profile, Dashboard, Copy address, Disconnect. Identity first, then your things, then utilities, then the way out. It is also what makes `AppNav` being hidden on small screens safe: every destination stays reachable there.

### Page container

Application screens:

```jsx
<main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
```

The connect screen runs chrome-free and full-bleed: `min-h-dvh`, `bg-aurora bg-grain`, content centred in a `max-w-md` column, with its own floating theme toggle.

---

## 5. Component inventory

All paths under `components/`.

### Primitives — `ui/`

| Component | Notes |
|---|---|
| **Button** (`ui/button.tsx`) | `cva`-based. Variants `primary` \| `sell` \| `ghost` \| `danger`; sizes `sm` \| `md` \| `lg` \| `icon`. Takes **`children`**, so it wraps icons. All variants use semantic tokens. Base keeps `rounded-full`, `active:scale-97`, and a focus ring. |
| **TabBar** (`ui/tab-bar.tsx`) | Pill segmented control. Track `bg-primary/5 rounded-full p-1`. Props `size` (`sm` for section headers, `md` standalone) and `activeTone` (`primary` \| `destructive`) so a buy/sell switch carries its side colour. Full roving tabindex — arrows, Home, End — with `role="tablist"`/`role="tab"`. |
| **WalletBadge** (`ui/wallet-badge.tsx`) | Deterministic avatar. Hashes the **address** — not the handle, so identity survives a rename — to pick one of four token-based colour pairs, and derives 2-letter initials. Sizes `sm` \| `md` \| `lg`. |
| **InfoTip** (`ui/info-tip.tsx`) | `(i)` affordance. Opens on hover, focus, **and tap** — pointer-only tooltips are unreachable by keyboard and invisible on touch. `role="tooltip"` + `aria-describedby`; Escape and blur dismiss. Resets inherited uppercase/tracking. |
| **Dialog** (`ui/dialog.tsx`) | Modal shell — backdrop, Escape, focus in on open and back to the opener on close, body scroll lock, optional `initialFocusRef` and footer. Every modal builds on this; do not re-implement the mechanics. |
| **ConfirmDialog** (`ui/confirm-dialog.tsx`) | `Dialog` plus a confirm/dismiss footer, for irreversible actions. Focus lands on the confirm button. |
| **ThemeToggle** (`ui/theme-toggle.tsx`) | Sun/Moon swap on the `Button` primitive at `size="icon"`. Uses `useSyncExternalStore` for a hydration-safe mounted flag. |
| **NumberField** (`ui/number-field.tsx`) | Pill number input with −/+ steppers. Typing stays free-form so a half-entered value isn't clamped out from under the cursor; the steppers clamp and the parent validates. |
| **TextField** (`ui/text-field.tsx`) | Pill input following the search-bar shape language — `rounded-full` on a `primary/5` wash, ring on focus, leading icon, trailing slot, inline error wired through `aria-invalid`/`aria-describedby`. **Currently unused**; kept for the amount-entry, dispute, and admin forms still to come. |

### Brand — `brand/logo.tsx`

`ShieldMark` (two-tone SVG, shield + bidirectional arrows forming an S), `WordmarkText` (the name alone), and `Wordmark` (mark + name). The SVG fills are **fixed brand hex** that deliberately do not follow the theme — the mark stays on-brand on any surface. Paths come from the official identity guide; copy them verbatim.

### Auth — `auth/`

| Component | Notes |
|---|---|
| **ConnectScreen** | The front door. The mark centred in concentric rings over a slow breathing glow, wordmark, one button. Staggered entrance via framer-motion, reduced-motion honored. |
| **ConnectWalletButton** | Pending state and error band around the connector seam. |

### Order book — `p2p/`

| Component | Notes |
|---|---|
| **OrderBook** (`p2p/order-book.tsx`) | Composition root. Owns side, filters, and which row is expanded. Holds the **side-aware sort**: buying sorts price ascending, selling descending, so the top row is always the offer worth taking. |
| **OrderRow** (`p2p/order-row.tsx`) | One offer. Grid columns Advertiser / Price / Available–Limits / Payment / Trade, locked to the header by the exported `ORDER_GRID` constant. Stacks with inline labels below `lg`. The advertiser cell carries the trust block. Expands into the trade panel. |
| **OrderTradePanel** (`p2p/order-trade-panel.tsx`) | Inline trade form. Trader's terms left, sizing right. See [§5.1](#51-the-amount-clamp). |
| **MarketStats** (`p2p/market-stats.tsx`) | Best price / offers / average release, computed from the **visible** rows so the headline price is always actionable. |
| **ActivitySummary** (`p2p/activity-summary.tsx`) | The book's only view of your own state: open orders, live ads, disputes when non-zero, and a link to the dashboard. Renders nothing when there is no activity. |

The book is served by `GET /api/ads`, which reads the `order_book` view. Side
and payment method filter server-side; the amount filter narrows what is
already on screen. There are no fixtures — `mock-orders.ts` is deleted, and an
empty database means an empty book.
| **SIDE_TONE** (`p2p/side.ts`) | The one map deciding that **buy is green and sell is red** — label, button variant, tab tone, pill tint, text colour. Every side-stating surface reads from it. |

The panel is one `rounded-2xl` card with `divide-y` rows rather than a stack of separate cards: it keeps the density of a table inside the card language.

#### 5.1 The amount clamp

`available` and `limits` answer different questions in different currencies:

- **`available`** — USDC left on the whole offer. Drains as trades fill.
- **`limits`** — the smallest and largest *single* trade the trader accepts, in USD. Fixed.

The most anyone can trade is therefore **`min(limits.max, available × price)`** — the stated limit or what the remaining inventory is actually worth, whichever binds first. The trade panel enforces exactly that, and when inventory is the binding side the helper line says so (*"capped by remaining USDC"*). The `InfoTip` on the column header explains the distinction in the book itself. Fixtures include one offer where inventory binds, so the case stays reachable.

The amount is entered in whichever currency the side makes natural — fiat when buying, USDC when selling — and the opposite figure derives from price. Limits are quoted in fiat, so the sell side converts before validating.

### Trade — `trade/`

| Component | Notes |
|---|---|
| **TradeScreen** (`trade/trade-screen.tsx`) | Composition root. Order state left, chat right. Owns the lifecycle, the contextual primary action, cancel, and dispute. |
| **TradeSummary** (`trade/trade-summary.tsx`) | Side eyebrow, fiat amount as the hero figure, price, asset leg, method, counterparty, copyable reference. |
| **EscrowStepper** (`trade/escrow-stepper.tsx`) | Vertical `<ol>` timeline over `ESCROW_STEPS`. States `completed` (filled primary + check), `current` (primary tint, ring, spinner), `pending` (bordered outline + dot), `disputed` (destructive tint + triangle). The connecting rail turns primary behind completed steps. A `halted` prop drops the spinner when a lifecycle stopped short. `aria-current="step"`, screen-reader status text. |
| **EscrowStatusBadge** (`trade/escrow-status-badge.tsx`) | `rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Mapped with `satisfies Record<EscrowStatus, …>`, so extending the union forces the badge to keep up. |
| **buildTrade** (`trade/build-trade.ts`) | Order + entered amount → `Trade`. Shared by the trade page and the open-orders list so the two cannot disagree about what a trade is worth. |
| **open-orders-store** (`trade/open-orders-store.ts`) | Client-side trade list and the collapsed preference. See [§5.2](#52-open-orders-state). |

#### 5.2 Open-orders state

Trades in flight outlive route changes, so they live in an **external store** backed by `localStorage`, read through `useSyncExternalStore`.

That choice is deliberate: restoring from storage during render is the classic hydration mismatch, because the server has no storage. `useSyncExternalStore` hands React an empty server snapshot, hydrates cleanly, then re-reads the real one. It also needs no provider and syncs across tabs via the `storage` event for free.

Semantics:

- **One trade per order.** Reopening an offer replaces its record rather than stacking duplicates.
- **Status updates no-op for unknown IDs**, so a dismissed trade cannot resurrect itself from a timer.
- **Dismissing a row removes it from the list only.** The escrow is untouched — the labels say so.
- **The trade screen seeds from the stored record.** Stored status sets a floor (`pending`→2, `funded`/`disputed`→3, `released`→4); session actions can only move it forward. Without this, Resume would reopen a cancelled order as live.

Statuses split into Open (`pending`, `funded`, `disputed`) and Past (`released`, `cancelled`). **A dispute counts as open** — it is unresolved and needs action; filing it under history would bury the trade that most needs attention.

### Ads — `ads/`

| Component | Notes |
|---|---|
| **PostAdScreen** (`ads/post-ad-screen.tsx`) | Three-step wizard: type & price, amount & payment, terms & auto-reply. Asset and fiat are static chips, not selectors — single market, and an `InfoTip` says so rather than offering a dropdown that leads nowhere. |
| **pricing** (`ads/pricing.ts`) | Mid-market from the two best prices in the book, ±5% price bounds, and the direction-aware competing benchmark. |
| **ads-store** (`ads/ads-store.ts`) | Published ads, same external-store shape as open orders. `publishAd()` takes a draft and assigns the id and timestamp itself — reading the clock in a component body is impure, and record identity belongs to the store. |

#### 5.3 An ad's side is the inverse of its book tab

The single easiest thing to get silently wrong here.

`P2POrder.mode` is **the side the viewer takes**. An *"I want to sell"* ad is therefore what a viewer **buys** from, and lists under **Buy**. Reverse it and every published ad lands on the wrong tab with nothing to flag it.

It is isolated in `bookModeFor()` (`ads/types.ts`) with the reasoning attached, and the dashboard's ad row prints which tab an ad appears under, so the mapping is visible in the UI rather than living as folklore.

The competing-price benchmark follows the same asymmetry as the book's sort: **selling** competes with sellers and buyers take the cheapest, so it shows the *lowest* ask and undercutting wins; **buying** is the mirror.

The wizard also enforces the [amount clamp](#51-the-amount-clamp) from the other direction — a max limit above what the stated inventory is worth is rejected at the point the ad is written, rather than when someone tries to take it.

### Dashboard — `dashboard/`

| Component | Notes |
|---|---|
| **Panel** (`dashboard/panel.tsx`) | Collapsible section shell — title, lead slot, trailing slot, a separate `collapsedTrailing`, and the disclosure wiring. `PanelEmpty` is the shared empty treatment. |
| **OrdersPanel** (`dashboard/orders-panel.tsx`) | Open/Past tabs, status badges, Resume vs View, cancel. |
| **AdsPanel** (`dashboard/ads-panel.tsx`) | Price, inventory, limits, methods, window, floating-margin badge, book tab, take-down. |

Each panel collapses independently and remembers it, via `useCollapsed(key)` — folding away a long orders list must not also hide your ads.

**Panels show empty states rather than vanishing.** On the book, rendering nothing when empty is right. On a dashboard it is not: an empty Orders panel points at the book, an empty Ads panel offers to post one. A dashboard that disappears when you have nothing is one you cannot use to start.

### Profile — `profile/`

Identity card (avatar, editable nickname, verified mark, copyable address, trading-since) over six record tiles: rating, trades, completion, average release, 30-day volume, positive feedback.

These are the metrics a counterparty judges you on — the same trust block the order book shows for *other* traders, turned to face you. A public trader profile is largely this screen again.

**The picture is the deterministic wallet avatar**, not an upload: it hashes the address, so it is stable, needs no storage, and matches how the same trader appears everywhere else.

**`joinedAt` is a plain date string formatted with a pinned UTC timezone.** A timestamp would reproduce the chat-timestamp hydration mismatch; pinning the zone avoids it by construction instead of guarding with `useMounted()`.

#### 5.4 Identity is editable, verification is earned

**Nickname** (`profile/profile-store.ts`) is an override on the fixture, persisted, edited inline behind a pencil. It also renders in the wallet-menu header above the address — without a second surface, editing it would change one heading and nothing else.

`validateNickname()` is exported so any other surface reuses the rule rather than inventing a second one: 3–20 characters, no leading separator, and **Unicode letter/number classes rather than ASCII ranges**. An ASCII pattern rejects José and Andrés — names these fixtures already use, in a market where SINPE Móvil is a payment rail. Non-ASCII names are a requirement here, not an edge case.

**Verification** (`profile/verification.ts`) is four steps — wallet ownership, email, phone, government ID — each `unverified → pending → verified`. The button in the identity card reports progress (`Get verified · 2/4`) and opens the dialog.

**Only the government ID step grants the public Verified mark.** Email and phone are contact details, not identity; letting them light a badge counterparties read as *"this person is who they say"* would make the app's strongest trust signal cheap. `isVerified()` derives the mark from that one step, and the fixture carries no `verified` field — a hardcoded boolean beside a derived one is two sources of truth waiting to disagree.

### Chat — `chat/chat-panel.tsx`

Header (counterparty avatar with live dot, handle, address, trade count), a dismissible safety notice, the message stream, and a composer where Enter sends and Shift+Enter breaks the line.

- Outgoing bubbles: `bg-chat-bubble-outgoing`, bottom-right corner tightened, delivery ticks (single = sent, double = delivered/read, primary when read).
- Incoming: `bg-muted`, bottom-left tightened.
- **System messages** are centred pills — escrow events land in the same stream as the conversation, which is the point.
- **Image bubbles** carry the transfer screenshot the fiat leg turns on. Thin frame instead of the text padding, caption below when there is one, click to open a lightbox. The `width`/`height` attributes come from the stored dimensions, so the conversation does not jump as images load.
- **Attaching**: paperclip in the composer, drag-and-drop onto the panel, and paste — paste is the one that matters, since a desktop screenshot is pasted rather than saved and picked. A pending upload previews *above* the composer, not as a bubble in the list: the list only ever renders what the server returned, which is what stops a message appearing twice when the next poll lands.
- `role="log" aria-live="polite"`, auto-scrolled on new messages.

The safety notice carries the one thing that actually loses people money: *never release USDC until the payment has cleared in your own account.* Attachments make that line matter more, not less — a screenshot is the easiest thing in the conversation to fake, and the notice says so.

### Wallet — `wallet/wallet-menu.tsx`

The connected-wallet chip and its menu: header with avatar and address, **Copy address**, and **Disconnect** — the dApp's logout, since there is no session beyond the wallet. Full ARIA menu pattern: `aria-haspopup`, ArrowDown to open, focus into the menu, arrows cycle, Escape and Tab close and restore focus, `pointerdown` outside dismisses.

---

## 6. Motion

Framer Motion, used sparingly, at two moments:

- **Connect screen** — staggered entrance; the mark scales up (0.92→1), the action fades in behind it. Shared easing `[0.22, 1, 0.36, 1]`.
- **Order book** — the panel fades up once on mount.

Both branch on `useReducedMotion()` and pass `initial={false}` when reduced, so nothing animates.

Everything else is CSS: `transition-colors`, `transition-all duration-200`, `active:scale-97`, and `.animate-breathe` (disabled under `prefers-reduced-motion` in the stylesheet itself). `disableTransitionOnChange` on the ThemeProvider prevents a colour sweep during theme switches.

The earlier app's scroll-triggered `Reveal` wrapper was not carried over — nothing here is long enough to scroll into.

---

## 7. Conventions

**The `cn()` helper** (`lib/utils.ts`) — every component merges classes through it.

**`data-slot` attributes** on component roots (`data-slot="order-row"`, `"chat-panel"`, …) — shadcn convention, gives styling and testing hooks.

**Props pattern:** extend `React.ComponentProps<"div">`, destructure `className`, spread `...props` last.

**Server-first:** components are RSC by default; `"use client"` only where hooks, `window`, or handlers are needed. Pages stay server components so they can own `metadata`.

**Formatting** goes through `lib/format.ts`: `formatFiat`, `formatAsset`, `formatPrice`, `truncateAddress`. Explicit locales keep SSR and the client in agreement. **Prices render to three decimals** — USDC trades within a cent of parity, and two would flatten every offer to `1.00`.

### React rules this codebase has already been bitten by

- **No `Date.now()` in a render body.** It is impure and lint enforces it. Resolve timestamps once when a message is created — in an event handler or a lazy `useState` initializer, both of which are fine.
- **No `setState` in an effect.** Lint enforces this too. Reach for `useSyncExternalStore` when you need external state.
- **Anything timezone- or clock-dependent renders only after mount**, behind `useMounted()` (`lib/use-mounted.ts`). The server cannot know the viewer's timezone, so formatting a time during SSR is a guaranteed mismatch. Where a date is fixed rather than live, pin the formatter's `timeZone` instead — deterministic, and no mount guard needed.
- **Persisted UI state goes through an external store**, never a `useState` seeded from `localStorage`. `lib/use-collapsed.ts` (keyed, for panels) and the trades and verification stores follow this shape.
- **Anything cached per-account goes through `lib/scoped-store.ts`.** A plain
  module cache fetches once and then serves the previous trader's data after an
  account switch, under the new trader's address. The scoped store binds a
  value to the session it was loaded under and drops it the moment that
  changes.
- **Validate against Unicode classes, not ASCII ranges.** This market writes José and Andrés; `[a-zA-Z]` is a bug waiting to be filed.

### Accessibility — hold the line

- `focus-visible:ring-2 focus-visible:ring-ring` with an offset on everything interactive
- `aria-label` on all icon-only buttons; `aria-hidden` on decorative SVGs
- `aria-expanded`/`aria-controls` on every disclosure — trade panel, orders collapse, wallet menu
- `aria-current="step"` on the stepper; `role="log" aria-live="polite"` on messages; `role="alert"` on errors
- Full keyboard support on the tab bar, wallet menu, and dialog
- `sr-only` text where colour alone would carry meaning (stepper statuses)

**Empty states are designed, not forgotten:** `rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground`.

### Colour discipline

`SIDE_TONE` decides side colour; `destructive` means danger. These must not collide:

- Buy is green, sell is red — on the side switch, the row and panel CTAs, side badges, and the trade-summary eyebrow.
- The `sell` button variant is **solid**, distinct from the **tinted** `danger` used for Cancel and Dispute.
- **Action buttons inside a trade stay `primary`.** On a sell at the release stage the buttons are "Release USDC" and "Raise dispute"; colouring the first red would put two reds side by side, one completing the trade and one escalating it. On the trade screen, red means destructive and nothing else.

---

## 8. Decisions and open questions

### Resolved from the original spec

Each of these was a known flaw in the earlier app, fixed here on day one:

1. **`frontend/` directory dropped** — components live at the repo root.
2. **Button takes `children`** and has an `icon` size, so the theme toggle uses the real primitive instead of hand-rolling a native button.
3. **All variants use semantic tokens** — no raw `zinc-*`/`red-*`/`amber-*` scales.
4. **`success`/`warning`/`info` tokens defined**, which also gives `--color-spark` a job.
5. **One folder convention** — kebab-case files with co-located types.
6. **One language** — English throughout.

### Deliberate divergences from the original spec

| Spec said | We built | Why |
|---|---|---|
| Every screen `max-w-md`, mobile-first | Desktop-first, `max-w-[1400px]` | The order book is a dense table; the trade screen runs state and chat side by side |
| `/` is a marketing landing | `/` is wallet connect | SafeSwap runs as a dApp; there is no credential flow and no marketing page |
| Bottom navigation, 4 items | Sticky top header | Mobile nav does not fit a desktop layout, and its Home item has no target |
| Trade detail at `/p2p/orders/[id]` | Inline expanding panel | Sizing a trade without leaving the book |
| `localStorage` trade state excluded | Open orders persisted | Losing a trade in flight on navigation is worse than the coupling |
| `EscrowStatus` has four states | Five, adding `cancelled` | An order dropped before the fiat leg reaches none of the other four |
| No ad posting | `/p2p/ads/new` wizard | Takers alone are half a marketplace; someone has to make the offers |
| — | `/dashboard` and `/profile` | Your orders and ads outgrew a panel on the book; the book is for finding a counterparty |

### Open questions

- **i18n.** Copy is English and hardcoded. Adopting a library is undecided.
- **Cancelled and disputed share a red.** They are the only two destructive states and currently look identical at a glance, though one needs action and one does not.
- **Contrast.** Neither the brand-green nor the sell-red solid button clears 4.5:1 against white text. Inherited from the brand palette; fixing it means darkening both fills.
- **Sorting controls.** The book always sorts by best price. The reference exposes a sort selector.
- **`PaymentBubble`.** Inline payment and payment-request bubbles with Pay/Reject actions — the richest chat feature, still unbuilt.
- ~~Published ads do not appear in the public book.~~ **Resolved:** they do, and your own are filtered out of the book you browse — you cannot trade with yourself.
- **The payment rails and the market currency disagree.** Rails are Costa Rican, including SINPE Móvil, which settles in colones; `MARKET.fiat` is still `USD`. See [`STATUS.md`](./STATUS.md) §3.
- **No public trader view.** `/traders/[address]` does not exist, though the profile's record tiles are already the shape it needs.
- **Verification status is client-held.** Fine for the UI, meaningless as a security boundary — a real build reads it from the KYC provider and never trusts the client.

---

## 9. Out of scope

Deliberately excluded. Every seam is a mocked async function that resolves after a beat, so pending states are honest.

| Excluded | Seam in this repo |
|---|---|
| Wallet connection (Freighter) | `mockConnectWallet()` in `auth/connect-wallet-button.tsx`; `CONNECTED_ADDRESS` in `lib/wallet.ts` is the stub public key everything reads |
| Disconnect | `handleDisconnect()` in `wallet/wallet-menu.tsx` |
| Escrow deployment | `handleSubmit()` in `p2p/order-trade-panel.tsx` |
| Approve / release | `advance()` in `trade/trade-screen.tsx` |
| Cancel (refund) | `cancelOrder()` in `trade/trade-screen.tsx` |
| Dispute | `raiseDispute()` in `trade/trade-screen.tsx` |
| Publishing an ad | `handlePublish()` in `ads/post-ad-screen.tsx` |
| Order persistence | `trade/open-orders-store.ts` — swap the localStorage layer |
| Ad persistence | `ads/ads-store.ts` — same |
| Trader record | `profile/mock-profile.ts` — derived from settled escrows in a real build |
| Nickname | `setNickname()` in `profile/profile-store.ts` |
| Identity verification | `startVerification()` in `profile/verification-dialog.tsx`; statuses in `profile/verification.ts` |
| Stellar SDK, Horizon, XDR signing | None — the UI never touches these |
| API routes, Supabase | None |

Order fixtures live in `p2p/mock-orders.ts`. The sized amount and chosen payment method travel from the book to the trade screen as **search params** — with no backend to create an order against, the URL is what carries the trade, which also makes trades linkable and refresh-safe.

Status vocabularies the UI renders:

```ts
type EscrowStatus     = "pending" | "funded" | "disputed" | "released" | "cancelled";
type EscrowStepStatus = "completed" | "current" | "pending" | "disputed";
type OrderMode        = "buy" | "sell";
type AdSide           = OrderMode;   // inverted for the book — see 5.3
type PriceType        = "fixed" | "floating";
type VerificationStatus = "unverified" | "pending" | "verified";
```

---

## 10. What's next

- [ ] Publish ads into the public book, once the self-trade question is settled
- [ ] `/wallet` — balance card, quick actions, recent activity
- [ ] `/transactions` — searchable, tabbed, day-grouped history
- [ ] `PaymentBubble` — inline payment and request bubbles in chat
- [ ] Editing and taking down ads from the dashboard (currently take-down only)
- [ ] A public trader profile at `/traders/[address]`
- [ ] `app/favicon.ico` alongside the SVG, if pre-16.4 Safari matters
- [ ] `/escrow/[id]/admin` — dispute resolver form, internal-facing
- [ ] Decide the i18n policy before more copy accumulates
- [ ] Verify both themes on every new screen; check contrast on `muted-foreground` over `background`
