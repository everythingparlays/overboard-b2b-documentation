# Core Module Spec: Admin — Prizes (tiers, deliveries, email settings)

**Implements:** PRD `GAME-02` (as revised: tiers belong to a contest, not a game; see "PRD requirements"), `PRIZE-01`, `PRIZE-03`, `PRIZE-07`, `ADM-03`. Also carries `ADM-04`'s handler-selection half forward from [`prize-delivery.spec.md`](prize-delivery.spec.md), and reserves the data `PRIZE-02` needs.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, the write grant, reverification, the view-only presentation (D-059), and the Principles (Honesty by omission, Rule 13). [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page and its tabs, the create builder, Publish. [`contest-safety.spec.md`](contest-safety.spec.md) (lands with G2's PR this wave) — the lock, `tierSnapshot`, the `contest_locked` refusal. [`prize-delivery.spec.md`](prize-delivery.spec.md) — the delivery engine, the method registry, the email template, the attempt claim and the staff resend. [`admin-lists.spec.md`](admin-lists.spec.md) (lands with G1's PR this wave) — cursor paging and the endless-scroll list kit. [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — sponsor records and their prize-popup logo. [`admin-game-day.spec.md`](admin-game-day.spec.md) — the `reasonKind` failure categories and their tenant copy. [`admin-fans.spec.md`](admin-fans.spec.md) — masking and `requireReverification`.

**Supersedes:** the prize-tier half of [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) (`/prizes`, the tier drawer, the whole-list tier PUT as the console's write path); the Prizes-screen sections of [`prize-delivery.spec.md`](prize-delivery.spec.md) (the per-contest view, the bingo ladder, the tier drawer, the Prize email card and its preview drawer, the Delivery card); the Delivery queue screen of [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) as a separate screen; the prize email's "Presented by" credit source (the `prizePopup` placement holder); and the Game day decision that tenants get "no retry control" anywhere ([`admin-game-day.spec.md`](admin-game-day.spec.md)), for the Prize deliveries page only.

**Status:** Draft. Written 2026-09-24 for the S1 console redesign.

**Revised 2026-09-24** (ruling, Arthur) — prizes move into the contest. A tier is edited on a full page inside the contest's Prizes tab, and its **prize type is chosen first** (pick up in person, code, link, shipped), so only that type's fields show. Optional parts sit behind checkboxes; value is an optional advanced field. A tier can name a **"Provided by" sponsor**, which drives the credit in the popup and the email. The Prizes page becomes **Prize deliveries**: sends, failures and resends across contests. The tenant's sender name, reply-to and subject move to a Configuration page, **Emails**. Email stays the only delivery channel, because phone sign-in doesn't exist.

## Overview

Prizes today are split across three places that don't know about each other. A tier is edited in a 440px drawer with fifteen fields in one column, in an order that starts with the name and never asks what kind of prize it is; "How to redeem" is a dropdown near the bottom, and fields that only make sense for one kind of prize (a code, a shipping promise) sit beside fields for another. Which sponsor gets credit for a prize is not on the tier at all: it is whoever holds the prize-popup placement at the game where the prize was won, set on a different screen. The tenant's email settings live in a side card on the Prizes page, and the failures a tenant most needs to act on are on an OBS-only screen they can't reach.

The fix follows the ruling's shape. A prize is something a fan wins inside a contest, so it is set up inside the contest. The first question is the one that decides every other question: what kind of prize is this? Deliveries are an operations view, not a configuration view, so they get their own page with the same list pattern as every other growing list. Email settings are tenant-wide, so they sit with the tenant's other settings.

**The whole change, in one line:** a tier becomes a typed, sponsor-credited prize edited on its own page inside the contest, every send is visible and resendable by the team that awarded it, and the tenant's email identity is a setting.

**In scope:**

- The tier model: `prizeType`, `providedBySponsorId`, `contestId`, `shipsWithinDays`, and the reserved `deliverAt`; `redemptionMethod` derived from type; completeness (Complete / Needs details) as a shared derived value.
- The snapshot fields this spec adds to G2's `tierSnapshot`, and the "as promised" shape the console reads back.
- The full-page tier editor, with the live popup and email previews.
- The contest Prizes tab ladder.
- **Prize deliveries** (`/prize-deliveries`), tenant and cross-tenant (`/obs/prize-deliveries`), with its detail drawer, tenant **Resend** and staff **Send again**.
- **Emails** (`/settings/emails`).
- Per-tier endpoints, the deliveries endpoints, the email settings endpoints, and the changes to existing routes. Contracts in `obs-b2b-shared/src/api/admin/{prize-tiers,prize-deliveries,email-settings}.ts`.
- The migration of existing tiers and of the prize-popup credit.
- A later build slice: **Bounced**, fed by our mail provider's bounce notifications.

**Not in scope:**

- **The delivery engine.** The worker, the attempt claim, the method registry, the email template's construction and the local delivery loop stay in [`prize-delivery.spec.md`](prize-delivery.spec.md). This spec changes what the template merges (below, "What the winner sees") and nothing about how it sends.
- **Taking the snapshot.** G2's [`contest-safety.spec.md`](contest-safety.spec.md) builds `tierSnapshot` and delivers from it. This spec adds three fields to it and specifies how the console reads it.
- **The fan-side prize popup.** S2 owns the popup's layout. This spec fixes what the popup is given (the tier fields and the "Provided by" sponsor) and previews it through the real fan app.
- **Coupon-code batches** (`PRIZE-05`/`PRIZE-06`'s batch half). Still deferred; see "PRD requirements".
- **Deferred delivery** (`PRIZE-02`). The field is reserved and refused; no UI.
- **Shipping-address capture.** A shipped prize asks the winner to reply with their address. Capturing it in the fan app is a separate feature with its own consent and retention questions.
- **Image upload.** The image is a pasted URL, as everywhere else in the console today. The editor says nothing about upload.

---

## The tier model

### Fields

`B2BPrizeTier`, collection `${prefix}bingo_prize_tiers`. Existing columns keep their names and limits; the console's limits are tighter on new writes where noted, and a stored value longer than a new console limit is kept until someone edits that field.

| Field | Type | Console control | Types | Fan popup / email | Notes |
|---|---|---|---|---|---|
| `prizeType` **(new)** | `"pickup" \| "code" \| "link" \| "shipped"` | The four type cards | all | Decides the lead line and blocks (below) | Required on every create and on any save of a migrated tier. |
| `threeInARows` | int 1–8 | **Bingos to win**, segmented 1–8 | all | Ladder; "You hit 3 bingos." | Distinct per contest. Locked after the first board (G2). |
| `prizeName` | string, model ≤200 | **Name**, ≤60 | all | Popup badge and ladder; email headline and `{prize}` | Required to save. |
| `prizeDescription` | string | **Description**, ≤300 | all | Popup headline; email body | Empty → Needs details. |
| `prizeImageUrl` | https URL ≤2000 | **Show an image** → "Image URL" | all | Popup image; email image | |
| `providedBySponsorId` **(new)** | ObjectId → `B2BSponsor` | **A sponsor provides this prize** → "Provided by" | all | "Provided by" credit, popup and email | Same tenant only. One sponsor per tier, the same at every game. |
| `redemptionWindow` | `{ startsAt?, endsAt?, daysAfterAward? }` | **Expires** → "N days after winning" or "On a date" | all | "Use it within 30 days of winning." / "Use it by Oct 31." | `startsAt` is kept but no longer offered (below). |
| `approximateValueCents` | int 0–10,000,000 | Advanced → **Approximate value** | all | **Never shown to fans** | Can't be lowered or cleared after the first board (G2). |
| `redemptionLocation` | string, model ≤500 | Pick up → **Where to pick it up**, ≤120 | pickup | "Show this to staff at {location}." | Required for pickup. |
| `prizeClaimInstructions` | string, model ≤5000 | **What to bring** (pickup), **How to redeem** (code, link), **What happens next** (shipped); ≤500 | all four, relabelled | The type's instructions block | Required for shipped (prefilled). |
| `staticRedemptionCode` | string ≤64, no spaces, `select: false` | Code → **Code** | code | Email only ("Your code"); never the popup | Required for code. Masked after save. |
| `prizeClaimButtonLinkUrl` | https URL ≤2000 | **Where to redeem** (code), **Link** (link) | code, link | The button | Required for link. |
| `prizeClaimButtonText` | string ≤200, console ≤40 | Link → **Button text** | link | The button label | Default "Claim your prize". Code tiers store none and render "Redeem". |
| `shipsWithinDays` **(new)** | int 1–365 | Shipped → **Ships within** | shipped | "Ships within 14 days." | Optional. |
| `redemptionMethod` | `in_person \| online \| in_person_or_online \| shipped` | none | derived | Read by the fan app until it reads `prizeType` | **Derived on every write** (`PZ-02`). |
| `handlerId` | string ≤100 | Advanced → **Delivery**, only when the tenant has more than one method or the stored one doesn't resolve | all | Which method sends | `standard-email` for every new tier. |
| `contestId` **(new)** | ObjectId → `B2BContest` | none | all | none | Back-reference; the contest's `prizeTiers[]` stays the ordering authority. |
| `deliverAt` **(reserved)** | `"immediately" \| "after_finalize"` | none | all | none | Absent = `immediately`. The write refuses `after_finalize` until `PRIZE-02` is built (`PZ-16`). |
| `createdAt` / `updatedAt` | Date | none | — | — | `updatedAt` is the tier's precondition token. |

**What happened to the rest of today's drawer.** "Redeemable from" (`redemptionWindow.startsAt`) is no longer offered: a prize that can be won before it can be used is a case no tenant has asked for, and it made "Expires" a three-bound puzzle. A stored `startsAt` is kept on save and still reaches the email; the editor shows it under **Expires** as a read-only line, "Can be used from Oct 3.", with **Clear**. "In person or online" is not a type: it was a label with no behaviour, and the migration resolves it (below).

### `redemptionMethod` is derived from the type

| `prizeType` | `redemptionMethod` |
|---|---|
| `pickup` | `in_person` |
| `code` | `online` |
| `link` | `online` |
| `shipped` | `shipped` |

The server sets it on every create and update; the contract refuses a body that sends it. It stays on the model only because today's fan app reads it; it goes when the fan app reads `prizeType` (S2), and nothing else may start reading it.

**Saving normalises the tier to its type.** Fields that belong to another type are cleared on save, server-side: a tier switched from Code to Link loses its code, so the next winner's email can't carry a stale one. The editor says so before the save (below, "Switching type").

### The code stays secret

`staticRedemptionCode` keeps `select: false`. No read returns it except the reveal endpoint; the tier read carries `hasCode: boolean`. It never reaches the fan wire, the preview frame, an audit row or a log. A PATCH that omits `staticRedemptionCode` leaves it unchanged; `null` clears it (and, for a code tier, makes it Needs details). `PRIZE-06`'s no-duplicates rule does not apply to a code shared by design; the editor says it is shared ("Every winner of this tier gets the same code.").

### Complete / Needs details

Completeness is **derived, never stored**, by one pure function in `obs-b2b-shared` (`interfaces/b2b/PrizeTierCompleteness.ts`, `tierCompleteness(tier, { replyToSet, methodResolves })` → `{ complete: boolean, missing: TierField[] }`), used by the server, the worker and the console so they can't disagree.

| Type | Needs details when empty |
|---|---|
| every type | Description; a delivery method that resolves in the tenant's catalog |
| `pickup` | Where to pick it up |
| `code` | Code |
| `link` | Link |
| `shipped` | What happens next; the workspace's **Reply-to** on Emails (a winner replies to it with their address) |

Name, type and bingos to win are required to save at all, so they never appear as missing. A checked optional part with nothing in it ("Show an image" with no URL, "Expires" with no days) is a field error on save, not a completeness state: an unchecked box is how a tenant says "none".

**A Needs-details tier never awards and blocks Publish** (`PZ-03`). The worker treats it as no tier at that count (the win is `skipped`, like any count no tier pays); the fan wire leaves it out, so fans never see a prize that can't be delivered.

**A tier fans can see never goes back to Needs details** (`PZ-04`). On a published contest, a save that would empty a required field of a Complete tier is refused, and so is clearing the Reply-to while a shipped tier on a published contest needs it. A new tier added to a published contest may be saved incomplete; it stays out of fans' sight until it is complete, and from then on this rule holds it.

### The snapshot the console reads

G2 snapshots the paying tier onto `PrizeRedemption.tierSnapshot` at award time. This spec adds three fields to it, additive, requested through the shared queue with the build:

```ts
tierSnapshot?: {
  // ...G2's fields (prizeTierId, threeInARows, handlerId, prizeName, prizeDescription,
  // prizeImageUrl, prizeClaimInstructions, prizeClaimButtonLinkUrl, prizeClaimButtonText,
  // approximateValueCents, redemptionWindow, redemptionMethod, redemptionLocation,
  // staticRedemptionCode (select:false), snapshotAt)
  prizeType?: PrizeType;          // new
  shipsWithinDays?: number;       // new
  providedBy?: {                  // new: copied from the sponsor at award time
    sponsorId: ObjectId;
    name: string;
    logoUrl?: string;             // the sponsor's prize-popup logo
    websiteUrl?: string;
  };
}
```

The sponsor is copied, not referenced, for the same reason the tier is: the credit a winner saw is part of what they were promised, and renaming or re-logoing the sponsor afterwards must not rewrite it.

The console never receives the raw snapshot. The delivery detail read projects it to **`PromisedPrize`**:

```ts
interface PromisedPrize {
  name: string;
  description: string;
  imageUrl?: string;
  prizeType: PrizeType;
  details: {
    location?: string;          // pickup
    instructions?: string;      // what to bring / how to redeem / what happens next
    link?: string;              // code: where to redeem; link: the link
    buttonText?: string;        // link
    hasCode: boolean;           // the code itself is never projected
    shipsWithinDays?: number;   // shipped
    expires?: { daysAfterAward?: number; endsAt?: string; startsAt?: string };
  };
  providedBy?: { sponsorId: string; name: string; logoUrl?: string; websiteUrl?: string };
  bingosToWin: number;
  snapshotAt: string;
}
```

A pre-snapshot row (awarded before G2's change) has no `PromisedPrize`, and the drawer omits the block rather than showing today's tier under the words "as promised": what those fans were promised isn't recoverable, and presenting the current tier as the promise would be fabrication. A snapshot taken before this spec's fields exist has no `prizeType`; the projection derives it from the snapshot's own fields with the migration mapping below (for `online`, a snapshot holding a code reads as Code, otherwise Link), and it has no `providedBy`, so the drawer shows no credit for it.

---

## What the winner sees, per type

The email template ([`prize-delivery.spec.md`](prize-delivery.spec.md)) becomes type-aware. Every block still follows the omission rule: unset means absent.

| Type | Lead line (popup and email) | Blocks |
|---|---|---|
| Pick up | "Show this to staff at {location}." | "What to bring"; expiry line |
| Code | none | "Your code" block (email only); "Redeem" button when "Where to redeem" is set; "How to redeem"; expiry line |
| Link | none | The button ("Claim your prize" or the tier's text); "How to redeem"; expiry line |
| Shipped | none | "What happens next"; "Ships within 14 days."; expiry line (rare, allowed) |

Two changes to the email that apply to every type:

- **"Approximate value" leaves the email.** The ruling makes value an internal field ("never shown to fans"). It stays on the tier for the sponsor recap and exports.
- **The credit reads "Provided by", from the tier.** The mark (the sponsor's prize-popup logo, 32px tall, up to 160px wide, on the white card, linked to the sponsor's website when set; the name as text when the sponsor has no logo) comes from `providedBy` in the snapshot. It no longer comes from the `prizePopup` placement holder, and the worker no longer reads the board's game to find one. The popup shows the same credit under the prize: the logo 48px tall, up to 176px wide. Same field, so the two can't disagree (the intent of `SP-07`, now by construction).

---

## The screens

### The contest Prizes tab — the ladder

Route `/contests/:id/prizes` (staff: `?tenant=`). In the builder, step 4 renders the same ladder at `/contests/:id/setup/prizes`.

**Layout.** A lede line, "What fans can win in this contest. Tiers pay once a fan's board reaches their number of bingos.", then the ladder: up to three **tier cards**, ordered by bingos to win, lowest first, in one row at ≥1100px and stacked below. Each card, top to bottom:

1. Type icon (pick up, code, link, shipped) and the position, "Tier 1".
2. Name (Archivo 20/700), one line, truncated with the full name in a tooltip.
3. "3 bingos" (or "1 bingo"). Locked: the lock glyph after it, tooltip "Locked since the first fan joined."
4. "Provided by" with the sponsor's logo at 20px tall and its name. Absent when the tier names no sponsor.
5. Status pill: "Complete" or "Needs details". Needs details names what is missing on the card, muted: "Needs details · Code".
6. When the tier has sends: "124 sent" and, when above zero, "2 failed" in the status red, each a link to Prize deliveries filtered to this contest and tier.

The whole card opens the tier editor. **Add tier** is a dashed card after the last tier ("Add tier", with "Up to 3 tiers" under it), shown while there are fewer than three and hidden at three. Under the ladder, when fans have reached a bingo count no tier pays: "Fans reached 4 bingos 14 times. No tier pays at 4." (one line per count, real `skipped` counts, the same numbers `prize-delivery.spec.md` put on its ladder).

**States.**

| State | What renders |
|---|---|
| Loading | Three card skeletons in the ladder's shape |
| Empty | "No prize tiers yet." and a primary "Add tier". In the builder, under it: "Fans can't win anything until you finish a tier." |
| Locked | Lock glyph on each card's bingos; the line "Fans have joined, so bingos to win can't change and tiers can't be removed. You can still add a tier and edit what each one gives." above the ladder |
| Finalized | Cards read-only (they still open the editor, read-only); no Add tier; the line "This contest is finalized, so its prizes can't change." |
| Load failed | The kit's `ReportableLoadError` in the ladder's place |
| Member (read-only) | Same cards; no Add tier; the line "You can view prizes. Changing them is for admins." Cards open the editor as a view-only presentation |

### The tier editor (full page)

**Routes.** `/contests/:id/prizes/new` and `/contests/:id/prizes/:tierId`; in the builder, `/contests/:id/setup/prizes/new` and `/contests/:id/setup/prizes/:tierId` (the builder's left rail and footer stay; the editor's own footer replaces the builder's "Back / Continue" while it is open, and saving or cancelling returns to the builder's ladder). The drawer is retired.

**Header.** Back link "Prizes" (to the ladder); eyebrow "{contest name} · Prize tier"; H1 the tier's name, or "NEW PRIZE TIER"; the status pill (Complete / Needs details). Right: nothing but the status, so the one primary action is Save.

**Layout.** Form column (max 640px) and a sticky right rail (the previews) at ≥1280px; the rail drops below the form under 1280px. Sticky footer bar: "Cancel" and the primary "Save tier" ("Add tier" for a new one). Save is disabled until the draft differs from the saved tier.

#### 1. The type block (first, alone)

Heading "What kind of prize is it?" and four selectable cards (a radio group; arrow keys move, Space selects):

| Card | Label | Explanation |
|---|---|---|
| `pickup` | "Pick up in person" | "Winners collect it somewhere you choose, like the team store." |
| `code` | "Code" | "Winners get a code to use online or at a register." |
| `link` | "Link" | "Winners get a button to a page where they claim it." |
| `shipped` | "Shipped" | "You mail it to winners. They reply with their address." |

**Nothing else renders until a type is chosen** (`PZ-01`), and the rail shows a quiet frame with "Choose a prize type to see the preview." Choosing one reveals the common fields and that type's block below, and focus moves to Name.

**Switching type.** The cards stay at the top of the page. Switching keeps every common field and swaps the type block. The previous type's values stay in the draft while the page is open (switching back restores them) and a muted line appears under the cards: "Saving as Link clears the code." (the fields named are the ones that would be lost). After the first fan joins, switching is still allowed: it is part of "what the prize is", like its wording, and the snapshot keeps every winner's promise.

#### 2. Common fields, in order

1. **Name.** Required, ≤60, counter at 48. Placeholder "Signed jersey". Focused after the type is chosen.
2. **Bingos to win.** Segmented 1–8. A count another tier uses is disabled with the tooltip "Tier 2 already uses 3 bingos". Help: "The more bingos, the fewer winners." After the first board: a read-only value with the lock glyph and the tooltip "Locked since the first fan joined." A new tier on a locked contest keeps the control, with the hint "Fans have joined, so this can't change after you save."
3. **Description.** Required for Complete, ≤300, counter at 250. Help: "What the winner reads. Fans see this in the prize popup and the email."
4. **Show an image** (checkbox). Reveals "Image URL" (https). After a valid URL loads, a 64px thumbnail and the measured line "800×800", factual. A URL that doesn't load: the field error "This image didn't load. Check the link." on blur.
5. **A sponsor provides this prize** (checkbox). Reveals "Provided by": a Combobox of the tenant's sponsors (search, endless scroll, each with its prize-popup logo at 20px and name). Help: "Shown as 'Provided by' in the prize popup and email." A sponsor with no prize-popup logo is still choosable; the line under the field says "Shows as the name, since this sponsor has no prize popup logo." with a link "Add one" to `/sponsors/:id`. No sponsors in the tenant: the checkbox is replaced by the line "No sponsors yet. Add one on the Sponsors page."
6. **Expires** (checkbox). Reveals a segmented "N days after winning | On a date" and its input: days (1–3650, "days after winning") or a date picker (today or later). A stored "Can be used from" date shows here read-only with Clear.
7. **Advanced** (collapsed disclosure, "Advanced"). **Approximate value** ("$", whole dollars or cents), help "Never shown to fans." After the first board, a lowered or cleared value is refused inline with "This can't be lowered after the first fan joins." **Delivery**, only when the tenant's catalog offers more than one method or the stored method doesn't resolve (then the disclosure opens by itself and the field reads "Choose how this prize is delivered."): a select of the tenant's methods by label and one-line description, from `GET /admin/prizes/handlers`.

#### 3. The type blocks

**Pick up in person.**
- **Where to pick it up.** Required for Complete, ≤120. Placeholder "Team store, Gate C". Help: "Winners see 'Show this to staff at …'"
- **What to bring.** Optional, ≤500. Placeholder "Your ID and this email".

**Code.**
- **Code.** Required for Complete, ≤64, no spaces (the field error "Codes can't contain spaces."). Help: "Every winner of this tier gets the same code." After save it shows masked ("••••••••") with **Reveal** (admins and staff; members see only "A code is set"). Revealed, it shows in monospace with **Copy** and **Hide**; editing it replaces it.
- **Where to redeem.** Optional https URL. Help: "Adds a 'Redeem' button that opens this page."
- **How to redeem.** Optional, ≤500. Placeholder "Enter the code at checkout."

**Link.**
- **Link.** Required for Complete, https URL.
- **Button text.** Optional, ≤40, placeholder "Claim your prize" (the default when empty).
- **How to redeem.** Optional, ≤500.

**Shipped.**
- **What happens next.** Required for Complete, ≤500, prefilled "Reply to this email with your shipping address and we'll send it out." Help: "Fans see this in the prize popup and the email."
- **Ships within.** Optional, 1–365 days.
- When the workspace has no Reply-to: the line "Winners reply to your reply-to address, which isn't set yet." with a link "Set it in Emails". The tier is Needs details until it is set.

Validation answers beside each input, on blur and on save; the server's field errors land in the same place. A URL that isn't https is "Use a link that starts with https://".

#### 4. The right rail: previews

A sticky rail (420px) with a segmented control **"Popup | Email"**; one preview shows at a time, and the choice is remembered per user for the session. Both are bound to the unsaved draft.

- **Popup.** The real fan app in preview mode through the console's one host, `FanAppPreview` (the contract is `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` in the workspace; its message names and render-document sections are adopted as written). The frame opens on screen `prize` with the phone device (390px, never scaled); no screen switcher here. The render document's `contest.prizeTiers` is the contest's tiers in ladder order with this tier's unsaved draft in its place (a new tier inserted at its bingos position); `sample.prizeTierIndex` points at it and `sample.bingosHit` is its bingos to win. Each tier carries `prizeType`, the derived `redemptionMethod`, `providedBySponsorId`, and beside it the resolved `providedBy: { sponsorId, name, logoUrl, websiteUrl }` (`logoUrl` is the sponsor's prize-popup logo); that sponsor is also included in `sponsors.sponsors`. The API stores only the id: the resolved object exists in the render document, the award snapshot and the console's reads, always in that one shape ([`admin-preview.spec.md`](admin-preview.spec.md), "What the console sends"). The console never sends `staticRedemptionCode` or the contest's internal note. Skeleton until the first `rendered`; after 8 seconds without `ready`, the card "The fan app didn't load." with **Retry**. The frame carries the fan app's own PREVIEW chyron; the console adds no label.
- **Email.** The server's real template, rendered by `POST /admin/prizes/email/preview` with the unsaved tier and the tenant's saved Emails settings, in a sandboxed `srcDoc` iframe inside a white letter frame at 420px (the width most winners read it at on a phone). "Open full width" opens a centred dialog at 600px. A saved tier's code isn't in the draft; the request names the tier and the server merges the stored code, so the preview shows what the winner gets. Refreshes on a ~300ms trailing debounce. A preview request that fails keeps the last render and shows "Couldn't update the preview." with **Try again** under it.

Both show the "Provided by" credit at its real size. Nothing else on the page previews: the old "Email preview" tab and the Prize email preview drawer are gone, and this rail is where their content lives now.

#### 5. Saving, leaving, deleting

- **Save.** "Save tier" sends a create or a PATCH. Success: the inline line "Saved." beside the button, the status pill updates, and a new tier's URL becomes `/contests/:id/prizes/:tierId` (replace, not push). The editor stays open; "Prizes" goes back to the ladder.
- **After the first fan joins**, above the form: "Changes apply to prizes awarded from now on. Fans who already won keep what they were promised."
- **Conflicts.** 409 `stale_tier` (someone else saved it): the line "This tier changed since you opened it." with **Reload** (the draft stays until the reader chooses). 409 `contest_locked`: the field's inline error "This can't change after the first fan joins." 409 `contest_finalized`: the page turns read-only with "This contest is finalized, so its prizes can't change."
- **Unsaved changes.** The draft is kept in `sessionStorage` (keyed by user, tenant, contest and tier, with the saved `updatedAt` as its baseline, the Fields & Opt-ins pattern) so a reload doesn't lose it; a draft whose baseline no longer matches is dropped with the line "This tier changed while you were away, so your unsaved edits were cleared." Leaving by any in-app route with unsaved changes opens a centred dialog, "Leave without saving?", body "Your changes to this tier will be lost.", buttons "Keep editing" (default) and "Leave". Closing the tab asks through the browser's own prompt.
- **Delete.** A "Delete tier" section at the bottom of the form, for admins and staff, shown only before the first fan joins. It opens a centred dialog, "Delete this prize tier?", body "Fans won't be able to win "{name}". Prizes already sent aren't affected." (for a draft contest: "Fans haven't seen it yet."), buttons "Delete tier" (danger) and "Cancel". On a published contest the dialog runs reverification first (admin-surface's list: deleting a prize tier); on a draft it doesn't, because nothing a fan can see changes. After the first fan joins the section is replaced by the line "Tiers can't be removed after the first fan joins." Deleting detaches the tier; redemption history stays (games spec Rule 6).

#### 6. Editor states

| State | What renders |
|---|---|
| Loading | Form skeleton in the page's shape; rail skeleton |
| New | Only the type block, and the rail's "Choose a prize type to see the preview." |
| Needs details | The pill "Needs details" and, under the header, "Add {missing fields, in form order} to finish this tier." Each missing field shows a quiet marker, not an error |
| Locked | The locked-state line above; bingos read-only with the lock glyph; delete replaced by its line; value lowering refused inline |
| Finalized | Everything read-only, the finalized line, no footer |
| Not found | "This prize tier doesn't exist in this contest." with a link "Back to prizes" (a tier id from another tenant or contest answers the same) |
| Load failed | `ReportableLoadError` |
| Member (read-only) | The view-only presentation: static values where an admin gets inputs, the code as "A code is set", the rail's previews live, one line "You can view this tier. Changing it is for admins." |

### Prize deliveries

Tenant sidebar item **Prize deliveries** (`/prize-deliveries`, Workspace section, hue: prizes), replacing Prizes. `/prizes` redirects here; `/prizes?contest=<id>` redirects to that contest's Prizes tab.

**Header.** Eyebrow "Prizes", H1 "PRIZE DELIVERIES", lede "Every prize your fans have won, and whether it reached them."

**Tiles** (KpiTile, hue outline, 40px Archivo numbers):

| Tile | Number | Caption | Click |
|---|---|---|---|
| "Sent" | `fulfilled` rows with `fulfilledAt` in the last 30 days | "Last 30 days" | Status → Sent, date → Last 30 days |
| "Failed" | `failed` rows (and `bounced`, once it exists), all time | "Needs attention" when above zero, else "Nothing to fix" | Status → Failed |
| "Queued" | `pending` rows | "Sending now" | Status → Queued |

The Failed number is in the status red only when above zero. Tiles show the workspace's totals and don't follow the search or filters.

**Toolbar** (sticky, G1's `InfiniteTable`): search "Search by fan name or email"; **Status** segmented "All · Sent · Failed · Queued"; **Contest** Combobox ("All contests", endless scroll); **Date** select "Any time · Today · Last 7 days · Last 30 days · Custom…" (Custom reveals two date inputs); the count, "1,284 deliveries". Filters reached by link show as removable chips: "Tier: Signed jersey", "Fan: J. Smith". Every filter lives in the URL (`?status=failed&contest=…&tier=…&fan=<membershipId>&from=&to=`); the search text does not, because it can be an email address.

**Table** (endless scroll, newest win first):

| Column | Content |
|---|---|
| When | When the fan won it, relative ("2 min ago", "Sep 21"), exact time in a tooltip. Header tooltip: "When the fan won the prize." |
| Fan | Display name, linking to `/fans/:id`. A deleted fan reads "Removed fan", unlinked |
| Contest | Contest name, linking to its Prizes tab |
| Tier | Type icon and the tier name as promised (the snapshot's; the live tier's for older rows) |
| Game | "vs Denver · Sep 21", when the row records the game; otherwise empty |
| Status | "Queued", "Sent", "Failed" (and "Bounced", later). Header tooltip lists the definitions (below) |
| Attempts | "1", "3" |
| (actions) | A row menu: "View details"; "Resend" (eligible rows); staff: "Send again" |

A row opens the detail drawer; `?delivery=<redemptionId>` deep-links to it.

**The status vocabulary, honestly defined.** The column header's tooltip and the drawer use these exact definitions:

| Status | Stored | Definition shown |
|---|---|---|
| "Queued" | `pending` (first send or a resend) | "Waiting to send. Most prizes send within a minute." |
| "Sent" | `fulfilled` | "Accepted by our mail provider." |
| "Failed" | `failed` | "It didn't go out. The details say why." |
| "Bounced" | `bounced` (later slice) | "Accepted by our mail provider, then turned away by the fan's inbox." |

"Sent" deliberately does not say "delivered": today nothing tells us what happens after our mail provider accepts a message, so "delivered" would claim more than we know. Wins that no tier pays (`skipped`) are not deliveries and never list here; the contest's ladder shows them.

**States.**

| State | What renders |
|---|---|
| Loading | Tile skeletons; table skeleton rows |
| Empty workspace | "No prizes sent yet." (tiles show zeros) |
| No matches | "No deliveries match." with "Clear search and filters" |
| Later page failed | The rows stay; "Couldn't load more." with "Try again" |
| Load failed | `ReportableLoadError` |
| Member (read-only) | Everything visible; no Resend anywhere; one line under the header "You can view deliveries. Resending is for admins." |
| Paused workspace | As member, under the paused banner |

#### The detail drawer

Stays a drawer (440px, the kit's): it is small, read-mostly, and read in the context of the list the operator is working down, which a page would take them away from. Title: the fan's display name; description: the status chip and "Won Sep 21, 8:41 PM".

1. **As promised.** The `PromisedPrize`, rendered compactly: image (64px), name, description, the type line ("Pick up at Team store, Gate C", "Includes a code", "Link: claim.hyvee.com/…", "Ships within 14 days"), expiry, "Provided by" logo and name, "At 3 bingos". Absent for a row with no snapshot.
2. **Sent to.** The fan's masked email ("j•••@gmail.com"), the Fans masking; staff see the same.
3. **Sends.** The attempt timeline, newest last, one entry per attempt: "Queued 8:41 PM" → "Sent 8:41 PM" or "Failed 8:42 PM", with who asked for a resend ("Resent by Dana K., 9:03 PM"; "Sent again by Overboard, Sep 22"). An attempt sent to a corrected address reads "Sent to a different address", never the address. A failed attempt shows its plain reason (the `reasonKind` sentences from Game day: "This prize isn't set up to send yet.", "The fan's email couldn't accept it.", "The send didn't go through."); staff also see the recorded reason text in monospace beneath.
4. **Actions** (footer), per the table below. Resend confirms inline in the drawer: "Resend this prize? The fan gets the same prize they won, at the same address." with "Resend" and "Cancel"; after it: "Queued to resend." and the timeline gains the entry. No toasts.

Links at the foot: "Open fan" and "Open contest prizes".

#### Resend and Send again

| Action | Rows | Who | Reverified | What it does |
|---|---|---|---|---|
| **Resend** | `failed`, reason `setup` or `other`, fewer than 3 resends | Tenant `org:admin` of the row's tenant, and staff | No | The same snapshot to the fan's account email, as the next attempt |
| **Send to a different address** | `failed` or `bounced` | Staff only | Yes | The existing staff resend with a corrected address, one row ([`prize-delivery.spec.md`](prize-delivery.spec.md), "Corrected address") |
| **Resend selected** | `failed` | Staff only, cross-tenant mode | Yes | The existing bulk resend, up to 100 loaded rows |
| **Send again** | `fulfilled` | Staff only | Yes, plus typed confirmation | The same snapshot again, as a new attempt on a row already sent |

When Resend isn't offered on a failed row, the drawer says what the admin can do instead, in one line: for an address failure, "The fan's email couldn't accept it. Ask Overboard to send it to a different address." with **Tell Overboard**; after three resends, "This prize has been resent three times. Tell Overboard and we'll look into it." with **Tell Overboard** (the support report carries the `redemptionId`).

**Send again** opens a centred dialog: title "Send this prize again?", body "{fan} already has this prize. Sending it again gives them a second copy, including any code.", a required reason select ("The fan says it never arrived" · "The fan lost it" · "Something else"), a typed confirmation "Type {fan display name} to confirm", buttons "Send again" (danger) and "Cancel"; reverification runs on submit.

**Why tenants may resend, argued against prize-delivery's OBS-only rule.** `prize-delivery.spec.md` made resend OBS-only and reverified (its Rules 5–7 and the endpoint's gate) when failures were only visible on an OBS screen and the one resend path could also redirect a prize to a typed address. Its rules exist to stop three things: a double send (Rules 4–5), an unaudited change (Rule 6), and fan PII travelling (Rule 7). None of them is about who clicks. A tenant that can award a prize can re-deliver the same prize: resending a failed send gives the fan nothing they weren't already owed, and the conditional write (only a `failed` row, only at the resend count the admin saw) plus the worker's attempt claim still make a second send structurally impossible. So the tenant path keeps Rules 4, 5, 6 and 8 unchanged and never touches Rule 7: no corrected address, which stays staff-only with reverification. Reverification guards actions that can't be undone by clicking again (admin-surface); a resend of a failed row is that same action repeated, not a new one. The real risk, sender reputation, which is platform-wide (`PRIZE-06`'s rationale), is bounded three ways: address failures are excluded (resending to an inbox that refused is exactly what hurts reputation), each row gets at most three tenant resends, and duplicating a *sent* prize, the one action that gives a fan a second code, is staff-only and reverified. Game day's "no retry control" decision was made because resend didn't exist for tenants; it still holds on Game day, whose failed rows now link to this drawer.

#### Staff extras

- **Tenant mode** (a tenant selected, `/prize-deliveries`): everything above plus the recorded reason text, **Send to a different address**, **Send again**, and a header link "All workspaces" to cross-tenant mode.
- **Cross-tenant mode** (`/obs/prize-deliveries`, OBS Internal section, replacing **Delivery queue**; `/delivery-queue` redirects): eyebrow "Overboard", H1 "PRIZE DELIVERIES", lede "Every workspace's prize sends." A **Tenant** column (name, linking to `/obs/tenants/:slug`) and a **Tenant** filter (Combobox, "All workspaces"). Status defaults to Failed, because triage is why staff come here. Row checkboxes and **Resend selected** ("Selected 100 of 342" when the loaded rows are fewer than the total). A row's drawer reads with that row's tenant. Tiles show platform totals.
- **The cap goes.** The old queue stopped at 100 rows and said so; this list pages with a cursor to the end ([`admin-lists.spec.md`](admin-lists.spec.md) Rule 1), and the count is the real total.

#### Links in

Overview's failed-sends tile and needs-attention row → `/prize-deliveries?status=failed`; the contest Overview's "Failed sends" tile → `?status=failed&contest=<id>`; the ladder's per-tier counts → `?contest=<id>&tier=<tierId>`; the fan page's Prizes section → `?fan=<membershipId>`; Game day's "Couldn't be delivered" rows → `?delivery=<redemptionId>`; Operations' `failed-sends` item → `/obs/prize-deliveries?tenant=<slug>`.

### Emails (`/settings/emails`)

A Configuration page, **Emails** (hue: prizes), between Fields & Opt-ins and Brand in the sidebar. It is a page, not a card on another page, because these settings are tenant-wide: they apply to every prize email of every contest, so they don't belong inside a contest, and the Brand page is being made simpler, not busier.

**Header.** Eyebrow "Configuration", H1 "EMAILS", lede "How your prize emails introduce themselves."

**One card, "Prize email",** form on the left, preview on the right (sticky, drops below at ≤1100px):

1. **Sender name.** ≤80. Placeholder: the tenant's display name (the real default). Help: "What winners see as the sender."
2. **Reply-to.** Optional email address. Help: "Where a winner's reply goes. Shipped prizes need this." Placeholder "promotions@yourteam.com".
3. **Subject.** ≤150. Placeholder "You won: {prize}" (the default). Help: "{prize} becomes the prize name." Any other `{…}` is the field error "Only {prize} can be filled in."
4. **Sending address.** Read-only: "Sent from {address} · can't be changed". It is the platform's configured address (`PRIZE_FROM_ADDRESS`); when the server doesn't know it, the row is absent.

Footer: "Save" (primary, disabled until changed) and "Discard". Success: the inline line "Saved." Clearing every field saves the defaults. Clearing Reply-to while a shipped tier on a published contest needs it is refused (409) with the field error "Shipped prizes in {contest} use this address. Change those prizes first." (`PZ-15`).

**The live preview.** The server's real template via `POST /admin/prizes/email/preview`, bound to the unsaved settings, in the same white letter frame as the tier editor. Its sample prize is the tenant's most recently updated Complete tier; with none, a built-in sample whose name and description say they are a sample ("Sample prize", "This is where your prize's description goes."). The tenant's brand (logo, colour) comes from Brand, as in every real send. Above the frame, muted: "Subject: You won: Signed jersey" and "From: {sender name}".

**States.** Loading: form and frame skeletons. Load failed: `ReportableLoadError`. Member: the view-only presentation (values as text) and "You can view email settings. Changing them is for admins." Paused workspace: as member.

### Permissions

| Control | Tenant `org:admin` | Tenant `org:member` | OBS staff |
|---|---|---|---|
| View the ladder, the editor, deliveries, Emails | Yes | Yes (view-only) | Yes, any tenant |
| Create, edit, delete a tier | Yes | No | Yes |
| Reveal a tier's code | Yes | No | Yes |
| Resend a failed row | Yes, own tenant | No | Yes |
| Send to a different address; Resend selected | No | No | Yes, reverified |
| Send again | No | No | Yes, reverified and typed |
| See the recorded failure reason text | No | No | Yes |
| Cross-tenant Prize deliveries | No | No | Yes |
| Edit Emails settings | Yes | No | Yes |

Writes pass `refuseReadOnlyWrite` first (D-063), which also refuses a paused tenant's own admins; the client gate is `useCanWrite`. Hiding a control is UX; the server refuses the same call.

---

## Endpoints

All under `/admin`, `requireAdmin`. Tenant targeting as everywhere: a tenant caller's own organization; OBS staff name `?tenant=<slug>`. A `:contestId`, `:tierId` or `:redemptionId` that belongs to another tenant, or a tier that isn't in the named contest, answers **404**, not 403. Contracts in `obs-b2b-shared/src/api/admin/{prize-tiers,prize-deliveries,email-settings}.ts`.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/contests/:contestId/prize-tiers` | `requireAdmin` | any resolved admin scope |
| POST | `/admin/contests/:contestId/prize-tiers` | `requireAdmin` + write gate | tenant `org:admin`, staff |
| GET | `/admin/contests/:contestId/prize-tiers/:tierId` | `requireAdmin` | any resolved admin scope |
| PATCH | `/admin/contests/:contestId/prize-tiers/:tierId` | `requireAdmin` + write gate | tenant `org:admin`, staff |
| DELETE | `/admin/contests/:contestId/prize-tiers/:tierId` | write gate; reverified when the contest is published | tenant `org:admin`, staff |
| POST | `/admin/contests/:contestId/prize-tiers/:tierId/reveal-code` | write gate | tenant `org:admin`, staff |
| POST | `/admin/prize-deliveries/search` | `requireAdmin` | any resolved admin scope |
| POST | `/admin/all-prize-deliveries/search` | `requireAdmin` | staff only (403 first) |
| GET | `/admin/prize-deliveries/:redemptionId` | `requireAdmin` | any resolved admin scope |
| POST | `/admin/prize-deliveries/:redemptionId/resend` | write gate | tenant `org:admin`, staff |
| POST | `/admin/prize-deliveries/:redemptionId/send-again` | `requireAdminReverified` | staff only |
| POST | `/admin/delivery-queue/resend` | `requireAdminReverified` | staff only (unchanged) |
| GET | `/admin/settings/emails` | `requireAdmin` | any resolved admin scope |
| PUT | `/admin/settings/emails` | write gate | tenant `org:admin`, staff |
| POST | `/admin/prizes/email/preview` | `requireAdmin` | any resolved admin scope (changed) |
| GET | `/admin/prizes/handlers` | `requireAdmin` | unchanged |

**Why per-tier writes.** The console used to replace a contest's whole tier list. A page that edits one tier would have to hold its siblings to save, and a stale sibling would silently overwrite someone else's edit. Each tier now saves alone, with its own precondition; the contest is still claimed on every write for the finalized and lock checks, exactly as G2 specifies.

### `GET /admin/contests/:contestId/prize-tiers`

Returns `{ contest: { contestId, contestName, published, locked, lockedAt?, finalized, updatedAt }, tiers: TierSummary[], unawarded: [{ bingos, count }], replyToSet: boolean }`. `TierSummary`: `{ tierId, position, prizeType, prizeName, threeInARows, providedBy?: { sponsorId, name, logoUrl?, websiteUrl? }, completeness: { complete, missing }, hasCode, sends: { sent, failed, queued }, updatedAt }`, ladder order.

### `POST /admin/contests/:contestId/prize-tiers`

Body: the tier fields above except `redemptionMethod` (refused), `contestId` (from the path) and `deliverAt: "after_finalize"` (refused). Requires `prizeType`, `prizeName`, `threeInARows`. The server derives `redemptionMethod`, normalises to the type, sets `handlerId` to `standard-email` unless a resolving one is sent, sets `contestId`, and appends to `contest.prizeTiers`. Audit `prize_tier_create` (ids and field names only; never the code).

| Refusal | Status, code | Copy (field or page) |
|---|---|---|
| Fourth tier | 409 `tier_limit` | "A contest can have up to 3 prize tiers." |
| Bingos used by another tier | 409 `tier_bingos_taken` | "Tier 2 already uses 3 bingos" |
| Contest finalized | 409 `contest_finalized` | "This contest is finalized, so its prizes can't change." |
| Sponsor not in this tenant | 400 | "Choose a sponsor from this workspace." |
| Field validation | 400 with field errors | Beside each field (the editor's copy above) |

### `GET /admin/contests/:contestId/prize-tiers/:tierId`

The whole tier with `hasCode` in place of the code, plus `completeness`, `locked`, `published`, and the contest's other tiers' bingos (for the disabled segments).

### `PATCH /admin/contests/:contestId/prize-tiers/:tierId`

Body: `{ expectedUpdatedAt, ...changedFields }`. Absent = unchanged; `null` clears an optional field. Refusals in order: 404; 409 `contest_finalized`; 409 `stale_tier` ("This tier changed since you opened it."); 409 `contest_locked` with G2's `locked[]` for a changed `threeInARows` or a lowered or cleared `approximateValueCents` after the first board (the console shows "This can't change after the first fan joins." or, for value, "This can't be lowered after the first fan joins." under the field); 409 `tier_bingos_taken`; 400 `tier_would_hide` when the save would make a Complete tier on a published contest Needs details ("Fans can already see this prize, so {field} can't be left empty."); 400 field errors. Responds with the tier and a `changes` summary. Audit `prize_tier_update` with the changed field names.

### `DELETE /admin/contests/:contestId/prize-tiers/:tierId`

409 `contest_locked` after the first board ("Tiers can't be removed after the first fan joins."); 409 `contest_finalized`. Reverification (`requireReverification`) applies when the contest has been published; a draft's tier deletes without it. Detaches the tier (`contest.prizeTiers` pull) and keeps the document for history. Audit `prize_tier_delete`, written before the write.

### `POST /admin/contests/:contestId/prize-tiers/:tierId/reveal-code`

Returns `{ code }` or 404 when the tier has none. Not audited: a shared promotional code is not fan data, and the admin revealing it is the one who set it. Response carries `Cache-Control: no-store`.

### `POST /admin/prize-deliveries/search`

POST, not GET, because the search text can be an email address, and no PII travels in a URL (the Fans exception in [`admin-lists.spec.md`](admin-lists.spec.md)). Body: `{ q?, status?: "sent"|"failed"|"queued", contestId?, tierId?, membershipId?, from?, to?, cursor?, limit? }`. `q` matches display names (case-insensitive, anywhere) and fan email addresses (whole address or its start), resolved first to the matching memberships, bounded. Order: `createdAt` descending, then `_id`. Response: `{ deliveries: DeliveryRow[], page, summary? }`, with `summary: { sent30d, failed, queued }` on the first page only.

`DeliveryRow`: `{ redemptionId, wonAt, fan: { membershipId, displayName } | null, contest: { contestId, name }, tier: { tierId?, name, prizeType }, game?: { betEventId, label }, status, attempts, reasonKind?, reason?, canResend, canSendAgain }`. `reason` is set for staff only; a tenant caller gets `reason: null` and reads `reasonKind`. `canResend` and `canSendAgain` are computed by the server for this caller, so the console never re-derives eligibility.

Index: `PrizeRedemption { organizationId: 1, createdAt: -1, _id: -1 }` and `{ organizationId: 1, status: 1, createdAt: -1, _id: -1 }`, which needs the new `PrizeRedemption.organizationId` (below, "Migration").

### `POST /admin/all-prize-deliveries/search`

Staff only, no `?tenant=`, 403 "OBS staff only" before anything else (the cross-tenant read pattern of admin-obs-internal). Same body plus `tenant?: slug`; rows add `tenant: { slug, name }`; `summary` is platform totals. Index `{ status: 1, createdAt: -1, _id: -1 }`. Replaces `GET /admin/delivery-queue`.

### `GET /admin/prize-deliveries/:redemptionId`

`{ row: DeliveryRow, promised?: PromisedPrize, sentTo: maskedEmail | null, attempts: AttemptEntry[] }`. `AttemptEntry`: `{ n, requestedAt, requestedBy: "award" | "resend" | "send_again", requestedByName?, outcome: "queued" | "sent" | "failed" | "bounced", at?, reasonKind?, reason? }` (staff-only `reason`). Attempts come from the new `PrizeRedemption.attempts[]` (below); a row written before it has one entry derived from its own fields, and nothing older is invented.

### `POST /admin/prize-deliveries/:redemptionId/resend`

Body `{ expectedResendCount }`. The tenant path of [`prize-delivery.spec.md`](prize-delivery.spec.md)'s resend: one conditional write where status is `failed`, `resendCount` equals the expected value, and, for a non-staff caller, `resendCount < 3` and `reasonKind` isn't `address`; then the queue message with the same deduplication id. No `correctedEmail` (400 if sent). Refusals: "Already sent." / "Already being resent." / "This prize changed since you opened it." / "This prize has been resent three times." / "This fan's email couldn't accept it, so it can't be resent to the same address." Audit `prize_resend` first, with `organizationId` and `detail: { redemptionIds: [id], count: 1, addressCorrected: false, via: "row" }`.

### `POST /admin/prize-deliveries/:redemptionId/send-again`

`requireAdminReverified`, staff only. Body `{ expectedResendCount, confirmName, reason: "not_received" | "lost" | "other" }`. `confirmName` must equal the fan's display name (400 otherwise; a removed fan can't be sent again). One conditional write where status is `fulfilled` and the count matches: status `pending`, `resendCount + 1`, `resendRequestedAt`; then the queue message. The worker sends from the snapshot as the next attempt, like any resend. Audit `prize_send_again` (new `ADMIN_AUDIT_ACTIONS` entry) before the write, `detail: { redemptionId, reason }`.

### `GET` and `PUT /admin/settings/emails`

GET: `{ prizeEmail: { fromName?, replyTo?, subject? }, defaults: { fromName, subject }, sendingAddress?: string }`. PUT: the three fields, same limits and header-safe checks as today's `PUT /admin/prizes/email`; all empty unsets to the defaults. 409 `reply_to_in_use` when clearing Reply-to would leave a shipped tier on a published contest Needs details. Not audited (reversible configuration, like branding). `GET/PUT /admin/prizes/email` stay as aliases until the old Prizes page is removed, then go.

### Changes to existing routes

- **`POST /admin/prizes/email/preview`.** Takes `tierId?` beside `tier` and `settings`: with it, the server merges the stored code when the draft carries none. The sponsor mark comes from the draft's `providedBySponsorId` (resolved within the tenant; unknown → no mark). The `contestId` parameter and its contest-wide prize-popup lookup are retired (accepted and ignored for one release).
- **`PUT /admin/contests/:contestId/prize-tiers`** (whole list) stays for the current console until the tier editor ships, then goes. It gains the same derivation, normalisation and completeness rules so both paths store the same shape meanwhile.
- **`GET /admin/prizes`** goes with the Prizes page. Its `unawarded` moves to the ladder read.
- **`GET /admin/delivery-queue`** goes, replaced by `POST /admin/all-prize-deliveries/search`.
- **`POST /admin/delivery-queue/resend`** stays: it is the staff path (bulk, corrected address), reached from cross-tenant mode and the drawer's "Send to a different address".
- **The fan wire** (`list-contests`, `/b2b/contest/:id`) leaves out Needs-details tiers and never carries `approximateValueCents` or the code. A tier's `providedBySponsorId` travels as the id; the sponsor itself reaches the fan app through the public sponsor projection (`SP-06`), which includes every sponsor a visible tier names.

---

## Migration

`node-server/scripts/prize-tier-migration.mjs`, dry run by default, `--apply` to write, idempotent, dev-only rails like every other script. It writes a report (`prize-tier-migration-<date>.json`) listing every ambiguous row. It runs before the sponsors spec retires the `prizePopup` slot, because step 3 reads it.

1. **`contestId`.** From each contest's `prizeTiers[]`. A detached tier gets it from any `PrizeRedemption` naming it; a tier referenced by neither is left alone and listed.
2. **`prizeType`**, from what the tier stores:

   | Stored | Becomes | Listed for review when |
   |---|---|---|
   | `in_person` | `pickup` | no location (it would be Needs details) |
   | `shipped` | `shipped` | never; empty instructions are filled with the default "What happens next" text, and that is listed |
   | `online` with a code | `code` (a link, if any, becomes "Where to redeem") | never |
   | `online` with a link and no code | `link` | never |
   | `online` with neither | `link` | always (Needs details) |
   | `in_person_or_online` | `pickup` if a location exists, else `link` | always (the tenant's intent was both) |
   | no method: a code / a link / a location | `code` / `link` / `pickup`, in that order | always |
   | no method and none of those | `link` | always (Needs details) |

   `redemptionMethod` is then rewritten from the new type, and each tier is normalised to its type **only in memory for the report**: the migration clears no stored field, so nothing a tenant typed is lost before a person looks at it. The first save in the editor normalises.
3. **`providedBySponsorId`**, from the contest-wide `prizePopup` placement holder (`betEventId` absent), set on every tier of that contest. Game-level `prizePopup` placements are listed and not applied, because the credit is now per tier, not per game; a contest with only game-level holders gets no sponsor and is listed.
4. **`PrizeRedemption.organizationId`**, from each row's contest, then the two tenant indexes above. `betEventId` and `attempts[]` are written forward only.

**The migration never makes a live tier stop awarding** (`PZ-17`). A tier on a contest that is visible or has boards, and not finalized, that would come out Needs details is reported, and `--apply` refuses to run while any exist unless `--accept-needs-details` is passed after a person has read the list. The fix is a few minutes in the editor for each listed tier, before apply.

---

## PRD requirements

**Honoured.**

- **`GAME-02`** (as revised): display name (Name), description, approximate value (Advanced), redemption window (Expires), difficulty target (Bingos to win, as the build has always expressed it; the "X% of boards reached N bingos" read-out stays the recorded next step in [`admin-contests.spec.md`](admin-contests.spec.md)), redemption method (the prize type) and location (Where to pick it up). 1–3 tiers with distinct targets (`PZ-09`).
- **`PRIZE-01`**: real-time delivery on the win is unchanged; the snapshot makes it deliver exactly what the fan was shown.
- **`PRIZE-03`**: finalization stays staff-only, and a finalized contest's tiers refuse every write.
- **`PRIZE-07`**: failed sends are reviewable by the team whose fans they are, and by OBS across every tenant, with no cap, and resendable (tenant: failed rows; staff: any). The "hard bounce" half arrives with the Bounced slice.
- **`ADM-03`**: a tenant `org:admin` writes its own tiers and email settings; `org:member` views.
- **`ADM-04`**: the delivery method stays selectable on the admin surface (Advanced → Delivery) whenever there is a choice to make.

**Deviations, argued.**

- **Tiers are per contest, not per game.** `GAME-02` says "Each game supports 1–3 prize tiers" and the acceptance line says "Prize tiers can differ between two games for the same tenant". The ruling puts prizes inside the contest, which is where the model has always kept them, and a fan's board, lock and snapshot are per contest. The acceptance line is met by two contests, one per activation, which is how a tenant running two different promotions is already modelled, and the builder makes a second contest cheap. Per-game tiers inside one contest would give one board two prize ladders and make "what did I win" depend on which game's prop completed the line. The PRD needs a revision note on `GAME-02`; this spec doesn't edit the PRD.
- **`PRIZE-02` is reserved, not built.** The model carries `deliverAt` (the acceptance criterion "a prize tier record can carry a delivery-timing setting"); the write refuses `after_finalize` so no tier stores a promise the worker can't keep. The day `PRIZE-02` is built, the editor gains a "When winners get it" control and finalization dispatches.
- **`PRIZE-05` and `PRIZE-06` stay deferred.** The Code type is one shared code per tier. Sponsor batches of unique codes arrive, when the first sponsor's shape is known, as a second Code option ("One code per winner, from a list you upload") backed by the batch method seam in [`prize-delivery.spec.md`](prize-delivery.spec.md), "Codes". Nothing on screen mentions it until then.
- **"Sent" is not "delivered".** `PRIZE-07` speaks of hard bounces; until our mail provider's bounce notifications are wired, the console defines "Sent" as what it is and never shows a status it can't know.

---

## Build slice: Bounced (later)

Settles contradiction 5 (a bounced send reads as sent). Needs the sending domain authenticated first ([`prize-delivery.spec.md`](prize-delivery.spec.md), "Deploy dependency").

1. The worker stores our mail provider's message id on each attempt (`attempts[].providerMessageId`) and on the row (`providerMessageId`, the latest).
2. The provider's configuration set publishes bounce and complaint notifications to a topic; a small handler (verified signature, idempotent on the notification id) matches the message id.
3. A **permanent** bounce moves a `fulfilled` row to `bounced` with `bouncedAt` and a plain reason; the attempt's outcome becomes `bounced`. Transient bounces change nothing (the provider retries). Complaints are recorded on the row (`complainedAt`) and shown to staff only.
4. The console adds "Bounced" to the Status filter, the column and the tiles' Failed count, with the definition above. Tenant Resend is not offered on a bounced row (same address); staff can send to a different address.

Until this ships the word "Bounced" appears nowhere on screen.

---

## Rules

1. **`PZ-01` — Prize type first.** A tier has exactly one `prizeType`; the editor renders nothing else until one is chosen, and every create requires it.
2. **`PZ-02` — `redemptionMethod` is derived.** The server sets it from the type on every write; no client sends it, and nothing new reads it.
3. **`PZ-03` — Completeness is one shared function, and incomplete never awards.** A Needs-details tier is skipped by the worker, left off the fan wire, and blocks Publish.
4. **`PZ-04` — A tier fans can see never goes back to Needs details.** On a published contest, a save that would empty a Complete tier's required field is refused.
5. **`PZ-05` — The code never leaves the server except through Reveal.** Not on the tier read, the fan wire, the preview frame, an audit row or a log.
6. **`PZ-06` — The lock is G2's, shown in place.** After the first board: bingos to win, removal, and lowering the value refuse with 409 `contest_locked`; the console shows the lock glyph and "This can't change after the first fan joins." under the field.
7. **`PZ-07` — The console shows "as promised" only from the snapshot.** A row with no snapshot shows no promise, never the current tier in its place.
8. **`PZ-08` — Credit comes from the tier.** `providedBySponsorId` is the only source of the "Provided by" credit in the popup, the email and their previews; one sponsor per tier, the same at every game.
9. **`PZ-09` — One to three tiers per contest, distinct bingos 1–8.**
10. **`PZ-10` — Tenant Resend re-sends, it never re-awards.** Failed rows of the caller's own tenant only, not address failures, at most three per row, conditional on the resend count, audited first, same snapshot, no corrected address.
11. **`PZ-11` — Duplicating a sent prize is staff-only.** Send again is reverified, name-confirmed, reasoned and audited before the write.
12. **`PZ-12` — Status words mean what they say.** "Sent" is "accepted by our mail provider"; "Bounced" exists only once bounce capture does.
13. **`PZ-13` — Deliveries page on the server.** Cursor paging, server-side search and filters, a real total, no cap, in both modes.
14. **`PZ-14` — Email identity is tenant configuration; the sending address is not.** Sender name, reply-to and subject (with `{prize}` as the only token) are the tenant's; the address is the platform's and read-only.
15. **`PZ-15` — Shipped prizes need the reply-to.** A shipped tier is Needs details without it, and a published contest's shipped tier blocks clearing it.
16. **`PZ-16` — Delivery timing is reserved.** `deliverAt` is stored; only `immediately` is accepted until `PRIZE-02` is built.
17. **`PZ-17` — The migration never makes a live tier stop awarding.** Rows that would are listed, and apply refuses until a person has seen them.

## Known gaps (recorded, not blocking)

- **The shared additions are not requested yet.** `prizeType`, `providedBySponsorId`, `contestId`, `shipsWithinDays`, `deliverAt` on the tier; `prizeType`, `shipsWithinDays`, `providedBy` on G2's `tierSnapshot`; `organizationId`, `betEventId`, `attempts[]` on `PrizeRedemption`; `tierCompleteness`; the three contracts; two audit actions. All additive; they go through the shared queue in the build wave.
- **The game a prize was won at** needs the board evaluator to put the completing prop's `betEventId` on the fulfillment message. Rows before that show an empty Game cell.
- **Complaints** are recorded but have no tenant surface. Whether a tenant should see "marked as spam" is a product question for after the Bounced slice.
- **The approximate value has no reader yet.** The sponsor recap and the usage export are where it belongs ("value provided"); their specs add it.
- **Image upload** — pasted URLs only, as across the console.
- **The PRD's `GAME-02`, `PRIZE-02`, `PRIZE-05`/`PRIZE-06` revision notes** are owed to the PRD and not made here.
- **The fan app reads `redemptionMethod` and the old credit.** S2 moves the popup to `prizeType` and `providedBy`; until then the derived method keeps it working, and the popup's credit follows the fan wire's sponsor resolution.

## References

- PRD: [`GAME-02`, `GAME-03`, `PRIZE-01`–`PRIZE-07`, `ADM-03`, `ADM-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`prize-delivery.spec.md`](prize-delivery.spec.md) — the engine, the registry, the template, the staff resend; its Prizes-screen sections are superseded here
- [`contest-safety.spec.md`](contest-safety.spec.md) — the lock and the snapshot this spec reads
- [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the tier half is superseded here; Rule 6 (history outlives a tier) still holds
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the Delivery queue, now cross-tenant Prize deliveries
- [`admin-lists.spec.md`](admin-lists.spec.md) — the paging convention and list kit
- [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — sponsors and their prize-popup logo
- [`admin-game-day.spec.md`](admin-game-day.spec.md) — the failure categories
- `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` (workspace) — the preview contract the popup preview uses
- Decisions: D-059 (view-only presentation), D-063 (write gate), D-066 (OBS notifies, sponsors own the value), D-068 (honesty by omission)
- Mock: `mocks/admin-console/Prizes.png` (workspace) — superseded as a layout source by this spec's pages
