# Core Module Spec: Admin Surface — Access Framework

**Implements:** HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-10`, `IDN-12` (`IDN-13`'s step-up is ruled out, 2026-09-28). PRD `ADM-01`, `ADM-02`, `ADM-09`, `SEC-08`, `RPT-02`.

**Status:** Draft. No open questions remain — ready for review.

**Revised 2026-09-16** (ruling, Nick) — tenant self-service ships now, OBS-ness is a property of the user rather than the active organization, and the console has one switcher. The sections marked with that date carry the change; nothing else in this spec moved.

**Revised 2026-09-16** (ruling, Arthur) — a third principle, **Fan's-eye view**: where configuration reflects onto the fan app, the console shows the fan's view of it, rendered from the fan product's own code. Principles, Rule 12, and the reflect-point inventory carry the change.

**Revised 2026-09-22** (ruling, Arthur) — a fourth principle, **Honesty by omission, not by narration**: the console never fabricates and never narrates its own gaps — an unmeasured stat gets no tile, an unwired feature gets no card, a real number gets no provenance caveat. Principles and Rule 13 carry the change, and it supersedes any requirement in a sibling spec to disclose a gap on screen.

**Revised 2026-09-24** (ruling, Arthur) — the S1 console redesign. Sponsors become their own Configuration item, separate from Brand; Prize deliveries replaces Prizes (and, across workspaces, the Delivery queue); Emails joins Configuration; contests, prize tiers, sponsors, fans and the staff tenant record become full pages with their own routes. "Pages, drawers and dialogs" (Rule 14) decides what is a page and what stays a drawer, and "Staff extras on tenant screens" (Rule 15) lists the staff-only controls the redesign adds. The Navigation table, the new page-route table beneath it, the reverification list and Rules 14–15 carry the change; nothing else moved.

**Revised 2026-09-27** (Wave 4, Arthur's rulings of 2026-09-27) — Prizes returns as a sidebar item with Library and Deliveries tabs, and the Emails item folds into Deliveries; the contest page loses its Board tab and the builder its Board step; the builder keeps the sidebar; any non-finalized contest can be deleted; every asset field is an upload box. See "Revision 2026-09-27 (Wave 4)" below; the Navigation table, the page-route table, the pages/drawers/dialogs tables, the staff-extras table, the hues table, the reverification list and Rule 16 carry it.

**Revised 2026-09-28** (Arthur's Wave 4 walkthrough ruling) — **no re-authentication anywhere, for everybody**: destructive actions keep the typed-name confirmation only, checked server-side. And **staff see a workspace's screens exactly as its admin or member would**: the 2026-09-24 staff extras are removed, apart from the listed exceptions. Staff triage support only in the OBS inbox. (Revised again 2026-09-28, final walk: Finalize is back on the workspace's contest card and page for staff only, and staff choose an Admin or Member point of view for the workspace; see "Staff point of view".) The focus ring fits each control's own shape. "No re-authentication", "Staff see what the workspace sees", "Focus ring", the Route surface, the dialogs paragraph and Rules 14–15 carry it.

**Revised 2026-09-28, final walk** (Arthur's final console walkthrough) — **staff act on every tenant the same way**, through the tenant choice and never an organization switch, and a real organization switch keeps the shell on screen; **staff get an Admin / Member point-of-view toggle** in place of the Console look control; **only pages that widgets point to keep a hue**; screens load on demand and reads are cached briefly. "One switcher", "Staff point of view", "Hues" and "Loading and caching" carry it.

## Overview

The access framework for the internal/tenant admin application: who can sign in, what they can reach, and how the backend tells them apart from fans.

**The whole change, in one line:** a second Clerk instance, Clerk Organizations for scope, and an `/admin/*` route surface that shares a process with `/b2b/*` but nothing else.

**In scope:** the Clerk instance, organization topology, roles, the two-instance backend mechanism, the `/admin/*` middleware contract, and the shape of the frontend app (`obs-b2b-admin-frontend`).

**Not in scope:** what the admin surface *does*. Tenant/game/prize configuration (`ADM-04`, `BRAND-02`), consent config (`ADM-05`), contest finalization (`ADM-06`), reporting (`ADM-07`, `RPT-*`), and the health dashboard (`OBS-04`) each have their own spec — the sibling `admin-*.spec.md` files. This one exists so those could be built without re-litigating access.

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

**A tenant's `B2BOrganization` record and its Clerk organization are a synced pair at all times.** Create, modify, delete — always both or neither, in one place, which is why `POST /admin/tenants` performs both writes (OBS Internal spec, "Create tenant"). The DB tenant directory is the source of truth for *what tenants exist*; a Clerk org with no record behind it is not a tenant, and a record with no Clerk org is a tenant nobody can sign in to. Once the two are reconciled the distinction stops mattering, because they match by definition.

**Data debt, queued for reconciliation** (not fixed by this revision): `warriors` and `fightinghawks` are `B2BOrganization` records with no Clerk organization. `bears` has a Clerk organization that was self-created by an unrelated user and is *not* the provisioned pair of the `bears` record. All three predate the invariant; reconciling them is its own task.

**Organization self-creation must be disabled on the admin Clerk instance.** "Provisioning and delegation" below defines exactly three ways an organization comes to exist: bootstrap creates `obs`, OBS staff create a tenant org at onboarding, a tenant `org:admin` invites within their own org. A signed-in user with no other path into the admin app can otherwise use `<OrganizationSwitcher>`'s own "Create organization" action to make an arbitrary fourth org on the spot — Clerk permits this by default, and nothing in `resolveAdminScope` distinguishes that org from a real one until its slug fails to resolve to a tenant. The result is a 404 that looks like a provisioning bug from the caller's side when it's actually an unrestricted instance setting. **This must be turned off** (Clerk Dashboard → the admin instance → Organization Settings → restrict who can create an organization) so the three tiers above are the only ways in, not merely the intended one.

---

## OBS-ness is user-level (ruling, 2026-09-16)

**Being OBS staff is a property of the user, not of the organization they currently have active.** The old model read staff-ness off the active org — `orgSlug === "obs"` — which made an OBS operator stop being OBS the moment they switched into a tenant org to do tenant work. That is the wrong shape: an operator does not resign by changing what they are looking at.

Resolution has two paths, and the cheap one is the common one:

1. **The `obs` org is active.** The signed session token carries `orgSlug: "obs"`, which *is* proof of membership — Clerk signed it. No lookup happens.
2. **Any other org is active** (or none). The backend verifies the user's membership in the `obs` Clerk organization through the Clerk Backend API, looked up by the user id from the verified session.

Path 2 is cached in-process, **5-minute TTL, positive and negative results alike** — a negative cache matters more than a positive one, since every tenant user takes path 2 on every request and must not cost a round trip each time. **Errors fail closed and are not cached**: a Clerk outage denies obs powers for the duration rather than granting them, and does not pin that denial for five minutes after Clerk recovers.

**Revocation latency, stated plainly.** Removing a user from the `obs` org does not take effect instantly. On path 2, their obs powers persist for **up to 5 minutes** per process — each process caches independently, so the observed worst case is one TTL, not one TTL per process. On path 1 no lookup happens at all, so revocation follows Clerk's own session-claim refresh: the token keeps asserting `obs` until Clerk reissues it. Both windows are accepted. Removal from the `obs` org is a deliberate act with a known lag, not an emergency kill switch; an account that must be stopped immediately is stopped at the user, not at the membership.

**Obs powers follow the user, whatever org is active.** Concretely:

- **OBS Internal endpoints and screens authorize on user-level obs-staff-ness**, not on the active org. An operator with a tenant org active still reaches `/platform-health`, `/obs/prizes` (All prizes), `/fan-actions` and the finalize route.
- **`?tenant=` targeting works for obs staff whatever org is active**, defaulting to the active tenant org when no `?tenant=` is given. Explicitness is unchanged — the request still names the tenant (see "Route surface").
- **Non-obs users are exactly as before.** Their scope is their active organization, they may never name a tenant, and nothing above is reachable.

**The health contract carries `scope.isObsStaff`** alongside the existing `scope` shape. Additive and backward compatible: existing fields keep their meaning, and a client that ignores the new one behaves as it did.

---

## Roles and permissions

Clerk's system roles carry org management; custom permissions carry ours. Naming follows `org:<resource>:<action>` (system permissions are `org:sys_*` and must not be invented).

A tenant org has two Clerk roles in V1, distinct in what each is *for*: `org:admin` — the person(s) who can invite/remove teammates (see "Provisioning and delegation") — and `org:member`, everyone else. **As of the 2026-09-16 ruling the two also carry the read/write split for that org's own configuration**: `org:admin` writes, `org:member` views. The role arrives in the session token's org-role claim; the console reads it to decide which controls render, and the server reads it to decide which writes it honours.

| Permission | Grants | Held by |
|---|---|---|
| `org:tenant_config:read` | View active games, prize tiers, sponsor assets, and contest performance (`ADM-02`) | tenant `org:admin` + `org:member`, obs `org:admin` + `org:member` |
| `org:tenant_config:manage` | The same, **write** — per-game elements: sponsor assets, prize tiers, active games (`BRAND-02`, `GAME-01`) | obs `org:admin` + `org:member`, tenant `org:admin` (ruling 2026-09-16, Nick — `ADM-03` shipped). Not tenant `org:member`. |
| `org:reports:read` | Tenant-scoped reports (`RPT-01`–`RPT-03`) | all admin roles, scoped to the caller's org |
| `org:fan_data:export` | The internal fan-actions export (`RPT-02`) — **PII** | obs only |
| `org:contest:finalize` | Manual contest finalization (`PRIZE-03`) | **obs only** |

**`org:tenant_config:manage` is granted to tenant `org:admin` as of 2026-09-16.** A team administers its own workspace and configuration — signup fields and opt-ins, games and contests, prizes, its sponsors' DPA field scope — for its own organization, without an OBS operator in the loop. `ADM-02`'s read-only V1 grant is superseded; it survives as the `org:member` grant. The change is deliberate, ruled, and dated, which is what the old "not as a side effect of some other change" caution asked for.

Two permissions must never appear on a tenant org's role set:

- `org:fan_data:export` — `RPT-02` states the internal fan-actions export is for OBS product analysis and is not shared with teams or sponsors; §11.2's acceptance criterion states it is not accessible to team or sponsor users.
- `org:contest:finalize` — **OBS staff only** (decision, 2026-09). Finalization triggers real, irreversible prize sends, and failed sends degrade sender reputation for *every* tenant on the platform (`PRIZE-06`). The authority sits with the party that operates the platform and absorbs that cost, not the party that benefits from the activation.

This is where both are enforced.

**Fan-data deletion stays with OBS, and is not a permission row.** `SEC-07` erasure has no `org:*` permission of its own — it is gated structurally on obs staff-ness — so it needs naming as a boundary rather than a table entry, or it would look like an oversight once tenant config became writable. Deletion is an irreversible PII lifecycle action: the party that executes an erasure obligation end-to-end is the platform operator, and a mistaken deletion cannot be undone by clicking again. This is Arthur's explicit default, reaffirmed in the 2026-09-16 ruling as one of the exclusions that stays OBS-only alongside contest finalization, the OBS Internal surface, and cross-tenant access.

---

## Provisioning and delegation

Three tiers, each delegating to the next (decision, 2026-09):

| Step | Who | Does what |
|---|---|---|
| Bootstrap | An engineer, by hand, once | Creates the `obs` organization and its first member |
| Tenant onboarding | OBS staff | Creates the tenant's Clerk organization and invites its first admin — as `org:admin`, which since 2026-09-16 carries `org:tenant_config:manage`: the team configures its own workspace from day one |
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

Fan sessions stay long-lived and unaffected — they are on a different instance, which is part of why the instances are separate.

**8 hours rather than Clerk's multi-day default** because an admin session is a standing grant to production configuration and, for OBS staff, cross-tenant fan PII. The cost is one TOTP entry per morning; the benefit is that a session compromised at 6pm is useless by the next morning.

### No re-authentication (revised 2026-09-28)

No console action asks an admin to re-enter credentials inside an already-MFA'd session, whoever they are (Arthur's Wave 4 walkthrough ruling; this retires the `IDN-13` step-up the earlier list described). There is no reverification window, no `requireAdminReverified` route mode, and no `ADMIN_REVERIFICATION_ENFORCED` switch. What guards the **irreversible** actions is the typed confirmation, checked again on the server:

| Action | Typed confirmation |
|---|---|
| Finalize a contest (`PRIZE-03`) | The contest's name |
| Delete a contest, fans joined or not (end-to-end-flow.spec.md §3.2) | The contest's name |
| Delete a sponsor | The sponsor's name |
| Delete a fan's data (`SEC-07`) | The fan's display name |
| Delete a tenant | Its subdomain |
| Send a sent prize again (staff) | The fan's display name, and a reason |

Exporting fan data (`RPT-01`, `RPT-02`) and revealing contact fields release PII, so each is audited; neither asks for credentials. Suspending and resuming a tenant, removing a team member and changing a role, publishing Overboard's own documents, and resending failed prizes run on their confirm dialog alone. Clerk's own API may still ask the user to prove who they are for an organization membership change, depending on the instance's settings; the Team page then says "Sign out and sign back in, then try again."

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

Handlers read `req.adminScope`. **No admin handler takes a tenant identifier as a parameter** — the same rule as `IDN-04`, for the same reason, and the reason a cross-tenant read was possible on the fan surface. The one exception is **an OBS staff member acting on a chosen tenant**: the route takes the tenant as an explicit argument *and* verifies the caller is obs staff before honouring it. Since 2026-09-16 that verification is **user-level** (the resolution above), so it holds whatever organization the operator has active — including when they are inside a tenant org, where `?tenant=` defaults to that org and is still sent explicitly. A caller who is not obs staff naming a tenant is refused exactly as before, their own tenant included.

**No step-up** (revised 2026-09-28): every admin route authenticates with `requireAdmin` and nothing more. Export and deletion routes are audited, and the destructive ones re-check their typed confirmation in the handler ("No re-authentication" above).

`POST /b2b/contest/prize-tier` moves here. It is currently on the fan surface behind `requireMembership`, which means any *fan* of a tenant can write prize config — an interim measure, not a model.

---

## Frontend

A **separate application and deployment** at `admin.overboardsports.com`, not a route inside `overboard-b2b-template`.

The fan template is tenant-branded and deployed per tenant; admin is one deployment serving all tenants, with its own Clerk publishable key, its own theme, and an org switcher instead of tenant resolution. Sharing a bundle would ship admin code to every fan and put two Clerk instances in one page.

- **One switcher, in the sidebar** (ruling, 2026-09-16). The console previously had two selectors — Clerk's `<OrganizationSwitcher>` in the sidebar for *who you are*, and an "Acting on tenant" pill in the top bar for *which tenant you act on*. Two controls for one question is one too many, and which of the two applied depended on whether the target happened to be an org you were a member of — an implementation detail from the operator's side. **The top-bar pill is removed and Clerk's switcher is replaced by a custom sidebar switcher.**
- **What the switcher lists** (revised 2026-09-28, final walk). Every non-staff user sees their real Clerk organization memberships; selecting one calls Clerk's `setActive`. **OBS staff see Overboard's own organization first ("OBS internal"), then every tenant from `GET /admin/tenants`** — the DB tenant directory, which is the source of truth for what tenants exist. **Every tenant is chosen the same way, whether or not staff hold a Clerk membership in it: it sets the acting-on tenant, and staff stay in (or return to) the `obs` organization.** A staffer's own tenant memberships appear once among the directory's rows (deduped by slug) and behave exactly like them; choosing OBS internal clears the choice. There is no organization switch between tenants, so nothing reloads and the choice is never lost. A staffer an older session left active in a tenant organization is moved back to `obs` once, the first time they choose anything, with the new choice written before the move. The directory's first page is read as soon as health says staff, so every row is there when the list opens; search and paging run on the server as before. **Pending invitations are listed too**, after the user's own organizations: choosing one accepts the invitation and switches to that organization, the same way picking a membership does, and a join that fails says so and leaves the user where they were. The switcher is the console's one place to accept an invitation — Clerk's sign-in step offers invitations only while no organization is active, and the active one survives sign-out, so without it a user invited to a second organization would stay locked into their first. The same reasoning decides who gets a switcher at all: a user with one organization and nowhere else to go sees it as a fixed card, and a pending invitation counts as somewhere else, so it earns the switcher in place of the card.
- **A real organization switch keeps the shell** (revised 2026-09-28, final walk). For a member of several organizations the switch is Clerk's. The sidebar, top bar and switcher stay on screen with the previous organization's scope while the new one's `/admin/health` loads; only the page content waits, behind a quiet in-content loading state, and it is keyed on the organization, so no screen ever renders on the previous organization's answer. The full-screen "Checking your admin access" state is only for a session's first answer.
- **The acting-on machinery stays as wiring; only its UI goes.** The `TenantContext` that held the console-wide choice is unchanged underneath — set once, applies to every per-tenant screen, survives routes and reloads, dropped at sign-out, reset when the stored slug no longer appears in `GET /admin/tenants`. It changes nothing about the wire: **every OBS request still names the tenant explicitly as `?tenant=<slug>`**, including when the operator is acting on their own active tenant org. Explicit, never implicit.
- **"Create organization" appears for OBS staff only**, and routes to the console's own All-tenants Create-tenant flow (`POST /admin/tenants`, OBS Internal spec) — never Clerk's widget, which creates a Clerk org with no `B2BOrganization` behind it and breaks the synced-pair invariant. A non-obs user never sees the entry, and Rule 8 still stands: self-creation is disabled instance-wide, so the entry is a link to the one provisioning path rather than a second one.
- **Cross-tenant screens are not filtered by the selection.** All tenants, Platform health and Prize deliveries (all workspaces) answer questions about the set of tenants and ignore it (the All-tenants drawer flows the other way: it *sets* the selection and opens that tenant's Overview; since 2026-09-24 that drawer is the tenant page, whose "Open as this tenant" does the same). Fan actions already had a tenant filter, so the selection pre-fills it, with "All tenants" still available. Team ignores it — membership reads the active organization from the session, not a tenant slug.
- Route guards read `orgSlug` and `has({ permission })` from the session — the same pattern as the fan `ProtectedRoute`, different inputs.
- **The URL's tenant must be checked against the session's `orgSlug` on every scoped page.** A stale `orgSlug` after an org switch otherwise renders one tenant's data under another's URL.

### Navigation

One nav structure, three sections. Same screens for both actor classes (`ADM-01`) — the difference is which sections render and what the switcher lists, never a different app or a different route table.

| Section | Destination | Route | Implements |
|---|---|---|---|
| Workspace | Overview | `/` | `ADM-06`, `ADM-07` (games, KPIs, reporting surfaced on one screen) |
| | Game day | `/live` | `OBS-04`, `OBS-05` — [`admin-game-day.spec.md`](admin-game-day.spec.md) |
| | Schedule | `/schedule` | The workspace's season, and All games — [`admin-schedule.spec.md`](admin-schedule.spec.md) |
| | Games & Contests | `/games` | `ADM-04`, `BRAND-02`, `GAME-01`–`GAME-04` — [`admin-contests.spec.md`](admin-contests.spec.md) |
| | Prizes | `/prizes` (tab Library), `/prizes/deliveries` (tab Deliveries), `/prizes/email` (tab Email: the prize email settings; revised 2026-09-28) | `PRIZE-01`, `PRIZE-07` — the tenant's prize library and every send, failure and resend; [`admin-prizes.spec.md`](admin-prizes.spec.md) (revised 2026-09-27: replaces the 2026-09-24 "Prize deliveries" item and the Emails item) |
| | Fans | `/fans` | `RPT-02` view, scoped — not the export itself |
| | Exports | `/exports` | `ADM-07`, `RPT-01`–`RPT-06` |
| | Support | `/support`, `/support/:reportId` | The workspace's reports and their threads — [`admin-support.spec.md`](admin-support.spec.md) |
| Configuration | Fields & Opt-ins | `/config` | `ADM-05`, `AUTH-02`, `OPT-01`–`OPT-05`, including each opt-in's linked document — [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) |
| | Sponsors | `/sponsors` | `BRAND-02`–`BRAND-04`, `TEN-04` — its own item and hue, separate from Brand; [`admin-sponsors.spec.md`](admin-sponsors.spec.md) |
| | Brand | `/branding` | `BRAND-01`, `TEN-C1` — [`admin-branding.spec.md`](admin-branding.spec.md). Unchanged in Wave 4 apart from upload fields and Wave 3's font removal; Brand page v2 is built on the Wave 5 branch |
| | Team | `/team` | The chosen workspace's membership; staff see it as the workspace's admin does ([`admin-team.spec.md`](admin-team.spec.md)) |
| OBS Internal | Operations | `/operations` | The staff home — [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) |
| | All tenants | `/tenants` | Cross-tenant tenant list/switcher target |
| | All contests | `/contests` | [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) |
| | Season calendar | `/season` | `OBS-04` at planning horizon — [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), [`admin-schedule.spec.md`](admin-schedule.spec.md) |
| | Platform health | `/platform-health` | `OBS-01`–`OBS-05` |
| | Prize deliveries (all workspaces) | `/obs/prize-deliveries` | `PRIZE-06`/`PRIZE-07` — every workspace's sends, with a Tenant column and filter; [`admin-prizes.spec.md`](admin-prizes.spec.md) |
| | Fan actions | `/fan-actions` | `RPT-02`, `org:fan_data:export` |
| | Support inbox | `/inbox` | [`admin-support.spec.md`](admin-support.spec.md) — every workspace's reports; rows open `/support/:reportId` |

There is **no Emails item** (2026-09-27): the tenant's prize email settings (sender name, reply-to, subject) are Prizes' **Email** tab (revised 2026-09-28: their own tab, not inside Deliveries).

**Redirects** (old links keep working):

| Old route | Goes to |
|---|---|
| `/prize-deliveries` | `/prizes/deliveries` |
| `/settings/emails` | `/prizes/email` |
| `/prizes?contest=<id>` | That contest's Prizes tab, `/contests/<id>/prizes` |
| `/branding/sponsors` | `/sponsors` |
| `/delivery-queue` | `/obs/prizes/deliveries` |
| `/obs/prize-deliveries` | `/obs/prizes/deliveries` (query kept; Walk #3) |

Not in the nav, reached from a game: **Game recap** (`/recap`, [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md)). An Overboard staffer with no tenant chosen lands on Operations rather than on Overview's "Pick a tenant" card.

**Pages reached from a destination** (2026-09-24). Not sidebar items: each opens from a card, a row or a button on the destination named, keeps that destination active in the nav, and has a back link to it.

| Page | Route | Opened from | Spec |
|---|---|---|---|
| Contest page | `/contests/:id` (Overview), then `/contests/:id/games`, `/prizes`, `/sponsors`, `/preview` (revised 2026-09-27: the Board tab is gone) | Games & Contests cards and list rows; staff All contests rows and the tenant page's Contests rows, with `?tenant=` | [`admin-contests.spec.md`](admin-contests.spec.md) |
| Contest builder | `/contests/new`, then `/contests/:id/setup/<step>` once the draft exists — step is `basics`, `games`, `prizes`, `sponsors` or `review` | "New contest"; "Continue setup" on a draft | [`admin-contests.spec.md`](admin-contests.spec.md); a page in the main column with the sidebar visible and the steps as a clickable progress bar (revised 2026-09-27) |
| Prize page | `/prizes/new`, `/prizes/:prizeId` | Prizes → Library; a tier on a contest's Prizes tab | [`admin-prizes.spec.md`](admin-prizes.spec.md); full page, back to where it was opened |
| Sponsor page | `/sponsors/new`, `/sponsors/:sponsorId` | Sponsors cards; "New sponsor" | [`admin-sponsors.spec.md`](admin-sponsors.spec.md) |
| Fan page | `/fans/:membershipId` | Fans rows; support reports that carry a membership id | [`admin-fans.spec.md`](admin-fans.spec.md) |
| Tenant page (staff) | `/obs/tenants/:slug` | All tenants rows; staff links on tenant screens | [`admin-tenant-page.spec.md`](admin-tenant-page.spec.md) |

Every one of these routes that belongs to a tenant resolves its tenant exactly as its destination does: from the console-wide selection, and for staff from `?tenant=`, which sets the selection when it differs (the tenant page's slug is the one exception, and it too sends `?tenant=` on every request). The staff All contests list keeps `/contests`; the contest page's routes sit beneath it and are tenant-scoped, so `/contests` alone never renders a tenant's contest.

**Sections render by identity** (ruling, 2026-09-16), not by which part of the console the user is standing in.

**Workspace and Configuration render whenever a tenant context is selected** — a tenant org is active, or an obs staffer has set the acting-on tenant. They are not permission-gated at the section level: `org:tenant_config:read` covers viewing everything under them, and the write half is gated per control on the role claim (`org:admin` or obs staff), which is where a read/write difference belongs. **When an obs staffer has the `obs` org active and no tenant chosen, both sections are hidden** — not rendered as placeholders. There is no tenant to scope them to, and a section of screens that all say "pick a tenant" is a section that should not be on screen.

**OBS Internal renders whenever the user is obs staff**, regardless of which organization or tenant is selected — staff-ness is user-level, so the section does not disappear when an operator switches into a tenant org to do tenant work. A non-obs user never sees it. This is UX, not the enforcement: hiding the section spares a tenant user four dead links, but the boundary is server-side exactly as everywhere else in this spec.

**The "Pick a tenant" empty states stay** as the fallback for a deep link that arrives with no tenant chosen. Hiding a nav section does not make its routes unreachable, and a bookmarked URL must land somewhere honest.

### Pages, drawers and dialogs (ruling, 2026-09-24)

Arthur's walkthrough ruling: "Full pages instead of drawers for contest create/edit, prize tiers, the staff tenant page, fan detail and the sponsor editor. Small forms stay as drawers." The console had one modal surface, a 440px drawer, and used it for everything from a two-field export form to a fifteen-field prize editor with a preview tab. The ruling generalises into one principle:

**A drawer holds a small form. Anything with tabs, a preview, a list, or more than about eight fields is a page.** A page has a URL, so it can be linked from a support report, a colleague's message or another screen, and it has the width a preview or a table needs. A drawer keeps its place for what is quick and self-contained: open, fill in a few fields, done, back where you were.

**Drawers retired**, each replaced by a page or folded into one:

| Drawer | Becomes |
|---|---|
| New contest | The contest builder (`/contests/new`), a page with the sidebar visible |
| Contest settings | The contest page's Overview tab, with the state card and the danger zone |
| Add games | An inline picker inside the contest page's Games tab and the builder's Games step |
| Game row | The contest page's Games tab rows |
| Prize tier | The contest Prizes tab's ladder, and the prize page (`/prizes/:prizeId`) for the prize it names (revised 2026-09-27) |
| Prize email preview | The prize page's preview, and Prizes → Email |
| Sponsor editor | The sponsor page (`/sponsors/:sponsorId`), edited in place |
| Sponsor view | The sponsor page, read-only for members |
| Fan detail | The fan page (`/fans/:membershipId`) |
| Tenant detail | The tenant page (`/obs/tenants/:slug`) |

**Drawers that stay** (small forms): create tenant; tenant created; invite admin; invite or edit a team member; export; calendar day (Schedule and Season calendar); Tell Overboard; delivery detail (Prizes → Deliveries); opt-in, until the Fields & Opt-ins overhaul replaces it with its inline pattern.

**Confirmations are centred dialogs**, not drawers and not inline zones: Finalize, Delete (fan, tenant, sponsor, contest, prize, prize tier), Pause and Resume, Send again. Delete contest covers any contest that isn't finalized (revised 2026-09-27; [`admin-contests.spec.md`](admin-contests.spec.md)). Delete sponsor just works: it removes the sponsor from every placement and credit automatically and the dialog says what goes with it; it never asks the admin to remove the sponsor elsewhere first ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)). A dialog states the consequence in plain words, names the thing it acts on, and puts the confirming action on the right. Where it takes a typed confirmation (Finalize and delete a contest: the contest name; delete a sponsor: its name; delete a tenant: its subdomain; delete a fan: their display name), the confirming button is enabled only on an exact match and the server checks the typed value again. No dialog asks for credentials (revised 2026-09-28).

### Staff point of view (ruling, 2026-09-28, final walk)

The staff-only **Console look** control (Floodlight / Prime Time) is removed; Prime Time is parked. In its place, the sidebar footer carries an **Admin / Member** toggle ("View as"), shown only to staff with a tenant in view — a chosen tenant, or a tenant organization they sit in — and never on OBS internal. **Every tenant starts in the Admin view**; the choice is kept per user for the tab, beside the tenant choice, and resets when the tenant changes.

- **Admin view:** the tenant's screens exactly as its admin sees them. Staff keep write, and a paused tenant stays writable for them (the pause is for the tenant's own admins).
- **Member view:** the tenant's screens exactly as a member sees them. Every write control follows the one client-side write check, so it is off everywhere, with the member's read-only notes and messages; Team shows the roster only, with no invite, role change, removal or invitations, and "What this organization can do" speaks to a member.
- **In both views**, the staff operator tools Arthur keeps on tenant screens stay with staff: Finalize on the contest card and page, editing Overboard's own documents on Fields & Opt-ins, the paused banner's resume link, and the Fan page's fan-data-rights actions. Support triage and delete stay in the OBS inbox.

It is a view, not a permission: the server still answers staff as staff, and every tenant user's own role is unaffected.

### Staff see what the workspace sees (ruling, 2026-09-28)

Arthur's Wave 4 walkthrough ruling reverses the 2026-09-24 staff extras: **when Overboard staff have a workspace chosen, its screens show them exactly what that workspace's admin or member would see.** Staff-only work happens on the OBS pages: staff finalize a contest from **All contests** or the **tenant page** (and, since the final walk, from the workspace's contest card and contest page, marked Staff) ([`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), [`admin-tenant-page.spec.md`](admin-tenant-page.spec.md)), and triage support only in the **support inbox**, `/inbox` and `/inbox/:reportId` ([`admin-support.spec.md`](admin-support.spec.md)). What staff may *do* on a workspace screen is unchanged — they write tenant configuration as its admin does — only the staff-only controls and wording went.

**Removed from the workspace screens:**

| Screen | What went |
|---|---|
| Overview | The Overboard staff strip (status, subdomain, Team / Support / Open tenant record links) |
| Games & Contests cards and list rows | Finalize (restored for staff only, final walk 2026-09-28) |
| Contest page | Finalize in the header and the Overview tab's "What's next" rail (restored for staff only, final walk 2026-09-28). Tenant admins and members read "Overboard finalizes the contest after its last game." |
| Game day | The cross-workspace live strip, the prize worker's raw failure reason, and the Finalize contest link |
| Readiness checklist (Overview, Game day) | Staff-only fix links: a paused workspace has no fix link for anyone, and failed sends link to Game day for everyone |
| Fan page | The prize worker's raw failure reason; staff read the same plain words as the workspace |
| Support (`/support`, `/support/:reportId`) | Internal notes and the Internal badge, assign, acknowledge / resolve / reopen-as-staff triage, the jump to where it happened. Tenants and staff alike read, reply and reopen |
| Exports | The "Fan actions for this workspace" button |
| Team | The first-admin card with its staff badge, Resend, the Everyone / Admins / Members filter and the organization-name eyebrow; the staff view has the tenant screen's heading, banner and columns ([`admin-team.spec.md`](admin-team.spec.md)) |

**Kept, pending Arthur** — each has no other surface, or the tenant version would be untrue for staff:

| Where | What stays | The case |
|---|---|---|
| Shell | The paused banner's staff wording, "Fans can't play right now. Resume it from the tenant record." with the link | The tenant wording ("changes are turned off… contact Overboard") is untrue for staff, who can still write |
| Fields & Opt-ins | **Edit Overboard's documents** on Overboard's own opt-in | Publishing the platform Terms and Privacy for every team has no other surface |
| Brand | **Promote** on a saved preset | Publishing a preset to every tenant's gallery has no other surface |
| Fan page | **Delete fan** (`SEC-07`) and **Export this fan's activity** (`RPT-02`, one fan) | The fan-data-rights pair: OBS-only by design, and no OBS page acts on one fan |
| Team | The staff view reads and writes through the staff endpoints | Staff aren't Clerk members of the workspace, so Clerk's client can't reach its organization |
| Team | The "Overboard staff" label on a staff member's row | Tenant admins see the same label |

The prize Deliveries screens' staff controls (bulk resend, Send again, Send to a different address, the raw attempt reason) belong to the prizes rework ([`admin-prizes.spec.md`](admin-prizes.spec.md)) and are listed for it, not changed here.

---

## Hues (ruling 2026-09-24, revised 2026-09-28 final walk)

A hue marks a page only where widgets elsewhere point to it (Arthur's final walk: "back off every sidebar item has a colour"). Hues are **visible to everyone**, never a staff toggle. Alarm red stays exclusively status; no hue is red; every hue clears 4.5:1 on the card surface.

| Hue | Sidebar pages | Widgets that wear it |
|---|---|---|
| Games (violet) | Games & Contests; staff: All contests | Boards, contests and games KPI tiles; the games cards on Overview, Game day, a contest's Overview tab, the fan and tenant pages |
| Prizes (orange) | Prizes; staff: All prizes | Prizes-delivered tiles, prize tier and prize cards |
| Fans (cyan) | Fans | Fans-joined tiles, the fan profile card |
| Consents (pink) | Fields & Opt-ins | Overview's consent coverage card, the fan page's opt-ins card |
| Support (lime) | Support; staff: Support inbox | Support inbox tiles and patterns, a report's thread and answer, Platform health's oldest-report tile |

**Every other page** — Overview, Game day, Schedule, Exports, Sponsors, Brand, Team, Operations, All tenants, Season calendar, Platform health, Fan actions — gets **the same neutral near-white bar as Overview**. A card about none of the five takes no hue.

**Distinct at a glance.** The five sit at least 45 degrees apart on the colour wheel (51 or more today: orange, lime, cyan, violet, pink) and are fully saturated, so an outline points at one page and never reads as the neutral bar or a neutral white tenant accent. Each workspace hue names exactly one workspace page.

**Placement.**
1. **Sidebar:** a 3px bar inside the item's right edge, rounded, full item height minus the item's vertical padding. Resting at reduced strength, full strength on hover and on the active item. Absolutely positioned — the item's icon, label and badge never move, and the active item's existing left bar is untouched.
2. **In-page sections about one family:** the KPI tile's 2px top-wrapping inset outline (`KpiTile`), applied to any `Card` given `entity=`.
3. **Chart series:** unchanged.

Nothing else takes a hue: not status pills, text, numbers, buttons, or tables.

## Accent (ruling, 2026-09-28)

The console wears **the acting tenant's accent**: the colour its fans see on bingo-square hits, check badges and every progress bar (the theme resolver's `hit`, the first of primary, secondary and accent that reads on the fan app's ground). It tints the scope family (`--scope`, `--scope-text`, `--scope-soft`, `--scope-border`, `--scope-on`): the active nav item, the workspace card, eyebrows, table-head rules and the focus ring.

- **Source.** The server sends it as `brandColor` on `/admin/health`'s `scope.tenant` (the session's tenant), on `/admin/workspace` (the tenant staff chose) and on each `/admin/tenants` row. It is `brandAccent(effectiveTheme(subdomain, branding.theme))` from `obs-b2b-shared/src/theme/seeds.ts`: the theme saved on Brand, else the tenant's onboarding colours, which now live in that one shared file instead of the fan app's bundle.
- **No colour, no hue.** A tenant with no colours, or whose accent is a grey, black or white (the neutral look in either mode), gets `null`, and the console wears a clean neutral white accent (the `tokens.css` statics, the same `#e5e5e5` the fan app's neutral default uses). The OBS scope with no tenant chosen is neutral too. The console never invents a tenant colour: the old slug-hash palette is gone.
- **Legible on the console.** Text in the accent is lifted along its own hue to 4.5:1 on the console surface; the accent's own marks (dots, bars, fills) are lifted to 3:1, so a dark team colour still reads on the near-black console.
- **Follows a save at once.** After Brand saves, the console re-reads the accent (`useTenantAccent().refresh()`) without a reload.
- **Tenant colours are the only accent.** The staff "Console look" switcher is removed and Prime Time is parked; there is one console look.

## Loading and caching (2026-09-28, final walk)

- **Screens load on demand.** Each screen is its own chunk, fetched on first visit and, once the console has drawn, in the background while the browser is idle. The shell stays mounted while a screen arrives; the wait is a quiet in-content state, never the full-screen one. Charts, drag-and-drop, Clerk and React are separate long-lived chunks.
- **Reads are cached for 30 seconds**, keyed by the session token's user, session and active organization plus the exact path (`?tenant=` included), so one tenant's, organization's or user's answer is never served to another. Simultaneous asks share one request, and after 5 seconds a cached answer is re-read in the background. Any write drops the session's cache, a read in flight during a write is not kept, and sign-out and organization switches clear it. Live state that is polled (Game day, the support badge) always reads fresh.
- **The support badge** re-reads every 60 seconds while the tab is visible, pauses while it is hidden, and catches up when it is shown again.

## Focus ring (revised 2026-09-28)

The focus highlight fits each control's real shape (Arthur's walkthrough: it sat misaligned on the compact search fields). One ring, `--focus-ring` (a 2px gap in the page colour, then 2px of the scope colour), in three weights:

- The ring is declared at one pseudo-class's weight, so a component's own `:focus-visible` rule wins wherever its CSS lands.
- The small corner (`--radius-sm`) applies only where a control has no radius of its own; an input, select or button keeps its own corner and the ring follows it.
- Outline stays off.

The flush popover searches — every list combobox (Game day's team picker among them), the prize picker and the workspace switcher — carry the same ring drawn **inside** their search row (`--focus-ring-inset`), rounded on the popover's own top corners; the bare text input shows none. Every other search field (list toolbars, the game and schedule pickers, the season calendar, the sponsor picker) is a plain input and takes the outer ring on its own shape.

## Revision 2026-09-27 (Wave 4)

Arthur's rulings of 2026-09-27 (`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`), applied to the console surface. Each table above carries its part; this section says what moved.

- **Prizes is a sidebar item again**, at `/prizes`, with two tabs: **Library** (`/prizes`, the tenant's prizes, defined once and pointed at by contest tiers) and **Deliveries** (`/prizes/deliveries`, every send, failure and resend). Each prize opens as its own page (`/prizes/new`, `/prizes/:prizeId`). This replaces 2026-09-24's "Prize deliveries" item.
- **No Emails item.** The prize email settings are a visible settings area on Prizes → Deliveries; `/settings/emails` redirects there.
- **Fields & Opt-ins gains opt-in document editing**: each opt-in's linked document is stored and edited with it ([`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md)).
- **Sponsors** keeps `/sponsors` and gains `/sponsors/:sponsorId`. **Brand** is unchanged on main in Wave 4 apart from upload fields and Wave 3's font removal; Brand page v2 is built on the Wave 5 branch.
- **The contest page's Board tab and the builder's Board step are gone**, with all prop curation: tenants neither choose nor see props. The contest page's tabs are Overview, Games, Prizes, Sponsors and Preview.
- **The builder keeps the sidebar.** It is a page in the main column, with its steps as a clickable progress bar across the top and Save draft on every step.
- **Contest states and deletion.** Draft, Open and Closed replace the visibility and entries switches, and any non-finalized contest can be deleted (typed name; since 2026-09-28 the typed name alone, even once fans have joined).
- **Uploads everywhere** (Rule 16).
- **Redirects**: `/prize-deliveries` and `/settings/emails` → `/prizes/deliveries`; `/prizes?contest=<id>` → that contest's Prizes tab; `/branding/sponsors` → `/sponsors`; `/delivery-queue` → `/obs/prize-deliveries` (since Walk #3, `/obs/prizes/deliveries`).

## Principles

Four named principles sit above the rules. They are not route-specific, and a change that satisfies every numbered rule can still violate one of them.

**Seamlessness.** *What parts of the app a user is shown is calculated per user — from their identity and memberships — never from what part of the frontend they happen to be standing in.* An operator does not gain or lose capabilities by navigating; the console renders the same answer to "what may this person do" on every screen, because it asks the same question. This is what makes the one switcher and the identity-driven nav sections coherent rather than two features that happen to agree. And it is convenience only: **UI hiding is never the boundary**. Every one of these decisions is enforced again server-side, and a user who reconstructs a hidden route by hand meets the same refusal they would have met anyway.

**Plain product language.** *No developer jargon and no spec identifiers in customer-visible copy.* No requirement ids (`RPT-05`, `ADM-03`), no implementation vocabulary ("dead-letter", "hard bounce", "structural refusal"), and no over-explaining the mechanism behind a result. The reader is a team's marketing staffer, and the copy should read as normal to them. Spec ids belong in specs, code comments, and API documentation — never in UI text. This governs new copy from now; the existing screens get their own sweep, which is not this change.

**Fan's-eye view** (ruling 2026-09-16, Arthur). *Where a configuration screen changes what a fan sees, the console shows the fan's view of the change, rendered from the fan product's own code.* A team's staffer configuring signup fields or prize tiers is editing a screen they never look at; without a view of it their only way to see their own work is to publish and go find it — which turns a deliberate publish into a preview mechanism on screens explicitly designed so that publishing is deliberate.

Two halves, and the second is what makes the first worth having:

- **Shown.** Configuration that reflects onto the fan app gets a view of the result, alongside the controls that produce it and bound to the unsaved draft, not to the last publish.
- **Rendered, not drawn.** The view runs the fan app's own components, copy, and validation, shared through `obs-b2b-shared`. A hand-built likeness is a second implementation of a screen, and second implementations drift — which is not a hypothetical here: the signup field catalog's labels were copied into three files and two of them had already disagreed.

Where the console cannot honestly know something the fan sees, **it shows less rather than guessing**. A view renders only what it can render truthfully, and it does not caption the rest — copying the fan app's palettes into the console would buy a view that looks right while being wrong, and annotating the shortfall on screen trades one violation for another. (Superseded 2026-09-22 by the omission principle below: this previously required the preview to render the default palette *under a caption saying so*. The caption goes; what the view cannot honestly show is simply absent, and the gap is recorded in the spec. For the palette specifically the question is now moot — [`admin-branding.spec.md`](admin-branding.spec.md) makes tenant colors real configuration the console does know.)

This is a direction, not a retrofit order. It governs new configuration screens, and the inventory below names the existing ones in the order they are worth doing.

**Honesty by omission, not by narration** (ruling 2026-09-22, Arthur). *The console never fabricates, and it never narrates its own gaps: what it cannot show honestly, it simply does not show.* Nothing is invented — no placeholder numbers, no controls that pretend to work. But the other half is new: **the UI does not explain what is missing from it.** A stat we do not measure gets no tile. A feature that is not wired gets no card. A real number carries no caveat about where it came from. What is on screen is true; what cannot be true is absent, and absence is not annotated.

The reader is a team's marketing staffer, and a screen that catalogues its own incompleteness reads as a product still under construction — which is the impression a dash-and-caption tile creates whether or not the caption is accurate. Disclosure is owed to the people building the console, not to the people using it: **gap disclosure lives in specs and code comments, never on screen.** A spec must still say plainly what is unbuilt — that is what specs are for, and nothing here narrows it.

**This supersedes any earlier requirement to disclose a gap in the UI.** Where a sibling spec requires a placeholder tile, an unwired-feature card, a caveat caption under a metric, or a rendered spec id, the requirement is now the omission: the element is absent until the data behind it exists. The element appears when it can be populated, and it arrives without commentary about having been missing.

### Reflect points (noted, not built)

Everywhere a console setting reaches the fan app today, and how good a candidate each is:

| Configuration | Fan surface | Status |
|---|---|---|
| **Signup fields & opt-ins** | The entry gate | **Built first** — [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), the flagship |
| **Prize tiers** (`Prizes.tsx`) | `PrizeModal.tsx`, `BoardPage.tsx` | **Best next candidate.** The shared `B2BPrizeTier` type is already used verbatim by the fan app, so the projection is nearly free. One thing to settle first: `PrizeModal` headlines `prizeDescription` and uses `prizeName` only as image alt text — a preview would make that visible, which is the argument for doing it |
| **Games enabled per contest** (`Games.tsx`) | `ContestPage.tsx` tabs | Candidate. Small surface, and the reflection is a tab strip rather than a screen |
| **Contest state** (Draft, Open, Closed) | A Draft is server-filtered; Open and Closed show under Upcoming and Past | Covered by the contest Preview tab ([`admin-preview.spec.md`](admin-preview.spec.md)), which shows a Draft as if published |
| **Tenant name** | Nothing — **a broken link** | Not a preview problem. An admin rename never reaches the fan app at all, which reads its local registry. Recorded here because it looks like a missing reflect point and is actually a missing write path |
| **Sponsors & Branding** (`/branding`) | Every fan screen | **Specced** — [`admin-branding.spec.md`](admin-branding.spec.md) for the Brand tab (the data model, endpoints and live preview; `BRAND-01`'s hardcode-permitted classification is superseded by it) and [`admin-sponsors.spec.md`](admin-sponsors.spec.md) for the Sponsors tab |
| **`authVariant`** | The fan sign-in | Blocked, and worth flagging: the value is configurable while the fan sign-in hardcodes email — configuration with no effect, which a preview would expose but not fix |

---

## Rules

1. **No admin handler takes a tenant identifier as a parameter.** Scope comes from `req.adminScope`. The exception — an OBS staff member acting on a chosen tenant — is explicit, verified, and resolved from the user's obs membership rather than their active organization.
2. **`org:fan_data:export` never appears on a tenant org role set** (`RPT-02`).
3. **`org:tenant_config:manage` is held by tenant `org:admin` and every obs role; never by tenant `org:member`** (ruling 2026-09-16). `org:member` holds `org:tenant_config:read` only. The never-rules that remain are Rules 2 and 9 — export and finalization — plus fan-data deletion, which stays with OBS as a named boundary rather than a permission row.
4. **The tenant org's Clerk slug equals `B2BOrganization.subdomain`.** Provisioning must create both or neither; a mismatch silently denies access.
5. **Admin routes are mounted under `/admin` and authenticate against the admin instance only.** A fan token must never satisfy an admin route.
6. **MFA is required instance-wide.** Do not add a per-route or per-role bypass.
7. **`admin` and `obs` are never a tenant's `B2BOrganization.subdomain`** (`TEN-C3`). Checked at onboarding and defensively in both `resolveAdminScope` and `resolveTenant`.
8. **Organization self-creation is disabled on the admin Clerk instance.** The three provisioning tiers are the only ways an organization comes to exist — a user's own "Create organization" action is not a fourth. The console's own "Create organization" entry routes to the in-app provisioning flow, which is tier two, not a fourth path.
9. **`org:contest:finalize` never appears on a tenant org role set**, and fan-data deletion stays with OBS (decision 2026-09; reaffirmed 2026-09-16). Neither is waiting on anything.
10. **A `B2BOrganization` record and its Clerk organization are a synced pair at all times** — created, changed, and deleted together or not at all. The DB directory is the source of truth for what tenants exist; three records violate this today and are recorded above as data debt. The rule governs the pair's existence and identity (slug, name); **tenant suspension is deliberately outside it** — a database-side status with no Clerk half, because Clerk has no suspend primitive and inventing one by deleting the org would destroy exactly what the rule protects ([`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md), 2026-09-15).
11. **OBS staff-ness is resolved from the user, not the active organization.** Active `obs` proves it from the signed token; anything else verifies membership against Clerk, cached 5 minutes, failing closed on error.
12. **A view of the fan product inside the console renders the fan product's own code**, shared through `obs-b2b-shared` — never a likeness rebuilt in console markup, and never an embed of the live fan site. The console references the fan product; it does not host it, and it does not redraw it. Revised 2026-09-24: the fan-app preview mode is the one exception; [`admin-preview.spec.md`](admin-preview.spec.md) defines it.
13. **The console never fabricates a value and never narrates a gap** (ruling 2026-09-22). An unmeasured stat renders no tile, an unwired feature renders no card, and a real number renders no caveat about its provenance — the element is absent until the data behind it exists, and absence is not captioned. Gap disclosure belongs in specs and code comments. This supersedes any earlier requirement to disclose a gap in the UI.
14. **Pages, drawers and dialogs** (ruling 2026-09-24). A drawer holds a small form; anything with tabs, a preview, a list, or more than about eight fields is a page with its own route; confirmations are centred dialogs, with a typed confirmation on the irreversible ones. The inventory of retired and remaining drawers is in "Pages, drawers and dialogs" above, and a new surface follows the principle rather than the nearest precedent.
15. **Staff see a workspace's screens exactly as its admin or member would** (ruling 2026-09-28, reversing 2026-09-24's staff extras). Staff-only work lives on the OBS pages — Finalize on All contests and the tenant page (and, since the final walk, on the workspace's contest card and page, staff only), triage and delete in the support inbox. The only staff-only controls on a workspace screen are the listed exceptions in "Staff see what the workspace sees", each kept because it has no other surface and each enforced server-side on user-level staff-ness.
16. **Every asset field is an upload box** (ruling 2026-09-27). Wherever the console takes an image or file (logos, sponsor artwork, prize images, anything else), the field is a drag-and-drop box that also opens the file browser on click, with its preview, replace and remove, as [`admin-uploads.spec.md`](admin-uploads.spec.md) defines it and its upload route stores it. Never a URL textbox on its own.

---

## References

- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-10`–`IDN-13`
- HLD: [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the shared package's `ui/` layer, and the test a component must pass to live there
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the first instance of the Fan's-eye view principle
- PRD: [`TEN-03`, `TEN-05`, `TEN-C3`, `ADM-01`–`ADM-09`, `BRAND-02`, `GAME-01`, `PRIZE-03`, `RPT-01`–`RPT-05`, `SEC-07`, `SEC-08`, `OBS-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — the fan-side model this deliberately does not share
