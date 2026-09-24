# Core Module Spec: Prize Delivery

**Implements:** PRD `PRIZE-01`, `PRIZE-04`, `PRIZE-05`, `PRIZE-06` (the assignment half — see "Codes"), `PRIZE-07`, `ADM-04` (the handler selection half), `AUTH-03` (email as the delivery channel), `GAME-02` (the tier fields a winner is told about). Ruling D-066: **OBS owns the notification and the assignment guarantee; sponsors own the value and its redemption.**

**Depends on:** [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — the Prizes screen, tier storage and the tier write. [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the Delivery queue screen. [`admin-surface.spec.md`](admin-surface.spec.md) — scope resolution, reverification, and the **Honesty by omission** and **Fan's-eye view** principles, both of which this spec leans on hard. [`../../infra/environments.spec.md`](../../infra/environments.spec.md) — where the sending address is configured per stage.

**Supersedes:** the "visibility-only" posture of the Delivery queue (admin-obs-internal, Not in scope + Known gaps); the free-text `handlerId` field on the Prizes screen (admin-games-and-prizes, `/prizes`); and the per-handler hardcoded HTML templates in `prize-worker/src/email_templates/`.

**Status:** Draft, written 2026-09-23 with the build (Slice 3 of the 2026-09-23 wave). No open questions.

---

## Overview

When a fan completes a bingo line, the board-evaluator puts a message on the prize-fulfillment queue, and the prize worker delivers the prize for that bingo count. Until this spec, the only working delivery path sent every tenant's fans the same hardcoded Nike / "Hawk Bingo" email, from a staff member's personal address, telling them to use a discount code nothing generated. The in-game prize popup was honest; the email was not.

**The whole change, in one line:** the prize email becomes a real, tenant-branded message built only from what the tenant configured, sent through a delivery-method registry the Prizes screen picks from, with at-most-once sends and an audited, operator-driven resend for anything that fails.

**In scope:**

1. The **standard prize email** — one templated email, rendered per tier from the tier's own fields and the tenant's branding, with a tenant-configured sender name, reply-to and subject.
2. The **delivery-method registry** (`handlerId`) — a catalog of methods the Prizes screen offers as a dropdown, scoped per tenant; the standard email for everyone, developer-built custom methods for the tenants they were built for (`PRIZE-05`).
3. **Resend** — failed sends go back on the queue from the Delivery queue, singly or in bulk, optionally to a corrected address, audited, and structurally unable to double-send.
4. **At-most-once delivery** in the worker — attempt claiming, interruption detection, bounded handler time.
5. The Prizes screen's **per-contest view**, its **bingo ladder** (which bingo counts pay what, and which pay nothing), the tier drawer's delivery-method dropdown and live email preview, and the **Prize email** settings.
6. A **local delivery loop** for development: a file queue and a file outbox, so the whole path runs on a laptop with no SQS and no SES.

**Not in scope:**

- **Coupon-code batches** (`PRIZE-05`/`PRIZE-06`'s batch half) — deliberately deferred until the first real sponsor's shape is known. The seam is specified below ("Codes").
- **Sending-domain authentication** (SPF, DKIM, DMARC, a verified `prizes@` identity). Nick-gated. Everything here is built to work on the current SES identity and to switch domains with one config value. See "Deploy dependency".
- **Bounce and complaint processing** (SES notifications feeding back into `PrizeRedemption`). Recorded gap — today a bounce after SES accepted the message is invisible to us.
- **Deferred end-of-game delivery** (`PRIZE-02`). Unchanged: finalization still dispatches nothing.
- **Tenant-uploaded HTML templates.** `PRIZE-04` makes templates developer work; a tenant never uploads markup.

---

## Where `PRIZE-04` and D-066 meet

`PRIZE-04` says "one HTML template per prize … template creation and upload is performed by developers". Read literally, every new prize would need an engineer — which contradicts `GAME-04` ("which prizes attach to a game must never require a code change") and `TEN-03` (≤1–2 engineering hours per tenant). D-066 settled the product question: OBS's job is to notify and to guarantee assignment; the sponsor's value lives in the tier's own fields.

So the resolution is: **one developer-built template, parameterised by the tier.** The standard email *is* the developer-made template `PRIZE-04` asks for; what varies per prize is data the admin surface already collects. A sponsor whose mechanics genuinely need their own markup or logic gets a **custom method** — developer code, registered in the catalog, offered only to their tenant — which is exactly the `PRIZE-05` exception, kept intact as the escape hatch.

---

## The standard prize email

### What it merges — and the omission rule

The email is built from real, configured data only. **Anything unconfigured is omitted — never placeholdered, never apologised for** (D-068). There is no "N/A", no "See details", no empty heading above a missing section.

| Block | Source | When absent |
|---|---|---|
| Sender name | `organization.prizeEmail.fromName` | the tenant's `name` |
| Reply-To | `organization.prizeEmail.replyTo` | no Reply-To header |
| Subject | `organization.prizeEmail.subject`, `{prize}` → prize name | `You won: {prize}` |
| Header mark | `branding.assets.logo` (http/https only) | the tenant's name as a wordmark |
| Accent color | `branding.theme.colors.primary` | the platform default accent |
| Kicker + headline | "You won" + `prizeName` | — (both required) |
| Bingo line | `tierIndex + 1` — "You hit 2 bingos." | — (always known) |
| Prize image | `prizeImageUrl` (http/https only) | no image block |
| Description | `prizeDescription` | — (required) |
| Details list | GAME-02 fields: approximate value, redemption window, method, location | each row omitted individually; the list omitted when all four are |
| Code | the tier's static redemption code, when the tier has one | no code block |
| How to claim | `prizeClaimInstructions` | no section |
| Button | `prizeClaimButtonLinkUrl` (http/https only) + `prizeClaimButtonText` | no button without a link; "Claim your prize" when a link has no text |
| Footer | "You're receiving this because you won a prize playing with {tenant}." | — |

The fan's name is **not** merged. Signup fields are tenant-configurable and a name may not exist; a greeting that sometimes reads "Hi ," or "Hi there" is worse than none. The email carries no tracking pixel and no link rewriting.

A URL that is not `http:` or `https:` is treated as absent (a `javascript:` or `data:` link never reaches a mail client). The tier write now refuses such URLs at the door, so the renderer's check is defence in depth.

### How it is built

- **Table layout, inline styles, 600px fluid container**, one `<style>` block for the mobile breakpoint and dark-mode hints; renders in Gmail (web and apps), Apple Mail, Outlook (Windows, with VML button fallback), Outlook.com and Yahoo.
- **Light card on a neutral ground.** The tenant's primary color is an accent (header rule, button, code border), never the page ground: email dark-mode inversion across clients is inconsistent enough that a dark-ground email is a gamble, and the accent survives inversion.
- **The brand color is measured, not trusted.** Text in the brand hue is walked darker (hue kept) until it reads at 4.5:1 on the card. The button keeps the brand's exact color whenever it is visible on the card at all (≥1.35:1 — a stadium yellow at ~1.4:1 stays the team's yellow); only near-whites are darkened. The label ink is the better of near-black and white (`onColor`), and a mid-tone brand where neither ink reaches 4.5:1 (a saturated red, a mid grey) is walked toward black until one does.
- **A plain-text part** accompanies every HTML part, with the same content and the same omissions.
- **A hidden preheader** ("{prize} from {tenant}") so inbox previews read as a sentence, not markup.
- **Every merged string is HTML-escaped**; the subject and sender name are header-encoded (RFC 2047 for non-ASCII) and cannot carry a line break — the contract refuses control characters, the renderer strips them again.
- **One renderer, two callers.** `node-server/src/prize-delivery/` holds the pure renderer (no database, no AWS). The prize worker bundles it to send; the API calls it for the admin preview. The preview therefore is the email, not a picture of it — the Fan's-eye view principle applied to a fan's inbox.

### Sender identity

A tenant configures **how the email presents itself**, not where it comes from:

- **Sender name** — what the fan's inbox shows ("UND Fighting Hawks").
- **Reply-To** — where a fan's reply goes (a team promotions inbox).
- **Subject** — free text with one optional `{prize}` placeholder. Any other brace token is refused at the contract.

The **sending address** is platform configuration (`PRIZE_FROM_ADDRESS`), identical for every tenant, because it must be on a domain Overboard has authenticated with SES. The From header is `"{sender name}" <{PRIZE_FROM_ADDRESS}>`. When `PRIZE_FROM_ADDRESS` is unset the worker **refuses to send** and records why; it no longer falls back to a staff member's personal address.

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

`handler_001` and `handler_002` (the retired Nike templates) are **aliases of `standard-email`**. Tiers stored with them — UND's in production — keep delivering, now with their own real content instead of the Nike copy, and show as "Prize email" on screen; the console writes `standard-email` the next time that tier is saved (the API accepts either, since both resolve to the same method). `email`, `email-test`, `webhook` and `barcode` (the removed stubs) are **not** aliases: they never sent anything, so there is no behavior to preserve, and a tier naming one keeps failing loudly until an operator chooses a real method.

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

## Resend

`PRIZE-07`: failed sends are "reviewable so they can be resolved or resent". The Delivery queue now resolves them.

### Endpoint

`POST /admin/delivery-queue/resend` — `requireAdminReverified`, OBS staff only (403 before anything else). Body: `{ items: [{ redemptionId, expectedResendCount }], correctedEmail? }`, 1–100 items; `correctedEmail` only with exactly one item.

For each item, one conditional write moves the row from `failed` to `pending`: **where** `_id` matches, `status` is `failed` and `resendCount` equals `expectedResendCount` (absent counts as 0); **set** `status: pending`, `resendRequestedAt`, and the corrected address if one was given; **increment** `resendCount`. Then one queue message `{ type: "prize-resend", redemptionId, attempt }` goes out, with FIFO deduplication id `resend-{redemptionId}-{attempt}`.

Refused items change nothing and come back with a plain reason: already delivered, already being resent, changed since the operator loaded the list, or not found. If the queue send fails, that row is put back to `failed` with "Couldn't be queued for resending — try again", and reported refused.

**Why this cannot double-send:** the status condition means only a `failed` row moves; the count condition means a stale screen, a double click, or a second operator is refused rather than queued twice; the deduplication id means even a retried queue send is one message; and the worker's attempt claim (above) means even a duplicated message is one send.

### Corrected address

A fan who typed a bad email can be reached at a corrected one. The address is written to `PrizeRedemption.recipientOverride` — `select: false` in the model, so no existing read returns it — used for that one attempt, and **cleared by the worker when the attempt concludes**, delivered or not. It never appears on any wire, in any log, or in the audit row. Fan deletion (`SEC-07`) clears it too. It does not change the fan's account email: identity belongs to Clerk and the fan.

### Audit

`prize_resend`, written **before** any row changes, one row per request. `organizationId` when every item belongs to one tenant; platform-scoped otherwise, with the tenants in `detail` (admin-obs-internal Rule 9). `detail`: `{ redemptionIds, count, addressCorrected }` — ids and a boolean, never the address. No audit row, no resend.

### What the queue shows

Failed rows, plus rows **being resent** (`pending` with a resend count) so an operator sees their action land: the row reads "Resending" until the worker reports back, then leaves the list or returns as failed with a fresh reason. The screen offers **Resend** per row (with the corrected-address option) and **Resend selected** for bulk. Reverification is prompted by the server's hint, as for finalization.

---

## The Prizes screen

Supersedes the `/prizes` section of admin-games-and-prizes.spec.md where they differ.

- **One contest at a time.** A switcher at the top (segmented control for up to four contests, a select beyond that), remembered per tenant for the session. Default: the most recently created contest that is not finalized, else the most recent. Every contest used to render at once, which buried the one being worked on.
- **The bingo ladder.** The contest's tiers as rungs ordered by bingo count, from 1 up to the highest tier. A count with no tier renders as a quiet "No prize" rung — the configuration truthfully drawn, so a gap between two tiers is visible as a gap rather than discovered from a fan complaint. Each rung shows the prize, its method (or **Won't deliver**), and what it has delivered.
- **Unawarded wins.** Where fans actually reached a bingo count with no tier (`skipped` redemptions), the rung carries the count ("Reached 14 times"). Counts above the top tier are shown on one line beneath the ladder. These are real numbers from `PrizeRedemption` — counted per win (per board), not per distinct fan — and nothing is estimated.
- **The tier drawer** gains the delivery-method dropdown (defaulting to the standard email), the claim button fields (previously uneditable), the GAME-02 fields and the static code when the shared model carries them, URL validation, and a **Preview email** view rendering the unsaved draft through `POST /admin/prizes/email/preview`.
- **Prize email card** (side column): sender name, reply-to and subject, each showing the real fallback as its placeholder, with the sending address shown read-only when the server knows it. A tenant `org:member` sees the values read-only (the D-059 presentation).
- **Delivery card** unchanged in meaning; "Skipped" is relabelled **"No prize at that count"** so the number explains itself.

---

## Endpoints

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/prizes/handlers` | `requireAdmin` | any resolved admin scope |
| GET | `/admin/prizes/email` | `requireAdmin` | any resolved admin scope |
| PUT | `/admin/prizes/email` | `requireAdmin` + obs staff or tenant `org:admin` | tier-editing grant |
| POST | `/admin/prizes/email/preview` | `requireAdmin` | any resolved admin scope (renders; changes nothing) |
| POST | `/admin/delivery-queue/resend` | `requireAdminReverified` | obs staff only |

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

Neither SQS nor SES is reachable from a laptop in a useful way — the dev stacks' evaluator Lambdas do not run (no `MONGODB_SECRET_ARN`) and SES in the dev account only delivers to verified addresses. So both ends of the queue and the mail transport have a file-backed development mode, **refused at startup when `NODE_ENV=production`**:

- `PRIZE_LOCAL_QUEUE_DIR` — the API writes resend messages there as JSON files instead of calling SQS; `prize-worker`'s local runner (`npm run local`) consumes that directory in place of the queue.
- `PRIZE_EMAIL_OUTBOX_DIR` — the worker writes each email as `.html`, `.txt` and a headers `.json` instead of calling SES.

The local worker authenticates to Mongo with the developer's AWS SSO session through `@aws-sdk/credential-providers` (a dev dependency, as in node-server; the deployed container uses its task role). `prize-worker/.env.example` documents the whole setup. `prize-worker/scripts/enqueue-local.mjs` drops a board-win message into the local queue, so a full win → email → failure → resend loop runs end to end against the developer's own `arthur_`-style collections.

---

## Deploy dependency (Nick)

- **`PRIZE_FROM_ADDRESS` must be an SES-verified identity** in each account. Configured per stage in `lib/config/environments.ts` (`prizeFromAddress`). The dev value remains `nick@overboardsports.com`, the only verified identity today, so dev keeps working; production has **no value** until the domain is authenticated, and the worker refuses to send rather than borrow a personal address. The target is `prizes@overboardsports.com` on a domain with SPF, DKIM and DMARC — one config change once Nick completes SES domain authentication (security checklist, "before production").
- **SES production access** (leaving the sandbox) for the prod account, so mail reaches unverified fan addresses.
- The API task now receives `PRIZE_FULFILLMENT_QUEUE_URL` and `sqs:SendMessage` on the prize-fulfillment queue (CDK change in this slice; no manual step).

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

---

## Recorded gaps

- **Coupon-code batches** — deferred by design; seam above.
- **Bounces and complaints after acceptance** — SES accepts a message and later bounces it; nothing feeds that back, so such a send reads `fulfilled`. Needs an SES configuration set + SNS → worker path, after domain authentication.
- **Sending-domain authentication and SES production access** — Nick-gated; see "Deploy dependency".
- **Sponsor logo in the email** — waits on the sponsor model (Slice 1 of the 2026-09-23 wave); the email will add a "Presented by" mark from the tier's sponsor when that link exists.
- **Resend history per row** — the row keeps its count and last-resend time; the per-attempt history lives in the audit log, not on the row.
- **Provider message id** — the SES message id is not stored on the redemption yet; bounce correlation (above) will need it, as an additive `PrizeRedemption` field requested through the shared repo at that time. Sends are tagged with tenant, redemption and attempt meanwhile.
- **Seed fixtures name non-existent methods** (`concessions-demo`, `teamstore-demo`) — they now show "Won't deliver", which is true. The fixture refresh belongs to the Games & Contests work.
- **DLQ depth** — messages that exhaust redrive still land in the SQS dead-letter queue, which nothing in-app reads; the Mongo row is the operator's view and is always written first.

## References

- PRD: [`PRIZE-01`–`PRIZE-07`, `GAME-02`, `GAME-04`, `ADM-04`, `AUTH-03`, `TEN-03`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- D-066 (scope ruling), D-068 (honesty by omission) — Overboard decision ledger
- Code: `prize-worker/src/`, `node-server/src/prize-delivery/`, `node-server/src/handlers/admin/{prize-delivery,delivery-queue,prizes}.ts`
