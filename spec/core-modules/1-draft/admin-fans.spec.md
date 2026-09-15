# Core Module Spec: Admin — Fans

**Implements:** PRD `ADM-01`, `ADM-02` (read), `SEC-07` (deletion), `SEC-06` (audit, shared with Exports), `OPT-04` (consent visibility). HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13` (reverification — the enforcement mechanism is defined here and reused by Exports).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the `/fans` nav destination, the reverification list. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the tenant-targeting rule and the consent-stats vocabulary (`accepted` / `declined` / `pending`) this reuses unchanged. [`admin-exports.spec.md`](admin-exports.spec.md) — the sibling module sharing the reverification middleware and the audit log.

**Status:** Draft.

## Overview

The Fans screen at `/fans`: the tenant's membership roster — profile fields, consent, gameplay — with contact fields masked until an operator deliberately reveals them, and the SEC-07 deletion path.

**The whole change, in one line:** a tenant's fan memberships become visible through the admin surface without exposing PII by default, and the two highest-consequence actions on them — revealing contact fields and deleting a fan's data — go behind reverification and land in an audit log.

**In scope:** the screen, three endpoints (`POST /admin/fans/search`, `GET /admin/fans/:membershipId`, `DELETE /admin/fans/:membershipId`), their contracts in `obs-b2b-shared`, the `requireReverification` route auth mode (IDN-13's enforcement), the `B2BAdminAuditLog` collection (SEC-06's store, shared with Exports), and seed fixtures that make the screen real in dev.

**Not in scope:**

- **"Export this view."** The mock puts an export button on this screen. The admin-surface nav table defines `/fans` as "`RPT-02` view, scoped — **not the export itself**", and V1 defines exactly three exports: `RPT-01`/`RPT-03` (the Exports module) and `RPT-02` (OBS Internal's `/fan-actions`). An ad-hoc roster export is none of them and would be a fourth PII release path with no PRD backing. **Spec wins over mock.**
- **The fan-actions export and event-level activity** (`RPT-02`) — OBS Internal's `/fan-actions`, its own module. This screen shows membership state, not event streams.
- **Editing a fan's profile or consents.** Consent is recorded from the fan, through the gate (`OPT-04`); an admin writing a fan's consent would forge the audit record. No such endpoint exists or should.
- **Full account erasure across tenants and providers.** SEC-07's propagation to analytics tools, the email provider, and the fan Clerk instance — see "Deletion semantics" for the exact V1 boundary and the recorded gap.
- **Tenant write access** — nothing here changes at `ADM-03`; deletion stays with OBS (see below).

---

## The screen

`/fans`, per Nick's 2026-09-14 mock. Same scope shape as every workspace screen: OBS with no tenant chosen gets the "Pick a tenant" state; the chosen tenant lives in `?tenant=<slug>`; a tenant-scoped user's URL never carries the parameter.

**The table.** One row per membership: display name with masked email beneath, joined date, one chip per active opt-in (accepted / declined / pending at the current `textVersion` — the same three states, computed by the same rules, as the Fields & Opt-ins stats, so the two screens can never disagree about a fan), profile completeness (Complete, or Missing N against the tenant's current required fields), boards played, prizes won with failed deliveries called out. Search (name or email) plus two filters: opt-in state per opt-in, and missing-required-field.

**Search is a POST.** A name or email fragment is PII and never belongs in a URL, a browser history, or an access log — the search endpoint takes its query in the request body, and the screen never reflects it into the query string. The only query parameter on this surface is the OBS caller's `?tenant=<slug>`, which is not PII.

**Masked by default.** Contact fields — email, phone, address, birthday — arrive masked from the server (`m•••••@gmail.com`); masking is not a UI affordance the client could skip. The banner above the table says exactly what the mock says: revealing or exporting fan PII requires reverification (IDN-13) and is written to the audit log.

**Reveal contact fields** re-runs the current view with `reveal: true`, which the server honours only within the reverification window, and writes one audit entry (operator, tenant, row count). Revealed state is page state: it does not survive navigation, and each new page of results under reveal is its own audited request. Reveal is available to tenant callers too — a team user holds `org:reports:read` and receives these same fans' contact fields in their sponsor exports; what reveal adds is the step-up and the audit trail, not a new grant.

**The drawer.** Selecting a row opens the fan's detail: profile fields (contact masked unless the view is revealed), full consent history — each record with its decision, the `textVersion` the fan actually saw, and when — gameplay (boards, bingos), and prize redemptions with statuses. Consent history is append-only truth from the gate; the drawer labels a record made against an older text version as such rather than pretending it answers the current wording.

**Deletion** lives at the bottom of the drawer, OBS-only, behind a typed confirmation (the fan's display name) *and* reverification. Tenant callers do not see the control — same presentation rule as every obs-only write.

**Read-only for team users** otherwise — this screen has no config writes at all, so tenant and OBS callers see the same table; the differences are exactly two: the tenant picker (OBS) and the deletion control (OBS).

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` (admin-surface Rule 1). Contracts in `obs-b2b-shared/src/api/admin/fans.ts`, composed from the existing `B2BFanMembership` / `ConsentRecord` shapes.

