---
timestamp: 'Wed Oct 15 2025 22:39:03 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_223903.f5b7ce39.md]]'
content_id: a6e338472978e678c277e452130279a940435717d59e9b051266db950a54c679
---

# response:

You're absolutely right! This is a classic TypeScript type narrowing issue when dealing with union types like `ActionResult<T>` and generic assertion functions that don't explicitly act as type guards.

The error `Property 'report' does not exist on type 'ActionResult<GenerateReportResult>'. Property 'report' does not exist on type 'ErrorResult'.` occurs because, even after `assertFalse("error" in result)` passes, TypeScript's static analysis isn't always smart enough to infer that `result` must now be of type `GenerateReportResult` (and not `ErrorResult`). It still considers `result` to be the union type `GenerateReportResult | ErrorResult`.

The solution is to explicitly tell TypeScript that, after the check, we know `result` is of the successful type by using a **type assertion (casting)**.

First, let's update `ReproductionTrackingConcept.ts` to `export` the specific result types, so we can import them in our test file.

**File: `src/ReproductionTracking/ReproductionTrackingConcept.ts` (Modified)**

```typescript
import { Collection, Db } from "npm:mongodb";
import { ID, Empty, ErrorResult, ActionResult } from "@utils/types.ts";
import { freshID, idExistsInCollection, allIdsExistInCollection } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "ReproductionTracking" + ".";

// --- Generic types used in this concept ---
type MotherID = ID;
type FatherID = ID;
type OffspringID = ID;
type AnimalID = ID;

// --- State Interfaces (MongoDB Document Structures) ---

interface MotherDoc {
  _id: MotherID;
}

interface OffspringDoc {
  _id: OffspringID;
}

interface BirthRecordDoc {
  _id: ID;
  mother: MotherID;
  father?: FatherID;
  birthDate: Date;
  sex: "male" | "female" | "neutered";
  countBorn: number;
  offspringIds: OffspringID[];
  notes?: string;
}

interface WeaningRecordDoc {
  _id: ID;
  birthRecordId: ID;
  weaningDate: Date;
  countWeaned: number;
  notes?: string;
}

interface GeneratedReportDoc {
  _id: ID;
  target: AnimalID[];
  startDateRange: Date;
  endDateRange: Date;
  generatedAt: Date;
  results: Record<string, unknown>;
  summary?: string;
}

// --- Expected action return types for clarity ---
// EXPORTING these types for easier testing
export type AddMotherResult = { mother: ID };
export type RecordBirthResult = Empty;
export type RecordWeaningResult = Empty;
export type ViewBirthsResult = { records: BirthRecordDoc[] };
export type ViewWeaningResult = { record?: WeaningRecordDoc };
export type UpdateBirthRecordResult = Empty;
export type GenerateReportResult = { report: GeneratedReportDoc };
export type ViewReportResult = { results: GeneratedReportDoc };
export type ListReportsResult = { reports: GeneratedReportDoc[] };
export type DeleteReportResult = Empty;
export type AiSummaryResult = { summary: string };

/**
 * # concept ReproductionTracking
 *
 * **purpose** track reproductive outcomes and offspring survivability for breeding animals
 *
 * ... (rest of class remains the same)
 */
export default class ReproductionTrackingConcept {
  // ... (constructor and methods remain the same)
}
```

Now, let's apply the fixes to the test file.

**File: `src/ReproductionTracking/ReproductionTrackingConcept.test.ts` (Corrected)**

