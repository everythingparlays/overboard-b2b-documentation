# Side Menu: Log Out, Terms of Service, Privacy Policy

**Status:** Draft
**Assignee:** @arthurwin
**Type:** Feature (frontend, UI) · **Size:** S (good first ticket)
**Repo:** `overboard-b2b-template`
**PRD refs:** None directly — related in spirit to `AUTH-*` (logout) and the tenant-configurable ToS/Privacy language noted in PRD §OPT (line 217). Not itself a PRD requirement; filed as a standalone UX gap.

---

## Story

As a fan using the B2B app, I want a side menu I can open from anywhere in the app so that I can log out or find the Terms of Service and Privacy Policy without hunting for them.

## Context

There's no shared navigation shell today — `signOut` is copy-pasted inline as a button in `src/pages/contests/ContestsPage.tsx` (line 91) and `src/pages/board/BoardPage.tsx` (line 393), and there's no Terms/Privacy link anywhere in the app. This story centralizes that into one reusable menu component.

## Design conventions to follow

- Use shadcn/ui's `Sheet` component (not yet in `src/components/ui/` — add it with the shadcn CLI so it matches the existing "new-york" style/Radix primitives, same as `card.tsx`, `badge.tsx`, etc.)
- Icons from `lucide-react` (already the project standard — see `src/components/board/BingoCell.tsx`)
- No hardcoded hex colors. Tenant brand colors reach the DOM as CSS custom properties that `TenantContext.tsx` sets imperatively on `document.documentElement` (`--tenant-primary`, `--tenant-secondary`, `--tenant-border`). **These are not registered as Tailwind theme tokens**, so there is no `bg-tenant-primary` utility — consume them as Tailwind arbitrary values, which is what the rest of the app does:

  ```tsx
  className="bg-[var(--tenant-primary)] border-[var(--tenant-border)]"
  ```

  Working examples: `src/components/contests/PlayerCard.tsx:63`, `src/pages/HomePage.tsx:153`. Do not copy `src/components/board/BingoProgress.tsx` — its tenant-color classes are malformed and silently do nothing (see Known issues below).
- Match existing spacing/typography/button styles used elsewhere in the app (e.g. `Button` variants in `components/ui/button.tsx`) rather than inventing new ones.

## Requirements

1. A hamburger icon button opens a slide-out panel from the side (mobile and desktop).
2. Menu contains three items:
   - **Log Out** — calls `useClerk().signOut(...)`. Note the existing inline buttons pass `redirectUrl: "/"`, not `/sign-in`. Either is defensible (`/` renders `StartScreen` once signed out), so **match the existing `"/"` unless told otherwise** and keep behaviour unchanged; this ticket centralizes the duplication, it does not change where logout lands. Remove the inline buttons rather than leaving them alongside the new component.
   - **Terms of Service** — opens a link in a new tab.
   - **Privacy Policy** — opens a link in a new tab.
3. For V1, wire the menu into `src/pages/dashboard/DashboardPage.tsx` only (that's the main authenticated landing page). Rolling it out to every page is a follow-up ticket, not part of this one.
4. Menu closes on item click, on outside click, and on `Esc`.
5. Terms/Privacy URLs should be **placeholder values for now**, stored as constants (not hardcoded strings scattered around) — flag in the PR description that these should eventually move into per-tenant config (each tenant may need its own ToS/Privacy language per the PRD), but that's out of scope here.

## Acceptance criteria

- [ ] Menu opens/closes via hamburger icon, outside click, and `Esc`
- [ ] Log Out signs the user out and redirects to `/sign-in`
- [ ] Terms of Service and Privacy Policy links open in a new tab
- [ ] Menu colors/fonts adapt correctly when switching tenants (test with at least 2 of the 5 configs in `config/tenants/`)
- [ ] No hardcoded colors — inspect with dev tools to confirm the `--tenant-*` custom properties are what's applied
- [ ] Duplicate inline sign-out buttons in `pages/contests/ContestsPage.tsx` and `pages/board/BoardPage.tsx` are removed in favor of this component (or left with a `// TODO: replace with SideMenu` note if not ready to touch those pages yet — reviewer's call)

## Known issues you may notice (not yours to fix)

- `src/components/board/BingoProgress.tsx` lines 31 and 48 have malformed Tailwind classes — `bg-(--tenant-primary)]` and `border- (--tenant-primary)]` (stray `]`, and a space in the second). They compile but apply no color. Pre-existing POC bug, tracked separately; don't fix it inside this PR and don't copy the pattern.
- The dev build prints two Tailwind warnings about `Unexpected token Delim('.')`. Pre-existing and harmless — the build still exits 0.

## Out of scope

- Wiring the menu into every page / building a shared app header
- Per-tenant ToS/Privacy URLs (config schema change)
- User profile info in the menu
