# OverBoard Sports B2B — Documentation & Specs

## Package Overview

This repo is documentation-only — no runtime code. It's the source of truth for the OBS B2B platform (a multi-tenant, white-labeled fan-engagement bingo game licensed to sports teams). It drives AI-assisted and human development against two implementation repos: `overboard-b2b-template` (frontend) and `overboard_sports_backend` (backend API + Lambda workers + AWS CDK infra).

## Read This First

1. **`documents/POC-baseline/README.md`** — Current implementation was built as a fast POC, not against specs. Read this before assuming any existing pattern is intentional or should be preserved as-is.
2. **`documents/PRD/OBS_B2B_Platform_PRD.md`** — The product requirements source of truth. Requirement IDs (e.g. `TEN-03`, `SEC-08`) are stable references used throughout specs. `[V1]` = build now, `[FUTURE]` = don't build but don't foreclose, `[CONSTRAINT]` = a rule shaping how V1 is built.

## Standards Hierarchy

Do NOT read all specs upfront. Select the relevant spec for the task at hand.

### Webapp Specs (`spec/webapp/`)

| Spec | When to read |
|------|--------------|
| `architecture.spec.md` | Overview, project structure, high-level frontend decisions |
| `<concern>.spec.md` | When working on that concern (routing, state, forms, tenant resolution, etc.) |

*(Not yet written — see `documents/POC-baseline/webapp.md` for current-state notes in the meantime.)*

### Backend Specs (`spec/backend/`)

| Spec | When to read |
|------|--------------|
| `architecture.spec.md` | Overview, route/handler structure, high-level API decisions |
| `<concern>.spec.md` | When working on that concern (auth, validation, data models, error handling, etc.) |

*(Not yet written — see `documents/POC-baseline/backend.md` for current-state notes in the meantime.)*

### Workers Specs (`spec/workers/`)

Lambda evaluators (board/prop evaluation, prize workers). Not yet written — see `documents/POC-baseline/workers.md`.

### Infra Specs (`spec/infra/`)

| Spec | When to read |
|------|--------------|
| [`environments.spec.md`](spec/infra/environments.spec.md) | Deploying, or writing CDK code that needs to be environment/stage-aware — covers the prod-vs-personal-dev-stack model, the `stage` context requirement, and the no-hardcoded-resource-names rule |

An `architecture.spec.md` covering the rest of the CDK stack (VPC/ECS/ALB/SQS/Lambda topology) hasn't been written yet — see `documents/POC-baseline/infra.md` for current-state notes in the meantime.

### Core Module Specs (`spec/core-modules/`)

Cross-cutting capabilities used across webapp, backend, and workers — most importantly **auth/tenancy** (Clerk + multi-tenant resolution) and shared data models. Note there are two different shared-model submodules with different scopes: **`pb-shared-deps`** is shared across *all* OBS products (D2C mobile + website + this B2B platform), vendored as four separate, currently-drifted checkouts; **`core`** (`overboard-b2b-shared-deps`) is scoped to just the B2B frontend and backend, though today only the frontend actually consumes it — **slated for retirement** (merge into `overboard-b2b-template`, drop the submodule) since it isn't actually shared across repos in practice; see the "Retire the `core` Submodule" decision in [`known-issues.md`](documents/POC-baseline/known-issues.md). See [`documents/POC-baseline/README.md`](documents/POC-baseline/README.md#shared-components-across-both-repos) for detail. These should be specced early since drift here propagates everywhere. Only read specs in `3-active/` (or `2-approved/` if implementing something not yet built) for implementation.

### Feature Specs (`spec/features/`)

Per-feature behavior. Only read specs in `2-approved/` or `3-active/` for implementation. Feature specs should cite the PRD requirement IDs they implement.

## Key Constraints

1. **The current codebase is a POC, not a spec-compliant target.** Don't treat existing patterns as correct by default — check whether a layer/concern spec exists and covers it first. See `documents/POC-baseline/`.
2. **Prefer configuration over per-tenant code** (PRD `TEN-C1`) — except set-once branding (`BRAND-01`) and per-sponsor prize fulfillment logic (`PRIZE-05`), which are explicit exceptions.
3. **Security and reliability are first-class, not deferred.** This effort exists specifically to take the platform from POC to production-grade (PRD Section 13 Security, Section 14 Observability). Flag gaps against those sections as they're found.
4. **Requirement IDs are stable.** When writing specs, tickets, or tests, reference PRD IDs (e.g. `OPT-04`) rather than re-describing the requirement.
5. **Never generate changes inside the `pb-shared-deps` or `core` submodule directories**, and never suggest connecting to or running scripts against the production MongoDB database (it also serves the live D2C mobile app — see `known-issues.md`). If a task seems to require either, stop and flag it instead of proceeding — see [`SETUP.md`](SETUP.md#boundaries--read-this-before-your-first-pr) for the full contributor-boundaries list this applies to.

## Related Repositories

| Repo | Purpose |
|------|---------|
| `overboard-b2b-template` | Frontend — fan-facing web app |
| `overboard_sports_backend` | Backend API, Lambda workers, AWS CDK infra |
| [`PbCdkMonoRepo`](https://github.com/everythingparlays/PbCdkMonoRepo) | External — publishes to the `prop-hit` SQS queue that `overboard_sports_backend`'s `prop-update-evaluator` Lambda consumes. Not part of this workspace/onboarding; the message contract between the two is currently informal — see [`known-issues.md`](documents/POC-baseline/known-issues.md). |
