# Webapp Spec: Fan App Preview Mode

**Implements:** Arthur's 2026-09-27 preview ruling (`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`, "Console redesign: comments", Preview): the console's preview shows only real screens of the **current** fan app, with the contest's real configuration, real players, photos and data, and nothing that doesn't exist. Navigation inside the preview is seamless, the console's screen tabs stay in sync as the admin clicks through, and there is a phone and a desktop preview. D-068: nothing fabricated appears on a customer surface.

**Revision 2026-09-28 (Wave 4b):** the preview is **phone only** (Arthur: "No desktop preview anywhere. The fan app is mobile-only"). The console always sends `device: "phone"` and offers no desktop toggle; the field stays in the contract so older consoles and frames still speak it, and "Phone and desktop" below is superseded. The console's Brand page renders every screen from a built-in sample contest rather than a real one ([`admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md), "The sample contest"); the fan app renders it like any other render document. The live board's bingo count is now the shared derived count (`boardBingos`, [`end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md) §1.5), which the preview board's claims already equal.

**Depends on:** [`../core-modules/1-draft/admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md), the console side (the frame, the tabs, the device toggle, and the admin read that builds the render document). [`../core-modules/1-draft/end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md) (Wave 3): the fan reads' shapes, the join refusals, `featuredGame`, board awards from the server, and the legal-document overlay the gate opens. [`entry-gate.spec.md`](entry-gate.spec.md): `EntryGateForm`, which the Join screen renders. [`styling.spec.md`](styling.spec.md): how a theme becomes CSS vars.

**Supersedes:** for the current fan app, the S1/S2 preview contract (`artifacts/wave-2026-09-24/s1-s2-preview-interface.md`, workspace) and S2's draft of this spec on the unmerged `arthur-s2-fanapp-spec` docs branch. Kept from them: the sessionless `/preview` route in its own chunk, the `obs-preview:` message family with `v`, the origin allowlist on both sides, `frame-ancestors` on `/preview` only, the "no API call from the frame" rule, full-replace renders, and the text-only rule. Dropped: the six overhaul screens, every fixture and sample name, the PREVIEW chyron, and "taps never navigate".

**Status:** Draft, written 2026-09-27 for Wave 4. Nothing in it is built: today the fan app (`overboard-b2b-template` on main, plus Wave 3's changes) has no preview route and no way to take its data from anywhere but the backend.

**Wave 5.** The fan app overhaul is built on a long-lived branch that is never merged to main. It implements **this same contract** on that branch: the same route, messages, render document and security rules, with its own screens listed in `ready.screens`. The console reads `ready.screens`, so the same console build previews either app. Nothing from the overhaul's look appears on main.

## Overview

The console needs to show an admin their contest as fans will get it, before and after publishing. The old plan (S1/S2) rendered the overhaul's screens from fixtures with sample players and a PREVIEW chyron. The ruling replaces that with the real current app, fed real data.

**The whole change, in one line:** `/preview` runs the current fan app itself (its routes, pages and components) with two things swapped: a preview session stands in for Clerk, and a preview data layer answers every fan read from the render document the console posts, so the admin can click through Start → Sign in → Join → Contests → Contest → Board exactly as a fan does.

---

## The route

**`/preview` is its own entry point.** The first thing `src/main.tsx` does is check `location.pathname`. If it is `/preview`, it lazily imports the preview tree and renders that. It never reaches the Clerk publishable-key check, `bootThemeForSlug`, `ClerkProvider` or `TenantProvider`'s network fetch. Every other path runs the existing bootstrap unchanged.

**The preview tree is the real app.** It renders the same route table as the live app, inside a `MemoryRouter`, with three providers replaced:

| Live app | Preview |
|---|---|
| `ClerkProvider` and Clerk's hooks | `PreviewSessionProvider`: a preview session (below) behind the same hook names |
| `TenantProvider` fetching `GET /b2b/org/:slug` | `TenantProvider` seeded from `document.org` (no fetch) |
| The RTK Query API slice over the network | The same API slice with `previewBaseQuery`, which answers from the render document and handles writes locally |

To make that possible without a second copy of any screen:

- **`App.tsx` splits** into `AppRoutes` (the `<Routes>` table) and the `BrowserRouter` wrapper. The live app renders `<BrowserRouter><AppRoutes/></BrowserRouter>`; the preview renders `<MemoryRouter><AppRoutes/></MemoryRouter>`.
- **Clerk is reached through one module.** Every page and component imports `useAuth`, `useUser`, `useSignIn`, `useSignUp`, `useClerk` from `src/auth/index.ts` instead of `@clerk/clerk-react`. The live build re-exports Clerk's hooks; the preview tree provides `PreviewSessionProvider`, whose hooks have the same signatures. An ESLint rule forbids importing `@clerk/clerk-react` anywhere else.
- **The store is created per tree.** `src/store/index.ts` exports `makeStore(baseQuery)`; the live app calls it with the network base query, the preview with `previewBaseQuery(documentRef)`.
- **Storage goes through one helper.** Every `localStorage` use (the award-shown marks, the theme boot cache, next-themes' key) goes through `src/lib/storage.ts`, which the preview points at an in-memory map, so the frame never reads or writes the fan's real storage.

**Own chunk.** The preview tree is lazily loaded. The live bundle carries no preview code, and the preview's import graph carries no Clerk.

**No tenant from the hostname.** On `{slug}.overboardsports.com/preview` the slug only chooses which host serves the page. Everything the screens show comes from the render document.

**Waiting state.** Until the first valid `render`, the page shows only a neutral, unbranded "Waiting for preview" line. Anyone who opens `/preview` directly sees only that, indefinitely.

**No PREVIEW marker.** The frame shows the app and nothing else. The current app has no chyron, and the data is real, so there is nothing to mark as sample. The console's frame, tabs and page make the context plain.

---

## The preview session

`PreviewSessionProvider` holds one in-memory fan whose steps follow the real journey:

| Session step | `useAuth().isSignedIn` | Membership | What the live app would show at `/contests` |
|---|---|---|---|
| `signedOut` | false | — | Redirect to Start |
| `signedIn` | true | Not a member | The Join gate (`ProtectedRoute` renders `JoinTenant`) |
| `member` | true | Member, no board | Contests |
| `playing` | true | Member with the preview board | Contests, with the card reading "Joined" |

The admin's own name and email are never used: the session's user has none, and every screen that would show one shows what the live app shows for an empty value (the gate's fields start empty, as they do for a new fan). The session never holds a token; `getToken()` answers `null`, and nothing in the preview sends one anywhere.

**How the steps advance, by the fan's own clicks:**

- Start's "Continue with Email" → the Sign in screen. Submitting Sign in (any input, nothing sent) → `signedIn`, and the app lands where a real sign-in lands (`/contests`), which shows the Join gate.
- Submitting the Join gate with its required fields and consents filled → `member`, then Contests, as a real join does. Its validation is the real `validateGate`, so a missing field shows the real error.
- Generate Bingo Board on the Contest screen → `playing`, then the Board.
- The side menu's Sign out → `signedOut`, then Start.

---

## The preview data layer

`previewBaseQuery` answers each request the app makes. Reads come from the render document. Writes change only the frame's memory. Nothing reaches a server.

| Request | Answer |
|---|---|
| `GET /b2b/org/:slug` (TenantContext) | `document.org` |
| `GET /b2b/membership` | Not a member (`document.membership`) until the session is `member`; then a member with the fields the gate collected |
| `GET /b2b/contest/list-contests?status=upcoming\|past` | `document.contests.upcoming` / `.past` |
| `GET /b2b/contest/:contestId` | `document.contest` when the id matches; any other id answers what the live server answers for a contest it can't find (404) |
| `GET /b2b/board/my-boards` | The preview board, once built; otherwise empty |
| `GET /b2b/board/:boardId` | The preview board, with `awards` (below) |
| Sponsor schedule (`sponsorApi.getSponsorSchedule`) | `document.schedule` |
| `POST /b2b/join`, `POST /b2b/consent`, `PATCH /b2b/membership` | Success, recorded in memory only |
| `POST /b2b/board/generate` | The preview board (below), or the same refusal the server would give (below) |
| Anything else | A 404, and the frame posts `obs-preview:error` naming the path, so a missed read is found in development rather than guessed at |

**Refusals are the server's.** `generate` refuses exactly as `POST /b2b/board/generate` would for this contest's data (Wave 3 §3.4): `closed` for a Closed contest, `full` when the players count has reached a limit, `no_players_yet` when no open game has visible props, `not_playable_here` for a non-playable type. The check is the shared `refuseJoin` logic, moved from the node-server into `obs-b2b-shared` so both call it. The fan app then shows its real message for that code.

### Building the preview board

Generate builds a board with the **same function the server uses**: the board-filling logic moves out of `node-server/src/game/bingo/board.ts` and `createBoard.ts` into `obs-b2b-shared/src/boards/buildBoard.ts`, a pure function `buildBoard({ pool, draftedPlayerIds, random })`. The server calls it with `Math.random`; the preview calls it with a random source seeded from the contest id and the drafted players, so the same draft gives the same board until the admin changes it.

- **The pool** is `document.contest.props` for the games the server would draw from (games not started; every game for a test-mode contest), exactly as `createBoard` selects them; `view.gameId` narrows it to that game.
- **A closed or finalized contest** (revised 2026-09-29, Arthur's Walk #3) has no game open for entry, so no fan can draft from it, but fans who joined hold boards on its games. For the Board and Prize screens the pool is then **every one of its games' props**, so the preview board is built from the contest's real games and real props, with their player photos. Generate is still refused as the server refuses it (`closed`). Nothing is read from, or written to, any fan's real board.
- **Hits and progress** are the props' real current values (`consensusOutcome`, `progressValue`). A board on upcoming games shows no hits; a board on played games (a closed or finalized contest, or a test-mode contest) shows the hits, progress and bingos that really happened.
- **The bingo count** is what the evaluator would claim: the shared `newlyCompletedLines(cells, [])` from `obs-b2b-shared/src/scoring/bingo-lines.ts` sets the board's `claimedLineIndices`. The browser never counts lines any other way (Wave 3 §1.5 holds).
- **Awards** on the preview board are empty, so the popup never opens by itself: only the server records a prize, and the preview has no server. The Prize screen (below) is how an admin sees the popup.

The board and the drafted players live in memory for the frame's life. A new `render` keeps them while every drafted player and every board cell still exists in the new document; otherwise the board is dropped and the session goes back to `member`.

---

## Screens

The screens are the current app's routes and states. `ready.screens` lists them in this order:

| Screen | Where it is in the app | Reached by clicking | Session step it needs |
|---|---|---|---|
| `start` | `/`, signed out: logo, "{Team} Bingo", "Pick your players. Win prizes.", "Presented by", the next game card, "Continue with Email" | Sign out | `signedOut` |
| `signIn` | `/sign-in`: the email sign-in form | "Continue with Email" | `signedOut` |
| `join` | `/contests` for a signed-in non-member: `EntryGateForm` with the tenant's fields, consents and gate copy; Terms, Privacy and opt-in documents open over it (Wave 3 §4) | Submitting Sign in | `signedIn` |
| `contests` | `/contests`: the Upcoming and Past tabs and the contest cards | Submitting the gate; the back arrow on Contest | `member` or `playing` |
| `contest` | `/contest/:contestId`: "Draft Your Squad", the per-game tabs, the real players with their photos, the drafted-player stack, Generate Bingo Board | Clicking the contest's card | `member` |
| `board` | `/board/:boardId`: "Your Board", the matchup line, the bingo counter, the prize track with tier labels, the sponsor banner, the nine cells with real player photos and lines | Generate Bingo Board; the card once joined | `playing` |
| `prize` | The Board with `PrizeModal` open for one tier, as a winning fan sees it (`isTierHit`, claim copy and button, confetti) | — (only the server opens it; tab only) | `playing` |

Going straight to a screen with `navigate` puts the session at the step the table names and the router at that route, **in one commit** (revised 2026-09-28): the app never renders the old route with the new step, so its own redirects (Start and Sign in send a signed-in fan to the contest list; a protected route sends a signed-out fan to Start) never carry the frame elsewhere. Every screen is reachable straight from every other. `board` and `prize` build the preview board first if none exists, with no drafted players (the server's fill for an empty draft). `contest` for a contest that isn't Open to fans (Draft previewed as if published is Open; Closed is not) shows exactly what the live app shows for it.

**The Prize screen.** With `document.prize` set (a prize page), the popup shows that prize, over the Board when there is a contest and on its own when there isn't. Otherwise it is the current Board with the real `PrizeModal` over it, for the tier `view.prizeTierIndex` names (default the first), built from that tier as the fan wire carries it (the library prize's content, snapshot shape; [`admin-prizes.spec.md`](../core-modules/1-draft/admin-prizes.spec.md)). The celebration (confetti, the team-colour flash) plays on arriving at `prize`, not on later renders that stay there, and never under reduced motion. **Choosing another tier** (a `navigate` to `prize` with a new `view.prizeTierIndex`) closes the previous tier's popup and opens the new one at once (revised 2026-09-28): the board holds only the chosen tier's award, and the board's popups follow the awards it holds, dropping one whose award is gone. On a fan's real board awards are never withdrawn, so this changes nothing there. "Close" or the claim button closes the popup and reports `board`. The claim button's link is not followed (below).

**A draft previewed as if published.** The console's document places a Draft contest in `contests.upcoming` and gives it the fan status it would have if it were published now, so the admin sees the card and the flow fans will get. An Open or Closed contest appears exactly where fans find it now.

**Screens not offered:** sign-up, forgot password, the paused screen, and the dashboard. None is part of the contest journey, and the console offers only screens it can put in a tab. A tap that would reach one (for example "Forgot password?") shows its press state and stays put.

---

## Navigation and tab sync

Clicks inside the frame navigate for real. Every time the frame's screen changes, whether by a click, the browser-style back arrow inside the app, or a `navigate` from the console, the frame posts `obs-preview:navigated` with the new screen once it has painted. The console moves its tab to match and does not send anything back, so there is no loop.

| In the frame | Posted |
|---|---|
| A click changes the route or the session step | `navigated { screen, cause: "click" }` |
| The console's `navigate` has been applied | `navigated { screen, cause: "console" }`, then `rendered` |
| A `render` keeps the same screen | `rendered` only |
| An overlay over a screen (a legal document over the gate, the tier info panel on the board) | Nothing: the screen is still `join` or `board` |

A route that isn't one of the screens (none exists in the contest journey today) posts `navigated { screen: null }`, and the console shows no tab selected.

---

## Messages

Every message is a plain JSON object whose `type` starts with `obs-preview:` and that carries `v: 1`. This is version 1 of this contract; the S1/S2 contract was never built, so nothing depends on its version.

```ts
type PreviewScreen = 'start' | 'signIn' | 'join' | 'contests' | 'contest' | 'board' | 'prize';

// ---- fan app -> console ----
interface PreviewReady    { type: 'obs-preview:ready';     v: 1; screens: PreviewScreen[]; app: 'current' | 'overhaul' }
interface PreviewRendered { type: 'obs-preview:rendered';  v: 1; screen: PreviewScreen | null; height: number }
interface PreviewNavigated{ type: 'obs-preview:navigated'; v: 1; screen: PreviewScreen | null; cause: 'click' | 'console' }
interface PreviewError    { type: 'obs-preview:error';     v: 1; message: string; screen?: PreviewScreen }

// ---- console -> fan app ----
interface PreviewRender   { type: 'obs-preview:render';    v: 1; document: PreviewDocument }
interface PreviewNavigate { type: 'obs-preview:navigate';  v: 1; screen: PreviewScreen; view?: PreviewView }
interface PreviewPing     { type: 'obs-preview:ping';      v: 1 }
```

- **`ready`**: mounted and listening; sent once on mount and in reply to every `ping`. `app` tells the console which app answered (Wave 5's branch sends `'overhaul'`).
- **`render`**: the full document. Every `render` fully replaces the last; the frame keeps only its session step, route and preview board across renders (see "Building the preview board"). The screen shown is the document's `screen` on the first render, and the current screen after that, so a data change never throws the admin off the screen they clicked to.
- **`navigate`**: go to a screen, with optional view settings. Sent only when the admin picks a tab or a host needs a particular screen.
- **`rendered`**: after paint, with the content height; again when the height changes (fonts arriving).
- **`error`**: something could not render. The frame shows the app's own error state for that screen where it has one; the console logs the message for developers.

**Rules.** Unknown fields are ignored. Unknown types, and messages whose type doesn't start with `obs-preview:`, are ignored. A known type with an unknown `v` gets an `error` reply and is not applied. A `render` that arrives before `ready` is kept and applied on mount.

---

## The render document

Every section is the **fan wire's own shape**, as the live fan reads return it for this tenant, so the app's code consumes it without translation. The console gets the whole document from one admin read, `GET /admin/contests/:contestId/preview` ([`admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md)), and overlays the host's unsaved edits.

