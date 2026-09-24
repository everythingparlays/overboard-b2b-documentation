# Core Module Spec: Admin — Contests

**Implements:** PRD `ADM-03`, `ADM-04`, `ADM-06` (where Finalize appears, not what it does), `GAME-01`, `GAME-04`, `BRAND-02`/`BRAND-04` (the "which games" half), and the data-model constraint `GAME-F1`. Narrows `TEN-05` further: a contest is recurring configuration, never onboarding-time setup. `GAME-02`'s tiers are per contest, not per game (ruling 2026-09-24; see the PRD's revision notes).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, the write grant (tenant `org:admin` and OBS staff), the reverification list, and the principles, above all Honesty by omission (Rule 13). [`contest-safety.spec.md`](contest-safety.spec.md) (lands with G2's PR this wave) — the lock stamp `lockedAt`, the pure lock functions in `obs-b2b-shared`, the prize snapshot and the one-board-per-fan index; this spec adds the console's side of the lock and two lock kinds. [`admin-lists.spec.md`](admin-lists.spec.md) (lands with G1's PR this wave) — the cursor-paging convention, `InfiniteList`/`InfiniteTable`/`PickerList`, and the schedule picker's `GET /admin/games/candidates`. [`admin-prizes.spec.md`](admin-prizes.spec.md) — the Prizes tab, the tier editor and tier completeness. [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — the Sponsors tab's placements grid. [`admin-preview.spec.md`](admin-preview.spec.md) and `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` (workspace) — the Preview tab and the builder's Review frame.

**Supersedes:** the games half of [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md): the `/games` screen (per-contest cards with games tables, the per-game drawer), `GET /admin/games` as that screen's read, the games PUT as its write, and "What the data model actually is" as a description of the console. Also this spec's own 2026-09-23 version: the create drawer, the contest detail drawer, the "Note" field, "created hidden", and "no contest delete". The prizes half of admin-games-and-prizes goes to [`admin-prizes.spec.md`](admin-prizes.spec.md).

**Status:** Draft. Written 2026-09-23 for the Games & Contests overhaul; rewritten 2026-09-24 for the console redesign. One open question for Arthur (entries after the lock, under "The lock").

**Revised 2026-09-24** (ruling, Arthur) — a contest is the thing a tenant creates and fans join, and it gets a home of its own: Games & Contests becomes a searchable list of contest banner cards; each contest opens as a full page with Overview, Games, Board, Prizes, Sponsors and Preview tabs; creating one is a full-screen, six-step builder that saves a draft until publish. "Note" becomes a fan-facing **Description** (with a separate internal note), the contest gets a **contest type** (Bingo, plus a Trivia placeholder), bingo customisation is exactly the B2C admin's prop pool curation, and a contest **locks when its first fan joins**. Staff All contests rows open the same page and carry Finalize.

## Overview

Until this rewrite a contest lived on a card inside a long `/games` page, was created in a five-field drawer, and was edited in a second drawer that could show its prize tiers and sponsors but not change them. The card listed every game the contest ran at inline, so a season-long contest made a page tens of thousands of pixels tall; prize tiers were edited on another screen, sponsor placements on a third, and the fan-facing result could not be seen anywhere. The one free-text field was labelled console-only while the fan wire sent it to every fan. Nothing stopped an operator from removing a game or re-counting a prize tier mid-game.

**The whole change, in one line:** one place per contest, from a draft built step by step to a finished contest, where everything a fan plays under is set, previewed, and then locked once a fan has joined.

**In scope:**

- The contest model's new fields (`description`, `internalNote`, `contestType`, `publishedAt`), the derived status with Draft in front, and the list index.
- The lock as the console shows it, including one new lock kind (a prop line fans hold) and the rule that a started game's pool is read-only.
- Prop pool curation per game, stored as per-contest overrides (`contest_prop_overrides`) and tenant-added props (`contest_props`), and what the evaluator reads from them.
- Screens: Games & Contests (`/games`), the contest page (`/contests/:contestId` and its tabs), the builder (`/contests/new`, `/contests/:contestId/setup/:step`), Finalize wherever it appears, and the row behaviour of staff All contests.
- Endpoints: the cursor-paged contest list, the contest read, create (draft), edit, publish, duplicate, delete draft, add and remove games, the prop pool read and its writes, and Finalize's placement.
- The migration from today's data.
- Contracts in `obs-b2b-shared/src/api/admin/contests.ts` (new) and `games.ts` (kept for the old read until it retires).

**Not in scope:**

- **Prize tiers and the tier editor.** [`admin-prizes.spec.md`](admin-prizes.spec.md). The Prizes tab and the builder's Prizes step host it; this spec only places it.
- **Sponsor records and the placements grid's behaviour.** [`admin-sponsors.spec.md`](admin-sponsors.spec.md). The Sponsors tab and step host it.
- **The preview frame.** [`admin-preview.spec.md`](admin-preview.spec.md) and the S1/S2 preview interface.
- **Fan-side board building** (pick a prop per square, the alternate-line ladder, swaps, auto-fill, entry with at least two props, the two-teams rule, per-square lock at tip-off). S2's fan-app specs own it. This spec references it only in the lock rules and the Preview.
- **What Finalize does.** Unchanged: [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) owns `POST /admin/contests/:contestId/finalize`. This spec moves where the button appears.
- **Deleting a published contest.** Boards, redemptions and audit rows reference it by id, and a redemption is the record that a fan won something. A published contest the operator is done with is hidden and closed. Only a draft, which no fan has seen, can be deleted.
- **Trivia itself.** The type exists as a selectable placeholder; its entry model, scoring and settings belong to the trivia build.

---

## Vocabulary

Screens use these words and no others. Code names are in the model section.

| Term | Meaning | Never say |
|---|---|---|
| **Contest** | What a tenant creates and fans join. Spans one or more games, has a contest type, prize tiers and sponsor placements. | "activation", "event" |
| **Game** | A scheduled real game from the shared schedule, selected into a contest. | "bet event", "matchup" as a noun for the record |
| **Contest type** | Bingo or Trivia. | "game type" |
| **Description** | Up to 300 characters fans see on the contest card. | "note", "summary" |
| **Internal note** | Up to 500 characters only the console shows. | "note" on its own |
| **Draft** | A contest that has never been published. | "unpublished", "pending" |
| **Hidden / Visible** | Whether fans can see a published contest. | "listed", "unlisted" (retired) |
| **Open / Closed** | Whether a contest takes new players (the entries control). | "active", "paused" (paused belongs to a workspace) |
| **Locked** | The contest has at least one fan board. Not a status. | "frozen", "live" |
| **Finalize** | Staff only; ends a contest permanently. | "close", "settle" |
| **Prop** | One player, one market, one line (for example "J. Smith · Points · 24.5"). | "bet", "pick" in console copy |
| **Prop pool** | The props a game offers fans for this contest. | "market list" |

---

## The model

### `B2BContest`, field by field

Collection `{prefix}contests` (`obs-b2b-shared/src/models/b2b.ts`, interface `interfaces/b2b/B2BContest.ts`). New fields are marked.

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `organizationId` | ObjectId → `B2BOrganization` | yes | — | The tenant. Every read and write filters on it. |
| `contestName` | string | yes | Trimmed, 1–80 characters, unique within the tenant ignoring case | The fan card's title and the typed confirmation for Finalize, which is why uniqueness matters. Clash → 409 `name_taken`. |
| `description` (new) | string | no | Trimmed, ≤300 characters; empty string stored as absent | Fan-facing, shown on the contest card. Starts empty on every existing contest (see Migration). |
| `internalNote` (new) | string | no | Trimmed, ≤500 characters | Console only. Never on any fan wire (enforced by the fan wire's allowlist below). Holds what `contestDescription` held. |
| `contestType` (new; replaces `gameType`) | enum `CONTEST_TYPES = ["bingo", "trivia"]` | yes | One of the enum | Read through `contestTypeOf()`, which answers `contestType ?? gameType ?? "bingo"` during the migration window. Editable only while Draft (see "Contest type"). |
| `publishedAt` (new) | Date or null | no | Set by publish only | Null or absent means Draft. Never cleared once set. |
| `showContest` | boolean | no | — | Visibility of a published contest. Always false on a draft. Readers treat absent as true for published contests (today's behaviour). |
| `closed` | boolean | no | — | Entries. Reversible. |
| `allowedBetEvents` | ObjectId[] → `BetEvent` | — | Distinct; each must exist in the reference schedule | The games the contest runs at now. |
| `ranAtBetEvents` | ObjectId[] | no | Only grows | Every game the contest has ever run at; read through `ranAtBetEventIds()`. |
| `maxParticipants` | integer | yes | 0–1,000,000 | 0 = no limit. Lowering below the board count removes nobody. |
| `lockedAt` | Date | no | Written by the board endpoint only ([`contest-safety.spec.md`](contest-safety.spec.md)) | The first board's moment. The console never writes it. |
| `finalized`, `finalizedAt` | boolean, Date | no | Written by Finalize only | Permanent. |
| `prizeTiers` | ObjectId[] → `B2BPrizeTier` | — | ≤3 | Owned by [`admin-prizes.spec.md`](admin-prizes.spec.md). |
| `maxEntriesPerPerson` | number | yes | Fixed at 1 | No control. The unique board index makes one board per fan per contest a database fact, so a control above 1 would change nothing. |
| `twoTeamsNotRequired` | boolean | no | Fixed at false | No control. The B2C admin has none either; the two-teams rule is a fan-side board rule (S2). |
| `numberParticipants` | integer | yes | — | Dead. Nothing increments it and nothing reads it. Players are the board count. |
| `createdAt`, `updatedAt` | Date | — | — | `updatedAt` is the optimistic-concurrency token (`expectedUpdatedAt`). Curation writes and a fan's join never advance it. |

Removed by the migration: `contestDescription` (moved to `internalNote`), `gameType` (moved to `contestType`).

### Status, derived and never stored

`getB2BContestStatus()` keeps today's order with Draft in front. The console renders its output and never recomputes it.

| Order | Condition | Status | Chip text |
|---|---|---|---|
| 1 | `publishedAt` absent or null | Draft | "Draft" |
| 2 | `finalized` | Finished | "Finished" |
| 3 | `closed` | Closed | "Closed" |
| 4 | No games | Closed | "Closed" |
| 5 | Any game joinable (from 48 hours before tip-off until tip-off) | Open | "Open" |
| 6 | Any game opens later | Upcoming | "Opens in 3 days" (the server's own string) |
| 7 | Otherwise | Closed | "Closed" |

Locked is not a status. It is a glyph beside the status chip.

### Draft and publish

A contest is a **draft** from its creation until it is published. The builder saves the draft on its first Continue and keeps saving. A draft is invisible to fans by construction: it is not on the fan list, its pages answer 404, and nobody can join it. **Publish** sets `publishedAt` to now and `showContest` to true in one write, and is refused while any publish check fails (see `POST /admin/contests/:contestId/publish`). Publishing is one-way: a published contest can be hidden, never returned to draft. This replaces "contests are created hidden": the reason that rule existed (a contest exists before its prize tiers do) is now carried by the publish checks, which will not let a bingo contest go out without a game and a complete tier.

### Visibility and entries

- **Visibility** (`showContest`) applies to published contests: "Visible" or "Hidden". Hiding stops discovery and joining. It never removes a fan's board. A draft has no visibility control; it shows "Fans can't see a draft."
- **Entries** (`closed`) is the "Open | Closed" segmented control on the card and the contest page header. Closing stops new boards; boards in play keep scoring. The control sets the flag; the status chip still reports the derived status, so a contest can read "Opens in 3 days" with entries Open. Drafts and finalized contests have no entries control.

### Description and the internal note

Today's "Note" (`contestDescription`) was labelled "Only people in this console see the note." while `GET /b2b/contest/list-contests` and `GET /b2b/contest/:contestId` sent it to fans. The ruling makes the field fan-facing. Exposing old notes would break the promise the console made when they were written, so the migration moves every existing note to `internalNote`, and `description` starts empty everywhere. The contest page nudges an operator to write a description (Overview, below). Both fan reads switch to an allowlisted projection in the same release: `description` goes out, `internalNote` never does.

### Contest type

`contestType` lives on the contest, never on the tenant (`GAME-F1`). Bingo is the only playable type. **Trivia** is a selectable placeholder, the one placeholder D-068 allows (Arthur's 2026-09-24 clarification): wherever Trivia settings would go, the console shows one muted card, "Trivia isn't built yet. You can save this contest and come back.", and Publish is refused with "Trivia contests can't be published yet." A trivia draft can still have a name, description, internal note, player limit, games and sponsor placements. Its Board and Prizes areas show only the placeholder card; tiers it held as a bingo draft are kept and reappear if it is switched back.

The type can change only while the contest is a draft. A published contest is necessarily bingo (Trivia cannot publish), so a published contest shows its type as a value, and after the first board it carries the lock glyph as well. The server refuses a type change on a published contest (409 `not_draft`) and, belt and braces, on a locked one (409 `contest_locked`, kind `gameType`).

The console reads contest-type vocabulary from one descriptor (`src/lib/contestTypes.ts`, renamed from `gameTypes.ts`): display name, what a tier's threshold is called ("bingo" / "bingos"). Board generation keeps refusing a non-bingo contest ("This contest can't be played here yet."), which a trivia contest can only reach if someone bypasses publish.

### Indexes

Connectors run with `autoIndex: false`; indexes are declared on the models and created per environment by the index script.

| Collection | Index | Why |
|---|---|---|
| `contests` | `{ organizationId: 1, publishedAt: -1, _id: -1 }` | The list's keyset order: drafts are the `publishedAt: null` range (newest first by `_id`), published contests follow by `publishedAt`. Also serves every tenant-scoped contest read, which had no index at all. |
| `bingo_boards` | `{ contestId: 1, clerkUserId: 1 }`, unique | One board per fan per contest ([`contest-safety.spec.md`](contest-safety.spec.md)). Also serves per-contest player counts and the sparkline. |
| `contest_prop_overrides` | `{ contestId: 1, propId: 1 }`, unique; `{ contestId: 1, betEventId: 1 }` | One override per prop per contest; the pool read by game. |
| `contest_props` | `{ contestId: 1, betEventId: 1 }`; unique `{ contestId: 1, betEventId: 1, entityId: 1, market: 1, outcomeType: 1, line: 1 }` | The pool read by game; no duplicate rung. |

Name uniqueness stays check-then-write (Known gaps).

### What the fan side honours

Every control on these screens changes what fans get. The fan entry points enforce them server-side; the fan app's own buttons are convenience.

| Check at `POST /b2b/board/generate` and the contest read (in order) | Fan-facing answer |
|---|---|
| The fan already holds a board in this contest | 409 with the existing `boardId` (the fan lands on their board) |
| Contest not in this tenant, hidden, or a draft | 404 "Contest not found" |
| Contest is not bingo | 409 "This contest can't be played here yet." |
| Status is not Open | 409 "This contest isn't open for new players right now." |
| Board count ≥ a non-zero player limit | 409 "This contest is full." |

The fan list (`GET /b2b/contest/list-contests`) excludes drafts and hidden contests, and both fan reads return this projection only: `contestId`, `contestName`, `description`, `contestType`, derived status, games, the fan fields of prize tiers, and the pool as curated below. `internalNote`, `publishedAt`, `lockedAt` and the audit-relevant fields never leave the admin surface.

---

## The lock

The ruling: no contest versioning; before the first fan joins everything is editable, and after it the things fans play and win under lock. [`contest-safety.spec.md`](contest-safety.spec.md) builds the stamp (`lockedAt`), the refusals (`409 contest_locked`) and the pure functions both sides call (`contestIsLocked`, `gameLockViolations`, `tierLockViolations`, `gameTypeLockViolations`). This section is the console's contract with it.

### What stays editable and what locks

| Setting | Before the first board | After |
|---|---|---|
| Name, description, internal note, visibility, entries, player limit | Editable | Editable |
| Adding games | Editable | Editable |
| **Removing a game** | Editable | **Locked** |
| **Contest type** | Editable while Draft | **Locked** (and already fixed by publishing) |
| **Board curation of a game whose tip-off has passed** | Read-only (fans can't pick from a started game) | **Locked** |
| Board curation of a game that hasn't started | Editable | Editable, except the line of a prop fans hold (below) |
| **A prop's line, once any fan's board holds that prop** | — | **Locked** |
| Marking a player out | Editable until the game is final | Editable until the game is final |
| Adding a prize tier (up to 3); a tier's text, image, type details, code, link, location, expiry, sponsor | Editable | Editable, with the note "Changes apply to prizes awarded from now on. Fans who already won keep what they were promised." ([`admin-prizes.spec.md`](admin-prizes.spec.md)) |
| **Bingos to win on every tier; removing a tier; lowering a tier's stated value** | Editable | **Locked** |
| The board rules card | Read-only | Read-only |

**Why removing a game locks.** A fan's board holds props from every game the contest ran at when they built it. The evaluator scores a square by its prop, not by whether the contest still lists the prop's game, so squares from a removed game keep scoring and keep paying. Removing a game after fans joined therefore does not remove it from play; it only removes it from the console, which then misreports what fans are playing. The only honest options were to make removal also void those squares (which takes a promised square away from a fan) or to lock it. Locking is the one that keeps every promise. Adding a game stays open because it only gives fans more to pick from. [`contest-safety.spec.md`](contest-safety.spec.md) already lists removal (`gameRemoved`); this is the console's reason for keeping it there.

**Why curation of a future game stays open.** Fans can still change a square from a game that hasn't started, exactly as B2C fans can until tip-off. Hiding, locking or adding a prop there changes what fans may pick next, not what they already hold. The one exception is a line a fan already holds: changing it would silently rewrite that fan's square, so it locks as soon as any board holds the prop ("Hide it and add a new line instead" is the way to offer a different line). At tip-off the game's pool is read-only for good. This is narrower than [`contest-safety.spec.md`](contest-safety.spec.md)'s "Board rules" row, which locks all curation at the first fan because curation did not exist when it was written; the per-game tip-off rule and the `propLine` kind replace that row for curation.

**Why Mark out stays open after tip-off.** Marking a player out turns every square holding that player's props into a hit (B2C parity, below). It only ever gives fans more, like raising a stated value, and it is the action operators need most once a game is under way and a player sits out. It stays available until the game is final and cannot be undone once the game has started.

### One new lock kind, and the tip-off rule

`CONTEST_LOCK_KINDS` in `obs-b2b-shared` (`interfaces/b2b/ContestLock.ts`) gains `propLine`: a line change, or a delete of a tenant-added prop, when any board in the contest holds that prop. It comes back as `409 contest_locked` with the kind in `locked[]`, like the existing kinds.

Curation of a started game is refused whether or not the contest is locked, because fans can no longer pick from that game either way. It is its own refusal, `409 game_started`, not a lock kind. Mark out is the one curation write it lets through, until the game is final.

### How the console shows it

- **The glyph.** A lock glyph beside the status chip on the card, the contest page header and the staff rows, with the tooltip "Locked since the first fan joined. Contest type, board rules, bingos to win and existing prize tiers can't change."
- **Locked controls read as values** with one plain line where the control was (D-059: never a disabled control that might wake up). Games tab: "Games can't be removed after the first fan joins. You can still add games." A started game's pool: "This game has started, so its props can't change. You can still mark a player out." A prop fans hold: its line is shown as a value, and Edit line is replaced by the explanation on open.
- **A 409 `contest_locked` from a write** (the lock landed between loading the page and saving) renders as an inline error under the field that was being saved: "This can't change after the first fan joins." The page then re-reads the contest so every other locked control turns into its value.
- **One wording.** `CONTEST_LOCK_COPY` in shared is aligned to these sentences in the build, so the server's refusal and the console's line stay the same words (contest-safety's rule). The tier kinds' sentences are [`admin-prizes.spec.md`](admin-prizes.spec.md)'s.

### Open question for Arthur: "entries" after the lock

The ruling lists "entries" among what stays editable after the lock. This spec reads that as **entries open or closed**, which does stay editable. If it meant the number of **entries per fan**, the unique index makes that constant at 1, so there is no control to keep editable, and none is shown (a control with no effect is removed, like auth-variant). If Arthur wants fans to hold several boards in one contest later, the index becomes `{ contestId, clerkUserId, boardIndex }`, the fan app gains a way to hold and pick between boards, and the control arrives with them.

---

## Prop pool curation (the Board)

The ruling: admin-side bingo customisation matches **exactly** what the B2C admin offers, and nothing it doesn't. Verified in the B2C code (2026-09-24): the B2C admin has no bingo rule settings at all (no grid, no free square, no lines-that-count, no bingos-to-win, no scoring settings). Its customisation is **prop pool curation per game**. That is what the Board tab and the builder's Board step offer.

### B2C admin action by action

| B2C admin action | In B2B | Notes |
|---|---|---|
| Show / hide a prop | **Yes**, row action "Hide" / "Show" | Hidden props leave the fan picker and auto-fill; a square already holding one keeps it and it keeps scoring. |
| Show / hide all of a player's props | **Yes**, "Hide all of J. Smith's props" / "Show all of J. Smith's props" | |
| Show / hide a whole game | **Yes**, "Hide this game" / "Show this game" | The game stays in the contest; fans simply have nothing to pick from it. |
| Lock / unlock a prop | **Yes**, row action "Lock" / "Unlock" | A locked prop can't be picked, and a square holding it can't be swapped (fan-side, S2). |
| Lock / unlock all of a player's props | **Yes**, "Lock all of J. Smith's props" / "Unlock all of J. Smith's props" | B2C has per-player lock; parity keeps it. |
| Edit a prop's line | **Yes**, row action "Edit line" (Over props only) | Locked once a fan holds the prop. |
| Display override (text only) | **Yes**, row action "Display text" | Up to 40 characters shown to fans in place of market and line. |
| Add a prop (player, market, Over/Manual, line) | **Yes**, "Add prop" | Stored as a tenant-added prop (below). Markets are limited to those the schedule's data already tracks for that player, so the prop can be resolved. |
| Mark a missing player injured | **Yes**, as "Mark J. Smith out" | Every square holding one of the player's props counts as a hit, as in B2C (where the rewrite resolves it as a hit worth about one point). The player's props leave the picker. |
| Delete unused props | **Yes**, for tenant-added props only: "Delete" on a row no board holds | Feed props are shared data B2B never deletes; hiding is the equivalent. |
| Edit a prop's multiplier | **No** | B2B scores bingos (completed lines), not points. A multiplier would be a control with no effect. |
| Progress entry, finalize / unfinalize a prop, pull live stats | **No** | B2B's evaluator resolves props from the shared stats feed. An operator typing a result would override the feed for one tenant and diverge from every other. |
| Edit the game's props-open time or event time | **No** | The schedule is read-only shared data (`GAME-C1`). |
| Mass prop import and its ladder config | **No** | The shared feed builds the pool and its alternate-line ladders; B2B curates what the feed loaded. |
| Grid size, free square | **No** | Neither exists in B2C; both are excluded by the ruling. |

**One deliberate deviation from B2C.** B2C curates the prop record itself, so a hide applies to every contest that uses the game. B2B's prop data is a read-only copy shared with the D2C app and with every tenant, so curation is stored **per contest, per game** as overrides and never touches the shared prop. Two tenants running the same game curate it independently (`TEN-C1`, `ADM-09`).

### What the pool is

For each game in the contest, the pool is:

1. The game's feed props (`readonly_props` for that `betEventId`) that the shared data marks shown (`showProp`). A prop the shared data hides is not in the pool at all; a prop the shared data locks is shown locked, with no Unlock (B2B can't unlock what the feed locked).
2. Plus the contest's tenant-added props for that game (`contest_props`).
3. With the contest's overrides applied: hidden, locked, line, display text, out.

Defaults: everything shown, nothing locked, feed lines.

### `contest_prop_overrides`

One document per (contest, feed prop) that differs from the default. Absent means default. Removing every change deletes the document.

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `organizationId` | ObjectId | yes | Must equal the contest's | Tenant scope on every read. |
| `contestId` | ObjectId → contest | yes | Must belong to the tenant | |
| `betEventId` | ObjectId → `BetEvent` | yes | Must be one of the contest's games | Written from the prop, not trusted from the body. |
| `propId` | ObjectId → `readonly_props` | yes | Must be a feed prop of that game | Unique with `contestId`. |
| `hidden` | boolean | no | — | Default false. |
| `locked` | boolean | no | — | Default false. |
| `lineOverride` | number or null | no | Over props only; 0.5–999.5 in steps of 0.5; must not equal another rung for the same player and market | Null = the feed line. |
| `displayOverride` | string or null | no | Trimmed, 1–40 characters | Shown to fans in place of market and line. |
| `source` | `"manual"` \| `"out"` | yes | — | `out` means the player was marked out: hidden is forced true and the evaluator treats the prop as a hit. |
| `outAt` | Date | with `out` | — | When Mark out ran; decides whether Undo is still offered (before tip-off only). |
| `updatedBy` | string (admin user id) | yes | — | |
| `createdAt`, `updatedAt` | Date | — | — | |

### `contest_props` (tenant-added props)

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `organizationId` | ObjectId | yes | Must equal the contest's | |
| `contestId` | ObjectId | yes | Must belong to the tenant | |
| `betEventId` | ObjectId | yes | One of the contest's games, not started | |
| `entityId` | ObjectId → entity | yes | A player on the game's roster in the shared data | |
| `playerName`, `teamName` | string | yes | Copied from the shared data at creation | For display; the entity stays the reference. |
| `market` | string | yes | A market the feed carries for that player in that game | So the prop resolves from the same stat line as the feed's props. |
| `outcomeType` | `"Over"` \| `"Manual"` | yes | — | Unders are not offered (B2C never resolves them). |
| `line` | number | Over only | 0.5–999.5 in steps of 0.5; not an existing rung for that player and market | Manual props hit when the stat reaches 1, as in B2C. |
| `displayOverride` | string | no | 1–40 characters | |
| `hidden`, `locked` | boolean | no | — | Same meaning as on overrides. |
| `source` | `"manual"` \| `"out"` | yes | — | Default `manual`; Mark out sets `out` here too. |
| `outcome` | `"Hit"` \| `"Miss"` \| null | no | Written by the evaluator only | |
| `resolvedAt` | Date | no | Evaluator only | |
| `createdBy` | string | yes | — | |
| `createdAt`, `updatedAt` | Date | — | — | |

A board cell may hold a `contest_props` id. The board read, the fan picker and the evaluator resolve a cell id against `readonly_props` first and then against the board's contest's `contest_props`.

### Who reads the curation

- **The fan picker and auto-fill** (fan reads and `POST /b2b/board/generate`) build the pool as above, per contest. S2's fan specs own the presentation.
- **The evaluator Lambdas** (`prop-update-evaluator`, `board-evaluator`) read the overrides and tenant props when deciding a square: `source: "out"` → hit; a `lineOverride` or a tenant Over prop → hit when the feed's progress for that player, market and period reaches the line, miss when the feed marks the group final below it; a tenant Manual prop → hit at progress ≥ 1; otherwise the feed prop's own outcome.
- **Waking the evaluator.** The prop-hit queue carries only feed props newly hit at the feed's own line, so an overridden line or a tenant prop can hit with no message. While a game is in play, a sweep every 60 seconds reads progress for the player-and-market groups that carry an override line or a tenant prop in any contest, writes `contest_props.outcome`, and enqueues board evaluations when an effective outcome changes. Keeping the trigger inside B2B avoids a change to the external publisher.

---

## The screens

Visual language is the console's existing one, built from its tokens only: segmented controls, never switches. Inline confirmation lines, never toasts. Muted-sentence empty states. KPI tiles with the hue outline. Numbers in the display face with tabular digits.

### `/games` — Games & Contests

**Header.** Eyebrow "Games"; H1 "Games & Contests" (set in uppercase by the headline style); right: the primary action "New contest" for anyone who can write. The action opens `/contests/new`.

**Toolbar** (G1's sticky list toolbar):

1. Search, over contest names.
2. Status: segmented "All · Draft · Upcoming · Open · Closed · Finished" (a select below 900px).
3. Type: segmented "All · Bingo · Trivia".
4. Visibility: segmented "All · Visible · Hidden". "Hidden" matches published hidden contests; drafts are found through Status.
5. Sort: select "Next game · Newest · Players". Default "Next game".
6. The count: "12 contests", from the server's total for the current search and filters.

Search, filters and sort live in the URL (`/games?q=&status=&type=&visibility=&sort=`), so Overview and Operations can link straight into a filtered list. Changing any of them restarts the list from the top. The list is `InfiniteList` over `GET /admin/contests`, pages of 20, loading the next page 600px before the end.

**The banner card.** Two columns at ≥1100px, one below.

1. **Band**, 4:1. The contest-wide Board banner sponsor's artwork, fitted inside the band without cropping, centred on the tenant's band colour; with no contest-wide Board banner holder, the tenant's standardised decorative band (a gradient from its palette with its theme's decoration). Never a placeholder image. Over the band, top left: the status chip, "Hidden" when published and hidden, and the lock glyph when locked.
2. **Body.** Type chip ("Bingo" or "Trivia"); the name (Archivo 20/700); the description, two lines, muted, omitted when empty.
3. **Stats row**, three numbers in the stat-fraction style: **Players** ("412", or "412/500" with a limit), **Games** (finished of total, "1/3", with the next game under it: "Next: Bison @ Fighting Hawks · Sat 7:00 PM", or "Live: Bison @ Fighting Hawks" while one is in play; no line when nothing is upcoming), **Prize tiers** ("2"). The next game shows the full matchup because the platform does not know which side is the tenant's team.
4. **Sparkline**: new players per day over the last 14 days, 96×28 SVG in the tenant colour, captioned "+18 this week" or "None new this week". Omitted until the contest has its first player.
5. **Footer**: the entries control "Open | Closed" (published, not finalized); "Continue setup" on a draft (opens the builder at the first incomplete step); "Finalized Sep 28" on a finalized contest. Staff only: a ghost "Finalize" button when every game has ended and the contest is published and not finalized (the same test as Operations' `ready-to-finalize` row, so the two never disagree); otherwise it is absent, not disabled.

**Interactions.**

- The whole card is a link to `/contests/:contestId` (Overview). The entries control, "Continue setup" and "Finalize" are their own focus stops and stop the click from reaching the card.
- The entries control writes immediately (PATCH `closed`) and answers in the footer with one line: "Entries closed. Fans who joined keep playing." or "Entries open." A failure reverts the control and shows the error in the same place.
- "Finalize" opens the Finalize dialog (below). On success the card's chip turns "Finished" and its footer reads "Finalized" with the date.

**States.**

| State | What renders |
|---|---|
| Loading (first page) | Four skeleton cards in the card's shape. |
| Empty (no contests at all) | The muted sentence "No contests yet." and, for writers, "New contest". A member sees only the sentence. |
| No matches | "No contests match." with "Clear search and filters". |
| First page failed | The kit's `ReportableLoadError`. |
| A later page failed | The loaded cards stay; the last row reads "Couldn't load more." with "Try again". |
| Member (view-only) | The same cards. The entries control is replaced by its state as text ("Open" / "Closed"); no "New contest", no "Continue setup". One line under the header: "Only organization admins can change contests." |
| Paused workspace | As member, with the console's paused banner (writes are refused server-side). Staff keep write access, as everywhere. |
| Staff with no tenant chosen | The console's "Pick a tenant" fallback. |

**Copy.**

| Element | Copy |
|---|---|
| Eyebrow / title | "Games" / "Games & Contests" |
| Primary action | "New contest" |
| Search placeholder | "Search contests" |
| Status filter | "All", "Draft", "Upcoming", "Open", "Closed", "Finished" |
| Type filter | "All", "Bingo", "Trivia" |
| Visibility filter | "All", "Visible", "Hidden" |
| Sort | "Sort", "Next game", "Newest", "Players" |
| Count | "12 contests", "1 contest" |
| Chips | "Draft", "Opens in 3 days", "Open", "Closed", "Finished", "Hidden", "Bingo", "Trivia" |
| Lock glyph tooltip | "Locked since the first fan joined. Contest type, board rules, bingos to win and existing prize tiers can't change." |
| Stat labels | "Players", "Games", "Prize tiers" |
| Next game | "Next: Bison @ Fighting Hawks · Sat 7:00 PM", "Live: Bison @ Fighting Hawks" |
| Sparkline caption | "+18 this week", "None new this week" |
| Entries control | "Open", "Closed" (accessible name "Entries") |
| Entries confirmations | "Entries closed. Fans who joined keep playing.", "Entries open." |
| Draft footer | "Continue setup" |
| Finalized footer | "Finalized Sep 28" |
| Staff action | "Finalize" |
| Empty / no matches | "No contests yet.", "No contests match.", "Clear search and filters" |
| Member line | "Only organization admins can change contests." |
| Later page failed | "Couldn't load more.", "Try again" |

### `/contests/:contestId` — the contest page

A full page, reached from a card, from Overview and Game day links, and for staff from All contests and the tenant page with `?tenant=<slug>` (which sets the console's acting tenant before the read, so the sidebar and every link agree). A tenant user whose URL names a tenant gets the same "Contest not found." state as a wrong id: the server refuses a non-staff `?tenant=` with 403, and the console does not confirm the contest exists.

**Header.**

- Back link: "Games & Contests" to `/games`, or "All contests" / the tenant's name when the page was opened from those (carried in navigation state, falling back to "Games & Contests").
- Eyebrow "Contest · Bingo" (or "Contest · Trivia"); H1 the name; chips: status, "Hidden", lock glyph.
- Right: the entries control "Open | Closed" (published, not finalized); "Preview" (secondary; switches to the Preview tab); an overflow menu ("More actions") with "Hide from fans" / "Show to fans" (published only), "Duplicate", "Delete draft" (draft only); staff: "Finalize" (ghost, same rule as the card).
- Hide and Show write immediately and confirm under the header: "Hidden from fans. Fans who joined keep their boards." / "Visible to fans."

**Tabs**: "Overview · Games · Board · Prizes · Sponsors · Preview". The tab is in the URL: `/contests/:contestId` (Overview), `/games`, `/board`, `/prizes`, `/sponsors`, `/preview` appended. An unknown tab segment opens Overview. The Prizes tab's tier editor is a full page under it (`/contests/:contestId/prizes/new`, `/contests/:contestId/prizes/:tierId`; [`admin-prizes.spec.md`](admin-prizes.spec.md)).

**Page states.**

| State | What renders |
|---|---|
| Loading | Header skeleton and the active tab's skeleton. |
| Not found (wrong id, other tenant, or a draft deleted elsewhere) | "Contest not found." with "Back to Games & Contests". |
| Load failed | `ReportableLoadError`. |
| Draft | A banner under the header: "This is a draft. Fans can't see it until you publish." with "Continue setup", which reopens the builder at the first incomplete step. |
| Just published | The line "Published. Fans can see it now." under the header, for this visit only. |
| Locked | Glyph in the header; locked controls read as values on every tab. |
| Finalized | "Finished" chip; every tab read-only; no entries control, no overflow except "Duplicate"; the header line "Finalized on Sep 28. Nothing about this contest can change." |
| Member | View-only presentation on every tab, with "Only organization admins can change contests." under the header. The overflow menu is absent; "Preview" stays. |
| Stale write (409 `stale_contest`) | Inline, where the save happened: "This contest changed while you were editing, so nothing was saved. Reload to see the current version and make your change again." with "Reload". |

**Duplicate** creates a new draft ("Copy of Rivalry Week", numbered if taken) with the description, internal note, contest type, player limit, the games that haven't started, the prize tiers (as new tiers with the same content), the sponsor placements for all games and for the carried games, and the board curation of the carried games. It opens the new draft in the builder at Basics.

**Delete draft** opens a centred dialog: "Delete this draft?" / "It hasn't been published, so no fan has seen it. Its prize tiers and sponsor placements are deleted with it." / "Delete draft" · "Cancel". On success the console returns to `/games`, where the card is gone. No reverification: a draft has reached no fan and paid no prize, so deleting it is not one of the irreversible actions the reverification list protects; the typed-free dialog is enough.

**Copy (header and page).**

| Element | Copy |
|---|---|
| Back link | "Games & Contests", "All contests", "<tenant name>" |
| Eyebrow | "Contest · Bingo", "Contest · Trivia" |
| Actions | "Open", "Closed", "Preview", "More actions", "Hide from fans", "Show to fans", "Duplicate", "Delete draft", "Finalize" |
| Tabs | "Overview", "Games", "Board", "Prizes", "Sponsors", "Preview" |
| Visibility confirmations | "Hidden from fans. Fans who joined keep their boards.", "Visible to fans." |
| Draft banner | "This is a draft. Fans can't see it until you publish.", "Continue setup" |
| Published line | "Published. Fans can see it now." |
| Finalized line | "Finalized on Sep 28. Nothing about this contest can change." |
| Delete dialog | "Delete this draft?", "It hasn't been published, so no fan has seen it. Its prize tiers and sponsor placements are deleted with it.", "Delete draft", "Cancel" |
| Not found | "Contest not found.", "Back to Games & Contests" |
| Stale | "This contest changed while you were editing, so nothing was saved. Reload to see the current version and make your change again.", "Reload" |

#### Overview tab

Two columns at ≥1100px (content, then a 320px right rail); one below, with the rail after the content.

**KPI tiles** (hue outline, 40px numbers):

| Tile | Value | Shown when |
|---|---|---|
| "Players" | The board count, with "of 500" under it when limited | Always (0 on a new contest is true) |
| "Boards with a bingo" | Boards with at least one completed line | Published |
| "Prizes awarded" | Redemptions that pay a tier (not skipped) | Published |
| "Failed sends" | Failed prize sends for this contest | Only when above 0; the tile links to Prize deliveries filtered to this contest and to Failed |

**Basics**, edited inline. Each field saves on blur or Enter as a one-field PATCH with the precondition; Escape reverts. A saved field shows "Saved." beside its label for a few seconds. Errors sit under the field.

1. **Name.** Text, required, 80 characters.
2. **Description.** Textarea with a counter ("112/300"); help "Fans see this on the contest card." When the description is empty, a nudge sits under it: "Fans see the description on the contest card." and, when the internal note has text, the button "Use the internal note", which copies the note into the description field unsaved, so the operator reviews it and saves it by leaving the field. A note longer than 300 characters copies whole and shows "Keep it to 300 characters." until it is shortened.
3. **Internal note.** Textarea, 500 characters; help "Only people in this console see the internal note."
4. **Player limit.** Segmented "No limit | Limit to" with a number ("players"). Lowering below the current player count states the consequence before saving: "412 are already playing. Nobody is removed; new fans can't join."
5. **Visibility.** Segmented "Visible | Hidden" on a published contest; on a draft the text "Fans can't see a draft."
6. **Contest type.** On a draft, segmented "Bingo | Trivia". Published: the value, with the lock glyph once locked.

**Right rail, "What's next"**, a short timeline:

- **Next game**: "Bison @ Fighting Hawks · Sat 7:00 PM" with its readiness dot from game day, linking to Game day on that game; "No upcoming games" when none.
- **Lock**: "Not locked. Everything can change until the first fan joins." or "Locked since Sat Sep 27, 7:02 PM."
- **Finalize**: staff see "Ready to finalize" with the "Finalize" button under the card rule, "Finalize after the last game" before it, or "Finalized on Sep 28". Tenants see "Overboard finalizes the contest after its last game." or "Finalized on Sep 28."

**Copy.**

| Element | Copy |
|---|---|
| Tiles | "Players", "of 500", "Boards with a bingo", "Prizes awarded", "Failed sends" |
| Field labels | "Name", "Description", "Internal note", "Player limit", "Visibility", "Contest type" |
| Help | "Fans see this on the contest card.", "Only people in this console see the internal note." |
| Nudge | "Fans see the description on the contest card.", "Use the internal note" |
| Player limit | "No limit", "Limit to", "players", "412 are already playing. Nobody is removed; new fans can't join." |
| Visibility | "Visible", "Hidden", "Fans can't see a draft." |
| Contest type | "Bingo", "Trivia" |
| Saved | "Saved." |
| Field errors | "Give the contest a name.", "Keep it to 80 characters.", "Keep it to 300 characters.", "Keep it to 500 characters.", "Enter a number from 1 to 1,000,000.", "Another contest in this workspace already has this name.", "This can't change after the first fan joins." |
| Rail | "What's next", "Next game", "No upcoming games", "Lock", "Not locked. Everything can change until the first fan joins.", "Locked since Sat Sep 27, 7:02 PM.", "Finalize", "Ready to finalize", "Finalize after the last game", "Overboard finalizes the contest after its last game.", "Finalized on Sep 28." |

#### Games tab

An `InfiniteTable` of the contest's games (`GET /admin/contests/:contestId/games`), soonest first, then played games newest first. Columns: **Game** (matchup), **Tip-off**, **League**, **Status** ("Upcoming", "Live", "Final"), **Sponsors** (the names of this game's own placement holders; "Same as all games" when it only inherits; empty when nobody is placed; links to the Sponsors tab), and a **Remove** action before the lock.

- **Remove** (before the lock) acts at once and answers above the table: "Removed Bison @ Fighting Hawks." with "Undo", which adds it back. The game's placements and curation are kept, dormant, so Undo or a later re-add restores them.
- **After the lock** the Remove column is gone and one line sits above the table: "Games can't be removed after the first fan joins. You can still add games."
- **"Add games"** (writers, not finalized) opens an inline picker panel at the top of the tab, not a drawer: G1's `PickerList` over `GET /admin/games/candidates?contest=<id>` (upcoming games only, minus this contest's), with search ("Search teams"), a league filter ("All leagues"), a date range ("Any date", "Next 7 days", "Next 30 days", "Choose dates"), the count ("48 games"), checkbox rows grouped by day, and the footer "Add 3 games" · "Cancel". Adding confirms above the table: "Added 3 games."
- **Empty**: "No games yet." with "Add games".
- **Trivia** has the same Games tab: trivia contests run at games too.

| Element | Copy |
|---|---|
| Columns | "Game", "Tip-off", "League", "Status", "Sponsors" |
| Status | "Upcoming", "Live", "Final" |
| Sponsors cell | "Same as all games" |
| Actions | "Add games", "Remove", "Undo" |
| Confirmations | "Removed Bison @ Fighting Hawks.", "Added 3 games.", "Added 1 game." |
| Lock line | "Games can't be removed after the first fan joins. You can still add games." |
| Empty | "No games yet." |
| Picker | "Search teams", "All leagues", "Any date", "Next 7 days", "Next 30 days", "Choose dates", "48 games", "Add 3 games", "Cancel", "No upcoming games match." |
| Errors | "Bison @ Fighting Hawks has already started.", "This can't change after the first fan joins." |

#### Board tab

Exactly two things (B2C parity, above).

**1. The board rules card** (read-only): "Fans fill a 3×3 board. A bingo is any full row, column or diagonal: 8 lines in all." and the ladder summary from the contest's tiers, "Tier 1 at 1 bingo · Tier 2 at 3 · Tier 3 at 5", with the link "Edit on Prizes". With no tiers: "No prize tiers yet." with "Add one on Prizes". No settings.

**2. The prop pool, one section per game**, in tip-off order. The next game to start is expanded; the rest are collapsed headers. A section header shows the matchup and tip-off, the count line ("84 props · 3 hidden · 0 locked"), "Started" when the tip-off has passed, and the game menu ("Hide this game" / "Show this game"). Inside an expanded section:

- A toolbar: search ("Search players"), filter segmented "All · Shown · Hidden · Locked · Added", and "Add prop".
- An `InfiniteTable` (`GET /admin/contests/:contestId/props?game=`), grouped by player (heading: player, team, and the player menu), then market, then line ascending, so a player's alternate lines read as a ladder. Columns: **Player**, **Team**, **Market**, **Line**, **Shown** ("Shown" / "Hidden"), **Locked** ("Locked", or empty). Markers: "Added" on a tenant-added prop; "Out" on an out player's props; an overridden line shows the new line with "was 22.5" muted beside it; display text shows under the line in quotes.
- **Row menu**: "Hide" / "Show", "Lock" / "Unlock", "Edit line" (Over props), "Display text", and "Delete" on an added prop no board holds.
- **Player menu**: "Hide all of J. Smith's props", "Show all of J. Smith's props", "Lock all of J. Smith's props", "Unlock all of J. Smith's props", "Mark J. Smith out" (or "Mark J. Smith back in" before tip-off).
- **Edit line** and **Display text** edit in the row, with "Save" and "Cancel"; errors sit under the input.
- **Add prop** opens an inline form above the table: "Player" (the game's roster), "Market" (only markets the data carries for that player), "Outcome" segmented "Over | Manual", "Line" (Over only), then "Add prop" · "Cancel". It confirms in the table by highlighting the new row.
- **Mark out**: before tip-off it acts at once with "J. Smith is marked out." and "Undo". After tip-off a centred dialog confirms first: "Mark J. Smith out?" / "Every square with one of J. Smith's props counts as a hit. Once the game has started this can't be undone." / "Mark out" · "Cancel".
- **Writes are immediate** and confirm on the row (its values change); hide, show, lock and unlock need no dialog because each is one click to reverse.

**States.** No games: "Add games first. The board uses the props from the games you pick." with "Add games". A game whose pool is empty: "No props for this game yet." A started game: the section is read-only apart from Mark out, with "This game has started, so its props can't change. You can still mark a player out." A prop fans hold: "Edit line" and "Delete" answer with "Fans have this prop on their boards, so its line can't change. Hide it and add a new line instead." / "Fans have this prop on their boards, so it can't be deleted. Hide it instead." Trivia: the placeholder card only. Member and finalized: the tables with no menus, no toolbar actions.

| Element | Copy |
|---|---|
| Rules card | "Board rules", "Fans fill a 3×3 board. A bingo is any full row, column or diagonal: 8 lines in all.", "Tier 1 at 1 bingo · Tier 2 at 3 · Tier 3 at 5", "Edit on Prizes", "No prize tiers yet.", "Add one on Prizes" |
| Section | "84 props · 3 hidden · 0 locked", "Started", "Hide this game", "Show this game" |
| Toolbar | "Search players", "All", "Shown", "Hidden", "Locked", "Added", "Add prop" |
| Columns and values | "Player", "Team", "Market", "Line", "Shown", "Hidden", "Locked", "Added", "Out", "was 22.5" |
| Row menu | "Hide", "Show", "Lock", "Unlock", "Edit line", "Display text", "Delete", "Save", "Cancel" |
| Player menu | "Hide all of J. Smith's props", "Show all of J. Smith's props", "Lock all of J. Smith's props", "Unlock all of J. Smith's props", "Mark J. Smith out", "Mark J. Smith back in" |
| Display text help | "Shown to fans in place of the market and line." |
| Add prop | "Player", "Market", "Outcome", "Over", "Manual", "Line", "Add prop", "Cancel" |
| Mark out | "J. Smith is marked out.", "Undo", "Mark J. Smith out?", "Every square with one of J. Smith's props counts as a hit. Once the game has started this can't be undone.", "Mark out", "Cancel" |
| Empty and state lines | "Add games first. The board uses the props from the games you pick.", "Add games", "No props for this game yet.", "This game has started, so its props can't change. You can still mark a player out." |
| Errors | "Enter a line from 0.5 to 999.5.", "J. Smith already has a Points prop at 24.5.", "Keep it to 40 characters.", "Pick a market this player has props for.", "Fans have this prop on their boards, so its line can't change. Hide it and add a new line instead.", "Fans have this prop on their boards, so it can't be deleted. Hide it instead." |
| Trivia | "Trivia isn't built yet. You can save this contest and come back." |

#### Prizes tab

The contest's prize ladder: up to three tier cards ordered by bingos to win, each with its type icon, name, "3 bingos", the "Provided by" sponsor's logo and name, and a status pill "Complete" or "Needs details". "Add tier" (hidden at three) and a card click open the full-page tier editor. Locked: remove is gone and bingos to win shows with the lock glyph. Trivia: the placeholder card. Everything else (fields, completeness, the lock note, the email and popup preview) is [`admin-prizes.spec.md`](admin-prizes.spec.md).

#### Sponsors tab

The placements grid: rows "Sign-in", "Board banner", "Slider"; columns "All games" and one per game. A cell shows the holder's artwork at the slot's ratio with the sponsor's name; an empty cell "Add"; a game cell inheriting the all-games holder shows it muted with "Inherited". A click opens a popover picker of the tenant's sponsors (searchable, endless scroll). Below the grid: "Provided by", listing each tier's sponsor (read-only, linking to Prizes), and a "Preview" link per game. A tenant with no sponsors: "No sponsors yet. Add one on the Sponsors page." Behaviour and endpoints: [`admin-sponsors.spec.md`](admin-sponsors.spec.md).

#### Preview tab

The console's `FanAppPreview` host with this contest's current state, saved or not: the screen switcher ("Gate · Join · Home · Contest · Board · Prize"), a game selector when the contest has more than one game, the board mode ("Draft · Live") on Board, a tier selector on Prize, and the device toggle ("Phone | Desktop"). The console adds no label to the frame: the fan app carries its own PREVIEW chyron. Until the frame is ready, a skeleton; after 8 seconds without it, "The fan app didn't load." with "Retry". Contract and host: [`admin-preview.spec.md`](admin-preview.spec.md) and the S1/S2 preview interface.

### The builder — `/contests/new`, `/contests/:contestId/setup/:step`

Full screen: the sidebar hides. **Header**: the tenant mark, the title "New contest" (the name once typed), and "Exit". **Left rail**: the six steps, each marked done (✓), current, or to do; once the draft exists every step is reachable from the rail. **Content** column, max 800px. **Footer bar**: "Back", "Continue" (primary); on Review, "Save draft" and "Publish" instead of Continue.

Steps and their routes (`:step` = `basics`, `games`, `board`, `prizes`, `sponsors`, `review`):

1. **Basics.**
   - **Name**, required, 80 characters, placeholder "Rivalry Week", focused on open.
   - **Contest type**: two selectable cards. "Bingo" / "Fans build a board of player props and win on bingos." (selected by default) and "Trivia" / "Trivia isn't built yet. You can save this contest and come back."
   - **Description**, 300 characters, with the live mini preview to the right: the fan app's Home screen in the preview frame at half scale, showing this contest's card as fans will see it (rendered by the fan app, never redrawn).
   - **Internal note**, 500 characters, placeholder "Sponsor, dates, anything your team should know".
   - **Player limit**: "No limit | Limit to" with a number.
   - **The first Continue creates the draft** (`POST /admin/contests`) and replaces the URL with `/contests/:contestId/setup/games`. A name clash or invalid field keeps the step open with the error under the field.
   - Done when: a valid name and a type.
2. **Games.** G1's `PickerList` on the left (search, league, date range; upcoming games only); the selected games on the right with their tip-offs and a remove control, headed "3 games · first Sat Sep 27" ("No games picked yet." when empty). Continue saves the difference (adds, then removes). Not needed to continue; at least one is needed to publish. Done when: at least one game.
3. **Board.** The Board tab's content: the rules card and a pool section per game, everything shown by default, with a summary line per game when collapsed ("Bison @ Fighting Hawks · 84 props · 3 hidden"). Writes are immediate. With no games: "Add games first. The board uses the props from the games you pick." with "Go to Games". Trivia: the placeholder card. Done when: the contest has games (the default pool is a valid board).
4. **Prizes.** The ladder. "Add tier" opens the tier editor as a full-page sub-step (`/contests/:contestId/setup/prizes/new`, `/…/prizes/:tierId`); its "Back" returns to the ladder. Trivia: the placeholder card. Done when: at least one complete tier and none that needs details (bingo).
5. **Sponsors.** The placements grid, marked "Optional" in the rail. Done once visited.
6. **Review & preview.** Left, a checklist, each row linking to its step: "Name", "Contest type", "Games (3)", "Props (212 shown)", "Prize tiers (2 complete)", "Sponsors (4 placements)"; a row that blocks publishing shows its reason under it. Right, the preview frame with the screen switcher, rendering the unsaved state. "Publish" is disabled while any reason stands, with the reasons listed above the footer as plain sentences:
   - "Add at least one game."
   - "Every game in this contest has started. Add one that hasn't."
   - "Finish at least one prize tier."
   - "Finish or remove the prize tiers that need details."
   - "Trivia contests can't be published yet."

   **Publish** shows "Publishing…", then navigates to the contest page, which shows "Published. Fans can see it now." No toast. **Save draft** navigates to the contest page with its Draft banner (everything is already saved).

**Saving.** Basics saves on the first Continue, then on every Continue, Back, rail jump and Exit (PATCH with the precondition). Games saves on Continue. Board, Prizes and Sponsors write as they go through their own endpoints. A failed save keeps the step open with the error in place.

**Exit** keeps the draft and returns to `/games`, where the draft's card leads the list. Exit before the first Continue with a valid name creates the draft first, so typed work is never lost; with no valid name it simply leaves.

**Editing never reopens the builder.** A published contest is edited on its tabs. The only way back into the builder is "Continue setup" on a draft, which opens the first step that isn't done.

**Permissions.** Writers only. A member who opens a builder URL is sent to the contest page (or `/games` for `/contests/new`).

| Element | Copy |
|---|---|
| Header | "New contest", "Exit" |
| Rail | "Basics", "Games", "Board", "Prizes", "Sponsors", "Review & preview", "Optional" |
| Footer | "Back", "Continue", "Save draft", "Publish", "Publishing…" |
| Basics | "Name", "Rivalry Week", "Contest type", "Bingo", "Fans build a board of player props and win on bingos.", "Trivia", "Trivia isn't built yet. You can save this contest and come back.", "Description", "Fans see this on the contest card.", "Internal note", "Sponsor, dates, anything your team should know", "Only people in this console see the internal note.", "Player limit", "No limit", "Limit to", "players" |
| Games | "Search teams", "All leagues", "Any date", "3 games · first Sat Sep 27", "No games picked yet." |
| Board | "Bison @ Fighting Hawks · 84 props · 3 hidden", "Add games first. The board uses the props from the games you pick.", "Go to Games" |
| Review checklist | "Name", "Contest type", "Games (3)", "Props (212 shown)", "Prize tiers (2 complete)", "Sponsors (4 placements)" |
| Publish reasons | "Add at least one game.", "Every game in this contest has started. Add one that hasn't.", "Finish at least one prize tier.", "Finish or remove the prize tiers that need details.", "Trivia contests can't be published yet." |
| Result | "Published. Fans can see it now." |

### Staff: All contests (`/contests`)

The table stays ([`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), paged per [`admin-lists.spec.md`](admin-lists.spec.md)); its type column reads "Contest type". **A row opens the contest page** for that tenant: `/contests/:contestId?tenant=<slug>`, acting as that tenant, with the back link "All contests". **Each row carries "Finalize"** under the card's rule (published, not finalized, every game ended), absent otherwise. The staff tenant page's Contests table behaves the same way.

### Finalize, wherever it appears

Cards, the contest page header and rail, All contests rows and the tenant page rows open one centred dialog. Staff only; reverification first (the console's `useReverification`); the typed name is checked by the server.

| Element | Copy |
|---|---|
| Title | "Finalize Rivalry Week?" |
| Body | "Finalizing is permanent and cannot be undone. It marks the contest finished for every fan." |
| Input label | "Type “Rivalry Week” to confirm" |
| Buttons | "Finalize permanently", "Finalizing…", "Cancel" |
| Errors | "The contest name you typed doesn't match.", "Verification cancelled. Nothing was finalized." |
| Result (on the surface that opened it) | "Finalized." |

---

## Permissions

| Control | Tenant `org:admin` | Tenant `org:member` | OBS staff |
|---|---|---|---|
| See the list, the contest page, every tab, Preview | Yes | Yes (view-only presentation) | Yes, any tenant |
| New contest, the builder | Yes | No | Yes |
| Edit basics, entries, visibility, contest type (draft) | Yes | No | Yes |
| Add and remove games (lock permitting) | Yes | No | Yes |
| Board curation | Yes | No | Yes |
| Prize tiers, sponsor placements | Yes (their specs) | No | Yes |
| Publish, Duplicate, Delete draft | Yes | No | Yes |
| Finalize | No | No | Yes (reverified) |

Enforcement is server-side: every write passes `refuseReadOnlyWrite` first (D-063), which refuses a member and a paused workspace's own admins; Finalize passes `requireAdminReverified` and `refuseNonObsStaff`. The console's `useCanWrite` and `useIsObsStaff` only decide what renders.

---

## Endpoints

All under `/admin`, `requireAdmin`. Targeting as everywhere: a tenant caller's target is their own organization and any `?tenant=` is 403; OBS staff name the tenant with `?tenant=<slug>`. `:contestId` must belong to the target tenant, else **404** (not 403, which would confirm it exists elsewhere). Writes: `refuseReadOnlyWrite`. Contracts in `obs-b2b-shared/src/api/admin/contests.ts`.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/contests` | `requireAdmin` | Any resolved admin scope |
| GET | `/admin/contests/:contestId` | `requireAdmin` | Any resolved admin scope |
| GET | `/admin/contests/:contestId/games` | `requireAdmin` | Any resolved admin scope |
| GET | `/admin/games/candidates` | `requireAdmin` | Any resolved admin scope ([`admin-lists.spec.md`](admin-lists.spec.md); adds `contest=`) |
| POST | `/admin/contests` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| PATCH | `/admin/contests/:contestId` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/publish` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/duplicate` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff (drafts only) |
| POST | `/admin/contests/:contestId/games` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId/games/:betEventId` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff (lock permitting) |
| GET | `/admin/contests/:contestId/props` | `requireAdmin` | Any resolved admin scope |
| GET | `/admin/contests/:contestId/props/catalog` | `requireAdmin` | Any resolved admin scope |
| PUT | `/admin/contests/:contestId/props/:propId/override` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId/props/:propId/override` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/props/bulk` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/contest-props` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| PATCH | `/admin/contests/:contestId/contest-props/:contestPropId` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId/contest-props/:contestPropId` | `requireAdmin` + write gate | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/finalize` | `requireAdminReverified` + `refuseNonObsStaff` | OBS staff only (unchanged) |
| PUT | `/admin/contests/:contestId/games` | `requireAdmin` + write gate | Kept for the old screen until it retires; lock-checked (contest-safety) |

Neither the tier endpoints nor the placement endpoints are here: [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md).

### `GET /admin/contests`

The home's list, cursor-paged by [`admin-lists.spec.md`](admin-lists.spec.md).

Query: `cursor`, `limit` (default 20 here), `q` (contest name), `status` (`draft|upcoming|open|closed|finished`), `type` (`bingo|trivia`), `visibility` (`visible|hidden`), `sort` (`next|newest|players`, default `next`).

Order: **drafts lead every order** (they are the tenant's unfinished work), newest first by `_id`. Then published contests: `newest` by `publishedAt` descending (the keyset index); `next` by a game in play first, then the soonest upcoming tip-off, then contests with nothing upcoming by `publishedAt` descending; `players` by board count descending. `next`, `players` and the derived status filter are derived orders, computed over one tenant's contests (G1's bounded-candidate rule), never the client. The cursor carries the segment and position; every order ends in `_id`.

Response:

```ts
{
  contests: Array<{
    contestId: string;
    contestName: string;
    description: string | null;
    contestType: "bingo" | "trivia";
    status: { status: "Draft" | "Upcoming" | "Open" | "Closed" | "Finished"; stringStatus?: string };
    visible: boolean;
    closed: boolean;
    finalized: boolean;
    finalizedAt?: string;
    locked: boolean;
    lockedAt?: string;
    players: number;                 // board count
    maxParticipants: number;         // 0 = no limit
    games: { total: number; ended: number; live?: GameSummary; next?: GameSummary };
    prizeTierCount: number;
    banner: { sponsorId: string; name: string; imageUrl: string } | null; // contest-wide Board banner holder
    newPlayersByDay: number[] | null;  // 14 daily counts ending today; null before the first player
    newPlayersThisWeek: number;
    readyToFinalize: boolean;        // published, not finalized, every game ended
    updatedAt: string;
  }>;
  page: { nextCursor: string | null; total: number; limit: number };
}
// GameSummary = { betEventId: string; matchup: string; eventTime: string; league?: string }
```

Per-row aggregates (players, sparkline, tier count, banner) are computed for the page's rows only. Errors: 400 `cursor_stale` / `cursor_invalid` (the console restarts the list silently); 400 on an unknown filter value.

### `GET /admin/contests/:contestId`

The contest page's read. Returns the list row's fields plus `internalNote`, `publishedAt`, `createdAt`, `kpis: { boardsWithBingo, prizesAwarded, failedSends }`, `prizeTiers: { total, complete, needsDetails }`, `placementCount`, `props: { shown, hidden, locked }` per game summary, and `publishChecks: Array<{ key, message }>` (empty when publishable; drives the Review checklist and "Continue setup"'s first incomplete step). 404 for a wrong or foreign id.

### `GET /admin/contests/:contestId/games`

The Games tab. Cursor-paged; order: upcoming soonest first, then played newest first, then `_id`. Rows: `betEventId`, `matchup`, `eventTime`, `league`, `status` (`Upcoming|Live|Final`, the event's own status narrowed as before), `placements: { own: string[]; inheritsAllGames: boolean }`, `removable` (false once locked or finalized).

### `POST /admin/contests`

Creates a **draft**. Body: `{ contestName, contestType?, description?, internalNote?, maxParticipants? }`. Defaults: bingo, no limit, no games, `showContest: false`, `publishedAt: null`, `ranAtBetEvents: []`.

- Validation (400, `errors.<field>`): name 1–80 after trim; description ≤300; internal note ≤500; limit 0–1,000,000; type in the enum.
- Name clash in the tenant, ignoring case and surrounding space → 409 `name_taken`.
- Audited `contest_create` (contest id, contest type) before the response; a failed audit write is logged and does not undo the contest.
- Responds **201** with the contest in the `GET /admin/contests/:contestId` shape.

### `PATCH /admin/contests/:contestId`

Body: any of `{ contestName, description, internalNote, maxParticipants, visible, closed, contestType }` plus `expectedUpdatedAt`. Only present keys change; `null` or `""` clears `description` or `internalNote`. An empty edit is a 400.

- `finalized` → 409 `contest_finalized` ("This contest is finalized, so its settings can't change."). "Not finalized" is part of the write filter, so a finalize landing mid-request refuses the write too.
- The precondition and the write are one filter; a stale edit → 409 `stale_contest` and nothing changes.
- `visible` on a draft → 409 `not_published` ("Publish the contest to show it to fans.").
- `contestType` on a published contest → 409 `not_draft` ("The contest type can't change after publishing."); on a locked contest → 409 `contest_locked` (kind `gameType`).
- Name clash → 409 `name_taken`.
- Lowering the limit below the board count is allowed.
- Audited `contest_update` with the changed field names and the new `closed`/`visible` values, never free text.
- Responds with the contest and `changes.fields`.

### `POST /admin/contests/:contestId/publish`

Body `{ expectedUpdatedAt }`. Runs the publish checks in order and refuses with **409 `publish_blocked`** and `reasons: [{ key, message }]` if any fail:

| Key | Fails when | Message |
|---|---|---|
| `trivia` | `contestType` is trivia | "Trivia contests can't be published yet." |
| `no_games` | No games | "Add at least one game." |
| `all_started` | Every game's tip-off has passed | "Every game in this contest has started. Add one that hasn't." |
| `no_complete_tier` | Bingo with no complete tier | "Finish at least one prize tier." |
| `tier_needs_details` | Any tier needs details | "Finish or remove the prize tiers that need details." |

On success sets `publishedAt: now` and `showContest: true` in one write (filter: `publishedAt` null, precondition), audited `contest_publish`. Publishing a published contest is a 200 no-op. Responds with the contest.

### `POST /admin/contests/:contestId/duplicate`

No body. Creates a draft as described under the contest page (name "Copy of <name>", made unique and trimmed to 80). Tiers are new documents; placements, overrides and tenant props are copied for the all-games scope and for the games carried over (those not started). Audited `contest_duplicate` with the source id. Responds **201** with the new contest.

### `DELETE /admin/contests/:contestId`

Query `expectedUpdatedAt`. Drafts only: a published contest, or one holding any board, → 409 `not_draft` ("Only a draft can be deleted. Hide the contest instead."). Audited `contest_delete` **before** the delete (a failed audit refuses the delete, as tenant delete does). Deletes the contest, the tier documents only it references, its placements, overrides and tenant props. Responds **204**.

### `POST /admin/contests/:contestId/games`

Body `{ betEventIds: string[], expectedUpdatedAt }`. Adds to `allowedBetEvents` and `ranAtBetEvents` in one update. Distinct ids; every id must name a reference game (400 listing unknown ids); a game whose tip-off has passed → 400 with "<matchup> has already started."; ids already in the contest are ignored. Finalized → 409 `contest_finalized`. Allowed on a locked contest. Audited `contest_games_add` (count). Responds with the contest and `changes.added`.

### `DELETE /admin/contests/:contestId/games/:betEventId`

Query `expectedUpdatedAt`. Removes the game from `allowedBetEvents` (never from `ranAtBetEvents`). Locked → 409 `contest_locked` with kind `gameRemoved` (G2's `gameLockViolations`, with the not-locked condition in the write filter so a first fan landing mid-request refuses it). A game not in the contest → 404 ("That game isn't part of this contest."). Finalized → 409 `contest_finalized`. The game's placements and curation stay, dormant. Audited `contest_games_remove`. Responds with the contest and `changes.removed`.

### `GET /admin/contests/:contestId/props`

Query: `game` (required, one of the contest's games), `cursor`, `limit` (default 50), `q` (player name), `filter` (`all|shown|hidden|locked|added`). Order: player name, market, line ascending, `_id`.

Rows: `{ propId, source: "feed" | "added", player: { entityId, name, team }, market, outcomeType, line, feedLine?, displayOverride?, hidden, locked, lockedByFeed, out, onBoards: boolean }`. Plus `counts: { total, hidden, locked }` for the section header and `game: { started, final }`. `onBoards` is computed for the page's rows only.

### `GET /admin/contests/:contestId/props/catalog`

Query `game`. The Add prop form's options: `players: [{ entityId, name, team, markets: string[] }]`, where markets are those the feed carries for that player in that game. A roster is bounded (tens of players), so this is one read, not a paged list.

### `PUT` / `DELETE /admin/contests/:contestId/props/:propId/override`

PUT body: any of `{ hidden, locked, lineOverride, displayOverride }` (feed props). Field-level: only sent fields change, last write wins per field, and no contest precondition, so two operators curating different props never refuse each other. Curation writes never advance the contest's `updatedAt`. DELETE resets the prop to its defaults (not allowed while `source` is `out`; use bulk `in`).

Refusals: the prop isn't a feed prop of one of the contest's games → 404; the game has started → 409 `game_started` ("This game has started, so its props can't change."); `lineOverride` or a delete-equivalent on a prop any board holds, after the lock → 409 `contest_locked` kind `propLine`; `unlock` on a feed-locked prop → 400; validation → 400 (`errors.lineOverride`: "Enter a line from 0.5 to 999.5." or "J. Smith already has a Points prop at 24.5."; `errors.displayOverride`: "Keep it to 40 characters."). Finalized → 409 `contest_finalized`.

### `POST /admin/contests/:contestId/props/bulk`

Body `{ betEventId, scope: { kind: "player", entityId } | { kind: "game" }, action: "hide" | "show" | "lock" | "unlock" | "out" | "in" }`. Applies to feed and tenant props in scope, in one write per collection. `out` sets `source: "out"`, `hidden: true` and `outAt`; `in` is refused once the game has started (409 `game_started`). Every action except `out` is refused on a started game. `out` is refused once the game is final. Responds with the updated `counts` and the number of props changed. Audited `contest_board_update` (game, scope kind, action, count), one row per request; single-prop writes audit the same action with count 1.

### `POST` / `PATCH` / `DELETE /admin/contests/:contestId/contest-props[/:contestPropId]`

POST body `{ betEventId, entityId, market, outcomeType, line?, displayOverride? }`. Validation: the game is one of the contest's and hasn't started (409 `game_started`); the player is on its roster and the market is one the feed carries for them (400 `errors.market`: "Pick a market this player has props for."); Over needs a line, Manual takes none; no duplicate rung (400 `errors.line`). Responds **201** with the row. PATCH takes `line`, `displayOverride`, `hidden`, `locked` under the same rules as overrides, including `propLine`. DELETE refuses a prop any board holds (409 `contest_locked`, kind `propLine`: "Fans have this prop on their boards, so it can't be deleted. Hide it instead.").

### `POST /admin/contests/:contestId/finalize`

Unchanged ([`admin-obs-internal.spec.md`](admin-obs-internal.spec.md)): body `{ confirmName }`, `?tenant=`, reverified, staff only, audited `contest_finalize` before the write, sets `finalized` and `finalizedAt`. 400 when the name doesn't match ("The contest name you typed doesn't match."), 409 when already finalized (the console re-reads and shows the finalized state). Only its callers change: the card, the contest page, All contests rows and the tenant page.

### Error codes and what the console shows

| Code | Status | Console shows |
|---|---|---|
| `errors.<field>` | 400 | The message under that field. |
| `name_taken` | 409 | "Another contest in this workspace already has this name." under Name. |
| `stale_contest` | 409 | "This contest changed while you were editing, so nothing was saved. Reload to see the current version and make your change again." with "Reload". |
| `contest_finalized` | 409 | "This contest is finalized, so its settings can't change." and a re-read. |
| `contest_locked` | 409 | "This can't change after the first fan joins." under the field (the specific sentences above where a whole list is locked), and a re-read. |
| `game_started` | 409 | "This game has started, so its props can't change." |
| `not_published` | 409 | "Publish the contest to show it to fans." |
| `not_draft` | 409 | "The contest type can't change after publishing." or "Only a draft can be deleted. Hide the contest instead." |
| `publish_blocked` | 409 | The reasons, as sentences, above the builder footer. |
| (write gate, member) | 403 | "Only organization admins can change contests." |
| (write gate, paused) | 403 | "This workspace is paused. Changes are turned off until Overboard resumes it." |
| (unknown or foreign id) | 404 | "Contest not found." on the page; "That game isn't part of this contest." for a game. |
| `cursor_stale`, `cursor_invalid` | 400 | Nothing: the list restarts from the top. |

### Changes to existing endpoints

- **`GET /admin/games`** stays for the old screen and is retired with it. `GET /admin/games/candidates` (G1) takes `contest=<id>` to leave out that contest's games.
- **`PUT /admin/contests/:contestId/games`** keeps working for the old screen, with G2's lock check.
- **Fan reads** (`GET /b2b/contest/list-contests`, `GET /b2b/contest/:contestId`) move to the allowlisted projection, drop drafts, and apply the curation.
- **`POST /b2b/board/generate`** refuses drafts (404) and builds from the curated pool.

---

## Migration

`node-server/scripts/contest-console-migration.mjs`, dry run by default, `--apply` to write, dev-only rails like every other script, idempotent (a second run finds nothing and says so). Runs after contest-safety's migration.

1. **The note.** For every contest with `contestDescription`: `internalNote = contestDescription`, then unset `contestDescription`. `description` is left absent. Reason: the console promised "Only people in this console see the note."
2. **Published or draft.** A contest whose `showContest` is true or absent, **or** that holds any board, gets `publishedAt = createdAt` (the `_id` timestamp where `createdAt` is missing). Every other contest (hidden and never joined) gets `publishedAt: null` and becomes a Draft, which is what it always was to fans. `showContest` itself is unchanged, so a hidden contest with boards reads Hidden.
3. **Contest type.** `contestType = gameType ?? "bingo"`, then unset `gameType`.
4. **The list index** `{ organizationId: 1, publishedAt: -1, _id: -1 }` and the override and tenant-prop indexes, created after the writes. Creating an existing index is a no-op.

**Deploy order.** The fan reads' allowlist and the admin contract ship in the same release as the migration: before it, old notes would reach fans as descriptions; after it, readers still on `contestDescription` would read nothing. `contestTypeOf()` reads `contestType ?? gameType ?? "bingo"` so a reader deployed first keeps working.

---

## Contest types: groundwork for the second game

`GAME-F1`: the type lives on the contest. `CONTEST_TYPES = ["bingo", "trivia"]` in shared; the console reads vocabulary from `src/lib/contestTypes.ts`; new wire fields stay type-neutral. Deliberately left for the trivia build, unchanged from the 2026-09-23 version: the `*_bingo_*` collection names; the board's nine named cells and the evaluator's eight lines; tiers keyed on `threeInARows` (the second game needs a type-neutral threshold or its own tier fields); "bingo" in existing wire fields and CSV columns; the fan app's bingo-shaped routes; the prize pipeline's `threeInARows` match.

## The difficulty knob (`GAME-02`, `GAME-03`)

Kept: `threeInARows` (bingos to win, 1–8) is the difficulty target. A read-out of how often past boards reached each count belongs beside the tier editor's bingos-to-win control ([`admin-prizes.spec.md`](admin-prizes.spec.md)) and is recorded, not built.

## Dev fixtures

Kept: `seed-test-tenant.mjs` keeps "Test Tenant — This Week" re-pointed at the current week, the two archived test contests renamed, and "Test Tenant Bingo" as it is. After the migration, fixtures carry `publishedAt` and a `description` written for fans ("Pick your players for this week's games and chase a bingo."), and one fixture draft ("Test Tenant — Draft") exists so the Draft card and banner can be seen.

---

## Rules

1. **`CT-01` — A control exists only if the fan side honours it.** No entries-per-fan, no two-teams, no multiplier, no grid, no free square. The Trivia placeholder is the one sanctioned exception.
2. **`CT-02` — Contests start as drafts.** A draft is invisible to fans by construction; publish is one-way; drafts are the only contests that can be deleted.
3. **`CT-03` — Publish is gated.** Bingo needs a game that hasn't started and a complete tier with none needing details; Trivia cannot publish.
4. **`CT-04` — Status is derived, never stored.** `getB2BContestStatus` with Draft first; the console renders it and never recomputes it.
5. **`CT-05` — The description is for fans; the internal note never leaves the console.** Fan reads use an allowlisted projection.
6. **`CT-06` — The contest type is a contest property, fixed at publish and locked at the first board.**
7. **`CT-07` — A contest locks at its first board and never unlocks.** The lock table above, decided in shared, enforced by the server, shown read-only in the console.
8. **`CT-08` — Removing a game locks with the contest; adding never does.**
9. **`CT-09` — Curation is per contest and per game, stored as overrides and tenant props.** Shared prop data is never written.
10. **`CT-10` — A started game's pool is read-only, except Mark out until the game is final.** A line fans hold never changes.
11. **`CT-11` — Board customisation is exactly the B2C admin's prop pool curation.** Nothing B2C lacks, nothing that has no effect in a bingo-count game.
12. **`CT-12` — Every growing list pages on the server with a cursor.** The contest list, the games tab, the prop pool and the game picker.
13. **`CT-13` — Finalize is staff only and appears only when every game has ended**, on cards, the contest page and staff rows, hidden rather than disabled otherwise.
14. **`CT-14` — Participation is the board count.** `numberParticipants` is never read.
15. **`CT-15` — Contest names are unique within a tenant, ignoring case.**
16. **`CT-16` — `ranAtBetEvents` only grows.**
17. **`CT-17` — Every refusal carries one plain sentence, and the console shows that sentence where the change was attempted.** No toasts, no spec IDs, no vendor words.

## Known gaps (recorded, not blocking)

- **Entries after the lock** — the open question above.
- **Multi-entry** needs the index change and fan-app support before a control can exist.
- **Line drift from the shared data.** Boards reference feed props live; an upstream edit to a feed line still changes existing boards (contest-safety, Known gaps). Overrides protect only lines the tenant set.
- **The evaluator's sweep** (60 seconds during play) delays hits on overridden lines and tenant props by up to a minute compared with feed hits; a progress event from the publisher would remove the delay and is out of B2B's hands.
- **Name uniqueness is check-then-write.** Two creates to one name in the same instant can both succeed; a normalized-name unique index is the fix if it ever matters.
- **Player-limit enforcement is count-then-insert.** Two fans at the last place in the same instant can both join; an atomic counter is the fix if a sponsor needs a hard cap.
- **`numberParticipants` is dead data**, left in place and read by nothing.
- **The difficulty read-out** is recorded, not built.
- **The preview contract is settled** between S1 and S2 (the interface file, 2026-09-24), apart from one open ask about tiers' resolved `providedBy`; the Preview tab and the builder's mini preview follow [`admin-preview.spec.md`](admin-preview.spec.md). The contract's `contestDescription`/`gameType` are sent beside this spec's `description`/`contestType` until the fan app reads the new names.
- **Audit coverage.** Games adds and removes and board curation are audited from this spec on; tier writes' audit is [`admin-prizes.spec.md`](admin-prizes.spec.md)'s.

## References

- PRD: [`ADM-03`, `ADM-04`, `ADM-06`, `BRAND-02`, `BRAND-04`, `GAME-01`–`GAME-04`, `GAME-C1`, `GAME-F1`, `PRIZE-03`, `TEN-05`, `TEN-C1`, `ADM-09`](../../../documents/PRD/OBS_B2B_Platform_PRD.md), and its "Revision notes (2026-09-24)"
- [`admin-surface.spec.md`](admin-surface.spec.md) — access, reverification, principles, Rule 13
- [`contest-safety.spec.md`](contest-safety.spec.md) — the lock, the snapshot, the unique board index
- [`admin-lists.spec.md`](admin-lists.spec.md) — cursor paging and the list components
- [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md), [`admin-preview.spec.md`](admin-preview.spec.md)
- [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the superseded games half, kept as history
- [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — All contests, Finalize
- [`admin-game-day.spec.md`](admin-game-day.spec.md) — readiness dots and phases reused on the Overview rail and the Finalize rule
- Research (workspace): `artifacts/review-2026-09-24/contests-engine-fanapp.md`; the S1 B2C bingo verification (2026-09-24) behind the parity table
- `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` (workspace) — the preview contract
- Rulings: Arthur, 2026-09-24 (`artifacts/wave-2026-09-24/WAVE-RULES.md`, "Arthur's rulings"); D-059, D-063, D-068
