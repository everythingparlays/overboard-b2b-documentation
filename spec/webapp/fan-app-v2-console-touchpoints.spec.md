# Webapp Spec: Fan App v2 — Console Touchpoints (Wave 5)

**Implements:** Arthur's 2026-09-27 ruling "Wave order" ("Wave 5 also covers every console part affected by the overhaul, not just Brand: every preview (contest builder and contest page, prize popup, Fields & Opt-ins, sponsor artwork, Brand) and everything tied to them. All of it lives on the same unmerged branch."); the Wave 4 walkthrough rulings (contest previews show only Contest list, Contest detail, Board and Prize; no desktop preview anywhere; the prize preview becomes the same phone preview; Brand previews every screen on a built-in sample contest); walk #3 (the Start page, "Sign-in" renamed, no highlight ring, the preview follows what you point at); the standing rule "function over mocks". Director's decisions W5-D01 to W5-D75, all binding (chiefly W5-D28, W5-D30, W5-D31, W5-D33, W5-D35, W5-D52, W5-D54, and the console-redesign rulings W5-D72 to W5-D75; `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` and `briefs\w5-phaseB-deltas.md`, workspace), the Phase A review rulings (`artifacts\wave-2026-09-27\briefs\w5-review-rulings.md`, workspace), and Arthur's walk #3 rulings (`artifacts\review-2026-09-27\arthur-rulings-console-final-walk.md`, workspace), which rule on the console touchpoint audit (`artifacts\wave-2026-09-27\briefs\w5-console-touchpoints-audit.md`, workspace). Facts: `artifacts\w5\redesign-delta.md` (workspace).

**Depends on:** the console redesign, branch `arthur-console-redesign` (admin `1385b3e`, shared `41b9c7d`, backend `96d40c9`, fan app `9c1af32`), which contains Wave 4 and the Wave 4b fix pass: [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) (the `/preview` contract, `PREV-01`–`PREV-15`; phone only; "No highlight"), `../core-modules/1-draft/admin-preview.spec.md` (`FanAppPreview`, `PV-01`–`PV-12`, "The preview follows what you point at", `GET /admin/contests/:contestId/preview`, `GET /admin/preview`), `admin-contests.spec.md`, `admin-prizes.spec.md`, `admin-sponsors.spec.md`, `admin-fields-and-optins.spec.md`, `admin-uploads.spec.md`, `admin-branding.spec.md`. Every file:line below was checked with `git show origin/arthur-console-redesign:<path>` at admin `1385b3e` (2026-09-29). Siblings: [`fan-app-v2.spec.md`](fan-app-v2.spec.md), [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md), [`../core-modules/1-draft/admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md), [`../core-modules/1-draft/fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md).

**Status:** Draft, 2026-09-28, Wave 5 Phase A (new); **revised 2026-09-29 for the console redesign** (W5-D68–D75). Built in Phase B on the console's, shared repo's and fan app's `arthur-fanapp-overhaul` branches; never merged (W5-D29).

### Revised 2026-09-29: touchpoints on the redesign

- **Most of the console side is built.** The redesign already ships the four-tab contest hosts with their labels, phone only, the Brand host on a client-side sample, the Start page, per-game markers, hover-to-preview without a ring, staff "All prizes" and display names. Wave 5 **consumes** them (W5-D74).
- **`PreviewDocument` gains only `board?` and `standings?`** (W5-D72). `documents?`, `view.gateMode` and the `membership` overlay are dropped.
- **Fields & Opt-ins keeps its own preview** (W5-D73): only its strings are a touchpoint.
- **The string list is re-derived** against the redesign: seven corrections remain, three of them new (`TOUCH-15`).

## Overview

The console shows fan-app screens in four framed places (contest page and builder, prize page, sponsor page, Brand) and describes fan behaviour in words in many more. On the redesign those describe the current fan app. On the Wave 5 branch the fan app is the overhaul, so every one of them has to show and say what the overhaul does.

**The whole change, in one line:** the console keeps the redesign's single preview contract and host (`FanAppPreview` framing `/preview`), the overhaul answers it with `app: 'overhaul'` and the same seven screen ids, the render document gains a fixed sample board and real standings, and Wave 5 corrects the seven console strings whose meaning the overhaul changes.

**In scope:** every console surface that frames fan-app screens; their screen lists and labels; the sample data (Brand only); the editable words; the theme controls; the sponsor artwork as the overhaul renders it; every console field and string whose meaning changes with the overhaul.

