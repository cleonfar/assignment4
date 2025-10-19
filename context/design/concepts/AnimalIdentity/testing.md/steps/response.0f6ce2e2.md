---
timestamp: 'Fri Oct 17 2025 16:20:14 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_162014.a5675f50.md]]'
content_id: 0f6ce2e2b2066c2580d649e062661046cce70830eea78c460053cd4ac547cdda
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
      const birthDate = new Date("2023-01-15");

      const result = await concept.registerAnimal({
        id: animalId,
        species: "lion",
        sex: "male",
      });

      // Assert that registration was successful and returned the animal ID
      assertObjectMatch(result, { animal: animalId });

      // Verify the animal exists in the database with correct state
      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined);
      const fetchedAnimal = (fetchedAnimalResult as { animal: unknown }).animal as typeof result.animal extends ID ? {
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
      } : never; // This type assertion is a bit hacky, but works for the test scenario

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
      assertEquals(fetchedAnimalResult.error, undefined);
      const fetchedAnimal = (fetchedAnimalResult as { animal: typeof result.animal }).animal as {
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

      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: "zebra",
        sex: "female",
        status: "alive",
        breed: "Plains Zebra",
        notes: "Born in captivity",
        // MongoDB stores Dates as BSON Dates; comparing exact Date objects can be tricky.
        // Convert to ISO string for reliable comparison or compare timestamps.
        birthDate: birthDate,
        mother: motherId,
        father: fatherId,
        offspring: [],
      });
      // Further check for birthDate as it's a Date object
      assertEquals(fetchedAnimal.birthDate?.toISOString(), birthDate.toISOString());
    });

    // --- Test Case 3: Failed registration due to duplicate ID ---
    await t.step("should return an error if an animal with the ID already exists", async () => {
      const animalId = "animal:Duplicate" as ID;
      const birthDate = new Date("2020-01-01");

      // First successful registration
      await concept.registerAnimal({
        id: animalId,
        species: "duplicate_species",
        sex: "male",
        birthDate: birthDate,
      });

      // Attempt to register again with the same ID
      const result = await concept.registerAnimal({
        id: animalId,
        species: "another_species",
        sex: "female",
      });

      // Assert that an error object is returned
      assertObjectMatch(result, { error: `Animal with ID '${animalId}' already exists.` });

      // Verify that the animal's details were NOT changed by the failed attempt
      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      assertEquals(fetchedAnimalResult.error, undefined);
      const fetchedAnimal = (fetchedAnimalResult as { animal: typeof result.animal }).animal as {
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

      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: "duplicate_species", // Should remain the original species
        sex: "male", // Should remain the original sex
        birthDate: birthDate,
      });
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
      assertEquals(fetchedAnimalResult.error, undefined);
      const fetchedAnimal = (fetchedAnimalResult as { animal: typeof result.animal }).animal as {
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

      assertObjectMatch(fetchedAnimal, {
        _id: animalId,
        species: "dog",
        sex: "neutered",
        status: "alive",
      });
    });
  });

  await client.close();
});
```
