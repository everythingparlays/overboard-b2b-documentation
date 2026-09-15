# Core Module Spec: Admin — Exports

**Implements:** PRD `ADM-07`, `RPT-01`, `RPT-03`, `RPT-04`, `RPT-05`, `SEC-02`, `SEC-06`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13` (via the mechanism defined in the Fans spec).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — the permission table (`org:reports:read`), the `/exports` nav destination, the reverification list. [`admin-fans.spec.md`](admin-fans.spec.md) — `requireReverification` and the `B2BAdminAuditLog` collection, defined there and consumed here. [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the `OptInDefinition` shape this extends and the consent-state vocabulary the row filter reuses.

**Status:** Draft.

## Overview

The Exports screen at `/exports`: the two tenant-scoped V1 reports — the sponsor-facing "Who played" roster (`RPT-01`) and the aggregate usage report (`RPT-03`) — with `RPT-04`'s per-sponsor field scoping and `RPT-05`'s opt-in row filtering enforced at generation, never left to review.

**The whole change, in one line:** sponsor exports become generatable through the admin surface, with the DPA field scope stored on the sponsor's opt-in, row filtering derived from actual consent records, and every generation written to the audit log.

**In scope:** the screen, four endpoints (`GET /admin/exports`, `POST /admin/exports/who-played`, `POST /admin/exports/usage`, `PUT /admin/exports/field-scope`), contracts in `obs-b2b-shared/src/api/admin/exports.ts`, one additive field on `OptInDefinition` (`exportFields` — `SEC-02`'s data-model requirement), and seed fixtures.

**Not in scope:**

- **The internal fan-actions export** (`RPT-02`, `org:fan_data:export`). It is obs-only, event-level, and belongs to OBS Internal's `/fan-actions` — its own module. This screen neither lists nor links it; a tenant-facing catalog must not carry an entry whose only correct rendering for tenants is "you can't have this".
- **Scheduled delivery and cadence** (`RPT-06`). The PRD's own open question — "how exports reach the sponsor (email attachment, secure download link, SFTP)" — is unanswered, and cadence without a delivery mechanism is a stored setting nothing consumes. V1 is on-demand generation only; the mock's "Cadence: weekly, Monday 6:00 AM MT" line is omitted rather than rendered as decoration. **Spec wins over mock.** Recorded gap.
- **Stored export files.** Generated CSVs are returned to the caller and not persisted — see "Generation, not storage".
- **A sponsor entity.** Still unmodelled (games spec, same gap). V1's sponsor *is* the `kind: "sponsor"` opt-in — which is also exactly the thing `RPT-05` filters rows by, so the export configuration hangs together without the missing collection. A real sponsor model can absorb `exportFields` later.
- **Favorite-players and dashboard reporting** (`RPT-07` **[FUTURE]**).

---

## The field scope (`RPT-04` / `SEC-02`)

One additive field on `OptInDefinition`:

```ts
exportFields?: ExportFieldId[]   // subset of EXPORT_FIELD_CATALOG, meaningful on kind: "sponsor"
```

`EXPORT_FIELD_CATALOG` = `firstName`, `lastName`, `email`, `phone`, `birthday`, `zip`, `address`, `picks` — the signup catalog's exportable fields plus `email` (always collected) and `picks` (`RPT-01`'s "players/props each fan picked", with the game date; one scope entry because the DPA authorizes game content as a unit). `favoritePlayers` is deliberately absent — it exists for the deferred `RPT-07` report, and no DPA has named it.

- **Fail closed.** A sponsor opt-in with no `exportFields` (unset or empty) cannot be exported: 409, "No DPA field scope configured". The alternative — a default scope — is a fabricated DPA.
- **The server intersects, the client never chooses.** A generation request names the sponsor, not the fields; the CSV's columns come from the stored scope. There is no "include extra fields" parameter to misuse.
- **Editing the scope is config, so it is obs-only** in V1 (structurally, like every config write) — a signed DPA is what changes it, and OBS holds the DPA. Tenants see the scope read-only.
- `applyConfigUpdate` (the Fields & Opt-ins publish path) **preserves `exportFields`** on opt-ins it updates — the config screen doesn't know the field exists, and a publish from it must not strip a sponsor's DPA scope. Guarded by test.

## The row filter (`RPT-05`)

A fan appears in a sponsor's "Who played" export **only when their consent record for that sponsor's opt-in is `accepted` at the current `textVersion`** — the same `accepted` the Fields & Opt-ins stats and the Fans screen compute, one vocabulary across all three surfaces. Declined, pending, and accepted-at-an-older-version are all excluded: a rewording re-prompts fans precisely because the platform will not record agreement to wording a fan never saw (fields spec, Rule 2), and it will not *release PII* under that wording either. The screen shows the resulting arithmetic per sponsor — members, opted in, excluded — the mock's row-filtering card.

Excluded fans still count in the usage report's aggregates, where nothing identifies them (`RPT-05`'s third clause, the Overview mock's note).

Filtering happens at generation time, in the query — there is no post-generation review step to forget (`RPT-05`'s fourth clause).

---

## The screen

`/exports`, per Nick's 2026-09-14 mock. Standard scope shape (OBS picks a tenant via `?tenant=`, tenant callers never carry the parameter).

**Recent exports** (left): the audit log's export entries for this tenant — report, sponsor, game, row count with filtered-out count, when, and who ran it. **Download re-generates**: rows are filtered and fields scoped *at generation time*, so a fresh generation is the compliant artifact, and it goes through the same reverification gate as any other. The table is the audit trail wearing a UI; it cannot disagree with SEC-06 because it *is* SEC-06's record.

**Generate export**: pick the report; for "Who played", pick the sponsor and the contest (optionally narrowed to one game); generation streams back a CSV the browser saves. "Who played" generation triggers the reverification prompt (IDN-13 — releases PII); the usage report does not (aggregate-only, nothing identifying). Failures are stated plainly — most importantly the unconfigured-field-scope 409, which tells the operator what to fix rather than producing an empty file.

**Field scope** (right): per sponsor opt-in, the catalog as a checklist — checked means the DPA authorizes it. OBS callers edit and save; tenant callers see the same card as read-only state, one line of explanation, per the established presentation rule. Beneath it, the row-filtering arithmetic for the selected sponsor, with the mock's note: excluded fans still count in aggregate reports, where nothing identifies them.

**Tenant callers can generate and download both reports.** This is the deliberate difference from every previous module: `org:reports:read` is held by *all* admin roles (admin-surface permission table) — reporting is the product the team bought. The obs-only boundary here is config (the field scope), not use.

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope`. Contracts in `obs-b2b-shared/src/api/admin/exports.ts`.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/exports` | `requireAdmin` | Any resolved admin scope |
| POST | `/admin/exports/who-played` | `requireAdmin` + reverification | Any resolved admin scope (`org:reports:read`) |
| POST | `/admin/exports/usage` | `requireAdmin` | Any resolved admin scope (`org:reports:read`) |
| PUT | `/admin/exports/field-scope` | `requireAdmin` + `scope.kind === "obs"` | OBS only (config) |

**Tenant targeting** unchanged from every prior module (403 / 400 / 404 discipline).

**`GET /admin/exports` returns** the catalog the screen needs in one read: the tenant's sponsor opt-ins (label, `exportFields`, and per-sponsor counts — members, opted-in at current version, excluded), the tenant's contests with their enabled games (the generation pickers), and the most recent export audit entries (report, parameters, row counts, actor, timestamp).

**`POST /admin/exports/who-played` takes** `{ optInId, contestId, betEventId? }` and returns `{ success, tenant, filename, rowCount, filteredOutCount, csv }`. Rows: memberships passing the row filter that played — at least one board in the contest, narrowed to boards whose props belong to `betEventId` when given (a board's game is reachable through its props' `betEventId`; boards do not carry the event directly). Columns: exactly the stored `exportFields`, in catalog order; `picks` contributes the pick summary and game date `RPT-01` names. Unknown `optInId`, non-sponsor `optInId`, or a contest/event not the tenant's: 404 by the cross-tenant discipline; unconfigured scope: 409. Writes a `fan_export` audit entry (operator, tenant, sponsor opt-in, parameters, row count — `SEC-06`'s exact list).

**`POST /admin/exports/usage` takes** `{ contestId? }` (default: all the tenant's contests) and returns the same envelope: one CSV row per contest — members joined, boards played, distinct players, bingos, prizes fulfilled/failed, gameplay and prize-claim conversion rates (`RPT-03`'s trio, minus signup conversion — recorded gap: the platform does not yet count entry-gate visits, so there is no denominator). Every fan counts, declines included. Audited as `usage_export`.

**`PUT /admin/exports/field-scope` takes** `{ optInId, exportFields }` — catalog-validated, no duplicates — and returns the updated sponsor list plus a `changes` summary, the config PUT's precedent. Obs-only structurally; `requirePermission` is the eventual upgrade path, per the fields spec's reasoning verbatim.

### Generation, not storage

Exports are generated in-process and returned in the response envelope (`csv` as a string, saved client-side); nothing is written to disk or object storage. Three reasons: **no PII at rest** that isn't already in the database — no bucket of fan rosters to secure, rotate, or breach; the delivery mechanism is the PRD's own open question, and storage is a delivery decision; V1 sizes are bounded (a tenant's roster is thousands of rows) and the response-contract machinery (`wrapHandler` validating JSON bodies) keeps working. When `RPT-06` delivery lands, storage gets decided with it. The JSON envelope over a raw `text/csv` body is the same trade: contract-validated responses are the repo's established safety net, and the saved file is identical either way.

---

## Permissions

`org:reports:read` — all admin roles, scoped to the caller's org (admin-surface permission table). In V1 this grant is coextensive with *any resolved admin scope*, so the reads and generations enforce nothing beyond `requireAdmin` + tenant targeting — the first module where tenant callers act rather than view, which is the permission table working as designed, not an oversight. The field-scope write is config: obs-only structurally, `ADM-03`-shaped like every other config write. `RPT-02`'s `org:fan_data:export` appears nowhere in this module, by design.

Reverification (IDN-13, mechanism in the Fans spec): "Who played" releases PII → gated, for OBS and tenant callers alike. The usage report and the catalog read release nothing identifying → not gated. The field-scope write is config, not PII release → not gated (and a stale scope edit is recoverable, unlike a release).

---

## Rules

1. **Fields come from the stored scope; rows come from consent records; both are applied at generation time.** No parameter widens either.
2. **No field scope, no export** — 409, never a default schema (`RPT-04`: "no single fixed export schema").
3. **Opted in means `accepted` at the current `textVersion`** — the one consent vocabulary, shared with the config stats and the Fans screen.
4. **Every generation writes an audit entry** with operator, time, sponsor, parameters, and row count (`SEC-06`).
5. **`RPT-02` is not reachable from this module** — no endpoint, no catalog entry, no link.
6. **Generated exports are not persisted server-side.**
7. **Aggregate reports identify no one** — the usage CSV carries counts and rates, never a fan field.

---

## Known gaps (recorded, not blocking)

- **`RPT-06` cadence and delivery** — blocked on the PRD's open delivery-mechanism question; nothing stored, nothing scheduled.
- **Signup conversion** (`RPT-03`) — no entry-gate visit counting exists, so the usage report ships gameplay and prize-claim conversion only.
- **No sponsor entity** — the DPA scope lives on the opt-in; a future sponsor model should absorb it (`TEN-04`'s sponsor↔tenant relationship, the games spec's recorded gap).
- **Per-game attribution rides on props** — boards do not carry a `betEventId`; the per-game narrowing resolves it through the board's props. Correct today; a board-level event id would be cheaper at scale.
- **No rate limiting on generation** (`SEC-08`) — platform-wide concern.

## References

- PRD: [`ADM-07`, `RPT-01`–`RPT-07`, `SEC-02`, `SEC-06`, `OPT-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md) — §11.2's acceptance criteria are this module's test list
- [`admin-fans.spec.md`](admin-fans.spec.md) — reverification middleware and audit log (defined there)
- [`admin-surface.spec.md`](admin-surface.spec.md) — permission table, reverification list
- Mock: `mocks/admin-console/Exports.png` (workspace) — layout source; cadence line deliberately not implemented
