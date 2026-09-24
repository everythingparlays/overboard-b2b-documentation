# Core Module Spec: Admin — Fields & Opt-ins

**Implements:** PRD `ADM-05`, `AUTH-02`, `OPT-01`–`OPT-05`, `TEN-02`. HLD [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-05`–`IDN-07` (the versioned-consent mechanism these edits drive).

**Depends on:** [`admin-surface.spec.md`](admin-surface.spec.md) — `resolveAdminScope`, the permission table, the `/config` nav destination, and the reflect-point principle the live preview implements. [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — the `signupFields` / `optIns` shapes this writes and the field-definition guardrails. [`../../webapp/entry-gate.spec.md`](../../webapp/entry-gate.spec.md) — the fan-side gate that makes an admin edit here reach fans. [`admin-exports.spec.md`](admin-exports.spec.md) — the per-tenant exportable set this screen's field list defines, and the sponsor scopes a field deletion prunes. **`obs-b2b-shared/src/entry-gate/` and `obs-b2b-shared/src/ui/entry-gate/`** — the gate's field resolution, copy, validation, and React components, which this screen renders rather than imitates ([`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md), layer table).

**Status:** Draft. Rewritten for **editor v2** (directive, 2026-09-21, Arthur) — the open field model, the field editor, and page copy. The v1 sections that survive unchanged are marked where it matters; everything about the closed catalog is superseded here and in the three specs listed above.

## Overview

The first real admin feature: the Fields & Opt-ins screen at `/config`, and the `/admin` endpoints that let it read and write a tenant's `signupFields`, `gateCopy`, and `optIns` — replacing the direct database edits that configure them today.

**The whole change, in one line:** a tenant's entry gate — which fields it asks for, how each one is worded, and the page's own copy — becomes editable through the admin surface, with the server owning the `textVersion` bump so re-prompting fans can never be skipped, and with everything cosmetic structurally unable to re-prompt anyone.

**In scope:** the screen, three endpoints (`GET /admin/config`, `PUT /admin/config`, `GET /admin/tenants`), their contracts in `obs-b2b-shared`, permission enforcement, how mid-season change rules apply to admin edits, and **the live entry-gate preview** (ruling 2026-09-16, Arthur) — the fan's view of the draft, rendered from the gate's own components, which brings the gate's presentation layer into `obs-b2b-shared` and out of the fan app. **Tenant write access is in scope as of the 2026-09-16 ruling** — a tenant `org:admin` edits their own organization's fields and opt-ins here; `org:member` views. Two additive fields on `OptInDefinition`: `label` (`OPT-02` names label and text as separately configurable) and `publishedAt` (`ADM-05` — the admin surface changes "how it's tracked").

**Added by v2:** an open field model — a tenant defines its own fields, typed, with the seven platform fields demoted from a boundary to a defaults library; a field editor that can express everything the mocks already show; `B2BOrganization.gateCopy`, seven optional overrides for the gate's page copy; and the obligation model that makes all of that safe (below, "Semantic and descriptive").

**Not in scope:**

- **Export cadence** (`RPT-06`). The mock places a cadence selector on this screen; cadence configures when *exports* are produced, not what signup collects, and no data model for it exists. It belongs to the Exports module — the screen omits it (spec wins over mock).
- **Sponsor records themselves** — [`admin-sponsors.spec.md`](admin-sponsors.spec.md). *(Superseded 2026-09-23: this screen offered no sponsor picker because no sponsor collection existed. It now does: a `kind: "sponsor"` opt-in's drawer has a **Sponsor** picker listing the tenant's sponsors and "Not linked", which sets `sponsorId` — argued in the sponsor spec, `SP-04`.)*
- **Concurrency control.** Publishing is last-write-wins between two concurrent admins. Acceptable at V1's operator count; revisit if OBS staffing grows.
- **`SEC-05`'s IP address and consent method** on `ConsentRecord` — a pre-existing gap in the fan-side record, not something an admin write path can close. Flagged, not fixed here.

---

## The open field model (v2)

**A tenant defines its own fields.** `FieldDefinition` gains a `type` from five values — short text, long text, date, dropdown, checkbox — plus `description`, `caption`, `placeholder`, and `options`. `fieldId` is no longer drawn from a closed enum: it is either one of the seven **well-known ids** (`firstName`, `lastName`, `phone`, `birthday`, `zip`, `address`, `favoritePlayers`) or a slug generated once from the label when the field is created.

**The seven platform fields are now a defaults library, not a boundary.** A definition naming a well-known id inherits that id's label, input type, placeholder, and its format and serialization rules (phone's `tel` handling, zip's, birthday's `MM/DD/YYYY` formatting) unless the definition overrides them. That is the whole of what the closed catalog was mechanically providing, kept; what it was providing as a *rule* is replaced (below).

### Why the closed catalog goes

The v1 argument for a closed catalog was a privacy one: **the platform decides what may ever be collected about a fan, the tenant decides what is.** It reads well. It had already been overtaken on the principle, and it was already failing on the product.

**The 2026-09-16 ruling settled the same question the other way, in this repo, for data that is strictly more sensitive.** That ruling made a tenant `org:admin` the editor of their own sponsor DPA field scope ([`admin-exports.spec.md`](admin-exports.spec.md), `RPT-04` / `SEC-02`) — deciding which fan PII is *released to a third party* under a signed agreement. A platform that trusts a tenant admin to authorize the release of a fan's home address cannot coherently refuse to trust the same admin to ask for a shirt size. The open catalog is not a new responsibility model; it is the ruling's model applied consistently.

**And the catalog was already failing to represent Nick's own mocks.** `mocks/week1-entry-gate/re consent gate new required field mid season bears.png` — the mid-season re-consent screen, drawn before any of this was specced — shows a field called **Shirt size**, rendered as a dropdown, with a line of explanatory copy under the label saying why the team needs it, and "Select a size" inside the control. Four things there are unrepresentable in v1: the id is not in the catalog, the type is not `shortText`, the description has nowhere to live, and neither does the placeholder. The mock is not an aspiration — it is the mid-season case `AUTH-02` and `IDN-05` exist for, and the model could not draw it.

