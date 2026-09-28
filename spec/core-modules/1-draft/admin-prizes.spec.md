# Core Module Spec: Admin — Prizes (library, prize page, contest tiers, deliveries, email settings)

**Implements:** PRD `GAME-02` (tiers belong to a contest; see "PRD requirements"), `PRIZE-01`, `PRIZE-03`, `PRIZE-07`, `ADM-03`, `ADM-04` (the delivery-method half, carried from [`prize-delivery.spec.md`](prize-delivery.spec.md)), and trivia's `TRV-49` / `TRV-50` on the prize side ([`../../features/1-draft/trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, the write grant, reverification, the view-only presentation (D-059), Honesty by omission (Rule 13). [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page, its tabs, the builder, Publish. [`contest-safety.spec.md`](contest-safety.spec.md) — the lock, `tierSnapshot`, `contest_locked`, and the prize-library revision's `prize_value_locked`. [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) — contest states (§3.1), contest deletion (§3.2), the fan app showing only recorded awards (§1.5), and the four prize-library fixes (§8), all referenced here and not redefined. [`prize-delivery.spec.md`](prize-delivery.spec.md) — the delivery engine, method registry, email template, attempt claim and staff resend. [`admin-lists.spec.md`](admin-lists.spec.md) — cursor paging and the list kit. [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — sponsor records, their prize-popup logo, and sponsor deletion's cascade. [`admin-uploads.spec.md`](admin-uploads.spec.md) — the upload field and its route. [`admin-preview.spec.md`](admin-preview.spec.md) — the `FanAppPreview` host. [`admin-game-day.spec.md`](admin-game-day.spec.md) — the `reasonKind` failure categories.

**Supersedes:** the prize halves of [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) (including its 2026-09-27 library revision's drawer and contest-drawer tier editing) and of [`prize-delivery.spec.md`](prize-delivery.spec.md) (the Prizes screen, the Prize email card, the Delivery card); the Delivery queue screen of [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md); the prize email's "Presented by" credit source (the `prizePopup` placement holder); and Game day's "no retry control for tenants" ([`admin-game-day.spec.md`](admin-game-day.spec.md)), for the Deliveries tab only.

**Status:** Draft. Written 2026-09-24 for the console redesign.
Revised 2026-09-27 (Wave 4, Arthur's rulings of that day): rebuilt on the prize library. A prize is authored once per tenant and a contest's tiers point at it; the prize type and "Provided by" move onto the library prize; each prize opens as its own page; Prizes has two tabs, Library and Deliveries, and the email settings live on Deliveries (there is no Emails page); the contest Prizes tab is a numbered ladder of bingo count plus library prize, capped at three.

## Overview

A prize is something a team sets up once and gives away many times: the same $25 gift code is the 3-bingo prize at the Denver weekend and the 2-bingo prize at Rivalry Week. The prize library (2026-09-27) made that the data model: `B2BPrize` holds what the fan wins, and a contest's tier holds only *when* it is won (a bingo count) and *which* prize (`prizeId`), plus a server-written copy of the prize's content that every reader already understands.

This spec builds the console on that model. The Prizes page is the library: every prize, where each is awarded from, and **New prize**. Each prize opens as a full page whose first question is the one that decides every other question, "What kind of prize is it?", with the fan's prize popup and the winner's email previewed live beside the form. The contest's Prizes tab becomes a short numbered ladder: for each tier, how many bingos, and which prize. Deliveries, the record of every prize sent, is the page's second tab, and the prize email's sender settings sit on it, because they are about how prizes are sent.

**The whole change, in one line:** a prize is a typed, sponsor-credited library record edited on its own page, a contest's tiers pick from the library, every send is visible and resendable by the team that awarded it, and the email identity is a setting beside those sends.

**In scope:**

- Additions to the library prize: `prizeType`, `providedBySponsorId`, `shipsWithinDays`; `redemptionMethod` derived from the type; the claim button on every type; type normalisation; completeness as one shared function; the code kept secret on reads.
- The award snapshot's additions (`prizeId`, `prizeType`, `shipsWithinDays`, `providedBy`) and the console's "as promised" projection.
- The Prizes page: **Library** tab, **Deliveries** tab with the **Prize email** settings, the staff cross-tenant view.
- The prize page (`/prizes/new`, `/prizes/:prizeId`) with its live previews.
- The contest Prizes tab ladder, which the builder's Prizes step reuses.
- Endpoints: the library's extensions, a prize read, code reveal, the ladder read, the deliveries endpoints, and changes to existing routes.
- The prize-type migration, run after the library migration.
- How trivia bands will reuse the picker, without building trivia.
- A later slice: **Bounced**.

**Not in scope:**

- **The delivery engine** (worker, attempt claim, method registry, template construction, local loop): [`prize-delivery.spec.md`](prize-delivery.spec.md). This spec changes what the template merges and nothing about how it sends.
- **Taking the snapshot**: [`contest-safety.spec.md`](contest-safety.spec.md). This spec adds four fields to it.
- **The fan prize popup's design.** The popup stays the current fan app's `PrizeModal`, fed by the award the server recorded ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §1.5). Two small changes only, below ("What the winner sees").
- **The upload route and storage**: [`admin-uploads.spec.md`](admin-uploads.spec.md). This spec uses its field.
- **Coupon-code batches** (`PRIZE-05`/`PRIZE-06`'s batch half) and **deferred delivery** (`PRIZE-02`). See "PRD requirements".
- **Shipping-address capture.** A shipped prize asks the winner to reply with their address.
- **Trivia.** Only the seams it will use.

---

## Words

| Word | Means | Not |
|---|---|---|
| **Prize** | A library record (`B2BPrize`): what a fan wins. Tenant-owned, awarded from any number of tiers. | "reward", "offer" |
| **Tier** | One rung of a contest's ladder (`B2BPrizeTier`): a bingo count and a prize. On screen: "1", "2", "3". | "level" |
| **Award** | A win the server recorded (`PrizeRedemption`), with the snapshot of what was promised. | "claim" |
| **Delivery** | One award's sends: queued, sent, failed. | "fulfilment" on screen |

---

## The data model

The prize library's structures are the model. Everything below extends them; nothing runs beside them.

### `B2BPrize` (the library)

`${prefix}prizes`, `obs-b2b-shared/src/interfaces/b2b/B2BPrize.ts`. Existing fields keep their names and model limits; the console's limits are tighter on new writes where noted, and a stored value longer than a console limit is kept until someone edits that field.

| Field | Type | Console control | Types | Fan popup / email | Notes |
|---|---|---|---|---|---|
| `organizationId` | ObjectId | none | — | — | Required, indexed. Every read and write is scoped by it. |
| `prizeType` **(new)** | `"pickup" \| "code" \| "link" \| "shipped"` | The four type cards | all | Decides the email's blocks and which fields show | Required on create. Existing prizes get it from the migration. |
| `prizeName` | string, model ≤200 | **Name**, ≤60 | all | Popup badge; email headline and `{prize}` in the subject | Required. |
| `prizeDescription` | string | **Description**, ≤300 | all | Popup headline; email body | Required. |
| `prizeImageUrl` | https URL ≤2000 | **Image**: the upload field | all | Popup image (128px square); email image | Written by the upload route ([`admin-uploads.spec.md`](admin-uploads.spec.md)); never typed. |
| `providedBySponsorId` **(new)** | ObjectId → `B2BSponsor` | **A sponsor provides this prize** → "Provided by" | all | The credit in the popup and the email | Same tenant only. One prize, one credit, everywhere it is awarded. |
| `redemptionWindow` | `{ startsAt?, endsAt?, daysAfterAward? }` | **Expires** → "N days after winning" or "On a date" | all | Email: "Use it within 30 days of winning." / "Use it by Oct 31." | `startsAt` is kept but not offered (below). |
| `approximateValueCents` | int 0–10,000,000 | Advanced → **Approximate value** | all | **Never shown to fans** | Can't be lowered or cleared while a locked contest awards it (`prize_value_locked`). |
| `redemptionLocation` | string, model ≤500 | Pick up → **Where to pick it up**, ≤120 | pickup | Email: "Show this email to staff at {location}." | Required for pickup. |
| `prizeClaimInstructions` | string, model ≤5000 | **What to bring** (pickup), **How to redeem** (code, link), **What happens next** (shipped); ≤500 | all, relabelled | Popup: the line under the headline; email: the type's instructions block | Required for shipped (prefilled). |
| `staticRedemptionCode` | string ≤64, no spaces, `select: false` | Code → **Code** | code | Email only ("Your code"); never the popup | Required for code. Masked after save. |
| `prizeClaimButtonLinkUrl` | https URL ≤2000 | **Link** (link type, required); **Button link** (every other type, optional) | **all** | The popup's button opens it; the email's button | Never dropped by type normalisation. |
| `prizeClaimButtonText` | string ≤200, console ≤40 | **Button text** | all | The button's label, popup and email | Defaulted on save when a link is set and the text is empty (below). |
| `shipsWithinDays` **(new)** | int 1–365 | Shipped → **Ships within** | shipped | Email: "Ships within 14 days." | Optional. |
| `redemptionMethod` | `in_person \| online \| in_person_or_online \| shipped` | none | derived | Read by nothing new | **Derived from the type on every write** (`PZ-02`). |
| `handlerId` | string ≤100 | Advanced → **Delivery**, only when there is a choice (below) | all | Which method sends | `standard-email` for every new prize. |
| `createdAt` / `updatedAt` | Date | none | — | — | `updatedAt` is the precondition token (`expectedUpdatedAt`, refused as `stale_prize`). |

**What the prize never carries: a bingo count.** When a prize is won is a property of the tier (bingo) or, later, of a band (trivia). No field, label, help line or preview control on the prize side mentions bingos (`TRV-50`).

**`PRIZE_CONTENT_FIELDS` grows** by `prizeType`, `providedBySponsorId` and `shipsWithinDays`. That one change is what carries the new fields to every tier copy, and from the copy into the award snapshot, without a second mechanism.

**Not offered any more.** "Redeemable from" (`redemptionWindow.startsAt`): a prize won before it can be used is a case no tenant has asked for, and it turned "Expires" into a three-bound puzzle. A stored `startsAt` is kept on save and still reaches the email; the page shows it under **Expires** as a read-only line, "Can be used from Oct 3.", with **Clear**. "In person or online" is not a type: it was a label with no behaviour, and the migration resolves it.

### `redemptionMethod` is derived from the type

| `prizeType` | `redemptionMethod` |
|---|---|
| `pickup` | `in_person` |
| `code` | `online` |
| `link` | `online` |
| `shipped` | `shipped` |

The server sets it on every create and update; the contract refuses a body that sends it. It stays on the model only because older readers may read it; nothing new reads it.

### Saving normalises the prize to its type

Server-side, on every create and update:

- **Type-specific fields of other types are cleared**: `redemptionLocation` unless pickup, `staticRedemptionCode` unless code, `shipsWithinDays` unless shipped. A prize switched from Code to Link loses its code, so no later winner's email can carry a stale one. The page says so before the save ("Switching type", below).
- **The claim button is never cleared by a type change.** Every type keeps `prizeClaimButtonLinkUrl` and `prizeClaimButtonText`. For Link, the link is the prize and is required for Complete; for the other three it is an optional button.
- **Button text follows its link.** A link with no text stores the type's default: "Redeem" for code, "Claim your prize" for the rest, so the popup and the email label the button the same way. Clearing the link clears the text (a label with nowhere to go).
- Nothing else is touched: name, description, image, instructions, expiry, value, provider and delivery method survive any type change.

### The code stays secret

`staticRedemptionCode` keeps `select: false`, and the console reads stop returning it: the library and prize reads carry `hasCode: boolean`, and only `POST /admin/prize-library/:prizeId/reveal-code` returns the code. It never reaches the fan wire, the preview frame, an audit row or a log. A PATCH that omits it leaves it unchanged; `null` clears it. `PRIZE-06`'s no-duplicates rule does not apply to a code shared by design; the page says it is shared ("Every winner of this prize gets the same code.").

### Complete / Needs details

Completeness is **derived, never stored**, by one pure function in `obs-b2b-shared` (`interfaces/b2b/PrizeCompleteness.ts`: `prizeCompleteness(content, { replyToSet, methodResolves })` → `{ complete, missing: PrizeField[] }`). It reads only content fields, so the same function judges a library prize and a tier's copy. The server, the worker and the console all call it.

| Type | Needs details when empty |
|---|---|
| every type | Description; a delivery method that resolves in the tenant's catalog |
| `pickup` | Where to pick it up |
| `code` | Code |
| `link` | Link |
| `shipped` | What happens next; the tenant's **Reply-to** (a winner replies to it with their address) |

Name and type are required to save at all. A checked optional part with nothing in it ("Expires" with no days, "Add a button" with no link) is a field error on save, not a completeness state: an unchecked box is how a tenant says "none".

- **A Needs-details prize can be saved and picked into a draft contest**, and Publish refuses while any tier names one ([`admin-contests.spec.md`](admin-contests.spec.md), publish checks).
- **A contest fans can see never gets a tier that can't be delivered.** On a contest in state `open` or `closed` ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §3.1), the tiers PUT refuses a tier naming a Needs-details prize (400 `prize_needs_details`).
- **A prize fans can win never goes back to Needs details** (`PZ-04`). A PATCH that would make a Complete prize Needs details is refused (409 `prize_would_hide`) while any non-finalized `open` or `closed` contest awards it. This is the prize-side form of the old per-tier rule, checked across every contest in the prize's "Awarded from". Clearing the Reply-to while such a contest awards a shipped prize is refused the same way (`reply_to_in_use`).
- The worker still treats an incomplete tier copy as no tier at that count (the win is `skipped`), and the fan wire leaves it out: defence in depth for tiers stored before these rules.

### `B2BPrizeTier` (unchanged in shape)

`{ prizeTierId, threeInARows, prizeId, …the server-written copy of PRIZE_CONTENT_FIELDS }`, exactly as the library defined it. The copy now includes the three new fields because `PRIZE_CONTENT_FIELDS` does. No `contestId` is added: a tier's tenant and contest are resolved through the contest that holds it ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8), and the one place that needed a back-reference (the library migration) is fixed that way. A tier stored before the library, with no `prizeId`, keeps working from its own copy until someone picks a prize for it.

### The award snapshot

`PrizeRedemption.tierSnapshot` ([`contest-safety.spec.md`](contest-safety.spec.md)) gains four additive fields. The worker writes them at award time with the rest of the snapshot:

```ts
tierSnapshot?: {
  // …existing fields (prizeTierId, threeInARows, handlerId, prizeName, prizeDescription, prizeImageUrl,
  // prizeClaimInstructions, prizeClaimButtonLinkUrl, prizeClaimButtonText, approximateValueCents,
  // redemptionWindow, redemptionMethod, redemptionLocation, staticRedemptionCode (select:false), snapshotAt)
  prizeId?: ObjectId;          // new: which library prize was paid
  prizeType?: PrizeType;       // new
  shipsWithinDays?: number;    // new
  providedBy?: {               // new: copied from the sponsor at award time
    sponsorId: ObjectId;
    name: string;
    logoUrl?: string;          // the sponsor's prize-popup logo
    websiteUrl?: string;
  };
}
```

The sponsor is copied, not referenced, for the same reason the tier is: the credit a winner saw is part of what they were promised, and renaming, re-logoing or deleting the sponsor afterwards must not rewrite it. A sponsor lookup that fails at award time drops the credit, never the prize.

`prizeId` is what lets Deliveries say which library prize was paid and filter by it. The migration backfills it on existing rows from each row's tier (below).

**The console never receives the raw snapshot.** The delivery detail projects it to `PromisedPrize`:

```ts
interface PromisedPrize {
  prizeId?: string;
  name: string;
  description: string;
  imageUrl?: string;
  prizeType: PrizeType;
  details: {
    location?: string;          // pickup
    instructions?: string;      // what to bring / how to redeem / what happens next
    button?: { text: string; link: string };   // any type
    hasCode: boolean;           // the code itself is never projected
    shipsWithinDays?: number;   // shipped
    expires?: { daysAfterAward?: number; endsAt?: string; startsAt?: string };
  };
  providedBy?: { sponsorId: string; name: string; logoUrl?: string; websiteUrl?: string };
  bingosToWin: number;
  snapshotAt: string;
}
```

A row awarded before snapshots existed has no `PromisedPrize`, and the drawer omits the block: what those fans were promised isn't recoverable, and showing today's prize under "As promised" would be fabrication. A snapshot taken before this spec's fields has no `prizeType`; the projection derives it with the migration's rules (for `online`, a snapshot holding a code reads as Code, otherwise Link). It has no `providedBy`, so the drawer shows no credit for it.

### What happens when other things are deleted

- **A prize** ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.2): refused with `prize_in_use` while a tier that a contest holds names it, finalized contests included, since their tiers are final. Deleting clears `prizeId` from detached tiers that still name it; their content copies and every snapshot stay.
- **A contest** (§3.2): its tiers go; its library prizes stay; terminal awards stay with `contestName` stamped, so Deliveries still names where they were won.
- **A sponsor** ([`admin-sponsors.spec.md`](admin-sponsors.spec.md) owns the cascade): deleting a sponsor clears `providedBySponsorId` on every library prize naming it and on every tier copy naming it, finalized contests' tiers included (a reference to a sponsor that no longer exists resolves to nothing either way). **Snapshots are never touched**: awards already made keep the credit they were given. No "remove it from prizes first" step exists; the sponsor page's delete dialog states the count, "It's credited on 2 prizes. They'll show no sponsor."
- **A tenant** (§8.3): its library goes with it, codes included.

### Edits, the lock and finalized contests

- **A prize edit reaches every contest that awards it, except finalized ones.** The PATCH refreshes the copy on tiers held by non-finalized contests only ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.4). A finalized contest's tiers keep the content they were finalized with; detached tiers are left alone.
- **Winners keep what they were promised.** The snapshot is taken at award time, so no edit, anywhere, changes an award already made.
- **The value can't go down under a lock.** `409 prize_value_locked` while a locked contest's tier names the prize; re-pointing a locked tier at a prize worth less is `409 contest_locked` ([`contest-safety.spec.md`](contest-safety.spec.md), the library revision). Raising a value, or re-pointing at a prize worth at least as much, is always allowed.
- **Everything else stays editable after the lock**, the type included. What a prize is (its wording, image, steps, button, type) is the operator's to correct; the snapshot keeps every winner's promise.

---

## What the winner sees

### The prize popup (the current fan app)

The popup is the fan app's `PrizeModal` as it is today, opened only for an award the server recorded ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §1.5). From the award's `prize` it draws, top to bottom: the name as a pill badge in the tenant's primary colour; the image (128px, rounded); the description as the headline; the claim instructions under it (the description again when there are none); the sponsor credit; the button (the button text, or "Awesome!" when no text is stored) and, when the prize has a link, a second "Close" button. The code is never in the popup ("Your code is in the email" is the tenant's to write in the instructions).

