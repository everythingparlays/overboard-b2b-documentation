# Core Module Spec: Admin — Exports

**Implements:** PRD `ADM-07`, `RPT-01`, `RPT-03`, `RPT-04`, `RPT-05`, `SEC-02`, `SEC-06`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13` (via the mechanism defined in the Fans spec).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — the permission table (`org:reports:read`), the `/exports` nav destination, the reverification list. [`admin-fans.spec.md`](admin-fans.spec.md) — `requireReverification` and the `B2BAdminAuditLog` collection, defined there and consumed here. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the `OptInDefinition` shape this extends, the consent-state vocabulary the row filter reuses, and the tenant's `signupFields`, which are now what this module's exportable set is derived from.

**Status:** Draft. Amended 2026-09-21 for entry-gate editor v2: `EXPORT_FIELD_CATALOG` is retired in favour of a per-tenant exportable set, and field deletion prunes sponsor scopes. Amended 2026-09-23 for the sponsor model ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)): a sponsor is a record, the DPA scope lives on it, and the opt-in becomes the sponsor's consent.

## Overview

The Exports screen at `/exports`: the two tenant-scoped V1 reports — the sponsor-facing "Who played" roster (`RPT-01`) and the aggregate usage report (`RPT-03`) — with `RPT-04`'s per-sponsor field scoping and `RPT-05`'s opt-in row filtering enforced at generation, never left to review.

**The whole change, in one line:** sponsor exports become generatable through the admin surface, with the DPA field scope stored on the sponsor's opt-in, row filtering derived from actual consent records, and every generation written to the audit log.

**In scope:** the screen, four endpoints (`GET /admin/exports`, `POST /admin/exports/who-played`, `POST /admin/exports/usage`, `PUT /admin/exports/field-scope`), contracts in `obs-b2b-shared/src/api/admin/exports.ts`, one additive field on `OptInDefinition` (`exportFields` — `SEC-02`'s data-model requirement), and seed fixtures.

**Not in scope:**

- **The internal fan-actions export** (`RPT-02`, `org:fan_data:export`). It is obs-only, event-level, and belongs to OBS Internal's `/fan-actions` — its own module. This screen neither lists nor links it; a tenant-facing catalog must not carry an entry whose only correct rendering for tenants is "you can't have this".
- **Scheduled delivery and cadence** (`RPT-06`). The PRD's own open question — "how exports reach the sponsor (email attachment, secure download link, SFTP)" — is unanswered, and cadence without a delivery mechanism is a stored setting nothing consumes. V1 is on-demand generation only; the mock's "Cadence: weekly, Monday 6:00 AM MT" line is omitted rather than rendered as decoration. **Spec wins over mock.** Recorded gap.
- **Stored export files.** Generated CSVs are returned to the caller and not persisted — see "Generation, not storage".
- **The sponsor entity itself** — [`admin-sponsors.spec.md`](admin-sponsors.spec.md). *(Superseded 2026-09-23: V1's sponsor used to* be *the `kind: "sponsor"` opt-in. It is now a `B2BSponsor` record that absorbs `exportFields`; the opt-in it links to remains what `RPT-05` filters rows by.)*
- **Favorite-players and dashboard reporting** (`RPT-07` **[FUTURE]**) — the *report*. The field itself is now scopeable into a sponsor's "Who played" export like any other configured field; what stays unbuilt is `RPT-07`'s own aggregate view.

---

## The sponsor, since 2026-09-23

A row on this screen is a **sponsor record** (`B2BSponsor`) — named, carrying its DPA scope and, optionally, the reference of the agreement that scope follows. Its **consent** is the `kind: "sponsor"` opt-in linked to it (`OptInDefinition.sponsorId`); the row filter below reads that opt-in's consent records exactly as before. A record with no linked opt-in has no fan who agreed to share anything with it, so it has no "Who played" export (409 if asked), though its scope can be set ahead of time. A `kind: "sponsor"` opt-in not yet migrated to a record still appears as its own row and works exactly as it always did.

Every request that names a sponsor takes **exactly one** of `sponsorId` (a record) or `optInId` (an unmigrated opt-in). The scope's home is the record; every scope write also mirrors the list onto the linked opt-in's `exportFields`, so code that predates the record — `main` on a shared database, or an old deploy — exports exactly what the new code would. The mirror is temporary and recorded as such in the sponsor spec.

## The field scope (`RPT-04` / `SEC-02`)

Stored on the sponsor record since 2026-09-23 (`B2BSponsor.exportFields`), mirrored onto its linked opt-in; originally one additive field on `OptInDefinition`:

```ts
exportFields?: string[]   // ids from the tenant's exportable set
```

**The exportable set is per tenant, and it is derived, not enumerated** (2026-09-21, superseding `EXPORT_FIELD_CATALOG`). It is `email`, then the tenant's configured `signupFields` in their configured order, then `picks` — computed by `exportableFieldIds(signupFields)` in the shared package, which is also the CSV's column order, so nothing has to keep a scope list and a column list agreeing.

`email` leads because it is always collected and is the identity every other column hangs off (`AUTH-03`). `picks` trails because it is not a profile field at all: it is `RPT-01`'s "players/props each fan picked", with the game date, and it is one scope entry rather than two because the DPA authorizes game content as a unit.

**A fixed catalog could not survive the open field model** ([`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md)): a tenant that invents "Shirt size" for a sponsor's prize pack has invented precisely the field that sponsor needs, and a platform enum could only answer that it has never heard of it. Deriving the set also fixes something the enum had wrong on its own terms — it listed `firstName` and `phone` for every tenant, including the tenants that collect neither, so the scope checklist offered boxes that could only ever tick through to empty columns.

