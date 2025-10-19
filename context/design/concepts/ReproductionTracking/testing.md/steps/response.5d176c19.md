---
timestamp: 'Thu Oct 16 2025 14:44:38 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_144438.52273702.md]]'
content_id: 5d176c196da7f6306f9dfccdc7c8dfe1c5c7498e31ec7aed736c06e9757179be
---

# response:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts
import { Collection, Db, MongoClient } from "npm:mongodb";
import { assertEquals, assertExists, assertInstanceOf, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept, { Sex } from "./ReproductionTrackingConcept.ts";

// Mock the GoogleGenerativeAI to prevent actual API calls during testing
// This ensures tests are fast, reliable, and don't require an actual API key.
// The mock will mimic the expected JSON output structure.
const mockGenerateContent = async (_prompt: string) => ({
  response: {
    text: () =>
      JSON.stringify({
        highPerformers: ["MOCK_MOTHER_HIGH"],
        lowPerformers: ["MOCK_MOTHER_LOW"],
        concerningTrends: ["MOCK_MOTHER_CONCERN"],
        averagePerformers: ["mother1", "mother2"],
        potentialRecordErrors: ["MOCK_MOTHER_ERROR"],
        insights:
          "Overall, the group shows moderate performance. Mother MOCK_MOTHER_HIGH is a standout. However, MOCK_MOTHER_LOW's performance is concerning, suggesting potential health or environmental issues. MOCK_MOTHER_ERROR's data (e.g., more weaned than born) indicates a likely record-keeping error that needs investigation.",
      }),
  },
});

// Mock the entire @google/generative-ai module
class MockGoogleGenerativeAI {
  constructor(_apiKey: string) {}
  getGenerativeModel(_options: unknown) {
    return {
      generateContent: mockGenerateContent,
    };
  }
}

// Override the module's export
// This is a common pattern for mocking external dependencies in Deno.
// @ts-ignore: We are intentionally overriding the import
import * as GoogleGenerativeAIModule from "npm:@google/generative-ai";
GoogleGenerativeAIModule.GoogleGenerativeAI = MockGoogleGenerativeAI;


Deno.test("ReproductionTrackingConcept", async (t) => {
  let db: Db;
  let client: MongoClient;
  let concept: ReproductionTrackingConcept;

  Deno.test.beforeEach(async () => {
    [db, client] = await testDb();
    concept = new ReproductionTrackingConcept(db);
  });

  Deno.test.afterEach(async () => {
    await client.close();
  });

  await t.step("addMother action", async (t) => {
    await t.step("should add a new mother successfully", async () => {
      const { motherId, error } = await concept.addMother({ motherId: "mother1" });
      assertEquals(error, undefined);
      assertEquals(motherId, "mother1");

      const mother = await db.collection("ReproductionTracking.mothers").findOne({ _id: "mother1" });
      assertExists(mother);
      assertEquals(mother._id, "mother1");
    });

    await t.step("should return an error if motherId already exists", async () => {
      await concept.addMother({ motherId: "mother2" });
      const { motherId, error } = await concept.addMother({ motherId: "mother2" });
      assertEquals(motherId, undefined);
      assertEquals(error, "Mother with ID mother2 already exists.");
    });
  });

  await t.step("removeMother action", async (t) => {
    await t.step("should remove an existing mother successfully", async () => {
      await concept.addMother({ motherId: "mother3" });
      const { motherId, error } = await concept.removeMother({ motherId: "mother3" });
      assertEquals(error, undefined);
      assertEquals(motherId, "mother3");

      const mother = await db.collection("ReproductionTracking.mothers").findOne({ _id: "mother3" });
      assertEquals(mother, null);
    });

    await t.step("should return an error if motherId does not exist", async () => {
      const { motherId, error } = await concept.removeMother({ motherId: "nonExistentMother" });
      assertEquals(motherId, undefined);
      assertEquals(error, "Mother with ID nonExistentMother not found.");
    });
  });

  await t.step("recordLitter action", async (t) => {
    await t.step("should record a new litter for an existing mother", async () => {
      await concept.addMother({ motherId: "mother4" });
      const birthDate = new Date("2023-01-01");
      const { litter, error } = await concept.recordLitter({
        motherId: "mother4",
        fatherId: "father1",
        birthDate,
        reportedLitterSize: 5,
        notes: "First litter",
      });

      assertEquals(error, undefined);
      assertExists(litter);
      assertEquals(litter.motherId, "mother4");
      assertEquals(litter.fatherId, "father1");
      assertEquals(litter.birthDate.toISOString(), birthDate.toISOString());
      assertEquals(litter.reportedLitterSize, 5);
      assertEquals(litter.notes, "First litter");

      const savedLitter = await db.collection("ReproductionTracking.litters").findOne({ _id: litter._id });
      assertObjectMatch(savedLitter!, litter);
    });

    await t.step("should add the mother if she doesn't exist and record the litter", async () => {
      const birthDate = new Date("2023-02-01");
      const { litter, error } = await concept.recordLitter({
        motherId: "newMother",
        birthDate,
        reportedLitterSize: 3,
      });

      assertEquals(error, undefined);
      assertExists(litter);
      assertEquals(litter.motherId, "newMother");

      const mother = await db.collection("ReproductionTracking.mothers").findOne({ _id: "newMother" });
      assertExists(mother); // Mother should now exist
    });

    await t.step("should return an error if a duplicate litter exists", async () => {
      await concept.addMother({ motherId: "mother5" });
      const birthDate = new Date("2023-03-01");
      await concept.recordLitter({
        motherId: "mother5",
        fatherId: "father2",
        birthDate,
        reportedLitterSize: 4,
      });

      const { litter, error } = await concept.recordLitter({
        motherId: "mother5",
        fatherId: "father2",
        birthDate,
        reportedLitterSize: 4, // different reported size should still be a duplicate based on mother, father, birthDate
      });

      assertEquals(litter, undefined);
      assertEquals(error, "A litter for mother mother5 with this father and birth date already exists.");
    });
  });

  await t.step("updateLitter action", async (t) => {
    let litterId: string;
    await t.step("setup", async () => {
      await concept.addMother({ motherId: "mother6" });
      const { litter } = await concept.recordLitter({
        motherId: "mother6",
        birthDate: new Date("2023-04-01"),
        reportedLitterSize: 6,
      });
      litterId = litter!._id;
    });

    await t.step("should update litter details successfully", async () => {
      const newBirthDate = new Date("2023-04-02");
      const { litter, error } = await concept.updateLitter({
        litterId,
        reportedLitterSize: 7,
        notes: "Updated notes",
        birthDate: newBirthDate,
      });
      assertEquals(error, undefined);
      assertExists(litter);
      assertEquals(litter.reportedLitterSize, 7);
      assertEquals(litter.notes, "Updated notes");
      assertEquals(litter.birthDate.toISOString(), newBirthDate.toISOString());

      const savedLitter = await db.collection("ReproductionTracking.litters").findOne({ _id: litterId });
      assertObjectMatch(savedLitter!, litter);
    });

    await t.step("should update motherId and add new mother if not existing", async () => {
      const { litter, error } = await concept.updateLitter({
        litterId,
        motherId: "mother7",
      });
      assertEquals(error, undefined);
      assertExists(litter);
      assertEquals(litter.motherId, "mother7");

      const newMother = await db.collection("ReproductionTracking.mothers").findOne({ _id: "mother7" });
      assertExists(newMother); // new mother should be added
    });

    await t.step("should return an error if litterId does not exist", async () => {
      const { litter, error } = await concept.updateLitter({ litterId: "nonExistentLitter", reportedLitterSize: 8 });
      assertEquals(litter, undefined);
      assertEquals(error, "Litter with ID nonExistentLitter not found.");
    });
  });

  await t.step("recordOffspring action", async (t) => {
    let litterId: string;
    await t.step("setup", async () => {
      const { litter } = await concept.recordLitter({
        motherId: "mother8",
        birthDate: new Date("2023-05-01"),
        reportedLitterSize: 2,
      });
      litterId = litter!._id;
    });

    await t.step("should record a new offspring successfully", async () => {
      const { offspring, error } = await concept.recordOffspring({
        litterId,
        offspringId: "offspring1",
        sex: Sex.Male,
        notes: "Healthy",
      });

      assertEquals(error, undefined);
      assertExists(offspring);
      assertEquals(offspring._id, "offspring1");
      assertEquals(offspring.litterId, litterId);
      assertEquals(offspring.sex, Sex.Male);
      assertEquals(offspring.isAlive, true);
      assertEquals(offspring.survivedTillWeaning, false);

      const savedOffspring = await db.collection("ReproductionTracking.offspring").findOne({ _id: "offspring1" });
      assertObjectMatch(savedOffspring!, offspring);
    });

    await t.step("should return an error if litterId does not exist", async () => {
      const { offspring, error } = await concept.recordOffspring({
        litterId: "nonExistentLitter",
        offspringId: "offspring2",
        sex: Sex.Female,
      });
      assertEquals(offspring, undefined);
      assertEquals(error, "Litter with ID nonExistentLitter not found.");
    });

    await t.step("should return an error if offspringId already exists", async () => {
      await concept.recordOffspring({ litterId, offspringId: "offspring3", sex: Sex.Female });
      const { offspring, error } = await concept.recordOffspring({
        litterId,
        offspringId: "offspring3",
        sex: Sex.Male,
      });
      assertEquals(offspring, undefined);
      assertEquals(error, "Offspring with ID offspring3 already exists.");
    });
  });

  await t.step("updateOffspring action", async (t) => {
    let litterId1: string;
    let litterId2: string;
    let offspringId: string;

    await t.step("setup", async () => {
      const { litter: l1 } = await concept.recordLitter({ motherId: "mother9", birthDate: new Date("2023-06-01"), reportedLitterSize: 3 });
      litterId1 = l1!._id;
      const { litter: l2 } = await concept.recordLitter({ motherId: "mother10", birthDate: new Date("2023-06-02"), reportedLitterSize: 4 });
      litterId2 = l2!._id;

      const { offspring } = await concept.recordOffspring({ litterId: litterId1, offspringId: "offspring4", sex: Sex.Female });
      offspringId = offspring!._id;
    });

    await t.step("should update offspring details successfully", async () => {
      const { offspring, error } = await concept.updateOffspring({ offspringId, sex: Sex.Neuter, notes: "Neutered" });
      assertEquals(error, undefined);
      assertExists(offspring);
      assertEquals(offspring.sex, Sex.Neuter);
      assertEquals(offspring.notes, "Neutered");

      const savedOffspring = await db.collection("ReproductionTracking.offspring").findOne({ _id: offspringId });
      assertObjectMatch(savedOffspring!, offspring);
    });

    await t.step("should update litterId to an existing litter", async () => {
      const { offspring, error } = await concept.updateOffspring({ offspringId, litterId: litterId2 });
      assertEquals(error, undefined);
      assertExists(offspring);
      assertEquals(offspring.litterId, litterId2);
    });

    await t.step("should return an error if offspringId does not exist", async () => {
      const { offspring, error } = await concept.updateOffspring({ offspringId: "nonExistentOffspring", sex: Sex.Male });
      assertEquals(offspring, undefined);
      assertEquals(error, "Offspring with ID nonExistentOffspring not found.");
    });

    await t.step("should return an error if new litterId does not exist", async () => {
      const { offspring, error } = await concept.updateOffspring({ offspringId, litterId: "invalidLitterId" });
      assertEquals(offspring, undefined);
      assertEquals(error, "New litter with ID invalidLitterId for offspring update not found.");
    });
  });

  await t.step("recordWeaning action", async (t) => {
    let litterId: string;
    let offspringId: string;
    let deceasedOffspringId: string;

    await t.step("setup", async () => {
      const { litter } = await concept.recordLitter({ motherId: "mother11", birthDate: new Date("2023-07-01"), reportedLitterSize: 2 });
      litterId = litter!._id;
      const { offspring: o1 } = await concept.recordOffspring({ litterId, offspringId: "offspring5", sex: Sex.Female });
      offspringId = o1!._id;
      const { offspring: o2 } = await concept.recordOffspring({ litterId, offspringId: "offspring6", sex: Sex.Male });
      deceasedOffspringId = o2!._id;
      await concept.recordDeath({ offspringId: deceasedOffspringId }); // Mark as dead
    });

    await t.step("should set survivedTillWeaning to true for a living offspring", async () => {
      const { offspringId: resultId, error } = await concept.recordWeaning({ offspringId });
      assertEquals(error, undefined);
      assertEquals(resultId, offspringId);

      const savedOffspring = await db.collection("ReproductionTracking.offspring").findOne({ _id: offspringId });
      assertExists(savedOffspring);
      assertEquals(savedOffspring.survivedTillWeaning, true);
    });

    await t.step("should return an error if offspring is not found", async () => {
      const { offspringId: resultId, error } = await concept.recordWeaning({ offspringId: "nonExistentOffspring" });
      assertEquals(resultId, undefined);
      assertEquals(error, "Offspring with ID nonExistentOffspring not found.");
    });

    await t.step("should return an error if offspring is not alive", async () => {
      const { offspringId: resultId, error } = await concept.recordWeaning({ offspringId: deceasedOffspringId });
      assertEquals(resultId, undefined);
      assertEquals(error, `Offspring with ID ${deceasedOffspringId} is not alive and cannot be weaned.`);
    });

    await t.step("should return an error if offspring is already weaned", async () => {
      await concept.recordWeaning({ offspringId }); // Wean it once
      const { offspringId: resultId, error } = await concept.recordWeaning({ offspringId }); // Try to wean again
      assertEquals(resultId, undefined);
      assertEquals(error, `Offspring with ID ${offspringId} is already marked as weaned.`);
    });
  });

  await t.step("recordDeath action", async (t) => {
    let litterId: string;
    let offspringId: string;
    let alreadyDeadOffspringId: string;

    await t.step("setup", async () => {
      const { litter } = await concept.recordLitter({ motherId: "mother12", birthDate: new Date("2023-08-01"), reportedLitterSize: 2 });
      litterId = litter!._id;
      const { offspring: o1 } = await concept.recordOffspring({ litterId, offspringId: "offspring7", sex: Sex.Female });
      offspringId = o1!._id;
      const { offspring: o2 } = await concept.recordOffspring({ litterId, offspringId: "offspring8", sex: Sex.Male });
      alreadyDeadOffspringId = o2!._id;
      await concept.recordDeath({ offspringId: alreadyDeadOffspringId }); // Mark as dead
    });

    await t.step("should set isAlive to false for a living offspring", async () => {
      const { offspringId: resultId, error } = await concept.recordDeath({ offspringId });
      assertEquals(error, undefined);
      assertEquals(resultId, offspringId);

      const savedOffspring = await db.collection("ReproductionTracking.offspring").findOne({ _id: offspringId });
      assertExists(savedOffspring);
      assertEquals(savedOffspring.isAlive, false);
    });

    await t.step("should return an error if offspring is not found", async () => {
      const { offspringId: resultId, error } = await concept.recordDeath({ offspringId: "nonExistentOffspring" });
      assertEquals(resultId, undefined);
      assertEquals(error, "Offspring with ID nonExistentOffspring not found.");
    });

    await t.step("should return an error if offspring is already deceased", async () => {
      const { offspringId: resultId, error } = await concept.recordDeath({ offspringId: alreadyDeadOffspringId });
      assertEquals(resultId, undefined);
      assertEquals(error, `Offspring with ID ${alreadyDeadOffspringId} is already marked as deceased.`);
    });
  });

  await t.step("viewLittersOfMother action", async (t) => {
    let motherId: string;
    let litterId1: string;
    let litterId2: string;

    await t.step("setup", async () => {
      motherId = "mother13";
      await concept.addMother({ motherId });
      const { litter: l1 } = await concept.recordLitter({ motherId, birthDate: new Date("2023-09-01"), reportedLitterSize: 5 });
      litterId1 = l1!._id;
      const { litter: l2 } = await concept.recordLitter({ motherId, birthDate: new Date("2023-09-02"), reportedLitterSize: 4 });
      litterId2 = l2!._id;
    });

    await t.step("should return all litters for a given mother", async () => {
      const { litters, error } = await concept.viewLittersOfMother({ motherId });
      assertEquals(error, undefined);
      assertExists(litters);
      assertEquals(litters.length, 2);
      assertObjectMatch(litters[0], { _id: litterId1, motherId });
      assertObjectMatch(litters[1], { _id: litterId2, motherId });
    });

    await t.step("should return an empty array if mother has no litters", async () => {
      await concept.addMother({ motherId: "motherNoLitters" });
      const { litters, error } = await concept.viewLittersOfMother({ motherId: "motherNoLitters" });
      assertEquals(error, undefined);
      assertExists(litters);
      assertEquals(litters.length, 0);
    });

    await t.step("should return an error if mother does not exist", async () => {
      const { litters, error } = await concept.viewLittersOfMother({ motherId: "nonExistentMother" });
      assertEquals(litters, undefined);
      assertEquals(error, "Mother with ID nonExistentMother not found.");
    });
  });

  await t.step("viewOffspringOfLitter action", async (t) => {
    let litterId: string;
    let offspringId1: string;
    let offspringId2: string;

    await t.step("setup", async () => {
      const { litter } = await concept.recordLitter({ motherId: "mother14", birthDate: new Date("2023-10-01"), reportedLitterSize: 2 });
      litterId = litter!._id;
      const { offspring: o1 } = await concept.recordOffspring({ litterId, offspringId: "offspring9", sex: Sex.Female });
      offspringId1 = o1!._id;
      const { offspring: o2 } = await concept.recordOffspring({ litterId, offspringId: "offspring10", sex: Sex.Male });
      offspringId2 = o2!._id;
    });

    await t.step("should return all offspring for a given litter", async () => {
      const { offspring, error } = await concept.viewOffspringOfLitter({ litterId });
      assertEquals(error, undefined);
      assertExists(offspring);
      assertEquals(offspring.length, 2);
      assertObjectMatch(offspring[0], { _id: offspringId1, litterId });
      assertObjectMatch(offspring[1], { _id: offspringId2, litterId });
    });

    await t.step("should return an empty array if litter has no offspring", async () => {
      const { litter } = await concept.recordLitter({ motherId: "mother15", birthDate: new Date("2023-10-02"), reportedLitterSize: 0 });
      const { offspring, error } = await concept.viewOffspringOfLitter({ litterId: litter!._id });
      assertEquals(error, undefined);
      assertExists(offspring);
      assertEquals(offspring.length, 0);
    });

    await t.step("should return an error if litter does not exist", async () => {
      const { offspring, error } = await concept.viewOffspringOfLitter({ litterId: "nonExistentLitter" });
      assertEquals(offspring, undefined);
      assertEquals(error, "Litter with ID nonExistentLitter not found.");
    });
  });

  await t.step("generateReport action", async (t) => {
    let mother1: string;
    let mother2: string;
    let mother3: string; // for missing mothers test

    await t.step("setup mothers and data", async () => {
      mother1 = "reportMother1";
      mother2 = "reportMother2";
      await concept.addMother({ motherId: mother1 });
      await concept.addMother({ motherId: mother2 });

      // Mother 1 litters
      const { litter: l1_1 } = await concept.recordLitter({
        motherId: mother1,
        birthDate: new Date("2023-01-10"),
        reportedLitterSize: 5,
      });
      await concept.recordOffspring({ litterId: l1_1!._id, offspringId: "r1o1", sex: Sex.Male });
      await concept.recordOffspring({ litterId: l1_1!._id, offspringId: "r1o2", sex: Sex.Female });
      await concept.recordOffspring({ litterId: l1_1!._id, offspringId: "r1o3", sex: Sex.Male });
      await concept.recordOffspring({ litterId: l1_1!._id, offspringId: "r1o4", sex: Sex.Female }); // 4 born
      await concept.recordWeaning({ offspringId: "r1o1" });
      await concept.recordWeaning({ offspringId: "r1o2" });
      await concept.recordDeath({ offspringId: "r1o3" });

      const { litter: l1_2 } = await concept.recordLitter({
        motherId: mother1,
        birthDate: new Date("2023-06-15"),
        reportedLitterSize: 3,
      });
      await concept.recordOffspring({ litterId: l1_2!._id, offspringId: "r1o5", sex: Sex.Male });
      await concept.recordOffspring({ litterId: l1_2!._id, offspringId: "r1o6", sex: Sex.Female }); // 2 born
      await concept.recordWeaning({ offspringId: "r1o5" });
      await concept.recordWeaning({ offspringId: "r1o6" });

      // Mother 2 litters
      const { litter: l2_1 } = await concept.recordLitter({
        motherId: mother2,
        birthDate: new Date("2023-03-05"),
        reportedLitterSize: 7,
      });
      await concept.recordOffspring({ litterId: l2_1!._id, offspringId: "r2o1", sex: Sex.Male });
      await concept.recordOffspring({ litterId: l2_1!._id, offspringId: "r2o2", sex: Sex.Female });
      await concept.recordOffspring({ litterId: l2_1!._id, offspringId: "r2o3", sex: Sex.Male });
      await concept.recordOffspring({ litterId: l2_1!._id, offspringId: "r2o4", sex: Sex.Female });
      await concept.recordOffspring({ litterId: l2_1!._id, offspringId: "r2o5", sex: Sex.Male }); // 5 born
      await concept.recordWeaning({ offspringId: "r2o1" });
      await concept.recordWeaning({ offspringId: "r2o2" });
      await concept.recordWeaning({ offspringId: "r2o3" });
      await concept.recordDeath({ offspringId: "r2o4" });
      await concept.recordDeath({ offspringId: "r2o5" });
    });

    await t.step("should generate a report with correct overall and per-mother metrics", async () => {
      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-12-31");
      const reportName = "Test Reproductive Performance";
      const { report, error } = await concept.generateReport({
        target: [mother1, mother2],
        startDateRange: startDate,
        endDateRange: endDate,
        name: reportName,
      });

      assertEquals(error, undefined);
      assertExists(report);
      assertEquals(report.reportName, reportName);
      assertEquals(report.target, [mother1, mother2]);
      assertInstanceOf(report.dateGenerated, Date);

      // Verify Overall Summary Metrics
      assertObjectMatch(report.results, {
        uniqueLittersRecorded: 3,
        totalReportedLitterSize: 15, // 5 + 3 + 7
        totalActualOffspringBorn: 11, // 4 + 2 + 5
        totalWeanedOffspring: 6, // 2 + 2 + 2
        totalDeceasedOffspring: 3, // 1 + 0 + 2
        averageReportedLitterSize: 5,
        averageActualOffspringPerLitter: 11 / 3, // ~3.67
        survivabilityRateToWeaning: (6 / 11 * 100).toFixed(2) + "%", // ~54.55%
        motherCount: 2,
      });

      // Verify Per-Mother Metrics for mother1
      const m1Perf = report.results.perMotherPerformance.find(p => p.motherId === mother1);
      assertExists(m1Perf);
      assertObjectMatch(m1Perf, {
        littersRecorded: 2,
        totalOffspringBorn: 6, // 4 + 2
        totalOffspringWeaned: 4, // 2 + 2
        totalDeceasedOffspring: 1, // 1 + 0
        weaningSurvivabilityRate: (4 / 6 * 100).toFixed(2) + "%", // ~66.67%
        averageActualOffspringPerLitter: 3, // 6 / 2
      });

      // Verify Per-Mother Metrics for mother2
      const m2Perf = report.results.perMotherPerformance.find(p => p.motherId === mother2);
      assertExists(m2Perf);
      assertObjectMatch(m2Perf, {
        littersRecorded: 1,
        totalOffspringBorn: 5,
        totalOffspringWeaned: 2,
        totalDeceasedOffspring: 2,
        weaningSurvivabilityRate: (2 / 5 * 100).toFixed(2) + "%", // 40.00%
        averageActualOffspringPerLitter: 5,
      });

      const savedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ reportName });
      assertObjectMatch(savedReport!, report);
    });

    await t.step("should return an error if any target mother does not exist", async () => {
      mother3 = "nonExistentMotherForReport";
      const { report, error } = await concept.generateReport({
        target: [mother1, mother3],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
      });
      assertEquals(report, undefined);
      assertEquals(error, `One or more target IDs are not registered mothers: ${mother3}.`);
    });

    await t.step("should return an error if report name already exists", async () => {
      const reportName = "Existing Report Name";
      await concept.generateReport({
        target: [mother1],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      }); // Create it once

      const { report, error } = await concept.generateReport({
        target: [mother1],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      }); // Try to create again

      assertEquals(report, undefined);
      assertEquals(error, `Report with name '${reportName}' already exists.`);
    });
  });

  await t.step("renameReport action", async (t) => {
    const oldName = "Report To Rename";
    const newName = "Renamed Report";
    let reportId: string;

    await t.step("setup", async () => {
      await concept.addMother({ motherId: "motherRename" });
      const { report } = await concept.generateReport({
        target: ["motherRename"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: oldName,
      });
      reportId = report!._id;
    });

    await t.step("should rename a report successfully", async () => {
      const { report, error } = await concept.renameReport({ oldName, newName });
      assertEquals(error, undefined);
      assertExists(report);
      assertEquals(report.reportName, newName);

      const savedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ _id: reportId });
      assertEquals(savedReport!.reportName, newName);
    });

    await t.step("should return an error if oldName does not exist", async () => {
      const { report, error } = await concept.renameReport({ oldName: "Non Existent", newName: "New Name" });
      assertEquals(report, undefined);
      assertEquals(error, "Report with name 'Non Existent' not found.");
    });

    await t.step("should return an error if newName already exists", async () => {
      await concept.addMother({ motherId: "motherConflict" });
      await concept.generateReport({
        target: ["motherConflict"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: "Existing Report Conflict",
      });

      const { report, error } = await concept.renameReport({
        oldName: newName, // The one we just renamed
        newName: "Existing Report Conflict",
      });
      assertEquals(report, undefined);
      assertEquals(error, "Report with new name 'Existing Report Conflict' already exists.");
    });
  });

  await t.step("viewReport action", async (t) => {
    const reportName = "Viewable Report";
    let reportId: string;

    await t.step("setup", async () => {
      await concept.addMother({ motherId: "motherView" });
      const { report } = await concept.generateReport({
        target: ["motherView"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });
      reportId = report!._id;
    });

    await t.step("should return the full report details", async () => {
      const { report, error } = await concept.viewReport({ reportName });
      assertEquals(error, undefined);
      assertExists(report);
      assertEquals(report._id, reportId);
      assertEquals(report.reportName, reportName);
      assertExists(report.results);
    });

    await t.step("should return an error if report does not exist", async () => {
      const { report, error } = await concept.viewReport({ reportName: "Non Existent Report" });
      assertEquals(report, undefined);
      assertEquals(error, "Report with name 'Non Existent Report' not found.");
    });
  });

  await t.step("listReports action", async (t) => {
    await t.step("setup", async () => {
      await concept.addMother({ motherId: "motherList" });
      await concept.generateReport({ target: ["motherList"], startDateRange: new Date("2023-01-01"), endDateRange: new Date("2023-01-01"), name: "Report A" });
      await concept.generateReport({ target: ["motherList"], startDateRange: new Date("2023-01-01"), endDateRange: new Date("2023-01-01"), name: "Report B" });
    });

    await t.step("should return all generated reports", async () => {
      const { reports } = await concept.listReports();
      assertExists(reports);
      assertEquals(reports.length, 2);
      assertEquals(reports.some(r => r.reportName === "Report A"), true);
      assertEquals(reports.some(r => r.reportName === "Report B"), true);
    });

    await t.step("should return an empty array if no reports exist", async () => {
      await db.collection("ReproductionTracking.generatedReports").deleteMany({}); // Clear reports for this sub-test
      const { reports } = await concept.listReports();
      assertEquals(reports.length, 0);
    });
  });

  await t.step("deleteReport action", async (t) => {
    const reportName = "Report To Delete";

    await t.step("setup", async () => {
      await concept.addMother({ motherId: "motherDelete" });
      await concept.generateReport({
        target: ["motherDelete"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });
    });

    await t.step("should delete a report successfully", async () => {
      const { error } = await concept.deleteReport({ reportName });
      assertEquals(error, undefined);

      const savedReport = await db.collection("ReproductionTracking.generatedReports").findOne({ reportName });
      assertEquals(savedReport, null);
    });

    await t.step("should return an error if report does not exist", async () => {
      const { error } = await concept.deleteReport({ reportName: "Non Existent Report" });
      assertEquals(error, "Report with name 'Non Existent Report' not found.");
    });
  });

  await t.step("aiSummary action", async (t) => {
    const reportName = "AI Summary Report";
    let motherId1 = "MOCK_MOTHER_HIGH";
    let motherId2 = "MOCK_MOTHER_LOW";
    let motherId3 = "MOCK_MOTHER_CONCERN";
    let motherId4 = "MOCK_MOTHER_ERROR";
    let motherId5 = "mother1"; // for average performers
    let motherId6 = "mother2"; // for average performers

    await t.step("setup", async () => {
      // Ensure all mock target mothers exist
      await concept.addMother({ motherId: motherId1 });
      await concept.addMother({ motherId: motherId2 });
      await concept.addMother({ motherId: motherId3 });
      await concept.addMother({ motherId: motherId4 });
      await concept.addMother({ motherId: motherId5 });
      await concept.addMother({ motherId: motherId6 });

      // Create dummy data for the report that will be summarized
      const { litter: l1 } = await concept.recordLitter({ motherId: motherId1, birthDate: new Date("2023-01-01"), reportedLitterSize: 10 });
      for (let i = 0; i < 9; i++) { // 9/10 offspring born, all weaned
        await concept.recordOffspring({ litterId: l1!._id, offspringId: `${motherId1}_o${i}`, sex: Sex.Female });
        await concept.recordWeaning({ offspringId: `${motherId1}_o${i}` });
      }

      const { litter: l2 } = await concept.recordLitter({ motherId: motherId2, birthDate: new Date("2023-01-01"), reportedLitterSize: 5 });
      await concept.recordOffspring({ litterId: l2!._id, offspringId: `${motherId2}_o1`, sex: Sex.Male }); // 1/5 offspring born, 0 weaned
      await concept.recordDeath({ offspringId: `${motherId2}_o1` });

      const { litter: l3 } = await concept.recordLitter({ motherId: motherId3, birthDate: new Date("2023-01-01"), reportedLitterSize: 8 });
      for (let i = 0; i < 8; i++) { // 8 offspring born, 2 weaned, 6 died
        await concept.recordOffspring({ litterId: l3!._id, offspringId: `${motherId3}_o${i}`, sex: Sex.Female });
        if (i < 2) await concept.recordWeaning({ offspringId: `${motherId3}_o${i}` });
        else await concept.recordDeath({ offspringId: `${motherId3}_o${i}` });
      }

      const { litter: l4 } = await concept.recordLitter({ motherId: motherId4, birthDate: new Date("2023-01-01"), reportedLitterSize: 3 });
      // This mother has 2 offspring born, but we'll mark 3 as weaned to trigger a "potential record error" in the prompt
      await concept.recordOffspring({ litterId: l4!._id, offspringId: `${motherId4}_o1`, sex: Sex.Male });
      await concept.recordOffspring({ litterId: l4!._id, offspringId: `${motherId4}_o2`, sex: Sex.Female });
      // Manually manipulate the data to create an impossible scenario for the AI to flag
      await db.collection("ReproductionTracking.offspring").updateOne({ _id: `${motherId4}_o1` }, { $set: { survivedTillWeaning: true } });
      await db.collection("ReproductionTracking.offspring").updateOne({ _id: `${motherId4}_o2` }, { $set: { survivedTillWeaning: true } });
      // Add a phantom weaning event (not by concept action, but for testing AI's ability to spot inconsistencies)
      await db.collection("ReproductionTracking.offspring").insertOne({ _id: `${motherId4}_o_phantom`, litterId: l4!._id, sex: Sex.Male, isAlive: true, survivedTillWeaning: true });

      const { litter: l5 } = await concept.recordLitter({ motherId: motherId5, birthDate: new Date("2023-01-01"), reportedLitterSize: 5 });
      for (let i = 0; i < 5; i++) {
        await concept.recordOffspring({ litterId: l5!._id, offspringId: `${motherId5}_o${i}`, sex: Sex.Male });
        if (i < 3) await concept.recordWeaning({ offspringId: `${motherId5}_o${i}` });
      }

      const { litter: l6 } = await concept.recordLitter({ motherId: motherId6, birthDate: new Date("2023-01-01"), reportedLitterSize: 6 });
      for (let i = 0; i < 6; i++) {
        await concept.recordOffspring({ litterId: l6!._id, offspringId: `${motherId6}_o${i}`, sex: Sex.Female });
        if (i < 4) await concept.recordWeaning({ offspringId: `${motherId6}_o${i}` });
      }

      await concept.generateReport({
        target: [motherId1, motherId2, motherId3, motherId4, motherId5, motherId6],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });
    });

    await t.step("should generate an AI summary for an existing report", async () => {
      // Temporarily set the environment variable for this test step, if not already set.
      // In a real testing environment, this would be managed by the test runner config.
      Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY");

      const { summary, error } = await concept.aiSummary({ reportName });
      assertEquals(error, undefined);
      assertExists(summary);

      // Parse the JSON summary to check its structure
      const parsedSummary = JSON.parse(summary);
      assertExists(parsedSummary.highPerformers);
      assertExists(parsedSummary.lowPerformers);
      assertExists(parsedSummary.concerningTrends);
      assertExists(parsedSummary.averagePerformers);
      assertExists(parsedSummary.potentialRecordErrors);
      assertExists(parsedSummary.insights);

      assertEquals(parsedSummary.highPerformers, ["MOCK_MOTHER_HIGH"]);
      assertEquals(parsedSummary.lowPerformers, ["MOCK_MOTHER_LOW"]);
      assertEquals(parsedSummary.concerningTrends, ["MOCK_MOTHER_CONCERN"]);
      assertEquals(parsedSummary.averagePerformers.sort(), ["mother1", "mother2"].sort());
      assertEquals(parsedSummary.potentialRecordErrors, ["MOCK_MOTHER_ERROR"]);
      assertExists(parsedSummary.insights); // Check that insights are present
    });

    await t.step("should return an error if report does not exist", async () => {
      const { summary, error } = await concept.aiSummary({ reportName: "Non Existent AI Report" });
      assertEquals(summary, undefined);
      assertEquals(error, "Report with name 'Non Existent AI Report' not found.");
    });

    await t.step("should return an error if GEMINI_API_KEY is not set", async () => {
      Deno.env.delete("GEMINI_API_KEY"); // Clear the key for this test
      const { summary, error } = await concept.aiSummary({ reportName });
      assertEquals(summary, undefined);
      assertEquals(error, "GEMINI_API_KEY environment variable is not set.");
      Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY"); // Reset for subsequent tests
    });
  });

  await t.step("Principle Trace: Recording a full reproductive cycle and reporting", async () => {
    const motherId = "principleMother";
    const fatherId = "principleFather";
    const birthDate1 = new Date("2023-01-15");
    const birthDate2 = new Date("2023-07-20");

    // 1. A user records birth events by first creating a litter for a mother animal,
    // optionally linking a father and setting an expected litter size;
    const { litter: litter1 } = await concept.recordLitter({
      motherId,
      fatherId,
      birthDate: birthDate1,
      reportedLitterSize: 6,
      notes: "First litter for principleMother",
    });
    assertExists(litter1);
    assertEquals(litter1.motherId, motherId);
    assertEquals(litter1.reportedLitterSize, 6);

    const { litter: litter2 } = await concept.recordLitter({
      motherId,
      birthDate: birthDate2, // Different father (optional), implicitly null
      reportedLitterSize: 4,
      notes: "Second litter for principleMother",
    });
    assertExists(litter2);
    assertEquals(litter2.motherId, motherId);
    assertEquals(litter2.reportedLitterSize, 4);

    // 2. Then, individual offspring born to that litter are recorded and linked to it;
    const offspringIds1 = [];
    for (let i = 0; i < 5; i++) { // 5 live births for litter1
      const sex = i % 2 === 0 ? Sex.Male : Sex.Female;
      const { offspring } = await concept.recordOffspring({
        litterId: litter1._id,
        offspringId: `o1-${i}`,
        sex,
        notes: `Offspring ${i} of litter1`,
      });
      assertExists(offspring);
      offspringIds1.push(offspring._id);
    }

    const offspringIds2 = [];
    for (let i = 0; i < 4; i++) { // 4 live births for litter2
      const sex = i % 2 === 0 ? Sex.Female : Sex.Male;
      const { offspring } = await concept.recordOffspring({
        litterId: litter2._id,
        offspringId: `o2-${i}`,
        sex,
        notes: `Offspring ${i} of litter2`,
      });
      assertExists(offspring);
      offspringIds2.push(offspring._id);
    }

    // 3. Later records weaning outcomes for those offspring when the data becomes available;
    // For litter1: 3 weaned, 1 died, 1 no status
    await concept.recordWeaning({ offspringId: offspringIds1[0] });
    await concept.recordWeaning({ offspringId: offspringIds1[1] });
    await concept.recordWeaning({ offspringId: offspringIds1[2] });
    await concept.recordDeath({ offspringId: offspringIds1[3] }); // Died before weaning

    // For litter2: 3 weaned, 1 died
    await concept.recordWeaning({ offspringId: offspringIds2[0] });
    await concept.recordWeaning({ offspringId: offspringIds2[1] });
    await concept.recordWeaning({ offspringId: offspringIds2[2] });
    await concept.recordDeath({ offspringId: offspringIds2[3] });

    // Verify weaning/death status for a sample offspring
    const o1_0_status = await db.collection("ReproductionTracking.offspring").findOne({ _id: offspringIds1[0] });
    assertExists(o1_0_status);
    assertEquals(o1_0_status.survivedTillWeaning, true);
    assertEquals(o1_0_status.isAlive, true);

    const o1_3_status = await db.collection("ReproductionTracking.offspring").findOne({ _id: offspringIds1[3] });
    assertExists(o1_3_status);
    assertEquals(o1_3_status.survivedTillWeaning, false);
    assertEquals(o1_3_status.isAlive, false);

    // 4. Uses this data to generate reports to evaluate reproductive performance and inform breeding decisions,
    // including litter-specific metrics;
    const reportName = "Principle Trace Report";
    const { report } = await concept.generateReport({
      target: [motherId],
      startDateRange: new Date("2023-01-01"),
      endDateRange: new Date("2023-12-31"),
      name: reportName,
    });
    assertExists(report);
    assertEquals(report.reportName, reportName);
    assertEquals(report.target, [motherId]);

    // Expected overall metrics
    // Litters recorded: 2
    // Reported litter size: 6 + 4 = 10
    // Actual offspring born: 5 + 4 = 9
    // Weaned offspring: 3 + 3 = 6
    // Deceased offspring: 1 + 1 = 2
    assertObjectMatch(report.results, {
      uniqueLittersRecorded: 2,
      totalReportedLitterSize: 10,
      totalActualOffspringBorn: 9,
      totalWeanedOffspring: 6,
      totalDeceasedOffspring: 2,
      averageReportedLitterSize: 5, // 10 / 2
      averageActualOffspringPerLitter: 4.5, // 9 / 2
      survivabilityRateToWeaning: (6 / 9 * 100).toFixed(2) + "%", // ~66.67%
      motherCount: 1,
    });

    // Per-mother metrics for principleMother
    const mPerf = report.results.perMotherPerformance.find(p => p.motherId === motherId);
    assertExists(mPerf);
    assertObjectMatch(mPerf, {
      littersRecorded: 2,
      totalOffspringBorn: 9,
      totalOffspringWeaned: 6,
      totalDeceasedOffspring: 2,
      weaningSurvivabilityRate: (6 / 9 * 100).toFixed(2) + "%", // ~66.67%
      averageActualOffspringPerLitter: 4.5,
    });

    // 5. Can choose to generate an AI summary of generated reports to aide in understanding and decision making;
    Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY"); // Ensure API key is set for the mock
    const { summary: aiSummary, error: aiError } = await concept.aiSummary({ reportName });
    assertEquals(aiError, undefined);
    assertExists(aiSummary);

    const parsedAiSummary = JSON.parse(aiSummary);
    assertExists(parsedAiSummary.insights);
    assertExists(parsedAiSummary.highPerformers);
    // The specific output will depend on the mock, but we assert its presence and basic structure.
    assertEquals(parsedAiSummary.highPerformers, ["MOCK_MOTHER_HIGH"]); // This comes from our mock
  });
});
```
