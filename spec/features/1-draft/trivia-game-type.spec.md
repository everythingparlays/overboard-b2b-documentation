# Feature Spec: Trivia — a second game type

**Implements:** PRD [`trivia-game-type.md`](../../../documents/PRD/trivia-game-type.md), every `TRV-*` requirement.

**Depends on:** [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md) — the contest model,
the `gameType` discriminator and its lock kind, `refuseReadOnlyWrite`. [`admin-games-and-prizes.spec.md`](../../core-modules/1-draft/admin-games-and-prizes.spec.md) —
the `/games` screen this extends. [`prize-delivery.spec.md`](../../core-modules/1-draft/prize-delivery.spec.md) —
the redemption and fulfilment pipeline this reuses at the dispatch stage. [`admin-surface.spec.md`](../../core-modules/1-draft/admin-surface.spec.md) —
scope resolution, `org:admin`/`org:member`, "No re-authentication".

**Status:** Draft (`1-draft`). Written 2026-09-26. Revised 2026-10-01 (Arthur's rulings): the schedule's times round-trip and a blank one never becomes "now" (§3); a tag must hold enough questions for every run, checked on save, on publish and in the question bank (§2, §3); a game-day contest is always publishable (§3); Arthur's lock table (§3); prize emails gain `{rank}` (§6); trivia screens drop bingo's leftovers (§7).

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
| `prizeId, prizeSnapshot` | the library prize the band named, and a point-in-time copy of it — what `tierSnapshot` is for bingo |
| `status, fulfilledAt?, failureReason?, resendCount?, dispatchedAttempt?, dispatchedAt?, handlerId?, recipientOverride?` | same shape and same meaning as `IPrizeRedemption` (`obs-b2b-shared/src/models/prize-redemption.ts`) — copied, not inherited, so bingo's model stays untouched |

### The prize library: a prize is its own record, and tiers and bands only name one

Today a prize *is* a tier: `B2BPrizeTier` carries the name, description, image, claim copy, fulfilment
handler, value and redemption terms alongside `threeInARows`, so the same jersey awarded from two contests is
authored twice, and there is no way to award it from a game that has no bingo count. `TRV-49` says the
opposite — a prize is written once and usable by any game type — and the decision (2026-09-26) is to take
that literally rather than bolt a band field onto the tier:

**`${prefix}prizes`** — tenant-owned, one per prize. Every field that is about *what the fan wins* moves here
from the tier: `prizeName, prizeDescription, prizeImageUrl?, prizeClaimInstructions?, prizeClaimButtonLinkUrl?,
prizeClaimButtonText?, handlerId, approximateValueCents?`, the redemption fields (`redemptionWindow?,
redemptionMethod?, redemptionLocation?, staticRedemptionCode?`), and `createdAt, updatedAt`.

What stays on the tier is what is the tier's: **`B2BPrizeTier` keeps `threeInARows` and gains `prizeId`.**
A trivia contest's equivalent is its **bands** — `{ from, to, prizeId }[]` on the contest (`TRV-31`: distinct,
non-overlapping, any count). Both are references; editing a prize's claim copy changes what every tier and
band that names it pays, in one place, and a prize nothing references is *unused*, not deleted.

**Delivery is the prize's** (decided 2026-09-27). `handlerId` lives on the library prize, never on a tier or
band, and names one entry in the existing handler registry (`node-server/src/prize-delivery/handler-catalog.ts`,
served by `GET /admin/prizes/handlers`): developers build a handler per kind of prize a tenant needs and
register it there, scoped to the tenants it was built for; the prize drawer's **Delivery** select is that
registry, and every contest that awards the prize delivers it that way. No per-contest override. The
redemption's `prizeSnapshot` copies the resolved `handlerId` with the prize fields, so re-pointing a prize
later never retargets wins already queued, and a prize whose handler no longer resolves reads "Won't
deliver" in the library, as the ladder does today.

