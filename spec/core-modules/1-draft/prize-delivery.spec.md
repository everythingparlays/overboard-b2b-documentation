# Core Module Spec: Prize Delivery

**Implements:** PRD `PRIZE-01`, `PRIZE-04`, `PRIZE-05`, `PRIZE-06` (the assignment half — see "Codes"), `PRIZE-07`, `ADM-04` (the handler selection half), `AUTH-03` (email as the delivery channel), `GAME-02` (the tier fields a winner is told about). Ruling D-066: **OBS owns the notification and the assignment guarantee; sponsors own the value and its redemption.**

**Depends on:** [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the Prizes screen, tier storage and the tier write. [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the Delivery queue screen. [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, "No re-authentication", and the **Honesty by omission** and **Fan's-eye view** principles, both of which this spec leans on hard. [`../../infra/environments.spec.md`](../../infra/environments.spec.md) — where the sending address is configured per stage.

**Supersedes:** the "visibility-only" posture of the Delivery queue (admin-obs-internal, Not in scope + Known gaps); the free-text `handlerId` field on the Prizes screen (admin-games-and-prizes, `/prizes`); and the per-handler hardcoded HTML templates in `prize-worker/src/email_templates/`.

**Status:** Draft, written 2026-09-23 with the build (Slice 3 of the 2026-09-23 wave); revised 2026-09-27 — see "Revision 2026-09-27 — the prize library" and "Revision 2026-09-27 (Wave 4)", which win wherever they and an older section disagree. No open questions.

**Revised 2026-09-24** (ruling, Arthur): the console's prize screens and the email settings live in [`admin-prizes.spec.md`](admin-prizes.spec.md) (rebuilt on the prize library in its Wave 4 revision); this spec keeps the delivery engine, the method registry and the email template.

---

## Overview

When a fan completes a bingo line, the board-evaluator puts a message on the prize-fulfillment queue, and the prize worker delivers the prize for that bingo count. Until this spec, the only working delivery path sent every tenant's fans the same hardcoded Nike / "Hawk Bingo" email, from a staff member's personal address, telling them to use a discount code nothing generated. The in-game prize popup was honest; the email was not.

**The whole change, in one line:** the prize email becomes a real, tenant-branded message built only from what the tenant configured, sent through a delivery-method registry the Prizes screen picks from, with at-most-once sends and an audited, operator-driven resend for anything that fails.

**In scope:**

1. The **standard prize email** — one templated email, rendered per tier from the tier's own fields and the tenant's branding, with a tenant-configured sender name, reply-to and subject, and the presenting sponsor's mark when a sponsor holds the prize popup.
2. The **delivery-method registry** (`handlerId`) — a catalog of methods the Prizes screen offers as a dropdown, scoped per tenant; the standard email for everyone, developer-built custom methods for the tenants they were built for (`PRIZE-05`).
3. **Resend** — failed sends go back on the queue from the Delivery queue, singly or in bulk, optionally to a corrected address, audited, and structurally unable to double-send.
4. **At-most-once delivery** in the worker — attempt claiming, interruption detection, bounded handler time.
5. The Prizes screen's **per-contest view**, its **bingo ladder** (which bingo counts pay what, and which pay nothing), the tier drawer's delivery-method dropdown and live email preview, and the **Prize email** settings.
6. A **local delivery loop** for development: a file queue and a file outbox, so the whole path runs on a laptop with no SQS and no provider.

**Not in scope:**

- **Coupon-code batches** (`PRIZE-05`/`PRIZE-06`'s batch half) — deliberately deferred until the first real sponsor's shape is known. The seam is specified below ("Codes").
- **Sending-domain authentication** — done for `email.overboardsports.com` in Resend (2026-10-03). A DMARC record for `overboardsports.com` is still open. See "Deploy dependency".
- **Bounce and complaint processing** (provider events feeding back into `PrizeRedemption`). Recorded gap — today a bounce after the provider accepted the message is invisible to the worker; Resend's dashboard shows it to a human.
- **Deferred end-of-game delivery** (`PRIZE-02`). Unchanged: finalization still dispatches nothing.
- **Tenant-uploaded HTML templates.** `PRIZE-04` makes templates developer work; a tenant never uploads markup.

---

## Revision 2026-09-27 (Wave 3) — scoring in dev, and awards the fan app trusts

See [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §1 and §8. The evaluators' logic moves into `obs-b2b-shared/src/scoring/`
and claims lines with a conditional write. A dev-only prop watcher feeds dev stacks and local servers the production
message (§1.3). The fan app shows bingos and the prize popup only from what the server recorded (§1.5). Four prize-library
fixes follow in §8: migration scoping, deleting a prize from a removed tier, tenant delete, and finalized contests.

## Revision 2026-09-27 — the prize library

A prize is no longer authored on a tier: it is a tenant-owned record in a **prize library** (`${prefix}prizes`),
carrying every field this spec previously described as living on the tier — including `handlerId`, the delivery
method, which is now **the prize's own property, decided once, with no per-contest override**. `B2BPrizeTier`
keeps `threeInARows` and gains `prizeId`; the tiers PUT resolves the named prize within the tenant and writes the
tier's content fields as a copy of it, kept current by a `PATCH` to the prize cascading onto every tier naming
it. This changes what the Prizes screen edits and what the email preview takes as input, below, and nothing else
in this spec: the tier's fields are still what the worker's `loadTiers`, the award-time snapshot, the email
renderer and the delivery-queue search all read, because they read a copy of the prize that is always current.
The lock rule is unchanged in effect and now phrased against the prize: re-pointing a locked contest's tier at a
cheaper prize is refused as "value lowered", and lowering or clearing a prize's value is refused
(`409 prize_value_locked`) while any tier naming it sits on a locked contest.

---

## Revision 2026-09-28 (Wave 4b)

Arthur's answers of 2026-09-28 revise the Wave 4 revision below ([`admin-prizes.spec.md`](admin-prizes.spec.md)
carries the detail):

1. **No prize type.** `prizeType` and `shipsWithinDays` are dormant: stored values stay, nothing writes, reads or
   renders them. Nothing is normalised on save.
2. **One generic, data-driven template.** The standard email is the only template, never per sponsor and never one
   per prize; email is the only channel. It **renders by presence**: the code block when a code is set, one "How to
   claim" block from the claim instructions, the button when a link is set, and the "Provided by" credit. No type
   ordering, no pick-up lead, no ships-within or expiry line. **The prize's name is the headline.**
3. **No stated value and no redemption method, place or window.** `approximateValueCents`, `redemptionMethod`,
   `redemptionLocation` and `redemptionWindow` are dormant like the type, the "Details list" below is retired, and the
   lock's value rule (`prize_value_locked`, re-pointing at a cheaper prize) is gone.
4. **Completeness is what delivery needs**: a description and a delivery method that resolves. The worker applies the
   same rule, so a prize the console calls Complete is never skipped; the award snapshot keeps only what the email
   renders (plus `prizeId` and `providedBy`).
5. **The email settings** (sender name, reply-to, subject) move to their own **Email** tab of Prizes, and
   `reply_to_in_use` is gone: no prize depends on the Reply-to.

---

## Revision 2026-09-27 (Wave 4)

The console redesign, built on the library ([`admin-prizes.spec.md`](admin-prizes.spec.md)), changes four things here.
The engine (claim, attempts, registry, resend, local loop) is unchanged.

1. **The prize has a type, a credit and a button on every type.** `B2BPrize` gains `prizeType` (pickup, code, link,
   shipped), `providedBySponsorId` and `shipsWithinDays`, and `PRIZE_CONTENT_FIELDS` gains all three, so every tier copy
   and every award snapshot carries them. The claim button (`prizeClaimButtonLinkUrl`, `prizeClaimButtonText`) is
   optional on every type and required only for Link; nothing drops it.
2. **The email follows the type** (admin-prizes, "What the winner sees"): a pickup lead line, a code block, the button
   on any type, a shipping line. **"Approximate value" leaves the email**; it is never shown to fans. **The credit reads
   "Provided by" and comes from the snapshot's `providedBy`**, copied from the prize's sponsor at award time. The worker
   no longer resolves a `prizePopup` placement at send time, so `DeliveryContext.sponsor()` and `loadPrizeSponsor` go;
   a failed sponsor lookup at award time drops the credit, never the prize.
3. **The snapshot records which prize was paid**: `tierSnapshot` gains `prizeId`, `prizeType`, `shipsWithinDays` and
   `providedBy { sponsorId, name, logoUrl?, websiteUrl? }`. Finalized contests are final: a prize edit refreshes only
   tiers held by non-finalized contests ([`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) §8.4), and no edit
   reaches a snapshot.
4. **Where things are edited and seen.** The email settings (sender name, reply-to, subject) are the **Prize email**
   card on Prizes → Deliveries, still through `GET/PUT /admin/prizes/email`. The Delivery queue is Prizes → Deliveries
   for a tenant and `/obs/prize-deliveries` for staff (All prizes → Deliveries, `/obs/prizes/deliveries`, since Walk #3). `POST /admin/prizes/email/preview` takes
   `{ prize, prizeId?, threeInARows, settings? }`; its `contestId` is retired.

Rule 10 below changes accordingly: **the email credits the prize's "Provided by" sponsor as snapshotted, or no
sponsor at all.**

---

## Where `PRIZE-04` and D-066 meet

`PRIZE-04` says "one HTML template per prize … template creation and upload is performed by developers". Read literally, every new prize would need an engineer — which contradicts `GAME-04` ("which prizes attach to a game must never require a code change") and `TEN-03` (≤1–2 engineering hours per tenant). D-066 settled the product question: OBS's job is to notify and to guarantee assignment; the sponsor's value lives in the tier's own fields.

So the resolution is: **one developer-built template, parameterised by the tier.** The standard email *is* the developer-made template `PRIZE-04` asks for; what varies per prize is data the admin surface already collects. A sponsor whose mechanics genuinely need their own markup or logic gets a **custom method** — developer code, registered in the catalog, offered only to their tenant — which is exactly the `PRIZE-05` exception, kept intact as the escape hatch.

---

## The standard prize email

### The wording is platform data (Walk #3, 2026-09-29)

Every word of the email that is neither prize data nor a tenant setting is the platform's **prize-email wording**
(`PrizeEmailWording` in `obs-b2b-shared/src/interfaces/b2b/PrizeEmail.ts`): the default subject, the heading ("You
won"), the line under the prize ("You hit {bingos}."), the code label ("Your code"), the claim steps heading ("How to
claim"), the sponsor label ("Provided by") and the footer ("You're receiving this because you won a prize playing
with {team}."). The values in brackets are the built-in wording, used for any field nothing is stored for.

- **Stored once, in the database.** One `platform_settings` document (`_id: "platform"`, collection
  `<prefix>platform_settings`, model `B2BPlatformSettingsModel`) holds `prizeEmailWording` (only the fields staff
  changed), `prizeEmailWordingUpdatedBy` and `prizeEmailWordingUpdatedAt`. A missing document means the built-in
  wording; no seed is needed.
- **Edited by Overboard staff only**, on All prizes → Email (`GET`/`PUT /admin/platform-prize-email`,
  [`admin-prizes.spec.md`](admin-prizes.spec.md)); refused server-side for anyone else, audited
  (`prize_email_wording_update`) before it is saved.
- **Placeholders:** `{prize}` (the prize's name), `{team}` (the tenant's name) and `{bingos}` ("1 bingo", "3
  bingos"). Anything else in braces, markup and line breaks are refused at the contract. The renderer fills the
  placeholders into plain text, then escapes the result like every other value, so neither the wording nor what
  fills it can become markup; the subject stays header-safe.
- **Precedence:** a tenant's own sender name, reply-to and subject beat the platform's wording wherever both exist.
  The platform subject is only the default for a tenant with none.
- **Read at send time.** The renderer takes the wording as input (`PrizeEmailInput.wording`) and stays pure. The API's
  preview reads the stored document (or a staff-only unsaved draft); the worker reads the same document through its
  store (`DeliveryStore.loadPrizeEmailWording`, via `DeliveryContext.wording()`), so staff preview what winners get.
  If the worker can't read it, the prize is still sent, in the built-in wording, and the worker logs it: wording is
  presentation, never a reason to fail a send.
- **One template.** Still one data-driven template for every tenant, sponsor and prize; staff change its words, never
  its structure.

### What it merges — and the omission rule

*Revised by [`admin-prizes.spec.md`](admin-prizes.spec.md), "The prize email" (Wave 4b, 2026-09-28): the email renders by presence, not by a type; no value, place, window or shipping line; the name is the headline; the credit reads "Provided by" from the prize, as snapshotted at award time. The "Details list" row below is retired.*

The email is built from real, configured data only. **Anything unconfigured is omitted — never placeholdered, never apologised for** (D-068). There is no "N/A", no "See details", no empty heading above a missing section.

| Block | Source | When absent |
|---|---|---|
| Sender name | `organization.prizeEmail.fromName` | the tenant's `name` |
| Reply-To | `organization.prizeEmail.replyTo` | no Reply-To header |
| Subject | `organization.prizeEmail.subject`, `{prize}` → prize name | the platform wording's default subject (built in `You won: {prize}`) |
| Header mark | `branding.assets.logo` (http/https only) | the tenant's name as a wordmark |
| Accent color | `branding.theme.colors.primary` | the platform default accent |
| Kicker + headline | the wording's heading (built in "You won") + `prizeName` | — (both required) |
| Bingo line | the wording's line under the prize, `{bingos}` from `tierIndex + 1` — "You hit 2 bingos." | — (always known) |
| Prize image | `prizeImageUrl` (http/https only) | no image block |
| Description | `prizeDescription` | — (required) |
| ~~Details list~~ | retired 2026-09-28: a prize has no value, redemption method, place or window | — |
| Code | the tier's static redemption code, when the tier has one | no code block |
| How to claim | `prizeClaimInstructions` | no section |
| Button | `prizeClaimButtonLinkUrl` (http/https only) + `prizeClaimButtonText` | no button without a link; "Claim your prize" when a link has no text |
| Presented by | the sponsor holding the prize-popup slot where the prize was won (below, "Presented by") | no mark |
| Footer | the wording's footer (built in "You're receiving this because you won a prize playing with {team}.") | — |

The fan's name is **not** merged. Signup fields are tenant-configurable and a name may not exist; a greeting that sometimes reads "Hi ," or "Hi there" is worse than none. The email carries no tracking pixel and no link rewriting.

A URL that is not `http:` or `https:` is treated as absent (a `javascript:` or `data:` link never reaches a mail client). The tier write now refuses such URLs at the door, so the renderer's check is defence in depth.

### Presented by

*Superseded by [`admin-prizes.spec.md`](admin-prizes.spec.md), "What the winner sees" (Wave 4): the credit reads "Provided by" and comes from the library prize's `providedBySponsorId` (copied to the tier and snapshotted at award as `providedBy`), not from the prize-popup placement holder; the preview renders it from the unsaved prize. Per-game placements were also removed (Arthur, 2026-09-30: a placement is for the whole contest), so the game-specific override and dormant placements below describe nothing current.*

The email credits the sponsor presenting the prize: **the sponsor holding the `prizePopup` slot where the prize was won** — exactly the sponsor the fan's in-app prize popup credits for the same win ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)). It is decided by the same shared resolver, `resolveSponsorSlots` (`SP-07`), at (the contest, the board's game), so the popup and the email cannot name different sponsors:

- **A game-specific placement overrides the contest-wide one** for the slot (`SP-01`). The board's game is the one game its squares' props come from; a board naming none or several resolves contest-wide placements only. The board is read only when a game-specific placement holds the prize popup at all — otherwise the game cannot change the answer.
- **Placements at a game the contest no longer runs are dormant**, exactly as on the fan schedule.
- **Nobody holds the slot, or the holder has no prize-popup logo: no mark, and nothing is said** — the omission rule above. Most contests place nothing on the prize popup, and their emails are unchanged.

**Rendered at the end of the card**, under everything the winner needs and set apart by a rule: a small "Presented by" label and the sponsor's prize-popup logo (32 px high, the sponsor's name as its alt text for clients that block images), linked to the sponsor's website when one is set. The logo and link are https — the sponsor contract stores nothing else — and pass the renderer's scheme check like every URL here. The plain-text part carries "Presented by {name}", or "Presented by {name}: {website}". Kept small: it is the team's email, not the sponsor's.

**A failed sponsor lookup never costs a winner their prize.** The worker resolves the sponsor on demand for the method that credits one (`DeliveryContext.sponsor()`, backed by the store's `loadPrizeSponsor`, tenant-scoped like every sponsor read); if the lookup throws, the email goes without the mark and the worker logs it against the redemption.

Code: `node-server/src/prize-delivery/prize-sponsor.ts` (the pure resolution both callers share), `render-prize-email.ts`; `prize-worker/src/delivery-store.ts` (`loadPrizeSponsor`), `process-message.ts`, `fulfillment-handlers.ts`.

### How it is built

- **Table layout, inline styles, 600px fluid container**, one `<style>` block for the mobile breakpoint and dark-mode hints; renders in Gmail (web and apps), Apple Mail, Outlook (Windows, with VML button fallback), Outlook.com and Yahoo.
- **Light card on a neutral ground.** The tenant's Accent (`branding.theme.colors.accent`, else its onboarding Accent; revised 2026-09-29) is the email's accent (header rule, button, code border), never the page ground: email dark-mode inversion across clients is inconsistent enough that a dark-ground email is a gamble, and the accent survives inversion.
- **The brand color is measured, not trusted.** Text in the brand hue is walked darker (hue kept) until it reads at 4.5:1 on the card. The button keeps the brand's exact color whenever it is visible on the card at all (≥1.35:1 — a stadium yellow at ~1.4:1 stays the team's yellow); only near-whites are darkened. The label ink is the better of near-black and white (`onColor`), and a mid-tone brand where neither ink reaches 4.5:1 (a saturated red, a mid grey) is walked toward black until one does.
- **A plain-text part** accompanies every HTML part, with the same content and the same omissions.
- **A hidden preheader** ("{prize} from {tenant}") so inbox previews read as a sentence, not markup.
- **Every merged string is HTML-escaped**; the subject and sender name are header-encoded (RFC 2047 for non-ASCII) and cannot carry a line break — the contract refuses control characters, the renderer strips them again.
- **One renderer, two callers.** `node-server/src/prize-delivery/` holds the pure renderer (no database, no AWS). The prize worker bundles it to send; the API calls it for the admin preview. The preview therefore is the email, not a picture of it — the Fan's-eye view principle applied to a fan's inbox.

### Sender identity

*Where these settings are edited: the **Prize email** card on Prizes → Deliveries ([`admin-prizes.spec.md`](admin-prizes.spec.md), Wave 4). There is no separate Emails page.*

A tenant configures **how the email presents itself**, not where it comes from:

- **Sender name** — what the fan's inbox shows ("UND Fighting Hawks").
- **Reply-To** — where a fan's reply goes (a team promotions inbox).
- **Subject** — free text with one optional `{prize}` placeholder. Any other brace token is refused at the contract.

The **sending address** is platform configuration (`PRIZE_FROM_ADDRESS`), identical for every tenant, because it must be on a domain Overboard has authenticated with the sending provider. It is `support@email.overboardsports.com`, on the domain Resend has verified (Nick, 2026-10-03); tenants set their own Reply-To, and the platform's replies land in the `support@everythingparlays.com` Google Workspace mailbox. A Reply-To on another domain has no effect on authentication or filtering: SPF, DKIM and DMARC look at the From and return-path domains only. The From header is `"{sender name}" <{PRIZE_FROM_ADDRESS}>`. When `PRIZE_FROM_ADDRESS` is unset the worker **refuses to send** and records why; it no longer falls back to a staff member's personal address.

The **provider** is platform configuration too (`PRIZE_MAIL_PROVIDER`): **Resend** by default, SES behind `ses`. Resend was chosen (2026-10-01) because it has no sandbox or approval step — the domain's DKIM records in DNS are the only gate — and its dashboard shows each message's fate, which SES only offers after a configuration set, SNS and a consumer are built. Resend needs `RESEND_API_KEY`, delivered to the worker from Secrets Manager (`resendSecretName` in `lib/config/environments.ts`), never in plain environment. Every Resend send carries an idempotency key of `{redemption}-{attempt}`, so a redelivered attempt is answered with the first result rather than a second email. Error translation is the same as SES's: only a 429 or 503 is retryable; everything else is final and readable. SES stays available as a one-value switch per stage; the worker's `ses:SendEmail` grant exists only on a stage that uses it.

These settings live on the organization (`prizeEmail`), are edited on the Prizes screen by OBS staff and the tenant's own `org:admin` (same grant as tier editing), and are not audited — they are reversible configuration, like branding.

---

## The delivery-method registry

### Why a registry

`handlerId` was a free-text field. The Prizes screen's placeholder suggested `concessions-v1`, which is not a handler — so the obvious way to fill the field produced a tier that fails every send. A value the server can reject after the fact is a foot-gun; a value chosen from what exists is not.

### Shape

The catalog lives in `node-server/src/prize-delivery/handler-catalog.ts` and is bundled into the worker, so the list the dropdown offers and the list the worker can execute are the same object. Each entry has an id, a label and one-sentence description in product language, a kind (`standard` | `custom`), any legacy aliases, whether it can be previewed, and — for custom methods — the tenant subdomains it is offered to.

| id | label | kind | offered to |
|---|---|---|---|
| `standard-email` | Prize email | standard | every tenant |

`handler_001` and `handler_002` (the retired Nike templates) are **aliases of `standard-email`**. Tiers stored with them keep delivering, now with their own real content instead of the Nike copy, and show as "Prize email" on screen; the console writes `standard-email` the next time that tier is saved (the API accepts either, since both resolve to the same method). `email`, `email-test`, `webhook` and `barcode` (the removed stubs) are **not** aliases: they never sent anything, so there is no behavior to preserve, and a tier naming one keeps failing loudly until an operator chooses a real method.

**Custom methods are tenant-scoped.** `GET /admin/prizes/handlers?tenant=` returns the standard methods plus the custom methods registered for that tenant only. A custom method's name can identify another team's sponsor; on a white-label platform that is a leak.

**Adding a custom method** (`PRIZE-05`) is developer work: add a catalog entry with `kind: 'custom'` and `tenants: ['<subdomain>']`, and a `deliver` implementation in `prize-worker/src/handlers/`. A custom method may reuse the standard renderer with extra blocks, render its own developer-authored template, or do something other than email entirely — the worker only requires that `deliver` throws when nothing was delivered.

### Enforcement

- `PUT /admin/contests/:contestId/prize-tiers` refuses a tier whose `handlerId` is **new or changed** and is not in the tenant's catalog (400, "Choose how this prize is delivered"). A stored, unchanged id is accepted so that editing one tier never blocks on a sibling's legacy value.
- The screen marks any tier whose method does not resolve — **"Won't deliver"** — and the drawer requires a choice before it saves. This is live configuration state an operator must act on, the same class as the Games screen's "Incomplete" badge — not gap narration.
- The worker resolves aliases, and a tier whose id resolves to nothing fails the send with a reason naming what to do.

---

## At-most-once delivery

SQS delivers at least once; a fan must receive a prize at most once per attempt. The worker guarantees it with a claim, not with luck:

```
message ──► ensure PrizeRedemption row (unique on user, contest, bingo count, board)
            │
            ├─ status fulfilled / skipped / failed ──► done (ack)          ← replay-safe
            │
            ├─ resolve contest, tenant, tier, method
            │     no tier at this bingo count ──► skipped
            │     contest/tenant/method missing ──► failed + reason (ack; a retry cannot fix config)
            │
            ├─ CLAIM attempt n:  update where status=pending AND dispatchedAttempt ≠ n
            │                    set dispatchedAttempt=n, dispatchedAt, handlerId
            │     claim lost (attempt n already claimed) ──► the earlier holder died mid-send:
            │                    mark failed "interrupted — may or may not have arrived" (ack)
            │
            ├─ deliver (bounded: 60 s, well inside the queue's 120 s visibility timeout)
            │     throws, and the error proves nothing was sent (throttled, provider unavailable,
            │     no email found yet) AND receives < 3 ──► release the claim, leave for redrive
            │     throws otherwise ──► failed + reason (ack)
            │
            └─ fulfilled (conditional on the claim still being ours), clear any corrected address
```

Attempt `n` is `resendCount + 1`: the original send is attempt 1, every resend adds one. Two properties fall out:

- **A redelivered message can never re-send.** Its attempt is already claimed, so it either finds a terminal status (and acks) or finds an orphaned claim (and records an interruption for a human to judge).
- **A crashed send is visible, not silent.** Previously a worker dying between creating the row and sending left it `pending` forever — the redelivered message saw the row existed and acked. Now a row that exists but was never claimed is simply delivered, and one that was claimed and never finished becomes a `failed` row on the Delivery queue.

**Failure reasons never carry an address.** The email provider echoes the recipient in some rejections; every email address in provider text is redacted before it is stored, because the reason is shown on the Delivery queue, which names a fan by display name only.

Transient failures retry through SQS redrive only when the error proves nothing left: a throttle or provider-unavailable response, or a failed email lookup before any send. A timeout does **not** retry — the send may have landed — it fails with a reason that says so.

---

### The tier snapshot (2026-09-24; unchanged in semantics by the 2026-09-27 prize library)

The worker no longer reads a win's tier at send time. When it first handles a win it copies the paying tier onto the redemption row (`tierSnapshot`, conditional, before any claim), and every send of that win — the original and every resend — renders from the copy. Editing or removing the tier afterwards changes nothing for a fan who has already won. The delivery method comes from the snapshot too, falling back to the same tier's current method only when the snapshotted one is no longer available (the operator's fix). Since the prize library, the tier's own fields are already a server-written copy of its prize, so the snapshot is a copy of a copy: taking it at award time still freezes exactly what the fan was shown, whatever the prize record does afterwards. Full rules: [`contest-safety.spec.md`](contest-safety.spec.md), "The prize snapshot".

## Resend

`PRIZE-07`: failed sends are "reviewable so they can be resolved or resent". The Delivery queue now resolves them.

### Endpoint

`POST /admin/delivery-queue/resend` — `requireAdmin` (no re-authentication since 2026-09-28), OBS staff only (403 before anything else). Body: `{ items: [{ redemptionId, expectedResendCount }], correctedEmail? }`, 1–100 items; `correctedEmail` only with exactly one item.

For each item, one conditional write moves the row from `failed` to `pending`: **where** `_id` matches, `status` is `failed` and `resendCount` equals `expectedResendCount` (absent counts as 0); **set** `status: pending`, `resendRequestedAt`, and the corrected address if one was given; **increment** `resendCount`. Then one queue message `{ type: "prize-resend", redemptionId, attempt }` goes out, with FIFO deduplication id `resend-{redemptionId}-{attempt}`.

Refused items change nothing and come back with a plain reason: already delivered, already being resent, changed since the operator loaded the list, or not found. If the queue send fails, that row is put back to `failed` with "Couldn't be queued for resending — try again", and reported refused.

**Why this cannot double-send:** the status condition means only a `failed` row moves; the count condition means a stale screen, a double click, or a second operator is refused rather than queued twice; the deduplication id means even a retried queue send is one message; and the worker's attempt claim (above) means even a duplicated message is one send.

### Corrected address

A fan who typed a bad email can be reached at a corrected one. The address is written to `PrizeRedemption.recipientOverride` — `select: false` in the model, so no existing read returns it — used for that one attempt, and **cleared by the worker when the attempt concludes**, delivered or not. It never appears on any wire, in any log, or in the audit row. Fan deletion (`SEC-07`) clears it too. It does not change the fan's account email: identity belongs to Clerk and the fan.

### Audit

`prize_resend`, written **before** any row changes, one row per request. `organizationId` when every item belongs to one tenant; platform-scoped otherwise, with the tenants in `detail` (admin-obs-internal Rule 9). `detail`: `{ redemptionIds, count, addressCorrected }` — ids and a boolean, never the address. No audit row, no resend.

### What the queue shows

*The screen is superseded by [`admin-prizes.spec.md`](admin-prizes.spec.md): the Delivery queue becomes the **Deliveries** tab of Prizes for tenants (their own sends, with a tenant Resend of failed rows) and `/obs/prize-deliveries` for staff across every tenant. The endpoint and its rules above are unchanged.*

Failed rows, plus rows **being resent** (`pending` with a resend count) so an operator sees their action land: the row reads "Resending" until the worker reports back, then leaves the list or returns as failed with a fresh reason. The screen offers **Resend** per row (with the corrected-address option) and **Resend selected** for bulk. Nothing re-authenticates (2026-09-28).

---

## The Prizes screen

*Superseded twice. 2026-09-24: [`admin-prizes.spec.md`](admin-prizes.spec.md) took over the Prizes screen, the tier editor and the email settings. 2026-09-27: the prize library revision above made `/prizes` the library of prizes (name, description, image, claim copy, delivery method, value, redemption terms), with tiers picking a library prize and a bingo count. [`admin-prizes.spec.md`](admin-prizes.spec.md) (Wave 4 revision) specifies the resulting screens: Prizes with Library and Deliveries tabs (the email settings on Deliveries), each prize on its own full page, and the contest's Prizes tab as a numbered ladder of bingo count plus library prize. The bullets below describe the pre-library layout and are kept for history only.*

Supersedes the `/prizes` section of admin-games-and-prizes.spec.md where they differ.

- **One contest at a time.** A switcher at the top (segmented control for up to four contests, a select beyond that), remembered per tenant for the session. Default: the most recently created contest that is not finalized, else the most recent. Every contest used to render at once, which buried the one being worked on.
  - **A link can name the contest.** `/prizes?contest=<id>` opens on that contest — Games & Contests' tier links and Operations' "has games but no prizes" item send it. It outranks the remembered choice (it is the newer one: the operator just chose that contest elsewhere) and becomes the remembered choice. Picking another contest in the switcher drops the parameter from the address, so a reload does not contradict the switcher. An id that is not one of this tenant's contests is ignored and the usual order applies: this visit's pick, the remembered contest, the default.
- **The bingo ladder.** The contest's tiers as rungs ordered by bingo count, from 1 up to the highest tier. A count with no tier renders as a quiet "No prize" rung — the configuration truthfully drawn, so a gap between two tiers is visible as a gap rather than discovered from a fan complaint. Each rung shows the prize, its method (or **Won't deliver**), and what it has delivered.
- **Unawarded wins.** Where fans actually reached a bingo count with no tier (`skipped` redemptions), the rung carries the count ("Reached 14 times"). Counts above the top tier are shown on one line beneath the ladder. These are real numbers from `PrizeRedemption` — counted per win (per board), not per distinct fan — and nothing is estimated.
- **The tier drawer** gains the delivery-method dropdown (defaulting to the standard email), the claim button fields (previously uneditable), the GAME-02 fields and the static code when the shared model carries them, URL validation, and a **Preview email** view rendering the unsaved draft through `POST /admin/prizes/email/preview`. The preview names the tier's contest, so it carries that contest's presenting sponsor (below, "Endpoints").
- **Prize email card** (side column): sender name, reply-to and subject, each showing the real fallback as its placeholder, with the sending address shown read-only when the server knows it. Its preview sends the selected contest, as the tier drawer's does. A tenant `org:member` sees the values read-only (the D-059 presentation).
- **Delivery card** unchanged in meaning; "Skipped" is relabelled **"No prize at that count"** so the number explains itself.

---

## Endpoints

*Revised by [`admin-prizes.spec.md`](admin-prizes.spec.md), "Endpoints" (Wave 4, and Wave 4b): the preview takes `{ prize, prizeId?, threeInARows, settings? }` and credits the draft prize's sponsor; the settings routes stay `GET/PUT /admin/prizes/email`, edited on the Prizes page's Email tab. Wave 4's `reply_to_in_use` is retired.*

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/prizes/handlers` | `requireAdmin` | any resolved admin scope |
| GET | `/admin/prizes/email` | `requireAdmin` | any resolved admin scope |
| PUT | `/admin/prizes/email` | `requireAdmin` + obs staff or tenant `org:admin` | tier-editing grant |
| POST | `/admin/prizes/email/preview` | `requireAdmin` | any resolved admin scope (renders; changes nothing) |
| POST | `/admin/delivery-queue/resend` | `requireAdmin` | obs staff only |

**The preview's input, since the prize library.** `POST /admin/prizes/email/preview` takes a library prize plus the `threeInARows` count it is being previewed at (the bingo line the email states), rather than a full tier object — the prize is where the emailed content and the delivery method now live; the bingo count contributes only the "You hit N bingos" line. **The preview's contest** (retired, Wave 4). The credit now comes from the draft prize's `providedBySponsorId`, resolved within the target tenant; a `contestId` sent by an older console is accepted and ignored.

Changed: `GET /admin/prizes` and `PUT …/prize-tiers` return `unawarded` per contest; the tier write enforces the registry and URL schemes; `GET /admin/delivery-queue` returns resending rows and each row's `state`, `resendCount`, `lastResendAt`. Contracts: `obs-b2b-shared/src/api/admin/{prize-delivery,delivery-queue,prizes}.ts`.

---

## Codes — the deliberate seam

`PRIZE-05` says sponsors hand OBS a batch of codes and OBS assigns an unused one per winner; `PRIZE-06` says no code goes to two fans. **The batch model is deferred on purpose**, until the first real sponsor's shape is in hand: single-use vs. shared codes, per-game vs. per-season batches, what exhaustion should do, whether the sponsor wants a barcode, a URL, or a string. Designing it speculatively risks building the wrong constraints into the one table whose correctness is contractual.

What exists now, and where the batch plugs in later:

- **A static code per tier** (when the shared model carries it): one code every winner of that tier receives — the "use code HAWKS10" promotion. `PRIZE-06`'s no-duplicates rule does not apply to a code that is shared by design.
- **The seam** is the delivery method. A batch-backed method will, inside its `deliver`, atomically take one unassigned code (`findOneAndUpdate` on a `B2BPrizeCode { batchId, code, assignedTo: null }` → `assignedTo: redemptionId`), render it into the standard email's code block, and record `codeId` on the redemption. The attempt claim above already guarantees one assignment per attempt; a resend reuses the code already recorded on the redemption rather than drawing a second.
- **Exhaustion** belongs to that method (`PRIZE-05`: "edge-case handling … belongs in that per-sponsor logic"): fail the send with a reason ("This prize's code batch is empty") so it lands on the Delivery queue, resendable after the sponsor tops it up.

---

## Local delivery loop

Neither SQS nor a mail provider is wanted from a laptop — the dev stacks' evaluator Lambdas do not run (no `MONGODB_SECRET_ARN`), and a developer's test runs should not reach real inboxes. So both ends of the queue and the mail transport have a file-backed development mode, **refused at startup when `NODE_ENV=production`**:

- `PRIZE_LOCAL_QUEUE_DIR` — the API writes resend messages there as JSON files instead of calling SQS; `prize-worker`'s local runner (`npm run local`) consumes that directory in place of the queue.
- `PRIZE_EMAIL_OUTBOX_DIR` — the worker writes each email as `.html`, `.txt` and a headers `.json` instead of calling SES.

The local worker authenticates to Mongo with the developer's AWS SSO session through `@aws-sdk/credential-providers` (a dev dependency, as in node-server; the deployed container uses its task role). `prize-worker/.env.example` documents the whole setup. `prize-worker/scripts/enqueue-local.mjs` drops a board-win message into the local queue, so a full win → email → failure → resend loop runs end to end against the developer's own `arthur_`-style collections.

---

## Deploy dependency (Nick)

- **`email.overboardsports.com` verified in Resend** (done 2026-10-03; DKIM and return path in Route53, parlaybingo account). `PRIZE_FROM_ADDRESS` is `support@email.overboardsports.com` on every stage (`lib/config/environments.ts`, `prizeFromAddress`); the worker never falls back to any address.
- **A Resend API key in Secrets Manager** in each sending account, under the name in `environments.ts` (`resendSecretName`: `dev/OverBoardB2B/resend`, `prod/OverBoardB2B/resend`), with the key `RESEND_API_KEY`. Created by hand, like the Clerk secret. Without it the worker runs and records a readable failure for every prize; resend after the secret exists and the service has restarted.
- **If a stage is ever switched to `ses`**: the sender must be an SES-verified identity in that account and the account out of the SES sandbox. Neither AWS account has any SES identity (checked 2026-10-01).
- The API task receives `PRIZE_FULFILLMENT_QUEUE_URL` and `sqs:SendMessage` on the prize-fulfillment queue (CDK change in this slice; no manual step).

---

## Rules

1. **The prize email merges only configured data.** An unconfigured field omits its block entirely — no placeholder text, no empty section, no explanation (D-068).
2. **One renderer.** The worker's send and the admin preview call the same function; neither has a private template.
3. **`handlerId` is chosen, not typed.** New or changed values must resolve in the tenant's catalog; custom methods are offered only to their tenants.
4. **A send is claimed before it is attempted**, conditionally, per attempt. No code path sends without holding the claim.
5. **Only a `failed` row can be resent, and only at the resend count the operator saw.** Everything else is refused unchanged.
6. **Every resend request is audited before any row changes**, and the audit never contains an address.
7. **A corrected address is fan PII**: never selected by default, never on a wire, never logged, cleared when its attempt concludes and on fan deletion. A fan whose data was erased is never resent to at all.
8. **No fallback sender.** Without a configured sending address, nothing is sent and the reason is recorded.
9. **Development transports are refused in production.**
10. **The email credits the prize's "Provided by" sponsor, as snapshotted at award time**, or no sponsor at all (Wave 4; previously the prize popup's placement holder, through the one resolver). A failed sponsor lookup drops the mark, never the prize.

---

## Recorded gaps

- **Coupon-code batches** — deferred by design; seam above.
- **Bounces and complaints after acceptance** — the provider accepts a message and later bounces it; nothing feeds that back, so such a send reads `fulfilled`. Resend: a webhook endpoint for `email.bounced` / `email.complained`. SES: a configuration set + SNS → worker path.
- **Sending-domain authentication** — Nick-gated; see "Deploy dependency".
- ~~**Sponsor logo in the email**~~ — **closed 2026-09-23**: the email carries a sponsor mark. Since Wave 4 it is the prize's "Provided by" sponsor, snapshotted at award, rather than the placement where the prize was won.
- **Resend history per row** — the row keeps its count and last-resend time; the per-attempt history lives in the audit log. Wave 4 adds `PrizeRedemption.attempts[]`, written forward ([`admin-prizes.spec.md`](admin-prizes.spec.md)).
- **Provider message id** — the provider's message id is not stored on the redemption yet; bounce correlation (above) will need it, as an additive `PrizeRedemption` field requested through the shared repo at that time. Sends are tagged with tenant, redemption and attempt meanwhile.
- **Seed fixtures name non-existent methods** (`concessions-demo`, `teamstore-demo`) — they now show "Won't deliver", which is true. The fixture refresh belongs to the Games & Contests work.
- **DLQ depth** — messages that exhaust redrive still land in the SQS dead-letter queue, which nothing in-app reads; the Mongo row is the operator's view and is always written first.

## References

- PRD: [`PRIZE-01`–`PRIZE-07`, `GAME-02`, `GAME-04`, `ADM-04`, `AUTH-03`, `TEN-03`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- D-066 (scope ruling), D-068 (honesty by omission) — Overboard decision ledger
- Code: `prize-worker/src/`, `node-server/src/prize-delivery/`, `node-server/src/handlers/admin/{prize-delivery,delivery-queue,prizes}.ts`
