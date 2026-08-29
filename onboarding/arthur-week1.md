# Arthur — Week 1

**Assignee:** @arthurwin
**Order:** these phases are sequential — don't start a phase until the previous one's PR is merged. That keeps each PR small, reviewable, and easy to back out if something's wrong, rather than one big tangled diff.

---

## Phase 1: Environment Setup

Follow [`SETUP.md`](../SETUP.md) in this repo, start to finish.

A couple of things specific to you, worth knowing up front:

- You only need the **frontend** (`overboard-b2b-template`) running locally for both tasks below. You don't need AWS/CDK access or a Mongo connection string of your own yet — copy `.env.example` to `.env.local` in the frontend repo and use the values there as-is. It has all three required vars (`VITE_API_BASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_TENANT_SLUG`) already filled in against the shared dev stack, so you shouldn't need to source anything yourself. **Confirm the API URL is still current with Nick before you start** — it points at a personal dev stack, which can be torn down and redeployed at a different address.
- **Read [`SETUP.md`'s "Boundaries" section](../SETUP.md#boundaries--read-this-before-your-first-pr) before you start writing code.** It covers two hard rules: never edit inside a shared submodule, and never connect to the production database. The frontend now has exactly one submodule — `obs-b2b-shared` — and it is off-limits for inline edits: changes there affect the backend too and go through that repo.
- Also skim [`documents/POC-baseline/README.md`](../documents/POC-baseline/README.md) — short version: the app you're looking at was built fast as a proof of concept, so don't assume every pattern you see is "the right way to do it." If something looks off, it might be a known issue (check `known-issues.md`) rather than something you did wrong.

**Done when:** `npm run dev` runs cleanly, the app loads at `localhost:5173` without the missing-env-vars error screen, and you can sign up / sign in against the backend URL you were given.

---

## Phase 2: Side Menu Story

Full spec: [`spec/features/3-active/side-menu-nav.md`](../spec/features/3-active/side-menu-nav.md) — read the whole thing, it's short and already has the requirements and acceptance criteria written out. Don't duplicate effort re-deriving what's already decided there; if something in it is unclear or seems wrong once you're in the code, ask rather than guessing.

Quick pointers, not a replacement for the spec:
- Use the shadcn CLI to add the `Sheet` component — don't hand-write it.
- Tenant colors come from CSS custom properties already set on `document.documentElement` (see `TenantContext.tsx`) — style with Tailwind theme tokens, not hardcoded hex values, so the menu automatically matches whichever tenant is loaded.
- Test with at least 2 of the 5 tenants in `src/config/tenants/` before calling it done (the acceptance criteria list this explicitly).

**Done when:** all acceptance criteria in the spec are checked off, PR opened and merged.

---

## Phase 3: ~~Retire the `core` Submodule~~ — DONE (2026-08, not by Arthur)

**This was completed while Arthur was still on Phase 1/2, so there is nothing to do here.**

`core` was absorbed into `overboard-b2b-template/src/` and both it *and* `pb-shared-deps` were
removed from the frontend, which now has exactly one submodule: `obs-b2b-shared`.

Where things landed, in case you need to find them:

| Was | Now |
|---|---|
| `core/src/components/layout/*` | `src/components/layout/` |
| `core/src/schemas/auth.ts` | `src/schemas/auth.ts` |
| `core/src/utils/eventHelpers.ts` | `src/lib/eventHelpers.ts` |
| `core/src/types/*` | merged into `src/types/*`, repointed at `@b2b-shared` |
| `core/src/utils/cn.ts` | dropped — duplicate of `src/lib/utils.ts` |
| `core/src/utils/contest.ts` | dropped — no consumers |
| `@pb-shared-deps/interfaces/*` | `@b2b-shared/interfaces/{b2b,reference}/*` |

Ask for a replacement third task if you finish the side menu with time to spare.