```ts
interface PreviewDocument {
  /** Where the first render lands. */
  screen: PreviewScreen;
  device: 'phone' | 'desktop';

  /** GET /b2b/org/:slug for the tenant: name, logo, theme, marker image, legacy sponsor strings. */
  org: GetOrganizationResponse;

  /** GET /b2b/membership as a signed-in fan who hasn't joined sees it: signup fields,
   *  pending consents (with their linked documents once stored), gate copy. */
  membership: GetMembershipResponse;

  /** GET /b2b/contest/list-contests for each tab, with the previewed contest placed where fans
   *  would find it (a Draft as if published now). */
  contests: { upcoming: B2BContestResponse[]; past: B2BContestResponse[] };

  /** GET /b2b/contest/:contestId for the previewed contest: the contest with its prize tiers,
   *  and each game with its derived status, its players (photos, `showPhotoUri`, jersey,
   *  position) and `openForEntry` — plus the visible props of each game, which the fan read
   *  doesn't carry but the board builder needs. */
  contest?: GetPlayersResponse & { props: Record<string /* betEventId */, BettingProp[]> };

  /** A prize on its own, for a host with no contest (the prize page): the award's prize in the
   *  shape the board's `awards[].prize` carries, including `providedBy`. Only `prize` renders it. */
  prize?: AwardPrize;

  /** The public sponsor schedule the fan app reads (placements, sponsors, next game). */
  schedule: FanSponsorSchedule;

  view?: PreviewView;
}

interface PreviewView {
  /** Prize: which of the contest's tiers the popup shows (0-based, in tier order). */
  prizeTierIndex?: number;
  /** Board and Prize: build the preview board from this game only (sponsor page). */
  gameId?: string;
  /** Deprecated (2026-09-29): accepted and ignored. The frame draws no ring. */
  highlight?: { sponsorId: string; slot: SponsorSlot };
}
```

