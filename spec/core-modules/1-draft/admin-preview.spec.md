# Core Module Spec: Admin — Preview

**Implements:** [`admin-surface.spec.md`](admin-surface.spec.md)'s **Fan's-eye view** principle and Rule 12, as Arthur's rulings revise them: one preview, the real fan app running in a preview mode inside the console (2026-09-24), showing only real screens of the **current** fan app with the contest's real configuration, players, photos and data, seamless navigation with the tabs in sync (2026-09-27), on the phone only: the fan app is mobile-only, so there is no desktop view anywhere (2026-09-28).

**Depends on:** [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md), the fan app's side: the `/preview` route, the preview session and data layer, the screens, the messages and the render document. This spec cites it and does not restate message shapes. [`admin-contests.spec.md`](admin-contests.spec.md): the contest page and the builder that host the preview. [`admin-prizes.spec.md`](admin-prizes.spec.md) and [`admin-sponsors.spec.md`](admin-sponsors.spec.md): the prize page and the sponsor page, which host it on their own screens. [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) (Wave 3): the fan reads whose shapes the render document reuses.

**Supersedes:** in [`admin-surface.spec.md`](admin-surface.spec.md), Rule 12's clause "never an embed of the live fan site" (below, "Why a frame is the right answer"); in [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), the "Rejected: an iframe of the live fan site" entry. For the console side, the S1/S2 preview contract (`artifacts/wave-2026-09-24/s1-s2-preview-interface.md`, workspace, section 5).

