# Trivia game type — implementation plan (2026-09-28)

Sources: PRD documents/PRD/trivia-game-type.md, spec/features/1-draft/trivia-game-type.spec.md,
mocks artifact 3YvPe13rhXBsFjadKPBF3K (12 artboards), fan app overboard-b2b-template, backend, shared.

## Current state (verified)
- Fan app: /trivia/:id (TriviaPlayPage, 649 lines) and /trivia/:id/standings already exist, mock-backed via
  src/lib/triviaMock.ts + TRIVIA_MOCK_ENABLED. ContestsPage injects one hardcoded TriviaContestCard.
- Admin app: QuestionBank.tsx, trivia contest fields/bands in CreateContestDrawer — all on triviaMock.ts. UI only.
- Backend + shared: zero trivia code. GAME_TYPES = ["bingo"]. Only prize-library exists (shared by trivia bands).
- No websocket layer anywhere; spec is request/response per question with server-side clock. Fits mocks.

## Mocks vs. what's built (gap list for the fan app)
Built (rough):   Rules/intro, Question, Reveal, Complete, Standings provisional/final, card Open/Runs-left/Final.
Missing:         Resume-run card + in_progress resume, running-score + live bonus counter, "Your runs" page,
                 Run review (Complete re-opened for a past run), Prize detail bottom sheet, tier-progress bar,
                 "around you" leaderboard (spec has /me + standings; needs neighbor rows), Prize-sent card,
                 Contests tab pills "Live & Upcoming / Past".
Spec deltas the mocks introduce (need PRD/spec update): resumable in_progress runs; per-run history endpoint;
"around me" standings slice; prize detail content on bands; per-question reveal assumed as default.

## Phase 0 — Decisions (you)                                      ✅ validate: 15 min
1. Reveal per question is the V1 default (mocks assume it). Tenant toggle deferred.
2. Runs are resumable: GET /b2b/trivia/run resumes in_progress; a run older than N hours is auto-abandoned = scored as-is.
3. Standings payload = top slice + "around me" slice (rank±1) + my summary; drop full list on mobile.
4. Confirm: backend question bank does NOT exist yet, so it is in Phase 3 scope (admin UI is mock-only today).

## Phase 1 — Fan frontend flow on a mock data layer                ✅ validate after each step, in browser
1a. Contract-first types: src/lib/trivia/types.ts mirrors spec endpoints (run, question, answer, standings, me,
    runs history). Build TriviaDataSource interface + MockTriviaDataSource with scenario fixtures.
    Dev switch: ?trivia=<scenario> + DEV floating panel (copy BoardPage pattern). Scenarios: open, in_progress,
    runs_left, no_runs_left, closed_final, prize_sent, timeout, late (answer lost to the network: 0 pts, connection message), substitution.
1b. Play flow rebuild to mocks: Rules → Question (ring timer, bonus counter, running score, sponsor) → Reveal →
    Complete (recap list, provisional rank, points-to-next-band). Timer is anchored on the device at question receipt (clamped to seconds; resume derives remaining from deadlineAt once), and the answer sends clientElapsedMs (revised 2026-10-07; previously derived from servedAt).
1c. Standings (provisional/final), tier-progress bar, around-me rows, Your runs, Run review, Prize detail sheet.
1d. Cards: all 5 trivia states incl. Resume run + Prize sent; Contests tabs. Remove hardcoded card injection.
    Exit: lint clean, every scenario walkable; no real network calls yet.

## Phase 2 — Shared package (obs-b2b-shared repo, then bump 5 pins) ✅ validate: PR review
- GAME_TYPES += "trivia"; flip the contract test. Trivia contest config interface + Zod (slots, runs, seconds,
  base/speed points, network credit, substitution cap, opensAt/closesAt, bands[{from,to,prizeId}]).
- Fan API Zod: run/question/answer/standings/me/runs. Admin API Zod: questions, tags, starter, send-prizes.
- Mongoose-free interfaces so both frontends import types directly.

## Phase 3 — Backend                                               ✅ validate: jest + manual curl per group
3a. Collections + models: trivia_questions, trivia_tags, trivia_starter_questions, trivia_runs, trivia_prize_redemptions.
3b. Admin: question bank / tags / starter copy endpoints; trivia config accepted on contest create/update;
    lock-on-first-run reused. Swap admin frontend off triviaMock.
3c. Fan: POST run (refuseJoin gates, resume), GET question (server clock, idempotent, seen-question exclusion),
    POST answer (first-write-wins, score, network credit, substitution), GET standings (+around me), GET me, GET runs.
3d. Close: settle standings once (settledStandings snapshot). Admin POST send-prizes (reverified, idempotent) →
    existing SQS/prize-worker. Spec promoted 1-draft → 2-approved with Phase 0 deltas recorded.

## Phase 4 — Wire real data                                        ✅ validate: full run on dev tenant
- ApiTriviaDataSource via RTK Query in contestApi.ts; MockTriviaDataSource stays behind the dev switch.
- Contest list merges trivia contests from real GET contests (gameType discriminator).
- End-to-end: admin creates trivia contest → fan plays 2 runs → close → settle → send prizes → email.

## Agent split
Sonnet: 1a fixtures/data layer, 1c pages, 1d cards, 3a models, 3b admin, tests. Opus: 1b timer/scoring UX,
3c fan endpoints (timing/idempotency), Phase 2 contract design. Each step = one agent, reviewed before next.
