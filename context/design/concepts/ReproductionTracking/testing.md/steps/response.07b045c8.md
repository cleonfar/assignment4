---
timestamp: 'Thu Oct 16 2025 14:11:56 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_141156.c0cf1f9a.md]]'
content_id: 07b045c80eb49eb0f90b76c2809656a2a6fbae5b5ad5378b4badc4b6998e10aa
---

# response:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts
import { Collection, Db, MongoClient } from "npm:mongodb";
import { assertEquals, assertExists, assertNotEquals, assertArrayIncludes, assert } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept, { Sex } from "./ReproductionTrackingConcept.ts";
import { ID } from "@utils/types.ts";

const PREFIX = "ReproductionTracking" + "."; // Re-declare prefix for test access if needed, or rely on concept's internal use

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
    const motherId: ID = "mother1";

    await t.step("should add a new mother", async () => {
      const result = await concept.addMother({ motherId });
      assertEquals(result.motherId, motherId);

      const addedMother = await db.collection(PREFIX + "mothers").findOne({ _id: motherId });
      assertExists(addedMother);
      assertEquals(addedMother._id, motherId);
    });

    await t.step("should return an error if mother already exists", async () => {
      // Add it first
      await concept.addMother({ motherId: "mother2" });
      const result = await concept.addMother({ motherId: "mother2" });
      assertExists(result.error);
      assertEquals(result.error, "Mother with ID mother2 already exists.");
    });
  });

  await t.step("removeMother action", async (t) => {
    const motherId: ID = "motherToRemove";

    await t.step("should remove an existing mother", async () => {
      await concept.addMother({ motherId });
      const result = await concept.removeMother({ motherId });
      assertEquals(result.motherId, motherId);

      const removedMother = await db.collection(PREFIX + "mothers").findOne({ _id: motherId });
      assertEquals(removedMother, null);
    });

    await t.step("should return an error if mother not found", async () => {
      const result = await concept.removeMother({ motherId: "nonExistentMother" });
      assertExists(result.error);
      assertEquals(result.error, "Mother with ID nonExistentMother not found.");
    });
  });

  await t.step("recordLitter action", async (t) => {
    const motherId: ID = "mother3";
    const fatherId: ID = "father1";
    const birthDate = new Date("2023-01-01T00:00:00.000Z");
    const reportedLitterSize = 5;

    await t.step("should create a new litter for an existing mother", async () => {
      await concept.addMother({ motherId });
      const result = await concept.recordLitter({ motherId, fatherId, birthDate, reportedLitterSize });

      assertExists(result.litter);
      assertEquals(result.litter.motherId, motherId);
      assertEquals(result.litter.fatherId, fatherId);
      assertEquals(result.litter.birthDate.toISOString(), birthDate.toISOString());
      assertEquals(result.litter.reportedLitterSize, reportedLitterSize);

      const addedLitter = await db.collection(PREFIX + "litters").findOne({ _id: result.litter._id });
      assertExists(addedLitter);
    });

    await t.step("should add mother if she doesn't exist and create litter", async () => {
      const newMotherId: ID = "newMotherForLitter";
      const result = await concept.recordLitter({
        motherId: newMotherId,
        birthDate,
        reportedLitterSize: 3,
      });

      assertExists(result.litter);
      assertEquals(result.litter.motherId, newMotherId);

      const addedMother = await db.collection(PREFIX + "mothers").findOne({ _id: newMotherId });
      assertExists(addedMother);
    });

    await t.step("should return an error for duplicate litter (same mother, father, birthDate)", async () => {
      await concept.addMother({ motherId: "mother4" });
      await concept.recordLitter({
        motherId: "mother4",
        fatherId: "fatherDuplicate",
        birthDate,
        reportedLitterSize: 4,
      });
      const result = await concept.recordLitter({
        motherId: "mother4",
        fatherId: "fatherDuplicate",
        birthDate,
        reportedLitterSize: 5, // Different size, but still a duplicate based on unique key
      });

      assertExists(result.error);
      assertEquals(result.error, "A litter for mother mother4 with this father and birth date already exists.");
    });
  });

  await t.step("updateLitter action", async (t) => {
    const motherId: ID = "mother5";
    const fatherId: ID = "father2";
    const birthDate = new Date("2023-02-01T00:00:00.000Z");
    const reportedLitterSize = 6;
    let litterId: ID;

    await t.step("setup: record a litter to update", async () => {
      await concept.addMother({ motherId });
      const recordResult = await concept.recordLitter({
        motherId,
        fatherId,
        birthDate,
        reportedLitterSize,
        notes: "initial notes",
      });
      assertExists(recordResult.litter);
      litterId = recordResult.litter._id;
    });

    await t.step("should update notes and reportedLitterSize", async () => {
      const newNotes = "updated notes";
      const newReportedSize = 7;
      const result = await concept.updateLitter({
        litterId,
        notes: newNotes,
        reportedLitterSize: newReportedSize,
      });

      assertExists(result.litter);
      assertEquals(result.litter._id, litterId);
      assertEquals(result.litter.notes, newNotes);
      assertEquals(result.litter.reportedLitterSize, newReportedSize);

      const updatedLitter = await db.collection(PREFIX + "litters").findOne({ _id: litterId });
      assertExists(updatedLitter);
      assertEquals(updatedLitter.notes, newNotes);
      assertEquals(updatedLitter.reportedLitterSize, newReportedSize);
    });

    await t.step("should update motherId to an existing mother", async () => {
      const newMotherId: ID = "mother6";
      await concept.addMother({ motherId: newMotherId });
      const result = await concept.updateLitter({ litterId, motherId: newMotherId });

      assertExists(result.litter);
      assertEquals(result.litter.motherId, newMotherId);

      const updatedLitter = await db.collection(PREFIX + "litters").findOne({ _id: litterId });
      assertExists(updatedLitter);
      assertEquals(updatedLitter.motherId, newMotherId);
    });

    await t.step("should update motherId to a new mother (and add her)", async () => {
      const brandNewMotherId: ID = "mother7";
      const result = await concept.updateLitter({ litterId, motherId: brandNewMotherId });

      assertExists(result.litter);
      assertEquals(result.litter.motherId, brandNewMotherId);

      const addedMother = await db.collection(PREFIX + "mothers").findOne({ _id: brandNewMotherId });
      assertExists(addedMother);
    });

    await t.step("should return an error if litter not found", async () => {
      const result = await concept.updateLitter({ litterId: "nonExistentLitter", notes: "no" });
      assertExists(result.error);
      assertEquals(result.error, "Litter with ID nonExistentLitter not found.");
    });
  });

  await t.step("recordOffspring action", async (t) => {
    let litterId: ID;
    const motherId: ID = "mother8";

    await t.step("setup: record a litter", async () => {
      await concept.addMother({ motherId });
      const recordResult = await concept.recordLitter({
        motherId,
        birthDate: new Date("2023-03-01"),
        reportedLitterSize: 3,
      });
      assertExists(recordResult.litter);
      litterId = recordResult.litter._id;
    });

    await t.step("should create a new offspring record", async () => {
      const offspringId: ID = "offspring1";
      const result = await concept.recordOffspring({ litterId, offspringId, sex: Sex.Female });

      assertExists(result.offspring);
      assertEquals(result.offspring._id, offspringId);
      assertEquals(result.offspring.litterId, litterId);
      assertEquals(result.offspring.sex, Sex.Female);
      assertEquals(result.offspring.isAlive, true);
      assertEquals(result.offspring.survivedTillWeaning, false);

      const addedOffspring = await db.collection(PREFIX + "offspring").findOne({ _id: offspringId });
      assertExists(addedOffspring);
    });

    await t.step("should return an error if litterId does not exist", async () => {
      const result = await concept.recordOffspring({
        litterId: "nonExistentLitterId",
        offspringId: "offspring2",
        sex: Sex.Male,
      });
      assertExists(result.error);
      assertEquals(result.error, "Litter with ID nonExistentLitterId not found.");
    });

    await t.step("should return an error if offspringId already exists", async () => {
      const offspringId: ID = "offspringExisting";
      await concept.recordOffspring({ litterId, offspringId, sex: Sex.Male });
      const result = await concept.recordOffspring({ litterId, offspringId, sex: Sex.Female });
      assertExists(result.error);
      assertEquals(result.error, "Offspring with ID offspringExisting already exists.");
    });
  });

  await t.step("updateOffspring action", async (t) => {
    let litterId1: ID, litterId2: ID;
    let offspringId: ID;

    await t.step("setup: record mothers, litters, and offspring", async () => {
      await concept.addMother({ motherId: "mother9" });
      await concept.addMother({ motherId: "mother10" }); // For another litter

      const litterResult1 = await concept.recordLitter({
        motherId: "mother9",
        birthDate: new Date("2023-04-01"),
        reportedLitterSize: 2,
      });
      assertExists(litterResult1.litter);
      litterId1 = litterResult1.litter._id;

      const litterResult2 = await concept.recordLitter({
        motherId: "mother10",
        birthDate: new Date("2023-04-05"),
        reportedLitterSize: 3,
      });
      assertExists(litterResult2.litter);
      litterId2 = litterResult2.litter._id;

      const offspringResult = await concept.recordOffspring({
        litterId: litterId1,
        offspringId: "offspringToUpdate",
        sex: Sex.Male,
        notes: "initial notes",
      });
      assertExists(offspringResult.offspring);
      offspringId = offspringResult.offspring._id;
    });

    await t.step("should update sex and notes", async () => {
      const newNotes = "updated offspring notes";
      const result = await concept.updateOffspring({ offspringId, sex: Sex.Female, notes: newNotes });

      assertExists(result.offspring);
      assertEquals(result.offspring._id, offspringId);
      assertEquals(result.offspring.sex, Sex.Female);
      assertEquals(result.offspring.notes, newNotes);

      const updatedOffspring = await db.collection(PREFIX + "offspring").findOne({ _id: offspringId });
      assertExists(updatedOffspring);
      assertEquals(updatedOffspring.sex, Sex.Female);
      assertEquals(updatedOffspring.notes, newNotes);
    });

    await t.step("should update litterId to an existing litter", async () => {
      const result = await concept.updateOffspring({ offspringId, litterId: litterId2 });

      assertExists(result.offspring);
      assertEquals(result.offspring.litterId, litterId2);

      const updatedOffspring = await db.collection(PREFIX + "offspring").findOne({ _id: offspringId });
      assertExists(updatedOffspring);
      assertEquals(updatedOffspring.litterId, litterId2);
    });

    await t.step("should return an error if new litterId does not exist", async () => {
      const result = await concept.updateOffspring({ offspringId, litterId: "nonExistentNewLitter" });
      assertExists(result.error);
      assertEquals(result.error, "New litter with ID nonExistentNewLitter for offspring update not found.");
    });

    await t.step("should return an error if offspring not found", async () => {
      const result = await concept.updateOffspring({ offspringId: "nonExistentOffspring", sex: Sex.Neuter });
      assertExists(result.error);
      assertEquals(result.error, "Offspring with ID nonExistentOffspring not found.");
    });
  });

  await t.step("recordWeaning action", async (t) => {
    let litterId: ID;
    let aliveOffspringId: ID;
    let deceasedOffspringId: ID;
    let alreadyWeanedOffspringId: ID;

    await t.step("setup: record litter and offspring", async () => {
      await concept.addMother({ motherId: "mother11" });
      const litterResult = await concept.recordLitter({
        motherId: "mother11",
        birthDate: new Date("2023-05-01"),
        reportedLitterSize: 3,
      });
      assertExists(litterResult.litter);
      litterId = litterResult.litter._id;

      await concept.recordOffspring({ litterId, offspringId: "offspringAlive", sex: Sex.Male });
      aliveOffspringId = "offspringAlive";

      await concept.recordOffspring({ litterId, offspringId: "offspringDeceased", sex: Sex.Female });
      deceasedOffspringId = "offspringDeceased";
      await concept.recordDeath({ offspringId: deceasedOffspringId });

      await concept.recordOffspring({ litterId, offspringId: "offspringWeaned", sex: Sex.Neuter });
      alreadyWeanedOffspringId = "offspringWeaned";
      await concept.recordWeaning({ offspringId: alreadyWeanedOffspringId });
    });

    await t.step("should set `survivedTillWeaning` to true for an alive offspring", async () => {
      const result = await concept.recordWeaning({ offspringId: aliveOffspringId });
      assertEquals(result.offspringId, aliveOffspringId);

      const offspring = await db.collection(PREFIX + "offspring").findOne({ _id: aliveOffspringId });
      assertExists(offspring);
      assertEquals(offspring.survivedTillWeaning, true);
    });

    await t.step("should return an error if offspring is not alive", async () => {
      const result = await concept.recordWeaning({ offspringId: deceasedOffspringId });
      assertExists(result.error);
      assertEquals(result.error, `Offspring with ID ${deceasedOffspringId} is not alive and cannot be weaned.`);
    });

    await t.step("should return an error if offspring is already weaned", async () => {
      const result = await concept.recordWeaning({ offspringId: alreadyWeanedOffspringId });
      assertExists(result.error);
      assertEquals(result.error, `Offspring with ID ${alreadyWeanedOffspringId} is already marked as weaned.`);
    });

    await t.step("should return an error if offspring not found", async () => {
      const result = await concept.recordWeaning({ offspringId: "nonExistentWeaning" });
      assertExists(result.error);
      assertEquals(result.error, "Offspring with ID nonExistentWeaning not found.");
    });
  });

  await t.step("recordDeath action", async (t) => {
    let litterId: ID;
    let aliveOffspringId: ID;
    let deceasedOffspringId: ID;

    await t.step("setup: record litter and offspring", async () => {
      await concept.addMother({ motherId: "mother12" });
      const litterResult = await concept.recordLitter({
        motherId: "mother12",
        birthDate: new Date("2023-06-01"),
        reportedLitterSize: 2,
      });
      assertExists(litterResult.litter);
      litterId = litterResult.litter._id;

      await concept.recordOffspring({ litterId, offspringId: "offspringAliveForDeath", sex: Sex.Male });
      aliveOffspringId = "offspringAliveForDeath";

      await concept.recordOffspring({ litterId, offspringId: "offspringDeceasedAlready", sex: Sex.Female });
      deceasedOffspringId = "offspringDeceasedAlready";
      await concept.recordDeath({ offspringId: deceasedOffspringId });
    });

    await t.step("should set `isAlive` to false for an alive offspring", async () => {
      const result = await concept.recordDeath({ offspringId: aliveOffspringId });
      assertEquals(result.offspringId, aliveOffspringId);

      const offspring = await db.collection(PREFIX + "offspring").findOne({ _id: aliveOffspringId });
      assertExists(offspring);
      assertEquals(offspring.isAlive, false);
    });

    await t.step("should return an error if offspring is already deceased", async () => {
      const result = await concept.recordDeath({ offspringId: deceasedOffspringId });
      assertExists(result.error);
      assertEquals(result.error, `Offspring with ID ${deceasedOffspringId} is already marked as deceased.`);
    });

    await t.step("should return an error if offspring not found", async () => {
      const result = await concept.recordDeath({ offspringId: "nonExistentDeath" });
      assertExists(result.error);
      assertEquals(result.error, "Offspring with ID nonExistentDeath not found.");
    });
  });

  await t.step("viewLittersOfMother action", async (t) => {
    const motherIdWithLitters: ID = "motherWithLitters";
    const motherIdNoLitters: ID = "motherNoLitters";
    let litterId1: ID, litterId2: ID;

    await t.step("setup: record mothers and litters", async () => {
      await concept.addMother({ motherId: motherIdWithLitters });
      await concept.addMother({ motherId: motherIdNoLitters });

      const res1 = await concept.recordLitter({
        motherId: motherIdWithLitters,
        birthDate: new Date("2023-07-01"),
        reportedLitterSize: 4,
      });
      litterId1 = res1.litter!._id;

      const res2 = await concept.recordLitter({
        motherId: motherIdWithLitters,
        birthDate: new Date("2023-07-15"),
        reportedLitterSize: 3,
      });
      litterId2 = res2.litter!._id;
    });

    await t.step("should return all litters for a mother with litters", async () => {
      const result = await concept.viewLittersOfMother({ motherId: motherIdWithLitters });
      assertExists(result.litters);
      assertEquals(result.litters.length, 2);
      assertArrayIncludes(result.litters.map((l) => l._id), [litterId1, litterId2]);
    });

    await t.step("should return an empty array for a mother with no litters", async () => {
      const result = await concept.viewLittersOfMother({ motherId: motherIdNoLitters });
      assertExists(result.litters);
      assertEquals(result.litters.length, 0);
    });

    await t.step("should return an error if mother not found", async () => {
      const result = await concept.viewLittersOfMother({ motherId: "nonExistentMotherLitters" });
      assertExists(result.error);
      assertEquals(result.error, "Mother with ID nonExistentMotherLitters not found.");
    });
  });

  await t.step("viewOffspringOfLitter action", async (t) => {
    let litterIdWithOffspring: ID;
    let litterIdNoOffspring: ID;
    let offspringId1: ID, offspringId2: ID;

    await t.step("setup: record litters and offspring", async () => {
      await concept.addMother({ motherId: "mother13" });
      await concept.addMother({ motherId: "mother14" });

      const res1 = await concept.recordLitter({
        motherId: "mother13",
        birthDate: new Date("2023-08-01"),
        reportedLitterSize: 2,
      });
      litterIdWithOffspring = res1.litter!._id;

      const res2 = await concept.recordLitter({
        motherId: "mother14",
        birthDate: new Date("2023-08-05"),
        reportedLitterSize: 0,
      });
      litterIdNoOffspring = res2.litter!._id;

      await concept.recordOffspring({
        litterId: litterIdWithOffspring,
        offspringId: "offspringA",
        sex: Sex.Female,
      });
      offspringId1 = "offspringA";
      await concept.recordOffspring({
        litterId: litterIdWithOffspring,
        offspringId: "offspringB",
        sex: Sex.Male,
      });
      offspringId2 = "offspringB";
    });

    await t.step("should return all offspring for a litter with offspring", async () => {
      const result = await concept.viewOffspringOfLitter({ litterId: litterIdWithOffspring });
      assertExists(result.offspring);
      assertEquals(result.offspring.length, 2);
      assertArrayIncludes(result.offspring.map((o) => o._id), [offspringId1, offspringId2]);
    });

    await t.step("should return an empty array for a litter with no offspring", async () => {
      const result = await concept.viewOffspringOfLitter({ litterId: litterIdNoOffspring });
      assertExists(result.offspring);
      assertEquals(result.offspring.length, 0);
    });

    await t.step("should return an error if litter not found", async () => {
      const result = await concept.viewOffspringOfLitter({ litterId: "nonExistentLitterOffspring" });
      assertExists(result.error);
      assertEquals(result.error, "Litter with ID nonExistentLitterOffspring not found.");
    });
  });

  await t.step("generateReport action", async (t) => {
    const motherA = "reportMotherA";
    const motherB = "reportMotherB";
    const motherC = "reportMotherC"; // Mother with no litters in range
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-12-31T23:59:59.999Z");

    await t.step("setup: create data for report generation", async () => {
      await concept.addMother({ motherId: motherA });
      await concept.addMother({ motherId: motherB });
      await concept.addMother({ motherId: motherC });

      // Mother A: Two litters, 2 weaned, 1 death
      const litterA1 = (await concept.recordLitter({
        motherId: motherA,
        birthDate: new Date("2023-03-01"),
        reportedLitterSize: 3,
      })).litter!._id;
      await concept.recordOffspring({ litterId: litterA1, offspringId: "A1_O1", sex: Sex.Male });
      await concept.recordOffspring({ litterId: litterA1, offspringId: "A1_O2", sex: Sex.Female });
      await concept.recordOffspring({ litterId: litterA1, offspringId: "A1_O3", sex: Sex.Neuter });
      await concept.recordWeaning({ offspringId: "A1_O1" });
      await concept.recordWeaning({ offspringId: "A1_O2" });
      await concept.recordDeath({ offspringId: "A1_O3" }); // 2 weaned, 1 deceased

      const litterA2 = (await concept.recordLitter({
        motherId: motherA,
        birthDate: new Date("2023-06-15"),
        reportedLitterSize: 2,
      })).litter!._id;
      await concept.recordOffspring({ litterId: litterA2, offspringId: "A2_O1", sex: Sex.Male });
      await concept.recordOffspring({ litterId: litterA2, offspringId: "A2_O2", sex: Sex.Female });
      await concept.recordWeaning({ offspringId: "A2_O1" }); // 1 weaned, 1 still alive not weaned

      // Mother B: One litter, 1 weaned, 0 death
      const litterB1 = (await concept.recordLitter({
        motherId: motherB,
        birthDate: new Date("2023-09-01"),
        reportedLitterSize: 2,
      })).litter!._id;
      await concept.recordOffspring({ litterId: litterB1, offspringId: "B1_O1", sex: Sex.Male });
      await concept.recordOffspring({ litterId: litterB1, offspringId: "B1_O2", sex: Sex.Female });
      await concept.recordWeaning({ offspringId: "B1_O1" });
      // B1_O2 is alive but not weaned, not deceased
    });

    await t.step("should generate a report with correct overall and per-mother metrics", async () => {
      const targetMothers = [motherA, motherB, motherC];
      const reportName = "TestReproductionReport";
      const result = await concept.generateReport({ target: targetMothers, startDateRange: startDate, endDateRange: endDate, name: reportName });

      assertExists(result.report);
      assertEquals(result.report.reportName, reportName);
      assertEquals(result.report.target, targetMothers);
      assertExists(result.report.dateGenerated);

      const results = result.report.results;
      // Overall metrics
      assertEquals(results.motherCount, 3); // A, B, C
      assertEquals(results.uniqueLittersRecorded, 3); // A1, A2, B1
      assertEquals(results.totalReportedLitterSize, 3 + 2 + 2); // A1:3, A2:2, B1:2 = 7
      assertEquals(results.totalActualOffspringBorn, 3 + 2 + 2); // A1:3, A2:2, B1:2 = 7
      assertEquals(results.totalWeanedOffspring, 2 + 1 + 1); // A1:2, A2:1, B1:1 = 4
      assertEquals(results.totalDeceasedOffspring, 1); // A1:1

      assertEquals(results.averageReportedLitterSize, parseFloat((7 / 3).toFixed(2))); // 7 / 3 litters = 2.33
      assertEquals(results.averageActualOffspringPerLitter, parseFloat((7 / 3).toFixed(2))); // 7 / 3 litters = 2.33
      assertEquals(results.survivabilityRateToWeaning, parseFloat((4 / 7 * 100).toFixed(2)) + "%"); // 4 weaned / 7 born = 57.14%

      // Per-Mother Metrics
      assertExists(results.perMotherPerformance);
      assertEquals(results.perMotherPerformance.length, 3);

      const motherA_perf = results.perMotherPerformance.find(p => p.motherId === motherA);
      assertExists(motherA_perf);
      assertEquals(motherA_perf.littersRecorded, 2);
      assertEquals(motherA_perf.totalOffspringBorn, 5); // 3 from A1 + 2 from A2
      assertEquals(motherA_perf.totalOffspringWeaned, 3); // 2 from A1 + 1 from A2
      assertEquals(motherA_perf.totalDeceasedOffspring, 1); // 1 from A1
      assertEquals(motherA_perf.weaningSurvivabilityRate, parseFloat((3 / 5 * 100).toFixed(2)) + "%"); // 60.00%
      assertEquals(motherA_perf.averageActualOffspringPerLitter, parseFloat((5 / 2).toFixed(2))); // 2.50

      const motherB_perf = results.perMotherPerformance.find(p => p.motherId === motherB);
      assertExists(motherB_perf);
      assertEquals(motherB_perf.littersRecorded, 1);
      assertEquals(motherB_perf.totalOffspringBorn, 2);
      assertEquals(motherB_perf.totalOffspringWeaned, 1);
      assertEquals(motherB_perf.totalDeceasedOffspring, 0);
      assertEquals(motherB_perf.weaningSurvivabilityRate, parseFloat((1 / 2 * 100).toFixed(2)) + "%"); // 50.00%
      assertEquals(motherB_perf.averageActualOffspringPerLitter, parseFloat((2 / 1).toFixed(2))); // 2.00

      const motherC_perf = results.perMotherPerformance.find(p => p.motherId === motherC);
      assertExists(motherC_perf);
      assertEquals(motherC_perf.littersRecorded, 0);
      assertEquals(motherC_perf.totalOffspringBorn, 0);
      assertEquals(motherC_perf.totalOffspringWeaned, 0);
      assertEquals(motherC_perf.totalDeceasedOffspring, 0);
      assertEquals(motherC_perf.weaningSurvivabilityRate, "0.00%");
      assertEquals(motherC_perf.averageActualOffspringPerLitter, 0);

      const storedReport = await db.collection(PREFIX + "generatedReports").findOne({ reportName });
      assertExists(storedReport);
      assertEquals(storedReport.reportName, reportName);
    });

    await t.step("should return an error if a target mother does not exist", async () => {
      const result = await concept.generateReport({
        target: ["nonExistentMother"],
        startDateRange: startDate,
        endDateRange: endDate,
      });
      assertExists(result.error);
      assertEquals(result.error, "One or more target IDs are not registered mothers: nonExistentMother.");
    });

    await t.step("should return an error if report name already exists", async () => {
      const existingReportName = "DuplicateReportName";
      await concept.generateReport({ target: [motherA], startDateRange: startDate, endDateRange: endDate, name: existingReportName });
      const result = await concept.generateReport({ target: [motherA], startDateRange: startDate, endDateRange: endDate, name: existingReportName });
      assertExists(result.error);
      assertEquals(result.error, `Report with name '${existingReportName}' already exists.`);
    });
  });

  await t.step("renameReport action", async (t) => {
    const oldName = "ReportToRename";
    const newName = "RenamedReport";
    const conflictName = "ConflictingReport";
    let reportId: ID;

    await t.step("setup: create reports", async () => {
      await concept.addMother({ motherId: "motherRename" });
      const reportResult = await concept.generateReport({
        target: ["motherRename"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-01-01"),
        name: oldName,
      });
      reportId = reportResult.report!._id;

      await concept.generateReport({
        target: ["motherRename"],
        startDateRange: new Date("2023-01-02"),
        endDateRange: new Date("2023-01-02"),
        name: conflictName,
      });
    });

    await t.step("should rename an existing report", async () => {
      const result = await concept.renameReport({ oldName, newName });
      assertExists(result.report);
      assertEquals(result.report._id, reportId);
      assertEquals(result.report.reportName, newName);

      const renamedReport = await db.collection(PREFIX + "generatedReports").findOne({ _id: reportId });
      assertExists(renamedReport);
      assertEquals(renamedReport.reportName, newName);

      const oldReport = await db.collection(PREFIX + "generatedReports").findOne({ reportName: oldName });
      assertEquals(oldReport, null);
    });

    await t.step("should return an error if old report name does not exist", async () => {
      const result = await concept.renameReport({ oldName: "NonExistentReport", newName: "NewName" });
      assertExists(result.error);
      assertEquals(result.error, "Report with name 'NonExistentReport' not found.");
    });

    await t.step("should return an error if new report name already exists", async () => {
      const result = await concept.renameReport({ oldName: newName, newName: conflictName });
      assertExists(result.error);
      assertEquals(result.error, `Report with new name '${conflictName}' already exists.`);
    });
  });

  await t.step("viewReport action", async (t) => {
    const reportName = "ViewableReport";
    let reportId: ID;

    await t.step("setup: create a report", async () => {
      await concept.addMother({ motherId: "motherView" });
      const reportResult = await concept.generateReport({
        target: ["motherView"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-01-01"),
        name: reportName,
      });
      reportId = reportResult.report!._id;
    });

    await t.step("should return the full report details", async () => {
      const result = await concept.viewReport({ reportName });
      assertExists(result.report);
      assertEquals(result.report._id, reportId);
      assertEquals(result.report.reportName, reportName);
      assertExists(result.report.results);
    });

    await t.step("should return an error if report not found", async () => {
      const result = await concept.viewReport({ reportName: "NonExistentViewReport" });
      assertExists(result.error);
      assertEquals(result.error, "Report with name 'NonExistentViewReport' not found.");
    });
  });

  await t.step("listReports action", async (t) => {
    await t.step("setup: create multiple reports", async () => {
      await concept.addMother({ motherId: "motherList" });
      await concept.generateReport({
        target: ["motherList"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-01-01"),
        name: "ListReport1",
      });
      await concept.generateReport({
        target: ["motherList"],
        startDateRange: new Date("2023-01-02"),
        endDateRange: new Date("2023-01-02"),
        name: "ListReport2",
      });
    });

    await t.step("should return all generated reports", async () => {
      const result = await concept.listReports();
      assertExists(result.reports);
      assertEquals(result.reports.length, 2);
      assertArrayIncludes(result.reports.map((r) => r.reportName), ["ListReport1", "ListReport2"]);
    });

    await t.step("should return an empty array if no reports exist", async () => {
      // After cleanup from other tests
      await db.collection(PREFIX + "generatedReports").deleteMany({});
      const result = await concept.listReports();
      assertEquals(result.reports.length, 0);
    });
  });

  await t.step("deleteReport action", async (t) => {
    const reportToDelete = "ReportToDelete";
    const reportToKeep = "ReportToKeep";

    await t.step("setup: create reports", async () => {
      await concept.addMother({ motherId: "motherDelete" });
      await concept.generateReport({
        target: ["motherDelete"],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-01-01"),
        name: reportToDelete,
      });
      await concept.generateReport({
        target: ["motherDelete"],
        startDateRange: new Date("2023-01-02"),
        endDateRange: new Date("2023-01-02"),
        name: reportToKeep,
      });
    });

    await t.step("should delete an existing report", async () => {
      const result = await concept.deleteReport({ reportName: reportToDelete });
      assertEquals(result, {}); // Empty object on success

      const deletedReport = await db.collection(PREFIX + "generatedReports").findOne({ reportName: reportToDelete });
      assertEquals(deletedReport, null);

      const keptReport = await db.collection(PREFIX + "generatedReports").findOne({ reportName: reportToKeep });
      assertExists(keptReport);
    });

    await t.step("should return an error if report not found", async () => {
      const result = await concept.deleteReport({ reportName: "NonExistentDeleteReport" });
      assertExists(result.error);
      assertEquals(result.error, "Report with name 'NonExistentDeleteReport' not found.");
    });
  });

  await t.step("aiSummary action", async (t) => {
    const motherAI = "motherAISummary";
    const reportName = "AISummaryReport";
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-12-31T23:59:59.999Z");

    await t.step("setup: create data and a report", async () => {
      await concept.addMother({ motherId: motherAI });
      const litterAI1 = (await concept.recordLitter({
        motherId: motherAI,
        birthDate: new Date("2023-04-01"),
        reportedLitterSize: 5,
      })).litter!._id;
      await concept.recordOffspring({ litterId: litterAI1, offspringId: "AI_O1", sex: Sex.Male });
      await concept.recordOffspring({ litterId: litterAI1, offspringId: "AI_O2", sex: Sex.Female });
      await concept.recordOffspring({ litterId: litterAI1, offspringId: "AI_O3", sex: Sex.Neuter });
      await concept.recordOffspring({ litterId: litterAI1, offspringId: "AI_O4", sex: Sex.Male });
      await concept.recordOffspring({ litterId: litterAI1, offspringId: "AI_O5", sex: Sex.Female });

      await concept.recordWeaning({ offspringId: "AI_O1" });
      await concept.recordWeaning({ offspringId: "AI_O2" });
      await concept.recordDeath({ offspringId: "AI_O3" });
      await concept.recordWeaning({ offspringId: "AI_O4" }); // 4 weaned, 1 death, 1 not weaned but alive

      await concept.generateReport({
        target: [motherAI],
        startDateRange: startDate,
        endDateRange: endDate,
        name: reportName,
      });
    });

    await t.step("should return an error if GEMINI_API_KEY is not set", async () => {
      const originalApiKey = Deno.env.get("GEMINI_API_KEY");
      Deno.env.delete("GEMINI_API_KEY"); // Temporarily unset
      try {
        const result = await concept.aiSummary({ reportName });
        assertExists(result.error);
        assertEquals(result.error, "GEMINI_API_KEY environment variable is not set.");
      } finally {
        if (originalApiKey) {
          Deno.env.set("GEMINI_API_KEY", originalApiKey); // Restore
        }
      }
    });

    await t.step("should return an error if report not found", async () => {
      const result = await concept.aiSummary({ reportName: "NonExistentAISummary" });
      assertExists(result.error);
      assertEquals(result.error, "Report with name 'NonExistentAISummary' not found.");
    });

    await t.step("should generate a valid JSON summary if API key is set", {
      // This test is conditional on the API key existing.
      // If it doesn't exist, the previous test case covers the error.
      // If it does, we expect a valid JSON response.
      skip: !Deno.env.get("GEMINI_API_KEY"),
    }, async () => {
      const result = await concept.aiSummary({ reportName });
      assertExists(result.summary, "Expected an AI summary to be generated.");
      assertNotEquals(result.summary.length, 0, "Summary should not be empty.");

      // Attempt to parse the summary to ensure it's valid JSON
      let parsedSummary;
      try {
        parsedSummary = JSON.parse(result.summary);
      } catch (e) {
        throw new Error(`AI summary was not valid JSON: ${e.message}\nSummary: ${result.summary}`);
      }

      // Check for expected top-level keys in the parsed JSON
      const expectedKeys = [
        "highPerformers",
        "lowPerformers",
        "concerningTrends",
        "averagePerformers",
        "potentialRecordErrors",
        "insights",
      ];
      assert(
        expectedKeys.every(key => key in parsedSummary),
        `AI summary missing expected keys: ${
          expectedKeys.filter(key => !(key in parsedSummary)).join(", ")
        }`,
      );
      assert(Array.isArray(parsedSummary.highPerformers));
      assert(typeof parsedSummary.insights === "string");
    });
  });

  await t.step("# trace: Principle Fulfillment", async (t) => {
    // purpose: track reproductive outcomes and offspring survivability for breeding animals, organizing individual offspring into distinct litters.
    // principle: a user records birth events by first creating a litter for a mother animal, optionally linking a father and setting an expected litter size;
    // then, individual offspring born to that litter are recorded and linked to it;
    // later records weaning outcomes for those offspring when the data becomes available;
    // uses this data to generate reports to evaluate reproductive performance and inform breeding decisions, including litter-specific metrics;
    // can choose to generate an AI summary of generated reports to aide in understanding and decision making;

    const motherId: ID = "PrincipleMother1";
    const fatherId: ID = "PrincipleFather1";
    const litterBirthDate = new Date("2023-01-01T10:00:00Z");
    const reportedSize = 4;
    const reportName = "PrincipleReport";
    const startDate = new Date("2022-12-01T00:00:00Z");
    const endDate = new Date("2023-02-28T23:59:59Z");

    let litterId: ID;

    await t.step("1. User records birth events by creating a litter", async () => {
      const result = await concept.recordLitter({
        motherId,
        fatherId,
        birthDate: litterBirthDate,
        reportedLitterSize: reportedSize,
        notes: "First litter of PrincipleMother1",
      });
      assertExists(result.litter);
      litterId = result.litter._id;
      assertEquals(result.litter.motherId, motherId);
      assertEquals(result.litter.reportedLitterSize, reportedSize);

      const mother = await db.collection(PREFIX + "mothers").findOne({ _id: motherId });
      assertExists(mother, "Mother should have been added implicitly.");
    });

    await t.step("2. Individual offspring born to that litter are recorded", async () => {
      await concept.recordOffspring({ litterId, offspringId: "Off1", sex: Sex.Male });
      await concept.recordOffspring({ litterId, offspringId: "Off2", sex: Sex.Female });
      await concept.recordOffspring({ litterId, offspringId: "Off3", sex: Sex.Female });
      await concept.recordOffspring({ litterId, offspringId: "Off4", sex: Sex.Male });

      const offspringInLitter = await db.collection(PREFIX + "offspring").find({ litterId }).toArray();
      assertEquals(offspringInLitter.length, 4);
      assertEquals(offspringInLitter.filter(o => o.isAlive).length, 4);
      assertEquals(offspringInLitter.filter(o => !o.survivedTillWeaning).length, 4);
    });

    await t.step("3. Later records weaning outcomes for those offspring", async () => {
      await concept.recordWeaning({ offspringId: "Off1" });
      await concept.recordWeaning({ offspringId: "Off2" });
      await concept.recordDeath({ offspringId: "Off3" }); // Died before weaning

      const off1 = await db.collection(PREFIX + "offspring").findOne({ _id: "Off1" });
      assertExists(off1);
      assertEquals(off1.survivedTillWeaning, true);

      const off2 = await db.collection(PREFIX + "offspring").findOne({ _id: "Off2" });
      assertExists(off2);
      assertEquals(off2.survivedTillWeaning, true);

      const off3 = await db.collection(PREFIX + "offspring").findOne({ _id: "Off3" });
      assertExists(off3);
      assertEquals(off3.isAlive, false);
      assertEquals(off3.survivedTillWeaning, false); // Should not be weaned if died

      const off4 = await db.collection(PREFIX + "offspring").findOne({ _id: "Off4" });
      assertExists(off4);
      assertEquals(off4.isAlive, true);
      assertEquals(off4.survivedTillWeaning, false); // Still alive, not weaned
    });

    await t.step("4. Uses this data to generate reports to evaluate reproductive performance", async () => {
      const reportResult = await concept.generateReport({
        target: [motherId],
        startDateRange: startDate,
        endDateRange: endDate,
        name: reportName,
      });
      assertExists(reportResult.report);
      const results = reportResult.report.results;

      // Verify overall metrics
      assertEquals(results.uniqueLittersRecorded, 1);
      assertEquals(results.totalReportedLitterSize, reportedSize);
      assertEquals(results.totalActualOffspringBorn, 4);
      assertEquals(results.totalWeanedOffspring, 2); // Off1, Off2
      assertEquals(results.totalDeceasedOffspring, 1); // Off3

      assertEquals(results.averageReportedLitterSize, parseFloat((reportedSize / 1).toFixed(2))); // 4.00
      assertEquals(results.averageActualOffspringPerLitter, parseFloat((4 / 1).toFixed(2))); // 4.00
      assertEquals(results.survivabilityRateToWeaning, parseFloat((2 / 4 * 100).toFixed(2)) + "%"); // 50.00%

      // Verify per-mother metrics
      assertEquals(results.perMotherPerformance.length, 1);
      const motherPerf = results.perMotherPerformance[0];
      assertEquals(motherPerf.motherId, motherId);
      assertEquals(motherPerf.littersRecorded, 1);
      assertEquals(motherPerf.totalOffspringBorn, 4);
      assertEquals(motherPerf.totalOffspringWeaned, 2);
      assertEquals(motherPerf.totalDeceasedOffspring, 1);
      assertEquals(motherPerf.weaningSurvivabilityRate, parseFloat((2 / 4 * 100).toFixed(2)) + "%");
      assertEquals(motherPerf.averageActualOffspringPerLitter, parseFloat((4 / 1).toFixed(2)));
    });

    await t.step("5. Can choose to generate an AI summary of generated reports", {
      skip: !Deno.env.get("GEMINI_API_KEY"),
    }, async () => {
      const summaryResult = await concept.aiSummary({ reportName });
      assertExists(summaryResult.summary, "AI summary should be generated.");
      assertNotEquals(summaryResult.summary.length, 0, "AI summary should not be empty.");

      // Basic JSON validation as in the dedicated aiSummary test
      let parsedSummary;
      try {
        parsedSummary = JSON.parse(summaryResult.summary);
      } catch (e) {
        throw new Error(`AI summary in principle trace was not valid JSON: ${e.message}\nSummary: ${summaryResult.summary}`);
      }
      assertExists(parsedSummary.insights);
      assert(typeof parsedSummary.insights === "string");
      assert(Array.isArray(parsedSummary.highPerformers));
    });
  });
});
```
