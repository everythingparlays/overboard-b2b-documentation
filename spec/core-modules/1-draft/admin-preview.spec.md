# Core Module Spec: Admin — Preview

**Implements:** [`admin-surface.spec.md`](admin-surface.spec.md)'s **Fan's-eye view** principle and Rule 12, as Arthur's 2026-09-24 ruling revises them (WAVE-RULES, "Brand gets simpler"): one preview, the real fan app running in preview mode inside the console, with a screen switcher Gate → Join → Home → Contest → Board → Prize, used by the Brand page and the contest previews alike.

**Depends on:** the S1/S2 preview interface, `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` (workspace; "the interface" below). It is the source of truth for the frame, the `obs-preview:` messages, the render document and its sections, the origin checks, and the console-side policies in its section 5. This spec cites it and does not restate message shapes. S2's `spec/webapp/fan-preview-mode.spec.md` (lands with S2's PR this wave) — the fan app's `/preview` route, its fixtures, what each screen shows, and its honesty rules. [`admin-contests.spec.md`](admin-contests.spec.md) — the contest page and the create builder that host the preview, and [`admin-prizes.spec.md`](admin-prizes.spec.md) — the tier editor that hosts it on Prize (S1, same wave). [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — the sponsor page and the highlight. [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md) (lands with S2's PR this wave) and [`admin-branding.spec.md`](admin-branding.spec.md) — the Brand draft and the theme contract.

**Supersedes:** in [`admin-surface.spec.md`](admin-surface.spec.md), Rule 12's clause "never an embed of the live fan site" (below, "Why a frame is now the right answer"); in [`admin-branding.spec.md`](admin-branding.spec.md), the "Live preview" section and `THEME-21`; in [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md), the "Live preview" section's gate preview and its "Rejected: an iframe of the live fan site" entry.

**Status:** Draft. Written 2026-09-24 for the S1 console redesign. S2 has ruled on S1's three requests (interface, "How the two drafts reconcile"); this spec follows the rulings. One new ask, the resolved `providedBy` on tiers, is recorded under Known gaps.

## Overview

The console has three previews today and none of them shows the fan app. Fields & Opt-ins renders the shared `EntryGatePreview`; Brand renders the same gate plus a sampler of board widgets under the draft theme; the prize tier drawer renders the email. Each is honest about what it can render, which is exactly the problem: [`admin-surface.spec.md`](admin-surface.spec.md) Rule 12 allowed only components moved into `obs-b2b-shared`, and only the gate and two board widgets ever were. So no preview could show the board, the contest page, the prize popup or a sponsor's banner, and every new screen the fan app gained widened the gap.

**The whole change, in one line:** one console component, `FanAppPreview`, frames the fan app's own `/preview` route and posts it the console's draft, so every preview in the console is the fan app itself.

**In scope:**

- `FanAppPreview`: the frame, its controls, its states, and the handshake's console half.
- Its hosts and what each one sends.
- The console's origin allowlist and environment.
- Retiring the console's likeness panels.

**Not in scope:**

- **The fan side.** The `/preview` route, fixtures, screens and the PREVIEW chyron are S2's (`fan-preview-mode.spec.md`).
- **The prize email preview.** It renders the real email through `POST /admin/prizes/email/preview` in a sandboxed `srcDoc` frame and is a different thing ([`prize-delivery.spec.md`](prize-delivery.spec.md)); it is unaffected.
- **The Fields & Opt-ins page.** It is not a host this wave (interface 5.1); its inline gate preview retires, and the Brand page's Gate and Join screens show the saved sign-up fields.

### Why a frame is now the right answer

Rule 12 said two things: the console renders the fan product's own code, never a likeness; and never an embed of the live fan site. The second clause rejected an iframe for three reasons, which the interface's section 1 answers one by one: the live site needs a session (`/preview` runs outside sign-in and never calls the API); it cannot show an unsaved draft (the draft arrives by message on every change); and it shows only the last publish (nothing is read from the API, so there is no published state to show). The first clause, the one that mattered, is now met by construction: the frame *is* the fan app, so there is no second implementation to drift.

Rule 12 therefore reads, from this ruling: **a view of the fan product inside the console is the fan product itself, the fan app's `/preview` route framed by `FanAppPreview` and fed the console's draft; never a likeness rebuilt in console markup** (`PV-01`).

---

## `FanAppPreview`

`obs-b2b-admin-frontend/src/components/preview/FanAppPreview.tsx`. It owns the iframe, the handshake, the controls around the frame and the frame's states. Two pieces sit beside it:

