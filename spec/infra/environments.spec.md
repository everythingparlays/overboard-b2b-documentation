# Infra Spec: Environments & Personal Dev Stacks

## Overview

Defines how the backend AWS infrastructure (`overboard_sports_backend`) is deployed across environments. Today there is exactly one environment — see [`documents/POC-baseline/infra.md`](../../documents/POC-baseline/infra.md) — and this spec defines the target: **one production stack, plus any number of personal per-developer stacks**, so engineers can iterate against real (Fargate/ALB/SQS/Lambda) infrastructure without any risk to production, and without needing a shared staging environment or a deploy pipeline to get there.

**Stack:** AWS CDK v2 (`aws-cdk-lib` 2.214.0), single CDK app in `overboard_sports_backend` (`bin/overboard-sports-backend.ts`).
**Hosting/Runtime:** AWS (VPC, ECS Fargate, ALB, Lambda, SQS), MongoDB Atlas (SaaS, provisioned outside this CDK app).
**Use case:** One production stack; N personal developer stacks, deployed/destroyed on demand, coexisting without name collisions.

---

## Architecture

**Two AWS accounts**, not one:

- **`prod`** — hosts only the production stack. This spec doesn't define the release process for deploying here (who runs it, from where) — that's a separate, not-yet-defined concern.
- **`dev`** — a dedicated, separate AWS account that hosts every developer's personal stack side by side. Full account-level separation from prod, not just naming — a bad deploy or a misconfigured resource in a personal stack cannot reach prod resources or IAM, because it's a different account entirely.

```
AWS Account: prod                       AWS Account: dev
┌───────────────────────────┐           ┌──────────────────────────────────────────┐
│ OverboardSportsBackend     │           │ OverboardSportsBackendStack-nick          │
│ Stack-prod                 │           │ OverboardSportsBackendStack-avyn          │
│ (VPC/ECS/ALB/SQS/Lambda)   │           │ OverboardSportsBackendStack-<...>         │
└───────────────────────────┘           └──────────────────────────────────────────┘
             │                                              │
             └─────────────────────┬────────────────────────┘
                                    ▼
                    MongoDB Atlas — one shared cluster (PBingo-dev)
         obs-b2b-prod database          obs-b2b-dev database (shared by all
         (production only)              personal stacks — NOT one per developer)
         See mongodb-access-isolation.spec.md for what's in each.
```

Within the `dev` account, `stage` is **required** context on every deploy. There is no default — a bare `cdk deploy` must fail loudly rather than silently deploying somewhere ambiguous.

The frontend doesn't get its own AWS deploy for this. A developer points their local Vite dev server's `VITE_API_BASE_URL` at their personal stack's ALB DNS output (printed by `cdk deploy`).

---

## Project Structure

```
overboard_sports_backend/
├── bin/
│   └── overboard-sports-backend.ts   # reads `stage` from context, throws if missing, resolves config, instantiates the stack
└── lib/
    ├── config/
    │   └── environments.ts           # per-stage/per-account config: AWS account+region, Mongo database name, alert phone, certificateArn, frontendOrigin, etc.
    ├── application-stack.ts
    └── constructs/
        └── ...                       # unchanged; see documents/POC-baseline/infra.md for what's here today
```

`lib/config/environments.ts` is new — it centralizes everything that's currently hardcoded inline in `bin/overboard-sports-backend.ts` (AWS account ID, Atlas org/project ID, alert phone number, `certificateArn`, `frontendOrigin`), keyed by environment type (`prod` vs. `dev`), so `bin/` becomes a thin entry point rather than the place config values live.

---

## Key Patterns

### Pattern 1: Required `stage` context, no default

```ts
// bin/overboard-sports-backend.ts
const app = new cdk.App();
const stage = app.node.tryGetContext('stage');
if (!stage) {
  throw new Error(
    'Missing required context: pass -c stage=<name> (e.g. "prod", or your name for a personal dev stack)'
  );
}

const config = getEnvironmentConfig(stage); // "prod" -> prod account config; anything else -> dev account config, namespaced

new OverboardSportsBackendStack(app, `OverboardSportsBackendStack-${stage}`, {
  resourcePrefix: config.resourcePrefix, // 'obs-b2b-prod' | 'obs-b2b-dev-<stage>'
  env: { account: config.account, region: config.region },
  ...config,
});
```

Deploy commands:

```bash
npx cdk deploy -c stage=prod       # prod account — only for real release deploys
npx cdk deploy -c stage=nick       # dev account — nick's personal stack
npx cdk destroy -c stage=nick      # tear it down when you're done with it
```

### Pattern 2: Never hardcode a physical CloudFormation resource name

CDK derives a unique physical name from the construct path (which includes the stack ID) when you *don't* set an explicit name. Since the stack ID is already stage-namespaced (`OverboardSportsBackendStack-${stage}`), leaving names unset gives per-developer isolation for free.

