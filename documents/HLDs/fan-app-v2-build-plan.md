# HLD: Fan App v2 Build Plan

**Status:** Draft for the build wave that follows the 2026-09-24 design wave. Written by the S2 design seat.
The five specs named below are the source of truth; where this plan and a spec disagree, the spec wins and
this plan is corrected.

**Depends on:** [`fan-app-v2.spec.md`](../../spec/webapp/fan-app-v2.spec.md),
[`fan-contest-flow.spec.md`](../../spec/webapp/fan-contest-flow.spec.md),
[`fan-preview-mode.spec.md`](../../spec/webapp/fan-preview-mode.spec.md),
[`fan-decor-system.spec.md`](../../spec/core-modules/1-draft/fan-decor-system.spec.md),
[`admin-brand-v2.spec.md`](../../spec/core-modules/1-draft/admin-brand-v2.spec.md), and the preview contract
`overboard-b2b-workspace\artifacts\wave-2026-09-24\s1-s2-preview-interface.md`.

**Repos** (all under `C:\Users\arthu\OneDrive\Documents\GitHub\overboard-b2b-workspace\`):
`overboard-b2b-template` (fan app, "template"), `obs-b2b-shared` ("shared"),
`overboard_sports_backend` ("backend"; the API is `node-server\src\`), `obs-b2b-admin-frontend` ("admin").

## 1. Purpose

The fan app today is a proof of concept: a fan drafts up to eight players from one game, the server fills a
board, the board polls every two minutes, and there is no home, contest detail, standings, results, profile,
in-app legal pages or preview mode. This plan turns the S2 design wave into five build slices that ship the
Prime Time fan experience, the decor kit that recolours from the tenant palette, the B2C-parity contest
flow, a live board with standings, the console preview, and the simpler Brand page.

## 2. What it builds

**Fan screens and shell** (`spec/webapp/fan-app-v2.spec.md`). One shell for every screen: top bar, menu
sheet, skeletons, one error pattern, offline banner, and the desktop frame (the phone column centred on the
decor field at >= 900px). Screens: Gate, Sign-in/up, Verify, Forgot password (link restored), Join gate
(restyled shared `EntryGateForm`), Home, Profile (absorbs `/dashboard`), Terms and Privacy (shown only when
the document exists), and Paused (including the mid-session 403). The five Brand strings are read from
`branding.text`.

**Decor kit** (`spec/core-modules/1-draft/fan-decor-system.spec.md`). Standard decorative graphics in
`obs-b2b-shared\src\ui\decor\`: DecorField, HeroBand (moved from the template and extended with `double`),
Chyron, GradientRule, Stripes, Scorebug, Track, Burst, Medal, GridTexture, Brackets and BingoLine (twelve
pieces). All are inline SVG or CSS, coloured only by theme CSS variables, mode-aware, and still under reduced
motion; the field pieces (DecorField, Burst, GridTexture) take an `intensity` prop. Contract v2 gains an optional `decor` block and the `bingoGrid` texture. Presets set their decor
values.

**Contest flow** (`spec/webapp/fan-contest-flow.spec.md`). Contests list with search, filters, total and
endless scroll; contest detail (description, games, prize ladder, how to play, CTA states, Trivia
placeholder); board builder with pick sheet (game chips, players), line ladder (Likely / 50-50 / Go crazy),
auto-fill, rearrange, the two-team rule and minimum two picks; edit after entry with per-square locks. The
server replaces `POST /b2b/board/generate` with `POST /b2b/board` (fan-chosen cells) and
`PUT /b2b/board/:id/cells`, and re-validates every rule.

**Live and standings** (`spec/webapp/fan-contest-flow.spec.md`, live board and standings sections). A
server-sent event stream per board with a 20s poll fallback, square states (pending, live, hit, miss,
locked, empty), the BingoLine overlay, the prize popup v2 driven by server award records with a seen
state (replacing localStorage), and standings and results ranked by bingos, then points, with boards tied on
both sharing a rank ("1224"); entry time only orders rows within a tied group, so at tip-off, before any hit,
every fan is "Tied 1st of N".

**Preview mode** (`spec/webapp/fan-preview-mode.spec.md`, contract
`artifacts\wave-2026-09-24\s1-s2-preview-interface.md`). A sessionless `/preview` route in the fan app,
mounted outside Clerk and never calling the API, rendering the real screens from the console's `render`
message plus honest fixtures, with a persistent PREVIEW chyron. The admin gets one `FanPreviewFrame` host
with the screen switcher; the old Brand and Fields previews retire.

**Brand v2** (`spec/core-modules/1-draft/admin-brand-v2.spec.md`). The admin Brand page rebuilt: presets
shelf on top, a four-swatch palette with Auto chips and an in-page colour picker, font pairing cards,
light/dark, logo and marker upload tiles, the five Words, and a collapsed Fine-tune. `PUT /admin/branding`
accepts `text`. No data migration: the page derives its state from the stored theme on load.

## 3. Cross-slice conventions (all slices follow these)

- **Screens are views plus containers.** Every screen exports a presentational view (`*View.tsx`) that takes
  plain props, and a route container that does the RTK Query work. `/preview` renders the views with
  fixtures. A screen whose view reaches into the store cannot be previewed; reviewers reject it.
- **Routes live per area.** f1 splits `src\App.tsx` into `src\routes.tsx` plus one route module per area
  (`src\pages\<area>\routes.tsx`), so each slice adds routes in its own files.
- **API slices per area.** f2 owns `src\store\api\contestApi.ts`; f3 adds `src\store\api\liveApi.ts` and
  `src\store\api\standingsApi.ts`; f1 adds `src\store\api\legalApi.ts` and `src\store\api\profileApi.ts`.
- **Copy.** Platform copy is fixed; only the 12 curated keys are editable. No spec IDs, vendor names or
  gap narration on any fan or admin surface (D-068). The Trivia card is the one allowed placeholder.
- **Shared points and lines.** The eight bingo lines and the B2C points formula live once, in shared
  `src\game\bingo\` (see section 6), and are used by the backend, the evaluator path and the fan app.
  The duplicate `countParlaysHit` in `src\pages\board\BoardPage.tsx` is deleted.

## 4. The five slices

Worktrees follow the wave rules: `overboard-b2b-workspace\.worktrees\<repo-short>-<slice>`, branch
`arthur-<slice>`, cut from freshly fetched `origin/main`, then `git submodule update --init --recursive`
(H19) and an install. Ports come from that wave's WAVE-RULES. One PR per repo per slice; never merged by
the slice.

### f1-decor-shell (size L, first)

Worktrees: `shared-f1-decor-shell`, `template-f1-decor-shell`, `backend-f1-decor-shell`.
Spec: fan-app-v2, fan-decor-system. f1 is the **shared repo owner** for the wave (section 5).

Scope:
- Shared: `src\ui\decor\` kit (12 pieces listed in section 2, BingoLine included) with `decor.css` and `index.ts`; HeroBand moves
  here from `overboard-b2b-template\src\components\layout\HeroBand.tsx` (the template re-exports it).
  Contract: `ThemeSettings.decor`, `THEME_TEXTURES` gains `"bingoGrid"` (`src\interfaces\b2b\B2BOrganization.ts`),
  decor values on Prime Time and Club Level (`src\theme\presets.ts`), light and dark counterparts for every
  decor alpha (`src\theme\resolve.ts` emits the decor CSS variables), `BrandText` type and schema. Serves the
  pre-assigned shared needs of the other slices (section 5).
- Template shell: top bar, menu sheet (`src\components\layout\SideMenu.tsx` rebuilt), error and offline
  patterns, desktop frame, route split, vitest set-up (section 9).
- Gate and auth: `src\pages\auth\StartScreen.tsx`, `SignIn.tsx` (restore the "Forgot password?" link),
  `SignUp.tsx`, `ForgotPassword.tsx`, six-box code entry; delete `SignInTest.tsx` and the `/test-sign-in`
  route. Join restyle through `src\pages\auth\JoinTenant.tsx` and the shared `EntryGateForm`.
- Paused: `src\components\SuspendedScreen.tsx` becomes the Paused screen; a 403 with `tenant_suspended`
  from any API call (handled in `src\store\index.ts` base query and `src\lib\errorHandler.ts`) navigates to it.
- Profile: new `src\pages\profile\` (display name and field edits via `PATCH /b2b/membership`, consents with
  withdraw for optional ones, Your boards list); `/dashboard` redirects to `/profile`; delete
  `src\pages\dashboard\DashboardPage.tsx`.
- Legal: `/terms` and `/privacy` routes rendering `GET /b2b/legal/:doc`; menu links shown only when the
  document loads; delete the placeholder `src\config\legal.ts`.
- `branding.text` consumption in `src\context\TenantContext.tsx` with the spec's defaults and `{team}` token.
- Backend: `GET /b2b/legal/:doc` (new `node-server\src\handlers\legal\getLegalDoc.ts`, route in
  `node-server\src\routes\legal\index.ts`; 404 when absent; public, no membership needed); `branding.text`
  added to `GET /b2b/org/:slug` (`handlers\org\getOrganization.ts`, schema in shared `src\api\b2b\org.ts`).

Deliverables: the kit merged on shared first (its own early PR), the shell and every f1 screen themed from
the kit, the two backend endpoints, the template test runner.

Verification: shared suite and `direction-acceptance.test.ts` extended for decor (both presets, both modes,
contrast of chyron text >= 4.5:1, decor alpha under body text <= 0.12); kit component tests; template unit
tests for the shell and text defaults; backend tests for the legal endpoint (present, absent, unknown doc)
and the org response; typecheck, lint, format, build in all three repos. Live: Gate, Sign-in, Join, Home
shell, Profile, Paused and the desktop frame on Bears and Fighting Hawks in light and dark, screenshots to
`artifacts\f1-decor-shell\`.

### f2-contest-flow (size L, after the kit lands; backend can start day one)

Worktrees: `backend-f2-contest-flow`, `template-f2-contest-flow`. Spec: fan-contest-flow.

Scope:
- Backend, in `node-server\src\handlers\contest\` and `handlers\board\`:
  - Contest detail enrichment on `GET /b2b/contest/:contestId` (`getB2BContestPlayers.ts`): description,
    derived status and closes-at, games, prize tiers with "Provided by" sponsor, player count and spots left.
  - List paging on `GET /b2b/contest/list-contests` (`listB2BContests.ts`): `cursor`, `limit`, `q`,
    `status[]`, response with `page: { nextCursor, total, limit }` using G1's convention (shared
    `src\api\admin\paging.ts`, served as 4a45307 this wave).
  - Props pool endpoint (path per the spec; proposed `GET /b2b/contest/:contestId/pool`): players and their
    ladder of lines by stat for games not yet started, visible and unlocked props only, with multiplier.
  - `POST /b2b/board` with nine cells (prop id or null) and `PUT /b2b/board/:boardId/cells`, both running
    one validator: props belong to the contest's games, visible, unlocked, game not started; one line per
    player per stat; at least two picks; two-team rule; a square can change only while its game has not
    started and the contest's last game has not started; one board per fan per contest (G2's unique index).
    `PUT` carries the `expectedUpdatedAt` precondition and answers a mismatch with 409 `stale_board`.
  - Machine refusal codes: every refusal carries a `code` beside today's `message` (`board_exists`,
    `contest_not_open`, `contest_full`, `contest_not_playable`, `edit_closed`, `cell_locked`, `game_started`,
    `prop_unavailable`, `duplicate_prop`, `line_conflict`, `too_few_lines`, `one_team`, `stale_board` and the
    rest of the spec's FLOW-13 table), with `cellErrors` for cell-level ones. The fan app maps by code only.
  - `POST /b2b/contest/:contestId/autofill`: B2C's `createFilledBoard` run server-side over the eligible pool,
    filling only the empty cells it is sent; it saves nothing.
  - Retire `generate`: `POST /b2b/board/generate` returns 410 for one release, then is removed with
    `createBoard.ts`'s auto-fill path.
- Template: `src\pages\home\` (new), `src\pages\contests\` (list and detail, replacing the draft page in
  `ContestPage.tsx`), `src\pages\build\` (new: builder, pick sheet, ladder, rearrange, auto-fill, enter
  confirm, edit after entry); banner card rebuilt in `src\components\contests\ContestCard.tsx` (theme
  tokens, no hard-coded status colours); Trivia detail card.

Deliverables: all f2 endpoints with zod contracts in shared, the four screens, auto-fill through the
server's autofill endpoint (random non-conflicting props, safest in the middle, as B2C).

Verification: backend jest for every validation rule (accept and refuse), paging (stale and invalid cursor),
410 on `generate`; template unit tests for the two-team rule, ladder labels from multiplier, one-line-per-
player-stat replace, autofill placement, lock rules; component tests for the builder states. Live on the
seeded `Test Tenant — This Week` contest (reseed first): list, detail, build a board, enter, edit a square,
refused edit on a started game. Screenshots to `artifacts\f2-contest-flow\`.

### f3-live-standings (size L, parallel with f2 after the kit lands; backend can start day one)

Worktrees: `backend-f3-live-standings`, `template-f3-live-standings`. Spec: fan-contest-flow (live,
prize, standings sections).

Scope:
- Backend:
  - `GET /b2b/board/:boardId/stream` (SSE; new `handlers\board\streamBoard.ts`, routes in a new
    `routes\live\index.ts`): events `prop.progress`, `prop.outcome`, `board.bingos`, `game.status`,
    `prize.awarded`, `contest.status`; deltas only; 25s heartbeat; `Last-Event-ID` resume.
  - Publisher behind one interface (`node-server\src\live\publisher.ts`). Option A: the evaluators publish to a
    channel the API subscribes to. Option B: the API scans changed props for boards with open streams every
    15s and fans out. Recommendation: ship B first (it works in personal stacks, where the evaluators
    throw) and keep A as a later swap behind the same interface.
  - Award records with a seen state, exposed as `awards[]` on the board response; storage per the spec (the
    likely home is a `seenAt` on the existing per-award `PrizeRedemption` row, `obs-b2b-shared\src\models\
    prize-redemption.ts`); `POST /b2b/board/:boardId/awards/:awardId/seen`; backfill migration script
    `node-server\scripts\backfill-award-seen.mjs` (section 7).
  - `GET /b2b/contest/:contestId/standings?cursor&limit` returning rows and `me` (routes in a new
    `routes\standings\index.ts`), ranked by bingos, then points; boards tied on both share a rank and the
    next rank skips; entry time orders rows only within a tied group and is never a rank criterion.
  - Points and lines utility in shared `src\game\bingo\` (requested through the queue), used here and by
    the fan app.
- Template: `src\pages\board\` (live board rebuilt from `BoardPage.tsx`), `src\components\board\`
  (`BingoCell.tsx` states, new `BingoLine.tsx`, `PrizeModal.tsx` becomes prize popup v2 with Burst and
  server seen state), `src\pages\standings\` (new: standings, podium, results card, pinned "You" row).

Deliverables: stream, fallback poll, awards, standings, the three screens.

Verification: backend jest for ranking (ties on bingos and points share a rank, the next rank skips, entry
time orders a tied group without changing its rank, everyone "Tied 1st" before any hit), stream framing and
heartbeat, award seen, backfill idempotency; template unit tests for square states and the live reducer
(event in, board state out), reconnect and fallback. Live: a dev publisher script
(`node-server\scripts\dev-publish-board-event.mjs`, dev DB only, `arthur_` prefix) drives progress, a hit,
a bingo and an award on a test board; screenshots of each square state, the BingoLine, the popup and
standings to `artifacts\f3-live-standings\`.

### f4-preview (size M, after f1; screens wire in as f2 and f3 land)

Worktrees: `template-f4-preview`, `admin-f4-preview`. Spec: fan-preview-mode and the interface file.

Scope:
- Template: `src\preview\` (new: `PreviewApp.tsx`, `protocol.ts`, `fixtures.ts`, `PreviewRibbon.tsx`); a
  branch in `src\main.tsx` that mounts `PreviewApp` for `/preview` before `ClerkProvider` and before the store
  and tenant context; theme via the existing `src\theme\apply.ts` and `src\theme\fonts.ts`; origin allowlist
  from `VITE_PREVIEW_PARENT_ORIGINS`; the route ships as its own chunk. `vercel.json` gains a `headers`
  entry setting `Content-Security-Policy: frame-ancestors ...` on `/preview` only.
- Admin: `src\components\preview\FanPreviewFrame.tsx` (iframe host, handshake, origin checks, debounce,
  loading and unavailable states), `src\components\preview\ScreenSwitcher.tsx`, `src\lib\previewProtocol.ts`,
  env `VITE_FAN_APP_ORIGIN` with `{slug}` substitution. Retire `src\components\GatePreviewPanel.tsx`
  (Fields page swaps to the frame) and the shared `EntryGatePreview` sampler (queue request).
  `BrandPreviewPanel.tsx` retires inside f5's Brand rewrite. S1's console slices (contest Preview tab,
  Sponsors page) consume the same host.

Deliverables: the route, fixtures that never look real, the host and switcher, the CSP header.

Verification: template unit tests for the protocol (unknown type ignored, unknown `v` answered with
`error`, full replace, clamped `bingosHit`, out-of-range tier falls back to the first); admin tests for the
host (origin check, `event.source` check, render on `ready`); a Playwright smoke that opens the admin
page, waits for `ready`, switches all eight screens and asserts the PREVIEW chyron and no network calls
from the frame. Screenshots per screen to `artifacts\f4-preview\`.

### f5-brand-v2 (size M, parallel throughout; admin and two backend changes)

Worktrees: `admin-f5-brand-v2`, `backend-f5-brand-v2`. Spec: admin-brand-v2.

Scope:
- Admin: `src\pages\Branding.tsx` rebuilt into sections under a new `src\pages\branding\` folder (Presets
  shelf with preset thumbnails, Palette with Auto chips, in-page picker with "From your logo" and contrast
  readout, Font pairing cards with a Custom card for legacy mixes, Light/Dark, Logo and marker upload tiles,
  Words with counters, Fine-tune). Delete `src\components\BrandPreviewPanel.tsx`; mount `FanPreviewFrame`
  once f4 lands (until then the preview column shows nothing rather than a likeness).
- Migration on load: derive pairing match, auto chips and the "Custom page colours from an earlier setup"
  note from the stored theme. Draft key bump: `DRAFT_SUFFIX` in `Branding.tsx` goes from `":branding"` to
  `":branding-v2"` so old drafts are ignored.
- Upload tiles: backed by the new upload route below. No upload path exists today (sponsor assets are
  pasted https URLs, `src\components\sponsors\SponsorDrawer.tsx`), so Brand v2 defines the platform's first.
- Backend: `PUT /admin/branding` accepts `text` (`node-server\src\handlers\admin\branding.ts`, schema in
  shared `src\api\admin\branding.ts`) with the spec's max lengths and `{team}`-only token check.
- Backend: `POST /admin/assets/uploads` (new, per the Brand v2 spec): a presigned POST to a private tenant
  assets bucket, PNG, SVG or WebP up to 1 MB enforced by the POST policy, `purpose` of `brandLogo` or
  `brandMarker`, the SVG check, and the CDN origin (infra names it). Open question: does this route ship with
  Brand v2, or do the tiles keep the two URL fields until it lands? The spec recommends shipping it with
  Brand v2, in this slice.

Verification: admin vitest for the picker (keyboard, hex parse, contrast readout), pairing derivation,
auto-chip derivation, Words limits, draft key; backend jest for the `text` validation; live: publish a
change on the `test` tenant, confirm it renders in the fan app, then restore the tenant's original
settings. Screenshots to `artifacts\f5-brand-v2\`.

### Final integration slice (size S to M, last)

Worktrees for all four repos on `arthur-f-integration`. Re-pin every consumer to shared `main`, merge the
five slice branches in order f1, f2, f3, f4, f5, run every suite, then one end-to-end walkthrough on both
tenants in both modes: gate to join to home to build to enter to live (dev publisher) to prize to
standings, and Brand v2 editing the preview live. Screenshots to `artifacts\f-integration\`.

## 5. Order, parallelism and fences

**Order.**
1. f1 starts first and lands the shared kit, contract changes and the pre-assigned shared needs at its
   first milestone, before its own screen work.
2. f2 and f3 start their backend data layers on day one (they need only the pre-assigned contracts), and
   start UI once the kit is served.
3. f4 starts after f1's shell and route split merge on its branch; it wires Home, Contest, Board, Prize and
   Results views as f2 and f3 land them, using fixtures until then.
4. f5 runs in parallel throughout (admin only); its preview column waits on f4's `FanPreviewFrame`.
5. The integration slice closes the wave.

**Shared repo.** f1 owns `obs-b2b-shared` on `arthur-f1-decor-shell`. Everyone else requests changes through
the build wave's `shared-queue\` folder with the protocol from `artifacts\wave-2026-09-23\WAVE-RULES.md`
("The shared repo"): one ready-to-apply, additive, back-compatible request per file named
`<slice>-<nn>-<slug>.md` (optional `.patch`), f1 serves each as its own commit and logs it in `served.md`,
consumers pin served SHAs in their own worktrees as a separate "Pin shared to ..." commit. Pre-assigned to
f1 (served first, logged as `preassigned-<n>`): (1) decor contract, texture enum and preset decor;
(2) `BrandText` and `branding.text` on the public and admin branding schemas; (3) legal doc type;
(4) `GAME_TYPES` widening to `trivia` (only once S1's contest spec confirms the name); (5) fan contest list
paging types, contest detail and props pool response types; (6) board create and cells request schemas;
(7) `src\game\bingo\` lines and points utility; (8) SSE event union, award and standings types;
(9) `PreviewRenderMessage` and message types from the interface file.

**Backend fan routes.** f2 owns `routes\contests\index.ts`, `routes\boards\index.ts`, the contest detail,
list, pool, board create and cells handlers. f3 owns the new `routes\live\` (stream, award seen) and
`routes\standings\` files and `node-server\src\live\`. f1 owns `routes\legal\` and `handlers\org\`. f5 owns
`handlers\admin\branding.ts`. Each slice adds one registration line to `routes\index.ts`; conflicts there are
resolved at integration.

**Template.** f1 owns `src\components\layout`, `src\components\sponsor`, `src\theme`, `src\pages\auth`,
`src\pages\profile`, `src\context`, `src\main.tsx` (except f4's `/preview` branch), `src\App.tsx` and the
route split. f2 owns `src\pages\home`, `src\pages\contests`, `src\pages\build`, `src\components\contests`.
f3 owns `src\pages\board`, `src\pages\standings`, `src\components\board`. f4 owns `src\preview`. f5 touches
no template code. `src\components\ui` additions are fine for anyone; existing primitives are restyled only
where the specs require it (button height and radius, chips).

**Admin.** f4 owns `src\components\preview\` and the Fields page's preview swap; f5 owns `src\pages\Branding.tsx`
and `src\pages\branding\`. S1's console slices own everything else they redesign.

## 6. Shared-model changes

| Type | Change | Additive? | Consumer |
|---|---|---|---|
| `ThemeSettings.decor` | Optional `{ field?, band?, intensity? }`; `motif.heroMotif` kept, `decor.band` wins when present | Yes | template (f1), admin (f5), preview (f4) |
| `THEME_TEXTURES` / `surface.texture` | Adds `"bingoGrid"` | Yes (widening) | template, admin Fine-tune |
| `BrandText`, `branding.text` | Flat record of the five Brand keys, each optional, with max lengths | Yes | backend org and admin branding, template, admin Words |
| `GateCopyOverrides` | Unchanged; the gate strings are its real 7 keys (incl. `footerNote`; there is no `returningCta`) | n/a | template Join, preview |
| `GAME_TYPES` | Widens to `["bingo", "trivia"]`; coordinate with S1's contest spec; board create still refuses non-bingo | Yes (widening; check exhaustive switches) | backend, template detail, admin |
| `B2BBoard` / board response | Adds `awards[]`, `bingos`, `points`, `lineHits`, per-cell lock info (`lockedReason`) | Yes | template board, standings |
| `BetEvent.eventDetails?` | Score, period, clock; only if a feed exists | Yes | Scorebug |
| Contest list paging | Query `cursor`, `limit`, `q`, `status[]`; response `page` per G1's `pageInfoSchema` | Yes | backend, template list |
| Contest detail | Description, derived status and closes-at, tiers with sponsor, counts | Yes | template detail, Home |
| Props pool response | Players with ladders of lines by stat, multiplier, game, lock state | New | template pick sheet |
| Board create / cells | `POST /b2b/board`, `PUT /b2b/board/:id/cells` bodies (nine prop ids or null) and refusal reasons | New | backend, template builder |
| Standings | Row (rank, name, bingos, points, mini grid, isMe), `me`, `page` | New | template standings |
| Legal doc | `{ doc: "terms" \| "privacy", markdown, version, updatedAt }` | New | backend, template |
| SSE event union | The six event types with payloads | New | backend stream, template reducer |
| Lines and points util | `BINGO_LINES`, `countBingos`, `squarePoints`, `linePoints`, `rankRows` in `src\game\bingo\` | New | backend, template |
| `PreviewRenderMessage` and message types | From the interface file, section 3 and 4 | New | template preview, admin host |

## 7. Migration and back-compat

- **Theme documents** are unchanged. `decor` is absent until a tenant publishes from Brand v2; the fan app
  and resolver default it as the decor spec says: field `gridFragments`; band from the `motif.heroMotif`
  mapping, else `single`; intensity 0.6.
- **Boards from the old flow** stay valid: nine prop refs, same evaluator, same `parlaysHit`. They open in
  the new live board; edit after entry applies to them under the same lock rules.
- **Award backfill:** for every board with bingos already reached, create or mark the award record with
  `seenAt = now`, so no old prize pops again. Idempotent, dev DB first, run by hand per environment.
- **`prize-tier-shown-*` localStorage keys** are ignored and never written again.
- **`/dashboard`** redirects to `/profile` (kept for one release, then removed).
- **`POST /b2b/board/generate`** returns 410 with a plain message for one release, then is removed.
- **Brand draft key** bump (`:branding` to `:branding-v2`): old drafts are abandoned, not migrated.
- **`/test-sign-in`** is removed from the public router.

## 8. Data and infra to confirm before build

| Need | Why | Fallback |
|---|---|---|
| A pub/sub channel the API can subscribe to | Option A publisher | Option B scan (15s), which is the recommended first ship |
| A score, period and clock feed for B2B games | `BetEvent.eventDetails` and the Scorebug detail line | Scorebug shows tip time, LIVE or FINAL only; never an invented score |
| The tenant assets bucket and CDN origin behind `POST /admin/assets/uploads` | Brand v2 upload tiles; no upload path exists today (sponsor assets are pasted URLs) | The tiles keep the two URL fields until the route lands (open question in f5) |
| A 7-bingo tier can never be won | A 3x3 board completes 0 to 6 lines, or 8, never 7; the model accepts 1 to 8 | The contest builder (S1's) should refuse a tier at 7; until it does, such a tier is simply never reached, and the preview renders 7 as 6 |
| Nick's legal text | Terms and Privacy pages | Blocks nothing: links stay hidden until the document exists |
| CORS origins for the build wave's fan and admin ports | `FRONTEND_ORIGIN` and `FAN_AUTHORIZED_PARTIES` in `node-server\.env` | None; add the ports before live checks |
| Vercel and ALB behaviour for long-lived responses | SSE through the `vercel.json` `/b2b` rewrite and the ALB idle timeout | 25s heartbeat; the client's 20s poll fallback |
| Player counts on the wire | "N playing", "spots left" | Omitted when absent |

## 9. Test and verification plan

- **Fan app test runner.** The template has none today (`package.json` scripts: dev, build, lint, preview).
  f1 adds vitest, @testing-library/react and jsdom with an `npm test` script and a CI-ready config.
- **Unit tests (template):** square states, the live event reducer, ranking display, ladder labels from
  multiplier, the two-team rule, one line per player per stat, autofill placement, lock rules, the preview
  protocol, curated text defaults and `{team}`.
- **Component tests:** every decor piece (renders, recolours from CSS variables, no motion under reduced
  motion, intensity scales alpha), chyron contrast, square button labels.
- **Shared:** `src\theme\__tests__\direction-acceptance.test.ts` extended for decor; tests for the lines and
  points util (B2C parity cases) and every new schema.
- **Backend (jest at the repo root):** validation rules, paging, ranking, stream framing, awards, legal, org
  text, branding text, the 410.
- **Playwright smoke** for the preview route (f4).
- **Live checks per slice** on the build wave's ports, `AWS_PROFILE=obs-b2b-dev`, test accounts only,
  tenant settings restored afterwards, screenshots to `artifacts\<slice>\`.
- **Every slice:** suite counts before and after, typecheck, lint, format and build in each repo it touched.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Clerk inside an iframe | The preview is sessionless and mounts outside `ClerkProvider`; it never needs a session |
| Evaluator lambdas throw in personal stacks | Option B publisher runs in the API; the dev publisher script drives the stream in live checks |
| SSE cut by Vercel rewrite or ALB idle timeouts | 25s heartbeat, `Last-Event-ID` resume, 20s poll fallback, quiet "Reconnecting" chip after 60s |
| Font loading jank | Preload per pairing, `font-display: swap`, size-adjusted fallbacks; preview re-posts height after fonts load |
| Decor cost on low-end phones | Inline SVG under 4 KB per piece, no filters beyond one blur, no raster decoration, no ambient motion |
| List paging depends on G1's convention | Served as shared 4a45307; if the fan list needs a neutral import path, f1 re-exports it from `src\api\paging.ts` |
| Screens not previewable | View and container split enforced in review (section 3) |
| Contract drift with S1 | Unresolved points in the interface file settled before f4 starts; `GAME_TYPES` waits on S1's confirmation |

## 11. Decisions to ledger (proposed wording, for Arthur)

1. **Palette.** "The tenant palette is the four existing contract colour keys: Team (`primary`, required),
   Second, Accent and Live (optional, Auto by default). No colour migration."
2. **Standings.** "Standings rank by bingos, then by points using the B2C formula. Boards tied on both share
   a rank and the next rank skips ('1224'); entry time only orders a tied group on screen. The display name is
   the fan's public name on standings. Points are shown as a secondary number." (Open: show or hide points.)
3. **Preview.** "The unified preview is the real fan app on a sessionless `/preview` route, fed by
   postMessage from the console. It supersedes `admin-surface.spec.md` Rule 12 and the rejected-iframe entry
   in `admin-fields-and-optins.spec.md`."
4. **Legal links.** "The fan app's Terms and Privacy pages render a platform document from the API. The menu
   links to them only when the document exists. No placeholder text."
5. **Prime Time accent** (decided; Arthur may veto). "Prime Time's default Accent is gold `#F5B32E`; tenants
   can override it."
