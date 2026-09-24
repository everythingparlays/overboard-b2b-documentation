# Core Module Spec: Admin — Tell Overboard (Support Inbox)

**Implements:** PRD `ADM-01` (one console for both actor classes), `PRIZE-07` (a failed send has a resolution path), `OBS-05` (failures reach Overboard), `SEC-06` (audited). Concept seed: vault `cargo/passage-plans/2026-09-21-product-concepts.md` §1b.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope, the `?tenant=` exception, and **Honesty by omission** (Rule 13) plus **Plain product language**, which bind the resolution notes Overboard writes as much as any screen string. [`admin-game-day.spec.md`](admin-game-day.spec.md) — the failed-delivery rows that carry the highest-value button. [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) — the attention queue row and Platform health's anti-rot tile.

**Status:** Draft — built on `arthur-ops` (2026-09-23); revised on `arthur-g1-console` (2026-09-24) — see "Revision 2026-09-24", which wins wherever it and an older section disagree.

## Overview

Errors in the console end in a red card; the workflow after is texting Nick. Every place something can go wrong gets a **Tell Overboard** action that attaches its own context — the problem describes itself — and the answer comes back to the place the problem was.

Second-order value: every recorded spec gap that confuses a paying customer becomes an evidence-backed report. The inbox doubles as a prioritized list of which gaps hurt customers. Product intelligence disguised as support.

**The whole change, in one line:** one `B2BSupportReport` collection with a closed, PII-free context; a report drawer that shows exactly what will be sent; status chips on the thing reported; and a staff inbox at `/support` with Open, All and Patterns.

**In scope:** the model and contract (`obs-b2b-shared/src/{interfaces/b2b/B2BSupportReport,models/support-report,api/admin/support}.ts`); five endpoints; the report drawer and chips; the report action on every console error card, on game day's failed deliveries, on the fan drawer, and as a console-wide **Get help**; `/support` (the inbox for staff, "Your reports" for a workspace); the nav badge; the oldest-unresolved tile on Platform health; two audit actions.

**Not in scope:**

- **Email or chat notification to Overboard per report.** Deliberately never: a per-report email is how inboxes die. The badge counts unresolved reports, and the OBS overview's attention queue carries them — the places staff already look.
- **Auto-resolution** (resolve a report when the platform observes the fix — a redemption later fulfilled, tiers later added). Designed for, not built: the subject pair makes it a read-side rule. Recorded.
- **Report buttons inside screens other slices own this wave** — export refusals (Exports), contest and game rows (Games & Contests), publish rejections (Fields & Opt-ins, Branding), lifecycle divergence (All tenants), and reverification loops. Their *load* failures are covered on day one through the error card; the inline, pre-loaded buttons are recorded for those owners.

## Revision 2026-09-24 — a Support page, threads, one Resolved status

Arthur's walkthrough ruling: a **Support** page in the workspace sidebar that lists every report with a back-and-forth thread, replies both ways, Get help kept; staff can un-acknowledge; one **Resolved** status with a reason; the preview names the reporter and workspace with a friendlier footer; reports capture app version, browser and page URL; staff get time-to-first-response and time-to-resolve. No session recording. This section wins over any older line below.

### Where things live now

| Route | Who | What |
|---|---|---|
| `/support` | everyone with a workspace in view | **Support** — the workspace's reports, newest first, endless scroll (admin-lists.spec.md), search on the message, status filter (Open / Resolved / All). In the Workspace sidebar section, last. Staff with a tenant chosen see that tenant's reports, **including internal staff-raised ones** (marked "Internal"), plus staff actions. The old "not in the sidebar" decision is reversed. |
| `/support/:reportId` | the report's workspace, or staff | **The report page**: what was sent, the thread, a reply box, and the status. Staff get the triage panel (acknowledge / un-acknowledge, assign, resolve with a reason, merge, reopen) beside it. A full page with a URL, so a report can be linked from anywhere. |
| `/inbox` | staff | **Support inbox** (OBS Internal, badge unchanged): every workspace's reports, paged, with a **workspace filter**, search, status and reason filters, the Patterns view, and the two response-time metrics. Rows open `/support/:reportId` in that workspace. `/support` used to be the inbox for staff; it now always means the workspace page. |

