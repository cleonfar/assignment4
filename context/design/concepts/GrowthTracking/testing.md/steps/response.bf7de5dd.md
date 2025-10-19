---
timestamp: 'Sat Oct 18 2025 17:44:06 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_174406.7499b5a3.md]]'
content_id: bf7de5dd7a42d1ed5c2ee60b07224c293e8cc6dbea7ea574d72144476f3332fc
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

  const animalE: ID = "animal:Edward" as ID;
  const animalF: ID = "animal:Fiona" as ID;
  const animalG: ID = "animal:George" as ID;
  const nonExistentAnimal: ID = "animal:Zoe" as ID;

  const reportName1 = "GrowthReport-Q1";
  const reportName2 = "GrowthReport-Q2";

  const d_jan1 = new Date("2024-01-01T00:00:00.000Z");
  const d_jan10 = new Date("2024-01-10T00:00:00.000Z");
  const d_jan20 = new Date("2024-01-20T00:00:00.000Z");
  const d_jan25 = new Date("2024-01-25T00:00:00.000Z"); // New date for update test
  const d_jan30 = new Date("2024-01-30T00:00:00.000Z");
  const d_feb1 = new Date("2024-02-01T00:00:00.000Z");
  const d_feb10 = new Date("2024-02-10T00:00:00.000Z");
  const d_mar1 = new Date("2024-03-01T00:00:00.000Z");
  const d_mar5 = new Date("2024-03-05T00:00:00.000Z");


  // --- Setup initial data for various test cases ---
  await concept.recordWeight({ animal: animalE, date: d_jan1, weight: 50, notes: "E-start" });
  await concept.recordWeight({ animal: animalE, date: d_jan10, weight: 60, notes: "E-mid" });
  await concept.recordWeight({ animal: animalE, date: d_jan20, weight: 70, notes: "E-end" });

  await concept.recordWeight({ animal: animalF, date: d_feb1, weight: 30, notes: "F-start" });
  await concept.recordWeight({ animal: animalF, date: d_feb10, weight: 35, notes: "F-end" });

  await concept.recordWeight({ animal: animalG, date: d_mar1, weight: 20, notes: "G-single" });


  await t.step("should create a new report for an animal with records in range", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: d_jan1,
      endDateRange: d_jan30,
      reportName: reportName1,
    });

    // Type guard for success case: if 'error' is present, throw an error
    if ("error" in result) {
      throw new Error(`Expected success, but got an error: ${result.error}`); // Fail test if unexpected error
    }

    const report = result.report; // Now safely inferred as ReportDoc
    assertEquals(report.reportName, reportName1);
    assertEquals(report.targetAnimals, [animalE]);
    assertExists(report.dateGenerated);
    assertEquals(report.aiGeneratedSummary, "");
    assertEquals(report.results.length, 1);
    assertObjectMatch(report.results[0], {
      animalId: animalE,
      recordedWeights: [
        { date: d_jan1, weight: 50 },
        { date: d_jan10, weight: 60 },
        { date: d_jan20, weight: 70 },
      ],
      averageDailyGain: (20 / 19), // (70-50) / ((d_jan20 - d_jan1) in days) = 20 / 19 days
    });
  });

  await t.step("should update an existing report with a new animal", async () => {
    // reportName1 already exists for animalE
    const result = await concept.generateReport({
      animal: animalF,
      startDateRange: d_feb1,
      endDateRange: d_feb10,
      reportName: reportName1,
    });

    if ("error" in result) {
      throw new Error(`Expected success, but got an error: ${result.error}`);
    }
    const report = result.report; // Safely inferred

    assertEquals(report.reportName, reportName1);
    // Should now include both animals
    assertEquals(report.targetAnimals.sort(), [animalE, animalF].sort());
    assertExists(report.dateGenerated);
    assertEquals(report.aiGeneratedSummary, "");
    assertEquals(report.results.length, 2);

    const animalEResult = report.results.find(r => r.animalId === animalE);
    const animalFResult = report.results.find(r => r.animalId === animalF);

    assertExists(animalEResult);
    // Verify AnimalE's data is still correct (unchanged by this call)
    assertObjectMatch(animalEResult!, {
      animalId: animalE,
      recordedWeights: [
        { date: d_jan1, weight: 50 },
        { date: d_jan10, weight: 60 },
        { date: d_jan20, weight: 70 },
      ],
      averageDailyGain: (20 / 19),
    });

    assertExists(animalFResult);
    assertObjectMatch(animalFResult!, {
      animalId: animalF,
      recordedWeights: [
        { date: d_feb1, weight: 30 },
        { date: d_feb10, weight: 35 },
      ],
      averageDailyGain: (5 / ((d_feb10.getTime() - d_feb1.getTime()) / (1000 * 60 * 60 * 24))), // 5/9
    });

    // Verify the report in the database
    const dbReportResult = await concept._getReportByName({ reportName: reportName1 });
    if ("error" in dbReportResult) { // Apply type guard here
      throw new Error(`Expected no error getting report, but got: ${dbReportResult.error}`);
    }
    const dbReport = dbReportResult.report; // Now TypeScript knows dbReportResult is { report: ReportDoc }
    assertEquals(dbReport.targetAnimals.sort(), [animalE, animalF].sort());
    assertEquals(dbReport.results.length, 2);
  });

  await t.step("should update an existing report with updated data for an existing animal", async () => {
    // Add another weight for animalE to change its ADG
    await concept.recordWeight({ animal: animalE, date: d_jan25, weight: 75, notes: "E-late" });

    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: d_jan1,
      endDateRange: d_jan30,
      reportName: reportName1,
    });

    if ("error" in result) {
      throw new Error(`Expected success, but got an error: ${result.error}`);
    }
    const report = result.report; // Safely inferred

    assertEquals(report.reportName, reportName1);
    assertEquals(report.targetAnimals.sort(), [animalE, animalF].sort()); // Target animals should remain the same
    assertEquals(report.results.length, 2); // Still 2 animals

    const animalEResult = report.results.find(r => r.animalId === animalE);
    assertExists(animalEResult);

    // New ADG for AnimalE: (60-50)/9 + (70-60)/10 + (75-70)/5 = 10/9 + 10/10 + 5/5
    // totalDailyGain = 10 + 10 + 5 = 25
    // totalDays = (d_jan10-d_jan1) + (d_jan20-d_jan10) + (d_jan25-d_jan20) = 9 + 10 + 5 = 24
    // ADG = 25/24 = 1.0416...
    assertObjectMatch(animalEResult!, {
      animalId: animalE,
      recordedWeights: [
        { date: d_jan1, weight: 50 },
        { date: d_jan10, weight: 60 },
        { date: d_jan20, weight: 70 },
        { date: d_jan25, weight: 75 },
      ],
      averageDailyGain: (25 / 24),
    });

    // Other animal (Fiona) data should remain unchanged
    const animalFResult = report.results.find(r => r.animalId === animalF);
    assertExists(animalFResult);
    assertEquals(animalFResult!.recordedWeights.length, 2); // Still 2 records for Fiona
    assertEquals(animalFResult!.averageDailyGain, (5 / 9));
  });

  await t.step("should create a new report for an animal with no records in the specified range", async () => {
    // Animal G has a record on d_mar1, but we are querying for Jan
    const result = await concept.generateReport({
      animal: animalG,
      startDateRange: d_jan1,
      endDateRange: d_jan30,
      reportName: reportName2, // New report name
    });

    if ("error" in result) {
      throw new Error(`Expected success, but got an error: ${result.error}`);
    }
    const report = result.report; // Safely inferred

    assertEquals(report.reportName, reportName2);
    assertEquals(report.targetAnimals, [animalG]);
    assertEquals(report.results.length, 1);
    assertObjectMatch(report.results[0], {
      animalId: animalG,
      recordedWeights: [], // No records in range
      averageDailyGain: null, // No ADG
    });
  });

  await t.step("should create a new report for an animal with only one record in range (ADG should be null)", async () => {
    // Record another weight for G to ensure it only has one in a specific range
    await concept.recordWeight({ animal: animalG, date: d_mar5, weight: 22, notes: "G-second" });

    const result = await concept.generateReport({
      animal: animalG,
      startDateRange: d_mar1,
      endDateRange: d_mar1, // Only one record on d_mar1
      reportName: "SingleRecordReport", // New report name
    });

    if ("error" in result) {
      throw new Error(`Expected success, but got an error: ${result.error}`);
    }
    const report = result.report; // Safely inferred

    assertEquals(report.reportName, "SingleRecordReport");
    assertEquals(report.targetAnimals, [animalG]);
    assertEquals(report.results.length, 1);
    assertObjectMatch(report.results[0], {
      animalId: animalG,
      recordedWeights: [{ date: d_mar1, weight: 20 }],
      averageDailyGain: null, // ADG should be null with only one record
    });
  });

  await t.step("should return an error if animal ID does not exist in the system at all", async () => {
    const result = await concept.generateReport({
      animal: nonExistentAnimal,
      startDateRange: d_jan1,
      endDateRange: d_jan30,
      reportName: "ReportForNonExistent",
    });

    // For error cases, we expect "error" to be in result. If not, throw an error.
    if (!("error" in result)) {
      throw new Error("Expected an error for non-existent animal, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, `Animal with ID ${nonExistentAnimal} not found. Cannot generate report.`);
  });


  // --- Error cases ---
  await t.step("should return an error if animal ID is missing", async () => {
    const result = await concept.generateReport({
      animal: undefined!,
      startDateRange: d_jan1,
      endDateRange: d_jan30,
      reportName: reportName1,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing animal ID, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Animal ID, report name, start date, and end date are required.");
  });

  await t.step("should return an error if reportName is missing", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: d_jan1,
      endDateRange: d_jan30,
      reportName: undefined!,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing report name, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Animal ID, report name, start date, and end date are required.");
  });

  await t.step("should return an error if startDateRange is missing", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: undefined!,
      endDateRange: d_jan30,
      reportName: reportName1,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing start date, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Animal ID, report name, start date, and end date are required.");
  });

  await t.step("should return an error if endDateRange is missing", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: d_jan1,
      endDateRange: undefined!,
      reportName: reportName1,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing end date, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Animal ID, report name, start date, and end date are required.");
  });

  await t.step("should return an error if startDateRange is invalid", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: new Date("invalid date"),
      endDateRange: d_jan30,
      reportName: reportName1,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for invalid start date, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Invalid date range provided.");
  });

  await t.step("should return an error if endDateRange is invalid", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: d_jan1,
      endDateRange: new Date("invalid date"),
      reportName: reportName1,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for invalid end date, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Invalid date range provided.");
  });

  await t.step("should return an error if startDateRange is after endDateRange", async () => {
    const result = await concept.generateReport({
      animal: animalE,
      startDateRange: d_jan30,
      endDateRange: d_jan1,
      reportName: reportName1,
    });
    if (!("error" in result)) {
      throw new Error("Expected an error for inverted date range, but generateReport succeeded unexpectedly.");
    }
    assertExists(result.error);
    assertEquals(result.error, "Start date cannot be after end date.");
  });

  await client.close();
});

