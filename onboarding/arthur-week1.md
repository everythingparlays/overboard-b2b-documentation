# Arthur — Week 1

**Assignee:** @arthurwin
**Order:** these three phases are sequential — don't start a phase until the previous one's PR is merged. That keeps each PR small, reviewable, and easy to back out if something's wrong, rather than one big tangled diff.

---

## Phase 1: Environment Setup

Follow [`SETUP.md`](../SETUP.md) in this repo, start to finish.

A couple of things specific to you, worth knowing up front:

- You only need the **frontend** (`overboard-b2b-template`) running locally for both tasks below. You don't need AWS/CDK access or a Mongo connection string of your own yet — point your local `.env`'s `VITE_API_BASE_URL` at whatever backend URL you're given (), you won't be running the backend yourself this week.
- **Read [`SETUP.md`'s "Boundaries" section](../SETUP.md#boundaries--read-this-before-your-first-pr) before you start writing code.** It covers two hard rules: never edit inside the `pb-shared-deps` submodule, and never connect to the production database. Phase 3 below is a deliberate, approved exception to the first rule for the `core` submodule *specifically* — `pb-shared-deps` stays off-limits the whole time, that part doesn't change.
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

## Phase 3: Retire the `core` Submodule

**Goal:** `overboard-b2b-template` stops depending on `core` as a git submodule. Everything it currently provides gets folded directly into this repo's own `src/`, with **no change in app behavior** — this is a structural move only, not a rewrite. See the "Retire the `core` Submodule" decision in [`known-issues.md`](../documents/POC-baseline/known-issues.md) for why: `core` (`overboard-b2b-shared-deps`) turned out to only ever be used by this one repo, so there's no real sharing benefit to it being separate — it's just extra submodule overhead.

### Steps

1. **Inventory before you touch anything.** List everything under `core/src/`, then grep the rest of `src/` for every `@core/...` import to confirm you know every consumer. Don't rely on memory — confirm with the tool. This inventory is what the redistribution mapping in step 2 is based on — if you find something in `core/src/` not covered there, use judgment based on the categories that already exist rather than forcing it in somewhere it doesn't fit, and flag it if you're unsure.

2. **Redistribute each file into where it actually belongs in `src/`** — following the app's existing organization, not one dumping-ground folder. Based on what `core` is known to contain:
   - **Layout components** (`PageContainer`, `PageHeader`, `BackButton`, `StickyFooter`) → new `src/components/layout/` folder, matching the existing per-concern layout of `components/` (`auth/`, `board/`, `contests/`, `dev/`, `ui/`).
   - **`core/src/types/tenant.ts`** (the `TenantConfig` type) → merge into the existing `src/types/tenant.ts`, which today is just a thin re-export shim pointing at this file — replace the shim with the real content so the type lives directly in this repo.
   - **`core/src/utils/contest.ts` and `eventHelpers.ts`** → `src/lib/`, matching the existing `lib/utils.ts` and `lib/errorHandler.ts`.
   - **The `homePageSchema` zod schema** → co-locate it with `src/pages/HomePage.tsx` (it's only used there today, per the audit) rather than a shared location — unless your step-1 grep turns up another consumer, in which case put it somewhere more shared and say so in the PR.

3. **Update every `@core/...` import to the new path, in small batches.** Do this one category at a time (types, then utils, then components) — fix the imports for a batch, run `npm run build`, confirm it's clean, then move to the next batch. That way if something breaks you know exactly which move caused it, instead of untangling one giant diff.

4. **Once nothing imports from `@core` anymore**, confirm with a final repo-wide grep for `@core` (should be zero matches outside config files), then remove the alias entirely:
   - `vite.config.ts`: delete the `@core` entry from `resolve.alias`.
   - `tsconfig.json` / `tsconfig.app.json`: delete the `@core/*` entry from `paths`.

5. **Bring over any dependencies `core` actually needs.** Check `core/package.json` against what's actually imported in `core/src/` (grep again — don't assume everything listed there is used; the earlier audit flagged `zustand`/`date-fns` as present but not obviously used). Add only what's genuinely needed to `overboard-b2b-template/package.json`, then `npm install`.

6. **Remove the submodule properly:**
   ```bash
   git submodule deinit -f core
   git rm -f core
   rm -rf .git/modules/core
   ```
   Then delete the `[submodule "core"]` block from `.gitmodules`.

7. **Update `vercel-install.sh`.** It currently rewrites the submodule URL for both `core` and `pb-shared-deps` before `git submodule update`. Remove the `core` line — `pb-shared-deps` is still a real submodule and that part stays.

8. **Don't touch the documentation repo.** Once your PR is merged, tell Nick (or flag it in chat) and the docs (`known-issues.md`, `AGENTS.md`, `SETUP.md`, the workspace diagram) will get updated to drop `core` from the picture. That's not part of this ticket.

### Verification — "not affecting functionality" is the actual acceptance criterion here

- `npm run build` (runs `tsc -b && vite build`) completes with no type errors.
- `npm run lint` passes.
- `npm run dev` starts clean, no import-resolution errors in the console.
- Click through every page that used something from `core` and confirm it looks and behaves identically to before your change: layout wrapper components (`PageContainer`, `PageHeader`, `BackButton`, `StickyFooter`) wherever they're used, and contest status badges (they use `core/utils/contest.ts` and `eventHelpers.ts` for status/team-name formatting). If you're not sure everywhere they're used, that's what step 1's grep was for.
- Repo-wide grep for `@core` returns nothing outside of git history — no leftover imports, and the alias itself is gone from `vite.config.ts` and both `tsconfig` files.
- `git submodule status` should list only `pb-shared-deps` — no `core` line.
- `HomePage.tsx` isn't routed anywhere in the app, so you can't click-test it, but it does import the schema you relocated in step 2 — just confirm the project still type-checks and builds with it in place; don't spend time manually exercising dead/unrouted code beyond that.

### A note on scope

This is a bigger, riskier change than Phase 2 — it touches how the whole app resolves a chunk of its imports. Open the PR with a clear description that it's structural-only with no intended behavior change (so whoever reviews it knows to focus on "does everything still work the same," not on reviewing new logic), and ask for a review before merging rather than merging solo. If anything about a step above doesn't match what you actually find in the code, stop and ask rather than improvising — that's true for all three phases, but especially this one.
