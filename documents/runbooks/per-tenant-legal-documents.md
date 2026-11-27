# Per-tenant Terms, Rules and Privacy: plan and rollout

Decided 2026-11-27. Branch `feature/per-tenant-legal` in `obs-b2b-shared`, `overboard_sports_backend`,
`obs-b2b-admin-frontend` and this repo. The fan app needs no code change.

## What changes

Until now the three legal documents behind the locked `overboard-terms` opt-in were one shared set
(`consent_versions` rows with `organizationId: null`), and one publish moved every tenant and
re-asked every fan on every team.

From this change:

- Each tenant has its own Terms of Service, Rules and Privacy Policy, stored as that tenant's own
  `consent_versions` rows.
- Overboard staff publish them per tenant, from the tenant's Fields & Opt-ins page in the console.
  Only that tenant's fans are re-asked. Tenant admins cannot edit them.
- There is no shared template. Staff copy and upload the documents for each tenant.
- The consent sentence and the opt-in id `overboard-terms` are unchanged.

## What does not change

- No existing record is modified: not a fan's `consents` or `consentHistory`, and not any existing
  `consent_versions` row. There is no data migration and nothing to backfill.
- The shared rows stay as they are and are still read for the versions fans accepted before the
  change, so "Show wording" and the public versioned read keep showing exactly what a fan agreed to.
- A tenant keeps showing the shared documents until staff publish its own. That first publish
  re-asks the tenant's fans, which is accepted.

## How it works

The tenant's `overboard-terms` opt-in gains one field, `ownDocumentsFrom`: the first `textVersion`
whose documents are the tenant's own rows.

- Reading version N: the tenant's rows if `ownDocumentsFrom` is set and N is at or above it,
  otherwise the shared rows. In both cases the newest row at or below N.
- Publishing (`PUT /admin/platform-consent?tenant=<slug>`, staff only): writes an audit record, then
  a new row owned by the tenant at its version + 1, then moves that tenant's opt-in to the new
  version and sets `ownDocumentsFrom` if it was unset. A document the publish does not carry is
  copied forward from what the tenant shows now.
- New tenants are created with `ownDocumentsFrom: 1` and no documents. They show nothing until staff
  publish, and never the old shared text.

## Testing on dev

Dev (`nick_`) has no shared document rows today, so create prod's starting state first.

### Before deploying the new backend to the dev stack

1. With the current dev console, publish the three documents once (the old publish-to-all). This
   creates a shared row and moves every dev tenant to it, as prod is now.
2. As a fan, accept the terms on two dev tenants (for example `test` and `fightinghawks`). Note the
   version each accepted.

### Deploy

3. Deploy the backend branch to the dev stack, then point the dev console at the console branch.

### Nothing changed for anyone (the no-publish state)

4. Both fans load their tenant and are **not** shown the gate.
5. `/terms`, `/rules` and `/privacy` on both tenants show the same text as before the deploy.
6. In the console, each fan's page shows the same opt-in answer and version as before, and "Show
   wording" opens the shared text.
7. Save an unrelated change on the tenant's Fields & Opt-ins page (reorder a field). Fans are not
   re-asked.

### Publish for one tenant

8. On tenant A, staff open the locked opt-in. The button reads "Edit this team's documents" and the
   confirmation names tenant A only. Publish changed text.
9. Tenant A's fan sees the gate marked UPDATED, with tenant A's new text behind the links. After
   accepting, they can start a trivia run and generate a bingo board.
10. Before accepting, the same fan is refused a new run or board (409), as with any pending
    blocking consent today.
11. Tenant B's fan sees no gate. Tenant B's `/terms` still shows the old shared text.
12. Tenant A's fan page lists the new version as current and the earlier one as "Earlier wording".
    "Show wording" on the earlier one opens the old shared text; on the new one, tenant A's text.
13. Publish only Rules for tenant A again. Terms and Privacy carry over unchanged, the version goes
    up by one, and the fan is re-asked once.
14. A tenant admin (not staff) sees the documents read-only, with no edit button.

### New tenant

15. Create a tenant. Its `/terms` shows "This page isn't available", not another team's text. After
    staff publish its documents, a new fan sees them at the gate.

### Data checks (read-only, on dev)

16. The shared rows are byte-identical to before: same count, same `_id`s, same bodies.
17. Every membership's `consents` and `consentHistory` entries from before the deploy are unchanged;
    the only additions are the new acceptances made in steps 9 and 13.
18. Tenant A's opt-in has `ownDocumentsFrom` equal to the first version it published; tenant B's has
    none.
19. There is one audit record per publish, naming the tenant, and it contains no document text.

## Prod rollout

No script runs against prod and there is no data migration. Nick performs each step.

State on 2026-11-27: the change is on `main` in all five repos and all five `obs-b2b-shared` pins
are on `a71b5eb`. No `release` branch has it. Dev checks passed, including a tenant on shared
documents publishing its own while a second tenant stayed on the shared ones.

### Timing

Do none of the steps below while a contest is live. The change itself alters nothing for fans
until someone publishes, but a backend deploy replaces every API task and empties the in-memory
caches, and the publish in step 6 blocks new trivia runs and bingo boards for that team's fans until
they accept.

### Order (it matters)

The console must not reach prod before the backend. The new console sends `?tenant=` with a
publish; the old backend ignores it and publishes for every team at once, re-asking every fan.

1. Wait for the contest to end and be finalized.
2. Backend: fast-forward `release` to `main`, then `./scripts/deploy.sh prod`. Besides this
   change, `release` picks up two dev-only scaling commits that do not alter prod's configuration.
3. Check, before anything else: Wild's and the Hawks' `/terms`, `/rules` and `/privacy` show the
   same text as before; a signed-in fan gets no gate; one fan page's "Show wording" still opens.
4. Console: fast-forward `release` to `main`. Vercel builds prod from `release`.
5. Fan app: fast-forward `release` to `main` (the pin only). This can wait for the next fan app
   release; nothing depends on it.
6. When a team's own documents are ready, publish them from that team's page, outside a contest.
   That team's fans are re-asked on their next visit; the other team is not.

### Rollback

Before step 6 the old backend and console can be redeployed with no effect on data. After a
tenant's first own publish, the old backend would show that tenant the old shared text for its new
version, so from then on fix forward.

## Known gaps

- Four prod fans accepted version 1, whose wording was never stored. That is unchanged.
- The endpoint, request type and audit action keep "platform" in their names. Renaming them is a
  follow-up that touches the shared contract.
- `spec/core-modules/1-draft/admin-fields-and-optins.spec.md` and `spec/webapp/entry-gate.spec.md`
  still describe the shared publish and need a revision.
