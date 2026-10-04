# Core Module Spec: Fan Support — Report a Problem

**Implements:** the proposed PRD requirement `SUP-01` (fans report a problem to their team; [`PRD-changes-contributed-by-Arthur.md`](../../../documents/PRD/PRD-changes-contributed-by-Arthur.md), entry 38, awaiting Nick), `SEC-03` (fans' words stay out of logs and monitoring), `SEC-07` (deleting a fan deletes their reports), `SEC-09` (per-fan limits against spam), `ADM-01` and `ADM-09` (a team only ever reads its own fans' reports), `ADM-02` and `ADM-03` (members read, admins answer). Arthur's binding brief for fan support (2026-10-03).

**Depends on:** [`admin-support.spec.md`](admin-support.spec.md) — Tell Overboard: its no-fan-PII context, its sides ("the side is where it was written"), the console's shared row, conversation and reply pieces, and the revision "Revision 2026-10-03 — fans' reports" that moves its own list to `/support/overboard`. [`admin-surface.spec.md`](admin-surface.spec.md) — scope, the `?tenant=` exception, the write rule, the staff Admin / Member view, and staff-see-what-the-workspace-sees. The fan app's routes (`src/AppRoutes.tsx`) and side menu (`components/layout/SideMenu.tsx`) on main, which have no spec of their own (the overhaul's fan-app spec, never merged, was removed on 2026-10-03). [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) — what the console's phone preview offers. [`admin-overview.spec.md`](admin-overview.spec.md) — Needs attention. [`admin-fans.spec.md`](admin-fans.spec.md) and [`admin-tenant-lifecycle.spec.md`](admin-tenant-lifecycle.spec.md) — the deletes that now take fan reports with them.

**Status:** Draft — built on `arthur-fan-support` (2026-10-03) in `obs-b2b-shared`, `overboard_sports_backend`, `obs-b2b-admin-frontend` and `overboard-b2b-template`. Not merged.

## Overview

A fan with a problem today has nowhere to take it inside the app. A team learns about it on social media, or not at all. Tell Overboard, the console's support channel, is a conversation between a workspace and Overboard and promises structurally that it carries no fan PII, so it can't hold a fan's own words.

**The whole change, in one line:** a signed-in fan reports a problem from the fan app's menu; it lands in their team's console under Support → From fans; the team and the fan talk it through on a thread the fan reads in the app, and the team resolves it. Overboard reads every team's fan reports from a read-only tab of its inbox.

**In scope:** the `B2BFanReport` model and its contracts (`obs-b2b-shared/src/{interfaces/b2b/B2BFanReport,models/fan-report,api/b2b/fan-report,api/admin/fan-reports}.ts`); five fan endpoints and six console endpoints; the fan app's Help group, Report a problem, Your reports and a report's page; the console's Support tabs, the fan report page with its desk panel, "Ask Overboard about this", the Support nav badge, the Overview item, the inbox's From fans tab and three Operations verbs; the delete cascades; four indexes; three audit actions; the browser and app-version helpers moved to `obs-b2b-shared` (`src/ui/browser.ts`, `src/ui/app-version.ts`) so both apps attach the same strings.

**Not in scope:**

- **Email.** No email to the fan when the team replies, and no email or digest to the team when a fan reports. The fan sees a dot on the menu; the team sees the Support badge and the Overview item. Not in this version.
- **Attachments.** No screenshots or files. The context the app attaches (page, app version, device) is the whole of what is sent beside the fan's words.
- **Signed-out reporting.** Only signed-in members of the team can report. A fan who can't sign in has no form.
- **Merge.** Duplicate fan reports are not merged; each fan's report is its own conversation.
- **Overboard triage of fan reports.** Overboard does not acknowledge, assign, resolve or annotate fan reports from its own screens. The team is the support desk for its fans. Overboard staff act on a fan report only by opening it in the team's workspace, where they act as the team.
- **Per-report notification** to the team or to Overboard, of any kind.

## Why a new collection, not Tell Overboard

Tell Overboard's promise is "no fan PII", enforced by a strict, closed context key set (admin-support Rule 1). Its counts are global, and its triage is Overboard's alone. A fan's report is the opposite on each point: its body is the fan's own words, which will carry names, emails and phone numbers; it belongs to one team; and the team answers it. Putting fan reports into `B2BSupportReport` would break the no-PII promise for every report in it. So fan reports are their own collection, `B2BFanReport`, and the two meet only by id: a team that wants Overboard's help with a fan report files an ordinary Tell Overboard report that names the fan report by `fanReportId`. The fan's words are never copied across.

---

## The model

`B2BFanReport` — one row per report, collection `<prefix>fan_reports`, tenant-scoped like every B2B record. It is fan data.

