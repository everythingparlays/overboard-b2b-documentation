# Core Module Spec: Fan Decor Kit — palette, tokens, type, decoration and shell (Wave 5)

**Implements:** Arthur's 2026-09-27 rulings, "Fan app overhaul" (Satoshi only; desktop is the mobile column centred with tenant-coloured decorative sides; confetti kept inside the phone area in tenant colours; real player photos behind squares, never initials; no "peeking" text) and "Priorities" (Satoshi is the font everywhere, B2B and B2C, Prime Time included); the standing rule "function over mocks" (2026-09-28). Director's decisions W5-D01 to W5-D75, all binding (chiefly W5-D03, W5-D11, W5-D21, W5-D25, W5-D26, W5-D43, W5-D65, and the console-redesign rulings W5-D68 to W5-D71, W5-D74, W5-D75; `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` and `briefs\w5-phaseB-deltas.md`, workspace), the Phase A review rulings (`artifacts\wave-2026-09-27\briefs\w5-review-rulings.md`, workspace), and Arthur's walk #3 rulings (`artifacts\review-2026-09-27\arthur-rulings-console-final-walk.md`, workspace). The facts under the redesign are in `artifacts\w5\redesign-delta.md` (workspace).

**Depends on:** the console redesign, branch `arthur-console-redesign` (heads shared `41b9c7d`, backend `96d40c9`, admin `1385b3e`, fan app `9c1af32`, docs `79908f2`), which already contains Wave 4 and the Wave 4b fix pass: [`admin-branding.spec.md`](admin-branding.spec.md) ("Revised 2026-09-29 (Walk #3): the four-colour model": `ThemeSettings.colors = { main, accent, text, buttonText? }`, `normalizeTheme`, the seeds), shared `theme/resolve.ts` (`resolveTheme`, `contrastSafeHit(accent, against[], min)`, `autoButtonText`, `DEFAULT_THEME`), `theme/color.ts` (`toOklch`, `fromOklch`, `withLightness`, `apcaContrast`), `theme/seeds.ts` (`TENANT_SEED_THEMES`), `scoring/bingo-lines.ts` (`completedLines`, `boardBingos`), `interfaces/b2b/ProgressMarker.ts`. On main: [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §4 (Wave 3's contrast-guarded hit colour) and §7 (Satoshi self-hosted). Siblings on this branch: [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md) (writes the decor params), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md) and [`../../webapp/fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md) (the screens that place the kit), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).

**Supersedes:** S2's draft of this spec (docs branch `arthur-s2-fanapp-spec`, PR #23): the twelve-piece kit in `obs-b2b-shared/src/ui/decor/`, the `decor { field, band, intensity }` contract block, the font pairings, auto Accent, per-preset light and dark ramps with `withMode`, and Club Level. For the Wave 5 branch only, three points of the vault chart `b2b\charts\design.md` (listed under "Supersessions", for the vault wrap).

**Status:** Draft, 2026-09-28, Wave 5 Phase A; **revised 2026-09-29 for the console redesign** (W5-D68–D75). The kit was built in Phase A in the fan app (`overboard-b2b-template`, branch `arthur-fanapp-overhaul`, rebased onto the redesign; worktree `.worktrees\template-w5`) as additive files that no existing screen mounts. Phase B moves the screens onto it. Wave 5 is never merged to main (W5-D29).

### Revised 2026-09-29: the kit on the redesign

- **The palette is the redesign's theme** (W5-D68): Main, Accent, Text and Button text from `ThemeSettings.colors`, read through `normalizeTheme`. No mode, no presets, no stored `palette?` shape, no Second or Live input.
- **The band is derived** (W5-D69): `band = isChromatic(main) ? main : deepen(accent)`; the `--k-main*` tokens come from the band, the hit is Accent-ink (`DECOR-43`).
- **The ramp follows Main's scheme** (W5-D70): `resolveTheme().ground.colorScheme` picks dark or light; the gallery's mode toggle becomes a scheme readout (`DECOR-44`).
- **Prime Time's values are the Fine-tune defaults** (W5-D71); `ThemeSettings.decor { intensity?, angle?, texture? }` stores the tenant's own (`DECOR-38`).
- **The kit stays in the fan app.** Nothing moves to shared (`DECOR-40` withdrawn): the console needs no kit code once presets are gone and Brand uses the redesign's own colour inputs.
- **The kit first-aid** (s1's first commit) makes the rebased kit compile again: listed under "Where the kit lives".

## Overview

The overhauled fan app needs one visual system that turns a tenant's four stored colours into every colour a screen uses, keeps every text and signal readable whatever the tenant picks, sets one typeface at one scale, and supplies the decorative pieces (splash field, hero band, broadcast tags, scorebug, prize track, burst, bingo line, confetti) plus the shell every screen sits in.

**The whole change, in one line:** a pure palette resolver emits `--k-*` tokens onto the shell's own root, and a small set of CSS-and-SVG components paint only from those tokens, so a tenant's look is its four colours plus three decor params, and nothing on screen can end up unreadable.

**In scope:**
- The palette as the redesign stores it, the derived band, and the resolver that derives the token set, with its contrast guards.
- The token list, the two scheme ramps, the decor params and their Prime Time defaults.
- The type scale (Satoshi only).
- The decoration components and the board square.
- The shell: `KitShell`, `TopBar`, `TabBar`, `useChromeVisibility` (hide-on-scroll).
- Where the kit lives.
- How the stored `ThemeSettings` maps onto the kit with no data migration.

**Not in scope:**
- Screen layouts and copy ([`fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md)).
- The Brand page that edits the colours ([`admin-brand-v2.spec.md`](admin-brand-v2.spec.md)).
- The console's own look.
- Raster artwork. The only images the kit renders are data: player photos, team logos, the tenant logo and marker, sponsor artwork, prize images.

---

## Principles

**Function over mocks.** `mocks\fanapp-v2\` is visual direction. Where a mock technique and a working, readable result disagree, the result wins and the deviation is in the function audit below.

**Colour only from tokens.** A kit component reads colour only from `--k-*` variables. No hex, `rgb()` literal, named colour or Tailwind colour class appears in `src/kit/decor/` or `src/kit/shell/`. The only hex values in the kit are in `src/kit/palette/` (ramps, fixed live tones, test fixtures).

**Readable by construction.** Every ink the resolver emits is measured against what it sits on and lifted until it passes. A tenant cannot pick colours that produce invisible text, an invisible hit, or an invisible band edge. The guards are code with tests, not review. The one exception is Button text, which follows the redesign's rule (W5-D68, `DECOR-42`).

**Decoration fades; information never does.** `--k-intensity` scales the field pieces (DecorField, Burst, GridTexture, glows). Pieces that carry state, progress or structure (HeroBand, Chyron, Scorebug, Track, Medal, Brackets, BingoLine, Square) always render at full strength.

**State-driven motion.** Things move because something changed: a line completed, a square hit, a prize arrived, the fan scrolled, a sheet opened, the fan entered rearrange mode. Nothing loops for decoration. Under `prefers-reduced-motion: reduce` every animation shows its end state.

---

## Where the kit lives

**`DECOR-25` — The fan app, additive, isolated.** Everything is under `overboard-b2b-template/src/kit/` on `arthur-fanapp-overhaul`:

| Folder | Contents |
|---|---|
| `src/kit/palette/` | `types.ts` (`TenantPalette`, `Scheme`, `KitTokens`, `DecorParams`), the ramps `DARK_RAMP` and `LIGHT_RAMP`, `color.ts` (hex ↔ sRGB ↔ HSL, WCAG luminance and contrast, `mix`, `shiftHue`, `lift`, `onColor`), `resolve.ts` (`resolvePalette`), `cssVars.ts` (`tokensToCssVars`, `applyKitVars`), `presets.ts` (`PRIME_TIME` as the default decor params, and the gallery's seeds), `fromTheme.ts` (`paletteFromTheme`, Phase B) |
| `src/kit/type.css` | The type scale classes and `--k-fs-*` tokens |
| `src/kit/decor/` | One file per component plus `decor.css` |
| `src/kit/shell/` | `KitShell`, `TopBar`, `TabBar`, `useChromeVisibility`, `chromeReducer` |
| `src/kit/gallery/` | The `/kit` gallery entry (below) |
| `src/kit/**/__tests__/` | Vitest tests |

- **Every variable is prefixed `--k-`**, so nothing collides with the current app's `--primary`, `--team-soft`, `--hit` and the rest of `themeToCssVars`' slots.
- **`KitShell` applies the variables to its own root element, never to `:root`.** No existing screen can pick them up by accident.
- **The only edit outside `src/kit/`** is the three-way branch in `src/main.tsx` (`/preview`, `/kit`, live), already resolved on the rebased branch.

**The kit first-aid (Phase B, s1's first commit; the rebased kit does not compile until it lands):**
1. `src/kit/palette/resolve.ts:204` calls the old `contrastSafeHit(candidates[], against, min)`. The redesign's signature is `contrastSafeHit(accent, against[], min)`: the hit becomes `contrastSafeHit(accent, [surface], HIT_MIN_CONTRAST)` (`DECOR-43`), or the kit's own `lift` if the shared one's candidate walk doesn't fit.
2. `paletteFromTheme(theme)` in `src/kit/palette/fromTheme.ts` (below). It did not exist in Phase A.
3. The rename `--k-team*` → `--k-main*` (`--k-main`, `--k-main-ink`, `--k-main-text`, `--k-on-main`, `--k-main-soft`, `--k-main-glow`), with the `KitTokens` fields `team*` → `main*`, all fed from the derived band (W5-D65, W5-D69).
4. `TenantPalette` becomes `{ main, accent, text, buttonText? }`; `Mode` becomes `Scheme`, read from Main (`DECOR-44`); `second` and `live` leave the inputs.
5. The gallery's seeds become `bears`, `fightinghawks` and `test` from the redesign's `TENANT_SEED_THEMES` (test = `DEFAULT_THEME`), plus the bad case; the mode toggle becomes a scheme readout with a demo override.
6. No `dark:` object keys anywhere in the kit: the redesign's `src/theme/__tests__/fallback.test.ts` ("no light or dark mode") scans for `/\bdark:/` and flags `resolve.ts`'s per-mode tables (`dark: { ink: 5.5, … }`, `AUTO_LIVE`). The ramps become `DARK_RAMP` and `LIGHT_RAMP`, and per-scheme values are looked up through them, so the redesign's test passes unchanged (`artifacts\w5\setup.md`, baselines).

**`DECOR-40` — withdrawn 2026-09-29.** Phase A planned to move the pure palette half to `obs-b2b-shared/src/theme/kit/` and lift `DecorField`, `HeroBand`, `Chyron` and `Square` to `ui/kit/` for Brand v2's preset thumbnails and contrast readout (W5-D48). With presets gone (W5-D71) and Brand using the redesign's own picker, readout and highlight line (W5-D68), the console needs no kit code, so nothing moves. The kit stays wholly in the fan app.

**Shared colour maths is reused where it fits.** The hit rule is the redesign's `contrastSafeHit` (`HIT_MIN_CONTRAST = 3`, `obs-b2b-shared/src/theme/resolve.ts`); the band's `deepen` uses shared `toOklch`/`withLightness`/`fromOklch` (`theme/color.ts`); Button text is `resolveTheme(theme).colors.buttonText`. The kit imports them; it never mirrors them.

---

## The palette

**`DECOR-26` — Four stored colours, the redesign's contract** (W5-D68). The kit reads what Brand stores and the fan app already receives on `GET /b2b/org/:subdomain` as `organization.branding.theme`: `ThemeSettings.colors`, always the four-colour shape because every reader goes through `normalizeTheme`.

```ts
// src/kit/palette/types.ts (Phase B, kit first-aid)
export interface TenantPalette {
  main: string;        // ThemeColors.main, #RRGGBB: picks the scheme; the band when it has colour (DECOR-43)
  accent: string;      // ThemeColors.accent: buttons, hits, the band when Main has no colour
  text: string;        // ThemeColors.text: always set (White or Black in Brand)
  buttonText?: string; // ThemeColors.buttonText: absent means auto (APCA)
}
export type Scheme = "dark" | "light"; // resolveTheme(theme).ground.colorScheme (DECOR-44)
```

| Role | Stored | Value | Drives |
|---|---|---|---|
| **Main** | yes (`colors.main`) | as stored | The scheme (dark or light ramp, `DECOR-44`); the band when chromatic (`DECOR-43`) |
| **Band** | no (derived, W5-D69) | `isChromatic(main) ? main : deepen(accent)` | The "team block": hero band fill, pressed chips, the active tab, Medal 1, podium 1, the no-photo wash start, BingoLine core, Track fill start; all `--k-main*` tokens |
| **Accent** | yes (`colors.accent`) | as stored | Primary buttons (text in Button text), band hairline, accent chyrons ("Go Crazy", next tier), the hit (`--k-hit` = Accent-ink), Burst rays, confetti, Scorebug underline, Brackets, Track fill end, Medal 3 |
| **Text** | yes (`colors.text`) | as stored, guarded (`DECOR-41`) | All primary text |
| **Button text** | optional (`colors.buttonText`) | as stored, else `autoButtonText(accent)` (`DECOR-42`) | Text and icons on Accent fills |
| **Second** | no (derived) | the band with hue +18°, lightness moved away from the ground (`DECOR-03`) | Double band's under-band, Stripes bar 2, DecorField strokes, GridTexture, Medal 2, the no-photo wash end |
| **Live** | no (fixed) | the scheme's live tone: dark `#FF3B5C` (the shared `DEFAULT_LIVE`), light `#B3364B` | The LIVE chyron and its dot only (`DECOR-05`) |

- **`DECOR-43` — The band role is derived, not Main blindly** (W5-D69). Wave 5 keeps the neutral broadcast ground (W5-D65). On the redesign the seeds put the tenant's background in Main (Hawks `#000000`, Bears navy) and the team hue in Accent, so Main-as-band would draw black Hawks bands. The rule:
  - `isChromatic(c)` = OKLCH chroma ≥ **0.03** (`BAND_MIN_CHROMA`, one named constant; the director's correction of 2026-09-29: W5-D69 as first written said 0.06, which would miss the Bears navy at 0.043);
  - `deepen(c)` = the same hue at OKLCH lightness **0.35** (inside the ruled 0.32–0.38), chroma kept as far as sRGB allows (`withLightness` then `fromOklch`'s gamut clamp);
  - `band = isChromatic(main) ? main : deepen(accent)`; every `--k-main*` token is computed from `band`; `--k-accent*` from Accent; `--k-hit` = Accent-ink.
  - The ruling's examples: **Bears → navy bands, orange hits; Fighting Hawks → deep-green bands, bright-green hits.** The gallery shows both seeds side by side (acceptance 3).

  | Seed (`TENANT_SEED_THEMES`) | Main | Main's OKLCH chroma | Band | Accent | Hit |
  |---|---|---|---|---|---|
  | `bears` | `#0B162A` | 0.043 | Main: navy | `#E64100` | orange Accent-ink |
  | `fightinghawks` | `#000000` | 0 | `deepen(#009A44)`, a deep green (L 0.35, hue ≈150) | `#009A44` | bright-green Accent-ink |
  | `test` (no seed: `DEFAULT_THEME`) | `#0A0A0A` | 0 | `deepen(#E5E5E5)`, a neutral dark grey | `#E5E5E5` | light-grey Accent-ink |

- **`DECOR-03` — Second is derived, never stored, never tenant-facing.** The derivation is the band's hue +18°, same saturation, lightness moved **away from the ground** (W5-D42): lighter than the band on the dark scheme, darker on the light one. `second-ink` is lifted to 3:1 on the ground like every other ink. The redesign stores no `colors.secondary` (its `normalizeTheme` drops the old field), so nothing overrides it.
- **`DECOR-41` — Text** (walk #3; W5-D66, W5-D68). Text is always stored; Brand offers White and Black (the redesign's `InkRow`). The kit guards it to ≥4.5:1 on both `--k-ground` and `--k-surface`: when the stored Text fails either (black on the dark scheme, say), the scheme ramp's own `--k-text` applies. `--k-text-2` and `--k-text-3` stay the ramp's. It never changes the ground.
- **`DECOR-42` — Button text is the redesign's** (W5-D68). `--k-on-accent` = `resolveTheme(theme).colors.buttonText`: a stored Button text is used as given (the tenant's word, no kit guard); absent, it is `autoButtonText(accent)`, APCA white or black. `--k-on-hit` measures against the hit shade on auto, as the redesign does.
- **`DECOR-05` — Live is never decorative.** `--k-live` appears only in the `live` Chyron, its dot and the live square state. Tenants never set it.
- **Validation.** `resolvePalette` throws a typed `PaletteError` on a missing or malformed Main, Accent or Text (`#RRGGBB`, case-insensitive). The fan app never hands it a raw stored theme: `paletteFromTheme` reads a normalized one.

### From the stored theme (no data migration)

**`paletteFromTheme(theme)`** (`src/kit/palette/fromTheme.ts`, **Phase B: to build**, s1 kit first-aid) is a pure load-time function over the theme the fan app already resolves (`TenantContext`: the org read's `branding.theme`, else `theme/seed.ts`, the tenant's seed, else `DEFAULT_THEME`):

| Kit | Read from | When absent |
|---|---|---|
| `main`, `accent`, `text` | `theme.colors.main`, `.accent`, `.text` | never absent: `normalizeTheme` returns the four-colour shape or nothing, and nothing falls back to the seed, then `DEFAULT_THEME` (`#0A0A0A` / `#E5E5E5` / `#FFFFFF`) |
| `buttonText` | `theme.colors.buttonText` | auto (`autoButtonText(accent)`) |
| scheme | `resolveTheme(theme).ground.colorScheme` | — (always derived) |
| decor params | `resolveDecor(theme.decor)` (s0, `DECOR-38`) | Prime Time's values |
| radius | `theme.shape.radiusBase` (parked; no Brand control) | 8 |

**`DECOR-39` — Load-time derivation only.** No stored theme is rewritten. A theme stored in the older shape (`mode` plus `primary`/`secondary`/`accent`/`live`) is read through the redesign's `normalizeTheme` (`colorsFromLegacy`), so the kit never sees it. The parked blocks the redesign keeps on `ThemeSettings` (`type`, `shape`, `surface`, `motif`) are not read by the overhaul, except `shape.radiusBase`.

---

## Tokens

**`DECOR-27` — `resolvePalette(palette, scheme, decor?) => KitTokens` is the only thing that computes a kit colour.** Pure, deterministic, no DOM. `tokensToCssVars(tokens, decor)` turns the result into `--k-*` variables; `applyKitVars(el, vars)` sets them on one element and removes stale ones.

### Scheme ramps

**`DECOR-23` (revised) — The ramps are platform-owned, one per scheme, and the scheme comes from Main** (W5-D70). They are not tenant-editable and there is no mode setting anywhere. **`DECOR-44` — Scheme from Main:** the kit's ramp selector is `Scheme` (`"dark" | "light"`), never a `Mode` input; `resolveTheme(theme).ground.colorScheme` (dark when white contrasts more with Main than black does) gives it, and it picks `DARK_RAMP` or `LIGHT_RAMP`. The three seeds are all dark; a light Main (a pale team colour) gets the light ramp. Values as specified for Phase A:

| Token | Dark | Light |
|---|---|---|
| `--k-ground` | `#0A0D14` | `#F6F7FA` |
| `--k-surface` | `#121722` | `#FFFFFF` |
| `--k-raised` | `#1A2130` | `#EEF1F6` |
| `--k-text` | the tenant's Text when it passes (`DECOR-41`), else `#F2F4F8` | the tenant's Text when it passes, else `#12161F` |
| `--k-text-2` | `#B7BECC` | `#4E5A6E` |
| `--k-text-3` | `#7F8798` | `#7A8599` |
| `--k-hairline`, `--k-hairline-strong` | `rgb(158 178 208 / .16)`, `/ .30` | `rgb(31 42 61 / .12)`, `/ .24` |
| `--k-a-stroke`, `--k-a-fill`, `--k-a-glow`, `--k-soft-pct` | `.22`, `.10`, `.34`, `14%` | `.16`, `.07`, `.16`, `12%` |
| `--k-scrim`, `--k-shade` | `rgb(4 6 10 / .74)`, `rgb(0 0 0 / .35)` | `rgb(18 22 31 / .52)`, `rgb(18 22 31 / .08)` |

Dark text values are the kit brief's; the light ramp, hairlines, alphas, scrims and shades are `mocks\fanapp-v2\kit.css` lines 65–89.

The dark `--k-text-2` and `--k-text-3` are lighter than the mock's `#9FADC2` / `#66738A`, because the mock's third step measures 4.1:1 on the ground. **`DECOR-17` — Kit text meets 4.5:1** on what it sits on; `--k-text-3` is for non-text hairline labels and disabled states only, never for a line a fan must read. The resolver's tests are the source of truth for exact values.

### Derived roles

| Token | Rule |
|---|---|
| `--k-main` | The band (`DECOR-43`): block fills (hero band, pressed chips, active tab segment, Medal 1) |
| `--k-main-ink` | `lift(band, ground, 3.0)`: the band moved in lightness, hue kept, until it clears 3:1 on the ground (lines, icons, borders on the ground) |
| `--k-main-text` | `lift(band, ground, 4.5)` (band-coloured text on the ground) |
| `--k-on-main` | `onColor(band)`: near-black `#0A0D14` or white, whichever contrasts more (text on a band block) |
| `--k-accent`, `--k-accent-ink`, `--k-accent-text` | Accent raw; lifted to 3:1 and 4.5:1 on the ground |
| `--k-on-accent` | Button text (`DECOR-42`): stored, else APCA auto |
| `--k-second`, `--k-second-ink`, `--k-on-second` | The same rules for the derived Second |
| `--k-live`, `--k-on-live` | The scheme's live tone and its on-colour |
| `--k-hit`, `--k-on-hit` | Accent-ink (W5-D69): `contrastSafeHit(accent, [surface], 3)`, the redesign's rule, so a hit always clears 3:1 on `--k-surface`; `--k-on-hit` as the redesign measures it |
| `--k-main-soft`, `--k-accent-soft` | The colour at `--k-soft-pct` over the ground |
| `--k-main-glow`, `--k-glow-ring` | Main-ink at `--k-a-glow`; the focus ring |
| `--k-success`, `--k-on-success` | Platform-owned per scheme (`THEME-05` kept): dark `#3CCB7F`, light `#1E8A4F` |
| `--k-radius-card`, `--k-radius-control`, `--k-radius-chip`, `--k-radius-tag` | From the decor params (below) |
| `--k-intensity`, `--k-angle` | From the decor params |

**`DECOR-28` — Contrast guarding is code with tests.** For the gallery's four palettes (the `bears` and `fightinghawks` seeds, `test` on `DEFAULT_THEME`, and the bad case where Main is near the ground and Accent near white) on the scheme each selects, and on the other scheme through the gallery's demo override, every guarded token meets its ratio: `main-ink`, `accent-ink`, `second-ink` ≥ 3:1 on ground; `main-text`, `accent-text` ≥ 4.5:1 on ground; `on-main` and `on-second` ≥ 4.5:1 on their fill where the colour allows (the on-colour rule guarantees at least 4.36:1 for any colour, at the luminance where both inks tie); `hit` ≥ 3:1 on surface; Text ≥ 4.5:1 on ground and surface. `on-accent` is the redesign's rule and is not re-guarded. Regression tests with a tolerance (ΔL ≤ 8) pin the seeds' bands: Bears `--k-main` is its navy Main, with `main-ink` near `#5B8BE0` and `main-text` near `#8FB0EC` on the dark ramp (the Phase A values) and an orange hit; Fighting Hawks `--k-main` at OKLCH L 0.32–0.38, hue within 10° of `#009A44`'s, and its hit a bright green.

---

## Decor params and their Prime Time defaults

```ts
export interface DecorParams {
  intensity: number;              // 0–1, default 0.7
  angle: number;                  // degrees, default -5
  texture: "none" | "bingoGrid";  // default "none"
  radius: { card: number; control: number; chip: number; tag: number };
}
```

**`DECOR-37` (revised) — No presets; Prime Time's values are the defaults** (W5-D71). `PRIME_TIME` = intensity 0.7, angle −5°, texture none, radius 10 / 8 / 3 / 2 (card / control / chip / tag). It is what every tenant renders until Brand's Fine-tune stores something else. It carries no colour: Accent is always stored (the four-colour contract), so Prime Time's old gold default accent is gone. Club Level is gone (W5-D53 withdrawn).

**`DECOR-38` (revised) — Where the params are stored.** Additive and optional; **built by s0** on shared `arthur-fanapp-overhaul` (`7b05572`, `theme/decor.ts`):

```ts
// obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts, on ThemeSettings
decor?: {
  intensity?: number;             // 0–1
  angle?: number;                 // -12..0, whole degrees (W5-D43)
  texture?: "none" | "bingoGrid"; // THEME_DECOR_TEXTURES
};
// theme/decor.ts: readDecor(value) keeps a valid stored block (an out-of-range value reads as absent);
// resolveDecor(decor) fills Prime Time's values (0.7, -5, "none"). normalizeTheme never writes defaults in.
```

- zod in `api/admin/branding.ts` `themeSettingsSchema` (which is not `.strict()`: until `decor` is named there, a PUT carrying it is stripped silently), the Mongoose subschema in `models/b2b.ts` (`_id: false`, `default: undefined`), and `storedThemeSchema`/`normalizeTheme` carrying it through on every read. Absent means Prime Time's value.
- **Texture lives in `decor`,** not `surface.texture` (a parked block the overhaul doesn't read). `bingoGrid` renders GridTexture; `none` renders none.
- `radius` reuses `shape.radiusBase` through the shared `radiiFromBase` (chip = max(2, round(B×0.35)), control = B, card = round(B×1.25)); tag is fixed at 2. Brand offers no radius control, so it is whatever the tenant stored, else 8.
- **The angle is a Fine-tune setting** (W5-D43): −12° to 0°, default −5°. The range keeps the band legible and inside the angle budget.

**`DECOR-06` (revised) — The angle budget.** Two angles exist. The band angle `--k-angle` (default −5°), shared by the HeroBand cut, its hairline, the double under-band and the DecorField fragments. The chyron's fixed `skewX(-10deg)`, shared by Chyron and Stripes. Nothing else tilts at rest. BingoLine (board geometry) and the rearrange jiggle (transient, W5-D14) are exempt.

**`DECOR-12` (revised) — Intensity scales linearly, 0 to 1.** Field pieces multiply the scheme's stroke, fill and glow alphas by `--k-intensity / 0.7` (the mock's own formula, `kit.css` line 269): Prime Time's 0.7 is the reference strength, 1.0 is about 1.4× louder, 0 is off. At 0 the host mounts no DecorField, Burst or GridTexture. The desktop frame's decorative sides follow the same value.

---

## Type

**`DECOR-29` — Satoshi only** (ruling; W5-D25). Satoshi Variable is self-hosted in the fan app (`public/fonts/satoshi`, `src/styles/satoshi.css`, present on the redesign). No Fontshare or Google Fonts request at runtime, no Barlow, no IBM Plex Mono, no Fraunces, no font option anywhere.

| Class | Size / leading | Weight / case / tracking | Replaces (mock) |
|---|---|---|---|
| `.k-display` | inherits size; lh 0.9 | 900, uppercase, −0.01em | Barlow Condensed 600–700 |
| `.k-d-hero` | 80px; lh 0.84 | display | the 92px gate headline (Satoshi is wider) |
| `.k-d1` / `.k-d2` / `.k-d3` | 40 / 30 / 22px | display | |
| `.k-d4` | 19px | 700, +0.02em (buttons) | |
| `.k-body` | 16px / 1.5 | 400 and 500 | Barlow 16px |
| `.k-small` | 14px / 1.45 | 400–500 | |
| `.k-micro` | 12px | 500 | |
| `.k-eyebrow` | 11px | 700, uppercase, +0.12em, `--k-text-2` | |
| `.k-num` | inherits | 500, `font-variant-numeric: tabular-nums` | IBM Plex Mono 500 |

- **`DECOR-30` — Numerals are tabular Satoshi**, never a monospace face.
- **`DECOR-31` — The gate word fits its column.** `.k-fit` sizes "BINGO" with container query units (`container-type: inline-size` on the column, `cqi` on the word), so it fills the column at any width with no per-tenant override and no JavaScript measuring.
- **Uppercase is CSS only.** Text is written in the DOM in sentence case, so assistive technology reads words, not letters.
- The smallest text anywhere is 11px (eyebrows, uppercase and tracked); body copy is never below 14px.

---

## Components

All components paint only from `--k-*` tokens (`DECOR-01`), take `className`, and never read the theme object (`DECOR-20`): the host decides whether a piece mounts, the piece paints. Ornament layers are `aria-hidden="true"`, `pointer-events: none`, and SVGs carry `focusable="false"`; Chyron, Track, Medal, BingoLine and Square expose their text or state (`DECOR-16`).

| Component | Variants / props | Where the screens use it | Notes |
|---|---|---|---|
| `DecorField` | `full`, `corner`, `low`, `fixed`, `frame`; `intensity?` | Start, auth screens, paused, results podium, empty states, the desktop sides | Oversized 3×3 board fragments in Second at `--k-a-stroke`, one band-filled and one Accent-filled cell, a soft band glow; a column mask holds it to ≤0.12 effective alpha behind text (`DECOR-10`) |
| `HeroBand` | `single`, `double`, `compact` | One per screen at most (`DECOR-07`) | Band block (`--k-main`), transparent cut at `--k-angle` (`DECOR-08`), Accent hairline on the cut, Second under-band in `double`; text upright, never counter-skewed |
| `Chyron` | `team` (the band), `second`, `accent`, `live`, `neutral`, `success`; `sm`, `md`, `lg`; `dot` | Status (LIVE, OPEN, JOINED, OPENS …, CLOSED, FINAL), tier labels, ladder labels, REQUIRED/OPTIONAL | Text on a `skewX(-10deg)` pseudo-element; the `live` dot pulses only while mounted, and a screen mounts it only while a game is live |
| `GradientRule` | `rule`, `edge` | Section dividers, featured card edges | Main-ink to Accent-ink, 2px |
| `Stripes` | `corner`, `inline` | Contest card corner, section markers | Band, Second, Accent bars, `skewX(-10deg)` |
| `Scorebug` | `card`, `rail`; `status: upcoming \| live \| final`; `away`, `home`, `tipTime` | Contest detail games, live board rail | **`DECOR-18` — never a score.** Detail line: "Tip Sun 7:30 PM", "Live", or "Final" (ruling 2026-09-24: no score or clock feed) |
| `Track` | `value` 0–8 or absent; `stops: { at, label }[]` (one per winnable tier of the contest, spaced by tier as the redesign's `tierTrack` does, `lib/tierProgress.ts`); `marker` (a node) | Live board progress | `role="progressbar"`, `aria-valuenow`, `aria-valuetext` ("2 bingos. Next prize: Tier 2 at 3 bingos."). The marker node is the fan app's existing `components/board/ProgressMarker.tsx`, consumed (W5-D74): `progressMarkerCandidates` → the game's slider sponsor icon, the game's own marker, the Brand marker, falling through on load errors, and ending on the default **downward triangle in Text** (`MARKER_TRIANGLE`, `lib/defaultArt.ts`). W5-D57/D63's "tenant mark as default" is superseded |
| `Burst` | `play`; `intensity?` | Behind the prize image; behind first place on the podium | Plays once when `play` turns true |
| `Medal` | `1`, `2`, `3`, `tile` | Standings, results | Medal 1 in the band; rank numeral is real text; ties share a medal |
| `GridTexture` | `intensity?` | Page texture when `decor.texture` is `bingoGrid` | 3×3 board tile in Second |
| `Brackets` | `live`, `justHit` | Live square (static), a square that just hit (transient) | Accent-ink corners |
| `BingoLine` | `lines: ("r1"…"d2")[]`, `fresh?` | Live board | Lines are shared `completedLines(cells)` over the board's scored cells (`scoring/bingo-lines.ts`, the same function as `boardBingos`; W5-D75), never `claimedLineIndices`; index map in shared `BINGO_LINES` order: 0 r1, 1 r2, 2 r3, 3 c1, 4 c2, 5 c3, 6 d1 (top-left to bottom-right), 7 d2 (bottom-left to top-right); `fresh` lines draw in over 500ms |
| `Confetti` | `fire()` via ref, or `burst` prop | Prize popup | See `DECOR-33` |
| `Square` | `state: pick \| empty \| hit \| live \| miss \| void \| pending` (`void`: the miss treatment labelled "Void", `FLOW-27`); `photoUrl?`; `dim` (0.35 builder, 0.55 live); `locked?` (**Phase B addition**) | Builder, live board | See `DECOR-32` |

**`DECOR-32` — Photos behind squares, never initials** (ruling; W5-D11). `Square` renders `photoUrl` full-bleed behind its content with a ground scrim at `dim` (builder ~0.35, live board ~0.55). With no usable photo (no `photoUri`, `showPhotoUri === false`, or the image fails to load) it renders a band → Second gradient wash with the jersey number large and the player's name. No initials render anywhere in the kit, and a test asserts no initials text in the DOM. `locked` (Phase B, for the builder and edit mode) adds a padlock and removes the square from rearrange (no jiggle, no drag, no drop target).

**`DECOR-33` — Confetti stays in the column** (ruling; W5-D21). JavaScript-generated: about 80 pieces, 1.8 s, gravity plus lateral drift, colours only `--k-main-ink`, `--k-second-ink` and `--k-accent`, every piece's start position inside the shell column's bounds. It renders inside `KitShell`, whose root has `overflow: clip`, so on desktop it never reaches the decorative sides. Under reduced motion it renders nothing and the Burst shows its end state.

**`DECOR-34` — No full-screen flash.** No component or screen paints a full-viewport colour flash (the current app's `PrizeModal` team-colour flash and S2's "flash when glow ≥ 0.5" are cut).

**`DECOR-19` — Budget.** Decor is inline SVG or CSS, under 4 KB of rendered markup per piece, no raster decoration and no CSS filter in the kit. Player photos, logos and sponsor artwork are data and exempt.

---

## The shell

**`DECOR-35` — `KitShell` is the mobile column with decorative sides.** Props: `palette`, `scheme`, `decor`, `header?`, `footer?`, `children`.
- The column: `max-width: 480px`, `min-height: 100dvh`, centred, `overflow-x: clip` (and `overflow: clip` for confetti), `container-type: inline-size`, on `--k-ground`.
- At viewport widths of **900px and up**, a `DecorField` `frame` variant fills the viewport behind the column in the tenant's colours, and the column gets a hairline ring and `--k-shade`. Below 900px there are no sides. Nothing becomes multi-column at any width; there is no desktop layout (ruling: mobile only).
- It applies the resolved `--k-*` variables to its own root (`DECOR-25`).

**`TopBar`** (W5-D07): 56px plus the top safe-area inset. Left: back button or the tenant mark; centre: the title; right: the menu button (48×48, accessible name "Open menu"). Over a hero band it is transparent and uses `--k-on-main`; otherwise `--k-ground` at 92% with a backdrop blur and a hairline once the page has scrolled. Takes `hidden`.

**`TabBar`** (W5-D01): icon plus label items; the active item has a Main-ink icon and label and a 3px Main-ink top hairline segment (the band role, W5-D69); bottom safe-area inset; 48px minimum targets (`FAN-59`). Takes `hidden`. The icons are lucide-react (the app's icon set).

**`DECOR-36` — Hide-on-scroll** (W5-D03). `useChromeVisibility(scrollRef | window)` wires a pure reducer, `chromeReducer(state, event)`, so the decision logic is tested without a DOM:

| Event | Result |
|---|---|
| Scroll down by more than 12px since the last direction change, and scroll position ≥ 64px | Hide header and footer |
| Scroll up by more than 12px | Show |
| Scroll position < 64px | Always shown; never hides |
| Overscroll (position < 0 or past the maximum: iOS rubber-band) | Ignored |
| Scrolling stops at the top | Show |
| `reveal()` (route change, a sheet opening, focus moving into a hidden bar) | Show |

- Reads are `requestAnimationFrame`-throttled: at most one decision per frame.
- Motion: `transform: translateY(±100%)` over 240ms `cubic-bezier(.2,.7,.2,1)`; under reduced motion the change is instant.
- **No layout shift.** Content keeps padding for both bars whether they are shown or hidden; the bars overlay it.
- Bars sit on `color-mix(in srgb, var(--k-ground) 92%, transparent)` with a backdrop blur, so content scrolling under them stays legible.
- A focused control inside a hidden bar (keyboard users) reveals it.

---

## Motion

| Piece | Trigger | Timing | Reduced motion |
|---|---|---|---|
| Header / footer | Scroll direction (`DECOR-36`) | 240ms `cubic-bezier(.2,.7,.2,1)` | Instant |
| Chyron `live` dot | Mounted while a game is live | 2s ease-in-out, repeating | Solid dot |
| Track fill and marker | `value` changes | 400ms `cubic-bezier(0.22, 1, 0.36, 1)` | Jumps |
| BingoLine | A line in `fresh` | 500ms draw-in | Drawn complete |
| Brackets `justHit` | A square hits | 200ms in, 1200ms hold, 400ms out | Static for 1600ms |
| Burst | `play` turns true | 600ms, once | End state |
| Confetti | `fire()` | ~1.8s, once | None |
| Square jiggle | Rearrange mode (W5-D14) | ±1.2°, 0.32s, alternating phase per square | None |
| Skeleton | Loading | opacity pulse 1.2s | Static |

**`DECOR-13` — State-driven motion only; `DECOR-14` — reduced motion shows end states,** answered in the kit's own CSS and in its JavaScript (every JS animation checks the app's `prefersReducedMotion`, `src/lib/motion.ts`), not left to the app's global floor. **`DECOR-15` — Timing is not themed.** No param changes a duration or curve.

---

## The `/kit` gallery

A separate entry on the Wave 5 branch (never on main): `KitShell` with a control strip (palette: `bears`, `fightinghawks`, `test`, Bad case, the seeds taken from the redesign's `TENANT_SEED_THEMES` and `DEFAULT_THEME`; a **scheme readout** showing what Main selects, with a demo-only override to the other scheme (W5-D70); intensity slider; angle), the band mapping for the selected seed ("Band: Main" or "Band: deepened Accent", with Main's chroma), a token table with live contrast readouts (main-ink on ground, main-text on ground, on-main on main, hit on surface, text on ground and surface, each marked pass or fail), the type scale, every component in every variant, square states with a real photo URL and the no-photo fallback, Track at 0 / 2 / 5 / 8, every BingoLine, a Confetti trigger, and a long scrolling region with `TopBar` and `TabBar` to show hide-and-reveal. `?palette=bears&scheme=dark` deep-links for screenshots. The seeds are labelled as samples in the control strip; they never reach a fan screen.

---

## Rules

Kept from S2 (renumbered only where noted): `DECOR-01`, `DECOR-03`, `DECOR-05`, `DECOR-06` (revised), `DECOR-07`, `DECOR-08`, `DECOR-09`, `DECOR-10`, `DECOR-11`, `DECOR-12` (revised), `DECOR-13` to `DECOR-20`, `DECOR-23` (revised), `DECOR-24`. New: `DECOR-25` to `DECOR-44` (`DECOR-40` withdrawn).

- **DECOR-01 — Colour only from `--k-*` tokens** in `src/kit/decor/` and `src/kit/shell/`, enforced by a source-reading test.
- **DECOR-03 — Second is derived from the band, never stored, never tenant-facing.**
- **DECOR-05 — Live is never decorative,** and never a tenant colour.
- **DECOR-06 — The angle budget:** `--k-angle` for the band system, fixed −10° skewX for chyrons and stripes, nothing else tilts at rest.
- **DECOR-07 — One band per screen.** `double` counts as one.
- **DECOR-08 — The band's cut is transparent**; no ground-coloured slab over the field or texture.
- **DECOR-09 — Scheme-aware alpha** via `--k-a-stroke`, `--k-a-fill`, `--k-a-glow`, `--k-soft-pct`; no piece branches on the scheme.
- **DECOR-10 — Nothing behind text above 0.12 effective alpha.** Cards are opaque; the field is masked over the column.
- **DECOR-11 — Decoration fades; information never does.**
- **DECOR-12 — Intensity scales linearly 0–1**; 0 mounts no field pieces.
- **DECOR-13 — State-driven motion only.**
- **DECOR-14 — Reduced motion shows end states**, in the kit's own CSS and JS.
- **DECOR-15 — Timing is not themed.**
- **DECOR-16 — Ornaments are hidden from assistive technology;** Chyron, Track, Medal, BingoLine and Square expose their text or state.
- **DECOR-17 — Kit text meets 4.5:1;** `--k-text-3` never carries text a fan must read.
- **DECOR-18 — The Scorebug never shows a score or clock.**
- **DECOR-19 — Budget:** ≤4 KB per piece, no raster decoration, no filter.
- **DECOR-20 — Pieces don't consult the theme.**
- **DECOR-23 — Scheme ramps are platform-owned**, one per scheme; no mode setting.
- **DECOR-24 — No B2C colour or asset.** The fragment motif is the product's own 3×3 board. B2C mechanics (ladder, labels, points, rearrange) are behaviour, not look.
- **DECOR-25 — The kit lives in the fan app's `src/kit/`, prefixed `--k-`, applied on the shell's root, never `:root`.**
- **DECOR-26 — Four stored colours, the redesign's contract:** Main, Accent, Text, Button text (optional), through `normalizeTheme`.
- **DECOR-27 — `resolvePalette` is the only thing that computes a kit colour.**
- **DECOR-28 — Contrast guarding is code with tests** (ratios above; the seeds' band regressions; the bad case lifted).
- **DECOR-29 — Satoshi only, self-hosted.**
- **DECOR-30 — Numerals are tabular Satoshi.**
- **DECOR-31 — The gate word fits by container query.**
- **DECOR-32 — Photos behind squares, never initials;** `showPhotoUri === false` and load failures fall back to the gradient, jersey number and name.
- **DECOR-33 — Confetti is generated inside the column and clipped by it.**
- **DECOR-34 — No full-screen flash.**
- **DECOR-35 — `KitShell` is the 480px column; decorative sides from 900px; no multi-column layout.**
- **DECOR-36 — Hide-on-scroll follows the reducer table exactly.**
- **DECOR-37 — No presets; Prime Time's values are the decor defaults.**
- **DECOR-38 — Decor params are stored as an additive `ThemeSettings.decor { intensity?, angle?, texture? }`** plus the parked `shape.radiusBase` (Phase B: to build, s0).
- **DECOR-39 — Load-time derivation; no data migration.**
- **DECOR-41 — Text is stored and guarded ≥4.5:1 on ground and surface** (the ramp's text where it fails).
- **DECOR-42 — Button text is the redesign's:** stored as given, else APCA auto; no kit guard.
- **DECOR-43 — The band is `isChromatic(main) ? main : deepen(accent)`;** `--k-main*` from the band, the hit from Accent.
- **DECOR-44 — The scheme comes from Main** (`resolveTheme().ground.colorScheme`).

### Retired

| ID | Was | Why retired |
|---|---|---|
| DECOR-02 | Every new variable read with a fallback, for two hosts at two commits | One host (the fan app); `KitShell` always sets every token. |
| DECOR-04 | Accent and Live "Auto" are the preset's values, written at apply time | Accent is stored (W5-D68); Live is the scheme's fixed tone. |
| DECOR-21 | `decor.band` wins over `motif.heroMotif` | There is no band on/off setting in Wave 5; bands are part of each screen's layout. `heroMotif` is not read. |
| DECOR-22 | Presets copy `decor` through `applyPreset` and `genericizeForGallery` | No presets (W5-D71); the redesign deleted `theme/presets.ts`. |
| DECOR-40 | The pure palette half moves to `obs-b2b-shared/src/theme/kit/`; `DecorField`, `HeroBand`, `Chyron`, `Square` lift to `ui/kit/` | The console needs no kit code: no preset thumbnails (W5-D71), and Brand uses the redesign's own picker and readout (W5-D68). W5-D48 falls with the presets. |
| S2 font pairings (`THEME_FONT_PAIRINGS`) | One font choice from five pairings | Satoshi only (ruling). |
| S2 `decor.field` / `decor.band` | Field on/off and band style as tenant settings | Not in Fine-tune; field strength is `intensity` (0 removes it). |
| S2 `withMode` and per-preset counterpart ramps | A mode flip swaps a preset's ramp | Ramps are platform-owned per scheme, and the scheme follows Main (`DECOR-23`, `DECOR-44`). |
| S2 twelve pieces in `obs-b2b-shared/src/ui/decor/` | Shared from the start | The kit lives in the fan app (`DECOR-25`). |

---

## Function audit

### 1. Data sources and calls

| Surface | Data sources | Server calls on fan action | States covered |
|---|---|---|---|
| `KitShell` (every overhaul screen) | `GET /b2b/org/:subdomain` → `organization.branding.theme` (the redesign's `storedThemeSchema`: `colors.main/accent/text/buttonText?`, `shape.radiusBase`; `decor` once s0 adds it), else the fan app's seed/`DEFAULT_THEME`, mapped by `paletteFromTheme` | None | No `branding` (seed or default); Main chromatic (band = Main) and not (band = deepened Accent); dark and light scheme; stored Text failing the ramp (ramp text); Button text set and auto; bad case (lifted); reduced motion; ≥900px sides |
| `Square` | The board or builder read's prop: `entityInfo.photoUri`, `entityInfo.showPhotoUri`, jersey, name ([`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md)) | None | Photo; `showPhotoUri: false`; no photo; photo fails to load; each state; locked (Phase B) |
| `Track` marker | The redesign's `ProgressMarker` (`progressMarkerCandidates`), since 2026-09-30: `contest.progressMarkerImageUrl` (contest read), `branding.assets.sliderTipImageUrl` (org read). No sponsor slider icon and no per-game marker | None | Contest marker; Brand marker; none (triangle in Text); an image failing to load (falls through) |
| `Scorebug` | The game's `eventTime` and derived status (`deriveGameStatus`, Wave 3) | None | Upcoming, live, final; never a score |
| `/kit` gallery | `TENANT_SEED_THEMES` (`bears`, `fightinghawks`), `DEFAULT_THEME` (`test`), the bad case in `src/kit/palette/presets.ts` (labelled samples) | None | Every seed on its scheme and the override, intensity 0–1, angle range, both band mappings |

### 2. Mock elements

| Mock element (`mocks\fanapp-v2\`) | Fate | Reason |
|---|---|---|
| Barlow Condensed, Barlow, IBM Plex Mono via Google Fonts (`_head.tpl`, `kit.css`) | Cut | Satoshi only (ruling); no runtime font CDN. Display becomes Satoshi 900 uppercase, numerals tabular Satoshi |
| 92px gate headline | Changed to 80px `.k-d-hero` plus `.k-fit` | Satoshi is wider (W5-D25) |
| Hard-coded tenant palettes per `data-tenant` (`kit.css`) | Changed | Computed by `resolvePalette` from the tenant's stored colours |
| Mock dark `--text-2` `#9FADC2`, `--text-3` `#66738A` | Changed | `--text-3` measures 4.1:1; the kit lifts both (`DECOR-17`) |
| Player initials discs (`.avatar`: MC, EV, JO…) | Cut | Real photos, gradient fallback, never initials (ruling; W5-D11) |
| Two-letter team `.mark` discs (CB, GB…) | Changed | The team's logo from the game read when present; otherwise the team name as text, no invented monogram |
| CSS confetti (44 pieces, fade and drop 40px) | Changed | JS-generated ≈80 pieces with gravity and drift, clipped to the column (W5-D21) |
| Scorebug with "17 – 14", "Q3 · 8:12" (`board.html`, `kit.html`) | Cut | No score or clock feed (ruling 2026-09-24); the kit's own note already said so |
| `decor-field--frame` sides at ≥900px | Kept | Ruling: desktop is the centred column with tenant-coloured sides |
| `phone--wide` / `phone--read` 640px columns | Cut | Mobile only; one 480px column everywhere |
| `?tenant`, `?mode`, variant switcher, `?preview=1` PREVIEW chyron (`kit.js`) | Cut | Mock chrome; the preview carries no marker (`PREV-09`) |
| Mini-board "live" square (`i.l`, accent) | Cut from the mini-board | W5-D23; the full board keeps its live state with Brackets |
| Locked square with padlock (`kit.html`) | Kept, as `Square` `locked` (Phase B) | Needed for per-square locks at tip-off |
| Fixed −5° angle | Changed to `--k-angle`, default −5° | Fine-tune offers the angle (W5-D43) |

### 3. Cut or changed by the console-redesign delta (W5-D68–D75)

| Element (Phase A kit or earlier draft) | Fate | Reason |
|---|---|---|
| Stored `ThemeSettings.palette? { main, accent, text?, buttonText? }` and "Brand keeps `colors.primary`/`colors.accent` equal" | Cut | The redesign's `colors` already is `{ main, accent, text, buttonText? }` (W5-D68) |
| `paletteFromTheme` reading `colors.primary/secondary/accent/live` | Changed | Reads the normalized four colours (W5-D68); written in s1's kit first-aid (it never existed in Phase A) |
| `TenantPalette.second?` and `.live?` inputs (stored `colors.secondary`, `colors.live` honoured) | Cut | The redesign stores neither; Second is derived from the band, Live is the scheme's tone (W5-D68) |
| Main painted as the band as-is (`team` → `main` rename only) | Changed | The band is derived: `isChromatic(main) ? main : deepen(accent)` (W5-D69), else Hawks bands would be black |
| Hit candidate order team-ink, second-ink, accent-ink | Changed | Hit = Accent-ink through the redesign's `contrastSafeHit(accent, against[], min)` (W5-D69) |
| `--k-team*` tokens | Changed | `--k-main*`, fed from the band (W5-D65, W5-D69) |
| Mode (`dark`/`light`) as a tenant setting and the gallery's mode toggle | Cut | No mode anywhere; the scheme comes from Main (W5-D70); the gallery shows a scheme readout with a demo override |
| Button text guarded ≥4.5:1 on Accent | Cut | The redesign's APCA auto, or the tenant's own value as given (W5-D68) |
| Text optional with an "Auto" state | Changed | Text is always stored (White/Black); the kit falls back to the ramp's text only where the stored one fails (W5-D68, W5-D66) |
| Prime Time and Club Level as presets; Prime Time's gold default accent | Cut | No presets (W5-D71); Prime Time's values are the Fine-tune defaults; Club Level is gone (W5-D53 withdrawn) |
| `applyPreset`/`genericizeForGallery` copying `decor`; `THEME_TEXTURES` widened with `bingoGrid` | Cut | Presets deleted on the redesign (W5-D71); texture lives in `decor.texture` |
| `decor { intensity, angle }` plus `surface.texture` | Changed | `decor { intensity?, angle?, texture? }` in one additive block (W5-D71) |
| The palette's move to `obs-b2b-shared/src/theme/kit/` and the `ui/kit/` lift (`DECOR-40`, W5-D48) | Cut | The console needs no kit code (W5-D68, W5-D71) |
| Track marker default "the tenant's own mark, else a Main puck" (W5-D57/D63) | Changed | The redesign's chain, ending on the triangle in Text, consumed from `ProgressMarker` (W5-D74) |
| BingoLine from "4b's derived bingo function (count, lines, progress)" | Changed | Shared `completedLines` over the scored cells, the same function as `boardBingos`; nothing persisted (W5-D75) |
| Gallery sample palettes (Bears with gold accent, Hawks with orange accent, Test blue) | Changed | The redesign's seeds `bears`, `fightinghawks`, `test` (W5-D69, walk #3's stale-tenant cleanup) |

---

## Acceptance criteria

1. `resolvePalette` returns a complete `KitTokens` for Main, Accent and Text with and without Button text, on both schemes; a Text under 4.5:1 on the ground or surface comes back as the ramp's text; a missing or malformed Main, Accent or Text throws `PaletteError`.
2. For the gallery's four palettes on their own scheme and on the override, every guarded token meets its ratio (`DECOR-28`), the bad case is lifted, and the output is deterministic across runs.
3. The band follows `DECOR-43` with `BAND_MIN_CHROMA` 0.03: `bears` keeps its navy Main as the band with an orange hit; `fightinghawks` resolves `--k-main` to a deep green (OKLCH L 0.32–0.38, hue ≈150) with a bright-green hit; `test` gets a neutral grey band; a Main at chroma 0.029 hands the band to Accent and one at 0.031 keeps it. The gallery shows the `bears` and `fightinghawks` mappings side by side.
4. `resolveTheme(theme).ground.colorScheme` alone picks the ramp (`Scheme` → `DARK_RAMP` / `LIGHT_RAMP`): a light Main renders the light ramp, a dark Main the dark one; no `Mode` type or stored mode is read anywhere in the kit.
5. `--k-on-accent` equals `resolveTheme(theme).colors.buttonText` for a stored Button text and for auto.
6. Every key `tokensToCssVars` returns starts with `--k-`, none is undefined, no `--k-team` key remains, and `applyKitVars` sets and clears them on one element; `document.documentElement` gains no `--k-` variable.
7. No file under `src/kit/decor/` or `src/kit/shell/` contains a colour literal (source test).
8. `chromeReducer`: scrolling down past 12px at ≥64px hides; scrolling up past 12px shows; below 64px never hides; overscroll is ignored; `reveal()` shows; the reduced-motion flag passes through to an instant transition.
9. Confetti: about 80 pieces, colours only from the three tokens, every initial position inside the given bounds; under reduced motion nothing renders.
10. `Square` with a photo renders it behind content at the given dim; with `showPhotoUri: false`, no `photoUrl`, or a failed load it renders the gradient, jersey and name; no initials text appears in the DOM in any case.
11. `KitShell` at 390px shows no sides; at 1280px shows the tenant-coloured sides and a centred 480px column; confetti fired at 1280px never paints outside the column.
12. No request to `fonts.googleapis.com`, `api.fontshare.com` or any font host other than the app's own origin, on any overhaul screen or the gallery.
13. The gallery renders every component and variant for `bears`, `fightinghawks`, `test` and the bad case on their scheme and the override; screenshots at 390 and 1280 go to `artifacts\w5\`.
14. `paletteFromTheme` maps the three seeds, a stored four-colour theme with `decor`, and a legacy `mode` + `primary` theme (through `normalizeTheme`) to complete palettes; absent `decor` gives Prime Time's values.
15. The fan app suite, typecheck, lint and build are green after the kit first-aid (the rebased branch starts at 415 tests with 44 failing and `tsc -b` failing at `resolve.ts:204`; the redesign alone has 272), the redesign's `fallback.test.ts` included, with no change to an existing screen in that commit.

## Open questions

None. Decided since the first draft: the chromatic threshold is 0.03 (the director, 2026-09-29, correcting W5-D69's first figure of 0.06, which would have given Bears orange bands); Second's direction (W5-D42, `DECOR-03`), the band angle range (W5-D43, `DECOR-38`), the neutral broadcast ground (W5-D65), the theme contract, band role, scheme and presets (W5-D68–D71).

## Recorded gaps

- **The light ramp** is the mock's and had not been measured by the Phase A tests at the time of writing; the tests are the source of truth. No seed selects it; the gallery override and a light-Main test edit exercise it.
- **The parked theme blocks** (`type`, `shape.density`, `surface`, `motif`) stay stored and unread by the overhaul.
- **Decor params reach the fan app once the integrator pins s0's shared SHA** (`DECOR-38`); until then every tenant renders Prime Time's values.
- **No resizing of player photos.** Photos load from PES's bucket at their stored size.

## Mocks

- `mocks\fanapp-v2\kit.html`, `kit.css`, `kit.js`, `_head.tpl` (workspace): the visual direction for every component. Their fonts, palettes-by-tenant, initials, scores and PREVIEW chyron are cut (function audit).
- Screen mocks placing the kit: `gate.html`, `board.html`, `prize.html`, `standings.html`, `results.html`.
- Phase A screenshots: `artifacts\w5\kit-*.png` (workspace), produced by the kit build (pre-redesign palettes).

## Supersessions (for the vault wrap; not written to the vault here)

`ArthurVault\projects\Overboard\b2b\charts\design.md`, for the Wave 5 branch only (main is unchanged):

1. **"Mobile-portrait only … zero `sm:`/`md:`/`lg:` breakpoints"** → one breakpoint, 900px, which adds only the decorative sides around the same 480px column.
2. **"The governing fact … `themeToCssVars` into custom properties on `<html>`"** → overhaul screens paint from a second namespace, `--k-*`, resolved by `resolvePalette` and applied on `KitShell`'s root, never `<html>`.
3. **"Container by page family: `max-w-sm` … `max-w-lg`"** and **"Any state/status pill goes through `StatusBadge`"** and the `h-12 rounded-xl` CTA → one 480px `KitShell` column, `Chyron` for status, kit radii (control 8px) for buttons.
4. **"`HeroBand` … in `components/layout/`"** → `src/kit/decor/HeroBand`.
5. **"Do not port a b2c color or pattern"** → B2C *mechanics* are ported (line ladder and its labels, points, rearrange); no B2C colour or asset (`DECOR-24`).

Stale regardless of Wave 5, for the same wrap: "Type is Satoshi … a Fontshare `<link>` in `index.html:7`" (Satoshi has been self-hosted since Wave 3).

## References

- Decisions: `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` (W5-D03, D11, D21, D25–D26, D42, D43, D65); `briefs\w5-phaseB-deltas.md` (W5-D68–D71, D74, D75); kit brief `w5-kit.md` (workspace). Facts: `artifacts\w5\redesign-delta.md` §1, §4, §6 rows 1–7, 14, 18.
- Rulings: `artifacts\review-2026-09-27\arthur-rulings-2026-09-27.md` (Satoshi; Fan app overhaul), `artifacts\wave-2026-09-24\arthur-rulings-after-specs.md` (scorebug without scores), `arthur-rulings-console-final-walk.md` (walk #3: tier-spaced notches, presets removed).
- [`admin-branding.spec.md`](admin-branding.spec.md) (redesign): the four-colour model, `THEME-03`, `THEME-05`.
- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §4 (hit colour), §7 (Satoshi).
- Shared code (redesign): `theme/resolve.ts` (`resolveTheme`, `contrastSafeHit`, `HIT_MIN_CONTRAST`, `autoButtonText`, `DEFAULT_LIVE`, `DEFAULT_THEME`, `radiiFromBase`), `theme/color.ts` (`toOklch`, `fromOklch`, `withLightness`), `theme/normalize.ts`, `theme/seeds.ts` (`TENANT_SEED_THEMES`), `api/admin/branding.ts` (`themeSettingsSchema`), `scoring/bingo-lines.ts` (`BINGO_LINES`, `completedLines`, `boardBingos`), `interfaces/b2b/{B2BOrganization,ProgressMarker}.ts`.
- Fan app (`arthur-fanapp-overhaul`): `src/kit/**`, `src/styles/satoshi.css`, `src/lib/{motion,defaultArt,tierProgress,board}.ts`, `src/main.tsx`, `src/context/TenantContext.tsx`, `src/theme/seed.ts`, `src/components/board/{ProgressMarker,PrizeModal}.tsx`.
- Siblings: [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`../../webapp/fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).
