# Nick — Next Session

Written 2026-08-26. What happened previously: [`HISTORY.md`](HISTORY.md). Context for everything below lives in [`mongodb-access-isolation.spec.md`](../../spec/core-modules/2-approved/mongodb-access-isolation.spec.md) and [`environments.spec.md`](../../spec/infra/environments.spec.md).

## Where things stand

Both AWS accounts, Identity Center access, Clerk secrets, and all six Atlas database users are done. CDK is stage-parameterized and no longer needs an Atlas API key. **Nothing is deployed yet** — no databases exist, no triggers exist.

## Start here, in order

- [ ] **Commit the docs repo.** It has never had a commit; everything from the last session is uncommitted working tree.

- [ ] **Set up the six Atlas Database Triggers by hand** (three source collections × `obs-b2b-prod` / `obs-b2b-dev`). Function shape, required settings (**Full Document** and **Auto-Resume** both on), and the `_id`-preservation constraint are in the spec's "Replication Design". This is the biggest remaining piece and everything downstream depends on it.

- [ ] **Backfill with `$merge` after enabling triggers.** Triggers only fire on *future* changes, so the mirrors start empty without this. Use a server-side `$merge` keyed on `_id` (six runs: three collections × two target databases) — commands are in the spec's cutover step 4. Then **create `{ betEventId: 1, entityInfo: 1 }` on both `readonly_props` copies by hand** — `$merge` copies documents, not indexes, and nothing else will create it.

- [ ] **Resolve what `stage=prod` should point at.** Config currently sends prod to the *new, empty* AWS account but the *old* `PBingo-fullappdev-database` — deliberate (that's where the data is), but it means a `stage=prod` deploy today creates empty infrastructure against live data. Decide whether prod cuts over to `obs-b2b-prod` as part of this work or stays put until a separate migration.

- [ ] **Seed per-developer B2B collections.** Collections are now stage-prefixed (`nick_organizations`, `nick_contests`, `nick_bingo_prize_tiers`) — one seeded set per developer, so schema changes in one stack can't affect another. Copy **config only**; never `users` / `bingo_boards` / `bingo_prize_redemptions` (real fan PII). Create the unique indexes too — `autoIndex:false` means the app won't.

- [ ] **Dev cutover and first real deploy.** `cdk deploy -c stage=nick` (Docker must be running), then exercise the full flow: list contests, draft a squad, generate a board, confirm props populate.

- [ ] **Update the Lambda connector to support IAM auth if possible.** `pb-shared-deps/utils/lambda/db_connector_from_uri.ts` only supports `MONGODB_SECRET_ARN`; it needs a `MONGODB-AWS` path to match how ECS authenticates. Until then a dev stack's ECS services connect but the async prize pipeline does not. Note this is a **shared submodule** change — check other consumers before touching it. If IAM turns out not to be workable there, fall back to a dev-scoped Mongo secret and record why.

- [ ] **Stand up `obs-b2b-shared`** — the B2B-owned replacement for `pb-shared-deps`. Design is settled in [`documents/HLDs/b2b-shared-deps.md`](../../documents/HLDs/b2b-shared-deps.md); nothing built yet. Start with a **clean copy** (not a fork of `pb-shared-deps` history) containing only what B2B actually imports. Key rule while writing it: `interfaces/` must not import Mongoose — ObjectId fields become `string`, Mongoose typing lives only in `models/`. That is what makes frontend sharing safe rather than accidental.

  Scope is only `interfaces/` + `api/` + `models/` — no runtime code. Board-generation logic (`createFilledBoard` et al.) and the response/connection helpers move into the services that use them instead. Reference models (`BettingProp`/`BetEvent`/`Entity`) get narrowed to only the fields B2B reads; derive that list from the code, not from the HLD's sample.

  Doing this also removes the need to resolve the `ecs-branch` vs `main` divergence in `pb-shared-deps` for B2B purposes — worth confirming nothing else depends on that branch before abandoning it.

## Deferred (tracked, not blocking)

See [`documents/POC-baseline/known-issues.md`](../../documents/POC-baseline/known-issues.md): tightening the Atlas app roles from database-wide `readWrite` to per-collection scoping.

The `cdk_test_` rename is **done in code** (collections are now `${prefix}bingo_boards` etc.) but not yet applied to any live data — it takes effect when the collections are first written under the new names.
