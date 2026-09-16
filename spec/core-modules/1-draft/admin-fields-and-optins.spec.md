# Core Module Spec: Admin — Fields & Opt-ins

**Implements:** PRD `ADM-05`, `AUTH-02`, `OPT-01`–`OPT-05`, `TEN-02`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-05`–`IDN-07` (the versioned-consent mechanism these edits drive).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the permission table, the `/config` nav destination, and the reflect-point principle the live preview implements. [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — the `signupFields` / `optIns` shapes this writes and the closed field catalog. [`../../webapp/entry-gate.spec.md`](../../webapp/entry-gate.spec.md) — the fan-side gate that makes an admin edit here reach fans. **`obs-b2b-shared/src/entry-gate/` and `obs-b2b-shared/src/ui/entry-gate/`** — the gate's catalog, copy, validation, and React components, which this screen renders rather than imitates ([`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md), layer table).

**Status:** Draft.

## Overview

The first real admin feature: the Fields & Opt-ins screen at `/config`, and the `/admin` endpoints that let it read and write a tenant's `signupFields` and `optIns` — replacing the direct database edits that configure them today.

**The whole change, in one line:** a tenant's signup-field and opt-in configuration becomes editable through the admin surface, with the server owning the `textVersion` bump so re-prompting fans can never be skipped.

**In scope:** the screen, three endpoints (`GET /admin/config`, `PUT /admin/config`, `GET /admin/tenants`), their contracts in `obs-b2b-shared`, permission enforcement, how mid-season change rules apply to admin edits, and **the live entry-gate preview** (ruling 2026-09-16, Arthur) — the fan's view of the draft, rendered from the gate's own components, which brings the gate's presentation layer into `obs-b2b-shared` and out of the fan app. **Tenant write access is in scope as of the 2026-09-16 ruling** — a tenant `org:admin` edits their own organization's fields and opt-ins here; `org:member` views. Two additive fields on `OptInDefinition`: `label` (`OPT-02` names label and text as separately configurable) and `publishedAt` (`ADM-05` — the admin surface changes "how it's tracked").

**Not in scope:**

- **Export cadence** (`RPT-06`). The mock places a cadence selector on this screen; cadence configures when *exports* are produced, not what signup collects, and no data model for it exists. It belongs to the Exports module — the screen omits it (spec wins over mock).
- **Sponsor records.** `OptInDefinition.sponsorId` stays on the wire as an optional pass-through, but no sponsor collection exists yet, so the UI offers no sponsor picker. The `kind: "sponsor"` value is what marks a sponsor opt-in for now.
- **Concurrency control.** Publishing is last-write-wins between two concurrent admins. Acceptable at V1's operator count; revisit if OBS staffing grows.
- **`SEC-05`'s IP address and consent method** on `ConsentRecord` — a pre-existing gap in the fan-side record, not something an admin write path can close. Flagged, not fixed here.

---

## The screen

`/config`, "Fields & Opt-ins", per Nick's 2026-09-14 mock. Two cards, scoped to the resolved tenant.

**Signup fields.** Every catalog field (`firstName`, `lastName`, `phone`, `birthday`, `zip`, `address`, `favoritePlayers`) rendered as a three-state choice — Required / Optional / Hidden (`AUTH-02`; "Hidden" is absence from `signupFields`). Email renders as a static always-required row — it is not in the catalog and has no setting (`AUTH-03`). The card carries the `§6.3` product note verbatim in spirit: every additional required field lowers signup conversion — surfaced at the point of configuration, not documented elsewhere.

**Opt-ins.** The tenant's opt-ins, each showing label, consent text, kind, Blocking/Non-blocking, current `textVersion` + `publishedAt`, and acceptance stats. Add / edit / remove via a drawer.

**Draft-and-publish.** Edits accumulate locally; **Publish changes** sends one `PUT /admin/config`; **Discard** resets to the server state. Before publish, the screen warns about consequences the entry gate will enforce:

- A field newly set to Required → "Newly required — N existing fans will be asked on next entry" (N from the stats below).
- An opt-in whose *text* changed → "Text edited — publishing creates v{n+1} and re-prompts every fan."