| Field | Notes |
|---|---|
| `organizationId` | The team. |
| `membershipId`, `fanId` | The reporting fan's membership in this team and their platform identity. Set by the server from the session, never read from the body. |
| `fanDisplayName?` | The fan's display name when they reported: a fallback for when the membership can't be read. |
| `category` | `not-working`, `scoring`, `prizes`, `account`, `other` (`FAN_REPORT_CATEGORIES`). Both apps show the shared labels (`FAN_REPORT_CATEGORY_LABELS`): "Something isn't working", "Scoring or results", "Prizes", "My account", "Something else". |
| `contestId?` | The contest it is about, when the fan named one. Always one of this team's contests that fans can see (not a draft). A contest deleted since reads as no contest. |
| `context` | What the app attached, a closed key set (below). Stored as Mixed; the key set is enforced at the API boundary, as for Tell Overboard. |
| `status` | `open` or `resolved` (`FAN_REPORT_STATUSES`). |
| `resolutionReason?` | Set while resolved, cleared on reopen: `answered`, `fixed`, `wont-fix`, `spam` (`FAN_REPORT_RESOLVE_REASONS`). Never sent to the fan. |
| `awaiting` | Whose turn it is: `workspace` after the fan writes, `fan` after the team replies (`FAN_REPORT_AWAITING`). An open report awaiting `workspace` is **unanswered**. |
| `thread` | The conversation, oldest first. The fan's report is the first entry. Each entry: `{ messageId, kind: "message" \| "event", author: { side, userId, name? }, body?, event?, reason?, createdAt }`. A message carries `body` (≤2,000 characters); an event carries `event` (`resolved` or `reopened`) and, for `resolved`, the `reason`. `author.userId` is the fan-instance Clerk user id on the fan's side and the admin-instance Clerk user id on the workspace's side; it is stored, never sent to the other side. |
| `fanMessageCount` | The fan's messages on the thread, their first included: what the per-thread fan limit counts. |
| `lastFanMessageAt` | When the fan last wrote. |
| `lastWorkspaceMessageAt?` | When the team last wrote something, a message or a status change: what the fan's unread dot compares. |
| `lastFanViewAt?` | When the fan last opened the report. |
| `lastWorkspaceViewAt?` | When someone in the team's workspace last opened it: what the console's dot compares. Per workspace, not per person. |
| `firstResponseAt?` | When the team first replied (a message, not a resolve). |
| `lastActivityAt` | The last message or status change: what every list sorts by. Its own field because `updatedAt` also moves when someone merely opens the report. |
| `resolvedAt?`, `resolvedByUserId?` | Set while resolved; cleared on reopen. |
| `createdAt`, `updatedAt` | Timestamps. Opening a report stamps a view time without touching them. |

### The context: a closed key set, every key shown first

`fanReportContextSchema` is strict over `FAN_REPORT_CONTEXT_KEYS`; an unknown key is a 400.

| Key | What | Bound |
|---|---|---|
| `route` | The fan-app path the menu was opened on (`/board/…`). A path only: a query string or hash is refused. | ≤200 characters, must start with `/` |
| `appVersion` | The fan-app build, "0.0.0+33675f1": the package version and the short commit, injected at build (`__APP_VERSION__`, `appVersionString` in `obs-b2b-shared/src/ui/app-version.ts`); "dev" when a build injected none. | ≤64 |
| `browser` | A plain summary of the fan's browser and device, "Safari 17 on iOS" (`currentBrowser` in `obs-b2b-shared/src/ui/browser.ts`). Never the raw user agent. | ≤120 |

No IP address and no raw user agent are stored. Every key is shown to the fan before they send (see "Report a problem").

## Sides, statuses and whose turn it is

**Sides.** Every thread entry is on one of two sides, `fan` or `workspace` (`FAN_REPORT_SIDES`). As with Tell Overboard, **the side is where it was written**: everything written from the console's fan report routes is the workspace's, whoever wrote it. An Overboard staffer replying from inside a team's workspace writes as the team, and the fan reads it as the team.

| Status | Reason | The fan sees | The console shows |
|---|---|---|---|
| `open`, awaiting `workspace` | — | **Sent** | **Needs reply** (warning) |
| `open`, awaiting `fan` | — | **Replied** | **Answered** (info) |
| `resolved` | `answered` | **Resolved** | **Resolved** |
| `resolved` | `fixed` | **Resolved** | **Resolved · Fixed** |
| `resolved` | `wont-fix` | **Resolved** | **Resolved · Won't fix** |
| `resolved` | `spam` | **Resolved**, with no reply box | **Resolved · Spam** |

The fan never sees the reason. The team picks it from four, each with a hint: Answered ("The fan has what they needed."), Fixed ("Something was wrong and it's put right."), Won't fix ("It's working as intended, or it won't change."), Spam ("Not a real report. The fan can't reopen it by replying.").

**What each action does:**

| Action | Who | Status | Awaiting | Thread | Stamps |
|---|---|---|---|---|---|
| Send a report | the fan | `open` | `workspace` | the fan's message | `lastFanMessageAt`, `lastFanViewAt`, `lastActivityAt` |
| Fan replies to an open report | the fan | unchanged | `workspace` | the message | the same |
| Fan replies to a resolved report | the fan | `open` (reason, `resolvedAt`, `resolvedByUserId` cleared) | `workspace` | the message, then a `reopened` event | the same |
| Fan replies to a report resolved as spam | — | refused, `FAN_REPORT.CLOSED` | — | — | — |
| Team replies | admin or staff | **unchanged** (a reply never reopens or resolves) | `fan` | the message | `lastWorkspaceMessageAt`, `lastWorkspaceViewAt`, `lastActivityAt`; `firstResponseAt` the first time |
| Team resolves, with a reason | admin or staff | `resolved` | unchanged | a `resolved` event carrying the reason | `resolvedAt`, `resolvedByUserId`, `lastWorkspaceMessageAt`, `lastWorkspaceViewAt`, `lastActivityAt` |
| Team reopens | admin or staff | `open` (reason cleared) | unchanged | a `reopened` event | `lastWorkspaceMessageAt`, `lastWorkspaceViewAt`, `lastActivityAt` |

