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
- **AWS CLI**, configured with credentials — only needed if you'll be deploying/inspecting the backend infra. Ask for access.
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

### Deploying backend infra (only if you're working on infra)

You'll need AWS credentials with access to the target account, then:

```bash
npx cdk bootstrap   # first time only
npx cdk deploy
```

See the backend repo's own `README.md` for full CDK deploy options (`mongodbSecretArn`, `dlqAlertPhoneNumber` context flags, etc.) — this workspace guide only covers getting things running locally.

## 5. Sanity Check

- Frontend dev server loads at `http://localhost:5173` (or whatever Vite reports) without the "missing environment variables" error screen.
- `http://localhost:3000/health` returns `{"status":"ok"}` from the local backend.
- Signing up / signing in via the frontend against your local backend succeeds (confirms Clerk keys + Mongo connection are correct).

If any of this doesn't work and the cause isn't obvious, check [`documents/POC-baseline/`](documents/POC-baseline/) first — several known gaps (missing env var docs, submodule drift, an existing tenant-slug bug) are already documented there and may be the cause rather than something wrong with your setup.

## Known Rough Edges (Worth Knowing Before You Debug for an Hour)

These aren't setup mistakes — they're pre-existing gaps documented in [`documents/POC-baseline/known-issues.md`](documents/POC-baseline/known-issues.md):

- No `.env.example` in either app repo — variable names above were reverse-engineered from source, not documented by the original authors.
- The four `pb-shared-deps`/`core` submodule checkouts across the two repos are pinned to different commits — if you see a type error that looks like it shouldn't exist, this drift is a likely cause.
- There's only one AWS environment (no dev/staging split) — be careful with `cdk deploy` if you're not sure which account/stack you're pointed at.
- `SignUp.tsx` in the frontend has a known bug sending the wrong tenant slug to the backend on account creation (see `known-issues.md`).
