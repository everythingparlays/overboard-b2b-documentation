# Branding field split — BRAND-01 vs BRAND-02, field by field

**The document PRD §8.1 promises.** The PRD establishes the split between set-once tenant elements
(`BRAND-01`) and per-game elements (`BRAND-02`) and the rule for deciding; this document applies the
rule to every visual and sponsor field the platform has, names where each one is stored, who edits
it, and where a fan sees it.

**Status:** Written 2026-09-23 with the sponsor model ([`admin-sponsors.spec.md`](../../spec/core-modules/1-draft/admin-sponsors.spec.md)). Where this document and a spec disagree about *which category* a field is in, this document wins; where they disagree about *how* it is built, the spec wins.

---

## The rule, restated

PRD §8.1: a field is **per-game** (`BRAND-02`) if it can change between one game and the next and
must never need an engineer; it is **set-once** (`BRAND-01`) if it is the tenant's identity and
holds for the season.

Two amendments since the PRD was written, both already ruled:

1. **Set-once no longer means engineer-edited.** [`admin-branding.spec.md`](../../spec/core-modules/1-draft/admin-branding.spec.md) made the `BRAND-01` elements stored configuration that a tenant's own admins edit on the console. The per-tenant source files survive as **seeds** — first paint and offline fallback — and the server wins. So the split below is about *cadence and scope* (tenant-wide for the season vs per game), not about who is allowed to type the value.
2. **Sponsors are records, not strings** (`TEN-04`, this wave). Every `BRAND-02` asset belongs to a sponsor, and a sponsor is placed at games. There is no per-game asset that exists without a sponsor to own it.

---

## Set-once tenant elements (`BRAND-01`)

Tenant-wide, one value for the season, stored on the organization, edited on **Sponsors &
Branding → Brand**.

| Element | Stored as | Fan sees it | Seed (fallback) |
|---|---|---|---|
| Team colors, type, shape, finish, signature | `branding.theme` (`ThemeSettings`) | Every screen | `config/tenants/<slug>.ts` `colors`, via `themeFromLegacyColors` |
| Team logo | `branding.assets.logo` | Sign-in screen, site header | `config/tenants/<slug>.ts` `logo` |
| Official name | `B2BOrganization.name` | Headers, titles | `config/tenants/<slug>.ts` `name` |
| App/game naming ("Wild Bingo") | Derived from the name today | Start screen headline | — |
| Default progress marker | `branding.assets.sliderTipImageUrl` | The board's progress slider, when no sponsor holds the slider at that game | `config/tenants/<slug>.ts` `sliderTipImageUrl` |
| Player headshots | Reference data (`readonly_entities`) | Board cells | — (never tenant data) |
| Prize email template and delivery mechanics | Prize handlers (`PRIZE-04`/`PRIZE-05`) | The prize email | — |

**The default progress marker is the one field that appears in both halves.** It is the tenant's
own marker for the season (`BRAND-01`), and it is also a sponsor asset slot at a given game
(`BRAND-02`, "slider icon" below). The sponsor slot wins at games where a sponsor holds it; the
tenant's marker is what fills it everywhere else. Two fields, one render site, a fixed precedence
— not one field with two owners.

---

## Per-game sponsor elements (`BRAND-02`)

Every one of these belongs to a **sponsor record** (`B2BSponsor`, tenant-owned per `TEN-04`) and
reaches a game through a **placement** — which sponsor holds which slot at which game. Edited on
**Sponsors & Branding → Sponsors**. Never a code change (`BRAND-04`).

### The seven sponsor assets

The PRD's `BRAND-02` list names seven pieces of sponsor artwork and copy, plus the destinations
two of them link to. Each is a field on the sponsor's kit:

| # | PRD wording | Field on `B2BSponsor.assets` | Kind |
|---|---|---|---|
| 1 | Sign-in screen logo | `signInLogo` | Image URL (https) |
| 2 | Sign-in screen tagline | `signInTagline` | Text, ≤ 80 chars |
| 3 | Bingo board banner | `boardBanner` | Image URL (https) |
| — | …its destination link | `boardBannerLink` | Link URL (https); absent means the sponsor's website |
| 4 | Free square logo | `freeSquareLogo` — **not built**, see below | Image URL |
| 5 | Free square text | `freeSquareText` — **not built**, see below | Text |
| 6 | Slider icon | `sliderIcon` | Image URL (https), square |
| 7 | Prize popup logo | `prizePopupLogo` | Image URL (https) |
| — | "Visit our sponsor" destination URL | `B2BSponsor.websiteUrl` | Link URL (https) |

