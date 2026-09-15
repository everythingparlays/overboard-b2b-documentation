# Core Module Spec: Admin — Overview

**Implements:** PRD `ADM-06` (surfacing, not the action), `ADM-07`, `RPT-05` (the coverage footnote), `OPT-01`–`OPT-05` (read-side), `PRIZE-07` (the dead-letter count). HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-12`.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution and the `?tenant=` exception. [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — finalization's home, and the shared failed-send source. [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — derived contest status.

**Status:** Draft.

## Overview

The landing screen, real: `mockOverview.ts` is deleted and every number on `/` now comes from the database, or is an honest gap.

**The whole change, in one line:** one `GET /admin/overview` read powering the tiles, the live banner, upcoming games, needs-attention and consent coverage — derived only from what the platform records.

**In scope:** the endpoint, its contract in `obs-b2b-shared/src/api/admin/overview.ts`, the rewritten screen, and its first tests (the mock version shipped with none).

**Not in scope:**

- **The Finalize button the mock draws on the live banner.** Settled: `PRIZE-03` finalization is obs-only and lives on OBS Internal's `/tenants` drill-in. Overview is the one screen both actor classes share; an obs-only irreversible control does not belong on it.
- **A time-range selector.** The mock's "Last 1/3/5 games" ranges need per-game attribution windows the platform does not compute. Deltas are fixed 14-day windows from creation timestamps instead — spec wins over mock, as with the exports cadence line. Recorded gap.
- **Signup conversion.** No entry-gate visit counting exists, so there is no denominator — the exports spec's recorded gap, inherited here. The tile renders an explicit "not measured yet" state; the wire value is `null`, never a number.

---

## One endpoint, not a composition

The screen could have composed `GET /admin/games` + `/admin/prizes` + `/admin/fans/search` + consent arithmetic client-side. It gets one endpoint instead, for the reasons the merged modules keep landing on: every screen so far is one read (`/exports`, `/fans`, `/config`); the tiles cross five collections and the join belongs where the indexes are; and two screens computing "failed sends" two ways is how dashboards drift — Overview's dead-letter count reads the same redemption rows as `/delivery-queue` and Platform health, per admin-obs-internal Rule 8.

## Derivations

Everything is stated so the honest boundary is checkable:

- **Fans joined** — membership count; the delta is joins in the last 14 days (`joinedAt`).
- **Boards played** — boards under the tenant's contests (ObjectId ids; redemptions keep string ids — the known mismatch the fans module handles, handled the same way); 14-day delta from `createdAt`.
- **Prizes delivered / failed** — redemption counts by status; the failed count is worded as the dead-letter figure and matches `/delivery-queue`.
- **Live now** — an enabled game whose reference status is `InProgress`, with boards-in-play, bingos hit (`claimedLineIndices` totals) and prize counts for its contest. No quarter/clock: the reference feed's lifecycle is all the platform has. Null hides the banner.
- **Upcoming games** — enabled games from four hours back (so in-progress stays visible), soonest first, capped; contest status is the derived one, never recomputed screen-side.
- **Needs attention** — only detectable conditions: failed sends (error), contests with games but no prize tiers (warning), visible contests with no games enabled (warning). The mock's "code batch under 10%" has no model behind it and is omitted, not decorated.
- **Consent coverage** — per non-blocking opt-in: members accepted at the **current** wording over total members, the same arithmetic as the exports screen's RPT-05 card, with the same footnote.

## The screen

Tenant users land on their own numbers with no parameter, as everywhere. An OBS caller now gets the standard in-page tenant chooser — Overview was the one scoped screen with a dead-end "Pick a tenant" card while five siblings offered the picker; it joins the idiom (`?tenant=`, remount on change). Same layout for both actor classes (`ADM-01`); nothing on this screen writes.

## Endpoints

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/overview` | requireAdmin | tenant: own org; obs: `?tenant=` required |

**`GET /admin/overview` returns** `{ tenant, liveNow, kpis, upcomingGames, needsAttention, consentCoverage }` per the contract; the usual 400 (obs, no tenant), 403 (tenant naming one), 404 (unknown/reserved slug).

## Rules

1. **No number on Overview is fabricated.** A metric without a substrate ships as `null` and renders as a stated gap, never as a plausible value.
2. **Failed-send counts come from the redemption rows** — the same source as `/delivery-queue` and Platform health.
3. **Contest status is the derived status**, computed server-side once.
4. **No finalize affordance on Overview.** The action is obs-only and lives on `/tenants` (admin-obs-internal).

## Known gaps (recorded, not blocking)

- **Signup conversion**: no entry-gate visit telemetry; `signupConversionPct` is `null` and the tile says why.
- **Per-game time ranges**: the mock's range selector is dropped; deltas are fixed 14-day windows.
- **Live-game detail**: no clock/quarter — the reference feed exposes lifecycle only.
- **Code-batch attention item**: omitted; no code-batch model exists (`PRIZE-05`/`PRIZE-06`, recorded in the games/prizes spec).

## References

- PRD: [`ADM-01`, `ADM-06`, `ADM-07`, `RPT-03`, `RPT-05`, `PRIZE-07`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — finalization and the shared failure source.
- Mock: `mocks/admin-console/Overview.png` — layout followed; the Finalize button and the range selector deliberately not.
