---
timestamp: 'Fri Oct 17 2025 16:56:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_165635.60bf4fd5.md]]'
content_id: f4f32e5de6a5bd21a9530d4e3d7ff8be584b69baa7c1bd42e17ce526b1fe0e27
---

# response:

Okay, this is getting frustrating, and I completely understand your feeling. When a variable that should be set in `beforeEach` is `undefined` in `t.step` even after all the defensive coding, it often points to a fundamental issue with the test runner's execution context or a very subtle scoping problem.

The error `AssertionError: Failed assertion: Test resources were not initialized by beforeEach or were unexpectedly cleared before a test step.` confirms that `testResources` is indeed `null` when `getTestResources()` is called.

Given the extensive logging and `fail()` checks we've added, the most likely culprits at this stage are:

1. **Deno's `Deno.test` and `t.step` scoping/closure behavior:** While `beforeEach` should ideally set `testResources` for each `t.step`, there might be an implicit context or closure capture that's not working as expected.
2. **An undetected error in `testDb()` or related utilities:** If `testDb()` itself has a flaw that causes it to return a malformed `db` or `client` *without* throwing a synchronously catchable error, then the `concept` constructor would likely fail, and `testResources` wouldn't be fully populated.
3. **Something outside the test block is interfering.** (Highly unlikely for Deno, but theoretically possible).

To finally get to the bottom of this, let's try a common Deno testing pattern that ensures explicit resource passing to each `t.step` by using the `context` parameter, and also add an explicit check for the `testDb()` return.

***

### **1. Update `src/AnimalIdentity/AnimalIdentityConcept.ts` (No changes needed, but ensuring it's the latest debugged version)**

The `AnimalIdentityConcept.ts` file should remain as in the previous response, with the added console logs in its constructor for self-diagnosis.

