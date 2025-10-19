---
timestamp: 'Fri Oct 17 2025 16:06:22 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_160622.dde1d26e.md]]'
content_id: 566de78c27aa0b26f6cadf0b518880d940abeabd1bab4a648605f2888c0f940f
---

# response:

```typescript
// src/AnimalIdentity/AnimalIdentityConcept.test.ts
import { assertEquals, assertNotEquals, assertExists, assertObjectMatch } from "jsr:@std/assert";
import { Collection, Db, MongoClient } from "npm:mongodb";
import { testDb } from "@utils/database.ts";
import AnimalIdentityConcept from "./AnimalIdentityConcept.ts";
import { ID, UNKNOWN_FATHER_ID, UNKNOWN_MOTHER_ID, Empty } from "@utils/types.ts";

// Helper type for AnimalDocument to avoid re-importing in test file
type AnimalDocument = {
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
};

let db: Db;
let client: MongoClient;
let concept: AnimalIdentityConcept;
let animalsCollection: Collection<AnimalDocument>;

Deno.test("AnimalIdentityConcept", async (t) => {
  // Setup before all tests
  Deno.test.beforeAll(async () => {
    [db, client] = await testDb();
    concept = new AnimalIdentityConcept(db);
    animalsCollection = db.collection("AnimalIdentity.animals");
  });

  // Teardown after all tests
  Deno.test.afterAll(async () => {
    await client.close();
  });

  await t.step("should register an animal successfully", async () => {
    const animalId = "animal:dog1" as ID;
    const species = "Dog";
    const sex = "male";
    const birthDate = new Date("2022-01-01");

    const result = await concept.registerAnimal({
      id: animalId,
      species,
      sex,
      birthDate,
    });

    assertExists((result as { animal: ID }).animal);
    assertEquals((result as { animal: ID }).animal, animalId);

    const storedAnimal = await animalsCollection.findOne({ _id: animalId });
    assertExists(storedAnimal);
    assertObjectMatch(storedAnimal, {
      _id: animalId,
      species: species,
      breed: "", // Default for optional string
      sex: sex,
      status: "alive",
      notes: "", // Default for optional string
      birthDate: birthDate,
      mother: UNKNOWN_MOTHER_ID, // Default for optional ID
      father: UNKNOWN_FATHER_ID, // Default for optional ID
      offspring: [],
    });
  });

  await t.step("should return an error if animal ID already exists during registration", async () => {
    const animalId = "animal:dog1" as ID; // Already registered from previous test

    const result = await concept.registerAnimal({
      id: animalId,
      species: "Cat",
      sex: "female",
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Animal with ID '${animalId}' already exists.`);
  });

  await t.step("should update an animal's status and notes", async () => {
    const animalId = "animal:cat1" as ID;
    await concept.registerAnimal({ id: animalId, species: "Cat", sex: "female" });

    const newStatus = "sold";
    const newNotes = "Sold to a new owner.";
    const result = await concept.updateStatus({
      animal: animalId,
      status: newStatus,
      notes: newNotes,
    });

    assertObjectMatch(result as Empty, {});

    const updatedAnimal = await animalsCollection.findOne({ _id: animalId });
    assertExists(updatedAnimal);
    assertEquals(updatedAnimal.status, newStatus);
    assertEquals(updatedAnimal.notes, newNotes);
  });

  await t.step("should return an error if updating status for a non-existent animal", async () => {
    const nonExistentAnimalId = "animal:zebra1" as ID;
    const result = await concept.updateStatus({
      animal: nonExistentAnimalId,
      status: "deceased",
      notes: "accident",
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Animal with ID '${nonExistentAnimalId}' not found.`);
  });

  await t.step("should edit an animal's details", async () => {
    const animalId = "animal:cow1" as ID;
    await concept.registerAnimal({ id: animalId, species: "Cow", sex: "female", breed: "Holstein" });

    const newSpecies = "Cattle";
    const newBreed = "Jersey";
    const newBirthDate = new Date("2021-05-15");
    const newSex = "neutered";

    const result = await concept.editDetails({
      animal: animalId,
      species: newSpecies,
      breed: newBreed,
      birthDate: newBirthDate,
      sex: newSex,
    });

    assertObjectMatch(result as Empty, {});

    const updatedAnimal = await animalsCollection.findOne({ _id: animalId });
    assertExists(updatedAnimal);
    assertEquals(updatedAnimal.species, newSpecies);
    assertEquals(updatedAnimal.breed, newBreed);
    assertEquals(updatedAnimal.birthDate, newBirthDate);
    assertEquals(updatedAnimal.sex, newSex);
  });

  await t.step("should return an error if editing details for a non-existent animal", async () => {
    const nonExistentAnimalId = "animal:lion1" as ID;
    const result = await concept.editDetails({
      animal: nonExistentAnimalId,
      species: "Lion",
      breed: "African",
      birthDate: new Date(),
      sex: "male",
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Animal with ID '${nonExistentAnimalId}' not found.`);
  });

  await t.step("should mark an animal as transferred", async () => {
    const animalId = "animal:sheep1" as ID;
    await concept.registerAnimal({ id: animalId, species: "Sheep", sex: "female" });
    const transferDate = new Date("2023-03-10");
    const recipientNotes = "Moved to new farm.";

    const result = await concept.markAsTransferred({
      animal: animalId,
      date: transferDate,
      recipientNotes,
    });

    assertObjectMatch(result as Empty, {});

    const updatedAnimal = await animalsCollection.findOne({ _id: animalId });
    assertExists(updatedAnimal);
    assertEquals(updatedAnimal.status, "transferred");
    assertNotEquals(updatedAnimal.notes, ""); // Should contain transfer notes
    assertObjectMatch(updatedAnimal, {
      notes: `Transferred on ${transferDate.toISOString().split("T")[0]}. Recipient notes: ${recipientNotes}.`,
    });
  });

  await t.step("should return an error if marking a non-existent animal as transferred", async () => {
    const nonExistentAnimalId = "animal:giraffe1" as ID;
    const result = await concept.markAsTransferred({
      animal: nonExistentAnimalId,
      date: new Date(),
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Animal with ID '${nonExistentAnimalId}' not found.`);
  });

  await t.step("should return an error if marking a non-alive animal as transferred", async () => {
    const animalId = "animal:pig1" as ID;
    await concept.registerAnimal({ id: animalId, species: "Pig", sex: "male" });
    await concept.updateStatus({ animal: animalId, status: "sold", notes: "previous sale" });

    const result = await concept.markAsTransferred({
      animal: animalId,
      date: new Date(),
    });

    assertExists((result as { error: string }).error);
    assertEquals(
      (result as { error: string }).error,
      `Animal '${animalId}' must be 'alive' to be marked as transferred (current status: sold).`,
    );
  });

  await t.step("should mark an animal as deceased", async () => {
    const animalId = "animal:goat1" as ID;
    await concept.registerAnimal({ id: animalId, species: "Goat", sex: "male" });
    const deathDate = new Date("2023-01-01");
    const cause = "old age";

    const result = await concept.markAsDeceased({
      animal: animalId,
      date: deathDate,
      cause,
    });

    assertObjectMatch(result as Empty, {});

    const updatedAnimal = await animalsCollection.findOne({ _id: animalId });
    assertExists(updatedAnimal);
    assertEquals(updatedAnimal.status, "deceased");
    assertNotEquals(updatedAnimal.notes, ""); // Should contain death notes
    assertObjectMatch(updatedAnimal, {
      notes: `Deceased on ${deathDate.toISOString().split("T")[0]}. Cause: ${cause}.`,
    });
  });

  await t.step("should return an error if marking a non-existent animal as deceased", async () => {
    const nonExistentAnimalId = "animal:elephant1" as ID;
    const result = await concept.markAsDeceased({
      animal: nonExistentAnimalId,
      date: new Date(),
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Animal with ID '${nonExistentAnimalId}' not found.`);
  });

  await t.step("should mark an animal as sold", async () => {
    const animalId = "animal:horse1" as ID;
    await concept.registerAnimal({ id: animalId, species: "Horse", sex: "female" });
    const saleDate = new Date("2023-04-20");
    const buyerNotes = "Sold to a reputable stable.";

    const result = await concept.markAsSold({
      animal: animalId,
      date: saleDate,
      buyerNotes,
    });

    assertObjectMatch(result as Empty, {});

    const updatedAnimal = await animalsCollection.findOne({ _id: animalId });
    assertExists(updatedAnimal);
    assertEquals(updatedAnimal.status, "sold");
    assertNotEquals(updatedAnimal.notes, ""); // Should contain sale notes
    assertObjectMatch(updatedAnimal, {
      notes: `Sold on ${saleDate.toISOString().split("T")[0]}. Buyer notes: ${buyerNotes}.`,
    });
  });

  await t.step("should return an error if marking a non-existent animal as sold", async () => {
    const nonExistentAnimalId = "animal:tiger1" as ID;
    const result = await concept.markAsSold({
      animal: nonExistentAnimalId,
      date: new Date(),
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Animal with ID '${nonExistentAnimalId}' not found.`);
  });

  await t.step("should set a mother for an animal and update offspring", async () => {
    const offspringId = "animal:calf1" as ID;
    const motherId = "animal:cow_mom" as ID;

    await concept.registerAnimal({ id: offspringId, species: "Calf", sex: "female" });
    await concept.registerAnimal({ id: motherId, species: "Cow", sex: "female" });

    const result = await concept.setParent({
      animal: offspringId,
      parentType: "mother",
      parent: motherId,
    });

    assertObjectMatch(result as Empty, {});

    const updatedOffspring = await animalsCollection.findOne({ _id: offspringId });
    const updatedMother = await animalsCollection.findOne({ _id: motherId });

    assertExists(updatedOffspring);
    assertEquals(updatedOffspring.mother, motherId);
    assertEquals(updatedOffspring.father, UNKNOWN_FATHER_ID); // Should remain default

    assertExists(updatedMother);
    assertNotEquals(updatedMother.offspring.indexOf(offspringId), -1); // Offspring should be added
  });

  await t.step("should set a father for an animal and update offspring", async () => {
    const offspringId = "animal:foal1" as ID;
    const fatherId = "animal:horse_dad" as ID;

    await concept.registerAnimal({ id: offspringId, species: "Foal", sex: "male" });
    await concept.registerAnimal({ id: fatherId, species: "Horse", sex: "male" });

    const result = await concept.setParent({
      animal: offspringId,
      parentType: "father",
      parent: fatherId,
    });

    assertObjectMatch(result as Empty, {});

    const updatedOffspring = await animalsCollection.findOne({ _id: offspringId });
    const updatedFather = await animalsCollection.findOne({ _id: fatherId });

    assertExists(updatedOffspring);
    assertEquals(updatedOffspring.father, fatherId);
    assertEquals(updatedOffspring.mother, UNKNOWN_MOTHER_ID); // Should remain default

    assertExists(updatedFather);
    assertNotEquals(updatedFather.offspring.indexOf(offspringId), -1); // Offspring should be added
  });

  await t.step("should return an error if setting parent for a non-existent animal", async () => {
    const nonExistentOffspring = "animal:unknown_baby" as ID;
    const motherId = "animal:cow_mom_2" as ID;
    await concept.registerAnimal({ id: motherId, species: "Cow", sex: "female" });

    const result = await concept.setParent({
      animal: nonExistentOffspring,
      parentType: "mother",
      parent: motherId,
    });

    assertExists((result as { error: string }).error);
    assertEquals(
      (result as { error: string }).error,
      `Animal with ID '${nonExistentOffspring}' not found.`,
    );
  });

  await t.step("should return an error if setting a non-existent parent", async () => {
    const offspringId = "animal:lamb1" as ID;
    const nonExistentFather = "animal:unknown_ram" as ID;
    await concept.registerAnimal({ id: offspringId, species: "Lamb", sex: "female" });

    const result = await concept.setParent({
      animal: offspringId,
      parentType: "father",
      parent: nonExistentFather,
    });

    assertExists((result as { error: string }).error);
    assertEquals(
      (result as { error: string }).error,
      `Parent animal with ID '${nonExistentFather}' not found.`,
    );
  });

  await t.step("should return an error if parent's sex does not match parent type", async () => {
    const offspringId = "animal:chick1" as ID;
    const maleMother = "animal:rooster" as ID;
    await concept.registerAnimal({ id: offspringId, species: "Chick", sex: "female" });
    await concept.registerAnimal({ id: maleMother, species: "Rooster", sex: "male" });

    const result = await concept.setParent({
      animal: offspringId,
      parentType: "mother",
      parent: maleMother,
    });

    assertExists((result as { error: string }).error);
    assertEquals(
      (result as { error: string }).error,
      `Parent '${maleMother}' must be 'female' to be a mother (current sex: male).`,
    );
  });

  await t.step("should return an error if an animal tries to be its own parent", async () => {
    const animalId = "animal:self_parent" as ID;
    await concept.registerAnimal({ id: animalId, species: "Anomaly", sex: "female" });

    const result = await concept.setParent({
      animal: animalId,
      parentType: "mother",
      parent: animalId,
    });

    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `An animal cannot be its own parent.`);
  });

  await t.step("should remove a mother from an animal and update offspring", async () => {
    const offspringId = "animal:kitten1" as ID;
    const motherId = "animal:cat_mom" as ID;

    await concept.registerAnimal({ id: offspringId, species: "Kitten", sex: "male" });
    await concept.registerAnimal({ id: motherId, species: "Cat", sex: "female" });
    await concept.setParent({ animal: offspringId, parentType: "mother", parent: motherId });

    const result = await concept.removeParent({ animal: offspringId, parentType: "mother" });

    assertObjectMatch(result as Empty, {});

    const updatedOffspring = await animalsCollection.findOne({ _id: offspringId });
    const updatedMother = await animalsCollection.findOne({ _id: motherId });

    assertExists(updatedOffspring);
    assertEquals(updatedOffspring.mother, UNKNOWN_MOTHER_ID);

    assertExists(updatedMother);
    assertEquals(updatedMother.offspring.indexOf(offspringId), -1); // Offspring should be removed
  });

  await t.step("should remove a father from an animal and update offspring", async () => {
    const offspringId = "animal:pup1" as ID;
    const fatherId = "animal:dog_dad" as ID;

    await concept.registerAnimal({ id: offspringId, species: "Pup", sex: "female" });
    await concept.registerAnimal({ id: fatherId, species: "Dog", sex: "male" });
    await concept.setParent({ animal: offspringId, parentType: "father", parent: fatherId });

    const result = await concept.removeParent({ animal: offspringId, parentType: "father" });

    assertObjectMatch(result as Empty, {});

    const updatedOffspring = await animalsCollection.findOne({ _id: offspringId });
    const updatedFather = await animalsCollection.findOne({ _id: fatherId });

    assertExists(updatedOffspring);
    assertEquals(updatedOffspring.father, UNKNOWN_FATHER_ID);

    assertExists(updatedFather);
    assertEquals(updatedFather.offspring.indexOf(offspringId), -1); // Offspring should be removed
  });

  await t.step("should return an error if removing parent from a non-existent animal", async () => {
    const nonExistentOffspring = "animal:ghost_baby" as ID;
    const result = await concept.removeParent({
      animal: nonExistentOffspring,
      parentType: "mother",
    });

    assertExists((result as { error: string }).error);
    assertEquals(
      (result as { error: string }).error,
      `Animal with ID '${nonExistentOffspring}' not found.`,
    );
  });

  await t.step("should return an error if removing a parent that is not set", async () => {
    const animalId = "animal:lonely_pup" as ID;
    await concept.registerAnimal({ id: animalId, species: "Pup", sex: "male" });

    const result = await concept.removeParent({
      animal: animalId,
      parentType: "mother",
    });

    assertExists((result as { error: string }).error);
    assertEquals(
      (result as { error: string }).error,
      `Animal '${animalId}' does not have a mother set.`,
    );
  });

  await t.step("should retrieve a single animal using _getAnimal query", async () => {
    const animalId = "animal:query_test" as ID;
    const species = "QueryAnimal";
    await concept.registerAnimal({ id: animalId, species, sex: "female" });

    const queryResult = await concept._getAnimal({ id: animalId });

    assertExists((queryResult as { animal: AnimalDocument }).animal);
    assertEquals(((queryResult as { animal: AnimalDocument }).animal!._id), animalId);
    assertEquals(((queryResult as { animal: AnimalDocument }).animal!.species), species);
  });

  await t.step("should return an error if _getAnimal query for non-existent animal", async () => {
    const nonExistentAnimalId = "animal:no_such_animal" as ID;
    const queryResult = await concept._getAnimal({ id: nonExistentAnimalId });
    assertExists((queryResult as { error: string }).error);
    assertEquals(
      (queryResult as { error: string }).error,
      `Animal with ID '${nonExistentAnimalId}' not found.`,
    );
  });

  await t.step("should retrieve all animals using _getAllAnimals query", async () => {
    await animalsCollection.deleteMany({}); // Clear for this test
    await concept.registerAnimal({ id: "animal:a" as ID, species: "A", sex: "male" });
    await concept.registerAnimal({ id: "animal:b" as ID, species: "B", sex: "female" });

    const queryResult = await concept._getAllAnimals();
    assertExists((queryResult as { animals: AnimalDocument[] }).animals);
    assertEquals(((queryResult as { animals: AnimalDocument[] }).animals).length, 2);
  });

  await t.step("should retrieve offspring using _getOffspring query", async () => {
    const parentId = "animal:parent_offspring" as ID;
    const child1Id = "animal:child1" as ID;
    const child2Id = "animal:child2" as ID;

    await concept.registerAnimal({ id: parentId, species: "Parent", sex: "female" });
    await concept.registerAnimal({ id: child1Id, species: "Child1", sex: "male" });
    await concept.registerAnimal({ id: child2Id, species: "Child2", sex: "female" });

    await concept.setParent({ animal: child1Id, parentType: "mother", parent: parentId });
    await concept.setParent({ animal: child2Id, parentType: "mother", parent: parentId });

    const queryResult = await concept._getOffspring({ parentId });
    assertExists((queryResult as { offspring: AnimalDocument[] }).offspring);
    assertEquals(((queryResult as { offspring: AnimalDocument[] }).offspring).length, 2);
    const offspringIds = ((queryResult as { offspring: AnimalDocument[] }).offspring).map((o) => o._id);
    assertNotEquals(offspringIds.indexOf(child1Id), -1);
    assertNotEquals(offspringIds.indexOf(child2Id), -1);
  });

  await t.step("should return an error if _getOffspring query for non-existent parent", async () => {
    const nonExistentParentId = "animal:no_parent" as ID;
    const queryResult = await concept._getOffspring({ parentId: nonExistentParentId });
    assertExists((queryResult as { error: string }).error);
    assertEquals(
      (queryResult as { error: string }).error,
      `Parent with ID '${nonExistentParentId}' not found.`,
    );
  });

  // # trace: Demonstrating the Principle
  // a user registers animals to track them individually across their lifecycle;
  // assigns each animal a unique tag and records identifying details;
  // updates status to reflect key transitions such as sale, death, or transfer;
  await t.step("Principle Trace: Tracking animals across their lifecycle", async () => {
    await animalsCollection.deleteMany({}); // Clear for principle trace

    // 1. Register initial animals
    const momId = "animal:trace_mom" as ID;
    const dadId = "animal:trace_dad" as ID;
    const kidId = "animal:trace_kid" as ID;
    const oldAnimalId = "animal:trace_oldie" as ID;

    await concept.registerAnimal({
      id: momId,
      species: "Mammal",
      sex: "female",
      birthDate: new Date("2018-01-01"),
      breed: "Mixed",
    });
    await concept.registerAnimal({
      id: dadId,
      species: "Mammal",
      sex: "male",
      birthDate: new Date("2017-06-01"),
      breed: "Mixed",
    });
    await concept.registerAnimal({
      id: kidId,
      species: "Mammal",
      sex: "male",
      birthDate: new Date("2023-03-15"),
      notes: "Young and healthy.",
    });
    await concept.registerAnimal({
      id: oldAnimalId,
      species: "Bird",
      sex: "female",
      birthDate: new Date("2010-01-01"),
      notes: "Getting old.",
    });

    // 2. Assign parents and check initial state
    await concept.setParent({ animal: kidId, parentType: "mother", parent: momId });
    await concept.setParent({ animal: kidId, parentType: "father", parent: dadId });

    let mom = (await concept._getAnimal({ id: momId }) as { animal: AnimalDocument }).animal;
    let dad = (await concept._getAnimal({ id: dadId }) as { animal: AnimalDocument }).animal;
    let kid = (await concept._getAnimal({ id: kidId }) as { animal: AnimalDocument }).animal;
    let oldAnimal = (await concept._getAnimal({ id: oldAnimalId }) as { animal: AnimalDocument }).animal;

    assertExists(mom);
    assertExists(dad);
    assertExists(kid);
    assertExists(oldAnimal);

    assertEquals(kid.mother, momId);
    assertEquals(kid.father, dadId);
    assertEquals(mom.offspring, [kidId]);
    assertEquals(dad.offspring, [kidId]);
    assertEquals(kid.status, "alive");
    assertEquals(oldAnimal.status, "alive");

    // 3. Update details for the kid
    await concept.editDetails({
      animal: kidId,
      species: "Domestic Mammal",
      breed: "Unspecified",
      birthDate: new Date("2023-03-15"), // Same date
      sex: "neutered", // Change sex
    });
    kid = (await concept._getAnimal({ id: kidId }) as { animal: AnimalDocument }).animal;
    assertExists(kid);
    assertEquals(kid.species, "Domestic Mammal");
    assertEquals(kid.sex, "neutered");

    // 4. Update status for key transitions
    // Mark old animal as deceased
    const deathDate = new Date("2024-01-10");
    await concept.markAsDeceased({
      animal: oldAnimalId,
      date: deathDate,
      cause: "Natural causes",
    });
    oldAnimal = (await concept._getAnimal({ id: oldAnimalId }) as { animal: AnimalDocument }).animal;
    assertExists(oldAnimal);
    assertEquals(oldAnimal.status, "deceased");
    assertObjectMatch(oldAnimal, {
      notes: `Deceased on ${deathDate.toISOString().split("T")[0]}. Cause: Natural causes.`,
    });

    // Mark mom as transferred
    const transferDate = new Date("2024-02-15");
    await concept.markAsTransferred({
      animal: momId,
      date: transferDate,
      recipientNotes: "Adopted by new family.",
    });
    mom = (await concept._getAnimal({ id: momId }) as { animal: AnimalDocument }).animal;
    assertExists(mom);
    assertEquals(mom.status, "transferred");
    assertObjectMatch(mom, {
      notes: `Transferred on ${transferDate.toISOString().split("T")[0]}. Recipient notes: Adopted by new family..`,
    });

    // Mark dad as sold
    const saleDate = new Date("2024-03-01");
    await concept.markAsSold({
      animal: dadId,
      date: saleDate,
      buyerNotes: "Bought by a breeder.",
    });
    dad = (await concept._getAnimal({ id: dadId }) as { animal: AnimalDocument }).animal;
    assertExists(dad);
    assertEquals(dad.status, "sold");
    assertObjectMatch(dad, {
      notes: `Sold on ${saleDate.toISOString().split("T")[0]}. Buyer notes: Bought by a breeder..`,
    });

    // The kid remains alive and healthy, still linked to its parents (though parents' status changed)
    kid = (await concept._getAnimal({ id: kidId }) as { animal: AnimalDocument }).animal;
    assertExists(kid);
    assertEquals(kid.status, "alive");
    assertEquals(kid.mother, momId);
    assertEquals(kid.father, dadId);

    // Verify all animals are recorded in the system
    const allAnimalsResult = await concept._getAllAnimals();
    assertExists((allAnimalsResult as { animals: AnimalDocument[] }).animals);
    assertEquals(((allAnimalsResult as { animals: AnimalDocument[] }).animals).length, 4);
  });
});
```
