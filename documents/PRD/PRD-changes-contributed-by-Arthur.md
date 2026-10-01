# PRD changes contributed by Arthur

This file holds the changes and clarifications to the PRD that Arthur (and the agents working for
him) have contributed. The PRD itself, [`OBS_B2B_Platform_PRD.md`](OBS_B2B_Platform_PRD.md), stays
entirely Nick-authored: only Nick edits it. When one of our decisions changes or clarifies a PRD
requirement, it is written here, not in the PRD.

On 2026-09-28 the notes we had written into the PRD were taken back out, so the PRD again reads
exactly as Nick wrote it. Their text is kept word for word below (entries 1 to 5), so nothing is lost.

Each entry names the PRD requirement or section, what we changed or clarified, why, the date, and
its status:

- **In effect**: this is how the platform works now.
- **Superseded**: a later ruling replaced it. The replacing entry is named.
- **Reverted**: we undid it.

Where a spec is linked, the spec has the detail. Specs marked "on `arthur-console-redesign`" are on
that open branch (docs PR #31) and are not on `main` yet.

---

## Removed from the PRD on 2026-09-28

These five entries were written into the PRD on 2026-09-23 (commit `bdafbe1`, "Reconcile the PRD with
the branding spec and tenant self-serve"). The same commit also changed the PRD header's
"Last updated" line from "August 2026" to "September 2026 (reconciled with the branding, sponsor and
tenant-self-serve rulings — see the "Revised 2026-09" notes)".

### 1. `BRAND-01` (and `TEN-02`'s exception, §8.1, §8.3, §15.2): the team's look is configuration the tenant edits

- **What:** The set-once brand elements (colors, logo, naming) are stored tenant configuration, edited
  on the console's Brand screen by OBS staff or the tenant's own admins, and applied by the fan app at
  runtime. The per-tenant files an engineer writes at onboarding stay only as seeds (first paint and
  offline fallback). Prize email templates and delivery mechanics were left out of this change.
  Later, on 2026-09-27, the Brand screen's font option was removed: Satoshi is the font everywhere.
- **Why:** The fan app already makes one config lookup before it renders, so the "render fast without
  a lookup" reason for hardcoding no longer applied. Teams want to try looks without an engineering
  ticket, and hand-picked color pairs had already produced white-on-white text for one tenant.
- **Date:** 2026-09-22 (spec), written into the PRD 2026-09-23.
- **Status:** In effect. Spec: [`admin-branding.spec.md`](../../spec/core-modules/1-draft/admin-branding.spec.md).
- **Removed from the PRD (verbatim):**
  - Added after the `TEN-02` exception paragraph:
    > **Revised 2026-09.** The platform no longer relies on this exception. The `BRAND-01` elements are stored configuration like everything else here, edited through the admin surface; a per-tenant source file survives only as a *seed* — the first paint and the offline fallback — and the stored configuration wins the moment it exists. The exception still permits a seed; nothing depends on one. See `BRAND-01`.
  - §8.1 table, "Set-once tenant elements" row: "Changes" became "Once, at onboarding — seasonal at most"; "Owned by" became "Seeded by an engineer; then the tenant's admins (revised 2026-09)".
  - §8.1 paragraph, replacing "Set-once elements can be hardcoded at onboarding so they render immediately with no config lookup.":
    > Set-once elements were originally hardcoded at onboarding so they rendered with no config lookup; since 2026-09 they are stored configuration with the hardcoded values kept as seeds (see `BRAND-01`).
  - `BRAND-01` body: "Configured once during onboarding, by an engineer. May be hardcoded per tenant so they render fast without a config lookup." was shortened to "Configured once during onboarding."
  - Added after `BRAND-01`:
    > **Revised 2026-09.** These elements are now stored tenant configuration, edited on the admin surface's **Sponsors & Branding** screen by OBS staff or the tenant's own admins, and applied by the fan app at runtime. The per-tenant files an engineer writes at onboarding remain as seeds. The original "may be hardcoded so they render fast without a config lookup" no longer describes the platform: the fan app already makes one unconditional config lookup before it renders, and the look rides on it for free. The prize email templates and delivery mechanics in the list above are unaffected — they remain engineer work (`PRIZE-04`, `PRIZE-05`). Implementation: `spec/core-modules/1-draft/admin-branding.spec.md`.
  - §8.3, last acceptance criterion struck through and replaced with:
    > **Revised 2026-09:** changing a tenant's team colors or logo is a configuration change on the admin surface and requires no engineer; the team's display name is changed by OBS staff (tenant rename).
  - §15.2 table, left column: "Team colors, logo, app naming (`BRAND-01`)" became "Seeding team colors, logo, app naming (`BRAND-01`) — edited on the admin surface afterwards (revised 2026-09)".

### 2. `TEN-05`: onboarding seeds the brand, it does not own it

- **What:** Onboarding seeds the `BRAND-01` elements. After that, a tenant's colors, logo and look are
  edited on the console with no engineer involved.
- **Why:** Follows from entry 1.
- **Date:** 2026-09-23.
- **Status:** In effect.
- **Removed from the PRD (verbatim):**
  - In `TEN-05`, "and the set-once branding elements in `BRAND-01`" became "and seeding the set-once branding elements in `BRAND-01`".
  - Added after that paragraph:
    > **Revised 2026-09.** Onboarding *seeds* the `BRAND-01` elements; it does not own them afterwards. Once a tenant exists, its colors, logo and look are edited on the admin surface by OBS staff or the tenant's own admins (`BRAND-01`, `ADM-03`), with no engineer involved.

### 3. `BRAND-02` and §8.1: the field-by-field split, sponsor records, and no free square

- **What:** The field-by-field split that §8.1 says "a separate document will define" is
  [`branding-field-split.md`](branding-field-split.md). Every sponsor asset belongs to a sponsor record
  (`TEN-04`) and is placed at games slot by slot. The free square logo and text are deferred: the board
  has no free square, so those fields would render nothing.
- **Why:** §8.1 promised the document. The free square needs a game-rules change first.
- **Date:** 2026-09-23.
- **Status:** In effect.
- **Removed from the PRD (verbatim):**
  - §8.1, replacing "A separate document will define the exact field-by-field assignment to each category. This PRD establishes the split and the rule for deciding.":
    > The exact field-by-field assignment to each category is [`branding-field-split.md`](branding-field-split.md). This PRD establishes the split and the rule for deciding; that document applies it.
  - Added after `BRAND-02`'s list:
    > Every sponsor asset belongs to a sponsor record (`TEN-04`), and a sponsor is placed at games slot by slot — field-by-field in [`branding-field-split.md`](branding-field-split.md). **The free square is deferred (2026-09):** the board has no free square, so a free-square logo and text would render nothing; they arrive with a free-square game mechanic, which is a game-rules change rather than a branding one.

### 4. `BRAND-04`: team self-serve shipped, and neither category is hardcoded

- **What:** A tenant's own admins manage their per-game elements too (`ADM-03`), and the set-once
  elements are no longer hardcoded (entry 1).
- **Why:** Follows from entries 1 and 5.
- **Date:** 2026-09-23.
- **Status:** In effect.
- **Removed from the PRD (verbatim):**
    > **Revised 2026-09.** Team self-serve shipped (`ADM-03`): a tenant's own admins manage their per-game elements too. And neither category is hardcoded any longer — see `BRAND-01`.

### 5. `ADM-02`, `ADM-03`, §15.1 and §15.4: tenant admins can edit their own tenant

- **What:** A tenant's `org:admin` edits everything in its own workspace and configuration: games and
  contests, prize tiers, sponsors and placements, signup fields and opt-ins, and its sponsors' export
  field scope, for its own organization only. A tenant's `org:member` keeps `ADM-02`'s read-only view.
  Contest finalization, the internal fan-actions export, fan-data deletion and anything cross-tenant
  stay with OBS staff.
- **Why:** Nick's ruling of 2026-09-16, relayed by Arthur (vault decision D-063). It replaced
  D-062 of the same day, which had kept tenant admins read-only.
- **Date:** 2026-09-16 (ruling), written into the PRD 2026-09-23.
- **Status:** In effect.
- **Removed from the PRD (verbatim):**
  - §15.1 table, "Team users" row: "Can do in V1" gained "**Revised 2026-09:** a team's admins also make the same changes themselves and pull their own reports and exports (`ADM-03`)", and "Can do later" became "—".
  - Added after `ADM-02`:
    > **Revised 2026-09.** Read-only is now the *member* role. A tenant's admins hold write access (`ADM-03`).
  - `ADM-03`'s tag changed from `[FUTURE]` to `[V1, revised 2026-09 — was FUTURE]`, and this was added after it:
    > **Revised 2026-09 (product-owner ruling).** Shipped: a tenant's `org:admin` writes everything in its own workspace and configuration — games and contests, prize tiers, sponsors and their placements, signup fields and opt-ins, and its sponsors' export field scope — for its own organization only. A tenant's `org:member` keeps `ADM-02`'s read-only view. Contest finalization, the internal fan-actions export, fan-data deletion and anything cross-tenant stay with OBS staff.
  - §15.4 acceptance criterion: "and cannot view any other tenant's data or edit anything." became "and cannot view any other tenant's data. A team member cannot edit anything; a team admin can edit their own tenant's configuration and nothing else (revised 2026-09)."

---

## Contests and prizes

### 6. `GAME-02`: prize tiers belong to a contest, not to a game

- **What:** A contest spans one or more games, and its tiers apply to every game in it. Tiers that
  differ between two games are two contests.
- **Why:** A board, its lock and its prize snapshot are per contest. Per-game tiers inside one contest
  would give one board two prize ladders.
- **Date:** 2026-09-24 (Arthur's ruling).
- **Status:** In effect. Spec: [`admin-contests.spec.md`](../../spec/core-modules/1-draft/admin-contests.spec.md).

### 7. `GAME-02`: the 1–3 tier cap stays for bingo; tiers point at library prizes

- **What:** A bingo contest keeps `GAME-02`'s 1–3 tiers. Each tier names a prize from the tenant's
  prize library (Nick's model, 2026-09-27). A prize carries its "Provided by" sponsor and an optional
  claim button and code. A finalized contest keeps the prizes it was finalized with: editing a prize
  later never changes a finalized contest.
- **Why:** Arthur adopted Nick's prize library on 2026-09-27. The console mock had no tier limit; the
  cap was kept because the PRD specifies it.
- **Date:** 2026-09-27.
- **Status:** In effect, except the 1–3 cap, superseded on 2026-09-30 by entry 34. Spec:
  `admin-prizes.spec.md` (on `arthur-console-redesign`).

### 8. `GAME-02`: approximate value and the redemption fields are dropped

- **What:** A prize has no approximate value, redemption window, redemption method or redemption
  location. The console does not offer them and nothing shows them. A prize is what the prize popup
  and the prize email show: name (the fan-facing title), description, image, claim instructions, an
  optional button, an optional code, and the sponsor credit. The stored fields stay in the data model
  unused.
- **Why:** Nothing renders or acts on those fields. Arthur ruled that the console must not offer
  anything as if it worked when it doesn't.
- **Date:** 2026-09-28 (Arthur's ruling, made knowingly against `GAME-02`'s field list).
- **Status:** In effect. Not yet raised with Nick. Spec: `admin-prizes.spec.md` (on
  `arthur-console-redesign`). It supersedes the parts of our specs on `main` that model or show these
  fields (`prize-delivery.spec.md`'s details list, `contest-safety.spec.md`'s value lock).

### 9. Prize types (pick up, code, link, shipped)

- **What:** Our console specs added a prize type that decided a prize's fields and delivery, with
  shipping ("ships within N days"), pick-up and code flows.
- **Why:** It was our reading of the tier fields in `GAME-02` and `PRIZE-05`.
- **Date:** 2026-09-24, carried onto the prize library 2026-09-27.
- **Status:** Superseded on 2026-09-28 by "no prize type" (entry 8 and entry 10): a prize is one flat
  form, and email is the only channel.

### 10. `PRIZE-04`: one generic prize email, not one template per prize

- **What:** Prizes go out as one standard email template driven by the prize's data. There is no
  template per prize and no per-sponsor template. Email is the only delivery channel.
- **Why:** Arthur's ruling: the template is generic and driven by data, never developer-built per
  prize or per sponsor. Other channels are for Nick to add if he wants them.
- **Date:** 2026-09-24, confirmed 2026-09-28.
- **Status:** In effect.

### 11. `PRIZE-05` and `PRIZE-06`: sponsor coupon batches are deferred

- **What:** There is no coupon-batch model and no per-sponsor fulfillment code yet. A prize may carry
  one optional static code, which every winner of that prize receives. Batches of unique codes, and
  `PRIZE-06`'s no-duplicate rule, arrive when the first sponsor supplies a batch.
- **Why:** No sponsor has supplied a code batch yet, so its format is unknown.
- **Date:** 2026-09-24, confirmed 2026-09-28.
- **Status:** In effect. The `[V1]` tags on `PRIZE-05` and `PRIZE-06` are read as deferred until a
  sponsor needs them.

### 12. `PRIZE-02`: deferred-delivery timing is not reserved on the tier

- **What:** The prize tier no longer reserves a per-tier delivery-time field. When `PRIZE-02` is
  built, its timing belongs to the contest (Nick's trivia spec, `TRV-32`, makes "send prizes" a
  contest-level step).
- **Why:** The reserved field was refused on write and nothing could honour it.
- **Date:** 2026-09-27.
- **Status:** In effect. Spec: `admin-prizes.spec.md` (on `arthur-console-redesign`).

### 13. `PRIZE-01`: a bingo can never lose its prize

- **What:** Bingos are counted from the same prop states that draw the fan's board, by one shared
  function used by the fan app, the server, standings and Game day. Prizes are awarded by a reconciler
  that compares each board's bingos with the tiers already awarded and makes any missing award once.
  It runs when props change, when a board is created or read, and on a periodic sweep.
- **Why:** The bingo counter disagreed with what boards showed. A missed event, a late join or downtime
  must never lose a bingo or a prize.
- **Date:** 2026-09-28.
- **Status:** In effect.

### 14. `GAME-01`: every sport and every upcoming game can be picked

- **What:** Every bet event that exists in the PES game feed and hasn't started can be picked for a
  contest, whatever the sport. The picker has a sport filter fed by the sports the feed actually has.
- **Why:** The contest picker showed only NFL, and Nick could not pick a college football game.
- **Date:** 2026-09-27, confirmed 2026-09-28.
- **Status:** In effect.

### 15. `ADM-03` and `ADM-04`: contest states, and tenants may delete contests

- **What:** A contest is Draft, Open or Closed (one state replaces the separate visible and entries
  switches). Tenant admins may delete any contest that isn't finalized, after typing its name.
  Finalized contests stay.
- **Why:** Arthur's rulings on the console redesign: remove redundant controls, and tenant contest
  deletion is in scope.
- **Date:** 2026-09-27.
- **Status:** In effect. The first version also asked for re-authentication once fans had joined; that
  part is superseded by entry 20. Spec: `admin-contests.spec.md` (on `arthur-console-redesign`).

---

## Opt-ins, sponsors and exports

### 16. `OPT-05`: opt-in documents live in the app

- **What:** Every opt-in may carry its own document (Terms, Privacy, marketing terms, a sponsor's
  data-sharing agreement), stored with the opt-in, edited in the console, and shown inside the fan app
  over the entry gate. Nothing links out of the app, and Back returns with no lost progress. Every
  published version's wording is kept. The opt-in "categories" our specs had added are retired: an
  opt-in is linked to a sponsor or it isn't.
- **Why:** Terms and Privacy opened in a new browser tab, taking the fan out of the gate. The
  categories drove no behaviour.
- **Date:** 2026-09-27.
- **Status:** In effect. Specs: `admin-fields-and-optins.spec.md`, `spec/webapp/entry-gate.spec.md`.

### 17. `OPT-06`: what "don't build" covers

- **What:** `OPT-06`'s "do not implement mid-season consent prompting" applies only to per-game
  sponsor-rotation reconciliation. A changed consent text (`OPT-05`) and a newly required signup field
  (`AUTH-02`) are both asked for at the fan's next entry.
- **Why:** The PRD and the identity HLD otherwise read as contradicting each other. Nick confirmed this
  reading via Arthur.
- **Date:** 2026-09-10 (vault decision D-056).
- **Status:** In effect.

### 18. `RPT-04` and `SEC-02` (and `BRAND-03`): several agreements per sponsor

- **What:** A sponsor may hold more than one data-sharing agreement. A sponsor export is run per
  agreement, and the agreement, grouped by sponsor, is picked in Exports. Each sponsor placement slot
  shows one sponsor at a time: one for the whole contest, optionally a different one for a single game.
- **Why:** Arthur's rulings on the console redesign and on Exports.
- **Date:** 2026-09-27, confirmed 2026-09-28.
- **Status:** In effect. Specs: `admin-sponsors.spec.md`, `admin-exports.spec.md`.

### 19. `BRAND-02`: artwork is uploaded, not typed as a URL

- **What:** Every asset field (sponsor artwork, prize images, brand images) takes a file upload, by
  drag and drop or by browsing, never a typed URL alone.
- **Why:** Arthur's ruling on the console redesign.
- **Date:** 2026-09-27.
- **Status:** In effect. Spec: `admin-uploads.spec.md` (on `arthur-console-redesign`).

---

## Access, security and platform

### 20. `ADM-01` and `SEC-08`: MFA at sign-in, no extra re-authentication

- **What:** The console keeps mandatory MFA at sign-in (`ADM-01`). The extra step-up
  re-authentication before destructive or data-revealing actions is removed for everyone. Destructive
  actions keep a type-the-name confirmation.
- **Why:** Arthur's ruling after walking the console.
- **Date:** 2026-09-28.
- **Status:** In effect. It supersedes vault decision D-060 (2026-09-15), which had made step-up
  server-enforced and on by default, and the identity HLD's `IDN-13` step-up.

### 21. `AUTH-04`: no auth-variant control in the console yet

- **What:** The per-tenant sign-in variant control (email, phone, or both) is removed from the console
  until phone sign-in exists. Every tenant signs fans in with email.
- **Why:** Phone sign-in (`AUTH-04`) is `[FUTURE]`, so the control offered a choice that did nothing.
- **Date:** 2026-09-24.
- **Status:** In effect.

### 22. `SEC-04`: no "origins must be https" boot check

- **What:** The backend's production boot check that refused non-https allowed origins is deleted. It
  stays deleted until Arthur or Nick asks for it back. Every other production boot check stays.
  `SEC-04`'s requirement (encryption in transit) itself is unchanged.
- **Why:** Every deployed stack is a dev stack that runs in production mode with localhost origins,
  so the check stopped their API from booting. There is no production deployment yet (entry 24).
- **Date:** 2026-09-28 (backend commit `d2a80fe`).
- **Status:** In effect.

### 23. `SEC-07`: deleting a fan removes their sign-in identity

- **What:** When deleting a fan removes their last tenant membership, their fan sign-in (Clerk)
  identity is deleted too. A fan who still belongs to another tenant keeps it.
- **Why:** Otherwise a deleted fan can sign back in and reappear as a new join.
- **Date:** 2026-09-21 (vault decision D-070).
- **Status:** In effect; approved, build pending.

### 24. §2 Background: the platform is not in production

- **What:** The B2B platform is not deployed live and has no customers on it yet; all work treats it
  as dev only. §2 lists UND as "launched March 2026"; that text is left as Nick wrote it.
- **Why:** Arthur's statement of the platform's state.
- **Date:** 2026-09-27.
- **Status:** In effect.

### 25. `BRAND-01`: the onboarding colours live in shared code; the console wears the tenant's accent

- **What:** The set-once team colours (primary, secondary, accent) that the fan app used to carry in
  its own bundle now live once, in `obs-b2b-shared/src/theme/seeds.ts`, and the fan app, backend and
  console all read them. A theme saved on Brand still wins over them. The console's accent follows the
  tenant's hit colour (the colour fans see on bingo-square hits and progress bars); a tenant with no
  colours, or only greys, gets a neutral white accent. The old slug-hash colours are gone.
- **Why:** Arthur's final console walk: bears and fightinghawks had team colours in the fan app that
  the console neither showed on Brand nor wore as its accent.
- **Date:** 2026-09-28 (on `arthur-console-redesign`).
- **Status:** In effect.

### 26. `BRAND-01`: Brand offers only the team colours, light or dark, logo and progress marker

- **What:** The console's Brand page is cut to a minimal baseline: the three team colours BRAND-01
  names, light or dark, the team logo and the progress marker. Type, shape, finish, signature,
  presets and the Overboard gallery are no longer offered to tenants (the server endpoints stay).
  `branding-field-split.md` still lists type, shape, finish and signature; this entry supersedes that
  list for the console.
- **Why:** Arthur's final walk: a clean fallback in case the fan-app overhaul isn't adopted, with
  nothing that could conflict with it.
- **Date:** 2026-09-28 (on `arthur-console-redesign`).
- **Status:** In effect.

### 27. `PRIZE-03`: staff finalize from the workspace's contest screens too

- **What:** Finalize is back on a workspace's contest card and contest page, for Overboard staff only
  (marked Staff), in both the Admin and Member points of view. Tenant admins and members never see it.
  It remains on All contests and the tenant page. Finalization stays Overboard-only.
- **Why:** Arthur's final walk, reversing the Wave 4 walkthrough ruling that kept Finalize on the OBS
  pages only.
- **Date:** 2026-09-28 (on `arthur-console-redesign`).
- **Status:** In effect.

### 28. §15 Administrative surface: staff can delete a support report

- **What:** Overboard staff can delete a report from the OBS support inbox, with a confirmation; the
  deletion is audit-logged. Tenants can't delete reports.
- **Why:** Arthur's final walk.
- **Date:** 2026-09-28 (on `arthur-console-redesign`).
- **Status:** In effect.

### 29. Entry gate (no PRD requirement names it): the Start screen shows no game

- **What:** The fan Start screen shows no matchup or game. Nick's entry-gate spec and identity HLD
  never asked for one; the hardcoded "UNO vs UND" was an early template default, and our later
  data-driven matchup is removed too. The featured game still decides which sponsor presents the
  sign-in screen.
- **Why:** Arthur's final walk: keep it only if Nick wanted it, and he didn't spec it.
- **Date:** 2026-09-28 (on `arthur-console-redesign`).
- **Status:** In effect.

### 30. `BRAND-02`: the Start page's sponsors are a tenant-level list on Brand, not a per-game slot

- **What:** `BRAND-02` lists "sign-in screen logo and tagline" among each game's sponsor assets, and
  `branding-field-split.md` treats sign-in as a per-game placement slot resolved through the tenant's
  featured game. Instead, the Start page's sponsors are now one ordered, tenant-level list that the
  tenant adds to and removes from on Brand. Contests no longer have a Sign-in sponsor slot. The
  sponsor's artwork for it is the "Start page logo" and "Start page tagline". Existing sign-in
  placements were migrated into each tenant's list. "Sign in" still names the real sign-in form.
- **Why:** Arthur's third console walk: the Start page isn't a contest field.
- **Date:** 2026-09-29 (on `arthur-console-redesign`).
- **Status:** In effect. Supersedes the last sentence of entry 29 ("The featured game still decides
  which sponsor presents the sign-in screen").

### 31. `BRAND-01` and `BRAND-02`: the progress marker defaults to a triangle and can be set per game

- **What:** With nothing uploaded, the progress marker is a downward triangle in the tenant's Text
  colour, not the Overboard logo. Besides the tenant's marker on Brand, a tenant can set a marker for
  one game of one contest. What a board shows is decided in one place, in this order:
  1. a sponsor's slider icon on that game
  2. the game's own marker
  3. the Brand marker
  4. the triangle
- **Why:** Arthur's third console walk.
- **Date:** 2026-09-29 (on `arthur-console-redesign`).
- **Status:** In effect.

### 32. `PRIZE-04`: the prize email's platform wording is stored and edited by Overboard staff

- **What:** `PRIZE-04` says prize emails use "a custom HTML template associated with a specific
  prize… template creation and upload is performed by developers." Entry 10 already made it one
  data-driven template for every prize. Its wording that isn't prize data is now stored in the database
  instead of in code, and Overboard staff edit it on All prizes → Email. That wording covers:
  - the default subject
  - the heading
  - the line under the prize
  - the code label
  - the claim-steps heading
  - the sponsor label
  - the footer

  Edits are validated, escaped and audit-logged, with a live preview. A tenant's own sender name,
  reply-to and subject still come first.
- **Why:** Arthur's third console walk: Overboard staff (and Nick) should be able to change the
  email's wording without a deploy.
- **Date:** 2026-09-29 (on `arthur-console-redesign`).
- **Status:** In effect.

### 33. `BRAND-01`: the team's colours are Main, Accent, Text and Button text, with no light or dark mode

- **What:** `BRAND-01` names "team brand colors (primary, secondary, accent)". The tenant now sets
  four colours on Brand:
  - **Main**, the fan app's background
  - **Accent**, for buttons, highlights, bingo hits, progress, and the console's accent
  - **Text**, white or black, default white
  - **Button text**, automatically black or white on Accent, which the tenant can override

  There is no second colour. Light or dark mode is removed: no setting and no label. Cards, surfaces,
  borders, muted text, hit and progress shades, toasts and confetti are derived from these colours, and
  nothing about the fan app's look is hardcoded per tenant. The onboarding colours of the live tenants
  (bears, fightinghawks) were mapped into the new colours, and stored themes were migrated. Theme
  presets and the Overboard gallery are removed, and so are the bundled seeds for tenants that don't
  exist (bbgs, warriors). This supersedes the "light or dark" part of entry 26.
- **Why:** Arthur's third console walk: the colours a tenant sets must be the colours fans see, and
  bears' navy background was hardcoded where no one could edit it.
- **Date:** 2026-09-29 (on `arthur-console-redesign`).
- **Status:** In effect.

### 34. `GAME-02`: a bingo contest has no tier cap; the board is the only limit

- **What:** `GAME-02` says "Each game supports 1–3 prize tiers", and entry 7 kept that cap for bingo.
  It is removed. A bingo contest can have as many tiers as a board can pay: one per bingo count a
  board can finish on. The counts are distinct, each from 1 to the board's lines (8 on the 3×3 board:
  three rows, three columns, two diagonals), and no board finishes on exactly 7, so the most tiers is
  seven. The number is derived in the shared contract from the board's definition, not written down
  anywhere, and the console's Add tier and the fan app's prize bar follow it. Trivia's prize bands are
  a separate system and are unchanged.
- **Why:** Arthur: "There should be no limit on it; this was a spec error. If there's anything it
  should be limited by, it's how many bingos are physically possible."
- **Date:** 2026-09-30.
- **Status:** In effect. Spec: `admin-prizes.spec.md` (`PZ-09`).

### 35. `ADM-03` and the trivia PRD (`TRV-*`): one state rule, bingo open and close times, and trivia's times, questions and lock

- **What:** Several contest rules change together:
  - **One state rule.** A contest's phase is Draft, Upcoming, Open or Closed, decided in one shared
    place. The console's state pill, the fan app's Contests tabs, the server's fan list and the Start
    screen all use it. Upcoming means published but entries aren't open yet. A contest is Closed once
    entries are closed, its close time passes, or it is finalized. A bingo contest closes when its last
    game ends, not at the last tip-off. The console's Status filter gains Upcoming.
  - **Contest page.** The Overview's "Contest state" card is removed. Close entries, Reopen entries and
    Move to draft sit in the page header.
  - **Bingo open and close times.** A bingo contest can have its own open and close times. They only
    narrow the window its games give. Once fans join, the open time locks; the close time can still
    move either way, never into the past or before it opens.
  - **Trivia times.** A blank trivia time never becomes "now". At a game, blank times follow the game's
    tip-off and expected end. On its own, both times are required. One date and time picker replaces
    every date and time field in the console.
  - **Publishing trivia.** A game-day trivia contest can always be published. Its game having started,
    or its close time having passed, never blocks Publish; Review says what publishing late will do.
  - **Enough questions.** Each question tag must hold (slots drawing from it) × (runs per fan)
    questions. Save and Publish check it. A trivia contest that can't run is hidden from fans. The
    question bank refuses an edit that would leave an open or upcoming contest short.
  - **Trivia lock.** Once a fan starts a run, the questions, timing, scoring, runs per fan, game,
    schedule mode, open time and contest type lock. The close time stays free within its rule. Prize
    bands can be added or widened, never removed, narrowed or downgraded. Name, description, banner,
    Presented by sponsor and reveal mode stay free.
  - **Trivia speaks trivia.** Trivia screens and emails speak places, not bingos. Prize emails gain a
    `{rank}` placeholder.
- **Why:** Arthur's rulings: the console, the fan app and the server disagreed about whether a contest
  was upcoming, open or closed; typed trivia times were lost on save; and a trivia contest could go live
  without enough questions for every run.
- **Date:** 2026-10-01.
- **Status:** In effect. Specs: `admin-contests.spec.md`, `contest-safety.spec.md`, `trivia-game-type.spec.md`.
