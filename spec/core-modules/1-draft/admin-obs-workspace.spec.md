# Core Module Spec: Admin — OBS Workspace (Operations, All Contests, Season Calendar)

**Implements:** PRD `OBS-04` (at planning horizon), `OBS-05`, `PRIZE-03`/`ADM-06` (surfacing contests waiting to be finalized — not the action), `SEC-06` (the audit log, read back), `ADM-01`. Concept seed: vault `cargo/passage-plans/2026-09-21-product-concepts.md` §2.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — Seamlessness, identity-rendered sections, and Honesty by omission (Rule 13). [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the cross-tenant read pattern (no `?tenant=`, structural 403), the one failure source, and finalization's home. [`admin-game-day.spec.md`](admin-game-day.spec.md) — readiness, phases, attribution and the live strip, all reused here unchanged. [`admin-support.spec.md`](admin-support.spec.md) — the support counts.

**Status:** Draft — built on `arthur-ops` (2026-09-23).

**Revised 2026-09-24** (ruling, Arthur) — All contests keeps its table, but a row now opens the contest's own page acting as that tenant, and carries Finalize. The `/contests` section carries the change; [`admin-contests.spec.md`](admin-contests.spec.md) owns the page and the Finalize rule.

## Overview

With no tenant chosen, an Overboard operator used to land on a void: "pick a tenant". The operator's real questions are platform-shaped — *what is live, what is about to go wrong, what changed* — and answering them took N tenant switches. This module gives staff a home and the two cross-tenant screens the platform was missing.

**The whole change, in one line:** `/operations` — the operator's home, four bands — replaces the no-tenant empty state; `/contests` lists every contest on the platform; `/schedule` is a season calendar of every game at every workspace with readiness at a glance. Three staff-only, cross-tenant reads behind them.

**In scope:** `GET /admin/obs-overview`, `GET /admin/all-contests`, `GET /admin/schedule` (`obs-b2b-shared/src/api/admin/obs-workspace.ts`); the three screens; the OBS Internal nav entries; Platform health's two touches (live workspaces first; the oldest-unresolved-report tile).

**Not in scope (and why):**

- **A cross-tenant All fans screen.** Rejected, permanently for V1: it fails `RPT-05`'s composition (a fan's standing differs per workspace), it cannot honour reverification's per-tenant scoping, and it would be the largest PII surface on the platform — for convenience. Fans stay per-workspace.
- **An All config screen.** The useful version is drift detection (flag the workspace with six required fields where peers have two). Recorded as its own idea.
- **A dedicated cross-tenant audit/exports view** (what you hand a sponsor's security reviewer). The Recent activity band reads the same log; a filtered, exportable view is the next step. Recorded.
- **`/tenants` deepened into an account view** (health, season summary, configuration-completeness checklist, audit feed, open reports). Mostly assembly of what this module builds; recorded.
- **Delivery queue filters.** The Prizes overhaul owns that screen this wave.
- **Attention rows the platform cannot detect** — coupon exhaustion (no coupon model), error spikes (no error substrate), missed export cadence (no delivery log). The concept listed these "named as absent"; **superseded by the omission ruling**: they are absent from the screen and recorded here.

---

## `/operations` — the operator's home

Reached three ways: it is the first entry in OBS Internal ("Operations"); `/` redirects to it for a staffer with no tenant chosen (the old "Pick a tenant" card on Overview is retired — every *other* per-tenant screen keeps its card for deep links); and the brand mark links home.

Four bands, top to bottom:

1. **Live now.** Always present. Each workspace with a game `in-play` or `pre-game` is a card — workspace, matchup, tip-off/elapsed, fans in play, failed sends — that sets the console's tenant and opens `/live` on that game. Empty, it names the next game anywhere ("Next: Bison @ Fighting Hawks · UND · Fri 7:05 PM") with its readiness dot. With nothing scheduled at all, it says so in four words.
2. **Platform numbers.** Workspaces, fans (+ joined in 7 days), boards this week, prizes delivered this week (with failed sends as the danger delta when non-zero), games this week. All counts; no revenue, no engagement, no invented tiles.
3. **Needs attention — the heart.** Cross-tenant and ranked, errors before warnings, then by urgency:

   | Kind | Detects | Links to |
   |---|---|---|
   | `game-not-ready` | A game in the next **24 hours** whose readiness is not clean — the pre-kickoff row, the highest-value one | That workspace's game day, on that game (the checklist links to each fix) |
   | `failed-sends` | A workspace with prizes sitting failed | Delivery queue |
   | `no-prize-tiers` | A contest with games enabled and no prize attached | Prizes, in that workspace, open on that contest (`?contest=`) |
   | `no-games-enabled` | A visible, open contest with no games | Games & Contests, in that workspace |
   | `ready-to-finalize` | An unfinalized contest all of whose games have **ended** | All tenants (finalization's home) |
   | `paused-workspace` | A paused workspace, with how long | All tenants |
   | `support-reports` | Unresolved Tell Overboard reports, with the oldest's age | Support inbox |

   Clicking a workspace-scoped row sets the console's tenant first, so the destination opens on the right workspace.
4. **Recent activity.** The audit log rendered as a cross-tenant feed — "Nick finalized Hawks Hockey Bingo · UND · 2h ago". Twenty newest. The actor's name is resolved from the admin sign-in (cached); the subject is resolved from the entry's ids (a contest's or workspace's name) — never a fan's name, which the log does not hold. Needs the audit log's `{ createdAt: -1 }` index (added by this module).

## `/contests` — All contests

"What's running this weekend across all clients" used to take N tenant switches. One row per contest on the platform: contest and workspace, game type, derived status, visibility, next game with its readiness dot, games, prize tiers, players, delivered / failed, and a Live badge. Filters: **This week** (a game live or in the next 7 days — the default), **Active** (not finalized), **Finished**, **All**; and a search over contest and workspace names. Row links: the contest → Games & Contests in that workspace; the next game → game day; the last game → its recap.

**Revised 2026-09-24.** A row now opens the contest page itself, `/contests/:contestId?tenant=<slug>`, which sets the console's acting tenant to that workspace before it reads, so the page, the sidebar and every link on it act as that tenant; its back link returns to All contests. The game-type column reads "Contest type". Each row carries **Finalize** under the same rule as the contest cards: shown only when the contest is published, not finalized, and every one of its games has ended (the test behind the `ready-to-finalize` attention row), and absent rather than disabled otherwise. It opens the same reverified, typed-name dialog as everywhere else ([`admin-contests.spec.md`](admin-contests.spec.md), "Finalize, wherever it appears"). The next-game and recap links are unchanged.

## `/schedule` — the season calendar

Every enabled game at every workspace, a month at a time, the pre-game check at planning horizon — the screen that makes Overboard look like an operation, and it front-runs multi-game (a calendar of games, not of bingo contests).

- **Month grid** (desktop) and **list** (a toggle; the only view on a narrow screen). Previous / next / today. A workspace filter.
- Each game shows tip-off, workspace and matchup, with a dot: **green** ready, **amber** attention, **red** blocked — for any game that has not ended, checked against today's configuration, however far out. A game that has ended is **grey** and shows its attributed outcome (fans in play, prizes delivered) instead.
- Clicking a game sets the tenant and opens game day on it; an ended game opens its recap.
- The same real game run by two workspaces is two entries, because it is two activations.

## Platform health, two touches

- **Live workspaces group and sort to the top** of the table.
- **Oldest unresolved report** — a tile beside the platform totals, from `GET /admin/support/summary`, rendered only when there is an unresolved report.

---

## Endpoints

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/obs-overview` | requireAdmin | obs staff only (403 otherwise); no `?tenant=` |
| GET | `/admin/all-contests` | requireAdmin | obs staff only; no `?tenant=` |
| GET | `/admin/schedule` | requireAdmin | obs staff only; `?from=&to=` required, ≤ `SCHEDULE_MAX_RANGE_DAYS` (62) apart, else 400 |

All three follow the cross-tenant read pattern (admin-obs-internal): structural refusal first, then batched reads — every count is answered by a fixed number of queries regardless of how many workspaces exist. Readiness, phases and game attribution come from the game-day helpers, never re-implemented.

## Rules

1. **Staff only, structurally.** Every endpoint refuses a non-staff caller with 403 before reading anything.
2. **The attention queue lists only what the platform can detect.** An undetectable condition has no row and no placeholder; it is recorded under Known gaps.
3. **Readiness, phase and attribution are the game-day helpers'.** These screens cannot disagree with `/live` or Overview about the same game.
4. **Activity names operators and subjects, never fans.**
5. **No All fans.** Not in this module, not later without re-arguing `RPT-05` and reverification scoping.

## Known gaps (recorded, not blocking)

- **Undetectable attention rows**: coupon exhaustion (no coupon model), error-rate spikes (no error-tracking substrate), missed export cadence (no delivery log).
- **Cross-tenant audit/exports view**, **tenant account view**, **config drift detection** — recorded follow-ups.
- **Readiness is checked against today's configuration.** A calendar dot for a game three weeks out answers "if it were today"; it cannot know about changes planned before then.
- **Activity actor names** depend on the admin sign-in being reachable; an unresolvable operator reads as their workspace ("Overboard staff").
- **Ended is inferred** for games the feed never marked final (tip-off + 6 h — see game day).

## References

- Vault concept: `cargo/passage-plans/2026-09-21-product-concepts.md` §2 (the OBS overview's four bands, the cross-tenant verdicts, the season calendar).
- Contracts: `obs-b2b-shared/src/api/admin/obs-workspace.ts`.
