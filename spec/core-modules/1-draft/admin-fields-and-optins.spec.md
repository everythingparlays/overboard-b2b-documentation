# Core Module Spec: Admin — Fields & Opt-ins

**Implements:** PRD `ADM-05`, `AUTH-02`, `OPT-01`–`OPT-05`, `TEN-02`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-05`–`IDN-07` (the versioned-consent mechanism these edits drive).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the permission table, and the `/config` nav destination. [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — the `signupFields` / `optIns` shapes this writes and the closed field catalog. [`../../webapp/entry-gate.spec.md`](../../webapp/entry-gate.spec.md) — the fan-side gate that makes an admin edit here reach fans.

**Status:** Draft.

## Overview

The first real admin feature: the Fields & Opt-ins screen at `/config`, and the `/admin` endpoints that let it read and write a tenant's `signupFields` and `optIns` — replacing the direct database edits that configure them today.

**The whole change, in one line:** a tenant's signup-field and opt-in configuration becomes editable through the admin surface, with the server owning the `textVersion` bump so re-prompting fans can never be skipped.

**In scope:** the screen, three endpoints (`GET /admin/config`, `PUT /admin/config`, `GET /admin/tenants`), their contracts in `obs-b2b-shared`, permission enforcement, and how mid-season change rules apply to admin edits. Two additive fields on `OptInDefinition`: `label` (`OPT-02` names label and text as separately configurable) and `publishedAt` (`ADM-05` — the admin surface changes "how it's tracked").

**Not in scope:**

- **Export cadence** (`RPT-06`). The mock places a cadence selector on this screen; cadence configures when *exports* are produced, not what signup collects, and no data model for it exists. It belongs to the Exports module — the screen omits it (spec wins over mock).
- **Sponsor records.** `OptInDefinition.sponsorId` stays on the wire as an optional pass-through, but no sponsor collection exists yet, so the UI offers no sponsor picker. The `kind: "sponsor"` value is what marks a sponsor opt-in for now.
- **Tenant write access** — `ADM-03` **[FUTURE]**.
- **Concurrency control.** Publishing is last-write-wins between two concurrent admins. Acceptable at V1's operator count; revisit if OBS staffing grows.
- **`SEC-05`'s IP address and consent method** on `ConsentRecord` — a pre-existing gap in the fan-side record, not something an admin write path can close. Flagged, not fixed here.

---

## The screen

`/config`, "Fields & Opt-ins", per Nick's 2026-09-14 mock. Two cards, scoped to the resolved tenant.

**Signup fields.** Every catalog field (`firstName`, `lastName`, `phone`, `birthday`, `zip`, `address`, `favoritePlayers`) rendered as a three-state choice — Required / Optional / Hidden (`AUTH-02`; "Hidden" is absence from `signupFields`). Email renders as a static always-required row — it is not in the catalog and has no setting (`AUTH-03`). The card carries the `§6.3` product note verbatim in spirit: every additional required field lowers signup conversion — surfaced at the point of configuration, not documented elsewhere.

**Opt-ins.** The tenant's opt-ins, each showing label, consent text, kind, Blocking/Non-blocking, current `textVersion` + `publishedAt`, and acceptance stats. Add / edit / remove via a drawer.

**Draft-and-publish.** Edits accumulate locally; **Publish changes** sends one `PUT /admin/config`; **Discard** resets to the server state. Before publish, the screen warns about consequences the entry gate will enforce:

- A field newly set to Required → "Newly required — N existing fans will be asked on next entry" (N from the stats below).
- An opt-in whose *text* changed → "Text edited — publishing creates v{n+1} and re-prompts every fan."

**Read-only for team users (decision, this spec).** A tenant-scoped caller sees the same layout rendered as a **view-only presentation** — state badges instead of interactive controls — with one line of explanation ("Read-only — signup fields and opt-ins are managed by Overboard in V1"). Not disabled controls: disabled implies a temporarily unavailable action, and this is a role (`ADM-02`), not a state. The presentation flips per control when `ADM-03` ships, not per screen.

**OBS tenant selection.** An OBS caller's scope names no tenant, so the tenant being acted on comes from the console-wide selector in the top bar ("Acting on tenant", admin-surface spec, "Frontend") — one choice that applies to every screen, not a choice per screen. With nothing chosen, `/config` shows the "Pick a tenant" empty state, fed by the same `GET /admin/tenants`; choosing there sets the console-wide selection. The request still names the tenant explicitly as `?tenant=<slug>`. A tenant-scoped user's `/config` never carries the parameter.

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` (admin-surface spec Rule 1). Contracts in `obs-b2b-shared/src/api/admin/` (`config.ts`, `tenants.ts`), composed from the existing `fieldDefinitionSchema` — not duplicated.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/tenants` | `requireAdmin` + `scope.kind === "obs"` | OBS only — the chooser list, `{ slug, name }[]` |
| GET | `/admin/config` | `requireAdmin` | Any resolved admin scope (`ADM-02` read) |
| PUT | `/admin/config` | `requireAdmin` + `scope.kind === "obs"` | OBS only in V1 (`ADM-02`/`ADM-03`) |

**Tenant targeting** — the admin-surface spec's explicit-and-verified exception, in full:

- `scope.kind === "tenant"`: the target is `scope.tenant`. A `?tenant=` parameter is **403**, even naming their own tenant — a tenant-scoped caller may never name a tenant.
- `scope.kind === "obs"`: `?tenant=<slug>` is **required** (400 without it), resolved by `B2BOrganization.subdomain`; 404 when it names nothing, 404 for reserved slugs (`obs`, `admin`).

**`GET /admin/config` returns** the tenant `{ slug, name }`, `signupFields`, full `optIns` (admin sees `kind`, `label`, `publishedAt` — unlike the fan-facing `publicOptInSchema`), and **stats** computed with the same entry-gate helpers the fan surface uses, so the numbers shown are exactly what the gate will do: `memberCount`, per-opt-in `{ accepted, declined, pending }` at the *current* `textVersion`, and per-catalog-field `missingCount` (members without a provided value — the N in the newly-required warning, real for every field whether currently configured or not).

**`PUT /admin/config` takes** the desired state — `signupFields` (full replacement, catalog-validated, no duplicate `fieldId`s) and `optIns` as `{ optInId, kind, label?, text, blocking, sponsorId? }` (no duplicate `optInId`s). **`textVersion` and `publishedAt` are not accepted from the client** — see the rules below. Responds with the updated config plus a `changes` summary (`optInsAdded` / `optInsReworded` / `optInsRemoved`, `fieldsAdded` / `fieldsNowRequired` / `fieldsRemoved`) so the UI can confirm what actually happened.

---

## Permissions

`ADM-02` scopes team users to read-only; `org:tenant_config:manage` never appears on a tenant role in V1 (admin-surface spec Rule 3). In V1 the manage grant is therefore **coextensive with membership in the `obs` org**, and the server enforces it structurally: write routes verify `req.adminScope.kind === "obs"` and answer 403 with a read-only message otherwise.

**Why not `requirePermission("org:tenant_config:manage")` today:** Clerk custom permissions exist only once created in the dashboard, and the admin instance's roles do not carry them yet — `has()` would return false for *everyone*, OBS included, making the write path dead on arrival while looking like an authorization design. The structural check implements the identical V1 grant table without the unprovisioned dependency. When `ADM-03` ships, enforcement moves to `requirePermission` (already wired in `route_config.ts`), the instance's roles gain the permission deliberately, and the scope-kind check remains as defense in depth for the cross-tenant `?tenant=` path, which stays OBS-only regardless.

---

## Mid-season rules, as they apply to admin edits

The fan-side machinery (entry-gate spec) already re-prompts on `(optInId, textVersion)` mismatch and asks for missing fields on next entry. Admin edits must *drive* that machinery, never bypass it:

1. **The server owns `textVersion`.** A publish that changes an opt-in's `text` increments `textVersion` and stamps `publishedAt`; the client cannot send either. The bump "that must never be skipped" (multi-tenant spec Rule 4) is structural, not a convention.
2. **Only `text` bumps.** Editing `label`, `kind`, `blocking`, or `sponsorId` changes nothing about what the fan agreed to, so prior consents stand. Flipping blocking ↔ non-blocking takes effect at each fan's next entry through the existing gate (`OPT-03`'s config-only acceptance criterion).
3. **A new opt-in** starts at `textVersion: 1` with `publishedAt` now; every member is pending it on next entry (`IDN-05` — the "sponsor added mid-season" case, already free).
4. **A removed opt-in** leaves the active set; fans' `ConsentRecord`s for it are never deleted (`OPT-04` is an audit record, and `OPT-06` depends on history surviving).
5. **A field newly required** is asked on next entry and blocks play until provided; newly optional is asked but never blocks (`AUTH-02`). No admin-side mechanism needed — `missingFields` already evaluates per entry.
6. **A publish mid-fan-session is safe.** The fan surface rejects stale `textVersion`s with 409 and the fan re-fetches — the admin edit cannot record agreement to wording the fan never saw.

---

## Rules

1. **No admin config handler takes a tenant identifier except the verified OBS `?tenant=` parameter.** A tenant-scoped caller naming any tenant is 403.
2. **`textVersion` and `publishedAt` never cross the wire inbound.** The server derives both.
3. **`fieldId` comes from the closed catalog**; unknown or duplicate ids are 400, on both ends (shared zod contract).
4. **Config writes are obs-only until `ADM-03`**, enforced server-side; the UI's read-only presentation is UX, not the boundary.
5. **Removing an opt-in never removes consent records.**

---

## Known gaps (recorded, not blocking)

- PRD §7 (`OPT-01` "once, at signup", `OPT-06` "do not implement mid-season consent prompting") predates the 2026-09 mid-season decision that §6/`AUTH-02` and `ADM-05` reflect; the shipped per-entry gate and this spec follow the newer text (contradiction rule: more features + postdates).
- `SEC-05` wants IP + consent method on consent records; `ConsentRecord` has neither.
- Admin Clerk instance configuration (custom permissions, org self-creation off per admin-surface Rule 8) is dashboard work, tracked outside this spec.

## References

- PRD: [`ADM-02`, `ADM-03`, `ADM-05`, `AUTH-02`, `AUTH-03`, `OPT-01`–`OPT-06`, `TEN-02`, `RPT-06`, `SEC-05`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-05`–`IDN-07`
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework this builds on
- [`../../webapp/entry-gate.spec.md`](../../webapp/entry-gate.spec.md) — the fan-side behavior these edits drive
- Mock: `mocks/admin-console/Fields-Opt-ins.png` (workspace) — layout source; cadence selector deliberately not implemented
