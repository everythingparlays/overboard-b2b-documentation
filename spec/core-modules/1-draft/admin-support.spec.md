# Core Module Spec: Admin — Tell Overboard (Support Inbox)

**Implements:** PRD `ADM-01` (one console for both actor classes), `PRIZE-07` (a failed send has a resolution path), `OBS-05` (failures reach Overboard), `SEC-06` (audited). Concept seed: vault `cargo/passage-plans/2026-09-21-product-concepts.md` §1b.

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope, the `?tenant=` exception, and **Honesty by omission** (Rule 13) plus **Plain product language**, which bind the resolution notes Overboard writes as much as any screen string. [`admin-game-day.spec.md`](admin-game-day.spec.md) — the failed-delivery rows that carry the highest-value button. [`admin-obs-workspace.spec.md`](admin-obs-workspace.spec.md) — the attention queue row and Platform health's anti-rot tile.

**Status:** Draft — built on `arthur-ops` (2026-09-23).

## Overview

Errors in the console end in a red card; the workflow after is texting Nick. Every place something can go wrong gets a **Tell Overboard** action that attaches its own context — the problem describes itself — and the answer comes back to the place the problem was.

Second-order value: every recorded spec gap that confuses a paying customer becomes an evidence-backed report. The inbox doubles as a prioritized list of which gaps hurt customers. Product intelligence disguised as support.

**The whole change, in one line:** one `B2BSupportReport` collection with a closed, PII-free context; a report drawer that shows exactly what will be sent; status chips on the thing reported; and a staff inbox at `/support` with Open, All and Patterns.

**In scope:** the model and contract (`obs-b2b-shared/src/{interfaces/b2b/B2BSupportReport,models/support-report,api/admin/support}.ts`); five endpoints; the report drawer and chips; the report action on every console error card, on game day's failed deliveries, on the fan drawer, and as a console-wide **Get help**; `/support` (the inbox for staff, "Your reports" for a workspace); the nav badge; the oldest-unresolved tile on Platform health; two audit actions.

**Not in scope:**

- **Email or chat notification to Overboard per report.** Deliberately never: a per-report email is how inboxes die. The badge counts unresolved reports, and the OBS overview's attention queue carries them — the places staff already look.
- **Auto-resolution** (resolve a report when the platform observes the fix — a redemption later fulfilled, tiers later added). Designed for, not built: the subject pair makes it a read-side rule. Recorded.
- **Report buttons inside screens other slices own this wave** — export refusals (Exports), contest and game rows (Games & Contests), publish rejections (Fields & Opt-ins, Branding), lifecycle divergence (All tenants), and reverification loops. Their *load* failures are covered on day one through the error card; the inline, pre-loaded buttons are recorded for those owners.

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
| `status` | `open` → `acknowledged` → `resolved` / `wont-fix`. Open and acknowledged are both **unresolved**. |
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
