# Webapp Spec: Fan Contest Flow — Build, Live Board, Prizes, Standings

**Implements:** PRD §1 fan flow (`PRD:30-36`: pick, board, tiles fill in live, three-in-a-row wins a tiered prize), `PRIZE-01` (the in-app half: the popup that accompanies delivery), `GAME-F1` (contest type on the contest). Arthur's 2026-09-24 walkthrough rulings on fan board customisation ("exactly as B2C fans can"), endless scroll, and the fan app overhaul.

**Depends on:** G2 (wave 2026-09-24): the unique index on `(contestId, clerkUserId)`, lock after the first fan joins, and the prize-tier snapshot on every award. G1: the endless-scroll list component and the backend cursor-paging convention. [`entry-gate.spec.md`](entry-gate.spec.md): blocking consents and required fields, unchanged. [`fan-app-v2.spec.md`](fan-app-v2.spec.md) (same wave) owns layout, the shell and the contest list; this spec owns behaviour, rules, data and copy for the contest flow. [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md): the kit pieces this flow places (Track, Burst, Medal, Brackets, BingoLine, Scorebug). [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md): the preview renders the board, prize and results screens from this spec. [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md): the progress marker image the Track carries. Build order: [`fan-app-v2-build-plan.md`](../../documents/HLDs/fan-app-v2-build-plan.md).

**Status:** Draft (design wave 2026-09-24). Code cited at backend `main` `780dfa5`, shared `9f14845`.

**Path shorthand used in citations:**

| Short | Path |
|---|---|
| `BE` | `overboard_sports_backend/node-server/src` |
| `LAM` | `overboard_sports_backend/lambdas` |
| `SH` | `obs-b2b-shared/src` |
| `FAN` | `overboard-b2b-template/src` |
| `APP` | B2C `overboard-b2c-workspace/appv1` |
| `B2C-API` | B2C `overboard-b2c-workspace/PbCdkMonoRepo/client_server` |

## Overview

Today a B2B fan drafts up to eight players from one game and the server builds a board for them. The fan never chooses a line, cannot change anything, sees the board refresh every two minutes, and has no standings or results.

**The whole change, in one line:** the fan builds their own 3x3 board square by square from the contest's games, exactly as a B2C fan does, then watches it fill in live, gets a prize popup the moment a tier is reached, and can see where they stand.

**In scope:**

- The contest detail page as the entry point (behaviour and CTA states only).
- The board builder: pick sheet, game chip bar, player list, line ladder, conflicts, the two-team rule, auto-fill, rearrange, enter, and editing after entry.
- Server validation for creating and editing a board.
- The API the flow needs, new and changed.
- The live board: square states, bingo lines, the celebration, the scorebug, the live connection and its fallback.
- The realtime publisher options.
- The prize popup and the award record that replaces today's localStorage trigger.
- Standings and results.
- Multi-game rules, and the Trivia placeholder.

**Not in scope:**

