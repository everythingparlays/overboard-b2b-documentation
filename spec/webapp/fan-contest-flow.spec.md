# Webapp Spec: Fan Contest Flow — detail, builder, live board, prize, standings (Wave 5)

**Implements:** Arthur's 2026-09-27 rulings, "Fan app overhaul" (no player-limit bar without a limit; auto-fill must work; rearrange follows the finger with a subtle jiggle; real player photos behind squares, never initials; the ladder from PES's per-player prop levels and multipliers exactly as PES defines them, Likely / 50% Chance / Go crazy and points as live in B2C v5.9.143; no replace-confirm; the straight-line bingo indicator for now; confetti inside the phone area in tenant colours; standings show display names); `arthur-rulings-after-specs.md` (standings show points; the scorebug shows tip time, LIVE, FINAL and never scores; the builder refuses unwinnable tiers); the Wave 4 walkthrough (contests, not games: one card and one board per contest; the bingo counter reflects server-recorded bingos; per-contest banners); the standing rule "function over mocks". Director's decisions W5-D01 to W5-D50, all binding (chiefly W5-D08 to W5-D23, W5-D37 to W5-D41, W5-D44 and W5-D45, W5-D54; `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md`, workspace), and the Phase A review rulings (`artifacts\wave-2026-09-27\briefs\w5-review-rulings.md`, workspace), and Arthur's walk #3 colour comments (`artifacts\review-2026-09-27\arthur-rulings-console-final-walk.md`, "Walk #3 rulings", workspace), reconciled with the Wave 5 palette (Text colour and the Start page adopted; Main-as-ground and no-mode open). PRD §1 fan flow, `PRIZE-01` (the in-app half).

**Depends on:** On main: [`../core-modules/1-draft/end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md) (Wave 3: server awards §1.5, derived game status §2, `featuredGame` and board draw §3.3, join refusal codes §3.4, the board §4). Wave 4's specs on docs branch `arthur-w4-console` (PR #29, not merged): `admin-contests.spec.md` (states, description, player limit), `admin-prizes.spec.md` (the library, the award snapshot, the fan wire), `admin-sponsors.spec.md` (slots and sizes), [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) (shared `buildBoard`, `joinRefusal`). The Wave 4b fix pass (not built at the time of writing): **the shared derived bingo function** (W5-D40), the re-grounded prize model (W5-D41), per-contest banners. This branch is rebased once Wave 4 and 4b merge; names marked "to confirm at rebase" are checked then. Siblings on this branch: [`fan-app-v2.spec.md`](fan-app-v2.spec.md), [`../core-modules/1-draft/fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md), [`fan-app-v2-console-touchpoints.spec.md`](fan-app-v2-console-touchpoints.spec.md).

**Supersedes:** S2's draft of this spec (docs branch `arthur-s2-fanapp-spec`, PR #23): square-by-square building as the only path and the retirement of `POST /b2b/board/generate`; the replace-confirm; the "50-50" label; auto-fill gated on one pick; the Enter confirm sheet; the server-sent-events stream; the trivia card; score lines on scorebugs; the full-screen flash.

**Status:** Draft, 2026-09-28, Wave 5 Phase A. Built in Phase B on the never-merged `arthur-w5-fanapp` branches (W5-D29).

## Overview

Today (Wave 4, `.worktrees\template-w4-int`) a fan taps a contest card and lands on "Draft Your Squad": up to 8 players across the contest's open games, per-game tabs when there are several, and "Generate Bingo Board", which calls `POST /b2b/board/generate` and lands on the board. The server fills the board with the shared `buildBoard`. The board polls every 30 seconds, counts bingos as `claimedLineIndices.length`, and opens `PrizeModal` for each server award once (remembered in `localStorage`). Nothing can be edited, there are no standings, and the card title is a game's matchup.

**The whole change, in one line:** a card opens the contest's own detail page; "Build my board" generates a board from the players the fan picks (today's flow, re-skinned), and the fan can then hand-pick or edit any square from each player's real PES line ladder until that square's game tips off; the live board, prize popup and standings show only what the server recorded.

**In scope:** contest detail; the builder (player selection and generate, hand-pick, edit, the pick sheet and ladder, fill-empties, rearrange); server validation; the live board; the prize popup; standings and results; points; multi-game rules; the API table of every call the fan app makes.

**Not in scope:** the shell, Contests, Your boards, Profile ([`fan-app-v2.spec.md`](fan-app-v2.spec.md)); the kit ([`fan-decor-system.spec.md`](../core-modules/1-draft/fan-decor-system.spec.md)); prize delivery itself; anything B2C fans can't do (boosts, wildcards, swaps with a cost, a free square, grid sizes).

### Parity with B2C (appv1 v5.9.143, research `e2e-pes-fanapp.md` §7)

| Mechanic | B2C | Here |
|---|---|---|
| Line ladder per player per market | Every alternate line is its own prop; one row per market, rungs sorted by multiplier | Same (`FLOW-04`) |
| Labels | points = 100 × multiplier: ≤60 **Likely**, 60–125 **50% Chance**, >125 **Go Crazy** | Same words and thresholds (W5-D12) |
| Replace a conflicting line | A "Conflicting Selection" confirm | **No confirm:** direct replace with Undo (ruling; `FLOW-41`) |
| Auto-fill | Enabled after one pick | Generate from picked players, and fill-empties from any state (W5-D38) |
| Rearrange | Long-press, drag swaps, x removes, locked tiles refuse | Same, plus a Rearrange button (W5-D14) |
| Free changes until kickoff | Per tile at its game's start; server-enforced | Same (`FLOW-12`, `FLOW-21`) |
| Points | Hit square = multiplier × 100; completed line adds `calculateParlayBonus` | Same formula (`FLOW-34`), written by the evaluator |
| Win condition | Rank at finalization | Bingo tiers paid when reached; standings rank by bingos, then points |

---

## Contest detail (`/contest/:contestId`)

**`FLOW-43` — The detail page is what a card opens, always** (W5-D37). A card never deep-links into the builder; building is a decision the fan takes here.

**Layout, top to bottom** (W5-D10):
1. **Hero band:** the contest's banner image behind the band when present (Wave 4b's per-contest banner, else its brand-derived default; field to confirm at rebase), the contest's own name (`contestName`, `.k-d1`, up to three lines), the status chyron and JOINED ([`fan-app-v2.spec.md`](fan-app-v2.spec.md) `FAN-18`), and the timing line:

   | State | Timing line |
   |---|---|
   | One game, not started | "Board changes close at tip-off, {when}." |
   | Several games, first not started | "Each square locks when its game tips off. First tip-off {when}." |
   | Several games, some started, some to come | "Each square locks when its game tips off. Next tip-off {when}." |
   | Upcoming | "Opens {when}." (`contestStatus.opensAt`) |
   | Every game started | "Board changes are closed." |
   | Finalized | none |

2. **The limit line** (`FLOW-45`, below).
3. **Description:** `description` in full, as plain paragraphs split on blank lines; omitted when empty.
4. **Games:** one `Scorebug` per game, in tip-off order: "{Away} @ {Home}" with logos when present, and "Tip Sun 7:30 PM", "Live" or "Final" from the derived game status. **Never a score or clock** (`DECOR-18`).
5. **Prizes:** the contest's tiers, lowest bingo count first, each: a chyron "Tier {n} · {m} bingos" ("1 bingo"), the prize name, its description in full, its image (96px) when set, and "Provided by {sponsor}" when the tier carries `providedBy`. No value, shipping, pick-up, expiry or type (W5-D41). Omitted when the contest has no winnable tiers (`FLOW-46`).
6. **Sponsors:** the distinct sponsors placed on this contest (any slot, contest-wide or for one of its games), each as its sign-in logo (or name) linked to its website when set. From the public sponsor schedule (`placements` filtered to this `contestId`, joined to `sponsors`). Omitted when none.
7. **How to play**, three static lines: "Fill your 3×3 board with player lines." / "A line hits when the player reaches it." / "Three in a row is a bingo. Bingos win prizes."
8. **"See standings"** once standings are visible (`FLOW-35`); "See results" once finalized.
9. **The sticky CTA bar** (`FLOW-01`), replacing the tab bar (W5-D04).

