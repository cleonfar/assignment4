import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "AnimalIdentity" + ".";

// Generic types of this concept (AnimalId and UserId are IDs)
type AnimalId = ID; // User-provided identifier for an animal, unique per owner
type UserId = ID; // Identifier for the user/owner

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
  _id: ID; // System-generated unique ID (Mongo _id)
  ownerId: UserId; // The ID of the user who registered this animal
  animalId: AnimalId; // User-provided ID, unique per owner
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
    // Run migration and ensure indexes without blocking construction
    this._ensureIndexesAndMigrate().catch((e) => {
      console.error("AnimalIdentityConcept: index/migration error:", e);
    });
  }

  // One-time migration to backfill ownerId/animalId from legacy fields and create composite unique index
  private async _ensureIndexesAndMigrate(): Promise<void> {
    // Backfill ownerId from legacy 'owner' and animalId from legacy '_id' if missing/null
    try {
      // Use a pipeline update without filter to backfill for all documents safely
      await this.animals.updateMany(
        {},
        [
          {
            $set: {
              ownerId: { $ifNull: ["$ownerId", "$owner"] },
              animalId: { $ifNull: ["$animalId", "$_id"] },
            },
          },
        ],
      );
    } catch (e) {
      console.error("AnimalIdentity migration backfill failed:", e);
      // Continue to attempt index creation; partial index will skip malformed docs
    }

    // Create a unique index to enforce per-owner uniqueness.
    // Backfill above ensures both fields are present; plain unique index is sufficient and avoids unsupported operators.
    try {
      await this.animals.createIndex(
        { ownerId: 1, animalId: 1 },
        { unique: true, name: "ownerId_animalId_unique" },
      );
    } catch (e) {
      console.error("AnimalIdentity index creation failed:", e);
    }
  }

  /**
   * registerAnimal (user: ID, id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)
   * @requires No animal with this `id` is registered by this `user`
   * @effects create a new animal owned by `user` with given attributes, status set to alive; returns the animal's ID
   */
  async registerAnimal(
    {
      user,
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }: {
      user: UserId;
      id: AnimalId;
      species: string;
      sex: Sex;
      birthDate?: Date;
      breed?: string;
      notes?: string;
    },
  ): Promise<{ animal: AnimalId } | { error: string }> {
    // Precondition: No animal with this user-facing ID is registered by this user
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: id,
    });
    if (existingAnimal) {
      return {
        error: `Animal with ID '${id}' already exists for user '${user}'.`,
      };
    }

    const newAnimal: AnimalDocument = {
      _id: freshID(),
      ownerId: user,
      animalId: id,
      species: species,
      breed: breed ?? "",
      sex: sex,
      status: "alive",
      notes: notes ?? "",
      birthDate: birthDate ?? null,
    };

    try {
      await this.animals.insertOne(newAnimal);
      // Return the user-facing identifier for convenience
      return { animal: newAnimal.animalId };
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
    { user, animal, status, notes }: {
      user: UserId;
      animal: AnimalId; // user-facing identifier
      status: AnimalStatus;
      notes: string;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID (user-facing) owned by `user` exists
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!existingAnimal) {
      return {
        error: `Animal with ID '${animal}' not found for user '${user}'.`,
      };
    }

    try {
      const result = await this.animals.updateOne(
        { ownerId: user, animalId: animal },
        { $set: { status: status, notes: notes } },
      );
      if (result.matchedCount === 0) {
        return {
          error:
            `Failed to update status for animal '${animal}' for user '${user}'.`,
        };
      }
      return {};
    } catch (e) {
      console.error("Error updating animal status:", e);
      return {
        error: "Failed to update animal status due to a database error.",
      };
    }
  }

  /**
   * editDetails (user: ID, animal: Animal, species: String, breed: String, birthDate: Date, sex: Enum): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects update the animal’s identifying attributes
   */
  async editDetails(
    { user, animal, species, breed, birthDate, sex }: {
      user: UserId;
      animal: AnimalId; // user-facing identifier
      species: string;
      breed: string;
      birthDate: Date;
      sex: Sex;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!existingAnimal) {
      return {
        error: `Animal with ID '${animal}' not found for user '${user}'.`,
      };
    }

    try {
      const result = await this.animals.updateOne(
        { ownerId: user, animalId: animal },
        { $set: { species, breed, birthDate, sex } },
      );
      if (result.matchedCount === 0) {
        return {
          error:
            `Failed to edit details for animal '${animal}' for user '${user}'.`,
        };
      }
      return {};
    } catch (e) {
      console.error("Error editing animal details:", e);
      return {
        error: "Failed to edit animal details due to a database error.",
      };
    }
  }

  /**
   * markAsTransferred (user: ID, animal: AnimalID, date: Date, recipientNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'transferred', and records the date and recipient notes in notes.
   */
  async markAsTransferred(
    { user, animal, date, recipientNotes }: {
      user: UserId;
      animal: AnimalId;
      date: Date;
      recipientNotes?: string;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!existingAnimal) {
      return {
        error: `Animal with ID '${animal}' not found for user '${user}'.`,
      };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return {
        error:
          `Animal '${animal}' for user '${user}' must be 'alive' to be marked as transferred (current status: ${existingAnimal.status}).`,
      };
    }

    const notes = `Transferred on ${
      date.toISOString().split("T")[0]
    }. Recipient notes: ${recipientNotes ?? "None"}.`;
    return this.updateStatus({ user, animal, status: "transferred", notes });
  }

  /**
   * markAsDeceased (user: ID, animal: AnimalID, date: Date, cause?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'deceased', and records the date and cause in notes.
   */
  async markAsDeceased(
    { user, animal, date, cause }: {
      user: UserId;
      animal: AnimalId;
      date: Date;
      cause?: string;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!existingAnimal) {
      return {
        error: `Animal with ID '${animal}' not found for user '${user}'.`,
      };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return {
        error:
          `Animal '${animal}' for user '${user}' must be 'alive' to be marked as deceased (current status: ${existingAnimal.status}).`,
      };
    }

    const notes = `Deceased on ${date.toISOString().split("T")[0]}. Cause: ${
      cause ?? "unspecified"
    }.`;
    return this.updateStatus({ user, animal, status: "deceased", notes });
  }

  /**
   * markAsSold (user: ID, animal: AnimalID, date: Date, buyerNotes?: String): Empty
   * @requires an animal with `animal` ID owned by `user` exists, animal's status is alive
   * @effects sets the animal’s status to 'sold', and records the date and buyer notes in notes.
   */
  async markAsSold(
    { user, animal, date, buyerNotes }: {
      user: UserId;
      animal: AnimalId;
      date: Date;
      buyerNotes?: string;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists for this user
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!existingAnimal) {
      return {
        error: `Animal with ID '${animal}' not found for user '${user}'.`,
      };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return {
        error:
          `Animal '${animal}' for user '${user}' must be 'alive' to be marked as sold (current status: ${existingAnimal.status}).`,
      };
    }

    const notes = `Sold on ${date.toISOString().split("T")[0]}. Buyer notes: ${
      buyerNotes ?? "None"
    }.`;
    return this.updateStatus({ user, animal, status: "sold", notes });
  }

  /**
   * removeAnimal (user: ID, animal: AnimalID): Empty
   * @requires an animal with `animal` ID owned by `user` exists
   * @effects removes the animal from the set of Animals
   */
  async removeAnimal(
    { user, animal }: { user: UserId; animal: AnimalId },
  ): Promise<Empty | { error: string }> {
    // Precondition: an animal with `animal` ID owned by `user` exists
    const existingAnimal = await this.animals.findOne({
      ownerId: user,
      animalId: animal,
    });
    if (!existingAnimal) {
      return {
        error: `Animal with ID '${animal}' not found for user '${user}'.`,
      };
    }

    try {
      const result = await this.animals.deleteOne({
        ownerId: user,
        animalId: animal,
      });
      if (result.deletedCount === 0) {
        return {
          error:
            `Failed to remove animal '${animal}' for user '${user}'. It may no longer exist.`,
        };
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
    { user, id }: { user: UserId; id: AnimalId },
  ): Promise<({ animal: AnimalDocument } | { error: string })[]> {
    // Precondition: an animal with `id` owned by `user` exists (implicitly checked by findOne)
    try {
      const animal = await this.animals.findOne({
        ownerId: user,
        animalId: id,
      });
      if (!animal) {
        return [{
          error: `Animal with ID '${id}' not found for user '${user}'.`,
        }];
      }
      return [{ animal }];
    } catch (e) {
      console.error("Error fetching animal:", e);
      return [{ error: "Failed to fetch animal due to a database error." }];
    }
  }

  /**
   * _getAllAnimals (user: ID): (animals: AnimalDocument[])
   * @requires true
   * @effects returns a list of all animal documents owned by the `user`
   */
  async _getAllAnimals(
    { user }: { user: UserId },
  ): Promise<({ animals: AnimalDocument[] } | { error: string })[]> {
    // Precondition: true (always allowed to query all animals for a user)
    try {
      const allAnimals = await this.animals.find({ ownerId: user }).toArray();
      return [{ animals: allAnimals }];
    } catch (e) {
      console.error("Error fetching all animals for user:", e);
      return [{
        error: "Failed to fetch all animals due to a database error.",
      }];
    }
  }
}
