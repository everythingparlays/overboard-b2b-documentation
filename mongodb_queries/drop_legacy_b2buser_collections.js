// Drops the legacy B2BUser collections (<prefix>users), replaced by <prefix>fans and
// <prefix>fan_memberships in cutover step 5 of
// spec/core-modules/1-draft/multi-tenant-identity-auth.spec.md
//
// B2BUser conflated platform identity with per-tenant membership. Its uniquely-indexed
// clerkUserId is what made one identity able to hold only one tenant — the defect the split
// exists to remove. The records are disposable (dev data, plus a handful of POC-era rows),
// so there is no migration: the collections are simply dropped.
//
// DEV ONLY. obs-b2b-prod is excluded deliberately; production data changes go through a
// separate, reviewed process (see AGENTS.md contributor boundaries).
//
// DESTRUCTIVE and NOT idempotent in the way the backfill is — it deletes data. It reports
// what it would drop and requires CONFIRM to be flipped to true before it drops anything.

use("obs-b2b-dev");

const TARGET_DB = "obs-b2b-dev";
const CONFIRM = false;   // <-- set to true to actually drop

if (/prod/i.test(TARGET_DB)) {
  throw new Error("ABORT: refusing to run against a database whose name contains 'prod'.");
}

const target = db.getSiblingDB(TARGET_DB);

const legacy = target
  .getCollectionNames()
  .filter(function (n) { return /(^|_)users$/.test(n); });

if (legacy.length === 0) {
  print("No legacy *users collections found in " + TARGET_DB + " — nothing to do.");
}

legacy.forEach(function (name) {
  const count = target.getCollection(name).estimatedDocumentCount();
  const prefix = name.replace(/users$/, "");
  const fans = target.getCollection(prefix + "fans").estimatedDocumentCount();
  const memberships = target.getCollection(prefix + "fan_memberships").estimatedDocumentCount();

  print(name + ": " + count + " document(s)");
  print("  replacement: " + prefix + "fans=" + fans + ", " + prefix + "fan_memberships=" + memberships);

  if (!CONFIRM) {
    print("  DRY RUN — set CONFIRM = true to drop.");
    return;
  }
  target.getCollection(name).drop();
  print("  dropped.");
});
