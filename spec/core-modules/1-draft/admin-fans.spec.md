# Core Module Spec: Admin — Fans

**Implements:** PRD `ADM-01`, `ADM-02` (read), `SEC-07` (deletion), `SEC-06` (audit, shared with Exports), `OPT-04` (consent visibility). HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13` (reverification — the enforcement mechanism is defined here and reused by Exports).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the `/fans` nav destination, the reverification list. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the tenant-targeting rule and the consent-stats vocabulary (`accepted` / `declined` / `pending`) this reuses unchanged. [`admin-exports.spec.md`](admin-exports.spec.md) — the sibling module sharing the reverification middleware and the audit log.

**Status:** Draft.

**Revised 2026-09-24** (ruling, Arthur) — "Full pages instead of drawers": the fan detail drawer is replaced by the **fan page** at `/fans/:membershipId`, with a URL a support report or a colleague can link to. The roster becomes an endless-scroll list on cursor paging ([`admin-lists.spec.md`](admin-lists.spec.md), which lands with G1's PR this wave), and its rows open the page. "The fan page" below replaces the drawer section; the endpoints gain three additive changes ("Changes for the fan page"); every rule stands, and Rules 8–10 are new.

## Overview

The Fans screen at `/fans`: the tenant's membership roster — profile fields, consent, gameplay — with contact fields masked until an operator deliberately reveals them, and the SEC-07 deletion path.

**The whole change, in one line:** a tenant's fan memberships become visible through the admin surface without exposing PII by default, and the two highest-consequence actions on them — revealing contact fields and deleting a fan's data — go behind reverification and land in an audit log.

**In scope:** the screen, three endpoints (`POST /admin/fans/search`, `GET /admin/fans/:membershipId`, `DELETE /admin/fans/:membershipId`), their contracts in `obs-b2b-shared`, the `requireReverification` route auth mode (IDN-13's enforcement), the `B2BAdminAuditLog` collection (SEC-06's store, shared with Exports), and seed fixtures that make the screen real in dev.

**Not in scope:**

- **"Export this view."** The mock puts an export button on this screen. The admin-surface nav table defines `/fans` as "`RPT-02` view, scoped — **not the export itself**", and V1 defines exactly three exports: `RPT-01`/`RPT-03` (the Exports module) and `RPT-02` (OBS Internal's `/fan-actions`). An ad-hoc roster export is none of them and would be a fourth PII release path with no PRD backing. **Spec wins over mock.**
- **The fan-actions export and event-level activity** (`RPT-02`) — OBS Internal's `/fan-actions`, its own module. This screen shows membership state, not event streams.
- **Editing a fan's profile or consents.** Consent is recorded from the fan, through the gate (`OPT-04`); an admin writing a fan's consent would forge the audit record. No such endpoint exists or should.
- **Full account erasure across tenants and providers.** SEC-07's propagation to analytics tools, the email provider, and the fan Clerk instance — see "Deletion semantics" for the exact V1 boundary and the recorded gap.
- **Tenant write access** — nothing on this screen was affected by the 2026-09-16 ruling that gave tenant admins write access elsewhere. Deletion is named in that ruling as one of the exclusions that stays OBS-only, permanently (see below); the rest of this screen has no config writes to grant.

---

## The screen

`/fans`, per Nick's 2026-09-14 mock. Same scope shape as every workspace screen: the tenant being acted on comes from the console-wide sidebar switcher, and OBS with nothing chosen gets the "Pick a tenant" state, which sets that same selection; an OBS request names the tenant explicitly as `?tenant=<slug>`; a non-obs user's URL never carries the parameter.

**The table.** One row per membership: display name with masked email beneath, joined date, one chip per active opt-in (accepted / declined / pending at the current `textVersion` — the same three states, computed by the same rules, as the Fields & Opt-ins stats, so the two screens can never disagree about a fan), profile completeness (Complete, or Missing N against the tenant's current required fields), boards played, prizes won with failed deliveries called out. Search (name or email) plus two filters: opt-in state per opt-in, and missing-required-field.

*Revised 2026-09-24:* the table is an **endless-scroll list** (`InfiniteTable`, [`admin-lists.spec.md`](admin-lists.spec.md)): search and filters across the top, the server's total for the current search and filters as the count ("3,860 fans", "12 match"), and more rows loading as the reader nears the bottom, with no page numbers and no "load more" button. It pages by cursor, newest joined first, and the search still travels in the POST body. **A row opens the fan page** (`/fans/:membershipId`); the row is a link, so it also opens in a new tab. Returning from the page restores the list's search, filters and scroll position from in-memory history state, never from the URL (Rule 1).

**Search is a POST.** A name or email fragment is PII and never belongs in a URL, a browser history, or an access log — the search endpoint takes its query in the request body, and the screen never reflects it into the query string. The only query parameter on this surface is the OBS caller's `?tenant=<slug>`, which is not PII.

**Masked by default.** Contact fields — email, phone, address, birthday — arrive masked from the server (`m•••••@gmail.com`); masking is not a UI affordance the client could skip. The banner above the table says, in plain product words: contact fields are masked; revealing them requires reverification and is written to the audit log. *(Revised 2026-09-22 — the mock's wording carried the spec id and "fan PII" onto the screen; admin-surface's Plain product language principle keeps both off it. The requirement — masking, reverification, audit — is unchanged.)*

**Reveal contact fields** re-runs the current view with `reveal: true`, which the server honours only within the reverification window, and writes one audit entry (operator, tenant, row count). Revealed state is page state: it does not survive navigation, and each new page of results under reveal is its own audited request. Reveal is available to tenant callers too — a team user holds `org:reports:read` and receives these same fans' contact fields in their sponsor exports; what reveal adds is the step-up and the audit trail, not a new grant.

**The fan page** (revised 2026-09-24; replaces the drawer). Selecting a row opens `/fans/:membershipId`, specified in full under "The fan page" below: profile fields (contact masked unless revealed), opt-ins with the wording version each answer was given on and the full consent history, contests and boards, and prizes with their delivery status. Consent history is append-only truth from the gate; the page labels a record made against an older text version as such rather than pretending it answers the current wording.

**Deletion** lives in the fan page's danger zone, OBS-only, behind a typed confirmation (the fan's display name) *and* reverification. Non-obs callers — tenant `org:admin` included — do not see the control. It did not become visible to tenant admins when the rest of the console did: the 2026-09-16 ruling names fan-data deletion as one of its explicit exclusions.

**The same table for everyone** otherwise — this screen has no config writes at all, so every caller sees the same roster; the differences are exactly two: which tenant's roster is shown (OBS follows the console-wide selection; a non-obs caller has only their own) and the deletion control (OBS). The fan page adds a third staff-only control, the fan's activity export.

---

## The fan page (`/fans/:membershipId`)

A full page inside the console shell. `:membershipId` is the membership id, which is not PII and is what support reports already carry, so a report can link straight to the fan. The tenant comes from the console-wide selection as on the roster; a membership of any other tenant, or one that no longer exists, answers the "not found" state below (Rule 4's 404, rendered).

**1. Header.** Back link "Fans" (to the roster, restored as the reader left it). Eyebrow "Fan". H1 the display name. Under it, the email (masked unless revealed) and "Joined Sep 3, 2026". A status chip with the roster's own vocabulary: "Complete", or "Missing 2 fields" when the fan's stored answers don't satisfy the tenant's current required fields — the same computation as the roster's profile column, so the two never disagree. Right-aligned: **"Reveal contact fields"** (every caller; reverified and audited, see "Changes for the fan page"), "Tell Overboard" (the existing report drawer, carrying the membership id), and for staff an overflow menu with **"Export this fan's activity"**.

**2. Profile.** The tenant's sign-up fields in their configured order, each as label and answer. Contact fields (email, phone, address, birthday) are masked until revealed. A required field with no stored answer reads "Not answered" beside a "Required" chip; an optional one with no answer is left out. Fields the fan answered that the tenant has since removed are not shown (they are not part of the tenant's gate any more).

**3. Opt-ins.** One row per opt-in the tenant currently has:

| Column | Content |
|---|---|
| Opt-in | The opt-in's label, with its kind ("Terms", "Sponsor: Acme") |
| Answer | "Accepted", "Declined", or "Not answered yet" |
| Wording | "Version 3", and "Current" when that is the version live now, or "Earlier wording" when the tenant has published a newer one since |
| When | The date of that answer |

A row answered on the current version offers "Show wording", which expands the current consent text in place. An answer given on an earlier version shows no wording: the platform keeps the version number the fan agreed to, not the superseded text (recorded gap). Beneath the table, **"Consent history"** expands the fan's full append-only record, newest first: each entry's opt-in, decision, version and date, including answers to opt-ins the tenant has since removed.

**4. Contests & boards.** A table, newest board first:

| Column | Content |
|---|---|
| Contest | The contest name, a link to that contest's page (`/contests/:id`) |
| Board | "In progress" or "Settled" |
| Bingos | The board's completed lines, 0–8 |
| Joined | When the board was created |

Empty: "No boards yet."

**5. Prizes.** A table, newest first: When, Contest, Prize (the tier's type icon and name as promised to the fan, from the award's snapshot), Delivery ("Queued", "Sent", "Failed"). A failed row shows its reason beneath to staff (the Game day precedent) and to tenant users in the Prize deliveries categories' plain words. Above the table, the link **"See in Prize deliveries"** opens Prize deliveries filtered to this fan (`?fan=<membershipId>`), where sends are resent. Empty: "No prizes yet."

**6. Danger zone** (staff only). A card outlined in the status red with **"Delete fan"** and the line "Removes this fan's boards, answers and membership in {tenant}. Prize records are kept without their name." It opens a centred dialog: title "Delete {displayName}?", the counts about to be removed ("3 boards · 2 prize records anonymized"), "This can't be undone.", a field "Type {displayName} to confirm", and "Delete fan" enabled only on an exact match. Confirming runs reverification, then `DELETE /admin/fans/:membershipId` (see "Deletion semantics"). On success the console returns to the roster with the inline line "Deleted {displayName}."

**"Export this fan's activity"** (staff only) runs the fan-actions export narrowed to this membership (see "Changes for the fan page"), reverified, and downloads `fan-actions_<slug>_<membershipId>_<YYYY-MM-DD>.csv`: identifiers, event kinds and times, exactly the columns of `/fan-actions` ([`admin-obs-internal.spec.md`](admin-obs-internal.spec.md)). It carries no contact fields, so it releases nothing the platform-wide export does not.

### States

| State | What the page shows |
|---|---|
| **Loading** | Back link, a skeleton header, skeleton rows in each section |
| **Not found** | "This fan isn't in this workspace." and "Back to Fans". Covers a membership of another tenant, a deleted fan, and a mistyped id alike; the page never says which. |
| **Error** | The console's load-failure card, "This fan didn't load.", with "Try again" and Tell Overboard |
| **Revealed** | Contact values unmasked, and a quiet line under the header: "Contact fields are showing. They hide again when you leave this page." |

### Permissions

Every resolved admin scope reads the page (tenant `org:admin`, `org:member`, staff): it is the tenant's own data, and a member sees exactly what an admin sees, because the page has no config writes. Reveal is open to every scope through reverification and the audit log, as on the roster. **Delete fan** and **Export this fan's activity** are staff only, enforced server-side; a tenant user's page does not draw them.

### Copy

| Where | String |
|---|---|
| Header | "Fans" (back), "Fan" (eyebrow), "Joined {date}", "Complete", "Missing {n} fields", "Reveal contact fields", "Tell Overboard", "Export this fan's activity" |
| Profile | "Profile", "Not answered", "Required" |
| Opt-ins | "Opt-ins", "Accepted", "Declined", "Not answered yet", "Version {n}", "Current", "Earlier wording", "Show wording", "Consent history" |
| Contests & boards | "Contests & boards", "In progress", "Settled", "No boards yet." |
| Prizes | "Prizes", "Queued", "Sent", "Failed", "See in Prize deliveries", "No prizes yet." |
| Danger zone | "Danger zone", "Delete fan", "Removes this fan's boards, answers and membership in {tenant}. Prize records are kept without their name." |
| Delete dialog | "Delete {displayName}?", "This can't be undone.", "Type {displayName} to confirm", "Delete fan", "Cancel", "Nothing was deleted." (reverification cancelled), then on Fans "Deleted {displayName}." |
| States | "This fan isn't in this workspace.", "Back to Fans", "This fan didn't load.", "Try again", "Contact fields are showing. They hide again when you leave this page." |

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` (admin-surface Rule 1). Contracts in `obs-b2b-shared/src/api/admin/fans.ts`, composed from the existing `B2BFanMembership` / `ConsentRecord` shapes.

