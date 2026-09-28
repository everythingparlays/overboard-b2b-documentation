# Core Module Spec: Fan Decor Kit — palette, tokens, type, decoration and shell (Wave 5)

**Implements:** Arthur's 2026-09-27 rulings, "Fan app overhaul" (Satoshi only; desktop is the mobile column centred with tenant-coloured decorative sides; confetti kept inside the phone area in tenant colours; real player photos behind squares, never initials; no "peeking" text) and "Priorities" (Satoshi is the font everywhere, B2B and B2C, Prime Time included); the standing rule "function over mocks" (2026-09-28). Director's decisions W5-D01 to W5-D50, all binding (chiefly W5-D03, W5-D11, W5-D21, W5-D24, W5-D25, W5-D26, W5-D42, W5-D43, W5-D48; `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md`, workspace), and the Phase A review rulings (`artifacts\wave-2026-09-27\briefs\w5-review-rulings.md`, workspace).

**Depends on:** Wave 4's specs on docs branch `arthur-w4-console` (PR #29, not merged to main; this branch is cut from the Wave 3 state and is rebased once Wave 4 and the Wave 4b fix pass merge): [`admin-branding.spec.md`](admin-branding.spec.md) (the stored theme contract `ThemeSettings`, `THEME-03` "the resolver is the only thing that computes", `THEME-05` status colours platform-owned, `THEME-08` presets keep the team's colours). On main: [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §4 (Wave 3's contrast-guarded hit colour, `contrastSafeHit`) and §7 (Satoshi self-hosted). Siblings on this branch: [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md) (writes the palette and decor params), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md) and [`../../webapp/fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md) (the screens that place the kit), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).

**Supersedes:** S2's draft of this spec (docs branch `arthur-s2-fanapp-spec`, PR #23): the twelve-piece kit in `obs-b2b-shared/src/ui/decor/`, the `decor { field, band, intensity }` contract block, the font pairings, auto Accent, per-preset light and dark ramps with `withMode`, and Club Level as a shipped overhaul preset. For the Wave 5 branch only, three points of the vault chart `b2b\charts\design.md` (listed under "Supersessions", for the vault wrap).

**Status:** Draft, 2026-09-28, Wave 5 Phase A. The kit is being built in Phase A in the fan app (`overboard-b2b-template`, branch `arthur-w5-fanapp`, worktree `.worktrees\template-w5`, brief `artifacts\wave-2026-09-27\briefs\w5-kit.md`) as additive files that no existing screen mounts. Phase B moves the screens onto it. Wave 5 is never merged to main (W5-D29).

## Overview

The overhauled fan app needs one visual system that turns a tenant's two to four colours into every colour a screen uses, keeps every text and signal readable whatever the tenant picks, sets one typeface at one scale, and supplies the decorative pieces (splash field, hero band, broadcast tags, scorebug, prize track, burst, bingo line, confetti) plus the shell every screen sits in.

**The whole change, in one line:** a pure palette resolver emits `--k-*` tokens onto the shell's own root, and a small set of CSS-and-SVG components paint only from those tokens, so a tenant's look is its palette plus four decor params, and nothing on screen can end up unreadable.

**In scope:**
- The palette (2–4 colours) and the resolver that derives the token set, with its contrast guards.
- The token list, the mode ramps, the decor params and the Prime Time preset.
- The type scale (Satoshi only).
- The decoration components and the board square.
- The shell: `KitShell`, `TopBar`, `TabBar`, `useChromeVisibility` (hide-on-scroll).
- Where the kit lives now and when it moves to the shared package.
- How today's stored `ThemeSettings` maps onto the kit with no data migration.

**Not in scope:**
- Screen layouts and copy ([`fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md)).
- The Brand page that edits the palette ([`admin-brand-v2.spec.md`](admin-brand-v2.spec.md)).
- The console's own look.
- Raster artwork. The only images the kit renders are data: player photos, team logos, the tenant logo and marker, sponsor artwork, prize images.

---

## Principles

**Function over mocks.** `mocks\fanapp-v2\` is visual direction. Where a mock technique and a working, readable result disagree, the result wins and the deviation is in the function audit below.

**Colour only from tokens.** A kit component reads colour only from `--k-*` variables. No hex, `rgb()` literal, named colour or Tailwind colour class appears in `src/kit/decor/` or `src/kit/shell/`. The only hex values in the kit are in `src/kit/palette/` (ramps, fixed live tones, test fixtures).

**Readable by construction.** Every ink the resolver emits is measured against what it sits on and lifted until it passes. A tenant cannot pick a palette that produces invisible text, an invisible hit, or an invisible band edge. The guards are code with tests, not review.

**Decoration fades; information never does.** `--k-intensity` scales the field pieces (DecorField, Burst, GridTexture, glows). Pieces that carry state, progress or structure (HeroBand, Chyron, Scorebug, Track, Medal, Brackets, BingoLine, Square) always render at full strength.

**State-driven motion.** Things move because something changed: a line completed, a square hit, a prize arrived, the fan scrolled, a sheet opened, the fan entered rearrange mode. Nothing loops for decoration. Under `prefers-reduced-motion: reduce` every animation shows its end state.

---

## Where the kit lives

**`DECOR-25` — Phase A: the fan app, additive, isolated.** Everything is under `overboard-b2b-template/src/kit/` on `arthur-w5-fanapp`:

| Folder | Contents |
|---|---|
| `src/kit/palette/` | `types.ts` (`TenantPalette`, `Mode`, `KitTokens`, `DecorParams`), `color.ts` (hex ↔ sRGB ↔ HSL, WCAG luminance and contrast, `mix`, `shiftHue`, `lift`, `onColor`), `resolve.ts` (`resolvePalette`), `cssVars.ts` (`tokensToCssVars`, `applyKitVars`), `presets.ts` (`PRIME_TIME` and the gallery's sample palettes) |
| `src/kit/type.css` | The type scale classes and `--k-fs-*` tokens |
| `src/kit/decor/` | One file per component plus `decor.css` |
| `src/kit/shell/` | `KitShell`, `TopBar`, `TabBar`, `useChromeVisibility`, `chromeReducer` |
| `src/kit/gallery/` | The `/kit` gallery entry (below) |
| `src/kit/**/__tests__/` | Vitest tests |

- **Every variable is prefixed `--k-`**, so nothing collides with the current app's `--primary`, `--team-soft`, `--hit` and the rest of `themeToCssVars`' 41 names.
- **`KitShell` applies the variables to its own root element, never to `:root`.** No existing screen can pick them up by accident.
- **The only edit outside `src/kit/`** is one branch in `src/main.tsx`: `pathname === "/kit"` lazily imports `src/kit/gallery/boot`, the way `/preview` boots.

**`DECOR-40` — Phase B: the pure half moves to the shared package.** On the shared repo's `arthur-w5-fanapp` branch, the React-free files (`palette/types.ts`, `color.ts`, `resolve.ts`, `cssVars.ts`, `presets.ts`) move to `obs-b2b-shared/src/theme/kit/` with their tests, because the console needs the same resolver for Brand v2's contrast readout, Auto chips and preset thumbnails ([`admin-brand-v2.spec.md`](admin-brand-v2.spec.md)). The fan app then imports them from `@b2b-shared/theme/kit`. The React components stay in the fan app except `DecorField`, `HeroBand`, `Chyron` and `Square`, which move to `obs-b2b-shared/src/ui/kit/` under the `src/ui/` purity rules in Phase B slice s0, because Brand v2's preset thumbnails render with them and the console never re-implements them (W5-D48). **Phase B: to build.** The move is a file move plus import rewrites; the tests move with the files and must pass unchanged.

**Existing shared colour maths is reused where it can be.** The Wave 3 hit rule (`contrastSafeHit`, `HIT_MIN_CONTRAST = 3`, `obs-b2b-shared/src/theme/resolve.ts`) is the kit's `--k-hit` rule. The kit imports it when importable and otherwise mirrors it with a comment citing it; after the Phase B move there is one copy.

---

## The palette

**`DECOR-26` — Two to four colours; Team and Accent are required** (W5-D24).

```ts
// src/kit/palette/types.ts
export interface TenantPalette {
  team: string;      // required, #RRGGBB
  accent: string;    // required, #RRGGBB
  second?: string;   // optional; Auto when absent
  live?: string;     // optional; Auto when absent
}
export type Mode = "dark" | "light";
```

| Role | Required | Auto value when absent | Drives |
|---|---|---|---|
| **Team** | yes | — | Hero band fill, primary buttons, active tab, hit glow (first candidate), BingoLine core, Medal 1, Track fill start, the photo fallback gradient's start |
| **Accent** | yes | — | Band hairline, accent chyrons ("Go Crazy", next tier), Burst rays, confetti, Scorebug underline, Brackets, Track fill end, Medal 3, the hit colour when Team fails |
| **Second** | no | Team with hue +18°, lightness moved away from the ground (W5-D42) | Double band's under-band, Stripes bar 2, DecorField strokes, GridTexture, Medal 2, the photo fallback gradient's end |
| **Live** | no | The mode's fixed live tone: dark `#FF3B5C`, light `#B3364B` (the shared `DEFAULT_LIVE`) | The LIVE chyron and its dot only |

- **`DECOR-03` — Auto Second is derived, never stored.** When `second` is absent the resolver computes it; Brand v2 stores nothing for it. The derivation is Team's hue +18°, same saturation, lightness moved **away from the ground** (W5-D42, which corrects W5-D24's "toward the ground"): lighter than Team in dark mode, darker in light mode. `second-ink` is then lifted to 3:1 on the ground like every other ink, so the derivation can never produce an invisible Second.
- **`DECOR-05` — Live is never decorative.** `--k-live` appears only in the `live` Chyron, its dot and the live square state.
- **Validation.** `resolvePalette` throws a typed `PaletteError` on a missing or malformed Team or Accent (`#RRGGBB`, case-insensitive). Callers never hand it user input unchecked: Brand v2 validates on entry, and the fan app maps a stored theme first (below).

### From today's stored theme (no data migration)

The kit reads the palette out of the existing `branding.theme` (`ThemeSettings`, `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts`), which the fan app already receives on `GET /b2b/org/:subdomain` as `organization.branding.theme`. The mapping is a pure load-time function, `paletteFromTheme(theme)`, in `src/kit/palette/` (Phase B, with the screens):

| Kit | Read from | When absent |
|---|---|---|
| `team` | `colors.primary` | `colors.primary` is required by the contract; a tenant with no `branding` gets the platform `DEFAULT_THEME` (`#E5E5E5`), as today |
| `accent` | `colors.accent` | `colors.secondary`, else `colors.primary` (today's resolver chain, `resolve.ts`), so every stored theme resolves. Brand v2 requires an explicit Accent before its next publish (`BRAND2-02`) |
| `second` | `colors.secondary` | Auto |
| `live` | `colors.live` | Auto |
| `mode` | `mode` | `dark` (the contract requires it) |
| decor params | `decor` (**Phase B: to build**, below), `shape.radiusBase` | Prime Time's params |

**`DECOR-39` — Load-time derivation only.** No stored theme is rewritten. Fields the kit does not read stay stored, validated and editable on main's Brand page, and are listed with their fate in [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md) ("Mapping from `ThemeSettings`"). In short: `colors.neutrals`, `type.*`, `surface.borderAlpha`, `surface.glowIntensity`, `shape.density`, `motif.heroMotif` and `motif.boardCounter` are not read by the overhaul.

---

## Tokens

**`DECOR-27` — `resolvePalette(palette, mode, decor?) => KitTokens` is the only thing that computes a colour.** Pure, deterministic, no DOM. `tokensToCssVars(tokens, decor)` turns the result into `--k-*` variables; `applyKitVars(el, vars)` sets them on one element and removes stale ones.

### Mode ramps

**`DECOR-23` (revised) — The ramps are platform-owned and fixed per mode.** They are not per preset and not tenant-editable. Values as specified for Phase A:

| Token | Dark | Light |
|---|---|---|
| `--k-ground` | `#0A0D14` | `#F6F7FA` |
| `--k-surface` | `#121722` | `#FFFFFF` |
| `--k-raised` | `#1A2130` | `#EEF1F6` |
| `--k-text` | `#F2F4F8` | `#12161F` |
| `--k-text-2` | `#B7BECC` | `#4E5A6E` |
| `--k-text-3` | `#7F8798` | `#7A8599` |
| `--k-hairline`, `--k-hairline-strong` | `rgb(158 178 208 / .16)`, `/ .30` | `rgb(31 42 61 / .12)`, `/ .24` |
| `--k-a-stroke`, `--k-a-fill`, `--k-a-glow`, `--k-soft-pct` | `.22`, `.10`, `.34`, `14%` | `.16`, `.07`, `.16`, `12%` |
| `--k-scrim`, `--k-shade` | `rgb(4 6 10 / .74)`, `rgb(0 0 0 / .35)` | `rgb(18 22 31 / .52)`, `rgb(18 22 31 / .08)` |

Dark text values are the kit brief's; the light ramp, hairlines, alphas, scrims and shades are `mocks\fanapp-v2\kit.css` lines 65–89.

The dark `--k-text-2` and `--k-text-3` are lighter than the mock's `#9FADC2` / `#66738A`, because the mock's third step measures 4.1:1 on the ground. **`DECOR-17` — Kit text meets 4.5:1** on what it sits on; `--k-text-3` is for non-text hairline labels and disabled states only, never for a line a fan must read. The resolver's tests are the source of truth for exact values: if the Phase A build lands different hexes, the tests win and this table is corrected at the Phase B rebase.

### Derived roles

| Token | Rule |
|---|---|
| `--k-team` | The raw Team colour (block fills: band, primary button) |
| `--k-team-ink` | `lift(team, ground, 3.0)`: Team moved in lightness, hue kept, until it clears 3:1 on the ground (lines, icons, borders on the ground) |
| `--k-team-text` | `lift(team, ground, 4.5)` (Team-coloured text on the ground) |
| `--k-on-team` | `onColor(team)`: near-black `#0A0D14` or white, whichever contrasts more (text on a Team block) |
| `--k-accent`, `--k-accent-ink`, `--k-accent-text`, `--k-on-accent` | The same four rules for Accent |
| `--k-second`, `--k-second-ink`, `--k-on-second` | The same rules for Second (resolved or Auto) |
| `--k-live`, `--k-on-live` | Live (resolved or Auto) and its on-colour |
| `--k-hit` | The first of `accent-ink`, `team-ink`, `second-ink` that clears 3:1 on `--k-surface`, else the best lifted (Wave 3's `contrastSafeHit` rule) |
| `--k-team-soft`, `--k-accent-soft` | The colour at `--k-soft-pct` over the ground |
| `--k-team-glow`, `--k-glow-ring` | Team-ink at `--k-a-glow`; the focus ring |
| `--k-success`, `--k-on-success` | Platform-owned per mode (`THEME-05` kept): dark `#3CCB7F`, light `#1E8A4F` |
| `--k-radius-card`, `--k-radius-control`, `--k-radius-chip`, `--k-radius-tag` | From the decor params (below) |
| `--k-intensity`, `--k-angle` | From the decor params |

**`DECOR-28` — Contrast guarding is code with tests.** For the four gallery palettes (Bears, Fighting Hawks, Test two-colour, the deliberately bad case where Team ≈ ground) in both modes, every guarded token meets its ratio: `team-ink`, `accent-ink`, `second-ink` ≥ 3:1 on ground; `team-text`, `accent-text` ≥ 4.5:1 on ground; every `on-*` ≥ 4.5:1 on its fill where the colour allows (the on-colour rule guarantees at least 4.36:1 for any colour, at the luminance where both inks tie); `hit` ≥ 3:1 on surface. Regression tests with a tolerance (ΔL ≤ 8) pin the mocks' hand-picked results: Bears dark `team-ink` near `#5B8BE0` and `team-text` near `#8FB0EC`; Fighting Hawks light `on-team` near-black.

---

## Decor params and the Prime Time preset

```ts
export interface DecorParams {
  intensity: number;              // 0–1, default 0.7
  angle: number;                  // degrees, default -5
  texture: "none" | "bingoGrid";  // default "none"
  radius: { card: number; control: number; chip: number; tag: number };
}
```

**`DECOR-37` — Prime Time is the one Overboard preset on the overhaul.** `PRIME_TIME` = intensity 0.7, angle −5°, texture none, radius 10 / 8 / 3 / 2 (card / control / chip / tag), accent default gold `#F5B32E` (the interface call Arthur accepted, `arthur-rulings-after-specs.md`, "The Prime Time accent is gold"). A preset carries decor params and a default accent; it never carries Team or Second (`THEME-08`). Club Level is not an overhaul preset: its identity was a serif face and an ivory ramp, and both are gone under Satoshi-only and platform ramps. A tenant who applied Club Level keeps its stored theme; the overhaul reads its colours and mode like any other.

**`DECOR-38` — Where the params are stored.** **Phase B: to build** in the shared contract, additive and optional:

```ts
// obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts, on ThemeSettings
decor?: { intensity?: number /* 0–1 */; angle?: number /* -12..0, whole degrees */ };
// THEME_TEXTURES widens from ["none", "dotgrid"] to ["none", "dotgrid", "bingoGrid"]
```

- `intensity` and `angle` are new (zod in `api/admin/branding.ts`, Mongoose `themeDecorSchema` in `models/b2b.ts`, `_id: false`, `default: undefined`). Absent means the preset's value.
- `texture` reuses `surface.texture`. The overhaul renders `bingoGrid` and `dotgrid` both as GridTexture (the kit has no dot grid), and `none` as none. Brand v2 writes only `none` or `bingoGrid`.
- `radius` reuses `shape.radiusBase` through the shared `radiiFromBase` (chip = max(2, round(B×0.35)), control = B, card = round(B×1.25)); tag is fixed at 2. Prime Time's base 8 gives 3 / 8 / 10. Brand v2 does not offer a radius control (W5-D27 Fine-tune is intensity, angle, texture), so `radiusBase` is whatever the tenant stored, else 8.
- `applyPreset` and `genericizeForGallery` (`obs-b2b-shared/src/theme/presets.ts`) copy `decor` by name (`DECOR-22`); without it, applying Prime Time would drop its params.
- **The angle is a Fine-tune setting** (W5-D43): −12° to 0°, default −5° (Prime Time), stored in `decor.angle`. The range keeps the band legible and inside the angle budget; Brand v2's slider offers it in whole degrees.

**`DECOR-06` (revised) — The angle budget.** Two angles exist. The band angle `--k-angle` (default −5°), shared by the HeroBand cut, its hairline, the double under-band and the DecorField fragments. The chyron's fixed `skewX(-10deg)`, shared by Chyron and Stripes. Nothing else tilts at rest. BingoLine (board geometry) and the rearrange jiggle (transient, W5-D14) are exempt.

**`DECOR-12` (revised) — Intensity scales linearly, 0 to 1.** Field pieces multiply the mode's stroke, fill and glow alphas by `--k-intensity / 0.7` (the mock's own formula, `kit.css` line 269): Prime Time's 0.7 is the reference strength, 1.0 is about 1.4× louder, 0 is off. At 0 the host mounts no DecorField, Burst or GridTexture. The desktop frame's decorative sides follow the same value.

---

## Type

**`DECOR-29` — Satoshi only** (ruling; W5-D25). Satoshi Variable is self-hosted in the fan app (`public/fonts/satoshi`, `src/styles/satoshi.css`, Wave 3). No Fontshare or Google Fonts request at runtime, no Barlow, no IBM Plex Mono, no Fraunces, no font option anywhere.

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
| `DecorField` | `full`, `corner`, `low`, `fixed`, `frame`; `intensity?` | Start, auth screens, paused, results podium, empty states, the desktop sides | Oversized 3×3 board fragments in Second at `--k-a-stroke`, one Team and one Accent filled cell, a soft Team glow; a column mask holds it to ≤0.12 effective alpha behind text (`DECOR-10`) |
| `HeroBand` | `single`, `double`, `compact` | One per screen at most (`DECOR-07`) | Team block, transparent cut at `--k-angle` (`DECOR-08`), Accent hairline on the cut, Second under-band in `double`; text upright, never counter-skewed |
| `Chyron` | `team`, `second`, `accent`, `live`, `neutral`, `success`; `sm`, `md`, `lg`; `dot` | Status (LIVE, OPEN, JOINED, OPENS …, CLOSED, FINAL), tier labels, ladder labels, REQUIRED/OPTIONAL | Text on a `skewX(-10deg)` pseudo-element; the `live` dot pulses only while mounted, and a screen mounts it only while a game is live |
| `GradientRule` | `rule`, `edge` | Section dividers, featured card edges | Team-ink to Accent-ink, 2px |
| `Stripes` | `corner`, `inline` | Contest card corner, section markers | Team, Second, Accent bars, `skewX(-10deg)` |
| `Scorebug` | `card`, `rail`; `status: upcoming \| live \| final`; `away`, `home`, `tipTime` | Contest detail games, live board rail, Start's next game | **`DECOR-18` — never a score.** Detail line: "Tip Sun 7:30 PM", "Live", or "Final" (ruling 2026-09-24: no score or clock feed) |
| `Track` | `value` 0–8 or absent; `stops: { at, label }[]` (one per tier of the contest; no fixed cap); `marker?` | Live board progress | `role="progressbar"`, `aria-valuenow`, `aria-valuetext` ("2 bingos. Next prize: Tier 2 at 3 bingos."); marker is the tenant's progress marker or a sponsor's slider icon (data), else a Team puck with the count |
| `Burst` | `play`; `intensity?` | Behind the prize image; behind first place on the podium | Plays once when `play` turns true |
| `Medal` | `1`, `2`, `3`, `tile` | Standings, results | Rank numeral is real text; ties share a medal |
| `GridTexture` | `intensity?` | Page texture when texture is on | 3×3 board tile in Second |
| `Brackets` | `live`, `justHit` | Live square (static), a square that just hit (transient) | Accent-ink corners |
| `BingoLine` | `lines: ("r1"…"d2")[]`, `fresh?` | Live board | Lines are the completed lines in the shared derived bingo function's output (W5-D40), never `claimedLineIndices`; index map in shared `BINGO_LINES` order: 0 r1, 1 r2, 2 r3, 3 c1, 4 c2, 5 c3, 6 d1 (top-left to bottom-right), 7 d2 (bottom-left to top-right); `fresh` lines draw in over 500ms |
| `Confetti` | `fire()` via ref, or `burst` prop | Prize popup | See `DECOR-33` |
| `Square` | `state: pick \| empty \| hit \| live \| miss \| void \| pending` (`void`: the miss treatment labelled "Void", `FLOW-27`); `photoUrl?`; `dim` (0.35 builder, 0.55 live); `locked?` (**Phase B addition**) | Builder, live board | See `DECOR-32` |

**`DECOR-32` — Photos behind squares, never initials** (ruling; W5-D11). `Square` renders `photoUrl` full-bleed behind its content with a ground scrim at `dim` (builder ~0.35, live board ~0.55). With no usable photo (no `photoUri`, `showPhotoUri === false`, or the image fails to load) it renders a Team → Second gradient wash with the jersey number large and the player's name. No initials render anywhere in the kit, and a test asserts no initials text in the DOM. `locked` (Phase B, for the builder and edit mode) adds a padlock and removes the square from rearrange (no jiggle, no drag, no drop target).

**`DECOR-33` — Confetti stays in the column** (ruling; W5-D21). JavaScript-generated: about 80 pieces, 1.8 s, gravity plus lateral drift, colours only `--k-team-ink`, `--k-second-ink` and `--k-accent`, every piece's start position inside the shell column's bounds. It renders inside `KitShell`, whose root has `overflow: clip`, so on desktop it never reaches the decorative sides. Under reduced motion it renders nothing and the Burst shows its end state.

**`DECOR-34` — No full-screen flash.** No component or screen paints a full-viewport colour flash (the current app's `PrizeModal` team-colour flash and S2's "flash when glow ≥ 0.5" are cut).

**`DECOR-19` — Budget.** Decor is inline SVG or CSS, under 4 KB of rendered markup per piece, no raster decoration and no CSS filter in the kit. Player photos, logos and sponsor artwork are data and exempt.

---

## The shell

**`DECOR-35` — `KitShell` is the mobile column with decorative sides.** Props: `palette`, `mode`, `decor`, `header?`, `footer?`, `children`.
- The column: `max-width: 480px`, `min-height: 100dvh`, centred, `overflow-x: clip` (and `overflow: clip` for confetti), `container-type: inline-size`, on `--k-ground`.
- At viewport widths of **900px and up**, a `DecorField` `frame` variant fills the viewport behind the column in the tenant's colours, and the column gets a hairline ring and `--k-shade`. Below 900px there are no sides. Nothing becomes multi-column at any width; there is no desktop layout (ruling: mobile only).
- It applies the resolved `--k-*` variables to its own root (`DECOR-25`).

**`TopBar`** (W5-D07): 56px plus the top safe-area inset. Left: back button or the tenant mark; centre: the title; right: the menu button (48×48, accessible name "Open menu"). Over a hero band it is transparent and uses `--k-on-team`; otherwise `--k-ground` at 92% with a backdrop blur and a hairline once the page has scrolled. Takes `hidden`.

**`TabBar`** (W5-D01): icon plus label items; the active item has a Team-ink icon and label and a 3px Team-ink top hairline segment; bottom safe-area inset; 48px minimum targets (`FAN-59`). Takes `hidden`. The icons are lucide-react (the app's icon set).

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

**`DECOR-13` — State-driven motion only; `DECOR-14` — reduced motion shows end states,** answered in the kit's own CSS and in its JavaScript (every JS animation checks the app's `prefersReducedMotion`, `src/lib/motion.ts`), not left to the app's global floor. **`DECOR-15` — Timing is not themed.** No preset or param changes a duration or curve.

---

## The `/kit` gallery

A separate entry on the Wave 5 branch (never on main): `KitShell` with a control strip (palette: Bears, Fighting Hawks, Test two-colour, Bad case; mode; intensity slider; angle), a token table with live contrast readouts (team-ink on ground, team-text on ground, on-team on team, hit on surface, each marked pass or fail), the type scale, every component in every variant, square states with a real photo URL and the no-photo fallback, Track at 0 / 2 / 5 / 8, every BingoLine, a Confetti trigger, and a long scrolling region with `TopBar` and `TabBar` to show hide-and-reveal. `?palette=bears&mode=dark` deep-links for screenshots. The sample palettes are labelled as samples in the control strip; they never reach a fan screen.

---

## Rules

Kept from S2 (renumbered only where noted): `DECOR-01`, `DECOR-03`, `DECOR-05`, `DECOR-06` (revised), `DECOR-07`, `DECOR-08`, `DECOR-09`, `DECOR-10`, `DECOR-11`, `DECOR-12` (revised), `DECOR-13` to `DECOR-20`, `DECOR-22`, `DECOR-23` (revised), `DECOR-24`. New: `DECOR-25` to `DECOR-40`.

- **DECOR-01 — Colour only from `--k-*` tokens** in `src/kit/decor/` and `src/kit/shell/`, enforced by a source-reading test.
- **DECOR-03 — Auto Second is derived, never stored.**
- **DECOR-05 — Live is never decorative.**
- **DECOR-06 — The angle budget:** `--k-angle` for the band system, fixed −10° skewX for chyrons and stripes, nothing else tilts at rest.
- **DECOR-07 — One band per screen.** `double` counts as one.
- **DECOR-08 — The band's cut is transparent**; no ground-coloured slab over the field or texture.
- **DECOR-09 — Mode-aware alpha** via `--k-a-stroke`, `--k-a-fill`, `--k-a-glow`, `--k-soft-pct`; no piece branches on mode.
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
- **DECOR-22 — Presets copy `decor`** through `applyPreset` and `genericizeForGallery` (Phase B).
- **DECOR-23 — Mode ramps are platform-owned**, one per mode.
- **DECOR-24 — No B2C colour or asset.** The fragment motif is the product's own 3×3 board. B2C mechanics (ladder, labels, points, rearrange) are behaviour, not look.
- **DECOR-25 — Phase A lives in `src/kit/`, prefixed `--k-`, applied on the shell's root, never `:root`.**
- **DECOR-26 — Two to four colours; Team and Accent required.**
- **DECOR-27 — `resolvePalette` is the only thing that computes a colour.**
- **DECOR-28 — Contrast guarding is code with tests** (ratios above; Bears and Hawks tolerance regressions; the bad case lifted).
- **DECOR-29 — Satoshi only, self-hosted.**
- **DECOR-30 — Numerals are tabular Satoshi.**
- **DECOR-31 — The gate word fits by container query.**
- **DECOR-32 — Photos behind squares, never initials;** `showPhotoUri === false` and load failures fall back to the gradient, jersey number and name.
- **DECOR-33 — Confetti is generated inside the column and clipped by it.**
- **DECOR-34 — No full-screen flash.**
- **DECOR-35 — `KitShell` is the 480px column; decorative sides from 900px; no multi-column layout.**
- **DECOR-36 — Hide-on-scroll follows the reducer table exactly.**
- **DECOR-37 — Prime Time is the one Overboard preset,** gold accent default.
- **DECOR-38 — Decor params are stored as an additive `decor { intensity, angle }` block plus the existing `surface.texture` and `shape.radiusBase`** (Phase B: to build).
- **DECOR-39 — Load-time derivation; no data migration.**
- **DECOR-40 — The pure palette half moves to `obs-b2b-shared/src/theme/kit/` in Phase B;** one copy of every colour rule.

### Retired from S2

| ID | Was | Why retired |
|---|---|---|
| DECOR-02 | Every new variable read with a fallback, for two hosts at two commits | One host (the fan app); `KitShell` always sets every token. |
| DECOR-04 | Accent and Live "Auto" are the preset's values, written at apply time | Accent is required (W5-D24); Live Auto is the mode's fixed tone, not the preset's. |
| DECOR-21 | `decor.band` wins over `motif.heroMotif` | There is no band on/off setting in Wave 5; bands are part of each screen's layout. `heroMotif` is not read. |
| S2 font pairings (`THEME_FONT_PAIRINGS`) | One font choice from five pairings | Satoshi only (ruling). |
| S2 `decor.field` / `decor.band` | Field on/off and band style as tenant settings | Not in W5-D27's Fine-tune; field strength is `intensity` (0 removes it). |
| S2 `withMode` and per-preset counterpart ramps | A mode flip swaps a preset's ramp | Ramps are platform-owned per mode (`DECOR-23`). |
| S2 twelve pieces in `obs-b2b-shared/src/ui/decor/` | Shared from the start | Phase A builds in the fan app; only the pure half moves (`DECOR-40`). |

---

## Function audit

### 1. Data sources and calls

| Surface | Data sources | Server calls on fan action | States covered |
|---|---|---|---|
| `KitShell` (every overhaul screen) | `GET /b2b/org/:subdomain` → `organization.branding.theme` (`mode`, `colors.primary/secondary/accent/live`, `shape.radiusBase`, `surface.texture`; `decor` once Phase B adds it), mapped by `paletteFromTheme` | None | No `branding` (platform default theme); stored theme without accent (derived); bad palette (lifted); dark and light; reduced motion; ≥900px sides |
| `Square` | The board or builder read's prop: `entityInfo.photoUri`, `entityInfo.showPhotoUri`, jersey, name ([`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md)) | None | Photo; `showPhotoUri: false`; no photo; photo fails to load; each state; locked (Phase B) |
| `Track` marker | `organization.branding.sliderTipImageUrl`; the game's `slider` sponsor holder's `sliderIcon` from the sponsor schedule read | None | Tenant marker; sponsor marker; neither (Team puck) |
| `Scorebug` | The game's `eventTime` and derived status (`deriveGameStatus`, Wave 3) | None | Upcoming, live, final; never a score |
| `/kit` gallery | Sample palettes in `src/kit/palette/presets.ts` (labelled samples) | None | Every palette, both modes, intensity 0–1, angle range |

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
| `?tenant`, `?mode`, variant switcher, `?preview=1` PREVIEW chyron (`kit.js`) | Cut | Mock chrome; the Wave 4 preview carries no marker (`PREV-09`) |
| Mini-board "live" square (`i.l`, accent) | Cut from the mini-board | W5-D23; the full board keeps its live state with Brackets |
| Locked square with padlock (`kit.html`) | Kept, as `Square` `locked` (Phase B) | Needed for per-square locks at tip-off |
| Fixed −5° angle | Changed to `--k-angle`, default −5° | W5-D27 Fine-tune offers the angle |

---

## Acceptance criteria

1. `resolvePalette` returns a complete `KitTokens` for 2-, 3- and 4-colour palettes in both modes; absent Second and Live resolve to Auto; a missing or malformed Team or Accent throws `PaletteError`.
2. For the four gallery palettes in both modes, every guarded token meets its ratio (`DECOR-28`), the bad case is lifted, and the output is deterministic across runs.
3. Bears dark lands within ΔL ≤ 8 of `team-ink #5B8BE0` and `team-text #8FB0EC`; Fighting Hawks light `on-team` is near-black.
4. Every key `tokensToCssVars` returns starts with `--k-`, none is undefined, and `applyKitVars` sets and clears them on one element; `document.documentElement` gains no `--k-` variable.
5. No file under `src/kit/decor/` or `src/kit/shell/` contains a colour literal (source test).
6. `chromeReducer`: scrolling down past 12px at ≥64px hides; scrolling up past 12px shows; below 64px never hides; overscroll is ignored; `reveal()` shows; the reduced-motion flag passes through to an instant transition.
7. Confetti: about 80 pieces, colours only from the three tokens, every initial position inside the given bounds; under reduced motion nothing renders.
8. `Square` with a photo renders it behind content at the given dim; with `showPhotoUri: false`, no `photoUrl`, or a failed load it renders the gradient, jersey and name; no initials text appears in the DOM in any case.
9. `KitShell` at 390px shows no sides; at 1280px shows the tenant-coloured sides and a centred 480px column; confetti fired at 1280px never paints outside the column.
10. No request to `fonts.googleapis.com`, `api.fontshare.com` or any font host other than the app's own origin, on any overhaul screen or the gallery.
11. The gallery renders every component and variant for Bears, Fighting Hawks, Test two-colour and the bad case in both modes; screenshots at 390 and 1280 go to `artifacts\w5\`.
12. The existing fan app suite, lint and build stay green with the kit added (Phase A adds no change to an existing screen).
13. Phase B: after the move, `obs-b2b-shared/src/theme/kit/` holds the palette files with their tests passing unchanged, and neither app keeps a second copy.

## Open questions

Decided since the first draft: auto Second's direction (W5-D42, `DECOR-03`), the band angle range (W5-D43, `DECOR-38`), the shared kit components (W5-D48, `DECOR-40`).

1. **Club Level on the overhaul.** Dropped as a preset (`DECOR-37`). Confirm no tenant relies on it for the Wave 5 demo.

## Recorded gaps

- **The light ramp** is the mock's and had not been measured by the Phase A tests at the time of writing; the tests are the source of truth.
- **Legacy tenants without an Accent** get the resolver chain's colour (Second, else Team) until an admin publishes an explicit Accent in Brand v2; a one-colour tenant looks one-colour until then.
- **`colors.neutrals` is ignored by the overhaul.** A tenant who hand-set page, card or text colours on main's Brand page sees the platform ramp on the Wave 5 branch.
- **Decor params have no storage until Phase B** (`DECOR-38`); until then every tenant renders Prime Time's params.
- **No resizing of player photos.** Photos load from PES's bucket at their stored size.

## Mocks

- `mocks\fanapp-v2\kit.html`, `kit.css`, `kit.js`, `_head.tpl` (workspace): the visual direction for every component. Their fonts, palettes-by-tenant, initials, scores and PREVIEW chyron are cut (function audit).
- Screen mocks placing the kit: `gate.html`, `board.html`, `prize.html`, `standings.html`, `results.html`.
- Phase A screenshots: `artifacts\w5\kit-*.png` (workspace), produced by the kit build.

## Supersessions (for the vault wrap; not written to the vault here)

`ArthurVault\projects\Overboard\b2b\charts\design.md`, for the Wave 5 branch only (main is unchanged):

1. **"Mobile-portrait only … zero `sm:`/`md:`/`lg:` breakpoints"** → one breakpoint, 900px, which adds only the decorative sides around the same 480px column.
2. **"The governing fact … `themeToCssVars` into 41 custom properties on `<html>`"** → overhaul screens paint from a second namespace, `--k-*`, resolved by `resolvePalette` and applied on `KitShell`'s root, never `<html>`.
3. **"Container by page family: `max-w-sm` … `max-w-lg`"** and **"Any state/status pill goes through `StatusBadge`"** and the `h-12 rounded-xl` CTA → one 480px `KitShell` column, `Chyron` for status, kit radii (control 8px) for buttons.
4. **"`HeroBand` … in `components/layout/`"** → `src/kit/decor/HeroBand`.
5. **"Do not port a b2c color or pattern"** → B2C *mechanics* are ported (line ladder and its labels, points, rearrange); no B2C colour or asset (`DECOR-24`).

Stale regardless of Wave 5, for the same wrap: "Type is Satoshi … a Fontshare `<link>` in `index.html:7`" (Satoshi has been self-hosted since Wave 3), and "dark-only" in "Relationship to the b2c app" (light mode exists).

## References

- Decisions: `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` (W5-D03, D11, D21, D24–D27, D42, D43, D48); kit brief `w5-kit.md` (workspace).
- Rulings: `artifacts\review-2026-09-27\arthur-rulings-2026-09-27.md` (Satoshi; Fan app overhaul), `artifacts\wave-2026-09-24\arthur-rulings-after-specs.md` (scorebug without scores; Prime Time gold).
- [`admin-branding.spec.md`](admin-branding.spec.md) (Wave 4 branch): the theme contract and `THEME-03`, `THEME-05`, `THEME-08`.
- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §4 (hit colour), §7 (Satoshi).
- Shared code: `obs-b2b-shared/src/theme/resolve.ts` (`contrastSafeHit`, `HIT_MIN_CONTRAST`, `DEFAULT_LIVE`, `radiiFromBase`, `resolveTheme`), `theme/presets.ts` (`PRIME_TIME_PRESET`, `applyPreset`, `genericizeForGallery`), `theme/color.ts`, `scoring/bingo-lines.ts` (`BINGO_LINES`), `interfaces/b2b/B2BOrganization.ts` (`ThemeSettings`).
- Fan app: `src/styles/satoshi.css`, `src/lib/motion.ts`, `src/main.tsx`, `src/components/layout/HeroBand.tsx`, `src/components/board/PrizeModal.tsx`.
- Siblings: [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md), [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md), [`../../webapp/fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md), [`../../webapp/fan-app-v2-console-touchpoints.spec.md`](../../webapp/fan-app-v2-console-touchpoints.spec.md).
