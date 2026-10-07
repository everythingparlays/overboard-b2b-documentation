// Consent provenance (SEC-05): the latest answers per membership with the address and surface
// they were recorded with. Run in mongosh against obs-b2b-dev with your prefix:
//   mongosh "<connection>" --eval 'const PREFIX="nick_"' mongodb_queries/consent_provenance_check.js
// Records written before 2026-10-07 show ipAddress/method as undefined; that is expected.
const prefix = typeof PREFIX === "string" ? PREFIX : "nick_";
const memberships = db.getCollection(`${prefix}fan_memberships`);

print(`\n== ${prefix}fan_memberships: current answers ==`);
memberships
  .find({ "consents.0": { $exists: true } }, { displayName: 1, organizationId: 1, consents: 1, updatedAt: 1 })
  .sort({ updatedAt: -1 })
  .limit(20)
  .forEach((m) => {
    print(`${m._id}  ${m.displayName}  org=${m.organizationId}  updated=${m.updatedAt?.toISOString?.() ?? m.updatedAt}`);
    for (const c of m.consents) {
      print(`   ${c.optInId}@v${c.textVersion} ${c.decision}  at=${c.agreedAt?.toISOString?.()}  ip=${c.ipAddress ?? "-"}  method=${c.method ?? "-"}`);
    }
  });

print(`\n== answers recorded since the change, by surface ==`);
memberships
  .aggregate([
    { $unwind: "$consentHistory" },
    { $match: { "consentHistory.method": { $exists: true } } },
    { $group: { _id: { method: "$consentHistory.method", withIp: { $gt: ["$consentHistory.ipAddress", null] } }, n: { $sum: 1 } } },
  ])
  .forEach((r) => print(`   method=${r._id.method} withIp=${r._id.withIp} count=${r.n}`));
