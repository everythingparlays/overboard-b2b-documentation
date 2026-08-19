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

There's no shared navigation shell today — `signOut` is copy-pasted inline as a button on `ContestsPage.tsx` (line 91) and `BoardPage.tsx` (line 356), and there's no Terms/Privacy link anywhere in the app. This story centralizes that into one reusable menu component.

## Design conventions to follow

- Use shadcn/ui's `Sheet` component (not yet in `src/components/ui/` — add it with the shadcn CLI so it matches the existing "new-york" style/Radix primitives, same as `card.tsx`, `badge.tsx`, etc.)
- Icons from `lucide-react` (already the project standard — see `BingoCell.tsx`, `ErrorTestPanel.tsx`)
- Style with Tailwind theme tokens only — no hardcoded hex colors. The panel must pick up each tenant's brand colors automatically via the CSS custom properties already set on `document.documentElement` (see `TenantContext.tsx`), the same way every other themed component does.
- Match existing spacing/typography/button styles used elsewhere in the app (e.g. `Button` variants in `components/ui/button.tsx`) rather than inventing new ones.

## Requirements

1. A hamburger icon button opens a slide-out panel from the side (mobile and desktop).
2. Menu contains three items:
   - **Log Out** — calls `useClerk().signOut({ redirectUrl: "/sign-in" })`, same pattern as the existing inline buttons (which should now be removed/replaced by this component instead of duplicated).
   - **Terms of Service** — opens a link in a new tab.
   - **Privacy Policy** — opens a link in a new tab.
3. For V1, wire the menu into `DashboardPage.tsx` only (that's the main authenticated landing page). Rolling it out to every page is a follow-up ticket, not part of this one.
4. Menu closes on item click, on outside click, and on `Esc`.
5. Terms/Privacy URLs should be **placeholder values for now**, stored as constants (not hardcoded strings scattered around) — flag in the PR description that these should eventually move into per-tenant config (each tenant may need its own ToS/Privacy language per the PRD), but that's out of scope here.

## Acceptance criteria

- [ ] Menu opens/closes via hamburger icon, outside click, and `Esc`
- [ ] Log Out signs the user out and redirects to `/sign-in`
- [ ] Terms of Service and Privacy Policy links open in a new tab
- [ ] Menu colors/fonts adapt correctly when switching tenants (test with at least 2 of the 5 configs in `config/tenants/`)
- [ ] No hardcoded colors — inspect with dev tools to confirm Tailwind theme vars are used
- [ ] Duplicate inline sign-out buttons on `ContestsPage` and `BoardPage` are removed in favor of this component (or left with a `// TODO: replace with SideMenu` note if not ready to touch those pages yet — reviewer's call)

## Out of scope

- Wiring the menu into every page / building a shared app header
- Per-tenant ToS/Privacy URLs (config schema change)
- User profile info in the menu
