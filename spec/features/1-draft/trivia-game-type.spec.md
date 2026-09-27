# Feature Spec: Trivia — a second game type

**Implements:** PRD [`trivia-game-type.md`](../../../documents/PRD/trivia-game-type.md), every `TRV-*` requirement.

**Depends on:** [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md) — the contest model,
the `gameType` discriminator and its lock kind, `refuseReadOnlyWrite`. [`admin-games-and-prizes.spec.md`](../../core-modules/1-draft/admin-games-and-prizes.spec.md) —
the `/games` screen this extends. [`prize-delivery.spec.md`](../../core-modules/1-draft/prize-delivery.spec.md) —
the redemption and fulfilment pipeline this reuses at the dispatch stage. [`admin-surface.spec.md`](../../core-modules/1-draft/admin-surface.spec.md) —
scope resolution, `org:admin`/`org:member`, reverification.

**Status:** Draft (`1-draft`). Written 2026-09-26.

## Overview

Bingo is the only game type that exists in code today. `B2BContest.gameType` (`obs-b2b-shared/src/interfaces/b2b/B2BContest.ts`)
already carries the discriminator and `ContestLock` already has a `"gameType"` lock kind, but `GAME_TYPES` is
`["bingo"]` — a single value, no admin UI ever offers a choice, and a live contract test currently pins
`gameType: "trivia"` as *invalid*. Everything downstream of the discriminator (the board model, the prize
tier's `threeInARows`, the redemption's `boardId` key) is bingo-shaped and was left that way on purpose
(`admin-contests.spec.md`, "Deliberately left for the trivia build"). This spec is that build: it widens the
discriminator to a real second value and adds the collections, endpoints and screens trivia needs of its own,
without touching bingo's.

**In scope:** the trivia question bank and its admin screen; the `gameType: "trivia"` contest and its
console configuration; the run, scoring and standings endpoints; a trivia-specific prize redemption model and
the "send prizes" admin action (`TRV-32`); the fan-side play and standings screens; reuse of the existing
branding and fulfilment pipeline.

**Not in scope:** anything the PRD rules out (§3 there) — synchronized play, head-to-head/group modes, a
second prize-authoring surface. Also not in scope here: a real-time transport layer (there isn't one to build
on — see "Known gaps"), and any change to bingo's own model, endpoints or screens.

---

## 1. Data model

### Widening the discriminator

- `GAME_TYPES` (`obs-b2b-shared/src/interfaces/b2b/B2BContest.ts`) becomes `["bingo", "trivia"] as const`.
  Every place it's threaded — the Mongoose `enum` in `b2b.ts`, the Zod schema in `api/admin/games.ts`, the
  now-inverted contract test — moves with it in the same change; nothing about the shape of `B2BContest`
  itself needs to change beyond that.
- `GAME_TYPE_COPY` (`obs-b2b-admin-frontend/src/lib/gameTypes.ts`) gets a second entry:
  `{ label: "Trivia", thresholdUnit: "finishing position" }`.
- `refuseJoin()`'s existing `contestGameType(contest) !== "bingo"` check in `createBoard.ts` is untouched — it
  already refuses a trivia contest at the bingo board endpoint (`CONTEST.NOT_PLAYABLE_HERE`), which is exactly
  the behaviour `TRV-01` needs until the fan app's trivia route exists.

### New collections (own, not shared with bingo — per the "deliberately left" boundary)

**`${prefix}trivia_questions`** — tenant-owned.

| Field | Notes |
|---|---|
| `_id, organizationId` | |
| `text` | |
| `options` (2–6 strings) | |
| `correctOptionIndex` | never sent to the fan client (`TRV-34`) |
| `tags: string[]` | free-form, drawn from the tenant's tag vocabulary (below); a sponsor question is any question carrying a sponsor tag (`TRV-09`) — no separate field |
| `source: "tenant" \| "starter"` | a copied starter question is `"starter"` and independently editable from then on (`TRV-07`) — copying is a value copy, not a reference |
| `createdBy, updatedBy` (actor id) | audit trail, `TRV-56` |
| `createdAt, updatedAt` | |

**`${prefix}trivia_tags`** — the tenant's tag vocabulary, governed separately from the questions that use it
(`TRV-54`): `{ _id, organizationId, name, createdBy, createdAt }`. A tag on a question is a name against this
list, not a foreign key — deleting a tag here is a vocabulary edit and is refused while any question still
carries it (surfaced in the console, not silently orphaned).