Two changes, both about the credit:

1. **Where the credit comes from.** `B2BBoardAward.prize` gains `prizeId`, `prizeType` and `providedBy` (the same resolved shape as the snapshot; for an award not yet snapshotted, resolved from the live tier's `providedBySponsorId`). The popup's credit comes from `providedBy`, rendered by the existing `PrizeSponsor` block. It no longer comes from the `prizePopup` placement at the board's game.
2. **The eyebrow reads "Provided by"**, the email's word, in place of "Sponsored by". The block is otherwise unchanged: the logo 48px tall and up to 176px wide, "Visit {name}" when the sponsor has a website, and no block at all when the sponsor has no prize-popup logo (today's rule).

### The email, per type

The template ([`prize-delivery.spec.md`](prize-delivery.spec.md)) becomes type-aware. Every block follows the omission rule: unset means absent.

| Type | Lead line | Blocks |
|---|---|---|
| Pick up | "Show this email to staff at {location}." | "What to bring"; button when set; expiry line |
| Code | none | "Your code"; button when set (default "Redeem"); "How to redeem"; expiry line |
| Link | none | The button (default "Claim your prize"); "How to redeem"; expiry line |
| Shipped | none | "What happens next"; "Ships within 14 days."; button when set; expiry line |

Every type: the "You hit N bingos." line from the tier (the qualifying line belongs to the tier, never the prize); **no approximate value**; the **"Provided by"** credit from the snapshot's `providedBy` (the prize-popup logo 32px tall, up to 160px wide, linked to the website when set; the name as text when there is no logo). The worker no longer reads the board's game to find a sponsor.

