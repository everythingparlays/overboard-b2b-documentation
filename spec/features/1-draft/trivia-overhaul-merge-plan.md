# Merge plan: trivia into Arthur's overhaul (2026-09-30)

Sources: local tags `trivia-2026-09-30` and `arthur-overhaul-2026-09-30` in every repo (see `switch-set.sh`).
Direction: **trivia merges into the overhaul**, one integration branch per repo (`integrate/trivia-overhaul`), shared first.

## Decisions (Nick, 2026-09-30: D2–D6 accepted at default; D1 resolved as hybrid, see below)

| # | Decision | Default if undecided | Where it bites |
|---|---|---|---|
| D1 | Colour system: keep trivia's light/dark **mode** resolver, or adopt Arthur's four-colour OKLCH resolver | Adopt Arthur's (shared is the root; Arthur's Wave 5 contracts assume it) | shared `src/theme/*`, fan `TenantContext.tsx:144`, `StartScreen.tsx:34`, `bootCache.ts:31` all read `theme.mode`, which no longer exists |
| D2 | Trivia Finalize auth: accept Arthur's "no step-up re-auth anywhere" for Finalize too | Accept (bingo finalize already lost it; the auth mode no longer compiles) | backend `trivia-finalize-route.ts:35` uses `requireAdminReverified`, removed from `RouteAuth` |
| D3 | Prize band value floor: trivia's `triviaBandLockViolations` reads `approximateValueCents`/`tierValue`, which Arthur removed on 2026-09-28 ("prizes have no stated value") | Drop the value floor for trivia bands too, delete `tierValue` from trivia's lock kinds | shared `ContestLock.ts` |
| D4 | Trivia sponsor: keep the free-text name placeholder or adopt Arthur's sponsor entities | Keep placeholder for V1, store as `sponsorName` on trivia config; migrate later | admin `triviaFields.tsx`, shared trivia config |
| D5 | Prize redemption shape: trivia's `source`/`prizeSnapshot`/`gameType` generalisation as the base with Arthur's `attempts[]`/`providedBy`/`seenAt` folded in (shared reviewer) vs Arthur's `tierSnapshot` naming as the base (backend reviewer) | Trivia's structure, **Arthur's field names** where they overlap (`tierSnapshot` stays; add `gameType`, `source`, `sourceKey`, nullable `boardId`/`tierIndex`) | shared `prize-redemption.ts`, prize-worker trio |
| D6 | Fan app UI: drop Arthur's sign-in screen, contest cards, and `src/kit/**` decor kit | Drop kit and gallery entirely; rebuild StartScreen from trivia + Arthur's multi-sponsor plumbing | fan `StartScreen.tsx`, `ContestCard.tsx` family |

### D1 resolution: Arthur's engine plus brand override slots (post-merge follow-up)
Nick likes the Brand page and the accessibility guarantees but cannot use generated colours: tenants and sponsors supply brand-guideline colours. Plan:
- **During the merge:** adopt Arthur's four-colour OKLCH resolver unchanged. Replace the fan app's three `theme.mode` readers (`TenantContext.tsx:144`, `StartScreen.tsx:34`, `bootCache.ts:31`) with the resolver's derived ground-is-dark signal.
- **After the merge (separate ticket, ~1 day):** add optional override slots to `ThemeSettings` for every derived token (card surface, raised surface, border, muted text, hit/progress, live/alert, button text). Resolver derives only what is empty. Brand page gets a collapsed "Advanced" section with one picker per slot defaulting to "derived". When a pinned colour fails Arthur's existing contrast thresholds, show a warning with the measured ratio and nearest passing shade, but save. No light/dark mode returns.
- **Sponsors:** sponsor entities carry their own accent colour, applied to that sponsor's tile/placement only, never to the tenant theme.

### D6 clarification
Start screen keeps the trivia-branch layout verbatim (matchup card, hero band, logo choice). Only the sponsor data path changes: `useStartPageSponsors` + array-based `PresentedBy` replace `useSponsorSlots`, rendered inside the existing layout. Arthur's matchup removal, hero-band changes, wordmark contrast logic and `TenantLogo` are dropped.

## Phase 0: shared package (root; everything else pins it)

Conflicts: 7 files. Order:

