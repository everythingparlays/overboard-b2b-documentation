# Webapp Spec: Fan App v2 — Console Touchpoints (Wave 5)

**Implements:** Arthur's 2026-09-27 ruling "Wave order" ("Wave 5 also covers every console part affected by the overhaul, not just Brand: every preview (contest builder and contest page, prize popup, Fields & Opt-ins, sponsor artwork, Brand) and everything tied to them. All of it lives on the same unmerged branch."); the Wave 4 walkthrough rulings (contest previews show only Contest list, Contest detail, Board and Prize; no desktop preview anywhere; the prize preview becomes the same phone preview; Fields & Opt-ins gets the same phone-preview style; Brand previews every screen on a built-in sample contest); the standing rule "function over mocks". Director's decisions W5-D28, W5-D30 to W5-D36 and W5-D47 (`artifacts\wave-2026-09-27\briefs\w5-design-decisions.md`), which rule on the console touchpoint audit (`artifacts\wave-2026-09-27\briefs\w5-console-touchpoints-audit.md`, workspace).

**Depends on:** Wave 4's specs on docs branch `arthur-w4-console` (PR #29, not merged to main): [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) (the `/preview` contract, `PREV-01`–`PREV-15`), `../core-modules/1-draft/admin-preview.spec.md` (`FanAppPreview`, `PV-01`–`PV-12`, `GET /admin/contests/:contestId/preview`, `GET /admin/preview`), `admin-contests.spec.md`, `admin-prizes.spec.md`, `admin-sponsors.spec.md`, `admin-fields-and-optins.spec.md`, `admin-uploads.spec.md`. The Wave 4b fix pass (branches `arthur-w4b-*`; not built at the time of writing): four-screen contest previews with new labels, phone only, the prize rail as the phone preview, Fields & Opt-ins in the phone-preview style, `host: "brand"` and its built-in sample contest, test mode out of the console UI, the re-grounded prize model. This branch is rebased once Wave 4 and 4b merge; every file:line below is from the Wave 4 integration console (`.worktrees\admin-w4-int`, `39116f4`) and is re-checked then. Siblings: [`fan-app-v2.spec.md`](fan-app-v2.spec.md), [`fan-contest-flow.spec.md`](fan-contest-flow.spec.md), [`../core-modules/1-draft/admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md), [`../core-modules/1-draft/fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md).

**Status:** Draft, 2026-09-28, Wave 5 Phase A (new). Built in Phase B on the console's, shared repo's and fan app's `arthur-w5-fanapp` branches; never merged (W5-D29).

## Overview

The console shows fan-app screens in five places and describes fan behaviour in words in many more. On main those describe the current fan app. On the Wave 5 branch the fan app is the overhaul, so every one of them has to show and say what the overhaul does.

**The whole change, in one line:** the console keeps Wave 4's single preview contract and host (`FanAppPreview` framing `/preview`), the overhaul answers it with `app: 'overhaul'` and the same seven screen ids, and Wave 5 changes only what each host sends and says, adds two additive overlays (branding for Brand, membership for Fields), and corrects the console strings whose meaning the overhaul changes.

**In scope:** every console surface that frames fan-app screens; their screen lists and labels; the sample data (Brand only); the editable words; the theme controls; the sponsor artwork boxes as the overhaul renders them; every console field and string whose meaning changes with the overhaul.

