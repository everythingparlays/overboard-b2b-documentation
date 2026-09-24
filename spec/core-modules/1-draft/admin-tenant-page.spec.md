# Core Module Spec: Admin — Tenant page (staff)

**Implements:** PRD `TEN-03`, `TEN-05`, `ADM-06`, `PRIZE-03`, `SEC-06`, `ADM-09`, `AUTH-03` (email is the only sign-in method, so the page says so). HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-13`. Arthur's 2026-09-24 walkthrough rulings "Full pages instead of drawers" and "The tenant page (staff)".

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — user-level staff-ness (Rule 11), `?tenant=` targeting (Rule 1), the acting-on selection, the reverification list, "Pages, drawers and dialogs" and "Staff extras on tenant screens" (revised 2026-09-24). [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the All tenants directory this page is opened from, provisioning, and finalization. [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md) — rename, pause, resume and delete, reused unchanged. [`admin-team.spec.md`](admin-team.spec.md) — the staff team endpoints behind Re-invite (its "Revision 2026-09-24", on `arthur-g1-console`). [`admin-lists.spec.md`](admin-lists.spec.md) (lands with G1's PR this wave) — the endless-scroll list and cursor paging. [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) — `GET /admin/all-contests`, which the Contests section reads. [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page the Contests rows open, and the Finalize dialog. [`admin-prizes.spec.md`](admin-prizes.spec.md) — Prize deliveries, whose tiles the send counts match and whose cross-tenant mode the failed-sends links open.

**Supersedes:** the tenant detail drawer in [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) and the drawer surface in [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md) "The console surface". Both specs' endpoints, guards and rules stand; only where the controls live changes.

**Status:** Draft. Written 2026-09-24 for the S1 console redesign.

## Overview

Everything an operator can do to one tenant sits today in a 440px drawer on All tenants: a button to act on the tenant, a display-name field, a pause zone, a list of contests each carrying its own finalize zone, and a delete zone. Three destructive zones stack in a narrow slide-over, the contest list has no room for more than a name, and nothing links to a tenant directly: an operator who wants to tell a colleague "look at Denver" has to say "open All tenants, find Denver, click it". The drawer also shows things that are not true. Its subtitle names the tenant's sign-in variant ("phone sign-in"), a value the fan app has never read, and its only guidance for a missing first admin ("Invite them again from the Team screen") pointed at a screen that could not reach the tenant.

The tenant page replaces the drawer with a linkable full page at `/obs/tenants/:slug`. It carries what staff actually manage on a tenant: its name, its status, notes for colleagues, its first admin, its contests (with Finalize), its usage, whether its fan app can sign fans in, and the danger zone.

**The whole change, in one line:** one tenant, one staff page with a URL, holding every staff action on that tenant and the facts that decide them, and nothing that isn't real.

**In scope:**

- The screen at `/obs/tenants/:slug` and its states.
- `GET /admin/tenants/detail`, `GET /admin/tenants/notes` and `POST /admin/tenants/notes`, with contracts in `obs-b2b-shared/src/api/admin/tenants.ts`.
- The `staffNotes[]` array on `B2BOrganization`.
- The first-admin lookup and Re-invite, over the staff team endpoints in [`admin-team.spec.md`](admin-team.spec.md).
- The fan-app domain readiness check.
- Removing the auth-variant control from the console (the create-tenant drawer, the old drawer's subtitle, the directory).

**Not in scope:**

- **Billing, plans, quotas and contracts.** None exists in the model or in the PRD. The page has no plan section and no placeholder for one (admin-surface Rule 13).
- **Changing the subdomain.** Immutable (admin-obs-internal Rule 4, admin-tenant-lifecycle Rule 2). The page shows it and lets staff copy it.
- **Configuring the fan-app domain.** The page reports whether the backend accepts the tenant's origin; adding it is a deployment change, documented for staff, not a console write.
- **Editing the tenant's configuration from this page.** Brand, Fields & Opt-ins, Team, contests and sponsors are edited on the tenant's own screens, which staff open as the tenant from here. A second editor for any of them would be a second implementation of a screen.
- **The tenant's whole team.** The Team page, opened as the tenant, is where staff manage members (admin-team, revision 2026-09-24). This page shows only the first admin, because that is the one membership fact that decides whether a new tenant is live.
- **A contact field.** Staff notes carry who to call; a structured contact record has no reader yet.

---

## The model

One addition to `B2BOrganization`. Nothing else is stored; every other fact on the page is read live from where it already lives.

| Field | Type | Notes |
|---|---|---|
| `staffNotes` | `StaffNote[]`, optional, absent = none | Append-only. Schema `select: false`, so no read returns it unless it asks by name. At most 500 entries. |

```ts
export interface StaffNote {
  noteId: string;        // server-generated ObjectId string
  body: string;          // 1–2000 characters, trimmed, plain text
  authorUserId: string;  // the admin Clerk user id, from the session
  authorName: string;    // the author's display name at the moment of writing (a snapshot)
  createdAt: Date;       // server clock
}
```

**Why on the organization and not a collection.** Notes are bounded, always read with the tenant they describe, and die with it: deleting a tenant removes the record, and the notes go with it without a teardown step of their own. At 500 notes of 2000 characters the array is under a megabyte, and `select: false` keeps it out of every read that does not name it, including the fan-side tenant resolver, which reads the organization on every fan request.

**Why the author's name is a snapshot.** A note says who wrote it at the time. A staffer who later changes their display name, or leaves, does not rewrite the attribution of what they wrote (the normalize-versus-snapshot rule in [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md), applied to notes).

**`authVariant` is frozen.** The field stays on the model at whatever value each tenant has, because removing it would be a migration for nothing. The console never sends it, never shows it and never edits it; the create-tenant drawer stops asking for it; no screen reads it. New tenants get the schema default, `email`. It becomes a control again only when a second sign-in method exists (`AUTH-04`, `IDN-09`).

---

## Endpoints

All under `/admin`, all **staff only**: the handler refuses a caller who is not Overboard staff with 403 "OBS staff only" before resolving anything (admin-obs-internal Rule 1, on user-level staff-ness). Every one names the tenant as `?tenant=<slug>` (admin-surface Rule 1); the slug in the page's URL is presentation, and the request always sends it explicitly. An unknown or reserved slug is 404. Contracts in `obs-b2b-shared/src/api/admin/tenants.ts`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/tenants/detail` | `requireAdmin` | Everything on the page except notes and contests |
| GET | `/admin/tenants/notes` | `requireAdmin` | Staff notes, newest first, cursor-paged |
| POST | `/admin/tenants/notes` | `requireAdmin` | Append one note |
| POST | `/admin/tenants/rename` | `requireAdmin` | Unchanged ([`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md)) |
| POST | `/admin/tenants/suspend`, `/resume` | `requireAdminReverified` | Unchanged |
| POST | `/admin/tenants/delete` | `requireAdminReverified` | Unchanged, `{ confirmSubdomain }` |
| GET | `/admin/all-contests` | `requireAdmin` | Unchanged; the Contests section sets its workspace filter to this tenant ([`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md), [`admin-lists.spec.md`](admin-lists.spec.md)) |
| POST | `/admin/contests/:contestId/finalize` | `requireAdminReverified` | Unchanged, `{ confirmName }` |
| POST | `/admin/team/invitations/:invitationId/resend` | `requireAdminReverified` (this spec) | Re-invite while the first admin's invitation is pending ([`admin-team.spec.md`](admin-team.spec.md)) |
| POST | `/admin/team/invitations` | `requireAdminReverified` when it sends an admin invitation (this spec) | Re-invite after the invitation expired or was revoked; "Invite admin" when none exists |

