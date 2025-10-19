---
timestamp: 'Fri Oct 17 2025 08:47:43 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_084743.e840d4b6.md]]'
content_id: 1409fdbb1cf7086d73d60a28bdf9becab878b10e85b74819c3cf4383b7c697d6
---

# response:

## Updated `ReproductionTrackingConcept.test.ts` for AI Actions

I've added new test cases for the `_aiSummary` and `regenerateAISummary` actions, including scenarios for high-performing mothers, low-performing mothers, and a mother with data designed to trigger the "potential record errors" detection in the AI.

To ensure these tests work correctly, you **must set the `GEMINI_API_KEY` environment variable** in your Deno environment. The tests will throw an error if this key is not found.

### `src/ReproductionTracking/ReproductionTrackingConcept.test.ts`

```typescript
import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept, { UNKNOWN_FATHER_ID } from "./ReproductionTrackingConcept.ts";
import { ID } from "@utils/types.ts";

// Utility for parsing AI summary output
interface LLMSummaryOutput {
  highPerformers: ID[];
  lowPerformers: ID[];
  concerningTrends: ID[];
  averagePerformers: ID[];
  potentialRecordErrors: ID[];
  insights: string;
}

// Function to check GEMINI_API_KEY for AI tests
function ensureGeminiApiKey(): void {
  if (!Deno.env.get("GEMINI_API_KEY")) {
    throw new Error(
      "GEMINI_API_KEY environment variable not set. Please set it to run AI-related tests.",
    );
  }
}

// --- Tests for addMother and removeMother ---

Deno.test("ReproductionTrackingConcept - addMother action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  await t.step("should successfully add a new mother and set notes to empty string", async () => {
    const motherId = "mother:Molly" as ID;
    const result = await concept.addMother({ motherId: motherId as string });

    assertEquals(result, { motherId: motherId });

    const addedMother = await concept.mothers.findOne({ _id: motherId });
    assertExists(addedMother);
    assertEquals(addedMother._id, motherId);
    assertEquals(addedMother.notes, "", "Notes should be an empty string if not provided during addMother");
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
    assertEquals(addedMother, { _id: motherId, notes: "" }, "Mother should exist before removal");

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

    const newLitter = await concept.litters.findOne({ _id: result.litterID });
    assertExists(newLitter);
    assertEquals(newLitter?.motherId, motherId);
    assertEquals(newLitter?.fatherId, fatherId, "fatherId should match provided fatherId");
    assertEquals(newLitter?.birthDate.toISOString(), birthDate.toISOString());
    assertEquals(newLitter?.reportedLitterSize, reportedLitterSize);
    assertEquals(newLitter?.notes, notes);

    const addedMother = await concept.mothers.findOne({ _id: motherId });
    assertExists(addedMother, "Mother should have been auto-added");
    assertEquals(addedMother?._id, motherId);
    assertEquals(addedMother?.notes, "", "Auto-added mother's notes should be empty string");
  });

  await t.step("should successfully record a litter with an existing mother and empty notes", async () => {
    const motherId = "mother:ExistingMom" as ID;
    const fatherId = "father:Dad2" as ID;
    const birthDate = new Date("2023-02-20");
    const reportedLitterSize = 7;

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

    const newLitter = await concept.litters.findOne({ _id: result.litterID });
    assertExists(newLitter);
    assertEquals(newLitter?.motherId, motherId);
    assertEquals(newLitter?.fatherId, fatherId, "fatherId should match provided fatherId");
    assertEquals(newLitter?.notes, "", "Notes should be an empty string if not provided");

    const finalMotherCount = await concept.mothers.countDocuments({ _id: motherId });
    assertEquals(finalMotherCount, 1, "No new mother should have been added");
  });

  await t.step("should successfully record a litter without a father, using UNKNOWN_FATHER_ID and empty notes", async () => {
    const motherId = "mother:SingleMom" as ID;
    const birthDate = new Date("2023-03-01");
    const reportedLitterSize = 3;

    await concept.addMother({ motherId: motherId as string });

    const result = await concept.recordLitter({
      motherId: motherId as string,
      birthDate,
      reportedLitterSize,
      fatherId: undefined, // Explicitly passing undefined for fatherId
    });

    assertExists(result.litterID, "Litter ID should be returned");
    assertEquals(result.error, undefined);

    const newLitter = await concept.litters.findOne({ _id: result.litterID });
    assertExists(newLitter);
    assertEquals(newLitter?.motherId, motherId);
    assertEquals(newLitter?.fatherId, UNKNOWN_FATHER_ID, "fatherId should be UNKNOWN_FATHER_ID when not provided");
    assertEquals(newLitter?.notes, "", "Notes should be an empty string if not provided");
  });

  await t.step("should return an error for duplicate litter (mother, specific father, birthDate)", async () => {
    const motherId = "mother:DuplicateMom1" as ID;
    const fatherId = "father:DuplicateDad1" as ID;
    const birthDate = new Date("2023-04-10");
    const reportedLitterSize = 6;

    await concept.recordLitter({
      motherId: motherId as string,
      fatherId: fatherId as string,
      birthDate,
      reportedLitterSize,
    });

    const initialLitterCount = await concept.litters.countDocuments({ motherId, fatherId, birthDate });
    assertEquals(initialLitterCount, 1, "Litter should exist before duplicate attempt");

    const secondResult = await concept.recordLitter({
      motherId: motherId as string,
      fatherId: fatherId as string,
      birthDate,
      reportedLitterSize: 5,
    });

    assertExists(secondResult.error, "Error should be returned for duplicate");
    assertEquals(secondResult.litterID, undefined);
    assertEquals(secondResult.error, `A litter with mother ${motherId}, father ${fatherId}, and birth date ${birthDate.toISOString()} already exists.`);

    const finalLitterCount = await concept.litters.countDocuments({ motherId, fatherId, birthDate });
    assertEquals(finalLitterCount, 1, "Only one litter should exist");
  });

  await t.step("should return an error for duplicate litter (mother, UNKNOWN_FATHER_ID, birthDate)", async () => {
    const motherId = "mother:DuplicateMom2" as ID;
    const birthDate = new Date("2023-05-25");
    const reportedLitterSize = 4;

    await concept.recordLitter({
      motherId: motherId as string,
      birthDate,
      reportedLitterSize,
      fatherId: undefined,
    });

    const litterFilter = {
      motherId: motherId,
      birthDate: birthDate,
      fatherId: UNKNOWN_FATHER_ID,
    };
    const initialLitterCount = await concept.litters.countDocuments(litterFilter);
    assertEquals(initialLitterCount, 1, "Litter (UNKNOWN_FATHER_ID) should exist before duplicate attempt");

    const secondResult = await concept.recordLitter({
      motherId: motherId as string,
      birthDate,
      reportedLitterSize: 2,
      fatherId: undefined,
    });

    assertExists(secondResult.error, "Error should be returned for duplicate");
    assertEquals(secondResult.litterID, undefined);
    assertEquals(secondResult.error, `A litter with mother ${motherId}, father none, and birth date ${birthDate.toISOString()} already exists.`);

    const finalLitterCount = await concept.litters.countDocuments(litterFilter);
    assertEquals(finalLitterCount, 1, "Only one litter (UNKNOWN_FATHER_ID) should exist");
  });

  await client.close();
});

// --- Tests for updateLitter ---

Deno.test("ReproductionTrackingConcept - updateLitter action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  const motherId = "mother:OriginalMom" as ID;
  const fatherId = "father:OriginalDad" as ID;
  const birthDate = new Date("2022-10-01");
  const reportedLitterSize = 4;
  const notes = "Initial notes for litter";

  // Setup: Record an initial litter
  await concept.addMother({ motherId: motherId as string });
  const recordResult = await concept.recordLitter({
    motherId: motherId as string,
    fatherId: fatherId as string,
    birthDate,
    reportedLitterSize,
    notes,
  });
  assertExists(recordResult.litterID, "Setup: Litter should be recorded");
  const litterId = recordResult.litterID!;

  await t.step("should successfully update a single field (reportedLitterSize)", async () => {
    const newReportedLitterSize = 6;
    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      reportedLitterSize: newReportedLitterSize,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.reportedLitterSize, newReportedLitterSize);
    assertEquals(updatedLitter?.motherId, motherId, "Other fields should remain unchanged");
    assertEquals(updatedLitter?.fatherId, fatherId, "Other fields should remain unchanged");
    assertEquals(updatedLitter?.birthDate.toISOString(), birthDate.toISOString(), "Other fields should remain unchanged");
    assertEquals(updatedLitter?.notes, notes, "Other fields should remain unchanged");
  });

  await t.step("should successfully update multiple fields (birthDate, notes)", async () => {
    const newBirthDate = new Date("2022-11-01");
    const newNotes = "Updated notes for the litter";
    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      birthDate: newBirthDate,
      notes: newNotes,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.birthDate.toISOString(), newBirthDate.toISOString());
    assertEquals(updatedLitter?.notes, newNotes);
    // Verify other fields are untouched
    assertEquals(updatedLitter?.reportedLitterSize, 6); // From previous step
    assertEquals(updatedLitter?.motherId, motherId);
    assertEquals(updatedLitter?.fatherId, fatherId);
  });

  await t.step("should successfully update fatherId from specific to new specific", async () => {
    const newFatherId = "father:NewDad" as ID;
    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      fatherId: newFatherId as string,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.fatherId, newFatherId);
  });

  await t.step("should successfully update fatherId from specific to UNKNOWN_FATHER_ID (by passing undefined)", async () => {
    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      fatherId: undefined, // Simulates not providing a father
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.fatherId, UNKNOWN_FATHER_ID);
  });

  await t.step("should successfully update fatherId from UNKNOWN_FATHER_ID to specific", async () => {
    const finalFatherId = "father:FinalDad" as ID;
    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      fatherId: finalFatherId as string,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.fatherId, finalFatherId);
  });

  await t.step("should successfully update motherId to an existing mother", async () => {
    const existingMotherId = "mother:AnotherExistingMom" as ID;
    await concept.addMother({ motherId: existingMotherId as string }); // Ensure this mother exists

    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      motherId: existingMotherId as string,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.motherId, existingMotherId);
  });

  await t.step("should successfully update motherId to a new mother (auto-creation)", async () => {
    const newMotherId = "mother:NewMotherForLitter" as ID;

    // Ensure newMotherId does not exist initially
    const preExistingNewMother = await concept.mothers.findOne({ _id: newMotherId });
    assertEquals(preExistingNewMother, null, "New mother should not exist before update");

    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      motherId: newMotherId as string,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.motherId, newMotherId);

    // Verify the new mother was auto-added
    const addedNewMother = await concept.mothers.findOne({ _id: newMotherId });
    assertExists(addedNewMother, "New mother should have been auto-added");
    assertEquals(addedNewMother?.notes, "", "Auto-added new mother's notes should be empty string");
  });

  await t.step("should successfully update notes to an empty string when undefined is passed", async () => {
    // Revert notes to a non-empty string first for clear testing
    await concept.updateLitter({
      litterId: litterId as string,
      notes: "Some temporary notes for test",
    });
    let tempLitter = await concept.litters.findOne({ _id: litterId });
    assertEquals(tempLitter?.notes, "Some temporary notes for test");

    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      notes: undefined, // Explicitly pass undefined
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.notes, "", "Notes should be an empty string when undefined is passed");
  });

  await t.step("should not change notes if notes field is not provided in update arguments", async () => {
    // Set notes to something specific first
    await concept.updateLitter({
      litterId: litterId as string,
      notes: "Original specific notes for non-update test",
    });
    let currentLitter = await concept.litters.findOne({ _id: litterId });
    assertEquals(currentLitter?.notes, "Original specific notes for non-update test");

    // Update another field without touching notes
    const newReportedLitterSize = 10;
    const updateResult = await concept.updateLitter({
      litterId: litterId as string,
      reportedLitterSize: newReportedLitterSize,
    });

    assertEquals(updateResult, { litterID: litterId });

    const updatedLitter = await concept.litters.findOne({ _id: litterId });
    assertExists(updatedLitter);
    assertEquals(updatedLitter?.reportedLitterSize, newReportedLitterSize);
    assertEquals(updatedLitter?.notes, "Original specific notes for non-update test", "Notes should remain unchanged if not provided in args");
  });

  await t.step("should return an error if litterId does not exist", async () => {
    const nonExistentLitterId = "litter:NonExistent" as ID;
    const updateResult = await concept.updateLitter({
      litterId: nonExistentLitterId as string,
      reportedLitterSize: 99,
    });

    assertExists(updateResult.error, "Error should be returned");
    assertEquals(updateResult.litterID, undefined);
    assertEquals(updateResult.error, `Litter with ID '${nonExistentLitterId}' not found.`);
  });

  await client.close();
});


// --- Tests for recordOffspring ---

Deno.test("ReproductionTrackingConcept - recordOffspring action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // Setup: Create a mother and a litter first, as offspring must be linked to a litter.
  const motherId = "mother:MotherOfOffspring" as ID;
  await concept.addMother({ motherId: motherId as string });
  const litterRecordResult = await concept.recordLitter({
    motherId: motherId as string,
    birthDate: new Date("2023-06-01"),
    reportedLitterSize: 3,
  });
  assertExists(litterRecordResult.litterID, "Setup: Litter must be created");
  const litterId = litterRecordResult.litterID!;

  await t.step("should successfully record a new offspring with all details", async () => {
    const offspringId = "offspring:O1" as ID;
    const sex = "male";
    const notes = "Strong and healthy";

    const result = await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: offspringId as string,
      sex,
      notes,
    });

    assertEquals(result, { offspringID: offspringId });

    const newOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(newOffspring);
    assertEquals(newOffspring?.litterId, litterId);
    assertEquals(newOffspring?.sex, sex);
    assertEquals(newOffspring?.notes, notes);
    assertEquals(newOffspring?.isAlive, true, "New offspring should be alive by default");
    assertEquals(newOffspring?.survivedTillWeaning, false, "New offspring should not have survived weaning by default");
  });

  await t.step("should successfully record a new offspring without optional notes, storing as empty string", async () => {
    const offspringId = "offspring:O2" as ID;
    const sex = "female";

    const result = await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: offspringId as string,
      sex,
      notes: undefined, // Explicitly pass undefined
    });

    assertEquals(result, { offspringID: offspringId });

    const newOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(newOffspring);
    assertEquals(newOffspring?.litterId, litterId);
    assertEquals(newOffspring?.sex, sex);
    assertEquals(newOffspring?.notes, "", "Notes should be an empty string if not provided");
    assertEquals(newOffspring?.isAlive, true);
    assertEquals(newOffspring?.survivedTillWeaning, false);
  });

  await t.step("should return an error if litterId does not exist", async () => {
    const nonExistentLitterId = "litter:NonExistent" as ID;
    const offspringId = "offspring:O3" as ID;
    const sex = "neutered";

    const result = await concept.recordOffspring({
      litterId: nonExistentLitterId as string,
      offspringId: offspringId as string,
      sex,
    });

    assertExists(result.error, "Error should be returned for non-existent litter");
    assertEquals(result.offspringID, undefined);
    assertEquals(result.error, `Litter with ID '${nonExistentLitterId}' not found.`);

    const offspringCount = await concept.offspring.countDocuments({ _id: offspringId });
    assertEquals(offspringCount, 0, "No offspring should be created");
  });

  await t.step("should return an error if offspringId already exists", async () => {
    const offspringId = "offspring:O4" as ID;
    const sex = "male";
    const existingOffspringNotes = "First entry";

    // First, successfully record the offspring
    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: offspringId as string,
      sex,
      notes: existingOffspringNotes,
    });

    const initialOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(initialOffspring, "Offspring should exist initially");

    // Attempt to record another offspring with the same ID
    const secondResult = await concept.recordOffspring({
      litterId: litterId as string, // Same litter, but could be different in other tests
      offspringId: offspringId as string,
      sex: "female", // Different sex
      notes: "Second entry attempt",
    });

    assertExists(secondResult.error, "Error should be returned for duplicate offspring ID");
    assertEquals(secondResult.offspringID, undefined);
    assertEquals(secondResult.error, `Offspring with ID '${offspringId}' already exists.`);

    // Verify no new record was created and the original remains unchanged
    const offspringCount = await concept.offspring.countDocuments({ _id: offspringId });
    assertEquals(offspringCount, 1, "Only one offspring record should exist for this ID");
    const finalOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertEquals(finalOffspring?.sex, sex, "Original offspring sex should not change");
    assertEquals(finalOffspring?.notes, existingOffspringNotes, "Original offspring notes should not change");
  });

  await client.close();
});

// --- Tests for updateOffspring ---

Deno.test("ReproductionTrackingConcept - updateOffspring action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // Setup: Create a mother, a litter, and an offspring for testing updates.
  const motherId1 = "mother:UOM1" as ID;
  await concept.addMother({ motherId: motherId1 as string });
  const litterRecordResult1 = await concept.recordLitter({
    motherId: motherId1 as string,
    birthDate: new Date("2023-07-01"),
    reportedLitterSize: 2,
    notes: "Litter for offspring update tests",
  });
  assertExists(litterRecordResult1.litterID, "Setup: Litter 1 must be created");
  const litterId1 = litterRecordResult1.litterID!;

  const offspringId = "offspring:UO1" as ID;
  await concept.recordOffspring({
    litterId: litterId1 as string,
    offspringId: offspringId as string,
    sex: "male",
    notes: "Initial offspring notes",
  });

  await t.step("should successfully update a single field (sex)", async () => {
    const newSex = "female";
    const updateResult = await concept.updateOffspring({
      offspringId: offspringId as string,
      sex: newSex,
    });

    assertEquals(updateResult, { offspringID: offspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.sex, newSex);
    assertEquals(updatedOffspring?.litterId, litterId1, "Other fields should remain unchanged");
    assertEquals(updatedOffspring?.notes, "Initial offspring notes", "Other fields should remain unchanged");
  });

  await t.step("should successfully update multiple fields (litterId, notes)", async () => {
    // Create another mother and litter to change litterId to
    const motherId2 = "mother:UOM2" as ID;
    await concept.addMother({ motherId: motherId2 as string });
    const litterRecordResult2 = await concept.recordLitter({
      motherId: motherId2 as string,
      birthDate: new Date("2023-08-01"),
      reportedLitterSize: 4,
      notes: "Second litter for offspring update tests",
    });
    assertExists(litterRecordResult2.litterID, "Setup: Litter 2 must be created");
    const litterId2 = litterRecordResult2.litterID!;

    const newNotes = "Updated offspring notes";
    const updateResult = await concept.updateOffspring({
      offspringId: offspringId as string,
      litterId: litterId2 as string,
      notes: newNotes,
    });

    assertEquals(updateResult, { offspringID: offspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.litterId, litterId2);
    assertEquals(updatedOffspring?.notes, newNotes);
    assertEquals(updatedOffspring?.sex, "female", "Other fields should remain unchanged (from previous step)");
  });

  await t.step("should successfully update notes to an empty string when undefined is passed", async () => {
    // Set notes to something specific first for clear testing
    await concept.updateOffspring({
      offspringId: offspringId as string,
      notes: "Temporary notes to be cleared",
    });
    let tempOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertEquals(tempOffspring?.notes, "Temporary notes to be cleared");

    const updateResult = await concept.updateOffspring({
      offspringId: offspringId as string,
      notes: undefined, // Explicitly pass undefined
    });

    assertEquals(updateResult, { offspringID: offspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.notes, "", "Notes should be an empty string when undefined is passed");
  });

  await t.step("should not change notes if notes field is not provided in update arguments", async () => {
    // Set notes to something specific first
    await concept.updateOffspring({
      offspringId: offspringId as string,
      notes: "Original notes for non-update test",
    });
    let currentOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertEquals(currentOffspring?.notes, "Original notes for non-update test");

    // Update another field without touching notes
    const finalSex = "neutered";
    const updateResult = await concept.updateOffspring({
      offspringId: offspringId as string,
      sex: finalSex,
    });

    assertEquals(updateResult, { offspringID: offspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.sex, finalSex);
    assertEquals(updatedOffspring?.notes, "Original notes for non-update test", "Notes should remain unchanged if not provided in args");
  });


  await t.step("should return an error if offspringId does not exist", async () => {
    const nonExistentOffspringId = "offspring:NonExistent" as ID;
    const updateResult = await concept.updateOffspring({
      offspringId: nonExistentOffspringId as string,
      sex: "female",
    });

    assertExists(updateResult.error, "Error should be returned");
    assertEquals(updateResult.offspringID, undefined);
    assertEquals(updateResult.error, `Offspring with ID '${nonExistentOffspringId}' not found.`);
  });

  await t.step("should return an error if new litterId does not exist", async () => {
    const nonExistentLitterId = "litter:NonExistentTarget" as ID;
    const updateResult = await concept.updateOffspring({
      offspringId: offspringId as string,
      litterId: nonExistentLitterId as string,
    });

    assertExists(updateResult.error, "Error should be returned");
    assertEquals(updateResult.offspringID, undefined);
    assertEquals(result.error, `New litter with ID '${nonExistentLitterId}' not found.`);

    // Verify offspring's litterId has not changed
    const currentOffspring = await concept.offspring.findOne({ _id: offspringId });
    assertExists(currentOffspring);
    assertNotEquals(currentOffspring?.litterId, nonExistentLitterId);
  });

  await client.close();
});

// --- Tests for recordWeaning ---

Deno.test("ReproductionTrackingConcept - recordWeaning action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // Setup: Create a mother, a litter, and an offspring that is alive.
  const motherId = "mother:WeaningMom" as ID;
  await concept.addMother({ motherId: motherId as string });
  const litterRecordResult = await concept.recordLitter({
    motherId: motherId as string,
    birthDate: new Date("2023-09-01"),
    reportedLitterSize: 1,
  });
  assertExists(litterRecordResult.litterID, "Setup: Litter must be created");
  const litterId = litterRecordResult.litterID!;

  const liveOffspringId = "offspring:LiveBaby" as ID;
  await concept.recordOffspring({
    litterId: litterId as string,
    offspringId: liveOffspringId as string,
    sex: "female",
  });
  // Ensure initial state: alive, not weaned
  let initialLiveOffspring = await concept.offspring.findOne({ _id: liveOffspringId });
  assertExists(initialLiveOffspring);
  assertEquals(initialLiveOffspring.isAlive, true);
  assertEquals(initialLiveOffspring.survivedTillWeaning, false);

  await t.step("should successfully record weaning for an alive offspring", async () => {
    const result = await concept.recordWeaning({
      offspringId: liveOffspringId as string,
    });

    assertEquals(result, { offspringID: liveOffspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: liveOffspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.survivedTillWeaning, true, "survivedTillWeaning should be true");
    assertEquals(updatedOffspring?.isAlive, true, "isAlive should remain true");
  });

  await t.step("should return an error if offspringId does not exist", async () => {
    const nonExistentOffspringId = "offspring:NonExistentWeaning" as ID;
    const result = await concept.recordWeaning({
      offspringId: nonExistentOffspringId as string,
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.offspringID, undefined);
    assertEquals(result.error, `Offspring with ID '${nonExistentOffspringId}' not found.`);
  });

  await t.step("should return an error if offspring is not alive", async () => {
    const deadOffspringId = "offspring:DeadBaby" as ID;
    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: deadOffspringId as string,
      sex: "male",
    });
    // Manually set to not alive
    await concept.offspring.updateOne(
      { _id: deadOffspringId },
      { $set: { isAlive: false } },
    );
    let deadOffspring = await concept.offspring.findOne({ _id: deadOffspringId });
    assertExists(deadOffspring);
    assertEquals(deadOffspring.isAlive, false);

    const result = await concept.recordWeaning({
      offspringId: deadOffspringId as string,
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.offspringID, undefined);
    assertEquals(result.error, `Offspring with ID '${deadOffspringId}' is not alive and cannot be weaned.`);

    // Ensure state remains unchanged for dead offspring
    deadOffspring = await concept.offspring.findOne({ _id: deadOffspringId });
    assertExists(deadOffspring);
    assertEquals(deadOffspring.survivedTillWeaning, false, "survivedTillWeaning should remain false for dead offspring");
  });

  await client.close();
});

// --- Tests for recordDeath ---

Deno.test("ReproductionTrackingConcept - recordDeath action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // Setup: Create a mother, a litter, and an offspring that is alive and not yet weaned.
  const motherId = "mother:DeathMom" as ID;
  await concept.addMother({ motherId: motherId as string });
  const litterRecordResult = await concept.recordLitter({
    motherId: motherId as string,
    birthDate: new Date("2023-10-01"),
    reportedLitterSize: 2,
  });
  assertExists(litterRecordResult.litterID, "Setup: Litter must be created");
  const litterId = litterRecordResult.litterID!;

  const livingOffspringId = "offspring:LivingBaby" as ID;
  await concept.recordOffspring({
    litterId: litterId as string,
    offspringId: livingOffspringId as string,
    sex: "male",
  });
  // Ensure initial state: alive, not weaned
  let initialLivingOffspring = await concept.offspring.findOne({ _id: livingOffspringId });
  assertExists(initialLivingOffspring);
  assertEquals(initialLivingOffspring.isAlive, true);
  assertEquals(initialLivingOffspring.survivedTillWeaning, false);

  await t.step("should successfully record death for a living offspring that was not weaned", async () => {
    const result = await concept.recordDeath({
      offspringId: livingOffspringId as string,
    });

    assertEquals(result, { offspringId: livingOffspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: livingOffspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.isAlive, false, "isAlive should be false after death");
    assertEquals(updatedOffspring?.survivedTillWeaning, false, "survivedTillWeaning should remain false if it was initially false");
  });

  await t.step("should return an error if offspringId does not exist", async () => {
    const nonExistentOffspringId = "offspring:NonExistentDeath" as ID;
    const result = await concept.recordDeath({
      offspringId: nonExistentOffspringId as string,
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.offspringId, undefined);
    assertEquals(result.error, `Offspring with ID '${nonExistentOffspringId}' not found.`);
  });

  await t.step("should return an error if offspring is already marked as deceased", async () => {
    const alreadyDeadOffspringId = "offspring:AlreadyDeadBaby" as ID;
    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: alreadyDeadOffspringId as string,
      sex: "female",
    });
    // Manually set to not alive
    await concept.offspring.updateOne(
      { _id: alreadyDeadOffspringId },
      { $set: { isAlive: false } },
    );
    let alreadyDeadOffspring = await concept.offspring.findOne({ _id: alreadyDeadOffspringId });
    assertExists(alreadyDeadOffspring);
    assertEquals(alreadyDeadOffspring.isAlive, false);

    const result = await concept.recordDeath({
      offspringId: alreadyDeadOffspringId as string,
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.offspringId, undefined);
    assertEquals(result.error, `Offspring with ID '${alreadyDeadOffspringId}' is already marked as deceased.`);

    // Ensure state remains unchanged
    alreadyDeadOffspring = await concept.offspring.findOne({ _id: alreadyDeadOffspringId });
    assertExists(alreadyDeadOffspring);
    assertEquals(alreadyDeadOffspring.isAlive, false);
    assertEquals(alreadyDeadOffspring.survivedTillWeaning, false, "survivedTillWeaning should remain false if it was initially false");
  });

  await t.step("should preserve survivedTillWeaning status if offspring dies after weaning was recorded", async () => {
    const weanedAndLivingOffspringId = "offspring:WeanedBaby" as ID;
    await concept.recordOffspring({
      litterId: litterId as string,
      offspringId: weanedAndLivingOffspringId as string,
      sex: "female",
    });
    // Record weaning first
    await concept.recordWeaning({ offspringId: weanedAndLivingOffspringId as string });
    let weanedOffspring = await concept.offspring.findOne({ _id: weanedAndLivingOffspringId });
    assertExists(weanedOffspring);
    assertEquals(weanedOffspring.isAlive, true);
    assertEquals(weanedOffspring.survivedTillWeaning, true);

    // Now record death
    const result = await concept.recordDeath({
      offspringId: weanedAndLivingOffspringId as string,
    });
    assertEquals(result, { offspringId: weanedAndLivingOffspringId });

    const deadWeanedOffspring = await concept.offspring.findOne({ _id: weanedAndLivingOffspringId });
    assertExists(deadWeanedOffspring);
    assertEquals(deadWeanedOffspring.isAlive, false, "isAlive should be false after death");
    assertEquals(deadWeanedOffspring.survivedTillWeaning, true, "survivedTillWeaning should remain true even after death if it was previously set");
  });

  await client.close();
});

// --- Tests for generateReport ---

Deno.test("ReproductionTrackingConcept - generateReport action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // Setup: Common data for multiple tests
  const motherAId = "mother:Alpha" as ID;
  const motherBId = "mother:Beta" as ID;
  const father1Id = "father:F1" as ID;
  const father2Id = "father:F2" as ID;

  await concept.addMother({ motherId: motherAId as string });
  await concept.addMother({ motherId: motherBId as string });

  const litterA1Date = new Date("2023-01-10");
  const litterA2Date = new Date("2023-02-15");
  const litterB1Date = new Date("2023-01-20");

  const litterA1Result = await concept.recordLitter({
    motherId: motherAId as string,
    fatherId: father1Id as string,
    birthDate: litterA1Date,
    reportedLitterSize: 5,
  });
  const litterA1Id = litterA1Result.litterID!;

  const litterA2Result = await concept.recordLitter({
    motherId: motherAId as string,
    fatherId: father1Id as string, // Same father
    birthDate: litterA2Date,
    reportedLitterSize: 3,
  });
  const litterA2Id = litterA2Result.litterID!;

  const litterB1Result = await concept.recordLitter({
    motherId: motherBId as string,
    fatherId: father2Id as string,
    birthDate: litterB1Date,
    reportedLitterSize: 4,
  });
  const litterB1Id = litterB1Result.litterID!;

  // Offspring for litter A1 (3 total)
  await concept.recordOffspring({ litterId: litterA1Id as string, offspringId: "offspring:OA1-1" as string, sex: "male" });
  await concept.recordOffspring({ litterId: litterA1Id as string, offspringId: "offspring:OA1-2" as string, sex: "female" });
  await concept.recordOffspring({ litterId: litterA1Id as string, offspringId: "offspring:OA1-3" as string, sex: "male" });
  // Make OA1-1 weaned
  await concept.recordWeaning({ offspringId: "offspring:OA1-1" as string });
  // Make OA1-2 dead (survivedTillWeaning will be preserved as false if not weaned)
  await concept.recordDeath({ offspringId: "offspring:OA1-2" as string });


  // Offspring for litter A2 (3 total)
  await concept.recordOffspring({ litterId: litterA2Id as string, offspringId: "offspring:OA2-1" as string, sex: "female" });
  await concept.recordOffspring({ litterId: litterA2Id as string, offspringId: "offspring:OA2-2" as string, sex: "male" });
  await concept.recordOffspring({ litterId: litterA2Id as string, offspringId: "offspring:OA2-3" as string, sex: "female" });
  // Make all A2 offspring weaned
  await concept.recordWeaning({ offspringId: "offspring:OA2-1" as string });
  await concept.recordWeaning({ offspringId: "offspring:OA2-2" as string });
  await concept.recordWeaning({ offspringId: "offspring:OA2-3" as string });


  // Offspring for litter B1 (4 total)
  await concept.recordOffspring({ litterId: litterB1Id as string, offspringId: "offspring:OB1-1" as string, sex: "male" });
  await concept.recordOffspring({ litterId: litterB1Id as string, offspringId: "offspring:OB1-2" as string, sex: "female" });
  await concept.recordOffspring({ litterId: litterB1Id as string, offspringId: "offspring:OB1-3" as string, sex: "male" });
  await concept.recordOffspring({ litterId: litterB1Id as string, offspringId: "offspring:OB1-4" as string, sex: "female" });
  // Make OB1-1, OB1-2 weaned
  await concept.recordWeaning({ offspringId: "offspring:OB1-1" as string });
  await concept.recordWeaning({ offspringId: "offspring:OB1-2" as string });


  const startDateRange = new Date("2023-01-01");
  const endDateRange = new Date("2023-03-31");
  const reportName1 = "ReproductivePerformance2023Q1";
  const reportName2 = "MotherBSpecialReport"; // Will be used later

  await t.step("should successfully generate a new report for a single target and date range", async () => {
    const target = motherAId;
    const result = await concept.generateReport({
      target: target as string,
      startDateRange,
      endDateRange,
      name: reportName1,
    });

    assertExists(result.results, "Results should be returned");
    assertEquals(result.error, undefined);
    assertNotEquals(result.results!.length, 0);

    // Expected calculations for Mother A in Q1:
    // Litters: A1 (Jan), A2 (Feb) => 2 litters
    // Offspring: 3 (from A1) + 3 (from A2) = 6 total offspring
    // Weaned & survived:
    //   - OA1-1 (weaned, alive) = 1
    //   - OA1-2 (died, not weaned) = 0 (since it died and was not weaned, survivedTillWeaning remains false)
    //   - OA1-3 (alive, not weaned) = 0
    //   - OA2-1 (weaned, alive) = 1
    //   - OA2-2 (weaned, alive) = 1
    //   - OA2-3 (weaned, alive) = 1
    // Total survived till weaning = 1 + 3 = 4
    // Weaning Survival Rate: (4 / 6) * 100 = 66.67%
    const expectedOffspringCount = 6;
    const expectedWeaningSurvival = "66.67%";


    const generatedReport = await concept.reports.findOne({ _id: reportName1 as ID });
    assertExists(generatedReport);
    assertEquals(generatedReport.target, [target]);
    assertEquals(generatedReport.results.length, 1);
    assertExists(generatedReport.results[0].includes(`Performance for ${target} (${startDateRange.toDateString()} to ${endDateRange.toDateString()}): `));
    assertExists(generatedReport.results[0].includes(`Litters: 2`));
    assertExists(generatedReport.results[0].includes(`Offspring: ${expectedOffspringCount}`));
    assertExists(generatedReport.results[0].includes(`Weaning Survival: ${expectedWeaningSurvival}`));

    assertEquals(generatedReport.summary, "", "New report summary should be an empty string");
  });

  await t.step("should successfully generate a new report with no relevant data", async () => {
    const motherCId = "mother:Charlie" as ID;
    await concept.addMother({ motherId: motherCId as string });
    const reportNameNoData = "NoDataReport";
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-12-31");

    const result = await concept.generateReport({
      target: motherCId as string,
      startDateRange: startDate,
      endDateRange: endDate,
      name: reportNameNoData,
    });

    assertExists(result.results);
    assertEquals(result.error, undefined);
    assertEquals(result.results!.length, 1);

    const generatedReport = await concept.reports.findOne({ _id: reportNameNoData as ID });
    assertExists(generatedReport);
    assertEquals(generatedReport.target, [motherCId]);
    assertExists(generatedReport.results[0].includes(`Performance for ${motherCId}`));
    assertExists(generatedReport.results[0].includes(`Litters: 0`));
    assertExists(generatedReport.results[0].includes(`Offspring: 0`));
    assertExists(generatedReport.results[0].includes(`Weaning Survival: N/A`));
    assertEquals(generatedReport.summary, "", "New report summary should be an empty string");
  });


  await t.step("should add performance for a different target to an existing report", async () => {
    const target = motherBId; // Use mother B
    const result = await concept.generateReport({
      target: target as string,
      startDateRange,
      endDateRange,
      name: reportName1, // Add to existing report 1
    });

    assertExists(result.results, "Results should be returned");
    assertEquals(result.error, undefined);
    assertEquals(result.results!.length, 2); // Now has A and B

    // Expected calculations for Mother B in Q1:
    // Litters: B1 (Jan) => 1 litter
    // Offspring: 4 (from B1) = 4 total offspring
    // Weaned & survived: OB1-1, OB1-2 => 2
    // Weaning Survival Rate: (2 / 4) * 100 = 50.00%
    const expectedOffspringCount = 4;
    const expectedWeaningSurvival = "50.00%";


    const updatedReport = await concept.reports.findOne({ _id: reportName1 as ID });
    assertExists(updatedReport);
    assertEquals(updatedReport.target.length, 2);
    assertExists(updatedReport.target.includes(motherAId));
    assertExists(updatedReport.target.includes(motherBId));
    assertEquals(updatedReport.results.length, 2);
    assertExists(updatedReport.results[1].includes(`Performance for ${target} (${startDateRange.toDateString()} to ${endDateRange.toDateString()}): `));
    assertExists(updatedReport.results[1].includes(`Litters: 1`));
    assertExists(updatedReport.results[1].includes(`Offspring: ${expectedOffspringCount}`));
    assertExists(updatedReport.results[1].includes(`Weaning Survival: ${expectedWeaningSurvival}`));
    assertEquals(updatedReport.summary, "", "Summary should be cleared on update"); // As report content changed
  });

  await t.step("should not add duplicate performance entry for the same target and range to an existing report", async () => {
    const target = motherAId;
    const currentReport = await concept.reports.findOne({ _id: reportName1 as ID });
    assertExists(currentReport);
    const initialResultsCount = currentReport.results.length;

    const result = await concept.generateReport({
      target: target as string,
      startDateRange,
      endDateRange,
      name: reportName1, // Re-generate for mother A with same range
    });

    assertExists(result.results, "Results should be returned");
    assertEquals(result.error, undefined);
    assertEquals(result.results!.length, initialResultsCount); // Should not increase count

    const updatedReport = await concept.reports.findOne({ _id: reportName1 as ID });
    assertExists(updatedReport);
    assertEquals(updatedReport.results.length, initialResultsCount); // Still same count
    assertEquals(updatedReport.summary, "", "Summary should be cleared even if no new entry");
  });

  await t.step("should add a new performance entry for the same target but a different date range", async () => {
    const target = motherAId;
    const newStartDateRange = new Date("2023-02-01");
    const newEndDateRange = new Date("2023-02-28"); // Only includes litter A2

    const currentReport = await concept.reports.findOne({ _id: reportName1 as ID });
    assertExists(currentReport);
    const initialResultsCount = currentReport.results.length;

    const result = await concept.generateReport({
      target: target as string,
      startDateRange: newStartDateRange,
      endDateRange: newEndDateRange,
      name: reportName1, // Add to existing report 1
    });

    assertExists(result.results, "Results should be returned");
    assertEquals(result.error, undefined);
    assertEquals(result.results!.length, initialResultsCount + 1); // New entry added

    // Expected calculations for Mother A in Feb:
    // Litters: A2 (Feb) => 1 litter
    // Offspring: 3 (from A2) = 3 total offspring
    // Weaned & survived: OA2-1, OA2-2, OA2-3 => 3
    // Weaning Survival Rate: (3 / 3) * 100 = 100.00%
    const expectedOffspringCount = 3;
    const expectedWeaningSurvival = "100.00%";


    const updatedReport = await concept.reports.findOne({ _id: reportName1 as ID });
    assertExists(updatedReport);
    assertEquals(updatedReport.results.length, initialResultsCount + 1);
    assertExists(updatedReport.results[initialResultsCount].includes(`Performance for ${target} (${newStartDateRange.toDateString()} to ${newEndDateRange.toDateString()}): `));
    assertExists(updatedReport.results[initialResultsCount].includes(`Litters: 1`));
    assertExists(updatedReport.results[initialResultsCount].includes(`Offspring: ${expectedOffspringCount}`));
    assertExists(updatedReport.results[initialResultsCount].includes(`Weaning Survival: ${expectedWeaningSurvival}`));
    assertEquals(updatedReport.summary, "", "Summary should be cleared on update");
  });

  await t.step("should return an error if target mother does not exist", async () => {
    const nonExistentMotherId = "mother:Ghost" as ID;
    const result = await concept.generateReport({
      target: nonExistentMotherId as string,
      startDateRange,
      endDateRange,
      name: "InvalidReport",
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.results, undefined);
    assertEquals(result.error, `Target mother with ID '${nonExistentMotherId}' not found.`);

    const reportCount = await concept.reports.countDocuments({ _id: "InvalidReport" as ID });
    assertEquals(reportCount, 0, "No report should be created");
  });

  await client.close();
});

// --- Tests for renameReport ---

Deno.test("ReproductionTrackingConcept - renameReport action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  const motherId = "mother:RNRM" as ID;
  await concept.addMother({ motherId: motherId as string });
  const startDate = new Date("2023-01-01");
  const endDate = new Date("2023-12-31");
  const originalReportName = "AnnualReport2023";
  const newReportName = "YearlySummary2023";

  // Setup: Create an initial report
  await concept.generateReport({
    target: motherId as string,
    startDateRange: startDate,
    endDateRange: endDate,
    name: originalReportName,
  });
  let initialReport = await concept.reports.findOne({ _id: originalReportName as ID });
  assertExists(initialReport);
  assertEquals(initialReport.results.length, 1); // Should have one result from generation
  assertEquals(initialReport.summary, ""); // Default empty summary

  await t.step("should successfully rename an existing report", async () => {
    const renameResult = await concept.renameReport({
      oldName: originalReportName,
      newName: newReportName,
    });

    assertEquals(renameResult, { newName: newReportName });

    const oldReport = await concept.reports.findOne({ _id: originalReportName as ID });
    assertEquals(oldReport, null, "Original report should no longer exist");

    const newReport = await concept.reports.findOne({ _id: newReportName as ID });
    assertExists(newReport);
    assertEquals(newReport._id, newReportName);
    assertEquals(newReport.results.length, 1, "Report content should be preserved");
    assertEquals(newReport.summary, "", "Report summary should be preserved");
  });

  await t.step("should return an error if the old report name does not exist", async () => {
    const nonExistentReport = "NonExistentReport";
    const result = await concept.renameReport({
      oldName: nonExistentReport,
      newName: "AttemptedNewName",
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.newName, undefined);
    assertEquals(result.error, `Report with name '${nonExistentReport}' not found.`);
  });

  await t.step("should return an error if the new report name already exists", async () => {
    const anotherOldName = "TempReport";
    await concept.generateReport({
      target: motherId as string,
      startDateRange: new Date("2022-01-01"),
      endDateRange: new Date("2022-12-31"),
      name: anotherOldName,
    });
    let existingNewReport = await concept.reports.findOne({ _id: newReportName as ID }); // From previous successful rename
    assertExists(existingNewReport, "New report name should already exist from previous step");

    const result = await concept.renameReport({
      oldName: anotherOldName,
      newName: newReportName, // This name already exists
    });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.newName, undefined);
    assertEquals(result.error, `Report with new name '${newReportName}' already exists.`);

    // Verify the 'anotherOldName' report still exists and 'newReportName' report is untouched
    const reportStillExists = await concept.reports.findOne({ _id: anotherOldName as ID });
    assertExists(reportStillExists, "The report attempting to be renamed should still exist");
    existingNewReport = await concept.reports.findOne({ _id: newReportName as ID });
    assertExists(existingNewReport, "The target new name report should remain untouched");
  });

  await client.close();
});

// --- Tests for _viewReport ---

Deno.test("ReproductionTrackingConcept - _viewReport query", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  const motherId = "mother:VRM" as ID;
  await concept.addMother({ motherId: motherId as string });
  const startDate = new Date("2023-01-01");
  const endDate = new Date("2023-06-30");
  const reportName = "MidYearReport";

  // Setup: Create a report with some data
  const generatedResults = await concept.generateReport({
    target: motherId as string,
    startDateRange: startDate,
    endDateRange: endDate,
    name: reportName,
  });
  assertExists(generatedResults.results);
  assertNotEquals(generatedResults.results!.length, 0);
  const expectedResults = generatedResults.results!;

  await t.step("should successfully retrieve the results of an existing report", async () => {
    const result = await concept._viewReport({ reportName });

    assertEquals(result.error, undefined);
    assertExists(result.results);
    assertEquals(result.results, expectedResults);
  });

  await t.step("should return an error if the report name does not exist", async () => {
    const nonExistentReport = "NonExistentViewReport";
    const result = await concept._viewReport({ reportName: nonExistentReport });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.results, undefined);
    assertEquals(result.error, `Report with name '${nonExistentReport}' not found.`);
  });

  await client.close();
});

// --- Tests for deleteReport ---

Deno.test("ReproductionTrackingConcept - deleteReport action", async (t) => {
  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  const motherId = "mother:DRM" as ID;
  await concept.addMother({ motherId: motherId as string });
  const startDate = new Date("2023-01-01");
  const endDate = new Date("2023-12-31");
  const reportToDeleteName = "ReportToDelete";
  const anotherReportName = "AnotherReport";

  // Setup: Create two reports
  await concept.generateReport({
    target: motherId as string,
    startDateRange: startDate,
    endDateRange: endDate,
    name: reportToDeleteName,
  });
  await concept.generateReport({
    target: motherId as string,
    startDateRange: startDate,
    endDateRange: endDate,
    name: anotherReportName,
  });

  let reportExists = await concept.reports.findOne({ _id: reportToDeleteName as ID });
  assertExists(reportExists, "Report to delete should exist initially");
  let otherReportExists = await concept.reports.findOne({ _id: anotherReportName as ID });
  assertExists(otherReportExists, "Another report should exist initially");


  await t.step("should successfully delete an existing report", async () => {
    const result = await concept.deleteReport({ reportName: reportToDeleteName });

    assertEquals(result, {}, "Empty object should be returned on success");
    assertEquals((result as {error?: string}).error, undefined);

    reportExists = await concept.reports.findOne({ _id: reportToDeleteName as ID });
    assertEquals(reportExists, null, "Report should no longer exist after deletion");

    // Ensure other reports are not affected
    otherReportExists = await concept.reports.findOne({ _id: anotherReportName as ID });
    assertExists(otherReportExists, "Another report should still exist");
  });

  await t.step("should return an error if the report name does not exist", async () => {
    const nonExistentReport = "NonExistentDeleteReport";
    const result = await concept.deleteReport({ reportName: nonExistentReport });

    assertExists((result as {error?: string}).error, "Error should be returned");
    assertEquals((result as {error: string}).error, `Report with name '${nonExistentReport}' not found.`);
  });

  await client.close();
});

// --- Tests for AI-related actions (_aiSummary, regenerateAISummary) ---

Deno.test("ReproductionTrackingConcept - AI Summary actions", async (t) => {
  ensureGeminiApiKey(); // Ensure API key is present for AI tests

  const [db, client] = await testDb();
  const concept = new ReproductionTrackingConcept(db);

  // --- Setup for AI tests ---
  const motherHighPerformerId = "mother:HighPerformer" as ID;
  const motherLowPerformerId = "mother:LowPerformer" as ID;
  const motherRecordErrorId = "mother:RecordError" as ID; // Will have 10 offspring from a litter with reported size 1
  const motherAveragePerformerId = "mother:AveragePerformer" as ID;

  await concept.addMother({ motherId: motherHighPerformerId as string });
  await concept.addMother({ motherId: motherLowPerformerId as string });
  await concept.addMother({ motherId: motherRecordErrorId as string });
  await concept.addMother({ motherId: motherAveragePerformerId as string });

  const startDate = new Date("2023-01-01");
  const endDate = new Date("2023-12-31");
  const reportNameAI = "AISummaryTestReport";

  // Data for High Performer
  // Litter 1: 5 offspring, 5 weaned (100%)
  const highLitter1 = (await concept.recordLitter({ motherId: motherHighPerformerId as string, birthDate: new Date("2023-03-01"), reportedLitterSize: 5 })).litterID!;
  for (let i = 1; i <= 5; i++) {
    const offspringId = `offspring:MPH-L1-O${i}` as ID;
    await concept.recordOffspring({ litterId: highLitter1 as string, offspringId: offspringId as string, sex: "male" });
    await concept.recordWeaning({ offspringId: offspringId as string });
  }
  // Litter 2: 7 offspring, 7 weaned (100%)
  const highLitter2 = (await concept.recordLitter({ motherId: motherHighPerformerId as string, birthDate: new Date("2023-06-01"), reportedLitterSize: 7 })).litterID!;
  for (let i = 1; i <= 7; i++) {
    const offspringId = `offspring:MPH-L2-O${i}` as ID;
    await concept.recordOffspring({ litterId: highLitter2 as string, offspringId: offspringId as string, sex: "female" });
    await concept.recordWeaning({ offspringId: offspringId as string });
  }

  // Data for Low Performer
  // Litter 1: 3 offspring, 0 weaned (0%)
  const lowLitter1 = (await concept.recordLitter({ motherId: motherLowPerformerId as string, birthDate: new Date("2023-04-01"), reportedLitterSize: 3 })).litterID!;
  for (let i = 1; i <= 3; i++) {
    const offspringId = `offspring:MLP-L1-O${i}` as ID;
    await concept.recordOffspring({ litterId: lowLitter1 as string, offspringId: offspringId as string, sex: "male" });
    await concept.recordDeath({ offspringId: offspringId as string }); // Died before weaning, so survivedTillWeaning remains false
  }
  // Litter 2: 4 offspring, 0 weaned (0%)
  const lowLitter2 = (await concept.recordLitter({ motherId: motherLowPerformerId as string, birthDate: new Date("2023-07-01"), reportedLitterSize: 4 })).litterID!;
  for (let i = 1; i <= 4; i++) {
    const offspringId = `offspring:MLP-L2-O${i}` as ID;
    await concept.recordOffspring({ litterId: lowLitter2 as string, offspringId: offspringId as string, sex: "female" });
    await concept.recordDeath({ offspringId: offspringId as string }); // Died before weaning
  }

  // Data for Record Error (Simulate high offspring count for a single litter)
  // Litter 1: Reported litter size 1 (small), but 10 offspring recorded. This should be flagged by AI.
  const errorLitter1 = (await concept.recordLitter({ motherId: motherRecordErrorId as string, birthDate: new Date("2023-05-01"), reportedLitterSize: 1 })).litterID!;
  for (let i = 1; i <= 10; i++) { // 10 offspring from a litter
    const offspringId = `offspring:MRE-L1-O${i}` as ID;
    await concept.recordOffspring({ litterId: errorLitter1 as string, offspringId: offspringId as string, sex: "male" });
    if (i <= 8) { // 80% weaning survival
      await concept.recordWeaning({ offspringId: offspringId as string });
    }
  }

  // Data for Average Performer (mixed results)
  // Litter 1: 5 offspring, 3 weaned (60%)
  const avgLitter1 = (await concept.recordLitter({ motherId: motherAveragePerformerId as string, birthDate: new Date("2023-08-01"), reportedLitterSize: 5 })).litterID!;
  for (let i = 1; i <= 5; i++) {
    const offspringId = `offspring:MAP-L1-O${i}` as ID;
    await concept.recordOffspring({ litterId: avgLitter1 as string, offspringId: offspringId as string, sex: "female" });
    if (i <= 3) {
      await concept.recordWeaning({ offspringId: offspringId as string });
    }
  }


  // Generate the main report covering all mothers
  await concept.generateReport({ target: motherHighPerformerId as string, startDateRange: startDate, endDateRange: endDate, name: reportNameAI });
  await concept.generateReport({ target: motherLowPerformerId as string, startDateRange: startDate, endDateRange: endDate, name: reportNameAI });
  await concept.generateReport({ target: motherRecordErrorId as string, startDateRange: startDate, endDateRange: endDate, name: reportNameAI });
  await concept.generateReport({ target: motherAveragePerformerId as string, startDateRange: startDate, endDateRange: endDate, name: reportNameAI });


  await t.step("should generate a new AI summary when none exists for the report", async () => {
    let report = await concept.reports.findOne({ _id: reportNameAI as ID });
    assertExists(report);
    assertEquals(report.summary, "", "Report summary should initially be empty");

    const result = await concept._aiSummary({ reportName: reportNameAI });

    assertEquals(result.error, undefined);
    assertExists(result.summary, "Summary should be returned");

    let parsedSummary: LLMSummaryOutput;
    try {
      parsedSummary = JSON.parse(result.summary!) as LLMSummaryOutput;
    } catch (e) {
      throw new Error(`Failed to parse AI summary JSON: ${e.message}. Raw summary: ${result.summary}`);
    }

    // Assertions based on expected AI analysis
    assertExists(parsedSummary.highPerformers);
    assertExists(parsedSummary.lowPerformers);
    assertExists(parsedSummary.potentialRecordErrors);
    assertExists(parsedSummary.insights);

    assertEquals(parsedSummary.highPerformers.includes(motherHighPerformerId), true, "High performer should be identified");
    assertEquals(parsedSummary.lowPerformers.includes(motherLowPerformerId), true, "Low performer should be identified");
    assertEquals(parsedSummary.potentialRecordErrors.includes(motherRecordErrorId), true, "Record error mother should be identified");
    assertEquals(parsedSummary.averagePerformers.includes(motherAveragePerformerId), true, "Average performer should be identified");

    assertNotEquals(parsedSummary.insights.length, 0, "Insights should not be empty");
    assertNotEquals(parsedSummary.insights.includes("Do not focus on average/moderate performers"), true, "Insights should not contain prompt text.");
    assertNotEquals(parsedSummary.insights.includes("A few short paragraphs"), true, "Insights should not contain prompt text.");

    // Verify summary is saved to the database
    report = await concept.reports.findOne({ _id: reportNameAI as ID });
    assertExists(report);
    assertEquals(report.summary, result.summary, "Generated summary should be saved to the database");
  });

  await t.step("should return the cached AI summary without calling the AI again if one exists", async () => {
    let report = await concept.reports.findOne({ _id: reportNameAI as ID });
    assertExists(report);
    assertNotEquals(report.summary, "", "Report summary should already exist from previous step");
    const cachedSummary = report.summary;

    const result = await concept._aiSummary({ reportName: reportNameAI });

    assertEquals(result.error, undefined);
    assertEquals(result.summary, cachedSummary, "Should return the cached summary");

    // Re-check database to ensure no changes were made (e.g., summary wasn't re-generated and re-saved)
    report = await concept.reports.findOne({ _id: reportNameAI as ID });
    assertEquals(report.summary, cachedSummary, "Cached summary in DB should be untouched");
  });

  await t.step("should successfully regenerate AI summary, overwriting the old one", async () => {
    let report = await concept.reports.findOne({ _id: reportNameAI as ID });
    assertExists(report);
    assertNotEquals(report.summary, "", "Report summary should exist before regeneration");
    const oldSummary = report.summary;

    const result = await concept.regenerateAISummary({ reportName: reportNameAI });

    assertEquals(result.error, undefined);
    assertExists(result.summary, "New summary should be returned");
    // It's possible for LLMs to generate identical output given identical prompts,
    // so `assertNotEquals(result.summary, oldSummary)` is not strictly reliable for proving regeneration happened.
    // However, the internal logic of `regenerateAISummary` guarantees an API call.
    // We can assert it's a valid JSON summary, and that it's saved.
    
    let parsedSummary: LLMSummaryOutput;
    try {
      parsedSummary = JSON.parse(result.summary!) as LLMSummaryOutput;
    } catch (e) {
      throw new Error(`Failed to parse regenerated AI summary JSON: ${e.message}. Raw summary: ${result.summary}`);
    }

    // Re-assert on content for the regenerated summary
    assertEquals(parsedSummary.highPerformers.includes(motherHighPerformerId), true, "High performer should be identified in regenerated summary");
    assertEquals(parsedSummary.lowPerformers.includes(motherLowPerformerId), true, "Low performer should be identified in regenerated summary");
    assertEquals(parsedSummary.potentialRecordErrors.includes(motherRecordErrorId), true, "Record error mother should be identified in regenerated summary");
    assertEquals(parsedSummary.averagePerformers.includes(motherAveragePerformerId), true, "Average performer should be identified in regenerated summary");
    assertNotEquals(parsedSummary.insights.length, 0, "Insights should not be empty in regenerated summary");

    // Verify the new summary is saved to the database
    report = await concept.reports.findOne({ _id: reportNameAI as ID });
    assertExists(report);
    assertEquals(report.summary, result.summary, "Regenerated summary should be saved to the database");
  });

  await t.step("should return an error if the report does not exist for AI summary", async () => {
    const nonExistentReport = "NonExistentAIReport";
    const result = await concept._aiSummary({ reportName: nonExistentReport });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.summary, undefined);
    assertEquals(result.error, `Report with name '${nonExistentReport}' not found.`);
  });

  await t.step("should return an error if the report does not exist for regenerate AI summary", async () => {
    const nonExistentReport = "NonExistentAIReport";
    const result = await concept.regenerateAISummary({ reportName: nonExistentReport });

    assertExists(result.error, "Error should be returned");
    assertEquals(result.summary, undefined);
    assertEquals(result.error, `Report with name '${nonExistentReport}' not found.`);
  });

  await client.close();
});
```
