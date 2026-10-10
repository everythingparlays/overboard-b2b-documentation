# Runbook: first production launch — Minnesota Wild (`wild.overboardsports.com`)

Written 2026-10-10. The order is the dependency order: each phase needs the one before it. "You" is
the engineer at the consoles (Nick); "code" marks steps an agent or Arthur can do from the repos.
Tick the boxes as you go; this file is the record of what has been done.

Facts that shape the order:
- The Route 53 zone for `overboardsports.com` is in the AWS **management** account. Every DNS record
  below is created there, as a plain CNAME (never the alias dropdown).
- The prod API stack refuses to boot until `clerkIssuer` and `adminClerkIssuer` are set
  (`node-server/src/config/security.ts`), so Clerk comes before the backend.
- Prod B2B collections (`prod_*` in database `obs-b2b-prod`) start empty. There is no data migration
  from dev; the tenant is configured through the console.
- Slug is `wild`. Fan app at `https://wild.overboardsports.com`, console at
  `https://admin.overboardsports.com`, API at `https://b2b-api.overboardsports.com` (cert issued).

---

## Phase 1 — Production Clerk (you)

Two production instances in the Clerk dashboard. Nothing downstream works without them.

- [ ] **Fan instance** (production). Domain `overboardsports.com`. Add the CNAMEs Clerk lists
      (`clerk`, `accounts`, mail records) in the management zone; wait for Clerk to show them verified.
      Note its **Frontend API URL** (`https://clerk.overboardsports.com`).
- [ ] Fan instance settings: email + Google sign-in; Google OAuth with **production** client ID/secret
      (redirect URI from the Clerk dashboard); email verification on; bot protection on.
      Allowed origins: `https://*.overboardsports.com`.
- [ ] **Admin instance** (production), its own domain, e.g. `clerk-admin.overboardsports.com`, same
      CNAME dance. Note its Frontend API URL.
- [ ] Admin instance settings: **Require MFA**; Organizations on; organization creation restricted
      (only admins); roles/permissions identical to dev (`org:admin`, `org:member`,
      `org:tenant_config:manage`, `org:contest:finalize`, `org:fan_data:export`); create the `obs`
      organization and add OBS staff. Allowed origins: `https://admin.overboardsports.com`.
- [ ] Send the two Frontend API URLs and the two publishable keys to the engineer doing Phase 2.
- [ ] **Secrets Manager, prod account (189750306402), us-east-2:** `prod/OverBoardB2B/clerkAuth`
      with keys `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ADMIN_CLERK_SECRET_KEY`,
      `ADMIN_CLERK_PUBLISHABLE_KEY` (same key names the dev secret uses); and
      `prod/OverBoardB2B/resend` with `RESEND_API_KEY` (a production Resend key).

## Phase 2 — Backend config and prod stack

- [ ] (code) Set `clerkIssuer` and `adminClerkIssuer` for `prod` in
      `overboard_sports_backend/lib/config/environments.ts`. Set `dlqAlertPhoneNumber` to a real
      number: today the DLQ alarms have no subscriber at all.
- [ ] (you) **Atlas:** database `obs-b2b-prod` exists with the `readonly_*` replication triggers;
      custom role `b2b-app-prod` per `spec/core-modules/2-approved/mongodb-access-isolation.spec.md`;
      database users for the prod task-role ARNs (`obs-b2b-prod-*`, printed by the deploy; the
      names are deterministic so they can be created before the first deploy).
- [ ] (you) From the backend repo, built first (`npm run build` in node-server, prize-worker, lambdas):
      ```
      npx cdk bootstrap --profile obs-b2b-prod -c stage=prod
      npx cdk deploy --profile obs-b2b-prod -c stage=prod
      ```
- [ ] (you) Management zone: CNAME `b2b-api` → the `ApiLoadBalancerDnsName` output. Then
      `curl -I https://b2b-api.overboardsports.com/health` → 200; `http://` → 301.
- [ ] (code) Indexes: `autoIndex` is off, so run `mongodb_queries/backfill_org_tenant_config.js` and
      `node-server/scripts/create-list-indexes.mjs` against `obs-b2b-prod` with prefix `prod_` once.

## Phase 3 — Frontends on Vercel (you, values from code)

Two **new** Vercel projects building from a `release` branch (dev keeps deploying from `main`).

- [ ] (code) Create and push `release` in `overboard-b2b-template` and `obs-b2b-admin-frontend`.
- [ ] Fan project `overboard-b2b-prod`, env (all public): `VITE_CLERK_PUBLISHABLE_KEY` = fan `pk_live_…`;
      `VITE_API_BASE_URL=https://b2b-api.overboardsports.com`;
      `VITE_PREVIEW_PARENT_ORIGINS=https://admin.overboardsports.com`.
      Domain: `wild.overboardsports.com` (+ management-zone CNAME `wild` → `cname.vercel-dns.com`).
- [ ] Admin project `obs-b2b-admin-prod`, env: `VITE_ADMIN_CLERK_PUBLISHABLE_KEY` = admin `pk_live_…`;
      `VITE_API_BASE_URL=https://b2b-api.overboardsports.com`;
      `VITE_FAN_APP_ORIGIN=https://{slug}.overboardsports.com`.
      Domain: `admin.overboardsports.com` (+ CNAME `admin` → `cname.vercel-dns.com`).
- [ ] Sign in to `https://admin.overboardsports.com` as OBS staff. This proves the admin instance,
      MFA, the `obs` org, CORS and TLS in one go.

## Phase 4 — Provision the Wild (console, as OBS staff)

- [ ] Tenants → create: slug `wild`, name "Minnesota Wild". (Creates the `B2BOrganization` and the
      Clerk organization; `wild` is not reserved.)
- [ ] Team: invite the Wild's staff users to their organization (`org:admin` can edit config,
      `org:member` is read-only).
- [ ] Brand: four colours + logos from the Wild's brand guidelines.
- [ ] Fields & Opt-ins: signup fields; opt-ins with real legal copy; **publish Terms, Rules and
      Privacy** via platform consent (every fan is asked on first entry; nothing is pending until
      this is published).
- [ ] Prize email settings and the tenant's Reply-To.
- [ ] Sponsors, placements, prize library, prize tiers; then the first contest against a real
      Wild game from the schedule.
- [ ] Preview the fan app from the console for the `wild` tenant.

## Phase 5 — Pre-launch checks

- [ ] Fresh fan signup on `https://wild.overboardsports.com` with Google and with email; join; gate
      shows the published terms; consent rows carry `ipAddress` (a real client address, not
      loopback) and `method: "join"` (`mongodb_queries/consent_provenance_check.js`, prefix `prod_`).
- [ ] Board generates; dev tools are **absent** (`/admin/dev/status` → 404).
- [ ] A prize email sends from `support@email.overboardsports.com` (test-mode contest is not
      available in prod; use a real low-stakes contest or send a resend from the delivery queue).
- [ ] Exports: who-played and usage for the tenant produce files and audit rows.
- [ ] Fan deletion from the console works and is audited.
- [ ] Alarms: confirm the SNS subscription for the DLQ alarms was confirmed on the phone.

## Known gaps going into launch (decided, not forgotten)

- No rate limiting / WAF and no bot challenge beyond Clerk's (SEC-08/09). A WAF with managed rules
  on the prod ALB is the next infra PR.
- No error tracker; alerting is DLQ-only. Game-day watch is the console's Live and Health pages.
- Admin preview on the dev Vercel deployment is broken (auth); not a launch blocker.
- Deleting a fan leaves the Clerk user and Resend data (SEC-07).
