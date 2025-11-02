# file: src/AnimalIdentity/AnimalIdentityConcept.ts (Updated with User Scope)

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";

// Declare collection prefix, use concept name
const PREFIX = "AnimalIdentity" + ".";

// Generic types of this concept (Animal and User are IDs)
type Animal = ID;
type User = ID; // New type for the user ID

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
 *     an `owner` of type `ID` (referencing the user who registered the animal)
 *     a `species` of type `String`
 *     an optional `breed` of type `String`
 *     a `sex` of type `Enum [male, female, neutered]`
 *     a `status` of type `Enum [alive, sold, deceased, transferred]`
 *     an optional `notes` of type `String`
 *     an optional `birthDate` of type `Date`
 */
interface AnimalDocument {
  _id: ID; // The animal's ID (unique per user)
  owner: User; // The ID of the user who registered this animal
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
    // Ensure a unique index on (_id, owner) composite key
    this.animals.createIndex({ _id: 1, owner: 1 }, { unique: true });
  }

  /**
   * registerAnimal (user: ID, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)
   * @requires No animal with this `id` is registered by this `user`
   * @effects create a new animal owned by `user` with given attributes, status set to alive; returns the animal's ID
   */
  async registerAnimal(
    {
      user, // New: User ID
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }: {
      user: User; // New: User ID
      id: ID;
      species: string;
      sex: Sex;
      birthDate?: Date;
      breed?: string;
      notes?: string;
    },
  ): Promise<{ animal: Animal } | { error: string }> {
    // Precondition: No animal with this ID is registered by this user
    const existingAnimal = await this.animals.findOne({ _id: id, owner: user });
    if (existingAnimal) {
      return { error: `Animal with ID '${id}' already exists for user '${user}'.` };
    }

    const newAnimal: AnimalDocument = {
      _id: id,
      owner: user, // New: Associate animal with the registering user
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
   * updateStatus (user: ID, animal: Animal, status: Enum, notes: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects set the animal’s status to the new value and record optional notes
   */
  async updateStatus(
    { user, animal, status, notes }: { user: User; animal: Animal; status: AnimalStatus; notes: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal, owner: user },
        { $set: { status: status, notes: notes } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to update status for animal '${animal}' for user '${user}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error updating animal status:", e);
      return { error: "Failed to update animal status due to a database error." };
    }
  }

  /**
   * editDetails (user: ID, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects update the animal’s identifying attributes
   */
  async editDetails(
    { user, animal, species, breed, birthDate, sex }: {
      user: User; // New: User ID
      animal: Animal;
      species: string;
      breed: string;
      birthDate: Date;
      sex: Sex;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }

    try {
      const result = await this.animals.updateOne(
        { _id: animal, owner: user },
        { $set: { species, breed, birthDate, sex } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to edit details for animal '${animal}' for user '${user}'.` };
      }
      return {};
    } catch (e) {
      console.error("Error editing animal details:", e);
      return { error: "Failed to edit animal details due to a database error." };
    }
  }

  /**
   * markAsTransferred (user: ID, animal: AnimalID, date: Date, recipientNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'transferred', and records the date and recipient notes in notes.
   */
  async markAsTransferred(
    { user, animal, date, recipientNotes }: { user: User; animal: Animal; date: Date; recipientNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${user}' must be 'alive' to be marked as transferred (current status: ${existingAnimal.status}).` };
    }

    const notes = `Transferred on ${date.toISOString().split("T")[0]}. Recipient notes: ${recipientNotes ?? "None"}.`;
    return this.updateStatus({ user, animal, status: "transferred", notes });
  }

  /**
   * markAsDeceased (user: ID, animal: AnimalID, date: Date, cause?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'deceased', and records the date and cause in notes.
   */
  async markAsDeceased(
    { user, animal, date, cause }: { user: User; animal: Animal; date: Date; cause?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${user}' must be 'alive' to be marked as deceased (current status: ${existingAnimal.status}).` };
    }

    const notes = `Deceased on ${date.toISOString().split("T")[0]}. Cause: ${cause ?? "unspecified"}.`;
    return this.updateStatus({ user, animal, status: "deceased", notes });
  }

  /**
   * markAsSold (user: ID, animal: AnimalID, date: Date, buyerNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'sold', and records the date and buyer notes in notes.
   */
  async markAsSold(
    { user, animal, date, buyerNotes }: { user: User; animal: Animal; date: Date; buyerNotes?: string },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return { error: `Animal '${animal}' for user '${user}' must be 'alive' to be marked as sold (current status: ${existingAnimal.status}).` };
    }

    const notes = `Sold on ${date.toISOString().split("T")[0]}. Buyer notes: ${buyerNotes ?? "None"}.`;
    return this.updateStatus({ user, animal, status: "sold", notes });
  }

  /**
   * removeAnimal (user: ID, animal: AnimalID): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects removes the animal from the set of Animals
   */
  async removeAnimal(
    { user, animal }: { user: User; animal: Animal },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({ _id: animal, owner: user });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found for user '${user}'.` };
    }

    try {
      const result = await this.animals.deleteOne({ _id: animal, owner: user });
      if (result.deletedCount === 0) {
        return { error: `Failed to remove animal '${animal}' for user '${user}'. It may no longer exist.` };
      }
      return {};
    } catch (e) {
      console.error("Error removing animal:", e);
      return { error: "Failed to remove animal due to a database error." };
    }
  }

  // --- Concept Queries ---

  /**
   * _getAnimal (user: ID, id: ID): (animal: AnimalDocument)
   * @requires an animal with `id` owned by `user` exists
   * @effects returns the animal document for the given ID and user
   */
  async _getAnimal(
    { user, id }: { user: User; id: ID },
  ): Promise<{ animal?: AnimalDocument } | { error: string }> {
    // Precondition: an animal with `id` owned by `user` exists (implicitly checked by findOne)
    try {
      const animal = await this.animals.findOne({ _id: id, owner: user });
      if (!animal) {
        return { error: `Animal with ID '${id}' not found for user '${user}'.` };
      }
      return { animal };
    } catch (e) {
      console.error("Error fetching animal:", e);
      return { error: "Failed to fetch animal due to a database error." };
    }
  }

  /**
   * _getAllAnimals (user: ID): (animals: AnimalDocument[])
   * @requires true
   * @effects returns a list of all animal documents owned by the `user`
   */
  async _getAllAnimals(
    { user }: { user: User },
  ): Promise<{ animals: AnimalDocument[] } | { error: string }> {
    // Precondition: true (always allowed to query all animals for a user)
    try {
      const allAnimals = await this.animals.find({ owner: user }).toArray();
      return { animals: allAnimals };
    } catch (e) {
      console.error("Error fetching all animals for user:", e);
      return { error: "Failed to fetch all animals due to a database error." };
    }
  }
}
```