# Nick — Session History

Newest first. High level only — detail lives in `spec/` and `documents/`.

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