Because a resolve and a reopen stamp `lastWorkspaceMessageAt`, the fan's unread dot lights for them as for a reply. A fan's reply is conditional on the status that was read and on `fanMessageCount` being under the limit, so two replies at once can't pass the fan's limit; a report the team resolved or reopened in between is read again and tried once more. The team's resolve and reopen are conditional on the status too.

## Limits and refusals

The limits are counts, held in the handlers, per fan **per team**: the same person's reports to one team never count against another.

| Limit | Value | Counted as | Refusal |
|---|---|---|---|
| Reports waiting at once | 3 (`FAN_REPORT_UNRESOLVED_MAX`) | the fan's reports to this team with status `open` | `FAN_REPORT.TOO_MANY_OPEN`, 429 |
| Reports in any 24 hours | 5 (`FAN_REPORT_DAILY_MAX`) | the fan's reports to this team created in the last 24 hours, resolved ones included | `FAN_REPORT.TOO_MANY_TODAY`, 429 |
| The fan's messages on one report | 50 (`FAN_REPORT_FAN_MESSAGES_MAX`), the first included | `fanMessageCount` | `FAN_REPORT.THREAD_FULL`, 409 |
| Messages on one thread, both sides | 200 (`FAN_REPORT_THREAD_MESSAGES_MAX`); event lines don't count | messages in `thread` | `FAN_REPORT.THREAD_FULL`, 409 (fan or team) |
| A message | 10–2,000 characters for a report's first message (`FAN_REPORT_MESSAGE_MIN`, `FAN_REPORT_MESSAGE_MAX`), 1–2,000 for a reply, trimmed | the contract | 400 |

The open limit is checked before the daily one. A contest that isn't one of the team's (or is a draft) is checked before either.

**The fan's refusals** answer `{ success: false, code, message }` (`fanReportRefusalSchema`), worded from the shared copy table (`obs-b2b-shared/src/errors/copy.ts`):

| Code | HTTP | Fan copy | Console copy |
|---|---|---|---|
| `FAN_REPORT.TOO_MANY_OPEN` | 429 | "You have 3 reports waiting for an answer. We'll get back to you on those first — you can add to them in Your reports." | — |
| `FAN_REPORT.TOO_MANY_TODAY` | 429 | "You've sent 5 reports today. Add to one of them in Your reports, or try again tomorrow." | — |
| `FAN_REPORT.THREAD_FULL` | 409 | "This conversation is full. Send a new report if you still need help." | "This conversation has reached its limit, so no more replies can be added." |
| `FAN_REPORT.CLOSED` | 409 | "This report is closed. Send a new report if you still need help." | — |
| `FAN_REPORT.NOT_FOUND` | 404 | "We couldn't find that report." | "We couldn't find that fan report." |
| `FAN_REPORT.UNKNOWN_CONTEST` | 404 | "We couldn't find that contest. Pick another, or leave it out." | — |

**The console's other refusals** (`node-server/src/util/messages.ts`): a member who tries to write, 403 "Only an admin can answer fans' reports." (`AUTH.READ_ONLY_FAN_REPORTS`); resolving a resolved report, 409 "That report is already resolved."; reopening an open one, 409 "That report is still open."; a report that changed between the read and the write, 409 "That report just changed. Refresh and try again."; a resolve whose audit record can't be written, 500 "Couldn't save a record of resolving this report, so it's still open. Try again." (`NOT_RECORDED.FAN_REPORT_RESOLVE`); a non-staff caller on the cross-team list, 403 (the OBS-only message).

## Endpoints

### The fan's (`requireMembership`, `?tenant=` as everywhere)

Contracts: `obs-b2b-shared/src/api/b2b/fan-report.ts`. Routes: `node-server/src/routes/fan-reports/index.ts`; handlers: `src/handlers/fan-reports/fan.ts`. The summary is registered before the per-report read so it isn't taken for an id.

