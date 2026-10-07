# Core Module Spec: The end-to-end flow — games, contests, boards, scoring, prizes

**Implements:** PRD `GAME-01`, `GAME-02`, `GAME-04`, `PRIZE-01`–`PRIZE-03`, `ADM-04`, `BRAND-01`; Arthur's rulings of 2026-09-27
(`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`, "Wave order: Wave 3").

**Depends on:** [`admin-contests.spec.md`](admin-contests.spec.md), [`contest-safety.spec.md`](contest-safety.spec.md),
[`prize-delivery.spec.md`](prize-delivery.spec.md), [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md),
[`admin-branding.spec.md`](admin-branding.spec.md), [`../../infra/environments.spec.md`](../../infra/environments.spec.md).

**Status:** Draft, written 2026-09-27 for Wave 3. Where this spec and an older one disagree, this one wins; each older spec
carries a pointer to the section here that supersedes it.

**Revision 2026-09-28 (Wave 4b, Arthur's walkthrough ruling "Scoring (root fix, not a patch)").** A board created after
its props already hit (dev test mode joins after kickoff) was never scored: scoring ran only when a hit arrived, so the
board showed three completed lines and "0 Bingos". Scoring-on-create was rejected as a band-aid. Instead:

- **One derived count.** A board's bingos are the lines its prop states complete (`boardBingos`, §1.2). The fan's
  counter and progress bar, the server, and every console number (Game day, the recap, the fans list, exports, overview,
  the contest page) read that one function. `claimedLineIndices` is the **award ledger** (which bingo counts have been
  paid), never the count.
- **An idempotent reconciler.** `reconcileBoard` (the evaluator, renamed) compares the derived lines with the awarded ones
  and awards what is missing, once. It runs on **every trigger**: a prop hit (the board-evaluator Lambda in production;
  the dev watcher and replay), a board being **created**, a board being **read**, and a **periodic sweep** (§1.2, §1.3).
  A missed event, a late join or downtime can no longer lose a bingo or a prize.
- **The contest, not a game.** Cards, the contest page and the board lead with the contest's own name; games are a
  small detail (§3.3). The card names the top prize by its name.

Revised 2026-10-07 (Arthur's rulings): **the last action wins, closing stops entries only, and Finalize stops every
award.** An admin's Open now, Close entries or Reopen entries is stamped (`stateChangedAt`) and beats the schedule until a
later schedule edit or closing time (§3.1; the full rule is [`admin-contests.spec.md`](admin-contests.spec.md), "Opens and
closes"). Closing a bingo contest stops new boards; boards already in play keep scoring and paying. Finalize, offered only
once the contest is closed, stores it Closed and is the hard stop: the reconciler sends nothing for a finalized contest's
boards on any trigger (§1.2). Edited in place below.

## Why this exists

The real flow — a real game with props from the Prop Entry System (PES) → a contest in the console → fans join and build
boards → stats resolve → bingos scored → prize awarded — did not work end to end on dev. The 2026-09-27 research
(`artifacts/review-2026-09-27/e2e-pes-fanapp.md`) found the causes. In priority order:

1. **Nothing scored in dev.** D2C publishes prop hits only to a queue in its own account. No B2B dev stack, and no local
   server, ever received one. The fan app hid this by counting bingos in the browser and showing the prize popup itself.
2. **Only NFL appeared in the game picker.** This came from data, not code: the mirror holds what D2C authors. The picker
   still hid the sport filter until two sports existed, and game status never changed from "Scheduled".
3. **The contest flow picked the wrong game.** It used the first stored game, even a finished one. It also mislabelled
   every refusal as "You already have a board", and gave fans no opening time.
4. **The board was unreadable on some themes.** Prop lines were truncated, and on the bears theme the hit states were navy
   on navy.

"There is no production" (Arthur, 2026-09-27): everything below targets the shared dev database. The production rails stay
anyway, because the platform will ship.

---

## 1. Scoring in dev

### 1.1 The production path (unchanged)

D2C → `prop-hit` SQS → **prop-update-evaluator** (finds boards holding the prop) → board-evaluation SQS →
**board-evaluator** (claims newly complete lines, enqueues one prize message per new line) → prize FIFO → **prize worker**
(records the `PrizeRedemption`, snapshots the tier, delivers). Nothing about this path, its queues, or the messages on it
changes.

### 1.2 One reconciler, every trigger

The two evaluators' logic moves into `obs-b2b-shared/src/scoring/`. The Lambdas keep their handlers and queues and call
it; the node-server's triggers call the same functions. There is exactly one definition of "which boards hold this
prop", "which lines are complete", "how many bingos a board has" and "award a line".

- **The count** (`bingo-lines.ts`, `boardBingos(cells)`, revision 2026-09-28): the number of lines the board's prop
  states complete. Every screen that shows a bingo count reads it: the fan board (`boardBingosOf` over the populated
  cells), and the node-server's `withDerivedBingos(boards)` (one outcome query over every cell of the boards being
  counted) behind Game day, the recap, the fans list and fan page, the usage export, fan actions, the overview and the
  contest page's "boards with a bingo". It can never disagree with what the board shows.
- **The reconciler** (`evaluate.ts`, `reconcileBoard`; `evaluateBoard` stays as its older name): derive the completed
  lines, compare them with the awarded ones (`claimedLineIndices`), send one prize message per missing line, then claim.
  Idempotent: a board awarded everything it shows is read and left alone, and two runs racing award nothing twice.
- **Finalize stops it** (2026-10-07). When the board's contest is finalized, or no longer exists, `reconcileBoard`
  returns the outcome `finalized` and sends nothing. `ScoringBoard.contestFinalized` is required, and
  `mongoScoringStore().loadBoard` reads the contest's `finalized`, so every trigger below (and the board-evaluator and
  prop-update Lambdas, the dev watcher and replay) stops at Finalize; the sweep already skipped finalized contests. A
  prize message queued before Finalize is still delivered by the worker: that bingo was made before it. Closing the
  contest (by hand or by its times) does not stop it: boards keep scoring and paying until Finalize.
- **The triggers**, all calling `reconcileBoard`:

  | Trigger | Where | Notes |
  |---|---|---|
  | A prop hit | production: prop-update-evaluator, then the board-evaluator Lambda; dev: the watcher (§1.3) and replay (§5) | Unchanged queues and messages. |
  | A board created | `POST /b2b/board/generate`, after the insert | A late join is awarded at once. A normal join (nothing hit) sends and writes nothing. Never fails the join. |
  | A board read | `GET /b2b/board/:id`, the fan app's 30 s poll | Only a board whose squares complete a line not yet awarded costs anything; the answer carries the new claims. Never fails the read. |
  | The periodic sweep | the dev watcher while it holds the lease; `startReconcileSweeper` on a server without dev tools but with a prize destination (its own lease in `${prefix}scoring_state`) | Every `RECONCILE_SWEEP_MS` (5 min default, `0` off). Reads boards, cells and outcomes in bulk and reconciles only the boards that owe an award. |

  The node-server sends prize messages to the local prize folder when `PRIZE_LOCAL_QUEUE_DIR` is set, else to the
  prize FIFO (`PRIZE_FULFILLMENT_QUEUE_URL`, the queue the board-evaluator writes to), with the same deduplication ids.
  With neither, it awards nothing itself and leaves the award to a trigger that can send it.

- **Lines** (`bingo-lines.ts`): the eight lines, in the evaluator's historical index order (rows, columns, diagonals —
  the order `claimedLineIndices` has always meant). `newlyCompletedLines(cells, claimed)` is pure.