**Not in scope:** the console's own look; the Brand page's controls ([`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md)); the fan screens themselves (the sibling fan specs).

---

## The preview contract under the overhaul

**`TOUCH-01` — One contract, one host.** Wave 4's `obs-preview:` protocol, render document and security rules are unchanged (`PREV-15`). One console build previews either fan app: the frame's `ready.app` says which answered (`"current"` on main, `"overhaul"` on the Wave 5 fan app). The console sets `VITE_FAN_APP_ORIGIN` to the Wave 5 fan app's origin for the Wave 5 demo stack.

**`TOUCH-02` — The same seven screen ids, no new ones** (W5-D30). The overhaul answers `ready { v: 1, app: "overhaul", screens: ["start", "signIn", "join", "contests", "contest", "board", "prize"] }`. `PREVIEW_SCREENS` in `obs-b2b-shared/src/api/preview.ts` is a closed enum inside `ready`'s parser, so any new id would make `ready` invalid and the console would show "The fan app didn't load."; no id is added. There is no home screen; Your boards, Profile, Standings and Paused are not preview screens.

**`TOUCH-03` — Phone only** (walkthrough ruling). Wave 5 never sends `device: "desktop"`; `PREVIEW_DEVICES` follows the fix pass (phone only). The frame is 390×844 at 1:1 (`PV-11`).

**`TOUCH-04` — How the overhaul maps the screen ids.**

| Screen id | Overhaul route and state | Session step (Wave 4 `PreviewSessionProvider`) |
|---|---|---|
| `start` | `/`, Start | `signedOut` |
| `signIn` | `/sign-in` | `signedOut` |
| `join` | the join gate in place (join mode) | `signedIn` |
| `contests` | `/contests`, the Current tab (Past when the previewed contest is there) | `member` or `playing` |
| `contest` | `/contest/:contestId`, **the contest detail page**; also `/contest/:contestId/build` and `/build/lines` (the builder belongs to the detail tab's flow) | `member` |
| `board` | `/board/preview-board` (and `/edit`) | `playing` |
| `prize` | the board with the prize popup open for `view.prizeTierIndex` | `playing` |

- **The `contest` tab changes meaning.** On main it shows the draft page ("Draft Your Squad"); on the overhaul it shows the contest detail page, and the builder is one click further (Build my board → Pick your players → Generate).
- **Routes that are not screens** (`/boards`, `/profile`, `/terms`, `/privacy`, `/documents/…`, `/contest/:id/standings`) post `navigated { screen: null }` and the console selects no tab, as Wave 4 already specifies. Their reads are answered from the document (`/boards` from the preview board; `/profile` from `membership`). **Standings are inert in the preview:** the "See standings" link and the board's standings row show their press state and stay, because the preview has no standings to show (the only board in it is the preview's own).

**`TOUCH-05` — The preview data layer learns the overhaul's writes.** **Phase B: to build** in the fan app's `src/preview/baseQuery.ts`: answers for `POST /b2b/contest/:contestId/autofill`, `POST /b2b/board` and `PUT /b2b/board/:boardId/cells` built with the shared `buildBoard` over `document.contest.props`, in memory, exactly as generate is answered today. The consent-document read keeps going to the public endpoint (Wave 4 as-built), except on the Fields host (`TOUCH-12`).

---

## Hosts

**`TOUCH-06` — Screens, labels and sources per host** (W5-D31):

| Host | Where | Tabs (label) | Opens on | Document source | Overlay |
|---|---|---|---|---|---|
| `contest` | Contest page › Preview (`/contests/:contestId/preview`; `ContestPreviewTab.tsx`) | `contests` "Contest list" · `contest` "Contest detail" · `board` "Board" · `prize` "Prize" | `contests` | `GET /admin/contests/:contestId/preview` (real data; a Draft as if published) | none |
| `builder` | Builder › Review (`/contests/:contestId/setup/review`; `ContestBuilder.tsx:1023-1034`) | same four | `contests` | same | `contest`: unsaved name, description, player limit |
| `prize` | Prize page rail (`/prizes/new`, `/prizes/:prizeId`; `PrizePage.tsx:1449-1530`) | `prize` only (no tab row) | `prize` | `GET /admin/preview` + `document.prize` (the prize as typed) | `prize` |
| `sponsor` | Sponsor page frame (`SponsorPage.tsx:664-697`) | `start` "Start" · `board` "Board" · `prize` "Prize" | the focused slot's screen (`SCREEN_FOR`) | `GET /admin/contests/:contestId/preview` for the chosen contest | `sponsor`: unsaved artwork; `view.highlight` |
| `brand` | Brand (`/branding`) | all seven: "Start" · "Sign in" · "Join" · "Contest list" · "Contest detail" · "Board" · "Prize" | `start` | `GET /admin/preview` (`org`, `membership`) + the built-in sample contest | `branding` (W5-D32) |
| Fields host (name from the fix pass) | Fields & Opt-ins (`/config`) | `join` only, join or returning mode | `join` | `GET /admin/preview` | `membership` (W5-D36) |

- The four-tab contest set, its labels, the phone-only chrome, the prize rail as the phone preview, `host: "brand"` and the Fields phone-preview style are the **fix pass's** changes (`HOST_DEFAULTS` and `SCREEN_LABELS` in `FanAppPreview.tsx:56-71` today list all seven for contest and builder, labelled "Contests" and "Contest"). Wave 5 inherits them and adds nothing to the tab sets.
- The `?screen=` values on the contest Preview tab keep the screen ids; `?device=` is gone (fix pass).

### Contest page and builder

**`TOUCH-07` — What the contest tabs show on the overhaul:**
- **Contest list:** the Current (or Past) tab with the previewed contest's card: its console name as the title, its description in full, the featured game as a sub-line (W5-D39), the top prize with its description, the status chyron.
- **Contest detail:** the detail page ([`fan-contest-flow.spec.md`](fan-contest-flow.spec.md) `FLOW-43`), including the limit line (`FLOW-45`) from the builder's unsaved player limit and the real count the preview read carries (`numberParticipants`, the real board count, preview only).
- **Board:** the preview board built by the shared `buildBoard` with no drafted players (Wave 4 rule), with the overhaul's squares, Track and lines; bingos from the shared derived function (W5-D40).
- **Prize:** the overhaul's popup for the chosen tier (`?tier=`), content per W5-D41.
- The Wave 4 Prize tab's "Tier N" selector (max 8 in `FanAppPreview.tsx`) offers only the contest's winnable tiers (`FLOW-46`).

### Prize page

**`TOUCH-08` — The popup preview on Nick's prize model** (W5-D41): the overhaul's popup on its own over the app's background, in the tenant's published theme, showing the tier chyron (from the bingo count the rail sends, `threeInARows: 1` today, "Tier 1 · 1 bingo"), the prize name as the title, description, image, claim instructions and button when set, and "Provided by {sponsor}" resolved from the draft's sponsor. **The code never crosses the frame** (`PV-05`): the preview shows no code row even when the prize has one; the admin sees the code in the page's own Code field. The email line needs an award status and an email address the preview doesn't have, so it is not shown. No value, shipping, pick-up, expiry or type.

### Sponsor page

**`TOUCH-09` — Slots, sizes and placements as the overhaul renders them** (W5-D34). The slot ids, the upload rules and the fan-app boxes are unchanged, so no tenant re-uploads:

| Slot | Upload rule (`UPLOAD_FIELDS`) | Box in the overhaul | Where the overhaul renders it | Preview screen |
|---|---|---|---|---|
| `signIn` (logo or tagline ≤80) | `sponsor.signInLogo`, ≥40px tall | 40px tall, ≤176px wide | **Start only**, as "Presented by" under the band, for the featured game's holder | `start` |
| `boardBanner` | `sponsor.boardBanner`, ≥480px wide | the 480px column (358px on a 390px phone), 4:1 until loaded, then its own ratio, never cropped | the live board, between the counter block and the squares | `board` |
| `slider` | `sponsor.sliderIcon`, ≥36×36 | 36px on the longest side | the Track's marker at that game, in place of the tenant's marker | `board` |
| `prizePopup` (logo) | `sponsor.prizePopupLogo`, ≥48px tall | 48px tall, ≤176px wide in the popup (32×160 in the email) | "Provided by" in the prize popup, for prizes this sponsor provides | `prize` |

- `SCREEN_FOR` (`SponsorPage.tsx:664-669`) stays `{ signIn: "start", boardBanner: "board", slider: "board", prizePopup: "prize" }`.
- The highlight ring stays URL-matched (`src/preview/Highlight.tsx`: signIn → `signInLogo`, boardBanner → `boardBanner`, slider → `sliderIcon`, prizePopup → `prizePopupLogo`); a tagline-only sign-in holder gets no ring (recorded gap). The overhaul's components must render these images with the sponsor's URL as `src` so the ring can find them.
- The sponsor's in-context frame still needs a contest where the sponsor appears; a sponsor in no contest gets no frame (Wave 4 rule; there is no sample contest on the sponsor page).

### Brand

**`TOUCH-10` — Brand is the only host with sample data.** It frames all seven screens on the fix pass's built-in sample contest, with the tenant's real org and gate from `GET /admin/preview` and the draft overlaid through `PreviewOverlay.branding`. The sample's contents, its marking, its fixed board (the additive `PreviewDocument.board?`, so the Board tab always shows two bingos) and the overlay's shape are [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) `BRAND2-26` and `BRAND2-27`. Every other host previews real data only (`PREV-09`).

**`TOUCH-11` — The draft theme reaches only the Brand frame.** The contest, builder, prize, sponsor and Fields hosts paint with the tenant's **published** theme (`org.organization.branding` as served), never a Brand draft, so an unpublished look never appears on another page.

### Fields & Opt-ins

**`TOUCH-12` — The gate preview becomes the overhaul's own gate in the frame** (W5-D36). **Phase B: to build**, after the fix pass restyles the Fields preview as the phone preview:
- The console's `PreviewOverlay` gains an additive `membership?: { signupFields?, pendingConsents?, gateCopy? }` built from the unsaved Fields draft (the same projection `lib/gatePreview.ts` makes today for `WalkableGate`), applied onto `document.membership`.
- **Returning mode** is chosen by an additive `view.gateMode?: "join" | "returning"` on `PreviewView` (loose schema; no new screen id): `returning` puts the preview session at a member with the draft's outstanding items, so the gate renders its returning copy and only what is re-asked.
- **Draft documents.** The frame reads consent documents from the public endpoint (Wave 4 as-built), which can't return an unpublished draft. The render document gains an additive `documents?: { optInId, linkId, textVersion, title, body }[]`, which the preview data layer answers document reads from before the network; only the Fields host sends it.
- The Screen text jumps (walkthrough ruling) map onto the frame: Returning → `view.gateMode: "returning"`; Joining → `join` at the top; Consents & footer → `join` scrolled to the consents block.
- Until this ships, the Fields page keeps the fix pass's phone-styled `WalkableGate`.

---

## Words

**`TOUCH-13` — Two homes for tenant words, each previewed where it is edited:**

| Words | Keys | Edited in | Stored / served | Previewed in |
|---|---|---|---|---|
| Gate copy (exists) | `joinHeading`, `joinSubtitle`, `joinCta`, `returningHeading`, `returningSubtitle`, `consentsHeading`, `footerNote` (≤300), `displayNameLabel` (≤80), `displayNamePlaceholder` (≤120) | Fields & Opt-ins › Screen text (`lib/fieldsDraft.ts:164-195`, `FieldsOptins.tsx:780-810`) | `organization.gateCopy`, on `GET /b2b/membership` | The Fields frame (`TOUCH-12`) |
| Words (**Phase B: to build**, W5-D33) | `startTagline` (60), `startCta` (24), `noContests` (90), `pausedHeading` (40), `pausedBody` (160); `{team}` only | Brand › Words | `branding.text`, on `GET /b2b/org/:subdomain` | The Brand frame (Start, Contest list); paused words have no preview screen |

Brand's Words card links to Fields & Opt-ins › Screen text rather than duplicating gate copy. The sponsor's `signInTagline` (≤80) remains the only other tenant-written fan text besides contest names, descriptions and prize content.

---

## Console fields whose meaning changes

**`TOUCH-14` — Each field, what fans see on the overhaul, and whether its console words stay true:**

| Console field (Wave 4) | What the overhaul does with it | Console change on the Wave 5 branch |
|---|---|---|
| Contest name (`ContestBuilder.tsx:660`, `OverviewTab.tsx`) | The card and detail title, never a game's matchup (W5-D39) | None |
| Description (≤300; help "Fans see this on the contest card.", `ContestBuilder.tsx:709`, `OverviewTab.tsx:346`) | Shown in full on the card **and** the detail page | Help becomes "Fans see this on the contest card and page." |
| Player limit (`maxParticipants`, "No limit / Limit to N players") | The limit line: "N playing" always (once served); "M spots left" and a bar only with a limit (W5-D08) | None |
| States Draft / Open / Closed and Finalized (`lib/contests.ts:242-248`) | Draft unseen; Open under Current (OPEN, or OPENS); Closed under Past, still playable; all games under way → LIVE under Current; Finalized → FINAL under Past | None: "Fans see this contest under Past and keep playing their boards." stays true |
| "Fans can join from …" (`lib/contests.ts:285-289`) | OPENS chyron and "Opens {date}" CTA | None |
| Test mode (`TestModeZone.tsx:52`, `OverviewTab.tsx:758`) | Nothing in the fan UI (W5-D09) | Removed from the UI by the fix pass |
| Prize tiers (`PrizeLadder.tsx`, "N bingos", numbered) | "Tier n · m bingos" chyrons on detail, Track and popup; a tier at 7 or with an incomplete prize is hidden | The tier editor refuses 7 (to confirm at rebase; `FLOW-46`) |
| Prize name, description, image (`PrizePage.tsx`) | Name = the popup's title; description = body text under it | Description help (`PrizePage.tsx:821`, "The headline fans see when they win, in the prize popup and the email.") becomes "What fans read under the prize name, in the prize popup and the email." (W5-D41) |
| Provided by (`PrizePage.tsx:870`) | "Provided by {sponsor}" in the popup and on the detail page's prizes | None |
| Claim button text and link (`PrizePage.tsx:964`, "Fans tap it in the prize popup and the email.") | Kept (traced as used, W5-D41) | None |
| Prize code | Popup for the winner (Phase B) and the email | Field help to say fans see it in the popup and the email once Phase B ships |
| Value, pick-up, shipping, expiry, type | Nothing | Removed by the fix pass's prize reground |
| Opt-ins and documents (`OptInEditor.tsx`, `DocumentsEditor.tsx`, `PlatformDocuments.tsx`) | Documents over the gate, in the side menu (Terms, Privacy, each tenant document) and on Profile with the agreed version; optional opt-ins can be withdrawn on Profile | None |
| Display name (reserved field; meta "Short text · always asked — it's the name on the fan's board", `FieldsOptins.tsx:567`) | Shown on standings, the side menu and Profile; the overhaul's board header shows the contest name | Meta becomes "Short text · always asked — it's the name other fans see on standings" |
| Contest banner (fix pass) | The card's image and the detail band's background | Per the fix pass |
| Sponsor sign-in slot line (`SponsorPage.tsx:411`, "Beneath the headline fans see before they join, and on Home.") | Start only | Becomes "Beneath the headline fans see before they sign in." (W5-D34; there is no Home) |
| Slot editor line (`lib/slotSchedule.ts:18`, "Beneath the headline fans see before they join") | Start only | Becomes "Beneath the headline fans see before they sign in." |
| Paused copy (`Layout.tsx:73-84`; `TenantPage.tsx:1151`, "Fans see a paused screen within a minute…") | The Paused screen with the tenant's paused words | None: still true (the org read is cached a minute) |
| Nav "Games & Contests" (`lib/nav.ts:61`) and ledes "Contests your fans join, the games they run at and what they win." (`ContestBuilder.tsx:132`, `ContestPage.tsx:57`, `Games.tsx:122,289`) | — | None: the console section's own name; the lede is accurate (W5-D35) |

**`TOUCH-15` — String corrections, the complete list** (W5-D35), each a one-line edit on the console's Wave 5 branch with its test expectation updated:

| File:line (Wave 4 integration) | From | To |
|---|---|---|
| `src/pages/SponsorPage.tsx:411` | "Beneath the headline fans see before they join, and on Home." | "Beneath the headline fans see before they sign in." |
| `src/lib/slotSchedule.ts:18` | "Beneath the headline fans see before they join" | "Beneath the headline fans see before they sign in" |
| `src/pages/contests/ContestBuilder.tsx:709` | "Fans see this on the contest card." | "Fans see this on the contest card and page." |
| `src/pages/contests/OverviewTab.tsx:346` | "Fans see this on the contest card." | "Fans see this on the contest card and page." |
| `src/pages/prizes/PrizePage.tsx:821` | "The headline fans see when they win, in the prize popup and the email." | "What fans read under the prize name, in the prize popup and the email." |
| `src/pages/FieldsOptins.tsx:567` | "Short text · always asked — it's the name on the fan's board" | "Short text · always asked — it's the name other fans see on standings" |

No console string uses "game" where it means "contest" (checked by searching the console's strings that mention both fans and games: the contest ledes, Test mode, and Game day's `Live.tsx` and `Operations.tsx` lines each mean real games).

---

## Function audit

### 1. Surfaces: data, calls, states

| Surface | Data sources | Server calls | States covered |
|---|---|---|---|
| Contest Preview tab | `GET /admin/contests/:contestId/preview` | none from the frame (`PV-02`) | before ready, ready, read failed, no ready in 8s, draft as published, closed, finalized, no tiers, test mode (nothing shown) |
| Builder Review | same + `contest` overlay | none | as above, with unsaved name, description, limit |
| Prize rail | `GET /admin/preview` + `document.prize` | none | new prize (no type step any more after 4b), no image, no sponsor, with button, code set (not shown) |
| Sponsor frame | `GET /admin/contests/:contestId/preview` for the chosen contest; `sponsor` overlay | none | no contest (no frame), each slot's screen, tagline-only sign-in (no ring), per-game holder |
| Brand frame | `GET /admin/preview`; sample document (4b)*; `branding` overlay* | none | see [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md) |
| Fields frame | `GET /admin/preview`; `membership` overlay*; `documents`*; `view.gateMode`* | none | join, returning, document over the gate, draft document, no documents |
| Console words | the strings in `TOUCH-15` | none | — |

\* **Phase B: to build.**

### 2. Mock and earlier-design elements

| Element | Fate | Reason |
|---|---|---|
| S2's preview document (`theme`, `brand`, `gate`, `sample` sections; screens Gate, Join, Home, Contest, Board, Prize, Results, Paused) | Cut | Wave 4's contract is authoritative (`PREV-15`, W5-D30) |
| S2's PREVIEW chyron in the frame | Cut | `PREV-09` |
| Phone / Desktop toggle (`FanAppPreview`'s Segmented; `brand-v2.html`) | Cut | No desktop preview anywhere (walkthrough ruling) |
| Contest preview tabs Start, Sign in, Join | Cut from contest hosts | Walkthrough ruling; kept on Brand only |
| Tab labels "Contests", "Contest" | Changed | "Contest list", "Contest detail" (fix pass, W5-D31) |
| A home screen tab | Cut | No home screen |
| Standalone `ContestPreview.tsx`, `PrizePreview.tsx` (only on `arthur-w4-preview`) | Not carried | Dropped in the Wave 4 integration merge |
| `BrandPreviewPanel.tsx` sampler (hard-coded "{team} Bingo", "Play tonight", "Q3", "Touchdown") | Cut | The real frame on a sample contest ([`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md)) |
| Sponsor "and on Home" | Changed | No Home; Start only (W5-D34) |
| Prize code in the preview popup | Cut | `PV-05` |