**Status:** Draft. Written 2026-09-24 for the S1 console redesign.
Revised 2026-09-27 for Wave 4: the frame shows the current fan app with real data and in-frame navigation, the tabs follow it, the fixtures, sample players and PREVIEW chyron are gone, the Brand page leaves the host list on main (Brand page v2 and its preview are Wave 5), and the console builds the render document from one admin read.
Revised 2026-09-28 for Wave 4b (Arthur's walkthrough): the desktop view and its toggle are removed, a contest's preview offers only its own screens (Contest list, Contest detail, Board, Prize), Brand hosts the frame on main with every screen fed by a built-in sample contest (the current Brand page, not Brand page v2), and Fields & Opt-ins shows its gate in the same phone.

## Overview

The console has three previews today and none of them shows the fan app. Fields & Opt-ins renders the shared `EntryGatePreview`; Brand renders the same gate plus a sampler of board widgets; the prize tier drawer renders the email. None can show the contest list, the draft page, the board with real players, or the prize popup.

**The whole change, in one line:** one console component, `FanAppPreview`, frames the current fan app's `/preview` route and posts it the contest's real data, so the admin clicks through the contest exactly as a fan will, on the phone, with the tabs above the frame following along.

**In scope:**

- `FanAppPreview`: the frame, its tabs and controls, its states, and the console half of the handshake.
- Its hosts and what each one sends.
- `GET /admin/contests/:contestId/preview`, the read that supplies the render document.
- The console's origin allowlist and environment.

**Not in scope:**

- **The fan side** ([`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md)).
- **The prize email preview.** It renders the real email in a sandboxed `srcDoc` frame and is a different thing ([`prize-delivery.spec.md`](prize-delivery.spec.md)).
- **Brand page v2** (the fan-app v2 mocks), built on the Wave 5 branch against this same contract. The current Brand page on main hosts the frame from Wave 4b (below).

### Why a frame is the right answer

Rule 12 said two things: the console renders the fan product's own code, never a likeness; and never an embed of the live fan site. The second clause rejected an iframe for three reasons, each answered here: the live site needs a session (`/preview` runs a preview session with no account and never calls the API); it can't show an unsaved draft (the console posts the draft and the host's unsaved edits on every change); and it shows only the last publish (nothing is read from the fan API; the console's admin read builds the document, drafts included). The first clause is met by construction: the frame *is* the fan app, down to its routes.

Rule 12 therefore reads: **a view of the fan product inside the console is the fan product itself, the current fan app's `/preview` route framed by `FanAppPreview` and fed real data by the console; never a likeness rebuilt in console markup** (`PV-01`).

---

## `FanAppPreview`

`obs-b2b-admin-frontend/src/components/preview/FanAppPreview.tsx`. It owns the iframe, the handshake, the tabs and controls around the frame, and the frame's states. Beside it:

- **`usePreviewFrame`** (`src/components/preview/usePreviewFrame.ts`): the origin check, the `ready` timer, the send policy, `ping` on reload and on the page becoming visible again, and the tab sync.
- **`buildPreviewDocument`** (`src/lib/preview/buildPreviewDocument.ts`): pure functions that take the preview read's answer and the host's unsaved edits and return the render document. Unit-tested section by section, because the overlay of unsaved edits is where a preview can quietly lie.

```ts
interface FanAppPreviewProps {
  host: "contest" | "builder" | "prize" | "sponsor" | "brand";
  /** Absent on the prize page (its prize belongs to no contest) and on Brand (the sample contest). */
  contestId?: string;
  /** The host's unsaved edits, overlaid on the saved data (`branding` on Brand). */
  overlay?: PreviewOverlay;
  /** The screens this host offers as tabs; the frame's `ready.screens` narrows them. */
  screens?: PreviewScreen[];
  /** Controlled screen, for hosts that keep it in the URL. */
  screen?: PreviewScreen;      onScreenChange?(screen: PreviewScreen | null): void;
  /** @deprecated Accepted and ignored: the preview is always the phone. */
  device?: "phone" | "desktop"; onDeviceChange?(device: "phone" | "desktop"): void;
  view?: PreviewView;          // prize tier, game, highlight
  refreshKey?: unknown;        // change it after a save and the frame reads again
  fit?: boolean;               // fit the phone's height to the window (a preview beside a long editor)
}
```

The phone itself is **`PhonePreview`** (`src/components/preview/PhonePreview.tsx`): the row of controls, then a 390-wide screen in the bezel, centred on its stage. `FanAppPreview` renders its frame in it, and Fields & Opt-ins renders its in-page gate in it, so every preview in the console is the same phone.

`PreviewScreen`, `PreviewView` and `PreviewDocument` are shared types (`obs-b2b-shared/src/api/preview.ts`).

### Where it is used

| Host | Route | Previews | Opens on | Tabs offered |
|---|---|---|---|---|
| Contest page, Preview tab | `/contests/:id/preview` | The saved contest | `contests`, or the URL's `?screen=` | `contests`, `contest`, `board`, `prize` |
| Builder, Review step | `/contests/:id/setup/review` | The draft, with Basics' unsaved edits overlaid | `contests` | `contests`, `contest`, `board`, `prize` |
| Prize full page | [`admin-prizes.spec.md`](admin-prizes.spec.md) | The prize as typed, on its own (a prize belongs to no contest): `document.prize` with no `contest`, in the tenant's theme, with its "Provided by" credit | `prize` | `prize` only |
| Sponsor page | [`admin-sponsors.spec.md`](admin-sponsors.spec.md) | A contest where the sponsor appears, with its unsaved artwork overlaid in its real spots and highlighted; `view.gameId` when the slot being looked at is a game's own. A sponsor that appears in no contest gets no frame | The screen holding the slot | `start`, `board`, `prize` |
| Brand | [`admin-branding.spec.md`](admin-branding.spec.md) | The built-in sample contest (below), in the tenant's name, gate and unpublished look | `start` | All seven |

**A contest's preview shows only the screens that are about the contest** (Arthur, 2026-09-28): Contest list, Contest detail, Board and Prize. Start, Sign in and Join are the tenant's, not the contest's, and they are previewed on Brand, the one place every screen matters. A click inside the frame can still reach a screen the host doesn't offer (the start screen after signing out from the menu); no tab is selected then, and the Preview tab's address keeps `?screen=` empty rather than moving the frame back.

**Fields & Opt-ins** is not a host of the frame: its preview is the in-page gate (`GatePreviewPanel`, [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md)), which follows every keystroke of the unsaved draft. From Wave 4b it sits in the same `PhonePreview`, with Join and Returning as its screens.

The builder's Basics step has no mini preview any more: its question (how the card reads) is answered on Review, where the whole contest can be clicked through. A host whose spec needs another screen set passes `screens`.

**The Preview tab keeps its selection in the URL:** `?screen=` (one of the contest's four screens), plus `?tier=` on Prize, `?game=` for one game's board (sent as `view.gameId`), and `?sponsor=` with `?slot=` for a highlight. When the admin clicks inside the frame and the frame reports a new screen, the URL's `screen` is replaced (not pushed), so Back leaves the Preview tab rather than stepping through the admin's clicks. These are console URLs; the frame's own URL never carries a query.

### The chrome

One row of controls above the frame, on the console background:

- **Screen tabs** (left): a segmented control. Before `ready` it shows the host's screens, disabled. After `ready`, the host's screens that `ready.screens` lists, in the frame's order, labelled "Start", "Sign in", "Join", "Contest list", "Contest detail", "Board", "Prize". Choosing one sends `navigate`. **The tabs follow the frame:** on `obs-preview:navigated` the console selects the tab the frame names (none, if it names no screen or one the host doesn't offer) and sends nothing back. Hidden when a host offers one screen. Brand's seven tabs wrap inside the column rather than widen it. **A screen this contest can't show is disabled, with the reason on the tab** (revised 2026-09-28): a contest with no game open for entry, or no players yet, has no board and so no prize ("This contest has no board to show yet."); one with no prize tiers has no prize. A host that asks for such a screen (the sponsor page following its board artwork) leaves the phone and the tab where they are and says the reason once beside the tabs; a screen the frame refuses anyway (`error` naming it) is disabled the same way and the tab goes back to the screen the phone shows. The chosen tab always names the phone's screen.
- **Tier** (on Prize, when the contest has more than one tier, not on the prize page): a segmented control "Tier 1 · Tier 2 · Tier 3", by number. It sends `navigate` with `view.prizeTierIndex`. **Choosing another tier closes the previous tier's popup and opens the new one at once** (revised 2026-09-28, Arthur's final walk): never the old popup left on top with the new one behind it, never a second click. The frame answers the choice with a board that holds only the chosen tier's award, and the fan board's popups follow the awards the board holds ([`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md), "The Prize screen"). The same holds in the builder's Review & preview step, which mounts the same preview.
- **One phone, no device choice.** The fan app is mobile-only (Nick, 2026-09-27), so the preview is always the phone: 390×844 CSS px in a bezel, shown at 1:1 and never scaled, so artwork in the frame is at its true size; in a column narrower than the phone the frame scrolls sideways inside its container. A host that sticks the preview beside a long editor (Brand) passes `fit`, and the screen's height follows the window (never above 844, never below 560) while the app scrolls inside it, as on a shorter phone. Every render says `device: "phone"`; a mount still passing `device` is ignored.

**The console adds no label** to the frame, and the frame carries none (`PV-08`).

There is no game selector: the admin picks a game inside the frame, on the Contest screen's own game tabs, exactly as a fan does. The sponsor page passes `view.gameId` when it needs a particular game's slots, and the Games tab's "See it on the board" opens the Board screen for one game (`?screen=board&game=<id>`), so the board carries that game's progress marker ([`admin-contests.spec.md`](admin-contests.spec.md), "Progress marker"). The marker comes from the contest read (`gameMarkerImageUrls`), so the preview shows what is saved.

**Accessibility.** The iframe's title is "Fan app preview". The tabs and segmented controls are radio groups. When the screen changes, a polite live region says "Showing Board". Focus never moves into the frame on its own; Tab reaches it after the controls.

### What the console sends

The render document is built from **`GET /admin/contests/:contestId/preview`** (below) and the host's overlay:

| Host | Overlay on the preview read |
|---|---|
| Contest Preview tab | None: every other tab of the contest page saves inline, so saved is current. |
| Builder Review | Basics' unsaved name, description and player limit, applied to the contest wherever the fan wire carries them (the contest read and its entry in `contests`). |
| Prize page | No contest read: the tenant sections come from `GET /admin/preview`, and `document.prize` is the prize as typed, in the award's prize shape with `providedBy` resolved from its sponsor. |
| Sponsor page | The sponsor's unsaved artwork, applied to its entry in `schedule` for the slot and scope it holds (one holder per slot per scope, as the app renders it); `view.highlight` on the slot being looked at. |
| Brand | No contest read: the tenant sections come from `GET /admin/preview`, the sample contest replaces `contests` and `contest`, and `overlay.branding` lays the unpublished theme and images on `org.organization.branding` exactly where the public org read carries them. A reset theme ("Reset to starting look" or "Reset to neutral look") is no theme, as it is once published, so the frame shows the onboarding colours or the neutral look. |

### The sample contest (Brand)

`src/lib/preview/sampleContest.ts`. Brand previews the look, not a contest, so it never shows one of the tenant's own contests (Arthur, 2026-09-28): a built-in sample stands in. One game between two invented teams (their marks are drawn in place as initials on a colour, so nothing is fetched), six invented players shown without photos (as the fan app shows any player whose photo is off), two props each with some already hit so the board shows the hit colour and a bingo, and three prize tiers with names, descriptions and claim instructions. The game is timed an hour after the preview opened, so the contest is Open, and the read is marked test mode so a board can still be built if the preview stays open past the kickoff. It is the only contest in Upcoming, Past is empty, its game is the featured one, and no sponsor is placed (sponsors are not part of the look). *(Revised 2026-09-28: the Start screen shows no matchup, so the sample sends `nextGame: null`; see [`admin-sponsors.spec.md`](admin-sponsors.spec.md), "The next game".)* The org's name, the join gate and the tenant's theme stay the tenant's. None of it is ever written anywhere: it lives only in the render document.

- **Nothing private crosses** (`PV-05`): the preview read never includes `internalNote`, a static redemption code, a fan's data, or a sponsor's export fields or data agreement. It is built from the fan reads' projections, which already exclude them.
- **Send policy.** `render` is sent on every `ready` (including each answer to a `ping`), after the preview read loads or reloads, and on overlay changes (debounced to about 100 ms, trailing). `navigate` is sent on a tab or tier choice, and once after the first `render` when the host opens on a screen other than the document's. `ping` is sent when the iframe reloads and when the console page becomes visible again.
- **When the host saves**, the console refetches the preview read and sends a new `render`. The frame keeps its screen and, where it still fits the new data, its drafted players and board ([`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md), "Building the preview board").

### `GET /admin/contests/:contestId/preview`

`requireAdmin`, any resolved admin scope (members and paused tenants included: it writes nothing); staff name the tenant with `?tenant=`. 404 for a wrong or foreign id. Contract in `obs-b2b-shared/src/api/admin/preview.ts`.

It answers the render document's data sections, each **built by the same server function as the live fan read**, for this tenant:

| Section | Built by | Difference from the live fan read |
|---|---|---|
| `org` | The `GET /b2b/org/:slug` handler | None |
| `membership` | The `GET /b2b/membership` handler, for a fan who hasn't joined | No fan: the answer a new fan gets |
| `contests` | `listB2BContests` for `upcoming` and `past` | The previewed contest is included even as a Draft, with the fan status it would have if published now, and placed where the list's order puts it |
| `contest` | `getB2BContestPlayers` | A Draft is answered (the fan read refuses it with 404), and each game also carries its visible props (`showProp: true`, the board-cell fields only) |
| `schedule` | The fan sponsor-schedule read | The previewed contest counts as published when the schedule picks its featured game |

`getB2BContestPlayers` and `listB2BContests` gain an `asPublished?: contestId` option that only this admin handler passes; the fan routes never pass it. The read is bounded by the contest (its games, their visible props and players) and by the fan list's page size (20 per tab).

```ts
// 200
{ success: true; tenant: { slug: string; name: string }; document: Omit<PreviewDocument, "screen" | "device" | "view" | "prize"> }
```

**`GET /admin/preview`** answers the tenant-level sections only (`org`, `membership`, `contests`, `schedule`), for a host with no contest (the prize page). Same auth and scope rules, same builders.

### Where the players, photos and props come from

The render document's players, photos and lines are the ones the Prop Entry System (PES) publishes into the mirror for the contest's games: the same `readonly_props` (with `entityInfo`) and `readonly_betevents` the fan reads use. Photos are the players' `photoUri` from PES, shown only when `showPhotoUri` is not false. Nothing is invented: a game with no props yet has no players on the Contest screen and answers Generate with the real "Players for this game aren't available yet." message.

---

## States

| State | What shows | Controls |
|---|---|---|
| Before `ready` | A skeleton in the frame's shape over the iframe, kept until the first `rendered` | Tabs disabled |
| Ready | The fan app | All live |
| Preview read loading or reloading | The frame keeps its current contents; the first load keeps the skeleton | Live |
| Preview read failed | In the frame's place, the kit's `ReportableLoadError` | Tabs disabled |
| Screen change | The frame's contents stay until `rendered`; no skeleton | Live |
| Error inside the frame (`obs-preview:error`) | The app's own error state for that screen; the message goes to the browser console | Live |
| No `ready` within 8 s, a `ready` with an unknown `v`, or `VITE_FAN_APP_ORIGIN` unset | The console's load-failure card: "The fan app didn't load.", "Retry", "Tell Overboard". Retry remounts the iframe and restarts the timer. With the origin unset the card shows at once and no iframe mounts | Tabs disabled |
| Member, or a paused tenant | Exactly as for an admin | Live |

Every failure ends in one card (`PV-10`). The console never falls back to a rebuilt likeness.

---

## Permissions

The preview has no permission of its own: whoever can view the host page gets the whole preview, because it writes nothing and shows nothing the host page doesn't already hold (`PV-12`). OBS staff acting on a tenant preview that tenant: `fanOrigin` takes the acted-on tenant's slug. The frame holds no session token and never receives one.

---

## Origins and environment

| Setting | Where | Value |
|---|---|---|
| `VITE_FAN_APP_ORIGIN` | Console | `https://{slug}.overboardsports.com` on deployed stacks; the local fan app's origin in dev (Vite's default, `http://localhost:5173`). `{slug}` is replaced with the tenant's slug |
| `VITE_PREVIEW_PARENT_ORIGINS` | Fan app | Every console origin that hosts the frame: `https://admin.overboardsports.com`, the dev stacks' console origins, and the local console origin (`http://localhost:5174`, plus any other local port in use) |
| `frame-ancestors` | Fan app, `/preview` only | The same origins, plus `'self'` |

**`PV-07` — The console talks to the fan origin and nothing else.** It accepts a message only when `event.origin` is exactly `fanOrigin` and `event.source` is the frame's own window, drops any message whose `type` doesn't start with `obs-preview:`, and posts only with `targetOrigin: fanOrigin`, never `'*'`. The frame URL is `{fanOrigin}/preview` with no query. The console sets no Content-Security-Policy today; one added later lists the fan origins in `frame-src`.

---

## Retirement

- **Retired in Wave 4b:** `BrandPreviewPanel.tsx` (Brand hosts the frame) and the desktop view. `GatePreviewPanel.tsx` stays, in the shared phone.
- **Retired on the Wave 5 branch:** the shared `EntryGatePreview`, with Brand page v2.
- **Kept:** `EntryGateForm` in `obs-b2b-shared`, which the fan app renders on the real gate and so in `/preview`.
- **Unaffected:** the prize email preview.

---

## Copy

| Where | String |
|---|---|
| Tabs | "Start" · "Sign in" · "Join" · "Contest list" · "Contest detail" · "Board" · "Prize" (accessible name "Screen") |
| Selectors | "Tier 1", "Tier 2", "Tier 3" (tier, accessible name "Prize tier") |
| Failure card | "The fan app didn't load." · "Retry" · "Tell Overboard" |
| Assistive | "Fan app preview" (frame title) · "Showing Board" (live region) |

There is no other console copy: no label on the frame, no caption about data, no note about unsaved changes (`PV-08`).

---

## Rules

1. **`PV-01` — One preview.** Every view of the fan app in the console is `FanAppPreview` framing the current fan app's `/preview` route. Never a likeness rebuilt in console markup.
2. **`PV-02` — The console supplies everything; the frame fetches nothing** from the API.
3. **`PV-03` — The render document is the fan wire,** built by the same server functions as the live fan reads, with a Draft included as if published.
4. **`PV-04` — The preview shows what the admin is looking at**, with the host's unsaved edits overlaid.
5. **`PV-05` — Nothing private crosses the frame.**
6. **`PV-06` — The tabs follow the frame.** A click inside the frame that changes screen moves the tab; a tab choice moves the frame; neither echoes the other.
7. **`PV-07` — Messages are accepted only from `fanOrigin` and the frame's own window, and posted only to `fanOrigin`.**
8. **`PV-08` — No label, inside or around the frame.** Nothing narrates the data or unsaved state (admin-surface Rule 13).
9. **`PV-09` — A control appears only when the frame can honour it.** Tabs are the host's screens that `ready.screens` lists; the tier control needs more than one tier.
10. **`PV-10` — Every failure is one card**, never a fallback likeness.
11. **`PV-11` — The phone only, never scaled.** There is no other device; a fitted phone is shorter, never smaller.
12. **`PV-12` — The preview writes nothing**, so every viewer of the host page gets all of it.

## Known gaps (recorded, not blocking)

- **A sponsor with no contest** has no real contest to preview it in, and the sample contest is Brand's alone, so the sponsor page shows no frame for it ([`admin-sponsors.spec.md`](admin-sponsors.spec.md)); its artwork appears in the frame once it is placed on a contest.
- **The popup over an unscored board** and the other fan-side gaps are in [`fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md).

## As built (Wave 4)

Where the shipped console differs in detail from the text above:

- `FanAppPreview` takes `overlay.contest.description` (the same as `contestDescription`). `screen` is controlled only when `onScreenChange` is passed; otherwise it is the opening value.
- The contest Preview tab keeps its selection in the address: `?screen=`, `?tier=` (counted from 1), `?game=`, and `?sponsor=` with `?slot=` for a highlight. An old `?device=` is ignored.
- The prize page's rail mounts the frame itself. No separate prize preview page ships.
- The frame needs `VITE_FAN_APP_ORIGIN` in the console and the console's origin in the fan app's `VITE_PREVIEW_PARENT_ORIGINS`.
- The sponsor schedule read with `asPublished` skips the server's one-minute cache, so a just-placed sponsor shows at once.

## References

- Rulings: Arthur 2026-09-24 (`artifacts/wave-2026-09-24/WAVE-RULES.md`, "Brand gets simpler") and 2026-09-27 (`artifacts/review-2026-09-27/arthur-rulings-2026-09-27.md`, Preview)
- [`../../webapp/fan-preview-mode.spec.md`](../../webapp/fan-preview-mode.spec.md) — the fan side and the message contract
- [`admin-surface.spec.md`](admin-surface.spec.md) — Fan's-eye view, Rule 12 (revised here), Rule 13
- [`admin-contests.spec.md`](admin-contests.spec.md), [`admin-prizes.spec.md`](admin-prizes.spec.md), [`admin-sponsors.spec.md`](admin-sponsors.spec.md)
- [`end-to-end-flow.spec.md`](end-to-end-flow.spec.md) — the fan reads
- [`prize-delivery.spec.md`](prize-delivery.spec.md) — the prize email preview, unaffected
- Superseded (workspace): `artifacts/wave-2026-09-24/s1-s2-preview-interface.md`
