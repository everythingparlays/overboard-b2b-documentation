# Core Module Spec: Admin — Branding

**Implements:** PRD `BRAND-01` (superseded in classification — see "What this does to BRAND-01"), `ADM-02`, `ADM-03`, `TEN-02`, `TEN-C1`. HLD [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the layer this spec's `src/theme/` and `src/ui/board/` additions must satisfy.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the permission table, the `/branding` nav destination, and the **Fan's-eye view** principle this screen is the second instance of. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the draft-and-publish screen skeleton, the live-preview wrapper, and the known gap this spec closes. [`../../webapp/styling.spec.md`](../../webapp/styling.spec.md) — the runtime theming system this replaces, and the platform-fixed status colors it keeps.

**Status:** Draft. Written from the fan-theming design contract (directive, 2026-09-22, Arthur). No open questions remain — ready for review.

## Revision 2026-09-27 (Wave 3) — Satoshi everywhere

The type controls leave the screen (Arthur, 2026-09-27: "Satoshi is the font everywhere… Remove the font option from
Brand"). `resolveTheme` resolves every font slot to Satoshi, which both hosts self-host. `THEME-04`'s allowlist stays on the
wire so stored themes keep validating, but nothing reads a stored font. The "Type" group loses Headline, Body and Number
font and keeps ALL-CAPS headlines and Headline weight. See [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §7. The
theme resolver also derives a contrast-guarded hit colour (§4 there).

**Revised 2026-09-24** (ruling, Arthur) — there is one preview in the console: the real fan app running in preview mode, framed by the console's `FanAppPreview` ([`admin-preview.spec.md`](admin-preview.spec.md)) and fed the unsaved Brand draft, with a screen switcher over Gate, Join, Home, Contest, Board and Prize. It replaces this spec's live preview: the `.obs-gate-preview` wrapper, the `EntryGatePreview` plus sampler strip, and `THEME-21` are retired with `BrandPreviewPanel`, and the "no full board preview" gap closes, because the frame shows the fan app's own board. The Brand page itself is redesigned in `admin-brand-v2.spec.md` (Wave 5; see the 2026-09-27 note below, which keeps this preview and that redesign off main), and Sponsors leaves this screen for its own page ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)). The theme contract, derivation, presets, storage, endpoints and fan wire below are unchanged; the sections this revision retires are kept as written, for the record.

**Revised 2026-09-27 (Wave 4)** (rulings, Arthur) — the Brand page v2 (`admin-brand-v2.spec.md` on the unmerged `arthur-s2-fanapp-spec` docs branch, as mocked with the fan-app v2 mocks) is **not** built on main in Wave 4: it is built in Wave 5, on the fan-app overhaul's own long-lived branch, which is never merged. On main the Brand page stays as it is built today, with two changes and no others:

- **No font option** (Wave 3, Satoshi everywhere): the Type group's font pickers are gone and `resolveTheme` resolves every font slot to Satoshi; stored font ids stay valid on the wire and nothing reads them. `THEME-04`'s allowlist is moot until a font choice returns.
- **Logo and Progress marker are upload fields** (Wave 4, "Uploads everywhere"): a drop-or-browse box in place of each URL text row in the Images card, per [`admin-uploads.spec.md`](admin-uploads.spec.md). The stored value is still the URL (`branding.assets.logo`, `branding.assets.sliderTipImageUrl`), and an upload lands in the draft like any other edit, reaching fans at Publish. `brandingAssetsSchema` accepts only https URLs, ≤2000 characters, on write; stored values of any shape still read.

**Revised 2026-09-28 (Wave 4b)** (Arthur's Wave 4 walkthrough) — three changes to the Brand page on main. The editor, the theme contract, presets, storage, endpoints and fan wire are unchanged.

- **Brand is its own page.** The Sponsors tab above it is removed (an unnecessary shortcut): the head is the tenant eyebrow, the title "Brand" (the nav label) and the Discard / Publish changes actions, with no tab row. `/branding/sponsors` still redirects to `/sponsors`. The shared `SponsorsBrandingHead` is deleted.
- **The preview is the console's phone preview of every fan screen.** Brand is "the one place every screen matters": the preview is `FanAppPreview` with host `brand` ([`admin-preview.spec.md`](admin-preview.spec.md)), mobile only, with tabs for Start, Sign in, Join, Contest list, Contest detail, Board and Prize. It is fed a **built-in sample contest**, never the tenant's own contests (admin-preview.spec.md, "The sample contest"), with the tenant's name and join gate, and the unpublished look laid over the org exactly where the fan app reads it (`overlay.branding`: the draft theme without font choices, and the draft images). "Use the standard look" previews as no theme, which is what fans get once it is published. The preview sticks beside the editor, its height fitted to the window. This replaces `BrandPreviewPanel` (the `.obs-gate-preview` gate plus sampler strip, `THEME-21`), which is deleted, and closes the "no full board preview" gap: the frame shows the fan app's own board. It reverses the 2026-09-27 note that kept this preview off main; Brand page v2 itself stays on the Wave 5 branch.
- **No draft autosave.** The draft lives only in the page: it is not written to session storage, and the page always opens on what the server holds (the "Restored your unsaved changes" line is gone). Leaving the page with unpublished changes asks "Leave without saving?" (Leave / Keep editing, the centred dialog); with none, it just goes. Closing or reloading the tab gets the browser's own prompt while there are unpublished changes.

**Revised 2026-09-28 (console final pass): the minimal baseline** (Arthur's final console walkthrough, "Brand: a clean, minimal baseline"). This is the Brand page on `arthur-console-redesign`, the fallback if Brand page v2 (Wave 5, `admin-brand-v2.spec.md`) is not adopted. It is deliberately small so nothing here conflicts with v2. Where this block and older text below disagree, this block wins; the older sections are kept for the record.

- **What the page offers.** Three cards and nothing else: **Colours** (Main colour, Second colour, Accent colour: `BRAND-01`'s "team brand colors (primary, secondary, accent)"), **Light or dark** (Background: Dark / Light) and **Images** (Logo, Progress marker). **Gone from the page:** the preset shelves (Overboard presets, Gallery, Your presets, Save current look, rename, delete, Promote to gallery), Type, Shape, Finish, Signature, Live tone and the Advanced page/card/text colours. The backend keeps `PUT /admin/branding/presets` and `POST /admin/branding/promote`, and `GET /admin/branding` still returns `presets` and `gallery`; the console no longer offers them. A stored theme that already carries type, shape, surface, motif or live values keeps them untouched on every publish (fonts are still dropped, as since Wave 3) until the theme is reset.
- **It starts from what fans see.** With no theme stored, fans see the team's onboarding colours (`seedTheme(slug)` in `obs-b2b-shared/src/theme/seeds.ts`, i.e. `effectiveTheme(slug, null)`), else the neutral standard look (`DEFAULT_THEME`). The page opens on exactly that: bears on navy and orange, fightinghawks on green, test on the neutral near-white. The slug is the page's scope: the staff member's chosen tenant, else the tenant's own (`/admin/health` `scope.tenant`). Showing that theme is not an edit (Publish stays off), and a draft edited back to it is nothing stored again (`theme: null`).
- **Reset.** "Reset to starting look" (a team with onboarding colours) or "Reset to neutral look" (a team without) sets the draft theme to `null`; publishing it clears the stored theme (`$unset`), so fans get the onboarding colours or the neutral look again, mode included.
- **Light or dark really switches.** The onboarding and standard themes carry explicit dark page colours (`colors.neutrals`), so flipping only `mode` used to leave a "light" site dark (next-themes wrote `class="light"` while `--background` stayed near-black). Switching mode now also picks the page colours: the first of the stored theme, the onboarding theme and the standard look whose own page colour suits the new mode, else none, which the resolver fills with the platform's full ramp for that mode (light: ground `#FAFAF8`, text `#17181A`). The team's colours are kept. The neutral look stays neutral across modes: its main colour is the fan app's near-white `#E5E5E5` on dark and near-black `#171717` on light (the fan app's own light `--primary`). Switching back to the original mode restores the original page colours, so a round trip is not an edit. The resolver measures the text on every colour and contrast-guards the highlight colour (`contrastSafeHit`) in both modes. The fan app paints the published mode before first render from its boot cache, so there is no flash after the first visit.
- **The colour picker is the console's own** (`components/ui/colorPicker.tsx`; no native `<input type="color">`): a swatch button opens a popover with a saturation/brightness square, a hue slider, a Hex field, one-click swatches of the tenant's other two colours (each distinct colour once), and the measured contrast of the colour against the page background. Arrow keys move the square (left/right saturation, up/down brightness) and the hue, Shift for bigger steps, Home/End to the ends; Escape closes and returns focus to the swatch; tabbing or clicking away closes. Pointer drag works for mouse, pen and touch. The hex and HSV maths is ported from the fan-app kit (`src/kit/palette/color.ts`), contrast is the shared implementation, and the component is self-contained so Brand page v2 can import it unchanged. The row keeps a hex text field beside the swatch; an optional colour whose field is emptied follows the one before it again ("Same as the main colour" / "Same as the second colour").
- **A highlight readout.** Under the colours, one line says which colour fans see on bingo highlights and progress bars: the resolver's `hit` (the first of main, second and accent that clears 3:1 against the progress track, else a lighter or darker shade of the closest). For bears it is the orange, because navy does not stand out on navy.
- **Members** see each colour as a swatch and its hex, the mode as a word and the images as they are, with no picker, hex field, mode switch, reset or upload controls. The leave prompt ("Leave without saving?") only guards someone who can edit.
- **The console accent follows.** After a successful publish the page calls `useTenantAccent().refresh()` (`lib/ThemeContext.tsx`), so the console's accent (the tenant's `hit`, `brandAccent(effectiveTheme(slug, stored))`) updates without a reload.
- **The preview** is unchanged (host `brand`, the built-in sample contest, the draft theme and images laid over the org). Its Start screen shows no matchup (ruling item 6; `nextGame` leaves `sampleContest.ts`).

**Revised 2026-09-29 (Walk #3): the four-colour model** (Arthur's Walk #3 rulings, "The colour model, final for the current app"). This block wins over everything below it; the older text is kept for the record. It also supersedes the 2026-09-28 block's Colours, Light or dark and highlight bullets.

- **Four colours, nothing else about colour.** `ThemeSettings.colors` is `{ main, accent, text, buttonText? }` and `mode` is gone:
  - **Main** is the fan app's background.
  - **Accent** is actions: buttons, bingo hits and their check badge, progress bars, chips, the selected player, focus rings, and the console's accent. It takes the description Main had.
  - **Text** is the text on Main: white or black, white by default.
  - **Button text** is the text and icons on Accent-coloured things. Absent means **auto**: black or white, whichever reads better on Accent, recomputed when Accent changes. It can be set to white or black. "Auto" is never stored as a value.
- **No second colour, no light or dark mode** anywhere: no setting, no label, no computed mode shown to anyone. The fan app has no `dark` class, no `dark:` variants and no next-themes; the stylesheet keeps one fallback block, which is the resolver's neutral default.
- **Everything else is derived** by `resolveTheme` in `obs-b2b-shared/src/theme/resolve.ts` as hue-preserving OKLCH tones, never plain white or black:
  - Cards, the raised surface, the progress track and borders are Main stepped by contrast (1.15, 1.3, 1.45 and 1.6 to 1 against Main): lighter, or darker when Main is too pale for lighter to show, keeping Main's hue.
  - Muted text is Text blended toward Main in OKLab, kept at 4.5:1 on a card.
  - Hits and progress (`--hit`) are Accent, its lightness nudged only when needed to reach 3:1 against a card and the track. It is never swapped for another colour. Bears' `#e64100` already reads, so it is used as is.
  - Toasts are a pale Accent tint with dark Accent-hued text; confetti is Accent in three shades plus a lifted Main.
  - The browser's `color-scheme`, the player-photo blend (screen on a dark Main, normal on a light one) and the "Powered by" wordmark are picked by contrast against Main. They are outputs, never a mode.
- **Stored themes in the older shape** are read through `normalizeTheme` (`obs-b2b-shared/src/theme/normalize.ts`):
  - Main = the stored ground, else the old mode's platform ground.
  - Accent = the colour the old resolver showed on hits.
  - Text = the stored page text, else white or black by contrast on Main.
  - Button text is auto.
  - Every reader goes through it: the Brand read, the fan wire, the console accent, the contest banner, the prize email and the fan app's boot cache. `PUT /admin/branding` accepts only the new shape.
  - `node-server/scripts/theme-colour-migration.mjs` (dry run by default, `--apply` to write, idempotent) rewrites stored themes the same way.
- **Seeds** (`theme/seeds.ts`) are bears (Main `#0b162a`, Accent `#e64100`, Text white) and fightinghawks (Main `#000000`, Accent `#009A44`, Text white), Button text auto. `test` has none and renders the neutral default (Main `#0a0a0a`, Accent `#e5e5e5`, Text white), and the console stays neutral white for it. The stale bundled tenants (bbgs, warriors) are removed.
- **Presets and the gallery are removed** from the contract, the storage, the endpoints (`PUT /admin/branding/presets`, `POST /admin/branding/promote`) and `GET /admin/branding`'s response. A publish drops a stored preset array. The staff tenant page names a look "Custom" or "Standard". The `theme_preset_promote` audit action stays so old log entries still read.
- **The page.** The Colors card has four rows: Main and Accent (the console's picker and a hex field), and Text and Button text as segmented choices (White / Black; Auto (white or black, naming the ink it picks) / White / Black). A Text stored as neither white nor black shows its value until an ink is picked. The highlight line says whether the hits use the Accent or a lighter or darker shade of it. Reset returns to the seed or the neutral look.
- **Default images follow the colours.** The contest banner's default band runs from Main to Accent, inked in Text or Button text, whichever reads better at the band's worse end. Monograms (the logo default, the tab icon, the band's monogram) are Button text on Accent.

**Function audit (what each control writes, and what reads it):**

| Control | Writes (`PUT /admin/branding`) | Read by |
|---|---|---|
| Main color | `theme.colors.main` | Fan app `--background`, and every derived surface: `--card`, `--surface-raised`, `--border`, `--progress-track`, muted text, the photo blend, `color-scheme`, the wordmark; the banner band's start |
| Accent color | `theme.colors.accent` | Fan app `--primary` and `--ring` (buttons, chips, the selected player, focus), `--hit` (bingo hits, check badge, progress), toasts, confetti, the prize pill, "Joined"; the banner band's end; the monogram; the console accent |
| Text color (White / Black) | `theme.colors.text` | Fan app `--foreground` and `--card-foreground`, muted text; the default progress-marker triangle |
| Button text color (Auto / White / Black) | `theme.colors.buttonText` (absent: auto) | Fan app `--primary-foreground` and `--hit-foreground`; the monogram's initials |
| Reset | `theme: null` | Fan app falls back to the onboarding seed or `DEFAULT_THEME`; the backend's `effectiveTheme` for the console accent |
| Logo | `assets.logo` (upload field `brand.logo`) | Fan app Start and Join screens, the side menu, the paused screen, the tab icon |
| Progress marker | `assets.sliderTipImageUrl` (upload field `brand.progressMarker`) | Fan app board progress-bar marker, unless a sponsor holds the slider slot at that game or the game has its own marker ([`admin-contests.spec.md`](admin-contests.spec.md), "Progress marker"); with none, a triangle in the Text colour |

*The 2026-09-28 function audit (Main/Second/Accent colour, Background Dark/Light) is superseded by the table above.*

## Start page (revised 2026-09-29, Walk #3)

Ruling (Arthur, Walk #3): "Remove the 'Sign-in' slot from contest Sponsors, since it isn't a contest field. Brand gets a
**Start page** section where the tenant adds and removes start-page sponsors." The Start page is the fan app's first
screen (`/`, before a fan signs in): the tenant's logo, "{Team} Bingo", "Pick your players. Win prizes.", the sponsors
under "Presented by", and "Continue with Email". It belongs to no contest, so its sponsors are the tenant's own.

**Storage.** `B2BOrganization.startPageSponsorIds?: ObjectId[]`, the tenant's Start page sponsors in the order fans see
them. A top-level organization field, not part of `branding.theme` (the theme is the look; this is a list of sponsor
records). Absent or empty: no sponsor block. Each id is one of the tenant's sponsors; at most 12
(`START_PAGE_SPONSORS_MAX`).

**Endpoints** (contracts in `obs-b2b-shared/src/api/admin/start-page.ts`):

- `GET /admin/start-page` (`requireAdmin`, the usual OBS-only `?tenant=`): `{ tenant, sponsors: [{ sponsorId, name,
  websiteUrl?, startPageLogo?, startPageTagline? }] }`, in order, read fresh (not from the org cache). An id whose
  sponsor no longer exists is skipped.
- `PUT /admin/start-page` (`refuseReadOnlyWrite`: tenant `org:admin` of a tenant that isn't paused, or OBS staff): body
  `{ sponsorIds: string[] }`, the whole list in order; an empty list clears the field. Refused at the contract: a repeat
  ("Each sponsor can be listed once."), more than 12 ("The Start page shows up to 12 sponsors."), an id that isn't one.
  Refused by the handler, writing nothing: an id that isn't one of this tenant's sponsors (400
  `start_page_unknown_sponsor`, "One of these sponsors no longer exists. Reload the page and try again.", the same
  answer whether it was deleted or is another tenant's). Last write wins between two admins, as for placements. Not
  audited (configuration, undone by editing again). Clears the org cache and the fan sponsor schedule.

**The fan wire.** `GET /b2b/org/:subdomain/sponsors` carries `startPage` (the ids, in order, of sponsors that still
exist) and includes those sponsors in `sponsors` ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), "The fan wire").
The fan app's Start screen reads only this list: no contest placement and no featured game speaks for it.

**The card.** "Start page", right after Images. Lede: "The sponsors fans see under “Presented by” before they sign in, in
this order. Changes save as you make them." (members: without the last sentence).

- **Rows**, in order: a drag handle (the Fields & Opt-ins sortable list: drag, touch-hold, or the handle with Space and
  the arrow keys), what fans see (the Start page logo on the white plate, or the name set in its place), the sponsor's
  name (linking to its sponsor page) with its tagline, or "No Start page logo, so fans see its name.", and "Remove".
- **"Add sponsor"** opens the sponsor picker (search, endless list) titled "Start page". It leaves out the sponsors
  already listed and disables none (any sponsor can stand on the Start page); with every sponsor listed it says
  "Every sponsor is already on the Start page.". At 12 the button is disabled with "The Start page shows up to 12
  sponsors."; otherwise a quiet link "Logos and taglines are set on each sponsor's page." goes to Sponsors.
- **Empty:** "No sponsors on the Start page. Fans see no sponsor there."
- **Saving: each add, removal and move saves at once** (one `PUT` of the whole list), with "Saving…" then "Saved."
  in the card header. A refused save puts the last saved list back and shows the server's message under the list
  ("Couldn't save the Start page. Try again." for anything unexpected). **Why not Brand's draft and Publish:** Publish
  ships the look (theme and images) in one `PUT /admin/branding`; the Start page list is a list of sponsor records, and
  sponsors save as they go everywhere else (the sponsor page saves field by field). Folding it into Publish would make a
  sponsor change wait on an unrelated publish, and the page's Discard and leave prompt would have to cover records they
  don't own. So the card sits on Brand, where the Start page is designed, and saves like the rest of sponsors.
- **Members** see the rows with no handle, Remove or Add.
- **Loading:** two row skeletons. **Load failed:** "Couldn't load the Start page's sponsors." with Retry.

**The preview.** The Brand preview's Start screen shows the card's list as it stands, before the save comes back
(`overlay.startPage`, fed through `lib/preview/startPageDraft.ts`, keyed by the tenant so another tenant's preview never
gets it; [`admin-preview.spec.md`](admin-preview.spec.md)). The sample contest keeps the tenant's saved Start page
sponsors; no contest placement is carried.

**The fan app** ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), render rules): "Presented by", then each sponsor, in
order. One sponsor takes the column: its logo on a white plate spanning it, as wide as the plate, its height following
its shape up to 96 px; with no logo (or one that doesn't load), its name in a tile the same size. Several sit two to a
row on plates 64 px tall; an odd last one takes the row. Each tagline sits under its mark; a mark with a website is the
link. None: no block. A tenant with no sponsor records still gets its legacy name and logo (`SP-09`).

**Deleting a sponsor** takes it off the list (`SP-14`).

**Function audit.**

| Control | Writes | Read by |
|---|---|---|
| Add sponsor | `PUT /admin/start-page` (list + the pick) | Fan wire `startPage`, the fan Start screen, the Brand preview |
| Remove | `PUT /admin/start-page` (list − the row) | The same |
| Drag / keyboard move | `PUT /admin/start-page` (the new order) | The same; the order is the fan's |
| Name link | nothing | Opens the sponsor page |

## Overview

A tenant's colors, type, shape, finish and signature moments become real server-side configuration, editable by that tenant's own admins at `/branding`, applied by the fan app at runtime, and previewed in the console against the unsaved draft.

**The whole change, in one line:** the eight hardcoded hexes in the fan app's per-tenant source files become a stored theme contract with one canonical resolver, so a team's look is data that a non-engineer edits rather than a deployment an engineer performs.

**In scope:** the stored theme contract (v2) and its derivation rules; the shipped preset defaults, the OBS-curated gallery and a tenant's own saved presets, with the promote-to-gallery pipeline; storage on `B2BOrganization` and the gallery's own collection; `GET`/`PUT /admin/branding`, `PUT /admin/branding/presets`, `POST /admin/branding/promote`; the public fan wire; the `/branding` screen and its live preview; and back-compat with the compile-time tenant files, pinned by test.

**Not in scope:** sponsor records and their per-game assets — [`admin-sponsors.spec.md`](admin-sponsors.spec.md), the Sponsors tab of the same screen; a full fan-board preview inside the console; per-cell live fractions for Under props and non-player props; anything that would make `--destructive` / `--success` / `--warning` tenant-settable.

---

## Principles

Two principles sit above the numbered rules. A change can satisfy every rule below and still violate one of these.

**Honesty by omission, not by narration** (ruling 2026-09-22, Arthur). *Where the product cannot honestly show something, it omits it — silently — and the gap is recorded here, not on screen.* Never-fabricate stays absolute: no invented stats, no mocked-up data, no preview of a thing that is not the thing. But a customer-visible surface must not explain its own gaps or its own provenance either. No "not measured yet" caption under a missing stat fraction. No "coming soon" note for anything not yet built. No roadmap narration, no caveat lines, no provenance notes anywhere a tenant admin or a fan can read them.

The two halves are easy to confuse, so state them together: a cell with no honest progress data shows **no fraction and no explanation**; a screen ships **without any section it cannot yet fill, and without mentioning one**; the preview shows what it can render honestly and **does not caption what it is not**. Every one of those gaps is written down in "Recorded gaps" below, which is the correct and only place for them.

This supersedes, for this screen, the pattern the fields spec's preview established — a caption saying the team's real colors apply elsewhere. That caption was honest and correct when the console had no way to know a tenant's colors. This spec is the reason it stops being true, so the caption goes rather than being restated (Rule 12).

**Plain product language** (inherited from [`admin-surface.spec.md`](admin-surface.spec.md)). The theme has a lot of machinery behind it and none of it is the admin's problem. The screen groups knobs as **Look**, **Colors**, **Type**, **Shape**, **Finish**, **Signature**, **Assets** — never "neutral ramp derivation", never "surface character tokens", never a requirement id.

---

## What this does to `BRAND-01`

PRD `BRAND-01` classifies team brand colors, logo and app naming as **set-once, engineer-configured, hardcode-permitted** — the one named exception to `TEN-02`'s configuration-over-code rule and to `TEN-C1`. `TEN-05` counts that hardcoding inside the 1–2 hour onboarding budget.

**This spec upgrades the classification, not the requirement.** The *elements* `BRAND-01` lists are unchanged and still belong to the tenant; what changes is that they are now stored configuration written through the admin surface rather than per-tenant source files an engineer edits and deploys. Concretely: `BRAND-01`'s "may be hardcoded per tenant so they render fast without a config lookup" no longer describes the platform. The permission it grants is not withdrawn — the compile-time files survive as seeds (below, "Back-compat") — but the platform no longer *relies* on it.

Three reasons the exception stopped earning its keep:

1. **The performance argument is spent.** `BRAND-01`'s justification is render speed with no config lookup. The fan app already makes an unconditional `GET /b2b/org/:subdomain` call before it renders anything, because it needs `organizationId` and the suspension flag. A theme riding that response costs zero additional round trips. The seed-then-server boot order (below) makes the first paint *faster* than today's, because the local seed is applied synchronously at module scope instead of after the provider mounts.
2. **The elements turned out not to be set-once.** `BRAND-01` assumes a tenant's look is fixed for a season. The four design directions this wave specifies are not palettes; they are systems — mode, type, radius, border weight, texture, glow, celebration character — and a team that wants to try one against its own colors cannot do so by filing an engineering ticket per attempt. `TEN-03`'s onboarding budget is also the wrong budget: this is a recurring, exploratory act, which is exactly `ADM-03`'s and §15.2's test for what belongs in the admin surface.
3. **Hardcoding was already producing wrong output.** The compile-time model stores foreground colors alongside background colors, and one shipped tenant (`fightinghawks`) carries a secondary foreground that renders white on white. A model where a human hand-picks a pair of colors that must contrast has no mechanism to stop that; a model that computes the foreground has no way to produce it (below, "Why on-colors are computed").

The PRD text is not edited by this spec. `BRAND-01` remains the requirement; this is its implementation, and the classification change is recorded here and dated so it is a ruling rather than a drift. The change is also logged against the PRD in [`PRD-changes-contributed-by-Arthur.md`](../../../documents/PRD/PRD-changes-contributed-by-Arthur.md) (entries 1 and 2). `BRAND-02` (per-game sponsor assets, admin-configured, never a code change) is built by [`admin-sponsors.spec.md`](admin-sponsors.spec.md); the field-by-field split between the two is [`branding-field-split.md`](../../../documents/PRD/branding-field-split.md).

**Requirement ids.** `BRAND-01`–`BRAND-04` are PRD ids. This spec's own rules are `THEME-03`–`THEME-23` — renamed on 2026-09-23 from `BRAND-03`–`BRAND-23`, which collided with the PRD's `BRAND-03` (several sponsors per game) and `BRAND-04` (no code change). The numbers are kept so older commit messages and PR descriptions still map one-to-one.

---

## The theme contract (v2)

*Superseded 2026-09-29 by the four-colour contract (revision at the top): `colors` is `{ main, accent, text, buttonText? }`, there is no `mode` and no `neutrals`, and the derivation rules there replace the table below. Kept as written, for the record.*

The stored shape is **pure data** — JSON-serializable, no functions, no computed values, no derived colors. Types live in `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts`; the zod contract in `obs-b2b-shared/src/api/admin/branding.ts`; the Mongoose subschemas in `obs-b2b-shared/src/models/b2b.ts`. It supersedes the fan template's eight-hex `TenantColors`, which survives in the template as the legacy seed shape only.

```ts
export type ThemeMode = "dark" | "light";
export const THEME_FONT_IDS = ["system","satoshi","archivo","barlow","barlow-condensed",
  "fraunces","instrument-sans","space-grotesk","ibm-plex-sans","ibm-plex-mono"] as const;

export interface ThemeNeutrals {          // explicit overrides; absent members derive
  ground: string;                          // page background (required if neutrals present)
  surface?: string; surfaceRaised?: string;
  textPrimary?: string; textSecondary?: string; textMuted?: string;
  borderBase?: string;                     // rgb basis for hairlines; alpha applied separately
  border?: string;                         // explicit full border color — wins over borderBase+alpha
}

export interface ThemeSettings {
  mode: ThemeMode;
  colors: { primary: string; secondary?: string; accent?: string; live?: string;
            neutrals?: ThemeNeutrals };
  type?:   { fontDisplay?: ThemeFontId; fontBody?: ThemeFontId; fontNumeric?: ThemeFontId;
             displayTransform?: "none" | "uppercase"; displayWeight?: 500|600|700|800 };
  shape?:  { radiusBase?: number;              // px, 0–24, default 10
             density?: "regular" | "compact" };
  surface?:{ borderAlpha?: number;             // 0.04–0.30, default 0.10
             texture?: "none" | "dotgrid"; glowIntensity?: number };   // glow 0–1, default 0
  motif?:  { heroMotif?: "none" | "angledBand";
             boardCounter?: "numeral" | "ringGauge" };
}
```

Assets ride **beside** the theme, never inside it:

```ts
export interface BrandingAssets { logo?: string; sliderTipImageUrl?: string;
                                  sponsorName?: string; sponsorLogo?: string }
export interface ThemePreset   { presetId: string; name: string; theme: ThemeSettings;
                                  createdAt?: Date }        // createdAt is server-owned
export interface BrandingSettings { theme?: ThemeSettings; assets?: BrandingAssets;
                                    presets?: ThemePreset[] }   // presets capped at 20
// on B2BOrganization:  branding?: BrandingSettings
```

**`THEME-03` — The theme is pure data and the resolver is the only thing that computes.** On-colors, tints, the radius ladder, glow shadows, the texture gradient and every derived neutral are **never stored**. `resolveTheme()` / `themeToCssVars()` in `obs-b2b-shared/src/theme/` is the single canonical implementation, imported by the fan app, the admin console and (for validation) the backend. A second derivation anywhere is the defect this rule exists to prevent.

**`THEME-04` — The font list is a curated allowlist, not a free string.** `THEME_FONT_IDS` is a closed `as const` array; the zod schema validates against it and nothing else passes. Each id maps in `fonts.ts` to a label, a full CSS stack with fallbacks, and a provider plus stylesheet URL that the host injects. An open font field would be a tenant-supplied URL loaded into every fan's browser on every page — a third-party asset with no review step, on the critical rendering path, for a setting whose product value is "pick one of ten". The allowlist is a security boundary and a quality floor in one decision, and growing it is a one-line change in a shared file with a code review attached.

**`THEME-05` — Status colors stay platform-owned.** `--destructive`, `--success` and `--warning` are fixed per mode and are not in the contract; the resolver does not emit them. This is [`styling.spec.md`](../../webapp/styling.spec.md) §1's existing rule, kept deliberately rather than inherited by accident: a "closed" badge must read as closed on every team's site, and a fan who plays at two teams must not have to learn two color vocabularies. `live` is the **one** themable signal tone, because it is a broadcast treatment rather than a status — Prime Time's `#FF3B5C` chyron and Club Level's `#B3364B` are a direction's voice, not a claim about state.

### Why on-colors are computed, never stored

The single most consequential derivation rule, and the one place this spec sanctions a visual change to shipped tenants.

Today's `TenantColors` stores eight hexes including `text`, and `applyTenantColors()` maps that one value onto `--primary-foreground`, `--secondary-foreground` and `--accent-foreground` alike. A human picks a brand color, picks a text color, and nothing checks that the second is legible on the first. One configured tenant already fails: `fightinghawks` resolves to **white text on a white secondary** — an invisible control, in a model that cannot detect it.

The resolver computes each on-color instead: `onColor(bg)` picks dark ink or white by **whichever yields the higher WCAG contrast ratio** against that background. That is the mocks' own rule, extracted verbatim from all four directions, so adopting it is alignment rather than invention. The property it buys is structural: **there is no pair of stored values that can render invisible text**, because the second value is not stored.

Storing computed values was considered and rejected on the same ground as `textVersion` in the fields spec — a derived value the client can send is a derived value the client can send *wrong*, and a stored on-color goes stale the moment someone edits the background it was computed against. Precomputing at write time and storing the result has the same defect one publish later.

### Derivation rules

`resolveTheme` is a pure function of `ThemeSettings`. The rules, in full, because "the resolver decides" is not a specification:

| Derived | Rule |
|---|---|
| `onPrimary` / `onSecondary` / `onAccent` / `onLive` | `onColor(x)` — higher WCAG ratio between dark ink `#101010` and `#ffffff` wins |
| Team tints | `--team-soft` = `withAlpha(primary, dark ? 0.14 : 0.12)`; `--team-border` = `withAlpha(primary, 0.38)`; `--team-glow` = `withAlpha(primary, 0.45)` |
| Radius ladder from `radiusBase` B | chip = `max(2, round(B*0.35))`; control = B; card = `round(B*1.25)`; full = 9999 |
| Glow | when `g > 0`: `--glow-hit` = `0 0 {round(18*g)}px var(--team-glow)`, `--glow-ring` = `0 0 0 3px var(--team-soft)`; else `none`. `--glow-intensity` is emitted raw |
| Texture | `dotgrid` → `--texture` = a 1px radial-gradient dot (`rgba(255,255,255,0.022)` dark / `rgba(0,0,0,0.05)` light) with `--texture-size: 20px 20px`; `none` → `--texture: none` |
| Neutrals, absent | dark: ground `#101114`, surface = `mix(ground,#fff,0.04)`, raised = `mix(…,0.08)`, text `#F4F5F7`/`#A6ACB8`/`#787E8A`, borderBase `#FFFFFF`. light: ground `#FAFAF8`, surface `#FFFFFF`, raised `#F3F2EE`, text `#17181A`/`#5A5C63`/`#8B8D94`, borderBase `#17181A` |
| Neutrals, partial | absent members derive from the **given** ground by the same rules — a tenant sets a ground and gets a coherent ramp, rather than having to supply seven hexes to change one |
| Borders | `--border` = explicit `neutrals.border` if present, else `withAlpha(borderBase, borderAlpha)`; `--border-strong` = `withAlpha(borderBase, min(borderAlpha*2, 0.4))` |

**The fixed interface — the 41 variables `themeToCssVars` emits**, pinned by name in the shared package's `resolve.test.ts` so adding or removing one is a deliberate contract change, never drift:

```
--background --foreground --card --card-foreground --muted --muted-foreground
--input --border --border-strong --surface-raised --text-secondary
--primary --primary-foreground --secondary --secondary-foreground
--accent --accent-foreground --ring --live --live-foreground
--tenant-primary --tenant-secondary --tenant-border
--radius --radius-chip --radius-card --radius-full
--font-display --font-body --font-numeric --display-transform --display-weight
--texture --texture-size --team-soft --team-border --team-glow --on-team
--glow-hit --glow-ring --glow-intensity
```

Three of those (`--border-strong`, `--text-secondary`, `--live-foreground`) were added during the build because a stored or computed value had no variable to reach a host through; a value the contract holds but no host can read is a defect, so the list was widened rather than the storage narrowed.

**The emitted variable set is a superset of what the entry gate reads today**, so the existing 14-variable gate contract keeps working untouched, and the legacy aliases are kept deliberately: `muted` = surface, `input` = surface, `ring` = primary, `secondary` falls back to primary when absent, `accent` falls back to secondary then primary, and `--radius` carries the control radius in px because the gate stylesheet already reads it by that name. A new name for an existing concept would have been cleaner and would have broken every consumer for nothing.

**`THEME-06` — The explicit `border` override exists for legacy parity and nothing else.** `ThemeNeutrals` carries both `borderBase` (an rgb basis, alpha applied by `borderAlpha`) and `border` (a full explicit color that wins). Two ways to say one thing is normally a defect; here the second is load-bearing. Today's tenant files store a flat opaque border hex, and the parity test below must reproduce it byte-for-byte. `borderBase` is how the contract is meant to be used and what the screen writes; `border` is how a legacy seed survives conversion without a visual delta.

---

## `THEME-07` — The four directions are preset JSON, with zero code

**Acceptance rule.** The four design directions — Prime Time, Club Level, Signal, Floodlight — must each be expressible as one complete `ThemeSettings` JSON object, and rendering them must require **no per-direction code branch anywhere in the platform**. Not in the resolver, not in the fan app, not in a component, not in a stylesheet.

This is the whole test of whether the contract is a theming system or four skins with a switch in front of them. A direction that needs one `if` is a direction the next tenant cannot have; a contract that needs a code change to express a look is `BRAND-01`'s hardcoding with extra steps.

It is pinned by `src/theme/__tests__/direction-acceptance.test.ts`, which builds each direction from a fixture JSON and asserts, from `themeToCssVars(fixture)` alone: mode; the ground/surface/text ramp; the live tone and the accent; that each font id resolves to the right stack; the uppercase display transform where a direction has one; the radius ladder (Prime Time base 8 → 3/8/10, Club Level 12 → 4/12/15, Floodlight 13 → 5/13/16); the team tints at 0.14 dark / 0.12 light and 0.38 border; that Signal emits the dotgrid texture and the others emit none; the four glow intensities (0.35 / 0 / 0.55 / 1.0) and the exact `--glow-hit` strings they produce; and the motif selections.

The fixtures carry the exact hexes extracted from the mocks. Where a mock disagreed with itself across its own two artboards — Club Level's gate and board drifted on a border alpha — **the board values win**, because the board is the screen a fan spends the game on. Signal's stray mint is its team color and belongs in `primary`, not in `accent`.

---

## Presets, gallery, and curation

*Removed 2026-09-29 (presets are gone): the shelves, `applyPreset`, the gallery collection and its endpoints no longer exist. Kept as written, for the record.*

Three shelves, three different things, deliberately not one list.

| Shelf | What it is | Where it lives | Who writes it |
|---|---|---|---|
| **Overboard presets** | The shipped defaults — Prime Time and Club Level | A constant in `obs-b2b-shared/src/theme/presets.ts` | Engineers, in a PR |
| **Gallery** | OBS-curated, cross-tenant, genericized | `${prefix}theme_gallery_presets`, its own collection | OBS staff, by promoting |
| **Your presets** | This tenant's own saved looks | `branding.presets[]` on the org | The tenant's `org:admin` |

**`THEME-08` — Applying a preset keeps the tenant's own team colors.** `applyPreset(preset, current)` takes everything from the preset **except** `colors.primary` and `colors.secondary`, which keep the tenant's current values when they exist. A direction is a system a team's palette flows into, not a palette that replaces it — a team that clicks "Prime Time" wants a broadcast treatment of *their* colors, and a picker that repaints them in someone else's blue has misunderstood what it is for. Shipped presets carry a neutral slate `#64748B` in `primary` so an unbranded preview is honest rather than accidentally implying a color the tenant has not chosen, and `applyPreset` swaps in the tenant's primary the moment one exists.

**Only two directions ship as presets, and this is the interesting call.** Prime Time and Club Level ship. **Floodlight does not** — it is the conservative evolution of the current fan default, so its value ships as the *quality bar of the default theme itself* and as an acceptance fixture; offering it in the picker would be offering the tenant what they already have, listed as if it were a choice. **Signal does not either** — what is worth keeping from Signal is two components (the ring gauge and the per-cell stat fraction), which ship as real shared UI available to every theme through `motif.boardCounter`, not as a look. A preset shelf whose entries are "the default, again" and "two components, bundled as a mood" is a shelf that teaches a tenant nothing.

### The rejected model: public cross-tenant preset visibility

**`THEME-09` — A tenant's saved presets are private to that tenant, always. There is no public, tenant-to-tenant preset sharing, and this is a deliberate rejection, not an unbuilt feature.**

The obvious design is to let a tenant publish a preset and let every other tenant browse it — a community palette library, free to build once presets exist as data. It is rejected on three grounds, any one of which is sufficient.

**White-label isolation.** The platform's first promise is that a team's app is the team's product, not a third-party tool visible as such. Every boundary in this system is built on it: `resolveTargetTenant` refuses a tenant-scoped caller who so much as *names* another tenant, the public org endpoint is an explicit allowlist, and OBS staff-ness is verified per request. A browsable list of other tenants' presets discloses, at minimum, that other tenants exist, how many there are, and — the moment a preset is named by a human — who they are. Presets are named by humans; a tenant saves "Away kit" and "2026 rebrand", not "preset-3". That is a tenant-identifying disclosure through a feature whose entire product value is convenience, on a platform whose isolation model is otherwise enforced structurally. It would be the one place a tenant learns about another tenant, and it would have been built for a picker.

**Brand-dispute risk.** A theme is trade dress. A preset carrying a team's exact palette, accent, type and treatment, appearing in a rival team's picker with a one-click Apply, is a mechanism for one licensee to adopt another's visual identity — built, hosted and offered by the platform they both license. The dispute lands on OBS, not on the tenant who clicked. Nothing about the feature's convenience is worth standing in the middle of that, and no disclaimer in a picker resolves it: the risk is the affordance, not the labelling.

**Curation already is the sharing mechanism, and it is better.** Everything public sharing is supposed to deliver — a good look one team built becoming available to another — the promote-to-gallery pipeline delivers, with a **human genericization step in the middle**. Promotion is OBS-staff-only, audited, and strips the source tenant's `colors.primary` and `colors.secondary` on the way in, replacing them with the neutral placeholder, so what lands in the gallery is the *system* (mode, neutrals, type, shape, finish, signature) and never the *brand*. Assets are never copied. The gallery row records `sourceSubdomain` internally for provenance and it is **never on any response a tenant can read**.

So the curated path is strictly better on every axis that matters: a tenant still gets the good look, the identifying colors are gone by construction rather than by policy, a named human decided it was worth sharing, and there is an audit entry saying who and when. The only thing public sharing adds is immediacy — and immediacy is precisely what makes the first two objections bite.

**`THEME-10` — Promotion is an OBS-staff act and is audited.** Unlike ordinary config edits, which this codebase deliberately does not audit (`SEC-06` covers PII release and irreversible actions, not settings), promotion is **cross-tenant publication**: it takes one tenant's work and makes it visible to all of them. That crosses a boundary every other write in this module respects, so it gets the trail — actor, target tenant, preset id, gallery id. Ids and counts only, never values.

---

## Storage

Two decisions, argued separately because they come out differently.

### The theme, assets and a tenant's presets: a subdocument on the organization

**`THEME-11` — `branding` is a typed subdocument on `B2BOrganization`, `_id: false`, `default: undefined`, `$unset` on clear.**

The backend's existing per-tenant config is unanimous on this: `signupFields`, `optIns` and `gateCopy` are all subdocuments on the org, all `_id: false`, and `gateCopy` is `default: undefined` with `$unset` on clear. `branding` is the same kind of thing and the precedent is followed for the same four reasons:

1. **It is a bag of settings with no independent lifecycle.** A theme is never created, queried, or deleted apart from the tenant it belongs to. Nothing references a theme by id. It has no existence without its org — which is the exact test the codebase already applies to decide subdocument vs collection.
2. **It is free on the hot path, and a collection would not be.** `resolveAdminScope` and `resolveTenant` already load the whole org document on every request, and the fan-side lookup is cached 60 seconds. A theme in a separate collection adds a query to the one path every fan page load takes, to fetch data that is always wanted at the same moment as the document already in hand.
3. **`$unset` makes "reverted to platform default" and "never themed" one state.** Storing `{}` would create a third state that looks configured, renders identically, and diverges the first time a default changes. This is `gateCopy`'s rule and it exists because that distinction has no meaning anyone can act on.
4. **Whole-document write, last-write-wins, diffed server-side into a `changes` summary.** Same as `PUT /admin/config`, acceptable at V1's operator count for the same reason, and it keeps preset create/rename/delete/reorder as one array replacement rather than four endpoints.

**`Mixed` is forbidden.** The subschemas are real typed Mongoose schemas mirroring the zod contract, not a `Mixed` blob. A `Mixed` theme would make every guarantee in this spec a client-side convention — the resolver's input could be anything, the font allowlist would be advisory, and a malformed write would surface as a rendering failure on a fan's phone rather than a 400 at the boundary.

**A tenant's own presets are part of the same subdocument**, capped at 20, identity by a slug `presetId` exactly as `fieldId` and `optInId` work. They are bounded, always read with the org, and have no independent lifecycle — the same argument, and it lands the same way. The cap is there so a subdocument array stays a subdocument array: at 20 named looks a tenant has a library; at 2,000 they have a collection, and the shape should change if that ever happens rather than growing quietly.

**Assets ride beside the theme, never inside it.** `BrandingAssets` is a sibling of `theme` in the same subdocument, and `ThemePreset.theme` is a `ThemeSettings` — so **a preset structurally cannot capture a logo**. This matters most at promotion: a gallery entry that could carry a logo URL is a gallery entry that can leak one tenant's asset into another's console, and the type system refuses it rather than a code review catching it.

### The gallery: its own collection

**`THEME-12` — Gallery presets live in `${prefix}theme_gallery_presets`, a separate global collection.**

The same reasoning that puts branding on the org puts the gallery off it, because the gallery fails every test the org subdocument passes:

- **It is cross-tenant.** It belongs to no organization. Embedding it on one org would make that org's document the home of every other org's picker, and embedding a copy on *every* org would be a fan-out write on publication and N copies to keep coherent.
- **It is listed without an org in hand.** `GET /admin/branding` loads the gallery for whatever tenant is in view; the rows are the same rows for all of them. That is a query against a collection, not a projection of a document.
- **It has an independent lifecycle and its own permissions.** Rows are created by OBS staff through a route no tenant can reach, they outlive the tenant that inspired them, and a tenant deleting itself must not take gallery entries with it.
- **It is an entity: it has an id others reference.** `presetId` is unique across the collection, collisions are resolved server-side with a slug suffix rather than a 409 thrown at a staffer who is not the author of the collision.

That is the codebase's own stated rule for a separate collection — "an entity with its own id, its own lifecycle, queried independently of the org" — met on all four counts. The collection inherits `B2B_COLLECTION_PREFIX` like every other B2B collection, so a dev stage's gallery is its own.

**The gallery is read-only to tenants and its rows are already genericized.** There is no tenant-facing write path, and the write path that exists strips brand colors before insert (`THEME-09`). `sourceSubdomain` is stored for OBS provenance and is on no response a tenant receives.

---

## Endpoints and access

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` ([`admin-surface.spec.md`](admin-surface.spec.md) Rule 1). Contracts in `obs-b2b-shared/src/api/admin/branding.ts`.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/branding` | `requireAdmin` | Any resolved admin scope (`ADM-02` read). Returns tenant, theme, assets, the tenant's presets, and the gallery |
| PUT | `/admin/branding` | `requireAdmin` + obs staff or the org's own `org:admin` | Theme and assets, whole desired state |
| PUT | `/admin/branding/presets` | same | Whole-array replacement of the tenant's saved presets |
| POST | `/admin/branding/promote` | `requireAdmin` + **obs staff only** | Publishes one of the target tenant's presets into the gallery |

**Tenant targeting is unchanged** and inherited whole: a caller who is not obs staff may never name a tenant — `?tenant=` is 403 even when it names their own — and an obs caller must name one (400 without it), with 404 for unknown and reserved slugs. Nothing about branding justifies a second targeting model.

**`THEME-13` — `org:admin` writes, `org:member` reads, enforced server-side.** `refuseReadOnlyWrite(scope)` runs **first**, before the target is even resolved, on all three write routes. A suspended tenant's own admins are refused (OBS staff are not) — a paused workspace is paused for configuration too. The console's read-only presentation for `org:member` is UX; the server is the boundary, and the `org:member` refusal carries the module's existing message rather than a branding-specific one.

**`THEME-14` — No reverification in this module** (Arthur, 2026-09-22; since 2026-09-28 no console action re-authenticates at all, [`admin-surface.spec.md`](admin-surface.spec.md) "No re-authentication"). A theme edit is undone by publishing again: it releases no PII, sends nothing to anyone, triggers no irreversible action, and its worst outcome is a tenant's site looking wrong until someone publishes again — which they can do immediately, from the same screen.

Promotion is the one write that is *not* reversible in the same way — a gallery row is visible to every tenant the moment it lands — and it is handled with the tool that fits: staff-only plus an audit entry. The gallery risk is about *authority*, which is what the staff gate answers. **Promote** stays on a saved preset for staff on the workspace's Brand screen, one of the kept exceptions to "staff see what the workspace sees" (admin-surface, 2026-09-28): publishing a preset for every tenant has no other surface.

**`THEME-15` — Every branding write calls `clearOrgCache()`.** The fan-side org lookup is cached 60 seconds. An admin who publishes a theme, opens the team's site and sees the old one concludes the publish failed — and their next act is to publish again, which does nothing, twice. The write knows exactly which tenant changed. Preset writes call it too: they are org-document writes, the call is cheap, and a cache holding a document that no longer matches the database is a bug regardless of which field moved.

**Responses echo stored state plus a `changes` summary**, and the server owns derived fields — `createdAt` on a preset is merged in from the stored row by `presetId` and is never accepted from the client, the same rule `textVersion` and `publishedAt` follow in the fields module.

---

## The fan wire

**`THEME-16` — Branding reaches fans through the public org endpoint's explicit allowlist.** `GET /b2b/org/:subdomain` is unauthenticated and was deliberately converted from a denylist to an allowlist precisely so that a field added to the shared model does not auto-publish to the anonymous internet. That property is kept: `branding` does not appear on the wire because it was added to the org, it appears because a hand-picked projection was added to the handler — `{ theme, logo, sponsorName, sponsorLogo, sliderTipImageUrl }`, and nothing else.

**`THEME-17` — Presets are never on the fan wire.** Not the tenant's, not the gallery's. A fan needs the *active* theme; a preset is authoring state. Shipping it would publish a tenant's unreleased looks — and, in the gallery's case, every other tenant's curated entries — to an endpoint with no authentication at all. The projection above is exhaustive and `presets` is not in it; the `BrandingSettings` type and the wire type are deliberately different shapes so this cannot be reintroduced by spreading an object.

**`THEME-18` — Branding is served while `suspended === true`.** The suspended path is branded on purpose: a paused workspace shows the team's page on a break, never a raw error and never another team's colors. The theme must therefore be in the response *before* the suspension branch returns, and a test pins it. This is the existing behavior of the compile-time model and it is easy to lose when the source of the colors moves to the server.

The public org schema takes the branding block with a passthrough/loose object so a later additive field does not require a five-way submodule pin bump to reach fans.

---

## Back-compat

*Superseded 2026-09-29: the bundled tenant files hold no colours; the seeds are four-colour themes in `theme/seeds.ts`, and a stored theme in the older shape is read by `normalizeTheme` and rewritten by the migration script (revision at the top). The parity test now pins how bears, fightinghawks and test read. Kept as written, for the record.*

**`THEME-19` — The compile-time tenant files become seeds, and the server wins.** `overboard-b2b-template/src/config/tenants/*.ts` stay exactly as they are. The fan app applies the **local seed synchronously at module scope** — the colors are already in the bundle, so this costs nothing and kills the cold-load flash the current provider-mount timing produces — then re-applies the server theme when `GET /b2b/org` returns and `branding.theme` is present. Server wins; the seed is the first paint and the offline fallback.

`themeFromLegacyColors()` converts the eight-hex shape into a `ThemeSettings`: mode dark, primary/secondary/accent as given, neutrals from background/card/text/textMuted with the **explicit** `border` (this is what `THEME-06` exists for), defaults everywhere else. The `test` tenant, which configures no colors, resolves to the platform default theme and must render identically to today's `.dark` block.

**`THEME-20` — Legacy parity is pinned by test, with exactly one sanctioned visual delta.** `src/theme/__tests__/legacy-parity.test.ts` asserts, for all four existing tenant color sets, that `themeToCssVars(themeFromLegacyColors(x))` equals the legacy `applyTenantColors` mapping **for every variable except** `--primary-foreground`, `--secondary-foreground` and `--accent-foreground`. For those three it asserts the computed value equals the legacy value **whenever the legacy value cleared 4.5:1** against its background.

Read the two halves together: **the rendering changes only where it was already broken.** A tenant whose hand-picked foreground was legible keeps it, byte-for-byte; a tenant whose foreground failed contrast gets a legible one. The test names the case directly — `fightinghawks`' secondary foreground is asserted to no longer be white on white.

This is the only visual change this wave sanctions to an existing tenant, it is argued above ("Why on-colors are computed"), and it is pinned rather than trusted. Any *other* delta the parity test catches is a defect in the resolver, not a new sanctioned difference.

**No migration, no backfill.** A tenant with no `branding` subdocument renders exactly as it does today, from its seed. The first publish through `/branding` writes the subdocument and the server starts winning for that tenant and no other. Same standard the fields module set, met the same way: the cheapest migration is a read path that already understands both shapes.

---

## The screen

`/branding` — **Brand**, its own page since 2026-09-28 (it was the Brand tab of Sponsors & Branding; Sponsors is [`admin-sponsors.spec.md`](admin-sponsors.spec.md)) — per the fan-theming design contract. The [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) skeleton is copied wholesale — pick-tenant empty state, `key={qs}` remount on tenant switch, draft-and-publish with the draft held in the page only (no autosave; a "Leave without saving?" prompt when there are unpublished changes, since 2026-09-28), inline publish notes rather than toasts, read-only presentation for `org:member`, and the console's own `ui/` primitives throughout.

**Groups, since 2026-09-29** (the four-colour model, revision above): **Colours** (Main, Accent, Text, Button text, and the highlight readout) · **Images** (Logo; Progress marker, the image that moves along the board's prize progress bar, which a game's own marker, and ahead of it a sponsor holding the slider slot at a game, replace there). The marker row's hint: "Rides the prize progress bar on every board, unless a game has its own. Shown at up to 48 × 36 px."

*Before 2026-09-28, kept for the record:* **Look** (Light/Dark) · **Colors** (Team color, Second color, Accent, Live tone, and an Advanced reveal for explicit neutrals) · **Type** (Headline font, Body font, Number font, ALL-CAPS headlines, Headline weight) · **Shape** (Corner roundness, Density) · **Finish** (Border strength, Texture, Glow) · **Signature** (Hero band, Bingo counter) · **Assets** (Logo, Progress marker).

**Defaults when nothing is uploaded** (revised 2026-09-29, Walk #3): the fan app shows the tenant's initials as a monogram, Button text on Accent, for **Logo**, and for **Progress marker** a small triangle above the bar pointing down at the fill's tip, in the tenant's Text colour (`--foreground`, the theme's `neutrals.textPrimary`, never a literal colour). The row's default thumb draws the same triangle in the Text colour being edited, on the background being edited ("A small triangle in your text color, pointing at the fan's progress."). The Overboard mark and the OB badge are no longer defaults. Outside this page, a contest with no banner shows the brand band in the tenant's colours (neutral when no colours are set), and a prize with no image shows none.

**Sponsors live on their own tab, not in this editor.** The Brand tab is draft-and-publish with a live preview; sponsors are records saved one at a time with a schedule grid, and one scrolling page holding both save models would put a Publish bar above controls it does not publish (argued in [`admin-sponsors.spec.md`](admin-sponsors.spec.md)). `branding.assets.sponsorName`/`sponsorLogo` stay on the contract as legacy fallback for a tenant with no sponsor records; nothing edits them.

*Retired from the page 2026-09-28 (the minimal baseline); the endpoints remain. Kept as written, for the record:* **The preset picker was the three shelves above**, in that order. Apply runs the shared `applyPreset`, so the tenant's own team colors survive (`THEME-08`). Save-as-preset, rename and delete act on "Your presets" only. **Promote to gallery appears only for OBS staff** — gated on the staff flag, not on write access, because a tenant `org:admin` has write access and must not have this. The server refuses it regardless; the gate is so the control is not offered to someone who cannot use it.

### Live preview

*Retired 2026-09-28: the preview is the console's phone preview with the sample contest (revision above). Kept as written, for the record.*

**`THEME-21` — The preview renders real shared components under the draft theme's resolved variables, and captions nothing.** The wrapper is `.obs-gate-preview` with an inline style of `themeToCssVars(draftTheme)`, which overrides the class's fallback palette by specificity. Inside it: the real `EntryGatePreview` from `obs-b2b-shared`, plus a sampler strip built **only** from real shared pieces and real tokens — a display-type headline, a primary CTA, chips, the ring gauge or the numeral per the draft's motif, a stat fraction, and one hit-treatment tile.

This satisfies [`admin-surface.spec.md`](admin-surface.spec.md) Rule 12 the same way the gate preview does: the console renders the fan product's own code, never a likeness in console markup. A hand-drawn swatch board would be a second implementation of the theme system and would drift from it — and unlike a field label, a drifting *theme* preview is wrong about every screen at once.

**The theme variables stay scoped to the wrapper, never the document root.** The console has its own token namespace (`--bg`, `--text`, `--accent`); the fan names (`--background`, `--primary`) are defined only inside `.obs-gate-preview`. Setting them at `:root` would repaint the console in whatever palette the draft carries, which is how the fan app does it and exactly wrong here.

**The fields spec's "the team's colors apply on their own site" caption is removed** once branding is live. It was honest when the console could not know a tenant's colors; this spec is the reason it stops being true, and leaving it would be the screen narrating a gap that no longer exists (Rule 12 below, Principle 1).

**A full board preview is out of scope for this wave** — the gate plus the sampler is what is honestly renderable now. Recorded below; **not captioned on screen**.

### The board, and the honesty rule in its sharpest form

The fan board gains two shared components, both theme-driven and neither direction-specific: a ring-gauge bingo counter (`motif.boardCounter === "ringGauge"`) and a per-cell live stat fraction.

**`THEME-22` — A per-cell stat fraction renders only when the underlying progress is real, and renders nothing otherwise.** The conditions are all of: the prop names a player entity, the outcome type is `Over`, the progress value is a number, and the target is greater than zero. When any fails, the cell shows **no fraction and no caption** — no "not tracked", no "—", no explanatory line anywhere on the board.

This is Principle 1 at its sharpest and it is worth stating as a rule because the instinct to explain is strong. A fan looking at a cell with no fraction learns nothing false. A fan looking at a cell that says "not measured yet" has been handed a piece of platform vocabulary, a hint that the number exists somewhere, and a reason to distrust the fractions that *are* shown. The absence is the honest signal; narrating it is the dishonest one.

**Under props never render a fraction this wave**, even where progress data exists, because the existing progress bar's semantics are inverted for them and a fraction inherited from that bar would be confidently wrong. If the bar's inversion is cheap and safe to fix it is fixed; if it is not, the bar stands as-is and the gap is recorded below. **Neither path renders a fraction for an Under.**

**Celebration is theme-derived, not direction-coded.** `celebrationProfile(theme)` returns pure data — particle count, spread, whether a broadcast flash fires, whether the moment is uppercase — computed from `glowIntensity` and `displayTransform`. Glow 0 yields 40 particles and no flash, which is Club Level's editorial understatement falling out of the theme rather than being special-cased (`THEME-07` again).

**`THEME-23` — `prefers-reduced-motion: reduce` means no confetti and no flash at all.** Not fewer particles, not a shorter flash: none, with the modal appearing statically. This is the fan app's first reduced-motion handling and it is specified as an absolute because a reduced version of a full-screen color flash is still a full-screen color flash.

---

## Rules

1. **The theme is pure data; the resolver is the only thing that computes.** On-colors, tints, ladders, shadows and gradients are derived at apply time from one shared implementation and never stored. A second derivation anywhere is a defect.
2. **On-colors are computed, never authored.** No stored pair of values can render invisible text, because the second value is not stored.
3. **Status colors stay platform-owned.** `--destructive`, `--success`, `--warning` are not in the contract and are not emitted. `live` is the one themable signal tone.
4. **Fonts come from the closed allowlist.** A font id outside `THEME_FONT_IDS` is a 400. There is no tenant-supplied font URL.
5. **The four directions are preset JSON with zero per-direction code**, pinned by the acceptance test. A look that needs a branch is a contract defect.
6. **Applying a preset preserves the tenant's own primary and secondary.** A direction is a system the team's palette flows into.
7. **A tenant's presets are private to that tenant.** No public cross-tenant visibility, now or later, as a decision — white-label isolation, brand-dispute risk, and curation being the better mechanism.
8. **Promotion is OBS-staff-only, audited, and genericizing.** Brand colors are replaced with the neutral placeholder on the way into the gallery, assets are never copied, and `sourceSubdomain` never reaches a tenant-readable response.
9. **Branding is a typed subdocument on the organization; the gallery is its own collection.** `Mixed` is forbidden in both. `$unset` on clear, so cleared and never-set are one state.
10. **A preset cannot carry an asset**, by type, not by review.
11. **Presets never cross the fan wire**, and branding does reach it only through the public endpoint's explicit hand-picked allowlist — which must include branding while `suspended === true`.
12. **The preview renders the fan product's own code and captions nothing about its own limits.** Gaps are recorded in this spec; they do not appear on screen.
13. **A stat fraction renders only when the progress behind it is real**, and nothing renders in its place when it is not. Under props render none this wave.
14. **Every branding write clears the tenant's org cache.**
15. **No branding write re-authenticates.** Every one of them is undone by publishing again (and since 2026-09-28 no console write re-authenticates).
16. **Legacy parity is pinned by test, with exactly one sanctioned delta** — computed on-colors fixing foregrounds that already failed 4.5:1. Any other difference is a resolver defect.
17. **Reduced motion means no confetti and no flash**, not a smaller one.

---

## Recorded gaps (recorded, not blocking, and never on screen)

Principle 1 makes this section load-bearing: it is the *only* place these live.

- **Sponsor asset management** — closed 2026-09-23 by [`admin-sponsors.spec.md`](admin-sponsors.spec.md): a sponsor entity with a schedule, on its own tab, as predicted here.
- **No full board preview in the console** — closed 2026-09-28: the phone preview shows the fan app's own board, built from the built-in sample contest (invented teams and players, never presented as the tenant's data).
- **No stat fraction for Under props or non-player props.** The Under case is blocked on the existing progress bar's inverted semantics; the non-player case is blocked on there being no per-cell progress concept for it. Both render nothing rather than something approximate.
- **Board freshness is 2-minute polling.** The fractions are as fresh as the poll, which is the platform's actual truth today, not a streaming feed. Nothing on screen claims live-to-the-second, and nothing on screen explains the cadence either.
- **`BRAND-02`** — implemented by [`admin-sponsors.spec.md`](admin-sponsors.spec.md). This spec covers `BRAND-01`'s elements only.
- **Publishing is last-write-wins between two admins**, as everywhere else in the admin surface. Acceptable at V1's operator count; the same revisit trigger applies.
- **The gallery has no delete path in this wave.** Rows are created by promotion and edited by nobody. A curated library of a dozen entries does not need lifecycle management yet; one that grows will, and it is a small additive route when it does.
- **Preset ordering is array order with no separate rank field**, exactly as `signupFields` works. A reorder is a whole-array write.
- **The admin console's own theme is untouched.** This spec governs the fan theme; the console's tokens are a different namespace and a different concern.

## References

- PRD: [`BRAND-01`–`BRAND-04`, `ADM-02`, `ADM-03`, `TEN-02`, `TEN-03`, `TEN-05`, `TEN-C1`](../../../documents/PRD/OBS_B2B_Platform_PRD.md) — §8 Branding & Sponsor Assets, §15.2 the dividing line
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework, the `/branding` nav destination, the **Fan's-eye view** principle and Rule 12, and "No re-authentication"
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the draft-and-publish skeleton, the `.obs-gate-preview` wrapper, and the "the preview cannot show a tenant's real colors" known gap this spec closes
- [`../../webapp/styling.spec.md`](../../webapp/styling.spec.md) — §1 the runtime theming system this replaces, and the platform-fixed status colors it keeps
- [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — its Data Model section already places branding server-side; this is that
- HLD: [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the layer rules `src/theme/` (pure, no react, no DOM) and `src/ui/board/` (react, relative imports only) must satisfy
- `obs-b2b-shared/src/theme/` — `color.ts`, `fonts.ts`, `resolve.ts`, `presets.ts`, `legacy.ts`, `celebration.ts`, and the acceptance and parity tests that pin `THEME-07` and `THEME-20`