**`favoritePlayers`' deliberate exclusion is superseded.** It was absent from the catalog because it existed for the deferred `RPT-07` report and no DPA had named it — which was a reasonable instinct aimed at the wrong control. Absence from a catalog is a platform-wide guess about what a contract might say; the **explicit checked scope is the control**, and it is per sponsor, per field, set by the admin who is holding the DPA. Under v2 `favoritePlayers` is scopeable like any other configured field: unchecked by default, exported only once a named human has ticked it, and pruned the moment the tenant stops collecting it. **Fail closed carries the weight** — if the argument for excluding a field is that nobody has authorized it, the answer is that nobody has ticked it either, and the tick is the thing an auditor can point at.

- **Fail closed.** A sponsor opt-in with no `exportFields` (unset or empty) cannot be exported: 409, "No DPA field scope configured". The alternative — a default scope — is a fabricated DPA.
- **The server intersects, the client never chooses.** A generation request names the sponsor, not the fields; the CSV's columns come from the stored scope. There is no "include extra fields" parameter to misuse.
- **Editing the scope is Workspace config**, so since the 2026-09-16 ruling a tenant `org:admin` edits their own — obs staff or `org:admin`, structurally, like every config write. The DPA framing is unchanged by that: the scope follows the signed DPA, and staying inside it is the tenant admin's responsibility. `org:member` sees the scope without controls.
- `applyConfigUpdate` (the Fields & Opt-ins publish path) **preserves `exportFields`** on opt-ins it updates — the config screen doesn't know the field exists, and a publish from it must not strip a sponsor's DPA scope. Guarded by test.
- **Except when a field is deleted, in which case that publish prunes its id from every sponsor's scope, in the same write** (new, 2026-09-21). This is the one case where the config screen must touch `exportFields`, and it is the opposite of stripping a scope: a scope entry naming a field the tenant no longer collects authorizes nothing, and leaving it in place means an id that someone later re-creates — deliberately, by re-adding a well-known field — arrives pre-authorized for release to a sponsor nobody re-consulted. Pruning keeps the invariant that every id in a stored scope is one a human ticked against a field that exists.
- **Unknown stored scope ids are dropped at generation**, never crashed on and never guessed at. Pruning makes them impossible through the supported path; a hand-edited document or a future path that forgets to prune makes them possible anyway, and the fail-closed reading of an id nothing recognizes is to leave the column out. A generation must not fail because of a stale scope entry either: an export that errors on data the operator cannot see is an export nobody can fix.

## The row filter (`RPT-05`)

A fan appears in a sponsor's "Who played" export **only when their consent record for that sponsor's opt-in is `accepted` at the current `textVersion`** — the same `accepted` the Fields & Opt-ins stats and the Fans screen compute, one vocabulary across all three surfaces. Declined, pending, and accepted-at-an-older-version are all excluded: a rewording re-prompts fans precisely because the platform will not record agreement to wording a fan never saw (fields spec, Rule 2), and it will not *release PII* under that wording either. The screen shows the resulting arithmetic per sponsor — members, opted in, excluded — the mock's row-filtering card.

Excluded fans still count in the usage report's aggregates, where nothing identifies them (`RPT-05`'s third clause, the Overview mock's note).