---

## The screens

### Navigation

Workspace sidebar: one item, **Prizes** (`/prizes`, hue: prizes). There is no Emails item and no separate deliveries item. OBS Internal: **Prize deliveries** (`/obs/prize-deliveries`) replaces Delivery queue. Redirects: `/delivery-queue` → `/obs/prize-deliveries`; `/prizes?contest=<id>` → `/contests/<id>/prizes`.

### The Prizes page

**Header.** Eyebrow "Workspace", H1 "PRIZES", lede "Everything your fans can win, and every prize you've sent." Right: **New prize** (primary; admins and staff; Library tab only).

**Tabs** (the kit's tab nav, in the URL): **Library** (`/prizes`) and **Deliveries** (`/prizes/deliveries`, with a count badge of failed deliveries when above zero).

### Library tab

**Toolbar:** search "Search prizes" (name and description); **Type** segmented "All · Pick up · Code · Link · Shipped"; the count, "9 prizes". The library is capped at `PRIZE_LIBRARY_MAX` (200), so it is one read and the search and filter run in the browser; no paging.

**Table**, most recently updated first; a row opens the prize page:

| Column | Content |
|---|---|
| Prize | 40px image (the type icon on a tinted square when there is no image), the name, and the description on one muted line, truncated |
| Type | Type icon and "Pick up", "Code", "Link", "Shipped" |
| Provided by | The sponsor's logo at 20px and name; empty when none |
| Value | "$25"; empty when not stated |
| Awarded from | "2 contests", with the contest names on a muted line under it ("Denver Weekend · Rivalry Week"); "Not awarded yet" in muted text when none |
| Status | "Needs details" pill when incomplete, naming the first missing field in its tooltip; nothing when Complete |

**States.**

| State | What renders |
|---|---|
| Loading | Table skeleton rows |
| Empty | "No prizes yet." and **New prize** |
| No matches | "No prizes match." with "Clear search" |
| Full (200) | **New prize** is disabled with the tooltip "Your library holds up to 200 prizes. Delete one you don't use to add another." |
| Load failed | `ReportableLoadError` |
| Member (read-only) | Same table; no New prize; one line under the header, "You can view prizes. Changing them is for admins." |

### The prize page

**Routes.** `/prizes/new` and `/prizes/:prizeId` (staff: `?tenant=`). Optional `returnTo` (an in-app path, validated) and `slot` (the ladder row that asked), set when the page is opened from a contest's prize picker or from a ladder row's prize link. The drawer is retired.

**Header.** Back link: "Prizes", or "Back to {contest name}" when `returnTo` is set. Eyebrow "Prize". H1: the prize's name, or "NEW PRIZE". The status pill, "Complete" or "Needs details". Nothing else on the right, so the one primary action is Save.

**Notice** (above the form, one line each, only when true):

- Awarded from a contest that isn't finalized: "Changes apply to every contest that awards this prize."
- One of those is locked: "Fans who already won keep what they were promised."
- One of the contests that award it is finalized: "Finalized contests keep this prize as it was."

**Layout.** Form column (max 640px) and a sticky 420px preview rail at ≥1280px; the rail drops below the form under 1280px. A sticky footer bar: "Cancel" and the primary "Save prize" ("Create prize" for a new one), disabled until the draft differs from the saved prize.

#### 1. What kind of prize is it? (first, alone)

Four selectable cards (a radio group; arrow keys move, Space selects):

| Card | Label | Explanation |
|---|---|---|
| `pickup` | "Pick up in person" | "Winners collect it somewhere you choose, like the team store." |
| `code` | "Code" | "Winners get a code to use online or at a register." |
| `link` | "Link" | "Winners get a button to a page where they claim it." |
| `shipped` | "Shipped" | "You mail it to winners. They reply with their address." |

**Nothing else renders until a type is chosen** (`PZ-01`); the rail shows "Choose a prize type to see the preview." Choosing one reveals the rest, and focus moves to Name.

**Switching type.** The cards stay at the top. Switching keeps every common field and the button, and swaps the type block. The previous type's values stay in the draft while the page is open (switching back restores them); a muted line under the cards names what saving would clear: "Saving as Link clears the code." Allowed after a lock (see "Edits, the lock and finalized contests").

#### 2. The prize

1. **Name.** Required, ≤60, counter at 48. Placeholder "Signed jersey".
2. **Description.** Required for Complete, ≤300, counter at 250. Help: "The headline fans see when they win, in the prize popup and the email."
3. **Image.** The upload field (`.cx-upload`, drag-and-drop plus browse; [`admin-uploads.spec.md`](admin-uploads.spec.md)). Hint: "PNG, JPG or WebP · up to 5 MB · shown square". Filled: the thumbnail, the file name and "800 × 800 · 96 KB", **Replace** and **Remove**. Optional.
4. **A sponsor provides this prize** (checkbox). Reveals **Provided by**: a Combobox of the tenant's sponsors (search, endless scroll, each with its prize-popup logo at 20px and name). Help: "Shown as 'Provided by' in the prize popup and the email." A sponsor with no prize-popup logo is still choosable; the line under the field says "Shows as the name in the email. Add a prize popup logo to show it in the popup." with "Add one" linking to `/sponsors/:id`. No sponsors in the tenant: the checkbox is replaced by "No sponsors yet. Add one on the Sponsors page."
5. **Expires** (checkbox). Reveals a segmented "N days after winning | On a date" and its input (days 1–3650, or a date today or later). A stored "Can be used from" date shows here read-only with Clear.

#### 3. The type block

**Pick up in person.** **Where to pick it up** (required for Complete, ≤120; placeholder "Team store, Gate C"; help "Winners read 'Show this email to staff at …'"). **What to bring** (optional, ≤500; placeholder "Your ID and this email").

**Code.** **Code** (required for Complete, ≤64, no spaces: "Codes can't contain spaces."; help "Every winner of this prize gets the same code."). After save it shows masked with **Reveal** (admins and staff; members see "A code is set"); revealed, it shows in monospace with **Copy** and **Hide**; typing replaces it. **How to redeem** (optional, ≤500; placeholder "Enter the code at checkout.").

**Link.** **Link** (required for Complete, https). **Button text** (optional, ≤40, placeholder "Claim your prize"). **How to redeem** (optional, ≤500).

**Shipped.** **What happens next** (required for Complete, ≤500, prefilled "Reply to this email with your shipping address and we'll send it out."). **Ships within** (optional, 1–365 days). With no Reply-to set: "Winners reply to your reply-to address, which isn't set yet." with **Set it on Deliveries** (`/prizes/deliveries#prize-email`); the prize is Needs details until it is set.

#### 4. Button (every type but Link)

**Add a button** (checkbox). Reveals **Button text** (≤40; placeholder "Redeem" for code, "Claim your prize" otherwise) and **Button link** (https). Help: "Fans tap it in the prize popup and the email." For Link the button is the prize, so this section is absent. The button is optional on every type and survives every type change.

#### 5. Advanced (collapsed; its summary shows the value when set)

- **Approximate value** ("$", whole dollars or cents). Help: "Never shown to fans." A lowered or cleared value refused by the lock shows inline: "This can't be lowered: fans have joined {contest}, which awards it."
- **Delivery**, only when the tenant's catalog offers more than one method or the stored one doesn't resolve (then the disclosure opens by itself and reads "Choose how this prize is delivered."): the tenant's methods by label and one-line description, from `GET /admin/prizes/handlers`.

#### 6. Awarded from (a saved prize)

A list of the tiers that award it, one row each: the contest's name (linking to `/contests/:id/prizes`), "at 3 bingos" (the usage's `at` text), the contest's state chip (Draft, Open, Closed, Finalized) and the lock glyph when locked. Under the list, when the prize has deliveries: "124 sent · 2 failed", each linking to Deliveries filtered to this prize (`?prize=<prizeId>`). None: "Not awarded from any contest yet." (a real state, not a gap).