Get help stays in the top bar, unchanged in place; after sending, its confirmation links to the new report's page.

### One Resolved status, with a reason

- **Statuses:** `open`, `acknowledged`, `resolved`. **Reasons** (on resolved only): `fixed`, `wont-fix`, `duplicate`.
- **Resolve** takes a reason and an answer. The answer is still required and still customer copy (Rule 4) — except `duplicate`, which is what a merge sets and which reads the target's answer, as before.
- The tenant chip and the Support page say **"Resolved"** with the answer; the reason shows as a quiet second word ("Resolved · Won't fix") so a reporter is never told "Closed".
- **Un-acknowledge** (`action: "unacknowledge"`): acknowledged → open, clearing `acknowledgedAt`. Staff only; audited as `support_report_update`.
- **Reopen** clears the reason, the answer and `resolvedAt`, and keeps the thread.

**Migration, non-destructive.** `wont-fix` stays a legal stored value, and every read maps it: `status: "wont-fix"` reads as `resolved` + `wont-fix`; a `resolved` row with no reason reads as `duplicate` when `mergedInto` is set, otherwise `fixed`. A one-off script (`node-server/scripts/migrate-support-v2.mjs`, dry run by default, `--apply` to write) rewrites old rows to the new shape — sets `status: "resolved"` and `resolutionReason`, copies the old status into `legacyStatus`, seeds `thread` from `message` and `resolution`, and derives `firstResponseAt` from `resolvedAt` where a resolution exists. It never deletes a field, and it is idempotent. The read-time mapping stays, so the console is correct before, during and after the script runs.

### Threads

- The report's own `message` is the first entry of the thread (the reporter's). Anyone in the report's workspace may reply; staff may reply to any report. `POST /admin/support/reports/:reportId/messages` `{ body }` (1–2,000 characters).
- A **workspace reply to a resolved report reopens it** — the industry norm: the reporter saying "still broken" must not land in a closed ticket nobody reads. Recorded in the thread as a quiet event line.
- Staff replies are customer copy, like resolutions (Rule 4).
- **Internal notes:** a staff reply can be marked internal. Internal notes are shown only to staff and never reach the workspace.
- Every status change also appears in the thread as an event line ("Overboard acknowledged this", "Resolved — fixed"), so the thread is the report's whole history.
- The tenant's unread cue: a report whose latest staff message is newer than the reporter's last view shows a dot on the Support page. (Stored per report as `lastWorkspaceViewAt`; no per-user read receipts.)

### What a report carries now

- **Captured automatically**, new context keys: `pageUrl` (the full console URL, which never carries PII — fan search is a POST), `browser` (a plain summary such as "Chrome 131 on Windows", derived from the user agent in the console), and `appVersion` (the console build: package version plus short commit, injected at build). All three on every report. The context stays a strict, closed key set.
- **The preview** shows, above the draft's own rows: **From** — the reporter's name; **Workspace** — the workspace's name. The old footer line ("With your name and workspace, so Overboard can reply") becomes: **"Goes straight to the Overboard crew. A real person reads every one."**

### Response-time metrics (staff)

- **Time to first response:** `firstResponseAt − createdAt` — the first staff reply (not an internal note) or resolution. Acknowledging is not a response.
- **Time to resolve:** `resolvedAt − createdAt`, for reports resolved as `fixed` or `wont-fix` (duplicates are excluded: they resolve at merge speed and would flatter the number).
- Shown at the top of the inbox as **median** and **90th percentile** over the last 30 days, with the number of reports each is based on, and an optional workspace filter. `GET /admin/support/metrics?tenant=&days=30`. A metric with no reports behind it is not shown (Rule 13).

