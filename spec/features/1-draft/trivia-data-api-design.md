# Trivia: data and API design (high level, for validation)

The source is `trivia-game-type.spec.md` (Draft), with owner decisions applied on top (see F). Prefix `${p}` means the tenant collection prefix. Findings from the admin-UI and shared-package cross-check are folded into each section.

## A. Collections

**Discriminator.** `GAME_TYPES = ["bingo","trivia"] as const` in shared `interfaces/b2b/B2BContest.ts` (today it is `["bingo"]`). The Mongoose `enum` in `models/b2b.ts` (which currently rejects `"trivia"`), the contest Zod schema in shared `src/api/admin/games.ts` (`postAdminContestRequestSchema`, `PATCHABLE_CONTEST_FIELDS`) and the inverted contract test in `api/admin/__tests__/games.test.ts` all change in the same PR. `B2BContest` gains `trivia?: TriviaConfig`, present if and only if `gameType === "trivia"` (new `superRefine`). `gameType` stays create-only; `trivia` must be added to the patchable set (today no game-specific settings are patchable; bingo tiers go through `/prize-tiers`). `refuseJoin`'s `!== "bingo"` check in `createBoard.ts` stays.

**Bingo-only fields that become optional for trivia.** In `B2BContest` these are required today and must become optional (and be ignored/defaulted for trivia): `allowedBetEvents`, `prizeTiers`, `maxParticipants`, `numberParticipants` (dead data), `maxEntriesPerPerson` (trivia uses `runsPerFan`), `twoTeamsNotRequired`. `showContest`, `finalized`, `contestName`, `organizationId` stay required and shared. `trivia: TriviaConfig` is additive to the base contest fields; `players` and `runsCompleted` come from `trivia_runs`, not the contest doc. Note `getB2BContestStatus` derives Open/Upcoming from `allowedBetEvents`; for trivia it must branch to `opensAt`/`closesAt` (Finished/Closed checks on `finalized`/`closed` are unchanged).

Existing bingo collections (`bingo_boards`, `bingo_prize_tiers`, `bingo_prize_redemptions`) are written unconditionally; nothing branches on `gameType` at the DB layer today, so the trivia collections below are new plumbing.

**`${p}trivia_questions`** (tenant). Mirrors the `prizes` library doc.
| field | type | notes |
|---|---|---|
| _id, organizationId | ObjectId, string | |
| text | string | 1–280 chars |
| options | string[2..6] | |
| correctOptionIndex | number | admin-only, never sent to the fan before the answer |
| tags | string[] | tag names, validated against trivia_tags |
| createdBy, updatedBy, createdAt, updatedAt | | returned by POST/PATCH so TRV-56 "every change is recorded" is backed by data; the list view shows only updatedAt |
Indexes: `{organizationId:1, tags:1}`, `{organizationId:1, updatedAt:-1}`.

**`${p}trivia_tags`**: `_id, organizationId, name (lowercase-hyphen), createdBy, createdAt`. Unique `{organizationId, name}`. `questionCount` is computed on read with an aggregate, not stored.

**`${p}trivia_runs`**. Mirrors `bingo_boards` (one doc per fan attempt).
| field | type | notes |
|---|---|---|
| _id, contestId, organizationId, clerkUserId, runIndex | | runIndex starts at 0 |
| displayName | string | snapshot at run start (rule in C) |
| status | "in_progress" \| "completed" | no "abandoned" |
| cursor | number | index of the current question |
| questions[] | TriviaRunQuestion | see below |
| score, correctCount, avgTimeMs | number | final at completion |
| forceCompleted? | boolean | set when Finalize closed it |
| startedAt, completedAt? | Date | |

`TriviaRunQuestion = { slotIndex, questionId, text, options (shuffled copy), correctOptionIndex (in shuffled order), repeat?: true, servedAt?, deadlineAt?, answeredAt?, selectedOptionIndex?, outcome?: "correct"|"wrong"|"timeout"|"late", timeMs?, clientElapsedMs?, basePoints?, speedBonus?, points? }`. The question is snapshotted so later bank edits don't change history or the review screen.

