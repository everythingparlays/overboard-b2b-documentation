# Core Module Spec: Admin — OBS Internal

**Implements:** PRD `OBS-01`–`OBS-05`, `PRIZE-03`, `PRIZE-06`, `PRIZE-07`, `RPT-02`, `RPT-05`, `TEN-03`, `TEN-05`, `TEN-C3`, `SEC-06`, `ADM-06`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13`.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — the whole access framework: `resolveAdminScope`, the OBS Internal nav section, the reserved-slug rule (Rule 7), the slug-equals-subdomain rule (Rule 4), and the reverification list. [`admin-exports.spec.md`](admin-exports.spec.md) — the in-envelope CSV pattern and the audit-row-is-the-export-record principle. [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md) — derived contest status (`getB2BContestStatus`) and delivery-stat arithmetic.

**Status:** Draft.

**Revised 2026-09-22** (ruling, Arthur) — customer-visible gap narration is removed from these screens under the **Honesty by omission, not by narration** principle in [`admin-surface.spec.md`](admin-surface.spec.md). The Platform health gap card naming `OBS-01`–`OBS-03`, the delivery queue's "—" for a missing `failureReason`, and its on-screen "visibility-only" note all go; the gaps themselves stay recorded here. Never-fabricate is unchanged.

## Overview

The operator-facing section of the admin console: the four OBS Internal screens the nav has carried as placeholders — All tenants (`/tenants`), Platform health (`/platform-health`), Delivery queue (`/delivery-queue`), Fan actions (`/fan-actions`) — plus the two actions that only OBS may ever perform: **tenant provisioning** (`TEN-05`) and **contest finalization** (`PRIZE-03`, `ADM-06`).

**The whole change, in one line:** everything cross-tenant and everything irreversible, on four obs-only screens, with the same server-side boundary as everywhere else.

**In scope:** the four screens; six endpoints (`GET /admin/tenants/directory`, `POST /admin/tenants`, `GET /admin/platform-health`, `GET /admin/delivery-queue`, `POST /admin/fan-actions/export`, `POST /admin/contests/:contestId/finalize`); contracts in `obs-b2b-shared/src/api/admin/{tenants,platform-health,delivery-queue,fan-actions,finalize}.ts`; three additive shared-model changes (`ADMIN_AUDIT_ACTIONS` entries, optional `B2BAdminAuditEntry.organizationId`, `PrizeRedemption.failureReason`, `B2BContest.finalizedAt`); the prize-worker writing `failureReason` on failure; seed fixtures for the delivery queue; and a dev teardown script for provisioned tenants.

**Not in scope:**

- **An error-tracking service.** `OBS-01`–`OBS-03` need error events with tenant attribution and alerting; nothing in the stack collects them. The Platform health screen renders no error-rate tile and no note about one — neither an invented number nor an explanation of its absence. Recorded gap (superseded 2026-09-22 by the omission principle in [`admin-surface.spec.md`](admin-surface.spec.md); this previously required the screen to say so on its face).
- ~~**Retry or resend of failed prize sends.**~~ *Now in scope — superseded 2026-09-23 by [`prize-delivery.spec.md`](prize-delivery.spec.md) "Resend": the Delivery queue resends failed sends, singly or in bulk, optionally to a corrected address, reverification-gated and audited (`prize_resend`). This previously shipped the screen visibility-only, because no resend mechanism existed and a button with nothing behind it would have lied.*
- **Coupon-code batches.** `PRIZE-05`/`PRIZE-06` code tracking has no model (the games/prizes spec already records the missing sponsor model); the queue cannot show code exhaustion. Recorded gap.
- **Deferred prize sends on finalization.** The PRD itself scopes this out: finalization "is what will trigger deferred prize sends **when PRIZE-02 is built**". V1 finalization persists the state and the audit record — it dispatches nothing, and fakes nothing. Recorded gap.
- ~~**Tenant offboarding.** Deleting a production tenant is a legal-and-data question, not a screen.~~ **Superseded 2026-09-15 (ruling, Arthur):** offboarding *is* a screen — suspend, rename, and delete ship as the tenant lifecycle module, with delete behind reverification and a server-checked typed confirmation. See [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md); the dev script survives as developer tooling only.

---

## The cross-tenant read pattern

Admin-surface Rule 1 — no handler takes a tenant identifier — has carried one exception so far: the OBS `?tenant=` argument, resolved by `resolveTargetTenant`. Three of these endpoints are the *other* legitimate shape: genuinely cross-tenant reads (`/tenants/directory`, `/platform-health`, `/delivery-queue`) where there is no tenant to name because the answer spans all of them. They follow the `GET /admin/tenants` precedent: no tenant parameter at all, and a structural refusal — **the caller is not obs staff → 403 `"OBS staff only"`** — before anything else runs.

**The predicate is user-level** since the 2026-09-16 ruling: obs staff-ness is resolved from the user's membership in the `obs` Clerk organization, not from which organization they happen to have active (admin-surface, "OBS-ness is user-level"). An operator who has switched into a tenant org to do tenant work reaches every one of these endpoints unchanged — which is the point, since the alternative was an operator who stopped being an operator by navigating. The refusal, its shape, and everything it protects are identical; only what the gate asks changed.

Structural, not permission-based, for the reason recorded across the merged modules (D-058): the admin Clerk instance defines no custom permissions yet, so `has({permission})` would refuse everyone, OBS included. `requirePermission("org:fan_data:export")` / `("org:contest:finalize")` remain the upgrade path once the instance defines them; the refusal message and the boundary do not change when that lands.

The fan-actions export blends the two shapes: `?tenant=` **narrows** an already-obs-only export, rather than selecting a scope. Omitting it does not mean "my tenant" — even an operator with a tenant org active is running the platform-wide export unless they narrow it — it means every tenant.

---

## All tenants and provisioning (`/tenants`)

The directory read (`GET /admin/tenants/directory`) returns every tenant with the numbers an operator triages by — fans, contests with derived status, players and per-contest delivery counts, failed sends, config footprint — in one response. A contest's players are its board count, one board per fan per contest — the number Games & Contests shows, read with one aggregate across every contest; the stored `numberParticipants` is never incremented and is not read ([`admin-contests.spec.md`](admin-contests.spec.md), Rule 4). The drill-in reads "N players". The existing `GET /admin/tenants` chooser read stays deliberately names-only; the five scoped screens keep using it.

### Create tenant (`POST /admin/tenants`)

This implements the provisioning tier admin-surface assigns to OBS staff: *creates the tenant's Clerk organization and invites its first admin*. The server does all of it — Clerk Backend API with the admin secret key, then the `B2BOrganization` record — because Rule 4 (slug = `subdomain`, **both-or-neither**) is only enforceable where both writes happen in one place.

Order and failure handling:

1. **Validate.** The contract refuses malformed subdomains and `admin`/`obs` (`TEN-C3`); the handler re-checks both defensively (Rule 7's "checked at onboarding" clause). A duplicate `subdomain` is 409 before anything external happens.
2. **Clerk organization first.** It is the resource with an external owner; if it cannot be created there is nothing to clean up. Failure → 409 with Clerk's reason.
3. **Database record second.** If this fails, the handler deletes the just-created Clerk organization and reports the rollback; if the cleanup itself fails, the response names the orphaned Clerk org id so the operator can remove it by hand — a loud partial failure, never a silent mismatch.
4. **Invitation last, non-fatal.** The first admin is invited as `org:admin`, which since 2026-09-16 carries both invite/remove power and write access to their own organization's configuration — the team configures its workspace from day one, per the provisioning table. An invitation failure does not unwind the tenant (both-or-neither already holds); the response carries `invitation.status: "failed"` and the reason, and OBS re-invites from the Clerk dashboard.
5. **Audit.** `tenant_create` (`SEC-06` register: who, when, what), detail carrying ids and the invitation status — never the invitee's email.

**The subdomain is immutable once created.** It is simultaneously the Clerk org slug, the fan-app hostname, and the admin scope key; renaming any one strands the other two (the Team spec's argument, now load-bearing here). The form says so before submission. The *display name* is a label, not a key, and is renameable through the lifecycle module ([`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md), 2026-09-15) — Clerk and the record together, never the subdomain.

