# Core Module Spec: Admin — Sponsors

**Implements:** PRD `BRAND-02`, `BRAND-03`, `BRAND-04`, `TEN-02`, `TEN-04`, `RPT-04`, `SEC-02`, `ADM-03`. The field-by-field classification is [`documents/PRD/branding-field-split.md`](../../../documents/PRD/branding-field-split.md) — read it first; this spec builds what it classifies.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope, targeting, the reverification list ("deleting the sponsor does"), Rule 13. [`admin-branding.spec.md`](admin-branding.spec.md) — the screen this joins, the org-cache rule, the fan wire's allowlist discipline. [`admin-exports.spec.md`](admin-exports.spec.md) — the DPA field scope this model absorbs. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the opt-in a sponsor's consent lives on.

**Status:** Draft, written 2026-09-23 with the build. No open questions.

## Overview

**The whole change, in one line:** a sponsor stops being a string in a tenant's source file and an
opt-in with a `kind`, and becomes a tenant-owned record that carries its artwork and its DPA field
scope, is placed at games slot by slot, and reaches the fan app as data.

**In scope:** the `B2BSponsor` and `B2BSponsorPlacement` models; the move of `exportFields` off
`OptInDefinition`, back-compatibly; the opt-in ↔ sponsor link and the Fields & Opt-ins picker;
`/admin/sponsors` CRUD and placements; the public sponsor schedule; the Sponsors tab on
**Sponsors & Branding**; Exports' sponsor rows; the fan app's four render sites.

