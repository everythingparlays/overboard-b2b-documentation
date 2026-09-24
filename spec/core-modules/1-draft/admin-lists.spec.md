# Core Module Spec: Admin — Lists (endless scroll and cursor paging)

**Implements:** Arthur's 2026-09-24 ruling on lists: one system-wide pattern, endless scroll, backed by real server-side cursor paging. PRD `ADM-01` (one console that stays usable as tenants grow), `TEN-03` (onboarding a tenant costs no engineering, so no list may need a code change when it grows).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — scope, the `?tenant=` exception, Honesty by omission (Rule 13) and plain product language, which bind every count, empty state and error line below.

**Status:** Draft — built on `arthur-g1-console` (2026-09-24).

## Overview

Until now exactly one console list paged its data (Fans, by page number, over a roster the server loaded whole and sliced in memory). Everything else either returned everything or stopped at a silent server cap: Team dropped its 21st member, Your reports its 201st, Recent exports its 21st. As tenants grow, every one of those becomes either slow or wrong.

**The whole change, in one line:** one paging convention on the wire, one server helper that implements it with keyset queries, and one list component that loads the next page as the reader nears the bottom — applied to every list that can grow and survives the coming redesign.

**Out of scope:** lists the redesign obviously replaces (listed under "Skipped" with the reason); virtualisation (pages of 50 rendered as plain rows stay fast into the thousands, and the scroll-to-load pattern already caps what one session renders in practice); client-side sorting by column header (each list has one stable order, chosen per list below).

---

## The wire: one convention everywhere

Contract: `obs-b2b-shared/src/api/admin/paging.ts`.

### Request

| Parameter | Where | Meaning |
|---|---|---|
| `cursor` | query (GET) or body (POST) | Opaque. Absent = first page. Only ever a value the server returned as `page.nextCursor`. |
| `limit` | same | Rows per page, 1–100, default 50. Pickers ask for 30. |
| `q` | query | Free-text search, trimmed, ≤200 chars. Case-insensitive; matches anywhere in the searched fields. The Fans roster is the one exception: its search text is PII, so it travels in the POST body as `query`, never in a URL. |
| endpoint filters | query | Each endpoint's own, documented below. Always applied by the server. |

A screen never loads everything to search or filter it itself. Search and filters are server parameters, and changing either one restarts the list from the top.

### Response

The endpoint keeps its own array key (`fans`, `tenants`, `reports`, …) so existing readers keep working, and adds:

```ts
page: {
  nextCursor: string | null; // null on the last page
  total: number;             // rows matching the current search and filters, across all pages
  limit: number;             // the page size applied
}
```

`total` is what the screen's count shows ("1,284 fans"). It is recomputed on every page, so a list that grows while being read shows the true figure.

An endpoint that used to carry `truncated` keeps the field for old readers and always sends `false` once it pages; the console stops reading it.

### Order and the cursor

- **One stable order per list**, documented in the inventory below, always completed by the record id as the final tie-breaker. Two rows never compare equal, so a row can never repeat or go missing between pages.
- **Keyset, not offset.** The cursor encodes the last row's sort values plus its id, and the next page asks for rows strictly after that position (`$or` of "greater on the first key", "equal on the first key and greater on the next", …). Offset-and-skip is used only where the upstream itself only pages that way (Clerk's membership lists); the cursor then carries the offset, behind the same opaque string.
- **The cursor remembers what it was issued for.** It carries a short hash of the normalised search, filters and order. A cursor replayed against anything else is refused with HTTP 400 `code: "cursor_stale"`; a cursor the server cannot decode is 400 `code: "cursor_invalid"`. The console answers either by restarting the list from the top — the reader sees a list, never an error.
- **Encoding.** `base64url(JSON.stringify({ v: 1, k: [...sortValues, id], h: filterHash }))`. Dates travel as ISO strings and are revived by the helper. Opaque to clients by contract: the console never parses or builds one.

### Derived orders

A few lists are ordered by something the database does not store — "live games first, then the soonest tip-off". Those endpoints compute the order over a **bounded candidate set** (a date window, or the tenants that exist) and page through the ordered result with an offset carried in the cursor. The bound is stated per list below. Nothing unbounded is ever ordered in memory.

### Totals and aggregates

