# Core Module Spec: Admin — Contests

**Implements:** PRD `ADM-03`, `ADM-04`, `ADM-06` (where Finalize appears, not what it does), `GAME-01`, `GAME-04`, `BRAND-02`/`BRAND-04` (the "which games" half), and the data-model constraint `GAME-F1`. Narrows `TEN-05` further: a contest is recurring configuration, never onboarding-time setup. `GAME-02`'s tiers are per contest, not per game (ruling 2026-09-24; see the PRD's revision notes).

**Depends on:**

- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) (Wave 3). It owns the backend meaning of everything this spec puts on screen: every sport in the picker and its `sports` feed (§2), the stored state Draft → Open → Closed and its transitions (§3.1), contest deletion (§3.2), `featuredGame` (§3.3), the join refusal codes and `opensAt` (§3.4), and dev test mode (§5). This spec builds the console on top of those semantics and does not redefine them.
- [`admin-surface.spec.md`](admin-surface.spec.md): scope resolution, the write grant (tenant `org:admin` and OBS staff), "No re-authentication", pages versus drawers, and the principles, above all Honesty by omission (Rule 13).
- [`contest-safety.spec.md`](contest-safety.spec.md): the lock stamp `lockedAt`, the pure lock functions in `obs-b2b-shared`, the prize snapshot and the one-board-per-fan index.
- [`admin-lists.spec.md`](admin-lists.spec.md): the cursor-paging convention, `InfiniteList`/`InfiniteTable`/`PickerList`, and the schedule picker's `GET /admin/games/candidates`.
- [`admin-prizes.spec.md`](admin-prizes.spec.md): the prize library, the contest Prizes tab's ladder, and what makes a tier complete. [`admin-sponsors.spec.md`](admin-sponsors.spec.md): the Sponsors tab.
- [`admin-preview.spec.md`](admin-preview.spec.md) and [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md): the preview drawer and the builder's Review preview.
- [`admin-uploads.spec.md`](admin-uploads.spec.md): the one upload field, wherever a contest screen takes an asset.

**Supersedes:** the games half of [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md): the `/games` screen (per-contest cards with games tables, the per-game drawer), `GET /admin/games` as that screen's read, the games PUT as its write, and "What the data model actually is" as a description of the console. Also this spec's own 2026-09-23 version: the create drawer, the contest detail drawer, the "Note" field and "no contest delete". The prizes half of admin-games-and-prizes goes to [`admin-prizes.spec.md`](admin-prizes.spec.md).