| Method | Path | What |
|---|---|---|
| POST | `/b2b/reports` | `{ category, message, contestId?, context }`. Checks the contest, then the limits; creates the report; 201 with the report and its thread. |
| GET | `/b2b/reports` | The fan's reports to this team, latest activity first, at most 50 (`FAN_REPORTS_LIST_MAX`); never paged. |
| GET | `/b2b/reports/summary` | `{ unread, unresolved, total, blockedCode }`: the menu's dot, and whether a new report would be refused right now and why. |
| GET | `/b2b/reports/:reportId` | One report and its thread. Stamps `lastFanViewAt` (clears the fan's dot). |
| POST | `/b2b/reports/:reportId/messages` | `{ body }`. A reply; reopens a resolved report unless it was resolved as spam. |

**The fan's wire carries no names, user ids or reasons.** A summary row is `{ reportId, category, state: "sent" | "replied" | "resolved", contest: { contestId, name } | null, excerpt, createdAt, lastActivityAt, unread }`. The excerpt is the start of the fan's first message, up to 160 characters, cut at a word where it can be. The detail adds `context`, `canReply` and `replyBlockedCode` (`FAN_REPORT.THREAD_FULL` or `FAN_REPORT.CLOSED`, null when the fan can reply). Thread entries carry `author: { side, isYou }` and either `body` or `event`, never a reason. Another fan's report, another team's, or a malformed id is the same 404.

### The console's (`requireAdmin`)

Contracts: `obs-b2b-shared/src/api/admin/fan-reports.ts`. Routes: `node-server/src/routes/admin/fan-reports.ts`; handlers: `src/handlers/admin/fan-reports.ts`. These routes release a fan's own words, so `route-auth.test.ts` lists them apart from the ops routes. The write gate and the staff-only cross-team list refuse inside the handlers.

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/admin/support/fan-reports` | everyone in the workspace; staff with `?tenant=` | One workspace's fan reports, paged (`cursor`, `limit`), latest activity first. Filters: `status` (`open` default, `resolved`, `all`), `category`, `contestId`, `membershipId`, `q` (literal, case-insensitive, over the thread's messages and the fan's name snapshot). Answers `counts` with every page. |
| GET | `/admin/support/fan-reports/summary` | the same | `counts`: `{ unresolved, unanswered, oldestUnansweredAt }` — the Support badge. |
| GET | `/admin/support/fan-reports/:reportId` | the same | One report, its whole thread, `fanMessageCount` and `canReply` (the thread isn't full). **Stamps `lastWorkspaceViewAt`** for the workspace's own people; a staffer's read never does (as with Tell Overboard). |
| POST | `/admin/support/fan-reports/:reportId/messages` | `org:admin`, staff; paused or not | `{ body }`. A reply to the fan; status unchanged. Audited after (`fan_report_reply`). |
| PATCH | `/admin/support/fan-reports/:reportId` | `org:admin`, staff; paused or not | `{ action: "resolve", reason }` (audited **before**, refused if the record can't be written) or `{ action: "reopen" }` (audited after). |
| GET | `/admin/support/fan-inbox` | Overboard staff only | Every team's fan reports, paged, latest activity first; one team with `?tenant=`. Filters `status`, `category`, `q`. Answers `counts` across every team or the one named. **Writes nothing, not even a view time.** |

A console row (`adminFanReportSchema`) is `{ reportId, tenant: { slug, name }, category, status, resolutionReason, awaiting, fan: { membershipId, displayName }, contest, excerpt, context, createdAt, lastActivityAt, resolvedAt, firstResponseAt, unread, messageCount }`. `fan.displayName` is the membership's current display name, else the snapshot, else null (the console says "A fan"); the fan's other details are on the Fan page behind its own rules (D-099). `unread` is "the fan wrote after the workspace last opened it". In the thread, the fan's lines carry the fan's display name; the workspace's carry the writer's name, and `isYou` for the reader's own.

Staff name the workspace with `?tenant=` as on every workspace screen: a staffer naming none gets the usual 400, and a workspace user naming another workspace the usual 403. An id from another workspace, or not an id, is `FAN_REPORT.NOT_FOUND`.

---

## The fan app

The screens follow the app's existing menu pages, How to play and Terms: the logo-and-menu top row (`ReportTopRow`), an uppercase heading, rounded cards on the team's colours, the app's own buttons. Routes in `src/pages/help/helpPaths.ts`; all three are signed-in only (`ProtectedRoute`), like How to play.

### The menu's Help group

`components/layout/SideMenu.tsx`. A **Help** group sits between **Play** and **Legal**:

| Item | Goes to | Notes |
|---|---|---|
| Report a problem | `/report` | Carries router state `{ from, contestId }`: the page the menu was opened on, and the contest that page is about — the board passes its contest (`SideMenu contestId`); `/contest/:contestId` and `/trivia/:contestId/…` are read from the route. Opened from the form itself, it keeps the form's own state. Nothing lands in the URL. |
| Your reports | `/reports` | Shows a small brand-colour dot, with "new reply" for screen readers, while the team has written something the fan hasn't opened. |

**The unread dot.** The menu button also carries the dot (its label becomes "Open menu, new reply"). Both read `GET /b2b/reports/summary` `unread`: asked when the menu mounts and its answer is older than 60 seconds, and again when the app comes back into view. There is no background polling; a failed or unanswered summary is simply no dot, never an error. Opening the report (`GET /b2b/reports/:reportId`), sending, or replying refreshes the summary and the list (RTK Query tags per tenant and per report), so the dot clears once the fan opens what's new.

### Report a problem (`/report`)

`pages/help/ReportProblemPage.tsx`. Heading "Report a problem"; lead "Tell {team} what went wrong. They'll answer here."

1. **"What's it about?"** — the five categories as pill radios. Required.
2. **Contest.** Pre-filled from the menu's state, it shows as a chip "About: {contest name}" with a remove button ("Remove {name}"). Removed, or not pre-filled, it is an optional picker, "Contest (optional)", listing the team's contests (both the Upcoming and Past lists) with "Not about a contest" first; with no contests there is no picker. Only a real contest id is ever sent.
3. **"What happened?"** — the message, placeholder "What you were doing, and what went wrong", with a "0 / 2,000" counter. Under 10 characters it says "A few more words, please — at least 10 characters."
4. **"Sent with your report"** — every context key, before anything is sent: **Page** (in the app's own words — "Your board", "A contest", "Contests", "Trivia", "How to play", "Your reports", … — else the path; no row when there is no page), **App version**, **Device**.
5. **Send** ("Sending…"), enabled with a category and at least 10 characters. With the message long enough and no category: "Pick what it's about to send."

**When a new report would be refused**, read fresh on arrival from the summary's `blockedCode` or from the refusal itself, the form is replaced by a card with that refusal's fan copy and a **Your reports** button. Any other failure shows its copy above Send and keeps what the fan typed.

**Sent.** The form is replaced by "Sent to {team}." and "We'll answer here — you'll see a dot on the menu when they reply.", with **See your report** (its page) and **Back to contests**. Focus moves to the heading.

### Your reports (`/reports`)

`pages/help/YourReportsPage.tsx`. Heading "Your reports"; "Your conversations with {team}." and a **Report a problem** button. Each report is a card that opens its page: the category, the state chip (**Sent**, **Replied** in the brand fill, **Resolved** muted), the excerpt, the contest's name and how long ago it last moved; the unread dot when the team has written since the fan last looked; a card whose state is Replied has a brand-colour border. Latest activity first, at most 50. Empty: "No reports yet" — "If something goes wrong, tell {team} and they'll answer here." with **Report a problem**. Opened from here, the form's Page row reads "Your reports". A failed read: "We couldn't load your reports." with **Try again**.

### A report (`/reports/:reportId`)

`pages/help/FanReportPage.tsx`. A **Your reports** back link (to `/reports`) and the menu. The category as the heading, the state chip, the contest's name, "Sent {date}". Then the conversation: the fan's own lines as "You" on the right, the team's as the team's name on the left — **never a person's name** — each with how long ago. Event lines: "{team} marked this resolved", "{team} reopened this", "You reopened this". Opening the page marks it read.

The reply box, "Reply to {team}", with a counter and **Send**; on a resolved report "Replying reopens this report." When the fan can't reply (`canReply` false) the box is replaced by the copy for `replyBlockedCode` — a report resolved as spam ("This report is closed. …") or a full conversation ("This conversation is full. …") — with a **Report a problem** link that starts the form about the same contest. An unknown id, or another fan's: "We couldn't find that report." with "Back to Your reports". Any other failure: "We couldn't load this report." with **Try again**.

### In the console's phone preview

The preview frame (`/preview`) doesn't offer the report screens ([`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md), "Screens not offered"). The menu's Help rows render as in the app, but tapping them is inert (`ROUTES_NOT_OFFERED` takes `/report` and `/reports`, and `ROUTE_PREFIXES_NOT_OFFERED` takes `/reports/`). The preview data layer answers the menu's summary call with an empty summary (`unread: 0`, no `blockedCode`), so the preview never shows a dot. No preview screen id is added.

