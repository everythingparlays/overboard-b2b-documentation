// Backfills the tenant-config fields added by the identity/membership split onto existing
// B2BOrganization documents: optIns: [], signupFields: [], authVariant: "email".
//
// Why it is needed: Mongoose applies schema defaults on WRITE, not on read of an existing
// document, and the API's read path uses .lean(). Without this, organizations created before
// the change return undefined for fields the TypeScript interface declares as required.
//
// Idempotent — the $exists guards mean re-running changes nothing. Safe to run repeatedly.
//
// Scope: DEV ONLY. obs-b2b-prod is deliberately excluded; production data changes go through
// a separate, reviewed process (see AGENTS.md contributor boundaries).
//
// This backfills STRUCTURE, not content. It does not invent opt-in copy: consent text is a
// legal artifact tied to each tenant's sponsor DPAs (PRD OPT-05) and must be authored with
// product and legal. Every tenant correctly starts with zero opt-ins.
//
// Also creates the indexes for the new fans / fan_memberships collections — required,
// because node-server connects with autoIndex:false and never creates them itself.
//
// Implements cutover step 1 of
// spec/core-modules/1-draft/multi-tenant-identity-auth.spec.md

use("obs-b2b-dev");

const TARGET_DB = "obs-b2b-dev";

if (/prod/i.test(TARGET_DB)) {
  throw new Error("ABORT: refusing to run against a database whose name contains 'prod'.");
}

const target = db.getSiblingDB(TARGET_DB);

// Every developer's personal stack prefixes its own collections (B2B_COLLECTION_PREFIX), so
// there is one organizations collection per developer — nick_organizations, arthur_organizations.
// Discovered rather than hardcoded so this keeps working as developers join or leave.
const orgCollections = target
  .getCollectionNames()
  .filter(function (n) { return /(^|_)organizations$/.test(n); });

if (orgCollections.length === 0) {
  print("No *organizations collections found in " + TARGET_DB + " — nothing to do.");
}

orgCollections.forEach(function (collName) {
  const coll = target.getCollection(collName);

  const pending = coll
    .find(
      { $or: [
          { optIns:       { $exists: false } },
          { signupFields: { $exists: false } },
          { authVariant:  { $exists: false } },
      ] },
      { subdomain: 1, name: 1 }
    )
    .toArray();

  if (pending.length === 0) {
    print(collName + ": already backfilled, no changes.");
    return;
  }

  print(collName + ": backfilling " + pending.length + " organization(s):");
  pending.forEach(function (o) { print("  - " + o.subdomain + " (" + o.name + ")"); });

  // Three separate updates rather than one $set: an organization missing only authVariant
  // must not have its already-authored optIns reset to [].
  const r1 = coll.updateMany({ optIns:       { $exists: false } }, { $set: { optIns: [] } });
  const r2 = coll.updateMany({ signupFields: { $exists: false } }, { $set: { signupFields: [] } });
  const r3 = coll.updateMany({ authVariant:  { $exists: false } }, { $set: { authVariant: "email" } });

  print(
    "  modified — optIns: " + r1.modifiedCount +
    ", signupFields: " + r2.modifiedCount +
    ", authVariant: " + r3.modifiedCount
  );
});

// ---------------------------------------------------------------------------------------
// Indexes for the new identity/membership collections.
//
// These are NOT optional. node-server connects with `autoIndex: false` (see db.ts), so the
// index declarations in the Mongoose schemas never run — the unique constraints that make
// "one identity across tenants" and "one membership per fan per tenant" true exist only if
// they are created here. Without them a double-submit creates two memberships and nothing
// objects.
//
// Idempotent: createIndex on an existing identical index is a no-op.
// ---------------------------------------------------------------------------------------

const prefixes = orgCollections.map(function (n) {
  return n.replace(/organizations$/, "");
});

prefixes.forEach(function (prefix) {
  const fans = target.getCollection(prefix + "fans");
  const memberships = target.getCollection(prefix + "fan_memberships");

  // One platform identity per Clerk user (IDN-01).
  fans.createIndex({ clerkUserId: 1 }, { unique: true });
  fans.createIndex({ email: 1 });

  // One membership per fan per tenant — the pair that makes IDN-01 and IDN-03 true at once.
  memberships.createIndex({ fanId: 1, organizationId: 1 }, { unique: true });
  // Tenant-scoped listing for reporting; the compound index above cannot serve it.
  memberships.createIndex({ organizationId: 1 });

  print("indexes ensured for prefix '" + prefix + "'");
});

// Verification: every organization should now carry all three fields.
orgCollections.forEach(function (collName) {
  const remaining = target.getCollection(collName).countDocuments({
    $or: [
      { optIns:       { $exists: false } },
      { signupFields: { $exists: false } },
      { authVariant:  { $exists: false } },
    ],
  });
  print(collName + ": " + remaining + " document(s) still missing config fields (expect 0).");
});
