# Prod-readiness reassessment — 2026-10-01

Code-verified audit of every PRD requirement (V1 scope) plus a lifecycle triage of all 41 spec files.
Six audit agents read code in all four repos (frontends + shared on `main`, backend + docs on
`feature/resend-transport`). Status words: DONE / PARTIAL / NOT STARTED / UNVERIFIABLE (needs a console or
human check). Questions marked **Q** are the ones Nick must answer; everything else was settled from code.

Headline: **the product surface is essentially built** (tenancy, auth, consent, branding, sponsors, games,
prizes, trivia, exports, admin console). **What is not built is the production envelope**: TLS on the API
origin, rate limiting / bot protection, error tracking, alerting with a recipient, and a few compliance
fields. Plus the docs lag the code by about two weeks.

---

## 1. Section-by-section status

### §5 Tenant provisioning & routing (TEN-01..05, C1..C3)
| ID | Status | Notes |
|---|---|---|
| TEN-01 slug / subdomain | DONE | `b2b.ts` unique `subdomain`; `middleware/tenant.ts` resolveTenant; fan `lib/tenant.ts` from hostname. Selector is `?tenant=`, authorization is the membership lookup (by design). |
| TEN-02 config-driven | DONE | optIns / signupFields / gateCopy / branding all on `B2BOrganization`, written via `PUT /admin/config`. |
| TEN-03 ≤2h onboarding | UNVERIFIABLE | `POST /admin/tenants` + seed/reconcile scripts exist. **Blocker:** fan-app origin must still be added to `FRONTEND_ORIGIN` + `FAN_AUTHORIZED_PARTIES` via a CDK redeploy per tenant (admin-tenant-page spec "Known gaps"). No written, timed onboarding runbook. |
| TEN-04 sponsors per tenant | DONE | Sponsor scoped by organizationId. |
| TEN-05 engineer-operated onboarding | DONE | Reserved-slug check runs before Clerk org / B2BOrganization creation. |
| TEN-C3 reserved `admin`/`obs` | DONE | Enforced in 4 places; the zod refine in shared hardcodes the literals instead of importing the constant (minor). |
| AC "one tenant's load can't degrade another" | UNVERIFIABLE | Shared ECS/ALB; no load test. |

**Q-TEN-1** Is a CDK redeploy per new tenant acceptable for V1, or should origin allowlisting become data (stored on the org, read at boot/refresh)?
**Q-TEN-2** Do you want a load test before the first high-traffic game, or accept the shared-topology assumption?

### §6 Signup & auth (AUTH-01..04)
| ID | Status | Notes |
|---|---|---|
| AUTH-01 email + Google | DONE | `GoogleSignInButton.tsx` (`oauth_google`), SignIn/SignUp pages. (Known-issues still says "not built" — stale.) |
| AUTH-02 configurable fields | DONE, beyond PRD | `FieldDefinition`, `entry-gate/fields.ts`, admin `FieldsOptins.tsx`; mid-season re-ask via `pendingFields`. PRD says field set is a *closed platform catalog*; code deliberately lets tenants invent typed fields (rulings 09-16/09-21). |
| AUTH-03 email always required | DONE | Email lives on `B2BFan`, `email` is a reserved field id. |
| AUTH-04 future auth | correctly deferred | `authVariant` stored, unread. |

**Q-AUTH-1** Confirm the open field model is the product direction, so the PRD text for AUTH-02 gets amended rather than treated as a deviation.

### §7 Opt-in consent (OPT-01..06)
All DONE except **OPT-04 PARTIAL**: `ConsentRecord` has optInId, textVersion, decision, agreedAt and an append-only history, but **no IP address and no consent method** (also fails SEC-05 and PRD 7.2 AC). `trust proxy` is set so `req.ip` is available; nothing writes it. Platform docs (terms / rules / privacy) publish via `PUT /admin/platform-consent`, OBS-only, audited.

**Q-OPT-1** Must IP + method be on the consent record before a sponsor DPA relies on it? (Recommend yes; it is a small additive change.)

### §8 Branding & sponsor assets (BRAND-01..04)
| ID | Status | Notes |
|---|---|---|
| BRAND-01 set-once elements | DONE (design changed) | Now tenant-editable Brand page (four OKLCH colours + two images, draft/publish), not hardcoded. PRD §8.1 text is stale; `branding-field-split.md` records the amendment. |
| BRAND-02 per-game sponsor assets | DONE (reshaped) | Slots: startPage, boardBanner, prizePopup, presentedBy. Free square never existed; slider slot retired 09-30; sign-in folded into presentedBy. Each cut is a dated ruling. |
| BRAND-03 multiple sponsors per game | DONE | Per-contest placement with a slots array. |
| BRAND-04 no code change | DONE | Full admin CRUD. |

