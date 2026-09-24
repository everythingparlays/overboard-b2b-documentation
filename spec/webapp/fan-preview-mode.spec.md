# Webapp Spec: Fan App Preview Mode

**Implements:** Arthur's unified-preview ruling (WAVE-RULES, "Brand gets simpler"): one preview, the real fan app running in a preview mode inside the console, with screens Gate, Join, Home, Contest, Board and Prize. D-068: nothing fabricated appears on a customer surface.

**Depends on:** the console-to-fan-app interface, `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md`, which defines the messages and the render document. [`styling.spec.md`](styling.spec.md) covers the theme contract and how a theme becomes CSS vars. [`entry-gate.spec.md`](entry-gate.spec.md) covers `EntryGateForm` and `resolveGateCopy`, which the Join screen renders. The screens themselves are defined by [`fan-app-v2.spec.md`](fan-app-v2.spec.md) and [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md); the decor and its defaults by [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md); the Brand page that hosts the frame by [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md). Build order: [`fan-app-v2-build-plan.md`](../../documents/HLDs/fan-app-v2-build-plan.md), slice f4.

**Status:** Draft (design wave 2026-09-24). S2 owns this spec. Nothing in it is built yet: today the fan app has no preview route, no `postMessage` handling and no way to override its config.

## Overview

The console needs to show an admin the fan app as their fans will see it, built from the draft they haven't published yet. Today it does this with likenesses rebuilt in console markup: `BrandPreviewPanel.tsx` on Brand and `GatePreviewPanel.tsx` on Fields. This spec replaces them with the fan app itself. The fan app serves a `/preview` route, the console frames it, and the console posts it the draft.

**The whole change, in one line:** `/preview` is the fan app with no session and no API, rendering its real screens from whatever the console posts, with honest sample data filling every gap and a PREVIEW chyron on every screen.

---

## What this supersedes, and why

Two existing rules forbid exactly this, and both need to be amended before it ships.

`admin-surface.spec.md`, Rule 12:

> A view of the fan product inside the console renders the fan product's own code, shared through `obs-b2b-shared` — never a likeness rebuilt in console markup, and never an embed of the live fan site. The console references the fan product; it does not host it, and it does not redraw it.

`admin-fields-and-optins.spec.md`, Live preview:

> **Rejected: an iframe of the live fan site.** PRODUCT.md holds that the console references the fan product and never embeds it, and three mechanical problems say the same thing: the iframe needs a *fan* session the admin does not have, it cannot bind to an unsaved draft because the fan app reads the server, and what it would therefore show is last publish's truth — the one thing the admin already knows.

Those rules were right about the live site. `/preview` is a different thing, and it answers each of the three objections:

| Objection | Answer |
|---|---|
| **Needs a fan session.** | `/preview` has no session. It branches off in `main.tsx` before `ClerkProvider` exists, holds no token and never signs anyone in. An admin with no fan account sees it the same as anyone else would. |
| **Can't show an unsaved draft.** | The draft reaches the frame by `postMessage`, not through the server. Every change to the draft sends a new `render`, and the frame repaints from it. Nothing is saved first. |
| **Shows only the last publish.** | `/preview` never calls the API, so it has no published state to show. It shows what the message says, plus sample fixtures for anything the message leaves out. |

The rule's purpose still holds. The admin sees the fan product's own code, not a redrawing of it: the same screen components, the same shared theme resolver, the same `EntryGateForm`. The "Rendered, not drawn" half of the Fan's-eye view principle is met more fully than before, because the whole screen is real, not just the gate.

**Proposed amendment to Rule 12** (for Arthur, through S1): "A view of the fan product inside the console renders the fan product's own code. That is either code shared through `obs-b2b-shared`, or the fan app's sessionless `/preview` route fed by the console's draft. It is never a likeness rebuilt in console markup, and never an embed of the live, signed-in fan site." The fields-and-optins "Rejected" entry gets a pointer to this spec. The PRODUCT.md line "references, never embeds" needs the same qualification.

---

## Scope