- Layout, the shell, the contests list and home ([`fan-app-v2.spec.md`](fan-app-v2.spec.md)).
- Brand, decor components and the preview route ([`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md), [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md), [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md)).
- Anything B2C fans cannot do (see "Does not exist in B2C, therefore not here").
- Prize delivery itself (email). This spec only reads its outcome.
- Line editing by admins, prop snapshots, multi-entry, the free square, grid size.

### Parity with B2C, verified

Every mechanic below was read in B2C code. Where B2B differs, the row says so and why.

| Mechanic | B2C evidence | Here |
|---|---|---|
| Square-by-square pick | Tapping a tile opens prop select for that tile; the chosen prop lands in `selectedTile` (`APP/app/app/board/propselect/index.tsx:100-103`). | Same. Tap a square, pick a line, it lands in that square. |
| Game chip bar | `APP/components/board/EventSelector.tsx:22-37` renders "All Props" only when more than one game is offered; `:38-61` one chip per game. The games offered are only those whose `eventTime` is still ahead (`APP/app/app/board/availableprops/index.tsx:37-43`). | Same rule. Our copy is "All". |
| Line ladder with difficulty labels | One row per stat (`propselect/index.tsx:255-262`), rungs sorted by multiplier ascending in a horizontal list (`:274-280`). Label from points = `100 * multiplier`: Likely `> 0 && <= 60`, 50% Chance `> 60 && <= 125`, Go Crazy `> 125` (`propselect/BetTile.tsx:19-36`; legend `index.tsx:233-247`). Points shown per rung as `Math.round(100 * multiplier)` (`BetTile.tsx:73`). | Same thresholds and order. Our labels: "Likely", "50-50", "Go crazy". |
| One line per player and stat, with replace | Conflict = same player and same `bettingBetType` (`APP/shared-deps/interfaces/Board.ts:76-85`). Tapping a conflicting rung asks "Conflicting Selection" with "Delete & Add", which clears the old square and puts the new line in the tapped square (`propselect/index.tsx:62-104`). | Same behaviour after a confirm. B2C matches the player by `displayName`; B2B matches by entity id, so two players who share a name never block each other. |
| Two-team rule | Client blocks entry and save with "Need at least one prop from a different team" (`APP/screens/boards/NewSingleBoard.tsx:483-489`, `:514-517`) and shows a warning banner at 7 or more single-team picks (`:580-583`, `:765-773`). Auto-fill forces the last pick onto another team (`Board.ts:207-211`). B2C's server check is switched off (`CHECK_FOR_MULTIPLE_TEAMS = false`, `B2C-API/app_client_function/src-ts/helper_functions/appBoardHelpers.ts:14`, used at `:156`, `:480`). The client honours a per-contest `twoTeamsNotRequired`; no B2C admin control sets it. | Always on, no toggle. B2B's copy of `twoTeamsNotRequired` (`SH/interfaces/b2b/B2BContest.ts:64`) stays ignored. The server enforces it too, because this spec has the server re-validate every rule. |
| Minimum two picks | "Enter Board" is disabled under 2 picks with "Please make two selections…" (`NewSingleBoard.tsx:563-568`, `:861-869`). A full board is not required. | Same. |
| Auto-fill | Enabled once one pick exists (`NewSingleBoard.tsx:839-853`; disabled message `:556-561`). Calls `createFilledBoard` with risk 1–100, no preferred teams, no star bias (`APP/slices/boardSlice.ts:492-504`): random non-conflicting props (`Board.ts:179-255`), then lowest multiplier into the safest slot in the order middleMiddle, topLeft, topRight, bottomRight, bottomLeft, middleLeft, middleRight, bottomMiddle, topMiddle (`Board.ts:13-14`, `:258-277`). The risk-slider modal exists but nothing opens it (`NewSingleBoard.tsx:686-688`). | Same algorithm, same slot order, no slider. B2B already carries a byte-identical copy (`BE/game/bingo/board.ts:13`, `:177`, `:256`). |
| Unlimited free changes until the square's game starts | Server: a square whose prop's game has started cannot change, and a prop from a started game cannot be added (`appBoardHelpers.ts:431-440`, `:442-468`). Client: a square is locked when its game's `eventTime` has passed or the prop is `locked` (`APP/shared-deps/interfaces/BettingProp.ts:103-112`). Editing is offered while the contest's last game has not started (`APP/shared-deps/interfaces/Contest.ts:122-145`; `NewSingleBoard.tsx:301-308`, `:801-815`). | Same. B2B shared carries the same lock helper (`SH/interfaces/reference/BettingProp.ts:104-114`). |
| Rearrange and delete | Long-press enters drag mode (`NewSingleBoard.tsx:793-799`), hint "Tap and Hold to Move or Delete Tiles" (`:752-756`), drag swaps two tiles, an x removes a tile, locked tiles do neither (`APP/screens/boards/DraggablePropTile.tsx:141-170`), "Done" leaves (`NewSingleBoard.tsx:825-833`). | Same, with a visible "Rearrange" button as well as long-press. |
| No duplicate prop | The update refuses the same prop twice (`appBoardHelpers.ts:373-375`, `:734-748`). | Same, on create and update. |
| Points | A hit square scores `multiplier * 100`; a completed line adds `calculateParlayBonus` (`APP/shared-deps/interfaces/score.ts:36-41`, used by `calculateScoreNew` from `:334`). B2C ranks with `calculateScoreNew` at finalization and competition ranking ("1224") in `addRankToBoards` (`B2C-API/main_client_function_two/src-ts/helper_functions/contestHelpers.ts:154-165`, `:231-258`). | Same formula, used as the tiebreak after bingos (see Standings). |

**Does not exist in B2C, therefore not here:** boosts, wildcards, power-ups, swap tokens or limited swaps, a free square, doublers, and unders (B2C never resolves an Under prop: the resolver carries a note that resulting for Unders was never added, `B2C-API/main_client_function/src-ts/helper_functions/bettingPropHelpers.ts:260`). No mock, string or endpoint may introduce any of them.

**B2B keeps or adds, plainly:**

- **The prize popup.** B2C fans have no in-app win popup, because B2C pays by rank at finalization. B2B prizes are tiers paid the moment a bingo count is reached, so the popup stays. It is a B2B feature, not a B2C one.
- **Line highlighting (the BingoLine overlay).** B2C shows scores, not lines. In B2B a completed line is the thing that wins, so drawing it is how the fan sees why they won.
- **Ranking by bingos first.** B2C ranks by points. B2B's win condition is bingo count, so bingos rank first and points only break ties (see Standings, FLOW-33).

---

## What changes from today

| Today | After this spec |
|---|---|
| "Draft Your Squad": up to 8 players from the first scheduled game only (`FAN/pages/contests/ContestPage.tsx:93-101`, tabs commented out `:201-220`) | The board builder, over every game in the contest that has not started |
| `POST /b2b/board/generate` with `playerIds`, server fills the board with two random fallbacks (`BE/handlers/board/createBoard.ts:62-181`, route `BE/routes/boards/index.ts:62-69`) | **Retired.** The route, `generateB2BBoard` and its fallbacks, and `generateB2BBoardRequestSchema` (`SH/api/b2b/board.ts:3-12`) are removed. `refuseJoin` (`createBoard.ts:38-56`) moves into `POST /b2b/board` unchanged. |
| The board's nine positions hold server-chosen props | The same nine positions (`SH/interfaces/b2b/B2BBoard.ts:12-20`) hold fan-chosen props, or `null` |
| 2-minute poll (`FAN/pages/board/BoardPage.tsx:157-164`) | A live stream with a 20-second poll fallback |
| The fan app recounts lines itself (`countParlaysHit`, `BoardPage.tsx:30-53`) | The server sends `lineHits[]` and `bingos` |
| Prize popup triggered from localStorage (`BoardPage.tsx:124-144`, `:249-273`) | Triggered by a server award record with `seenAt` |
| No standings, no results | Standings from the first tip-off; results after finalization |

**The win condition does not change.** A bingo is a row, column or diagonal of three Hit squares (8 lines, `LAM/board-evaluator/index.ts:62-71`). Tiers pay at 1 to 8 bingos, up to 3 tiers per contest. The evaluator, the prize queue and the prize worker are untouched except where noted under Standings (a persisted `points`).

---

## Contest detail (`/contest/:id`)

The detail page is the only way into the builder. Layout belongs to [`fan-app-v2.spec.md`](fan-app-v2.spec.md); the behaviour here is:

- **Status chyron** from the derived status (`SH/interfaces/b2b/B2BContest.ts:134-172`): OPEN, the Upcoming `stringStatus` in capitals ("OPENS IN 2 DAYS", from `:157-164`), CLOSED, FINAL (Finished). LIVE replaces OPEN or CLOSED while any of the contest's games has status `InProgress`.
- **Closes-at line.** One game: "Board changes close at tip-off, {Sun 10:00 AM}". Several games: "Each square locks when its game tips off. Last tip-off {Sun 10:00 AM}." Omitted once the last game has started. Times are the fan's local time; more than six days away they read "{Oct 4}, 10:00 AM".
- **Description** (`contestDescription`) as plain paragraphs split on blank lines. Omitted when empty. Never rendered as HTML or markdown.
- **Games** as scorebug rows (see "Scorebug").
- **Prize ladder** from the contest's tiers, lowest bingo count first: tier name, "{N} bingo" or "{N} bingos", image thumbnail when set, "Provided by {sponsor}" with logo when the tier names one.
- **How to play**, exactly: "Fill your 3x3 board with player lines." / "A line hits when the player reaches it." / "Three in a row is a bingo. Bingos win prizes."
- **Counts**: "{N} playing" always (board count); "· {M} spots left" only when the contest has a player limit.
- **Standings link** "See standings" once standings are visible (see Standings), or "Final standings" when Finished.

### CTA states (FLOW-01)

The primary button is decided by derived status, whether the fan holds a board on this contest, and contest type. The first matching row wins.

| Contest type | Fan has a board | Derived status | Primary button | Enabled | Goes to |
|---|---|---|---|---|---|
| Trivia | any | any | none; the Trivia card replaces the CTA area | — | — |
| Bingo | yes | any | "Open my board" | yes | `/board/:boardId` |
| Bingo | no | Open, spots left or no limit | "Build my board" | yes | `/contest/:id/build` |
| Bingo | no | Open, no spots left | "Full" | no | — |
| Bingo | no | Upcoming | the `stringStatus`, e.g. "Opens in 2 days" | no | — |
| Bingo | no | Closed | "Closed" | no | — |
| Bingo | no | Finished | "Closed" | no | — |

**Trivia card (FLOW-02).** When `gameType` is `trivia` (the enum at `B2BContest.ts:16` gains it in the console work), the page shows the banner, the description and, in place of the ladder, counts and CTA, one card: "Trivia is on its way. This contest opens when it's ready." No button, no link to a builder, no standings. `POST /b2b/board` refuses a Trivia contest (`NOT_PLAYABLE_HERE`, `createBoard.ts:42-44`).

**Refusals.** A button that was enabled can still be refused by the server (the contest closed or filled in the meantime). Refusals are shown by reason with the copy in "Error copy" below. A refusal because a board already exists navigates to that board.

---

## Board builder (`/contest/:id/build`, and edit mode on `/board/:id`)

### The draft

The builder holds a draft of nine cells in board order (topLeft, topMiddle, topRight, middleLeft, middleMiddle, middleRight, bottomLeft, bottomMiddle, bottomRight; `BE/game/bingo/board.ts:10`). Each cell is empty or one prop. Before entry the draft lives only in the browser: in memory, mirrored to `sessionStorage` keyed by contest id so a refresh does not lose it (wrapped in try/catch; a failed read starts empty). It is discarded once the board is entered. Nothing is written to the server until "Enter contest".

### Screen

- Header "BUILD YOUR BOARD" (edit mode: "EDIT YOUR BOARD") and a count chyron "{n} OF 9".
- The 3x3 grid. An empty square shows a dashed hairline and a plus. A filled square shows the player photo (only when the entity's `showPhotoUri` is true; otherwise initials), jersey badge, "{line}+ {STAT}" and the difficulty chyron.
- First visit only: a hint over the grid, "Tap a square to add a player line". Remembered in `localStorage` per device; dismissed by the first tap.
- Bottom bar: "Auto-fill", "Rearrange", and the primary "Enter contest" (edit mode: "Save changes"), with a helper line above it.

### Pick sheet (FLOW-03)

Tapping an empty square opens the pick sheet for that square. Tapping a filled, unlocked square opens the same sheet to replace it; the sheet shows "Replacing {line}+ {stat} · {Player}" under its title. A locked square does not open the sheet (see "Edit after entry").

The sheet is a bottom sheet, full height on phones, titled "PICK A PLAYER", with:

1. **Game chip bar.** One chip per contest game whose `eventTime` is still ahead, ordered by tip time: line 1 the game's `bettingEvent` ("Bulls @ Nets"), line 2 its day and time ("Sun 7:30 PM"). Games that have started are omitted, not disabled. An "All" chip with "{n} games" comes first **only when two or more games are offered** (parity: `EventSelector.tsx:22`). Default selection: "All" when shown, otherwise the one game. If no game is offered the sheet shows "Every game in this contest has started." and nothing else.
2. **Search field**, placeholder "Search players". Matches name, jersey number and team, server-side.
3. **Player list**, endless scroll (30 per page). Each card: photo or initials, jersey ("#23"), name, team, position, and an "ON BOARD" chyron when the player already has any line on the draft. Order: by team (away team first, then home), then depth chart order, then name.
   - Empty search: "No players match "{query}"."
   - No lines for the selected game: "No lines are up for this game yet. Check back closer to tip-off."

Tapping a player opens the ladder in the same sheet, with a back control "Players".

### Ladder (FLOW-04)

Header: player name, "{Team} · {Position}", and "{bettingEvent} · {Sun 7:30 PM}". A legend of the three difficulty chyrons sits under the header: "Likely", "50-50", "Go crazy".

One row per stat the player has lines for, titled with the prop's `bettingBetType` as stored ("Points", "Total Rebounds"). Each row is a horizontal ladder of rungs, one rung per prop, sorted by multiplier ascending. A rung shows:

- the line: the prop's `alternateValue` when set (`SH/interfaces/reference/BettingProp.ts:78-84`), otherwise "{value}+";
- the difficulty chyron from `points = 100 * multiplier`: **Likely** when `0 < points <= 60`, **50-50** when `60 < points <= 125`, **Go crazy** when `points > 125` (the B2C thresholds exactly, `BetTile.tsx:19-36`; a prop with `multiplier <= 0` shows no chyron);
- "+{points} pts" in the numeric face, `points` rounded, only while points are shown (open question 1).

Which props appear: `showProp` true, not `locked`, `outcomeType` not `Under`, an entity of type `PlayerEntity` (as `BE/handlers/contest/getB2BContestPlayers.ts:42`), and a game that has not started.

Tapping a rung:

- **The player has no line for this stat on the draft:** the rung goes into the square, the sheet closes, and the square scales in (160ms; none under reduced motion).
- **The player already has a line for this stat (FLOW-05):** a confirm, title "Replace your {stat} line for {player}?", body "{old line} comes off your board. {new line} goes in this square.", buttons "Replace" and "Cancel". Replace empties the old line's square and puts the new line in the tapped square (parity: `propselect/index.tsx:90-104`). If the old line is in a locked square, the confirm is not offered; instead: "Your {stat} line for {player} is locked, so it can't be replaced."
- **The rung is the line already on the draft:** it is marked "Your pick" and tapping it does nothing.

The stat row of a player+stat already on the draft carries an "ON BOARD" chyron (parity: "Already In Board", `propselect/index.tsx:264-268`).

### Conflicts and the two-team rule (FLOW-06, FLOW-07)

- **FLOW-06 One line per player and stat.** Two cells conflict when their props have the same entity id and the same `bettingBetType`. A draft never holds a conflict; the confirm above is the only way to swap one.
- **FLOW-07 Two teams.** Before entry or save, the filled cells must include players from at least two teams (`entityInfo.teamName`). No contest setting relaxes it.

### Minimum two, and the helper line (FLOW-08)

"Enter contest" is enabled only with 2 or more filled cells, players from two teams, and a request not already in flight. The helper line above it reads, first match wins:

| Draft | Helper | Button |
|---|---|---|
| 0 or 1 lines | "Add at least two lines" | disabled |
| 2 or more lines, one team | "Add a line from the other team" | disabled |
| 2 to 8 lines, two teams | "Empty squares can't hit" | enabled |
| 9 lines, two teams | none | enabled |

A disabled button explains itself on tap with its helper as a toast. Empty squares are allowed and can never hit.

### Auto-fill (FLOW-09)

- Disabled with 0 lines. Tapping it disabled shows "Add one line first, then Auto-fill can finish your board." Hidden when the draft is full.
- Enabled with 1 or more lines. It fills **only the empty squares** and never changes a filled one.
- The algorithm is B2C's `createFilledBoard`, unchanged, with `desiredRisk {min: 1, max: 100}`, `preferredTeams []`, `favorStarPlayers false` (parity: `boardSlice.ts:492-504`):
  1. From the eligible pool (every prop the ladder would offer, across **all** offered games regardless of the selected chip), drop any prop that conflicts with a line already on the draft.
  2. Pick props at random, one at a time, dropping new conflicts after each pick. When one square remains and the draft is still one team, only props from another team are eligible (`Board.ts:207-211`).
  3. Place the picked props lowest multiplier first into the empty squares in the safest-first order **middleMiddle, topLeft, topRight, bottomRight, bottomLeft, middleLeft, middleRight, bottomMiddle, topMiddle**, skipping filled squares (`Board.ts:13-14`, `:258-277`).
- It runs on the server (`POST /b2b/contest/:id/autofill`), because the pool is server-side and the function already exists there (`BE/game/bingo/board.ts:256`). The result is a suggestion placed into the draft, not a save.
- There is **no** extra fallback. Today's generate path fills leftovers twice more (`createBoard.ts:135-172`); B2C does not, so neither does this. If the pool runs out, squares stay empty and the fan sees "Auto-fill couldn't find lines for every square."
- Auto-fill can be tapped again; each tap fills whatever is empty at that moment.

### Rearrange (FLOW-10)

- "Rearrange" toggles rearrange mode; a long-press on any filled square also enters it. The bottom bar becomes a single "Done" button and the hint reads "Drag to swap squares. Tap x to remove a line."
- In rearrange mode squares jiggle at 2 degrees (none under reduced motion). Dragging a square onto another swaps the two, including onto an empty square. The x on a square empties it at once (no confirm; parity: `DraggablePropTile.tsx:162-168`).
- Locked squares do not jiggle, cannot be dragged, cannot be dropped onto, and show no x (parity: `DraggablePropTile.tsx:141`, `:152`).
- Keyboard: Enter or Space picks up the focused square, arrow keys move the target, Enter drops (swap), Escape cancels, Delete or Backspace empties the focused square. Each move is announced ("Moved to square 3").

### Enter, confirm, success (FLOW-11)

1. "Enter contest" opens a confirm sheet: title "Ready to play?", body "You're entering {contest} with {n} lines. You can change any square until its game starts.", buttons "Enter contest" and "Keep editing".
2. Confirm sends `POST /b2b/board`. The button shows a spinner and cannot be tapped twice.
3. Success: a full-screen moment, headline "You're in", body "Good luck. Your board is live." for 1.2 seconds (reduced motion: no animation, same text), then navigation to `/board/:id`. The draft is cleared.
4. Refusal: the sheet closes and the copy from "Error copy" shows. Cell-level refusals mark the affected squares and keep the rest of the draft.

Leaving the builder with at least one line: "Leave without entering?", body "Your picks won't be saved.", buttons "Leave" and "Keep building" (parity: B2C's discard prompt, `NewSingleBoard.tsx:91-97`).

### Edit after entry (FLOW-12)

- **Per-square lock.** A square is locked when its prop's game has started (`eventTime` in the past) or the prop is `locked` (the shared helper `bettingPropIsLocked`, `SH/interfaces/reference/BettingProp.ts:104-114`). Locked squares show a padlock and cannot be replaced, moved, swapped onto or removed. Tapping one: "This square is locked: the game has started." For a prop locked before its game: "This square is locked right now."
- **Whole-board window.** "Edit board" shows on the board page while the contest is not finalized, the last of the contest's games has not started, and at least one square is unlocked or empty. It disappears at the last game's tip-off.
- Edit mode is the builder on `/board/:id` with the header "EDIT YOUR BOARD", the same sheet, ladder, auto-fill and rearrange, and the primary "Save changes" (same helper rules as FLOW-08). Changes are unlimited and free.
- Save sends `PUT /b2b/board/:id/cells`. Success: toast "Board saved." and back to the live board. Leaving with unsaved changes: "Discard changes?", body "Your edits won't be saved.", buttons "Discard" and "Keep editing".
- If a square locks while the fan is editing (its game tips off), it becomes locked in place immediately; any unsaved change to it is reverted with "{Player}'s game has started, so that square is locked."

### Error copy (FLOW-13)

Every refusal carries a `code` beside today's `message`, so the client maps by code and never parses text. Contest-level strings are the existing fan-facing messages in `BE/util/messages.ts:121-135`.

| Code | HTTP | When | Fan sees |
|---|---|---|---|
| `board_exists` | 409 | A board already exists (body carries `boardId`) | Navigates to that board; toast "You already have a board in this contest." |
| `contest_not_found` | 404 | Missing, other tenant, or hidden | "Contest not found" |
| `contest_not_playable` | 409 | Not a bingo contest | "This contest can't be played here yet." |
| `contest_not_open` | 409 | Create while not Open | "This contest isn't open for new players right now." |
| `contest_full` | 409 | Player limit reached | "This contest is full." |
| `entry_outstanding` | 409 | Blocking consent or required field unmet (`BE/routes/boards/index.ts:26-37`) | Routes to the join gate (the gate spec's returning mode) |
| `edit_closed` | 409 | Update after the last game started, or on a finalized contest | "Board changes are closed for this contest." |
| `cell_locked` | 409 | A locked square changed | "{Player}'s game has started, so that square is locked." |
| `game_started` | 409 | A new line from a game that has started | "{Player}'s game has started. Pick another line." |
| `prop_unavailable` | 409 | A new line that is hidden, locked, an Under, or not from this contest's games | "That line isn't available anymore. Pick another." |
| `duplicate_prop` | 400 | The same prop twice | "That line is already on your board." |
| `line_conflict` | 400 | Two lines for one player and stat | "You already have a {stat} line for {player}." |
| `too_few_lines` | 400 | Fewer than 2 filled cells | "Add at least two lines" |
| `one_team` | 400 | All lines from one team | "Add a line from the other team" |
| `stale_board` | 409 | `expectedUpdatedAt` does not match | "Your board changed on another device. We've loaded the latest version." (the draft reloads from the server) |
| `tenant_suspended` | 403 | Tenant paused (`BE/middleware/tenant.ts:96-111`) | Navigates to the Paused screen |
| network / 5xx | — | — | "We couldn't reach the server. Check your connection and try again." |

Cell-level codes come back with `cellErrors: [{ position, code }]` so the builder can mark the squares.

---

## Server validation (FLOW-14 to FLOW-26)

The API enforces every rule below regardless of what the client did. Create is `POST /b2b/board`; update is `PUT /b2b/board/:id/cells`. Rules run in this order and the first failure answers.

- **FLOW-14 Tenant not suspended.** `resolveTenant` refuses first (`BE/middleware/tenant.ts:96-111`). Unchanged.
- **FLOW-15 Membership, consents and required fields complete.** The existing gate (`BE/routes/boards/index.ts:26-37`) runs on create **and** update.
- **FLOW-16 One board per fan per contest.** On create, an existing board answers 409 `board_exists` with its id, before any contest check, as today (`createBoard.ts:69-77`). The unique index on `(contestId, clerkUserId)` (G2) turns a double-tap race into the same 409 instead of a second board.
- **FLOW-17 Contest checks on create.** Found in this tenant and listed, bingo, Open, not full: `refuseJoin` exactly as today (`createBoard.ts:38-56`), with its known count-then-insert limit on the player limit (`:34-36`).
- **FLOW-18 Edit window on update.** The board is the caller's, in this tenant (404 otherwise, as `BE/handlers/board/getB2BBoard.ts:40-47`). The contest is not finalized and its latest game's `eventTime` is still ahead. Hidden and closed contests still accept edits from fans who hold a board: hiding and closing stop discovery and joining, never play (`admin-contests.spec.md`, the `showContest` and `closed` rows).
- **FLOW-19 Shape.** Exactly nine cells in board order, each a valid prop id or `null`.
- **FLOW-20 A new line is eligible.** Every prop that is on the submitted board but not already on the stored board (on create, every prop) must: belong to one of the contest's `allowedBetEvents`, have `showProp: true`, not be `locked`, not have `outcomeType: "Under"`, belong to a `PlayerEntity`, and come from a game whose `eventTime` is still ahead.
- **FLOW-21 Locked squares do not change.** On update, for each position whose stored prop is locked (its game's `eventTime` has passed, or the prop is `locked`), the submitted cell must be the same prop id. A stored prop that is not locked may move to another position or be removed, even if it has since been hidden.
- **FLOW-22 No duplicate prop.** No prop id appears twice (parity: `appBoardHelpers.ts:734-748`).
- **FLOW-23 One line per player and stat.** No two cells share entity id and `bettingBetType`.
- **FLOW-24 At least two lines.** At least two cells are non-null, on create and after every update.
- **FLOW-25 Two teams.** The non-null cells include players from at least two `teamName`s.
- **FLOW-26 Freshness on update.** The request carries `expectedUpdatedAt`; a mismatch is 409 `stale_board` (the house precondition pattern).

**Why FLOW-21 also protects prizes.** The evaluator claims lines by index (`claimedLineIndices`, `LAM/board-evaluator/index.ts:127-168`). A claimed line is three Hit squares, and a Hit square's game has started, so it is locked and can never move. Editing therefore cannot disturb a claimed line or re-trigger a prize.

---

## API

All routes are fan routes: `auth: "requireMembership"` as today, the tenant from `?tenant=<slug>` on every call including the stream, and 404 rather than 403 for anything in another tenant.

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| GET | `/b2b/contest/list-contests` | `?tenant&cursor&limit&q&status[]` (`status` values `open`, `upcoming`, `live`, `past`) | `{ contests[], nextCursor, total }`; each contest also carries `playerCount`, `spotsLeft` (null when no limit), `myBoardId` (null when none) | CHANGED: today it loads every contest and filters in memory (`BE/handlers/contest/listB2BContests.ts:18-36`); cursor paging per G1's convention |
| GET | `/b2b/contest/:contestId` | `?tenant` | `{ contest: { _id, contestName, contestDescription, gameType, contestStatus, games[], prizeTiers[], playerCount, spotsLeft, myBoardId, standingsVisible } }` | CHANGED: gains `prizeTiers`, `contestStatus`, `gameType`, counts, `myBoardId`; `contestDescription` is already sent (`getB2BContestPlayers.ts:71`). The per-game player lists (`:28-64`) move to the props route. |
| GET | `/b2b/contest/:contestId/props` | `?tenant&betEventId&q&cursor&limit` (no `betEventId` = all offered games) | `{ games[], players: [{ entityId, displayName, jerseyNumber, position, teamName, photoUri, betEventId, stats: [{ betType, rungs: [{ propId, line, value, multiplier, points, difficulty }] }] }], nextCursor, total }` | NEW |
| POST | `/b2b/contest/:contestId/autofill` | `{ cells: (propId \| null)[9] }` | `{ cells: (Prop \| null)[9] }`, props populated with entity and game | NEW; saves nothing |
| POST | `/b2b/board` | `{ contestId, cells: (propId \| null)[9] }` | 201 `{ success, boardId }`; refusals per FLOW-13 | NEW; replaces `POST /b2b/board/generate` |
| PUT | `/b2b/board/:boardId/cells` | `{ cells: (propId \| null)[9], expectedUpdatedAt }` | 200 `{ success, board }` (the GET shape) | NEW |
| GET | `/b2b/board/:boardId` | `?tenant` | today's board (`getB2BBoard.ts:32-49`) plus `bingos`, `points`, `lineHits: boolean[8]`, `cellMeta: { [position]: { locked, gameStatus, state } }`, `awards[]`, `editable`, `editClosesAt` | CHANGED |
| GET | `/b2b/board/:boardId/stream` | `?tenant`; headers `Authorization`, optional `Last-Event-ID` | `text/event-stream` (see "Live connection") | NEW |
| POST | `/b2b/board/:boardId/awards/:awardId/seen` | none | 200 `{ seenAt }`; idempotent | NEW |
| GET | `/b2b/contest/:contestId/standings` | `?tenant&cursor&limit` (limit default 50, max 100; `limit=0` returns only `me` and `total`) | `{ state: "hidden" \| "live" \| "final", total, rows: [{ rank, displayName, bingos, points, cells, isMe }], me, nextCursor }` | NEW |
| POST | `/b2b/board/generate` | — | — | RETIRED |

Details:

- **`prizeTiers[]` on the fan wire** carries only `{ _id, prizeName, prizeDescription, prizeImageUrl, threeInARows, providedBy: { name, logoUrl, websiteUrl } | null }`. Never `staticRedemptionCode` (`select:false`, `SH/interfaces/b2b/B2BPrizeTiers.ts:70-82`), never value or redemption fields.
- **`games[]`** is `allowedBetEvents` with `{ _id, bettingEvent, awayTeam, homeTeam, awayTeamLogo, homeTeamLogo, eventTime, status, sport, score }`, where `score` is present only when the event's `scoreAvailable` is true and `eventDetails` is set (`SH/interfaces/reference/BetEvent.ts:33`, `:49`, `:58-66`).
- **`difficulty`** is `"likely" | "fifty" | "crazy" | null` from the FLOW-04 thresholds, computed once in a shared helper so the ladder, the square and any preview agree.
- **`cells` in standings rows** is nine entries in board order, each `"hit" | "miss" | "open" | "empty"`. Other fans' props are never sent: a rival sees where you hit, not what you picked.
- **`awards[]`** is the award record under "Prize popup".
- **`cellMeta[].state`** comes from the shared `squareState` function (see "Square states"), so the server and the client agree on every square.

---

## Live board (`/board/:id`)

### Layout order

1. Header: contest name, the connection dot, menu.
2. Scorebug rail: one scorebug per contest game (see "Multi-game").
3. Counter: the bingo count (numeral or ring per theme) with "BINGOS", then the Track (0 to 8, tier stops, the marker at the current count). When points are shown, "{1,240} PTS" sits under the counter in the numeric face.
4. The grid.
5. The sponsor board banner (board placement), below the grid. This moves it from today's spot above the grid (`BoardPage.tsx:589-595`). Resolution is unchanged: `useSponsorSlots` with the board's single game, or contest-wide when the board spans several games (`BoardPage.tsx:106-119`, `:213-225`). An edit that turns a one-game board into a multi-game board switches it to the contest-wide holder.
6. The standings row: "Standings: you're {12th} of {340}" ("Standings: you're tied {1st} of {340}" when the rank is shared, FLOW-33) linking to standings; before standings are visible, "Standings appear at tip-off" as plain text.
7. "Edit board" when FLOW-12 allows it.

### Squares

Each filled square shows the player photo on a ground scrim, the jersey badge, "{line}+ {STAT}", and, for `Over` props, the live fraction "{progressValue} / {line}+" with a progress bar at `min(progressValue / value, 1)`. `Manual` props show no fraction or bar.

### Square states (FLOW-27)

One shared pure function, `squareState(prop, game, now)`, in `obs-b2b-shared` next to `B2BBoard.ts`. First match wins:

| State | Condition (fields on the Prop and its BetEvent) | Shows |
|---|---|---|
| `empty` | the cell is `null` | dashed hairline, "Empty" |
| `hit` | `consensusOutcome === "Hit"` | Team glow, check puck, "HIT" eyebrow |
| `miss` | `consensusOutcome === "Miss"` and `isFinal` | dimmed to 60%, strike through the line, "MISSED" eyebrow |
| `miss` (void) | `consensusOutcome === "Void"` and `isFinal` | the miss treatment with the eyebrow "VOID" |
| `live` | game `status === "InProgress"` | Accent brackets, bar animates on change |
| `locked` | prop `locked`, or `eventTime` has passed while the game is not `InProgress` (feed not yet live, or game Final and the prop not yet resulted) | padlock, fraction if progress exists |
| `pending` | otherwise (game `Scheduled`, `eventTime` ahead) | hairline, tip time "7:30 PM" |

A `Miss` that is not yet `isFinal` is treated by game status (live or locked), never shown as missed. `locked` here is a display state; editability is FLOW-12, which also locks `live`, `hit` and `miss` squares.

### Bingo lines (FLOW-28)

- The 8 lines are the evaluator's, in its order: rows top, middle, bottom; columns left, middle, right; diagonal topLeft to bottomRight; diagonal bottomLeft to topRight (`LAM/board-evaluator/index.ts:62-71`). `lineHits[i]` is true when all three squares of line `i` are `hit`. `bingos` is the evaluator's `parlaysHit`.
- Every true line draws the BingoLine overlay: a Team stroke, 6px, rounded caps, glow, through the three squares' centres. Lines already complete when the page loads draw static.
- **The celebration is state-driven and runs once per transition observed on this page:** when `lineHits[i]` goes false to true, the stroke draws in over 500ms, its three squares flash Accent for 1 second, and the counter bumps (scale 1.0 to 1.15 and back, 300ms). The Track marker glides to the new count. Nothing loops. Under reduced motion the line appears static and nothing flashes or bumps.
- A square that just turned `hit` gets Accent brackets for 2 seconds.
- Announcements (polite live region): a hit "{M. Caldwell} hit {20+ points}."; a bingo "Bingo! {2} of 8".

### Scorebug (FLOW-29)

One per game. LIVE chyron when `InProgress`, the matchup in condensed capitals, and a tracked mono detail line. **No score is ever invented.** The detail line is:

- `Scheduled`: "TIP {7:30 PM}" (with the day when not today: "SUN · TIP 7:30 PM").
- `InProgress` with `score` present: "{AWAY} {98} · {HOME} {101} · {Q4} · {2:13}". Period prefix by sport: "Q" for basketball and football, "P" for hockey; other sports omit the period.
- `InProgress` without `score`: "LIVE".
- `Final`: "FINAL", with the score in front only when `score` is present.

Whether the replicated events carry `eventDetails` for B2B's games is open question 2. The rule stands either way: show the score when the data has it, otherwise show status and time.

### Live connection (FLOW-30)

**Stream.** `GET /b2b/board/:boardId/stream?tenant=<slug>`, `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, and response compression disabled for this route. The browser's `EventSource` cannot send the bearer token the fan app uses (`FAN/store/index.ts:16-22`), so the client reads the stream with `fetch` and a streaming body reader, with a fresh Clerk token on every connect.

Each event has `id: <seq>` (a per-board increasing number), a name and a JSON `data` line. Payloads carry **absolute current values for the fields that changed**, so replaying an event twice is harmless.

| Event | `data` |
|---|---|
| `prop.progress` | `{ position, propId, progressValue }` |
| `prop.outcome` | `{ position, propId, consensusOutcome, isFinal, progressValue }` |
| `board.bingos` | `{ bingos, points, lineHits: boolean[8] }` |
| `game.status` | `{ betEventId, status, score? }` |
| `prize.awarded` | `{ award }` (the award record) |
| `contest.status` | `{ status, stringStatus, finalized }` |

- **Heartbeat:** a comment line `: hb` every 25 seconds. The API runs behind an ALB whose idle timeout is the 60-second default (none is set in `overboard_sports_backend/lib/constructs/main-api-service.ts:142`), so 25 seconds keeps the connection open with room to spare.
- **Resume:** the server keeps each board's last 100 events for 10 minutes. A reconnect sends `Last-Event-ID`; the server replays everything after it that it still has. Independently, **every reconnect first refetches `GET /b2b/board/:id`**, so a gap longer than the buffer still ends in the right state.
- **Re-auth:** the server closes each stream after 15 minutes; the client reconnects at once with a fresh token (not counted as a failure). A 401 on connect refreshes the token and retries once immediately.
- **Backoff:** on error or close, reconnect after 1s, 2s, 4s, 8s, 16s, then every 30s, each with up to 20% jitter. A successful connect resets it.
- **Poll fallback:** after 3 consecutive failed connects, or when no bytes (not even a heartbeat) arrive for 45 seconds, the client polls `GET /b2b/board/:id` every 20 seconds while it keeps retrying the stream on the backoff schedule. The first successful stream connect stops the poll.
- **Hidden tab:** 60 seconds after the page is hidden the client closes the stream and stops polling; on becoming visible it refetches and reconnects.
- **Connection dot:** green while the stream is connected or the last poll succeeded within 45 seconds; grey otherwise. After 60 seconds with neither, a quiet "Reconnecting" chip appears next to it and goes away on the next success. There is no other narration of connection state.
- **Offline:** when `navigator.onLine` is false, the shell's offline banner shows ("You're offline. We'll catch up when you're back.") and reconnect attempts wait for the `online` event.
- **403 `tenant_suspended`** on connect, on a refetch or on any poll: close the stream, stop polling and retries, and navigate to the Paused screen.
- **404 on the board:** the shell's error pattern with "We couldn't load this board." and a "Back to home" button.

### Realtime publisher: options (for the build slice)

Something has to notice that a prop, a game or a board changed and write it to the right open streams. Two honest options, no websockets in either:

- **(A) Push.** The component that sees a change publishes it to a channel (Redis pub/sub or similar) that every API task subscribes to; each task forwards the message to the streams it holds for affected boards. Cheapest per event and the fastest. Limit: B2B only sees hits directly (the prop-update evaluator consumes the prop-hit queue, `LAM/prop-update-evaluator/index.ts:62-103`). Progress, game status and outcome changes land in the replicated read-only collections without passing through anything B2B runs, so option A needs a publisher on those collections too (for example a change stream), not just the evaluator.
- **(B) Scan.** Every 15 seconds each API task reads, for the boards it has open streams for, their nine props (projected to `progressValue`, `consensusOutcome`, `isFinal`, `locked`), their games (`status`, `eventDetails`), the boards (`parlaysHit`, `points`, `claimedLineIndices`), new award rows and contest status, compares with what it last sent, and emits only the differences. A handful of `$in` queries per task per tick, independent of the number of fans watching the same board.

**Recommendation.** No channel exists in the stack today: no Redis or ElastiCache anywhere in `overboard_sports_backend/lib`, and the SQS queues are point-to-point. So **B**, unless the build slice adds a channel for other reasons, in which case A for hits and awards with B kept for progress. The choice is the build slice's. Either way, worst-case latency is about 15 seconds on the stream and 20 seconds on the poll fallback, against 2 minutes today.

---

## Prize popup (FLOW-31)

### The award record

An award is a prize-redemption row whose bingo count matched a tier (status `pending`, `fulfilled` or `failed`; `skipped` rows are not awards, `SH/models/prize-redemption.ts:74`). The fan wire shape:

```ts
interface FanAward {
  awardId: string;            // the redemption row's _id
  tierIndex: number;          // the tier's position in the contest's ladder at award time, 0-based ("TIER {tierIndex+1}")
  bingos: number;             // the tier's bingo count (threeInARows)
  prizeSnapshot: {            // G2's tier snapshot, taken at award time
    name: string;
    description?: string;
    imageUrl?: string;
    claimInstructions?: string;
    claimButtonText?: string;
    claimLink?: string;
    providedBy?: { name: string; logoUrl?: string; websiteUrl?: string };
  };
  emailStatus: "sent" | "failed" | "pending";   // fulfilled -> sent, failed -> failed, pending -> pending
  awardedAt: string;
  seenAt: string | null;
}
```

`tierIndex` here is not the redemption row's own `tierIndex`, which is a zero-based bingo count (`prize-redemption.ts:6-7`). The snapshot is the source for everything the popup shows; the live tier is never read for an award, so an admin edit after the win cannot change what the fan sees. `staticRedemptionCode` is never part of the snapshot on the fan wire.

### Trigger

- The `prize.awarded` event while the board is open.
- On load (and on every refetch), any award in `board.awards[]` with `seenAt: null`.
- Several unseen awards show one after another, lowest tier first.

### Content

- Burst behind a 160px prize image, or a trophy glyph when there is no image.
- Chyron "TIER {2} · {3} BINGOS" ("1 BINGO" singular).
- Headline: the prize name.
- The description, **once**, as body text. (Today it appears as the headline with "!" appended and again in tier info, `FAN/components/board/PrizeModal.tsx:139`, `BoardPage.tsx:573`; that duplication ends.)
- Claim instructions when set.
- "Provided by" with the sponsor's logo when the snapshot names one (the logo links to `websiteUrl` when set).
- The email line, **only when `emailStatus` is `sent`**: "We've emailed the details to {email}", using the account's email. When pending or failed, nothing is said about email.
- Buttons: when the snapshot has a claim link, the primary is the claim button text (default "Got it") and opens the link in a new tab, and the secondary is "Close". When there is no link, a single "Got it" closes the popup.
- Confetti in Team, Second and Accent; a full-screen Team flash only when the theme's glow is 0.5 or more; nothing moves under reduced motion.

### Marking seen

Closing the popup by any button, Escape or the backdrop calls `POST /b2b/board/:id/awards/:awardId/seen` and moves to the next unseen award. If the call fails, the popup does not reappear in this session (kept in memory) and the call is retried on the next load. The server sets `seenAt` once and never clears it.

### Migration from localStorage (FLOW-32)

- The fan app's localStorage trigger and its dev helpers are removed (`BoardPage.tsx:124-144`, `:249-273`, `:275-317`).
- `seenAt` is added to the redemption row. On deploy, a one-off backfill sets `seenAt` to the deploy time on every existing award row, because those tiers were already reached and, on the device that saw them, already celebrated. No fan sees a second popup for an old win.
- Rows written before G2's snapshot exist carry no snapshot. They are all backfilled as seen, so the popup never needs them; the results card shows their prize name from the snapshot when present and omits the row's detail otherwise.

---

## Standings and results (`/contest/:id/standings`)

### Ranking (FLOW-33)

Every board on the contest is ranked, one per fan:

1. **Bingos**, most first (the evaluator's `parlaysHit`).
2. **Points**, most first.

Boards equal on both share a rank, and the next rank skips ("1224", as B2C's `addRankToBoards`, `contestHelpers.ts:244-256`). Rank is `1 + the number of boards strictly ahead`. Entry time is never a rank criterion: within a group of tied boards it only orders the rows on screen, earliest board `createdAt` first (editing a board never changes it).

A shared rank reads "Tied {1st}" wherever the fan's own rank is written as words (the board's standings row, the "Your result" card). So at tip-off, before any square hits, every board is 0 bingos and 0 points and every fan reads "Tied 1st of {N}".

### Points (FLOW-34)

The B2C formula, as `calculateScoreNew` computes current score (`APP/shared-deps/interfaces/score.ts:334` onward):

- each `hit` square scores `multiplier * 100`;
- each completed line adds `calculateParlayBonus(m1, m2, m3)`, quoted exactly from `score.ts:36-41`:

```ts
const calculateParlayBonus = (multiplierOne: number, multiplierTwo: number, multiplierThree: number): number => {
  if (multiplierOne && multiplierTwo && multiplierThree) {
    return (((multiplierOne + 1 ) * (multiplierTwo + 1 )* (multiplierThree + 1 )) -1) * 100;
  }
  return 0;
}
```

That includes B2C's quirk: a line with any multiplier of 0 adds no bonus. Empty squares score nothing and complete no line. Points are rounded to whole numbers for display only.

**Where points are computed.** The board evaluator already reads the board with its props linearizably when a prop hits (`LAM/board-evaluator/index.ts:61-171`). It also writes `points` beside `parlaysHit`, and `PUT /b2b/board/:id/cells` recomputes it on save. Points only change when a square hits, so this keeps them current without recomputing on read. Standings read the persisted fields through an index on `{ contestId: 1, parlaysHit: -1, points: -1, createdAt: 1 }`.

### When standings are visible (FLOW-35)

From the moment the contest's first game starts (earliest `eventTime` in the past) until forever after. Before that, the standings route answers `state: "hidden"`, the page shows "Standings appear at tip-off", and the board's standings row says the same without a link.

`state` is `final` once the contest is finalized, otherwise `live`.

### The page (FLOW-36)

- Header chyron LIVE while any game is `InProgress`, FINAL once finalized, otherwise none.
- "{340} playing" total.
- Rows: rank (Medal for 1 to 3, numeral tile after; tied rows show the same rank), display name (the fan's public name on standings; the join gate's display-name field says so), bingos as the big numeral, points small (when shown), and a mini 3x3 with `hit` squares Team-filled, `miss` squares struck, others outlined. The fan's own row shows "You" and a Team hairline.
- Endless scroll, 50 rows a page, no "load more" button. The list may widen to 640px.
- **`me` pinning:** when the fan's row is not on screen, it is pinned to the bottom of the viewport; tapping it scrolls to their place (loading pages as needed). A fan with no board sees no pinned row.
- Standings refresh every 30 seconds while visible and on `board.bingos` events from the fan's own stream. Rows do not reorder under the fan's finger: a refresh that would move rows while the list is being touched waits until the touch ends.

### Final state and results (FLOW-37)

When the contest is finalized:

- "Final standings" heading and a podium for the top three (Burst behind first, Medals). Fewer than three boards shows only those present.
- A "Your result" card above the list, for a fan with a board:
  - "{12th} of {340}", or "Tied {12th} of {340}" when the rank is shared.
  - Tier reached: "TIER {2} · {3} BINGOS" and the prize name, from the highest award. With no award: "You finished with {n} bingos." ("1 bingo" singular).
  - Each award as a row: prize name, "Provided by {sponsor}" when set, and "Details emailed" only when `emailStatus` is `sent`. Tapping a row reopens the popup content without confetti.
  - "Back to home".

---

## Multi-game specifics (FLOW-38)

- **Contest status** is derived, never stored (`B2BContest.ts:134-172`): Finished if finalized; else Closed if `closed` or there are no games; else Open if any game is Joinable (from 48 hours before its tip-off, or its `nextPropOpenTime`, until tip-off; `B2BContest.ts:109`, `SH/interfaces/reference/BetEvent.ts:107-127`); else Upcoming if any game opens later; else Closed. A contest whose first game is live and whose second is tomorrow is Open, and a new fan can join it with lines from the second game only.
- **Chip bar:** only games not yet started, ordered by tip time, "All" only when two or more are offered.
- **Per-square lock:** each square locks at its own game's tip-off. A board can be part live, part editable.
- **Whole-board edit window:** closes at the last game's tip-off.
- **Scorebug rail ordering:** games `InProgress` first, then all others by tip time ascending. With several games the rail scrolls horizontally, the first live one in view.
- **Sponsors:** see the live board layout, item 5.

---

## Accessibility (FLOW-39)

- Text contrast 4.5:1 everywhere, including chyron text on its block; decor never sits behind body text above 0.12 alpha.
- The grid is a `grid` role, 3x3; each square is a button labelled "Square {5}: {M. Caldwell}, {20+ points}, {state}", where state is "not started", "live, {7} of {20}", "hit", "missed", "void", "locked" or "empty". Colour is never the only signal: hits carry a check puck, misses a strike and a word.
- The pick sheet is a modal dialog: focus moves into it, stays trapped, Escape closes it, and focus returns to the square that opened it. Chips are a radio group; rungs are buttons labelled "{20+} {points}, {50-50}, {+110 pts}".
- Rearrange has the full keyboard path in FLOW-10.
- Live updates go to one polite live region; bingos and hits are announced, connection state is not.
- The popup is a modal dialog labelled by the prize name.
- Every tap target is at least 44px. Focus rings use `--glow-ring`.
- Reduced motion turns off the square scale-in, jiggle, line draw-in, flash, counter bump, Burst, confetti and the success animation. Content and order are unchanged.

## Performance (FLOW-40)

- The stream sends only changed fields; a quiet board costs one heartbeat line every 25 seconds.
- The props route is paged (30 players) and cached per game for 30 seconds server-side; ladders render from the page already loaded, no extra request.
- Player photos and sponsor images below the fold lazy-load; board square photos load eagerly (nine, small).
- Standings rows are virtualised; the mini grids are CSS, not images.
- First paint of the board under 1.5 seconds on a mid-range phone on 4G; the board GET is one request with everything the first paint needs.

---

## Acceptance criteria

1. With two games not started, the pick sheet shows "All" plus two chips; with one, no "All" chip; a started game never appears.
2. A rung for a prop with multiplier 0.6 shows "Likely"; 0.61 and 1.25 show "50-50"; 1.26 shows "Go crazy"; a hidden, locked or Under prop never appears.
3. Choosing a second line of the same player and stat asks "Replace your {stat} line for {player}?"; Replace leaves exactly one line for that player and stat, in the tapped square, and empties the old square.
4. "Enter contest" is disabled with 0 or 1 lines ("Add at least two lines"), disabled with any number of lines from one team ("Add a line from the other team"), and enabled with 2 lines from two teams ("Empty squares can't hit").
5. Auto-fill is disabled with an empty draft, never changes a filled square, fills the empty squares in the order middleMiddle, topLeft, topRight, bottomRight, bottomLeft, middleLeft, middleRight, bottomMiddle, topMiddle with the lowest multiplier first, never creates a conflict, and produces a two-team board whenever the pool allows.
6. In rearrange mode a drag swaps two unlocked squares; a locked square cannot be dragged, dropped onto or removed; the x empties a square with no confirm.
7. Entering creates exactly one board; a second create for the same fan and contest, including two simultaneous requests, returns 409 with the first board's id and the app lands on it.
8. `POST /b2b/board` refuses each of: one line; two lines from one team; a duplicate prop; two lines for one player and stat; a prop from a game that has started; a hidden prop; an Under prop; a prop from a game outside the contest; a closed, finalized, full, hidden or Trivia contest; a member with a blocking consent outstanding; a suspended tenant. Each refusal carries its `code` and the app shows the FLOW-13 copy.
9. `PUT /b2b/board/:id/cells` accepts replacing, moving and removing unlocked lines, refuses any change to a square whose game has started or whose prop is locked, refuses everything after the last game's tip-off, and refuses a stale `expectedUpdatedAt`.
10. `POST /b2b/board/generate` no longer exists.
11. Given props with each combination of `consensusOutcome`, `isFinal`, `locked` and game status, `squareState` returns the state in the FLOW-27 table, on the server and in the client.
12. A board whose top row turns Hit while the page is open draws the line, flashes the three squares, bumps the counter and announces "Bingo! 1 of 8" once; reloading draws the line static with no celebration.
13. With the stream blocked, the board updates by polling every 20 seconds; the dot stays green while polls succeed; after 60 seconds with no stream and no successful poll, "Reconnecting" shows.
14. A reconnect with `Last-Event-ID` replays missed events, and the board matches a fresh GET afterwards.
15. A 403 `tenant_suspended` on the stream, a refetch or a poll lands the fan on the Paused screen and stops all retries.
16. A scorebug never shows a score for a game without `scoreAvailable` and `eventDetails`.
17. A new award opens the popup on the open board within the stream latency; closing it sets `seenAt`; reloading does not show it again; an award created while the fan was away shows once on their next visit.
18. The popup shows the email line only when `emailStatus` is `sent`, shows the description exactly once, and shows the snapshot's prize even after an admin edits the tier.
19. After the migration, no existing award reopens a popup.
20. Standings return `hidden` before the first tip-off and rows afterwards; boards rank by bingos, then points; boards equal on both share a rank and the next rank skips; entry time orders rows only within a tied group and never changes a rank; at tip-off with no hits, every fan's row reads "Tied 1st of {N}".
21. Points for a board equal the `calculateScoreNew` current score of the same nine props, computed independently in a test.
22. Standings rows carry no prop details for other fans.
23. After finalization the page shows the podium and a "Your result" card with the fan's rank, highest tier and awards.
24. A Trivia contest's detail page shows "Trivia is on its way. This contest opens when it's ready." and no button.
25. Every screen in this spec passes an automated accessibility check with no serious violations, and the grid, sheet, rearrange and popup are fully operable by keyboard.

---

## Open questions (Arthur)

1. **Points: shown or hidden?** Standings rank by bingos, then points, either way (FLOW-33). Shown means the ladder's "+N pts", the "PTS" under the counter and the points column in standings. Hidden means points still break ties but no screen shows them. **Recommendation: shown.** Without a visible reward for a harder line, the ladder has no reason to exist and every sensible fan takes the easiest rung.
2. **Is there a score and clock feed for B2B's games?** The BetEvent contract has `scoreAvailable` and `eventDetails` (scores, period, time remaining; `BetEvent.ts:33`, `:58-66`), but nobody has checked that the replicated events carry them for B2B's games during play. If they do, scorebugs show scores; if not, they show LIVE and FINAL only.

---

## Recorded gaps (internal)

- **Line drift.** Boards reference props live, never a snapshot (`B2BBoard.ts:12-20`). A D2C admin changing a line or multiplier after a fan picks it changes that fan's square. Out of scope; the ladder and square always show the current value.
- **A 7-bingo tier can never be won.** A 3x3 board completes 0 to 6 lines, or 8, never exactly 7: leaving any one square unhit breaks at least two lines. The model accepts a tier at 1 to 8 bingos, so the contest builder (S1's console) should refuse a tier at 7. Until it does, such a tier is unreachable, and the Track shows its stop like any other.
- **Unders are never resolved by B2C** (`bettingPropHelpers.ts:260`), which is why FLOW-20 excludes them rather than a product choice.
- **`twoTeamsNotRequired` stays on the model and stays ignored** (`B2BContest.ts:64`). The two-team rule is unconditional.
- **The player limit remains count-then-insert** (`createBoard.ts:34-36`); two fans taking the last spot together can both get in.
- **Corrected-address resends.** A prize resent by staff to a one-shot corrected address becomes `fulfilled`, so the popup and results card would name the account email as the destination. The address is deliberately never stored, so the award cannot say otherwise. Rare and staff-initiated; acceptable, but worth knowing.
- **`claimedLineIndices` is documented as "0–8"** (`B2BBoard.ts:22`); the lines are 0–7. Fix the comment when the file is next touched.
- **The fan app's duplicate line counter** (`countParlaysHit`, `BoardPage.tsx:30-53`) goes; the server's `lineHits` is the one answer.
- **ALB idle timeout** is the default 60 seconds (not set in `main-api-service.ts`). The 25-second heartbeat depends on it staying above 30 seconds.
- **API task count** defaults to one (`main-api-service.ts:71`). Option B scales with tasks without change; option A needs every task subscribed.
- **Contest refusals have no `code` today**; FLOW-13 adds one per refusal beside the unchanged message.
- **The GET contest response loses the per-game player lists.** The current draft page is its only consumer and is replaced in the same change.

---

## Mocks

Static mocks for this flow, in `overboard-b2b-workspace\mocks\fanapp-v2\`. Each takes `?tenant=bears|hawks&mode=dark|light` (Bears on Prime Time; Fighting Hawks on Prime Time with the double band). Sample teams and players are invented.

| File | Shows |
|---|---|
| `contest.html` | Contest detail: status, closes-at line, description, games, prize ladder, how to play, "Build my board" |
| `build.html` | The builder with a part-filled board, count chyron, helper line, Auto-fill, Rearrange, Enter contest |
| `pick.html` | The pick sheet: game chip bar with "All", search, player list with "ON BOARD" |
| `ladder.html` | The ladder for one player: stat rows, rungs with Likely / 50-50 / Go crazy, "+N pts", the replace confirm |
| `board.html` | The live board: scorebug rail, counter and Track, squares in every state, a drawn BingoLine, sponsor banner, standings row |
| `prize.html` | The prize popup: Burst, tier chyron, prize, description, claim instructions, Provided by, email line |
| `standings.html` | Live standings: rows with mini grids, your row pinned |
| `results.html` | Final standings: podium, "Your result" card |

---

## References

- [`fan-app-v2.spec.md`](fan-app-v2.spec.md): layout, shell, contest list, contest detail layout and the shared status chyrons.
- [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md): how the preview renders the board, prize and results screens.
- [`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md): the decor kit pieces used here.
- [`admin-brand-v2.spec.md`](../core-modules/1-draft/admin-brand-v2.spec.md): the Brand page, including the progress marker upload.
- [`fan-app-v2-build-plan.md`](../../documents/HLDs/fan-app-v2-build-plan.md): the build slices (f2 contest flow, f3 live and standings).
- `overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md`: the console-to-fan-app preview contract.
- `artifacts/review-2026-09-24/contests-engine-fanapp.md` and `prizes-sponsors.md`: the research this spec builds on.
- [`entry-gate.spec.md`](entry-gate.spec.md): blocking consents and required fields, reused by FLOW-15.
- [`admin-contests.spec.md`](../core-modules/1-draft/admin-contests.spec.md): contest settings, refusals and their copy, hidden and closed semantics.
- [`prize-delivery.spec.md`](../core-modules/1-draft/prize-delivery.spec.md): the delivery whose outcome `emailStatus` reads.
- B2B code: `BE/handlers/board/createBoard.ts`, `BE/handlers/board/getB2BBoard.ts`, `BE/handlers/contest/getB2BContestPlayers.ts`, `BE/handlers/contest/listB2BContests.ts`, `BE/routes/boards/index.ts`, `BE/routes/contests/index.ts`, `BE/game/bingo/board.ts`, `BE/util/messages.ts`, `BE/middleware/tenant.ts`, `LAM/board-evaluator/index.ts`, `SH/interfaces/b2b/B2BContest.ts`, `SH/interfaces/b2b/B2BBoard.ts`, `SH/interfaces/reference/BetEvent.ts`, `SH/interfaces/reference/BettingProp.ts`, `SH/models/prize-redemption.ts`, `FAN/pages/board/BoardPage.tsx`.
- B2C code: `APP/shared-deps/interfaces/score.ts`, `APP/shared-deps/interfaces/Board.ts`, `APP/shared-deps/interfaces/BettingProp.ts`, `APP/shared-deps/interfaces/Contest.ts`, `APP/app/app/board/propselect/index.tsx`, `APP/app/app/board/propselect/BetTile.tsx`, `APP/app/app/board/availableprops/index.tsx`, `APP/components/board/EventSelector.tsx`, `APP/screens/boards/NewSingleBoard.tsx`, `APP/screens/boards/DraggablePropTile.tsx`, `APP/slices/boardSlice.ts`, `B2C-API/app_client_function/src-ts/helper_functions/appBoardHelpers.ts`, `B2C-API/main_client_function_two/src-ts/helper_functions/contestHelpers.ts`, `B2C-API/main_client_function/src-ts/helper_functions/bettingPropHelpers.ts`.
