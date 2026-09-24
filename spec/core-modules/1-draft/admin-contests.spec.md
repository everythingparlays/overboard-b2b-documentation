# Core Module Spec: Admin — Contest lifecycle

**Implements:** PRD `ADM-04`, `GAME-01`, `GAME-04`, `BRAND-02`/`BRAND-04` (the "which games, which prizes" half), and the data-model constraint `GAME-F1`. Narrows `TEN-05` further: a contest is no longer onboarding-time setup.

**Depends on:** [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the `/games` screen, its read endpoint, the games PUT, tenant targeting, the `:contestId` 404 rule, the `expectedUpdatedAt` precondition. [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, the write grant (`org:tenant_config:manage`, held by tenant `org:admin` and OBS staff since 2026-09-16), Principles and Rule 13 (honesty by omission).

**Status:** Draft. Written 2026-09-23 for the Games & Contests overhaul.

## Overview

Until this spec, no path anywhere created a contest. The only writer was a developer fixture script; the games spec recorded "a contest is created at tenant onboarding, still a manual write" as the intent. That intent is obsolete: a tenant running a season needs a new contest per activation (a rivalry weekend, a sponsor's month, the playoffs), and every one of them would have been an engineer's database write. `ADM-04` says OBS staff "create and update" per-game configuration through the admin surface, "replacing direct database edits".

**The whole change, in one line:** a tenant's admins, and OBS on any tenant, create contests and manage their settings entirely in the console — and the settings they manage are the ones the fan app actually honours.

**In scope:**

- `POST /admin/contests` and `PATCH /admin/contests/:contestId`, their contracts in `obs-b2b-shared`, and two audit actions.
- The create drawer and the contest detail drawer on `/games`.
- Making every setting the console offers **real on the fan side**: visibility, closing, the player limit. Three of them were stored but honoured by nothing (see "Settings that were stored but not honoured").
- Recording the games a contest has run at (`ranAtBetEvents`), which closes the games spec's lookback gap.
- Participation read from the thing that measures it.
- **Game-type groundwork** for the second game (trivia, Minnesota Wild) — a discriminator on the contest and guards in the bingo-only code, nothing more.
- A refresh of the shared dev fixtures.

**Not in scope:**

- **Deleting a contest.** Boards, prize redemptions and audit rows reference a contest by id, and a redemption is the record that a fan won something (games spec Rule 6). A contest an operator is done with is **hidden and closed**, which removes it from fans and stops joins while keeping its history. A real delete is a teardown with the same shape as fan deletion and belongs with it, if it is ever needed.
- **Finalization.** Unchanged: OBS-only, permanent, in OBS Internal (games spec, "Where finalization lives"). Nothing here sets `finalized`, and a finalized contest refuses every edit.
- **Prize tiers.** Owned by `/prizes`. The contest detail drawer *shows* the contest's tiers and links there; it never edits them.
- **A second game.** Only the groundwork below.

---

## The settings, one by one

`B2BContest` carried seven fields no endpoint could set. Each gets a deliberate answer, and the rule for every one of them is the omission rule: the console offers a control only if the fan app honours what it sets.

| Field | Console control | Fan-side meaning | Notes |
|---|---|---|---|
| `contestName` | **Name** — required, trimmed, 1–80 characters, unique within the tenant (case-insensitive) | The title on the fan's contest card | Uniqueness matters beyond tidiness: finalization's typed confirmation names the contest, and two contests with one name make that confirmation ambiguous. A clash is a 409 with a field error on the name. |
| `contestDescription` | **Note** — optional, up to 500 characters | **None.** The fan app never renders it. | Offered as an operator's note on the contest ("Coca-Cola activation, weeks 3–6"), and labelled as visible only in the console. Labelling who can see a field is describing the control, not narrating a gap. |
| `showContest` | **Visibility** — *Listed* / *Hidden* | A hidden contest is not listed to fans, its player-picker page answers 404, and it cannot be joined | **New contests are created hidden.** A contest exists before its prize tiers do, and a listed contest with no tiers lets fans play for nothing — the games spec's "Incomplete" warning, avoided by construction rather than flagged after the fact. The create drawer lets the operator list it immediately when they mean to. Fans who already hold a board keep it: hiding stops discovery and joining, it never takes a fan's board away. |
| `closed` | **Entries** — *Close entries* / *Reopen entries* | Status reads Closed; no new boards | Reversible, and deliberately worded apart from finalization, which is not. Closing stops new fans joining; boards already in play keep scoring. |
| `maxParticipants` | **Player limit** — *No limit* or a number (1–1,000,000) | Joining is refused once the contest holds that many boards | `0` means no limit — the model already allowed it, and it is the create default. |
| `maxEntriesPerPerson` | **None** | — | The fan app holds exactly one board per fan per contest: board creation refuses a second, and every screen navigates a fan to *their* board. A setting above 1 would be a control that changes nothing. Left at the stored default (1). Multi-entry is fan-app work first. |
| `twoTeamsNotRequired` | **None** | — | A drafting rule inherited from the D2C app (a board must draw players from both teams). The B2B fan app never reads it, and board generation does not apply it. Left at the stored default (false). |

### Settings that were stored but not honoured

The investigation that preceded this spec found three of the fields above displayed by the console but enforced by nothing:

- **`showContest`**: `GET /b2b/contest/list-contests` returned hidden contests to fans. (`admin-surface.spec.md`'s reflect-point table already assumed "server-filtered"; the code now matches it.)
- **`closed`, and contest status generally**: the fan app only offers *Join* on an Open contest, but `POST /b2b/board/generate` checked nothing — a direct call could start a board on a closed, finalized or not-yet-open contest.
- **`maxParticipants`**: nothing counted against it.

And one number the console showed was never true: **`numberParticipants` is never incremented by anything**, so every contest read "0 of N entries". Participation is now the contest's **board count**, computed on read — one board per fan per contest makes that exactly the number of fans playing. The stored field is left in place and read by nothing: Games & Contests, All contests and the All tenants directory all count players from boards.

All three are now enforced at the two fan entry points, with fan-facing copy that states the situation and nothing else:

| Check (in order) | Fan-facing answer |
|---|---|
| Contest not in this tenant, or hidden | 404 "Contest not found" (a hidden contest is indistinguishable from none) |
| Contest is not a bingo contest | 409 "This contest can't be played here yet." — reachable only if a second game type exists server-side before its fan client does |
| Contest status is not Open (closed, finalized, no joinable game) | 409 "This contest isn't open for new players right now." |
| Board count ≥ a non-zero player limit | 409 "This contest is full." |

The one-board-per-fan 409 keeps its existing place *before* these checks, so a fan who already holds a board is still sent to it whatever state the contest is in.

**Deploy note (production).** Enforcing visibility, entries and the player limit is new behaviour on existing data: all three were stored and never enforced. Before merging to production, check every live contest for (a) `showContest: false` — it disappears from fans on deploy, (b) `closed: true` — it stops taking joins, and (c) a `maxParticipants` below its real board count — new joins stop. Fix the ones that were never meant that way (`showContest: true`, `closed: false`, `maxParticipants: 0` for no limit). The console now shows each of these states plainly, but they should not be found that way.

---

## Endpoints

Both under `/admin`, `requireAdmin`, targeting exactly as the games spec (a tenant caller's own org; OBS names `?tenant=`), both gated by `refuseReadOnlyWrite` — OBS staff or the tenant's own `org:admin`; `org:member` is view-only; a paused tenant's own admins are refused. Contracts in `obs-b2b-shared/src/api/admin/games.ts`. Neither is step-up gated: nothing here releases PII or is irreversible (the admin-surface line for reverification).

### `POST /admin/contests`

Body: `{ contestName, contestDescription?, betEventIds?, maxParticipants?, visible?, gameType? }`. Defaults: no games, no player limit, **hidden**, bingo.

- `betEventIds` follows the games PUT: distinct, every id must name a reference event, unknown ids are a 400 listing them.
- The name must not match another contest of the same tenant, ignoring case and surrounding space → 409 with `errors.contestName`.
- The new contest's `ranAtBetEvents` starts as its games.
- Audited as `contest_create` (contest id, game type, game count) **before** the response; the audit write is non-blocking for the contest itself — the contest exists either way, and a failed audit is logged.
- Responds **201** with the contest in exactly the `GET /admin/games` wire shape, so the screen can place it without a refetch.

### `PATCH /admin/contests/:contestId`

Body: any of `{ contestName, contestDescription, maxParticipants, visible, closed }`, plus the `expectedUpdatedAt` precondition shared with the games and tiers PUTs. Only present keys change; `contestDescription: null` or `""` clears the note. An empty edit is a 400.

- `:contestId` must belong to the target tenant → 404 otherwise (games spec Rule 1).
- **A finalized contest refuses every edit** → 409 "This contest is finalized, so its settings can't change." Finalization is permanent; editing the settings of a settled contest would rewrite what fans played under. "Not finalized" is part of the write filter itself, not only a check before it, so a finalization landing between the load and the write cannot be overwritten — even by a caller that sent no precondition. The games PUT gets the same guard: which games a settled contest ran at is part of what was settled, and the Games screen shows a finalized contest's games as state, with no toggles.
- Name uniqueness as for create, excluding the contest itself.
- Lowering the player limit below the current board count is allowed: nobody is removed, new joins simply stop. The console states the consequence before saving.
- The precondition and the write are one filter (`preconditionFilter`), so a stale edit is refused with the shared 409 `stale_contest` and changes nothing.
- Audited as `contest_update` with the changed setting names (and the new `closed`/`visible` booleans), never the free text.
- Responds with the contest and `changes.fields` — the settings whose stored value actually moved.

### Changes to existing endpoints

- **`GET /admin/games`** gains per contest `gameType`, `createdAt`, and `gamesRunCount`; per game row `ranAt` (the contest runs at it now or ran at it before — `false` for a row that is only on the schedule); and at the top level `schedule`: the candidate window on its own, attached to no contest — what the create and Add games pickers offer, since a tenant with no contests has no games list to borrow from. `numberParticipants` becomes the board count.
- **Every game a contest has ever run at stays on its table.** The read resolves `ranAtBetEventIds(contest)` (history ∪ live set) by id, the same way it resolves the enabled set, and offers the history as *Off* rows whatever their age. This retires the games spec's recorded gap — "a game disabled in an earlier session and older than the lookback cannot be offered again". The bounded candidate window and the PUT's echo of its disabled ids stay: the window is how *new* games are offered, and the echo still covers a contest stored before the history existed.
- **`PUT /admin/contests/:contestId/games`** adds `$addToSet: { ranAtBetEvents: { $each: betEventIds } }` in the same update that replaces `allowedBetEvents`. It never removes from the history.

---

## The screens

### `/games` — the head

A **New contest** primary action in the page head, for anyone who can write. A tenant with no contests gets an empty state whose one action is the same button; for a view-only member the empty state says only that there are no contests yet.

### Each contest's table — its own games, and Add games

**A contest's table lists only its own games**: the ones it runs at, and the ones it ran at and was turned off (`ranAt`), which stay so the toggle can undo the change. It no longer lists the whole candidate window under every contest — measured on the shared dev database, that repeated 65 schedule rows per contest and made a four-contest page about 49,000 pixels tall. The rest of the schedule is reached through **Add games** on the contest card (writers only, never on a finalized contest): the create drawer's picker — upcoming games only, grouped by day, searchable by team, narrowed by sport — minus the games the contest already runs at, saved through the games PUT with the contest's current set plus the chosen games and the usual precondition. A server that predates `ranAt` sends no flag, and every row stays, as before. A contest with no games of its own says "No games yet."; the page-level "Games scheduled in the next 30 days" caption is gone with the rows it described.

### The create drawer

One drawer, top to bottom in the order an operator thinks:

1. **Name.** Focused on open.
2. **Games** — the schedule, searchable by team, filterable by sport, grouped by day, each row a checkbox with the matchup and tip-off. Selected games are summarised above the list ("3 games · first Sat Sep 27"). Optional: a contest can be created empty and given games from its card.
3. **Player limit** — *No limit* / *Limit to* with a number.
4. **Visibility** — *Hidden* (default) / *Listed*, with one line saying what each means for fans.
5. **Note** — optional, labelled as console-only.

Validation answers beside the input (the server's field errors land in the same place, including the name clash). On success the drawer closes, the new contest's card appears at the top with the row-flash cue, and a single confirmation line names the next step: it is hidden until listed, and it has no prize tiers until they are added on Prizes (only the parts that are true are said). Its "Add its prize tiers" link opens Prizes on the new contest (below, "Links into Prizes").

### The contest detail drawer

Each contest card's header carries a **Settings** button (every role — members get the view-only presentation) opening the contest's own drawer. The per-game drawer opened from a row is unchanged.

- **Summary** — status badge, players (with the limit when there is one), games enabled, games run, created.
- **Settings** — name, note, player limit, visibility: one form, one Save, dirty-tracked, the precondition echoed. Lowering the limit below the current player count is stated inline before saving ("412 are already playing — nobody is removed; new fans can't join").
- **Entries** — *Close entries* / *Reopen entries* as its own immediate action, because it is an operational switch rather than an edit of the contest's description.
- **Prize tiers** — the contest's tiers, read from `GET /admin/prizes` (name, bingos to win, approximate value when stated), with a link to Prizes on this contest. None → the Incomplete line and the link.
- **Finalized** contests render the whole drawer read-only with a *Finalized* badge; nothing on it links to finalization (games spec).
- **View-only** (`org:member`) gets the same layout with static values in place of controls — the Fields & Opt-ins presentation, reused.

The per-game drawer's "In this contest" toggle and the table's toggles are unchanged.

### Links into Prizes

Every link from this screen to Prizes — the drawer's tier link and the create confirmation's "Add its prize tiers" — names the contest (`/prizes?contest=<id>`), and Prizes opens on that contest rather than on whichever contest it last showed ([`prize-delivery.spec.md`](prize-delivery.spec.md), "The Prizes screen").

---

## Game-type groundwork (for the second game)

`GAME-F1`: game type is not a tenant setting. The multi-game home the PRD anticipates is a tenant's games list — its contests — so the discriminator lives on the **contest**: `B2BContest.gameType`, enum `["bingo"]`, absent on every existing contest and read through `contestGameType()` as bingo. No second value exists yet and no screen offers a choice of one (a picker with a single option is a control that decides nothing). What this change does so the second game does not have to restructure anything:

- **New contests record their type** (`bingo`), and the create contract accepts `gameType`.
- **The bingo-only code checks it.** Board generation refuses a non-bingo contest rather than drawing a bingo board for it.
- **New console code reads game vocabulary from one place** — a per-game descriptor (`src/lib/gameTypes.ts`: display name, what a tier's threshold is called) — rather than writing "bingo" into copy. Today's descriptor has one entry.
- **New wire fields are game-neutral** (`gamesRunCount`, `schedule`, `gameType`) — nothing new is named for bingo.

**Deliberately left for the trivia build** (renaming live data is out of scope — the D2C app and existing tenants read it):

- Collection names `*_bingo_boards`, `*_bingo_prize_tiers`, `*_bingo_prize_redemptions`. A second game gets its own collections for its own entry records; the shared ones are not renamed.
- The board model's nine named cells and the evaluator's eight hard-coded lines — bingo's own shape; a second game has its own entry model and evaluator, dispatched on `gameType`.
- Prize tiers keyed on `threeInARows`. A tier's threshold is bingo's unit. The second game needs either a game-neutral threshold beside it (`threshold`, interpreted per `gameType`) or its own tier fields; the choice belongs with that game's scoring design.
- "bingos" in existing wire fields and CSV columns (`tierIndex` in the prize pipeline is really a bingo count). Existing contracts keep their names; new ones do not add to them.
- The fan app's contest card and board routes assume bingo. The fan-side games list (`GAME-F1`'s "shared homepage") is the second game's navigation work.
- The prize pipeline's `threeInARows` → tier match.

## The difficulty knob (`GAME-02`, `GAME-03`)

**Kept: `threeInARows` (bingos to win, 1–8) stays the V1 difficulty target.** `GAME-02` phrases the target as "approximate number of winners per game"; turning a winner count into a threshold needs a predictive model of how many boards reach N bingos for a given slate of games, and the inputs vary per game (sport, props offered, player mix). What is cheap and would move operators closer to the PRD's phrasing is a *read-out*, not a knob: "in this tenant's past games, X% of boards reached 2 bingos" beside the threshold on the tier editor, computed from settled boards. That belongs to the Prizes screen's tier editor and is recorded here as the next step, not built.

---

## Dev fixtures

The shared dev database (`obs-b2b-dev`, `arthur_` prefix) carried stale contests that caused two false bug reports: "Nick Test Contest" and a second "UND VS UNO" on the `test` tenant, pointing at a March game. `seed-test-tenant.mjs` refreshes them **additively and idempotently** — several builders share that database:

- The two stale contests are **renamed** by id (to "Archived test contest (March)" and "Archived test contest (early)"), and nothing else about them changes: their boards and tiers may be in use.
- A new fixture contest, **"Test Tenant — This Week"**, is upserted by name and re-pointed at the current window on every run: a few games that have just been played and the next several scheduled, chosen from the read-only schedule at run time (never written). It is listed, and its tiers are its own. Re-running moves it to the new current week; it never duplicates.
- "Test Tenant Bingo" (the demo contest many screenshots use, with 16 boards) is left exactly as it is.

## Rules

1. **The console offers a contest setting only if the fan side honours it.** `maxEntriesPerPerson` and `twoTeamsNotRequired` have no control for that reason.
2. **Contests are created hidden** unless the operator lists them in the same step.
3. **Visibility, entries and the player limit are enforced server-side** at both fan entry points; the fan app's own buttons are convenience.
4. **Participation is the board count**, never the stored `numberParticipants`.
5. **A finalized contest refuses every settings edit.** Nothing here finalizes.
6. **Contest names are unique within a tenant**, ignoring case.
7. **`ranAtBetEvents` only grows.** Every writer that adds to `allowedBetEvents` adds to it; nothing removes from it; readers go through `ranAtBetEventIds`.
8. **Game type is a contest property**, read through `contestGameType`; bingo-only code checks it.
9. **Contests are not deleted from the console** — hidden and closed instead.

## Known gaps (recorded, not blocking)

- **Multi-entry** (`maxEntriesPerPerson > 1`) needs fan-app support for several boards per contest before it can be offered.
- **The contest note is console-only.** If fans should see a contest description, the fan app needs a place for it, and the field's label changes with it.
- **The stored `numberParticipants` is dead data.** It is left in place, and since 2026-09-23 nothing reads it: the All tenants directory, its last reader, counts players from boards too.
- **No contest delete** — see Not in scope.
- **Difficulty read-out** from past boards — see "The difficulty knob".
- **Name uniqueness is check-then-write.** Two creates or renames to the same name in the same instant can both succeed. The fix, if it ever matters, is a normalized-name field with a unique `{organizationId, key}` index turning the duplicate into the same 409; at console volumes it has not been worth a model change.
- **Player-limit enforcement is count-then-insert**, not transactional: two fans joining in the same instant at the last free place can both get in. At V1 volumes and caps this overshoots by a board at most; an atomic slot counter is the fix if a sponsor ever needs a hard cap.

## References

- PRD: `ADM-04`, `GAME-01`–`GAME-04`, `GAME-F1`, `BRAND-02`, `BRAND-04`, `PRIZE-03`, `TEN-05`
- [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md), [`admin-surface.spec.md`](admin-surface.spec.md)