- **Claim** (`evaluate.ts`, `reconcileBoard`): read the board with its props, compute the new lines, **send one prize
  message per new line** (`tierIndex = claimed.length + i`, deduplication id
  `userId-contestId-tierIndex-boardId`), then claim with a **conditional write** (`claimedLineIndices` still equal to what
  was read). A lost race re-reads and retries (at most three times). Send-then-claim is deliberate:
  a crash between the two re-sends on the next evaluation, and the redemption's unique index plus FIFO deduplication make
  the second message harmless. The reverse order could lose a prize. The conditional write replaces the old unconditional
  `$set`, which let two concurrent evaluations assign one `tierIndex` twice.
- **Fan-out** (`boardIdsHoldingProp`): every board with the prop in any of the nine cells.

### 1.3 The dev watcher

`node-server` runs a **dev-only prop watcher**: a MongoDB change stream on `readonly_props`. The Atlas trigger mirrors
with `replaceOne`, so every mirrored write arrives as a `replace` (or `insert`) carrying the full document. The watcher
matches `fullDocument.consensusOutcome === "Hit"` and feeds each prop id to the same path production messages take:

| Where | What the watcher does with a hit |
|---|---|
| **A personal stack** (`PROP_HIT_QUEUE_URL` set; CDK sets it on dev stages only) | Publishes `{ propId, type: "Hit", timestamp }` to the stack's own prop-hit queue, which is the exact message D2C sends. The deployed Lambdas then run exactly as in production. |
| **Local** (no queue URL) | Runs the shared evaluator in-process. Prize messages go to the prize worker's local folder (`PRIZE_LOCAL_QUEUE_DIR`), and the worker's local runner delivers into `PRIZE_EMAIL_OUTBOX_DIR`. Without a local folder the watcher does not start, and says why. |