**`${prefix}trivia_starter_questions`** — Overboard-owned, no `organizationId`, never writable by a tenant
(`TRV-55`). Copying into a tenant's own bank is `INSERT ... SELECT`-shaped: a new `trivia_questions` document
per copied item, `source: "starter"`, no link back.

**`${prefix}trivia_runs`** — one per attempt, replacing the board model's role for this game type. A fan may
have several (`TRV-14`), so this is **not** unique on `{contestId, clerkUserId}` the way `b2b_bingo_boards` is;
it's unique on `{contestId, clerkUserId, runIndex}`.

| Field | Notes |
|---|---|
| `_id, contestId, clerkUserId, runIndex` | `runIndex` starts at 0 |
| `status: "in_progress" \| "completed" \| "abandoned"` | |
| `questions[]` | ordered; per entry: `questionId, optionOrder: number[], servedAt, answeredAt?, selectedOptionIndex?, correct?, timeMs?, substituted: number` (§4) |
| `score` | computed on completion, never recomputed after (`TRV-22`) |
| `seenQuestionIds: string[]` | union of every question this fan has ever been served in this contest, across runs — the source `TRV-42`'s "never repeat" check reads |
| `startedAt, completedAt?` | |

**`${prefix}trivia_prize_redemptions`** — its own collection and its own identity, exactly because the bingo
redemption's unique key (`{userId, contestId, tierIndex, boardId}`) is bingo-shaped end to end. Trivia has no
`boardId` and no bingo-count tier index; it qualifies on a **finishing-position band**.

| Field | Notes |
|---|---|
| `_id, userId, contestId, band` (e.g. `"1-10"`) | unique on `{userId, contestId, band}` |
| `finalRank` | the settled position that resolved to this band |
| `status, fulfilledAt?, failureReason?, resendCount?, dispatchedAttempt?, dispatchedAt?, handlerId?, recipientOverride?, tierSnapshot?` | same shape and same meaning as `IPrizeRedemption` (`obs-b2b-shared/src/models/prize-redemption.ts`) — copied, not inherited, so bingo's model stays untouched |

### Prize tiers: a band field beside `threeInARows`, not instead of it

`B2BPrizeTier` gets one addition: `positionBand?: { from: number; to: number }` (a `PATCH` on
`obs-b2b-shared/src/interfaces/b2b/B2BPrizeTiers.ts`), set for a trivia tier and absent for a bingo one.
`threeInARows` stays required-for-bingo, unused-for-trivia — this is the "game-neutral field beside the
existing one" option the admin-contests spec left open, taken here rather than a per-game tier model, because
the tier's other fields (name, image, claim instructions, fulfilment handler, value, redemption terms) are
already game-neutral (`TRV-49`) and don't need duplicating. `PUT /admin/contests/:contestId/prize-tiers`
validates `positionBand` when `contestGameType(contest) === "trivia"` and `threeInARows` when it's bingo;
bands must be distinct and non-overlapping, any count (`TRV-31`).

---

## 2. Question bank endpoints (admin)

All under `/admin`, `requireAdmin`, tenant-scoped exactly as `/admin/contests` (OBS names `?tenant=`), and every
**write** passes through `refuseReadOnlyWrite(scope)` — the same function `admin/{games,contests,sponsors}.ts`
already use, so `org:admin` writes and `org:member` gets `403 AUTH.READ_ONLY` with no new mechanism (`TRV-54`).
Reads have no such gate — an `org:member` sees the whole bank and its tags.

- `GET /admin/trivia/questions` — paged, filterable by tag, includes `correctOptionIndex` (this is the admin
  view, not the fan payload).
- `POST /admin/trivia/questions` / `PATCH /admin/trivia/questions/:id` / `DELETE /admin/trivia/questions/:id` —
  write-gated. Delete is a hard delete (a question is not a redemption-referencing record the way a contest
  is); audited as `trivia_question_create` / `_update` / `_delete` (`TRV-56`), same before-response,
  non-blocking pattern as `contest_create`.
- `GET /admin/trivia/tags` / `POST /admin/trivia/tags` / `DELETE /admin/trivia/tags/:id` — write-gated; delete
  refused (409) while any question still carries the tag.
