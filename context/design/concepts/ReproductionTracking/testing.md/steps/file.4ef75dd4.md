---
timestamp: 'Wed Oct 15 2025 21:33:33 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_213333.f1fe4ee0.md]]'
content_id: 4ef75dd45eeb536ef6ecb5e39dafd0e6ec8f5b9f130e5268c5605dc0ac4019e3
---

# file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts

```typescript
import { assertEquals, assertExists, assertNotEquals, assertArrayIncludes, assertFalse, assert } from "jsr:@std/assert";
import { testDb, freshID } from "@utils/database.ts";
import { ID, ErrorResult } from "@utils/types.ts";
import ReproductionTrackingConcept from "./ReproductionTrackingConcept.ts";

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
    assertNotEquals((result as ErrorResult).error, "Mother with ID '1' already exists.");
    assertExists(result);
    assertEquals(result, { mother: mother1Id });

    const motherExists = await db.collection("ReproductionTracking.mothers").findOne({ _id: mother1Id });
    assertExists(motherExists);
    assertEquals(motherExists?._id, mother1Id);
  });

  await t.step("addMother: Fails if mother already exists", async () => {
    const result = await concept.addMother({ mother: mother1Id });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Mother with ID '${mother1Id}' already exists.`);
  });

  await t.step("recordBirth: Successfully records a birth with optional father and offspring", async () => {
    // Add father for test
    await concept.addMother({ mother: father1Id }); // Assume fathers are also tracked as 'mothers' conceptually for this basic check
    
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
    assertFalse("error" in result);

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
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Mother with ID '${nonExistentId}' does not exist.`);
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
    assertFalse("error" in result);

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
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Birth record with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("recordWeaning: Fails if weaning date is before birth date", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const result = await concept.recordWeaning({
      birthRecordId: birthRecord._id,
      weaningDate: new Date("2022-12-01T10:00:00Z"), // Before birthDate 2023-01-15
      countWeaned: 1,
    });
    assertExists((result as ErrorResult).error);
    assert((result as ErrorResult).error.startsWith("Weaning date must be after birth date"));
  });

  await t.step("recordWeaning: Fails if weaning record already exists for birth record", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const result = await concept.recordWeaning({
      birthRecordId: birthRecord._id,
      weaningDate: new Date("2023-04-01T10:00:00Z"),
      countWeaned: 1,
    });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `A weaning record already exists for birth record '${birthRecord._id}'.`);
  });

  await t.step("viewBirths: Returns all birth records for a mother", async () => {
    await concept.addMother({ mother: mother2Id });
    await concept.recordBirth({
      mother: mother2Id,
      birthDate: new Date("2023-05-01Z"),
      offspring: [offspring3Id],
      countBorn: 1,
      sex: "female",
    });

    const result = await concept.viewBirths({ animal: mother1Id });
    assertFalse("error" in result);
    assertEquals(result.records.length, 1);
    assertEquals(result.records[0].mother, mother1Id);

    const result2 = await concept.viewBirths({ animal: mother2Id });
    assertFalse("error" in result2);
    assertEquals(result2.records.length, 1);
    assertEquals(result2.records[0].mother, mother2Id);
  });

  await t.step("viewBirths: Fails if animal is not a registered mother", async () => {
    const result = await concept.viewBirths({ animal: nonExistentId });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Animal with ID '${nonExistentId}' is not registered as a mother.`);
  });

  await t.step("viewWeaning: Returns weaning record if it exists", async () => {
    const birthRecord = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother1Id }))!;
    const result = await concept.viewWeaning({ birthRecordId: birthRecord._id });
    assertFalse("error" in result);
    assertExists(result.record);
    assertEquals(result.record?.birthRecordId, birthRecord._id);
  });

  await t.step("viewWeaning: Returns undefined if weaning record does not exist", async () => {
    const birthRecord2 = (await db.collection("ReproductionTracking.birthRecords").findOne({ mother: mother2Id }))!;
    const result = await concept.viewWeaning({ birthRecordId: birthRecord2._id });
    assertFalse("error" in result);
    assertEquals(result.record, undefined);
  });

  await t.step("viewWeaning: Fails if birth record does not exist", async () => {
    const result = await concept.viewWeaning({ birthRecordId: nonExistentId });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Birth record with ID '${nonExistentId}' does not exist.`);
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
    assertFalse("error" in result);

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
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Birth record with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("generateReport: Successfully generates a report", async () => {
    const startDate = new Date("2023-01-01T00:00:00Z");
    const endDate = new Date("2023-12-31T23:59:59Z");
    const result = await concept.generateReport({
      target: [mother1Id, offspring1Id],
      startDateRange: startDate,
      endDateRange: endDate,
    });
    assertFalse("error" in result);
    assertExists(result.report._id);
    assertEquals(result.report.target, [mother1Id, offspring1Id]);
    assertEquals(result.report.startDateRange.toISOString(), startDate.toISOString());
    assertExists(result.report.results); // Mock results should be present

    const storedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: result.report._id });
    assertExists(storedReport);
  });

  await t.step("generateReport: Fails if target animal(s) do not exist", async () => {
    const result = await concept.generateReport({
      target: [nonExistentId],
      startDateRange: new Date("2023-01-01Z"),
      endDateRange: new Date("2023-02-01Z"),
    });
    assertExists((result as ErrorResult).error);
    assert((result as ErrorResult).error.includes("One or more target animals are not registered"));
  });

  await t.step("generateReport: Fails if start date is not before end date", async () => {
    const result = await concept.generateReport({
      target: [mother1Id],
      startDateRange: new Date("2023-01-01Z"),
      endDateRange: new Date("2023-01-01Z"), // Same date
    });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, "Start date must be before end date for report.");
  });

  await t.step("viewReport: Returns a generated report", async () => {
    const existingReport = (await db.collection("ReproductionTracking.generatedReports").findOne({}))!;
    const result = await concept.viewReport({ reportId: existingReport._id });
    assertFalse("error" in result);
    assertEquals(result.results._id, existingReport._id);
    assertExists(result.results.results);
  });

  await t.step("viewReport: Fails if report does not exist", async () => {
    const result = await concept.viewReport({ reportId: nonExistentId });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Report with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("listReports: Returns all generated reports", async () => {
    const result = await concept.listReports();
    assertFalse("error" in result);
    assert(result.reports.length >= 1); // At least one report was generated in previous steps
  });

  await t.step("aiSummary: Successfully generates and stores an AI summary for a report", async () => {
    const existingReport = (await db.collection("ReproductionTracking.generatedReports").findOne({}))!;
    const result = await concept.aiSummary({ reportId: existingReport._id });
    assertFalse("error" in result);
    assert(result.summary.length > 0);
    assert(result.summary.includes(existingReport._id));

    const updatedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: existingReport._id });
    assertExists(updatedReport?.summary);
    assertEquals(updatedReport?.summary, result.summary);
  });

  await t.step("aiSummary: Fails if report does not exist", async () => {
    const result = await concept.aiSummary({ reportId: nonExistentId });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Report with ID '${nonExistentId}' does not exist.`);
  });

  await t.step("deleteReport: Successfully deletes a report", async () => {
    const existingReport = (await db.collection("ReproductionTracking.generatedReports").findOne({}))!;
    const reportIdToDelete = existingReport._id;

    const result = await concept.deleteReport({ reportId: reportIdToDelete });
    assertFalse("error" in result);

    const deletedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: reportIdToDelete });
    assertEquals(deletedReport, null);
  });

  await t.step("deleteReport: Fails if report does not exist", async () => {
    const result = await concept.deleteReport({ reportId: nonExistentId });
    assertExists((result as ErrorResult).error);
    assertEquals((result as ErrorResult).error, `Report with ID '${nonExistentId}' not found.`);
  });
});
```

***
