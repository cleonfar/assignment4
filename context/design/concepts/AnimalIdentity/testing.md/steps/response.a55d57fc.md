---
timestamp: 'Fri Oct 17 2025 16:23:29 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_162329.7e795ac3.md]]'
content_id: a55d57fc515c1adcae84f96856339c718bb020ebae97ec71cf12805ce3d283df
---

# response:

```typescript
// src/AnimalIdentity/AnimalIdentityConcept.test.ts
import { assertEquals, assertObjectMatch } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { UNKNOWN_FATHER_ID, UNKNOWN_MOTHER_ID, ID } from "@utils/types.ts";
import AnimalIdentityConcept from "./AnimalIdentityConcept.ts";

Deno.test("AnimalIdentityConcept", async (t) => {
  const [db, client] = await testDb();
  const concept = new AnimalIdentityConcept(db);

  Deno.test("registerAnimal action", async (t) => {
    // --- Test Case 1: Successful registration with minimum required fields ---
    await t.step("should successfully register an animal with required fields", async () => {
      const animalId = "animal:Leo" as ID;

      const result = await concept.registerAnimal({
        id: animalId,
        species: "lion",
        sex: "male",
      });

      // Assert that registration was successful and returned the animal ID
      assertObjectMatch(result, { animal: animalId });

      // Verify the animal exists in the database with correct state
      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined, `Expected no error, got: ${fetchedAnimalResult.error}`);
      const fetchedAnimal = (fetchedAnimalResult as { animal: Parameters<typeof concept.registerAnimal>[0] & {
        _id: ID;
        status: "alive" | "sold" | "deceased" | "transferred";
        breed: string;
        notes: string;
        birthDate: Date | null;
        mother: ID;
        father: ID;
        offspring: ID[];
      } }).animal;


      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: "lion",
        sex: "male",
        status: "alive", // Default status
        breed: "", // Default for optional string
        notes: "", // Default for optional string
        birthDate: null, // Default for optional Date
        mother: UNKNOWN_MOTHER_ID, // Default for optional ID
        father: UNKNOWN_FATHER_ID, // Default for optional ID
        offspring: [], // Default for offspring set
      });
    });

    // --- Test Case 2: Successful registration with all optional fields ---
    await t.step("should successfully register an animal with all optional fields", async () => {
      const animalId = "animal:Zoe" as ID;
      const birthDate = new Date("2022-05-20");
      const motherId = "animal:Mia" as ID;
      const fatherId = "animal:Max" as ID;

      // Register parents first, as they must exist for setParent later (though registerAnimal doesn't check this)
      // This is good practice for realism, even if registerAnimal doesn't *require* it.
      await concept.registerAnimal({ id: motherId, species: "zebra", sex: "female" });
      await concept.registerAnimal({ id: fatherId, species: "zebra", sex: "male" });

      const result = await concept.registerAnimal({
        id: animalId,
        species: "zebra",
        sex: "female",
        birthDate: birthDate,
        breed: "Plains Zebra",
        mother: motherId,
        father: fatherId,
        notes: "Born in captivity",
      });

      // Assert that registration was successful
      assertObjectMatch(result, { animal: animalId });

      // Verify the animal exists in the database with all fields correctly set
      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined, `Expected no error, got: ${fetchedAnimalResult.error}`);
      const fetchedAnimal = (fetchedAnimalResult as { animal: Parameters<typeof concept.registerAnimal>[0] & {
        _id: ID;
        status: "alive" | "sold" | "deceased" | "transferred";
        breed: string;
        notes: string;
        birthDate: Date | null;
        mother: ID;
        father: ID;
        offspring: ID[];
      } }).animal;

      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: "zebra",
        sex: "female",
        status: "alive",
        breed: "Plains Zebra",
        notes: "Born in captivity",
        mother: motherId,
        father: fatherId,
        offspring: [],
      });
      // Further check for birthDate as it's a Date object
      assertEquals(fetchedAnimal.birthDate?.toISOString(), birthDate.toISOString(), "BirthDate should match provided date");
    });

    // --- Test Case 3: Failed registration due to duplicate ID ---
    await t.step("should return an error if an animal with the ID already exists", async () => {
      const animalId = "animal:Duplicate" as ID;
      const originalBirthDate = new Date("2020-01-01");
      const originalSpecies = "duplicate_species";
      const originalSex = "male";

      // First successful registration
      await concept.registerAnimal({
        id: animalId,
        species: originalSpecies,
        sex: originalSex,
        birthDate: originalBirthDate,
      });

      // Attempt to register again with the same ID
      const result = await concept.registerAnimal({
        id: animalId,
        species: "another_species", // Different species
        sex: "female", // Different sex
      });

      // Assert that an error object is returned
      assertObjectMatch(result, { error: `Animal with ID '${animalId}' already exists.` });

      // Verify that the animal's details were NOT changed by the failed attempt
      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined, `Expected no error, got: ${fetchedAnimalResult.error}`);
      const fetchedAnimal = (fetchedAnimalResult as { animal: Parameters<typeof concept.registerAnimal>[0] & {
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
      } }).animal;


      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: originalSpecies, // Should remain the original species
        sex: originalSex, // Should remain the original sex
        birthDate: originalBirthDate,
        status: "alive",
      });
      assertEquals(fetchedAnimal.birthDate?.toISOString(), originalBirthDate.toISOString());
    });

    // --- Test Case 4: Registration with neutered sex ---
    await t.step("should successfully register an animal with 'neutered' sex", async () => {
      const animalId = "animal:Buddy" as ID;

      const result = await concept.registerAnimal({
        id: animalId,
        species: "dog",
        sex: "neutered",
      });

      assertObjectMatch(result, { animal: animalId });

      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined, `Expected no error, got: ${fetchedAnimalResult.error}`);
      const fetchedAnimal = (fetchedAnimalResult as { animal: Parameters<typeof concept.registerAnimal>[0] & {
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
      } }).animal;

      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: "dog",
        sex: "neutered",
        status: "alive",
      });
    });

    // --- Test Case 5: Registration with optional notes ---
    await t.step("should register an animal with provided notes", async () => {
      const animalId = "animal:Sparky" as ID;
      const notes = "Very playful, likes long walks.";

      const result = await concept.registerAnimal({
        id: animalId,
        species: "dog",
        sex: "male",
        notes: notes,
      });

      assertObjectMatch(result, { animal: animalId });

      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined);
      const fetchedAnimal = (fetchedAnimalResult as { animal: Parameters<typeof concept.registerAnimal>[0] & {
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
      } }).animal;

      assertEquals(fetchedAnimal.notes, notes);
    });
  });

  await client.close();
});
```