Deno.test("GrowthTrackingConcept - renameReport action", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  const animalH: ID = "animal:Henry" as ID;
  const dateH1 = new Date("2024-04-01T00:00:00.000Z");
  const dateH2 = new Date("2024-04-10T00:00:00.000Z");
  const oldReportName = "MonthlyReport-April";
  const newReportName = "Q2Report-April";
  const conflictingReportName = "ExistingReport";

  // Setup: Record weights for animalH and create an initial report
  await concept.recordWeight({ animal: animalH, date: dateH1, weight: 120, notes: "H-start" });
  await concept.recordWeight({ animal: animalH, date: dateH2, weight: 125, notes: "H-mid" });
  const initialReportResult = await concept.generateReport({
    animal: animalH,
    startDateRange: dateH1,
    endDateRange: dateH2,
    reportName: oldReportName,
  });
  if ("error" in initialReportResult) {
    throw new Error(`Setup failed: ${initialReportResult.error}`);
  }

  // Setup for conflict test: Create a report with a name that will conflict
  const conflictReportResult = await concept.generateReport({
    animal: animalH, // Can reuse animal H for this report
    startDateRange: dateH1,
    endDateRange: dateH1,
    reportName: conflictingReportName,
  });
  if ("error" in conflictReportResult) {
    throw new Error(`Setup failed for conflict report: ${conflictReportResult.error}`);
  }


  await t.step("should successfully rename an existing report", async () => {
    const result = await concept.renameReport({ oldName: oldReportName, newName: newReportName });

    if ("error" in result) {
      throw new Error(`Expected success, but got an error: ${result.error}`);
    }
    assertEquals(result.newName, newReportName, "Expected the new name to be returned");

    // Verify old report name no longer exists
    const oldReport = await concept._getReportByName({ reportName: oldReportName });
    assertExists(oldReport.error, "Old report name should no longer exist");

    // Verify new report name exists and contains the correct data
    const newReport = await concept._getReportByName({ reportName: newReportName });
    if ("error" in newReport) {
      throw new Error(`Expected new report to exist, but got error: ${newReport.error}`);
    }
    assertEquals(newReport.report.reportName, newReportName, "Report should have the new name");
    assertEquals(newReport.report.targetAnimals, [animalH], "Report should maintain target animals");
  });

  await t.step("should return an error if old report name is missing", async () => {
    const result = await concept.renameReport({ oldName: undefined!, newName: "SomeNewName" });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing old name, but renameReport succeeded unexpectedly.");
    }
    assertEquals(result.error, "Old report name and new report name are required.");
  });

  await t.step("should return an error if new report name is missing", async () => {
    const result = await concept.renameReport({ oldName: newReportName, newName: undefined! });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing new name, but renameReport succeeded unexpectedly.");
    }
    assertEquals(result.error, "Old report name and new report name are required.");
  });

  await t.step("should return an error if the old report does not exist", async () => {
    const result = await concept.renameReport({ oldName: "NonExistentReport", newName: "ReallyNewName" });
    if (!("error" in result)) {
      throw new Error("Expected an error for non-existent old report, but renameReport succeeded unexpectedly.");
    }
    assertEquals(result.error, "Report with name 'NonExistentReport' not found.");
  });

  await t.step("should return an error if the new report name already exists", async () => {
    // Try to rename our `newReportName` (which is 'Q2Report-April') to `conflictingReportName` ('ExistingReport')
    const result = await concept.renameReport({ oldName: newReportName, newName: conflictingReportName });
    if (!("error" in result)) {
      throw new Error("Expected an error for conflicting new name, but renameReport succeeded unexpectedly.");
    }
    assertEquals(result.error, `A report with name '${conflictingReportName}' already exists.`);
  });

  await t.step("should return an error if old name and new name are the same", async () => {
    // Use the name 'ExistingReport' that we know exists
    const result = await concept.renameReport({ oldName: conflictingReportName, newName: conflictingReportName });
    if (!("error" in result)) {
      throw new Error("Expected an error for same old/new name, but renameReport succeeded unexpectedly.");
    }
    assertEquals(result.error, "Old name and new name are the same.");
  });

  await client.close();
});

