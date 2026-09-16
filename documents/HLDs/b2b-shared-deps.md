# HLD: B2B Shared Dependencies

**Status:** Approved design. Not yet implemented.

## Purpose

A single repository — `obs-b2b-shared` — owned by the B2B platform and consumed by all five B2B runtimes: `node-server`, the two Lambda evaluators, `prize-worker`, the fan frontend, and the admin console.

It exists to give B2B a dependency it controls. Today B2B's models live in `pb-shared-deps`, a repo shared with the D2C mobile app and website. That coupling has concrete costs: B2B work happens on a long-lived branch of someone else's repo, B2B schema changes merge-conflict with D2C changes, and B2B carries 25 interfaces of which it uses 9.

**This document describes the target design, not the migration.** See "Boundaries" for what deliberately stays out — including the 2026-09-16 ruling that opened a narrow door for shared UI, and the test anything must pass to come through it.

---

## Consumers and Layers

Layers, distinguished by what they may depend on at runtime. This is the core rule of the repo.

| Layer | Runtime dependencies | Consumable by |
|---|---|---|
| `interfaces/` | **none** | everything, including the browser |
| `api/` | `zod` only | everything, including the browser |
| `entry-gate/` | **none** | everything, including the browser |
| `ui/` | `react` (peer) | **frontends only** — never a backend consumer |
| `models/` | `mongoose` | backend only |

