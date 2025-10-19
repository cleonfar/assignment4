---
timestamp: 'Sat Oct 18 2025 15:33:43 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_153343.5902689c.md]]'
content_id: b971c2dd38b997aee11ed1f0298665808400b7a682322f38099a14cf2af0c0d9
---

# response:

```typescript
// file: src/GrowthTracking/GrowthTrackingConcept.test.ts

import { assertEquals, assertNotEquals, assertExists, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "../../utils/database.ts"; // Adjust path as necessary
import GrowthTrackingConcept from "./GrowthTrackingConcept.ts";
import { ID } from "../../utils/types.ts";

Deno.test("GrowthTrackingConcept - recordWeight action", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  const animalA: ID = "animal:Alice" as ID;
  const animalB: ID = "animal:Bob" as ID;
  const date1 = new Date("2023-01-01T00:00:00.000Z");
  const date2 = new Date("2023-01-02T00:00:00.000Z");
  const date3 = new Date("2023-01-03T00:00:00.000Z");

  await t.step("should successfully record a weight for a new animal", async () => {
    const result = await concept.recordWeight({
      animal: animalA,
      date: date1,
      weight: 100,
      notes: "First weigh-in",
    });

    assertEquals(result, {}, "Expected successful recordWeight to return an empty object");

    const animalDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalA });
    assertExists(animalDoc, "Animal document should exist after recording weight");
    assertEquals(animalDoc.weightRecords.length, 1, "Should have one weight record");
    assertObjectMatch(animalDoc.weightRecords[0], {
      date: date1,
      weight: 100,
      notes: "First weigh-in",
    });
  });

  await t.step("should successfully record another weight for an existing animal", async () => {
    const result = await concept.recordWeight({
      animal: animalA,
      date: date2,
      weight: 105,
      notes: "Second weigh-in",
    });

    assertEquals(result, {}, "Expected successful recordWeight to return an empty object");

    const animalDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalA });
    assertExists(animalDoc, "Animal document should still exist");
    assertEquals(animalDoc.weightRecords.length, 2, "Should now have two weight records");
    assertObjectMatch(animalDoc.weightRecords[1], {
      date: date2,
      weight: 105,
      notes: "Second weigh-in",
    });
  });

  await t.step("should record a weight with empty notes if not provided", async () => {
    const result = await concept.recordWeight({
      animal: animalB,
      date: date1,
      weight: 50,
      notes: "", // Explicitly empty
    });

    assertEquals(result, {}, "Expected successful recordWeight to return an empty object");

    const animalDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalB });
    assertExists(animalDoc, "Animal document should exist for animal B");
    assertEquals(animalDoc.weightRecords.length, 1, "Should have one weight record for animal B");
    assertObjectMatch(animalDoc.weightRecords[0], {
      date: date1,
      weight: 50,
      notes: "",
    });

    // Test with undefined notes (should also default to empty string)
    await concept.recordWeight({
      animal: animalB,
      date: date2,
      weight: 55,
      notes: undefined!, // Explicitly undefined, TypeScript usually requires a string
    });
    const updatedAnimalDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalB });
    assertEquals(updatedAnimalDoc!.weightRecords[1].notes, "", "Notes should be an empty string if undefined");
  });

  await t.step("should allow recording multiple weights for the same animal on the same date", async () => {
    const result1 = await concept.recordWeight({
      animal: animalA,
      date: date3,
      weight: 110,
      notes: "Morning weigh-in",
    });
    const result2 = await concept.recordWeight({
      animal: animalA,
      date: date3,
      weight: 112,
      notes: "Evening weigh-in",
    });

    assertEquals(result1, {}, "Expected first record to succeed");
    assertEquals(result2, {}, "Expected second record to succeed");

    const animalDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalA });
    assertEquals(animalDoc?.weightRecords.length, 4, "Should now have four weight records for animal A");
    // Verify both records on date3 are present
    const recordsOnDate3 = animalDoc?.weightRecords.filter(r => r.date.getTime() === date3.getTime());
    assertEquals(recordsOnDate3?.length, 2, "Should have two records on date3");
    assertObjectMatch(recordsOnDate3![0], { date: date3, weight: 110, notes: "Morning weigh-in" });
    assertObjectMatch(recordsOnDate3![1], { date: date3, weight: 112, notes: "Evening weigh-in" });
  });

  await t.step("should return an error if animal ID is missing", async () => {
    const result = await concept.recordWeight({
      animal: undefined!, // Missing animal ID
      date: date1,
      weight: 100,
      notes: "Test",
    });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Animal ID, date, and weight are required.");
  });

  await t.step("should return an error if date is missing", async () => {
    const result = await concept.recordWeight({
      animal: animalA,
      date: undefined!, // Missing date
      weight: 100,
      notes: "Test",
    });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Animal ID, date, and weight are required.");
  });

  await t.step("should return an error if weight is missing", async () => {
    const result = await concept.recordWeight({
      animal: animalA,
      date: date1,
      weight: undefined!, // Missing weight
      notes: "Test",
    });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Animal ID, date, and weight are required.");
  });

  await t.step("should return an error if date is invalid", async () => {
    const result = await concept.recordWeight({
      animal: animalA,
      date: new Date("invalid date string"), // Invalid date
      weight: 100,
      notes: "Test",
    });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Invalid date provided.");
  });

  await client.close();
});
```