| Method | Path | Auth | Who |
|---|---|---|---|
| POST | `/admin/fans/search` | `requireAdmin` (+ reverification when `reveal: true`) | Any resolved admin scope |
| GET | `/admin/fans/:membershipId` | `requireAdmin` | Any resolved admin scope |
| DELETE | `/admin/fans/:membershipId` | `requireAdmin` + reverification + `scope.kind === "obs"` | OBS only |

**Tenant targeting** is the established rule unchanged: tenant callers are scoped to their own org and 403 on any `?tenant=`; OBS callers must send `?tenant=<slug>` (400 without, 404 unknown or reserved).

**`:membershipId` is verified against the resolved tenant** — the games spec's `:contestId` rule, same reasoning: the handler re-reads the membership and answers **404** when its `organizationId` is not the target tenant's, never 403, so a cross-tenant probe learns nothing.

**`POST /admin/fans/search` takes** `{ query?, optIn?: { optInId, state }, missingField?, page?, pageSize?, reveal? }` and returns the page plus `total` (after filters) and `memberCount` (the tenant's whole roster — the mock's "3,860 memberships"). Pagination is `page`/`pageSize` (default 25, max 100) — the platform's first paginated contract; page/size over cursors because the screen is a browsable roster, not an infinite feed. Rows carry the mock's columns; per-opt-in state is computed with the same entry-gate helpers as the config stats. This is the platform's precedent that **list endpoints whose filters contain PII are POST**.

**`GET /admin/fans/:membershipId` returns** the drawer's detail — and always masked. Reveal exists only on the search path: one endpoint whose unmasked mode is reverification-gated and audited is a checkable boundary; two would be two.

**`DELETE /admin/fans/:membershipId`** — see below.

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

**OBS-only, permanently** — not an `ADM-03` candidate. The admin-surface spec's own test is "whose mistake does it become": deletion is irreversible and legally consequential, and the party executing an erasure obligation end-to-end is the platform operator. This is `org:fan_data:export`'s sibling, not `org:tenant_config:manage`'s. Enforced structurally (`scope.kind === "obs"`) with its own message, exactly as every V1 write.

**Idempotent in effect:** deleting an already-deleted membership is 404 — nothing about the fan remains to confirm.

---

## Permissions

Reads: every resolved admin scope — `ADM-01`'s shared-screen model; the roster is the tenant's own data, and a team user seeing their own fans is the product. Reveal: every resolved admin scope, but only through reverification and the audit log (see above — the grant already exists via `org:reports:read`; the gate adds accountability, not access). Deletion: OBS only, structurally; `requirePermission` remains the upgrade path if a dedicated permission is ever provisioned, per the fields spec's reasoning.

---

## Rules

1. **No PII in URLs** — search text travels in POST bodies; list endpoints with PII-bearing filters are POST. The only query parameter is the verified OBS `?tenant=`.
2. **Contact fields leave the server masked unless the request passed reverification with `reveal: true`** — masking is enforcement, not presentation.
3. **Every reveal, export, and deletion writes an audit entry; deletion writes it first or does not happen.**
4. **`:membershipId` is verified against the resolved tenant; mismatch is 404**, never 403.
5. **Deletion is obs-only and reverification-gated**, and the UI adds typed confirmation on top — three independent gates for one irreversible action.
6. **No endpoint edits a fan's consents or profile** on this surface.
7. **The audit log contains no PII.**

---

## Known gaps (recorded, not blocking)

- **SEC-07 propagation**: deletion does not yet reach the fan Clerk instance (the auth record survives; the fan could sign in again and would appear as a brand-new join), nor analytics or the email provider — no such integrations exist in the B2B stack yet to propagate *to*. The endpoint is the platform-side half; the propagation half needs the integrations first.
- **`SEC-05`**: consent records still lack IP and consent method (pre-existing, flagged by the fields spec) — the drawer shows what exists.
- **In-memory listing**: search/filter loads the tenant's memberships and filters in process — the same precedent as `computeConfigStats`, fine at V1 tenant sizes; an aggregation pipeline is the scale path.
- **No rate limiting on search** (`SEC-08` names it for sensitive endpoints) — platform-wide concern, not solved per-module.

## References

- PRD: [`ADM-01`, `ADM-02`, `OPT-04`, `RPT-02`, `SEC-05`–`SEC-08`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-13`
- [`admin-surface.spec.md`](admin-surface.spec.md) — reverification list, nav table ("`RPT-02` view, scoped — not the export itself")
- [`admin-exports.spec.md`](admin-exports.spec.md) — the sibling consumer of reverification and the audit log
- Mock: `mocks/admin-console/Fans.png` (workspace) — layout source; "Export this view" deliberately not implemented
