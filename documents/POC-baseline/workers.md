# Workers Baseline — Lambda Evaluators & Prize Worker

> Part of [POC Baseline](README.md) — reflects the code as built during the POC phase, not target architecture.

Covers `overboard_sports_backend/lambdas/` (`board-evaluator`, `prop-update-evaluator`) and `overboard_sports_backend/prize-worker/`.

## Pipeline Overview

```
[external stats system] → prop-hit queue (SQS)
        → prop-update-evaluator Lambda
        → board-evaluation queue (SQS)
        → board-evaluator Lambda
        → prize-fulfillment queue (SQS FIFO)
        → prize-worker (Fargate, long-poll)
        → fulfillment handler (email/webhook/barcode by handlerId)
```

Each queue has a DLQ with a CloudWatch alarm on message depth (see [`infra.md`](infra.md)).

## `prop-update-evaluator` Lambda

Triggered by SQS event source on the `prop-hit` queue (batch size 1). On each message (`{propId, type, timestamp}`): validates `propId`, queries `B2BBoardModel.find({$or: [...9 position-field equality clauses]})` — **unindexed**, a known/documented gap (see `docs/PROP_UPDATE_EVALUATOR_PLAN.md` and [`backend.md`](backend.md)) — and enqueues one `board-evaluation` message per matching board.

**Nothing in this repo publishes to the `prop-hit` queue.** The producer — something that watches live game stats and detects a prop "Hit" — is external to this repo and wasn't found or verifiable here.

Implementation matches the repo's own design doc (`docs/PROP_UPDATE_EVALUATOR_PLAN.md`) closely, including its idempotency approach — a rare case of a plan and shipped code staying in sync. The plan's own "optional" callouts (indexing the position fields, sharing the message-interface type between the two Lambdas) were not done.

## `board-evaluator` Lambda

Triggered by SQS on the `board-evaluation` queue (batch size 1). On each message (`{boardId, type: 'prize-winning', timestamp}`): loads the board with `readConcern('linearizable')` (strong consistency), independently defines the 8 winning lines (3 rows, 3 cols, 2 diagonals — this logic is **not** shared with the frontend's client-side duplicate, see [`webapp.md`](webapp.md)), checks each unclaimed line against `consensusOutcome === 'Hit'`, and — idempotently, using `claimedLineIndices` already on the board — sends one `IPrizeFulfillmentMessage` per newly completed line to the FIFO `prize-fulfillment` queue with a deterministic dedup ID.

## `prize-worker` (Fargate, not a Lambda)

Despite the "Lambda workers" framing in the repo's top-level README, prize fulfillment runs as a **second Fargate service** — a long-poll loop (20s wait, one message at a time) against the `prize-fulfillment` FIFO queue.

Per message:
1. Starts a Mongo transaction, checks for an existing `PrizeRedemption` on a unique compound index (`{userId, contestId, tierIndex, boardId}`) — **idempotency is real and DB-enforced**, not just best-effort.
2. Creates a `pending` redemption if new.
3. Finds the matching `B2BPrizeTier` and looks up its fulfillment handler by `handlerId` (free-text string) via a `Map` registry.
4. Invokes the handler, marks the redemption `fulfilled`/`failed`/`skipped`.
5. On a thrown error, the SQS message isn't deleted — it's redriven by visibility timeout up to `maxReceiveCount: 3`, then lands in the FIFO DLQ.

### Fulfillment Handlers (`fulfillment-handlers.ts`)

| Handler ID | Status |
|---|---|
| `email` | Stub — `console.log` only, `// TODO: send email (e.g. SES)` |
| `email-test` | Stub |
| `webhook` | Stub — `// TODO: POST to configured webhook URL` |
| `barcode` | Stub — `// TODO: generate/store barcode` |
| `handler_001` | **Real** — sends an SES email from a static HTML template on disk |
| `handler_002` | **Real** — same pattern, different template |

The only two working handlers use a **hardcoded subject line** (`"Hawk Bingo: Claim Your Prize - {prizeName}"`) baked into shared worker code — not sponsor- or org-configurable, despite prize tiers being per-tenant/per-sponsor. SES sender address (`nick@overboardsports.com`) is hardcoded in two files rather than environment-configurable.

**No coupon-code generation, assignment, or dedup logic exists anywhere.** Prize delivery today is "send one of two fixed HTML emails" — there's no persisted code inventory, no per-user unique code issuance, despite PRD `PRIZE-05`/`PRIZE-06` describing sponsor-supplied coupon batches with no-duplicate-assignment guarantees.

`send-three-in-a-row-email.ts` is dead code — defined, exported, never called from `worker.ts` or the handler registry. It sends a placeholder notification to a hardcoded personal email address.

## Assessment

The queue plumbing, idempotency, and DLQ/alerting infrastructure across this whole pipeline are solid and already close to production-shaped. The gap is entirely in **fulfillment**: the extensible `handlerId → handler` registry pattern is the right shape for PRD `PRIZE-05`'s "custom logic per sponsor" requirement, but 4 of 6 registered handlers are no-ops, and the two that work are hardcoded to one brand's copy with no coupon-code capability at all.

**Confirmed direction (2026-08): fulfillment is meant to be bespoke, per-sponsor code** — this isn't a pattern that needs to be replaced with something more generic, it's the explicit exception PRD `PRIZE-05` carves out. The work here is writing more handlers and coupon-code infrastructure as sponsors need it, not redesigning the registry.

See [`known-issues.md`](known-issues.md) for the consolidated gap list.