**What replaces the catalog is four guardrails, and they carry more weight than the enum did:**

1. **A typed value set.** Five types, each with a known value shape (`string | boolean`) and a boundary check. A tenant cannot invent a field that stores a blob, a nested object, or an arbitrary payload — the thing an open `Mixed` map would otherwise allow.
2. **Fail-closed export scoping.** Nothing a tenant invents is exportable to a sponsor until a human checks it into that sponsor's scope. An unconfigured scope is a 409, never a default ([`admin-exports.spec.md`](admin-exports.spec.md) Rule 2). The control on third-party release was always the explicit scope; the catalog was a second, weaker copy of it.
3. **Scope pruning on delete.** Deleting a field removes its id from every opt-in's `exportFields`, so a deleted-and-re-added id cannot inherit a scope nobody re-granted (Rule 11).
4. **Reserved ids and unchanged consent machinery.** `email`, `picks`, `gameDate`, and `displayName` may never be a `fieldId`; consent, versioning, audit, and `IDN-08` deletion are untouched — fan values still live in `profileFields` on the membership, so `SEC-07` deletion still removes them wholesale, custom fields included.

### What a custom field means for a DPA

A tenant can now invent a field, so the obvious question is what happens when they invent one that a sponsor wants.

**Nothing automatic happens, and that is the design.** A new field is collectable the moment it is published and **exportable to nobody**. It appears in the sponsor's field-scope checklist on `/exports` as an unchecked row, and it leaves the platform only when someone with `org:admin` ticks it and saves — the same act, through the same screen, under the same DPA framing as ticking `address`. There is no inherited scope, no "new fields default to the sponsor's existing scope", and no scope at all on an opt-in that has never had one (409, "No DPA field scope configured").

That is the honest position for a platform in this shape: OBS does not hold the tenant's DPAs, cannot read them, and could not have vetted a field called "Shirt size" any better than the admin who is looking at the contract. What OBS *can* guarantee is that no fan datum reaches a sponsor without a named human checking a box against that sponsor, that the box is per field and per sponsor, and that the check is in the audit log beside every generation that used it (`SEC-06`). The v1 catalog provided none of that — it constrained what could be *collected*, which was never the step where a DPA is breached.

**Deleting a field prunes the box.** A scope entry cannot outlive the field it names, so an id that comes back has to be re-authorized (Rule 11).

**Re-adding a well-known field reuses its well-known id, deliberately.** Previously collected values come back — same datum, same id, and a fan who already gave their zip code is not asked again. A *custom* field can never take a well-known or reserved id: slug generation dedupes against both (and against the draft's other ids, with `-2`/`-3`). Without that rule a tenant could name a field "First name", take the `firstName` slug, and resurrect dormant values under a definition nobody connected to them.

### Semantic and descriptive (binding invariant)

**A fan's outstanding work is derived, never versioned — for fields.** `missingFields(signupFields, profileFields)` is the tenant's configured fields whose stored value does not *satisfy* the definition, computed fresh on every entry:

- A **required checkbox** is satisfied only by `true`. A required checkbox is an affirmation; an unticked box is not an answer to it.
- An **optional checkbox** is satisfied by either boolean — `false` is an answer, not an absence.
- Everything else is satisfied by a provided value: non-blank string, non-empty array, any other non-null.

**That second rule only terminates because the gate serializes every rendered checkbox explicitly** (ruling, 2026-09-21): a box that was shown and left unchecked submits `false`, not nothing. A box the fan saw and did not tick is an answer — the same semantics as declining a non-blocking opt-in, which is recorded precisely so a declining fan is not asked forever. Without that, an optional checkbox would be the one field a fan can never finish: never ticked, never stored, returned by `missingFields` on every entry for the rest of the season, clearable only by ticking and unticking it. A required checkbox is unaffected and still blocks until it is ticked, because `false` does not satisfy it — the serialization decides what is *stored*, not what counts as satisfied.

**Label, description, caption, placeholder, options, order, every `gateCopy` string, and an opt-in's label and kind appear nowhere in that derivation, nor in consent matching.** Editing them therefore *cannot* re-prompt anyone. That is a property of the model, not a convention someone has to remember — there is no code path by which a cosmetic edit reaches a fan's obligations, because the obligation function never reads those props. Pinned by tests on both the shared package and the backend: edit a label, a description, a caption, a placeholder, or any page copy, publish, and every fan's `pendingFields` and `pendingConsents` are byte-identical and no `textVersion` moves.

This is the answer to the obvious objection to a rich editor — "an admin fixing a typo will re-prompt the whole fanbase." Structurally, that edit cannot.

**What does re-prompt, all through machinery that already exists:**

| Change | Mechanism |
|---|---|
| Adding a field | No stored value → `missingFields` returns it on next entry |
| Optional → required, for fans without a value | Same derivation, now unsatisfied |
| Editing an opt-in's `text` | Server-owned `textVersion` bump; `(optInId, textVersion)` no longer matches |
| Adding an opt-in | Starts at `textVersion: 1`; nobody has a matching record |

**Opt-in text remains the only versioned string on the platform.** It is versioned because `OPT-04`/`OPT-05` need to prove *which wording* a fan agreed to; no field label ever carries that burden, so nothing else needs a version. Adding a second versioned string would mean a second re-prompt trigger to reason about, and the first one is the one that matters legally.

**Dropdown `options` edits are descriptive.** Removing an option does not invalidate the answers already given under it: existing values stand, and option membership is checked at collection time only. The alternative — treating a removed option as making a stored value unsatisfying — would turn trimming a list into a mass re-prompt, and would also, quietly, be the platform second-guessing a fan's own past answer.

**A field's `type` is immutable once published.** `PUT /admin/config` is 400 when a submitted definition keeps an existing `fieldId` but resolves to a different type; the editor enforces the same by offering the type control only on fields that have never been published. Stored answers were written under the old type — a `checkbox` flipped to `dropdown` leaves every `true` in the database meaning nothing, and a `date` flipped to `shortText` silently reinterprets formatted strings. **The path to a different type is delete the field and add a new one**, which gives a fresh id and a fresh, empty value space: the same datum under a new question, asked again, rather than an old answer reinterpreted.

**Deleting a field** leaves stored values on memberships untouched — invisible to the gate, exactly as `ConsentRecord`s survive an opt-in's removal (Rule 5, and `OPT-06`'s dependence on history surviving). It prunes the id from every opt-in's `exportFields`, and it never cascades into fan data.

