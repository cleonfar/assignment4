---
timestamp: 'Thu Oct 16 2025 15:12:25 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_151225.c5932023.md]]'
content_id: 24eac3bb33d64ae20065db48d349c4d29c20606154faa63961b253a8c6fd1199
---

# test: ReproductionTracking

You are absolutely right! My apologies for the oversight. TypeScript's type system can be quite nuanced, and the `assertObjectMatch` function expects a type that includes an index signature, which our interfaces like `Litter` explicitly do not have.

The error message `Conversion of type 'Litter' to type 'Record<PropertyKey, unknown>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.` directly points to the solution. To explicitly tell TypeScript that we intend this conversion and we are aware of the type structure, we need to cast to `unknown` *first*, and then to `Record<PropertyKey, unknown>`.

I've updated the test file to apply this double-cast consistently wherever `assertObjectMatch` is used with our custom interfaces.

Here's the corrected test file:

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts
import { Collection, Db, MongoClient } from "npm:mongodb"; // Keep for setup and `testDb` functionality
import { assertEquals, assertExists, assertInstanceOf, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept, { Sex } from "./ReproductionTrackingConcept.ts";

// Mock the GoogleGenerativeAI to prevent actual API calls during testing
// This ensures tests are fast, reliable, and don't require an actual API key.
// The mock will mimic the expected JSON output structure based on the prompt's requirements.
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
          "Overall, the group shows moderate performance. Mother MOCK_MOTHER_HIGH is a standout with excellent survivability rates. However, MOCK_MOTHER_LOW's performance is concerning with very low offspring survival, suggesting potential health issues or poor maternal care. MOCK_MOTHER_CONCERN shows a high death rate, indicating a need for investigation into the causes of mortality. The data for MOCK_MOTHER_ERROR, showing a large reported litter size but only one actual offspring, indicates a likely record-keeping error that needs immediate verification. Management should focus on improving outcomes for low performers and correcting data inaccuracies to ensure reliable reporting.",
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

// Override the module's export for testing purposes
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

      // Verify existence by attempting to add again, which should return an error
      const { error: duplicateError } = await concept.addMother({ motherId: "mother1" });
      assertExists(duplicateError);
      assertEquals(duplicateError, "Mother with ID mother1 already exists.");
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

      // Verify removal by trying to add it again (should succeed now)
      const { motherId: reAddedMotherId, error: reAddError } = await concept.addMother({ motherId: "mother3" });
      assertEquals(reAddError, undefined);
      assertEquals(reAddedMotherId, "mother3");
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

      // Verify litter exists by viewing litters of the mother
      const { litters } = await concept.viewLittersOfMother({ motherId: "mother4" });
      assertExists(litters);
      assertEquals(litters.length, 1);
      assertObjectMatch(litters[0] as unknown as Record<PropertyKey, unknown>, litter as unknown as Record<PropertyKey, unknown>);
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

      // Verify mother exists by trying to add it again (should now return error)
      const { error: duplicateMotherError } = await concept.addMother({ motherId: "newMother" });
      assertExists(duplicateMotherError);
      assertEquals(duplicateMotherError, "Mother with ID newMother already exists.");
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
    let originalMotherId: string;
    await t.step("setup", async () => {
      originalMotherId = "mother6";
      await concept.addMother({ motherId: originalMotherId });
      const { litter } = await concept.recordLitter({
        motherId: originalMotherId,
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

      // Verify update using view action
      const { litters } = await concept.viewLittersOfMother({ motherId: originalMotherId });
      assertExists(litters);
      const updatedLitterInView = litters.find(l => l._id === litterId);
      assertExists(updatedLitterInView);
      assertObjectMatch(updatedLitterInView as unknown as Record<PropertyKey, unknown>, litter as unknown as Record<PropertyKey, unknown>);
    });

    await t.step("should update motherId and add new mother if not existing", async () => {
      const newMotherId = "mother7";
      const { litter, error } = await concept.updateLitter({
        litterId,
        motherId: newMotherId,
      });
      assertEquals(error, undefined);
      assertExists(litter);
      assertEquals(litter.motherId, newMotherId);

      // Verify old mother no longer has this litter
      const { litters: oldMotherLitters } = await concept.viewLittersOfMother({ motherId: originalMotherId });
      assertExists(oldMotherLitters);
      assertEquals(oldMotherLitters.length, 0); // Assuming no other litters for originalMotherId

      // Verify new mother now has this litter
      const { litters: newMotherLitters } = await concept.viewLittersOfMother({ motherId: newMotherId });
      assertExists(newMotherLitters);
      assertEquals(newMotherLitters.length, 1);
      assertObjectMatch(newMotherLitters[0] as unknown as Record<PropertyKey, unknown>, litter as unknown as Record<PropertyKey, unknown>);

      // Verify new mother was implicitly added
      const { error: duplicateMotherError } = await concept.addMother({ motherId: newMotherId });
      assertExists(duplicateMotherError);
      assertEquals(duplicateMotherError, `Mother with ID ${newMotherId} already exists.`);
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
      await concept.addMother({ motherId: "mother8" });
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

      // Verify offspring exists by viewing offspring of the litter
      const { offspring: litterOffspring } = await concept.viewOffspringOfLitter({ litterId });
      assertExists(litterOffspring);
      assertEquals(litterOffspring.length, 1);
      assertObjectMatch(litterOffspring[0] as unknown as Record<PropertyKey, unknown>, offspring as unknown as Record<PropertyKey, unknown>);
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
      await concept.addMother({ motherId: "mother9" });
      const { litter: l1 } = await concept.recordLitter({ motherId: "mother9", birthDate: new Date("2023-06-01"), reportedLitterSize: 3 });
      litterId1 = l1!._id;
      await concept.addMother({ motherId: "mother10" });
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

      // Verify update using view action
      const { offspring: litterOffspring } = await concept.viewOffspringOfLitter({ litterId: litterId1 });
      assertExists(litterOffspring);
      const updatedOffspringInView = litterOffspring.find(o => o._id === offspringId);
      assertExists(updatedOffspringInView);
      assertObjectMatch(updatedOffspringInView as unknown as Record<PropertyKey, unknown>, offspring as unknown as Record<PropertyKey, unknown>);
    });

    await t.step("should update litterId to an existing litter", async () => {
      const { offspring, error } = await concept.updateOffspring({ offspringId, litterId: litterId2 });
      assertEquals(error, undefined);
      assertExists(offspring);
      assertEquals(offspring.litterId, litterId2);

      // Verify offspring is no longer in old litter's view
      const { offspring: oldLitterOffspring } = await concept.viewOffspringOfLitter({ litterId: litterId1 });
      assertExists(oldLitterOffspring);
      assertEquals(oldLitterOffspring.length, 0); // Assuming this was the only offspring

      // Verify offspring is now in new litter's view
      const { offspring: newLitterOffspring } = await concept.viewOffspringOfLitter({ litterId: litterId2 });
      assertExists(newLitterOffspring);
      assertEquals(newLitterOffspring.length, 1);
      assertObjectMatch(newLitterOffspring[0] as unknown as Record<PropertyKey, unknown>, offspring as unknown as Record<PropertyKey, unknown>);
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
      await concept.addMother({ motherId: "mother11" });
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

      // Verify status using view action
      const { offspring: litterOffspring } = await concept.viewOffspringOfLitter({ litterId });
      assertExists(litterOffspring);
      const updatedOffspring = litterOffspring.find(o => o._id === offspringId);
      assertExists(updatedOffspring);
      assertEquals(updatedOffspring.survivedTillWeaning, true);
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
      await concept.addMother({ motherId: "mother12" });
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

      // Verify status using view action
      const { offspring: litterOffspring } = await concept.viewOffspringOfLitter({ litterId });
      assertExists(litterOffspring);
      const updatedOffspring = litterOffspring.find(o => o._id === offspringId);
      assertExists(updatedOffspring);
      assertEquals(updatedOffspring.isAlive, false);
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
      assertObjectMatch(litters[0] as unknown as Record<PropertyKey, unknown>, { _id: litterId1, motherId } as unknown as Record<PropertyKey, unknown>);
      assertObjectMatch(litters[1] as unknown as Record<PropertyKey, unknown>, { _id: litterId2, motherId } as unknown as Record<PropertyKey, unknown>);
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
      await concept.addMother({ motherId: "mother14" });
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
      assertObjectMatch(offspring[0] as unknown as Record<PropertyKey, unknown>, { _id: offspringId1, litterId } as unknown as Record<PropertyKey, unknown>);
      assertObjectMatch(offspring[1] as unknown as Record<PropertyKey, unknown>, { _id: offspringId2, litterId } as unknown as Record<PropertyKey, unknown>);
    });

    await t.step("should return an empty array if litter has no offspring", async () => {
      await concept.addMother({ motherId: "mother15" });
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
      await concept.recordDeath({ offspringId: "r1o3" }); // 1 deceased

      const { litter: l1_2 } = await concept.recordLitter({
        motherId: mother1,
        birthDate: new Date("2023-06-15"),
        reportedLitterSize: 3,
      });
      await concept.recordOffspring({ litterId: l1_2!._id, offspringId: "r1o5", sex: Sex.Male });
      await concept.recordOffspring({ litterId: l1_2!._id, offspringId: "r1o6", sex: Sex.Female }); // 2 born
      await concept.recordWeaning({ offspringId: "r1o5" });
      await concept.recordWeaning({ offspringId: "r1o6" }); // 0 deceased

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
      await concept.recordWeaning({ offspringId: "r2o3" }); // 3 weaned
      await concept.recordDeath({ offspringId: "r2o4" });
      await concept.recordDeath({ offspringId: "r2o5" }); // 2 deceased
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
      assertObjectMatch(report.results as unknown as Record<PropertyKey, unknown>, {
        uniqueLittersRecorded: 3,
        totalReportedLitterSize: 15, // 5 + 3 + 7
        totalActualOffspringBorn: 11, // (4 from l1_1) + (2 from l1_2) + (5 from l2_1) = 11
        totalWeanedOffspring: 7, // (2 from l1_1) + (2 from l1_2) + (3 from l2_1) = 7
        totalDeceasedOffspring: 3, // (1 from l1_1) + (0 from l1_2) + (2 from l2_1) = 3
        averageReportedLitterSize: 5, // 15 / 3
        averageActualOffspringPerLitter: parseFloat((11 / 3).toFixed(2)), // ~3.67
        survivabilityRateToWeaning: (7 / 11 * 100).toFixed(2) + "%", // ~63.64%
        motherCount: 2,
      } as unknown as Record<PropertyKey, unknown>);

      // Verify Per-Mother Metrics for mother1
      const m1Perf = report.results.perMotherPerformance.find(p => p.motherId === mother1);
      assertExists(m1Perf);
      assertObjectMatch(m1Perf as unknown as Record<PropertyKey, unknown>, {
        littersRecorded: 2,
        totalOffspringBorn: 6, // 4 + 2
        totalOffspringWeaned: 4, // 2 + 2
        totalDeceasedOffspring: 1, // 1 + 0
        weaningSurvivabilityRate: (4 / 6 * 100).toFixed(2) + "%", // ~66.67%
        averageActualOffspringPerLitter: 3, // 6 / 2
      } as unknown as Record<PropertyKey, unknown>);

      // Verify Per-Mother Metrics for mother2
      const m2Perf = report.results.perMotherPerformance.find(p => p.motherId === mother2);
      assertExists(m2Perf);
      assertObjectMatch(m2Perf as unknown as Record<PropertyKey, unknown>, {
        littersRecorded: 1,
        totalOffspringBorn: 5,
        totalOffspringWeaned: 3,
        totalDeceasedOffspring: 2,
        weaningSurvivabilityRate: (3 / 5 * 100).toFixed(2) + "%", // 60.00%
        averageActualOffspringPerLitter: 5,
      } as unknown as Record<PropertyKey, unknown>);

      // Verify the report was saved using viewReport action
      const { report: savedReport } = await concept.viewReport({ reportName });
      assertObjectMatch(savedReport! as unknown as Record<PropertyKey, unknown>, report as unknown as Record<PropertyKey, unknown>);
    });

    await t.step("should return an error if any target mother does not exist", async () => {
      const mother3 = "nonExistentMotherForReport";
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

      // Verify name change using viewReport
      const { report: updatedReportView } = await concept.viewReport({ reportName: newName });
      assertExists(updatedReportView);
      assertEquals(updatedReportView.reportName, newName);

      // Verify old name no longer exists
      const { report: oldReportView, error: oldReportError } = await concept.viewReport({ reportName: oldName });
      assertEquals(oldReportView, undefined);
      assertExists(oldReportError);
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
      // Clear reports before adding new ones to ensure consistent list size for this step
      const { reports: existingReports } = await concept.listReports();
      for (const r of existingReports) {
        await concept.deleteReport({ reportName: r.reportName });
      }

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
      // Delete existing reports for this specific sub-test to ensure it starts empty
      const { reports: existingReports } = await concept.listReports();
      for (const r of existingReports) {
        await concept.deleteReport({ reportName: r.reportName });
      }
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

      // Verify deletion using viewReport
      const { report: deletedReport, error: viewError } = await concept.viewReport({ reportName });
      assertEquals(deletedReport, undefined);
      assertExists(viewError);
      assertEquals(viewError, `Report with name '${reportName}' not found.`);
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
    let motherId4 = "MOCK_MOTHER_ERROR"; // For simulated error
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
      // MOCK_MOTHER_HIGH: good performance (9/10 offspring weaned)
      const { litter: l1 } = await concept.recordLitter({ motherId: motherId1, birthDate: new Date("2023-01-01"), reportedLitterSize: 10 });
      for (let i = 0; i < 9; i++) { // 9 actual offspring born
        const { offspring } = await concept.recordOffspring({ litterId: l1!._id, offspringId: `${motherId1}_o${i}`, sex: Sex.Female });
        await concept.recordWeaning({ offspringId: offspring!._id }); // 9 weaned
      }

      // MOCK_MOTHER_LOW: poor performance (1/5 offspring born, 0 weaned)
      const { litter: l2 } = await concept.recordLitter({ motherId: motherId2, birthDate: new Date("2023-01-01"), reportedLitterSize: 5 });
      const { offspring: o2_1 } = await concept.recordOffspring({ litterId: l2!._id, offspringId: `${motherId2}_o1`, sex: Sex.Male }); // 1 actual offspring born
      await concept.recordDeath({ offspringId: o2_1!._id }); // 1 deceased, 0 weaned

      // MOCK_MOTHER_CONCERN: medium performance with high death rate (8 offspring born, 2 weaned, 6 died)
      const { litter: l3 } = await concept.recordLitter({ motherId: motherId3, birthDate: new Date("2023-01-01"), reportedLitterSize: 8 });
      for (let i = 0; i < 8; i++) { // 8 actual offspring born
        const { offspring } = await concept.recordOffspring({ litterId: l3!._id, offspringId: `${motherId3}_o${i}`, sex: Sex.Female });
        if (i < 2) await concept.recordWeaning({ offspringId: offspring!._id }); // 2 weaned
        else await concept.recordDeath({ offspringId: offspring!._id }); // 6 died
      }

      // MOCK_MOTHER_ERROR: to simulate a record error (large reported litter size, but very few actual offspring)
      // This will result in: ReportedLitterSize=10, ActualOffspringBorn=1, Weaned=1, WeaningRate=100%. This is highly suspicious.
      const { litter: l4_fixed } = await concept.recordLitter({ motherId: motherId4, birthDate: new Date("2023-01-01"), reportedLitterSize: 10 });
      const { offspring: o4_fixed } = await concept.recordOffspring({ litterId: l4_fixed!._id, offspringId: `${motherId4}_o_fixed1`, sex: Sex.Male });
      await concept.recordWeaning({ offspringId: o4_fixed!._id });

      // mother5 and mother6 for average performers
      const { litter: l5 } = await concept.recordLitter({ motherId: motherId5, birthDate: new Date("2023-01-01"), reportedLitterSize: 5 });
      for (let i = 0; i < 5; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: l5!._id, offspringId: `${motherId5}_o${i}`, sex: Sex.Male });
        if (i < 3) await concept.recordWeaning({ offspringId: offspring!._id }); // 3/5 weaned
      }

      const { litter: l6 } = await concept.recordLitter({ motherId: motherId6, birthDate: new Date("2023-01-01"), reportedLitterSize: 6 });
      for (let i = 0; i < 6; i++) {
        const { offspring } = await concept.recordOffspring({ litterId: l6!._id, offspringId: `${motherId6}_o${i}`, sex: Sex.Female });
        if (i < 4) await concept.recordWeaning({ offspringId: offspring!._id }); // 4/6 weaned
      }

      await concept.generateReport({
        target: [motherId1, motherId2, motherId3, motherId4, motherId5, motherId6],
        startDateRange: new Date("2023-01-01"),
        endDateRange: new Date("2023-12-31"),
        name: reportName,
      });
    });

    await t.step("should generate an AI summary for an existing report", async () => {
      Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY");

      const { summary, error } = await concept.aiSummary({ reportName });
      assertEquals(error, undefined);
      assertExists(summary);

      const parsedSummary = JSON.parse(summary);
      assertExists(parsedSummary.highPerformers);
      assertExists(parsedSummary.lowPerformers);
      assertExists(parsedSummary.concerningTrends);
      assertExists(parsedSummary.averagePerformers);
      assertExists(parsedSummary.potentialRecordErrors);
      assertExists(parsedSummary.insights);

      // These assertions depend on the *mocked* AI response.
      assertEquals(parsedSummary.highPerformers, ["MOCK_MOTHER_HIGH"]);
      assertEquals(parsedSummary.lowPerformers, ["MOCK_MOTHER_LOW"]);
      assertEquals(parsedSummary.concerningTrends, ["MOCK_MOTHER_CONCERN"]);
      assertEquals(parsedSummary.averagePerformers.sort(), ["mother1", "mother2"].sort());
      assertEquals(parsedSummary.potentialRecordErrors, ["MOCK_MOTHER_ERROR"]);
      assertExists(parsedSummary.insights);
    });

    await t.step("should return an error if report does not exist", async () => {
      const { summary, error } = await concept.aiSummary({ reportName: "Non Existent AI Report" });
      assertEquals(summary, undefined);
      assertEquals(error, "Report with name 'Non Existent AI Report' not found.");
    });

    await t.step("should return an error if GEMINI_API_KEY is not set", async () => {
      Deno.env.delete("GEMINI_API_KEY");
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

    // 1. a user records birth events by first creating a litter for a mother animal,
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
      birthDate: birthDate2,
      reportedLitterSize: 4,
      notes: "Second litter for principleMother",
    });
    assertExists(litter2);
    assertEquals(litter2.motherId, motherId);
    assertEquals(litter2.reportedLitterSize, 4);

    // Verification that mother was implicitly added (or already existed)
    // Attempting to add the same mother again should yield an error
    const { error: duplicateMotherError } = await concept.addMother({ motherId });
    assertExists(duplicateMotherError);
    assertEquals(duplicateMotherError, "Mother with ID principleMother already exists.");

    // 2. then, individual offspring born to that litter are recorded and linked to it;
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
      offspringIds1.push(offspring!._id);
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
      offspringIds2.push(offspring!._id);
    }

    // Verify offspring counts for each litter using viewOffspringOfLitter
    const { offspring: litter1Offspring } = await concept.viewOffspringOfLitter({ litterId: litter1._id });
    assertEquals(litter1Offspring?.length, 5);
    const { offspring: litter2Offspring } = await concept.viewOffspringOfLitter({ litterId: litter2._id });
    assertEquals(litter2Offspring?.length, 4);


    // 3. later records weaning outcomes for those offspring when the data becomes available;
    // For litter1: 3 weaned, 1 died, 1 no status (still alive, not weaned)
    await concept.recordWeaning({ offspringId: offspringIds1[0] });
    await concept.recordWeaning({ offspringId: offspringIds1[1] });
    await concept.recordWeaning({ offspringId: offspringIds1[2] });
    await concept.recordDeath({ offspringId: offspringIds1[3] }); // Died before weaning

    // For litter2: 3 weaned, 1 died
    await concept.recordWeaning({ offspringId: offspringIds2[0] });
    await concept.recordWeaning({ offspringId: offspringIds2[1] });
    await concept.recordWeaning({ offspringId: offspringIds2[2] });
    await concept.recordDeath({ offspringId: offspringIds2[3] });

    // Verify weaning/death status for a sample offspring using viewOffspringOfLitter
    const { offspring: updatedLitter1Offspring } = await concept.viewOffspringOfLitter({ litterId: litter1._id });
    const o1_0_status = updatedLitter1Offspring?.find(o => o._id === offspringIds1[0]);
    assertExists(o1_0_status);
    assertEquals(o1_0_status.survivedTillWeaning, true);
    assertEquals(o1_0_status.isAlive, true);

    const o1_3_status = updatedLitter1Offspring?.find(o => o._id === offspringIds1[3]);
    assertExists(o1_3_status);
    assertEquals(o1_3_status.survivedTillWeaning, false);
    assertEquals(o1_3_status.isAlive, false); // Died

    const o1_4_status = updatedLitter1Offspring?.find(o => o._id === offspringIds1[4]);
    assertExists(o1_4_status);
    assertEquals(o1_4_status.survivedTillWeaning, false); // Not weaned
    assertEquals(o1_4_status.isAlive, true); // Still alive


    // 4. uses this data to generate reports to evaluate reproductive performance and inform breeding decisions,
    // including litter-specific metrics;
    const reportName = "Principle Trace Report";
    const { report, error: generateReportError } = await concept.generateReport({
      target: [motherId],
      startDateRange: new Date("2023-01-01"),
      endDateRange: new Date("2023-12-31"),
      name: reportName,
    });
    assertEquals(generateReportError, undefined);
    assertExists(report);
    assertEquals(report.reportName, reportName);
    assertEquals(report.target, [motherId]);

    // Expected overall metrics
    // Litters recorded: 2
    // Reported litter size: 6 + 4 = 10
    // Actual offspring born: 5 + 4 = 9
    // Weaned offspring: 3 (from litter1) + 3 (from litter2) = 6
    // Deceased offspring: 1 (from litter1) + 1 (from litter2) = 2
    assertObjectMatch(report.results as unknown as Record<PropertyKey, unknown>, {
      uniqueLittersRecorded: 2,
      totalReportedLitterSize: 10,
      totalActualOffspringBorn: 9,
      totalWeanedOffspring: 6,
      totalDeceasedOffspring: 2,
      averageReportedLitterSize: 5, // 10 / 2
      averageActualOffspringPerLitter: 4.5, // 9 / 2
      survivabilityRateToWeaning: (6 / 9 * 100).toFixed(2) + "%", // ~66.67%
      motherCount: 1,
    } as unknown as Record<PropertyKey, unknown>);

    // Per-mother metrics for principleMother
    const mPerf = report.results.perMotherPerformance.find(p => p.motherId === motherId);
    assertExists(mPerf);
    assertObjectMatch(mPerf as unknown as Record<PropertyKey, unknown>, {
      littersRecorded: 2,
      totalOffspringBorn: 9,
      totalOffspringWeaned: 6,
      totalDeceasedOffspring: 2,
      weaningSurvivabilityRate: (6 / 9 * 100).toFixed(2) + "%", // ~66.67%
      averageActualOffspringPerLitter: 4.5,
    } as unknown as Record<PropertyKey, unknown>);

    // Verify report can be viewed
    const { report: viewedReport, error: viewReportError } = await concept.viewReport({ reportName });
    assertEquals(viewReportError, undefined);
    assertObjectMatch(viewedReport! as unknown as Record<PropertyKey, unknown>, report as unknown as Record<PropertyKey, unknown>);

    // 5. can choose to generate an AI summary of generated reports to aide in understanding and decision making;
    Deno.env.set("GEMINI_API_KEY", "MOCK_API_KEY");
    const { summary: aiSummary, error: aiError } = await concept.aiSummary({ reportName });
    assertEquals(aiError, undefined);
    assertExists(aiSummary);

    const parsedAiSummary = JSON.parse(aiSummary);
    assertExists(parsedAiSummary.insights);
    assertExists(parsedAiSummary.highPerformers);
    // The actual content of these will come from the mock, verifying the action works and returns structured data.
    assertEquals(parsedAiSummary.highPerformers, ["MOCK_MOTHER_HIGH"]);
  });
});
```