**Not in scope:** the console's own look; the Brand page's controls ([`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md)); the fan screens themselves (the sibling fan specs); Fields & Opt-ins' own preview (W5-D73).

---

## The preview contract under the overhaul

**`TOUCH-01` — One contract, one host.** The redesign's `obs-preview:` protocol, render document and security rules are unchanged (`PREV-15`). One console build previews either fan app: the frame's `ready.app` says which answered (`"current"` on the redesign, `"overhaul"` on the Wave 5 fan app). The console sets `VITE_FAN_APP_ORIGIN` to the Wave 5 fan app's origin for the Wave 5 stacks.

**`TOUCH-02` — The same seven screen ids, no new ones** (W5-D30). The overhaul answers `ready { v: 1, app: "overhaul", screens: ["start", "signIn", "join", "contests", "contest", "board", "prize"] }` (today the fan app answers `app: "current"`, `src/preview/runtime.ts:212`). `PREVIEW_SCREENS` in `obs-b2b-shared/src/api/preview.ts` is a closed enum inside `ready`'s parser, so any new id would make `ready` invalid and the console would show "The fan app didn't load."; no id is added. There is no home screen; Your boards, Profile, Standings and Paused are not preview screens.

**`TOUCH-03` — Phone only,** as built (`PHONE_SIZE` 390×844; every console sends `device: "phone"`).

**`TOUCH-04` — How the overhaul maps the screen ids.**

| Screen id | Overhaul route and state | Session step (`PreviewSessionProvider`) |
|---|---|---|
| `start` | `/`, Start | `signedOut` |
| `signIn` | `/sign-in` | `signedOut` |
| `join` | the join gate in place (join mode) | `signedIn` |
| `contests` | `/contests`, the Current tab (Past when the previewed contest is there) | `member` or `playing` |
| `contest` | `/contest/:contestId`, **the contest detail page**; also `/contest/:contestId/build` and `/build/lines` (the builder belongs to the detail tab's flow) | `member` |
| `board` | `/board/preview-board` (and `/edit`) | `playing` |
| `prize` | the board with the prize popup open for `view.prizeTierIndex` | `playing` |

- **The `contest` tab changes meaning.** On the redesign it shows the draft page; on the overhaul it shows the contest detail page, and the builder is one click further (Build my board → Pick your players → Generate).
- **Routes that are not screens** (`/boards`, `/profile`, `/terms`, `/privacy`, `/document/:optInId/:linkId`, `/contest/:id/standings`) post `navigated { screen: null }` and the console selects no tab. Their reads are answered from the document (`/boards` from the preview board; `/profile` from `membership`; tenant documents from `org.organization.documents` and the public document read, as built).
- **Standings in the preview are the contest's real current standings** (Arthur, W5-D52): `GET /admin/contests/:contestId/preview` returns `standings` (the same projection as the fan standings read, computed on read, `FLOW-33`), and the render document carries it as `PreviewDocument.standings?` (real, never sample; **Phase B: to build**, s0 contract, W5-D72). `/contest/:id/standings` renders it, and the board's standings row reads from it. A Draft, or a contest nobody has joined, shows the real empty state ("No boards yet"). The Brand host's sample carries no standings, so its standings link shows the empty state.

**`TOUCH-05` — The preview data layer learns the overhaul's writes.** **Phase B: to build** in the fan app's `src/preview/baseQuery.ts`: answers for `POST /b2b/board/generate` with `cells` (pinned cells kept, gaps filled, board created) and `PUT /b2b/board/:boardId/cells` (with `fill`), built with the shared `buildBoard` over `document.contest.props`, in memory, exactly as generate is answered today; and `document.board` (Brand's fixed board) used instead of building one when present.

**`TOUCH-17` — The overhaul honours the redesign's hover-to-preview** (walk #3; W5-D74). The console's jump bus (`lib/preview/previewJump.ts`, `PreviewJumpArea`, `PREVIEW_JUMP_DELAY_MS = 150`) navigates the frame to a screen, tier or pane when the admin points at a marked item. The overhaul answers `navigate` (with `view.prizeTierIndex` on Prize) promptly and without a flash, as the current app's `screenPlan()` does (route and session committed together). There is **no highlight ring**: the fan app's `Highlight.tsx` is deleted, `view.highlight` is deprecated and ignored, and the overhaul renders nothing for it.

---

## Hosts

**`TOUCH-06` — Screens, labels and sources per host, as built on the redesign** (`HOST_DEFAULTS` and `SCREEN_LABELS`, `components/preview/FanAppPreview.tsx:80-96`; W5-D31):

| Host | Where | Tabs (label) | Opens on | Document source | Overlay |
|---|---|---|---|---|---|
| `contest` | Contest page › Preview (`components/preview/ContestPreviewTab.tsx:52`; `?screen`, `?tier`, `?game`) | `contests` "Contest list" · `contest` "Contest detail" · `board` "Board" · `prize` "Prize" | `contests` | `GET /admin/contests/:contestId/preview` (real data; a Draft as if published) | none |
| `builder` | Builder › Review (`pages/contests/ContestBuilder.tsx:1124`) | same four | `contests` | same | `contest`: unsaved name, description, player limit, banner |
| `prize` | Prize page, Prize popup pane (`pages/prizes/PrizePage.tsx:1315`; Segmented Prize popup / Email) | `prize` only | `prize` | `GET /admin/preview` + the prize as typed | `prize` |
| `sponsor` | Sponsor page frame (`pages/SponsorPage.tsx:729`) | `start` "Start" · `board` "Board" · `prize` "Prize" | `start`; the pointed-at block's screen (`SCREEN_FOR`, `SponsorPage.tsx:698-703`) | `GET /admin/contests/:contestId/preview` for the chosen contest | `sponsor`: unsaved artwork |
| `brand` | Brand (`pages/Branding.tsx:418`, `fit`) | all seven: "Start" · "Sign in" · "Join" · "Contest list" · "Contest detail" · "Board" · "Prize" | `start` | `GET /admin/preview` + `withSampleContest` (+ the fixed board, Phase B) | `branding` (+ `text`, Phase B) and `startPage` |

- Wave 5 adds nothing to the tab sets, labels or hosts. Tabs are still narrowed and ordered by `ready.screens`; `unreachableScreens()` and `refusalReason()` disable a tab with its reason, as built.
- Fields & Opt-ins is not a frame host (W5-D73, `TOUCH-12`).

### Contest page and builder

**`TOUCH-07` — What the contest tabs show on the overhaul:**
- **Contest list:** the Current (or Past) tab with the previewed contest's card: its console name as the title, its description in full, its banner, the featured game as a sub-line (W5-D39), the top prize with its description, the status chyron.
- **Contest detail:** the detail page ([`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) `FLOW-43`), including the limit line (`FLOW-45`) from the builder's unsaved player limit and the real count once `playerCount` ships on the contest read; until then no count shows, as on the live app (the preview read's `numberParticipants` board count is not used, so the preview never shows fans something they can't see).
- **Board:** the preview board built by the shared `buildBoard` with no drafted players, with the overhaul's squares, Track, marker (the redesign's chain, `gameMarkerImageUrls` included) and lines; bingos from the shared `boardBingos` (W5-D75).
- **Prize:** the overhaul's popup for the chosen tier (`?tier=`), content per W5-D41.
- **The "Tier N" tabs** (`FanAppPreview.tsx:410-414`, from `lib/preview/tiers.ts` `tiersInOrder`) offer only the tiers the overhaul shows: `tiersInOrder` skips a tier at 7 bingos or with an incomplete prize (`FLOW-46`). **Phase B: to build** (s4).

