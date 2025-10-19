---
timestamp: 'Thu Oct 16 2025 15:58:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_155835.5db3ba90.md]]'
content_id: 534560ea5bd419fa56af8ab8a3f981b54ed131d9a59ccb90e444dbd33b62450b
---

# response:

```typescript
  // M_ERR_WEANED_MORE: Simulate weaned > born (1 born, 2 weaned)
  // Will be detected by the AI's rule: totalOffspringWeaned > totalOffspringBorn
  const { litter: lEW } = await concept.recordLitter({ motherId: motherErrorWeanedMore, birthDate: new Date("2023-02-01"), reportedLitterSize: 2 });
  const { offspring: oEW1 } = await concept.recordOffspring({ litterId: lEW!._id, offspringId: `${motherErrorWeanedMore}_o1`, sex: Sex.Female });
  await concept.recordWeaning({ offspringId: oEW1!._id });
  // Manually insert a record for another offspring that is weaned but not born to simulate the error.
  // `generateReport` will see 2 weaned, but only 1 born for this litter.
  await (db.collection("ReproductionTracking.offspring") as Collection<Offspring>).insertOne({
      _id: `${motherErrorWeanedMore}_o2`,
      litterId: lEW!._id, // Linked to the same litter
      sex: Sex.Male,
      notes: "Simulated extra weaned offspring",
      isAlive: true,
      survivedTillWeaning: true,
  });
```
