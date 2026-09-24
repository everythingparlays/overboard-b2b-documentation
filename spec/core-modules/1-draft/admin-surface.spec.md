# Core Module Spec: Admin Surface — Access Framework

**Implements:** HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-10`, `IDN-12`, `IDN-13`. PRD `ADM-01`, `ADM-02`, `ADM-09`, `SEC-08`, `RPT-02`.

**Status:** Draft. No open questions remain — ready for review.

**Revised 2026-09-16** (ruling, Nick) — tenant self-service ships now, OBS-ness is a property of the user rather than the active organization, and the console has one switcher. The sections marked with that date carry the change; nothing else in this spec moved.

**Revised 2026-09-16** (ruling, Arthur) — a third principle, **Fan's-eye view**: where configuration reflects onto the fan app, the console shows the fan's view of it, rendered from the fan product's own code. Principles, Rule 12, and the reflect-point inventory carry the change.

**Revised 2026-09-22** (ruling, Arthur) — a fourth principle, **Honesty by omission, not by narration**: the console never fabricates and never narrates its own gaps — an unmeasured stat gets no tile, an unwired feature gets no card, a real number gets no provenance caveat. Principles and Rule 13 carry the change, and it supersedes any requirement in a sibling spec to disclose a gap on screen.

**Revised 2026-09-24** (ruling, Arthur) — the S1 console redesign. Sponsors become their own Configuration item, separate from Brand; Prize deliveries replaces Prizes (and, across workspaces, the Delivery queue); Emails joins Configuration; contests, prize tiers, sponsors, fans and the staff tenant record become full pages with their own routes. "Pages, drawers and dialogs" (Rule 14) decides what is a page and what stays a drawer, and "Staff extras on tenant screens" (Rule 15) lists the staff-only controls the redesign adds. The Navigation table, the new page-route table beneath it, the reverification list and Rules 14–15 carry the change; nothing else moved.

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

- **OBS Internal endpoints and screens authorize on user-level obs-staff-ness**, not on the active org. An operator with a tenant org active still reaches `/platform-health`, `/delivery-queue`, `/fan-actions` and the finalize route.
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
- Suspending or resuming a tenant, and deleting a tenant (ruling 2026-09-15, Arthur — the lifecycle module). Suspend and resume are reversible, but each flips a customer's live program for every fan at once; delete is the platform's largest irreversible action.
- Staff sending an admin invitation into a tenant's organization, including re-inviting its first admin (2026-09-24, [`admin-tenant-page.spec.md`](admin-tenant-page.spec.md)). It is the mirror image of removing a member or changing a role: whoever opens the email gets full control of a customer's workspace.
- Sending a prize again that was already sent (staff "Send again", 2026-09-24). It duplicates a code or a claim link to a real fan, which clicking again cannot take back.

The common thread is *cannot be undone by clicking again*. Editing a sponsor logo does not qualify; deleting the sponsor does. (Renaming a tenant's display name follows the logo side of that line — argued in [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md).)

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

**Reverification on PII** (`IDN-13`, [P2]): export and deletion routes require a fresh credential check within a short window, on top of the MFA'd session. This narrows the blast radius of an unattended session on the highest-consequence actions; it is not a substitute for MFA.

`POST /b2b/contest/prize-tier` moves here. It is currently on the fan surface behind `requireMembership`, which means any *fan* of a tenant can write prize config — an interim measure, not a model.

---

## Frontend

A **separate application and deployment** at `admin.overboardsports.com`, not a route inside `overboard-b2b-template`.

The fan template is tenant-branded and deployed per tenant; admin is one deployment serving all tenants, with its own Clerk publishable key, its own theme, and an org switcher instead of tenant resolution. Sharing a bundle would ship admin code to every fan and put two Clerk instances in one page.

- **One switcher, in the sidebar** (ruling, 2026-09-16). The console previously had two selectors — Clerk's `<OrganizationSwitcher>` in the sidebar for *who you are*, and an "Acting on tenant" pill in the top bar for *which tenant you act on*. Two controls for one question is one too many, and which of the two applied depended on whether the target happened to be an org you were a member of — an implementation detail from the operator's side. **The top-bar pill is removed and Clerk's switcher is replaced by a custom sidebar switcher.**
- **What the switcher lists.** Every user sees their real Clerk organization memberships; selecting one calls Clerk's `setActive`, semantics unchanged. **OBS staff additionally see every tenant from `GET /admin/tenants`** — the DB tenant directory, which is the source of truth for what tenants exist. Selecting a tenant they hold a Clerk membership in switches the active org (`setActive`); selecting one they do not sets the internal acting-on context instead. **One deduped list**: a tenant that appears both as a membership and as a directory entry shows once, and the two cases look and feel identical. Which mechanism fires is ours to know, not the operator's to learn. **Pending invitations are listed too**, after the user's own organizations: choosing one accepts the invitation and switches to that organization, the same way picking a membership does, and a join that fails says so and leaves the user where they were. The switcher is the console's one place to accept an invitation — Clerk's sign-in step offers invitations only while no organization is active, and the active one survives sign-out, so without it a user invited to a second organization would stay locked into their first. The same reasoning decides who gets a switcher at all: a user with one organization and nowhere else to go sees it as a fixed card, and a pending invitation counts as somewhere else, so it earns the switcher in place of the card.
- **The acting-on machinery stays as wiring; only its UI goes.** The `TenantContext` that held the console-wide choice is unchanged underneath — set once, applies to every per-tenant screen, survives routes and reloads, dropped at sign-out, reset when the stored slug no longer appears in `GET /admin/tenants`. It changes nothing about the wire: **every OBS request still names the tenant explicitly as `?tenant=<slug>`**, including when the operator is acting on their own active tenant org. Explicit, never implicit.
- **"Create organization" appears for OBS staff only**, and routes to the console's own All-tenants Create-tenant flow (`POST /admin/tenants`, OBS Internal spec) — never Clerk's widget, which creates a Clerk org with no `B2BOrganization` behind it and breaks the synced-pair invariant. A non-obs user never sees the entry, and Rule 8 still stands: self-creation is disabled instance-wide, so the entry is a link to the one provisioning path rather than a second one.
- **Cross-tenant screens are not filtered by the selection.** All tenants, Platform health and Delivery queue answer questions about the set of tenants and ignore it (the All-tenants drawer flows the other way: it *sets* the selection and opens that tenant's Overview; since 2026-09-24 that drawer is the tenant page, whose "Open as this tenant" does the same). Fan actions already had a tenant filter, so the selection pre-fills it, with "All tenants" still available. Team ignores it — membership reads the active organization from the session, not a tenant slug.
- Route guards read `orgSlug` and `has({ permission })` from the session — the same pattern as the fan `ProtectedRoute`, different inputs.
- **The URL's tenant must be checked against the session's `orgSlug` on every scoped page.** A stale `orgSlug` after an org switch otherwise renders one tenant's data under another's URL.

### Navigation

One nav structure, three sections. Same screens for both actor classes (`ADM-01`) — the difference is which sections render and what the switcher lists, never a different app or a different route table.

| Section | Destination | Route | Implements |
|---|---|---|---|
| Workspace | Overview | `/` | `ADM-06`, `ADM-07` (games, KPIs, reporting surfaced on one screen) |
| | Games & Contests | `/games` | `ADM-04`, `BRAND-02`, `GAME-01`–`GAME-04` — [`admin-games-and-prizes.spec.md`](admin-games-and-prizes.spec.md), contest lifecycle in [`admin-contests.spec.md`](admin-contests.spec.md) |
| | ~~Prizes~~ | ~~`/prizes`~~ | *Superseded 2026-09-24 by Prize deliveries: tiers moved into the contest page's Prizes tab, the tenant email settings to Emails.* |
| | Prize deliveries | `/prize-deliveries` (`/prizes` redirects here; `/prizes?contest=<id>` to that contest's Prizes tab) | `PRIZE-01`, `PRIZE-07` — every send, failure and resend across the tenant's contests; [`admin-prizes.spec.md`](admin-prizes.spec.md) |
| | Fans | `/fans` | `RPT-02` view, scoped — not the export itself |
| | Exports | `/exports` | `ADM-07`, `RPT-01`–`RPT-06` |
| | Game day | `/live` | `OBS-04`, `OBS-05` — [`admin-game-day.spec.md`](admin-game-day.spec.md) |
| Configuration | Fields & Opt-ins | `/config` | `ADM-05`, `AUTH-02`, `OPT-01`–`OPT-05` |
| | ~~Sponsors & Branding~~ | ~~`/branding/sponsors`, `/branding`~~ | *Superseded 2026-09-24: split into two items, Sponsors and Brand, below.* |
| | Sponsors | `/sponsors` (`/branding/sponsors` redirects) | `BRAND-02`–`BRAND-04`, `TEN-04` — its own item and hue, separate from Brand; [`admin-sponsors.spec.md`](admin-sponsors.spec.md) |
| | Brand | `/branding` | `BRAND-01`, `TEN-C1` — [`admin-branding.spec.md`](admin-branding.spec.md) (`THEME-03`–`THEME-23`) |
| | Emails | `/settings/emails` | The tenant-wide prize email settings (sender name, reply-to, subject), moved off the Prizes screen; [`admin-prizes.spec.md`](admin-prizes.spec.md) |
| | Team | `/team` | Org membership — invite/remove within the caller's own org (see "Provisioning and delegation") |
| OBS Internal | Operations | `/operations` | The staff home — [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) |
| | All tenants | `/tenants` | Cross-tenant tenant list/switcher target |
| | All contests | `/contests` | [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) |
| | Season calendar | `/schedule` | `OBS-04` at planning horizon — [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) |
| | Platform health | `/platform-health` | `OBS-01`–`OBS-05` |
| | ~~Delivery queue~~ | ~~`/delivery-queue`~~ | *Superseded 2026-09-24 by the cross-tenant Prize deliveries below; `/delivery-queue` redirects.* |
| | Prize deliveries (all workspaces) | `/obs/prize-deliveries` | `PRIZE-06`/`PRIZE-07` — every workspace's sends, with a Tenant column and filter; [`admin-prizes.spec.md`](admin-prizes.spec.md) |
| | Fan actions | `/fan-actions` | `RPT-02`, `org:fan_data:export` |
| | Support inbox | `/support` | [`admin-support.spec.md`](admin-support.spec.md) — rendered as Your reports for a workspace's own users; not in their nav |

Not in the nav, reached from a game: **Game recap** (`/recap`, [`admin-sponsor-recap.spec.md`](admin-sponsor-recap.spec.md)). An Overboard staffer with no tenant chosen lands on Operations rather than on Overview's "Pick a tenant" card.

**Pages reached from a destination** (2026-09-24). Not sidebar items: each opens from a card, a row or a button on the destination named, keeps that destination active in the nav, and has a back link to it.

| Page | Route | Opened from | Spec |
|---|---|---|---|
| Contest page | `/contests/:id`, `/contests/:id/<tab>` — tab is `overview`, `games`, `board`, `prizes`, `sponsors` or `preview`; bare `/contests/:id` is Overview | Games & Contests cards; staff All contests rows and the tenant page's Contests rows, with `?tenant=` | [`admin-contests.spec.md`](admin-contests.spec.md) |
| Contest builder | `/contests/new`, then `/contests/:id/setup/<step>` once the draft exists — step is `basics`, `games`, `board`, `prizes`, `sponsors` or `review` | "New contest"; "Continue setup" on a draft | [`admin-contests.spec.md`](admin-contests.spec.md); full screen, the sidebar is hidden |
| Prize tier editor | `/contests/:id/prizes/new`, `/contests/:id/prizes/:tierId`; inside the builder `/contests/:id/setup/prizes/new`, `/contests/:id/setup/prizes/:tierId` | The contest page's Prizes tab; the builder's Prizes step | [`admin-prizes.spec.md`](admin-prizes.spec.md); full page, back to the ladder |
| Sponsor page | `/sponsors/:id` | Sponsors cards | [`admin-sponsors.spec.md`](admin-sponsors.spec.md) |
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
| New contest | The full-screen contest builder (`/contests/new`) |
| Contest settings | The contest page's Overview tab |
| Add games | An inline picker inside the contest page's Games tab and the builder's Games step |
| Game row | The contest page's Games tab rows |
| Prize tier | The full-page tier editor |
| Prize email preview | The tier editor's live preview rail, and the Emails page's preview |
| Sponsor editor | The sponsor page (`/sponsors/:id`), edited in place |
| Sponsor view | The sponsor page, read-only for members |
| Fan detail | The fan page (`/fans/:membershipId`) |
| Tenant detail | The tenant page (`/obs/tenants/:slug`) |

**Drawers that stay** (small forms): create tenant; tenant created; invite admin; invite or edit a team member; export; calendar day (Schedule and Season calendar); Tell Overboard; delivery detail (Prize deliveries); opt-in, until the Fields & Opt-ins overhaul replaces it with its inline pattern.

**Confirmations are centred dialogs**, not drawers and not inline zones: Finalize, Delete (fan, tenant, sponsor, draft contest, prize tier), Pause and Resume, Send again, Re-invite. A dialog states the consequence in plain words, names the thing it acts on, and puts the confirming action on the right. Where the action is reverified, reverification runs after the dialog's confirm; where it takes a typed confirmation (Finalize: the contest name; delete a tenant: its subdomain; delete a fan: their display name), the confirming button is enabled only on an exact match and the server checks the typed value again. A cancelled reverification leaves the dialog open and says nothing happened.

### Staff extras on tenant screens (ruling, 2026-09-24)

"Identity is per user, not per screen" (Seamlessness, and D-064): whenever Overboard staff have a tenant selected, that tenant's screens show the staff-only controls as part of the screen, not on a separate staff surface. The server enforces each one on user-level staff-ness; the rendering follows `useIsObsStaff()`. The console-wide sweep of the existing screens has its own section, "Staff extras (sweep, 2026-09-24)", written alongside this one on `arthur-g1-console`; the redesign adds these:

| Screen | Staff extra |
|---|---|
| Games & Contests cards | **Finalize** (ghost), only when the contest is published, not finalized, and every game has ended; hidden otherwise, not disabled ([`admin-contests.spec.md`](admin-contests.spec.md)) |
| Contest page | **Finalize** in the header, and the Finalize state with its button in the Overview's "What's next" rail |
| Staff All contests rows, tenant page Contests rows | **Finalize** per row, same rule |
| Prize deliveries | **Send again** on a sent row (reverified, because it duplicates a code); **Send to a different address** on a failed row; the recorded failure reason; a **Tenant column** and tenant filter across all workspaces (`/obs/prize-deliveries`), where the old queue's 100-row cap goes ([`admin-prizes.spec.md`](admin-prizes.spec.md)) |
| Fan page | **Delete fan**; **Export this fan's activity** |
| Team (the chosen tenant's) and the tenant page | **Re-invite** the first admin, only while the invitation is not accepted (reverified) |
| Every tenant screen | The tenant page itself, reached from the staff links on the screen |

A tenant user never sees these controls, and a tenant user's request for any of them is refused server-side regardless.

---

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
| **Contest visibility** | Server-filtered; the fan gets a generic empty state | Weak candidate. What the fan sees is an absence, and a preview of an absence teaches little |
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
14. **Pages, drawers and dialogs** (ruling 2026-09-24). A drawer holds a small form; anything with tabs, a preview, a list, or more than about eight fields is a page with its own route; confirmations are centred dialogs, with typed confirmation where reverification applies. The inventory of retired and remaining drawers is in "Pages, drawers and dialogs" above, and a new surface follows the principle rather than the nearest precedent.
15. **Staff extras appear on tenant screens whenever staff have a tenant selected** (ruling 2026-09-24). Identity decides them, not which part of the console the staffer is in: Finalize on contest cards, the contest page and contest rows; Send again and the Tenant column on Prize deliveries; Delete fan and the fan activity export on the fan page; Re-invite on Team and the tenant page. Each is enforced server-side on user-level staff-ness; rendering is convenience.

---

## References

- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-10`–`IDN-13`
- HLD: [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the shared package's `ui/` layer, and the test a component must pass to live there
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the first instance of the Fan's-eye view principle
- PRD: [`TEN-03`, `TEN-05`, `TEN-C3`, `ADM-01`–`ADM-09`, `BRAND-02`, `GAME-01`, `PRIZE-03`, `RPT-01`–`RPT-05`, `SEC-07`, `SEC-08`, `OBS-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — the fan-side model this deliberately does not share
