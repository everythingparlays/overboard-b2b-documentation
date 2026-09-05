# OverBoard Sports — B2B Platform PRD

**Status:** Draft for spec-driven development
**Owner:** Nick Depies, OverBoard Sports
**Last updated:** August 2026
**Version:** 2

---

## How to Read This Document

Every requirement is labeled with a scope tag and a stable ID:

| Tag | Meaning |
| --- | --- |
| **[V1]** | Build this now. Part of initial launch. |
| **[FUTURE]** | Do not build now. Listed so the data model and architecture don't foreclose it. |
| **[CONSTRAINT]** | Not a feature — a rule that shapes how V1 requirements are built. |

Requirement IDs (e.g. `TEN-03`) are stable references. Use them when writing specs, tickets, or tests.

Acceptance criteria are written to be verifiable. If a criterion can't be tested as written, treat that as a gap and raise it rather than guessing.

---

## 1. Product Overview

**What it is:** A multi-tenant, white-labeled version of the OverBoard Sports fan-engagement game, licensed to sports teams as a sponsorship activation tool.

**How it works for a fan:**
1. Fan arrives at the team's branded app (`[teamname].overboardsports.com`)
2. Fan signs up, agreeing to terms and any configured opt-ins
3. Fan drafts their favorite players from the live game
4. System auto-generates a bingo board of prop tiles tied to those players' real game stats
5. Tiles fill in live as real game stats occur
6. Three-in-a-row unlocks a tiered sponsor prize, delivered to the fan

**Who the customers are:** Sports teams (the tenant) and their sponsors. Teams license the platform; sponsors fund it and receive fan data and brand exposure in return.

**What the customer gets:**
- Verified fan email collection
- Prolonged, measurable sponsor exposure (vs. seconds-long traditional stadium ads)
- Player preference data
- Post-game retargeting capability

---

## 2. Background

- OBS started as a direct-to-consumer (D2C) mobile app where users play fantasy-style bingo games across sports.
- This B2B product is a lightweight, white-labeled derivative of that app, built for a single team's fans rather than a general consumer audience. It shares code with the D2C app (game engine, board generation, live stats integration) but is a distinct product surface with its own branding, signup flow, and sponsor layer per tenant.
- **First signed client:** University of North Dakota (UND) Men's Hockey, launched March 2026.
- **In progress:** Minnesota Wild, CardsHQ (nationwide presenting-sponsor proposal), plus inbound interest from Buffalo Wild Wings, Vegas Golden Knights, and St. Louis FC.
- **Pricing model:** flat fee.

**The core scaling risk:** OBS is a small team with a growing client list. If each new team requires bespoke engineering work, the business doesn't scale. Reducing per-tenant engineering effort is a first-class requirement, not a nice-to-have.

---

## 3. Glossary

| Term | Definition |
| --- | --- |
| **Tenant** | A team that licenses the platform. One tenant = one team = one slug/subdomain. |
| **Slug** | The tenant's subdomain identifier, e.g. `lakers` in `lakers.overboardsports.com`. |
| **Sponsor** | A brand funding the activation for a tenant. One tenant can have many sponsors; one sponsor can work with many tenants. |
| **Prop tile** | A single square on the bingo board representing a stat threshold (e.g. "Player X: 10+ rebounds"). |
| **Board** | The 3x3 grid of prop tiles generated from a fan's drafted players. |
| **Prize tier** | A configured prize level (1–3 per game), each with its own difficulty target and reward. |
| **Opt-in** | A discrete, named consent a fan can accept or decline at signup (e.g. "share my data with Coca-Cola"). Separate from ToS/Privacy Policy acceptance. |
| **DPA** | Data Processing Agreement. The contract governing what fan data a specific sponsor may receive. |
| **Contest finalization** | A manual action marking a game's contest complete. Triggers deferred prize delivery. |
| **Tenant config** | The set of stored settings defining a tenant's branding, signup fields, opt-ins, games, sponsors, and prizes. |

---

## 4. Scope Summary

### In scope for V1

