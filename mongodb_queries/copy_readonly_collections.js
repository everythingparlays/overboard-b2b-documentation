// Replicates the test collections from the source database to the target databases. This is a one-time operation, and is not intended to be run repeatedly. It is idempotent, keyed on _id, and preserves _id values.


use("PBingo-fullappdev-database");

const SOURCE_DB = "PBingo-fullappdev-database";
const TARGET_DBS = ["obs-b2b-dev", "obs-b2b-prod"];

const COLLECTIONS = [
  { from: "cdk_test_betevents", to: "readonly_betevents" },
  { from: "cdk_test_props",     to: "readonly_props" },
  { from: "cdk_test_entities",  to: "readonly_entities" },
];

TARGET_DBS.forEach(function (targetDb) {
  if (targetDb === SOURCE_DB) throw new Error("ABORT: target is the source database.");
});

const source = db.getSiblingDB(SOURCE_DB);

COLLECTIONS.forEach(function (c) {
  TARGET_DBS.forEach(function (targetDb) {
    // Idempotent, keyed on _id. Preserving _id is required — B2B boards and
    // contests hold direct ObjectId refs to these documents.
    source.getCollection(c.from).aggregate([
      { $merge: { into: { db: targetDb, coll: c.to }, on: "_id",
                  whenMatched: "replace", whenNotMatched: "insert" } }
    ]).toArray();

    const count = db.getSiblingDB(targetDb).getCollection(c.to).estimatedDocumentCount();
    print(c.to + " -> " + targetDb + ": " + count);
  });
});

// $merge copies documents only, never indexes. Backs the board-generation query.
TARGET_DBS.forEach(function (targetDb) {
  db.getSiblingDB(targetDb).getCollection("readonly_props")
    .createIndex({ betEventId: 1, entityInfo: 1 });
});

print("done");