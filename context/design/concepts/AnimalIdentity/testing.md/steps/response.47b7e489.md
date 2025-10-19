---
timestamp: 'Fri Oct 17 2025 17:40:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_174035.4e45b6fa.md]]'
content_id: 47b7e489562b471a4db44051920b263a19fa40211799a2bfdf5d692784de7058
---

# response:

```typescript
// src/AnimalIdentity/AnimalIdentityConcept.test.ts
import { Collection, Db } from "npm:mongodb";
import { assertEquals, assertExists, assertObjectMatch, fail, assertStringIncludes } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID, UNKNOWN_FATHER_ID, UNKNOWN_MOTHER_ID } from "@utils/types.ts";
import AnimalIdentityConcept from "./AnimalIdentityConcept.ts";

// Define an interface for the resources to be passed into each test step
interface TestContext {
  db: Db;
  client: any; // MongoClient type is not directly exported, using any for simplicity
  concept: AnimalIdentityConcept;
  animalsCollection: Collection;
}

// AnimalDocument interface for type-safety when fetching from collection
// This should mirror the AnimalDocument in AnimalIdentityConcept.ts
interface AnimalDocumentTest {
  _id: ID;
  species: string;
  breed: string;
  sex: "male" | "female" | "neutered";
  status: "alive" | "sold" | "deceased" | "transferred";
  notes: string;
  birthDate: Date | null;
  mother: ID;
  father: ID;
  offspring: ID[];
}


Deno.test("AnimalIdentityConcept actions", async (t) => {
  const setupTestContext = async (): Promise<TestContext> => {
    // console.log("\n--- setupTestContext START ---"); // Uncomment for debugging setup issues
    const [db_inner, client_inner] = await testDb();
    
    if (!db_inner) {
      console.error("setupTestContext: testDb() returned an undefined database. Check MongoDB connection details (e.g., .env file).");
      await client_inner?.close();
      fail("Failed to get a valid database instance from testDb().");
    }

    let concept_inner: AnimalIdentityConcept | undefined;
    try {
      concept_inner = new AnimalIdentityConcept(db_inner);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`setupTestContext: Failed to initialize AnimalIdentityConcept: ${errorMessage}`, e);
      await client_inner?.close();
      fail(`Failed to initialize AnimalIdentityConcept: ${errorMessage}`);
    }
    
    if (concept_inner === undefined) {
      await client_inner?.close();
      fail("Concept initialization unexpectedly resulted in undefined concept_inner.");
    }

    const animalsCollection_inner = db_inner.collection("AnimalIdentity.animals");
    
    const context: TestContext = { 
      db: db_inner, 
      client: client_inner, 
      concept: concept_inner, 
      animalsCollection: animalsCollection_inner 
    };
    // console.log("--- setupTestContext END ---\n"); // Uncomment for debugging setup issues
    return context;
  };

  const teardownTestContext = async (context: TestContext) => {
    // console.log("--- teardownTestContext START ---"); // Uncomment for debugging setup issues
    if (context && context.client) {
      await context.client.close();
    }
    // console.log("--- teardownTestContext END ---\n"); // Uncomment for debugging setup issues
  };

  // --- registerAnimal tests (from previous response) ---
  await t.step("registerAnimal: should successfully register an animal with all fields provided", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:dog:1" as ID;
      const species = "Dog";
      const sex = "male";
      const birthDate = new Date("2022-01-15T00:00:00.000Z"); // Use ISO string for consistency
      const breed = "Golden Retriever";
      const motherId = "animal:dog:mother" as ID;
      const fatherId = "animal:dog:father" as ID;
      const notes = "Friendly and energetic.";

      await concept.registerAnimal({ id: motherId, species: "Dog", sex: "female" });
      await concept.registerAnimal({ id: fatherId, species: "Dog", sex: "male" });

      const result = await concept.registerAnimal({
        id: animalId,
        species,
        sex,
        birthDate,
        breed,
        mother: motherId,
        father: fatherId,
        notes,
      });

      assertObjectMatch(result, { animal: animalId });
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal._id, animalId);
      assertEquals(fetchedAnimal.animal.species, species);
      assertEquals(fetchedAnimal.animal.sex, sex);
      assertEquals(fetchedAnimal.animal.birthDate?.toISOString(), birthDate.toISOString());
      assertEquals(fetchedAnimal.animal.breed, breed);
      assertEquals(fetchedAnimal.animal.mother, motherId);
      assertEquals(fetchedAnimal.animal.father, fatherId);
      assertEquals(fetchedAnimal.animal.notes, notes);
      assertEquals(fetchedAnimal.animal.status, "alive");
      assertEquals(fetchedAnimal.animal.offspring, []);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("registerAnimal: should successfully register an animal with only required fields", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:cat:2" as ID;
      const species = "Cat";
      const sex = "female";

      const result = await concept.registerAnimal({ id: animalId, species, sex });

      assertObjectMatch(result, { animal: animalId });
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal._id, animalId);
      assertEquals(fetchedAnimal.animal.species, species);
      assertEquals(fetchedAnimal.animal.sex, sex);
      assertEquals(fetchedAnimal.animal.birthDate, null);
      assertEquals(fetchedAnimal.animal.breed, "");
      assertEquals(fetchedAnimal.animal.mother, UNKNOWN_MOTHER_ID);
      assertEquals(fetchedAnimal.animal.father, UNKNOWN_FATHER_ID);
      assertEquals(fetchedAnimal.animal.notes, "");
      assertEquals(fetchedAnimal.animal.status, "alive");
      assertEquals(fetchedAnimal.animal.offspring, []);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("registerAnimal: should return an error when registering an animal with an existing ID", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:bird:3" as ID;
      const registerSuccess = await concept.registerAnimal({ id: animalId, species: "Bird", sex: "male" });
      if ('error' in registerSuccess) fail(`Initial registration failed: ${registerSuccess.error}`);

      const result = await concept.registerAnimal({ id: animalId, species: "Bird", sex: "female" });

      assertObjectMatch(result, { error: `Animal with ID '${animalId}' already exists.` });
      assertEquals(await animalsCollection.countDocuments({ _id: animalId }), 1);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("registerAnimal: should allow passing UNKNOWN_MOTHER_ID/UNKNOWN_FATHER_ID explicitly", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:fish:4" as ID;
      const species = "Fish";
      const sex = "neutered";

      const result = await concept.registerAnimal({
        id: animalId,
        species,
        sex,
        mother: UNKNOWN_MOTHER_ID,
        father: UNKNOWN_FATHER_ID,
      });

      assertObjectMatch(result, { animal: animalId });
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal.mother, UNKNOWN_MOTHER_ID);
      assertEquals(fetchedAnimal.animal.father, UNKNOWN_FATHER_ID);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("registerAnimal: should register multiple animals successfully", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animal1Id = "animal:sheep:1" as ID;
      const animal2Id = "animal:sheep:2" as ID;

      await concept.registerAnimal({ id: animal1Id, species: "Sheep", sex: "female" });
      await concept.registerAnimal({ id: animal2Id, species: "Sheep", sex: "male" });

      assertEquals(await animalsCollection.countDocuments({}), 2);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  // --- updateStatus tests ---
  await t.step("updateStatus: should successfully update an animal's status and notes", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:horse:10" as ID;
      await concept.registerAnimal({ id: animalId, species: "Horse", sex: "male" });

      const newStatus = "sold";
      const newNotes = "Sold to Farmer John.";
      const result = await concept.updateStatus({ animal: animalId, status: newStatus, notes: newNotes });

      assertObjectMatch(result, {}); // Expecting an Empty object for success
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal.status, newStatus);
      assertEquals(fetchedAnimal.animal.notes, newNotes);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("updateStatus: should return an error if animal to update does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const nonExistentAnimalId = "animal:ghost:11" as ID;
      const result = await concept.updateStatus({ animal: nonExistentAnimalId, status: "deceased", notes: "Gone." });

      assertObjectMatch(result, { error: `Animal with ID '${nonExistentAnimalId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  // --- markAsTransferred tests ---
  await t.step("markAsTransferred: should successfully mark an alive animal as transferred", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:pig:20" as ID;
      await concept.registerAnimal({ id: animalId, species: "Pig", sex: "female" });

      const transferDate = new Date("2023-05-10");
      const recipientNotes = "New owner is delighted.";
      const result = await concept.markAsTransferred({ animal: animalId, date: transferDate, recipientNotes });

      assertObjectMatch(result, {});
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal.status, "transferred");
      assertStringIncludes(fetchedAnimal.animal.notes, `Transferred on ${transferDate.toISOString().split("T")[0]}`);
      assertStringIncludes(fetchedAnimal.animal.notes, `Recipient notes: ${recipientNotes}`);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("markAsTransferred: should return an error if animal to transfer does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const nonExistentAnimalId = "animal:alien:21" as ID;
      const result = await concept.markAsTransferred({ animal: nonExistentAnimalId, date: new Date() });

      assertObjectMatch(result, { error: `Animal with ID '${nonExistentAnimalId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("markAsTransferred: should return an error if animal is not alive", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:chicken:22" as ID;
      await concept.registerAnimal({ id: animalId, species: "Chicken", sex: "female" });
      await concept.updateStatus({ animal: animalId, status: "deceased", notes: "Killed by fox" });

      const result = await concept.markAsTransferred({ animal: animalId, date: new Date() });

      assertObjectMatch(result, { error: `Animal '${animalId}' must be 'alive' to be marked as transferred (current status: deceased).` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  // --- markAsDeceased tests ---
  await t.step("markAsDeceased: should successfully mark an alive animal as deceased", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:goat:30" as ID;
      await concept.registerAnimal({ id: animalId, species: "Goat", sex: "male" });

      const deceasedDate = new Date("2023-01-01");
      const cause = "Old age";
      const result = await concept.markAsDeceased({ animal: animalId, date: deceasedDate, cause });

      assertObjectMatch(result, {});
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal.status, "deceased");
      assertStringIncludes(fetchedAnimal.animal.notes, `Deceased on ${deceasedDate.toISOString().split("T")[0]}`);
      assertStringIncludes(fetchedAnimal.animal.notes, `Cause: ${cause}`);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("markAsDeceased: should return an error if animal to mark deceased does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const nonExistentAnimalId = "animal:dragon:31" as ID;
      const result = await concept.markAsDeceased({ animal: nonExistentAnimalId, date: new Date() });

      assertObjectMatch(result, { error: `Animal with ID '${nonExistentAnimalId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("markAsDeceased: should return an error if animal is not alive", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:cow:32" as ID;
      await concept.registerAnimal({ id: animalId, species: "Cow", sex: "female" });
      await concept.updateStatus({ animal: animalId, status: "sold", notes: "Bought by another farmer" });

      const result = await concept.markAsDeceased({ animal: animalId, date: new Date() });

      assertObjectMatch(result, { error: `Animal '${animalId}' must be 'alive' to be marked as deceased (current status: sold).` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  // --- markAsSold tests ---
  await t.step("markAsSold: should successfully mark an alive animal as sold", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:sheepdog:40" as ID;
      await concept.registerAnimal({ id: animalId, species: "Sheepdog", sex: "male" });

      const soldDate = new Date("2023-07-20");
      const buyerNotes = "Excellent working dog.";
      const result = await concept.markAsSold({ animal: animalId, date: soldDate, buyerNotes });

      assertObjectMatch(result, {});
      const fetchedAnimal = (await concept._getAnimal({ id: animalId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedAnimal.animal);
      assertEquals(fetchedAnimal.animal.status, "sold");
      assertStringIncludes(fetchedAnimal.animal.notes, `Sold on ${soldDate.toISOString().split("T")[0]}`);
      assertStringIncludes(fetchedAnimal.animal.notes, `Buyer notes: ${buyerNotes}`);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("markAsSold: should return an error if animal to mark sold does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const nonExistentAnimalId = "animal:unicorn:41" as ID;
      const result = await concept.markAsSold({ animal: nonExistentAnimalId, date: new Date() });

      assertObjectMatch(result, { error: `Animal with ID '${nonExistentAnimalId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("markAsSold: should return an error if animal is not alive", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:duck:42" as ID;
      await concept.registerAnimal({ id: animalId, species: "Duck", sex: "female" });
      await concept.updateStatus({ animal: animalId, status: "deceased", notes: "Natural causes" });

      const result = await concept.markAsSold({ animal: animalId, date: new Date() });

      assertObjectMatch(result, { error: `Animal '${animalId}' must be 'alive' to be marked as sold (current status: deceased).` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  // --- setParent tests ---
  await t.step("setParent: should successfully set a mother for an animal", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:calf:50" as ID;
      const motherId = "animal:cow:mom:51" as ID;

      await concept.registerAnimal({ id: childId, species: "Calf", sex: "male" });
      await concept.registerAnimal({ id: motherId, species: "Cow", sex: "female" });

      const result = await concept.setParent({ animal: childId, parentType: "mother", parent: motherId });

      assertObjectMatch(result, {});
      const fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedChild.animal);
      assertEquals(fetchedChild.animal.mother, motherId);

      const fetchedMother = (await concept._getAnimal({ id: motherId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedMother.animal);
      assertEquals(fetchedMother.animal.offspring, [childId]);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should successfully set a father for an animal", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:foal:52" as ID;
      const fatherId = "animal:stallion:dad:53" as ID;

      await concept.registerAnimal({ id: childId, species: "Foal", sex: "female" });
      await concept.registerAnimal({ id: fatherId, species: "Stallion", sex: "male" });

      const result = await concept.setParent({ animal: childId, parentType: "father", parent: fatherId });

      assertObjectMatch(result, {});
      const fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedChild.animal);
      assertEquals(fetchedChild.animal.father, fatherId);

      const fetchedFather = (await concept._getAnimal({ id: fatherId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedFather.animal);
      assertEquals(fetchedFather.animal.offspring, [childId]);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should update an existing parent and remove offspring from old parent", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:lamb:54" as ID;
      const mother1Id = "animal:ewe:old:55" as ID;
      const mother2Id = "animal:ewe:new:56" as ID;

      await concept.registerAnimal({ id: childId, species: "Lamb", sex: "male" });
      await concept.registerAnimal({ id: mother1Id, species: "Ewe", sex: "female" });
      await concept.registerAnimal({ id: mother2Id, species: "Ewe", sex: "female" });

      // Set mother1 as initial mother
      await concept.setParent({ animal: childId, parentType: "mother", parent: mother1Id });
      let fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertEquals(fetchedChild.animal?.mother, mother1Id);
      let fetchedMother1 = (await concept._getAnimal({ id: mother1Id})) as { animal: AnimalDocumentTest };
      assertEquals(fetchedMother1.animal?.offspring, [childId]);

      // Set mother2 as new mother
      const result = await concept.setParent({ animal: childId, parentType: "mother", parent: mother2Id });
      assertObjectMatch(result, {});

      fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedChild.animal);
      assertEquals(fetchedChild.animal.mother, mother2Id);

      fetchedMother1 = (await concept._getAnimal({ id: mother1Id})) as { animal: AnimalDocumentTest };
      assertExists(fetchedMother1.animal);
      assertEquals(fetchedMother1.animal.offspring, []); // Child should be removed from old mother's offspring

      let fetchedMother2 = (await concept._getAnimal({ id: mother2Id})) as { animal: AnimalDocumentTest };
      assertExists(fetchedMother2.animal);
      assertEquals(fetchedMother2.animal.offspring, [childId]); // Child should be added to new mother's offspring
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should return error if child animal does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const nonExistentChildId = "animal:unknown:child:60" as ID;
      const motherId = "animal:cow:mom:61" as ID;
      await concept.registerAnimal({ id: motherId, species: "Cow", sex: "female" });

      const result = await concept.setParent({ animal: nonExistentChildId, parentType: "mother", parent: motherId });
      assertObjectMatch(result, { error: `Animal with ID '${nonExistentChildId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should return error if parent animal does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:calf:62" as ID;
      const nonExistentMotherId = "animal:unknown:mother:63" as ID;
      await concept.registerAnimal({ id: childId, species: "Calf", sex: "male" });

      const result = await concept.setParent({ animal: childId, parentType: "mother", parent: nonExistentMotherId });
      assertObjectMatch(result, { error: `Parent animal with ID '${nonExistentMotherId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should return error if parent's sex does not match parentType (male as mother)", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:cub:64" as ID;
      const maleParentId = "animal:lion:65" as ID;
      await concept.registerAnimal({ id: childId, species: "Cub", sex: "female" });
      await concept.registerAnimal({ id: maleParentId, species: "Lion", sex: "male" });

      const result = await concept.setParent({ animal: childId, parentType: "mother", parent: maleParentId });
      assertObjectMatch(result, { error: `Parent '${maleParentId}' must be 'female' to be a mother (current sex: male).` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should return error if parent's sex does not match parentType (female as father)", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:chick:66" as ID;
      const femaleParentId = "animal:hen:67" as ID;
      await concept.registerAnimal({ id: childId, species: "Chick", sex: "male" });
      await concept.registerAnimal({ id: femaleParentId, species: "Hen", sex: "female" });

      const result = await concept.setParent({ animal: childId, parentType: "father", parent: femaleParentId });
      assertObjectMatch(result, { error: `Parent '${femaleParentId}' must be 'male' to be a father (current sex: female).` `Parent '${femaleParentId}' must be 'male' to be a father (current sex: female).` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("setParent: should return error if animal tries to be its own parent", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const animalId = "animal:self:68" as ID;
      await concept.registerAnimal({ id: animalId, species: "Selfie", sex: "female" });

      const result = await concept.setParent({ animal: animalId, parentType: "mother", parent: animalId });
      assertObjectMatch(result, { error: `An animal cannot be its own parent.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  // --- removeParent tests ---
  await t.step("removeParent: should successfully remove a mother from an animal", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:pup:70" as ID;
      const motherId = "animal:dog:mom:71" as ID;

      await concept.registerAnimal({ id: childId, species: "Pup", sex: "female" });
      await concept.registerAnimal({ id: motherId, species: "Dog", sex: "female" });
      await concept.setParent({ animal: childId, parentType: "mother", parent: motherId });

      const result = await concept.removeParent({ animal: childId, parentType: "mother" });

      assertObjectMatch(result, {});
      const fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedChild.animal);
      assertEquals(fetchedChild.animal.mother, UNKNOWN_MOTHER_ID);

      const fetchedMother = (await concept._getAnimal({ id: motherId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedMother.animal);
      assertEquals(fetchedMother.animal.offspring, []);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("removeParent: should successfully remove a father from an animal", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:kitten:72" as ID;
      const fatherId = "animal:cat:dad:73" as ID;

      await concept.registerAnimal({ id: childId, species: "Kitten", sex: "male" });
      await concept.registerAnimal({ id: fatherId, species: "Cat", sex: "male" });
      await concept.setParent({ animal: childId, parentType: "father", parent: fatherId });

      const result = await concept.removeParent({ animal: childId, parentType: "father" });

      assertObjectMatch(result, {});
      const fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedChild.animal);
      assertEquals(fetchedChild.animal.father, UNKNOWN_FATHER_ID);

      const fetchedFather = (await concept._getAnimal({ id: fatherId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedFather.animal);
      assertEquals(fetchedFather.animal.offspring, []);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("removeParent: should return error if child animal does not exist", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const nonExistentChildId = "animal:phantom:child:74" as ID;
      const result = await concept.removeParent({ animal: nonExistentChildId, parentType: "mother" });

      assertObjectMatch(result, { error: `Animal with ID '${nonExistentChildId}' not found.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("removeParent: should return error if animal does not have mother set", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:bear:cub:75" as ID;
      await concept.registerAnimal({ id: childId, species: "Bear", sex: "male", mother: UNKNOWN_MOTHER_ID });

      const result = await concept.removeParent({ animal: childId, parentType: "mother" });

      assertObjectMatch(result, { error: `Animal '${childId}' does not have a mother set.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("removeParent: should return error if animal does not have father set", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:fox:kit:76" as ID;
      await concept.registerAnimal({ id: childId, species: "Fox", sex: "female", father: UNKNOWN_FATHER_ID });

      const result = await concept.removeParent({ animal: childId, parentType: "father" });

      assertObjectMatch(result, { error: `Animal '${childId}' does not have a father set.` });
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("removeParent: should handle gracefully if parent animal is deleted before offspring link is removed", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      const childId = "animal:deer:fawn:77" as ID;
      const motherId = "animal:doe:78" as ID;

      await concept.registerAnimal({ id: childId, species: "Fawn", sex: "female" });
      await concept.registerAnimal({ id: motherId, species: "Doe", sex: "female" });
      await concept.setParent({ animal: childId, parentType: "mother", parent: motherId });

      // Manually delete the mother animal from the collection
      await animalsCollection.deleteOne({ _id: motherId });

      const result = await concept.removeParent({ animal: childId, parentType: "mother" });

      assertObjectMatch(result, {}); // Should still succeed for the child
      const fetchedChild = (await concept._getAnimal({ id: childId})) as { animal: AnimalDocumentTest };
      assertExists(fetchedChild.animal);
      assertEquals(fetchedChild.animal.mother, UNKNOWN_MOTHER_ID);

      // No error expected when trying to remove offspring from a non-existent parent, but a warning might be logged
      // We check that the child's parent link is successfully removed.
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });
});
```
