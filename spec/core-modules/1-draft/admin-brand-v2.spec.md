# Core Module Spec: Admin — Brand v2 (Wave 5 branch)

**Implements:** Arthur's 2026-09-27 rulings: "Wave order" (the console's Brand page v2, as mocked with the fan-app v2 mocks, is built on the Wave 5 branch, never on main), "Priorities" (Satoshi everywhere; remove the font option from Brand), "Uploads everywhere" (drag-and-drop plus browse, no URL boxes); the Wave 4 walkthrough rulings for Brand (remove the Sponsors tab; Brand's preview is the one place every screen matters: Start, Sign in, Join, Contest list, Contest detail, Board and Prize on a built-in sample contest, mobile only) and console-wide (no desktop preview; "Leave without saving?" only with unsaved changes); the standing rule "function over mocks". Director's decisions W5-D24, W5-D27, W5-D28, W5-D31, W5-D32, W5-D33, W5-D43, W5-D46, W5-D47, W5-D48. PRD `BRAND-01` (as reclassified by `admin-branding.spec.md`), `ADM-02`, `ADM-03`, `TEN-02`.

**Depends on:** Wave 4's specs on docs branch `arthur-w4-console` (PR #29, not merged to main; this branch is rebased after Wave 4 and the 4b fix pass merge): [`admin-branding.spec.md`](admin-branding.spec.md) (the theme contract, presets and gallery, storage, `GET/PUT /admin/branding`, `PUT /admin/branding/presets`, `POST /admin/branding/promote`, the fan wire, `THEME-03`–`THEME-20`), [`admin-uploads.spec.md`](admin-uploads.spec.md) (`UploadField`, `POST /admin/uploads`, `POST /admin/uploads/complete`, fields `brand.logo` and `brand.progressMarker`), [`admin-preview.spec.md`](admin-preview.spec.md) and `../../webapp/fan-preview-mode.spec.md` (`FanAppPreview`, the render document, `GET /admin/preview`), [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) (the nine gate-copy keys). The Wave 4b fix pass (not built at the time of writing): `host: "brand"` and its built-in sample contest source (W5-D31). Siblings on this branch: [`fan-decor-system.spec.md`](fan-decor-system.spec.md) (the palette, tokens, decor params, Prime Time), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md) (where the Words show), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).

**Supersedes:** S2's draft of this spec (docs branch `arthur-s2-fanapp-spec`, PR #23): its Font section and pairings, its Light/Dark peek and "Peeking at…" line, its Phone/Desktop toggle, its upload route (`POST /admin/assets/uploads`, 1 MB), its render-document `brand` and `sample` sections, Club Level on the shelf, and "Live" as a fourth swatch in the main row. On the Wave 5 branch only: `admin-branding.spec.md`'s "The screen" section, its "Live preview" and `THEME-21` (the `BrandPreviewPanel` sampler).

**Status:** Draft, 2026-09-28, Wave 5 Phase A. Built in Phase B on `arthur-w5-fanapp` in the console, shared and backend repos; never merged to main (W5-D29). On main the Brand page stays as Wave 3 and 4 left it.

## Overview

Today's Brand page (`obs-b2b-admin-frontend/src/pages/Branding.tsx`, under the `SponsorsBrandingHead` tabs) asks for Look, seven colours (four plus Page, Cards, Text under Advanced) through native colour inputs, Type (transform and weight), Shape, Finish, Signature, Images (upload fields in Wave 4) and presets at the bottom, and previews a hand-built sampler (`BrandPreviewPanel.tsx`: the shared `EntryGatePreview`, a ring gauge, a stat fraction, and hard-coded sample strings). None of it shows the overhauled fan app.

**The whole change, in one line:** Brand becomes presets on top, a two-to-four colour palette with an in-page picker, light or dark, the logo and marker uploads, five editable Words and a folded Fine-tune, previewed in the real overhauled fan app on a built-in sample contest, with every stored field it doesn't edit carried through untouched.

**In scope:** the `/branding` screen and its states; the in-page colour picker; the preset shelf; the Words (storage, endpoint, fan wire); the mapping from today's `ThemeSettings`; the preview host, its sample document and its draft overlay; the endpoints.

**Not in scope:** sponsor artwork (the sponsor page); the nine gate strings (Fields & Opt-ins › Screen text); the kit itself ([`fan-decor-system.spec.md`](fan-decor-system.spec.md)); the console's own look.

---

## Principles

**Function over mocks.** `mocks\fanapp-v2\brand-v2.html` is visual direction. Every control here writes a stored field the overhauled fan app reads, or is cut.

**A palette, not a token editor.** The tenant picks two to four colours; the kit's resolver derives everything else. The page never offers a control for a derived value (`THEME-03`).

**Carry, don't clobber.** Publishing writes the whole theme, and every stored field the page does not edit is sent back exactly as loaded. A tenant whose theme was set on main's Brand page keeps every value main reads.

**The real fan app is the only preview.** The frame is the overhauled fan app's own `/preview` route (Wave 4 contract, `app: 'overhaul'`). The page draws no likeness of a fan screen. The sample contest is the one piece of sample data in the console, and it says so in its own names.

**No narration** (`D-068`). The page never explains what it can't do; gaps are recorded here.

---

## The screen

**Route:** `/branding`, unchanged. **Nav:** the sidebar's **Brand** item; **Sponsors** is its own item. The `SponsorsBrandingHead` tab head (Brand | Sponsors) is removed from this page (walkthrough ruling). The page head: eyebrow "Configuration", title "Brand", sub "How your fan app looks." The pick-tenant empty state for staff and the `key={qs}` remount on a tenant switch are unchanged.

### Layout

- **1100px and wider:** two columns. Controls on the left (max 440px, sections 24px apart); the preview on the right, sticky at the top, the phone frame at 390×844, never scaled (`PV-11`).
- **Narrower:** one column. The preview is a collapsible panel under the page head, collapsed by default, opened by a 48px bar reading "Preview · {screen}"; open, it shows the tabs and the frame (at most 70vh, the frame scrolling inside it).
- **Footer bar:** sticky under the controls: a status line ("Unpublished changes" while dirty), **Use the standard look** (ghost), **Discard draft**, **Publish** (primary).

### 1. Presets

- **Card title:** "Presets". **Help:** "Start from a look. Your colours stay yours."
- **Shelves:** **Overboard** (Prime Time only, `DECOR-37`); **Gallery** (staff-curated, hidden when empty, as today); **Yours** (the tenant's saved looks, up to 20 (`THEME_PRESET_CAP`), then a **Save current look** card).
- **Card:** a 148×104 thumbnail and the name; the whole card is one button "Apply {name}". The card matching the draft's look shows a 2px Team ring and an "In use" chip. Yours cards have a ⋯ menu (in-page, not native) with **Rename**, **Delete** (inline "Delete {name}? This can't be undone." with Delete and Cancel, because the whole array is rewritten), and **Add to gallery** (OBS staff only, as today).
- **Save current look:** the card becomes a name input (max 60, "Name this look", Save, Cancel) and writes the whole array through `PUT /admin/branding/presets` (exists). At 20 it is disabled with "You can keep 20 looks. Delete one to save another."
- **Thumbnail:** a static composition of three kit pieces (a `HeroBand` fragment, one `Chyron` reading "LIVE", two `Square`s, one hit and one pending) painted by the kit's resolver from the draft palette and the preset's mode and decor params. It is a swatch of a look, never a preview of the tenant's app, and shows no data. The console renders them with the kit components lifted to `obs-b2b-shared/src/ui/kit/` in Phase B slice s0 and never re-implements them (W5-D48, `DECOR-40`). **Phase B: to build.**
- **`BRAND2-01` (revised) — Applying a preset changes the look and never the palette.** It takes the preset's `mode`, decor params (`decor.intensity`, `decor.angle`), `surface.texture` and `shape.radiusBase`, and keeps Team, Second, Accent and Live. The one exception: a draft with no Accent takes the preset's (Prime Time's gold `#F5B32E`). Implemented as the shared `applyPreset` (`THEME-08`, which already keeps primary and secondary) plus the page carrying Accent and Live. Applying is a draft edit; the preset list writes (save, rename, delete, promote) are immediate, as today.

### 2. Colours

- **Card title:** "Colours". **Help:** "Team and Accent are required. Second and Live follow them until you change them."
- **`BRAND2-02` (revised) — Two to four colours** (W5-D24):

| Swatch | Writes | Required | Auto means |
|---|---|---|---|
| **Team** | `colors.primary` | yes | — |
| **Accent** | `colors.accent` | yes | — |
| **Second** | `colors.secondary` | no | absent; the kit derives it from Team (`DECOR-03`) |
| **Live** | `colors.live` | no | absent; the mode's live tone (`DEFAULT_LIVE`: `#FF3B5C` dark, `#B3364B` light) |

- **Anatomy:** Team and Accent as the first row of two large swatches (96×96), Second and Live as a second row of two smaller ones (64×64) labelled "Optional". Each shows its effective colour, name, and uppercase hex always visible (`BRAND2-06`); Second and Live carry an "Auto" chip while auto. Each is a button "{Name} colour, {hex}{, auto}. Edit".
- **A stored theme with no Accent** (possible under today's contract): the Accent swatch shows hatched with "Choose an accent", and **Publish is disabled** with the line "Choose an accent colour to publish." The fan app meanwhile renders the resolver's fallback (`DECOR-39`). The server keeps `colors.accent` optional, so main's Brand page keeps working against the same data.
- **Validation:** every written value is `#RRGGBB` uppercase (the contract refuses shorthand and alpha). Team and Accent can't be cleared.
- **No neutral controls** (`BRAND2-03`, revised): Page, Cards and Text leave the page. Stored `colors.neutrals` are carried through on publish (principle) and are not read by the overhauled fan app (`DECOR-23`). No note about them is shown.

### The in-page colour picker

Tapping a swatch (or Enter or Space on it) opens the picker: an anchored popover (232px) at 600px and wider, a bottom sheet under 600px; `role="dialog"`, one open at a time.

1. **Header:** the colour's name, and "Auto: follows Team" (Second) or "Auto: standard live colour" (Live) while auto.
2. **Saturation and brightness square**, 200×140, HSV; a 14px ring cursor.
3. **Hue strip**, 200×14 visible, 44px hit area.
4. **Hex field** (six characters, paste with or without `#`) and a before-and-after chip.
5. **From your logo:** up to six 28px swatches sampled from the uploaded logo (64×64 offscreen canvas, alpha ≥ 128, 4-bit buckets, kept when at least 48 apart in RGB, stopping at six). Hidden when there is no logo or the canvas is tainted. **Phase B: to build:** the asset CDN must answer image GETs with `Access-Control-Allow-Origin` for the console's origins (Wave 4's response-headers policy sets CSP and caching but no CORS on reads), otherwise every uploaded logo taints the canvas and the row never shows.
6. **Contrast readout** (`BRAND2-07`, revised), computed with the kit's resolver (`resolvePalette`, `onColor`, `contrastRatio`), never a console reimplementation: "Text on {Name}: {white|near-black}, {ratio}:1", adding "(below the 4.5:1 reading standard)" under 4.5; and, when the colour is within 1.5:1 of the mode's ground, "Close to the page colour ({ratio}:1). The app lifts it where it has to be read." Factual; never blocks.
7. **Reset to auto** (Second and Live, while overridden) and **Done**.

**Pointer:** press moves the cursor and captures the pointer; `touch-action: none` on the square and strip. **Keyboard** (`BRAND2-05`): Tab order square → hue → hex → logo swatches (one stop, arrows between) → Reset → Done; focus trapped; the square and strip are `role="slider"` with arrows stepping 1 and Shift+arrows 10; Enter commits a valid hex; an invalid hex shows "Use six digits, like #1D428A." and commits nothing; **Esc** closes and restores the opening value including its Auto state; Done, an outside click or the sheet's scrim keeps the value; focus returns to the swatch. **`BRAND2-04` — No native popups:** no `<input type="color">` or `<select>` on the page (a lint rule); range sliders stay native elements.

Where it lives: `src/components/ui/ColorPicker.tsx`, conversions in `src/lib/color-hsv.ts` (console primitives, tested).

### 3. Light or dark

- **Card title:** "Light or dark". **Control:** the console `Segmented`, "Dark | Light". **Help:** "Fans always see this, whatever their phone is set to."
- **Writes:** `mode`. The kit's ramps are fixed per mode (`DECOR-23`), so a flip needs no ramp swap. Stored neutrals are carried through untouched.
- The preview shows the draft's mode. There is no peek toggle and no "Peeking at…" text (W5-D27).

### 4. Logo and marker

- **Card title:** "Logo and marker".
- **Logo:** Wave 4's `UploadField`, field `brand.logo` → `branding.assets.logo` (PNG, JPEG, WebP or SVG; at most 5 MB; at least 64px on the shorter side; `POST /admin/uploads` then `POST /admin/uploads/complete`, both exist). Help: "On the start screen and in the app's header. Also used for 'From your logo' colours."
- **Progress marker:** `UploadField`, field `brand.progressMarker` → `branding.assets.sliderTipImageUrl` (at least 36×36). Help: "Rides the prize track on the board. A square image works best. A sponsor holding the slider at a game replaces it there." Kept although W5-D27 names only the logo: the overhaul's `Track` reads it (`DECOR` Track marker), so removing it would drop a working field.
- An upload lands in the draft; fans see it at Publish (Wave 4 rule). A stored legacy URL shows as a filled field and is carried through unchanged (`BRAND2-17`).

### 5. Words

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
- **Preview jump:** focusing an input moves the preview to the screen that shows it.
- **`BRAND2-31` — Paused words get an inline sample, not a phone screen** (W5-D46). Paused is not a preview screen (W5-D30), so under the Paused heading and Paused message inputs the page shows one sample line: the resolved text (default or draft, `{team}` expanded) set in the kit's type on the draft palette's ground and text colours (`.k-d3` for the heading, `.k-body` for the message), inside a small hairline card. It is a text sample, not a rendering of the screen.

### 6. Fine-tune

A disclosure, collapsed by default: "Fine-tune", help "Most looks don't need these." Open state remembered per browser.

| Control | UI | Writes | Values | Shown when absent |
|---|---|---|---|---|
| Decoration | Slider 0–100%, step 5, value "70%" | `decor.intensity` | 0–1 | the preset's (Prime Time 70%) |
| Band angle | Slider 0° to −12°, step 1, value "−5°" | `decor.angle` | −12…0 (W5-D43) | −5° |
| Texture | Segmented "None · Bingo grid" | `surface.texture` | `none` / `bingoGrid` | None (a stored `dotgrid` shows as Bingo grid, which is how the overhaul renders it) |

Help lines: Decoration "The board fragments and glow behind your screens."; Band angle "The slant of the team-colour band."; Texture "A faint board pattern on the page background." **`BRAND2-19` (revised) — Fine-tune maps to the contract exactly**, and `decor` is **Phase B: to build** (`DECOR-38`).

### Footer, drafts and leaving

- **Publish:** `PUT /admin/branding` with the whole theme (edited fields plus every carried field), the assets, and `text`. Disabled when clean, when Accent is missing, or when a Words field is invalid; "Publishing…" in flight; the result line as today, extended with "words updated".
- **Discard draft:** the existing discard.
- **Use the standard look:** sets the draft theme to `null` (the platform default), as today; it clears the theme only, not images or words. While null, the controls show the default palette and the button reads "Using the standard look."
- **No draft autosave** (walkthrough ruling, console-wide). The draft lives in the page until Publish or Discard. Today's `sessionStorage` copy of the Brand draft (`configDraftStorage.ts`, "Restored your unsaved changes.") is not used on the Wave 5 page; a key left by main's page is ignored.
- **Leaving:** an in-app navigation with unsaved changes asks "Leave without publishing?" / "Your changes to the brand will be lost." / "Keep editing" (default) / "Leave"; a reload or tab close with unsaved changes gets the browser's own leave prompt (`beforeunload`); none when clean (walkthrough ruling).

### Screen states

| State | What renders |
|---|---|
| Loading | Section and preview skeletons |
| Load failed | `ReportableLoadError` in place of the page |
| Staff with no tenant picked | The pick-tenant empty state |
| `org:member` (read-only) | Every control disabled, values visible; the footer replaced by "Read-only — only organization admins can change branding"; the preview works |
| Paused tenant | As member for the tenant's admins (the write gate refuses paused tenants, `THEME-13`); staff keep write access |
| No stored branding | The draft seeds the platform default theme; Accent shows "Choose an accent" |
| Stored theme without Accent | As above; Publish disabled until chosen |
| Words schema not deployed | Publish refuses with the server's 400; the page shows it above the footer (`BRAND2-23` makes this impossible once the schemas ship first) |
| Upload not configured | The upload field's own "Uploads aren't set up on this server." |
| Preview failed | The host's "The fan app didn't load." card with Retry; every control and Publish still work |
| Publish conflict or failure | The existing error line above the footer |

---

## The preview

**`BRAND2-12` (revised) — The frame is the overhauled fan app on a built-in sample contest.** `FanAppPreview` with `host: "brand"` (added by the Wave 4b fix pass), framing the fan origin's `/preview`, which answers `ready { app: 'overhaul', screens: [start, signIn, join, contests, contest, board, prize] }` (W5-D30). Phone only (390×844); no device toggle; Wave 5 never sends `device: "desktop"`.

**Tabs** (W5-D28, W5-D31): "Start" · "Sign in" · "Join" · "Contest list" · "Contest detail" · "Board" · "Prize", in that order, synced to navigation inside the frame (`PV-06`). Opens on Start. The Prize tab offers "Tier 1 · Tier 2 · Tier 3" (the sample has three tiers).

### What Brand sends

The render document (Wave 4's `PreviewDocument`) is built from two sources:

| Section | Source |
|---|---|
| `org` | `GET /admin/preview` (exists): the tenant's real public org read, with the draft overlaid (below) |
| `membership` | `GET /admin/preview`: the tenant's real gate as a new fan sees it (signup fields, opt-ins with their links, `gateCopy`) |
| `contests`, `contest`, `schedule`, `view` | The built-in sample (below), not the tenant's real contests |

**`BRAND2-27` — The draft overlay** (W5-D32). The console's `PreviewOverlay` (in `src/lib/preview/buildPreviewDocument.ts`) gains an additive member:

```ts
branding?: {
  theme?: ThemeSettings | null;          // the draft theme; null → the platform default theme
  logo?: string | null;                  // draft assets.logo
  sliderTipImageUrl?: string | null;     // draft assets.sliderTipImageUrl
  text?: BrandText;                      // draft Words
};
```

`buildPreviewDocument` applies it onto `document.org.organization.branding` (replacing `theme`, `logo`, `sliderTipImageUrl`, `text` when present in the overlay; `null` clears). The render document gains no field, so the message protocol and the frame's contract are unchanged: the frame paints from `org.organization.branding.theme` as it does today (`TenantContext`). **Phase B: to build:** the overlay member and its tests; the public branding schema accepting `text` and theme `decor` (else the frame's parse strips them). Sent on every draft change, debounced ~100ms (`RENDER_DEBOUNCE_MS`).

### The sample contest

**`BRAND2-26` — The sample document.** Wave 5 reuses the fix pass's sample source wherever it lands (console `src/lib/preview/` or shared), and never builds a parallel fixture (W5-D31). This section is the requirement on that source. If the fix pass has not built one when Phase B starts, Wave 5 builds it as `obs-b2b-shared/src/preview/sampleDocument.ts` with exactly these contents (W5-D28). **Phase B: to build (or reuse).** Its fixed board rides the additive `PreviewDocument.board?`, accepted for Phase B slice s0 (W5-D47).

It is marked as a sample by its own names, which is everything a viewer sees of it; the frame carries no chyron (`PREV-09`) and the console adds no label (`PV-08`). It never leaves the console: nothing writes it anywhere, and no fan read can return it.

| Part | Contents |
|---|---|
| Contest | `contestName` "Sample contest"; `description` "A sample contest for previewing your brand."; `contestType` bingo; state open; `maxParticipants` 0 (no limit, so no limit bar); `contestStatus` Open |
| Games | Two: "Sample Away @ Sample Home", started 60 minutes before the render (derived `InProgress`); "Sample Visitors @ Sample Home", tip-off tomorrow at the same clock time (`Scheduled`). No team logos. `sport` NFL (so the derived status uses NFL's length) |
| Players | Eight: "Sample Player 1" … "Sample Player 8", jersey numbers 1–8, four per team across the two games, `PlayerEntity`, **no `photoUri`**, so every square shows the kit's no-photo fallback (gradient, jersey number, name). A real player without a PES photo looks exactly like this, so the preview shows a real state rather than a stock face |
| Props | Per player, two markets from the board's short-form table ("Receiving Yards", "Rushing Yards", "Total Receptions") with three lines each, multipliers 0.5, 1.0 and 2.0 (one rung per ladder label), `showProp` true, `outcomeType` Over |
| Board | Fixed, not generated: nine prop ids chosen from the sample's props, with **two bingos**: row 1 and column 1 hit (five `Hit` cells on game 1, `isFinal` true), the centre square live (game 1, `progressValue` below its line), `middleRight` a miss (`Miss`, final), `bottomMiddle` and `bottomRight` pending (game 2). The frame builds its preview board with `buildBoard`, whose fallbacks shuffle, so a generated sample board would land on a random count; the sample therefore carries the board in an additive `PreviewDocument.board?: (propId \| null)[]` (nine, in `BOARD_POSITIONS` order), which the preview data layer uses instead of building one. Only the Brand host sends it. **Phase B: to build** (additive, loose schema, `v` stays 1). The bingo count comes from the same shared function the real board uses (W5-D40) |
| Prize tiers | Three: 1, 2 and 3 bingos; names "Sample prize 1", "Sample prize 2", "Sample prize 3"; description "What a fan wins at {n} bingo(s)."; no image; no sponsor |
| Schedule | No sponsors and no placements (a sample contest has none); `nextGame` = the sample's game 2 |
| Prize tab | The popup for the chosen tier (`view.prizeTierIndex`, default tier 2, reached by the sample board) |

- **Why the tenant's real gate but a sample contest:** the gate's fields and opt-ins are the tenant's live configuration and belong in a brand check; a real contest would show real players and real prizes under an unpublished look and would be missing for a tenant with no contests. The walkthrough ruling asks for a built-in sample contest here and real data on the contest previews.
- **No contests state:** while the No contests message input has focus, Brand overlays `contests: { upcoming: [], past: [] }` so the Contest list tab shows the Current tab's empty state with the draft `noContests` text.

---

## Words: storage, endpoint and fan wire

**`BRAND2-16` (revised) — `branding.text`**, **Phase B: to build** in shared, backend and the fan read:

```ts
// obs-b2b-shared/src/theme/brand-text.ts (new)
export const BRAND_TEXT_KEYS = ["startTagline", "startCta", "noContests", "pausedHeading", "pausedBody"] as const;
export type BrandTextKey = (typeof BRAND_TEXT_KEYS)[number];
export const BRAND_TEXT_MAX: Record<BrandTextKey, number> = {
  startTagline: 60, startCta: 24, noContests: 90, pausedHeading: 40, pausedBody: 160,
};
export const BRAND_TEXT_DEFAULTS: Record<BrandTextKey, string> = { /* the placeholders above */ };
export type BrandText = Partial<Record<BrandTextKey, string>>;
export const brandTextSchema;                         // zod, per-key trim + max, only {team}
export function resolveBrandText(text: BrandText | undefined, teamName: string): Record<BrandTextKey, string>;
// B2BOrganization.ts: BrandingSettings gains `text?: BrandText` beside theme, assets and presets.
```

- **Mongoose:** a typed `_id: false`, `default: undefined` subschema with a `maxlength` per key (`THEME-11`; never `Mixed`).
- **`PUT /admin/branding`** (exists) accepts `text` with the same three states as `assets`: absent leaves it, `null` clears it, an object replaces it whole. Empty keys are dropped; an empty object is `$unset`. `changes` gains `textEdited`. **`GET /admin/branding`** and the PUT response echo `text`. `theme: null` never clears `text`.
- **`GET /b2b/org/:subdomain`** (exists) projects `text` key by key into `organization.branding.text` (`THEME-16`'s allowlist) and serves it while suspended (`THEME-18`), so the paused words reach a paused app. `publicBrandingSchema` gains `text`.
- **`BRAND2-23` — The schemas widen first.** `text`, `decor` and `bingoGrid` are accepted by zod and Mongoose on the backend and the fan read before the page can publish them; until then the zod `themeSettingsSchema` would strip `decor` silently.

---

## Mapping from today's `ThemeSettings`

No data migration (`BRAND2-20`). UI state is derived on load; every field is carried through on publish unless the page edits it.

| Stored field (`B2BOrganization.ts`) | Brand v2 control | Read by the overhauled fan app | On publish |
|---|---|---|---|
| `mode` | Light or dark | yes | written |
| `colors.primary` | Team | yes (Team) | written |
| `colors.accent` | Accent (required) | yes; absent → Second, else Team (`DECOR-39`) | written; required to publish |
| `colors.secondary` | Second (Auto when absent) | yes; absent → Auto | written or absent |
| `colors.live` | Live (Auto when absent) | yes; absent → mode's tone | written or absent |
| `colors.neutrals` (ground, surface, surfaceRaised, text ramp, borderBase, border) | none | no (platform ramps) | carried through |
| `type.fontDisplay/fontBody/fontNumeric` | none | no (Satoshi only) | carried through |
| `type.displayTransform`, `type.displayWeight` | none | no (the kit's display style is fixed) | carried through |
| `shape.radiusBase` | none | yes (kit radii) | carried through; applying a preset writes it |
| `shape.density` | none | no (no reader anywhere) | carried through |
| `surface.borderAlpha` | none | no (kit hairlines per mode) | carried through |
| `surface.texture` | Fine-tune › Texture | yes (`none` / GridTexture) | written |
| `surface.glowIntensity` | none | no (glows follow `--k-intensity`) | carried through |
| `motif.heroMotif` | none | no (bands are part of each screen) | carried through |
| `motif.boardCounter` | none | no (the board's counter is the numeral and Track) | carried through |
| `decor.intensity`, `decor.angle` (**Phase B**) | Fine-tune › Decoration, Band angle | yes | written |
| `assets.logo` | Logo upload | yes | written |
| `assets.sliderTipImageUrl` | Progress marker upload | yes | written |
| `assets.sponsorName`, `assets.sponsorLogo` | none (legacy; no editor since sponsors got their own page) | no (Start's legacy "from {sponsorName}" is dropped) | carried through |
| `presets[]` | Presets › Yours | — | `PUT /admin/branding/presets` |
| `text` (**Phase B**) | Words | yes | written |

**Derived on load:** the preset "In use" ring compares the draft's `mode`, decor params, texture and radius base with Prime Time and the gallery and tenant presets (first match); Auto chips show for an absent Second or Live, or a stored value equal to what Auto would produce (left stored until the admin resets it); an absent `decor` shows Prime Time's values.

---

## Endpoints

| Method | Path | Status | Change on the Wave 5 branch | Auth |
|---|---|---|---|---|
| GET | `/admin/branding` | exists | echoes `text`; theme may carry `decor` (Phase B) | `requireAdmin` |
| PUT | `/admin/branding` | exists | accepts `text` and theme `decor`, `bingoGrid` (Phase B) | `requireAdmin` + write gate |
| PUT | `/admin/branding/presets` | exists | none beyond the widened theme schema | same |
| POST | `/admin/branding/promote` | exists | `genericizeForGallery` copies `decor` (Phase B) | staff only |
| POST | `/admin/uploads`, `/admin/uploads/complete` | exist (Wave 4) | none; fields `brand.logo`, `brand.progressMarker` | `requireAdmin` + write gate |
| GET | `/admin/preview` | exists (Wave 4) | none; Brand uses its `org` and `membership` sections | `requireAdmin` |
| GET | `/b2b/org/:subdomain` | exists | `branding.text` in the projection (Phase B) | public |
| — | Asset CDN image reads | exists (Wave 4) | `Access-Control-Allow-Origin` for console origins on GET (Phase B) | public |

Unchanged: tenant targeting (`?tenant=` for staff only), the read-only refusal first (`THEME-13`), no reverification anywhere (`THEME-14`; the walkthrough's "no step-up anywhere"), `clearOrgCache()` on every branding write (`THEME-15`), promotion the only audited branding write (`THEME-10`).

---

## Rules

Kept from S2 (revised where noted): `BRAND2-01`–`BRAND2-07`, `BRAND2-11`, `BRAND2-12`, `BRAND2-14`–`BRAND2-17`, `BRAND2-19`–`BRAND2-21`, `BRAND2-23`–`BRAND2-25`. New: `BRAND2-26`–`BRAND2-31`.

- **BRAND2-01 — Presets first; applying one changes the look, never the palette** (an Accent-less draft takes the preset's accent).
- **BRAND2-02 — Two to four colours; Team and Accent required;** Second and Live Auto until overridden.
- **BRAND2-03 — No neutral controls;** stored neutrals are carried through.
- **BRAND2-04 — No native popups** (lint-enforced), except the file chooser behind an upload and native range sliders.
- **BRAND2-05 — The picker is keyboard-complete.**
- **BRAND2-06 — The hex is always visible;** Auto is a text chip.
- **BRAND2-07 — The contrast readout uses the kit's resolver.**
- **BRAND2-11 — Thumbnails are swatches, not previews:** static, from shared kit pieces, no data.
- **BRAND2-12 — The real overhauled fan app is the only preview,** on `host: "brand"`, seven tabs, phone only, fed by the tenant's real org and gate and the built-in sample contest.
- **BRAND2-14 — Five Words, no more:** `startTagline`, `startCta`, `noContests`, `pausedHeading`, `pausedBody`, `{team}` only. Gate strings stay in Fields & Opt-ins.
- **BRAND2-15 — Blank means standard.**
- **BRAND2-16 — Words reach fans through the public org allowlist**, also while suspended.
- **BRAND2-17 — Images are Wave 4 uploads;** legacy URLs are honoured and carried through.
- **BRAND2-19 — Fine-tune maps to the contract exactly:** intensity, angle, texture.
- **BRAND2-20 — No data migration.**
- **BRAND2-21 (revised) — Every tenant gets the overhaul's look on the Wave 5 branch** with Prime Time's params until they set their own; no republish needed.
- **BRAND2-23 — The schemas widen first.**
- **BRAND2-24 — Access is unchanged:** `org:admin` and staff write, `org:member` reads, promote is staff only, nothing is reverified, only promotion is audited.
- **BRAND2-25 — No gap narration on the page.**
- **BRAND2-26 — The sample document is the fix pass's source, with the contents above,** named as a sample, never written anywhere.
- **BRAND2-27 — The draft reaches the frame as `PreviewOverlay.branding`** on `org.organization.branding`; no protocol change.
- **BRAND2-28 — Carry, don't clobber:** publish sends every unedited stored field back unchanged.
- **BRAND2-29 — Publish needs an Accent.**
- **BRAND2-30 — "Leave without publishing?" only with unsaved changes.**
- **BRAND2-31 — Paused words show an inline sample line on the draft palette; no phone screen.**

### Retired from S2

| ID | Was | Why |
|---|---|---|
| BRAND2-08, BRAND2-09 | One font choice from shared pairings | Satoshi only; no font option (ruling) |
| BRAND2-10 | Mode switches go through `withMode` | Kit ramps are per mode (`DECOR-23`); no swap needed |
| BRAND2-13 | The Light/Dark peek never touches the draft | The peek and its "Peeking at…" text are cut (W5-D27) |
| BRAND2-18 | Upload limits PNG/SVG/WebP ≤1 MB via S2's own route | Wave 4's `POST /admin/uploads` (5 MB, sniffed, measured) is the route |
| BRAND2-22 | Stale v1 drafts discarded once, with a notice; draft key `:branding-v2` | No draft autosave (walkthrough ruling); the draft lives in the page only |

---

## Function audit

### 1. Surfaces: data, calls, states

| Surface | Data sources | Server calls on admin action | States covered |
|---|---|---|---|
| Brand page | `GET /admin/branding` (theme, assets, presets, gallery; `text`*) | `PUT /admin/branding` (publish; `text`*, `decor`*); `PUT /admin/branding/presets`; `POST /admin/branding/promote`; `POST /admin/uploads` + `/complete` | loading, failed, pick tenant, member, paused, no branding, no accent, invalid words, upload not configured, publish error |
| Colour picker | draft; the logo image (canvas; CORS*) | none | auto / overridden; no logo; tainted canvas; invalid hex |
| Preset shelf | `GET /admin/branding` presets and gallery; kit thumbnail pieces* | presets PUT, promote | empty gallery, 20 presets, member |
| Preview | `GET /admin/preview` (`org`, `membership`); the sample document*; `PreviewOverlay.branding`* | none | before ready, ready, failed, no contests (Words focus), each of seven tabs |

\* **Phase B: to build.**

### 2. Mock elements (`brand-v2.html`)

| Mock element | Fate | Reason |
|---|---|---|
| 03 "Font" section (Broadcast, Classic, Modern, Grotesk, Editorial) | Cut | Satoshi only; no font option (ruling) |
| Preview "Peek at mode" Dark/Light toggle and "Peeking at light" | Cut | W5-D27; the preview shows the draft's mode |
| "Device: Phone / Desktop" toggle, browser-chrome desktop frame at 50% | Cut | Mobile only; no desktop preview anywhere (walkthrough ruling) |
| Preview tabs Gate · Join · Home · Contest · Board · Prize, more Results · Paused | Changed | The seven Wave 4 screens (W5-D30): Start, Sign in, Join, Contest list, Contest detail, Board, Prize |
| PREVIEW chyron inside the frame (`?preview=1`) | Cut | `PREV-09`: no marker; the sample marks itself by its names |
| Caption "Your draft as fans will see it. Nothing changes for them until you publish." | Cut | `PV-08`: no label around the frame |
| Sponsors as a Brand tab (today's `SponsorsBrandingHead`) | Cut | Walkthrough ruling; Sponsors is its own nav item (the mock already had it in the sidebar only) |
| "Club Level" preset card | Cut | Not an overhaul preset (`DECOR-37`) |
| Colours help "Team is required. The other three follow it until you change them." | Changed | Team and Accent required (W5-D24) |
| Accent swatch with an "Auto" chip | Changed | Accent is required; no Auto |
| "Live" as the fourth swatch in the main row | Changed | Optional, in the smaller second row with Second |
| "From your logo" swatches | Kept | Needs CORS on the asset CDN (Phase B) |
| Contrast chip "Text on Team: white, 18.1:1" and "Close to the page colour (1.1:1)…" | Kept, reworded | The warning now says the app lifts the colour where it must be read (`DECOR-28`) |
| "PNG, SVG or WebP, up to 1 MB" | Changed | Wave 4 upload rules: PNG, JPEG, WebP, SVG, 5 MB |
| Logo tile "1200×300", Replace, Remove | Kept | `UploadField`'s measured line |
| Words: "No contests message: Shown on Home when nothing is scheduled." | Changed | Key `noContests`, shown on Contests (no home) |
| Words: other four inputs with counters | Kept | `branding.text` (Phase B) |
| 07 Fine-tune (collapsed) | Kept | Contents per W5-D27: intensity, angle, texture |
| Footer: "Unpublished changes", "Use the standard look", "Discard draft", "Publish" | Kept | Existing behaviour |
| Barlow Condensed, Fraunces, Instrument Sans, Space Grotesk, IBM Plex, Fontshare Satoshi (`brand-v2.html` head) | Cut | Console uses its own self-hosted Satoshi |

---

## Acceptance criteria

1. `/branding` shows Presets, Colours, Light or dark, Logo and marker, Words, Fine-tune (collapsed), in that order, and no Font section, Sponsors tab, device toggle, peek toggle or "Peeking at" text.
2. Searching the built console for `type="color"` and `<select` on this page finds nothing.
3. Applying Prime Time to a draft with Team `#0B162A`, Accent `#FFB224` and Second `#C83803` keeps all three and changes mode, decor params, texture and radius base; applying it to a draft with no Accent sets Accent to `#F5B32E`.
4. A stored theme with no `colors.accent` loads with Accent reading "Choose an accent" and Publish disabled; choosing one enables Publish.
5. Publishing a colour change for a tenant whose stored theme has custom neutrals, Club Level type and `heroMotif: "none"` leaves those fields byte-identical in `GET /admin/branding`.
6. The picker, keyboard only: open Team with Enter, Shift+Right three times, Tab to the hue strip, Left five times, type `0B162A`, Enter, Esc: the swatch shows its opening colour and focus is on it; Tab never left the picker.
7. The contrast readout for Team `#0B162A` reads "Text on Team: white, 18.1:1".
8. `PUT /admin/branding` with `text: { startTagline: "Go {team}" }` stores it, `GET /b2b/org/:subdomain` returns it in `organization.branding.text` (also for a paused tenant), and a 61-character `startTagline` or a `{name}` token is refused with 400.
9. Blank Words values publish as absent and the fan app shows the defaults.
10. The preview frame answers `ready` with `app: 'overhaul'`; the tabs read Start, Sign in, Join, Contest list, Contest detail, Board, Prize; clicking through the frame moves the tabs; there is no Phone/Desktop control.
11. The Contest list tab shows only "Sample contest", the Board tab shows two bingos with every square on the no-photo fallback, and the Prize tab shows "Sample prize 2"; none of the tenant's real contests, players or prizes appears.
12. Changing Team in the picker repaints the frame within ~100ms of the last change, without a publish; the tenant's live fan app is unchanged until Publish.
13. Focusing the No contests message input shows the Contest list tab's empty state with the draft text.
14. An `org:member` sees every control disabled, the read-only line, and a working preview.
15. Leaving with unsaved changes asks "Leave without publishing?"; leaving a clean page asks nothing.
16. `BrandPreviewPanel.tsx` and the `SponsorsBrandingHead` import are gone from `Branding.tsx` on the Wave 5 branch.

## Open questions

None. Decided since the first draft: the paused words' inline sample (W5-D46, `BRAND2-31`), thumbnails from shared kit components (W5-D48), the band angle as a Fine-tune setting (W5-D43), the fixed sample board (W5-D47).

## Recorded gaps

- **"From your logo" needs CORS on asset reads**; until it ships, the row stays hidden for every uploaded logo.
- **Paused words have no phone preview**, only the inline sample line (`BRAND2-31`).
- **Stored neutrals, fonts, border strength, glow, band and counter settings stay stored and unedited;** main's Brand page still reads them, the overhaul doesn't.
- **Last write wins between two admins**, as everywhere in the console.
- **Orphaned uploads** stay in the bucket (Wave 4's recorded gap).

## Mocks

`mocks\fanapp-v2\brand-v2.html` (workspace), visual direction only; the function audit lists every deviation.

## References

- Rulings (workspace): `artifacts\review-2026-09-27\arthur-rulings-2026-09-27.md` (Wave order, Priorities, Uploads everywhere); `arthur-rulings-wave4-walkthrough.md` (Console-wide, Brand); `artifacts\wave-2026-09-24\arthur-rulings-after-specs.md` (Prime Time gold).
- Decisions: `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` (W5-D24, D27, D28, D30–D33, D43, D46–D48); console audit `w5-console-touchpoints-audit.md` §4–§5.
- Wave 4 specs (`arthur-w4-console`): [`admin-branding.spec.md`](admin-branding.spec.md), [`admin-uploads.spec.md`](admin-uploads.spec.md), [`admin-preview.spec.md`](admin-preview.spec.md), `../../webapp/fan-preview-mode.spec.md`, [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md).
- Siblings: [`fan-decor-system.spec.md`](fan-decor-system.spec.md), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).
- Console (Wave 4 integration): `src/pages/Branding.tsx`, `src/components/BrandPreviewPanel.tsx`, `src/components/SponsorsBrandingHead.tsx`, `src/components/upload/UploadField.tsx`, `src/components/preview/FanAppPreview.tsx`, `src/lib/preview/buildPreviewDocument.ts`, `src/lib/configDraftStorage.ts`.
- Shared: `interfaces/b2b/B2BOrganization.ts` (`ThemeSettings`, `BrandingSettings`, `THEME_PRESET_CAP`), `api/admin/branding.ts`, `api/b2b/org.ts` (`publicBrandingSchema`), `api/preview.ts`, `api/admin/preview.ts`, `api/admin/uploads.ts` (`UPLOAD_FIELDS`), `theme/{resolve,presets}.ts`.
- Backend: `node-server/src/handlers/admin/branding.ts`, `util/admin-branding.ts`, `handlers/org/getOrganization.ts`, `handlers/admin/preview.ts`.