### Endpoints added or changed

| Method | Path | Change |
|---|---|---|
| GET | `/admin/support/reports` | Paged (`cursor`, `limit`, `q`, `status=open|resolved|all`); staff see internal reports for the chosen tenant; the 200 cap goes. |
| GET | `/admin/support/reports/:reportId` | New. One report with its thread (internal notes only for staff). Marks the workspace's view time when a workspace user reads it. |
| POST | `/admin/support/reports/:reportId/messages` | New. `{ body, internal? }` — `internal` is staff-only. |
| PATCH | `/admin/support/reports/:reportId` | Adds `unacknowledge`; `resolve` takes `reason: "fixed" | "wont-fix"` (the `outcome` field is still accepted from old clients: `resolved`→`fixed`). |
| GET | `/admin/support/inbox` | Paged; `tenant`, `q`, `status`, `reason`, `fingerprint` filters. Patterns stay a separate small list in the same response. |
| GET | `/admin/support/metrics` | New, staff only. |

Audit: `support_report_update` (new) for acknowledge, un-acknowledge, assign, reopen and replies by staff; `support_report_resolve` as before for resolve and merge.

---

## The model

`B2BSupportReport` — one row per report, tenant-scoped like every B2B record:

| Field | Notes |
|---|---|
| `organizationId?` | The workspace it is about. Absent only for a report an Overboard staffer raised with no tenant in view (the audit log's platform-scoped precedent). |
| `reporterUserId`, `reporterOrgSlug`, `reporterName?`, `reporterIsObsStaff` | Who raised it. The name is snapshotted from the admin sign-in at creation so the inbox never re-queries it. Staff-raised reports are internal and never appear in a workspace's own list. |
| `surface` | Where it was raised: `load-error`, `failed-delivery`, `fan`, `contest`, `game`, `export`, `sign-in`, `publish`, `workspace`, `general`. |
| `kind` | `error` or `question`. |
| `subject?` | `{ type, id }` — what it is about (`redemption`, `membership`, `contest`, `game`, `screen`). This is what puts the answer back on the thing reported. |
| `context` | The auto-attached context, a **closed key set** (below). |
| `message?` | The reporter's own sentence, ≤2,000 characters. Optional — the context is meant to be enough. |
| `status` | `open` ⇄ `acknowledged` → `resolved`. Open and acknowledged are both **unresolved**; staff can un-acknowledge. `wont-fix` is a legacy value, read as `resolved` with reason `wont-fix` (see the revision). |
| `resolutionReason?` | `fixed`, `wont-fix` or `duplicate` — why a resolved report is resolved. |
| `thread` | The back-and-forth: `{ messageId, author: { userId, name, isObsStaff }, body, createdAt }[]`, oldest first, ≤200 messages of ≤2,000 characters. |
| `firstResponseAt?` | When Overboard first answered — the first staff message or resolution. Server-set; the metric's source. |
| `resolution?` | Overboard's answer. **Customer copy**: plain product language, no ids, no vendor names — the reporter reads it on the thing they reported. |
| `assigneeUserId?`, `assigneeName?` | Which staffer owns it. |
| `fingerprint` | `surface|kind|code`, server-derived. What Patterns clusters on. |
| `mergedInto?` | Set on a duplicate folded into another report. Indexed `{ mergedInto: 1 }`, sparse (only merged reports carry it): the inbox counts and lists the reports folded into each one it shows. |
| `acknowledgedAt?`, `resolvedAt?`, `resolvedByUserId?`, timestamps | |

### Context carries no fan PII — structurally

The concept's rule, "the inbox must not become a fourth PII channel", is enforced by the contract rather than by care: `supportContextSchema` is **strict**, over `SUPPORT_CONTEXT_KEYS` — `route`, `errorCode`, `httpStatus`, `errorMessage` (the server's own plain `message`, which by the backend's strings rule never carries PII), and platform ids (`contestId`, `betEventId`, `redemptionId`, `membershipId`, `prizeTierId`, `optInId`), plus `exportKind`, `reasonKind` and `appVersion`. An unknown key is a 400, not a silent drop, so adding "the fan's email, for convenience" requires changing a reviewed list. This is the audit log's Rule-7 posture (ids and counts, never contact fields), applied at the boundary.

The reporter's own `message` is theirs to write; the drawer's field has no copy about what not to type.

---

## The reporter's experience

**The button renders inside the thing that failed, pre-loaded.** The reporter's whole job is optionally typing a sentence.

Surfaces built this wave:

| Surface | Where | Subject | Context attached |
|---|---|---|---|
| `load-error` | The load-failure card on every console screen (below) — inside the card, last, under "Try again" and the server's line | `screen` = the route | route, error message |
| `failed-delivery` | Each failed row on `/live` | `redemption` | route, redemption, contest, game, reason category |
| `fan` | The fan drawer on `/fans` ("they say they never got their prize") | `membership` | route, membership |
| `general` | **Get help** in the top bar, every screen (it replaced a notifications bell that had nothing behind it) | — | route |

**Every console screen's load-failure card offers it.** The ops screens (Overview, Game day, Operations, All contests, Season calendar, Support, Game recap) and, since 2026-09-23, Exports, Fans, Fields & Opt-ins, Games & Contests, Sponsors & Branding (the Sponsors tab and the Brand tab), Prizes, Delivery queue, Platform health, All tenants and Team. The card is `ReportableLoadError` (`src/lib/support.tsx`): the kit's `LoadError` with **Tell Overboard** in its `action` slot — one card, the report inside it. Outside the console shell's support provider it is exactly `LoadError`, with no action. The slot is the kit's one additive change for this: `LoadError` (`src/components/ui/loadError.tsx`) gained an optional `action?: ReactNode`, drawn last inside the card, after the lead, the retry and the server's line; omitted, the card draws nothing for it, so every other call site is unchanged and nothing was restyled.

Deliberately without it: the shell's "Couldn't load your workspace" (it renders outside the support provider, so there is nowhere to send a report), Team's "No active organization" (a state, not a load failure), `/debug/health`, the Prize email card's small inline note when its settings don't load (a side card on a screen that did), and inline save errors (not load failures).

**The drawer shows exactly what will be sent, in plain words, in full** — "Where: Games & Contests", "What happened: Couldn't load games", "Error: 409" — then the optional message, then **Send to Overboard**. Nothing is attached that the drawer does not show.

**Then a status chip, on the thing reported.** "Reported — Overboard is looking into it" while unresolved; "Resolved: *the note Overboard wrote*" once resolved; "Closed: *the note*" for won't-fix. On a failed delivery row and a fan drawer the chip is durable (it is read back by subject); on an error card it appears in place after sending. **The resolution appearing where the problem was is the premium moment — protect it in any scope cut.**

**Your reports** (`/support`, for a workspace's users) is the secondary path: every report the workspace's own people raised, newest first, with status and resolution. Reached from the Get help drawer. It is not in the sidebar — the chips and the drawer are the primary paths, and a nav entry for a list most teams will rarely open is navigation for its own sake.

---

## Overboard's workflow — `/support`

Same route, rendered by identity (admin-surface **Seamlessness**): staff get the inbox, a workspace's users get Your reports.

- **Nav.** OBS Internal → **Support inbox**, with a badge counting **unresolved** reports (open + acknowledged) — never "unread". Hidden when zero.
- **Views.** **Open** (unresolved, oldest first — age is the thing that must not grow), **All** (newest first, capped at 200 with `truncated`), and **Patterns**: clusters of two or more reports sharing a fingerprint — "7 reports, 3 workspaces, the same refusal" is one product bug, not seven tickets.
- **A report** opens in a drawer: everything the reporter saw and sent, the reporter and workspace, age, a **Go to** link that opens the route in that workspace (jump-to-context), and actions: **Acknowledge**, **Assign to me** / unassign, **Resolve** (outcome resolved or won't-fix, with a required note), **Merge into…** (another open report), **Reopen**.
- **Merge.** The duplicate records `mergedInto`; reads show a merged report with its target's status and resolution, so the duplicate's reporter gets the same answer on their own chip. Merge is audited as a resolution.

### Anti-rot, in order of effectiveness

1. The badge counts **unresolved**, not unread.
2. **Resolution is customer-visible**, so ignoring a report has a cost someone can see.
3. **Oldest unresolved age** is a tile on Platform health, a screen staff already open.
4. Patterns collapse volume.
5. The OBS overview's attention queue carries a support row.
6. A modest stated expectation, owned by the team rather than the screen ("we look at these every game day").
7. **No per-report email.**

---

## Endpoints

| Method | Path | Auth | Who |
|---|---|---|---|
| POST | `/admin/support/reports` | requireAdmin | any console user; tenant = own org; staff: `?tenant=` optional (absent = platform-wide) |
| GET | `/admin/support/reports` | requireAdmin | tenant: own org's non-staff reports; staff: `?tenant=` required; optional `?subjectType=&subjectId=` |
| GET | `/admin/support/inbox` | requireAdmin | staff only; `?view=open|all` |
| GET | `/admin/support/summary` | requireAdmin | staff only — the badge and the Platform health tile |
| PATCH | `/admin/support/reports/:reportId` | requireAdmin | staff only; acknowledge / resolve / assign / merge / reopen |

- **POST** validates the strict context, derives the fingerprint, snapshots the reporter's name, writes `support_report_create` (fire-and-log — the report itself is the durable record), returns 201 with the report. A `membershipId` or `redemptionId` in context or subject must belong to the target workspace, else 404 (the probe answer): a report cannot be used to confirm another tenant's ids exist.
- **GET reports** returns at most 200, newest first. A merged report reads with its target's status and resolution.
- **PATCH** returns 404 for an unknown report, 409 for a transition that makes no sense (acknowledging a resolved report, merging into itself, into a merged report, or across workspaces), and writes `support_report_resolve` **before** the state write on resolve, won't-fix and merge (a closure with no record is the one kind the audit exists for).

**Deleting a workspace deletes its reports** (they are about that workspace; left behind, a report with no organization would read as a platform-wide one).

Reads and the report write are not reverification-gated: nothing here releases PII or is irreversible (admin-surface's reverification line).

## Rules

1. **Report context is a closed key set with no fan contact field.** Enforced by the contract (strict); widening it is a reviewed change to `SUPPORT_CONTEXT_KEYS`.
2. **A workspace sees only its own people's reports.** Staff-raised reports are internal; cross-workspace reads are refused as everywhere.
3. **Only Overboard staff change a report's state.** Enforced server-side on every PATCH.
4. **A resolution is required to close a report, and it is customer copy.**
5. **The badge counts unresolved reports.** Never unread.
6. **No per-report notification to Overboard.**
7. **The drawer attaches nothing it does not show.**

## Known gaps (recorded, not blocking)

- **Auto-resolution** — not built; the subject pair makes it a read-side rule when wanted.
- **Inline report buttons on other slices' screens** — exports, contest/game rows, publish rejections, lifecycle divergence, reverification loops.
- **Reporter notification of a resolution** outside the console — none; the answer appears where the problem was, which is the design, and there is no mail channel to the admin users yet.
- **No SLA or assignment rotation** — ownership is "assign to me".

## References

- Vault concept: `cargo/passage-plans/2026-09-21-product-concepts.md` §1b.
- Contracts: `obs-b2b-shared/src/api/admin/support.ts`; model `src/models/support-report.ts`.
- Audit actions: `support_report_create`, `support_report_resolve` (`B2BAdminAudit.ts`).
