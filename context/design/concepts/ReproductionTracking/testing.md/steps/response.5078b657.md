---
timestamp: 'Thu Oct 16 2025 17:15:06 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_171506.af2efe8c.md]]'
content_id: 5078b65784bc81e3853d003e834e75f067050657a93d4cc827607b7f1aac9e64
---

# response:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts

import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts"; // Assuming @utils/database.ts exists and provides testDb
import ReproductionTrackingConcept from "./ReproductionTrackingConcept.ts";
import { ID } from "@utils/types.ts"; // Assuming ID type is imported from @utils/types.ts

// --- Tests for addMother and removeMother (from previous turns, included for completeness) ---

Deno.test("ReproductionTrackingConcept - addMother action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  await t.step("should successfully add a new mother", async () => {
    const motherId = "mother:Molly" as ID;
    const result = await concept.addMother({ motherId: motherId as string });

    assertEquals(result, { motherId: motherId });

    const addedMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(addedMother, { _id: motherId });
  });

  await t.step("should return an error if mother with ID already exists", async () => {
    const motherId = "mother:Alice" as ID;
    
    await concept.addMother({ motherId: motherId as string }); // First add
    const secondAddResult = await concept.addMother({ motherId: motherId as string });
    
    assertEquals(secondAddResult.error, `Mother with ID '${motherId}' already exists.`);
    assertEquals(secondAddResult.motherId, undefined);

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

    await concept.addMother({ motherId: motherId as string });
    let addedMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(addedMother, { _id: motherId }, "Mother should exist before removal");

    const removeResult = await concept.removeMother({ motherId: motherId as string });
    assertEquals(removeResult, { motherId: motherId });

    const removedMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(removedMother, null, "Mother should no longer exist after removal");
  });

  await t.step("should return an error if mother with ID does not exist", async () => {
    const nonExistentMotherId = "mother:NonExistent" as ID;

    let nonExistentMother = await concept.mothers.findOne({ _id: nonExistentMotherId });
    assertEquals(nonExistentMother, null, "Mother should not exist initially");

    const removeResult = await concept.removeMother({ motherId: nonExistentMotherId as string });

    assertEquals(removeResult.error, `Mother with ID '${nonExistentMotherId}' not found.`);
    assertEquals(removeResult.motherId, undefined);

    const count = await concept.mothers.countDocuments({ _id: nonExistentMotherId });
    assertEquals(count, 0, "No mother should have been added or removed");
  });

  await client.close();
});

// --- Tests for recordLitter ---