**This flow supersedes the org-switcher path.** Until now the only way a tenant org came to exist was someone using Clerk's own "Create organization" widget — the path admin-surface Rule 8 requires disabling. With `POST /admin/tenants` shipped, the widget path is superseded, and disabling self-creation on the admin instance (a Clerk dashboard toggle, still open as of 2026-09-15) loses its last excuse. The console's own sidebar switcher carries a **Create organization** entry for obs staff only, and it routes here rather than to Clerk's widget — one provisioning path, reachable from where an operator would look for it, and the only one that keeps the record and the Clerk org a synced pair (admin-surface Rule 10).

`TEN-03`'s budget: this reduces OBS's per-tenant engineering share of onboarding to one form — name, subdomain, auth variant, first admin — well inside the 1–2 hours, with config following through the existing screens.

### Contest finalization (`POST /admin/contests/:contestId/finalize`)

Finalization lives here, on the tenant drill-in, and not on Overview or its own nav entry. The argument: the mock's Overview "Finalize contest" button assumed tenant authority the PRD has since refused (`PRIZE-03`: OBS staff only), so it cannot sit on a screen tenant users see; the Delivery queue is failure triage, not contest lifecycle; and a fifth nav destination for one button is navigation for its own sake. The operator's real path — pick the tenant, see its contests, finish one — is exactly the `/tenants` drill-in.