**Read-only for `org:member` (ruling, 2026-09-16).** An `org:admin` — tenant or obs — gets the interactive screen for the org in context. An `org:member` sees the same layout rendered as a **view-only presentation**, state badges instead of interactive controls, with one line of explanation that their role views this configuration rather than edits it. Not disabled controls: disabled implies a temporarily unavailable action, and this is a role, not a state. **The presentation is keyed per control off the role claim**, not per screen — which is what the earlier version of this paragraph anticipated when it said the split would flip per control, and what makes a future per-control difference cost nothing structurally.

**OBS tenant selection.** An OBS caller acting outside a tenant org names no tenant, so the tenant being acted on comes from the **sidebar switcher** (admin-surface spec, "Frontend") — one console-wide choice that applies to every screen. With nothing chosen, `/config` shows the "Pick a tenant" empty state, fed by the same `GET /admin/tenants`; choosing there sets the same console-wide selection. The wire is unchanged: the request names the tenant explicitly as `?tenant=<slug>`, including when the operator is acting on their own active tenant org. A non-obs user's `/config` never carries the parameter.

---

## Live preview (ruling 2026-09-16, Arthur)

**The screen shows the fan's entry gate beside the configuration that produces it, live against the unsaved draft.** An admin who sets `phone` to Required and rewords the sponsor opt-in is making a change to a screen they otherwise never see; the only way to know what they built today is to publish it and go look. That is a publish used as a preview, on a screen whose whole design is draft-and-publish precisely so that publishing is deliberate. The preview removes the reason to publish speculatively.

This is the first instance of the admin-surface spec's **Fan's-eye view** principle, and the flagship for the rest of the inventory recorded there.

### Same pixels by construction

**The preview does not imitate the gate; it renders the gate.** The gate's presentation moves into `obs-b2b-shared` in two layers, and both the fan app and the console render the same code:

| Layer | Holds | Depends on |
|---|---|---|
| `src/entry-gate/` | `fields.ts` — the signup field catalog metadata (label, input type, ordering rules). `copy.ts` — every string the gate renders. `validation.ts` — the gate's client-side validation and the returning-mode CTA gating. | nothing |
| `src/ui/entry-gate/` | `EntryGateForm` (controlled) and `EntryGatePreview` (self-contained, walkable), plus one stylesheet of `obs-gate-*` classes reading the fan theme's CSS variables. | `react` (peer) |

`JoinTenant.tsx` keeps everything that makes it a real gate — Clerk, the membership query, the join / consent / profile mutations, the frozen `textVersion` snapshot, stale-version 409 handling — and renders `EntryGateForm` for its body. The console renders `EntryGatePreview`. Neither owns a copy of the other's markup, so neither can drift from it.

**The catalog metadata was already duplicated three ways** — `FIELD_META` in the fan app, and `FIELD_LABELS` twice over in the console (`FieldsOptins.tsx` and `Fans.tsx`). The copies had already disagreed: `Full address` against `Address`, and `Favorite players` against `Favorite player(s)`. Single-sourcing resolves them to **"Address"** and **"Favorite players"** — the one fan-visible copy change in this slice, and the concrete evidence for why the two alternatives below were rejected rather than merely disfavoured.

**Rejected: an iframe of the live fan site.** PRODUCT.md holds that the console references the fan product and never embeds it, and three mechanical problems say the same thing: the iframe needs a *fan* session the admin does not have, it cannot bind to an unsaved draft because the fan app reads the server, and what it would therefore show is last publish's truth — the one thing the admin already knows.

**Rejected: a hand-copied re-implementation in console CSS.** The B2C console's equivalent preview is exactly this, and it drifted from the product it previews; the two-label disagreement above is the same failure in miniature, inside this repo, already. A preview that can be wrong is worse than no preview, because it is trusted.

### Binding to the draft

**The preview reads the unsaved draft, not the server.** Keystrokes reflect immediately — no debounce, no save round-trip, no publish. The admin types a label and watches the fan's label change.

**The projection from draft to gate is the same mapping `publish()` already performs** — hidden fields dropped, order taken from position, labels carried where set and catalog defaults otherwise. One function, two callers: what the preview shows is what the publish would send. A second mapping written for the preview would be a third copy of the catalog by another name.

### Two modes

A segmented toggle over the preview, using the console's existing `Segmented` control:

| Mode | Shows | Assumes |
|---|---|---|
| **Join** | A fan who has never joined: display name, every configured field, every opt-in. | Nothing. |
| **Returning** | An existing fan on their next visit *after this publish*: only what is newly asked — opt-ins whose text changed, chipped UPDATED; opt-ins added, chipped NEW; fields newly required. | That existing fans completed everything previously required — the same assumption behind the screen's existing "N existing fans will be asked" counts. |

