# Core Module Spec: Admin — Games & Contests, Prizes

**Implements:** PRD `ADM-02`, `ADM-04`, `GAME-01`, `GAME-02`, `BRAND-02`, `PRIZE-01`, `PRIZE-05`–`PRIZE-07`. Writable by a tenant `org:admin` for their own organization since the 2026-09-16 ruling; `org:member` views. Finalization (`ADM-06`, `PRIZE-03`) is deliberately **not** on these screens — see "Where finalization lives".

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the permission table, the `/games` and `/prizes` nav destinations. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the tenant-targeting rule, the write allow-list, and the `org:member` view-only presentation this reuses verbatim.

**Status:** Draft.

## Overview

The two screens an OBS operator uses to answer "what is this tenant running, and what can fans win": Games & Contests at `/games` and Prizes at `/prizes`, plus the `/admin` endpoints behind them.

**The whole change, in one line:** a tenant's contests, their scheduled games, and their prize tiers become readable through the admin surface — and the per-contest prize tier that `BRAND-02`/`GAME-02` call config becomes editable by the team's own admins, and by OBS, without a database write.

**In scope:** two screens, four endpoints (`GET /admin/games`, `GET /admin/prizes`, `PUT /admin/contests/:contestId/games`, `PUT /admin/contests/:contestId/prize-tiers`), their contracts in `obs-b2b-shared`, and the delivery statistics both screens read from `PrizeRedemption`. **Tenant write access is in scope as of the 2026-09-16 ruling** — a tenant `org:admin` toggles their own games and edits their own prize tiers; `org:member` views.

**Not in scope:**