**Status:** Draft. Written 2026-09-23 for the Games & Contests overhaul; rewritten 2026-09-24 for the console redesign.
Revised 2026-09-27 for Wave 4 (Arthur's rulings of 2026-09-27): the Board tab, the builder's Board step and all prop pool curation are removed; the stored state Draft → Open → Closed replaces visibility, entries and the derived Draft; any non-finalized contest can be deleted; the builder keeps the console sidebar and moves its steps to a clickable progress bar with Save draft on every step; the home gains a list view and a type filter fed by the contest-type registry; the game picker always shows its sport filter.

Revised 2026-09-28 (Arthur's Wave 4 walkthrough ruling): **no re-authentication** — Delete takes the typed name alone, fans joined or not, and Finalize the typed name alone; **staff see Games & Contests and the contest page exactly as the workspace does**, so Finalize is gone from the cards, the list rows, the contest page header and its Overview rail. Staff finalize only from All contests and the tenant page.

Revised again 2026-09-28 (Arthur's final walk, which wins): **Finalize is back on the contest card, the list row, the contest page header and its Overview rail, for Overboard staff only**, marked as a staff action (an indigo "Staff" tag beside the button). Tenant admins and members never see it. Staff keep it in either point of view (the Admin/Member view-as toggle changes what a workspace would see, not who the staffer is). See "Finalize, wherever it appears".

Revised 2026-09-30 (Arthur's rulings): **the progress marker is the contest's, and no sponsor rides it.** A contest's games share one board, so the marker is one per contest (`progressMarkerImageUrl`, set on Overview → Basics, upload field `contest.progressMarker`), not one per game: the Games tab's marker column and its write are gone. The sponsor Slider slot is removed, so the board's marker is the contest's Progress marker, else the Brand marker, else the default triangle, and the contest read has no `markerSponsors`. Sponsor placements are for the whole contest, never one game ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), revision 2026-09-30). Edited in place below.

Revised 2026-10-01 (Arthur's rulings): **one state rule.** The console's state pill shows the contest's phase (Draft, Upcoming, Open, Closed) from one shared function, and the fan app and the server's fan list use the same rule. A bingo contest can have its own open and close times. The Overview's "Contest state" card is gone: Close entries, Reopen entries and Move to draft sit in the contest page header. A game-day trivia contest is always publishable, and a trivia contest whose question tags are too small can't publish and isn't listed to fans. One date and time picker replaces every `datetime-local` field. Edited in place below.

Revised 2026-10-03 (brought up to the code): **the trivia contest's own screens are specified here**: the builder's Trivia step and the Trivia tab, the trivia Prizes and Sponsors content, trivia's lock table (D-120) and trivia's Finalize. The lock table drops `tierValue` (prizes state no value since 2026-09-28). Preview is a drawer from the header, not a tab (D-113). A function audit closes the spec. Edited in place below.

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
- **The trivia game itself**: the question bank, runs, scoring, standings, what Finalize does and the fan screens are [`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md). This spec covers the console's trivia contest screens: the builder's Trivia step, the Trivia tab, the trivia Prizes and Sponsors content, and where Finalize appears.

---

## Vocabulary

Screens use these words and no others. Code names are in the model section.

| Term | Meaning | Never say |
|---|---|---|
| **Contest** | What a tenant creates and fans join. Spans one or more games (trivia: one game or none), has a contest type, prize tiers (trivia: prize bands) and sponsor placements. | "activation", "event" |
| **Game** | A scheduled real game from the shared schedule, selected into a contest. | "bet event", "matchup" as a noun for the record |
| **Sport** | The game's league as the schedule names it (NFL, CFB, NBA, NHL, MLB…). | "category" |
| **Contest type** | Bingo or Trivia. | "game type" |
| **Description** | Up to 300 characters fans see on the contest card. | "note", "summary" |
| **Internal note** | Up to 500 characters only the console shows. | "note" on its own |
| **Draft / Open / Closed** | The contest's state. Draft: fans can't see it. Open: fans see it and can join while a game's entries are open. Closed: fans see it under Past and keep playing their boards, and nobody new can join. | "hidden", "visible", "unpublished", "paused" |
| **Upcoming** | Published, and entries aren't open yet. A phase the pill shows (see "State and status"), never a stored state. | "scheduled", "pending" |
| **Publish** | Draft → Open. | "launch", "go live" |
| **Close entries / Reopen entries** | Open → Closed and back. | "pause", "hide" |
| **Move to draft** | Back to Draft, only before the first fan joins. | "unpublish" |
| **Locked** | The contest has at least one fan board (trivia: one run). Not a state. | "frozen", "live" |
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
| `bannerImageUrl` (Wave 4b) | string | no | An https URL, ≤2000 characters, from the `contest.banner` upload; `null` or `""` clears it | The contest's own banner image. Absent means the banner falls back (see "Banner" below). Cosmetic, so it stays editable after the lock. Never sent to fans as such: fans read `banner`. |
| `progressMarkerImageUrl` (2026-09-30; replaces Walk #3's per-game `gameMarkerImageUrls`) | string | no | An https URL from one of the tenant's own uploads (`contest.progressMarker`); `null` or `""` clears it | The contest's own progress marker, on every board of the contest. Absent means the default (see "Progress marker" below). Cosmetic, so it stays editable after the lock. Read through `progressMarkerUrlOf`. |
| `contestType` (new; replaces `gameType`) | one of the contest-type registry's keys | yes | A registry key | Read through `contestTypeOf()`, which answers `contestType ?? gameType ?? "bingo"` during the migration window. Changeable only while Draft and unlocked. |
| `state` | `"draft" \| "open" \| "closed"` | yes | Wave 3 §3.1 | Stored. Read through `contestState()`. Default `draft`. |
| `showContest`, `closed` | boolean | — | Kept consistent with `state` by every writer (Wave 3 §3.1) | Legacy mirrors for older readers. No console control writes them directly. |
| `allowedBetEvents` | ObjectId[] → `BetEvent` | — | Distinct; each must exist in the reference schedule | The games the contest runs at now. |
| `ranAtBetEvents` | ObjectId[] | no | Only grows | Every game the contest has ever run at; read through `ranAtBetEventIds()`. |
| `opensAt` (new, 2026-10-01) | Date | no | Bingo only; before `closesAt` when both are set | The contest's own open time. Absent: entries open with the first game's. Only narrows the games' window (see "Opens and closes"). Locks once fans join (lock kind `opensAt`). |
| `closesAt` (new, 2026-10-01) | Date | no | Bingo only; after `opensAt`; a published contest's can't be moved into the past | The contest's own close time. Absent: it closes when the last game ends. Only narrows the games' window. A trivia contest's times are in `trivia.opensAt` / `trivia.closesAt`, never here. |
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

- **State** (stored, Wave 3 §3.1) is what the operator sets: Draft, Open or Closed. Publish, Close entries, Reopen entries and Move to draft write it, and nothing else does.
- **Phase** (derived; Arthur, 2026-10-01) is what the contest is right now, in one word every surface shares. One pure shared function decides it: `contestPhase(contest)` in `obs-b2b-shared/src/interfaces/b2b/ContestPhase.ts`. It is built on the entries gate (`getB2BContestStatus`), so the pill and the fan app's join button always agree.

| Phase | Label | When |
|---|---|---|
| `draft` | Draft | Not published. |
| `upcoming` | Upcoming | Published, and entries aren't open yet (`opensAt` says when). |
| `open` | Open | Entries are open. For bingo, also while its games are still being played. |
| `closed` | Closed | Close entries was pressed, its close time has passed, or it was finalized. |

- **A close time closes it.** Nobody has to press Close entries: a trivia contest past `trivia.closesAt` reads Closed though its stored state is still Open, and so does a bingo contest past its close.
- **A bingo contest closes once its last game ends**, not at the last tip-off. A game ends at its tip-off plus the sport's usual length (`gameExpectedEnd`, shared `BetEvent.ts`). A bingo contest's own close time can close it sooner (see "Opens and closes"). Between the last tip-off and the last end it takes no new players but is still Open; the fan app calls this time "Live".

**The console's state pill shows the phase, not the stored state:** the Games & Contests cards and list rows, the contest page header and the builder. Upcoming is drawn in the console's info blue (the `--info` token, Badge `info`). An Upcoming contest's list row says when it opens in its date column: "Opens Thu · 7:20 PM" within 6 days, else "Opens Oct 9 · 7:20 PM". Its card shows "Fans can join from Thu, Oct 1" in the sparkline's place until it has players.

**Everything else uses the same rule.** The fan app's Contests tabs (Live & Upcoming holds `upcoming` and `open`; Past holds `closed`), the server's fan list (`GET /b2b/contest/list-contests?status=`) and the Start screen's next game all read the phase through `fanTabOfPhase`. The staff screens (All contests, the tenant page, Overview's upcoming games) still show the older four words (Upcoming, Open, Closed, Finished), read through `contestStatusOfPhase` so they say what the pill says.

**Finalized** is a badge beside the state pill ("Finalized"), never a state. A finalized contest reads Closed whatever its stored state; the console reads it as read-only everywhere.

### Opens and closes

A bingo contest's entry window comes from its games: entries open with the first game's (48 hours before its tip-off) and the contest closes when the last game ends. Since 2026-10-01 a bingo contest can also have its own open and close times, `opensAt` and `closesAt` on `B2BContest`. They only **narrow** the games' window, never widen it:

- **Effective open** is the later of its own open time and the first game's entries opening. An open time after every game has started means it never opens.
- **Effective close** is the earlier of its own close time and the last game's end.

Both are applied in `getB2BContestStatus` (the entries gate), so the fan side follows without its own check: `joinRefusal` and board creation refuse `not_open_yet` with `opensAt` before the open time, and `closed` after the close time. The fan app and the console's pill read the same answer.

A trivia contest's times stay in its trivia settings (`trivia.opensAt`, `trivia.closesAt`; [`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)). Sending top-level times for a trivia contest is refused: "A trivia contest's times are in its trivia settings."

| Rule | Detail |
|---|---|
| Order | The close time must be after the open time: "It must close after it opens." |
| Published | A published contest's close time can't be moved into the past or before it opens: "The close time can't be before the contest opens, or in the past." A draft's times don't matter until it is published. |
| Lock | Once fans join, the open time locks (lock kind `opensAt`): "Fans have joined this contest, so its open time can't change. You can still move the close time." The close time stays free in either direction, within the rule above. |
| Close entries, then Reopen | Keeps the stored close time. The contest still closes then. |
| Duplicate | Doesn't copy them. |

**Editing.** The builder's Basics step and the Overview's Basics card carry two fields, "Opens" and "Closes", each the console's date and time picker (`DateTimeField`, below). Blank means the games' own time:

| Field | Help when blank | Help when set |
|---|---|---|
| Opens | "When the first game's entries open, 48 hours before its tip-off. Set a time to open later." | "Fans can join from this time, once a game's entries are open. Clear it to open with the games." |
| Closes | "When the last game ends. Set a time to close earlier." | "Entries close, and the contest closes, at this time or when the last game ends, if sooner." |

Once locked, Opens reads as a value with the lock glyph and the `opensAt` sentence under it. Review lists an "Opens and closes" row.

**On the wire.** `POST` and `PATCH` take `opensAt` and `closesAt` (ISO; `null` clears back to the games' own). The contest read carries `entryWindow: { opensAt, closesAt }`, each nullable. List rows carry `phase`, `opensAt` (when Upcoming) and `closesAt` (the effective close).

### The date and time picker

One console component, `DateTimeField` (`src/components/ui/dateTimeField.tsx`), replaces every `datetime-local` input in the console: a bingo contest's Opens and Closes, and the trivia schedule on the builder's Trivia step and the Trivia tab. The native input reported an empty value until every part was typed, which is how typed trivia times were lost.

- **Date**: a button that opens a calendar popover. Month paging, today marked, the chosen day filled, days out of range disabled. Keys: arrows, PageUp, PageDown, Home, End, Enter, Escape.
- **Time**: a box that takes typed times ("7pm", "7:20 pm", "19:20", "noon") or a pick from a quarter-hour list (a combobox). The zone abbreviation sits beside it.
- **Clear** (×) makes the field blank. `min` and `max` bound it.
- **Errors** show inline under the field: "Type a time like 7:30 PM." for a time it can't read, "Pick a time after Fri, Oct 9 · 6:00 PM." for one out of range.
- **Values** are ISO instants to the minute, in the operator's local time.

### Transitions and where they live

Transitions are Wave 3's (§3.1). The console offers exactly these, and only where the transition is allowed:

| From | Action | To | Offered when |
|---|---|---|---|
| Draft | **Publish** | Open | Every publish check passes (below). Lives on the builder's Review step; the contest page's draft banner ("Continue setup") leads there. |
| Open | **Close entries** | Closed | Not finalized |
| Closed | **Reopen entries** | Open | Not finalized |
| Open or Closed | **Move to draft** | Draft | Not locked, not finalized |

An action that isn't allowed is absent, not disabled (D-059). Close entries, Reopen entries and Move to draft live in the contest page header (2026-10-01; see "The contest page"), and Close and Reopen also in the card and row overflow. Members see none of them.

### Publish checks

Checked by the server on every move into Open from Draft (`PATCH` with `state: "open"`, or create with `state: "open"`), refused with **409 `publish_blocked`** and `reasons: [{ key, message }]`:

| Key | Fails when | Message |
|---|---|---|
| `trivia_incomplete` | Trivia whose settings aren't ready: no config, no question slot, or a close time not after its open time | "Add the trivia questions and set when entries open and close." |
| `trivia_short_questions` | Trivia with a question tag that holds too few questions for every run a fan can play (`triviaShortfalls`; [`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)) | "Some question tags don't hold enough questions for every run a fan can play. Add questions in the Question bank, or lower the runs per fan." |
| `no_prize_bands` | Trivia with no complete prize band | "Add at least one prize band." |
| `no_games` | Bingo with no games | "Add at least one game." |
| `all_started` | Bingo only: every game has started (a test-mode contest is exempt, Wave 3 §5) | "Every game in this contest has started. Add one that hasn't." |
| `no_complete_tier` | Bingo with no complete tier ([`admin-prizes.spec.md`](admin-prizes.spec.md) defines complete) | "Finish at least one prize tier." |
| `tier_needs_details` | Any tier needs details | "Finish or remove the prize tiers that need details." |

Nothing about props: whether a game has players yet is the fan side's refusal (`no_players_yet`, Wave 3 §3.3), not a publish check.

**Trivia's times never block Publish** (Arthur, 2026-10-01). Neither its game having started nor its own close time having passed stops it: a draft's times don't matter until it is published. If its open time has passed it is live at once; if its close time has passed it closes at once. Review says so beside Publish, without blocking it (`contestPublishNotes`, shared `ContestPublish.ts`):

| Note | When | Copy |
|---|---|---|
| `closes_on_publish` | Its close time has passed | "Its close time has passed, so it closes as soon as it's published. Change the close time first?" with the button "Change the close time" |
| `opens_on_publish` | Only its open time has passed | "Its open time has passed, so fans can play as soon as it's published." |

### Description and the internal note

Today's "Note" (`contestDescription`) was labelled "Only people in this console see the note." while the fan reads sent it to every fan. The ruling makes the field fan-facing. Exposing old notes would break the promise the console made when they were written, so the migration moves every existing note to `internalNote`, and `description` starts empty everywhere. Both fan reads switch to an allowlisted projection in the same change: `description` goes out, `internalNote` never does.

**The current fan app shows the description.** Today's fan app renders no contest description anywhere. Wave 4 adds it to the current app's contest card (under the date line, two lines, muted, omitted when empty) and under "Draft Your Squad"'s subtitle, so the console's "Fans see this on the contest card." is true and the Preview can show it. This is a one-line addition to existing screens, not part of the parked overhaul.

### Contest types: the registry

`contestType` lives on the contest, never on the tenant (`GAME-F1`). The types come from **one registry** in shared, `obs-b2b-shared/src/interfaces/b2b/contestTypes.ts`:

```ts
export const CONTEST_TYPE_REGISTRY = {
  bingo:  { label: "Bingo",  playable: true,  thresholdUnit: { one: "bingo", other: "bingos" } },
  trivia: { label: "Trivia", playable: true,  thresholdUnit: { one: "place", other: "places" } },
} as const;
export type ContestType = keyof typeof CONTEST_TYPE_REGISTRY;
export const CONTEST_TYPES = Object.keys(CONTEST_TYPE_REGISTRY) as ContestType[];
```

Everything that lists types reads the registry and nothing else: the home's Type filter, the builder's type cards, the contest type field, the list endpoint's `type` validation, and the console's vocabulary helper (`src/lib/contestTypes.ts`, renamed from `gameTypes.ts`). Adding a type is adding a registry entry; no screen hardcodes a chip.

**Trivia** was the one placeholder D-068 allowed (Arthur's 2026-09-24 clarification). It is now playable (`playable: true`, threshold unit "place"), and its settings, publish checks and lock are [`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)'s. Board generation keeps refusing a non-bingo contest (`not_playable_here`).

The type can change only while the contest is a Draft and unlocked. The server refuses a type change otherwise (409 `not_draft`, or 409 `contest_locked` kind `contestType`).

### Indexes

Connectors run with `autoIndex: false`; indexes are declared on the models and created per environment by the index script.

| Collection | Index | Why |
|---|---|---|
| `contests` | `{ organizationId: 1, state: 1, _id: -1 }` | The list: drafts lead, the state filter, Newest by `_id`. Also serves every tenant-scoped contest read. |
| `bingo_boards` | `{ contestId: 1, clerkUserId: 1 }`, unique | One board per fan per contest ([`contest-safety.spec.md`](contest-safety.spec.md)). Also serves player counts and the sparkline. |

Name uniqueness stays check-then-write (Known gaps).

### What the fan side honours

Wave 3 owns the checks and their codes (§3.1, §3.4): a draft answers 404 to fans, a closed contest refuses joins with `closed`, a full one with `full`, a non-playable type with `not_playable_here`, a game with no players yet with `no_players_yet`, and entries not yet open with `not_open_yet` plus `opensAt`. Every control on these screens maps to one of those.

Since 2026-10-01 a bingo contest's own open and close times are part of the same gate (see "Opens and closes"), the fan list filters by phase (`status=`, see "State and status"), and a trivia contest that can't run (a question tag too small, see "Publish checks") is listed to fans nowhere, not on the Contests page and not among the Start screen's sponsors or next game, until it can.

Both fan reads (`GET /b2b/contest/list-contests`, `GET /b2b/contest/:contestId`) return the allowlisted projection only: `contestId`, `contestName`, `description`, `contestType`, `banner` (below), the fan status, games, the fan fields of prize tiers. The contest read also carries `progressMarkerImageUrl` (absent when the contest has none), for the board's progress marker. `internalNote`, `state` internals, `lockedAt`, `testMode` and audit-relevant fields never leave the admin surface.

### Banner

Every contest has a banner: a wide band across the top of its card and its page, in the console and in the fan app alike. It is chosen by one pure shared function, `contestBannerOf(contest, org, sponsorBanner)` (`interfaces/b2b/ContestBanner.ts`), in this order:

1. **The contest's own image** (`bannerImageUrl`), uploaded in the console (field `contest.banner`, [`admin-uploads.spec.md`](admin-uploads.spec.md)). Drawn cover-cropped.
2. **The Board banner sponsor's artwork**: the sponsor holding the contest-wide Board banner slot, when it has a board banner. Drawn whole, never cropped, with the sponsor's name as its alt text.
3. **The tenant's brand default**: a band drawn from the tenant's effective theme: the theme saved on Brand, else its onboarding colours (`effectiveTheme(org.subdomain, org.branding.theme)` from `theme/seeds.ts`, the same source the console's accent follows), else the neutral default (revised 2026-09-28, final walk): its primary into its accent (or a deeper step of the primary for a one-colour brand), a quiet diagonal, its https logo when it has one, and its name. The ink is measured against the band. Nothing is stored for it, so every tenant, today's and every future one, has a banner from the day it exists; there is nothing to seed.

The server sends the choice, not pixels: `{ kind: "image", source: "custom" | "sponsor", imageUrl, sponsorName? }` or `{ kind: "brand", from, to, ink, logoUrl?, name }`. The console's rows and the contest page carry it as `contestBanner` (the page also carries `bannerImageUrl` and `defaultBanner`, what Remove goes back to); both fan reads carry it as `banner`. The console card and the fan card draw the same view, so they agree. The console's slug-derived tint (`tenantColors`) is no longer used for contests.

**Editing.** The builder's Basics step and the Overview's Basics card carry the banner field: the console's drag-and-drop or browse upload, a 4:1 preview of what fans see, and one line saying what shows now ("Showing your brand colors. Upload an image to use your own.", "Showing Northside's board banner. Upload an image to use your own.", or "Your image. Remove it to go back to your brand colors."). **Remove** returns the contest to its default. Uploading only stores the file; the contest takes it when the form is saved, like every other field.

### Progress marker

The mark that rides a board's prize progress bar (Arthur's Walk #3 ruling, 2026-09-29; revised 2026-09-30). A contest's games share one board, so the marker is a contest setting, never a per-game one. One pure shared function decides it, `resolveProgressMarker` (`interfaces/b2b/ProgressMarker.ts`), and the fan board, the console's preview (the fan app itself) and the Overview's field all read it:

1. **The contest's own marker** (`progressMarkerImageUrl`), set on the Overview's Basics card.
2. **The tenant's Brand marker** (`branding.assets.sliderTipImageUrl`).
3. **The default: a small triangle** above the bar, pointing down at the fill's tip, in the tenant's Text colour. The fan app draws it in `--foreground` (the theme's `neutrals.textPrimary`), so it always follows the theme; no colour is stored or hardcoded for it.

No sponsor takes part: the sponsor Slider slot and its slider icon were removed on 2026-09-30 ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)). A contest that wants a sponsor's mark on its boards uploads it as the contest's Progress marker. The fan app shows the first image that loads and falls through to the next when one fails, ending on the triangle, so a broken file costs its own layer and never the marker. Trivia has no board, so a trivia contest has no marker.

**Editing.** The Overview's Basics card (bingo only) carries the field "Progress marker": the console's upload field (`contest.progressMarker`, the Brand marker's types and size, hint "Shown at up to 48 × 36 px, in place of the Brand marker on this contest's boards."), with "Replace" and "Remove", and one line saying what shows now ("Rides the prize progress bar on every board in this contest. Remove it to go back to the Brand marker." or, with none, "Default: the Brand marker. Upload an image to use your own on every board in this contest."). It lists no sponsor icon. The image must be one of the tenant's own uploads: the server refuses any other address (400, "Upload the image here instead of linking to it."). Remove returns the contest to the default. It saves with the form, like every other Basics field. The builder has no marker control; a new contest's marker is set from its page. Duplicate keeps the marker.

**Migration** (dev only): `node-server/scripts/progress-marker-migration.mjs` (dry run by default, `--apply` writes) moves a contest's per-game markers onto the contest when they agree, removes the per-game field, and reports a contest whose games had different markers, leaving it for a person to set on the Overview.

### Unsaved changes

Nothing about a contest saves as you go (Arthur, 2026-09-27). No field saves on blur or Enter, no tick saves at once, and nothing is kept in browser storage as a draft. Every editor holds its edits until an explicit save:

- **The builder**: "Save draft" in its header saves every step's unsaved edits (Basics, games, sponsors; the ladder through its own "Save prizes"), the first one creating the draft. The footer's primary reads "Save and continue" while anything is unsaved (and before the draft exists), "Continue" otherwise.
- **The contest page**: each tab that edits has its own save bar, pinned to the bottom of the page while it holds edits: "Unsaved changes" (or what waits: "2 games to add and 1 to remove") with "Discard" and "Save", then "Saved." once it went through, or the refusal's sentence.

**"Leave without saving?"** A centred dialog, with "Leave" and "Keep editing", appears **only when there are unsaved changes**, and **always** on `/contests/new` before the draft exists ("This contest hasn't been saved yet."). It covers every way out: an in-app link or tab (the router's blocker; a change of query alone is not leaving), the builder's own step moves, Back and Exit, and closing or reloading the browser tab (the browser's own prompt). "Leave" drops the unsaved edits and goes; "Keep editing" stays with them. The hook is shared: `lib/useLeaveGuard` (the prize page uses it too), with `lib/unsavedChanges` totalling the edits of a screen made of several editors.

---

## The lock

The ruling: no contest versioning; before the first fan joins everything is editable, and after it the things fans play and win under lock. [`contest-safety.spec.md`](contest-safety.spec.md) builds the stamp (`lockedAt`), the refusals (`409 contest_locked`) and the pure functions both sides call (`contestIsLocked`, `gameLockViolations`, `tierLockViolations`, `gameTypeLockViolations`). This section is the console's contract with it. This spec adds one lock kind, `opensAt` (2026-10-01, see "Opens and closes"), and uses `closesAt` for the close-time rule. The trivia kinds (`trivia_rules`, `bandRemoved`, `bandPrize`) are [`contest-safety.spec.md`](contest-safety.spec.md)'s.

### What stays editable and what locks

| Setting | Before the first board | After |
|---|---|---|
| Name, description, internal note, player limit, banner, progress marker | Editable | Editable |
| Close entries, Reopen entries | Editable | Editable |
| **Move to draft** | Offered | **Absent** (fans can't have a contest they played hidden from them, Wave 3 §3.1) |
| Adding games | Editable | Editable |
| **Removing a game** | Editable | **Locked** |
| **Open time** (bingo `opensAt`) | Editable | **Locked** (kind `opensAt`) |
| Close time (bingo `closesAt`) | Editable | Editable in either direction, never before it opens or in the past (kind `closesAt`) |
| **Contest type** | Editable while Draft | **Locked** |
| Prize tiers | [`admin-prizes.spec.md`](admin-prizes.spec.md) | A tier can't be removed or change its bingos to win (kinds `tierRemoved`, `tierBingos`); adding a tier and changing a tier's prize stay free |
| **Delete** | Typed name | Typed name (the dialog says what goes with it; revised 2026-09-28, no reverification) |

That table is bingo's (`ContestLock.ts`: `gameLockViolations`, `tierLockViolations`, `gameTypeLockViolations`, `scheduleLockViolations`). A trivia contest locks at its first run (the run start stamps `lockedAt`), by its own table (D-120; `TRIVIA_LOCKED_FIELDS`, `triviaRulesLockViolations`, `triviaBandLockViolations`, `closeTimeViolations`):

| Setting (trivia) | After the first run |
|---|---|
| Name, description, internal note, banner, Presented by sponsor, reveal mode | Editable |
| Question slots (count and tags), time per question, right-answer points, speed bonus, network allowance, runs per fan, the game and At a game / On its own, the open time | **Locked** (kind `trivia_rules`) |
| Close time (`trivia.closesAt`) | Editable in either direction, never before it opens or in the past (kind `closesAt`) |
| Prize bands | Add a band or widen one. A saved band can't be removed or narrowed (kind `bandRemoved`), and its prize can't be swapped (kind `bandPrize`; see Known gaps) |
| Contest type, Move to draft, Delete, Close and Reopen entries | As bingo |

**Why removing a game locks.** A fan's board holds props from the games the contest ran at when they built it. The evaluator scores a square by its prop, not by whether the contest still lists the prop's game, so squares from a removed game keep scoring and keep paying. Removing a game after fans joined therefore does not remove it from play; it only removes it from the console, which then misreports what fans are playing. Locking is the one option that keeps every promise. Adding a game stays open because it only gives fans more to pick from.

### How the console shows it

- **The glyph.** A lock glyph beside the state pill on the card, the list row, the contest page header and the staff rows, with the tooltip "Locked since the first fan joined: what fans play and win under can't change. Open the contest to see what still can." (one sentence for bingo and trivia, 2026-10-01).
- **Locked controls read as values** with one plain line where the control was (D-059: never a disabled control that might wake up). Games tab: `CONTEST_LOCK_COPY.gameRemoved`, "Fans have joined this contest, so its games can't be removed. You can still add games." A trivia contest's Trivia tab shows its locked settings as values with the lock glyph and the `trivia_rules` sentence up front, not on Save; only Closes stays a field ([`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)).
- **A 409 `contest_locked` from a write** (the lock landed between loading and saving) renders as an inline error under the field that was being saved, using the refusal's own sentence. The page then re-reads the contest so every other locked control turns into its value.
- **One wording.** `CONTEST_LOCK_COPY` in shared is the source; the console never writes its own lock sentences.

---

## The screens

Visual language is the console's existing one, built from its tokens only: segmented controls, never switches. Inline confirmation lines, never toasts. Muted-sentence empty states. KPI tiles with the hue outline. Numbers in the display face with tabular digits. Every asset field is the console's upload field ([`admin-uploads.spec.md`](admin-uploads.spec.md)).

### `/games` — Games & Contests

**Header.** Eyebrow "Games"; H1 "Games & Contests" (set in uppercase by the headline style); right: the primary action "New contest" for anyone who can write. The action opens `/contests/new`.

**Toolbar** (G1's sticky list toolbar), two rows:

1. Search over contest names ("Search contests by name"). On the right: **Sort** (select: "Next game first", "Newest first", "Most players"; default "Next game first") and the **view toggle** beside it, a segmented "Cards | List" with icons.
2. **Status**: segmented "All · Draft · Upcoming · Open · Closed", filtering by phase (see "State and status"). Finalized contests sit under Closed with their Finalized badge. **Type**: segmented "All" plus one segment per registry type, generated from `CONTEST_TYPE_REGISTRY` (today "Bingo", "Trivia"); it grows when a type is added. On the right, the count: "12 contests".

Search, filters and sort live in the URL (`/games?q=&state=&type=&sort=`), so Overview and Operations can link straight into a filtered list. Changing any of them restarts the list from the top. The **view** does not live in the URL: it is remembered per user in local storage under `obs.contests.view.<userId>` (`cards` or `list`, default `cards`), read in a try/catch so a blocked store falls back to cards.

Both views are endless lists over the same `GET /admin/contests` query: `InfiniteList` for cards, `InfiniteTable` for the list, pages of 20, loading the next page 600px before the end.

**The card view.** Two columns at ≥1100px, one below.

1. **Band**, 4:1: the contest's banner (above): its own image, else its Board banner sponsor's artwork, else the tenant's brand band in the tenant's own colours, logo and name. Never a placeholder image and never a colour made up from the slug. Over the band, top left: the state pill (the phase: "Draft", "Upcoming", "Open", "Closed"), the "Finalized" badge when finalized, and the lock glyph when locked.
2. **Body.** Type chip (from the registry); the name; the description, two lines, muted, omitted when empty. On the right, the sparkline: new players per day over the last 14 days, 96×28 in the tenant colour, captioned "+18 this week" or "None new this week", omitted until the first player. An Upcoming contest shows "Fans can join from Thu, Oct 1" in the sparkline's place until it has players.
3. **Stats row**: **Players** ("412", or "412/500" with a limit); the middle stat, by type; **Prizes** (the count, with "tiers" for bingo or "bands" for trivia under it; no maximum shown). The middle stat for bingo is **Games** (the count, with the featured game under it, picked by Wave 3's `featuredGame`: "Live: Denver @ Fighting Hawks", "Next: Denver @ Fighting Hawks · Sat 7:00 PM", or "Final: Montana State @ Fighting Hawks · Sep 19"). For trivia it is its window: **Opens** while Upcoming, else **Runs**, with the date (as the list's date cell says it) and under it the matchup, or "On its own" for a contest with no game.
4. **Footer**: a Draft shows "Continue setup" (opens the builder at the first step that isn't done). For Overboard staff, a contest the server calls ready to finalize shows **Finalize** with its "Staff" tag (revised 2026-09-28). A finalized contest shows "Finalized Sep 15". At the right, the **overflow menu** ("More actions"): "Close entries" (Open) or "Reopen entries" (Closed), "Duplicate", and "Delete" (not finalized). Members get no overflow.

**The list view.** A dense table, one row per contest, same order and filters:

| Column | Content |
|---|---|
| Name | The name, with the lock glyph when locked |
| Type | Registry label |
| State | The state pill (the phase), and the Finalized badge when finalized |
| Next game | Two lines. On top, when the contest next does something: "Opens Thu · 7:20 PM" for an Upcoming contest, else `featuredGame`'s date ("Thu · 7:20 PM", "Live now", "Final Sep 19"), else for a trivia contest with no game "Closes Thu · 9:00 PM" or "Closed Oct 1"; "—" when there is nothing. Under it, muted, the matchup, cut with an ellipsis. |
| Games | Count |
| Players | Count, "/500" when limited |
| Prizes | Count: tiers for bingo, bands for trivia (row field `prizeCount`) |
| Created | "Sep 21" |
| (actions) | The same overflow menu as the card |

The row opens the contest page. The overflow is its own focus stop and doesn't open the row.

**It never scrolls sideways at 1280–1440px.** Cells are padded tightly, the name and the date column wrap, and below 1366px the Created column is hidden. The row actions (Finalize with its Staff tag, and ⋯) always stay visible.

**Interactions.**

- A card or row opens `/contests/:contestId` (Overview). "Continue setup" and the overflow stop the click from reaching the card.
- **Close entries / Reopen entries** from the overflow write at once (PATCH `state`) and confirm on the card's footer (the row's Next game cell in the list): "Entries closed. Fans who joined keep playing." or "Entries open." A failure shows its sentence in the same place.
- **Delete** opens the Delete dialog (below). On success the card or row is removed from the list and the count drops by one.

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
| Status filter | "All", "Draft", "Upcoming", "Open", "Closed" |
| Type filter | "All", then each registry label |
| Sort | "Sort", "Next game first", "Newest first", "Most players" |
| View toggle | "Cards", "List" (accessible name "View") |
| Count | "12 contests", "1 contest" |
| Chips | "Draft", "Upcoming", "Open", "Closed", "Finalized", and the registry labels |
| Lock tooltip | "Locked since the first fan joined: what fans play and win under can't change. Open the contest to see what still can." |
| Stat labels | "Players", "Games" (bingo), "Opens" or "Runs" (trivia), "Prizes" with "tiers" or "bands" |
| Game lines | "Next: Denver @ Fighting Hawks · Sat 7:00 PM", "Live: Denver @ Fighting Hawks", "Final: Montana State @ Fighting Hawks · Sep 19", "No games yet", "On its own" (trivia with no game) |
| Opening line | "Fans can join from Thu, Oct 1" |
| Date cell | "Opens Thu · 7:20 PM", "Opens Oct 9 · 7:20 PM", "Live now", "Final Sep 19", "Closes Thu · 9:00 PM", "Closed Oct 1" |
| Sparkline caption | "+18 this week", "None new this week" |
| List columns | "Name", "Type", "State", "Next game", "Games", "Players", "Prizes", "Created" |
| Overflow | "More actions", "Close entries", "Reopen entries", "Duplicate", "Delete" |
| Confirmations | "Entries closed. Fans who joined keep playing.", "Entries open." |
| Draft footer | "Continue setup" |
| Finalized footer | "Finalized Sep 15" |
| Empty / no matches | "No contests yet.", "No contests match.", "Clear search and filters" |
| Member line | "Only organization admins can change contests." |
| Later page failed | "Couldn't load more.", "Try again" |

### `/contests/:contestId` — the contest page

A full page, reached from a card or row, from Overview and Game day links, and for staff from All contests and the tenant page with `?tenant=<slug>` (which sets the console's acting tenant before the read, so the sidebar and every link agree). A tenant user whose URL names a tenant gets the same "Contest not found." state as a wrong id: the server refuses a non-staff `?tenant=` with 403, and the console does not confirm the contest exists.

**Header.**

- Back link: "Games & Contests" to `/games`, or "All contests" / the tenant's name when the page was opened from those (carried in navigation state, falling back to "Games & Contests").
- The contest's banner across the top of the header, a wide strip (88–150px tall) of the same view the card shows.
- Eyebrow "Contest · Bingo" (the registry label); H1 the name; chips: the state pill (the phase), "Finalized", the lock glyph.
- Right (2026-10-01): the state actions first, each only when allowed (see "Transitions and where they live"): **Close entries** (in the console's warning colour, Button variant `warning`), **Reopen entries**, **Move to draft** (only while unlocked). None on a finalized contest, and members see none. Then "Preview" (secondary; opens the preview drawer over the current tab, on the screen that shows what that tab edits; D-113); then, for Overboard staff on a contest ready to finalize, **Finalize** with its "Staff" tag; then the overflow ("More actions"): "Duplicate", "Delete contest".
- The state actions write at once (PATCH `state`) and confirm under the header: "Entries closed. Fans who joined keep playing.", "Entries open.", "Moved to draft. Fans can't see it now." A refusal shows its sentence there; a stale one (409 `stale_contest`) offers "Reload". Publish is not in the header: it stays the builder's Review step, reached from the draft banner's "Continue setup".

**Tabs**: "Overview · Games · Prizes · Sponsors" for bingo and "Overview · Trivia · Prizes · Sponsors" for trivia (D-114: the page mirrors its builder), with counts on Games and Prizes (the Prizes count is tiers for bingo, bands for trivia). The tab is in the URL: `/contests/:contestId` (Overview), then `/games` or `/trivia`, `/prizes`, `/sponsors`. An address naming the other type's tab opens this contest's own; an unknown tab segment opens Overview; the old `/preview` address opens the preview drawer over Overview. A prize opens as its own full page ([`admin-prizes.spec.md`](admin-prizes.spec.md)). Code: `pages/contests/ContestPage.tsx`.

**Page states.**

| State | What renders |
|---|---|
| Loading | Header skeleton and the active tab's skeleton. |
| Not found (wrong id, other tenant, or deleted elsewhere) | "Contest not found." with "Back to Games & Contests". |
| Load failed | `ReportableLoadError`. |
| Draft | A banner under the header: "This is a draft. Fans can't see it until you publish." with "Continue setup". |
| Just published | "Published. Fans can see it now." under the header, for this visit only. |
| Trivia that can't run (a question tag is short, `questionShortfalls`) | A warning banner under the header: "Fans can't play this contest. The "nfl" tag has 4 questions and needs 6 (2 questions a run). It's hidden from fans until every run has enough questions." with "Open Question bank". On a draft: "This contest can't run yet. … Add questions before you publish, or lower the runs per fan." |
| Locked | Glyph in the header; locked controls read as values on every tab. |
| Finalized | "Finalized" badge; every tab read-only; the overflow offers only "Duplicate"; the header line "Finalized on Sep 28. Nothing about this contest can change." |
| Member | View-only on every tab, with "Only organization admins can change contests." under the header. No overflow; "Preview" stays. |
| Stale write (409 `stale_contest`) | Inline, where the save happened: "This contest changed while you were editing, so nothing was saved. Reload to see the current version and make your change again." with "Reload". |
| Unsaved edits on a tab | The tab's save bar at the bottom of the page; a tab change, a link or closing the tab asks "Leave without saving?". |

**Duplicate** creates a new draft ("Copy of Rivalry Week", numbered if taken) with the description, internal note, contest type, player limit, the games that haven't started, the prize tiers (as new tiers naming the same library prizes), and the sponsor placements (each for the whole contest). It doesn't copy a bingo contest's own open and close times. It opens the new draft in the builder at Basics.

#### Overview tab

Two columns at ≥1100px (content, then a 320px right rail); one below, with the rail after the content.

**KPI tiles** (hue outline, 40px numbers):

| Tile | Value | Shown when |
|---|---|---|
| "Players" | The board count, with "of 500" under it when limited | Always (0 on a new contest is true) |
| "Boards with a bingo" (bingo) | Boards with at least one claimed line | Not a Draft |
| "Finished a run" (trivia) | Fans with at least one completed run (`kpis.finishedFans`), with "N% of players" under it | Not a Draft |
| "Prizes awarded" | Redemptions that pay a tier (not skipped) | Not a Draft |
| "Failed sends" | Failed prize sends for this contest | Only when above 0; links to Prizes → Deliveries filtered to this contest and to Failed |

**No state card** (removed 2026-10-01). The state actions sit in the page header (see "Header" above), and a draft's way to Publish is the draft banner's "Continue setup".

**Basics**, a form with one Save. Editing a field changes nothing stored; the save bar at the bottom of the page ("Unsaved changes", "Discard", "Save") appears with the first change. Save checks the form (errors under their fields, and "Some changes need another look." in the bar), then sends one PATCH naming only the fields that changed, with the precondition; the bar then says "Saved.". Discard puts the stored values back. A stray space is no change.

1. **Name.** Text, required, 80 characters.
2. **Description.** Textarea with a counter ("112/300"); help "Fans see this on the contest card." When the description is empty and the internal note has text, the button "Use the internal note" copies the note into the field unsaved, so the operator reviews it and saves with Save. A note longer than 300 characters copies whole and Save answers "Keep it to 300 characters." until it's shortened.
3. **Internal note.** Textarea, 500 characters; help "Only people in this console see the internal note."
4. **Player limit** (bingo only: a trivia contest stores no limit). Segmented "No limit | Limit to" with a number ("players"). Lowering below the current player count states the consequence before saving: "412 are already playing. Nobody is removed; new fans can't join."
5. **Contest type.** On an unlocked Draft, segmented from the registry ("Bingo | Trivia"). Otherwise the value, with the lock glyph once locked.
6. **Banner.** The banner field (see "Banner"). A member sees the banner itself.
7. **Progress marker** (bingo only; 2026-09-30). The marker field (see "Progress marker"). It lists no sponsor's slider icon. A member sees the marker itself.
8. **Opens** and **Closes** (bingo only; 2026-10-01). The contest's own open and close times, each the date and time picker (see "Opens and closes"). Once locked, Opens reads as a value with the lock glyph.

**Test mode is not on any console screen** (Arthur, 2026-09-27: Wave 3's dev-only "join after kickoff" switch doesn't belong on a customer screen). It stays dev tooling: set through `PUT /admin/dev/contests/:contestId/test-mode` from a script or the browser console, as the end-to-end runbook shows ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §5).

**Danger zone** (writers, not finalized), last in the content column: a bordered card "Delete contest" with the line "Deletes the contest, its fans' boards, its prize tiers and its sponsor placements. Prizes already sent stay on record." (trivia: "Deletes the contest, its fans' runs and its sponsor placements. Its prize bands go with it; prizes already sent stay on record.") and the button "Delete contest", which opens the Delete dialog.

**Right rail, "What's next"**, a short timeline:

- **Next game** (bingo): `featuredGame`'s line with its readiness dot from game day, linking to Game day on that game; "No upcoming games" when none.
- **When it runs** (trivia, in place of Next game; `TriviaWindowStep` in `OverviewTab.tsx`): "Opens" with "Thu, Oct 1 · 7:00 PM. Closes Thu, Oct 1 · 9:00 PM." before it opens, "Open now" with "Closes …" while open, "Closed" with "Closed …" after; "Not set yet." before the Trivia step is saved.
- **Lock**: "Not locked. Everything can change until the first fan joins." or "Locked since Sat Sep 27, 7:02 PM."
- **Finalize**: a tenant admin or member reads "Overboard finalizes the contest after its last game." (trivia: "Overboard finalizes the contest after it closes.") or "Finalized on Sep 28." Overboard staff (revised 2026-09-28, final walk) read "Every game has ended." with **Finalize** and its "Staff" tag once the contest is ready, and otherwise why it can't be finalized yet, in the one rule's order: "A draft can't be finalized. Publish it and play its games first.", "A contest with no games can't be finalized. Add a game first.", or "Finalize opens once every game has ended." For trivia (`lib/finalize.ts`): ready reads "The contest has closed. Anyone still answering is stopped where they stand."; not ready reads "A draft can't be finalized. Publish it first." or "Finalize opens once the contest closes."

**Copy.**

| Element | Copy |
|---|---|
| Tiles | "Players", "of 500", "Boards with a bingo", "Finished a run", "N% of players", "Prizes awarded", "Failed sends" |
| Header actions | "Close entries", "Reopen entries", "Move to draft", "Entries closed. Fans who joined keep playing.", "Entries open.", "Moved to draft. Fans can't see it now.", "Reload" |
| Field labels | "Name", "Description", "Internal note", "Player limit", "Contest type", "Opens", "Closes" |
| Help | "Fans see this on the contest card.", "Only people in this console see the internal note." |
| Nudge | "Use the internal note" |
| Player limit | "No limit", "Limit to", "players", "412 are already playing. Nobody is removed; new fans can't join." |
| Save bar | "Unsaved changes", "Discard", "Save", "Saving…", "Saved.", "Some changes need another look." |
| Banner | "Banner", "Showing your brand colors. Upload an image to use your own.", "Showing Northside's board banner. Upload an image to use your own.", "Your image. Remove it to go back to your brand colors.", "A wide image, about 4 to 1, shown across the top of the contest's card and page." |
| Field errors | "Give the contest a name.", "Keep it to 80 characters.", "Keep it to 300 characters.", "Keep it to 500 characters.", "Enter a number from 1 to 1,000,000.", "Another contest in this workspace already has this name." |
| Danger zone | "Delete contest", "Deletes the contest, its fans' boards, its prize tiers and its sponsor placements. Prizes already sent stay on record.", for trivia "Deletes the contest, its fans' runs and its sponsor placements. Its prize bands go with it; prizes already sent stay on record." |
| Rail | "What's next", "Next game", "No upcoming games", "Lock", "Not locked. Everything can change until the first fan joins.", "Locked since Sat Sep 27, 7:02 PM.", "Finalize", "Overboard finalizes the contest after its last game.", "Finalized on Sep 28." |

#### Games tab

An `InfiniteTable` of the contest's games (`GET /admin/contests/:contestId/games`): games in progress first, then upcoming soonest first, then played games newest first. Columns: **Sport** (the readable name: "NFL", "College football"…), **Game** (matchup, "Denver @ Fighting Hawks"), **Tip-off** ("Sat Oct 3 · 7:00 PM"), **State** ("Upcoming", "Live", "Final", from Wave 3's derived game status), and a **Remove** action before the lock. There is no Progress marker column (2026-09-30): the marker is the contest's, on the Overview.

Nothing saves as it's clicked (see "Unsaved changes"): games to add and games to remove wait in the tab, and the save bar ("1 game to add and 1 to remove", "Discard", "Save") writes them all. Save adds in one call, then removes each game, every write on the version the previous one answered with; a refusal keeps what didn't go through on screen, with its sentence in the bar.

- **Remove** (before the lock) marks the row "Removed when you save", with "Keep" to take it back. Sponsor placements are the contest's, so removing a game changes none of them.
- **After the lock** the Remove column is gone and one line sits above the table: the `gameRemoved` lock sentence.
- **"Add games"** (writers, not finalized) opens an inline picker panel at the top of the tab, not a drawer: the game picker (below) over `GET /admin/games/candidates?contest=<id>`, the contest's own games shown as "Already in this contest", and the footer "2 games picked" · "Done". The picked games are listed under "To add when you save", each with "Don't add". A test-mode contest's picker also offers the last 14 days' games (Wave 3 §5), with their state shown.
- **Empty**: "No games yet." with "Add games".

**The game picker** (the Games tab and the builder's Games step): G1's `PickerList` with search ("Search teams"), the **sport filter**, a date range ("Any date", "Next 7 days", "Next 30 days", "Choose dates"), the count ("48 games") and checkbox rows grouped by day (time, matchup, sport). **Every game that hasn't started is offered, of any sport the feed names (or none)**; nothing but the reader's own search, sport and dates narrows the list (Arthur, 2026-09-28: the seam from the feed to the picker is exact). The sport filter is a select, "All sports" then **every sport the feed carries** (the whole feed's distinct sports, not only those with a game to come: college and baseball games reach the feed minutes to a day before they start), by readable name ("College football", "College basketball", "Soccer", "Golf", "Special events"; NFL, NBA, WNBA, MLB, NHL and MMA as they are; a code the console has no name for as the feed spells it), sorted by name. A sport with nothing to come says so: "No upcoming college football games yet." with "Clear search and filters".
- **A trivia contest has no Games tab.** Its one game, when it runs at one, is picked on its Trivia tab (below).

No props appear here or anywhere in the console.

| Element | Copy |
|---|---|
| Columns | "Sport", "Game", "Tip-off", "State" |
| State | "Upcoming", "Live", "Final" |
| Actions | "Add games", "Remove", "Keep", "Done", "Don't add Denver @ Fighting Hawks" |
| Waiting | "Removed when you save", "To add when you save", "2 games picked", "1 game to add and 1 to remove" |
| Empty | "No games yet." |
| Picker | "Search teams", "Sport", "All sports", "Any date", "Next 7 days", "Next 30 days", "Choose dates", "48 games", "No games match.", "No upcoming college football games yet.", "No upcoming games yet." |
| Errors | "Denver @ Fighting Hawks has already started.", the `gameRemoved` lock sentence |

#### Trivia tab

A trivia contest's tab in place of Games (D-114): the builder's Trivia step on the contest page, at `/contests/:contestId/trivia`. Code: `pages/contests/TriviaTab.tsx`, `TriviaSettingsCard.tsx`, `triviaSettingsForm.ts`; the fields are shared with the builder (`components/contests/triviaFields.tsx`), so the two can't drift. What the settings mean for fans (the draw, scoring, the window) is [`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md).

Two cards, saved together from one save bar ("Save trivia settings"; see "Unsaved changes"):

1. **When it runs**
   - **Runs**: segmented "At a game | On its own". Help, at a game: "Opens at tip-off and closes when the game ends, unless you set either time below. Fans see the matchup on the contest card."; on its own: "No game. Fans see the contest by its name, and it opens and closes at the times you set."
   - **Game** (at a game only): the game picker (`GamePicker`, `GET /admin/games/candidates?contest=<id>`), exactly one game. Help "Pick one game. Fans see its matchup, and its tip-off sets the default times."
   - **Opens** and **Closes**: the date and time picker each. At a game, a blank time is the game's own (tip-off, and the expected end: tip-off plus the sport's usual length, `triviaGameWindow`), shown as the field's muted placeholder, and Closes' help names the length ("When the game is expected to end, 3½ hours after tip-off, unless you set a time."). A stored time equal to the game's own reads back as blank, so changing the game moves it. On its own, both are required. A blank time never becomes "now".
2. **Questions and scoring**
   - **Questions in a run**: a numbered list, one select per question ("Question 1 draws from"), listing the question bank's tags with their question counts ("nfl (24)"; `GET /admin/trivia/tags`). "Add a question" up to 20; × removes one, down to 1. Help "Every fan answers 5 questions, each drawn at random from its tag, so every run has the same shape." An empty bank shows "Your question bank is empty." with "Open Question bank".
   - **Runs per fan**: segmented "1 | 2 | 3"; help "No retry." or "Only a fan's best run counts." (The contract takes 1 to 10; the console offers 1 to 3.)
   - **Time per question** (seconds; "From 5 to 60 seconds."), **Right answer** (points; "Points for every right answer."), **Speed bonus, up to** (points; "Added for a fast answer, less the longer a fan takes."), **Network allowance** (seconds; "A slow connection doesn't cost a fan: their clock allows this much lag.").

A new contest starts with one question slot and no tag, 1 run per fan, 15 seconds, 500 points, a 500-point speed bonus and a 5-second allowance (`TRIVIA_DEFAULTS`, shared `B2BTrivia.ts`).

**Saving.** The form checks itself first: a question with no tag ("Pick a tag for question 2."), a game-day contest with no game ("Pick the game this trivia runs at."), a standalone contest missing a time ("Set when it opens and closes."), and a close not after the open ("It must close after it opens."); the bar then says "Some changes need another look.". Save sends one `PATCH /admin/contests/:contestId` with `trivia`, the **complete** config (schedule, slots, timing, scoring, the stored bands, `revealMode: "per_question"`, `speedBonus.curve: "linear"`), and `expectedUpdatedAt`. The server merges it onto the stored config, fills a game-day config's blank times from its game, and validates the result whole: every slot's tag exists (400 `TRIVIA.UNKNOWN_TAG`), every band's prize is in the library (400 `TRIVIA.UNKNOWN_PRIZE`), every tag holds (slots drawing from it) × (runs per fan) questions (409 `TRIVIA.TAG_TOO_SMALL`, naming the question: 'Question 1 uses the tag "nfl", which has 5 questions. …'), it closes after it opens, and its game exists. So a draft can't save a short config either; the publish check `trivia_short_questions` catches a bank that shrank after saving.

**Not set up.** A draft saved before its Trivia step has no config. The tab shows one card, "Trivia settings": "Not set up yet. Fans can't play until it has questions and times.", with "Set up trivia" (writers, on a draft) opening the builder's Trivia step.

**Read only.** A member, or anyone on a finalized contest, sees the same two cards as values: Runs, Game, Opens, Closes ("Standings settle when it closes."), Questions in a run (the count), Drawn from (the tags), Runs per fan ("1, no retry" or "3, best run counts"), Time per question, Scoring ("500 points, plus up to 500 for speed") and Network allowance.

**Locked** (a fan has started a run; the trivia table under "The lock", D-120). The `trivia_rules` sentence sits above the cards as a lock note before anyone tries a change. Runs, Game and Opens read as values with the lock glyph, and every Questions and scoring setting reads as a value with the glyph. Only **Closes** stays a field: its earliest choice is the later of the open time and now, and a moved close time before it opens or in the past shows the `closesAt` sentence under it. The tags aren't read while locked. A 409 `contest_locked` on Save (the lock landed while editing) shows its first sentence as a lock note, says "Some changes need another look." in the bar, and re-reads the contest.

**Can't run.** A contest whose tags hold too few questions shows the page's warning banner (see "Page states"), whichever tab is open.

| Element | Copy |
|---|---|
| Cards | "When it runs", "Questions and scoring", "Trivia settings" |
| Labels | "Runs", "At a game", "On its own", "Game", "Opens", "Closes", "Questions in a run", "Select a tag…", "Add a question", "Runs per fan", "Time per question", "seconds", "Right answer", "Speed bonus, up to", "points", "Network allowance", "Drawn from", "Scoring" |
| Empty and not set up | "Your question bank is empty.", "Open Question bank", "Couldn't load the question bank's tags.", "Not set up yet. Fans can't play until it has questions and times.", "Set up trivia" |
| Errors | "Pick a tag for question 2.", "Pick the game this trivia runs at.", "Set when it opens and closes.", "It must close after it opens.", the `closesAt` and `trivia_rules` lock sentences, the `TRIVIA.TAG_TOO_SMALL` sentence |
| Save bar | "Save trivia settings", then as every tab |

#### Prizes tab

The contest's prize ladder, tiers shown by number ("Tier 1", "Tier 2"…), each naming its library prize. Everything about it (the ladder, adding a tier, the prize full page, completeness, the lock's tier kinds) is [`admin-prizes.spec.md`](admin-prizes.spec.md). Its lede says that tiers add up: a board that reaches 3 bingos wins the 1-, 2- and 3-bingo prizes (2026-10-03, `PZ-23`). **A trivia contest's Prizes tab is its prize bands** (`pages/contests/TriviaPrizesTab.tsx`, the editor `components/contests/triviaBands.tsx`), drawn as the ladder is. Lede: "What fans can win in this contest. A band pays its prize to each fan who finishes in its positions."

- **A band row**: its number ("Band 1"), **Finishing positions** as two numbers ("1" to "10"), the **Prize** picker over the prize library (`GET /admin/prize-library`), and under it the prize's "Provided by" sponsor, its completeness pill and "Open prize"; × removes the band. Once fans have played, a row says "12 fans in this band so far".
- **Add band** (up to 50) starts the new band after the last position any band covers. Under the list: "Bands can't overlap. Ties go to whoever finished first, so each position is one fan."
- **Which prizes**: on a draft any library prize; once published only a complete one (the picker greys out a prize that needs details). Publish counts only bands whose prize is complete (`no_prize_bands`).
- **Saving**: the save bar ("Save prizes") checks each row first ("Enter the first and last finishing position.", "The last position can't come before the first.", "These positions overlap band 2.", "Choose a prize.") and sends `PATCH /admin/contests/:contestId` with `trivia` = the stored config with the bands in rank order. Bands live in the trivia config, so a contest with none shows "No prize bands yet." and "Prize bands are part of the trivia settings. Set those up first." with "Set up trivia" (writers, on a draft).
- **Locked** (D-120): the line "Fans have started playing, so a saved band can't be removed, narrowed or given a different prize. You can widen a band or add one."; a saved band's prize reads as a value with the lock glyph and has no ×; narrowing or removing a saved band is refused before saving with the `bandRemoved` sentence.
- **Read only**: a member reads "You can view prizes. Changing them is for admins."; a finalized contest "This contest is finalized, so its prizes can't change."; both see positions as "Positions 1–10".

#### Sponsors tab

The contest's sponsor placements: [`admin-sponsors.spec.md`](admin-sponsors.spec.md). Placements are for the whole contest (D-107): bingo places the Board banner, trivia **Presented by** (the sponsor's Presented by logo and name on every trivia screen, and the credit on its prizes). A trivia contest's tab has no "Provided by" prize-tier card: that card is bingo's.

#### Preview drawer

Not a tab (D-113): the header's Preview opens a right-side drawer (`components/preview/ContestPreviewDrawer.tsx`) over whichever tab is open, holding the console's `FanAppPreview` host on this contest (`GET /admin/contests/:contestId/preview`): [`admin-preview.spec.md`](admin-preview.spec.md). It opens on the screen that shows what the tab edits (Overview: the contest list; Games and Trivia: the contest's own screen, the Rules for trivia; Prizes: the prize sheet, over the board or, for trivia, the standings; Sponsors: the board) and keeps it in the URL (`?preview=<screen>`). A trivia contest's tabs are Contest list, Rules, Questions, Results, Standings and Prize (Prize added 2026-10-03: one band's prize sheet over the standings).

### The builder — `/contests/new`, `/contests/:contestId/setup/:step`

**The console stays around it.** The builder is a page in the main column: the sidebar stays visible, with Games & Contests active, and the top bar's breadcrumb reads "Fighting Hawks / Games & Contests / New contest" (the name once typed).

**Builder header**, under the top bar: the title ("New contest", then the name as typed), the "Draft" chip once the draft exists, the save indicator ("Saved · just now", "Saving…", "Unsaved changes", or "Not saved yet" before the first save), **"Save draft"** (secondary), and "Exit" (ghost).

**The progress bar**, across the top of the content under the header: five steps in a row, **Basics · Games · Prizes · Sponsors · Review** (a trivia contest's second step reads **Trivia**; its route stays `games`), joined by a track that fills up to the current step. Each step is a button showing its number, its name and a one-line summary once it has one ("Bingo", "2 games", "2 tiers", "Optional", "Ready to publish"; for trivia "2 bands", and on Sponsors the Presented by sponsor's name). Its mark is ✓ when done, "!" in the warning colour when it needs attention (a tier that needs details, or a publish reason pointing at it), the number otherwise; the current step is outlined. **Once the draft exists every step can be clicked at any time**, in any order; before it exists the other steps wait (disabled, "Save the draft first"). The bar scrolls sideways below 720px.

**Footer bar**: "Back" and the primary, "Save and continue" while anything is unsaved (and on `/contests/new`) or "Continue" when nothing is; on Review, "Publish" replaces it.

**Saving.** Nothing saves as you go (see "Unsaved changes").

- **Save draft works from every step** and saves every step's unsaved edits: Basics (with the banner), the Games step's picks, the Sponsors step's schedule. The **first save creates the draft** (`POST /admin/contests`) and replaces the URL with `/contests/:contestId/setup/<step>`, without asking. The Prizes step's ladder keeps its own "Save prizes".
- **"Save and continue"** saves the same way, then moves on. The one thing the draft can't exist without is a valid name: with none, it stays on Basics with "Give the contest a name." under Name.
- **Moving another way** (the bar, Back, Exit, any link) with unsaved edits asks "Leave without saving?"; "Leave" drops them and goes. On `/contests/new` Exit always asks, since nothing exists yet.
- A failed save keeps the step open with the error in place.

Steps and their routes (`:step` = `basics`, `games`, `prizes`, `sponsors`, `review`):

1. **Basics.**
   - **Name**, required, 80 characters, placeholder "Rivalry Week", focused on open.
   - **Contest type**: one selectable card per registry type. "Bingo" / "Fans draft players and win on bingos." (selected by default) and "Trivia" / "Fans answer timed questions and win by finishing place."
   - **Description**, 300 characters, help "Fans see this on the contest card."
   - **Internal note**, 500 characters, placeholder "Sponsor, dates, anything your team should know".
   - **Player limit**: "No limit | Limit to" with a number.
   - **Banner**: the banner field (see "Banner"), in its own card.
   - **Opens** and **Closes** (bingo only; 2026-10-01): the contest's own times, each the date and time picker (see "Opens and closes"). Optional.
   - **Trivia hides** Player limit and Opens/Closes: a trivia contest stores no limit, and its times are on its Trivia step. Switching the type on an unsaved or unlocked draft starts the new type clean: on save the server drops the other type's games, tiers, player limit and progress marker (to trivia) or trivia config (to bingo), and the sponsor slots the new type doesn't have.
   - Done when: a valid name and a type.
2. **Games.** The game picker on the left (every upcoming game of every sport, the sport filter). On the right, the picked games with their sport and tip-off and a remove control, headed "3 games · first Sat Oct 3" ("No games picked yet." when empty); a game not saved yet reads "· Not saved yet". Ticking and unticking change the list; Save draft or "Save and continue" writes it. Done when: at least one game.
   **Trivia** (trivia contests, in this step's place): the Trivia tab's two cards, "When it runs" and "Questions and scoring", with the same fields, checks and save (see "Trivia tab"; `TriviaStep` in `ContestBuilder.tsx`). Its first save creates the trivia config. Marked "!" while `trivia_incomplete` stands, done once the draft exists otherwise.
3. **Prizes.** The contest Prizes tab's ladder ([`admin-prizes.spec.md`](admin-prizes.spec.md)), the same component. A prize opens as its full page and returns here. Done when: at least one complete tier and none that needs details.
   **Trivia**: the bands editor (see "Prizes tab"; `TriviaPrizesStep`), any library prize allowed. Until the Trivia step has been saved it shows "Set up the Trivia step first." / "Prize bands are part of the trivia settings, so they wait for its first save." with "Go to the Trivia step". Done when: at least one band.
4. **Sponsors.** The contest Sponsors tab's content ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)), the same component; its step summary reads "Optional" (trivia: the Presented by sponsor's name, read from `GET /admin/contests/:contestId/placements`). Done once visited (trivia: or once Presented by is held).
5. **Review.** Left, the readiness checklist, each row linking to its step: "Name", "Contest type", "Games (3)", "Prize tiers (2 complete)", "Sponsors (4 placements)". A row that blocks publishing shows its reason under it, and the reasons are also listed in one card above the footer ("Publish is waiting on one thing" / "Publish is waiting on 2 things"). Every contest lists an "Opens and closes" row (bingo: its own times or "With its games", linking to Basics; trivia: its trivia times, linking to the Trivia step). A trivia contest's rows are "Name", "Contest type", "Trivia" ("Set up" or "Not set up"), "Opens and closes", "Prize bands (2)" and "Presented by" (the sponsor, or "None"). A note that publishing now would open or close the contest at once (see "Publish checks") shows beside Publish and never blocks it. Right, the preview frame on the builder's current state ([`admin-preview.spec.md`](admin-preview.spec.md)); pointing at "Prize tiers" (trivia: "Prize bands") opens Prize on the first tier (or band) in the prize sheet's **Info** body, as a fan reads it from the Rules (2026-10-03). **Publish** is disabled while any reason stands; it shows "Publishing…", then navigates to the contest page, which shows "Published. Fans can see it now." No toast.

**Exit** returns to `/games`, where the draft leads the list. With unsaved edits, or before the draft exists, it asks "Leave without saving?" first; it never saves on its own.

**Editing never reopens the builder.** An Open or Closed contest is edited on its tabs. The builder is for a Draft: "Continue setup" opens it at the first step that isn't done; a direct builder URL for a non-draft contest redirects to the contest page.

**Permissions.** Writers only. A member who opens a builder URL is sent to the contest page (or `/games` for `/contests/new`).

| Element | Copy |
|---|---|
| Header | "New contest", "Draft", "Saved · just now", "Saving…", "Unsaved changes", "Not saved yet", "Save draft", "Exit" |
| Progress bar | "Basics", "Games", "Prizes", "Sponsors", "Review", "Optional", "Ready to publish", "Save the draft first" (accessible name "Setup steps") |
| Footer | "Back", "Save and continue", "Continue", "Publish", "Publishing…", "The first save creates the draft.", "Unsaved changes on this step." |
| Leave prompt | "Leave without saving?", "This contest hasn't been saved yet.", "Your unsaved changes to this contest will be lost.", "Leave", "Keep editing" |
| Basics | "Name", "Rivalry Week", "Contest type", "Bingo", "Fans draft players and win on bingos.", "Trivia", "Fans answer timed questions and win by finishing place.", "Description", "Fans see this on the contest card.", "Internal note", "Sponsor, dates, anything your team should know", "Only people in this console see the internal note.", "Player limit", "No limit", "Limit to", "players", "Give the contest a name." |
| Games | The picker's copy (Games tab), "3 games · first Sat Oct 3", "No games picked yet.", "Not saved yet" |
| Review checklist | "Name", "Contest type", "Games (3)", "Prize tiers (2 complete)", "Opens and closes", "Sponsors (4 placements)", for trivia "Trivia", "Set up", "Not set up", "Prize bands (2)", "Presented by", "None"; "Publish is waiting on one thing", "Publish is waiting on 2 things" |
| Trivia step | As the Trivia tab; the Prizes step's "Set up the Trivia step first.", "Prize bands are part of the trivia settings, so they wait for its first save.", "Go to the Trivia step" |
| Publish reasons | The sentences under "Publish checks" |
| Publish notes | "Its close time has passed, so it closes as soon as it's published. Change the close time first?", "Change the close time", "Its open time has passed, so fans can play as soon as it's published." |
| Opens and closes | "Opens", "Closes", the help lines under "Opens and closes", "It must close after it opens.", "The close time can't be before the contest opens, or in the past." |
| Result | "Published. Fans can see it now." |

### Delete, wherever it appears

The contest page's danger zone and header overflow, and the overflow on every card and list row, open one **centred dialog**. Writers only; not offered on a finalized contest. The server's behaviour is Wave 3 §3.2; the dialog states it in plain words.

| Element | Copy |
|---|---|
| Title | "Delete Rivalry Week?" |
| Body (no fans yet) | "No fan has joined it yet. Its prize tiers and sponsor placements are deleted with it. Prizes in your library stay." |
| Body (fans joined) | "412 fans have boards in this contest. Their boards, its prize tiers and its sponsor placements are deleted. Prizes already sent stay on record. This can't be undone." |
| Body (trivia, no fans yet) | "No fan has played it yet. Its prize bands and sponsor placements are deleted with it. Prizes in your library stay." |
| Body (trivia, fans played) | "412 fans have played this contest. Their runs, its prize bands and its sponsor placements are deleted. Prizes already sent stay on record. This can't be undone." |
| Input label | "Type “Rivalry Week” to confirm" |
| Buttons | "Delete contest", "Deleting…", "Cancel" |
| Errors | "The contest name you typed doesn't match.", "A prize from this contest is being sent right now. Try again in a minute.", "This contest is finalized, so it can't be deleted." |
| Result | The console returns to `/games` (from the contest page) or removes the card or row, and shows "Deleted Rivalry Week." above the list. |

The confirming button is enabled only on a match (trimmed, ignoring case) and the server checks the typed name again. Nothing else is asked, fans joined or not (revised 2026-09-28).

### Staff: All contests (`/contests`)

The table stays ([`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), paged per [`admin-lists.spec.md`](admin-lists.spec.md)); its type column reads "Contest type" and its visibility column becomes **State** (the state chip and the Finalized badge). **A row opens the contest page** for that tenant: `/contests/:contestId?tenant=<slug>`, acting as that tenant, with the back link "All contests". **Each row carries "Finalize"** when the row's `readyToFinalize` says so (the one rule, below), absent otherwise. The staff tenant page's Contests table reads the same flag. These staff tables, and Overview's upcoming games, show a contest's status in the older four words read through the phase (`contestStatusOfPhase`, see "State and status"), and their prize counts count bands for a trivia contest.

### Finalize: the one rule

A contest is **ready to finalize** when it is **not finalized, not a draft, has at least one game, and every one of its games has ended** (derived status: the feed's Final, every prop resolved, or past the sport's usual length; a game the feed no longer has can't be known to be over and holds the contest back). "Its games" are the contest's own set (`allowedBetEvents`). One server function (`readyToFinalize`, `util/contest-console.ts`) decides it for every surface: the contest rows' and page's `readyToFinalize`, All contests' and the tenant record's rows (`readyToFinalize` on the All contests row), Operations' `ready-to-finalize` queue, and **the finalize endpoint, which refuses a contest that isn't ready with 409 `not_ready`** ("Only a published contest whose games have all ended can be finalized."). A contest with no games (the `test` tenant's "Test Tenant Bingo" and "Archived test contest (early)") is never ready, which is why neither offered Finalize.

**A trivia contest** has no games to wait on: it is ready when it is **not finalized, not a draft, and its close time (`trivia.closesAt`) has passed** (same function). Its Finalize is its own endpoint, `POST /admin/contests/:contestId/trivia/finalize` ([`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md), "Finalize and prizes"): it stops any run still in progress where it stands, settles the standings once, and sends a prize to every fan inside a band. Bingo's endpoint refuses a trivia contest.

### Finalize, wherever it appears

Staff only, wherever it appears (revised 2026-09-28, Arthur's final walk): All contests rows, the tenant page's Contests rows, and — marked with an indigo "Staff" tag — the workspace's contest cards, list rows, contest page header and Overview rail. Every one opens the same centred dialog (`FinalizeContestDialog`); the tenant page no longer keeps its own copy. It is offered only when the server's `readyToFinalize` is true, and hidden rather than disabled otherwise, except on the Overview rail, which tells staff why. Tenant admins and members never see it; staff keep it in either point of view. The typed name is checked by the server for bingo; trivia's endpoint takes no body, so for trivia only the dialog checks it (see Known gaps). No re-authentication.

| Element | Copy |
|---|---|
| Title | "Finalize Rivalry Week?" |
| Body | "Finalizing is permanent and cannot be undone. It marks the contest finished for every fan." Trivia adds: "Fans still answering are stopped where they stand: what they answered counts, the rest scores nothing. The standings are frozen and the prizes go to every fan in a prize band." |
| Input label | "Type “Rivalry Week” to confirm" |
| Buttons | "Finalize permanently", "Finalizing…", "Cancel" |
| Errors | "The contest name you typed doesn't match." |
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
| Delete (not finalized; typed name) | Yes | No | Yes |
| Test mode (dev only, through the dev API; no console control) | Yes | No | Yes |
| Finalize (All contests, the tenant page, and the workspace's cards, list rows and contest page, marked "Staff") | No | No | Yes |

Enforcement is server-side: every write passes `refuseReadOnlyWrite` first (D-063), which refuses a member and a paused workspace's own admins; both Delete and Finalize check the typed name in the handler; Finalize also passes `refuseNonObsStaff`. No route steps up (revised 2026-09-28). The console's `useCanWrite` and `useIsObsStaff` only decide what renders.

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
| GET | `/admin/games/candidates` | Any resolved admin scope ([`admin-lists.spec.md`](admin-lists.spec.md); `contest=`, `sport=`; `sports` in the answer is every sport the feed carries) |
| POST | `/admin/contests` | Tenant `org:admin`, OBS staff |
| PATCH | `/admin/contests/:contestId` | Tenant `org:admin`, OBS staff |
| POST | `/admin/contests/:contestId/duplicate` | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId` | Tenant `org:admin`, OBS staff (Wave 3 §3.2; typed name) |
| POST | `/admin/contests/:contestId/games` | Tenant `org:admin`, OBS staff |
| DELETE | `/admin/contests/:contestId/games/:betEventId` | Tenant `org:admin`, OBS staff (lock permitting) |
| POST | `/admin/contests/:contestId/finalize` | OBS staff only (unchanged) |
| POST | `/admin/contests/:contestId/trivia/finalize` | OBS staff only; trivia's Finalize ([`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)) |
| GET | `/admin/trivia/tags` | Any resolved admin scope; the Trivia step's and tab's tag lists ([`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md), "Admin: Question bank") |
| GET | `/admin/contests/:contestId/placements` | Any resolved admin scope ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)); the trivia builder reads its Presented by holder from it |
| PUT | `/admin/dev/contests/:contestId/test-mode` | Wave 3 §5 (dev only) |
| PUT | `/admin/contests/:contestId/games` | Kept for the old screen until it retires; lock-checked |

Neither the tier endpoints nor the placement endpoints are here: [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md). There is no separate publish endpoint: Publish is `PATCH` with `state: "open"` on a Draft, which runs the publish checks.

### `GET /admin/contests`

The home's list for both views, cursor-paged by [`admin-lists.spec.md`](admin-lists.spec.md).

Query: `cursor`, `limit` (default 20), `q` (contest name), `state` (a phase since 2026-10-01: `draft|upcoming|open|closed`; `closed` includes finalized contests and contests past their close time), `type` (a registry key), `sort` (`next|newest|players`, default `next`).

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
    phase?: "draft" | "upcoming" | "open" | "closed";  // what the pill shows (`contestPhase`)
    opensAt?: string;                // when entries open, on an Upcoming contest
    closesAt?: string;               // the effective close, where known
    finalized: boolean;
    finalizedAt?: string;
    locked: boolean;
    lockedAt?: string;
    players: number;                 // board count
    maxParticipants: number;         // 0 = no limit
    games: { total: number; featured?: GameSummary & { phase: "live" | "next" | "final" } };
    prizeTierCount: number;
    prizeCount?: number;             // tiers for bingo, bands for trivia (the Prizes column and stat)
    banner: { sponsorId: string; name: string; imageUrl: string } | null;  // the Board banner sponsor; kept for older consoles
    contestBanner?: ContestBannerView;  // what the card's band shows (see "Banner")
    newPlayersByDay: number[] | null;  // 14 daily counts ending today; null before the first player
    newPlayersThisWeek: number;
    readyToFinalize: boolean;        // the one rule: not finalized, not a draft, ≥1 game, every game ended
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

The contest page's read. The list row's fields plus `internalNote`, `bannerImageUrl` (or null), `defaultBanner` (what the banner shows without the contest's own image), `testMode` (only where the dev gate is open; no console screen shows it), `kpis: { boardsWithBingo, prizesAwarded, failedSends, finishedFans? }` (`finishedFans` on trivia: fans with at least one completed run), `entryWindow: { opensAt, closesAt }` (bingo; each null where it follows its games), `trivia` (trivia: the stored config as `AdminTriviaConfig`, settled standings named by membership), `questionShortfalls` (trivia: the tags too small for every run, `{ tag, slotIndex, slots, have, need }[]`, empty when it can run), `prizeTiers: { total, complete, needsDetails }`, `placementCount`, `progressMarkerImageUrl` (or null) and `brandMarkerImageUrl` (the Brand marker the board shows without the contest's own, or null) (2026-09-30; there is no `markerSponsors`: no sponsor's icon shows ahead of the contest's marker), `transitions: Array<"publish" | "close" | "reopen" | "toDraft">` (what the header offers), and `publishChecks: Array<{ key, message }>` (empty when publishable; drives the Review checklist, the progress bar's marks and "Continue setup"'s first incomplete step). 404 for a wrong or foreign id.

### `GET /admin/contests/:contestId/games`

The Games tab. Cursor-paged; order: live, then upcoming soonest first, then played newest first, then `_id`. Rows: `betEventId`, `sport`, `matchup`, `eventTime`, `status` (`Upcoming|Live|Final`, from `deriveGameStatus`), `removable` (false once locked or finalized). No marker fields (2026-09-30: the marker is the contest's, on the contest read).

### ~~`PUT /admin/contests/:contestId/games/:betEventId/marker`~~

Removed 2026-09-30 with the per-game marker. The contest's marker is written by the contest PATCH (`progressMarkerImageUrl`).

### `POST /admin/contests`

Creates a contest, a Draft by default. Body: `{ contestName, contestType?, description?, internalNote?, maxParticipants?, bannerImageUrl?, opensAt?, closesAt?, state?: "draft" | "open", betEventIds?, trivia? }`. Defaults: bingo, no limit, no games, no own times, `state: "draft"`. A trivia contest stores no `maxParticipants`; its game is `trivia.betEventId`, never `betEventIds`. A trivia draft may be created without `trivia` (the console creates it from Basics); a `trivia` sent is validated as on PATCH.

- Validation (400, `errors.<field>`): name 1–80 after trim; description ≤300; internal note ≤500; limit 0–1,000,000; type a registry key; banner an https URL ("Use a full address starting with https://"); `closesAt` after `opensAt` ("It must close after it opens."); `opensAt` or `closesAt` on a trivia contest ("A trivia contest's times are in its trivia settings.").
- `state: "open"` runs the publish checks (409 `publish_blocked`). The console always creates a Draft.
- Name clash → 409 `name_taken`.
- Audited `contest_create` (contest id, contest type).
- Responds **201** with the contest in the `GET /admin/contests/:contestId` shape.

### `PATCH /admin/contests/:contestId`

Body: any of `{ contestName, description, internalNote, maxParticipants, contestType, state, bannerImageUrl, progressMarkerImageUrl, opensAt, closesAt }` plus `expectedUpdatedAt`. Only present keys change; `null` or `""` clears `description`, `internalNote`, `bannerImageUrl` or `progressMarkerImageUrl`, and `null` clears `opensAt` or `closesAt` back to the games' own. An empty edit is a 400. The banner and the progress marker are cosmetic: like the name, they change after the lock. The marker must be one of the tenant's own uploads (400 "Upload the image here instead of linking to it.", `errors.progressMarkerImageUrl`).

- `finalized` → 409 `contest_finalized` ("This contest is finalized, so its settings can't change."). "Not finalized" is part of the write filter.
- The precondition and the write are one filter; a stale edit → 409 `stale_contest`.
- `state`: the transitions of Wave 3 §3.1. Draft → Open runs the publish checks (409 `publish_blocked` with `reasons`). To Draft on a locked contest → 409 `contest_locked` ("Fans have joined this contest, so it can't go back to draft."), with the not-locked condition in the write filter.
- `contestType` on a non-draft → 409 `not_draft` ("The contest type can't change after publishing."); on a locked one → 409 `contest_locked` (kind `contestType`).
- `trivia` (trivia only; 400 otherwise): merged onto the stored config and validated whole (see "Trivia tab", Saving); once locked, a changed locked field, a removed, narrowed or re-prized band, or a bad close time → 409 `contest_locked` with kinds `trivia_rules`, `bandRemoved`, `bandPrize`, `closesAt`. A published contest's close time can't move into the past (400, the `closesAt` sentence). The console always sends the complete config. The contest's `allowedBetEvents` follow the config's game.
- `opensAt`, `closesAt` (bingo; see "Opens and closes"): on a trivia contest → 400 "A trivia contest's times are in its trivia settings."; close not after open → 400 "It must close after it opens."; on a published contest, a close time in the past or before it opens → refused with "The close time can't be before the contest opens, or in the past." (kind `closesAt`); a changed `opensAt` on a locked contest → 409 `contest_locked` (kind `opensAt`).
- Name clash → 409 `name_taken`.
- Audited `contest_update` with the changed field names and the new `state`, never free text. A Draft → Open change is audited as `contest_publish`.
- Responds with the contest and `changes.fields`.

### `POST /admin/contests/:contestId/duplicate`

No body. Creates a Draft as described under the contest page (name "Copy of <name>", made unique and trimmed to 80), carrying the source's banner image and its progress marker, not its own open and close times. Tiers are new documents naming the same library prizes; placements are copied (each is for the whole contest). Audited `contest_duplicate` with the source id. Responds **201** with the new contest.

### `DELETE /admin/contests/:contestId`

Wave 3 §3.2, unchanged: body `{ expectedUpdatedAt?, confirmName }`; finalized → 409; a send in flight → 409; audit first; boards and pending sends deleted; terminal redemptions kept with `contestName`; the contest's tiers and placements deleted; library prizes kept. Wave 4 adds only the console above; since 2026-09-28 a locked contest asks for nothing more than the typed name.

### `POST /admin/contests/:contestId/games`

Body `{ betEventIds: string[], expectedUpdatedAt }`. Adds to `allowedBetEvents` and `ranAtBetEvents` in one update. Distinct ids; every id must name a reference game (400 listing unknown ids); a game that has started → 400 "<matchup> has already started." (a test-mode contest may add the last 14 days' games, Wave 3 §5); ids already in the contest are ignored. Finalized → 409 `contest_finalized`. Allowed on a locked contest. Audited `contest_games_add` (count). Responds with the contest and `changes.added`.

### `DELETE /admin/contests/:contestId/games/:betEventId`

Query `expectedUpdatedAt`. Removes the game from `allowedBetEvents` (never from `ranAtBetEvents`). Locked → 409 `contest_locked` with kind `gameRemoved`, with the not-locked condition in the write filter. A game not in the contest → 404 ("That game isn't part of this contest."). Finalized → 409 `contest_finalized`. Sponsor placements are the contest's and are untouched. Audited `contest_games_remove`. Responds with the contest and `changes.removed`.

### `POST /admin/contests/:contestId/finalize`

As [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md), plus the one rule: a contest that isn't ready to finalize (above) is **409 `not_ready`**, "Only a published contest whose games have all ended can be finalized.", checked after "already finalized" and before the typed name. Its callers are the OBS pages: All contests rows and the tenant record's rows.

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
- **Fan reads** (`GET /b2b/contest/list-contests`, `GET /b2b/contest/:contestId`) move to the allowlisted projection with `description`, `contestType` and `banner`.

---

## Migration

`node-server/scripts/contest-console-migration.mjs`, dry run by default, `--apply` to write, dev-only rails like every other script, idempotent (a second run finds nothing and says so). Runs after Wave 3's `contest-state-migration.mjs`. It only has to be safe on the shared dev database.

1. **The note.** For every contest with `contestDescription`: `internalNote = contestDescription`, then unset `contestDescription`. `description` is left absent. Reason: the console promised "Only people in this console see the note."
2. **Contest type.** `contestType = gameType ?? "bingo"`, then unset `gameType`.
3. **The list index** `{ organizationId: 1, state: 1, _id: -1 }`, created after the writes. Creating an existing index is a no-op.

`contestTypeOf()` reads `contestType ?? gameType ?? "bingo"`, and the fan reads' projection reads `description` only, so readers and the migration can land in either order on dev.

---

## Contest types: groundwork for the second game

`GAME-F1`: the type lives on the contest, and the registry above is the one list of types. New wire fields stay type-neutral. Trivia was built beside bingo without touching these: its own collections (questions, tags, runs), its config and bands on the contest (`trivia`), and prize rows that carry `contestType` ([`trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)). Left bingo-shaped on purpose: the `*_bingo_*` collection names; the board's nine named cells and the evaluator's eight lines; tiers keyed on `threeInARows` (the second game needs a type-neutral threshold or its own tier fields); "bingo" in existing wire fields and CSV columns; the fan app's bingo-shaped routes.

---

## Rules

1. **`CT-01` — A control exists only if the fan side honours it.** No entries-per-fan, no two-teams, no board rules, no prop controls, no player limit on a trivia contest.
2. **`CT-02` — A contest's state is stored: Draft, Open or Closed** (Wave 3 §3.1). Finalized is a badge. The pill shows the phase (Draft, Upcoming, Open, Closed) from one shared rule, `contestPhase`, which the fan app and the server's fan list share. The console never shows a separate visibility or entries control.
3. **`CT-03` — Publish is gated.** Bingo needs a game that hasn't started and a complete tier with none needing details. Trivia needs its settings, enough questions in every tag for every run, and a complete band; its times never block it. The server checks it on every move into Open from Draft.
4. **`CT-04` — Each state action appears once, where it belongs,** and only when allowed: Publish on Review, the others in the contest page header and (Close and Reopen) the card and row overflow.
5. **`CT-05` — The description is for fans; the internal note never leaves the console.** Fan reads use an allowlisted projection, and the current fan app shows the description on the contest card.
6. **`CT-06` — Contest types come from one registry.** Filters, pickers and validation read it; nothing hardcodes a type.
7. **`CT-07` — A contest locks at its first board and never unlocks.** The lock table above, decided in shared, enforced by the server, shown read-only in the console.
8. **`CT-08` — Removing a game locks with the contest; adding never does.**
9. **`CT-09` — Tenants never choose or see props.** The console has no prop screen, control, count or readiness item.
10. **`CT-10` — The game picker always shows its sport filter,** listing every sport the feed carries by its readable name, and offers every game that hasn't started, of any sport.
11. **`CT-11` — Any non-finalized contest can be deleted,** with a typed name, whether or not fans have joined (revised 2026-09-28: no reverification).
12. **`CT-12` — The builder keeps the console around it.** Steps are a clickable progress bar, every step is reachable once the draft exists, and Save draft works from every step.
13. **`CT-13` — Every growing list pages on the server with a cursor.** The contest list (both views), the Games tab and the game picker.
14. **`CT-14` — Finalize is staff only, by one rule** (not finalized, not a draft, at least one game, every game ended), hidden rather than disabled otherwise; the server refuses a contest that isn't ready. Revised 2026-09-28: it appears on the OBS pages and, marked as a staff action, on the workspace's contest cards, list rows and contest page, where the Overview rail tells staff why a contest isn't ready.
15. **`CT-15` — Participation is the board count.** `numberParticipants` is never read.
16. **`CT-16` — Contest names are unique within a tenant, ignoring case.**
17. **`CT-17` — `ranAtBetEvents` only grows.**
18. **`CT-18` — Every refusal carries one plain sentence, shown where the change was attempted.** No toasts, no spec IDs, no vendor words.
19. **`CT-19` — Nothing saves as you go.** Every contest editor saves on an explicit Save draft or Save, and leaving unsaved edits (or a contest that doesn't exist yet) asks "Leave without saving?".
20. **`CT-20` — Every contest has a banner:** its own image, its Board banner sponsor's, or the tenant's brand default, chosen by one shared function and drawn the same in the console and the fan app.

## Known gaps (recorded, not blocking)

- **The fan card leads with the matchup, not the contest name.** The current fan app titles a contest card with its featured game's matchup and shows the contest name only for a game without two teams. The console's name still matters (Delete, Finalize, the board header for a multi-game board); the Preview shows the card as it is.
- **Multi-entry** needs the index change and fan-app support before a control can exist.
- **Line drift from the shared data.** Boards reference feed props live; an upstream edit to a feed line still changes existing boards (contest-safety, Known gaps).
- **Name uniqueness is check-then-write.** Two creates to one name in the same instant can both succeed; a normalized-name unique index is the fix if it ever matters.
- **Player-limit enforcement is count-then-insert.** Two fans at the last place in the same instant can both join.
- **`numberParticipants` is dead data**, left in place and read by nothing.
- **Audit coverage.** Games adds and removes and state changes are audited from this spec on; tier writes' audit is [`admin-prizes.spec.md`](admin-prizes.spec.md)'s.
- **A locked band's prize swap (2026-10-03).** D-120 says a locked band's prize can't be swapped. The shared lock (`triviaBandLockViolations`) still allows a swap to a prize whose stated value (`approximateValueCents`) is at least the old one's when both state one, and the server reads those values (`toLockableBands`). The console never states a value and never offers the swap, so only a direct API call on legacy-valued prizes can reach it; the `bandPrize` sentence still mentions "a prize worth at least as much". Open: drop the value branch, or record it as intended.
- **Trivia Finalize's typed name (2026-10-03).** The dialog asks for the typed name, but `POST /admin/contests/:contestId/trivia/finalize` takes no body, so the server doesn't check it as bingo's does.

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- The contest has no `publishedAt` stamp: its stored state says Draft, Open or Closed, and nothing else needed the date.
- An unknown tab in the address (`/contests/:contestId/whatever`) opens Overview.
- The Overview's **Failed sends** tile shows only when at least one of the contest's prize sends has failed.
- The Preview tab mounts the preview's contest tab: it opens on the fan app's Contests screen and keeps the screen, device, tier, game and sponsor highlight in the address, so the Sponsors tab's link opens the frame on the right screen (one link since 2026-09-30: a placement is for the whole contest).
- `/contests/:contestId/prizes` and `/contests/:contestId/sponsors` are the contest page's own tabs. The stand-alone ladder and slot pages built while the slices were apart were dropped when they were joined.
- The end-to-end harness's `--screens` run opens the new contest from Games & Contests onto the contest page and photographs it there.

## As built (Wave 4b)

- The builder's footer primary reads **"Save and continue"** while anything is unsaved: a save the label names, so the next step never loses work and the common path never prompts. Step moves by the bar, Back and Exit prompt instead.
- The Prizes step and tab keep the ladder's own **"Save prizes"** ([`admin-prizes.spec.md`](admin-prizes.spec.md)); the builder's Save draft covers the ladder once it reports its unsaved rows to the builder's unsaved-changes registry.
- The sport filter is a **select** ("All sports" and every sport), not the segmented chips, because the feed carries eleven sports.
- The fan-app preview's builder overlay does not yet carry an unsaved banner; it shows the saved one.

## Function audit (2026-10-03)

Every screen, where its data comes from and what it writes. Paths are in `obs-b2b-admin-frontend/src` and `overboard_sports_backend/node-server/src`.

| Screen | Reads | Writes |
|---|---|---|
| Games & Contests (`pages/Games.tsx`) | `GET /admin/contests` (cursor pages, phase, banner, sparkline, `prizeCount`, `readyToFinalize`) | `PATCH` `state` (Close and Reopen entries), `POST …/duplicate`, `DELETE`, staff Finalize (`POST …/finalize` or `…/trivia/finalize`) |
| Contest page header (`pages/contests/ContestPage.tsx`) | `GET /admin/contests/:contestId` (`transitions`, `questionShortfalls`, `locked`, `finalized`) | `PATCH` `state`, `POST …/duplicate`, `DELETE`, staff Finalize |
| Overview (`OverviewTab.tsx`) | the contest read (`kpis`, `entryWindow`, `trivia` times, `games.featured`) | `PATCH` Basics fields changed |
| Games (bingo; `GamesTab.tsx`) | `GET /admin/contests/:contestId/games`, `GET /admin/games/candidates` | `POST …/games`, `DELETE …/games/:betEventId` |
| Trivia (trivia; `TriviaTab.tsx`) | the contest read (`trivia`, `games.featured`, `locked`), `GET /admin/trivia/tags`, `GET /admin/games/candidates` | `PATCH` `trivia` (complete config) |
| Prizes (bingo: `PrizeLadder`; trivia: `TriviaPrizesTab.tsx`) | [`admin-prizes.spec.md`](admin-prizes.spec.md); trivia: `GET /admin/prize-library` | tiers: [`admin-prizes.spec.md`](admin-prizes.spec.md); bands: `PATCH` `trivia` |
| Sponsors (`components/sponsors/SlotEditor.tsx`) | `GET /admin/contests/:contestId/placements`, `GET /admin/sponsors/list` | placements ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)) |
| Preview drawer (`components/preview/ContestPreviewDrawer.tsx`) | `GET /admin/contests/:contestId/preview` | none |
| Builder (`pages/contests/ContestBuilder.tsx`) | as the tabs, plus `GET …/placements` for trivia's Presented by summary | `POST /admin/contests` (first save), then as the tabs; Publish is `PATCH` `state: "open"` |

**Cut or changed from earlier versions of this spec, and why:**

- **The Trivia placeholder** is gone: trivia is playable, with its own step and tab (above).
- **"Trivia has the same Games tab"** was never built that way: a trivia contest has at most one game, picked on its Trivia tab (D-114).
- **The Preview tab** became a drawer from the header (D-113); its old address redirects.
- **`tierValue`** left the lock table: prizes state no value since 2026-09-28, so there is nothing for a value lock to compare.
- **A player limit on trivia** is not offered and not stored: nothing on the trivia fan path counts against one.
- **A reveal-mode control** is not offered: the only mode is a reveal after every question, and the console sends `per_question`.
- **The trivia "Send prizes" section** of the earlier trivia spec was not built: staff Finalize settles and sends in one action.

## References

- PRD: [`ADM-03`, `ADM-04`, `ADM-06`, `BRAND-02`, `BRAND-04`, `GAME-01`–`GAME-04`, `GAME-C1`, `GAME-F1`, `PRIZE-03`, `TEN-05`, `TEN-C1`, `ADM-09`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) — sports (§2), states, deletion, featured game and refusals (§3), test mode (§5), the harness (§6)
- [`admin-surface.spec.md`](admin-surface.spec.md) — access, "No re-authentication", principles, Rule 13, routes
- [`contest-safety.spec.md`](contest-safety.spec.md) — the lock, the snapshot, the unique board index
- [`admin-lists.spec.md`](admin-lists.spec.md) — cursor paging and the list components
- [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md), [`admin-preview.spec.md`](admin-preview.spec.md), [`admin-uploads.spec.md`](admin-uploads.spec.md)
- [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) — the fan app's preview mode
- [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the superseded games half, kept as history
- [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — All contests, Finalize
- [`admin-game-day.spec.md`](admin-game-day.spec.md) — readiness dots reused on the Overview rail and the Finalize rule
- Research (workspace): `artifacts/review-2026-09-27/e2e-pes-fanapp.md` (§2, §3, §5, §8), `artifacts/review-2026-09-27/prizes-optins-specs.md` (§6, §7)
- Rulings: Arthur, 2026-09-24 (`artifacts/wave-2026-09-24/WAVE-RULES.md`) and 2026-09-27 (`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`); D-059, D-063, D-068
