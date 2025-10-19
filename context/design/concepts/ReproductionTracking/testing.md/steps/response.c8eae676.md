---
timestamp: 'Thu Oct 16 2025 16:03:56 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_160356.8636ed31.md]]'
content_id: c8eae6764fcb559bfa1910bd866935129796862c6be318cbd3c9dd7b3164459c
---

# response:

The issue is that `Offspring` is not exported, so you can't import it. However, to cast `db.collection` to `Collection<Offspring>`, TypeScript needs to know what `Offspring` is.

A robust way to handle this without exporting `Offspring` is to define a local interface in your test file that exactly matches the structure of `Offspring` from the concept. This interface will only be used within your test file.

Here's the minimal change:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts
import { Collection, Db, MongoClient } from "npm:mongodb";
import { assertEquals, assertExists, assertInstanceOf, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept, { Sex } from "./ReproductionTrackingConcept.ts"; // Removed Offspring import

// Define a local type that mirrors the Offspring interface for testing purposes.
// This allows you to type-assert the collection without exporting Offspring from the concept file.
interface OffspringForTest {
  _id: string;
  litterId: string;
  sex: Sex;
  notes?: string;
  isAlive: boolean;
  survivedTillWeaning: boolean;
}

// ... (rest of your test file)

    await t.step("should handle noticing record errors well", async () => {
      const motherErrorWeanedMore = "M_ERR_WEANED_MORE";
      // ... (other mother definitions)

      await concept.addMother({ motherId: motherErrorWeanedMore });
      // ... (other mother additions)

      // M_ERR_WEANED_MORE: Simulate weaned > born (1 born, 2 weaned)
      // Will be detected by the AI's rule: totalOffspringWeaned > totalOffspringBorn
      const { litter: lEW } = await concept.recordLitter({ motherId: motherErrorWeanedMore, birthDate: new Date("2023-02-01"), reportedLitterSize: 2 });
      const { offspring: oEW1 } = await concept.recordOffspring({ litterId: lEW!._id, offspringId: `${motherErrorWeanedMore}_o1`, sex: Sex.Female });
      await concept.recordWeaning({ offspringId: oEW1!._id });
      // Manually insert a record for another offspring that is weaned but not born to simulate the error.
      // `generateReport` will see 2 weaned, but only 1 born for this litter.
      await (db.collection("ReproductionTracking.offspring") as Collection<OffspringForTest>).insertOne({
          _id: `${motherErrorWeanedMore}_o2`,
          litterId: lEW!._id, // Linked to the same litter
          sex: Sex.Male,
          notes: "Simulated extra weaned offspring",
          isAlive: true,
          survivedTillWeaning: true,
      });

      // ... (rest of the aiSummary test step)
```