Guardrails, all three of the platform's strongest, together for the first time:

- **Obs-only, structural**, refused before tenant resolution so a tenant caller learns nothing else.
- **Reverification** (`IDN-13`): the route joins the `requireAdminReverified` allow-list — irreversible, per the admin-surface list.
- **Typed confirmation, server-checked**: the body carries `confirmName`, which must equal the contest's exact name. The form gates the button on the same match, but the server check is the one that counts — a scripted call cannot skip it.

Semantics: 404 for a contest the named tenant does not own (the standard probe answer), 409 when already finalized, and the audit write (`contest_finalize`, blocking — the `fan_delete` precedent) happens **before** the state write: if the record cannot be made, nothing is finalized. The write sets `finalized: true` and `finalizedAt`; derived status flips to Finished platform-wide, which closes joining and marks the contest finished for fans. No send is dispatched — see Not-in-scope.

---

## Platform health (`/platform-health`)

`OBS-04` asks whether a tenant's app is healthy before and during a game; `OBS-05` asks that prize failures surface in the same view. The screen ships what the database genuinely answers: per tenant — fans, contests, enabled games in the next 24 hours, whether a game is live now, failed and pending sends, and the most recent board (the closest recorded signal to "the app is being used"). Failed-send counts read the same rows as `/delivery-queue` — one source, two screens, no drift.

What it does not ship: error rates. **The screen renders nothing at all in their place** — no tile, no gap card, no mention of `OBS-01`–`OBS-03`. Fabricating a number on a health dashboard is the most dangerous fabrication on the platform, and it stays forbidden; but the honest alternative is the absence itself, not a card explaining the absence. An error-rate tile appears on this screen when there is an error-tracking substrate behind it, and not before. Of §14.2's four acceptance criteria, only the prize-failure one is met; the other three need that substrate. Recorded gap — here, which is the only place it belongs.

*Superseded 2026-09-22 by the "Honesty by omission, not by narration" principle in [`admin-surface.spec.md`](admin-surface.spec.md) (Rule 13): this previously required an explicit on-screen gap card naming `OBS-01`–`OBS-03`. The card is deleted from the UI; the gap is recorded in this spec instead.*

Two adjacent facts, recorded with it: the SQS dead-letter queues and their ≥1-message alarms exist in CDK, but no alert recipient is configured (`dlqAlertPhoneNumber` unset in every environment), and DLQ depth is visible only in AWS — the app surfaces Mongo `failed` rows, not queue depth.

---

## Delivery queue (`/delivery-queue`)

`PRIZE-07`'s reviewable failure surface, platform-wide because failed sends degrade sender reputation for every tenant (`PRIZE-06`'s rationale). One read: totals by redemption status, plus the failed rows newest-first — tenant, fan (display name only; `/fans` owns contact fields), contest, prize, and **why**.

"Why" is new: `PrizeRedemption.failureReason`, written by the prize-worker at the moment it marks a row failed (contest missing, unknown handler, or the fulfillment error itself). Rows that failed before the field existed have no reason to show, so **the cell is empty — no "—", no "reason not recorded", no footnote about the field being forward-only**. The row is still true: it names a failed send, and says nothing it cannot say. The seed fixtures give the demo tenant two failed sends with realistic reasons so the screen is real in dev.

*Superseded 2026-09-22 by the omission principle in [`admin-surface.spec.md`](admin-surface.spec.md) (Rule 13): this previously required legacy rows to render an "—" placeholder. A dash is a caption saying "we don't have this", which is narration; the empty cell says the same thing without claiming the screen owes the reader an explanation.*

**Resend** (superseded 2026-09-23 by [`prize-delivery.spec.md`](prize-delivery.spec.md)): each failed row carries a Resend action — to the fan's account email or, for one row at a time, a corrected address — and rows can be selected for a bulk resend. A resent row stays on the list reading "Resending" until the worker reports back. The action is OBS-only, reverification-gated, audited before it changes anything, and conditional on the row's resend count, so it cannot send one prize twice. (This screen was previously visibility-only, and before 2026-09-22 was required to say so on screen.)