- **Contest finalization** (`ADM-06`, `PRIZE-03`). Belongs to OBS Internal, not here — reasoned below.
- **The dead-letter / failed-send queue** (`PRIZE-07`). The Prizes mock devotes a card to it; it is the `/delivery-queue` destination in the admin-surface nav table, and it is platform-wide by `PRIZE-06`'s own argument (a bounce degrades deliverability for *every* tenant, so the queue is not a per-tenant view). The screen links to it and shows a count; it does not embed it. **Spec wins over mock.**
- **Sponsors and sponsor assets** (`BRAND-02`'s asset list, `BRAND-03`). No sponsor collection exists — `OptInDefinition.sponsorId` is an unresolved `ObjectId` pass-through and nothing else in the data model names a sponsor. The Games mock's sponsor chips and the four per-game asset slots have no store to read or write. Modelling sponsors is its own change; until it lands these screens show no sponsor affordance rather than a decorative one. **Spec wins over mock.**
- **Coupon code batches** (`PRIZE-05`). Same reason: no batch, code, or assignment collection exists. The mock's "1,412 / 2,000 left" meter and "Upload batch" action are drawn against a model that has not been built. `PRIZE-05` also states fulfillment — including batch exhaustion — is per-sponsor custom code, not shared platform code, so the batch store should be designed with the first real sponsor handler, not speculatively here. **Spec wins over mock.**
- **Creating and deleting contests.** A contest is created at tenant onboarding (`TEN-05`, still a manual write). Editing an existing contest's game list and tiers is the per-game config `BRAND-02` requires; contest lifecycle is not.
- **Difficulty tuning** (`GAME-03`) beyond `threeInARows`. The tier's difficulty knob in the data model *is* `threeInARows` (1–8 bingos). `GAME-02`'s richer tier fields — approximate value, redemption window, redemption method and location — have no columns on `B2BPrizeTier`; adding them is a model change this spec does not make. Recorded as a gap.
- **Export cadence** (`RPT-06`) — the Exports module, as in the Fields & Opt-ins spec.

---

## What the data model actually is

The mocks draw a per-game row with its own toggle, sponsors, and tier count. The model is one level up from that, and the screens follow the model:

- A **`B2BContest`** belongs to a tenant, holds `allowedBetEvents` (the scheduled games it runs at) and `prizeTiers`, and carries `showContest`, `closed` and `finalized`.
- A **`BetEvent`** is a scheduled game — read-only reference data replicated into `readonly_*` by Atlas triggers, which B2B never writes. `GAME-01`'s "drawn from the games available in OBS's existing event data" is exactly this: selection, not authoring.
- A **`B2BPrizeTier`** belongs to a contest, not to a tenant and not to a game. `threeInARows` is the mock's "BINGOS" column.

Two consequences the screens must own rather than paper over:

1. **Enabling a game is adding a `BetEvent` to a contest's `allowedBetEvents`** — the mock's per-row toggle, correctly typed. A game not in the list is the mock's "Off".
2. **Prize tiers are per contest, so the same tier list applies to every game in that contest.** The mock shows a per-game tier count and a per-game tier checklist; the model cannot express "different tiers for game A and game B of the same contest" without a second contest. `GAME-02`'s "Prize tiers can differ between two games for the same tenant" is satisfied by two contests, which is how a tenant running distinct activations is already modelled. The Games screen therefore shows the tier count as *the contest's*, and the detail panel says so.

**Status is derived, never stored.** `getB2BContestStatus` in `obs-b2b-shared` already returns exactly the mock's vocabulary — Finished, Closed, Open, Upcoming with an "Opens in 3 hours" string. The screens render that helper's output rather than inventing a parallel status.

---

## The screens

Both follow the Fields & Opt-ins screen's established shape: the tenant being acted on comes from the console-wide sidebar switcher, and OBS with nothing chosen gets the "Pick a tenant" empty state fed by `GET /admin/tenants`, which sets that same selection; an OBS request names the tenant explicitly as `?tenant=<slug>`; a non-obs user's URL never carries the parameter.

### `/games` — Games & Contests

The tenant's contests, each a card holding its games table. Per game row: the matchup (`bettingEvent`), tip-off (`eventTime`), venue where reference data carries it, and whether the contest runs at it. A row's status is the contest's derived status narrowed by that event's own `status` (`InProgress` → Live, `Final` → Final).

Selecting a row opens the detail panel: the contest it belongs to, its prize tiers (not editable here — Prizes owns tier editing), and the game's own reference facts. **Toggling a game on or off is the one write on this screen**, available to obs staff and to the tenant's own `org:admin`.

The contest header carries participation (`numberParticipants` / `maxParticipants`) and an **Incomplete** warning when the contest is enabled at a game but has no prize tiers — the mock's amber row, and a real operator error: fans can play a contest that can award nothing.

### `/prizes` — Prizes

The tenant's prize tiers, grouped by contest, each showing name, `threeInARows`, description, the fulfillment handler (`handlerId`), and delivery counts for that tier drawn from `PrizeRedemption`. **Add, edit and remove tiers** via a drawer, for obs staff and the tenant's own `org:admin`.

A **Delivery** card summarises the tenant's `PrizeRedemption` records — fulfilled, pending, failed, skipped — with a link to `/delivery-queue` for the failures themselves. This is the honest, model-backed half of the mock's two right-hand cards; the code-batch card is the half with no model.

`handlerId` is a free-text field with an explanatory note, not a picker: `PRIZE-05` makes handlers per-sponsor custom code and there is no registry to enumerate. `ADM-04`'s "which handler applies to a tier is selected here" is satisfied by the field being editable; making it a picker requires a handler registry that does not exist.

**View-only for `org:member`.** Identical to the Fields & Opt-ins decision, for the identical reason: a member sees the same layout as a view-only presentation — badges and static values where an admin gets controls — with one line of explanation. Not disabled controls; this is a role, not a state. The presentation is keyed per control off the role claim, so the same screen serves a tenant admin, a tenant member, and an OBS operator.

---

## Where finalization lives

**Not on these screens. It belongs to OBS Internal, as its own surface.** Three reasons, in order of weight:

1. **It is not tenant-scoped configuration.** Everything else on `/games` and `/prizes` is per-tenant config a tenant could plausibly own — and as of 2026-09-16 does own. Finalization is `org:contest:finalize`, obs-only *permanently* (admin-surface Rule 9, decision 2026-09) — it was never waiting on a ruling, and it is never coming to tenants. The 2026-09-16 ruling is precisely the case this argument anticipated: every other control on these screens flipped to tenant admins, and a permanently-obs action sitting among them would have flipped with them.
2. **It is irreversible and requires reverification** (`IDN-13`). The admin-surface spec lists finalizing a contest beside exporting fan data and deleting a fan's data. Those live in OBS Internal (`/fan-actions`). An action that triggers real, unrecallable prize sends belongs with its peers behind the same reverification affordance, not one click from a config toggle.
3. **Its blast radius is platform-wide, not tenant-wide** (`PRIZE-06`). A failed send degrades sender reputation for every tenant. The admin-surface spec's own test — "whose mistake does it become?" — puts it with OBS.

If a finalize affordance appears on these screens in a later mock, it must not render for tenant scope, and it should be a *link* to the OBS Internal surface rather than the control itself. The screens do show `finalized` as a status badge: tenants **view** contest state, OBS **operates** finalization.

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` (admin-surface Rule 1). Contracts in `obs-b2b-shared/src/api/admin/` (`games.ts`, `prizes.ts`), composed from the existing `B2BContest` / `B2BPrizeTier` shapes.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/games` | `requireAdmin` | Any resolved admin scope (`ADM-02` read) |
| GET | `/admin/prizes` | `requireAdmin` | Any resolved admin scope (`ADM-02` read) |
| PUT | `/admin/contests/:contestId/games` | `requireAdmin` + obs staff or tenant `org:admin` | The tenant's own admins, or OBS on any tenant (`GAME-01`, `BRAND-02`) |
| PUT | `/admin/contests/:contestId/prize-tiers` | `requireAdmin` + obs staff or tenant `org:admin` | The tenant's own admins, or OBS on any tenant (`GAME-02`, `BRAND-02`) |

**Tenant targeting** is the Fields & Opt-ins rule unchanged: a tenant-scoped caller's target is `scope.tenant` and any `?tenant=` is 403 even naming their own; an OBS caller must send `?tenant=<slug>` (400 without, 404 unknown, 404 reserved).

**`:contestId` is not a tenant identifier**, but it is an identifier that could cross tenants, so it gets the same treatment: every write re-reads the contest and verifies its `organizationId` matches the resolved target tenant, answering **404** — not 403 — when it does not. A 403 would confirm the contest exists under some other tenant; 404 tells an OBS operator who fat-fingered an id exactly as much as they need.

**`GET /admin/games` returns** the tenant, its contests, and for each contest its derived status, participation, tier count, and its games — each with the event's id, matchup, tip-off, status, and whether it is enabled. Because `allowedBetEvents` holds only the enabled events, the *candidate* games a contest could run at come from the reference `BetEvent` collection: the response includes upcoming events for the sport in a bounded window, so the screen can offer the mock's "Off" rows. Where no reference events exist the contest still renders with its enabled games.

**`GET /admin/prizes` returns** the tenant, its contests with their full tier lists, and delivery stats per tier and per tenant from `PrizeRedemption`.

**`PUT .../games` takes** `{ betEventIds: string[] }` — the desired enabled set, whole, mirroring the config PUT's replacement semantics. Ids must be distinct and must exist as reference events; unknown ids are 400 rather than silently dropped, because silently dropping is how a game quietly fails to run.

**`PUT .../prize-tiers` takes** the desired tier list, whole: `{ tiers: [{ _id?, threeInARows, handlerId, prizeName, prizeDescription, ... }] }`. A tier with an `_id` is updated, one without is created, and a stored tier absent from the list is removed from the contest. **1–3 tiers** (`GAME-02`: "Each game supports 1–3 prize tiers"), `threeInARows` 1–8 (the model's own comment), distinct `threeInARows` per contest — two tiers awarding at the same bingo count is ambiguous to the evaluator, which resolves a board's win to one tier.

Both writes respond with the updated contest plus a `changes` summary, matching the config PUT's precedent so the UI can confirm what actually happened.

**Removing a tier never deletes redemption history.** `PrizeRedemption` rows reference `prizeTierId` and are the record that a fan won something; they outlive the tier exactly as `ConsentRecord`s outlive an opt-in (`OPT-04`'s reasoning, same shape). Removal detaches the tier from the contest; it does not erase what was awarded.

---

## Permissions

`org:tenant_config:manage` — which `BRAND-02` and `GAME-01` name as covering sponsor assets, prize tiers and active games, i.e. exactly these two writes — is held by tenant `org:admin` and every obs role since the 2026-09-16 ruling (admin-surface Rule 3); `org:member` holds the read grant only. Enforcement is **structural**, identical to `PUT /admin/config` and for the identical reason: the admin Clerk instance has no custom permissions provisioned, so `has()` returns false for everyone including OBS, and `requirePermission` would be dead on arrival while looking like authorization design. The allow-list is obs staff, or an `org:admin` of the organization the contest belongs to. `requirePermission("org:tenant_config:manage")` remains the upgrade path once the instance defines it; the structural check remains afterwards as defense in depth for the cross-tenant `?tenant=` path.

`org:contest:finalize` is not enforced here because nothing here finalizes.

---

## Rules

1. **No admin handler takes a tenant identifier except the verified OBS `?tenant=` parameter.** `:contestId` is verified against the resolved tenant and 404s on mismatch.
2. **`BetEvent` is read-only.** These endpoints select events into a contest; they never create, edit, or delete one. B2B does not own that collection.
3. **Contest status is derived by `getB2BContestStatus`**, never stored or recomputed screen-side.
4. **Prize tiers are per contest.** No endpoint or screen implies a per-game tier set.
5. **Writes require obs staff or the contest's own tenant `org:admin`**, enforced server-side; the view-only presentation for `org:member` is UX, not the boundary.
6. **Removing a prize tier never deletes `PrizeRedemption` records.**
7. **Finalization is not on these screens** and no control here sets `finalized`.

---

## Known gaps (recorded, not blocking)

- **No sponsor model.** `BRAND-02`'s per-game sponsor assets and `BRAND-03`'s multiple sponsors per game cannot be configured until sponsors exist as records. This is the largest gap between the mocks and the platform, and it blocks a headline V1 requirement.
- **No coupon-code batch model.** `PRIZE-05`/`PRIZE-06` describe assigning unused codes from a sponsor batch and never issuing one twice; nothing stores a batch or an assignment. `PrizeRedemption` records *that* a tier was fulfilled, not *which code* went out.
- **`GAME-02`'s tier fields are partly unmodelled** — approximate value, redemption window, redemption method, redemption location. `GAME-03`'s difficulty tuning is served only by `threeInARows`.
- **`B2BContest.allowedBetEvents` has no per-event configuration**, so anything genuinely per-game (the mock's per-game sponsor assets) needs a model change, not just a UI.
- **`POST /b2b/contest/prize-tier` is still on the fan surface** behind `requireMembership`, where any fan of a tenant can write prize config. The admin-surface spec already calls for its removal; `PUT /admin/contests/:contestId/prize-tiers` is its replacement, and retiring the fan route is follow-up work this spec does not perform.

## References

- PRD: [`ADM-02`, `ADM-04`, `ADM-06`, `BRAND-02`–`BRAND-04`, `GAME-01`–`GAME-04`, `PRIZE-01`–`PRIZE-07`, `TEN-05`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework, nav table, reverification list
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the tenant-targeting and view-only presentation patterns this reuses
- Mocks: `mocks/admin-console/Games-Contests.png`, `Prizes.png` (workspace) — layout source; sponsor assets, code batches and the failed-send queue deliberately not implemented
