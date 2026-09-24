# Core Module Spec: Admin — Schedule (workspace tab and "All games")

**Implements:** Arthur's 2026-09-24 ruling: "Every tenant gets a Schedule tab. Both the tenant and staff calendars get an **All games** toggle showing the whole platform schedule." PRD `ADM-01`, `GAME-01` (games come from the reference schedule).

**Depends on:** [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) — the staff Season calendar this reuses. [`admin-lists.spec.md`](admin-lists.spec.md) — the list view pages like every other list. [`admin-surface.spec.md`](admin-surface.spec.md) — scope and the `?tenant=` exception.

**Status:** Draft — built on `arthur-g1-console` (2026-09-24).

## Overview

Staff have had a Season calendar since 2026-09-23: every enabled game at every workspace, by month or as a list. A workspace had no calendar at all — the nearest thing was the Overview's next eight games. Planning a season means seeing it.

**The whole change, in one line:** the Season calendar's screen becomes one calendar component with two homes — **Schedule** in every workspace's sidebar, and **Season calendar** in OBS Internal — and both gain an **All games** toggle that switches from "games we run" to the whole schedule Overboard carries.

## The two homes

| | Workspace **Schedule** (`/schedule`) | Staff **Season calendar** (`/season`) |
|---|---|---|
| Sidebar | Workspace section, after Game day | OBS Internal (moved from `/schedule`; `/schedule` with no workspace in view sends staff to `/season`) |
| Default view ("Our games") | The workspace's enabled games across its contests — the same rows as the staff calendar, filtered to this workspace | Every enabled game at every workspace, with the workspace filter |
| **All games** | Every game in the reference schedule in range, whether or not this workspace runs it. Games this workspace runs are marked with its contest names; nothing about any other workspace is shown. | Every game in the reference schedule, each marked with the workspaces running it ("Not in any contest" when none) |
| Readiness and outcomes | Shown on the workspace's own games, as on the staff calendar | Unchanged |
| Links | A game opens Game day for it (own games) | Unchanged: opens Game day in that workspace |

Both views keep Month and List. The toggle is a `Segmented` control ("Our games" / "All games" for a workspace, "In contests" / "All games" for staff) and is remembered per browser tab.

**The list view pages** (admin-lists.spec.md): from the chosen day forward, soonest first, loading the next page as the reader scrolls — a season, not a month. Search on team names; filters for sport and (staff) workspace. The month grid stays range-bound (at most 62 days, as today) and keeps "+N" opening the day drawer.

## The wire

`GET /admin/schedule` grows, additively:

- `scope`: `contests` (default, today's behaviour) or `all`.
- `tenant`: for staff, narrows to one workspace; for a workspace user it is their own and needs no parameter (the usual rule).
- **Workspace callers are now allowed.** Today the endpoint is staff-only. A workspace user gets their own games (`scope=contests`) or the reference schedule with only their own markers (`scope=all`).
- **List mode**: `to` becomes optional. With `from` and no `to`, the response pages forward (`cursor`, `limit`, `q`, `sport`) and carries `page`.
- `scope=all` rows are **feed games**: `{ betEventId, label, eventTime, feedStatus, sport, workspaces: { slug, name, contests: { contestId, name }[] }[] }` in a separate `feedGames` array, so the existing `games` rows keep their shape. For a workspace caller, `workspaces` carries at most its own entry.

## Rules

1. **A workspace never sees another workspace through the schedule.** All games shows the reference schedule and the caller's own contests only.
2. **The list view pages on the server**; the month grid stays range-bound.
3. **One calendar component**, two homes — no forked screen.
