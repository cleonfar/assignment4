---
timestamp: 'Mon Nov 03 2025 18:45:40 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_184540.16b341ee.md]]'
content_id: bc851eed95b310f8caa6ac5a601600098b0f6ccdc310796ba1ce5a34bef61a9f
---

# response:

````typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// Declare collection prefix, use concept name
const PREFIX = "ReproductionTracking.";

// Generic types of this concept for strong typing of IDs
type UserId = ID; // New type for user identifiers
type MotherId = ID; // Mother ID will still be unique globally, but owned by a user
type LitterId = ID; // Litter ID will now follow a pattern: motherId-sequenceNumber
type OffspringId = ID; // Offspring ID will still be unique globally, but owned by a user
type ReportName = string; // As per spec, report name is a string identifier

/**
 * A special ID to indicate that the father of a litter is unknown or not specified.
 * This simplifies queries and ensures the `fatherId` field is always present in `Litter` documents.
 */
export const UNKNOWN_FATHER_ID = "UNKNOWN_FATHER" as ID;

/**
 * Represents a mother animal in the system.
 * The purpose is to track reproductive outcomes and offspring survivability.
 */
interface Mother {
  _id: MotherId; // The ID of the mother animal, provided externally.
  ownerId: UserId; // The ID of the user who owns this mother.
  notes: string; // Notes about the mother. Stored as "" if not provided.
  nextLitterNumber: number; // The next sequential number to assign to a litter for this mother.
}

/**
 * Represents a litter of offspring born to a mother animal.
 * Organizes individual offspring into distinct litters.
 * The `fatherId` will always be present, using `UNKNOWN_FATHER_ID` if not specified.
 * The `_id` field for a Litter will be `motherId-sequentialNumber`.
 */
interface Litter {
  _id: LitterId; // The generated ID for this litter, e.g., "motherA-1", "motherA-2".
  ownerId: UserId; // The ID of the user who owns this litter. Derived from the mother.
  motherId: MotherId; // Link to the mother of this litter.
  fatherId: ID; // Link to the father of this litter, or UNKNOWN_FATHER_ID.
  birthDate: Date; // The birth date of the litter.
  reportedLitterSize: number; // The reported number of offspring in the litter.
  notes: string; // Notes about the litter. Stored as "" if not provided.
}

/**
 * Represents an individual offspring, linked to a parent litter.
 */
interface Offspring {
  _id: OffspringId; // The ID of the offspring, provided externally.
  ownerId: UserId; // The ID of the user who owns this offspring. Derived from the litter/mother.
  litterId: LitterId; // Link to its parent litter.
  sex: "male" | "female" | "neutered"; // The sex of the offspring.
  notes: string; // Notes about the offspring. Stored as "" if not provided.
  isAlive: boolean; // Indicates if the offspring is currently alive.
  survivedTillWeaning: boolean; // Indicates if the offspring survived till weaning.
}

/**
 * Represents a generated report on reproductive performance.
 */
interface Report {
  _id: ReportName; // The name of the report, used as its identifier.
  ownerId: UserId; // The ID of the user who owns this report.
  dateGenerated: Date; // The date the report was generated.
  target: ID[]; // A set of target mother animal IDs for this report.
  results: string[]; // A set of results, each represented as a string.
  summary: string; // An AI-generated summary of the report. Defaults to empty string.
}

/**
 * Interface for the expected JSON structure from the AI summary.
 */
interface LLMSummaryOutput {
  highPerformers: ID[];
  lowPerformers: ID[];
  concerningTrends: ID[];
  averagePerformers: ID[];
  potentialRecordErrors: ID[];
  insights: string;
}

/**
 * # concept: ReproductionTracking
 *
 * **purpose** track reproductive outcomes and offspring survivability for breeding animals,
 * organizing individual offspring into distinct litters.
 *
 * **principle**
 * a user records birth events by first creating a litter for a mother animal,
 * optionally linking a father and setting an expected litter size;
 * then, individual offspring born to that litter are recorded and linked to it;
 * later records weaning outcomes for those offspring when the data becomes available;
 * uses this data to generate reports to evaluate reproductive performance and
 * inform breeding decisions, including litter-specific metrics;
 * can choose to generate an AI summary of generated reports to aide in understanding and decision making;
 */
export default class ReproductionTrackingConcept {
  mothers: Collection<Mother>;
  litters: Collection<Litter>;
  offspring: Collection<Offspring>;
  reports: Collection<Report>;

  constructor(private readonly db: Db) {
    this.mothers = this.db.collection(PREFIX + "mothers");
    this.litters = this.db.collection(PREFIX + "litters");
    this.offspring = this.db.collection(PREFIX + "offspring");
    this.reports = this.db.collection(PREFIX + "reports");
  }

  /**
   * **action** `addMother (userId: String, motherId: String): (motherId: String)`
   *
   * **requires** no Mother with the given `motherId` and `userId` already exists
   * **effects** mother is added to the set of mothers. The next litter for this mother will be assigned ID '1'.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.motherId - The unique identifier for the mother.
   * @returns {{ motherId?: MotherId; error?: string }} The ID of the added mother, or an error.
   */
  async addMother({
    userId,
    motherId,
  }: {
    userId: string;
    motherId: string;
  }): Promise<{ motherId?: MotherId; error?: string }> {
    const existingMother = await this.mothers.findOne({
      _id: motherId as ID,
      ownerId: userId as UserId,
    });
    if (existingMother) {
      return {
        error: `Mother with ID '${motherId}' already exists for user '${userId}'.`,
      };
    }

    const newMother: Mother = {
      _id: motherId as ID,
      ownerId: userId as UserId,
      notes: "", // Default to empty string
      nextLitterNumber: 1, // Initialize for the first litter
    };

    await this.mothers.insertOne(newMother);
    return { motherId: newMother._id };
  }