Filtering happens at generation time, in the query — there is no post-generation review step to forget (`RPT-05`'s fourth clause).

---

## The screen

`/exports`, per Nick's 2026-09-14 mock. Standard scope shape: OBS follows the console-wide selection made in the sidebar switcher and the request names it explicitly as `?tenant=`; non-obs callers never carry the parameter.

**Recent exports** (left): the audit log's export entries for this tenant — report, sponsor, game, row count with filtered-out count, when, and who ran it. **Download re-generates**: rows are filtered and fields scoped *at generation time*, so a fresh generation is the compliant artifact, and it goes through the same reverification gate as any other. The table is the audit trail wearing a UI; it cannot disagree with SEC-06 because it *is* SEC-06's record.

**Generate export**: pick the report; for "Who played", pick the sponsor and the contest (optionally narrowed to one game); generation streams back a CSV the browser saves. "Who played" generation triggers the reverification prompt (IDN-13 — releases PII); the usage report does not (aggregate-only, nothing identifying). Failures are stated plainly — most importantly the unconfigured-field-scope 409, which tells the operator what to fix rather than producing an empty file.

**Field scope** (right): per sponsor opt-in, **the tenant's own exportable set as a checklist** — email, each field this tenant actually collects under the label the admin gave it, then picks — checked means the DPA authorizes it. The rows come from the wire as `{ id, label }`, resolved server-side through the same `fieldLabel` the gate and the config screen use, so an admin ticking "Shirt size" reads the words they typed on `/config` rather than a slug. A tenant that collects three fields sees five rows, and no row on this card is ever one that could only produce an empty column. Obs staff and the tenant's own `org:admin` edit and save; an `org:member` sees the same card as view-only state, one line of explanation, per the established presentation rule. Beneath it, the row-filtering arithmetic for the selected sponsor — and nothing beneath the numbers. The mock's caveat note ("excluded fans still count in aggregate reports, where nothing identifies them") is said once instead, as the usage report's own hint in the Generate drawer, where the operator is choosing that report. *(Superseded 2026-09-22 by the omission principle, admin-surface Rule 13: a real number carries no caveat caption; the fact moved to the one place it informs a decision.)*

**Tenant callers can generate and download both reports.** This was the deliberate difference from every previous module: `org:reports:read` is held by *all* admin roles (admin-surface permission table) — reporting is the product the team bought. It is no longer the exception it was, now that the tenant's own admins configure the rest of their workspace too; but it remains the one thing an `org:member` can *do* rather than view.

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope`. Contracts in `obs-b2b-shared/src/api/admin/exports.ts`.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/exports` | `requireAdmin` | Any resolved admin scope |
| POST | `/admin/exports/who-played` | `requireAdmin` + reverification | Any resolved admin scope (`org:reports:read`) |
| POST | `/admin/exports/usage` | `requireAdmin` | Any resolved admin scope (`org:reports:read`) |
| PUT | `/admin/exports/field-scope` | `requireAdmin` + obs staff or tenant `org:admin` | The tenant's own admins, or OBS on any tenant (config) |

**Tenant targeting** unchanged from every prior module (403 / 400 / 404 discipline).

**`GET /admin/exports` returns** everything the screen needs in one read: the tenant's sponsor opt-ins (label, `exportFields`, and per-sponsor counts — members, opted-in at current version, excluded), **the tenant's exportable set as `{ id, label }[]` in column order** (the checklist's rows), the tenant's contests with their enabled games (the generation pickers), and the most recent export audit entries (report, parameters, row counts, actor, timestamp). The set is computed from `org.signupFields` on every read rather than stored, so it cannot go stale against a config publish that happened a second ago.

**`POST /admin/exports/who-played` takes** `{ optInId, contestId, betEventId? }` and returns `{ success, tenant, filename, rowCount, filteredOutCount, csv }`. Rows: memberships passing the row filter that played — at least one board in the contest, narrowed to boards whose props belong to `betEventId` when given (a board's game is reachable through its props' `betEventId`; boards do not carry the event directly). Columns: the stored `exportFields` intersected with the tenant's exportable set, in that set's order — so an id no longer recognized is simply not a column; `picks` contributes the pick summary and game date `RPT-01` names. Unknown `optInId`, non-sponsor `optInId`, or a contest/event not the tenant's: 404 by the cross-tenant discipline; unconfigured scope: 409. Writes a `fan_export` audit entry (operator, tenant, sponsor opt-in, parameters, row count — `SEC-06`'s exact list).

**`POST /admin/exports/usage` takes** `{ contestId? }` (default: all the tenant's contests) and returns the same envelope: one CSV row per contest — members joined, boards played, distinct players, bingos, prizes fulfilled/failed, gameplay and prize-claim conversion rates (`RPT-03`'s trio, minus signup conversion — recorded gap: the platform does not yet count entry-gate visits, so there is no denominator). Every fan counts, declines included. Audited as `usage_export`.

**`PUT /admin/exports/field-scope` takes** `{ optInId, exportFields }` — validated against the tenant's exportable set, no duplicates — and returns the updated sponsor list plus a `changes` summary, the config PUT's precedent. An id outside the set is a 400 naming it in plain language, not a silent drop: the caller is a checklist that was rendered from that set, so an unknown id means the screen and the server disagree about what this tenant collects, and that is worth surfacing rather than absorbing. Enforced structurally — obs staff, or an `org:admin` of the owning organization; `requirePermission` is the eventual upgrade path, per the fields spec's reasoning verbatim.

### Generation, not storage

Exports are generated in-process and returned in the response envelope (`csv` as a string, saved client-side); nothing is written to disk or object storage. Three reasons: **no PII at rest** that isn't already in the database — no bucket of fan rosters to secure, rotate, or breach; the delivery mechanism is the PRD's own open question, and storage is a delivery decision; V1 sizes are bounded (a tenant's roster is thousands of rows) and the response-contract machinery (`wrapHandler` validating JSON bodies) keeps working. When `RPT-06` delivery lands, storage gets decided with it. The JSON envelope over a raw `text/csv` body is the same trade: contract-validated responses are the repo's established safety net, and the saved file is identical either way.

---

## Permissions

`org:reports:read` — all admin roles, scoped to the caller's org (admin-surface permission table). This grant is coextensive with *any resolved admin scope*, so the reads and generations enforce nothing beyond `requireAdmin` + tenant targeting — the first module where tenant callers acted rather than viewed, which is the permission table working as designed, not an oversight. The field-scope write is config: structural, obs staff or the owning org's `org:admin`, shaped like every other config write. `RPT-02`'s `org:fan_data:export` appears nowhere in this module, by design.

Reverification (IDN-13, mechanism in the Fans spec): "Who played" releases PII → gated, for OBS and tenant callers alike. The usage report and the catalog read release nothing identifying → not gated. The field-scope write is config, not PII release → not gated (and a stale scope edit is recoverable, unlike a release).

---

## Rules

1. **Fields come from the stored scope; rows come from consent records; both are applied at generation time.** No parameter widens either.
2. **No field scope, no export** — 409, never a default schema (`RPT-04`: "no single fixed export schema").
3. **The exportable set is the tenant's own** — `email`, their configured fields in configured order, `picks` — derived on every read, and it is both what the checklist offers and what the CSV's columns are ordered by. There is no platform catalog of exportable fields.
4. **Deleting a field prunes its id from every sponsor scope, in the publish that deletes it**, and an id in a stored scope that the tenant's set no longer contains is dropped at generation rather than exported or errored on. A scope entry never outlives the field it names.
5. **Opted in means `accepted` at the current `textVersion`** — the one consent vocabulary, shared with the config stats and the Fans screen.
6. **Every generation writes an audit entry** with operator, time, sponsor, parameters, and row count (`SEC-06`).
7. **`RPT-02` is not reachable from this module** — no endpoint, no report-catalog entry, no link.
8. **Generated exports are not persisted server-side.**
9. **Aggregate reports identify no one** — the usage CSV carries counts and rates, never a fan field.

---

## Known gaps (recorded, not blocking)

- **`RPT-06` cadence and delivery** — blocked on the PRD's open delivery-mechanism question; nothing stored, nothing scheduled.
- **Signup conversion** (`RPT-03`) — no entry-gate visit counting exists, so the usage report ships gameplay and prize-claim conversion only.
- **Per-game attribution rides on props** — boards do not carry a `betEventId`; the per-game narrowing resolves it through the board's props. Correct today; a board-level event id would be cheaper at scale.
- **No rate limiting on generation** (`SEC-08`) — platform-wide concern.
- **A stored scope's agreement is named in free text only.** Since 2026-09-23 the sponsor record carries `dpaReference` ("Coca-Cola DPA v3, signed 2026-08-01") beside its scope. OBS does not hold the DPAs, so nothing validates the reference or versions the scope against it.
- **A column header is the field's current label.** Change the label, and the next generation's header changes with it while the historical exports a sponsor already holds keep the old one. Correct — the label is copy, the id is identity — and worth knowing before someone reconciles two CSVs by column name.

## References

- PRD: [`ADM-07`, `RPT-01`–`RPT-07`, `SEC-02`, `SEC-06`, `OPT-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md) — §11.2's acceptance criteria are this module's test list
- [`admin-fans.spec.md`](admin-fans.spec.md) — reverification middleware and audit log (defined there)
- [`admin-surface.spec.md`](admin-surface.spec.md) — permission table, reverification list
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the open field model this module's exportable set derives from, and the publish path that prunes scopes on delete
- Mock: `mocks/admin-console/Exports.png` (workspace) — layout source; cadence line deliberately not implemented
