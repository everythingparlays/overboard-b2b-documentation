# Core Module Spec: Admin — Prizes (library, prize page, contest tiers, deliveries, email settings)

**Implements:** PRD `GAME-02` (tiers belong to a contest; see "PRD requirements"), `PRIZE-01`, `PRIZE-03`, `PRIZE-07`, `ADM-03`, `ADM-04` (the delivery-method half, carried from [`prize-delivery.spec.md`](prize-delivery.spec.md)), and trivia's `TRV-49` / `TRV-50` on the prize side ([`../../features/1-draft/trivia-game-type.spec.md`](../../features/1-draft/trivia-game-type.spec.md)).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, the write grant, "No re-authentication", the view-only presentation (D-059), Honesty by omission (Rule 13). [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page, its tabs, the builder, Publish. [`contest-safety.spec.md`](contest-safety.spec.md) — the lock, `tierSnapshot` and `contest_locked` (the prize-library revision's `prize_value_locked` is retired, 2026-09-28). [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) — contest states (§3.1), contest deletion (§3.2), the fan app showing only recorded awards (§1.5), and the four prize-library fixes (§8), all referenced here and not redefined. [`prize-delivery.spec.md`](prize-delivery.spec.md) — the delivery engine, method registry, email template, attempt claim and staff resend. [`admin-lists.spec.md`](admin-lists.spec.md) — cursor paging and the list kit. [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — sponsor records, their prize-popup logo, and sponsor deletion's cascade. [`admin-uploads.spec.md`](admin-uploads.spec.md) — the upload field and its route. [`admin-preview.spec.md`](admin-preview.spec.md) — the `FanAppPreview` host. [`admin-game-day.spec.md`](admin-game-day.spec.md) — the `reasonKind` failure categories.

**Supersedes:** the prize halves of [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) (including its 2026-09-27 library revision's drawer and contest-drawer tier editing) and of [`prize-delivery.spec.md`](prize-delivery.spec.md) (the Prizes screen, the Prize email card, the Delivery card); the Delivery queue screen of [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md); the prize email's "Presented by" credit source (the `prizePopup` placement holder); and Game day's "no retry control for tenants" ([`admin-game-day.spec.md`](admin-game-day.spec.md)), for the Deliveries tab only.

**Status:** Draft. Written 2026-09-24 for the console redesign.
Revised 2026-09-28 (Wave 4b, Arthur's walkthrough rulings and his answers of 2026-09-28): **no prize type**. A prize is one flat form of what the prize popup and the prize email use (name, description, image, claim instructions, an optional button, an optional code, Provided by); the stated value, the redemption method, place and window, the shipping time, normalisation on save, the value lock and `reply_to_in_use` are gone; completeness is a description and a delivery method; the email renders by presence; the prize page's sections fold, its preview is the fan app's phone at 1:1, and nothing is autosaved; the email settings move to their own **Email** tab. Where this revision and older text below disagree, this revision wins; the sections below are rewritten to it.
Revised 2026-09-27 (Wave 4, Arthur's rulings of that day): rebuilt on the prize library. A prize is authored once per tenant and a contest's tiers point at it; the prize type and "Provided by" move onto the library prize; each prize opens as its own page; Prizes has two tabs, Library and Deliveries, and the email settings live on Deliveries (there is no Emails page); the contest Prizes tab is a numbered ladder of bingo count plus library prize, capped at three.

## Overview

A prize is something a team sets up once and gives away many times: the same $25 gift code is the 3-bingo prize at the Denver weekend and the 2-bingo prize at Rivalry Week. The prize library (2026-09-27) made that the data model: `B2BPrize` holds what the fan wins, and a contest's tier holds only *when* it is won (a bingo count) and *which* prize (`prizeId`), plus a server-written copy of the prize's content that every reader already understands.

This spec builds the console on that model. The Prizes page is the library: every prize, where each is awarded from, and **New prize**. Each prize opens as a full page: one form of what the fan's prize popup and the winner's email show, previewed live beside it on the fan app's own phone. The contest's Prizes tab becomes a short numbered ladder: for each tier, how many bingos, and which prize. Deliveries, the record of every prize sent, is the page's second tab, and the prize email's identity (sender name, reply-to, subject) is its third, **Email**.

**The whole change, in one line:** a prize is a sponsor-credited library record of exactly what the popup and the email show, edited on its own page; a contest's tiers pick from the library; every send is visible and resendable by the team that awarded it; and the email identity is a setting of its own.

**No prize type (Arthur, 2026-09-28).** Wave 4 added a type (pick up, code, link, shipped) that decided the fields, completeness, the email's blocks and delivery. Arthur ruled it out: a prize has no type, and anything the popup or the email doesn't use is not offered as if it did. Stored `prizeType`, `shipsWithinDays`, `approximateValueCents`, `redemptionMethod`, `redemptionLocation` and `redemptionWindow` stay in the model, **dormant**: no write sets them, no read returns them, nothing renders them.

**In scope:**

- Additions to the library prize: `providedBySponsorId`; the optional claim button and code on every prize; completeness as one shared function; the code kept secret on reads.
- The award snapshot's additions (`prizeId`, `providedBy`) and the console's "as promised" projection.
- The Prizes page: **Library**, **Deliveries** and **Email** tabs, and the staff cross-tenant view.
- The prize page (`/prizes/new`, `/prizes/:prizeId`) with its live previews.
- The contest Prizes tab ladder, which the builder's Prizes step reuses.
- Endpoints: the library's extensions, a prize read, code reveal, the ladder read, the deliveries endpoints, and changes to existing routes.
- How trivia bands will reuse the picker, without building trivia.
- A later slice: **Bounced**.

**Not in scope:**

- **The delivery engine** (worker, attempt claim, method registry, template construction, local loop): [`prize-delivery.spec.md`](prize-delivery.spec.md). This spec changes what the template merges and nothing about how it sends.
- **Taking the snapshot**: [`contest-safety.spec.md`](contest-safety.spec.md). This spec adds four fields to it.
- **The fan prize popup's design.** The popup stays the current fan app's `PrizeModal`, fed by the award the server recorded ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §1.5). Two small changes only, below ("What the winner sees").
- **The upload route and storage**: [`admin-uploads.spec.md`](admin-uploads.spec.md). This spec uses its field.
- **Coupon-code batches** (`PRIZE-05`/`PRIZE-06`'s batch half) and **deferred delivery** (`PRIZE-02`). See "PRD requirements".
- **Other channels.** Email is the only channel (Arthur, 2026-09-28). No shipping, pick-up or in-person flow.
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

| Field | Type | Console control | Fan popup / email | Notes |
|---|---|---|---|---|
| `organizationId` | ObjectId | none | — | Required, indexed. Every read and write is scoped by it. |
| `prizeName` | string, model ≤200 | **Name**, ≤60 | Popup headline; email headline and `{prize}` in the subject | Required. The fan-facing title (Arthur, 2026-09-28). |
| `prizeDescription` | string | **Description**, ≤300 | The detail under the name, in the popup and the email | Required for Complete. |
| `prizeImageUrl` | https URL ≤2000 | **Image**: the upload field | Popup image (128px square); email image | Written by the upload route ([`admin-uploads.spec.md`](admin-uploads.spec.md)); never typed. |
| `prizeClaimInstructions` | string, model ≤5000 | **Claim instructions**, ≤500 | Popup: under the description, for a winner; email: "How to claim" | Optional. |
| `staticRedemptionCode` | string ≤64, no spaces, `select: false` | **Code** | Email only ("Your code"); never the popup | Optional. Masked after save, with Reveal, Replace and Remove. |
| `prizeClaimButtonLinkUrl` | https URL ≤2000 | **Button** → **Button link** | The popup's button opens it; the email's button | Optional on every prize. |
| `prizeClaimButtonText` | string ≤200, console ≤40 | **Button** → **Button text** | The button's label, popup and email | Optional; with a link and no text both read "Claim your prize". Stored only with a link. |
| `providedBySponsorId` | ObjectId → `B2BSponsor` | **Provided by** | The credit in the popup and the email | Same tenant only. One prize, one credit, everywhere it is awarded. |
| `handlerId` | string ≤100 | **Delivery**, only when there is a choice (below) | Which method sends | `standard-email` for every new prize. |
| `createdAt` / `updatedAt` | Date | none | — | `updatedAt` is the precondition token (`expectedUpdatedAt`, refused as `stale_prize`). |

**Dormant fields.** `prizeType`, `shipsWithinDays`, `approximateValueCents`, `redemptionMethod`, `redemptionLocation` and `redemptionWindow` stay on the model so stored values still validate. The write contracts don't carry them (a client that still sends one has it dropped, not refused), the reads don't return them, the popup and the email don't show them, and completeness doesn't read them. Whether a prize should ever have a type, a value or redemption terms again is the prize model owner's call (see "Questions for the prize model owner").

**What the prize never carries: a bingo count.** When a prize is won is a property of the tier (bingo) or, later, of a band (trivia). No field, label, help line or preview control on the prize side mentions bingos (`TRV-50`).

**`PRIZE_CONTENT_FIELDS`** carries `providedBySponsorId` to every tier copy, and from the copy into the award snapshot, without a second mechanism.

**Nothing is normalised on save.** A write stores what it sends, and a PATCH changes only the fields it names; no field is cleared or defaulted on the admin's behalf.
### The code stays secret

`staticRedemptionCode` keeps `select: false`, and the console reads stop returning it: the library and prize reads carry `hasCode: boolean`, and only `POST /admin/prize-library/:prizeId/reveal-code` returns the code. It never reaches the fan wire, the preview frame, an audit row or a log. A PATCH that omits it leaves it unchanged; `null` clears it. `PRIZE-06`'s no-duplicates rule does not apply to a code shared by design; the page says it is shared ("Every winner of this prize gets the same code.").

### Complete / Needs details

Completeness is **derived, never stored**, by one pure function in `obs-b2b-shared` (`interfaces/b2b/PrizeCompleteness.ts`: `prizeCompleteness(content, { methodResolves })` → `{ complete, missing: PrizeField[] }`). It asks only what delivery truly needs: **a description** and **a delivery method that resolves** in the tenant's catalog. Everything else is optional, and the popup and the email leave out what isn't set. The server, the worker and the console all call it, so a prize the console calls Complete is never skipped by the worker.

Name is required to save at all. A switched-on optional part with nothing in it ("Add a button" with no link, "A sponsor provides this prize" with no sponsor) is a field error on save, not a completeness state: switched off is how a tenant says "none".

- **A Needs-details prize can be saved and picked into a draft contest**, and Publish refuses while any tier names one ([`admin-contests.spec.md`](admin-contests.spec.md), publish checks).
- **A contest fans can see never gets a tier that can't be delivered.** On a contest in state `open` or `closed` ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §3.1), the tiers PUT refuses a tier naming a Needs-details prize (400 `prize_needs_details`).
- **A prize fans can win never goes back to Needs details** (`PZ-04`). A description can be replaced but never emptied through the PATCH, and a PATCH that would still make a Complete prize Needs details is refused (409 `prize_would_hide`) while any non-finalized `open` or `closed` contest awards it.
- The worker treats a tier copy with no description as no tier at that count (the win is `skipped`), and the fan wire leaves it out: defence in depth for tiers stored before these rules. A delivery method that doesn't resolve is a recorded failure an operator can fix, never a skip.

### `B2BPrizeTier` (unchanged in shape)

`{ prizeTierId, threeInARows, prizeId, …the server-written copy of PRIZE_CONTENT_FIELDS }`, exactly as the library defined it. The copy includes `providedBySponsorId` because `PRIZE_CONTENT_FIELDS` does. No `contestId` is added: a tier's tenant and contest are resolved through the contest that holds it ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8), and the one place that needed a back-reference (the library migration) is fixed that way. A tier stored before the library, with no `prizeId`, keeps working from its own copy until someone picks a prize for it.

### The award snapshot

`PrizeRedemption.tierSnapshot` ([`contest-safety.spec.md`](contest-safety.spec.md)) keeps what the email renders, and gains `prizeId` and `providedBy`. The worker writes them at award time with the rest of the snapshot, and no longer copies dormant fields (a type, a value, redemption terms, a shipping time) into it:

```ts
tierSnapshot?: {
  // prizeTierId, threeInARows, handlerId, prizeName, prizeDescription, prizeImageUrl,
  // prizeClaimInstructions, prizeClaimButtonLinkUrl, prizeClaimButtonText,
  // staticRedemptionCode (select:false), snapshotAt
  prizeId?: ObjectId;          // which library prize was paid
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
  details: {
    instructions?: string;      // "How to claim"
    button?: { text: string; link: string };
    hasCode: boolean;           // the code itself is never projected
  };
  providedBy?: { sponsorId: string; name: string; logoUrl?: string; websiteUrl?: string };
  bingosToWin: number;
  snapshotAt: string;
}
```

A row awarded before snapshots existed has no `PromisedPrize`, and the drawer omits the block: what those fans were promised isn't recoverable, and showing today's prize under "As promised" would be fabrication. A snapshot taken before `providedBy` existed shows no credit.

### What happens when other things are deleted

- **A prize** ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.2): refused with `prize_in_use` while a tier that a contest holds names it, finalized contests included, since their tiers are final. Deleting clears `prizeId` from detached tiers that still name it; their content copies and every snapshot stay.
- **A contest** (§3.2): its tiers go; its library prizes stay; terminal awards stay with `contestName` stamped, so Deliveries still names where they were won.
- **A sponsor** ([`admin-sponsors.spec.md`](admin-sponsors.spec.md) owns the cascade): deleting a sponsor clears `providedBySponsorId` on every library prize naming it and on every tier copy naming it, finalized contests' tiers included (a reference to a sponsor that no longer exists resolves to nothing either way). **Snapshots are never touched**: awards already made keep the credit they were given. No "remove it from prizes first" step exists; the sponsor page's delete dialog states the count, "It's credited on 2 prizes. They'll show no sponsor."
- **A tenant** (§8.3): its library goes with it, codes included.

### Edits, the lock and finalized contests

- **A prize edit reaches every contest that awards it, except finalized ones.** The PATCH refreshes the copy on tiers held by non-finalized contests only ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.4). A finalized contest's tiers keep the content they were finalized with; detached tiers are left alone.
- **Winners keep what they were promised.** The snapshot is taken at award time, so no edit, anywhere, changes an award already made.
- **There is no value rule.** A prize has no stated value (Arthur, 2026-09-28), so `prize_value_locked` and the lock's `tierValue` kind are gone; a locked tier may be pointed at any prize.
- **Everything about a prize stays editable after the lock.** What a prize is (its wording, image, steps, button, code, credit) is the operator's to correct; the snapshot keeps every winner's promise.

---

## What the winner sees

### The prize popup (the current fan app)

The popup is the fan app's `PrizeModal`, opened only for an award the server recorded ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §1.5). From the award's `prize` it draws, top to bottom: a pill badge in the tenant's primary colour ("You won" for a win; the tier's bingo count when a fan previews a tier from the contest list); the image (128px, rounded); **the name as the headline** (Arthur, 2026-09-28: the name is the fan-facing title); the description under it; for a winner, the claim instructions; the sponsor credit; the button (the button text; "Claim your prize" when the prize links somewhere but names no label, as in the email; "Awesome!" when it has neither) and, when the prize has a link, a second "Close" button. Both buttons show a press state. The code is never in the popup ("Your code is in the email" is the tenant's to write in the instructions).

The credit comes from the award's `providedBy` (the snapshot's, or for an award not yet snapshotted, the live tier's `providedBySponsorId` resolved), rendered by the `PrizeSponsor` block under the eyebrow "Provided by": the logo 48px tall and up to 176px wide, "Visit {name}" when the sponsor has a website, and no block at all when the sponsor has no prize-popup logo (today's rule).

### The prize email

One generic template driven by the prize's data (Arthur, 2026-09-28: never per sponsor, never one template per prize); [`prize-delivery.spec.md`](prize-delivery.spec.md) owns it. It **renders by presence**, never by a kind of prize: every block follows the omission rule, and appears only when its field is set, always in this order:

1. "You won", **the name** as the headline, and "You hit N bingos." (the qualifying line belongs to the tier, never the prize);
2. the image; the description;
3. **"Your code"**, when a code is set;
4. **"How to claim"**, from the claim instructions;
5. **the button**, when a link is set ("Claim your prize" when it has no label);
6. the **"Provided by"** credit from the snapshot's `providedBy` (the prize-popup logo 32px tall, up to 160px wide, linked to the website when set; the name as text when there is no logo).

No type ordering, no pick-up lead line, no "Ships within" line, no expiry line, and **no value**. The worker never reads the board's game to find a sponsor.

## The screens

### Navigation

Workspace sidebar: one item, **Prizes** (`/prizes`, hue: prizes). There is no Emails item and no separate deliveries item: Deliveries and Email are tabs of Prizes. OBS Internal: **Prize deliveries** (`/obs/prize-deliveries`) replaces Delivery queue. Redirects: `/delivery-queue` → `/obs/prize-deliveries`; `/prizes?contest=<id>` → `/contests/<id>/prizes`.

### The Prizes page

**Header.** Eyebrow "Workspace", H1 "PRIZES", lede "Everything your fans can win, and every prize you've sent." Right: **New prize** (primary; admins and staff; Library tab only).

**Tabs** (the kit's tab nav, in the URL): **Library** (`/prizes`), **Deliveries** (`/prizes/deliveries`, with a count badge of failed deliveries when above zero) and **Email** (`/prizes/email`).

### Library tab

**Toolbar:** search "Search prizes" (name and description); the count, "9 prizes". The library is capped at `PRIZE_LIBRARY_MAX` (200), so it is one read and the search runs in the browser; no paging. There is no Type filter.

**Table**, most recently updated first; a row opens the prize page:

| Column | Content |
|---|---|
| Prize | 40px image (the prize mark on a tinted square when there is no image), the name, and the description on one muted line, truncated |
| Provided by | The sponsor's logo at 20px and name; empty when none |
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

**Layout.** The form column and a sticky **460px** preview rail side by side at ≥1360px, where both fit; below that the preview follows the form, full width. The rail is wide enough for the fan app's phone at 1:1 (a 390px screen in its bezel, inside the preview's own padding: 454px), so the popup is never scaled and never clipped. A sticky footer bar: "Cancel" and the primary "Save prize" ("Create prize" for a new one), disabled until the draft differs from the saved prize.

**Sections.** Every section is a card whose header is a toggle, with a chevron at its top right: the whole header folds the section, and a folded section shows a one-line summary beside its title ("Instructions · A code", "Shop now → https://…", "No sponsor"). A folded section's fields stay mounted, so nothing typed is lost; a save that refuses a field in a folded section opens it. Every section starts open. **Delete** doesn't fold.

#### 1. The prize

1. **Name.** Required, ≤60, counter at 48. Placeholder "Signed jersey". Help: "The prize's title: the headline of the prize popup and the email, and the email's subject."
2. **Description.** Required for Complete, ≤300, counter at 250. Help: "A line or two under the name, in the prize popup and the email."
3. **Image.** Optional. The upload field (`.cx-upload`, drag-and-drop plus browse; [`admin-uploads.spec.md`](admin-uploads.spec.md)). Help: "Shown in the prize popup and the email."

#### 2. Claim

1. **Claim instructions.** Optional, ≤500. Help: "How a winner claims it. Shown in the prize popup and as How to claim in the email."
2. **Code.** Optional, ≤64, no spaces ("Codes can't contain spaces."). Help: "Every winner of this prize gets the same code. It appears in the email as Your code, never in the popup." After save it shows masked with **Reveal** (admins and staff; members see "A code is set") and **Remove**; revealed, it shows in monospace with **Copy** and **Hide**; typing replaces it; Remove reads "The code will be removed when you save." with **Keep it**.

#### 3. Button

**Add a button** (Off/On). Reveals **Button link** (https; help "Fans tap it in the prize popup and the email.") and **Button text** (optional, ≤40, placeholder "Claim your prize"). Optional on every prize.

#### 4. Provided by

**A sponsor provides this prize** (Off/On). Reveals **Sponsor**: a Combobox of the tenant's sponsors (search, endless scroll, each with its prize-popup logo at 20px and name). Help: "Shown as Provided by in the prize popup and the email." A sponsor with no prize-popup logo is still choosable; the help then reads "The email shows the name. Add a prize popup logo to show it in the popup too." with "Add one" linking to `/sponsors/:id`. No sponsors in the tenant: "No sponsors yet. Add one on the Sponsors page."

#### 5. Delivery (only when there is a choice)

Hidden while the tenant's catalog offers one method and the stored one resolves. Otherwise a section with **Delivery**: the tenant's methods by label and one-line description, from `GET /admin/prizes/handlers` ("Choose how this prize is delivered." when the stored one doesn't resolve).

#### 6. Awarded from (a saved prize)

A list of the tiers that award it, one row each: the contest's name (linking to `/contests/:id/prizes`), "at 3 bingos" (the usage's `at` text), the contest's state chip (Draft, Open, Closed, Finalized) and the lock glyph when locked. Under the list, when the prize has deliveries: "124 sent · 2 failed", each linking to Deliveries filtered to this prize (`?prize=<prizeId>`). None: "Not awarded from any contest yet." (a real state, not a gap).

#### 7. Delete

A "Delete prize" section at the bottom, for admins and staff, never folded. When nothing awards the prize: **Delete prize** opens a centred dialog, "Delete this prize?", body "No contest awards it. Prizes fans already won aren't affected.", buttons "Delete prize" (danger) and "Cancel". An unused library record reaches no fan. When a contest awards it, the section reads "Contests award this prize, so it can't be deleted." (the list above says which). Deleting returns to the Library tab.

#### 8. The preview rail

A segmented **"Prize popup | Email"** over the preview; both are bound to the unsaved draft and refresh on a ~300ms trailing debounce.

- **Prize popup.** The console's one fan app preview, `FanAppPreview` ([`admin-preview.spec.md`](admin-preview.spec.md)), the same phone preview used everywhere: phone only, 390px at 1:1, never scaled, on screen `prize` with the tenant's brand. The render document's `prize` is the draft prize (never the code; the resolved `providedBy` beside the id), with no contest, since a library prize belongs to none. Its buttons work as a winner's do: each shows a press state; **Close** (or the claim button, or a tap outside) dismisses the popup, and it comes back a moment later, as the next win would ([`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md), "Without a contest"). Links out of the frame stay inert.
- **Email.** The server's real template from `POST /admin/prizes/email/preview` with the draft, the tenant's saved email settings, and a bingo count: the lowest count among the tiers that award the prize, or 1. Shown in a white letter frame, with "Subject: …" and "From: …" above it and **Open full width** (a centred 600px dialog). For a saved prize the request names `prizeId`, and the server merges the stored code when the draft carries none (unless the code is being removed), so the preview shows what a winner gets. A failed preview keeps the last render with "Couldn't update the preview." and **Try again**.

#### 9. Saving, leaving, returning

- **Nothing is autosaved** (Arthur, 2026-09-27). "Save prize" sends a PATCH with `expectedUpdatedAt`; "Create prize" a POST. Success: "Saved." beside the button, the pill updates, and a new prize's URL becomes `/prizes/:prizeId` (replace, not push).
- **The page always opens from the server.** No draft is kept in the browser, so a prize can never open as anything but what is saved.
- **Leaving.** "Leave without saving?" (Leave / Keep editing), the console's shared prompt (`lib/useLeaveGuard`), appears only when there are unsaved changes ("Your changes to this prize will be lost."), and always on `/prizes/new` until the prize is created ("This prize hasn't been created yet."). It covers links, the sidebar, Back and Forward, Cancel, and closing the tab.
- **Returning to a contest.** With `returnTo`, a successful create or save navigates to `returnTo` with `picked=<prizeId>&slot=<slot>` (and `bingos=<n>` when the ladder sent one); the ladder puts the prize in that row ("Contest Prizes tab", below). **Cancel** returns without `picked`.
- **Refusals.** `stale_prize`: "This prize changed since you opened it." with **Reload**. `prize_would_hide`: under the field, "Fans can already win this prize in {contest}, so {field} can't be left empty." Field errors land beside their fields, and open a folded section.

#### 10. Page states

| State | What renders |
|---|---|
| Loading | Form and rail skeletons |
| New | The empty form, focus on Name; the preview shows "Your prize" until it has a name |
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
3. **Prize**, a picker (Combobox): the selected prize's 32px image, name and description; opening it lists the library (search, each row with image, name, description and "Provided by"), with **New prize** pinned at the bottom. On a contest fans can see, a Needs-details prize is listed disabled with "Needs details". **New prize** opens `/prizes/new?returnTo=<this route>&slot=<row>` (plus `&bingos=<n>` for a row not yet saved); the created prize comes back selected in that row.
4. **The prize's summary**, under the picker: "Provided by" with the logo and name (absent when none), the status pill when it needs details, and the prize's name as a link, **Open prize**, to its page (with `returnTo`).
5. **Sends** for this tier, when it has any: "35 sent" and, when above zero, "2 failed" in the status red, each linking to Deliveries filtered to this contest and tier.
6. **Remove** (an icon button), unlocked contests only.

**Add tier** (a secondary button with a plus) under the last row, with the hint "A contest can have up to 3 tiers." It disappears at three (`PZ-09`, PRD `GAME-02`).

**Saving.** The ladder is one draft, saved with the whole-list `PUT /admin/contests/:contestId/prize-tiers` and its `expectedUpdatedAt`, only when the admin presses **Save prizes** (a sticky bar with "Save prizes" and "Cancel" appears when the draft differs). Nothing is kept in the browser: the ladder always opens from the server. It reports its unsaved edits to the contest screen (`useUnsavedChanges("prizes", …)`), whose "Leave without saving?" prompt covers them. **New prize** from a row not yet saved carries that row in the address (`slot`, `bingos`) and it comes back as a new row holding the prize, so that trip alone never asks; any other unsaved edit does. Rows are re-sorted by bingos on save, and the numbers follow.

**States.**

| State | What renders |
|---|---|
| Loading | Row skeletons in the ladder's shape |
| Empty | "No prize tiers yet." and a primary **Add tier**. In the builder, under it: "Fans can't win anything until a tier has a prize." |
| Locked | Stored rows' bingos read-only with the lock glyph; Remove gone; the line "Fans have joined, so bingos to win can't change and tiers can't be removed. You can add a tier or change a tier's prize." |
| Finalized | Rows read-only (prize names still open the prize page); no Add tier; "This contest is finalized, so its prizes can't change." |
| Trivia draft | The contest spec's placeholder card |
| Load failed | `ReportableLoadError` |
| Member (read-only) | Same rows as text; no Add tier; "You can view prizes. Changing them is for admins." |

**Refusals on save**, shown on the row they concern: `prize_needs_details`, "Finish {prize} before fans can win it." with **Open prize**; `tier_bingos_taken`; `stale_contest`, "This contest changed since you opened it." with **Reload**; `contest_finalized`, the page turns read-only.

What the tab no longer shows: the line counting how often fans reached a bingo count no tier pays. It is gone, with its data (`unawarded`).

### Deliveries tab

Route `/prizes/deliveries`. Tenant mode for tenants, and for staff with a tenant selected.

**Layout.** One column: tiles, toolbar, table. Every row is one the server recorded; the list never synthesises a row. The email settings are on the **Email** tab. Staff with a tenant selected see this tab exactly as the tenant's own admins do (Arthur's ruling: staff see tenant screens as the tenant does); their own tools are on `/obs/prize-deliveries`.

**Tiles** (KpiTile): "Sent" (`fulfilled` rows sent in the last 30 days, caption "Last 30 days"), "Failed" (all `failed` rows, and `bounced` once it exists; caption "Needs attention" above zero, else "Nothing to fix"; the number in the status red only above zero), "Queued" (`pending` rows, "Sending now"). Each filters the list on click. Tiles show the tenant's totals and ignore the search and filters.

**Toolbar** (sticky, the list kit's `InfiniteTable`): search "Search by display name or email" (it matches the display name the fan chose, never a real name — 2026-09-29); **Status** segmented "All · Sent · Failed · Queued"; **Contest** Combobox ("All contests", endless scroll); **Date** "Any time · Today · Last 7 days · Last 30 days · Custom…"; the count, "412 deliveries". Filters reached by link show as removable chips: "Prize: $25 gift code", "Tier 2 · Denver Weekend", "Fan: J. Smith". Every filter lives in the URL (`?status=&contest=&tier=&prize=&fan=<membershipId>&from=&to=`); the search text does not, because it can be an email address.

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

### Email tab

Route `/prizes/email`. The tenant's prize email identity, on its own tab (Arthur, 2026-09-27: not inside Deliveries). These settings are real and used end to end by the worker; they are not expanded further until the prize model owner confirms how prizes are delivered.

**Layout.** The settings card, and beside it (≥1100px; under it below that) the server's real email bound to the unsaved settings, with "Subject: …" and "From: …" and **Open full width**. Its sample prize is the tenant's most recently updated Complete prize ("Shown with your most recently updated prize."); with none, a built-in sample ("Shown with a sample prize.": "Sample prize", "This is where your prize's description goes."). The brand (logo, colour) comes from Brand, as in every real send.

**The card.** Title "Prize email"; lede "How your prize emails introduce themselves."

1. **Sender name.** ≤80. Placeholder: the tenant's display name (the real default). Help: "What winners see as the sender."
2. **Reply-to.** Optional email address. Placeholder "promotions@yourteam.com". Help: "Where a winner's reply goes."
3. **Subject.** ≤150. Placeholder "You won: {prize}" (the default). Help: "{prize} becomes the prize name." Any other `{…}` is the field error "Only {prize} can be filled in."
4. **Sending address.** Read-only: "Sent from {address}". It is the platform's `PRIZE_FROM_ADDRESS`; when the server doesn't know it, the row is absent.

Footer: "Save" (primary, disabled until changed) and "Discard"; success shows "Saved." inline. Clearing every field saves the defaults. Clearing the Reply-to is always allowed: no prize depends on it. Member and paused: values as text, no footer. Not audited: reversible configuration, like Brand.

#### The detail drawer

Stays a drawer (440px, the kit's): small, read-mostly, and read in the context of the list the operator is working down. Title: the fan's display name; description: the status chip and "Won Sep 21, 8:41 PM".

1. **As promised.** The `PromisedPrize`: image (64px), name, description; then a short list of what the email carried: "How to claim", "Code" ("Included") when the prize had one, "Button" ("Redeem → northsidecu.org/…") when set, "Provided by" (logo and name), "Won at" ("3 bingos"), and **Open prize** linking to the library prize when `prizeId` is recorded and the prize still exists. Absent for a row with no snapshot.
2. **Sent to.** The fan's masked email ("j•••@gmail.com").
3. **Sends.** The attempt timeline, one entry per attempt: "Queued" → "Sent" or "Failed", with who asked for a resend ("Resent by Dana K., 9:03 PM"; "Sent again by Overboard, Sep 22"). An attempt to a corrected address reads "Sent to a different address", never the address. A failed attempt shows its plain reason (Game day's `reasonKind` sentences); staff also see the recorded reason in monospace.
4. **Actions** (footer), per the table below. Resend confirms inline: "Resend this prize? The fan gets the same prize they won, at the same address." with "Resend" and "Cancel"; after it, "Queued to resend." and a new timeline entry.

Links at the foot: "Open fan" and "Open contest prizes".

#### Resend and Send again

| Action | Rows | Who | Typed confirmation | What it does |
|---|---|---|---|---|
| **Resend** | `failed`, reason `setup` or `other`, fewer than 3 resends | Tenant `org:admin` of the row's tenant, and staff | No | The same snapshot to the fan's account email, as the next attempt |
| **Send to a different address** | `failed` or `bounced` | Staff | No | The existing staff resend with a corrected address ([`prize-delivery.spec.md`](prize-delivery.spec.md), "Corrected address") |
| **Resend selected** | `failed` | Staff, cross-tenant view | No | The existing bulk resend, up to 100 loaded rows |
| **Send again** | `fulfilled` | Staff | Yes, the fan's display name | The same snapshot again, as a new attempt on a row already sent |

When Resend isn't offered on a failed row, the drawer says what the admin can do instead, in one line: for an address failure, "The fan's email couldn't accept it. Ask Overboard to send it to a different address." with **Tell Overboard**; after three resends, "This prize has been resent three times. Tell Overboard and we'll look into it." with **Tell Overboard** (the support report carries the `redemptionId`).

**Send again** opens a centred dialog: "Send this prize again?", "{fan} already has this prize. Sending it again gives them a second copy, including any code.", a required reason ("The fan says it never arrived" · "The fan lost it" · "Something else"), the typed confirmation "Type {fan display name} to confirm", "Send again" (danger) and "Cancel". Nothing re-authenticates (revised 2026-09-28).

**Why a tenant may resend.** [`prize-delivery.spec.md`](prize-delivery.spec.md) made resend staff-only when failures were visible only on a staff screen and the one resend path could also redirect a prize to a typed address. Its rules prevent a double send (Rules 4–5), an unaudited change (Rule 6) and fan PII travelling (Rule 7); none of them is about who clicks. A tenant that can award a prize can re-deliver the same prize: resending a failed send gives the fan nothing they weren't owed, and the conditional write plus the worker's attempt claim still make a second send impossible. The tenant path keeps Rules 4, 5, 6 and 8 and never touches Rule 7 (no corrected address). Sender reputation, which is platform-wide, is bounded three ways: address failures are excluded, each row gets at most three tenant resends, and duplicating a *sent* prize is staff-only and name-confirmed. Game day keeps "no retry control"; its failed rows link to this drawer.

### Staff extras

- **Tenant mode** (a tenant selected, `/prizes/deliveries`): exactly what the tenant's admins see (revised 2026-09-28, Arthur's ruling that staff see tenant screens as the tenant does). No recorded reason, no **Send to a different address**, no **Send again** and no "All workspaces" header link there.
- **Staff tools** — the recorded reason, **Send to a different address**, **Send again** — are on the cross-tenant view only.
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
| Send to a different address; Resend selected | No | No | Yes |
| Send again | No | No | Yes, typed |
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
| POST | `/admin/prize-deliveries/:redemptionId/send-again` | `requireAdmin` | staff only | new |
| POST | `/admin/delivery-queue/resend` | `requireAdmin` | staff only | no re-authentication since 2026-09-28 |
| GET | `/admin/prizes/email` | `requireAdmin` | any admin scope | unchanged |
| PUT | `/admin/prizes/email` | write gate | tenant `org:admin`, staff | unchanged |
| POST | `/admin/prizes/email/preview` | `requireAdmin` | any admin scope | changed |
| GET | `/admin/prizes/handlers` | `requireAdmin` | any admin scope | unchanged |

**Retired:** `GET /admin/prizes` (the ladder read replaces it; its `unawarded` goes) and `GET /admin/delivery-queue` (replaced by `POST /admin/all-prize-deliveries/search`). No per-tier endpoints exist: a tier is written only through the whole-list PUT.

### `GET /admin/prize-library`

Each `adminPrizeSchema` row: `prizeId`, `prizeName`, `prizeDescription`, `prizeImageUrl?`, `prizeClaimInstructions?`, `prizeClaimButtonLinkUrl?`, `prizeClaimButtonText?`, `handlerId`, `providedBySponsorId?`, `providedBy?` (resolved `{ sponsorId, name, logoUrl?, websiteUrl? }`), `hasCode` (and **no** `staticRedemptionCode`), `completeness: { complete, missing }`, timestamps, and `usedBy[]` entries with `tierId`, `threeInARows`, `state` (`draft | open | closed`), `finalized` and `locked`. No type, value or redemption terms. Top level: `max` (`PRIZE_LIBRARY_MAX`).

### `GET /admin/prize-library/:prizeId`

One prize in the same shape, plus `sends: { sent, failed, queued }` (counted by `tierSnapshot.prizeId`). 404 for an unknown or foreign id.

### `POST /admin/prize-library`

The library's create: `{ prizeName, prizeDescription?, prizeImageUrl?, prizeClaimInstructions?, prizeClaimButtonLinkUrl?, prizeClaimButtonText?, staticRedemptionCode?, providedBySponsorId?, handlerId? }`. Fields a prize no longer has (`prizeType`, a value, redemption terms, a shipping time) are dropped, not refused. The server stores what is sent, normalising nothing, and sets `handlerId` to `standard-email` unless a resolving one is sent. Refusals: the library cap (409 `prize_library_full`, "Your library holds up to 200 prizes."), a sponsor outside the tenant (400, "Choose a sponsor from this workspace."), field errors (400). Audit `prize_create` (ids and field names; never the code).

### `PATCH /admin/prize-library/:prizeId`

`{ expectedUpdatedAt, ...changedFields }` over the same fields; absent means unchanged, `null` clears an optional field (`staticRedemptionCode: null` removes the code); the description can be replaced, not emptied. Nothing is normalised. Refusals in order: 404; 409 `stale_prize`; 409 `prize_would_hide` with `{ field, contestId, contestName }`; 400 field errors. On success the changed content fields are copied onto every tier held by a non-finalized contest (§8.4), and the response carries the prize and `refreshedTiers: number`. Audit `prize_update` with the changed field names and `refreshedTiers`.

### `DELETE /admin/prize-library/:prizeId`

As fixed in [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.2: 409 `prize_in_use` while a held tier names it; clears `prizeId` from detached tiers. Audit `prize_delete` before the write.

### `POST /admin/prize-library/:prizeId/reveal-code`

`{ code }`, or 404 when the prize has none. `Cache-Control: no-store`. Not audited: a shared promotional code is not fan data, and the admin revealing it set it.

### `GET /admin/contests/:contestId/prize-tiers`

`{ contest: { contestId, contestName, contestType, state, locked, finalized, updatedAt }, tiers: LadderRow[] }`, ladder order. `LadderRow`: `{ tierId, position, threeInARows, prize: { prizeId?, prizeName, prizeImageUrl?, providedBy?, completeness }, sends: { sent, failed, queued } }`. For a tier with a `prizeId`, `prize` is the live library prize; for one without, the tier's own copy.

### `PUT /admin/contests/:contestId/prize-tiers`

The library's shape, unchanged: `{ expectedUpdatedAt, tiers: [{ prizeTierId?, threeInARows, prizeId? }] }`, 1–3 tiers (bingo), distinct counts 1–8. Added: 400 `prize_needs_details` when the contest is `open` or `closed` and a tier names a Needs-details prize. Existing refusals stay: `contest_finalized`, `contest_locked` (a stored count changed, or a tier removed), `tier_bingos_taken`, unknown prize ("That prize isn't in this workspace's library any more."). The response adds `completeness` per tier.

### `POST /admin/prize-deliveries/search`

POST because the search text can be an email address (the Fans exception in [`admin-lists.spec.md`](admin-lists.spec.md)). Body `{ q?, status?: "sent"|"failed"|"queued", contestId?, tierId?, prizeId?, membershipId?, from?, to?, cursor?, limit? }`. `q` matches display names (anywhere) and fan email addresses (whole or start), resolved first to memberships, bounded. Order `createdAt` desc, then `_id`. Response `{ deliveries: DeliveryRow[], page, summary? }`, `summary: { sent30d, failed, queued }` on the first page.

`DeliveryRow`: `{ redemptionId, wonAt, fan: { membershipId, displayName } | null, contest: { contestId, name, exists }, tier: { tierId?, bingos }, prize: { prizeId?, name }, game?: { betEventId, label }, status, attempts, reasonKind?, reason?, canResend, canSendAgain }`. `reason` is staff-only (tenants get `null` and read `reasonKind`). `canResend` and `canSendAgain` are computed per caller; the console never re-derives eligibility.

Indexes: `PrizeRedemption { organizationId: 1, createdAt: -1, _id: -1 }`, `{ organizationId: 1, status: 1, createdAt: -1, _id: -1 }`, and `{ organizationId: 1, "tierSnapshot.prizeId": 1, createdAt: -1 }`, which need `PrizeRedemption.organizationId` (the migration).

### `POST /admin/all-prize-deliveries/search`

Staff only, no `?tenant=`, 403 "OBS staff only" before anything else (the cross-tenant read pattern of [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md)). Same body plus `tenant?: slug`; rows add `tenant: { slug, name }`; `summary` is platform totals. Index `{ status: 1, createdAt: -1, _id: -1 }`.

### `GET /admin/prize-deliveries/:redemptionId`

`{ row: DeliveryRow, promised?: PromisedPrize, sentTo: maskedEmail | null, attempts: AttemptEntry[] }`. `AttemptEntry`: `{ n, requestedAt, requestedBy: "award" | "resend" | "send_again", requestedByName?, outcome: "queued" | "sent" | "failed" | "bounced", at?, reasonKind?, reason? }` (staff-only `reason`). Attempts come from the new `PrizeRedemption.attempts[]`; a row written before it gets one entry derived from its own fields, and nothing older is invented.

### `POST /admin/prize-deliveries/:redemptionId/resend`

Body `{ expectedResendCount }`. One conditional write where status is `failed`, `resendCount` equals the expected value, and, for a tenant caller, `resendCount < 3` and `reasonKind` isn't `address`; then the queue message with the usual deduplication id. No `correctedEmail` (400 if sent). Refusals: "Already sent." / "Already being resent." / "This prize changed since you opened it." / "This prize has been resent three times." / "This fan's email couldn't accept it, so it can't be resent to the same address." Audit `prize_resend` first, `detail: { redemptionIds: [id], count: 1, addressCorrected: false, via: "row" }`.

### `POST /admin/prize-deliveries/:redemptionId/send-again`

Staff; no re-authentication (2026-09-28). Body `{ expectedResendCount, confirmName, reason: "not_received" | "lost" | "other" }`; `confirmName` must equal the fan's display name (a removed fan can't be sent again). One conditional write where status is `fulfilled` and the count matches → `pending`, `resendCount + 1`; then the queue message. Audit `prize_send_again` (new action) before the write.

### `PUT /admin/prizes/email`

Unchanged. (Wave 4's `reply_to_in_use` is gone: no prize depends on the Reply-to.)

### `POST /admin/prizes/email/preview`

Takes `{ prize, prizeId?, threeInARows, settings? }`: the draft prize (content fields, including `providedBySponsorId`), the saved prize's id to merge its stored code when the draft has none, the count for the bingo line, and unsaved settings (the Prize email card). The credit is resolved from the draft's `providedBySponsorId` within the tenant; unknown shows no credit. The `contestId` parameter and its prize-popup lookup are retired (accepted and ignored).

### The fan wire

`list-contests` and `/b2b/contest/:id` leave out Needs-details tiers and never carry the code or any dormant field (value, type, redemption terms, shipping time). `GET /b2b/board/:id`'s `awards[].prize` carries `prizeId` and `providedBy` (§1.5's shape, extended), and no type.

---

## Migration

None. Wave 4's prize-type migration (`scripts/prize-type-migration.mjs`) was never applied and is removed with the type (Arthur, 2026-09-28). Stored types and the other dormant fields are left as they are.

---

## PRD requirements

**Honoured.**

- **`GAME-02`**: display name, description, difficulty target (bingos to win, on the tier). **One to three tiers** per contest with distinct targets (`PZ-09`). **Approximate value, redemption window, method and location are removed** by Arthur's ruling of 2026-09-28, disregarding `GAME-02` on those points, pending the prize model owner (see "Questions").
- **`PRIZE-01`**: real-time delivery on the win is unchanged; the snapshot delivers exactly what the fan was shown.
- **`PRIZE-03`**: finalization stays staff-only; a finalized contest's tiers refuse every write and are never refreshed by a prize edit.
- **`PRIZE-07`**: failed sends are reviewable by the team whose fans they are and by Overboard across every tenant, with no cap, and resendable. The hard-bounce half arrives with the Bounced slice.
- **`ADM-03`**: a tenant `org:admin` writes its own library, ladders and email settings; `org:member` views.
- **`ADM-04`**: the delivery method stays selectable (the Delivery section) whenever there is a choice.
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

1. **`PZ-01` — No prize type** (revised 2026-09-28). A prize is one flat form of what the popup and the email use; nothing asks, stores or reads a type.
2. **`PZ-02` — Nothing is normalised on save** (revised 2026-09-28). A write stores what it sends.
3. **`PZ-03` — Completeness is one shared function, and it is what delivery needs:** a description and a delivery method that resolves. Incomplete never awards: Publish refuses, the tiers PUT refuses on a fans-visible contest, the worker skips, the fan wire omits.
4. **`PZ-04` — A prize fans can win never goes back to Needs details** (`prize_would_hide`, across every non-finalized, fans-visible contest that awards it).
5. **`PZ-05` — The code never leaves the server except through Reveal.** Not on a read, the fan wire, the preview frame, an audit row or a log.
6. **`PZ-06` — The lock is contest-safety's, shown in place**: bingos to win and removal refuse; the console shows the glyph and the reason under the field. There is no value rule.
7. **`PZ-07` — "As promised" only from the snapshot.** No snapshot, no promise, never the current prize in its place.
8. **`PZ-08` — Credit comes from the prize.** `providedBySponsorId` is the only source of "Provided by" in the popup, the email and their previews; one prize, one credit.
9. **`PZ-09` — One to three tiers per bingo contest, distinct bingos 1–8.** Add tier disappears at three.
10. **`PZ-10` — Tenant Resend re-sends, never re-awards.** Own tenant's failed rows only, not address failures, at most three, conditional on the count, audited first, same snapshot, no corrected address.
11. **`PZ-11` — Duplicating a sent prize is staff-only**: name-confirmed, reasoned, audited first.
12. **`PZ-12` — Status words mean what they say.** "Sent" is "accepted by our mail provider"; "Bounced" exists only once bounce capture does.
13. **`PZ-13` — Deliveries are served from the server**: cursor paging, server-side search and filters, a real total, no cap.
14. **`PZ-14` — Email identity is tenant configuration; the sending address is not.** Sender name, reply-to and subject (`{prize}` the only token) are the tenant's.
15. **`PZ-15` — Retired** (2026-09-28): no prize depends on the Reply-to.
16. **`PZ-16` — Prize edits never reach a finalized contest or an award.** The cascade skips finalized contests' tiers; snapshots are never rewritten, by an edit, a sponsor delete or anything else.
17. **`PZ-17` — The migration never makes a live tier stop awarding.**
18. **`PZ-18` — The claim button and the code are optional on every prize**, and never dropped on the admin's behalf.
20. **`PZ-20` — No draft autosave.** The prize page and the ladder open from the server and save only on Save; "Leave without saving?" asks only with unsaved changes, and always before a new prize exists.
21. **`PZ-21` — Anything the popup or the email doesn't use is not offered as if it did**, and every field's help says where it really shows.
19. **`PZ-19` — The prize side never mentions bingos.** The qualifier belongs to the tier or band.

## Known gaps (recorded, not blocking)

- **The popup appends "!" to the name** in its headline unless the name already ends in punctuation.
- **The popup shows no credit for a sponsor without a prize-popup logo**, while the email shows the name. Today's fan-app rule, kept.
- **The game a prize was won at** needs the evaluator to put the completing prop's `betEventId` on the fulfilment message; rows before that show no game line.
- **Complaints** are recorded but have no tenant surface.
- **The PRD's `GAME-02`, `PRIZE-02`, `PRIZE-05`/`PRIZE-06` revision notes** are owed to the PRD.

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- The staff bulk resend endpoint stays as it was; **Resend selected** on the cross-tenant view uses it.
- A new tier starts with no bingo count, and the admin picks one before saving.
- The email's **Provided by** credit shows the sponsor's logo with the sponsor's name as its alt text.
- Deliveries rows don't show the game yet.
- The old `/delivery-queue` link lands on the cross-tenant view, with its workspace filter carried over as `?tenant=`.

## As built (Wave 4b)

- The prize page's sections all start open; a folded section's summary line is built from its fields.
- The Email tab previews with the most recently updated Complete prize, as the old card did.
- The ladder's New prize trip for a row not yet saved waits a moment (about 40ms) before leaving, so the contest screen hears that the row travels in the address and doesn't ask.

## Questions for the prize model owner

Arthur answered the rest on 2026-09-28 (no type; one generic, data-driven email template; email is the only channel; the name is the title; no value; no redemption method, place or window; the optional code stays). Still open:

1. **`handlerId` going forward.** Per-sponsor handlers, coupon batches (`PRIZE-05`/`PRIZE-06`), or one standard email? The console hides the choice while there is one method.
2. **Where the sponsor credit comes from.** One sponsor per prize (`providedBySponsorId`), or per contest or tier placement?
3. **Sender name, reply-to and subject.** Should tenants keep these settings?
4. **The dormant fields.** May the stored `prizeType`, `shipsWithinDays`, `approximateValueCents`, `redemptionMethod`, `redemptionLocation` and `redemptionWindow` be dropped from the model?

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
