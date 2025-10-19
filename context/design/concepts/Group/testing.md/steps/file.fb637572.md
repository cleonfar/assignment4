---
timestamp: 'Sat Oct 18 2025 12:25:40 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_122540.2eb5eac2.md]]'
content_id: fb63757202600e53ec6908e75da2b81539d998769b42c11840823caf0aee1c2d
---

# file: src/HerdGrouping/HerdGroupingConcept.test-edge.ts

```typescript
import { assertEquals, assertArrayIncludes, assertNotEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import HerdGroupingConcept from "./HerdGroupingConcept.ts";

Deno.test("HerdGroupingConcept - Edge Cases", async (t) => {
  const [db, client] = await testDb();
  const concept = new HerdGroupingConcept(db, client);

  // Define some unique test data for this file
  const HERD_E = "Herd Epsilon";
  const HERD_F = "Herd Sigma";
  const HERD_G = "Herd Gamma";
  const HERD_H = "Herd Eta"; // For splitting all animals
  const HERD_I = "Herd Iota"; // For merging complex duplicates
  const HERD_J = "Herd Kappa"; // For merging complex duplicates

  const ANIMAL_A = "animal:alpha" as ID;
  const ANIMAL_B = "animal:beta" as ID;
  const ANIMAL_C = "animal:gamma" as ID;
  const ANIMAL_D = "animal:delta" as ID;
  const ANIMAL_E = "animal:epsilon" as ID;
  const ANIMAL_F = "animal:phi" as ID;
  const ANIMAL_G = "animal:sigma" as ID;

  await t.step("createHerd for initial setup for edge cases", async () => {
    await concept.createHerd({ name: HERD_E, description: "Initial setup herd E" });
    await concept.createHerd({ name: HERD_F, description: "Initial setup herd F" });
    await concept.createHerd({ name: HERD_G, description: "Initial setup herd G" });
    await concept.createHerd({ name: HERD_H, description: "Initial setup herd H" });
    await concept.createHerd({ name: HERD_I, description: "Initial setup herd I" });
    await concept.createHerd({ name: HERD_J, description: "Initial setup herd J" });
    await concept.addAnimal({ herdName: HERD_E, animal: ANIMAL_A });
    await concept.addAnimal({ herdName: HERD_E, animal: ANIMAL_B });
    await concept.addAnimal({ herdName: HERD_E, animal: ANIMAL_C });
    await concept.addAnimal({ herdName: HERD_H, animal: ANIMAL_F });
    await concept.addAnimal({ herdName: HERD_H, animal: ANIMAL_G });
    await concept.addAnimal({ herdName: HERD_I, animal: ANIMAL_D });
    await concept.addAnimal({ herdName: HERD_I, animal: ANIMAL_E });
    await concept.addAnimal({ herdName: HERD_J, animal: ANIMAL_E }); // Duplicate with HERD_I
    await concept.addAnimal({ herdName: HERD_J, animal: ANIMAL_A }); // Duplicate with HERD_E, but used differently here
  });

  // Test Case 1: splitHerd creates a new target herd if it doesn't exist
  await t.step("splitHerd: should create new target herd if it does not exist", async () => {
    console.log("\n--- Test: splitHerd creates new target herd ---");
    const NEW_HERD = "New Target Herd";
    const animalsToMove = [ANIMAL_A, ANIMAL_B] as Array<ID>;

    let initialHerdE = await concept._viewComposition({ herdName: HERD_E });
    if ("error" in initialHerdE) throw new Error(`_viewComposition failed: ${initialHerdE.error}`);
    console.log(`HERD_E before split: ${JSON.stringify(initialHerdE.animals)}`);
    assertArrayIncludes(initialHerdE.animals, animalsToMove);

    const result = await concept.splitHerd({
      sourceHerdName: HERD_E,
      targetHerdName: NEW_HERD,
      animalsToMove: animalsToMove,
    });
    assertEquals("error" in result, false, `splitHerd failed unexpectedly: ${("error" in result) ? result.error : ''}`);

    // Verify NEW_HERD exists and has animals
    const newHerdComposition = await concept._viewComposition({ herdName: NEW_HERD });
    if ("error" in newHerdComposition) throw new Error(`_viewComposition failed for new herd: ${newHerdComposition.error}`);
    assertArrayIncludes(newHerdComposition.animals, animalsToMove, `New herd '${NEW_HERD}' should contain moved animals.`);
    assertEquals(newHerdComposition.animals.length, animalsToMove.length);
    console.log(`New Herd '${NEW_HERD}' after split: ${JSON.stringify(newHerdComposition.animals)}`);

    // Verify animals removed from HERD_E
    const finalHerdE = await concept._viewComposition({ herdName: HERD_E });
    if ("error" in finalHerdE) throw new Error(`_viewComposition failed: ${finalHerdE.error}`);
    assertEquals(finalHerdE.animals.includes(ANIMAL_A), false);
    assertEquals(finalHerdE.animals.includes(ANIMAL_B), false);
    assertArrayIncludes(finalHerdE.animals, [ANIMAL_C]); // ANIMAL_C should remain
    console.log(`HERD_E after split: ${JSON.stringify(finalHerdE.animals)}`);

    const list = await concept._listHerds();
    assertEquals(list.herds.some(h => h.name === NEW_HERD && !h.isArchived), true, `New herd '${NEW_HERD}' should be listed and not archived.`);
  });

  // Test Case 2: Attempting moveAnimal from an archived source herd
  await t.step("moveAnimal: should return error if source herd is archived", async () => {
    console.log("\n--- Test: moveAnimal from archived source ---");
    // Archive HERD_G first for this test
    // To archive, we can merge it into itself, or into another herd.
    // Let's create an empty temporary herd and merge HERD_G into it.
    const TEMP_HERD = "Temp For Archiving G";
    await concept.createHerd({ name: TEMP_HERD }); // Create a temp herd
    await concept.addAnimal({ herdName: HERD_G, animal: ANIMAL_D }); // Add an animal to G
    await concept.mergeHerds({ herdNameToKeep: TEMP_HERD, herdNameToArchive: HERD_G }); // Archive G

    let herdGStatus = await concept._listHerds();
    assertEquals(herdGStatus.herds.find(h => h.name === HERD_G)?.isArchived, true, "HERD_G should be archived.");

    // Attempt to move ANIMAL_D from archived HERD_G
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_G,
      targetHerdName: HERD_F,
      animal: ANIMAL_D,
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Source herd '${HERD_G}' is archived.`);
    console.log(`Move attempt from archived HERD_G resulted in error: ${result.error}`);

    // Verify HERD_F remains unchanged
    const finalHerdF = await concept._viewComposition({ herdName: HERD_F });
    if ("error" in finalHerdF) throw new Error(`_viewComposition failed: ${finalHerdF.error}`);
    assertEquals(finalHerdF.animals.includes(ANIMAL_D), false);
  });

  // Test Case 3: Removing the last animal from a herd
  await t.step("removeAnimal: should leave herd empty after removing last animal", async () => {
    console.log("\n--- Test: removeAnimal last animal ---");
    // HERD_F should currently be empty from initial setup
    await concept.addAnimal({ herdName: HERD_F, animal: ANIMAL_E });
    let initialHerdF = await concept._viewComposition({ herdName: HERD_F });
    if ("error" in initialHerdF) throw new Error(`_viewComposition failed: ${initialHerdF.error}`);
    assertEquals(initialHerdF.animals.length, 1);
    assertArrayIncludes(initialHerdF.animals, [ANIMAL_E]);
    console.log(`HERD_F before removing last animal: ${JSON.stringify(initialHerdF.animals)}`);

    const result = await concept.removeAnimal({ herdName: HERD_F, animal: ANIMAL_E });
    assertEquals("error" in result, false, `removeAnimal failed unexpectedly: ${("error" in result) ? result.error : ''}`);

    const finalHerdF = await concept._viewComposition({ herdName: HERD_F });
    if ("error" in finalHerdF) throw new Error(`_viewComposition failed: ${finalHerdF.error}`);
    assertEquals(finalHerdF.animals.length, 0, "Herd should be empty after removing its last animal.");
    console.log(`HERD_F after removing last animal: ${JSON.stringify(finalHerdF.animals)}`);
  });

  // Test Case 4: splitHerd moving all animals from source herd
  await t.step("splitHerd: should move all animals from source herd, leaving it empty", async () => {
    console.log("\n--- Test: splitHerd moving all animals ---");
    const animalsInH = [ANIMAL_F, ANIMAL_G] as Array<ID>;
    let initialHerdH = await concept._viewComposition({ herdName: HERD_H });
    if ("error" in initialHerdH) throw new Error(`_viewComposition failed: ${initialHerdH.error}`);
    assertArrayIncludes(initialHerdH.animals, animalsInH);
    assertEquals(initialHerdH.animals.length, animalsInH.length);
    console.log(`HERD_H before split: ${JSON.stringify(initialHerdH.animals)}`);

    let initialHerdF = await concept._viewComposition({ herdName: HERD_F });
    if ("error" in initialHerdF) throw new Error(`_viewComposition failed: ${initialHerdF.error}`);
    assertEquals(initialHerdF.animals.length, 0); // HERD_F is empty from previous test
    console.log(`HERD_F before split: ${JSON.stringify(initialHerdF.animals)}`);

    const result = await concept.splitHerd({
      sourceHerdName: HERD_H,
      targetHerdName: HERD_F,
      animalsToMove: animalsInH,
    });
    assertEquals("error" in result, false, `splitHerd failed unexpectedly: ${("error" in result) ? result.error : ''}`);

    const finalHerdH = await concept._viewComposition({ herdName: HERD_H });
    if ("error" in finalHerdH) throw new Error(`_viewComposition failed: ${finalHerdH.error}`);
    assertEquals(finalHerdH.animals.length, 0, "Source herd should be empty after moving all its animals.");
    console.log(`HERD_H after split: ${JSON.stringify(finalHerdH.animals)}`);

    const finalHerdF = await concept._viewComposition({ herdName: HERD_F });
    if ("error" in finalHerdF) throw new Error(`_viewComposition failed: ${finalHerdF.error}`);
    assertArrayIncludes(finalHerdF.animals, animalsInH, "Target herd should contain all moved animals.");
    assertEquals(finalHerdF.animals.length, animalsInH.length);
    console.log(`HERD_F after split: ${JSON.stringify(finalHerdF.animals)}`);
  });

  // Test Case 5: mergeHerds with complex duplicate handling and existing target members
  await t.step("mergeHerds: handles duplicates and preserves existing target members correctly", async () => {
    console.log("\n--- Test: mergeHerds complex duplicates ---");
    // HERD_I: [ANIMAL_D, ANIMAL_E]
    // HERD_J: [ANIMAL_E, ANIMAL_A]

    let initialHerdI = await concept._viewComposition({ herdName: HERD_I });
    if ("error" in initialHerdI) throw new Error(`_viewComposition failed: ${initialHerdI.error}`);
    assertArrayIncludes(initialHerdI.animals, [ANIMAL_D, ANIMAL_E]);
    assertEquals(initialHerdI.animals.length, 2);
    console.log(`HERD_I (to keep) before merge: ${JSON.stringify(initialHerdI.animals)}`);

    let initialHerdJ = await concept._viewComposition({ herdName: HERD_J });
    if ("error" in initialHerdJ) throw new Error(`_viewComposition failed: ${initialHerdJ.error}`);
    assertArrayIncludes(initialHerdJ.animals, [ANIMAL_E, ANIMAL_A]);
    assertEquals(initialHerdJ.animals.length, 2);
    console.log(`HERD_J (to archive) before merge: ${JSON.stringify(initialHerdJ.animals)}`);

    const result = await concept.mergeHerds({
      herdNameToKeep: HERD_I,
      herdNameToArchive: HERD_J,
    });
    assertEquals("error" in result, false, `mergeHerds failed unexpectedly: ${("error" in result) ? result.error : ''}`);

    // Verify HERD_I contains all unique animals from both
    const finalHerdI = await concept._viewComposition({ herdName: HERD_I });
    if ("error" in finalHerdI) throw new Error(`_viewComposition failed: ${finalHerdI.error}`);
    assertArrayIncludes(finalHerdI.animals, [ANIMAL_D, ANIMAL_E, ANIMAL_A]);
    assertEquals(finalHerdI.animals.length, 3, "HERD_I should have unique animals from both, no duplicates.");
    assertEquals(finalHerdI.animals.filter(a => a === ANIMAL_E).length, 1, "ANIMAL_E should not be duplicated in HERD_I.");
    console.log(`HERD_I after merge: ${JSON.stringify(finalHerdI.animals)}`);

    // Verify HERD_J is archived and empty
    const archivedHerdJ = await concept._listHerds();
    const herdJStatus = archivedHerdJ.herds.find((h) => h.name === HERD_J);
    assertEquals(herdJStatus?.isArchived, true, "HERD_J should be archived.");

    const finalHerdJComposition = await concept._viewComposition({ herdName: HERD_J });
    if ("error" in finalHerdJComposition) throw new Error(`_viewComposition failed: ${finalHerdJComposition.error}`);
    assertEquals(finalHerdJComposition.animals.length, 0, "Archived HERD_J should have its members cleared.");
    console.log(`HERD_J after merge: ${JSON.stringify(finalHerdJComposition.animals)}`);
  });

  await client.close();
});
```