**Q-BRAND-1** Accept PRD BRAND-02's seven-asset list as superseded by the four-slot model (update the PRD)?
**Q-BRAND-2** `asset-uploads.ts` leaves `uploadOrigins` empty for prod "until the admin domain is decided" → no browser can upload in prod. Is `admin.overboardsports.com` final so this can be set?

### §9 Game & prize config (GAME-01..04, C1)
All DONE. Prize content moved to a reusable library (`B2BPrize`, tiers reference by prizeId) per the 09-27 PRD clarification. Difficulty knob (`threeInARows` 1–8) is stored and editable; **the Lambda math turning difficulty into winner volume was not traced** in this pass.

**Q-GAME-1** Want a focused follow-up on the board-evaluator Lambda to confirm difficulty actually controls win rate?

### §10 Prize delivery (PRIZE-01..07)
| ID | Status | Notes |
|---|---|---|
| PRIZE-01 real-time | DONE | prize-worker claim→deliver via SQS. |
| PRIZE-02 deferred delivery (future) | NOT STARTED, **and no dormant timing field exists** on B2BPrize / B2BPrizeTiers (checked directly). PRD only asks the model to anticipate it. |
| PRIZE-03 finalize, OBS only | DONE | `POST /admin/contests/:id/finalize`, audited, typed-name confirm. |
| PRIZE-04 template per prize | DONE (one generic data-driven template, Wave 4b ruling). |
| PRIZE-05 coupon batches / custom fulfillment | PARTIAL | Handler catalog has only `standard-email`; static per-tier code supported; per-fan unique code batches deliberately deferred "until the first real sponsor's shape is known". |
| PRIZE-06 no duplicate codes | DONE for what exists (vacuous for batches). |
| PRIZE-07 failed sends reviewable | DONE | `status=failed`, delivery queue UI, resend endpoint. SQS-level DLQ is not visible in-app. |

Email: Resend is the default transport, sender support@everythingparlays.com, key from Secrets Manager. No bounce/complaint webhook, so a bounced send reads `fulfilled` forever. Provider message id not stored.

**Q-PRIZE-1** Add a dormant `deliveryTiming` field now (cheap) or leave PRIZE-02 entirely to a later PRD?
**Q-PRIZE-2** Any sponsor deal in the next quarter needing unique coupon-code batches?
**Q-PRIZE-3** Resend: is the everythingparlays.com DKIM verified, and do `dev/OverBoardB2B/resend` + `prod/OverBoardB2B/resend` secrets exist in both AWS accounts?
**Q-PRIZE-4** Are bounce/complaint webhooks V1 scope?

### §11 Reporting & exports (RPT-01..07)
RPT-01 who-played, RPT-02 fan-actions (OBS-only, separate module), RPT-03 usage (minus signup-conversion leg: no gate-visit counting), RPT-04 per-sponsor field scoping, RPT-05 opt-in filtering at current textVersion: all DONE with tests. **RPT-06 cadence NOT STARTED**, blocked on PRD Open Item #1 (delivery mechanism). RPT-07 future, correctly deferred. Every export writes `B2BAdminAuditLog`.

