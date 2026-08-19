# Webapp Baseline — `overboard-b2b-template`

> Part of [POC Baseline](README.md) — reflects the code as built during the POC phase, not target architecture.

## Stack

React `19.2.0`, Vite `7.2.4` (SWC plugin), TypeScript `~5.9.3`, Redux Toolkit `2.11.2` + RTK Query, React Router `7.13.0`, `@clerk/clerk-react` `5.60.0`, Tailwind `4.1.18` (CSS-first config, no `tailwind.config.js`), shadcn/ui ("new-york" style) on `radix-ui`, `react-hook-form` + `zod`, `sonner` (toasts), `canvas-confetti`.

Two git submodules consumed via TS path aliases: `core` (`overboard-b2b-shared-deps` — shared layout components, contest/event helpers) and `pb-shared-deps` (shared TS interfaces with the backend, consumed only via `import type`).

`mongoose` is present in `devDependencies` but unused anywhere in `src/` — leftover, not wired to anything.

## Project Structure

```
src/
  components/
    auth/       ProtectedRoute.tsx
    board/      BingoCell.tsx, BingoProgress.tsx (unused/dead), PrizeModal.tsx
    contests/   ContestCard.tsx, PlayerCard.tsx
    dev/        ErrorTestPanel.tsx (dev-gated)
    ui/         shadcn primitives
  config/tenants/   bbgs.ts, bears.ts, fightinghawks.ts, warriors.ts, test.ts, index.ts
  context/      TenantContext.tsx
  hooks/        useTenant.ts
  lib/          errorHandler.ts, utils.ts, mock/ (contests.ts, players.ts — unused)
  pages/
    auth/       SignIn.tsx, SignUp.tsx, StartScreen.tsx, SignInTest.tsx
    board/      BoardPage.tsx
    contests/   ContestsPage.tsx, ContestPage.tsx
    dashboard/  DashboardPage.tsx
    HomePage.tsx (unrouted/dead), Test.tsx (routed — see known-issues.md)
  store/        index.ts (RTK store), api/contestApi.ts
  types/        board, contest, player, tenant, user (thin re-export shims over pb-shared-deps)
```

## Tenant Resolution

`TenantContext.tsx`'s `resolveTenantSlug()`:
- **Production**: subdomain of the hostname (`bears.overboardsports.com` → `bears`).
- **Local dev / Vercel preview**: falls back to `VITE_TENANT_SLUG`, defaulting to `"test"`.

The slug looks up a hardcoded local registry (`config/tenants/index.ts` — **5 tenants**: `fightinghawks`, `bbgs`, `warriors`, `bears`, `test`) for static branding (colors, logo, sponsor), then fetches `${VITE_API_BASE_URL}/b2b/org/{slug}` to get the real `organizationId` and merges it in. **If that fetch fails, it silently falls back to the local config with `organizationId: ""`** — the app still renders, but contest data will be empty with no visible error.

Tenant colors are applied by writing CSS custom properties onto `document.documentElement`, bridging into Tailwind's theme slots.

`prizes: []` fields on 3 of 5 tenant configs are marked `// TODO: management to populate`, but appear vestigial — actual prize data comes from the contest API's `prizeTiers` at runtime, not tenant config.

## Auth (Clerk)

