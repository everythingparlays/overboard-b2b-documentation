# Webapp Spec: Fan App v2 — Shell, Navigation and Screens (Wave 5)

**Implements:** Arthur's 2026-09-27 rulings "Fan app overhaul" (footer bar with Contests, Your boards, Profile; no home screen; Current/Past tabs; header and footer hide on scroll-down and return on scroll-up; the sidebar's items; desktop is the mobile column with decorative sides; Satoshi only; no "peeking" text) and the standing rule "function over mocks" (2026-09-28); the Wave 4 walkthrough rulings for the fan app (Terms and Privacy always in the side menu with the tenant's opt-in documents under them; contests, not games, with the contest's own name and description; mobile only; no pointless confirmations). Director's decisions W5-D01 to W5-D50, all binding (chiefly W5-D01 to W5-D07, W5-D24 to W5-D26, W5-D33, W5-D37, W5-D39, W5-D40, W5-D49, W5-D50; `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md`, workspace), and the Phase A review rulings (`artifacts\wave-2026-09-27\briefs\w5-review-rulings.md`, workspace). PRD `OPT-01`–`OPT-05` (through the entry gate), `BRAND-02` (the sign-in sponsor on Start).

**Depends on:** Wave 4's specs on docs branch `arthur-w4-console` (PR #29, not merged to main): [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md), [`entry-gate.spec.md`](entry-gate.spec.md) (revision 2026-09-27: opt-in documents over the gate), `../core-modules/1-draft/admin-fields-and-optins.spec.md` (revision 2026-09-27: opt-ins linked to a sponsor or not, kept versions, `consentHistory`, documents), `admin-contests.spec.md` (states, description), `admin-prizes.spec.md`, `admin-sponsors.spec.md`. The Wave 4b fix pass (branches `arthur-w4b-*`, not built at the time of writing): the shared derived bingo function (W5-D40), the re-grounded prize model (W5-D41), per-contest banners, the current app's menu listing tenant documents. On main: [`../core-modules/1-draft/end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md) (Wave 3: derived game status, `featuredGame`, join refusal codes, server awards, the legal overlay). This branch is cut from the Wave 3 state of docs `main` and is rebased once Wave 4 and 4b merge; names above marked "to confirm at rebase" are checked then. Siblings on this branch: [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md), [`fan-app-v2-console-touchpoints.spec.md`](fan-app-v2-console-touchpoints.spec.md), [`../core-modules/1-draft/fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md), [`../core-modules/1-draft/admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md).

**Supersedes:** S2's draft of this spec (docs branch `arthur-s2-fanapp-spec`, PR #23). For the Wave 5 branch only, [`styling.spec.md`](styling.spec.md) for the visual layer of every screen here.

**Status:** Draft, 2026-09-28, Wave 5 Phase A. Built in Phase B on the long-lived `arthur-w5-fanapp` branches, which are never merged to main (W5-D29). Nothing here changes main's fan app.

## Overview

Today's fan app (Wave 4, `.worktrees\template-w4-int`) is a start screen, the Clerk sign-in, sign-up and reset pages, the join gate, a Contests list with Upcoming and Past tabs, a player-draft page, the board, the Terms and Privacy pages, an unlinked `/dashboard`, and a side menu with Terms, Privacy and Log Out. It has no profile, no list of the fan's boards, no footer navigation and no way to edit a display name or withdraw a consent.

**The whole change, in one line:** the fan app becomes three tabs (Contests, Your boards, Profile) in one mobile column dressed by the decor kit, every screen shows only what the platform stores and does, and each thing the server doesn't provide yet is written here as "Phase B: to build", never faked on screen.

**In scope:**
- Routes, redirects, back behaviour and deep links.
- The shell: `TopBar`, the footer `TabBar`, hide-on-scroll, the side menu, loading, error, offline and toast patterns.
- Screens: Start, Sign in, Sign up, Forgot password, the join gate (join and returning, with documents over it), Contests (Current and Past), the contest card, Your boards, Profile, Terms, Privacy and tenant documents, Paused.
- The curated strings a tenant can edit, reconciled to what is stored.
- Every screen's states.
- The roll-up function audit for all Wave 5 fan and console specs.

**Not in scope:**
- Contest detail, the builder, the live board, the prize popup, standings and results: [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md). This spec places them in navigation.
- The kit's tokens and components: [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md).
- The `/preview` contract: Wave 4's [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md), which the overhaul implements with `app: 'overhaul'` (W5-D30).
- Console screens: [`fan-app-v2-console-touchpoints.spec.md`](fan-app-v2-console-touchpoints.spec.md), [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md).

---

## Principles

**Function over mocks** (Arthur, 2026-09-28). The mocks in `mocks\fanapp-v2\` are visual direction. Every screen, control, field and string here traces to a real field or a real behaviour, or is marked "Phase B: to build" with what must be built. Where a mock and real function disagree, function wins and the deviation is in the function audit.

**Honesty by omission (`D-068`).** Nothing is invented: no counts, ranks, scores, prizes, sponsors, legal text or sample data on a fan screen. A section with no data is absent, and nothing on screen narrates why. The recorded gaps below are the only place a gap is described.

**Mobile only.** One column, at most 480px wide. From 900px the column is centred with the tenant-coloured decorative sides (`DECOR-35`). No screen has a desktop layout.

**Satoshi only** (`DECOR-29`).

**No pointless confirmations.** No confirm dialog for a reversible action. "Leave without saving?" (Leave / Keep editing) appears only when leaving would lose unsaved input.

---

## Navigation

### Route map

**`FAN-01` — The router has exactly these routes and redirects; no other path renders a screen.** A path that matches nothing redirects with `replace`: signed in → `/contests`, signed out → `/`.

| Route | Screen | Access | Exists today | Defined in |
|---|---|---|---|---|
| `/` | Start | Signed out; signed in → `/contests` | yes (`StartScreen`) | here |
| `/sign-in` | Sign in (Clerk email and password, second-factor code) | Signed out; signed in → `/contests` | yes | here |
| `/sign-up` | Sign up (with its verify step) | same | yes | here |
| `/forgot-password` | Reset password | same | yes | here |
| any protected route | The join gate, rendered in place | Signed in, not a member or blocked | yes (`ProtectedRoute` → `JoinTenant`) | here, [`entry-gate.spec.md`](entry-gate.spec.md) |
| `/contests` | Contests (Current, Past); **the landing** | Member | yes (Upcoming, Past) | here |
| `/contest/:contestId` | Contest detail | Member | no (today this route is the draft page) | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/contest/:contestId/build` | Builder: pick your players and Generate (today's draft page, moved) | Member | as `/contest/:contestId` | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/contest/:contestId/build/lines` | Builder: pick lines yourself | Member | no | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/board/:boardId` | Live board | Member | yes | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/board/:boardId/edit` | Edit your board | Member | no | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/contest/:contestId/standings` | Standings and results | Member | no | [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) |
| `/boards` | Your boards | Member | no | here |
| `/profile` | Profile | Member | no | here |
| `/terms`, `/privacy` | Overboard's Terms of Service and Privacy Policy | Anyone | yes (`LegalPage`) | here |
| `/documents/:optInId/:linkId` | A tenant opt-in document | Anyone | no | here |
| `/dashboard` | Redirects (`replace`) to `/boards` | — | yes (orphaned "My Boards") | here |
| `/preview` | The console's preview frame | Anyone; no session, no API | yes (Wave 4) | [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) |
| `/kit` | The decor kit gallery (Wave 5 branch only) | Anyone | Phase A | [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md) |

- **`FAN-02` (revised) — Signed-in fans land on `/contests`.** There is no home screen (W5-D01). This is today's behaviour: every auth page and `/` already redirect a signed-in fan to `/contests`.
- **`FAN-03` (revised) — `/test-sign-in` and `SignInTest.tsx` are removed**; `/dashboard` redirects to `/boards`.
- **`FAN-04` (revised) — Terms, Privacy and tenant documents sit outside the membership guard**; they render signed out, signed in, member or not. While a tenant is paused, the Paused screen replaces every route, these included (today's behaviour: `TenantProvider` renders `SuspendedScreen` in place of the app).

### Deep links

**`FAN-05` — A deep link survives sign-in, sign-up and the join gate.** Today `ProtectedRoute` sends a signed-out fan to `/` and the link is lost; this is fan-app work with no server change.
- A signed-out fan opening a protected route goes to `/?next=<path and search, URL-encoded>`. Start forwards `next` to `/sign-in`; sign-in and sign-up forward it to each other and to their code steps. On success the app navigates to `next`, else `/contests`.
- `next` is accepted only when it starts with a single `/`, not `//`, and is not an auth route. Anything else is dropped silently.
- The join gate renders in place at the requested route (as today). When membership resolves, the requested screen renders at the same URL. The gate never navigates.

### Back behaviour

**`FAN-06` (revised) — The back button goes back in history when the previous entry is inside the app, and otherwise replaces the current entry with the screen's parent**, so a fan arriving on a deep link is never bounced out of the site.

| Screen | Header left | Parent with no in-app history |
|---|---|---|
| Contests, Your boards, Profile (the tabs) | Tenant mark | none |
| `/sign-in`, `/sign-up`, `/forgot-password` | Back | `/` |
| `/contest/:id` | Back | `/contests` |
| `/contest/:id/build` | Back | `/contest/:id` |
| `/contest/:id/build/lines` | Back | `/contest/:id/build` |
| `/board/:id` | Back | `/boards` |
| `/board/:id/edit` | Back | `/board/:id` |
| `/contest/:id/standings` | Back | `/contest/:id` |
| `/terms`, `/privacy`, `/documents/…` | Back | `/contests` signed in, `/` signed out |

**`FAN-07` — Sheets are history entries.** Opening the side menu or any bottom sheet pushes a history state; the browser's or phone's back closes it without leaving the screen.

**`FAN-08` — Scroll position is restored on back** to Contests, Your boards and Profile, from the query cache (5 minutes), without refetching from scratch.

---

## Shell

Every signed-in screen renders inside `KitShell` ([`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md), `DECOR-35`): the 480px column, the palette resolved from `organization.branding.theme` on `GET /b2b/org/:subdomain` (already fetched at boot by `TenantContext`), and the decorative sides from 900px.

### Header

**`FAN-09` (revised) — The header** (W5-D07): 56px plus the top safe-area inset.
- Left: the back button (48×48) or, on the three tab screens, the tenant mark (the tenant logo at 28px, else the tenant name in `.k-d4`).
- Centre: the screen title, one line, ellipsis.
- Right: the menu button (48×48, accessible name "Open menu").
- Over a hero band it is transparent and uses `--k-on-team`; elsewhere it sits on the blurred 92% ground (`DECOR-36`) with a hairline once scrolled.
- On the live board it also shows the connection dot (W5-D19, [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md)).

### Footer tab bar

**`FAN-65` — The footer is a tab bar with icon and label** (W5-D01): **Contests** (`Trophy`), **Your boards** (`LayoutGrid`), **Profile** (`User`), lucide-react icons at 22px over 11px labels.
- The active tab: icon and label in `--k-team-ink`, a 3px `--k-team-ink` hairline segment on the tab's top edge, `aria-current="page"`.
- The bar is a `nav` labelled "Main"; each tab is a link to `/contests`, `/boards`, `/profile`; the bottom safe-area inset is added under it; each target is at least 48px tall.
- A tab stays active on its own sub-screens: Contests for `/contest/:id…`, Your boards for `/board/:id`.
- Tapping the active tab scrolls its screen to the top.

### Which bar where

**`FAN-66` — Bars per screen** (W5-D04):

| Screen | Header | Footer |
|---|---|---|
| Contests, Your boards, Profile | yes | Tab bar |
| Live board, Standings | yes (back) | Tab bar |
| Contest detail | yes (back; transparent over the band) | Its own sticky CTA bar ([`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) `FLOW-01`) |
| Builder (pick your players, pick lines yourself, edit your board) | yes (back) | Its own sticky action bar (Generate; or Fill empty squares, Rearrange, Enter / Save) |
| Terms, Privacy, tenant documents | yes (back) | none |
| Start, Sign in, Sign up, Forgot password, join gate, Paused | none | none |

### Hide on scroll

**`FAN-67` — Header and footer hide on scroll-down and return on scroll-up** (W5-D03), with the kit's controller (`useChromeVisibility`, `DECOR-36`): one rAF-throttled controller per screen, a 12px direction threshold, rubber-band overscroll ignored, never hidden within 64px of the top, shown again when scrolling stops at the top, `translateY` over 240ms `cubic-bezier(.2,.7,.2,1)`, instant under reduced motion, content padding reserved so nothing shifts. The app calls `reveal()`:
- on every route change;
- when a sheet or the side menu opens;
- when keyboard focus lands in either bar;
- when a toast or the offline banner appears.

A task flow's sticky CTA or action bar follows the same rules as the tab bar it replaces.

### Side menu

**`FAN-10` (revised) — The side menu** (W5-D05): opened by the header's menu button; a right-hand sheet, 288px (at most 80vw), sliding in over 260ms with a scrim; instant under reduced motion.

| Group | Item | Goes to | Source |
|---|---|---|---|
| Head | Tenant logo (if any) and "{Tenant} Bingo"; the fan's display name and email | — | `organization`; `membership.displayName`; the Clerk session's primary email |
| Navigation | Contests · Your boards · Profile | `/contests`, `/boards`, `/profile` | — |
| Documents | Terms of Service · Privacy Policy | `/terms`, `/privacy` | Always listed (walkthrough ruling), published or not |
| Documents | One row per tenant opt-in document, titled with the document's `title` | `/documents/:optInId/:linkId` | **Phase B: to build** (below) |
| Foot | Sign out ("Signing out…" while pending) | Signs out, lands on `/` | Clerk; today's "Log Out" is renamed |
| Foot | "Powered by Overboard" | — | — |

- **Where the tenant documents come from.** No fan read lists them today: `GET /b2b/membership` carries links only for *pending* opt-ins, and `GET /b2b/org/:subdomain` carries no opt-ins. The Wave 4b fix pass must add a source for the current app's menu (walkthrough ruling); the overhaul reads the same one. If 4b ships none, **Phase B: to build** `organization.documents: { optInId, linkId, title }[]` on the public org read (every current tenant opt-in's `links`, platform opt-in excluded, in opt-in order), cached with the org and cleared by a config publish. To confirm at rebase.
- **No opt-in documents:** the documents group shows Terms and Privacy only.
- The current route's item carries `aria-current="page"` and a 3px Team-ink bar at its left edge. The sheet traps focus and returns it to the menu button.

### Loading, errors, offline, toasts

- **`FAN-12` — Skeletons, never a spinner and never the word "Loading".** Skeleton blocks are shaped like the content, on `--k-raised`, pulsing (static under reduced motion), shown only after 150ms. The membership guard's "Loading..." becomes the shell skeleton (header, three card blocks, tab bar).
- **`FAN-13` — One error pattern for a screen or section that failed to load:** a hairline card, "We couldn't load this." and a "Try again" button. A failed primary read replaces the screen body; a failed section read replaces that section only.
- **`FAN-14` (retired)** — pull to refresh is dropped: the app refetches on focus and reconnect (`refetchOnFocus`, `refetchOnReconnect` in `src/store/index.ts`), the board polls, and pull-to-refresh fights hide-on-scroll for the same gesture.
- **`FAN-15` — Write failures are inline, in plain words.** Network: "We couldn't reach the server. Check your connection and try again." Anything else: "Something went wrong. Try again." Known refusal codes use their own copy. No status codes, error codes or vendor names.
- **`FAN-16` — Offline banner.** While `navigator.onLine` is false, a `role="status"` banner under the header: "You're offline. We'll catch up when you're back." It disappears on reconnect, when every active query refetches. Writes attempted offline fail with the network string; nothing is queued.
- **`FAN-17` (revised) — Toasts confirm; they never carry an error the fan must act on.** One at a time, top-centre, 4 seconds, polite live region. Here: "Saved." (a profile field), "Updated." (a consent changed). The flow spec adds its own.

### Status chyrons

**`FAN-18` (revised) — One derivation, everywhere a contest's status shows** (card, contest detail, Your boards rows), from wire fields that exist today (`contestStatus`, `state`, `finalized`, each game's derived `status`):

| Condition (first match wins) | Chyron | Variant |
|---|---|---|
| `finalized` | FINAL | `neutral` |
| Live: `state` is `open`, not finalized, `contestStatus.status` is `Closed` because every game has started, and at least one game's derived status is `InProgress` | LIVE | `live` (dot) |
| `contestStatus.status` is `Open` | OPEN | `team` |
| `contestStatus.status` is `Upcoming` | OPENS {when} (`contestStatus.opensAt`) | `accent` |
| otherwise | CLOSED | `neutral` |

- A contest the fan holds a board on adds JOINED (`success`) after the status chyron. "Holds a board" comes from `GET /b2b/board/my-boards` (each board's populated `contestId`), as today's Contests page does it.
- `{when}`, in the fan's own time: weekday and time (`Sun 7:30 PM`) within 6 days, else `Oct 4, 7:30 PM`. Text is written in words in the DOM and uppercased by CSS.
- An `Open` contest with some games live stays OPEN (fans can still join with the games not yet started, Wave 3 §3.3); its live games show on its scorebugs.

---

## Screens

### Start (`/`)

**Layout, top to bottom** (the CTA is anchored to the bottom so late-arriving blocks never move it):
1. `DecorField` full.
2. The tenant logo (at most 96px tall), when set.
3. Double `HeroBand`: the tenant name, then "BINGO" fitted to the column (`.k-fit`).
4. The tagline: Words `startTagline` (default "Pick your players. Win prizes.").
5. The next game, when one exists and has not started: a `Scorebug` card with "Next game", "{Away} @ {Home}" with the team logos when present, and "Tip Sun 7:30 PM".
6. "Presented by" and the sign-in sponsor's logo (or tagline), linked to its website when set: the `signIn` holder at the featured game.
7. The primary button: Words `startCta` (default "Continue with email") → `/sign-in` (forwarding `next`), as today.
8. "Powered by Overboard".

**Data:** `GET /b2b/org/:subdomain` (`organization.name`, `organization.branding.theme`, `.logo`, `.text` **Phase B: to build**, `suspended`); `GET /b2b/org/:subdomain/sponsors` (`nextGame` with `eventTime`, `homeTeam`, `awayTeam` and their `logoUrl`; `featured`; `sponsors`; `placements`). Both exist.

**States:**
| State | What shows |
|---|---|
| Org loading | The ground only for up to 1.5s (the boot cache paints the tenant's last mode), then the Start skeleton |
| Org failed | The `FAN-13` card, full screen, on the platform default theme |
| Unknown tenant (org read answers no organization) | The `FAN-13` card with "We couldn't find this site." and no retry (nothing to retry) |
| Paused | The Paused screen |
| No next game, or it has started | No scorebug (the sponsor schedule carries no game status, so a started game is never shown as "next") |
| No sign-in sponsor | No "Presented by" |
| Sponsor schedule loading | The "Presented by" block holds its space invisibly (today's rule) |
| No logo | The band's text is the mark |
| Offline | The offline banner; the CTA still navigates |

**Copy:** tenant name (API), "BINGO", tagline (Words), "Next game", "Tip {when}", "Presented by", CTA (Words), "Powered by". Today's tagline appends "from {sponsorName}" for a legacy tenant with a stored `branding.sponsorName`; the overhaul drops that suffix (the sign-in sponsor block is the credit).

### Sign in, Sign up, Forgot password

Today's Clerk flows (`SignIn.tsx`, `SignUp.tsx`, `ForgotPassword.tsx`) restyled on the kit, with the same steps, validation, second-factor code step and links:
- Sign in: email, password, "Forgot password?" → `/forgot-password`, "Don't have an account? Sign up" → `/sign-up`; success → `next` or `/contests`.
- Sign up: email, password, the verify step; "Already have an account? Sign in" → `/sign-in`.
- Forgot password: email, code, new password.

**`FAN-23` (revised) — The code entry is one input of six digits**, `inputmode="numeric"`, `autocomplete="one-time-code"`, accepting paste and OS one-time-code fill, submitting itself on the sixth digit; the Verify button stays.

**States:** Clerk loading (the form ignores a submit until Clerk has loaded, as the Wave 3 harness found; the button shows "Signing in…" disabled until then), field errors under their field, form error above the button, network failure (`FAN-15`), too many attempts, expired code.

**Data:** Clerk only, plus the org read for theming. No Overboard API call.

### Join gate (join and returning)

The shared `EntryGateForm` ([`entry-gate.spec.md`](entry-gate.spec.md)) rendered by `JoinTenant.tsx` inside `KitShell`, with the gate stylesheet's variables mapped from the kit's `--k-*` tokens. Behaviour, validation, submission, the displayed-`textVersion` rule and the 409 handling are unchanged. A corner `DecorField`, a single `HeroBand` with the heading.

- **Documents open over the gate in the same tab** (Wave 3 §4, Wave 4): linked words in an opt-in's text open `?doc=<optInId>.<linkId>` as a full-screen overlay reading `GET /b2b/org/:subdomain/consent-document/:optInId/:linkId?version=<displayed textVersion>`; Back (the overlay's or the browser's) closes it and everything typed is intact.
- **Copy** is `resolveGateCopy` over the tenant's nine `gateCopy` overrides (below); the chips, errors and identity line are platform copy.
- **`FAN-27` (revised) — The display-name placeholder** changes from "Shown on your board" to "Shown on standings and your board" in `obs-b2b-shared/src/entry-gate/copy.ts` **when standings ship** (Phase B, [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) `FLOW-33`), because standings show display names. Until then it stays, because it would be untrue.

**Data:** `GET /b2b/membership` (`member`, `pendingConsents` with `links`, `signupFields`, `pendingFields`, `gateCopy`), `POST /b2b/join`, `POST /b2b/consent`, `PATCH /b2b/membership` (`profileFields`). All exist.

**States:**
| State | What shows |
|---|---|
| Membership loading | The gate skeleton |
| Membership failed | "We couldn't confirm your access." and "Check your connection and reload the page." (today's fail-closed state) |
| Not a member | Join mode |
| Member with something outstanding | Returning mode (only what is missing or re-asked; UPDATED on re-worded opt-ins) |
| Submitting | Button busy, fields read-only |
| Stale wording (409 `stale_text_version`) | The stale-wording notice; the form re-snapshots |
| No opt-in documents | The opt-in texts render as plain text |
| Document loading / missing / failed | Title and a spinner / "This page isn't available." / "This didn't load." with "Try again"; Back always works |
| Offline | The offline banner; submit fails with the network string |

### Contests (`/contests`)

The landing screen.

**Layout:**
1. Header: tenant mark, title "Contests", menu.
2. **Tabs: Current · Past** (W5-D02; bucketing and no paging per W5-D50), a segmented control that hides and returns with the header. Today's app labels the first tab **"Upcoming"** (`ContestsPage.tsx:98-103`); Wave 5 says **"Current"** because the tab holds contests that are open and live as well as those not yet open, and "Upcoming" is wrong for the first two (Arthur's wording). The selected tab is kept in the URL (`?tab=past`) so Back and reload restore it.
3. Contest cards (`FAN-30`), 12px apart.

**`FAN-68` — The buckets, from the existing list endpoint.** The app makes one request, `GET /b2b/contest/list-contests` with no `status` (the server then returns every non-draft contest of the tenant, unsorted), and buckets client-side: Upcoming and Open go to Current, Closed and Finished to Past, and Live contests (`FAN-18`, which the server reports as Closed) move to Current. `?status=upcoming` / `?status=past` exist but split Live into Past, so they aren't used.

| Tab | Holds | Order |
|---|---|---|
| Current | Live, then Open, then Not yet open | Live: earliest-started first; Open: first entries-close time first (the last game's tip-off); Not yet open: soonest `opensAt` first |
| Past | Closed (not live) and Finished | Most recent last game first |

- **No search** (W5-D02: tenants run a handful of contests).
- **No paging** (W5-D50, correcting W5-D02's "endless cursor paging already exists", which is true of the console's lists, not this endpoint). The fan list is one read with no cursor or limit, returning every non-draft contest of the tenant (`listB2BContests.ts`), bucketed into Current and Past client-side. At the volumes tenants run that is correct; paging is not a Phase B item.

**States:**
| State | What shows |
|---|---|
| Loading | Three skeleton cards |
| Failed | The `FAN-13` card |
| Current empty | `DecorField` corner, "No contests right now", and Words `noContests` (default "Check back soon for the next contest.") |
| Past empty | "No past contests yet." |
| Not joinable yet | The card's OPENS chyron |
| Live | LIVE chyron; its live games show on the detail screen |
| Full | Shown as OPEN: fullness is not on the fan wire (there is no player count), so the card can't know; the detail screen's CTA learns it from the `full` refusal ([`fan-contest-flow.spec.md`](fan-contest-flow.spec.md)) |
| Closed / finalized | In Past with CLOSED / FINAL |
| Fan with no board | No JOINED; no "Open my board" |
| No prizes | No prize line |
| No sponsors | No "Provided by" |
| Trivia | Never listed: a trivia contest can't be published (`CONTEST_TYPE_REGISTRY.trivia.playable === false`; `publish_blocked`), and drafts are never on the fan wire |
| Paused | The Paused screen |
| Offline | The offline banner over the last loaded list |

### The contest card

**`FAN-30` (revised) — One card for every contest listing** (W5-D39: contests, not games). The whole card is a link to `/contest/:contestId` (W5-D37: never straight into the builder).

| Part | Content | When | Source |
|---|---|---|---|
| Banner | The contest's banner image (Wave 4b's per-contest banner, else its brand-derived default), 4:1, above the text | When 4b's field is present | Wave 4b; field name to confirm at rebase |
| Corner | `Stripes` | always | — |
| Chyrons | Status (`FAN-18`), then JOINED | always | `contestStatus`, `state`, `finalized`, games' `status`; my-boards |
| Title | The contest's own name, `.k-d2`, up to three lines | always | `contestName` |
| Description | In full, wrapping, `.k-body` | when non-empty | `description` (Wave 4's fan field; `internalNote` never reaches fans) |
| Games | "{Away} @ {Home} · Sun 7:30 PM" for the featured game, and "+N more games" when the contest has more; team logos at 20px when present | when the contest has games | `allowedBetEvents` through shared `featuredGame` (Wave 3 §3.3) |
| Top prize | Gift icon, the highest tier's prize name, then its description in full, wrapping | when the contest has tiers | `prizeTiers` (the fan projection) |
| Meta | "{n} playing" | **Phase B: to build** (`playerCount`; `numberParticipants` is dead data and never shown) | — |
| Meta | "Provided by {sponsor}" for the top tier | when the tier carries `providedBy` on the fan list | **Phase B: to build** for the live list (below) |
| Action | "Open my board" → `/board/:boardId` | when the fan holds a board here | my-boards |

- **`FAN-31` — The card never shows a count, sponsor or prize it did not get from the wire.** No "0 playing", no sponsor inferred from placements, no "Prizes TBA".
- **`providedBy` on the live list.** The shared fan projection (`fan-contest-projection.ts`) adds `providedBy` only when the caller passes sponsor credits, and today only the preview read passes them. **Phase B: to build:** the live `list-contests` and contest reads pass credits too, so the fan sees the same "Provided by" the preview shows.
- The "Open my board" button sits above the card's stretched link as its own control; there are no nested interactive elements. Press feedback scale 0.98 over 100ms (none under reduced motion).

### Your boards (`/boards`)

W5-D06. The fan's boards in this tenant.

**Layout:** header "Your boards"; one row per board: a 46px mini-board, the contest name (`.k-d4`, two lines), the status chyron (`FAN-18`), "{n} bingos" ("1 bingo"), and the chevron; the row links to `/board/:boardId`. Points appear on the row only once the evaluator writes them (W5-D17, `FLOW-34`).

**Mini-board:** hit (Team-ink fill), miss (strike), pending (hairline), empty (dashed). No live square (W5-D23; [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) "The mini-board").

**Order:** Live first, then Open, then Not yet open, then Past (most recent first).

**Data:** `GET /b2b/board/my-boards` gains a server row projection per board (**Phase B: to build**, review ruling 6): the contest's name, its fan status (the `FAN-18` inputs), the evaluator's persisted derived bingos and points (`FLOW-50`), and the nine cell states for the mini-board. The app renders the rows as served: no client-side join and no bingo computation in the browser. Today the endpoint returns every board of the fan in this tenant, newest first, with its contest and props populated but no status. It is not paged; a fan holds one board per contest.

**States:**
| State | What shows |
|---|---|
| Loading | Three skeleton rows |
| Failed | The `FAN-13` card |
| No boards | "You haven't entered a contest yet" and a link "See contests" → `/contests` |
| Board on a finalized contest | FINAL; final bingos |
| Board on a closed contest | CLOSED; still scoring (closing stops joining, never play) |
| Board's props not loaded | The row without a mini-board, name and chyron only |
| Paused | The Paused screen |
| Offline | The offline banner over the last loaded rows |

### Profile (`/profile`)

**Layout, top to bottom:**
1. Header "Profile"; a compact `HeroBand`.
2. **Display name** (`.k-d2`) and the account email (read-only, `.k-small`). **Edit** is **Phase B: to build**: `PATCH /b2b/membership` accepts only `profileFields` today, so it gains `displayName` (required, trimmed, 1–200 characters, the join rule). Until it does, the name shows with no Edit control.
3. **Your details:** the tenant's signup fields in the tenant's order, each with its label (the gate's `resolveField` defaults) and the fan's value, or "Not set" for an empty optional field. Edit expands the gate's own field component inline with Save and Cancel, and saves through `PATCH /b2b/membership` `{ profileFields }` (exists). A required field cannot be saved empty (the gate's validation, repeated by the server). Omitted when the tenant has no signup fields.
4. **Consents:** one card per current opt-in (below).
5. **Sign out** (secondary, full width).

**`FAN-41` (revised) — Consents, on the Wave 4 consent model.** Each card shows:
- the opt-in's text as the fan agreed to it, with its linked documents opening at that version (`/documents/:optInId/:linkId?version=N` over the Profile, Back returns);
- "Required" or "Optional" (from `blocking`);
- "Shared with {Sponsor}" when the opt-in is linked to a sponsor (a data-sharing agreement);
- "Accepted on Sep 24, 2026 · version 3", or "Declined on …";
- for an **optional** opt-in, a switch (accessible name: the opt-in's text, abbreviated) that records a new decision at the current version through `POST /b2b/consent`: turning it off records `declined` (a withdrawal: sponsor exports exclude the fan from then on), turning it on records `accepted`. No confirm dialog: the switch is reversible. Toast "Updated.";
- for a **required** opt-in (the platform Terms and every blocking tenant opt-in), no control: withdrawing it would stop the fan playing, and the way out of the tenant is deleting the fan's data, which is out of scope.

**Where the consent data comes from:** the fan's answers are on `membership.consents` (`optInId`, `textVersion`, `decision`, `agreedAt`) today, with every earlier answer on `membership.consentHistory` (Wave 4). The opt-ins' texts, labels, links and sponsor links are not: `GET /b2b/membership` returns only *pending* opt-ins, and the public org read excludes opt-ins. **Phase B: to build:** `GET /b2b/membership` gains `optIns: { optInId, label?, text, textVersion, blocking, links?, sponsorName? }[]`, every current opt-in of the tenant in order (platform first), projected like `publicOptInSchema` plus `sponsorName` for linked ones. A linked document at the agreed version is read through the public document read with `?version=` (exists).

**The switch uses today's endpoint.** `POST /b2b/consent` already accepts a new decision for an answered opt-in: it validates only that `textVersion` is current, replaces the answer in `consents` (`mergeConsents`) and appends to `consentHistory`. It does not refuse a decline of a blocking opt-in outside the join (the decline would then block play at `POST /b2b/board/generate`), which is why Profile offers no control for one.

**States:**
| State | What shows |
|---|---|
| Loading | Name bar, three field rows, two consent cards as skeletons |
| Membership failed | The guard's fail-closed state |
| Save failed | The `FAN-15` string under the control; the edit stays open with the input kept |
| No signup fields | "Your details" omitted |
| Only the platform opt-in | One consent card, no switch |
| An opt-in re-worded since the fan answered | The gate takes over (returning mode) before Profile renders, as for every protected route |
| Paused | The Paused screen |
| Offline | The offline banner; saves fail with the network string |

### Terms, Privacy and tenant documents

**`FAN-42` (revised) — Terms and Privacy are always in the side menu** (walkthrough ruling). `/terms` and `/privacy` read the platform documents' current version (`GET /b2b/org/:subdomain/consent-document/overboard-terms/terms` and `/privacy`, exists) and render the shared `ConsentDocumentView`, the component the gate overlay uses.

**`FAN-43` (revised) — No placeholder legal text, ever** (W5-D49). When a platform document isn't published (404), the page shows its heading ("Terms of Service" or "Privacy Policy") and one line: **"Overboard hasn't published this yet."** (Terms and Privacy are Overboard's documents, shared by every tenant.) A tenant opt-in document that isn't published shows its title and **"{Tenant} hasn't published this yet."**

**`/documents/:optInId/:linkId`** renders a tenant opt-in document the same way (current version, or `?version=N`). It is reached from the side menu and from Profile. A 404 shows the `FAN-43` line for a tenant document.

**Layout:** header with Back and the document's title; the title as `h1` (`.k-d2`); "Updated {date}" from `publishedAt`; the body at `.k-body` (headings, paragraphs, lists, bold; a URL is plain text; `parseConsentDocument`).

**States:** loading (title and eight text-line skeletons), not published (above), failed ("This didn't load." with "Try again"), offline.

### Paused

**`FAN-45` (revised) — Paused replaces the app** when the org read answers `suspended: true` (the tenant's `status` is `suspended`; the console calls it Pause). "Paused" and "suspended" are one stored state. Today's `TenantProvider` already renders `SuspendedScreen` in place of every route.

**Layout:** no bars; `DecorField` full at intensity 0.3; the tenant logo (96px) when set; Words `pausedHeading` (default "Taking a quick break"); Words `pausedBody` (default "{team} Bingo is paused right now. Your account and anything you've earned are safe — check back soon.", today's `SuspendedScreen` wording).

**`FAN-46` (revised) — The app notices a resume without a reload.** While paused, it re-reads the org when the tab regains focus or visibility and every 60 seconds while visible; when `suspended` is false the app mounts where the fan was. A pause that starts mid-session is noticed the same way (the next org read), and by any fan API call answered `403 { code: "tenant_suspended" }` (the server's tenant middleware already sends it, `middleware/tenant.ts`), which re-reads the org at once.

**`FAN-47` — Paused is branded and calm:** the tenant's theme, logo and words; no error styling, no sign-out prompt.

**States:** paused at load; paused mid-session; resumed; no logo; Words not stored (defaults).

---

## Curated text

**`FAN-48` (revised) — Fourteen strings are editable by a tenant: the nine gate-copy overrides that exist today, and five Words keys (W5-D33). Every other fan string is platform copy.**

**Gate copy (exists):** stored as `organization.gateCopy` (`GateCopyOverrides`), served on `GET /b2b/membership`, edited in the console's Fields & Opt-ins › Screen text, resolved by `resolveGateCopy` in `obs-b2b-shared/src/entry-gate/copy.ts`:

| Key | Where | Max |
|---|---|---|
| `joinHeading`, `joinSubtitle`, `joinCta` | Join mode heading, subtitle, button | 300 |
| `returningHeading`, `returningSubtitle` | Returning mode heading and subtitle | 300 |
| `consentsHeading` | The consents heading | 300 |
| `footerNote` | The gate's footer note | 300 |
| `displayNameLabel` | The display name field's label | 80 |
| `displayNamePlaceholder` | Its placeholder | 120 |

**Words (Phase B: to build):** stored as `branding.text`, edited in Brand v2 › Words ([`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md)), served on `GET /b2b/org/:subdomain` as `organization.branding.text`, also while suspended:

| Key | Where | Default | Max |
|---|---|---|---|
| `startTagline` | Start, under the band | "Pick your players. Win prizes." | 60 |
| `startCta` | Start's button | "Continue with email" | 24 |
| `noContests` | Contests › Current, empty | "Check back soon for the next contest." | 90 |
| `pausedHeading` | Paused heading | "Taking a quick break" | 40 |
| `pausedBody` | Paused body | "{team} Bingo is paused right now. Your account and anything you've earned are safe — check back soon." | 160 |

- **`FAN-49` (revised) — Storage and wire.** `branding.text` is a flat record keyed by the five keys, beside `theme` and `assets` (applying a preset never changes a tenant's words). The public branding projection (`publicBrandingSchema`, `obs-b2b-shared/src/api/b2b/org.ts`) gains `text`; it is `.loose()` today, so an older fan build ignores it.
- **`FAN-50` — Writers replace `branding.text` whole;** readers treat an absent record, an absent key and a blank value alike: the default applies.
- **`FAN-51` (revised) — One definition, in shared:** `obs-b2b-shared/src/theme/brand-text.ts` with `BRAND_TEXT_KEYS`, `BRAND_TEXT_DEFAULTS`, `BRAND_TEXT_MAX`, `brandTextSchema`, `resolveBrandText(text, teamName)`, `BrandText`.
- **`FAN-52` — Validation:** unknown keys, over-limit values and any `{…}` token other than `{team}` are refused on write with a plain message; the fan read renders a stored over-limit value wrapped rather than cut.
- **`FAN-53` — `{team}` expands to the organization's name** from the API, every occurrence.
- **`homeEmpty` is renamed `noContests`** (W5-D33): there is no home screen.
- The two strings the current app hard-codes ("Pick your players. Win prizes", "Continue with Email") become the defaults, re-cased.

---

## Accessibility

- **`FAN-57` — Contrast** comes from the kit's guards (`DECOR-17`, `DECOR-28`): text 4.5:1, non-text indicators 3:1, decoration never above 0.12 behind text.
- **`FAN-58` — Focus is always visible** (`--k-glow-ring`); sheets trap focus and return it; route changes move focus to the new screen's `h1`; a focused control inside a hidden bar reveals it.
- **`FAN-59` — Touch targets are at least 48×48px** everywhere, tab bar items included.
- **`FAN-60` — Colour is never the only signal:** status is a word; mini-board states are in the row's accessible name ("2 bingos, 5 hits, 1 miss").
- **`FAN-61` — Reduced motion** turns off every reveal, slide, scale and pulse; bars show and hide instantly.
- **`FAN-62` — Structure:** one `h1` per screen, `h2` per section; landmarks `header`, `nav` (tab bar "Main", side menu "Menu"), `main`; zoom to 200% and reflow at 320px with no horizontal scroll; `maximum-scale` is never set.

## Performance

- **`FAN-63` (revised) — Budgets** on the Lighthouse mobile profile for Start and Contests: first contentful paint under 1.5s, largest under 2.5s, layout shift under 0.1, interaction to next paint under 200ms. One self-hosted font file (Satoshi Variable) preloaded; no font CDN.
- **`FAN-64` — Loading discipline:** route-level code splitting (auth, app screens, contest flow, `/preview`, `/kit`); explicit image sizes; lazy images below the fold; board photos eager.

---

## Retired from S2

| ID | Was | Why |
|---|---|---|
| FAN-19 | Start's CTA goes to sign-up | Wave 4 flows kept: the CTA goes to sign-in, which links to sign-up |
| FAN-20 | Start never shows a past game | Kept as a state of Start (no status on the schedule's next game, so a started game is omitted) |
| FAN-21 | Restore "Forgot password?" | Already present on today's sign-in page |
| FAN-22 | Sign-up has no consent checkbox | Done in Wave 3/4 (the unbound checkbox was removed) |
| FAN-24 | Resend unlocks after 30s | Clerk's own resend behaviour stays; no extra rule |
| FAN-25 | Success lands on `/home` | Merged into `FAN-02` and `FAN-05` |
| FAN-26 | The gate never navigates | Stated in the join gate section (unchanged behaviour) |
| FAN-28, FAN-29 | Home sections; Home is the landing | No home screen (W5-D01) |
| FAN-32–FAN-35 | Endless scroll, search, filters and paging on `/contests` | Search cut (W5-D02); no paging on the fan list, bucketed client-side (W5-D50) |
| FAN-36 | Trivia card | A trivia contest can never reach a fan (unpublishable); cut |
| FAN-37 | Refusal notices on contest detail | Moved to [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) `FLOW-01`, keyed on the real codes |
| FAN-38 | Detail page is the only way into the builder | Moved to `FLOW-01` (W5-D37) |
| FAN-39 | The menu is the one navigation surface; no bottom tab bar | Reversed: the footer tab bar (W5-D01) |
| FAN-40 | Profile absorbs `/dashboard` | Your boards is its own tab; `/dashboard` redirects to `/boards` |
| FAN-44 | Markdown renderer for legal pages | Superseded by Wave 4's `parseConsentDocument` format |
| FAN-54, FAN-55, FAN-56 | S2's render document `brand.text`, preview screen mapping, fixture store | Wave 4's preview contract is authoritative (W5-D30); the Brand host overlays `organization.branding` (W5-D32) |
| FAN-14 | Pull to refresh | Retired (Shell) |

Kept, revised or new: `FAN-01`–`FAN-10`, `FAN-12`, `FAN-13`, `FAN-15`–`FAN-18`, `FAN-23`, `FAN-27`, `FAN-30`, `FAN-31`, `FAN-41`–`FAN-43`, `FAN-45`–`FAN-53`, `FAN-57`–`FAN-68`. `FAN-11` (the S2 decor placement table) is replaced by the kit's per-component "Where" column and the screen layouts here.

---

## Function audit

### 1. Screens: data, calls, states

| Screen | Data sources (endpoint / model / field) | Server calls on fan action | States covered |
|---|---|---|---|
| Start | `GET /b2b/org/:subdomain` (name, `branding.theme`, `.logo`, `.text`*, `suspended`); `GET /b2b/org/:subdomain/sponsors` (`nextGame`, `featured`, `sponsors`, `placements`) | none (navigation only) | org loading, failed, unknown tenant, paused, no next game, started game, no sponsor, no logo, offline |
| Sign in / up / reset | Clerk; org read for theme | Clerk | Clerk loading, field and form errors, code errors, network |
| Join gate | `GET /b2b/membership` (`pendingConsents` + `links`, `signupFields`, `pendingFields`, `gateCopy`); `GET /b2b/org/:subdomain/consent-document/:optInId/:linkId?version=` | `POST /b2b/join`, `POST /b2b/consent`, `PATCH /b2b/membership` | loading, failed (closed), join, returning, submitting, stale wording, no documents, document missing/failed, offline |
| Contests | `GET /b2b/contest/list-contests` (no `status`; `contestName`, `description`, `contestStatus` + `opensAt`, `state`, `finalized`, `allowedBetEvents` with derived `status`, `prizeTiers`); `GET /b2b/board/my-boards` | none | loading, failed, Current empty, Past empty, not open yet, live, full (unknowable here), closed, finalized, joined, no prizes, no sponsors, trivia (never listed), paused, offline |
| Contest card | as Contests; banner (4b)*; `playerCount`*; live `providedBy`* | none | as Contests |
| Your boards | `GET /b2b/board/my-boards` row projection* (contest name, status, persisted bingos and points, cell states) | none | loading, failed, no boards, finalized, closed, props missing, paused, offline |
| Profile | `GET /b2b/membership` (`membership.displayName`, `.profileFields`, `.consents`, `.consentHistory`, `signupFields`; `optIns`*); consent document read with `?version=` | `PATCH /b2b/membership` `profileFields` (exists), `displayName`*; `POST /b2b/consent` (exists; accepts a re-decision) | loading, failed, save failed, no fields, platform opt-in only, re-worded opt-in (gate), paused, offline |
| Terms / Privacy | `GET /b2b/org/:subdomain/consent-document/overboard-terms/{terms,privacy}` | none | loading, not published, failed, offline |
| Tenant document | same read, tenant `optInId`/`linkId`; menu list* | none | loading, 404, failed, offline |
| Side menu | org; membership; Clerk email; document list* | Clerk sign-out | no tenant documents, signing out |
| Paused | org read (`suspended`, name, logo, theme, `text`*) | re-read org on focus, visibility, 60s | paused at load, mid-session, resumed, no logo |

\* **Phase B: to build.**

### 2. Mock elements (this spec's screens)

| Mock element | Fate | Reason |
|---|---|---|
| Home screen (`home.html`, `home-empty.html`: Live now, Open to join, Your boards rail, Coming up, Presented by band) | Cut | No home screen (W5-D01); `/contests` is the landing |
| Menu-only navigation, menu with "Home" first (`menu.html`) | Changed | Footer tab bar (W5-D01); menu per W5-D05 |
| Search field and filter chips Open / Upcoming / Live / Past, "12 contests" (`contests.html`) | Cut | W5-D02; Current/Past tabs; no search; no count from the server |
| Endless-scroll skeletons at list end | Cut | The endpoint isn't paged |
| "212 playing", "148 playing", "96 playing" on cards | Cut until Phase B | No player count on the fan wire (`numberParticipants` is dead data) |
| "Provided by {sponsor}" on cards | Changed | Only once the live list passes sponsor credits (Phase B) |
| "Top prize" line with the prize name only | Changed | Name plus the full description (4b ruling: no truncated prize description) |
| Card title from the contest name, games as a sub-line | Kept | W5-D39 |
| Two-letter team marks (CB, GB) and player initials | Cut | Logos when present, else names; photos, never initials (W5-D11) |
| Profile avatar disc with the initial "S" | Cut | Initials are cut everywhere; the header band carries the name |
| Profile "Your details" rows with Edit | Kept | `PATCH /b2b/membership` `profileFields` exists |
| Display name "Edit" | Changed | Phase B: the PATCH gains `displayName` |
| Consent cards with a switch on optional ones, lock on required, "Accepted on …" | Kept, extended | Version and "Shared with {Sponsor}" added (Wave 4 model); needs `optIns` (Phase B) |
| Profile "Your boards" section | Moved | Its own tab, `/boards` |
| Terms "Sample text…" callout and sample paragraphs (`terms.html`) | Cut | No placeholder legal text; unpublished shows "Overboard hasn't published this yet." |
| Paused screen copy | Kept | Matches today's `SuspendedScreen`, now Words-editable (Phase B) |
| Gate: "Already playing? Sign in" link; CTA → sign-up | Changed | Wave 4 flow: CTA → sign-in, which links to sign-up |
| Gate "Presented by Hometown Grill" wordmark | Kept (as data) | The real `signIn` sponsor's logo or tagline; absent when none |
| Gate next-game scorebug "Tip Sun 7:30 PM" | Kept | `nextGame` exists; no LIVE (no status on it) |
| Gate "Chicago Bears" h1 + giant "Bingo" | Kept | Tenant name from the API; BINGO fitted (`DECOR-31`) |
| Six code boxes (`sign-up.html`) | Changed | One six-digit input with OS fill (`FAN-23`) |
| Join form fields (First name, Phone (optional), Birthday) | Kept (as data) | Rendered from the tenant's `signupFields` |
| Barlow / Plex fonts; PREVIEW chyron; variant switcher | Cut | Satoshi only; mock chrome |
| `phone--read` 640px column for Terms | Cut | One 480px column |

The roll-up below adds every other spec's mock deviations.

### 3. Roll-up: every Wave 5 spec

| Spec | Screens / surfaces | New server work it needs (Phase B: to build) | Mock elements cut or changed (highlights; full lists in each spec) |
|---|---|---|---|
| This spec | Start, auth, gate, Contests, card, Your boards, Profile, documents, Paused, shell | `branding.text`; `organization.documents` (unless 4b ships a source); `optIns` and `displayName` on membership; `playerCount`; live sponsor credits on fan contest reads; the my-boards row projection | Home screen, menu-only nav, search and chips, player counts, initials, sample Terms text, Barlow/Plex |
| [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) | Contest detail, builder (pick players and Generate, which exists; pick lines yourself; edit), live board, prize popup, standings, results | Shared derived bingo function (4b), persisted by the evaluator; `props` on the contest read; `cells` on `POST /b2b/board/generate`; `PUT /b2b/board/:id/cells` (with `fill`); `GET /b2b/contest/:id/standings`; evaluator-written points; award `seenAt` and winner's `code`; generate pool filter; board-read contest projection | Card → builder, replace-confirm, "50-50" label, 68% spots bar, scores on scorebugs, yellow mini-board square, full-screen flash, value/shipping/pick-up, trivia card, SSE stream, Enter confirm |
| [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md) | The kit, shell, gallery | `decor { intensity, angle }` and `bingoGrid` on the theme contract; the palette's move to shared | Barlow/Plex, hard-coded palettes, initials, CSS confetti, mock text ramp |
| [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) | Brand v2 page and its preview | `text` on `PUT/GET /admin/branding`; theme `decor`; `host: "brand"` and the sample document (4b); `POST /admin/branding/sample-colours` for logo sampling | Font section, Sponsors tab, Phone/Desktop, peek toggle and "Peeking at", Club Level, Live as the fourth required-looking swatch, S2 upload route |
| [`fan-app-v2-console-touchpoints.spec.md`](fan-app-v2-console-touchpoints.spec.md) | Every console preview host and word tied to fan screens | `PreviewOverlay.branding` and `.membership`; console strings corrected | Desktop preview, S2 preview document sections, "and on Home" |

---

## Acceptance criteria

1. A signed-in fan opening `/`, `/sign-in`, `/sign-up`, `/forgot-password` or an unknown path lands on `/contests`; a signed-out fan on an unknown path lands on `/`.
2. A signed-out fan opening `/contest/abc` lands on `/?next=%2Fcontest%2Fabc`; after sign-in and the join gate they are on `/contest/abc` with no further navigation; a `next` of `//evil.example` or `/sign-in` is ignored.
3. `/dashboard` redirects to `/boards`; `/test-sign-in` does not exist.
4. The tab bar shows Contests, Your boards and Profile with icons and labels on those three screens, the live board and standings, and nowhere else; the active tab has the Team-ink icon, label and top hairline.
5. Scrolling down more than 12px beyond 64px hides the header and tab bar over 240ms; scrolling up 12px shows them; they never hide within 64px of the top; a route change, a sheet opening or keyboard focus in a bar shows them; content does not shift; with reduced motion the change is instant.
6. The side menu lists Contests, Your boards, Profile, Terms of Service, Privacy Policy, one row per tenant document, Sign out and "Powered by Overboard"; with no tenant documents it lists Terms and Privacy only; Terms is listed while unpublished and opens "Overboard hasn't published this yet."
7. The Contests tabs read "Current" and "Past"; a contest whose games are all under way and none final, and whose state is open, shows under Current with LIVE; an admin-closed contest shows under Past.
8. A contest card's title is the contest's console name; its description shows in full; its games are a sub-line with "+N more games"; tapping anywhere but "Open my board" opens `/contest/:id`, never the builder.
9. No card shows a player count or "Provided by" until the server sends them.
10. Your boards lists the fan's boards with mini-boards that have no live square, and bingo counts equal to the board screen's for the same board.
11. Profile shows the fan's display name, email, signup fields with values, and consent cards; an optional consent's switch records `declined` then `accepted` at the current version and shows "Updated."; a required consent has no control.
12. Opening a linked document from Profile shows the version the fan agreed to; Back returns to Profile.
13. With the tenant paused, every route shows the Paused screen with the tenant's words or the defaults; resuming lifts it on focus without a reload.
14. The five Words keys, set in Brand v2, change Start's tagline and button, the Current tab's empty text, and the Paused heading and body; blank values show the defaults; `{team}` expands.
15. No screen shows the word "Loading", a player's initials, a score, "Home", "My Boards", "Log Out" or any sample text.
16. Every screen reflows at 320px and 200% zoom without horizontal scroll; at 1280px the column is 480px and centred with the decorative sides.
17. With reduced motion on, nothing animates on any screen in this spec.

## Open questions

1. **Tenant document source for the menu.** Wave 4b owes the current app a list of tenant documents; the overhaul reuses it. If 4b builds none, is `organization.documents` on the public org read the right place (it is public data and already cached per tenant)?
2. **Withdrawing a required tenant opt-in.** Not offered (`FAN-41`). Confirm that the only way out of a blocking agreement stays "stop playing and ask for deletion".

## Recorded gaps

- **No player count on the fan wire.** "{n} playing" and the limit bar's count wait on `playerCount` (Phase B).
- **No paging on the fan contest list.** One request per tab returns every non-draft contest.
- **The next game on Start has no status**, so Start omits a game that has tipped off rather than show it live.
- **Tenant documents in the menu** wait on a source (4b or Phase B).
- **Profile's consent texts and display-name edit** wait on `optIns` and `displayName` (Phase B).
- **Words** wait on `branding.text` (Phase B); until then every tenant sees the defaults.
- **Mid-session pause** is noticed on the next org read or suspended refusal, not instantly.
- **`showPhotoUri`** is already honoured by today's board and draft cards (Wave 3, `photoOf` in `src/lib/board.ts`); W5-D11's "the current app ignores it" is stale (W5-D49); the fallback rule stands.

## Mocks

Visual direction only (`mocks\fanapp-v2\`, workspace): `gate.html` (Start), `sign-in.html`, `sign-up.html`, `join.html`, `contests.html`, `profile.html`, `menu.html`, `terms.html`, `paused.html`. `home.html` and `home-empty.html` are cut. Every deviation is in the function audit.

## References

- Rulings (workspace): `artifacts\review-2026-09-27\arthur-rulings-2026-09-27.md`, `arthur-rulings-wave4-walkthrough.md`; `artifacts\wave-2026-09-24\arthur-rulings-after-specs.md`.
- Decisions: `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` (W5-D01–D07, D24–D26, D33, D37, D39, D40, D49, D50).
- Research: `artifacts\review-2026-09-27\e2e-pes-fanapp.md`, `prizes-optins-specs.md`.
- Wave 4 specs (`arthur-w4-console`): [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md), [`entry-gate.spec.md`](entry-gate.spec.md), `admin-fields-and-optins.spec.md`, `admin-contests.spec.md`, `admin-prizes.spec.md`, `admin-sponsors.spec.md`. Main: [`end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md).
- Fan app (Wave 4 integration): `src/AppRoutes.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/components/layout/SideMenu.tsx`, `src/pages/contests/ContestsPage.tsx`, `src/pages/auth/{StartScreen,SignIn,SignUp,ForgotPassword,JoinTenant}.tsx`, `src/pages/legal/{LegalPage,legalPaths}.ts(x)`, `src/components/SuspendedScreen.tsx`, `src/context/TenantContext.tsx`, `src/store/api/{contestApi,sponsorApi,consentDocumentApi}.ts`, `src/lib/{board,contestView,storage}.ts`.
- Shared: `api/b2b/{contest,board,membership,consent,join,org,sponsors,consent-document}.ts`, `interfaces/b2b/{B2BContest,B2BBoard,B2BFanMembership,B2BOrganization,contestTypes}.ts`, `interfaces/reference/{BetEvent,BettingProp,Entity}.ts`, `entry-gate/copy.ts`.
- Backend: `node-server/src/handlers/contest/listB2BContests.ts`, `util/fan-contest-projection.ts`, `handlers/board/listB2BBoards.ts`.