---

## Fan actions (`/fan-actions`)

`RPT-02`'s internal event-level export, for OBS product analysis, never shared with teams or sponsors — the one route whose obs-only boundary is a PRD acceptance criterion (§11.2). `POST /admin/fan-actions/export`, reverification-gated (`IDN-13`: behavioral data tied to identifiable accounts), returning the CSV in the envelope like every export — nothing persisted, no PII or token in any URL.

Two deliberate narrowings:

- **Identifiers only.** Columns are platform ids (tenant slug, membership id, contest id), event kind, timestamp, and a small detail field. No names, emails, or profile fields: product analysis does not need them, and an export that never carries contact PII cannot leak it.
- **Recorded events only.** `joined`, `board_created`, `prize_fulfilled`, `prize_failed` — the events the platform can reconstruct from stored data. The PRD's tile interactions, near-misses and session activity have no telemetry behind them. Recorded gap.

`RPT-05`, applied internally: a fan standing declined on any of the tenant's sponsor data-share opt-ins is excluded from identified rows even in this internal export, and counted in `filteredOutCount`. Unanswered is not declined — the export is not sponsor-directed, and the blocking ToS every member accepted covers platform analysis; the exclusion honors the declared preference, not a consent the export doesn't require.

Audited as `fan_actions_export` (`SEC-06`). A cross-tenant run has no single target tenant, which is why `B2BAdminAuditEntry.organizationId` became optional: absent means platform-scoped, and `detail` names the tenants covered. The alternative — one audit row per tenant for one action — would make the log lie about how many actions happened.

---

## Endpoints

