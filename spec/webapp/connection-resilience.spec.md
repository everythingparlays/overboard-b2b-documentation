# Webapp Spec: Connection Resilience and Error States

**Implements:** the stadium-wifi readiness work (2026-11-05). Touches PRD `AUTH-02`/`AUTH-03` only in that the entry gate keeps its behaviour. Plan of record: workspace `offline-resilience-plan.md`.

**Depends on:** [`entry-gate.spec.md`](entry-gate.spec.md) (membership, 409 discipline), [`fan-preview-mode.spec.md`](fan-preview-mode.spec.md) (the preview tree mounts `AppRoutes` on its own).

**Status:** Draft, 2026-11-05 (Nick + Claude). Being built on `overboard-b2b-template` branch `feature/connection-resilience`.

## Overview

The fan app runs in stadiums on wifi that associates, then stalls. Today a stalled or failed request can replace a working screen with an error, send the fan to a document reload that ends on Safari's "not connected" page, or blank the whole app with "We couldn't confirm your access" because one background membership refetch failed.

**The whole change, in one line:** a screen that has data never loses it; the fan is told about the connection in one place; and every loading, error, access and refresh decision is made once, under the pages, so a page declares its reads and renders them.

---

## Four layers, one decision each

| Layer | Where | Decides |
|---|---|---|
| Transport | `store/resilientBaseQuery.ts`, applied in `makeStore` to any base query (network or preview) | 15 s timeout; offline short-circuit; every error becomes an `AppError`; reports "answered" / "no answer" / "server trouble" / "paused" to the connection store |
| Session | `components/shell/AppShell.tsx`, one layout route around every protected screen | Who the fan is and whether they may see this tenant (`Session`); the connection banner; pull-to-refresh; the render error boundary |
| Screen | `components/screen/QueryBoundary.tsx` | Skeleton vs error vs content for a set of reads; content stays mounted through later failures |
| Page | each page | Its reads, its skeleton, and its not-found wording. Nothing else |

### Transport

- `fetchBaseQuery` runs with `timeout: 15000`. A hung socket becomes `timeout`, never a screen that waits forever.
- When `navigator.onLine` is false a read fails at once as `offline` without touching the network, so a reconnect burst does not queue doomed fetches.
- `AppError`: `{ kind, status?, code?, retryAfterMs?, message }` with `kind` one of `offline | network | timeout | rate_limited | server | session | not_found | refused`. `message` comes from one copy function (`lib/errors/copy.ts`, the former `getErrorMessage`), so no page words an error.
- The WAF's per-path 429 pause stays; a paused call fails as `rate_limited` with `retryAfterMs` set so the banner can count down.
- Connection reporting: `offline`/`network`/`timeout` → no answer; `server` (5xx) → server trouble; `rate_limited` → paused until; everything else → answered.
- `refetchOnReconnect` stays on. `refetchOnFocus` is off for polled endpoints (they have a beat) and on for one-shot reads. Both are set per endpoint in the builders, never in pages.

### Session

`AppShell` replaces the eleven per-route `ProtectedRoute` wrappers with one layout route and exposes `useSession()`:

| Phase | Meaning | Renders |
|---|---|---|
| `booting` | Clerk not loaded yet, under 8 s | `ScreenSkeleton` |
| `unreachable` | Clerk not loaded after 8 s, or offline with Clerk not loaded | `ErrorState` "We can't reach sign-in right now." + Try again (re-runs `clerk.load()`) |
| `anonymous` | no session | `<Navigate to="/">` |
| `checking` | signed in, membership never read, read in flight | `ScreenSkeleton` |
| `unknown` | signed in, membership never read, read failed | `ErrorState` with the `AppError` copy + Try again. The one fail-closed state |
| `gated` | not a member, or blocked by consent/field | `JoinTenantPage` in place (deep link survives) |
| `member` | may play; `stale: true` when the last refetch failed | the page |

Rules:

- A membership once read stands. A failed refetch marks it `stale`; it never moves a member to `unknown`. The server still refuses writes with 409, as `entry-gate.spec.md` already requires, so client gating is presentation.
- `PrizeSheetHost`, `SideMenu` and the `/` redirect read `useSession()` rather than re-deriving from Clerk and the membership query.
- Logout keeps its choreography (`SignOutTransition`, 8 s hard-landing fallback).
- `AppShell` lives inside `AppRoutes`, so the preview tree gets the same shell.

### Screen

```tsx
<QueryBoundary queries={[boardQ]} skeleton={<BoardPageSkeleton />} what="your board"
  notFound={{ message: "This board isn't available.", action: { label: "Back to contests", to: "/contests" } }}>
  {() => <Board board={boardQ.data!} />}
</QueryBoundary>
```