Types are the shared package's: `AwardPrize` (the board read's award prize, `api/b2b/board.ts`), `GetOrganizationResponse` (`api/b2b/org.ts`), `GetMembershipResponse` (`api/b2b/membership.ts`), `B2BContestResponse` (`interfaces/b2b/B2BContest.ts`), `GetPlayersResponse` and `BettingProp` (`api/b2b/contest.ts`, `interfaces/reference/BettingProp.ts`), `FanSponsorSchedule` (`api/b2b/sponsors.ts`), `SponsorSlot` (`interfaces/b2b/B2BSponsor.ts`). `PreviewDocument`, `PreviewView`, `PreviewScreen` and the message types live in `obs-b2b-shared/src/api/preview.ts`, imported by both apps.

**Without a contest.** `contest` is absent only for the prize page, whose prize belongs to no contest yet. Then `ready.screens` still lists every screen, but the console offers only `prize`, and the frame shows the real `PrizeModal` for `document.prize` on its own, over the app's background in the tenant's theme, with its credit ("Provided by" and the sponsor, read from `prize.providedBy` exactly as the live popup reads it from an award). Asked for any other screen without a contest, the frame answers `error`.

**Props carry only what the fan wire carries for a board cell:** id, game id, player (`entityInfo` with name, team, position, jersey, photo and `showPhotoUri`), market, line and alternate line, outcome type, `progressValue`, `consensusOutcome`. `showProp: false` props are never sent.

