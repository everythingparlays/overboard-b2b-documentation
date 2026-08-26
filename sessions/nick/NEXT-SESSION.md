# Nick — Next Session

Written 2026-08-26. What happened previously: [`HISTORY.md`](HISTORY.md). Context for everything below lives in [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md) and [`environments.spec.md`](../../spec/infra/environments.spec.md).

## Where things stand

Both AWS accounts, Identity Center access, Clerk secrets, and all six Atlas database users are done. CDK is stage-parameterized and no longer needs an Atlas API key. **Nothing is deployed yet** — no databases exist, no triggers exist.

## Start here, in order

- [ ] **Commit the docs repo.** It has never had a commit; everything from the last session is uncommitted working tree.

- [ ] **Set up the six Atlas Database Triggers by hand** (three source collections × `obs-b2b-prod` / `obs-b2b-dev`). Function shape, required settings (**Full Document** and **Auto-Resume** both on), and the `_id`-preservation constraint are in the spec's "Replication Design". This is the biggest remaining piece and everything downstream depends on it.

- [ ] **Backfill before or alongside enabling triggers.** Triggers only fire on *future* changes — without a one-time `mongodump`/`mongorestore` (renaming to `readonly_*`, preserving `_id`), the mirrors start empty and fill in only as documents happen to be touched. Then verify the `{ betEventId: 1, entityInfo: 1 }` index landed on both `readonly_props` copies.

- [ ] **Resolve what `stage=prod` should point at.** Config currently sends prod to the *new, empty* AWS account but the *old* `PBingo-fullappdev-database` — deliberate (that's where the data is), but it means a `stage=prod` deploy today creates empty infrastructure against live data. Decide whether prod cuts over to `obs-b2b-prod` as part of this work or stays put until a separate migration.

- [ ] **Dev cutover and first real deploy.** Point dev at `obs-b2b-dev`, set `LEGACY_COLLECTION_PREFIX=readonly`, seed config-only data under a `dev-nick` tenant (**not** `users`/`boards`/`prize_redemptions` — real fan PII), then `cdk deploy -c stage=nick` and exercise the full flow. Docker must be running.

- [ ] **Update the Lambda connector to support IAM auth if possible.** `pb-shared-deps/utils/lambda/db_connector_from_uri.ts` only supports `MONGODB_SECRET_ARN`; it needs a `MONGODB-AWS` path to match how ECS authenticates. Until then a dev stack's ECS services connect but the async prize pipeline does not. Note this is a **shared submodule** change — check other consumers before touching it. If IAM turns out not to be workable there, fall back to a dev-scoped Mongo secret and record why.

## Deferred (tracked, not blocking)

See [`documents/POC-baseline/known-issues.md`](../../documents/POC-baseline/known-issues.md): tightening the Atlas app roles from database-wide `readWrite` to per-collection scoping, and the `cdk_test_` → clean collection rename.