- Every query without data and loading → `skeleton`.
- Any query errored while no data → `ErrorState` (full height) with the error's copy, **Try again** (re-runs every read on screen in place), optional secondary action. `not_found` uses the page's `notFound` copy and shows no Try again.
- All queries have data → children, and they **stay rendered** through any later failure. The banner carries the story. Reads never toast.
- `QueryResult<T>` = `{ data?, isLoading, isFetching, isError, error?: AppError, refetch }` is shared by RTK hooks and the trivia data source, so the four trivia pages use the same boundary. The trivia mock implements `refetch` against its in-memory store.
- Mutations report through one `toastError(appError)`; refusal codes keep their shared copy.

### Refresh

- Native pull-to-refresh is off (`overscroll-behavior-y: none` on `html, body`). On iOS it reloads the document; offline that is Safari's error page.
- `PullToRefresh` in `AppShell` owns the gesture: at the top of the page, a downward pull past 72 px re-runs every query in the cache in place (`refreshActiveQueries`). The same function backs every Try again. Cached data stays on screen until an answer lands.
- Touches that begin inside an open drawer, a dialog, or an already-scrolled element are not pulls.

---

## The banner

One strip, top centre, above every protected screen, never covering content. States, in priority order when several apply:

| State | When | Clears |
|---|---|---|
| offline | the browser says no network | browser says online |
| weak | the last request got no answer (network or timeout) while the browser says online | any answered request |
| trouble | two consecutive 5xx on any path (one beat of the 6 s standings poll is forgiven) | any answered request that is not a 5xx |
| paused | a path is rate-limited; shows a countdown from `retryAfterMs` | the pause ends |
| back | a bad spell (any of the above) just ended; shown 2.5 s | timer |

The banner is informational. It has no button; Try again lives on `ErrorState` and the pull gesture refreshes.

---

## Copy

Reviewed 2026-11-05 against the usual rules for state and error copy: say what happened, what the app is doing, and what the fan can do, in that order; plain words a fan at a game would use; sentence case; no blame and no "oops"; no technical nouns (server, session, token, refetch, cache); the button says the action, not "OK"; one idea per line. Every line below is the one source; pages do not write their own.

### Banner

| State | Copy | Notes |
|---|---|---|
| offline | No connection · showing the last update | "Showing the last update" says the numbers are real, just old |
| weak | Weak connection · retrying | "Retrying" says the fan need not act |
| trouble | Having trouble updating · retrying | Deliberately not about the connection: the fan's bars are fine |
| paused | Updates paused · back in 20s | The number counts down; after 0 the strip leaves |
| back | Back online | Was "Connected"; "Back online" is the phrase fans know |

### ErrorState (no data yet)

| Kind | Line | Button |
|---|---|---|
| offline | You're offline. We'll load {what} as soon as you're back. | Try again |
| network, timeout | We couldn't load {what}. Check your connection and try again. | Try again |
| server | Something went wrong on our end. Give it a moment and try again. | Try again |
| rate_limited | Too many requests right now. Try again in {n}s. | Try again (disabled until 0) |
| session | Your sign-in has expired. Sign in again to keep playing. | Sign in |
| refused (coded) | the shared copy for the code | Try again, unless the code says otherwise |
| not_found | the page's `notFound.message`, e.g. "This board isn't available." | the page's action, e.g. Back to contests |

{what} is the page's noun in the fan's words: "contests", "your board", "standings", "your runs", "this run", "your reports", "this page".

### Session screens

| Phase | Line | Button |
|---|---|---|
| unreachable | We can't reach sign-in right now. Check your connection and try again. | Try again |
| unknown | We couldn't check your access. {kind line above} | Try again |

### Retired lines

"Try refreshing the page", "Check your connection and reload the page", "Network error — check your connection", "Contest not found." for a network failure, "That run isn't in this contest's history." for a network failure, and every page-local "We couldn't load X right now."

---

## Acceptance criteria

1. On Standings with data, airplane mode on: the rank stays, the offline strip appears within a second, no toast, no navigation. Airplane mode off: "Back online" shows, the standings update on the next beat.
2. On any protected page with data, a failed membership refetch changes nothing visible.
3. A cold load with no network shows the unreachable or offline `ErrorState` with Try again, never a skeleton that never settles and never the Account Portal.
4. Pull down at the top of any page, online or offline: the app's indicator appears, the page never reloads, and Safari's error page never appears.
5. Two consecutive 5xx on a polled path shows the trouble strip; one does not.
6. A 429 shows the paused strip with a countdown; the poll resumes after it.
7. Board, Contests, Dashboard, the four trivia pages, Legal, the two report pages and the report form all render skeleton → content or skeleton → `ErrorState` with Try again through `QueryBoundary`, with no page-local error copy left.
8. `/preview` renders every screen with the shell present and no console errors.
9. Tests: transport (timeout, offline, normalisation, reporting), connection store (states, priorities, two-strikes, countdown), `AppShell` (every phase incl. stale-stands and unreachable), `QueryBoundary` (skeleton, error, stays mounted, not-found), and one migrated page per family.