**As built (2026-09-27, steps 1–2).** The tier keeps its content fields as a **copy of its prize**: the
tiers `PUT` takes `{prizeTierId?, threeInARows, prizeId?}` — a stored tier sent by id without a prize is kept as it is — resolves each named prize within the tenant and writes
the copy (`PRIZE_CONTENT_FIELDS`); a prize `PATCH` cascades the changed fields onto every tier naming it
with one `updateMany`. That is why nothing downstream changed — the fan populate, the worker's `loadTiers`
and award-time snapshot, the email renderer and the delivery-queue search all read the copy, which is
always current. The lock joins the prize: re-pointing a locked contest's tier at a cheaper prize is refused
as "value lowered", and lowering a prize's value is refused (`prize_value_locked`) while any tier naming it
sits on a locked contest. `scripts/prize-library-migration.mjs` (dry-run by default) creates one prize per
distinct `(prizeName, prizeDescription, handlerId)` from pre-library tiers and sets their `prizeId`; the seed
script authors its fixture prizes in the library first.

Migration is mechanical and one-way: every existing tier's prize fields become a `prizes` document (one per
tier — duplicates are the tenant's to merge, and the console makes them visible as such), the tier keeps its
`threeInARows` and points at it, and `PrizeRedemption.tierSnapshot` keeps meaning what it meant for rows
already written. The prize pipeline changes at exactly one seam: fulfilment reads the prize through the
reference (or the snapshot) instead of off the tier. `TRV-57` — no tenant re-enters prize data — is the
migration's acceptance test.

Endpoints: `GET/POST /admin/prize-library`, `PATCH/DELETE /admin/prize-library/:prizeId` (delete refused
while any tier or band names it), all `refuseReadOnlyWrite`-gated on write. The tiers `PUT` keeps its shape
and takes `prizeId` per tier instead of the prize fields; bands go on the trivia contest's own settings
endpoint.

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
- **Open and upcoming contests keep their questions** (2026-10-01). An open or upcoming trivia contest is one
  that is published, not closed or finalized, and whose close time is ahead. A write that would leave such a
  contest short of questions for every run a fan can play (§3, "Enough questions") is refused with 409
  `TRIVIA.CONTEST_NEEDS_QUESTIONS`, naming the contests:
  - deleting a question, or taking a tag off a question: 'This would leave "Trivia Test" without enough "nfl"
    questions for every run a fan can play. Add questions to that tag first, or change the contest.'
  - deleting a tag such a contest draws from: '"Rookie Night" draws questions from this tag, so it can't be
    deleted while that contest is open or upcoming.'
- `GET /admin/trivia/starter-questions` — Overboard's bank, read-only, any tenant.
- `POST /admin/trivia/starter-questions/copy` — body `{ questionIds: string[] }` (or `all: true`); inserts
  copies into the tenant's own bank, `source: "starter"`; audited as `trivia_starter_copy`.

---

## 3. Contest configuration (admin)