### `GET /admin/tenants/detail`

Returns one object. Every number is computed for this tenant only, from the same rows the directory, Platform health and the Delivery queue read, so no two staff screens disagree about a tenant (admin-obs-internal Rule 8).

```ts
interface AdminTenantDetail {
  tenant: { slug: string; name: string; status: "active" | "suspended";
            suspendedAt?: string; createdAt: string; fanAppUrl: string };
  overview: { fanCount: number; contestCount: number; prizeSends30d: number;
              failedSends: number; lastFanActivityAt: string | null };
  firstAdmin:
    | { state: "accepted"; email: string; acceptedAt: string }
    | { state: "invited"; email: string; invitedAt: string; invitationId: string;
        invitationStatus: "pending" | "expired" | "revoked" }
    | { state: "none" }
    | { state: "no-organization" }
    | { state: "unavailable" };
  usage: { weekStarts: string[]; fansByWeek: number[]; prizeSendsByWeek: number[];
           fieldCount: number; optInCount: number; sponsorCount: number };
  setup: { fanAppOrigin: { origin: string; ready: boolean;
                           missingFrom: ("allowed-origins" | "sign-in-origins")[] };
           signInMethod: "email";
           brandLook: { kind: "preset"; name: string } | { kind: "custom" } | { kind: "standard" } };
}
```