### Prize page

**`TOUCH-08` — The popup preview on Nick's prize model** (W5-D41): the overhaul's popup on its own over the app's background, in the tenant's published theme, showing the tier chyron, the prize name as the title, description, image, claim instructions and button when set, and "Provided by {sponsor}" resolved from the draft's sponsor. **The code never crosses the frame** (`PV-05`): the preview shows no code row even when the prize has one; the admin sees the code in the page's own Code field and in the Email pane. The fan's live popup does show the winner's code (W5-D45), so the Code field's help changes (`TOUCH-15`). The email line needs an award status and an email address the preview doesn't have, so it is not shown. No value, shipping, pick-up, expiry or type. The Email pane and the platform wording (`PRIZE_EMAIL_WORDING_*`, staff "All prizes") are unchanged: the popup never reads the email wording, and its "Your code" matches the email's default `codeLabel`.

### Sponsor page

**`TOUCH-09` — Slots, sizes and placements as the redesign built them, rendered by the overhaul** (W5-D74; W5-D34 withdrawn):

| Slot (`SPONSOR_SLOTS`) | Upload rule (`UPLOAD_FIELDS`) | Where the overhaul renders it | Preview screen |
|---|---|---|---|
| `startPage` (tenant level, Brand's Start page list; `startPageLogo`, `startPageTagline`) | `sponsor.startPageLogo`, ≥40px tall | **Start only**, as "Presented by": one sponsor spans the column up to 96px tall; several sit 2-up on 64px plates; a sponsor without a logo shows as its name tile (the redesign's render rules, `admin-branding.spec.md` "Start page") | `start` |
| `boardBanner` | `sponsor.boardBanner`, ≥480px wide | the live board, between the counter block and the squares, 4:1 until loaded, then its own ratio, never cropped | `board` |
| `slider` | `sponsor.sliderIcon`, ≥36×36 | the Track's marker at that game, first in the marker chain (sponsor → game marker → Brand marker → triangle) | `board` |
| `prizePopup` (logo) | `sponsor.prizePopupLogo`, ≥48px tall | "Provided by" in the prize popup, for prizes this sponsor provides | `prize` |