Deno.test("GrowthTrackingConcept - deleteReport action", async (t) => {
  const [db, client] = await testDb();
  const concept = new GrowthTrackingConcept(db);

  const animalI: ID = "animal:Ivan" as ID;
  const dateI1 = new Date("2024-05-01T00:00:00.000Z");
  const reportToDelete = "ReportToDelete";
  const nonExistentReport = "PhantomReport";

  // Setup: Record a weight and create a report to be deleted
  await concept.recordWeight({ animal: animalI, date: dateI1, weight: 80, notes: "I-initial" });
  const setupResult = await concept.generateReport({
    animal: animalI,
    startDateRange: dateI1,
    endDateRange: dateI1,
    reportName: reportToDelete,
  });
  if ("error" in setupResult) {
    throw new Error(`Setup failed: ${setupResult.error}`);
  }

  await t.step("should successfully delete an existing report", async () => {
    const result = await concept.deleteReport({ reportName: reportToDelete });

    assertEquals(result, {}, "Expected successful deleteReport to return an empty object");

    // Verify the report no longer exists
    const deletedReportCheck = await concept._getReportByName({ reportName: reportToDelete });
    assertExists(deletedReportCheck.error, "Deleted report should no longer be found");
    assertEquals(deletedReportCheck.error, `Report with name '${reportToDelete}' not found.`);
  });

  await t.step("should return an error if report name is missing", async () => {
    const result = await concept.deleteReport({ reportName: undefined! });
    if (!("error" in result)) {
      throw new Error("Expected an error for missing report name, but deleteReport succeeded unexpectedly.");
    }
    assertEquals(result.error, "Report name is required.");
  });

  await t.step("should return an error if the report does not exist", async () => {
    const result = await concept.deleteReport({ reportName: nonExistentReport });
    if (!("error" in result)) {
      throw new Error("Expected an error for non-existent report, but deleteReport succeeded unexpectedly.");
    }
    assertEquals(result.error, `Report with name '${nonExistentReport}' not found.`);
  });

  await client.close();
});
```
