# Nick — Session History

Newest first. High level only — detail lives in `spec/` and `documents/`.

---

## 2026-08-30 → 09-04 — Multi-tenant identity, auth, and consent

**Designed the fan identity model.** [HLD](../../documents/HLDs/multi-tenant-identity-auth.md) defines `IDN-01`–`IDN-13`; [implementation spec](../../spec/core-modules/1-draft/multi-tenant-identity-auth.spec.md) covers the cutover. The problem: Clerk shares sessions across subdomains by design and `B2BUser.clerkUserId` was uniquely indexed, so a fan of one team was silently admitted to another team's app — playing an activation whose opt-ins they had never seen (`OPT-02`, `SEC-03`). Decisions: one identity per human platform-wide, per-tenant membership created only by an explicit join, and consent evaluated as a gate on every entry rather than collected once at signup — which also makes `OPT-06` fall out for free.

**Clerk Organizations are for staff only, not fans.** Recorded both sides of the argument in the HLD. Fans are a database join table; Organizations are wrong for them mainly because active-org is one value per session and breaks two subdomain tabs at once.

**Sign-in method is a product variant, not config** (`IDN-09`, P2) — two fan Clerk instances platform-wide, sold as email-primary or phone-primary. The trade is recorded in the PRD under `AUTH-04`, with a revisit trigger, because it is a commercial decision as much as a technical one: a fan of teams on different variants gets two unlinkable identities.

**Implemented cutover steps 1–4.** `B2BFan` / `B2BFanMembership` split with the unique pair that makes `IDN-01` and `IDN-03` true at once; `resolveTenant` / `requireMembership` / `attachConsentState` middleware; `GET /b2b/membership`; a join flow with `ProtectedRoute`'s third state; and sign-up decoupled from enrollment. **Both live vulnerabilities are closed** — the cross-tenant contest read and the unauthenticated board read. `organizationId`, `tenantSlug`, and `clerkUserId` are gone from every request schema.

**First tests in the repo.** 17 passing, including a regression test that drives the real Express app end to end and asserts a fan of one tenant gets 403 on another's contests.

**Findings worth remembering:** `optInMessages` no longer exists in the frontend, so there was no consent copy to migrate — authoring it is a product/legal task. `autoIndex:false` meant the new unique indexes would never have been created; index creation is now in [`backfill_org_tenant_config.js`](../../mongodb_queries/backfill_org_tenant_config.js). And the tenant selector is untrusted input either way — the guarantee comes from the membership lookup, not the selector's provenance, which is why `IDN-04` was reworded.

**Local dev unblocked and documented.** `.env` support via Node's native `--env-file`, `.env` gitignored in both repos (it was not), and the four misleading failure modes written into `SETUP.md`.

---

## 2026-08-25 → 08-26 — Docs bootstrap, AWS multi-account, data isolation design

**Documentation repo created from scratch.** Spec-driven structure (`spec/` for prescriptive target state, `documents/` for context), PRD imported, `AGENTS.md`/`CLAUDE.md` entry points, `SETUP.md` onboarding guide.

**Audited both application repos** and wrote [`documents/POC-baseline/`](../../documents/POC-baseline/) — a factual record of what the POC actually is, explicitly separated from what it should be. Surfaced real gaps, now tracked in [`known-issues.md`](../../documents/POC-baseline/known-issues.md): 6 of 12 API routes unauthenticated, opt-in consent silently discarded before persistence, reporting/exports entirely unbuilt, no test coverage anywhere, a live session token exposed on a production route.

**Onboarding for Arthur** — [`onboarding/arthur-week1.md`](../../onboarding/arthur-week1.md) (env setup → side-menu story → retiring the `core` submodule), plus contributor boundaries in `SETUP.md` covering shared submodules and the production database.

**AWS multi-account split.** Created `obs-b2b-prod` (189750306402) and `obs-b2b-dev` (667523684851) as Organization members — the existing workload had been running in the Organization's *management* account. IAM Identity Center with an `obs-b2b-dev-deployers` group; root MFA on both.

**CDK stage parameterization.** `-c stage=<name>` now required with no default; config centralized in `lib/config/environments.ts`; deterministic `obs-b2b-{prod|dev-<stage>}-*` IAM role names. Found and fixed six hardcoded SQS queue names that would have collided the moment a second developer deployed. Spec: [`environments.spec.md`](../../spec/infra/environments.spec.md).

**Data access isolation — designed, not yet built.** [HLD](../../documents/HLDs/data-access-isolation.md) defines requirements `DATA-01`–`04`; [implementation spec](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md) covers the Atlas Trigger replication design. Key findings that shaped it: B2B `.populate()` calls cross the B2B/non-B2B boundary, so B2B's collections must move into the same database as the replicas; and B2B reads exactly three non-B2B collections (`BetEvent`, `Prop`, `Entity`), verified against code rather than assumed.

**Removed the Atlas API key dependency.** Atlas API keys can't be scoped to a database — only to a project — so one sitting in `obs-b2b-dev` was a standing path to production data. Dropped `CfnDatabaseUser` and `awscdk-resources-mongodbatlas` from CDK; database users are now created by hand in Atlas against deterministic role ARNs. IAM auth kept in both environments.

**Clerk** — non-production instance created; dev and prod secrets in Secrets Manager; code switched from ARN to name-based lookup so one config value works across accounts.

**Shortcuts taken deliberately** (tracked in `known-issues.md`): Atlas app roles were given database-wide `readWrite` instead of per-collection scoping, so `readonly_` is currently convention rather than enforcement.