1. `src/api/admin/audit.ts`, `src/interfaces/b2b/B2BAdminAudit.ts`: union of both key sets, keep Arthur's rewritten comments, append `trivia_finalize`. Trivial.
2. `src/interfaces/b2b/contestTypes.ts`: Arthur pre-stubbed `trivia: { playable: false, thresholdUnit: null }`. Flip `playable: true`, set `thresholdUnit` to a band/rank unit. Keep `GAME_TYPES` in `B2BContest.ts` as a legacy mirror of the registry keys, or delete it and point trivia at `CONTEST_TYPES`. Pick one source of truth.
3. `src/interfaces/b2b/B2BContest.ts`: start from Arthur's file (`contestType`, `state`, `bannerImageUrl`, `description`/`internalNote`). Re-apply trivia's optionality on `allowedBetEvents`, `maxParticipants`, `numberParticipants`, `maxEntriesPerPerson`, `twoTeamsNotRequired`, `prizeTiers`; add `trivia?: TriviaConfig`; rebase trivia's `now`-injectable status branch onto Arthur's status function, and make it respect `contestState()` (Draft hides).
4. `src/api/admin/games.ts`: Arthur deleted `maxParticipantsSchema`, `contestNameSchema`, `contestNoteSchema`. Inline a validator for trivia's patch schema, then re-apply the `trivia` field, `superRefine`, and `PATCHABLE_CONTEST_FIELDS` entry.
5. `src/interfaces/b2b/ContestLock.ts`: apply D3. Keep `trivia_rules` lock kind and `triviaRulesLockViolations`.
6. `src/models/b2b.ts`: re-apply trivia's `trivia:` schema field and the conditional `maxParticipants` requirement onto Arthur's larger schema. Mechanical.
7. `src/models/prize-redemption.ts` and `src/interfaces/b2b/PrizeRedemption.ts`: apply D5. Treat as a redesign commit, not a text merge. Keep both unique indexes (legacy + partial `contest_user_game_source`).
8. Trivia-only adds merge clean: `src/api/admin/trivia.ts`, `src/api/b2b/trivia.ts`, `src/interfaces/b2b/B2BTrivia.ts`, `src/models/trivia.ts`, four test files.
9. Theme (D1): if adopting Arthur's resolver, no shared work. If keeping trivia's, revert `src/theme/*` to trivia and re-apply only Arthur's non-theme shared commits; expect Wave 5 decor contracts to break.
10. Run `npx vitest run`. Tag the result `shared-integrated-<date>`; that SHA becomes the pin for all three apps.

## Phase 1: backend

Conflicts: 3 submodule pointers + ~12 files. Trivia's single commit is 48 files, +4,827; its prize-fulfilment half is self-described as untested.

1. Re-pin all three submodule paths to the Phase 0 SHA. Build must pass before touching handlers.
2. `routes/index.ts`: keep Arthur's `devToolsEnabled()` wrapper, add `triviaRouteEntries` to the base array. `routes/admin/index.ts`: splice trivia's two imports and two spreads into Arthur's list.
3. `trivia-finalize-route.ts:35`: apply D2 (`requireAdmin`). Keep the OBS-staff check in the handler.
4. `util/admin-games.ts` + `handlers/admin/contests.ts` together: port `toWireTrivia()` onto Arthur's options-object `toWireContest`; port trivia's create/patch branches (`refuseInvalidTriviaConfig`, lock checks, `betEventId` seeding) onto Arthur's state machine with his renamed fields.
5. `handlers/contest/getB2BContestPlayers.ts`: re-add trivia's early return using `contestTypeOf(contest) === "trivia"`, and honour `asPublished` and Draft-hiding.
6. `handlers/admin/delivery-queue.ts`: take Arthur's deletion. Port trivia's `deliveryQueueRowShape()` bingo/trivia branching into `prize-deliveries.ts`. Delete `admin-delivery-queue.test.ts`; keep trivia's `admin-delivery-queue-shape.test.ts` re-targeted.
7. Prize-worker trio as one unit: `delivery-store.ts`, `fulfillment-handlers.ts`, `process-message.ts` plus `memory-store.ts` and `delivery-store.test.ts`. Apply D5 field names. Keep Arthur's `sendInFlight`/`dispatchedAt` guard.
8. `prize-content.ts`, `render-prize-email.ts`: Arthur wins; re-apply trivia's `achievementLine` lines.
9. Sweep all trivia files for `gameType === "trivia"` and replace with `contestTypeOf(contest) === "trivia"`.
10. `admin-contests.test.ts`: port trivia cases onto `contestType` naming. Then run `admin-trivia-finalize.test.ts` and `trivia-fan.test.ts` as real verification, not regression.

Semantic check done: Arthur's scoring sweep is board-only and cannot reach trivia contests; both send paths dedupe on the redemption id. No double-send risk.

## Phase 2: admin console

