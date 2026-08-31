# Core Module Spec: Multi-Tenant Identity, Authentication & Consent

**Implements:** [`documents/HLDs/multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — read that first for requirements `IDN-01`–`IDN-13`, the definitions of identity / membership / join / entry / consent gate, and the agreed case behavior. This document is the *how*.

**Status:** Draft. Not approved.

## Overview

Split identity from membership, move tenant scope to the server, and turn consent from a signup form field into a gate evaluated on every entry.

**The whole change, in one line:** the server decides which tenant you are in and whether you belong there, and the client stops being asked.

**Scope:** `node-server` (middleware, handlers, routes), `obs-b2b-shared` (models, interfaces, API schemas), `overboard-b2b-template` (route guard, join flow, tenant context). No CDK changes, no new infrastructure.

**Not in scope:** the admin surface (`IDN-10`, `IDN-12`, `IDN-13`) — separate spec once the `PRIZE-03` authority question closes. The phone-primary variant (`IDN-09` [P2], needs a second Clerk instance). `AUTH-04` D2C passthrough.

---

## Tenant Selector

**Decision:** the tenant travels as **`?tenant=<slug>`**, resolved by the frontend from `window.location.hostname`. Middleware resolves the slug to an organization and validates it against the caller's memberships on every request.

The selector is **untrusted input, and that is fine.** Authorization comes from the membership lookup, keyed on the Clerk user id in a signed JWT the client cannot forge: a caller who lies about the tenant gets a `403`, because they cannot forge a membership. `IDN-04` is satisfied by making the tenant *useless* to forge, not unforgeable.

Three alternatives were rejected. Each will look tempting again later, so the reasons are recorded:

- **`X-Forwarded-Host`.** `vercel.json` proxies `/b2b/*` server-side, so the backend never sees the tenant hostname — only `X-Forwarded-Host`, which Vercel sets. But the ELB is internet-facing, so anyone can set it themselves. It *looks* infrastructure-supplied and is not, which is worse than an obvious client value.
- **A header instead of a query param.** RTK Query keys its cache on serialized query args; headers are not part of the key. A header would make cache correctness depend on *"the tenant never changes within a Redux store"* — true today, written down nowhere, and false the moment the admin surface grows a tenant preview. The same reasoning makes `providesTags` tenant-scoped (`{ type: "Contests", id: tenant }`) rather than a bare global tag.
- **`organizationId` (ObjectId).** The frontend can only learn it by first fetching `/b2b/org/{slug}` — the bootstrap fetch whose silent failure currently renders the app empty with no error (`webapp.md`).

**Related, out of scope.** HTTPS on the backend origin is assumed rather than specified here: a stolen token defeats the membership check entirely, since its holder *is* that fan as far as authorization can tell. Restricting direct ELB access is deferred to a future requirement — defense in depth (keeping `SEC-09` rate limiting from being bypassed at the edge), not part of tenant isolation.

---

## Data Model

### Today

```
B2BUser { clerkUserId (unique), organizationId, tenantSlug, email, displayName }
B2BOrganization { subdomain, name }
```

Two structural problems. `clerkUserId` unique means one identity holds one tenant forever (`IDN-01`). And `B2BOrganization` carries no opt-in definitions, no signup-field config, and no branding — **the tenant configuration model that `IDN-05` and `AUTH-02` depend on does not exist server-side at all.** Opt-ins live today as `optInMessages: string[]` hardcoded in the frontend's `src/config/tenants/*.ts`. The consent gate is net-new schema, not a modification of existing schema.

### Target

Three collections replace one, plus tenant config on the organization.

**`B2BFan`** — platform identity. One per Clerk user.

| Field | Type | Notes |
|---|---|---|
| `clerkUserId` | String, **unique**, indexed | The uniqueness that moves off the membership |
| `email` | String, indexed | Denormalized cache; authoritative source is Clerk (see "Email Sync") |
| `createdAt` / `updatedAt` | Date | |

**`B2BFanMembership`** — one identity's relationship to one tenant. This is what today's `B2BUser` actually was.

| Field | Type | Notes |
|---|---|---|
| `fanId` | ObjectId → `B2BFan` | |
| `organizationId` | ObjectId → `B2BOrganization` | |
| `displayName` | String | Per tenant — a fan may present differently at two teams |
| `profileFields` | Mixed | `AUTH-02` configured field values. Per tenant by definition |
| `consents` | `[ConsentRecord]` | See below |
| `joinedAt` | Date | |

Indexes: `{fanId, organizationId}` unique — the constraint that makes `IDN-01` and `IDN-03` simultaneously true. Plus `{organizationId}` for tenant-scoped listing (the compound index cannot serve it; `organizationId` is not a prefix).

**No `tenantSlug`** (decision, 2026-08). Today's is annotated "denormalized for fast queries" but is **write-only** — never read by any query in `node-server`. It is also unnecessary: resolving `?tenant=bears` loads the organization anyway, since middleware needs its `optIns` and `signupFields`, so `organizationId` is in hand before the membership is queried. Cache that lookup in-process keyed on slug — worth doing regardless, now that it runs on every request. Keeping the slug would buy a second source of truth nothing keeps in sync; renaming a subdomain would silently stale every row.

**The rule:** normalize what must reflect *current truth* (a membership's tenant), snapshot what must reflect *a moment* (a consent's `textVersion` — normalizing it would let an `OPT-05` edit retroactively rewrite what fans agreed to).

**`ConsentRecord`** — embedded in membership (`IDN-07`).

| Field | Type | Notes |
|---|---|---|
| `optInId` | String | Stable id of the tenant's opt-in definition |
| `textVersion` | Number | The revision answered. Without this an `OPT-05` text change is undetectable |
| `decision` | `"accepted" \| "declined"` | **Declines are recorded.** Storing only acceptances re-prompts a declining fan forever |
| `agreedAt` | Date | `OPT-04` timestamp requirement |

Embedded rather than a separate collection: consents are always read with their membership, never queried across memberships, and are bounded by the tenant's opt-in count. Reporting needs (`RPT-*`) read them per tenant, which an index on the parent serves.

**`B2BOrganization`** gains tenant configuration:

| Field | Type | Notes |
|---|---|---|
| `optIns` | `[OptInDefinition]` | `{ optInId, kind, text, textVersion, blocking, sponsorId? }` — `OPT-01`, `OPT-03`, `OPT-05` |
| `signupFields` | `[FieldDefinition]` | `{ fieldId, requirement, label?, order? }` — `AUTH-02`. See below |
| `authVariant` | `"email" \| "phone"` | `IDN-09` [P2]. Add the field now, default `"email"`; the second instance is later work |

`textVersion` increments on any change to `text`. That increment is the entire re-consent trigger — treat it as the write that must never be skipped when editing consent copy.

**`FieldDefinition`** — `AUTH-02`'s configurable signup fields, deliberately the **same shape as opt-ins**: the tenant defines a set, the membership stores the fan's answers, and the server validates answers against definitions at the boundary. They differ only in that consents are versioned and re-evaluated every entry, while field values are collected once at join.

| Field | Type | Notes |
|---|---|---|
| `fieldId` | enum | From a **closed platform catalog** — not free-form. See below |
| `requirement` | `"required" \| "optional"` | |
| `label` / `order` | String / Number, optional | Copy override and render order |

Three details make three of `AUTH-02`'s acceptance criteria structurally true rather than something to enforce:

- **"Not shown" is absence, not a third state.** A field the tenant does not want simply is not in the array, so there is nowhere for the value to come from. A tenant collecting nothing extra has `signupFields: []`.
- **The catalog is closed.** `fieldId` is a fixed platform enum — `firstName`, `lastName`, `phone`, `birthday`, `zip`, `address`, `favoritePlayers`. A tenant configures *which* of these to collect; it cannot invent new ones. This is a privacy control, not a typing convenience: the platform decides what may ever be collected about a fan, the tenant decides what is. Adding to the catalog is a platform change with a privacy review.
- **Email is not in the catalog at all.** `AUTH-03` makes it mandatory, and it lives on `B2BFan` as the identity key (`IDN-02`) rather than on the membership — so "email cannot be set to optional or not shown" holds because the setting does not exist.

Values are stored in `B2BFanMembership.profileFields` as `Mixed` (decision, 2026-08): a `fieldId → value` map, validated at the boundary rather than by a Mongoose schema. A dynamically-built per-tenant schema was considered and is not worth it at this size.

### There is no migration

**Decision (2026-08): existing `B2BUser` and board records are disposable** — dev data is worthless and production is a handful of POC-era records. Create the new collections, point the code at them, drop `B2BUser`. No backfill, no dual-write, no hold period. Any individual board worth keeping is moved by hand, case by case, outside this plan.

One setup task remains, and it is authoring rather than migration: **populate `B2BOrganization.optIns`** from the frontend's hardcoded `optInMessages` arrays, with stable `optInId`s and `textVersion: 1`.

Consequence: existing fans have no recorded consent — it was never persisted — and will be asked on next entry. Nobody is grandfathered into an agreement they never gave.

---

## Middleware Contract

### New `RouteAuth` mode

`routes/route_config.ts` already has the right extension point. Add a mode:

```ts
export type RouteAuth =
  | "requireAuth"
  | "requireMembership"        // new
  | { requireUserParam: { source: "query" | "params" | "body"; key: string } };
```

`requireMembership` composes, in order:

1. `requireAuth` — existing; establishes `req.authUserId` from the Clerk JWT.
2. `resolveTenant` — reads the `tenant` query parameter, looks up the organization by that subdomain (cached in-process), sets `req.tenant`. `404` if the slug names no tenant. Never reads an `organizationId` from anywhere.
3. `requireMembership` — loads `B2BFanMembership` for `(req.authUserId, req.tenant._id)`. **`403` if absent** — this is the `IDN-03` enforcement point and the line the whole model rests on. Sets `req.membership`.
4. `attachConsentState` — computes pending opt-ins (see "Consent Gate") and sets `req.pendingConsents`.

Handlers then read `req.tenant` and `req.membership` as established facts, and **stop accepting tenant identifiers as input entirely**.

Middleware order in `registerRoutes` is currently validation → auth → handler. Membership resolution slots into the auth phase, after `requireAuth`.

### Route disposition

Every `/b2b/*` route, and what happens to it:

| Route | Today | Target | Change |
|---|---|---|---|
| `GET /b2b/contest/list-contests` | none; `organizationId` from query | `requireMembership` | **Drop `organizationId` from the query schema.** Handler takes `req.tenant._id`. Closes the live IDOR |
| `GET /b2b/contest/:contestId` | none | `requireMembership` | Verify the contest's `organizationId` matches `req.tenant._id`; `404` otherwise |
| `POST /b2b/board/generate` | `requireUserParam` body `clerkUserId` | `requireMembership` | Derive fan from `req.membership`. Verify contest is in tenant. Drop `clerkUserId` from body |
| `GET /b2b/board/:boardId` | **none** | `requireMembership` | Add ownership check — board's membership must equal `req.membership._id`. Currently returns any fan's board to anyone with the id |
| `GET /b2b/board/my-boards` | `requireUserParam` query `clerkUserId` | `requireMembership` | Drop `clerkUserId` from query — derive from token. Scope to tenant |
| `POST /b2b/user/b2b-create-user` | **none** | `requireAuth` + `resolveTenant` | Becomes the **join endpoint**. Not `requireMembership` — the caller is by definition not yet a member. See "Join" |
| `GET /b2b/org/:subdomain` | none | **stays public** | Needed pre-auth to render branding. Must return branding and opt-in *definitions* only — never fan data, never counts |
| `POST /b2b/contest/prize-tier` | **none** | moves to `/admin/*` | Currently lets any caller attach a prize tier to any tenant's contest. Out of scope here; must not remain on the fan surface |

`GET /b2b/org/:subdomain` no longer returns `organizationId` — under `IDN-04` the frontend never holds a tenant id. That retires the `TenantContext` silent-fallback bug, where a failed org fetch yields `organizationId: ""` and an app that renders with no data and no error.

---

## Consent Gate

### Evaluation

Pure function, evaluated server-side on every request through `requireMembership`:

```
pending(context, membership) =
  activeOptIns(context).filter(o =>
    !membership.consents.some(c =>
      c.optInId === o.optInId && c.textVersion === o.textVersion))
```

`activeOptIns(context)` is the parameter that makes `OPT-06` free (`IDN-05`). V1 passes the tenant and returns `organization.optIns`. A later version passes tenant-plus-game and returns only the opt-ins for sponsors active at that game. Nothing else changes.

The match is on `(optInId, textVersion)` **together** — a v1 acceptance does not satisfy v2. That pairing is the entire re-consent mechanism.

### Response shape

Pending consents ride along with the membership so the client cannot skip the gate by not asking:

```
{ membership: {...}, pendingConsents: [{ optInId, text, textVersion, blocking }] }
```

If any pending opt-in has `blocking: true`, the server **also rejects gameplay writes** (`POST /b2b/board/generate`) with a `409` naming the unmet consent. Client-side blocking alone would leave the gate as advisory, which is the `IDN-04` mistake in a different place.

### Recording

`POST /b2b/consent` — `requireMembership`. Body is a list of `{optInId, textVersion, decision}`. Server validates each `optInId` and `textVersion` against the tenant's current definitions (rejecting stale or unknown ones), stamps `agreedAt` server-side, and upserts into `membership.consents` keyed on `optInId`. Client-supplied timestamps are never trusted — `OPT-04` is an audit record.

---

## Join

`POST /b2b/user/b2b-create-user` becomes the join endpoint. `requireAuth` + `resolveTenant`, **not** `requireMembership`.

1. Upsert `B2BFan` on `clerkUserId` — the fan may already exist from another tenant. This is the `IDN-01` moment: an existing identity is reused, never duplicated.
2. Reject with `409` if a membership already exists for `(fan, tenant)` — idempotency, and it stops a double-submit creating two memberships.
3. Validate submitted `profileFields` against `organization.signupFields`: reject any `fieldId` the tenant did not configure (including catalog-valid ones), reject when a `required` field is absent or empty, accept an absent `optional` field, and apply the catalog's per-field format check. A no-op when the tenant configures no extra fields.
4. Validate and record consents as above. If any `blocking` opt-in is declined or missing, **fail the join** — do not create a partial membership.
5. Create the membership. Steps 4 and 5 must be atomic; a membership without its blocking consents is exactly the state the model exists to prevent.

Stop accepting `organizationId` and `tenantSlug` in the body. The former derives from the resolved tenant; the latter no longer exists on the model. `createB2BUserRequestSchema` drops both fields.

---

## Frontend

**`ProtectedRoute` gains a third state.** Today it is signed-in / not-signed-in. Target:

| State | Condition | Renders |
|---|---|---|
| Anonymous | no Clerk session | tenant start screen |
| Authenticated, not a member | session, `403` from membership | **join flow** — "Signed in as X — Join `<Team>`" |
| Member, consent pending + blocking | `pendingConsents` has a blocking entry | consent gate, blocking |
| Member, consent pending + non-blocking | `pendingConsents` non-empty | app, with dismissible prompt |
| Member, clear | none pending | app |

The second row is the one that does not exist today and is why a Bears fan silently plays at Hawks.

**`useMembership()`** alongside `useTenant()`, backed by one RTK Query endpoint returning membership plus `pendingConsents`. `ProtectedRoute` reads it; nothing derives tenant scope client-side for authorization purposes.

**Every endpoint takes `tenant` in its query args**, passed by callers from `useTenant().slug`, and builds it into `params` rather than interpolating it into the URL string. `providesTags` becomes tenant-scoped. `prepareHeaders` is unchanged except for replacing the untyped `(window as any).Clerk?.session?.getToken()` with the typed `getToken()` from `useAuth()`.

**`resolveTenantSlug()` moves out of `TenantContext.tsx` into a shared module.** API callers must not re-derive the slug from `window.location.hostname` — the existing implementation falls back to `VITE_TENANT_SLUG` for localhost and Vercel previews, and a second copy that skips that would break both.

Do not resolve the slug inside `query()` as a way to avoid touching call sites. That sends the tenant correctly but keeps it out of the query args, reproducing the cache-key problem the query parameter exists to avoid.

**`TenantContext`** stops merging `organizationId` — nothing client-side needs it now. The org fetch becomes branding-and-opt-in-definitions only, and its failure should surface an error rather than silently falling back.

---

## Cutover Sequence

Ordered so no step leaves the system in a worse state than it started.

1. **Schema.** Add `B2BFan`, `B2BFanMembership`, `B2BOrganization.optIns` / `signupFields` / `authVariant`. Author each tenant's `optIns` from the frontend's hardcoded arrays.
2. **Middleware, unenforced.** Land `resolveTenant` + `requireMembership`, and have the frontend send `?tenant=`. Log-only: record what *would* have been rejected. This catches a stale frontend deploy before it becomes an outage — the deploys are separate (Vercel and ECS), so they will not land simultaneously.
3. **Enforce.** Flip `requireMembership` on, route by route, starting with `list-contests` (closes the known IDOR) and `board/:boardId` (closes the unauthenticated board read). Drop `organizationId` and `clerkUserId` from the schemas as each flips.
4. **Join flow + consent gate** on the frontend, with the server-side blocking rejection landing first.
5. **Drop `B2BUser`.** No hold period — the records are disposable.

Steps 1–3 are independently valuable: 3 alone closes two live vulnerabilities regardless of whether the consent work ships in the same cycle.

Existing fans lose their records and re-join on next entry. That is the intended outcome, not a regression to mitigate.

---

## Rules

Standing constraints for anyone touching this area afterwards.

1. **No handler takes a tenant identifier as a parameter, and `organizationId` appears in no route schema.** Middleware sets `req.tenant`; nothing else is reachable. The schema half matters as much as the handler half — a tenant id in a Zod schema arrives as typed, validated input sitting in the handler's argument, which is the obvious thing for the next developer to reach for. That is precisely how this went wrong the first time.
2. **Every `/b2b/*` route declares `auth` explicitly.** The current `auth?:` being optional is why six routes shipped with none. Make it required on the `RouteConfig` type, with an explicit `"public"` value for the two routes that genuinely are (`/health`, `/b2b/org/:subdomain`) — so "unauthenticated" is a decision someone typed, not a field someone omitted.
3. **The consent gate is enforced server-side.** Any consent check that exists only in the client is advisory and does not count.
4. **Consent text edits increment `textVersion`.** Editing `text` without incrementing silently leaves every fan consented to copy they never saw.
5. **Consents never transfer between memberships** (`IDN-06`), including for the same sponsor.
6. **`agreedAt` is stamped server-side.** Never accepted from a client.
7. **`fieldId` comes from the closed platform catalog, and unconfigured fields are rejected rather than ignored.** Silently dropping an unexpected field hides a client bug; rejecting surfaces it. Several catalog fields (`address`, `birthday`, `phone`) are PII under `SEC-05`/`SEC-06`, and live on the membership so `IDN-08` deletion removes them.

---

## References

- HLD: [`documents/HLDs/multi-tenant-identity-auth.md`](../../../documents/HLDs/multi-tenant-identity-auth.md) — `IDN-01`–`IDN-13`
- PRD: [`AUTH-01`–`AUTH-04`, `OPT-01`–`OPT-06`, `SEC-03`, `SEC-06`](../../../documents/PRD/OBS_B2B_Platform_PRD.md)
- [`documents/POC-baseline/known-issues.md`](../../../documents/POC-baseline/known-issues.md) — the IDOR and unauthenticated routes this closes
- [`documents/POC-baseline/backend.md`](../../../documents/POC-baseline/backend.md) — current route and middleware inventory
- [`spec/core-modules/2-approved/mongodb-access-isolation.spec.md`](../2-approved/mongodb-access-isolation.spec.md) — `B2B_COLLECTION_PREFIX`, already landed in the models this spec changes