  /**
   * **action** `removeMother (userId: String, motherId: String): (motherId: String)`
   *
   * **requires** a mother with this ID and `userId` is in the set of mothers
   * **effects** removes this mother from the set of mothers.
   * **Also, removes any litters associated with this mother, and all offspring associated with those litters, all belonging to the same user.**
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.motherId - The unique identifier of the mother to remove.
   * @returns {{ motherId?: MotherId; error?: string }} The ID of the removed mother, or an error.
   */
  async removeMother({
    userId,
    motherId,
  }: {
    userId: string;
    motherId: string;
  }): Promise<{ motherId?: MotherId; error?: string }> {
    const existingMother = await this.mothers.findOne({
      _id: motherId as ID,
      ownerId: userId as UserId,
    });
    if (!existingMother) {
      return {
        error: `Mother with ID '${motherId}' not found for user '${userId}'.`,
      };
    }

    // 1. Find all litters associated with this mother and user
    const littersToDelete = await this.litters.find({
      motherId: motherId as ID,
      ownerId: userId as UserId,
    }).toArray();
    const litterIdsToDelete = littersToDelete.map((litter) => litter._id);

    // 2. Delete all offspring associated with these litters and user
    if (litterIdsToDelete.length > 0) {
      await this.offspring.deleteMany({
        litterId: { $in: litterIdsToDelete },
        ownerId: userId as UserId,
      });
    }

    // 3. Delete all litters associated with this mother and user
    await this.litters.deleteMany({
      motherId: motherId as ID,
      ownerId: userId as UserId,
    });

    // 4. Delete the mother herself
    const result = await this.mothers.deleteOne({
      _id: motherId as ID,
      ownerId: userId as UserId,
    });

    if (result.deletedCount === 0) {
      // This should ideally not happen if existingMother was found, but as a safeguard.
      return {
        error:
          `Mother with ID '${motherId}' not found for user '${userId}' during final deletion.`,
      };
    }
    return { motherId: motherId as ID };
  }

  /**
   * **action** `recordLitter (userId: String, motherId: String, fatherId: String?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litterID: String)`
   *
   * **requires** motherId exists for the given `userId`. The generated litter ID (motherId-sequentialNumber) does not already exist for the given `userId`.
   * **effects** Creates a new litter record with the provided information, assigning a sequential ID unique to the mother and user.
   * Also adds the mother to the set of mothers if she isn't there already for this user, initializing her `nextLitterNumber`.
   * Increments the `nextLitterNumber` for the mother owned by this user.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.motherId - The ID of the mother.
   * @param {string} [args.fatherId] - Optional ID of the father.
   * @param {Date} args.birthDate - The birth date of the litter.
   * @param {number} args.reportedLitterSize - The reported number of offspring in the litter.
   * @param {string} [args.notes] - Optional notes for the litter.
   * @returns {{ litterID?: LitterId; error?: string }} The ID of the new litter, or an error.
   */
  async recordLitter({
    userId,
    motherId,
    fatherId,
    birthDate,
    reportedLitterSize,
    notes,
  }: {
    userId: string;
    motherId: string;
    fatherId?: string;
    birthDate: Date;
    reportedLitterSize: number;
    notes?: string;
  }): Promise<{ litterID?: LitterId; error?: string }> {
    // Check if mother exists for this user. If not, add her with default nextLitterNumber: 1
    let mother = await this.mothers.findOne({
      _id: motherId as ID,
      ownerId: userId as UserId,
    });
    if (!mother) {
      const addMotherResult = await this.addMother({ userId, motherId });
      if (addMotherResult.error) {
        return {
          error: `Failed to ensure mother exists for user '${userId}': ${addMotherResult.error}`,
        };
      }
      // Re-fetch mother to get the initialized nextLitterNumber
      mother = await this.mothers.findOne({
        _id: motherId as ID,
        ownerId: userId as UserId,
      });
      if (!mother) { // Should not happen if addMother was successful
        return { error: `Internal error: Mother not found for user '${userId}' after creation.` };
      }
    }

    // Ensure nextLitterNumber exists on the mother object (for robustness with old data or if not properly initialized)
    if (mother.nextLitterNumber === undefined || mother.nextLitterNumber === null) {
      mother.nextLitterNumber = 1; // Default if somehow missing or for legacy data
    }

    const actualMotherId = motherId as ID;
    const actualFatherId: ID = fatherId ? (fatherId as ID) : UNKNOWN_FATHER_ID;

    // Construct the new Litter ID using the mother's nextLitterNumber
    const newLitterNumber = mother.nextLitterNumber;
    const newLitterId = `${actualMotherId}-${newLitterNumber}` as LitterId;

    // Check for duplicate Litter ID (should ideally not happen with sequential numbering per mother per user)
    const duplicateLitter = await this.litters.findOne({
      _id: newLitterId,
      ownerId: userId as UserId,
    });
    if (duplicateLitter) {
      // This indicates a logical error or a race condition if it happens often.
      // In a high-concurrency scenario, a transaction or more robust locking might be needed.
      return {
        error:
          `A litter with ID '${newLitterId}' already exists for user '${userId}'. This indicates a sequence number collision or improper state.`,
      };
    }

    // Update mother's nextLitterNumber *before* inserting the litter,
    // to reserve the number. If litter insertion fails, a number might be skipped.
    const updatedNextLitterNumber = newLitterNumber + 1;
    await this.mothers.updateOne(
      { _id: actualMotherId, ownerId: userId as UserId },
      { $set: { nextLitterNumber: updatedNextLitterNumber } },
    );

    const newLitter: Litter = {
      _id: newLitterId,
      ownerId: userId as UserId, // Assign ownerId to the litter
      motherId: actualMotherId,
      fatherId: actualFatherId,
      birthDate,
      reportedLitterSize,
      notes: notes ?? "", // Optional notes should default to an empty string if not provided
    };
    await this.litters.insertOne(newLitter);
    return { litterID: newLitterId };
  }