- **Why hits only:** a Miss or a progress tick never completes a line. Re-evaluating a prop that was already a hit (a later
  progress update on the same prop) finds nothing new: evaluation is idempotent.
- **Resume:** the watcher saves its change-stream resume token in the stack's own `${prefix}dev_scoring_state`
  collection, so a restart continues where it stopped. If the token has aged out of the oplog, it starts fresh and runs a
  **catch-up sweep**: every board of every non-finalized contest in this prefix is evaluated once. The sweep also runs on
  a cold start with no token.
- **Finalize-only hits count.** D2C's finalize step resolves Manual and un-updated Over props without sending anything
  to SQS. A change stream sees those writes too, so dev scores them. The production gap is recorded in §9.
- **One scorer per prefix.** Every server with scoring on sees every hit. Before this rule, each one evaluated the same
  boards and queued its own prize copy before one of them won the claim, so the prize landed in whichever server's outbox
  got there first. Now scoring is **leased** per prefix, in `${prefix}dev_scoring_state`:
  - A server that starts takes the lease, so the server you just started is the one that scores.
  - The holder renews the lease every 10 s. A holder that finds the lease taken stops watching and logs
    `standing by: <host:port (pid)> scores <prefix> now`.
  - A server standing by takes over once the lease lapses (30 s without a renewal) or is released on a clean stop, and
    resumes from the saved position. Only the holder saves the resume token.
  - Replay (§5) is not leased: it is a request to one server, answered by that server.
  - While it holds the lease, the watcher also runs the reconciler's periodic sweep (§1.2).
  - `DEV_PROP_WATCHER=off` keeps a server out of scoring altogether: no lease, no stream, no sweep. Its own board
    creation and read triggers still reconcile the boards it serves. This is how a builder's server runs beside the
    server that scores the prefix without taking scoring over (revision 2026-09-28).
- **Two copies of one win.** A server still on older code, or a crash mid-claim, can still put two copies of a win in two
  prize folders. The prize worker treats a claim younger than its 60 s delivery limit as a send in flight: the second copy
  steps aside instead of recording the first copy's live send as "interrupted". A claim older than the limit is still an
  interruption. Production never delivers a copy inside that window: FIFO deduplication and a 120 s visibility timeout.
- **How fast (measured 2026-09-27, NFL Sunday).** A PES write reaches the mirror and the watcher in under a second. Each
  `prop hit` log line carries the time and `msSincePesWrote`, measured from the mirrored prop's own `updatedAt`.
  - **During a game,** D2C's updates move only the team totals and anytime-TD props.
  - **Player yardage and reception props** resolve when D2C finalizes the game, roughly 3 to 3.5 hours after kickoff.
  - So on a real game, most bingos arrive at finalize.

### 1.4 Impossible outside dev

The watcher, the replay endpoint and contest test mode (§5) are **dev tools**. All three are gated by one function,
`devToolsEnabled(env)`, which is true only when **every** condition below holds:

- `DEV_TOOLS === "on"`
- `MONGODB_DATABASE_NAME === "obs-b2b-dev"`. This is the real discriminator: a prod stack holds no credential for
  the dev database.
- `B2B_COLLECTION_PREFIX` is set and is not `prod_`
- `DEPLOY_STAGE` (set by CDK) is not `prod`

`NODE_ENV` is deliberately not a condition. Every deployed stack, personal dev stacks included, runs
`NODE_ENV=production` for its security posture, so it cannot tell dev from prod. CDK also refuses to synthesise a
`prod` stage with dev tools on.

CDK sets `DEV_TOOLS=on` and `PROP_HIT_QUEUE_URL` on non-`prod` stages only (`EnvironmentConfig.devTools`). The dev routes
are **not mounted** when the gate is closed, so they answer 404 like any unknown path. They are never mounted and then
refused. A stored `testMode: true` on a contest is ignored wherever the gate is closed.

### 1.5 The fan app: the derived count, and only server-side awards

- **Bingos** = the lines the board's own squares complete, by the shared `boardBingos` (revision 2026-09-28): the same
  count the server's reconciler and every console screen read. *(Wave 3 showed `claimedLineIndices.length`, which said
  0 on a board created after its props hit; that is the award ledger, not the count.)*
