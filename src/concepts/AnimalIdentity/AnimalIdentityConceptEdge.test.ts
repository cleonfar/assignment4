import { Collection, Db } from "npm:mongodb";
import {
  assertEquals,
  assertExists,
  assertObjectMatch,
  assertStringIncludes,
  fail,
} from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import AnimalIdentityConcept from "./AnimalIdentityConcept.ts";

// Define an interface for the resources to be passed into each test step
interface TestContext {
  db: Db;
  client: any; // MongoClient type is not directly exported, using any for simplicity
  concept: AnimalIdentityConcept;
  animalsCollection: Collection;
}

// AnimalDocument interface for type-safety when fetching from collection
// This should mirror the AnimalDocument in AnimalIdentityConcept.ts (without parent/offspring fields)
interface AnimalDocumentTest {
  _id: ID;
  species: string;
  breed: string;
  sex: "male" | "female" | "neutered";
  status: "alive" | "sold" | "deceased" | "transferred";
  notes: string;
  birthDate: Date | null;
}

Deno.test("AnimalIdentityConcept: Edge Cases and Scenarios", async (t) => {
  const setupTestContext = async (): Promise<TestContext> => {
    const [db_inner, client_inner] = await testDb();

    if (!db_inner) {
      await client_inner?.close();
      fail("Failed to get a valid database instance from testDb().");
    }

    let concept_inner: AnimalIdentityConcept | undefined;
    try {
      concept_inner = new AnimalIdentityConcept(db_inner);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      await client_inner?.close();
      fail(`Failed to initialize AnimalIdentityConcept: ${errorMessage}`);
    }

    if (concept_inner === undefined) {
      await client_inner?.close();
      fail(
        "Concept initialization unexpectedly resulted in undefined concept_inner.",
      );
    }

    const animalsCollection_inner = db_inner.collection(
      "AnimalIdentity.animals",
    );

    const context: TestContext = {
      db: db_inner,
      client: client_inner,
      concept: concept_inner,
      animalsCollection: animalsCollection_inner,
    };
    return context;
  };

  const teardownTestContext = async (context: TestContext) => {
    if (context && context.client) {
      await context.client.close();
    }
  };

  // --- Scenarios being tested ---
  // 1. Editing attributes after a terminal status (e.g., deceased).
  // 2. Sequential status changes, specifically attempting a 'markAsX' on a non-alive animal.
  // 3. Registering with minimal data, then fully populating via `editDetails`.

  await t.step(
    "Scenario 1: Should allow editing details of an animal that is no longer 'alive'",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:scenario1:1" as ID;
        await concept.registerAnimal({
          id: animalId,
          species: "Tiger",
          sex: "male",
          birthDate: new Date("2018-01-01"),
          breed: "Bengal",
        });

        // Mark as deceased
        const deceasedDate = new Date("2023-01-01");
        const markDeceasedResult = await concept.markAsDeceased({
          animal: animalId,
          date: deceasedDate,
          cause: "Natural causes",
        });
        if ("error" in markDeceasedResult) {
          fail(`Failed to mark as deceased: ${markDeceasedResult.error}`);
        }

        let fetchedAnimal = (await concept._getAnimal({ id: animalId })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, "deceased");
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Deceased on ${deceasedDate.toISOString().split("T")[0]}`,
        );

        // Attempt to edit details
        const newSpecies = "Siberian Tiger";
        const newBreed = "Siberian";
        const newSex = "female"; // Change sex post-mortem, for example

        const editResult = await concept.editDetails({
          animal: animalId,
          species: newSpecies,
          breed: newBreed,
          birthDate: new Date("2017-05-10"), // Change birth date
          sex: newSex,
        });

        assertObjectMatch(editResult, {}); // Expect success

        fetchedAnimal = (await concept._getAnimal({ id: animalId })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal._id, animalId);
        assertEquals(fetchedAnimal.animal.species, newSpecies);
        assertEquals(fetchedAnimal.animal.breed, newBreed);
        assertEquals(fetchedAnimal.animal.sex, newSex);
        assertEquals(
          fetchedAnimal.animal.birthDate?.toISOString(),
          new Date("2017-05-10").toISOString(),
        );
        // Crucially, the status and notes should NOT have changed
        assertEquals(fetchedAnimal.animal.status, "deceased");
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Deceased on ${deceasedDate.toISOString().split("T")[0]}`,
        );
      } finally {
        await teardownTestContext({
          concept,
          animalsCollection,
          client,
          db: concept["db"],
        });
      }
    },
  );

  await t.step(
    "Scenario 2: Should prevent 'markAsX' actions on animals not in 'alive' status",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:scenario2:1" as ID;
        await concept.registerAnimal({
          id: animalId,
          species: "Elephant",
          sex: "male",
        });

        // First, mark as sold
        const soldDate = new Date("2022-03-15");
        const markSoldResult = await concept.markAsSold({
          animal: animalId,
          date: soldDate,
          buyerNotes: "To zoo",
        });
        if ("error" in markSoldResult) {
          fail(`Failed to mark as sold: ${markSoldResult.error}`);
        }

        let fetchedAnimal = (await concept._getAnimal({ id: animalId })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, "sold");

        // Attempt to mark as deceased (should fail, as status is 'sold', not 'alive')
        const deceasedDate = new Date("2023-01-01");
        const markDeceasedResult = await concept.markAsDeceased({
          animal: animalId,
          date: deceasedDate,
          cause: "Old age",
        });

        assertObjectMatch(markDeceasedResult, {
          error:
            `Animal '${animalId}' must be 'alive' to be marked as deceased (current status: sold).`,
        });

        // Verify status is still 'sold'
        fetchedAnimal = (await concept._getAnimal({ id: animalId })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, "sold");
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Sold on ${soldDate.toISOString().split("T")[0]}`,
        ); // Notes should be from sold action
      } finally {
        await teardownTestContext({
          concept,
          animalsCollection,
          client,
          db: concept["db"],
        });
      }
    },
  );

  await t.step(
    "Scenario 3: Should allow populating all optional fields using editDetails after minimal registration",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:scenario4:1" as ID;
        // Register with only required fields
        await concept.registerAnimal({
          id: animalId,
          species: "Panda",
          sex: "female",
        });

        let fetchedAnimal = (await concept._getAnimal({ id: animalId })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.breed, "");
        assertEquals(fetchedAnimal.animal.birthDate, null);
        assertEquals(fetchedAnimal.animal.notes, "");

        // Now use editDetails to fill in all optional fields
        const newSpecies = "Giant Panda"; // Although species can also be edited, for this test, we might keep it the same or change slightly
        const newBreed = "Qinling Panda";
        const newBirthDate = new Date("2021-06-15T00:00:00.000Z");
        const newSex = "female"; // Keep same sex, or change if needed for test

        const editResult = await concept.editDetails({
          animal: animalId,
          species: newSpecies,
          breed: newBreed,
          birthDate: newBirthDate,
          sex: newSex,
        });
        assertObjectMatch(editResult, {});

        fetchedAnimal = (await concept._getAnimal({ id: animalId })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.species, newSpecies);
        assertEquals(fetchedAnimal.animal.breed, newBreed);
        assertEquals(
          fetchedAnimal.animal.birthDate?.toISOString(),
          newBirthDate.toISOString(),
        );
        assertEquals(fetchedAnimal.animal.sex, newSex);
        assertEquals(fetchedAnimal.animal.status, "alive"); // Status should remain unchanged
        assertEquals(fetchedAnimal.animal.notes, ""); // Notes should remain unchanged as editDetails doesn't touch them
      } finally {
        await teardownTestContext({
          concept,
          animalsCollection,
          client,
          db: concept["db"],
        });
      }
    },
  );
});