- **`fanAppUrl` and `fanAppOrigin.origin`** come from one shared helper, `tenantFanOrigin(slug)` → `https://<slug>.overboardsports.com`, the same one that renders the hostname in the directory. No second copy of the domain.
- **`fanCount`**: the tenant's memberships. **`contestCount`**: its contests, drafts included. **`prizeSends30d`**: redemptions of this tenant's contests that reached `fulfilled` in the last 30 days, Prize deliveries' "Sent" tile. **`failedSends`**: redemptions currently `failed`, Prize deliveries' "Failed" tile ([`admin-prizes.spec.md`](admin-prizes.spec.md)). **`lastFanActivityAt`**: the later of the newest membership's `joinedAt` and the newest board's creation time, or `null` when the tenant has neither (Platform health's `lastBoardAt`, widened to joins).
- **`usage`**: twelve weeks, Monday-start in UTC, oldest first, the current partial week last. `fansByWeek` counts memberships by `joinedAt`; `prizeSendsByWeek` counts redemptions by `fulfilledAt`. `fieldCount` and `optInCount` are the published sign-up fields and opt-ins; `sponsorCount` is the tenant's sponsor records.
- **`firstAdmin`**: see "The first-admin lookup". A Clerk failure answers `unavailable` for this block only; the rest of the response is unaffected.
- **`setup.fanAppOrigin`**: see "The fan-app domain check".
- **`setup.signInMethod`** is the constant `"email"`, not a read of `authVariant`: email is the only way a fan can sign in (`AUTH-03`), so it is the only true answer whatever a tenant was created with.
- **`setup.brandLook`**: the tenant's stored theme compared with the shipped presets, the gallery and the tenant's own presets, ignoring team colours (`THEME-08` keeps them when a preset is applied). A match answers that preset's name; a stored theme that matches none answers `custom`; no stored theme answers `standard`. If the Brand redesign stores which preset was applied, this reads that instead.

### The first-admin lookup

The first admin is not stored. The handler asks Clerk, through the Backend API with the admin instance's secret key, about the Clerk organization whose slug is the tenant's subdomain (admin-surface Rule 4):

1. **No Clerk organization** for the slug → `no-organization`. This is the synced-pair violation admin-surface Rule 10 records as data debt (`warriors`, `fightinghawks`); the page says so to staff rather than inventing an admin.
2. **Admin memberships.** List the organization's memberships with role `org:admin`, leaving out Overboard staff users (the same user-level check as everywhere). If there is at least one, the answer is `accepted`: the first admin is the earliest-created of them, `email` is that user's primary address and `acceptedAt` is the membership's creation time.
3. **Admin invitations.** Otherwise list the organization's invitations with role `org:admin`, in any status, and take the most recent by creation time: `invited`, with its status (`pending`, `expired` or `revoked`) and id. This is the same "most recent admin invitation" the Team page's staff card reads (admin-team, revision 2026-09-24), so the two screens always name the same person.
4. **Neither** → `none`.

Reading it live rather than storing it is deliberate: Clerk owns membership (D-061), a stored copy would go stale the moment the invitee accepts, and the lookup is one tenant, two short lists, on a staff page.

### Re-invite, and why it is reverified

Re-invite sends a new invitation to the first admin's address, as `org:admin`, and leaves exactly one live link:

- **While the invitation is pending:** `POST /admin/team/invitations/:invitationId/resend?tenant=`, which revokes the pending invitation and sends a fresh one to the same address and role.
- **After it expired or was revoked:** `POST /admin/team/invitations?tenant=` with `{ email, role: "org:admin" }`.

Both run under `requireAdminReverified` whenever they send an `org:admin` invitation. **This tightens [`admin-team.spec.md`](admin-team.spec.md)'s staff endpoints, and this spec wins on it.** An admin invitation hands whoever opens the email full control of a customer's workspace; it is the mirror image of "removing an organization member or changing their role", which is already on the admin-surface reverification list for being the path to losing control of a tenant. A walked-away staff session must not be able to send one. Member invitations are unaffected. Audited with the Team spec's actions (`team_invite`, `team_invite_revoke`), ids and roles only.

The server refuses a Re-invite when the lookup now answers `accepted`: 409 "They've already joined." A double-click or a stale page cannot send a second link to someone who is already in.

### `GET /admin/tenants/notes` and `POST /admin/tenants/notes`

- **GET** is cursor-paged under the [`admin-lists.spec.md`](admin-lists.spec.md) convention, newest first, ordered by `createdAt` then `noteId`, with the real total. It projects `staffNotes` explicitly; nothing else ever does.
- **POST** takes `{ body }`. The body is trimmed; empty or over 2000 characters is 400 with a field error. The server sets `noteId`, `authorUserId` and `authorName` from the session and `createdAt` from its clock; none is accepted from the client. The write is one `$push` guarded by the size of the array, so a tenant at 500 notes answers 409 "This tenant has 500 notes, the most it can hold." Responds 201 with the new note.
- **No PATCH and no DELETE exist.** A note is a record of what a colleague knew and when; it is corrected by writing another note.
- Notes are not audited: each one is already a record of who wrote what and when, and a note is not PII release or an irreversible action (the `SEC-06` line the audit log draws).

### The fan-app domain check

A tenant's fan app works only if the backend accepts requests and fan sign-ins from `https://<slug>.overboardsports.com`, and today that needs a deployment change: the backend's `FRONTEND_ORIGIN` (the comma-separated CORS allowlist) and `FAN_AUTHORIZED_PARTIES` (the origins the fan sign-in accepts tokens from) are exact lists, and creating a tenant adds nothing to either.

The check runs in the process answering the request, against its own configuration. It normalises the tenant's origin and each configured entry (lowercase, no trailing slash) and looks for an exact match:

| State | When | `missingFrom` |
|---|---|---|
| **Ready** | The origin is in both lists | empty |
| **Not configured** | The origin is missing from either list | which list or lists lack it |

Two states and no more. The check claims what it verifies and nothing beyond: it does not test DNS or hosting (recorded gap), and a wildcard entry, if a stack ever uses one, does not count as a match.

### Changes to existing endpoints

- **`POST /admin/tenants`**: the console no longer sends `authVariant`. The contract keeps the optional field so an older client is not broken; the create-tenant drawer asks for three things (name, subdomain, first admin email).
- **`GET /admin/tenants/directory`** (and G1's paged `GET /admin/tenants`): the console stops rendering `authVariant`. Nothing reads it.
- **Every read that returns the organization document**, the public `GET /b2b/org/:subdomain` above all, never carries `staffNotes`; `select: false` makes that the default, and a test pins it on the public read and on `GET /admin/health`.

---

## The screen

### `/obs/tenants/:slug` — Tenant page

Reached from a row of All tenants (`/tenants`), from a staff link on any tenant screen (the Overview staff strip's tenant link, the paused banner's staff wording), and by URL. Staff only: a non-staff user who types the URL gets the console's "Overboard staff only" card, and the server refuses the reads regardless. The OBS Internal nav keeps **All tenants** active while the page is open.

The page is full width inside the console shell (the sidebar stays; this is not the full-screen builder). The back link, "All tenants", sits above the header and returns to the directory with its search and filters as they were.

**1. Header.**

- Eyebrow "Tenant". H1 the display name.
- **The display name edits in place.** Clicking it, or its pencil button, turns it into a text field (1–80 characters) with the current name selected. Enter or leaving the field saves through `POST /admin/tenants/rename`; Escape cancels. While it saves the field is read-only; on success the H1 shows the new name and an inline line reads "Saved." A refusal answers beside the field in plain words, and the lifecycle spec's loud divergence case ("Clerk now says X, the record says Y") is shown verbatim to staff. Not reverified (admin-tenant-lifecycle, "No reverification, argued").
- **Status chip**: "Active", or "Paused" with the date on hover ("Paused on Sep 20, 2026").
- **The fan-app address**, `https://denver.overboardsports.com`, in the mono face, with a copy button ("Copy address"; after copying, "Copied" for two seconds, announced to screen readers). Under it, muted: "The subdomain can't be changed."
- **Actions**, right-aligned: **"Open as this tenant"** (primary), then an overflow menu.
  - "Open as this tenant" sets the console's acting-on selection to this tenant, exactly as the sidebar switcher does (a Clerk `setActive` when the staffer is a member of the tenant's organization, the internal acting-on context otherwise), and navigates to Overview `/`.
  - The overflow menu holds staff shortcuts to the cross-tenant screens, already narrowed to this tenant: "Prize deliveries" (`/obs/prize-deliveries?tenant=<slug>`, [`admin-prizes.spec.md`](admin-prizes.spec.md)), "Support reports" (the Support inbox with its workspace filter set to this tenant), "Fan actions export" (Fan actions with this tenant chosen).

**2. Overview tiles.** Five `KpiTile`s in a row (wrapping at narrow widths), each with its family's hue outline: **Fans** (fans hue), **Contests** (games), **Prize sends (30 days)** (prizes), **Failed sends** (prizes; the number in the status red when above zero, and the tile links to `/obs/prize-deliveries?tenant=<slug>`, whose status filter opens on Failed), **Last fan activity** (fans; a relative time, "3 hours ago", with the exact time on hover). A tenant with no fan activity shows "No fans yet" in that tile's place of the number.

**3. Staff notes.** A card titled "Staff notes" with the caption "Only Overboard staff see these notes."

- A composer at the top: a text area with the placeholder "Add a note for the team", and "Add note" (also Ctrl+Enter / Cmd+Enter). **The draft saves itself** as the staffer types, into browser storage keyed by user and tenant, so leaving the page, reloading or a lost connection never loses a half-written note; a quiet line reads "Draft saved". "Add note" posts it; on success the draft clears and the note appears at the top of the list with the row-flash cue.
- The list beneath, newest first, loads as the reader scrolls. Each entry shows the author's name, the time ("Sep 24, 2026, 4:12 PM", relative on hover), and the body as plain text with its line breaks kept. No entry has an edit or delete control.
- Empty: "No notes yet."
- Why the draft saves locally and the entry does not autosave to the server: an append-only log cannot take keystrokes as entries. Autosaving the draft gives the no-lost-work guarantee "autosaved" is for; posting stays one deliberate act, which is what makes each entry a record.

**4. First admin.** A card titled "First admin".

| Lookup answer | What the card shows |
|---|---|
| `accepted` | The email, and "Accepted on Sep 12, 2026". No action. |
| `invited` | The email, and "Invited Sep 12, 2026, not accepted". Primary-ghost **"Re-invite"**; a quiet link "Invite a different address". |
| `none` | "No admin has been invited yet." and **"Invite admin"**. |
| `no-organization` | "No one can sign in to this tenant's console: it has no organization on the sign-in service." No action (reconciliation is its own task, admin-surface Rule 10). |
| `unavailable` | "The first admin didn't load." and "Try again". |

- **"Re-invite"** opens a centred dialog: title "Send a new invitation?", body "We'll email a new invitation to {email} to join {name} as an admin. The earlier link stops working.", buttons "Send invitation" and "Cancel". Confirming runs reverification, then the resend or invite call above. On success the dialog closes and the card reads "Invitation sent to {email}." with the new date. A cancelled reverification leaves the dialog open with the quiet line "Nothing was sent."
- **"Invite a different address"** and **"Invite admin"** open the invite admin drawer (a drawer that stays; see admin-surface "Pages, drawers and dialogs") with the role fixed at Admin. Sending from it revokes a still-pending first-admin invitation first, so there is only ever one live admin link, and the new invitation becomes the one this card shows.

**5. Contests.** A card titled "Contests" with a search field ("Search contests") and the count ("12 contests"). An endless-scroll table (`InfiniteTable`) over `GET /admin/all-contests` with the workspace filter set to this tenant, newest first.

| Column | Content |
|---|---|
| Name | The contest name |
| Type | "Bingo" or "Trivia" |
| Status | The status chip (Draft, Upcoming, Open, Closed, Finished), with "Hidden" and the lock glyph beside it where they apply |
| Players | The board count |
| Next game | "vs Denver · Sat 7:00 PM", or nothing when no game is ahead |
| (action) | **"Finalize"** (ghost), only when the contest is published, not finalized, and every one of its games has ended (the card's rule in [`admin-contests.spec.md`](admin-contests.spec.md)); otherwise the cell is empty, not a disabled button |

- **A row opens the contest page acting as the tenant**: it sets the acting-on selection to this tenant and navigates to `/contests/:id?tenant=<slug>`. The contest page's back link then returns here.
- **Finalize** stops the row click and opens the one centred Finalize dialog the contest cards and the contest page use ([`admin-contests.spec.md`](admin-contests.spec.md), "Finalize, wherever it appears"): the consequence in plain words, the contest name typed to confirm, reverification, then `POST /admin/contests/:contestId/finalize` with `confirmName` (admin-obs-internal Rule 5). On success the row's status becomes Finished, its Finalize cell empties, and the row reads "Finalized." for a moment.
- Empty: "No contests yet." Filtered empty: "No contests match."

**6. Usage.** A card titled "Usage".

- Two sparklines, twelve weeks each, in the tenant colour with the week labels on hover: "New fans by week" with the twelve-week total beside it ("+214 in 12 weeks"), and "Prize sends by week" with its total ("96 sent in 12 weeks"). A series that is all zero draws a flat line; it is still true.
- Three counts beneath: "Sign-up fields", "Opt-ins", "Sponsors".

**7. Setup.** A card titled "Setup", a definition list:

- **"Fan-app domain"**: the address, and a status: "Ready" or "Not configured". "Not configured" names the missing list or lists ("Not accepted for sign-in", "Not in the allowed origins", or both) and links to the fan-origin runbook, "How to add a fan-app domain". This is a staff surface, so an internal link belongs here; it renders only when the runbook's URL is configured in the console (recorded gap: the runbook is not written yet). A muted line under the row reads "Checks that the backend accepts requests and sign-ins from this address."
- **"Sign-in method"**: "Email". Read-only, no control.
- **"Brand"**: the preset name ("Prime Time"), or "Custom look", or "Standard look", with the tenant's two team colours as swatches.
- **Links that open the tenant's own screens as the tenant**: "Team", "Fields & Opt-ins", "Brand". Each sets the acting-on selection to this tenant and navigates to `/team`, `/config` or `/branding`.

**8. Danger zone.** A card titled "Danger zone", outlined in the status red, last on the page. Rules and endpoints are [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md)'s, unchanged; only the presentation moves from inline drawer zones to centred dialogs (admin-surface, "Pages, drawers and dialogs").

- **Pause / Resume.** An active tenant shows "Pause fan access" with the line "Fans can't play until you resume. Nothing is deleted." A paused tenant shows "Resume fan access". Each opens a centred dialog:
  - Pause: title "Pause {name}?", body "Fans see a paused screen within a minute. Their accounts, boards and prizes are kept. The tenant's own admins can still sign in, but can't change anything.", buttons "Pause fan access" / "Cancel".
  - Resume: title "Resume {name}?", body "Fans can play again within a minute.", buttons "Resume fan access" / "Cancel".
  - Confirming runs reverification, then the endpoint. A cancelled prompt reads as nothing having happened: "Nothing was paused." / "Nothing was resumed." as a quiet line in the dialog. A 409 because the state already changed elsewhere closes the dialog and refreshes the page.
- **Delete.** "Delete tenant", with the line "Removes the tenant, its contests, boards, prizes, sponsors and memberships. Fan accounts are kept." It opens a centred dialog: title "Delete {name}?", the consequences as a short list with the pre-flight counts ("14 contests · 3,860 memberships · 9,112 boards · 420 prize records"), the sentence "This can't be undone.", a field "Type {slug} to confirm", and "Delete tenant" enabled only on an exact match. Confirming runs reverification, then `POST /admin/tenants/delete` with `confirmSubdomain`. On success the console refreshes the tenant list behind the switcher, returns to All tenants and shows the inline line "Deleted {name}." there.

### States

| State | What the page shows |
|---|---|
| **Loading** | The back link, a skeleton header (name, chip, address), five skeleton tiles and skeleton cards for the sections. The notes list and the contests table each show their own skeleton rows until their first page arrives. |
| **Paused tenant** | Everything as for an active tenant, plus a banner under the header: "Fans can't play right now. Paused on Sep 20, 2026." with "Resume fan access" (the same dialog). Staff writes are not refused on a paused tenant, so every control stays live. |
| **Deleted or not found** | The detail read answered 404 (a mistyped slug, a reserved one, or a tenant deleted in another tab): "No tenant uses the subdomain “{slug}”." and "Back to All tenants". No sections render. |
| **Error** | The detail read failed: the console's load-failure card, "The tenant didn't load.", with "Try again" and Tell Overboard. A section that loads separately (notes, contests) fails alone, with "These didn't load." and "Try again" in that card; the rest of the page stays. A first-admin lookup failure is the card's `unavailable` state above. |

### Permissions

Overboard staff only, enforced server-side on every endpoint above; the page renders for staff and shows the "Overboard staff only" card to anyone else. Within staff there is no further split: every staff role may use every control, and the irreversible or grant-issuing ones (Pause, Resume, Delete, Finalize, Re-invite) are reverified. A tenant's own admins never see this page, its notes or its numbers (admin-surface Rule 13 and `ADM-09` are not in tension here: this is not a customer surface).

### Copy

| Where | String |
|---|---|
| Back link | "All tenants" |
| Eyebrow | "Tenant" |
| Status chips | "Active", "Paused" |
| Address caption | "The subdomain can't be changed." |
| Copy button | "Copy address", then "Copied" |
| Primary action | "Open as this tenant" |
| Overflow items | "Prize deliveries", "Support reports", "Fan actions export" |
| Name saved | "Saved." |
| Tiles | "Fans", "Contests", "Prize sends (30 days)", "Failed sends", "Last fan activity"; empty "No fans yet" |
| Notes | "Staff notes", "Only Overboard staff see these notes.", "Add a note for the team", "Add note", "Draft saved", "No notes yet." |
| First admin | "First admin", "Accepted on {date}", "Invited {date}, not accepted", "Re-invite", "Invite a different address", "No admin has been invited yet.", "Invite admin", "No one can sign in to this tenant's console: it has no organization on the sign-in service.", "The first admin didn't load.", "Try again" |
| Re-invite dialog | "Send a new invitation?", "We'll email a new invitation to {email} to join {name} as an admin. The earlier link stops working.", "Send invitation", "Cancel", "Invitation sent to {email}.", "Nothing was sent.", "They've already joined." |
| Contests | "Contests", "Search contests", "{n} contests", "Finalize", "No contests yet.", "No contests match." |
| Finalize dialog | As [`admin-contests.spec.md`](admin-contests.spec.md) "Finalize, wherever it appears" ("Finalize {contest}?", "Type “{contest}” to confirm", "Finalize permanently", "Finalized.") |
| Usage | "Usage", "New fans by week", "+{n} in 12 weeks", "Prize sends by week", "{n} sent in 12 weeks", "Sign-up fields", "Opt-ins", "Sponsors" |
| Setup | "Setup", "Fan-app domain", "Ready", "Not configured", "Not accepted for sign-in", "Not in the allowed origins", "How to add a fan-app domain", "Checks that the backend accepts requests and sign-ins from this address.", "Sign-in method", "Email", "Brand", "Custom look", "Standard look", "Team", "Fields & Opt-ins" |
| Danger zone | "Danger zone", "Pause fan access", "Fans can't play until you resume. Nothing is deleted.", "Resume fan access", "Delete tenant", "Removes the tenant, its contests, boards, prizes, sponsors and memberships. Fan accounts are kept." |
| Pause dialog | "Pause {name}?", "Fans see a paused screen within a minute. Their accounts, boards and prizes are kept. The tenant's own admins can still sign in, but can't change anything.", "Nothing was paused." |
| Resume dialog | "Resume {name}?", "Fans can play again within a minute.", "Nothing was resumed." |
| Delete dialog | "Delete {name}?", "This can't be undone.", "Type {slug} to confirm", "Delete tenant", then on All tenants "Deleted {name}." |
| Paused banner | "Fans can't play right now. Paused on {date}." |
| Not found | "No tenant uses the subdomain “{slug}”.", "Back to All tenants" |
| Load failure | "The tenant didn't load.", "These didn't load." |

### The create-tenant drawer

Stays a drawer (three fields). Its fields are now **Name**, **Subdomain** (with "It can't be changed later." beneath), **First admin email**; the "Auth variant" segmented control and its "How fans sign in on the team's site." hint are removed. The success drawer, "Tenant created", gains one link: "Open the tenant page", to `/obs/tenants/:slug`.

---

## Rules

1. **`TP-01` — Staff only, refused first.** Every endpoint this page calls refuses a non-staff caller with 403 before resolving the tenant; hiding the page is UX, the server is the boundary.
2. **`TP-02` — The tenant is named explicitly.** The URL's slug is presentation; every read and write sends `?tenant=<slug>`, and an unknown or reserved slug is 404.
3. **`TP-03` — The subdomain is shown, copyable and never editable.** The page's only name control edits the display name, through the lifecycle rename, both systems or neither.
4. **`TP-04` — Staff notes are append-only.** No endpoint edits or deletes a note; author, name and time are set by the server, and the author's name is a snapshot.
5. **`TP-05` — Staff notes never leave staff reads.** The field is `select: false`; only the notes endpoint projects it; the public org read, the health read and every tenant-scope read are pinned by test not to carry it.
6. **`TP-06` — The first admin is read live from Clerk, never stored.** The lookup is the one this spec defines, and it names the same person as the Team page's staff card.
7. **`TP-07` — Re-invite exists only while the first admin has not accepted, is reverified, and leaves one live link.** An admin invitation sent by staff always runs under reverification; a Re-invite after acceptance is 409.
8. **`TP-08` — Every number on the page reads the same rows as the other staff screens.** Failed sends are Prize deliveries' Failed predicate; players are board counts; nothing is a stored counter.
9. **`TP-09` — Contest rows open the contest page acting as the tenant, and Finalize follows the one rule everywhere.** Shown only when the contest is published, not finalized, and every game has ended; one dialog, typed name, reverification, audit first.
10. **`TP-10` — Opening anything "as this tenant" sets the console's acting-on selection first.** The header action, the Setup links and the contest rows all use the switcher's own mechanism, so the sidebar and the page never disagree about which tenant is on screen. The overflow shortcuts open cross-tenant staff screens narrowed by a filter, and change no selection.
11. **`TP-11` — Fan-app domain readiness is the backend allowlist check, with two states.** "Ready" means the origin is in both the CORS allowlist and the fan sign-in's authorized origins; anything else is "Not configured". It claims nothing about DNS or hosting.
12. **`TP-12` — Sign-in method is "Email", always, and `authVariant` has no control anywhere.** The stored value is frozen and read by nothing; the create-tenant drawer does not ask for it.
13. **`TP-13` — The danger zone is the lifecycle module, unchanged, in dialogs.** Pause, resume and delete keep their endpoints, reverification, typed confirmation and blocking audit; their confirmations are centred dialogs.
14. **`TP-14` — The page shows only what exists.** No billing, plan or contact section and no placeholder for one; a tenant with no activity shows that plainly, never a dash.

## Known gaps (recorded, not blocking)

- **The fan-origin runbook is not written.** The Setup row's link renders only once its URL is configured in the console. The runbook's content: add `https://<slug>.overboardsports.com` to `FRONTEND_ORIGIN` and `FAN_AUTHORIZED_PARTIES` for each stack through CDK, and redeploy.
- **Creating a tenant does not make its fan app work.** The origin has to be added by a deployment. The readiness row makes the gap visible to staff; closing it (origins read from the tenant directory rather than an environment list) is backend work with its own security review.
- **DNS and hosting are not checked.** Whether the wildcard domain actually serves the tenant's host is outside the backend's knowledge.
- **The brand look is inferred** by comparing the stored theme with presets, until the Brand redesign stores which preset was applied.
- **Notes cap at 500 per tenant.** A tenant that reaches it would move notes to a collection of their own, which is the shape change, not a larger cap.
- **Re-invite reverification tightens the Team spec's staff endpoints**, which were written on `arthur-g1-console` without it; the two branches reconcile at merge, with this spec winning on admin invitations.

## References

- PRD: [`TEN-03`, `TEN-05`, `ADM-06`, `ADM-09`, `PRIZE-03`, `SEC-06`, `AUTH-03`, `AUTH-04`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework, reverification list, pages/drawers/dialogs, staff extras
- [`admin-obs-internal.spec.md`](admin-obs-internal.spec.md) — the directory, provisioning, finalization
- [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md) — rename, pause, resume, delete
- [`admin-team.spec.md`](admin-team.spec.md) — the staff team endpoints behind Re-invite
- [`admin-lists.spec.md`](admin-lists.spec.md) — endless scroll and cursor paging
- [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) — `GET /admin/all-contests`
- [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page and Finalize
- [`admin-prizes.spec.md`](admin-prizes.spec.md) — Prize deliveries, tenant and cross-tenant
- [`admin-fans.spec.md`](admin-fans.spec.md) — the other drawer that became a page on 2026-09-24
- [`admin-branding.spec.md`](admin-branding.spec.md) — presets and `THEME-08`, behind the Brand row
- Current code replaced: `obs-b2b-admin-frontend/src/pages/Tenants.tsx` (`TenantDrawer`, the auth-variant control in `CreateTenantDrawer`)