Per-row aggregates (a contest's players, a tenant's fans, a fan's boards) are computed **for the page's rows only**, never for the whole platform per request. That is the change that makes All tenants, All contests and Platform health cheap: today each request aggregates every membership, board and redemption on the platform.

### The server helper

`node-server/src/util/paging.ts` owns the convention so no handler hand-rolls it:

- `parsePageParams(input)` → `{ limit, cursor }`, with the default and maximum applied.
- `encodeCursor(sortValues, id, filterHash)` / `decodeCursor(cursor, filterHash)` — the latter throws a typed error the route turns into the 400 above.
- `keysetFilter(sort, cursor)` → the Mongo `$or` for "after this position" for any sort of 1–3 keys plus `_id`, in either direction per key.
- `filterHash(parts)` — a stable short hash of the normalised search, filters and order.
- `pageOf(rows, limit, sortValuesOf)` — fetches `limit + 1` to learn whether a next page exists without a second query, and returns `{ rows, nextCursor }`.
- `escapeSearch(q)` — the regex-escaped, case-insensitive search pattern.

Indexes: every list's order is backed by an index whose prefix is the list's scope (`organizationId`) and whose suffix is the sort keys plus `_id`. Connectors run with `autoIndex: false`, so new indexes are declared on the models and created per environment by the index script, like every existing one.

---

## The client: one list component

`admin-integration/src/components/ui/list/` — additions to the kit, not a restyle of anything existing.

### `useCursorList`

A hook that owns paging state for one list:

- `fetchPage(cursor, signal)` supplied by the screen; `deps` (search, filters, tenant) restart the list when they change. In-flight requests for an old query are aborted, and a late answer for an old query is dropped.
- Rows are de-duplicated by a key function, so a row that shifts between pages while the list is being read shows once.
- States: `loading` (first page), `ready`, `loadingMore`, `error` (first page failed), `errorMore` (a later page failed — the rows already loaded stay), `done`.
- A `cursor_stale` or `cursor_invalid` refusal restarts from the top silently.
- `refresh()` re-reads the first page and merges new rows on top without dropping the reader's scroll position — used by polled lists (Game day's feed) and after a write.

### `InfiniteList` / `InfiniteTable`

The presentational shell. Every list and table that grows uses it.

