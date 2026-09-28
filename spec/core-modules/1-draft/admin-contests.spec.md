# Core Module Spec: Admin — Contests

**Implements:** PRD `ADM-03`, `ADM-04`, `ADM-06` (where Finalize appears, not what it does), `GAME-01`, `GAME-04`, `BRAND-02`/`BRAND-04` (the "which games" half), and the data-model constraint `GAME-F1`. Narrows `TEN-05` further: a contest is recurring configuration, never onboarding-time setup. `GAME-02`'s tiers are per contest, not per game (ruling 2026-09-24; see the PRD's revision notes).

**Depends on:**

- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) (Wave 3). It owns the backend meaning of everything this spec puts on screen: every sport in the picker and its `sports` feed (§2), the stored state Draft → Open → Closed and its transitions (§3.1), contest deletion (§3.2), `featuredGame` (§3.3), the join refusal codes and `opensAt` (§3.4), and dev test mode (§5). This spec builds the console on top of those semantics and does not redefine them.
- [`admin-surface.spec.md`](admin-surface.spec.md): scope resolution, the write grant (tenant `org:admin` and OBS staff), the reverification list, pages versus drawers, and the principles, above all Honesty by omission (Rule 13).
- [`contest-safety.spec.md`](contest-safety.spec.md): the lock stamp `lockedAt`, the pure lock functions in `obs-b2b-shared`, the prize snapshot and the one-board-per-fan index.
- [`admin-lists.spec.md`](admin-lists.spec.md): the cursor-paging convention, `InfiniteList`/`InfiniteTable`/`PickerList`, and the schedule picker's `GET /admin/games/candidates`.
- [`admin-prizes.spec.md`](admin-prizes.spec.md): the prize library, the contest Prizes tab's ladder, and what makes a tier complete. [`admin-sponsors.spec.md`](admin-sponsors.spec.md): the Sponsors tab.
- [`admin-preview.spec.md`](admin-preview.spec.md) and [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md): the Preview tab and the builder's Review preview.
- [`admin-uploads.spec.md`](admin-uploads.spec.md): the one upload field, wherever a contest screen takes an asset.

**Supersedes:** the games half of [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md): the `/games` screen (per-contest cards with games tables, the per-game drawer), `GET /admin/games` as that screen's read, the games PUT as its write, and "What the data model actually is" as a description of the console. Also this spec's own 2026-09-23 version: the create drawer, the contest detail drawer, the "Note" field and "no contest delete". The prizes half of admin-games-and-prizes goes to [`admin-prizes.spec.md`](admin-prizes.spec.md).

