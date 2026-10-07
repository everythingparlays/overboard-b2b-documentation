# Core Module Spec: Admin — Fans

**Implements:** PRD `ADM-01`, `ADM-02` (read), `SEC-07` (deletion), `SEC-06` (audit, shared with Exports), `OPT-04` (consent visibility). HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13` (the step-up this spec once defined is ruled out, 2026-09-28).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the `/fans` nav destination, "No re-authentication". [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the tenant-targeting rule and the consent-stats vocabulary (`accepted` / `declined` / `pending`) this reuses unchanged. [`admin-exports.spec.md`](admin-exports.spec.md) — the sibling module sharing the reverification middleware and the audit log.

**Status:** Draft. **Revised 2026-09-27 (Wave 4):** opt-in categories are gone, every published version's wording and documents are stored, and each fan's answers are kept per version, so the fan page shows the wording (and documents) of any answer given since that change ([`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), revision 2026-09-27).

**Revised 2026-09-29** (Arthur's Walk #3 rulings) — **fans are named by display name**, never by first and last name: the roster, its search, the fan page and every other console screen that names a fan use the display name the fan chose at the gate, and the real name shows only once contact information is revealed. **Last name and ZIP join the hidden contact fields**, masked on the server until the audited reveal. **The fan page shows everything the fan gave at join**: the display name, the email, every sign-up answer under the tenant's label, and answers to fields the tenant has since stopped asking. Seeded fans carry handle-style display names, and a backfill names any fan without one ("Dev fixtures" below).

**Revised 2026-09-28** (Arthur's Wave 4 walkthrough ruling) — **no re-authentication**: revealing contact fields, deleting a fan and exporting a fan's activity no longer ask for credentials. Reveal is audited; deletion keeps the typed display name, checked server-side, and writes its audit entry first. The `requireReverification` mode and the `ADMIN_REVERIFICATION_ENFORCED` flag are gone; "Reverification" below becomes "No step-up". On a fan's page, staff read a failed prize in the same plain words as the workspace.

**Revised 2026-09-24** (ruling, Arthur) — "Full pages instead of drawers": the fan detail drawer is replaced by the **fan page** at `/fans/:membershipId`, with a URL a support report or a colleague can link to. The roster becomes an endless-scroll list on cursor paging ([`admin-lists.spec.md`](admin-lists.spec.md), which lands with G1's PR this wave), and its rows open the page. "The fan page" below replaces the drawer section; the endpoints gain three additive changes ("Changes for the fan page"); every rule stands, and Rules 8–10 are new.

## Overview

The Fans screen at `/fans`: the tenant's membership roster — profile fields, consent, gameplay — with contact fields masked until an operator deliberately reveals them, and the SEC-07 deletion path.

**The whole change, in one line:** a tenant's fan memberships become visible through the admin surface without exposing PII by default, and the two highest-consequence actions on them — revealing contact fields and deleting a fan's data — land in an audit log, deletion behind a typed confirmation.

**In scope:** the screen, three endpoints (`POST /admin/fans/search`, `GET /admin/fans/:membershipId`, `DELETE /admin/fans/:membershipId`), their contracts in `obs-b2b-shared`, the `B2BAdminAuditLog` collection (SEC-06's store, shared with Exports), and seed fixtures that make the screen real in dev.

**Not in scope:**

- **"Export this view."** The mock puts an export button on this screen. The admin-surface nav table defines `/fans` as "`RPT-02` view, scoped — **not the export itself**", and V1 defines exactly three exports: `RPT-01`/`RPT-03` (the Exports module) and `RPT-02` (OBS Internal's `/fan-actions`). An ad-hoc roster export is none of them and would be a fourth PII release path with no PRD backing. **Spec wins over mock.**
- **The fan-actions export and event-level activity** (`RPT-02`) — OBS Internal's `/fan-actions`, its own module. This screen shows membership state, not event streams.
- **Editing a fan's profile or consents.** Consent is recorded from the fan, through the gate (`OPT-04`); an admin writing a fan's consent would forge the audit record. No such endpoint exists or should.
- **Full account erasure across tenants and providers.** SEC-07's propagation to analytics tools, the email provider, and the fan Clerk instance — see "Deletion semantics" for the exact V1 boundary and the recorded gap.
- **Tenant write access** — nothing on this screen was affected by the 2026-09-16 ruling that gave tenant admins write access elsewhere. Deletion is named in that ruling as one of the exclusions that stays OBS-only, permanently (see below); the rest of this screen has no config writes to grant.

---

## The screen

`/fans`, per Nick's 2026-09-14 mock. Same scope shape as every workspace screen: the tenant being acted on comes from the console-wide sidebar switcher, and OBS with nothing chosen gets the "Pick a tenant" state, which sets that same selection; an OBS request names the tenant explicitly as `?tenant=<slug>`; a non-obs user's URL never carries the parameter.

**The table.** One row per membership: display name (the one the fan chose at the gate — never their first and last name; a membership without one reads "No display name") with masked email beneath, joined date, one chip per active opt-in (accepted / declined / pending at the current `textVersion` — the same three states, computed by the same rules, as the Fields & Opt-ins stats, so the two screens can never disagree about a fan), profile completeness (Complete, or Missing N against the tenant's current required fields), boards played, prizes won with failed deliveries called out. Search (display name or email) plus two filters: opt-in state per opt-in, and missing-required-field.

*Revised 2026-09-24:* the table is an **endless-scroll list** (`InfiniteTable`, [`admin-lists.spec.md`](admin-lists.spec.md)): search and filters across the top, the server's total for the current search and filters as the count ("3,860 fans", "12 match"), and more rows loading as the reader nears the bottom, with no page numbers and no "load more" button. It pages by cursor, newest joined first, and the search still travels in the POST body. **A row opens the fan page** (`/fans/:membershipId`); the row is a link, so it also opens in a new tab. Returning from the page restores the list's search, filters and scroll position from in-memory history state, never from the URL (Rule 1).

**Search is a POST.** A name or email fragment is PII and never belongs in a URL, a browser history, or an access log — the search endpoint takes its query in the request body, and the screen never reflects it into the query string. The only query parameter on this surface is the OBS caller's `?tenant=<slug>`, which is not PII.

**Masked by default.** Contact fields — email, last name, phone, birthday, ZIP, address — arrive masked from the server (`m•••••@gmail.com`); masking is not a UI affordance the client could skip. The banner above the table says, in plain product words: contact fields are masked; revealing them is written to the audit log. *(Revised 2026-09-22 — the mock's wording carried the spec id and "fan PII" onto the screen; admin-surface's Plain product language principle keeps both off it. The requirement — masking, audit — is unchanged; since 2026-09-28 there is no reverification.)*

**Reveal contact fields** re-runs the current view with `reveal: true` and writes one audit entry (operator, tenant, row count). Revealed state is page state: it does not survive navigation, and each new page of results under reveal is its own audited request. Reveal is for Overboard staff and the tenant's admins (`org:admin`) only (revised 2026-10-03): a tenant member sees the masked roster, the bar reads "Contact fields are masked. Only an admin can reveal them." with no button, and the server refuses a member's `reveal: true` with 403 "Only an admin can see fans' contact details." and writes no audit entry. A paused tenant's admins keep it, since a reveal is a read. Staff in the Member view see the member's screen.

**The fan page** (revised 2026-09-24; replaces the drawer). Selecting a row opens `/fans/:membershipId`, specified in full under "The fan page" below: profile fields (contact masked unless revealed), opt-ins with the wording version each answer was given on and the full consent history, contests and boards, and prizes with their delivery status. Consent history is append-only truth from the gate; the page labels a record made against an older text version as such rather than pretending it answers the current wording.

**Deletion** lives in the fan page's danger zone, OBS-only, behind a typed confirmation (the fan's display name), checked again on the server. Non-obs callers — tenant `org:admin` included — do not see the control. It did not become visible to tenant admins when the rest of the console did: the 2026-09-16 ruling names fan-data deletion as one of its explicit exclusions.

**The same table for everyone** otherwise — this screen has no config writes at all, so every caller sees the same roster; the differences are exactly two: which tenant's roster is shown (OBS follows the console-wide selection; a non-obs caller has only their own) and the deletion control (OBS). The fan page adds a third staff-only control, the fan's activity export.

---

## The fan page (`/fans/:membershipId`)

A full page inside the console shell. `:membershipId` is the membership id, which is not PII and is what support reports already carry, so a report can link straight to the fan. The tenant comes from the console-wide selection as on the roster; a membership of any other tenant, or one that no longer exists, answers the "not found" state below (Rule 4's 404, rendered).

**1. Header.** Back link "Fans" (to the roster, restored as the reader left it). Eyebrow "Fan". H1 the display name. Under it, the email (masked unless revealed) and "Joined Sep 3, 2026". A status chip with the roster's own vocabulary: "Complete", or "Missing 2 fields" when the fan's stored answers don't satisfy the tenant's current required fields — the same computation as the roster's profile column, so the two never disagree. Right-aligned: **"Reveal contact fields"** (staff and tenant admins only; audited, see "Changes for the fan page"), "Tell Overboard" (the existing report drawer, carrying the membership id), and for staff an overflow menu with **"Export this fan's activity"**.

**2. Profile.** Everything the fan gave at join (revised 2026-09-29): the **display name** they chose, their **email**, then the tenant's sign-up fields in their configured order, each as label and answer, then any answers the fan gave to fields the tenant has since stopped asking, each marked "No longer asked" (still the fan's information, so still shown; labelled with the platform's name for a well-known field, else the field's id). Contact fields (email, last name, phone, birthday, ZIP, address) are masked until revealed, each with a lock mark ("Hidden until contact fields are revealed"). A required field with no stored answer reads "Not answered" beside a "Required" chip; an optional one with no answer is left out. The opt-ins card (3) carries each consent answer with its wording version and date.

**Which fields are contact information.** Fields are tenant-configurable, so contact fields are identified by the field's **stable id**, never its label (shared `isContactFieldId`, `entry-gate/fields.ts`): the well-known `lastName`, `phone`, `birthday`, `zip` and `address`, and any id for the same datum — a field re-keyed after a type change (`zip-text`), a de-duplicated custom field (`zip-2`), or one slugged from its label (`last-name`, `zip-code`, `postal-code`, `mobile-number`, `date-of-birth`). The rule errs towards hiding. First name stays visible: the console names fans by display name, and a first name alone identifies nobody.

**3. Opt-ins.** One row per opt-in the tenant currently has:

| Column | Content |
|---|---|
| Opt-in | The opt-in's label, with "Data sharing · Acme" beneath when it is linked to a sponsor (there are no categories since 2026-09-27) |
| Answer | "Accepted", "Declined", or "Not answered yet" |
| Wording | "Version 3", and "Current" when that is the version live now, or "Earlier wording" when the tenant has published a newer one since |
| When | The date of that answer |

A row offers "Show wording", which expands, in place, the checkbox text of the version that answer was given on, and the titles of that version's linked documents, each opening the document as it read then (`GET /admin/config/consent-versions/:optInId?version=`). Since 2026-09-27 every published version is stored, so this works for earlier versions too; an answer given on a version published before that change and since replaced has no stored wording, and the row simply offers no "Show wording". Beneath the table, **"Consent history"** expands the fan's append-only record (`consentHistory`, kept per version since 2026-09-27; before that only the latest answer per opt-in survived), newest first: each entry's opt-in, decision, version and date, including answers to opt-ins the tenant has since removed.

**4. Contests & boards.** A table, newest board first:

| Column | Content |
|---|---|
| Contest | The contest name, a link to that contest's page (`/contests/:id`) |
| Board | "In progress" or "Settled" |
| Bingos | The board's completed lines, 0–8 |
| Joined | When the board was created |

Empty: "No boards yet."

**5. Prizes.** A table, newest first: When, Contest, Prize (the tier's type icon and name as promised to the fan, from the award's snapshot), Delivery ("Queued", "Sent", "Failed"). A failed row shows its reason beneath in the Prize deliveries categories' plain words, to everyone — staff included (revised 2026-09-28: the worker's raw text is no longer shown). Above the table, the link **"See in Prize deliveries"** opens Prize deliveries filtered to this fan (`?fan=<membershipId>`), where sends are resent. Empty: "No prizes yet."

**6. Danger zone** (staff only). A card outlined in the status red with **"Delete fan"** and the line "Removes this fan's boards, answers and membership in {tenant}. Prize records are kept without their name." It opens a centred dialog: title "Delete {displayName}?", the counts about to be removed ("3 boards · 2 prize records anonymized"), "This can't be undone.", a field "Type {displayName} to confirm", and "Delete fan" enabled only on an exact match. Confirming runs `DELETE /admin/fans/:membershipId` (see "Deletion semantics"). On success the console returns to the roster with the inline line "Deleted {displayName}."

**"Export this fan's activity"** (staff only) runs the fan-actions export narrowed to this membership (see "Changes for the fan page"), audited, and downloads `fan-actions_<slug>_<membershipId>_<YYYY-MM-DD>.csv`: identifiers, event kinds and times, exactly the columns of `/fan-actions` ([`admin-obs-internal.spec.md`](admin-obs-internal.spec.md)). It carries no contact fields, so it releases nothing the platform-wide export does not.

### States

| State | What the page shows |
|---|---|
| **Loading** | Back link, a skeleton header, skeleton rows in each section |
| **Not found** | "This fan isn't in this workspace." and "Back to Fans". Covers a membership of another tenant, a deleted fan, and a mistyped id alike; the page never says which. |
| **Error** | The console's load-failure card, "This fan didn't load.", with "Try again" and Tell Overboard |
| **Revealed** | Contact values unmasked, and a quiet line under the header: "Contact fields are showing. They hide again when you leave this page." |

### Permissions

Every resolved admin scope reads the page (tenant `org:admin`, `org:member`, staff): it is the tenant's own data, and a member sees exactly what an admin sees, because the page has no config writes. Reveal is open to every scope through the audit log, as on the roster. **Delete fan** and **Export this fan's activity** are staff only, enforced server-side; a tenant user's page does not draw them.

### Copy

| Where | String |
|---|---|
| Header | "Fans" (back), "Fan" (eyebrow), "Joined {date}", "Complete", "Missing {n} fields", "Reveal contact fields", "Tell Overboard", "Export this fan's activity" |
| Profile | "Profile", "Display name", "No display name", "Email", "Not answered", "Required", "No longer asked", "Hidden until contact fields are revealed" |
| Opt-ins | "Opt-ins", "Accepted", "Declined", "Not answered yet", "Version {n}", "Current", "Earlier wording", "Show wording", "Consent history" |
| Contests & boards | "Contests & boards", "In progress", "Settled", "No boards yet." |
| Prizes | "Prizes", "Queued", "Sent", "Failed", "See in Prize deliveries", "No prizes yet." |
| Danger zone | "Danger zone", "Delete fan", "Removes this fan's boards, answers and membership in {tenant}. Prize records are kept without their name." |
| Delete dialog | "Delete {displayName}?", "This can't be undone.", "Type {displayName} to confirm", "Delete fan", "Cancel", then on Fans "Deleted {displayName}." |
| States | "This fan isn't in this workspace.", "Back to Fans", "This fan didn't load.", "Try again", "Contact fields are showing. They hide again when you leave this page." |

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` (admin-surface Rule 1). Contracts in `obs-b2b-shared/src/api/admin/fans.ts`, composed from the existing `B2BFanMembership` / `ConsentRecord` shapes.

| Method | Path | Auth | Who |
|---|---|---|---|
| POST | `/admin/fans/search` | `requireAdmin` (`reveal: true` audited) | Any resolved admin scope; `reveal: true` only staff or the tenant's `org:admin` (403 otherwise) |
| GET | `/admin/fans/:membershipId` | `requireAdmin` | Any resolved admin scope |
| DELETE | `/admin/fans/:membershipId` | `requireAdmin` + obs staff + typed display name | OBS only, permanently |

**Tenant targeting** is the established rule unchanged: non-obs callers are scoped to their own org and 403 on any `?tenant=`; obs staff must send `?tenant=<slug>` (400 without, 404 unknown or reserved), whatever organization they have active.

**`:membershipId` is verified against the resolved tenant** — the games spec's `:contestId` rule, same reasoning: the handler re-reads the membership and answers **404** when its `organizationId` is not the target tenant's, never 403, so a cross-tenant probe learns nothing.

**`POST /admin/fans/search` takes** `{ query?, optIn?: { optInId, state }, missingField?, page?, pageSize?, reveal? }` and returns the page plus `total` (after filters) and `memberCount` (the tenant's whole roster — the mock's "3,860 memberships"). Pagination is `page`/`pageSize` (default 25, max 100) — the platform's first paginated contract; page/size over cursors because the screen is a browsable roster, not an infinite feed. Rows carry the mock's columns; per-opt-in state is computed with the same entry-gate helpers as the config stats. This is the platform's precedent that **list endpoints whose filters contain PII are POST**.

*Superseded 2026-09-24 by [`admin-lists.spec.md`](admin-lists.spec.md): the roster pages by cursor (body `cursor` and `limit`, newest joined first, the total for the current search and filters beside it), because the ruling makes every growing list an endless scroll. The "page/size over cursors" reasoning above was written for a browsable paged roster the console no longer has. Everything else in this paragraph stands.*

**`GET /admin/fans/:membershipId` returns** the fan page's detail (the drawer's, before 2026-09-24) — and always masked. Reveal exists only on the search path: one endpoint whose unmasked mode is audited is a checkable boundary; two would be two.

**`DELETE /admin/fans/:membershipId`** — see below.

### Changes for the fan page (2026-09-24)

All additive; nothing an existing client sends changes meaning.

- **`GET /admin/fans/:membershipId`** gains, beside today's totals: `boards[]` — `{ boardId, contestId, contestName, settled, bingos, createdAt }`, newest first; `prizes[]` — `{ redemptionId, contestId, contestName, prizeName, prizeType?, status, failureReason?, awardedAt }`, newest first, where `prizeName` and `prizeType` come from the award's snapshot of its tier and `failureReason` is present for staff callers only (tenant callers get the Prize deliveries category instead); and per current opt-in `{ optInId, label, sponsorName?, currentTextVersion, answer?: { decision, textVersion, agreedAt, wordingStored: boolean } }` beside the existing `consentHistory[]`, which since 2026-09-27 reads the membership's stored `consentHistory` (falling back to `consents` for a membership written before it) rather than rebuilding it from `consents`, where earlier answers were overwritten. `kind` is retired. One fan's records are tens at most, so these arrive whole, not paged.
- **`POST /admin/fans/search`** accepts an optional `membershipId` in the body, narrowing the result to that one membership. This is how the fan page reveals: it re-runs the search for its own fan with `reveal: true`, under the same `fan_pii_reveal` audit entry (row count 1). Reveal stays on one endpoint (Rule 2), and the page gains it without a second unmasked path.
- **`POST /admin/fan-actions/export`** accepts an optional `membershipId` in the body, with `?tenant=` then required: the export narrowed to one fan. Same identifier-only columns, same `RPT-05` exclusion, same `fan_actions_export` audit action with the membership id in `detail`. It is the existing internal export (`RPT-02`) narrowed, not the "Export this view" roster export this spec rejects: it adds no PII and no new recipient.

**Masking is server-side** (`maskEmail`, `maskPhone`, and full masking for every other contact field — last name, birthday, ZIP, address — in `util/admin-fans.ts`, by the shared `isContactFieldId`): first character plus domain for emails, last two digits for phones. The default response contains no unmasked contact PII, so a logged response body or a misbehaving client cannot leak what was never sent.

**Profile rows (2026-09-29, additive).** The fan page's `profileFields[]` and the one-fan search row's `profileFields[]` are built by one function (`fanProfileRows`): the fields asked today in render order, then answers to fields no longer asked. Each row may carry `label` (the tenant's, else the platform's, else the id), `collected` (false for a field no longer asked) and `contact` (hidden until reveal). Reserved ids are never shown as answers.

---

## No step-up (revised 2026-09-28)

This section once defined the `IDN-13` reverification mechanism that Exports reused. Arthur's Wave 4 walkthrough ruling removes it for everybody: no route checks the session's verification age, no refusal carries Clerk's `reverification-error` hint, and the console wraps no action in `useReverification`. The route auth mode and the `ADMIN_REVERIFICATION_ENFORCED` flag are deleted. What remains on this surface is masking (server-side), the audit log (below), OBS-only deletion and its typed display name, checked on the server.

## The audit log (SEC-06) — shared with Exports

A new `B2BAdminAuditLog` collection (`obs-b2b-shared/src/models/admin-audit.ts`): `actorUserId`, `actorOrgSlug`, `action` (`fan_pii_reveal` | `fan_delete` | `fan_export` | `usage_export`), `organizationId`, `detail` (row counts, target ids, export parameters), `createdAt`, indexed `{ organizationId, createdAt }`. **`detail` never contains PII** — membership ids, opt-in ids, and counts, not names or emails; the audit log must be safe to read at a lower privilege than the data it describes. Writes are fire-and-forget from the handler's perspective in reads (a reveal must not fail because the audit write hiccupped — it is logged loudly instead) but **deletion refuses to proceed if its audit entry cannot be written first**: an irreversible action with no record is worse than a delayed one.

The Exports module's "Recent exports" table reads this collection — the export record and the audit record are the same row, so they cannot drift apart.

---

## Deletion semantics (SEC-07)

`DELETE /admin/fans/:membershipId` erases what the platform holds about this fan **within the target tenant**:

1. **Audit first** — `fan_delete` entry with the membership id and the counts about to be removed; refusal to write is refusal to delete.
2. **Boards deleted** — every `B2BBoard` of the fan's `clerkUserId` whose `contestId` belongs to the tenant.
3. **Redemptions anonymized, not deleted** — `userId` is rewritten to `deleted_<redemptionId>` (unique by construction, so the compound index holds). A redemption is the record that a prize was sent, with cost and sender-reputation consequences (`PRIZE-06`); RPT-05's own principle is that departed fans may still count in aggregates "where nothing identifies them". Deleting the rows would silently rewrite delivery statistics; anonymizing keeps the count and severs the identity.
4. **The membership deleted** — profile fields and consent records go with the document. Consent records are the one deliberate exception to "consent history is never deleted" (`OPT-04`): an erasure request is the fan revoking the basis for keeping the record, and SEC-07 postdates and outranks the retention default.
5. **The identity, if orphaned** — when this was the fan's last membership on any tenant, the `B2BFan` document (cached email) is deleted too. The Clerk fan-instance user is **not** deleted here — recorded gap below.

**OBS-only, permanently.** The 2026-09-16 ruling that gave tenant admins write access across Workspace and Configuration excludes this explicitly, and the admin-surface spec records it as a named boundary rather than a permission row (it has no `org:*` permission of its own). The test is the admin-surface spec's own — "whose mistake does it become": deletion is an irreversible PII lifecycle action, legally consequential, and the party executing an erasure obligation end-to-end is the platform operator. This is `org:fan_data:export`'s sibling, not `org:tenant_config:manage`'s, and it did not move when that one did. Enforced structurally on user-level obs staff-ness, with its own message.

**Idempotent in effect:** deleting an already-deleted membership is 404 — nothing about the fan remains to confirm.

---

## Permissions

Reads: every resolved admin scope — `ADM-01`'s shared-screen model; the roster is the tenant's own data, and a team user seeing their own fans is the product. Reveal: every resolved admin scope, always through the audit log (the grant already exists via `org:reports:read`; the log adds accountability, not access). Deletion: OBS only, structurally and permanently; `requirePermission` remains the upgrade path if a dedicated permission is ever provisioned, per the fields spec's reasoning — a different enforcement mechanism for the same boundary, never a wider one. The fan page's activity export (2026-09-24) is OBS only for the reason every fan-actions export is: it is `org:fan_data:export`, which never appears on a tenant role (admin-surface Rule 2).

---

## Rules

1. **No PII in URLs** — search text travels in POST bodies; list endpoints with PII-bearing filters are POST. The only query parameter is the verified OBS `?tenant=`.
2. **Contact fields leave the server masked unless the request asked for `reveal: true`**, and every such request is audited — masking is enforcement, not presentation.
3. **Every reveal, export, and deletion writes an audit entry; deletion writes it first or does not happen.**
4. **`:membershipId` is verified against the resolved tenant; mismatch is 404**, never 403.
5. **Deletion is obs-only and takes the fan's typed display name, checked on the server**, and its audit entry is written first — independent gates for one irreversible action.
6. **No endpoint edits a fan's consents or profile** on this surface.
7. **The audit log contains no PII.**
8. **The fan page's URL carries the membership id and nothing else** (2026-09-24). No name, email or search text reaches a URL; returning to the roster restores its search from history state, not from the address.
9. **A membership the target tenant does not own renders the same "not found" as a deleted one** (2026-09-24). Rule 4's 404, drawn without saying which case it is.
10. **The fan activity export is staff only, enforced server-side** (2026-09-24), and the page draws no raw failure reason for anyone (2026-09-28). A tenant caller's detail read carries no `failureReason`, and a tenant caller naming `membershipId` on the fan-actions export is refused like any other non-staff call.

---

## Dev fixtures (2026-09-29)

- **Seeded fans have display names.** `seed-test-tenant.mjs` gives every seed fan a handle-style display name ("MalQ_BearDown", "AdaLovesHoops") separate from the first and last name fields, plus a last name and ZIP where the tenant asks them. One seed fan keeps no ZIP on purpose: it is the missing-required-field filter's subject. Re-running the script converges existing seed fans.
- **Backfill.** `scripts/backfill-fan-display-names.mjs` (dry run by default, `test` by default, `--tenant <slug>`, `--apply` writes) names any membership whose display name is missing or blank: the fan's first name (or "Fan") plus a number from the membership id, never the hidden last name, never a name another member of the tenant already uses. Each write is conditional on the name still being blank. The plan is `scripts/lib/display-name-backfill-plan.cjs`, with its own tests.

---

## Known gaps (recorded, not blocking)

- **SEC-07 propagation**: deletion does not yet reach the fan Clerk instance (the auth record survives; the fan could sign in again and would appear as a brand-new join), nor analytics or the email provider — no such integrations exist in the B2B stack yet to propagate *to*. The endpoint is the platform-side half; the propagation half needs the integrations first.
- **`SEC-05`**: consent records written since 2026-10-07 carry `ipAddress` and `method`; the fan page does not display either (the address is PII with no operator use on this screen). Records from before that date carry neither.
- **In-memory listing**: search/filter loads the tenant's memberships and filters in process — the same precedent as `computeConfigStats`, fine at V1 tenant sizes; an aggregation pipeline is the scale path.
- **No rate limiting on search** (`SEC-08` names it for sensitive endpoints) — platform-wide concern, not solved per-module.
- ~~**Superseded consent wording is not kept.**~~ **Closed 2026-09-27**: every published version's wording and documents are stored at publish (`consent_versions`), and each fan's answers per version (`consentHistory`). Versions replaced before that change stay unrecoverable.
- **The prize snapshot is G2's.** The fan page's prize names read the award's snapshot of its tier; until G2's snapshot lands, the detail read shows the tier as it is now (today's behaviour), which can differ from what the fan was promised if the tier was edited after the award.

## References

- PRD: [`ADM-01`, `ADM-02`, `OPT-04`, `RPT-02`, `SEC-05`–`SEC-08`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-13` (ruled out 2026-09-28)
- [`admin-surface.spec.md`](admin-surface.spec.md) — "No re-authentication", nav table ("`RPT-02` view, scoped — not the export itself")
- [`admin-exports.spec.md`](admin-exports.spec.md) — the sibling consumer of the audit log
- [`admin-lists.spec.md`](admin-lists.spec.md) — endless scroll and cursor paging for the roster (2026-09-24)
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the fan-actions export the fan page narrows
- [`admin-tenant-page.spec.md`](admin-tenant-page.spec.md) — the other drawer that became a page on 2026-09-24
- Mock: `mocks/admin-console/Fans.png` (workspace) — layout source; "Export this view" deliberately not implemented
