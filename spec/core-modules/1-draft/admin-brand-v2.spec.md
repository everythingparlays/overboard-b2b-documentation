# Core Module Spec: Admin — Brand v2 (Wave 5 branch)

**Implements:** Arthur's 2026-09-27 rulings: "Wave order" (the console's Brand page v2 is built on the Wave 5 branch, never on main), "Priorities" (Satoshi everywhere; no font option on Brand), "Uploads everywhere" (drag-and-drop plus browse, no URL boxes); the Wave 4 walkthrough rulings for Brand (no Sponsors tab; Brand's preview is the one place every screen matters: Start, Sign in, Join, Contest list, Contest detail, Board and Prize on a built-in sample contest, mobile only) and console-wide (no desktop preview; "Leave without saving?" only with unsaved changes); walk #3's Brand baseline (presets, Type, Shape, Finish and Signature removed; the in-console picker; logo and progress marker; the Start page); the standing rule "function over mocks". Director's decisions W5-D01 to W5-D75, all binding (chiefly W5-D28, W5-D31, W5-D33, W5-D43, W5-D46, W5-D52, W5-D65, and the console-redesign rulings W5-D68, W5-D69, W5-D71, W5-D72, W5-D74; `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` and `briefs\w5-phaseB-deltas.md`, workspace), the Phase A review rulings (`artifacts\wave-2026-09-27\briefs\w5-review-rulings.md`, workspace), and Arthur's walk #3 rulings (`artifacts\review-2026-09-27\arthur-rulings-console-final-walk.md`, workspace). Facts: `artifacts\w5\redesign-delta.md` (workspace). PRD `BRAND-01` (as reclassified by `admin-branding.spec.md`), `ADM-02`, `ADM-03`, `TEN-02`.

**Depends on:** the console redesign, branch `arthur-console-redesign` (admin `1385b3e`, shared `41b9c7d`, backend `96d40c9`), which already contains Wave 4 and the Wave 4b fix pass: [`admin-branding.spec.md`](admin-branding.spec.md) ("Revised 2026-09-29 (Walk #3): the four-colour model", its "Start page" section and function audit; `GET/PUT /admin/branding`, `GET/PUT /admin/start-page`), [`admin-uploads.spec.md`](admin-uploads.spec.md) (`UploadField`, fields `brand.logo` and `brand.progressMarker`), [`admin-preview.spec.md`](admin-preview.spec.md) and `../../webapp/fan-preview-mode.spec.md` (`FanAppPreview`, the render document, `GET /admin/preview`, "The preview follows what you point at"), [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) (the nine gate-copy keys). Siblings on this branch: [`fan-decor-system.spec.md`](fan-decor-system.spec.md) (the kit, the band role, the decor params), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md) (where the Words show), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).

**Supersedes:** S2's draft of this spec (docs branch `arthur-s2-fanapp-spec`, PR #23). On the Wave 5 branch only, nothing of `admin-branding.spec.md` beyond what this spec adds: the redesign's Brand page is the base, and Wave 5 extends it.

**Status:** Draft, 2026-09-28, Wave 5 Phase A; **revised 2026-09-29 for the console redesign** (W5-D68–D75). Built in Phase B on `arthur-fanapp-overhaul` in the console, shared and backend repos; never merged to main (W5-D29).

### Revised 2026-09-29: Brand v2 on the redesign

- **The redesign already built most of Brand v2.** Its `pages/Branding.tsx` has the four colours with the in-console picker, the logo and marker uploads, the Start page card, and the real fan app previewing every screen on a built-in sample contest. Brand v2 **consumes** all of that (W5-D74) and adds only what the overhaul needs: **Words**, **Fine-tune**, **"From your logo"** swatches, the fixed sample board, and wording for what Main means on the overhaul.
- **No Presets section** (W5-D71): Prime Time's values are Fine-tune's defaults; Club Level is gone.
- **No Light or dark section:** the fan app's scheme follows Main (W5-D70).
- **Colours are the redesign's:** Main, Accent, Text, Button text (Auto), with the redesign's own inputs (W5-D68). No `palette?` shape, no Second or Live swatch.

## Overview

The redesign's Brand page (`obs-b2b-admin-frontend/src/pages/Branding.tsx`, 648 lines) is a Colors card (Main and Accent through the console's `ColorPicker`, Text and Button text as `InkRow`s, a highlight line, "Reset to starting look" / "Reset to neutral look"), an Images card (Logo, Progress marker), the Start page card (`StartPageSponsorsCard`), and the real fan app as the preview (`FanAppPreview host="brand" fit`) on `withSampleContest`. Draft and publish is one `PUT /admin/branding`, with the page head's Discard and Publish changes, and `useLeaveGuard`.

**The whole change, in one line:** on the Wave 5 branch the same page frames the overhauled fan app and gains a Words card, a folded Fine-tune, "From your logo" swatches in the picker and a fixed sample board, with the Main colour described as the overhaul uses it; everything else is the redesign's page, unchanged.

**In scope:** the Words (storage, endpoint, fan wire, card); Fine-tune (`ThemeSettings.decor`); logo colour sampling; the sample board and the preview overlay's Words key; the Wave 5 wording of the Colors card; the mapping from the stored theme; the endpoints.

