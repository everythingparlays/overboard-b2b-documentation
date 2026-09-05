# Known Issues — Consolidated Gaps vs. the PRD

> Part of [POC Baseline](README.md). This is a factual gap list, not a prioritized roadmap — prioritization is a product/eng decision to make once specs are being written. Each item links back to the layer doc it came from and, where applicable, the PRD requirement it bears on.

## Cross-Tenant Data Isolation — No Enforcement (`SEC-08`)

The backend's authorization model (`node-server/src/middleware/auth.ts`) only ever checks "is this the same Clerk user as the one in the request" — it never checks organization/tenant membership. Concretely:

- **6 of 12 API routes have no auth at all**: `GET /b2b/board/:boardId`, `GET /b2b/contest/list-contests`, `GET /b2b/contest/:contestId`, `POST /b2b/contest/prize-tier`, `GET /b2b/org/:subdomain`, `POST /b2b/user/b2b-create-user`.
- `GET /b2b/board/:boardId` returns any user's full board by Mongo `_id` with zero auth or ownership check — anyone who obtains/guesses a `boardId` gets that fan's board.
- `POST /b2b/contest/prize-tier` is fully unauthenticated and lets any caller attach a prize tier to any org's contest.
- `POST /b2b/user/b2b-create-user` is unauthenticated — a caller can create a user record for any `clerkUserId`/`organizationId` pair.
- Even where auth exists (`generateB2BBoard`, `listB2BBoards`), it checks Clerk-user identity, never org membership — a user authenticated against one tenant can act on another tenant's `contestId`.

The repo's own `b2b-routes-list.txt` shows the author was already tracking most of this as `AUTH: none` — it's a known, unfinished state, not a surprise. Full detail: [`backend.md`](backend.md).

## Opt-In Consent Is Silently Discarded (`OPT-01`–`OPT-06`)

The Zod schema for user creation models granular, timestamped, per-opt-in consent (`optInConsents: [{messageId, agreedAt}]`) and the handler passes it to `B2BUserModel.create()` — but the Mongoose schema has no matching field, so Mongoose's strict mode drops it silently before persistence. The API returns a 201 as if it worked. This is functionally equivalent to "unbuilt" but harder to catch than a missing feature, since the request appears to succeed. Detail: [`backend.md`](backend.md).

## Reporting & Exports Don't Exist (`RPT-01`–`RPT-07`)

Zero code anywhere in the backend touches CSV generation, per-sponsor field scoping, or opt-in-filtered exports. Not stubbed, not TODO-commented — entirely absent. This is a full V1-scope area that needs to be built from scratch.

## Prize Fulfillment Is Mostly Stubbed (`PRIZE-04`–`PRIZE-07`)

The queue/DLQ/idempotency plumbing is solid (see [`workers.md`](workers.md)), but of 6 registered fulfillment handlers, 4 (`email`, `email-test`, `webhook`, `barcode`) are no-op stubs. The 2 that work send a hardcoded-brand email template with no per-sponsor customization and **no coupon-code generation/assignment/dedup logic at all** — despite `PRIZE-05`/`PRIZE-06` specifically calling for sponsor-supplied coupon batches with no-duplicate-issuance guarantees.

**Confirmed (2026-08): the `handlerId → handler` registry pattern is the intended design, not a gap to standardize away.** Fulfillment logic is meant to be bespoke per sponsor, matching PRD `PRIZE-05`'s explicit exception to the "prefer config over per-tenant code" rule (`TEN-C1`). The remaining gap is that most of the bespoke handlers haven't been written yet, and no coupon-code infrastructure exists for handlers that will need it — that's real work, but the architecture itself doesn't need to change.

## Auth: Google Sign-In Not Built (`AUTH-01`) — Prioritized

Only email+password (with email-code MFA) is implemented in the actual sign-up/sign-in flow. No OAuth/Google code exists in the app flow itself, though Clerk's prebuilt component (unlinked in the app) could support it if enabled in the Clerk dashboard. Detail: [`webapp.md`](webapp.md).