---

## Rules

- **TOUCH-01 — One contract, one host;** `ready.app` says which fan app answered.
- **TOUCH-02 — Seven screen ids, no new ones.**
- **TOUCH-03 — Phone only.**
- **TOUCH-04 — The overhaul maps the seven ids as tabled; other routes report no screen; standings are inert in the preview.**
- **TOUCH-05 — The preview data layer answers the overhaul's writes in memory** (Phase B).
- **TOUCH-06 — Per-host screens, labels and sources as tabled.**
- **TOUCH-07 — Contest tabs show the overhaul's card, detail, board and popup on real data.**
- **TOUCH-08 — The prize preview shows Nick's fields and never the code.**
- **TOUCH-09 — Sponsor slots and boxes are unchanged; sign-in renders on Start only.**
- **TOUCH-10 — Brand is the only host with sample data.**
- **TOUCH-11 — Only the Brand frame shows a draft theme.**
- **TOUCH-12 — The Fields frame shows the overhaul's gate with a `membership` overlay, `view.gateMode` and draft `documents`** (Phase B).
- **TOUCH-13 — Gate copy is edited and previewed in Fields; Words in Brand.**
- **TOUCH-14 — Every console field keeps its storage; only the words whose meaning changed move.**
- **TOUCH-15 — The six string corrections, and no others.**

