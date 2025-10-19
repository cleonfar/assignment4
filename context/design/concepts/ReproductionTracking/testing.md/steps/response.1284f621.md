---
timestamp: 'Thu Oct 16 2025 17:13:11 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_171311.da9917d4.md]]'
content_id: 1284f6212ef7a4d229687dd23b8cfb6a658c35a8b391e04ae615c430825b6803
---

# response:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts

import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts"; // Assuming @utils/database.ts exists and provides testDb
import ReproductionTrackingConcept from "./ReproductionTrackingConcept.ts";
import { ID } from "@utils/types.ts"; // Assuming ID type is imported from @utils/types.ts

Deno.test("ReproductionTrackingConcept - addMother action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  await t.step("should successfully add a new mother", async () => {
    const motherId = "mother:Molly" as ID;
    const result = await concept.addMother({ motherId: motherId as string });

    assertEquals(result, { motherId: motherId });

    // Verify state: mother should be in the mothers collection
    const addedMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(addedMother, { _id: motherId });
  });

  await t.step("should return an error if mother with ID already exists", async () => {
    const motherId = "mother:Alice" as ID;
    
    // First, add the mother successfully
    const firstAddResult = await concept.addMother({ motherId: motherId as string });
    assertEquals(firstAddResult, { motherId: motherId });

    // Try to add the same mother again
    const secondAddResult = await concept.addMother({ motherId: motherId as string });
    
    // Verify that it returns an error
    assertEquals(secondAddResult.error, `Mother with ID '${motherId}' already exists.`);
    assertEquals(secondAddResult.motherId, undefined);

    // Verify state: only one mother with this ID should exist in the collection
    const count = await concept.mothers.countDocuments({ _id: motherId });
    assertEquals(count, 1);
  });

  await client.close();
});

Deno.test("ReproductionTrackingConcept - removeMother action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  await t.step("should successfully remove an existing mother", async () => {
    const motherId = "mother:Daisy" as ID;

    // Pre-condition: Add the mother first
    const addResult = await concept.addMother({ motherId: motherId as string });
    assertEquals(addResult, { motherId: motherId });
    let addedMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(addedMother, { _id: motherId }, "Mother should exist before removal");

    // Perform the action: Remove the mother
    const removeResult = await concept.removeMother({ motherId: motherId as string });
    assertEquals(removeResult, { motherId: motherId });

    // Post-condition: Verify the mother is no longer in the collection
    const removedMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(removedMother, null, "Mother should no longer exist after removal");
  });

  await t.step("should return an error if mother with ID does not exist", async () => {
    const nonExistentMotherId = "mother:NonExistent" as ID;

    // Verify pre-condition: mother does not exist
    let nonExistentMother = await concept.mothers.findOne({ _id: nonExistentMotherId });
    assertEquals(nonExistentMother, null, "Mother should not exist initially");

    // Perform the action: Try to remove a non-existent mother
    const removeResult = await concept.removeMother({ motherId: nonExistentMotherId as string });

    // Verify that it returns an error
    assertEquals(removeResult.error, `Mother with ID '${nonExistentMotherId}' not found.`);
    assertEquals(removeResult.motherId, undefined);

    // Verify state: no mother should have been added or removed
    const count = await concept.mothers.countDocuments({ _id: nonExistentMotherId });
    assertEquals(count, 0, "No mother should have been added or removed");
  });

  await client.close();
});
```

### Proposed Trace for `removeMother`

**trace:**

1. **Action**: `addMother (motherId: "mother:Daisy")`
   * **Pre-state**: `mothers` collection is empty.
   * **Requires check**: `mother:Daisy` is not in `mothers` (true).
   * **Effects**: `mother:Daisy` is added to `mothers`.
   * **Post-state**: `mothers` collection contains `{ _id: "mother:Daisy" }`.
   * **Returns**: `{ motherId: "mother:Daisy" }`.

2. **Action**: `removeMother (motherId: "mother:Daisy")`
   * **Pre-state**: `mothers` collection contains `{ _id: "mother:Daisy" }`.
   * **Requires check**: `mother:Daisy` is in `mothers` (true).
   * **Effects**: `mother:Daisy` is removed from `mothers`.
   * **Post-state**: `mothers` collection is empty.
   * **Returns**: `{ motherId: "mother:Daisy" }`.

3. **Action**: `removeMother (motherId: "mother:NonExistent")`
   * **Pre-state**: `mothers` collection is empty.
   * **Requires check**: `mother:NonExistent` is in `mothers` (false).
   * **Effects**: No change to `mothers` collection.
   * **Post-state**: `mothers` collection is empty.
   * **Returns**: `{ error: "Mother with ID 'mother:NonExistent' not found." }`.
