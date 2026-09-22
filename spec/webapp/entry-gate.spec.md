# Webapp Spec: Entry Gate

**Implements:** PRD `OPT-01`–`OPT-05`, `AUTH-02`, `AUTH-03`. HLD [`multi-tenant-identity-auth.md`](../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-05`–`IDN-07`.

**Depends on:** [`multi-tenant-identity-auth.spec.md`](../core-modules/1-draft/multi-tenant-identity-auth.spec.md) — the membership model, `GET /b2b/membership`, and the join endpoint, all of which are built.

**Status:** Implemented 2026-09-11, merged 2026-09-14 — this spec described shipped behavior. Contracts in [`obs-b2b-shared#1`](https://github.com/everythingparlays/obs-b2b-shared/pull/1), enforcement in [`overboard_sports_backend#3`](https://github.com/everythingparlays/overboard_sports_backend/pull/3), the screen in [`overboard-b2b-template#2`](https://github.com/everythingparlays/overboard-b2b-template/pull/2).

**Superseded in part by entry-gate editor v2 (directive, 2026-09-21, Arthur).** The closed field catalog is retired: a tenant now defines its own typed fields, with the seven platform fields as defaults rather than a boundary, and the gate's page copy is overridable per tenant. The model and its reasoning are in [`admin-fields-and-optins.spec.md`](../core-modules/1-draft/admin-fields-and-optins.spec.md); what changes on *this* screen is Rendering and the acceptance criteria below. **Everything else in this spec stands** — blocking behavior, the two entry points, submission, the 409 discipline, and every existing acceptance criterion are untouched by v2, and a tenant that never opens the new editor sees no change at all.

## Overview

One screen collects everything a fan owes this tenant before they can play: unanswered opt-ins and missing required profile fields.

**The whole change, in one line:** the fan cannot proceed while anything is outstanding, and the same screen serves a first join and a returning fan whose tenant changed what it asks.

The screen already exists in skeleton form as `src/pages/auth/JoinTenant.tsx`, rendered by `ProtectedRoute` when membership resolves to `not-a-member` or to a member with pending consents. What is missing is field rendering, consent recording, and the returning-fan copy.

---

## Two entry points, one screen

| Fan state | Heading | Collects | On submit |
|---|---|---|---|
| Not a member | "Join `<Team>`" | display name, required + optional fields, all opt-ins | `POST /b2b/join` creates the membership |
| Member, something outstanding | "Welcome back" | only what is missing or re-asked | `POST /b2b/consent` and/or a profile update |

Both read from `GET /b2b/membership?tenant=<slug>`, which returns `member`, `pendingConsents`, the tenant's `signupFields`, and (as of v2) its `gateCopy`.

**Why one screen:** a tenant can add a required field or reword an opt-in mid-season. A returning fan then owes something they were never asked, which is the same collection problem as a first join. Splitting them would mean two components drifting apart.

---

## Blocking behavior

**A fan who declines a blocking opt-in, or leaves a required field empty, cannot play** (decision, 2026-09). They stay on this screen. There is no skip, no "remind me later", and no partial-access state.

That is what "blocking" means in `OPT-03`, and the same rule extends to required fields under `AUTH-02` — a required field is blocking by definition.

The server enforces this independently: `POST /b2b/board/generate` returns `409` when a blocking consent is unmet, and the join endpoint refuses to create a membership without one. **The client must not be the only thing enforcing it.** Disabling the submit button is a courtesy that explains the state before the request fails, not the mechanism.

Non-blocking opt-ins are different: the fan may decline and continue. The decline is recorded, and they are not re-asked until that opt-in's `textVersion` changes.

---

## Rendering

**Fields render from `organization.signupFields`, in `order`, each one resolved through `resolveField`** — the definition merged over the well-known defaults for its `fieldId`, with anything explicit on the definition winning. A definition that names a well-known id and sets nothing else renders exactly as it did before v2; a definition that sets a label, a type, or a placeholder gets that instead. An unrecognized id with no type resolves to short text rather than throwing: a gate that renders one field oddly is recoverable, a gate that crashes locks every fan of that tenant out of the product.

**Five types, and each one has one rendering:**

| Type | Renders as |
|---|---|
| Short text | A single-line input |
| Long text | A textarea |
| Date | A single-line input with the platform's date formatting and validity check — the behavior `birthday` always had, generalized |
| Dropdown | A select whose first entry is the field's placeholder, or "Select…" when it has none |
| Checkbox | A checkbox row, where a required field means the box must be ticked |

**Three pieces of per-field copy, each with one fixed place**, so a fan reading two tenants' gates reads them the same way: the **description** sits under the label, the **caption** sits under the input (the slot v1 called the hint, and the slot an error message replaces when there is one), and the **placeholder** is ghost text inside the empty input. None of the three is ever required, and a field with none of them renders exactly as v1 rendered it.

**Labels default from the well-known metadata**, so a tenant that wants "First name" does not have to type it, and `fieldLabel` resolves explicit label, then well-known default, then the id. No field renders that the tenant did not configure — "not shown" is absence from that array, so there is nothing to hide.

Opt-ins render from `pendingConsents`, each with its `text` verbatim. Blocking opt-ins are visually distinguishable from non-blocking; how is open (see below).

Email is never a field on this form. It is mandatory platform-wide (`AUTH-03`), lives on the identity rather than the membership, and is already known from the Clerk session — display it, do not collect it. `email` is also a reserved `fieldId`, so a tenant cannot create a second one that looks like a field.

Changing a tenant's field config must change this form with **no code change and no deploy**. That is `AUTH-02`'s core acceptance criterion and the reason the definitions live in the database. Under v2 that now includes a field the platform has never heard of.

### Page copy

**The membership response carries the tenant's `gateCopy`, and the gate resolves it through `resolveGateCopy`** — seven optional overrides (join heading, join intro, join button, returning heading, returning intro, consents heading, footer note) over the platform defaults in `copy.ts`. A blank or whitespace override is not an override: it falls back to the default, so an admin who clears a box gets the standard wording back and there is no "unset" value to send separately. The returning intro's default is the dynamic sentence that names what actually changed; an override replaces it with a fixed one.

The defaults have exactly one definition, and an override is an argument to the function that reads it — never a second string table the fan app maintains alongside the console's.

**Error messages, the REQUIRED / OPTIONAL / NEW / UPDATED chips, the identity line, and the stale-version notice are not overridable.** Error strings are how the platform tells a fan what went wrong and must not be rewritable into something that says otherwise; the chip vocabulary only means anything because it is the same at every tenant, and a fan who plays at two teams sees both; and the identity line and the stale notice are the platform speaking about its own session and its own conflict handling, not the tenant addressing its fans. The line is between what the tenant is asking of a fan and what the platform is telling the fan about the platform.

**Where the presentation lives (note, 2026-09-16).** The gate's presentation moves to `obs-b2b-shared` — `src/entry-gate/` for the well-known field defaults, field resolution, copy, and client-side validation, `src/ui/entry-gate/` for the form components and their stylesheet — because it now has two renderers. The fan app renders it here, in `JoinTenant.tsx`; the admin console renders it as the live preview on Fields & Opt-ins ([`admin-fields-and-optins.spec.md`](../core-modules/1-draft/admin-fields-and-optins.spec.md)), so that an admin editing this configuration is looking at the gate itself rather than a drawing of it.

**Nothing in this spec's shipped behavior changes.** `JoinTenant.tsx` keeps the whole data layer — Clerk, the membership query, join/consent/profile mutations, the displayed-`textVersion` snapshot, 409 handling — and gives up only its markup. The one user-visible difference is that two default labels, which had drifted between copies, settle on **"Address"** and **"Favorite players"**.

Under v2 that division is unchanged and the data layer gains one line: `JoinTenant.tsx` passes the membership response's `gateCopy` into the form, which resolves it. A field's value is now `string | boolean` rather than `string` — a checkbox's answer is a boolean, and `false` is an answer.

---

## Submitting

Both endpoints validate server-side and will reject what the client accepts; surface those errors rather than assuming success.

- `POST /b2b/consent` — `[{ optInId, textVersion, decision }]`. Send the `textVersion` that was **displayed**, not the current one, so a tenant editing copy mid-session cannot record agreement to wording the fan never saw. The server rejects stale versions; re-fetch and re-ask.
- `POST /b2b/join` — for the not-a-member path, carrying display name, profile fields, and consents together. The membership and its blocking consents must be created atomically; a membership without them is the state the model exists to prevent.

**Every rendered checkbox is submitted, including the ones the fan left alone** (ruling, 2026-09-21). An unchecked box sends `false`; it does not send nothing. A box the fan was shown and chose not to tick is an answer, which is the same reason a declined non-blocking opt-in is recorded rather than dropped — and it is what stops an optional checkbox from being asked again on every single entry for the rest of the season. Required checkboxes are unaffected: `false` is a stored answer that does not satisfy them, so they keep blocking until they are ticked.

Do not navigate on success. The mutation invalidates the membership cache tag and `ProtectedRoute` re-renders into the app — routing manually races that refetch.

---

## Acceptance criteria

- [ ] A fan who has not joined sees "Join `<Team>`" with that tenant's configured fields and all its opt-ins.
- [ ] A tenant configuring no extra fields shows only display name and the opt-ins.
- [ ] A required field left empty blocks submission; an optional one does not.
- [ ] A field the tenant set to "not shown" does not render and is not sent.
- [ ] Declining a blocking opt-in leaves the fan on the screen with no way past.
- [ ] Declining a non-blocking opt-in allows play, and the fan is not re-asked on the next entry.
- [ ] A member whose tenant added a required field mid-season sees "Welcome back" asking only for that field.
- [ ] A member whose tenant reworded an opt-in is re-asked only that opt-in.
- [ ] Changing a tenant's `signupFields` or `optIns` in the database changes the form with no deploy.
- [ ] Email appears as identity, never as an editable field.

Added by v2:

- [ ] A custom field of each of the five types renders correctly and validates correctly: short text and long text accept text, date accepts only a valid date in the platform's format, a dropdown accepts only one of its own options, and a required checkbox blocks until it is ticked while an optional one treats a deliberate "no" as an answer.
- [ ] An optional checkbox a fan is shown and leaves unchecked is stored as `false` and is not asked again on the next entry.
- [ ] A field with a description, a caption, and a placeholder shows each in its own place — description under the label, caption under the input, placeholder inside the empty input — and the caption's slot gives way to the error message when there is one.
- [ ] A legacy definition carrying only `fieldId` and `requirement` renders exactly as it did before v2, label and type resolved from the well-known defaults.
- [ ] A tenant's `gateCopy` override replaces the matching default string, and an override that is blank or only whitespace falls back to the default.
- [ ] **An admin edit that only changes a label, a description, a caption, a placeholder, an options list, the field order, or the page copy re-asks no returning fan anything** — the gate finds nothing outstanding and the fan goes straight in.
- [ ] Deleting a field stops it being asked and stops it being shown, and a fan's previously given answer is not destroyed.

---

## Open questions

- ~~**Visual treatment of blocking vs non-blocking.**~~ **Resolved (2026-09-14, implemented per the mocks):** every field and opt-in carries a REQUIRED or OPTIONAL chip (required fields also get an asterisk), and submitting with something outstanding shows an error summary plus inline red error text on each missing required field and a red-bordered card with its own error line on each unmet blocking consent — an untouched optional item shows no error state at all.
- ~~**Copy for the returning-fan case.**~~ **Resolved (2026-09-14, implemented per the mocks):** the "Welcome back" heading stays, but the subtitle names what actually changed — "`<Team>` has updated the wording of an agreement you'd accepted / added a new opt-in / asked for a little more profile info since your last visit" — and each re-asked card is chipped UPDATED or NEW so a fan is never left wondering whether something went wrong.
- ~~**Changing a previously-declined non-blocking opt-in.**~~ **Decided (2026-09):** not revisitable until that opt-in's `textVersion` changes. A future profile/settings surface is the proper home for changing a standing answer; this gate only ever asks about what is outstanding.
- **Drop-off measurement.** Still open. This screen sits between a fan and playing, and `AUTH-02`'s note for product warns that more required fields reduce conversion. Worth instrumenting, but analytics is unbuilt (`SEC-05` constrains what may be sent).

---

## Mocks

Static screen mocks exist for this flow: [Multi-Tenant Entry Flow](https://claude.ai/code/artifact/fbea3a62-7190-4c69-99bb-6ad264f32f2c) (5 screens, styled per [`styling.spec.md`](styling.spec.md)). They're a starting proposal for the first two open questions above, not an approved decision — react to them and adjust rather than building to them verbatim:

- **Screens 1 & 3 — "Join `<Team>`"** (Bears and Fighting Hawks): required/optional fields and opt-ins on one form, with visibly different `signupFields` per tenant so it's clear the fields are config-driven, not hardcoded.
- **Screen 2 — same form, validation-error state**: one candidate for the blocking-vs-non-blocking question — a missing required field gets inline red error text on submit, and an unmet required (blocking) consent gets a red-highlighted row with its own error line, visually distinct from an untouched optional one.
- **Screens 4 & 5 — "Welcome back"**: one candidate for the returning-fan copy — names what actually changed ("we've updated our Terms of Service" / "added a new sponsor") instead of a bare "Welcome back." Screen 5 also mocks a tenant requiring a new *field* (not just a consent) from existing members mid-season — flagged on the canvas as speculative at the time, since the HLD only defined re-evaluation for opt-ins (`IDN-05`), not `signupFields`. **Resolved (2026-09):** PRD `AUTH-02`'s 2026-09 decision settled it — fields are re-evaluated at entry like opt-ins. Implemented: the membership response carries `pendingFields`, and a missing required field blocks at the board gate just as a blocking consent does.

  **Screen 5 also settled the field model itself (2026-09-21).** The field it mocks is "Shirt size" — a dropdown, with a line under the label explaining why the team needs it and "Select a size" inside the control. None of that was expressible under the closed catalog: not the id, not the type, not the description, not the placeholder. It is the concrete case the v2 model exists to render, and it renders now without a deploy.

**Access:** this is a Claude Artifact, private by default — if Arthur can't open the link, it needs to be shared from the page's share menu first.

---

## References

- [`multi-tenant-identity-auth.spec.md`](../core-modules/1-draft/multi-tenant-identity-auth.spec.md) — membership model, consent evaluation, endpoint contracts, `FieldDefinition`
- [`admin-fields-and-optins.spec.md`](../core-modules/1-draft/admin-fields-and-optins.spec.md) — the v2 field model, the editor that writes it, and the semantic/descriptive split this screen's behavior follows from
- PRD [`AUTH-02`, `AUTH-03`, `OPT-01`–`OPT-05`](../../documents/PRD/OBS_B2B_Platform_PRD.md)
- Mock: `mocks/week1-entry-gate/re consent gate new required field mid season bears.png` (workspace) — the "Shirt size" screen, screen 5 above
- [`styling.spec.md`](styling.spec.md) — tenant theming this screen must follow
- [Multi-Tenant Entry Flow mocks](https://claude.ai/code/artifact/fbea3a62-7190-4c69-99bb-6ad264f32f2c) — see "Mocks" above
