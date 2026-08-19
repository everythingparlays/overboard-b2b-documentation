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

## MongoDB Auth Should Standardize on IAM (Lower Priority)

Both auth paths described in [`infra.md`](infra.md) are currently live in production: ECS tasks (main API, prize-evaluator) authenticate to Atlas via AWS IAM; Lambdas instead use a plain connection-string secret (`MONGODB_SECRET_ARN`).

**Decision (2026-08):** standardize all services on IAM auth — it's more traceable and consistent than a shared connection-string secret. Confirmed as a real target, but explicitly **lower priority** than the tenant-isolation and consent-persistence gaps above.

## External Dependency: `prop-hit` Queue Producer Lives in Another Repo

**Confirmed (2026-08): the producer is [`PbCdkMonoRepo`](https://github.com/everythingparlays/PbCdkMonoRepo)** (added to `AGENTS.md`'s Related Repositories table). The `prop-hit` SQS queue (consumed by the `prop-update-evaluator` Lambda, see [`workers.md`](workers.md)) is published to from code in that repo, not present in this workspace. This is a real, unformalized cross-repo dependency — the message contract (`{propId, type, timestamp}`, inferred from the consumer side only) isn't specified anywhere as a shared interface; it just happens to match what the Lambda expects today.

**Still needs to be solved, not just located.** Next step: specify the message contract as a proper shared interface (likely belongs in `spec/core-modules/` since it's consumed cross-repo) so a schema change on either side doesn't silently break the other. Not yet done.

## Confirmed: Legacy D2C Models Cannot Be Modified

`Contest`, `User`, `Board`, `Prop`, and related non-`B2B`-prefixed models (see [`backend.md`](backend.md)) are actively serving the live D2C mobile app in production, on the same database the B2B platform reads from. **Confirmed (2026-08): these cannot be changed.** Any B2B-driven schema work must be additive (new `B2B*` models/fields) rather than touching these directly — this is a hard constraint on how the tenant-isolation, indexing, and data-model fixes above get implemented, not just a note.

## Shared Data Model Submodule Drift

`pb-shared-deps` is vendored as four separate checkouts (frontend + backend's `lambdas/`, `node-server/`, `prize-worker/`), each pinned to a different commit. The backend's own `TODO` flags this as known and unresolved. A schema change to a shared model (e.g. `B2BBoard`) isn't guaranteed to be in sync across all four consumers today.

## Testing: Effectively Zero Coverage Anywhere

Both repos have no real test coverage — the CDK app's test file has every assertion commented out, and neither `node-server`, the Lambdas, `prize-worker`, nor the frontend has any test files or testing libraries installed at all.

## Known-But-Unaddressed Items (from the repos' own TODO files)

These are gaps the original author already flagged, not new findings — useful signal for what was already understood as unfinished:

- Frontend `TODO.md`: `SignUp.tsx` sends `VITE_TENANT_SLUG` (an env var) as `tenantSlug` instead of the subdomain-resolved `tenant?.slug` — since production tenant resolution is subdomain-based, this can tag a new user with the wrong tenant. **Decision (2026-08): deferred — not being worked on right now.** If it does get fixed, do it as a complete fix (using `tenant?.slug` consistently, not a partial patch), not a quick patch.
- Backend `TODO`: "Get Database Access Configured for the Task" (manual provisioning), "fix submodules" (drift above), "Figure out how to test the functions" (no test strategy).

## Dead / Leftover Code Worth Cleaning Up

Not security issues, but noted since they'll cause confusion if picked up as "existing patterns" while writing specs: frontend `lib/mock/*` (~800 lines, entirely unused), `HomePage.tsx` (unrouted), `BingoProgress.tsx` (unused, has a Tailwind syntax bug), a commented-out "anonymous board claim" flow spread across three files, an unused `mongoose` frontend devDependency; backend's `send-three-in-a-row-email.ts` (dead code, never called).