```
        ┌──────────────────┐        ┌──────────────────┐
        │  fan frontend    │        │  admin console   │
        └────────┬─────────┘        └────────┬─────────┘
                 │  interfaces/, api/, entry-gate/, ui/  │
                 └──────────────┬───────────────────────┘
                                ▼
    ┌───────────────────────────────────────────────────────┐
    │                   obs-b2b-shared                      │
    │   interfaces/   api/   entry-gate/   ui/   models/    │
    └───────────────────────────────────────────────────────┘
                                ▲
              interfaces/, api/, models/  — never ui/
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
   ┌────┴──────┐        ┌───────┴─────┐        ┌────────┴────┐
   │node-server│        │  lambdas    │        │prize-worker │
   └───────────┘        └─────────────┘        └─────────────┘
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

**Relative imports always carry `.js` extensions**, in every layer including `entry-gate/` and `ui/`. `node-server` uses `moduleResolution: NodeNext`, which requires them; the frontend uses `bundler`, which tolerates them. Extensions satisfy both; omitting them breaks the backend. `ui/` is frontend-only and could get away without them, but one convention across the repo beats a per-directory exception nobody remembers — and `ui/` imports `entry-gate/`, which is not frontend-only.

**`models/` is backend-only.** Nothing in the frontend may import from it. **Decided (2026-08): not enforced by tooling** — with `models/` obviously Mongoose-flavoured, a frontend developer reaching for it is not a realistic failure mode. Revisit only if it actually happens.

**`entry-gate/` has no runtime dependencies and is consumable everywhere** (added 2026-09-16). It holds the fan entry gate's field catalog metadata, its user-facing copy, and its client-side validation — the parts of the gate that are neither markup nor data access. Same constraint as `interfaces/`, same reason: no dependencies is what keeps it browser-safe, and "no runtime dependencies" has never meant "no runtime code" in this repo.

**`ui/` may import `react` and the dependency-free layers, nothing else** (added 2026-09-16). React is a peer dependency, declared as such so the two frontends' own copies are used rather than a second one bundled. Backend consumers — `node-server`, the Lambdas, `prize-worker` — must never import from it; unlike `models/`, this one is worth stating loudly, because a backend that imports React does not fail obviously, it just gets heavier.

**`ui/` must contain no data access.** No `fetch`, no Clerk, no RTK Query, no router — the components are presentational and controlled, and their consumers supply state and handlers. This is the rule that lets the admin console render the fan's entry gate as a live preview and truthfully tell the admin that nothing they type is sent anywhere ([`admin-fields-and-optins.spec.md`](../../spec/core-modules/1-draft/admin-fields-and-optins.spec.md), Rule 10). It is a property of what is in the directory rather than a convention: if no such import exists, no such call can happen.

---

## What Lives Here

### `interfaces/`
Types **and dependency-free logic**. Despite the name, this layer also holds shared behaviour with no runtime dependencies: `getEventStatus`, `getB2BContestStatus`, `isStarEntity`, `bettingPropIsLocked`, and the prop/entity validators. That is intentional — it is genuinely shared logic, and having no dependencies is what keeps it browser-safe. The constraint is "no runtime dependencies", not "no runtime code".

- **`b2b/`** — `B2BOrganization`, `B2BContest`, `B2BPrizeTier`, `B2BBoard`, `B2BUser`, `PrizeRedemption`. Owned outright by B2B.
- **`reference/`** — `BettingProp`, `BetEvent`, `Entity`. The read contract for data B2B does not own (see "Reference Data" below).

### `api/`
Zod schemas defining the HTTP contract — request bodies, query params, response shapes — plus their inferred types. Organized by resource (`board`, `contest`, `org`, `user`), not by runtime.

### `entry-gate/`
The fan entry gate's shared definitions, each existing exactly once for both renderers (the fan app and the admin console's live preview).

- **`fields.ts`** — the signup field catalog metadata: label, input type, ordering rules. Previously duplicated three ways — `FIELD_META` in the fan app and `FIELD_LABELS` in two console screens — which had already disagreed on two labels.
- **`copy.ts`** — every string the gate renders.
- **`validation.ts`** — the gate's client-side validation and the returning-mode CTA gating. Not the server's enforcement, which is independent and stays that way (`entry-gate.spec.md`, "Blocking behavior").

### `ui/`
React components. `entry-gate/` holds `EntryGateForm` (controlled, rendered by the fan app's `JoinTenant.tsx`), `EntryGatePreview` (self-contained and walkable, rendered by the admin console), and one stylesheet of `obs-gate-*` classes reading the fan theme's CSS variables so a consumer can scope the palette to a wrapper.

### `models/`
Mongoose schemas. Collection names derive from `B2B_COLLECTION_PREFIX` so each dev stack is isolated; see [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md).

- **`b2b.ts`** — the five B2B models plus `PrizeRedemption` (moved out of `prize-worker/src`, where it was the only B2B model living outside a shared package).
- **`reference.ts`** — read-only models bound to the `readonly_*` replica collections.

---

## What Does *Not* Live Here

**Board-generation logic** (`createFilledBoard`, prop-conflict detection, position ordering) lives in **`node-server`**, which is its only consumer. It is a deliberate fork of D2C's implementation rather than a shared module: PRD `GAME-F1` anticipates B2B growing game types D2C will not have (scratch-off, pick-3, over/under), so the two are expected to diverge. Name it for the game (`bingo/`) so a second type is an addition rather than a rename.

**Runtime helpers** — response builders, the Mongo connector — live in whichever service uses them. `build_response` differs between Express and Lambda anyway, and duplication across the Lambdas is fine; an abstraction over two callers would cost more than it saves.

The result was that this repository contained **no runtime code at all** — only types, contracts, and schemas, a data-shape dependency rather than a library. **That held until 2026-09-16**, when `entry-gate/` and `ui/` arrived; see "Shared UI, reversed" below for why and for how narrow the opening is.

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

**Not a general OBS shared library.** `pb-shared-deps` continues to exist and serve the D2C products. This repo is B2B's, and its scope is what the five B2B runtimes need.

### Shared UI, reversed (ruling 2026-09-16, Arthur)

**Frontend UI components did not belong here.** That rule came from retiring the `core` submodule, and its reasoning was sound for what it was aimed at: a general component library shared "because both frontends have buttons" earns a version-pinned dependency between two apps that have no reason to look alike. The fan app is tenant-branded and mobile-portrait; the console is one deployment with its own theme. They should not share a design system.

**The reversal is narrow and has a different justification.** `ui/entry-gate/` is not a component library — it is *one screen that two apps must render identically*, because one of them exists to preview the other. The console's Fields & Opt-ins screen shows an admin what a fan will see; the only way for that to be true rather than approximately true is for both to run the same code ([`admin-fields-and-optins.spec.md`](../../spec/core-modules/1-draft/admin-fields-and-optins.spec.md)). The alternative was tried before anyone chose it: the catalog's field labels were already copied three ways and two of them had drifted.

So the admitting test is not "is it a component" but **"would two copies be a bug?"** A shared `Button` fails that test — two buttons differing is fine, even desirable. The entry gate passes it: two entry gates differing is the exact defect the preview is built to prevent. Anything that fails the test still lives in the frontend that uses it, and the `core` decision stands for everything it actually covered.

**Not in this repo, still:** a design system, shared theme tokens, layout primitives, or any component either app could reasonably render its own way.

---

## Consequences

**What improves:** B2B schema changes stop conflicting with D2C work. B2B stops carrying 16 unused interfaces. The HTTP contract is single-sourced between frontend and backend. There is one shared repo for B2B instead of two (`pb-shared-deps` + `core`) — at the time of this decision that cut the vendored checkouts from five to four, though the admin console has since added a fifth of the single repo.

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
- [`spec/core-modules/1-draft/admin-fields-and-optins.spec.md`](../../spec/core-modules/1-draft/admin-fields-and-optins.spec.md) — the live entry-gate preview, the reason `entry-gate/` and `ui/` exist
- [`spec/webapp/entry-gate.spec.md`](../../spec/webapp/entry-gate.spec.md) — the fan-side screen whose presentation moved here
