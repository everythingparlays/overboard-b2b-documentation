# Webapp Spec: The Prize Sheet — one sheet for every prize a fan reads or wins

**Implements:** Arthur's 2026-10-03 rulings on the prize sheet: one prize sheet for bingo and trivia, with an **info** body (what a tier or band pays) and a **won** body (the fan's own award); several prizes are one sheet the fan swipes through; "seen" is kept on the server, never in the browser; a contest card keeps "Prize won" with "See your prize"; every bingo tier a board reaches pays, and the app says so. PRD §1 fan flow, `PRIZE-01` (the in-app half); PRD changes, entries 36 (the winner sees the code in the app) and 37 (bingo tiers are cumulative) ([`PRD-changes-contributed-by-Arthur.md`](../../documents/PRD/PRD-changes-contributed-by-Arthur.md)).

**Depends on:** [`../core-modules/1-draft/end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md) (server awards on the board read, §1.5), [`../core-modules/1-draft/admin-prizes.spec.md`](../core-modules/1-draft/admin-prizes.spec.md) (the prize library, the award snapshot, the code, `PZ-05`, `PZ-23`), [`../core-modules/1-draft/prize-delivery.spec.md`](../core-modules/1-draft/prize-delivery.spec.md) (the prize rows the awards read is built from, their status and `seenAt`), [`../features/1-draft/trivia-game-type.spec.md`](../features/1-draft/trivia-game-type.spec.md) (trivia's Rules, Standings, Complete and card), [`../core-modules/1-draft/admin-sponsors.spec.md`](../core-modules/1-draft/admin-sponsors.spec.md) (a prize's "Provided by" sponsor, D-124), [`styling.spec.md`](styling.spec.md) (the tenant's tokens). The console previews the sheet: [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) ("The Prize screen") and [`../core-modules/1-draft/admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md) (the Info / Won control).

**Supersedes:** in the fan app on main (`overboard-b2b-template`), the centred bingo popup (`PrizeModal`), trivia's own prize sheet (`PrizeDetailSheet`), the bingo board's inline tier panel, and the `localStorage` marks that remembered which awards had been shown.

**Status:** Draft, 2026-10-03; built on main the same day (fan app `src/components/prize/`, backend `routes/prizes/`). Revised 2026-10-06: the claim button is a real link that opens in a new tab, and the contest card's own control is a stretched title button ("Prize won", Accessibility). The requirements keep the ids they were first written under (`FLOW-31`, `FLOW-51`–`FLOW-53`) in the Wave 5 fan app overhaul's contest-flow spec, which was never merged and whose spec was removed on 2026-10-03; only the prize sheet's part of it is carried here, rewritten for the fan app that shipped. The overhaul's other screens (its contest detail page, square builder, bingo standings and results, and their "Your result" card, `FLOW-37`) were never built and are not described.

Repos are named by their roots: shared `obs-b2b-shared/src`, backend `node-server/src` (in `overboard_sports_backend`), fan app `overboard-b2b-template/src`.

## Overview

A fan meets a prize in two ways: reading what a tier or band pays before winning it, and learning that they won it. Both are the same bottom sheet (`components/prize/PrizeSheet.tsx`), opened by one host mounted once around the signed-in app (`components/prize/PrizeSheetHost.tsx`, in `App.tsx`). Screens ask the host for the info body (a tap) or the won body ("See your prize"); on its own the host opens the won body over every award the fan hasn't seen, read from the server, so a win is shown once on whichever device the fan uses next, including a trivia win that lands at Finalize after the fan has left.

**In scope:** the sheet's shell and both bodies; when it opens and what closing it records; the cards' "Prize won"; the cumulative-tiers line; the bingo board's and trivia screens' entry points; the two prize routes and the fan reads' prize fields.

**Not in scope:** delivering the prize (the prize worker and the email, [`prize-delivery.spec.md`](../core-modules/1-draft/prize-delivery.spec.md)); the console's prize page and preview controls ([`admin-prizes.spec.md`](../core-modules/1-draft/admin-prizes.spec.md), [`admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md)).

---

## The prize sheet (`FLOW-31`)

**`FLOW-31` — One prize sheet, two bodies, for both games.** `components/prize/PrizeSheet.tsx` is the one place the fan app shows a prize: the **info** body says what a tier or band pays, the **won** body is the fan's own award. Same shell, same card layout; only one sheet is open at a time. The sheet only draws: who opens it, and what closing it means, is the host's.

