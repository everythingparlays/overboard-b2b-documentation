# Webapp Spec: Visual Design System

**Status:** Reference — describes what `overboard-b2b-template` actually does as of 2026-08. Not a proposal; there is nothing here to approve. Where the code disagrees with itself, both sides are shown and flagged rather than silently picking one. Update this doc when the underlying pattern changes; don't let it drift into fiction.

## Overview

This catalogs how the frontend is actually styled today — color, type, spacing, radius, motion, and component conventions — read directly out of `src/`, not out of intent. It exists so new UI (the multi-tenant entry-flow screens, and whatever comes after) can match the house style without re-deriving it from scratch, and so a "does this match?" question has a document to point at instead of a vibe.

**Stack:** Tailwind v4 (`@theme inline` token bridge), shadcn/ui components on Radix primitives, `class-variance-authority` for variants, `lucide-react` icons, `tw-animate-css` for motion utilities.

**Scope:** `overboard-b2b-template` only.

---

## 1. Foundations: Tenant-Driven Color, Not a Static Palette

The one fact that governs everything else: this app does not have a brand palette. It has a **runtime theming system** — read [`documentation/tenant-color-system.md`](../../../overboard-b2b-template/documentation/tenant-color-system.md) in full when touching color; this section only summarizes the model.

Three layers: a tenant's 8-field `TenantColors` object (`src/config/tenants/<slug>.ts`) → `applyTenantColors()` sets CSS custom properties on `:root` at runtime → `index.css`'s `@theme inline` block bridges those into the `--color-*` names Tailwind reads to generate utilities. Setting `--background` in JS is sufficient; you never touch `--color-*` directly.

**Design rule: never hardcode a hex value in a component.** Always express color through the semantic tokens — `bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-accent`, `text-muted-foreground` — so the same component reskins correctly across every tenant. The one sanctioned exception is `--tenant-primary` / `--tenant-secondary` / `--tenant-border`, a deliberate escape hatch for Tailwind arbitrary-values (`from-[var(--tenant-primary)]`) and React inline `style` props, which can't resolve the Tailwind-owned `--color-*` names.

**Single dark theme, no light mode.** `:root` in `index.css` already carries dark-equivalent `oklch` values; the `.dark` class duplicates them almost exactly. No `ThemeProvider` wraps the app (the only `next-themes` usage is inside `sonner.tsx`, unwrapped — see §4), and nothing in the product toggles `.dark` on or off. Design for one dark surface, not a light/dark pair.

**Status colors are the one non-tenant palette.** `--success` / `--info` / `--warning` / `--destructive` are fixed in `index.css` and are *not* overridden per tenant — they're the platform's own semantic vocabulary (joinable / joined / live / closed), and they should stay tenant-independent: a "closed" badge should read as closed on every team's site, not shift hue with team colors.

> **Flag:** `ContestCard.tsx` hardcodes literal Tailwind colors on its status badge (`bg-blue-600`, `bg-emerald-600`, `bg-rose-600`) instead of using `StatusBadge`'s own token-based `variantStyles` (`bg-info/15`, `bg-success/15`, `bg-destructive/15`, …). Two different visual treatments now exist for the same statuses depending on which code path renders them, and the hardcoded path bypasses both the status-color system and the tenant-independence it's meant to guarantee.

---

## 2. Typography

**Font:** `--font-sans: 'Satoshi', ui-sans-serif, system-ui, sans-serif` (`index.css:8`). **No `@font-face` for Satoshi exists anywhere in the codebase** — confirmed by search. Every environment silently falls back to the system sans-serif stack today.

> **Flag:** either ship the actual font files (`public/fonts/` + `@font-face`, or a hosted `<link>`) or stop declaring a font the app doesn't load, and design against the system-font fallback on purpose.

