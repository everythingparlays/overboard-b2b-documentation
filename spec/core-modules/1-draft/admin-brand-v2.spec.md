# Core Module Spec: Admin — Brand v2

**Implements:** Arthur's ruling "Brand gets simpler" (WAVE-RULES 2026-09-24), PRD `BRAND-01` (as reclassified by [`admin-branding.spec.md`](admin-branding.spec.md)), `ADM-02`, `ADM-03`, `TEN-02`.

**Supersedes:** the screen section of [`admin-branding.spec.md`](admin-branding.spec.md) ("The screen", its "Live preview" subsection, `THEME-21`, and Rules item 12), plus that spec's out-of-scope line and recorded gap about a full board preview. Its contract, derivation, preset, storage, endpoint, fan-wire and back-compat sections stay in force by reference; see "What happens to the `THEME-nn` rules" below.

**Depends on:**
- [`admin-branding.spec.md`](admin-branding.spec.md): the theme contract v2, the resolver, presets and gallery, storage, access and the fan wire.
- [`fan-decor-system.spec.md`](fan-decor-system.spec.md): the decor kit, the `decor` block, `surface.texture: "bingoGrid"`, and how the fan app resolves an absent `decor`.
- The unified preview contract, `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md` (the "interface file" below), and the console's `FanAppPreview` host, which S1 specs.
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md): the draft-and-publish skeleton and the Screen text tab, where the gate strings are edited.
- [`fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md): the fan screens that show the five brand strings, and their fan-side rules (`FAN-48` to `FAN-54`).
- [`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md): the `/preview` route the frame loads, and its fixtures.
- [`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md): the board and prize screens the preview shows, including the Track that carries the progress marker.
- Build order: [`fan-app-v2-build-plan.md`](../../../documents/HLDs/fan-app-v2-build-plan.md), slice f5.

**Status:** Draft, 2026-09-24 (S2 fan-app design seat). Two open questions at the end.

**Mock:** `overboard-b2b-workspace\mocks\fanapp-v2\brand-v2.html`.

## Overview

**In one line:** the Brand page becomes presets first, a four-colour palette, one font choice, light or dark, two image uploads, five editable strings and a folded Fine-tune drawer, all previewed in the real fan app.

Today's page asks a tenant admin to make 22 decisions through 29 inputs in 7 groups (`Branding.tsx:530-827`), puts presets at the bottom (`:830-958`), opens the operating system's colour picker (`:1071-1078`), and previews a hybrid of the real gate and an admin-only sampler (`BrandPreviewPanel.tsx:136-176`). v2 keeps every stored decision valid, puts the decisions a team actually makes on top, hands the rest to the preset, and replaces the sampler with the real fan app in preview mode.

**In scope:**
- The `/branding` screen, top to bottom, at desktop and narrow widths.
- The in-page colour picker.
- The font pairings.
- The preset shelf and its thumbnails.
- The five brand strings: storage, endpoint change and fan wire.
- The image upload tiles and the upload route they need.
- The Fine-tune controls and how they map to the contract.
- The mapping of all 22 current settings.
- UI-state derivation on load, and the draft key bump.
- How Brand drives the unified preview.

**Not in scope:**
- Sponsor artwork. Sponsors have their own page (Arthur's ruling; S1 specs it).
- The console-side preview host internals (`FanAppPreview`: frame chrome, sizing, loading and error states). S1 specs those.
- The fan decor kit itself (components, alpha rules, motion). See [`fan-decor-system.spec.md`](fan-decor-system.spec.md).
- The light-mode flash on cold load. G2 fixes it; this page only sets `mode`.
- The seven gate strings. They stay in Fields & Opt-ins › Screen text.
- The admin console's own look. D-067 parked it.

---

## Principles

**Presets first.** A preset is a whole direction: neutrals, type, shape, finish and decor. Most tenants should need only a preset and their Team colour. So the shelf sits at the top, and applying a preset never touches the palette the tenant chose.

**A palette, not a token editor.** A tenant picks two to four colours, and the resolver derives everything else: on-colours, tints, the neutral ramp, glow. The page never offers a control for a value the resolver computes (`THEME-03`). "Page", "Cards" and "Text" colours become preset-owned.

**One font choice.** A pairing sets display, body and numeric faces, the headline transform and the headline weight together. Five type inputs become one row of cards. No tenant can build a mismatched mix from scratch, and a mix already stored is preserved, not broken.

**Nothing native.** No control opens a browser or operating-system popup. There is no `<input type="color">` and no `<select>` anywhere on the page. The one exception is the file chooser behind an upload tile, which is the only way a browser can read a local file, and drag-and-drop is offered beside it. Range sliders stay native elements, because they render in the page and work from the keyboard everywhere (`Branding.tsx:1163`).

**The real fan app is the only preview.** The frame on the right is the fan app's own `/preview` route, painted by the same `themeToCssVars` the live site uses. The page draws no likeness of a fan screen. The preset thumbnails are swatches of a direction, built from the shared decor pieces. They are not previews of the tenant's site, and they never show data.

**Honesty.** The preview shows the draft theme over the fan app's built-in sample fixtures. Those are labelled as samples ("Sample contest", "Sample Player 1"), and the frame carries its persistent Preview marker. The page never invents a contest, a player, a sponsor or a number to make the preview look fuller. Where the page cannot know something, such as colours from a logo it cannot read, it omits the control silently and records the gap here (D-068).

---

## The screen

**Route:** `/branding`, unchanged. The sidebar item is **Brand**, separate from **Sponsors** (S1 owns the sidebar and its hues). Brand drops the shared `SponsorsBrandingHead` tab head (`Branding.tsx:981`). The page head is eyebrow "Configuration", title "BRAND", sub "How your fan site looks." The pick-tenant empty state (`Branding.tsx:200-208`) and the `key={qs}` remount on tenant switch (`:210`) are unchanged.

**Hues:** if the Brand sidebar item carries a hue, the page's section cards take the KPI tile's top-wrapping outline (`inset 0 2px 0 0 var(--marker)`, `hues.css`), never a square marker (WAVE-RULES "Colour hues").

### Layout

**Desktop (1100px and wider):**
- Two columns under the page head. The left column holds the controls: max 440px wide, the sections below in order, 24px apart.
- The right column holds the preview. It is sticky at `top: 24px` and fills the remaining width. The host frame scales to fit the viewport height (S1's `FanAppPreview`).
- Above the frame are the preview controls: the screen switcher, the Light/Dark peek toggle, and the Phone/Desktop toggle.
- The footer bar is sticky at the bottom of the left column.

**Narrow (600–1099px):**
- One column.
- The preview becomes a collapsible panel pinned under the page head. Collapsed, it is a 48px bar reading "Preview" with a chevron, the current screen's name and the peek state. Expanded, it shows the preview controls and the frame, at most 70vh tall, and the controls scroll beneath it.
- Collapsed is the default below 1100px. The choice is remembered per browser, as a convenience only.
- The footer bar is sticky at the bottom of the viewport.

**Phone (under 600px):**
- Same as narrow, with these changes:
  - The palette swatches go 2×2.
  - The font cards and preset shelves scroll horizontally, with scroll snap.
  - The colour picker opens as a bottom sheet instead of an anchored popover.
  - Footer buttons go full width, Publish on top.
- Every tap target is at least 44px.

**Read-only (`org:member`):**
- Every control renders disabled, and the preview still works.
- The footer bar is replaced by the existing line "Read-only — only organization admins can change branding" (`Branding.tsx:994-997`).
- Preset cards show no actions, and the picker opens read-only: hex visible, square and strip inert.

### Page-level notes (above section 1)

These sit above section 1 and are inline lines, not toasts:
- **Restored draft:** "Restored your unsaved changes." with Dismiss, as today (`Branding.tsx:519-526`).
- **Old draft cleared:** "We refreshed the Brand page; your unpublished draft from before was cleared." with Dismiss. It is shown once (see Migration).
- **Publish result:** the publish result line, as today (`:517-518`), extended with "words updated" (see Endpoints).

### 1. Presets

- **Card title:** "Presets"
- **Help:** "Start from a look. Your colours stay yours."

**Shelves:** three horizontal shelves, each with a small uppercase label.
- **Overboard:** Prime Time and Club Level (`SHIPPED_PRESETS`, `presets.ts:101-104`).
- **Gallery:** staff-curated looks. The shelf is hidden when the gallery is empty, as today (`Branding.tsx:894`).
- **Yours:** the tenant's saved looks, then a trailing **Save current look** card.

**Preset card:**
- 148×104 thumbnail with the name underneath (14px, one line, ellipsis). The whole card is one button labelled "Apply {name}".
- The card matching the draft's base preset (see Migration, "base preset") shows a 2px Team ring and a small "In use" chyron.
- Cards on the Yours shelf carry a 32px overflow button (⋯, label "More actions for {name}") in the top-right. It opens an in-page menu, not a native one, with **Rename**, **Delete**, and **Add to gallery** (staff only, gated on `useIsObsStaff()` as today, `Branding.tsx:951`).
- **Rename** swaps the name for an inline input: max 60, Save and Cancel, Enter saves, Esc cancels (`:917-940`).
- **Delete** asks inline "Delete {name}? This can't be undone." with Delete and Cancel. Today it deletes immediately (`:447-451`), and a confirm is added because the whole array is rewritten.

**Save current look card:**
- A dashed card labelled "Save current look". Clicking it turns the card into a name input: max 60, placeholder "Name this look", Save and Cancel.
- Saving writes the whole array through `PUT /admin/branding/presets` (`Branding.tsx:401-436`).
- At 20 presets (`THEME_PRESET_CAP`, `B2BOrganization.ts:394`) the card is disabled with the line "You can keep 20 looks. Delete one to save another."

**Thumbnail:**
- A static composition rendered with the console's copy of the shared decor kit (`obs-b2b-shared/src/ui/decor/`, vendored in the console): a `HeroBand` fragment across the top, one `Chyron` tag, and two board squares, one hit (Team fill, check puck) and one pending (hairline).
- It is painted by `themeToCssVars(applyPreset(preset.theme, draftTheme))`, inlined on a wrapper element. That means the preset's own neutrals, mode, type, radius and decor, carrying the tenant's current Team (and Second) colour.
- The variables stay scoped to the wrapper and never reach `:root`, the same rule as today's `.obs-gate-preview` (`admin-branding.spec.md`, "Live preview").
- No motion and no text beyond the chyron label "LIVE". The fonts come from `loadThemeFonts` (`themeFonts.ts:56`).

**Behaviour:**
- Applying runs the shared `applyPreset` (`presets.ts:116-141`), which keeps `colors.primary` and `colors.secondary` (`THEME-08`).
- On top of that, the page carries over **Accent** and **Live** when they are overridden (not Auto). Only Auto colours take the new preset's values.
- Applying is a draft edit. Nothing reaches fans until Publish.
- The preset list writes (save, rename, delete, promote) happen immediately, as today, because presets are authoring state, not the published look.

### 2. Palette

- **Card title:** "Colours"
- **Help:** "Team is required. The other three follow it until you change them."

**Swatches:** four large swatches in one row, in this order.

| Swatch | Writes | Required | Auto means |
|---|---|---|---|
| **Team** | `colors.primary` | yes | never auto |
| **Second** | `colors.secondary` | no | absent; the resolver derives it from Team ([`fan-decor-system.spec.md`](fan-decor-system.spec.md), auto Second) |
| **Accent** | `colors.accent` | no | the base preset's accent |
| **Live** | `colors.live` | no | absent; the resolver uses the mode's live tone (`DEFAULT_LIVE`, `resolve.ts:51-54`) |

**Swatch anatomy:**
- Each swatch is 96×96 (2×2 at under 600px) and filled with its effective colour.
- The name sits underneath in 13px, and the hex underneath that in 12px mono, uppercase, always visible.
- Second, Accent and Live show an **Auto** chip in the top-right corner while auto. The chip uses the swatch's own on-colour, so it is readable on any fill.
- Each swatch is a button labelled "{Name} colour, {hex}{, auto}. Edit", with `aria-haspopup="dialog"` and `aria-expanded`.
- A 2px focus ring in the console accent sits outside the swatch.

**Default for an unbranded tenant:** the draft seeds the platform default theme (`DEFAULT_THEME`, `resolve.ts:375-389`; `Branding.tsx:142-144`). Team shows `#E5E5E5` and the other three show Auto.

**Validation:**
- Every written value is `#RRGGBB` uppercase. The wire refuses shorthand and alpha (`branding.ts:30-32`).
- Team can never be empty.

**Custom page colours note:**
- If the draft's `colors.neutrals` exists and matches no known preset ramp (see Migration), a line appears under the swatches: "Custom page colours from an earlier setup." with a **Reset to preset** text button.
- Reset replaces `colors.neutrals` with the ramp of the base preset for the current mode, or with the Prime Time ramp (dark) or Club Level ramp (light) when there is no base. Everything else stays.
- The stored values stay in force until the admin resets them, and the preview shows them honestly.

### The in-page colour picker

Tapping or clicking a swatch, or pressing Enter or Space on it, opens the picker.

**Container:**
- **Desktop and narrow:** an anchored popover, 232px wide, below the swatch (above it if it would overflow the viewport), with a 12px card radius and a hairline border.
- **Under 600px:** a bottom sheet with a drag handle. The square scales to the sheet width at a 10:7 aspect.
- Either way it is `role="dialog"` with `aria-label="{Name} colour"`, and there is **one picker open at a time**.

**Anatomy, top to bottom:**

1. **Header:** the colour name, plus its state: "Auto: follows Team" (Second), "Auto: from the preset" (Accent), "Auto: standard live colour" (Live), or nothing while overridden.
2. **Saturation and brightness square, 200×140.**
   - x is saturation, 0 to 100% left to right.
   - y is brightness, 100% to 0% top to bottom (the HSV model).
   - The square is HSV, not HSL, because an HSL square would put white along the whole top edge.
   - The fill is the current hue at full saturation and brightness, with a white-to-transparent horizontal gradient and a transparent-to-black vertical gradient.
   - The cursor is a 14px ring (2px white, 1px dark outline) at the current point.
3. **Hue strip:** 200×14 visual with a 44px tall hit area, hue 0 to 360 left to right, and a 16px thumb.
4. **Hex row:**
   - A `#` prefix, then a 6-character field in mono. It accepts a pasted value with or without `#` and upper- or lowercases it.
   - Beside the field sits a 32px "before and after" chip: left half the value when the picker opened, right half the current value.
5. **From your logo:**
   - Up to six 28px swatches sampled from the uploaded logo. Clicking one sets the colour.
   - The label is "From your logo".
   - The row is hidden when there is no logo, or when the logo cannot be read (see Recorded gaps).
6. **Contrast readout:** one line, computed with the resolver's own functions.
   - The text is "Text on {Name}: {white|near-black}, {ratio}:1".
   - The ink is `onColor(value)` (`color.ts:153`). Near-black is `#101010`, and white is `#ffffff`.
   - The ratio is `contrastRatio(value, ink)` (`color.ts:127`), to one decimal.
   - If the ratio is under 4.5, the line adds "(below the 4.5:1 reading standard)".
   - If the colour is within 1.5:1 of the resolved page ground, a second line reads "Close to the page colour ({ratio}:1). Bands and buttons may be hard to see."
   - Both lines are factual and never block.
7. **Actions:**
   - For Second, Accent and Live, a **Reset to auto** text button. It is shown only while the colour is overridden. It writes absence for Second and Live, and the base preset's accent for Accent (absence when there is no base).
   - A **Done** button.

**Pointer:**
- Pressing on the square or the strip moves the cursor there immediately and captures the pointer. Moving updates continuously, and releasing ends the drag.
- Both the square and the strip have `touch-action: none`, so dragging never scrolls the page.
- Every change writes the draft at once. The preview message is debounced (see The preview).

**Keyboard:**
- **Tab order inside the picker:** square, then hue strip, then hex field, then logo swatches (one tab stop, arrow keys between them), then Reset to auto, then Done, then back to the square.
- **Focus trap:** focus is trapped while the picker is open. Focus lands on the square when it opens.
- **Square:** a focusable element with `role="slider"`, `aria-label="Saturation and brightness"` and `aria-valuetext="Saturation 72%, brightness 40%"`.
  - Left and Right step saturation by 1, and Up and Down step brightness by 1.
  - Shift plus an arrow steps by 10.
- **Hue strip:** `role="slider"`, 0 to 360, with `aria-valuetext` "Hue 214 degrees".
  - Left and Right (or Down and Up) step by 1 degree, and Shift steps by 10.
- **Hex field:**
  - Enter commits a valid 6-digit hex and keeps the picker open.
  - An invalid value shows "Use six digits, like #1D428A." under the field and commits nothing.
  - Leaving the field with an invalid value restores the last valid hex.
  - Partial typing never writes the draft, the same rule as `ColorRow` today (`Branding.tsx:1049-1063`, `:1086-1091`).
- **Closing:**
  - **Esc** closes the picker and restores the colour it opened with, including its Auto state.
  - **Done**, a click outside, or tapping the sheet's scrim closes it and keeps the current value.
  - Focus returns to the swatch that opened it.

**Colour-blind safety:**
- The hex is always visible: on the swatch face, in the picker field, and in the before and after chip's accessible name.
- Auto state is a text chip, never a colour cue alone.
- The contrast readout is text.

**No native input:** there is no `<input type="color">` anywhere in the console after v2. `ColorRow` (`Branding.tsx:1029-1097`), with its native swatch at `:1071-1078`, is deleted, and a lint rule (`no-restricted-syntax` on `input[type="color"]`) keeps it out.

**Where the picker lives:** `src/components/ui/ColorPicker.tsx`, with pure conversion helpers (hex, HSV, hue) in `src/lib/color-hsv.ts` and unit tests. The picker is a console primitive, not a Brand-only widget. Other pages may use it later.

**Logo sampling:**
- The logo is drawn into an offscreen 64×64 canvas, with `crossOrigin="anonymous"` on the image.
- Pixels with alpha under 128 are skipped. The rest are bucketed at 4 bits per channel.
- The page takes the most populous buckets in order, keeping a bucket only if its mean colour is at least 48 (Euclidean RGB) from every colour already kept, and stops at six.
- The result is computed once per logo URL and held in memory.
- If `getImageData` throws (a tainted canvas), the row stays hidden.

### 3. Font

- **Card title:** "Font"
- **Help:** "One choice sets headlines, body text and numbers."

**Cards:** a `role="radiogroup"` row of pairing cards, 120×96 each, scrolling horizontally when they don't fit.
- **Face:** "Aa 27". "Aa" is set in the pairing's display face at its weight with its transform applied, so Broadcast shows "AA". "27" is set in the numeric face.
- **Label:** the pairing name in console type.
- **Sub-line:** the faces in 12px muted type, for example "Barlow Condensed · Barlow · Plex Mono".
- **Keyboard:** arrow keys move and select. The selected card has a 2px ring and `aria-checked="true"`.
- **Fonts:** all pairing faces load once through `loadThemeFonts` when the section mounts (`themeFonts.ts:56`).

**Selecting a card** writes the whole `type` block at once. All five fields are written explicitly (`Branding.tsx:325-334` is replaced by one write).

**The pairings** (a shared constant `THEME_FONT_PAIRINGS` in `obs-b2b-shared/src/theme/pairings.ts`, so the fan-app spec, the mocks and the tests read one table):

| id | Name | `fontDisplay` | `fontBody` | `fontNumeric` | `displayTransform` | `displayWeight` | Matches today |
|---|---|---|---|---|---|---|---|
| `broadcast` | Broadcast | `barlow-condensed` | `barlow` | `ibm-plex-mono` | `uppercase` | 600 | Prime Time (`presets.ts:49-55`) |
| `classic` | Classic | `fraunces` | `instrument-sans` | `instrument-sans` | `none` | 600 | Club Level (`presets.ts:82-87`, numeric resolves to body) |
| `modern` | Modern | `satoshi` | `satoshi` | `satoshi` | `none` | 700 | the platform default (`THEME_DEFAULTS`, `resolve.ts:36-48`) |
| `grotesk` | Grotesk | `space-grotesk` | `ibm-plex-sans` | `ibm-plex-mono` | `none` | 700 | none |
| `editorial` | Editorial | `fraunces` | `ibm-plex-sans` | `ibm-plex-mono` | `none` | 500 | none |
| `custom` | Custom | stored | stored | stored | stored | stored | a legacy mix |

All faces are already in `THEME_FONT_IDS` (`B2BOrganization.ts:224-235`) and `FONT_CATALOG`. No font is added.

**The Custom card:**
- Shown only when the stored type block matches no pairing (see Migration).
- The sub-line is "Your earlier font mix" and the face row uses the stored faces.
- Selecting Custom restores the values the page loaded with.
- Once shown, it stays visible until the page reloads or publishes, so an admin who tries Broadcast can go back.

### 4. Light or dark

- **Card title:** "Light or dark"
- **Control:** the console `Segmented`, "Dark | Light".
- **Help:** "Your fans always see this, whatever their phone is set to." `next-themes` is forced to `theme.mode` in the fan app.
- **Writes:** `mode`, via `patchTheme` (`Branding.tsx:301-306`).

**Ramp swap:**
- If the draft's neutrals are a known preset ramp or absent, switching mode also swaps them for that preset's ramp in the new mode.
- If the preset has no ramp for that mode, the neutrals are removed and the resolver's ramp for the mode applies (`resolve.ts:135-156`).
- Custom neutrals are left alone, and the custom-neutrals note stays visible.
- Auto colours stay auto.

This fixes a defect today: switching a Prime Time tenant to Light keeps the dark `#0A0D14` ground (`Branding.tsx:545-555` writes `mode` only).

**Prime Time light ramp:** Prime Time gains its light counterpart in `presets.ts`. These are the values in [`fan-decor-system.spec.md`](fan-decor-system.spec.md), "Light and dark":
- ground `#F6F7FA`
- surface `#FFFFFF`
- raised `#EEF1F6`
- text `#12161F` / `#4E5A6E` / `#7A8599`
- borderBase `#1F2A3D`
- live `#B3364B`

The ramp is a client constant beside the preset, not a contract field. Club Level has no dark ramp, and none is invented.

### 5. Logo and marker

- **Card title:** "Logo and marker"
- **Help:** "PNG, SVG or WebP, up to 1 MB."

**Tiles:** two upload tiles side by side (stacked under 600px).
- **Logo:** writes `assets.logo`.
  - **Help:** "On the start screen and in the site header. Also used for 'From your logo' colours."
  - **Tile:** 200×120, shown on the draft's resolved surface colour.
- **Progress marker:** writes `assets.sliderTipImageUrl`.
  - **Help:** "Rides the prize track on the board. A square image works best. A sponsor holding the slider at a game replaces it there." (`B2BOrganization.ts:352-356`)
  - **Tile:** 120×120.

**Tile states:**
- **Empty:** a dashed hairline, an upload glyph, "Drop an image here or", and a "choose a file" button that opens the operating-system file chooser (`accept="image/png,image/svg+xml,image/webp"`).
- **Drag over:** a 2px Team border and "Drop to upload".
- **Uploading:** the image preview dims, with a thin progress bar and the percentage in mono. Cancel is available.
- **Set:**
  - The image appears contained (never cropped).
  - A factual size line sits under it ("1200×300", or "SVG"), matching the sponsor page's measured line (S1 decisions §8).
  - **Replace** reopens the chooser, and **Remove** clears the draft key.
- **Error:** an inline line under the tile, with the tile keeping its previous image.
  - "That file is over 1 MB."
  - "Use a PNG, SVG or WebP file."
  - "The upload didn't finish. Try again."

**Legacy values:** a stored legacy URL (any string today, `branding.ts:100-105`) shows in the Set state like any other image. It is not re-uploaded or rewritten unless the admin replaces it.

**The URL text fields are gone** (`Branding.tsx:805-828` and `TextRow`, `:1206-1235`).

**Upload path.** There is no upload path to reuse. Sponsor artwork is pasted `https` URLs (`SponsorDrawer.tsx:497-557`; `obs-b2b-shared/src/api/admin/sponsors.ts:21-45`). The research confirms it: "There is no upload, and no check on type, dimensions or file size" (`review-2026-09-24/prizes-sponsors.md:269`). `admin-sponsors.spec.md:331-334` records "no storage bucket, presign route or upload primitive anywhere in the platform". The backend's only AWS client is SQS (`node-server/package.json:13`). S1's sponsor page keeps pasted URLs with "upload later" (S1 design decisions §8).

So Brand v2 defines the platform's first upload primitive, and the Sponsors page adopts the same route when it moves off pasted URLs (see Endpoints, `BRAND2-18`, and open question 1).

### 6. Words

- **Card title:** "Words"
- **Help:** "Leave a box empty to use the standard wording. {team} becomes your team's name."
- **Link line under the help:** "Sign-up screen wording is in Fields & Opt-ins › Screen text." It links to that tab.

**The five strings:**

| Label | Help | Stored key | Default (placeholder) | Max | Input |
|---|---|---|---|---|---|
| Start screen tagline | Under your name on the first screen fans see. | `startTagline` | Pick your players. Win prizes. | 60 | one line |
| Start button | The main button on the first screen. | `startCta` | Continue with email | 24 | one line |
| No contests message | Shown on Home when nothing is scheduled. | `homeEmpty` | Check back soon for the next contest. | 90 | two lines |
| Paused heading | Shown if your site is paused. | `pausedHeading` | Taking a quick break | 40 | one line |
| Paused message | Under the paused heading. | `pausedBody` | {team} Bingo is paused right now. Your account and anything you've earned are safe. Check back soon. | 160 | three lines |

**Each input:**
- The default shows as the placeholder, and a counter "23 / 60" sits bottom-right in mono. It turns amber at 90% of the limit.
- `maxLength` hard-stops typing. Pasted text is cut at the limit and a line explains it: "Shortened to 60 characters."
- Line breaks are not accepted. Enter does nothing in the one-line inputs and is swallowed in the multi-line ones, which only wrap.
- The only token allowed is `{team}`. Any other `{…}` shows "Only {team} can be used here." and blocks Publish.
- A value that is blank after trimming is absent, which means the standard wording (the `gateCopy` rule, `B2BOrganization.ts:139-146`).
- The draft holds exactly what was typed. Trimming happens on publish.

**Preview jump:** focusing an input switches the preview to the screen that shows it: tagline and button go to Gate, the no-contests message to Home (with `sample.homeEmpty`, below), and the paused strings to Paused. The switcher follows.

### 7. Fine-tune

A disclosure, collapsed by default: "Fine-tune" with a chevron and the help "Most looks don't need these." The open or closed state is remembered per browser.

| Control | UI | Writes | Values | Default shown when absent |
|---|---|---|---|---|
| Decoration | Segmented: Off · Subtle · Full | `decor.intensity` | 0 / 0.35 / 0.7 | from the resolver's default (0.6, shown as Full) |
| Band | Segmented: Single · Double · Off | `decor.band`, and mirrors `motif.heroMotif` | `single` / `double` / `none` (heroMotif `angledBand` / `angledBand` / `none`) | Single |
| Texture | Segmented: None · Dot grid · Bingo grid | `surface.texture` | `none` / `dotgrid` / `bingoGrid` | None |
| Corners | Slider 0–24, step 1, value "8px" | `shape.radiusBase` | 0–24 | 10 (`THEME_DEFAULTS.radiusBase`) |
| Glow | Slider 0–1, step 0.05, value "Off" at 0 or "35%" | `surface.glowIntensity` | 0–1 | 0 (shown "Off") |

**Help lines:**
- **Decoration:** "The grid fragments and glow behind your screens."
- **Band:** "The angled team-colour stripe at the top of big screens."
- **Texture:** "A faint pattern on the page background."
- **Corners:** "From sharp to round."
- **Glow:** "How much a hit lights up."

**Decoration and intermediate values:** a stored `decor.intensity` that is not 0, 0.35 or 0.7 selects the nearest segment, with ties going up (0.6 shows Full, 0.2 shows Subtle). The stored value is kept, and the preview shows it, until the admin picks a segment.

**Why Band mirrors `motif.heroMotif`:** a fan build older than the decor kit still reads `heroMotif` (`B2BOrganization.ts:333-338`). With the mirror, the band an admin picks shows on either build. Double is shown as a single band on an old build, which is honest degradation.

**Validation:** the contract ranges (`branding.ts:77-90`) plus the decor ranges in [`fan-decor-system.spec.md`](fan-decor-system.spec.md). The UI cannot produce an out-of-range value.

### Footer bar

- **Left:** a status line. "Unpublished changes" while dirty; otherwise the last publish note or nothing.
- **Right:**
  - **Discard draft** (secondary, disabled when clean): the existing `discard` (`Branding.tsx:364-371`).
  - **Publish** (primary, disabled when clean or blocked by a Words error; reads "Publishing…" while in flight): the existing `publish` (`:373-398`) with `text` added to the body.
- **Use the standard look:** a ghost button at the far left. It sets the draft theme to `null`, the existing behaviour (`:533-537`). It clears only the theme. Images and words are untouched.
  - While the draft theme is `null`, the controls show the platform default and the ghost button is replaced by the line "Using the standard look."
- **Publish errors:** they sit above the bar, as today (`:517`).

---

## Words: storage, endpoint and fan wire

**Twelve curated strings, two homes.**

**Gate strings.** The seven gate strings are the real `GateCopyOverrides` keys: `joinHeading`, `joinSubtitle`, `joinCta`, `returningHeading`, `returningSubtitle`, `consentsHeading` and `footerNote` (`B2BOrganization.ts:147-155`).
- They are edited in Fields & Opt-ins › Screen text, stored as `gateCopy`, and served on `GET /b2b/membership`.
- There is no `returningCta` key; the returning CTA is platform copy.
- Brand v2 doesn't edit them.

**Brand strings.** The five brand strings are the table above.

**Storage.** A new optional subdocument `branding.text` on the organization:

```ts
// obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts (additive)
export const BRAND_TEXT_KEYS = ["startTagline", "startCta", "homeEmpty", "pausedHeading", "pausedBody"] as const;
export type BrandTextKey = (typeof BRAND_TEXT_KEYS)[number];
export const BRAND_TEXT_MAX: Record<BrandTextKey, number> = {
  startTagline: 60, startCta: 24, homeEmpty: 90, pausedHeading: 40, pausedBody: 160,
};
/** Absent, or an absent key, means the platform default. Only the {team} token is allowed. */
export type BrandingText = Partial<Record<BrandTextKey, string>>;
export interface BrandingSettings { theme?; assets?; text?: BrandingText; presets? }
```

- **Mongoose:** a typed `_id: false`, `default: undefined` subschema, with each key a `String` with `maxlength` (`models/b2b.ts:190-194` gains `text`). It is not `Mixed` (`THEME-11`).
- **Defaults:** the default strings live once, in `obs-b2b-shared/src/theme/brand-text.ts` (`BRAND_TEXT_DEFAULTS`), beside `resolveBrandText(text, teamName)`, which substitutes `{team}`. The fan app and the preview both call it. It follows `GATE_COPY`'s single-definition rule (`entry-gate/copy.ts:1-13`).

**Endpoint change:**
- `PUT /admin/branding` accepts `text`, with the same three states as `assets` (`util/admin-branding.ts:56-72`): absent leaves the stored text alone, `null` clears it, and an object stores it whole.
- The schema is `brandingTextSchema`: each key `z.string().trim().max(BRAND_TEXT_MAX[key]).optional()`, plus a refine that rejects any `{…}` other than `{team}` with "only {team} can be used". Like the rest of the branding schemas, unknown keys are stripped.
- After trimming, empty keys are dropped. An empty object is not stored, so the key is `$unset`, the way `compactAssets` treats assets (`:46-53`).
- `changes` gains `textEdited: boolean`. The console summary adds "words updated" (`Branding.tsx:187-193`).
- `GET /admin/branding` and the `PUT` response both echo `text` when present.
- `theme: null` never clears `text`.

**Fan wire:** `GET /b2b/org/:subdomain` projects `text` key by key into `organization.branding.text` (`handlers/org/getOrganization.ts:21-32`; `publicBrandingSchema` in `api/b2b/org.ts:15-24` gains `text`). It keeps the allowlist discipline of `THEME-16`.
- The schema is `.loose()`, so an older fan build ignores the key.
- Branding is served while suspended (`THEME-18`). That is what lets the paused strings reach a paused site.

---

## Images: upload

**The route:** `POST /admin/assets/uploads`, with `requireAdmin` plus `refuseReadOnlyWrite` and the standard tenant targeting (`?tenant=` for staff only).
- **Body:** `{ purpose: "brandLogo" | "brandMarker", contentType: "image/png" | "image/svg+xml" | "image/webp", size: number }`. The `purpose` enum is open to widening for the sponsor slots later.
- **Response:** `{ upload: { url, fields }, assetUrl, expiresAt }`.
- **Refusals:** the server refuses `size > 1_048_576` and any other content type with 400.

**Storage:**
- A presigned **POST** (not PUT) to a new private S3 bucket for tenant assets. Only a POST policy can bind `content-length-range` and `Content-Type`, so the limits hold at S3 and not just in the console.
- Objects are keyed `tenants/{orgId}/{purpose}/{uuid}.{ext}`. They are immutable, and a replace is a new key.
- Assets are served through a CDN origin with `Access-Control-Allow-Origin: *` on GET (needed for "From your logo") and a year-long immutable cache. Infra names the origin.

**SVG:**
- Accepted, and rendered by the fan app and the console only through `<img>`, which never runs script.
- Served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`.
- A post-upload check rejects the object (and deletes it) if it contains `<script`, an `on…=` attribute, `<foreignObject` or an external `href`. The console then shows "Use a PNG, SVG or WebP file."

**Console flow:**
1. Request the presign.
2. POST the file with progress events.
3. Load `assetUrl` into an `Image` to confirm it and read its natural size.
4. Write it into the draft.

Publish stores it in `assets`, and nothing is stored on the org until Publish.

**Validation on `PUT /admin/branding`:**
- A **new** `assets.logo` or `assets.sliderTipImageUrl` must be an `https:` URL, using the sponsors' `isHttpsUrl` (`api/admin/sponsors.ts:24-32`).
- A value equal to the stored one passes unchanged, so legacy relative paths survive a republish.

**Orphans:** uploads never published are tolerated this wave (Recorded gaps).

---

## The mapping: 22 settings (29 inputs) to v2

Each of the seven colour settings is a swatch plus a hex box, so 7 colours times 2 inputs, plus 15 single-input settings, gives 29 (`review-2026-09-24/admin-wide.md`, Q9; `Branding.tsx:530-827`).

**Stored value key:**
- **Kept, honoured:** the stored value is untouched and the fan app keeps rendering it.
- **Kept, noted:** it is also untouched and rendered, and the page shows "Custom page colours from an earlier setup" with Reset to preset.
- **Unchanged:** the value stays stored with no v2 reader change.

| # | Group | Label today | Inputs today | v2 | Stored value |
|---|---|---|---|---|---|
| 1 | Look | Background | segmented (`:545-555`) | **Kept**: Light or dark (§4), plus the ramp swap | `mode`: kept, honoured |
| 2 | Colors | Team color | swatch + hex (`:565-571`) | **Kept**: Palette › Team | `colors.primary`: kept, honoured |
| 3 | Colors | Second color | swatch + hex (`:572-580`) | **Kept**: Palette › Second, Auto chip replaces "Follows the team color" | `colors.secondary`: kept, honoured; absent shows Auto |
| 4 | Colors | Accent | swatch + hex (`:581-589`) | **Kept**: Palette › Accent, Auto chip | `colors.accent`: kept, honoured; equal to the base preset's accent shows Auto |
| 5 | Colors | Live tone | swatch + hex (`:590-598`) | **Kept**: Palette › Live, Auto chip | `colors.live`: kept, honoured; absent or the mode's default shows Auto |
| 6 | Colors › Advanced | Page | swatch + hex (`:611-617`) | **Removed from the UI**; preset-owned | `neutrals.ground`: kept, noted when not a known ramp |
| 7 | Colors › Advanced | Cards | swatch + hex (`:618-626`) | **Removed from the UI**; preset-owned | `neutrals.surface`: kept, noted |
| 8 | Colors › Advanced | Text | swatch + hex (`:627-635`) | **Removed from the UI**; preset-owned | `neutrals.textPrimary`: kept, noted |
| 9 | Type | Headline font | select (`:670-677`) | **Folded** into Font | `type.fontDisplay`: kept, honoured; Custom card if no pairing matches |
| 10 | Type | Body font | select (`:678-685`) | **Folded** into Font | `type.fontBody`: same |
| 11 | Type | Number font | select (`:686-693`) | **Folded** into Font | `type.fontNumeric`: same |
| 12 | Type | Headlines (as typed / ALL CAPS) | segmented (`:694-701`) | **Folded** into Font | `type.displayTransform`: same |
| 13 | Type | Headline weight | select (`:702-709`) | **Folded** into Font | `type.displayWeight`: same |
| 14 | Shape | Corner roundness | slider (`:719-729`) | **Moved**: Fine-tune › Corners | `shape.radiusBase`: kept, honoured |
| 15 | Shape | Spacing | segmented (`:730-737`) | **Removed from the UI**; preset-owned | `shape.density`: unchanged (the fan app reserves it; no reader) |
| 16 | Finish | Outline strength | slider (`:747-757`) | **Removed from the UI**; preset-owned | `surface.borderAlpha`: kept, honoured; the next preset applied replaces it |
| 17 | Finish | Texture | segmented (`:758-765`) | **Moved**: Fine-tune › Texture, plus Bingo grid | `surface.texture`: kept, honoured |
| 18 | Finish | Glow | slider (`:766-776`) | **Moved**: Fine-tune › Glow | `surface.glowIntensity`: kept, honoured |
| 19 | Signature | Angled band | segmented (`:786-793`) | **Moved**: Fine-tune › Band (Single · Double · Off) | `motif.heroMotif`: kept and mirrored from Band; the v2 fan app reads `decor.band` (see Migration) |
| 20 | Signature | Bingo counter | segmented (`:794-801`) | **Removed from the UI**; preset-owned | `motif.boardCounter`: kept, honoured |
| 21 | Images | Logo | URL text (`:811-818`) | **Replaced**: Logo upload tile | `assets.logo`: kept, honoured |
| 22 | Images | Progress marker | URL text (`:819-826`) | **Replaced**: Marker upload tile | `assets.sliderTipImageUrl`: kept, honoured |

**The action buttons:**
- **Use the standard look:** moves to the footer.
- **Set them by hand / Go back to the automatic colors** (`:636-657`): removed. Reset to preset replaces them.
- **Save current look:** becomes the Yours shelf's trailing card.
- **Apply, Rename, Delete, Add to gallery:** become preset cards and their menu.
- **Discard and Publish:** move to the footer.
- **The preview's Join/Returning toggle** (`BrandPreviewPanel.tsx`): retired with the panel. The Join screen is in the switcher, and returning-fan wording belongs to Fields & Opt-ins.

**Count after.** The tenant-facing controls are:
- Light or dark (1)
- Four palette swatches (4)
- Font (1)
- Two upload tiles (2)
- Fine-tune: Decoration, Band, Texture, Corners and Glow (5)

That is **13 controls plus 5 words**, with **8 in the main flow and 5 behind Fine-tune**, and the preset shelf above them all.

A count of "11 controls, 3 behind Fine-tune" would cover only the settings carried over from today and leave out two things:
- **Band:** carried over from Angled band, but moved into Fine-tune.
- **Decoration:** new with the decor kit.

This spec uses the full count. The reduction is still 22 settings and 29 inputs down to 13 controls, where every colour is one swatch and not two inputs.

---

## Migration

**No data migration.** Every stored `ThemeSettings`, `BrandingAssets` and preset stays valid under the v2 schemas. All v2 fields are additive and optional: `decor`, `surface.texture: "bingoGrid"` and `text`.

**UI state is derived on load:**

1. **Base preset.**
   - The page compares the draft's `mode` and `colors.neutrals` with each known ramp, in this order:
     1. The standard look (`DEFAULT_THEME`)
     2. Prime Time dark
     3. Prime Time light
     4. Club Level light
     5. The gallery
     6. The tenant's own presets
   - Two ramps match when every key present in either is present in both with the same hex, compared case-insensitively.
   - The first match is the **base preset**. It drives the "In use" ring, Accent's Auto value, the ramp swap and Reset to preset.
   - If the draft has no `neutrals`, the base is the standard look for dark and Club Level for light.
2. **Font pairing.**
   - The stored type block is resolved first: `fontDisplay` and `fontBody` default to `satoshi`, `fontNumeric` to the body face, `displayTransform` to `none`, and `displayWeight` to 700 (`resolve.ts:229-231`, `:267-268`).
   - If all five resolved values exactly equal a pairing's five, that pairing is selected. Otherwise the selection is `custom`, and the Custom card shows the stored mix.
3. **Auto chips.** A colour is Auto when it is absent, or when the stored value equals the value Auto would produce:
   - **Second:** the resolver's derived Second.
   - **Accent:** the base preset's accent.
   - **Live:** the base preset's live, or `DEFAULT_LIVE[mode]`.
   - When a colour loads as Auto because it equals the derived value, the page leaves the stored value as it is. It is rewritten to absence only if the admin later chooses Reset to auto or a preset changes it.
4. **Custom neutrals note.** Shown when `colors.neutrals` exists and no known ramp matches.
   - A simpler rule ("any of ground, surface or textPrimary is set") is not usable. Every shipped preset and `DEFAULT_THEME` store all three (`presets.ts:39-47`, `:72-80`; `resolve.ts:379-387`), so that rule would flag every tenant who ever applied a preset.
5. **Decor.**
   - An absent `decor` block shows the defaults the fan app resolves (field `gridFragments`, band `single`, intensity 0.6, shown as Full).
   - An absent `surface.texture` shows None.

**Life for everyone (decision).** The fan app applies the decor defaults to **every tenant immediately**, including tenants who never opened Brand and tenants who never publish again. It does not wait for a republish.
- "The `decor` block is absent until the tenant publishes again" describes the stored document, not the look. The stored document stays absent until a publish, but the look changes on the day the v2 fan app ships.
- This is a sanctioned visual change for every tenant, and it is the point of the ruling: splash art and life app-wide.
- One stored value changes meaning. A tenant who chose "Angled band: Off" (`motif.heroMotif: "none"`, which Club Level also stores, `presets.ts:90`) gets a single band from the v2 fan app until they set Band to Off. That is one click in Fine-tune, and it writes both keys.
- The decor spec pins which fan build honours what. This spec states the Brand-side consequence.

**Presets:**
- Stored gallery rows and tenant presets are unchanged.
- The two shipped presets gain `decor`:
  - **Prime Time:** `gridFragments`, `double`, 0.7, texture `none`.
  - **Club Level:** `gridFragments`, `single`, 0.35.
- Prime Time gains its light ramp constant.
- `applyPreset` and `genericizeForGallery` copy `decor` (`presets.ts:133-140`, `:155-162` copy only `type`, `shape`, `surface` and `motif` today).
- A preset without `decor` applies with `decor` removed, so the fan app's defaults show. It does not keep the previous preset's decor.
- These are shared-repo changes, requested through the shared owner's queue.

**Schemas that must widen before the page ships:**
- `themeSettingsSchema` (`branding.ts:57-97`) strips unknown keys today, so a `decor` block sent early would be silently dropped. It widens along with `THEME_TEXTURES`, the Mongoose `themeSurfaceSchema` enum (`models/b2b.ts:139-143`), a new `themeDecorSchema`, and `brandingTextSchema`.
- The page's Publish is gated on the widened schemas being deployed, and an acceptance test pins it.

**Draft storage bump.**
- The draft lives in **`sessionStorage`**, not `localStorage` (`configDraftStorage.ts:4`, `:39`, `:59`). This spec follows the code.
- The key today is `obs-admin.config-draft.{userId}.{slug}:branding` (`configDraftStorage.ts:20-24`; `Branding.tsx:87`, `:239`). v2 uses the suffix `:branding-v2`, and the draft shape gains `text`.
- On load, if the old `:branding` key exists for this user and tenant, the page removes it and shows the notice once: "We refreshed the Brand page; your unpublished draft from before was cleared." with Dismiss. It doesn't show again, because the key is gone.
- The baseline check stays: a v2 draft replays only onto the branding it was written against (`Branding.tsx:248-258`), and the baseline now includes `text`.
- `clearAllStoredDrafts` already sweeps the whole prefix.

---

## Light and dark

**The draft's mode:** the segmented control (§4) sets `mode`, and that is the only way the draft's mode changes. The flash on cold load is G2's fix (`THEME-19`'s seed-then-server order and the dark-only bundled seed, research Q9). This page neither works around it nor re-specifies it.

**The Light/Dark peek toggle** in the preview controls previews the other mode **without changing the draft**.
- The page builds a peek theme by applying the §4 ramp-swap rule to a copy of the draft and sends that copy as `theme`.
- The toggle shows the draft's mode by default. When peeking, the toggle's selected side differs from the §4 control, and the preview controls add the text "Peeking at light" (or dark).
- The peek is not saved, not published and not remembered, and switching tenant or reloading ends it.
- Editing while peeking keeps the peek, and each edit re-renders the peeked copy.

---

## The preview

**Host:** Brand mounts S1's `FanAppPreview` (the console's single host, S1 design decisions §10) in the right column. Brand only chooses what to send.

**Screen switcher:** the screens the frame reports in `ready.screens`, in that order: Gate · Join · Home · Contest · Board · Prize, then Results and Paused when present. Brand opens on **Gate**, and the Words inputs jump the switcher (§6).

**The `render` document Brand sends:**
- `screen`: the switcher's value.
- `theme`: the draft theme, or `DEFAULT_THEME` when the draft theme is `null` (so the frame shows the look that would be in force, `Branding.tsx:285-292`), or the peek copy.
- `brand`: `{ name: branding.tenant.name, logoUrl: draft.assets.logo ?? null, text: draft.text }`, plus `markerUrl: draft.assets.sliderTipImageUrl ?? null` (a v1-additive field; see below).
- `device`: from the Phone/Desktop toggle.
- `sample`: `{ homeEmpty: true }` only while the No contests input is focused, so Home shows its empty state.
- No `contest`, `gate`, `sponsors` or other `sample` fields, so the frame's fixtures apply: the sample contest, the fixture gate and no sponsors.
  - The Brand preview is about the look. The real gate belongs to the Fields page's preview, and the real contest to the contest Preview tab.

**Sending:**
- `render` goes out on `ready` and on every draft change, debounced to about 100 ms (the interface file, 5.6; the figure is S1's to choose).
- `navigate` goes out when only the screen changes.

**Unavailable:** if the frame never reports `ready`, or reports `error`, the host shows its own plain state. S2's wording is "Preview unavailable" with Retry, and the console never rebuilds a likeness in its place (interface file §5.8). The controls keep working, and Publish is never blocked by the preview.

**Fonts:** the frame loads its own fonts from `FONT_CATALOG`. The console loads pairing fonts only for the Font cards and the preset thumbnails.

**What Brand relies on in the interface file** (all recorded there, section 4 and its change log):
- `CuratedTextKey` is exactly the five brand keys: `startTagline`, `startCta`, `homeEmpty`, `pausedHeading`, `pausedBody`. Gate keys travel in `gate.gateCopy`. There is no `contestsEmpty`, `boardTitle` or `prizeCta`: the board title is platform copy, and the prize button is the tier's own text.
- `brand.markerUrl?: string | null` carries the progress marker. It is optional, so it stays on `v: 1` (interface rule 4).
- `sample.homeEmpty?: boolean` asks for Home's empty state.
- Device: `device: 'phone' | 'desktop'`, from the Phone/Desktop toggle (interface file 5.3).

**Retirement:**
- `src/components/BrandPreviewPanel.tsx`, its `branding.css` sampler rules (`branding.css:337+`) and its fixtures (`BrandPreviewPanel.tsx:36-73`) are deleted with v2.
- The shared `EntryGatePreview` sampler is retired once the Fields page's `GatePreviewPanel.tsx` (its other user) also moves to the frame. That move belongs to S1 and G2. Brand stops importing it.
- `EntryGateForm` stays, because the fan app renders it (interface file §6).

---

## Endpoints and access

| Method | Path | Change | Auth |
|---|---|---|---|
| GET | `/admin/branding` | Response adds `text`; `theme` may carry `decor` | `requireAdmin` (any scope reads) |
| PUT | `/admin/branding` | Body and response add `text`; `changes.textEdited`; widened theme schema; new-URL `https` check on assets | `requireAdmin` + `refuseReadOnlyWrite` |
| PUT | `/admin/branding/presets` | None beyond the widened theme schema | same |
| POST | `/admin/branding/promote` | None; `genericizeForGallery` copies `decor` | `requireAdmin`, staff only |
| POST | `/admin/assets/uploads` | **New**: the upload presign | `requireAdmin` + `refuseReadOnlyWrite` |
| GET | `/b2b/org/:subdomain` | `branding.text` added to the projection | public |

- **Existing routes:** `routes/admin/index.ts:720-783`.
- **Handlers:** `handlers/admin/branding.ts:109-148` (put) and `:235-300` (promote).
- **Pure update:** `util/admin-branding.ts:73-122`.

**Unchanged:**
- Tenant targeting.
- The read-only refusal running first (`THEME-13`).
- No reverification anywhere, including the upload route, because every one of these writes is undone by doing it again (`THEME-14`).
- `clearOrgCache()` on every branding write (`THEME-15`, `handlers/admin/branding.ts:136`). The upload route doesn't touch the org, so it doesn't clear the cache.
- Route-auth test: `route-auth.test.ts:89-99` gains the upload route under the same expectations.

**Audit:**
- **Unchanged:** promotion is the only audited branding write (`THEME-10`, `handlers/admin/branding.ts:278`). Publishing a theme, words or images is ordinary tenant configuration and is not audited, by the same rule that leaves `PUT /admin/config` unaudited.
- **Upload presigns:** not audited. They are logged at info level with ids and sizes only (org id, purpose, size, content type) and never the file name.

---

## Rules

- **`BRAND2-01`: Presets first.** The preset shelf is the first section, and applying a preset keeps Team and Second (`THEME-08`) plus any overridden Accent or Live.
- **`BRAND2-02`: The palette is four colours.** Team is required. Second, Accent and Live are Auto until overridden, and Reset to auto returns them. No other colour is editable on the page.
- **`BRAND2-03`: Neutrals are preset-owned.** The page never offers a page, card or text colour. A stored custom ramp is honoured and shown with "Custom page colours from an earlier setup" and Reset to preset.
- **`BRAND2-04`: No native popups.** No `<input type="color">` and no `<select>` anywhere in the console after v2, enforced by a lint rule. The only operating-system dialog is the file chooser.
- **`BRAND2-05`: The picker is keyboard-complete.** Arrows step by 1 and Shift plus arrows by 10. Enter commits the hex, Esc closes and restores, focus is trapped while open, and focus returns to the swatch.
- **`BRAND2-06`: The hex is always visible.** On every swatch and in the picker. Auto is a text chip. No state is shown by colour alone.
- **`BRAND2-07`: The contrast readout uses the resolver's functions.** `onColor` and `contrastRatio` from `obs-b2b-shared/src/theme/color.ts`, never a console reimplementation (`THEME-03`).
- **`BRAND2-08`: One font choice.** A pairing writes all five `type` fields together. A stored mix that matches no pairing is preserved as the Custom card and never rewritten unless the admin picks a pairing.
- **`BRAND2-09`: Pairings are shared data.** `THEME_FONT_PAIRINGS` lives in `obs-b2b-shared` and uses only `THEME_FONT_IDS`.
- **`BRAND2-10`: Mode switches swap preset ramps.** A known ramp is swapped for the preset's ramp in the new mode, or removed when the preset has none. A custom ramp is left alone.
- **`BRAND2-11`: Thumbnails are swatches, not previews.** Static, built from the shared decor pieces, scoped variables, the tenant's Team colour, no data.
- **`BRAND2-12`: The real fan app is the only preview.** Brand sends `theme`, `brand` and `device` (and `sample.homeEmpty` while the No contests input is focused), and never a contest, gate, sponsor or invented data.
- **`BRAND2-13`: The peek never touches the draft.** The Light/Dark peek changes only what is sent to the frame.
- **`BRAND2-14`: Five brand strings, no more.** `startTagline`, `startCta`, `homeEmpty`, `pausedHeading`, `pausedBody`, with the limits above and only the `{team}` token. Every other fan string is platform copy. The seven gate strings stay in Fields & Opt-ins.
- **`BRAND2-15`: Blank means standard.** An empty string is never stored. An empty `text` object is `$unset`.
- **`BRAND2-16`: Words reach fans through the allowlist.** `text` is projected key by key on `GET /b2b/org/:subdomain` and served while suspended.
- **`BRAND2-17`: Images are uploads.** There are no URL fields on the page. Legacy stored URLs are honoured and survive a republish unchanged, and a new value must be `https:`.
- **`BRAND2-18`: Upload limits hold at storage.** PNG, SVG or WebP up to 1 MB, enforced by a presigned POST policy. SVG is rendered only through `<img>` and served sandboxed.
- **`BRAND2-19`: Fine-tune maps to the contract exactly.** Decoration to `decor.intensity` (0 / 0.35 / 0.7). Band to `decor.band`, mirrored into `motif.heroMotif`. Texture to `surface.texture`. Corners to `shape.radiusBase`. Glow to `surface.glowIntensity`.
- **`BRAND2-20`: No data migration.** Every stored v2 theme stays valid, and UI state is derived on load.
- **`BRAND2-21`: Life for everyone.** The fan app applies decor defaults to every tenant on the day it ships, with no republish needed.
- **`BRAND2-22`: Stale v1 drafts are discarded once, with a notice.** The draft key suffix is `:branding-v2`.
- **`BRAND2-23`: The schemas widen first.** `decor`, `bingoGrid` and `text` must be accepted by zod and Mongoose before the page can publish them. Nothing is silently stripped.
- **`BRAND2-24`: Access is unchanged.** `org:admin` and staff write, `org:member` reads, promote is staff only, nothing is reverified, and only promotion is audited.
- **`BRAND2-25`: No gap narration on the page.** The page never explains what it can't do. Unreadable logo colours and unavailable screens are omitted silently and recorded here (D-068).

---

## Acceptance criteria

1. **Order:** on `/branding` the sections appear in this order: Presets, Colours, Font, Light or dark, Logo and marker, Words, Fine-tune (collapsed). The footer holds Use the standard look, Discard draft and Publish.
2. **No native inputs:** searching the built console for `type="color"` and `<select` finds nothing, and the lint rule fails a test fixture containing either.
3. **Picker, keyboard only:** open Team with Enter, press Shift+Right three times (saturation +30), press Tab to reach the hue strip and Left five times (hue −5), type `0B162A` in the hex field and press Enter, then press Esc.
   - The swatch shows the colour it had before opening.
   - Focus is on the Team swatch.
   - Tab never left the picker while it was open.
4. **Picker commit:** repeating step 3 but ending with Done leaves the swatch at `#0B162A` and the preview frame shows it within 100 ms of the last change (debounce, with the frame's paint time excluded).
5. **Contrast readout:** Team `#0B162A` reads "Text on Team: white, 18.1:1" (computed by `contrastRatio`). A mid grey below 4.5 shows the "(below the 4.5:1 reading standard)" suffix.
6. **Auto:**
   - A tenant with no `secondary` shows Second as Auto with the resolver's derived hex.
   - Overriding Second and choosing Reset to auto publishes a body with no `colors.secondary`.
7. **Presets keep the palette:** applying Club Level to a Prime Time tenant with Team `#0B162A`, Second `#C83803` and an overridden Accent `#FFB224` keeps all three. (Not `#F5B32E`: that is Prime Time's own accent, so it loads as Auto.) Live, which was Auto, becomes Club Level's.
8. **Mode swap:** a Prime Time tenant switching to Light gets the Prime Time light ramp (ground `#F6F7FA`). Switching a tenant with a custom ground leaves the ground unchanged and keeps the note.
9. **Custom neutrals note:** a Prime Time tenant shows no note. A tenant with `neutrals.ground: "#123456"` and nothing else shows it, and Reset to preset replaces the ramp.
10. **Font:**
    - A tenant storing Barlow Condensed, Barlow, Plex Mono, uppercase, 600 loads with Broadcast selected.
    - A tenant storing Archivo display and Satoshi body loads with Custom selected.
    - Picking Modern and then Custom restores Archivo and Satoshi.
11. **Words:**
    - Typing `{name}` in the tagline shows "Only {team} can be used here." and disables Publish.
    - Publishing a blank tagline stores no `startTagline`.
    - `GET /b2b/org/:subdomain` returns `branding.text` with exactly the stored keys, including for a suspended tenant.
12. **Words limits:** `PUT /admin/branding` with a 61-character `startTagline` is a 400, and with an unknown key the key is stripped.
13. **Upload:**
    - A 1.2 MB PNG is refused in the tile before upload.
    - A request for a presign with `size: 2000000` is a 400.
    - A direct POST to the presigned policy with a larger file is refused by storage.
    - An SVG containing `<script>` is rejected and shows "Use a PNG, SVG or WebP file."
14. **Legacy image:** a tenant with `assets.logo: "/logos/bears.png"` republishes a colour change, and the stored logo is byte-identical.
15. **Draft bump:**
    - With a v1 draft present under `:branding`, opening the page shows the refreshed notice once and removes the key.
    - Reloading doesn't show it again.
    - A v2 draft restores with "Restored your unsaved changes."
16. **Schemas:** a `PUT /admin/branding` carrying `decor` and `surface.texture: "bingoGrid"` round-trips unchanged through GET.
17. **Fine-tune mapping:** Decoration Subtle writes `decor.intensity: 0.35`. Band Off writes `decor.band: "none"` and `motif.heroMotif: "none"`. Band Double writes `double` and `angledBand`.
18. **Peek:** toggling the peek to Light while the draft is dark sends a light theme to the frame, leaves the draft `mode` as `dark`, and leaves Publish disabled on a clean draft.
19. **Unavailable preview:** with the fan origin unreachable, the preview shows the host's unavailable state, every control still edits, and Publish works.
20. **Read-only:** an `org:member` sees every control disabled, the read-only line in place of the footer, and a working preview.
21. **Narrow and phone:**
    - At 900px the preview is a collapsed bar under the head.
    - At 390px the swatches are 2×2 and the picker opens as a bottom sheet.
    - Dragging on the square does not scroll the page.
    - No element is narrower than 44px in its tap dimension.
22. **Retirement:** `BrandPreviewPanel.tsx` no longer exists, and nothing under `src/pages/Branding*` imports `EntryGatePreview`.

---

## Open questions

1. **Does the upload route ship with Brand v2 or before it?** Recommendation: with it, in the same build slice, since it's small and Brand is its first user. The Sponsors page adopts it when S1's "upload later" comes due. If the route slips, the Images section keeps its two v1 URL fields until the route lands. That is a build-order fallback, not the design.
2. **The default theme's Second after the resolver change.** The auto Second in [`fan-decor-system.spec.md`](fan-decor-system.spec.md) (Team shifted 18° in hue, darkened 12% in dark mode or lightened 10% in light mode) replaces today's "Second falls back to Team" (`resolve.ts:219-222`). Legacy tenants store `secondary` explicitly, so `THEME-20`'s parity test holds for them. The unbranded default, though, changes `--secondary` from `#E5E5E5` to a darker grey. Arthur to confirm that this is a sanctioned delta the parity test should record, or that the default theme should store `secondary: "#e5e5e5"` to stay byte-identical. The decor spec owns the resolver change. Brand only displays the result.

---

## Recorded gaps (recorded, not blocking, never on screen)

- **Logo colours need a readable logo.** A legacy logo hosted without CORS taints the canvas, and "From your logo" is omitted for it. Re-uploading through the tile fixes it.
- **Orphaned uploads.** An image uploaded and never published stays in storage. A sweep of objects no org references is a later infra task.
- **Accent Auto depends on a matched base.** A tenant whose ramp matches no preset has no preset accent, so Accent's Auto falls back to absence, which the resolver resolves to Second (`resolve.ts:222`).
- **Club Level has no dark ramp.** Switching Club Level to Dark falls back to the resolver's platform dark ramp. A designed dark Club Level would be a new preset constant.
- **Spacing (`shape.density`) has no reader.** It stays stored and unedited, as it was.
- **Publishing is still last-write-wins between two admins**, as everywhere in the console.

---

## What happens to the `THEME-nn` rules

| Rule | Status |
|---|---|
| `THEME-03` to `THEME-06` (pure data, font allowlist, status colours, border override) | **In force.** v2 adds no derived field and no font. |
| `THEME-07` (directions are preset JSON, zero code) | **In force**, extended: `decor` must also be expressible in preset JSON. |
| `THEME-08` (apply keeps primary and secondary) | **In force.** v2 adds the page-level carry of an overridden Accent and Live (`BRAND2-01`). |
| `THEME-09`, `THEME-10` (private presets; audited, genericizing promotion) | **In force.** Promotion also copies `decor`. |
| `THEME-11`, `THEME-12` (storage) | **In force.** `branding.text` follows `THEME-11`. |
| `THEME-13` to `THEME-15` (access, no reverification, cache clear) | **In force**, and they cover the upload route. |
| `THEME-16` to `THEME-18` (fan wire) | **In force.** `text` joins the allowlist. |
| `THEME-19`, `THEME-20` (seeds, parity) | **In force.** The light flash is G2's (see open question 2 on parity). |
| `THEME-21` (the preview renders shared components in `.obs-gate-preview` with a sampler) | **Superseded** by `BRAND2-12` and "The preview". |
| `THEME-22`, `THEME-23` (stat fraction honesty, reduced motion) | **In force.** They are fan-side and unaffected. |
| Old Rules list item 12 (the preview renders the fan product's code and captions nothing) | **Superseded** by `BRAND2-12` and `BRAND2-25`. The persistent Preview marker is a label the interface requires, not a caption about gaps. |
| Old "The screen" prose, including the group names Look, Colors, Type, Shape, Finish, Signature and Assets | **Superseded** by this spec's screen. |
| Old out-of-scope line and recorded gap "no full board preview in the console" | **Superseded.** The preview is the real fan app, including the board. |

---

## References

- WAVE-RULES 2026-09-24: "Brand gets simpler", "Colour hues", "Fields & Opt-ins".
- `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md`: the frame, messages, render document, fixtures and retirement.
- [`fan-app-v2-build-plan.md`](../../../documents/HLDs/fan-app-v2-build-plan.md): slice f5 builds this page and the upload route.
- `artifacts\review-2026-09-24\admin-wide.md` Q9 (the 22 settings) and `prizes-sponsors.md` Q5 (no upload).
- Console:
  - `obs-b2b-admin-frontend/src/pages/Branding.tsx`, especially `ColorRow` `:1029-1097` (native input at `:1071-1078`), the presets card `:830-958`, draft and publish `:239-398`, and apply `:472-479`.
  - `src/components/BrandPreviewPanel.tsx`
  - `src/lib/themeFonts.ts`
  - `src/lib/configDraftStorage.ts`
  - `src/components/sponsors/SponsorDrawer.tsx:497-557`
- Shared:
  - `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts`: `GateCopyOverrides` `:147-155`, `THEME_FONT_IDS` `:224-235`, `ThemeSettings` `:294-339`, `BrandingAssets` `:350-359`, `THEME_PRESET_CAP` `:394`.
  - `src/theme/presets.ts`, `resolve.ts`, `color.ts`, `fonts.ts`
  - `src/api/admin/branding.ts`, `src/api/b2b/org.ts`, `src/api/b2b/membership.ts:72-80`, `src/models/b2b.ts:103-194`
  - `src/entry-gate/copy.ts`
- Backend:
  - `overboard_sports_backend/node-server/src/routes/admin/index.ts:720-783`
  - `handlers/admin/branding.ts`
  - `util/admin-branding.ts`
  - `handlers/org/getOrganization.ts`
  - `routes/__tests__/route-auth.test.ts:89-99`
- Specs:
  - [`admin-branding.spec.md`](admin-branding.spec.md)
  - [`fan-decor-system.spec.md`](fan-decor-system.spec.md)
  - [`fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md), [`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md)
  - [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md)
  - [`admin-sponsors.spec.md`](admin-sponsors.spec.md) (recorded gap "No image upload")
  - [`admin-surface.spec.md`](admin-surface.spec.md) (Rule 12, superseded through the interface file)
- Mock: `overboard-b2b-workspace\mocks\fanapp-v2\brand-v2.html`.