#### 7. Delete

A "Delete prize" section at the bottom, for admins and staff. When nothing awards the prize: **Delete prize** opens a centred dialog, "Delete this prize?", body "No contest awards it. Prizes fans already won aren't affected.", buttons "Delete prize" (danger) and "Cancel". No reverification: an unused library record reaches no fan. When a contest awards it, the section reads "Contests award this prize, so it can't be deleted." (the list above says which). Deleting returns to the Library tab.

#### 8. The preview rail

Sticky, 420px, with a segmented **"Popup | Email"**; one preview shows at a time, remembered per user for the session. Both are bound to the unsaved draft and refresh on a ~300ms trailing debounce.

- **Popup.** The real fan app through the console's one host, `FanAppPreview` ([`admin-preview.spec.md`](admin-preview.spec.md)), on screen `prize`, phone device (390px, never scaled), with the tenant's brand. The render document's `prize` is the draft prize (never the code; the resolved `providedBy` beside the id), with no contest, since a library prize belongs to none. It is the current `PrizeModal` on its own over the app's background, in the tenant's theme ([`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md), "Without a contest"). Skeleton until the first render; after 8 seconds without one, "The fan app didn't load." with **Retry**. The frame carries the fan app's own preview marking; the console adds no label.
- **Email.** The server's real template from `POST /admin/prizes/email/preview` with the draft, the tenant's saved email settings, and a bingo count: the lowest count among the tiers that award the prize, or 1. Shown in a white letter frame at 420px, with "Subject: …" and "From: …" above it and **Open full width** (a centred 600px dialog). For a saved prize the request names `prizeId`, and the server merges the stored code when the draft carries none, so the preview shows what a winner gets. A failed preview keeps the last render with "Couldn't update the preview." and **Try again**.

#### 9. Saving, leaving, returning

- **Save.** "Save prize" sends a PATCH with `expectedUpdatedAt`; "Create prize" a POST. Success: "Saved." beside the button, the pill updates, and a new prize's URL becomes `/prizes/:prizeId` (replace, not push).
- **Returning to a contest.** With `returnTo`, a successful create or save navigates to `returnTo` with `picked=<prizeId>&slot=<slot>`; the ladder restores its unsaved draft and puts the prize in that row ("Contest Prizes tab", below). **Cancel** returns without `picked`.
- **Refusals.** `stale_prize`: "This prize changed since you opened it." with **Reload** (the draft stays until the reader chooses). `prize_value_locked`: inline under the value. `prize_would_hide`: under the emptied field, "Fans can already win this prize in {contest}, so {field} can't be left empty." Field errors land beside their fields.
- **Unsaved changes.** The draft is kept in `sessionStorage` (keyed by user, tenant and prize, with the saved `updatedAt` as its baseline, the Fields & Opt-ins pattern); a draft whose baseline no longer matches is dropped with "This prize changed while you were away, so your unsaved edits were cleared." Leaving by an in-app route with unsaved changes asks "Leave without saving?", "Your changes to this prize will be lost.", "Keep editing" (default) and "Leave".

#### 10. Page states

