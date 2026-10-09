# Feature Spec: Trivia — the second contest type

**Implements:** PRD [`trivia-game-type.md`](../../../documents/PRD/trivia-game-type.md) (`TRV-*`), except where "Known gaps" says otherwise.

**Depends on:** [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md) (the contest model, the contest-type registry, the builder's Trivia step, the Trivia tab, publish checks, the lock tables, where Finalize appears), [`contest-safety.spec.md`](../../core-modules/1-draft/contest-safety.spec.md) ("Trivia: what locks"), [`admin-prizes.spec.md`](../../core-modules/1-draft/admin-prizes.spec.md) (the prize library), [`admin-sponsors.spec.md`](../../core-modules/1-draft/admin-sponsors.spec.md) (Presented by), [`prize-delivery.spec.md`](../../core-modules/1-draft/prize-delivery.spec.md) (the prize worker), [`admin-surface.spec.md`](../../core-modules/1-draft/admin-surface.spec.md) (scope, `refuseReadOnlyWrite`).

**Status:** Draft (`1-draft`). Written 2026-09-26 as a mock-era design. **Rewritten 2026-10-03 to describe the trivia that shipped** (Nick's trivia build, merged with the console redesign on `integrate/trivia-overhaul`, now `main`). Decisions: D-107 (Presented by), D-113 (preview), D-114 (Trivia tab), D-118 (phase), D-119 (publishing), D-120 (lock), D-123 (names), D-124/D-125 (prize rows and email), D-126 (duplicate protection), D-127 (plain errors), D-129 (unplayable contests). Where this spec and the code disagree, the code is changed to match the spec; the doubts found on 2026-10-03 are under "Known gaps". The field-level contract is [`trivia-data-api-design.md`](trivia-data-api-design.md). **Revised 2026-10-03 (Arthur's rulings, the prize sheet):** trivia shares bingo's one prize sheet ([`fan-prize-sheet.spec.md`](../../webapp/fan-prize-sheet.spec.md)), its won sheet opens from the fan's awards read after Finalize, and the card shows "Prize won" ("Fan: the prize sheet"). **Revised 2026-10-06:** a locked band's prize can't be changed at all (the value exception is gone), Finalize checks the typed name on the server, the fan contest read sends `description`, and the contest card's accessibility is fixed; three Known gaps are closed.

Revised 2026-10-07 (Arthur's rulings): **the last action wins, and Finalize waits for Closed.** An admin's Open now, Close entries or Reopen entries beats the trivia times until a later schedule edit or closing time ([`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), "Opens and closes"), so a contest reopened past its closing time stays open until someone closes it. A `trivia.closesAt` in the past is allowed, locked or not, and closes the contest on save. Closing (by hand or by time) stops new runs; a fan mid-run may finish. Finalize is offered once the contest is closed, whatever its times say, and never while it is open; it also stores the contest Closed. The fan contest read gains `phase` and `openUntilClosed`, and the fan screens decide open or closed from them. Edited in place below.

Repos are named by their roots: shared `obs-b2b-shared/src`, backend `node-server/src` (in `overboard_sports_backend`), console `obs-b2b-admin-frontend/src`, fan app `overboard-b2b-template/src`.

## Overview

A trivia contest is a contest whose `contestType` is `"trivia"` (shared `interfaces/b2b/contestTypes.ts`). A fan plays **runs**: a fixed number of timed multiple-choice questions, each drawn at random from a tag in the tenant's **question bank**. A right answer scores base points plus a speed bonus. A fan may play up to the contest's runs per fan, and their **best** completed run ranks them. **Prize bands** pay a library prize to each fan finishing in a range of places. Overboard staff **Finalize** the contest once it is closed (by hand or by its closing time), which settles the standings and sends the prizes.

There is no live connection: the run is one request per step, and the server owns the clock.

---

## 1. Data model

**The config, on the contest** (`B2BContest.trivia`, shared `interfaces/b2b/B2BTrivia.ts` `TriviaConfig`; Zod in `api/admin/trivia.ts`):

| Field | Rule |
|---|---|
| `scheduleMode` | `"game"` (runs at a game) or `"standalone"` (on its own) |
| `betEventId` | The game, required in game mode. The contest's `allowedBetEvents` follow it |
| `opensAt`, `closesAt` | When runs can **start**. Game mode: a blank time is the game's own (`triviaGameWindow`: tip-off, and tip-off plus the sport's usual length). Standalone: both required ("Set when it opens and closes."). Must close after it opens; the close may be in the past (2026-10-07), which closes the contest on save. Never filled with "now". An admin's manual open or close beats them (the last action wins; §3) |
| `slots` | 1–20 `{ tag }`; a run has one question per slot |
| `runsPerFan` | 1–10 (the console offers 1–3); default 1 |
| `secondsPerQuestion` | 5–60; default 15 |
| `basePoints` | 0–100,000; default 500 |
| `speedBonus` | `{ maxPoints: 0–100,000 (default 500), curve: "linear" }` |
| `networkCreditMs` | 0–30,000; default 5,000 |
| `bands` | ≤50 `{ from, to, prizeId }`, rank order, no overlap; each names a library prize |
| `revealMode` | `"per_question"` only |
| Written by Finalize only | `settledStandings`, `settledAt`, `prizesSentCount`, `finalizedAt`, `finalizeLeaseUntil`, `finalizeCompletedAt` |

A trivia contest stores no `maxParticipants`, no prize tiers and no progress marker. Its times are never the contest's top-level `opensAt`/`closesAt` (those are bingo's; sending them for trivia is refused).

**Collections** (models in shared `models/trivia.ts`, unique indexes created by `node-server/scripts/ensure-unique-indexes.mjs`):

- **`{prefix}trivia_questions`**: `organizationId`, `text` (≤280), `options` (2–6), `correctOptionIndex`, `tags` (≥1, names from the tag list), `idempotencyKey` (one create per console drawer, unique), `createdBy`/`updatedBy`, timestamps. A sponsor question is a question with a sponsor tag; it scores like any other (`TRV-09`).
- **`{prefix}trivia_tags`**: `organizationId`, `name` (lowercase-hyphen, unique per tenant). The question count is computed on read.
- **`{prefix}trivia_runs`**: one per attempt. `contestId`, `clerkUserId`, `runIndex` (unique per fan and contest), `displayName` (the fan's membership display name, else "Fan " and the last four characters of their account id), `status` (`in_progress` | `completed`; at most one open run per fan), `cursor`, `questions[]` (a **snapshot** of each served question: text, shuffled options, the correct index, `servedAt`, `deadlineAt`, the answer, `outcome` `correct|wrong|timeout|late`, `timeMs`, `clientElapsedMs`, points, `repeat`), `score`, `correctCount`, `avgTimeMs`, `forceCompleted`, `startedAt`, `completedAt`.
- **Prize rows** are the shared `{prefix}prize_redemptions` (D5 of the merge plan): `contestType: "trivia"`, `source: { kind: "trivia", runId, bandIndex, finalRank, finalScore }`, a unique key on `{ contestId, userId, contestType, sourceKey }`, and `tierSnapshot` holding the library prize as it was at Finalize.

---

## 2. Admin: Question bank

`/question-bank` (console `pages/QuestionBank.tsx`; server `handlers/admin/trivia-questions.ts`, `trivia-tags.ts`, routes in `trivia-routes.ts`). `org:admin` and staff write; `org:member` reads the same screen with "Only organization admins can change questions." (`TRV-54`). Every write passes `refuseReadOnlyWrite` and is audited (`trivia_question_create`, `_update`, `_delete`, and the tag writes; `TRV-56`).

- **The list**: the console's endless table (Question, Tags, Edited), searched ("Search questions") and filtered by tag (a select listing each tag with its count). Search and tag live in the address. `GET /admin/trivia/questions?tag=&q=&cursor=`.
- **New question / Edit** open the question drawer: the question ("What year did the franchise win its first division title?"), 2–6 answers with a radio for the right one ("Mark the right one. Fans see the answers in a shuffled order."), and tag picks. Checks: "Write the question.", "An answer can't be blank.", "Two answers are the same. Make each answer different.", "Give it at least one tag." `POST /admin/trivia/questions` carries the drawer's idempotency key, so a retried create returns the first question instead of adding another (D-126). `PATCH /admin/trivia/questions/:questionId`.
- **Delete** asks "Delete this question?" ("Contests stop drawing it. Runs fans have already played keep it. This can't be undone."). A hard delete: runs keep their own snapshot.
- **Manage tags** (dialog "Tags"; "A contest picks a tag for each question in a run. Fans never see tag names."): add ("Lowercase letters, numbers and hyphens."; a duplicate is 409 `TRIVIA.TAG_EXISTS`), **Rename** (carried into every question and every contest slot that named it, finalized contests included, in one operation), and **Remove** (disabled while any question carries the tag; the server refuses with 409 `TRIVIA.TAG_IN_USE`).
- **Open and upcoming contests keep their questions** (D-129). Deleting a question, taking a tag off one, or deleting a tag that would leave a published, unfinalized trivia contest that is Upcoming or Open by the shared phase (`activeTriviaContests`; since 2026-10-07 the phase, not the close time, so a contest reopened past its closing time counts) without enough questions (§3, "Enough questions") is refused with 409 `TRIVIA.CONTEST_NEEDS_QUESTIONS`, naming the contests: 'This would leave "Trivia Test" without enough "nfl" questions for every run a fan can play. Add questions to that tag first, or change the contest.' (`refuseLeavingContestsShort`, `node-server/src/util/admin-trivia.ts`).

---

## 3. Contest configuration

The console's screens for a trivia contest are [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md)'s: Basics (no player limit, no times), the builder's **Trivia** step and the contest page's **Trivia** tab (D-114), the **Prizes** step and tab (the bands), and **Sponsors** with the one slot **Presented by** (D-107). Every save is `PATCH /admin/contests/:contestId` with the complete `trivia` config; the server merges it onto the stored one and validates the result whole (`node-server/src/handlers/admin/contests.ts`, `util/admin-trivia.ts` `refuseInvalidTriviaConfig`).

### When it runs

`TRV-29`. **At a game**: one game from the picker; blank Opens and Closes are tip-off and the game's expected end, filled by the console and again by the server (`withGameWindow`); either can be set. A stored time equal to the game's own reads back as blank, so changing the game moves it. Fans see the matchup on the card. **On its own**: no game, both times required, and fans see the contest by its name. A trivia contest's phase (Draft, Upcoming, Open, Closed) comes from these times and the stored state through the shared rule (`getB2BContestStatus`, `ContestPhase.ts`; D-118): it reads Closed after `closesAt` though nobody pressed Close entries. **The last action wins** (2026-10-07; [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), "Opens and closes"): Close entries keeps it closed whatever the times say; Open now or Reopen entries opens it whatever its opening time, and past a closing time that had already passed, until someone closes it, a later closing time arrives, or a schedule edit (a past close, a future open) hands it back to its times. Such a contest is open with `closeTimePassed`, and fans read it as `openUntilClosed` (§5).

### Enough questions

A run draws a different question for each slot, and a fan isn't served a question twice in a contest while unseen ones remain, so every tag must hold **(slots drawing from it) × (runs per fan)** questions (`triviaShortfalls`, shared `B2BTrivia.ts`; D-129):

- **On save** a short config is refused, draft or not: 409 `TRIVIA.TAG_TOO_SMALL`, naming the question: 'Question 1 uses the tag "nfl", which has 5 questions. 2 questions in a run draw from it and each fan gets 3 runs, so it needs 6. Add 1 more question to that tag or lower the runs per fan.' A slot naming an unknown tag is 400 `TRIVIA.UNKNOWN_TAG`; a band naming a prize outside the library, 400 `TRIVIA.UNKNOWN_PRIZE`.
- **On publish** `trivia_short_questions` blocks it (a bank that shrank after saving).
- **The contest read** carries `questionShortfalls`; the contest page shows its warning banner with "Open Question bank".
- **Fans** never see a trivia contest that can't run: the fan list and the Start screen's next game and sponsors skip it (`unplayableTriviaIds`, `node-server/src/util/fan-contest-tab.ts`). A direct link still opens it.
- **The question bank** refuses an edit that would make an open or upcoming contest short (§2).

### Publishing

Publish checks (shared `ContestPublish.ts`): `trivia_incomplete` (no config, no slot, no game in game mode, or not closing after it opens), `trivia_short_questions`, and `no_prize_bands` (no band whose prize is complete). **Its times never block Publish** (D-119; the code applies it to both modes): Review notes "Its close time has passed, so it closes as soon as it's published. Change the close time first?" or "Its open time has passed, so fans can play as soon as it's published." without blocking.

### The lock

Once a fan starts a run (the start stamps `lockedAt`), D-120's table applies, enforced by the server with the shared functions the console also reads (`ContestLock.ts`: `TRIVIA_LOCKED_FIELDS`, `triviaRulesLockViolations`, `triviaBandLockViolations`, `closeTimeViolations`):

| | Once a fan has started a run |
|---|---|
| **Locked** | Question slots (count and tags), seconds per question, base points, speed bonus, network allowance, runs per fan, the game and schedule mode, the open time, the contest type (kind `trivia_rules`; `contestType`) |
| **Close time** | Either direction, past included (2026-10-07), never at or before it opens (kind `closesAt`: "The closing time must be after the opening time.") |
| **Prize bands** | Add a band or widen one; never remove or narrow a saved band (kind `bandRemoved`) or change its prize to any other (kind `bandPrize`: "Fans have started playing, so a band's prize can't be swapped for a different one."; no value-based exception since 2026-10-06) |
| **Free** | Name, description, internal note, banner, Presented by sponsor, reveal mode |

How the console shows it is [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md) ("Trivia tab", "Prizes tab").

---

## 4. The run

Fan routes under `/b2b/trivia` (`node-server/src/routes/trivia/index.ts`, handlers `handlers/trivia/`), all `requireMembership`, tenant from `?tenant=`. The play gate (`refuseTriviaPlay`, `handlers/trivia/shared.ts`) answers a draft or missing contest as 404 `CONTEST.NOT_FOUND`, a non-trivia one `CONTEST.NOT_PLAYABLE_HERE`, and, for play, a finalized one (or one whose Finalize has begun) `CONTEST.FINALIZED`. Every refusal carries plain fan copy from shared `errors/copy.ts` (D-127).

- **Start** `POST /b2b/trivia/contests/:contestId/runs`. The entry gate first: an unmet blocking opt-in or required field refuses it, as on a bingo board, and the fan app sends the fan to the gate. A fan with an open run gets that run back (an open run stays playable after the contest closes, by hand or by time, until Finalize). Otherwise the contest must be open by the shared phase (`refuseTriviaPlay` reads `getB2BContestStatus`, so it follows the last action: a manual close refuses, a manual open admits; `CONTEST.NOT_OPEN` while Upcoming, `CONTEST.CLOSED` once Closed) and a run left (`TRIVIA.NO_RUNS_LEFT`). Closing stops new runs only. The run is composed now (`game/trivia/compose.ts`): one question per slot from its tag, never twice in a run, never one this fan was served in this contest while an unseen one remains (else the least-recently-served, flagged `repeat`; `TRV-42`), options shuffled (`TRV-18`), each question snapshotted. Question 1 is served at once. A double tap is caught by the one-open-run index and answered with the run already open (D-126).
- **Read** `GET /b2b/trivia/runs/:runId` (the fan's own runs only).
- **Serve** `POST /b2b/trivia/runs/:runId/serve { index }` (serve and answer pass the play gate in mode "play", with no window check, so a fan mid-run may finish after the contest closes): only the next index, only once the current question is resolved; serving the current one again returns its original clock. The clock starts when the server serves it (`servedAt`, `deadlineAt = servedAt + secondsPerQuestion`; `TRV-21`).
- **Answer** `POST /b2b/trivia/runs/:runId/answer { index, selectedOptionIndex, clientElapsedMs? }` (`clientElapsedMs`: the fan device's own elapsed ms, 0..120000, optional for old clients). First write wins (`TRV-16`): the same answer again returns the stored reveal; a different one is 409 `TRIVIA.ALREADY_ANSWERED` carrying the stored reveal. Judged in order: a `clientElapsedMs` over the time is a `timeout`; server elapsed over `secondsPerQuestion + networkCreditMs` is `late` (0, the fan sees a connection message); then wrong; then correct, scored on the fan's elapsed time bounded by server elapsed.
- **Timeouts are lazy**: an unanswered question past its deadline plus the allowance is written as a timeout before anything reads the run.
- The current question never carries its answer; `correctOptionIndex` travels only in the reveal of a resolved question (`TRV-34`).
- The last answer completes the run: `score`, `correctCount`, `avgTimeMs` and `completedAt` are written once and never recomputed (`TRV-22`).
- **Summary** `GET /b2b/trivia/runs/:runId/summary`: the run's resolved questions with answers and points, `isBest`, and, before Finalize, the fan's provisional rank and points to the next band.

### Scoring

`triviaQuestionPoints` (shared `B2BTrivia.ts`, used by the server and the fan app's rules): a right answer earns `basePoints + round(maxPoints × (T − t) / T)`, with `T = secondsPerQuestion × 1000` and `t` the fan's elapsed time (`clientElapsedMs`, else server elapsed) clamped to `[0, server elapsed]`. A wrong answer, a timeout or a `late` answer earns 0 (`TRV-19`, `TRV-20`). The network allowance covers the answer's arrival only; it no longer reduces the bonus of an honest fan (`TRV-21`, revised 2026-10-07).

---

## 5. Standings

`game/trivia/standings.ts`: each fan's best completed run counts (`TRV-25`), ordered by score, then the earlier `completedAt`, then run id, so ranks are strict and ties go to whoever finished first (`TRV-28`). Rows are named by the fan's membership display name, never a real name (D-099, D-123; `handlers/trivia/names.ts`).

- **Live** standings are computed from completed runs and cached 5 seconds per contest (15 until 2026-10-09; the standings screen polls every 6 s, so N fans polling cost one compute per 5 s per server process); a completed run clears the cache. The response carries `Cache-Control: private, max-age=3`. Names are looked up only for the rows returned (`top`, `aroundMe`, `leader`), never the whole set.
- **Settled** standings are written once by Finalize (`trivia.settledStandings`) and never recomputed (`TRV-30`).
- `GET /b2b/trivia/contests/:contestId/standings?top=10&around=1`: `final`, `closesAt`, `phase`, `finalizedAt`, `players`, `me` (`rank`, `score`, `bestRunId` once the fan has a run, and always `runsUsed`, `runsPerFan`, `currentBand`, `finalBand` once final; 2026-10-09, built from the same ranked rows as the list), `top`, `aroundMe`, `leader` (rows carry `isMe`, never an account id), and each band with its prize card, `cutoffScore` (the score holding the band's last place) and the fan's status in it (`in`/`reachable` with points needed, or `won`/`missed` once final). The standings screen asks for `top=0&around=0`: it draws no rows, so one cache entry per contest.
- `GET /b2b/trivia/contests/:contestId/me`: runs used of runs per fan, players, best score and run, rank, current band, points to the next band (before final), the open run if any, and once final the band won and the prize row's status.
- `GET /b2b/trivia/contests/:contestId/runs`: the fan's runs with outcomes and the best flagged.
- `GET /b2b/trivia/contests/:contestId`: the contest as fans read it (`buildTriviaContestPublic`): name, the fan-facing `description` (never the console's legacy note, `contestDescription`; 2026-10-06), schedule, question count, timing, scoring, bands with prize cards (never a prize's static code), the Presented by sponsor and the player count (fans with a run). Since 2026-10-07 (`TriviaContestPublic`) it also carries `phase` (`"upcoming" | "open" | "closed"`, through `contestStatusOfPhase`; once a Finalize has claimed the contest it reads `"closed"`) and `openUntilClosed: true` when the contest is open only by a manual open made after its closing time had passed (the phase view's `closeTimePassed`), so a fan screen doesn't count down to a spent close.

---

## 6. Finalize and prizes

**Finalize** `POST /admin/contests/:contestId/trivia/finalize` (`node-server/src/handlers/admin/trivia-finalize.ts`): Overboard staff only (`refuseNonObsStaff`), offered once the contest is published and closed, by hand or by its closing time, whatever its times say (`readyToFinalize`, `util/contest-console.ts`; revised 2026-10-07). Never on an open contest, including one reopened past its closing time: a not-ready contest is 409 `not_ready`, "Close this contest before you finalize it." The body is `{ confirmName }` (shared `postAdminTriviaFinalizeRequestSchema`; since 2026-10-06): the contest's name as typed in the dialog, compared trimmed and ignoring case (`sameContestName`, as bingo's Finalize and contest delete do) before anything is audited or written; a mismatch is 400 `confirm_name_mismatch`, "The contest name you typed doesn't match." Audited `trivia_finalize` before anything is written. Then:

1. **Claim** a five-minute lease and stamp `trivia.finalizedAt`. A second Finalize while the lease is live is 409 `finalize_running` (D-126). From the claim on, fans can't start, serve or answer.
2. **Stop open runs where they stand**: every unresolved question becomes a timeout worth 0 (`forceCompleted`); what the fan answered counts.
3. **Settle the standings** once.
4. **Award**: one prize row per fan inside each band, with the library prize snapshotted now (its own "Provided by" credit, and the contest's Presented by sponsor kept separately, D-124), and one queue message per row still waiting. The prize worker sends it like any bingo prize (`prize-delivery.spec.md`). A band whose prize has been deleted is skipped.
5. Mark the contest `finalized` with `finalizedAt` and the count sent, and store it Closed (`state: "closed"`, with the legacy `closed: true`, `showContest: true`; 2026-10-07). Finalize is never reversible.

Every step is idempotent, so pressing Finalize again after a failure resumes it. No prize is sent before Finalize, and standings don't settle on their own at the close time.

The console's Overview rail reads (`lib/finalize.ts`): ready, "The contest is closed. Anyone still answering is stopped where they stand."; waiting, "Finalize opens as soon as the contest is closed. Close entries to finalize it now." (a draft: "A draft can't be finalized. Publish it first."); a tenant admin or member, "Overboard finalizes the contest once it's closed."

**The email** speaks places: `{rank}` reads "3rd place"; for a trivia win `{bingos}` reads the place too (`PRIZE_EMAIL_WORDING_TOKENS`, shared `interfaces/b2b/PrizeEmail.ts`). Prize rows say `contestType` (D-125).

---

## 7. Fan screens

Routes in the fan app's `AppRoutes.tsx`, all signed in: `/trivia/:contestId` (play), `/trivia/:contestId/standings`, `/trivia/:contestId/runs`, `/trivia/:contestId/runs/:runIndex`. Pages read through one data source (`lib/triviaDataSource.ts`), which is the API (`lib/triviaApiSource.ts` over `store/api/triviaApi.ts`) in every build but a dev build with a `?trivia=` scenario chosen (see Known gaps). Dates go through `lib/dates.ts` (D-128). One trivia read polls: the standings (below). The store calls RTK's `setupListeners`, so `refetchOnFocus` and `refetchOnReconnect` work and a polled query pauses while the page is hidden (2026-10-09; before that the flags were set but never wired).

### Fan: contest list

A trivia contest is a card in the one Contests list (`TRV-51`; `components/contests/TriviaContestCard.tsx`), in Live & Upcoming or Past by the shared phase. Its title is the contest's name, its subtitle the matchup and tip-off (none on its own), then the description. The card reads the list row (`GET /b2b/contest/list-contests`) plus the contest and `me` reads, and the fan's awards (`GET /b2b/prizes/awards`, read once for the whole list). States, first match wins: **Prize won** (any delivery status, from the fan's awards read `GET /b2b/prizes/awards`: "You won {prize}", or "You won {n} prizes", with "See your prize", which opens the won prize sheet, and "See results"), **Live** with "Question 3 of 5 · 1,240 pts so far" ("Resume run"), **Final** ("Finished #N", "See results"), **Closed · awaiting results**, entered with no runs left ("Closes {time}", "View Standings"), entered with runs left ("Play Again"), **Open** with "Top prize: {name}" ("Play Now"), **Upcoming** with "Opens {time}" ("View rules", which opens the Rules screen). A "Closes {time}" chip whose time has passed is hidden (2026-10-07: a contest reopened past its closing time has no close to show).

**Open or not, on every fan screen** (2026-10-07; fan app `lib/triviaOpening.ts`). The contest read's `phase` decides: `triviaIsOpen` is true while the phase is open, and an open contest closes at `closesAt` while the screen is up unless `openUntilClosed`; an upcoming one opens at `opensAt`. An older server that sends no `phase` falls back to the times. `triviaAwaitsOpening` (the Start run countdown) holds only while upcoming, or with no phase; `triviaClosedAwaitingResults` reads the closed phase before Finalize. The play page, the Rules screen's prize-sheet standing, the standings page, Your runs and the console preview all read these.

**Accessibility (2026-10-06).** A card is a plain container, never a `role="button"` wrapping other buttons. Its own control is its title: a real `<button>` inside the heading, named by the contest's name, whose `::after` stretches over the whole card, so a tap anywhere opens the card and the keyboard focus ring is drawn around the whole card. The card's other buttons (its action and "See your prize") sit above the stretch (`relative z-10`) and keep their own clicks and keys. Look and behaviour are unchanged. The shell is shared with bingo's card (`components/contests/ContestCardShell.tsx`).

### Fan: trivia play

`pages/trivia/TriviaPlayPage.tsx`, driven by the server's run `phase`:

- **Rules** (`screens/RulesScreen.tsx`): "Ready, {first name}? · {contest}", "Get it right. Get it fast.", the matchup, question count and fans playing, the Presented by sponsor, four rules ("500 points for a correct answer", "Up to 500 more for answering fast", "15 seconds per question", "Your first tap is final"), the prize bands, each row the band's places and the prize's name (a tap opens the prize sheet's Info body for that band), and the button, first match wins (2026-10-07): "Resume run", "Opens {time}" or, in the last minutes, "Opens in 4:59" (disabled; only while upcoming, `triviaAwaitsOpening`), "Contest closed" (`triviaIsOpen` false), "No runs left", else "Start run". An open run resumes straight away, closed or not. The prize sheet's "Your best" standing follows the same open-or-closed answer.
- **Question and reveal** (`screens/QuestionScreen.tsx`): the running score, the countdown and its bar (anchored on the device when the question arrives, never above the time per question; the bar turns the destructive colour in the last quarter), the Presented by sponsor, the question and its answers. The first tap locks every answer; the reveal says "Correct", "Not this time" or "Time's up" with the points and "Answered in 3.2 s" or "Scores nothing · no answer", then "Next question" or "Finish run". When the clock runs out the page waits out the network allowance and re-reads the run.
- **Run complete (retired 2026-10-09).** Answering the last question lands the fan on Standings (`navigate(…/standings, { replace })`); the last answer's write invalidates the standings read, so the first read there is fresh. The old screen's per-question list lives on as Run review (below). Rationale: fans found two screens with the same numbers busy, and "See standings" was one tap nobody needed.
- **Ended**: once Finalize has begun, "This contest has ended. Your answers so far count toward the final standings." with "See standings". Other refusals are toasts with the shared copy; a start before the server opens it says "Not open yet".

### Fan: trivia standings (v4, 2026-10-09)

The one screen after a run, and the live hub while the contest is open. Design: [Trivia & Contest Cards — Final](https://claude.ai/artifact/3YvPe13rhXBsFjadKPBF3K) (rows 1–2; exploration on the scratch canvas). Plan: workspace `trivia-standings-v4-plan.md`. `pages/trivia/TriviaStandingsPage.tsx`, state in `lib/triviaStandingsState.ts`.

**What a fan sees, top to bottom.** "Contests" back link and one pill ("Locks 9:40 PM" with a live dot while open; "Closed · awaiting final"; "Final" with a check); the contest's name and "Standings"; the rank as the hero ("#212", with "of 412 fans · 3,120 pts" under it); one status card; the prize bands; "Review your answers" (only with a completed run; in the body, not the footer, so the iPhone home bar never covers it); one sticky button.

**The live experience.** While the contest is open and not final, the standings read polls every 6 s (`pollingInterval`, `skipPollingIfUnfocused`, `refetchOnMountOrArgChange`), stops on unmount, pauses while the page is hidden, and the store's `refetchOnFocus` refetches once the moment the fan comes back from a locked phone. Rank and fan count are `RollingNumber`s: a changed value rolls once from old to new (400 ms, a 1 s colour flash: green when things got better, red when the rank got worse) and nothing moves when a poll returns the same numbers (RTK's structural sharing, `selectFromResult`). `prefers-reduced-motion` turns the roll and flash off. There is no realtime channel; 5–6 s freshness is the intent.

**Five states, all from the server.** `live` (open, tries left): status "You're on track for a {prize}!" / "Not yours until standings lock at {time}." / "Hold {from}–{to} until then." behind a lock icon in a slowly turning ring, or, outside every band, "Not in a prize spot yet" / "Top {last band's to} win." / "Locks at {time}."; button "Play again · N left" ("Play now" before a first run, "Resume run" with an open run). `no-tries` (open, `runsUsed ≥ runsPerFan`): the same screen, the button a greyed "No tries left"; still polling. `pending` (closed by hand or by time, not yet finalized): "Standings are locked" / "Prizes are confirmed once results are final.", "Back to contests". `final-won`: green card, "You won a {prize}!" / "Finished {rank}." / "Your pickup code is in your email.", "Won" on the band, "Back to contests", no polling. `final-missed`: grey card, "Just missed the {prize of the band above}" / "Finished 74th." / "70th was the cutoff.", "Missed by N" on that band only. The lock time prints as "9:40 PM" when it locks today, else the app's relative date; a contest open until an admin closes it says "Live".

**Decisions (owner, 2026-10-09).** "In line for" / "on track" never says "won": the word *won* appears only once `final`. A band row is places as the eyebrow ("Top 10", "11th–30th"), the prize's name, a chevron, and a chip only where the fan stands ("You", "Won", "Missed by N"); no gap numbers, no sponsor line, no progress slider, no "around you" list (the exploration showed every one of them cost a glance and answered nothing the status card doesn't). Rules and Standings draw the same rows (`components/trivia/PrizeBandList.tsx`; Rules adds a "Prizes" eyebrow). A tap opens the prize sheet's Info body. "Only your best run counts" and the tries used are said once, on the button.

### Fan: your runs and run review

`pages/trivia/YourRunsPage.tsx` (contest, `me`, runs): every run newest first with its score, when it was played, what went wrong ("Q2, Q4 wrong · Q3 timed out" or "All correct") and "Best" on the run that counts, plus runs left; a contest open past its closing time reads "contest still open" in place of its close time (`openUntilClosed`; 2026-10-07). `pages/trivia/RunReviewPage.tsx` (`/runs/:runIndex`, 1-based) shows that run's answers read-only (`screens/RunReviewScreen.tsx`, 2026-10-09; the retired Complete screen's list): "Run 2 · {when}", "Your answers", the score and "4 of 5 correct", each question with a tick or cross and its points, no rank and no button; the back link is "Your runs". Standings reaches it through "Review your answers" → Your runs → a run's "Review".

### Fan: the prize sheet (revised 2026-10-03)

Trivia shares bingo's one prize sheet ([`fan-prize-sheet.spec.md`](../../webapp/fan-prize-sheet.spec.md) `FLOW-31`, `FLOW-51`, `FLOW-52`; `components/prize/`), which replaced trivia's own `PrizeDetailSheet` on 2026-10-03:

- **Info, from a tap:** a prize row on the Rules screen, or a band on Standings, opens the sheet for that band: the band's places as the chip ("11th–30th"), the prize's name, image, description, "Winners get this by email once results are final." (", with a code," when the prize has one), the prize's own "Provided by" sponsor (never the contest's Presented by sponsor), and, while results aren't final, "Your best: 3,120 · #212" with "+290 to reach 11th–30th" or "You're in". The value, redemption and shipping tiles are gone (D-086), and so is the Rules row's "$150 value · Shipped to you".
- **Won, by itself:** a trivia win lands at Finalize, usually after the fan has left, so the fan's awards are read on the server (`GET /b2b/prizes/awards`) and the won sheet opens the next time the fan is in the app, on any device, until they close it (`seenAt`). It waits while a run's question screen is up.
- **Standings, once final (revised 2026-10-09):** the status card says "You won a {prize}!" and the band carries "Won"; the won sheet opens from the contest card or on its own (below), no longer from a button in a sentence on Standings.
- **The card:** "Prize won" for any delivery status, "You won {prize}" and "See your prize", replacing "Prize sent" and its "Claim your prize" button, which showed only once the email had gone.
- **After a run (2026-10-09):** there is no Complete screen; the fan is on Standings, whose status card carries the "not yours until standings lock" line.

The band prize card (`triviaPrizeCardSchema`, the shared fan prize plus `prizeId`, `prizeDescription` and `handlerId`) carries `hasCode` and `providedBy` and no longer the four dormant fields (approximate value, redemption method, location, window), and never the code itself.

### Preview

The console's preview drawer runs these same screens on the contest's data (`GET /admin/contests/:contestId/preview`, its trivia section built by `node-server/src/handlers/admin/preview-trivia.ts`; fan app `src/preview/trivia.ts`), nothing reaching a server. Tabs: Contest list, Rules, Questions, Standings and Prize (D-113; console `lib/preview/trivia.ts`). Results (2026-10-09): the frame no longer has a Results screen, since a finished run lands on Standings; `navigate('results')` shows Standings and the frame reports `standings`. The console still lists a Results tab until it is removed (Known gaps). Prize (2026-10-03) is one band's prize sheet over the standings, a Band control choosing the band and an Info / Won control its body ([`admin-preview.spec.md`](../../core-modules/1-draft/admin-preview.spec.md)). The preview's start refusal (`preview/trivia.ts`) reads open or closed through `lib/triviaOpening.ts`, as the live screens do (2026-10-07).

---

## Rules

1. **Trivia has its own collections** (questions, tags, runs) and its config and bands on the contest; it shares the contest, the prize library, the prize rows and the prize worker with bingo.
2. **A prize is a library record; a band only names it.**
3. **The server owns correctness, scoring, the clock and rank** (`TRV-34`); the fan never receives an unresolved question's answer.
4. **A fan's first answer is the only one that counts**, enforced by the write.
5. **A run's score is final when it completes; standings are final when Finalize settles them.** Neither is recomputed.
6. **No prize is sent before Finalize**, which is staff only, idempotent and resumable.
7. **What fans play and win under locks at the first run** (D-120, §3).
8. **A trivia contest runs only when every tag holds (slots drawing from it) × (runs per fan) questions**: checked on save, on publish and on question-bank edits, and a contest that can't run is hidden from fans.
9. **Standings show display names**, never real names.

## Known gaps

- **Console preview still offers a Results tab** (2026-10-09): the fan frame retired the Results screen with Standings v4 and answers `navigate('results')` with Standings. The console's `lib/preview/trivia.ts` tab list and [`admin-preview.spec.md`](../../core-modules/1-draft/admin-preview.spec.md) should drop it.

Where the code differs from the PRD or a decision (found 2026-10-03; for Arthur and Nick to rule on):

- **Prizes are sent by Overboard staff, not a tenant admin.** `TRV-32` asks for a tenant admin's "send prizes" action after standings settle at close; the code settles and sends in one staff-only Finalize (merge plan D2). `TRV-45`'s per-band review isn't built.
- **No starter bank** (`TRV-07`, `TRV-55`): every tenant writes its own questions.
- **No substitute questions** (`TRV-59`): the network allowance is configurable (default 5 seconds), but a timed-out question isn't replaced.
- ~~**A locked band's prize swap.**~~ **Closed 2026-10-06**: the value branch is gone from `triviaBandLockViolations`, so any change of a locked band's prize, or its removal, is `bandPrize`, "Fans have started playing, so a band's prize can't be swapped for a different one." The server's `toLockableBands` no longer reads prize values.
- ~~**Trivia Finalize doesn't check the typed name on the server**~~ **Closed 2026-10-06**: the endpoint takes `{ confirmName }` and checks it before anything is audited or written ("6. Finalize and prizes").
- ~~**The fan contest read sends `contestDescription`**~~ **Closed 2026-10-06**: `buildTriviaContestPublic` sends `description`, the fan projection (`FAN_CONTEST_FIELDS`) no longer carries `contestDescription`, and the trivia branch of the contest players read sends `description`.
- **The dev mock data source remains** (`lib/triviaMock.ts`, `triviaMockSource.ts`, `TRIVIA_MOCK_ENABLED`: dev builds only, never test or production, chosen by `?trivia=` or the DEV panel and remembered in local storage). A developer left in a scenario sees mock contests instead of real ones.
- **`GET /admin/contests/:contestId/trivia/standings`** exists and no console screen calls it.

## Function audit (2026-10-03)

| Screen | Reads | Writes |
|---|---|---|
| Question bank (console) | `GET /admin/trivia/questions`, `GET /admin/trivia/tags` | `POST`/`PATCH`/`DELETE /admin/trivia/questions…`, `POST`/`PATCH`/`DELETE /admin/trivia/tags…` |
| Trivia step and tab, trivia Prizes, Sponsors (console) | See [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), "Function audit" | `PATCH /admin/contests/:contestId` `trivia` |
| Finalize dialog (console, staff) | the contest read's `readyToFinalize` (since 2026-10-07: published and Closed) | `POST /admin/contests/:contestId/trivia/finalize` `{ confirmName }` (2026-10-06); 409 `not_ready` unless Closed |
| Contest card (fan) | `GET /b2b/contest/list-contests`, `GET /b2b/trivia/contests/:id`, `…/me`; `GET /b2b/prizes/awards` for "Prize won" (2026-10-03) | none ("See your prize" opens the won sheet) |
| Play (fan) | `GET /b2b/trivia/contests/:id`, `…/me`, the list row (matchup) | `POST …/contests/:id/runs`, `POST /b2b/trivia/runs/:runId/serve`, `…/answer`; `GET /b2b/trivia/runs/:runId`, `…/summary` |
| Standings (fan) | `GET …/contests/:id`, `…/me`, `…/standings` (polled every 6 s while open and not final, `top=0&around=0`; 2026-10-09) | none |
| Prize sheet (fan, shared with bingo; 2026-10-03) | Info: the band's prize card from the contest or standings read, and `me` for the progress strip. Won: `GET /b2b/prizes/awards` (on load, on focus, every 30 seconds) | `POST /b2b/prizes/awards/:awardId/seen` per unseen award when the won sheet closes ([`fan-prize-sheet.spec.md`](../../webapp/fan-prize-sheet.spec.md)) |
| Your runs, run review (fan) | `GET …/contests/:id`, `…/me`, `…/runs`, `GET /b2b/trivia/runs/:runId/summary` | none |

**Additions (2026-10-07, contest controls):**

| Screen | Reads | Writes |
|---|---|---|
| Rules and play (fan; `TriviaPlayPage.tsx`, `RulesScreen.tsx`) | `GET /b2b/trivia/contests/:id` `phase`, `openUntilClosed`, `opensAt`, `closesAt`, through `lib/triviaOpening.ts` | `POST …/contests/:id/runs` (refused unless open by the phase) |
| Standings (fan) | as above, plus `…/standings` | none |
| Your runs (fan) | as above, plus `…/runs` | none |
| Contest card (fan) | as above; a passed "Closes {time}" chip is hidden | none |
| Console preview (`preview/trivia.ts`, `TriviaComplete`) | the preview read's trivia section, through `lib/triviaOpening.ts` | none |
| Trivia tab Closes (console) | the contest read's `trivia` times | `PATCH` `trivia`; a past close allowed (help "This time has passed, so the contest closes as soon as you save."), a close at or before the open refused |
| Header, past-close banner, reopen dialog (console) | [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), "Function audit additions (2026-10-07)" | `PATCH` `state` |

Server: `refuseTriviaPlay`'s start gate reads `getB2BContestStatus` (last action wins); serve and answer use mode "play" with no window check; `activeTriviaContests` (`util/admin-trivia.ts`) uses the phase; the trivia finalize loader and `util/admin-trivia.ts` project `stateChangedAt`; Finalize's complete step writes `state: "closed"`.

Cut or changed (2026-10-07): **"Close and finalize"** was briefed and dropped by Arthur's correction (Finalize only once closed). **Finalize at the close time** became Finalize once closed by any means. **A past `trivia.closesAt` refused** became allowed; **close after open** is kept, since a close at or before the open is no window at all and no admin needs it.

**Cut from the 2026-09-26 mock-era design, and why:**

- **The create drawer's game-type picker and the contest drawers**: replaced by the builder and the contest page, where trivia has its own step and tab (D-114).
- **A separate `trivia_prize_redemptions` collection**: trivia rows live in the shared prize rows with `contestType` and a source key, so one worker, one delivery queue and one email serve both types (merge plan D5, D-125).
- **The tenant "Send prizes" section and `requireAdminReverified`**: Finalize does it, staff only, without re-authentication (merge plan D2; the 2026-09-28 ruling).
- **`seenQuestionIds` on the run**: the served history across a fan's runs does the same job, and a repeat is used only once a tag has nothing unseen (flagged, never refused).
- **The `abandoned` status and never-resolving runs**: questions time out lazily, an open run resumes, and Finalize closes any run left open.
- **Reveal-mode choice**: only a reveal after every question exists, so no control is shown.
- **The starter bank, the "Written here / Copied" filter, the Repeats card and the drawer's edit history line**: not built; the bank shows Edited dates, and history is in the audit log.
- **A per-contest substitute cap**: not built (Known gaps).
- **The mock screens' hardcoded data**: the screens read the API; only the dev scenario source remains.
- **The prize detail sheet's four tiles** (approximate value, redemption, location, window), its "11th–30th win" chip and "Sponsored by" credit: replaced on 2026-10-03 by the shared prize sheet (D-086, D-124; [`fan-prize-sheet.spec.md`](../../webapp/fan-prize-sheet.spec.md), function audit).

## References

- PRD: [`trivia-game-type.md`](../../../documents/PRD/trivia-game-type.md); decisions D-107, D-113, D-114, D-118 to D-120, D-123 to D-129 (Arthur's vault).
- [`trivia-data-api-design.md`](trivia-data-api-design.md) (the field-level contract), [`trivia-overhaul-merge-plan.md`](trivia-overhaul-merge-plan.md) (D1–D6 of the merge).
- [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), [`contest-safety.spec.md`](../../core-modules/1-draft/contest-safety.spec.md), [`admin-prizes.spec.md`](../../core-modules/1-draft/admin-prizes.spec.md), [`admin-sponsors.spec.md`](../../core-modules/1-draft/admin-sponsors.spec.md), [`prize-delivery.spec.md`](../../core-modules/1-draft/prize-delivery.spec.md).
- Code: shared `interfaces/b2b/{B2BTrivia,ContestLock,ContestPublish,contestTypes}.ts`, `api/admin/trivia.ts`, `api/b2b/trivia.ts`, `models/trivia.ts`; backend `routes/trivia/index.ts`, `handlers/trivia/`, `game/trivia/`, `handlers/admin/{contests,trivia-questions,trivia-tags,trivia-finalize}.ts`, `util/admin-trivia.ts`; console `pages/QuestionBank.tsx`, `pages/contests/{TriviaTab,TriviaPrizesTab}.tsx`, `components/contests/{triviaFields,triviaBands}.tsx`; fan app `pages/trivia/`, `components/contests/TriviaContestCard.tsx`, `lib/triviaDataSource.ts`.
