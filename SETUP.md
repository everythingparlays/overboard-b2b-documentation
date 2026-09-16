# Workspace Setup

This is the onboarding guide for a new engineer joining the OBS B2B platform. It sets up all three repos, side by side, in one workspace folder.

If anything here is out of date or doesn't match what you find, that's useful signal — flag it so this doc (and possibly [`documents/POC-baseline/known-issues.md`](documents/POC-baseline/known-issues.md)) can be corrected.

## What You're Setting Up

Four repos, cloned as siblings in one folder:

| Repo | Purpose | Remote |
|---|---|---|
| `overboardb2b-documentation` | Specs, PRD, architecture docs (this repo) | `github.com/everythingparlays/overboard-b2b-documentation` |
| `overboard-b2b-template` | Frontend — fan-facing web app | `github.com/everythingparlays/overboard-b2b-template` |
| `obs-b2b-admin-frontend` | Frontend — admin console for OBS and tenant staff | `github.com/everythingparlays/obs-b2b-admin-frontend` |
| `overboard_sports_backend` | Backend API, workers, AWS infra (CDK) | `github.com/everythingparlays/overboard_sports_backend` |

> The admin console is a separate origin with its own Clerk instance; the steps below cover the fan app and the backend. Its deploy notes live in that repo's `DEPLOY.md`, and its screens are specified in [`spec/core-modules/1-draft/`](spec/core-modules/1-draft/) (`admin-surface.spec.md` is the umbrella).

> The backend repo moved into the `everythingparlays` org (2026-09) — it previously lived under a personal account (`nickdep217`); the old URL redirects.

```
obs-b2b-workspace/                     <- pick any name for this folder
├── overboardb2b-documentation/
├── obs-b2b-shared/                    <- edit/publish copy (see note below)
├── overboard-b2b-template/
│   └── obs-b2b-shared/                <- git submodule
├── obs-b2b-admin-frontend/
│   └── obs-b2b-shared/                <- git submodule
└── overboard_sports_backend/
    ├── lambdas/obs-b2b-shared/            <- git submodule
    ├── node-server/src/obs-b2b-shared/    <- git submodule
    └── prize-worker/obs-b2b-shared/       <- git submodule
```

All three app repos depend on **`obs-b2b-shared`** — B2B's own repo of TypeScript types, the Zod HTTP contract, and Mongoose models — vendored as a git submodule in five places (fan frontend, admin frontend, `node-server`, `lambdas`, `prize-worker`). Keep them all pinned to the same commit; they are separate checkouts and can drift. Design: [`documents/HLDs/b2b-shared-deps.md`](documents/HLDs/b2b-shared-deps.md).

**Why there's an extra copy at the workspace root.** No build reads it — every project resolves the package from its own submodule. It exists because submodule checkouts are pinned and therefore sit in *detached HEAD*: committing inside one leaves the commit on no branch, unreachable by the other pins. The root clone is the one checkout on `main`, so it is where you edit and publish:

```bash
# 1. change the shared package
cd obs-b2b-shared && git commit -am "..." && git push

# 2. move each consumer's pin to the new commit
cd ../overboard_sports_backend
for p in node-server/src/obs-b2b-shared lambdas/obs-b2b-shared prize-worker/obs-b2b-shared; do
  (cd $p && git fetch origin && git checkout origin/main)
done
cd ../overboard-b2b-template/obs-b2b-shared && git fetch origin && git checkout origin/main
```

Then commit the updated pins in each consuming repo. Skipping step 2 leaves consumers on the old commit — the drift this layout is meant to make visible rather than prevent.

## Prerequisites

Before you start, make sure you have:

- **Git**, with access to the `everythingparlays` GitHub org (and the backend repo above)
- **Authenticated GitHub access to private repos** — `obs-b2b-shared` is private, so cloning/updating the submodule needs credentials. If your git is already authenticated against the org (SSH keys, `gh auth login`, or a credential manager), a plain `git submodule update --init --recursive` works and you can skip the PAT URL-rewrite shown in step 3. A **Personal Access Token (PAT)** is only needed when no such credentials exist — which is the case in CI (`vercel-install.sh` uses one).
- **Node.js 20+** and npm
- **Docker**, installed and running — required for backend CDK asset builds
- **AWS CLI** — only needed if you'll be deploying/inspecting the backend infra. Access goes through IAM Identity Center, not static credentials — ask Nick to add you to the `obs-b2b-dev-deployers` group, then see "AWS Access Setup" under step 4 below.
- **CDK CLI** (`npm install -g aws-cdk`, or use `npx cdk`) — backend only
- **A Clerk Dashboard invite** — only needed if you're changing auth configuration. For normal local work the non-production instance's publishable key is in step 3 below, and the backend reads its secret key from Secrets Manager. **Never use the production Clerk instance locally.**
- **MongoDB Atlas access / connection string** — ask for this; there's no self-serve way to get it from the repos alone