Custom UI via `useSignIn`/`useSignUp` hooks: **email + password**, plus email-code as a second factor and for sign-up verification. **No Google/OAuth sign-in is implemented anywhere in `src/`**, despite `AUTH-01` calling for it at launch. (A separate, unlinked `/test-sign-in` route renders Clerk's prebuilt `<SignIn />` component, which *could* surface OAuth if enabled in the Clerk dashboard, but nothing in the actual signup flow uses it.)

No tenant-scoping inside Clerk itself (no Clerk Organizations). Tenant association happens purely at the app-data layer — on sign-up, a `createUser` mutation posts `organizationId`/`tenantSlug` alongside the Clerk user.

Session token for API calls is read via a raw, untyped `(window as any).Clerk?.session?.getToken()` in the RTK Query `prepareHeaders`.

## Routing

`react-router-dom` v7, `BrowserRouter`, defined in `App.tsx`:

| Path | Page | Protection |
|---|---|---|
| `/sign-up`, `/sign-in` | Sign-up/in | Redirect to `/contests` if already signed in |
| `/test-sign-in` | Clerk prebuilt sign-in | Public, unlinked |
| `/` | `StartScreen` (unauth) / redirect to `/contests` (auth) | Conditional |
| `/contests` | Contest list | `ProtectedRoute` |
| `/contest/:contestId` | Draft-your-squad | `ProtectedRoute` |
| `/board/:boardId` | Board view | `ProtectedRoute` |
| `/dashboard` | Dashboard | `ProtectedRoute` |
| `/test` | Dev/QA tool | `ProtectedRoute` only — **ships in production, not dev-gated** |

A commented-out "anonymous browsing / claim board" flow spans `App.tsx`, `SignUp.tsx`, and `contestApi.ts` — abandoned mid-build. `HomePage.tsx` exists with no route at all.

## State Management

Single RTK store, one reducer: an RTK Query `baseApi` against `VITE_API_BASE_URL`, auto-attaching the Clerk bearer token. **No plain Redux slices** — all app state is server state via RTK Query; no client-side UI-state slice.

Endpoints (`store/api/contestApi.ts`): `getContests`, `getPlayers` (contest detail), `generateBoard`, `getBoard`, `getMyBoards`, `createUser`. A `claimBoard` mutation exists commented-out only. All request/response types come directly from `pb-shared-deps` interfaces rather than app-defined DTOs.

## Board Feature

`BoardPage.tsx` is the largest page (~400 lines):
- **Polling-based live updates**: `useGetBoardQuery` polls every 2 minutes while the tab is focused. No WebSocket/SSE anywhere in the codebase.
- Renders the 3×3 grid via `BingoCell.tsx` — player photo, jersey number, stat abbreviation, target value, per-cell progress bar, hit state from `consensusOutcome === "Hit"`.
- **Client-side re-implementation of 3-in-a-row scoring** (`countParlaysHit()`, checks all 8 lines), used ahead of the server-computed `board.parlaysHit` as a fallback chain — scoring logic is duplicated client- and server-side.
- Prize-tier progress UI reads `contest.prizeTiers`; "already shown" state for the win modal is tracked via `localStorage` only, no server persistence.
- `PrizeModal.tsx` fires `canvas-confetti` in tenant brand colors on a newly-hit tier.
- `BingoProgress.tsx` is a separate, unused component with a Tailwind class syntax bug — superseded by logic built directly into `BoardPage.tsx`, never removed.

## Contests Feature

- `ContestsPage.tsx`: tabbed upcoming/past list, cross-references `getMyBoards` to route a user to their existing board vs. the draft page.
- `ContestCard.tsx`: matchup, prize preview, status badge (`Joinable`/`OpensSoon`/`Closed`/`Filled`/`Joined`) computed client-side from a joinable window (2 hours before event start).
- `ContestPage.tsx` ("Draft Your Squad"): pick up to 8 players, `generateBoard` mutation; on a 409 (board already exists) it silently redirects to the existing board rather than showing an error. Multi-event support is stubbed out — commented-out event-filter tabs, "temporarily hidden for single-event flow."

## Mock Data

`lib/mock/players.ts` and `lib/mock/contests.ts` (~800 lines combined) — fake NBA/NFL fixtures. **Confirmed unused anywhere in the app** (no imports outside the folder itself). All real data flow goes through RTK Query against the live API. Likely leftover from early UI scaffolding.

## Error Handling

`lib/errorHandler.ts`'s `getErrorMessage()` normalizes Clerk error codes, RTK Query network errors, and HTTP status codes into user-facing toast copy. It's message-formatting only — **no logging, no error reporting/telemetry** (no Sentry or equivalent anywhere in the app).

## Testing

**None.** No test files, no testing libraries in `package.json`, no `test` script.

## Deployment

Vercel-hosted. `vercel.json` proxies `/b2b/*` to a **hardcoded, plaintext-HTTP** AWS ELB DNS name (not HTTPS, not sourced from an env var) — the same raw hostname is duplicated in `pages/Test.tsx`. `vercel-install.sh` injects a `GITHUB_PAT` to authenticate private-submodule checkouts during Vercel builds.

A stale `dist/` build directory is checked into the repo root from an earlier commit.

See [`known-issues.md`](known-issues.md) for the security/reliability implications of the above (unauthenticated routes, exposed token, HTTP-only backend URL, etc.).
