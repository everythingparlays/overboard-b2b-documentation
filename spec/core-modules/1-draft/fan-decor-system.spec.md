# Core Module Spec: Fan Decor System — Palette-driven decorative graphics

**Implements:** Arthur's 2026-09-24 rulings "Brand gets simpler" (a 2–4 colour palette that recolours standardised decorative graphics app-wide; light/dark that works) and "Fan app overhaul" (splash art, decoration and life, drawing on appv1 too), from `artifacts\wave-2026-09-24\WAVE-RULES.md`: the look, the palette, the decor kit, its accessibility and performance, and the mock tenants and ramps.

**Depends on:** [`admin-branding.spec.md`](admin-branding.spec.md) — the theme contract (v2), `THEME-03` (the resolver is the only thing that computes), `THEME-05` (status colours stay platform-owned) and `THEME-07` (directions are preset JSON with zero code). This spec extends that contract additively and keeps every one of those rules. [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md) — the admin page that edits the palette, the Decoration and Band controls and light/dark; it writes what this spec defines. [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md) and [`../../webapp/fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md) — the screens that place the pieces. [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) — the preview renders the same kit. Build order: [`../../../documents/HLDs/fan-app-v2-build-plan.md`](../../../documents/HLDs/fan-app-v2-build-plan.md), slice f1.

**Status:** Draft. Written by the S2 design seat, wave 2026-09-24. Prime Time's default accent is decided gold, with a veto window for Arthur (Open questions).

## Overview

The fan app gets a small, fixed set of decorative graphics — a splash field of bingo-grid fragments, the hero band, broadcast tags, rules, stripes, a scorebug, a progress track, a burst, medals, a grid texture, corner brackets and the bingo line — that every tenant shares and that recolour from the tenant's palette by construction.

**The whole change, in one line:** twelve shared components in `obs-b2b-shared/src/ui/decor/`, coloured only by theme CSS variables, plus an additive `decor` block and a `bingoGrid` texture on the theme contract, so "a team's app has life" is a property of the platform rather than per-tenant artwork.

**In scope:** the four palette roles and the one new derivation (auto Second); the six decor CSS variables; the `decor` contract block, its defaults, its back-compat mapping from `motif.heroMotif`, and the resolver changes; the twelve kit pieces with geometry, variants, motion and accessibility; the updated Prime Time and Club Level presets, their light and dark counterparts, and the acceptance fixtures; where the kit lives and who consumes it.

**Not in scope:** raster art of any kind; per-tenant custom artwork uploads other than the existing logo and slider marker; the admin theming UI, which is [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md); screen layouts and copy, which are the fan screen specs; the celebration profile (`theme/celebration.ts`), which is unchanged.

---

## Principles

A change can satisfy every rule below and still break one of these.

**Recolour from the palette by construction.** A kit piece reads colour only from CSS variables that `themeToCssVars` emits (`--primary`, `--secondary`, `--accent`, `--live`, their `-foreground` inks, the soft tints, the neutrals and the decor alphas). No hex, no `rgb()` literal, no Tailwind colour class, no `--tenant-*` alias appears in any file under `src/ui/decor/`. Because the variables are inherited, a piece placed inside any themed subtree — the fan app's `<html>`, the preview frame, a console preset thumbnail with the variables set inline — recolours with no prop.

**One band per screen, and a strict angle budget.** Exactly two angles exist in the fan app. The band's **-5°** (`skewY(-5deg)`), shared by the HeroBand cut, its hairline, its double under-band and the DecorField fragments, which are drawn as the band's own system. The chyron's **-10°** (`skewX(-10deg)`), shared by Chyron tags and Stripes. Nothing else tilts: no rotated cards, no angled rules, no tilted images. Two things are exempt because they are not decoration: the BingoLine (its angle is the board's geometry) and the board's rearrange jiggle (transient, state-driven, off under reduced motion). This is the console's rule too (`obs-b2b-admin-frontend/DESIGN.md`, Badges and "Don't skew anything beyond the chyron tags"; `src/styles/primetime.css:11-15`).

**Mode-aware alpha.** The same decorative colour reads stronger on a light ground than on a dark one, so decor alphas are set per mode: strokes 0.22 dark / 0.16 light, fills 0.10 dark / 0.07 light. The mode's pair is emitted as variables; a piece never branches on mode.

**Decor never sits behind body text above 0.12 alpha.** Cards are opaque surfaces, so body text inside a card never meets decor. Text set directly on the ground (the gate tagline, eyebrows, empty-state copy) sits where the effective decor alpha is at most 0.12. The DecorField enforces this with a mask over the content column (below).

**State-driven motion only.** Decor never moves on its own: no drift, no parallax, no ambient loop, no entrance reveal. Motion happens when game state changes — a line completes, a square hits, a prize lands — and plays once. The one loop is the LIVE dot's pulse, which runs only while a game is live (the console's rule, `DESIGN.md` Motion).

**The reduced-motion floor.** Under `prefers-reduced-motion: reduce`, every piece shows its end state with no animation: no draw-in, no burst, no flash, no pulse. The template's global floor (`overboard-b2b-template/src/index.css:275-284`) is not relied on, because the console hosts the kit too; `decor.css` ships its own reduced-motion answers.

**Inline SVG or CSS, under 4 KB per piece.** No raster decoration, no external asset, no icon library (`lucide-react` is forbidden in `src/ui/` by the purity test). A piece's rendered markup is at most 4 KB, measured by `renderToStaticMarkup`. At most one CSS filter on any screen; the kit itself uses none.

**Decoration fades; information never does.** The theme's decoration intensity scales the three field pieces (DecorField, Burst, GridTexture). The furniture pieces (HeroBand, Chyron, GradientRule, Stripes, Scorebug, Track, Medal, Brackets, BingoLine) carry status, progress or structure and always render at full strength. Turning decoration down must never make a LIVE tag or a progress rail fainter. So the `intensity` prop exists only where it scales something, and nowhere else.

---

## The palette roles

The palette is the four existing contract colour keys (decision). No colour migration.

| Role | Key | Required | Auto value when absent | Drives |
|---|---|---|---|---|
| **Team** | `colors.primary` | Yes | n/a | Hero band, primary CTA, hit glow, active chips, BingoLine core, Medal 1, Track fill start, filled field cell |
| **Second** | `colors.secondary` | No | Team shifted +18° in hue; HSL lightness ×0.88 in dark mode, or moved 10% of the way to white in light mode | Double under-band, stripe 2, DecorField strokes, GridTexture, Medal 2 |
| **Accent** | `colors.accent` | No | The preset's accent (written by `applyPreset`); with no preset, Second | Band hairline, Accent chyrons, the "Go crazy" rung, Burst rays, confetti sparks, stripe 3, Scorebug underline, Brackets, BingoLine flash, Track fill end, Medal 3 |
| **Live** | `colors.live` | No | The preset's live tone; with no preset, `DEFAULT_LIVE[mode]` (`resolve.ts:51-54`) | The LIVE chyron and its pulse only. Never decorative |

Grounds, surfaces and the text ramp are preset-owned and mode-aware. On-colours (`--primary-foreground`, `--secondary-foreground`, `--accent-foreground`, `--live-foreground`, `--on-team`) stay derived by measured contrast (`onColor`, `color.ts:153`).

**The one new derivation: auto Second.** Today an absent `secondary` falls back to `primary` (`resolve.ts:221`), so a tenant who names one colour gets decor in one colour. The resolver instead derives Second:

```
deriveSecond(primary, mode):
  { h, s, l } = toHsl(primary)
  h' = (h + 18) mod 360
  l' = mode === "dark" ? l * 0.88 : l + (1 - l) * 0.10
  return toHex(fromHsl(h', s, l'))
```

Relative steps rather than fixed points, so a dark Team never collapses to black. Examples, computed with the shared colour maths (`toHex` emits lowercase; the build pins the exact values by test): Fighting Hawks `#009A44` gives `#008864` dark and `#00be8d` light; the placeholder slate `#64748B` gives `#585c7a` dark and `#717699` light. `toHsl`, `fromHsl` and `deriveSecond` are new pure functions in `obs-b2b-shared/src/theme/color.ts`; Second is never stored when it is Auto (`THEME-03`).

The rule is mechanical, and one case is worth stating: a Team that already sits close to its ground gets an auto Second that does too. Bears navy `#0B162A` on the Prime Time dark ground measures 1.08:1, and its auto Second (`#0a0b25`) is no better. The kit is built so that such a tenant still has a visible band edge (the Accent hairline) and visible field fragments (Accent cell). The Brand v2 palette shows the Second swatch next to Team, so the admin sees it and can set one; the Bears mock does (`#C83803`).

**Accent and Live "Auto" are write-time, not resolve-time.** The stored theme does not record which preset it came from, so the resolver cannot know "the preset's accent". It does not need to: `applyPreset` already writes the preset's `accent` and `live` into `colors` (`presets.ts:120-123`), and Brand v2's "Reset to auto" writes them back. At resolve time an absent accent keeps today's chain (`accent ?? secondary`, `resolve.ts:222`), which now reaches the derived Second.

### The CSS variables the kit reads

Existing, from `themeToCssVars` (`resolve.ts:305-361`), all unchanged in name:

```
--background --card --surface-raised --foreground --text-secondary --border --border-strong
--primary --primary-foreground --secondary --secondary-foreground
--accent --accent-foreground --live --live-foreground
--team-soft --team-border --team-glow --on-team --glow-intensity
--radius --radius-chip --radius-card --font-display --font-body --font-numeric --display-weight
--texture --texture-size
```

`--secondary` is not new; what changes is its value when `colors.secondary` is absent (auto Second instead of Team). New, five variables, bringing the contract from 41 to 46:

| Variable | Value | Why |
|---|---|---|
| `--secondary-soft` | `withAlpha(secondary, dark ? 0.14 : 0.12)` | The Second counterpart of `--team-soft`, same ladder |
| `--accent-soft` | `withAlpha(accent, dark ? 0.14 : 0.12)` | The BingoLine cell flash and the Accent chyron's quiet form |
| `--decor-stroke` | `0.22` dark, `0.16` light | The mode's stroke alpha at full decoration |
| `--decor-fill` | `0.10` dark, `0.07` light | The mode's fill alpha at full decoration |
| `--decor-intensity` | The resolved `decor.intensity`, e.g. `"0.7"` | The theme's decoration strength; field pieces scale from it |

Field pieces compute their effective alpha in CSS, so mode and intensity both apply without JavaScript:

```css
.obs-decor-scaled {
  --k: min(1, calc(var(--decor-intensity, 0.6) / 0.7));   /* 0.7 ("Full") is the loudest decor gets */
  --stroke-a: calc(var(--decor-stroke, 0.22) * var(--k));
  --fill-a:   calc(var(--decor-fill, 0.10) * var(--k));
  --scale:    calc(0.8 + 0.2 * var(--k));
}
```

A piece's `intensity` prop overrides only `--decor-intensity` on its own root, so the Paused screen's quieter field is `intensity={0.3}` and nothing else. The same formula lives in `resolve.ts` as a pure `decorAlphas(mode, intensity)` so tests can assert it; a source-reading test pins the CSS to it.

Every one of these variables is read in `decor.css` **with a fallback**, and `overboard-b2b-template/src/index.css`'s "THEME CONTRACT DEFAULTS" block (`:163-190`) gains the five new defaults (`--secondary-soft: transparent; --accent-soft: transparent; --decor-stroke: 0.22; --decor-fill: 0.10; --decor-intensity: 0.6`). The fan app and the console vendor the shared package at different commits, and either can be a deploy behind; this is the entry gate's rule (`src/ui/entry-gate/__tests__/theme-contract.test.ts`), applied to the kit.

---

## Contract change (additive)

Types in `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts`. Every existing stored theme stays valid unchanged.

```ts
/** Background treatment for the page beneath the cards. */
export const THEME_TEXTURES = ["none", "dotgrid", "bingoGrid"] as const;        // was ["none", "dotgrid"] (:255)

/** The splash field behind a screen. */
export const THEME_DECOR_FIELDS = ["gridFragments", "none"] as const;
export type ThemeDecorField = (typeof THEME_DECOR_FIELDS)[number];

/** The hero band. Supersedes `motif.heroMotif`, which stays readable for back-compat. */
export const THEME_DECOR_BANDS = ["single", "double", "none"] as const;
export type ThemeDecorBand = (typeof THEME_DECOR_BANDS)[number];

/** Palette-driven decorative graphics. Every member optional; absent resolves to a default. */
export interface ThemeDecor {
  /** Default "gridFragments". */
  field?: ThemeDecorField;
  /** Absent: derived from `motif.heroMotif` when that is set, else "single". */
  band?: ThemeDecorBand;
  /** 0–1. Default 0.6. Admin steps: Off 0, Subtle 0.35, Full 0.7. Values above 0.7 render as 0.7. */
  intensity?: number;
}

export interface ThemeSettings {
  // mode, colors, type, shape, surface, motif — unchanged (:294-339)
  /** Absent means the platform defaults: gridFragments, band from motif else single, 0.6. */
  decor?: ThemeDecor;
}
```

The zod schema (`src/api/admin/branding.ts:83-97`) gains the block beside `motif`; `texture` widens automatically because it reads `THEME_TEXTURES`:

```ts
decor: z.object({
  field: z.enum(THEME_DECOR_FIELDS).optional(),
  band: z.enum(THEME_DECOR_BANDS).optional(),
  intensity: z.number().min(0).max(1).optional(),
}).optional(),
```

The Mongoose model (`src/models/b2b.ts:144-162`) gains `themeDecorSchema` with the same three fields (enums from the same arrays, `min: 0, max: 1`, `_id: false`) and `decor: { type: themeDecorSchema, required: false, default: undefined }` on `themeSettingsSchema`. The new `as const` arrays join the re-export list at `:469-471`.

**Back-compat mapping for the band.** `motif.heroMotif` is kept and still validated. The resolved band is:

| `decor.band` | `motif.heroMotif` | Resolved band |
|---|---|---|
| set | anything | `decor.band` (it wins) |
| absent | `"angledBand"` | `"single"` |
| absent | `"none"` | `"none"` |
| absent | absent | `"single"` |

So a tenant who chose "no band" under the old control keeps no band, and a tenant who never chose gets the new default. Brand v2 writes both fields together (`single`/`double` → `heroMotif: "angledBand"`, `none` → `"none"`), so a fan build one deploy behind, still reading `heroMotif`, shows a band whenever the new one does.

**Resolver changes** (`obs-b2b-shared/src/theme/resolve.ts`):

1. `THEME_DEFAULTS` (`:36-48`) gains `decorField: "gridFragments"`, `decorBand: "single"`, `decorIntensity: 0.6`.
2. New export `DECOR_ALPHA: Record<ThemeMode, { stroke: number; fill: number }> = { dark: { stroke: 0.22, fill: 0.1 }, light: { stroke: 0.16, fill: 0.07 } }`, and `decorAlphas(mode, intensity)` returning `{ stroke, fill, scale }` by the formula above.
3. `secondary = theme.colors.secondary ?? deriveSecond(primary, mode)` replaces `?? primary` (`:221`). The accent chain is untouched.
4. `ResolvedTheme.colors` gains `secondarySoft` and `accentSoft`; `ResolvedTheme` gains `decor: { field, band, intensity }`, with the band resolved by the table above. `motif.heroMotif` still resolves as before.
5. `texture === "bingoGrid"` emits `--texture` as an SVG data URI (the GridTexture tile below, stroked in the resolved Second as `rgb(r g b / a)` so the URI carries no `#`, alpha `DECOR_ALPHA[mode].fill × 0.5` = 0.05 dark / 0.035 light) and `--texture-size: 120px 120px`.
6. `themeToCssVars` emits the five new variables. The comment block at `:292-304` and `admin-branding.spec.md`'s "fixed interface" list are updated to 46 names.

**Preset plumbing** (`src/theme/presets.ts`). `applyPreset` (`:133-140`) and `genericizeForGallery` (`:155-162`) copy blocks by name, so each gains `...(preset.decor ? { decor: { ...preset.decor } } : {})`. Without it, applying Prime Time would silently drop its decor.

**Hosts stop reading the motif directly.** `StartScreen.tsx:33` and `BoardPage.tsx:388` compute `theme.motif?.heroMotif === "angledBand"` themselves. After this change they read `resolveTheme(theme).decor.band`; a host computing a theme value is the drift `THEME-03` forbids.

---

## The kit

Twelve pieces. Each root carries a class `obs-decor-<name>` styled in `decor.css`; class names are joined with a local `cx` helper (the entry gate's pattern, since `clsx` and `tailwind-merge` are forbidden in `src/ui/`). Every piece takes `className` and forwards it. Pieces never consult the theme object: the caller decides whether a piece mounts (the existing HeroBand's principle, `HeroBand.tsx:23-25`), and the piece paints from variables.

Accessibility default: the ornament layers of every piece are `aria-hidden="true"`, `pointer-events: none`, and SVGs carry `focusable="false"`. Four pieces carry text or state and are exposed to assistive technology: **Chyron, Track, Medal, BingoLine**. Two pieces wrap content (HeroBand, Scorebug); they hide only their ornament, and their content is ordinary readable text.

### 1. DecorField — the splash field

**Purpose.** Life behind a screen: oversized fragments of the product's own 3×3 board. **Where:** Gate, Sign-in/up, Verify, Forgot password, Join, Paused, Results podium, Home empty state, and the desktop frame at ≥ 900px on every screen.

**Anatomy.** A fragment is a 3×3 grid of rounded squares: cell 72px, gap 12px (fragment 240×240), stroke 6px, corner radius 16px, strokes in Second at `--stroke-a`. Two fragments per field, both `skewY(-5deg)` about their centres, both scaled by `--scale`. One cell in the whole field is filled Team and one filled Accent, at `--stroke-a` (a filled cell is the fragment's "hit"). A soft Team glow sits at the top: `radial-gradient(ellipse 70% 45% at 50% 0%, var(--primary), transparent 70%)` on a layer at opacity `0.12 × --k` dark, `0.08 × --k` light.

```
 full variant, 390 x 844 phone              corner variant (auth forms)
 +----------------------------------+       +----------------------------------+
 |[ ][ ][ ]    . glow (Team) .      |       |                   [ ][ ][ ]      |
 |[ ][T][ ]   A: top-left, bleeds   |       |                   [ ][ ][A]      |
 |[ ][ ][ ]   off top and left      |       |   fragment A only, top-right,    |
 |      :                     :     |       |   scale 0.75, no bottom fragment |
 |      : content column mask :     |       |      :                    :      |
 |      : (field at 40% here) :     |       |      :   auth card        :      |
 |      :                     :     |       |      :                    :      |
 |                    [A][ ][ ]     |       +----------------------------------+
 |                    [ ][ ][ ]     |
 |   B: bottom-right, bleeds off    |       T = cell filled Team
 +----------------------------------+       A = cell filled Accent
```

Fragment A's box starts at (-96px, -40px), so roughly its right two columns show; its centre cell is the Team cell. Fragment B's box starts at (viewport width − 150px, viewport height − 190px); its top-left cell is the Accent cell. At ≥ 900px both fragments scale ×1.6 (cell 115px) and anchor to the viewport corners, and the column sits centred on them.

**The column mask.** A horizontal `mask-image` holds the field at 40% strength across the content column (the middle 480px plus 16px gutters on desktop; the middle 70% of a phone viewport) with a 48px feather each side. Worst case under text: stroke 0.22 × 1 × 0.4 = 0.088, glow 0.12, both at most 0.12.

**Variants.** `full` (gate, paused, podium, desktop frame) and `corner` (auth forms: fragment A only, at the top-right, scale 0.75, glow halved). **Props:** `variant`, `intensity?`, `contain?` (default false: `position: fixed; inset: 0; z-index: -1` behind the page; true: `position: absolute` inside its parent, for preset thumbnails and preview frames). **Light mode:** the alphas drop to the light pair automatically; nothing else changes. **Motion:** none, ever. **Accessibility:** wholly `aria-hidden`. **Budget:** two fragments of nine `<rect>`s each, about 1.4 KB.

### 2. HeroBand — the broadcast band (exists; moves and extends)

**Purpose.** The one angled gesture per screen. **Where:** Gate ("{Tenant} BINGO"), Join, contest detail, live board header, when the resolved band is not `none`. The screen specs choose `single` or the theme's band.

**Anatomy.** A full-bleed block of Team (the 16px gutter is cancelled with negative margins, as today) with content on it in `--on-team`. The base is a -5° cut rising to the right. The cut is **transparent**: whatever sits behind the band (ground, texture, DecorField) shows through it. Measured at the band's right edge, from the bottom:

```
 single                                   double
 ................ TEAM .................   ................ TEAM .................
 ..................................____   ..................................____
 .............................____ACCENT   .............................____ACCENT (4px)
 ........................____ 4px  ___/   ........................____SECOND (10px)
 ___________________/ ground/field        ___________________/ ground/field
 cut: 58px above the bottom at the         Team edge 72px up at the right; Accent
 right edge, falling 5 degrees leftward    hairline beneath it; Second 10px lower
```

- Cut line: 58px above the bottom at the right edge, falling at 5° toward the left (so about 24px at the left of a 390px band and 13px at the left of a 512px desktop band).
- Accent hairline: 4px, on the same angle, directly above the cut.
- `double` adds a 10px Second under-band between the hairline and the cut: the Team edge moves up 14px (4px hairline + 10px Second) and the ground cut stays where it was. This is the "double chyron".
- Bottom padding for content: 68px (`single`), 80px (`double`), so no glyph reaches the cut at the widest column.

**Technique.** Each layer (Team, Accent, Second) is a full-size block masked with `linear-gradient(175deg, #000 calc(100% - N), transparent calc(100% - N + 1px))`. A 175° gradient's stop line sits at exactly -5° at any width, anchored at the bottom-right corner, and the 1px soft stop antialiases the edge. Layers stack Team over Accent over Second, each masked 4px or 10px lower than the one above. This replaces today's ground-coloured skewed slab (`HeroBand.tsx:35-39`), which paints a flat patch of `--background` over any texture or field behind the band.

One more fix rides along. By the numbers, today's Accent hairline (`HeroBand.tsx:41-45`: `bottom: -24px`, 4px tall, inside `overflow: hidden`) sits 20–24px below the band's own box at its centre and is clipped, showing at most a sliver at the raised right end. The kit places the hairline on the cut. That matters most for exactly the tenants the hairline exists for: a navy Team on the Prime Time ground (1.08:1) has no visible band edge without it.

**Variants:** `single`, `double`. **Props:** `variant`, `children`, `className`. No `intensity`: the band is furniture. **Light mode:** identical geometry; on a light ground the transparent cut shows the light ground. **Motion:** none. **Accessibility:** layers `aria-hidden`; children are the screen's heading and stay upright and unskewed (no counter-skewed text, which blurs on non-retina displays, `HeroBand.tsx:18-22`). **Budget:** CSS only, three empty divs.

**Location.** Moves to `obs-b2b-shared/src/ui/decor/HeroBand.tsx`, rewritten with `decor.css` classes instead of Tailwind utilities (which `src/ui/` cannot rely on in the console). `overboard-b2b-template/src/components/layout/HeroBand.tsx` becomes a one-line re-export so existing imports keep working.

### 3. Chyron — the broadcast tag

**Purpose.** Short status and label text on a raked block. **Where:** status (LIVE, OPEN, JOINED, OPENS SUN 10:00, FINAL, CLOSED), tier labels (TIER 2 · 3 BINGOS), REQUIRED/OPTIONAL on consents, ladder difficulty (Likely / 50-50 / Go crazy), the PREVIEW tag in preview mode, the scorebug's status, the Track's tier names.

**Anatomy.** The element is the text; a `::before` block behind it is `skewX(-10deg)`, radius 2px, with `isolation: isolate` so the block sits behind the words (the console's construction, `primetime.css:38-52`). Text: `--font-display`, weight 600, always uppercase, tracking 0.08em. Size `md`: 22px tall, 12px text, padding 0 9px. Size `sm`: 18px tall, 11px text, padding 0 7px.

| Variant | Block | Text | Typical use |
|---|---|---|---|
| `team` | `--primary` | `--on-team` | OPEN, REQUIRED, "50-50", a reached tier |
| `accent` | `--accent` | `--accent-foreground` | Tier labels, "Go crazy", the next tier to reach |
| `live` | `--live` | `--live-foreground` | LIVE only, with a 6px dot in `--live-foreground` before the word |
| `neutral` | `--surface-raised` + 1px inset `--border-strong` | `--foreground` | FINAL, CLOSED, OPENS …, OPTIONAL, "Likely", PREVIEW |
| `success` | platform `--success` | platform `--success-foreground` | JOINED only (a real state; `THEME-05`) |

**Props:** `variant`, `size`, `children`. **Light mode:** the same variables; `neutral` sits on the light raised surface. **Motion:** the `live` dot pulses (2s ease-in-out, opacity 0.6 → 1, scale 1 → 1.15, infinite) while mounted; the screen mounts a `live` chyron only while a game is live. Reduced motion: the dot holds at full opacity. **Accessibility:** the text is real text and is read; the block is a pseudo-element. Contrast: text meets 4.5:1 on its block for every preset and mock tenant, by test. The on-colour rule guarantees at least 4.36:1 for any colour (the worst case, at the luminance where dark ink and white tie); Brand v2's contrast readout flags a Team, Second or Accent whose best ink is under 4.5:1. **Budget:** CSS only.

### 4. GradientRule

**Purpose.** A 2px line from Team to Accent. **Where:** section dividers; the top edge of a "featured" card (the live contest card, the next prize). **Anatomy:** height 2px, `linear-gradient(90deg, var(--primary), var(--accent))`. **Variants:** `rule` (block, full width, 16px vertical margin) and `edge` (absolute at the top of a card, inside the card's radius clip, so it costs no layout). **Props:** `variant`. **Light mode:** unchanged. **Motion:** none. **Accessibility:** `aria-hidden` (a divider here is visual; structure comes from headings). **Budget:** CSS only.

### 5. Stripes

**Purpose.** A small raked three-colour tag. **Where:** the top-right corner of contest banner cards (12px inset); the marker before the "Your boards" rail heading.

**Anatomy.** Three bars, 3px wide, 16px tall, 3px apart, `skewX(-10deg)` (the chyron's angle, inside the budget), coloured Team, Second, Accent at full strength. Box about 18×16px.

```
  / / /      bar 1 --primary, bar 2 --secondary, bar 3 --accent
 / / /       3px bars, 3px gaps, 16px tall, skewX(-10deg)
```

**Variants:** `corner` (absolute, top-right) and `inline` (inline-block, 8px right margin). **Props:** `variant`. **Light mode:** unchanged. **Motion:** none. **Accessibility:** `aria-hidden`. **Budget:** CSS only.

### 6. Scorebug

**Purpose.** A game at a glance, as a broadcast lower-third. **Where:** the Gate's next game; Home's LIVE NOW card; contest detail game rows; the live board's scorebug rail.

**Anatomy.** The console's scorebug at fan scale (`DESIGN.md`, Live strip): background `linear-gradient(90deg, var(--surface-raised), var(--card))`, 1px `--border` hairline, a 2px Accent underline drawn as `box-shadow: inset 0 -2px 0 var(--accent)` (so it never wipes the card's own edge), corners `var(--radius) var(--radius) 2px 2px` (8 8 2 2 on Prime Time, as in the console), padding 10px 12px. Left: a `sm` Chyron for the state. Then the matchup, "AWAY @ HOME" with optional 20px team logos, in `--font-display` 17px/600 following the theme's display transform. Under it the detail line in `--font-numeric` 11px/500, uppercase, tracking 0.12em, `--text-secondary`.

```
 +-----------------------------------------------+   corners: radius radius 2px 2px
 | /LIVE/  AWAY TEAM @ HOME TEAM                 |   matchup: display face 17/600
 |         Q3 . 4:12 . 24-17                     |   detail: numeric 11/500, +0.12em
 +===============================================+   2px Accent underline (inset)
```

**The detail line never invents a score.** It shows score, period and clock only when the game record carries them (a `BetEvent.eventDetails` feed, which does not exist today). Otherwise it is status: "TIP SUN 7:30 PM" (upcoming, no chyron), "LIVE" beside a `live` chyron, or "FINAL" beside a `neutral` FINAL chyron.

**Variants:** `card` (full width) and `rail` (min width 220px, for the live board's horizontal rail). **Props:** `variant`, `status: "upcoming" | "live" | "final"`, `away`, `home` (name and optional logo URL), `tipTime`, `details?` (`{ score?, period?, clock? }`). **Light mode:** the gradient runs light raised to white. **Motion:** only the LIVE chyron's pulse. **Accessibility:** the matchup and detail are text; the underline and gradient are CSS. **Budget:** CSS plus the Chyron.

### 7. Track — the 0–8 bingo progress rail

**Purpose.** How many bingos a board has and where the prize tiers sit, as a broadcast timeline. **Where:** live board (horizontal); contest detail prize ladder (vertical).

**Anatomy, horizontal.** A 4px rail, radius full, `--surface-raised`, inset 14px each side. Positions 0–8 are evenly spaced; tier stops sit at their bingo count. The fill runs from 0 to the current count in `linear-gradient(90deg, var(--primary), var(--accent))`. Stops are 14px circles: reached ones filled Team with a check in `--on-team` (inline SVG path); unreached ones `--card` with a 2px `--border-strong` ring. Above each stop is a `sm` Chyron with the tier name (`team` when reached, `accent` for the next tier to reach, `neutral` beyond it). Below it is "N BINGOS" in `--font-numeric` 10px, tracking 0.1em, `--text-secondary`. The marker is a 28px circle with a 2px `--card` ring on the rail at the current count: the tenant's slider marker image (or the game's sponsor slider image, where one holds that slot) cropped to cover, or, with no image, a Team puck with the count in `--on-team`.

```
          TIER 1              TIER 2                         TIER 3
            |                   |                              |
  0 ========(v)=======(M)-------( )------------------------------( )------ 8
  Team -> Accent fill to 2      M = marker at 2 bingos
          1 BINGO             3 BINGOS                       6 BINGOS
```

When two tier labels would overlap (adjacent counts), the later one moves up one row (22px). Tier names over 14 characters truncate with an ellipsis; the full name is in the accessible text.

**Vertical variant.** For the prize ladder: the rail runs down the left, one stop per tier in tier order (evenly spaced, not by count), and each stop's row content (name, "N bingos", image, "Provided by") comes in as `children` from the screen. With no board yet, there is no marker and no stop is reached.

**Props:** `orientation`, `value` (0–8, or absent for no board), `tiers` (`{ name, bingos }[]`, up to three), `marker?` (image URL). **Light mode:** unchanged variables. **Motion:** when `value` changes, the fill and marker move over 400ms `cubic-bezier(0.22, 1, 0.36, 1)` and a newly reached stop's check fades in over 200ms. Reduced motion: they jump. **Accessibility:** the root is `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax="8"`, `aria-valuenow`, `aria-label="Bingo progress"`, and `aria-valuetext` such as "2 bingos. Next prize: Tier 2 at 3 bingos." (or "8 bingos. Every prize reached."). Its children are presentational. **Budget:** CSS plus one check path, under 1 KB.

### 8. Burst

**Purpose.** A moment of arrival behind the thing just won. **Where:** behind the prize image in the prize popup; behind the winner on the final podium.

**Anatomy.** An SVG of 24 wedge rays from radius 18% to 100%, each 6° wide on a 15° period, alternating Team and Accent, at fill opacity `--stroke-a`. A radial mask holds full strength to 55% of the radius and fades to 0 at 100%. The burst's radius is 0.8× the object's size (a 160px prize image gets a 256px burst). The headline under the image starts at no less than 75% of the radius, where the mask has brought the rays to 0.12 or less. **Props:** `play` (the caller sets it when the state arrives: the award event, the podium's first render after finalisation), `intensity?`. **Light mode:** the light alpha pair. **Motion:** once, when `play` turns true: scale 0.6 → `--scale` and opacity 0 → 1 over 600ms `cubic-bezier(0.22, 1, 0.36, 1)`. No rotation, no loop. Reduced motion: rendered at its end state. **Accessibility:** `aria-hidden`. **Budget:** 24 short paths, about 1.6 KB.

### 9. Medal

**Purpose.** Rank at a glance. **Where:** standings rows, the podium, the "Your result" card.

**Anatomy.** A square tile, radius `--radius-chip`, the numeral in `--font-numeric` weight 700. Rank 1: Team fill, `--on-team` numeral. Rank 2: Second, `--secondary-foreground`. Rank 3: Accent, `--accent-foreground`. Rank 4 and beyond: transparent with a 1px `--border-strong` hairline and a `--text-secondary` numeral. Ties share a medal: two players tied for second both get the Second tile. Size `row`: 28px tile, 15px numeral. Size `podium`: 48px tile, 24px numeral. **Props:** `rank`, `size`. **Light mode:** unchanged. **Motion:** none. **Accessibility:** the numeral is real text; the row supplies the context ("Rank 2"). Contrast of each numeral on its fill is covered by the same test as the chyrons. One known edge: an auto Second in the mid-luminance band can land just under 4.5:1 (Fighting Hawks' auto Second `#008864` measures 4.46:1 with white), which is one more reason the Brand v2 readout flags it. The Hawks mock sets Second explicitly (`#1B5E3C`, 7.74:1). **Budget:** CSS only.

### 10. GridTexture

**Purpose.** A faint repeating 3×3 board as a page texture. **Where:** the body, when `surface.texture` is `bingoGrid`; and, as a component, any surface that is not the body (preview frames, preset thumbnails).

**Anatomy.** A 120×120px tile holding one 84×84px board at (18, 18): three 26px cells a row with 3px gaps, radius 5, stroke 1.5px in Second. Alpha: `--decor-fill × 0.5` (0.05 dark, 0.035 light). The body texture is emitted by the resolver as a data URI (Resolver changes, item 5). The component draws the same tile inline as an SVG `<pattern>` (id from React `useId`) so it recolours from variables where a data URI cannot. **Props:** `intensity?` (component only; the body texture follows the theme's texture setting, not decoration intensity, because Texture is its own Fine-tune control). **Light mode:** the light alpha. **Motion:** none. **Accessibility:** `aria-hidden`. **Budget:** about 0.6 KB.

### 11. Brackets

**Purpose.** Broadcast corner brackets that say "watch this". **Where:** the live contest card on Home; a live square on the board (static); a just-hit square (transient).

**Anatomy.** Four L-shaped corners, 2px Accent strokes, square caps, arms 10px on squares and 12px on cards, set 3px outside the element's box. **Variants:** `live` (static, while the state holds) and `justHit` (transient). **Props:** `variant`, `onDone?` (for `justHit`). **Light mode:** unchanged. **Motion:** `justHit` fades and settles in over 200ms (opacity 0 → 1, scale 1.06 → 1, ease-out), holds 1200ms, fades out over 400ms, then calls `onDone`. Reduced motion: shown for 1600ms with no transition, then removed. **Accessibility:** `aria-hidden`; the square's own label carries its state. **Budget:** four paths, under 0.5 KB.

### 12. BingoLine

**Purpose.** Draws each completed bingo through its three squares. **Where:** the live board grid, as one overlay over all eight possible lines.

**Anatomy.** One SVG over the grid (viewBox in grid units), one line per completed bingo, from cell centre to cell centre and extended 18% of a cell past each end. Each line is three strokes with round caps: a 16px glow underlay in `--team-glow` at opacity `var(--glow-intensity)` (so a flat theme at glow 0 draws no glow and needs no filter); a 10px casing in `--on-team`; and a 6px core in `--primary`. Casing and core are the Team button pair, so the line always separates from what it crosses at the on-colour's measured contrast, even for a navy team on a navy ground. Strokes use `vector-effect: non-scaling-stroke`.

**Props:** `lines` (the completed line ids), `fresh?` (line ids completed in this session's latest update). **Light mode:** unchanged variables. **Motion:** a line in `fresh` draws in over 500ms (stroke-dashoffset, `cubic-bezier(0.33, 1, 0.68, 1)`). When it finishes, its three cells flash once: an inset 2px `--accent` ring and an `--accent-soft` fill fading from 1 to 0 over 1000ms ease-out. Lines already complete on load render static, and nothing replays on refresh. Reduced motion: drawn complete, no flash. **Accessibility:** `role="img"` with a label naming the lines, e.g. "2 bingos: top row, left column" (line names: top row, middle row, bottom row, left column, middle column, right column, diagonal from top left, diagonal from top right). The polite live region announcing "Bingo! 2 of 8" belongs to the board screen, not to this piece. **Budget:** at most 24 `<line>`s, under 2 KB.

### Motion, in one table

| Piece | Trigger | Duration and easing | Reduced motion |
|---|---|---|---|
| Chyron `live` dot | Mounted while a game is live | 2s ease-in-out, infinite | Solid dot |
| Track fill, marker | `value` changes | 400ms `cubic-bezier(0.22, 1, 0.36, 1)` | Jumps |
| Burst | `play` turns true | 600ms `cubic-bezier(0.22, 1, 0.36, 1)`, once | End state |
| Brackets `justHit` | A square hits | 200ms in, 1200ms hold, 400ms out | Static 1600ms, then gone |
| BingoLine | A line is in `fresh` | 500ms draw, then 1000ms cell flash | Drawn, no flash |
| Everything else | n/a | No motion | n/a |

Timing is not themed: no preset or intensity changes a duration or curve (the console's Timing-Is-Not-Themed rule).

---

## Presets

The two shipped presets gain `decor`. Only the changed members are shown; everything else stays as in `presets.ts:33-91`.

```ts
export const PRIME_TIME_PRESET: ThemeSettings = {
  mode: "dark",
  colors: {
    primary: PLACEHOLDER_PRIMARY,
    accent: "#F5B32E",   // was #FF5722; decided gold (Open questions: veto window)
    live: "#FF3B5C",
    neutrals: { /* unchanged: #0A0D14, #121722, #1A2130, #F2F5F9, #9FADC2, #66738A, #9EB2D0 */ },
  },
  // type, shape unchanged
  surface: { borderAlpha: 0.1, texture: "none", glowIntensity: 0.35 },   // bingoGrid texture off
  motif: { heroMotif: "angledBand", boardCounter: "numeral" },
  decor: { field: "gridFragments", band: "double", intensity: 0.7 },
};

export const CLUB_LEVEL_PRESET: ThemeSettings = {
  // mode, colors, type, shape, surface unchanged
  motif: { heroMotif: "angledBand", boardCounter: "numeral" },   // was "none"; kept in step with decor.band
  decor: { field: "gridFragments", band: "single", intensity: 0.35 },
};
```

Club Level's `heroMotif` moves to `angledBand` so the legacy field and the new one never disagree in shipped data.

**The acceptance-fixture rule.** `THEME-07` still holds: every direction is JSON, with zero per-direction code, and the direction tests read `themeToCssVars(fixture)` and `resolveTheme(fixture)` only. From this spec on, **every direction test asserts decor**: the resolved `field`, `band` and `intensity`, the five new variables, and the texture. `src/theme/__tests__/fixtures/directions.ts` changes:

- `primeTimeBears` gains `decor: { field: "gridFragments", band: "double", intensity: 0.7 }` and `accent: "#F5B32E"`.
- `clubLevelWarriors` gains `decor: { field: "gridFragments", band: "single", intensity: 0.35 }` and `heroMotif: "angledBand"`.
- `signalFightingHawks` and `floodlightBbgs` carry **no** `decor` block, on purpose: they are the fixtures that prove the defaults and the back-compat mapping. Both resolve to `gridFragments` / `none` (from their explicit `heroMotif: "none"`) / 0.6.
- A new export `MODE_COUNTERPARTS` holds `primeTimeBearsLight` and `clubLevelWarriorsDark`, built with `withMode()` (below). It stays separate from `DIRECTIONS`, so "are four" (`direction-acceptance.test.ts:243-245`) still means four looks.

Assertions that change because of the auto Second: `direction-acceptance.test.ts:150` (Signal's `--secondary` becomes `#008864`), `:208-209` (Floodlight's `--secondary` and `--accent` both become the derived `#e8a706`), `:249` (41 → 46 variables), and `:126-129` (Club Level now carries a band). Elsewhere: `resolve.test.ts:18-21` and `:206` (the "secondary falls back to primary" alias becomes the derived Second) and its variable list (`:228-270`, plus five), and `presets.test.ts:58`. Legacy parity (`legacy-parity.test.ts`) is unaffected, because every legacy seed stores a secondary (`legacy.ts:42`) and the parity test compares only v1's keys.

---

## Light and dark

"Light/dark that works" has to be true for every preset, and today it is not. Brand v2's Light or dark control sets `mode`, but a preset's `neutrals` are stored explicitly and the resolver uses them whatever the mode (`resolve.ts:179-192`). Flip a Prime Time tenant to light today and they get a navy-black page in light mode. Each shipped preset therefore gets a counterpart ramp, and flipping swaps it in.

| | Prime Time dark (as shipped) | **Prime Time light (new)** | Club Level light (as shipped) | **Club Level dark (new)** |
|---|---|---|---|---|
| ground | `#0A0D14` | `#F6F7FA` | `#FAF8F3` | `#14130F` |
| surface | `#121722` | `#FFFFFF` | `#FFFFFF` | `#1C1B16` |
| surfaceRaised | `#1A2130` | `#EEF1F6` | `#F2EFE8` | `#26241E` |
| textPrimary | `#F2F5F9` (17.8:1) | `#12161F` (16.9:1) | `#1C1B17` | `#F3F0E8` (16.3:1) |
| textSecondary | `#9FADC2` (8.5:1) | `#4E5A6E` (6.5:1) | `#5D594F` | `#B9B3A5` (8.9:1) |
| textMuted | `#66738A` (4.1:1) | `#7A8599` (3.5:1) | `#8A8578` | `#8A8578` (5.1:1) |
| borderBase | `#9EB2D0` | `#1F2A3D` | `#1C1B17` | `#E8E2D2` |
| live | `#FF3B5C` | `#B3364B` | `#B3364B` | `#FF3B5C` |

Ratios are against the ground. The Prime Time light ramp is the mock tenants' cool light ramp (Mocks); the Club Level dark ramp is this spec's proposal, a warm near-black that keeps Club Level's ivory ink and brass. Accent, Team and Second are the tenant's and do not change with mode; their decor alphas do.

**Muted text is not body text.** Both Prime Time ramps put `textMuted` under 4.5:1 (4.1 dark as shipped, 3.5 light). The kit therefore never sets text in `--muted-foreground`: every secondary line in the kit (Scorebug detail, Track counts, Medal ranks 4+) uses `--text-secondary`, which passes in all four ramps. The screen specs follow the same rule.

**The flip, as a pure function** in `presets.ts`:

```ts
export interface PresetRamp { neutrals: ThemeNeutrals; live: string }
export const PRESET_RAMPS: Record<string, Record<ThemeMode, PresetRamp>>;   // "prime-time", "club-level"

/** The theme in the other mode, carrying the matching preset ramp when there is one. Pure. */
export function withMode(theme: ThemeSettings, mode: ThemeMode): ThemeSettings;
```

- Same mode: returns an equal copy.
- If `colors.neutrals` equals one of the shipped ramps (preset P, mode M, all members compared), the result carries P's ramp for the new mode. `live` moves to P's live for the new mode when it was absent or equal to P's live for M; a tenant's own live override is kept.
- Otherwise (custom or legacy neutrals), `colors.neutrals` is dropped so the resolver derives the platform ramp for the new mode (`resolve.ts:135-156`), and `live` moves between `DEFAULT_LIVE` values when it held the old default. A dark ramp in light mode is the one outcome that is always wrong, so custom neutrals do not survive a flip. Brand v2 shows the flipped draft before anything is published.
- `primary`, `secondary`, `accent`, type, shape, surface, motif and decor are untouched.

Brand v2 calls `withMode` from its Light or dark control, and `applyPreset` stays as it is. The preview's "Light/Dark peek" renders `withMode(draft, other)` without changing the draft.

---

## Where the kit lives

```
obs-b2b-shared/src/ui/decor/
  index.ts            exports the twelve pieces and their prop types
  decor.css           every class, the intensity formula, the reduced-motion answers; all reads with fallbacks
  cx.ts               local class joiner (clsx is forbidden in src/ui/)
  DecorField.tsx  HeroBand.tsx  Chyron.tsx  GradientRule.tsx  Stripes.tsx  Scorebug.tsx
  Track.tsx  Burst.tsx  Medal.tsx  GridTexture.tsx  Brackets.tsx  BingoLine.tsx
  glyphs.tsx          the check path used by Track (no icon library)
  __tests__/          render, recolour, reduced-motion, intensity, budget and source-contract tests
```

`src/ui/` rules apply unchanged: React and relative imports only, no network, no router, no store, no icon library. The purity test already walks all of `src/ui/` (`src/ui/entry-gate/__tests__/purity.test.ts`), so it covers `decor/` without a new test. The pure additions (`deriveSecond`, `toHsl`, `fromHsl`, `DECOR_ALPHA`, `decorAlphas`, `PRESET_RAMPS`, `withMode`) live in `src/theme/`, which stays free of React and the DOM.

**Consumers.** The fan app imports `@b2b-shared/ui/decor` and `decor.css` (the pattern used for `ui/board/board.css`, `BingoCell.tsx:6`). The console imports the same for Brand v2's preset thumbnails (static mini-compositions: HeroBand, a Chyron, two board squares, with the preset's variables set inline on the thumbnail's root) and for anything else that previews the fan look. The unified preview renders the real fan app, so it needs nothing extra.

**How it lands.** The shared change is made by the build seat that owns `obs-b2b-shared` in the build wave (f1-decor-shell, per `documents/HLDs/fan-app-v2-build-plan.md` section 5), as pre-assigned shared request 1 ("decor contract, texture enum and preset decor"), in three commits: (1) contract, resolver, presets and their tests; (2) the kit and its tests; (3) the template's re-export of HeroBand and the `index.css` defaults. Other seats request changes through that wave's `shared-queue\` with the protocol in `artifacts\wave-2026-09-23\WAVE-RULES.md` ("The shared repo"): additive, back-compatible, one ready-to-apply request per file. All twelve pieces, BingoLine included, belong in that one request; the live board (f3) consumes BingoLine.

---

## Rules

- **DECOR-01 — Colour only from variables.** No file under `src/ui/decor/` contains a hex, `rgb()`/`hsl()` literal, named colour, Tailwind colour class or `--tenant-*` read. Enforced by a source-reading test.
- **DECOR-02 — Every new variable is read with a fallback** in `decor.css`, and the template's contract-defaults block declares all five. Two hosts at two commits must both render.
- **DECOR-03 — Auto Second is derived, never stored.** `colors.secondary` absent means Auto; the resolver computes Team +18° hue, lightness ×0.88 (dark) or +10% toward white (light).
- **DECOR-04 — Accent and Live "Auto" are the preset's values, written at apply time.** The resolver's fallback chain for accent is unchanged.
- **DECOR-05 — Live is never decorative.** `--live` appears only in the `live` Chyron and its dot.
- **DECOR-06 — The angle budget.** -5° (band cut, hairline, under-band, field fragments) and -10° skewX (Chyron, Stripes). Nothing else tilts at rest. BingoLine and the rearrange jiggle are exempt as non-decoration.
- **DECOR-07 — One band per screen.** `double` counts as one band.
- **DECOR-08 — The band's cut is transparent.** No flat ground-coloured slab.
- **DECOR-09 — Mode-aware alpha.** Strokes 0.22/0.16, fills 0.10/0.07, texture 0.05/0.035, read from variables; no piece branches on mode.
- **DECOR-10 — Nothing behind text above 0.12.** The DecorField column mask and the Burst's radial mask enforce it; cards are opaque.
- **DECOR-11 — Decoration fades, information never does.** Intensity scales DecorField, Burst and GridTexture only.
- **DECOR-12 — Intensity saturates at 0.7.** Full is the loudest decor gets; 0 means the host mounts no field and no burst.
- **DECOR-13 — State-driven motion only.** No ambient motion; the only loop is the LIVE dot while a game is live.
- **DECOR-14 — Reduced motion shows end states,** answered in `decor.css` itself, not left to a host's global floor.
- **DECOR-15 — Timing is not themed.** No preset or intensity changes a duration or a curve.
- **DECOR-16 — Ornaments are hidden from assistive technology;** Chyron, Track, Medal and BingoLine expose their text or state.
- **DECOR-17 — Kit text meets 4.5:1** on its fill for every preset, counterpart ramp and mock tenant, by test. No kit text uses `--muted-foreground`.
- **DECOR-18 — The Scorebug never invents a score.** No feed, no score.
- **DECOR-19 — Budget.** Each piece's rendered markup is at most 4 KB; no raster; no filter in the kit.
- **DECOR-20 — Pieces don't consult the theme.** The host decides whether a piece mounts from the resolved theme; the piece paints from variables. No host reads `motif.heroMotif` directly.
- **DECOR-21 — `decor.band` wins over `motif.heroMotif`;** absent both, the band is `single`. Brand v2 writes both in step.
- **DECOR-22 — Presets copy `decor`** through `applyPreset` and `genericizeForGallery`, and direction fixtures assert decor.
- **DECOR-23 — Every shipped preset has a light and a dark ramp,** and a mode flip goes through `withMode`.
- **DECOR-24 — No b2c colour, no b2c asset.** The grid-fragment motif is the product's own 3×3 board.

---

## Acceptance criteria

1. `B2BOrganization.ts`, `api/admin/branding.ts` and `models/b2b.ts` carry `decor` and `bingoGrid` exactly as above; a stored theme without `decor` validates and resolves unchanged apart from the auto Second.
2. `resolveTheme` resolves `decor` by the band table (all four rows tested), emits the auto Second (Hawks `#009A44` gives `#008864` dark and `#00be8d` light; slate `#64748B` gives `#585c7a` and `#717699`), and `themeToCssVars` emits 46 variables including the five new ones with the stated values in both modes.
3. `bingoGrid` emits a data URI containing no `#`, stroked in the resolved Second at 0.05 dark / 0.035 light, with `--texture-size: 120px 120px`; `dotgrid` and `none` are byte-identical to today.
4. `applyPreset` and `genericizeForGallery` carry `decor`; `withMode` round-trips both shipped presets (dark → light → dark returns the original) and drops custom neutrals on a flip.
5. The direction tests assert decor for all four directions and cover `MODE_COUNTERPARTS`: foreground on ground and `--text-secondary` on ground at 4.5:1 or better, and every Chyron variant's text on its block (team, accent, live, neutral) and every Medal numeral on its fill at 4.5:1 or better, in all six themes.
6. `decorAlphas` returns stroke 0.22 / fill 0.10 at intensity 0.7 dark and 0.16 / 0.07 light, half those at 0.35, and saturates above 0.7; a source test pins `decor.css`'s formula to it. With the column mask, the worst-case effective alpha in the column is 0.088 or less (stroke) and 0.12 (glow).
7. Kit component tests, for every piece: renders; contains no colour literal; recolours when the variables on its container change; ornaments carry `aria-hidden`; Chyron, Track, Medal and BingoLine expose the text, role and values above; under a reduced-motion match no animation or transition runs; `renderToStaticMarkup` output is at most 4096 bytes.
8. The purity test passes with `decor/` present; `lucide-react` appears nowhere in it.
9. The template's `HeroBand` import path still resolves (re-export), `StartScreen` and `BoardPage` read `decor.band` from the resolved theme, and the Accent hairline is visible on the cut in both variants.
10. **Visual regression.** A dev-only kit gallery route in the template (excluded from production builds) renders every piece and variant for the two mock tenants, Bears and Fighting Hawks, in both modes: 12 pieces × 2 tenants × 2 modes. Screenshots go to the build slice's artifacts folder and are compared by eye against `mocks\fanapp-v2\kit.html`. The first approved run becomes the pixel baseline for later changes. Screenshots with reduced motion on are included for BingoLine, Burst and Brackets.
11. Typecheck, lint, format and build pass in shared, the template and the admin; suite counts before and after are reported.

---

## Open questions

1. **Prime Time's default accent: decided gold; veto window.** Gold `#F5B32E` is decided, and Arthur may veto it in favour of the deep orange `#FF5722` the fan preset ships today (`presets.ts:37`). The console's Prime Time display uses gold (`DESIGN.md`, `primetime-gold`), and so does the Bears mock. Why gold: one look should have one accent across the console and the fan app, since the console previews the fan app side by side with its own chrome. Orange also works against the kit. It sits 24° from the Live red (`#FF3B5C`, hue 350°), where gold sits 50° away, and Live must never be confusable with decoration (DECOR-05). And it collides with orange team Seconds: Bears' `#C83803` is under 2° from `#FF5722` in hue, which would turn Stripes and the double band into two colours instead of three. Gold takes dark ink at 10.3:1 on a chyron. The change touches the preset, `primeTimeBears` and two assertions (`direction-acceptance.test.ts:37`, `presets.test.ts:38`), as the Presets block above shows. A veto puts those back to `#FF5722`. Tenants who already applied Prime Time keep the orange they stored until they re-apply or reset the accent to Auto.

---

## Mocks

- `overboard-b2b-workspace\mocks\fanapp-v2\kit.html`: the kit sheet. Every piece and variant, Bears and Fighting Hawks, light and dark, with reduced-motion stills for the animated pieces. It is the visual reference for acceptance criterion 10.
- The screen mocks in `overboard-b2b-workspace\mocks\fanapp-v2\`, one per screen in [`fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md) and [`fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md) (Gate, auth, Join, Home, Contests, Contest detail, Builder, Live board, Prize, Standings and results, Profile, Paused, desktop frame), show each piece in place.
- Mock tenants: **Bears** (Team `#0B162A`, Second `#C83803`, Accent `#F5B32E`) and **Fighting Hawks** (Team `#009A44`, Second `#1B5E3C`, Accent `#FFB224`), both on Prime Time with the double band, using the ramps in "Light and dark". Sample names are invented; no real athletes, no real team marks beyond the tenants' own colours.

---

## Supersessions

This spec supersedes three points of the vault chart `ArthurVault\projects\Overboard\b2b\charts\design.md` (read-only here; the head seat updates it):

- **"Do not port a b2c color or pattern"** (`design.md:161-166`). Arthur's 2026-09-24 ruling ("Fan app overhaul … drawing on appv1 (B2C) too") replaces it: the fan app may draw on appv1's patterns. The splash field is not a b2c asset; it is the product's own 3×3 board. No b2c colour is ported (appv1's `#3A87FD` palette appears nowhere), and DECOR-24 keeps it that way.
- **"Mobile-portrait only … zero `sm:`/`md:`/`lg:` breakpoints"** (`design.md:97-98`). One breakpoint is added, at 900px, and it changes only the frame: the DecorField fills the viewport and the single column stays centred. Nothing becomes multi-column.
- **HeroBand's home in `components/layout/`** (`design.md:113-114`). It moves to `obs-b2b-shared/src/ui/decor/` with a re-export in the template, like the entry gate before it.

The chart's other rules stand and the kit obeys them: no hardcoded hex, token-only colour, state-driven motion with the LIVE pulse as the only loop, status colours platform-owned.

---

## References

- Preview contract: `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md` (the frame renders this kit through the real fan app).
- Wave rules: `artifacts\wave-2026-09-24\WAVE-RULES.md`, "Brand gets simpler", "Fan app overhaul", "Shared repo: one owner".
- Build plan: [`../../../documents/HLDs/fan-app-v2-build-plan.md`](../../../documents/HLDs/fan-app-v2-build-plan.md), sections 4 (f1-decor-shell), 5 (shared ownership), 6 (shared-model changes).
- Contract: `obs-b2b-shared/src/interfaces/b2b/B2BOrganization.ts:217-339` (`ThemeSettings`, `THEME_TEXTURES` at `:255`, `THEME_HERO_MOTIFS` at `:260`); `src/api/admin/branding.ts:83-97`; `src/models/b2b.ts:138-162`.
- Resolver: `obs-b2b-shared/src/theme/resolve.ts` (defaults `:36-48`, `DEFAULT_LIVE` `:51-54`, ramps `:135-192`, colour fallbacks `:218-236`, glow `:282-283`, `themeToCssVars` `:305-361`, `DEFAULT_THEME` `:375-389`); `color.ts` (`onColor` `:153`, `withAlpha` `:168`, `mix` `:178`).
- Presets: `obs-b2b-shared/src/theme/presets.ts` (Prime Time `:33-59`, Club Level `:65-91`, `applyPreset` `:116-141`, `genericizeForGallery` `:151-163`); `celebration.ts` (unchanged).
- Tests: `src/theme/__tests__/fixtures/directions.ts`, `direction-acceptance.test.ts` (variable count `:249`), `resolve.test.ts` (alias `:206`, variable list `:228-270`), `presets.test.ts`, `legacy-parity.test.ts`; `src/ui/entry-gate/__tests__/purity.test.ts` and `theme-contract.test.ts`.
- Template: `overboard-b2b-template/src/components/layout/HeroBand.tsx` (angle rule `:18-22`, slab `:35-39`, hairline `:41-45`); `src/index.css` (Tailwind bridge `:7-55`, contract defaults `:163-190`, texture on body `:196-202`, board-hit utilities `:239-248`, reduced-motion floor `:275-284`); `src/pages/auth/StartScreen.tsx:33`, `src/pages/board/BoardPage.tsx:388`.
- Console canon: `obs-b2b-admin-frontend/src/styles/primetime.css` (angle budget `:11-15`, chyron construction `:43-52`, LIVE tag `:85-102`); `obs-b2b-admin-frontend/DESIGN.md` (Condensed-Never-Reads Rule, Live strip / scorebug, Motion, Reduced-Motion Rule, Timing-Is-Not-Themed Rule, "Don't skew anything beyond the chyron tags").
- Specs: [`admin-branding.spec.md`](admin-branding.spec.md) (`THEME-03`–`THEME-07`, derivation rules, the fixed interface); [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md); [`../../webapp/fan-app-v2.spec.md`](../../webapp/fan-app-v2.spec.md); [`../../webapp/fan-contest-flow.spec.md`](../../webapp/fan-contest-flow.spec.md); [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md).
- Vault chart (read-only): `ArthurVault\projects\Overboard\b2b\charts\design.md`.