The frontend ships a committed `.env.example` with working dev values — copy it and you're done (step 3). `node-server` now has one too (added 2026-09) — copy it as step 4 shows, though a couple of values (your stage prefix, AWS profile) are yours to fill in.

## 1. Create the Workspace Folder

```bash
mkdir obs-b2b-workspace && cd obs-b2b-workspace
```

## 2. Clone the Documentation Repo

```bash
git clone https://github.com/everythingparlays/overboard-b2b-documentation.git overboardb2b-documentation
```

Read [`AGENTS.md`](AGENTS.md) and [`documents/POC-baseline/README.md`](documents/POC-baseline/README.md) next — they'll orient you on what's real vs. aspirational before you start reading application code.

## 3. Clone and Set Up the Frontend

```bash
git clone https://github.com/everythingparlays/overboard-b2b-template.git
cd overboard-b2b-template
```

**Initialize the submodule** (`obs-b2b-shared`). If your git is already authenticated against the org (SSH, `gh auth login`, or a credential manager — the usual case on a dev machine), this is all it takes:

```bash
git submodule update --init --recursive
```

Only if that fails with an auth error, rewrite the submodule URL to carry a PAT (the pattern the repo's own `vercel-install.sh` uses for CI, where no stored credentials exist):

```bash
git submodule set-url obs-b2b-shared https://<YOUR_GITHUB_PAT>@github.com/everythingparlays/obs-b2b-shared.git
git submodule update --init --recursive
```

**Environment variables** — copy the committed template:

```bash
cp .env.example .env.local
```

The three required variables come pre-filled and work as-is against the shared dev stack:

| Variable | Notes |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Non-production Clerk instance (`natural-macaw-97.clerk.accounts.dev`). Publishable keys are public by design — they ship in the browser bundle — so committing this is safe. The matching **secret** key is not, and lives in Secrets Manager. |
| `VITE_API_BASE_URL` | A dev-stack ALB. **Check it's still current** — personal dev stacks get torn down and redeployed at new addresses. Use `http://localhost:3000` to point at a backend you're running yourself. |
| `VITE_TENANT_SLUG` | Which tenant to render. Must match both a `slug` in `src/config/tenants/` and an organization in the dev database. Valid: `test`, `fightinghawks`, `bears`, `bbgs`, `warriors`; defaults to `test` if unset. |

All three are required — miss one and the app renders a missing-environment-variables error screen instead of the UI.

> A mismatch here is the single most common first-day failure: `VITE_TENANT_SLUG` must match the database record exactly. `fighting-hawks` (hyphenated) is *not* the same as `fightinghawks`, and the backend currently answers a missing organization with a 500 rather than a 404 — so a typo looks like a server crash. See [`known-issues.md`](documents/POC-baseline/known-issues.md).

> Note the `VITE_` prefix. Clerk's own docs often show `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Next.js); this app is Vite, and any variable without the `VITE_` prefix is silently ignored at build time — you'd get the missing-environment-variables error screen with no other clue why.

**Install and run:**

```bash
npm install
npm run dev
```

## 4. Clone and Set Up the Backend

```bash
cd ..
git clone https://github.com/everythingparlays/overboard_sports_backend.git
cd overboard_sports_backend
```

**Initialize submodules** — there are three separate `obs-b2b-shared` checkouts in this repo (one per service), real gitlinked submodules as of 2026-09-14:

```bash
git submodule update --init --recursive
```

(Only if this fails with an auth error, apply the same `git submodule set-url ... https://<YOUR_GITHUB_PAT>@...` pattern as step 3 for each of the three paths in `.gitmodules`.)

**Install CDK app dependencies:**

```bash
npm install
npm run build
```

**Build the services** — required once per fresh clone, and again after service code changes:

```bash
./scripts/build-all.sh
```

This builds `node-server`, `prize-worker`, and the board-evaluator Lambda into their `built/` directories. **A first `cdk deploy` on a fresh clone fails without it** — CDK packages the pre-built output rather than building the services itself, and the failure mode (two deploys have died on this) is not obviously "you forgot to build."

**Run the tests** — the backend has a jest suite as of 2026-09 (351 tests: tenant isolation, route-auth declarations, entry-gate consent evaluation, admin scoping, and the `/admin/*` route surface):

```bash
npx jest
```

### Running `node-server` locally (the API)

**One-time Atlas step first.** MongoDB auth is AWS IAM (`authMechanism=MONGODB-AWS` — see `db.ts`), in dev and prod alike. There is no username/password path, so running locally requires **your own AWS identity registered as an Atlas database user**:

```bash
aws sts get-caller-identity     # note the Arn
```

In Atlas: **Database Access → Add New Database User → AWS IAM**, paste that ARN as the username, assign `b2b-app-dev`, Add User. Without this the server starts and then fails to authenticate — the deployed task roles are registered, your laptop is not.

```bash
cd node-server
cp .env.example .env      # then fill it in — .env is gitignored, it holds a Clerk secret
npm run dev               # builds, then runs with .env loaded
# Server on http://localhost:3000 by default (PORT env var to override)
```

`npm run dev` and `npm run start:local` read `.env` natively (Node ≥ 20.6 `--env-file`); there is no `dotenv` dependency. Plain `npm start` does **not** read it — that is what deployed environments use, where real environment variables are injected.

Required in `.env`: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `MONGODB_CONNECTION_STRING`, `MONGODB_DATABASE_NAME`, `B2B_COLLECTION_PREFIX`, `FRONTEND_ORIGIN`. Add `AWS_PROFILE` if your default AWS profile is not the identity you registered in Atlas, and `PORT` if 3000 is taken.

Four variables are easy to get wrong:

- **`CLERK_PUBLISHABLE_KEY` is required, not optional.** `clerkMiddleware()` needs both keys and throws without it, so *every* request 500s inside Clerk before reaching any route — including `/health`, which has no auth. The error names the missing publishable key but the symptom (everything 500s) looks like a much bigger problem. It is not a secret; it is the same `pk_test_...` value the frontend uses. Deployed services get both keys from Secrets Manager via `main-api-service.ts`, so this gap is local-only.
- **`AWS_PROFILE`** — MongoDB auth is AWS IAM, and the driver uses whichever identity the AWS chain resolves. If your `[default]` profile is not the ARN registered in Atlas, auth fails with `MongoServerError: Authentication failed` (code 18). Note the driver does **not** read `~/.aws/credentials` on its own — that resolution comes from the `@aws-sdk/credential-providers` devDependency; without it the driver falls through to the EC2 metadata endpoint and times out against `169.254.169.254`.

- `MONGODB_CONNECTION_STRING` is the cluster **host** (`pbingo-dev.3yne0.mongodb.net`), not a credential. `db.ts` interpolates it into the `mongodb+srv://` URI; the credentials come from your AWS chain.
- `B2B_COLLECTION_PREFIX` must be your stage (`nick_`). Omitting it reads empty, unprefixed collections, and every tenant looks unknown — a confusing failure, not an obvious one.

Point your local frontend's `VITE_API_BASE_URL` at `http://localhost:3000` to talk to this.

### AWS Access Setup (Identity Center)

Backend infra access goes through **IAM Identity Center**, not individual IAM users or long-lived access keys — this keeps offboarding clean (removing someone from one group cuts off access everywhere, instead of hunting down keys someone was handed once and forgot about). See [`known-issues.md`](documents/POC-baseline/known-issues.md) for why this was chosen over plain IAM users.

**Two prerequisites, both requiring someone with admin access — ask for both at once:**

1. **Identity Center**: add you to the `obs-b2b-dev-deployers` group. Nothing below works without it.
2. **MongoDB Atlas**: register your personal stack's two IAM role ARNs as Atlas database users (see [`environments.spec.md`](spec/infra/environments.spec.md#onboarding-a-new-developer--required-atlas-step)). Only needed if you'll deploy backend infra.

The second one is easy to overlook because it isn't needed until *after* a successful deploy — your stack will deploy cleanly and then fail to reach MongoDB at runtime. If you see database connection errors from a stack that otherwise came up fine, this is almost certainly why; it is not something you misconfigured.

**One-time setup, per laptop:**

```bash
aws configure sso
```

Answer the prompts:
- **SSO session name** — anything you want (e.g. your own name) — purely a local label in your own config, doesn't need to match anyone else's.
- **SSO start URL** — `https://ssoins-7223c5fccd56e92b.portal.us-east-1.app.aws`
- **SSO region** — `us-east-1`
- **SSO registration scopes** — leave the default, just hit enter.

This opens a browser to log into the Identity Center portal — approve it there. Back in the terminal:
- **Account** — `obs-b2b-dev`
- **Role** — `AdministratorAccess-for-b2b-dev`
- **CLI default region** — `us-east-2` (matches where the backend infra actually deploys)
- **CLI default output format** — `json` is fine
- **CLI profile name** — `obs-b2b-dev` — **type this explicitly**, don't just hit enter on the suggested default. If you accept the default, the CLI auto-generates a name like `AdministratorAccess-for-b2b-dev-667523684851` instead, and every command below that references `obs-b2b-dev` will fail with "The config profile (obs-b2b-dev) could not be found."

**If you already did this and ended up with the long auto-generated name:** no need to redo the wizard — just open `~/.aws/config` and rename that profile's `[profile ...]` header line to `[profile obs-b2b-dev]`. Everything else in the block stays the same.

**Checking what profiles you actually have**, if you're ever unsure:

```bash
aws configure list-profiles                 # lists every profile name
grep -B1 sso_session ~/.aws/config           # shows just the SSO-based ones
aws sso list-accounts --profile obs-b2b-dev  # confirms this profile is actually logged in (vs. expired)
```

**Using it:**

```bash
aws sso login --profile obs-b2b-dev     # re-run whenever your session expires (2 hours)
export AWS_PROFILE=obs-b2b-dev          # or pass --profile obs-b2b-dev on every command instead
```

> **Scope heads-up:** `AdministratorAccess-for-b2b-dev` is full admin *within* `obs-b2b-dev` — not narrowed down to just what CDK needs. The account boundary is what actually keeps this from being able to touch `obs-b2b-prod` (a fully separate account, fully separate access) — but inside `obs-b2b-dev` itself, nothing currently stops a mistake from being bigger than it needs to be. Worth tightening later; not a blocker for now.

**Troubleshooting — `Permission denied: '/Users/you/.aws/sso'`:** usually means `~/.aws` got left owned by `root` from a stray `sudo aws configure` at some point in the past. Fix:

```bash
sudo chown -R $(whoami):staff ~/.aws
chmod 700 ~/.aws
chmod 600 ~/.aws/config ~/.aws/credentials
```

Then retry `aws configure sso`.

### Deploying backend infra (only if you're working on infra)

Per-developer stage isolation ([`spec/infra/environments.spec.md`](spec/infra/environments.spec.md)) is now implemented — `-c stage=<name>` is **required** on every `cdk deploy`/`cdk destroy`, there's no default, and a bare `cdk deploy` fails loudly on purpose rather than deploying somewhere ambiguous:

```bash
npx cdk bootstrap --profile obs-b2b-dev -c stage=<yourname>   # first time only, per account
npx cdk deploy --profile obs-b2b-dev -c stage=<yourname>
npx cdk destroy --profile obs-b2b-dev -c stage=<yourname>     # tear it down when you're done — no auto-cleanup exists
```

Use your own name as the stage (e.g. `-c stage=nick`) — this gives you an isolated `OverboardSportsBackendStack-<yourname>` stack, safe to deploy alongside anyone else's in the same account. **Never** pass `-c stage=prod` yourself — that's a separate account (`obs-b2b-prod`) with its own access, not something to deploy to casually. See the spec for the full design.

**A personal stack works end to end for the main API** (confirmed 2026-09-11: `OverboardSportsBackendStack-arthur` deployed and serves authenticated fan traffic — Atlas ARN registration done beforehand). One prerequisite is still missing:
- A dev-scoped MongoDB secret in `obs-b2b-dev`. Without it, the async pipeline (board-evaluator / prop-update-evaluator Lambdas) will throw at runtime — they require `MONGODB_SECRET_ARN`, with no IAM fallback. (The main API / node-server doesn't need this — it uses Atlas IAM auth via its task role instead.)

(The non-production Clerk instance, previously also missing, exists and its secret is in Secrets Manager as `dev/OverBoardB2B/clerkAuth` — auth works out of the box.) The Mongo-secret gap is tracked in [`known-issues.md`](documents/POC-baseline/known-issues.md); until it's resolved, board/prop evaluation won't run on a personal stack — check there before assuming something you did wrong.

See the backend repo's own `README.md` for full CDK deploy options (`mongodbSecretArn`, `dlqAlertPhoneNumber` context flags, etc.) — this workspace guide only covers getting things running locally.

## Boundaries — Read This Before Your First PR

A few things are off-limits for new contributors (interns especially) by default, because the blast radius extends outside what you can see or test from this workspace:

- **Don't edit inside the `obs-b2b-shared` submodule directory.** It is one repo vendored into five places — an inline edit changes types and models for both frontends *and* all three backend services, and is easy to lose when the submodule is next updated. Changes go through the `obs-b2b-shared` repo itself, then all five pins move together. If a task seems to need a change there, **stop and ask** rather than fixing it inline as part of an unrelated ticket.
- **Never point your local environment at the production MongoDB database.** The same database that stores B2B data also stores live data for the D2C mobile app (`Contest`, `User`, `Board`, `Prop`, and other non-`B2B`-prefixed collections — see `known-issues.md`) — these are serving real users right now. Only use connection strings/credentials you've been explicitly told are for dev/local use. If you're not sure whether what you were given points at production, **ask before running anything against it** — including read-only exploration, since it's easy to fat-finger a write.
- **Don't run tenant/org provisioning steps, migrations, or one-off scripts against shared infrastructure** without a teammate reviewing them first, even if they look small and scoped only to B2B collections — provisioning today is manual, direct database writes (see `known-issues.md`), which means there's no safety net catching a mistake.
- If a task assigned to you seems to require touching any of the above, that's a signal it's not actually a good first task — flag it rather than pushing through.

## 5. Sanity Check

- Frontend dev server loads at `http://localhost:5173` (or whatever Vite reports) without the "missing environment variables" error screen.
- `http://localhost:3000/health` returns `{"status":"ok"}` from the local backend.
- Signing up / signing in via the frontend against your local backend succeeds (confirms Clerk keys + Mongo connection are correct).

If any of this doesn't work and the cause isn't obvious, check [`documents/POC-baseline/`](documents/POC-baseline/) first — several known gaps (missing env var docs, submodule drift, an existing tenant-slug bug) are already documented there and may be the cause rather than something wrong with your setup.

## Known Rough Edges (Worth Knowing Before You Debug for an Hour)

These aren't setup mistakes — they're pre-existing gaps documented in [`documents/POC-baseline/known-issues.md`](documents/POC-baseline/known-issues.md):

- Both repos ship a `.env.example` now — the frontend's since 2026-08, `node-server`'s since 2026-09. If a variable name in this doc and the `.env.example` ever disagree, trust the `.env.example` and flag the doc.
- The backend has a jest suite as of 2026-09 (`npx jest` at the repo root) — run it before pushing backend changes. The frontend still has no tests or test runner.
- `obs-b2b-shared` is vendored in five places and each can be pinned independently — if you see a type error that looks like it shouldn't exist, check that all five pins match (`git submodule status` in each repo).
- Two AWS accounts exist (`obs-b2b-prod`, `obs-b2b-dev`) and the CDK app now supports per-developer namespaced stacks via required `-c stage=<name>` context (see `spec/infra/environments.spec.md`). `obs-b2b-prod` is a brand-new, empty account — it is **not** the account currently running the live system (see `known-issues.md`); migrating there is a separate, not-yet-done task.
- A personal dev stack now works end to end for the main API and auth (2026-09-11); the async Lambda pipeline still needs a dev-scoped Mongo secret that doesn't exist yet (see `known-issues.md`).
- A first `cdk deploy` on a fresh clone fails unless `./scripts/build-all.sh` has been run first — see step 4.
- `SignUp.tsx` in the frontend has a known bug sending the wrong tenant slug to the backend on account creation (see `known-issues.md`).
