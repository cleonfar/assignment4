---
timestamp: 'Thu Oct 16 2025 18:04:25 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_180425.e7267f2c.md]]'
content_id: 55795c6674b117677dc7067672d1330b49502111b20ff245432b30fc15790467
---

# file: src/ReproductionTracking/ReproductionTrackingConcept.test.ts

```typescript
import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import ReproductionTrackingConcept from "./ReproductionTrackingConcept.ts";
import { ID } from "@utils/types.ts";
import { UNKNOWN_FATHER_ID } from "./ReproductionTrackingConcept.ts";

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
    assertEquals(updateResult.error, `New litter with ID '${nonExistentLitterId}' not found.`);

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

  await t.step("should successfully record death for a living offspring", async () => {
    const result = await concept.recordDeath({
      offspringId: livingOffspringId as string,
    });

    assertEquals(result, { offspringId: livingOffspringId });

    const updatedOffspring = await concept.offspring.findOne({ _id: livingOffspringId });
    assertExists(updatedOffspring);
    assertEquals(updatedOffspring?.isAlive, false, "isAlive should be false after death");
    assertEquals(updatedOffspring?.survivedTillWeaning, false, "survivedTillWeaning should be false after death");
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
    // Manually set to not alive and not weaned (similar to what recordDeath does)
    await concept.offspring.updateOne(
      { _id: alreadyDeadOffspringId },
      { $set: { isAlive: false, survivedTillWeaning: false } },
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
    assertEquals(alreadyDeadOffspring.survivedTillWeaning, false);
  });

  await t.step("should set survivedTillWeaning to false if offspring dies after weaning was recorded", async () => {
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
    assertEquals(deadWeanedOffspring.survivedTillWeaning, false, "survivedTillWeaning should be reset to false after death");
  });

  await client.close();
});
```
