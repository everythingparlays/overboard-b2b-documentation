# Core Module Spec: Contest safety — the lock, the prize snapshot, one board per fan

**Implements:** Arthur's 2026-09-24 ruling "No contest versioning. Lock once the first fan joins", PRD `GAME-02` (what a tier pays), `PRIZE-03` (finalization stays permanent), `PRIZE-07` (resends).

**Depends on:** [`admin-contests.spec.md`](admin-contests.spec.md) (the settings PATCH), [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) (the games PUT, the tiers PUT, the `expectedUpdatedAt` precondition), [`prize-delivery.spec.md`](prize-delivery.spec.md) (the worker's claim and attempts).

**Status:** Draft. Written 2026-09-24 (wave G2).

## Overview

Before this spec, the only thing that froze a contest was finalization. Everything else stayed editable while fans played, and two edits changed what fans had already been promised:

- A **prize tier edit** rewrote the tier in place, and the worker read the tier at delivery time. Changing a tier's bingo count or content changed what the next win, and any resend, paid. Removing a tier made a resend of an earlier win fail.
- **Removing a game** left boards holding squares from a game the contest no longer ran.

The ruling rejects versioning (the survey-style "mint a new version" model) in favour of a simpler contract: **before the first fan joins, everything is editable; after that, the things fans play and win under are locked.** Every awarded prize keeps a **snapshot** of the tier it was promised, so even the edits that stay open can never change a prize already won.

## The lock

### When a contest locks

**A contest locks when its first board is created.** Joining a contest *is* creating a board on it (`POST /b2b/board/generate`), so "the first fan joins" and "the first board exists" are the same moment.

- The board endpoint stamps `lockedAt` on the contest, once, right before it inserts the first board. The stamp is a conditional write (`lockedAt` absent) and does not advance the contest's `updatedAt`: a fan joining is not an operator edit, and it must not make an admin's unrelated pending edit (a rename) read as stale.
- A contest is locked when it has `lockedAt` **or** any board. The second half covers contests whose boards predate the stamp; the migration below backfills their `lockedAt` from their earliest board.
- The lock never lifts. Deleting boards (fan deletion) does not unlock a contest: the fans who played were promised what they were promised.

### What stays editable, and what locks

| Setting | Before the first fan | After |
|---|---|---|
| Name, description, visibility, entries (open/closed), player limit | Editable | **Editable** |
| Games: adding one | Editable | **Editable** |
| Games: removing one | Editable | **Locked** |
| Contest type | Set at creation | **Locked** (not editable anywhere today; any future editor must honour this) |
| Board rules (prop pool curation, when it exists) | Editable | **Locked** |
| Prize tiers: adding one | Editable | **Editable** |
| Prize tiers: removing one | Editable | **Locked** |
| Prize tiers: bingos to win (`threeInARows`) | Editable | **Locked** |
| Prize tiers: the stated value (`approximateValueCents`) lowered or cleared | Editable | **Locked** (raising it is fine) |
| Prize tiers: wording, image, claim steps, button, delivery method, redemption details | Editable | **Editable** |

Why tier wording stays open: a correction ("Signed jesrey") cannot be told apart from a downgrade by a machine, and blocking corrections would push operators into worse workarounds. The snapshot (below) is what makes this safe: whatever an operator does to a tier's wording, every fan who has already won keeps exactly what they were shown when they won.

Why the delivery method stays open: it is *how* a prize reaches the fan, not *what* the prize is, and it is the operator's fix when a method stops working (see "Delivering from the snapshot").

### Enforcement

The lock is enforced by the server on every write that could break it, with a plain refusal:

```
409 { success: false, code: "contest_locked", message: "<plain sentence>", locked: ["<what>", ...] }
```

`code` is `CONTEST_LOCKED_CODE` in `obs-b2b-shared` (`api/admin/concurrency.ts`). The messages live in shared (`CONTEST_LOCK_COPY`) so the console's read-only explanations and the server's refusals say the same thing:

| Refused change | Message |
|---|---|
| Removing a game | "Fans have joined this contest, so its games can't be removed. You can still add games." |
| Removing a prize tier | "Fans have joined this contest, so its prize tiers can't be removed. You can still add one." |
| Changing bingos to win | "Fans have joined this contest, so the number of bingos a prize takes can't change." |
| Lowering or clearing a stated value | "Fans have joined this contest, so a prize's value can't be lowered." |
| Changing the contest type | "Fans have joined this contest, so its contest type can't change." |

What is locked is decided by pure functions in shared (`interfaces/b2b/ContestLock.ts`: `contestIsLocked`, `tierLockViolations`, `gameLockViolations`), used by both the server and the console, so the two can never disagree about which change is allowed.

**Racing the first fan.** The pre-check reads the lock; the write then carries `lockedAt: { $exists: false }` in its filter whenever the change is one the lock would refuse. A fan whose join stamps the lock between the two makes the write match nothing, and the server re-reads and answers `contest_locked` rather than `stale_contest`. For the tiers PUT, the contest claim is the serialisation point: a claim that wins before the stamp is an edit made before the fan joined.

### The console

The console shows a locked contest's locked controls **read-only, with one plain line** saying why, taken from `CONTEST_LOCK_COPY`. It never shows a disabled control that looks like it might wake up (D-059's principle): a locked game shows its "on" state as text with the explanation; a locked tier's bingo count reads as a value, and the tier's remove action is replaced by the explanation. Controls that stay editable look exactly as before.

