# Product Requirements

`OBS_B2B_Platform_PRD.md` (v2, August 2026, owner: Nick Depies) is the product requirements source of truth for the B2B platform. Every requirement carries a stable ID (`TEN-*`, `AUTH-*`, `OPT-*`, `BRAND-*`, `GAME-*`, `PRIZE-*`, `RPT-*`, `SEC-*`, `OBS-*`) and a scope tag (`[V1]`, `[FUTURE]`, `[CONSTRAINT]`).

Feature specs in `spec/features/` should reference these IDs directly rather than re-describing requirements, so there's a traceable line: PRD requirement → feature spec → implementation.

Section 13 (Security & Data Privacy) references an external **Fan Data Flow Diagram** (Google Doc) and a Pre-Launch Compliance Checklist not included in this repo — those stay in their existing location; only what shapes platform architecture is carried into the PRD itself.

Section 15 (Open Items) lists unresolved questions (export delivery mechanism, contest finalization authority, retention windows) — check there before assuming a gap is a documentation oversight rather than a known open decision.
