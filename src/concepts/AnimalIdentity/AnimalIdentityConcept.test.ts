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
  client: { close: () => Promise<void> } | undefined; // Narrow type with close()
  concept: AnimalIdentityConcept;
  animalsCollection: Collection;
}

// AnimalDocument interface for type-safety when fetching from collection
// This should mirror the AnimalDocument in AnimalIdentityConcept.ts (without parent/offspring fields)
interface AnimalDocumentTest {
  _id: ID; // internal system ID
  ownerId: ID;
  animalId: ID; // user-facing id
  species: string;
  breed: string;
  sex: "male" | "female" | "neutered";
  status: "alive" | "sold" | "deceased" | "transferred";
  notes: string;
  birthDate: Date | null;
}

Deno.test("AnimalIdentityConcept actions", async (t) => {
  const setupTestContext = async (): Promise<TestContext> => {
    // console.log("\n--- setupTestContext START ---"); // Uncomment for debugging setup issues
    const [db_inner, client_inner] = await testDb();

    if (!db_inner) {
      console.error(
        "setupTestContext: testDb() returned an undefined database. Check MongoDB connection details (e.g., .env file).",
      );
      await client_inner?.close();
      fail("Failed to get a valid database instance from testDb().");
    }

    let concept_inner: AnimalIdentityConcept | undefined;
    try {
      concept_inner = new AnimalIdentityConcept(db_inner);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(
        `setupTestContext: Failed to initialize AnimalIdentityConcept: ${errorMessage}`,
        e,
      );
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
    // console.log("--- setupTestContext END ---\n"); // Uncomment for debugging setup issues
    return context;
  };

  const teardownTestContext = async (context: TestContext) => {
    // console.log("--- teardownTestContext START ---"); // Uncomment for debugging setup issues
    await context.client?.close();
    // console.log("--- teardownTestContext END ---\n"); // Uncomment for debugging setup issues
  };

  // --- registerAnimal tests ---
  const testUser = "test-user" as ID;

  await t.step(
    "registerAnimal: should successfully register an animal with all fields provided",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:dog:1" as ID;
        const species = "Dog";
        const sex = "male";
        const birthDate = new Date("2022-01-15T00:00:00.000Z"); // Use ISO string for consistency
        const breed = "Golden Retriever";
        const notes = "Friendly and energetic.";

        const result = await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species,
          sex,
          birthDate,
          breed,
          notes,
        });

        assertObjectMatch(result, { animal: animalId });
        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.animalId, animalId);
        assertEquals(fetchedAnimal.animal.ownerId, testUser);
        assertEquals(fetchedAnimal.animal.species, species);
        assertEquals(fetchedAnimal.animal.sex, sex);
        assertEquals(
          fetchedAnimal.animal.birthDate?.toISOString(),
          birthDate.toISOString(),
        );
        assertEquals(fetchedAnimal.animal.breed, breed);
        assertEquals(fetchedAnimal.animal.notes, notes);
        assertEquals(fetchedAnimal.animal.status, "alive");
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
    "registerAnimal: should successfully register an animal with only required fields",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:cat:2" as ID;
        const species = "Cat";
        const sex = "female";

        const result = await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species,
          sex,
        });

        assertObjectMatch(result, { animal: animalId });
        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.animalId, animalId);
        assertEquals(fetchedAnimal.animal.ownerId, testUser);
        assertEquals(fetchedAnimal.animal.species, species);
        assertEquals(fetchedAnimal.animal.sex, sex);
        assertEquals(fetchedAnimal.animal.birthDate, null);
        assertEquals(fetchedAnimal.animal.breed, "");
        assertEquals(fetchedAnimal.animal.notes, "");
        assertEquals(fetchedAnimal.animal.status, "alive");
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
    "registerAnimal: should return an error when registering an animal with an existing ID",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:bird:3" as ID;
        const registerSuccess = await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Bird",
          sex: "male",
        });
        if ("error" in registerSuccess) {
          fail(`Initial registration failed: ${registerSuccess.error}`);
        }

        const result = await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Bird",
          sex: "female",
        });

        assertObjectMatch(result, {
          error:
            `Animal with ID '${animalId}' already exists for user '${testUser}'.`,
        });
        assertEquals(
          await animalsCollection.countDocuments({
            ownerId: testUser,
            animalId: animalId,
          }),
          1,
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
    "registerAnimal: should register multiple animals successfully",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animal1Id = "animal:sheep:1" as ID;
        const animal2Id = "animal:sheep:2" as ID;

        await concept.registerAnimal({
          user: testUser,
          id: animal1Id,
          species: "Sheep",
          sex: "female",
        });
        await concept.registerAnimal({
          user: testUser,
          id: animal2Id,
          species: "Sheep",
          sex: "male",
        });

        assertEquals(await animalsCollection.countDocuments({}), 2);
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

  // --- updateStatus tests ---
  await t.step(
    "updateStatus: should successfully update an animal's status and notes",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:horse:10" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Horse",
          sex: "male",
        });

        const newStatus = "sold";
        const newNotes = "Sold to Farmer John.";
        const result = await concept.updateStatus({
          user: testUser,
          animal: animalId,
          status: newStatus,
          notes: newNotes,
        });

        assertObjectMatch(result, {}); // Expecting an Empty object for success
        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, newStatus);
        assertEquals(fetchedAnimal.animal.notes, newNotes);
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
    "updateStatus: should return an error if animal to update does not exist",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const nonExistentAnimalId = "animal:ghost:11" as ID;
        const result = await concept.updateStatus({
          user: testUser,
          animal: nonExistentAnimalId,
          status: "deceased",
          notes: "Gone.",
        });

        assertObjectMatch(result, {
          error:
            `Animal with ID '${nonExistentAnimalId}' not found for user '${testUser}'.`,
        });
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

  // --- editDetails tests ---
  await t.step(
    "editDetails: should successfully update an animal's identifying attributes",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:zebra:50" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Zebra",
          sex: "female",
          breed: "Plains Zebra",
          birthDate: new Date("2020-03-01T00:00:00.000Z"),
          notes: "Initial notes",
        });

        const originalAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(originalAnimal.animal);
        assertEquals(originalAnimal.animal.status, "alive"); // Ensure status is untouched

        const newSpecies = "Mountain Zebra";
        const newBreed = "Cape Mountain Zebra";
        const newBirthDate = new Date("2019-11-20T00:00:00.000Z");
        const newSex = "male";

        const result = await concept.editDetails({
          user: testUser,
          animal: animalId,
          species: newSpecies,
          breed: newBreed,
          birthDate: newBirthDate,
          sex: newSex,
        });

        assertObjectMatch(result, {}); // Expecting an Empty object for success

        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.animalId, animalId);
        assertEquals(fetchedAnimal.animal.species, newSpecies);
        assertEquals(fetchedAnimal.animal.breed, newBreed);
        assertEquals(
          fetchedAnimal.animal.birthDate?.toISOString(),
          newBirthDate.toISOString(),
        );
        assertEquals(fetchedAnimal.animal.sex, newSex);
        assertEquals(fetchedAnimal.animal.status, originalAnimal.animal.status); // Status should remain unchanged
        assertEquals(fetchedAnimal.animal.notes, originalAnimal.animal.notes); // Notes should remain unchanged
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
    "editDetails: should return an error if animal to edit does not exist",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const nonExistentAnimalId = "animal:phantom:51" as ID;
        const result = await concept.editDetails({
          user: testUser,
          animal: nonExistentAnimalId,
          species: "Phantom",
          breed: "Invisible",
          birthDate: new Date(),
          sex: "neutered",
        });

        assertObjectMatch(result, {
          error:
            `Animal with ID '${nonExistentAnimalId}' not found for user '${testUser}'.`,
        });
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

  // --- markAsTransferred tests ---
  await t.step(
    "markAsTransferred: should successfully mark an alive animal as transferred",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:pig:20" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Pig",
          sex: "female",
        });

        const transferDate = new Date("2023-05-10");
        const recipientNotes = "New owner is delighted.";
        const result = await concept.markAsTransferred({
          user: testUser,
          animal: animalId,
          date: transferDate,
          recipientNotes,
        });

        assertObjectMatch(result, {});
        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, "transferred");
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Transferred on ${transferDate.toISOString().split("T")[0]}`,
        );
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Recipient notes: ${recipientNotes}`,
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
    "markAsTransferred: should return an error if animal to transfer does not exist",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const nonExistentAnimalId = "animal:alien:21" as ID;
        const result = await concept.markAsTransferred({
          user: testUser,
          animal: nonExistentAnimalId,
          date: new Date(),
        });

        assertObjectMatch(result, {
          error:
            `Animal with ID '${nonExistentAnimalId}' not found for user '${testUser}'.`,
        });
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
    "markAsTransferred: should return an error if animal is not alive",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:chicken:22" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Chicken",
          sex: "female",
        });
        // Intentionally change status to non-alive
        const updateResult = await concept.updateStatus({
          user: testUser,
          animal: animalId,
          status: "deceased",
          notes: "Killed by fox",
        });
        if ("error" in updateResult) {
          fail(`Failed to update status: ${updateResult.error}`);
        }

        const result = await concept.markAsTransferred({
          user: testUser,
          animal: animalId,
          date: new Date(),
        });

        assertObjectMatch(result, {
          error:
            `Animal '${animalId}' for user '${testUser}' must be 'alive' to be marked as transferred (current status: deceased).`,
        });
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

  // --- markAsDeceased tests ---
  await t.step(
    "markAsDeceased: should successfully mark an alive animal as deceased",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:goat:30" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Goat",
          sex: "male",
        });

        const deceasedDate = new Date("2023-01-01");
        const cause = "Old age";
        const result = await concept.markAsDeceased({
          user: testUser,
          animal: animalId,
          date: deceasedDate,
          cause,
        });

        assertObjectMatch(result, {});
        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, "deceased");
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Deceased on ${deceasedDate.toISOString().split("T")[0]}`,
        );
        assertStringIncludes(fetchedAnimal.animal.notes, `Cause: ${cause}`);
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
    "markAsDeceased: should return an error if animal to mark deceased does not exist",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const nonExistentAnimalId = "animal:dragon:31" as ID;
        const result = await concept.markAsDeceased({
          user: testUser,
          animal: nonExistentAnimalId,
          date: new Date(),
        });

        assertObjectMatch(result, {
          error:
            `Animal with ID '${nonExistentAnimalId}' not found for user '${testUser}'.`,
        });
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
    "markAsDeceased: should return an error if animal is not alive",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:cow:32" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Cow",
          sex: "female",
        });
        // Intentionally change status to non-alive
        const updateResult = await concept.updateStatus({
          user: testUser,
          animal: animalId,
          status: "sold",
          notes: "Bought by another farmer",
        });
        if ("error" in updateResult) {
          fail(
            `Failed to update status: ${updateResult.error}`,
          );
        }

        const result = await concept.markAsDeceased({
          user: testUser,
          animal: animalId,
          date: new Date(),
        });

        assertObjectMatch(result, {
          error:
            `Animal '${animalId}' for user '${testUser}' must be 'alive' to be marked as deceased (current status: sold).`,
        });
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

  // --- markAsSold tests ---
  await t.step(
    "markAsSold: should successfully mark an alive animal as sold",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:sheepdog:40" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Sheepdog",
          sex: "male",
        });

        const soldDate = new Date("2023-07-20");
        const buyerNotes = "Excellent working dog.";
        const result = await concept.markAsSold({
          user: testUser,
          animal: animalId,
          date: soldDate,
          buyerNotes,
        });

        assertObjectMatch(result, {});
        const fetchedAnimal = (await concept._getAnimal({
          user: testUser,
          id: animalId,
        })) as {
          animal: AnimalDocumentTest;
        };
        assertExists(fetchedAnimal.animal);
        assertEquals(fetchedAnimal.animal.status, "sold");
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Sold on ${soldDate.toISOString().split("T")[0]}`,
        );
        assertStringIncludes(
          fetchedAnimal.animal.notes,
          `Buyer notes: ${buyerNotes}`,
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
    "markAsSold: should return an error if animal to mark sold does not exist",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const nonExistentAnimalId = "animal:unicorn:41" as ID;
        const result = await concept.markAsSold({
          user: testUser,
          animal: nonExistentAnimalId,
          date: new Date(),
        });

        assertObjectMatch(result, {
          error:
            `Animal with ID '${nonExistentAnimalId}' not found for user '${testUser}'.`,
        });
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
    "markAsSold: should return an error if animal is not alive",
    async () => {
      const { concept, animalsCollection, client } = await setupTestContext();
      try {
        const animalId = "animal:duck:42" as ID;
        await concept.registerAnimal({
          user: testUser,
          id: animalId,
          species: "Duck",
          sex: "female",
        });
        // Intentionally change status to non-alive
        const updateResult = await concept.updateStatus({
          user: testUser,
          animal: animalId,
          status: "deceased",
          notes: "Natural causes",
        });
        if ("error" in updateResult) {
          fail(
            `Failed to update status: ${updateResult.error}`,
          );
        }

        const result = await concept.markAsSold({
          user: testUser,
          animal: animalId,
          date: new Date(),
        });

        assertObjectMatch(result, {
          error:
            `Animal '${animalId}' for user '${testUser}' must be 'alive' to be marked as sold (current status: deceased).`,
        });
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