The contest wire shapes carry the state: `locked: boolean` and `lockedAt?: string` on the Games & Contests contest and on the Prizes contest group. Both are optional on the wire so an older server's response still parses.

## The prize snapshot

### What is stored

Every `PrizeRedemption` that pays a tier carries `tierSnapshot`: the tier as it stood when the prize was awarded.

```ts
tierSnapshot?: {
  prizeTierId: ObjectId;
  threeInARows: number;
  handlerId: string;
  prizeName: string;
  prizeDescription: string;
  prizeImageUrl?, prizeClaimInstructions?, prizeClaimButtonLinkUrl?, prizeClaimButtonText?,
  approximateValueCents?, redemptionWindow?, redemptionMethod?, redemptionLocation?,
  staticRedemptionCode?;   // select: false, exactly like on the tier
  snapshotAt: Date;
}
```

The code is copied because it is part of what was promised, and it keeps the tier's secrecy: `select: false`, read only by the worker by name, never on any wire.

### When it is taken

**Award time is the moment the worker first handles the win** — when it creates the redemption row for the win message. Before claiming any send, the worker resolves the paying tier (`threeInARows === tierIndex + 1`, exactly as before) and writes the snapshot with a conditional write (`tierSnapshot` absent), so a redelivered message can never overwrite it. A win that no tier pays is marked skipped and carries no snapshot.

A row written before snapshots existed has none. The first time the worker handles it again (an operator resend), it resolves the tier live, as it always did, and snapshots that. Nothing backfills old rows: what they were promised is not recoverable, and inventing it would be fabrication.

### Delivering from the snapshot

- **Content** — the email's name, description, image, claim steps, button, value, window, method, location and code — always comes from the snapshot. Editing or removing a tier afterwards changes nothing for a fan who has already won, including on every resend.
- **The delivery method** is the snapshot's `handlerId`. If that method is no longer available when a send runs, the worker uses the method now on the same tier (`prizeTierId`), if that tier still exists and its method is available — that is the operator's fix ("choose one on the Prizes screen, then resend") and it only ever changes *how* the promised prize is sent. Otherwise the send fails with the existing unknown-method reason.
- The old "no tier pays N bingos any more" failure is now reachable only by a pre-snapshot row whose tier was removed.

### Where it is read

The worker is the only reader of the whole snapshot. Admin read surfaces that name a won prize (the delivery queue) prefer the snapshot's `prizeName` and fall back to the live tier for older rows.

## One board per fan per contest

`bingo_boards` gets a unique index on `{ contestId: 1, clerkUserId: 1 }` (declared in `models/b2b.ts`; created per environment because the connectors run with `autoIndex: false`). The board endpoint already refused a second board with the handler's own check; the index closes the double-tap race that check could not. The endpoint treats the index's duplicate-key error the same as its own check: 409 with the fan's existing `boardId`, so the fan app still lands on the fan's board.

Multi-entry, if it ever ships, changes this index (an entry number joins the key) together with the fan app.

## Tier saves refuse finalized contests

`PUT /admin/contests/:contestId/prize-tiers` checks `finalized` like the games PUT and the settings PATCH always did: `409 CONTEST.FINALIZED` before anything is written, and `finalized: { $ne: true }` in the claim filter so a finalization landing mid-request also refuses it.

## Migration

`node-server/scripts/contest-safety-migration.mjs`, dry run by default, `--apply` to write, dev-only rails like every other script:

1. **Duplicate boards.** For each `(contestId, clerkUserId)` holding more than one board, keep the oldest and move the rest into `<prefix>bingo_boards_duplicates_archive` (copied first, then removed from the live collection, each archived row carrying `archivedAt` and `keptBoardId`). Nothing is deleted outright; the archive is the undo. Redemption rows are never touched. Applied to `obs-b2b-dev` on 2026-09-24: five groups (eight boards archived), all `seed_test_fan_*` fixtures in one demo contest, and no redemption referenced a moved board; four contests had `lockedAt` backfilled. A re-run reports nothing to do.
2. **The unique index**, created after step 1. Creating an existing index is a no-op.
3. **`lockedAt` backfill**: every contest with boards and no `lockedAt` gets its earliest board's `createdAt`.

Every step is idempotent: a second run finds nothing to do and says so. The seed script (`seed-test-tenant.mjs`) now gives each demo fan one board, so re-seeding cannot recreate duplicates.

## Rules

1. **A contest locks at its first board and never unlocks.**
2. **The lock list is the table above**, decided in shared, enforced by the server, mirrored read-only in the console.
3. **Every paid redemption carries the tier it was promised**; delivery reads content only from it.
4. **One board per fan per contest is a database guarantee**, not just a handler check.
5. **Finalized contests refuse every edit**, prize tiers included.

## Known gaps (recorded, not blocking)

- **Line drift.** Boards reference D2C props live; a D2C edit to a line or multiplier still changes existing boards. Freezing lines needs prop snapshots on the board (research 2026-09-24, §5).
- **Board rules** do not exist yet (prop pool curation is future work); they join the lock list the day they do.
- **Pre-snapshot redemptions** keep resolving live; there is no honest way to reconstruct what they were promised.

## References

- Research: `overboard-b2b-workspace/artifacts/review-2026-09-24/contests-engine-fanapp.md` §1 ("One board per fan per contest"), §5.
- [`admin-contests.spec.md`](admin-contests.spec.md), [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md), [`prize-delivery.spec.md`](prize-delivery.spec.md)