```ts
// Do this — CDK derives a unique name per stack/stage automatically
new sqs.Queue(this, 'PropHitQueue', { ... });
```

```ts
// Not this — a fixed name collides across every stage that deploys it
new sqs.Queue(this, 'PropHitQueue', { queueName: 'prop-hit-queue', ... });
```

**The one deliberate exception: the two ECS task IAM roles.** Their ARNs are registered by hand as MongoDB Atlas database users, so an auto-generated name — which changes whenever the stack is recreated — would silently break database auth. They use `config.resourcePrefix`, which already encodes both environment and stage:

```ts
// obs-b2b-prod-main-api-task  |  obs-b2b-dev-nick-main-api-task
roleName: `${resourcePrefix}-main-api-task`,
```

Anything else needing a human-meaningful name should derive it from `resourcePrefix` the same way, never from a bare literal. Note this applies to real CloudFormation resource names only — values that merely *look* like names, such as the Mongo database, come from config (`config.atlasCredentials.databaseName`).

### Pattern 3: Config lives in one place

Every value that's currently hardcoded directly in `bin/overboard-sports-backend.ts` — AWS account ID, Atlas org/project ID, alert phone number, `certificateArn`, `frontendOrigin` — moves into `lib/config/environments.ts`. New infra work should add to that file, not introduce a fifth place values are hardcoded.

---

## MongoDB Strategy — Not Fully Isolated Per Developer

This is the one place personal stacks are **not** fully isolated, and it's a deliberate constraint, not an oversight: live prop/event data (players, bet events, stat thresholds) is written by the external stats pipeline ([`PbCdkMonoRepo`](https://github.com/everythingparlays/PbCdkMonoRepo)) into one database. The B2B board-generation flow needs to read that real data to be useful at all — a personal, empty database per developer would have no players to draft from.

**So: all personal dev stacks connect to one shared, non-prod MongoDB database** — not the prod database, and not one database per developer either.