| Area | Requirement IDs |
| --- | --- |
| Tenant provisioning & slug routing | TEN-01 – TEN-05 |
| Signup, auth, and configurable fields | AUTH-01 – AUTH-04 |
| Opt-in consent management | OPT-01 – OPT-06 |
| Branding & sponsor asset configuration | BRAND-01 – BRAND-04 |
| Game & prize configuration | GAME-01 – GAME-04 |
| Prize delivery | PRIZE-01 – PRIZE-07 |
| Reporting & exports | RPT-01 – RPT-07 |
| Security & data privacy | SEC-01 – SEC-08 |
| Observability & error monitoring | OBS-01 – OBS-05 |

### Explicitly out of scope for V1

| Item | Why deferred | Reference |
| --- | --- | --- |
| Internal admin UI for tenant/game/prize config | Config changes made directly against the database by an engineer until built | TEN-05 |
| Per-tenant choice of primary auth method | Email + Google sufficient for current clients | AUTH-04 |
| Mobile app credential passthrough (D2C → B2B) | Directional only | AUTH-04 |
| Additional game types (scratch-off, pick-3, over/under) | Separate PRD when prioritized | Section 12 |
| Shared homepage / games-list UI | Design not yet specified | Section 12 |
| Favorite players aggregate report | No confirmed customer demand | RPT-07 |
| Dashboard-based reporting | Raw file exports sufficient for V1 | RPT-07 |
| End-of-game (deferred) prize delivery | Data model must anticipate; behavior not built | PRIZE-02 |
| Per-game consent reconciliation | Opt-ins collected once at signup in V1 | OPT-06 |
| Full legal/compliance checklist | Tracked in dedicated compliance doc | Section 10 |
| Native mobile app | Current product is a mobile-optimized web app | — |

---

## 5. Tenant Provisioning & Routing

**Customer need:** A team signs a contract and expects their own branded game app, live at their own web address, without a long implementation project.

### 5.1 Requirements

**TEN-01 [V1] — Unique tenant slug.**
Every tenant has a required, unique slug reachable at `[teamname].overboardsports.com`. Subdomain routing is the chosen approach; teams value this level of customization and it is a differentiator.

**TEN-02 [V1] — Configuration-driven tenants.**
Tenant-specific data — signup fields, opt-ins, sponsor scheduling, prize/game selection — is stored as configuration data, not embedded in per-team code branches or forks.

Exception: set-once tenant branding elements (see BRAND-01) may be hardcoded per tenant at onboarding, since they don't change during a season and hardcoding lets them render faster. This exception applies only to elements explicitly listed under BRAND-01.

**TEN-03 [V1] — Bounded onboarding effort.**
Onboarding a new tenant requires no more than **1–2 hours of engineering time**. This excludes time spent gathering branding and configuration information from the customer, which is a sales/account-management activity.

**TEN-04 [V1] — Many-to-many sponsors and tenants.**
The system supports multiple sponsors per tenant and the same sponsor across multiple tenants (e.g. Coca-Cola sponsoring both UND and the Wild) without duplicated setup work.

**TEN-05 [V1] — Config management, engineer-operated.**
For V1, tenant configuration is created and updated **directly against the database by an engineer**. A self-serve admin UI is [FUTURE]. The config data model must be structured cleanly enough that adding that UI later does not require restructuring the data.

### 5.2 Acceptance Criteria

- [ ] A new tenant can be provisioned — slug live, branding applied, config populated — through a documented, repeatable process taking ≤2 hours of engineering time.
- [ ] Two tenants' configurations are fully independent; changing one has no effect on the other.
- [ ] One tenant's traffic load (e.g. a sold-out hockey game) does not degrade another tenant's app.
- [ ] The same sponsor record can be associated with multiple tenants without re-entering sponsor data.

### 5.3 Constraints

**TEN-C1 [CONSTRAINT] — Prefer configuration over per-tenant code.**
Where a requirement could be met either by a config field or by a team-specific code change, use the config field. Per-tenant code is acceptable only where explicitly called out: set-once branding elements (BRAND-01) and per-sponsor prize fulfillment logic (PRIZE-05).