**When Returning has nothing outstanding the panel says so plainly** rather than rendering an empty gate. An empty form is ambiguous between "nothing changed" and "something is broken", and the returning gate is the mode an admin most often wants reassurance about.

**The mode toggle is a `Segmented`, not a pair of buttons, and this does not breach the Chalk Action Rule** ("a screen has at most one chalk button in view" — Publish holds it here). A segmented radiogroup reports which state is selected; it is not a call to action, and nothing about it competes with Publish for the eye. It is also already the idiom on this very screen, where every catalog field is a Required / Optional / Hidden segmented control. Inventing a quieter one-off variant to avoid a rule the control does not trip would cost the screen its consistency to buy nothing — one way to do a thing.

### Walkable, not a screenshot

**The admin can type into the preview's fields and tick its consents**, and the CTA behaves exactly as the fan's does:

- **Join mode:** pressing the CTA runs the gate's real validation and shows the gate's real failure state — the error summary, "is required" under each empty required field, and a red-bordered card with its own error line on each unmet blocking consent. It submits nothing.
- **Returning mode:** the CTA is live-disabled with the gate's real helper text until blocking consents are ticked and required fields filled, exactly as the gate disables it.

The point is that a required field's cost is felt, not read about: an admin who marks four fields Required and then fills the form out themselves has learned what `§6.3`'s conversion note is trying to tell them.

**Nothing typed in the preview is saved or sent, and the panel says so** in one line of plain copy. This is a claim the architecture keeps rather than the copy: see Rule 10.

### Identity and branding

**The identity bar shows a sample signed-in email, `fan@example.com`.** The gate displays email as identity rather than collecting it (`AUTH-03`); the preview needs a value there and must never reach for a real fan's.

**The preview renders in the platform's default palette, with the tenant's real name and no logo**, under a caption saying the team's colors and logo apply on their own site. This is not a shortcut — it is the only honest thing available. The backend serves no branding: `GET /admin/config` returns slug and name, and a tenant's colors and logo live compile-time in the fan app's `src/config/tenants/*.ts`, which the console does not and should not read. The default palette is not a stand-in either; it is what a tenant with no colors configured (`test`, today) actually gets.

**Do not hardcode a copy of the tenant palettes in the console.** It would be a second place tenant colors live, updated by hand, drifting exactly as the field labels above already did — and it would buy a preview that looks right while being wrong, which is the failure mode this whole section exists to prevent.

The gap is recorded, not worked around: `multi-tenant-identity-auth.spec.md` already places branding server-side (lines ~44 and ~162) and that is unbuilt. **When branding lands server-side the preview wrapper reads it and the gap closes with no preview code change** — which is why the wrapper takes its variable values from a prop rather than a constant.

### Layout

The two configuration cards stack in the left column; the preview panel sits right, sticky, **at the fan gate's real width** — `max-w-sm` content with 24px side padding, per the auth/onboarding container rule ([`styling.spec.md`](../../webapp/styling.spec.md) §3). A preview at console width would misreport line breaks and button widths, which are most of what an admin is checking.

At the console's existing ≤1100px breakpoint the preview drops below the cards. **No second breakpoint is introduced** — the console has one, and a preview panel is not a reason to start a responsive system.

**The fan theme's variable values are scoped to a `.obs-gate-preview` wrapper, never the document root.** Setting them at `:root` is how the fan app does it, and doing the same here would repaint the console in whatever palette the preview carries. Only gate components render inside the wrapper.

### Tests

- **Admin:** binding tests — edit the draft (set a field Required, reword an opt-in, add one) and assert the preview changes, with no publish and no request.
- **Shared:** component tests for `EntryGateForm` and `EntryGatePreview` — rendering from a config, the validation failure states, and the returning-mode CTA gating.

---

## Endpoints

All under `/admin`, admin Clerk instance only, scope from `req.adminScope` (admin-surface spec Rule 1). Contracts in `obs-b2b-shared/src/api/admin/` (`config.ts`, `tenants.ts`), composed from the existing `fieldDefinitionSchema` — not duplicated.

