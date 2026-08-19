# Backend Baseline — `overboard_sports_backend/node-server`

> Part of [POC Baseline](README.md) — reflects the code as built during the POC phase, not target architecture.

## Stack

Express `4.21.0`, Mongoose `8.0.0`, `@clerk/express` `1.0.0`, Zod `4.3.6`, `cors` `2.8.5`, TypeScript `~5.6.0`. Runs as a Docker container (`node:20-alpine`) on ECS Fargate — see [`infra.md`](infra.md).

## Routing Pattern

A small declarative router (`routes/route_config.ts` + `routes/index.ts`): each route entry specifies method/path/handler plus optional `auth`, `bodySchema`, `querySchema`, `responseSchema`. Middleware order is fixed: **validate → auth → handler**. Handlers return a plain `{statusCode, body}` object rather than writing to `res` directly; `wrap_handler.ts` sends it and, if a `responseSchema` is set, re-validates the outgoing body against it (500 on contract violation). This is a solid, well-structured pattern — worth preserving in the target spec even though its actual usage (below) has gaps.

## Full Route Table

| Method | Path | Handler | Auth |
|---|---|---|---|
| GET | `/health` | `healthHandler` | none |
| GET | `/api/me` | `meHandler` | `requireAuth` |
| GET | `/api/test-me` | `testMeWithUserParamHandler` | `requireAuth` + param match |
| PUT | `/api/test-object` | `createOrUpdateTestObject` | `requireAuth` |
| POST | `/b2b/board/generate` | `generateB2BBoard` | `requireAuth` + `clerkUserId` match |
| GET | `/b2b/board/my-boards` | `listB2BBoards` | `requireAuth` + `clerkUserId` match |
| GET | `/b2b/board/:boardId` | `getB2BBoard` | **none** |
| GET | `/b2b/contest/list-contests` | `listB2BContests` | **none** |
| GET | `/b2b/contest/:contestId` | `getB2BContestPlayers` | **none** |
| POST | `/b2b/contest/prize-tier` | `createB2BPrizeTier` | **none** |
| GET | `/b2b/org/:subdomain` | `getOrganization` | **none** |
| POST | `/b2b/user/b2b-create-user` | `createB2BUser` | **none** |

The repo's own `b2b-routes-list.txt` (a migration checklist) labels most of these `AUTH: none` — this is a known, acknowledged state from the author, not an oversight found only in this audit.

## Auth Middleware (`middleware/auth.ts`)

- `requireAuth`: reads the Clerk session already parsed by the global `clerkMiddleware()`, 401s if no `userId`, otherwise sets `req.authUserId`/`req.authSessionId`.
- `requireUserParam(source, key)`: compares a claimed ID in `params`/`query`/`body` against `req.authUserId`, 403 on mismatch.
- **This is the entire authorization model.** There is no role/permission concept and no organization-membership check anywhere. Where auth exists, it only ever verifies "is this the same Clerk user" — never "does this user belong to the organization that owns the resource being touched." See [`known-issues.md`](known-issues.md) for the concrete cross-tenant exposure this creates.

## Validation (`middleware/validate.ts`)

`validateBody`/`validateQuery` — Zod `safeParse`, 400 with field errors on failure. Applied **per-route, opt-in** (not global). Every route that accepts a body/query does have a schema wired, so where it's used it's applied consistently — but validation doesn't substitute for the missing auth on 6 of 12 routes above.

## Handlers (`node-server/src/handlers/`)

- `board/createBoard.ts` — board generation, see below.
- `board/getB2BBoard.ts`, `board/listB2BBoards.ts` — reads, deep-populate props/contest/prize tiers.
- `contest/listB2BContests.ts`, `contest/getB2BContestPlayers.ts`, `contest/createB2BPrizeTier.ts`.
- `org/getOrganization.ts` — lookup by subdomain only.
- `user/createB2BUser.ts` — creates a `B2BUser`; accepts `optInConsents`/`pushToken` in its input type (see Data Models below for what happens to them).
- `health.ts`, `me_handler.ts`, `test_object_handlers.ts` (dev/QA scratch endpoint).

## Board Generation

