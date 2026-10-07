# Core Module Spec: Admin — Sponsors

**Implements:** PRD `BRAND-02`, `BRAND-03`, `BRAND-04`, `TEN-02`, `TEN-04`, `RPT-04`, `SEC-02`, `ADM-03`, and Arthur's 2026-09-24 ruling on sponsors (WAVE-RULES, "Sponsors"). The field-by-field classification is [`documents/PRD/branding-field-split.md`](../../../documents/PRD/branding-field-split.md); this spec builds what it classifies, with one change to it: the prize popup is no longer a placement slot (below, "Retiring the `prizePopup` slot").

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope, targeting, "No re-authentication" (a sponsor delete takes its typed name), Rule 13. [`admin-lists.spec.md`](admin-lists.spec.md) — the cursor-paging convention and the endless-scroll components every list here uses. [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page whose Sponsors tab hosts the slot editor, and the lock. [`admin-prizes.spec.md`](admin-prizes.spec.md) — the prize page and its "Provided by" control, the award snapshot's `providedBy`, and the prize-type migration whose step 2 converts the `prizePopup` credit. [`admin-preview.spec.md`](admin-preview.spec.md) — `FanAppPreview`, which the sponsor page and the contest Preview tab host. [`admin-exports.spec.md`](admin-exports.spec.md) — the DPA field scope this model absorbs. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the opt-in a sponsor's consent lives on. [`prize-delivery.spec.md`](prize-delivery.spec.md) — the prize email whose credit mark this spec re-sources.

**Supersedes:** in [`prize-delivery.spec.md`](prize-delivery.spec.md), the "Presented by" section's source of the credit (the prize-popup placement holder), by `SP-11`, together with [`admin-prizes.spec.md`](admin-prizes.spec.md). In [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md), the "Sponsor editions" keying by opt-in and its two sponsor gaps, by `SP-13`. In [`admin-branding.spec.md`](admin-branding.spec.md) and [`admin-surface.spec.md`](admin-surface.spec.md), the **Sponsors & Branding** destination: Sponsors becomes its own sidebar item.

**Status:** Draft, written 2026-09-23 with the build. No open questions.

**Revised 2026-10-03 (the prize sheet):** the fan app shows a prize in one bottom sheet for bingo and trivia ([`../../webapp/fan-prize-sheet.spec.md`](../../webapp/fan-prize-sheet.spec.md) `FLOW-31`). Its credit is the prize's own "Provided by" (D-124), on both the info and the won body, with the prize logo on a white plate in a fixed 4:1 box; the contest's Presented by sponsor never credits a prize. The measured line follows that box. A sponsor whose only prize is on a trivia band counts as in that contest. Edited in place: the asset table, `SP-11`, `SP-13`, the counts, the Prize logo block, the measured line's row and copy, the render rules, Rule 4, a known gap closed and a new function audit.

**Revised 2026-09-30 (ruling, Arthur): a placement is for the whole contest, and the Slider slot is gone.** Dev only;
production is untouched.

- **No per-game placements, for any contest type.** A contest is one thing however many games it has: bingo is played
  on one board, and trivia is made for a single game. A placement record is (contest, sponsor, slots), with no
  `betEventId`. The console's "Whole contest" row, its "Every game, including games added later" sub-line and the
  "Different sponsor for one game" rows are gone from the builder's Sponsors step and the contest's Sponsors tab.
- **Placement slots by contest type:** bingo has the board banner (`boardBanner`); trivia has "Presented by"
  (`presentedBy`). The **Slider** slot is removed from bingo contests, and the sponsor page loses the Slider block
  (the "Icon" upload, `assets.sliderIcon`, upload field `sponsor.sliderIcon`). A custom marker on the board is set per
  contest by the contest's Progress marker (Overview → Basics, `progressMarkerImageUrl`, upload field
  `contest.progressMarker`, [`admin-contests.spec.md`](admin-contests.spec.md)).
- **Board marker precedence:** the contest's Progress marker, then the Brand marker, then the default triangle. No
  sponsor icon takes part, and the contest read has no `markerSponsors`.
- **Unchanged:** the prize credit (`prizePopup`) is set on the prize (`providedBySponsorId`, `SP-11`), not a placement;
  the Start page sponsors are the tenant's list on Brand.
- **The wire:** the fan app resolves the contest-wide placement everywhere (board banner, Presented by) with
  `resolveSponsorSlots(schedule, { contestId })`; the public sponsor schedule carries contest-wide placements only;
  `PUT /admin/contests/:contestId/placements` refuses a per-game target and the slider slot, and its response has no
  `games` list; "Where it appears" rows are contest and slot, with no game. The old `PUT /admin/sponsors/placements`
  is deleted.
- **Existing dev data:** `node-server/scripts/sponsor-contest-wide-migration.mjs` (dry run by default, `--apply`
  writes) turns per-game placements into contest-wide ones, deletes slider placements, and removes every sponsor's
  `assets.sliderIcon`. Where different games of one contest have different sponsors in the same slot, it reports the
  conflict and leaves it for a person to settle; it never picks one.

The text below is edited to these rules. Where an earlier revision note mentions per-game placements, a game scope,
"Whole contest" or the Slider, it is history.

