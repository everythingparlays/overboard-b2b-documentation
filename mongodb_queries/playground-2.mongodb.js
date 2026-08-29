// MongoDB Playground — seed per-developer B2B collections in obs-b2b-dev
// READS from PBingo-fullappdev-database. $merge only ever writes to `into.db`.

use("PBingo-fullappdev-database");

const SOURCE_DB = "PBingo-fullappdev-database";
const TARGET_DB = "obs-b2b-dev";

// One prefixed set per developer — matches B2B_COLLECTION_PREFIX in lib/config/environments.ts.
// Add a name here when someone joins.
const DEVELOPERS = ["nick", "arthur"];

const COPY = [
  { from: "cdk_test_b2b_organizations", to: "organizations" },
  { from: "cdk_test_b2b_contests",      to: "contests" },
  { from: "cdk_test_b2b_users",         to: "users" },
  { from: "cdk_test_b2b_boards",        to: "bingo_boards" },
  { from: "cdk_test_b2b_prize_tiers",   to: "bingo_prize_tiers" },
  { from: "cdk_test_prize_redemptions", to: "bingo_prize_redemptions" }
];

// autoIndex:false means the app never creates these. Declared in b2b_models.ts
// and prize-worker/src/prize-redemption-model.ts.
const INDEXES = [
  { coll: "organizations",           keys: { subdomain: 1 },                                     opts: { unique: true } },
  { coll: "users",                   keys: { clerkUserId: 1 },                                   opts: { unique: true } },
  { coll: "users",                   keys: { email: 1, organizationId: 1 },                      opts: { unique: true } },
  { coll: "bingo_boards",            keys: { clerkUserId: 1 },                                   opts: {} },
  { coll: "bingo_prize_redemptions", keys: { userId: 1, contestId: 1, tierIndex: 1, boardId: 1 }, opts: { unique: true } }
];

if (TARGET_DB === SOURCE_DB) throw new Error("ABORT: target is the source database.");

const source = db.getSiblingDB(SOURCE_DB);
const target = db.getSiblingDB(TARGET_DB);

DEVELOPERS.forEach(function (dev) {
  const prefix = dev + "_";
  print("--- " + dev + " ---");

  COPY.forEach(function (c) {
    const to = prefix + c.to;
    source.getCollection(c.from).aggregate([
      { $merge: { into: { db: TARGET_DB, coll: to }, on: "_id",
                  whenMatched: "replace", whenNotMatched: "insert" } }
    ]).toArray();
    print("  " + to + ": " + target.getCollection(to).estimatedDocumentCount());
  });

  INDEXES.forEach(function (i) {
    const coll = prefix + i.coll;
    try {
      target.getCollection(coll).createIndex(i.keys, i.opts);
      print("  index " + coll + " " + JSON.stringify(i.keys));
    } catch (e) {
      // Reported, not fatal — one unsatisfiable index shouldn't abort the seed.
      print("  INDEX FAILED " + coll + " " + JSON.stringify(i.keys) + " -> " + e.message);
    }
  });
});

print("done");