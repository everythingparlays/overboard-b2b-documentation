# POC Baseline — Current State of the Implementation

## Origin

**Everything described in this folder was built as a fast-moving proof-of-concept, not against a spec.** The B2B platform was stood up quickly to sign and launch the first client (UND Men's Hockey, March 2026) and land subsequent deals. Architectural decisions, data models, and code patterns in the current `overboard-b2b-template` and `overboard_sports_backend` repos reflect that speed-first context — they were not derived from the [PRD](../PRD/OBS_B2B_Platform_PRD.md) or any of the `spec/` documents in this repository, because neither existed yet when the POC was built.

**Treat this folder as a factual record of what exists, not a description of what should exist.** Where `spec/` layer or feature specs are written, they define target state — and target state should be assumed to differ from POC baseline in most non-trivial ways, especially around security, tenant isolation, testing, and observability. Do not copy a POC pattern into new work just because it's what's there; check whether a spec covers it first, and if not, treat the gap as a signal that a spec is needed.

This documentation exists specifically to support the move from POC to a production-grade application (more secure, more reliable) — so alongside "what's built," each file below calls out what's missing or broken relative to the [PRD](../PRD/OBS_B2B_Platform_PRD.md), since that's the concrete punch list for the hardening effort.

## Contents

| File | Covers |
|---|---|
| [`webapp.md`](webapp.md) | Frontend — `overboard-b2b-template` (React/Vite, tenant resolution, auth UI, board/contest UX) |
| [`backend.md`](backend.md) | API — `overboard_sports_backend/node-server` (Express routes, auth middleware, data models) |
| [`workers.md`](workers.md) | Async pipeline — Lambda evaluators + `prize-worker` (board evaluation, prize fulfillment) |
| [`infra.md`](infra.md) | AWS CDK — `overboard_sports_backend/lib`, `bin` (VPC/ECS/ALB/SQS/Atlas topology) |
| [`known-issues.md`](known-issues.md) | Consolidated security/reliability gaps found across all of the above, mapped to PRD requirement IDs where applicable |

## Shared Components Across Both Repos

There are two distinct shared-code submodules in play, with different intended scopes — worth keeping straight since they're easy to conflate:

- **`pb-shared-deps`** (repo `everythingparlays/pb-shared-deps`) — shared interfaces/models across **all** OBS products: the D2C mobile app, the D2C website, and this B2B platform. This is the broader-scoped one. Vendored as **four separate checkouts**: the frontend's `pb-shared-deps`, and the backend's `lambdas/`, `node-server/src/`, and `prize-worker/` copies — each currently pinned to a **different commit**. The backend repo's own `TODO` file confirms this is known and unresolved ("fix submodules").
- **`core`** (repo `everythingparlays/overboard-b2b-shared-deps`) — intended to be shared specifically across the **B2B frontend and backend**. Today it's only actually vendored/consumed by the frontend (`overboard-b2b-template/core`) — the backend doesn't pull it in at all. Whether that's an intentional current-state gap (backend doesn't need anything from it yet) or something that should change is worth confirming when core-modules specs get written.

This matters for spec work: a shared-model spec in `spec/core-modules/` should treat `pb-shared-deps` as cross-product (changes ripple beyond this workspace) and `core` as B2B-scoped but currently frontend-only in practice, and account for the four-way commit drift on `pb-shared-deps` rather than documenting one canonical copy as if it were universally in sync.

## One-Line Status Per PRD Area

Full detail and evidence for each row is in [`known-issues.md`](known-issues.md) and the layer-specific files above.

| PRD Section | Status in POC |
|---|---|
| Tenant provisioning & routing (`TEN-*`) | Subdomain routing works; provisioning is 100% manual DB writes, no tooling |
| Signup, auth & configurable fields (`AUTH-*`) | Email+password + MFA-code built; Google sign-in **not built**; configurable-fields model **not built** |
| Opt-in consent (`OPT-*`) | Accepted at the API layer, **silently discarded before persistence** — a schema gap, not a missing feature |
| Branding & sponsor assets (`BRAND-*`) | Set-once branding hardcoded per tenant as intended; per-game sponsor asset config **not built** |
| Game & prize configuration (`GAME-*`) | Prize tiers exist as a data model; no admin path, fully manual |
| Prize delivery (`PRIZE-*`) | Queue/DLQ pipeline is solid; actual fulfillment is one hardcoded email flow, no coupon codes, no per-sponsor logic |
| Reporting & exports (`RPT-*`) | **Entirely unbuilt** — no CSV export, no sponsor scoping, no code at all |
| Security & data privacy (`SEC-*`) | Baseline gaps: 6 of 12 API routes have no auth at all; no tenant-isolation checks anywhere; HTTPS off in checked-in config |
| Observability (`OBS-*`) | Console logging only; the only alerting is "a dead-letter queue has ≥1 message" |
