# Workspace Setup

This is the onboarding guide for a new engineer joining the OBS B2B platform. It sets up all three repos, side by side, in one workspace folder.

If anything here is out of date or doesn't match what you find, that's useful signal — flag it so this doc (and possibly [`documents/POC-baseline/known-issues.md`](documents/POC-baseline/known-issues.md)) can be corrected.

## What You're Setting Up

Three repos, cloned as siblings in one folder:

| Repo | Purpose | Remote |
|---|---|---|
| `overboardb2b-documentation` | Specs, PRD, architecture docs (this repo) | `github.com/everythingparlays/overboard-b2b-documentation` |
| `overboard-b2b-template` | Frontend — fan-facing web app | `github.com/everythingparlays/overboard-b2b-template` |
| `overboard_sports_backend` | Backend API, workers, AWS infra (CDK) | `github.com/nickdep217/overboard_sports_backend` |

> The backend repo is currently hosted under a personal account (`nickdep217`), not the `everythingparlays` org — worth knowing so you don't search for it in the wrong place. Ask if this is expected to move.

```
obs-b2b-workspace/                     <- pick any name for this folder
├── overboardb2b-documentation/
├── overboard-b2b-template/
│   ├── core/                          <- git submodule
│   └── pb-shared-deps/                <- git submodule
└── overboard_sports_backend/
    ├── lambdas/pb-shared-deps/            <- git submodule
    ├── node-server/src/pb-shared-deps/    <- git submodule
    └── prize-worker/pb-shared-deps/       <- git submodule
```

Both app repos depend on a shared `pb-shared-deps` repo (TypeScript interfaces + Mongoose schemas shared between frontend and backend), pulled in as a git submodule — the frontend also pulls in a second submodule, `core` (shared UI/layout components), from `overboard-b2b-shared-deps`. These submodules are vendored **separately in four places** across the two repos and are not currently kept in lockstep — see [`known-issues.md`](documents/POC-baseline/known-issues.md) if you hit confusing type mismatches.

## Prerequisites

Before you start, make sure you have:

- **Git**, with access to the `everythingparlays` GitHub org (and the backend repo above)
- **A GitHub Personal Access Token (PAT)** with repo access — the submodules (`pb-shared-deps`, `overboard-b2b-shared-deps`) are private, and cloning/updating them requires authenticated access. Ask a teammate to generate one for you if you don't have one.
- **Node.js 20+** and npm
- **Docker**, installed and running — required for backend CDK asset builds
- **AWS CLI** — only needed if you'll be deploying/inspecting the backend infra. Access goes through IAM Identity Center, not static credentials — ask Nick to add you to the `obs-b2b-dev-deployers` group, then see "AWS Access Setup" under step 4 below.
- **CDK CLI** (`npm install -g aws-cdk`, or use `npx cdk`) — backend only
- **A Clerk Dashboard invite** — ask for access to get a publishable key (frontend) and secret key (backend)
- **MongoDB Atlas access / connection string** — ask for this; there's no self-serve way to get it from the repos alone

No `.env.example` file exists in either app repo today, so the variable names below are taken directly from the source — you'll still need to get actual values (keys, connection strings) from a teammate.

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

**Initialize submodules** (`core`, `pb-shared-deps`). Since they're private, use your PAT:

```bash
git submodule set-url core https://<YOUR_GITHUB_PAT>@github.com/everythingparlays/overboard-b2b-shared-deps.git
git submodule set-url pb-shared-deps https://<YOUR_GITHUB_PAT>@github.com/everythingparlays/pb-shared-deps.git
git submodule update --init --recursive
```

