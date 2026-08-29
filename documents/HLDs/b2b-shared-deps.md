# HLD: B2B Shared Dependencies

**Status:** Approved design. Not yet implemented.

## Purpose

A single repository — `obs-b2b-shared` — owned by the B2B platform and consumed by all four B2B runtimes: `node-server`, the two Lambda evaluators, `prize-worker`, and the frontend.

It exists to give B2B a dependency it controls. Today B2B's models live in `pb-shared-deps`, a repo shared with the D2C mobile app and website. That coupling has concrete costs: B2B work happens on a long-lived branch of someone else's repo, B2B schema changes merge-conflict with D2C changes, and B2B carries 25 interfaces of which it uses 9.

**This document describes the target design, not the migration.** See "Boundaries" for what deliberately stays out.

---

## Consumers and Layers

Three layers, distinguished by what they may depend on at runtime. This is the core rule of the repo.

| Layer | Runtime dependencies | Consumable by |
|---|---|---|
| `interfaces/` | **none** | everything, including the browser |
| `api/` | `zod` only | everything, including the browser |
| `models/` | `mongoose` | backend only |

```
                    ┌──────────────┐
                    │  frontend    │
                    └──────┬───────┘
                           │ interfaces/, api/
                           ▼
    ┌──────────────────────────────────────────────┐
    │            obs-b2b-shared                    │
    │       interfaces/    api/    models/         │
    └──────────────────────────────────────────────┘
                           ▲
              interfaces/, api/, models/
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────┴─────┐     ┌──────┴──────┐    ┌──────┴──────┐
   │node-server│    │  lambdas    │    │prize-worker │
   └───────────┘    └─────────────┘    └─────────────┘
```

### Layer rules

**`interfaces/` must not import Mongoose.** ID fields are *generic over their representation* rather than pinned to one type:

```ts
export interface B2BContest<TId = string> {
  organizationId: TId;
  allowedBetEvents: TId[] | BetEvent[];
}
```

The frontend gets `string` from the default (JSON has already serialised IDs); `models/` instantiates `B2BContest<Types.ObjectId>` so Mongoose schemas type-check. One definition serves both, with no duplication.

This detail is load-bearing. An earlier draft simply typed IDs as `string`, which made the interfaces browser-safe but broke every Mongoose schema built from them — `new mongoose.Schema<B2BContest>` cannot declare an `ObjectId` field for a property typed `string`. The generic is what reconciles the two.