| Method | Path | Auth | Who |
|---|---|---|---|
| GET | `/admin/tenants` | `requireAdmin` + obs staff | OBS only — the chooser list, `{ slug, name }[]` |
| GET | `/admin/config` | `requireAdmin` | Any resolved admin scope (`ADM-02` read) |
| PUT | `/admin/config` | `requireAdmin` + obs staff or tenant `org:admin` | The tenant's own admins, or OBS on any tenant |

**Tenant targeting** — the admin-surface spec's explicit-and-verified exception, in full:

- **Not obs staff**: the target is the caller's own organization. A `?tenant=` parameter is **403**, even naming their own tenant — a caller who is not obs staff may never name a tenant.
- **Obs staff**: `?tenant=<slug>` is **required** (400 without it), resolved by `B2BOrganization.subdomain`; 404 when it names nothing, 404 for reserved slugs (`obs`, `admin`). This holds whatever organization they have active — an obs staffer inside a tenant org still sends the parameter, defaulted to that org.

**`GET /admin/config` returns** the tenant `{ slug, name }`, `signupFields`, full `optIns` (admin sees `kind`, `label`, `publishedAt` — unlike the fan-facing `publicOptInSchema`), and **stats** computed with the same entry-gate helpers the fan surface uses, so the numbers shown are exactly what the gate will do: `memberCount`, per-opt-in `{ accepted, declined, pending }` at the *current* `textVersion`, and per-catalog-field `missingCount` (members without a provided value — the N in the newly-required warning, real for every field whether currently configured or not).

**`PUT /admin/config` takes** the desired state — `signupFields` (full replacement, catalog-validated, no duplicate `fieldId`s) and `optIns` as `{ optInId, kind, label?, text, blocking, sponsorId? }` (no duplicate `optInId`s). **`textVersion` and `publishedAt` are not accepted from the client** — see the rules below. Responds with the updated config plus a `changes` summary (`optInsAdded` / `optInsReworded` / `optInsRemoved`, `fieldsAdded` / `fieldsNowRequired` / `fieldsRemoved`) so the UI can confirm what actually happened.

---

## Permissions

`org:tenant_config:manage` is held by tenant `org:admin` and every obs role as of the 2026-09-16 ruling (admin-surface spec Rule 3); `org:member` holds the read grant only. The server enforces this **structurally**, as it always has — the allow-list on a write route is now **obs staff, or an `org:admin` of the organization being written**, and anyone else gets 403 with a view-only message. Cross-tenant writes remain obs-only: a tenant admin's allow is scoped to their own organization by construction, because the only tenant they can name is the one their session resolves to.

**Why not `requirePermission("org:tenant_config:manage")` today:** unchanged by the ruling. Clerk custom permissions exist only once created in the dashboard, and the admin instance's roles still do not carry them — `has()` would return false for *everyone*, OBS included, making the write path dead on arrival while looking like an authorization design. The structural check implements the identical grant table without the unprovisioned dependency, and the role claim it now reads is one Clerk already puts in the session token. `requirePermission` remains the upgrade path: when the instance's roles gain the permission deliberately, enforcement moves there (already wired in `route_config.ts`) and the structural check remains as defense in depth for the cross-tenant `?tenant=` path, which stays OBS-only regardless.

---

## Mid-season rules, as they apply to admin edits

The fan-side machinery (entry-gate spec) already re-prompts on `(optInId, textVersion)` mismatch and asks for missing fields on next entry. Admin edits must *drive* that machinery, never bypass it:

1. **The server owns `textVersion`.** A publish that changes an opt-in's `text` increments `textVersion` and stamps `publishedAt`; the client cannot send either. The bump "that must never be skipped" (multi-tenant spec Rule 4) is structural, not a convention.
2. **Only `text` bumps.** Editing `label`, `kind`, `blocking`, or `sponsorId` changes nothing about what the fan agreed to, so prior consents stand. Flipping blocking ↔ non-blocking takes effect at each fan's next entry through the existing gate (`OPT-03`'s config-only acceptance criterion).
3. **A new opt-in** starts at `textVersion: 1` with `publishedAt` now; every member is pending it on next entry (`IDN-05` — the "sponsor added mid-season" case, already free).
4. **A removed opt-in** leaves the active set; fans' `ConsentRecord`s for it are never deleted (`OPT-04` is an audit record, and `OPT-06` depends on history surviving).
5. **A field newly required** is asked on next entry and blocks play until provided; newly optional is asked but never blocks (`AUTH-02`). No admin-side mechanism needed — `missingFields` already evaluates per entry.
6. **A publish mid-fan-session is safe.** The fan surface rejects stale `textVersion`s with 409 and the fan re-fetches — the admin edit cannot record agreement to wording the fan never saw.

