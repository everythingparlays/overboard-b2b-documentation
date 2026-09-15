# Core Module Spec: Admin Surface — Access Framework

**Implements:** HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-10`, `IDN-12`, `IDN-13`. PRD `ADM-01`, `ADM-02`, `ADM-09`, `SEC-08`, `RPT-02`.

**Status:** Draft. No open questions remain — ready for review.

## Overview

The access framework for the internal/tenant admin application: who can sign in, what they can reach, and how the backend tells them apart from fans.

**The whole change, in one line:** a second Clerk instance, Clerk Organizations for scope, and an `/admin/*` route surface that shares a process with `/b2b/*` but nothing else.

**In scope:** the Clerk instance, organization topology, roles, the two-instance backend mechanism, the `/admin/*` middleware contract, and the frontend app's shape.

**Not in scope:** what the admin surface *does*. Tenant/game/prize configuration (`ADM-04`, `BRAND-02`), consent config (`ADM-05`), contest finalization (`ADM-06`), reporting (`ADM-07`, `RPT-*`), and the health dashboard (`OBS-04`) each need their own spec. This one exists so those can be built without re-litigating access.

---

## A separate Clerk instance

Admin authenticates against its **own Clerk instance**, not the fan instance. Three instance-wide settings force this; none can be scoped to a subset of users:

| Setting | Admin needs | Fans need |
|---|---|---|
| Require MFA | On (`SEC-08`) | Off — cannot impose on 50k consumers |
| Organization membership | Required | Personal accounts, no org |
| Sign-in methods | Locked down | Per-variant email/phone/Google (`IDN-09`) |

**MFA is required for every admin user** (decision, 2026-08), team users included. A team user editing per-game config or finalizing a contest is administrative access to production data under `SEC-08`. Scoping MFA to only PII routes was considered and rejected: Clerk's reverification silently downgrades a requested `multi_factor` check to `first_factor` when the user has no second factor enrolled, so route-level gating does not deliver MFA without enrollment enforcement anyway — which is the instance toggle again.

---

## Organization topology

Two kinds of organization. **The tenant org's Clerk slug is the tenant's subdomain** — one namespace, no mapping table, and `orgSlug` arrives in the session token so scope resolves without an extra lookup.

| Kind | Slug | Count | Members | Scope |
|---|---|---|---|---|
| Tenant | matches `B2BOrganization.subdomain` (`bears`) | one per team | that team's designated users | that tenant only |
| OBS | `obs` (reserved) | exactly one | OBS staff | cross-tenant |

`admin` is reserved the same way, one level up — it names `admin.overboardsports.com` itself rather than any organization, so it can never be a `B2BOrganization.subdomain` either (`TEN-C3`). Both `resolveAdminScope` and the fan-side `resolveTenant` check this list before touching the database.

**OBS staff belong to the single `obs` org rather than holding admin membership in every tenant org.** Both satisfy `RPT-02`'s requirement that the internal fan-actions export be unreachable by team users — the alternative does it with custom roles. The `obs` org wins because Clerk's active organization is one value per session: `OBS-04`'s cross-tenant health dashboard and `RPT-01`/`RPT-02`'s cross-tenant trends have no single active org that authorizes them, whereas membership in `obs` is a standing grant. The two are alternatives, not complements — adding staff to every tenant org *as well* grants nothing further and makes tenant provisioning O(staff).

**No sponsor organizations** (`IDN-11`). Sponsors receive exports; they do not sign in. A sponsor belongs to exactly one tenant (`TEN-04`, revised 2026-09) and carries that sponsor's DPA field scope (`RPT-04`), so sponsor configuration sits wholly inside one tenant's boundary — there is no shared record two teams' admins could both edit.

**Organization self-creation must be disabled on the admin Clerk instance.** "Provisioning and delegation" below defines exactly three ways an organization comes to exist: bootstrap creates `obs`, OBS staff create a tenant org at onboarding, a tenant `org:admin` invites within their own org. A signed-in user with no other path into the admin app can otherwise use `<OrganizationSwitcher>`'s own "Create organization" action to make an arbitrary fourth org on the spot — Clerk permits this by default, and nothing in `resolveAdminScope` distinguishes that org from a real one until its slug fails to resolve to a tenant. The result is a 404 that looks like a provisioning bug from the caller's side when it's actually an unrestricted instance setting. **This must be turned off** (Clerk Dashboard → the admin instance → Organization Settings → restrict who can create an organization) so the three tiers above are the only ways in, not merely the intended one.

---

## Roles and permissions

Clerk's system roles carry org management; custom permissions carry ours. Naming follows `org:<resource>:<action>` (system permissions are `org:sys_*` and must not be invented).

A tenant org has two Clerk roles in V1, distinct in what each is *for*: `org:admin` — the person(s) who can invite/remove teammates (see "Provisioning and delegation") — and `org:member`, everyone else. Neither currently holds write access to tenant config; that's the read/write split below, not the admin/member split.

| Permission | Grants | Held by |
|---|---|---|
| `org:tenant_config:read` | View active games, prize tiers, sponsor assets, and contest performance (`ADM-02`) | tenant `org:admin` + `org:member`, obs `org:admin` + `org:member` |
| `org:tenant_config:manage` | The same, **write** — per-game elements: sponsor assets, prize tiers, active games (`BRAND-02`, `GAME-01`) | obs `org:admin` + `org:member` only. **Not yet granted to any tenant role in V1** — extending it to tenant `org:admin` is `ADM-03` **[FUTURE]**. |
| `org:reports:read` | Tenant-scoped reports (`RPT-01`–`RPT-03`) | all admin roles, scoped to the caller's org |
| `org:fan_data:export` | The internal fan-actions export (`RPT-02`) — **PII** | obs only |
| `org:contest:finalize` | Manual contest finalization (`PRIZE-03`) | **obs only** |

Three permissions must never appear on a tenant org's role set in V1:

- `org:tenant_config:manage` — `ADM-02` scopes the V1 team-user role to read-only; write is `ADM-03` **[FUTURE]**. Granting this to a tenant role is the one-line change that ships it, and should happen deliberately, not as a side effect of some other change.
- `org:fan_data:export` — `RPT-02` states the internal fan-actions export is for OBS product analysis and is not shared with teams or sponsors; §11.2's acceptance criterion states it is not accessible to team or sponsor users.
- `org:contest:finalize` — **OBS staff only** (decision, 2026-09). Finalization triggers real, irreversible prize sends, and failed sends degrade sender reputation for *every* tenant on the platform (`PRIZE-06`). The authority sits with the party that operates the platform and absorbs that cost, not the party that benefits from the activation.

This is where all three are enforced.

---

## Provisioning and delegation

Three tiers, each delegating to the next (decision, 2026-09):

| Step | Who | Does what |
|---|---|---|
| Bootstrap | An engineer, by hand, once | Creates the `obs` organization and its first member |
| Tenant onboarding | OBS staff | Creates the tenant's Clerk organization and invites its first admin — with `org:tenant_config:read` only; `org:tenant_config:manage` is not granted until `ADM-03` ships |
| Ongoing | That tenant's `org:admin` | Invites and removes users **within their own organization only** |

This keeps `TEN-03`'s ≤2-hour onboarding budget intact: OBS creates one org and sends one invitation, and the team administers itself from there.

The delegation boundary is enforced by Clerk's own `org:sys_memberships:manage` permission, scoped to the caller's active organization — a tenant admin cannot reach another organization's membership because the permission is evaluated against the org in their session. **No custom code should re-implement this**, and none should let a tenant admin name an organization.

Only the bootstrap step is manual, and it happens once for the life of the platform.

**Last-admin removal is unguarded [P2]** (decision, 2026-09). Clerk lets a tenant admin remove the last admin in their own organization, locking the team out of its admin. Accepted: recovery is OBS re-inviting them, and it is not expected behaviour. Add a guard if it happens rather than building for it now.

---

## Session lifetime

| Setting | Value | Why |
|---|---|---|
| Session lifetime | **8 hours** | One working day. An admin signs in each morning; a session cannot survive overnight on a lost or shared laptop. |
| Inactivity timeout | **1 hour** | An unattended desk stops being a standing grant to production config and fan PII. |
| Reverification window | **10 minutes** (Clerk's maximum) | Long enough to complete a task, short enough that a walked-away session cannot finish a destructive one. |

Fan sessions stay long-lived and unaffected — they are on a different instance, which is part of why the instances are separate.

**8 hours rather than Clerk's multi-day default** because an admin session is a standing grant to production configuration and, for OBS staff, cross-tenant fan PII. The cost is one TOTP entry per morning; the benefit is that a session compromised at 6pm is useless by the next morning.

### Actions requiring reverification

Re-prompt for credentials inside an already-MFA'd session (`IDN-13`) before anything **irreversible or PII-releasing**:

- Exporting fan data (`RPT-01`, `RPT-02`) — releases PII
- Deleting a fan's data (`SEC-07`) — irreversible, and legally consequential
- Finalizing a contest (`PRIZE-03`) — triggers real prize sends to real fans; cannot be undone
- Deleting a prize tier, sponsor, or game configuration — silently changes what fans can win
- Removing an organization member or changing their role — the path to locking a tenant out of its own admin

The common thread is *cannot be undone by clicking again*. Editing a sponsor logo does not qualify; deleting the sponsor does.

---

## Two Clerk instances, one backend

`clerkMiddleware()` accepts `secretKey` / `publishableKey` / `clerkClient` (verified against `@clerk/express` 1.7.74), so instances are selected by mount path rather than by a second service:

```
app.use("/b2b",   clerkMiddleware({ clerkClient: fanClerk }));
app.use("/admin", clerkMiddleware({ clerkClient: adminClerk }));
```

This replaces today's single global `app.use(clerkMiddleware())` in `server.ts`, which reads `CLERK_SECRET_KEY` from the environment and would authenticate admin callers against the fan instance. **That global call must go**; leaving it means an admin token silently failing to verify, or worse, a fan token being accepted on `/admin/*`.

New environment: `ADMIN_CLERK_SECRET_KEY`, `ADMIN_CLERK_PUBLISHABLE_KEY`, stored in Secrets Manager alongside the existing pair (`main-api-service.ts` already wires both fan keys; the admin pair follows the same shape).

---

## Route surface

`/admin/*` gets its own middleware chain. It shares `wrapHandler`, validation, and the response-contract machinery with `/b2b/*`; it shares no auth.

`requireAdmin` composes:

1. **Clerk auth** against the admin instance — 401 without a session.
2. **`resolveAdminScope`** — reads `orgSlug` from the session. `obs` sets `req.adminScope = { kind: "obs" }`; anything else resolves to a `B2BOrganization` by subdomain and sets `{ kind: "tenant", tenant }`. 403 when the caller has no active organization, 404 when a tenant slug names nothing.
3. **`requirePermission(p)`** — `has({ permission: p })` per route.

Handlers read `req.adminScope`. **No admin handler takes a tenant identifier as a parameter** — the same rule as `IDN-04`, for the same reason, and the reason a cross-tenant read was possible on the fan surface. A route that needs to act on a tenant an OBS staff member selected takes it as an explicit argument *and* verifies `req.adminScope.kind === "obs"` before honouring it; a tenant-scoped caller may never name a tenant.

**Reverification on PII** (`IDN-13`, [P2]): export and deletion routes require a fresh credential check within a short window, on top of the MFA'd session. This narrows the blast radius of an unattended session on the highest-consequence actions; it is not a substitute for MFA.

`POST /b2b/contest/prize-tier` moves here. It is currently on the fan surface behind `requireMembership`, which means any *fan* of a tenant can write prize config — an interim measure, not a model.

---

## Frontend

A **separate application and deployment** at `admin.overboardsports.com`, not a route inside `overboard-b2b-template`.

The fan template is tenant-branded and deployed per tenant; admin is one deployment serving all tenants, with its own Clerk publishable key, its own theme, and an org switcher instead of tenant resolution. Sharing a bundle would ship admin code to every fan and put two Clerk instances in one page.

- `<OrganizationSwitcher hidePersonal />` for OBS staff moving between tenants. Tenant users see one org and should not be shown a switcher at all.
- Route guards read `orgSlug` and `has({ permission })` from the session — the same pattern as the fan `ProtectedRoute`, different inputs.
- **The URL's tenant must be checked against the session's `orgSlug` on every scoped page.** A stale `orgSlug` after an org switch otherwise renders one tenant's data under another's URL.

---

## Rules

1. **No admin handler takes a tenant identifier as a parameter.** Scope comes from `req.adminScope`. The exception — an OBS staff member acting on a chosen tenant — is explicit and verified, never implicit.
2. **`org:fan_data:export` never appears on a tenant org role set** (`RPT-02`).
3. **`org:tenant_config:manage` never appears on a tenant org role set in V1** (`ADM-02`/`ADM-03`). Team users get `org:tenant_config:read` only until `ADM-03` ships.
4. **The tenant org's Clerk slug equals `B2BOrganization.subdomain`.** Provisioning must create both or neither; a mismatch silently denies access.
5. **Admin routes are mounted under `/admin` and authenticate against the admin instance only.** A fan token must never satisfy an admin route.
6. **MFA is required instance-wide.** Do not add a per-route or per-role bypass.
7. **`admin` and `obs` are never a tenant's `B2BOrganization.subdomain`** (`TEN-C3`). Checked at onboarding and defensively in both `resolveAdminScope` and `resolveTenant`.
8. **Organization self-creation is disabled on the admin Clerk instance.** The three provisioning tiers are the only ways an organization comes to exist — a user's own "Create organization" action is not a fourth.

---

## References

- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-10`–`IDN-13`
- PRD: [`TEN-03`, `TEN-05`, `TEN-C3`, `ADM-01`–`ADM-09`, `BRAND-02`, `GAME-01`, `PRIZE-03`, `RPT-01`–`RPT-05`, `SEC-07`, `SEC-08`, `OBS-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — the fan-side model this deliberately does not share