| State | What renders |
|---|---|
| Loading | Form and rail skeletons |
| New | Only the type block, and the rail's "Choose a prize type to see the preview." |
| Needs details | The pill and, under the header, "Add {missing fields, in form order} to finish this prize." Missing fields carry a quiet marker, not an error |
| Not found | "This prize doesn't exist." with "Back to prizes" (another tenant's id answers the same) |
| Load failed | `ReportableLoadError` |
| Member (read-only) | The view-only presentation: values as text, the code as "A code is set", previews live, "You can view this prize. Changing it is for admins." |

### Contest Prizes tab

Route `/contests/:id/prizes` (staff: `?tenant=`). The builder's Prizes step renders the same component at `/contests/:id/setup/prizes` ([`admin-contests.spec.md`](admin-contests.spec.md)); only the surrounding chrome differs.

**Lede.** "What fans can win in this contest. A tier pays once a fan's board reaches its number of bingos."

**The ladder.** Up to three rows, ordered by bingos to win, lowest first. Each row:

1. **Its number**, a round badge "1", "2", "3", in ladder order (not an icon, not a type).
2. **Bingos to win**, segmented 1–8. A count another row uses is disabled with the tooltip "Tier 2 already uses 3 bingos". Locked: a stored tier's count is a read-only value with the lock glyph, tooltip "Locked since the first fan joined."
3. **Prize**, a picker (Combobox): the selected prize's 32px image, name and type; opening it lists the library (search, each row with image, name, type and "Provided by"), with **New prize** pinned at the bottom. On a contest fans can see, a Needs-details prize is listed disabled with "Needs details". **New prize** opens `/prizes/new?returnTo=<this route>&slot=<row>`; the created prize comes back selected in this row.
4. **The prize's summary**, under the picker: "Provided by" with the logo and name (absent when none), the status pill when it needs details, and the prize's name as a link, **Open prize**, to its page (with `returnTo`).
5. **Sends** for this tier, when it has any: "35 sent" and, when above zero, "2 failed" in the status red, each linking to Deliveries filtered to this contest and tier.
6. **Remove** (an icon button), unlocked contests only.

**Add tier** (a secondary button with a plus) under the last row, with the hint "A contest can have up to 3 tiers." It disappears at three (`PZ-09`, PRD `GAME-02`).

**Saving.** The ladder is one draft, saved with the whole-list `PUT /admin/contests/:contestId/prize-tiers` and its `expectedUpdatedAt`. A sticky bar shows "Save prizes" and "Cancel" when the draft differs. The draft is kept in `sessionStorage` (keyed by user, tenant and contest, baseline `updatedAt`), which is what lets **New prize** and **Open prize** leave and come back without losing a half-built row. Rows are re-sorted by bingos on save, and the numbers follow.

**States.**

| State | What renders |
|---|---|
| Loading | Row skeletons in the ladder's shape |
| Empty | "No prize tiers yet." and a primary **Add tier**. In the builder, under it: "Fans can't win anything until a tier has a prize." |
| Locked | Stored rows' bingos read-only with the lock glyph; Remove gone; the line "Fans have joined, so bingos to win can't change and tiers can't be removed. You can add a tier or change a tier's prize to one worth at least as much." |
| Finalized | Rows read-only (prize names still open the prize page); no Add tier; "This contest is finalized, so its prizes can't change." |
| Trivia draft | The contest spec's placeholder card |
| Load failed | `ReportableLoadError` |
| Member (read-only) | Same rows as text; no Add tier; "You can view prizes. Changing them is for admins." |

**Refusals on save**, shown on the row they concern: `contest_locked` for a lowered prize value, "This contest has fans, so this tier can't move to a prize worth less."; `prize_needs_details`, "Finish {prize} before fans can win it." with **Open prize**; `tier_bingos_taken`; `stale_contest`, "This contest changed since you opened it." with **Reload**; `contest_finalized`, the page turns read-only.

What the tab no longer shows: the line counting how often fans reached a bingo count no tier pays. It is gone, with its data (`unawarded`).

### Deliveries tab

Route `/prizes/deliveries`. Tenant mode for tenants, and for staff with a tenant selected.

**Layout.** At ≥1280px, two columns: the deliveries (tiles, toolbar, table) and a 340px right column holding the **Prize email** card, sticky. Under 1280px the card sits above the tiles.

**Tiles** (KpiTile): "Sent" (`fulfilled` rows sent in the last 30 days, caption "Last 30 days"), "Failed" (all `failed` rows, and `bounced` once it exists; caption "Needs attention" above zero, else "Nothing to fix"; the number in the status red only above zero), "Queued" (`pending` rows, "Sending now"). Each filters the list on click. Tiles show the tenant's totals and ignore the search and filters.

**Toolbar** (sticky, the list kit's `InfiniteTable`): search "Search by fan name or email"; **Status** segmented "All · Sent · Failed · Queued"; **Contest** Combobox ("All contests", endless scroll); **Date** "Any time · Today · Last 7 days · Last 30 days · Custom…"; the count, "412 deliveries". Filters reached by link show as removable chips: "Prize: $25 gift code", "Tier 2 · Denver Weekend", "Fan: J. Smith". Every filter lives in the URL (`?status=&contest=&tier=&prize=&fan=<membershipId>&from=&to=`); the search text does not, because it can be an email address.

**Table** (endless scroll, newest win first):

| Column | Content |
|---|---|
| When | When the fan won it, date over time; exact time in a tooltip |
| Fan | Display name linking to `/fans/:id`; a deleted fan reads "Removed fan", unlinked |
| Prize | Type icon and the prize's name as promised (the snapshot's; the live tier's for older rows) |
| Contest | The contest's name linking to its Prizes tab, and under it, muted, the game ("vs Montana State · Sep 19") when the row records one. A deleted contest shows its stamped `contestName`, unlinked |
| Status | "Queued", "Sent", "Failed" (and "Bounced", later). The header tooltip gives the definitions below |
| Attempts | "1", "3" |
| (actions) | Row menu: "View details"; "Resend" on eligible rows; staff: "Send again" |

A row opens the detail drawer; `?delivery=<redemptionId>` deep-links to it.

**Status words mean what they say.** Queued: "Waiting to send. Most prizes send within a minute." Sent: "Accepted by our mail provider." Failed: "It didn't go out. The details say why." Bounced (later): "Accepted by our mail provider, then turned away by the fan's inbox." "Sent" never says "delivered": nothing tells us what happens after the provider accepts a message. Wins no tier pays (`skipped`) are not deliveries and never list.

**States.** Loading: tile and row skeletons. Empty: "No prizes sent yet." (tiles at zero). No matches: "No deliveries match." with "Clear search and filters". Later page failed: rows stay, "Couldn't load more." with "Try again". Load failed: `ReportableLoadError`. Member: everything visible, no Resend, "You can view deliveries. Resending is for admins." Paused tenant: as member, under the paused banner.

#### The Prize email card (the email settings)

The tenant's prize email identity, on the page where its sends are, visible whenever the tab is open. Anchor `#prize-email`.

**Title** "Prize email"; lede "How your prize emails introduce themselves."

1. **Sender name.** ≤80. Placeholder: the tenant's display name (the real default). Help: "What winners see as the sender."
2. **Reply-to.** Optional email address. Placeholder "promotions@yourteam.com". Help: "Where a winner's reply goes. Shipped prizes need this."
3. **Subject.** ≤150. Placeholder "You won: {prize}" (the default). Help: "{prize} becomes the prize name." Any other `{…}` is the field error "Only {prize} can be filled in."
4. **Sending address.** Read-only: "Sent from {address}". It is the platform's `PRIZE_FROM_ADDRESS`; when the server doesn't know it, the row is absent.
5. **Preview.** The server's real template (`POST /admin/prizes/email/preview`) bound to the unsaved settings, shown as a scaled letter inside the card with "Subject: …" and "From: …" above it; **Open full width** opens it at 600px. Its sample prize is the tenant's most recently updated Complete prize; with none, a built-in sample that says it is one ("Sample prize", "This is where your prize's description goes."). The brand (logo, colour) comes from Brand, as in every real send.

Footer: "Save" (primary, disabled until changed) and "Discard"; success shows "Saved." inline. Clearing every field saves the defaults. Clearing Reply-to while a fans-visible contest awards a shipped prize is refused (409 `reply_to_in_use`) with the field error "Shipped prizes in {contest} use this address. Change those prizes first." (`PZ-15`). Member and paused: values as text, no footer. Not audited: reversible configuration, like Brand.

#### The detail drawer

Stays a drawer (440px, the kit's): small, read-mostly, and read in the context of the list the operator is working down. Title: the fan's display name; description: the status chip and "Won Sep 21, 8:41 PM".

1. **As promised.** The `PromisedPrize`: image (64px), name, description; then a short list: "Type" ("Pick up at Team store, Gate C", "Includes a code", "Link: claim.hyvee.com/…", "Ships within 14 days"), "Button" ("Redeem → northsidecu.org/…") when set, "Expires", "Provided by" (logo and name), "Won at" ("3 bingos"), and **Open prize** linking to the library prize when `prizeId` is recorded and the prize still exists. Absent for a row with no snapshot.
2. **Sent to.** The fan's masked email ("j•••@gmail.com").
3. **Sends.** The attempt timeline, one entry per attempt: "Queued" → "Sent" or "Failed", with who asked for a resend ("Resent by Dana K., 9:03 PM"; "Sent again by Overboard, Sep 22"). An attempt to a corrected address reads "Sent to a different address", never the address. A failed attempt shows its plain reason (Game day's `reasonKind` sentences); staff also see the recorded reason in monospace.
4. **Actions** (footer), per the table below. Resend confirms inline: "Resend this prize? The fan gets the same prize they won, at the same address." with "Resend" and "Cancel"; after it, "Queued to resend." and a new timeline entry.

Links at the foot: "Open fan" and "Open contest prizes".

#### Resend and Send again

| Action | Rows | Who | Reverified | What it does |
|---|---|---|---|---|
| **Resend** | `failed`, reason `setup` or `other`, fewer than 3 resends | Tenant `org:admin` of the row's tenant, and staff | No | The same snapshot to the fan's account email, as the next attempt |
| **Send to a different address** | `failed` or `bounced` | Staff | Yes | The existing staff resend with a corrected address ([`prize-delivery.spec.md`](prize-delivery.spec.md), "Corrected address") |
| **Resend selected** | `failed` | Staff, cross-tenant view | Yes | The existing bulk resend, up to 100 loaded rows |
| **Send again** | `fulfilled` | Staff | Yes, plus typed confirmation | The same snapshot again, as a new attempt on a row already sent |

When Resend isn't offered on a failed row, the drawer says what the admin can do instead, in one line: for an address failure, "The fan's email couldn't accept it. Ask Overboard to send it to a different address." with **Tell Overboard**; after three resends, "This prize has been resent three times. Tell Overboard and we'll look into it." with **Tell Overboard** (the support report carries the `redemptionId`).

**Send again** opens a centred dialog: "Send this prize again?", "{fan} already has this prize. Sending it again gives them a second copy, including any code.", a required reason ("The fan says it never arrived" · "The fan lost it" · "Something else"), the typed confirmation "Type {fan display name} to confirm", "Send again" (danger) and "Cancel"; reverification runs on submit.

**Why a tenant may resend.** [`prize-delivery.spec.md`](prize-delivery.spec.md) made resend staff-only when failures were visible only on a staff screen and the one resend path could also redirect a prize to a typed address. Its rules prevent a double send (Rules 4–5), an unaudited change (Rule 6) and fan PII travelling (Rule 7); none of them is about who clicks. A tenant that can award a prize can re-deliver the same prize: resending a failed send gives the fan nothing they weren't owed, and the conditional write plus the worker's attempt claim still make a second send impossible. The tenant path keeps Rules 4, 5, 6 and 8 and never touches Rule 7 (no corrected address). Sender reputation, which is platform-wide, is bounded three ways: address failures are excluded, each row gets at most three tenant resends, and duplicating a *sent* prize is staff-only and reverified. Game day keeps "no retry control"; its failed rows link to this drawer.

### Staff extras

- **Tenant mode** (a tenant selected, `/prizes/deliveries`): everything above plus the recorded reason text, **Send to a different address**, **Send again**, and a header link "All workspaces" to the cross-tenant view.
- **Cross-tenant view** (`/obs/prize-deliveries`, OBS Internal): eyebrow "Overboard", H1 "PRIZE DELIVERIES", lede "Every workspace's prize sends." The Deliveries tab's list without the Prize email card (email settings are per tenant), plus a **Tenant** column (name, linking to `/obs/tenants/:slug`) and a **Tenant** filter. Status defaults to Failed. Row checkboxes and **Resend selected** ("Selected 100 of 342" when fewer rows are loaded than the total). Tiles show platform totals.
- **No cap.** The list pages with a cursor to the end ([`admin-lists.spec.md`](admin-lists.spec.md) Rule 1), and the count is the real total.

### Links in

Overview's failed-sends tile → `/prizes/deliveries?status=failed`; the contest Overview's "Failed sends" tile → `?status=failed&contest=<id>`; the ladder's per-tier counts → `?contest=<id>&tier=<tierId>`; the prize page's counts → `?prize=<prizeId>`; the fan page's Prizes section → `?fan=<membershipId>`; Game day's "Couldn't be delivered" rows → `?delivery=<redemptionId>`; Operations' failed-sends item → `/obs/prize-deliveries?tenant=<slug>`.

### Permissions

| Control | Tenant `org:admin` | Tenant `org:member` | OBS staff |
|---|---|---|---|
| View the library, prize pages, ladders, deliveries, email settings | Yes | Yes (view-only) | Yes, any tenant |
| Create, edit, delete a prize; edit a ladder | Yes | No | Yes |
| Reveal a prize's code | Yes | No | Yes |
| Resend a failed row | Yes, own tenant | No | Yes |
| Send to a different address; Resend selected | No | No | Yes, reverified |
| Send again | No | No | Yes, reverified and typed |
| See the recorded failure reason | No | No | Yes |
| Cross-tenant deliveries | No | No | Yes |
| Edit the Prize email settings | Yes | No | Yes |

Writes pass `refuseReadOnlyWrite` first (D-063), which also refuses a paused tenant's own admins; the client gate is `useCanWrite`. Hiding a control is UX; the server refuses the same call.

---

## Trivia readiness

Trivia isn't built here. The prize side is already game-neutral (`TRV-49`), and this spec keeps it that way:

- **The prize never mentions bingos.** No bingo field, label or preview control lives on the prize page. "Awarded from" shows each usage's `at` text, which the server words per game ("at 3 bingos" today; "places 1–10" for a band).
- **The picker is one component.** `PrizePicker` (value: `prizeId`; props: whether a Needs-details prize may be chosen, the `returnTo` for **New prize**) knows nothing about bingo. A trivia band row will be "places from–to" plus the same `PrizePicker`, saved through the same tiers PUT with the band field the trivia spec adds (`positionBand` beside `threeInARows`).
- **The three-tier cap is bingo's** (`GAME-02`, kept here); trivia bands have no such cap (`TRV-31`). The cap check is keyed on the contest type when trivia lands, not removed.
- **The qualifying line belongs to the tier.** The email's "You hit N bingos." comes from the tier; a band will supply its own line.

---

## Endpoints

All under `/admin`, `requireAdmin`. Tenant targeting as everywhere: a tenant caller's own organization; staff name `?tenant=<slug>`. An id (`:prizeId`, `:contestId`, `:redemptionId`) that belongs to another tenant answers **404**, not 403. Contracts in `obs-b2b-shared/src/api/admin/{prize-library,prizes,prize-deliveries,prize-delivery}.ts`.

| Method | Path | Auth | Who | |
|---|---|---|---|---|
| GET | `/admin/prize-library` | `requireAdmin` | any admin scope | extended |
| GET | `/admin/prize-library/:prizeId` | `requireAdmin` | any admin scope | new |
| POST | `/admin/prize-library` | write gate | tenant `org:admin`, staff | extended |
| PATCH | `/admin/prize-library/:prizeId` | write gate | tenant `org:admin`, staff | extended |
| DELETE | `/admin/prize-library/:prizeId` | write gate | tenant `org:admin`, staff | as fixed (§8.2) |
| POST | `/admin/prize-library/:prizeId/reveal-code` | write gate | tenant `org:admin`, staff | new |
| GET | `/admin/contests/:contestId/prize-tiers` | `requireAdmin` | any admin scope | new |
| PUT | `/admin/contests/:contestId/prize-tiers` | write gate | tenant `org:admin`, staff | extended |
| POST | `/admin/prize-deliveries/search` | `requireAdmin` | any admin scope | new |
| POST | `/admin/all-prize-deliveries/search` | `requireAdmin` | staff only (403 first) | new |
| GET | `/admin/prize-deliveries/:redemptionId` | `requireAdmin` | any admin scope | new |
| POST | `/admin/prize-deliveries/:redemptionId/resend` | write gate | tenant `org:admin`, staff | new |
| POST | `/admin/prize-deliveries/:redemptionId/send-again` | `requireAdminReverified` | staff only | new |
| POST | `/admin/delivery-queue/resend` | `requireAdminReverified` | staff only | unchanged |
| GET | `/admin/prizes/email` | `requireAdmin` | any admin scope | unchanged |
| PUT | `/admin/prizes/email` | write gate | tenant `org:admin`, staff | + `reply_to_in_use` |
| POST | `/admin/prizes/email/preview` | `requireAdmin` | any admin scope | changed |
| GET | `/admin/prizes/handlers` | `requireAdmin` | any admin scope | unchanged |

**Retired:** `GET /admin/prizes` (the ladder read replaces it; its `unawarded` goes) and `GET /admin/delivery-queue` (replaced by `POST /admin/all-prize-deliveries/search`). No per-tier endpoints exist: a tier is written only through the whole-list PUT.

### `GET /admin/prize-library`

As today, each `adminPrizeSchema` row gaining: `prizeType`, `providedBySponsorId`, `providedBy?` (resolved `{ sponsorId, name, logoUrl?, websiteUrl? }`), `shipsWithinDays?`, `hasCode` (and **no** `staticRedemptionCode`), `completeness: { complete, missing }`, and `usedBy[]` entries gaining `tierId`, `threeInARows`, `state` (`draft | open | closed`), `finalized` and `locked`. Top level gains `replyToSet` and `max` (`PRIZE_LIBRARY_MAX`).

### `GET /admin/prize-library/:prizeId`

One prize in the same shape, plus `sends: { sent, failed, queued }` (counted by `tierSnapshot.prizeId`) and `valueFloorCents?` (the value the lock won't let it drop below, with the contest that sets it). 404 for an unknown or foreign id.

### `POST /admin/prize-library`

The library's create, with the body gaining `prizeType` (required), `providedBySponsorId?` and `shipsWithinDays?`, and refusing `redemptionMethod`. The server derives the method, normalises to the type, applies the button default, and sets `handlerId` to `standard-email` unless a resolving one is sent. Refusals: the library cap (409 `prize_library_full`, "Your library holds up to 200 prizes."), a sponsor outside the tenant (400, "Choose a sponsor from this workspace."), field errors (400). Audit `prize_create` (ids and field names; never the code).

### `PATCH /admin/prize-library/:prizeId`

`{ expectedUpdatedAt, ...changedFields }`; absent means unchanged, `null` clears an optional field. Refusals in order: 404; 409 `stale_prize`; 409 `prize_value_locked`; 409 `prize_would_hide` with `{ field, contestId, contestName }`; 400 field errors. On success the changed content fields are copied onto every tier held by a non-finalized contest (§8.4), and the response carries the prize and `refreshedTiers: number`. Audit `prize_update` with the changed field names and `refreshedTiers`.

### `DELETE /admin/prize-library/:prizeId`

As fixed in [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.2: 409 `prize_in_use` while a held tier names it; clears `prizeId` from detached tiers. Audit `prize_delete` before the write.

### `POST /admin/prize-library/:prizeId/reveal-code`

`{ code }`, or 404 when the prize has none. `Cache-Control: no-store`. Not audited: a shared promotional code is not fan data, and the admin revealing it set it.

### `GET /admin/contests/:contestId/prize-tiers`

`{ contest: { contestId, contestName, contestType, state, locked, finalized, updatedAt }, tiers: LadderRow[], replyToSet }`, ladder order. `LadderRow`: `{ tierId, position, threeInARows, prize: { prizeId?, prizeName, prizeType?, prizeImageUrl?, providedBy?, approximateValueCents?, completeness }, sends: { sent, failed, queued } }`. For a tier with a `prizeId`, `prize` is the live library prize; for one without, the tier's own copy.

### `PUT /admin/contests/:contestId/prize-tiers`

The library's shape, unchanged: `{ expectedUpdatedAt, tiers: [{ prizeTierId?, threeInARows, prizeId? }] }`, 1–3 tiers (bingo), distinct counts 1–8. Added: 400 `prize_needs_details` when the contest is `open` or `closed` and a tier names a Needs-details prize. Existing refusals stay: `contest_finalized`, `contest_locked` (a stored count changed, a tier removed, or a re-point to a prize worth less), `tier_bingos_taken`, unknown prize ("That prize isn't in this workspace's library any more."). The response adds `completeness` per tier.

### `POST /admin/prize-deliveries/search`

POST because the search text can be an email address (the Fans exception in [`admin-lists.spec.md`](admin-lists.spec.md)). Body `{ q?, status?: "sent"|"failed"|"queued", contestId?, tierId?, prizeId?, membershipId?, from?, to?, cursor?, limit? }`. `q` matches display names (anywhere) and fan email addresses (whole or start), resolved first to memberships, bounded. Order `createdAt` desc, then `_id`. Response `{ deliveries: DeliveryRow[], page, summary? }`, `summary: { sent30d, failed, queued }` on the first page.

`DeliveryRow`: `{ redemptionId, wonAt, fan: { membershipId, displayName } | null, contest: { contestId, name, exists }, tier: { tierId?, bingos }, prize: { prizeId?, name, prizeType }, game?: { betEventId, label }, status, attempts, reasonKind?, reason?, canResend, canSendAgain }`. `reason` is staff-only (tenants get `null` and read `reasonKind`). `canResend` and `canSendAgain` are computed per caller; the console never re-derives eligibility.

Indexes: `PrizeRedemption { organizationId: 1, createdAt: -1, _id: -1 }`, `{ organizationId: 1, status: 1, createdAt: -1, _id: -1 }`, and `{ organizationId: 1, "tierSnapshot.prizeId": 1, createdAt: -1 }`, which need `PrizeRedemption.organizationId` (the migration).

### `POST /admin/all-prize-deliveries/search`

Staff only, no `?tenant=`, 403 "OBS staff only" before anything else (the cross-tenant read pattern of [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md)). Same body plus `tenant?: slug`; rows add `tenant: { slug, name }`; `summary` is platform totals. Index `{ status: 1, createdAt: -1, _id: -1 }`.

### `GET /admin/prize-deliveries/:redemptionId`

`{ row: DeliveryRow, promised?: PromisedPrize, sentTo: maskedEmail | null, attempts: AttemptEntry[] }`. `AttemptEntry`: `{ n, requestedAt, requestedBy: "award" | "resend" | "send_again", requestedByName?, outcome: "queued" | "sent" | "failed" | "bounced", at?, reasonKind?, reason? }` (staff-only `reason`). Attempts come from the new `PrizeRedemption.attempts[]`; a row written before it gets one entry derived from its own fields, and nothing older is invented.

### `POST /admin/prize-deliveries/:redemptionId/resend`

Body `{ expectedResendCount }`. One conditional write where status is `failed`, `resendCount` equals the expected value, and, for a tenant caller, `resendCount < 3` and `reasonKind` isn't `address`; then the queue message with the usual deduplication id. No `correctedEmail` (400 if sent). Refusals: "Already sent." / "Already being resent." / "This prize changed since you opened it." / "This prize has been resent three times." / "This fan's email couldn't accept it, so it can't be resent to the same address." Audit `prize_resend` first, `detail: { redemptionIds: [id], count: 1, addressCorrected: false, via: "row" }`.

### `POST /admin/prize-deliveries/:redemptionId/send-again`

Staff, reverified. Body `{ expectedResendCount, confirmName, reason: "not_received" | "lost" | "other" }`; `confirmName` must equal the fan's display name (a removed fan can't be sent again). One conditional write where status is `fulfilled` and the count matches → `pending`, `resendCount + 1`; then the queue message. Audit `prize_send_again` (new action) before the write.

### `PUT /admin/prizes/email`

Unchanged except 409 `reply_to_in_use` when clearing Reply-to while a fans-visible contest awards a shipped prize.

### `POST /admin/prizes/email/preview`

Takes `{ prize, prizeId?, threeInARows, settings? }`: the draft prize (content fields, including `prizeType` and `providedBySponsorId`), the saved prize's id to merge its stored code when the draft has none, the count for the bingo line, and unsaved settings (the Prize email card). The credit is resolved from the draft's `providedBySponsorId` within the tenant; unknown shows no credit. The `contestId` parameter and its prize-popup lookup are retired (accepted and ignored).

### The fan wire

`list-contests` and `/b2b/contest/:id` leave out Needs-details tiers and never carry `approximateValueCents` or the code. `GET /b2b/board/:id`'s `awards[].prize` gains `prizeId`, `prizeType` and `providedBy` (§1.5's shape, extended).

---

## Migration

`node-server/scripts/prize-type-migration.mjs` (plan in `scripts/lib/prize-type-migration-plan.cjs`, unit-tested). **Dry run by default, `--apply` writes, dev only** (the same rails as every script: it refuses a database that isn't the shared dev one or a personal prefix). Idempotent. It writes a report (`prize-type-migration-<date>.json`) listing every ambiguous row. **It runs after the prize-library migration as fixed in [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.1**, because it reads the prizes that migration creates.

1. **`prizeType` on every library prize**, from its own fields:

   | Stored | Becomes | Listed when |
   |---|---|---|
   | `in_person` | `pickup` | no location (it would be Needs details) |
   | `shipped` | `shipped` | empty instructions are filled with the default "What happens next" text, and listed |
   | `online` with a code | `code` | never |
   | `online` with a link and no code | `link` | never |
   | `online` with neither | `link` | always (Needs details) |
   | `in_person_or_online` | `pickup` with a location, else `link` | always |
   | no method: a code / a link / a location | `code` / `link` / `pickup`, in that order | always |
   | no method and none of those | `link` | always (Needs details) |

   `redemptionMethod` is rewritten from the type and the button default applied. The migration **clears no stored field**: normalisation happens only in memory for the report, and on the first save in the console. A link stored on a pickup or shipped prize stays and becomes that prize's button.
2. **`providedBySponsorId` on each prize**, from the contest-wide `prizePopup` placement holder of the contests that award it. When every such contest has the same contest-wide holder, it is set. When they disagree, or a contest has only game-level holders, nothing is set and the prize is listed.
3. **Tier copies** of non-finalized contests are refreshed from their prizes, so they carry the new fields. Finalized contests' tiers are not touched.
4. **`PrizeRedemption.organizationId`**, from each row's contest. A row whose contest was deleted before this runs has no contest to read and is listed; from this build on, contest deletion stamps `organizationId` beside `contestName`. Then **`tierSnapshot.prizeId`**, from the row's tier's `prizeId`, best effort on dev data. Then the indexes above.

**The migration never makes a live tier stop awarding** (`PZ-17`). A prize that would come out Needs details while an `open` or `closed`, non-finalized contest awards it is reported, and `--apply` refuses while any exist unless `--accept-needs-details` is passed after a person has read the list.

---

## PRD requirements

**Honoured.**

- **`GAME-02`**: display name, description, approximate value (Advanced), redemption window (Expires), difficulty target (bingos to win, on the tier), redemption method (the type) and location (Where to pick it up). **One to three tiers** per contest with distinct targets (`PZ-09`).
- **`PRIZE-01`**: real-time delivery on the win is unchanged; the snapshot delivers exactly what the fan was shown.
- **`PRIZE-03`**: finalization stays staff-only; a finalized contest's tiers refuse every write and are never refreshed by a prize edit.
- **`PRIZE-07`**: failed sends are reviewable by the team whose fans they are and by Overboard across every tenant, with no cap, and resendable. The hard-bounce half arrives with the Bounced slice.
- **`ADM-03`**: a tenant `org:admin` writes its own library, ladders and email settings; `org:member` views.
- **`ADM-04`**: the delivery method stays selectable (Advanced → Delivery) whenever there is a choice.
- **`TRV-49` / `TRV-50`**: a prize is authored once and carries no game-specific qualifier.

**Deviations, argued.**

- **Tiers are per contest, not per game.** `GAME-02` says "Each game supports 1–3 prize tiers"; the acceptance line "Prize tiers can differ between two games" is met by two contests. A board, its lock and its snapshot are per contest; per-game tiers inside one contest would give one board two ladders. The PRD revision note is owed, not made here.
- **`PRIZE-02` is not reserved on the model.** The earlier draft reserved a per-tier `deliverAt` that the write refused. Trivia's `TRV-32` makes "send prizes" a deliberate contest-level step, so the timing belongs to the contest, and the field is chosen when `PRIZE-02` is built. Nothing is stored that the worker can't honour.
- **`PRIZE-05` / `PRIZE-06` stay deferred.** Code is one shared code per prize. Sponsor batches of unique codes arrive, when the first sponsor's shape is known, as a second Code option backed by the batch seam in [`prize-delivery.spec.md`](prize-delivery.spec.md), "Codes". Nothing on screen mentions it until then.
- **"Sent" is not "delivered"** until bounce capture exists.

---

## Build slice: Bounced (later)

Needs the sending domain authenticated first ([`prize-delivery.spec.md`](prize-delivery.spec.md)).

1. The worker stores the mail provider's message id on each attempt (`attempts[].providerMessageId`) and on the row.
2. Bounce and complaint notifications reach a small handler (verified signature, idempotent) that matches the message id.
3. A permanent bounce moves a `fulfilled` row to `bounced` with `bouncedAt` and a plain reason. Transient bounces change nothing. Complaints are recorded (`complainedAt`) and shown to staff only.
4. The console adds "Bounced" to the Status filter, the column and the Failed tile, with its definition. Tenant Resend is not offered on a bounced row.

Until it ships, the word "Bounced" appears nowhere on screen.

---

## Rules

1. **`PZ-01` — Prize type first.** A prize has exactly one `prizeType`; the page renders nothing else until one is chosen; every create requires it.
2. **`PZ-02` — `redemptionMethod` is derived** from the type on every write; no client sends it.
3. **`PZ-03` — Completeness is one shared function, and incomplete never awards.** Publish refuses, the tiers PUT refuses on a fans-visible contest, the worker skips, the fan wire omits.
4. **`PZ-04` — A prize fans can win never goes back to Needs details** (`prize_would_hide`, across every non-finalized, fans-visible contest that awards it).
5. **`PZ-05` — The code never leaves the server except through Reveal.** Not on a read, the fan wire, the preview frame, an audit row or a log.
6. **`PZ-06` — The lock is contest-safety's, shown in place**: bingos to win, removal, a lowered value (in place or by re-pointing) refuse; the console shows the glyph and the reason under the field.
7. **`PZ-07` — "As promised" only from the snapshot.** No snapshot, no promise, never the current prize in its place.
8. **`PZ-08` — Credit comes from the prize.** `providedBySponsorId` is the only source of "Provided by" in the popup, the email and their previews; one prize, one credit.
9. **`PZ-09` — One to three tiers per bingo contest, distinct bingos 1–8.** Add tier disappears at three.
10. **`PZ-10` — Tenant Resend re-sends, never re-awards.** Own tenant's failed rows only, not address failures, at most three, conditional on the count, audited first, same snapshot, no corrected address.
11. **`PZ-11` — Duplicating a sent prize is staff-only**: reverified, name-confirmed, reasoned, audited first.
12. **`PZ-12` — Status words mean what they say.** "Sent" is "accepted by our mail provider"; "Bounced" exists only once bounce capture does.
13. **`PZ-13` — Deliveries are served from the server**: cursor paging, server-side search and filters, a real total, no cap.
14. **`PZ-14` — Email identity is tenant configuration; the sending address is not.** Sender name, reply-to and subject (`{prize}` the only token) are the tenant's.
15. **`PZ-15` — Shipped prizes need the reply-to.** A shipped prize is Needs details without it; a fans-visible shipped prize blocks clearing it.
16. **`PZ-16` — Prize edits never reach a finalized contest or an award.** The cascade skips finalized contests' tiers; snapshots are never rewritten, by an edit, a sponsor delete or anything else.
17. **`PZ-17` — The migration never makes a live tier stop awarding.**
18. **`PZ-18` — The claim button is on every type** and is never dropped by normalisation or migration.
19. **`PZ-19` — The prize side never mentions bingos.** The qualifier belongs to the tier or band.

## Known gaps (recorded, not blocking)

- **The shared additions are not requested yet**: `prizeType`, `providedBySponsorId`, `shipsWithinDays` on `B2BPrize`, `B2BPrizeTier` and `PRIZE_CONTENT_FIELDS`; `prizeId`, `prizeType`, `shipsWithinDays`, `providedBy` on the snapshot; `organizationId` and `attempts[]` on `PrizeRedemption`; `PrizeCompleteness.ts`; `prize-deliveries.ts`; the award's `providedBy`; the `prize_send_again` audit action. All additive.
- **The popup doesn't state type details** (the pickup place, the expiry). It shows what the current `PrizeModal` shows; the email carries the rest. The fan app overhaul is where the popup learns the type.
- **The popup appends "!" to the description** in its headline, so a description ending in a full stop reads "….!". A one-line fan-app fix, or tenants learn to leave the stop off; the prize page's preview shows it either way.
- **The popup shows no credit for a sponsor without a prize-popup logo**, while the email shows the name. Today's fan-app rule, kept.
- **The game a prize was won at** needs the evaluator to put the completing prop's `betEventId` on the fulfilment message; rows before that show no game line.
- **The approximate value has no reader** yet; the sponsor recap and the usage export are where it belongs.
- **Complaints** are recorded but have no tenant surface.
- **The PRD's `GAME-02`, `PRIZE-02`, `PRIZE-05`/`PRIZE-06` revision notes** are owed to the PRD.

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- The staff bulk resend endpoint stays as it was; **Resend selected** on the cross-tenant view uses it.
- A new tier starts with no bingo count, and the admin picks one before saving.
- The email's **Provided by** credit shows the sponsor's logo with the sponsor's name as its alt text.
- Deliveries rows don't show the game yet.
- The old `/delivery-queue` link lands on the cross-tenant view, with its workspace filter carried over as `?tenant=`.

## References

- PRD: [`GAME-02`, `PRIZE-01`–`PRIZE-07`, `ADM-03`, `ADM-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md); trivia [`TRV-31`, `TRV-32`, `TRV-49`, `TRV-50`](../../../documents/PRD/trivia-game-type.md)
- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) — §1.5, §3.1, §3.2, §8
- [`prize-delivery.spec.md`](prize-delivery.spec.md) — the engine, registry, template and staff resend
- [`contest-safety.spec.md`](contest-safety.spec.md) — the lock and the snapshot
- [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the library revision this builds on; Rule 6 (history outlives a tier)
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the Delivery queue, now the cross-tenant deliveries view
- [`admin-sponsors.spec.md`](admin-sponsors.spec.md), [`admin-uploads.spec.md`](admin-uploads.spec.md), [`admin-preview.spec.md`](admin-preview.spec.md), [`admin-lists.spec.md`](admin-lists.spec.md), [`admin-game-day.spec.md`](admin-game-day.spec.md)
- Decisions: D-059 (view-only presentation), D-063 (write gate), D-066 (Overboard notifies, sponsors own the value), D-068 (honesty by omission)
- Mocks (workspace `mocks/console-v2/`): `prizes-library.html`, `prize-page.html`, `prize-page-pickup.html`, `prize-deliveries.html`, `prize-deliveries-drawer.html`, `contest-prizes.html`
