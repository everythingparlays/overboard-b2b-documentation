# OverBoard Sports — B2B Platform Documentation

This is a **documentation-only repository** (no runtime code) that acts as the single source of truth for the OBS B2B platform: what it should do, why it's built the way it is, and how AI-assisted and human development should generate consistent, architecture-compliant code against it.

It documents two implementation repos:

| Repo | Purpose |
|------|---------|
| `overboard-b2b-template` | Frontend — fan-facing web app (React/Vite) |
| `overboard_sports_backend` | Backend, workers, and infrastructure (Express API, Lambda evaluators, AWS CDK) |

## Where Things Live

```
overboardb2b-documentation/
├── AGENTS.md                   # AI agent entry point — what to read, when
├── CLAUDE.md                   # Points Claude/Kiro at AGENTS.md
├── README.md                   # You are here
├── spec/                       # Prescriptive — target state, drives code generation
│   ├── webapp/                 # Frontend layer specs
│   ├── backend/                # API server layer specs
│   ├── workers/                # Lambda evaluator layer specs
│   ├── infra/                  # AWS CDK / infrastructure layer specs
│   ├── core-modules/           # Cross-cutting capabilities (auth, tenancy, shared models)
│   └── features/               # Route-bound, user-facing features
└── documents/                  # Explanatory — context and history for humans (and AI background)
    ├── PRD/                    # Product requirements — the business "what and why"
    ├── POC-baseline/           # What actually exists today, as built during the POC phase
    ├── HLDs/                   # High-level designs — system-level architecture decisions
    └── LLDs/                   # Low-level designs — component-level "how"
```

## Specs vs. Documents

**Specs** (`spec/`) are instructions for AI to generate code from. Prescriptive, always current: "do it this way."

**Documents** (`documents/`) are context for humans (and AI background) to understand *why*. Narrative, mostly write-once.

If you deleted every file in `documents/`, AI could still generate correct code from `spec/` alone. `documents/` just explains why `spec/` says what it says.

## Workspace Layout

This repo is one of three, meant to sit side-by-side in a shared workspace folder:

```
obs-b2b-workspace/                     <- your workspace folder, any name
├── overboardb2b-documentation/        <- this repo (specs, PRD, POC baseline)
├── overboard-b2b-template/            <- frontend (React/Vite)
│   ├── core/                          <- submodule: overboard-b2b-shared-deps
│   └── pb-shared-deps/                <- submodule: pb-shared-deps
└── overboard_sports_backend/          <- backend, workers, infra (CDK)
    ├── lambdas/pb-shared-deps/            <- submodule: pb-shared-deps
    ├── node-server/src/pb-shared-deps/    <- submodule: pb-shared-deps
    └── prize-worker/pb-shared-deps/       <- submodule: pb-shared-deps
```

New to the project? [`SETUP.md`](SETUP.md) walks through cloning and configuring all three repos from scratch.

## External References

- **[Fan Data Flow Diagram](https://docs.google.com/document/d/1t-2GDvX-2Kog4SxgIK0Hu5u89Kw_ExrbCtbM7qVrFSI/edit?tab=t.0)** — the detailed fan-data-handling reference cited by PRD Section 13 (Security & Data Privacy). Lives in Google Docs, not mirrored here.
- Pre-Launch Compliance Checklist — referenced by the PRD, not yet linked here (ask the PRD owner for the current location if you need it).

## Where the PRD Fits

`documents/PRD/OBS_B2B_Platform_PRD.md` is the product requirements source of truth. Every requirement has a stable ID (e.g. `TEN-03`, `SEC-08`). Feature specs in `spec/features/` should reference the requirement IDs they implement, so there's a traceable line from "why we're building this" (PRD) to "how it's built" (spec) to "what exists today" (POC-baseline / code).

## Important Context: Current Code Predates This Process

**The existing implementation was built as a fast-moving POC, not against these specs.** See [`documents/POC-baseline/README.md`](documents/POC-baseline/README.md) for what that means concretely and what it implies about code quality, security posture, and architectural rigor. Specs in `spec/` describe target state — where a spec and the current code disagree, the code is what's expected to change, not the spec (unless we've explicitly decided otherwise).

## Status

This repo is being bootstrapped (August 2026) to move the OBS B2B platform from POC to a production-grade application. Directory structure and initial docs are in place; layer/feature specs are being written incrementally as we document existing patterns and define target architecture.