**Scale actually in use** (not the full Tailwind scale — only what's exercised, by frequency):

| Class | Uses | Role |
|---|---|---|
| `text-sm` | 55 | Default body/label size — the single most common size in the app |
| `text-xs` | 34 | Meta, captions, eyebrow labels |
| `text-base` | 18 | Slightly emphasized body copy |
| `text-3xl` | 11 | Section headers ("Contests", "Draft Your Squad") |
| `text-2xl` | 7 | Sub-headers, modal titles |
| `text-lg` / `text-xl` | 6 / 4 | Rare, secondary emphasis |
| `text-4xl` / `text-5xl` / `text-6xl` | 3 / 2 / 1 | Hero/display only — org name, `BingoProgress` count, legacy headline |

**Weight:**

| Class | Uses | Role |
|---|---|---|
| `font-semibold` | 36 | Default for headers and emphasis |
| `font-medium` | 29 | Labels, secondary emphasis |
| `font-bold` | 16 | Stat numbers, CTA-adjacent emphasis |
| `font-black` | 4 | Reserved for the single loudest element on a screen (`PageHeader` title, `BingoProgress` count) — treat as a "one hero moment per page" tool, not a heading weight |

**Casing:** `uppercase` + `tracking-tight`/`tracking-wide` appears specifically on hero headlines (`StartScreen`'s "`{Team}` Bingo", legacy `HomePage`'s "BINGO") and short eyebrow labels ("Sponsored By", consent "Required"/"Optional" tags) — never on body copy, and only on one legacy button. Reserve uppercase for hero titles and short eyebrow/meta labels.

> **Flag:** `PageHeader.tsx` and `BackButton.tsx` hardcode `text-gray-400` / `text-gray-500` / `text-white` instead of `text-muted-foreground` / `text-foreground`. Any page using either component gets Tailwind gray regardless of the active tenant's `textMuted`/`text` colors — a silent break in the theming system described in §1.

---

## 3. Spacing & Layout Rhythm

**Base unit:** Tailwind's 4px scale, but real usage clusters hard at two values:

| Class | Uses |
|---|---|
| `gap-2` (8px) | 40 |
| `gap-4` (16px) | 23 |
| `gap-3` (12px) | 8 |
| `gap-1` (4px) | 7 |

Treat 8px and 16px as the two workhorse spacing values. `gap-1`/`gap-3`/`gap-6` exist but are the exception, not a full scale in active use.

**Page shell — two patterns coexist, scoped by page family:**

1. **`PageContainer`** (`components/layout/PageContainer.tsx`): `min-h-screen bg-background` wrapping `max-w-lg mx-auto px-4 pt-5 space-y-7`. Used by `ContestsPage`, `ContestPage` (with `withInner={false}` and the same `max-w-lg px-4` applied manually). This is the post-auth app shell.
2. **Ad hoc auth-page pattern** (`SignIn`, `SignUp`, `StartScreen`): `min-h-svh bg-background flex flex-col items-center` + `max-w-sm w-full`, with `pt-24` (SignIn/SignUp) or `px-6 py-12` (StartScreen). This is the narrower, single-column onboarding pattern.

**New auth/onboarding screens — including the join and re-consent flows — should follow the `max-w-sm` auth pattern, not `PageContainer`.**

**Sticky footer** (`components/layout/StickyFooter.tsx`): `fixed bottom-0 p-4 bg-background backdrop-blur`, inner `max-w-lg mx-auto`. Used on `ContestPage` for the "Generate Bingo Board" CTA. Reach for this instead of an inline bottom button whenever the page body scrolls independently of the primary action.

**Radius scales with surface size, not fixed:**

| Class | Uses | Where |
|---|---|---|
| `rounded-full` | 28 | Pills, badges, avatars — the single most common radius in the app |
| `rounded-xl` | 18 | Buttons, some inputs, medium cards |
| `rounded-lg` | 18 | Buttons, inputs, small cards |
| `rounded-md` | 11 | shadcn component defaults (`Input`, `Skeleton`, `Tabs` trigger) |
| `rounded-2xl` | 6 | Medium content surfaces — `BingoCell`, matchup card, `PrizeModal`, `BingoProgress` |
| `rounded-3xl` | 4 | The largest tap-target surfaces — `ContestCard` |

Rule of thumb: **the bigger and more "tappable" the surface, the rounder its corners.**

**Elevation:** a `1px solid border-border` is the default separator everywhere, not shadow. Shadow shows up only as the shadcn defaults (`shadow-xs`/`shadow-sm` on `Card`, `Input`) and `shadow-2xl` on true overlays (`PrizeModal`, legacy `HomePage` card). Elevation is expressed through border + `bg-card`, not drop shadow, except for overlays.

---

## 4. Components

| Component | File | Real-world pattern |
|---|---|---|
| **Button** | `ui/button.tsx` | CVA, 6 variants × 8 sizes, but only `default` (solid `bg-primary`) and `outline` are used in any routed page — `destructive`/`secondary`/`ghost`/`link` exist in the primitive, unproven in this app. Primary CTAs are always manually bumped to `h-12 rounded-xl` (SignIn/SignUp/StartScreen/PrizeModal), or a compact `h-9 rounded-lg` for card-level actions (`ContestCard`'s Join/View, `ContestsPage`'s Log out). The component's own default size (`h-9 px-4`) is rarely left unmodified. |
| **Input** | `ui/input.tsx` | Default is `h-9 rounded-md border-input bg-transparent`; every real form overrides to `h-12 rounded-lg bg-input border-border`. Treat the override as the actual convention. |
| **Checkbox** | `ui/checkbox.tsx` | shadcn default: 16px (`size-4`) square, `rounded-[4px]`. The one real usage (legacy `HomePage` form) pairs it with label text via `space-x-3`. No routed page shows a "consent card" row (checkbox + copy + required/optional tag) — that's genuinely new UI. Size it up from the 16px default for a full-width tap row; it reads too small against 13–14px body copy otherwise. |
| **Badge / StatusBadge** | `ui/badge.tsx`, `ui/status-badge.tsx` | `Badge` is the shadcn pill primitive. `StatusBadge` wraps it with the app's real semantic vocabulary (`joinable`/`opens-soon`/`closed`/`filled`/`joined`/`live`/`soon`/`upcoming`/`finished`) mapped to `--success`/`--warning`/`--info`/`--destructive`/`--muted`. This is the component for any state/status pill — extend `variantStyles` rather than inventing a new inline color combination (see the `ContestCard` flag in §1). |
| **Card** | `ui/card.tsx` | Default: `bg-card rounded-xl border py-4 shadow-sm`, sub-parts padded `px-6`. In practice most real surfaces (`ContestCard`, `BingoCell`, matchup card, `PrizeModal`) skip the sub-components entirely and hand-roll a `div` with `bg-card border border-border rounded-{xl\|2xl\|3xl}` and custom padding — usually `px-4` or `px-3`, not the primitive's `px-6`. The primitive is present but lightly adopted; don't assume its padding is the house rule. |
| **Avatar** | `ui/avatar.tsx` | Used for multi-select summaries (`ContestPage` sticky footer) with an overlapping stack (`-mr-2 last:mr-0`, `border-2 border-primary`). Reach for this pattern when a screen needs to show N-of-many selected identities compactly. |
| **Progress** | `ui/progress.tsx` | Used both as-is (`BingoCell`'s per-cell fill) and hand-reimplemented in `BingoProgress.tsx` (a custom milestone-dot track) rather than composed from the primitive. Two implementations for two different jobs (single value vs. milestone track) — a legitimate split, not a bug. |
| **Toast** | `ui/sonner.tsx` | Wired to `next-themes`, but no `ThemeProvider` exists anywhere in the app — it resolves via OS-level system preference on load rather than the app's own (permanently dark) theme. Harmless today only because the two happen to roughly agree; worth knowing if a light-looking toast on a dark page ever gets reported. |

> **Flag — real bug, not a style-convention note:** `BingoProgress.tsx`'s fill bar and achieved-milestone dots use malformed Tailwind arbitrary-value syntax — `bg-(--tenant-primary)]` (stray trailing bracket, appears twice, lines 31 and 48) — which almost certainly fails to apply the intended tenant color at runtime. Worth a real fix; noted here because it surfaced during this pass.

---

## 5. Iconography

`lucide-react` exclusively — no other icon set anywhere in the codebase (14 distinct usages). Sized with Tailwind (`size-4` inline-with-text default, `size-9`/`size-10` for standalone icon buttons), never a custom SVG icon set. When mocking a screen outside the codebase (a static prototype that can't import `lucide-react`), draw the equivalent lucide icon by hand rather than inventing a new glyph, and swap in the real import on implementation.

---

## 6. Motion

Minimal and state-driven, not decorative. `tw-animate-css` powers `animate-in`/`fade-in`/`zoom-in-95`/`slide-in-from-*`, used only for:

- Tab-switch content transitions (`ContestsPage`, 300ms slide + fade)
- Modal enter (`PrizeModal`, 200ms fade + `zoom-in-95`)

No hover-scale, no continuous looping animation, except `animate-pulse` on the "LIVE" badge dot and on `Skeleton` loading placeholders. New motion should stay in this vocabulary — entrance transitions on state changes, not ambient movement.

---

## 7. Responsive Behavior

There is none. Zero `sm:`/`md:`/`lg:`/`xl:` breakpoint classes exist anywhere in the codebase (confirmed by search). Every page is designed at a single mobile-portrait width and center-column-clamped (`max-w-sm` or `max-w-lg`) regardless of viewport. Treat this as a mobile-only product surface today — a tablet/desktop pass would be new work, not an extension of an existing responsive system.

---

## 8. Checklist for New Screens

- [ ] Color via semantic tokens only (`bg-background`/`bg-card`/`bg-primary`/`text-foreground`/`text-muted-foreground`/`border-border`); `--tenant-*` only for gradients or inline styles that can't take a Tailwind utility.
- [ ] One dark surface — don't design a light variant.
- [ ] Status/consent states → `StatusBadge`'s token-based variant pattern, not a new hardcoded color.
- [ ] Body copy `text-sm`, meta/caption `text-xs`, headers `text-2xl`–`text-4xl` `font-semibold`; reserve `font-black` + `uppercase` for one hero moment per screen.
- [ ] Primary CTA: solid `bg-primary`, `h-12`, `rounded-xl` — **not** the gradient pattern (currently dead code — see §9.1).
- [ ] Form inputs: `h-12`, `rounded-lg`, `bg-input`, `border-border` — not the shadcn `h-9` default.
- [ ] Container: `max-w-sm` for auth/onboarding flows (join, re-consent, sign-in/up), `max-w-lg` for the post-auth app shell.
- [ ] Radius scales with surface size: `rounded-2xl`/`rounded-3xl` for big content surfaces, `rounded-lg`/`rounded-xl` for buttons/inputs/small cards, `rounded-full` for pills/avatars.
- [ ] Icons: `lucide-react` only.
- [ ] No responsive breakpoints needed — single mobile-portrait layout is the norm.

---

## 9. Known Inconsistencies

Only reachable, routed code counts as "the convention" — §1–§8 above are already written that way (e.g. the solid-`bg-primary` CTA rule in §8 reflects what's actually routed, not what's merely documented elsewhere). The gaps below are tracked as real fix-it items in [`documents/POC-baseline/known-issues.md`](../../documents/POC-baseline/known-issues.md), not here — this section just records what this audit found and why each one matters for anyone touching these surfaces next, so the two docs don't drift out of sync:

1. **Gradient CTA vs. solid CTA (dead code, not a live inconsistency).** `tenant-color-system.md` §5 documents a gradient button pattern, implemented only in `HomePage.tsx` — which `App.tsx` never routes to (`/` renders `StartScreen`). Every real, routed primary CTA uses a flat `bg-primary` button. Nothing to reconcile going forward: §8's checklist already reflects the live pattern; `known-issues.md`'s dead-code entry notes the doc/code mismatch for whoever eventually deletes `HomePage.tsx`.
2. **Undelivered brand font.** `'Satoshi'` is declared as `--font-sans` (`index.css:8`) but never loaded anywhere — no `@font-face`, no hosted `<link>`. Every environment silently renders the system sans-serif fallback. Live, affects every page. Tracked in `known-issues.md`.
3. **Hardcoded grays bypass tenant theming.** `PageHeader.tsx` and `BackButton.tsx` use `text-gray-400`/`text-gray-500`/`text-white` instead of `text-muted-foreground`/`text-foreground`. Live on `/board/:boardId` and `/dashboard`. Tracked in `known-issues.md`.
4. **Duplicate status-color treatments.** `ContestCard.tsx` hardcodes `bg-blue-600`/`bg-emerald-600`/`bg-rose-600` on its status badge instead of `StatusBadge`'s own token-based `variantStyles`. Live on `/contests`. Tracked in `known-issues.md`.
5. **Broken arbitrary-value syntax in dead code.** `BingoProgress.tsx` uses `bg-(--tenant-primary)]` (stray trailing bracket) for its fill bar and achieved-milestone dots — but the component isn't imported anywhere, so this doesn't affect anything live today. Noted in `known-issues.md`'s dead-code entry for whoever eventually wires it up or deletes it.

---

## Related

- [`documentation/tenant-color-system.md`](../../../overboard-b2b-template/documentation/tenant-color-system.md) — authoritative source for the color-token mapping; this spec only summarizes §1–§3 of it.
- [`AGENTS.md`](../../AGENTS.md) — `TEN-C1` (prefer configuration over per-tenant code), the constraint the entire tenant color system exists to satisfy.
