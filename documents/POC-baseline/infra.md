# Infra Baseline — AWS CDK (`overboard_sports_backend/lib`, `bin`)

> Part of [POC Baseline](README.md) — reflects the code as built during the POC phase, not target architecture.

## Stack

`aws-cdk-lib` `2.214.0` (pinned exact), `awscdk-resources-mongodbatlas` `^3.13.1` (community construct for Atlas). A **single** `OverboardSportsBackendStack` (`lib/application-stack.ts`), instantiated once in `bin/overboard-sports-backend.ts`. **There is no dev/staging/prod split** — no `-c stage=` pattern, no per-environment context files, one stack for everything.

`bin/overboard-sports-backend.ts` hardcodes account-specific config directly in source: AWS account ID and region, MongoDB Atlas org/project IDs and cluster hostname (`pbingo-dev.3yne0.mongodb.net` — a dev-tier-named cluster), and a personal phone number in plaintext for SMS alerts. None of these are credentials, but committing account/org identifiers and a personal phone number to source is a hygiene issue worth fixing before broader repo access.

## Provisioned Resources

### `shared-infrastructure.ts`
VPC (2 AZs, **1 NAT gateway** — single point of failure; a code comment notes it "can scale to 2 for HA," but hasn't been). Public + private subnets. ECS cluster with Container Insights enabled.

### `main-api-service.ts`
ALB (public subnets) → Fargate service running `node-server` (512 MiB / 256 CPU, 1 task, private subnets, no public IP). Health check on `/health`. MongoDB Atlas access via IAM auth (`CfnDatabaseUser` keyed to the task role, `readWrite` on one database). Clerk secrets injected via ECS `secrets` (Secrets Manager) — not plaintext env vars, this part is done correctly.

**HTTPS is opt-in and currently off**: the CDK code path for port 443 + HTTP→HTTPS redirect exists and is implemented correctly, but `certificateArn` is commented out in the checked-in `bin/` entry point, so as configured today the ALB serves **HTTP only** on port 80.

### `prize-delivery.ts`
3 SQS queues + 3 DLQs: `prop-hit` (standard), `board-evaluation` (standard), `prize-fulfillment` (FIFO, `contentBasedDeduplication: false`). Each DLQ → CloudWatch alarm (`ApproximateNumberOfMessagesVisible >= 1`) → SNS topic → optional SMS subscription.

Board-evaluator and prop-update-evaluator run as Lambdas (Node 20, esbuild-bundled, 256 MB, 55s timeout). **Debug logging is hardcoded to `'true'`** for both in the CDK construct itself (`DEBUG_*` env flags) — not actually toggleable without a code change, so it's effectively always on regardless of environment.

The prize evaluator is a **second Fargate service**, not a Lambda, despite the top-level README describing the whole pipeline as "Lambda workers" — see [`workers.md`](workers.md).

## MongoDB Atlas

Two different auth mechanisms are in play depending on service: ECS tasks (main API, prize-evaluator) authenticate via **AWS IAM** (`MONGODB-AWS` mechanism, `CfnDatabaseUser` per task role); Lambdas instead use a plain **connection-string secret** (`MONGODB_SECRET_ARN`). Which one is authoritative in the actual deployed environment couldn't be confirmed from code alone. Cluster tier/sizing itself isn't set anywhere in this CDK app — only database users are provisioned here, meaning the Atlas cluster itself is managed outside this repo.

## IAM

Reasonably scoped overall — separate task roles for the main API vs. prize-evaluator, Lambdas given only SQS consume/send plus conditional Secrets Manager read. One over-broad grant: the prize-evaluator task role has `ses:SendEmail`/`ses:SendRawEmail` on `resources: ['*']`, not scoped to a specific SES identity/ARN.

## CORS / Network Config

`FRONTEND_ORIGIN` (comma-separated allowlist) drives CORS in `node-server`; in the checked-in `bin/` entry point it's hardcoded to `localhost` dev URLs only — no production frontend origin is configured in-repo for this (would need to be supplied at deploy time some other way; unverifiable from code alone).

## Observability at the Infra Layer

CloudWatch log groups exist (1-week retention) for node-server, the prize-evaluator task, and both Lambdas via CDK defaults. **Alarms exist only on the three DLQs.** No alarms on ALB 5xx rate, ECS task health/CPU/memory, Lambda errors/throttles, or Mongo connection failures. Container Insights is enabled (gives default ECS metrics) but nothing alarms on them. No APM/tracing (no X-Ray, no OpenTelemetry) anywhere in the stack.

## Testing

The CDK app's own test suite (`test/overboard_sports_backend.test.ts`) is a single test with every assertion commented out — leftover boilerplate from `cdk init`, never filled in. No infra tests exist.

See [`known-issues.md`](known-issues.md) for how these gaps map to PRD `SEC-*`/`OBS-*` requirements.