- The contest sign-in slot is gone on the redesign: `PLACEMENT_SLOTS = ["boardBanner", "slider"]`; stored `signIn` placements read as legacy (`LEGACY_PLACEMENT_SLOTS`). Nothing for Wave 5 to change.
- `SCREEN_FOR` is `{ startPage: "start", boardBanner: "board", slider: "board", prizePopup: "prize" }` (`SponsorPage.tsx:698-703`); a prize logo jumps to the tier this sponsor provides. The overhaul honours the jumps (`TOUCH-17`); no ring.
- The sponsor's in-context frame still needs a contest where the sponsor appears; a sponsor in no contest gets no frame (no sample contest on the sponsor page).

### Brand

**`TOUCH-10` — Brand is the only host with sample data.** It frames all seven screens on the redesign's `withSampleContest` (`lib/preview/sampleContest.ts`), with the tenant's real org and gate from `GET /admin/preview` and the draft overlaid through the redesign's `PreviewOverlay.branding` and `startPage`. The sample's contents, its fixed board (the additive `PreviewDocument.board?`, so the Board tab always shows two bingos) and the overlay are [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) `BRAND2-26` and `BRAND2-27`. Every other host previews real data only (`PREV-09`).

**Logo colours.** Brand's "From your logo" swatches come from `POST /admin/branding/sample-colours` (**Phase B: to build**, s4, review ruling B1), which samples the uploaded logo on the server; the frame is not involved and the asset CDN is unchanged.

**`TOUCH-16` — Theme controls.** Brand's Colors are the redesign's: Main and Accent (`ColorPicker`), Text (White/Black) and Button text (Auto/White/Black) (`BRAND2-02`, W5-D68). No Second or Live swatch, no mode, no presets. On the overhaul Main picks the scheme and, when it has colour, the band (W5-D69, W5-D70), and the Colors card says so (`TOUCH-15`).

**`TOUCH-11` — The draft theme reaches only the Brand frame.** The contest, builder, prize and sponsor hosts paint with the tenant's **published** theme (`org.organization.branding` as served), never a Brand draft, so an unpublished look never appears on another page.

### Fields & Opt-ins

**`TOUCH-12` — withdrawn 2026-09-29** (W5-D73; W5-D36 withdrawn). Fields & Opt-ins keeps the redesign's own preview: the console-drawn `WalkableGate` (shared `EntryGateForm`) inside `PhonePreview`, with `PreviewTabs` and per-row jump targets. It is not a fan-app frame, so the `membership` overlay, `view.gateMode` and `PreviewDocument.documents?` are not built. Its only Wave 5 touchpoint is its strings (`TOUCH-15`). Retiring the shared `ui/entry-gate/EntryGatePreview.tsx` (no longer imported by the console) is optional cleanup outside Wave 5.

---

## Words

**`TOUCH-13` — Two homes for tenant words, each previewed where it is edited:**

| Words | Keys | Edited in | Stored / served | Previewed in |
|---|---|---|---|---|
| Gate copy (exists) | `joinHeading`, `joinSubtitle`, `joinCta`, `returningHeading`, `returningSubtitle`, `consentsHeading`, `footerNote` (≤300), `displayNameLabel` (≤80), `displayNamePlaceholder` (≤120) | Fields & Opt-ins › Screen text (`lib/fieldsDraft.ts`, `pages/FieldsOptins.tsx`) | `organization.gateCopy`, on `GET /b2b/membership` | Fields' own `WalkableGate` (W5-D73); the Brand frame's Join tab shows the published copy |
| Words (**Phase B: to build**, W5-D33) | `startTagline` (60), `startCta` (24), `noContests` (90), `pausedHeading` (40), `pausedBody` (160); `{team}` only | Brand › Words | `branding.text`, on `GET /b2b/org/:subdomain` | The Brand frame (Start, Contest list); paused words have no preview screen |