**Not in scope:** coupon codes and code batches (the prizes work's seam); sponsor sign-in
(`IDN-11` stands — sponsors receive exports, they never log in); the sponsor recap page; the free
square (a game-rules change — field-split doc); image upload (below, "Recorded gaps").

---

## The model

### `B2BSponsor` — `${prefix}sponsors`

```ts
interface B2BSponsor<TId = string> {
  _id?: TId;
  organizationId: TId;          // TEN-04: belongs to exactly one tenant
  name: string;                 // unique per tenant, case-insensitively
  websiteUrl?: string;          // "visit our sponsor" — https only
  assets?: SponsorAssets;       // the kit: the seven BRAND-02 assets (five built)
  exportFields?: string[];      // DPA field scope (RPT-04), moved here from OptInDefinition
  dpaReference?: string;        // which signed agreement the scope follows — free text
  createdAt?: Date; updatedAt?: Date;
}
interface SponsorAssets {
  signInLogo?: string; signInTagline?: string;
  boardBanner?: string; boardBannerLink?: string;
  sliderIcon?: string; prizePopupLogo?: string;
}
```

**A collection, not a subdocument on the org** — the test the branding spec applies (`THEME-11`,
`THEME-12`) comes out the other way here. A sponsor is an entity: it has an id that other records
reference (the opt-in's `sponsorId`, every placement, every `fan_export` audit row), its own
lifecycle (created and deleted independently of the tenant's other settings, deletion guarded),
and it is read without the rest of the org (the fan schedule, Exports). `optIns` stays on the org
because an opt-in is none of those things.

**`dpaReference` closes an exports-spec gap.** A stored scope used to be a list of ticked ids with
nothing naming the agreement it follows. With a sponsor entity there is a natural home: a free-text
line ("Coca-Cola DPA v3, signed 2026-08-01") beside the scope it governs. Free text because OBS does
not hold the DPAs and cannot validate one; the value of the line is that the next admin can find
the document.

### `B2BSponsorPlacement` — `${prefix}sponsor_placements`

```ts
type SponsorSlot = "signIn" | "boardBanner" | "slider" | "prizePopup";
interface B2BSponsorPlacement<TId = string> {
  _id?: TId;
  organizationId: TId;
  contestId: TId;
  betEventId?: TId;             // absent: every game in the contest
  sponsorId: TId;
  slots: SponsorSlot[];         // at least one, no repeats
  createdAt?: Date; updatedAt?: Date;
}
```

**A join record, not a restructuring of `allowedBetEvents`** (approved shape). Per-game sponsor
config needed somewhere to live that is keyed by (contest, game); turning `allowedBetEvents` into an
array of objects would rewrite the most-read field on the most-read B2B document, touch the
board evaluator's path, and collide with the contests overhaul running in parallel. A separate
collection keyed by `contestId` touches none of it.

**Contest-wide placements.** A placement with no `betEventId` holds its slots at every game in the
contest, including games enabled later. That is the common case — a season sponsor — and without
it a twenty-game contest is twenty identical rows that drift the first time one is edited.

**`SP-01` — One sponsor per slot per game.** Within a contest, a slot is held by at most one
contest-wide placement, and at most one placement per game. A game-specific holder overrides the
contest-wide holder *of that slot* only. `BRAND-03` (several sponsors per game) is several sponsors
in different slots; the visual-overload concern is answered by construction.

**`SP-02` — A slot is placeable only when the sponsor has its artwork.** `signIn` needs a logo or a
tagline, `boardBanner` a banner, `slider` an icon, `prizePopup` a logo. The write refuses anything
else (400, naming the sponsor and the missing piece) — a placement that renders nothing is a
control that lies. If an asset is later cleared from a sponsor that is placed, the write is
allowed and the fan app omits the slot; the console marks the placement so the admin can see why
it stopped showing.

**A disabled game keeps its placements, hidden.** Placements for a game no longer in the contest are
not deleted — re-enabling the game brings them back — and are neither returned to the console's
schedule nor resolved for fans.

---

## Moving `exportFields` off the opt-in

The DPA scope moves to the sponsor. The shared dev database is also read by `main`, whose code reads
`OptInDefinition.exportFields` and knows nothing of sponsor records — and production will be in the
same position on deploy day. So the move is **additive, dual-written, and never destructive**.

1. **Migration, idempotent, dry-run by default** — `node-server/scripts/migrate-sponsor-records.mjs`.
   For every `kind: "sponsor"` opt-in whose `sponsorId` does not name a sponsor record of that
   tenant, create one (`name` from the opt-in's label, `exportFields` copied) and set the opt-in's
   `sponsorId`. It never unsets or rewrites an opt-in's `exportFields`, never deletes anything, and a
   second run changes nothing.
2. **Reads prefer the sponsor.** A sponsor's scope is `sponsor.exportFields`, falling back to its
   linked opt-in's `exportFields` when the sponsor has none stored.
3. **Writes mirror.** A field-scope save writes the sponsor **and** copies the same list onto its
   linked opt-in, so `main`-era code exports exactly what the new code would. Deleting a field prunes
   both. The mirror is the one piece of this that is temporary: it retires once every environment
   has run the migration and no deployed code reads the opt-in copy (recorded gap).
4. **Unmigrated data keeps working.** A `kind: "sponsor"` opt-in with no sponsor record still appears
   on Exports as a row of its own, exportable and scope-editable exactly as before. A tenant that never
   runs the migration loses nothing; one that does gains the sponsor record.
5. **The Exports contract only grows.** Every row and request stays keyed by the consent opt-in
   (`optInId`, required, as before); the record reaches the screen through new optional fields
   (`sponsorId`, `dpaReference`). Every existing field keeps its type, so a consumer pinned to the
   shared package without this work still compiles. (A first cut made `optInId` optional and broke
   exactly that; it was reverted within the wave.)

**`SP-03` — Fail closed is unchanged.** No stored scope — on the sponsor or its opt-in — means no
export (409). A sponsor with **no linked consent opt-in** has no fan who agreed to share anything
with it, so it has no export and **does not appear on Exports** until it is linked; its scope is
set there once it is. Exports is about consent-based sharing, and a row with no consent behind it
would be a checklist authorizing nothing.

### The opt-in ↔ sponsor link, and the picker

`OptInDefinition.sponsorId` finally names something. The Fields & Opt-ins drawer offers a
**Sponsor** picker on `kind: "sponsor"` opt-ins, listing the tenant's sponsors plus "Not linked".

**This supersedes the fields spec's no-picker rule, which was right when written**: it existed
because there was no collection to pick from, and an id field with nothing behind it would have
been a control that invents a relationship. The collection now exists, and the link is what makes
the model hang together — it is how a sponsor's export finds its consent records (`RPT-05`), and
how Exports can call a row "Coca-Cola" rather than "Share my data with Coca-Cola". A picker rather
than a free id field because the only legal values are this tenant's sponsors, and a picker cannot
offer anything else.

**`SP-04` — One consent opt-in per sponsor, and only sponsor-kind opt-ins link.** `PUT /admin/config`
refuses (400) a `sponsorId` that is not one of the tenant's sponsors, a `sponsorId` on a non-sponsor
opt-in, and two opt-ins linked to the same sponsor. One, because the row filter needs exactly one
consent to test; a sponsor that wants a marketing opt-in as well gets a `marketing` opt-in, which
filters nothing. Linking and unlinking are label edits as far as consent goes: they do not bump
`textVersion`, since they change nothing the fan read.

---

## The screen — Sponsors & Branding

**The nav destination `Branding` becomes `Sponsors & Branding`**, at the same route, with two tabs:
**Sponsors** (`/branding/sponsors`) and **Brand** (`/branding`, the existing theme editor,
unchanged).

**Argued:**

- **Why not a separate `/sponsors` destination?** PRD §8 is one section — "Branding & Sponsor
  Assets" — and `BRAND-01`/`BRAND-02` are two halves of one question: *what does the fan app look
  like, and whose brand is on it.* An admin preparing a game day thinks about the team's look and
  the sponsor on the board together. Splitting them across the nav makes the Configuration section
  longer to say the same thing twice.
- **Why not a section at the bottom of the existing page?** The Brand editor is draft-and-publish
  with a live preview column; sponsors are records saved one at a time, and the schedule is a grid.
  One scrolling page holding two save models puts a Publish bar above controls it does not
  publish. Tabs keep one destination while giving each model its own surface.
- **Why `/branding` stays the Brand tab.** Existing links and muscle memory land where they always
  did. The rename is a label change, not a move.
- **Why "Sponsors & Branding" and not "Branding & Sponsors".** Sponsors are the recurring task
  (every game); the brand is set for the season. The label leads with what an admin comes to do
  most often, and the Sponsors tab comes first for the same reason — but the Brand tab keeps the
  bare route.
- **Why not on Games & Contests**, where Nick's mock drew per-game sponsor chips? The schedule
  answers two questions — *who is on this game* and *where does this sponsor appear* — and the
  second is the one a sponsor's account manager asks. It belongs where the sponsor records live.
  Games & Contests carries a read-only summary that links here: each contest card names its
  sponsors, and the contest drawer lists each with "Every game" or "N games"
  ([`admin-contests.spec.md`](admin-contests.spec.md), "Sponsors on the contest card").

### The Sponsors tab

- **Sponsors** — one row per sponsor: its mark (the first image in its kit), name, the consent
  opt-in it is linked to when there is one, and where it runs ("3 games", "Every game · Hawks
  2026"). **Add sponsor** opens the sponsor drawer.
- **Sponsor drawer** — Name, Website, the kit grouped by where the fan sees it (Sign-in screen: logo,
  tagline · Board: banner, banner link · Progress slider: icon · Prize popup: logo), and Data
  agreement. Every image field shows the image beside the URL once it loads; a URL that does not
  load shows no thumbnail, and nothing else. Delete sits at the drawer's foot, behind
  reverification (admin-surface list), and is refused while an opt-in links the sponsor: "Unlink it
  from its opt-in on Fields & Opt-ins first."
- **Schedule** — pick a contest; a grid whose rows are **Every game** then each of the contest's
  games (matchup, date), and whose columns are the four slots. Each cell picks a sponsor from those
  with the slot's artwork. A game cell left empty shows the contest-wide holder, muted, so the
  inheritance is visible rather than implied. Save writes the contest's schedule whole.
- **Permissions** — tenant `org:admin` and OBS staff edit; `org:member` sees the same tab as state,
  without controls (D-059). No reverification except delete (`THEME-14`'s reasoning: placing and
  editing are undone by editing again).
- **Empty states** — no sponsors: the Sponsors card says so and offers Add sponsor; no contests: the
  Schedule card is absent. Nothing narrates what is not built (Rule 13).

### Exports and Fields & Opt-ins

- **Exports** lists each sponsor opt-in under its sponsor record's name when linked (its label
  otherwise). The field scope card gains the Data agreement line beneath the checklist when one is
  stored. Every request is still keyed by the opt-in; the server applies the record's scope and
  mirrors every scope save onto both.
- **Fields & Opt-ins** gains the Sponsor picker on sponsor-kind opt-ins (above).

---

## Endpoints

All under `/admin`, admin Clerk only, scope from `req.adminScope`, the usual targeting (`?tenant=`
for OBS; refused for anyone else). Contracts in `obs-b2b-shared/src/api/admin/sponsors.ts`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/admin/sponsors` | `requireAdmin` | Sponsors, contests with their games and placements, and the featured game |
| POST | `/admin/sponsors` | `requireAdmin` + write | Create |
| PUT | `/admin/sponsors/:sponsorId` | `requireAdmin` + write | Whole profile; `expectedUpdatedAt` precondition |
| DELETE | `/admin/sponsors/:sponsorId` | `requireAdminReverified` + write | 409 while an opt-in links it; removes its placements; audited `sponsor_delete` |
| PUT | `/admin/sponsors/placements` | `requireAdmin` + write | `{ contestId, placements[] }`, one contest's whole schedule |

"Write" is `refuseReadOnlyWrite` first, as every config write (D-063). Every write calls
`clearOrgCache()` and the sponsor-schedule cache (`THEME-15`'s reason: an admin who places a
sponsor and opens the site must see it).

**`SP-05` — Only deletion is audited.** Create, edit and placement are configuration, reversible by
editing again — the branding module's line (`THEME-10`). Deleting a sponsor is irreversible and
drops its placements; the `sponsor_delete` row carries the sponsor id, how many placements went,
and nothing else.

**Tenant deletion sweeps both collections**, like every other tenant-owned collection.

---

## The fan wire

**`GET /b2b/org/:subdomain/sponsors`** — unauthenticated, like the org endpoint, because the
sign-in screen renders before a fan exists. Response: `configured` (the tenant has at least one
sponsor record), the public sponsor projection, the placements for visible, unfinalized contests,
the `featured` game, and the `nextGame` it describes. Cached 60 seconds beside the org cache and cleared by the same writes.

**`SP-06` — The public projection is an allowlist.** `{ sponsorId, name, websiteUrl, assets }` and
nothing else. `exportFields`, `dpaReference` and `organizationId` never cross this wire, and a test
pins the key set exactly as `response-minimization.test.ts` pins the org endpoint's.

**`SP-07` — One resolver.** `resolveSponsorSlots(schedule, { contestId, betEventId })` in
`obs-b2b-shared` is the only code that decides which sponsor holds a slot. The fan app calls it
per screen; the server's tests pin it; nothing re-derives it.

**The featured game** (for the sign-in screen, which has no contest): among visible, unfinalized
contests' games, the one in progress; else the soonest not yet final whose start is no more than
three hours past (the feed lags); else the most recent. `pickFeaturedGame` in the shared package.

**The next game** (`nextGame`, added at integration 2026-09-23): the featured game described for the
sign-in screen's matchup — `{ betEventId, eventTime, homeTeam: { name, logoUrl? }, awayTeam }` —
but only while it is under way or still ahead by the same window (not final, start no more than
three hours past). When the featured game is only "the most recent", or is not a two-team game
with both names, `nextGame` is null and the start screen shows **no matchup** (D-068): the
hardcoded "UNO vs UND, Fri, Mar 7" matchup the start screen used to show for `test` and
`fightinghawks` is gone. Team logos cross the wire only as https URLs. `nextGameOf` in
`node-server/src/util/admin-sponsors.ts`; the contract is `publicNextGameSchema` in
`api/b2b/sponsors.ts` (nullish, so an older server reads as none).

### Render rules (fan app)

**`SP-08` — Render when configured; render nothing when not.** No placeholder, no "your sponsor
here", no empty frame. A slot with no holder, or whose holder lacks the artwork, is absent and the
layout closes around it.

**`SP-09` — Legacy only for a tenant with no sponsors.** While `configured` is false, the start
screen keeps its legacy presenting line from `branding.assets.sponsorName`/`sponsorLogo`, falling
back to the tenant seed file — the theme's seed-then-server pattern. The first sponsor record
switches the tenant to the model everywhere, and the legacy strings are never read again for it.

**`SP-10` — Outbound links leave safely.** Banner, logo and "Visit" links open in a new tab with
`rel="noopener noreferrer"`, and only `https:` URLs are stored (the contract refuses anything
else, `javascript:` included).

| Slot | Where | Renders |
|---|---|---|
| `signIn` | Start screen, beneath the headline | The logo (linked to the website) and tagline |
| `boardBanner` | Board, between header and grid | The banner image, full width, as one link |
| `slider` | Board's progress slider | The icon as the moving marker — else the tenant's marker, else the plain dot |
| `prizePopup` | Prize popup, beneath the prize | The logo, and "Visit {name}" when the sponsor has a website |

The board resolves against its contest and its game — the game of the board's props.

**Beyond the fan app: the prize email.** The `prizePopup` holder is also credited in the prize
email — a "Presented by" mark with the same logo, linked to the sponsor's website — resolved by
the same `resolveSponsorSlots` at the same (contest, board's game), so the email and the popup
always name the same sponsor. No holder, no mark ([`prize-delivery.spec.md`](prize-delivery.spec.md),
"Presented by"). It is not a fifth slot: placing a sponsor on the prize popup places it in both.

---

## Rules

1. **A sponsor belongs to exactly one tenant** and is only ever read or written through that
   tenant's scope (`TEN-04`).
2. **One sponsor per slot per game** (`SP-01`); a game-specific holder overrides the contest-wide
   one for that slot only.
3. **A slot is placeable only with its artwork** (`SP-02`).
4. **The DPA scope lives on the sponsor**; the opt-in copy is a write-through mirror, never read
   first, and retired later. No stored scope, no export (`SP-03`).
5. **A sponsor with no linked consent opt-in has no export and is not on Exports.**
6. **One consent opt-in per sponsor; only sponsor-kind opt-ins link** (`SP-04`).
7. **The migration creates and links; it never removes.** Idempotent, dry-run by default.
8. **Deleting a sponsor is reverified, audited, refused while linked, and takes its placements.**
9. **The fan wire is an allowlist** (`SP-06`); DPA data never reaches it.
10. **One resolver decides slot holders** (`SP-07`).
11. **Render when configured, nothing when not** (`SP-08`); legacy strings only for a tenant with no
    sponsor records (`SP-09`).
12. **Only `https:` links and images are stored**, and outbound links open with `noopener`.

---

## Recorded gaps (recorded, not blocking, never on screen)

- **The free square is not built** — the board has none (field-split doc). `freeSquare` becomes a
  fifth slot, additively, when the game gains one.
- **No image upload.** Every asset is a pasted https URL, exactly as the Brand tab's logo is today;
  there is no storage bucket, presign route or upload primitive anywhere in the platform. A real
  upload path (S3 presigned PUT, size and type limits, a CDN URL back) is the next step for both
  tabs at once and belongs in its own change.
- **The `exportFields` mirror onto opt-ins is temporary.** Retire it — stop writing, then drop the
  field from the opt-in schema — once every environment has run the migration and no deployed code
  reads the opt-in copy.
- **Placements are last-write-wins between two admins** editing one contest's schedule at once, as
  the branding module is. Acceptable at V1's operator count.
- **No per-game creative override.** A sponsor has one kit; a game-specific tagline means editing
  the kit or a second sponsor record. Add `overrides` on the placement if a sponsor ever asks.
- **Consent per game (`OPT-06`) stays unbuilt.** A sponsor placed at a game does not prompt fans who
  never answered its opt-in; `activeOptIns(context)` is still the seam.
- **The recap page's sponsor logos** read from this model when that page is built.

## References

- [`documents/PRD/branding-field-split.md`](../../../documents/PRD/branding-field-split.md) — the classification this builds
- PRD `BRAND-02`–`BRAND-04`, `TEN-04`, `RPT-04`, `RPT-05`, `SEC-02`, `IDN-11`
- [`admin-branding.spec.md`](admin-branding.spec.md), [`admin-exports.spec.md`](admin-exports.spec.md), [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), [`admin-surface.spec.md`](admin-surface.spec.md)
- Mock: `mocks/admin-console/Games-Contests.png` — the per-game sponsor chips and four asset slots this realizes, on a different screen (argued above)