(This is the same pattern the repo's own `vercel-install.sh` uses for CI — if you have SSH access to these repos configured instead, a plain `git submodule update --init --recursive` will work without the URL rewrite.)

**Environment variables** — create `.env` in the repo root:

```bash
VITE_CLERK_PUBLISHABLE_KEY=   # from Clerk Dashboard
VITE_API_BASE_URL=            # e.g. http://localhost:3000 to point at a local backend
VITE_TENANT_SLUG=             # which tenant to simulate locally — defaults to "test" if unset; see src/config/tenants/
```

**Install and run:**

```bash
npm install
npm run dev
```

## 4. Clone and Set Up the Backend

```bash
cd ..
git clone https://github.com/nickdep217/overboard_sports_backend.git
cd overboard_sports_backend
```

**Initialize submodules** — there are three separate `pb-shared-deps` checkouts in this repo:

```bash
git submodule update --init --recursive
```

(If they're not already configured with a token/SSH, apply the same `git submodule set-url ... https://<YOUR_GITHUB_PAT>@...` pattern as step 3 for each of the three paths in `.gitmodules`.)

**Install CDK app dependencies:**

```bash
npm install
npm run build
```

### Running `node-server` locally (the API)

```bash
cd node-server
export CLERK_SECRET_KEY=sk_test_...              # from Clerk Dashboard
export MONGODB_CONNECTION_STRING=...              # ask a teammate
export MONGODB_DATABASE_NAME=...                  # ask a teammate
export FRONTEND_ORIGIN=http://localhost:5173      # optional; comma-separated allowlist, matches your local Vite dev server port
npm run build && npm start
# Server on http://localhost:3000 by default (PORT env var to override)
```

Point your local frontend's `VITE_API_BASE_URL` at `http://localhost:3000` to talk to this.

### AWS Access Setup (Identity Center)

Backend infra access goes through **IAM Identity Center**, not individual IAM users or long-lived access keys — this keeps offboarding clean (removing someone from one group cuts off access everywhere, instead of hunting down keys someone was handed once and forgot about). See [`known-issues.md`](documents/POC-baseline/known-issues.md) for why this was chosen over plain IAM users.

**Prerequisite:** ask Nick to add you to the `obs-b2b-dev-deployers` group in Identity Center. Nothing below works until that's done.

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

**Not yet functional end-to-end, even with the above:** two real prerequisites don't exist yet —
- A dev-scoped MongoDB secret in `obs-b2b-dev`. Without it, the async pipeline (board-evaluator / prop-update-evaluator Lambdas) will throw at runtime — they require `MONGODB_SECRET_ARN`, with no IAM fallback. (The main API / node-server doesn't need this — it uses Atlas IAM auth via its task role instead.)
- A non-production Clerk instance. Without it, node-server comes up with no auth configured.

Both are tracked in [`known-issues.md`](documents/POC-baseline/known-issues.md). Until they're resolved, a personal stack will deploy successfully but won't be fully usable — check there before assuming something you did wrong.

See the backend repo's own `README.md` for full CDK deploy options (`mongodbSecretArn`, `dlqAlertPhoneNumber` context flags, etc.) — this workspace guide only covers getting things running locally.

## Boundaries — Read This Before Your First PR

A few things are off-limits for new contributors (interns especially) by default, because the blast radius extends outside what you can see or test from this workspace:

- **Don't edit inside the `pb-shared-deps` or `core` submodule directories.** `pb-shared-deps` is shared across the D2C mobile app, the website, and every B2B service — a change there can silently break products that aren't part of this workspace and that you have no way to test. `core` is lower-risk (B2B-only, and slated to be merged directly into `overboard-b2b-template` anyway — see [`known-issues.md`](documents/POC-baseline/known-issues.md)) but still shared with the backend today. If a task seems to need a change inside either, **stop and ask** rather than fixing it inline as part of an unrelated ticket — it should go through whoever owns that repo, not through a PR to the app repo that happens to touch the submodule.
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

- No `.env.example` in either app repo — variable names above were reverse-engineered from source, not documented by the original authors.
- The four `pb-shared-deps`/`core` submodule checkouts across the two repos are pinned to different commits — if you see a type error that looks like it shouldn't exist, this drift is a likely cause.
- Two AWS accounts exist (`obs-b2b-prod`, `obs-b2b-dev`) and the CDK app now supports per-developer namespaced stacks via required `-c stage=<name>` context (see `spec/infra/environments.spec.md`). `obs-b2b-prod` is a brand-new, empty account — it is **not** the account currently running the live system (see `known-issues.md`); migrating there is a separate, not-yet-done task.
- A personal dev stack deploys successfully but isn't fully functional yet — no dev-scoped Mongo secret or non-prod Clerk instance exists, so the async Lambda pipeline and auth won't work until those are created (see `known-issues.md`).
- `SignUp.tsx` in the frontend has a known bug sending the wrong tenant slug to the backend on account creation (see `known-issues.md`).
