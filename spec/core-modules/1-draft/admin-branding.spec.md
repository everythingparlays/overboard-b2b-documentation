# Core Module Spec: Admin — Branding

**Implements:** PRD `BRAND-01` (superseded in classification — see "What this does to BRAND-01"), `ADM-02`, `ADM-03`, `TEN-02`, `TEN-C1`. HLD [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the layer this spec's `src/theme/` and `src/ui/board/` additions must satisfy.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the permission table, the `/branding` nav destination, and the **Fan's-eye view** principle this screen is the second instance of. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the draft-and-publish screen skeleton, the live-preview wrapper, and the known gap this spec closes. [`../../webapp/styling.spec.md`](../../webapp/styling.spec.md) — the runtime theming system this replaces, and the platform-fixed status colors it keeps.

**Status:** Draft. Written from the fan-theming design contract (directive, 2026-09-22, Arthur). No open questions remain — ready for review.

## Overview

A tenant's colors, type, shape, finish and signature moments become real server-side configuration, editable by that tenant's own admins at `/branding`, applied by the fan app at runtime, and previewed in the console against the unsaved draft.

**The whole change, in one line:** the eight hardcoded hexes in the fan app's per-tenant source files become a stored theme contract with one canonical resolver, so a team's look is data that a non-engineer edits rather than a deployment an engineer performs.

**In scope:** the stored theme contract (v2) and its derivation rules; the shipped preset defaults, the OBS-curated gallery and a tenant's own saved presets, with the promote-to-gallery pipeline; storage on `B2BOrganization` and the gallery's own collection; `GET`/`PUT /admin/branding`, `PUT /admin/branding/presets`, `POST /admin/branding/promote`; the public fan wire; the `/branding` screen and its live preview; and back-compat with the compile-time tenant files, pinned by test.

**Not in scope:** sponsor asset management (below, "Recorded gaps"); a full fan-board preview inside the console; per-cell live fractions for Under props and non-player props; anything that would make `--destructive` / `--success` / `--warning` tenant-settable.

---

## Principles

Two principles sit above the numbered rules. A change can satisfy every rule below and still violate one of these.

**Honesty by omission, not by narration** (ruling 2026-09-22, Arthur). *Where the product cannot honestly show something, it omits it — silently — and the gap is recorded here, not on screen.* Never-fabricate stays absolute: no invented stats, no mocked-up data, no preview of a thing that is not the thing. But a customer-visible surface must not explain its own gaps or its own provenance either. No "not measured yet" caption under a missing stat fraction. No "a Sponsors section is coming" note on the Branding screen. No roadmap narration, no caveat lines, no provenance notes anywhere a tenant admin or a fan can read them.

The two halves are easy to confuse, so state them together: a cell with no honest progress data shows **no fraction and no explanation**; the Branding screen ships **without a Sponsors section and without any mention of one**; the preview shows what it can render honestly and **does not caption what it is not**. Every one of those gaps is written down in "Recorded gaps" below, which is the correct and only place for them.

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

The PRD text is not edited by this spec. `BRAND-01` remains the requirement; this is its implementation, and the classification change is recorded here and dated so it is a ruling rather than a drift. `BRAND-02` (per-game sponsor assets, admin-configured, never a code change) is untouched and unimplemented — see "Recorded gaps".

**Requirement ids.** `BRAND-01` and `BRAND-02` are PRD ids and keep their numbers. This spec mints `BRAND-03` onward for the theming work.

---

## The theme contract (v2)

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

**`BRAND-03` — The theme is pure data and the resolver is the only thing that computes.** On-colors, tints, the radius ladder, glow shadows, the texture gradient and every derived neutral are **never stored**. `resolveTheme()` / `themeToCssVars()` in `obs-b2b-shared/src/theme/` is the single canonical implementation, imported by the fan app, the admin console and (for validation) the backend. A second derivation anywhere is the defect this rule exists to prevent.

**`BRAND-04` — The font list is a curated allowlist, not a free string.** `THEME_FONT_IDS` is a closed `as const` array; the zod schema validates against it and nothing else passes. Each id maps in `fonts.ts` to a label, a full CSS stack with fallbacks, and a provider plus stylesheet URL that the host injects. An open font field would be a tenant-supplied URL loaded into every fan's browser on every page — a third-party asset with no review step, on the critical rendering path, for a setting whose product value is "pick one of ten". The allowlist is a security boundary and a quality floor in one decision, and growing it is a one-line change in a shared file with a code review attached.

**`BRAND-05` — Status colors stay platform-owned.** `--destructive`, `--success` and `--warning` are fixed per mode and are not in the contract; the resolver does not emit them. This is [`styling.spec.md`](../../webapp/styling.spec.md) §1's existing rule, kept deliberately rather than inherited by accident: a "closed" badge must read as closed on every team's site, and a fan who plays at two teams must not have to learn two color vocabularies. `live` is the **one** themable signal tone, because it is a broadcast treatment rather than a status — Prime Time's `#FF3B5C` chyron and Club Level's `#B3364B` are a direction's voice, not a claim about state.

### Why on-colors are computed, never stored

The single most consequential derivation rule, and the one place this spec sanctions a visual change to shipped tenants.

Today's `TenantColors` stores eight hexes including `text`, and `applyTenantColors()` maps that one value onto `--primary-foreground`, `--secondary-foreground` and `--accent-foreground` alike. A human picks a brand color, picks a text color, and nothing checks that the second is legible on the first. One shipped tenant already fails: `fightinghawks` resolves to **white text on a white secondary** — an invisible control, in production, in a model that cannot detect it.

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

**The emitted variable set is a superset of what the entry gate reads today**, so the existing 14-variable gate contract keeps working untouched, and the legacy aliases are kept deliberately: `muted` = surface, `input` = surface, `ring` = primary, `secondary` falls back to primary when absent, `accent` falls back to secondary then primary, and `--radius` carries the control radius in px because the gate stylesheet already reads it by that name. A new name for an existing concept would have been cleaner and would have broken every consumer for nothing.

**`BRAND-06` — The explicit `border` override exists for legacy parity and nothing else.** `ThemeNeutrals` carries both `borderBase` (an rgb basis, alpha applied by `borderAlpha`) and `border` (a full explicit color that wins). Two ways to say one thing is normally a defect; here the second is load-bearing. Today's tenant files store a flat opaque border hex, and the parity test below must reproduce it byte-for-byte. `borderBase` is how the contract is meant to be used and what the screen writes; `border` is how a legacy seed survives conversion without a visual delta.

---

## `BRAND-07` — The four directions are preset JSON, with zero code

**Acceptance rule.** The four design directions — Prime Time, Club Level, Signal, Floodlight — must each be expressible as one complete `ThemeSettings` JSON object, and rendering them must require **no per-direction code branch anywhere in the platform**. Not in the resolver, not in the fan app, not in a component, not in a stylesheet.

This is the whole test of whether the contract is a theming system or four skins with a switch in front of them. A direction that needs one `if` is a direction the next tenant cannot have; a contract that needs a code change to express a look is `BRAND-01`'s hardcoding with extra steps.

It is pinned by `src/theme/__tests__/direction-acceptance.test.ts`, which builds each direction from a fixture JSON and asserts, from `themeToCssVars(fixture)` alone: mode; the ground/surface/text ramp; the live tone and the accent; that each font id resolves to the right stack; the uppercase display transform where a direction has one; the radius ladder (Prime Time base 8 → 3/8/10, Club Level 12 → 4/12/15, Floodlight 13 → 5/13/16); the team tints at 0.14 dark / 0.12 light and 0.38 border; that Signal emits the dotgrid texture and the others emit none; the four glow intensities (0.35 / 0 / 0.55 / 1.0) and the exact `--glow-hit` strings they produce; and the motif selections.

The fixtures carry the exact hexes extracted from the mocks. Where a mock disagreed with itself across its own two artboards — Club Level's gate and board drifted on a border alpha — **the board values win**, because the board is the screen a fan spends the game on. Signal's stray mint is its team color and belongs in `primary`, not in `accent`.

---

## Presets, gallery, and curation

Three shelves, three different things, deliberately not one list.

| Shelf | What it is | Where it lives | Who writes it |
|---|---|---|---|
| **Overboard presets** | The shipped defaults — Prime Time and Club Level | A constant in `obs-b2b-shared/src/theme/presets.ts` | Engineers, in a PR |
| **Gallery** | OBS-curated, cross-tenant, genericized | `${prefix}theme_gallery_presets`, its own collection | OBS staff, by promoting |
| **Your presets** | This tenant's own saved looks | `branding.presets[]` on the org | The tenant's `org:admin` |

**`BRAND-08` — Applying a preset keeps the tenant's own team colors.** `applyPreset(preset, current)` takes everything from the preset **except** `colors.primary` and `colors.secondary`, which keep the tenant's current values when they exist. A direction is a system a team's palette flows into, not a palette that replaces it — a team that clicks "Prime Time" wants a broadcast treatment of *their* colors, and a picker that repaints them in someone else's blue has misunderstood what it is for. Shipped presets carry a neutral slate `#64748B` in `primary` so an unbranded preview is honest rather than accidentally implying a color the tenant has not chosen, and `applyPreset` swaps in the tenant's primary the moment one exists.

**Only two directions ship as presets, and this is the interesting call.** Prime Time and Club Level ship. **Floodlight does not** — it is the conservative evolution of the current fan default, so its value ships as the *quality bar of the default theme itself* and as an acceptance fixture; offering it in the picker would be offering the tenant what they already have, listed as if it were a choice. **Signal does not either** — what is worth keeping from Signal is two components (the ring gauge and the per-cell stat fraction), which ship as real shared UI available to every theme through `motif.boardCounter`, not as a look. A preset shelf whose entries are "the default, again" and "two components, bundled as a mood" is a shelf that teaches a tenant nothing.

### The rejected model: public cross-tenant preset visibility

**`BRAND-09` — A tenant's saved presets are private to that tenant, always. There is no public, tenant-to-tenant preset sharing, and this is a deliberate rejection, not an unbuilt feature.**

The obvious design is to let a tenant publish a preset and let every other tenant browse it — a community palette library, free to build once presets exist as data. It is rejected on three grounds, any one of which is sufficient.

**White-label isolation.** The platform's first promise is that a team's app is the team's product, not a third-party tool visible as such. Every boundary in this system is built on it: `resolveTargetTenant` refuses a tenant-scoped caller who so much as *names* another tenant, the public org endpoint is an explicit allowlist, and OBS staff-ness is verified per request. A browsable list of other tenants' presets discloses, at minimum, that other tenants exist, how many there are, and — the moment a preset is named by a human — who they are. Presets are named by humans; a tenant saves "Away kit" and "2026 rebrand", not "preset-3". That is a tenant-identifying disclosure through a feature whose entire product value is convenience, on a platform whose isolation model is otherwise enforced structurally. It would be the one place a tenant learns about another tenant, and it would have been built for a picker.

**Brand-dispute risk.** A theme is trade dress. A preset carrying a team's exact palette, accent, type and treatment, appearing in a rival team's picker with a one-click Apply, is a mechanism for one licensee to adopt another's visual identity — built, hosted and offered by the platform they both license. The dispute lands on OBS, not on the tenant who clicked. Nothing about the feature's convenience is worth standing in the middle of that, and no disclaimer in a picker resolves it: the risk is the affordance, not the labelling.

**Curation already is the sharing mechanism, and it is better.** Everything public sharing is supposed to deliver — a good look one team built becoming available to another — the promote-to-gallery pipeline delivers, with a **human genericization step in the middle**. Promotion is OBS-staff-only, audited, and strips the source tenant's `colors.primary` and `colors.secondary` on the way in, replacing them with the neutral placeholder, so what lands in the gallery is the *system* (mode, neutrals, type, shape, finish, signature) and never the *brand*. Assets are never copied. The gallery row records `sourceSubdomain` internally for provenance and it is **never on any response a tenant can read**.

So the curated path is strictly better on every axis that matters: a tenant still gets the good look, the identifying colors are gone by construction rather than by policy, a named human decided it was worth sharing, and there is an audit entry saying who and when. The only thing public sharing adds is immediacy — and immediacy is precisely what makes the first two objections bite.

**`BRAND-10` — Promotion is an OBS-staff act and is audited.** Unlike ordinary config edits, which this codebase deliberately does not audit (`SEC-06` covers PII release and irreversible actions, not settings), promotion is **cross-tenant publication**: it takes one tenant's work and makes it visible to all of them. That crosses a boundary every other write in this module respects, so it gets the trail — actor, target tenant, preset id, gallery id. Ids and counts only, never values.

---

## Storage

Two decisions, argued separately because they come out differently.

### The theme, assets and a tenant's presets: a subdocument on the organization

**`BRAND-11` — `branding` is a typed subdocument on `B2BOrganization`, `_id: false`, `default: undefined`, `$unset` on clear.**

The backend's existing per-tenant config is unanimous on this: `signupFields`, `optIns` and `gateCopy` are all subdocuments on the org, all `_id: false`, and `gateCopy` is `default: undefined` with `$unset` on clear. `branding` is the same kind of thing and the precedent is followed for the same four reasons:

1. **It is a bag of settings with no independent lifecycle.** A theme is never created, queried, or deleted apart from the tenant it belongs to. Nothing references a theme by id. It has no existence without its org — which is the exact test the codebase already applies to decide subdocument vs collection.
2. **It is free on the hot path, and a collection would not be.** `resolveAdminScope` and `resolveTenant` already load the whole org document on every request, and the fan-side lookup is cached 60 seconds. A theme in a separate collection adds a query to the one path every fan page load takes, to fetch data that is always wanted at the same moment as the document already in hand.
3. **`$unset` makes "reverted to platform default" and "never themed" one state.** Storing `{}` would create a third state that looks configured, renders identically, and diverges the first time a default changes. This is `gateCopy`'s rule and it exists because that distinction has no meaning anyone can act on.
4. **Whole-document write, last-write-wins, diffed server-side into a `changes` summary.** Same as `PUT /admin/config`, acceptable at V1's operator count for the same reason, and it keeps preset create/rename/delete/reorder as one array replacement rather than four endpoints.

**`Mixed` is forbidden.** The subschemas are real typed Mongoose schemas mirroring the zod contract, not a `Mixed` blob. A `Mixed` theme would make every guarantee in this spec a client-side convention — the resolver's input could be anything, the font allowlist would be advisory, and a malformed write would surface as a rendering failure on a fan's phone rather than a 400 at the boundary.

**A tenant's own presets are part of the same subdocument**, capped at 20, identity by a slug `presetId` exactly as `fieldId` and `optInId` work. They are bounded, always read with the org, and have no independent lifecycle — the same argument, and it lands the same way. The cap is there so a subdocument array stays a subdocument array: at 20 named looks a tenant has a library; at 2,000 they have a collection, and the shape should change if that ever happens rather than growing quietly.

**Assets ride beside the theme, never inside it.** `BrandingAssets` is a sibling of `theme` in the same subdocument, and `ThemePreset.theme` is a `ThemeSettings` — so **a preset structurally cannot capture a logo**. This matters most at promotion: a gallery entry that could carry a logo URL is a gallery entry that can leak one tenant's asset into another's console, and the type system refuses it rather than a code review catching it.

### The gallery: its own collection

**`BRAND-12` — Gallery presets live in `${prefix}theme_gallery_presets`, a separate global collection.**

The same reasoning that puts branding on the org puts the gallery off it, because the gallery fails every test the org subdocument passes:

- **It is cross-tenant.** It belongs to no organization. Embedding it on one org would make that org's document the home of every other org's picker, and embedding a copy on *every* org would be a fan-out write on publication and N copies to keep coherent.
- **It is listed without an org in hand.** `GET /admin/branding` loads the gallery for whatever tenant is in view; the rows are the same rows for all of them. That is a query against a collection, not a projection of a document.
- **It has an independent lifecycle and its own permissions.** Rows are created by OBS staff through a route no tenant can reach, they outlive the tenant that inspired them, and a tenant deleting itself must not take gallery entries with it.
- **It is an entity: it has an id others reference.** `presetId` is unique across the collection, collisions are resolved server-side with a slug suffix rather than a 409 thrown at a staffer who is not the author of the collision.

That is the codebase's own stated rule for a separate collection — "an entity with its own id, its own lifecycle, queried independently of the org" — met on all four counts. The collection inherits `B2B_COLLECTION_PREFIX` like every other B2B collection, so a dev stage's gallery is its own.

**The gallery is read-only to tenants and its rows are already genericized.** There is no tenant-facing write path, and the write path that exists strips brand colors before insert (`BRAND-09`). `sourceSubdomain` is stored for OBS provenance and is on no response a tenant receives.

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

**`BRAND-13` — `org:admin` writes, `org:member` reads, enforced server-side.** `refuseReadOnlyWrite(scope)` runs **first**, before the target is even resolved, on all three write routes. A suspended tenant's own admins are refused (OBS staff are not) — a paused workspace is paused for configuration too. The console's read-only presentation for `org:member` is UX; the server is the boundary, and the `org:member` refusal carries the module's existing message rather than a branding-specific one.

**`BRAND-14` — No reverification anywhere in this module, and that is a ruling rather than an omission** (Arthur, 2026-09-22). [`admin-surface.spec.md`](admin-surface.spec.md)'s reverification list has one common thread: *cannot be undone by clicking again*. A theme edit can. It releases no PII, sends nothing to anyone, triggers no irreversible action, and its worst outcome is a tenant's site looking wrong until someone publishes again — which they can do immediately, from the same screen, with the same session. That spec draws the line explicitly at "editing a sponsor logo does not qualify; deleting the sponsor does", and every write in this module sits on the logo side of it. Adding a re-prompt to a reversible cosmetic edit would spend the mechanism's credibility on the cheapest action in the console and teach admins to click through it.

Promotion is the one write that is *not* reversible in the same way — a gallery row is visible to every tenant the moment it lands — and it is handled with the tool that fits: staff-only plus an audit entry, not a credential re-prompt. Reverification protects against an unattended session; the gallery risk is about *authority*, which is what the staff gate answers.

**`BRAND-15` — Every branding write calls `clearOrgCache()`.** The fan-side org lookup is cached 60 seconds. An admin who publishes a theme, opens the team's site and sees the old one concludes the publish failed — and their next act is to publish again, which does nothing, twice. The write knows exactly which tenant changed. Preset writes call it too: they are org-document writes, the call is cheap, and a cache holding a document that no longer matches the database is a bug regardless of which field moved.

**Responses echo stored state plus a `changes` summary**, and the server owns derived fields — `createdAt` on a preset is merged in from the stored row by `presetId` and is never accepted from the client, the same rule `textVersion` and `publishedAt` follow in the fields module.

---

## The fan wire

**`BRAND-16` — Branding reaches fans through the public org endpoint's explicit allowlist.** `GET /b2b/org/:subdomain` is unauthenticated and was deliberately converted from a denylist to an allowlist precisely so that a field added to the shared model does not auto-publish to the anonymous internet. That property is kept: `branding` does not appear on the wire because it was added to the org, it appears because a hand-picked projection was added to the handler — `{ theme, logo, sponsorName, sponsorLogo, sliderTipImageUrl }`, and nothing else.

**`BRAND-17` — Presets are never on the fan wire.** Not the tenant's, not the gallery's. A fan needs the *active* theme; a preset is authoring state. Shipping it would publish a tenant's unreleased looks — and, in the gallery's case, every other tenant's curated entries — to an endpoint with no authentication at all. The projection above is exhaustive and `presets` is not in it; the `BrandingSettings` type and the wire type are deliberately different shapes so this cannot be reintroduced by spreading an object.

**`BRAND-18` — Branding is served while `suspended === true`.** The suspended path is branded on purpose: a paused workspace shows the team's page on a break, never a raw error and never another team's colors. The theme must therefore be in the response *before* the suspension branch returns, and a test pins it. This is the existing behavior of the compile-time model and it is easy to lose when the source of the colors moves to the server.

The public org schema takes the branding block with a passthrough/loose object so a later additive field does not require a five-way submodule pin bump to reach fans.

---

## Back-compat

**`BRAND-19` — The compile-time tenant files become seeds, and the server wins.** `overboard-b2b-template/src/config/tenants/*.ts` stay exactly as they are. The fan app applies the **local seed synchronously at module scope** — the colors are already in the bundle, so this costs nothing and kills the cold-load flash the current provider-mount timing produces — then re-applies the server theme when `GET /b2b/org` returns and `branding.theme` is present. Server wins; the seed is the first paint and the offline fallback.

`themeFromLegacyColors()` converts the eight-hex shape into a `ThemeSettings`: mode dark, primary/secondary/accent as given, neutrals from background/card/text/textMuted with the **explicit** `border` (this is what `BRAND-06` exists for), defaults everywhere else. The `test` tenant, which configures no colors, resolves to the platform default theme and must render identically to today's `.dark` block.

**`BRAND-20` — Legacy parity is pinned by test, with exactly one sanctioned visual delta.** `src/theme/__tests__/legacy-parity.test.ts` asserts, for all four existing tenant color sets, that `themeToCssVars(themeFromLegacyColors(x))` equals the legacy `applyTenantColors` mapping **for every variable except** `--primary-foreground`, `--secondary-foreground` and `--accent-foreground`. For those three it asserts the computed value equals the legacy value **whenever the legacy value cleared 4.5:1** against its background.

Read the two halves together: **the rendering changes only where it was already broken.** A tenant whose hand-picked foreground was legible keeps it, byte-for-byte; a tenant whose foreground failed contrast gets a legible one. The test names the case directly — `fightinghawks`' secondary foreground is asserted to no longer be white on white.

This is the only visual change this wave sanctions to an existing tenant, it is argued above ("Why on-colors are computed"), and it is pinned rather than trusted. Any *other* delta the parity test catches is a defect in the resolver, not a new sanctioned difference.

**No migration, no backfill.** A tenant with no `branding` subdocument renders exactly as it does today, from its seed. The first publish through `/branding` writes the subdocument and the server starts winning for that tenant and no other. Same standard the fields module set, met the same way: the cheapest migration is a read path that already understands both shapes.

---

## The screen

`/branding`, per the fan-theming design contract. The [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) skeleton is copied wholesale — pick-tenant empty state, `key={qs}` remount on tenant switch, draft-and-publish with `sessionStorage` persistence under a distinct draft scope, inline publish notes rather than toasts, read-only presentation for `org:member`, and the console's own `ui/` primitives throughout.

**Groups, in plain product language** (Principle 2): **Look** (Light/Dark) · **Colors** (Team color, Second color, Accent, Live tone, and an Advanced reveal for explicit neutrals) · **Type** (Headline font, Body font, Number font, ALL-CAPS headlines, Headline weight) · **Shape** (Corner roundness, Density) · **Finish** (Border strength, Texture, Glow) · **Signature** (Hero band, Bingo counter) · **Assets** (Logo, Board marker image).

**There is no Sponsors section and no mention of one** (Principle 1). The contract carries `sponsorName` and `sponsorLogo` so the shape is right when the sponsor model lands; the screen does not edit them and does not say why.

**The preset picker is the three shelves above**, in that order. Apply runs the shared `applyPreset`, so the tenant's own team colors survive (`BRAND-08`). Save-as-preset, rename and delete act on "Your presets" only. **Promote to gallery appears only for OBS staff** — gated on the staff flag, not on write access, because a tenant `org:admin` has write access and must not have this. The server refuses it regardless; the gate is so the control is not offered to someone who cannot use it.

### Live preview

**`BRAND-21` — The preview renders real shared components under the draft theme's resolved variables, and captions nothing.** The wrapper is `.obs-gate-preview` with an inline style of `themeToCssVars(draftTheme)`, which overrides the class's fallback palette by specificity. Inside it: the real `EntryGatePreview` from `obs-b2b-shared`, plus a sampler strip built **only** from real shared pieces and real tokens — a display-type headline, a primary CTA, chips, the ring gauge or the numeral per the draft's motif, a stat fraction, and one hit-treatment tile.

This satisfies [`admin-surface.spec.md`](admin-surface.spec.md) Rule 12 the same way the gate preview does: the console renders the fan product's own code, never a likeness in console markup. A hand-drawn swatch board would be a second implementation of the theme system and would drift from it — and unlike a field label, a drifting *theme* preview is wrong about every screen at once.

**The theme variables stay scoped to the wrapper, never the document root.** The console has its own token namespace (`--bg`, `--text`, `--accent`); the fan names (`--background`, `--primary`) are defined only inside `.obs-gate-preview`. Setting them at `:root` would repaint the console in whatever palette the draft carries, which is how the fan app does it and exactly wrong here.

**The fields spec's "the team's colors apply on their own site" caption is removed** once branding is live. It was honest when the console could not know a tenant's colors; this spec is the reason it stops being true, and leaving it would be the screen narrating a gap that no longer exists (Rule 12 below, Principle 1).

**A full board preview is out of scope for this wave** — the gate plus the sampler is what is honestly renderable now. Recorded below; **not captioned on screen**.

### The board, and the honesty rule in its sharpest form

The fan board gains two shared components, both theme-driven and neither direction-specific: a ring-gauge bingo counter (`motif.boardCounter === "ringGauge"`) and a per-cell live stat fraction.

**`BRAND-22` — A per-cell stat fraction renders only when the underlying progress is real, and renders nothing otherwise.** The conditions are all of: the prop names a player entity, the outcome type is `Over`, the progress value is a number, and the target is greater than zero. When any fails, the cell shows **no fraction and no caption** — no "not tracked", no "—", no explanatory line anywhere on the board.

This is Principle 1 at its sharpest and it is worth stating as a rule because the instinct to explain is strong. A fan looking at a cell with no fraction learns nothing false. A fan looking at a cell that says "not measured yet" has been handed a piece of platform vocabulary, a hint that the number exists somewhere, and a reason to distrust the fractions that *are* shown. The absence is the honest signal; narrating it is the dishonest one.

**Under props never render a fraction this wave**, even where progress data exists, because the existing progress bar's semantics are inverted for them and a fraction inherited from that bar would be confidently wrong. If the bar's inversion is cheap and safe to fix it is fixed; if it is not, the bar stands as-is and the gap is recorded below. **Neither path renders a fraction for an Under.**

**Celebration is theme-derived, not direction-coded.** `celebrationProfile(theme)` returns pure data — particle count, spread, whether a broadcast flash fires, whether the moment is uppercase — computed from `glowIntensity` and `displayTransform`. Glow 0 yields 40 particles and no flash, which is Club Level's editorial understatement falling out of the theme rather than being special-cased (`BRAND-07` again).

**`BRAND-23` — `prefers-reduced-motion: reduce` means no confetti and no flash at all.** Not fewer particles, not a shorter flash: none, with the modal appearing statically. This is the fan app's first reduced-motion handling and it is specified as an absolute because a reduced version of a full-screen color flash is still a full-screen color flash.

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
15. **No branding write requires reverification.** Every one of them is undone by publishing again.
16. **Legacy parity is pinned by test, with exactly one sanctioned delta** — computed on-colors fixing foregrounds that already failed 4.5:1. Any other difference is a resolver defect.
17. **Reduced motion means no confetti and no flash**, not a smaller one.

---

## Recorded gaps (recorded, not blocking, and never on screen)

Principle 1 makes this section load-bearing: it is the *only* place these live.

- **Sponsor asset management is not built.** `BrandingAssets` carries `sponsorName` and `sponsorLogo` so the shape is right, and the screen neither edits them nor mentions them. The screen grows a **Sponsors** section when the sponsor model lands — which is `BRAND-02`'s per-game, admin-configured territory and a different data model (a sponsor entity with a schedule), not a field to add here. Recorded so "deliberately deferred" is distinguishable from "forgotten".
- **No full board preview in the console.** The gate plus the themed sampler is what can be rendered honestly from shared components today; a full board needs live contest data the console does not have and must not invent. Not captioned on screen.
- **No stat fraction for Under props or non-player props.** The Under case is blocked on the existing progress bar's inverted semantics; the non-player case is blocked on there being no per-cell progress concept for it. Both render nothing rather than something approximate.
- **Board freshness is 2-minute polling.** The fractions are as fresh as the poll, which is the platform's actual truth today, not a streaming feed. Nothing on screen claims live-to-the-second, and nothing on screen explains the cadence either.
- **`BRAND-02` is still unimplemented.** This spec covers `BRAND-01`'s elements only. Per-game sponsor rotation remains the open half of PRD §8.
- **Publishing is last-write-wins between two admins**, as everywhere else in the admin surface. Acceptable at V1's operator count; the same revisit trigger applies.
- **The gallery has no delete path in this wave.** Rows are created by promotion and edited by nobody. A curated library of a dozen entries does not need lifecycle management yet; one that grows will, and it is a small additive route when it does.
- **Preset ordering is array order with no separate rank field**, exactly as `signupFields` works. A reorder is a whole-array write.
- **The admin console's own theme is untouched.** This spec governs the fan theme; the console's tokens are a different namespace and a different concern.

## References

- PRD: [`BRAND-01`–`BRAND-04`, `ADM-02`, `ADM-03`, `TEN-02`, `TEN-03`, `TEN-05`, `TEN-C1`](../../../documents/PRD/OBS_B2B_Platform_PRD.md) — §8 Branding & Sponsor Assets, §15.2 the dividing line
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework, the `/branding` nav destination, the **Fan's-eye view** principle and Rule 12, and the reverification list this module sits outside
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the draft-and-publish skeleton, the `.obs-gate-preview` wrapper, and the "the preview cannot show a tenant's real colors" known gap this spec closes
- [`../../webapp/styling.spec.md`](../../webapp/styling.spec.md) — §1 the runtime theming system this replaces, and the platform-fixed status colors it keeps
- [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — its Data Model section already places branding server-side; this is that
- HLD: [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the layer rules `src/theme/` (pure, no react, no DOM) and `src/ui/board/` (react, relative imports only) must satisfy
- `obs-b2b-shared/src/theme/` — `color.ts`, `fonts.ts`, `resolve.ts`, `presets.ts`, `legacy.ts`, `celebration.ts`, and the acceptance and parity tests that pin `BRAND-07` and `BRAND-20`