**No highlight** (revised 2026-09-29, Arthur's Walk #3: "Switching the preview on hover is the feature"). The frame draws nothing the live app doesn't. The console moves the frame to the screen that shows what the admin points at instead ([`admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md), "The preview follows what you point at"). `view.highlight` stays in the contract, optional and deprecated, so an older console's `view` still parses; the frame ignores it and no console sends it.

---

## Interaction rules

- **Nothing leaves the frame.** No request to any backend, no Clerk script, no analytics event. The only network requests are the images and fonts the document names (player photos from PES's bucket, logos, sponsor artwork, team logos, the self-hosted Satoshi files).
- **Links that would leave the app don't.** The prize claim button's link, a sponsor's website link and any other external link show their press state and stay. In-app navigation, including Terms, Privacy and opt-in documents over the gate, works as in the live app.
- **Toasts are the app's own.** "Your board is ready!" and the refusal toasts appear as they do live.
- **Inputs accept typing** and keep it in memory; nothing is submitted anywhere.
- **Focus stays in the console** until the admin clicks or tabs into the frame. The preview never calls `focus()` on mount or on `render`.

## Phone and desktop

*Superseded 2026-09-28: the preview is phone only (390×844); `document.device` is always `"phone"`.*

The frame is the viewport, as on a real device, and the app lays itself out for it: 390×844 for Phone, 1280×800 for Desktop, where the current app centres its column (`max-w-lg`) as it does in a desktop browser. `document.device` is a hint only; the app's own responsive rules decide the layout from the frame's width.

## Security

- **Origin allowlist.** `VITE_PREVIEW_PARENT_ORIGINS` is a comma-separated list of exact console origins: `https://admin.overboardsports.com` and every dev console origin in use (the local console, `http://localhost:5174`, any other local port in use, and the dev stacks' console origins). A message from any other origin is dropped with no reply.
- **Never post to `*`.** Until the first valid message, `ready` is posted once per allowlisted origin; afterwards only to the origin that spoke.
- **Framing header on `/preview` only**, through a `headers` entry in `vercel.json`: `Content-Security-Policy: frame-ancestors 'self' https://admin.overboardsports.com http://localhost:*` plus the dev stacks' console origins. Other paths keep today's headers.
- **No credentials, no storage.** The route holds no token, reads and writes no app storage, and uses a preview-only key for `next-themes`.
- **Text only.** Nothing from the document renders as HTML beyond what the live app already renders from the same fields. Image URLs must be `https:` (or `http://localhost` in dev builds).

## Honesty rules

- **Real or absent.** Everything on screen is the tenant's real configuration and the schedule's real games, players, photos, lines and progress. What the data doesn't have, the screen doesn't show, exactly as the live app behaves (no photo when `showPhotoUri` is false, no sponsor line with no placement, "Players for this game aren't available yet." with no props).
- **No fixtures.** There is no sample contest, sample player, sample fan, sample hit or sample standing anywhere in the preview code.
- **Nothing narrates.** No caption, watermark or banner inside the frame.

## Performance

- Preview-only code (entry, session, base query, message handling) stays under 30 KB gzipped; screen code is shared with the live chunks.
- First render within 300 ms of the first `render` once the chunk has loaded; re-render for a data change within 50 ms.
- The document is bounded by the contest: its games, their visible props and players, and the tenant's listed contests (at most 20 per tab, as the fan list pages).

---

## Rules

- **PREV-01.** `/preview` branches off in `main.tsx` before Clerk, the seed theme and the network, and loads as its own chunk.
- **PREV-02.** The preview renders the live app's own routes, pages and components. There is no preview-only copy of any screen.
- **PREV-03.** The preview makes no backend request and holds no token. Every fan read is answered from the render document; every write stays in memory.
- **PREV-04.** Every section of the render document is a fan wire shape, built by the server from the same functions as the live fan reads.
- **PREV-05.** Clicks navigate as in the live app, and every screen change is reported with `navigated`, so the console's tabs stay in sync.
- **PREV-06.** The preview board is built by the shared `buildBoard`, and its bingo count by the shared `newlyCompletedLines`, the server's own logic.
- **PREV-07.** The prize popup opens only on the Prize screen, which the console reaches by tab.
- **PREV-08.** Refusals come from the shared `refuseJoin`, with the live app's messages.
- **PREV-09.** Nothing is fabricated and nothing narrates: no fixtures, no chyron, no captions.
- **PREV-10.** Inbound messages are accepted only from `VITE_PREVIEW_PARENT_ORIGINS`; outbound messages are never posted to `*`.
- **PREV-11.** `frame-ancestors` is set on `/preview` only.
- **PREV-12.** The route reads and writes no app storage and follows no link out of the app.
- **PREV-13.** The celebration plays on arriving at `prize`, not on later renders there; reduced motion suppresses it.
- **PREV-14.** The preview never takes focus on its own.
- **PREV-15.** Wave 5's overhaul implements this contract on its own branch; `ready.app` and `ready.screens` tell the console which app answered.

## Acceptance criteria

- [ ] Opening `/preview` with no parent shows "Waiting for preview" and nothing else.
- [ ] The network panel for a preview session shows no `/b2b/*` request and no Clerk script.
- [ ] The live app's main bundle contains no preview code; the preview chunk graph contains no `@clerk/clerk-react`.
- [ ] A `render` for a Draft contest shows it on Contests (Upcoming) with its real matchup, logos, tip-off, description and top prize, as it will look once published.
- [ ] Clicking through Start → Continue with Email → Sign in → Join (filled) → the contest card → two players → Generate reaches the Board, and each step posts `navigated` with the right screen.
- [ ] The Contest screen shows each open game as a tab and the real players with their PES photos; a player with `showPhotoUri: false` shows none.
- [ ] Generate with the same drafted players twice (with a reload between) gives the same board; a different draft gives a different board.
- [ ] A test-mode contest on a played game shows the real hits, and the counter equals the lines `newlyCompletedLines` finds.
- [ ] A contest with a game that has no props yet answers Generate with the real "Players for this game aren't available yet." message.
- [ ] `navigate { screen: 'prize', view: { prizeTierIndex: 1 } }` shows the popup for the second tier with its real name, image, claim text and button; confetti plays once.
- [ ] The claim button and any sponsor link don't leave the frame; Terms over the gate opens and Back returns with the typed values intact.
- [ ] Nothing is written to `localStorage` or `sessionStorage` during a preview session.
- [ ] A `render` from an origin not in the allowlist is ignored with no reply.
- [ ] The `/preview` response carries the `frame-ancestors` header; `/` does not gain one.

## Known gaps (recorded, not blocking)

- **One sponsor per slot.** The current app renders one holder per slot (contest-wide, or the game's own when it has one), so the preview shows exactly that; `view.gameId` picks which game's holders a board shows.
- **The contest name on the card.** The current card titles a contest by its featured game's matchup; the name appears only for a game without two teams. The preview shows that as it is.
- **The popup over a board with no bingos.** On upcoming games the preview board has no hits, so the Prize screen shows a winning popup over a board whose counter reads 0. Both halves are true; they are just not from the same moment.
- **The sign-in form is inert.** It shows the real form; submitting it moves the preview on without checking anything, because there is no account behind a preview.
- **Returning-fan and paused states** aren't offered as screens.

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- A consent document opened over the gate in the frame is read from the public document endpoint, as the live app reads it: the render document carries no document bodies.
- Each tree makes its own store (`makeStore(baseQuery)`): the live app's base query talks to the network, the preview's answers from the render document. Sign-in goes through the app's own auth module, and a lint rule keeps screens from importing the auth library directly.

## References

- [`../core-modules/1-draft/admin-preview.spec.md`](../core-modules/1-draft/admin-preview.spec.md) — the console host and the preview read
- [`../core-modules/1-draft/end-to-end-flow.spec.md`](../core-modules/1-draft/end-to-end-flow.spec.md) — §1.5 awards, §3.3 featured game and board draw, §3.4 refusals, §4 the board and the legal overlay
- [`../core-modules/1-draft/admin-contests.spec.md`](../core-modules/1-draft/admin-contests.spec.md) — the contest, its states and the description on the card
- [`entry-gate.spec.md`](entry-gate.spec.md), [`styling.spec.md`](styling.spec.md)
- `overboard-b2b-template`: `src/main.tsx`, `src/App.tsx`, `src/store/index.ts`, `src/store/api/contestApi.ts`, `src/store/api/sponsorApi.ts`, `src/context/TenantContext.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/pages/**`, `vercel.json`
- `obs-b2b-shared`: `scoring/bingo-lines.ts`, `interfaces/reference/BetEvent.ts` (`featuredGame`, `deriveGameStatus`), the new `boards/buildBoard.ts` and `api/preview.ts`
- Superseded contract (workspace): `artifacts/wave-2026-09-24/s1-s2-preview-interface.md`
