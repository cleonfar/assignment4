---
timestamp: 'Sat Nov 01 2025 21:48:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251101_214848.3c1f98c7.md]]'
content_id: 7866b2622d9ae533574aae25ea977aee597c7d9886affee10532c492250d9646
---

# file: src/AnimalIdentity/AnimalIdentityConcept.ts (Updated for Username Context)

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";

// Declare collection prefix, use concept name
const PREFIX = "AnimalIdentity" + ".";

// Generic types of this concept (Animal is an ID, User is now a string for username)
type Animal = ID;
type OwnerUsername = string; // Changed from User = ID to OwnerUsername = string

/**
 * Sex of an animal.
 */
type Sex = "male" | "female" | "neutered";

/**
 * Status of an animal.
 */
type AnimalStatus = "alive" | "sold" | "deceased" | "transferred";

/**
 * @concept AnimalIdentity
 * @purpose allow users to represent and manage their individual animals with persistent identifiers and core attributes
 *
 * @principle a user registers animals to track them individually across their lifecycle;
 *   assigns each animal a unique tag and records identifying details;
 *   updates status to reflect key transitions such as sale, death, or transfer;
 *
 * @state
 *   a set of `Animals` with
 *     an `id` tag of type `ID`
 *     an `owner` of type `String` (referencing the username of the user who registered the animal)
 *     a `species` of type `String`
 *     an optional `breed` of type `String`
 *     a `sex` of type `Enum [male, female, neutered]`
 *     a `status` of type `Enum [alive, sold, deceased, transferred]`
 *     an optional `notes` of type `String`
 *     an optional `birthDate` of type `Date`
 */
interface AnimalDocument {
  _id: ID; // The animal's ID (unique per ownerUsername)
  owner: OwnerUsername; // The username of the user who registered this animal
  species: string;
  breed: string; // Using "" for optional string fields if not provided
  sex: Sex;
  status: AnimalStatus;
  notes: string; // Using "" for optional string fields if not provided
  birthDate: Date | null; // Using null for optional Date fields if not provided
}

export default class AnimalIdentityConcept {
  private animals: Collection<AnimalDocument>;

  constructor(private readonly db: Db) {
    this.animals = this.db.collection(PREFIX + "animals");
    // Ensure a unique index on (_id, owner) composite key, where owner is now username
    this.animals.createIndex({ _id: 1, owner: 1 }, { unique: true });
  }

  /**
   * registerAnimal (ownerUsername: String, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)
   * @requires No animal with this `id` is registered by this `ownerUsername`
   * @effects create a new animal owned by `ownerUsername` with given attributes, status set to alive; returns the animal's ID
   */
  async registerAnimal(
    {
      ownerUsername, // Changed from 'user: User' to 'ownerUsername: OwnerUsername'
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }: {
      ownerUsername: OwnerUsername;
      id: ID;
      species: string;
      sex: Sex;
      birthDate?: Date;
      breed?: string;
      notes?: string;
    },
  ): Promise<{ animal: Animal } | { error: string }> {
    // Precondition: No animal with this ID is registered by this ownerUsername
    const existingAnimal = await this.animals.findOne({ _id: id, owner: ownerUsername });
    if (existingAnimal) {
      return { error: `Animal with ID '${id}' already exists for user '${ownerUsername}'.` };
    }

    const newAnimal: AnimalDocument = {
      _id: id,
      owner: ownerUsername, // Now storing the username directly
      species: species,
      breed: breed ?? "",
      sex: sex,
      status: "alive",
      notes: notes ?? "",
      birthDate: birthDate ?? null,
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
   * updateStatus (ownerUsername: String, animal: Animal, status: Enum, notes: String): Empty
   * @requires an animal with `animal` ID owned by `ownerUsername` exists
   * @effects set the animal’s status to the new value and record optional notes
   */
  async updateStatus(
    { ownerUsername, animal, status, notes }: { ownerUsername: OwnerUsername; animal: Animal; status: AnimalStatus; notes: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `ownerUsername` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: ownerUsername });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${ownerUsername}'.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal, owner: ownerUsername },
        { $set: { status: status, notes: notes } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to update status for animal '${animal}' for user '${ownerUsername}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error updating animal status:", e);
      return { error: "Failed to update animal status due to a database error." };
    }
  }

  /**
   * editDetails (ownerUsername: String, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty
   * @requires an animal with `animal` ID owned by `ownerUsername` exists
   * @effects update the animal’s identifying attributes
   */
  async editDetails(
    { ownerUsername, animal, species, breed, birthDate, sex }: {
      ownerUsername: OwnerUsername;
      animal: Animal;
      species: string;
      breed: string;
      birthDate: Date;
      sex: Sex;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `ownerUsername` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: ownerUsername });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${ownerUsername}'.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal, owner: ownerUsername },
        { $set: { species, breed, birthDate, sex } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to edit details for animal '${animal}' for user '${ownerUsername}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error editing animal details:", e);
      return { error: "Failed to edit animal details due to a database error." };
    }
  }