**Decision (2026-08):** this needs to be prioritized, not treated as a deferred nice-to-have — it's a `[V1]` PRD requirement (`AUTH-01`) that's currently missing from the actual signup flow.

## Auth: Configurable Signup Fields Not Built (`AUTH-02`)

There's no per-tenant field configuration model anywhere (frontend or backend) — the signup form and its required fields are currently fixed in code, not data-driven.

## Tenant/Org Provisioning Is Fully Manual (`TEN-05`)

No admin endpoint, script, or seed path creates a `B2BOrganization` — provisioning happens via direct database writes outside any application code. `TEN-03` calls for ≤1–2 hours of engineering time per onboarding; there's currently no tooling to measure or bound that against.

## HTTPS Is Off in the Checked-In Infra Config (`SEC-04`)

The CDK code to terminate TLS at the ALB (443 + HTTP→HTTPS redirect) is implemented correctly, but `certificateArn` is commented out in `bin/overboard-sports-backend.ts`, so the stack as checked in deploys HTTP-only. Detail: [`infra.md`](infra.md).

## No Rate Limiting or Bot Protection (`SEC-08`, `SEC-09`)

No `express-rate-limit` or equivalent anywhere; this is ALB+Fargate, not API Gateway, so there's no platform-level throttling either. No CAPTCHA or signup-abuse protection.

## Frontend Exposes a Live Session Token in a Production Route

`pages/Test.tsx` is routed at `/test`, gated only by `ProtectedRoute` (requires sign-in) — unlike the app's other dev tooling, it is **not** gated by `import.meta.env.DEV`, so it ships in the production bundle. It has a "Copy Auth Token" button that copies the live Clerk session JWT and logs it to the console in plaintext. It also hardcodes the backend's internal ELB hostname directly in source. Detail: [`webapp.md`](webapp.md).

## Hardcoded Plaintext-HTTP Backend URL in Frontend Deploy Config

`vercel.json` proxies API calls to a hardcoded AWS ELB DNS name over plain HTTP, not sourced from an env var. Same hostname duplicated in `pages/Test.tsx`.

## Observability Is Console-Only (`OBS-01`–`OBS-05`)

No error tracking service (Sentry or equivalent) in either repo. No structured logging (raw `console.log`/`console.error` throughout, gated only by always-on debug flags in the Lambdas). The only proactive alerting anywhere in the system is "an SQS dead-letter queue has ≥1 message" — no alarms on ALB error rate, ECS health, Lambda errors, ORmongo connectivity; no per-tenant error attribution; no live-game-window alerting; no pre-game health view. This is essentially the entirety of PRD Section 14 unbuilt.

## Dev-Account Access Is Full Admin, Not Scoped to CDK Needs (Lower Priority)

The Identity Center permission set granting `obs-b2b-dev-deployers` access to `obs-b2b-dev` (`AdministratorAccess-for-b2b-dev`) is full administrator access within that account, not narrowed to what a CDK deploy actually needs. The account boundary itself is the real backstop — it's a fully separate account from `obs-b2b-prod`, so this can't reach production — but within `obs-b2b-dev`, nothing currently limits the blast radius of a mistake. Worth replacing with a scoped permission set once there's time; not urgent given the account-level isolation already in place. See [`SETUP.md`](../../SETUP.md#aws-access-setup-identity-center).

## Decision: Collection Naming — Per-Developer Prefix and `bingo_` Game-Type Prefix

**Decided (2026-08), implemented in code, not yet applied to any live data.** Two naming changes land together in `pb-shared-deps/b2b_models.ts` and `prize-worker/src/prize-redemption-model.ts`:

- **`B2B_COLLECTION_PREFIX`** — each personal dev stack prefixes its own B2B collections with its stage (`nick_bingo_boards`); production uses no prefix. This gives developers *schema* isolation, which the earlier tenant/org-level plan did not: two devs sharing a collection on different code versions collide as soon as one adds a required field or unique index.
- **`bingo_` on game-specific collections** — `bingo_boards`, `bingo_prize_tiers`, `bingo_prize_redemptions`. Per PRD `GAME-F1`, additional game types (scratch-off, pick-3, over/under) are anticipated alongside bingo for a single tenant, so these three needed disambiguating. `organizations`, `contests`, and `users` stay unprefixed — they are platform-level and shared across game types.

Both also drop the misleading `cdk_test_` prefix. Cheap now while the target collections are empty; expensive once production migrates. See [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md).

## Removed: `B2BTestObject` / `PUT /api/test-object`

**Removed (2026-08).** The auth-verification scratch endpoint, its handler, Zod schemas, interface, and Mongoose model are deleted from `node-server` and `pb-shared-deps`. The frontend's `pages/Test.tsx` still calls it and that section is now dead — relevant because that page is the one exposing a live Clerk session token in production builds (see below); removing the page entirely would close both at once.

## Atlas App Roles Grant Database-Wide readWrite, Not Per-Collection (Lower Priority)

**Current state (2026-08):** the `b2b-app-prod` / `b2b-app-dev` Atlas custom roles were created with **database-level `readWrite`** on their respective B2B database, rather than the per-collection scoping [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md) calls for (readWrite on the seven B2B collections, read-only on the three `readonly_*` replicas). Deliberate shortcut to get the roles stood up.

**Consequence:** the `readonly_` prefix is currently a **naming convention only, not an enforced permission**. A B2B service can write to a replica collection; nothing rejects it. The write isn't catastrophic — the next Atlas Trigger sync overwrites it from the source — but it fails *silently*, so a bug that writes to `readonly_props` would look like data mysteriously reverting rather than an obvious authorization error.

**To close:** edit each role to enumerate per-collection privileges as the spec describes. Note the tradeoff that comes with it — an enumerated role means every newly added B2B collection needs an explicit grant, or the app can't write to it (a loud failure, by design).

## MongoDB Auth Should Standardize on IAM (Lower Priority)

Both auth paths described in [`infra.md`](infra.md) are currently live in production: ECS tasks (main API, prize-evaluator) authenticate to Atlas via AWS IAM; Lambdas instead use a plain connection-string secret (`MONGODB_SECRET_ARN`).

**Decision (2026-08): standardize all services on IAM auth — confirmed and kept**, in dev and prod alike, so personal dev stacks exercise the same auth path as production. See [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md).