`CreateContestDrawer.tsx` gains the field it doesn't have today for any game type: a **Game type** picker
(*Bingo* / *Trivia*, defaulting to Bingo so existing muscle memory doesn't change), reading its options and
labels from `GAME_TYPE_COPY`. Once a fan has joined, this is locked exactly as `ContestLock`'s `"contestType"`
kind already provides for — the drawer renders it as a value, not a control, on a locked contest.

Choosing Trivia replaces the bingo "Games" picker with a **Runs** choice — *At a game* / *On its own* — and
an **Opens** / **Closes** pair (`TRV-29`), each the console's date and time picker (`DateTimeField`;
[`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), "The date and time picker"), on
the builder's Trivia step and the Trivia tab alike. On the contest this is `betEventId?` plus `opensAt` and
`closesAt` (in `trivia`, never the contest's top-level times) — the window is what the run endpoints check,
the game is only where the times came from and what the card shows.

- **At a game** (game-day mode): the picker takes exactly one game. A blank Opens is the game's tip-off and
  a blank Closes its expected end (tip-off plus the sport's usual length; `triviaGameWindow` in shared
  `B2BTrivia.ts`); either can be set. The console computes them, and the server fills them when they're
  absent. A game-day config whose stored times equal its game's window reads back as blank, so changing the
  game moves the times with it.
- **On its own** (standalone): both times are required, and the fan card shows the contest by name instead of
  a matchup. A blank time blocks Continue and Save with "Set when it opens and closes." under the times, and
  the server refuses with the same sentence. `triviaConfigInputSchema` takes `opensAt` and `closesAt` as
  optional for game mode only.
- **A blank time never becomes "now"** (fixed 2026-10-01). The native `datetime-local` input reported an
  empty value until every part was filled, and a blank time was then saved as now and now plus one hour, so
  typed times were lost. The date and time picker replaced it, and neither side turns a blank time into now.

Then the trivia section proper:

- **Slots** — one row per question in a run, each a tag picker (`TRV-08`); "Add slot" while under the
  configured run length.
- **Run count** — how many runs a fan may take (`TRV-14`), default 1.
- **Time per question** — seconds (`TRV-15`).
- **Scoring** — base points for a correct answer, and a speed bonus curve (`TRV-19`); a sane default shipped,
  editable.
- **Network credit** — defaulted to 5 seconds, and a substitute-question cap defaulted to 3 per run (`TRV-59`);
  both editable per contest, since the right values are still an open product decision (PRD §16) and different
  tenants' venues may need different defaults once measured.
- **Prizes** — set here, with the rest of the contest (decided 2026-09-26): a list of what the contest pays,
  each row naming a library prize and *where* it's won — a bingo count for bingo, a finishing-position band
  for trivia — with **Add prize tier** / **Add prize band** opening a small picker (the count or the
  positions, and a prize from the library). The same field sits in the contest drawer afterwards. Nothing
  about the prize itself is entered on a contest; that is the library's, on Prizes.

**The lock** (Arthur's table, 2026-10-01; [`contest-safety.spec.md`](../../core-modules/1-draft/contest-safety.spec.md),
"Trivia: what locks"). Once a fan has started a run, what they play under locks — the game a fan played under
is the game they're ranked on:

| | Once a fan has started a run |
|---|---|
| **Locked** | Question slots (count and tags), seconds per question, base points, speed bonus, network allowance, runs per fan, the game and schedule mode, the open time, the contest type |
| **Close time** | Free in either direction, never before the open time or in the past (lock kind `closesAt`: "The close time can't be before the contest opens, or in the past."). This replaces the old "extend only" rule. |
| **Prize bands** | Add a band, widen one, or swap a band's prize for one worth at least as much (both prizes must state a value; the console offers no value, so in practice a locked band keeps its prize). Never remove, narrow or downgrade a band, and never swap its prize for a different, unrelated prize (kinds `bandRemoved`, `bandPrize`; bands matched by the ranks they cover, not their position). |
| **Free** | Name, description, banner, Presented by sponsor, reveal mode |

The rule's sentence (kind `trivia_rules`): "Fans have started playing, so the questions, timing, scoring, runs per
fan, game and open time are locked. You can still move the close time, and add or widen prize bands." The
Trivia tab shows the locked settings as values with the lock glyph and this sentence up front, not on Save;
only Closes stays a field. The Prizes tab shows a locked band's prize as a value with the lock glyph and no
Remove, and refuses narrowing before saving. An `org:member` sees every setting as a value always.

**Enough questions** (2026-10-01). A run draws a different question for each slot, and a fan never sees a
question twice across runs (`TRV-42`), so each tag must hold (number of slots drawing from it) × (runs per fan)
questions (`triviaShortfalls` in shared `B2BTrivia.ts`). The earlier save-time check compared each tag to the
runs per fan alone, which was wrong for any tag more than one slot draws from.

- **On save** the config is refused with `TRIVIA.TAG_TOO_SMALL`, which carries `slots` and names the first
  slot: 'Question 1 uses the tag "nfl", which has 5 questions. 2 questions in a run draw from it and each fan
  gets 3 runs, so it needs 6. Add 1 more question to that tag or lower the runs per fan.'
- **On publish** the check `trivia_short_questions` blocks it: "Some question tags don't hold enough questions
  for every run a fan can play. Add questions in the Question bank, or lower the runs per fan."
- **The contest read** carries `questionShortfalls` (`{ tag, slotIndex, slots, have, need }[]`). A contest
  that can't run shows a warning banner under the contest page header: "Fans can't play this contest. The
  "nfl" tag has 4 questions and needs 6 (2 questions a run). It's hidden from fans until every run has enough
  questions." with "Open Question bank" (on a draft: "This contest can't run yet. … Add questions before you
  publish, or lower the runs per fan.").
- **Fans** never see a trivia contest that can't run, on the Contests page or among the Start screen's sponsors
  and next game, until it can.
- **The question bank** refuses an edit that would make an open or upcoming contest short (§2).

**Publishing** (2026-10-01). A trivia contest's publish checks are `trivia_incomplete`, `trivia_short_questions`
and `no_prize_bands` ([`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), "Publish
checks"). Neither its game having started nor its own close time having passed blocks Publish: a draft's times
don't matter until it is published, and `all_started` doesn't apply to trivia. If its open time has passed it
is live at once; if its close time has passed it closes at once. Review says so beside Publish without
blocking it (shared `contestPublishNotes`): "Its close time has passed, so it closes as soon as it's published.
Change the close time first?" with "Change the close time", or, when only the open time has passed, "Its open
time has passed, so fans can play as soon as it's published."

**Closed by its time.** A trivia contest past `trivia.closesAt` reads Closed everywhere (the console's pill, the
fan app's Past tab), though nobody pressed Close entries ([`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md),
"State and status").

**As built (mock, 2026-09-26):** the game-type picker and the trivia section landed in `CreateContestDrawer`
under a dev-only flag (`lib/triviaMock.ts`, `TRIVIA_MOCK_ENABLED`); the trivia contest's card and drawer are
their own components (`components/contests/TriviaContestCard.tsx`) beside the bingo ones rather than branches
inside them, because a trivia contest can't be typed as an `AdminContest` until `GAME_TYPES` widens. The
settings fields are shared (`components/contests/triviaFields.tsx`) so the create drawer and the contest
drawer can't drift, the pattern `fields.tsx` already sets for the bingo settings.

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
  duplicate send), resolves `settledStandings` against the contest's bands, writes one
  `trivia_prize_redemption` per fan who lands in a banded position, and enqueues fulfilment for each exactly as
  the bingo evaluator does today — same SQS queue, same `prize-worker`, same `standard-email` handler,
  reusing the pipeline from the dispatch stage on. Audited as `trivia_prizes_sent` (contest id, count) before
  the enqueue.