`createBoard.ts` (`generateB2BBoard`):
1. Guards against a duplicate board for the same `(contestId, clerkUserId)`.
2. Loads the contest, collects `Prop` docs for its allowed bet events, filters to the caller's drafted `playerIds`.
3. Calls a risk-weighted random selection algorithm (`pb-shared-deps/interfaces/Board.ts`) that maps a risk range onto prop multipliers, avoids conflicting props, and tries to avoid single-team boards.
4. **Two fallback passes in the handler backfill any unfilled cell** — first from leftover player props, then from a shuffled pool of *any* prop regardless of the drafted-player list. This means the "board is about players you drafted" guarantee can silently break if the drafted pool is too thin.

## Win/Parlay Detection

**Not** done via the shared `pb-shared-deps/interfaces/score.ts` — that file is legacy, single-tenant-only scoring code with zero B2B references. Actual B2B win detection lives in the `board-evaluator` Lambda (see [`workers.md`](workers.md)), which independently defines the 8 winning lines and checks cell hit-state itself.

## Data Models

Mongoose schemas live in the `pb-shared-deps` submodule (`b2b_models.ts`), **vendored separately in three places** across the backend repo (`lambdas/`, `node-server/src/`, `prize-worker/`) — each pinned to a **different commit**. The backend's own `TODO` file flags this ("fix submodules"). Collection names are prefixed `cdk_test_*` — a non-production-sounding stage name baked into the schema.

**B2B-specific models:**
- `B2BOrganization` — `subdomain` (unique), `name`. No sponsor/DPA-scoping fields.
- `B2BPrizeTier` — `threeInARows`, `handlerId` (free-text string routing to a fulfillment handler), `prizeName`/`prizeDescription`, optional image/claim URL+text.
- `B2BContest` — org ref, allowed bet events, participant caps, `prizeTiers` ref array, `finalized`/`closed`/`showContest` flags.
- `B2BBoard` — contest ref, `clerkUserId` (indexed, **not unique** — no DB-level guarantee of one board per user per contest), 9 position refs, `parlaysHit`, `claimedLineIndices`.
- `B2BUser` — `clerkUserId` (unique), `organizationId` ref, `tenantSlug`, `email`, `displayName`. Compound unique index on `{email, organizationId}`. **No `optInConsents` field, no consent/marketing field of any kind.**

**Critical gap — opt-in consent is silently discarded.** The Zod request schema for user creation *does* model granular, timestamped, per-opt-in consent (`optInConsents: [{messageId, agreedAt}]` — structurally close to what PRD `OPT-04` needs), and the handler passes it through to `B2BUserModel.create()`. But the Mongoose schema has no matching field, and Mongoose's default strict mode silently drops any field not declared in the schema. **Whatever consent data a client sends is accepted with a 201 and then discarded before it reaches the database** — this doesn't fail loudly, so it wouldn't be caught by casual API testing.

**Indexing**: no index exists on `B2BBoard`'s 9 position fields, despite the prop-update-evaluator Lambda doing a `$or` query across all 9 for every prop update — the backend's own `docs/PROP_UPDATE_EVALUATOR_PLAN.md` flags this as a known, deferred gap. Both DB connectors set `autoIndex: false`, meaning even schema-declared indexes aren't auto-synced to the live Atlas cluster.

Other schemas in `models.ts` (`Contest`/`User`/`Prop`/`Board`/`BetEvent`/`PromoCode`/etc.) are pre-existing, single-tenant D2C app models, unrelated to the B2B product except that B2B `Prop`/bet-event data is read from the same collections (per PRD `GAME-C1`).

**Confirmed constraint: these legacy models are live, actively serving the D2C mobile app in production, and cannot be modified.** Any B2B-driven schema or indexing work must be additive (new `B2B*` models/fields) rather than touching `Contest`/`User`/`Board`/`Prop` directly.

## Tenant/Org Provisioning

**Fully manual.** No admin endpoint, no CLI/script, no seed data creates a `B2BOrganization` anywhere in the repo — only the read-only `getOrganization` handler exists. New tenants are provisioned by direct MongoDB writes outside any application code path (corroborated by the backend's root `TODO`: "Get Database Access Configured for the Task").

## Testing

**Effectively none.** `test/overboard_sports_backend.test.ts` contains one test with all assertions commented out (leftover CDK-init boilerplate). No tests exist for any handler, middleware, or route. The backend's own `TODO` lists "Figure out how to test the functions" as unresolved.

## Reporting/Exports

**Entirely absent.** No CSV generation, no sponsor-scoped export, no opt-in-filtered export logic, no reporting route — nothing in the codebase touches this area at all (PRD `RPT-01`–`RPT-07`).

See [`known-issues.md`](known-issues.md) for the consolidated, PRD-mapped list of gaps across this and the other layers.
