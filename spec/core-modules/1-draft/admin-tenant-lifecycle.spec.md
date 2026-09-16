# Core Module Spec: Admin — Tenant Lifecycle

**Implements:** PRD `TEN-05`, `SEC-06`, `ADM-09`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13`.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — the access framework, Rule 4 (slug = subdomain), Rule 10 (the synced pair), Rule 11 (user-level obs staff-ness), and the reverification list. [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the All-tenants screen these actions live on, and the `POST /admin/tenants` provisioning flow whose patterns they reuse.

**Status:** Draft. Ruled 2026-09-15 (Arthur): the governing directive is that **OBS staff never need the Clerk dashboard for tenant work again**. Creation already ships in-app; this module ships the rest of the lifecycle — rename, suspend, resume, delete.

## Overview

Four operations on an existing tenant, all OBS-only, all reached from the All-tenants drill-in:

| Operation | What it changes | Reversible? |
|---|---|---|
| Rename | The display name, in Clerk and the database together | Yes — rename again |
| Suspend | A database-side status; fans are blocked, tenant writes are refused | Yes — resume |
| Resume | The same status, back | Yes — suspend |
| Delete | Everything the tenant owns, in Clerk and the database | **No** |

**The whole change, in one line:** the tenant directory stops being read-only — an operator can rename, pause, resume, and remove a tenant from the console, with the same both-or-neither discipline provisioning already has.

**In scope:** the four endpoints; the `B2BOrganization.status` field; suspension enforcement on the fan surface and the tenant-admin write path; the public org endpoint's `suspended` flag; four new audit actions; the All-tenants drawer surface; the fan app's paused screen.

**Not in scope, deliberately:**

- **Subdomain rename.** Still forbidden (admin-obs-internal Rule 4, admin-team Rule 2). The subdomain is four keys at once — Clerk org slug, fan hostname, branding registry key, unique index — and renaming any one strands the rest.
- **Clerk↔backend webhook sync.** The pair invariant is maintained by doing both writes in one handler, not by reconciling after the fact. A webhook listener is a second writer with its own failure modes; nothing here needs it.
- **Soft delete / restore / retention windows.** Delete is delete. A tenant OBS wants back is re-provisioned; a tenant OBS is unsure about is suspended, which is exactly what suspension is for.
- **Scheduled or automatic suspension** (billing, season end). Suspension is a manual operator action in V1.

---

## Supersessions (ruled 2026-09-15, Arthur)

1. **Tenant offboarding is now a surface.** `admin-obs-internal.spec.md` scoped it out with "deleting a production tenant is a legal-and-data question, not a screen." Arthur's ruling supersedes that: the delete surface works on any tenant, real fan data included, behind the platform's strongest guardrail stack (obs-only, reverification, typed-name confirmation server-checked). The legal question is answered by *who may do it and how deliberately*, not by keeping the capability in a shell script. The dev teardown script (`scripts/delete-tenant.mjs`) survives as developer tooling; the endpoint is the offboarding path — and unlike the script, it also removes the tenant's prize tiers, which the script orphans.
2. **Rename exists, display-name only.** admin-obs-internal's "no rename endpoint exists" was written when rename meant the subdomain. The subdomain stays immutable; the *display name* — the Clerk organization's `name` and `B2BOrganization.name`, which were only ever a label — is renameable, both together or neither.

---

## Suspension is database-side, and why Rule 10 does not apply

Clerk has no suspend primitive — an organization exists or it does not. So a tenant's suspended state lives on the record: `B2BOrganization.status: "active" | "suspended"`, plus `suspendedAt`. Records that predate the field have no `status`, and **a missing status means active** — the field is back-compatible by omission, and no backfill is needed.

Admin-surface Rule 10 says the record and the Clerk org are *created, changed, and deleted* together. Suspension does not violate it, because Rule 10 governs the pair's **existence and identity** — the things that, if they diverge, make a tenant nobody can sign in to or a slug that lies. Suspension is *platform state about whether the tenant is being served*. There is no Clerk half for it to be symmetric with, and inventing one (deleting the org on suspend, recreating on resume) would turn a reversible state flip into a destructive round-trip through the very invariant Rule 10 protects. Tenant admins deliberately **keep access to their console while suspended** — read access, so a paused customer can still see their own data — which is one more reason the Clerk org must survive suspension.

### What suspension does

- **Fans are blocked at entry.** The fan-side tenant middleware (`resolveTenant`) refuses every `/b2b/*` request for a suspended tenant with 403, `code: "tenant_suspended"`, and plain copy. This sits in the middleware rather than per-handler because entry is exactly one seam — every fan read and write resolves the tenant first. The refusal is enforced even under `TENANT_ENFORCEMENT=log-only`: that flag is a rollout escape hatch for the *membership* checks, and suspension is a product state, not a rollout.
- **The fan app shows a paused screen, not an error.** `GET /b2b/org/:subdomain` — the public, pre-auth read the fan app boots from — carries a top-level `suspended: boolean`. The app renders a friendly full-screen "paused" message in the tenant's own branding instead of mounting the game. The internal fields (`status`, `suspendedAt`) are **stripped from the public payload**: this endpoint returns the whole org document by default, and the public shape is one boolean, not our status vocabulary. A fan mid-session when suspension lands sees their next request refused; the entry gate catches them on reload. That is accepted — suspension is not an emergency stop, and the one-minute cache below already makes it approximate.
- **Tenant admins keep their console, read-only.** The enforcement seam is `refuseReadOnlyWrite` — the one gate every tenant-configuration write already passes through — which now also refuses a tenant caller whose organization is suspended. One seam, so a future write route cannot forget the check by forgetting a second call. OBS staff writes are deliberately *not* refused: the operator managing a paused tenant is exactly who needs to edit it. The console shows tenant users a banner saying the workspace is paused, and write controls disable (`useCanWrite` answers false) — UX on top of the server boundary, as everywhere.
- **Data is retained, and resume is exact.** Nothing is archived, exported, or mutated. Resume clears the status and the tenant serves again.

### Cache semantics, stated plainly

The fan-side tenant resolver caches organizations in-process for 60 seconds. Every lifecycle write calls `clearOrgCache()`, so the process that took the write serves the new state immediately. **Other processes serve the old state for up to one TTL** — a suspended tenant's fans may play for up to another minute, a resumed tenant's fans may see the paused screen for up to another minute. Accepted: suspension is an operator action with a known small lag, the same posture as obs-staff revocation latency (admin-surface, "Revocation latency"). The admin surface itself is unaffected — `resolveAdminScope` reads the record fresh per request.

---

## Rename (`POST /admin/tenants/rename`)

Takes `?tenant=` and `{ name }`. Updates the Clerk organization's `name` and `B2BOrganization.name` — both or neither, the provisioning flow's discipline applied to an update:

1. **Resolve the Clerk org by slug.** A missing org is a Rule 10 violation, not a rename: 409, naming the reconciliation problem, touching nothing.
2. **Clerk first.** Its failure leaves both systems unchanged and the operation retryable.
3. **Database second.** If this fails, the handler sets the Clerk name back to what it was; if *that* fails, the response says loudly that the two systems now disagree and which name each holds — a divergence an operator knows about is fixable, a silent one is Rule 10 rotting.
4. **Audit after success** (`tenant_rename`, fire-and-forget like `tenant_create`), with the old and new names in `detail` — organization display names, not PII.

**No reverification, argued.** The admin-surface list draws its line at *cannot be undone by clicking again* — "Editing a sponsor logo does not qualify; deleting the sponsor does." A rename is undone by renaming back; nothing is released and nothing is destroyed. Gating it would dilute the signal a credential prompt carries on the actions where it means something. (Ruling left this open; this is the spec's call.)

**The audit row is written before nothing** — rename deliberately breaks from audit-before-write because its first write is to an external system that may then be unwound: a pre-written audit row would attest a rename that never happened. The blocking-audit rule below is for the actions whose writes cannot be unwound.

---

## Suspend and Resume (`POST /admin/tenants/suspend`, `/resume`)

Both take `?tenant=`, obs-only, **reverification-gated** (per the 2026-09-15 ruling — suspending takes a customer's live program offline for every fan at once, and resume turns it back on; both deserve the walked-away-session protection even though both are reversible).

Semantics, identical in shape:

1. Obs check, then target resolution — the finalize ordering, so a tenant caller learns nothing about what exists.
2. 409 when already in the requested state ("already paused" / "not paused"), so a double-click or a stale screen cannot masquerade as a second action.
3. **Blocking audit first** (`tenant_suspend` / `tenant_resume`) — no record, no state change, the finalize/fan-delete precedent.
4. The status write: `status: "suspended"` + `suspendedAt` on suspend; `status: "active"`, `suspendedAt` removed, on resume.
5. `clearOrgCache()`.

No Clerk write anywhere in either — see "Suspension is database-side" above.

---

## Delete (`POST /admin/tenants/delete`)

The irreversible one, with the platform's full guardrail stack: obs-only (structural), **reverification** (IDN-13), and a **typed confirmation checked server-side** — the body's `confirmSubdomain` must equal the tenant's exact subdomain, the same double-check finalization uses. The subdomain rather than the display name, deliberately: it is unique by index, exact by construction, and it is what the operator sees in every hostname — display names can collide and can now be renamed mid-confirmation.

A POST rather than a DELETE because the confirmation must ride a request body, and DELETE bodies are dropped by enough intermediaries that the guardrail would be the fragile part.

**Order:**

1. Guards: obs check, target resolution, `confirmSubdomain` match (400 on mismatch).
2. **Pre-flight counts** — contests, boards, redemptions, prize tiers, memberships — so the audit record and the response state what was destroyed, counted before anything is.
3. **Blocking audit** (`tenant_delete`). No record, no deletion. The row is **platform-scoped — it omits `organizationId` and carries the tenant's id, subdomain, and the counts in `detail`** — because step 5 deletes the tenant's audit rows: an audit row keyed to the organization it records the destruction of would be swept by its own teardown. The optional-`organizationId` convention already means "no single surviving target" (admin-obs-internal Rule 9); a deleted tenant is the limiting case. The one loss is accepted and stated: the tenant's *other* audit history dies with the tenant, and the `tenant_delete` row is the durable tombstone.
4. **Clerk organization first**, resolved by slug. A missing org is success, not an error — half-torn pairs must be finishable, which is also what makes a failed delete retryable. A Clerk *failure* stops everything: the database is untouched and the operator retries.
5. **Database teardown**, the dev script's order with its known gap fixed: redemptions by contest id **as a string** (the redemption model stores it that way, and anonymized fans' rows still belong to the tenant), boards by contest, **prize tiers referenced by the tenant's contests** — the script orphans these; the endpoint does not — excluding any tier some other tenant's contest also references (none should exist, but a shared row must not be collateral), then contests, fan memberships, the tenant's audit rows, and the organization record last.
6. **Fan identities are never touched.** A fan may belong to several tenants; membership rows die with the tenant, the identity does not (`SEC-07` erasure remains the fan-deletion flow's job).
7. `clearOrgCache()`.

The response reports the Clerk outcome (`deleted` / `not_found`) and per-collection deletion counts — the operator sees exactly what the action did, not a bare success.

**Console aftermath:** the frontend refreshes both the directory and the session-wide tenant list that feeds the sidebar switcher. `TenantContext` already derives "unchosen" when the acting-on slug vanishes from a refetched `GET /admin/tenants`, so deleting the tenant an operator was standing on drops the console back to no-tenant-chosen rather than leaving it naming a ghost.

---

## Audit actions

Four additive entries in `ADMIN_AUDIT_ACTIONS`: `tenant_rename`, `tenant_suspend`, `tenant_resume`, `tenant_delete`. Suspend, resume, and delete write **blocking, before the state change**; rename writes after success (argued above). `detail` carries ids, subdomains, counts, and — for rename — the two display names; never emails, never fan data.

---

## Endpoints

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/admin/tenants/rename` | requireAdmin, obs-only in handler, `?tenant=` | `{ name }` |
| POST | `/admin/tenants/suspend` | requireAdminReverified, obs-only, `?tenant=` | — |
| POST | `/admin/tenants/resume` | requireAdminReverified, obs-only, `?tenant=` | — |
| POST | `/admin/tenants/delete` | requireAdminReverified, obs-only, `?tenant=` | `{ confirmSubdomain }` |

Contracts live in `obs-b2b-shared/src/api/admin/tenants.ts` beside the provisioning contract. `GET /admin/tenants/directory` rows additionally carry `status` and `suspendedAt`; `GET /admin/health`'s tenant scope carries an optional `status` (absent means active) so a tenant user's console can say the workspace is paused; `GET /b2b/org/:subdomain` carries the public `suspended` boolean.

---

## The console surface

Everything lives where the operator already is: the All-tenants drill-in drawer, plus a "Paused" badge on the directory row. In customer-visible copy the words are **pause / resume / paused** — "suspend" is the API's word, not the operator's.

- **Display name** — an inline field with the current name, a save that appears when it changes, and a plain statement that the web address never changes.
- **Availability** — pause/resume. Pause expands to state what it does (fans blocked immediately-ish, nothing deleted, resumable) before its confirming button; both are wrapped in `useReverification` with the standard cancel handling ("nothing was paused").
- **Delete this tenant** — the `FinalizeZone` idiom: collapsed danger button → expanded consequences (what is removed, that fan accounts survive, that it cannot be undone) → typed subdomain gating the button → reverification → the server re-checks the typed value.

For a **tenant user** whose organization is suspended: a console-wide banner ("paused — changes are turned off, your data is safe"), write controls disabled via `useCanWrite`, reads untouched. The server refuses the writes regardless, as always.

The **fan app** renders a full-screen paused message in the tenant's branding when the boot read says `suspended` — calm, plain, no jargon, with the reassurance that progress and prizes are safe. It must never fall through to wrong branding or a raw error.

---

## Rules

1. **Every lifecycle endpoint refuses a non-obs caller with 403 before resolving anything.**
2. **The subdomain never changes; the display name changes in Clerk and the database both-or-neither**, with a loud, named divergence when an unwind fails.
3. **A missing `status` means active.** No backfill; no reader may treat absence as anything else.
4. **Suspension is enforced server-side at two seams**: the fan tenant resolver (all of `/b2b/*`) and the tenant-config write gate. UI hiding is never the boundary.
5. **Suspend, resume, and delete write a blocking audit row before the state change.** Rename audits after success, and the spec says why.
6. **The `tenant_delete` audit row is platform-scoped and survives the teardown.** The tenant's other audit rows do not, and that is stated, not hidden.
7. **Delete never touches fan identities**, and never touches a prize tier another tenant's contest references.
8. **A missing Clerk organization never blocks a delete** (half-pairs must be finishable) **and always blocks a rename** (there is nothing to keep in sync).
9. **Every lifecycle write clears the fan-side org cache**; cross-process staleness is bounded by the 60-second TTL and accepted.

## References

- [`admin-surface.spec.md`](admin-surface.spec.md) — Rules 4, 10, 11; the reverification list; "Revocation latency" for the accepted-staleness posture.
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the All-tenants screen, provisioning, and the superseded offboarding scope-out.
- `node-server/scripts/delete-tenant.mjs` — the teardown order's origin, kept as dev tooling.
