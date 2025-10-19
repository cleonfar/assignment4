---
timestamp: 'Sat Oct 18 2025 16:36:05 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_163605.f54ec2d4.md]]'
content_id: 907983cae13f4dcdc46e8440258332b82ff6a835997ef9e27cfc1c17d5f67177
---

# response:

You're encountering that TypeScript error because `assertObjectMatch` expects its arguments to be objects (or an object-like structure for the second argument to match against), but you're passing it sorted arrays directly. While arrays *are* objects in JavaScript, `assertObjectMatch` has a more specific expectation for object matching.

For comparing two arrays where the order of elements doesn't intrinsically matter but the set of elements should be identical, the correct approach is to sort both arrays and then use `assertEquals` to check if the sorted arrays are exactly the same.

Let's update the `generateReport` test cases accordingly:

```typescript
// file: src/GrowthTracking/GrowthTrackingConcept.test.ts

import { assertEquals, assertNotEquals, assertExists, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "../../utils/database.ts"; // Adjust path as necessary
import GrowthTrackingConcept from "./GrowthTrackingConcept.ts";
import { ID } from "../../utils/types.ts";

// Helper for calculating Average Daily Gain (ADG) for testing
interface TestWeightRecord {
  date: Date;
  weight: number;
}

function calculateADG(records: TestWeightRecord[], startDate: Date, endDate: Date): number | null {
  const relevantRecords = records
    .filter(r => r.date >= startDate && r.date <= endDate)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (relevantRecords.length < 2) {
    return null;
  }

  let totalDailyGain = 0;
  let totalDays = 0;

  for (let i = 1; i < relevantRecords.length; i++) {
    const prevRecord = relevantRecords[i - 1];
    const currentRecord = relevantRecords[i];

    const weightDiff = currentRecord.weight - prevRecord.weight;
    const timeDiffMs = currentRecord.date.getTime() - prevRecord.date.getTime();
    const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

    if (timeDiffDays > 0) {
      totalDailyGain += weightDiff;
      totalDays += timeDiffDays;
    }
  }

  return totalDays > 0 ? totalDailyGain / totalDays : null;
}


Deno.test("GrowthTrackingConcept - recordWeight action", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  const animalA: ID = "animal:Alice" as ID;
  const animalB: ID = "animal:Bob" as ID; // Corrected ID format
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

Deno.test("GrowthTrackingConcept - generateReport action", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  const animalE: ID = "animal:Eve" as ID;
  const animalF: ID = "animal:Frank" as ID;
  const animalG: ID = "animal:Grace" as ID; // No records for this one
  const nonExistentAnimal: ID = "animal:Zombie" as ID;

  // Setup: Record weights for animalE and animalF
  await concept.recordWeight({ animal: animalE, date: new Date("2023-01-01T00:00:00.000Z"), weight: 300, notes: "E initial" });
  await concept.recordWeight({ animal: animalE, date: new Date("2023-01-05T00:00:00.000Z"), weight: 310, notes: "E day 5" });
  await concept.recordWeight({ animal: animalE, date: new Date("2023-01-10T00:00:00.000Z"), weight: 325, notes: "E day 10" });
  await concept.recordWeight({ animal: animalE, date: new Date("2023-01-15T00:00:00.000Z"), weight: 340, notes: "E day 15" });

  await concept.recordWeight({ animal: animalF, date: new Date("2023-01-02T00:00:00.000Z"), weight: 250, notes: "F initial" });
  await concept.recordWeight({ animal: animalF, date: new Date("2023-01-07T00:00:00.000Z"), weight: 260, notes: "F day 7" });

  const allEWeights: TestWeightRecord[] = [
    { date: new Date("2023-01-01T00:00:00.000Z"), weight: 300 },
    { date: new Date("2023-01-05T00:00:00.000Z"), weight: 310 },
    { date: new Date("2023-01-10T00:00:00.000Z"), weight: 325 },
    { date: new Date("2023-01-15T00:00:00.000Z"), weight: 340 },
  ];
  const allFWeights: TestWeightRecord[] = [
    { date: new Date("2023-01-02T00:00:00.000Z"), weight: 250 },
    { date: new Date("2023-01-07T00:00:00.000Z"), weight: 260 },
  ];

  await t.step("should successfully generate a new report for a single animal", async () => {
    const reportName = "SingleAnimalReport";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-10T00:00:00.000Z");

    const expectedADG_E = calculateADG(allEWeights, startDate, endDate);

    const result = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    assertEquals(result, { results: [{
      animalId: animalE,
      recordedWeights: [
        { date: new Date("2023-01-01T00:00:00.000Z"), weight: 300 },
        { date: new Date("2023-01-05T00:00:00.000Z"), weight: 310 },
        { date: new Date("2023-01-10T00:00:00.000Z"), weight: 325 },
      ],
      averageDailyGain: expectedADG_E,
    }] }, "Expected correct report results for single animal");

    const reportDoc = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertExists(reportDoc, "Report document should exist");
    assertEquals(reportDoc.reportName, reportName);
    assertEquals(reportDoc.targetAnimals, [animalE]);
    assertEquals(reportDoc.results.length, 1);
    assertEquals(reportDoc.results[0].animalId, animalE);
    assertEquals(reportDoc.results[0].averageDailyGain?.toFixed(2), expectedADG_E?.toFixed(2));
    assertEquals(reportDoc.aiGeneratedSummary, "");
  });

  await t.step("should successfully generate a new report for multiple animals", async () => {
    const reportName = "MultiAnimalReport";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-15T00:00:00.000Z");

    const expectedADG_E = calculateADG(allEWeights, startDate, endDate);
    const expectedADG_F = calculateADG(allFWeights, startDate, endDate);

    const result = await concept.generateReport({
      targetAnimals: [animalE, animalF],
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    assertNotEquals((result as { error: string }).error, "Expected success, not an error");
    assertEquals((result as { results: any[] }).results.length, 2, "Expected results for both animals");

    const reportDoc = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertExists(reportDoc, "Report document should exist");
    assertEquals(reportDoc.reportName, reportName);
    // FIX: Use assertEquals for comparing sorted arrays
    assertEquals(reportDoc.targetAnimals.sort(), [animalE, animalF].sort());
    assertEquals(reportDoc.results.length, 2);

    const resultE = reportDoc.results.find(res => res.animalId === animalE);
    const resultF = reportDoc.results.find(res => res.animalId === animalF);

    assertExists(resultE);
    assertEquals(resultE.averageDailyGain?.toFixed(2), expectedADG_E?.toFixed(2));
    assertExists(resultF);
    assertEquals(resultF.averageDailyGain?.toFixed(2), expectedADG_F?.toFixed(2));
  });

  await t.step("should update an existing report with new animal data", async () => {
    const reportName = "UpdateReport";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-05T00:00:00.000Z");

    // First generate report for animalE
    await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    const initialReport = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertEquals(initialReport?.targetAnimals, [animalE]);
    assertEquals(initialReport?.results.length, 1);

    // Now update by adding animalF to the same report
    const updateStartDate = new Date("2023-01-01T00:00:00.000Z");
    const updateEndDate = new Date("2023-01-07T00:00:00.000Z");
    const expectedADG_F_update = calculateADG(allFWeights, updateStartDate, updateEndDate);

    const updateResult = await concept.generateReport({
      targetAnimals: [animalF],
      startDateRange: updateStartDate,
      endDateRange: updateEndDate,
      name: reportName,
    });

    assertNotEquals((updateResult as { error: string }).error, "Expected success, not an error");

    const updatedReport = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertExists(updatedReport);
    // FIX: Use assertEquals for comparing sorted arrays
    assertEquals(updatedReport.targetAnimals.sort(), [animalE, animalF].sort());
    assertEquals(updatedReport.results.length, 2);

    const resultF = updatedReport.results.find(res => res.animalId === animalF);
    assertExists(resultF);
    assertEquals(resultF.averageDailyGain?.toFixed(2), expectedADG_F_update?.toFixed(2));
  });

  await t.step("should update an existing animal's data within a report if new data is available and range overlaps", async () => {
    const reportName = "DynamicUpdateReport";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-10T00:00:00.000Z");

    await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    const initialEData = (await db.collection("GrowthTracking.reports").findOne({ reportName: reportName }))?.results[0];
    assertEquals(initialEData?.recordedWeights.length, 3); // 3 records in 2023-01-01 to 2023-01-10

    // Record a new weight for animalE within the existing range
    await concept.recordWeight({ animal: animalE, date: new Date("2023-01-08T00:00:00.000Z"), weight: 320, notes: "E new mid-range" });
    const allEWeights_updated: TestWeightRecord[] = [
      { date: new Date("2023-01-01T00:00:00.000Z"), weight: 300 },
      { date: new Date("2023-01-05T00:00:00.000Z"), weight: 310 },
      { date: new Date("2023-01-08T00:00:00.000Z"), weight: 320 }, // New record
      { date: new Date("2023-01-10T00:00:00.000Z"), weight: 325 },
      { date: new Date("2023-01-15T00:00:00.000Z"), weight: 340 },
    ];
    const expectedADG_E_updated = calculateADG(allEWeights_updated, startDate, endDate);

    // Re-generate report for animalE (same range, same report name)
    await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    const updatedReport = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertExists(updatedReport);
    const updatedEData = updatedReport.results.find(res => res.animalId === animalE);
    assertExists(updatedEData);
    assertEquals(updatedEData.recordedWeights.length, 4, "Should now have 4 records for animal E in the updated report");
    assertEquals(updatedEData.averageDailyGain?.toFixed(2), expectedADG_E_updated?.toFixed(2));
  });

  await t.step("should correctly handle an animal with no weight records in the given range", async () => {
    const reportName = "NoDataReport";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T00:00:00.000Z");

    const result = await concept.generateReport({
      targetAnimals: [animalG],
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    assertNotEquals((result as { error: string }).error, "Expected success, not an error");
    assertEquals((result as { results: any[] }).results.length, 1);
    const animalGResult = (result as { results: any[] }).results[0];
    assertEquals(animalGResult.animalId, animalG);
    assertEquals(animalGResult.recordedWeights.length, 0, "Should have no recorded weights");
    assertEquals(animalGResult.averageDailyGain, null, "Average daily gain should be null");

    const reportDoc = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertExists(reportDoc);
    assertEquals(reportDoc.results[0].averageDailyGain, null);
  });

  await t.step("should return an error if targetAnimals is missing or empty", async () => {
    const result1 = await concept.generateReport({
      targetAnimals: undefined!,
      startDateRange: new Date(),
      endDateRange: new Date(),
      name: "BadReport1",
    });
    assertExists((result1 as { error: string }).error);
    assertEquals((result1 as { error: string }).error, "Target animals, name, start date, and end date are required.");

    const result2 = await concept.generateReport({
      targetAnimals: [],
      startDateRange: new Date(),
      endDateRange: new Date(),
      name: "BadReport2",
    });
    assertExists((result2 as { error: string }).error);
    assertEquals((result2 as { error: string }).error, "Target animals, name, start date, and end date are required.");
  });

  await t.step("should return an error if report name is missing", async () => {
    const result = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: new Date(),
      endDateRange: new Date(),
      name: undefined!,
    });
    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, "Target animals, name, start date, and end date are required.");
  });

  await t.step("should return an error if startDateRange is missing or invalid", async () => {
    const result1 = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: undefined!,
      endDateRange: new Date(),
      name: "BadReport",
    });
    assertExists((result1 as { error: string }).error);
    assertEquals((result1 as { error: string }).error, "Target animals, name, start date, and end date are required.");

    const result2 = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: new Date("invalid date"),
      endDateRange: new Date(),
      name: "BadReport",
    });
    assertExists((result2 as { error: string }).error);
    assertEquals((result2 as { error: string }).error, "Invalid date range provided.");
  });

  await t.step("should return an error if endDateRange is missing or invalid", async () => {
    const result1 = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: new Date(),
      endDateRange: undefined!,
      name: "BadReport",
    });
    assertExists((result1 as { error: string }).error);
    assertEquals((result1 as { error: string }).error, "Target animals, name, start date, and end date are required.");

    const result2 = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: new Date(),
      endDateRange: new Date("invalid date"),
      name: "BadReport",
    });
    assertExists((result2 as { error: string }).error);
    assertEquals((result2 as { error: string }).error, "Invalid date range provided.");
  });

  await t.step("should return an error if startDateRange is after endDateRange", async () => {
    const result = await concept.generateReport({
      targetAnimals: [animalE],
      startDateRange: new Date("2023-01-05"),
      endDateRange: new Date("2023-01-01"),
      name: "BadReport",
    });
    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, "Start date cannot be after end date.");
  });

  await t.step("should gracefully handle non-existent target animals (skip and warn)", async () => {
    const reportName = "ReportWithMissingAnimal";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-15T00:00:00.000Z");

    const expectedADG_E = calculateADG(allEWeights, startDate, endDate);

    const result = await concept.generateReport({
      targetAnimals: [animalE, nonExistentAnimal], // animalE exists, nonExistentAnimal does not
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportName,
    });

    assertNotEquals((result as { error: string }).error, "Expected success, not an error");
    assertEquals((result as { results: any[] }).results.length, 1, "Expected only existing animal to be in results");
    assertEquals((result as { results: any[] }).results[0].animalId, animalE);
    assertEquals((result as { results: any[] }).results[0].averageDailyGain?.toFixed(2), expectedADG_E?.toFixed(2));

    const reportDoc = await db.collection("GrowthTracking.reports").findOne({ reportName: reportName });
    assertExists(reportDoc);
    assertEquals(reportDoc.targetAnimals.length, 1);
    assertEquals(reportDoc.targetAnimals[0], animalE);
    assertEquals(reportDoc.results.length, 1);
  });

  await client.close();
});
```
