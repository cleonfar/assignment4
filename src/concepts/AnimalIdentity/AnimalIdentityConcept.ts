import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
// UNKNOWN_FATHER_ID, UNKNOWN_MOTHER_ID are no longer needed as parent fields are removed.

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
 *     (Parent and offspring fields removed as per design refinement)
 */
interface AnimalDocument {
  _id: ID; // The concept 'id' is mapped to MongoDB '_id'
  species: string;
  breed: string; // Using "" for optional string fields if not provided
  sex: Sex;
  status: AnimalStatus;
  notes: string; // Using "" for optional string fields if not provided
  birthDate: Date | null; // Using null for optional Date fields if not provided
  // Removed: mother: ID;
  // Removed: father: ID;
  // Removed: offspring: ID[];
}

export default class AnimalIdentityConcept {
  private animals: Collection<AnimalDocument>;

  constructor(private readonly db: Db) {
    this.animals = this.db.collection(PREFIX + "animals");
  }

  /**
   * registerAnimal (id: ID, species: String, sex: Enum, birthDate?: Date, breed?: String, notes?: String): (animal: Animal)
   * @requires No animal with this ID is in the set of Animals
   * @effects create a new animal with given attributes, status set to alive
   */
  async registerAnimal(
    {
      id,
      species,
      sex,
      birthDate,
      breed,
      notes,
    }: {
      id: ID;
      species: string;
      sex: Sex;
      birthDate?: Date;
      breed?: string;
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
      // Removed: mother: UNKNOWN_MOTHER_ID,
      // Removed: father: UNKNOWN_FATHER_ID,
      // Removed: offspring: [],
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
    { animal, status, notes }: {
      animal: Animal;
      status: AnimalStatus;
      notes: string;
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
        { $set: { status: status, notes: notes } },
      );
      if (result.matchedCount === 0) {
        return { error: `Failed to update status for animal '${animal}'.` };
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
      return {
        error: "Failed to edit animal details due to a database error.",
      };
    }
  }

  /**
   * markAsTransferred (animal: AnimalID, date: Date, recipientNotes?: String): Empty
   * @requires animal exists, animal's status is alive
   * @effects sets the animal’s status to 'transferred', and records the date and recipient notes in notes.
   */
  async markAsTransferred(
    { animal, date, recipientNotes }: {
      animal: Animal;
      date: Date;
      recipientNotes?: string;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return {
        error:
          `Animal '${animal}' must be 'alive' to be marked as transferred (current status: ${existingAnimal.status}).`,
      };
    }

    const notes = `Transferred on ${
      date.toISOString().split("T")[0]
    }. Recipient notes: ${recipientNotes ?? "None"}.`;
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
      return {
        error:
          `Animal '${animal}' must be 'alive' to be marked as deceased (current status: ${existingAnimal.status}).`,
      };
    }

    const notes = `Deceased on ${date.toISOString().split("T")[0]}. Cause: ${
      cause ?? "unspecified"
    }.`;
    return this.updateStatus({ animal, status: "deceased", notes });
  }

  /**
   * markAsSold (animal: AnimalID, date: Date, buyerNotes?: String): Empty
   * @requires animal exists, animal's status is alive
   * @effects sets the animal’s status to 'sold', and records the date and buyer notes in notes.
   */
  async markAsSold(
    { animal, date, buyerNotes }: {
      animal: Animal;
      date: Date;
      buyerNotes?: string;
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: animal exists
    const existingAnimal = await this.animals.findOne({ _id: animal });
    if (!existingAnimal) {
      return { error: `Animal with ID '${animal}' not found.` };
    }
    // Precondition: animal's status is alive
    if (existingAnimal.status !== "alive") {
      return {
        error:
          `Animal '${animal}' must be 'alive' to be marked as sold (current status: ${existingAnimal.status}).`,
      };
    }

    const notes = `Sold on ${date.toISOString().split("T")[0]}. Buyer notes: ${
      buyerNotes ?? "None"
    }.`;
    return this.updateStatus({ animal, status: "sold", notes });
  }

  // --- Removed Relationship Actions and Queries ---
  // setParent, removeParent, addOffspring, removeOffspring, _getOffspring are all removed.

  // --- Concept Queries ---

  /**
   * _getAnimal (id: ID): (animal: AnimalDocument)
   * @effects return the animal document for the given ID
   */
  async _getAnimal(
    { id }: { id: ID },
  ): Promise<{ animal?: AnimalDocument } | { error: string }> {
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
  async _getAllAnimals(): Promise<
    { animals: AnimalDocument[] } | { error: string }
  > {
    try {
      const allAnimals = await this.animals.find({}).toArray();
      return { animals: allAnimals };
    } catch (e) {
      console.error("Error fetching all animals:", e);
      return { error: "Failed to fetch all animals due to a database error." };
    }
  }
}
