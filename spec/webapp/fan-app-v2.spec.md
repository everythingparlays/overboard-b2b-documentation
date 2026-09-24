# Webapp Spec: Fan App v2 — Screens, Shell and Copy

**Implements:** Arthur's 2026-09-24 walkthrough rulings (wave `2026-09-24`, `WAVE-RULES.md`): the fan app overhaul toward Prime Time, endless-scroll lists, contest type with the Trivia placeholder, Description shown to fans, curated admin-editable text, the unified preview. PRD `GAME-F1` (the games-list home, "design not yet specified" in the PRD, specified here), `BRAND-02` (sponsor sign-in placement on the start screen), `OPT-01`–`OPT-05` (consents, via the entry gate). Decision `D-068` (honesty by omission).

**Depends on:** [`entry-gate.spec.md`](entry-gate.spec.md) — the join gate's behaviour, submission and 409 discipline, all unchanged here. [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) (sibling, this wave) — board builder, live board, prize popup, standings and results. [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) — the `/preview` route. [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md) — the decor kit and its contract changes (`decor` block, `surface.texture: "bingoGrid"`, the 2–4 colour palette). [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) — the Brand page that edits the palette, decor and the five brand strings. Build order: [`fan-app-v2-build-plan.md`](../../documents/HLDs/fan-app-v2-build-plan.md). G2's wave-2026-09-24 fixes: tenant name from the API, no light-mode flash, the sign-up "I agree" checkbox wired or removed, auth-variant removal. This spec designs around the fixed state and does not respec those fixes.

**Status:** Draft (design wave 2026-09-24; build in a later wave). Supersedes [`styling.spec.md`](styling.spec.md) for the visual layer of every fan screen it covers.

## Overview

The fan app today is a sign-in screen, a contests list with two tabs, a player-draft page, a board polled every two minutes, and an orphaned "My Boards" page. There is no home, no contest page, no profile, no in-app terms, no handling for a tenant paused mid-session, and every string is hardcoded. This spec defines every fan screen except the contest-flow internals: the start gate, the auth screens, the join gate's restyle, Home, the Contests list, the contest detail page, Profile and the menu, Terms and Privacy, and the paused screen. It also defines the shell they share, the navigation between them, the curated text an admin may edit, and the data each screen needs from the API.

**The whole change, in one line:** the fan app becomes a small, broadcast-styled product with a home, a real contest page and a profile, dressed in tenant-coloured decoration, where every string is written down, twelve of them are editable by the tenant, and nothing on screen explains what isn't there.

**In scope:**
- Routes, redirects, back behaviour and deep links for the whole fan app.
- The shell: top bar, menu sheet, decor placement, skeletons, error, offline and toast patterns.
- The screens listed above, each with layout, states, copy, data, interactions and accessibility notes.
- The contest banner card shared by Home and the Contests list.
- Endless scroll on `/contests` and the cursor paging it needs.
- The 12 curated text keys, their defaults, limits, storage and wire, including what the preview render document carries.
- Accessibility and performance budgets for these screens.

**Not in scope:**
- Grid size, a free square, or any game mechanic not listed in [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md).
- The contest-flow internals: board builder, pick sheet, ladder, live board, prize popup, standings, results. See [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md). This spec only places them in navigation.
- A Trivia engine. Trivia gets a temporary card and nothing else.
- Terms and Privacy text. It waits on Nick. This spec defines the pages that render it and nothing that stands in for it.
- The `/preview` route's message protocol and fixtures. See the unified preview contract (`overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md`) and [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md). This spec settles only the curated-text part of the render document.
- The admin screens that edit the curated text (Brand v2 › Words, Fields & Opt-ins › Screen text). S1 designs those.

---

## Principles

Five principles sit above the numbered rules. A screen can satisfy every rule and still violate one of these.

**Prime Time, made for fans.** A pre-game broadcast package: steel-navy ground (or its light twin), one hot accent, condensed uppercase display type, tight radii, hairline-outlined cards with no shadows, one angled band per screen, glow on hits. On top of that sits the decoration Arthur asked for: splash art, bands, stripes and grid fragments that recolour from the tenant palette and flip with light and dark. Display type is the pairing's display face at weight 600–700 and leading 0.9–1.0. Body type is never condensed. Numbers use the numeric face with tabular figures. Eyebrows and labels are small, uppercase and tracked 0.08–0.14em.

**Honesty by omission (`D-068`).** Never fabricate: no invented scores, counts, prizes, sponsors, legal text or sample data outside the preview. And never narrate a gap: when something cannot be shown honestly it is not shown, and nothing on screen says so. No "coming soon", no "not available yet", no caveat lines, no spec IDs, no vendor names. Every gap is written down in "Recorded gaps" below, which is the only place for it. The one allowed exception is a clearly temporary card for a feature actively being built: the Trivia card (`FAN-36`).

**One band per screen.** Each screen has at most one angled `HeroBand`, and nothing else on that screen skews on the Y axis. Chyron tags skew on X, which the angle budget allows. A screen without a band is a normal state, not a gap.

**Motion is state-driven.** Things move because something changed: a screen arrived, a sheet opened, data loaded, a status went live. Nothing loops for decoration. The only repeating motions are the LIVE pulse (while a game is live) and the skeleton pulse (while loading). Under `prefers-reduced-motion: reduce` every reveal, pulse, slide and scale is off and state changes are instant.

**Mobile first, with the desktop frame.** Portrait phone first, single column, content max 480px. At viewport widths of 900px and up, the `DecorField` fills the whole viewport and the same column sits centred on an opaque ground. Nothing becomes multi-column. Reading pages (Terms, Privacy) widen the column to 640px; the standings list may do the same (flow spec).

---

## Navigation

### Route map

| Route | Screen | Access | Defined in |
|---|---|---|---|
| `/` | Gate (start) | Signed out. Signed in → `/home` | this spec |
| `/sign-in` | Sign in, with its code step | Signed out. Signed in → `next` or `/home` | this spec |
| `/sign-up` | Create account, with its verify step | Signed out. Signed in → `next` or `/home` | this spec |
| `/forgot-password` | Reset password, three steps | Signed out. Signed in → `/home` | this spec |
| (any protected route) | Join gate, rendered in place | Signed in, not a member or blocked | this spec, [`entry-gate.spec.md`](entry-gate.spec.md) |
| `/home` | Home | Member | this spec |
| `/contests` | Contests list | Member | this spec |
| `/contest/:contestId` | Contest detail | Member | this spec |
| `/contest/:contestId/build` | Board builder | Member | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/board/:boardId` | Live board (and its edit mode, prize popup) | Member | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/contest/:contestId/standings` | Standings and results | Member | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/profile` | Profile, including Your boards (`#boards`) | Member | this spec |
| `/terms` | Terms | Anyone | this spec |
| `/privacy` | Privacy | Anyone | this spec |
| `/preview` | Unified preview | Anyone; no session, no API | [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) |
| (overlay, any route) | Paused | Tenant suspended | this spec |

**`FAN-01` — The router has exactly the routes above, plus the redirects below; no other path renders a screen.** A path that matches nothing redirects: signed in → `/home`, signed out → `/`. Both redirects use `replace`.

**`FAN-02` — Signed-in fans land on `/home`, not `/contests`.** `/`, `/sign-in`, `/sign-up` and `/forgot-password` redirect a signed-in fan to `/home` (or to `next`, `FAN-05`). Every post-auth navigation that targets `/contests` today targets `/home` instead.

**`FAN-03` — `/contests` stays, as the full list; `/dashboard` and `/test-sign-in` are removed.** `/dashboard` redirects (`replace`) to `/profile#boards`, so old bookmarks keep working; its content is folded into Profile (`FAN-40`). `/test-sign-in` and `SignInTest.tsx` are deleted from the public router with no redirect; it falls under `FAN-01`.

**`FAN-04` — Terms, Privacy and Preview sit outside the membership guard.** `/terms` and `/privacy` render for anyone, signed in or not, member or not, and during a pause. `/preview` mounts outside `ClerkProvider` and outside the API layer, as its own code-split chunk; it never renders real fan data.

### Deep links and the gate

**`FAN-05` — A deep link survives sign-in, sign-up and the join gate.**
- A signed-out fan opening a protected route is sent to `/?next=<path>` (path plus search, URL-encoded). The Gate forwards `next` to `/sign-up` and `/sign-in`, and both forward it to their code steps. On success the app navigates to `next`, else to `/home`.
- `next` is accepted only when it starts with a single `/`, does not start with `//`, and is not an auth route (`/`, `/sign-in`, `/sign-up`, `/forgot-password`). Anything else is dropped silently and the fan lands on `/home`.
- The join gate renders in place at the requested route (as today in `ProtectedRoute`). When the membership resolves, the requested screen renders at the same URL. The gate never navigates.
- A 401 on any fan API call mid-session sends the fan to `/sign-in?next=<current path>` with the toast "Please sign in again."

### Back behaviour

**`FAN-06` — The top bar's back chevron goes back in history when the previous entry is inside the app, and otherwise replaces the current entry with the screen's parent.** The app records in-app history depth in router state. A fan arriving on a deep link therefore never gets bounced out of the site by the chevron.

| Screen | Top bar left | Parent when there is no in-app history |
|---|---|---|
| `/sign-in`, `/sign-up`, `/forgot-password` | Back chevron | `/` |
| Code step (sign-in, sign-up, reset) | Back chevron | The same route's first step (email form), in place |
| `/home` | Logo | none (top level) |
| `/contests` | Logo | none (top level) |
| `/profile` | Logo | none (top level) |
| `/contest/:id` | Back chevron | `/contests` |
| `/contest/:id/build` | Back chevron (flow spec) | `/contest/:id` |
| `/board/:id` | Back chevron (flow spec) | `/home` |
| `/contest/:id/standings` | Back chevron (flow spec) | `/contest/:id` |
| `/terms`, `/privacy` | Back chevron | `/home` when signed in, `/` when signed out |