### Migration: there isn't one

**Existing tenant documents keep working with no change at all.** A v1 definition carries `fieldId`, `requirement`, and maybe `label` and `order` — no `type`, no `description`. Both `type` and `label` are optional on the wire precisely so those documents stay valid: `resolveField` merges a definition over its well-known defaults at read time, so a legacy `{ fieldId: "birthday", requirement: "required" }` resolves to exactly the date field with exactly the label it rendered yesterday.

The editor writes fully-explicit definitions on the next publish, so a tenant converges to v2 shapes the first time an admin touches their config, and not before. **No DB migration, no backfill, and zero fan-visible change until an admin edits something** — which is the same standard the 2026-08 "there is no migration" decision set in the identity spec, met for the same reason: the cheapest migration is a read path that already understands both shapes.

---

## The screen, v3 (ruled 2026-09-24, Arthur)

Arthur's walkthrough ruling reshapes the screen. **Where this section and the v2 sections below disagree, this section wins**; the v2 text stays as the record of what it replaced and why.

**Three tabs across the left column: Sign-up fields · Screen text · Opt-ins.** "Page copy" is renamed **Screen text** everywhere it appears. The sticky live preview stays on the right and follows the tab: the Screen text and Sign-up fields tabs show join mode, Opt-ins shows the consent block in join mode. The tab is kept in the URL (`?tab=fields|text|optins`) so a link and a reload land where the admin was. The draft, Publish and Discard span all three tabs: one publish, one set of consequence notes, each note naming its tab.

**One editing pattern on every tab.** Every item — a field, a screen-text string group, an opt-in — is a row that expands in place into its editor. There is no drawer anywhere on the screen: the v2 opt-ins drawer is gone, because a screen where fields expand inline and opt-ins open a drawer asks an admin to learn two tools for one job.

**Rows (Sign-up fields and Opt-ins).**

