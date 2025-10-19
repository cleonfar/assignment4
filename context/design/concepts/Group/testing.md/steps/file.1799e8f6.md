---
timestamp: 'Fri Oct 17 2025 22:15:40 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_221540.ad93ed7b.md]]'
content_id: 1799e8f6bf4f2bb4fa522f934e94230abaf25bb198468b66f8f68047485b90b2
---

# file: src/HerdGrouping/HerdGroupingConcept.test.ts (Updated for Lenient Move/Split)

```typescript
import { assertEquals, assertNotEquals, assertArrayIncludes } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import HerdGroupingConcept from "./HerdGroupingConcept.ts";

Deno.test("HerdGroupingConcept", async (t) => {
  const [db, client] = await testDb();
  const concept = new HerdGroupingConcept(db, client);

  // Define some test data
  const HERD_A = "Pasture A";
  const HERD_B = "Barn B";
  const HERD_C = "Quarantine C";
  const HERD_D = "Calf Pen D"; // For merge testing

  const ANIMAL_1 = "animal:001" as ID;
  const ANIMAL_2 = "animal:002" as ID;
  const ANIMAL_3 = "animal:003" as ID;
  const ANIMAL_4 = "animal:004" as ID;
  const ANIMAL_5 = "animal:005" as ID;
  const ANIMAL_6 = "animal:006" as ID;

  await t.step("createHerd: should create a new herd successfully", async () => {
    const result = await concept.createHerd({ name: HERD_A, description: "Main pasture for cows" });
    if ("error" in result) { // Type narrowing
      throw new Error(`createHerd failed unexpectedly: ${result.error}`);
    }
    assertEquals(result.herdName, HERD_A);

    const composition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in composition) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${composition.error}`);
    }
    assertEquals(composition.animals.length, 0);

    const list = await concept._listHerds(); // _listHerds does not return an error type
    assertEquals(list.herds.length, 1);
    assertEquals(list.herds[0].name, HERD_A);
    assertEquals(list.herds[0].description, "Main pasture for cows");
    assertEquals(list.herds[0].isArchived, false);
  });

  await t.step("createHerd: should return error for duplicate herd name", async () => {
    const result = await concept.createHerd({ name: HERD_A });
    assertEquals("error" in result, true);
    if (!("error" in result)) { // Ensure it's the error type for strictness
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Herd '${HERD_A}' already exists.`);
  });

  await t.step("createHerd: should return error for empty herd name", async () => {
    const result = await concept.createHerd({ name: "" });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, "Herd name cannot be empty.");
  });

  await t.step("createHerd: should create another herd", async () => {
    const result = await concept.createHerd({ name: HERD_B, description: "Night barn" });
    if ("error" in result) { // Type narrowing
      throw new Error(`createHerd failed unexpectedly: ${result.error}`);
    }
    assertEquals(result.herdName, HERD_B);
  });

  await t.step("addAnimal: should add an animal to a herd", async () => {
    const result = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, false);
    if ("error" in result) { // Type narrowing
      throw new Error(`addAnimal failed unexpectedly: ${result.error}`);
    }

    const composition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in composition) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${composition.error}`);
    }
    assertArrayIncludes(composition.animals, [ANIMAL_1]);
  });

  await t.step("addAnimal: should add another animal to the same herd", async () => {
    const result = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_2 });
    assertEquals("error" in result, false);
    if ("error" in result) { // Type narrowing
      throw new Error(`addAnimal failed unexpectedly: ${result.error}`);
    }

    const composition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in composition) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${composition.error}`);
    }
    assertArrayIncludes(composition.animals, [ANIMAL_1, ANIMAL_2]);
  });

  await t.step("addAnimal: should return error if animal is already a member", async () => {
    const result = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Animal '${ANIMAL_1}' is already a member of herd '${HERD_A}'.`);
  });

  await t.step("addAnimal: should return error for non-existent herd", async () => {
    const result = await concept.addAnimal({ herdName: HERD_C, animal: ANIMAL_3 });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Herd '${HERD_C}' not found.`);
  });

  await t.step("removeAnimal: should remove an animal from a herd", async () => {
    const result = await concept.removeAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, false);
    if ("error" in result) { // Type narrowing
      throw new Error(`removeAnimal failed unexpectedly: ${result.error}`);
    }

    const composition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in composition) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${composition.error}`);
    }
    assertEquals(composition.animals.includes(ANIMAL_1), false);
    assertArrayIncludes(composition.animals, [ANIMAL_2]);
  });

  await t.step("removeAnimal: should return error if animal is not a member", async () => {
    const result = await concept.removeAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Animal '${ANIMAL_1}' is not a member of herd '${HERD_A}'.`);
  });

  await t.step("removeAnimal: should return error for non-existent herd", async () => {
    const result = await concept.removeAnimal({ herdName: HERD_C, animal: ANIMAL_2 });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Herd '${HERD_C}' not found.`);
  });

  await t.step("moveAnimal: should move an animal between herds", async () => {
    // Add ANIMAL_3 to HERD_A first
    const addResult = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_3 });
    if ("error" in addResult) {
      throw new Error(`addAnimal failed unexpectedly: ${addResult.error}`);
    }
    const initialHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in initialHerdA) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${initialHerdA.error}`);
    }
    assertArrayIncludes(initialHerdA.animals, [ANIMAL_2, ANIMAL_3]);

    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_3,
    });
    assertEquals("error" in result, false);
    if ("error" in result) { // Type narrowing
      throw new Error(`moveAnimal failed unexpectedly: ${result.error}`);
    }

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in finalHerdA) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${finalHerdA.error}`);
    }
    assertEquals(finalHerdA.animals.includes(ANIMAL_3), false); // Removed from source
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_2]);

    const finalHerdB = await concept._viewComposition({ herdName: HERD_B });
    if ("error" in finalHerdB) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${finalHerdB.error}`);
    }
    assertArrayIncludes(finalHerdB.animals, [ANIMAL_3]); // Added to target
  });

  await t.step("moveAnimal: should return error if animal not in source herd", async () => {
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_1, // Not in HERD_A
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Animal '${ANIMAL_1}' is not a member of source herd '${HERD_A}'.`);
  });

  await t.step("moveAnimal: should *not* return error if animal already in target herd, and ensure it's still there", async () => {
    // Ensure ANIMAL_3 is in HERD_B (it was moved there in a previous step)
    let herdBComposition = await concept._viewComposition({ herdName: HERD_B });
    if ("error" in herdBComposition) throw new Error(`_viewComposition failed: ${herdBComposition.error}`);
    assertArrayIncludes(herdBComposition.animals, [ANIMAL_3]);

    // Add ANIMAL_3 back to HERD_A for the test (so it exists in source for the move precondition)
    const addBackResult = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_3 });
    if ("error" in addBackResult) throw new Error(`addAnimal failed unexpectedly: ${addBackResult.error}`);
    let herdAComposition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in herdAComposition) throw new Error(`_viewComposition failed: ${herdAComposition.error}`);
    assertArrayIncludes(herdAComposition.animals, [ANIMAL_2, ANIMAL_3]);

    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_3, // Animal is already in HERD_B
    });
    assertEquals("error" in result, false); // Should not return an error
    if ("error" in result) {
      throw new Error(`moveAnimal failed unexpectedly: ${result.error}`);
    }

    // Verify ANIMAL_3 is removed from HERD_A
    herdAComposition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in herdAComposition) throw new Error(`_viewComposition failed: ${herdAComposition.error}`);
    assertEquals(herdAComposition.animals.includes(ANIMAL_3), false);
    assertArrayIncludes(herdAComposition.animals, [ANIMAL_2]);

    // Verify ANIMAL_3 is still in HERD_B (and not duplicated if it was already there)
    herdBComposition = await concept._viewComposition({ herdName: HERD_B });
    if ("error" in herdBComposition) throw new Error(`_viewComposition failed: ${herdBComposition.error}`);
    assertArrayIncludes(herdBComposition.animals, [ANIMAL_3]);
    assertEquals(herdBComposition.animals.filter(a => a === ANIMAL_3).length, 1, "Animal should only appear once in target herd");
  });


  await t.step("moveAnimal: should return error if source and target are the same", async () => {
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_A,
      animal: ANIMAL_2,
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, "Source and target herds cannot be the same for moving an animal.");
  });

  await t.step("splitHerd: should split animals from one herd to another", async () => {
    const createHerdCResult = await concept.createHerd({ name: HERD_C, description: "Quarantine pen" });
    if ("error" in createHerdCResult) {
      throw new Error(`createHerd failed unexpectedly: ${createHerdCResult.error}`);
    }
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_4 });
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_5 });
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_6 });

    const initialHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in initialHerdA) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${initialHerdA.error}`);
    }
    assertArrayIncludes(initialHerdA.animals, [ANIMAL_2, ANIMAL_3, ANIMAL_4, ANIMAL_5, ANIMAL_6]); // ANIMAL_3 added back for previous test

    const animalsToSplit = [ANIMAL_4, ANIMAL_5] as Array<ID>;
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: animalsToSplit,
    });
    assertEquals("error" in result, false);
    if ("error" in result) { // Type narrowing
      throw new Error(`splitHerd failed unexpectedly: ${result.error}`);
    }

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in finalHerdA) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${finalHerdA.error}`);
    }
    assertEquals(finalHerdA.animals.includes(ANIMAL_4), false);
    assertEquals(finalHerdA.animals.includes(ANIMAL_5), false);
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_2, ANIMAL_3, ANIMAL_6]);

    const finalHerdC = await concept._viewComposition({ herdName: HERD_C });
    if ("error" in finalHerdC) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${finalHerdC.error}`);
    }
    assertArrayIncludes(finalHerdC.animals, animalsToSplit);
  });

  await t.step("splitHerd: should return error if any animal not in source", async () => {
    const animalsToSplit = [ANIMAL_1, ANIMAL_4] as Array<ID>; // ANIMAL_1 not in HERD_A (it's in HERD_D via merge, for now)
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: animalsToSplit,
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Animals ${ANIMAL_1} are not members of the source herd '${HERD_A}'.`);
  });

  await t.step("splitHerd: should *not* return error if any animal already in target, and ensure all are present once", async () => {
    // ANIMAL_4 is already in HERD_C from the previous splitHerd test.
    let herdCComposition = await concept._viewComposition({ herdName: HERD_C });
    if ("error" in herdCComposition) throw new Error(`_viewComposition failed: ${herdCComposition.error}`);
    assertArrayIncludes(herdCComposition.animals, [ANIMAL_4, ANIMAL_5]);

    // ANIMAL_6 is currently in HERD_A.
    let herdAComposition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in herdAComposition) throw new Error(`_viewComposition failed: ${herdAComposition.error}`);
    assertArrayIncludes(herdAComposition.animals, [ANIMAL_6]);

    // Try to split [ANIMAL_4, ANIMAL_6] from HERD_A to HERD_C
    // ANIMAL_4 is already in HERD_C. ANIMAL_6 is in HERD_A.
    const animalsToSplit = [ANIMAL_4, ANIMAL_6] as Array<ID>;
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: animalsToSplit,
    });
    assertEquals("error" in result, false); // Should not return an error
    if ("error" in result) {
      throw new Error(`splitHerd failed unexpectedly: ${result.error}`);
    }

    // Verify HERD_A no longer has ANIMAL_4, ANIMAL_6 (only ANIMAL_6 was removed, ANIMAL_4 was already gone)
    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in finalHerdA) throw new Error(`_viewComposition failed: ${finalHerdA.error}`);
    assertEquals(finalHerdA.animals.includes(ANIMAL_4), false);
    assertEquals(finalHerdA.animals.includes(ANIMAL_6), false);
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_2, ANIMAL_3]);

    // Verify HERD_C now has ANIMAL_4, ANIMAL_5, ANIMAL_6 (ANIMAL_4 and ANIMAL_5 were already there)
    const finalHerdC = await concept._viewComposition({ herdName: HERD_C });
    if ("error" in finalHerdC) throw new Error(`_viewComposition failed: ${finalHerdC.error}`);
    assertArrayIncludes(finalHerdC.animals, [ANIMAL_4, ANIMAL_5, ANIMAL_6]);
    assertEquals(finalHerdC.animals.filter(a => a === ANIMAL_4).length, 1, "ANIMAL_4 should only appear once in target herd");
    assertEquals(finalHerdC.animals.filter(a => a === ANIMAL_5).length, 1, "ANIMAL_5 should only appear once in target herd");
    assertEquals(finalHerdC.animals.filter(a => a === ANIMAL_6).length, 1, "ANIMAL_6 should only appear once in target herd");
  });

  await t.step("splitHerd: should return error for empty animals to move", async () => {
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: [],
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, "No animals specified to move for splitting.");
  });

  await t.step("mergeHerds: should merge animals from one herd into another and archive the source", async () => {
    const createHerdDResult = await concept.createHerd({ name: HERD_D, description: "Calf pen" });
    if ("error" in createHerdDResult) {
      throw new Error(`createHerd failed unexpectedly: ${createHerdDResult.error}`);
    }
    await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_1 });
    await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_2 }); // ANIMAL_2 is also in HERD_A

    const initialHerdD = await concept._viewComposition({ herdName: HERD_D });
    if ("error" in initialHerdD) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${initialHerdD.error}`);
    }
    assertArrayIncludes(initialHerdD.animals, [ANIMAL_1, ANIMAL_2]);
    const initialHerdA = await concept._viewComposition({ herdName: HERD_A }); // [ANIMAL_2, ANIMAL_3]
    if ("error" in initialHerdA) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${initialHerdA.error}`);
    }

    const result = await concept.mergeHerds({
      herdNameToKeep: HERD_A,
      herdNameToArchive: HERD_D,
    });
    assertEquals("error" in result, false);
    if ("error" in result) { // Type narrowing
      throw new Error(`mergeHerds failed unexpectedly: ${result.error}`);
    }

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in finalHerdA) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${finalHerdA.error}`);
    }
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_1, ANIMAL_2, ANIMAL_3]); // ANIMAL_2 only appears once

    const archivedHerdD = await concept._listHerds(); // _listHerds does not return an error type
    const herdDStatus = archivedHerdD.herds.find((h) => h.name === HERD_D);
    assertEquals(herdDStatus?.isArchived, true);

    const finalHerdDComposition = await concept._viewComposition({ herdName: HERD_D });
    if ("error" in finalHerdDComposition) { // Type narrowing
      throw new Error(`_viewComposition failed unexpectedly: ${finalHerdDComposition.error}`);
    }
    assertEquals(finalHerdDComposition.animals.length, 0); // Archived herd should have members cleared
  });

  await t.step("mergeHerds: should return error if merging herd into itself", async () => {
    const result = await concept.mergeHerds({
      herdNameToKeep: HERD_A,
      herdNameToArchive: HERD_A,
    });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, "Cannot merge a herd into itself.");
  });

  await t.step("mergeHerds: should prevent modifying archived herds", async () => {
    const result = await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_3 });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, `Herd '${HERD_D}' is archived and cannot be modified.`);
  });

  await t.step("_viewComposition: should return error for non-existent herd", async () => {
    const result = await concept._viewComposition({ herdName: "NonExistent" });
    assertEquals("error" in result, true);
    if (!("error" in result)) {
      throw new Error("Expected an error but got success.");
    }
    assertEquals(result.error, "Herd 'NonExistent' not found.");
  });

  await t.step("_listHerds: should return all current herds", async () => {
    const list = await concept._listHerds(); // _listHerds does not return an error type
    assertEquals(list.herds.length, 3); // HERD_A, HERD_B, HERD_C (HERD_D is archived but still listed)

    const herdA = list.herds.find((h) => h.name === HERD_A);
    assertNotEquals(herdA, undefined);
    assertEquals(herdA?.isArchived, false);

    const herdB = list.herds.find((h) => h.name === HERD_B);
    assertNotEquals(herdB, undefined);
    assertEquals(herdB?.isArchived, false);

    const herdC = list.herds.find((h) => h.name === HERD_C);
    assertNotEquals(herdC, undefined);
    assertEquals(herdC?.isArchived, false);

    const herdD = list.herds.find((h) => h.name === HERD_D);
    assertNotEquals(herdD, undefined);
    assertEquals(herdD?.isArchived, true);
  });

  await client.close();
});
```