**TEN-C2 [CONSTRAINT] — Shared game engine.**
Board generation, live stat evaluation, and win detection are shared platform logic used by all tenants. Tenant-specific work is limited to configuration, branding, sponsor assets, and prize definitions.

---

## 6. Signup & Authentication

**Customer need:** Teams and sponsors want verified fan contact data. Fans want to start playing quickly. These pull against each other — every extra required field reduces conversion.

### 6.1 Requirements

**AUTH-01 [V1] — Supported signup methods.**
Fans can sign up via email (headless email auth) and Google sign-in. Both are available at launch.

**AUTH-02 [V1] — Configurable signup fields.**
Each tenant configures which fan data fields appear at signup and how each behaves. Each field is set to one of three states:
- **Required** — shown, and signup cannot complete without it
- **Optional** — shown, but signup can complete without it
- **Not shown** — omitted from the form entirely and not collected

The available field set includes: first name, last name, email, phone number, birthday, zip code, full address, favorite players. The set is closed — a tenant chooses which of these to collect and cannot introduce new ones, so what may ever be collected about a fan is a platform decision subject to review rather than a per-tenant one.

**Fields may be added mid-season** (decision, 2026-09). A tenant is not limited to what it configured before launch. A fan who already joined and is missing a newly-required field is asked for it on their next entry, on the same screen that surfaces changed opt-ins (see `OPT-05`) — not on a separate flow and not at signup, which has already happened for them. A newly-added *optional* field is collected the same way but never blocks.

This makes required fields behave like blocking opt-ins: outstanding items are evaluated when a fan arrives, not only when they first sign up.

**AUTH-03 [V1] — Email is always collected and required.**
Email is mandatory for every tenant and cannot be disabled — it is the delivery channel for prizes and the core asset sponsors are paying for. All other fields are tenant-configurable.

**AUTH-04 [FUTURE] — Extended auth options.**
Not built in V1, but the auth approach must not foreclose:
- Additional sign-in providers (e.g. Apple)
- Per-tenant selection of which methods are offered and which is primary (one tenant may want email primary, another phone-number-based auth)
- Credential/session passthrough from the D2C OverBoard Sports mobile app, so an already-signed-in fan doesn't re-authenticate

**Design note (2026-08) — per-tenant method selection is not free.** Per-tenant sign-in method selection is satisfied by **two fan Clerk instances sold as product variants** (email-primary, phone-primary), a tenant's choice fixed for a season — not by a per-tenant config lookup. See [`documents/HLDs/multi-tenant-identity-auth.md`](../HLDs/multi-tenant-identity-auth.md) `IDN-09`.

Two instances exist regardless of tenant count, so `TEN-03` and `TEN-C1` hold: onboarding *selects* a variant, it does not provision infrastructure. The cost is paid elsewhere: **Clerk enforces identity uniqueness per instance, so the two variants are separate identity namespaces.** A fan of a phone-primary team *and* an email-primary team has two accounts that cannot be linked — no shared profile, no shared prize history, and they count as two people in any cross-tenant figure.

This is accepted while phone-primary is a niche sale, and is invisible to any fan whose teams sit on one variant. **Revisit if phone-primary becomes the majority variant, or if a material number of fans are expected to follow teams across both** — at that point the trade inverts and a single instance supporting both methods is worth the added complexity.

### 6.2 Acceptance Criteria

- [ ] A fan can complete signup using email, and separately using Google sign-in.
- [ ] Changing a tenant's configured signup fields changes what the signup form renders, with no code change.
- [ ] A field set to required blocks signup completion when empty.
- [ ] A field set to optional allows signup completion when empty.
- [ ] A field set to not shown does not render on the form and is not stored for that tenant's fans.
- [ ] Email cannot be set to optional or not shown for any tenant.
- [ ] A tenant adding a required field mid-season causes existing fans to be asked for it on their next entry, and to be unable to play until they provide it.
- [ ] A tenant adding an optional field mid-season causes existing fans to be asked for it without being blocked.

### 6.3 Note for Product