- `GET /admin/trivia/starter-questions` — Overboard's bank, read-only, any tenant.
- `POST /admin/trivia/starter-questions/copy` — body `{ questionIds: string[] }` (or `all: true`); inserts
  copies into the tenant's own bank, `source: "starter"`; audited as `trivia_starter_copy`.

---

## 3. Contest configuration (admin)

`CreateContestDrawer.tsx` gains the field it doesn't have today for any game type: a **Game type** picker
(*Bingo* / *Trivia*, defaulting to Bingo so existing muscle memory doesn't change), reading its options and
labels from `GAME_TYPE_COPY`. Once a fan has joined, this is locked exactly as `ContestLock`'s `"gameType"`
kind already provides for — the drawer renders it as a value, not a control, on a locked contest.

Choosing Trivia expands a second section in the same drawer (mirrors the "Games" section's role for bingo):

- **Slots** — one row per question in a run, each a tag picker (`TRV-08`); "Add slot" while under the
  configured run length.
- **Run count** — how many runs a fan may take (`TRV-14`), default 1.
- **Time per question** — seconds (`TRV-15`).
- **Scoring** — base points for a correct answer, and a speed bonus curve (`TRV-19`); a sane default shipped,
  editable.
- **Network credit** — defaulted to 5 seconds, and a substitute-question cap defaulted to 3 per run (`TRV-59`);
  both editable per contest, since the right values are still an open product decision (PRD §16) and different
  tenants' venues may need different defaults once measured.
- **Prize bands** — same band editor described in §1, reachable from here exactly as the bingo drawer links to
  Prizes today.

The contest detail drawer's **Settings** section shows all of the above read-only for `org:member`, same
pattern as every other tenant-config screen.

---

## 4. The run (fan-facing)

No socket layer exists anywhere in this platform (see "Known gaps") — bingo's own scoring is server-side and
decoupled from any open fan connection, and the fan app's only "live" pattern is a 2-minute RTK Query poll on
board state, far too coarse for a per-question clock. Trivia's run is therefore a **request/response cycle per
question**, following the existing `RouteConfig` shape every other endpoint uses:

- **`POST /b2b/trivia/run`** — starts a run. Mirrors `createBoard.ts`'s `refuseJoin()` checks (hidden / not
  open / player limit) but allows a fan who already has a run, up to the contest's configured run count
  (`TRV-14`); refuses a 4th run request when the limit is 3. Composes the run's question list at creation
  time: for each configured slot, draw one question at random from that slot's tag, excluding every id in the
  fan's accumulated `seenQuestionIds` for this contest (`TRV-42`), and pre-shuffle each question's option order
  (`TRV-18`) — stored on the run, not recomputed later, so a reconnect doesn't reshuffle what the fan already
  saw. Responds with the run id and question 1 only.
- **`GET /b2b/trivia/run/:runId/question`** — returns the current unanswered question (text, shuffled options,
  never the correct index) and starts that question's clock **server-side, at the moment this response is
  built** — not when the fan's device renders it, which is the closest approximable reading of `TRV-21`'s
  "clock runs from when the question appears on their phone" without a push channel: the alternative (trusting
  a client-reported "I received it" timestamp) reopens exactly the integrity problem `TRV-34` rules out.
  Reading this endpoint again for the same question is idempotent and does not restart the clock.
- **`POST /b2b/trivia/run/:runId/answer`** — body `{ questionIndex, selectedOptionIndex }`. First write wins
  (`TRV-16`): a second answer to the same index is a 409 and changes nothing. Computes `timeMs` from the
  question's server-side served timestamp, applies the configured network credit, scores it, and — if the
  elapsed time still exceeds the credited allowance and the run has substitutions remaining — swaps in a fresh,
  unseen question at the same slot instead of scoring it wrong (`TRV-59`); a substituted question does not
  count against `TRV-42`'s seen list until it's actually answered. Advances to the next question or, on the
  last one, completes the run: computes `score`, sets `completedAt`, and this is the point at which the run's
  score is permanently final (`TRV-22`).

A run that never gets a final answer (the fan closes the app mid-game) stays `in_progress` indefinitely rather
than timing out server-side — `TRV-38` only promises a dropped connection doesn't cost a fan their answer or
run, not that an abandoned run auto-resolves; a fan can resume it by re-requesting the current question.

---

## 5. Standings

- **`GET /b2b/trivia/contest/:contestId/standings`** — every fan's best `score` across their completed runs
  (`TRV-24`, `TRV-25`), ranked, ties broken by whichever of those best runs `completedAt` first (`TRV-28`).
  Response carries `settled: boolean` (false until contest close) so the fan client can render the
  "provisional" treatment itself (`TRV-27`) rather than the server deciding copy.
- **`GET /b2b/trivia/contest/:contestId/me`** — the calling fan's own best score and current rank, available
  any time the contest is open (`TRV-26`).
- At contest close (the same close-time mechanism `admin-contests.spec.md` already has for `closed`), standings
  are computed once and frozen into a `settledStandings` snapshot on the contest (or a sibling collection, if
  the standings list is large) — `TRV-30`: nothing after this point recomputes them, even if a later
  correction to a question were ever made.

---

## 6. Prizes: the "send prizes" action

Every other prize flow in this platform is fully automatic — the board-evaluator Lambda enqueues fulfilment
the instant a bingo line completes, no admin in the loop. `TRV-32` deliberately breaks that pattern for trivia:
nothing is sent until a tenant admin clicks **Send prizes**, because standings settle before there is any
external event to hang automatic dispatch off (a fan finishing their run isn't when the contest is decided —
close is), and because this is the natural place to hang `TRV-45`'s pre-fulfilment review.

- **`POST /admin/contests/:contestId/trivia/send-prizes`** — `requireAdminReverified`, following the same
  claim-and-dispatch shape as the existing delivery-queue resend endpoint: refuses if the contest isn't closed
  or standings aren't settled, refuses if already sent (idempotent — a second click is a no-op, not a
  duplicate send), resolves `settledStandings` against the contest's `positionBand` tiers, writes one
  `trivia_prize_redemption` per fan who lands in a banded position, and enqueues fulfilment for each exactly as
  the bingo evaluator does today — same SQS queue, same `prize-worker`, same `standard-email` handler,
  reusing the pipeline from the dispatch stage on. Audited as `trivia_prizes_sent` (contest id, count) before
  the enqueue.