**Q-RPT-1** Export delivery mechanism (PRD §16 #1): on-demand download only for V1? If so, RPT-06 should be re-tagged [FUTURE] rather than left as an open AC failure.
**Q-RPT-2** Is the missing signup-conversion number in the usage report acceptable for V1?

### §12 Future game types
Trivia is fully built end to end (shared registry, backend, console incl. question bank and finalize, fan pages, 10+ test files). PRD §12 still calls game types future. Trivia starter-question pack is **unbuilt**.

**Q-12-1** Update PRD §12 to say trivia shipped, with `trivia-game-type.md` as its PRD?
**Q-12-2** Starter questions: still V1?

### §13 Security & data privacy (SEC-01..09)
| ID | Status | Notes |
|---|---|---|
| SEC-01 direct to OBS backend | PARTIAL | Both `vercel.json` files rewrite `/b2b` and `/admin` through Vercel to the ALB over **plain http**. Vercel is in the PII path and bearer tokens cross the internet unencrypted. |
| SEC-02 per-sponsor field perms | DONE |
| SEC-03 no PII to analytics | DONE trivially (no analytics exists). Prize-worker debug logs clerkUserId when DEBUG on (off in all stages). |
| SEC-04 TLS + at-rest | NOT MET | `certificateArn: undefined` for prod and dev; ALB opens :80 to the world; the https-only origin rule was removed 09-28. S3 is AES-256. Atlas at-rest UNVERIFIABLE. |
| SEC-05 consent record fields | PARTIAL | IP + method missing (see OPT-04). |
| SEC-06 export audit | DONE |
| SEC-07 deletion | PARTIAL | `DELETE /admin/fans/:membershipId` deletes DB side and anonymizes redemptions; **Clerk user not deleted, nothing purged at Resend**; operator-only. |
| SEC-08 hardening | PARTIAL | helmet, Zod on body/query, sanitizeFilter, CORS allowlist, authorizedParties + issuer per mount, boot-time `assertProductionSecurity`, route-auth guard test. **No rate limiting, no WAF**, path params not Zod-validated, ALB reachable directly. Admin MFA is a Clerk toggle (UNVERIFIABLE). |
| SEC-09 bot protection | NOT STARTED | No CAPTCHA/Turnstile/throttle on `/b2b/join`. Clerk bot protection UNVERIFIABLE. |

Route inventory: 26 non-admin routes (public org config by design; everything else requireTenant / requireMembership), 108 admin routes behind the admin Clerk instance + org scoping, 3 dev routes mounted only when DEV_TOOLS gate passes (cannot pass in prod). Secrets all via Secrets Manager; nothing committed. `pages/Test.tsx` deleted. npm audit: node-server / prize-worker / admin 0; **fan app 1 critical + 8 high** (Clerk SDK, react-router, vite); CDK root 4 high (build-time only).

**Q-SEC-1** API domain + ACM cert plan (e.g. api.overboardsports.com)? And should the frontends call it directly instead of proxying through Vercel?
**Q-SEC-2** Clerk dashboard: bot protection on the fan instance, MFA required on the admin instance, org creation restricted on the admin instance — which are on today, per environment?
**Q-SEC-3** Atlas: have `b2b-app-*` roles been narrowed to per-collection, do the replication triggers exist in dev and prod, and is encryption at rest confirmed for the cluster tier?
**Q-SEC-4** SEC-07: should deletion also remove the Clerk user and suppress at Resend? Is operator-only deletion enough for V1?
**Q-SEC-5** Rate limiting: application-level (express-rate-limit, per IP + per fan) vs AWS WAF on the ALB? Recommend WAF managed rules + a thin app limiter on join/consent/board-generate.

### §14 Observability (OBS-01..05)
OBS-01 error tracking NOT STARTED (no Sentry anywhere). OBS-02 tenant tagging NOT STARTED (console.* logs, request id only). OBS-03 alerting NOT STARTED in effect: three DLQ alarms post to an SNS topic whose only subscriber is a phone number set to `undefined`. OBS-04 PARTIAL: `/admin/platform-health`, `/admin/live` from DB state only; `/health` never checks Mongo. OBS-05 PARTIAL. Log retention one week, DESTROY policy.

**Q-OBS-1** Error tracker choice and budget (Sentry is the obvious pick; both frontends + backend + worker)?
**Q-OBS-2** Who receives prod alerts, and on what channel (email / SMS / Slack)?

### §15 Admin surface (ADM-01..09)
All DONE. Two Clerk instances; `resolveAdminScope` from the verified token; OBS-staff check fails closed; ADM-03 tenant write access **already shipped** (09-16 ruling: tenant `org:admin` can write, `org:member` read-only), finalize and fan-actions export remain OBS-only; step-up re-auth removed everywhere; preview drawer implemented; broad audit log. Accepted gaps: last-admin lockout unguarded, up to 5-min staff revocation lag, tenant-side Clerk invites not in OBS audit log, `/admin/*` silently unmounted if `ADMIN_CLERK_SECRET_KEY` missing.

**Q-ADM-1** Update PRD §15 so ADM-03 reads as shipped?
**Q-ADM-2** Spec notes `warriors` / `fightinghawks` / `bears` have mismatched Clerk org pairs — still pending?

### §16 Open items
1 export delivery: open (see Q-RPT-1). 2 finalization: resolved. 3 retention windows: open, legal.

**Q-16-1** Retention windows: any update from counsel? If not, propose a default (e.g. fan data purged N months after a tenant's season ends) so the code can carry a field.

---

## 2. Spec triage (41 files)

| Disposition | Files |
|---|---|
| → 3-active as-is (implemented, minor edits) | admin-contests, admin-exports, admin-fans, admin-game-day, admin-lists, admin-obs-workspace, admin-overview, admin-preview, admin-schedule (add /season page), admin-sponsor-recap, admin-support, admin-surface (delete reverify prose), admin-team, admin-tenant-page, end-to-end-flow (fix test-mode path to /admin/dev), multi-tenant-identity-auth (drop retired user-create route), fan-preview-mode (status line says "nothing built" — false) |
| → 3-active after rewrite to as-built | admin-branding (four colours + two images; drop presets/gallery/mode), admin-sponsors + admin-uploads (presentedByLogo rename, trivia presentedBy slot), admin-prizes (Resend provider, bounce state), admin-fields-and-optins (10-01 Rules/platform-consent), trivia-game-type (finalize not send-prizes, tierSnapshot, registry, ContestBuilder names; starter questions open) |
| → 3-active pending a human check | mongodb-access-isolation (Atlas triggers/roles, Q-SEC-3), contest-safety (10-01 rulings built?) |
| Merge into newer spec, then deprecate | admin-obs-internal → obs-workspace/tenant-page; admin-tenant-lifecycle → tenant-page; prize-delivery → admin-prizes (or keep as the worker spec) |
| → 4-deprecated | admin-games-and-prizes, side-menu-nav (both self-declared), fan-decor-system (kit dropped by D6), fan-app-v2-console-touchpoints, styling.spec (or rewrite), environments.spec (or rewrite) |
| entry-gate | 3-active with banner → admin-fields-and-optins, or deprecate |
| Finished plans → documents/ or delete | trivia-implementation-plan, trivia-overhaul-merge-plan (keep as D1–D6 decision record), trivia-data-api-design |
| Product decision first | admin-brand-v2 (Words / Fine-tune / swatches unbuilt; D1 override slots unbuilt), fan-app-v2 (side menu + legal + how-to-play built, kit screens dropped: split it), fan-contest-flow (square-by-square, edit endpoints, SSE, scorebug all unbuilt; it retires board/generate which the app still calls) |

Cross-cutting doc drift to fix in one sweep: (A) "Reverified" comments in shared `src/api/admin/*.ts`; (B) legacy sponsor names; (C) kit references; (D) Wave 5 headers saying "never merged to main" (it is on main); known-issues.md still says Google sign-in not built and "Observability console-only" (true) etc.

**Q-SPEC-1** fan-contest-flow: keep (still wanted) or deprecate?
**Q-SPEC-2** fan-app-v2: split or rewrite as-built?
**Q-SPEC-3** admin-brand-v2: still wanted? Where do the D1 override slots go?
**Q-SPEC-4** Deprecated specs: delete, or move to 4-deprecated with a pointer banner? Finished plans: delete or documents/?
**Q-SPEC-5** environments.spec: deprecate or rewrite?

---

## 3. Draft plan to prod readiness

Ordered by risk. Items marked (Q) wait on an answer above; everything else can start now.

**Phase 0 — land what is in flight (days)**
- Merge `feature/resend-transport` (backend + docs) to main.
- Run `one-name-migration.mjs` against prod before the integrated branch deploys (memory note).
- Backfill `contestType` on older rows in deployed envs.

**Phase 1 — production envelope (the real blockers, ~1–2 weeks)**
1. TLS: ACM cert + API hostname, ALB 443 with redirect, restore https-only origin rule, close :80. Switch Vercel rewrites to https or drop the proxy (Q-SEC-1).
2. Rate limiting + bot protection: WAF managed rules on the ALB, app limiter on join/consent/board-generate/trivia answer, Clerk bot protection on (Q-SEC-2, Q-SEC-5).
3. Error tracking + alerting: Sentry in both frontends, backend, worker, Lambdas with tenant tag and PII scrubbing; CloudWatch alarms on ALB 5xx, ECS task health, Lambda errors, DLQ depth; SNS subscriber that is a real person/channel (Q-OBS-1, Q-OBS-2).
4. `/health` checks Mongo; log retention ≥ 90 days with RETAIN in prod.
5. Fan app dependency upgrades (1 critical, 8 high).
6. Set `uploadOrigins` for prod admin domain (Q-BRAND-2).

**Phase 2 — compliance fields (days)**
7. Consent record: add `ipAddress` + `method` (OPT-04 / SEC-05).
8. SEC-07: delete Clerk user + Resend suppression on fan deletion (Q-SEC-4).
9. Optional dormant `deliveryTiming` on prize tier (Q-PRIZE-1).
10. Retention-window field on org, no enforcement yet (Q-16-1).

**Phase 3 — infra and ops verification (needs Nick at consoles)**
11. Atlas: per-collection roles, replication triggers in prod, at-rest encryption (Q-SEC-3).
12. Clerk dashboards: MFA, bot protection, org-creation restriction, Google OAuth prod credentials.
13. Resend DKIM + prod secret (Q-PRIZE-3).
14. Prod CDK deploy to `obs-b2b-prod` with `prod_` prefix; confirm nothing still runs in the management account (known-issues).
15. Write the timed tenant-onboarding runbook and run it once end to end (TEN-03); decide on origin allowlist as data (Q-TEN-1).

**Phase 4 — docs cleanup (parallel, mostly mechanical once Qs answered)**
16. Apply the spec dispositions in §2; fix the four cross-cutting drifts; update PRD §8.1, §12, §15, AUTH-02, BRAND-02, RPT-06 tag; refresh known-issues.md; rewrite NEXT-SESSION.md.

**Deferred by decision (not blockers):** RPT-06 cadence, PRIZE-05 coupon batches, trivia starter questions, fan-contest-flow live updates, brand Words/Fine-tune, bounce webhooks (unless Q-PRIZE-4 says V1).