**Not in scope:** the Colors card's inputs, the Images card and the Start page card (the redesign's, consumed: [`admin-branding.spec.md`](admin-branding.spec.md)); sponsor artwork (the sponsor page); the nine gate strings (Fields & Opt-ins › Screen text); the kit itself ([`fan-decor-system.spec.md`](fan-decor-system.spec.md)); the console's own look.

---

## Principles

**Function over mocks.** `mocks\fanapp-v2\brand-v2.html` is visual direction. Every control here writes a stored field the overhauled fan app reads, or is cut.

**A palette, not a token editor.** The tenant picks four colours; the kit derives everything else, including the band (`DECOR-43`). The page never offers a control for a derived value (`THEME-03`).

**Carry, don't clobber.** Publishing writes the whole theme; every stored field the page does not edit (the parked `type`, `shape`, `surface`, `motif` blocks) goes back exactly as loaded, as the redesign's draft already does (the draft is the whole `ThemeSettings`).

**The real fan app is the only preview.** The frame is the overhauled fan app's own `/preview` route (`app: 'overhaul'`). The page draws no likeness of a fan screen. The sample contest is the one piece of sample data in the console, and it says so in its own names.

**Consume, don't rebuild** (W5-D74). What the redesign built stays as built; this spec names it and adds only what is missing.

**No narration** (`D-068`). The page never explains what it can't do; gaps are recorded here.

---

## The screen

**Route:** `/branding`, unchanged. **Nav:** the sidebar's **Brand** item (the redesign already removed `SponsorsBrandingHead` and `BrandPreviewPanel`). The page head, its Discard and **Publish changes** buttons, the pick-tenant empty state for staff, `useLeaveGuard` ("Leave without saving?" only with unsaved changes; the browser's own prompt on reload) and the phone-fit layout (`PreviewJumpArea.config-shell--phone`, the preview fitted to the window height) are the redesign's.

**Sections, in order:** Colors · Images · Start page · Words · Fine-tune (collapsed). The first three are the redesign's cards; Words and Fine-tune are Wave 5's.

### 1. Colors (the redesign's card, consumed)

- **`BRAND2-02` (revised 2026-09-29) — Main, Accent, Text and Button text, with the redesign's own inputs** (W5-D68):

| Input | Control (redesign) | Writes | Notes |
|---|---|---|---|
| **Main color** | `ColorPicker` (`components/ui/colorPicker.tsx` + `colorMath.ts`), swatches of the tenant's other colours | `theme.colors.main` | On the overhaul: the band colour when it has colour, and the dark/light scheme (below) |
| **Accent color** | `ColorPicker`, with the contrast readout against Main | `theme.colors.accent` | Buttons, bingo hits, progress; the console accent |
| **Text color** | `InkRow`: White / Black | `theme.colors.text` | Always set |
| **Button text color** | `InkRow`: Auto (white\|black) / White / Black | `theme.colors.buttonText` (absent = auto) | APCA auto, as the redesign resolves it; a set value is used as given |