- **`usePreviewFrame`** (`src/components/preview/usePreviewFrame.ts`): the origin check, the `ready` timer, the send policy (interface 5.6), `ping` on reload and on the page becoming visible again.
- **`buildPreviewDocument`** (`src/lib/preview/buildPreviewDocument.ts`): pure functions, one per section of the render document (`theme`, `brand`, `gate`, `contest`, `sponsors`, `sample`, `device`), each taking what the host holds and returning the section the interface defines. Unit-tested section by section, because this mapping is where a preview can quietly lie.

```ts
interface FanAppPreviewProps {
  host: "contest" | "builder" | "tier" | "brand" | "sponsor";
  /** What the host holds, saved or draft. buildPreviewDocument turns it into the render document. */
  source: PreviewSource;
  /** The screens this host offers; the switcher shows these that the frame's `ready.screens` also lists. */
  screens?: PreviewScreen[];
  /** Controlled selection, for hosts that keep it in the URL or in their own state. */
  screen?: PreviewScreen;      onScreenChange?(screen: PreviewScreen): void;
  gameId?: string;             onGameChange?(gameId: string): void;
  tierIndex?: number;          onTierChange?(tierIndex: number): void;
  /** Sponsor page and deep links: the artwork to ring. */
  highlight?: { sponsorId: string; slot: SponsorSlot };
}
```

`PreviewScreen` and `SponsorSlot` are the interface's and the shared package's types. `SponsorSlot` includes `prizePopup`, which names the prize credit's place on screen ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), "Retiring the `prizePopup` slot").

### Where it is used

| Host | Route | Previews | Opens on | Screens offered |
|---|---|---|---|---|
| Contest page, Preview tab | `/contests/:id/preview` | The saved contest | Contest, or the URL's `screen` | Every screen the frame lists |
| Create builder, Basics (mini preview) | `/contests/new`, `/contests/:id/setup/basics` | The Basics form as typed, with whatever games and tiers the draft already has | Home | Home only, no controls |
| Create builder, Review & preview | `/contests/:id/setup/review` | The builder's current state, saved or not | Contest | Every screen the frame lists |
| Tier editor (Prizes tab, full page) | `/contests/:id/prizes/:tierId` (and `new`); in the builder, `/contests/:id/setup/prizes/:tierId` | The saved contest with this tier's unsaved edits in place | Prize | Prize only |
| Brand page | `/branding` | The Brand draft over S2's sample contest | Gate | Every screen the frame lists |
| Sponsor page | `/sponsors/:id` | A contest the sponsor appears in, with its artwork as typed and highlighted | The screen holding the slot being looked at | Gate · Board · Prize |

**The Basics mini preview** shows the contest's card on Home as fans will see it, beside the Description field: a Phone frame at half scale with no switcher, selectors or device toggle. It is the one scaled phone (`PV-11`): it answers "how does my description read on the card", not a question of size. Before the draft exists (the first Continue creates it) the contest is sent without `_id`, which `PreviewContest` allows.

**The tier editor shows Prize only**, with no switcher and no tier selector: its question is how this tier reads to the fan who wins it, and the tier is the one being edited. It sits in the editor's right rail as the "Popup" half of its "Popup | Email" toggle ([`admin-prizes.spec.md`](admin-prizes.spec.md), "The right rail: previews").

**The sponsor page offers Gate, Board and Prize**, the three screens that carry a sponsor's artwork. Focusing an artwork block switches the frame to that block's screen and sets the highlight ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), "Artwork").

**The contest Preview tab keeps its selection in the URL:** `?screen=`, `?game=`, `?tier=`, `?device=`, and `?sponsor=` with `?slot=` for a highlight. The sponsor page's "Preview" links use these, so a link lands on the sponsor's slot at the right game with the ring on it. These are console URLs; the frame's own URL never carries a query (interface 5.9).

### The chrome

One row of controls above the frame: the screen switcher on the left, the selectors for the current screen next to it, and the device toggle on the right. The frame sits on the console background. **The console adds no label of its own**: the fan app's PREVIEW chyron is the marker (`PV-08`). Details by reference to the interface:

- **Screen switcher** (interface 5.2): a segmented control. Before `ready` it shows the six ruled screens, disabled; after `ready`, the host's offered screens that `ready.screens` lists, in the frame's order. Labels: "Gate", "Join", "Home", "Contest", "Board", "Prize", "Results", "Paused". Choosing one sends `navigate`. Hidden when a host offers one screen.
- **Game** (every screen, when the contest has more than one game): a select of the contest's games ("vs Denver · Sat 7:00 PM"), defaulting to the next game to tip off, else the last. The console resolves the sponsor slots for that game itself (`PV-06`).
- **Tier** (Prize, when the contest has more than one tier, not on the tier editor): a segmented control named after the tiers. It sets `sample.prizeTierIndex` and sets `sample.bingosHit` to that tier's bingos, so the board's count and the prize agree.
- **Board mode** (Board): "Draft" | "Live", sent as `sample.boardMode` `build` | `live` (default Live), as S2 typed it. A settled board is not a board mode: it is the Results screen, when the frame lists it.
- **Home** (Brand page, on Home): "With a contest" | "Empty", sending `sample.homeEmpty`, so the admin can see the empty Home that carries their `homeEmpty` text.
- **Contest** (sponsor page): a select of the contests in the page's "Where it appears", defaulting to the one with the next game.
- **Device** (interface 5.3): "Phone" | "Desktop", Phone by default on every host. Phone is 390×844 CSS px, **always shown at 1:1 and never scaled**, so artwork in the frame is at its true size; in a column narrower than the phone the frame scrolls sideways inside its container rather than shrinking. Desktop is 1280×800, scaled down to fit the column with a caption under the frame ("Shown at 62%").

**Accessibility.** The iframe's title is "Fan app preview". The switcher and the segmented selectors are radio groups. When a screen change paints, a polite live region says "Showing Board". Focus never moves into the frame on its own; Tab reaches it after the controls, and inputs inside it accept typing locally and submit nothing.

### What the console sends

The render document's sections are built exactly as the interface's section 5.4 (theme and brand) and 5.5 (contest, gate, sponsors) specify; the send policy is its 5.6. What each host contributes:

| Host | `theme`, `brand` | `gate` | `contest` | `sponsors` | `sample` |
|---|---|---|---|---|---|
| Contest Preview tab | Saved | Saved | Saved | The contest's, resolved for the selected game | Tier, board mode |
| Builder Basics | Saved | Saved | The builder's in-memory state, Basics fields as typed | None | None |
| Builder Review | Saved | Saved | The builder's in-memory state | The draft's, resolved for the selected game | Tier, board mode |
| Tier editor | Saved | Saved | Saved, with this tier replaced by its unsaved form | The contest's, including this tier's provider | `prizeTierIndex` = this tier |
| Brand page | The Brand draft | Saved | None (S2's sample contest) | None | `homeEmpty` |
| Sponsor page | Saved | Saved | The chosen contest, saved | The contest's, with this sponsor's artwork as typed, and `highlight` | Tier on Prize |

- **"Saved" theme** means the tenant's stored `branding.theme`, or the shared `DEFAULT_THEME` when it has never saved one, which is what the live fan app shows that tenant. `theme` and `brand` are therefore always sent (`PV-03`).
- **The draft is what the admin sees** (`PV-04`). The builder sends its form state, edits not yet saved included; the tier editor sends its unsaved tier; the Brand page sends its unpublished draft; the sponsor page sends an artwork URL as soon as the field holds a valid https URL, before it saves. The contest Preview tab sends the saved contest because every other tab of the contest page saves inline, so saved *is* current there.
- **Nothing private crosses** (`PV-05`): never `internalNote`, never `staticRedemptionCode`, never a fan's data, never a sponsor's export fields or data agreement. Sponsors travel as the public projection (`SP-06`), and the provider is included in `sponsors.sponsors`.
- **Tiers carry their provider resolved.** The API stores only `providedBySponsorId` on a tier, and the fan wire carries only the id. In the render document each tier sends `providedBySponsorId` and, beside it, `providedBy: { sponsorId, name, logoUrl, websiteUrl }`, where `logoUrl` is the sponsor's prize-popup logo (as typed, on the sponsor page). It is the shape the award snapshot copies ([`admin-sponsors.spec.md`](admin-sponsors.spec.md), "Provided by"), so the popup preview and the email credit read the same four fields (interface 5.5).
- **Contest field names during the transition** follow interface 5.5: `contestType` and `description` are sent beside `gameType` and `contestDescription`, the latter always holding the fan-facing description.
- **Players are not sent** in this wave. S2 offers an optional `contest.players` for real names on the sample board, but the board's lines and hits stay fixture-driven, and a real athlete's name beside an invented line and an invented hit reads as a fact about that athlete. The sample board keeps S2's sample players.

**`PV-06` — The console resolves sponsor slots for the selected game.** The render document has no "game being previewed" field, so for the selected game the console runs the shared `resolveSponsorSlots` (a game-level holder wins over the contest-wide one, `SP-07`) and sends the winners as contest-wide placements. Every screen then shows the sponsors fans see during that game. A contest with one game sends its placements as stored.

---

## States

| State | What shows | Controls |
|---|---|---|
| Before `ready` | A skeleton in the frame's shape over the iframe, kept until the first `rendered`, so the frame's own idle state never flashes | Switcher disabled; device toggle live |
| Ready | The fan app | All live |
| Screen change | The frame's current contents stay until `rendered` arrives; no skeleton | Live |
| Error inside the frame (`obs-preview:error`) | S2's own plain error state with the chyron. The console adds nothing over it; the message goes to the browser console for developers | Live, so the next change renders again |
| No `ready` within 8 s, a `ready` with an unknown `v`, or `VITE_FAN_APP_ORIGIN` unset | In the frame's place, the console's load-failure card: "The fan app didn't load.", "Retry", "Tell Overboard". Retry remounts the iframe and restarts the 8 s timer. With the origin unset the card shows at once and no iframe mounts | Switcher disabled |
| Draft or unsaved state | Nothing marks it: the frame shows the host's current state, as the table above sets out | Live |
| Member, or a paused tenant | Exactly as for an admin: the preview writes nothing | Live |

Every failure ends in the one card (`PV-10`). The console never falls back to a rebuilt likeness or to the retired panels. The cases the card covers, including a console deployment whose origin the fan app does not allow, are listed in interface 5.8.

---

## Permissions

The preview has no permission of its own: whoever can view the host page gets the whole preview, members and paused tenants included, because it writes nothing and shows nothing the host page does not already show (`PV-12`). OBS staff acting on a tenant preview that tenant: `fanOrigin` takes the acted-on tenant's slug. The frame holds no session and no token, and never receives one.

---

## Origins and environment

The console half of the interface's section 2 ("Origin checks") and 5.9:

| Setting | Where | Value |
|---|---|---|
| `VITE_FAN_APP_ORIGIN` | Console | Prod `https://{slug}.overboardsports.com`; dev (S1) `http://localhost:5323`, (S2) `http://localhost:5324`. `{slug}` is replaced with the tenant's slug |
| `VITE_PREVIEW_PARENT_ORIGINS` | Fan app | Prod `https://admin.overboardsports.com`; dev `http://localhost:5223,http://localhost:5224` |
| `frame-ancestors` | Fan app, `/preview` only | `'self' https://admin.overboardsports.com http://localhost:*` |

**`PV-07` — The console talks to the fan origin and nothing else.** It accepts a message only when `event.origin` is exactly `fanOrigin` and `event.source` is the frame's own window, drops any message whose `type` does not start with `obs-preview:`, and posts only with `targetOrigin: fanOrigin`, never `'*'`. The frame URL is `{fanOrigin}/preview` with no query. The console sets no Content-Security-Policy today (its `vercel.json` has only rewrites); a CSP added later lists the fan origins in `frame-src`, or every preview breaks.

---

## Retirement

Confirmed with the interface (section 6). Once `FanAppPreview` is live on its hosts:

- **Retired:** `src/components/BrandPreviewPanel.tsx`, `src/components/GatePreviewPanel.tsx`, and the shared `EntryGatePreview` sampler, with their tests and `EntryGatePreview`'s export from `ui/entry-gate/index.ts`.
- **Kept:** `EntryGateForm` in `obs-b2b-shared`, which the fan app renders on the real gate and in `/preview`.
- **Unaffected:** the prize email preview.

---

## Copy

| Where | String |
|---|---|
| Switcher | "Gate" · "Join" · "Home" · "Contest" · "Board" · "Prize" · "Results" · "Paused" |
| Selectors | "vs Denver · Sat 7:00 PM" (game) · tier names (tier) · "Draft" · "Live" (board mode) · "With a contest" · "Empty" (Home, Brand page) · "Contest" (sponsor page) |
| Device | "Phone" · "Desktop" · "Shown at 62%" |
| Failure card | "The fan app didn't load." · "Retry" · "Tell Overboard" |
| Assistive | "Fan app preview" (frame title) · "Showing Board" (live region) |

There is no other console copy: no label on the frame, no caption about sample data, no note about unsaved changes (`PV-08`).

---

## Rules

1. **`PV-01` — One preview.** Every view of the fan app in the console is `FanAppPreview` framing the fan app's `/preview` route. Never a likeness rebuilt in console markup. (The sponsor page's prize-email mark on white is not a fan-app view and is argued in [`admin-sponsors.spec.md`](admin-sponsors.spec.md).)
2. **`PV-02` — The console supplies everything; the frame fetches nothing.** No API call, no session, no tenant from the URL (interface section 2).
3. **`PV-03` — `theme` and `brand` are always sent**: the draft on Brand, the saved branding elsewhere, `DEFAULT_THEME` for a tenant that never saved one.
4. **`PV-04` — The preview shows what the admin is looking at**, draft or saved, per host; unsaved edits included wherever the host holds them.
5. **`PV-05` — Nothing private crosses the frame**: no internal note, no redemption code, no fan data, no export fields or data agreement.
6. **`PV-06` — The console resolves sponsor slots for the selected game** with `resolveSponsorSlots` and sends the winners contest-wide.
7. **`PV-07` — Messages are accepted only from `fanOrigin` and the frame's own window, and posted only to `fanOrigin`.**
8. **`PV-08` — The console adds no label.** The fan app's PREVIEW chyron is the marker, and nothing narrates sample data or unsaved state (admin-surface Rule 13).
9. **`PV-09` — A control appears only when the frame can honour it.** The switcher lists the host's screens that `ready.screens` lists; the game selector needs more than one game; board mode offers the two values `sample.boardMode` takes.
10. **`PV-10` — Every failure is one card**, "The fan app didn't load." with Retry: no `ready` in 8 s, an unknown `v`, an unset origin, an unreachable fan app. Never a fallback likeness.
11. **`PV-11` — The phone frame is never scaled**, so artwork is at true size; Desktop scales to fit and says by how much. The builder's Basics mini preview is the one exception: Home at half scale, with no controls.
12. **`PV-12` — The preview writes nothing**, so every viewer of the host page gets all of it.
13. **`PV-13` — `render` is debounced on draft changes and immediate on selection changes; `navigate` comes only from the switcher** (interface 5.6).