- **The prize popup** opens only for a **prize award the server recorded**: a `PrizeRedemption` for this board whose status
  is not `skipped`. `GET /b2b/board/:id` returns `awards[]`: `{ bingoCount, status, prize }`, where `prize` is the
  promised tier snapshot, or the live tier when the worker has not snapshotted it yet. A line the evaluator claimed
  before the worker recorded the award shows as a bingo with no popup until the award exists. *Revised 2026-10-03:* the
  popup is now the prize sheet, shared with trivia. It opens by itself for an award until the fan has seen it, which
  the server keeps as `seenAt` (read through `GET /b2b/prizes/awards`, set by `POST /b2b/prizes/awards/:awardId/seen`);
  it was once per award remembered per board and bingo count in the browser, which is gone
  ([`../../webapp/fan-prize-sheet.spec.md`](../../webapp/fan-prize-sheet.spec.md) `FLOW-31`, `FLOW-51`;
  [`prize-delivery.spec.md`](prize-delivery.spec.md)).
- The development-only "Test Bingo", "Prize Modal" and "Clear prize storage" buttons are **removed** (Arthur, 2026-09-27).
  They manufactured exactly the false wins this section forbids. Bingos and prizes are tested for real: by changing prop
  progress in PES on a game no D2C contest uses (the manual recipe), or by the read-only replay tool (the harness).
- The board polls every 30 seconds while focused, down from 2 minutes.

---

## 2. Every sport PES delivers

**Finding.** The dev mirror is complete and live. The Atlas triggers copy every insert, update and replace from D2C's
`cdk_test_*` collections, with no sport filter (`mongodb-access-isolation.spec.md`). On 2026-09-27, over the last 21 days
the mirror held:

- NFL: 50 events
- MLB: 14 events (last 09-15)
- CFB: 2 events, both created by D2C on 09-26, hours before tip-off

Only NFL was in the future. B2B code applied no sport filter either. "Only NFL" was what D2C had authored.

Three B2B behaviours made it look like a filter, and all three change:

1. **The sport filter now always shows**, and since Wave 4b lists **every sport the feed carries** (`sports` on
   `GET /admin/games/candidates` is the whole feed's distinct sports, by readable name in the console). Before, it was
   built from games still to come, and because D2C creates college and baseball games minutes to a day before they
   start, it showed NFL alone almost always. A sport with nothing to come stays choosable and says "No upcoming college
   football games yet."; under "All sports" every game that hasn't started is offered, of any sport or none (Arthur,
   2026-09-28: the PES → console seam is exact, with no sport, league or date filter of our own dropping an upcoming
   event).