---

## The console

### Support: two tabs

`pages/Support.tsx`. The workspace's **Support** page has two tabs:

| Tab | Route | What |
|---|---|---|
| **From fans** (the default) | `/support` | The workspace's fans' reports. The tab carries the unanswered count as a badge. |
| **To Overboard** | `/support/overboard` | The workspace's Tell Overboard reports ([`admin-support.spec.md`](admin-support.spec.md)), unchanged apart from moving here; **Get help** sits in this tab's header. |

`/support/:reportId` (a Tell Overboard report) is unchanged; a fan report's page is `/support/fans/:reportId`. Leads: "Problems your fans reported from the app. Answer here and they read your reply in the app." (From fans) and "Everything your team has asked Overboard, and the answers. Reply on any report to keep talking." (To Overboard). Staff with no workspace chosen get "Pick a tenant", pointing at the Support inbox. Staff with one chosen see exactly what the workspace sees on both tabs.

### From fans: the list

Search ("Search messages and fans"), Status (**Open** by default, Resolved, All) and Category ("Any category" or one), endless scroll (admin-lists.spec.md). Beside the count, "{n} waiting on a reply" when any are. Each row, drawn with the shared `SupportRow`: the category as the title; a dot when the fan has written since the workspace last opened it ("New message from {fan}"); the fan's display name, the contest, when it last moved and "{n} messages" when more than one; the excerpt; the status badge (Needs reply / Answered / Resolved · reason). Empty: "Nothing open. When a fan reports a problem from the app's menu, it lands here." (Open) or "No fan reports yet. Fans report problems from the app's menu." A failed load is the reportable error card ("Couldn't load your fans' reports.").

### A fan's report (`/support/fans/:reportId`)

`pages/FanReport.tsx`. A "Support" back link to `/support`. Eyebrow "From a fan", the category as the heading, "{fan} · {date}", and the status badge.