```typescript
// src/AnimalIdentity/AnimalIdentityConcept.ts
import { Collection, Db } from "npm:mongodb";
import { Empty, ID, UNKNOWN_FATHER_ID, UNKNOWN_MOTHER_ID } from "@utils/types.ts";

// Declare collection prefix, use concept name
const PREFIX = "AnimalIdentity" + ".";

// Generic types of this concept (Animal is an ID)
type Animal = ID;

/**
 * Sex of an animal.
 */
type Sex = "male" | "female" | "neutered";

/**
 * Status of an animal. Added 'transferred' as per actions.
 */
type AnimalStatus = "alive" | "sold" | "deceased" | "transferred";

/**
 * Parent type.
 */
type ParentType = "mother" | "father";

/**
 * @concept AnimalIdentity
 * @purpose represent individual animals with persistent identifiers and core attributes
 *
 * @principle a user registers animals to track them individually across their lifecycle;
 *   assigns each animal a unique tag and records identifying details;
 *   updates status to reflect key transitions such as sale, death, or transfer;
 *
 * @state
 *   a set of `Animals` with
 *     an `id` tag of type `ID`
 *     an optional `breed` of type `String`
 *     a `sex` of type `Enum [male, female, neutered]`
 *     a `status` of type `Enum [alive, sold, deceased, transferred]`
 *     an optional `notes` of type `Strings`
 *     an optional `birthDate` of type `Date`
 *     an optional `mother` of type `ID`
 *     an optional `father` of type `ID`
 *     an optional set of `offspring` of type `(Set of IDs)`
 */
interface AnimalDocument {
  _id: ID; // The concept 'id' is mapped to MongoDB '_id'
  species: string;
  breed: string; // Using "" for optional string fields if not provided
  sex: Sex;
  status: AnimalStatus;
  notes: string; // Using "" for optional string fields if not provided
  birthDate: Date | null; // Using null for optional Date fields if not provided
  mother: ID; // Using UNKNOWN_MOTHER_ID for optional ID
  father: ID; // Using UNKNOWN_FATHER_ID for optional ID
  offspring: ID[]; // Initialized as empty array for a set of IDs
}

export default class AnimalIdentityConcept {
  private animals: Collection<AnimalDocument>;

  constructor(private readonly db: Db) {
    console.log("AnimalIdentityConcept constructor: Started.");
    console.log(`AnimalIdentityConcept constructor: db parameter is ${db ? "defined" : "undefined"}`);
    if (!db) {
      const errorMessage = "Database instance (db) must be provided to AnimalIdentityConcept constructor.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    try {
      this.animals = this.db.collection(PREFIX + "animals");
      console.log("AnimalIdentityConcept constructor: Collection 'animals' initialized successfully.");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`AnimalIdentityConcept constructor: Error initializing collection: ${errorMessage}`, e);
      throw new Error(`Failed to initialize 'animals' collection: ${errorMessage}`);
    }
    console.log("AnimalIdentityConcept constructor: Finished successfully.");
  }

  /**
   * registerAnimal (id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, mother?: ID, father?: ID, notes?: String): (animal: Animal)
   * @requires No animal with this ID is in the set of Animals
   * @effects create a new animal with given attributes, status set to alive
   */
  async registerAnimal(
    {
      id,
      species,
      sex,
      birthDate, // Made optional as per state definition
      breed,
      mother,
      father,
      notes,
    }: {
      id: ID;
      species: string;
      sex: Sex;
      birthDate?: Date;
      breed?: string;
      mother?: ID;
      father?: ID;
      notes?: string;
    },
  ): Promise<{ animal: Animal } | { error: string }> {
    // Precondition: No animal with this ID is in the set of Animals
    const existingAnimal = await this.animals.findOne({ _id: id });
    if (existingAnimal) {
      return { error: `Animal with ID '${id}' already exists.` };
    }

    const newAnimal: AnimalDocument = {
      _id: id,
      species: species,
      breed: breed ?? "", // Use "" for optional string if not provided
      sex: sex,
      status: "alive", // Default status as per effect
      notes: notes ?? "", // Use "" for optional string if not provided
      birthDate: birthDate ?? null, // Use null for optional Date if not provided
      mother: mother ?? UNKNOWN_MOTHER_ID, // Use sentinel for optional ID
      father: father ?? UNKNOWN_FATHER_ID, // Use sentinel for optional ID
      offspring: [], // Initialize as empty array
    };

    try {
      await this.animals.insertOne(newAnimal);
      return { animal: newAnimal._id };
    } catch (e) {
      console.error("Error registering animal:", e);
      return { error: "Failed to register animal due to a database error." };
    }
  }

  /**
   * updateStatus (animal: Animal, status: Enum, notes: String)
   * @requires animal exists
   * @effects set the animal’s status to the new value and record optional notes
   */
  async updateStatus(
    { animal, status, notes }: { animal: Animal; status: AnimalStatus; notes: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal },
        { $set: { status: status, notes: notes } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to update status for animal '${animal}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error updating animal status:", e);
      return { error: "Failed to update animal status due to a database error." };
    }
  }

  /**
   * editDetails (animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum)
   * @requires animal exists
   * @effects update the animal’s identifying attributes
   */
  async editDetails(
    { animal, species, breed, birthDate, sex }: {
      animal: Animal;
      species: string;
      breed: string;
      birthDate: Date;
      sex: Sex;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal },
        { $set: { species, breed, birthDate, sex } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to edit details for animal '${animal}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error editing animal details:", e);
      return { error: "Failed to edit animal details due to a database error." };
    }
  }

  /**
   * markAsTransferred (animal: AnimalID, date: Date, recipientNotes?: String): Empty
   * @requires animal exists, animal's status is alive
   * @effects sets the animal’s status to 'transferred', and records the date and recipient notes in notes.
   */
  async markAsTransferred(
    { animal, date, recipientNotes }: { animal: Animal; date: Date; recipientNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' must be 'alive' to be marked as transferred (current status: ${existingAnimal.status}).` };
    }

    const notes = `Transferred on ${date.toISOString().split("T")[0]}. Recipient notes: ${recipientNotes ?? "None"}.`;
    return this.updateStatus({ animal, status: "transferred", notes });
  }

  /**
   * markAsDeceased (animal: AnimalID, date: Date, cause?: String): Empty
   * @requires animal exists, animal's status is alive
   * @effects sets the animal’s status to 'deceased', and records the date and cause in notes.
   */
  async markAsDeceased(
    { animal, date, cause }: { animal: Animal; date: Date; cause?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' must be 'alive' to be marked as deceased (current status: ${existingAnimal.status}).` };
    }

    const notes = `Deceased on ${date.toISOString().split("T")[0]}. Cause: ${cause ?? "unspecified"}.`;
    return this.updateStatus({ animal, status: "deceased", notes });
  }

  /**
   * markAsSold (animal: AnimalID, date: Date, buyerNotes?: String): Empty
   * @requires animal exists, animal's status is alive
   * @effects sets the animal’s status to 'sold', and records the date and buyer notes in notes.
   */
  async markAsSold(
    { animal, date, buyerNotes }: { animal: Animal; date: Date; buyerNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' must be 'alive' to be marked as sold (current status: ${existingAnimal.status}).` };
    }

    const notes = `Sold on ${date.toISOString().split("T")[0]}. Buyer notes: ${buyerNotes ?? "None"}.`;
    return this.updateStatus({ animal, status: "sold", notes });
  }

  /**
   * setParent (animal: AnimalID, parentType: Enum[mother, father], parent: AnimalID): Empty
   * @requires animal exists, parent exists, parent's sex matches parentType, parent is not animal, no circular relationship would be created
   * @effects links animal to parent (as mother or father), and adds animal to parent's offspring set.
   */
  async setParent(
    { animal, parentType, parent }: { animal: Animal; parentType: ParentType; parent: Animal },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    // Precondition: parent exists
    const existingParent = await this.animals.findOne({ _id: parent });
    if (!existingParent) {
      return { error: `Parent animal with ID '${parent}' not found.` };
    }

    // Precondition: parent's sex matches parentType
    if (parentType === "mother" && existingParent.sex !== "female") {
      return { error: `Parent '${parent}' must be 'female' to be a mother (current sex: ${existingParent.sex}).` };
    }
    if (parentType === "father" && existingParent.sex !== "male") {
      return { error: `Parent '${parent}' must be 'male' to be a father (current sex: ${existingParent.sex}).` };
    }

    // Precondition: parent is not animal
    if (animal === parent) {
      return { error: `An animal cannot be its own parent.` };
    }

    // Precondition: no circular relationship would be created
    // A full circular check requires graph traversal (e.g., checking if parent is an ancestor of animal).
    // For this implementation, we will perform a basic check that 'parent' is not 'animal'.
    // More complex checks would typically be handled in a dedicated graph utility.

    try {
      // Effect: Link animal to parent (as mother or father)
      const updateFields: Partial<AnimalDocument> = {};
      if (parentType === "mother") {
        updateFields.mother = parent;
      } else {
        updateFields.father = parent;
      }

      const animalUpdateResult = await this.animals.updateOne(
        { _id: animal },
        { $set: updateFields },
      );
      if (animalUpdateResult.matchedCount === 0) {
        return { error: `Failed to set ${parentType} for animal '${animal}'.` };
      }

      // Effect: Add animal to parent's offspring set (using $addToSet to ensure uniqueness)
      const parentUpdateResult = await this.animals.updateOne(
        { _id: parent },
        { $addToSet: { offspring: animal } },
      );
      if (parentUpdateResult.matchedCount === 0) {
        console.warn(`Failed to add animal '${animal}' to offspring of parent '${parent}'. This might indicate a data inconsistency.`);
      }
      return {};
    } catch (e) {
      console.error("Error setting parent for animal:", e);
      return { error: "Failed to set parent due to a database error." };
    }
  }

  /**
   * removeParent (animal: AnimalID, parentType: Enum[mother, father]): Empty
   * @requires animal exists, animal has parentType set
   * @effects unlinks animal from specified parent, and removes animal from parent's offspring set.
   */
  async removeParent(
    { animal, parentType }: { animal: Animal; parentType: ParentType },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    // Precondition: animal has parentType set
    const currentParentId = parentType === "mother" ? existingAnimal.mother : existingAnimal.father;
    const unknownParentSentinel = parentType === "mother" ? UNKNOWN_MOTHER_ID : UNKNOWN_FATHER_ID;

    if (currentParentId === unknownParentSentinel) {
      return { error: `Animal '${animal}' does not have a ${parentType} set.` };
    }

    // Store parent ID for later use in removing offspring link
    const parentAnimalId = currentParentId;

    try {
      // Effect: Unlink animal from specified parent
      const updateFields: Partial<AnimalDocument> = {};
      if (parentType === "mother") {
        updateFields.mother = UNKNOWN_MOTHER_ID;
      } else {
        updateFields.father = UNKNOWN_FATHER_ID;
      }

      const animalUpdateResult = await this.animals.updateOne(
        { _id: animal },
        { $set: updateFields },
      );
      if (animalUpdateResult.matchedCount === 0) {
        return { error: `Failed to remove ${parentType} for animal '${animal}'.` };
      }

      // Effect: Remove animal from parent's offspring set
      // Only attempt if the parent still exists in the database.
      const existingParent = await this.animals.findOne({ _id: parentAnimalId });
      if (existingParent) {
        const parentUpdateResult = await this.animals.updateOne(
          { _id: parentAnimalId },
          { $pull: { offspring: animal } },
        );
        if (parentUpdateResult.matchedCount === 0) {
          console.warn(`Failed to remove animal '${animal}' from offspring of parent '${parentAnimalId}'. This might indicate a data inconsistency or that the offspring link was already absent.`);
        }
      } else {
        console.warn(`Parent '${parentAnimalId}' not found when trying to remove offspring '${animal}'. Parent may have been deleted.`);
      }

      return {};
    } catch (e) {
      console.error("Error removing parent for animal:", e);
      return { error: "Failed to remove parent due to a database error." };
    }
  }

  // --- Concept Queries ---

  /**
   * _getAnimal (id: ID): (animal: AnimalDocument)
   * @effects return the animal document for the given ID
   */
  async _getAnimal({ id }: { id: ID }): Promise<{ animal?: AnimalDocument } | { error: string }> {
    try {
      const animal = await this.animals.findOne({ _id: id });
      if (!animal) {
        return { error: `Animal with ID '${id}' not found.` };
      }
      return { animal };
    } catch (e) {
      console.error("Error fetching animal:", e);
      return { error: "Failed to fetch animal due to a database error." };
    }
  }

  /**
   * _getAllAnimals (): (animals: AnimalDocument[])
   * @effects return all animal documents
   */
  async _getAllAnimals(): Promise<{ animals: AnimalDocument[] } | { error: string }> {
    try {
      const allAnimals = await this.animals.find({}).toArray();
      return { animals: allAnimals };
    } catch (e) {
      console.error("Error fetching all animals:", e);
      return { error: "Failed to fetch all animals due to a database error." };
    }
  }

  /**
   * _getOffspring (parentId: ID): (offspring: AnimalDocument[])
   * @effects return the offspring animal documents for a given parent ID
   */
  async _getOffspring(
    { parentId }: { parentId: ID },
  ): Promise<{ offspring: AnimalDocument[] } | { error: string }> {
    try {
      const parent = await this.animals.findOne({ _id: parentId });
      if (!parent) {
        return { error: `Parent with ID '${parentId}' not found.` };
      }
      const offspringAnimals = await this.animals.find({ _id: { $in: parent.offspring } }).toArray();
      return { offspring: offspringAnimals };
    } catch (e) {
      console.error("Error fetching offspring:", e);
      return { error: "Failed to fetch offspring due to a database error." };
    }
  }
}
```

***

### **2. Update `src/AnimalIdentity/AnimalIdentityConcept.test.ts` (Major Refactor)**

This version explicitly passes the `concept` (and other resources) into each `t.step` function's context, rather than relying on a shared `let` variable from the parent scope. This is a more robust pattern for Deno testing, especially with complex setups.

```typescript
// src/AnimalIdentity/AnimalIdentityConcept.test.ts
import { Collection, Db } from "npm:mongodb";
import { assertEquals, assertExists, assertObjectMatch, fail } from "jsr:@std/assert";
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

