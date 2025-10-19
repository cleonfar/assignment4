---
timestamp: 'Thu Oct 16 2025 17:08:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_170842.dcaf91de.md]]'
content_id: 64e407ad3bf2df1992eaf85dfd3a15061cd022ee34905fa982b3b98f5d8aa69e
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
```

### Proposed Trace for `addMother`

While the trace is typically for a sequence of actions demonstrating the `principle`, for a single action like `addMother`, a simple trace demonstrates its core behavior.

**trace:**

1. **Action**: `addMother (motherId: "mother:Molly")`
   * **Pre-state**: `mothers` collection is empty.
   * **Requires check**: `mother:Molly` is not in `mothers` (true).
   * **Effects**: `mother:Molly` is added to `mothers`.
   * **Post-state**: `mothers` collection contains `{ _id: "mother:Molly" }`.
   * **Returns**: `{ motherId: "mother:Molly" }`.

2. **Action**: `addMother (motherId: "mother:Molly")`
   * **Pre-state**: `mothers` collection contains `{ _id: "mother:Molly" }`.
   * **Requires check**: `mother:Molly` is not in `mothers` (false, as it already exists).
   * **Effects**: No change to `mothers` collection.
   * **Post-state**: `mothers` collection still contains `{ _id: "mother:Molly" }`.
   * **Returns**: `{ error: "Mother with ID 'mother:Molly' already exists." }`.