Indexes: unique `{contestId, clerkUserId, runIndex}`; partial unique `{contestId, clerkUserId}` where `status:"in_progress"`; `{contestId, status, score:-1, completedAt:1}` for standings.

Seen-exclusion is computed from the fan's runs (`distinct questions.questionId` over `{contestId, clerkUserId}`) rather than a stored `seenQuestionIds`.

**Prize redemptions.** Trivia does not get its own collection; it writes into the generalized `prize_redemptions` described in H, with `gameType:"trivia"` and `source:{kind:"trivia", runId, bandIndex, finalRank}`, plus `finalScore` and `prizeSnapshot`. One row per fan per contest.

**Contest additions**: `trivia: TriviaConfig`, and on finalize the existing `finalized`/`finalizedAt` flags plus `trivia.settledStandings` and `trivia.prizesSentCount`. `lockedAt` is reused.

## B. TriviaConfig

```ts
interface TriviaConfig {
  scheduleMode: "game" | "standalone"; // admin form's schedule toggle
  betEventId?: string;                 // scheduleMode "game": card matchup + opens/closes defaults
  opensAt: string; closesAt: string;   // ISO, required; govern ONLY when runs can start
  slots: { tag: string }[];            // 1..20; run length = slots.length
  runsPerFan: number;                  // 1..10, default 1
  secondsPerQuestion: number;          // 5..60, default 15
  basePoints: number;                  // default 500
  speedBonus: { maxPoints: number;     // default 500
                curve: "linear" };     // V1 fixed
  networkCreditMs: number;             // default 5000; UI edits seconds and converts
  bands: { from: number; to: number; prizeId: string }[]; // sorted, non-overlapping, from≥1
  revealMode: "per_question";          // V1 fixed; no UI control
  sponsor?: { name: string; logoUrl?: string; websiteUrl?: string }; // placeholder, per contest
  settledStandings?: TriviaStanding[]; // written once by Finalize
  prizesSentCount?: number;
}
```
The admin UI's `speedBonusMax` adopts the nested `speedBonus.maxPoints`; `networkCreditSeconds` converts to `networkCreditMs` at the boundary; `substitutionsPerRun` is removed.

**Locking.** The first `POST /runs` sets `contest.lockedAt` with the same conditional `$set` as `createBoard.ts`. After lock, `ContestLock` refuses changes to gameType, scheduleMode, slots, runsPerFan, secondsPerQuestion, basePoints, speedBonus, networkCreditMs and opensAt (`409 CONTEST.LOCKED`, kind `"trivia_rules"`). `closesAt` may only be extended. Bands may be added or pointed at an equal-or-higher-value prize, never shrunk or lowered (same as the tier "value lowered" check). The admin UI (`BandDrawer`, `ContestBandsField`) needs lock-aware disabling and a locked banner like bingo's tier lock; it has none today.

## C. Fan endpoints (`/b2b/trivia`, fan auth, tenant from host)

Shared gate on run-starting writes (`refuseTriviaPlay`): contest exists and is visible, `gameType==="trivia"`, not finalized, and for **start** only `opensAt ≤ now < closesAt`. Answer/serve on an existing run are allowed after `closesAt` until Finalize (the clock still bounds each question). Errors: `CONTEST.NOT_OPEN`, `CONTEST.CLOSED`, `CONTEST.FINALIZED`, `CONTEST.NOT_PLAYABLE_HERE`.

```ts
type FanQuestion = { index; total; questionId; text; options: string[];
                     servedAt; deadlineAt; secondsPerQuestion; maxSpeedBonus; runningScore };
// No live "bonus now" value; maxSpeedBonus is for rules copy. The earned bonus appears on Reveal.
type Reveal = { index; outcome: "correct"|"wrong"|"timeout"|"late"; selectedOptionIndex?; correctOptionIndex;
                timeMs?; basePoints; speedBonus; points; runningScore; remaining: number };
type RunState = { runId; runIndex; status; cursor; total; runningScore;
                  phase: "question"|"reveal"|"complete"; question?: FanQuestion; reveal?: Reveal };
```