All six authorize on **user-level obs staff-ness**, whatever organization the caller has active.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/tenants/directory` | requireAdmin | obs staff only (403 otherwise) |
| POST | `/admin/tenants` | requireAdmin | obs staff only |
| GET | `/admin/platform-health` | requireAdmin | obs staff only |
| GET | `/admin/delivery-queue` | requireAdmin | obs staff only |
| POST | `/admin/delivery-queue/resend` | requireAdminReverified | obs staff only (see [`prize-delivery.spec.md`](prize-delivery.spec.md)) |
| POST | `/admin/fan-actions/export` | requireAdminReverified | obs staff only |
| POST | `/admin/contests/:contestId/finalize` | requireAdminReverified | obs staff only, `?tenant=` required |

**`GET /admin/tenants/directory` returns** every tenant with `fanCount`, config counts, `failedSendCount`, and `contests[]` (derived status, `finalized`, game/tier counts, players — the board count, carried in the `numberParticipants` wire field — and per-status delivery counts).

**`POST /admin/tenants` takes** `{ subdomain, name, authVariant?, firstAdminEmail }` and returns 201 `{ tenant, clerkOrganizationId, invitation: { email, role: "org:admin", status: "sent"|"failed", message? } }`; 400 malformed/reserved, 409 duplicate or Clerk refusal, 500 with rollback (or the orphaned org id) on partial failure.

**`GET /admin/platform-health` returns** platform totals plus per-tenant `{ fanCount, contestCount, gamesNext24h, liveNow, failedSends, pendingSends, lastBoardAt }`.

**`GET /admin/delivery-queue` returns** status totals plus failed rows `{ tenant, contest, prizeName, fan: { membershipId, displayName }, failureReason, failedAt }`, newest first, capped at 100 with a `truncated` flag.

**`POST /admin/fan-actions/export` takes** optional `?tenant=` and returns `{ filename, rowCount, filteredOutCount, tenants, csv }`; 403 with the reverification hint when stale.

**`POST /admin/contests/:contestId/finalize` takes** `?tenant=` and `{ confirmName }` and returns `{ contest: { finalized: true, finalizedAt }, delivery }`; 400 name mismatch, 404 unknown/unowned contest, 409 already finalized, 500 (nothing finalized) when the audit write fails.

## Permissions

All six are obs-only, on user-level obs staff-ness. On the future Clerk-permission model: the export maps to `org:fan_data:export`, finalization to `org:contest:finalize` (both barred from tenant roles by admin-surface Rules 2 and 9), the rest to the cross-tenant read grant `obs` membership stands for. Until those permissions exist on the instance, the gate is structural (D-058) and the tests pin it. The 2026-09-16 ruling that opened Workspace and Configuration to tenant admins left all six untouched by name: OBS Internal is one of its explicit exclusions.

## Rules

1. **Every OBS Internal endpoint refuses a caller who is not obs staff with 403 before doing anything else** — the check is on the user, not the active organization. Hiding the nav section is UX; this is the boundary.
2. **The Clerk organization and the `B2BOrganization` record are created both-or-neither.** Partial failure rolls back or reports the orphan loudly; it never returns success.
3. **`admin` and `obs` are refused at provisioning** — in the contract for the polite error, in the handler for the boundary (`TEN-C3`).
4. **The subdomain is immutable once created.** Nothing renames a tenant org's slug or its record's subdomain; the display name alone may change, both systems together, through the lifecycle module (2026-09-15).
5. **Finalization is reverification-gated, server-side name-confirmed, and audited before the write.** No audit row, no finalization.
6. **Finalization dispatches no sends** until `PRIZE-02` exists. It persists state; it never fakes delivery.
7. **The fan-actions export carries platform identifiers only** — no contact fields — and excludes declined fans (`RPT-05`) from identified rows.
8. **The delivery queue and every failure count elsewhere read the same redemption rows.** One source; screens may not disagree.
9. **A platform-scoped audit row omits `organizationId` and names its tenants in `detail`.** One action, one row.
10. **These screens never narrate what they cannot show** (ruling 2026-09-22, admin-surface Rule 13). No gap card, no placeholder dash, no "manual in V1" note, no rendered `OBS-*` id. A metric with no honest source renders no tile; a missing control is simply not drawn. Every such gap is recorded under "Known gaps" below — that is where an operator's question gets answered, not the screen.

## Known gaps (recorded, not blocking)

- **Error tracking (`OBS-01`–`OBS-03`)**: no error-capture substrate exists in either repo; per-tenant error rates, spike alerting and PII-stripped capture all need it. Platform health ships neither a number nor a gap card — the tile is simply absent until the substrate exists (superseded 2026-09-22 by the omission principle in [`admin-surface.spec.md`](admin-surface.spec.md); the gap card is deleted). Three of §14.2's four criteria are unmet.
- **Alert recipient**: the DLQ CloudWatch alarms publish to SNS with no subscriber (`dlqAlertPhoneNumber` unset). `OBS-03`'s "defined recipient" does not exist yet.
- **SQS DLQ depth**: not surfaced in-app; the queue screen reads Mongo `failed` rows, which is the durable superset but not the queue itself.
- ~~**Retry/resend (`PRIZE-07` second half)**~~: closed 2026-09-23 — see [`prize-delivery.spec.md`](prize-delivery.spec.md) "Resend".
- **Coupon-code batches (`PRIZE-05`/`PRIZE-06`)**: no model; exhaustion and duplicate-assignment tracking cannot be shown. Deferred deliberately; seam in [`prize-delivery.spec.md`](prize-delivery.spec.md) "Codes".
- **Deferred sends on finalize (`PRIZE-02`)**: unbuilt; finalization is state + audit only.
- **Fan-actions telemetry**: tile interactions, near-misses, session activity unrecorded; export limited to join/board/prize events.
- **`failureReason` is forward-only**: rows failed before the worker change have no reason, and their cell renders empty — no "—" and no explanatory caption (superseded 2026-09-22 by the omission principle in [`admin-surface.spec.md`](admin-surface.spec.md)).
- **Clerk org self-creation is still enabled** on the admin instance (admin-surface Rule 8, observed violated 2026-09-15); the dashboard toggle remains an operator to-do this flow now supersedes.
- **Three tenants violate the synced-pair invariant** (admin-surface Rule 10): `warriors` and `fightinghawks` have records with no Clerk organization, and `bears` has a self-created Clerk org that is not the pair of its record. Reconciling them is queued as its own task; `POST /admin/tenants` is what stops the list growing.

## References

- PRD: [`OBS-01`–`OBS-05`, `PRIZE-03`, `PRIZE-05`–`PRIZE-07`, `RPT-02`, `RPT-05`, `TEN-03`, `TEN-05`, `TEN-C3`, `SEC-06`, `ADM-06`](../../../documents/PRD/OBS_B2B_Platform_PRD.md) — §14.2 and §11.2's obs-only criteria are this module's test list.
- [`admin-surface.spec.md`](admin-surface.spec.md) — the access framework, provisioning ladder, Rules 4/7/8, and the reverification list.
- [`admin-overview.spec.md`](admin-overview.spec.md) — the Workspace half of this slice.
- Mocks: `mocks/admin-console/` carries no OBS Internal screens — only the nav section on `Overview.png`. These four screens follow the console idiom; where this spec and a future mock disagree, spec wins until re-argued.