```typescript
import { assertEquals, assertExists, assertNotEquals, assertArrayIncludes, assertFalse, assert } from "jsr:@std/assert";
import { testDb, freshID } from "@utils/database.ts";
import { ID, ErrorResult } from "@utils/types.ts"; // ErrorResult is still useful for checking error cases
import ReproductionTrackingConcept, { // Import the specific result types
  AddMotherResult,
  ViewBirthsResult,
  ViewWeaningResult,
  GenerateReportResult,
  ViewReportResult,
  ListReportsResult,
  AiSummaryResult,
} from "./ReproductionTrackingConcept.ts";

Deno.test("ReproductionTrackingConcept", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // Ensure client is closed after all tests
  Deno.test.afterAll(async () => {
    await client.close();
  });

  const mother1Id = freshID();
  const mother2Id = freshID();
  const father1Id = freshID();
  const offspring1Id = freshID();
  const offspring2Id = freshID();
  const offspring3Id = freshID();
  const nonExistentId = freshID();

  await t.step("addMother: Successfully adds a new mother", async () => {
    const result = await concept.addMother({ mother: mother1Id });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`); // Type guard for success
    const successResult = result as AddMotherResult; // Cast to the success type
    assertExists(successResult.mother);
    assertEquals(successResult.mother, mother1Id);

    const motherExists = await db.collection("ReproductionTracking.mothers").findOne({ _id: mother1Id });
    assertExists(motherExists);
    assertEquals(motherExists?._id, mother1Id);
  });

  await t.step("addMother: Fails if mother already exists", async () => {
    const result = await concept.addMother({ mother: mother1Id });
    assert("error" in result, "Expected an error but got success."); // Type guard for error
    const errorResult = result as ErrorResult; // Cast to the error type
    assertEquals(errorResult.error, `Mother with ID '${mother1Id}' already exists.`);
  });

  await t.step("recordBirth: Successfully records a birth with optional father and offspring", async () => {
    // Add father for test - assume fathers are also tracked as 'mothers' conceptually for this basic check
    await concept.addMother({ mother: father1Id });
    
    const birthDate = new Date("2023-01-15T10:00:00Z");
    const result = await concept.recordBirth({
      mother: mother1Id,
      father: father1Id,
      birthDate: birthDate,
      offspring: [offspring1Id, offspring2Id],
      countBorn: 2,
      sex: "male",
      notes: "First litter of puppies",
    });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);

    const birthRecords = await db.collection("ReproductionTracking.birthRecords").find({ mother: mother1Id }).toArray();
    assertEquals(birthRecords.length, 1);
    const birthRecord = birthRecords[0];
    assertExists(birthRecord._id);
    assertEquals(birthRecord.mother, mother1Id);
    assertEquals(birthRecord.father, father1Id);
    assertEquals(birthRecord.birthDate.toISOString(), birthDate.toISOString());
    assertArrayIncludes(birthRecord.offspringIds, [offspring1Id, offspring2Id]);
    assertEquals(birthRecord.countBorn, 2);
    assertEquals(birthRecord.sex, "male");
    assertEquals(birthRecord.notes, "First litter of puppies");

    // Verify offspring were recorded
    const offspringCount = await db.collection("ReproductionTracking.offspring").countDocuments({ _id: { $in: [offspring1Id, offspring2Id] } });
    assertEquals(offspringCount, 2);
  });

  await t.step("recordBirth: Fails if mother does not exist", async () => {
    const result = await concept.recordBirth({
      mother: nonExistentId,
      birthDate: new Date(),
      offspring: [freshID()],
      countBorn: 1,
      sex: "female",
      notes: "Should fail",
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Mother with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("recordWeaning: Successfully records weaning for a birth record", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const weaningDate = new Date("2023-03-01T10:00:00Z");
    const result = await concept.recordWeaning({
      birthRecordId: birthRecord._id,
      weaningDate: weaningDate,
      countWeaned: 2,
      notes: "All puppies weaned successfully",
    });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);

    const weaningRecord = await db.collection("ReproductionTracking.weaningRecords").findOne({ birthRecordId: birthRecord._id });
    assertExists(weaningRecord);
    assertEquals(weaningRecord?.birthRecordId, birthRecord._id);
    assertEquals(weaningRecord?.weaningDate.toISOString(), weaningDate.toISOString());
    assertEquals(weaningRecord?.countWeaned, 2);
  });

  await t.step("recordWeaning: Fails if birth record does not exist", async () => {
    const result = await concept.recordWeaning({
      birthRecordId: nonExistentId,
      weaningDate: new Date(),
      countWeaned: 1,
      notes: "Should fail",
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Birth record with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("recordWeaning: Fails if weaning date is before birth date", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const result = await concept.recordWeaning({
      birthRecordId: birthRecord._id,
      weaningDate: new Date("2022-12-01T10:00:00Z"), // Before birthDate 2023-01-15
      countWeaned: 1,
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assert(errorResult.error.startsWith("Weaning date must be after birth date"));
  });

  await t.step("recordWeaning: Fails if weaning record already exists for birth record", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const result = await concept.recordWeaning({
      birthRecordId: birthRecord._id,
      weaningDate: new Date("2023-04-01T10:00:00Z"),
      countWeaned: 1,
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `A weaning record already exists for birth record '${birthRecord._id}'.`);
  });

  await t.step("viewBirths: Returns all birth records for a mother", async () => {
    await concept.addMother({ mother: mother2Id }); // Ensure mother2Id is added for subsequent birth record
    await concept.recordBirth({
      mother: mother2Id,
      birthDate: new Date("2023-05-01Z"),
      offspring: [offspring3Id],
      countBorn: 1,
      sex: "female",
    });

    const result = await concept.viewBirths({ animal: mother1Id });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as ViewBirthsResult; // Cast
    assertEquals(successResult.records.length, 1);
    assertEquals(successResult.records[0].mother, mother1Id);

    const result2 = await concept.viewBirths({ animal: mother2Id });
    assertFalse("error" in result2, `Expected success, but got error: ${(result2 as ErrorResult).error}`);
    const successResult2 = result2 as ViewBirthsResult; // Cast
    assertEquals(successResult2.records.length, 1);
    assertEquals(successResult2.records[0].mother, mother2Id);
  });

  await t.step("viewBirths: Fails if animal is not a registered mother", async () => {
    const result = await concept.viewBirths({ animal: nonExistentId });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Animal with ID '${nonExistentId}' is not registered as a mother.`);
  });

  await t.step("viewWeaning: Returns weaning record if it exists", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const result = await concept.viewWeaning({ birthRecordId: birthRecord._id });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as ViewWeaningResult; // Cast
    assertExists(successResult.record);
    assertEquals(successResult.record?.birthRecordId, birthRecord._id);
  });

  await t.step("viewWeaning: Returns undefined if weaning record does not exist", async () => {
    const birthRecord2 = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother2Id }))!;
    const result = await concept.viewWeaning({ birthRecordId: birthRecord2._id });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as ViewWeaningResult; // Cast
    assertEquals(successResult.record, undefined);
  });

  await t.step("viewWeaning: Fails if birth record does not exist", async () => {
    const result = await concept.viewWeaning({ birthRecordId: nonExistentId });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Birth record with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("updateBirthRecord: Successfully updates a birth record", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const updatedNotes = "Updated notes for the first litter";
    const newBirthDate = new Date("2023-01-20T00:00:00Z");
    const newOffspringId = freshID();

    const result = await concept.updateBirthRecord({
      birthRecordId: birthRecord._id,
      birthDate: newBirthDate,
      offspring: [offspring1Id, offspring2Id, newOffspringId],
      countBorn: 3,
      sex: "female",
      notes: updatedNotes,
    });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);

    const updatedRecord = await db.collection("ReproductionTracking.birthRecords").findOne({ _id: birthRecord._id });
    assertExists(updatedRecord);
    assertEquals(updatedRecord?.birthDate.toISOString(), newBirthDate.toISOString());
    assertEquals(updatedRecord?.offspringIds.length, 3);
    assertArrayIncludes(updatedRecord?.offspringIds!, [offspring1Id, offspring2Id, newOffspringId]);
    assertEquals(updatedRecord?.countBorn, 3);
    assertEquals(updatedRecord?.sex, "female");
    assertEquals(updatedRecord?.notes, updatedNotes);

    // Verify the new offspring ID was added to the offspring collection
    const newOffspringExists = await db.collection("ReproductionTracking.offspring").findOne({ _id: newOffspringId });
    assertExists(newOffspringExists);
  });

  await t.step("updateBirthRecord: Fails if birth record does not exist", async () => {
    const result = await concept.updateBirthRecord({
      birthRecordId: nonExistentId,
      notes: "This should fail",
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Birth record with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("generateReport: Successfully generates a report", async () => {
    const startDate = new Date("2023-01-01T00:00:00Z");
    const endDate = new Date("2023-12-31T23:59:59Z");
    const result = await concept.generateReport({
      target: [mother1Id, offspring1Id],
      startDateRange: startDate,
      endDateRange: endDate,
    });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as GenerateReportResult; // Cast
    assertExists(successResult.report._id);
    assertEquals(successResult.report.target, [mother1Id, offspring1Id]);
    assertEquals(successResult.report.startDateRange.toISOString(), startDate.toISOString());
    assertExists(successResult.report.results); // Mock results should be present

    const storedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: successResult.report._id });
    assertExists(storedReport);
  });

  await t.step("generateReport: Fails if target animal(s) do not exist", async () => {
    const result = await concept.generateReport({
      target: [nonExistentId],
      startDateRange: new Date("2023-01-01Z"),
      endDateRange: new Date("2023-02-01Z"),
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assert(errorResult.error.includes("One or more target animals are not registered"));
  });

  await t.step("generateReport: Fails if start date is not before end date", async () => {
    const result = await concept.generateReport({
      target: [mother1Id],
      startDateRange: new Date("2023-01-01Z"),
      endDateRange: new Date("2023-01-01Z"), // Same date
    });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, "Start date must be before end date for report.");
  });

  await t.step("viewReport: Returns a generated report", async () => {
    // Generate a report first to ensure one exists
    const reportGenResult = await concept.generateReport({
        target: [mother1Id],
        startDateRange: new Date("2023-01-01Z"),
        endDateRange: new Date("2023-02-01Z"),
    });
    assertFalse("error" in reportGenResult, `Failed to generate report for view test: ${(reportGenResult as ErrorResult).error}`);
    const existingReportId = (reportGenResult as GenerateReportResult).report._id;

    const result = await concept.viewReport({ reportId: existingReportId });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as ViewReportResult; // Cast
    assertEquals(successResult.results._id, existingReportId);
    assertExists(successResult.results.results);
  });

  await t.step("viewReport: Fails if report does not exist", async () => {
    const result = await concept.viewReport({ reportId: nonExistentId });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Report with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("listReports: Returns all generated reports", async () => {
    // Ensure there's at least one report
    const reportGenResult = await concept.generateReport({
        target: [mother1Id],
        startDateRange: new Date("2023-03-01Z"),
        endDateRange: new Date("23-04-01Z"),
    });
    assertFalse("error" in reportGenResult, `Failed to generate report for list test: ${(reportGenResult as ErrorResult).error}`);


    const result = await concept.listReports();
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as ListReportsResult; // Cast
    assert(successResult.reports.length >= 1); // At least one report was generated in previous steps
  });

  await t.step("aiSummary: Successfully generates and stores an AI summary for a report", async () => {
    // Generate a report first to ensure one exists
    const reportGenResult = await concept.generateReport({
        target: [mother1Id],
        startDateRange: new Date("2023-05-01Z"),
        endDateRange: new Date("2023-06-01Z"),
    });
    assertFalse("error" in reportGenResult, `Failed to generate report for AI summary test: ${(reportGenResult as ErrorResult).error}`);
    const existingReportId = (reportGenResult as GenerateReportResult).report._id;

    const result = await concept.aiSummary({ reportId: existingReportId });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);
    const successResult = result as AiSummaryResult; // Cast
    assert(successResult.summary.length > 0);
    assert(successResult.summary.includes(existingReportId));

    const updatedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: existingReportId });
    assertExists(updatedReport?.summary);
    assertEquals(updatedReport?.summary, successResult.summary);
  });

  await t.step("aiSummary: Fails if report does not exist", async () => {
    const result = await concept.aiSummary({ reportId: nonExistentId });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Report with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("deleteReport: Successfully deletes a report", async () => {
    // Generate a report first to ensure one exists to delete
    const reportGenResult = await concept.generateReport({
        target: [mother1Id],
        startDateRange: new Date("2023-07-01Z"),
        endDateRange: new Date("2023-08-01Z"),
    });
    assertFalse("error" in reportGenResult, `Failed to generate report for delete test: ${(reportGenResult as ErrorResult).error}`);
    const reportIdToDelete = (reportGenResult as GenerateReportResult).report._id;

    const result = await concept.deleteReport({ reportId: reportIdToDelete });
    assertFalse("error" in result, `Expected success, but got error: ${(result as ErrorResult).error}`);

    const deletedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: reportIdToDelete });
    assertEquals(deletedReport, null);
  });

  await t.step("deleteReport: Fails if report does not exist", async () => {
    const result = await concept.deleteReport({ reportId: nonExistentId });
    assert("error" in result, "Expected an error but got success.");
    const errorResult = result as ErrorResult;
    assertEquals(errorResult.error, `Report with ID '${nonExistentId}' not found.`);
  });
});
```
