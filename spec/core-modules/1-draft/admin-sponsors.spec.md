# Core Module Spec: Admin — Sponsors

**Implements:** PRD `BRAND-02`, `BRAND-03`, `BRAND-04`, `TEN-02`, `TEN-04`, `RPT-04`, `SEC-02`, `ADM-03`, and Arthur's 2026-09-24 ruling on sponsors (WAVE-RULES, "Sponsors"). The field-by-field classification is [`documents/PRD/branding-field-split.md`](../../../documents/PRD/branding-field-split.md); this spec builds what it classifies, with one change to it: the prize popup is no longer a placement slot (below, "Retiring the `prizePopup` slot").

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope, targeting, the reverification list ("deleting the sponsor does"), Rule 13. [`admin-lists.spec.md`](admin-lists.spec.md) — the cursor-paging convention and the endless-scroll components every list here uses (lands with G1's PR this wave). [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page whose Sponsors tab hosts the placements grid, and the lock (S1, same wave). [`admin-prizes.spec.md`](admin-prizes.spec.md) — the tier editor and its "Provided by" control, the award snapshot's `providedBy`, and the tier migration whose step 3 converts the `prizePopup` credit (S1, same wave). [`admin-preview.spec.md`](admin-preview.spec.md) — `FanAppPreview`, which the sponsor page and the contest Preview tab host. [`admin-exports.spec.md`](admin-exports.spec.md) — the DPA field scope this model absorbs. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the opt-in a sponsor's consent lives on. [`prize-delivery.spec.md`](prize-delivery.spec.md) — the prize email whose credit mark this spec re-sources.

**Supersedes:** in [`prize-delivery.spec.md`](prize-delivery.spec.md), the "Presented by" section's source of the credit (the prize-popup placement holder), by `SP-11`, together with [`admin-prizes.spec.md`](admin-prizes.spec.md). In [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md), the "Sponsor editions" keying by opt-in and its two sponsor gaps, by `SP-13`. In [`admin-branding.spec.md`](admin-branding.spec.md) and [`admin-surface.spec.md`](admin-surface.spec.md), the **Sponsors & Branding** destination: Sponsors becomes its own sidebar item.

**Status:** Draft, written 2026-09-23 with the build. No open questions.

**Revised 2026-09-24** (ruling, Arthur) — sponsors get their own page, separate from Brand, and each sponsor gets a full page showing its artwork at real size in the fan-app spots it fills and where it appears. The sponsor drawer is retired; editing is inline on the page. Placements move to the contest page's Sponsors tab and keep three slots (Sign-in, Board banner, Slider) per contest and game. The `prizePopup` slot is retired: a prize tier names the sponsor that provides it, and that "Provided by" drives the credit in the prize popup and the prize email. The sponsor recap credits a sponsor for its placements and the prizes it provides; opt-ins are a metric, not an attribution. Every rule of the 2026-09-23 spec that is still true is kept below, renumbered where the list grew.

## Overview

The 2026-09-23 build turned a sponsor from a string in a tenant's source file into a tenant-owned record with its artwork, its DPA field scope and slot-by-slot placements at games. The walkthrough on 2026-09-24 found the model sound and the surface hard to use:

- **No sense of size.** Three of the four images had no size, shape or format guidance, and the only view of an image was a 38px thumbnail. A tall banner pushed the board's squares off the screen and nobody could tell before publishing; a white logo vanished on the white prize email.
- **The prize credit was inferred.** Whoever held the prize-popup slot at the game where a prize was won was credited in the popup and the email. The tier editor said nothing about who would be credited, the same prize could be "presented by" different sponsors at different games, and the only way to change the credit was a grid on another screen.
- **Three notions of "this game's sponsor".** Slots credited placements, the popup and email credited a slot, and the recap credited sponsors through their consent opt-ins (contradiction 6 in the 2026-09-24 prizes review).
- **Buried.** Sponsors lived as a tab under Branding, with the schedule grid for every contest on the same tab.

**The whole change, in one line:** sponsors get a page of their own and a full page each, where the artwork is shown at true size in the fan app's own screens; placements move onto each contest as three slots; and the prize credit moves from a fourth slot to the tier, which names the sponsor that provides it.

**In scope:**

- The `B2BSponsor` model (unchanged) and `B2BSponsorPlacement` with slots reduced to `signIn | boardBanner | slider`.
- The prize credit rule (`SP-11`), the retirement of `prizePopup` and its migration (`SP-12`), and the attribution rule that settles contradiction 6 (`SP-13`).
- The Sponsors page (`/sponsors`), the sponsor page (`/sponsors/new`, `/sponsors/:id`) and the contest page's Sponsors tab.
- Endpoints: the cursor-paged sponsor list, sponsor read/create/edit/delete, placements per contest, the "where it appears" read, and the public fan read. Contracts in `obs-b2b-shared/src/api/admin/sponsors.ts` and `api/b2b/sponsors.ts`.
- Everything the 2026-09-23 spec carried that still holds: the move of `exportFields` off the opt-in, the opt-in link, the fan wire's allowlist and render rules.

**Not in scope:**

- **The tier editor.** Its "A sponsor provides this prize" toggle and "Provided by" picker are specced in [`admin-prizes.spec.md`](admin-prizes.spec.md); this spec owns what the credit means for sponsors.
- **The fan app's screens.** How the slots and the credit render on the fan side is S2's (`spec/webapp/fan-app-v2.spec.md`, `fan-contest-flow.spec.md`, landing with S2's PR this wave); this spec states the contract they read.
- **The preview frame.** [`admin-preview.spec.md`](admin-preview.spec.md) and the S1/S2 interface file.
- **Image upload.** Assets stay pasted https URLs in this change (Known gaps).
- **Coupon codes and code batches** (the prizes work's seam), **sponsor sign-in** (`IDN-11` stands: sponsors receive exports and documents, they never log in), and **the free square** (a game-rules change, field-split doc).

---

## The model

### `B2BSponsor` — `${prefix}sponsors` (unchanged)

```ts
interface B2BSponsor<TId = string> {
  _id?: TId;
  organizationId: TId;          // TEN-04: belongs to exactly one tenant
  name: string;                 // 1–60 chars, unique per tenant, case-insensitively
  websiteUrl?: string;          // "visit our sponsor" — https only
  assets?: SponsorAssets;       // the kit: the seven BRAND-02 assets (five built)
  exportFields?: string[];      // DPA field scope (RPT-04), moved here from OptInDefinition
  dpaReference?: string;        // which signed agreement the scope follows — free text, ≤200
  createdAt?: Date; updatedAt?: Date;
}
interface SponsorAssets {
  signInLogo?: string; signInTagline?: string;   // tagline ≤80 chars
  boardBanner?: string; boardBannerLink?: string;
  sliderIcon?: string;
  prizePopupLogo?: string;      // the prize logo: the credit when this sponsor provides a prize
}
```

Every image is an https URL pasted into its field, as before. `prizePopupLogo` keeps its name although no placement holds the prize popup any more: it is still the image the popup and the email show when the sponsor provides a prize, and renaming a stored field to follow a label would move data for no gain. The console calls it "Prize logo".

**A collection, not a subdocument on the org.** A sponsor is an entity: it has an id that other records reference (the opt-in's `sponsorId`, every placement, every tier's `providedBySponsorId`, every `fan_export` audit row), its own lifecycle, and it is read without the rest of the org (the fan schedule, Exports, the recap). `optIns` stays on the org because an opt-in is none of those things (the test [`admin-branding.spec.md`](admin-branding.spec.md) applies in `THEME-11`/`THEME-12`, coming out the other way).

**`dpaReference` names the agreement.** A free-text line ("Coca-Cola DPA v3, signed 2026-08-01") beside the scope it governs. Free text because OBS does not hold the DPAs and cannot validate one; its value is that the next admin can find the document.

**The sponsor's mark** (list cards, the recap, the placements grid) is `sponsorMarkUrl(assets)` in `obs-b2b-shared`: the sign-in logo, else the prize logo, else the board banner.

| Asset | Console label | Where fans see it | Rendered size in the fan app |
|---|---|---|---|
| `signInLogo` | "Logo" (Sign-in) | Sign-in screen and Home, under "Presented by" | 40px tall, up to 176px wide, never cropped |
| `signInTagline` | "Tagline" | Under the sign-in logo | One line of small text, up to 288px wide; ≤80 characters |
| `boardBanner` | "Banner" | The board, between the header and the squares | The full board column (480px, 358px on a 390px phone); 4:1 until it loads, then the image's own ratio; 13px corners; never cropped |
| `boardBannerLink` | "Banner link" | Where a tap on the banner goes | — |
| `sliderIcon` | "Icon" | The marker riding the board's prize slider | A 36×36 box, image contained |
| `prizePopupLogo` | "Prize logo" | Prize popup and prize email, under "Provided by", for a prize this sponsor provides | Popup: 48px tall, up to 176px wide. Email: 32px tall, up to 160px wide, on the email's white card |

### `B2BSponsorPlacement` — `${prefix}sponsor_placements`

```ts
const PLACEMENT_SLOTS = ["signIn", "boardBanner", "slider"] as const;
type PlacementSlot = (typeof PLACEMENT_SLOTS)[number];

/** A place on a fan screen that carries a sponsor's artwork: the three placement slots, plus the prize credit. */
type SponsorSlot = PlacementSlot | "prizePopup";

interface B2BSponsorPlacement<TId = string> {
  _id?: TId;
  organizationId: TId;
  contestId: TId;
  betEventId?: TId;             // absent: every game in the contest
  sponsorId: TId;
  slots: PlacementSlot[];       // at least one, no repeats
  createdAt?: Date; updatedAt?: Date;
}
```

**A join record, not a restructuring of `allowedBetEvents`.** Per-game sponsor config is keyed by (contest, game); turning `allowedBetEvents` into an array of objects would rewrite the most-read field on the most-read B2B document and touch the board evaluator's path. A separate collection keyed by `contestId` touches none of it.

**Contest-wide placements.** A placement with no `betEventId` holds its slots at every game in the contest, including games added later. That is the common case, a season sponsor; without it a twenty-game contest is twenty identical rows that drift the first time one is edited. The console calls it "All games".

**`SP-01` — One sponsor per slot per game.** Within a contest, a slot is held by at most one contest-wide placement, and at most one placement per game. A game-specific holder overrides the contest-wide holder *of that slot* only. `BRAND-03` (several sponsors per game) is several sponsors in different slots; the visual-overload concern is answered by construction.

**`SP-02` — A slot is placeable only when the sponsor has its artwork.** `signIn` needs a logo or a tagline, `boardBanner` a banner, `slider` an icon. The write refuses anything else (400, naming the sponsor and the missing piece): a placement that renders nothing is a control that lies. If the artwork is later cleared from a placed sponsor, the edit is allowed and the fan app omits the slot; the placements grid marks the cell so the admin can see why it stopped showing.

**A removed game keeps its placements, dormant.** Placements for a game no longer in the contest are not deleted (adding the game back brings them back) and are neither returned to the console nor resolved for fans.

**Placements stay editable after the first fan joins.** The lock that starts with the first board ([`admin-contests.spec.md`](admin-contests.spec.md)) does not cover sponsors: a placement changes what is shown around the board, never what a fan plays or can win. A finalized contest refuses placement writes like every other edit (409 "This contest is finalized, so its settings can't change.").

### The prize credit: "Provided by"

A prize tier carries `providedBySponsorId?: TId`, one of the tenant's sponsors. The field sits on `B2BPrizeTier` and is edited in the tier editor ("A sponsor provides this prize" → "Provided by", [`admin-prizes.spec.md`](admin-prizes.spec.md)); what it means for sponsors is stated here.

**`SP-11` — The prize credit follows the tier.** The prize popup and the prize email credit exactly the sponsor the tier names as its provider, and nobody when it names none. `SP-07` still holds and is why this is safe: the popup and the email agree because they read the same field, not because two pieces of code resolve a slot the same way.

- **The awarded prize is a snapshot.** Every awarded prize snapshots the tier as promised (G2's tier snapshot), and the snapshot copies the provider at award time: `providedBy: { sponsorId, name, logoUrl, websiteUrl }` ([`admin-prizes.spec.md`](admin-prizes.spec.md)). The email reads the snapshot, so a resend credits the sponsor the fan was promised, as it looked then, even if the tier's provider was changed, re-logoed or deleted since. The popup renders at the moment of the win, when tier and snapshot agree.
- **What the credit shows.** The sponsor's prize logo when it has one; its name as text when it does not. Any of the tenant's sponsors can be named as provider, artwork or not, because providing a prize is a fact about who pays for it, not a place on a screen; `SP-02`'s reasoning (a control that renders nothing) does not apply to a credit that always renders something. The logo links to the sponsor's website when one is set.
- **One word for one relation.** The credit reads "Provided by" in the popup, the fan app's prize ladder and the email. The prize email's label changes from "Presented by" to "Provided by" with this ruling; "Presented by" stays on the sign-in screen, where a sponsor presents the experience rather than a prize.
- **A live tier naming a deleted sponsor credits nobody** in the fan app (reachable only for finalized contests, `SP-14`); awarded prizes keep their snapshot's credit.
- **On the fan wire** a tier carries `providedBySponsorId` as an id, and the sponsor reaches the fan app through the public sponsor read, whose `sponsors[]` includes every sponsor a visible tier names (below, "The fan wire"). The preview receives the provider the same way and, in the render document only, also as the resolved `providedBy` in the snapshot's shape above ([`admin-preview.spec.md`](admin-preview.spec.md), the interface's section 5.5).

### Retiring the `prizePopup` slot

**Argued.** A placement slot is a place on a screen a sponsor has bought at a game. The prize credit is a statement about who funds a prize. Modelling the second as the first made the same tier "presented by" different sponsors at different games, left the tier editor unable to say who would be credited, and gave the recap no clean way to say which sponsor a prize belonged to. The ruling puts the credit where the prize is.

**`SP-12` — The retirement migrates the credit, lists what it cannot migrate, and removes nothing.** The conversion is step 3 of the tier migration, `node-server/scripts/prize-tier-migration.mjs` ([`admin-prizes.spec.md`](admin-prizes.spec.md), "Migration"), dry-run by default, idempotent, and run before anything stops reading the slot:

1. **Contest-wide holders become providers.** For every contest with a contest-wide placement holding `prizePopup`, the tiers of that contest get `providedBySponsorId` set to that holder.
2. **Game-level holders are listed, not converted.** A game-level `prizePopup` placement credited one game's winners; a tier has one provider for every game, so there is nothing faithful to convert it to. The migration's report lists each such row (tenant, contest, game, sponsor, and the contest-wide holder it overrode, if any) for OBS to review and set a tier's provider by hand where it matters. A contest with only game-level holders gets no provider and is listed.
3. **Nothing is removed.** Stored `prizePopup` values stay in their placements' `slots` until the cleanup step (Known gaps).

**The transition, stated so no reader credits the wrong sponsor:**

- **Order on deploy day:** the migration runs before the new readers ship. A tenant whose migration has not run shows no credit, never a wrong one.
- **Readers** never resolve `prizePopup` as a placement. The worker's credit (from the snapshot), the popup's credit and the recap read the tier's provider only.
- **Writes** refuse `prizePopup` in a placements body (400 "The prize credit is set on the prize tier."). A stored `prizePopup` value is not part of the grid, and a placements save carries it over untouched, so an older deployment reading the shared dev database keeps its credit until cleanup.
- **The public fan read** stops sending `prizePopup` from the first deploy (below, "The fan wire").
- **`prizePopup` stays a `SponsorSlot` value.** It no longer names a placement slot, but it still names a place on screen: the preview's `sponsors.highlight` points at the popup credit with `slot: "prizePopup"` ([`admin-preview.spec.md`](admin-preview.spec.md); the S1/S2 interface file, section 5.5). `PLACEMENT_SLOTS` is what placement writes validate against.

### Attribution: which sponsors a game credits

**`SP-13` — A sponsor is attributed to a game by its placements and the prizes it provides; opt-ins are a metric.** A sponsor is attributed to (contest, game) when it holds a placement there (a game-level placement for that game, or a contest-wide one at a contest that runs the game) or provides one of the contest's tiers. Dormant placements do not count. This settles contradiction 6: there is one notion of "this activation's sponsor", and it is the one the fan saw.

**Why opt-ins are not attribution.** A fan accepting a sponsor's opt-in is a result the sponsor bought, not proof the sponsor was on the game. Keying the recap by opt-in meant a sponsor with a consent line but no artwork got an edition, and a sponsor on the board banner with no consent line got none. The opt-in stays exactly where it is useful: as the audience number in that sponsor's section of the recap (the share of the game's players who accepted it at its current wording, an aggregate under `RPT-05`).

One pure helper, `attributedSponsors(placements, tiers, betEventId)` in `obs-b2b-shared`, decides it. The recap uses it for a game; the "Where it appears" read asks the same relation from the sponsor's side.

**What this changes in the recap** (supersedes the "Sponsor editions" section of [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md)):

- **Editions are keyed by sponsor record.** The switcher lists the game's attributed sponsors by name, with their mark.
- **The default edition** is the board banner's holder at the game, else the sign-in holder, else the slider holder, else the provider of the lowest tier. With none, the recap is the team's own edition.
- **The audience panel** shows only when the edition's sponsor has a linked consent opt-in.
- **In a sponsor's edition**, the tiers it provides carry "Provided by {sponsor}" in the Prizes section.
- **`?sponsor=`** takes a sponsor id. An opt-in id still resolves, to the sponsor it links, so recap links already sent keep working. A sponsor-kind opt-in with no linked sponsor record no longer gets an edition.

---

## Moving `exportFields` off the opt-in

The DPA scope lives on the sponsor. The shared dev database is also read by older deployments whose code reads `OptInDefinition.exportFields` and knows nothing of sponsor records, and production is in the same position on deploy day. So the move is **additive, dual-written, and never destructive**.

1. **Migration, idempotent, dry-run by default** — `node-server/scripts/migrate-sponsor-records.mjs`. For every `kind: "sponsor"` opt-in whose `sponsorId` does not name a sponsor record of that tenant, create one (`name` from the opt-in's label, `exportFields` copied) and set the opt-in's `sponsorId`. It never unsets or rewrites an opt-in's `exportFields`, never deletes anything, and a second run changes nothing.
2. **Reads prefer the sponsor.** A sponsor's scope is `sponsor.exportFields`, falling back to its linked opt-in's `exportFields` when the sponsor has none stored.
3. **Writes mirror.** A field-scope save writes the sponsor **and** copies the same list onto its linked opt-in, so older code exports exactly what the new code would. Deleting a field prunes both. The mirror is temporary (Known gaps).
4. **Unmigrated data keeps working.** A `kind: "sponsor"` opt-in with no sponsor record still appears on Exports as a row of its own, exportable and scope-editable exactly as before.
5. **The Exports contract only grows.** Every row and request stays keyed by the consent opt-in (`optInId`, required); the record reaches the screen through optional fields (`sponsorId`, `dpaReference`). Every existing field keeps its type, so a consumer pinned to an older shared package still compiles.

**`SP-03` — Fail closed is unchanged.** No stored scope, on the sponsor or its opt-in, means no export (409). A sponsor with **no linked consent opt-in** has no fan who agreed to share anything with it, so it has no export and **does not appear on Exports** until it is linked.

### The opt-in ↔ sponsor link

`OptInDefinition.sponsorId` names a sponsor record. The Fields & Opt-ins editor offers a **Sponsor** picker on `kind: "sponsor"` opt-ins, listing the tenant's sponsors plus "Not linked". A picker rather than a free id field because the only legal values are this tenant's sponsors, and a picker cannot offer anything else. The link is how a sponsor's export finds its consent records (`RPT-05`), how Exports can call a row "Coca-Cola" rather than "Share my data with Coca-Cola", and how the recap finds a sponsor's audience number.

**`SP-04` — One consent opt-in per sponsor, and only sponsor-kind opt-ins link.** `PUT /admin/config` refuses (400) a `sponsorId` that is not one of the tenant's sponsors, a `sponsorId` on a non-sponsor opt-in, and two opt-ins linked to the same sponsor. One, because the row filter needs exactly one consent to test. Linking and unlinking do not bump `textVersion`: they change nothing the fan read.

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
| DELETE | `/admin/sponsors/:sponsorId` | `requireAdminReverified` + write | 409 while referenced; audited `sponsor_delete` |
| GET | `/admin/sponsors/:sponsorId/appearances` | `requireAdmin` | "Where it appears", cursor-paged |
| GET | `/admin/contests/:contestId/placements` | `requireAdmin` | One contest's placements grid |
| PUT | `/admin/contests/:contestId/placements` | `requireAdmin` + write | One contest's placements, whole |
| GET | `/b2b/org/:subdomain/sponsors` | public | The fan read (below, "The fan wire") |

**`SP-05` — Only deletion is audited.** Create, edit and placement are configuration, reversible by editing again (the branding module's line, `THEME-10`). Deleting a sponsor is irreversible; the `sponsor_delete` row carries the sponsor id, how many placements went with it, and nothing else.

### `GET /admin/sponsors`

The Sponsors page and every sponsor picker (the placements grid's popover, the tier editor's "Provided by", the Fields & Opt-ins link). Paged by [`admin-lists.spec.md`](admin-lists.spec.md): `cursor`, `limit` (default 50, pickers 30), `q` (name, case-insensitive, anywhere). Order: name A–Z case-insensitively, then id. Index `{ organizationId, name, _id }`.

- **`slot`** (optional: `signIn`, `boardBanner` or `slider`): each row gains `fillsSlot: boolean` (`SP-02`'s test) and the order becomes sponsors that fill the slot first, then name. The grid's picker uses it.
- **Response:** `{ sponsors: SponsorListRow[], page }`, where a row is `{ sponsorId, name, websiteUrl?, markUrl?, signInLogo?, prizePopupLogo?, counts: { contests, placements, prizes }, linkedOptIn?: { optInId, label }, fillsSlot?, updatedAt }`. The card uses `signInLogo` and `markUrl`; the tier editor's "Provided by" picker shows `prizePopupLogo`.
- **Counts** are the references that matter now, and exactly the ones that block deletion (`SP-14`): `contests` is the number of contests that are not finalized in which the sponsor is attributed (`SP-13`); `placements` counts slots (one slot at one scope is one placement) at live games of those contests; `prizes` counts those contests' tiers that name it. Computed for the page's rows only.
- **Transition:** today's response also carries `contests[]` (every contest with its games and placements) and `featured`. Their only reader is the retired Sponsors & Branding tab; they are dropped when it goes.

### `GET /admin/sponsors/:sponsorId`

The sponsor page. Returns every `B2BSponsor` field except `organizationId`, with `exportFields` as read (the sponsor's, else its linked opt-in's), `linkedOptIn`, the same `counts` as the list, `activeContests` (contests attributed and not Finished, for the header), and `updatedAt`. 404 for another tenant's id.

### `POST /admin/sponsors`

Body `{ name, websiteUrl? }`. `name` trimmed, 1–60 characters, unique per tenant case-insensitively (409 `sponsor_name_taken`, "A sponsor with this name already exists."). `websiteUrl` https only, ≤2000 (400, "Use a link that starts with https://"). Responds 201 with the sponsor as the GET returns it. Not audited (`SP-05`).

### `PATCH /admin/sponsors/:sponsorId`

The sponsor page saves one field at a time. Body: any of `name`, `websiteUrl`, `assets` (a partial `SponsorAssets`: only the keys sent change), `dpaReference`, plus the required `expectedUpdatedAt`. `null` clears a field (`$unset`, so cleared and never-set are one state).

- **Validation** as POST; every image and link https only, ≤2000; `signInTagline` ≤80; `dpaReference` ≤200. Field errors come back keyed by field and render under that field.
- **Precondition:** an `expectedUpdatedAt` that does not match is 409 `stale_sponsor`.
- **Clearing placed artwork is allowed** (`SP-02`, last paragraph).
- **Not here:** `exportFields`, which Exports edits (`PUT /admin/exports/field-scope`, with its mirror).
- Responds with the sponsor as the GET returns it.

The whole-profile `PUT /admin/sponsors/:sponsorId` stays while the retired drawer's code is deployed, then goes.

### `DELETE /admin/sponsors/:sponsorId`

Reverified (admin-surface: "deleting the sponsor does"). Checks in order: 404 for another tenant's id; the write gate; reverification; then references.

**`SP-14` — A sponsor can't be deleted while anything current refers to it.** Refused with 409 `sponsor_in_use` and `{ placements, prizes, linkedOptIn }` while it holds a placement at a live game of a contest that is not finalized, provides a tier of such a contest, or is linked from a consent opt-in. Those are the references an admin can remove, and removing them first is the point: a sponsor silently vanishing from a live board or a live prize credit is exactly the surprise reverification exists to prevent. References that cannot be edited any more do not block: placements at games the contest no longer runs are deleted with the sponsor (the audit row counts them), placements in finalized contests are deleted, and a finalized contest's tiers keep the id, which then credits nobody (`SP-11`).

The response message follows the counts:

| References | Message |
|---|---|
| Placements only | "Remove it from 3 placements first." |
| Prizes only | "Remove it from 1 prize first." |
| Both | "Remove it from 3 placements and 1 prize first." |
| Opt-in link only | "Unlink it from its opt-in on Fields & Opt-ins first." |
| Placements or prizes, and the link | "Remove it from 3 placements and 1 prize, and unlink it from its opt-in on Fields & Opt-ins, first." |

Singular and plural follow the count ("1 placement", "2 prizes").

### `GET /admin/sponsors/:sponsorId/appearances`

"Where it appears". `kind=placements` or `kind=provides`, paged by the convention.

- **`placements`** rows: `{ contestId, contestName, contestStatus, betEventId | null, game?: { label, eventTime }, slot }`, one row per slot at one scope. Order: contest newest first, then "All games" before games, games by tip-off, slots in grid order (Sign-in, Board banner, Slider).
- **`provides`** rows: `{ contestId, contestName, contestStatus, tierIndex, prizeName }`. Order: contest newest first, then tier order.
- Finished and finalized contests are included (they are history the recap still attributes); dormant placements are not. `contestStatus` is the derived status the contest page shows.

### `GET /admin/contests/:contestId/placements`

The Sponsors tab and the builder's Sponsors step. Returns:

```ts
{
  contestId: string;
  games: { betEventId: string; label: string; eventTime: string; status: "upcoming" | "live" | "final" }[]; // tip-off order
  placements: { betEventId: string | null; sponsorId: string; slots: PlacementSlot[] }[];               // live games only
  sponsors: { sponsorId: string; name: string; markUrl?: string; assets: SponsorAssets;
              fills: Record<PlacementSlot, boolean> }[];                                           // every sponsor placed here
  providers: { tierIndex: number; prizeName: string; threeInARows: number; sponsorId: string | null }[];
  finalized: boolean;
  updatedAt: string;
}
```

404 for another tenant's contest. A stored `prizePopup` value is never returned.

### `PUT /admin/contests/:contestId/placements`

Body `{ placements: { betEventId: string | null; sponsorId: string; slots: PlacementSlot[] }[] }`, the contest's whole schedule of the three slots. The grid sends it after every pick, so each cell change is one write.

- **Validation, 400:** `SP-01` (one holder per slot per scope), `SP-02` ("Coca-Cola has no board banner."), every `betEventId` is a game the contest runs, every `sponsorId` is the tenant's, no `prizePopup` ("The prize credit is set on the prize tier.").
- **409:** a finalized contest ("This contest is finalized, so its settings can't change.").
- **Replace semantics:** the three slots at live games are replaced; dormant placements and stored `prizePopup` values are carried over untouched.
- Responds as the GET.

The old `PUT /admin/sponsors/placements` (`{ contestId, placements[] }`) stays as an alias while the retired schedule card is deployed, with the same validation.

**Tenant deletion sweeps both collections**, like every other tenant-owned collection.

---

## The screens

### Navigation

**Sponsors is its own sidebar item** under Configuration, at `/sponsors`, with its own hue (the per-item hue treatment G1 builds: a thin bar on the item's right edge, and the KpiTile top outline on the page's hued cards). **Brand** keeps `/branding`. The Sponsors & Branding label and its tab strip go; `/branding/sponsors` redirects to `/sponsors`.

**Argued.** The 2026-09-23 spec put sponsors beside the brand because both answer "what does the fan app look like". In use they are different jobs on different clocks: the brand is set for a season and edited as one draft; sponsors are records, each with its own artwork and its own list of contests, and they change when deals change. The ruling separates them, and the separation also removes the old tab's second job (the schedule grid for every contest), which now lives on each contest where the question "who is on this game" is asked.

### `/sponsors` — Sponsors

**Head:** eyebrow "Configuration", H1 "SPONSORS", primary "New sponsor" (writers only).

**Toolbar** (sticky, from the list kit): search ("Search sponsors") and the count ("8 sponsors", "1 sponsor").

**Cards**, a responsive grid (`repeat(auto-fill, minmax(300px, 1fr))`, 16px gaps), endless scroll through `GET /admin/sponsors`. Each card:

1. **Mark tile:** the sign-in logo at 40px tall (up to 176px wide) on a dark tile, as it sits on a dark sign-in screen; else the sponsor's mark at the same height; else the name's first letter in the tile.
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

The sponsor page's header in create form: back link "Sponsors", eyebrow "New sponsor", a **Name** field (focused, ≤60) and a **Website** field (optional, hint "Linked from the sponsor's logos and banner."), and primary "Create sponsor". Nothing else renders until the record exists, because every other section saves to it. "Create sponsor" POSTs; on success the URL is replaced with `/sponsors/:id` and the Artwork section opens with the sign-in block's Logo field focused. A name clash answers under the Name field: "A sponsor with this name already exists."

### `/sponsors/:id` — the sponsor page

**Header:** back link "Sponsors"; eyebrow "Sponsor"; H1 the name; under it the website; a status line from `activeContests`: "Active in 2 contests" / "Active in 1 contest", or "Not in any contest". For writers the name and the website are inline-editable: a click turns the text into its field, Enter or leaving the field saves, Escape restores.

**Saving is inline, everywhere on the page.** A text field saves when it loses focus or on Enter; a URL field saves when it loses focus. Each save is one `PATCH` with the sponsor's `updatedAt`. The section's header then shows the confirmation line "Saved." (the console's publish-line idiom, success text colour), which clears after four seconds or on the next edit. Errors answer under the field that caused them. A 409 `stale_sponsor` shows under the section header: "This sponsor changed since you opened it." with "Reload". Nothing is a draft: a sponsor has no publish step, and every value on the page is live once saved.

The page is four sections, top to bottom.

#### 1. Artwork

Two columns at ≥1280px: the slot blocks on the left, and `FanAppPreview` on the right, sticky, in its Phone size (390×844, shown at 1:1 and never scaled, so artwork in the frame is at true size). Below 1280px the frame drops under the slot blocks.

**The four slot blocks**, in the order a fan meets them. Each has a title, one line saying where fans see it, its fields, and the measured line under each image field:

| Block | Line | Fields |
|---|---|---|
| "Sign-in" | "Beneath the headline fans see before they join, and on Home." | "Logo" (URL); "Tagline" (≤80, with a counter "32/80") |
| "Board banner" | "Across the board, between the header and the squares." | "Banner" (URL); "Banner link" (URL, hint "Where the banner leads. Leave it blank to use the website.") |
| "Slider" | "The marker that moves along the prize slider, in place of the team's own marker." | "Icon" (URL) |
| "Prize logo" | "With a prize this sponsor provides, in the prize popup and the prize email." | "Logo" (URL) |

**The frame shows each slot in its real spot.** Focusing a block, or any field in it, switches the frame to the screen that holds that slot and rings it with the preview's highlight: Sign-in on Gate, Board banner and Slider on Board, Prize logo on Prize (`sponsors.highlight` with `slot: "prizePopup"`). What the frame renders is the fan app itself, on the tenant's saved brand, with this sponsor's artwork as typed: a valid https URL in a field is sent to the frame at once, before it is saved, so pasting a link shows the image in place. The frame's contest is chosen from a select above it listing the contests in "Where it appears", defaulting to the one with the next game; a sponsor that appears in no contest previews against the fan app's sample contest with this sponsor placed in the slot being looked at. The mechanics (the render document, the contest-wide resolution for the selected game, the highlight) are [`admin-preview.spec.md`](admin-preview.spec.md)'s and the interface file's (section 5.5).

**The prize email's mark** is not a fan-app screen, so the Prize logo block also shows it directly: "In the prize email", the logo at the email's exact box (32px tall, up to 160px wide) on the email card's white. This is the one sample drawn in console markup, and it is narrow by design: the email's card is white by construction ([`prize-delivery.spec.md`](prize-delivery.spec.md), "How it is built"), and the question the admin has is whether the logo survives on white, which a logo at its exact size on that white answers truthfully.

**`SP-15` — The measured line states facts.** Under each image field, once the image loads in the console, one line gives the image's natural size and what the fan app will do with it, computed from the slot's rendering rule in the table below. It says nothing about what the admin should do: no "too small", no "recommended".

| Slot | The fan app's box | "fits" when | Otherwise |
|---|---|---|---|
| Sign-in logo | 40px tall, up to 176px wide | its width at 40px tall is ≤176px (ratio up to 4.4:1): "600×200 · fits" | "1600×200 · will show at 176×22" |
| Board banner | the 480px column, height from the image | the image is 4:1 (within 1%): "1200×300 · fits" | "1200×600 · will show at 480×240" |
| Slider icon | a fixed 36×36 box, contained | never: the box is fixed | "300×300 · will show at 36×36"; "400×200 · will show at 36×18" |
| Prize logo | popup 48px tall up to 176px; email 32px tall up to 160px | both fit: "600×200 · fits" | each surface named: "800×200 · will show at 176×44 in the popup · fits the email" |

Sizes are CSS pixels. The banner's are at the fan app's widest column, 480px; on a 390px phone, as in the frame, the column is 358px and the banner scales with it. While an image is loading the line is empty. An image that does not load reads "This image didn't load." A value that is not an https URL is refused under the field: "Use a link that starts with https://".

#### 2. Where it appears

A flush card, "Where it appears", with a table (endless scroll, `kind=placements`): **Contest** · **Game** · **Slot** · a "Preview" link.

- **Contest** is the contest's name with its status badge when it is Finished; it links to that contest's Sponsors tab (`/contests/:id/sponsors`).
- **Game** is "All games" for a contest-wide placement, else the matchup and tip-off ("vs Denver · Sat 7:00 PM").
- **Slot** is "Sign-in", "Board banner" or "Slider".
- **"Preview"** opens the contest's Preview tab on that slot's screen and game, with this sponsor's artwork highlighted (`/contests/:id/preview?screen=board&game=<id>&sponsor=<sponsorId>&slot=boardBanner`).

Under the table, the prizes it provides (endless, `kind=provides`), one line each: "Provides: Free hot dog in Hawks 2026", linking to the contest's Prizes tab (`/contests/:id/prizes`), with a "Preview" link that opens the contest's Preview tab on Prize with that tier and `slot=prizePopup`.

Empty: "Not placed in any contest. Place sponsors on a contest's Sponsors tab." When it provides prizes but holds no placement, the table is left out and the provides lines stand alone.

#### 3. Data

A card, "Data", with the fields that were the drawer's "Data agreement" group:

- **"Data agreement"** (`dpaReference`, ≤200, inline-saved): hint "Which signed agreement its data sharing follows, so the next admin can find it."
- **"Consent opt-in"**: the linked opt-in's label, linking to Fields & Opt-ins, or "Not linked to an opt-in", with "Link one on Fields & Opt-ins".
- **"Shared fields"**: the export field scope as a read-only list of field names, with "Edit on Exports". Omitted when the sponsor has no linked opt-in, since it has no export (`SP-03`).

#### 4. Danger zone

A danger card, "Danger zone": "Deleting a sponsor can't be undone." and the danger button "Delete sponsor".

- **Blocked** (`SP-14`): the button is disabled and the line under it gives the table's message for the current counts ("Remove it from 3 placements and 1 prize first."); the counts link to "Where it appears".
- **Allowed:** the button runs reverification, then a centred dialog: title "Delete Coca-Cola?", body "It comes off every past contest it was part of, and past recaps no longer offer its edition. This can't be undone.", a field "Type Coca-Cola to confirm", and the danger button "Delete sponsor" (enabled once the name matches). On success the console returns to `/sponsors`, whose head shows the line "Deleted Coca-Cola.".
- A 409 that arrives anyway (someone placed it meanwhile) closes the dialog and shows the message in the blocked line.

**States of the page**

| State | What shows |
|---|---|
| Loading | Header skeleton, four slot-block skeletons, a frame-shaped skeleton |
| Ready | As above |
| Not found (deleted, or another tenant's id) | "This sponsor doesn't exist." with a link "Back to sponsors" |
| Load failed | The load-failure card, "Couldn't load this sponsor.", with Retry and Tell Overboard |
| Member, or a paused tenant | The same page as a view-only presentation (below) |

### The contest's Sponsors tab — the placements grid

On the contest page ([`admin-contests.spec.md`](admin-contests.spec.md)) at `/contests/:id/sponsors`, and as step 5 of the create builder (optional: Continue is never blocked, and the Review checklist counts "Sponsors (n placements)").

**The grid.** Rows are the three slots, each with a caption: "Sign-in" ("Before fans join"), "Board banner" ("Across the board"), "Slider" ("On the prize slider"). Columns are "All games", then one per game in tip-off order, headed with the matchup and tip-off ("vs Denver", "Sat 7:00 PM") and a "Live" or "Final" badge when the game is under way or over. The slot column and the All games column stay pinned while the game columns scroll sideways.

**A cell** shows the holder's artwork as a thumbnail at the slot's shape (sign-in logo 24px tall up to 104px wide, or the name alone for a tagline-only sponsor; banner in a 4:1 box, 112×28; icon 28×28) and the sponsor's name beneath it.

- **Empty:** "Add".
- **Inherited:** a game cell with no holder of its own shows the All games holder muted, labelled "Inherited", so the inheritance is visible rather than implied.
- **Artwork gone** (`SP-02`, the cleared-after-placing case): the name with a warning badge, "No logo", "No banner" or "No icon", and the tooltip "Fans won't see this until Coca-Cola has a board banner."

**Picking.** A cell opens a popover anchored to it, titled with the slot and the column ("Board banner · vs Denver", "Board banner · All games"). Inside: search ("Search sponsors") over an endless list of the tenant's sponsors (`GET /admin/sponsors?slot=`), each with its mark and name. Sponsors that fill the slot come first; the rest are listed after them, disabled, with the missing piece ("No board banner"). Choosing one saves at once. A cell that has a holder of its own adds "Remove" at the popover's foot; removing a game cell's holder returns it to the inherited one.

**Saving.** Each pick or removal sends the whole grid (`PUT /admin/contests/:contestId/placements`). The cell shows its new holder straight away with a quiet pending mark; on success the tab's header shows "Saved." On failure the cell returns to what it was and the message shows under the grid: the server's 400 ("Coca-Cola has no board banner."), a finalized contest ("This contest is finalized, so its settings can't change."), or "Couldn't save. Try again." for anything else.

**Provided by.** Under the grid, a card "Provided by" lists the contest's tiers in ladder order: the tier's name, "3 bingos", and its provider's mark and name, or "No sponsor". Read-only here; "Edit on Prizes" links to the Prizes tab. With no tiers: "No prize tiers yet." with "Add one on Prizes".

**Preview.** A line of links under the Provided by card: "Preview the sign-in screen" (the Preview tab on Gate), then one link per game ("vs Denver") opening the Preview tab on Board for that game.

| State | What shows |
|---|---|
| Loading | A skeleton grid: three rows by All games plus up to four game columns |
| Ready | Grid, Provided by, Preview links |
| The tenant has no sponsors | In place of the grid: "No sponsors yet. Add one on the Sponsors page." with the link (writers), "No sponsors yet." (members) |
| The contest has no games | The grid with the All games column only, and under it "Add games on the Games tab to place a sponsor at one game." |
| Finalized | View-only presentation; the contest page's finalized treatment applies |
| Locked (a fan has joined) | Unchanged: placements stay editable |
| Load failed | The load-failure card, "Couldn't load this contest's sponsors.", with Retry and Tell Overboard |

### The view-only presentation

`org:member`, and every user of a paused tenant, see the same Sponsors page, sponsor page and grid as state (D-059), with the console's read-only line in the page head: "Read-only — only organization admins can change sponsors" (a paused tenant sees the paused banner instead). No "New sponsor"; names, websites and fields are static text; an empty grid cell reads "None" and cells do not open; the Danger zone is absent. `FanAppPreview` works exactly as for an admin, because a preview writes nothing.

### Exports and Fields & Opt-ins

- **Exports** lists each sponsor opt-in under its sponsor record's name when linked (its label otherwise). The field scope card shows the Data agreement line beneath the checklist when one is stored. Every request is still keyed by the opt-in; the server applies the record's scope and mirrors every scope save onto both.
- **Fields & Opt-ins** carries the Sponsor picker on sponsor-kind opt-ins (above), using the paged sponsor list.

### Copy

| Where | String |
|---|---|
| Sidebar, page head | "Sponsors", eyebrow "Configuration", H1 "SPONSORS" |
| List | "New sponsor" · "Search sponsors" · "8 sponsors" / "1 sponsor" · "Appears in 2 contests · 3 placements · provides 1 prize" · "Not in any contest" · "No sponsors yet." · "No sponsors match." · "Clear search" · "Couldn't load sponsors." · "Deleted Coca-Cola." |
| Create | "New sponsor" · "Name" · "Website" · "Linked from the sponsor's logos and banner." · "Create sponsor" · "A sponsor with this name already exists." |
| Sponsor header | "Sponsors" (back) · "Sponsor" · "Active in 2 contests" / "Active in 1 contest" · "Not in any contest" |
| Saving | "Saved." · "This sponsor changed since you opened it." · "Reload" · "Use a link that starts with https://" |
| Artwork | "Sign-in" · "Board banner" · "Slider" · "Prize logo" · the four lines in the block table · "Logo" · "Tagline" · "32/80" · "Banner" · "Banner link" · "Where the banner leads. Leave it blank to use the website." · "Icon" · "In the prize email" |
| Measured line | "1200×300 · fits" · "300×300 · will show at 36×36" · "800×200 · will show at 176×44 in the popup · fits the email" · "This image didn't load." |
| Where it appears | "Where it appears" · "Contest" · "Game" · "Slot" · "All games" · "Sign-in" · "Board banner" · "Slider" · "Preview" · "Provides: Free hot dog in Hawks 2026" · "Not placed in any contest. Place sponsors on a contest's Sponsors tab." |
| Data | "Data" · "Data agreement" · "Which signed agreement its data sharing follows, so the next admin can find it." · "Consent opt-in" · "Not linked to an opt-in" · "Link one on Fields & Opt-ins" · "Shared fields" · "Edit on Exports" |
| Danger zone | "Danger zone" · "Deleting a sponsor can't be undone." · "Delete sponsor" · the `SP-14` messages · "Delete Coca-Cola?" · "It comes off every past contest it was part of, and past recaps no longer offer its edition. This can't be undone." · "Type Coca-Cola to confirm" |
| Page states | "This sponsor doesn't exist." · "Back to sponsors" · "Couldn't load this sponsor." |
| Grid | "Before fans join" · "Across the board" · "On the prize slider" · "All games" · "Add" · "Inherited" · "No logo" / "No banner" / "No icon" · "Fans won't see this until Coca-Cola has a board banner." · "Board banner · vs Denver" · "Search sponsors" · "No board banner" · "Remove" · "Saved" · "Coca-Cola has no board banner." · "This contest is finalized, so its settings can't change." · "Couldn't save. Try again." · "None" |
| Grid, below | "Provided by" · "3 bingos" · "No sponsor" · "Edit on Prizes" · "No prize tiers yet." · "Add one on Prizes" · "Preview the sign-in screen" · "vs Denver" |
| Grid states | "No sponsors yet. Add one on the Sponsors page." · "No sponsors yet." · "Add games on the Games tab to place a sponsor at one game." · "Couldn't load this contest's sponsors." |
| View-only | "Read-only — only organization admins can change sponsors" |
| Server refusals shown as-is | "The prize credit is set on the prize tier." · the `SP-14` table |

---

## Permissions

| Control | Gate | Who holds it |
|---|---|---|
| Sponsors page, sponsor page, Sponsors tab, their previews | `requireAdmin` (`org:tenant_config:read`) | Every admin role in its own tenant; OBS staff through `?tenant=` |
| New sponsor, every inline edit, placements | `refuseReadOnlyWrite` (`useCanWrite` on the client) | Tenant `org:admin` of a tenant that is not paused; OBS staff |
| Delete sponsor | The write gate, then reverification (`requireAdminReverified`, `useReverification`) | The same |
| Export field scope | On Exports, its own gate | As [`admin-exports.spec.md`](admin-exports.spec.md) |

No reverification except delete: placing and editing are undone by editing again (`THEME-14`'s reasoning). The UI hiding a control is never the boundary; the server refuses the write regardless.

---

## The fan wire

**`GET /b2b/org/:subdomain/sponsors`** — unauthenticated, like the org endpoint, because the sign-in screen renders before a fan exists. Response unchanged in shape: `configured` (the tenant has at least one sponsor record), the public sponsor projection, the placements for visible, unfinalized contests, the `featured` game, and the `nextGame` it describes. Cached 60 seconds beside the org cache and cleared by the same writes.

**What changes:** placements carry only `signIn`, `boardBanner` and `slider`. The server filters stored `prizePopup` values out of every placement and drops a placement left with no slots. **Transition:** the fan contract's slot schema accepts and discards an unknown slot value, so a new fan app reading an older server ignores `prizePopup` rather than failing; an older fan app reading the new server finds no prize-popup holder and shows no credit, never a wrong one.

**`sponsors[]` also carries every prize provider.** Besides the sponsors placed at visible, unfinalized contests, the projection includes every sponsor a visible tier of such a contest names as its provider, so the fan app resolves a tier's `providedBySponsorId` (carried on the contest reads, [`admin-prizes.spec.md`](admin-prizes.spec.md)) from this one payload. `configured` keeps its meaning.

**`SP-06` — The public projection is an allowlist.** `{ sponsorId, name, websiteUrl, assets }` and nothing else. `exportFields`, `dpaReference` and `organizationId` never cross this wire, and a test pins the key set exactly as `response-minimization.test.ts` pins the org endpoint's.

**`SP-07` — One resolver.** `resolveSponsorSlots(schedule, { contestId, betEventId })` in `obs-b2b-shared` is the only code that decides which sponsor holds a slot. The fan app calls it per screen; the server's tests pin it; the console's preview uses it for the selected game ([`admin-preview.spec.md`](admin-preview.spec.md)); nothing re-derives it. The prize credit is not a slot and needs no resolver: popup and email read one field (`SP-11`).

**The featured game** (for the sign-in screen, which has no contest): among visible, unfinalized contests' games, the one in progress; else the soonest not yet final whose start is no more than three hours past (the feed lags); else the most recent. `pickFeaturedGame` in the shared package.

**The next game** (`nextGame`): the featured game described for the sign-in screen's matchup (`{ betEventId, eventTime, homeTeam: { name, logoUrl? }, awayTeam }`), only while it is under way or still ahead by the same window. When the featured game is only "the most recent", or is not a two-team game with both names, `nextGame` is null and the start screen shows **no matchup** (D-068). Team logos cross the wire only as https URLs. `nextGameOf` in `node-server/src/util/admin-sponsors.ts`; the contract is `publicNextGameSchema` in `api/b2b/sponsors.ts` (nullish, so an older server reads as none).

### Render rules (fan app)

**`SP-08` — Render when configured; render nothing when not.** No placeholder, no "your sponsor here", no empty frame. A slot with no holder, or whose holder lacks the artwork, is absent and the layout closes around it. A tier with no provider shows no credit.

**`SP-09` — Legacy only for a tenant with no sponsors.** While `configured` is false, the start screen keeps its legacy presenting line from `branding.assets.sponsorName`/`sponsorLogo`, falling back to the tenant seed file. The first sponsor record switches the tenant to the model everywhere, and the legacy strings are never read again for it.

**`SP-10` — Outbound links leave safely.** Banner, logo and website links open in a new tab with `rel="noopener noreferrer"`, and only `https:` URLs are stored (the contract refuses anything else, `javascript:` included).

| Where | Source | Renders |
|---|---|---|
| Sign-in screen and Home, beneath the headline | the `signIn` holder at the featured game | "Presented by", the logo (linked to the website) or the name, and the tagline |
| Board, between header and grid | the `boardBanner` holder at (contest, the board's game) | The banner, full width, as one link |
| Board's progress slider | the `slider` holder at (contest, the board's game) | The icon as the moving marker; else the tenant's marker; else the plain dot |
| Prize popup, prize ladder, prize email | the tier's `providedBySponsorId` (the snapshot's copied `providedBy`, for the email) | "Provided by", the prize logo or the name, linked to the website |

The board resolves against its contest and its game: the game of the board's props.

---

## Rules

1. **A sponsor belongs to exactly one tenant** and is only ever read or written through that tenant's scope (`TEN-04`).
2. **One sponsor per slot per game** (`SP-01`); a game-specific holder overrides the contest-wide one for that slot only.
3. **Three placement slots, each placeable only with its artwork** (`SP-02`): Sign-in, Board banner, Slider.
4. **The prize credit follows the tier's "Provided by"** (`SP-11`). Popup and email read the same field, the email from the snapshot; a provider without a prize logo is credited by name.
5. **Retiring `prizePopup` migrates the contest-wide credit, logs the game-level rows, and removes nothing** (`SP-12`). Writes refuse the slot; stored values survive until cleanup; `prizePopup` remains a highlight target.
6. **A sponsor is attributed to a game by its placements and the prizes it provides; opt-ins are a metric** (`SP-13`). One helper decides it for the recap and for "Where it appears".
7. **Placements stay editable after the first fan joins**; a finalized contest refuses them.
8. **The DPA scope lives on the sponsor**; the opt-in copy is a write-through mirror, never read first, and retired later. No stored scope, no export (`SP-03`).
9. **A sponsor with no linked consent opt-in has no export and is not on Exports.**
10. **One consent opt-in per sponsor; only sponsor-kind opt-ins link** (`SP-04`).
11. **The sponsor-records migration creates and links; it never removes.** Idempotent, dry-run by default.
12. **Deleting a sponsor is reverified, audited, and refused while a current placement, prize or opt-in refers to it** (`SP-14`); references that can no longer be edited go with it.
13. **Only deletion is audited** (`SP-05`).
14. **The fan wire is an allowlist** (`SP-06`); DPA data never reaches it.
15. **One resolver decides slot holders** (`SP-07`), in the fan app, the server and the console's preview.
16. **Render when configured, nothing when not** (`SP-08`); legacy strings only for a tenant with no sponsor records (`SP-09`).
17. **Only `https:` links and images are stored**, and outbound links open with `noopener` (`SP-10`).
18. **The measured line states facts** (`SP-15`): natural size and what the fan app does with it, from the slot's rendering rule. Never advice.
19. **Artwork is shown in the fan app's own screens**, through `FanAppPreview`; the prize email's mark on white is the one sample drawn in console markup.
20. **Every sponsor list pages** by the cursor convention ([`admin-lists.spec.md`](admin-lists.spec.md)): the Sponsors page, every picker, "Where it appears".

---

## Known gaps (recorded, not blocking, never on screen)

- **The `prizePopup` cleanup.** Strip `prizePopup` from stored placements, delete placements left with no slots, and drop the value from the stored enum, once every environment has run `prize-tier-migration.mjs` and no deployed code reads the slot. `SponsorSlot` keeps the value as a highlight target.
- **No per-game prize credit.** A tier has one provider for every game; the game-level `prizePopup` rows the migration logs had no faithful home. If a sponsor ever needs to fund one game's prizes only, that is a separate contest's tiers, or a per-game provider override on the tier.
- **No image upload.** Every asset is a pasted https URL, like the Brand page's logo. An upload path (presigned PUT, size and type limits, a CDN URL back) is the next step for sponsor artwork, prize images and the brand logo at once, and belongs in its own change.
- **One prize logo for two grounds.** The same image sits on the popup's card (dark or light with the tenant's theme) and on the email's white card. The sponsor page now shows both, which makes the problem visible; a separate email logo is the fix if tenants need it.
- **The `exportFields` mirror onto opt-ins is temporary.** Retire it (stop writing, then drop the field from the opt-in schema) once every environment has run the sponsor-records migration and no deployed code reads the opt-in copy.
- **Placements are last-write-wins between two admins** editing one contest's grid at once, as the branding module is. Acceptable at V1's operator count; an `expectedUpdatedAt` on the placements PUT is the fix.
- **No "nobody at this game" override.** A game cell can hold a different sponsor than All games, but cannot hold none while All games has one. Add an explicit empty override if a tenant asks.
- **No per-game creative override.** A sponsor has one kit; a game-specific tagline means editing the kit or a second sponsor record. Add `overrides` on the placement if a sponsor ever asks.
- **Consent per game (`OPT-06`) stays unbuilt.** A sponsor placed at a game does not prompt fans who never answered its opt-in; `activeOptIns(context)` is still the seam.
- **The free square is not built** (field-split doc). It becomes a fourth placement slot, additively, when the game gains one.
- ~~**The recap page's sponsor logos**~~ — **closed 2026-09-23** by [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md): editions take their mark from `sponsorMarkUrl`.

## References

- [`documents/PRD/branding-field-split.md`](../../../documents/PRD/branding-field-split.md) — the classification this builds; its `prizePopup` row is superseded by `SP-11`/`SP-12`
- PRD `BRAND-02`–`BRAND-04`, `TEN-04`, `RPT-04`, `RPT-05`, `SEC-02`, `IDN-11`, `ADM-03`
- WAVE-RULES 2026-09-24, "Arthur's rulings": Sponsors, Full pages instead of drawers, Lists
- [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page, its Sponsors tab, the builder, the lock
- [`admin-prizes.spec.md`](admin-prizes.spec.md) — the tier editor's "Provided by", the award snapshot, the tier migration (step 3)
- [`admin-preview.spec.md`](admin-preview.spec.md) — `FanAppPreview` on the sponsor page and the contest Preview tab
- [`admin-lists.spec.md`](admin-lists.spec.md) — paging and endless scroll
- [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md) — the recap, whose editions `SP-13` re-keys
- [`prize-delivery.spec.md`](prize-delivery.spec.md) — the prize email's credit mark, re-sourced by `SP-11`
- [`admin-branding.spec.md`](admin-branding.spec.md), [`admin-exports.spec.md`](admin-exports.spec.md), [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), [`admin-surface.spec.md`](admin-surface.spec.md)
- The S1/S2 preview interface, `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` (workspace), sections 5.1 and 5.5
- Fan side (S2, same wave): `spec/webapp/fan-app-v2.spec.md` (the Gate, Home and prize ladder credits), `fan-contest-flow.spec.md` (the prize popup), `fan-preview-mode.spec.md`