More required fields reduces fan conversion. When the admin UI is built, this tradeoff should be surfaced at the point of configuration rather than documented elsewhere.

---

## 7. Opt-In Consent Management

**Customer need:** Sponsors are large corporations with real data-governance requirements. A fan's data can only go to a sponsor the fan actually agreed to share with. Different tenants and sponsors will want different consent structures.

### 7.1 Requirements

**OPT-01 [V1] — Multiple discrete opt-ins per tenant, collected at signup.**
A tenant can define one or more named opt-ins, independent of base ToS/Privacy Policy acceptance. There is no fixed limit on the number and no fixed set of allowed purposes. Examples: "share my data with Coca-Cola," "share my data with Cub Foods," "subscribe to the team newsletter."

All of a tenant's opt-ins are presented **once, at signup**. A fan answers them when they create their account and is not asked again. Current clients lock their season sponsors before launch, so signup-time collection covers the full sponsor set.

**OPT-02 [V1] — Per-opt-in configuration.**
Each opt-in is independently configured with its own label, description, and required/optional setting.

**OPT-03 [V1] — Per-opt-in enforcement behavior.**
Each opt-in has its own configurable enforcement behavior, selected from:
- **Blocking** — declining prevents the fan from playing. The fan stays on the opt-in screen; there is no skip, no deferral, and no partial-access state. This is what makes it blocking (decision, 2026-09).
- **Non-blocking** — declining allows play but excludes the fan from whatever that opt-in covers (e.g. that sponsor's data export). The decline is recorded, and the fan is not asked again unless the opt-in's text changes.

Enforcement is never hardcoded for a given opt-in. Different tenants and sponsors will want different behavior, and this must be changeable via configuration.

**OPT-04 [V1] — Per-opt-in response recording.**
Each fan's response to each opt-in is recorded individually — accepted or declined, with a timestamp. A single blended consent flag is not sufficient, because exports must be filterable per opt-in (see RPT-05).

**OPT-05 [V1] — Tenant-configurable consent language.**
ToS/Privacy Policy text and links, and any sponsor-specific consent copy, are configurable per tenant. Different tenants have different sponsors and DPAs requiring different language. A single global consent version is not sufficient.

**OPT-06 [FUTURE] — Per-game consent reconciliation.**
Not built in V1. Do not implement mid-season consent prompting.

Because sponsors rotate between games, a returning fan may eventually encounter a sponsor they never answered an opt-in for at signup. A future version will check a returning fan's recorded consents against the sponsors active at the game they're entering, and prompt only for the gaps.

The V1 requirement that makes this possible later is OPT-04: consent must be stored per fan, per opt-in, with a timestamp. Storing a single blended "consented at signup" flag would make it impossible to tell which sponsors an existing fan actually agreed to, forcing a re-prompt of the entire fan base when this ships.

### 7.2 Acceptance Criteria

- [ ] A tenant can have three or more distinct opt-ins configured simultaneously, each rendering separately at signup.
- [ ] An opt-in configured as blocking prevents signup/play completion when declined.
- [ ] An opt-in configured as non-blocking allows signup/play completion when declined.
- [ ] Switching an opt-in from blocking to non-blocking (or back) requires only a config change, no code change.
- [ ] Querying a fan record returns their individual accept/decline status and timestamp for each opt-in separately.
- [ ] Consent acceptance is stored with timestamp, IP address, and the version of the policy accepted (see SEC-05).

---

## 8. Branding & Sponsor Assets

**Customer need:** The app must look like the team's product, not a third-party tool. Sponsors need their branding present and rotating according to the schedule they paid for.

### 8.1 The Dividing Line

Two categories of visual/config elements, split by how often they change:

| Category | Changes | Owned by | Requirement |
| --- | --- | --- | --- |
| **Set-once tenant elements** | Once, at onboarding | Engineer | BRAND-01 |
| **Per-game elements** | Every game, or between games | Non-engineer via admin | BRAND-02 |

Set-once elements can be hardcoded at onboarding so they render immediately with no config lookup. Per-game elements must be configurable, because they change on a recurring basis and cannot require an engineer each time.

A separate document will define the exact field-by-field assignment to each category. This PRD establishes the split and the rule for deciding.

### 8.2 Requirements

**BRAND-01 [V1] — Set-once tenant elements (engineer-configured).**
Configured once during onboarding, by an engineer. May be hardcoded per tenant so they render fast without a config lookup. Includes:
- Team brand colors (primary, secondary, accent)
- Team logo and naming (official name, abbreviation, mascot)
- App/game naming (e.g. "Wild Bingo")
- Player headshots
- Prize delivery email templates and the delivery mechanics behind them (see PRIZE-04, PRIZE-05)

These do not change over the course of a season. Engineer involvement at onboarding is acceptable and expected.

**BRAND-02 [V1] — Per-game elements (admin-configured).**
Change on a per-game or between-game basis, and must be manageable by non-engineering OBS staff through the admin interface without a code change. Includes:
- Which sponsor(s) are active for a given game
- Sponsor assets for that game: sign-in screen logo and tagline, bingo board banner (clickable, with destination link), free square logo and text, slider icon, prize popup logo, "visit our sponsor" destination URL
- Which prizes and prize tiers are available for that game (see GAME-02)

**BRAND-03 [V1] — Multiple sponsors per game.**
A single game can display assets from more than one sponsor. Teams have been explicit that this should not become visually overloaded, but the platform must support it.

**BRAND-04 [V1] — Admin timing.**
Per-game elements (BRAND-02) are engineer-operated until the admin UI ships (see TEN-05), but must never require a **code change** — only a config change. The distinction matters: BRAND-01 elements may be hardcoded; BRAND-02 elements may not.

### 8.3 Acceptance Criteria

- [ ] Two tenants viewing their respective apps see entirely different colors, logos, and app naming.
- [ ] A tenant's app renders different sponsor assets for two different scheduled games, with no code change between them.
- [ ] A single game can display assets from more than one sponsor.
- [ ] Sponsor banner clicks navigate to the sponsor's configured destination URL.
- [ ] Changing which prizes are available for an upcoming game requires no code change.
- [ ] Changing a tenant's team colors or app name is an onboarding-time activity and may require an engineer.

---

## 9. Game & Prize Configuration

**Customer need:** Teams need to control which games the activation runs at and what fans can win. Sponsors need predictable prize volume — they want fans to walk away with something, but not to blow the budget.

### 9.1 Requirements

**GAME-01 [V1] — Game selection per tenant.**
A tenant configures which games/events the activation runs at, drawn from the games available in OBS's existing event data.

**GAME-02 [V1] — Prize tier configuration.**
Each game supports 1–3 prize tiers. Each tier is configured with: display name, description, approximate value, redemption window, difficulty target (approximate number of winners per game), redemption method, and redemption location.

**GAME-03 [V1] — Difficulty tuning.**
Prize tier difficulty is tunable so OBS and the sponsor can approximately control how many fans win each tier per game. Sponsors have consistently raised predictable redemption volume as a requirement.

**GAME-04 [V1] — Non-engineer game and prize management.**
Which games are active and which prizes/tiers attach to them are **per-game elements** (see BRAND-02). They must be manageable by non-engineering OBS staff through the admin interface once it ships, and must never require a code change. Until the admin UI exists (see TEN-05), these are engineer-operated config changes.

Note the boundary: *which* prizes are available for a given game is per-game admin config. The prize delivery email template and its underlying delivery logic are set-once engineer work (see BRAND-01, PRIZE-04, PRIZE-05).

### 9.2 Acceptance Criteria

- [ ] A tenant can be configured to run at a specific subset of a season's games.
- [ ] A game can be configured with 1, 2, or 3 prize tiers, each with distinct difficulty targets.
- [ ] Adjusting a tier's difficulty target changes the approximate number of winners without a code change.
- [ ] Prize tiers can differ between two games for the same tenant.

### 9.3 Data Source Constraint

**GAME-C1 [CONSTRAINT] — Live game data comes from existing OBS systems.**
The list of available games/events, prop tiles, and live player progress toward prop thresholds (e.g. "2 of 15 projected assists") are maintained by OBS's existing event and live-sports-data system. That data lives in the **same database** as the B2B platform and is kept current by that other system.

The B2B platform reads this shared data. It does not call a separate API for it, and it does not duplicate or re-implement live-data handling. What is newly built here is the tenant-facing configuration layer on top: which games appear for which tenant, and what prizes attach to them.

---

## 10. Prize Delivery

**Customer need:** A fan who wins should receive their prize immediately, while they're still at the game. Sponsors need their coupon codes distributed correctly and their brand represented well in the delivery.

### 10.1 Requirements

**PRIZE-01 [V1] — Real-time delivery.**
When a fan completes three-in-a-row, their prize is delivered immediately, in real time, without waiting for the game to end. This is the primary and only delivery path in V1.

**PRIZE-02 [FUTURE] — Deferred end-of-game delivery.**
For higher-value prizes, OBS will want to hold delivery until the contest is finalized rather than sending in real time. This is a **per-prize-tier** setting, not global — one game may have both real-time small prizes and deferred large prizes. Not built in V1; the prize tier data model must accommodate the setting.

**PRIZE-03 [V1] — Manual contest finalization.**
A person (OBS staff or a designated tenant user) manually triggers contest finalization for a game. Finalization is not inferred automatically from the live sports feed. This action is what will trigger deferred prize sends when PRIZE-02 is built.

**PRIZE-04 [V1] — One HTML template per prize.**
Prize delivery uses a custom HTML template associated with a specific prize. One template per prize; contextual variants for the same prize are not needed. For V1, template creation and upload is performed by developers — no tenant-facing template upload interface is required.

**PRIZE-05 [V1] — Sponsor-supplied coupon codes, custom fulfillment logic.**
Sponsors provide OBS with a range or batch of coupon codes in advance. OBS assigns and sends an unused code from that batch as part of delivery; OBS does not generate codes itself.

Fulfillment logic is written **case-by-case as custom code per sponsor/prize**. This is a deliberate exception to TEN-C1: different sponsors have different redemption mechanics, code formats, and delivery requirements, and forcing a single generic flow is not the goal. Edge-case handling — including what happens if a code batch is exhausted — belongs in that per-sponsor logic, not in shared platform code.

**PRIZE-06 [V1] — No duplicate code assignment.**
The system tracks which coupon codes have been assigned and sent. No code is issued to more than one fan.

**PRIZE-07 [V1] — Failed delivery capture (dead-letter queue).**
Failed or undeliverable prize sends — invalid email, hard bounce, template error — are captured in a dead-letter queue rather than silently dropped, and are reviewable so they can be resolved or resent.

A fan entering a bad email address is not OBS's fault, but accumulated bounces and spam complaints degrade sender reputation, which affects email deliverability for **every** tenant on the platform. This makes failed-send handling a platform-wide concern, not a per-tenant one.

### 10.2 Acceptance Criteria

- [ ] A fan completing three-in-a-row receives their prize email within seconds, during the live game.
- [ ] A prize tier record can carry a delivery-timing setting (real-time vs. deferred), even though only real-time is implemented in V1.
- [ ] A "finalize contest" action exists and is manually triggered by a user.
- [ ] Each prize has exactly one associated HTML template, used at send time.
- [ ] Running the same prize delivery twice never issues the same coupon code to two different fans.
- [ ] A prize send that fails (bad address, bounce, template error) appears in the dead-letter queue with enough context to diagnose it.
- [ ] Failed sends are visible to OBS staff without querying the database directly.

---

## 11. Reporting & Exports

**Customer need:** Sponsors are paying for fan data and proof of engagement. Teams want to know the activation worked. OBS needs its own view of product usage. Each of these audiences gets different data.

### 11.1 Requirements

**RPT-01 [V1] — "Who played" export (sponsor-facing).**
Per game, a roster of fans who participated. Includes at minimum: fan identity/contact fields, game date, and the players/props each fan picked. Delivered as a raw file export (CSV).

**RPT-02 [V1] — Detailed fan-actions export (internal only).**
Granular event-level activity log — tile interactions, near-misses, session activity — for OBS product analysis. Not shared with teams or sponsors.

**RPT-03 [V1] — Consolidated game-over-game usage report.**
Trends and conversion rates across games for a tenant: signup conversion, gameplay conversion, prize-claim conversion.

**RPT-04 [V1] — Per-sponsor field scoping.**
Fields included in a sponsor-facing export are scoped to what that sponsor's DPA authorizes. There is no single fixed export schema shared across all sponsors.

**RPT-05 [V1] — Opt-in-based row filtering.**
Separate from field scoping (RPT-04), exports are filtered **by row** based on each fan's actual opt-in choices:

- A fan who did not opt in to data sharing with a given sponsor is **excluded entirely** from any non-aggregate export going to that sponsor.
- Filtering is per opt-in, per sponsor. A fan who opted in to Sponsor A but not Sponsor B appears in Sponsor A's export and not in Sponsor B's.
- Fans who declined may still be counted in **aggregate-only** data (totals, trends, conversion rates) where no fan-identifying detail is exposed.
- Filtering is enforced at export generation. It is never left to manual review.

**RPT-06 [V1] — Configurable export cadence.**
Export delivery cadence is configurable per tenant: weekly, monthly, or end-of-campaign.

**RPT-07 [FUTURE] — Deferred reporting features.**
Not built in V1:
- Favorite players aggregate report (most-picked players, for team merchandising)
- Dashboard-based reporting as an alternative to raw file exports

### 11.2 Acceptance Criteria

- [ ] Each of the three V1 reports can be generated for a given tenant and game.
- [ ] The internal fan-actions export is not accessible to team or sponsor users.
- [ ] Two sponsors on the same tenant, with different DPA terms, receive exports with different field sets.
- [ ] A fan who declined Sponsor B's data-sharing opt-in does not appear in Sponsor B's "who played" export, but does appear in Sponsor A's if they opted in to A.
- [ ] A declining fan's activity is still reflected in aggregate conversion numbers.
- [ ] Changing a tenant's export cadence changes when exports are produced, with no code change.

---

## 12. Future Game Types

**Customer need:** Teams will want more than one game format over time to keep fans engaged across a long season.

Candidate formats (each requiring its own PRD when prioritized):
- Scratch-off game
- "Pick 3 players" props
- Over/under ("more or less") stat-based picks

**GAME-F1 [CONSTRAINT] — Do not model game type as a single tenant setting.**
Game type must not be stored as "this tenant runs game type X." The architecture should anticipate a **shared homepage/games-list experience** where a tenant's app surfaces multiple available games and the fan chooses one — potentially several game types side by side for the same tenant.

Only the bingo game is built in V1. The constraint here is on the data model and navigation structure, so adding a second game type later doesn't require restructuring.

**Out of scope:** the design and spec of any non-bingo game type, and the detailed design of the shared games-list UI.

---

## 13. Security & Data Privacy

**Customer need:** Sponsors are large corporations. Their legal and security teams will review this platform before signing. Fan data handling has to survive that review.

Full detail lives in the [Fan Data Flow Diagram](https://docs.google.com/document/d/1t-2GDvX-2Kog4SxgIK0Hu5u89Kw_ExrbCtbM7qVrFSI/edit?tab=t.0) and the Pre-Launch Compliance Checklist. This section carries only what shapes platform architecture.

### 13.1 Requirements

**SEC-01 [V1] — Direct fan-data path.**
Fan data flows directly from the fan's browser to OBS's own backend. No third party sees fan PII in transit except where explicitly required (e.g. the auth provider for Google sign-in).

**SEC-02 [V1] — Per-sponsor DPA scoping in the data model.**
The tenant/sponsor config supports field-level export permissions per sponsor. This is a data-model requirement, not only a legal/process one (see RPT-04).

**SEC-03 [V1] — PII exclusion from analytics and monitoring.**
Analytics and error-monitoring tools receive pseudonymous or PII-stripped data only — never fan name, email, phone, or address.

**SEC-04 [V1] — Encryption.**
All connections are encrypted in transit (HTTPS/TLS). Data at rest is encrypted (AES-256).

**SEC-05 [V1] — Consent logging.**
Consent records store timestamp, IP address, policy version accepted, and method of consent. A boolean flag is not sufficient.

**SEC-06 [V1] — Export audit logging.**
Every sponsor data export is logged: who ran it, when, for which sponsor, and how many records.

**SEC-07 [V1] — Data deletion.**
Fan account and gameplay data deletion requests are supported end-to-end, including propagation to analytics tools and the email provider — not just the primary database.

**SEC-08 [V1] — Baseline application and infrastructure hardening.**
The backend, frontend, and supporting infrastructure defend against common attack classes as a baseline engineering standard, not a feature: injection attacks, XSS/CSRF, credential stuffing, unauthorized access to admin/config endpoints, and basic DDoS resilience. Standard practices apply throughout: input validation and sanitization, parameterized queries, secure session and auth handling, and rate limiting on sensitive endpoints. Administrative access to production data is role-restricted and MFA-enforced.

**SEC-09 [V1] — Bot detection and anti-spam.**
Basic protection against automated signups and spam entries is in place at launch (e.g. rate limiting, a CAPTCHA-style challenge at signup). This protects fan data quality and prevents abuse of prize mechanics. V1 can be basic, but the approach must allow more robust bot detection to be layered in later without rework — this is expected to grow in importance as the platform scales.

### 13.2 Acceptance Criteria

- [ ] A fan record can be fully deleted on request, with deletion propagating to analytics and email systems.
- [ ] A consent record contains timestamp, IP, policy version, and consent method.
- [ ] Running an export produces an audit log entry identifying operator, time, sponsor, and record count.
- [ ] Analytics payloads contain no fan name, email, phone, or address.
- [ ] Automated signup attempts at abnormal volume are throttled or challenged.

*(DPA templates, insurance, sweepstakes law, and retention windows are tracked in the dedicated compliance doc, not here.)*

---

## 14. Observability & Error Monitoring

**Customer need:** A sponsor's brand is on screen during a live game in front of thousands of fans. A broken banner or a failed prize send is a relationship risk, not just a bug. OBS needs to catch problems during the game, not learn about them the next day.

### 14.1 Requirements

**OBS-01 [V1] — Real-time error tracking.**
Error tracking covers the fan-facing app, with PII stripped before storage per SEC-03.

**OBS-02 [V1] — Per-tenant error attribution.**
Errors are tagged with tenant ID so issues can be triaged per team and sponsor rather than sifted from global logs.

**OBS-03 [V1] — Live-game alerting.**
Alerting fires on error-rate spikes, with coverage tightest during live game windows. Monitoring that only catches problems outside game hours is insufficient — game windows are exactly when failures matter most.

**OBS-04 [V1] — Pre-game health visibility.**
An OBS team member can determine whether a specific tenant's app is healthy before and during a game, tied to the game schedule.

**OBS-05 [V1] — Prize delivery failure visibility.**
Failed prize sends (PRIZE-07) surface through the same monitoring path, since delivery failure is a sponsor-facing reliability issue.

### 14.2 Acceptance Criteria

- [ ] An error raised in one tenant's app is attributable to that tenant without manual investigation.
- [ ] An error-rate spike during a scheduled game window generates an alert to a defined recipient.
- [ ] A view exists showing per-tenant error rate and health status, reviewable before kickoff.
- [ ] Prize send failures appear in that view alongside application errors.

---

## 15. Open Items

These are unresolved and should be raised rather than assumed:

1. **Export delivery mechanism.** RPT-06 defines cadence, but not how exports reach the sponsor (email attachment, secure download link, SFTP, etc.). Sponsor security teams may have opinions here.
2. **Contest finalization authority.** PRIZE-03 establishes a manual finalize action. Whether tenant users can trigger it or only OBS staff is undecided.
3. **Data retention windows.** SEC-07 covers deletion on request. Automatic retention expiry durations are pending legal counsel confirmation.