Deno.test("AnimalIdentityConcept: registerAnimal action", async (t) => {
  // Use a context object that will be initialized once and then passed to each t.step.
  // This helps avoid subtle scoping/closure issues with `let` variables.
  let sharedTestContext: TestContext | null = null;
  let setupFailed = false; // Flag to indicate if beforeEach failed

  // This beforeEach will run ONCE for the main Deno.test block,
  // NOT before each t.step, due to how Deno handles hooks for nested steps.
  // We need to manage resources for each t.step independently OR initialize
  // them within each t.step if beforeEach/afterEach aren't behaving predictably.

  // Let's adapt to the standard Deno pattern where beforeEach/afterEach *do* run for each t.step.
  // The previous setup with `testResources` was actually the correct approach for `beforeEach` per t.step.
  // The failure suggests a more fundamental problem with `testDb()` or the constructor.

  // Let's revert to the previous `testResources` pattern, but add one final check:
  // Is `testDb()` potentially returning undefined `db` or `client` *before* the destructuring?
  // And confirm `Deno.test.beforeAll` is not being used to drop DB globally but per test suite.

  // Re-confirming the typical structure for Deno.test with beforeEach on inner t.steps:
  // `Deno.test("parent", async (t) => { t.beforeEach(...) t.step(...) })`
  // The logs indicate that `beforeEach` *is* running for each step.
  // The error `Failed assertion: Test resources were not initialized...`
  // means `testResources` is `null` when `getTestResources` is called.
  // This implies `testResources = {...}` in `beforeEach` is not being retained or is being overwritten.

  // This is highly suspicious. Let's try passing arguments to t.step if available.
  // This is a common workaround for weird closure issues.

  // Re-introducing the `testResources` but as a return from a setup function.
  // This makes the resource allocation more explicit per step.

  const setupTestContext = async (): Promise<TestContext> => {
    console.log("\n--- setupTestContext START ---");
    const [db_inner, client_inner] = await testDb();
    
    console.log(`setupTestContext: db_inner is ${db_inner ? "defined" : "undefined"}`);
    if (!db_inner) {
      console.error("setupTestContext: testDb() returned an undefined database. Check MongoDB connection details (e.g., .env file).");
      await client_inner?.close();
      fail("Failed to get a valid database instance from testDb().");
    }

    let concept_inner: AnimalIdentityConcept | undefined;
    try {
      console.log("setupTestContext: Attempting to create AnimalIdentityConcept instance...");
      concept_inner = new AnimalIdentityConcept(db_inner);
      console.log("setupTestContext: AnimalIdentityConcept instance created successfully.");
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
    console.log(`setupTestContext: context.concept is ${context.concept ? "defined" : "undefined"}`);
    console.log("--- setupTestContext END ---\n");
    return context;
  };

  const teardownTestContext = async (context: TestContext) => {
    console.log("--- teardownTestContext START ---");
    if (context && context.client) {
      console.log("teardownTestContext: Closing MongoDB client.");
      await context.client.close();
    }
    console.log("--- teardownTestContext END ---\n");
  };

  // Now, each t.step will explicitly run its own setup and teardown
  // This is the most reliable way to ensure independent contexts per step.
  // This essentially makes each t.step self-contained, rather than relying on global `beforeEach`/`afterEach`
  // that might have subtle interactions with nested t.steps.

  await t.step("should successfully register an animal with all fields provided", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      console.log("t.step 'all fields': Executing. concept is", concept ? "defined" : "undefined");
      
      const animalId = "animal:dog:1" as ID;
      const species = "Dog";
      const sex = "male";
      const birthDate = new Date("2022-01-15");
      const breed = "Golden Retriever";
      const motherId = "animal:dog:mother" as ID;
      const fatherId = "animal:dog:father" as ID;
      const notes = "Friendly and energetic.";

      // Register a mock mother and father first for parent IDs to be valid in the system
      const motherResult = await concept.registerAnimal({ id: motherId, species: "Dog", sex: "female" });
      if ('error' in motherResult) fail(`Failed to register mother: ${motherResult.error}`);
      const fatherResult = await concept.registerAnimal({ id: fatherId, species: "Dog", sex: "male" });
      if ('error' in fatherResult) fail(`Failed to register father: ${fatherResult.error}`);

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
      if ('error' in fetchedAnimalResult) {
        fail(`Failed to fetch animal: ${fetchedAnimalResult.error}`);
      }
      const fetchedAnimal = fetchedAnimalResult.animal; 

      assertExists(fetchedAnimal); // Make sure it's not undefined/null before accessing properties
      assertEquals(fetchedAnimal._id, animalId);
      assertEquals(fetchedAnimal.species, species);
      assertEquals(fetchedAnimal.sex, sex);
      assertEquals(fetchedAnimal.birthDate?.toISOString(), birthDate.toISOString()); // Compare ISO strings for Date objects
      assertEquals(fetchedAnimal.breed, breed);
      assertEquals(fetchedAnimal.mother, motherId);
      assertEquals(fetchedAnimal.father, fatherId);
      assertEquals(fetchedAnimal.notes, notes);
      assertEquals(fetchedAnimal.status, "alive");
      assertEquals(fetchedAnimal.offspring, []);

      const count = await animalsCollection.countDocuments({ _id: animalId });
      assertEquals(count, 1);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] }); // Pass collected resources
    }
  });

  await t.step("should successfully register an animal with only required fields", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      console.log("t.step 'required fields': Executing. concept is", concept ? "defined" : "undefined");
      
      const animalId = "animal:cat:2" as ID;
      const species = "Cat";
      const sex = "female";

      const result = await concept.registerAnimal({ id: animalId, species, sex });

      assertObjectMatch(result, { animal: animalId });
      assertExists((result as { animal: ID }).animal);
      assertEquals((result as { animal: ID }).animal, animalId);

      const fetchedAnimalResult = await concept._getAnimal({ id: animalId });
      if ('error' in fetchedAnimalResult) {
        fail(`Failed to fetch animal: ${fetchedAnimalResult.error}`);
      }
      const fetchedAnimal = fetchedAnimalResult.animal;

      assertExists(fetchedAnimal);
      assertEquals(fetchedAnimal._id, animalId);
      assertEquals(fetchedAnimal.species, species);
      assertEquals(fetchedAnimal.sex, sex);
      assertEquals(fetchedAnimal.birthDate, null); // Default for optional Date
      assertEquals(fetchedAnimal.breed, ""); // Default for optional string
      assertEquals(fetchedAnimal.mother, UNKNOWN_MOTHER_ID); // Default for optional ID
      assertEquals(fetchedAnimal.father, UNKNOWN_FATHER_ID); // Default for optional ID
      assertEquals(fetchedAnimal.notes, ""); // Default for optional string
      assertEquals(fetchedAnimal.status, "alive"); // Default status
      assertEquals(fetchedAnimal.offspring, []); // Default empty array

      const count = await animalsCollection.countDocuments({ _id: animalId });
      assertEquals(count, 1);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("should return an error when registering an animal with an existing ID", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      console.log("t.step 'existing ID': Executing. concept is", concept ? "defined" : "undefined");
      
      const animalId = "animal:bird:3" as ID;
      const registerSuccess = await concept.registerAnimal({ id: animalId, species: "Bird", sex: "male" });
      if ('error' in registerSuccess) fail(`Initial registration failed: ${registerSuccess.error}`);

      const result = await concept.registerAnimal({ id: animalId, species: "Bird", sex: "female" });

      assertObjectMatch(result, { error: `Animal with ID '${animalId}' already exists.` });
      assertExists((result as { error: string }).error);

      const count = await animalsCollection.countDocuments({ _id: animalId });
      assertEquals(count, 1, "Only one animal should be in the collection with this ID");
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("should allow passing UNKNOWN_MOTHER_ID/UNKNOWN_FATHER_ID explicitly", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      console.log("t.step 'unknown parents': Executing. concept is", concept ? "defined" : "undefined");
      
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
      if ('error' in fetchedAnimalResult) {
        fail(`Failed to fetch animal: ${fetchedAnimalResult.error}`);
      }
      const fetchedAnimal = fetchedAnimalResult.animal;

      assertExists(fetchedAnimal);
      assertEquals(fetchedAnimal.mother, UNKNOWN_MOTHER_ID);
      assertEquals(fetchedAnimal.father, UNKNOWN_FATHER_ID);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });

  await t.step("should register multiple animals successfully", async () => {
    const { concept, animalsCollection, client } = await setupTestContext();
    try {
      console.log("t.step 'multiple animals': Executing. concept is", concept ? "defined" : "undefined");
      
      const animal1Id = "animal:sheep:1" as ID;
      const animal2Id = "animal:sheep:2" as ID;

      const result1 = await concept.registerAnimal({ id: animal1Id, species: "Sheep", sex: "female" });
      const result2 = await concept.registerAnimal({ id: animal2Id, species: "Sheep", sex: "male" });

      assertObjectMatch(result1, { animal: animal1Id });
      assertObjectMatch(result2, { animal: animal2Id });

      const fetchedAnimal1Result = await concept._getAnimal({ id: animal1Id });
      if ('error' in fetchedAnimal1Result) fail(`Failed to fetch animal 1: ${fetchedAnimal1Result.error}`);
      const fetchedAnimal1 = fetchedAnimal1Result.animal;
      assertExists(fetchedAnimal1);
      assertEquals(fetchedAnimal1._id, animal1Id);

      const fetchedAnimal2Result = await concept._getAnimal({ id: animal2Id });
      if ('error' in fetchedAnimal2Result) fail(`Failed to fetch animal 2: ${fetchedAnimal2Result.error}`);
      const fetchedAnimal2 = fetchedAnimal2Result.animal;
      assertExists(fetchedAnimal2);
      assertEquals(fetchedAnimal2._id, animal2Id);

      const count = await animalsCollection.countDocuments({});
      assertEquals(count, 2);
    } finally {
      await teardownTestContext({ concept, animalsCollection, client, db: concept["db"] });
    }
  });
});
```

**Key Changes and Why:**

1. **Removed `beforeEach` and `afterEach` from the `Deno.test` block:** Instead of relying on Deno's implicit hook execution, each `t.step` is now fully self-contained.
2. **`setupTestContext()` and `teardownTestContext()` functions:**
   * `setupTestContext()` is an `async` function that encapsulates all the setup logic (getting `db`, initializing `concept`, getting `animalsCollection`). It returns a `Promise<TestContext>`.
   * `teardownTestContext()` handles cleanup (closing the MongoDB client).
3. **Explicit `await setupTestContext()` in each `t.step`:** At the very beginning of each `t.step`, `setupTestContext()` is explicitly called and awaited. This guarantees that `concept`, `animalsCollection`, and `client` are available and freshly initialized *for that specific test step*.
4. **`try...finally` block in each `t.step`:** This ensures that `teardownTestContext()` is always called to clean up resources, even if the test fails.
5. **Passing `db: concept["db"]`:** The `db` property on the `AnimalIdentityConcept` instance is `private readonly db: Db`, so we need to access it using bracket notation `concept["db"]` to pass it to `teardownTestContext`. This ensures the correct `db` instance associated with the `concept` is used for cleanup.

**What to look for now:**

When you run the tests, you should see `--- setupTestContext START ---` and `--- setupTestContext END ---` logs for *each* `t.step`. If these logs show successful initialization (especially `context.concept is defined`), then your `concept` instance should finally be properly available within each test. If `setupTestContext` *still* fails, the problem lies squarely within `testDb()` or the `AnimalIdentityConcept` constructor itself, and the logs from within those functions will provide the precise error.