| Method | Path | Auth | Who |
|---|---|---|---|
| POST | `/admin/fans/search` | `requireAdmin` (+ reverification when `reveal: true`) | Any resolved admin scope |
| GET | `/admin/fans/:membershipId` | `requireAdmin` | Any resolved admin scope |
| DELETE | `/admin/fans/:membershipId` | `requireAdmin` + reverification + obs staff | OBS only, permanently |

**Tenant targeting** is the established rule unchanged: non-obs callers are scoped to their own org and 403 on any `?tenant=`; obs staff must send `?tenant=<slug>` (400 without, 404 unknown or reserved), whatever organization they have active.

**`:membershipId` is verified against the resolved tenant** — the games spec's `:contestId` rule, same reasoning: the handler re-reads the membership and answers **404** when its `organizationId` is not the target tenant's, never 403, so a cross-tenant probe learns nothing.

**`POST /admin/fans/search` takes** `{ query?, optIn?: { optInId, state }, missingField?, page?, pageSize?, reveal? }` and returns the page plus `total` (after filters) and `memberCount` (the tenant's whole roster — the mock's "3,860 memberships"). Pagination is `page`/`pageSize` (default 25, max 100) — the platform's first paginated contract; page/size over cursors because the screen is a browsable roster, not an infinite feed. Rows carry the mock's columns; per-opt-in state is computed with the same entry-gate helpers as the config stats. This is the platform's precedent that **list endpoints whose filters contain PII are POST**.