### The limit line (`FLOW-45`, W5-D08)

- **"{n} playing" always**, once the server sends a real count: **Phase B: to build** `playerCount` (the contest's board count) on `GET /b2b/contest/:contestId`. Today the fan wire has none: `numberParticipants` is dead data ("nothing increments it… Never display it", `B2BContest.ts`), and the real count goes out only on the admin preview. Until `playerCount` ships the line is absent, and **nothing about spots shows either**, limit or not: no "spots left", no bar (review ruling 11).
- **"{m} spots left" and a small progress bar** (filled `n / maxParticipants`) **only when `maxParticipants` > 0 and `playerCount` is served.** "1 spot left" singular. At the limit the text reads "Full" and the CTA reads "Contest full".
- **No limit (`maxParticipants` 0): no bar and no "spots" text.** The line is "{n} playing" alone.

**Answer to Arthur's question, "contest detail without a limit":** the page shows how many are playing and nothing about spots: no bar, no "spots left", no hard-coded fill. The mock's 68% bar was a fixed value in `screens.css` (`.cd__spots i { width: 68% }`) and is cut.

### The CTA (`FLOW-01`, W5-D09)

Decided in this order from existing wire fields, then corrected by any refusal the server returns:

| Condition (first match wins) | CTA | Enabled | Goes to |
|---|---|---|---|
| The fan holds a board on this contest (`GET /b2b/board/my-boards`) | "Open my board" | yes | `/board/:boardId` |
| `finalized` | "See results" | yes | `/contest/:id/standings` |
| `contestStatus.status` `Upcoming` | "Opens {date}" | no | — |
| `Open`, and every game open for entry has no players (`betEvents[].players` empty) | "Players not announced yet" | no | — |
| `Open`, and the count has reached `maxParticipants` > 0 (once `playerCount` ships) | "Contest full" | no | — |
| `Open` | "Build my board" | yes | `/contest/:id/build` |
| otherwise (`Closed`) | "Entries closed" | no | — |

**Refusals map to the same states** (codes from `JOIN_REFUSAL_CODES`, `obs-b2b-shared/src/api/b2b/board.ts`, Wave 3 §3.4), whether they arrive on generate or on create:

| Code | Status | CTA becomes | Notice above the CTA |
|---|---|---|---|
| `not_found` | 404 | The not-found state | — |
| `not_open_yet` (+ `opensAt`) | 409 | "Opens {date}" (disabled) | "Entries open {date}." |
| `closed` | 409 | "Entries closed" (disabled) | "This contest isn't open for new players right now." |
| `full` | 409 | "Contest full" (disabled) | "This contest is full." |
| `no_players_yet` | 409 | "Players not announced yet" (disabled) | "Players for this game aren't available yet. Check back closer to game time." |
| `not_playable_here` | 409 | CTA hidden | "This contest can't be played here yet." |
| `board_exists` (+ `boardId`) | 409 | — | none: navigate (`replace`) to the board |
| consent or required field outstanding | 409 (today no `code`) | — | none: the membership refetches and the join gate takes over in place |

- The notice is a hairline card with a 2px Accent left edge, `role="status"`, and stays until the fan leaves. The detail read refetches after any refusal so the page shows the new truth.
- **Test mode surfaces nothing** in the fan UI (W5-D09): a test-mode contest simply reads Open (the server's `ignoreGameClock`).
- **Phase B: to build:** the consent refusal on `POST /b2b/board/generate` (`routes/boards/index.ts`) gains `code: "entry_outstanding"`, so the app keys on a code there too.

### States

| State | What shows |
|---|---|
| Loading | Band skeleton, a chyron block, three scorebug rows, two prize rows; a disabled skeleton CTA |
| Not found (404: missing, another tenant's, or a draft) | No band; `DecorField` corner; "We couldn't find this contest"; "See all contests" → `/contests` |
| Failed | The `FAN-13` card; no CTA bar |
| Offline | The offline banner over the last loaded page; the CTA fails with the network string |
| Not open yet | OPENS chyron; "Opens {date}" disabled |
| Open, some games live | OPEN; live games show "Live" on their scorebugs; building uses the games not started |
| Live (every game started, not final) | LIVE; "Entries closed" |
| Full | "Contest full" (from the refusal until `playerCount` ships) |
| Closed by the admin | CLOSED; "Entries closed" |
| Finalized | FINAL; "See results" |
| No players yet | "Players not announced yet" |
| Fan holds a board | JOINED; "Open my board" |
| No tiers / no winnable tiers | No Prizes section |
| No sponsors | No Sponsors section; no "Provided by" |
| No description | No description block |
| No banner | The band on its own |
| Paused | The Paused screen |

---

## Builder

Three screens, one flow (W5-D38):

| Route | Screen | Reached from |
|---|---|---|
| `/contest/:contestId/build` | **Pick your players** (the primary path) | Contest detail's "Build my board" |
| `/contest/:contestId/build/lines` | **Pick lines yourself** (hand-pick from empty) | "Pick lines yourself" on Pick your players |
| `/board/:boardId/edit` | **Edit your board** | The live board's "Edit board" |

### Pick your players and Generate (`FLOW-44`)

**Both paths start from the builder** (W5-D44): Generate is the primary CTA, and hand-picking from an empty grid is equally allowed ("Pick lines yourself"). A fan may hand-pick from empty, generate, or generate then edit. The two-line minimum applies to entering, never to starting.

Today's draft page, re-skinned on the kit, with its behaviour kept exactly (`ContestPage.tsx`):
- **Games:** only the games open for entry (`betEvents[].openForEntry !== false`, which is `!gameHasStarted`, or every game in test mode), sorted by tip-off. With two or more, a chip row with one chip per game ("{Away} @ {Home}", "Sun 7:30 PM", "· {n} picked"); with one, a caption line.
- **Players:** the game's players from `GET /b2b/contest/:contestId` (`_id`, `displayName`, `position`, `teamName`, `photoUri`, `showPhotoUri`, `jerseyNumber`), grouped by team (away first), each a card with the photo full-bleed behind a scrim (W5-D11; the kit's no-photo fallback, never initials), name, "#{jersey} · {position}", and a check when picked.
- **Selection:** up to **8** players across all games (`DRAFT_CAP`, today's cap); at the cap the other cards disable. The action bar shows the picked players as small photo chips (the fallback when no photo; today's initials stack is cut) and "{n} of 8".
- **Generate board** (primary, disabled with 0 picked or while pending; "Generating…"): `POST /b2b/board/generate { contestId, playerIds }` (exists; review ruling B2 adds an optional `cells`, below). The server draws only from games not yet started and fills the board with the shared `buildBoard` (the drafted players' lines first, lowest multiplier from the centre, a second team forced on the last cell, then fallbacks). Success: toast "Your board is ready!" and navigate (`replace`) to `/board/:boardId`.
- **Secondary:** "Pick lines yourself" → `/contest/:contestId/build/lines`.
- **Refusals:** the table under `FLOW-01`, shown on this screen as the notice, with the same CTA states.
- A fan who already holds a board is redirected (`replace`) to it, as today.

**Phase B: to build (server):** the generate pool leaves out Under props (they never resolve; `bettingPropHelpers.ts` in D2C has no Under resolution) and locked props (`bettingPropIsLocked`). Today `createBoard.ts` filters only `showProp: true` and games not started, and `buildBoard`'s second fallback can place any leftover prop, a team prop or an Under included.

### Pick lines yourself (hand-pick from empty)

- The 3×3 grid, every square empty (dashed, "+"). Header "Build your board" and a count chyron "{n} of 9".
- **`FLOW-47` — The draft** lives in `sessionStorage` under `obs-fan.board-draft.{tenant}.{contestId}` (nine prop ids or null), wrapped in try/catch (a failed read starts empty), through `src/lib/storage.ts` (which gains a session accessor and keeps preview isolation). Nothing reaches the server until Enter. The draft is cleared on success.
- Tapping a square opens the pick sheet (`FLOW-03`).
- **Action bar:** "Fill empty squares" (`FLOW-09`, which creates the board), "Rearrange" (`FLOW-10`), and the primary **"Enter contest"** with the helper line (`FLOW-08`).
- **Enter** (a full grid): `POST /b2b/board/generate { contestId, cells }` with nine lines and no gaps (**Phase B: to build:** the optional `cells` on the existing generate route, review ruling B2; there is no separate create endpoint), validated by `FLOW-14`–`FLOW-26`. Success: toast "Your board is ready!" and navigate (`replace`) to the board. No confirm sheet: the board stays editable until each game tips off, so there is nothing to confirm.
- Leaving with at least one line: "Leave without saving?" / "Your picks won't be saved." / "Keep editing" (default) / "Leave".

### Edit your board (`FLOW-12`)

- **Whole-board window:** "Edit board" shows on the live board while the contest is not finalized, its last game has not tipped off, and at least one square is unlocked or empty. It disappears at the last tip-off.
- **Per-square lock:** a square is locked when its prop's game has tipped off or the prop is `locked` (the shared `bettingPropIsLocked`). Locked squares show a padlock; they can't be replaced, moved, swapped onto or removed; tapping one shakes it with the inline reason "This square is locked: the game has started." ("This square is locked right now." for a prop locked before its game). A square that locks while the fan is editing locks in place and any unsaved change to it is reverted with "{Player}'s game has started, so that square is locked."
- The same grid, pick sheet, ladder, fill-empties and rearrange as hand-pick, the header "Edit your board", and **"Save changes"**: `PUT /b2b/board/:boardId/cells { cells, fill?, expectedUpdatedAt }` (**Phase B: to build**). Success: toast "Board saved." and back to the board. Leaving with unsaved changes: "Leave without saving?" / "Your edits won't be saved." / "Keep editing" (default) / "Leave". Changes are unlimited and free.

### The pick sheet (`FLOW-03`)

A bottom sheet ("Pick a player"), full height on phones, a history entry (`FAN-07`):
1. **Game chips:** one per contest game not yet started, by tip-off; "All" first only when two or more are offered. No game offered: "Every game in this contest has started." and nothing else.
2. **Players:** the offered games' players with at least one eligible line (below), grouped by team, each with the photo (fallback, never initials), "#{jersey} · {position}", and "ON BOARD" when the player already has a line on the grid. No search (a game has a few dozen players at most; the list is short).
3. Tapping a player opens the ladder in the same sheet, with Back to "Players".

Empty game: "No lines are up for this game yet. Check back closer to tip-off."

### The ladder (`FLOW-04`, W5-D12)

**Source.** Every alternate line is its own PES prop (research §1.2: "each alternate line is its own prop"; B2C builds its ladder the same way). A player's ladder for one stat is **every eligible prop with the same player (`entityInfo._id`), the same `bettingBetType` and the same `bettingPeriodType`**, one rung per prop, sorted by `multiplier` ascending. Nothing is invented or interpolated: the rungs are exactly PES's lines and multipliers.

**Eligible:** `showProp: true`, not locked (`bettingPropIsLocked`), `outcomeType` not `Under`, the entity a `PlayerEntity`, from a game not yet started, in one of the contest's games.

**Data. Phase B: to build:** no fan read returns props today (only the admin preview's contest read does, as `props` by game). `GET /b2b/contest/:contestId` gains `props: Record<betEventId, Prop[]>` for the games open for entry, with the preview's projection (`BOARD_CELL_PROP_FIELDS`: `_id`, `betEventId`, `entityInfo`, `bettingBetType`, `value`, `alternateValue`, `outcomeType`, `multiplier`, `progressValue`, `consensusOutcome`) plus `bettingPeriodType`, `locked`, `isFinal` and `showProp` (already filtered to true).

**A rung shows:**
- the line: `alternateValue` when set, else "{value}+" (the shared `checkAlternateValue` rule and today's `propLine`), with the market's short form ("250+ PASS YDS"; `BET_TYPE_SHORT`, Wave 3 §4);
- the label from `points = round(100 × multiplier)`: **Likely** when 0 < points ≤ 60, **50% Chance** when 60 < points ≤ 125, **Go Crazy** when points > 125; no label when `multiplier` ≤ 0. One shared helper computes it for the ladder, the square and the preview;
- "+{points} pts" with `points = round(100 × multiplier)` from the prop's PES multiplier (W5-D12): what the line is worth if it hits. It is PES data and shows now; a board's evaluated total (`FLOW-34`) is a different number.

**Tapping a rung** (`FLOW-41`, W5-D12):
- It goes into the target square at once; the sheet closes; the square scales in (160ms; none under reduced motion).
- If the same player and stat is already on **another unlocked** square, that square empties and a toast says "Replaced 250+ PASS YDS" with **Undo** (5 seconds), which restores both squares. **No confirm dialog** (ruling).
- If that other square is **locked**, the rung is refused with a shake and the inline reason "Your {stat} line for {player} is locked, so it can't be replaced."
- The rung already on the board is marked "Your pick" and does nothing.
- If the target square is locked, the sheet never opens.

### Fill empty squares (`FLOW-09`, W5-D13 as amended by W5-D38)

- Fills **only the empty squares** and never changes a filled one. Works from an **empty grid** too: there is no "one pick first" rule.
- **One server path** (review ruling B2; no separate autofill endpoint). On Pick lines yourself it calls `POST /b2b/board/generate { contestId, cells, playerIds? }` with the grid's gaps as `null`: the grid's lines are kept, the shared `buildBoard` fills the gaps over the eligible pool (the ladder's eligibility) minus every prop that conflicts with a kept line, lowest multiplier first into the empties in the safest-first order (middleMiddle, topLeft, topRight, bottomRight, bottomLeft, middleLeft, middleRight, bottomMiddle, topMiddle), keeping the two-team rule on the last empty square, and **the board is created**: the fan lands on it and can edit any unlocked square. On Edit your board it calls `PUT /b2b/board/:boardId/cells { cells, fill: true, expectedUpdatedAt }`, which fills the gaps the same way and saves. `playerIds`, when sent, are the players picked on Pick your players, preferred for the fill.
- The filled squares animate in on the board square by square with a 40ms stagger (none under reduced motion).
- Hidden when the grid is full. When the pool runs out, the remaining squares stay empty and the board shows "We couldn't find lines for every square."; an empty pool is the `no_players_yet` refusal.

### Rearrange (`FLOW-10`, W5-D14)

- **Enter:** the "Rearrange" button or a 450ms long-press on a filled square. The action bar becomes one "Done"; the hint reads "Drag to swap squares. Tap × to remove a line."
- **Jiggle:** unlocked squares rotate ±1.2° over 0.32s, alternating phase square by square; none under reduced motion.
- **Drag:** Pointer Events; the dragged square follows the pointer 1:1 by `transform`, at scale 1.05 with a shadow; the others slide out of the way; dropping on another square swaps the two (including an empty one); releasing outside the grid springs back (stiffness ~300, damping ~28).
- **Locked squares** don't jiggle, can't be dragged or dropped onto, and show no ×.
- **×** empties a square at once (no confirm).
- **Keyboard:** Enter or Space picks up the focused square, arrows move the target, Enter drops (swap), Escape cancels, Delete or Backspace empties; each move is announced ("Moved to square 3").

### Kept rules (`FLOW-06`, `FLOW-07`, `FLOW-08`, W5-D15)

- **`FLOW-06` — One line per player and stat.** Two squares conflict when their props share `entityInfo._id` and `bettingBetType`. A draft never holds a conflict; `FLOW-41` is the only way to swap one. (Today's `buildBoard` matches by `displayName`; the Phase B endpoints match by entity id, so two players sharing a name never block each other.)
- **`FLOW-07` — Two teams.** Before Enter or Save, the filled squares include players from at least two teams (`entityInfo.teamName`). No contest setting relaxes it (`twoTeamsNotRequired` stays ignored).
- **`FLOW-08` — Entering and saving** (W5-D44: the two-line minimum applies to entering, not to starting). Pick lines yourself enters with a full grid: "Enter contest" sends nine lines with no gaps; "Fill empty squares" sends the grid with its gaps and creates the board in one step (`FLOW-09`). Edit your board saves with empty squares allowed. The server applies at least two lines and two teams to the result either way (`FLOW-24`, `FLOW-25`).

  | Screen and grid | Helper | Primary |
  |---|---|---|
  | Pick lines yourself, fewer than 9 lines | "Fill every square to enter, or tap Fill empty squares." | "Enter contest" disabled |
  | Pick lines yourself, 9 lines, one team | "Add a line from the other team" | disabled |
  | Pick lines yourself, 9 lines, two teams | none | enabled |
  | Edit, 0 or 1 lines | "Keep at least two lines" | "Save changes" disabled |
  | Edit, 2+ lines, one team | "Add a line from the other team" | disabled |
  | Edit, 2–8 lines, two teams | "Empty squares can't hit" | enabled |
  | Edit, 9 lines, two teams | none | enabled |

### Unwinnable tiers (`FLOW-46`, W5-D16)

A 3×3 board completes 0–6 lines or all 8, never exactly 7 (leaving any one square unhit breaks at least two lines). The console refuses a tier at 7 bingos (Wave 4's tier editor; to confirm at rebase, else **Phase B: to build** in `PUT /admin/contests/:contestId/prize-tiers` validation). The fan app never shows a tier it cannot pay: a tier at 7, and a tier whose prize is incomplete, are left out of the Prizes section, the Track and every count. **Phase B: to build:** `GET /b2b/contest/:contestId` applies the same completeness filter (`fanPrizeTiers`) the list already applies; today it doesn't.

### Server validation (`FLOW-14`–`FLOW-26`, for the two Phase B writes)

`POST /b2b/board/generate` with `cells` (create) and `PUT /b2b/board/:boardId/cells` (update, with or without `fill`) enforce, in order, the first failure answering:

- **FLOW-14** Tenant not suspended (`resolveTenant`, 403 `tenant_suspended`).
- **FLOW-15** Membership, blocking consents and required fields complete (the generate route's gate, now with `code: "entry_outstanding"`), on create and update.
- **FLOW-16** One board per fan per contest: `board_exists` with its id, before any contest check; the unique index turns a race into the same 409.
- **FLOW-17** On create: the shared `joinRefusal` (`not_found`, `not_playable_here`, `not_open_yet`, `closed`, `full`), as generate does.
- **FLOW-18** On update: the board is the caller's in this tenant (404 otherwise); the contest isn't finalized and its last game hasn't tipped off (`edit_closed`). Closing a contest stops joining, never play: a fan with a board on a closed contest may still edit until the last tip-off.
- **FLOW-19** Exactly nine cells in board order (`BOARD_POSITIONS`), each a prop id or null.
- **FLOW-20** Every prop new to the board is eligible (the ladder's rule) (`prop_unavailable`, `game_started`).
- **FLOW-21** A stored prop that is locked stays in its square (`cell_locked`).
- **FLOW-22** No prop twice (`duplicate_prop`).
- **FLOW-23** One line per player and stat (`line_conflict`).
- **FLOW-24** At least two lines (`too_few_lines`).
- **FLOW-25** Two teams (`one_team`).
- **FLOW-26** On update, `expectedUpdatedAt` matches (`stale_board`: "Your board changed on another device. We've loaded the latest version.").

**Why `FLOW-21` protects prizes:** a claimed line is three hit squares; a hit square's game has started, so it is locked and can never move. Editing can't disturb a claimed line or re-trigger a prize.

Cell-level codes come back as `cellErrors: [{ position, code }]` so the grid marks the squares.

**Error copy (`FLOW-13`):** the refusal table under `FLOW-01`, plus `edit_closed` "Board changes are closed for this contest."; `cell_locked` "{Player}'s game has started, so that square is locked."; `game_started` "{Player}'s game has started. Pick another line."; `prop_unavailable` "That line isn't available any more. Pick another."; `duplicate_prop` "That line is already on your board."; `line_conflict` "You already have a {stat} line for {player}."; `too_few_lines` "Add at least two lines"; `one_team` "Add a line from the other team"; network "We couldn't reach the server. Check your connection and try again."

---

## Live board (`/board/:boardId`)

**Layout, top to bottom:**
1. **Header:** Back; the contest's own name (never a matchup); the connection dot (`FLOW-42`); menu.
2. **Scorebug rail:** one per contest game, `InProgress` first, then by tip-off; horizontal scroll with several games. Never scores.
3. **Counter:** the bingo count (`.k-d-hero` numeral) with "Bingos" and "of 8 lines"; points under it only once real (`FLOW-34`).
4. **Track:** 0–8 with one stop per winnable tier of the contest (`FLOW-46`; no fixed cap, bounded by the contest's tiers) labelled with the prize name and "{m} bingos"; the marker is the game's `slider` sponsor's icon when one holds that slot (the per-game override), else the tenant's progress marker, else a Main puck (`DECOR` Track). This covers Arthur's per-game marker override (walk #3); the default is the tenant's own mark rather than a triangle.
5. **Sponsor board banner:** the `boardBanner` holder (contest-wide, or the board's game's own when the board draws from one game), between the counter block and the squares, at the Wave 4 box (4:1 at the 480px column, never cropped; W5-D34).
6. **The grid** (`FLOW-27`).
7. **Standings row:** "Standings: you're {12th} of {340}" ("tied {1st}" when shared) linking to standings, or "Standings appear at tip-off" before the first tip-off.
8. **"Edit board"** when `FLOW-12` allows it.

### Squares (`FLOW-27`, W5-D17)

Each filled square is the kit's `Square` at `dim` ~0.55 with the player's photo (W5-D11; fallback gradient, jersey and name, never initials), the jersey number, the line ("250+ PASS YDS", wrapping to two lines, never cut), and, for an `Over` prop with numeric progress, the fraction "{progressValue} / {line}" and a meter at `min(progressValue / value, 1)` (the Wave 4 `StatFraction` rule: player prop, `Over`, numeric `progressValue`, target > 0). States, first match wins:

| State | Condition | Shows |
|---|---|---|
| `empty` | the cell is null | dashed, "Empty" |
| `hit` | `consensusOutcome === "Hit"` | `--k-hit` border and glow, check in the top-right corner (Wave 3) |
| `miss` | `consensusOutcome === "Miss"` and `isFinal` | dimmed, line struck, "Missed" |
| `void` | `consensusOutcome === "Void"` and `isFinal` | the miss treatment, "Void" |
| `live` | the game's derived status is `InProgress` | `Brackets` (live), meter animates on change |
| `pending` | otherwise | hairline, "Tip 7:30 PM" |

A `Miss` that isn't final is shown by game status (live or pending), never as missed. `locked` is layered on any state while editing (`FLOW-12`). A square that just turned `hit` gets `Brackets` `justHit` for 2 seconds.

### Bingos, lines and progress (`FLOW-50`, W5-D40)

- **Every bingo number and line comes from the shared derived bingo function (Wave 4b)**, computed from the same prop states that draw the squares: the counter, the Track, the BingoLine overlay, Your boards, the mini-boards and standings all read it. No screen counts lines another way, and there is no second source. The exact symbol is to be confirmed at rebase (4b had no commits at the time of writing); Wave 3's shared `completedLines(cells)` (`scoring/bingo-lines.ts`) is the geometry it builds on.
- **The evaluator persists the function's output** (bingos, completed line indexes, points) on the board whenever it evaluates it, and the cell writes do the same on save: one server-written source, read by the board, Your boards and standings (review ruling 9). No other code path writes a count. **Phase B: to build.**
- **Awards still come only from the server** (`awards[]` on the board read, Wave 3 §1.5): a line the derived function shows complete opens no popup until the server has recorded the award.
- The Wave 4 walkthrough found the counter at 0 on a board with three completed lines; W5-D40's single source is what makes the counter, the lines on the grid and the Track agree.

### The bingo indicator (`FLOW-28`, W5-D18)

Straight-line overlay pills (the kit's `BingoLine`) across each completed line in the derived function's output (never `claimedLineIndices`, which records claims, not the board's state), Main-ink, drawn in over 500ms the first time the page sees the line complete; lines already complete on load draw static. **Acceptable for now; improve later** (ruling). When a line completes while the page is open: the stroke draws, its three squares flash Accent once, the counter bumps (1.0 → 1.15 → 1.0 over 300ms) and the Track marker glides; nothing loops; under reduced motion the line appears static. Announcements, polite: "{Player} hit {line}." and "Bingo! {2} of 8".

### Refresh (`FLOW-42`, W5-D19)

- **Polling:** `GET /b2b/board/:boardId` every **15 seconds while the page is visible** (today 30s), paused while hidden, and immediately on focus or visibility. No stream (the S2 server-sent-events stream is cut; SSE is a Phase B option, not a requirement).
- **Connection dot** (W5-D07): green while the last successful read is at most 30 seconds old (two polls), grey otherwise; its accessible name is "Updated {n} seconds ago". Grey for over 60 seconds adds a quiet "Reconnecting" beside it. It is real: the timestamp of the last successful read.
- **Offline:** the shell's banner; polling waits for `online`.
- **403 `tenant_suspended`:** stop polling; the Paused screen.
- **404:** "We couldn't load this board." with "Back to Your boards".

### States

| State | What shows |
|---|---|
| Loading | Counter, track and nine square skeletons |
| Not found / not the fan's | The 404 card above |
| Failed | The `FAN-13` card |
| Before the first tip-off | Every square pending; "Standings appear at tip-off" |
| Live | Live squares with brackets; counter and lines as they complete |
| Final | Every square hit, missed, void or empty; no "Edit board" |
| Finalized contest | FINAL; no edit |
| No winnable tiers | Track without stops; no prize popup ever |
| No sponsor banner | No banner block |
| Empty squares | Dashed; they never hit |
| Offline | Banner; the last board stays |
| Paused | The Paused screen |

### Fan-wire hygiene (`FLOW-49`)

**Phase B: to build.** `GET /b2b/board/:boardId` and `GET /b2b/board/my-boards` spread the fully populated contest, so the fan wire carries the contest's `internalNote`, `lockedAt`, `testMode` and each tier's `approximateValueCents` (research on `backend-w4-int`: `getB2BBoard.ts`, `listB2BBoards.ts`). The contest reads were built with an allowlist to prevent exactly this (Wave 4, `fan-contest-projection.ts`). Both board reads project their contest through the same allowlist. The allowlist itself still names the legacy `contestDescription` (the old console-only "Note"), which an unmigrated contest would send; it leaves the allowlist in the same change.

---

## Prize popup (`FLOW-31`, W5-D20 as amended by W5-D41)

**Opens only for a server award:** an entry in `awards[]` on the board read (`status` `pending`, `fulfilled` or `failed`; `skipped` rows never reach the fan), **once per award**. Until **Phase B: to build** `seenAt`, "once" is remembered in `localStorage` under today's key `prize-award-shown-{boardId}-{bingoCount}`. Several unseen awards open one after another, lowest bingo count first.

**Content** (Nick's prize model, W5-D41):

| Part | Source | When |
|---|---|---|
| Tier chyron "Tier {n} · {m} bingos" | `n` = the tier's position in the contest's ladder (lowest bingos = 1); `m` = `award.bingoCount` | always; "{m} bingos" alone if the tier is gone |
| The prize's name (the title) | `award.prize.prizeName` | always |
| Description | `award.prize.prizeDescription` | when set; shown once (the current popup repeats it) |
| Image | `award.prize.prizeImageUrl` (160px) with `Burst` behind | when set; else the Burst alone |
| "Your code" and the code, with a **Copy** action ("Copied" for 2 seconds) | **Phase B: to build:** `award.prize.code`, the tenant's typed static code (no code generation exists), on the winner's own award only (W5-D45) | when the prize has one; it is also in the email |
| Claim instructions | `award.prize.prizeClaimInstructions` | when set |
| "Provided by {sponsor}" with its prize-popup logo | `award.prize.providedBy` (exists: the award snapshot's credit) | when set |
| "We've emailed the details to {email}" | `award.status === "fulfilled"`; `{email}` = the session's primary email, the address the prize worker sends to (`prize-worker/src/get-user-email.ts`) | only when fulfilled; nothing about email when pending or failed |
| Buttons | With `prizeClaimButtonLinkUrl`: the primary is `prizeClaimButtonText` and opens the link in a new tab, the secondary is "Close". Without: one "Awesome!" (today's default) | — |

- **Kept (Arthur, 2026-09-28, W5-D54), after tracing (W5-D41 asks):** claim instructions and the claim button stay because both are used for real: today's `PrizeModal` shows the instructions under the headline and its button follows `prizeClaimButtonLinkUrl`, and the prize email renders the button when the link is a valid web URL (`render-prize-email.ts`).
- **Cut:** prize type, approximate value, redemption method, location, window and shipping. The award projection still carries `prizeType`; the popup never branches on it.
- **Code security:** the code is shown only inside the winner's own board read, which already requires the board's `clerkUserId`; it never reaches a list, the preview or standings.

**Celebration (W5-D21):** the kit's `Confetti` (≈80 pieces, 1.8s, gravity and drift, `--k-main-ink`, `--k-second-ink`, `--k-accent`) inside the shell column and clipped by it, so on desktop it never touches the decorative sides; the Burst plays once. **No full-screen flash.** Under reduced motion: the static Burst only.

**Closing:** any button, Escape or the scrim closes it and shows the next unseen award. With `seenAt` (Phase B): closing calls `POST /b2b/board/:boardId/awards/:awardId/seen` (`awardId` is the redemption row's `_id`, which the award projection gains, Phase B) (idempotent; sets `seenAt` on the redemption row once); a failed call keeps the award closed for this session and retries on the next load. The backfill on that deploy marks every existing award seen, so no fan gets a second popup for an old win.

---

## Standings and results (`/contest/:contestId/standings`)

**Phase B: to build** `GET /b2b/contest/:contestId/standings?cursor&limit` (`limit` default 50, max 100; `limit=0` returns only `me` and `page.total`):

```ts
{
  state: "hidden" | "live" | "final";
  rows: { rank: number; displayName: string; bingos: number; points?: number;
          cells: ("hit" | "miss" | "pending" | "empty")[]; isMe: boolean }[];
  me: (same row shape) | null;
  page: { nextCursor: string | null; total: number; limit: number };
}
```

Built from the contest's boards joined to each fan's membership `displayName` in this tenant; bingos, points and cells from the evaluator's persisted derived output (`FLOW-50`), sorted on those persisted fields; no prop details for other fans (a rival sees where you hit, not what you picked).

- **`FLOW-33` — Ranking** (W5-D22): bingos, most first; then points, most first (once points exist; until then bingos alone). Boards equal on both share a rank and the next rank skips (competition ranking, "1224", as B2C's `addRankToBoards`). Entry time orders a tied group on screen and never changes a rank. A shared rank reads "Tied {1st}" wherever the fan's own rank is written as words.
- **`FLOW-35` — Visible from the first tip-off** (the earliest game's `eventTime` in the past). Before it `state` is `hidden` and the page shows "Standings appear at tip-off". `final` once finalized.
- **`FLOW-36` — The page:** header chyron LIVE while a game is `InProgress`, FINAL once finalized; "{N} playing"; rows with rank (a `Medal` for 1–3, a numeral tile after; tied rows share it), the **display name** (never a real name), bingos as the big numeral, points small once real, and the mini-board; the fan's own row reads "You" with a Main-ink hairline and is pinned to the bottom when off screen (tapping it scrolls to it); endless scroll, 50 rows a page; refresh every 30 seconds while visible, never reordering rows under a touch.
- **`FLOW-37` — Final:** "Final standings", a podium for the top three (`Medal`s, `Burst` behind first; fewer boards show fewer places), and a "Your result" card: "{12th} of {340}" (or "Tied …"), the highest award's tier chyron and prize name, each award as a row (name, "Provided by {sponsor}", "Details emailed" only when `fulfilled`; tapping reopens the popup content without confetti), and "Back to Your boards". A fan with no board sees no card and no pinned row.

### The mini-board (`FLOW-48`, W5-D23)

Standings, results and Your boards draw each board as a 46px 3×3: **hit** (Main-ink fill), **miss** (strike), **pending** (hairline), **empty** (dashed). **The yellow (live) square is dropped.**

**Answer to Arthur's question, "what did the yellow square mean":** in the mocks it meant "this square's game is in progress" (`screens.css` `i.l`, an Accent tint with an Accent-ink ring). It is traceable (the derived game status), but at 46px it reads as a second kind of hit and adds nothing to progress toward lines, which is the mini-board's only job. The full board keeps its live state, with brackets and the meter.

### Points (`FLOW-34`, W5-D17)

- The B2C formula (`APP/shared-deps/interfaces/score.ts`): each hit square scores `multiplier × 100`; each completed line adds `calculateParlayBonus(m1, m2, m3) = ((m1+1)(m2+1)(m3+1) − 1) × 100`, zero when any multiplier is 0 (B2C's quirk, kept). Empty squares score nothing.
- **Written by the evaluator, never computed in the browser.** **Phase B: to build:** the evaluator persists `points` with the derived bingos and lines (`FLOW-50`) whenever it evaluates a board, and the cell writes do the same on save; `B2BBoard` and its schema gain those fields; standings sort on them through an index on `{ contestId, bingos: -1, points: -1, createdAt: 1 }`.
- **Until points are written, no screen shows a board's points:** not the counter, not standings, not Your boards. The ladder's per-rung "+N pts" is PES data and shows now (`FLOW-04`).

---

## Multi-game (`FLOW-38`)

- **One contest, one card, one board**, whatever the number of games (walkthrough ruling). The card and detail lead with `featuredGame` (live, else soonest to come, else most recent), never array order (Wave 3 §3.3).
- **Status** is the shared `getB2BContestStatus`: Open while any game is joinable; a contest whose first game is live and second is tomorrow is Open, and a new fan builds from the second game only.
- **Building** draws only from games not started (generate, fill-empties, the ladder), all games in test mode.
- **Per-square lock** at each square's own game's tip-off; a board can be part live, part editable. The whole-board edit window closes at the last tip-off.
- **Sponsors:** the board's banner and slider come from the contest-wide holder, or the game's own holder when the board draws from one game (`useSponsorSlots`, today's rule).

## Trivia

Cut. A trivia contest exists only as a draft: the registry marks it unplayable (`CONTEST_TYPE_REGISTRY.trivia.playable === false`), publishing is blocked (`publish_blocked`), drafts are never on the fan wire, and generate refuses it (`not_playable_here`). No fan can reach one, so the "on its way" card would never render.

---

## API

Every call the fan app makes on the Wave 5 branch. "Exists" was traced in `overboard_sports_backend` on `arthur-w4-console` (`.worktrees\backend-w4-int`, `node-server/src/routes/**`); main differs only where noted. All `/b2b/*` fan routes take `?tenant=<slug>`; `requireMembership` routes also need a Clerk session.

| Method | Path | Request | Response (as it exists, or as specified) | Status |
|---|---|---|---|---|
| GET | `/b2b/org/:subdomain` | — | `{ success, organization: { _id, subdomain, name, branding?: { theme?, logo?, sponsorName?, sponsorLogo?, sliderTipImageUrl?, text?* } } \| null, suspended? }`; `organization.documents?`* | Exists (public); `text`, `documents`: **Phase B: to build** |
| GET | `/b2b/org/:subdomain/sponsors` | — | `{ success, configured, sponsors[], placements[], featured, nextGame }` | Exists (public) |
| GET | `/b2b/org/:subdomain/consent-document/:optInId/:linkId` | `?version=` | `{ success, optInId, linkId, textVersion, title, body, publishedAt }`; 404 when none | Exists on Wave 4 (not on main) |
| GET | `/b2b/membership` | — | `{ success, member, membership \| null, pendingConsents[], signupFields[], pendingFields[], gateCopy? }`; `optIns[]`* | Exists (`requireTenant`); `optIns`: **Phase B: to build** |
| POST | `/b2b/join` | `{ displayName, profileFields?, consents?, pushToken? }` | `{ success, membership }` | Exists |
| POST | `/b2b/consent` | `[{ optInId, textVersion, decision }]` | `{ success, pendingConsents, pendingFields }`; 409 `stale_text_version` | Exists; accepts a re-decision on an answered opt-in |
| PATCH | `/b2b/membership` | `{ profileFields }`; `displayName`* | `{ success, membership, pendingFields }` | Exists; `displayName`: **Phase B: to build** |
| GET | `/b2b/contest/list-contests` | `?status=upcoming\|past` (optional; no paging) | `{ success, contests[] }` (fan projection: `_id`, `contestName`, `description`, `contestType`, `maxParticipants`, `state`, `finalized`, `closed`, `allowedBetEvents` with derived status, `prizeTiers` (completeness-filtered), `contestStatus`); `providedBy` on tiers*; `playerCount`*; banner (4b) | Exists; starred: **Phase B: to build** |
| GET | `/b2b/contest/:contestId` | — | `{ success, contest: { _id, contestName, description?, contestType, maxParticipants, prizeTiers, state, contestStatus }, betEvents: [{ event, players[], openForEntry }] }`; `props`*, `playerCount`*, tier `providedBy`*, tier completeness filter* | Exists; starred: **Phase B: to build** |
| POST | `/b2b/board/generate` | `{ contestId, playerIds?: string[] (1–100), cells?: (propId \| null)[9] }`; at least one of the two | Pinned `cells` are kept, the rest filled by `buildBoard`, the board created: `{ success, boardId }`; refusals `{ success: false, code, message, opensAt?, boardId?, cellErrors? }` | Exists with `playerIds`; `cells`, the pool filter and the `entry_outstanding` code: **Phase B: to build** |
| PUT | `/b2b/board/:boardId/cells` | `{ cells, fill?, expectedUpdatedAt }`; `fill: true` fills the gaps through `buildBoard` | `{ success, board }` | **Phase B: to build** |
| GET | `/b2b/board/my-boards` | — | `{ success, boards[] }` (newest first; contest and props populated); a row projection per board*: contest name, fan status, persisted bingos and points, nine cell states | Exists; the row projection and the contest allowlist (`FLOW-49`): **Phase B: to build** |
| GET | `/b2b/board/:boardId` | — | `{ success, board: { nine populated cells, claimedLineIndices, parlaysHit, awards: [{ bingoCount, status, prize: { prizeName, prizeDescription?, prizeImageUrl?, prizeClaimInstructions?, prizeClaimButtonLinkUrl?, prizeClaimButtonText?, providedBy?, prizeId?, prizeType?, threeInARows }, awardedAt? }] } }`; persisted derived bingos, lines and points (`FLOW-50`)*, award `awardId`*, `code`* and `seenAt`* | Exists; starred: **Phase B: to build**; contest projection (`FLOW-49`) |
| POST | `/b2b/board/:boardId/awards/:awardId/seen` | — | `{ seenAt }`; idempotent | **Phase B: to build** |
| GET | `/b2b/contest/:contestId/standings` | `?cursor&limit` | as under Standings | **Phase B: to build** |

Not used and not built: `GET /b2b/boards` (`my-boards` already lists a fan's boards, W5-D06), `GET /b2b/legal/:doc` (the consent-document read serves Terms and Privacy), a board stream (W5-D19).

---

## Accessibility (`FLOW-39`) and performance (`FLOW-40`)

- Text 4.5:1 and non-text 3:1 by the kit's guards. The grid is a 3×3 `grid`; each square is a button named "Square {5}: {Player}, {line}, {state}" ("live, 41 of 60", "hit", "missed", "void", "locked", "empty"); colour is never the only signal.
- The pick sheet is a modal dialog: focus moves in, is trapped, Escape closes, focus returns to the square. Game chips are a radio group; rungs are buttons named "{line}, {label}".
- Rearrange has the full keyboard path; live updates and bingos go to one polite live region; the popup is a modal dialog named by the prize.
- Targets at least 48px; reduced motion turns off scale-in, jiggle, drag spring, line draw, flash, bump, Burst, confetti.
- Board first paint under 1.5s on a mid-range phone on 4G; the board read is one request; square photos load eagerly, others lazily; standings rows virtualised; mini-boards are CSS.

---

## Rules

Kept or revised from S2: `FLOW-01`, `FLOW-03`, `FLOW-04`, `FLOW-06`–`FLOW-10`, `FLOW-12`–`FLOW-28`, `FLOW-31`, `FLOW-33`–`FLOW-40`. New: `FLOW-41` (direct replace with Undo), `FLOW-42` (polling and the connection dot), `FLOW-43` (detail first), `FLOW-44` (pick players and generate), `FLOW-45` (the limit line), `FLOW-46` (unwinnable and incomplete tiers hidden), `FLOW-47` (the hand-pick draft in `sessionStorage`), `FLOW-48` (the mini-board), `FLOW-49` (fan-wire hygiene on board reads), `FLOW-50` (one bingo source, persisted by the evaluator).

### Retired from S2

| ID | Was | Why |
|---|---|---|
| FLOW-02 | The Trivia "on its way" card | No trivia contest can reach a fan (unpublishable) |
| FLOW-05 | Replace confirm "Replace your {stat} line…?" | No replace-confirm (ruling); `FLOW-41` |
| FLOW-11 | "Ready to play?" confirm sheet and the "You're in" moment | A pointless confirmation: the board stays editable; success is a toast and the board |
| FLOW-29 | Scorebug score and clock when `eventDetails` exist | Never scores (ruling 2026-09-24) |
| FLOW-30 | Server-sent-events stream with a poll fallback | Polling stays (W5-D19); `FLOW-42` |
| FLOW-32 | Migrate the popup trigger from localStorage to `seenAt` at once | `localStorage` until `seenAt` ships, then the backfill (`FLOW-31`) |
| S2's retirement of `POST /b2b/board/generate` (410) | — | Generate is the primary path (W5-D38) |

---

## Function audit

### 1. Screens: data, calls, states

| Screen | Data sources (endpoint / model / PES field) | Server calls on fan action | States covered |
|---|---|---|---|
| Contest detail | `GET /b2b/contest/:contestId` (`contestName`, `description`, `maxParticipants`, `prizeTiers`, `state`, `contestStatus`/`opensAt`, `betEvents[].event` derived status, `players`, `openForEntry`); `GET /b2b/board/my-boards`; `GET /b2b/org/:subdomain/sponsors` (placements, sponsors); banner (4b); `playerCount`* | none (navigation) | loading, 404, failed, offline, not open yet, open with live games, live, full, closed, finalized, no players, joined, no tiers, no sponsors, no description, no banner, paused |
| Pick your players | contest read (players with `photoUri`, `showPhotoUri`, `jerseyNumber`, `position`, `teamName`) | `POST /b2b/board/generate` (exists) | no open games, no players, cap reached, generating, each refusal, board exists (redirect) |
| Pick lines yourself | contest read + `props`* (PES `value`, `alternateValue`, `multiplier`, `bettingBetType`, `bettingPeriodType`, `outcomeType`, `locked`, `entityInfo`) ; `sessionStorage` draft | `POST /b2b/board/generate` with `cells` (Enter; Fill empty squares)* | empty draft, restored draft, storage unavailable, pool exhausted, helper states, each refusal |
| Edit your board | board read; contest read + `props`* | `PUT /b2b/board/:id/cells` (Save; `fill: true`)* | locked squares, square locking mid-edit, stale board, edit closed, unsaved leave |
| Pick sheet / ladder | contest read `props`* | none | no games offered, empty game, player on board, rung is your pick, conflicting line (Undo), locked conflict |
| Live board | `GET /b2b/board/:boardId` (cells: `consensusOutcome`, `isFinal`, `progressValue`, `value`, `outcomeType`, `entityInfo.photoUri`/`showPhotoUri`, `betEventId` derived status; `awards[]`); shared derived bingo function (4b)*; contest tiers; sponsor schedule (banner, slider); `points`* | `GET` every 15s visible | loading, 404, failed, before tip-off, live, final, finalized, no tiers, no banner, empty squares, offline, paused |
| Prize popup | `awards[]` (`bingoCount`, `status`, `prize.*`, `providedBy`); Clerk primary email; `localStorage` shown-key; `code`*, `seenAt`* | `POST …/awards/:awardId/seen`* | one award, several, pending/failed (no email line), fulfilled, no image, no link, reduced motion |
| Standings / results | `GET /b2b/contest/:id/standings`* | none (30s refresh) | hidden before tip-off, live, final, ties, no board (no pinned row), empty page |

\* **Phase B: to build.**

### 2. Mock elements

| Mock element (`mocks\fanapp-v2\`) | Fate | Reason |
|---|---|---|
| Card → builder paths; S2 "Build my board" as the only entry | Changed | Card → detail always (W5-D37) |
| `contest.html` "340 playing · 160 spots left" and the 68% bar | Changed | "N playing" once `playerCount` ships; spots and bar only with a limit (W5-D08); the 68% was hard-coded |
| `contest.html` "Game 1 / Game 2" scorebugs with tip times | Kept | Derived status; never scores |
| `contest.html` prize ladder: chyron "3 bingos", name, thumb, "Provided by" | Changed | "Tier n · m bingos" chyron, description in full; credit needs live `providedBy` (Phase B) |
| Prize value, shipping, pick-up (none in the mocks; present in S2 and Wave 4's prize fields) | Cut | W5-D41 |
| `contest-trivia.html` card | Cut | No trivia contest reaches a fan |
| `build.html` square-by-square as the primary path, "Enter contest" | Changed | Pick players → Generate is primary (W5-D38); hand-pick kept as the secondary path |
| Player initials avatars (MC, EV…) on squares, pick list, ladder header | Cut | Photos; fallback gradient with jersey and name (W5-D11) |
| `build.html` difficulty chyron "50-50" | Changed | "50% Chance" (B2C's real label) |
| `ladder.html` "+35 pts"… on rungs | Kept | "+{multiplier×100} pts" is PES data (W5-D12) |
| `ladder-replace.html` replace confirm | Cut | No confirm; direct replace with Undo (ruling) |
| `pick.html` search field | Cut | Short lists; no search |
| `build-rearrange.html` tilted squares, × and grip | Kept | Jiggle ±1.2° (W5-D14); the mock's static tilt becomes the animation |
| Auto-fill "one pick first" (S2) | Cut | Fill works from empty (W5-D13/D38) |
| "Enter contest" confirm and "You're in" (S2 only; not in the mocks) | Cut | Pointless confirmation |
| `board.html` scorebug "Bears 17 – 14 Packers", "Q3 · 8:12" | Cut | No scores (ruling) |
| `board.html` "1,240 Pts" | Changed | Hidden until the evaluator writes points |
| `board.html` "of 8 lines" and Track stops with prize names | Kept | Real: 8 lines; tiers from the contest |
| `board.html` connection dot | Kept | Real: last successful poll (W5-D07) |
| `board.html` "Standings: you're 12th of 340" | Kept | Needs the standings read (Phase B) |
| `board.html` live square meter 68%, "41 / 60+" | Kept (as data) | `progressValue / value` for Over props |
| `board.html` straight BingoLine | Kept | "Acceptable for now; improve later" (W5-D18) |
| `prize.html` scrim, 44 CSS confetti, sunburst | Changed | JS confetti ≈80 in the column (W5-D21); Burst kept; no flash |
| `prize.html` "Tier 2 · 3 bingos", name, description, "Provided by", email line, "Claim my prize" + "Close" | Kept | Real award fields; email line only when fulfilled; button only with a link |
| Claim instructions and claim button ("Claim my prize") | Kept (Arthur, 2026-09-28) | Nick's `B2BPrize` fields, used by the popup and the email (traced; W5-D54) |
| `standings.html` mini-boards with yellow live squares | Changed | Live square dropped (W5-D23) |
| `standings.html` display names "Jess K.", pts, medals, pinned "You" | Kept | Display names (ruling); points once real |
| `standings.html` tie shown as a repeated "8" only | Changed | Also "Tied 8th" in words for the fan's own rank |
| `results.html` podium and "Your result" with "Details emailed" | Kept | Awards and ranks from the server |
| `phone--wide` 640px standings column | Cut | One 480px column |

---

## Acceptance criteria

1. Tapping a contest card opens `/contest/:id`; no card or link on any Contests or Your boards screen opens `/contest/:id/build`.
2. Contest detail with `maxParticipants` 0 shows no bar and no "spots" text; with a limit of 500 and 340 playing it shows "340 playing · 160 spots left" and a bar at 68%; at 500 it reads "Full" and the CTA "Contest full".
3. The CTA reads, per state: "Build my board", "Open my board", "Opens {date}" (disabled), "Contest full" (disabled), "Entries closed" (disabled), "See results", "Players not announced yet" (disabled); each refusal code produces the row in the `FLOW-01` refusal table.
4. Pick your players shows only games open for entry, photos or the fallback (no initials), caps at 8, and Generate lands on the new board with "Your board is ready!".
5. A rung for a prop with multiplier 0.6 reads "Likely", 0.61 and 1.25 "50% Chance", 1.26 "Go Crazy"; Under, locked, hidden and started-game props never appear; every rung is a real prop.
6. Tapping a rung for a player and stat already on another unlocked square moves the line with the toast "Replaced …" and Undo restores both squares; no dialog opens.
7. Fill empty squares on an empty grid creates a board with all nine squares filled and two teams when the pool allows; on Edit it fills only the empty squares and saves; it never changes a filled square.
8. In rearrange, squares jiggle, a dragged square follows the pointer, a drop swaps, a release outside springs back, and a locked square can't move or be dropped onto.
9. `POST /b2b/board/generate` with `cells` and `PUT /b2b/board/:id/cells` refuse every `FLOW-14`–`FLOW-26` case with its code; editing after the last tip-off is refused; `POST /b2b/contest/:id/autofill` and `POST /b2b/board` do not exist.
10. The live board's counter, Track, lines, Your boards row and standings row all show the same bingo count for a board, from the shared derived function.
11. The board polls every 15 seconds while visible and not while hidden; the dot turns grey after 30 seconds without a successful read.
12. The prize popup opens once per server award, never for a line without an award; it shows the email line only when the award is fulfilled; confetti never paints outside the column at 1280px; there is no full-screen flash.
13. No screen shows points until the evaluator writes them; afterwards the ladder, counter, standings and Your boards all show them.
14. Standings before the first tip-off read "Standings appear at tip-off"; afterwards they rank by bingos then points with shared ranks, display names only, and no other fan's props.
15. Mini-boards show no live square.
16. No scorebug anywhere shows a score or a clock.
17. `GET /b2b/board/:id` carries no `internalNote`, `testMode`, `lockedAt` or `approximateValueCents` (after `FLOW-49`).
18. A tier at 7 bingos or with an incomplete prize appears nowhere in the fan app.

## Open questions

None for Arthur. Decided since the first draft: hand-pick from an empty grid (W5-D44, `FLOW-44`), the prize code in the popup (W5-D45, `FLOW-31`).

To confirm at the Phase B rebase (a check, not a question): the shared derived bingo function's symbol and output shape (Wave 4b). This spec needs, per board, the count, the completed line indexes and the per-square states.

## Recorded gaps

- **No real player count on the fan wire** until `playerCount`.
- **No fan read returns props** until the contest read gains `props`; the ladder, hand-pick and fill-empties wait on it.
- **The generate pool can place an Under or a locked prop** until its filter is fixed.
- **Board reads leak console-only contest fields** until `FLOW-49`.
- **The contest read doesn't completeness-filter tiers** (the list does).
- **The consent refusal on generate has no `code`.**
- **A prize resent by staff to a corrected address** still reads "emailed to {account email}"; the corrected address is never stored on the fan side.
- **Unders never resolve in D2C** and **finalize-only hits don't reach production B2B** (Wave 3 §9); both are consumer-side.
- **Line drift:** boards reference live props; a D2C line edit after a pick changes the fan's square.
- **The player limit is count-then-insert**; two fans can take the last spot together.

## Mocks

Visual direction only (`mocks\fanapp-v2\`, workspace): `contest.html`, `build.html`, `build-rearrange.html`, `pick.html`, `ladder.html`, `board.html`, `prize.html`, `standings.html`, `results.html`. `ladder-replace.html` and `contest-trivia.html` are cut. Every deviation is in the function audit.

## References

- Rulings (workspace): `artifacts\review-2026-09-27\arthur-rulings-2026-09-27.md`, `arthur-rulings-wave4-walkthrough.md`; `artifacts\wave-2026-09-24\arthur-rulings-after-specs.md`.
- Decisions: `artifacts\wave-2026-09-27\briefs\w5-design-decisions.md` (W5-D08–D23, D37–D41, D44, D45).
- Research: `artifacts\review-2026-09-27\e2e-pes-fanapp.md` (§1.2 PES props and alternate lines, §3 join gates, §5 multi-game, §7 B2C parity, §8 photos).
- Fan app (Wave 4 integration): `src/pages/contests/ContestPage.tsx` (`DRAFT_CAP`, generate, refusals), `src/pages/board/BoardPage.tsx` (polling, awards, counter, track), `src/components/board/{BingoCell,PrizeModal}.tsx`, `src/lib/{board,contestView}.ts`, `src/store/api/contestApi.ts`.
- Backend (Wave 4 integration): `node-server/src/routes/{contests,boards,membership,orgs}/index.ts`, `handlers/contest/{listB2BContests,getB2BContestPlayers}.ts`, `handlers/board/{createBoard,getB2BBoard,listB2BBoards}.ts`, `util/{fan-contest-projection,fan-prize-tiers}.ts`, `middleware/tenant.ts`, `prize-worker/src/get-user-email.ts`, `prize-delivery/render-prize-email.ts`.
- Shared: `api/b2b/{board,contest}.ts` (`JOIN_REFUSAL_CODES`), `interfaces/b2b/{B2BBoard,B2BContest,JoinRefusal,contestTypes,B2BPrize}.ts`, `interfaces/reference/{BettingProp,BetEvent,Entity}.ts`, `boards/buildBoard.ts`, `scoring/bingo-lines.ts`, `models/prize-redemption.ts`.
- B2C (appv1 v5.9.143): `app/app/board/propselect/{index,BetTile}.tsx`, `shared-deps/interfaces/score.ts`, `screens/boards/{NewSingleBoard,DraggablePropTile}.tsx`.