| # | Method, path | Request, response | Serves |
|---|---|---|---|
| 1 | `GET /contests/:contestId/me` | → `TriviaMe` | Card states, Rules |
| 2 | `POST /contests/:contestId/runs` | `{}` → `RunState` | Start / Resume run |
| 3 | `GET /runs/:runId` | → `RunState` | Resume, reload |
| 4 | `POST /runs/:runId/serve` | `{index}` → `RunState` | Next question |
| 5 | `POST /runs/:runId/answer` | `{index, selectedOptionIndex}` → `RunState` | Question → Reveal |
| 6 | `GET /runs/:runId/summary` | → `RunSummary` | Run review |
| 7 | `GET /contests/:contestId/runs` | → `{runs, bestRunId, runsUsed, runsPerFan}` | Your runs |
| 8 | `GET /contests/:contestId/standings?top=0&around=0` | → `TriviaStandings` | Standings (polled 6 s while open), prize sheet |
| 9 | `GET /contests/:contestId` | → `TriviaContestPublic` (config minus answers, bands with `PrizeCard`, contest-level `sponsor?`, players) | Rules, PrizeDetail |

```ts
type TriviaMe = { runsUsed; runsPerFan; bestScore?; bestRunId?; rank?; players; final: boolean;
  pointsToNextBand?; currentBand?: {from,to}; openRun?: {runId, cursor, total, runningScore, phase};
  finalBand?: {from,to,prizeName}; prizeStatus?: "pending"|"fulfilled"|"failed" };
type RunListItem = { runId; runIndex; score; correctCount; avgTimeMs; startedAt; completedAt?;
  status; outcomes: ("correct"|"wrong"|"timeout"|"late")[]; isBest: boolean };
type RunSummary = RunListItem & { questions: { index, text, options, correctOptionIndex,
  selectedOptionIndex?, outcome, timeMs?, points }[]; provisionalRank?; pointsToNextBand? };
type StandingRow = { rank; displayName; score; completedAt; isMe: boolean }; // never clerkUserId
type TriviaStandings = { final: boolean; closesAt; phase?: "upcoming"|"open"|"closed"; finalizedAt?;
  players; tieBreak: "earliest_completed";
  me?: {rank?, score?, bestRunId?, runsUsed?, runsPerFan?, currentBand?: {from,to}, finalBand?: {from,to,prizeName}};
  top: StandingRow[]; aroundMe: StandingRow[]; leader?: StandingRow;
  bands: (Band & {prize: PrizeCard; status: "in"|"reachable"|"won"|"missed";
  pointsNeeded?: number; missedBy?: number; cutoffScore?: number})[] };
// 2026-10-09: phase, finalizedAt, me's tries and bands, cutoffScore added (all optional) so the
// standings screen renders every state from this one polled payload.
// Built from B2BPrize / AdminPrize fields verbatim. No sponsor on prizes.
type PrizeCard = { prizeId; prizeName; prizeDescription; prizeImageUrl?; approximateValueCents?;
  redemptionMethod?; redemptionLocation?; redemptionWindow?; prizeClaimInstructions?;
  prizeClaimButtonText?; prizeClaimButtonLinkUrl?; handlerId };
```
`staticRedemptionCode` is never included.