*Superseded 2026-09-24 by [`admin-lists.spec.md`](admin-lists.spec.md): the roster pages by cursor (body `cursor` and `limit`, newest joined first, the total for the current search and filters beside it), because the ruling makes every growing list an endless scroll. The "page/size over cursors" reasoning above was written for a browsable paged roster the console no longer has. Everything else in this paragraph stands.*

**`GET /admin/fans/:membershipId` returns** the fan page's detail (the drawer's, before 2026-09-24) — and always masked. Reveal exists only on the search path: one endpoint whose unmasked mode is reverification-gated and audited is a checkable boundary; two would be two.

**`DELETE /admin/fans/:membershipId`** — see below.

### Changes for the fan page (2026-09-24)

All additive; nothing an existing client sends changes meaning.

- **`GET /admin/fans/:membershipId`** gains, beside today's totals: `boards[]` — `{ boardId, contestId, contestName, settled, bingos, createdAt }`, newest first; `prizes[]` — `{ redemptionId, contestId, contestName, prizeName, prizeType?, status, failureReason?, awardedAt }`, newest first, where `prizeName` and `prizeType` come from the award's snapshot of its tier and `failureReason` is present for staff callers only (tenant callers get the Prize deliveries category instead); and per current opt-in `{ optInId, label, kind, currentTextVersion, answer?: { decision, textVersion, agreedAt } }` beside the existing `consentHistory[]`. One fan's records are tens at most, so these arrive whole, not paged.
- **`POST /admin/fans/search`** accepts an optional `membershipId` in the body, narrowing the result to that one membership. This is how the fan page reveals: it re-runs the search for its own fan with `reveal: true`, under the same reverification and the same `fan_pii_reveal` audit entry (row count 1). Reveal stays on one endpoint (Rule 2), and the page gains it without a second unmasked path.
- **`POST /admin/fan-actions/export`** accepts an optional `membershipId` in the body, with `?tenant=` then required: the export narrowed to one fan. Same reverification, same identifier-only columns, same `RPT-05` exclusion, same `fan_actions_export` audit action with the membership id in `detail`. It is the existing internal export (`RPT-02`) narrowed, not the "Export this view" roster export this spec rejects: it adds no PII and no new recipient.