Brand's Words card links to Fields & Opt-ins › Screen text rather than duplicating gate copy. The sponsor's `startPageTagline` (≤80) remains the only other tenant-written fan text besides contest names, descriptions and prize content.

---

## Console fields whose meaning changes

**`TOUCH-14` — Each field, what fans see on the overhaul, and whether its console words stay true** (paths under the admin repo's `src/`, redesign `1385b3e`):

| Console field | What the overhaul does with it | Console change on the Wave 5 branch |
|---|---|---|
| Contest name (`pages/contests/ContestBuilder.tsx`, `OverviewTab.tsx`) | The card and detail title, never a game's matchup (W5-D39) | None |
| Description (≤300; help "Fans see this on the contest card.", `ContestBuilder.tsx:783`, `OverviewTab.tsx:510,575`) | Shown in full on the card **and** the detail page | Help becomes "Fans see this on the contest card and page." |
| Player limit (`maxParticipants`, "Player limit", `ContestBuilder.tsx:810`) | The limit line: "N playing" always (once served); "M spots left" and a bar only with a limit (W5-D08) | None |
| States Draft / Open / Closed and Finalized (`lib/contests.ts`, "Fans see this contest under Past and keep playing their boards. Nobody new can join.", `:317`) | Draft unseen; Open under Current (OPEN, or OPENS); Closed under Past, still playable; all games under way → LIVE under Current; Finalized → FINAL under Past | None: still true |
| "Fans can join from …" (`lib/contests.ts:354-358`) | OPENS chyron and "Opens {date}" CTA | None |
| Test mode | Nothing in the fan UI (W5-D09) | None: already off the console UI (`TestModeZone` deleted) |
| Prize tiers (`components/prizes/PrizeLadder.tsx`, 1–8 bingos) | "Tier n · m bingos" chyrons on detail, Track and popup; a tier at 7 or with an incomplete prize is hidden (`FLOW-46`) | None (the editor still accepts 7; recorded gap) |
| Prize name, description, image (`pages/prizes/PrizePage.tsx:790,806,821`) | Name = the popup's title; description = body text under it | None: "A line or two under the name, in the prize popup and the email." stays true |
| Provided by (`PrizePage.tsx:896-933`) | "Provided by {sponsor}" in the popup and on the detail page's prizes | None |
| Claim button text and link (`PrizePage.tsx:870-892`, "Fans tap it in the prize popup and the email.") | Kept (W5-D54): the popup and the email | None |
| Prize code (`PrizePage.tsx:1022-1031`, "…It appears in the email as Your code, never in the popup.") | The winner's popup shows "Your code" with Copy (W5-D45), and the email | Help changes (`TOUCH-15`) |
| Opt-ins and documents | Documents over the gate, in the side menu (Terms, Privacy, each tenant document, as built) and on Profile with the agreed version; optional opt-ins can be withdrawn on Profile | None |
| Display name (reserved field; meta "Short text · always asked — it's the name on the fan's board", `pages/FieldsOptins.tsx:552`) | Shown on standings, the side menu and Profile; the overhaul's board header shows the contest name | Meta becomes "Short text · always asked — it's the name other fans see on standings" |
| Contest banner (`BannerField`, `ContestBanner`) | The card's image and the detail band's background | None (consumed) |
| Per-game progress marker (Games tab marker column) | The Track marker's second step (W5-D74) | None (consumed) |
| Sponsor page Start page block (`pages/SponsorPage.tsx:435-436`, "Under “Presented by” on the Start page, when Brand lists this sponsor there.") | Start's "Presented by" | None (built on the redesign) |
| Brand Colors: Main's hint (`lib/brandTheme.ts:24`) and the card's lede (`pages/Branding.tsx:329`) | Main picks the scheme and paints the bands when it has colour; the ground is neutral (W5-D69, W5-D70) | Both reworded (`TOUCH-15`) |
| Paused (`components/Layout.tsx:87-93` console banner; `pages/staff/TenantPage.tsx:1055`, "Fans see a paused screen within a minute…") | The Paused screen with the tenant's paused words | None: still true (the org read is cached a minute) |
| Fans list and detail (display names; contact fields behind Reveal) | Standings show display names | None (consumed) |
| Staff "All prizes" (`pages/prizes/AllPrizesPage.tsx`, `PlatformEmailTab.tsx`) | Nothing on the fan screens; the email wording is the email's | None (consumed) |
| Nav "Games & Contests" and the contest ledes | — | None: the console section's own name; the ledes are accurate (W5-D35) |

**`TOUCH-15` — String corrections, the complete list** (W5-D35), each a one-line edit on the console's `arthur-fanapp-overhaul` with its test expectation updated:

| File:line (`arthur-console-redesign`, admin `1385b3e`) | From | To |
|---|---|---|
| `src/pages/contests/ContestBuilder.tsx:783` | "Fans see this on the contest card." | "Fans see this on the contest card and page." |
| `src/pages/contests/OverviewTab.tsx:510` | "Fans see this on the contest card." | "Fans see this on the contest card and page." |
| `src/pages/contests/OverviewTab.tsx:575` | "Fans see this on the contest card." | "Fans see this on the contest card and page." |
| `src/pages/FieldsOptins.tsx:552` | "Short text · always asked — it's the name on the fan's board" | "Short text · always asked — it's the name other fans see on standings" |
| `src/pages/prizes/PrizePage.tsx:1030` | "Every winner of this prize gets the same code. It appears in the email as Your code, never in the popup." | "Every winner of this prize gets the same code. It appears as Your code in the prize popup and the email." |
| `src/lib/brandTheme.ts:24` (`COLOR_HINTS.main`) | "The background of every screen. Cards and borders are drawn in shades of it." | "Your team color for bands and tabs, and whether the app is dark or light. With black, white or gray, a deep shade of your accent draws the bands." |
| `src/pages/Branding.tsx:329` (Colors lede, theme set) | "Fans see these on every screen. Cards, borders and muted text are shades of them." | "Fans see these on every screen, on a dark or light background picked from your main color." |

Already done on the redesign, so no longer listed: every "Sign-in" → "Start page" string (`SponsorPage.tsx`, the removed contest slot rows in `lib/slotSchedule.ts` and `SlotEditor.tsx`, the deleted `lib/sponsorSchedule.ts`, the upload label now "Start page logo" for `sponsor.startPageLogo`), the sponsor line's "and on Home", and the prize description help. Not renamed: the preview tab "Sign in" (`FanAppPreview.tsx:90`) and "Sign-in method" (`pages/staff/TenantPage.tsx:961`), which mean signing in, not the start page. The console's own spelling ("color") is kept in its strings.

No console string uses "game" where it means "contest" (checked by searching the console's strings that mention both fans and games: the contest ledes and Game day's `Live.tsx` and `Operations.tsx` lines each mean real games).

---

## Function audit

### 1. Surfaces: data, calls, states

| Surface | Data sources | Server calls | States covered |
|---|---|---|---|
| Contest Preview tab | `GET /admin/contests/:contestId/preview` (+ `standings`*) | none from the frame (`PV-02`) | before ready, ready, read failed, no ready in 8s, draft as published, closed, finalized, no tiers, unreachable tab, standings empty and filled* |
| Builder Review | same + `contest` overlay | none | as above, with unsaved name, description, limit, banner |
| Prize pane | `GET /admin/preview` + the prize as typed | none | new prize, no image, no sponsor, with button, code set (not shown) |
| Sponsor frame | `GET /admin/contests/:contestId/preview` for the chosen contest; `sponsor` overlay | none | no contest (no frame), each slot's screen, name-tile Start sponsor, per-game holder |
| Brand frame | `GET /admin/preview`; `withSampleContest`; fixed `board`*; `branding` (+ `text`*) and `startPage` overlays | none (logo swatches: `POST /admin/branding/sample-colours`*, outside the frame) | see [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) |
| Hover-to-preview (every host) | the redesign's jump bus | none | jump to screen, to tier, to pane; no ring |
| Console words | the strings in `TOUCH-15` | none | — |

\* **Phase B: to build.**

### 2. Mock and earlier-design elements

| Element | Fate | Reason |
|---|---|---|
| S2's preview document (`theme`, `brand`, `gate`, `sample` sections; screens Gate, Join, Home, Contest, Board, Prize, Results, Paused) | Cut | The redesign's contract is authoritative (`PREV-15`, W5-D30) |
| S2's PREVIEW chyron in the frame | Cut | `PREV-09` |
| Phone / Desktop toggle (`brand-v2.html`) | Cut | No desktop preview anywhere (walkthrough ruling) |
| Contest preview tabs Start, Sign in, Join | Cut from contest hosts | Walkthrough ruling; kept on Brand only |
| A home screen tab | Cut | No home screen |
| `BrandPreviewPanel.tsx` sampler | Cut | Deleted on the redesign |
| Prize code in the preview popup | Cut | `PV-05` |
| Prize claim instructions and claim button in the prize preview | Kept (Arthur, 2026-09-28) | Nick's `B2BPrize` fields, used by the popup and the email (traced; W5-D54) |

### 3. Cut or changed by the console-redesign delta (W5-D68–D75)

| Element (earlier draft of this spec) | Fate | Reason |
|---|---|---|
| `PreviewDocument.documents?` (draft documents for the Fields frame) | Cut | Tenant documents ride in `org.organization.documents`; no Fields frame (W5-D72, W5-D73) |
| `PreviewView.gateMode` ("join" / "returning") | Cut | No Fields frame (W5-D72, W5-D73) |
| `PreviewOverlay.membership` (unsaved fields, opt-ins, gate copy) | Cut | Fields keeps the redesign's `WalkableGate` (W5-D72, W5-D73; W5-D36 withdrawn) |
| The Fields host row, its Screen text jumps onto the frame, and retiring `EntryGatePreview`, `WalkableGate`, `GatePreviewPanel` | Cut | W5-D73; `EntryGatePreview` retirement is optional cleanup outside Wave 5 |
| `PreviewOverlay.branding { theme, decor, logo, marker, text }` | Changed | The redesign's `{ theme, assets }` and `startPage`, plus Words' `text` (W5-D72) |
| Highlight ring: `src/preview/Highlight.tsx` `SLOT_ASSET` following the overhaul's render sites; "rings the logo"; the tagline-only no-ring gap | Cut | `Highlight.tsx` deleted; hover-to-preview without a ring (W5-D74); `TOUCH-17` |
| `SCREEN_FOR.signIn` and the Start page slot built by Wave 5 (`PLACEMENT_SLOTS` losing `signIn`, `sponsor.signInLogo` relabelled) | Changed | Built on the redesign (`startPage`, `sponsor.startPageLogo`) (W5-D74) |
| Sponsor sizes "unchanged" (W5-D34: 40h × ≤176 on Start) | Changed | The redesign's Start render rules (W5-D34 withdrawn, W5-D74) |
| TOUCH-15's eight strings at `fda998d` (Sign-in block, slot rows, `SLOT_LABELS`, "Preview the sign-in screen", upload label) | Changed | Done on the redesign; the list is re-derived at `1385b3e` and gains the prize code help and the two Brand colour strings |
| Brand's own sample (`sampleDocument.ts`) | Cut | The redesign's `withSampleContest` (W5-D74) |
| "Tier selector offers only winnable tiers" as a fix-pass matter | Changed | Not on the redesign; s4 filters `tiersInOrder` |
| Standings from persisted board fields | Changed | Computed on read (W5-D75) |

---

## Rules

- **TOUCH-01 — One contract, one host;** `ready.app` says which fan app answered.
- **TOUCH-02 — Seven screen ids, no new ones.**
- **TOUCH-03 — Phone only.**
- **TOUCH-04 — The overhaul maps the seven ids as tabled; other routes report no screen; standings in the preview are the contest's real standings (W5-D52).**
- **TOUCH-05 — The preview data layer answers the overhaul's writes in memory, and uses Brand's fixed board** (Phase B).
- **TOUCH-06 — Per-host screens, labels and sources as the redesign built them.**
- **TOUCH-07 — Contest tabs show the overhaul's card, detail, board and popup on real data; Tier tabs only for tiers fans can see.**
- **TOUCH-08 — The prize preview shows Nick's fields and never the code.**
- **TOUCH-09 — Sponsor slots, sizes and the Start page are the redesign's; the overhaul renders them where tabled.**
- **TOUCH-10 — Brand is the only host with sample data.**
- **TOUCH-11 — Only the Brand frame shows a draft theme.**
- **TOUCH-12 — withdrawn** (W5-D73).
- **TOUCH-13 — Gate copy is edited and previewed in Fields; Words in Brand.**
- **TOUCH-14 — Every console field keeps its storage; only the words whose meaning changed move.**
- **TOUCH-15 — The seven string corrections listed, and no others.**
- **TOUCH-16 — Brand colours are the redesign's four inputs; no Second, Live, mode or presets.**
- **TOUCH-17 — The overhaul honours the redesign's preview jumps promptly; no highlight ring.**

## Acceptance criteria

1. With the console pointed at the Wave 5 fan app, every host's frame answers `ready` with `app: "overhaul"` and the seven ids; no host shows a desktop control.
2. The contest Preview tab and the builder's Review offer exactly "Contest list", "Contest detail", "Board", "Prize"; clicking through the frame from Contest list to the card to Build my board keeps the "Contest detail" tab selected; Generate lands on "Board".
3. The Contest detail tab for a contest with no player limit shows no bar and no "spots" text.
4. The prize pane shows the prize name as the title, the description under it, and no code, value, shipping or pick-up, for a prize that has a code; the Code field's help says the popup and the email show it.
5. Pointing at the sponsor page's Start page block moves the frame to Start within the jump delay, with no ring drawn anywhere; pointing at the prize logo opens the popup of the tier that sponsor provides.
6. Only the Brand frame ever shows "Sample contest"; no other host's frame shows a sample name.
7. Editing Main on Brand changes only the Brand frame; the contest Preview tab keeps the published colours.
8. The contest Preview tab's standings route shows the contest's real standings from `PreviewDocument.standings`, or "No boards yet" for a Draft or an unjoined contest.
9. A contest with a tier at 7 bingos shows no "Tier" tab for it.
10. The strings in `TOUCH-15` read as specified, with their tests updated; nothing else in the console changes wording; Fields & Opt-ins' preview is unchanged apart from the display-name meta.

## Open questions

None. Decided since the first draft: `PreviewDocument.board?` and `.standings?` only (W5-D72); Fields keeps its own preview (W5-D73); standings in the preview are real (W5-D52).

## Recorded gaps

- **The prize preview can't show the email line** (no award status or address in a preview).
- **Paused words have no preview screen** (W5-D30).
- **The console's tier editor accepts a tier at 7 bingos** (shared `PRIZE_TIER_MIN_BINGOS`–`PRIZE_TIER_MAX_BINGOS` is 1–8 with no 7 rule on the redesign); the fan app hides such a tier (`FLOW-46`) and the preview offers no tab for it.
- **File:line references** are at admin `1385b3e`; they are re-checked if the redesign moves before s4 starts.

## Mocks

`mocks\console-v2\` (`contest-preview.html`, `prize-page.html`, `sponsor-page.html`), `mocks\fanapp-v2\brand-v2.html` (workspace). Visual direction only; the function audit lists what changed.

## References

- Console audit: `artifacts\wave-2026-09-27\briefs\w5-console-touchpoints-audit.md` (workspace), §1–§7 and its touchpoint table (pre-redesign).
- Decisions: W5-D28, W5-D30–W5-D35, W5-D39, W5-D41, W5-D52, W5-D54; `briefs\w5-phaseB-deltas.md` W5-D72–W5-D75. Facts: `artifacts\w5\redesign-delta.md` §1 (preview contract, sponsors), §3 (console), §4 (fan preview), §6 rows 9, 10, 12–16, 23–26.
- Redesign specs: [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md), `admin-preview.spec.md`, `admin-contests.spec.md`, `admin-prizes.spec.md`, `admin-sponsors.spec.md`, `admin-fields-and-optins.spec.md`, `admin-uploads.spec.md`, `admin-branding.spec.md`.
- Console (redesign): `src/components/preview/{FanAppPreview,usePreviewFrame,ContestPreviewTab,PreviewJumpArea}.tsx`, `src/lib/preview/{buildPreviewDocument,sampleContest,previewJump,tiers,unreachableScreens}.ts`, `src/pages/{SponsorPage,FieldsOptins,Branding}.tsx`, `src/pages/prizes/PrizePage.tsx`, `src/pages/contests/{ContestBuilder,OverviewTab}.tsx`, `src/lib/{contests,brandTheme}.ts`.
- Shared (redesign): `api/preview.ts` (`PREVIEW_SCREENS`, `PREVIEW_DEVICES`, `PREVIEW_APPS`, `PreviewDocument`, `PreviewView`), `api/admin/preview.ts`, `api/admin/uploads.ts` (`UPLOAD_FIELDS`), `interfaces/b2b/B2BSponsor.ts` (`SPONSOR_SLOTS`, `PLACEMENT_SLOTS`, `START_PAGE_SPONSORS_MAX`), `interfaces/b2b/ProgressMarker.ts`.
- Fan app (`arthur-fanapp-overhaul`): `src/preview/{runtime,screens,baseQuery,PreviewApp}.ts(x)`.
