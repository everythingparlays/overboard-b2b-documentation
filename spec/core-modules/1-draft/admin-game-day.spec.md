# Core Module Spec: Admin — Game Day

**Implements:** PRD `OBS-04` (the human half: is this tenant's activation healthy before and during a game), `OBS-05` (failures surfaced during the game), `PRIZE-07` (failed sends visible to the team whose game it is), `ADM-01`, `ADM-07`. Concept seed: vault `cargo/passage-plans/2026-09-21-product-concepts.md` §1a and Tier-1 idea 2.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, the `?tenant=` exception, and the **Honesty by omission** principle (Rule 13), which governs every string below. [`admin-overview.spec.md`](admin-overview.spec.md) — the screen this promotes. [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the one failure source (Rule 8) and finalization's home. [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — derived contest status and tier semantics.

**Status:** Draft — built on `arthur-ops` (2026-09-23).

## Overview

The console is a configuration tool shaped for a Tuesday. At 7:05pm on a Friday, with thousands of fans on boards and a sponsor's VP in the building, it is the wrong shape. Game day gives the live game the whole screen, and tells an operator — tenant or Overboard — whether the next game is ready before it starts.

**The whole change, in one line:** one pre-game readiness check computed server-side and carried by every read that shows a game; Overview promoted into a game-day surface when a game is live or about to be; and one new screen, `/live`, polled every ten seconds, that reconstructs the game from records the platform already keeps.

**In scope:** the readiness evaluator and its contract (`obs-b2b-shared/src/api/admin/readiness.ts`); four optional additions to the overview contract; `GET /admin/live` and `GET /admin/live/strip` (`live.ts`); the Overview promotion; the `/live` screen with the OBS multi-game strip.

**Not in scope (and why):**

- **A mode that redecorates every page.** Game day is one screen plus a promoted Overview. Fans, Exports, Fields & Opt-ins, Branding and Team are deliberately unchanged.
- **Games screen changes** (pin the live game's row, confirm before turning off a game mid-play) and **Prizes live counts.** Both are good, both are recorded in the concept, and both screens belong to the Games & Contests and Prizes overhauls running in the same wave. Recorded here as follow-ups for those owners.
- **A game clock or period.** The reference feed exposes lifecycle (`Scheduled` / `InProgress` / `Final`) and, sometimes, a score — never a reliable clock. The screen shows tip-off and elapsed time since tip-off; it never invents a quarter.
- **Per-tile rates** ("+47 in 5 min"). Arithmetic over `createdAt`, not new telemetry — a clean second pass, not in V1 of this screen.
- **Error rates / error-spike health.** `OBS-01`–`OBS-03` have no substrate (admin-obs-internal Known gaps). The health card shows what the platform records, and nothing in the place of what it does not.
- **Retry of a failed send.** The Prizes overhaul owns resend. Game day shows failures and the "Tell Overboard" path; it draws no retry control of its own.

---

## Activation: auto-enter, never auto-exit

Incident-mode semantics, not a screensaver.

- **Auto-enter.** Overview becomes the game-day surface on its own when a tenant has an enabled game the feed reports `InProgress`, and shows the pre-game state inside the **pre-game window** (`PREGAME_WINDOW_MINUTES = 90` before tip-off). `/live` opened with no game picks one the same way.
- **Never auto-exit.** Once `/live` is showing a game, the game is pinned in the URL (`/live?game=<id>`). It stays on that game through `Final` and after; the operator leaves when they choose to. A feed flipping status does not navigate anyone anywhere.
- **Manual override.** The reference feed must never be able to lock an operator out. `/live` carries a game picker listing the tenant's enabled games from two days back to a week ahead, and Overview's page head carries a **Game day** action whenever a game is within the readiness horizon — so an operator can open game day for a game the feed still calls `Scheduled`.

### Phases

The feed lags, so a game's phase is derived from the feed **and** the schedule (`LIVE_PHASES`):

| Phase | When |
|---|---|
| `upcoming` | Tip-off is more than 90 minutes away. |
| `pre-game` | Tip-off is within 90 minutes and the game has not started. |
| `in-play` | The feed says `InProgress`, **or** tip-off has passed less than `IN_PLAY_MAX_HOURS = 6` ago and the feed has not said `Final`. |
| `ended` | The feed says `Final`, **or** tip-off was 6 or more hours ago. |

The LIVE badge renders only when the feed says `InProgress`. A game `in-play` by schedule alone reads "Under way"; an `ended` game reads "Final" only when the feed says so, "Ended" otherwise. The screen never claims more certainty than its source.

---

## Pre-game readiness

`OBS-04` answered with data that exists. For a game, run seven checks against the **current** configuration of its contest and workspace:

| Check (`READINESS_CHECKS`) | Fails when | Level |
|---|---|---|
| `workspace-active` | The workspace is paused. | blocked |
| `contest-visible` | `showContest` is false — fans cannot see it. | blocked |
| `contest-open` | The contest is closed or finalized. | blocked |
| `prize-tiers` | No prize tier is attached — fans play for nothing. | blocked |
| `prize-delivery` | A tier has no delivery method (`handlerId` empty). `count` = how many. | blocked |
| `consent-text` | An opt-in fans are asked to accept has empty wording. `count` = how many. | blocked |
| `failed-sends` | Prizes from this contest are sitting failed. `count` = how many. | attention |

The level is the worst issue's (`blocked` → red, `attention` → amber, none → `ready`/green). Issues are listed worst first; `checked` lists every check that ran, in the order above, so a screen can render a full checklist with ticks.

**One evaluator, every screen.** Readiness is computed once, server-side (`node-server/src/util/admin-readiness.ts`), and carried on every read that shows a game: Overview's upcoming games (inside `READINESS_HORIZON_HOURS = 48`, null beyond), `/live`, and the OBS workspace reads ([`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md)). Screens phrase checks; they never re-derive them. Two screens disagreeing about whether Friday's game is ready is the failure this design exists to prevent.

**Delivery method, today and next.** `prize-delivery` checks that a method is set. The Prizes overhaul is building a delivery-method registry in the same wave; when it lands, this check tightens to "set **and** registered" — a one-line change in the evaluator, recorded as a follow-up. An unregistered method is exactly the failure the worker records as "No delivery method is set up", so the tightened check catches it before kickoff instead of at the first win.

---

## Overview, promoted

Three states, decided by the payload and the server clock:

1. **Live** (`liveNow` present). A full-width band leads the screen: the LIVE tag, the matchup, the contest, tip-off and elapsed time ("Started 7:05 PM · 1h 12m"), four real tiles — boards in play, bingos hit, prizes delivered, and **couldn't be delivered** (danger-toned, shown only when non-zero) — the freshness cue, and **Open game day**. Tiles are the contest-scoped counts `liveNow` already carries (see [`admin-overview.spec.md`](admin-overview.spec.md)); `/live` has the game-attributed ones. The KPI row and the 14-day tables sit below it.
2. **Pre-game** (the next upcoming game is inside the 90-minute window and nothing is live). The band shows a minute-resolution countdown ("Tip-off in 47 min"), the matchup and contest, and the readiness verdict inline — a green "Ready for tip-off", or the blocking issues named, each linking to where it is fixed.
3. **Otherwise.** No band. If a game is inside the 48-hour horizon, a **Next game** card in the side column shows its readiness checklist. Nothing renders for a workspace with no game in that window.

Overview still fetches once per mount; the band's freshness cue dates the numbers exactly as before. The live band polls nothing — `/live` is where polling lives.

---

## `/live` — the game-day view

Same screen for tenant users and Overboard staff (`ADM-01`). Read-only for everyone.

**Header strip.** Matchup, tip-off, elapsed or countdown, phase badge, score when the feed has one, contest, workspace. The game picker (manual override) and, after the game has started, **Game recap** — the document for the sponsor ([`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md)).

**Tiles.** Fans in play, bingos hit, prizes delivered, couldn't be delivered (danger when non-zero). Pending prizes and new fans ride as the tiles' secondary lines when non-zero.

**Left column — the live feed.** The four event kinds the platform can reconstruct: a fan joined, a board was created, a prize was delivered, a prize could not be delivered. Newest first, display names only, never a contact field. Polled every ~10 seconds (no socket infrastructure; ten seconds is the right grain for a human watching). New rows fade in; nothing else moves.

**Right column — operations.** (a) **Couldn't be delivered** — this game's failed sends: fan display name, prize, and the reason as a plain category (below), each with **Tell Overboard** and, once reported, the report's status chip ([`admin-support.spec.md`](admin-support.spec.md)). (b) **Prize tiers** — per tier: lines required, boards that have reached it, and delivered / pending / failed. (c) **Readiness** — the checklist, which during and after the game says whether anything is still wrong. (d) **Health** — when the last board was created, when the last prize was delivered, and the oldest prize still pending.

**Footer — the game's timeline.** Five-minute buckets from the start of the game window to now (or its end): boards created (bars), prizes delivered (bars), fans joined (line). The screenshot a team sends a sponsor.

**OBS additions.** Overboard staff also see the **multi-game strip** above the header — every workspace with a game `in-play` or `pre-game`, its fans in play and failed sends, each a link that switches the console to that workspace's game. It is the most valuable OBS-only element and the reason the screen scales past one customer. Finalization appears only as a link to its OBS surface, and only once the game has ended — never as a control here.

### Tenant admins see their own failed sends (decision)

Today failed sends are OBS-only (the Delivery queue) while Overview already tells tenant admins the count. **Decided: tenant users see their own game's failed rows** — display name and a plain-language reason, no retry control — while the cross-tenant queue stays OBS-only. The reputation argument behind `PRIZE-06` is about who *acts* on a failure, not who *knows* about it, and a team learning that a fan's prize bounced from the fan is the worst version. Staff additionally see the worker's raw reason; a tenant caller's payload carries `reason: null` and reads the category:

| `reasonKind` | Derived from the worker's `failureReason` | The tenant reads |
|---|---|---|
| `setup` | "No delivery method is set up…", "Contest not found…" | This prize isn't set up to send yet. |
| `address` | Mentions an email address, a recipient, a mailbox, or a rejected/bounced message | The fan's email couldn't accept it. |
| `other` | Anything else, and rows with no recorded reason | The send didn't go through. |

### Attribution — how a number is "this game's"

A board belongs to a contest, not to a game. **When the contest runs exactly one game, its boards are that game's** — exact, and the common case (UND runs one contest per game). **When it runs several, a board counts toward a game when any of its nine squares is one of that game's props** — the only honest link the data holds. Redemptions follow their board. "Fans in play" is distinct fans across those boards. "Fans joined" counts memberships created inside the **game window**: from the pre-game window's start (tip-off − 90 min) to the in-play limit (tip-off + 6 h), capped at now.

This is the rule for every game-attributed number the platform shows: `/live`, the OBS strip, the season calendar's outcomes, and the sponsor recap all use the same helper, so they cannot disagree.

---

## Endpoints

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/overview` | requireAdmin | unchanged; four optional fields added |
| GET | `/admin/live` | requireAdmin | tenant: own org; obs: `?tenant=`; optional `?game=` |
| GET | `/admin/live/strip` | requireAdmin | obs staff only (403 otherwise); cross-tenant, no `?tenant=` |

**`GET /admin/live` returns** `{ serverTime, tenant, game, games[], readiness, tiles, feed[], failures[], failuresTruncated, tiers[], timeline, health }` per `live.ts`. With no game to show, `game` is null and the rest is empty. A `?game=` naming a game that is not enabled on one of the tenant's contests is **404** — the standard probe answer; it neither confirms nor denies the game exists elsewhere. Game choice when `?game=` is absent: the game `in-play` (earliest tip-off wins), else the next game inside the pre-game window, else the next upcoming game, else the most recent game. The feed carries at most 40 items, failures at most 25 (`failuresTruncated` says when there are more).

**`GET /admin/live/strip` returns** `{ serverTime, games[] }` — every enabled game across every workspace whose phase is `pre-game` or `in-play`, with fans in play and failed sends.

**`GET /admin/overview` gains** `serverTime`, `liveNow.eventTime`, `upcomingGames[].feedStatus`, and `upcomingGames[].readiness` (null beyond 48 hours). All optional on the wire so a console talking to an older server still parses.

## Rules

1. **Readiness is computed once, server-side, by one evaluator.** No screen re-derives it.
2. **Every game-attributed number comes from the one attribution helper.** `/live`, the strip, the calendar and the recap cannot disagree.
3. **Auto-enter, never auto-exit.** A pinned game stays on screen through `Final`; nothing navigates an operator away.
4. **No invented clock, rate or score.** Tip-off and elapsed time only; the score only when the feed carries one.
5. **The LIVE tag means the feed said so.** A game under way by schedule alone is "Under way".
6. **Fans are named by display name only**, in the feed and the failure list. No contact field reaches `/live`.
7. **A tenant caller never receives the worker's raw failure text** — the payload carries `reason: null` and a category.
8. **Nothing on these screens narrates a gap** (admin-surface Rule 13). A tile with no honest number is absent; a missing control is simply not drawn.

## Known gaps (recorded, not blocking)

- **Games and Prizes live touches** (live row pinned with a badge; confirm before disabling a live game; delivery card live-counts) — owned by the Games & Contests and Prizes overhauls; not built here.
- **`prize-delivery` checks "set", not "registered"** until the Prizes overhaul's delivery-method registry lands.
- **Per-tile rates** — second pass; arithmetic over `createdAt`.
- **Attribution for multi-game contests depends on prop replication.** A board whose props are missing from `readonly_props` cannot be attributed to a game in a multi-game contest; it counts toward no game rather than a guessed one.
- **No end-of-game timestamp.** The feed records no end time, so "ended" is `Final` or tip-off + 6 h. A genuinely longer game (a long rain delay) would read "Ended" early.
- **Polling, not push.** Ten-second polling; a socket layer is not justified by one screen.
- **Game format on the live game.** The live payload does not carry the contest's `gameType`; the tile reads "Bingos hit" because bingo is the only format. When a second format ships, add `gameType` to `liveGameSchema` and word the tile by it.
- **`/live` re-reads every board of the contest on each poll.** Fine at today's volumes; the first thing to aggregate if one contest reaches tens of thousands of boards.
- **The strip has no contest id.** A game two contests of one workspace share shows once, with the contest `/live` would choose.

## References

- Vault concept: `cargo/passage-plans/2026-09-21-product-concepts.md` §1a, Tier-1 #2.
- PRD: [`OBS-04`, `OBS-05`, `PRIZE-06`, `PRIZE-07`, `ADM-01`, `ADM-07`](../../../documents/PRD/OBS_B2B_Platform_PRD.md).
- Contracts: `obs-b2b-shared/src/api/admin/{readiness,live,overview}.ts`.