**Masking is server-side** (`maskEmail`, `maskPhone`, and full masking for address and birthday, in `util/admin-fans.ts`): first character plus domain for emails, last two digits for phones. The default response contains no unmasked contact PII, so a logged response body or a misbehaving client cannot leak what was never sent.

---

## Reverification (IDN-13) — the enforcement, shared with Exports

The admin-surface spec names the actions; this section defines the mechanism both modules use.

**Backend enforces; the UI merely cooperates.** A new route auth mode `requireReverification` (in `route_config.ts`'s `RouteAuth` union, applied after `resolveAdminScope`) reads the session token's `fva` claim — `[firstFactorAgeMinutes, secondFactorAgeMinutes]` — and requires a first-factor verification within **10 minutes** (the admin-surface spec's window, Clerk's maximum). First factor, deliberately: instance-wide MFA (`SEC-08`) governs sign-in, and Clerk itself downgrades a second-factor demand for users without one enrolled, so a second-factor recency check would be theatre in exactly the environments where it matters least. Stale, missing, or malformed `fva` all **fail closed**.

**The refusal is Clerk's own wire shape** — HTTP 403 with `{ clerk_error: { type: "forbidden", reason: "reverification-error", metadata: { reverification: { level: "first_factor", afterMinutes: 10 } } } }` (verified against `@clerk/shared` 3.47.x, the version both apps resolve) — because that is the hint `useReverification` detects. The frontend wraps each protected action in `useReverification`; Clerk opens its credential prompt, and on success the original request is retried with a fresh `fva`. A cancelled prompt rejects with `reverification_cancelled` and the screen treats it as "nothing happened".

**The enforcement flag.** `ADMIN_REVERIFICATION_ENFORCED` — **enforced unless explicitly set to `"false"`**, and every request through a disabled check logs `[admin] reverification enforcement disabled`. The flag exists because `fva` only appears in session tokens once the instance has session reverification available; if the dashboard-side state ever fails to deliver the claim, the alternative to a flag is silently-dead PII endpoints or a silently-open one. Both paths are tested; the flag is an operational escape hatch, not a design option. **It must never ship set to `"false"`.**

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

Reads: every resolved admin scope — `ADM-01`'s shared-screen model; the roster is the tenant's own data, and a team user seeing their own fans is the product. Reveal: every resolved admin scope, but only through reverification and the audit log (see above — the grant already exists via `org:reports:read`; the gate adds accountability, not access). Deletion: OBS only, structurally and permanently; `requirePermission` remains the upgrade path if a dedicated permission is ever provisioned, per the fields spec's reasoning — a different enforcement mechanism for the same boundary, never a wider one. The fan page's activity export (2026-09-24) is OBS only for the reason every fan-actions export is: it is `org:fan_data:export`, which never appears on a tenant role (admin-surface Rule 2).

---

## Rules

1. **No PII in URLs** — search text travels in POST bodies; list endpoints with PII-bearing filters are POST. The only query parameter is the verified OBS `?tenant=`.
2. **Contact fields leave the server masked unless the request passed reverification with `reveal: true`** — masking is enforcement, not presentation.
3. **Every reveal, export, and deletion writes an audit entry; deletion writes it first or does not happen.**
4. **`:membershipId` is verified against the resolved tenant; mismatch is 404**, never 403.
5. **Deletion is obs-only and reverification-gated**, and the UI adds typed confirmation on top — three independent gates for one irreversible action.
6. **No endpoint edits a fan's consents or profile** on this surface.
7. **The audit log contains no PII.**
8. **The fan page's URL carries the membership id and nothing else** (2026-09-24). No name, email or search text reaches a URL; returning to the roster restores its search from history state, not from the address.
9. **A membership the target tenant does not own renders the same "not found" as a deleted one** (2026-09-24). Rule 4's 404, drawn without saying which case it is.
10. **The fan activity export and raw failure reasons are staff only, enforced server-side** (2026-09-24). A tenant caller's detail read carries no `failureReason`, and a tenant caller naming `membershipId` on the fan-actions export is refused like any other non-staff call.

---

## Known gaps (recorded, not blocking)

- **SEC-07 propagation**: deletion does not yet reach the fan Clerk instance (the auth record survives; the fan could sign in again and would appear as a brand-new join), nor analytics or the email provider — no such integrations exist in the B2B stack yet to propagate *to*. The endpoint is the platform-side half; the propagation half needs the integrations first.
- **`SEC-05`**: consent records still lack IP and consent method (pre-existing, flagged by the fields spec) — the drawer shows what exists.
- **In-memory listing**: search/filter loads the tenant's memberships and filters in process — the same precedent as `computeConfigStats`, fine at V1 tenant sizes; an aggregation pipeline is the scale path.
- **No rate limiting on search** (`SEC-08` names it for sensitive endpoints) — platform-wide concern, not solved per-module.
- **Superseded consent wording is not kept.** A consent record stores the `textVersion` the fan agreed to, and the opt-in stores only its current text, so the fan page can show the wording for current-version answers only. Showing what a fan agreed to under an earlier version needs a text archive per `(optInId, textVersion)`, written at publish; the Fields & Opt-ins publish path is where it belongs.
- **The prize snapshot is G2's.** The fan page's prize names read the award's snapshot of its tier; until G2's snapshot lands, the detail read shows the tier as it is now (today's behaviour), which can differ from what the fan was promised if the tier was edited after the award.

## References

- PRD: [`ADM-01`, `ADM-02`, `OPT-04`, `RPT-02`, `SEC-05`–`SEC-08`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-13`
- [`admin-surface.spec.md`](admin-surface.spec.md) — reverification list, nav table ("`RPT-02` view, scoped — not the export itself")
- [`admin-exports.spec.md`](admin-exports.spec.md) — the sibling consumer of reverification and the audit log
- [`admin-lists.spec.md`](admin-lists.spec.md) — endless scroll and cursor paging for the roster (2026-09-24)
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the fan-actions export the fan page narrows
- [`admin-tenant-page.spec.md`](admin-tenant-page.spec.md) — the other drawer that became a page on 2026-09-24
- Mock: `mocks/admin-console/Fans.png` (workspace) — layout source; "Export this view" deliberately not implemented