  /**
   * **action** `updateLitter (userId: String, litterId: String, motherId: String?, fatherId: String?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litterID: String)`
   *
   * **requires** `litterId` exists for the given `userId`. `motherId` cannot be changed for an existing litter.
   * **effects** Updates any given information about the litter.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.litterId - The ID of the litter to update.
   * @param {string} [args.motherId] - New ID of the mother (not allowed to change).
   * @param {string} [args.fatherId] - New optional ID of the father.
   * @param {Date} [args.birthDate] - New birth date.
   * @param {number} [args.reportedLitterSize] - New reported litter size.
   * @param {string} [args.notes] - New optional notes.
   * @returns {{ litterID?: LitterId; error?: string }} The ID of the updated litter, or an error.
   */
  async updateLitter({
    userId,
    litterId,
    motherId,
    fatherId,
    birthDate,
    reportedLitterSize,
    notes,
  }: {
    userId: string;
    litterId: string;
    motherId?: string;
    fatherId?: string;
    birthDate?: Date;
    reportedLitterSize?: number;
    notes?: string;
  }): Promise<{ litterID?: LitterId; error?: string }> {
    const existingLitter = await this.litters.findOne({
      _id: litterId as ID,
      ownerId: userId as UserId,
    });
    if (!existingLitter) {
      return {
        error: `Litter with ID '${litterId}' not found for user '${userId}'.`,
      };
    }

    // Restriction: Cannot change motherId for an existing litter.
    // Changing motherId would require re-assigning the litter's primary ID (e.g., from 'MotherA-X' to 'MotherB-Y'),
    // which is a complex operation equivalent to deleting and re-creating the litter and its offspring,
    // and is beyond a simple 'updateLitter' action.
    if (motherId !== undefined && motherId !== existingLitter.motherId) {
      return { error: `Cannot change 'motherId' for an existing litter with ID '${litterId}'. Litter IDs are tied to their mother's sequence.` };
    }

    const updateFields: Partial<Litter> = {};
    // Handle fatherId update: if explicitly provided as undefined, set to UNKNOWN_FATHER_ID.
    // Otherwise, use the provided fatherId. If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], "fatherId")) {
      if (fatherId === undefined) {
        updateFields.fatherId = UNKNOWN_FATHER_ID;
      } else {
        updateFields.fatherId = fatherId as ID;
      }
    }
    if (birthDate !== undefined) updateFields.birthDate = birthDate;
    if (reportedLitterSize !== undefined) {
      updateFields.reportedLitterSize = reportedLitterSize;
    }
    // Handle notes update: if explicitly provided as undefined, set to empty string.
    // If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], "notes")) {
      updateFields.notes = notes ?? ""; // Optional notes should default to an empty string if not provided
    }

    const result = await this.litters.updateOne(
      { _id: litterId as ID, ownerId: userId as UserId },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      // This case indicates that the litter might have been deleted by another operation
      // after the findOne but before the updateOne, or ownerId/litterId didn't match.
      return {
        error: `Litter with ID '${litterId}' not found for user '${userId}' for update.`,
      };
    }
    return { litterID: litterId as ID };
  }

  /**
   * **action** `recordOffspring (userId: String, litterId: String, offspringId: String, sex: Enum [male, female, neutered], notes: String?): (offspringID: String)`
   *
   * **requires** `litterId` exists for the given `userId` and `offspringId` does not exist for the given `userId`.
   * **effects** creates an individual offspring record linked to the specified litter, owned by the user.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.litterId - The ID of the parent litter.
   * @param {string} args.offspringId - The unique identifier for the offspring.
   * @param {'male' | 'female' | 'neutered'} args.sex - The sex of the offspring.
   * @param {string} [args.notes] - Optional notes for the offspring.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the new offspring, or an error.
   */
  async recordOffspring({
    userId,
    litterId,
    offspringId,
    sex,
    notes,
  }: {
    userId: string;
    litterId: string;
    offspringId: string;
    sex: "male" | "female" | "neutered";
    notes?: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    // Check requires: litterId exists for this user
    const existingLitter = await this.litters.findOne({
      _id: litterId as ID,
      ownerId: userId as UserId,
    });
    if (!existingLitter) {
      return {
        error: `Litter with ID '${litterId}' not found for user '${userId}'.`,
      };
    }

    // Check requires: offspringId does not exist for this user
    const existingOffspring = await this.offspring.findOne({
      _id: offspringId as ID,
      ownerId: userId as UserId,
    });
    if (existingOffspring) {
      return {
        error: `Offspring with ID '${offspringId}' already exists for user '${userId}'.`,
      };
    }

    const newOffspring: Offspring = {
      _id: offspringId as ID,
      ownerId: userId as UserId, // Assign ownerId to the offspring
      litterId: litterId as ID,
      sex,
      notes: notes ?? "", // Optional notes should default to an empty string if not provided
      isAlive: true, // New offspring are assumed alive
      survivedTillWeaning: false, // Not yet weaned
    };
    await this.offspring.insertOne(newOffspring);
    return { offspringID: newOffspring._id };
  }

  /**
   * **action** `updateOffspring (userId: String, oldOffspringId: String, newOffspringId: String?, litterId: String?, sex: Enum?, notes: String?): (offspringID: String)`
   *
   * **requires** `oldOffspringId` exists for the given `userId`. If `newOffspringId` is provided and different from `oldOffspringId`,
   * it must not already exist for the given `userId`. If `litterId` is changed, the new litter must exist for the same `userId`.
   * **effects** Finds the offspring by `oldOffspringId` and `userId`. If `newOffspringId` is provided and different,
   * renames the offspring's ID to `newOffspringId` (by deleting the old record and inserting a new one
   * with the updated ID and other fields). Otherwise, updates any other given information about the offspring.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.oldOffspringId - The current ID of the offspring to update.
   * @param {string} [args.newOffspringId] - The optional new ID for the offspring. If not provided, `oldOffspringId` is used.
   * @param {string} [args.litterId] - New ID of the parent litter.
   * @param {'male' | 'female' | 'neutered'} [args.sex] - New sex of the offspring.
   * @param {string} [args.notes] - New optional notes.
   * @returns {{ offspringID?: OffspringId; error?: string }} The final ID of the updated offspring, or an error.
   */
  async updateOffspring({
    userId,
    oldOffspringId,
    newOffspringId,
    litterId,
    sex,
    notes,
  }: {
    userId: string;
    oldOffspringId: string;
    newOffspringId?: string;
    litterId?: string;
    sex?: "male" | "female" | "neutered";
    notes?: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    // 1. Find the offspring by old ID and owner
    const existingOffspring = await this.offspring.findOne({
      _id: oldOffspringId as ID,
      ownerId: userId as UserId,
    });
    if (!existingOffspring) {
      return {
        error: `Offspring with ID '${oldOffspringId}' not found for user '${userId}'.`,
      };
    }

    // 2. Determine the actual new ID to use (defaults to oldOffspringId if newOffspringId is not provided)
    const finalNewOffspringId: OffspringId = (newOffspringId ?? oldOffspringId) as OffspringId;

    // Prepare update fields for non-ID changes
    const updateFields: Partial<Offspring> = {};
    if (litterId !== undefined) {
      const existingLitter = await this.litters.findOne({
        _id: litterId as ID,
        ownerId: userId as UserId, // Check if the new litter belongs to the same user
      });
      if (!existingLitter) {
        return {
          error:
            `New litter with ID '${litterId}' not found for user '${userId}'.`,
        }; // No auto-creation for litter here, must exist.
      }
      updateFields.litterId = litterId as ID;
    }
    if (sex !== undefined) updateFields.sex = sex;
    // Handle notes update: if explicitly provided as undefined, set to empty string.
    // If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], "notes")) {
      updateFields.notes = notes ?? ""; // Optional notes should default to an empty string if not provided
    }

    // Check if ID is actually changing
    if (finalNewOffspringId !== oldOffspringId as ID) {
      // ID is changing: handle as a delete + insert to change primary key
      const newIdExists = await this.offspring.findOne({
        _id: finalNewOffspringId,
        ownerId: userId as UserId, // Check for uniqueness for this user
      });
      if (newIdExists) {
        return {
          error:
            `New offspring ID '${finalNewOffspringId}' already exists for user '${userId}'. Cannot rename.`,
        };
      }

      // Construct the new offspring document using existing data and provided updates
      const newOffspringDoc: Offspring = {
        _id: finalNewOffspringId,
        ownerId: userId as UserId,
        litterId: updateFields.litterId ?? existingOffspring.litterId,
        sex: updateFields.sex ?? existingOffspring.sex,
        notes: updateFields.notes ?? existingOffspring.notes,
        isAlive: existingOffspring.isAlive,
        survivedTillWeaning: existingOffspring.survivedTillWeaning,
      };

      // Delete the old document
      await this.offspring.deleteOne({
        _id: oldOffspringId as ID,
        ownerId: userId as UserId,
      });

      // Insert the new document
      await this.offspring.insertOne(newOffspringDoc);

      return { offspringID: finalNewOffspringId };
    } else {
      // ID is NOT changing: perform a regular update on other fields
      // If no other fields are provided for update, just return the existing ID.
      if (Object.keys(updateFields).length === 0) {
        return { offspringID: oldOffspringId as ID };
      }

      const result = await this.offspring.updateOne(
        { _id: oldOffspringId as ID, ownerId: userId as UserId },
        { $set: updateFields },
      );

      if (result.matchedCount === 0) {
        // This should ideally not happen if existingOffspring was found, but as a safeguard.
        return {
          error:
            `Offspring with ID '${oldOffspringId}' not found for user '${userId}' for update.`,
        };
      }
      return { offspringID: oldOffspringId as ID };
    }
  }

  /**
   * **action** `recordWeaning (userId: String, offspringId: String): (offspringID: String)`
   *
   * **requires** offspring with `offspringId` exists for `userId` and is alive
   * **effects** Sets `survivedTillWeaning` to be true for the specified offspring
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.offspringId - The ID of the offspring to mark as weaned.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the offspring, or an error.
   */
  async recordWeaning({
    userId,
    offspringId,
  }: {
    userId: string;
    offspringId: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({
      _id: offspringId as ID,
      ownerId: userId as UserId,
    });
    if (!existingOffspring) {
      return {
        error: `Offspring with ID '${offspringId}' not found for user '${userId}'.`,
      };
    }
    if (!existingOffspring.isAlive) {
      return {
        error:
          `Offspring with ID '${offspringId}' for user '${userId}' is not alive and cannot be weaned.`,
      };
    }

    await this.offspring.updateOne(
      { _id: offspringId as ID, ownerId: userId as UserId },
      { $set: { survivedTillWeaning: true } },
    );
    return { offspringID: offspringId as ID };
  }

  /**
   * **action** `recordDeath (userId: String, offspringId: String): (offspringId: String)`
   *
   * **requires** offspring with `offspringId` exists for `userId` and is currently living
   * **effects** Sets the `isAlive` flag of this offspring to false.
   *            The `survivedTillWeaning` status is preserved as it represents a past milestone.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.offspringId - The ID of the offspring to mark as deceased.
   * @returns {{ offspringId?: OffspringId; error?: string }} The ID of the offspring, or an error.
   */
  async recordDeath({
    userId,
    offspringId,
  }: {
    userId: string;
    offspringId: string;
  }): Promise<{ offspringId?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({
      _id: offspringId as ID,
      ownerId: userId as UserId,
    });
    if (!existingOffspring) {
      return {
        error: `Offspring with ID '${offspringId}' not found for user '${userId}'.`,
      };
    }
    if (!existingOffspring.isAlive) {
      return {
        error:
          `Offspring with ID '${offspringId}' for user '${userId}' is already marked as deceased.`,
      };
    }

    // Corrected logic: only set isAlive to false.
    // 'survivedTillWeaning' is a milestone and should not be revoked upon later death.
    await this.offspring.updateOne(
      { _id: offspringId as ID, ownerId: userId as UserId },
      { $set: { isAlive: false } },
    );
    return { offspringId: offspringId as ID };
  }

  /**
   * **action** `generateReport (userId: String, target: String, startDateRange: Date, endDateRange: Date, name: String): (results: string[])`
   *
   * **requires** target animal is in the set of mothers for the given `userId`.
   * **effects** If no report with this name exists for this `userId` then generate a report on the reproductive performance
   * of the given animal within the specified date range, otherwise add the reproductive performance
   * of this animal to the existing report for this `userId`.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.target - The ID of the mother animal for which to generate the report.
   * @param {Date} args.startDateRange - The start date for data collection in the report.
   * @param {Date} args.endDateRange - The end date for data collection in the report.
   * @param {string} args.name - The name of the report.
   * @returns {{ results?: string[]; error?: string }} The results of the generated/updated report, or an error.
   */
  async generateReport({
    userId,
    target,
    startDateRange,
    endDateRange,
    name,
  }: {
    userId: string;
    target: string;
    startDateRange: Date;
    endDateRange: Date;
    name: string;
  }): Promise<{ results?: string[]; error?: string }> {
    // Check requires: target mother exists for this user
    const existingMother = await this.mothers.findOne({
      _id: target as ID,
      ownerId: userId as UserId,
    });
    if (!existingMother) {
      return {
        error: `Target mother with ID '${target}' not found for user '${userId}'.`,
      };
    }

    // --- Start: Actual report generation logic for the specific target and date range ---
    const relevantLitters = await this.litters.find({
      motherId: target as ID,
      ownerId: userId as UserId,
      birthDate: { $gte: startDateRange, $lte: endDateRange },
    }).toArray();

    let littersCount = relevantLitters.length;
    let totalOffspringCount = 0;
    let survivedWeaningCount = 0;

    if (littersCount > 0) {
      const litterIds = relevantLitters.map((l) => l._id);
      const relevantOffspring = await this.offspring.find({
        litterId: { $in: litterIds },
        ownerId: userId as UserId,
      }).toArray();

      totalOffspringCount = relevantOffspring.length;
      survivedWeaningCount = relevantOffspring.filter((o) =>
        o.survivedTillWeaning
      ).length;
    }

    // This string represents the "reproductive performance" for this specific target and date range.
    const newPerformanceEntry =
      `Performance for ${target} (${startDateRange.toDateString()} to ${endDateRange.toDateString()}): ` +
      `Litters: ${littersCount}, Offspring: ${totalOffspringCount}, ` +
      `Weaning Survival: ${
        totalOffspringCount > 0
          ? ((survivedWeaningCount / totalOffspringCount) * 100).toFixed(2) +
            "%"
          : "N/A"
      }`;
    // --- End: Actual report generation logic ---

    const reportNameId = name as ReportName;
    const existingReport = await this.reports.findOne({
      _id: reportNameId,
      ownerId: userId as UserId,
    });
    let currentReportResults: string[] = [];
    let currentReportTargets: ID[] = [];

    if (existingReport) {
      currentReportResults = existingReport.results || [];
      currentReportTargets = existingReport.target || [];

      // Add target to the set of targets if not already present
      if (!currentReportTargets.includes(target as ID)) {
        currentReportTargets.push(target as ID);
      }
      // Add this specific performance entry to the results if not already present
      if (!currentReportResults.includes(newPerformanceEntry)) {
        currentReportResults.push(newPerformanceEntry);
      }

      await this.reports.updateOne(
        { _id: reportNameId, ownerId: userId as UserId },
        {
          $set: {
            dateGenerated: new Date(),
            target: currentReportTargets,
            results: currentReportResults,
            summary: "", // Clear summary as report content has changed (now a required field)
          },
        },
      );
    } else {
      // Create new report
      const newReport: Report = {
        _id: reportNameId,
        ownerId: userId as UserId, // Assign ownerId to the report
        dateGenerated: new Date(),
        target: [target as ID], // Initialize with the first target
        results: [newPerformanceEntry], // Initialize with the first performance entry
        summary: "", // Default to empty string
      };
      await this.reports.insertOne(newReport);
      currentReportResults = newReport.results;
    }

    // Return the results of the (potentially updated) report
    return { results: currentReportResults };
  }

  /**
   * **action** `renameReport (userId: String, oldName: String, newName: String): (newName: String)`
   *
   * **requires** oldName of report exists for the given `userId`. No report with `newName` exists for the given `userId`.
   * **effects** renames the specified report for the given `userId`.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.oldName - The current name of the report.
   * @param {string} args.newName - The new name for the report.
   * @returns {{ newName?: ReportName; error?: string }} The new name of the report, or an error.
   */
  async renameReport({
    userId,
    oldName,
    newName,
  }: {
    userId: string;
    oldName: string;
    newName: string;
  }): Promise<{ newName?: ReportName; error?: string }> {
    const existingReport = await this.reports.findOne({
      _id: oldName as ReportName,
      ownerId: userId as UserId,
    });
    if (!existingReport) {
      return {
        error: `Report with name '${oldName}' not found for user '${userId}'.`,
      };
    }
    const newNameExists = await this.reports.findOne({
      _id: newName as ReportName,
      ownerId: userId as UserId,
    });
    if (newNameExists) {
      return {
        error: `Report with new name '${newName}' already exists for user '${userId}'.`,
      };
    }

    // Since _id is the primary key (report name), we have to delete and re-insert
    // or use a transaction if available and desired for atomicity, but for a simple rename this is okay.
    // In a real-world scenario with strong consistency needs, one might prefer a transaction or disallow _id changes directly.
    await this.reports.deleteOne({
      _id: oldName as ReportName,
      ownerId: userId as UserId,
    });
    const updatedReport = { ...existingReport, _id: newName as ReportName };
    await this.reports.insertOne(updatedReport);

    return { newName: newName as ReportName };
  }

  /**
   * **query** `_viewReport (userId: String, reportName: String): (Results: String)`
   *
   * **requires** report with the given name exists for the given `userId`
   * **effects** returns results of the report
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @param {string} args.reportName - The name of the report to view.
   * @returns {{ results?: string[]; error?: string }} The results of the report, or an error.
   */
  async _viewReport({
    userId,
    reportName,
  }: {
    userId: string;
    reportName: string;
  }): Promise<{ results?: string[]; error?: string }> {
    const report = await this.reports.findOne({
      _id: reportName as ReportName,
      ownerId: userId as UserId,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user '${userId}'.`,
      };
    }
    return { results: report.results };
  }

  /**
   * **action** `deleteReport (userId: String, reportName: String)`
   *
   * **requires** report exists for the given `userId`
   * **effects** remove the report from the system for the given `userId`
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.reportName - The name of the report to delete.
   * @returns {Empty | { error: string }} An empty object on success, or an error.
   */
  async deleteReport(
    { userId, reportName }: { userId: string; reportName: string },
  ): Promise<Empty | { error: string }> {
    const result = await this.reports.deleteOne({
      _id: reportName as ReportName,
      ownerId: userId as UserId,
    });
    if (result.deletedCount === 0) {
      return {
        error: `Report with name '${reportName}' not found for user '${userId}'.`,
      };
    }
    return {};
  }

  /**
   * Private helper to encapsulate LLM interaction logic.
   * Handles prompt construction, API call, and response parsing/validation.
   * @param {Report} report - The report object to be summarized.
   * @returns {Promise<string>} The stringified, validated JSON summary.
   * @throws {Error} If GEMINI_API_KEY is not set, or if LLM response is invalid.
   */
  private async _callLLMAndGetSummary(report: Report): Promise<string> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const fullPrompt =
      `You are an expert livestock analyst. Given the following report, respond ONLY with valid JSON in this exact format:
{
"highPerformers": [],
"lowPerformers": [],
"concerningTrends": [],
"averagePerformers": [],
"potentialRecordErrors": [],
"insights": "A few short paragraphs (2-3) with deeper analysis: summarize the most important findings, discuss possible causes for low performance or concerning trends, and suggest practical management or intervention strategies for these cases. Do not focus on average/moderate performers, but do mention if the overall average performance of the group stands out as particularly good or bad."
}
Do not include any explanation, commentary, or text before or after the JSON. Only output valid JSON. If you cannot determine a category, return an empty array for that field. Only include animals/mothers in 'averagePerformers' if they are not in any other category. Every animal in the report must be classified into at least one of the following categories: highPerformers, lowPerformers, concerningTrends, averagePerformers, or potentialRecordErrors. No animal should be left unclassified.

Be highly suspicious of questionable or inconsistent records. Be liberal about classifying something as a potential record error: if there is any reasonable doubt or anything seems odd, include the animal or mother in 'potentialRecordErrors' and mention the issue in 'insights'. Do not hesitate to flag records that seem unusual or inconsistent.

Here are some examples of suspicious or potentially erroneous records:
- A mother having more weaned than birthed
- Weaning records without a corresponding birth record
- Negative or impossible values (e.g., negative weights, negative gains, or negative counts)
- Impossibly high or low numbers for the species or age (e.g., a lamb weighing 500kg, or a newborn with an adult weight)
- Obvious typos (such as an extra zero, misplaced decimal, or swapped digits)
- Duplicate or missing records
- Any other data that seems inconsistent, out of range, or highly unlikely
Mark records as a potential record error if they may include a typo or if the values are impossibly good or bad for the species or age. Err on the side of caution and flag anything that could possibly be a record error.

Absolutely ensure that every animal or mother you think might have a record error is included in the 'potentialRecordErrors' array—no exceptions. If you mention or suspect a record error for an animal or mother in your analysis, their ID must appear in 'potentialRecordErrors'.

Here is the report data:
Report Name: ${report._id}
Generated Date: ${report.dateGenerated.toISOString()}
Target Mothers: ${report.target.join(", ")}
Report Entries:
${report.results.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}
`;

    const result = await model.generateContent(fullPrompt);
    let text = result.response.text(); // Get raw text

    // Pre-processing for LLM output: remove markdown code block delimiters
    text = text.trim();
    if (text.startsWith("```json")) {
      text = text.substring("```json".length).trimStart();
    }
    if (text.endsWith("```")) {
      text = text.substring(0, text.length - "```".length).trimEnd();
    }

    let parsedResponse: LLMSummaryOutput;
    try {
      parsedResponse = JSON.parse(text);
      // Basic validation of the parsed structure and types
      if (
        !Array.isArray(parsedResponse.highPerformers) ||
        !parsedResponse.highPerformers.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.lowPerformers) ||
        !parsedResponse.lowPerformers.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.concerningTrends) ||
        !parsedResponse.concerningTrends.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.averagePerformers) ||
        !parsedResponse.averagePerformers.every((item) =>
          typeof item === "string"
        ) ||
        !Array.isArray(parsedResponse.potentialRecordErrors) ||
        !parsedResponse.potentialRecordErrors.every((item) =>
          typeof item === "string"
        ) ||
        typeof parsedResponse.insights !== "string"
      ) {
        throw new Error(
          "Parsed JSON does not match expected structure or types.",
        );
      }
    } catch (parseError) {
      console.error(
        "LLM response was not valid JSON or did not match structure:",
        text,
        parseError,
      );
      throw new Error(`Invalid JSON response from LLM. Raw response: ${text}`);
    }

    return text; // Return the stringified, validated JSON
  }

  /**
   * **query** `_aiSummary (userId: String, reportName: String): (summary: String)`
   *
   * **requires** report exists for the given `userId`
   * **effects** The AI generates a summary of the report, highlighting key takeaways
   * and trends shown in the report, and saves it for future viewing.
   * If a summary already exists, it is returned without calling the AI.
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @param {string} args.reportName - The name of the report to summarize.
   * @returns {{ summary?: string; error?: string }} The AI-generated summary (as a stringified JSON), or an error.
   */
  async _aiSummary({
    userId,
    reportName,
  }: {
    userId: string;
    reportName: string;
  }): Promise<{ summary?: string; error?: string }> {
    const report = await this.reports.findOne({
      _id: reportName as ReportName,
      ownerId: userId as UserId,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user '${userId}'.`,
      };
    }

    // New: If a summary already exists, return it immediately to avoid redundant AI calls.
    if (report.summary !== "") {
      return { summary: report.summary };
    }

    // Otherwise, generate a new summary
    try {
      const generatedSummary = await this._callLLMAndGetSummary(report);

      // Save the generated summary back to the report
      await this.reports.updateOne(
        { _id: reportName as ReportName, ownerId: userId as UserId },
        { $set: { summary: generatedSummary } },
      );

      return { summary: generatedSummary };
    } catch (llmError: unknown) {
      console.error(
        `Error generating AI summary for user '${userId}' report '${reportName}':`,
        llmError,
      );
      const message =
        llmError && typeof llmError === "object" && "message" in llmError
          ? String((llmError as { message?: unknown }).message)
          : "Unknown LLM error";
      return {
        error: `Failed to generate AI summary for user '${userId}' report '${reportName}': ${message}`,
      };
    }
  }

  /**
   * **action** `regenerateAISummary (userId: String, reportName: String): (summary: String)`
   *
   * **requires** report exists for the given `userId`
   * **effects** Forces the AI to generate a new summary of the report,
   * overwriting any existing summary, and saves it for future viewing.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.reportName - The name of the report to re-summarize.
   * @returns {{ summary?: string; error?: string }} The newly AI-generated summary (as a stringified JSON), or an error.
   */
  async regenerateAISummary({
    userId,
    reportName,
  }: {
    userId: string;
    reportName: string;
  }): Promise<{ summary?: string; error?: string }> {
    const report = await this.reports.findOne({
      _id: reportName as ReportName,
      ownerId: userId as UserId,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user '${userId}'.`,
      };
    }

    // Always generate a new summary, overwriting any existing one
    try {
      const generatedSummary = await this._callLLMAndGetSummary(report);

      // Save the generated summary back to the report
      await this.reports.updateOne(
        { _id: reportName as ReportName, ownerId: userId as UserId },
        { $set: { summary: generatedSummary } },
      );

      return { summary: generatedSummary };
    } catch (llmError: unknown) {
      console.error(
        `Error regenerating AI summary for user '${userId}' report '${reportName}':`,
        llmError,
      );
      const message =
        llmError && typeof llmError === "object" && "message" in llmError
          ? String((llmError as { message?: unknown }).message)
          : "Unknown LLM error";
      return {
        error: `Failed to regenerate AI summary for user '${userId}' report '${reportName}': ${message}`,
      };
    }
  }

  /**
   * **query** `_listMothers (userId: String): (mother: Mother)`
   *
   * **requires** true
   * **effects** Returns a list of all mother animals owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @returns {{ mother?: Mother[]; error?: string }} An array of mother objects, or an error.
   */
  async _listMothers({
    userId,
  }: {
    userId: string;
  }): Promise<{ mother?: Mother[]; error?: string }> {
    try {
      const mothers = await this.mothers.find({ ownerId: userId as UserId })
        .project({ _id: 1, notes: 1, nextLitterNumber: 1, ownerId: 1 }).toArray();
      // Ensure we return an array of objects matching the Mother interface structure
      return {
        mother: mothers.map((m) => ({
          _id: m._id,
          ownerId: m.ownerId,
          notes: m.notes,
          nextLitterNumber: m.nextLitterNumber,
        })),
      };
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return { error: `Failed to list mothers for user '${userId}': ${message}` };
    }
  }

  /**
   * **query** `_listLittersByMother (userId: String, motherId: String): (litter: Litter)`
   *
   * **requires** `motherId` exists for the given `userId`
   * **effects** Returns a list of all litters for the specified mother, owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @param {string} args.motherId - The ID of the mother whose litters to list.
   * @returns {{ litter?: Litter[]; error?: string }} An array of litter objects, or an error.
   */
  async _listLittersByMother({
    userId,
    motherId,
  }: {
    userId: string;
    motherId: string;
  }): Promise<{ litter?: Litter[]; error?: string }> {
    // Check requires: motherId exists for this user
    const existingMother = await this.mothers.findOne({
      _id: motherId as ID,
      ownerId: userId as UserId,
    });
    if (!existingMother) {
      return {
        error: `Mother with ID '${motherId}' not found for user '${userId}'.`,
      };
    }

    try {
      const litters = await this.litters.find({
        motherId: motherId as ID,
        ownerId: userId as UserId,
      })
        .toArray();
      return {
        litter: litters.map((l) => ({
          _id: l._id,
          ownerId: l.ownerId,
          motherId: l.motherId,
          fatherId: l.fatherId,
          birthDate: l.birthDate,
          reportedLitterSize: l.reportedLitterSize,
          notes: l.notes,
        })),
      };
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return {
        error:
          `Failed to list litters for mother '${motherId}' for user '${userId}': ${message}`,
      };
    }
  }

  /**
   * **query** `_listOffspringByLitter (userId: String, litterId: String): (offspring: Offspring)`
   *
   * **requires** `litterId` exists for the given `userId`
   * **effects** Returns a list of all offspring linked to the specified litter, owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @param {string} args.litterId - The ID of the parent litter.
   * @returns {{ offspring?: Offspring[]; error?: string }} An array of offspring objects, or an error.
   */
  async _listOffspringByLitter({
    userId,
    litterId,
  }: {
    userId: string;
    litterId: string;
  }): Promise<{ offspring?: Offspring[]; error?: string }> {
    // Check requires: litterId exists for this user
    const existingLitter = await this.litters.findOne({
      _id: litterId as ID,
      ownerId: userId as UserId,
    });
    if (!existingLitter) {
      return {
        error: `Litter with ID '${litterId}' not found for user '${userId}'.`,
      };
    }

    try {
      const offspringList = await this.offspring.find({
        litterId: litterId as ID,
        ownerId: userId as UserId,
      }).toArray();
      return {
        offspring: offspringList.map((o) => ({
          _id: o._id,
          ownerId: o.ownerId,
          litterId: o.litterId,
          sex: o.sex,
          notes: o.notes,
          isAlive: o.isAlive,
          survivedTillWeaning: o.survivedTillWeaning,
        })),
      };
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return {
        error:
          `Failed to list offspring for litter '${litterId}' for user '${userId}': ${message}`,
      };
    }
  }
}
````