Not every `*Id` field is an ObjectId: `clerkUserId` (Clerk's own identifier) and `handlerId` (a free-text handler key) are genuine strings and stay `string`. Response shapes (`B2BContestResponse`, `B2BBoardResponse`) are already-serialised and likewise use plain `string`.

This is the rule that makes frontend sharing safe rather than accidental. Today's interfaces *do* import Mongoose and only work in the browser because every frontend import happens to be `import type`, which TypeScript erases. One value import would put Mongoose in the client bundle. The frontend already carries a workaround for this (`src/types/board.ts`, which re-declares a board type to dodge the ObjectId import) — that file should disappear once this rule holds.

**`api/` may import `zod` and `interfaces/`, nothing else.** Zod is a runtime dependency, but one the frontend already ships. Sharing these schemas makes the HTTP contract single-sourced: the server validates with them, the frontend derives request/response types from them, and the two cannot silently disagree.

**Relative imports always carry `.js` extensions.** `node-server` uses `moduleResolution: NodeNext`, which requires them; the frontend uses `bundler`, which tolerates them. Extensions satisfy both; omitting them breaks the backend.

**`models/` is backend-only.** Nothing in the frontend may import from it. **Decided (2026-08): not enforced by tooling** — with the repo reduced to three layers and `models/` obviously Mongoose-flavoured, a frontend developer reaching for it is not a realistic failure mode. Revisit only if it actually happens.

---

## What Lives Here

### `interfaces/`
Types **and dependency-free logic**. Despite the name, this layer also holds shared behaviour with no runtime dependencies: `getEventStatus`, `getB2BContestStatus`, `isStarEntity`, `bettingPropIsLocked`, and the prop/entity validators. That is intentional — it is genuinely shared logic, and having no dependencies is what keeps it browser-safe. The constraint is "no runtime dependencies", not "no runtime code".

- **`b2b/`** — `B2BOrganization`, `B2BContest`, `B2BPrizeTier`, `B2BBoard`, `B2BUser`, `PrizeRedemption`. Owned outright by B2B.
- **`reference/`** — `BettingProp`, `BetEvent`, `Entity`. The read contract for data B2B does not own (see "Reference Data" below).

### `api/`
Zod schemas defining the HTTP contract — request bodies, query params, response shapes — plus their inferred types. Organized by resource (`board`, `contest`, `org`, `user`), not by runtime.

### `models/`
Mongoose schemas. Collection names derive from `B2B_COLLECTION_PREFIX` so each dev stack is isolated; see [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md).

- **`b2b.ts`** — the five B2B models plus `PrizeRedemption` (moved out of `prize-worker/src`, where it was the only B2B model living outside a shared package).
- **`reference.ts`** — read-only models bound to the `readonly_*` replica collections.

---

## What Does *Not* Live Here

**Board-generation logic** (`createFilledBoard`, prop-conflict detection, position ordering) lives in **`node-server`**, which is its only consumer. It is a deliberate fork of D2C's implementation rather than a shared module: PRD `GAME-F1` anticipates B2B growing game types D2C will not have (scratch-off, pick-3, over/under), so the two are expected to diverge. Name it for the game (`bingo/`) so a second type is an addition rather than a rename.

**Runtime helpers** — response builders, the Mongo connector — live in whichever service uses them. `build_response` differs between Express and Lambda anyway, and duplication across the Lambdas is fine; an abstraction over two callers would cost more than it saves.

The result is that this repository contains **no runtime code at all** — only types, contracts, and schemas. That is the point: it is a data-shape dependency, not a library.

---

## Reference Data

`BettingProp`, `BetEvent`, and `Entity` describe collections B2B **does not own**. They are written by the D2C stats pipeline and reach B2B as read-only replicas (`readonly_*`).

B2B keeps its own copy of these definitions rather than importing them. That is duplication by design: it is what lets B2B stop depending on `pb-shared-deps` entirely, and B2B only ever reads these collections, never writes them.

**Copy the definitions in full** (decided 2026-08, after an attempt at narrowing).

Narrowing to only the fields B2B reads is the better end state — smaller drift surface, and it documents the real dependency. It was attempted and abandoned because **the field list cannot be determined reliably by inspection**. Text search cannot distinguish `prop.value` from any other `value`; a scan of every field name against the B2B codebase reported near-universal usage because the names are common English words (`type`, `value`, `position`, `status`). Acting on that would have produced a confidently wrong answer.

The reliable method is compiler feedback: trim fields, compile every consumer, and let the type errors name what is actually required. That requires the consumers to be cut over first, so it is follow-up work rather than a precondition.

**The drift risk is real and unmitigated.** If the D2C pipeline adds or changes a field, B2B's copy silently falls behind; the replicated documents will contain data B2B's types don't describe. Since B2B only reads, the failure mode is missing data rather than corruption — but there is no mechanism that detects it. Narrowing reduces the surface without removing the risk.

---

## Boundaries

**Not in this repo:** anything D2C-owned. No `Contest`, `User`, `Board`, `PromoCode`, `Transaction`, `AttendantCall`, `PaymentCode`, `Relationship`, `DeferredLinking`, `ContentBanner`, `UserNotificationPreferences`, `Team`, `Sport`, or the legacy `score.ts`. B2B imports none of them today, and adding one should be treated as a signal that the boundary is wrong rather than as a routine change.

**Not a general OBS shared library.** `pb-shared-deps` continues to exist and serve the D2C products. This repo is B2B's, and its scope is what the four B2B runtimes need.

**Frontend UI components do not belong here.** Those live in the frontend, per the separate decision to retire the `core` submodule.

---

## Consequences

**What improves:** B2B schema changes stop conflicting with D2C work. B2B stops carrying 16 unused interfaces. The HTTP contract is single-sourced between frontend and backend. There is one shared repo for B2B instead of two (`pb-shared-deps` + `core`), vendored in four places instead of five.

**What gets worse:** reference definitions and board-generation logic exist in two places and can diverge, with nothing detecting it. That is the price of decoupling, accepted knowingly.

**What does not change:** the multi-checkout submodule pattern. Each consumer still vendors this repo and can still pin different commits — the same drift problem `pb-shared-deps` has today, at smaller scale. Whether to solve that (a published package, a monorepo, CI pin-checking) is a separate question this design does not answer.

---

## Open Items

1. ~~Distribution mechanism.~~ **Decided (2026-08): git submodule**, matching the existing pattern. This keeps the multi-checkout pin-drift problem `pb-shared-deps` has today, at smaller scale — see Consequences.
2. ~~Enforcing the layer rule in tooling.~~ **Decided: not enforced.** See "Layer rules".
3. ~~Whether to narrow the reference models.~~ **Reversed (2026-08): full copies for now.** Narrowing is still the goal but cannot be determined by inspection — it needs compiler feedback after cutover. See "Reference Data".
4. ~~Whether the frontend adopts `api/`.~~ **Decided: yes** — the frontend's hand-maintained request/response types are replaced by the shared Zod schemas and their inferred types, making the HTTP contract single-sourced.

One follow-up remains: narrowing the reference definitions once consumers are cut over and the compiler can identify the required fields.

---

## Related

- [`spec/core-modules/2-approved/mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md) — collection naming and the `readonly_*` replicas these models bind to
- [`documents/POC-baseline/known-issues.md`](../POC-baseline/known-issues.md) — the `pb-shared-deps` drift and branch-divergence problems motivating this
- PRD [`GAME-F1`](../PRD/OBS_B2B_Platform_PRD.md) — future game types, the reason `game/` is forked rather than shared