---

## Rules

1. **No admin config handler takes a tenant identifier except the verified OBS `?tenant=` parameter.** A tenant-scoped caller naming any tenant is 403.
2. **`textVersion` and `publishedAt` never cross the wire inbound.** The server derives both.
3. **`fieldId` comes from the closed catalog**; unknown or duplicate ids are 400, on both ends (shared zod contract).
4. **Config writes require obs staff or the organization's own `org:admin`**, enforced server-side; the UI's view-only presentation for `org:member` is UX, not the boundary.
5. **Removing an opt-in never removes consent records.**
6. **The preview renders what the gate renders.** Same components, same stylesheet, same copy, same validation — one definition of each, in `obs-b2b-shared`. A second implementation of any of the four is the drift this feature exists to prevent, whichever side writes it.
7. **The preview binds the unsaved draft through the publish mapping.** The projection from draft to gate config is the function `publish()` uses, not a parallel one, so the preview cannot show something the publish would not send.
8. **The preview never implies branding it cannot know.** It renders the platform default palette with the tenant's name and no logo, and says so. No tenant palette is copied into the console.
9. **The fan theme's variables are scoped to `.obs-gate-preview`, never the document root**, and only gate components render inside that wrapper.
10. **The preview cannot reach the network, by construction.** No `fetch`, Clerk, RTK Query, or router import exists anywhere under `obs-b2b-shared/src/ui/`. "Nothing you type here is saved" is then a property of the code rather than a promise in the copy — the data layer stays in `JoinTenant.tsx`, which is the only consumer that has one.

---

## Known gaps (recorded, not blocking)

- PRD §7 (`OPT-01` "once, at signup", `OPT-06` "do not implement mid-season consent prompting") predates the 2026-09 mid-season decision that §6/`AUTH-02` and `ADM-05` reflect; the shipped per-entry gate and this spec follow the newer text (contradiction rule: more features + postdates).
- `SEC-05` wants IP + consent method on consent records; `ConsentRecord` has neither.
- Admin Clerk instance configuration (custom permissions, org self-creation off per admin-surface Rule 8) is dashboard work, tracked outside this spec.
- **The preview cannot show a tenant's real colors or logo**, because nothing server-side has them. `multi-tenant-identity-auth.spec.md` (lines ~44 and ~162) already places branding server-side and it is unbuilt; until then the preview renders the platform default palette and captions the difference. There is a tension to settle here and this spec does not settle it: PRD `BRAND-01` is a set-once branding requirement, while the POC baseline records the per-tenant compile-time config as "hardcoded as intended". Which of those V1 follows is **Arthur's call**, and the backlog's standing instruction is not to start `/branding` on a guess. Recorded so the preview's caption is understood as a consequence of an open question rather than a design choice of its own.
- **The preview's Returning mode assumes existing fans completed everything previously required.** It is the same assumption the "N existing fans will be asked" counts already make, and the counts are the accurate number; a fan who somehow owes an older field sees more than the preview showed. Worth naming because the preview is more literally read than a count is.

## References

- PRD: [`ADM-02`, `ADM-03`, `ADM-05`, `AUTH-02`, `AUTH-03`, `BRAND-01`, `OPT-01`–`OPT-06`, `TEN-02`, `RPT-06`, `SEC-05`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-05`–`IDN-07`
- HLD: [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the layer table, including `src/entry-gate/` and `src/ui/` and what each may depend on
- `obs-b2b-shared/src/entry-gate/` (`fields.ts`, `copy.ts`, `validation.ts`) and `obs-b2b-shared/src/ui/entry-gate/` (`EntryGateForm`, `EntryGatePreview`, the `obs-gate-*` stylesheet) — the gate this screen previews
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework this builds on, and the **Fan's-eye view** principle plus the reflect-point inventory this is the first instance of
- [`../../webapp/entry-gate.spec.md`](../../webapp/entry-gate.spec.md) — the fan-side behavior these edits drive
- [`../../webapp/styling.spec.md`](../../webapp/styling.spec.md) — the `max-w-sm` auth container the preview renders at
- Mock: `mocks/admin-console/Fields-Opt-ins.png` (workspace) — layout source; cadence selector deliberately not implemented