**`FAN-07` — Sheets and dialogs are history entries.** Opening the menu sheet, or any bottom sheet or confirm dialog, pushes a history state. The browser or hardware back button closes it instead of leaving the screen. Closing it by other means pops that state. The logo in the top bar is a link to `/home`.

**`FAN-08` — Scroll position is restored on back.** Returning to Home, `/contests` or `/profile` from a screen opened from it restores that list's loaded pages and scroll offset from the query cache; it does not refetch from the first page unless the cache has expired (5 minutes).

---

## Shell

### Top bar

**`FAN-09` — Every app screen (Home, Contests, Contest detail, Profile, Terms, Privacy) has one top bar; the Gate, auth screens, join gate and Paused have none.** Auth screens show a back chevron alone, top-left, 44×44.

- Height 56px plus the top safe-area inset. Sticky. Background `--ground`. A 1px hairline (`--border` at the theme's outline strength) appears under it once the page has scrolled.
- Left: back chevron or logo per `FAN-06`. The logo is the tenant logo at 28px height; with no logo, the tenant name in the display face at 18px.
- Title: the screen title in the display face, 20px, one line, truncated with an ellipsis. On screens with a band, the title slot is empty until the band scrolls out of view, then shows the band's text (fades in over 150ms).
- Right: the menu button, 44×44, icon only, accessible name "Open menu".
- The screen's `h1` is the band's text when there is a band, otherwise the top bar title. Home's `h1` is visually hidden: "{Tenant} Bingo".

| Screen | Top bar title |
|---|---|
| Home | none (logo only) |
| Contests | "Contests" |
| Contest detail | contest name, after the band scrolls away |
| Profile | "Profile" |
| Terms | "Terms" |
| Privacy | "Privacy" |

### Menu sheet

**`FAN-10` — The menu is a right-hand sheet with, in order: Home, Contests, Your boards, Profile, a separator, Terms, Privacy, and Sign out at the foot.** Terms and Privacy each appear only when their document exists (`FAN-42`). When neither exists, the separator is omitted too.

- Width 288px, max 80vw. Slides in over 250ms (instant under reduced motion). On desktop it anchors to the viewport's right edge.
- Header: tenant logo (32px) or nothing, "{Tenant} Bingo" in the display face, then the fan's display name (body, 15px) and email (13px, secondary text).
- Items are 48px rows with a 20px icon and a 16px label. The current route's item carries `aria-current="page"` and a 3px Team bar on its left edge.
- Sign out shows "Signing out..." and is disabled while the sign-out runs. The existing logout choreography (hold, fade, land on `/`) stays, and its transition text changes from "Logging out..." to "Signing out...".

| Item | Label | Goes to |
|---|---|---|
| Home | "Home" | `/home` |
| Contests | "Contests" | `/contests` |
| Your boards | "Your boards" | `/profile#boards` |
| Profile | "Profile" | `/profile` |
| Terms | "Terms" | `/terms` |
| Privacy | "Privacy" | `/privacy` |
| Sign out | "Sign out" / "Signing out..." | signs out, lands on `/` |

Visually hidden sheet title "Menu" and description "Navigation and sign out". No "Parlays hit" wording appears in the menu or anywhere else in the app.

### Decor placement

**`FAN-11` — Each screen uses the decor kit exactly as this table says, driven by the theme's `decor` block.** `decor.field: "none"` removes every `DecorField`, including the desktop frame (which then shows plain `--ground`). `decor.band: "none"` removes every band; the band's text then renders unskewed on plain ground in the same place and size. `decor.band` picks single or double for the Gate only; every other band in the app is single. `decor.intensity` scales every piece's alpha and size (0 hides all decoration). All decoration is `aria-hidden="true"`, never focusable, and never sits behind body text at more than 0.12 alpha: text blocks sit on opaque `--surface` cards or on `--ground` outside the field's strokes.

| Screen | `DecorField` | Band | Other kit pieces |
|---|---|---|---|
| Gate `/` | `full` | `HeroBand`, variant from `decor.band` (Prime Time: double) | `Scorebug` (next game) |
| Sign in, Sign up, code steps, Reset password | `corner` | none | none |
| Join gate (join and returning) | `corner` | `HeroBand` single | `Chyron` (REQUIRED, OPTIONAL, NEW, UPDATED) |
| Home | none; `corner` in the empty state | none | `Scorebug` and `Brackets` (LIVE NOW card), `Chyron`, `Stripes` (banner cards), `GradientRule` (section dividers) |
| Contests list | none; `corner` in the no-results state | none | `Stripes`, `Chyron` |
| Contest detail | none | `HeroBand` single | `Chyron`, `Scorebug` (game rows), `Track` (vertical variant, prize ladder), `GradientRule` |
| Profile | none | `HeroBand` single, compact (72px) | `Chyron` (consents, board status), `Stripes` (Your boards heading marker) |
| Terms, Privacy | none | none | `GradientRule` under the title |
| Paused | `full` at intensity 0.3 | none | none |
| Desktop frame (viewport ≥ 900px), every screen | `full` behind the column | per screen | per screen |

`GridTexture` applies as the body texture on every app screen when `surface.texture` is `"bingoGrid"`, except Terms and Privacy, which are reading pages. The Gate and Paused already use `full`, so on desktop the frame and the screen's own field are the same single field.

### Loading, errors, offline, toasts

**`FAN-12` — Loading shows skeletons shaped like the content, never a spinner and never the word "Loading".** Skeleton blocks are `--surface-raised` with the theme's control radius, pulsing opacity 1.0→0.6 over 1.2s (static under reduced motion). They appear only after 150ms, so fast loads never flash. The membership guard's "Loading..." text is replaced by the shell skeleton (top bar plus three card blocks).

**`FAN-13` — One error pattern for a screen or section that failed to load.** A hairline card with the text "We couldn't load this. Pull to refresh or try again." and a secondary "Retry" button (44px). On devices without touch (`(hover: hover) and (pointer: fine)`), the text is "We couldn't load this. Try again.", because a mouse cannot pull. A failed primary read replaces the screen body; a failed section read (a Home section) replaces only that section.

**`FAN-14` — Pull to refresh on Home, Contests, Contest detail and Profile, touch only.** Pulling past 64px refetches the screen's reads; the list resets to its first page. The scroll container sets `overscroll-behavior-y: contain` so the browser's own pull-to-reload does not fire as well.

**`FAN-15` — Write failures are inline, in plain words.** A write that cannot reach the server shows, under the control that sent it: "We couldn't reach the server. Check your connection and try again." Any other unexpected failure: "Something went wrong. Try again." Server refusals with a known code use the copy defined for that code (`FAN-37`). No error shows a status code, an error code, or a vendor name.

**`FAN-16` — Offline banner.** When `navigator.onLine` is false, a banner sits under the top bar (or at the top of screens without one): "You're offline. We'll catch up when you're back." It uses `role="status"`, raised surface, a 2px Accent top edge. It disappears when the browser is back online, and every active query refetches then. Writes attempted while offline fail with the `FAN-15` network string; nothing is queued.

**`FAN-17` — Toasts confirm; they never carry an error the fan must act on.** One visible at a time, top-centre below the top bar, 4 seconds, polite live region. The complete list:

| Trigger | Toast |
|---|---|
| Sign-in code sent | "Code sent to {email}." |
| Code resent (any code step) | "New code sent." |
| Password reset complete and signed in | "Password updated. You're signed in." |
| Display name or profile field saved | "Saved." |
| Optional consent changed on Profile | "Updated." |
| Join refused because a board exists (`FAN-37`) | "You already have a board in this contest." |
| Session expired mid-session (`FAN-05`) | "Please sign in again." |

The flow spec adds its own toasts (for example the builder's "You're in") under the same rule.

**`FAN-18` — Status chyrons are derived one way everywhere.** The banner card, the contest detail header and the Your boards rows use this table. Chyron text is written in the DOM as words ("Opens Sun 10:00 AM") and uppercased by CSS only, so screen readers read words, not letters.

| Condition (first match wins) | Chyron | Variant |
|---|---|---|
| `gameType` is `trivia` | TRIVIA | `neutral` |
| Contest finalized | FINAL | `neutral` |
| Fan has a board here and any of the contest's games is in progress | LIVE | `live` |
| Status Open (a game is joinable) | OPEN | `team` |
| Any game in progress | LIVE | `live` |
| Status Upcoming | OPENS {when} | `accent` |
| Otherwise (Closed) | CLOSED | `neutral` |

A contest where the fan has a board also shows a second chyron, JOINED (`success`), after the status chyron.

Time formats, all in the fan's own time zone:
- `{when}` and every "Sun 10:00 AM" style date: weekday (short) plus time (`h:mm AM`) when within 6 days; otherwise "Oct 4, 10:00 AM".
- Scorebug detail line: "Tip 7:30 PM" today, "Tip Sun 7:30 PM" within 6 days, "Tip Oct 4, 7:30 PM" beyond; "Live" while in progress; "Final" when final (uppercased by CSS).
- Calendar dates (consents, legal documents): "Sep 24, 2026".

---

## Screens

### Gate (`/`)

**Layout, top to bottom** (full height, content column; the CTA group is anchored to the bottom so late-arriving blocks never move it):
1. `DecorField` full, behind everything, with its soft Team glow at the top.
2. Tenant logo, max 96px tall. With no logo the slot is omitted and the band's text is the mark.
3. `HeroBand` (variant from `decor.band`) with "{Tenant} Bingo" in the display face, 40px.
4. Tagline: curated `startTagline`, body 17px, secondary text.
5. `Scorebug` for the tenant's next game, when one exists: LIVE chyron on the left while in progress, "{Away} @ {Home}" condensed uppercase with both logos, tracked mono detail line (`FAN-18`).
6. "Presented by" credit when a sponsor holds the sign-in placement at the featured game: eyebrow "Presented by", the sponsor's sign-in logo (or its name when there is no logo), and its sign-in tagline when set. Links out to the sponsor's link when set.
7. Primary CTA: curated `startCta`, full width, 48px (may wrap to two lines; the button grows). Goes to `/sign-up` (forwarding `next`).
8. Text link "Already playing? Sign in", goes to `/sign-in` (forwarding `next`).
9. Footer: eyebrow "Powered by" over the Overboard wordmark (the dark or light mark by `theme.mode`).

**States:**
- Organization loading: `--ground` only (no text, no skeleton) for up to 1.5s, then the shell skeleton. G2's no-flash fix guarantees the ground is already the tenant's mode.
- Organization read failed: the `FAN-13` pattern, full screen, on the platform default theme.
- Sponsor schedule loading: the "Presented by" block holds its space invisibly (as today); the scorebug is absent until the read answers, then fades in over 300ms.
- Sponsor schedule failed, or no next game: no scorebug. No sign-in placement: no "Presented by". Neither is mentioned.
- Suspended: the Paused screen replaces the Gate (`FAN-45`).

**Copy:**

| Element | Copy (default) | Curated key |
|---|---|---|
| Band | "{Tenant} Bingo" | none (tenant name comes from the API) |
| Tagline | "Pick your players. Win prizes." | `startTagline` |
| Scorebug | "{Away} @ {Home}", detail per `FAN-18` | none |
| Sponsor eyebrow | "Presented by" | none |
| CTA | "Continue with email" | `startCta` |
| Sign-in link | "Already playing? Sign in" | none |
| Footer eyebrow | "Powered by" | none |

**Data:** `GET /b2b/org/:slug` → `organization.name`, `organization.branding.theme`, `organization.branding.logo`, `organization.branding.text` (**NEW**), `suspended`. `GET /b2b/org/:slug/sponsors` → `nextGame` (`eventTime`, `homeTeam`, `awayTeam` with `name` and `logoUrl`), `featured`, `sponsors`, `placements` (sign-in slot). Game status for the scorebug's LIVE state: `nextGame.status` (**NEW**; today the wire carries only the time).

**Accessibility:** the band text is the `h1`. The scorebug is one text group read as "{Away} at {Home}, tip Sunday 7:30 PM". Team logos have empty `alt` because the names are adjacent. The sponsor logo's `alt` is the sponsor name.

**`FAN-19` — The Gate's primary CTA starts account creation and the secondary link starts sign-in.** Today's single CTA goes to sign-in; a new fan should not have to find sign-up from there.

**`FAN-20` — The Gate never shows a game that is not the tenant's real next game, and never a past one.** The server picks it (the game under way, else the soonest to come). No game, no scorebug.

### Sign in, Sign up, Verify, Reset password

All four share one layout: back chevron top-left; `DecorField` corner; a hairline card (`--surface`, radius from the theme's card radius, 24px padding) holding the heading, one supporting line, the form, the CTA and links. Field errors sit under their field, replacing its caption, with `aria-describedby` and `aria-invalid`. The form-level error sits above the CTA with `role="alert"`.

**Sign in (`/sign-in`):**

| Element | Copy |
|---|---|
| Heading | "Welcome back" |
| Supporting line | "Sign in to keep playing." |
| Email label / placeholder | "Email" / "you@example.com" |
| Password label / placeholder | "Password" / "Your password" |
| Show/hide toggle (accessible name) | "Show password" / "Hide password" |
| Forgot link (under the password field, right-aligned) | "Forgot password?" → `/forgot-password` |
| CTA / busy | "Sign in" / "Signing in..." |
| Footer link | "New here? Create an account" → `/sign-up` |

**Sign up (`/sign-up`):**

| Element | Copy |
|---|---|
| Heading | "Create your account" |
| Supporting line | "Use your email to get started." |
| Email label / placeholder | "Email" / "you@example.com" |
| Password label / placeholder / caption | "Password" / "Choose a password" / "At least 8 characters." |
| CTA / busy | "Create account" / "Creating account..." |
| Footer link | "Already have an account? Sign in" → `/sign-in` |

**Verify (the code step of sign-up, of a sign-in second factor, and of reset):**

| Element | Copy |
|---|---|
| Heading | "Check your email" |
| Supporting line | "We sent a 6-digit code to {email}." |
| Code boxes (accessible names) | "Digit 1 of 6" … "Digit 6 of 6"; group label "Verification code" |
| CTA / busy | "Verify" / "Verifying..." |
| Resend, counting down / ready | "Resend code in 0:30" (disabled) / "Resend code" |
| Link | "Use a different email" → back to the first step |

**Reset password (`/forgot-password`):**

| Step | Element | Copy |
|---|---|---|
| 1 | Heading / supporting line | "Reset your password" / "Enter your email and we'll send you a code." |
| 1 | Email label / placeholder | "Email" / "you@example.com" |
| 1 | CTA / busy | "Send code" / "Sending..." |
| 2 | The Verify step above | as above |
| 3 | Heading / supporting line | "Choose a new password" / "At least 8 characters." |
| 3 | Label / placeholder | "New password" / "New password" |
| 3 | CTA / busy | "Update password" / "Updating..." |

**Error copy (all four screens):**

| Condition | Copy |
|---|---|
| Email empty or malformed (client) | "Enter a valid email address." |
| Password empty (client) | "Enter your password." |
| Password under 8 characters (client, sign-up and reset) | "Use at least 8 characters." |
| Wrong email or password, or no such account (sign-in) | "That email and password don't match." |
| Account already exists (sign-up) | "There's already an account with this email." plus the link "Sign in instead" |
| Password found in a breach list (sign-up and reset) | "This password has shown up in a data breach. Choose a different one." |
| No account for this email (reset, step 1) | "We couldn't find an account with that email." |
| Wrong code | "That code isn't right. Check it and try again." |
| Expired code | "That code has expired. Tap Resend code for a new one." |
| Too many attempts | "Too many tries. Wait a minute and try again." |
| Password updated but session not started (reset) | "Password updated. Sign in to continue." then `/sign-in` |
| Network failure | "We couldn't reach the server. Check your connection and try again." |
| Anything else | "Something went wrong. Try again." |

**`FAN-21` — Sign in restores the "Forgot password?" link.** The route exists and works; the link is commented out today.

**`FAN-22` — Sign-up has no consent checkbox in this design.** Consent lives on the join gate, where the locked Overboard Terms & Privacy opt-in is. If G2 wires the checkbox instead of removing it, it sits directly above the CTA as a consent card in the gate's style (hairline card, REQUIRED chyron) and takes its text from that same locked opt-in record; this spec adds no wording for it.

**`FAN-23` — The code entry is six boxes with auto-advance and paste.** `inputmode="numeric"`, `autocomplete="one-time-code"` on the first box. Typing a digit moves focus to the next box; Backspace in an empty box moves back and clears it. Pasting (or an OS one-time-code fill) of 6 digits fills all boxes. The step submits itself when the sixth digit lands; the Verify button stays for fans who prefer it. Non-digits are ignored.

**`FAN-24` — "Resend code" unlocks 30 seconds after a code is sent.** The countdown text updates each second. Resending restarts the 30 seconds and shows the "New code sent." toast.

**`FAN-25` — Successful sign-in, verification or reset lands on `next` or `/home`,** and the join gate takes over in place if the fan is not yet a member (`FAN-05`).

**Data:** Clerk only (sign in, sign up, second factor, reset). No Overboard API call on these screens beyond the organization read for theming.

**Accessibility:** one `h1` (the heading). Inputs have visible labels. Error text is linked by `aria-describedby`; focus moves to the first invalid field on submit. The password toggle is a 44×44 button with a pressed state.

### Join gate (join and returning)

The existing shared `EntryGateForm`, restyled. Its behaviour, validation, submission and copy source (`obs-b2b-shared/src/entry-gate/copy.ts`) are unchanged; [`entry-gate.spec.md`](entry-gate.spec.md) governs everything but the look.

**Layout, top to bottom:** `DecorField` corner; `HeroBand` single carrying the heading ("Join {Team}" by default, uppercase by the display transform); subtitle; identity line; display name field; the tenant's fields in order; consents heading; consent cards; error summary when present; CTA with its helper line; footer links.

- Fields use the gate's own components, restyled: 8px control radius, hairline border, 48px inputs, caption and error slot under the input.
- Consent cards are hairline `--surface` cards with the consent text verbatim and a `Chyron` for REQUIRED (`team`) or OPTIONAL (`neutral`); in returning mode, NEW and UPDATED (`accent`) sit beside it. An unmet blocking consent after submit gets a Live-coloured 2px border and its error line (existing behaviour, new colours).
- The locked Overboard Terms & Privacy opt-in is shown like any other required consent, with its text from the opt-in record. Nothing is added to it.

**Copy** (all from `copy.ts`; seven are overridable per `FAN-48`):

| Element | Default | Curated key |
|---|---|---|
| Heading (join) | "Join {Team}" | `joinHeading` |
| Subtitle (join) | "You're already signed in — one quick step before you can play here." | `joinSubtitle` |
| Identity line | "Signed in as {email}" · "Not you? Sign out" | none |
| Display name label / placeholder | "Display name" / "Shown on standings and your board" | none |
| Consents heading (join) | "{Team} consents" | `consentsHeading` |
| Chips | "REQUIRED", "OPTIONAL", "NEW", "UPDATED" | none |
| CTA (join) / busy | "Join {Team}" / "Joining..." | `joinCta` |
| Heading (returning) | "Welcome back" | `returningHeading` |
| Subtitle (returning) | "{Team} has {what changed} since your last visit. Review below to keep playing.", or "A couple of things need your attention before you can keep playing." when nothing countable changed | `returningSubtitle` |
| Section headings (returning) | "Profile update needed"; "Outstanding consents" (with " — all required" when every one blocks) | none |
| CTA (returning) / busy | "Accept & Continue" (consents only) or "Save & Continue" (fields) / "Saving..." | none |
| Helper under a disabled CTA | "Enabled once the items above are complete." / "Enabled once every item above is checked." / "Enabled once the required fields above are filled in." | none |
| Error summary | "Please complete the highlighted items below to join." / "…to continue." | none |
| Field and consent errors | "Display name is required." / "{Label} is required." / "Accepting this is required to play at {Team}." / "Accepting this is required to keep playing." | none |
| Stale-wording notice | "{Team} updated the wording of an agreement while you had this page open. Please review the new text below and confirm again." | none |
| Footer | "Not now — sign me out"; then the footer note "Wrong team? You'll stay signed in — just head to the right site." | `footerNote` (the note only) |

**States:** membership loading → the join gate skeleton (band block, three field blocks, two card blocks); submit in flight → CTA busy text, fields read-only; 409 stale wording → the stale notice (existing); membership read failed → heading "We couldn't confirm your access." and the `FAN-13` card, fail closed (existing rule).

**Data:** `GET /b2b/membership` (`member`, `pendingConsents`, `signupFields`, `pendingFields`, `gateCopy`), `POST /b2b/join`, `POST /b2b/consent`, `PATCH /b2b/membership`. All exist.

**`FAN-26` — The join gate never navigates on success.** The membership refetch re-renders the guarded route in place (existing rule), which is what keeps deep links alive.

**`FAN-27` — The gate's restyle changes one gate string and no other.** The display-name placeholder changes in `copy.ts` from "Shown on your board" to "Shown on standings and your board", because the display name is the fan's public name on standings (`fan-contest-flow.spec.md`, Standings). Copy stays in `copy.ts`, shared with the console's Fields & Opt-ins preview, so the two cannot drift.

### Home (`/home`)

The hub a member lands on. It answers, in order: is anything of mine live, what can I join, where are my boards, what's next.

**Layout, top to bottom:**
1. Top bar (logo, menu).
2. Greeting eyebrow "Game day · {displayName}" (uppercase by CSS), 12px tracked, secondary text. Not a headline.
3. **LIVE NOW** (section eyebrow "Live now"), only when the fan has a board in a contest with a game in progress. One card per such board, most recently started game first. The card: `Brackets` in Accent at its corners; a `Scorebug` for the in-progress game (the first in progress when several); the contest name in the display face; "{n} bingos" as a large tabular numeral with the label "Bingos" ("1 bingo" singular); a primary button "Open board" → `/board/:boardId`.
4. `GradientRule`.
5. **Open to join** (eyebrow "Open to join"): up to 5 banner cards (`FAN-30`) for Open contests where the fan has no board. When more than 5 exist, a text link "See all contests" → `/contests?status=open`. Omitted when there are none.
6. **Your boards** (eyebrow "Your boards", with the `Stripes` rail marker): a horizontal rail of board tiles, 148px wide. Each tile: a mini 3×3 grid (hit squares filled Team, others hairline), "{n} bingos", the status chyron (`FAN-18`), the contest name (two lines, clamped). Tap → `/board/:boardId`. Order: live first, then open, then most recently created. The rail loads more tiles as it nears its right end (`FAN-34`). Omitted when the fan has no boards.
7. **Coming up** (eyebrow "Coming up"): up to 5 compact rows for Upcoming contests: contest name (display face, one line), "Opens Sun 10:00 AM", chevron; tap → `/contest/:id`. When more than 5 exist, "See all" → `/contests?status=upcoming`. Omitted when there are none.
8. **Presented by** band: when a sponsor holds the sign-in placement at the featured game, the same credit as the Gate (eyebrow "Presented by", logo or name, tagline), on a raised surface. Omitted otherwise.

**Empty state** (sections 3, 5, 6 and 7 all empty): `DecorField` corner, heading "Nothing on the schedule yet" (display face, 28px), body curated `homeEmpty`, then the Presented by band if any. Past contests remain reachable through the menu's Contests.

**States:** loading → the eyebrow renders at once (display name is already known from the membership), each section shows its own skeleton (one scorebug card, two banner cards, three rail tiles); each section loads and fails independently, a failed section shows the `FAN-13` card in its place; pull to refresh refetches all sections.

**Copy:**

| Element | Copy (default) | Curated key |
|---|---|---|
| Greeting eyebrow | "Game day · {displayName}" | none |
| Section eyebrows | "Live now", "Open to join", "Your boards", "Coming up" | none |
| LIVE NOW counter | "{n} bingos" / "1 bingo" | none |
| LIVE NOW button | "Open board" | none |
| See-all links | "See all contests", "See all" | none |
| Coming up row | "Opens {when}" | none |
| Empty heading | "Nothing on the schedule yet" | none |
| Empty body | "Check back soon for the next contest." | `homeEmpty` |
| Sponsor eyebrow | "Presented by" | none |

**Data:**
- `GET /b2b/membership` → `membership.displayName`.
- `GET /b2b/board/my-boards` with `cursor`, `limit` (**NEW** paging) → per board (**NEW** projection): `boardId`, `contestId`, `contestName`, `status` (the `FAN-18` inputs: `contestStatus`, `finalized`, `gameType`), `live` (any game in progress), `liveGame` (`homeTeam`, `awayTeam`, `eventTime`, `status`), `bingos` (today `parlaysHit`, renamed on the wire only), `cells` (9 entries, each `hit | miss | pending | empty`), `createdAt`; plus `nextCursor`, `total`. Today the endpoint returns every board with its contest and nine fully populated props, which is far more than Home needs and pages nothing.
- `GET /b2b/contest/list-contests?status[]=open&joined=false&limit=5` and `?status[]=upcoming&limit=5` (**NEW** params, `FAN-35`) → banner card fields and `total`.
- `GET /b2b/org/:slug/sponsors` → sign-in placement at `featured`.

**Accessibility:** each section is a `section` with an `h2` (the eyebrow text, visually styled as an eyebrow). The rail is a `list` with horizontal scroll, reachable by keyboard; each tile is a link named "{Contest name}, {n} bingos, {status}". The LIVE NOW card's numeral is announced with its label.

**`FAN-28` — Home shows only sections that have content, and never says a section is empty.** The single empty state appears only when all four content sections are empty.

**`FAN-29` — Home is the post-auth landing and the logo's target.** `/contests` is the full, searchable list; Home is not a list and does not page (except the Your boards rail).

### Contest banner card (shared by Home and Contests)

**`FAN-30` — One banner card component for every contest listing.** Anatomy, top to bottom, inside a hairline `--surface` card (radius from the theme's card radius, 16px padding):

| Part | Content | When |
|---|---|---|
| Corner tag | `Stripes` (Team, Second, Accent), top-right, clipped by the card radius | always |
| Chyron row | status chyron per `FAN-18`, then JOINED when the fan has a board | always |
| Title | contest name, display face, 24px, max two lines, ellipsis | always |
| Games | up to 2 rows: away logo, "{Away} @ {Home}", home logo, a date pill ("Sun 10:00 AM" or "Live" or "Final"). A missing logo shows a 24px disc with the team's initials. Past two games, a third line "+{n} more" | when the contest has games |
| Prize line | gift icon + the name of the tier with the most bingos | when the contest has prize tiers |
| Meta line | "{n} playing" · "Provided by {sponsor}" (the top tier's sponsor) | each part only when present on the wire; the line is omitted when both are absent |
| Action | button "Open my board" → `/board/:boardId` | only when the fan has a board here |

- The whole card links to `/contest/:id`. The link is the title (stretched over the card); the "Open my board" button sits above the stretched area as its own control, so there are no nested interactive elements.
- Press feedback: scale 0.98 over 100ms (none under reduced motion).
- A Trivia contest's card shows the TRIVIA chyron, name, games and prize line, no "{n} playing" and no action button.

**`FAN-31` — The card never shows a count, a sponsor or a prize it did not get from the wire.** No "0 playing" placeholder, no sponsor inferred from placements, no "Prizes TBA".

**Copy:** "{n} playing" (1 → "1 playing"), "Provided by {sponsor}", "+{n} more", "Open my board". Chyron text per `FAN-18`.

**Data** (per list item): `_id`, `contestName`, `gameType`, status inputs (`contestStatus.status`, `finalized`, `opensAt` **NEW**, `live` **NEW**), `allowedBetEvents` (`homeTeam`, `awayTeam` with `name`, `logoUrl`; `eventTime`; `status`), top tier (`prizeName`, `threeInARows`, `providedBy` **NEW**: `{ name, logoUrl }`), `playerCount` (**NEW**), `myBoardId` (**NEW**, null when none).

**Accessibility:** the card is an `article` whose accessible name is the title. Chyrons are text. The date pill is text.

### Contests list (`/contests`)

**Layout, top to bottom:**
1. Top bar, title "Contests".
2. Search field, full width, 48px, leading search icon, placeholder "Search contests", clear button (accessible name "Clear search") when not empty. Sticky under the top bar together with the chips.
3. Filter chips, one row, horizontally scrollable: "Open", "Upcoming", "Live", "Past". Multi-select toggles (chip radius 3px; active chip filled Team with on-Team text; inactive hairline). None selected means all contests.
4. Total count, 13px secondary: "{n} contests" / "1 contest".
5. Banner cards (`FAN-30`), 12px apart, loading more as the fan nears the end (`FAN-32`).

Default order (server-side, `FAN-35`): live, then open (soonest-closing first), then upcoming (soonest-opening first), then past (most recent first).

**States:**
- First load: 3 skeleton cards; the count line is a skeleton bar.
- Loading more: 2 skeleton cards after the last card.
- No contests at all (no search, no filters): the Home empty treatment: `DecorField` corner, "Nothing on the schedule yet", curated `homeEmpty`.
- No results for a search or filter: `DecorField` corner, "Nothing matches." and a secondary button "Clear search and filters".
- First page failed: the `FAN-13` card in place of the list. A later page failed: under the last card, the line "We couldn't load more contests." and a "Retry" button; auto-loading stops until Retry.
- Arriving with `?status=open` (or `upcoming`) from Home pre-selects that chip.

**Copy:**

| Element | Copy |
|---|---|
| Title | "Contests" |
| Search placeholder | "Search contests" |
| Clear button (accessible name) | "Clear search" |
| Chips | "Open", "Upcoming", "Live", "Past" |
| Count | "{n} contests" / "1 contest" |
| No results | "Nothing matches." / button "Clear search and filters" |
| Page failure | "We couldn't load more contests." / "Retry" |
| Empty (no contests) | "Nothing on the schedule yet" / `homeEmpty` |

**`FAN-32` — `/contests` uses endless scroll backed by server cursor paging (Arthur's list ruling).** There is no "load more" button. A sentinel 600px above the end of the list triggers the next page; only one page request is in flight at a time; pages are 20 items. The total count reflects the current search and filters. The list is not loaded whole and sliced.

**`FAN-33` — Search and filters reset paging.** Typing is debounced 300ms; a new query or chip change discards loaded pages and requests the first page. Searching matches the contest name and the team names of its games, case-insensitively. Search text and chips are kept in the URL (`?q=&status=`) so back navigation and shared links restore them.

**`FAN-34` — Every fan list that can grow uses the same endless-scroll behaviour:** `/contests`, the Your boards rail on Home (horizontal), the Your boards list on Profile, and the standings list (flow spec). Each is backed by `cursor` / `limit` / `nextCursor` / `total`.

**`FAN-35` — Data need: `GET /b2b/contest/list-contests` gains server cursor paging, search and status filters (NEW).**
- Query: `cursor` (opaque string, absent for the first page), `limit` (1–50, default 20), `q` (trimmed, max 80 characters), `status[]` (any of `open`, `upcoming`, `live`, `past`; OR-ed; absent means all), `joined` (`true` / `false`; absent means both).
- Response: `contests` (the banner card projection, `FAN-30`), `nextCursor` (null at the end), `total` (count for this query).
- Status meanings: `open` = derived status Open; `upcoming` = Upcoming; `live` = any game in progress and not finalized; `past` = Closed or Finished. A contest can match more than one.
- Order per the Contests list layout, stable across pages (ties broken by `_id`).
- The existing `status=upcoming|past` parameter keeps working until the old list is gone. The endless-scroll system (shared list component and the backend cursor convention) is G1's this wave; this endpoint follows that convention.

**Accessibility:** the list is `role="feed"` with `aria-busy="true"` while a page loads; each card has `aria-setsize` = total and `aria-posinset`. A visually hidden polite region announces "Loaded {n} more contests." after each page. Chips are toggle buttons (`aria-pressed`). The search field has a visible label for screen readers ("Search contests") and `type="search"`. Focus stays where it was when more cards load.

### Contest detail (`/contest/:contestId`)

**Layout, top to bottom:**
1. Top bar (back chevron, menu; the title shows the contest name once the band scrolls away).
2. `HeroBand` single with the contest name (display face, 32px, max three lines). This is the `h1`.
3. Chyron row: status chyron (`FAN-18`) and JOINED when the fan has a board.
4. Timing line (body 15px): see the table below. Omitted for Closed and Final.
5. Counts line: "{n} playing · {m} spots left", each part only when its count is on the wire and, for spots, only when the contest has a player limit. "1 spot left" singular. Omitted when neither part is present.
6. Description: the contest's Description, rendered as plain paragraphs (split on blank lines; single line breaks kept; no markdown, no links). Omitted when empty.
7. `GradientRule`, eyebrow "Games": one `Scorebug` row per game in the contest, in tip-off order: LIVE chyron on the left while in progress, "{Away} @ {Home}" with logos, detail line per `FAN-18`.
8. `GradientRule`, eyebrow "Prizes": the prize ladder, a vertical `Track`. One stop per tier, lowest bingos at the top. Each stop: a chyron with the tier's bingo count ("1 bingo", "3 bingos"), the prize name (display face, 20px), a 56px image thumbnail when the tier has an image, and "Provided by" with the sponsor's logo (or name) when the tier names a sponsor. Tapping a stop expands the prize description (plain paragraphs) below it; tapping again collapses it. Omitted when the contest has no tiers.
9. `GradientRule`, eyebrow "How to play": three lines, each with a numeral in the numeric face: "Fill your 3x3 board with player lines." / "A line hits when the player reaches it." / "Three in a row is a bingo. Bingos win prizes."
10. Text link "See standings" → `/contest/:id/standings`, when the contest is live or final and has at least one board.
11. Primary CTA in a sticky bottom bar (`--ground` with a hairline top edge, plus the bottom safe-area inset). A refusal notice (`FAN-37`) sits directly above the CTA when present.

**Timing line:**

| State | Line |
|---|---|
| One game, not yet tipped off | "Board changes close at tip-off, {when}." |
| Several games, first not yet tipped off | "Each square locks when its game tips off. First tip-off {when}." |
| Several games, some in progress, some to come | "Each square locks when its game tips off. Next tip-off {when}." |
| Upcoming | "Opens {when}." |
| All games in progress | "Board changes are closed." |

**Primary CTA:**

| State (first match wins) | CTA | Enabled | Goes to |
|---|---|---|---|
| Trivia | no CTA (the Trivia card replaces sections 7–11) | — | — |
| Fan has a board | "Open my board" | yes | `/board/:myBoardId` |
| Open, player limit reached | "Contest full" | no | — |
| Open | "Build my board" | yes | `/contest/:id/build` |
| Upcoming | "Opens in {n} days" / "Opens in {n} hours" / "Opens in {n} min" ("1 day", "1 hour") | no | — |
| Anything else (Closed, Final, or live and no longer joinable) | "Closed" | no | — |

`{n}` is computed from `opensAt`: under 60 minutes → minutes; under 48 hours → hours (rounded up); otherwise days (rounded up).

**`FAN-36` — A Trivia contest's page shows its banner and description and, in place of the games, prizes, rules and CTA, one temporary card.** The card is a hairline `--surface` card with the TRIVIA chyron and the text "Trivia is on its way. This contest opens when it's ready." There is no join button, no counts line, no timing line. This is the one placeholder `D-068` allows (Arthur's clarification: a clearly temporary card for a feature being built).

**`FAN-37` — Server refusals are shown by reason, keyed on a machine code, never on the message text.**

| Code (**NEW** on the wire) | What the fan sees |
|---|---|
| `contest_not_open` | Notice above the CTA: "This contest isn't open for new players right now." The page refetches and the CTA takes its derived state. |
| `contest_full` | Notice: "This contest is full." CTA becomes "Contest full", disabled. |
| `contest_not_playable` | Notice: "This contest can't be played here yet." CTA hidden. |
| `board_exists` (with `boardId`) | No notice: navigate (`replace`) to `/board/:boardId` with the toast "You already have a board in this contest." |
| `contest_not_found` (404) | The not-found state below. |

The notice is a hairline card with a 2px Accent left edge and an info icon, `role="status"`. It stays until the fan leaves the page. Refusals arrive from the board-entry request in the builder (flow spec), which returns the fan to this page with the code, or from any read of this page. Today the server distinguishes these refusals only by message text (`createBoard.ts`, `util/messages.ts`); the codes are a data need.

**States:**
- Loading: band skeleton, a chyron-sized block, three scorebug rows, three ladder stops; CTA bar shows a disabled skeleton button.
- Not found (404, including a hidden contest): no band; `DecorField` corner; heading "We couldn't find this contest"; button "See all contests" → `/contests`.
- Read failed: `FAN-13` card in the body; the CTA bar is hidden.
- A game with no logos: initials discs. A game with no status yet: detail line from its time.

**Copy (not already listed):** section eyebrows "Games", "Prizes", "How to play"; "Provided by"; "See standings"; "{n} playing"; "{m} spots left" / "1 spot left"; the timing, CTA, refusal and Trivia strings above; not-found heading and button.

**Data:** `GET /b2b/contest/:contestId` today returns a subset of the contest (name, description, limits, some D2C-era fields) and each game with its players. The page needs, in one read:
- `contestName`, `contestDescription`, `gameType` (accepting `trivia`, **NEW** in shared `GAME_TYPES`), `maxParticipants`.
- Status inputs: `contestStatus` (**NEW** on this endpoint), `finalized`, `opensAt` (**NEW**: the earliest time any game becomes joinable, honouring `nextPropOpenTime`), `live` (**NEW**).
- Games: `eventTime`, `status`, `homeTeam`, `awayTeam` (name, logoUrl).
- Prize tiers, public projection (**NEW** on this endpoint): `prizeTierId`, `threeInARows`, `prizeName`, `prizeDescription`, `prizeImageUrl`, `providedBy` (`{ name, logoUrl }`, **NEW**, from the tier's "Provided by" sponsor). Never `staticRedemptionCode`, value or handler.
- `playerCount` (**NEW**), `myBoardId` (**NEW**).
- Players per game belong to the builder's read (flow spec) and may move off this endpoint.

**Accessibility:** the band text is the `h1`; each section has an `h2`. Ladder stops are buttons with `aria-expanded`. The sticky CTA bar never covers focused content (scroll padding equals its height). A disabled CTA keeps its text readable at 4.5:1 and is `aria-disabled` with the reason in its label ("Opens in 2 days").

**`FAN-38` — The detail page is the only way into the builder.** Banner cards and Home link to the detail page; nothing links straight to `/contest/:id/build`. A fan with a board goes to the board from the card's "Open my board" or from this page.

### Profile and menu (`/profile`)

**Layout, top to bottom:**
1. Top bar, title "Profile".
2. Compact `HeroBand` single (72px) holding a 64px Team circle with the display name's first letter (on-Team colour, display face), overlapping the band's lower edge.
3. **Display name**: the name in the display face, 28px, with an "Edit" text button. Edit turns it into an input (same validation as the join gate: required, max 200 characters, trimmed) with "Save" and "Cancel". Save → toast "Saved."
4. **Your details** (eyebrow): the tenant's signup fields in the tenant's order, each a row with its label, the fan's value (or "Not set" for an optional empty field) and "Edit". Edit expands the gate's own field component inline with "Save" and "Cancel"; validation is the gate's. Omitted when the tenant has no signup fields.
5. **Consents** (eyebrow): one hairline card per current opt-in: label, text (clamped to three lines with "Show more" / "Show less"), a REQUIRED or OPTIONAL chyron, and "Accepted on {date}" or "Declined on {date}". Optional ones carry a switch (accessible name: the opt-in's label) that records a new decision at the current wording; turning one off asks "Withdraw this consent?" with "Withdraw" and "Keep". The locked Overboard Terms & Privacy opt-in, and any other required one, has no control.
6. **Your boards** (eyebrow, `id="boards"`, `Stripes` marker): rows with the contest name, status chyron (`FAN-18`), "{n} bingos", and an "Open" button → `/board/:boardId`. Endless scroll (`FAN-34`). Empty: "No boards yet." with the button "See contests" → `/contests`.
7. "Sign out" (secondary button, full width) → same as the menu's.

**States:** loading → band, name bar, three rows, two cards, three board rows as skeletons; membership read failed → the guard's fail-closed state; a failed save → the `FAN-15` string under the control, the edit stays open with the fan's input kept; boards read failed → `FAN-13` card in that section only.

**Copy:**

| Element | Copy |
|---|---|
| Title | "Profile" |
| Section eyebrows | "Your details", "Consents", "Your boards" |
| Buttons | "Edit", "Save", "Cancel", "Open", "Sign out" / "Signing out..." |
| Empty field value | "Not set" |
| Consent dates | "Accepted on {date}" / "Declined on {date}" |
| Consent text toggle | "Show more" / "Show less" |
| Withdraw confirm | "Withdraw this consent?" / "Withdraw" / "Keep" |
| Boards counter | "{n} bingos" / "1 bingo" |
| Boards empty | "No boards yet." / "See contests" |
| Display name error | "Display name is required." |

**Data:**
- `GET /b2b/membership` → `membership.displayName`, `membership.profileFields`, `membership.consents` (`optInId`, `decision`, `agreedAt`), `signupFields`. For the Consents list it also needs every current opt-in, not only the pending ones: `optIns` (**NEW**: `optInId`, `label`, `text`, `textVersion`, `blocking`, `locked`).
- `PATCH /b2b/membership` with `profileFields` (exists) and `displayName` (**NEW**).
- `POST /b2b/consent` with a changed decision for a non-blocking opt-in at its current `textVersion` (the server must accept re-deciding an answered optional opt-in; confirm in build, **NEW** if it does not) and must refuse a decline of the locked opt-in (**NEW** rule).
- `GET /b2b/board/my-boards` with paging (**NEW**, as Home).

**`FAN-39` — The menu is the app's one navigation surface.** There is no bottom tab bar. Home, Contests, Your boards and Profile are reachable from the menu on every app screen, and Home from the logo.

**`FAN-40` — Profile absorbs the old `/dashboard`.** Its "My Boards" content lives in Profile's Your boards section, restyled; the words "My Boards", "Settled" and "In Progress" are retired in favour of the `FAN-18` chyrons.

**`FAN-41` — A fan can withdraw an optional consent and cannot withdraw a required one here.** Withdrawal is recorded like any decline (so sponsor exports exclude the fan from then on). The locked Overboard Terms & Privacy consent shows no control at all.

**Accessibility:** the Your boards section is reachable by the `#boards` fragment and receives focus on arrival from the menu. Switches are `role="switch"` with `aria-checked`. Inline edits move focus into the input on "Edit" and back to "Edit" on Save or Cancel.

### Terms and Privacy (`/terms`, `/privacy`)

**Layout:** top bar (back chevron, title "Terms" or "Privacy", menu when signed in). Column widened to 640px. The document's title as `h1` (display face, 32px). Eyebrow "Updated {date}". `GradientRule`. The body, rendered from markdown: body face, 17px, 1.6 leading, headings in the display face, links underlined in Team (external links open in a new tab with `rel="noopener noreferrer"`).

**States:** loading → title bar and eight text-line skeletons; document absent (404) → heading "Page not found" and button "Go home" (→ `/home` or `/`); read failed → `FAN-13` card.

**Copy:** "Terms", "Privacy", "Updated {date}", "Page not found", "Go home". Everything else is the document.

**Data:** `GET /b2b/legal/:doc` (**NEW**), `doc` ∈ `terms`, `privacy` → `{ title, markdown, version, updatedAt }`, 404 when the document does not exist. Public: no session, no membership, not refused while a tenant is paused. Platform documents, the same for every tenant.

**`FAN-42` — The routes always exist; links to them appear only when the document exists.** The app requests both documents once per session (cached, and refetched at most every 30 minutes). A 404 hides the menu link. The in-app pages replace today's links to `overboardsports.com/terms` and `/privacy`, which serve no legal page; `config/legal.ts` is deleted.

**`FAN-43` — No placeholder legal text, ever.** Until a document is published the link is absent and a direct visit shows "Page not found". Nothing says the text is coming.

**`FAN-44` — The markdown renderer is safe.** Headings, paragraphs, lists, emphasis, links and horizontal rules only; raw HTML is dropped, link targets are limited to `https:` and `mailto:`.

### Paused

**Layout:** full screen, no top bar, no menu. `DecorField` full at intensity 0.3. Centred column: tenant logo (96px; omitted when there is none), heading curated `pausedHeading` (display face, 36px), body curated `pausedBody` (body 17px, secondary text).

**Copy:**

| Element | Default | Curated key |
|---|---|---|
| Heading | "Taking a quick break" | `pausedHeading` |
| Body | "{team} Bingo is paused right now. Your account and anything you've earned are safe. Check back soon." | `pausedBody` |

**Data:** `GET /b2b/org/:slug` → `suspended`, `organization.name`, `organization.branding` (theme, logo, `text` **NEW**). The org read is already served while suspended.

**`FAN-45` — Paused is an overlay over whatever route the fan is on, never a navigation.** It renders when the org read returns `suspended: true` at load, and when any fan API call returns 403 with `code: "tenant_suspended"` mid-session (unhandled today). The URL does not change, so when the tenant resumes, the fan is where they were.

**`FAN-46` — The app notices a resume without a reload.** While paused, the app re-reads the organization when the tab regains focus or visibility, and every 60 seconds while visible. When `suspended` is false, the overlay lifts and every query refetches.

**`FAN-47` — Paused is branded and calm.** Theme, logo and the tenant's own words apply. There is no error styling, no sign-out prompt and no explanation beyond the two strings. `/terms` and `/privacy` still render during a pause (`FAN-04`).

**Accessibility:** the heading is the `h1` and receives focus when the overlay appears mid-session; the body is announced once via a polite region.

---

## Curated text

**`FAN-48` — Exactly 12 strings are editable by a tenant: the 7 existing entry-gate overrides and 5 new brand strings. Every other string in this spec is platform copy.**

There is no `returningCta` key: the seventh `GateCopyOverrides` key in `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts` is `footerNote`, and the returning CTA ("Accept & Continue" / "Save & Continue") is platform copy. This spec follows the code.

**Gate strings** (stored as `organization.gateCopy`, type `GateCopyOverrides`; served on `GET /b2b/membership` as `gateCopy`; edited in Fields & Opt-ins › Screen text; resolved by `resolveGateCopy` and `returningSubtitle` in `obs-b2b-shared/src/entry-gate/copy.ts`):

| Key | Where | Default | Max | Tokens |
|---|---|---|---|---|
| `joinHeading` | Join gate band | "Join {Team}" | 300 | none (literal text) |
| `joinSubtitle` | Join gate subtitle | "You're already signed in — one quick step before you can play here." | 300 | none |
| `joinCta` | Join gate button | "Join {Team}" | 300 | none |
| `returningHeading` | Returning band | "Welcome back" | 300 | none |
| `returningSubtitle` | Returning subtitle | the computed "what changed" sentence, or its fallback | 300 | none |
| `consentsHeading` | Join consents heading | "{Team} consents" | 300 | none |
| `footerNote` | Footer note | "Wrong team? You'll stay signed in — just head to the right site." | 300 | none |

`{Team}` in these defaults is filled by the platform; an override is literal text with no tokens (today's behaviour, unchanged).

**Brand strings** (new; edited in Brand v2 › Words):

| Key | Where | Default | Max | Tokens |
|---|---|---|---|---|
| `startTagline` | Gate tagline | "Pick your players. Win prizes." | 60 | `{team}` |
| `startCta` | Gate primary button | "Continue with email" | 24 | `{team}` |
| `homeEmpty` | Home and Contests empty-state body | "Check back soon for the next contest." | 90 | `{team}` |
| `pausedHeading` | Paused heading | "Taking a quick break" | 40 | `{team}` |
| `pausedBody` | Paused body | "{team} Bingo is paused right now. Your account and anything you've earned are safe. Check back soon." | 160 | `{team}` |

**`FAN-49` — Brand strings live on the organization as `branding.text`, a flat record keyed by the literal key strings above, and are served on `GET /b2b/org/:slug` inside `organization.branding.text`.** The public branding projection (`publicBrandingSchema`) gains `text`; it is served while the tenant is suspended, because the Paused screen reads it. `branding.text` sits beside `theme` and `assets`, not inside `theme`, for the same reason assets do: applying a preset must never change a tenant's words.

**`FAN-50` — Writers replace `branding.text` as a whole object.** The admin write sets `branding.text` to the full validated record (or unsets it when empty), so a stored record is always one validated whole. Readers treat an absent record, an absent key, and a blank or whitespace-only value identically: the default applies.

**`FAN-51` — One definition of the brand defaults and one resolver, in shared.** `obs-b2b-shared` gains `BRAND_TEXT_KEYS`, `BRAND_TEXT_DEFAULTS`, `BRAND_TEXT_LIMITS`, a zod `brandTextSchema`, and `resolveBrandText(teamName, text)` beside `resolveGateCopy`. The fan app, the preview and the console's Words placeholders all read these; nobody keeps a second table.

**`FAN-52` — Validation.** The admin write rejects unknown keys, values over the limit (counted in characters after trimming, with `{team}` counted as written), and any `{...}` token other than `{team}`, each with a plain message on its field. The fan read ignores unknown keys and, if a stored value is somehow over its limit, still renders it (layout wraps; buttons grow to two lines) rather than truncating a tenant's words.

**`FAN-53` — `{team}` expands to the organization's name from the API,** every occurrence, case-sensitive. Any other text, including stray braces, renders literally.

**`FAN-54` — In the preview render document, `brand.text` carries only the 5 brand keys, and gate copy travels only in `gate.gateCopy`.** `brand.text` is `Partial<Record<CuratedTextKey, string>>`, where the preview contract's `CuratedTextKey` is `"startTagline" | "startCta" | "homeEmpty" | "pausedHeading" | "pausedBody"`, the same five keys as shared `BRAND_TEXT_KEYS`. No gate key is in it, and neither are `contestsEmpty`, `boardTitle` or `prizeCta`, which are platform copy (a prize's button text is already the tier's own field). A missing `brand.text` or key falls back to `BRAND_TEXT_DEFAULTS` through the same resolver.

---

## Preview's place in the app

**`FAN-55` — `/preview` renders the real screen components from this spec and the flow spec, fed by the render document or by fixtures, never by the API.** Screen mapping: `gate` → Gate, `join` → Join gate, `home` → Home, `contest` → Contest detail, `board` → live board, `prize` → the prize popup over the board, `results` → standings in its final state, `paused` → Paused. Protocol, fixtures and the PREVIEW chyron are defined by the preview contract and [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md).

**`FAN-56` — Nothing in the fan app knows it is previewed except its data source.** Screens take their data through the same hooks, with the preview providing a fixture store in place of the API. Writes are no-ops. Motion runs (reduced motion still wins).

---

## Accessibility

**`FAN-57` — Contrast.** All text meets 4.5:1 against what it sits on, using the resolver's derived on-colours; large display text (24px and up) meets 3:1 at least and 4.5:1 where the palette allows. Chyron text meets 4.5:1 on its block. Non-text indicators (chip borders, the Live dot, focus rings, the Team bar on the current menu item) meet 3:1. Decoration never sits behind body text at more than 0.12 alpha.

**`FAN-58` — Focus is always visible.** Every interactive element shows a focus ring from `--glow-ring` (2px, offset 2px) on keyboard focus. Sheets and dialogs trap focus and return it to their trigger on close. Route changes move focus to the new screen's `h1`.

**`FAN-59` — Touch targets are at least 44×44px,** including chips, the menu button, the back chevron, code boxes, switches and inline "Edit" buttons (padding extends small text buttons to 44px).

**`FAN-60` — Colour is never the only signal.** Status is always a word (chyron). Active chips are also `aria-pressed` and bolder. Required consents carry the REQUIRED word. Errors have text. Board states in the mini grid are also conveyed in the tile's accessible name ("2 bingos").

**`FAN-61` — Reduced motion disables every reveal, slide, scale, pulse and fade in these screens.** Sheets appear in place, skeletons are static, the LIVE pulse holds steady, cards do not scale on press. (The flow spec's jiggle, confetti, flash and counter bump follow the same switch.)

**`FAN-62` — Structure.** Each screen has one `h1`; sections use `h2`. Landmarks: `header` (top bar), `nav` (menu), `main`. `lang="en"` on `<html>`. Display uppercase is CSS only. The page zooms to 200% and reflows at 320px width with no horizontal scroll; the viewport meta never sets `maximum-scale` or `user-scalable=no`. The smallest text is 12px.

---

## Performance

**`FAN-63` — Budgets, measured with Lighthouse's mobile profile (simulated slow 4G, 4× CPU slowdown) on the Gate and Home:**

| Measure | Budget |
|---|---|
| First contentful paint | under 1.5s |
| Largest contentful paint | under 2.5s |
| Cumulative layout shift | under 0.1 |
| Interaction to next paint | under 200ms |
| Initial JavaScript (gzip) for signed-out routes | under 170 KB |
| Each decor piece (inline SVG) | under 4 KB, no raster decoration |
| Fonts | only the active pairing's weights (Prime Time: Barlow Condensed 600/700, Barlow 400/500/600, IBM Plex Mono 500), preloaded, `font-display: swap` |

**`FAN-64` — Loading discipline.**
- Route-level code splitting: auth screens, app screens, the contest flow and `/preview` are separate chunks; `/preview` never loads in the fan's session.
- Images below the fold are `loading="lazy"`; every image has explicit width and height so nothing shifts.
- Endless lists stop growing the DOM cost: cards past the first 60 use `content-visibility: auto` with an intrinsic size.
- Section reads on Home run in parallel; no section waits for another.
- Terms and Privacy availability is one cached read per document per session.

---

## Acceptance criteria

1. [ ] A signed-out visit to `/contest/abc` lands on the Gate with `next=/contest/abc`; after sign-up, verification and the join gate, the fan is on `/contest/abc` without any further navigation.
2. [ ] A `next` of `//evil.example`, `https://evil.example` or `/sign-in` is ignored and the fan lands on `/home`.
3. [ ] A signed-in fan opening `/`, `/sign-in`, `/sign-up` or `/forgot-password` lands on `/home`.
4. [ ] `/dashboard` redirects to `/profile#boards`; `/test-sign-in` redirects to `/home` (signed in) or `/` (signed out) and `SignInTest.tsx` is not in the bundle.
5. [ ] Opening `/contest/:id` from a shared link and tapping the back chevron goes to `/contests`, not out of the site.
6. [ ] With the menu open, the browser back button closes the menu and leaves the fan on the same screen.
7. [ ] Returning from a contest detail to `/contests` after loading three pages restores all three pages and the scroll position.
8. [ ] Each screen's decor matches the `FAN-11` table; with `decor.field: "none"` no `DecorField` renders anywhere, including on desktop; with `decor.band: "none"` no element is skewed on the Y axis.
9. [ ] At 1280px wide, the decor field fills the viewport and the content column is 480px, centred, on opaque ground; nothing is multi-column.
10. [ ] No screen shows the text "Loading"; skeletons do not appear for loads under 150ms.
11. [ ] With the network disconnected, the offline banner shows with the exact `FAN-16` string; reconnecting removes it and refetches.
12. [ ] On a mouse-only device the load error reads "We couldn't load this. Try again."; on a touch device it reads "We couldn't load this. Pull to refresh or try again."
13. [ ] The Gate's CTA goes to `/sign-up`, "Already playing? Sign in" goes to `/sign-in`, and both carry `next`.
14. [ ] With no next game, the Gate shows no scorebug and no text about games; with no sign-in placement it shows no "Presented by".
15. [ ] Sign-in shows "Forgot password?" and it opens `/forgot-password`.
16. [ ] Pasting "123456" into the first code box fills all six and submits; "Resend code" is disabled for 30 seconds after each send.
17. [ ] A wrong password shows "That email and password don't match." under the form, and no error shows a code or a vendor name.
18. [ ] The join gate renders every string listed in its copy table from `copy.ts`; setting `gateCopy.footerNote` changes the footer note and nothing else.
19. [ ] A fan with a board in a contest whose game is in progress sees a LIVE NOW card on Home with the correct bingo count and "Open board".
20. [ ] Home shows at most 5 open contests and shows "See all contests" only when more than 5 exist; it never lists a contest the fan has joined under "Open to join".
21. [ ] A tenant with no contests and a fan with no boards sees "Nothing on the schedule yet" and the tenant's `homeEmpty` text (or the default).
22. [ ] A banner card for a contest with 3 games shows two games and "+1 more"; with no tiers it shows no prize line; with no player count on the wire it shows no "playing" text.
23. [ ] A joined contest's card shows JOINED and "Open my board", and the button opens the board directly while the rest of the card opens the detail page.
24. [ ] `/contests` never requests more than one page at a time, never shows a "load more" button, requests pages with `cursor` and `limit=20`, and shows the server's `total`.
25. [ ] Typing in search waits 300ms, resets to the first page, and updates `?q=` in the URL; toggling Live and Past sends `status[]=live&status[]=past`.
26. [ ] A failed second page shows "We couldn't load more contests." with Retry, and loading resumes after Retry.
27. [ ] Contest detail shows the admin's Description as paragraphs, and shows nothing in its place when it is empty.
28. [ ] Contest detail CTA reads, per state: "Build my board", "Open my board", "Opens in 2 days" (disabled), "Contest full" (disabled), "Closed" (disabled).
29. [ ] A Trivia contest's detail page shows the band, description and the card "Trivia is on its way. This contest opens when it's ready.", and no games, prizes, rules, counts or CTA.
30. [ ] A `board_exists` refusal navigates to that board with the toast "You already have a board in this contest."; `contest_full` shows "This contest is full." above a disabled "Contest full".
31. [ ] A hidden or unknown contest id shows "We couldn't find this contest" with "See all contests".
32. [ ] The prize ladder lists tiers lowest bingos first, shows "Provided by" only for tiers that name a sponsor, and expands a tier's description on tap.
33. [ ] The menu lists Home, Contests, Your boards, Profile and Sign out; Terms and Privacy appear only when `GET /b2b/legal/terms` and `/privacy` return a document.
34. [ ] Editing the display name on Profile saves through `PATCH /b2b/membership` and shows "Saved."; clearing it shows "Display name is required." and does not save.
35. [ ] An optional consent can be withdrawn after confirming "Withdraw this consent?", and its card then reads "Declined on {today}"; the locked Terms & Privacy consent has no control.
36. [ ] "Your boards" in the menu opens `/profile#boards` with focus on that section.
37. [ ] `/terms` with a published document renders its title, "Updated {date}" and the markdown at 17px with 1.6 leading in a 640px column; without one it renders "Page not found".
38. [ ] A mid-session 403 `tenant_suspended` shows the Paused overlay without changing the URL; when the tenant resumes, focusing the tab lifts the overlay and the fan is on the same screen.
39. [ ] Paused shows the tenant's `pausedHeading` and `pausedBody` with `{team}` replaced by the tenant name, or the defaults.
40. [ ] Saving `branding.text` with `startCta` longer than 24 characters, an unknown key, or a `{tenant}` token is refused with a field message; saving writes the whole `branding.text` object.
41. [ ] Applying a preset in Brand v2 leaves `branding.text` unchanged.
42. [ ] A preview render with `brand.text: { startTagline: "Go {team}" }` shows "Go {Tenant name}" on the Gate; a `brand.text.joinHeading` value is ignored, and `gate.gateCopy.joinHeading` changes the join heading.
43. [ ] The words "Parlays hit", "My Boards", "Settled", "Log Out" and "Overboard Bingo" (for a tenant not named Overboard) appear nowhere in the fan app.
44. [ ] Keyboard only: every screen can be completed; focus is always visible; the menu traps focus and returns it to the menu button.
45. [ ] With reduced motion on, no element animates on any screen in this spec.
46. [ ] Gate and Home meet every `FAN-63` budget on the Lighthouse mobile profile.
47. [ ] At 320px width and at 200% zoom no screen scrolls horizontally.

---

## Open questions

- **Points visibility (open, Arthur).** Whether B2C-style points are shown. Standings rank by bingos, then points, either way. It is owned by [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md). No screen in this spec shows points, so either answer leaves this spec unchanged.
- **Links from the locked Terms & Privacy consent card to `/terms` and `/privacy`.** The card shows the opt-in's text verbatim, which is plain text. Once the documents exist, should the card also carry "Terms" and "Privacy" links (rendered by the card, only when each document exists), so a fan can read what they are agreeing to before they agree? Recommendation: yes; it adds no wording and follows `FAN-42`.

---

## Recorded gaps

Everything here is deliberately absent from the screens and must stay unmentioned on them (`D-068`).

- **No live score feed.** Scorebugs show status and tip-off time only ("Tip 7:30 PM", "Live", "Final"). No score, period or clock is shown until a feed exists.
- **Player counts are not on the wire.** "{n} playing" and "{m} spots left" are omitted until `playerCount` is served (`numberParticipants` on the contest is dead data and must not be used).
- **Opening time is not on the wire.** The server serves "Opens in N days" as a string only. The OPENS chyron, the "Opens {when}" line and the CTA countdown need `opensAt`.
- **No LIVE status exists server-side.** The contest status has no live state; `live` must be derived from game status and served. LIVE chyrons, the Live filter and the LIVE NOW section depend on it.
- **List paging, search and filters are not on the wire.** `/contests` cannot meet `FAN-32` until `FAN-35` lands; the current endpoint loads everything.
- **My boards is unpaged and heavy.** It returns every board with nine populated props and no contest status.
- **Contest detail lacks status, tiers, type, counts and the fan's board id.**
- **"Provided by" sponsor is not on the public wire.** Prize lines and ladder stops omit the credit until `providedBy` is served.
- **Join refusals carry no codes.** Refusals are told apart only by message text today; the fan app keys on `code`, which must be served.
- **Trivia is not a valid `gameType` in shared.** No Trivia contest can exist until `GAME_TYPES` widens.
- **No legal documents exist.** `GET /b2b/legal/:doc` is new; until it serves a document, the menu has no Terms or Privacy links (text waits on Nick).
- **Brand strings have no storage.** `branding.text` is new; until it exists every brand string is its default.
- **Display name is not editable after joining.** `PATCH /b2b/membership` accepts only `profileFields`; the Profile edit waits on `displayName`.
- **Profile cannot list answered consents with labels.** The membership response carries only pending opt-ins; the Consents section waits on `optIns`.
- **The sponsor schedule's next game has no status.** The Gate's scorebug cannot show LIVE until `nextGame.status` is served.

---

## Mocks

Static HTML mocks live in `overboard-b2b-workspace\mocks\fanapp-v2\` (being built in parallel with this spec). Each takes `?tenant=bears|hawks&mode=dark|light`:
- **Bears:** Team #0B162A, Second #C83803, Accent #F5B32E, Prime Time preset.
- **Fighting Hawks:** Team #009A44, Second #1B5E3C, Accent #FFB224, Prime Time with the double band.

| File | Screen |
|---|---|
| `gate.html` | Gate (`/`) |
| `sign-in.html` | Sign in, with the code step |
| `sign-up.html` | Create account, with the verify step |
| `join.html` | Join gate (join and returning) |
| `home.html` | Home, including the empty state |
| `contests.html` | Contests list with search, chips and endless scroll |
| `contest.html` | Contest detail, including the Trivia card and a refusal notice |
| `profile.html` | Profile with the menu sheet |
| `paused.html` | Paused |
| `terms.html` | Terms (the Privacy page is identical in layout) |

All sample names in the mocks are invented; no real athletes, no real team marks beyond the two test tenants' colours.

---

## References

- Research (workspace `artifacts\review-2026-09-24\`): `contests-engine-fanapp.md` §3 (fan app contest plumbing) and §6 (contest text, hardcoded fan copy inventory); `admin-wide.md` Q5 (what fans see when paused, the tenant-name bug) and Q8 (the unbound sign-up checkbox, placeholder legal links); `prizes-sponsors.md`.
- Rulings: `artifacts\wave-2026-09-24\WAVE-RULES.md` — Lists (endless scroll), Contests (contest type, Trivia placeholder, Description shown to fans), Fields & Opt-ins (the locked Terms & Privacy opt-in, the I-agree checkbox), Brand gets simpler (curated text, one preview), Fan app overhaul.
- Preview contract: `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md` — `FAN-54` matches its curated-text keys.
- [`entry-gate.spec.md`](entry-gate.spec.md) — the join gate's behaviour, which this spec restyles and does not change.
- [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) — builder, live board, prize popup, standings and results.
- [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) — the `/preview` route, its fixtures and the PREVIEW chyron.
- [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md) — the decor kit, the palette roles and the `decor` block.
- [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) — the Brand page, including Words, where the five brand strings are edited.
- [`fan-app-v2-build-plan.md`](../../documents/HLDs/fan-app-v2-build-plan.md) — the build slices for this wave's specs.
- [`styling.spec.md`](styling.spec.md) — superseded by this spec for the visual layer of the fan screens.
- [`admin-surface.spec.md`](../core-modules/1-draft/admin-surface.spec.md) Rule 12 — superseded by [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md).
- [`admin-branding.spec.md`](../core-modules/1-draft/admin-branding.spec.md) — the theme contract the decor block extends; its "Honesty by omission" principle.
- [`admin-fields-and-optins.spec.md`](../core-modules/1-draft/admin-fields-and-optins.spec.md) — where the gate strings are edited.
- Decision `D-068` (vault `ledgers\decisions.md`) — honesty by omission, with Arthur's 2026-09-24 clarification allowing a clearly temporary placeholder for a feature being built.
- Code: `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts` (`GateCopyOverrides`, `BrandingSettings`), `obs-b2b-shared/src/entry-gate/copy.ts` (gate defaults), `obs-b2b-shared/src/api/b2b/org.ts` (public branding projection), `overboard-b2b-template/src/App.tsx` (today's routes).