**Rules**
- **Start (2).** Returns the open `in_progress` run if one exists. Otherwise refuses with `TRIVIA.NO_RUNS_LEFT` when `runsUsed ≥ runsPerFan`. "Play again" therefore requires the previous run to be complete. It composes all questions at creation: one random question per slot tag, excluding questions this fan has been served in the contest and duplicates within the run, options shuffled. **Tag exhaustion:** if a slot has no unseen question (bank shrank after lock), use the least-recently-served seen question and set `repeat:true`. Start is never refused for exhaustion. Insert is guarded by the partial unique index; sets `lockedAt`; returns phase `question` with Q1 served.
- **displayName** is snapshotted at start: Clerk first name + last initial ("Nick K.") if a first name exists, else Clerk username, else `"Fan " + last 4 of the user id`.
- **Server clock.** `servedAt` is stamped once on serve, immediately before the write that stores it (after the handler's own DB reads, so the server's latency is not charged to the fan); `deadlineAt = servedAt + secondsPerQuestion`. It never pauses; re-reads return the same values. They are still stamped server-side and drive resume and the lazy timeout, but the fan countdown no longer reads them: it is anchored on the device when the question is received and clamped to `secondsPerQuestion` (a resumed question starts from `deadlineAt − now`, clamped to `[0, secondsPerQuestion]`). The answer request carries `clientElapsedMs` (int ms, 0..120000; optional so old clients keep working, in which case server elapsed is used).
- **Answer (5).** First write wins via `findOneAndUpdate` on `questions.{i}.answeredAt: {$exists:false}` and `cursor: i`. Same answer repeated → stored reveal, 200. Different answer → `409 TRIVIA.ALREADY_ANSWERED` with the stored reveal. Judged in order, with `T = secondsPerQuestion*1000` and `serverElapsed = receivedAt − servedAt`, where `receivedAt` is stamped by the first middleware when the request arrives, before auth/tenant DB reads: (1) `clientElapsedMs > T` → `timeout`, 0 points (the fan ran out of time); (2) `serverElapsed > T + networkCreditMs` → `late`, 0 points (the answer was lost to the network; the fan sees a connection message); (3) not correct → `wrong`; (4) correct → `t = clamp(clientElapsedMs ?? serverElapsed, 0, serverElapsed)`, `points = basePoints + speedBonus × (T − t)/T`. `timeMs` stores `t`; the raw `clientElapsedMs` is stored for audit.
- **Lazy timeout.** Any read/write that finds the current question past `deadlineAt + networkCreditMs` unanswered writes `outcome:"timeout"` first (unchanged). `timeout` means the fan never answered in time (client clock ran out, or no answer arrived at all); `late` means the fan answered within their own time but the answer reached the server after `T + networkCreditMs`. Neither scores, and `late` never counts as correct in standings, prize eligibility, `correctCount` or `avgTimeMs`.
- **Resume.** Resumable only at reveal. `GET /runs/:id` returns phase `reveal`; Next calls `serve {index:i+1}`, which is idempotent (returns the original clock if already served).
- **No substitution.** A lost or slow response is covered only by `networkCreditMs` (see F).
- **Completion.** Answering or timing out the last question sets `status`, `score`, `completedAt`, `correctCount`, `avgTimeMs`; never recomputed.
- **Standings (8).** Each fan's best completed run; score desc, completedAt asc, runId asc. `final` is true only once `finalizedAt` is set; before that (including after `closesAt`) standings are provisional, from an aggregate cached 5 s per contest (15 s before 2026-10-09). `me` is built from the same ranked rows as the list; names are looked up only for the rows returned; the response carries `Cache-Control: private, max-age=3`. After Finalize, rows come from `settledStandings`. `top` ≤ 25, `around` ≤ 3.

## D. Admin endpoints (`/admin`, `requireAdmin`, `resolveTargetTenant`)

Every write uses `refuseReadOnlyWrite(scope)` and `writeAdminAudit` (same pattern as `prize-library.ts`).

| Method, path | Body, response | Audit |
|---|---|---|
| GET `/trivia/questions?tag=&q=&cursor=` | → `{items, nextCursor}` | |
| POST `/trivia/questions` | `{text, options, correctOptionIndex, tags}` | trivia_question_create |
| PATCH `/trivia/questions/:id` | partial | trivia_question_update |
| DELETE `/trivia/questions/:id` | hard delete; runs keep snapshots | trivia_question_delete |
| GET `/trivia/tags` | → `{tagId, name, questionCount}[]` | |
| POST `/trivia/tags` | `{name}`; 409 on duplicate | trivia_tag_create |
| DELETE `/trivia/tags/:id` | `409 TRIVIA.TAG_IN_USE` if questionCount > 0 | trivia_tag_delete |
| POST/PATCH `/contests` (existing, `api/admin/games.ts`) | `{gameType:"trivia", trivia}`; validates tags exist, band prizes exist in tenant, and **each slot tag has ≥ runsPerFan distinct questions** (`409 TRIVIA.TAG_TOO_SMALL` with `{slotIndex, tag, have, need}`) | contest_create/update |
| POST `/contests/:id/trivia/finalize` | `requireAdminReverified`; OBS staff only (mirrors bingo finalize); body `{confirmName}` (as built 2026-10-06: checked trimmed and ignoring case before the audit, 400 `confirm_name_mismatch`); idempotent → `{finalizedAt, players, prizesSentCount}` | trivia_finalize |
| GET `/contests/:id/trivia/standings?page=` | full paged list (provisional or final) | |