**How it is provisioned changed, though.** Atlas IAM database users were being created via `CfnDatabaseUser`, which requires an Atlas API key in the deploying AWS account — and **Atlas API keys cannot be scoped to a database**, only to a project, making such a key a standing escalation path from `obs-b2b-dev` to the source database. The fix: create the database users **by hand in the Atlas console**, bound to deterministic IAM role ARNs. The API key was only ever needed to *create* the user, never to authenticate as it — so removing it costs nothing but a manual onboarding step (registering two ARNs per new developer, documented in [`environments.spec.md`](../../spec/infra/environments.spec.md#onboarding-a-new-developer--required-atlas-step)).

**The Lambda gap below is not closed by this** — `board-evaluator` and `prop-update-evaluator` still cannot use IAM auth at all until their connector supports the `MONGODB-AWS` mechanism.

## Stale Duplicate Legacy Collections (`test_*`)

**Found (2026-08) while verifying collection names for [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md):** the shared database contains a full parallel set of legacy collections prefixed `test_*` (`test_betevents`, `test_props`, `test_entities`, `test_users`, `test_contests`, `test_boards`, and others) alongside the live `cdk_test_*` set. These are **not** a live mirror — `test_betevents` has 3000 documents vs. `cdk_test_betevents`'s 2943, confirming divergence, not sync. The `stageName` constant in `pb-shared-deps/models.ts` is hardcoded to `"cdk_test"` today, meaning `test_*` was written under an earlier value of that constant and abandoned when it changed. Low priority — dead data taking up space, not a functional or security issue — but worth cleaning up eventually, and worth knowing about so it doesn't get mistaken for a second live environment.

## Personal Dev Stacks: Infra Isolation Is Built, Two Prerequisites Still Missing

**Update (2026-08): the CDK stage-parameterization from [`environments.spec.md`](../../spec/infra/environments.spec.md) is implemented.** `bin/overboard-sports-backend.ts` now requires `-c stage=<name>` (no default; a bare `cdk deploy` fails loudly), config moved into the new `lib/config/environments.ts`, and — found while implementing this — **all six SQS queues in `prize-delivery.ts` had hardcoded `queueName`s**, which would have collided the moment a second developer's stack deployed into the same account. Removed, so CDK now derives unique names per stack as the spec's Pattern 2 requires. `obs-b2b-prod` in this config is a brand-new, empty account, not the currently-running production system — see "Production Workloads Run in the AWS Organization's Management Account" below.

**Still blocking a personal stack from being actually usable, not just deployable** — deploying with `-c stage=<name>` today will succeed, but:
- **No dev-scoped MongoDB secret exists.** The board-evaluator and prop-update-evaluator Lambdas hard-require `MONGODB_SECRET_ARN` (confirmed in `pb-shared-deps/utils/lambda/db_connector_from_uri.ts` — throws if unset, no IAM fallback on the Lambda side). The existing secret lives in the management account (`769696051685`) and isn't cross-account accessible from `obs-b2b-dev` without a resource policy that doesn't exist. A new secret needs to be created in `obs-b2b-dev` itself. (Main API / node-server doesn't have this problem — it uses Atlas IAM auth via its task role.)
- ~~**No non-production Clerk instance exists.**~~ **Resolved (2026-08):** created — `natural-macaw-97.clerk.accounts.dev`. Its publishable key is documented in [`SETUP.md`](../../SETUP.md) (publishable keys are public by design). **Still to do:** store its *secret* key in a Secrets Manager secret named `obs-b2b-dev/clerk` in the `obs-b2b-dev` account, and set `clerkSecretArn` in `lib/config/environments.ts` — until then node-server still starts with no auth configured.

Until both exist, treat a personal dev stack as "infrastructure deploys, but auth and the async prize pipeline don't work yet."

## External Dependency: `prop-hit` Queue Producer Lives in Another Repo

**Confirmed (2026-08): the producer is [`PbCdkMonoRepo`](https://github.com/everythingparlays/PbCdkMonoRepo)** (added to `AGENTS.md`'s Related Repositories table). The `prop-hit` SQS queue (consumed by the `prop-update-evaluator` Lambda, see [`workers.md`](workers.md)) is published to from code in that repo, not present in this workspace. This is a real, unformalized cross-repo dependency — the message contract (`{propId, type, timestamp}`, inferred from the consumer side only) isn't specified anywhere as a shared interface; it just happens to match what the Lambda expects today.

**Still needs to be solved, not just located.** Next step: specify the message contract as a proper shared interface (likely belongs in `spec/core-modules/` since it's consumed cross-repo) so a schema change on either side doesn't silently break the other. Not yet done.

## Confirmed: Legacy D2C Models Cannot Be Modified

`Contest`, `User`, `Board`, `Prop`, and related non-`B2B`-prefixed models (see [`backend.md`](backend.md)) are actively serving the live D2C mobile app in production, on the same database the B2B platform reads from. **Confirmed (2026-08): these cannot be changed.** Any B2B-driven schema work must be additive (new `B2B*` models/fields) rather than touching these directly — this is a hard constraint on how the tenant-isolation, indexing, and data-model fixes above get implemented, not just a note.

## Production Workloads Run in the AWS Organization's Management Account

**Confirmed (2026-08):** the AWS account currently hosting the backend infra (`769696051685`) is not just "the current account" — it's the **management/payer account of the AWS Organization itself** (`aws organizations describe-organization` confirms `MasterAccountId` == this account), with `FeatureSet: ALL` and no other member accounts created yet. The `parlaybingo-admin` IAM user has full `AdministratorAccess` on it.

AWS's own guidance is to keep the management account workload-free — it controls billing, SCPs, and every future member account, so anything running in it has a larger blast radius than the same thing running in a dedicated account. This isn't a new problem introduced by the personal-dev-stack work in [`environments.spec.md`](../../spec/infra/environments.spec.md), but that spec's `obs-b2b-prod`/`obs-b2b-dev` member-account split is the direct fix for it, for the B2B platform specifically. Lower priority than the tenant-isolation/consent-persistence gaps above, but worth tracking since it also affects whatever D2C infra currently shares this same management account.

## Decision: Retire the `core` Submodule — Merge Into `overboard-b2b-template`

`core` (`overboard-b2b-shared-deps`) is vendored as a submodule but, per the original audit, is only consumed by the frontend today — nothing in the backend imports from it. Keeping it as a separate repo adds submodule-auth overhead (the `GITHUB_PAT` rewrite in `vercel-install.sh`) and another sync-drift surface, for no actual cross-repo sharing benefit.

**Done (2026-08).** `core` was absorbed into `overboard-b2b-template/src/` and removed, along with `pb-shared-deps` — the frontend now has exactly one submodule, `obs-b2b-shared`.

Landing spots: layout components → `src/components/layout/`, `schemas/auth.ts` → `src/schemas/`, `utils/eventHelpers.ts` → `src/lib/`, type shims merged into `src/types/*` and repointed at `@b2b-shared`. Two files were dropped rather than moved: `utils/cn.ts` (duplicate of `src/lib/utils.ts`) and `utils/contest.ts` (no consumers).

Removing `pb-shared-deps` from the frontend turned out to be possible only because its apparent dependency on the D2C `Contest` type was illusory — those re-exports were consumed solely by `src/lib/mock/`, which is dead code nothing imports. The types the app actually uses (`BetEvent`, `TeamBetEvent`, `Entity`, `BettingProp`) all exist in `obs-b2b-shared`.

## Decision: Split B2B Models Into Their Own Repo (`obs-b2b-shared`)

**Decided (2026-08).** B2B stops depending on `pb-shared-deps` — the repo shared with the D2C mobile app and website — and gets its own: `obs-b2b-shared`, consumed by `node-server`, both Lambdas, `prize-worker`, and the frontend. Design in [`documents/HLDs/b2b-shared-deps.md`](../HLDs/b2b-shared-deps.md); not yet implemented.

**What forced it:** B2B work lives on a long-lived `ecs-branch` of `pb-shared-deps` which is simultaneously 14 commits ahead of and 8 behind `main`, so merging is required in both directions and conflicts on `b2b_models.ts`. Two B2B commits (`updated B2B prize tier`, `Updated B2B Contest Response`) landed on `main` and never reached the branch the backend actually runs. B2B also carries 25 interfaces while importing only 9.

**Scope:** the repo holds only `interfaces/`, `api/` (Zod HTTP contract), and `models/` — **no runtime code**. Board-generation logic and response/connection helpers move into the services that use them, which also means B2B's board generation becomes a deliberate fork of D2C's (PRD `GAME-F1` expects B2B to grow game types D2C won't have).

**Accepted costs:** reference definitions (`BettingProp`/`BetEvent`/`Entity`) and board-generation logic get copied rather than shared, and can diverge with nothing detecting it. Reference models are **full copies for now** — narrowing was attempted and deferred because the required field list cannot be determined by text search (every field name reads as "used"); it needs compiler feedback after the consumers are cut over.

## ~~Shared Data Model Submodule Drift~~ — Resolved (2026-08)

`pb-shared-deps` and `core` are gone from both B2B repos, replaced by `obs-b2b-shared` (see the decision entry above). All four checkouts are pinned to the same commit. Drift is still *possible* — they remain separate checkouts — but there is now one repo instead of two, and the `ecs-branch`/`main` divergence that made B2B changes conflict with D2C work no longer applies.

Original problem, for context:

`pb-shared-deps` is vendored as four separate checkouts (frontend + backend's `lambdas/`, `node-server/`, `prize-worker/`), each pinned to a different commit. The backend's own `TODO` flags this as known and unresolved. A schema change to a shared model (e.g. `B2BBoard`) isn't guaranteed to be in sync across all four consumers today.

## Testing: Effectively Zero Coverage Anywhere

Both repos have no real test coverage — the CDK app's test file has every assertion commented out, and neither `node-server`, the Lambdas, `prize-worker`, nor the frontend has any test files or testing libraries installed at all.

## Known-But-Unaddressed Items (from the repos' own TODO files)

These are gaps the original author already flagged, not new findings — useful signal for what was already understood as unfinished:

- Frontend `TODO.md`: `SignUp.tsx` sends `VITE_TENANT_SLUG` (an env var) as `tenantSlug` instead of the subdomain-resolved `tenant?.slug` — since production tenant resolution is subdomain-based, this can tag a new user with the wrong tenant. **Decision (2026-08): deferred — not being worked on right now.** If it does get fixed, do it as a complete fix (using `tenant?.slug` consistently, not a partial patch), not a quick patch.
- Backend `TODO`: "Get Database Access Configured for the Task" (manual provisioning), "fix submodules" (drift above), "Figure out how to test the functions" (no test strategy).

## Styling System Doesn't Consistently Use Its Own Tenant-Theming Tokens

Found (2026-08) while writing [`spec/webapp/styling.spec.md`](../../spec/webapp/styling.spec.md), a reference catalog of the app's actual visual conventions. Two live pages bypass the semantic color tokens the tenant-theming system (`tenant-color-system.md`) depends on, so their copy/badges don't actually re-skin per tenant the way the rest of the app does:

- `PageHeader.tsx` and `BackButton.tsx` — live on `/board/:boardId` and `/dashboard` — hardcode `text-gray-400`/`text-gray-500`/`text-white` instead of `text-muted-foreground`/`text-foreground`. Any tenant's configured text colors are silently ignored on both routes.
- `ContestCard.tsx` — live on `/contests` — hardcodes `bg-blue-600`/`bg-emerald-600`/`bg-rose-600` on its status badge instead of using `StatusBadge`'s own token-based `variantStyles` (`bg-info/15`, `bg-success/15`, `bg-destructive/15`, …), which every other status pill in the app already uses. The same contest status renders with two different color treatments depending on which code path draws it.

## Declared Brand Font Never Loads

`index.css` sets `--font-sans: 'Satoshi', ui-sans-serif, system-ui, sans-serif`, but no `@font-face` for Satoshi exists anywhere in the repo, and no hosted font `<link>` is present. Every environment — every tenant, dev and prod alike — has been silently rendering in the system sans-serif fallback the whole time. Not broken behavior (the fallback stack works), but the brand typeface has effectively never shipped.

## Dead / Leftover Code Worth Cleaning Up

Not security issues, but noted since they'll cause confusion if picked up as "existing patterns" while writing specs: frontend `lib/mock/*` (~800 lines, entirely unused), `HomePage.tsx` (unrouted — also the only place in the codebase implementing the gradient CTA pattern documented in `tenant-color-system.md`; every live primary button is a solid `bg-primary`, see `styling.spec.md`), `BingoProgress.tsx` (unrouted; its fill-bar and achieved-milestone classes also carry malformed Tailwind arbitrary-value syntax — `bg-(--tenant-primary)]`, a stray trailing bracket — so the tenant color wouldn't apply even if it were wired up), a commented-out "anonymous board claim" flow spread across three files, an unused `mongoose` frontend devDependency; backend's `send-three-in-a-row-email.ts` (dead code, never called).