Take Arthur wholesale; trivia's creation UI is a **port**, not a merge. Arthur deleted `CreateContestDrawer.tsx`, `ContestDrawer.tsx`, `lib/gameTypes.ts`, `pages/DeliveryQueue.tsx`, and rewrote `App.tsx` routing.

1. Re-pin submodule. Take Arthur's side for every deleted file and `App.tsx`.
2. Carry over as-is (fix imports to `lib/contestTypes.ts`): `TriviaContestCard.tsx`, `triviaFields.tsx`, `triviaBands.tsx`, `lib/triviaConfig.ts`, `pages/QuestionBank.tsx` + css, `icons.tsx` additions, `nav.ts`.
3. Port creation: `GameTypeField`, `TriviaScheduleFields`, `TriviaSettingsFields`, `TriviaSponsorField` (D4), `ContestBandsField` into `pages/contests/ContestBuilder.tsx`; editing into `ContestPage.tsx` `OverviewTab`/`GamesTab`. Replace trivia's plain game list with Arthur's `GamePicker.tsx`. Write `contestType: "trivia"` on POST, not only `gameType`.
4. Merge trivia's `thresholdUnit`/`formatThreshold` copy into `lib/contestTypes.ts` and replace the "Trivia isn't built yet" blurb.
5. Find where the contest list now renders (`AllContests.tsx` or `pages/contests/*`, not necessarily `Games.tsx`) and re-target the `TriviaContestCard` branch there.
6. Add `QuestionBank` and trivia contest sub-routes to the lazy `PAGES` map.
7. Decide whether trivia prize bands can be represented by Arthur's `B2BPrizeTier` + prize library, or stay a parallel structure. Bands parallel for V1 is acceptable; note the debt.
8. Port `triviaConfig.test.ts` and `Trivia.test.tsx`; run the full suite (1,034 tests on Arthur's side).

## Phase 3: fan app

Seam: **Arthur's infra layer, trivia's presentation layer.** Two files cut through the middle.

1. Re-pin submodule. Take Arthur wholesale: `src/auth/**`, `AppRoutes.tsx`/`main.tsx` split, `/preview` route tree and iframe protocol, `lib/storage.ts`, `lib/contestView.ts`, `lib/tierProgress.ts`, `store/index.ts` (`makeStore`, then re-add trivia's `tagTypes`), opt-in/consent contract, `TenantProvider` org-answer change, `PresentedBy` multi-sponsor signature.
2. Drop entirely (D6): `src/kit/**`, the `/kit` gallery route, contest banner art, sponsor monogram/plate art, progress marker glyph art.
3. `App.tsx`: take Arthur's shell, add trivia's four `/trivia/*` routes into `AppRoutes.tsx`.
4. `StartScreen.tsx`: trivia never touched it, so "trivia wins" would revert Arthur's sponsor plumbing. Start from trivia/main's version (matchup card, hero band), re-port `useStartPageSponsors` and the `PresentedBy` array, and fix `theme.mode` per D1.
5. `ContestCard.tsx` family: keep trivia's `ContestCardShell`/`BingoContestCard`/`TriviaContestCard`. Port Arthur's description/prize-name display (commit `28d7cbb`) into `BingoContestCard`; skip `ContestBanner` visuals.
6. `BoardPage.tsx`: three-way diff against `main-2026-09-30`. Keep Arthur's `storage`, `settlePrizeQueue`, `tierTrack`, progress-marker resolution from shared; keep trivia's changes; `HeroBand` removal is a UI call, decide with D6.
7. `ContestsPage.tsx`: trivia's 99 lines on top of Arthur's `@/auth` import. `status-badge.tsx`: trivia wins. `ErrorTestPanel.tsx`: combine both (dev-only).
8. Grep for `theme.mode`, `ThemeMode`, `ThemeNeutrals`, `borderAlpha` and fix per D1. Run Vitest; run the preview iframe against the merged console.

## Phase 4: docs

One conflict, `spec/features/1-draft/trivia-game-type.spec.md`: trivia wins; re-apply Arthur's four "no re-authentication" wording lines if D2 is accepted. Promote the merged trivia design doc.

## Verification gate before touching main

- Shared, backend (node-server has no test script; run vitest directly), admin, fan suites green.
- Full local stack on the integration set: create a trivia contest in the console, join as a fan, answer, reveal, finalize as OBS staff, confirm the email in the prize-worker outbox.
- Bingo regression: run Arthur's E2E harness (`node-server/scripts/e2e/run-e2e.mjs`) on the integration set.
- Then open PRs against main with Nick as required reviewer.

## Effort estimate

| Phase | Mechanical | Hand merge / port | Net new |
|---|---|---|---|
| Shared | audit, models/b2b | B2BContest, games.ts, ContestLock | prize-redemption redesign |
| Backend | routes | contests + admin-games, players, prize-worker trio | prize-deliveries port, contestState for trivia |
| Admin | carry-overs, routes | contest list re-target | ContestBuilder/ContestPage port, bands vs tiers |
| Fan | infra takes, ContestsPage | StartScreen, BoardPage, cards | theme.mode fixes |

Backend and admin are the long poles. Fan is the most judgment-heavy per file but smallest in count.

## Status (2026-09-30, evening)

Branch `integrate/trivia-overhaul` in all five repos.

| Repo | State | Commit |
|---|---|---|
| obs-b2b-shared | merged + 3 follow-ups, 1,101 tests green, tag `shared-integrated-2026-09-30` | 629cfd4 |
| overboard_sports_backend | merged, trivia tests ported (26), fan projection carries trivia; 2,320+ jest green except pre-existing `test/asset-uploads.test.ts` | ba99367 |
| overboard-b2b-template | merged, 272 tests green; smoke-tested against the merged backend (trivia list, standings, bingo cards) | 87f0ba7 |
| overboardb2b-documentation | merged | c635d82 |
| obs-b2b-admin-frontend | merged; trivia in ContestBuilder (Trivia + Prize bands steps), ContestPage (settings card, bands tab, games tab), /question-bank route; 1,295 tests green, 3 pre-existing failures (hues, SupportReport) | fd350f0 |

Decisions applied: D1 Arthur's resolver (override slots are a post-merge ticket), D2 Finalize on `requireAdmin` with the OBS-staff check in the handler, D3 no band value floor, D4 sponsor placeholder, D5 trivia's row structure with Arthur's names (`tierSnapshot` for every game type), D6 fan layout kept (hero band, matchup), `src/kit` dropped.

Follow-ups found during the merge:
- PATCH `trivia` validates the merged config whole; the console sends the complete config per save.
- Trivia prize rows carry no `providedBy` credit (the sponsor is a placeholder name); the email's achievement line covers the win.
- The trivia players endpoint skips banners.
- `joinRefusal` still answers `not_playable_here` for trivia on the bingo join path (trivia has its own start-run path).
- Console: the builder creates a trivia draft from Basics and PATCHes the full config from the Trivia and Prize-bands steps; Nick to click through signed in.
- Bingo E2E harness not yet run on the integration set (needs `DEV_TOOLS=on` and the `test` tenant fixtures).

## Status (2026-09-30, night)

Later decisions, all on `integrate/trivia-overhaul`:
- **One contest-type vocabulary.** `contestType` from the registry is the only field; `gameType` is gone from contracts, models, wires and code (prize rows keep their own `gameType`, a different concept). Lock kind for a type change is `contestType`.
- **Presented by logo.** The sponsor's small mark is `assets.presentedByLogo` (+ `presentedByTagline`), used on the Start page, every trivia screen and prize credits. Trivia's one placement slot is `presentedBy`; bingo keeps the board banner (`PLACEMENT_SLOTS_BY_CONTEST_TYPE`; the slider slot was removed on 2026-09-30, below). The free-text trivia sponsor is gone; the placement's sponsor is the contest's sponsor and the credit on its prizes.
- **No normalizers.** Legacy names (`signInLogo`, `startPageLogo`, `gameType`, the `signIn` slot, `trivia.sponsor`) are not read anywhere. `node-server/scripts/one-name-migration.mjs` rewrites stored rows (dry-run default, `--apply`). **Release step: run it once per environment before deploying this branch.** Arthur's `migrate-start-page-sponsors.mjs` should run first where sign-in placements exist, since it moves them onto the Start page list rather than dropping them.
- **Contest-wide sponsor placements, no slider (Arthur, 2026-09-30, dev only).** A placement is (contest, sponsor, slots) for every contest type, with no `betEventId`; the bingo `slider` slot and the sponsor's `assets.sliderIcon` are gone, and the board's marker is the contest's Progress marker, then the Brand marker, then the triangle ([`admin-sponsors.spec.md`](../../core-modules/1-draft/admin-sponsors.spec.md)). `node-server/scripts/sponsor-contest-wide-migration.mjs` (dry run by default, `--apply` writes) collapses per-game placements to contest-wide ones, reports conflicts for a person to settle, deletes slider placements and removes `assets.sliderIcon`.
- Console: Games & Contests opens as the list; cards are the remembered opt-in.

Heads: shared 028b3ae · backend eb77d1c · console d41b34a · fan 099f022 · docs (this commit).
