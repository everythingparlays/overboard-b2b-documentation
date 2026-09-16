# Core Module Spec: Admin — Team

**Implements:** PRD `ADM-01`, `ADM-09`, `SEC-08`, `TEN-03`, `TEN-05`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-10`, `IDN-12`, `IDN-13`. Chiefly, though, it implements a spec decision rather than a PRD requirement — see "The PRD does not specify this screen".

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — the organization topology, the two-role V1 model, the three-tier provisioning ladder and its delegation boundary, the `/team` nav destination, and the reverification list. [`admin-fans.spec.md`](admin-fans.spec.md) — the `useReverification` client precedent (the server-side middleware defined there is *not* used by this module; see "No endpoints").

**Status:** Draft.

## Overview

The Team screen at `/team`: who can administer this organization, and the invite / remove / role-change controls that let a tenant `org:admin` administer that list themselves — the "Ongoing" tier of the admin-surface provisioning ladder.

**The whole change, in one line:** a screen, and nothing else — membership is Clerk's, so this module adds no endpoint, no collection, and no contract, and drives Clerk's client-side organization APIs directly.

**In scope:** the screen, its permission-gated controls, the pending-invitation list, and the presentation of an organization's own membership. One frontend page, its tests, and the route.

**Not in scope:**

- **Cross-org membership administration.** No screen here lists or edits another organization's members. OBS staff manage the `obs` org's own membership on this screen and nothing else — see "OBS sees its own org, and ignores the tenant selection".
- **Tenant provisioning** — creating a tenant's Clerk organization and inviting its first admin (the ladder's middle tier). That is the Create-tenant flow, a later module, and it is the *only* place an organization is named. Nothing on this screen creates an organization or edits one's name or slug.
- **A last-admin guard.** `admin-surface.spec.md` settles this: "Last-admin removal is unguarded [P2] (decision, 2026-09)." The screen surfaces Clerk's outcome and does not pre-empt it. Building the guard here would contradict an accepted decision and re-implement a boundary we deliberately delegate.
- **Custom roles.** V1 has exactly `org:admin` and `org:member` (admin-surface, "Roles and permissions"). The role picker offers those two and is not a general role editor.
- **MFA enrollment status and last sign-in per member.** Both appear in the mock; neither is reachable. See "What the mock asks for that Clerk's client cannot give".

---

## The PRD does not specify this screen

Worth stating plainly, because it changes what this spec is answerable to. Nothing in `ADM-01`–`ADM-09`, `TEN-*`, or `SEC-*` requires inviting or removing admin users, or assigning them roles. The PRD's only mention of account access is §15.2's onboarding-vs-recurring table, which places "setting up the team's **initial account access**" on the *onboarding-time, engineer-operated* side (`TEN-05`) and says nothing about ongoing administration.

The authority for this module is therefore `admin-surface.spec.md`'s "Provisioning and delegation" section (decision, 2026-09), which fills that gap with the three-tier ladder, plus `IDN-12` for why membership is the grant. The PRD requirements in the **Implements** line are the ones this screen must not *violate* — `ADM-09`'s scope constraint, `SEC-08`/`IDN-10`'s MFA, `ADM-01`'s one-app rule — rather than ones it satisfies.

The practical consequence: where the mock and the spec disagree, there is no third authority to appeal to, so the spec decides and says so each time. This happens in the capability panel below — and the 2026-09-16 ruling since resolved one of the two disagreements in the mock's favour, which the panel section records.

---

## Why this module has no backend

This is the module's single load-bearing decision, so it is argued rather than asserted.

`admin-surface.spec.md` states the boundary and its enforcement in one sentence: "The delegation boundary is enforced by Clerk's own `org:sys_memberships:manage` permission, scoped to the caller's active organization — a tenant admin cannot reach another organization's membership because the permission is evaluated against the org in their session. **No custom code should re-implement this**, and none should let a tenant admin name an organization."

An `/admin/team` endpoint would re-implement exactly that. It would have to read the caller's org from `req.adminScope`, call Clerk's backend API to list or mutate memberships, and re-derive "may this caller manage members?" — a second copy of an authorization rule Clerk already evaluates, in a place where it can drift from the first. The rule for admin handlers compounds the problem: "No admin handler takes a tenant identifier as a parameter" (admin-surface Rule 1), so such an endpoint could only ever act on the caller's own org — which is precisely the scope Clerk's client APIs already enforce, from the session, without our code.

So the screen calls Clerk from the browser:

| Need | Clerk client API |
|---|---|
| Member list | `useOrganization({ memberships: … })` → `OrganizationMembershipResource[]` |
| Pending invitations | `useOrganization({ invitations: { status: ["pending"] } })` |
| Invite | `organization.inviteMember({ emailAddress, role })` |
| Revoke invitation | `invitation.revoke()` |
| Remove member | `membership.destroy()` |
| Change role | `membership.update({ role })` |
| May the caller do any of it | `has({ permission: "org:sys_memberships:manage" })` |

Every one of these is scoped by Clerk to the session's active organization. There is no organization identifier for this screen to pass, and therefore no way for it to reach another tenant's membership — the same property the backend rule exists to guarantee, obtained by not writing the code.

**The security boundary is unchanged by this being client-side.** Clerk's Frontend API evaluates `org:sys_memberships:manage` against the session token server-side on every one of these calls; a member who forges `has()` to `true` in their own browser gets a 403 from Clerk, not a mutation. The `has()` check is presentation — it decides whether a control renders — exactly as `admin-surface.spec.md` says of hiding the OBS Internal section: "hiding the section is UX, not the enforcement."

**Consequence for the backend:** `/admin/*` gains nothing in this module. No route, no handler, no contract in `obs-b2b-shared`, no pin bump. The first module in this series whose correct implementation is a deletion of work rather than an addition.

### What the mock asks for that Clerk's client cannot give

The mock's member table has six columns. Four come from Clerk's client (`ADMIN` name/email, `ORGANIZATION ROLE`, `STATUS`, the row action). Two do not:

- **`MFA`** (`TOTP` / `SMS` / `Not enrolled`) — Clerk's client-side `PublicUserData` is `firstName`, `lastName`, `imageUrl`, `hasImage`, `identifier`, `userId` (verified against `@clerk/types` 5.61.9, the version the app resolves). Another user's second-factor enrollment is not on it, and correctly so: it is that user's security posture, readable only through the Backend API.
- **`LAST SIGN-IN`** — likewise absent. It is a property of another user's sessions.

Both are **deliberately not rendered**, and the columns are omitted rather than filled with a placeholder. Spec wins over mock. The reasoning is not merely "it is hard":

1. Serving them needs `users.getUser()` per member through Clerk's Backend API — a new endpoint, holding the admin secret key, reading *other users'* security attributes. That is a re-implementation of the delegated boundary with a PII-adjacent read attached, to populate two informational columns.
2. The MFA column's job in the mock is already done by the banner above it. MFA is enforced **instance-wide** (`SEC-08`, `IDN-10`): every admin who can reach this console has enrolled, because Clerk will not complete sign-in otherwise. A per-member "enrolled?" column can only ever read `enrolled` for every active member — it displays a constant. The one genuinely different state, an invited admin who has not yet enrolled, is already the `Invited` status the pending-invitation rows carry, and the banner states the rule in words.
3. `Not enrolled` in the mock appears on exactly the row that is `Invited` — confirming the two columns encode one fact, which the invitation row already carries.

Recorded as a gap, not a silent omission: if the platform later wants an MFA/last-sign-in audit view, it is an OBS-internal read of the *admin instance's* users — a different module, with `org:fan_data:export`-grade handling, not a tenant-facing column.

---

## The screen

`/team`, per Nick's 2026-09-14 mock (`mocks/admin-console/Team.png`). Custom-built on our primitives — **not** Clerk's `<OrganizationProfile>`.

That is a judgement call, so: the mock is plainly our design system, not Clerk's component. It carries our `Card`/`Table`/`Badge` surfaces, a page-specific MFA banner citing an internal requirement id (`IDN-10`), an OBS-staff row treated differently from tenant rows, a subtitle citing `IDN-12`, and a "What this organization can do" capability panel that is the *opposite* of a membership widget — it explains the tenant's authority boundary, including things the tenant **cannot** do. `<OrganizationProfile>` renders none of that and cannot be made to; adopting it would mean abandoning the screen's actual content to keep a members table we can compose from primitives in a fraction of the space. The prebuilt component would also expose organization *profile* editing — the org's name and slug — which `admin-surface.spec.md` forbids a tenant admin from reaching ("none should let a tenant admin name an organization"), and whose slug is load-bearing (Rule 4: the slug equals `B2BOrganization.subdomain`). Using it would hand tenants a control that silently breaks their own tenancy.

**Header.** Title, and the mock's subtitle: membership in this organization is what grants access — there is no per-user tenant field (`IDN-12`). "Invite admin" sits top-right, rendered only for callers Clerk says may manage memberships.

**MFA banner.** States `IDN-10`/`SEC-08` in words: every admin account must enrol a second factor, enforcement is instance-wide, and an invited admin cannot reach the console until enrolment completes. Informational, always shown — it is the answer to "why can't my new teammate get in yet?", which is this screen's most likely support question.

**Members table.** One row per membership: avatar initials, name, email, role badge, status, and the row action. Pending invitations are listed in the same table beneath the members, as the mock shows them — an invited person is part of "who can administer this organization" in the reader's mind, and splitting them into a second table makes the screen answer that question in two places. Invitation rows carry an `Invited` status badge and a `Revoke` action; member rows carry `Active` and `Remove`.

**The caller's own row** is marked `You` and carries no action — Clerk permits self-removal, but an accidental one-click self-eviction from a table of teammates is not a flow worth offering. The operator who genuinely wants to leave has Clerk's own account surface; this is the screen's one deliberate divergence from "surface whatever Clerk allows", and it removes a footgun without guarding anything (`admin-surface.spec.md`'s unguarded last-admin decision is about *other* members, and is respected exactly).

**OBS staff rows.** A member of the `obs` org appearing in a tenant's list is labelled `OBS staff` / `Via org:obs` with no row action, per the mock. In practice this row will not appear — OBS staff "belong to the single `obs` org rather than holding admin membership in every tenant org" (admin-surface, "Organization topology"), so a tenant's membership list contains only that tenant's people. The presentation exists because the mock specifies it and because it is the correct rendering *if* a staff account is ever added to a tenant org directly: such a membership is not the tenant's to revoke. The row is derived from the membership's role/metadata, never fabricated.

**Capability panel.** The mock's "What this organization can do" — the tenant's authority, stated plainly, with the things it cannot do shown as explicit negatives. This is the screen's quiet second job: the obs-only boundaries are ones a tenant admin will otherwise discover as a missing button. Content is derived from the resolved scope and the caller's role.

**The mock drew the end state, and as of the 2026-09-16 ruling the platform is there** — so the panel's config lines render as the mock has them, for a tenant `org:admin`.

- "Enable games and attach prize tiers" and "Configure signup fields and opt-ins" are things a tenant `org:admin` genuinely can do: `org:tenant_config:manage` is on that role (admin-surface Rule 3), and the Fields & Opt-ins and Games modules implement the write for them. An earlier draft of this spec rendered both as view-only capabilities pending `ADM-03`; that correction is itself now superseded and is recorded here so the reversal is visibly deliberate rather than a drift. **For an `org:member` the two still render as view-only** — view active games and prize tiers, view signup fields and opt-ins — because the read/write split is now the admin/member split.
- The mock's amber "Finalize a contest — authority undecided (`PRIZE-03`)" is **stale**, and renders as a plain negative. `admin-surface.spec.md` settled it after the mock was drawn: `org:contest:finalize` is "**obs only** (decision, 2026-09)", reaffirmed as an exclusion by the 2026-09-16 ruling. The design note's own "PRIZE-03 still undecided" caveat is stale for the same reason, and the Games & Prizes module already shipped against the settled answer. An undecided marker on a decided question invites re-litigation on a screen whose whole subject is who may do what.

What a tenant `org:admin`'s panel therefore states — for: configure signup fields and opt-ins, enable games and attach prize tiers, set sponsor field scope, download this tenant's sponsor exports, invite and remove its own admins; against: finalize a contest, delete a fan's data, see another tenant's data, download the internal fan-actions export. An `org:member`'s panel reads the config lines as view-only and keeps the same negatives. Every line traces to the admin-surface permission table rather than to this screen's own opinion. For an OBS caller the panel states the cross-tenant authority instead.

The panel is customer-visible copy, so it obeys the admin-surface spec's plain-language principle: it says what the team can and cannot do, in the team's own words, and cites no requirement ids.

### OBS sees its own org, and ignores the tenant selection

Every other per-tenant screen acts on the console-wide tenant selection. **This one ignores it**, and the reasoning is the nav table's own phrasing: `/team` is "Org membership — invite/remove **within the caller's own org**." The sidebar switcher stays where it is — it is the console's state and still governs every other screen — but nothing here reads its acting-on half. What this screen *does* follow is the active organization the switcher sets, because that is what Clerk's client APIs read.

An OBS staff member on `/team` is looking at the `obs` organization's membership — their own colleagues — and the invite/remove controls administer OBS staff. Acting on a named tenant here would mean one of two things, and both are wrong: either it re-scopes the Clerk client APIs to another organization (impossible — they read the *active* organization from the session, which is what makes the delegation boundary hold), or it adds a backend endpoint that takes a tenant identifier and manages a tenant's members on their behalf, which is the re-implementation this whole module exists to avoid, plus a violation of admin-surface Rule 1.

There is a legitimate need behind the imagined picker — OBS creating a tenant org and inviting its first admin — and it has a home: the Create-tenant flow, out of scope here, where naming an organization is the point and OBS is the actor.

OBS staff who need to act *inside* a tenant org still can, without this screen inventing anything: selecting a tenant they hold a Clerk membership in, from the sidebar switcher, changes the active organization, and `/team` then shows that org's membership because the session says so. Selecting a tenant they are *not* a member of sets the acting-on context instead, which this screen ignores — so `/team` continues to show the `obs` org's membership, which is the honest answer: there is no Clerk membership there for them to administer. The boundary is Clerk's, the same one, at every moment.

So the screen's only scope-dependent differences are the org name in the header and the capability panel's content. No picker, no `?tenant=`, no `qs` — a deliberate break from the established shape, for the reason the nav table gives.

---

## No endpoints

None. This section exists so its absence is visibly intentional rather than an oversight, and so a future contributor who reaches for `/admin/team` finds the argument first.

`obs-b2b-shared/src/api/admin/` gains no `team.ts`. The backend's `adminRouteEntries` is untouched. The jest suite is untouched.

**Reverification (`IDN-13`)** still applies — `admin-surface.spec.md` lists "Removing an organization member or changing their role" among the actions requiring a fresh credential check, and that list is binding regardless of which server performs the action. It is applied with Clerk's own `useReverification`, the hook the Fans and Exports modules already use, wrapping the destructive calls (remove, role change, invitation revoke). Clerk prompts for credentials and retries the action against its own API; a dismissed prompt leaves the membership untouched and the row unchanged.

This is the same mechanism as the other modules from the operator's side and a strictly simpler one underneath: the Fans/Exports path needs `requireRecentVerification` middleware and a hand-built `reverificationRefusal()` body in Clerk's wire shape *because our server is the one refusing*. Here Clerk is both the enforcer and the prompter, so the `fva` claim never has to be re-read by us. Inviting is not gated — an invitation is revocable and releases nothing.

---

## Permissions

| Control | Gate | Who holds it in V1 |
|---|---|---|
| View the member list | Clerk renders memberships to any member of the org | tenant `org:admin` + `org:member`; obs `org:admin` + `org:member` |
| Invite admin | `has({ permission: "org:sys_memberships:manage" })` | `org:admin` only (Clerk's default role mapping) |
| Remove member | same | `org:admin` only |
| Change role | same | `org:admin` only |
| Revoke invitation | same | `org:admin` only |

`org:sys_memberships:manage` is a **Clerk system permission** — `admin-surface.spec.md`'s naming rule notes system permissions "must not be invented", and this one is not ours to grant or withhold. It is attached to Clerk's default `org:admin` role. None of our custom `org:*` permissions appear in this module. Since 2026-09-16 the `org:admin`/`org:member` distinction does carry the config read/write split (admin-surface, "Roles and permissions"), but membership management is not part of it: this screen's gate is Clerk's system permission, asked of Clerk, and it would answer the same if the config split had gone the other way.

**A tenant `org:member` sees the full screen and no mutating controls.** Not a truncated page and not a permission error — the member list is legitimately readable by any member, and `ADM-01` asks for one screen for both actor classes. The difference is which buttons exist, which is what the permission gate is for.

**The gate is read from Clerk, never inferred from our scope.** The screen does not reason "tenant scope, therefore admin"; it asks `has()` and renders the answer. A tenant `org:admin` and an obs `org:admin` take the same path through this screen, because the boundary that separates them is the active organization, not a branch in our code.

### Last-admin removal

Unguarded, per `admin-surface.spec.md`'s recorded decision. If a tenant's only `org:admin` removes themselves or is removed, Clerk performs or refuses the operation on its own terms, and the screen shows that outcome — a success that empties the admin role, or Clerk's error message, whichever Clerk returns. We add no pre-flight count, no confirmation copy about being the last admin, and no disabled state derived from the roster.

This is a real decision with a real cost (recovery is OBS re-inviting), accepted knowingly. A guard here would also be the wrong shape twice over: it would be advisory only — Clerk's Dashboard and API remain open — and it would be our code adjudicating a membership rule, which is the boundary this module exists not to cross.

---

## Rules

1. **No endpoint, no contract, and no collection for membership.** Clerk's client APIs, scoped to the session's active organization, are the implementation. A future `/admin/team*` route must first explain why `org:sys_memberships:manage` is insufficient.
2. **The screen never names an organization.** No org id or slug is passed to any Clerk membership call, no tenant selection is read, no `?tenant=`, and nothing on this screen creates or renames an organization (`admin-surface.spec.md`, "Provisioning and delegation").
3. **Every mutating control is gated on `has({ permission: "org:sys_memberships:manage" })`** — Clerk's answer, rendered; never a role string we compare ourselves, and never inferred from `adminScope`.
4. **No last-admin guard** (`admin-surface.spec.md` decision, 2026-09). Clerk's outcome is displayed as returned.
5. **Removal and role change go through `useReverification`** (`IDN-13`); invitation does not.
6. **Roles offered are exactly `org:admin` and `org:member`** — V1's two (`admin-surface.spec.md`, "Roles and permissions").
7. **Per-member MFA state and last sign-in are not displayed**, because the client cannot see them and serving them means a Backend API read of other users' security attributes. The instance-wide MFA rule is stated once, in the banner.
8. **Clerk's prebuilt `<OrganizationProfile>` is not used** — it cannot render this screen, and it exposes organization renaming, which Rule 2 forbids.

---

## Known gaps (recorded, not blocking)

- **No MFA / last-sign-in columns** — the mock's two unreachable columns, argued above. A future OBS-internal admin-user audit view is the right home if the need is real.
- **Last-admin lockout is possible** — accepted `[P2]`, inherited from `admin-surface.spec.md`. Recovery is OBS re-inviting.
- **No membership audit trail.** `B2BAdminAuditLog` (defined in the Fans spec) records fan-data actions; invites and removals are recorded only in Clerk's own logs, because our server never sees them. If `SEC-06` is later read to cover membership changes, the honest implementation is Clerk webhooks into the audit collection — not moving the mutations server-side.
- **No membership-request or domain-join flow.** Clerk supports both; V1's provisioning ladder is invitation-only, so neither is surfaced.
- **Invitation email wording and expiry are Clerk's defaults** — instance settings, not code.
- **No bulk invite.** `inviteMembers()` exists; the mock shows a single-email form and `TEN-03`'s budget is one invitation.

## References

- PRD: [`ADM-01`, `ADM-02`, `ADM-08`, `ADM-09`, `SEC-08`, `TEN-03`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-10` (instance-wide MFA), `IDN-12` (membership, not a per-user tenant field), `IDN-13` (reverification)
- [`admin-surface.spec.md`](admin-surface.spec.md) — organization topology, roles, the provisioning ladder and its delegation boundary, the unguarded last-admin decision, the `/team` nav entry
- [`admin-fans.spec.md`](admin-fans.spec.md) — the `useReverification` client precedent
- Mock: `mocks/admin-console/Team.png` (workspace) — layout source; MFA and last-sign-in columns deliberately not implemented, and the finalization line rendered as a settled negative