- The contest detail drawer's **Prize tiers** section gains a **Send prizes** button once the contest is
  closed, disabled with its reason before that ("Closes at 9:45pm" / "Standings aren't settled yet"), and
  becomes a **Sent — 214 awarded** state after, matching the reverification and irreversibility treatment
  `admin-surface.spec.md` already gives Finalize.
- `TRV-45`'s "which bands are reviewed" stays the PRD's open decision (§16 there) — this endpoint sends every
  banded position in one action either way; a review step ahead of the click, if bands end up needing one, is
  console-side UI on top of this endpoint, not a change to it.

---

## 7. Screens

### Admin: Question bank (new)

A new destination beside Games & Contests and Prizes (same "Games" hue family, per `admin-surface.spec.md`'s
nav table). `pages/QuestionBank.tsx` + `components/trivia/{QuestionDrawer,TagManager,StarterBankPicker}.tsx`,
following the exact `pages/<Feature>.tsx` / `components/<feature>/<Feature>Drawer.tsx` split every other
screen uses.

- A table of the tenant's questions — text, tags, source (own / copied) — filterable by tag, with a **New
  question** action and a **Copy from starter bank** action opening `StarterBankPicker` (checkbox list,
  "Copy selected" / "Copy all").
- Tag vocabulary managed from the same screen (`TagManager`: add, rename, delete-when-unused), since `TRV-54`
  puts both under `org:admin`.
- `useCanWrite()` gates every write affordance; an `org:member` sees the identical table and tag list with no
  buttons, the same "view-only" presentation `Prizes`/`Games` already give that role.

### Admin: Games & Contests

- `CreateContestDrawer` and the contest detail drawer, extended per §3.
- Contest table row gains a game-type badge (*Bingo* / *Trivia*) beside the status badge it already has.

### Fan: contest list

`ContestsPage`/`contestApi` today assume bingo (its query shape is board-centric); this needs extending, not a
bolt-on: the contest list query reports, per contest, `gameType` and the fan's own entry state for *that*
type (an existing board id, or an existing run id) — `TRV-51`. `ContestCard` branches its "Play" action on
`gameType`: bingo routes to `/board/:id` as today; trivia routes to `/trivia/:contestId`, which itself
redirects to an in-progress run if one exists, the identical "don't re-offer join if you're already in" check
`ContestPage.tsx` does for boards.

### Fan: trivia play (new)