- The trivia contest's drawer gets a **Send prizes** section of its own, below its bands: before close it
  says when the action becomes available; once standings settle it offers **Send prizes…**, which asks once
  (how many prizes, that it can't be undone) and then sends; after, it reads **Sent — 70 prizes in delivery**
  with a line pointing at Prizes and the Delivery queue. It matches the reverification and irreversibility
  treatment `admin-surface.spec.md` already gives Finalize. A view-only member sees each of those states as a
  sentence, never a disabled button (the console's honesty-by-omission rule).
- **A trivia win speaks places, not bingos** (2026-10-01). Deliveries read "Won at 3rd place", never "0 bingos".
  The prize email gains the placeholder `{rank}` ("3rd place"). For a trivia winner `{bingos}` also fills with
  the place, and for a bingo winner `{rank}` fills with the bingos, so no trivia winner reads "0 bingos". The
  staff email-wording editor lists the placeholders per contest type, with a "Bingo wins | Trivia wins" switch:
  bingo's list has `{bingos}`, trivia's has `{rank}` and not `{bingos}` (`PRIZE_EMAIL_WORDING_TOKENS`, shared
  `PrizeEmail.ts`).
- `TRV-45`'s "which bands are reviewed" stays the PRD's open decision (§16 there) — this endpoint sends every
  banded position in one action either way; a review step ahead of the click, if bands end up needing one, is
  console-side UI on top of this endpoint, not a change to it.

---

## 7. Screens

### Admin: Question bank (new)

A new Workspace destination between Games & Contests and Prizes (`/question-bank`, "Games" hue family, per
`admin-surface.spec.md`'s nav table — the nav route-table test moves with it). `pages/QuestionBank.tsx`, with
its drawers in the same file for now, following the `pages/<Feature>.tsx` shape every other screen uses.

- The Games/Prizes two-column layout: the questions table on the left (text with its option count and answer,
  tags as badges with `sponsor` in the accent hue, source "Written here" / "Copied"), filtered by a quiet
  Segmented (All / Written here / Copied from starter) and a tag select; on the right, the **Tags** card
  (name and how many questions carry it, **Manage tags**), the **Starter bank** card (**Copy questions…**),
  and a **Repeats** card that states `TRV-11`'s consequence — bank size against run length — rather than
  enforcing anything.
- **New question** / **Edit** open the question drawer: the text, its options with a radio marking the right
  one, tag checkboxes, and for an existing question its edit history line (`TRV-56`). A copied starter
  question's drawer says it's the tenant's own now.
- **Copy from starter bank** opens a checkbox list with select-all; the button counts what's picked.
- **Manage tags**: add (lowercase, hyphenated), and remove — disabled with its reason while any question
  carries the tag. Deleting a question, taking a tag off one, or deleting a tag that would leave an open or
  upcoming contest short of questions is refused with the contest named (§2).
- `useCanWrite()` gates every write affordance and the head shows the same "Only organization admins can
  change questions" note the other screens use; an `org:member` sees the identical table and cards with no
  buttons (`TRV-54`).

### Admin: Games & Contests

- `CreateContestDrawer` and the contest detail drawer, extended per §3.
- Every contest card's header gains a game-type badge (*Bingo* / *Trivia*) beside the status badge it already
  has — on the bingo cards too, since a list of two kinds has to say which is which. The page's lede changes
  from "contests" to "bingo and trivia contests".
- A trivia contest's card has no games table to toggle. Its middle stat is its window (2026-10-01): "Opens"
  while Upcoming, else "Runs", with the date and the matchup, or "On its own" with no game. Its "Prizes" stat
  counts bands. In the list view its Next game cell says "Closes Thu · 9:00 PM" or "Closed Oct 1" when it
  has no game ([`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md)).
- **Trivia speaks trivia** (2026-10-01). The contest page's Overview shows "Finished a run" (fans with at least
  one completed run, `kpis.finishedFans`, with "N% of players") in place of a "Finished" tile that always
  read 0. Delete says what a trivia contest loses: "Deletes the contest, its fans' runs and its sponsor placements. Its prize bands go
  with it; prizes already sent stay on record." (dialog: "N fans have played this contest. Their runs, its
  prize bands and its sponsor placements are deleted. …"). The Sponsors tab has no "Provided by" prize-tier
  card. Staff and overview counts of prize tiers count bands for a trivia contest.

### Admin: Prizes

The screen's job narrows to the prizes themselves: "the prizes this tenant awards and how they've been
delivered". Which bingos or positions win one is the contest's business, set on the contest (§3), so the
per-contest switcher and the bingo ladder leave this screen (decided 2026-09-26):

- A **Prize library** card is the main column (`pages/prizes/PrizeLibrary.tsx`): every prize, with its
  delivery method, value, and where it's awarded from as badges ("Trivia Night — Week 6 · Positions 1–10",
  "Home Opener Bingo · 3 bingos"), or "Not awarded anywhere". **New prize** and each row's **Edit** open a
  prize drawer holding the fields that moved off the tier drawer (name, description, delivery, value, claim
  instructions) and an "Awarded from" list; delete is refused while anything names it.
- The side column keeps the tenant-wide delivery totals and the prize email card, as today.
- The "Add its prize tiers" link from Games & Contests, the card's "Add a tier on Prizes" warning and the
  contest drawer's "Edit on Prizes" link all point at the contest's own settings instead; the tiers `PUT`
  becomes the contest drawer's write (`pages/prizes/{BingoLadder,TierDrawer}.tsx` retire with the switcher).
- **As built (mock):** the pickers live in `components/contests/prizePickers.tsx` — `ContestPrizesField`
  (the list on the contest, tiers or bands by game type), `TierPickerDrawer`, `BandDrawer` — used by the
  create drawer, the bingo contest drawer's tiers section (add only, in the mock) and the trivia contest
  drawer (bands editable until prizes are sent). Prizes shows the library alone while the mock is on and the
  old per-contest view otherwise, so nothing real is lost behind the flag.

### Fan: contest list

`ContestsPage`/`contestApi` today assume bingo (its query shape is board-centric); this needs extending, not a
bolt-on: the contest list query reports, per contest, `gameType` and the fan's own entry state for *that*
type (an existing board id, or an existing run id) — `TRV-51`. A trivia contest's card
(`components/contests/TriviaContestCard.tsx`) is drawn as the bingo card is — same rounded card, same status
chip (Open / Entered / Closed), same matchup headline — with a "Trivia" eyebrow, a questions-and-seconds line
where bingo shows tip-off, the top band's prize, and for an entered fan their best score and runs left. Its
action is **Play Now** / **Play Again** while runs remain, **View Standings** otherwise: `/trivia/:contestId`
and `/trivia/:contestId/standings`. Once the shared discriminator widens this folds into `ContestCard` as a
branch on `gameType`; until then it is its own component for the same reason as the admin card.

A trivia contest's tab follows the one state rule (2026-10-01; `contestPhase`, [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md),
"State and status"): Live & Upcoming while upcoming or open, Past once closed, including once its close time
has passed. A contest that can't run (a tag too small, §3) is not listed at all until it can.

### Fan: trivia play (new)

`src/pages/trivia/TriviaPlayPage.tsx`, `src/store/api/triviaApi.ts` (`useStartRunMutation`,
`useGetCurrentQuestionQuery`, `useSubmitAnswerMutation`) — same RTK Query shape as `contestApi.ts`. Three
states on one route:

- **Before the run** — the contest's name and matchup, three stats (questions, seconds each, runs used of
  allowed), the rules in four lines (speed scores, first tap is final, score is final / rank moves, best run
  counts), the prize bands, and **Start run**.
- **The run** — "Question N of M" and a countdown with a progress bar under it (it turns the destructive
  colour in the last quarter); a "presented by" line on a sponsor question; the prompt; lettered options.
  Tapping one locks every option that instant (no second tap can matter even while the request is in flight)
  and shows the verdict and the points — this mock reveals per question; whether a tenant may turn that off is
  the open reveal decision below — then **Next question** / **Finish run**. Time running out scores nothing
  and says so.
- **After** — the score, large, with "This won't change."; the provisional rank in a card with the warning
  banner; a per-question list of ticks and points; **See standings**, and **Play again · best run counts**
  while runs remain.

### Fan: trivia standings (new)

`src/pages/trivia/TriviaStandingsPage.tsx` — a ranked list (rank, name, best score), the fan's own row
tinted in the primary colour and named "You", each row in a band showing the prize it currently earns, a
"Top N of M · ties go to whoever finished first" line, the bands below, and **Play now** / **Play again**
while runs remain. A "Provisional — updates as more fans finish" banner until the contest closes, at which
point the same screen reads the frozen `settledStandings`, the banner becomes "Final", and the play button
goes.

**As built (mock, 2026-09-26):** both fan screens and the card are on `src/lib/triviaMock.ts` behind
`TRIVIA_MOCK_ENABLED` (dev builds only, never test or production); the countdown runs in the browser here
where the real one is server-side. The routes are registered in `App.tsx` under `ProtectedRoute` like every
contest route.

---

## Rules

1. **Trivia gets its own collections, endpoints and models wherever bingo's are shaped by bingo** (the board,
   the prize tier's `threeInARows`, the redemption's `boardId` key). Nothing here renames or repurposes a
   bingo collection.
1. **A prize is one record in the library; a tier or a band only names it.** No prize field lives on a tier
   or a band, and nothing that names a prize can delete it.
2. **Every trivia-bank write goes through `refuseReadOnlyWrite`** — no new permission mechanism.
3. **A question's correct answer is never sent to the fan client.** Scoring happens server-side only (`TRV-34`).
4. **A question's clock starts when the server builds the response that carries it**, not on a client-reported
   receipt — the only version of `TRV-21` that doesn't reopen `TRV-34`.
5. **A fan's first answer to a question is the only one that counts**, enforced by the write, not just the UI.
6. **`seenQuestionIds` is checked at question-selection time, run and slot alike** — a substitution draws from
   the same exclusion set as the original draw.
7. **A run's score is frozen at completion; a contest's standings are frozen at close.** Neither is recomputed
   after, even by a later data correction.
8. **Nothing is sent to a fan until an admin clicks Send prizes**, and that action is confirmed and
   idempotent.
9. **What fans play and win under locks once a fan starts a run**, by Arthur's table (§3, "The lock"), through
   the existing `ContestLock` mechanism: the contest type (kind `contestType`), the trivia settings
   (`trivia_rules`), the close-time rule (`closesAt`) and the bands (`bandRemoved`, `bandPrize`).
10. **A trivia contest runs only when every tag holds (slots drawing from it) × (runs per fan) questions.**
    Checked on save, on publish and on question bank edits; a contest that can't run is hidden from fans.

## Known gaps (recorded, not blocking a draft)

- **No real-time transport exists in this platform.** The run is designed as request/response per question
  because there is nothing to build a push-based clock on; if a future game type needs true synchronized play,
  that's the point at which a socket layer becomes unavoidable, not before.
- **Reveal-per-question vs. reveal-at-end is left as a per-contest choice with no default decided here** — the
  PRD doesn't specify it and it interacts with `TRV-33` (answer-sharing resistance) in a way worth a tenant's
  own call rather than a hardcoded platform behaviour.
- **`TRV-45`'s reviewed-bands list and `TRV-59`'s exact credit/substitution defaults are open PRD decisions**
  (PRD §16) — this spec implements both as configurable with the PRD's stated defaults, not as fixed values.
- **The mocks are dev-build UI on hardcoded data**, in both frontends, gated by `TRIVIA_MOCK_ENABLED`. They
  show the screens; they save nothing and call nothing. The gate comes out when the endpoints in §2, §4, §5
  and §6 exist and the shared `GAME_TYPES` carries `"trivia"`.
- **The prize library migration** (§1) touches the bingo tier drawer, the tiers `PUT`, and the fulfilment
  worker's read of the prize — the one place this spec changes bingo, and the reason it's a migration with
  `TRV-57` as its acceptance test rather than a new field.
- **Abandoned-run cleanup** — an `in_progress` run with no activity is never expired or surfaced to the fan as
  stale. Left alone for V1; worth a "resume or abandon" prompt if it turns out to confuse fans in practice.

## References

- PRD: [`trivia-game-type.md`](../../../documents/PRD/trivia-game-type.md), every `TRV-*` id.
- [`admin-contests.spec.md`](../../core-modules/1-draft/admin-contests.spec.md), [`admin-games-and-prizes.spec.md`](../../core-modules/1-draft/admin-games-and-prizes.spec.md),
  [`prize-delivery.spec.md`](../../core-modules/1-draft/prize-delivery.spec.md), [`admin-surface.spec.md`](../../core-modules/1-draft/admin-surface.spec.md)
- Code: `obs-b2b-shared/src/interfaces/b2b/{B2BContest,B2BPrizeTiers}.ts`, `obs-b2b-shared/src/models/{b2b,prize-redemption}.ts`,
  `overboard_sports_backend/node-server/src/handlers/board/createBoard.ts`, `overboard_sports_backend/node-server/src/handlers/admin/target-tenant.ts::refuseReadOnlyWrite`,
  `obs-b2b-admin-frontend/src/lib/{gameTypes,useCanWrite}.ts`, `overboard-b2b-template/src/store/api/contestApi.ts`