2. **A game only minutes into play was unpickable.** The picker offered only games not yet started, so a Saturday CFB game
   that had kicked off was gone. That rule stays for normal contests (a started game can't be joined). A **test-mode**
   contest (§5) may also pick games from the last 14 days, so they can be replayed.
3. **Game status never moved.** 36 of 36 recently played events still read "Scheduled" in the feed.

**Derived game status** (`deriveGameStatus` in `obs-b2b-shared/src/interfaces/reference/BetEvent.ts`). The feed's own
`Final` always wins. Otherwise:

| Condition | Status |
|---|---|
| tip-off in the future | `Scheduled` |
| every visible prop of the game resolved (`isFinal`) | `Final` |
| started, within the sport's usual length (NFL/CFB 4.5 h, NBA/WNBA/CBB 3 h, NHL 3.5 h, MLB 4 h, SOC 2.5 h, MMA 6 h, others 6 h) | `InProgress` |
| started, past that length | `Final` |

Every server read that hands a game to a screen applies it: the fan contest list and detail, the board's populated games,
the fan sponsor schedule's featured and next game, and the console's game rows and picker (the sponsor slot editor lists
no games since 2026-09-30: a placement is for the whole contest). Every
console game-day phase ends a game by the same rule (`gamePhase`, [`admin-game-day.spec.md`](admin-game-day.spec.md),
"Phases"; Walk #3, 2026-09-29). The stored feed value is never written.

**Not ours:** a college-hockey sport code and updater. The consumer side adds it (ruling 2026-09-27). The one UND game
stored as `NHL` stays as D2C wrote it.

---

## 3. Contests: states, the right game, joining

### 3.1 Draft → Open → Closed

The separate *Visibility* switch (`showContest`) and the *Entries* switch (`closed`) are replaced by one stored state:

| State | Fans | Joining | Console |
|---|---|---|---|
| `draft` | Not listed; the contest page and join answer 404, as if it did not exist | No | Everything editable; the default for a new contest |
| `open` | Listed | Yes, while a game's entry window is open (or after a manual open, for games not started) | Editable per the lock |
| `closed` | Listed under **Past**, so fans can revisit their boards | No; boards already in play keep scoring and paying until Finalize | Reopen is allowed |

The stored state is not the whole answer: the phase (Upcoming, Open, Closed) also reads the times and, since 2026-10-07,
`stateChangedAt`, the moment an admin last opened or closed the contest by hand. **The last action wins**: a manual close
stays Closed whatever the schedule says; a manual open ignores the contest's opening time, the 48-hour pre-kickoff
window and any closing time that had already passed, until someone closes it or a later closing time arrives; a schedule
edit made after it (a past close, a future open) hands it back to its times. A manual open never lets a fan join a game
that has started: board generation still draws only from games not started (§3.3).

**Transitions** (by the phase, from shared `contestTransitions`; 2026-10-07):

- Draft → Open is **Publish**. It clears `stateChangedAt` and keeps the schedule.
- Upcoming → Open is **Open now**; Upcoming or Open → Closed is **Close entries**; Closed (by hand or by its times) →
  Open is **Reopen entries**. Each stamps `stateChangedAt`, even when the stored state doesn't change (an Upcoming
  contest, or one its closing time closed, is stored `open`), and none rewrites the times. Open now and Reopen are not
  offered on a bingo contest whose games have all started (`manualOpenCanAdmit`).
- Upcoming, Open or Closed → Draft (**Move to draft**) is allowed **only while the contest is unlocked** (no fan has
  joined), and clears the stamp. A contest fans have played cannot be hidden from them.
- A finalized contest refuses every change, as before. *Finalized* is a staff action, not a fourth state; the fan status
  reads Finished. Finalize is offered only once the contest is Closed (phase), and since 2026-10-07 it also stores
  `state: "closed"`.

**Storage and compatibility.** `B2BContest.state` is new. Every writer keeps `showContest` and `closed` consistent with it
(`showContest = state !== "draft"`, `closed = state === "closed"`), so a reader on an older build still behaves. Readers go
through `contestState(contest)`, which derives the state from the two legacy flags when `state` is absent.

**Migration** (`node-server/scripts/contest-state-migration.mjs`) is dry-run by default, `--apply` writes, and it is
dev-only (the same rails as the other scripts). It is additive: it sets `state` and removes nothing.

| Stored | Becomes |
|---|---|
| hidden, no boards | `draft` |
| hidden, with boards | `closed` (fans played it, so it stays reachable) |
| listed, `closed: true` | `closed` |
| listed, open | `open` |

**Wire.**

- `adminContestSchema` gains `state`, and keeps `visible` and `closed` as derived read-only values for one release.
- `POST /admin/contests` takes `state?: "draft" | "open"` (default `draft`) in place of `visible`.
- `PATCH /admin/contests/:id` takes `state` in place of `visible` and `closed`.
- The audit records the state change: `contest_update` with `fields: ["state"]` and the new `state`. A manual move
  (2026-10-07) also carries `transition` (`openNow`, `reopen` or `close`), and `fields` includes `state` even when the
  stored state is unchanged.
- Contest rows and the contest read carry `transitions`, `stateChangedAt` and `closeTimePassed` (2026-10-07).

**Console (minimal).** The create drawer's *Visibility* becomes **Draft / Open**. The contest drawer's badge shows the state.
*Close entries* and *Reopen entries* stay where they are, and *Move to draft* appears only while unlocked. The full redesign is
Wave 4, and the state actions as built since 2026-10-07 are [`admin-contests.spec.md`](admin-contests.spec.md)'s
("Transitions and where they live").

### 3.2 Deleting a contest

This supersedes `admin-contests.spec.md` "Not in scope: Deleting a contest" and Rule 9, per the 2026-09-27 ruling. Tenant
admins (and OBS staff) may delete any **non-finalized** contest. Finalized contests are final and refuse with 409.

`DELETE /admin/contests/:contestId` takes `{ expectedUpdatedAt?, confirmName }`. `confirmName` must equal the contest's name
(trimmed, ignoring case), or the answer is 400. The console asks the operator to type the name. Since 2026-09-28 (Arthur's Wave 4
walkthrough ruling) that is the whole confirmation, fans joined or not: nothing re-authenticates.

The steps, in order:

1. **Refuse while a prize send is in flight**: a redemption row claimed for sending and not yet concluded. 409: "A prize
   from this contest is being sent right now. Try again in a minute."
2. **Audit first**: `contest_delete` with the contest's **name**, id, and counts of boards, tiers, placements and pending
   sends. A failed audit write stops the delete ("no record, no action").
3. **Clean up**:
   - **Boards**: delete them.
   - **Pending sends** (not yet dispatched): delete them.
   - **Terminal redemptions** (fulfilled, failed, skipped): keep them as the record that a fan won something, with
     `contestName` stamped on each so Deliveries history stays readable.
   - **Prize tiers** this contest holds: delete them, unless another contest also holds a tier (never in practice). That
     unblocks deleting their library prizes.
   - **Sponsor placements** at the contest: delete them.
   - **The contest**: delete it.
4. Library prizes are **kept**. They belong to the tenant, not the contest.

### 3.3 The right game

`featuredGame(events, now)` (shared) picks the game a card and a draft lead with:

1. a game in progress
2. else the soonest game still to come
3. else the most recent game played

It never uses array order.

- **The card** *(revision 2026-09-28)* is the contest's, not a game's: its title is the contest's own name as set in the
  console, its description reads in full (wrapping, never clamped), and the prize line names the top tier's prize **by
  its name**, in full. The games are one small detail line: the featured game's matchup and time, and "+N more games"
  when it runs several. A multi-game contest is one card, one board. *(Wave 3's card led with the featured game's
  matchup and team logos.)*
- **The contest page** is headed by the contest's own name, with "Draft Your Squad" under it and the description in full.
  A closed or finished contest says "Entries closed" there instead, and shows no draft count or Generate Bingo Board
  button: nothing on it invites drafting.
- **The board** is headed by the contest's own name; a board drawn from one game shows that game's matchup and time as a
  small line under it. "My boards" already lists boards by contest name.
- **The draft page** lists only the games still open for entries, each as a tab in tip-off order, opening on the featured
  one. A fan may draft up to 8 players **across** those tabs. The per-game tabs are restored.
- **Board generation** draws only from games that have not started. A test-mode contest draws from every game.
- **Empty pool.** A contest whose open games have no visible props yet refuses the join: 409 `no_players_yet`, "Players
  for this game aren't available yet. Check back closer to game time." The server no longer saves a board of nine empty
  cells.

### 3.4 Joining: the real opening time, the real reason

- **Opening time.** The shared contest status carries `opensAt` (ISO) when Upcoming. The fan card reads "Opens Fri, Sep 26
  · 5:48 PM" in the fan's own time, not "Opens in 2 days".
- **Refusals.** Every join refusal carries a `code` beside its message:

  | Code | Status | Message |
  |---|---|---|
  | `not_found` | 404 | Contest not found |
  | `not_open_yet` | 409 | Entries open {time} (the server sends `opensAt`, and the fan app words it in local time) |
  | `closed` | 409 | This contest isn't open for new players right now. |
  | `full` | 409 | This contest is full. |
  | `no_players_yet` | 409 | Players for this game aren't available yet. Check back closer to game time. |
  | `not_playable_here` | 409 | This contest can't be played here yet. |
  | `board_exists` | 409 | (the fan app goes to the fan's board) |

  "You already have a board" appears only for `board_exists`, and there the app simply goes to the board.

---

## 4. The fan board

- **The prize progress bar is spaced by tier, not by bingo count** (revised 2026-09-28, Arthur's final walk). With N
  tiers, tier k's notch sits at k/N of the bar: one tier at the far right; two at the middle and the right; three at a
  third, two thirds and the right. The fill follows the same spacing: it reaches notch k exactly when the fan reaches
  tier k's bingos, and between two tiers it moves by bingos toward the next tier's count; past the last tier the bar is
  full. The marker rides the fill's tip. A contest with no tiers fills by bingos over the board's eight lines. Each
  tier's label owns the stretch of bar from the notch before it to its own and ends under its notch, so labels
  partition the bar and never overlap, whatever the number of tiers or the phone's width; a stretch too narrow for
  the prize's name (many tiers on a small phone) shows the bingo count alone, and the name is a tap away (the tier's
  details) and always read to a screen reader. The tier's details open across the bar's width, so a tier at the far
  right never pushes them off screen. One pure function (`tierTrack`, `src/lib/tierProgress.ts` in the fan app) gives
  the notches, the fill and the label stretches; the console's previews are the fan app in a frame, so they draw the
  same bar.

- **Full prop lines.** The line wraps to two lines at a real size (`text-sm`, `line-clamp-2`), replacing one truncated line
  at the undefined `text-md`. Markets get short forms:

  | Market | Short form |
  |---|---|
  | Receiving Yards | REC YDS |
  | Rushing Yards | RUSH YDS |
  | Passing Yards | PASS YDS |
  | Longest Reception | LONG REC |
  | Longest Rush | LONG RUSH |
  | Total Receptions | REC |
  | Rushing Attempts | RUSH ATT |
  | Passing Attempts | PASS ATT |
  | Passing Completions | CMP |
  | Passing TDs | PASS TD |
  | Passing Interceptions | INT |
  | Anytime TD | ANY TD |
  | Field Goals | FG |
  | Team Total Points | TEAM PTS |
  | To Win By | WIN BY |

  Markets with no short form render in full, wrapped, never cut.
- **Hit states on any theme** (revised 2026-09-29, the four-colour model; admin-branding.spec.md). The hit colour is the
  tenant's **Accent**. When Accent would not read, the resolver nudges only its OKLCH lightness (brighter on a dark board,
  deeper on a pale one), keeping its hue, until it clears **3:1** against both the card and the progress track (WCAG
  non-text contrast, the shared `contrastRatio`). It never falls back to another colour. An Accent that already clears is
  used exactly: bears' orange `#e64100` reads on its navy cards as it is.

  It is emitted as:
  - `--hit`
  - `--hit-foreground`: the tenant's Button text when set, else black or white by contrast on the hit shade
  - `--hit-soft` (a 16% tint)
  - `--progress-track` (a tonal step off Main, between the raised surface and a border)

  The hit border, check badge, cell progress fill, top progress fill, the ring gauge and achieved tier dots read `--hit`.
  Buttons read `--primary`, which is Accent exactly.
- **Photos.** A player whose PES entity has `showPhotoUri: false` shows no photo anywhere: board cell, draft card or drafted
  avatar.
- **Legal and opt-in documents open over the gate.** A link in an opt-in's text opens the document **in the same tab, over
  the gate**, as an overlay with its own history entry. Back (the browser's or the overlay's) closes it, and the gate
  underneath was never unmounted, so everything typed is intact. Nothing opens a new tab. Terms and Privacy are the only
  documents today. Tenant opt-in documents plug into the same overlay when Wave 4 stores them.

---

## 5. Test mode and replay (dev only)

Both use real, existing games and never write anything D2C or the consumer app reads: no new games, no prop writes.

- **Test mode**, `B2BContest.testMode: true`, is set only through `PUT /admin/dev/contests/:id/test-mode`. With the dev gate
  open, a test-mode contest:
  - is Open whenever it is in state `open`, regardless of tip-off or props-open times;
  - may pick recent finished games (last 14 days) in the picker;
  - draws its board from every game.

  **No console screen shows or sets it** (Arthur, 2026-09-27: a dev-only switch doesn't belong on a customer screen). It
  is set from a script (the harness) or the browser console, as the runbook shows. With the gate closed, the stored flag
  does nothing.
- **Replay**, `POST /admin/dev/replay { betEventId, delayMs? }`, reads the game's already-resolved **Hit** props (read-only)
  and feeds each prop id down the same path as the watcher (§1.3), in resolution order. It answers with what it did:
  props fed, boards evaluated, lines claimed.
- **Status**, `GET /admin/dev/status`, answers `{ devTools: true, scoring: "queue" | "local" | "off", watcher: "running" |
  "stopped" }`.
- **Fixing a board by hand** (revision 2026-09-28), `node-server/scripts/reconcile-boards.mjs`: runs the reconciler on
  named boards (`--board <id>`, repeatable) or one contest (`--contest <id>`), never everyone's. Dry run by default: it
  lists the boards owed an award; `--apply` awards them through the prize destination of the `.env` it runs with, so it
  is run with the `.env` of the server whose prize worker should deliver. Needs the built server. Rarely needed: any
  owed board is fixed the next time its fan opens it, or at the next sweep.

The dev routes accept a tenant's `org:admin` or OBS staff, and refuse `org:member`.

---

## 6. The E2E harness

`overboard_sports_backend/node-server/scripts/e2e/` holds one scripted, repeatable, dev-only run against a local stack
(backend, console, fan app, prize worker in local mode). Its steps:

1. **Preflight**: `GET /admin/dev/status` answers, and scoring is `local`.
2. **Create the contest in the console's API**, signed in as the `test` tenant's admin test account: `POST
   /admin/contests` as a Draft, then test mode on (`PUT /admin/dev/contests/:id/test-mode`).
3. **Pick a real finished game**: the most recent finished NFL game from the test-mode picker (finished between 14 days
   and 6 hours ago), or the one `--game <betEventId>` names. Then add the game, one prize tier at 1 bingo naming a
   library prize (created once and reused), and publish (Draft → Open).
4. **A fan joins and builds a board**, as a dedicated fixture fan on the fan Clerk dev instance. The fixture is created
   once through the Clerk Backend API (Frontend API sign-up sits behind a captcha) and signs in with its password and
   the test-mode code 424242; the run refuses to start if fan-instance test mode is off.
   - joins the tenant through the gate;
   - `POST /b2b/board/generate` with drafted players.
   - If the board has no line it could win, the run deletes that contest and tries the next game (up to 5).
5. **The late join** (revision 2026-09-28): the game is over, so the board is built on props that already resolved. By
   the time it is read it must hold every line its squares complete (the board-created and board-read triggers, §1.2),
   or the run fails. Then **replay** the game: every trigger may fire, and none awards twice.
6. **Assert**:
   - the board's `claimedLineIndices` holds every winnable line, and replay added none;
   - a `PrizeRedemption` exists for the board, with the tier's prize;
   - the worker marked it fulfilled;
   - the email for it is in the outbox (`.html`, `.txt` and `.json`);
   - `GET /b2b/board/:id` returns the award.
7. **Screenshots** of each stage go to `artifacts/w3-e2e/`, using Playwright with real sessions.
8. **Leave the result**: the run's contest and its scored board stay on `test`, so anyone can open a real bingo and prize
   on the board afterwards. The run prints the board's URL. At the start of the next run, the previous run's contest is
   deleted through the new contest delete, so exactly one harness contest exists at a time. The fixture fan and its
   membership stay.

The manual recipe for Arthur and Nick, with real upcoming games, lives in `documents/runbooks/end-to-end-on-dev.md`.

---

## 7. Satoshi everywhere

Satoshi (Indian Type Foundry, Fontshare, ITF Free Font License v2.0, which permits self-hosting) is the one face in the
console, under every theme including Prime Time, and in the fan app.

- Both frontends **self-host** `Satoshi-Variable.woff2` and `Satoshi-VariableItalic.woff2` (weights 300–900) with the
  license file beside them, as B2C does with its bundled Satoshi files.
- The Fontshare and Google Fonts stylesheets are removed.
- Monospace readouts use the system monospace stack.
- **The font option leaves Brand.** `resolveTheme` resolves every font slot to Satoshi whatever a stored theme names. The
  stored fields stay valid on the wire, and nothing reads them.

## 8. Prize library fixes (Nick's library design kept)

Each fix is proven by a test that failed first.

1. **The migration keys on the contest's organization, not the tier's.** Tiers carry no `organizationId`. The plan now
   derives each tier's tenant from the contest holding it (`contests.prizeTiers`). A tier no contest holds is reported
   and skipped, because its tenant is unknowable. The dedupe key becomes the tier's full content within a tenant, so two
   tiers that differ in value, code, link or expiry never merge.
2. **A prize from a removed tier can be deleted.** "In use" means named by a tier that a contest holds, the same
   definition *Awarded from* uses. Deleting the prize clears `prizeId` from detached tiers that still name it. Their
   content copies stay, because redemptions snapshot the tier.
3. **Tenant delete removes the library.** `deleteAdminTenant` deletes the tenant's `B2BPrize` rows, static codes included.
4. **Finalized contests are final.** A prize edit refreshes only tiers held by a **non-finalized** contest. A finalized
   contest's tiers keep the content they were finalized with. Detached tiers are left as they are.

## 9. Recorded gaps

- **Production finalize-only hits.** D2C's finalize step sends nothing to SQS, so in production a Manual prop that hits
  at finalize never reaches the evaluator. Dev scores it through the watcher. Production needs D2C to publish from
  finalize (a consumer-side change, not ours to make).
- **Unders never resolve** in D2C. A board holding an Under cannot complete a line through it. Recorded, not ours.
- **Personal stacks** get the watcher on their next deploy. Both current stacks predate main.

## Function audit (2026-10-07)

| Where | Reads | Writes |
|---|---|---|
| `reconcileBoard` (shared `scoring/evaluate.ts`) and `mongoScoringStore().loadBoard` | the board, its cells and props, and the contest's `finalized` (`ScoringBoard.contestFinalized`, required) | nothing for a finalized or missing contest (outcome `finalized`); otherwise prize messages, then the claim |
| Board evaluator and prop-update Lambdas, dev watcher and replay, board create and read, the sweep | as above, through `reconcileBoard` | as above |
| Prize worker | queued prize messages | delivers a message queued before Finalize (unchanged) |
| Entries gate (`getB2BContestStatus`) and phase (`contestPhase`, shared `ContestPhase.ts`) | `state`, `stateChangedAt`, the contest's and games' times | none |
| `PATCH /admin/contests/:id` `state` | the stored contest | `state` (+ legacy flags) and `stateChangedAt`; Publish and Move to draft clear the stamp |
| Finalize (bingo, trivia complete step) | the contest, refused 409 `not_ready` unless Closed | `finalized`, `finalizedAt`, `state: "closed"`, `closed: true`, `showContest: true` |

Cut or changed (2026-10-07): **Finalize after every game ends** became Finalize once Closed, so a closed contest with
games still being played can be finalized; Finalize therefore stops every award path in the reconciler (before, only
the sweep skipped finalized contests). **"Close and finalize"** was briefed and dropped by Arthur's correction: closing
and finalizing stay two steps.