**Status:** Draft. Written 2026-09-23 for the Games & Contests overhaul; rewritten 2026-09-24 for the console redesign.
Revised 2026-09-27 for Wave 4 (Arthur's rulings of 2026-09-27): the Board tab, the builder's Board step and all prop pool curation are removed; the stored state Draft → Open → Closed replaces visibility, entries and the derived Draft; any non-finalized contest can be deleted; the builder keeps the console sidebar and moves its steps to a clickable progress bar with Save draft on every step; the home gains a list view and a type filter fed by the contest-type registry; the game picker always shows its sport filter.

## Overview

Until the redesign a contest lived on a card inside a long `/games` page, was created in a five-field drawer, and was edited in a second drawer that could show its prize tiers and sponsors but not change them. The card listed every game the contest ran at inline, so a season-long contest made a page tens of thousands of pixels tall. Prize tiers were edited on another screen, sponsor placements on a third, and the fan-facing result could not be seen anywhere. The one free-text field was labelled console-only while the fan wire sent it to every fan. Nothing stopped an operator from removing a game or re-counting a prize tier mid-game.

**The whole change, in one line:** one place per contest, from a draft built step by step to a finished contest, where everything a fan plays under is set, previewed on the real fan app, and then locked once a fan has joined.

**In scope:**

- The contest model's console fields (`description`, `internalNote`, `contestType`) on top of Wave 3's stored `state`, and the list index.
- The lock as the console shows it.
- Screens: Games & Contests (`/games`) in card and list views, the contest page (`/contests/:contestId` and its tabs), the builder (`/contests/new`, `/contests/:contestId/setup/:step`), the state controls, Delete, Finalize wherever it appears, and the row behaviour of staff All contests.
- Endpoints: the cursor-paged contest list, the contest read, the preview read, create, edit, publish, duplicate, add and remove games, and Finalize's placement. Delete's server side is Wave 3's (§3.2); this spec places it.
- The migration from today's data.
- Contracts in `obs-b2b-shared/src/api/admin/contests.ts` (new; the contest schemas move there from `api/admin/games.ts`, which keeps the old games read until it retires).

**Not in scope:**

- **Props, in any form.** Tenants don't choose props and don't see them in the console (ruling 2026-09-27; a read-only view of each game's props was also ruled out for Wave 4). The board draws from every visible prop the Prop Entry System (PES) publishes for the contest's open games, exactly as Wave 3 left it. No board rules, no pool, no overrides, no tenant-added props.
- **Prize tiers and the prize library.** [`admin-prizes.spec.md`](admin-prizes.spec.md). The Prizes tab and the builder's Prizes step host its ladder; this spec only places it.
- **Sponsor records and placements.** [`admin-sponsors.spec.md`](admin-sponsors.spec.md). The Sponsors tab and step host it.
- **The preview frame.** [`admin-preview.spec.md`](admin-preview.spec.md) (console) and [`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) (fan app).
- **Fan-side board building** (drafting players, generating the board). Wave 3 (§3.3) and the fan app own it. This spec references it only in the lock rules and the Preview.
- **What Finalize does.** Unchanged: [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) owns `POST /admin/contests/:contestId/finalize`. This spec moves where the button appears.
- **Trivia itself.** The type exists as a selectable placeholder; its entry model, scoring and settings belong to the trivia build.

---

## Vocabulary

Screens use these words and no others. Code names are in the model section.

| Term | Meaning | Never say |
|---|---|---|
| **Contest** | What a tenant creates and fans join. Spans one or more games, has a contest type, prize tiers and sponsor placements. | "activation", "event" |
| **Game** | A scheduled real game from the shared schedule, selected into a contest. | "bet event", "matchup" as a noun for the record |
| **Sport** | The game's league as the schedule names it (NFL, CFB, NBA, NHL, MLB…). | "category" |
| **Contest type** | Bingo or Trivia. | "game type" |
| **Description** | Up to 300 characters fans see on the contest card. | "note", "summary" |
| **Internal note** | Up to 500 characters only the console shows. | "note" on its own |
| **Draft / Open / Closed** | The contest's state. Draft: fans can't see it. Open: fans see it and can join while a game's entries are open. Closed: fans see it under Past and keep playing their boards, and nobody new can join. | "hidden", "visible", "unpublished", "paused" |
| **Publish** | Draft → Open. | "launch", "go live" |
| **Close entries / Reopen entries** | Open → Closed and back. | "pause", "hide" |
| **Move to draft** | Back to Draft, only before the first fan joins. | "unpublish" |
| **Locked** | The contest has at least one fan board. Not a state. | "frozen", "live" |
| **Finalized** | Staff only; ends a contest permanently. Shown as a badge, not a fourth state. | "settled" |

---

## The model

### `B2BContest`, field by field

Collection `{prefix}contests` (`obs-b2b-shared/src/models/b2b.ts`, interface `interfaces/b2b/B2BContest.ts`). Fields this spec adds are marked "new"; `state` and `testMode` are Wave 3's.

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `organizationId` | ObjectId → `B2BOrganization` | yes | — | The tenant. Every read and write filters on it. |
| `contestName` | string | yes | Trimmed, 1–80 characters, unique within the tenant ignoring case | The typed confirmation for Delete and Finalize, which is why uniqueness matters. Clash → 409 `name_taken`. |
| `description` (new) | string | no | Trimmed, ≤300 characters; empty string stored as absent | Fan-facing, on the contest card. Starts empty on every existing contest (see Migration). |
| `internalNote` (new) | string | no | Trimmed, ≤500 characters | Console only. Never on any fan wire (the fan reads' allowlist below). Holds what `contestDescription` held. |
| `contestType` (new; replaces `gameType`) | one of the contest-type registry's keys | yes | A registry key | Read through `contestTypeOf()`, which answers `contestType ?? gameType ?? "bingo"` during the migration window. Changeable only while Draft and unlocked. |
| `state` | `"draft" \| "open" \| "closed"` | yes | Wave 3 §3.1 | Stored. Read through `contestState()`. Default `draft`. |
| `showContest`, `closed` | boolean | — | Kept consistent with `state` by every writer (Wave 3 §3.1) | Legacy mirrors for older readers. No console control writes them directly. |
| `allowedBetEvents` | ObjectId[] → `BetEvent` | — | Distinct; each must exist in the reference schedule | The games the contest runs at now. |
| `ranAtBetEvents` | ObjectId[] | no | Only grows | Every game the contest has ever run at; read through `ranAtBetEventIds()`. |
| `maxParticipants` | integer | yes | 0–1,000,000 | 0 = no limit. Lowering below the board count removes nobody. |
| `lockedAt` | Date | no | Written by the board endpoint only ([`contest-safety.spec.md`](contest-safety.spec.md)) | The first board's moment. The console never writes it. |
| `finalized`, `finalizedAt` | boolean, Date | no | Written by Finalize only | Permanent. |
| `prizeTiers` | ObjectId[] → `B2BPrizeTier` | — | [`admin-prizes.spec.md`](admin-prizes.spec.md) | Each tier names a library prize. |
| `testMode` | boolean | no | Wave 3 §5; set only through the dev route | Honoured only where the dev gate is open. |
| `maxEntriesPerPerson` | number | yes | Fixed at 1 | No control. The unique board index makes one board per fan per contest a database fact. |
| `twoTeamsNotRequired` | boolean | no | Fixed at false | No control. |
| `numberParticipants` | integer | yes | — | Dead. Nothing increments it and nothing reads it. Players are the board count. |
| `createdAt`, `updatedAt` | Date | — | — | `updatedAt` is the optimistic-concurrency token (`expectedUpdatedAt`). A fan's join never advances it. |

Removed by the migration: `contestDescription` (moved to `internalNote`), `gameType` (moved to `contestType`).

**No `publishedAt`.** S1's design derived Draft from a `publishedAt` stamp. The stored `state` makes that redundant: Draft is a state, the Newest sort orders by creation (`_id`), and nothing else needed the stamp. It is not added.

### State and status

Two different things, and the console keeps them apart:

- **State** (stored, Wave 3 §3.1) is what the operator sets: Draft, Open or Closed. The console's chips, filters and controls speak state.
- **Fan status** (derived, `getB2BContestStatus`) is what a fan sees: Upcoming, Open, Closed or Finished, depending on the games' entry windows. The console never shows it as a chip. It shows its one useful consequence as a line: an Open contest whose entries haven't opened yet reads "Fans can join from Fri, Oct 2 · 5:48 PM" (the server's `opensAt`, in the operator's time), because "Open" alone would suggest fans can join now.

**Everywhere in the console, contests speak state.** Cards, list rows, the contest page, the staff All contests table, the staff tenant page's Contests table and Operations show Draft, Open or Closed with the Finalized badge. "Upcoming" and "Hidden" are not console chips anywhere; an Open contest whose entries haven't opened carries the "Fans can join from…" line instead.

**Finalized** is a badge beside the state chip ("Finalized"), never a state. A finalized contest is always Closed or Open as it was stored; the console reads it as read-only everywhere.

### Transitions and where they live

Transitions are Wave 3's (§3.1). The console offers exactly these, and only where the transition is allowed:

| From | Action | To | Offered when |
|---|---|---|---|
| Draft | **Publish** | Open | Every publish check passes (below). Lives on the builder's Review step; the Overview's state card links there. |
| Open | **Close entries** | Closed | Not finalized |
| Closed | **Reopen entries** | Open | Not finalized |
| Open or Closed | **Move to draft** | Draft | Not locked, not finalized |

An action that isn't allowed is absent, not disabled (D-059).

### Publish checks

Checked by the server on every move into Open from Draft (`PATCH` with `state: "open"`, or create with `state: "open"`), refused with **409 `publish_blocked`** and `reasons: [{ key, message }]`:

| Key | Fails when | Message |
|---|---|---|
| `trivia` | The contest type isn't playable yet | "Trivia contests can't be published yet." |
| `no_games` | No games | "Add at least one game." |
| `all_started` | Every game has started (a test-mode contest is exempt, Wave 3 §5) | "Every game in this contest has started. Add one that hasn't." |
| `no_complete_tier` | Bingo with no complete tier ([`admin-prizes.spec.md`](admin-prizes.spec.md) defines complete) | "Finish at least one prize tier." |
| `tier_needs_details` | Any tier needs details | "Finish or remove the prize tiers that need details." |

Nothing about props: whether a game has players yet is the fan side's refusal (`no_players_yet`, Wave 3 §3.3), not a publish check.

### Description and the internal note

Today's "Note" (`contestDescription`) was labelled "Only people in this console see the note." while the fan reads sent it to every fan. The ruling makes the field fan-facing. Exposing old notes would break the promise the console made when they were written, so the migration moves every existing note to `internalNote`, and `description` starts empty everywhere. Both fan reads switch to an allowlisted projection in the same change: `description` goes out, `internalNote` never does.

**The current fan app shows the description.** Today's fan app renders no contest description anywhere. Wave 4 adds it to the current app's contest card (under the date line, two lines, muted, omitted when empty) and under "Draft Your Squad"'s subtitle, so the console's "Fans see this on the contest card." is true and the Preview can show it. This is a one-line addition to existing screens, not part of the parked overhaul.

### Contest types: the registry

`contestType` lives on the contest, never on the tenant (`GAME-F1`). The types come from **one registry** in shared, `obs-b2b-shared/src/interfaces/b2b/contestTypes.ts`:

```ts
export const CONTEST_TYPE_REGISTRY = {
  bingo:  { label: "Bingo",  playable: true,  thresholdUnit: { one: "bingo", other: "bingos" } },
  trivia: { label: "Trivia", playable: false, thresholdUnit: null },
} as const;
export type ContestType = keyof typeof CONTEST_TYPE_REGISTRY;
export const CONTEST_TYPES = Object.keys(CONTEST_TYPE_REGISTRY) as ContestType[];
```

Everything that lists types reads the registry and nothing else: the home's Type filter, the builder's type cards, the contest type field, the list endpoint's `type` validation, and the console's vocabulary helper (`src/lib/contestTypes.ts`, renamed from `gameTypes.ts`). Adding a type is adding a registry entry; no screen hardcodes a chip.

**Trivia** is the one placeholder D-068 allows (Arthur's 2026-09-24 clarification): `playable: false`. Wherever Trivia settings would go, the console shows one muted card, "Trivia isn't built yet. You can save this contest and come back.", and Publish is refused (`trivia`). When trivia lands, its entry flips to `playable: true` and gains its threshold unit. Board generation keeps refusing a non-bingo contest (`not_playable_here`).

The type can change only while the contest is a Draft and unlocked. The server refuses a type change otherwise (409 `not_draft`, or 409 `contest_locked` kind `gameType`).

### Indexes

Connectors run with `autoIndex: false`; indexes are declared on the models and created per environment by the index script.

| Collection | Index | Why |
|---|---|---|
| `contests` | `{ organizationId: 1, state: 1, _id: -1 }` | The list: drafts lead, the state filter, Newest by `_id`. Also serves every tenant-scoped contest read. |
| `bingo_boards` | `{ contestId: 1, clerkUserId: 1 }`, unique | One board per fan per contest ([`contest-safety.spec.md`](contest-safety.spec.md)). Also serves player counts and the sparkline. |

Name uniqueness stays check-then-write (Known gaps).

### What the fan side honours

Wave 3 owns the checks and their codes (§3.1, §3.4): a draft answers 404 to fans, a closed contest refuses joins with `closed`, a full one with `full`, a non-playable type with `not_playable_here`, a game with no players yet with `no_players_yet`, and entries not yet open with `not_open_yet` plus `opensAt`. Every control on these screens maps to one of those.

Both fan reads (`GET /b2b/contest/list-contests`, `GET /b2b/contest/:contestId`) return the allowlisted projection only: `contestId`, `contestName`, `description`, `contestType`, the fan status, games, the fan fields of prize tiers. `internalNote`, `state` internals, `lockedAt`, `testMode` and audit-relevant fields never leave the admin surface.

---

## The lock

The ruling: no contest versioning; before the first fan joins everything is editable, and after it the things fans play and win under lock. [`contest-safety.spec.md`](contest-safety.spec.md) builds the stamp (`lockedAt`), the refusals (`409 contest_locked`) and the pure functions both sides call (`contestIsLocked`, `gameLockViolations`, `tierLockViolations`, `gameTypeLockViolations`). This section is the console's contract with it. This spec adds **no lock kind**: `CONTEST_LOCK_KINDS` stays `gameRemoved`, `tierRemoved`, `tierBingos`, `tierValue`, `gameType`.

### What stays editable and what locks

| Setting | Before the first board | After |
|---|---|---|
| Name, description, internal note, player limit | Editable | Editable |
| Close entries, Reopen entries | Editable | Editable |
| **Move to draft** | Offered | **Absent** (fans can't have a contest they played hidden from them, Wave 3 §3.1) |
| Adding games | Editable | Editable |
| **Removing a game** | Editable | **Locked** |
| **Contest type** | Editable while Draft | **Locked** |
| Prize tiers | [`admin-prizes.spec.md`](admin-prizes.spec.md) | Its tier kinds (`tierRemoved`, `tierBingos`, `tierValue`) |
| **Delete** | Typed name | Typed name **and reverification** (Wave 3 §3.2) |

**Why removing a game locks.** A fan's board holds props from the games the contest ran at when they built it. The evaluator scores a square by its prop, not by whether the contest still lists the prop's game, so squares from a removed game keep scoring and keep paying. Removing a game after fans joined therefore does not remove it from play; it only removes it from the console, which then misreports what fans are playing. Locking is the one option that keeps every promise. Adding a game stays open because it only gives fans more to pick from.

### How the console shows it

- **The glyph.** A lock glyph beside the state chip on the card, the list row, the contest page header and the staff rows, with the tooltip "Locked since the first fan joined. Games can't be removed, and the contest type and existing prize tiers can't change."
- **Locked controls read as values** with one plain line where the control was (D-059: never a disabled control that might wake up). Games tab: `CONTEST_LOCK_COPY.gameRemoved`, "Fans have joined this contest, so its games can't be removed. You can still add games."
- **A 409 `contest_locked` from a write** (the lock landed between loading and saving) renders as an inline error under the field that was being saved, using the refusal's own sentence. The page then re-reads the contest so every other locked control turns into its value.
- **One wording.** `CONTEST_LOCK_COPY` in shared is the source; the console never writes its own lock sentences.

---

## The screens

Visual language is the console's existing one, built from its tokens only: segmented controls, never switches. Inline confirmation lines, never toasts. Muted-sentence empty states. KPI tiles with the hue outline. Numbers in the display face with tabular digits. Every asset field is the console's upload field ([`admin-uploads.spec.md`](admin-uploads.spec.md)).

### `/games` — Games & Contests

**Header.** Eyebrow "Games"; H1 "Games & Contests" (set in uppercase by the headline style); right: the primary action "New contest" for anyone who can write. The action opens `/contests/new`.

**Toolbar** (G1's sticky list toolbar), two rows:

1. Search over contest names ("Search contests by name"). On the right: **Sort** (select: "Next game first", "Newest first", "Most players"; default "Next game first") and the **view toggle** beside it, a segmented "Cards | List" with icons.
2. **Status**: segmented "All · Draft · Open · Closed". Finalized contests sit under Closed with their Finalized badge. **Type**: segmented "All" plus one segment per registry type, generated from `CONTEST_TYPE_REGISTRY` (today "Bingo", "Trivia"); it grows when a type is added. On the right, the count: "12 contests".

Search, filters and sort live in the URL (`/games?q=&state=&type=&sort=`), so Overview and Operations can link straight into a filtered list. Changing any of them restarts the list from the top. The **view** does not live in the URL: it is remembered per user in local storage under `obs.contests.view.<userId>` (`cards` or `list`, default `cards`), read in a try/catch so a blocked store falls back to cards.

Both views are endless lists over the same `GET /admin/contests` query: `InfiniteList` for cards, `InfiniteTable` for the list, pages of 20, loading the next page 600px before the end.

**The card view.** Two columns at ≥1100px, one below.

1. **Band**, 4:1. The contest-wide Board banner sponsor's artwork, fitted without cropping on the tenant's band colour; with no contest-wide Board banner holder, the tenant's decorative band. Never a placeholder image. Over the band, top left: the state chip ("Draft", "Open", "Closed"), the "Finalized" badge when finalized, and the lock glyph when locked.
2. **Body.** Type chip (from the registry); the name; the description, two lines, muted, omitted when empty. On the right, the sparkline: new players per day over the last 14 days, 96×28 in the tenant colour, captioned "+18 this week" or "None new this week", omitted until the first player. An Open contest whose entries haven't opened shows "Fans can join from Thu, Oct 1" in the sparkline's place until it has players.
3. **Stats row**: **Players** ("412", or "412/500" with a limit), **Games** (the count, with the featured game under it, picked by Wave 3's `featuredGame`: "Live: Denver @ Fighting Hawks", "Next: Denver @ Fighting Hawks · Sat 7:00 PM", or "Final: Montana State @ Fighting Hawks · Sep 19"), **Prize tiers** (the count; no maximum shown).
4. **Footer**: a Draft shows "Continue setup" (opens the builder at the first step that isn't done). Staff only: a ghost "Finalize" when the contest isn't finalized and every game has ended (the same test as Operations' `ready-to-finalize` row). A finalized contest shows "Finalized Sep 15". At the right, the **overflow menu** ("More actions"): "Close entries" (Open) or "Reopen entries" (Closed), "Duplicate", and "Delete" (not finalized). Members get no overflow.

**The list view.** A dense table, one row per contest, same order and filters:

| Column | Content |
|---|---|
| Name | The name, with the lock glyph when locked |
| Type | Registry label |
| State | The state chip, and the Finalized badge when finalized |
| Next game | `featuredGame`'s line, as on the card ("Sat Oct 3 · Denver @ Fighting Hawks", "Live now", "Final Sep 19"); empty with no games |
| Games | Count |
| Players | Count, "/500" when limited |
| Prize tiers | Count |
| Created | "Sep 21" |
| (actions) | The same overflow menu as the card; staff "Finalize" under the same rule |

The row opens the contest page. The overflow and Finalize are their own focus stops and don't open the row.

**Interactions.**

- A card or row opens `/contests/:contestId` (Overview). "Continue setup", "Finalize" and the overflow stop the click from reaching the card.
- **Close entries / Reopen entries** from the overflow write at once (PATCH `state`) and confirm on the card's footer (the row's Next game cell in the list): "Entries closed. Fans who joined keep playing." or "Entries open." A failure shows its sentence in the same place.
- **Delete** opens the Delete dialog (below). On success the card or row is removed from the list and the count drops by one.
- **Finalize** opens the Finalize dialog (below). On success the card shows the Finalized badge.

**States.**

| State | What renders |
|---|---|
| Loading (first page) | Four skeleton cards in the card's shape, or eight skeleton rows in the list. |
| Empty (no contests at all) | "No contests yet." and, for writers, "New contest". A member sees only the sentence. |
| No matches | "No contests match." with "Clear search and filters". |
| First page failed | The kit's `ReportableLoadError`. |
| A later page failed | Loaded items stay; the last row reads "Couldn't load more." with "Try again". |
| Member (view-only) | The same cards and rows, no overflow, no "New contest", no "Continue setup". One line under the header: "Only organization admins can change contests." |
| Paused workspace | As member, with the console's paused banner. Staff keep write access. |
| Staff with no tenant chosen | The console's "Pick a tenant" fallback. |

**Copy.**

| Element | Copy |
|---|---|
| Eyebrow / title / sub | "Games" / "Games & Contests" / "Contests your fans join, the games they run at and what they win." |
| Primary action | "New contest" |
| Search placeholder | "Search contests by name" |
| Status filter | "All", "Draft", "Open", "Closed" |
| Type filter | "All", then each registry label |
| Sort | "Sort", "Next game first", "Newest first", "Most players" |
| View toggle | "Cards", "List" (accessible name "View") |
| Count | "12 contests", "1 contest" |
| Chips | "Draft", "Open", "Closed", "Finalized", and the registry labels |
| Lock tooltip | "Locked since the first fan joined. Games can't be removed, and the contest type and existing prize tiers can't change." |
| Stat labels | "Players", "Games", "Prize tiers" |
| Game lines | "Next: Denver @ Fighting Hawks · Sat 7:00 PM", "Live: Denver @ Fighting Hawks", "Final: Montana State @ Fighting Hawks · Sep 19", "No games yet" |
| Opening line | "Fans can join from Thu, Oct 1" |
| Sparkline caption | "+18 this week", "None new this week" |
| List columns | "Name", "Type", "State", "Next game", "Games", "Players", "Prize tiers", "Created" |
| Overflow | "More actions", "Close entries", "Reopen entries", "Duplicate", "Delete" |
| Confirmations | "Entries closed. Fans who joined keep playing.", "Entries open." |
| Draft footer | "Continue setup" |
| Finalized footer | "Finalized Sep 15" |
| Staff action | "Finalize" |
| Empty / no matches | "No contests yet.", "No contests match.", "Clear search and filters" |
| Member line | "Only organization admins can change contests." |
| Later page failed | "Couldn't load more.", "Try again" |

### `/contests/:contestId` — the contest page

A full page, reached from a card or row, from Overview and Game day links, and for staff from All contests and the tenant page with `?tenant=<slug>` (which sets the console's acting tenant before the read, so the sidebar and every link agree). A tenant user whose URL names a tenant gets the same "Contest not found." state as a wrong id: the server refuses a non-staff `?tenant=` with 403, and the console does not confirm the contest exists.

**Header.**

- Back link: "Games & Contests" to `/games`, or "All contests" / the tenant's name when the page was opened from those (carried in navigation state, falling back to "Games & Contests").
- Eyebrow "Contest · Bingo" (the registry label); H1 the name; chips: the state chip, "Finalized", the lock glyph.
- Right: "Preview" (secondary; switches to the Preview tab); staff "Finalize" (ghost, same rule as the card); the overflow ("More actions"): "Duplicate", "Delete contest". The state actions are not in the header: they live in the Overview's state card, once.

**Tabs**: "Overview · Games · Prizes · Sponsors · Preview", with counts on Games and Prizes. The tab is in the URL: `/contests/:contestId` (Overview), then `/games`, `/prizes`, `/sponsors`, `/preview`. An unknown tab segment opens Overview. A prize opens as its own full page ([`admin-prizes.spec.md`](admin-prizes.spec.md)).

**Page states.**

| State | What renders |
|---|---|
| Loading | Header skeleton and the active tab's skeleton. |
| Not found (wrong id, other tenant, or deleted elsewhere) | "Contest not found." with "Back to Games & Contests". |
| Load failed | `ReportableLoadError`. |
| Draft | A banner under the header: "This is a draft. Fans can't see it until you publish." with "Continue setup". |
| Just published | "Published. Fans can see it now." under the header, for this visit only. |
| Locked | Glyph in the header; locked controls read as values on every tab. |
| Finalized | "Finalized" badge; every tab read-only; the overflow offers only "Duplicate"; the header line "Finalized on Sep 28. Nothing about this contest can change." |
| Member | View-only on every tab, with "Only organization admins can change contests." under the header. No overflow; "Preview" stays. |
| Stale write (409 `stale_contest`) | Inline, where the save happened: "This contest changed while you were editing, so nothing was saved. Reload to see the current version and make your change again." with "Reload". |

**Duplicate** creates a new draft ("Copy of Rivalry Week", numbered if taken) with the description, internal note, contest type, player limit, the games that haven't started, the prize tiers (as new tiers naming the same library prizes), and the sponsor placements for all games and for the carried games. It opens the new draft in the builder at Basics.

#### Overview tab

Two columns at ≥1100px (content, then a 320px right rail); one below, with the rail after the content.

**KPI tiles** (hue outline, 40px numbers):

| Tile | Value | Shown when |
|---|---|---|
| "Players" | The board count, with "of 500" under it when limited | Always (0 on a new contest is true) |
| "Boards with a bingo" | Boards with at least one claimed line | Not a Draft |
| "Prizes awarded" | Redemptions that pay a tier (not skipped) | Not a Draft |
| "Failed sends" | Failed prize sends for this contest | Only when above 0; links to Prizes → Deliveries filtered to this contest and to Failed |

**State card** ("Contest state"), first in the content column. It says what the state means for fans and offers only the transitions allowed now:

| State | Line | Actions |
|---|---|---|
| Draft | "Fans can't see this contest." | "Review and publish" (primary; opens the builder's Review step, where Publish lives) |
| Open | "Fans can see this contest and join it." (or, before entries open, "Fans can see this contest. They can join from Fri, Oct 2 · 5:48 PM.") | "Close entries"; "Move to draft" when unlocked |
| Closed | "Fans see this contest under Past and keep playing their boards. Nobody new can join." | "Reopen entries"; "Move to draft" when unlocked |
| Finalized | "Finalized on Sep 28. Nothing about this contest can change." | None |

Close entries, Reopen entries and Move to draft write at once (PATCH `state`) and confirm in the card: "Entries closed. Fans who joined keep playing.", "Entries open.", "Moved to draft. Fans can't see it now." A refusal shows its sentence in the card.

**Basics**, edited inline. Each field saves on blur or Enter as a one-field PATCH with the precondition; Escape reverts. A saved field shows "Saved." beside its label for a few seconds. Errors sit under the field.

1. **Name.** Text, required, 80 characters.
2. **Description.** Textarea with a counter ("112/300"); help "Fans see this on the contest card." When the description is empty and the internal note has text, the button "Use the internal note" copies the note into the field unsaved, so the operator reviews it and saves by leaving the field. A note longer than 300 characters copies whole and shows "Keep it to 300 characters." until shortened.
3. **Internal note.** Textarea, 500 characters; help "Only people in this console see the internal note."
4. **Player limit.** Segmented "No limit | Limit to" with a number ("players"). Lowering below the current player count states the consequence before saving: "412 are already playing. Nobody is removed; new fans can't join."
5. **Contest type.** On an unlocked Draft, segmented from the registry ("Bingo | Trivia"). Otherwise the value, with the lock glyph once locked.

**Test mode** (dev only, Wave 3 §5): a card "Test mode" with segmented "Off | On", rendered only when `GET /admin/dev/status` answers. It replaces the retired drawer's control. Help: "Fans can join now, whatever the game times, and past games can be added." It is absent everywhere the dev gate is closed.

**Danger zone** (writers, not finalized), last in the content column: a bordered card "Delete contest" with the line "Deletes the contest, its fans' boards, its prize tiers and its sponsor placements. Prizes already sent stay on record." and the button "Delete contest", which opens the Delete dialog.

**Right rail, "What's next"**, a short timeline:

- **Next game**: `featuredGame`'s line with its readiness dot from game day, linking to Game day on that game; "No upcoming games" when none.
- **Lock**: "Not locked. Everything can change until the first fan joins." or "Locked since Sat Sep 27, 7:02 PM."
- **Finalize**: staff see "Ready to finalize" with "Finalize" under the card rule, "Finalize after the last game" before it, or "Finalized on Sep 28". Tenants see "Overboard finalizes the contest after its last game." or "Finalized on Sep 28."

**Copy.**

| Element | Copy |
|---|---|
| Tiles | "Players", "of 500", "Boards with a bingo", "Prizes awarded", "Failed sends" |
| State card | "Contest state", the lines above, "Review and publish", "Close entries", "Reopen entries", "Move to draft", "Entries closed. Fans who joined keep playing.", "Entries open.", "Moved to draft. Fans can't see it now." |
| Field labels | "Name", "Description", "Internal note", "Player limit", "Contest type" |
| Help | "Fans see this on the contest card.", "Only people in this console see the internal note." |
| Nudge | "Use the internal note" |
| Player limit | "No limit", "Limit to", "players", "412 are already playing. Nobody is removed; new fans can't join." |
| Saved | "Saved." |
| Field errors | "Give the contest a name.", "Keep it to 80 characters.", "Keep it to 300 characters.", "Keep it to 500 characters.", "Enter a number from 1 to 1,000,000.", "Another contest in this workspace already has this name." |
| Test mode | "Test mode", "Off", "On", "Fans can join now, whatever the game times, and past games can be added." |
| Danger zone | "Delete contest", "Deletes the contest, its fans' boards, its prize tiers and its sponsor placements. Prizes already sent stay on record." |
| Rail | "What's next", "Next game", "No upcoming games", "Lock", "Not locked. Everything can change until the first fan joins.", "Locked since Sat Sep 27, 7:02 PM.", "Finalize", "Ready to finalize", "Finalize after the last game", "Overboard finalizes the contest after its last game.", "Finalized on Sep 28." |

#### Games tab

An `InfiniteTable` of the contest's games (`GET /admin/contests/:contestId/games`): games in progress first, then upcoming soonest first, then played games newest first. Columns: **Sport** ("NFL", "CFB"…), **Game** (matchup, "Denver @ Fighting Hawks"), **Tip-off** ("Sat Oct 3 · 7:00 PM"), **State** ("Upcoming", "Live", "Final", from Wave 3's derived game status), and a **Remove** action before the lock.

- **Remove** (before the lock) acts at once and answers above the table: "Removed Denver @ Fighting Hawks." with "Undo", which adds it back. The game's placements are kept, dormant, so Undo or a later re-add restores them.
- **After the lock** the Remove column is gone and one line sits above the table: the `gameRemoved` lock sentence.
- **"Add games"** (writers, not finalized) opens an inline picker panel at the top of the tab, not a drawer: G1's `PickerList` over `GET /admin/games/candidates?contest=<id>`, with search ("Search teams"), the **sport filter** (segmented "All" plus every sport in the response's `sports`, always shown, even with one sport, Wave 3 §2), a date range ("Any date", "Next 7 days", "Next 30 days", "Choose dates"), the count ("48 games"), checkbox rows grouped by day (time, matchup, sport), and the footer "Add 3 games" · "Cancel". Adding confirms above the table: "Added 3 games." A test-mode contest's picker also offers the last 14 days' games (Wave 3 §5), with their state shown.
- **Empty**: "No games yet." with "Add games".
- **Trivia** has the same Games tab: trivia contests run at games too.

No props appear here or anywhere in the console.

| Element | Copy |
|---|---|
| Columns | "Sport", "Game", "Tip-off", "State" |
| State | "Upcoming", "Live", "Final" |
| Actions | "Add games", "Remove", "Undo" |
| Confirmations | "Removed Denver @ Fighting Hawks.", "Added 3 games.", "Added 1 game." |
| Empty | "No games yet." |
| Picker | "Search teams", "All", "Any date", "Next 7 days", "Next 30 days", "Choose dates", "48 games", "Add 3 games", "Cancel", "No games match." |
| Errors | "Denver @ Fighting Hawks has already started.", the `gameRemoved` lock sentence |

#### Prizes tab

The contest's prize ladder, tiers shown by number ("Tier 1", "Tier 2"…), each naming its library prize. Everything about it (the ladder, adding a tier, the prize full page, completeness, the lock's tier kinds) is [`admin-prizes.spec.md`](admin-prizes.spec.md). Trivia: the placeholder card.

#### Sponsors tab

The contest's sponsor placements: [`admin-sponsors.spec.md`](admin-sponsors.spec.md).

#### Preview tab

The console's `FanAppPreview` host showing this contest on the current fan app, with its real games, players, photos and prize tiers: [`admin-preview.spec.md`](admin-preview.spec.md). The tab keeps its screen and device in the URL (`?screen=`, `?device=`).

### The builder — `/contests/new`, `/contests/:contestId/setup/:step`

**The console stays around it.** The builder is a page in the main column: the sidebar stays visible, with Games & Contests active, and the top bar's breadcrumb reads "Fighting Hawks / Games & Contests / New contest" (the name once typed).

**Builder header**, under the top bar: the title ("New contest", then the name as typed), the "Draft" chip once the draft exists, the save indicator ("Saved · just now", "Saving…", or "Not saved yet" before the first save), **"Save draft"** (secondary), and "Exit" (ghost).

**The progress bar**, across the top of the content under the header: five steps in a row, **Basics · Games · Prizes · Sponsors · Review**, joined by a track that fills up to the current step. Each step is a button showing its number, its name and a one-line summary once it has one ("Bingo", "2 games", "2 tiers", "Optional", "Ready to publish"). Its mark is ✓ when done, "!" in the warning colour when it needs attention (a tier that needs details, or a publish reason pointing at it), the number otherwise; the current step is outlined. **Every step can be clicked at any time**, in any order. The bar scrolls sideways below 720px.

**Footer bar**: "Back" and "Continue" (primary) move one step; on Review, "Publish" replaces Continue.

**Saving.**

- **Save draft works from every step.** On Basics it saves the form; on the other steps everything already saves as it goes, so it confirms "Saved · just now". The **first save creates the draft** (`POST /admin/contests`) and replaces the URL with `/contests/:contestId/setup/<current step>`.
- Moving to another step (the bar, Back, Continue) and Exit save Basics first. The one thing the draft can't exist without is a valid name: with none, the move stays on Basics with "Give the contest a name." under Name.
- Games, Prizes and Sponsors write as they go, through their own endpoints.
- A failed save keeps the step open with the error in place.

Steps and their routes (`:step` = `basics`, `games`, `prizes`, `sponsors`, `review`):

1. **Basics.**
   - **Name**, required, 80 characters, placeholder "Rivalry Week", focused on open.
   - **Contest type**: one selectable card per registry type. "Bingo" / "Fans draft players and win on bingos." (selected by default) and "Trivia" / "Trivia isn't built yet. You can save this contest and come back."
   - **Description**, 300 characters, help "Fans see this on the contest card."
   - **Internal note**, 500 characters, placeholder "Sponsor, dates, anything your team should know".
   - **Player limit**: "No limit | Limit to" with a number.
   - Done when: a valid name and a type.
2. **Games.** G1's `PickerList` on the left: search, the **sport filter** (always shown, from `sports`), the date range, checkbox rows grouped by day with each game's sport. On the right, the selected games with their sport and tip-off and a remove control, headed "3 games · first Sat Oct 3" ("No games picked yet." when empty). Ticking and unticking add and remove at once. Done when: at least one game.
3. **Prizes.** The contest Prizes tab's ladder ([`admin-prizes.spec.md`](admin-prizes.spec.md)), the same component. A prize opens as its full page and returns here. Trivia: the placeholder card. Done when: at least one complete tier and none that needs details.
4. **Sponsors.** The contest Sponsors tab's content ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)), the same component; its step summary reads "Optional". Done once visited.
5. **Review.** Left, the readiness checklist, each row linking to its step: "Name", "Contest type", "Games (3)", "Prize tiers (2 complete)", "Sponsors (4 placements)". A row that blocks publishing shows its reason under it, and the reasons are also listed in one card above the footer ("Publish is waiting on one thing" / "Publish is waiting on 2 things"). Right, the preview frame on the builder's current state ([`admin-preview.spec.md`](admin-preview.spec.md)). **Publish** is disabled while any reason stands; it shows "Publishing…", then navigates to the contest page, which shows "Published. Fans can see it now." No toast.

**Exit** returns to `/games`, where the draft leads the list. Exit with a valid name saves first, so typed work is never lost; with no valid name and no draft yet, it simply leaves.

**Editing never reopens the builder.** An Open or Closed contest is edited on its tabs. The builder is for a Draft: "Continue setup" opens it at the first step that isn't done; a direct builder URL for a non-draft contest redirects to the contest page.

**Permissions.** Writers only. A member who opens a builder URL is sent to the contest page (or `/games` for `/contests/new`).

| Element | Copy |
|---|---|
| Header | "New contest", "Draft", "Saved · just now", "Saving…", "Not saved yet", "Save draft", "Exit" |
| Progress bar | "Basics", "Games", "Prizes", "Sponsors", "Review", "Optional", "Ready to publish" (accessible name "Setup steps") |
| Footer | "Back", "Continue", "Publish", "Publishing…" |
| Basics | "Name", "Rivalry Week", "Contest type", "Bingo", "Fans draft players and win on bingos.", "Trivia", "Trivia isn't built yet. You can save this contest and come back.", "Description", "Fans see this on the contest card.", "Internal note", "Sponsor, dates, anything your team should know", "Only people in this console see the internal note.", "Player limit", "No limit", "Limit to", "players", "Give the contest a name." |
| Games | "Search teams", "All", "Any date", "Next 7 days", "Next 30 days", "Choose dates", "3 games · first Sat Oct 3", "No games picked yet." |
| Review checklist | "Name", "Contest type", "Games (3)", "Prize tiers (2 complete)", "Sponsors (4 placements)", "Publish is waiting on one thing", "Publish is waiting on 2 things" |
| Publish reasons | The five sentences under "Publish checks" |
| Result | "Published. Fans can see it now." |

### Delete, wherever it appears

The contest page's danger zone and header overflow, and the overflow on every card and list row, open one **centred dialog**. Writers only; not offered on a finalized contest. The server's behaviour is Wave 3 §3.2; the dialog states it in plain words.

| Element | Copy |
|---|---|
| Title | "Delete Rivalry Week?" |
| Body (no fans yet) | "No fan has joined it yet. Its prize tiers and sponsor placements are deleted with it. Prizes in your library stay." |
| Body (fans joined) | "412 fans have boards in this contest. Their boards, its prize tiers and its sponsor placements are deleted. Prizes already sent stay on record. This can't be undone." |
| Input label | "Type “Rivalry Week” to confirm" |
| Buttons | "Delete contest", "Deleting…", "Cancel" |
| Errors | "The contest name you typed doesn't match.", "A prize from this contest is being sent right now. Try again in a minute.", "This contest is finalized, so it can't be deleted.", "Verification cancelled. Nothing was deleted." |
| Result | The console returns to `/games` (from the contest page) or removes the card or row, and shows "Deleted Rivalry Week." above the list. |

The confirming button is enabled only on a match (trimmed, ignoring case) and the server checks the typed name again. A locked contest runs reverification after the confirm (the console's `useReverification`); a cancelled reverification leaves the dialog open and says nothing happened.

### Staff: All contests (`/contests`)

The table stays ([`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), paged per [`admin-lists.spec.md`](admin-lists.spec.md)); its type column reads "Contest type" and its visibility column becomes **State** (the state chip and the Finalized badge). **A row opens the contest page** for that tenant: `/contests/:contestId?tenant=<slug>`, acting as that tenant, with the back link "All contests". **Each row carries "Finalize"** under the card's rule, absent otherwise. The staff tenant page's Contests table behaves the same way.

### Finalize, wherever it appears

Cards and rows, the contest page header and rail, All contests rows and the tenant page rows open one centred dialog. Staff only; reverification first; the typed name is checked by the server.

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
| Edit basics, contest type (unlocked draft) | Yes | No | Yes |
| Publish, Close and Reopen entries, Move to draft | Yes | No | Yes |
| Add and remove games (lock permitting) | Yes | No | Yes |
| Prize tiers, sponsor placements | Yes (their specs) | No | Yes |
| Duplicate | Yes | No | Yes |
| Delete (not finalized; reverified once locked) | Yes | No | Yes |
| Test mode (dev only) | Yes | No | Yes |
| Finalize | No | No | Yes (reverified) |

Enforcement is server-side: every write passes `refuseReadOnlyWrite` first (D-063), which refuses a member and a paused workspace's own admins; Delete of a locked contest passes `requireAdminReverified`; Finalize passes `requireAdminReverified` and `refuseNonObsStaff`. The console's `useCanWrite` and `useIsObsStaff` only decide what renders.

---

## Endpoints

All under `/admin`, `requireAdmin`. Targeting as everywhere: a tenant caller's target is their own organization and any `?tenant=` is 403; OBS staff name the tenant with `?tenant=<slug>`. `:contestId` must belong to the target tenant, else **404**. Writes: `refuseReadOnlyWrite`. Contracts in `obs-b2b-shared/src/api/admin/contests.ts`.

| Method | Path | Who |
|---|---|---|
| GET | `/admin/contests` | Any resolved admin scope |
| GET | `/admin/contests/:contestId` | Any resolved admin scope |
| GET | `/admin/contests/:contestId/games` | Any resolved admin scope |
| GET | `/admin/contests/:contestId/preview` | Any resolved admin scope ([`admin-preview.spec.md`](admin-preview.spec.md)) |
| GET | `/admin/preview` | Any resolved admin scope; the tenant-level preview sections for a host with no contest ([`admin-preview.spec.md`](admin-preview.spec.md)) |
| GET | `/admin/games/candidates` | Any resolved admin scope ([`admin-lists.spec.md`](admin-lists.spec.md); `contest=`, `sport=`, and `sports` in the answer per Wave 3 §2) |
| POST | `/admin/contests` | Tenant `org:admin`, OBS staff |
| PATCH | `/admin/contests/:contestId` | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/duplicate` | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId` | Tenant `org:admin`, OBS staff (Wave 3 §3.2; reverified when locked) |
| POST | `/admin/contests/:contestId/games` | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId/games/:betEventId` | Tenant `org:admin`, OBS staff (lock permitting) |
| POST | `/admin/contests/:contestId/finalize` | OBS staff only (unchanged) |
| PUT | `/admin/dev/contests/:contestId/test-mode` | Wave 3 §5 (dev only) |
| PUT | `/admin/contests/:contestId/games` | Kept for the old screen until it retires; lock-checked |

Neither the tier endpoints nor the placement endpoints are here: [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md). There is no separate publish endpoint: Publish is `PATCH` with `state: "open"` on a Draft, which runs the publish checks.

### `GET /admin/contests`

The home's list for both views, cursor-paged by [`admin-lists.spec.md`](admin-lists.spec.md).

Query: `cursor`, `limit` (default 20), `q` (contest name), `state` (`draft|open|closed`; `closed` includes finalized contests), `type` (a registry key), `sort` (`next|newest|players`, default `next`).

Order: **drafts lead every order** (the tenant's unfinished work), newest first. Then the rest: `newest` by `_id` descending; `next` by a game in play first, then the soonest upcoming tip-off, then contests with nothing upcoming by `_id` descending; `players` by board count descending. `next` and `players` are derived orders computed over one tenant's contests (G1's bounded-candidate rule), never the client. Every order ends in `_id`.

Response:

```ts
{
  contests: Array<{
    contestId: string;
    contestName: string;
    description: string | null;
    contestType: ContestType;
    state: "draft" | "open" | "closed";
    opensAt?: string;                // an Open contest whose entries haven't opened yet
    finalized: boolean;
    finalizedAt?: string;
    locked: boolean;
    lockedAt?: string;
    players: number;                 // board count
    maxParticipants: number;         // 0 = no limit
    games: { total: number; featured?: GameSummary & { phase: "live" | "next" | "final" } };
    prizeTierCount: number;
    banner: { sponsorId: string; name: string; imageUrl: string } | null;
    newPlayersByDay: number[] | null;  // 14 daily counts ending today; null before the first player
    newPlayersThisWeek: number;
    readyToFinalize: boolean;        // not finalized, every game ended
    createdAt: string;
    updatedAt: string;
  }>;
  types: ContestType[];              // the registry's keys, in registry order, for the Type filter
  page: { nextCursor: string | null; total: number; limit: number };
}
// GameSummary = { betEventId: string; matchup: string; eventTime: string; sport?: string }
```

Per-row aggregates (players, sparkline, tier count, banner) are computed for the page's rows only. Errors: 400 `cursor_stale` / `cursor_invalid` (the console restarts the list silently); 400 on an unknown filter value.

### `GET /admin/contests/:contestId`

The contest page's read. The list row's fields plus `internalNote`, `testMode` (only where the dev gate is open), `kpis: { boardsWithBingo, prizesAwarded, failedSends }`, `prizeTiers: { total, complete, needsDetails }`, `placementCount`, `transitions: Array<"publish" | "close" | "reopen" | "toDraft">` (what the state card offers), and `publishChecks: Array<{ key, message }>` (empty when publishable; drives the Review checklist, the progress bar's marks and "Continue setup"'s first incomplete step). 404 for a wrong or foreign id.

### `GET /admin/contests/:contestId/games`

The Games tab. Cursor-paged; order: live, then upcoming soonest first, then played newest first, then `_id`. Rows: `betEventId`, `sport`, `matchup`, `eventTime`, `status` (`Upcoming|Live|Final`, from `deriveGameStatus`), `removable` (false once locked or finalized).

### `POST /admin/contests`

Creates a contest, a Draft by default. Body: `{ contestName, contestType?, description?, internalNote?, maxParticipants?, state?: "draft" | "open", betEventIds? }`. Defaults: bingo, no limit, no games, `state: "draft"`.

- Validation (400, `errors.<field>`): name 1–80 after trim; description ≤300; internal note ≤500; limit 0–1,000,000; type a registry key.
- `state: "open"` runs the publish checks (409 `publish_blocked`). The console always creates a Draft.
- Name clash → 409 `name_taken`.
- Audited `contest_create` (contest id, contest type).
- Responds **201** with the contest in the `GET /admin/contests/:contestId` shape.

### `PATCH /admin/contests/:contestId`

Body: any of `{ contestName, description, internalNote, maxParticipants, contestType, state }` plus `expectedUpdatedAt`. Only present keys change; `null` or `""` clears `description` or `internalNote`. An empty edit is a 400.

- `finalized` → 409 `contest_finalized` ("This contest is finalized, so its settings can't change."). "Not finalized" is part of the write filter.
- The precondition and the write are one filter; a stale edit → 409 `stale_contest`.
- `state`: the transitions of Wave 3 §3.1. Draft → Open runs the publish checks (409 `publish_blocked` with `reasons`). To Draft on a locked contest → 409 `contest_locked` ("Fans have joined this contest, so it can't go back to draft."), with the not-locked condition in the write filter.
- `contestType` on a non-draft → 409 `not_draft` ("The contest type can't change after publishing."); on a locked one → 409 `contest_locked` (kind `gameType`).
- Name clash → 409 `name_taken`.
- Audited `contest_update` with the changed field names and the new `state`, never free text. A Draft → Open change is audited as `contest_publish`.
- Responds with the contest and `changes.fields`.

### `POST /admin/contests/:contestId/duplicate`

No body. Creates a Draft as described under the contest page (name "Copy of <name>", made unique and trimmed to 80). Tiers are new documents naming the same library prizes; placements are copied for the all-games scope and for the games carried over (those not started). Audited `contest_duplicate` with the source id. Responds **201** with the new contest.

### `DELETE /admin/contests/:contestId`

Wave 3 §3.2, unchanged: body `{ expectedUpdatedAt?, confirmName }`; finalized → 409; a send in flight → 409; audit first; boards and pending sends deleted; terminal redemptions kept with `contestName`; the contest's tiers and placements deleted; library prizes kept. Wave 4 adds only the console above and reverification for a locked contest (`requireAdminReverified` when `lockedAt` is set).

### `POST /admin/contests/:contestId/games`

Body `{ betEventIds: string[], expectedUpdatedAt }`. Adds to `allowedBetEvents` and `ranAtBetEvents` in one update. Distinct ids; every id must name a reference game (400 listing unknown ids); a game that has started → 400 "<matchup> has already started." (a test-mode contest may add the last 14 days' games, Wave 3 §5); ids already in the contest are ignored. Finalized → 409 `contest_finalized`. Allowed on a locked contest. Audited `contest_games_add` (count). Responds with the contest and `changes.added`.

### `DELETE /admin/contests/:contestId/games/:betEventId`

Query `expectedUpdatedAt`. Removes the game from `allowedBetEvents` (never from `ranAtBetEvents`). Locked → 409 `contest_locked` with kind `gameRemoved`, with the not-locked condition in the write filter. A game not in the contest → 404 ("That game isn't part of this contest."). Finalized → 409 `contest_finalized`. The game's placements stay, dormant. Audited `contest_games_remove`. Responds with the contest and `changes.removed`.

### `POST /admin/contests/:contestId/finalize`

Unchanged ([`admin-obs-internal.spec.md`](admin-obs-internal.spec.md)). Only its callers change: the card, the list row, the contest page, All contests rows and the tenant page.

### Error codes and what the console shows

| Code | Status | Console shows |
|---|---|---|
| `errors.<field>` | 400 | The message under that field. |
| `name_taken` | 409 | "Another contest in this workspace already has this name." under Name. |
| `stale_contest` | 409 | "This contest changed while you were editing, so nothing was saved. Reload to see the current version and make your change again." with "Reload". |
| `contest_finalized` | 409 | "This contest is finalized, so its settings can't change." and a re-read. |
| `contest_locked` | 409 | The refusal's own sentence where the change was attempted, and a re-read. |
| `not_draft` | 409 | "The contest type can't change after publishing." |
| `publish_blocked` | 409 | The reasons, as sentences, on Review. |
| (delete refusals) | 400 / 409 | The Delete dialog's error lines. |
| (write gate, member) | 403 | "Only organization admins can change contests." |
| (write gate, paused) | 403 | "This workspace is paused. Changes are turned off until Overboard resumes it." |
| (unknown or foreign id) | 404 | "Contest not found." on the page; "That game isn't part of this contest." for a game. |
| `cursor_stale`, `cursor_invalid` | 400 | Nothing: the list restarts from the top. |

### Changes to existing endpoints

- **`GET /admin/games`** stays for the old screen and is retired with it.
- **`PUT /admin/contests/:contestId/games`** keeps working for the old screen, with its lock check.
- **Fan reads** (`GET /b2b/contest/list-contests`, `GET /b2b/contest/:contestId`) move to the allowlisted projection with `description` and `contestType`.

---

## Migration

`node-server/scripts/contest-console-migration.mjs`, dry run by default, `--apply` to write, dev-only rails like every other script, idempotent (a second run finds nothing and says so). Runs after Wave 3's `contest-state-migration.mjs`. It only has to be safe on the shared dev database.

1. **The note.** For every contest with `contestDescription`: `internalNote = contestDescription`, then unset `contestDescription`. `description` is left absent. Reason: the console promised "Only people in this console see the note."
2. **Contest type.** `contestType = gameType ?? "bingo"`, then unset `gameType`.
3. **The list index** `{ organizationId: 1, state: 1, _id: -1 }`, created after the writes. Creating an existing index is a no-op.

`contestTypeOf()` reads `contestType ?? gameType ?? "bingo"`, and the fan reads' projection reads `description` only, so readers and the migration can land in either order on dev.

---

## Contest types: groundwork for the second game

`GAME-F1`: the type lives on the contest, and the registry above is the one list of types. New wire fields stay type-neutral. Deliberately left for the trivia build: the `*_bingo_*` collection names; the board's nine named cells and the evaluator's eight lines; tiers keyed on `threeInARows` (the second game needs a type-neutral threshold or its own tier fields); "bingo" in existing wire fields and CSV columns; the fan app's bingo-shaped routes.

## Dev fixtures

`seed-test-tenant.mjs` keeps "Test Tenant — This Week" re-pointed at the current week and "Test Tenant Bingo" as it is. After the migration, fixtures carry `state` and a `description` written for fans ("Pick your players for this week's games and chase a bingo."), and one fixture draft ("Test Tenant — Draft") exists so the Draft card, list row and banner can be seen. Games come from every sport the mirror holds for the coming week, not only NFL.

---

## Rules

1. **`CT-01` — A control exists only if the fan side honours it.** No entries-per-fan, no two-teams, no board rules, no prop controls. The Trivia placeholder is the one sanctioned exception.
2. **`CT-02` — A contest's state is stored: Draft, Open or Closed** (Wave 3 §3.1). Finalized is a badge. The console shows state and never a separate visibility or entries control.
3. **`CT-03` — Publish is gated.** Bingo needs a game that hasn't started and a complete tier with none needing details; a non-playable type can't publish. The server checks it on every move into Open from Draft.
4. **`CT-04` — Each state action appears once, where it belongs,** and only when allowed: Publish on Review, the others in the Overview's state card and (Close and Reopen) the card and row overflow.
5. **`CT-05` — The description is for fans; the internal note never leaves the console.** Fan reads use an allowlisted projection, and the current fan app shows the description on the contest card.
6. **`CT-06` — Contest types come from one registry.** Filters, pickers and validation read it; nothing hardcodes a type.
7. **`CT-07` — A contest locks at its first board and never unlocks.** The lock table above, decided in shared, enforced by the server, shown read-only in the console.
8. **`CT-08` — Removing a game locks with the contest; adding never does.**
9. **`CT-09` — Tenants never choose or see props.** The console has no prop screen, control, count or readiness item.
10. **`CT-10` — The game picker always shows its sport filter,** fed by the sports the schedule actually holds.
11. **`CT-11` — Any non-finalized contest can be deleted,** with a typed name, and reverification once fans have joined.
12. **`CT-12` — The builder keeps the console around it.** Steps are a clickable progress bar, every step is reachable at any time, and Save draft works from every step.
13. **`CT-13` — Every growing list pages on the server with a cursor.** The contest list (both views), the Games tab and the game picker.
14. **`CT-14` — Finalize is staff only and appears only when every game has ended**, hidden rather than disabled otherwise.
15. **`CT-15` — Participation is the board count.** `numberParticipants` is never read.
16. **`CT-16` — Contest names are unique within a tenant, ignoring case.**
17. **`CT-17` — `ranAtBetEvents` only grows.**
18. **`CT-18` — Every refusal carries one plain sentence, shown where the change was attempted.** No toasts, no spec IDs, no vendor words.

## Known gaps (recorded, not blocking)

- **The fan card leads with the matchup, not the contest name.** The current fan app titles a contest card with its featured game's matchup and shows the contest name only for a game without two teams. The console's name still matters (Delete, Finalize, the board header for a multi-game board); the Preview shows the card as it is.
- **Multi-entry** needs the index change and fan-app support before a control can exist.
- **Line drift from the shared data.** Boards reference feed props live; an upstream edit to a feed line still changes existing boards (contest-safety, Known gaps).
- **Name uniqueness is check-then-write.** Two creates to one name in the same instant can both succeed; a normalized-name unique index is the fix if it ever matters.
- **Player-limit enforcement is count-then-insert.** Two fans at the last place in the same instant can both join.
- **`numberParticipants` is dead data**, left in place and read by nothing.
- **Audit coverage.** Games adds and removes and state changes are audited from this spec on; tier writes' audit is [`admin-prizes.spec.md`](admin-prizes.spec.md)'s.

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- The contest has no `publishedAt` stamp: its stored state says Draft, Open or Closed, and nothing else needed the date.
- An unknown tab in the address (`/contests/:contestId/whatever`) opens Overview.
- The Overview's **Failed sends** tile shows only when at least one of the contest's prize sends has failed.
- The Preview tab mounts the preview's contest tab: it opens on the fan app's Contests screen and keeps the screen, device, tier, game and sponsor highlight in the address, so the Sponsors tab's links open the frame on the right game.
- `/contests/:contestId/prizes` and `/contests/:contestId/sponsors` are the contest page's own tabs. The stand-alone ladder and slot pages built while the slices were apart were dropped when they were joined.
- The end-to-end harness's `--screens` run opens the new contest from Games & Contests onto the contest page and photographs it there.

## References

- PRD: [`ADM-03`, `ADM-04`, `ADM-06`, `BRAND-02`, `BRAND-04`, `GAME-01`–`GAME-04`, `GAME-C1`, `GAME-F1`, `PRIZE-03`, `TEN-05`, `TEN-C1`, `ADM-09`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) — sports (§2), states, deletion, featured game and refusals (§3), test mode (§5), the harness (§6)
- [`admin-surface.spec.md`](admin-surface.spec.md) — access, reverification, principles, Rule 13, routes
- [`contest-safety.spec.md`](contest-safety.spec.md) — the lock, the snapshot, the unique board index
- [`admin-lists.spec.md`](admin-lists.spec.md) — cursor paging and the list components
- [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md), [`admin-preview.spec.md`](admin-preview.spec.md), [`admin-uploads.spec.md`](admin-uploads.spec.md)
- [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) — the fan app's preview mode
- [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the superseded games half, kept as history
- [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — All contests, Finalize
- [`admin-game-day.spec.md`](admin-game-day.spec.md) — readiness dots reused on the Overview rail and the Finalize rule
- Research (workspace): `artifacts/review-2026-09-27/e2e-pes-fanapp.md` (§2, §3, §5, §8), `artifacts/review-2026-09-27/prizes-optins-specs.md` (§6, §7)
- Rulings: Arthur, 2026-09-24 (`artifacts/wave-2026-09-24/WAVE-RULES.md`) and 2026-09-27 (`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`); D-059, D-063, D-068
