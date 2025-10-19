---
timestamp: 'Fri Oct 17 2025 21:51:51 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_215151.7e39648f.md]]'
content_id: 369f89eb96d602d1707f83f904e3ab32cb52dbb2eeabc7a44a95e2a476907b6d
---

# file: src/HerdGrouping/HerdGroupingConcept.test.ts

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
    assertEquals("herdName" in result, true);
    assertEquals(result.herdName, HERD_A);

    const composition = await concept._viewComposition({ herdName: HERD_A });
    assertEquals("animals" in composition, true);
    assertEquals(composition.animals.length, 0);

    const list = await concept._listHerds();
    assertEquals(list.herds.length, 1);
    assertEquals(list.herds[0].name, HERD_A);
    assertEquals(list.herds[0].description, "Main pasture for cows");
    assertEquals(list.herds[0].isArchived, false);
  });

  await t.step("createHerd: should return error for duplicate herd name", async () => {
    const result = await concept.createHerd({ name: HERD_A });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Herd '${HERD_A}' already exists.`);
  });

  await t.step("createHerd: should return error for empty herd name", async () => {
    const result = await concept.createHerd({ name: "" });
    assertEquals("error" in result, true);
    assertEquals(result.error, "Herd name cannot be empty.");
  });

  await t.step("createHerd: should create another herd", async () => {
    const result = await concept.createHerd({ name: HERD_B, description: "Night barn" });
    assertEquals("herdName" in result, true);
    assertEquals(result.herdName, HERD_B);
  });

  await t.step("addAnimal: should add an animal to a herd", async () => {
    const result = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, false);

    const composition = await concept._viewComposition({ herdName: HERD_A });
    assertEquals("animals" in composition, true);
    assertArrayIncludes(composition.animals, [ANIMAL_1]);
  });

  await t.step("addAnimal: should add another animal to the same herd", async () => {
    const result = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_2 });
    assertEquals("error" in result, false);

    const composition = await concept._viewComposition({ herdName: HERD_A });
    assertArrayIncludes(composition.animals, [ANIMAL_1, ANIMAL_2]);
  });

  await t.step("addAnimal: should return error if animal is already a member", async () => {
    const result = await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Animal '${ANIMAL_1}' is already a member of herd '${HERD_A}'.`);
  });

  await t.step("addAnimal: should return error for non-existent herd", async () => {
    const result = await concept.addAnimal({ herdName: HERD_C, animal: ANIMAL_3 });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Herd '${HERD_C}' not found.`);
  });

  await t.step("removeAnimal: should remove an animal from a herd", async () => {
    const result = await concept.removeAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, false);

    const composition = await concept._viewComposition({ herdName: HERD_A });
    assertEquals(composition.animals.includes(ANIMAL_1), false);
    assertArrayIncludes(composition.animals, [ANIMAL_2]);
  });

  await t.step("removeAnimal: should return error if animal is not a member", async () => {
    const result = await concept.removeAnimal({ herdName: HERD_A, animal: ANIMAL_1 });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Animal '${ANIMAL_1}' is not a member of herd '${HERD_A}'.`);
  });

  await t.step("removeAnimal: should return error for non-existent herd", async () => {
    const result = await concept.removeAnimal({ herdName: HERD_C, animal: ANIMAL_2 });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Herd '${HERD_C}' not found.`);
  });

  await t.step("moveAnimal: should move an animal between herds", async () => {
    // Add ANIMAL_3 to HERD_A first
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_3 });
    const initialHerdA = await concept._viewComposition({ herdName: HERD_A });
    assertArrayIncludes(initialHerdA.animals, [ANIMAL_2, ANIMAL_3]);

    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_3,
    });
    assertEquals("error" in result, false);

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    assertEquals(finalHerdA.animals.includes(ANIMAL_3), false); // Removed from source
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_2]);

    const finalHerdB = await concept._viewComposition({ herdName: HERD_B });
    assertArrayIncludes(finalHerdB.animals, [ANIMAL_3]); // Added to target
  });

  await t.step("moveAnimal: should return error if animal not in source herd", async () => {
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_1, // Not in HERD_A
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Animal '${ANIMAL_1}' is not a member of source herd '${HERD_A}'.`);
  });

  await t.step("moveAnimal: should return error if animal already in target herd", async () => {
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_3, // Already in HERD_B
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Animal '${ANIMAL_3}' is already a member of target herd '${HERD_B}'.`);
  });

  await t.step("moveAnimal: should return error if source and target are the same", async () => {
    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_A,
      animal: ANIMAL_2,
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, "Source and target herds cannot be the same for moving an animal.");
  });

  await t.step("splitHerd: should split animals from one herd to another", async () => {
    await concept.createHerd({ name: HERD_C, description: "Quarantine pen" });
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_4 });
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_5 });
    await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_6 });

    const initialHerdA = await concept._viewComposition({ herdName: HERD_A });
    assertArrayIncludes(initialHerdA.animals, [ANIMAL_2, ANIMAL_4, ANIMAL_5, ANIMAL_6]);

    const animalsToSplit = [ANIMAL_4, ANIMAL_5] as Array<ID>;
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: animalsToSplit,
    });
    assertEquals("error" in result, false);

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    assertEquals(finalHerdA.animals.includes(ANIMAL_4), false);
    assertEquals(finalHerdA.animals.includes(ANIMAL_5), false);
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_2, ANIMAL_6]);

    const finalHerdC = await concept._viewComposition({ herdName: HERD_C });
    assertArrayIncludes(finalHerdC.animals, animalsToSplit);
  });

  await t.step("splitHerd: should return error if any animal not in source", async () => {
    const animalsToSplit = [ANIMAL_1, ANIMAL_4] as Array<ID>; // ANIMAL_1 not in HERD_A
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: animalsToSplit,
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Animals ${ANIMAL_1} are not members of the source herd '${HERD_A}'.`);
  });

  await t.step("splitHerd: should return error if any animal already in target", async () => {
    const animalsToSplit = [ANIMAL_4, ANIMAL_6] as Array<ID>; // ANIMAL_4 already in HERD_C
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: animalsToSplit,
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Animals ${ANIMAL_4} are already members of the target herd '${HERD_C}'.`);
  });

  await t.step("splitHerd: should return error for empty animals to move", async () => {
    const result = await concept.splitHerd({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_C,
      animalsToMove: [],
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, "No animals specified to move for splitting.");
  });

  await t.step("mergeHerds: should merge animals from one herd into another and archive the source", async () => {
    await concept.createHerd({ name: HERD_D, description: "Calf pen" });
    await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_1 });
    await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_2 }); // ANIMAL_2 is also in HERD_A

    const initialHerdD = await concept._viewComposition({ herdName: HERD_D });
    assertArrayIncludes(initialHerdD.animals, [ANIMAL_1, ANIMAL_2]);
    const initialHerdA = await concept._viewComposition({ herdName: HERD_A }); // [ANIMAL_2, ANIMAL_6]

    const result = await concept.mergeHerds({
      herdNameToKeep: HERD_A,
      herdNameToArchive: HERD_D,
    });
    assertEquals("error" in result, false);

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_1, ANIMAL_2, ANIMAL_6]); // ANIMAL_2 only appears once

    const archivedHerdD = await concept._listHerds();
    const herdDStatus = archivedHerdD.herds.find((h) => h.name === HERD_D);
    assertEquals(herdDStatus?.isArchived, true);

    const finalHerdDComposition = await concept._viewComposition({ herdName: HERD_D });
    assertEquals("animals" in finalHerdDComposition, true);
    assertEquals(finalHerdDComposition.animals.length, 0); // Archived herd should have members cleared
  });

  await t.step("mergeHerds: should return error if merging herd into itself", async () => {
    const result = await concept.mergeHerds({
      herdNameToKeep: HERD_A,
      herdNameToArchive: HERD_A,
    });
    assertEquals("error" in result, true);
    assertEquals(result.error, "Cannot merge a herd into itself.");
  });

  await t.step("mergeHerds: should prevent modifying archived herds", async () => {
    const result = await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_3 });
    assertEquals("error" in result, true);
    assertEquals(result.error, `Herd '${HERD_D}' is archived and cannot be modified.`);
  });

  await t.step("_viewComposition: should return error for non-existent herd", async () => {
    const result = await concept._viewComposition({ herdName: "NonExistent" });
    assertEquals("error" in result, true);
    assertEquals(result.error, "Herd 'NonExistent' not found.");
  });

  await t.step("_listHerds: should return all current herds", async () => {
    const list = await concept._listHerds();
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