**In scope:**

- The `/preview` route: its entry point, its chunk, and its waiting, error and dev modes.
- The fan-app side of the protocol: listening, origin checks, replies.
- The render pipeline: theme, fonts, mode and decor inside the frame.
- The fixtures, with exact content.
- What each of the eight preview screens shows, with fixtures and with real data.
- The `frame-ancestors` header on `/preview`.

**Not in scope:**

- The console side: the frame, the switcher, the device toggle and building drafts. S1 owns these in section 5 of the interface file.
- Screens that aren't in the preview: sign-in, sign-up, verify, forgot password, contests list, profile, menu, terms, privacy.
- The pick sheet and the ladder. (The builder's grid is previewable through `sample.boardMode`; see Sample board.)
- The returning-fan mode of the gate.
- Live updates (SSE).
- The prize email preview, which stays a `srcDoc` iframe in the console.

---

## The route

**`/preview` is its own entry point.** The first thing `src/main.tsx` does is check `location.pathname`. If the path is `/preview`, it lazily imports the preview tree and renders that. It never reaches the Clerk publishable-key check, the hostname seed theme (`currentSeedTheme`), the Redux `store`, `ClerkProvider` or `TenantProvider`. Every other path runs the existing bootstrap unchanged.

**It is sessionless and offline from the backend:**

- No Clerk.
- No RTK Query and no API slice.
- No token.
- No request to `/b2b/*`.

The only network requests it makes are font stylesheets from the shared catalog and images whose URLs arrive in the render document.

**The hostname tenant is ignored.** On `bears.overboardsports.com/preview` the slug only chooses which host serves the page. Brand, copy and contest all come from the message. A frame on one tenant's host that is given another tenant's draft renders that draft.

**Own chunk.** The preview tree lives in its own lazily loaded chunk. The live app's bundle doesn't include preview code, and the preview's import graph doesn't include Clerk or the API slice.

**Waiting state.** Until the first valid `render` arrives, the page shows "Waiting for preview" in the platform default theme (`DEFAULT_THEME`), centred, with no tenant brand and no fan-app chrome. Anyone who opens `/preview` directly sees only this, indefinitely. That is correct.

**PREVIEW chyron.** Every screen shows a `Chyron` tag reading "PREVIEW" at the right end of the top bar (on screens without a top bar, the same top-right position), using the `neutral` variant, above all content including the prize popup and its Burst. It never overlaps any of the four sponsor artwork slots (sign-in logo, board banner, slider icon, prize popup logo), because the console's sponsor page shows that artwork at true size. It has no dismiss control, and nothing in the render document can turn it off.

**Router.** The preview tree wraps screens in an in-memory router, so components that render links and read route params still work. The browser URL stays `/preview`.

---

## The protocol

The interface file is the source of truth for message shapes. This is only a summary.

- **Fan app to console:**
  - `obs-preview:ready`: mounted and listening, with the `screens` this build supports.
  - `obs-preview:rendered`: `screen`, `height` and `mode`, after paint.
  - `obs-preview:error`: `message` and `screen`.
- **Console to fan app:**
  - `obs-preview:render`: the full render document.
  - `obs-preview:navigate`: `screen`.
  - `obs-preview:ping`: the fan app answers with `ready`.
- Every message carries `v: 1`.

**Full replace.** Every `render` replaces the previous one completely. There is no merge. A section present in the last render and absent from this one falls back to its fixture. Unknown fields and unknown `type`s are ignored. A known `type` with an unknown `v` gets an `error` reply and is not rendered.

**Screens.** `ready.screens` lists `gate`, `join`, `home`, `contest`, `board`, `prize`, `results` and `paused`, in that order.

---

## The render pipeline

On every `render`:

1. **Theme.** Call the existing `applyTheme(theme)` from `src/theme/apply.ts` on the frame's own `<html>`. It already removes vars the previous theme set and this one doesn't, which is what full replace needs.
2. **Fonts.** Call the existing `loadThemeFonts(theme)` from `src/theme/fonts.ts`. It injects catalog `<link>`s and skips any already present.
3. **Mode.** `next-themes` runs with `forcedTheme = theme.mode` and a preview-only `storageKey`, so it neither reads nor overwrites the live app's stored preference.
4. **Decor.** When `theme.decor` is absent, the preview uses the same defaults the live app uses. [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md) owns them: field `gridFragments`; band from the `motif.heroMotif` mapping, else `single`; intensity `0.6`. There is no preview-only default.
5. **Screen.** Render the requested screen's view component with props built from the document and the fixtures, then post `rendered`.

**Same views as the live routes.** Each preview screen renders the same presentational component its live route renders. The live route's container supplies props from Clerk and RTK Query, and the preview supplies them from the document. A screen whose view reaches for a data hook directly can't be previewed until it is split this way. The split is part of building each screen in this wave, not a preview-only fork. There is never a second copy of a screen for preview.

**Sponsor slots** go through the shared `resolveSponsorSlots`, the same function the live app uses. The preview has no placement logic of its own.

---

## Fixtures

Fixtures fill whatever the console doesn't send. Their content is fixed here so the console, the mocks and QA all expect the same frame.

### Tenant and fan

- **Tenant name:** always `brand.name` from the message. It is required, so there is no fixture tenant.
- **Logo:** `brand.logoUrl`. If it is absent, the tenant name is set in the display face.
- **Progress marker:** `brand.markerUrl` rides the Track on `board` and `prize`. If it is absent, the Track shows its Team puck with the count.
- **Fan display name:** `sample.fanDisplayName`, or "Sample Fan".
- **Brand text:** each of the five `brand.text` keys falls back to its platform default. `{team}` is replaced with `brand.name`.

### Gate (`gate` absent)

| Field | Requirement |
|---|---|
| Display name | Required |
| First name | Required |
| Last name | Required |
| Phone | Optional |
| Birthday | Optional |

There is one consent: "Overboard Terms & Privacy", required and locked, with the text "I agree to the Overboard Terms and Privacy Policy." This is the seeded default consent, per Arthur's ruling. It is not invented legal text. Gate copy falls back to the `resolveGateCopy` defaults.

### Sample contest (`contest` absent)

- **Name:** "Sample contest". **Type:** bingo. **Status:** OPEN. **Description:** none (the section is omitted).
- **Games:**

| Game | Matchup | Logos | Tip |
|---|---|---|---|
| 1 | Home Team vs Away Team | Initials tiles "HT", "AT" | Today, 7:30 PM (admin's local time) |
| 2 | Home Team vs Visiting Team | Initials tiles "HT", "VT" | Tomorrow, 7:30 PM |

Initials tiles are plain rounded squares: Second fill, on-colour initials. They carry no marks.

- **Players:**

| Player | Team | Position | Jersey |
|---|---|---|---|
| Sample Player 1 | Home Team | G | 1 |
| Sample Player 2 | Home Team | F | 2 |
| Sample Player 3 | Home Team | C | 3 |
| Sample Player 4 | Home Team | G | 4 |
| Sample Player 5 | Away Team | G | 5 |
| Sample Player 6 | Away Team | F | 6 |
| Sample Player 7 | Visiting Team | F | 7 |
| Sample Player 8 | Visiting Team | C | 8 |

Players have no photos. They use the product's no-photo fallback.

- **Prize tiers:**

| Tier | `prizeName` | `threeInARows` | Image | Description, claim, link | Provided by |
|---|---|---|---|---|---|
| 1 | Sample prize 1 | 1 | none (trophy glyph) | none | none |
| 2 | Sample prize 2 | 3 | none | none | none |
| 3 | Sample prize 3 | 8 | none | none | none |

### Sample board

The squares are numbered 1 to 9, reading left to right and top to bottom.

| Square | Player | Game | Line |
|---|---|---|---|
| 1 | Sample Player 1 | 1 | 20+ Points |
| 2 | Sample Player 5 | 1 | 6+ Assists |
| 3 | Sample Player 2 | 1 | 8+ Rebounds |
| 4 | Sample Player 7 | 2 | 15+ Points |
| 5 | Sample Player 3 | 1 | 10+ Rebounds |
| 6 | Sample Player 6 | 1 | 18+ Points |
| 7 | Sample Player 8 | 2 | 9+ Rebounds |
| 8 | Sample Player 4 | 2 | 3+ Three-pointers |
| 9 | Sample Player 1 | 1 | 5+ Assists |

**Hit squares by `bingosHit`** (default 3). Each set completes exactly N lines. The eight lines are three rows, three columns and two diagonals.

| `bingosHit` | Hit squares | Lines completed |
|---|---|---|
| 0 | 1, 5, 6 | none |
| 1 | 1, 2, 3, 5 | top row |
| 2 | 1, 2, 3, 5, 9 | top row, diagonal 1-5-9 |
| 3 | 1, 2, 3, 5, 7, 9 | top row, both diagonals |
| 4 | 1, 2, 3, 4, 5, 7, 9 | top row, both diagonals, left column |
| 5 | 1, 2, 3, 5, 7, 8, 9 | top and bottom rows, both diagonals, middle column |
| 6 | 1, 2, 3, 4, 5, 7, 8, 9 | top and bottom rows, left and middle columns, both diagonals |
| 7 | same as 6 | see below |
| 8 | all nine | all eight |

**Seven is impossible on a 3x3 board.** Leaving any one square empty breaks at least two lines, so the most you can complete with eight squares hit is six. `bingosHit: 7` renders the 6 row, and the counter reads 6. Values below 0 or above 8 are clamped first.

**Square states:**

- Hit squares are `hit`.
- Every other square is `live`, with its progress bar at half the line. For example, square 1 reads "10 / 20+".
- No square is `miss`, `locked` or `empty` in the fixture.
- The BingoLine overlay draws through each completed line.

**Board mode** (`sample.boardMode`, default `live`). `live` is everything above. `build` renders the board builder's view instead: squares 1 to 5 of the sample board filled, squares 6 to 9 empty, the count chyron "5 OF 9", the helper "Empty squares can't hit" and an enabled "Enter contest". No sheet is open, and `bingosHit` is ignored. Only `board` reads it; `prize` always opens over the `live` board.

### Sample award (`prize`)

The tier is chosen in this order:

1. `sample.prizeTierIndex`, if it is in range.
2. Otherwise, the highest tier whose `threeInARows` is at most the effective `bingosHit`.
3. Otherwise, the lowest tier.

The popup shows the tier chyron ("TIER 2 · 3 BINGOS"), the tier name, and whatever the tier carries. From the fixture that is just the name, the trophy glyph and "Got it". The fixture award has no email-sent record, so the popup says nothing about email.

### Sample standings (`results`)

The sample shows a final state with a podium. The total is "340 playing". The rows are fixed. `bingosHit` doesn't steer them.

| Rank | Name | Bingos |
|---|---|---|
| 1 | Fan 1 | 6 |
| 2 | Fan 2 | 5 |
| 3 | Fan 3 | 5 |
| 4 to 7 | Fan 4 to Fan 7 | 4 |
| 8 to 11 | Fan 8 to Fan 11 | 3 |
| 12 | the fan (highlighted "You") | 3 |

- Each row's mini 3x3 uses the sample-board row for its bingo count.
- The list ends after row 12. The preview doesn't scroll on to 340 rows.
- The "Your result" card shows the tier the fan reached with 3 bingos: Sample prize 2, or the real tier that 3 bingos reaches.
- Every row carries points, in round hundreds falling with rank, so no two rows tie: standings rank by bingos, then points ([`fan-contest-flow.spec.md`](fan-contest-flow.spec.md), FLOW-33), and the ranks above are therefore distinct. The points column shows only if the live product displays points (open, Arthur).

### Paused

The paused screen shows `pausedHeading` and `pausedBody` from `brand.text`, or their defaults: "Taking a quick break" and "{team} Bingo is paused right now. Your account and anything you've earned are safe. Check back soon." The frame shows DecorField at 0.3 intensity and the logo.

---

## Each screen

Every screen shows the PREVIEW chyron.

- **gate**
  - Shows the logo or name, the HeroBand "{brand.name} BINGO", `startTagline` and `startCta`, and the "Already playing? Sign in" link.
  - Scorebug: the first game of the contest, detail "TIP 7:30 PM", or the real tip time for a real contest.
  - "Presented by" appears only when a `signIn` placement resolves.
- **join**
  - Renders `EntryGateForm` in join mode, from `gate` or the fixture gate, with `gate.gateCopy` applied through `resolveGateCopy`.
  - Inputs accept typing locally. Submit does nothing.
- **home**
  - Greeting eyebrow: "GAME DAY · {fan name}".
  - One "Open to join" banner card for the contest, with a status chyron, games, and a top-prize line.
  - "Presented by" band only when a `signIn` placement resolves.
  - No LIVE NOW card, "Your boards" rail or "Coming up".
  - With `sample.homeEmpty: true`, Home shows its empty state instead of the contest card: "Nothing on the schedule yet" and `homeEmpty` from `brand.text` (or its default).
- **contest**
  - The contest detail in its open, not-joined state: HeroBand, status chyron, description (omitted when empty), scorebug rows, prize ladder, "How to play", and the "Build my board" button.
- **board**
  - The live board with the sample board. Scorebugs read "LIVE" with no score.
  - The counter and Track come from the effective `bingosHit`.
  - The sponsor banner appears only when a `boardBanner` placement resolves, then the standings row "Standings: you're 12th of 340".
  - With `sample.boardMode: 'build'`, the builder view from the Sample board section.
- **prize**
  - The board screen with the prize popup open over it, using the sample award.
- **results**
  - Final standings from the sample standings, with the "FINAL" chyron.
  - Scorebugs, where shown, read "FINAL".
- **paused**
  - As described in the Fixtures section above.

**With a real `contest`:**

- **Rendered as sent:** the real name, description, games (teams, logos, tip times) and prize tiers (names, images, descriptions, claim text, "Provided by"). Sponsor placements come from `sponsors`.
- **Field names during S1's contest-model transition:** the type is `contestType ?? gameType`, the description is `description ?? contestDescription`, and a tier's "Provided by" credit on the prize popup is the sponsor named by `providedBySponsorId`, looked up in `sponsors.sponsors` (there is no `prizePopup` placement). `prizeType` is accepted and not read in v1.
- **Always sample:**
  - Players. The prop pool isn't on the wire. On real games they are spread across the real teams, still named "Sample Player N", with no photo.
  - The board's hit pattern and the standings.
  - The fan's name, unless `sample.fanDisplayName` is sent.
- **Trivia:** a trivia contest (`contestType ?? gameType` is `'trivia'`) shows the contest screen with the temporary card: "Trivia is on its way. This contest opens when it's ready." It has no join button. Asked for `board` or `prize`, the frame renders `contest` instead and says so in `rendered.screen`.

---

## Honesty rules

These rules apply D-068 to the preview.

- **No real people in fixtures.** No real athletes, no real team names or marks, and no real fans' names or boards, ever.
- **No invented scores.** Scorebugs show "TIP 7:30 PM", "LIVE" or "FINAL", and never a score, even a sample one.
- **Nothing narrates that it's a sample.** The PREVIEW chyron and the sample names do that job, and nothing else does. There are no captions such as "this is sample data", no watermarks across content, and no explanatory banners. (The console's Rule 13 applies the same no-narration rule to the console.)
- **Absent means absent.** A missing sponsor, prize image, description or claim instruction is simply left out. No labelled placeholder takes its place.
- **Nothing a fan does happens.** No join, consent, board write, award-seen mark or analytics event is sent from the preview.

---

## Interaction and motion

**Taps stay inside the frame.** Buttons and links show their press states and do nothing else. A tap never navigates, so the console's switcher is always the truth about which screen is showing. Form inputs on `join` accept typing, which is local and discarded on the next `render`.

**Celebration runs on `prize`.** When the frame arrives at the prize screen, whether by `navigate` or by a `render` whose previous screen was different, it plays everything the live product plays: the Burst scale-in, confetti in Team, Second and Accent, and the Team flash when glow is 0.5 or more. It does not replay on `render`s that keep `screen: 'prize'`. That way an admin dragging a colour on the prize screen gets a recoloured popup, not confetti ten times a second. Arriving at `board` draws the BingoLine overlays once, in the same way.

**Reduced motion wins.** The frame follows the admin's `prefers-reduced-motion`. When it is set, there is no Burst motion, confetti, flash or line draw-in. The static end states are shown.

---

## Security

- **Origin allowlist.** `VITE_PREVIEW_PARENT_ORIGINS` is a comma-separated list of exact origins. Prod is `https://admin.overboardsports.com`. Dev is `http://localhost:5223,http://localhost:5224`. A message from any other origin is dropped silently. It gets no reply and no `error`.
- **Never post to `*`.** Until the first valid message arrives, `ready` is posted once per allowlisted origin, and the browser drops the ones that don't match. After that, the frame posts only to the origin that spoke.
- **Framing header on `/preview` only**, added as a `headers` entry in `vercel.json`: `Content-Security-Policy: frame-ancestors 'self' https://admin.overboardsports.com http://localhost:*`. Other paths keep today's headers. Whether live routes should refuse framing is a separate question.
- **No `sandbox`** on the console's iframe. The origin checks do that job, and the frame has nothing to protect: no credentials and no data.
- **No credentials, no storage.** The route never reads or writes Clerk state, API caches, drafts or any other app storage. `next-themes` uses a preview-only key.
- **Text only.** Nothing from the render document is rendered as HTML. Descriptions render as plain paragraphs, as they do live. URLs from the document are used only as image sources and must be `https:` (or `http://localhost` in dev builds).
- **Backend CORS is untouched.** The route never calls the backend.

---

## Performance

- **Chunk budget.** Preview-only code (entry, message handling, fixtures, the preview shell) stays under 30 KB gzipped. Screen code is shared with the live app's chunks. The preview graph never includes Clerk or the API slice, and a bundle check in CI confirms that.
- **First render:** within 300 ms of receiving the first `render`, once the chunk has loaded. Fonts may swap in afterwards.
- **Later renders:** a re-render for a colour change commits within 50 ms, so a debounced drag keeps up.
- **`rendered` timing:** posted after the frame that follows commit (two `requestAnimationFrame`s), so `height` is measured on painted layout. After that, a `ResizeObserver` on the screen root re-posts `rendered` when the height changes, for example when fonts arrive, at most once per animation frame.

---

## Accessibility

- **Frame label.** The console gives the iframe `title="Fan app preview"` and `aria-label="Fan app preview"`. (The console sets this; the value is recorded here so both sides use the same wording.)
- **No focus stealing.** The preview never moves focus on mount or on `render`. It has no `autofocus` and makes no `focus()` calls, so the admin's focus stays on the console control they're using. Focus enters the frame only when the admin clicks or tabs into it. Once inside, the screens' own keyboard behaviour applies.
- **Screen accessibility.** Everything the live screens specify applies unchanged: contrast, labelled squares, the grid role, and the polite live region.

---

## Dev workflow

In dev builds only (`import.meta.env.DEV`), opening `http://localhost:5324/preview?dev=1` (or `:5323` for S1) loads the fixtures without a parent frame. It renders a fixture document with the Prime Time preset and `brand.name` "Sample Team". Query parameters steer it: `screen`, `mode` (`light` or `dark`), `bingos` (0 to 8) and `tier`. This is for building and checking screens without the console. In production builds `?dev=1` is ignored and the route stays in its waiting state.

---

## Rules

- **PREV-01.** `/preview` branches off in `main.tsx` before the Clerk key check, the seed theme, the store and `ClerkProvider`, and loads as its own lazy chunk.
- **PREV-02.** The preview makes no backend request and holds no token. Its only network requests are catalog fonts and document image URLs.
- **PREV-03.** The hostname tenant is ignored. Everything comes from the render document or fixtures.
- **PREV-04.** Before the first valid `render`, the route shows only the neutral "Waiting for preview" state.
- **PREV-05.** Every screen carries the PREVIEW chyron at the top bar's right end, above all content, never overlapping a sponsor artwork slot, and it cannot be removed.
- **PREV-06.** Every `render` fully replaces the last. An absent section falls back to its fixture.
- **PREV-07.** The theme applies through `applyTheme`, fonts through `loadThemeFonts`, and mode through `next-themes` `forcedTheme`. Decor defaults are the live app's.
- **PREV-08.** Each preview screen renders the live route's own view component. There is no preview-only copy of any screen.
- **PREV-09.** Fixture content is exactly what the Fixtures section lists, including the board table.
- **PREV-10.** Real data from the document renders as sent. Players, board hits and standings are always sample.
- **PREV-11.** Fixtures contain no real athletes, team marks, fans or scores. Nothing in the frame narrates sampleness.
- **PREV-12.** Interactions are local. No tap navigates, and no write or analytics event leaves the frame.
- **PREV-13.** The celebration plays on arriving at `prize`, not on re-renders there. Reduced motion suppresses it.
- **PREV-14.** Inbound messages are accepted only from `VITE_PREVIEW_PARENT_ORIGINS`. Outbound messages are never posted to `*`.
- **PREV-15.** `frame-ancestors` is set on `/preview` only, via `vercel.json`.
- **PREV-16.** The route reads and writes no app storage and holds no credentials.
- **PREV-17.** Document strings render as text, never as HTML. Document URLs are image sources only.
- **PREV-18.** The performance budgets in the Performance section hold: 30 KB preview-only code, 300 ms first render, 50 ms re-render.
- **PREV-19.** `rendered` follows paint, and follows every later height change.
- **PREV-20.** The preview never takes focus on its own.
- **PREV-21.** `?dev=1` works in dev builds only.
- **PREV-22.** A trivia contest renders the contest screen's temporary card in place of `board` and `prize`.

---

## Acceptance criteria

- [ ] Opening `/preview` with no parent shows "Waiting for preview" and nothing else. Opening it in a production build with `?dev=1` changes nothing.
- [ ] The network panel for a preview session shows no `/b2b/*` request and no Clerk script.
- [ ] The live app's main bundle contains no preview code. The preview chunk graph contains no Clerk.
- [ ] A `render` from an allowlisted origin paints the requested screen, and `rendered` arrives with the correct `screen`, `mode` and a `height` matching the painted content.
- [ ] A `render` from any other origin is ignored with no reply.
- [ ] Changing only `theme.colors.primary` across successive renders recolours the frame with no stale vars left from the previous theme, and without a reload.
- [ ] A `render` without `contest` shows "Sample contest" with the two sample games, the sample players and the three sample tiers, exactly as listed.
- [ ] For each `bingosHit` from 0 to 8, the board hits the listed squares, the counter reads the listed count (6 for 7), and the listed lines are drawn.
- [ ] `bingosHit: 12` renders as 8. `prizeTierIndex: 9` with `bingosHit: 3` shows the highest tier reached at 3.
- [ ] A `render` without `gate` shows the fixture fields and the locked "Overboard Terms & Privacy" consent with its seeded text.
- [ ] A `render` without `sponsors` shows no sponsor anywhere and no empty slot marker.
- [ ] A real `contest` shows its real name, games and tiers, with sample players still named "Sample Player N".
- [ ] No scorebug ever shows a score.
- [ ] The PREVIEW chyron is visible on all eight screens and above the prize popup, and on `gate`, `board` and `prize` with every sponsor slot filled it overlaps none of the sponsor artwork.
- [ ] `sample.boardMode: 'build'` on `board` shows the builder with squares 1 to 5 filled and "5 OF 9"; absent or `'live'` shows the live board.
- [ ] `sample.homeEmpty: true` on `home` shows "Nothing on the schedule yet" with the `homeEmpty` text.
- [ ] Taps inside the frame don't change the screen. `rendered.screen` always matches the last `render` or `navigate`, except for the trivia redirect.
- [ ] Arriving at `prize` plays the celebration once. Ten further renders at `prize` don't replay it. With reduced motion on, it never plays.
- [ ] Rendering and switching screens never moves focus out of the console control in use.
- [ ] The `/preview` response carries the `frame-ancestors` header. `/` does not gain one.

---

## Open questions

- **S1's agreement on three rulings.** The interface file's reconciliation table still shows three S2 rulings as unresolved on S1's side: real player names through `contest.players` in place of S1's prop-pool board, no in-frame navigation, and the `device` field name. This spec is written to S2's rulings. It changes if Arthur or the seats rule otherwise.
- **Points on standings** (open, Arthur; see [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md), open question 1). The preview follows whatever the live product decides.

---

## Recorded gaps

- **Seven-bingo tiers can't be won.** `B2BPrizeTier.threeInARows` accepts 1 to 8, but a 3x3 board completes 0 to 6 or 8 lines, never 7. The console should refuse a tier at 7. This is flagged to S1 and the backend. The preview renders 7 as 6.
- **`branding.text` doesn't exist yet.** It is served on `GET /b2b/org/:slug`. The preview reads `brand.text` from the message, so it doesn't wait on this, but the live screens do.
- **`decor` isn't in `ThemeSettings` yet.** Until it is added, `theme.decor` is always absent and the defaults apply.
- **No `frame-ancestors` today.** `vercel.json` has only rewrites.
- **Not previewable in v1:** the returning-fan gate, the pick sheet and the ladder.
- **Retiring the likenesses.** `BrandPreviewPanel.tsx`, `GatePreviewPanel.tsx` and the shared `EntryGatePreview` can go once the frame lands (proposed; S1 confirms in the interface file, section 6).

---

## Mocks

- `mocks/fanapp-v2/` (workspace). Every screen mock takes `?preview=1`, which shows the PREVIEW chyron at the top bar's right end as the frame renders it. Without the parameter they show the live product.
- `mocks/fanapp-v2/brand-v2.html`. The Brand v2 page with the unified preview frame in place: sticky, phone-sized, with the screen switcher, the Light/Dark peek and the Phone/Desktop toggle.

These are proposals to react to, not builds to copy.

---

## References

- `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md`: the message and render-document contract
- [`fan-app-v2.spec.md`](fan-app-v2.spec.md): the gate, join, home, contest and paused screens, and the curated text
- [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md): the board, builder, prize popup and standings screens, and the ranking rule
- [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md): the decor kit and its defaults
- [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md): the Brand page, the main host of the frame
- [`fan-app-v2-build-plan.md`](../../documents/HLDs/fan-app-v2-build-plan.md): slice f4 builds this spec
- [`admin-surface.spec.md`](../core-modules/1-draft/admin-surface.spec.md): Fan's-eye view, Rule 12 (amended above), Rule 13
- [`admin-fields-and-optins.spec.md`](../core-modules/1-draft/admin-fields-and-optins.spec.md): Live preview, "Rejected: an iframe of the live fan site"
- [`entry-gate.spec.md`](entry-gate.spec.md): `EntryGateForm`, `resolveGateCopy`
- [`styling.spec.md`](styling.spec.md): theme contract, `applyTheme`, fonts, decor defaults
- `obs-b2b-shared`: `theme/resolve.ts` (`themeToCssVars`, `DEFAULT_THEME`), `interfaces/b2b/B2BSponsor.ts` (`resolveSponsorSlots`), `interfaces/b2b/B2BPrizeTiers.ts` (`threeInARows`)
- `overboard-b2b-template`: `src/main.tsx`, `src/theme/apply.ts`, `src/theme/fonts.ts`, `vercel.json`