### The shell

- **A bottom sheet** bounded to the app column (the column's width, centred), with rounded top corners, at most 85% of the screen tall; its content scrolls inside it, and its bottom padding clears the phone's safe area. Built on shadcn's Drawer (Vaul), so it has Radix dialog semantics: it renders in a portal, locks the page's scroll, moves focus in and traps it, closes on Escape and returns focus to what opened it.
- **Closing:** dragging it down (a quick flick is enough; a scroll inside the content is a scroll, not a drag), tapping the backdrop, Escape, the close button (an X in a round bordered button at the top right, accessible name "Close"), or "Got it". A grab handle at the top shows it can be dragged.
- **Themed by the tenant's tokens only** (D-103): the sheet is the card surface with the card's text and border colours, the backdrop the theme's background at 70%, the handle the muted text colour. No hex value, no literal colour, no `dark:` variant.
- **Motion:** it slides up in about 380ms on the drawer's own easing. Under reduced motion it appears without sliding (the app's global reduced-motion floor); dragging still works, because moving it with a finger is direct manipulation, not animation.
- **Named:** the sheet always has a title and an off-screen description ("Prize details"). With one card the title is the prize's name; with several it is the header above the cards ("You won {n} prizes" for won, "Prizes" for info).
- **The preview's hook:** while open, the sheet's content carries `data-prize-modal`, and it is unmounted when closed. The console preview's Prize screen ends when it goes ([`fan-preview-mode.spec.md`](fan-preview-mode.spec.md), "The Prize screen").

### Several prizes: one sheet you swipe through

With two or more items the cards sit in a carousel (shadcn's Carousel, Embla): one full card per slide. The dots (the current one wider and in the text colour; each a button named "Show prize {n}") and the round previous and next buttons ("Previous prize", "Next prize") sit in the sheet's fixed footer, above "Got it", so they show on first view without scrolling; the previous and next buttons show only for a pointer that can hover. The carousel is named by the header, and each slide is named "Prize 2 of 3". A sideways swipe on the cards never moves the sheet; it is still dismissed from the handle, the header, the dots and the footer, or by Escape, the backdrop or "Got it". With one item there is no carousel and the whole sheet drags.

A board that passes several tiers at once, or a fan who comes back to several unseen wins, gets one sheet with every award in it, oldest first: never a queue of popups.

### The info body (a tier or a band, from a tap)

Top to bottom, each part only when its data is there:

| Part | Content | Source |
|---|---|---|
| Chip | Bingo: "{N} bingo" / "{N} bingos". Trivia: the band's places, "11th–30th" (`formatBandRange`). A neutral pill on the raised surface. A library prize on its own (the console's prize page) has no chip | the tier's threshold; the band's `from`–`to` |
| Title | The prize's name, large, in the tenant's display face (below) | `prizeName` |
| Image | The prize image in a wide 2:1 box, rounded, bordered, cover-cropped. Shown only when set and loaded: a failed load drops it; there is no placeholder | `prizeImageUrl` |
| Description | In full | `prizeDescription` |
| Email line | A mail icon and one line, by game and code (table below) | the contest's type; the prize's `hasCode` |
| Provided by | The prize's own sponsor (`PrizeSponsor`, below); nothing when the prize has none. Never the contest's Presented by sponsor (D-124) | the prize's `providedBy` |
| Progress strip | Only while the contest still pays (table below) | the board read (bingo); `me` or the standings (trivia) |
| "Got it" | The primary button, full width; closes the sheet | — |

**Email line (info):**

| Game | Prize without a code | Prize with a code |
|---|---|---|
| Bingo | "Winners get this by email as soon as their board reaches it." | "Winners get this by email, with a code, as soon as their board reaches it." |
| Trivia | "Winners get this by email once results are final." | "Winners get this by email, with a code, once results are final." |
| A library prize on its own (console preview only) | "Winners get this by email." | "Winners get this by email, with a code." |

