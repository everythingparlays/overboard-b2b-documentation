# Core Module Spec: MongoDB Access Isolation

**Implements:** [`documents/HLDs/data-access-isolation.md`](../../../documents/HLDs/data-access-isolation.md) — read that first for requirements `DATA-01`–`04` and the definitions of "B2B collections" / "non-B2B collections". This document is the *how*.

## Overview

B2B gets its own database per environment. Each contains B2B's own collections plus a continuously-replicated, read-only mirror of the three non-B2B collections B2B needs. Atlas Database Triggers do the replication. After this, no B2B credential connects to the shared database, and no other system's credential can reach B2B data.

**The whole change, in one line:** point B2B at a different database that already contains everything it needs.

**Stack:** MongoDB Atlas Database Triggers (Atlas App Services) for replication; Atlas custom DB roles for scoping. No new AWS infrastructure, no new CDK constructs, no new always-on compute.

---

## Naming Conventions

| Thing | Convention | Values |
|---|---|---|
| Atlas cluster | unchanged | `PBingo-dev` (existing — no new cluster) |
| Atlas project | unchanged | `PB-dev` (existing — no new project) |
| B2B databases | match the AWS account name they serve, so there is one vocabulary across AWS and Atlas | `obs-b2b-prod`, `obs-b2b-dev` |
| Source database | unchanged | `PBingo-fullappdev-database` |
| B2B's own collections | bare plural noun — the database name already says "B2B", so a `b2b_` infix would be redundant | `organizations`, `contests`, `boards`, `users`, `prize_tiers`, `prize_redemptions`, `test_objects` |
| Replicated collections | `readonly_` prefix — self-documenting at a glance in any client, and sorts the replicas together in a collection listing | `readonly_betevents`, `readonly_props`, `readonly_entities` |
| Atlas trigger | `replicate-<collection>-<target>` | `replicate-props-prod`, `replicate-props-dev`, … |
| Atlas custom roles | `<consumer>-<scope>` | `b2b-app-readwrite`, `b2b-replicator` |

The `cdk_test_` stage prefix is dropped everywhere — it was never meaningful (it is a hardcoded literal, not a real stage) and actively misleads people into thinking production data is test data.

**The `readonly_` prefix is a convention, not an enforcement mechanism.** It tells a developer reading a collection list which data is a replica. The actual guarantee comes from the Atlas role (see "Atlas Roles and Users") — and, more fundamentally, from the fact that writing to a replica accomplishes nothing, since the next source change overwrites it.

### Code changes this requires

Renaming is not free — it is a change in `pb-shared-deps`, which is shared with the D2C app. Scoped carefully, it is small:

| File | Change | Risk to D2C |
|---|---|---|
| `pb-shared-deps/models.ts` | `const stageName = process.env.LEGACY_COLLECTION_PREFIX ?? "cdk_test"` | **None** — D2C leaves the variable unset and keeps `cdk_test_*` exactly as today. B2B services set it to `readonly`. |
| `pb-shared-deps/b2b_models.ts` | Replace `` `${stageName}_b2b_organizations` `` with `'organizations'`, etc. | **None** — D2C does not use this file. |
| `prize-worker/src/prize-redemption-model.ts` | Already `process.env.STAGE_NAME ?? 'cdk_test'`; set collection to `'prize_redemptions'` | **None** |

This follows a pattern the codebase already uses — `prize-redemption-model.ts` is env-driven today.

Separately, creating Atlas database users by hand (see "No Atlas API key lives in an AWS account") removes `CfnDatabaseUser` and the `awscdk-resources-mongodbatlas` dependency from `lib/constructs/main-api-service.ts` and `lib/constructs/prize-delivery.ts`. ECS tasks keep authenticating via Atlas IAM exactly as they do today — only the *provisioning* of the database user moves out of CDK, not the auth mechanism.

**Caveat worth knowing:** setting `LEGACY_COLLECTION_PREFIX=readonly` renames *every* collection in `models.ts` for B2B services, not just the three replicated ones — so `models.User` would resolve to `readonly_users`, which will not exist in the B2B databases. That is harmless because B2B never queries those models (verified: B2B touches only `Prop`, `BetEvent`, `Entity`), but the failure mode if that ever changed is a query returning empty rather than erroring loudly. If that becomes a concern, give the three replicated models explicit `collection:` values instead of a shared prefix.

---

## Collection Placement

### `obs-b2b-prod` and `obs-b2b-dev` (new — identical structure)

