import {
  assertArrayIncludes,
  assertEquals,
  assertNotEquals,
} from "jsr:@std/assert";
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
  const ANIMAL_7 = "animal:007" as ID; // New animal for specific split test

  await t.step(
    "createHerd: should create a new herd successfully",
    async () => {
      console.log(
        "\n--- Test: createHerd: should create a new herd successfully ---",
      );
      const result = await concept.createHerd({
        name: HERD_A,
        description: "Main pasture for cows",
      });
      if ("error" in result) {
        throw new Error(`createHerd failed unexpectedly: ${result.error}`);
      }
      assertEquals(result.herdName, HERD_A);

      const composition = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in composition) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${composition.error}`,
        );
      }
      assertEquals(composition.animals.length, 0);

      const list = await concept._listHerds();
      assertEquals(list.herds.length, 1);
      assertEquals(list.herds[0].name, HERD_A);
      assertEquals(list.herds[0].description, "Main pasture for cows");
      assertEquals(list.herds[0].isArchived, false);
      console.log(
        `HERD_A after creation: ${JSON.stringify(composition.animals)}`,
      );
    },
  );

  await t.step(
    "createHerd: should return error for duplicate herd name",
    async () => {
      console.log(
        "\n--- Test: createHerd: should return error for duplicate herd name ---",
      );
      const result = await concept.createHerd({ name: HERD_A });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(result.error, `Herd '${HERD_A}' already exists.`);
    },
  );

  await t.step(
    "createHerd: should return error for empty herd name",
    async () => {
      console.log(
        "\n--- Test: createHerd: should return error for empty herd name ---",
      );
      const result = await concept.createHerd({ name: "" });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(result.error, "Herd name cannot be empty.");
    },
  );

  await t.step("createHerd: should create another herd", async () => {
    console.log("\n--- Test: createHerd: should create another herd ---");
    const result = await concept.createHerd({
      name: HERD_B,
      description: "Night barn",
    });
    if ("error" in result) {
      throw new Error(`createHerd failed unexpectedly: ${result.error}`);
    }
    assertEquals(result.herdName, HERD_B);
    const composition = await concept._viewComposition({ herdName: HERD_B });
    if ("error" in composition) {
      throw new Error(
        `_viewComposition failed unexpectedly: ${composition.error}`,
      );
    }
    console.log(
      `HERD_B after creation: ${JSON.stringify(composition.animals)}`,
    );
  });

  await t.step("addAnimal: should add an animal to a herd", async () => {
    console.log("\n--- Test: addAnimal: should add an animal to a herd ---");
    const result = await concept.addAnimal({
      herdName: HERD_A,
      animal: ANIMAL_1,
    });
    assertEquals("error" in result, false);
    if ("error" in result) {
      throw new Error(`addAnimal failed unexpectedly: ${result.error}`);
    }

    const composition = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in composition) {
      throw new Error(
        `_viewComposition failed unexpectedly: ${composition.error}`,
      );
    }
    assertArrayIncludes(composition.animals, [ANIMAL_1]);
    console.log(
      `HERD_A after adding ANIMAL_1: ${JSON.stringify(composition.animals)}`,
    );
  });

  await t.step(
    "addAnimal: should add another animal to the same herd",
    async () => {
      console.log(
        "\n--- Test: addAnimal: should add another animal to the same herd ---",
      );
      const result = await concept.addAnimal({
        herdName: HERD_A,
        animal: ANIMAL_2,
      });
      assertEquals("error" in result, false);
      if ("error" in result) {
        throw new Error(`addAnimal failed unexpectedly: ${result.error}`);
      }

      const composition = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in composition) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${composition.error}`,
        );
      }
      assertArrayIncludes(composition.animals, [ANIMAL_1, ANIMAL_2]);
      console.log(
        `HERD_A after adding ANIMAL_2: ${JSON.stringify(composition.animals)}`,
      );
    },
  );

  await t.step(
    "addAnimal: should return error if animal is already a member",
    async () => {
      console.log(
        "\n--- Test: addAnimal: should return error if animal is already a member ---",
      );
      const result = await concept.addAnimal({
        herdName: HERD_A,
        animal: ANIMAL_1,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(
        result.error,
        `Animal '${ANIMAL_1}' is already a member of herd '${HERD_A}'.`,
      );
    },
  );

  await t.step(
    "addAnimal: should return error for non-existent herd",
    async () => {
      console.log(
        "\n--- Test: addAnimal: should return error for non-existent herd ---",
      );
      const result = await concept.addAnimal({
        herdName: HERD_C,
        animal: ANIMAL_3,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(result.error, `Herd '${HERD_C}' not found.`);
    },
  );

  await t.step(
    "removeAnimal: should remove an animal from a herd",
    async () => {
      console.log(
        "\n--- Test: removeAnimal: should remove an animal from a herd ---",
      );
      const result = await concept.removeAnimal({
        herdName: HERD_A,
        animal: ANIMAL_1,
      });
      assertEquals("error" in result, false);
      if ("error" in result) {
        throw new Error(`removeAnimal failed unexpectedly: ${result.error}`);
      }

      const composition = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in composition) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${composition.error}`,
        );
      }
      assertEquals(composition.animals.includes(ANIMAL_1), false);
      assertArrayIncludes(composition.animals, [ANIMAL_2]);
      console.log(
        `HERD_A after removing ANIMAL_1: ${
          JSON.stringify(composition.animals)
        }`,
      );
    },
  );

  await t.step(
    "removeAnimal: should return error if animal is not a member",
    async () => {
      console.log(
        "\n--- Test: removeAnimal: should return error if animal is not a member ---",
      );
      const result = await concept.removeAnimal({
        herdName: HERD_A,
        animal: ANIMAL_1,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(
        result.error,
        `Animal '${ANIMAL_1}' is not a member of herd '${HERD_A}'.`,
      );
    },
  );

  await t.step(
    "removeAnimal: should return error for non-existent herd",
    async () => {
      console.log(
        "\n--- Test: removeAnimal: should return error for non-existent herd ---",
      );
      const result = await concept.removeAnimal({
        herdName: HERD_C,
        animal: ANIMAL_2,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(result.error, `Herd '${HERD_C}' not found.`);
    },
  );

  await t.step("moveAnimal: should move an animal between herds", async () => {
    console.log(
      "\n--- Test: moveAnimal: should move an animal between herds ---",
    );
    // Add ANIMAL_3 to HERD_A first
    const addResult = await concept.addAnimal({
      herdName: HERD_A,
      animal: ANIMAL_3,
    });
    if ("error" in addResult) {
      throw new Error(`addAnimal failed unexpectedly: ${addResult.error}`);
    }
    let initialHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in initialHerdA) {
      throw new Error(
        `_viewComposition failed unexpectedly: ${initialHerdA.error}`,
      );
    }
    console.log(`HERD_A before move: ${JSON.stringify(initialHerdA.animals)}`);
    let initialHerdB = await concept._viewComposition({ herdName: HERD_B });
    if ("error" in initialHerdB) {
      throw new Error(
        `_viewComposition failed unexpectedly: ${initialHerdB.error}`,
      );
    }
    console.log(`HERD_B before move: ${JSON.stringify(initialHerdB.animals)}`);

    const result = await concept.moveAnimal({
      sourceHerdName: HERD_A,
      targetHerdName: HERD_B,
      animal: ANIMAL_3,
    });
    assertEquals("error" in result, false);
    if ("error" in result) {
      throw new Error(`moveAnimal failed unexpectedly: ${result.error}`);
    }

    const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
    if ("error" in finalHerdA) {
      throw new Error(
        `_viewComposition failed unexpectedly: ${finalHerdA.error}`,
      );
    }
    assertEquals(finalHerdA.animals.includes(ANIMAL_3), false); // Removed from source
    assertArrayIncludes(finalHerdA.animals, [ANIMAL_2]);
    console.log(`HERD_A after move: ${JSON.stringify(finalHerdA.animals)}`);

    const finalHerdB = await concept._viewComposition({ herdName: HERD_B });
    if ("error" in finalHerdB) {
      throw new Error(
        `_viewComposition failed unexpectedly: ${finalHerdB.error}`,
      );
    }
    assertArrayIncludes(finalHerdB.animals, [ANIMAL_3]); // Added to target
    console.log(`HERD_B after move: ${JSON.stringify(finalHerdB.animals)}`);
  });

  await t.step(
    "moveAnimal: should return error if animal not in source herd",
    async () => {
      console.log(
        "\n--- Test: moveAnimal: should return error if animal not in source herd ---",
      );
      const result = await concept.moveAnimal({
        sourceHerdName: HERD_A,
        targetHerdName: HERD_B,
        animal: ANIMAL_1, // Not in HERD_A currently
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(
        result.error,
        `Animal '${ANIMAL_1}' is not a member of source herd '${HERD_A}'.`,
      );
    },
  );

  await t.step(
    "moveAnimal: should *not* return error if animal already in target herd, and ensure it's still there",
    async () => {
      console.log(
        "\n--- Test: moveAnimal: should *not* return error if animal already in target herd ---",
      );

      // Pre-test state: HERD_A: [ANIMAL_2], HERD_B: [ANIMAL_3]

      // Add ANIMAL_3 back to HERD_A for this test, so it's in the source.
      const addBackResult = await concept.addAnimal({
        herdName: HERD_A,
        animal: ANIMAL_3,
      });
      if ("error" in addBackResult) {
        throw new Error(
          `addAnimal failed unexpectedly: ${addBackResult.error}`,
        );
      }

      let herdAComposition = await concept._viewComposition({
        herdName: HERD_A,
      });
      if ("error" in herdAComposition) {
        throw new Error(`_viewComposition failed: ${herdAComposition.error}`);
      }
      console.log(
        `HERD_A before move: ${JSON.stringify(herdAComposition.animals)}`,
      ); // Expect: [ANIMAL_2, ANIMAL_3]

      let herdBComposition = await concept._viewComposition({
        herdName: HERD_B,
      });
      if ("error" in herdBComposition) {
        throw new Error(`_viewComposition failed: ${herdBComposition.error}`);
      }
      console.log(
        `HERD_B before move (ANIMAL_3 already there): ${
          JSON.stringify(herdBComposition.animals)
        }`,
      ); // Expect: [ANIMAL_3]

      const result = await concept.moveAnimal({
        sourceHerdName: HERD_A,
        targetHerdName: HERD_B,
        animal: ANIMAL_3, // Animal is in HERD_A (source) AND HERD_B (target)
      });
      assertEquals("error" in result, false); // Should not return an error
      if ("error" in result) {
        throw new Error(`moveAnimal failed unexpectedly: ${result.error}`);
      }

      // Verify ANIMAL_3 is removed from HERD_A
      herdAComposition = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in herdAComposition) {
        throw new Error(`_viewComposition failed: ${herdAComposition.error}`);
      }
      assertEquals(herdAComposition.animals.includes(ANIMAL_3), false);
      assertArrayIncludes(herdAComposition.animals, [ANIMAL_2]);
      console.log(
        `HERD_A after move: ${JSON.stringify(herdAComposition.animals)}`,
      );

      // Verify ANIMAL_3 is still in HERD_B (and not duplicated)
      herdBComposition = await concept._viewComposition({ herdName: HERD_B });
      if ("error" in herdBComposition) {
        throw new Error(`_viewComposition failed: ${herdBComposition.error}`);
      }
      assertArrayIncludes(herdBComposition.animals, [ANIMAL_3]);
      assertEquals(
        herdBComposition.animals.filter((a) => a === ANIMAL_3).length,
        1,
        "Animal should only appear once in target herd",
      );
      console.log(
        `HERD_B after move: ${JSON.stringify(herdBComposition.animals)}`,
      );
    },
  );

  await t.step(
    "moveAnimal: should return error if source and target are the same",
    async () => {
      console.log(
        "\n--- Test: moveAnimal: should return error if source and target are the same ---",
      );
      const result = await concept.moveAnimal({
        sourceHerdName: HERD_A,
        targetHerdName: HERD_A,
        animal: ANIMAL_2,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(
        result.error,
        "Source and target herds cannot be the same for moving an animal.",
      );
    },
  );

  await t.step(
    "splitHerd: should split animals from one herd to another",
    async () => {
      console.log(
        "\n--- Test: splitHerd: should split animals from one herd to another ---",
      );
      const createHerdCResult = await concept.createHerd({
        name: HERD_C,
        description: "Quarantine pen",
      });
      if ("error" in createHerdCResult) {
        throw new Error(
          `createHerd failed unexpectedly: ${createHerdCResult.error}`,
        );
      }
      await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_4 });
      await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_5 });
      await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_6 });

      let initialHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in initialHerdA) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${initialHerdA.error}`,
        );
      }
      console.log(
        `HERD_A before split: ${JSON.stringify(initialHerdA.animals)}`,
      ); // Expect: [ANIMAL_2, ANIMAL_4, ANIMAL_5, ANIMAL_6]
      assertArrayIncludes(initialHerdA.animals, [
        ANIMAL_2,
        ANIMAL_4,
        ANIMAL_5,
        ANIMAL_6,
      ]);
      assertEquals(
        initialHerdA.animals.length,
        4,
        "HERD_A should have 4 animals before splitHerd",
      );

      let initialHerdC = await concept._viewComposition({ herdName: HERD_C });
      if ("error" in initialHerdC) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${initialHerdC.error}`,
        );
      }
      console.log(
        `HERD_C before split: ${JSON.stringify(initialHerdC.animals)}`,
      ); // Expect: []

      const animalsToSplit = [ANIMAL_4, ANIMAL_5] as Array<ID>;
      const result = await concept.splitHerd({
        sourceHerdName: HERD_A,
        targetHerdName: HERD_C,
        animalsToMove: animalsToSplit,
      });
      assertEquals("error" in result, false);
      if ("error" in result) {
        throw new Error(`splitHerd failed unexpectedly: ${result.error}`);
      }

      const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in finalHerdA) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${finalHerdA.error}`,
        );
      }
      assertEquals(finalHerdA.animals.includes(ANIMAL_4), false);
      assertEquals(finalHerdA.animals.includes(ANIMAL_5), false);
      assertArrayIncludes(finalHerdA.animals, [ANIMAL_2, ANIMAL_6]);
      console.log(`HERD_A after split: ${JSON.stringify(finalHerdA.animals)}`);

      const finalHerdC = await concept._viewComposition({ herdName: HERD_C });
      if ("error" in finalHerdC) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${finalHerdC.error}`,
        );
      }
      assertArrayIncludes(finalHerdC.animals, animalsToSplit);
      console.log(`HERD_C after split: ${JSON.stringify(finalHerdC.animals)}`);
    },
  );

  // This test now verifies the *error* behavior when animals are missing from source.
  await t.step(
    "splitHerd: should return error if any animal not in source",
    async () => {
      console.log(
        "\n--- Test: splitHerd: should return error if any animal not in source ---",
      );
      // Pre-test state: HERD_A: [ANIMAL_2, ANIMAL_6], HERD_C: [ANIMAL_4, ANIMAL_5]

      // ANIMAL_1 is not in HERD_A. ANIMAL_4 is not in HERD_A. ANIMAL_6 is in HERD_A.
      const animalsToSplit = [ANIMAL_1, ANIMAL_4, ANIMAL_6] as Array<ID>; // ANIMAL_1, ANIMAL_4 not in HERD_A

      let initialHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in initialHerdA) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${initialHerdA.error}`,
        );
      }
      console.log(
        `HERD_A before split attempt: ${JSON.stringify(initialHerdA.animals)}`,
      ); // Expect: [ANIMAL_2, ANIMAL_6]

      let initialHerdC = await concept._viewComposition({ herdName: HERD_C });
      if ("error" in initialHerdC) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${initialHerdC.error}`,
        );
      }
      console.log(
        `HERD_C before split attempt: ${JSON.stringify(initialHerdC.animals)}`,
      ); // Expect: [ANIMAL_4, ANIMAL_5]

      const result = await concept.splitHerd({
        sourceHerdName: HERD_A,
        targetHerdName: HERD_C,
        animalsToMove: animalsToSplit,
      });
      assertEquals("error" in result, true); // Expect an error now
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      // The error message should list both ANIMAL_1 and ANIMAL_4 as missing from source.
      assertEquals(
        result.error,
        `Animals ${ANIMAL_1}, ${ANIMAL_4} are not members of the source herd '${HERD_A}'.`,
      );
      console.log(`Split attempt resulted in error: ${result.error}`);

      // Verify herds are unchanged as the action failed due to precondition
      const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in finalHerdA) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${finalHerdA.error}`,
        );
      }
      assertArrayIncludes(finalHerdA.animals, [ANIMAL_2, ANIMAL_6]);
      console.log(
        `HERD_A after failed split: ${JSON.stringify(finalHerdA.animals)}`,
      );

      const finalHerdC = await concept._viewComposition({ herdName: HERD_C });
      if ("error" in finalHerdC) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${finalHerdC.error}`,
        );
      }
      assertArrayIncludes(finalHerdC.animals, [ANIMAL_4, ANIMAL_5]);
      console.log(
        `HERD_C after failed split: ${JSON.stringify(finalHerdC.animals)}`,
      );
    },
  );

  // This is a new test case to specifically verify the "lenient target" behavior
  // when all animals *are* in the source, but some are *already in the target*.
  await t.step(
    "splitHerd: should *not* return error if some animals already in target (lenient target)",
    async () => {
      console.log(
        "\n--- Test: splitHerd: should *not* return error if some animals already in target ---",
      );
      // Pre-test state: HERD_A: [ANIMAL_2, ANIMAL_6], HERD_C: [ANIMAL_4, ANIMAL_5]

      // Add ANIMAL_7 to HERD_A
      await concept.addAnimal({ herdName: HERD_A, animal: ANIMAL_7 });
      // Add ANIMAL_6 to HERD_C (it's also in HERD_A, for the "already in target" scenario)
      await concept.addAnimal({ herdName: HERD_C, animal: ANIMAL_6 });

      let initialHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in initialHerdA) {
        throw new Error(`_viewComposition failed: ${initialHerdA.error}`);
      }
      console.log(
        `HERD_A before split (source): ${JSON.stringify(initialHerdA.animals)}`,
      ); // Expect: [ANIMAL_2, ANIMAL_6, ANIMAL_7]

      let initialHerdC = await concept._viewComposition({ herdName: HERD_C });
      if ("error" in initialHerdC) {
        throw new Error(`_viewComposition failed: ${initialHerdC.error}`);
      }
      console.log(
        `HERD_C before split (target): ${JSON.stringify(initialHerdC.animals)}`,
      ); // Expect: [ANIMAL_4, ANIMAL_5, ANIMAL_6]

      // Animals to split: ANIMAL_6 (in source, in target), ANIMAL_7 (in source, not in target)
      const animalsToSplit = [ANIMAL_6, ANIMAL_7] as Array<ID>;
      const result = await concept.splitHerd({
        sourceHerdName: HERD_A,
        targetHerdName: HERD_C,
        animalsToMove: animalsToSplit,
      });
      assertEquals("error" in result, false); // This should succeed
      if ("error" in result) {
        throw new Error(`splitHerd failed unexpectedly: ${result.error}`);
      }

      // Verify HERD_A: ANIMAL_6 and ANIMAL_7 should be removed
      const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in finalHerdA) {
        throw new Error(`_viewComposition failed: ${finalHerdA.error}`);
      }
      assertEquals(finalHerdA.animals.includes(ANIMAL_6), false);
      assertEquals(finalHerdA.animals.includes(ANIMAL_7), false);
      assertArrayIncludes(finalHerdA.animals, [ANIMAL_2]); // Only ANIMAL_2 should remain
      console.log(`HERD_A after split: ${JSON.stringify(finalHerdA.animals)}`);

      // Verify HERD_C: should contain ANIMAL_4, ANIMAL_5, ANIMAL_6, ANIMAL_7 (ANIMAL_6 no duplicates)
      const finalHerdC = await concept._viewComposition({ herdName: HERD_C });
      if ("error" in finalHerdC) {
        throw new Error(`_viewComposition failed: ${finalHerdC.error}`);
      }
      assertArrayIncludes(finalHerdC.animals, [
        ANIMAL_4,
        ANIMAL_5,
        ANIMAL_6,
        ANIMAL_7,
      ]);
      assertEquals(
        finalHerdC.animals.filter((a) => a === ANIMAL_6).length,
        1,
        "ANIMAL_6 should only appear once in target herd",
      );
      console.log(`HERD_C after split: ${JSON.stringify(finalHerdC.animals)}`);
    },
  );

  await t.step(
    "splitHerd: should return error for empty animals to move",
    async () => {
      console.log(
        "\n--- Test: splitHerd: should return error for empty animals to move ---",
      );
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
    },
  );

  await t.step(
    "mergeHerds: should merge animals from one herd into another and archive the source",
    async () => {
      console.log(
        "\n--- Test: mergeHerds: should merge animals from one herd into another and archive the source ---",
      );
      const createHerdDResult = await concept.createHerd({
        name: HERD_D,
        description: "Calf pen",
      });
      if ("error" in createHerdDResult) {
        throw new Error(
          `createHerd failed unexpectedly: ${createHerdDResult.error}`,
        );
      }
      await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_1 });
      await concept.addAnimal({ herdName: HERD_D, animal: ANIMAL_2 }); // ANIMAL_2 is also in HERD_A

      let initialHerdD = await concept._viewComposition({ herdName: HERD_D });
      if ("error" in initialHerdD) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${initialHerdD.error}`,
        );
      }
      console.log(
        `HERD_D before merge: ${JSON.stringify(initialHerdD.animals)}`,
      );
      assertArrayIncludes(initialHerdD.animals, [ANIMAL_1, ANIMAL_2]);
      let initialHerdA = await concept._viewComposition({ herdName: HERD_A }); // [ANIMAL_2] after previous split/move tests
      if ("error" in initialHerdA) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${initialHerdA.error}`,
        );
      }
      console.log(
        `HERD_A before merge: ${JSON.stringify(initialHerdA.animals)}`,
      );

      const result = await concept.mergeHerds({
        herdNameToKeep: HERD_A,
        herdNameToArchive: HERD_D,
      });
      assertEquals("error" in result, false);
      if ("error" in result) {
        throw new Error(`mergeHerds failed unexpectedly: ${result.error}`);
      }

      const finalHerdA = await concept._viewComposition({ herdName: HERD_A });
      if ("error" in finalHerdA) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${finalHerdA.error}`,
        );
      }
      assertArrayIncludes(finalHerdA.animals, [ANIMAL_1, ANIMAL_2]); // ANIMAL_2 only appears once
      console.log(`HERD_A after merge: ${JSON.stringify(finalHerdA.animals)}`);

      const archivedHerdD = await concept._listHerds(); // _listHerds does not return an error type
      const herdDStatus = archivedHerdD.herds.find((h) => h.name === HERD_D);
      assertEquals(herdDStatus?.isArchived, true);

      const finalHerdDComposition = await concept._viewComposition({
        herdName: HERD_D,
      });
      if ("error" in finalHerdDComposition) {
        throw new Error(
          `_viewComposition failed unexpectedly: ${finalHerdDComposition.error}`,
        );
      }
      assertEquals(finalHerdDComposition.animals.length, 0); // Archived herd should have members cleared
      console.log(
        `HERD_D after merge: ${JSON.stringify(finalHerdDComposition.animals)}`,
      );
    },
  );

  await t.step(
    "mergeHerds: should return error if merging herd into itself",
    async () => {
      console.log(
        "\n--- Test: mergeHerds: should return error if merging herd into itself ---",
      );
      const result = await concept.mergeHerds({
        herdNameToKeep: HERD_A,
        herdNameToArchive: HERD_A,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(result.error, "Cannot merge a herd into itself.");
    },
  );

  await t.step(
    "mergeHerds: should prevent modifying archived herds",
    async () => {
      console.log(
        "\n--- Test: mergeHerds: should prevent modifying archived herds ---",
      );
      const result = await concept.addAnimal({
        herdName: HERD_D,
        animal: ANIMAL_3,
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(
        result.error,
        `Herd '${HERD_D}' is archived and cannot be modified.`,
      );
    },
  );

  await t.step(
    "_viewComposition: should return error for non-existent herd",
    async () => {
      console.log(
        "\n--- Test: _viewComposition: should return error for non-existent herd ---",
      );
      const result = await concept._viewComposition({
        herdName: "NonExistent",
      });
      assertEquals("error" in result, true);
      if (!("error" in result)) {
        throw new Error("Expected an error but got success.");
      }
      assertEquals(result.error, "Herd 'NonExistent' not found.");
    },
  );

  await t.step(
    "_listHerds: should return all current herds (including archived)",
    async () => { // Updated description for clarity
      console.log(
        "\n--- Test: _listHerds: should return all current herds (including archived) ---",
      );
      const list = await concept._listHerds();
      // Correction: There are 4 herds: HERD_A, HERD_B, HERD_C (created by split), HERD_D (created by merge and then archived)
      assertEquals(list.herds.length, 4); // <--- CHANGE THIS LINE FROM 3 TO 4

      const herdA = list.herds.find((h) => h.name === HERD_A);
      assertNotEquals(herdA, undefined);
      assertEquals(herdA?.isArchived, false);
      console.log(`Listed Herd A: ${JSON.stringify(herdA)}`);

      const herdB = list.herds.find((h) => h.name === HERD_B);
      assertNotEquals(herdB, undefined);
      assertEquals(herdB?.isArchived, false);
      console.log(`Listed Herd B: ${JSON.stringify(herdB)}`);

      const herdC = list.herds.find((h) => h.name === HERD_C);
      assertNotEquals(herdC, undefined);
      assertEquals(herdC?.isArchived, false);
      console.log(`Listed Herd C: ${JSON.stringify(herdC)}`);

      const herdD = list.herds.find((h) => h.name === HERD_D);
      assertNotEquals(herdD, undefined);
      assertEquals(herdD?.isArchived, true);
      console.log(`Listed Herd D: ${JSON.stringify(herdD)}`);
    },
  );

  await client.close();
});
