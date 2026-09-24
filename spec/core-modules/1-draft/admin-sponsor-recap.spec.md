# Core Module Spec: Admin — Sponsor Recap

**Implements:** the PRD's central value claim — "prolonged, **measurable** sponsor exposure" (§1) — as a document; `RPT-05` (aggregate-only use of declined fans); `ADM-07` (reporting through the admin surface). Concept seed: vault `cargo/passage-plans/2026-09-21-product-concepts.md`, Tier-1 idea 1 ("the highest-value idea here"). Voice: D-067 (Club Level is the document-surface voice) and D-068 (honesty by omission). Visual reference: the design canvas artboard "Document · Sponsor recap" (`ClubLevel-SponsorRecap`).

**Depends on:** [`admin-game-day.spec.md`](admin-game-day.spec.md) — phases and the one attribution helper; every number here is attributed exactly as `/live` attributes it. [`admin-exports.spec.md`](admin-exports.spec.md) — consent arithmetic at the current wording (`RPT-05`). [`admin-branding.spec.md`](admin-branding.spec.md) — the tenant's logo. The sponsor model (Sponsors & Branding, same wave) — sponsor names and logos.

**Status:** Draft — built on `arthur-ops` (2026-09-23).

## Overview

The artifact a team forwards to the brand that paid: a one-page, branded recap of one game. The PRD's whole value claim had no screen that states it with numbers — CSVs are evidence, not a story. This is the renewal conversation.

**The whole change, in one line:** `GET /admin/recap` computes one game's attributed numbers (plus three small new aggregations), and `/recap` lays them out as a Club Level editorial document the browser prints to PDF.

**In scope:** the endpoint and contract (`obs-b2b-shared/src/api/admin/recap.ts`); the `/recap` document screen with its sponsor-edition switch and print stylesheet; the `--doc-*` document tokens; links from game day, All contests and the season calendar.

**Not in scope (and why):**

- **Impressions.** Not measured anywhere. No field, no tile.
- **The engagement curve** ("boards active through the night", the mock's ‡). Board *creation* is recorded; *activity* over the game is not — a board's state changes are not timestamped per event. It ships when fan metrics exist (the metrics build, pending Nick). Until then the document has no chart, rather than a creation histogram labelled as activity.
- **Footnotes.** The mock's † and ‡ notes described its own unbuilt modules. Under D-068 the document carries **zero footnotes**: the † aggregations are built (below); the ‡ module is absent.
- **A public share link.** Sponsors do not sign in (`IDN-11`), and an unauthenticated tokenized URL is a new security surface. The document leaves the console as a PDF, which is also the form a sponsor forwards internally. Recorded.
- **Top players (fans).** A leaderboard of fans in a sponsor-facing document is fan-identifying detail going to a sponsor — `RPT-05` territory. The document's "most picked" is about **athletes**.

---

## The document

Club Level's editorial voice: a cream sheet, a serif display face over a clean grotesque, ink rules, one green and one gold, generous margins. Real numbers only. Layout, top to bottom (the canvas artboard, minus what D-068 removes):

1. **Masthead.** Eyebrow "Game recap · *Sponsor* edition" (or "Game recap" with no sponsor edition), the game date, a short gold rule.
2. **Headline.** The matchup ("Fighting Hawks vs. Bison"), and a line: contest · final score — the score only when the feed carries it and says `Final`. Right-aligned: the workspace's logo (when branding has one) and name; "Presented with *Sponsor*" and the sponsor's logo when the sponsor record has one — **omitted, never a placeholder mark**, until then.
3. **KPI band** — four figures under an ink rule: **Boards played**, **Bingos hit**, **Prizes delivered** (with "*n* unresolved" beside it when any won prize is failed or still pending — true, and a sponsor deserves it), **Joined on game night** (memberships created in the game window).
4. **Prizes** (left) — per tier: prize, its threshold in the game's own unit ("1 bingo", "3 bingos"), winners, delivered.
   **Sponsor audience** (right, sponsor editions only) — the sponsor's opt-in among this game's players, at its current wording: a percentage, a bar, "*accepted* of *players* players". An aggregate, so fans who declined may be counted in it (`RPT-05`).
5. **Most-picked players** — the five athletes on the most boards: name, position, a share bar, share of boards ("Share of the 842 boards"; "Share of the one board" for a single board). Omitted when no board resolves to an athlete.
6. **Footer.** "Powered by Overboard · *slug*.overboardsports.com" and, for a sponsor edition, "Prepared for *Sponsor*".

Sections with nothing true to show are absent, and the document closes up around them.

### Sponsor editions

A workspace's sponsors are its sponsor opt-ins (`kind: "sponsor"`); the edition is keyed by opt-in because the audience number is per opt-in. The name comes from the linked sponsor record (`OptInDefinition.sponsorId` → `B2BSponsor`, same workspace only) when there is one, from the opt-in's label otherwise; the logo only from the sponsor record (`sponsorMarkUrl`). A workspace with several sponsors gets a switcher; with none, the recap is the team's own edition (no audience panel, no "Presented with"). **When the sponsor model's per-game attachment lands, the default edition becomes the game's presenting sponsor** — recorded follow-up.

### The three new aggregations (the mock's †)

1. **Final score** — read from the feed's `eventDetails` (`homeTeamScore`/`awayTeamScore`) when the feed says `Final`; otherwise not shown.
2. **Joined on game night** — memberships whose `joinedAt` falls in the game window (tip-off − 90 min to tip-off + 6 h, capped at now).
3. **Most-picked players** — for the game's attributed boards, each board's nine props → the prop's athlete (`entityInfo`) → counted once per board. Top five by boards.

### Print

**Print or save PDF** opens the browser's print dialog; a print stylesheet prints the sheet alone — no console chrome, US Letter, margins set, colors preserved. The screen and the PDF are the same layout.

---

## Access

Any console user, for their own workspace; Overboard staff through `?tenant=`. Reporting is the product the team bought (`org:reports:read` is held by every admin role, admin-exports), and nothing in the document identifies a fan, so no reverification.

## Endpoint

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/recap` | requireAdmin | tenant: own org; obs: `?tenant=` |

`?contest=&game=` required; `?sponsor=` optional (an opt-in id; unknown → the default edition). **404** when the contest is not the workspace's or the game is not one the contest runs (or has run — the contest's game history counts, so a recap survives the game being turned off afterwards). Returns `{ generatedAt, tenant, game, contest, sponsor, sponsors[], kpis, prizes[], audience, topPicks[] }`.

## Rules

1. **Real numbers only.** Every figure is a recorded count attributed by the game-day helper; nothing estimated, nothing illustrative.
2. **Zero footnotes, zero gap narration.** What is not measured is absent.
3. **Nothing identifies a fan.** Aggregates and athletes only.
4. **No placeholder marks.** A logo renders when a real one exists.

## Known gaps (recorded, not blocking)

- **Engagement over time** — needs the metrics build.
- **Impressions** — not measured.
- **Public share link** — not built; PDF is the channel.
- **Sponsor logos** — built against the sponsor model (same wave): an edition takes its name from the linked `B2BSponsor` and its mark from `sponsorMarkUrl(assets)`; an opt-in with no linked sponsor, or a sponsor with no mark, shows the name alone.
- **Presenting sponsor per game** — arrives with the sponsor model's per-game attachment.

## References

- Vault concept: `cargo/passage-plans/2026-09-21-product-concepts.md`, Tier 1 #1.
- Decisions: D-067 (Club Level document voice), D-068 (honesty by omission).
- Contract: `obs-b2b-shared/src/api/admin/recap.ts`.