## Known gaps (recorded, not blocking)

- **S2's rulings, applied.** Board mode is Draft | Live (`build` | `live`); a settled board is the Results screen. The PREVIEW chyron never overlaps the four sponsor artwork spots (interface section 2). The tier editor and the builder's Basics mini preview are in the interface's host table (5.1).
- **A sponsor with no contest.** The sponsor page previews such a sponsor against the sample contest with the sponsor injected into the highlighted slot (interface 5.5, "Which contest on the sponsor page").
- **The resolved `providedBy` on tiers** is S1's open ask to S2 (interface change log, 2026-09-24): S2's field note has the app look the provider up in `sponsors.sponsors` by id, which the console also sends, so the credit renders either way; the ask is that the app read the resolved shape.
- **Taps inside the frame don't navigate.** S2 ruled in-app navigation off in preview; the switcher is the only navigation (interface, ruling 6).
- **Real players and real games.** `contest.players` is not sent (above); whether Home shows the tenant's real upcoming games is the interface's open point.
- **Not previewable in v1:** the returning-fan gate (S2).
- **The Fields & Opt-ins page has no preview this wave.** Its editors see their sign-up fields on the Brand page's Gate and Join screens; hosting the frame on Fields follows G2's Fields overhaul.
- **The contest field names are sent twice** (`contestType`/`gameType`, `description`/`contestDescription`) until the fan app reads the new names; then the old ones go.
- **Framing policy for the live fan routes** (`frame-ancestors 'none'`) is outside this contract (interface section 7).

## References

- WAVE-RULES 2026-09-24, "Arthur's rulings": Brand gets simpler (one preview), Sponsors, Contests
- The S1/S2 preview interface, `artifacts/wave-2026-09-24/s1-s2-preview-interface.md` (workspace): sections 2–4 (S2), 5 and 6 (S1)
- S2, same wave: `spec/webapp/fan-preview-mode.spec.md`
- [`admin-surface.spec.md`](admin-surface.spec.md) — Fan's-eye view, Rule 12 (revised here), Rule 13
- [`admin-contests.spec.md`](admin-contests.spec.md) — contest page, builder
- [`admin-prizes.spec.md`](admin-prizes.spec.md) — the tier editor's preview rail
- [`admin-sponsors.spec.md`](admin-sponsors.spec.md) — sponsor page, `SponsorSlot`, `SP-06`, `SP-07`
- [`admin-brand-v2.spec.md`](admin-brand-v2.spec.md), [`admin-branding.spec.md`](admin-branding.spec.md) — the Brand draft and the theme contract
- [`admin-fields-and-optins.spec.md`](admin-fields-and-optins.spec.md) — the first instance of the Fan's-eye view, whose gate preview retires
- [`prize-delivery.spec.md`](prize-delivery.spec.md) — the prize email preview, unaffected
- `obs-b2b-shared`: `theme/resolve.ts` (`themeToCssVars`, `DEFAULT_THEME`), `interfaces/b2b/B2BSponsor.ts` (`resolveSponsorSlots`, `SponsorSlot`)