`src/pages/trivia/TriviaPlayPage.tsx`, `src/store/api/triviaApi.ts` (`useStartRunMutation`,
`useGetCurrentQuestionQuery`, `useSubmitAnswerMutation`) — same RTK Query shape as `contestApi.ts`. One
question on screen at a time: prompt, shuffled options, a visible countdown seeded from the contest's
per-question time. Submitting locks the options immediately (no second tap can matter even if the request is
in flight) and shows correct/incorrect only if the contest's config says to reveal it per-question — otherwise
a bare "next question" transition, since `TRV-33` means many tenants will want the answer never surfaced
mid-contest at all. A finished run shows the fan's score and their current (labelled provisional) rank, with a
link to the standings screen.

### Fan: trivia standings (new)

`src/pages/trivia/TriviaStandingsPage.tsx` — a ranked list, the fan's own row pinned or highlighted, a
persistent "Provisional — updates as more fans finish" banner until the contest closes, at which point the
same screen reads the frozen `settledStandings` and drops the banner.

---

## Rules

1. **Trivia gets its own collections, endpoints and models wherever bingo's are shaped by bingo** (the board,
   the prize tier's `threeInARows`, the redemption's `boardId` key). Nothing here renames or repurposes a
   bingo collection.
2. **Every trivia-bank write goes through `refuseReadOnlyWrite`** — no new permission mechanism.
3. **A question's correct answer is never sent to the fan client.** Scoring happens server-side only (`TRV-34`).
4. **A question's clock starts when the server builds the response that carries it**, not on a client-reported
   receipt — the only version of `TRV-21` that doesn't reopen `TRV-34`.
5. **A fan's first answer to a question is the only one that counts**, enforced by the write, not just the UI.
6. **`seenQuestionIds` is checked at question-selection time, run and slot alike** — a substitution draws from
   the same exclusion set as the original draw.
7. **A run's score is frozen at completion; a contest's standings are frozen at close.** Neither is recomputed
   after, even by a later data correction.
8. **Nothing is sent to a fan until an admin clicks Send prizes**, and that action is reverification-gated and
   idempotent.
9. **Game type is locked once a fan joins**, via the existing `ContestLock` `"gameType"` kind — no new lock
   mechanism.

## Known gaps (recorded, not blocking a draft)

- **No real-time transport exists in this platform.** The run is designed as request/response per question
  because there is nothing to build a push-based clock on; if a future game type needs true synchronized play,
  that's the point at which a socket layer becomes unavoidable, not before.
- **Reveal-per-question vs. reveal-at-end is left as a per-contest choice with no default decided here** — the
  PRD doesn't specify it and it interacts with `TRV-33` (answer-sharing resistance) in a way worth a tenant's
  own call rather than a hardcoded platform behaviour.
- **`TRV-45`'s reviewed-bands list and `TRV-59`'s exact credit/substitution defaults are open PRD decisions**
  (PRD §16) — this spec implements both as configurable with the PRD's stated defaults, not as fixed values.
- **No admin UI mock exists yet for the Question bank screen's exact layout** — described in prose in §7,
  wireframed separately (see the accompanying mockups).
- **Abandoned-run cleanup** — an `in_progress` run with no activity is never expired or surfaced to the fan as
  stale. Left alone for V1; worth a "resume or abandon" prompt if it turns out to confuse fans in practice.

## References

- PRD: [`trivia-game-type.md`](../../../documents/PRD/trivia-game-type.md), every `TRV-*` id.
- [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), [`admin-games-and-prizes.spec.md`](../../core-modules/1-draft/admin-games-and-prizes.spec.md),
  [`prize-delivery.spec.md`](../../core-modules/1-draft/prize-delivery.spec.md), [`admin-surface.spec.md`](../../core-modules/1-draft/admin-surface.spec.md)
- Code: `obs-b2b-shared/src/interfaces/b2b/{B2BContest,B2BPrizeTiers}.ts`, `obs-b2b-shared/src/models/{b2b,prize-redemption}.ts`,
  `overboard_sports_backend/node-server/src/handlers/board/createBoard.ts`, `overboard_sports_backend/node-server/src/handlers/admin/target-tenant.ts::refuseReadOnlyWrite`,
  `obs-b2b-admin-frontend/src/lib/{gameTypes,useCanWrite}.ts`, `overboard-b2b-template/src/store/api/contestApi.ts`