- **Sticky toolbar** at the top of the list's scroll area: search (debounced 250 ms), the screen's filters, and the count ("1,284 fans", "No matches"). It stays in view while the rows scroll under it.
- **Auto-load.** An `IntersectionObserver` sentinel 600px below the last row asks for the next page. No button. If the first page does not fill the viewport, the next page loads immediately, until it does or the list ends.
- **First load**: skeleton rows in the list's own shape. **Loading more**: one quiet row with a spinner under the last row. **A later page failed**: the rows stay, and the last row says "Couldn't load more." with **Try again** (error recovery, not a load-more button). **First load failed**: the kit's `ReportableLoadError`.
- **Empty states** tell apart "nothing yet" (the screen's own sentence) from "no matches" (with **Clear search and filters**).
- **Accessibility.** Tables keep real table semantics, with `aria-rowcount` set to the total and `aria-rowindex` on each row, so a screen reader announces "row 51 of 1,284". Non-table lists use `role="feed"` with `aria-setsize`/`aria-posinset` per item. The list sets `aria-busy` while a page loads, and a polite live region announces "Loaded 50 more — 100 of 1,284" and the end of the list. Keyboard users reach new rows by tabbing forward: moving focus into the last rows scrolls the sentinel into view, which loads the next page before focus runs out. Search and filters are the first stops in tab order and stay reachable because the toolbar is sticky.
- **Reduced motion.** No row animation; the spinner falls back to a static glyph.

### `PickerList` and `Combobox`

The same engine for dropdown-like lists, which the ruling names explicitly (Game day's game list, the contest game picker).

- `Combobox` — a single-select popover: a button showing the current choice, opening a search box over an endless-scrolling listbox with its count. ARIA 1.2 combobox with `aria-activedescendant`; ↑/↓, Home/End, Page Up/Down, Enter to choose, Escape to close; typing searches. The listbox's own scroll area carries the sentinel, so the next page loads as the highlighted option nears the bottom. Used wherever a native `<select>` listed something that grows.
- `PickerList` — an inline multi-select list (checkbox rows, optional group headings such as a date), the same toolbar, count and auto-load. Used by the Add-games / schedule picker.

---

## Inventory — every growing list

### Applied

| Screen | List | Endpoint | Order | Search | Filters |
|---|---|---|---|---|---|
| Fans | Roster | `POST /admin/fans/search` (body `cursor`, `limit`; the page info rides as `pageInfo`, because this response already used `page` for the page number, which older clients still get) | joined, newest first, in Mongo (index `roster_newest_first`) | name or email (body `query`) — an email match resolves the matching fan identities first, then keeps this workspace's | opt-in state, missing field |
| Game day | **Game dropdown** → `Combobox` | `GET /admin/live/games` (new) | tip-off, soonest first, around now | team names | window: upcoming / recent |
| Game day | Live feed | `GET /admin/live/feed?game=` (new, split from `/admin/live`) | newest first; polled head refresh | — | — |
| Game day | Couldn't be delivered | `GET /admin/live/failures?game=` (new) | most recent failure first | — | — |
| Games & Contests | **Add games / New contest schedule picker** → `PickerList` | `GET /admin/games/candidates` | tip-off, soonest first | team names | sport, day range (the 30-day window and the 200 cap go) |
| Exports | Recent exports | `GET /admin/exports/recent` | newest first | — | kind |
| Exports | Generate drawer: contest select → `Combobox` | `GET /admin/contests/options` (new, light) | newest first | contest name | — |
| Sponsors & Branding | Sponsors table | `GET /admin/sponsors/list` (`GET /admin/sponsors` stays whole: the placement schedule needs every sponsor) | name A–Z as people read it (case ignored, numbers in order), computed over the workspace's own sponsors | name | — |
| Team | Members; pending invitations | Clerk client, infinite pages (own organization); staff-only `GET /admin/team` for a chosen tenant (admin-team.spec.md) | Clerk's order (newest first) | name or email | role |
| Support | The workspace's reports (admin-support.spec.md) | `GET /admin/support/reports` | newest first | message | status |
| Shell | Tenant switcher, staff directory | `GET /admin/tenants?view=directory` | name A–Z | name or subdomain | — |
| Schedule / Season calendar | List view (admin-schedule.spec.md) | `GET /admin/schedule` | tip-off, soonest first, from the chosen day forward | team names | workspace, sport, "All games" |
| Operations | Recent activity | `GET /admin/audit` (new; replaces the fixed 20 rows) | newest first | — | workspace, kind of change |
| All tenants | Tenants table | `GET /admin/tenants/directory` | name A–Z (database order) | name or subdomain | status |
| All contests | Contests table | `GET /admin/all-contests` | "This week": live, then soonest game (derived over the seven-day window); Active / Finished / All: newest first | contest or workspace name | This week / Active / Finished / All, workspace |
| Platform health | Tenants table | `GET /admin/platform-health` | live first, then name (derived over the set of tenants) | name | — |
| Delivery queue | Failed sends (bulk select) | `GET /admin/delivery-queue` | most recent failure first | prize, contest or workspace name | workspace, reason |
| Fan actions | Tenant select → `Combobox` | `GET /admin/tenants?view=directory` | name A–Z | name | — |
| Support inbox | Reports | `GET /admin/support/inbox` | Open: oldest first; All: newest first | message | workspace, status, reason, pattern |
| Support inbox | "Same problem as another report?" → `Combobox` | `GET /admin/support/inbox?view=open` | oldest first | message | — |

Bulk selection on an endless list (Delivery queue) selects **loaded** rows; "Select all" says how many it selected ("Selected 100 of 342"), and a resend batch keeps its 100-row cap. The queue's list and count leave out sends whose contest or workspace no longer exists; its total tiles are plain per-status counts.

**Kept for older clients.** `/admin/live` still returns its first 40 feed lines and 25 failures, `GET /admin/exports` still carries its 20 recent exports, and `GET /admin/games` keeps its 30-day, 200-game candidate window for the contest cards the redesign replaces. The console reads the paged endpoints; these stay only so an older console keeps working until it is gone.

**Indexes.** `node-server/scripts/create-list-indexes.mjs` creates the list indexes per environment (dry run by default).

### Skipped, with the reason

| Screen | List | Why |
|---|---|---|
| Games & Contests | Contest cards | Replaced by the contest banner-card list in the redesign (S1). The new list uses `InfiniteList`. |
| Games & Contests | Games table inside each contest card | Lives inside the card being replaced; the contest page's Games tab (S1) uses `InfiniteTable`. |
| Prizes | Contest switcher tabs | Prizes move into the contest page in the redesign. |
| Sponsors & Branding | Schedule card (contest × game × slot grid) | Placements move to the contest page's Sponsors tab in the redesign. |
| Sponsors & Branding | Brand preset gallery | Brand is being simplified in the redesign; own presets are capped at 20 by the model. |
| All tenants | Tenant drawer's contests | The staff tenant page replaces the drawer in the redesign. |
| Fans | Fan drawer's consent history and prizes | One fan's records — tens at most — and fan detail becomes a page in the redesign. |
| Overview | Upcoming games (8) | A glance, not a list: it links to the Schedule tab, which is the full list. |
| Overview / Operations | Needs attention | A digest of what is wrong right now, bounded by outstanding problems rather than by history; ordered by severity, not time. |
| Operations / Game day | Live now band; staff live strip | Bounded by games in play at once. |
| Season calendar | Month-grid day cells | A grid, not a list; "+N" opens the day drawer, which lists that day in full. |
| Recap, Prize tiers, Readiness, Exports field scope, Fields & Opt-ins | — | Fixed or small by construction (tiers ≤3, top picks 5, fields ≤64). |

## Rules

1. **Every list that can grow pages on the server.** No endpoint behind a growing list returns everything, and none stops at a silent cap.
2. **Search and filters run on the server.** A screen never filters what it was sent.
3. **One stable order per list, ending in the record id.**
4. **Cursors are opaque.** Only the server makes or reads one; a stale one restarts the list quietly.
5. **Aggregates are per page.** No request aggregates a whole platform collection to draw one page.
6. **No load-more button.** Loading is automatic; the only button a list shows is **Try again** after a failed page.
7. **Counts are real.** The count is the server's total for the current search and filters, never the number of rows loaded.