**Progress strip** (a bordered row on the raised surface, the fan's position on the left and the gap on the right in bold):

| Game | Shown while | Left | Right |
|---|---|---|---|
| Bingo | the board isn't settled and the contest is neither finished nor awaiting results | "Your board: {b} bingo" / "{b} bingos" | "+{N − b} to win" in the primary colour while b < N; "Won" in the success colour once b ≥ N |
| Trivia | results aren't final, and the fan has a score | "Your best: 3,120 · #212" | "+290 to reach 11th–30th" in the primary colour, or "You're in" in the success colour (`classifyTier`, `statusCopy`) |

A trivia fan with no score yet sees no strip.

### The won body (the fan's own award)

| Part | Content | Source |
|---|---|---|
| Chip | "You won", in the primary colour | — |
| Title, image, description | As in the info body | `award.prize` |
| Claim instructions | Under the description | `award.prize.prizeClaimInstructions` |
| Your code | A box on the raised surface: the label "Your code", the code large in the numeric face (selectable as a whole), and a **Copy** button that reads "Copied" with a check for 1.5 seconds. Copying falls back to a hidden text field where the clipboard API is missing or refused | `award.prize.code`: the prize's static code, on the winner's own award only (PRD changes, entry 36) |
| Delivery line | A mail icon and one line, by the award's status (table below) | `award.status`; the session's primary email |
| Provided by | The credit the award recorded (the snapshot's), as in the info body | `award.prize.providedBy` |
| Buttons | With a claim link: the primary, full width, labelled with the prize's button text ("Claim your prize" when it has none), and an outline "Got it" under it. The claim button is a real link (`<a>` styled as the button) that opens the prize's page in a new tab with `rel="noopener noreferrer"` (`OUTBOUND_LINK`), so middle-click and long-press work and the app stays where the fan left it; the same click closes the sheet, marking the award seen. Its accessible name adds "(opens in a new tab)". In the console preview links are inert (`PREV-12`): the click is stopped (`externalLinksInert()`) and the sheet still closes. *(Until 2026-10-06 it closed the sheet and then sent the whole app to the link in the same tab.)* Without one: a primary "Got it" | `prizeClaimButtonLinkUrl`, `prizeClaimButtonText` |

**Delivery line (won).** `{email}` is the signed-in fan's primary email; "your email" when the session has none.

| `status` | Line |
|---|---|
| `pending` | "We're emailing the details to {email}." |
| `fulfilled` | "We've emailed the details to {email}." |
| `failed` | "The email to {email} didn't go through." |

Nothing more is said about a failed email: no retry is promised. The code in the sheet is the winner's fallback.

### Shared rules for both bodies

- **The title follows the brand.** It is an `h2` that takes the tenant's display face, transform and weight from the theme (`--font-display`, `--display-transform`, `--display-weight`). Nothing forces uppercase: a brand that sets uppercase gets uppercase titles, one that doesn't gets the name as typed. No "!" is added to the name.
- **The credit is the prize's own** (D-124). `PrizeSponsor` (`components/sponsor/PrizeSponsor.tsx`) shows the eyebrow "Provided by", the sponsor's prize logo on a white plate whatever the theme, inside a fixed 4:1 box (the logo contained in it, never cropped or stretched), "Visit {name}" with an outbound arrow when the sponsor has a website (opened outside the app), and the sponsor's name in place of the logo when it has none or it fails to load. The contest's Presented by sponsor never appears in the sheet.
- **Cut** (D-086): approximate value, redemption method, location and window, shipping and type. No tiles for them.
- **Code security.** The code is read only from the fan's own awards (`GET /b2b/prizes/awards`, which requires the fan's session and returns only their awards). Tier and band reads, lists, the preview and standings carry only `hasCode`, never the code. The sheet builds what it shows field by field (`fanPrizeOf`, `components/prize/prizeItems.ts`), so a tier or band never hands it a code or a server-only field.
- **Copy** is the tenant's prize content and the strings above; no spec ids, no jargon.

## When it opens (`FLOW-51`)

- **A tap always opens the info body:** a tier label on the bingo board's prize track (`pages/board/BoardPage.tsx`; the inline tier panel under the track, and its "No prize details available yet.", are removed); a prize row on a trivia contest's Rules screen; a band on trivia Standings. The sheet shows that tier or band, with the fan's progress when known. Nothing is stored or sent.
- **The won body opens by itself** the next time the fan is in the app after any win they haven't seen. `PrizeSheetHost` reads `GET /b2b/prizes/awards` on mount, again when the app regains focus, and every 30 seconds while the app is in view, for a signed-in member only. When any award has no `seenAt` and no other sheet is open, it opens the won body over the unseen awards, oldest first (by `awardedAt`). It waits while a trivia run's question screen is up (`useHoldPrizeSheet` on `TriviaPlayPage`) and opens once the fan leaves it. Because it is server-side it works across devices, and it catches trivia wins, which land at Finalize, after the fan has left.
- **The bingo board hurries it.** The board read is what makes the server record a win (its reconciler runs on the read), so when the board read's `awards` grow between polls, the board asks the host to re-read the awards at once rather than on their next poll. A line the shared count shows complete opens no won sheet until the server has recorded the award.
- **Seen.** Closing the won sheet by any route (drag, Escape, backdrop, X, "Got it", the claim button) marks every unseen award it showed as seen: one `POST /b2b/prizes/awards/:awardId/seen` per award, with the awards cache updated at once (`seenAt` = now), so the sheet never reopens while the call is in flight. The call is idempotent. Closing by the claim button records the award as seen like any other route, since the link opens in a new tab and the app stays; the call is also sent with `keepalive`, so it lands even if the fan closes the tab straight after. Nothing about a prize is kept in `localStorage`.
- **The celebration** plays only when the won sheet opens over unseen awards: confetti in the theme's confetti colours (`celebrationProfile`, `resolveTheme(theme).colors.confetti`), drawn above the sheet, and, when the theme's celebration profile calls for it, a 600ms veil in the team colour (`--team-soft`). It plays once per set of awards, never on a re-render, and never under reduced motion (off, not dimmed). Re-opening awards already seen never celebrates.

## "Prize won" on the contest card (`FLOW-52`)

A contest card (bingo and trivia) with at least one award for this fan offers a quiet action **"See your prize"** ("See your prizes" with several) that opens the won sheet over that contest's awards, oldest first, without celebration, and shows a **"Prize won"** status in the success tone. The Contests page reads the fan's awards once (`GET /b2b/prizes/awards`, the host's cached read) and hands each card its own, grouped by `contestId`; a card never infers a win from a count.

- **Bingo** (`components/contests/BingoContestCard.tsx`): "Prize won" in every phase but Live. While a game is in play the status stays "Live", the time-critical signal; the card still offers "See your prize". Once final, the line names every award: "Final · 3 bingos · 3 prizes won", or "· {prize name} won" with one. It never names only the highest tier.
- **Trivia** (`components/contests/TriviaContestCard.tsx`): "Prize won" in every phase, for any delivery status, beating every other state: "You won {prize name}" ("You won {n} prizes" with several), "See your prize", and a quiet "See results". It replaces "Prize sent" and its "Claim your prize" button, which showed only once the email was sent.

## Every tier reached pays (`FLOW-53`)

A bingo board wins every tier it reaches: with tiers at 1, 2 and 3 bingos, 3 bingos wins three prizes and sends three emails (PRD changes, entry 37; [`admin-prizes.spec.md`](../core-modules/1-draft/admin-prizes.spec.md) `PZ-23`). The fan app says it plainly where tiers are explained:

- **The contest's draft page** (`pages/contests/ContestPage.tsx`), under its tiers when there are more than one, in one line over the contest's own thresholds: "Every tier you reach pays: 3 bingos wins the 1-, 2- and 3-bingo prizes."
- **How to play** (`pages/help/HowToPlayPage.tsx`), in the bingo section, the same sentence.
- **The card's progress copy** reads as a set to collect, not a ladder: "{n} bingos · next prize at {t} bingos", and "every prize won" once the top tier is reached.

Trivia is one prize per fan by construction (a fan finishes in at most one band).

## Trivia's screens

The trivia screens' own entry points ([`trivia-game-type.spec.md`](../features/1-draft/trivia-game-type.spec.md), "Fan: the prize sheet"):

- **Rules:** each prize row (the band's places and the prize's name, nothing else) opens the info sheet for its band, with the prize's own credit and the fan's progress from `me` when it is known. The row no longer prints value or shipping ("$150 value · Shipped to you").
- **Standings (v4, 2026-10-09):** a band row (places as the eyebrow, the prize's name, a chevron; the same rows as Rules, `components/trivia/PrizeBandList.tsx`) opens the info sheet. Once final the screen's status card says "You won a {prize}!" and the band carries "Won"; the won sheet opens from the contest card or on its own, not from Standings.
- **Complete:** retired 2026-10-09; a finished run lands on Standings.

---

## API

The prize sheet's calls and the prize fields of the fan reads it uses. All are `requireMembership` and tenant-scoped.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/b2b/prizes/awards` | — | `{ success, awards: FanPrizeAward[] }`: every award this fan holds in the tenant, both games, newest first, `skipped` left out. `FanPrizeAward` = `{ awardId, contestId, contestType: "bingo" \| "trivia", contestName?, status: "pending" \| "fulfilled" \| "failed", bingoCount? (bingo), band?: { from, to }, finalRank? (trivia), prize, awardedAt, fulfilledAt?, seenAt? }`; `prize` = `{ prizeId?, prizeName, prizeDescription?, prizeImageUrl?, prizeClaimInstructions?, prizeClaimButtonText?, prizeClaimButtonLinkUrl?, hasCode?, providedBy?: { sponsorId, name, logoUrl?, websiteUrl? }, code? }`: the award's snapshot, or the live tier when the worker hasn't snapshotted a bingo award yet; `code` only from the snapshot, on the fan's own award | `handlers/prizes/listMyAwards.ts`; shared `api/b2b/prizes.ts` (`fanPrizeAwardSchema`). The fan app parses it against the shared schema: an unreadable answer is an error, and the last good list is kept |
| POST | `/b2b/prizes/awards/:awardId/seen` | — | `{ success: true, seenAt }`; idempotent (a second call returns the first `seenAt`); 404 "That prize isn't one we know." when the award isn't this fan's in this tenant (the same as an id that doesn't exist, so ids can't be probed); 400 for a malformed id | `handlers/prizes/markAwardSeen.ts`; sets `seenAt` on the prize row once (`models/prize-redemption.ts`) |
| GET | `/b2b/contest/list-contests`, `/b2b/contest/:contestId` | — | bingo `prizeTiers`, each with `hasCode` (never the code) and `providedBy` | `util/{fan-contest-projection,fan-prize-tiers}.ts`; shared `FanPrizeTier` |
| GET | `/b2b/board/:boardId` | — | `awards[]` as before (Wave 3 §1.5) | The sheet doesn't read the award from here: the award's id, code and `seenAt` are on the awards read. The board watches the count only (`FLOW-51`) |
| GET | `/b2b/trivia/contests/:contestId`, `…/me`, `…/standings` | — | bands with their prize cards (`triviaPrizeCardSchema`: the shared fan prize with `hasCode` and `providedBy`, plus `prizeId`, `prizeDescription`, `handlerId`; never the code, and no longer approximate value, redemption method, location or window) | `handlers/trivia/shared.ts` (`loadPrizeCards`) |

No board-scoped seen route exists: an earlier design's `POST /b2b/board/:boardId/awards/:awardId/seen` was never served.

## Accessibility

- The prize sheet is a modal dialog: focus moves in and is trapped, Escape closes it, focus returns to what opened it, and the page behind doesn't scroll. It is named by its title (the prize's name, or "You won {n} prizes" / "Prizes" with several) and described ("Prize details"); the close button is named "Close"; several prizes are a carousel whose slides are named "Prize 2 of 3", reachable by the dots and by the "Previous prize" and "Next prize" buttons (for a pointer that can hover) as well as by swiping.
- "Copied" is announced politely. Every sheet button has a press give, none under reduced motion.
- Reduced motion turns off the sheet's slide, the confetti and the team-colour veil; dragging the sheet still works.
- A bingo tier label on the board is a button at least 44px tall; on a narrow track its name is visually hidden but always read.
- The claim button is a link, so a screen reader announces where it goes, with "(opens in a new tab)" (2026-10-06).
- **Contest cards** (bingo and trivia, `components/contests/ContestCardShell.tsx`; 2026-10-06) are plain containers, never a `role="button"` wrapping other buttons. The card's own control is its title: a real button inside the heading, named by the contest's name, stretched over the whole card (`::after`), which draws the focus ring around the card. "See your prize" and the card's action sit above the stretch and keep their own clicks and keys. Look and behaviour are unchanged.

## Rules

1. **`FLOW-31` — One prize sheet, two bodies, both games.** No other component shows a prize to a fan.
2. **`FLOW-51` — Taps open info; the won sheet opens by itself for unseen awards; seen is kept only on the server.** Closing a won sheet by any route marks what it showed as seen. Nothing about a prize is written to `localStorage`.
3. **`FLOW-52` — "Prize won" and "See your prize" on the card**, from the fan's awards, whatever the delivery status; a bingo card in play keeps "Live".
4. **`FLOW-53` — Every bingo tier a board reaches pays, said plainly** wherever tiers are explained.
5. **The code reaches only its winner** (PRD changes, entry 36): it is on the fan's own awards read and nowhere else.

## Function audit (2026-10-03)

### 1. Screens and surfaces: data, calls, states

| Surface | Data sources | Server calls | States covered |
|---|---|---|---|
| Prize sheet, info | Bingo: the contest's `prizeTiers` (threshold, prize content, `hasCode`, `providedBy`) and the board read's count for the strip. Trivia: the contest read's or standings' bands (`from`, `to`, prize card with `hasCode` and `providedBy`) and `me` (best score, rank) for the strip. Console preview: a library prize on its own | none | bingo, trivia, library prize (no chip, no strip), one item, several (carousel), code / no code, no image, image fails to load, no sponsor, sponsor without a logo, contest still paying (strip) / not (no strip), trivia with no score yet (no strip), reduced motion |
| Prize sheet, won | `GET /b2b/prizes/awards` (`awardId`, `contestType`, `status`, `bingoCount` or `band`/`finalRank`, `prize.*` including `code` and `providedBy`, `seenAt`); the session's primary email | `GET /b2b/prizes/awards` on mount, on focus and every 30s; `POST /b2b/prizes/awards/:awardId/seen` per unseen award on close | one award, several, pending, fulfilled, failed, no email on the session, code, no code, claim link, no link, unseen (celebrates), seen (re-opened from a card or Standings, no celebration), during a trivia run (waits), reduced motion, a failed seen call (reopens after a later read) |
| Bingo board's tier labels | the contest's tiers; the board read (`awards` count, bingos, `settled`) | none (a growing `awards` count re-reads the awards) | one tier, several, narrow track (count only), contest still paying / not |
| Contest cards' "Prize won" | `GET /b2b/prizes/awards`, grouped by `contestId` | none (opens the won sheet) | no award, one, several, any status, bingo while Live ("Live" stays the status), bingo final ("· 3 prizes won"), trivia (beats every other state) |
| Contest draft page and How to play | the contest's tier thresholds (draft page); static (How to play) | none | one tier (no line on the draft page), several |
| Trivia Rules, Standings | as [`trivia-game-type.spec.md`](../features/1-draft/trivia-game-type.spec.md) | none | before final ("You" on the fan's band), final won ("Won"), final missed ("Missed by N") |

### 2. Earlier elements cut or changed

| Element | Fate | Reason |
|---|---|---|
| `PrizeModal`, the centred bingo popup over a scrim | Changed | One bottom sheet for both games (`FLOW-31`) |
| The popup's "!" after the name; trivia's condensed uppercase title | Changed | The name as typed, in the brand's display face; uppercase only when the brand sets it |
| The popup's 128px square image; the built trivia sheet's dashed "No image yet" | Changed | A 2:1 box only when an image is set and loads; no placeholder |
| The popup's email line only when fulfilled | Changed | A line for every status (pending, fulfilled, failed) |
| The popup's "Awesome!" | Changed | "Got it"; with a claim link, the prize's button text ("Claim your prize" by default) and an outline "Got it" |
| The claim button navigating the app away in the same tab (`followExternalLink`) | Changed (2026-10-06) | A real link opening a new tab (`noopener noreferrer`): the fan keeps the app, and middle-click, long-press and screen readers treat it as a link |
| The contest card as a `role="button"` wrapping its own buttons | Changed (2026-10-06) | Nested interactive controls; the card's control is now a stretched title button, with the other buttons above it |
| No code in the app | Changed | "Your code" with Copy on the winner's own award (PRD changes, entry 36) |
| Several awards as popups one after another (`awardsToCelebrate`, `settlePrizeQueue`) | Changed | One sheet, a carousel of the awards |
| `localStorage` shown marks (`awardShownKey`, `wasAwardShown`, `markAwardShown`) | Cut | Seen is the server's `seenAt` (`FLOW-51`) |
| The board's inline tier panel and "No prize details available yet." | Cut | A tier tap opens the info sheet |
| Trivia's `PrizeDetailSheet`: chip "11th–30th win" | Changed | "11th–30th", a neutral chip |
| Trivia's four tiles (Approx. value, Redeem, Where, Valid) and the Rules row's "$150 value · Shipped to you" | Cut | D-086: no value or redemption terms; the console can't set them |
| Trivia: "Winners get an email with a code after the contest closes." | Changed | Bingo emails at the win; trivia once results are final (Finalize), never "after the contest closes"; "with a code" only when the prize has one |
| Trivia: "Sponsored by" and the contest's sponsor | Changed | "Provided by" and the prize's own sponsor (D-124) |
| Trivia: "Got it" (outline) | Changed | The primary button |
| The built trivia sheet's off-screen "Band index {n}" | Cut | Debug text read aloud by screen readers |
| Trivia card "Prize sent" and "Claim your prize" (only once the email was sent) | Changed | "Prize won" for any status, "You won {prize}" and "See your prize" (`FLOW-52`) |
| Trivia Complete "Final when the contest closes." | Changed | "Final once results are posted." |
| The card's "top prize reached" | Changed | "every prize won" (`FLOW-53`) |

## Acceptance criteria

1. Tapping a bingo tier label, a trivia Rules prize row or a trivia Standings band opens the info sheet for it, with the email line for its game and code exactly as tabled; nothing is stored or sent.
2. The won sheet opens by itself only for a server award with no `seenAt`, never for a line without an award; closing it by any route sends one `POST /b2b/prizes/awards/:awardId/seen` per unseen award shown, and it doesn't open again for them on this device or another; its delivery line reads per status as tabled (pending, fulfilled, failed).
3. A board that reaches 3 bingos with tiers at 1, 2 and 3 shows one won sheet with three cards, dots and "You won 3 prizes"; its card reads "Final · 3 bingos · 3 prizes won" once final, with "Prize won" and "See your prizes". While a game is still in play the card's status stays "Live", and it still offers "See your prizes".
4. A prize with a code shows "Your code" and Copy in the won sheet; the code is in no tier, band, list, preview or standings response.
5. The sheet's title is uppercase only for a brand whose display transform is uppercase; no image box shows for a prize without an image or with one that fails to load; the credit is the prize's own sponsor, never the contest's.
6. With reduced motion, the sheet appears without sliding and no confetti or veil plays; re-opening seen awards from "See your prize" never celebrates.
7. Nothing is written to `localStorage` for a prize.
8. A trivia win made at Finalize opens the won sheet the next time the fan is in the app, but not while a run's question is on screen.
9. A trivia card with an award reads "Prize won" and "You won {prize}" whatever the delivery status.

## Known gaps (recorded, not blocking)

- **Awards made before the seen marker have no `seenAt`**, and no backfill is part of the 2026-10-03 build, so each opens the won sheet once (without being a new win) on the fan's next visit.
- **A failed seen call** leaves the award unseen on the server; the sheet stays closed for now and opens it again after a later read of the awards.
- **A prize resent by staff to a corrected address** still reads "We've emailed the details to {account email}."; the corrected address is never stored on the fan side.

## References

- PRD changes, entries 36 and 37 ([`PRD-changes-contributed-by-Arthur.md`](../../documents/PRD/PRD-changes-contributed-by-Arthur.md)); D-086, D-103, D-124 (Arthur's vault).
- Fan app: `src/components/prize/{PrizeSheet,PrizeSheetHost,prizeItems,prizeSheetContext}.ts(x)`, `src/components/sponsor/PrizeSponsor.tsx`, `src/store/api/prizeApi.ts`, `src/components/contests/{BingoContestCard,TriviaContestCard,ContestCardShell}.tsx`, `src/pages/contests/{ContestsPage,ContestPage}.tsx`, `src/pages/board/BoardPage.tsx`, `src/pages/help/HowToPlayPage.tsx`, `src/pages/trivia/{TriviaPlayPage,TriviaStandingsPage,screens/RulesScreen,screens/CompleteScreen}.tsx`.
- Backend: `node-server/src/routes/prizes/index.ts`, `handlers/prizes/{listMyAwards,markAwardSeen}.ts`, `util/{fan-contest-projection,fan-prize-tiers}.ts`, `handlers/trivia/shared.ts` (`loadPrizeCards`).
- Shared: `api/b2b/prizes.ts`, `api/b2b/trivia.ts` (`triviaPrizeCardSchema`), `interfaces/b2b/B2BPrizeTiers.ts` (`FanPrizeTier`), `models/prize-redemption.ts` (`seenAt`), `theme/celebration.ts`.