- **Collapsed:** a drag handle, the label, the type or kind in plain product language, the Required/Optional (fields) or Required/Optional-to-accept (opt-ins) badge, and a delete button. The row toggles expansion.
- **Drag moves the whole row, visibly.** The row lifts with a shadow and the list makes room as it passes (a sortable list, not a drag image), with pointer, touch and keyboard sensors (space to lift, arrows to move, space to drop, escape to cancel, and a spoken announcement of each step). **The move-up/move-down arrows are gone**; the keyboard sensor is what replaces them for keyboard users. The preview reorders live.
- **Delete sits on the row, replacing the arrows.** It edits the draft (v2's reasoning stands: nothing reaches a fan until Publish, so no confirmation dialog); the consequence note says what the publish will do.
- **Type size is larger than v2** (row label ≥ 15px, editor labels ≥ 14px, helper lines ≥ 13px) and the craft bar is the B2C survey builder: calm spacing, clear focus rings, smooth expand/collapse, no layout jumps.

**Fixed rows.** Two rows cannot be dragged, deleted or retyped, and say so by their shape (a lock glyph where the handle would be, no delete button), not by disabled controls:

- **Display name**, pinned first on Sign-up fields: "Short text · Required · always asked — it's the name on the fan's board." Expanded, it edits its **label and placeholder** (stored as `gateCopy.displayNameLabel` / `gateCopy.displayNamePlaceholder`; blank means the standard wording).
- **Overboard Terms & Privacy**, pinned first on Opt-ins: "Required on every team." Expanded, it shows its text with the two links, read-only, and one line: "Overboard's own terms. Every team asks them, and they can't be edited or removed."

**The email row is removed.** Email is collected when the fan creates their account, before the gate ever shows; listing it among the gate's fields described a question the gate never asks.

**Change a field's type in place.** The expanded field shows Type as a real control on every field, published or not. What a change means depends on whether anyone has answered:

- **Nobody has answered it yet** (the field's `answeredCount` in the stats is 0 — any stored value, a checkbox's explicit "no" included — or it is unpublished): the field keeps its id and simply changes type.
- **Fans have answered it:** their answers were given to a different question, and reinterpreting them as the new type would be wrong. The field is re-keyed — it keeps its place, label and wording but gets a fresh id from `retypedFieldId` in shared (`<base>-<type>`, e.g. `favorite-team-dropdown`; a second retype replaces the suffix rather than chaining it, and a platform field such as `birthday` switched back to its own type gets its own id — and its fans' answers — back). The consequence note says it plainly: "N fans answered this as <old type>. They'll be asked again." The publish carries `retypes: [{ from, to }]`, and the server moves the field in every sponsor's export scope from the old id to the new one, so a signed DPA keeps covering the field it authorised.
- The server enforces the line: a same-id type change is accepted only if no membership has a stored answer for that id; otherwise it is refused ("Fans answered this field while you were editing. Reload to see the change.").

**Dropdown options** are edited as a list of inputs (add, remove, drag to reorder), not a textarea.

**Screen text** keeps its seven strings, grouped by where they appear (Joining · Returning · Consents & footer), each group a row that expands like every other row.

**Empty states** stay honest and short. A tenant with no fields sees the display-name row and an Add field button; with only the Overboard opt-in, the Opt-ins tab shows that row and Add opt-in.

**Read-only for `org:member`** is unchanged in principle (D-059): the same tabs and rows, badges instead of controls, nothing expands into an editor.

## The screen

`/config`, "Fields & Opt-ins", per Nick's 2026-09-14 mock, extended by the v2 directive. **Three cards in the left column — Signup fields, Page copy, Opt-ins — with the sticky preview on the right.** All scoped to the resolved tenant.

### Signup fields card (v2)

**Email stays a static always-required row at the top**, unchanged: it is identity, not a field, and has no setting (`AUTH-03`). Everything below it is the tenant's own list.

**One expandable card per configured field, in draft order.** Array order *is* the order — publish writes `order: i + 1` from position, so the list is the thing being edited rather than a set of numbers to keep consistent. Collapsed, a row shows a drag handle, the resolved label, the type in plain product language ("Short text", "Long text", "Date", "Dropdown", "Checkbox"), a Required/Optional badge, move-up and move-down buttons, and an expand chevron; the row itself toggles expansion.

**Reordering is both a drag and a pair of buttons.** The buttons are the real mechanism — they work with a keyboard, they work on touch, and they are what the tests drive; native HTML5 drag-and-drop on the handle is layered on top for the mouse, hand-rolled rather than bought, because a reorderable list of five to ten rows is not worth a dependency. The preview reorders live either way.

**Expanded, each field offers:** Label, Requirement (Required/Optional), Type, Description, Caption, Placeholder, and — for a dropdown — Options, one per line. Each control carries one dim line in plain product language saying *where the thing it edits appears on the fan's screen*, because that is the only question an admin actually has about the difference between a description, a caption, and a placeholder: the description sits under the label, the caption sits under the input, and the placeholder is the ghost text inside the empty input. For a well-known field the Label input's placeholder shows the platform default and leaving it empty means "use the default", so an admin never has to retype "First name" to keep it.

**Type is a control only on a field that has never been published.** On a published field it is a plain line stating the type and that it was set when the field was created — not a disabled control, by the same reasoning the `org:member` presentation uses: disabled implies temporarily unavailable, and this is permanent by design. The consequence line explains it in one sentence, because "delete it and add it again" is a real, available path and an admin who does not know that will assume the product is broken.

**Delete is instant, at the bottom of the expanded card, and there is no confirmation dialog.** This looks careless and is the opposite. **Delete edits a draft.** Nothing has happened to any fan until Publish, Discard restores the server state wholesale, and the draft is still sitting on screen saying what it will do. A confirmation dialog here would guard the step that costs nothing and would train the admin to click through the one that costs something — the screen already has exactly one deliberate act, and adding a second dilutes it. What *does* appear is a consequence note on the list, in the same slot as the other ones: a deleted published field says that fans' existing answers are kept but no longer shown or asked, which is the true and slightly surprising thing to say.

**The other consequence notes carry over from v1** — a newly required field says how many existing fans will be asked on next entry (the `missingCount` stat), a newly added field says it will be asked on next entry.

**"Add field" appends a new expanded card and focuses its Label input.** At the top of a brand-new card sits a **Suggestions** row — small ghost buttons for whichever well-known fields the tenant is not currently using (First name, Last name, Phone number, Birthday, Zip code, Address, Favorite players). Clicking one turns the card into that well-known instance: its id, its label, its type, its format rules. This is the v1 catalog, reduced to the only thing it was good for — a well-made shortcut for the seven fields most tenants want, placed where someone is already looking for a field rather than standing in front of everyone who wants an eighth.

**The three-state Required / Optional / Hidden control is gone.** "Hidden" was always absence from `signupFields`, so a third radio state existed only because the screen rendered a fixed catalog of seven rows and needed a way to say "not this one". A list you add to and delete from says it better, and says it the same way the opt-ins card already does.

### Page copy card (renamed Screen text in v3)

**Seven labelled inputs, between the fields and the opt-ins:** Join heading, Join intro, Join button, Returning heading, Returning intro, Consents heading, Footer note. Each one's placeholder shows the default this tenant resolves to today, each carries a dim line saying where it appears, and the card's lede says that leaving anything blank uses the standard wording. Blank is unset, whitespace included, on the preview and on publish alike — so clearing a box is how you go back to the default, and there is no separate "reset" affordance to explain.

They are stored on the organization as `gateCopy` and resolved by the gate itself, so the defaults have exactly one definition (`copy.ts`) and an override is a value passed to the same function, never a second string table. The Returning intro's caption notes that the default sentence adapts to what actually changed — an override replaces that adaptation with a fixed sentence, which is a real trade an admin should make knowingly.

**Error messages, the REQUIRED/OPTIONAL/NEW/UPDATED chips, the identity line, and the stale-version notice are not overridable.** They are safety and consistency copy: an error string that a tenant can rewrite is an error string that can be made to say the opposite of what happened, a chip vocabulary that varies per tenant stops meaning anything to a fan who plays at two teams, and the identity line ("Signed in as…") is a claim about the platform's own session, not the tenant's message. The line is drawn at *what the tenant is asking for* versus *what the platform is telling the fan about the platform*.

### Opt-ins card

*v3 replaces the drawer with inline rows (above).* Unchanged from v1. The tenant's opt-ins, each showing label, consent text, kind, Blocking/Non-blocking, current `textVersion` + `publishedAt`, and acceptance stats. Add / edit / remove via a drawer.

### Draft-and-publish

Edits accumulate locally; **Publish changes** sends one `PUT /admin/config`; **Discard** resets to the server state. Before publish, the screen warns about consequences the entry gate will enforce:

- A field newly set to Required → "Newly required — N existing fans will be asked on next entry" (N from the stats below).
- An opt-in whose *text* changed → "Text edited — publishing creates v{n+1} and re-prompts every fan."

A copy edit, a label edit, and a description edit warn about nothing, because there is nothing to warn about — see "Semantic and descriptive".

### Draft persistence (v2)

**The draft survives a reload, in `sessionStorage`, keyed to the user and the tenant.** A v2 draft is a lot of typing — seven copy strings, a description and caption per field — and losing it to a stray refresh or a token bounce is the kind of loss that teaches an admin to publish early and often, which is exactly the habit the draft-and-publish design exists to prevent.

It is **local persistence only, never a backend save.** There is one server-side state for a tenant's config and it is the published one; a server-side draft would be a second thing a fan's gate could, one day, be accidentally read from.

The stored entry is `{ baseline, draft }` — the draft plus the serialized server config it was built on. On mount, after the config fetch, the baseline is compared to the fresh server state: matching, the draft is restored with a dismissible note saying so; not matching, the stored entry is dropped silently. A draft built on a config that another admin has since republished is not a draft, it is a stale overwrite waiting to be published last-write-wins — and the admin who discovers that by reading a note is better off than the one who discovers it by clobbering a colleague. Silent, not a warning: the change happened to someone else's edit, not to theirs, and there is nothing for them to act on beyond making their change again.

It is written through on every draft change, removed on a successful publish and on Discard, and swept on sign-out alongside the console's existing session keys — a half-typed consent description is tenant configuration, and it does not outlive the session that typed it on a shared machine.

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
| `src/entry-gate/` | `fields.ts` — the well-known field defaults, `resolveField`, ordering, and (as of v2) the obligation primitives the server shares: `isProvided`, `isSatisfied`, `missingFields`, `validateProfileFieldValue`. `copy.ts` — every string the gate renders, plus `resolveGateCopy`. `validation.ts` — the gate's client-side validation and the returning-mode CTA gating. | nothing |
| `src/ui/entry-gate/` | `EntryGateForm` (controlled) and `EntryGatePreview` (self-contained, walkable), plus one stylesheet of `obs-gate-*` classes reading the fan theme's CSS variables. | `react` (peer) |

`JoinTenant.tsx` keeps everything that makes it a real gate — Clerk, the membership query, the join / consent / profile mutations, the frozen `textVersion` snapshot, stale-version 409 handling — and renders `EntryGateForm` for its body. The console renders `EntryGatePreview`. Neither owns a copy of the other's markup, so neither can drift from it.

**v2 extends the same argument to the server.** `src/entry-gate/` is React-free and dependency-free, so the backend imports `isProvided`, `isSatisfied`, `missingFields`, and `validateProfileFieldValue` from it rather than keeping the parallel copies `util/entry-gate.ts` grew — which is how "what the gate asks for" and "what the server requires" came to be two implementations of one sentence. One definition, three callers, and the descriptive-edit invariance tests can then be written once against the function everyone runs. The backend imports from `src/entry-gate/` only; `src/ui/` is React and does not compile into the server.

**The field metadata was already duplicated three ways** — `FIELD_META` in the fan app, and `FIELD_LABELS` twice over in the console (`FieldsOptins.tsx` and `Fans.tsx`). The copies had already disagreed: `Full address` against `Address`, and `Favorite players` against `Favorite player(s)`. Single-sourcing resolves them to **"Address"** and **"Favorite players"** — the one fan-visible copy change in this slice, and the concrete evidence for why the two alternatives below were rejected rather than merely disfavoured. Under v2 the same single source becomes `WELL_KNOWN_FIELDS` and `resolveField`, and every label anywhere — gate, preview, fans table, export column header — comes out of `fieldLabel(def)`, which resolves an explicit label, then the well-known default, then the id.

**Rejected: an iframe of the live fan site.** PRODUCT.md holds that the console references the fan product and never embeds it, and three mechanical problems say the same thing: the iframe needs a *fan* session the admin does not have, it cannot bind to an unsaved draft because the fan app reads the server, and what it would therefore show is last publish's truth — the one thing the admin already knows.

**Rejected: a hand-copied re-implementation in console CSS.** The B2C console's equivalent preview is exactly this, and it drifted from the product it previews; the two-label disagreement above is the same failure in miniature, inside this repo, already. A preview that can be wrong is worse than no preview, because it is trusted.

### Binding to the draft

**The preview reads the unsaved draft, not the server.** Keystrokes reflect immediately — no debounce, no save round-trip, no publish. The admin types a label and watches the fan's label change.

**The projection from draft to gate is the same mapping `publish()` already performs** — order taken from position, every per-field property carried through, labels and types resolved through `resolveField` exactly as the fan's gate resolves them, page copy taken from the draft's `gateCopy`. One function, two callers: what the preview shows is what the publish would send. A second mapping written for the preview would be a third copy of the field model by another name.

### Two modes

A segmented toggle over the preview, using the console's existing `Segmented` control:

| Mode | Shows | Assumes |
|---|---|---|
| **Join** | A fan who has never joined: display name, every configured field, every opt-in. | Nothing. |
| **Returning** | An existing fan on their next visit *after this publish*: only what is newly asked — fields added, and fields flipped from optional to required, chipped NEW; opt-ins added, chipped NEW; opt-ins whose text changed, chipped UPDATED. | That existing fans completed everything previously required — the same assumption behind the screen's existing "N existing fans will be asked" counts. |

**Returning mode is the semantic/descriptive split made visible.** It shows exactly what the derivation shows, so a label edit, a description edit, a reordering, an options change, and every page-copy edit leave it settled — not by the preview filtering them out, but because they are not changes to anything the returning gate reads. Pinned by test on both sides: a copy-only draft and a label-only draft both leave the panel settled.

**When Returning has nothing outstanding the panel says so plainly** rather than rendering an empty gate. An empty form is ambiguous between "nothing changed" and "something is broken", and the returning gate is the mode an admin most often wants reassurance about. **The settled state carries a second line telling the admin how to make it show something** — that changing fields or opt-ins is what returning fans get asked about. Without it the first line is honest but unhelpful to the admin who has just spent ten minutes rewriting their page copy and reasonably wants to know whether the preview is working; the second line answers that question in advance, and answers it with the invariant rather than with a reassurance.

**The mode toggle is a `Segmented`, not a pair of buttons, and this does not breach the Chalk Action Rule** ("a screen has at most one chalk button in view" — Publish holds it here). A segmented radiogroup reports which state is selected; it is not a call to action, and nothing about it competes with Publish for the eye. It is also already the idiom on this very screen, where each field's Required / Optional requirement is a segmented control. Inventing a quieter one-off variant to avoid a rule the control does not trip would cost the screen its consistency to buy nothing — one way to do a thing.

### Walkable, not a screenshot

**The admin can type into the preview's fields and tick its consents**, and the CTA behaves exactly as the fan's does:

- **Join mode:** pressing the CTA runs the gate's real validation and shows the gate's real failure state — the error summary, "is required" under each empty required field, and a red-bordered card with its own error line on each unmet blocking consent. It submits nothing.
- **Returning mode:** the CTA is live-disabled with the gate's real helper text until blocking consents are ticked and required fields filled, exactly as the gate disables it.

The point is that a required field's cost is felt, not read about: an admin who marks four fields Required and then fills the form out themselves has learned what `§6.3`'s conversion note is trying to tell them.

**Nothing typed in the preview is saved or sent, and the panel says so** in one line of plain copy. This is a claim the architecture keeps rather than the copy: see Rule 10.

### Identity and branding

**The identity bar shows a sample signed-in email, `fan@example.com`.** The gate displays email as identity rather than collecting it (`AUTH-03`); the preview needs a value there and must never reach for a real fan's.

**The preview renders in the platform's default palette, with the tenant's real name and no logo, and captions nothing about it.** This is not a shortcut — it is the only honest thing available. *Superseded 2026-09-22 by the "Honesty by omission, not by narration" principle in [`admin-surface.spec.md`](admin-surface.spec.md) (Rule 13): this previously required a caption saying the team's colors and logo apply on their own site. The caption is removed — it is a provenance note under a real rendering, which the ruling forbids — and the explanation below stays here in the spec, where it belongs. [`admin-branding.spec.md`](admin-branding.spec.md) reaches the same conclusion from the other direction and makes the underlying gap moot by putting tenant colors server-side.* The backend serves no branding: `GET /admin/config` returns slug and name, and a tenant's colors and logo live compile-time in the fan app's `src/config/tenants/*.ts`, which the console does not and should not read. The default palette is not a stand-in either; it is what a tenant with no colors configured (`test`, today) actually gets.

**Do not hardcode a copy of the tenant palettes in the console.** It would be a second place tenant colors live, updated by hand, drifting exactly as the field labels above already did — and it would buy a preview that looks right while being wrong, which is the failure mode this whole section exists to prevent.

The gap is recorded, not worked around: `multi-tenant-identity-auth.spec.md` already places branding server-side (its "Data Model" section and its route-disposition table) and that is unbuilt. **When branding lands server-side the preview wrapper reads it and the gap closes with no preview code change** — which is why the wrapper takes its variable values from a prop rather than a constant.

### Layout

The two configuration cards stack in the left column; the preview panel sits right, sticky, **at the fan gate's real width** — `max-w-sm` content with 24px side padding, per the auth/onboarding container rule ([`styling.spec.md`](../../webapp/styling.spec.md) §3). A preview at console width would misreport line breaks and button widths, which are most of what an admin is checking.

At the console's existing ≤1100px breakpoint the preview drops below the cards. **No second breakpoint is introduced** — the console has one, and a preview panel is not a reason to start a responsive system.

**The fan theme's variable values are scoped to a `.obs-gate-preview` wrapper, never the document root.** Setting them at `:root` is how the fan app does it, and doing the same here would repaint the console in whatever palette the preview carries. Only gate components render inside the wrapper.

### Tests

- **Admin:** binding tests — edit the draft (set a field Required, reword an opt-in, add one) and assert the preview changes, with no publish and no request. Plus, for v2: a custom field with every property set appears in the preview with all of them; reordering by button reorders the preview; an instant delete removes the field from draft and preview; a label-only edit and a copy-only edit each leave Returning settled; the draft survives unmount and remount and clears on publish and on Discard; a baseline mismatch drops the stored draft; a Suggestions click produces a well-known instance; the type control is absent on a published field.
- **Shared:** component tests for `EntryGateForm` and `EntryGatePreview` — rendering from a config, the validation failure states, and the returning-mode CTA gating; and per-type rendering and validation, `resolveField` merging, copy overrides including blank-falls-back, checkbox serialization (an untouched rendered checkbox submits `false`, and an optional one is then satisfied), and the descriptive-edit invariance tests.
- **Backend:** the invariance tests again at the boundary — a label-only or copy-only publish changes no fan's `pendingFields` or `pendingConsents` and bumps no `textVersion` — because the claim is about the derivation, and the derivation runs on the server.

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

### The v2 field contract

`fieldDefinitionSchema` is the one definition of a field, shared by the admin config contract, the membership contract, and the Mongoose model:

| Property | Rule |
|---|---|
| `fieldId` | 1–64 chars, starts with a letter, letters/digits/hyphens after; never a reserved id (`email`, `picks`, `gameDate`, `displayName`) |
| `type` | One of the five, optional — but required unless `fieldId` is well-known |
| `requirement` | `"required"` or `"optional"` |
| `label` | ≤ 120, optional — but required (non-blank) unless `fieldId` is well-known |
| `description` / `caption` / `placeholder` | ≤ 500 / ≤ 200 / ≤ 120, optional, trimmed |
| `options` | Trimmed non-empty strings, ≤ 100 each, ≤ 50 entries, no duplicates; **required and non-empty when the resolved type is dropdown, and absent otherwise** |
| `order` | Number, optional — written from array position by the editor |

The two "unless well-known" refinements are what make the legacy documents valid and the migration a non-event: an old definition supplies neither `type` nor `label` and is accepted because its id resolves both. A *custom* id supplies both or is rejected, because nothing can resolve them for it.

Options being rejected on a non-dropdown is not pedantry: a list of choices attached to a text field is a statement about how the field behaves that the gate will not honour, and letting it sit in the document means the next reader has to work out which of the two is the truth.

`gateCopyOverridesSchema` is seven optional strings, each ≤ 300, trimmed; an empty string is treated as unset server-side, so the editor's "clear the box to go back to the default" is enforced at the boundary rather than depending on the client to send `undefined`.

### Contracts

**`GET /admin/config` returns** the tenant `{ slug, name }`, `signupFields`, `gateCopy`, full `optIns` (admin sees `kind`, `label`, `publishedAt` — unlike the fan-facing `publicOptInSchema`), and **stats** computed with the same entry-gate helpers the fan surface uses, so the numbers shown are exactly what the gate will do: `memberCount`, per-opt-in `{ accepted, declined, pending }` at the *current* `textVersion`, and per-configured-field `missingCount` (members whose stored value does not satisfy the definition — the N in the newly-required warning). Under v2 that map is keyed by `fieldId` string over the tenant's *configured* set; there is no longer a fixed seven-row catalog to compute it for, and computing it for a field nobody configured would be computing it for a field nobody can name.

**`PUT /admin/config` takes** the desired state — `signupFields` (full replacement, no duplicate `fieldId`s), `gateCopy` (optional; blank values dropped, an empty object unsets the field), and `optIns` as `{ optInId, kind, label?, text, blocking, sponsorId? }` (no duplicate `optInId`s). `sponsorId`: a value links the opt-in to that sponsor, `""` unlinks it, and absence preserves whatever is stored (so an older client cannot strip a link it never saw). A linked id must be one of the tenant's sponsors, only a `kind: "sponsor"` opt-in may carry one, and no two opt-ins may link the same sponsor — each a 400 in plain words (`SP-04`). **`textVersion` and `publishedAt` are not accepted from the client** — see the rules below.

Its 400s, each with a plain message: a duplicate `fieldId`; a reserved id; a custom field missing a label or a type; a dropdown with no options; options on a non-dropdown; and a type change on an existing `fieldId`.

It **prunes every removed field id from every opt-in's `exportFields`, and from every sponsor record's,** before writing, and otherwise preserves `exportFields` exactly as v1 did — the config screen never submits it, and a publish from it must not strip a sponsor's DPA scope. `sponsorId` follows the link rule above ([`admin-exports.spec.md`](admin-exports.spec.md)).

Responds with the updated config plus a `changes` summary — `optInsAdded` / `optInsReworded` / `optInsRemoved`, `fieldsAdded` / `fieldsNowRequired` / `fieldsRemoved` as **string arrays of field ids** rather than counts, and `copyEdited` as a boolean. The arrays are ids because with an open field set a count no longer identifies anything: "2 fields added" was readable when there were seven possible fields and unreadable the moment a tenant has twelve of their own. `copyEdited` is deliberately a bare boolean and deliberately separate from the field arrays — it is the summary's one *descriptive* entry, and the confirmation should say that copy changed without implying anyone will be asked about it.

**A successful publish clears the tenant's in-process org cache.** The gate's tenant lookup is cached for 60 seconds (identity spec, "No `tenantSlug`"), which is invisible everywhere else and conspicuous here: an admin publishes, opens the fan site to check, and sees the old gate. The publish knows exactly which tenant it changed, so it invalidates that entry — the same call the field-scope write makes, for the same reason.

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
7. **A descriptive edit reaches fans without asking them anything.** Rewording a label, adding a description, changing the order, editing the options list, or rewriting the page copy changes what the next fan sees and changes nobody's obligations — fields carry no version, so there is nothing to mismatch on. This is the one mid-season rule with no mechanism behind it, because it is the absence of one.
8. **A deleted field stops being asked and stops being shown, and its answers stay.** They are invisible to the gate, unreachable by an export once the scope is pruned, and still subject to `IDN-08` deletion. Re-adding the same well-known id brings them back into view; a re-added custom field gets a fresh id and does not.

---

## Rules

1. **No admin config handler takes a tenant identifier except the verified OBS `?tenant=` parameter.** A tenant-scoped caller naming any tenant is 403.
2. **`textVersion` and `publishedAt` never cross the wire inbound.** The server derives both.
3. **`fieldId` is tenant-chosen but never arbitrary**: it matches the id pattern, is not a reserved id (`email`, `picks`, `gameDate`, `displayName`), is unique within the tenant's set, and carries a type and a label unless it is a well-known id that resolves both. Violations are 400 on both ends, from one shared zod contract. A custom id is never allowed to collide with a well-known one.
4. **Config writes require obs staff or the organization's own `org:admin`**, enforced server-side; the UI's view-only presentation for `org:member` is UX, not the boundary.
5. **Removing an opt-in never removes consent records.**
6. **The preview renders what the gate renders.** Same components, same stylesheet, same copy, same validation — one definition of each, in `obs-b2b-shared`. A second implementation of any of the four is the drift this feature exists to prevent, whichever side writes it.
7. **The preview binds the unsaved draft through the publish mapping.** The projection from draft to gate config is the function `publish()` uses, not a parallel one, so the preview cannot show something the publish would not send.
8. **The preview never implies branding it cannot know, and never captions what it cannot show.** It renders the platform default palette with the tenant's name and no logo, and says nothing about either (ruling 2026-09-22, admin-surface Rule 13 — the "and says so" caption is removed). No tenant palette is copied into the console.
9. **The fan theme's variables are scoped to `.obs-gate-preview`, never the document root**, and only gate components render inside that wrapper.
10. **The preview cannot reach the network, by construction.** No `fetch`, Clerk, RTK Query, or router import exists anywhere under `obs-b2b-shared/src/ui/`. "Nothing you type here is saved" is then a property of the code rather than a promise in the copy — the data layer stays in `JoinTenant.tsx`, which is the only consumer that has one.
11. **Deleting a field prunes its id from every opt-in's `exportFields`, in the same write.** A field id that no longer exists must not sit in a sponsor's DPA scope waiting for someone to re-create the id and inherit a permission nobody granted. Fail closed: the scope is re-granted by a human or it is not granted.
12. **A descriptive edit cannot change any fan's obligations, and this is enforced by the model rather than by review.** Label, description, caption, placeholder, options, order, `gateCopy`, and an opt-in's label and kind appear in no obligation derivation and in no consent match. Anything that would make one of them matter to `missingFields` or to `pendingConsents` breaks this rule, whatever else it is called.
13. **A published field's type never changes.** 400 on the wire, no control in the editor; delete-then-add is the path. Stored answers were written under the published type and nothing reinterprets them.
14. **The draft lives in the browser or nowhere.** `sessionStorage`, keyed to user and tenant, discarded when its baseline no longer matches the server, cleared on publish, Discard, and sign-out. There is no server-side draft — the only config the server holds is the published one.

---

## Known gaps (recorded, not blocking)

- PRD §7 (`OPT-01` "once, at signup", `OPT-06` "do not implement mid-season consent prompting") predates the 2026-09 mid-season decision that §6/`AUTH-02` and `ADM-05` reflect; the shipped per-entry gate and this spec follow the newer text (contradiction rule: more features + postdates).
- `SEC-05` wants IP + consent method on consent records; `ConsentRecord` has neither.
- Admin Clerk instance configuration (custom permissions, org self-creation off per admin-surface Rule 8) is dashboard work, tracked outside this spec.
- **The preview cannot show a tenant's real colors or logo**, because nothing server-side has them. `multi-tenant-identity-auth.spec.md` already places branding server-side — "Data Model / Today" names its absence on `B2BOrganization` as a structural problem, and the route-disposition table has `GET /b2b/org/:subdomain` returning branding — and it is unbuilt; until then the preview renders the platform default palette and says nothing about the difference (superseded 2026-09-22 by the omission principle in [`admin-surface.spec.md`](admin-surface.spec.md); the caption is removed, and [`admin-branding.spec.md`](admin-branding.spec.md) now closes the underlying gap). There is a tension to settle here and this spec does not settle it: PRD `BRAND-01` is a set-once branding requirement, while the POC baseline records the per-tenant compile-time config as "hardcoded as intended". Which of those V1 follows is **Arthur's call**, and the backlog's standing instruction is not to start `/branding` on a guess. Recorded so the preview's default palette is understood as a consequence of an open question rather than a design choice of its own — recorded here precisely because it is no longer captioned on screen.
- **The preview's Returning mode assumes existing fans completed everything previously required.** It is the same assumption the "N existing fans will be asked" counts already make, and the counts are the accurate number; a fan who somehow owes an older field sees more than the preview showed. Worth naming because the preview is more literally read than a count is.
- **Nothing reviews what a tenant collects.** The open model deliberately moves that judgement to the tenant admin, with the guardrails above; there is no OBS-side flag, report, or approval step for a newly invented field, and if the platform later wants one it is a new surface, not a restoration of the enum. Recorded so that "we decided not to" is distinguishable from "we forgot".
- **A custom field is never renamed, only replaced.** A `fieldId` is generated once from the label and then frozen — editing the label leaves the id alone, which is correct (the id is identity, the label is copy) but means a field's id can drift from its wording over a season. It shows up nowhere fan-facing; it shows up in an export's internals and in stored scope entries, where it is a legibility cost, not a correctness one.
- **`options` has no per-option identity.** An option is its own text, so renaming "Medium" to "M" leaves every fan who answered "Medium" holding a value that no longer matches any current option. Answers stand by design (options are descriptive), and the gate never re-asks — but a report grouping by option will show both. A keyed option model would fix it and is not worth its cost at this size.
- **Draft persistence is per browser session.** `sessionStorage` means a draft does not follow an admin to another tab, another device, or tomorrow morning. That is the deliberate trade against a server-side draft; if admins turn out to want a config they can leave half-written for a week, that is a different feature with a different data model, and it should be specced as one rather than grown out of this.

## References

- PRD: [`ADM-02`, `ADM-03`, `ADM-05`, `AUTH-02`, `AUTH-03`, `BRAND-01`, `OPT-01`–`OPT-06`, `TEN-02`, `RPT-06`, `SEC-05`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- HLD: [`multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-05`–`IDN-07`
- HLD: [`b2b-shared-deps.md`](../../../documents/HLDs/b2b-shared-deps.md) — the layer table, including `src/entry-gate/` and `src/ui/` and what each may depend on
- `obs-b2b-shared/src/entry-gate/` (`fields.ts`, `copy.ts`, `validation.ts`) and `obs-b2b-shared/src/ui/entry-gate/` (`EntryGateForm`, `EntryGatePreview`, the `obs-gate-*` stylesheet) — the gate this screen previews, and the obligation primitives the server shares
- [`admin-surface.spec.md`](admin-surface.spec.md) — access framework this builds on, and the **Fan's-eye view** principle plus the reflect-point inventory this is the first instance of
- [`admin-exports.spec.md`](admin-exports.spec.md) — the per-tenant exportable set derived from this screen's field list, and the sponsor scopes a deletion prunes
- [`multi-tenant-identity-auth.spec.md`](multi-tenant-identity-auth.spec.md) — `FieldDefinition` on the organization, and Rule 7's validation of submitted values against the tenant's configured set
- [`../../webapp/entry-gate.spec.md`](../../webapp/entry-gate.spec.md) — the fan-side behavior these edits drive
- [`../../webapp/styling.spec.md`](../../webapp/styling.spec.md) — the `max-w-sm` auth container the preview renders at
- Mock: `mocks/admin-console/Fields-Opt-ins.png` (workspace) — layout source; cadence selector deliberately not implemented
- Mock: `mocks/week1-entry-gate/re consent gate new required field mid season bears.png` (workspace) — the "Shirt size" dropdown with per-field explanatory copy; the evidence the closed catalog could not draw the product