- The highlight line (`highlightSentence`) and "Reset to starting look" / "Reset to neutral look" (`theme: null`) are the redesign's. Colours are excluded from hover-jump, as built.
- **`BRAND2-07` (revised) — "From your logo."** The picker's `swatches` prop gains up to six swatches labelled "From your logo", after the tenant's other colours, returned by **`POST /admin/branding/sample-colours`** (**Phase B: to build**, s4, review ruling B1). The server maps the logo's public URL to its key under the tenant's `tenants/<organizationId>/` prefix (the redesign's `isTenantUploadUrl` is the guard), reads the object from the bucket, samples it (64×64, alpha ≥ 128, 4-bit buckets, kept when at least 48 apart in RGB, at most six) and answers `{ colours: string[] }` (`#RRGGBB`). The console never reads the image's pixels, so the asset CDN needs no CORS change and there is no deploy. None show when there is no logo, when the logo is a legacy URL outside the bucket, or when the call fails. The picker itself is unchanged.
- **What Main means on the overhaul** (W5-D69, W5-D70). On the overhaul Main does not paint the background: the ground is a dark or light neutral picked by Main's scheme, and Main paints the bands, tabs and headers when it is a colour; a black, white or grey Main hands the bands to a deep shade of Accent (`DECOR-43`). The card's wording says so on the Wave 5 branch ([`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md) `TOUCH-15`: `COLOR_HINTS.main` and the card's lede). No control changes.
- **No Second or Live swatch** and no neutral controls: Second is derived from the band and Live is the scheme's fixed tone (`DECOR-03`, `DECOR-05`); the redesign stores neither.

### 2. Images (the redesign's card, consumed)

Logo (`brand.logo` → `branding.assets.logo`, jump → Start) and Progress marker (`brand.progressMarker` → `branding.assets.sliderTipImageUrl`, jump → Board, default preview the triangle `markerTriangle`), through `UploadField`, as built. On the overhaul the marker rides the Track through the redesign's chain (sponsor → the game's marker → this Brand marker → the triangle in Text, W5-D74). No Wave 5 change.

### 3. Start page (the redesign's card, consumed)

`components/branding/StartPageSponsorsCard.tsx`: the tenant-level Start page sponsors, saved immediately through `PUT /admin/start-page` (≤12, drag and keyboard reorder, the picker), feeding the preview live through `useStartPageDraft`. Specified by [`admin-branding.spec.md`](admin-branding.spec.md) "Start page"; not re-specced here (W5-D74). The overhaul's Start screen renders the same list as "Presented by" ([`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md)). The start tagline and start button stay in Words (§4).

### 4. Words

- **Card title:** "Words". **Help:** "Leave a box empty to use the standard wording. {team} becomes your team's name." **Link line:** "Sign-up screen wording is in Fields & Opt-ins › Screen text." (links to `/config?tab=text`).
- **`BRAND2-14` (revised) — Five strings** (W5-D33):

| Label | Help | Key | Placeholder (the default) | Max | Preview jump |
|---|---|---|---|---|---|
| Start screen tagline | Under your name on the first screen fans see. | `startTagline` | Pick your players. Win prizes. | 60 | `start` |
| Start button | The main button on the first screen. | `startCta` | Continue with email | 24 | `start` |
| No contests message | Shown on Contests when nothing is on. | `noContests` | Check back soon for the next contest. | 90 | `contests`, with the sample's lists emptied while the field has focus |
| Paused heading | Shown while your app is paused. | `pausedHeading` | Taking a quick break | 40 | none (below) |
| Paused message | Under the paused heading. | `pausedBody` | {team} Bingo is paused right now. Your account and anything you've earned are safe — check back soon. | 160 | none |

- **Each input:** the default as its placeholder; a counter "23 / 60" (amber at 90%); `maxLength` stops typing and a paste is cut with "Shortened to 60 characters."; no line breaks; `{team}` is the only token, and any other `{…}` shows "Only {team} can be used here." and disables Publish; blank after trimming means the default (`BRAND2-15`).
- **Preview jump:** each row carries `data-preview-target` (`previewTarget({ screen })`, the redesign's hover-to-preview), so pointing at or focusing an input moves the preview to the screen that shows it.
- **`BRAND2-31` — Paused words get an inline sample, not a phone screen** (W5-D46). Paused is not a preview screen (W5-D30), so under the Paused heading and Paused message inputs the page shows one sample line: the resolved text (default or draft, `{team}` expanded) in the console's own type on the draft's Main and Text colours, inside a small hairline card. It is a text sample, not a rendering of the screen.

### 5. Fine-tune

A disclosure, collapsed by default: "Fine-tune", help "Most looks don't need these." Open state remembered per browser.

| Control | UI | Writes | Values | Shown when absent |
|---|---|---|---|---|
| Decoration | Slider 0–100%, step 5, value "70%" | `theme.decor.intensity` | 0–1 | 70% (Prime Time) |
| Band angle | Slider 0° to −12°, step 1, value "−5°" | `theme.decor.angle` | −12…0 (W5-D43) | −5° (Prime Time) |
| Texture | `Segmented` "None · Bingo grid" | `theme.decor.texture` | `none` / `bingoGrid` | None (Prime Time) |

Help lines: Decoration "The board fragments and glow behind your screens."; Band angle "The slant of the band across your screens."; Texture "A faint board pattern on the page background." **`BRAND2-19` (revised) — Fine-tune maps to the contract exactly** (`ThemeSettings.decor { intensity?, angle?, texture? }`, built by s0 in shared `7b05572`, `DECOR-38`; the console half is s4's), and its defaults are Prime Time's values (W5-D71). A control left at its default stores nothing.

### Publishing, drafts and leaving

- **Publish changes:** the redesign's single `PUT /admin/branding`, with the draft theme (colours, `decor`, the parked blocks), the assets and, on the Wave 5 branch, `text`. Disabled when clean or when a Words field is invalid; "Publishing…" in flight; the redesign's published sentence, extended with "words updated" (`changes.textEdited`).
- **Discard, Reset, leaving:** the redesign's. "Reset to starting look" / "Reset to neutral look" clears the theme only (`theme: null`), never images or words. No draft autosave (walkthrough ruling).

### Screen states

| State | What renders |
|---|---|
| Loading, load failed, staff with no tenant picked, `org:member` read-only, paused tenant | The redesign's states, with the Words and Fine-tune controls disabled wherever the Colors card is |
| No stored theme | The redesign's seed ("starting look") or neutral default; Fine-tune shows Prime Time's values |
| A Words field invalid | Its inline message; Publish disabled |
| Words or `decor` schema not deployed | Publish refuses with the server's 400 above the page (`BRAND2-23` makes this impossible once the schemas ship first) |
| Logo sampling failed, no logo, legacy logo | No "From your logo" swatches |
| Upload not configured | The upload field's own "Uploads aren't set up on this server." |
| Preview failed | The host's "The fan app didn't load." card with Retry; every control and Publish still work |

---

## The preview

**`BRAND2-12` (revised) — The frame is the overhauled fan app on the redesign's sample contest.** The redesign's `FanAppPreview host="brand" fit` (all seven screens, opens on Start, phone only, `PreviewTabs`), pointed at the Wave 5 fan app (`VITE_FAN_APP_ORIGIN`), which answers `ready { app: 'overhaul', screens: [start, signIn, join, contests, contest, board, prize] }` (W5-D30). Tabs: "Start" · "Sign in" · "Join" · "Contest list" · "Contest detail" · "Board" · "Prize", synced to navigation inside the frame. Unchanged from the redesign.

### What Brand sends

| Section | Source |
|---|---|
| `org`, `membership`, `schedule` | `GET /admin/preview` (exists): the tenant's real public org read and gate, with the draft overlaid |
| `contests`, `contest`, `schedule.featured`, `schedule.nextGame` | The redesign's `withSampleContest` (`lib/preview/sampleContest.ts`), consumed |
| `board` | **Phase B: to build (s4):** the fixed sample board (`BRAND2-26`), in `PreviewDocument.board?` (s0, W5-D72) |

**`BRAND2-27` (revised) — The draft overlay is the redesign's** (W5-D72). `PreviewOverlay.branding = { theme?: ThemeSettings | null; assets?: BrandingAssets }` and `PreviewOverlay.startPage = { sponsors }` as built: `overlayBranding` writes the draft theme (which now carries `decor`) and the four asset keys into `org.organization.branding`; `overlayStartPage` writes `schedule.startPage` and `schedule.sponsors`; order branding → sample → startPage. **The one Wave 5 addition** is `branding.text?: BrandText`, written by `overlayBranding` into `org.organization.branding.text`, so the draft Words reach Start and Contest list. **Phase B: to build (s4):** that key and its test. The public branding schema accepting `text` and the stored theme carrying `decor` (else the frame's parse would drop them) are built by s0 (`7b05572`). Sent on every draft change, debounced ~100ms, as built.

### The sample contest

**`BRAND2-26` (revised) — The sample is the redesign's `withSampleContest`, consumed** (W5-D31: reuse, never a parallel fixture). It is nobody's data and is never written anywhere; it marks itself by its own names; the frame carries no chyron (`PREV-09`) and the console adds no label (`PV-08`).

| Part | Contents (as built on the redesign, unless marked) |
|---|---|
| Contest | "Sample contest"; description "Draft your players, fill your board and chase three in a row to win."; bingo; open; `maxParticipants` 0 (no limit bar); marked test mode so a board builds after "kick-off"; the tenant's brand band as its banner |
| Game | One: "Northfield Foxes @ Harbor City Hawks", an hour after the render, `Scheduled`, drawn team marks (no fetched image), NFL |
| Players | Six (three per team), `showPhotoUri: false`, so every square shows the kit's no-photo fallback (gradient, jersey number, name), a real state for any player without a photo |
| Props | Two per player, `Over`, multipliers 1.4–3.5, seven already `Hit` |
| Board | **Phase B: to build (s4):** a fixed nine-prop board in `PreviewDocument.board?` (nine prop ids in `BOARD_POSITIONS` order), chosen from the sample's props so **row 1 and column 1 are complete (two bingos)** and the other four cells are not hits. The frame's preview layer uses it instead of `buildBoard`, whose fallbacks shuffle (W5-D47, W5-D72). Only the Brand host sends it. The count comes from the shared `boardBingos` the real board uses (W5-D75) |
| Prize tiers | "Team scarf" (1 bingo), "Signed mini helmet" (4), "Two tickets to a home game": at 7 on the redesign, **moved to 8 on the Wave 5 branch (s4)**, because the overhaul hides a tier at 7 as unwinnable (`FLOW-46`), which would leave the Prize tab's third tier pointing at nothing |
| Schedule | The tenant's own Start page sponsors, in order; no placements; `nextGame` null (the Start screen shows no matchup, walk #3) |
| Standings | None: the sample carries no `standings`, so its standings link shows the real empty state (W5-D52) |
| Prize tab | The popup for the chosen tier (`view.prizeTierIndex`) |

- **Why the tenant's real gate but a sample contest:** the gate's fields and opt-ins are the tenant's live configuration and belong in a brand check; a real contest would show real players and real prizes under an unpublished look and would be missing for a tenant with no contests.
- **No contests state:** while the No contests message input has focus, Brand builds the document with `contests: { upcoming: [], past: [] }` instead of the sample's list, so the Contest list tab shows the Current tab's empty state with the draft `noContests` text.

---

## Words: storage, endpoint and fan wire

**`BRAND2-16` (revised) — `branding.text`**: the shared half is **built by s0** (`7b05572`: `theme/brand-text.ts`, the PUT contract, the public org schema, Mongoose); the backend handler and the fan read's projection are s4's:

```ts
// obs-b2b-shared/src/theme/brand-text.ts (new)
export const BRAND_TEXT_KEYS = ["startTagline", "startCta", "noContests", "pausedHeading", "pausedBody"] as const;
export type BrandTextKey = (typeof BRAND_TEXT_KEYS)[number];
export const BRAND_TEXT_MAX: Record<BrandTextKey, number> = {
  startTagline: 60, startCta: 24, noContests: 90, pausedHeading: 40, pausedBody: 160,
};
export const BRAND_TEXT_DEFAULTS: Record<BrandTextKey, string> = { /* the placeholders above */ };
export type BrandText = Partial<Record<BrandTextKey, string>>;
export function brandTextProblem(key, value);         // "tooLong" | bad token | …, per key after trimming
export function cleanBrandText(text);                 // trims, drops blanks
export function resolveBrandText(text: BrandText | undefined, teamName: string): Record<BrandTextKey, string>;
// B2BOrganization.ts: BrandingSettings gains `text?: BrandText` beside theme and assets.
```

- **Mongoose:** a typed `_id: false`, `default: undefined` subschema with a `maxlength` per key (`THEME-11`; never `Mixed`).
- **`PUT /admin/branding`** (exists) accepts `text` with the same three states as `assets`: absent leaves it, `null` clears it, an object replaces it whole. Empty keys are dropped; an empty object is `$unset`. `changes` gains `textEdited`. **`GET /admin/branding`** and the PUT response echo `text`. `theme: null` never clears `text`.
- **`GET /b2b/org/:subdomain`** (exists) projects `text` key by key into `organization.branding.text` (`THEME-16`'s allowlist) and serves it while suspended (`THEME-18`), so the paused words reach a paused app. `publicBrandingSchema` gains `text`.
- **`BRAND2-23` — The schemas widen first.** `text` and theme `decor` are accepted by zod (`themeSettingsSchema`, `storedThemeSchema`, `publicBrandingSchema`) and Mongoose on the backend and the fan read before the page can publish them; until then the non-strict `themeSettingsSchema` strips `decor` silently.

---

## Mapping from the stored theme

No data migration (`BRAND2-20`). Every read goes through the redesign's `normalizeTheme`; every field is carried through on publish unless the page edits it.

| Stored field | Brand v2 control | Read by the overhauled fan app | On publish |
|---|---|---|---|
| `theme.colors.main` | Main color (redesign) | yes: scheme and, when chromatic, the band (`DECOR-43`, `DECOR-44`) | written |
| `theme.colors.accent` | Accent color (redesign) | yes: buttons, hit, and the band when Main has no colour | written |
| `theme.colors.text` | Text color (redesign) | yes (`DECOR-41`) | written |
| `theme.colors.buttonText` | Button text color (redesign) | yes (`DECOR-42`) | written or absent (auto) |
| `theme.decor.intensity`, `.angle`, `.texture` (**Phase B**, s0) | Fine-tune | yes | written when not the default |
| `theme.type`, `theme.shape`, `theme.surface`, `theme.motif` (parked) | none | only `shape.radiusBase` (kit radii) | carried through |
| `assets.logo` | Logo (redesign) | yes | written |
| `assets.sliderTipImageUrl` | Progress marker (redesign) | yes (the marker chain's Brand step) | written |
| `assets.sponsorName`, `assets.sponsorLogo` | none (legacy) | no | carried through |
| `text` (**Phase B**) | Words | yes | written |
| `startPageSponsorIds` (organization, top level) | Start page (redesign) | yes (Start's "Presented by") | `PUT /admin/start-page`, immediate |

---

## Endpoints

| Method | Path | Status | Change on the Wave 5 branch | Auth |
|---|---|---|---|---|
| GET | `/admin/branding` | exists | echoes `text`; theme may carry `decor` (Phase B) | `requireAdmin` |
| PUT | `/admin/branding` | exists | accepts `text` and theme `decor` (Phase B) | `requireAdmin` + write gate |
| GET, PUT | `/admin/start-page` | exists (redesign) | none | `requireAdmin` (+ write gate on PUT) |
| POST | `/admin/uploads`, `/admin/uploads/complete` | exist | none; fields `brand.logo`, `brand.progressMarker` | `requireAdmin` + write gate |
| GET | `/admin/preview` | exists | none; Brand uses its `org`, `membership` and `schedule` | `requireAdmin` |
| GET | `/b2b/org/:subdomain` | exists | `branding.text` in the projection; theme `decor` carried (Phase B) | public |
| POST | `/admin/branding/sample-colours` | new (review ruling B1) | `{ url }` of the uploaded logo → `{ colours: string[] }` (at most six); 404 for a URL outside the tenant's upload prefix (`isTenantUploadUrl`); writes nothing (Phase B: to build, s4) | `requireAdmin` (any scope; it reads only) |

Unchanged: tenant targeting (`?tenant=` for staff only), the read-only refusal first (`THEME-13`), no reverification anywhere (removed platform-wide on the redesign), `clearOrgCache()` on every branding write (`THEME-15`).

---

## Rules

Kept from S2 (revised where noted): `BRAND2-02`, `BRAND2-04`, `BRAND2-07`, `BRAND2-12`, `BRAND2-14`–`BRAND2-17`, `BRAND2-19`–`BRAND2-21`, `BRAND2-23`–`BRAND2-25`. New: `BRAND2-26`–`BRAND2-28`, `BRAND2-30`–`BRAND2-33`.

- **BRAND2-02 — Colors are the redesign's four inputs:** Main, Accent (`ColorPicker`), Text (White/Black), Button text (Auto/White/Black); no Second, Live or neutral control.
- **BRAND2-04 — No native popups,** as the redesign's picker already guarantees, except the file chooser behind an upload and native range sliders.
- **BRAND2-07 — "From your logo" swatches come from the server's sampling,** fed into the redesign's picker; the picker is unchanged.
- **BRAND2-12 — The real overhauled fan app is the only preview,** on the redesign's `host: "brand"`, seven tabs, phone only, fed by the tenant's real org and gate and the redesign's sample contest.
- **BRAND2-14 — Five Words, no more:** `startTagline`, `startCta`, `noContests`, `pausedHeading`, `pausedBody`, `{team}` only. Gate strings stay in Fields & Opt-ins.
- **BRAND2-15 — Blank means standard.**
- **BRAND2-16 — Words reach fans through the public org allowlist**, also while suspended.
- **BRAND2-17 — Images are the redesign's upload fields;** legacy URLs are honoured and carried through.
- **BRAND2-19 — Fine-tune maps to `decor { intensity, angle, texture }` exactly,** Prime Time's values as defaults.
- **BRAND2-20 — No data migration.**
- **BRAND2-21 (revised) — Every tenant gets the overhaul's look on the Wave 5 branch** with Prime Time's decor values until they set their own; no republish needed.
- **BRAND2-23 — The schemas widen first.**
- **BRAND2-24 — Access is unchanged:** `org:admin` and staff write, `org:member` reads, nothing is reverified.
- **BRAND2-25 — No gap narration on the page.**
- **BRAND2-26 — The sample is the redesign's `withSampleContest`,** plus the fixed two-bingo board and a winnable top tier; never written anywhere.
- **BRAND2-27 — The draft reaches the frame through the redesign's `PreviewOverlay.branding` and `startPage`;** Wave 5 adds only `branding.text`; no protocol change.
- **BRAND2-28 — Carry, don't clobber:** publish sends every unedited stored field back unchanged.
- **BRAND2-30 — "Leave without saving?" only with unsaved changes** (the redesign's `useLeaveGuard`).
- **BRAND2-31 — Paused words show an inline sample line; no phone screen.**
- **BRAND2-32 (revised) — The Start page is the redesign's card, consumed** (W5-D74).
- **BRAND2-33 — The Colors card describes Main as the overhaul uses it** (the band and the scheme, `TOUCH-15`).

### Retired

| ID | Was | Why |
|---|---|---|
| BRAND2-01 | Presets first; applying one changes the look, never the palette | No presets (W5-D71) |
| BRAND2-03 | No neutral controls; stored neutrals carried through | The redesign stores no neutrals (`normalizeTheme`); nothing to carry |
| BRAND2-05, BRAND2-06 | The Wave 5 picker is keyboard-complete; hex always visible | The redesign's `ColorPicker` is the picker (W5-D68); its own behaviour stands |
| BRAND2-08, BRAND2-09 | One font choice from shared pairings | Satoshi only; no font option (ruling) |
| BRAND2-10 | Mode switches go through `withMode` | No mode (W5-D70) |
| BRAND2-11 | Preset thumbnails from shared kit pieces | No presets (W5-D71); no `ui/kit` lift |
| BRAND2-13 | The Light/Dark peek never touches the draft | No mode and no peek (W5-D27, W5-D70) |
| BRAND2-18 | Upload limits PNG/SVG/WebP ≤1 MB via S2's own route | The redesign's upload fields |
| BRAND2-22 | Stale v1 drafts discarded once; draft key `:branding-v2` | No draft autosave |
| BRAND2-29 | Publish needs an Accent | Accent is always stored (`normalizeTheme`, W5-D68) |

---

## Function audit

### 1. Surfaces: data, calls, states

| Surface | Data sources | Server calls on admin action | States covered |
|---|---|---|---|
| Brand page (redesign) | `GET /admin/branding` (theme, assets; `text`*, theme `decor`*) | `PUT /admin/branding` (publish; `text`*, `decor`*); `PUT /admin/start-page` (Start page card, immediate); `POST /admin/uploads` + `/complete` | the redesign's states; invalid words*; schema not deployed* |
| Colors card (redesign) | draft colours; the logo's URL | `POST /admin/branding/sample-colours`* | auto / set Button text; no logo; legacy logo (no swatches); sampling failed |
| Words card* | draft `text` | none (published with the page) | default, set, over-limit paste, bad token, blank |
| Fine-tune* | draft `theme.decor` | none (published with the page) | absent (Prime Time), set, back to default |
| Preview (redesign) | `GET /admin/preview`; `withSampleContest`; fixed board*; `PreviewOverlay.branding` (+ `text`*) and `startPage` | none | before ready, ready, failed, no contests (Words focus), each of seven tabs |

\* **Phase B: to build.**

### 2. Mock elements (`brand-v2.html`)

| Mock element | Fate | Reason |
|---|---|---|
| 03 "Font" section (Broadcast, Classic, Modern, Grotesk, Editorial) | Cut | Satoshi only; no font option (ruling) |
| 01 Presets shelf (Prime Time, Club Level, Yours, Save current look) | Cut | No presets (W5-D71); Prime Time's values are Fine-tune's defaults |
| 04 "Light or dark" and the preview's "Peek at mode" toggle with "Peeking at light" | Cut | No mode; the scheme follows Main (W5-D70); no peek (W5-D27) |
| "Device: Phone / Desktop" toggle, browser-chrome desktop frame at 50% | Cut | Mobile only; no desktop preview anywhere (walkthrough ruling) |
| Preview tabs Gate · Join · Home · Contest · Board · Prize, more Results · Paused | Changed | The seven screens (W5-D30), as the redesign labels them |
| PREVIEW chyron inside the frame (`?preview=1`) | Cut | `PREV-09`: no marker; the sample marks itself by its names |
| Caption "Your draft as fans will see it. Nothing changes for them until you publish." | Cut | `PV-08`: no label around the frame |
| Sponsors as a Brand tab | Cut | Walkthrough ruling; removed on the redesign |
| Colours help "Main is required. The other three follow it until you change them." | Changed | The redesign's four inputs; Main's hint rewritten for the overhaul (`TOUCH-15`) |
| Accent, Second and Live swatches with "Auto" chips | Changed / cut | Accent is stored; Second and Live are derived and never shown (W5-D68) |
| The mock's own picker (square, strip, hex, logo row) | Changed | The redesign's `ColorPicker`, with "From your logo" as extra swatches (W5-D68) |
| "From your logo" swatches | Kept | Server-side sampling endpoint (s4, review ruling B1) |
| Contrast chip "Text on Main: white, 18.1:1" | Changed | The redesign's readout against Main |
| "PNG, SVG or WebP, up to 1 MB" | Changed | The redesign's upload rules |
| Logo tile, Replace, Remove | Kept | The redesign's `UploadField` |
| Words: "No contests message: Shown on Home when nothing is scheduled." | Changed | Key `noContests`, shown on Contests (no home) |
| Words: other four inputs with counters | Kept | `branding.text` (Phase B) |
| 07 Fine-tune (collapsed) | Kept | `decor { intensity, angle, texture }` (W5-D71) |
| Footer "Use the standard look", "Discard draft", "Publish" | Changed | The redesign's page head (Discard, Publish changes) and Reset to starting/neutral look |
| Barlow Condensed, Fraunces, Instrument Sans, Space Grotesk, IBM Plex, Fontshare Satoshi (`brand-v2.html` head) | Cut | The console uses its own self-hosted Satoshi |

### 3. Cut or changed by the console-redesign delta (W5-D68–D75)

| Element (earlier draft of this spec) | Fate | Reason |
|---|---|---|
| Presets section: Overboard shelf (Prime Time, Club Level), Gallery, Yours (20, `THEME_PRESET_CAP`), Save current look, Rename, Delete, Add to gallery; `PUT /admin/branding/presets`, `POST /admin/branding/promote` | Cut | Presets removed on the redesign and by ruling (W5-D71); Club Level gone (W5-D53 withdrawn) |
| Preset thumbnails from shared `ui/kit` (W5-D48) | Cut | No presets (W5-D71) |
| "Light or dark" section writing `mode` | Cut | No mode; the scheme follows Main (W5-D70) |
| Stored `palette? { main, accent, text?, buttonText? }`, with `colors.primary`/`colors.accent` kept equal | Cut | The redesign's `colors` is the four-colour shape (W5-D68) |
| Wave 5's own picker (`components/ui/ColorPicker.tsx`, `lib/color-hsv.ts`), 96/64px swatches, Text White/Black presets in the picker | Cut | The redesign's `ColorPicker` and `InkRow`s (W5-D68) |
| Contrast readout from the kit's resolver; "The app lifts it to 4.5:1" notes | Cut | The redesign's readout; Button text is not re-guarded (W5-D68) |
| Button text override guarded ≥4.5:1 on Accent | Cut | The redesign's APCA auto, a set value used as given (W5-D68) |
| "Choose an accent" state; Publish disabled without Accent (`BRAND2-29`) | Cut | Accent is always stored (W5-D68) |
| Second and Live carried through as stored colours | Cut | Neither is stored on the redesign (W5-D68) |
| Start page section built by Wave 5 (`branding.startPage.sponsorIds`, published with the draft, `startPage` on the sponsor read) | Cut | Built on the redesign; the card is consumed (W5-D74) |
| Fine-tune texture writing `surface.texture` | Changed | `decor.texture` (W5-D71) |
| Wave 5's sample document (`sampleDocument.ts`: two games, eight "Sample Player" players, "Sample prize 1–3") | Cut | The redesign's `withSampleContest` is the source (W5-D31, W5-D74); only the fixed board and the top tier change |
| `PreviewOverlay.branding { theme, logo, sliderTipImageUrl, text, startPageSponsorIds }` | Changed | The redesign's `{ theme, assets }` and `startPage` overlay; logo and marker ride in `assets`, decor rides in `theme`; only `text` is added (W5-D72) |
| `PreviewDocument.documents?`, `view.gateMode`, `membership` overlay | Cut | Not used by Brand; dropped (W5-D72) |
| Brand's own footer ("Use the standard look", "Discard draft", "Publish") and leave dialog | Changed | The redesign's page head, Reset, and `useLeaveGuard` |

---

## Acceptance criteria

1. `/branding` on the Wave 5 branch shows Colors, Images, Start page, Words and Fine-tune (collapsed), in that order, and no Presets, Light or dark, Font section, Sponsors tab, device toggle, peek toggle, Second swatch or Live swatch.
2. The Colors card's inputs are the redesign's (`ColorPicker` for Main and Accent, `InkRow`s for Text and Button text); with an uploaded logo, the Main and Accent pickers offer up to six "From your logo" swatches; with no logo or a legacy URL, none.
3. `POST /admin/branding/sample-colours` returns at most six `#RRGGBB` colours for the tenant's own upload and 404 for a URL outside its prefix.
4. Main's hint and the card's lede describe the band and the scheme, not "the background of every screen".
5. `PUT /admin/branding` with `text: { startTagline: "Go {team}" }` stores it, `GET /b2b/org/:subdomain` returns it in `organization.branding.text` (also for a paused tenant), and a 61-character `startTagline` or a `{name}` token is refused with 400.
6. Blank Words values publish as absent and the fan app shows the defaults.
7. Fine-tune at its defaults stores no `decor`; moving Decoration to 40%, Band angle to −8° and Texture to Bingo grid stores `decor: { intensity: 0.4, angle: -8, texture: "bingoGrid" }`, which `GET /admin/branding` and the fan org read return; the parked `type`, `shape`, `surface` and `motif` blocks are byte-identical after publish.
8. The preview frame answers `ready` with `app: 'overhaul'`; the tabs read Start, Sign in, Join, Contest list, Contest detail, Board, Prize; there is no Phone/Desktop control.
9. The Contest list tab shows only "Sample contest"; the Board tab shows exactly two bingos (row 1 and column 1) with every square on the no-photo fallback; the Prize tab offers three tiers, the third at 8 bingos; none of the tenant's real contests, players or prizes appears.
10. Changing Main repaints the frame within ~100ms of the last change, without a publish; the tenant's live fan app is unchanged until Publish changes.
11. Focusing the No contests message input shows the Contest list tab's empty state with the draft text; focusing the Start screen tagline input moves the preview to Start with the draft tagline.
12. An `org:member` sees every control disabled, including Words and Fine-tune, and a working preview.
13. Leaving with unsaved Words or Fine-tune changes asks "Leave without saving?"; leaving a clean page asks nothing.

## Open questions

None. Decided since the first draft: the draft Words reach the frame through one added key, `PreviewOverlay.branding.text` (s4's brief sends "the draft theme, decor and text through `PreviewOverlay.branding`"; `PreviewDocument` is unchanged, W5-D72); the paused words' inline sample (W5-D46), the band angle (W5-D43), the fixed sample board (W5-D47, W5-D72), no presets (W5-D71), the redesign's colour inputs (W5-D68), the consumed Start page (W5-D74).

## Recorded gaps

- **"From your logo" works only for logos uploaded through the redesign's field**; a legacy URL outside the bucket shows no swatches.
- **The highlight line and the Accent contrast readout are the redesign's**, computed with the current app's resolver: on the overhaul the hit is Accent-ink measured on the kit's surface, so the named shade can differ slightly.
- **Paused words have no phone preview**, only the inline sample line (`BRAND2-31`).
- **The parked theme blocks stay stored and unedited;** the overhaul reads only `shape.radiusBase`.
- **Last write wins between two admins**, as everywhere in the console.
- **Orphaned uploads** stay in the bucket.

## Mocks

`mocks\fanapp-v2\brand-v2.html` (workspace), visual direction only; the function audit lists every deviation.

## References

- Rulings (workspace): `artifacts\review-2026-09-27\arthur-rulings-2026-09-27.md` (Wave order, Priorities, Uploads everywhere); `arthur-rulings-wave4-walkthrough.md` (Console-wide, Brand); `arthur-rulings-console-final-walk.md` (walk #3: Brand baseline, Start page, no matchup).
- Decisions: `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` (W5-D28, D30, D31, D33, D43, D46, D47); `briefs\w5-phaseB-deltas.md` (W5-D68–D74). Facts: `artifacts\w5\redesign-delta.md` §1 (theme, branding wire), §3 (Brand page, overlays, sample), §6 rows 1, 4, 6–10, 12, 19, 20.
- Redesign specs: [`admin-branding.spec.md`](admin-branding.spec.md), [`admin-uploads.spec.md`](admin-uploads.spec.md), [`admin-preview.spec.md`](admin-preview.spec.md), `../../webapp/fan-preview-mode.spec.md`, [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md).
- Siblings: [`fan-decor-system.spec.md`](fan-decor-system.spec.md), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).
- Console (redesign): `src/pages/Branding.tsx`, `src/components/ui/{colorPicker.tsx,colorMath.ts}`, `src/components/branding/StartPageSponsorsCard.tsx`, `src/components/preview/FanAppPreview.tsx`, `src/lib/preview/{buildPreviewDocument,sampleContest,startPageDraft,previewJump}.ts`, `src/lib/{brandTheme,defaultArtTheme,useLeaveGuard}.ts(x)`.
- Shared (redesign): `interfaces/b2b/B2BOrganization.ts` (`ThemeSettings`, `BrandingSettings`), `api/admin/branding.ts` (`themeSettingsSchema`, `storedThemeSchema`), `api/b2b/org.ts` (`publicBrandingSchema`), `api/preview.ts`, `api/admin/uploads.ts`, `theme/{normalize,resolve,seeds}.ts`.
- Backend (redesign): `node-server/src/handlers/admin/branding.ts`, `util/admin-branding.ts`, `util/uploaded-asset.ts` (`isTenantUploadUrl`), `handlers/org/getOrganization.ts`, `handlers/admin/preview.ts`.