## Acceptance criteria

1. With the console pointed at the Wave 5 fan app, every host's frame answers `ready` with `app: "overhaul"` and the seven ids; no host shows a desktop control.
2. The contest Preview tab and the builder's Review offer exactly "Contest list", "Contest detail", "Board", "Prize"; clicking through the frame from Contest list to the card to Build my board keeps the "Contest detail" tab selected; Generate lands on "Board".
3. The Contest detail tab for a contest with no player limit shows no bar and no "spots" text.
4. The prize rail shows the prize name as the title, the description under it, and no code, value, shipping or pick-up, for a prize that has a code.
5. The sponsor page's Sign-in block reads "Beneath the headline fans see before they sign in."; focusing it switches the frame to Start and rings the logo.
6. Only the Brand frame ever shows "Sample contest"; no other host's frame shows a sample name.
7. Editing Team on Brand changes only the Brand frame; the contest Preview tab keeps the published colours.
8. The Fields frame shows the tenant's unsaved field in the overhaul's gate, switches to returning mode from the Returning section, and opens an unsaved document over the gate.
9. The six strings in `TOUCH-15` read as specified, with their tests updated; nothing else in the console changes wording.

## Open questions

Decided since the first draft: the additive `PreviewDocument.board?` and `.documents?` and `PreviewView.gateMode` are accepted for Phase B slice s0 (W5-D47). If the fix pass ships its own Fields host name or returning-mode switch first, Wave 5 adopts it instead of `view.gateMode` at the rebase.

