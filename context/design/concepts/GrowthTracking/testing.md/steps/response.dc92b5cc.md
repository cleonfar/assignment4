---
timestamp: 'Sat Oct 18 2025 15:57:06 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_155706.3d0bb429.md]]'
content_id: dc92b5ccd2b52faa13e29ff1a98630b958d8b0c7bdae3c9ae673d129c30a6b30
---

# response:

```typescript
// file: src/GrowthTracking/GrowthTrackingConcept.test.ts

import { assertEquals, assertNotEquals, assertExists, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "../../utils/database.ts"; // Adjust path as necessary
import GrowthTrackingConcept from "./GrowthTrackingConcept.ts"; // Removed { WeightRecord } import
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
    // The `notes: notes || ""` logic in the concept handles undefined by converting it to ""
    await concept.recordWeight({
      animal: animalB,
      date: date2,
      weight: 55,
      notes: undefined!, // Using '!' to assert `undefined` is assignable to `string` for testing purposes
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
    assertExists(animalDoc, "Animal document should exist after recording multiple weights");
    assertEquals(animalDoc.weightRecords.length, 4, "Should now have four weight records for animal A");

    // Corrected: Infer type of 'r' from the animalDoc.weightRecords array
    // After assertExists(animalDoc), TypeScript knows animalDoc is non-null.
    const recordsOnDate3 = animalDoc.weightRecords.filter((r: (typeof animalDoc.weightRecords)[number]) =>
      r.date.getTime() === date3.getTime()
    );
    assertEquals(recordsOnDate3.length, 2, "Should have two records on date3");
    assertObjectMatch(recordsOnDate3[0], { date: date3, weight: 110, notes: "Morning weigh-in" });
    assertObjectMatch(recordsOnDate3[1], { date: date3, weight: 112, notes: "Evening weigh-in" });
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


Deno.test("GrowthTrackingConcept - removeWeightRecord action", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  const animalC: ID = "animal:Charlie" as ID;
  const animalD: ID = "animal:Diana" as ID;
  const nonExistentAnimal: ID = "animal:NonExistent" as ID;
  const dateC1 = new Date("2023-03-01T00:00:00.000Z");
  const dateC2 = new Date("2023-03-02T00:00:00.000Z");
  const dateC3 = new Date("2023-03-03T00:00:00.000Z");
  const dateC4 = new Date("2023-03-04T00:00:00.000Z"); // For non-existent record test

  // Setup: Record some initial weights for animalC and animalD
  await concept.recordWeight({ animal: animalC, date: dateC1, weight: 200, notes: "C initial" });
  await concept.recordWeight({ animal: animalC, date: dateC2, weight: 205, notes: "C day 2" });
  await concept.recordWeight({ animal: animalC, date: dateC3, weight: 210, notes: "C day 3" });
  await concept.recordWeight({ animal: animalD, date: dateC1, weight: 150, notes: "D initial" });

  await t.step("should successfully remove an existing weight record", async () => {
    const initialAnimalCDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalC });
    assertEquals(initialAnimalCDoc?.weightRecords.length, 3, "Animal C should have 3 records initially");

    const result = await concept.removeWeightRecord({ animal: animalC, date: dateC2 });

    assertEquals(result, {}, "Expected successful removeWeightRecord to return an empty object");

    const animalCDoc = await db.collection("GrowthTracking.animals").findOne({ _id: animalC });
    assertExists(animalCDoc, "Animal C document should still exist");
    assertEquals(animalCDoc.weightRecords.length, 2, "Animal C should now have 2 weight records");

    const remainingDates = animalCDoc.weightRecords.map((r: (typeof animalCDoc.weightRecords)[number]) => r.date.getTime());
    assertEquals(remainingDates.includes(dateC1.getTime()), true, "Record for dateC1 should remain");
    assertEquals(remainingDates.includes(dateC2.getTime()), false, "Record for dateC2 should be removed");
    assertEquals(remainingDates.includes(dateC3.getTime()), true, "Record for dateC3 should remain");
  });

  await t.step("should return an error if the weight record does not exist for an existing animal", async () => {
    const animalCDocBefore = await db.collection("GrowthTracking.animals").findOne({ _id: animalC });
    const initialRecordCount = animalCDocBefore?.weightRecords.length || 0;

    const result = await concept.removeWeightRecord({ animal: animalC, date: dateC4 }); // dateC4 was never added

    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals(
      (result as { error: string }).error,
      `No weight record found for animal ${animalC} on date ${dateC4.toISOString()}.`,
      "Expected specific error message for non-existent record",
    );

    const animalCDocAfter = await db.collection("GrowthTracking.animals").findOne({ _id: animalC });
    assertEquals(
      animalCDocAfter?.weightRecords.length,
      initialRecordCount,
      "Animal C's records should be unchanged",
    );
  });

  await t.step("should return an error if the animal does not exist", async () => {
    const result = await concept.removeWeightRecord({ animal: nonExistentAnimal, date: dateC1 });

    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals(
      (result as { error: string }).error,
      `Animal with ID ${nonExistentAnimal} not found.`,
      "Expected specific error message for non-existent animal",
    );
  });

  await t.step("should return an error if animal ID is missing", async () => {
    const result = await concept.removeWeightRecord({ animal: undefined!, date: dateC1 });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Animal ID and date are required.");
  });

  await t.step("should return an error if date is missing", async () => {
    const result = await concept.removeWeightRecord({ animal: animalC, date: undefined! });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Animal ID and date are required.");
  });

  await t.step("should return an error if date is invalid", async () => {
    const result = await concept.removeWeightRecord({ animal: animalC, date: new Date("invalid date") });
    assertNotEquals(result, {}, "Expected an error object");
    assertExists((result as { error: string }).error, "Expected error property in result");
    assertEquals((result as { error: string }).error, "Invalid date provided.");
  });

  await client.close();
});
```
