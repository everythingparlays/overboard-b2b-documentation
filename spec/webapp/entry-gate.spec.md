# Webapp Spec: Entry Gate

**Implements:** PRD `OPT-01`–`OPT-05`, `AUTH-02`, `AUTH-03`. HLD [`multi-tenant-identity-auth.md`](../../documents/HLDs/multi-tenant-identity-auth.md) `IDN-05`–`IDN-07`.

**Depends on:** [`multi-tenant-identity-auth.spec.md`](../core-modules/1-draft/multi-tenant-identity-auth.spec.md) — the membership model, `GET /b2b/membership`, and the join endpoint, all of which are built.

**Status:** Draft. Not approved.

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

Both read from `GET /b2b/membership?tenant=<slug>`, which returns `member`, `pendingConsents`, and the tenant's `signupFields`.

**Why one screen:** a tenant can add a required field or reword an opt-in mid-season. A returning fan then owes something they were never asked, which is the same collection problem as a first join. Splitting them would mean two components drifting apart.

---

## Blocking behavior

**A fan who declines a blocking opt-in, or leaves a required field empty, cannot play** (decision, 2026-09). They stay on this screen. There is no skip, no "remind me later", and no partial-access state.

That is what "blocking" means in `OPT-03`, and the same rule extends to required fields under `AUTH-02` — a required field is blocking by definition.

The server enforces this independently: `POST /b2b/board/generate` returns `409` when a blocking consent is unmet, and the join endpoint refuses to create a membership without one. **The client must not be the only thing enforcing it.** Disabling the submit button is a courtesy that explains the state before the request fails, not the mechanism.

Non-blocking opt-ins are different: the fan may decline and continue. The decline is recorded, and they are not re-asked until that opt-in's `textVersion` changes.

---

## Rendering

Fields render from `organization.signupFields`, ordered by `order`, labelled by `label` where set and by the platform catalog default otherwise. No field renders that the tenant did not configure — "not shown" is absence from that array, so there is nothing to hide.

Opt-ins render from `pendingConsents`, each with its `text` verbatim. Blocking opt-ins are visually distinguishable from non-blocking; how is open (see below).

Email is never a field on this form. It is mandatory platform-wide (`AUTH-03`), lives on the identity rather than the membership, and is already known from the Clerk session — display it, do not collect it.

Changing a tenant's field config must change this form with **no code change and no deploy**. That is `AUTH-02`'s core acceptance criterion and the reason the definitions live in the database.

---

## Submitting

Both endpoints validate server-side and will reject what the client accepts; surface those errors rather than assuming success.

- `POST /b2b/consent` — `[{ optInId, textVersion, decision }]`. Send the `textVersion` that was **displayed**, not the current one, so a tenant editing copy mid-session cannot record agreement to wording the fan never saw. The server rejects stale versions; re-fetch and re-ask.
- `POST /b2b/join` — for the not-a-member path, carrying display name, profile fields, and consents together. The membership and its blocking consents must be created atomically; a membership without them is the state the model exists to prevent.

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

---

## Open questions

- **Visual treatment of blocking vs non-blocking.** A required-field marker, grouping, helper text — undecided. Needs a product/design call, and it matters: a fan stuck on this screen must understand *why*.
- **Copy for the returning-fan case.** "Welcome back" is a placeholder. A fan re-asked because legal text changed should probably be told that, rather than left to wonder whether something went wrong.
- **Changing a previously-declined non-blocking opt-in.** There is no profile or settings screen today, so a fan who declines has no way to opt in later without the text changing. Whether that matters is a product decision.
- **Drop-off measurement.** This screen sits between a fan and playing, and `AUTH-02`'s note for product warns that more required fields reduce conversion. Worth instrumenting, but analytics is unbuilt (`SEC-05` constrains what may be sent).

---

## Mocks

Static screen mocks exist for this flow: [Multi-Tenant Entry Flow](https://claude.ai/code/artifact/fbea3a62-7190-4c69-99bb-6ad264f32f2c) (5 screens, styled per [`styling.spec.md`](styling.spec.md)). They're a starting proposal for the first two open questions above, not an approved decision — react to them and adjust rather than building to them verbatim:

- **Screens 1 & 3 — "Join `<Team>`"** (Bears and Fighting Hawks): required/optional fields and opt-ins on one form, with visibly different `signupFields` per tenant so it's clear the fields are config-driven, not hardcoded.
- **Screen 2 — same form, validation-error state**: one candidate for the blocking-vs-non-blocking question — a missing required field gets inline red error text on submit, and an unmet required (blocking) consent gets a red-highlighted row with its own error line, visually distinct from an untouched optional one.
- **Screens 4 & 5 — "Welcome back"**: one candidate for the returning-fan copy — names what actually changed ("we've updated our Terms of Service" / "added a new sponsor") instead of a bare "Welcome back." Screen 5 also mocks a tenant requiring a new *field* (not just a consent) from existing members mid-season — flagged on the canvas as speculative, since the HLD only defines re-evaluation for opt-ins (`IDN-05`), not `signupFields`. Raise that gap with whoever owns the HLD before building against it.

**Access:** this is a Claude Artifact, private by default — if Arthur can't open the link, it needs to be shared from the page's share menu first.

---

## References

- [`multi-tenant-identity-auth.spec.md`](../core-modules/1-draft/multi-tenant-identity-auth.spec.md) — membership model, consent evaluation, endpoint contracts
- PRD [`AUTH-02`, `AUTH-03`, `OPT-01`–`OPT-05`](../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`styling.spec.md`](styling.spec.md) — tenant theming this screen must follow
- [Multi-Tenant Entry Flow mocks](https://claude.ai/code/artifact/fbea3a62-7190-4c69-99bb-6ad264f32f2c) — see "Mocks" above