1. **Standings in the preview.** Inert (`TOUCH-04`). Accept, or have the contest preview read return the contest's real standings (display names are visible to admins on the Fans page already)?

## Recorded gaps

- **A tagline-only sign-in sponsor gets no highlight ring** (the ring is found by image URL).
- **The prize preview can't show the email line** (no award status or address in a preview).
- **Paused words have no preview screen** (W5-D30).
- **File:line references** are from the Wave 4 integration console and move when 4b lands; they are re-checked at the Phase B rebase.

## Mocks

`mocks\console-v2\` (Wave 4 console: `contest-preview.html`, `prize-page.html`, `sponsor-page.html`), `mocks\fanapp-v2\brand-v2.html` (workspace). Visual direction only; the function audit lists what changed.

## References

- Console audit: `artifacts\wave-2026-09-27\briefs\w5-console-touchpoints-audit.md` (workspace), §1–§7 and its touchpoint table.
- Decisions: W5-D28, W5-D30–W5-D36, W5-D39, W5-D41.
- Wave 4 specs (`arthur-w4-console`): [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md), `admin-preview.spec.md`, `admin-contests.spec.md`, `admin-prizes.spec.md`, `admin-sponsors.spec.md`, `admin-fields-and-optins.spec.md`, `admin-uploads.spec.md`.
- Console (Wave 4 integration): `src/components/preview/{FanAppPreview,usePreviewFrame,ContestPreviewTab}.tsx`, `src/lib/preview/buildPreviewDocument.ts`, `src/pages/{SponsorPage,FieldsOptins,Branding}.tsx`, `src/pages/prizes/PrizePage.tsx`, `src/pages/contests/{ContestBuilder,OverviewTab,ContestPage}.tsx`, `src/components/{GatePreviewPanel,WalkableGate,BrandPreviewPanel}.tsx`, `src/lib/{contests,slotSchedule,gatePreview,fieldsDraft,nav}.ts`.
- Shared: `api/preview.ts` (`PREVIEW_SCREENS`, `PREVIEW_DEVICES`, `PREVIEW_APPS`, `PreviewDocument`, `PreviewView`), `api/admin/preview.ts`, `api/admin/uploads.ts` (`UPLOAD_FIELDS`), `interfaces/b2b/B2BSponsor.ts` (`SPONSOR_SLOTS`, `PLACEMENT_SLOTS`).
- Fan app (Wave 4 integration): `src/preview/{runtime,screens,baseQuery,Highlight,PreviewApp}.ts(x)`.