The admin tag drawer's Add/Remove are not wired yet; the UI has no Finalize button or standings table (only a static top-5 mock); `CreateContestDrawer` submits none of the trivia fields today.

**Finalize** (one action replaces settle + send-prizes; no automatic job at close):
1. Claim with conditional `$set {finalizedAt}` where absent; a repeat call returns the stored result.
2. Force-complete every `in_progress` run where it stands: remaining questions become `timeout` (0 points), `forceCompleted:true`.
3. Compute `trivia.settledStandings = [{rank, clerkUserId, displayName, score, runId, completedAt}]` once (sibling `${p}trivia_settled_standings` if over ~5k rows).
4. For each fan inside a band, upsert a `prize_redemptions` row (H) with `prizeSnapshot` from the library prize, then enqueue a win message to the prize SQS queue.
5. Set `finalized:true` (mirrors bingo's `postAdminFinalizeContest` flags so Upcoming/Open/Closed/Finished works unchanged) and `prizesSentCount`.
Steps 2–4 are individually idempotent (conditional writes, unique key, SQS dedup id), so a crash mid-way is fixed by calling Finalize again; the claim therefore records `finalizeCompletedAt` separately and a repeat call resumes if it is missing.

## E. Scoring

For elapsed time `t` in ms (capped at `T = secondsPerQuestion*1000`):
`points = correct ? basePoints + round(maxPoints * (T − t) / T) : 0`.
Linear, continuous at ms precision, rounded once at the end. The network credit covers the arrival of the answer only; it no longer eats into the speed bonus for honest fans, because `t` is the fan's own elapsed time bounded by server elapsed. A run's score is the sum of its question points. A fan's contest score is their best completed run; ties go to earlier `completedAt`, then lower runId, so ranks are strict.

## F. Spec deltas and open questions

**Deltas**
1. Reveal per question is the V1 default; `revealMode` fixed.
2. Resumable only at reveal; the server clock runs regardless; leaving mid-question is a timeout.
3. Question serving is explicit (`serve`); GET is side-effect-free except the lazy timeout.
4. Fan standings return me, top and around-me; the full list is admin-only.
5. New fan endpoints for run history and review.
6. Bands carry `PrizeCard` built from real prize-library fields; sponsor is per contest.
7. `seenQuestionIds` derived from runs.
8. Redemptions go into the generalized `prize_redemptions` (H), one per fan per contest.
9. `"abandoned"` dropped; in-progress runs are force-completed at Finalize with partial points.
10. Questions snapshotted into the run.
11. Fan paths are `/b2b/trivia/contests/:id/...` and `/b2b/trivia/runs/:id/...`.
12. **Substitution (TRV-59) dropped for V1.** Without a client ack the server cannot tell a lost response from a slow fan, and an ack-based scheme is exploitable to skip hard questions. The network credit alone covers lost responses. Possible V2 item.
    **Amended 2026-10-07 (timer reversal).** The earlier rule rejected any client-supplied timing. Client elapsed is now accepted but bounded by server elapsed, so a tampered client can gain at most the latency it actually had. Rationale: scores were latency-dependent, and the server-anchored countdown displayed wrong values on devices. A distinct `late` outcome (0 points, connection message) replaces folding lost answers into `timeout`. Substitution stays dropped.
13. **Starter questions removed** (collection, endpoints, copy flow, question `source`).
14. `opensAt`/`closesAt` gate starts only. Settle and send-prizes collapse into one admin Finalize; no auto-settle at close; standings stay provisional until Finalize.
15. Speed bonus shown on reveal only; linear continuous curve.
16. displayName rule: first name + last initial, else username, else "Fan ####".
17. `scheduleMode` persisted alongside optional `betEventId`.
18. **Standings v4 (2026-10-09).** The Run complete screen is retired: a finished run lands on Standings, which is one polled read (6 s while open and not final; paused while hidden, refetched on focus) carrying everything the screen needs (`phase`, `me` with tries and bands, `cutoffScore`). Server cache 15 s → 5 s so polling cost is bounded per contest per process. No websockets: 5–6 s freshness is the intent. Fan-facing wording never says *won* before Finalize ("You're on track for a Team hat!" / "Not yours until standings lock at 9:40 PM." / "Hold 31st–70th until then."). Decided from fan feedback that Standings was busy and that a leading fan could not tell whether the prize was already theirs.

**Open questions**
1. **(Defaulted, needs owner confirmation)** Tag exhaustion: create/update requires ≥ runsPerFan questions per slot tag; runtime falls back to a least-recently-served repeat flagged `repeat:true`; start is never refused.
2. Is TRV-45 band review needed before Finalize, or is Finalize itself the review point?

## H. Prize redemptions: how bingo works today and a generalization for both games

**(a) Bingo lifecycle today.** A prop settles; the `board-evaluator` lambda (`lambdas/board-evaluator/index.ts`) diffs the board's completed lines against `claimedLineIndices`. For each new line it computes `tierIndex = claimed.length + i` (a zero-based bingo count) and sends an SQS FIFO message `{userId, contestId, tierIndex, boardId}` (group = userId, dedup id = same four fields), then updates `claimedLineIndices`. The prize-worker (`prize-worker/src/process-message.ts`) upserts the row via `ensureRedemption` on the unique key `{userId, contestId, tierIndex, boardId}` in `${p}bingo_prize_redemptions`, status `pending`. On first handling it resolves the tier whose `threeInARows = tierIndex+1` and writes `tierSnapshot` conditionally (no tier → `skipped`). It resolves the handler from `handler-catalog.ts` by `tierSnapshot.handlerId` (falling back to the tier's current handler), claims the attempt with a conditional `dispatchedAttempt = resendCount+1`, delivers, and marks `fulfilled` + `fulfilledAt`, or `failed` + a PII-free `failureReason`. Operators see failed rows in the delivery queue and call `POST /admin/delivery-queue/resend`, which bumps `resendCount` conditionally and enqueues `{kind:"resend", redemptionId, attempt}` (optionally with a `recipientOverride`). Bingo's `finalize.ts` today sends nothing; it only sets `finalized`.