Plus the sponsor's `name`, used as every image's alternative text and in "Visit {name}".

### The four slots

A slot is **one render site a single sponsor can hold at a game**. Assets group into slots by
where the fan sees them:

| Slot id | Render site (fan app) | Assets it renders | Needs, to be placeable |
|---|---|---|---|
| `signIn` | Start/sign-in screen, under the headline — "presented by" | `signInLogo`, `signInTagline`; the logo links to `websiteUrl` | a logo or a tagline |
| `boardBanner` | Board screen, between the header and the grid; the whole banner is a link | `boardBanner` → `boardBannerLink ?? websiteUrl` | `boardBanner` |
| `slider` | The progress slider's moving marker on the board | `sliderIcon` | `sliderIcon` |
| `prizePopup` | The prize popup, under the prize | `prizePopupLogo`, plus "Visit {name}" → `websiteUrl` | `prizePopupLogo` |

The `prizePopup` holder is also credited in the prize email, as a "Presented by" mark with the same
logo (`prize-delivery.spec.md`) — the same slot reaching the fan's inbox, not a fifth slot.

`BRAND-03` (several sponsors per game) is satisfied **by slot**: different sponsors hold different
slots at the same game, and **one sponsor per slot per game**. That is also the platform's answer to
the teams' "don't let it get visually overloaded" — the board can carry at most one banner, the
popup at most one logo, by construction rather than by review.

**"Visit our sponsor" is not a slot.** It is where a sponsor's marks lead, so it lives on the
sponsor (`websiteUrl`), not on a placement: every tappable mark of that sponsor, in any slot,
goes there unless the slot has its own destination (only the banner does).

### Where a placement applies

A placement names a contest, optionally one game in it, a sponsor, and the slots it holds:

- **Every game in the contest** — no game named. The season sponsor case: one row, and it covers
  games added to the contest later.
- **One game** — overrides the contest-wide holder of the same slot at that game only.

Resolution for a slot at (contest, game): the game's own placement, else the contest-wide one,
else nothing. The sign-in screen has no contest of its own, so it uses the tenant's **featured
game** — the game in progress, else the next to start, else the most recent — and resolves
against that.

### Not built: the free square

The PRD lists a free square logo and text. **The board has no free square** — it is a uniform 3×3
of player props, and the win evaluator counts all nine cells. Offering the two fields would be a
console control that renders nothing, which the omission rule forbids. A free square is a
*game-rules* change (eight props, a pre-claimed centre, the evaluator's lines, the difficulty of
every tier), not a branding one, and it belongs with the game-type work. When the board gains one,
`freeSquare` becomes the fifth slot and the two fields join the kit — both additive.

---

## Retired and legacy fields

| Field | Status |
|---|---|
| `branding.assets.sponsorName`, `branding.assets.sponsorLogo` | **Legacy.** Carried on the contract, edited by nothing. Read by the fan app only for a tenant with **no sponsor records at all**, the same way the seed files are read. The first sponsor a tenant creates switches it to the sponsor model everywhere. |
| `config/tenants/<slug>.ts` `sponsorName`, `sponsorLogo` | **Seed.** Same rule — the last fallback for a tenant that has never configured a sponsor. |
| `OptInDefinition.exportFields` | **Moved** to `B2BSponsor.exportFields`. Still written (mirrored) while main-era code reads it; see the sponsor spec. |

## References

- PRD [`§8 Branding & Sponsor Assets`](OBS_B2B_Platform_PRD.md), `TEN-02`, `TEN-04`, `TEN-05`, `§15.2`
- [`admin-sponsors.spec.md`](../../spec/core-modules/1-draft/admin-sponsors.spec.md) — the sponsor model, placements, the screen and the fan wire
- [`admin-branding.spec.md`](../../spec/core-modules/1-draft/admin-branding.spec.md) — the `BRAND-01` theme and assets