**Isolation between developers is at the collection level** (updated 2026-08): each stack prefixes its own B2B collections with its stage (`nick_bingo_boards`, `arthur_users`), driven by `B2B_COLLECTION_PREFIX`. An earlier draft of this spec proposed tenant/org-level isolation instead — that was wrong, because it separates *data* but not *schema*: two developers sharing a collection on different code versions collide the moment one adds a required field or a unique index. The read-only `readonly_*` replicas stay shared and unprefixed. See [`mongodb-access-isolation.spec.md`](../core-modules/2-approved/mongodb-access-isolation.spec.md#per-developer-isolation).

**Superseded — see [`spec/core-modules/2-approved/mongodb-access-isolation.spec.md`](../core-modules/2-approved/mongodb-access-isolation.spec.md) for the current design.** The mechanism described above is now implemented as `obs-b2b-dev`: a dedicated database containing dev's own B2B collections plus a continuously-replicated, read-only mirror of `BetEvent`/`Prop`/`Entity`, fed by Atlas Database Triggers. Personal dev stacks connect only to that database.

**`obs-b2b-dev` exists as of 2026-08.** Earlier drafts of this spec, and a comment in `lib/config/environments.ts`, described it as not-yet-created; both were stale and are corrected. This matters for contributor safety rather than as a detail: while it did not exist, any B2B data work necessarily targeted `PBingo-fullappdev-database` — the shared database that also serves the live D2C app — which the [contributor boundaries](../../SETUP.md#boundaries--read-this-before-your-first-pr) forbid touching. **Dev-database work is now unblocked and prod remains off-limits.**

This **resolves** the open risk previously noted here (that nothing stopped a dev credential from writing to shared non-B2B collections): a dev stack has no credential for the source database at all, so the guardrail is structural rather than a documented rule. See [`SETUP.md`](../../SETUP.md#boundaries--read-this-before-your-first-pr).

---

## Auth (Clerk) Strategy

Personal dev stacks must **never** point at the production Clerk instance.

**Done (2026-08): the non-production Clerk instance exists** — `natural-macaw-97.clerk.accounts.dev`. Its keys are shared config across all personal dev stacks (same pattern as the shared dev Mongo database above) — not a separate Clerk instance per developer. The publishable key is in [`SETUP.md`](../../SETUP.md); the secret key belongs in Secrets Manager (`obs-b2b-dev/clerk`), wired into `lib/config/environments.ts` as `clerkSecretArn`.

**Decided elsewhere (2026-08), previously open here.** PRD `AUTH-04`'s per-tenant choice of auth method now has an answer, and it lives in [`documents/HLDs/multi-tenant-identity-auth.md`](../../documents/HLDs/multi-tenant-identity-auth.md) rather than in this spec. In short:

- **Fans:** one shared Clerk instance per *sign-in variant* (`IDN-09`) — two platform-wide, not one per tenant. Tenant membership is a database join, not a Clerk Organization.
- **Admin surface:** its own Clerk instance with MFA required (`IDN-10`), using Clerk Organizations for staff and team users. MFA is an instance-wide toggle in Clerk, which is why it cannot share an instance with fans.

The consequence for *this* spec is unchanged: a personal dev stack points at the non-production fan instance above and never at a production one. The admin instance is not yet built.

---

## Onboarding a New Developer — Required Atlas Step

**A new developer's stack cannot connect to MongoDB until someone with Atlas access registers their IAM role ARNs as Atlas database users.** This is manual and easy to forget: everything else about a personal stack self-provisions on `cdk deploy`, so the failure shows up as a runtime connection error after an otherwise-successful deploy, not as a deploy failure.

Database access uses Atlas IAM auth in **both** dev and prod, deliberately — so a personal dev stack exercises the same authentication path production does. The cost of that parity is this per-developer step.

For a new stage `<name>` in the dev account (`667523684851`), register **both** of these ARNs:

```
arn:aws:iam::667523684851:role/obs-b2b-dev-<name>-main-api-task
arn:aws:iam::667523684851:role/obs-b2b-dev-<name>-prize-evaluator-task
```

In Atlas: **Database Access → Add New Database User → AWS IAM → IAM Role**, paste the ARN as the username, assign the dev-scoped custom role (see [`mongodb-access-isolation.spec.md`](../core-modules/2-approved/mongodb-access-isolation.spec.md)), Add User.

These can be created **before** the developer's first deploy — Atlas does not verify that the role exists yet. Doing it during onboarding avoids a blocked first deploy.

The ARNs are deterministic by design: `main-api-service.ts` and `prize-delivery.ts` set explicit `roleName` values built from `config.resourcePrefix` (`obs-b2b-dev-<stage>` / `obs-b2b-prod`) rather than letting CDK auto-generate them, so a stack teardown and redeploy does not orphan the Atlas user. **Do not remove those `roleName` props** — an auto-generated name would silently break auth on the next stack recreation.

The `dev`/`prod` segment is in the role name deliberately: it means every dev role sorts together in the IAM console, and a production role can never be mistaken for a personal one at a glance.

**Not yet covered by this:** the `board-evaluator` and `prop-update-evaluator` Lambdas cannot use IAM auth — their connector (`pb-shared-deps/utils/lambda/db_connector_from_uri.ts`) only supports a connection-string secret. Registering their execution roles in Atlas does nothing until that connector is extended. Until then, a personal dev stack's ECS services work while its async prize pipeline does not. Tracked in [`known-issues.md`](../../documents/POC-baseline/known-issues.md).

---

## Rules

- **Always** register a new developer's two IAM role ARNs as Atlas database users before their first deploy — see "Onboarding a New Developer" above. Nothing else about a personal stack requires manual provisioning, which is exactly why this step gets forgotten.
- **Always** pass `-c stage=<name>` explicitly on every `cdk deploy`/`cdk destroy` — there is no default.
- **Always** deploy personal stacks to the dedicated `dev` AWS account. **Never** the `prod` account.
- **Never** set an explicit CloudFormation physical resource name (`queueName`, `functionName`, table names, etc.) unless there's a hard requirement to — let CDK derive it from the stack ID.
- **Never** point a personal dev stack's Clerk config at the production Clerk instance.
- **Never** `cdk destroy` a production stack
- **Always** `cdk destroy` a personal stack once you're done with it — there's no automatic cleanup or cost alerting for stacks left running.
- Per-developer isolation is at the **tenant/org level** in Mongo, not the database level — don't build anything that assumes a personal stack has its own private database.

---

## Open Questions

1. ~~**Read-only scoping** for dev database users on the shared, non-B2B collections.~~ **Resolved** by [`mongodb-access-isolation.spec.md`](../core-modules/2-approved/mongodb-access-isolation.spec.md) — dev stacks connect only to `obs-b2b-dev` and have no credential for the source database.
2. **Per-tenant auth-method configuration** (PRD `AUTH-04`) and how it maps onto Clerk setup — deferred to a future auth/tenancy core-module spec.
3. **The `prop-hit` message contract** with `PbCdkMonoRepo` isn't formalized as a shared interface yet — related but separate from this spec; see [`known-issues.md`](../../documents/POC-baseline/known-issues.md).
4. **Prod release process** — who deploys `stage=prod`, from where (a person's machine vs. CI) — not defined by this spec.

---

## References

- [`documents/POC-baseline/infra.md`](../../documents/POC-baseline/infra.md) — current (single-stack) infra baseline this spec replaces
- [`documents/POC-baseline/known-issues.md`](../../documents/POC-baseline/known-issues.md) — MongoDB IAM-auth standardization decision, `prop-hit` external dependency
- PRD [`SEC-08`](../../documents/PRD/OBS_B2B_Platform_PRD.md) — baseline hardening requirement this design supports