**B2B's own collections** — read-write by B2B services. Migrated from the source database for prod; start empty for dev (then seeded, see cutover step 7).

| New name | Migrated from | Model | Prod rows |
|---|---|---|---|
| `organizations` | `cdk_test_b2b_organizations` | `B2BOrganization` | small |
| `contests` | `cdk_test_b2b_contests` | `B2BContest` | small |
| `prize_tiers` | `cdk_test_b2b_prize_tiers` | `B2BPrizeTier` | small |
| `boards` | `cdk_test_b2b_boards` | `B2BBoard` | 24 |
| `users` | `cdk_test_b2b_users` | `B2BUser` | 16 |
| `prize_redemptions` | `cdk_test_prize_redemptions` | `PrizeRedemption` | small |
| `test_objects` | `cdk_test_b2b_test_objects` | `B2BTestObject` | dev/test scratch |

> `cdk_test_prize_redemptions` is B2B-owned despite lacking the `b2b_` infix — it is defined in `prize-worker/src/prize-redemption-model.ts`, not the shared submodule. Enumerate collections explicitly; never pattern-match on `b2b`.

**Replicated collections** — written *only* by the replication triggers.

| New name | Replicated from | Model | Source rows / size |
|---|---|---|---|
| `readonly_betevents` | `cdk_test_betevents` | `BetEvent` | ~2,943 |
| `readonly_props` | `cdk_test_props` | `Prop` | ~362,382 (~136 MB) |
| `readonly_entities` | `cdk_test_entities` | `Entity` | ~3,404 |

Mirroring `props` twice adds roughly 270 MB logical (far less compressed) to a cluster currently using 2.4 GB of 10.6 GB — not a capacity concern, but it is the bulk of the replication volume and worth knowing.

### `PBingo-fullappdev-database` (existing)

Keeps every D2C and Notification-system collection, unchanged. B2B's seven collections are removed from it once the prod migration is verified.

---

## Critical Constraint: `_id` Values Must Be Preserved

The mirror must copy documents **with their original `_id`**. B2B stores raw ObjectId references to these documents — `B2BContest.allowedBetEvents` → `BetEvent._id`, and all nine `B2BBoard` position fields → `Prop._id`. If the replication generated new `_id`s, every existing board and contest would point at nothing and `.populate()` would silently return null cells.

This also means the **backfill and the triggers must agree**: the one-time copy and the ongoing trigger writes both key on `_id`, so a trigger firing for a document the backfill already copied results in an idempotent upsert, not a duplicate.

---

## Replication Design

Six triggers total — three source collections × two target databases. Each fires on `insert`, `update`, `replace`, and `delete` and applies the change to the corresponding mirror collection, keyed on `_id`.

```
cdk_test_betevents  ──┬─→ obs-b2b-prod.readonly_betevents
                      └─→ obs-b2b-dev.readonly_betevents
cdk_test_props      ──┬─→ obs-b2b-prod.readonly_props
                      └─→ obs-b2b-dev.readonly_props
cdk_test_entities   ──┬─→ obs-b2b-prod.readonly_entities
                      └─→ obs-b2b-dev.readonly_entities
```

Trigger function shape (one per pairing, differing only in target database and collection):

```js
exports = async function (changeEvent) {
  const target = context.services
    .get("mongodb-atlas")
    .db("obs-b2b-prod")             // or "obs-b2b-dev"
    .collection("readonly_props");  // renamed target; source is cdk_test_props

  const id = changeEvent.documentKey._id;

  switch (changeEvent.operationType) {
    case "insert":
    case "update":
    case "replace":
      // fullDocument requires "Full Document" enabled on the trigger for updates
      await target.replaceOne({ _id: id }, changeEvent.fullDocument, { upsert: true });
      break;
    case "delete":
      await target.deleteOne({ _id: id });
      break;
  }
};
```

**Trigger settings that matter:** enable **Full Document** (otherwise `update` events carry only a diff, not the whole document) and enable **Auto-Resume** (so a trigger that falls behind its change-stream resume token restarts rather than silently stopping).

---

## Atlas Roles and Users

All created by hand in the Atlas console. Two custom roles, plus one database user per IAM role that needs access.