- **The conversation** (the shared `ConversationCard`): the fan's lines by their display name, tinted; the workspace's on the right, "You" for the reader's own and "{name} · {team}" for a colleague's (the team's name alone when no name is known). Event lines: "{who} resolved this · {Reason}", "{who} reopened this".
- **The reply box** (the shared `ReplyCard`), for those who can answer: "Reply to {fan}", placeholder "Plain words. {fan} reads this in the app, from {team}." On a resolved report: "This report is resolved. Replying doesn't reopen it — reopen it if there's more to do." With the thread full, the box is replaced by "This conversation has reached its limit, so no more replies can be added."
- **What was sent**: From (the fan, linking to their Fan page), About (the category), Contest (linking to the contest page, or "None named"), then Page (**the raw path**), Device and App version.
- **The desk panel** ("This report", beside the conversation): Waiting on ("Your reply", the fan's name, or "Nobody — it's resolved"), First answered (how long ago, or "Not yet"), Fan's messages ("{n} of 50"). While open: **Resolve**, a choice of the four reasons with the chosen one's hint (Spam's hint in a warning colour), and a Resolve button. While resolved: **Reopen**. For those who can't answer: "Your workspace's admins answer and resolve fans' reports."
- **Ask Overboard about this** (under "Need Overboard's help?" in the desk panel): opens the Tell Overboard drawer with an ordinary report — surface `fan-report`, kind `question`, subject `{ type: "fan-report", id }`, context `{ route, fanReportId }` — whose preview reads "Fan report: {category} · {date}" and "The fan's words: Not copied. Overboard opens the report itself." Once sent, the report's status chip stands in place of the button (read back by subject, as on a failed delivery or a fan). The server checks that `fanReportId` is one of the workspace's own fan reports and answers 404 otherwise, exactly as it does for a membership or redemption id. On the inbox's side that report reads "About a fan's report", its context shows "Fan report: {id}", and its jump link opens `/support/fans/:id` in the workspace.

Opening the page stamps the workspace's view time (not for staff) and refreshes the badge. Any write refreshes the badge too. A 404: "That report couldn't be found." / "It may belong to another workspace, or the link may be wrong."

### The Support badge

The Workspace section's **Support** item carries a badge with the workspace's **unanswered** fan reports (open and awaiting the workspace), hidden at zero, labelled "{n} fan report(s) waiting on a reply" (`lib/nav.ts` `badge: "fan-reports"`, `components/Sidebar.tsx`). It counts the workspace in view: a workspace user's own, or the one a staffer has chosen (none chosen, no badge). It reads `GET /admin/support/fan-reports/summary` from the support provider (`lib/support.tsx`, `fanCounts`) every 60 seconds while the tab is visible, when the tab is shown again, and after a fan report is opened or changed; one that can't load doesn't render. Only the workspace in view's counts are ever shown. The staff **Support inbox** badge is unchanged: it counts unresolved Tell Overboard reports only.

### Overview: Needs attention

`GET /admin/overview` adds the attention kind **`fan-reports`** (warning) with the same unanswered count as the badge (the same `loadFanReportCounts`), listed after failed sends and before the contest items, only when nonzero. The Overview reads "{n} fan report(s) waiting on a reply" and links to `/support`.

### Support inbox: From fans (`/inbox/fans`)

`pages/SupportInbox.tsx`, `pages/FanInbox.tsx`. The OBS Internal **Support inbox** has two tabs: **From workspaces** (`/inbox`, Tell Overboard as before) and **From fans** (`/inbox/fans`). From fans lists every workspace's fan reports, newest activity first, with a workspace filter ("All workspaces" or one, kept in `?workspace=`), Status (Open by default, Resolved, All), Category and search, and "{n} waiting on a reply · longest {duration}". A row's meta leads with the workspace's name. **It is read-only**: each row, and its **Open in workspace** link, opens `/support/fans/:reportId?tenant=<slug>`, where staff see and write exactly as the workspace does (D-089, D-098: staff act as the tenant). A workspace user reaching `/inbox/fans` sees "Overboard staff only". Empty: "No fan is waiting on any workspace." (Open) or "No fan reports yet."

The workspace's own triage of its fan reports is allowed. This does not contradict D-098, which keeps the triage of **Tell Overboard** reports in the OBS inbox.

### Operations: recent activity

The three new audit actions read "replied to a fan's report", "resolved a fan's report" and "reopened a fan's report".

## Permissions

| Who | Reads | Replies, resolves, reopens |
|---|---|---|
| A workspace's `org:member` | Its own fans' reports: the list, a report, the badge | No: 403 "Only an admin can answer fans' reports."; the console shows no reply box or desk actions |
| A workspace's `org:admin` | The same | Yes — **also while the workspace is paused**, so open conversations can be finished (unlike configuration writes, which a pause turns off) |
| Overboard staff, in a workspace (`?tenant=`) | Exactly what the workspace reads | Yes, as the workspace, paused or not. In the staff **Member** view the console hides the controls (`useCanAnswerFans`), as for every write; the server still answers staff as staff |
| Overboard staff, OBS screens | Every workspace's fan reports, read-only, on `/inbox/fans` | No — only by opening the workspace |
| The fan | Their own reports to this team only | Reply only (which may reopen); never resolve |

The console's check is `useCanAnswerFans` (`lib/useCanWrite.ts`): staff (not in the Member view) and the workspace's `org:admin`, without `useCanWrite`'s paused exception. The server's is `refuseFanReportWrite`.

## Fan data: privacy and lifecycle

- **Fan data, in its own place.** The fan's words leave the server only to the fan who wrote them, to their own team, and to Overboard's read-only list. They are never copied into Tell Overboard: "Ask Overboard about this" carries the fan report's id and nothing else, and Tell Overboard's no-fan-PII rule still holds.
- **What the fan never sees:** the names of the team's people (or of Overboard staff working in the workspace), any user id, and the resolution reason.
- **Logs never carry message text** (`SEC-03`). The handlers log a failure's own message only, never the request; audit details carry ids, the reason and the category, never words.
- **Audit** (kind `support`, scoped to the workspace): `fan_report_resolve` `{ reportId, reason, category }` is written **before** the resolve, which is refused if the record can't be written (the Tell Overboard resolve's posture); `fan_report_reply` `{ reportId, messageId }` and `fan_report_reopen` `{ reportId }` are written after, fire-and-log. A fan's own reply or reopen is not an admin action and is not audited; it is in the thread.
- **Deleting a fan** (`DELETE` on the Fan page, `SEC-07`) deletes their reports to that team. The count is taken before anything is removed and recorded as `fanReportsToDelete` in the `fan_delete` audit detail; the reports go after the redemptions are anonymized and before the membership.
- **Deleting a workspace** deletes all of its fan reports, recorded as the `fanReports` count in the `tenant_delete` audit's counts.
- **A paused workspace's** fans can't open the app, so they read any replies once it is resumed.

## Indexes

Declared in `obs-b2b-shared/src/models/fan-report.ts`. Connectors run with `autoIndex: false`, so they are created per environment by `node-server/scripts/create-list-indexes.mjs`:

| Name | Keys | For |
|---|---|---|
| `team_by_status` | `{ organizationId: 1, status: 1, awaiting: 1, lastActivityAt: -1 }` | A team's list by status, and the unanswered count |
| `team_all` | `{ organizationId: 1, lastActivityAt: -1 }` | A team's whole list (All) |
| `one_fan` | `{ organizationId: 1, membershipId: 1, createdAt: -1 }` | Your reports, the per-fan limits, the fan-delete cascade |
| `every_team_by_status` | `{ status: 1, lastActivityAt: -1 }` | Overboard's cross-team list |

## Rules

1. **`FS-01` — Fan reports are not Tell Overboard reports.** They live in `B2BFanReport`. Tell Overboard links to one by `fanReportId` and subject `fan-report` only, checked to be the workspace's own; the fan's words are never copied.
2. **`FS-02` — The fan is the session's.** Nothing about who is reporting is read from the body. A fan reads and writes only their own reports to this team; anything else is the same 404.
3. **`FS-03` — The app attaches nothing it doesn't show.** The context is a closed key set — page path, app version, browser and device summary — shown in full before Send. No IP, no raw user agent, no query string.
4. **`FS-04` — A team reads only its own fans' reports.** Everyone in the workspace reads them; another workspace's id is a 404.
5. **`FS-05` — The team is the support desk.** Replying, resolving and reopening are for the workspace's `org:admin` and Overboard staff, also while the workspace is paused. `org:member` reads only.
6. **`FS-06` — The side is where it was written.** Everything written from the console is the workspace's; the fan reads it as their team and never sees a person's name, a user id or the resolution reason.
7. **`FS-07` — A team reply never changes the status.** Resolve and reopen are their own actions. A fan's reply reopens a resolved report, except one resolved as spam.
8. **`FS-08` — The limits are counts in the handler,** per fan per team: 3 open, 5 in 24 hours, 50 fan messages per report, 200 messages per thread.
9. **`FS-09` — Overboard's cross-team list is read-only** and writes nothing, not even a view time.
10. **`FS-10` — The badge and the Overview count unanswered reports:** open and awaiting the workspace, from one function (`loadFanReportCounts`). The staff inbox badge counts only Tell Overboard reports.
11. **`FS-11` — Audit carries ids, the reason and the category, never words.** A resolve is recorded before it happens; a reply and a reopen after.
12. **`FS-12` — Logs never carry a fan's or a team's message text.**
13. **`FS-13` — Deleting a fan deletes their reports to that team; deleting a workspace deletes all of its.**
14. **`FS-14` — No email and no per-report notification** in this version.

## Known gaps (recorded, not blocking)

- **No email and no digest.** The fan learns of a reply from the menu's dot the next time they open the app; the team learns of a report from the badge and the Overview.
- **The Page row differs between the apps.** The fan app shows the page in its own words ("Your board"); the console shows the raw path (`/board/…`).
- **No per-fan "can't report" flag.** A fan who abuses the form is held only by the limits and by resolving as spam.
- **Limits are counted in the handler,** not by rate-limiting infrastructure. They are per fan per team. The fan's per-thread count is held by a conditional write; the open, daily and 200-message counts are read, then written, so two requests at the same moment could each pass.
- **The fan's list is capped at 50** and doesn't page.
- **The console's list takes `membershipId`,** but no console screen uses it yet: the Fan page doesn't list that fan's reports.

---

## Function audit

There was no mock for this feature. The fan screens follow the app's existing menu pages (How to play, Terms); the console screens follow the existing Support pages and reuse their row, conversation and reply components (`components/supportThread.tsx`). Nothing on any screen is decorative or invented: every element below reads or writes something the server stores.

### 1. Screens: data sources and server calls

| Screen | Reads | Writes | States |
|---|---|---|---|
| **Fan: side menu, Help group** | `GET /b2b/reports/summary` (`unread`) on mount when older than 60 s and on focus; the current route and contest for the link state | — | Dot on the menu button and on Your reports while `unread > 0`; no dot on failure |
| **Fan: Report a problem** (`/report`) | `GET /b2b/reports/summary` fresh on arrival (`blockedCode`); `GET /b2b/contest/list-contests?status=upcoming` and `?status=past` (the picker and the chip's name); router state (page, contest); the build's `APP_VERSION`; `currentBrowser()` | `POST /b2b/reports` | Form; blocked card; send error; Sent |
| **Fan: Your reports** (`/reports`) | `GET /b2b/reports` | — | List; empty; loading; error with retry |
| **Fan: a report** (`/reports/:reportId`) | `GET /b2b/reports/:reportId` (stamps the fan's view) | `POST /b2b/reports/:reportId/messages` | Thread with reply box; closed or full notice; not found; error with retry |
| **Console: Support → From fans** (`/support`) | `GET /admin/support/fan-reports` (paged, `counts`); the support provider's `fanCounts` for the tab badge | — | List; empty (Open / any); no matches; reportable error |
| **Console: Support → To Overboard** (`/support/overboard`) | `GET /admin/support/reports` (`side=workspace` for staff) | Get help → `POST /admin/support/reports` | As before ([`admin-support.spec.md`](admin-support.spec.md)) |
| **Console: a fan's report** (`/support/fans/:reportId`) | `GET /admin/support/fan-reports/:reportId` (stamps the workspace's view); `GET /admin/support/reports?subjectType=fan-report` for the Ask Overboard chip | `POST …/messages`; `PATCH …` (resolve, reopen); Ask Overboard → `POST /admin/support/reports` | Report; loading; not found; error with retry; read-only for members |
| **Console: Support inbox → From fans** (`/inbox/fans`) | `GET /admin/support/fan-inbox` (paged, `counts`); `GET /admin/workspace?tenant=` for the chosen workspace's name | — (read-only) | List; empty; no matches; reportable error; "Overboard staff only" for a workspace user |
| **Console: Overview, Needs attention** | `GET /admin/overview` (`needsAttention` kind `fan-reports`) | — | Item shown only when nonzero; links to `/support` |
| **Console: Support nav badge** | `GET /admin/support/fan-reports/summary` every 60 s while visible, on becoming visible, after a report is opened or changed | — | Hidden at zero, without a workspace in view, or on failure |
| **Console: Operations, recent activity** | The audit feed (`fan_report_reply`, `fan_report_resolve`, `fan_report_reopen`) | — | Three verbs |

### 2. Design sources: what was followed, cut or changed

| Element | Source | Kept, cut or changed, and why |
|---|---|---|
| Fan pages' top row, heading and cards | How to play, Terms | Kept: the logo-and-menu row, the uppercase heading and rounded cards, so the Help pages read as the menu's own pages |
| A Help group in the menu | The menu's Play and Legal groups | New group, same row style and `aria-current` |
| Category chips | — | Five fan-worded categories in place of a free subject line: one tap, and they drive the console's filter |
| "Sent with your report" | Tell Overboard's drawer ("shows exactly what will be sent") | Kept the rule; the Page row is named in the fan's words |
| Attachments, a subject line, an email field | — | Not offered: attachments are out of scope; the category replaces a subject; the fan is signed in, so no contact field is asked |
| Console Support page | The existing Support page | Changed: two tabs, From fans first, since a team's fans write far more often than the team writes to Overboard |
| Fan report page | The Tell Overboard report page | Kept its layout (head, conversation, reply, what was sent, side panel); the triage panel becomes a desk panel with only resolve-with-reason and reopen, because there is no acknowledge, assign, merge, internal note or delete for fan reports |
| Rows, conversation, reply box | `SupportRow`, `ConversationCard`, `ReplyCard`, extracted from the Tell Overboard pages | Shared, so both kinds of conversation look and behave as one |
| Inbox tabs | The Support inbox | Added From fans, read-only, with "Open in workspace" in place of any triage |

## References

- PRD: proposed `SUP-01` ([`PRD-changes-contributed-by-Arthur.md`](../../../documents/PRD/PRD-changes-contributed-by-Arthur.md), entry 38); [`SEC-03`, `SEC-07`, `SEC-09`, `ADM-01`, `ADM-02`, `ADM-03`, `ADM-09`](../../../documents/PRD/OBS_B2B_Platform_PRD.md).
- Shared: `src/interfaces/b2b/B2BFanReport.ts`, `src/models/fan-report.ts`, `src/api/b2b/fan-report.ts`, `src/api/admin/fan-reports.ts`, `src/errors/copy.ts` (`FAN_REPORT.*`), `src/interfaces/b2b/B2BSupportReport.ts` (surface and subject `fan-report`, context `fanReportId`), `src/interfaces/b2b/B2BAdminAudit.ts`, `src/api/admin/overview.ts`, `src/ui/browser.ts`, `src/ui/app-version.ts`.
- Backend (`node-server`): `src/handlers/fan-reports/fan.ts`, `src/handlers/admin/fan-reports.ts`, `src/util/fan-reports.ts`, `src/routes/fan-reports/index.ts`, `src/routes/admin/fan-reports.ts`; changes in `src/handlers/admin/{support,fans,tenant-lifecycle,overview}.ts`, `src/util/admin-overview.ts`, `src/util/messages.ts`, `scripts/create-list-indexes.mjs`; tests `src/__tests__/fan-reports.test.ts`.
- Console: `src/pages/{Support,FanReport,FanInbox,SupportInbox,Overview,Operations}.tsx`, `src/components/supportThread.tsx`, `src/lib/{fanReportWords.ts,support.tsx,nav.ts,useCanWrite.ts}`, `src/components/Sidebar.tsx`, `src/App.tsx`.
- Fan app: `src/components/layout/SideMenu.tsx`, `src/pages/help/{ReportProblemPage,YourReportsPage,FanReportPage}.tsx`, `src/pages/help/helpPaths.ts`, `src/components/reports/ReportParts.tsx`, `src/store/api/fanReportApi.ts`, `src/lib/fanReports.ts`, `src/lib/appVersion.ts`, `vite.config.ts`, `src/preview/{links,baseQuery}.ts`.
