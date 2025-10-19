---
timestamp: 'Fri Oct 17 2025 16:28:01 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_162801.5e795f3d.md]]'
content_id: d1b13587d8b3fe74d3a78db594d9468d99897c30c90c85c7abe677f8bc8b3d7d
---

# response:

```typescript
// src/AnimalIdentity/AnimalIdentityConcept.test.ts
import { Collection, Db } from "npm:mongodb";
import { assertEquals, assertExists, assertNotEquals, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID, UNKNOWN_FATHER_ID, UNKNOWN_MOTHER_ID } from "@utils/types.ts";
import AnimalIdentityConcept from "./AnimalIdentityConcept.ts"; // Adjust path as necessary

Deno.test("AnimalIdentityConcept: registerAnimal action", async (t) => {
  let db: Db;
  let client: any; // MongoClient type is not directly exported, using any for simplicity
  let concept: AnimalIdentityConcept;
  let animalsCollection: Collection;

  Deno.test.beforeEach(async () => {
    [db, client] = await testDb();
    concept = new AnimalIdentityConcept(db);
    animalsCollection = db.collection("AnimalIdentity.animals"); // Access the collection directly for verification
  });

  Deno.test.afterEach(async () => {
    await client.close();
  });

  await t.step("should successfully register an animal with all fields provided", async () => {
    const animalId = "animal:dog:1" as ID;
    const species = "Dog";
    const sex = "male";
    const birthDate = new Date("2022-01-15");
    const breed = "Golden Retriever";
    const motherId = "animal:dog:mother" as ID;
    const fatherId = "animal:dog:father" as ID;
    const notes = "Friendly and energetic.";

    // Register a mock mother and father first for parent IDs to be valid in the system (though concept design only needs ID, not existence for `registerAnimal`)
    // For setParent, existence is checked, but registerAnimal merely stores the ID.
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
    assertExists((result as { animal: ID }).animal);
    assertEquals((result as { animal: ID }).animal, animalId);

    const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
    assertExists(fetchedAnimalResult.animal);
    assertEquals(fetchedAnimalResult.animal._id, animalId);
    assertEquals(fetchedAnimalResult.animal.species, species);
    assertEquals(fetchedAnimalResult.animal.sex, sex);
    assertEquals(fetchedAnimalResult.animal.birthDate, birthDate);
    assertEquals(fetchedAnimalResult.animal.breed, breed);
    assertEquals(fetchedAnimalResult.animal.mother, motherId);
    assertEquals(fetchedAnimalResult.animal.father, fatherId);
    assertEquals(fetchedAnimalResult.animal.notes, notes);
    assertEquals(fetchedAnimalResult.animal.status, "alive");
    assertEquals(fetchedAnimalResult.animal.offspring, []);

    const count = await animalsCollection.countDocuments({ _id: animalId });
    assertEquals(count, 1);
  });

  await t.step("should successfully register an animal with only required fields", async () => {
    const animalId = "animal:cat:2" as ID;
    const species = "Cat";
    const sex = "female";

    const result = await concept.registerAnimal({ id: animalId, species, sex });

    assertObjectMatch(result, { animal: animalId });
    assertExists((result as { animal: ID }).animal);
    assertEquals((result as { animal: ID }).animal, animalId);

    const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
    assertExists(fetchedAnimalResult.animal);
    assertEquals(fetchedAnimalResult.animal._id, animalId);
    assertEquals(fetchedAnimalResult.animal.species, species);
    assertEquals(fetchedAnimalResult.animal.sex, sex);
    assertEquals(fetchedAnimalResult.animal.birthDate, null); // Default for optional Date
    assertEquals(fetchedAnimalResult.animal.breed, ""); // Default for optional string
    assertEquals(fetchedAnimalResult.animal.mother, UNKNOWN_MOTHER_ID); // Default for optional ID
    assertEquals(fetchedAnimalResult.animal.father, UNKNOWN_FATHER_ID); // Default for optional ID
    assertEquals(fetchedAnimalResult.animal.notes, ""); // Default for optional string
    assertEquals(fetchedAnimalResult.animal.status, "alive"); // Default status
    assertEquals(fetchedAnimalResult.animal.offspring, []); // Default empty array

    const count = await animalsCollection.countDocuments({ _id: animalId });
    assertEquals(count, 1);
  });

  await t.step("should return an error when registering an animal with an existing ID", async () => {
    const animalId = "animal:bird:3" as ID;
    await concept.registerAnimal({ id: animalId, species: "Bird", sex: "male" });

    const result = await concept.registerAnimal({ id: animalId, species: "Bird", sex: "female" });

    assertObjectMatch(result, { error: `Animal with ID '${animalId}' already exists.` });
    assertExists((result as { error: string }).error);

    const count = await animalsCollection.countDocuments({ _id: animalId });
    assertEquals(count, 1, "Only one animal should be in the collection with this ID");
  });

  await t.step("should allow passing UNKNOWN_MOTHER_ID/UNKNOWN_FATHER_ID explicitly", async () => {
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
    const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
    assertExists(fetchedAnimalResult.animal);
    assertEquals(fetchedAnimalResult.animal.mother, UNKNOWN_MOTHER_ID);
    assertEquals(fetchedAnimalResult.animal.father, UNKNOWN_FATHER_ID);
  });

  await t.step("should register multiple animals successfully", async () => {
    const animal1Id = "animal:sheep:1" as ID;
    const animal2Id = "animal:sheep:2" as ID;

    const result1 = await concept.registerAnimal({ id: animal1Id, species: "Sheep", sex: "female" });
    const result2 = await concept.registerAnimal({ id: animal2Id, species: "Sheep", sex: "male" });

    assertObjectMatch(result1, { animal: animal1Id });
    assertObjectMatch(result2, { animal: animal2Id });

    const fetchedAnimal1 = await concept._getAnimal({ id: animal1Id });
    assertExists(fetchedAnimal1.animal);
    assertEquals(fetchedAnimal1.animal._id, animal1Id);

    const fetchedAnimal2 = await concept._getAnimal({ id: animal2Id });
    assertExists(fetchedAnimal2.animal);
    assertEquals(fetchedAnimal2.animal._id, animal2Id);

    const count = await animalsCollection.countDocuments({});
    assertEquals(count, 2);
  });
});
```