| Custom role | Grants | Bound to |
|---|---|---|
| `b2b-replicator` | **read** on the three source collections in `PBingo-fullappdev-database`; **readWrite** on `obs-b2b-prod` and `obs-b2b-dev` | the Atlas Trigger identity only |
| `b2b-app-prod` | **readWrite** on the seven B2B collections in `obs-b2b-prod`; **read** on its three `readonly_*` collections | prod IAM role ARNs |
| `b2b-app-dev` | same shape, scoped to `obs-b2b-dev` | every developer's IAM role ARNs |
| existing D2C / Notification roles | scoped to `PBingo-fullappdev-database` only | unchanged |

Database users are **AWS IAM Role** type — the username *is* the IAM role ARN, and no password exists. One database user per role ARN:

| Environment | Role ARNs to register | Custom role to assign |
|---|---|---|
| Prod (`189750306402`) | `obs-b2b-prod-main-api-task`, `obs-b2b-prod-prize-evaluator-task` | `b2b-app-prod` |
| Dev (`667523684851`) | `obs-b2b-dev-<developer>-main-api-task`, `obs-b2b-dev-<developer>-prize-evaluator-task` | `b2b-app-dev` |

Prod is registered once. Dev requires **two ARNs per developer** — the accepted cost of dev and prod using the same auth path. See [`environments.spec.md`](../../infra/environments.spec.md#onboarding-a-new-developer--required-atlas-step).

The trigger identity is the sole credential that touches both sides of the boundary. Everything else lives entirely on one side.

`b2b-app-*` grants per-collection privileges rather than a blanket database-level `readWrite`, so the `readonly_` naming is backed by an actual permission — a B2B service attempting to write a replica gets an authorization error, not a silently-overwritten document. This costs one thing worth knowing: **a newly added B2B collection needs an explicit grant**, since the role enumerates collections rather than covering the whole database. Deliberate friction, consistent with the "enumerate, never pattern-match" rule below.

> **Not yet true as of 2026-08.** The roles were initially created with database-level `readWrite` to get them stood up quickly, so `readonly_` is currently convention rather than enforcement — a write to a replica succeeds and is then silently overwritten by the next trigger sync. Tracked in [`known-issues.md`](../../../documents/POC-baseline/known-issues.md); tightening the roles to match this section is a later cleanup, not a blocker for the cutover.

---

## What Gets Created Where — CDK vs. Atlas

**The databases themselves need no creation step at all.** MongoDB has no DDL for databases or collections — both spring into existence on first write. `obs-b2b-prod` and `obs-b2b-dev` are created implicitly by the step-3 backfill. There is nothing to script, in CDK or otherwise.

What does need creating, and where:

| Resource | Where | Why |
|---|---|---|
| Databases / collections | *nothing to do* | Implicit on first write |
| Atlas Triggers (×6) + their identity | **Atlas UI** | Atlas App Services resources; not modelled by the CDK library at all |
| `b2b-replicator` custom role | **Atlas UI** | Belongs with the triggers it exists for — one system owning one concern |
| `b2b-app-prod` / `b2b-app-dev` custom roles | **Atlas UI** | See below |
| Database users (AWS IAM Role type) | **Atlas UI** | Registered against IAM role ARNs; no password to store anywhere |
| The IAM roles themselves | **CDK** | Explicit stage-namespaced `roleName`s so the ARNs are deterministic and can be pre-registered |

### Database users are created by hand, in both environments

**Decision (2026-08): keep Atlas IAM auth in dev and prod alike**, so a personal dev stack exercises the same authentication path production does. Database users are created manually in the Atlas console, bound to deterministic IAM role ARNs — *not* via `CfnDatabaseUser`.

Per-developer role ARNs are the accepted cost of that parity: onboarding a new developer requires registering two ARNs in Atlas. Documented as a required step in [`environments.spec.md`](../../infra/environments.spec.md#onboarding-a-new-developer--required-atlas-step) and surfaced to developers in [`SETUP.md`](../../../SETUP.md).

Sharing one IAM role across all dev stages was considered and rejected: a named IAM role is a CloudFormation-owned resource, so two stage stacks declaring the same name collide on deploy. Sharing would require creating the role outside the stage stacks and importing it via `Role.fromRoleArn` — more plumbing than the per-developer registration it would save.

### No Atlas API key lives in an AWS account

**Confirmed (2026-08): Atlas API keys cannot be scoped to a database.** They carry project-level roles only. That makes an API key stored in `obs-b2b-dev` a standing privilege-escalation path — anything able to use it could create a database user with access to the source database, regardless of how carefully the CDK code is written.

So: **no Atlas API key is provisioned into either AWS account, and CDK creates no Atlas resources at all.** This means dropping `CfnDatabaseUser` — and with it the `awscdk-resources-mongodbatlas` dependency, its `cfn/atlas/profile/default` secret, and the CloudFormation third-party extension activation (an execution role trusting `resources.cloudformation.amazonaws.com`) that each account would otherwise need.

Creating the database users by hand is what makes this possible while **keeping** IAM auth: the API key was only ever needed to create the user, not to authenticate as it. Registering the same IAM role ARN manually in the console produces an identical database user with none of the standing privilege.

**Still outstanding:** the `board-evaluator` and `prop-update-evaluator` Lambdas cannot use IAM auth — their connector (`pb-shared-deps/utils/lambda/db_connector_from_uri.ts`) only supports a connection-string secret, so registering their execution roles in Atlas achieves nothing until it is extended to support the `MONGODB-AWS` mechanism. Until then a personal dev stack's ECS services connect while its async prize pipeline does not. Tracked in [`known-issues.md`](../../../documents/POC-baseline/known-issues.md).

---

## Cutover Sequence

Dev first — it has no data to lose and validates the whole mechanism before prod is touched.

1. Create the `b2b-replicator` role and the trigger identity bound to it. (No database-creation step — see above.)
2. Create the `b2b-app-prod` and `b2b-app-dev` roles, their database users, and a Secrets Manager secret per environment holding each user's connection credentials.
3. **Backfill** the three source collections into both targets under their `readonly_*` names (`mongodump` + `mongorestore` with `--nsFrom`/`--nsTo` to rename during restore, preserving `_id`). Triggers do **not** backfill — they only fire on changes occurring after they are enabled, so without this step the mirrors would start nearly empty and fill in only as documents happen to be touched.
4. Enable the six triggers. Steps 3 and 4 are safe in either order thanks to `_id`-keyed upserts; enabling triggers first is marginally safer (no gap between backfill completing and triggers starting).
5. Verify: document counts converge; the `{ betEventId: 1, entityInfo: 1 }` index exists on both `readonly_props` copies (see "Indexes on the Replicas"); and a test write to a source document appears in both mirrors.
6. **Land the `pb-shared-deps` rename** (see "Code changes this requires") and re-pin all four submodule checkouts to the same commit. Deploy nothing yet — D2C is unaffected because it leaves `LEGACY_COLLECTION_PREFIX` unset.
7. **Seed `obs-b2b-dev`** with realistic B2B configuration data under a dev tenant — see "Dev Seed Data" below.
8. **Dev cutover** — point personal dev stacks at `obs-b2b-dev` via `MONGODB_DATABASE_NAME` and set `LEGACY_COLLECTION_PREFIX=readonly` in `lib/config/environments.ts`. Exercise the full flow: list contests, draft a squad, generate a board, confirm populated props render. This validates the entire mechanism before prod is touched.
9. **Prod migration** — copy B2B's seven collections into `obs-b2b-prod` under their new names (small; low-traffic window, never during a live game), switch production `MONGODB_DATABASE_NAME` and `LEGACY_COLLECTION_PREFIX`, verify.
10. Once verified and past a rollback window, delete the seven old B2B collections from `PBingo-fullappdev-database` and narrow the D2C/Notification roles to that database.

Rollback for prod is reverting the two environment variables — the original collections are untouched until step 10.

### Dev Seed Data

Personal dev stacks need realistic B2B data to work against — an empty `obs-b2b-dev` has no organization, so tenant resolution fails and no contests render. Seed it by copying B2B's **configuration** collections from production and rewriting them to a dev tenant:

- Copy `organizations`, `contests`, and `prize_tiers`.
- Rewrite the seeded organization's `subdomain` to a dev slug (e.g. `dev-nick`) so it does not collide with a real client's tenant, and so `VITE_TENANT_SLUG=dev-nick` resolves locally.
- Additional developers get their own `B2BOrganization` in the same database — this is the per-developer isolation model from [`environments.spec.md`](../../infra/environments.spec.md), and it is why one shared dev database works.

**Do not copy `users`, `boards`, or `prize_redemptions`.** These contain real fan data — `B2BUser` holds email addresses and display names for actual fans of a live client, and `boards`/`prize_redemptions` link back to them via `clerkUserId`. Copying them would put production fan PII into a database every developer and intern can read, which contradicts the boundaries in [`SETUP.md`](../../../SETUP.md#boundaries--read-this-before-your-first-pr) and adds a second location that would need to honor a deletion request (PRD `SEC-07`).

They are also unnecessary: a developer signs up through their own dev stack against the non-production Clerk instance and generates their own board in seconds. Config data is the part that is tedious to recreate by hand; fan data is not.

---

## Rules

- **Never write to a `readonly_*` collection.** They are replicas — a write is rejected by `b2b-app-readwrite`, and would be overwritten by the next source change even if it succeeded.
- **Never grant a role by pattern-matching a collection name.** Enumerate explicitly — `cdk_test_prize_redemptions` is the proof this goes wrong.
- **Never point a personal dev stack at any database other than `obs-b2b-dev`.**
- **Never copy fan data (`users`, `boards`, `prize_redemptions`) into `obs-b2b-dev`** — see "Dev Seed Data".
- **A new non-B2B collection dependency requires a new trigger pair and a role change** — a deliberate change to this spec, not something an application PR can introduce on its own. Intentional friction.
- **A new B2B collection requires adding it to `b2b-app-readwrite`** in both environments. Without the grant, the application cannot write to it — a loud, immediate failure rather than a silent one.

---

## Resolved

- **`teambeteventdetails` / `individualbeteventdetails`** — not mirrored. No audited B2B read path touches them and they have no corresponding model registration; confirmed out of scope (2026-08).
- **`obs-b2b-prod-deployers`** — Identity Center group created, with prod account access (2026-08). `DATA-04`'s prerequisite is met; binding `b2b-app-readwrite` for `obs-b2b-prod` to that group's deploy path is part of step 9.
- **Trigger failure alerting** — Atlas emails the project owner on trigger failure/suspension by default; accepted as sufficient (2026-08). Worth revisiting if this ever needs to reach more than one person.
- **Mixed-privilege role** — resolved by design: `b2b-app-readwrite` enumerates per-collection privileges (readWrite on the seven B2B collections, read on the three `readonly_*` ones) rather than granting database-level `readWrite`.

- **Mixed-privilege role is expressible** — confirmed against the `awscdk-resources-mongodbatlas` type definitions: a custom role holds an array of actions, and **each action carries its own resource list** (`{ db, collection }`). So one role can grant `FIND` scoped to the three `readonly_*` collections and `FIND`/`INSERT`/`UPDATE`/`REMOVE` scoped to the seven B2B collections. Same shape via the Atlas UI or Admin API.

## Indexes on the Replicas

Source indexes, confirmed against the live cluster:

| Source collection | Indexes beyond `_id_` |
|---|---|
| `cdk_test_props` | `{ betEventId: 1, entityInfo: 1 }` |
| `cdk_test_betevents` | none |
| `cdk_test_entities` | none |

So exactly **one** index matters: `{ betEventId: 1, entityInfo: 1 }` on `readonly_props`. It backs the board-generation query (`Prop.find({ betEventId: { $in: [...] }, showProp: true })`) — without it, every board generation collection-scans ~362k documents.

**This does not happen automatically.** `autoIndex: false` is set in both DB connectors (see [`known-issues.md`](../../../documents/POC-baseline/known-issues.md)), so the application will not create it, and Atlas Triggers only write documents — they never create indexes. `mongorestore` does restore index definitions by default, so the step-3 backfill should carry it across; **verify explicitly after backfill** rather than assume, and create it by hand if missing:

```js
db.readonly_props.createIndex({ betEventId: 1, entityInfo: 1 })
```

`readonly_betevents` and `readonly_entities` need nothing beyond `_id_` — both are small and only ever fetched by `_id` via `.populate()`.

## Open Questions

None outstanding. Prerequisites tracked elsewhere: the non-production Clerk instance and the `obs-b2b-dev` Atlas API key (see [`known-issues.md`](../../../documents/POC-baseline/known-issues.md)).

---

## References

- [`documents/HLDs/data-access-isolation.md`](../../../documents/HLDs/data-access-isolation.md) — requirements
- [`spec/infra/environments.spec.md`](../../infra/environments.spec.md) — personal dev stacks; its "MongoDB Strategy" section is superseded by this spec (it described a scheduled batch sync into a per-developer-shared database; this replaces it with trigger-based replication into `obs-b2b-dev`)
- [`documents/POC-baseline/known-issues.md`](../../../documents/POC-baseline/known-issues.md) — `cdk_test_` rename, stale `test_*` collections, `MONGODB_SECRET_ARN` Lambda gap