**(b) Generalization.** One collection, `${p}prize_redemptions`:
`{ organizationId, userId, contestId, gameType, source, sourceKey, prizeSnapshot, status, fulfilledAt?, failureReason?, resendCount?, resendRequestedAt?, dispatchedAttempt?, dispatchedAt?, handlerId?, recipientOverride? }`, with
`source = {kind:"bingo", boardId, tierIndex} | {kind:"trivia", runId, bandIndex, finalRank, finalScore}` and `sourceKey` a string (`"board:<id>:<tierIndex>"`, `"contest"` for trivia). Unique `{contestId, userId, gameType, sourceKey}`. `prizeSnapshot` is the tier snapshot generalized: `PRIZE_CONTENT_FIELDS` + `handlerId` + `snapshotAt`, with bingo keeping `prizeTierId`/`threeInARows` as optional extras.

Worker change: a win message carries `redemptionId` (trivia writes the row and snapshot at Finalize, so the worker only delivers), or the legacy bingo shape (worker still ensures + snapshots). After the snapshot step both paths are identical: handler resolution, claim, deliver, mark reads only `prizeSnapshot`. The resend UI and delivery queue need only a game column and a source label.

**Migration.** Option 1: rename `bingo_prize_redemptions` → `prize_redemptions`, backfill `gameType:"bingo"`, `source`, `sourceKey`, `organizationId`, copy `tierSnapshot` → `prizeSnapshot`, swap the unique index. Option 2: leave bingo in place and union-read in the delivery queue and stats. **Recommend option 1**: a single-collection backfill is a one-time script with an idempotent `$set`, while a union read taxes every queue, export and stats query forever. Deploy readers tolerant of both field names first, run the backfill, then drop `tierSnapshot` reads. Bingo keeps writing on tier hit; trivia writes at Finalize.