**Revised 2026-09-29** (Arthur's Walk #3) — the sponsor page's preview draws no highlight ring: pointing at, or focusing, an artwork block switches the preview to the screen that shows it, and the Prize logo block opens the popup of the tier this sponsor provides in the contest shown ([`admin-preview.spec.md`](admin-preview.spec.md), "The preview follows what you point at"). "Where it appears" previews no longer carry `sponsor=`/`slot=`, and a provided prize's Preview opens its own tier.

**Revised 2026-09-29 (Walk #3): the Start page is the tenant's, not a contest's** (ruling, Arthur: "remove the
'Sign-in' slot from contest Sponsors, since it isn't a contest field. Brand gets a Start page section where the tenant
adds and removes start-page sponsors. Rename 'sign-in' to 'Start page' wherever it means the start page.")

- **Contest placements hold two slots: Board banner and Slider** (the Slider left on 2026-09-30). `signIn` leaves `PLACEMENT_SLOTS`, the contest's
  Sponsors tab, the builder's Sponsors step, the sponsor picker's `slot`, "Where it appears" and the contest preview links.
- **The Start page's sponsors are the tenant's own ordered list**, `B2BOrganization.startPageSponsorIds`, edited on
  Brand's Start page card ([`admin-branding.spec.md`](admin-branding.spec.md), "Start page") through
  `GET`/`PUT /admin/start-page`. Every id must be one of the tenant's sponsors. Any sponsor can be listed, artwork or not:
  with no Start page logo the Start page sets its name. Up to 12 (`START_PAGE_SPONSORS_MAX`).
- **The featured game no longer decides anything on the Start page.** The fan wire still carries `featured` and
  `nextGame` (the console's Sponsors read and older fan apps read them), but the Start screen reads only `startPage`.
- **The kit's keys are renamed**: `signInLogo` → `startPageLogo`, `signInTagline` → `startPageTagline`, and the upload
  field `sponsor.signInLogo` → `sponsor.startPageLogo` ("Start page logo"). `startPage` replaces `signIn` as a
  `SponsorSlot` (a place on screen the sponsor page previews, like `prizePopup`), never a placement slot.
- **Back-compat until the migration runs:** every reader goes through `normalizeSponsorAssets` (a legacy key is read as
  its new key when the new one is empty; legacy keys never leave the server). The store still accepts a legacy
  `signIn` placement slot (`STORED_PLACEMENT_SLOTS`); every read drops it, a placement holding nothing else is not shown,
  and both placement writes carry it over untouched so the migration can still move it. A PATCH that writes or clears a
  Start page key also clears its legacy name, so a cleared logo can't come back through the fallback.
- **`migrate-start-page-sponsors.mjs`** (dry run by default, `--apply` writes, idempotent) adds every sponsor holding a
  `signIn` placement to its tenant's Start page list (after any already there, earliest placement first, once each,
  only the tenant's own), removes the `signIn` slot from every placement (deleting one left empty), and renames the kit
  keys (a new key that already has a value wins).
- **Delete cascades to the list** (`SP-14`): the sponsor is pulled from `startPageSponsorIds`; the dialog says "It's on
  the Start page. It comes off, and the others stay in order."; the audit detail gains `removedFromStartPage`.
- **The sponsor page says so.** The header adds "On the Start page" (linking to Brand) when listed; "Where it appears"
  opens with "On the Start page, under “Presented by”." and "Edit on Brand"; `GET /admin/sponsors/:id` carries
  `onStartPage`, and `deleteCounts.startPage`.
- **Sponsor images fill the width** (ruling, Walk #3: "Sponsor images fill the full width wherever the layout allows,
  like contest banners do"). Fan app: the Start page logo and the prize popup's logo sit on a white plate that spans the
  column, the logo as wide as the plate with its height following its shape (Start page: at most 96 px for one
  sponsor; two to a row at 48 px; popup: at most 64 px). The board banner already did. Console: the sponsor page's wide
  upload fields show the image across the box, the Sponsors page cards fill their tile (a logo on the white plate),
  and the contest Sponsors tab shows the banner across its cell. The slider icon stayed at its marker size (it was
  removed on 2026-09-30).
- **A contest card's "Sponsored by"** (fan app) now names the contest-wide board-banner holder, where it named the
  contest-wide sign-in holder.

Where the text below still says "sign-in" for the sponsor slot, read "Start page" and the rules above.

**Revised 2026-09-28** (Arthur's Wave 4 walkthrough ruling) — the sponsor page's Data sharing section is an aligned table on the console's table primitives, with a Reference column and Export in its own actions column; "Where it appears" keeps the card header's inset. Sponsor delete takes the typed name only, with no re-authentication.

**Revised 2026-09-27 (Wave 4)** — rulings: each slot has a **Whole contest** holder and optional **Different sponsor for one game** overrides (no "Inherited"), and an override without usable artwork falls back to the whole-contest holder (both superseded on 2026-09-30: a placement is for the whole contest only); deleting a sponsor cascades instead of refusing; a sponsor may have several data-sharing agreements, each an opt-in linked to it with its own shared fields, reference and export; opt-in categories are gone; artwork fields are uploads ([`admin-uploads.spec.md`](admin-uploads.spec.md)). Edited in place below.

**Revised 2026-09-24** (ruling, Arthur) — sponsors get their own page, separate from Brand, and each sponsor gets a full page showing its artwork at real size in the fan-app spots it fills and where it appears. The sponsor drawer is retired; editing is inline on the page. Placements move to the contest page's Sponsors tab and keep three slots (Sign-in, Board banner, Slider) per contest and game (since 2026-09-30: per contest only, and the Slider is gone). The `prizePopup` slot is retired: a prize tier names the sponsor that provides it, and that "Provided by" drives the credit in the prize popup and the prize email. The sponsor recap credits a sponsor for its placements and the prizes it provides; opt-ins are a metric, not an attribution. Every rule of the 2026-09-23 spec that is still true is kept below, renumbered where the list grew.

## Overview

The 2026-09-23 build turned a sponsor from a string in a tenant's source file into a tenant-owned record with its artwork, its DPA field scope and slot-by-slot placements at games. The walkthrough on 2026-09-24 found the model sound and the surface hard to use:

- **No sense of size.** Three of the four images had no size, shape or format guidance, and the only view of an image was a 38px thumbnail. A tall banner pushed the board's squares off the screen and nobody could tell before publishing; a white logo vanished on the white prize email.
- **The prize credit was inferred.** Whoever held the prize-popup slot at the game where a prize was won was credited in the popup and the email. The tier editor said nothing about who would be credited, the same prize could be "presented by" different sponsors at different games, and the only way to change the credit was a grid on another screen.
- **Three notions of "this game's sponsor".** Slots credited placements, the popup and email credited a slot, and the recap credited sponsors through their consent opt-ins (contradiction 6 in the 2026-09-24 prizes review).
- **Buried.** Sponsors lived as a tab under Branding, with the schedule grid for every contest on the same tab.

**The whole change, in one line:** sponsors get a page of their own and a full page each, where the artwork is shown at true size in the fan app's own screens; placements move onto each contest as three slots; and the prize credit moves from a fourth slot to the prize, which names the sponsor that provides it.

**In scope:**

- The `B2BSponsor` model (unchanged) and `B2BSponsorPlacement`, one per contest and sponsor, with slots reduced to `boardBanner` (bingo) and `presentedBy` (trivia) (the Start page moved to the tenant's own list on 2026-09-29; the Slider and per-game placements went on 2026-09-30).
- The prize credit rule (`SP-11`), the retirement of `prizePopup` and its migration (`SP-12`), and the attribution rule that settles contradiction 6 (`SP-13`).
- The Sponsors page (`/sponsors`), the sponsor page (`/sponsors/new`, `/sponsors/:id`) and the contest page's Sponsors tab.
- Endpoints: the cursor-paged sponsor list, sponsor read/create/edit/delete, placements per contest, the "where it appears" read, and the public fan read. Contracts in `obs-b2b-shared/src/api/admin/sponsors.ts` and `api/b2b/sponsors.ts`.
- Data-sharing agreements: opt-ins linked to a sponsor, several per sponsor, each with its own field scope and reference (revised 2026-09-27).
- Everything the 2026-09-23 spec carried that still holds: the opt-in link, the fan wire's allowlist and render rules.

**Not in scope:**

- **The prize page.** Its "A sponsor provides this prize" checkbox and "Provided by" picker are specced in [`admin-prizes.spec.md`](admin-prizes.spec.md); this spec owns what the credit means for sponsors.
- **The fan app's screens.** The current fan app renders the slots and the credit ("Render rules" below); the fan-app overhaul is Wave 5's, on its own branch. This spec states the contract both read.
- **The preview frame.** [`admin-preview.spec.md`](admin-preview.spec.md) and [`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md).
- **The upload mechanics.** Every artwork field is an upload field; the route, the bucket and the checks are [`admin-uploads.spec.md`](admin-uploads.spec.md)'s.
- **Coupon codes and code batches** (the prizes work's seam), **sponsor sign-in** (`IDN-11` stands: sponsors receive exports and documents, they never log in), and **the free square** (a game-rules change, field-split doc).

---

## The model

### `B2BSponsor` — `${prefix}sponsors` (revised 2026-09-27: the data fields moved to the agreements)

```ts
interface B2BSponsor<TId = string> {
  _id?: TId;
  organizationId: TId;          // TEN-04: belongs to exactly one tenant
  name: string;                 // 1–60 chars, unique per tenant, case-insensitively
  websiteUrl?: string;          // "visit our sponsor" — https only
  assets?: SponsorAssets;       // the kit: the seven BRAND-02 assets (five built)
  // exportFields and dpaReference moved to each agreement (OptInDefinition) on 2026-09-27
  createdAt?: Date; updatedAt?: Date;
}
interface SponsorAssets {
  startPageLogo?: string; startPageTagline?: string;   // tagline ≤80 chars (stored as signInLogo/signInTagline before 2026-09-29)
  boardBanner?: string; boardBannerLink?: string;
  // sliderIcon removed 2026-09-30 (the Slider slot is gone; a contest's Progress marker replaces it)
  prizePopupLogo?: string;      // the prize logo: the credit when this sponsor provides a prize
}
```

Every image is an https URL, as before. Since 2026-09-27 the console fills it by upload, never by pasting ([`admin-uploads.spec.md`](admin-uploads.spec.md)); the stored value is still the URL, so no reader changes. `prizePopupLogo` keeps its name although no placement holds the prize popup any more: it is still the image the popup and the email show when the sponsor provides a prize, and renaming a stored field to follow a label would move data for no gain. The console calls it "Prize logo".

**A collection, not a subdocument on the org.** A sponsor is an entity: it has an id that other records reference (the opt-in's `sponsorId`, every placement, every library prize's `providedBySponsorId`, every `fan_export` audit row), its own lifecycle, and it is read without the rest of the org (the fan schedule, Exports, the recap). `optIns` stays on the org because an opt-in is none of those things (the test [`admin-branding.spec.md`](admin-branding.spec.md) applies in `THEME-11`/`THEME-12`, coming out the other way).

**The agreement reference moved to the agreement.** `dpaReference` (a free-text line, "Coca-Cola DPA v3, signed 2026-08-01") now sits on each data-sharing agreement beside the scope it governs (below, "Data-sharing agreements"), because a sponsor with two agreements has two signed documents. Free text because OBS does not hold the DPAs and cannot validate one; its value is that the next admin can find the document.

**The sponsor's mark** (list cards, the recap, the Sponsors tab) is `sponsorMarkUrl(assets)` in `obs-b2b-shared`: the Start page logo, else the prize logo, else the board banner.

| Asset | Console label | Where fans see it | Rendered size in the fan app |
|---|---|---|---|
| `startPageLogo` | "Logo" (Start page) | The Start page, under "Presented by", when Brand lists the sponsor | On a white plate spanning the column, the logo as wide as the plate (310px on a 390px phone), its height following its shape up to 96px; two to a row at 48px when several are listed; never cropped |
| `startPageTagline` | "Tagline" | Under the Start page logo | One line of small text; ≤80 characters |
| `boardBanner` | "Banner" | The board, between the header and the squares | The full board column (480px, 358px on a 390px phone); 4:1 until it loads, then the image's own ratio; 13px corners; never cropped |
| `boardBannerLink` | "Banner link" | Where a tap on the banner goes | — |
| `prizePopupLogo` | "Prize logo" | The prize sheet and the prize email, under "Provided by", for a prize this sponsor provides | Prize sheet (revised 2026-10-03): on a white plate, inside a fixed 4:1 box (224 × 56), contained: as large as fits the box, never cropped or stretched. Email: 32px tall, up to 160px wide, on the email's white card |

### `B2BSponsorPlacement` — `${prefix}sponsor_placements`

```ts
const PLACEMENT_SLOTS = ["boardBanner", "presentedBy"] as const;   // "signIn" left on 2026-09-29, "slider" on 2026-09-30
type PlacementSlot = (typeof PLACEMENT_SLOTS)[number];
const PLACEMENT_SLOTS_BY_CONTEST_TYPE = { bingo: ["boardBanner"], trivia: ["presentedBy"] };

/** A place on a fan screen that carries a sponsor's artwork: the placement slots, the Start page and the prize credit. */
type SponsorSlot = "startPage" | PlacementSlot | "prizePopup";

interface B2BSponsorPlacement<TId = string> {
  _id?: TId;
  organizationId: TId;
  contestId: TId;               // the whole contest: there is no betEventId (2026-09-30)
  sponsorId: TId;
  slots: PlacementSlot[];       // at least one, no repeats
  createdAt?: Date; updatedAt?: Date;
}
```

**A join record, not a restructuring of the contest.** A separate collection keyed by `contestId` leaves the most-read B2B document, and the board evaluator's path, untouched.

**A placement is for the whole contest** (ruling, Arthur, 2026-09-30). A contest is one thing however many games it has: bingo is played on one board, and trivia is made for a single game. So a placement holds its slots for the contest as a whole, and there is no game scope, for any contest type. (Before 2026-09-30 a placement could name one game, as "a different sponsor for one game"; that and the console's "Whole contest" label are retired, and the migration below folds the stored rows.)

**A contest type has its own slots** (`PLACEMENT_SLOTS_BY_CONTEST_TYPE`): bingo has the board banner, trivia has "Presented by". The console offers only the contest's slots, and a placement write refuses a slot the contest's type does not have.

**`SP-01` — One sponsor per slot, per contest.** Within a contest, a slot has at most one holder. This follows the fan app, not a console preference: the fan app renders exactly one sponsor per slot (`BoardPage.tsx` one `SponsorBanner`; trivia one "Presented by" line), and `resolveSponsorSlots` returns one sponsor per slot. Several sponsors in one slot would need a rotation rule and a fan-app change, which waits for the fan-app overhaul. `BRAND-03` (several sponsors per game) is several sponsors in different slots.

The contract enforces it (`putAdminSponsorPlacementsRequestSchema`: one row per sponsor, one holder per slot, and no `betEventId` on any row).

**`SP-02` — A slot is placeable only when the sponsor has its artwork.** `boardBanner` needs a banner. `presentedBy` takes any sponsor: without a logo it sets the name. (So does the Start page, not a placement since 2026-09-29.) The write refuses anything else (400, naming the sponsor and the missing piece): a placement that renders nothing is a control that lies. If the artwork is later cleared from a placed sponsor, the edit is allowed, and fans see nothing in that slot until it is back. The Sponsors tab marks the row so the admin can see why.

**Migrating the per-game and slider rows** (2026-09-30, dev only). `overboard_sports_backend/node-server/scripts/sponsor-contest-wide-migration.mjs` is a dry run by default and writes with `--apply`:

1. **Per-game placements are collapsed to contest-wide ones**, one holder per slot per contest.
2. **Conflicts are reported, not settled.** Where different games of one contest have different sponsors in the same slot, the report lists the contest, the slot and the sponsors, and those rows are left for a person to resolve. The script never picks one. Until then fans see only the contest-wide holder, if any; saving the contest's Sponsors tab settles it, because the save replaces every stored row of the contest, and a re-run then finds nothing.
3. **Slider placements are deleted**, and a placement left with no slots goes with them.
4. **`assets.sliderIcon` is removed** from every sponsor.

**Placements stay editable after the first fan joins.** The lock that starts with the first board ([`admin-contests.spec.md`](admin-contests.spec.md)) does not cover sponsors: a placement changes what is shown around the board, never what a fan plays or can win. A finalized contest refuses placement writes like every other edit (409 "This contest is finalized, so its settings can't change.").

### The prize credit: "Provided by"

A library prize (`B2BPrize`) carries `providedBySponsorId?: TId`, one of the tenant's sponsors (revised 2026-09-27: under the prize library the credit is the prize's, not the tier's). `PRIZE_CONTENT_FIELDS` copies it onto every tier that awards the prize, so a tier awards the provider of the prize it points at. It is edited on the prize page ("A sponsor provides this prize" → "Provided by", [`admin-prizes.spec.md`](admin-prizes.spec.md)); what it means for sponsors is stated here.

**`SP-11` — The prize credit follows the prize.** The prize sheet and the prize email credit exactly the sponsor the prize names as its provider, and nobody when it names none: the awarded prize on a win, the tier's or band's prize on info (2026-10-03). Never the contest's Presented by sponsor (D-124). `SP-07` still holds and is why this is safe: the popup and the email agree because they read the same field, not because two pieces of code resolve a slot the same way.

- **The awarded prize is a snapshot.** Every awarded prize snapshots the tier as promised (G2's tier snapshot), and the snapshot copies the provider at award time: `providedBy: { sponsorId, name, logoUrl, websiteUrl }` ([`admin-prizes.spec.md`](admin-prizes.spec.md)). The email reads the snapshot, so a resend credits the sponsor the fan was promised, as it looked then, even if the prize's provider was changed, re-logoed or deleted since. The won sheet reads the same snapshot's credit (`GET /b2b/prizes/awards`), so it shows what the winner was promised, whenever the fan opens it.
- **What the credit shows.** The sponsor's prize logo when it has one; its name as text when it does not. Any of the tenant's sponsors can be named as provider, artwork or not, because providing a prize is a fact about who pays for it, not a place on a screen; `SP-02`'s reasoning (a control that renders nothing) does not apply to a credit that always renders something. The logo links to the sponsor's website when one is set.
- **One word for one relation.** The credit reads "Provided by" in the prize sheet, the fan app's prize ladder and the email (the trivia sheet's "Sponsored by" and its contest sponsor are gone, 2026-10-03). The prize email's label changes from "Presented by" to "Provided by" with this ruling; "Presented by" stays on the Start page, where a sponsor presents the experience rather than a prize.
- **Deleting a sponsor clears it as a provider** on every library prize and tier copy (`SP-14`), so a prize credits nobody rather than a missing record; awarded prizes keep their snapshot's credit.
- **On the fan wire** a tier carries `providedBySponsorId` as an id, and the sponsor reaches the fan app through the public sponsor read, whose `sponsors[]` includes every sponsor a tier fans can see names (below, "The fan wire"). The preview receives the provider the same way and, for the prize page's standalone prize, also as the resolved `providedBy` in the snapshot's shape above ([`admin-preview.spec.md`](admin-preview.spec.md)).

### Retiring the `prizePopup` slot

**Argued.** A placement slot is a place on a screen a sponsor has bought at a game. The prize credit is a statement about who funds a prize. Modelling the second as the first made the same tier "presented by" different sponsors at different games, left the tier editor unable to say who would be credited, and gave the recap no clean way to say which sponsor a prize belonged to. The ruling puts the credit where the prize is.

**`SP-12` — The retirement migrates the credit, lists what it cannot migrate, and removes nothing.** The conversion is step 2 of the prize-type migration, `node-server/scripts/prize-type-migration.mjs` ([`admin-prizes.spec.md`](admin-prizes.spec.md), "Migration"), dry-run by default, idempotent, and run before anything stops reading the slot:

1. **Contest-wide holders become providers.** Each library prize gets `providedBySponsorId` set to the contest-wide `prizePopup` holder of the contests that award it, when every one of those contests has the same holder. When they disagree, the prize is listed and left without a provider.
2. **Game-level holders are listed, not converted.** A game-level `prizePopup` placement credited one game's winners; a prize has one provider wherever it is awarded, so there is nothing faithful to convert it to. The migration's report lists each such row (tenant, contest, game, sponsor, and the contest-wide holder it overrode, if any) for OBS to review and set a prize's provider by hand where it matters. A contest with only game-level holders gets no provider and is listed.
3. **Nothing is removed.** Stored `prizePopup` values stay in their placements' `slots` until the cleanup step (Known gaps).

**The transition, stated so no reader credits the wrong sponsor:**

- **Order:** the migration runs before the new readers ship. A tenant whose migration has not run shows no credit, never a wrong one.
- **Readers** never resolve `prizePopup` as a placement. The worker's credit (from the snapshot), the popup's credit and the recap read the prize's provider only (through the tier's copy).
- **Writes** refuse `prizePopup` in a placements body (400 "The prize credit is set on the prize."). A stored `prizePopup` value is not shown on the Sponsors tab, and a placements save carries it over untouched, so an older deployment reading the shared dev database keeps its credit until cleanup.
- **The public fan read** stops sending `prizePopup` from the first deploy (below, "The fan wire").
- **`prizePopup` stays a `SponsorSlot` value.** It no longer names a placement slot, but it still names a place on screen: the prize logo in the popup credit, which the sponsor page's Prize logo block previews. (The preview's `view.highlight`, which once ringed it, is deprecated and ignored since 2026-09-29.) `PLACEMENT_SLOTS` is what placement writes validate against.

### Attribution: which sponsors a game credits

**`SP-13` — A sponsor is attributed to a game by its placements and the prizes it provides; opt-ins are a metric.** A sponsor is attributed to (contest, game) when it holds a placement in a contest that runs the game (every placement is contest-wide since 2026-09-30) or provides one of the contest's tiers, or the prize of one of a trivia contest's bands (2026-10-03: a sponsor whose only prize is on a trivia band is active in that contest). This settles contradiction 6: there is one notion of "this activation's sponsor", and it is the one the fan saw.

**Why opt-ins are not attribution.** A fan accepting a sponsor's opt-in is a result the sponsor bought, not proof the sponsor was on the game. Keying the recap by opt-in meant a sponsor with a consent line but no artwork got an edition, and a sponsor on the board banner with no consent line got none. The opt-in stays exactly where it is useful: as the audience numbers in that sponsor's section of the recap (per agreement, the share of the game's players who accepted it at its current wording, an aggregate under `RPT-05`).

One pure helper, `attributedSponsors(placements, tiers, betEventId)` in `obs-b2b-shared`, decides it. The recap uses it for a game; the "Where it appears" read asks the same relation from the sponsor's side.

**What this changes in the recap** (supersedes the "Sponsor editions" section of [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md)):

- **Editions are keyed by sponsor record.** The switcher lists the game's attributed sponsors by name, with their mark.
- **The default edition** is the contest's board banner holder ("Presented by" holder, for trivia), else the provider of the lowest tier. With none, the recap is the team's own edition.
- **The audience panel** shows one line per data-sharing agreement of the edition's sponsor (its label and the share of the game's players who accepted it at its current wording), and is left out when the sponsor has none.
- **In a sponsor's edition**, the tiers it provides carry "Provided by {sponsor}" in the Prizes section.
- **`?sponsor=`** takes a sponsor id. An opt-in id still resolves, to the sponsor it links, so recap links already sent keep working. An opt-in linked to no sponsor record no longer gets an edition.

---

## Data-sharing agreements (revised 2026-09-27)

*Replaces "Moving `exportFields` off the opt-in" (2026-09-23), whose sponsor-side scope and write-through mirror existed to keep older deployments exporting correctly. There is no older deployment to protect.*

**An agreement is an opt-in linked to a sponsor.** `OptInDefinition.sponsorId` names a sponsor record. The opt-in's checkbox text is what the fan accepts, and its linked document (the full agreement text, stored in the database and shown in the fan app; [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), revision 2026-09-27) is what they can read before accepting. Opt-in categories (`kind`) are gone: "linked to a sponsor or not" is the only distinction, and it is the one every reader needs.

**`SP-04` — A sponsor may have several agreements; an opt-in links at most one sponsor.** The one-opt-in-per-sponsor refusal is lifted. `PUT /admin/config` still refuses (400) a `sponsorId` that is not one of the tenant's sponsors, and any link on the platform Terms opt-in. Linking and unlinking never bump `textVersion`: they change nothing the fan read. A sponsor with a newsletter agreement and a prize-shipping agreement is two opt-ins, each accepted or declined on its own.

**Each agreement carries its own data terms.** The field scope (`exportFields`) and the agreement reference (`dpaReference`, free text, ≤200 characters) live on the agreement, that is on the opt-in, and no longer on the sponsor. Two agreements are two signed documents that may release different fields (an email address for a newsletter; a name and address to ship a prize); one scope per sponsor would release the wider set under the narrower consent. Both are edited together on Exports through `PUT /admin/exports/field-scope` (`{ optInId, exportFields, dpaReference? }`, [`admin-exports.spec.md`](admin-exports.spec.md)); Fields & Opt-ins never sends them and a publish preserves them.

**`SP-03` — Fail closed, per agreement.** An agreement with no stored field scope has no export (409 "No DPA field scope configured"). A sponsor with no agreement has nothing to export and does not appear on Exports.

**An unlinked agreement stays exportable by its opt-in.** When an admin unlinks an opt-in, or the sponsor is deleted (`SP-14`), the opt-in keeps its wording, its fans' answers, its field scope and its reference. Exports keeps listing it under its label and exports it by `optInId`, exactly as the per-opt-in export works today: the fans agreed to that wording, a named admin ticked that scope, and the export must stay reproducible. **An opt-in is a data-sharing agreement when it is linked to a sponsor or carries a stored field scope**: `isDataSharingAgreement(optIn)` in `obs-b2b-shared`, the one test every former reader of `kind === "sponsor"` now uses. The platform Terms opt-in is never one (it can carry neither).

**What each reader does when a sponsor has several agreements:**

| Reader | Rule |
|---|---|
| "Who played" export (`RPT-01`, `RPT-05`) | Per agreement. The operator picks one (preselected when the sponsor has one); rows are fans who accepted **that** agreement at its current `textVersion`; columns are **that** agreement's scope. This is today's per-opt-in export unchanged ([`admin-exports.spec.md`](admin-exports.spec.md)). |
| Sponsor page, Data sharing | One row per agreement, each with its own counts and its own Export link. |
| Recap audience panel (`SP-13`) | One line per agreement of the edition's sponsor. |
| Fan actions export (`RPT-02`), "declined data sharing" | A fan declined data sharing when they declined **any** data-sharing agreement, at any version; not answering yet is not declining. Today's rule, with "sponsor-kind" replaced by `isDataSharingAgreement`. |
| Fans screen and fan page | Unchanged: one chip or row per opt-in. |
| Sponsor consent lookup (`util/admin-sponsors.ts`) | Returns every opt-in linked to the sponsor, not the first. |

**Migration** (`node-server/scripts/agreement-scope-migration.mjs`: dry-run by default, `--apply` writes, idempotent, run on the shared dev database): for every sponsor with a stored `exportFields` or `dpaReference`, copy them onto each linked opt-in that has none of its own (the old mirror means most already match). Readers then stop reading `B2BSponsor.exportFields` and `dpaReference`, the mirror write is removed, and both fields leave the sponsor's interface and admin contract. The stored values stay in the documents, unread.

---

## Endpoints

All under `/admin`, admin Clerk only, scope from `req.adminScope`, the usual targeting (a tenant caller's own org; OBS staff name `?tenant=`, refused for anyone else). A sponsor or contest id from another tenant is 404, not 403. Contracts in `obs-b2b-shared/src/api/admin/sponsors.ts`.

"Write" is `refuseReadOnlyWrite` first, as every config write (D-063): tenant `org:admin` whose tenant is not paused, or OBS staff. Every write calls `clearOrgCache()` and clears the sponsor-schedule cache (`THEME-15`'s reason: an admin who places a sponsor and opens the site must see it).

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/sponsors` | `requireAdmin` | Cursor-paged list, name A–Z, search by name, optional `slot` |
| GET | `/admin/sponsors/:sponsorId` | `requireAdmin` | One sponsor, with its counts |
| POST | `/admin/sponsors` | `requireAdmin` + write | Create |
| PATCH | `/admin/sponsors/:sponsorId` | `requireAdmin` + write | Partial edit; `expectedUpdatedAt` precondition |
| DELETE | `/admin/sponsors/:sponsorId` | `requireAdmin` + write + typed name | Cascades (`SP-14`); audited `sponsor_delete` |
| GET | `/admin/sponsors/:sponsorId/appearances` | `requireAdmin` | "Where it appears", cursor-paged |
| GET | `/admin/contests/:contestId/placements` | `requireAdmin` | One contest's placements (the Sponsors tab) |
| PUT | `/admin/contests/:contestId/placements` | `requireAdmin` + write | One contest's placements, whole |
| GET | `/b2b/org/:subdomain/sponsors` | public | The fan read (below, "The fan wire") |

**`SP-05` — Only deletion is audited.** Create, edit and placement are configuration, reversible by editing again (the branding module's line, `THEME-10`). Deleting a sponsor is irreversible; the `sponsor_delete` row carries the sponsor id, its name (so history stays readable once the record is gone) and what went with it (`SP-14`), and nothing else.

### `GET /admin/sponsors`

The Sponsors page and every sponsor picker (the Sponsors tab's picker, the prize editor's "Provided by", the Fields & Opt-ins link). Paged by [`admin-lists.spec.md`](admin-lists.spec.md): `cursor`, `limit` (default 50, pickers 30), `q` (name, case-insensitive, anywhere). Order: name A–Z case-insensitively, then id. Index `{ organizationId, name, _id }`.

- **`slot`** (optional: `boardBanner` or `presentedBy`; with none, as on Brand's Start page card, every sponsor is offered): each row gains `fillsSlot: boolean` (`SP-02`'s test) and the order becomes sponsors that fill the slot first, then name. The Sponsors tab's picker uses it.
- **Response:** `{ sponsors: SponsorListRow[], page }`, where a row is `{ sponsorId, name, websiteUrl?, markUrl?, startPageLogo?, prizePopupLogo?, counts: { contests, placements, prizes, agreements }, fillsSlot?, updatedAt }`. The card uses `startPageLogo` and `markUrl`; the prize page's "Provided by" picker shows `prizePopupLogo`.
- **Counts** say where the sponsor is in use now: `contests` is the number of contests that are not finalized in which the sponsor is attributed (`SP-13`, trivia bands' prizes included, so the sponsor cards' count agrees with the sponsor page's "Active in …"); `placements` counts slots (one slot in one contest is one placement) in those contests; `prizes` counts the library prizes it provides; `agreements` counts the opt-ins linked to it. Computed for the page's rows only. (Today's wire carries `placementCount`, placement documents per sponsor, and `linkedOptIn`; both are replaced.)
- **Transition:** today's response also carries `contests[]` (every contest with its games and placements) and `featured`. Their only reader is the retired Sponsors & Branding tab; they are dropped when it goes.

### `GET /admin/sponsors/:sponsorId`

The sponsor page. Returns every `B2BSponsor` field except `organizationId`, the same `counts` as the list, `activeContests` (contests attributed and not finalized, for the header), `updatedAt`, and:

- **`agreements[]`**, one per opt-in linked to it, in the tenant's opt-in order: `{ optInId, label, textVersion, publishedAt, memberCount, accepted, exportFields, dpaReference? }`, where `accepted` counts members who accepted it at its current `textVersion` (the Fields & Opt-ins stat, one vocabulary) and `exportFields` is that agreement's scope (empty when none is stored).
- **`deleteCounts`**: `{ placements, contests, prizes, agreements }`, exactly what a delete would remove, clear or unlink (`SP-14`), counting every placement including finished and finalized contests', so the dialog can say it.

404 for another tenant's id.

### `POST /admin/sponsors`

Body `{ name, websiteUrl? }`. `name` trimmed, 1–60 characters, unique per tenant case-insensitively (409 `sponsor_name_taken`, "A sponsor with this name already exists."). `websiteUrl` https only, ≤2000 (400, "Use a link that starts with https://"). Responds 201 with the sponsor as the GET returns it. Not audited (`SP-05`).

### `PATCH /admin/sponsors/:sponsorId`

The sponsor page saves one field at a time. Body: any of `name`, `websiteUrl`, `assets` (a partial `SponsorAssets`: only the keys sent change; an image key's value is the URL an upload returned), plus the required `expectedUpdatedAt`. `null` clears a field (`$unset`, so cleared and never-set are one state).

- **Validation** as POST; every image and link https only, ≤2000; `startPageTagline` ≤80. The legacy `signInLogo`/`signInTagline` keys are refused. Field errors come back keyed by field and render under that field.
- **Precondition:** an `expectedUpdatedAt` that does not match is 409 `stale_sponsor`.
- **Clearing placed artwork is allowed** (`SP-02`, last paragraph).
- **Not here:** an agreement's `exportFields` and `dpaReference`, which Exports edits per agreement (`PUT /admin/exports/field-scope`).
- Responds with the sponsor as the GET returns it.

The whole-profile `PUT /admin/sponsors/:sponsorId` goes with the retired drawer.

### `DELETE /admin/sponsors/:sponsorId`

No re-authentication (revised 2026-09-28); the typed name is the confirmation. Body `{ confirmName }`, the sponsor's name as typed in the dialog (trimmed, case ignored; 400 when it differs). Checks in order: 404 for another tenant's id; the write gate; the name.

**`SP-14` — Deleting a sponsor just works: it cascades** (ruling 2026-09-27; replaces the 2026-09-24 rule that refused while anything referred to it, and today's `sponsor_linked` refusal). Nothing is refused because the sponsor is in use. In order:

1. **Audit first.** `sponsor_delete` with `{ sponsorId, name, placementsRemoved, contestsAffected, prizesCleared, agreementsUnlinked }`. A failed audit write stops the delete (500), as today.
2. **Placements.** Every placement naming it is deleted, in every contest: live, finished and finalized alike. Its slots empty at once (the caches are cleared in step 5).
3. **Prizes.** `providedBySponsorId` is cleared on every library prize naming it and on every tier copy naming it, finalized contests' tiers included, since a reference to a record that no longer exists would resolve to nothing anyway ([`admin-prizes.spec.md`](admin-prizes.spec.md) states the prize side). Award snapshots are never touched: prizes already won keep the credit they were given (`SP-11`).
4. **Agreements.** Every opt-in linked to it is unlinked (`sponsorId` removed) in one organization write. The opt-ins stay, with their wording, their document, their fans' answers, their field scope and their reference; no `textVersion` moves; they stay exportable by opt-in (`SP-03`).
5. **The record.** The sponsor is deleted; the org cache and the sponsor-schedule cache are cleared.

Steps 2 to 5 run in that order without a cross-collection transaction. Each step is idempotent, so a failure part-way is finished by deleting again; once the record is gone the answer is 404 and the tombstone already records the delete.

**History stays readable.** Every new `fan_export` audit row stores `sponsorName` and the agreement's `optInLabel` beside the ids. "Recent exports" names a row from the live record, else the row's stored name, else the `sponsor_delete` tombstone's name, and only then the raw id. A recap link carrying a deleted sponsor's id opens the team's own edition.

Response 200: `{ deleted: { sponsorId, placementsRemoved, contestsAffected, prizesCleared, agreementsUnlinked } }`.

### `GET /admin/sponsors/:sponsorId/appearances`

"Where it appears". `kind=placements` or `kind=provides`, paged by the convention.

- **`placements`** rows: `{ contestId, contestName, contestState, finalized, slot }`, one row per slot in one contest, with no game (revised 2026-09-30). Order: contest newest first, then slot order.
- **`provides`** rows: `{ contestId, contestName, contestState, finalized, tierIndex, prizeName }`, one per tier awarding a prize it provides. Order: contest newest first, then tier order.
- Closed and finalized contests are included (they are history the recap still attributes). `contestState` is the stored state (Draft, Open, Closed) the contest page shows, with `finalized` for its badge.

### `GET /admin/contests/:contestId/placements`

The Sponsors tab and the builder's Sponsors step (both render the slot editor below). Returns:

```ts
{
  contestId: string;
  placements: { sponsorId: string; slots: PlacementSlot[] }[];   // contest-wide; no games list (2026-09-30)
  sponsors: { sponsorId: string; name: string; markUrl?: string; assets: SponsorAssets;
              fills: Record<PlacementSlot, boolean> }[];                                           // every sponsor placed here
  providers: { tierIndex: number; prizeName: string; threeInARows: number; sponsorId: string | null }[];
  finalized: boolean;
  updatedAt: string;
}
```

404 for another tenant's contest. A stored `prizePopup` value is never returned.

### `PUT /admin/contests/:contestId/placements`

Body `{ placements: { sponsorId: string; slots: PlacementSlot[] }[] }`, the contest's whole schedule of its slots. The slot editor sends it after every pick or removal, so each change is one write.

- **Validation, 400:** `SP-01` (one holder per slot), `SP-02` ("Coca-Cola has no board banner."), every slot is one the contest's type has, every `sponsorId` is the tenant's, no `prizePopup` ("The prize credit is set on the prize."). A row that names a game (`betEventId`) and the `slider` slot are refused (2026-09-30).
- **409:** a finalized contest ("This contest is finalized, so its settings can't change.").
- **Replace semantics:** the contest's slots are replaced, and a legacy per-game row left by the migration goes with them (fans never saw it); stored `prizePopup` values on contest-wide rows are carried over untouched.
- Responds as the GET.

The old `PUT /admin/sponsors/placements` (`{ contestId, placements[] }`) is deleted (2026-09-30).

**Tenant deletion sweeps both collections**, like every other tenant-owned collection. **Contest deletion** removes the contest's placements (Wave 3, `end-to-end-flow.spec.md` §3.2).

---

## The screens

### Navigation

**Sponsors is its own sidebar item** under Configuration, after Fields & Opt-ins and before Brand (admin-surface's Navigation table and the console mocks), at `/sponsors`, with its own hue (the per-item hue treatment G1 builds: a thin bar on the item's right edge, and the KpiTile top outline on the page's hued cards). **Brand** keeps `/branding`. The Sponsors & Branding label and its tab strip go; `/branding/sponsors` redirects to `/sponsors`.

**Argued.** The 2026-09-23 spec put sponsors beside the brand because both answer "what does the fan app look like". In use they are different jobs on different clocks: the brand is set for a season and edited as one draft; sponsors are records, each with its own artwork and its own list of contests, and they change when deals change. The ruling separates them, and the separation also removes the old tab's second job (the schedule grid for every contest), which now lives on each contest where the question "who is on this game" is asked.

### `/sponsors` — Sponsors

**Head:** eyebrow "Workspace", H1 "SPONSORS", primary "New sponsor" (writers only).

**Toolbar** (sticky, from the list kit): search ("Search sponsors") and the count ("8 sponsors", "1 sponsor").

**Cards**, a responsive grid (`repeat(auto-fill, minmax(300px, 1fr))`, 16px gaps), endless scroll through `GET /admin/sponsors`. Each card:

1. **Mark tile:** the sponsor's mark filling the tile (as wide as it goes, never cropped): the Start page logo or the prize logo on the white plate the fan app draws it on, spanning the tile; else the banner; else the name's first letter in the tile.
2. **Name** (Archivo 18/700) and the **website** as its host ("coca-cola.com"), omitted when there is none.
3. **Where it is:** "Appears in 2 contests · 3 placements · provides 1 prize", from `counts`. A part that is zero is left out ("Appears in 1 contest · provides 1 prize"); when all three are zero the line reads "Not in any contest".

The whole card opens `/sponsors/:id`.

| State | What shows |
|---|---|
| Loading | Six skeleton cards in the card's shape |
| Ready | Cards, count |
| No sponsors | "No sponsors yet." and, for writers, "New sponsor" |
| No matches | "No sponsors match." with "Clear search" |
| First page failed | The load-failure card, "Couldn't load sponsors.", with Retry and Tell Overboard |
| A later page failed | The list kit's "Couldn't load more." with "Try again" |

### `/sponsors/new` — create

The sponsor page's header in create form: back link "Sponsors", eyebrow "New sponsor", a **Name** field (focused, ≤60) and a **Website** field (optional, hint "Linked from the sponsor's logos and banner."), and primary "Create sponsor". Nothing else renders until the record exists, because every other section saves to it. "Create sponsor" POSTs; on success the URL is replaced with `/sponsors/:id` and the Artwork section opens with the Start page block's Logo field focused. A name clash answers under the Name field: "A sponsor with this name already exists."

### `/sponsors/:id` — the sponsor page

**Header:** back link "Sponsors"; eyebrow "Sponsor"; H1 the name; under it the website; a status line from `activeContests`: "Active in 2 contests" / "Active in 1 contest", or "Not in any contest". For writers the name and the website are inline-editable: a click turns the text into its field, Enter or leaving the field saves, Escape restores.

**Saving is inline, everywhere on the page.** A text field saves when it loses focus or on Enter; a link field saves when it loses focus; an upload saves when it completes. Each save is one `PATCH` with the sponsor's `updatedAt`. The section's header then shows the confirmation line "Saved." (the console's publish-line idiom, success text colour), which clears after four seconds or on the next edit. Errors answer under the field that caused them. A 409 `stale_sponsor` shows under the section header: "This sponsor changed since you opened it." with "Reload". Nothing is a draft: a sponsor has no publish step, and every value on the page is live once saved.

The page is four sections, top to bottom.

#### 1. Artwork

Two columns at ≥1280px: the slot blocks on the left, and `FanAppPreview` on the right, sticky, in its Phone size (390×844, shown at 1:1 and never scaled, so artwork in the frame is at true size). Below 1280px the frame drops under the slot blocks.

**The three slot blocks**, in the order a fan meets them (the Slider block, with its "Icon" upload, was removed on 2026-09-30). Each has a title, one line saying where fans see it, its fields, and the measured line under each image field:

| Block | Line | Fields |
|---|---|---|
| "Start page" | "Under “Presented by” on the Start page, when Brand lists this sponsor there." | "Logo" (upload, wide, on the white plate); "Tagline" (≤80, with a counter "32/80") |
| "Board banner" | "Across the board, between the header and the squares." | "Banner" (upload, wide); "Banner link" (link, hint "Where the banner leads. Leave it blank to use the website.") |
| "Prize logo" | "With a prize this sponsor provides, in the app and the prize email." | "Logo" (upload) |

**Every image field is the console's upload field** ([`admin-uploads.spec.md`](admin-uploads.spec.md)): a box to drop an image on or click to browse, with the accepted types, the 5 MB limit and the fan app's box size as its hint ("PNG, JPG, SVG or WebP · up to 5 MB · shown 40 px tall"). Filled, it shows the image, its file name and size, "Replace" and "Remove"; Remove saves `null`. There is no URL box.

**The frame shows each slot in its real spot.** Pointing at a block, or focusing any field in it, switches the frame to the screen that holds that slot (revised 2026-09-29: nothing is ringed; the switch is the feature): Start page on Start, Board banner on Board, Prize logo on Prize, **opening the won sheet of the tier this sponsor provides** in the contest shown (the first such tier, or a trivia contest's first such band; the first when it provides none there). The frame waits for the pointer to rest and keeps the last screen when the pointer leaves. What the frame renders is the fan app itself, on the tenant's saved brand, with this sponsor's artwork as saved: an upload saves when it completes, and the frame shows the new image at once. The frame's contest is chosen from a select above it listing the contests in "Where it appears", defaulting to the one with the next game. A sponsor that appears in no contest has no frame (there is no sample contest to show it in): the slot blocks, their measured lines and the prize email's mark stand alone, and "Where it appears" says how to place it. The mechanics (the render document, the contest's placements resolved for the contest shown, the jump to the screen that shows a block) are [`admin-preview.spec.md`](admin-preview.spec.md)'s.

**The prize email's mark** is not a fan-app screen, so the Prize logo block also shows it directly: "In the prize email", the logo at the email's exact box (32px tall, up to 160px wide) on the email card's white. This is the one sample drawn in console markup, and it is narrow by design: the email's card is white by construction ([`prize-delivery.spec.md`](prize-delivery.spec.md), "How it is built"), and the question the admin has is whether the logo survives on white, which a logo at its exact size on that white answers truthfully.

**`SP-15` — The measured line states facts.** Under each image field, once the image loads in the console, one line gives the image's natural size and what the fan app will do with it, computed from the slot's rendering rule in the table below. It says nothing about what the admin should do: no "too small", no "recommended".

| Slot | The fan app's box | "fits" when | Otherwise |
|---|---|---|---|
| Start page logo | a white plate spanning the column; the logo 310px wide (on a 390px phone), its height following its shape up to 96px | always drawn to the plate: the line gives the size | "1200 × 200 · will show at 310 × 52 on a white plate"; "600 × 400 · will show at 144 × 96 on a white plate" |
| Board banner | the 480px column, height from the image | the image is 4:1 (within 1%): "1200 × 300 · fits" | "1200 × 600 · will show at 480 × 240" |
| Prize logo | the app (revised 2026-10-03): on a white plate with the prize, the logo fitted whole inside a fixed 224 × 56 box (4:1), never cropped or stretched; email 32px tall up to 160px | never "fits": each surface is named | "400 × 200 · will show at 112 × 56 on a white plate with the prize in the app · fits the email"; "1200 × 200 · will show at 224 × 37 on a white plate with the prize in the app · will show at 160 × 27 in the email" |

Sizes are CSS pixels. The banner's are at the fan app's widest column, 480px; on a 390px phone, as in the frame, the column is 358px and the banner scales with it. While an image is loading the line is empty. An image that does not load reads "This image didn't load." An upload the server refuses (type, size, too small) answers in the upload field, with the upload spec's messages. The measured line uses the natural size the upload returned, so it shows at once.

**Defaults when nothing is uploaded** (revised 2026-09-28). What the fan app shows in an image's place when the sponsor has none:

- **Start page logo:** the sponsor's name, set in a tile the size of the plate (any sponsor can be on the Start page).
- **Board banner:** nothing; a sponsor without one cannot hold the slot (`SP-02`), and the layout closes around it (`SP-08`).
- **Prize logo:** the sponsor's name in place of the logo. The "Provided by" credit always shows.

#### 2. Where it appears

A flush card, "Where it appears", with a table (endless scroll, `kind=placements`): **Contest** · **Slot** · a "Preview" link. There is no Game column: a placement is for the whole contest (2026-09-30).

- **Contest** is the contest's name with its state chip, and the Finalized badge when finalized; it links to that contest's Sponsors tab (`/contests/:id/sponsors`).
- **Slot** is "Board banner" (bingo) or "Presented by" (trivia).
- **The Start page** (since 2026-09-29): when the tenant's Start page lists the sponsor, the card opens with "On the Start page, under “Presented by”." and "Edit on Brand" (to `/branding`), and the empty line below is not shown.
- **"Preview"** opens the contest's Preview tab on that slot's screen (`/contests/:id/preview?screen=board` for the board banner).

Under the table, the prizes it provides (endless, `kind=provides`), one line each: "Provides: Free hot dog in Hawks 2026", linking to the contest's Prizes tab (`/contests/:id/prizes`), with a "Preview" link that opens the contest's preview on Prize with that tier's prize (`/contests/:id/prizes?preview=prize&tier=<n>` since the preview became a drawer, D-113; `n` counted from 1 in tier order: the row's 0-based `tierIndex` plus one).

Empty: "Not placed in any contest. Place sponsors on a contest's Sponsors tab." When it provides prizes but holds no placement, the table is left out and the provides lines stand alone. The empty line and the provides lines sit on the card header's own 18px inset, with no doubled gap under the title (revised 2026-09-28).

#### 3. Data sharing

A flush card, "Data sharing" (revised 2026-09-27; it replaces the "Data" card and its inline "Data agreement" field). A table on the console's own table primitives (revised 2026-09-28: headers and cells share one left edge on the card header's 18px inset, like every other console table), one row per agreement from `agreements[]`:

| Column | Content |
|---|---|
| **Agreement** | The agreement's label, linking to its row on Fields & Opt-ins (`/config?tab=optins&optIn=<optInId>`), with its version beneath ("Version 3 · Sep 12, 2026") |
| **Agreed** | "412 of 1,284 fans" (accepted at the current wording, of all members) |
| **Shared fields** | The scope as field labels ("First name · Last name · Email"), or "No fields chosen yet" when none is stored, in which case it has no export (`SP-03`) |
| **Reference** | The agreement's reference (`dpaReference`), or a dim dash when none is stored |
| (actions, right-aligned) | **"Export"**: opens Exports with this agreement chosen (`/exports?agreement=<optInId>`). Absent when no fields are chosen |

**"Edit on Exports"** sits in the card header, to the field scope card with the first agreement selected.

Under the table, on the card's inset with the table's hairline above it, the quiet line "Link another agreement on Fields & Opt-ins", to the Opt-ins tab. With no agreement, the card reads "No data-sharing agreement yet." and the same link says "Link one on Fields & Opt-ins".

#### 4. Danger zone

A danger card, "Danger zone": "Deleting a sponsor can't be undone." and the danger button "Delete sponsor". Never disabled (`SP-14`).

The button opens a centred dialog built from `deleteCounts`:

- Title: "Delete Northside Credit Union?"
- Body: "This removes it everywhere:" and a short list of what applies, each with its count and leaving out any that is zero:
  - "3 placements in 2 contests. Those spots show no sponsor."
  - "It's credited on 2 prizes. They'll show no sponsor."
  - "It's on the Start page. It comes off, and the others stay in order." (2026-09-29)
  - "2 data-sharing agreements are unlinked. The opt-ins stay, and fans' answers are kept."
  - Then: "Past exports and prize emails keep its name. This can't be undone."
- A field "Type Northside Credit Union to confirm", and the danger button "Delete sponsor", enabled once the name matches; "Cancel". Confirming runs the delete; nothing else is asked (revised 2026-09-28).

On success the console returns to `/sponsors`, whose head shows the line "Deleted Northside Credit Union.". A failure shows "Couldn't delete this sponsor. Try again." in the dialog.

**States of the page**

| State | What shows |
|---|---|
| Loading | Header skeleton, three slot-block skeletons, a frame-shaped skeleton |
| Ready | As above |
| Not found (deleted, or another tenant's id) | "This sponsor doesn't exist." with a link "Back to sponsors" |
| Load failed | The load-failure card, "Couldn't load this sponsor.", with Retry and Tell Overboard |
| Member, or a paused tenant | The same page as a view-only presentation (below) |

### The contest's Sponsors tab — the slot editor

On the contest page ([`admin-contests.spec.md`](admin-contests.spec.md)) at `/contests/:id/sponsors`, and as the builder's Sponsors step (optional: Continue is never blocked, and the review counts "Sponsors (n placements)"). **Revised 2026-09-27:** the slots-by-games grid and its "Inherited" cells are replaced by one card per slot, because a grid cell that shows a sponsor it does not hold needed a label to explain itself, and the ruling asked for a model that needs none.

**One card per slot the contest's type has** (revised 2026-09-30): a bingo contest has "Board banner" ("Across the board, between the header and the squares"); a trivia contest has "Presented by" ("The sponsor's small logo and name on every trivia screen, and the credit on its prizes."). There is no Slider card (removed 2026-09-30: a contest's own marker is its Progress marker, on Overview → Basics), and no Sign-in or Start page card: the Start page is the tenant's, set on Brand (2026-09-29).

Each card holds one row, the contest's holder: its artwork at the slot's shape (the banner across the whole cell, its height following its shape, the name beneath it; for "Presented by", the logo or the name) with the sponsor's name, then "Change" and "Remove". With no holder: "No sponsor" and the button **"Add sponsor"**. A placement is for the whole contest, so there is no game row, no "Whole contest" label and no "Different sponsor for one game" (all removed 2026-09-30).

**The sponsor picker.** A popover anchored to the button, titled with the slot ("Board banner"). Search ("Search sponsors") over an endless list of the tenant's sponsors (`GET /admin/sponsors?slot=`), each with its mark and name. It leaves out the current holder, since choosing it would change nothing. Sponsors that fill the slot come first; the rest are listed after them, disabled, with the missing piece ("No board banner"). Choosing one saves at once.

**Artwork gone** (`SP-02`, the cleared-after-placing case): the row shows the name with a warning badge ("No banner") and one line: "Fans don't see this until Northside Credit Union has a board banner."

**Saving.** Each pick or removal sends the whole schedule (`PUT /admin/contests/:contestId/placements`). The row shows its new holder straight away with a quiet pending mark; on success the tab's header shows "Saved." On failure the row returns to what it was and the message shows under that card: the server's 400 ("Coca-Cola has no board banner."), a finalized contest ("This contest is finalized, so its settings can't change."), or "Couldn't save. Try again." for anything else.

**Provided by.** Under the slot cards, a card "Provided by" lists the contest's tiers in ladder order: "Tier 1", the prize's name, "3 bingos", and its provider's mark and name, or "No sponsor". Read-only here; "Edit on Prizes" links to the Prizes tab. With no tiers: "No prize tiers yet." with "Add one on Prizes".

**Preview.** A "Preview" link under the Provided by card opens the Preview tab on the screen that shows the contest's slot (Board, for a bingo contest). The holder is the same at every game, so there is one link, not one per game. (The Start page is previewed on Brand.)

| State | What shows |
|---|---|
| Loading | One skeleton slot card |
| Ready | Slot card, Provided by, Preview link |
| The tenant has no sponsors | In place of the cards: "No sponsors yet. Add one on the Sponsors page." with the link (writers), "No sponsors yet." (members) |
| Finalized | View-only presentation; the contest page's finalized treatment applies |
| Locked (a fan has joined) | Unchanged: placements stay editable |
| Load failed | The load-failure card, "Couldn't load this contest's sponsors.", with Retry and Tell Overboard |

### The view-only presentation

`org:member`, and every user of a paused tenant, see the same Sponsors page, sponsor page and Sponsors tab as state (D-059), with the console's read-only line in the page head: "Read-only — only organization admins can change sponsors" (a paused tenant sees the paused banner instead). No "New sponsor"; names, websites and fields are static text; images show without the upload box; an empty holder reads "None" and the Sponsors tab has no Add, Change or Remove; the Danger zone is absent. `FanAppPreview` works exactly as for an admin, because a preview writes nothing.

### Exports and Fields & Opt-ins

- **Exports** lists each data-sharing agreement: under its sponsor's name when linked ("Northside Credit Union · Share my info with Northside"), under its own label when not. The field scope card edits one agreement's scope and its agreement reference together. The "Who played" generator picks an agreement (grouped by sponsor, preselected when the page was opened with `?agreement=` or the tenant has one). Every request is keyed by the opt-in ([`admin-exports.spec.md`](admin-exports.spec.md)).
- **Fields & Opt-ins** carries a **Sponsor** picker on every opt-in except the platform Terms row ("Not linked", or one of the tenant's sponsors, from the paged sponsor list), and no category control ([`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), revision 2026-09-27).

### Copy

| Where | String |
|---|---|
| Sidebar, page head | "Sponsors", eyebrow "Workspace", H1 "SPONSORS" |
| List | "New sponsor" · "Search sponsors" · "8 sponsors" / "1 sponsor" · "Appears in 2 contests · 3 placements · provides 1 prize" · "Not in any contest" · "No sponsors yet." · "No sponsors match." · "Clear search" · "Couldn't load sponsors." · "Deleted Coca-Cola." |
| Create | "New sponsor" · "Name" · "Website" · "Linked from the sponsor's logos and banner." · "Create sponsor" · "A sponsor with this name already exists." |
| Sponsor header | "Sponsors" (back) · "Sponsor" · "Active in 2 contests" / "Active in 1 contest" · "Not in any contest" · "On the Start page" |
| Saving | "Saved." · "This sponsor changed since you opened it." · "Reload" · "Use a link that starts with https://" (link fields only) |
| Artwork | "Start page" · "Board banner" · "Prize logo" · the three lines in the block table · "Logo" · "Tagline" · "32/80" · "Banner" · "Banner link" · "Where the banner leads. Leave it blank to use the website." · "In the prize email" · the upload field's strings ([`admin-uploads.spec.md`](admin-uploads.spec.md)): "Drop an image here or browse" · "PNG, JPG, SVG or WebP · up to 5 MB · shown 40 px tall" · "Replace" · "Remove" |
| Measured line | "1200 × 300 · fits" · "1200 × 200 · will show at 310 × 52 on a white plate" · "400 × 200 · will show at 112 × 56 on a white plate with the prize in the app · fits the email" · "This image didn't load." |
| Where it appears | "Where it appears" · "Contest" · "Slot" · "Board banner" · "Presented by" · "Preview" · "Provides: Free hot dog in Hawks 2026" · "Not placed in any contest. Place sponsors on a contest's Sponsors tab." · "On the Start page, under “Presented by”." · "Edit on Brand" |
| Data sharing | "Data sharing" · "Version 3 · Sep 12, 2026" · "Agreed" · "412 of 1,284 fans" · "Shared fields" · "No fields chosen yet" · "Agreement" · "Reference" · "—" · "Export" · "Edit on Exports" · "Link another agreement on Fields & Opt-ins" · "No data-sharing agreement yet." · "Link one on Fields & Opt-ins" |
| Danger zone | "Danger zone" · "Deleting a sponsor can't be undone." · "Delete sponsor" · "Delete Coca-Cola?" · "This removes it everywhere:" · "3 placements in 2 contests. Those spots show no sponsor." · "It's credited on 2 prizes. They'll show no sponsor." · "It's on the Start page. It comes off, and the others stay in order." · "2 data-sharing agreements are unlinked. The opt-ins stay, and fans' answers are kept." · "Past exports and prize emails keep its name. This can't be undone." · "Type Coca-Cola to confirm" · "Cancel" · "Nothing was deleted." · "Couldn't delete this sponsor. Try again." |
| Page states | "This sponsor doesn't exist." · "Back to sponsors" · "Couldn't load this sponsor." |
| Sponsors tab | "Board banner" · "Across the board, between the header and the squares" · "Presented by" · "The sponsor's small logo and name on every trivia screen, and the credit on its prizes." · "No sponsor" · "Add sponsor" · "Change" · "Remove" · "No banner" · "Fans don't see this until Northside Credit Union has a board banner." · "Search sponsors" · "No board banner" · "Saved." · "Coca-Cola has no board banner." · "This contest is finalized, so its settings can't change." · "Couldn't save. Try again." · "None" |
| Sponsors tab, below | "Provided by" · "Tier 1" · "3 bingos" · "No sponsor" · "Edit on Prizes" · "No prize tiers yet." · "Add one on Prizes" · "Preview" |
| Sponsors tab states | "No sponsors yet. Add one on the Sponsors page." · "No sponsors yet." · "Couldn't load this contest's sponsors." |
| View-only | "Read-only — only organization admins can change sponsors" |
| Server refusals shown as-is | "Coca-Cola has no board banner." · "The prize credit is set on the prize." · the refusal of a slot the contest's type doesn't have, or of a row naming a game (the console sends neither) |

---

## Permissions

| Control | Gate | Who holds it |
|---|---|---|
| Sponsors page, sponsor page, Sponsors tab, their previews | `requireAdmin` (`org:tenant_config:read`) | Every admin role in its own tenant; OBS staff through `?tenant=` |
| New sponsor, every inline edit, placements | `refuseReadOnlyWrite` (`useCanWrite` on the client) | Tenant `org:admin` of a tenant that is not paused; OBS staff |
| Delete sponsor | The write gate, then the typed name, checked on the server | The same |
| Export field scope | On Exports, its own gate | As [`admin-exports.spec.md`](admin-exports.spec.md) |

No re-authentication anywhere (revised 2026-09-28): placing and editing are undone by editing again (`THEME-14`'s reasoning), and delete is guarded by its typed name. The UI hiding a control is never the boundary; the server refuses the write regardless.

---

## The fan wire

**`GET /b2b/org/:subdomain/sponsors`** — unauthenticated, like the org endpoint, because the Start page renders before a fan exists. Response: `configured` (the tenant has at least one sponsor record), the public sponsor projection, the contest-wide placements for contests fans can see (Open or Closed) that aren't finalized (never a per-game placement, since 2026-09-30), **`startPage`** (2026-09-29: the tenant's Start page list, ids of sponsors that still exist, in order; nullish on the contract so an older server reads as none), the `featured` game, and the `nextGame` it describes. Cached 60 seconds beside the org cache and cleared by the same writes.

**What changes:** placements carry only `boardBanner` and `presentedBy`, with no `betEventId` (the legacy `signIn` value and, since 2026-09-30, `slider` are dropped on the server, and a fan app drops any slot it doesn't know). The server filters stored `prizePopup` values out of every placement and drops a placement left with no slots. **Transition:** the fan contract's slot schema accepts and discards an unknown slot value, so a new fan app reading an older server ignores `prizePopup` rather than failing; an older fan app reading the new server finds no prize-popup holder and shows no credit, never a wrong one.

**`sponsors[]` also carries every prize provider and every Start page sponsor.** Besides the sponsors placed at those contests and those on the Start page list, the projection includes every sponsor that a tier of such a contest, as fans see it, names as its provider, so the fan app resolves a tier's `providedBySponsorId` (carried on the contest reads, [`admin-prizes.spec.md`](admin-prizes.spec.md)) from this one payload. `configured` keeps its meaning.

**`SP-06` — The public projection is an allowlist.** `{ sponsorId, name, websiteUrl, assets }` and nothing else. Agreement data (`exportFields`, `dpaReference`, which live on opt-ins now) and `organizationId` never cross this wire, and a test pins the key set exactly as `response-minimization.test.ts` pins the org endpoint's.

**`SP-07` — One resolver.** `resolveSponsorSlots(schedule, { contestId })` in `obs-b2b-shared` is the only code that decides which sponsor holds a slot: the contest's placement for the slot whose sponsor fills it, else nothing. **Revised 2026-09-30:** there is no game to resolve against, so the fan app reads the contest-wide placement everywhere (the board banner, "Presented by"); the per-game override and its fallback to the whole-contest holder (2026-09-27) are gone with per-game placements. The fan app calls it per screen; the server's tests pin it; the console's preview uses it for the contest shown ([`admin-preview.spec.md`](admin-preview.spec.md)); nothing re-derives it. The prize credit is not a slot and needs no resolver: popup and email read one field (`SP-11`).

**The featured game** (the Start page no longer reads it, 2026-09-29; the console's whole-tab Sponsors read still carries it): among the games of contests fans can see (Open or Closed) that aren't finalized, the one in progress; else the soonest not yet final whose start is no more than three hours past (the feed lags); else the most recent. `pickFeaturedGame` in the shared package.

**The next game** (`nextGame`): the featured game described with its teams and tip-off (`{ betEventId, eventTime, homeTeam: { name, logoUrl? }, awayTeam }`), only while it is under way or still ahead by the same window; null otherwise. Team logos cross the wire only as https URLs. `nextGameOf` in `node-server/src/util/admin-sponsors.ts`; the contract is `publicNextGameSchema` in `api/b2b/sponsors.ts` (nullish, so an older server reads as none). **Revised 2026-09-28 (Arthur's final walk): the Start screen shows no game or matchup.** No spec calls for one — Nick's entry-gate spec and identity design put no game on the Start screen, and the matchup came from a hardcoded placeholder in the original template — so the fan app no longer renders `nextGame`, and the console's sample contest (Brand) sends none. Since 2026-09-29 the featured game decides nothing on the Start page either: its sponsors are the tenant's list.

### Render rules (fan app)

**`SP-08` — Render when configured; render nothing when not.** No placeholder, no "your sponsor here", no empty frame. A slot with no holder, or whose holder lacks the artwork, is absent and the layout closes around it. A tier with no provider shows no credit.

**`SP-09` — Legacy only for a tenant with no sponsors.** While `configured` is false, the Start page keeps its legacy presenting line from `branding.assets.sponsorName`/`sponsorLogo`, falling back to the tenant seed file. The first sponsor record switches the tenant to the model everywhere, and the legacy strings are never read again for it.

**`SP-10` — Outbound links leave safely.** Banner, logo and website links open in a new tab with `rel="noopener noreferrer"`, and only `https:` URLs are stored (the contract refuses anything else, `javascript:` included).

| Where | Source | Renders |
|---|---|---|
| The Start page, beneath the headline | the tenant's Start page list, in order (`startPage`) | "Presented by", then each sponsor: its logo on a white plate spanning the column (linked to the website), or its name in a tile the same size, and its tagline. One sponsor takes the column; several sit two to a row, an odd last one across the row. None: no block |
| Board, between header and grid (bingo) | the contest's `boardBanner` holder | The banner, full width, as one link |
| Every trivia screen (trivia) | the contest's `presentedBy` holder | "Presented by", the sponsor's small logo or its name |
| Prize sheet (info and won), prize ladder, prize email | the prize's `providedBySponsorId`, as the tier's copy or the band's prize card carries it resolved (`providedBy`); the snapshot's copied `providedBy` for the won sheet and the email | "Provided by", the prize logo on a white plate in a fixed 4:1 box, or the name; "Visit {name}" to the website |

Every slot resolves against the contest alone; no game is involved (2026-09-30). **No sponsor rides the board's progress slider** (the Slider slot was removed on 2026-09-30): the marker is the contest's Progress marker, else the tenant's Brand marker, else the triangle in the Text colour (`resolveProgressMarker`, [`admin-contests.spec.md`](admin-contests.spec.md), "Progress marker").

---

## Rules

1. **A sponsor belongs to exactly one tenant** and is only ever read or written through that tenant's scope (`TEN-04`).
2. **One sponsor per slot, per contest** (`SP-01`): a placement is for the whole contest, for every contest type; there are no per-game placements (2026-09-30). The console adds where a slot has no holder, and nowhere else.
3. **One placement slot per contest type, each placeable only with its artwork** (`SP-02`): Board banner (bingo), Presented by (trivia, any sponsor). The Slider slot and the sponsor's slider icon are gone (2026-09-30); a contest's own board marker is its Progress marker. The Start page is the tenant's ordered list, set on Brand.
4. **The prize credit follows the prize's "Provided by"** (`SP-11`). The prize sheet and the email read the same field, the won sheet and the email from the snapshot; a provider without a prize logo is credited by name; the contest's Presented by sponsor never credits a prize.
5. **Retiring `prizePopup` migrates the contest-wide credit, logs the game-level rows, and removes nothing** (`SP-12`). Writes refuse the slot; stored values survive until cleanup; `prizePopup` still names the popup credit the Prize logo block previews.
6. **A sponsor is attributed to a game by its placements and the prizes it provides; opt-ins are a metric** (`SP-13`). One helper decides it for the recap and for "Where it appears".
7. **Placements stay editable after the first fan joins**; a finalized contest refuses them.
8. **The DPA scope and reference live on each agreement** (the opt-in); no stored scope, no export (`SP-03`). An unlinked agreement stays exportable by its opt-in.
9. **A sponsor with no agreement has no export and is not on Exports.** One with several has one export per agreement.
10. **A sponsor may have several agreements; an opt-in links at most one sponsor; there are no opt-in categories** (`SP-04`).
11. **Migrations are dry-run by default and idempotent**, and run on the shared dev database: the sponsor-records migration creates and links; the agreement-scope migration copies the scope onto agreements; the contest-wide migration (2026-09-30) collapses per-game placements, reports conflicts for a person, deletes slider placements and removes `assets.sliderIcon`.
12. **Deleting a sponsor takes its typed name, is audited first, and cascades** (`SP-14`): its placements go, prizes it provides lose it, its agreements are unlinked and kept, it comes off the Start page, and history keeps its name.
13. **Only deletion is audited** (`SP-05`).
14. **The fan wire is an allowlist** (`SP-06`); DPA data never reaches it.
15. **One resolver decides slot holders** (`SP-07`), in the fan app, the server and the console's preview, from the contest's placements alone.
16. **Render when configured, nothing when not** (`SP-08`); legacy strings only for a tenant with no sponsor records (`SP-09`).
17. **Only `https:` links and images are stored**, and outbound links open with `noopener` (`SP-10`).
18. **The measured line states facts** (`SP-15`): natural size and what the fan app does with it, from the slot's rendering rule. Never advice.
19. **Artwork is shown in the fan app's own screens**, through `FanAppPreview`; the prize email's mark on white is the one sample drawn in console markup.
20. **Every sponsor list pages** by the cursor convention ([`admin-lists.spec.md`](admin-lists.spec.md)): the Sponsors page, every picker, "Where it appears".

---

## Known gaps (recorded, not blocking, never on screen)

- **The `prizePopup` cleanup.** Strip `prizePopup` from stored placements, delete placements left with no slots, and drop the value from the stored enum, once every environment has run `prize-type-migration.mjs` and no deployed code reads the slot. `SponsorSlot` keeps the value: it names the popup credit on screen.
- **No per-game prize credit.** A prize has one provider wherever it is awarded; the game-level `prizePopup` rows the migration logs had no faithful home. If a sponsor ever needs to fund one game's prizes only, that is a separate contest's tiers, or a per-game provider override on the tier.
- ~~**No image upload.**~~ **Closed 2026-09-27** by [`admin-uploads.spec.md`](admin-uploads.spec.md).
- ~~**The measured line still describes the earlier prize plate**~~ **Closed 2026-10-03**: the console's measured line (`sponsorMeasure`) fits the logo whole inside the fan app's 224 × 56 box. The full sponsor-image rework is still deferred.
- **One prize logo for two grounds.** The same image sits on a white plate in the prize sheet and on the email's white card. The sponsor page now shows both, which makes the problem visible; a separate email logo is the fix if tenants need it.
- ~~**The `exportFields` mirror onto opt-ins is temporary.**~~ **Closed 2026-09-27**: the scope lives on each agreement (the opt-in) again, and the sponsor copy is retired.
- **Several sponsors in one slot.** The fan app renders one sponsor per slot, so the console offers one per slot (`SP-01`). A rotation or a row of logos is a fan-app change for the overhaul, with its own display rule. (The Start page shows several since 2026-09-29, from the tenant's list, not a slot.)
- **Placements are last-write-wins between two admins** editing one contest's Sponsors tab at once, as the branding module is. Acceptable at V1's operator count; an `expectedUpdatedAt` on the placements PUT is the fix.
- ~~**No "nobody at this game" override.**~~ **Moot since 2026-09-30**: a placement is for the whole contest, and there are no per-game placements to override.
- **No per-placement creative override.** A sponsor has one kit; a contest-specific tagline means editing the kit or a second sponsor record. Add `overrides` on the placement if a sponsor ever asks.
- **Consent per game (`OPT-06`) stays unbuilt.** A sponsor placed in a contest does not prompt fans who never answered its opt-in; `activeOptIns(context)` is still the seam.
- **The free square is not built** (field-split doc). It becomes a bingo placement slot, additively, when the game gains one.
- ~~**The recap page's sponsor logos**~~ — **closed 2026-09-23** by [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md): editions take their mark from `sponsorMarkUrl`.

## Function audit (the prize credit, 2026-10-03)

This spec had no function audit before; this covers what the prize sheet changed.

| Surface | Data sources | Server calls | States covered |
|---|---|---|---|
| Prize sheet credit, info | the tier's `providedBy` (fan contest reads) or the band's prize card `providedBy` (trivia reads), resolved from `providedBySponsorId` | none | no sponsor, logo, no logo (name), logo fails to load (name), website, no website |
| Prize sheet credit, won | the award's `prize.providedBy` (`GET /b2b/prizes/awards`, the snapshot's) | none | as above, plus a sponsor renamed, re-logoed or deleted since the win (the snapshot's credit) |
| Sponsor page, Prize logo block | the sponsor's `assets.prizePopupLogo`; the frame on Prize, Won | none from the frame | logo, none, the jump to the won sheet of the first tier or band this sponsor provides (a sponsor whose only prize is on a trivia band included), the measured line in the 224 × 56 box |

| Earlier-design element | Fate | Reason |
|---|---|---|
| The trivia sheet's "Sponsored by" with the contest's sponsor | Changed | "Provided by", the prize's own sponsor (D-124) |
| The popup's plate spanning the popup, the logo up to 64px tall, and the measured line's "on a white plate in the popup" | Changed | A fixed 4:1 box (224 × 56) on a white plate, the same on every prize; the measured line says "on a white plate with the prize in the app" (2026-10-03) |
| A sponsor providing only a trivia band's prize counted as in no contest | Changed | It is active in that contest, on the sponsor page and in the sponsor cards' count (`SP-13`) |
| "in the prize popup" in the Prize logo block's line | Changed | "in the app" |

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- The sponsor page shows one fan app preview, beside the artwork grid, and only when the sponsor is placed in an active contest.
- After a sponsor is deleted, Recent exports still names it: the export row keeps the name it was written with. The end-to-end harness checks this.

## References

- [`documents/PRD/branding-field-split.md`](../../../documents/PRD/branding-field-split.md) — the classification this builds; its `prizePopup` row is superseded by `SP-11`/`SP-12`, and its sign-in placement by the Start page list (2026-09-29, a contribution-file entry)
- PRD `BRAND-02`–`BRAND-04`, `TEN-04`, `RPT-04`, `RPT-05`, `SEC-02`, `IDN-11`, `ADM-03`
- WAVE-RULES 2026-09-24, "Arthur's rulings": Sponsors, Full pages instead of drawers, Lists
- [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page, its Sponsors tab, the builder, the lock
- [`admin-prizes.spec.md`](admin-prizes.spec.md) — the prize page's "Provided by", the award snapshot, the prize-type migration (step 2)
- [`admin-preview.spec.md`](admin-preview.spec.md) — `FanAppPreview` on the sponsor page and the contest Preview tab
- [`admin-lists.spec.md`](admin-lists.spec.md) — paging and endless scroll
- [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md) — the recap, whose editions `SP-13` re-keys
- [`prize-delivery.spec.md`](prize-delivery.spec.md) — the prize email's credit mark, re-sourced by `SP-11`
- [`admin-branding.spec.md`](admin-branding.spec.md), [`admin-exports.spec.md`](admin-exports.spec.md), [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), [`admin-surface.spec.md`](admin-surface.spec.md)
- [`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) — the fan app's preview mode: the render document and the preview board
- Superseded (workspace): the S1/S2 preview interface, `artifacts/wave-2026-09-24/s1-s2-preview-interface.md`