  /**
   * markAsTransferred (ownerUsername: String, animal: AnimalID, date: Date, recipientNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `ownerUsername` exists, animal's status is alive
   * @effects sets the animal’s status to 'transferred', and records the date and recipient notes in notes.
   */
  async markAsTransferred(
    { ownerUsername, animal, date, recipientNotes }: { ownerUsername: OwnerUsername; animal: Animal; date: Date; recipientNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: ownerUsername });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${ownerUsername}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${ownerUsername}' must be 'alive' to be marked as transferred (current status: ${existingAnimal.status}).` };
    }

    const notes = `Transferred on ${date.toISOString().split("T")[0]}. Recipient notes: ${recipientNotes ?? "None"}.`;
    return this.updateStatus({ ownerUsername, animal, status: "transferred", notes });
  }

  /**
   * markAsDeceased (ownerUsername: String, animal: AnimalID, date: Date, cause?: String): Empty
   * @requires an animal with `animal` ID owned by `ownerUsername` exists, animal's status is alive
   * @effects sets the animal’s status to 'deceased', and records the date and cause in notes.
   */
  async markAsDeceased(
    { ownerUsername, animal, date, cause }: { ownerUsername: OwnerUsername; animal: Animal; date: Date; cause?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: ownerUsername });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${ownerUsername}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${ownerUsername}' must be 'alive' to be marked as deceased (current status: ${existingAnimal.status}).` };
    }

    const notes = `Deceased on ${date.toISOString().split("T")[0]}. Cause: ${cause ?? "unspecified"}.`;
    return this.updateStatus({ ownerUsername, animal, status: "deceased", notes });
  }

  /**
   * markAsSold (ownerUsername: String, animal: AnimalID, date: Date, buyerNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `ownerUsername` exists, animal's status is alive
   * @effects sets the animal’s status to 'sold', and records the date and buyer notes in notes.
   */
  async markAsSold(
    { ownerUsername, animal, date, buyerNotes }: { ownerUsername: OwnerUsername; animal: Animal; date: Date; buyerNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: ownerUsername });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${ownerUsername}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${ownerUsername}' must be 'alive' to be marked as sold (current status: ${existingAnimal.status}).` };
    }

    const notes = `Sold on ${date.toISOString().split("T")[0]}. Buyer notes: ${buyerNotes ?? "None"}.`;
    return this.updateStatus({ ownerUsername, animal, status: "sold", notes });
  }

  /**
   * removeAnimal (ownerUsername: String, animal: AnimalID): Empty
   * @requires an animal with `animal` ID owned by `ownerUsername` exists
   * @effects removes the animal from the set of Animals
   */
  async removeAnimal(
    { ownerUsername, animal }: { ownerUsername: OwnerUsername; animal: Animal },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `ownerUsername` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: ownerUsername });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${ownerUsername}'.` };
    }

    try {
      const result = await this.animals.deleteOne({ _id: animal, owner: ownerUsername });
      if (result.deletedCount === 0) {
        return { error: `Failed to remove animal '${animal}' for user '${ownerUsername}'. It may no longer exist.` };
      }
      return {};
    } catch (e) {
      console.error("Error removing animal:", e);
      return { error: "Failed to remove animal due to a database error." };
    }
  }

  // --- Concept Queries ---

  /**
   * _getAnimal (ownerUsername: String, id: ID): (animal: AnimalDocument)
   * @requires an animal with `id` owned by `ownerUsername` exists
   * @effects returns the animal document for the given ID and owner username
   */
  async _getAnimal(
    { ownerUsername, id }: { ownerUsername: OwnerUsername; id: ID },
  ): Promise<{ animal?: AnimalDocument } | { error: string }> {
    // Precondition: an animal with `id` owned by `ownerUsername` exists (implicitly checked by findOne)
    try {
      const animal = await this.animals.findOne({ _id: id, owner: ownerUsername });
      if (!animal) {
        return { error: `Animal with ID '${id}' not found for user '${ownerUsername}'.` };
      }
      return { animal };
    } catch (e) {
      console.error("Error fetching animal:", e);
      return { error: "Failed to fetch animal due to a database error." };
    }
  }

  /**
   * _getAllAnimals (ownerUsername: String): (animals: AnimalDocument[])
   * @requires true
   * @effects returns a list of all animal documents owned by the `ownerUsername`
   */
  async _getAllAnimals(
    { ownerUsername }: { ownerUsername: OwnerUsername },
  ): Promise<{ animals: AnimalDocument[] } | { error: string }> {
    // Precondition: true (always allowed to query all animals for a user)
    try {
      const allAnimals = await this.animals.find({ owner: ownerUsername }).toArray();
      return { animals: allAnimals };
    } catch (e) {
      console.error("Error fetching all animals for user:", e);
      return { error: "Failed to fetch all animals due to a database error." };
    }
  }
}
```

***

## Synchronization Files (Updated)

The `user_authentication.sync.ts` file remains unchanged as it deals with `UserAuthentication`'s internal `User` IDs and usernames as separate concerns.

The `animal_identity.sync.ts` file is updated to directly use the `username` obtained from `UserAuthentication.verify` for all `AnimalIdentity` actions.