Deno.test("ReproductionTrackingConcept - recordLitter action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  await t.step("should successfully record a litter and auto-add a new mother", async () => {
    const motherId = "mother:NewMom" as ID;
    const fatherId = "father:Dad1" as ID;
    const birthDate = new Date("2023-01-15");
    const reportedLitterSize = 5;
    const notes = "First litter for NewMom";

    // Verify mother doesn't exist initially
    const preExistingMother = await concept.mothers.findOne({ _id: motherId });
    assertEquals(preExistingMother, null, "Mother should not exist before action");

    const result = await concept.recordLitter({
      motherId: motherId as string,
      fatherId: fatherId as string,
      birthDate,
      reportedLitterSize,
      notes,
    });

    assertExists(result.litterID, "Litter ID should be returned");
    assertNotEquals(result.litterID, undefined);
    assertEquals(result.error, undefined);

    // Verify the litter was added
    const newLitter = await concept.litters.findOne({ _id: result.litterID });
    assertExists(newLitter);
    assertEquals(newLitter?.motherId, motherId);
    assertEquals(newLitter?.fatherId, fatherId);
    assertEquals(newLitter?.birthDate.toISOString(), birthDate.toISOString());
    assertEquals(newLitter?.reportedLitterSize, reportedLitterSize);
    assertEquals(newLitter?.notes, notes);

    // Verify the mother was auto-added
    const addedMother = await concept.mothers.findOne({ _id: motherId });
    assertExists(addedMother, "Mother should have been auto-added");
    assertEquals(addedMother?._id, motherId);
  });

  await t.step("should successfully record a litter with an existing mother", async () => {
    const motherId = "mother:ExistingMom" as ID;
    const fatherId = "father:Dad2" as ID;
    const birthDate = new Date("2023-02-20");
    const reportedLitterSize = 7;

    // Pre-condition: Add the mother first
    await concept.addMother({ motherId: motherId as string });
    const initialMotherCount = await concept.mothers.countDocuments({ _id: motherId });
    assertEquals(initialMotherCount, 1, "Mother should exist before action");

    const result = await concept.recordLitter({
      motherId: motherId as string,
      fatherId: fatherId as string,
      birthDate,
      reportedLitterSize,
    });

    assertExists(result.litterID, "Litter ID should be returned");
    assertEquals(result.error, undefined);

    // Verify the litter was added
    const newLitter = await concept.litters.findOne({ _id: result.litterID });
    assertExists(newLitter);
    assertEquals(newLitter?.motherId, motherId);

    // Verify no new mother was added (count remains 1)
    const finalMotherCount = await concept.mothers.countDocuments({ _id: motherId });
    assertEquals(finalMotherCount, 1, "No new mother should have been added");
  });

  await t.step("should successfully record a litter without a father", async () => {
    const motherId = "mother:SingleMom" as ID;
    const birthDate = new Date("2023-03-01");
    const reportedLitterSize = 3;

    await concept.addMother({ motherId: motherId as string });

    const result = await concept.recordLitter({
      motherId: motherId as string,
      birthDate,
      reportedLitterSize,
      fatherId: undefined, // Explicitly pass undefined
    });

    assertExists(result.litterID, "Litter ID should be returned");
    assertEquals(result.error, undefined);

    // Verify the litter was added and fatherId is undefined/absent
    const newLitter = await concept.litters.findOne({ _id: result.litterID });
    assertExists(newLitter);
    assertEquals(newLitter?.motherId, motherId);
    assertEquals(newLitter?.fatherId, undefined, "fatherId should be undefined/absent");
  });

  await t.step("should return an error for duplicate litter (mother, father, birthDate)", async () => {
    const motherId = "mother:DuplicateMom1" as ID;
    const fatherId = "father:DuplicateDad1" as ID;
    const birthDate = new Date("2023-04-10");
    const reportedLitterSize = 6;

    // First, successfully record the litter
    await concept.recordLitter({
      motherId: motherId as string,
      fatherId: fatherId as string,
      birthDate,
      reportedLitterSize,
    });

    const initialLitterCount = await concept.litters.countDocuments({ motherId, fatherId, birthDate });
    assertEquals(initialLitterCount, 1, "Litter should exist before duplicate attempt");

    // Try to record the same litter again
    const secondResult = await concept.recordLitter({
      motherId: motherId as string,
      fatherId: fatherId as string,
      birthDate,
      reportedLitterSize: 5, // different size
    });

    assertExists(secondResult.error, "Error should be returned for duplicate");
    assertEquals(secondResult.litterID, undefined);
    assertEquals(secondResult.error, `A litter with mother ${motherId}, father ${fatherId}, and birth date ${birthDate.toISOString()} already exists.`);

    // Verify no new litter was added
    const finalLitterCount = await concept.litters.countDocuments({ motherId, fatherId, birthDate });
    assertEquals(finalLitterCount, 1, "Only one litter should exist");
  });

  await t.step("should return an error for duplicate litter (mother, no father, birthDate)", async () => {
    const motherId = "mother:DuplicateMom2" as ID;
    const birthDate = new Date("2023-05-25");
    const reportedLitterSize = 4;

    // First, successfully record the litter without a father
    await concept.recordLitter({
      motherId: motherId as string,
      birthDate,
      reportedLitterSize,
      fatherId: undefined,
    });

    // Manually query to confirm the fatherId field is indeed absent for the uniqueness check
    const litterFilter: { motherId: ID; fatherId?: { $exists: boolean }; birthDate: Date } = {
      motherId: motherId,
      birthDate: birthDate,
      fatherId: { $exists: false },
    };
    const initialLitterCount = await concept.litters.countDocuments(litterFilter);
    assertEquals(initialLitterCount, 1, "Litter (no father) should exist before duplicate attempt");

    // Try to record the same litter again (without father)
    const secondResult = await concept.recordLitter({
      motherId: motherId as string,
      birthDate,
      reportedLitterSize: 2, // different size
      fatherId: undefined,
    });

    assertExists(secondResult.error, "Error should be returned for duplicate");
    assertEquals(secondResult.litterID, undefined);
    assertEquals(secondResult.error, `A litter with mother ${motherId}, father none, and birth date ${birthDate.toISOString()} already exists.`);

    // Verify no new litter was added
    const finalLitterCount = await concept.litters.countDocuments(litterFilter);
    assertEquals(finalLitterCount, 1, "Only one litter (no father) should exist");
  });

  await client.close();
});
```

### Proposed Trace for `recordLitter`

**trace:**

1. **Action**: `recordLitter (motherId: "mother:NewMom", fatherId: "father:Dad1", birthDate: 2023-01-15, reportedLitterSize: 5, notes: "First litter")`
   * **Pre-state**: `mothers` collection is empty, `litters` collection is empty.
   * **Requires check**: `mother:NewMom` exists (false).
   * **Effects**:
     * `addMother` is implicitly called for `mother:NewMom`.
     * `mother:NewMom` is added to `mothers`.
     * A new litter `litter:xyz` is created linking `mother:NewMom` and `father:Dad1` with the given `birthDate`, `reportedLitterSize`, and `notes`.
   * **Post-state**:
     * `mothers` contains `{ _id: "mother:NewMom" }`.
     * `litters` contains `{ _id: "litter:xyz", motherId: "mother:NewMom", fatherId: "father:Dad1", birthDate: 2023-01-15, reportedLitterSize: 5, notes: "First litter" }`.
   * **Returns**: `{ litterID: "litter:xyz" }`.

2. **Action**: `recordLitter (motherId: "mother:SingleMom", birthDate: 2023-03-01, reportedLitterSize: 3)`
   * **Pre-state**: `mothers` contains `{ _id: "mother:SingleMom" }` (pre-added in a separate step). `litters` does not contain a litter for `mother:SingleMom` with `2023-03-01` and no father.
   * **Requires check**: `mother:SingleMom` exists (true). Duplicate litter (mother, no father, birthDate) does not exist (true).
   * **Effects**: A new litter `litter:abc` is created linking `mother:SingleMom` with `2023-03-01`, `reportedLitterSize`, and `fatherId` absent.
   * **Post-state**: `litters` contains `{ _id: "litter:abc", motherId: "mother:SingleMom", birthDate: 2023-03-01, reportedLitterSize: 3 }`.
   * **Returns**: `{ litterID: "litter:abc" }`.

3. **Action**: `recordLitter (motherId: "mother:SingleMom", birthDate: 2023-03-01, reportedLitterSize: 2)`
   * **Pre-state**: `litters` contains `{ _id: "litter:abc", motherId: "mother:SingleMom", birthDate: 2023-03-01, reportedLitterSize: 3 }`.
   * **Requires check**: `mother:SingleMom` exists (true). Duplicate litter (mother, no father, birthDate) *does* exist (false).
   * **Effects**: No change to `litters` collection.
   * **Post-state**: `litters` remains unchanged.
   * **Returns**: `{ error: "A litter with mother mother:SingleMom, father none, and birth date 2023-03-01T00:00:00.000Z already exists." }`.
