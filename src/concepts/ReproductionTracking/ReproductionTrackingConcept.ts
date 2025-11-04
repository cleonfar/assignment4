import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// Declare collection prefix, use concept name
const PREFIX = "ReproductionTracking.";

// Generic types of this concept for strong typing of IDs
type UserId = ID; // New type for user identifiers
type MotherId = ID; // User-provided identifier for a mother, unique per user
type LitterId = ID; // Internal Mongo _id for litters (system-generated)
type OffspringId = ID; // User-provided identifier for offspring, unique per user
type ReportName = string; // User-provided report name, unique per user

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
  _id: ID; // System-generated unique ID (Mongo _id)
  ownerId: UserId; // The ID of the user who owns this mother.
  externalId: MotherId; // User-provided ID, unique per owner
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
  _id: ID; // System-generated unique ID (Mongo _id)
  ownerId: UserId; // The ID of the user who owns this litter. Derived from the mother.
  motherId: MotherId; // Link to the mother via her external (user-provided) ID.
  fatherId: ID; // Link to the father of this litter, or UNKNOWN_FATHER_ID.
  birthDate: Date; // The birth date of the litter.
  reportedLitterSize: number; // The reported number of offspring in the litter.
  notes: string; // Notes about the litter. Stored as "" if not provided.
}

/**
 * Represents an individual offspring, linked to a parent litter.
 */
interface Offspring {
  _id: ID; // System-generated unique ID (Mongo _id)
  ownerId: UserId; // The ID of the user who owns this offspring. Derived from the litter/mother.
  litterId: ID; // Link to its parent litter (litter _id)
  externalId: OffspringId; // User-provided ID for the offspring, unique per owner
  sex: "male" | "female" | "neutered"; // The sex of the offspring.
  notes: string; // Notes about the offspring. Stored as "" if not provided.
  isAlive: boolean; // Indicates if the offspring is currently alive.
  survivedTillWeaning: boolean; // Indicates if the offspring survived till weaning.
}

/**
 * Represents a generated report on reproductive performance.
 */
interface Report {
  _id: ID; // System-generated unique ID (Mongo _id)
  ownerId: UserId; // The ID of the user who owns this report.
  name: ReportName; // User-provided name, unique per owner
  dateGenerated: Date; // The date the report was generated.
  target: ID[]; // Target mother external IDs for this report.
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

  // Normalize incoming dates (Date or ISO string) into Date objects
  private _toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  // --- Cycle detection utilities (user-scoped DAG of parentage) ---
  // We model a graph where nodes are animal external IDs (mothers and offspring share the same ID namespace),
  // and edges go from a parent (motherId/fatherId) to each offspring.externalId produced in a litter.
  // UNKNOWN_FATHER_ID is skipped.

  // Build a parent->children adjacency map for a user
  private async _buildParentToChildrenMap(
    user: UserId,
  ): Promise<Map<ID, Set<ID>>> {
    const map = new Map<ID, Set<ID>>();

    // Fetch all litters for this user (parents live here)
    const litters = await this.litters.find({ ownerId: user }).project({
      _id: 1,
      motherId: 1,
      fatherId: 1,
    }).toArray();
    if (litters.length === 0) return map;

    // Fetch all offspring for this user and group by litterId
    const offspring = await this.offspring.find({ ownerId: user }).project({
      litterId: 1,
      externalId: 1,
    }).toArray();
    const byLitter = new Map<ID, ID[]>();
    for (const o of offspring) {
      const lid = o.litterId as ID;
      const arr = byLitter.get(lid) ?? [];
      arr.push(o.externalId as ID);
      byLitter.set(lid, arr);
    }

    // Build edges: motherId -> child, fatherId (if not UNKNOWN) -> child
    for (const l of litters) {
      const children = byLitter.get(l._id as ID) ?? [];
      const parents: ID[] = [l.motherId as ID];
      if (l.fatherId && l.fatherId !== UNKNOWN_FATHER_ID) {
        parents.push(l.fatherId as ID);
      }
      for (const p of parents) {
        if (!map.has(p)) map.set(p, new Set<ID>());
        const set = map.get(p)!;
        for (const c of children) set.add(c);
      }
    }

    return map;
  }

  // Determine if `start` is an ancestor of `target` using the computed map
  private _isAncestor(map: Map<ID, Set<ID>>, start: ID, target: ID): boolean {
    if (start === target) return true; // Treat identity as ancestor for immediate self-loop detection
    const seen = new Set<ID>();
    const queue: ID[] = [];
    queue.push(start);
    seen.add(start);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const children = map.get(cur);
      if (!children) continue;
      for (const ch of children) {
        if (ch === target) return true;
        if (!seen.has(ch)) {
          seen.add(ch);
          queue.push(ch);
        }
      }
    }
    return false;
  }

  // Check whether adding edges parent->child for the given parents would create a cycle
  private async _wouldCreateCycleOnAddChild(
    user: UserId,
    child: ID,
    parents: ID[],
  ): Promise<boolean> {
    // Immediate self-loop
    if (parents.some((p) => p === child)) return true;
    const map = await this._buildParentToChildrenMap(user);
    // If child is already an ancestor of any parent, adding parent->child closes a cycle
    for (const p of parents) {
      if (p === UNKNOWN_FATHER_ID) continue;
      if (this._isAncestor(map, child, p)) return true;
    }
    return false;
  }

  // Check cycle when re-linking an existing child to new parents (updateOffspring: change litter and/or rename externalId)
  private async _wouldCreateCycleOnRelinkChild(
    user: UserId,
    childOldId: ID,
    oldParentIds: ID[] | undefined,
    childNewId: ID,
    newParentIds: ID[],
  ): Promise<boolean> {
    // If any new parent equals new child -> self-loop
    if (newParentIds.some((p) => p === childNewId)) return true;
    const map = await this._buildParentToChildrenMap(user);

    // Remove edges from old parents to old child in the hypothetical new graph
    if (oldParentIds && oldParentIds.length > 0) {
      for (const op of oldParentIds) {
        if (op === UNKNOWN_FATHER_ID) continue;
        const set = map.get(op);
        if (set) set.delete(childOldId);
      }
    }

    // Now check if new child is already ancestor of any new parent in this adjusted graph
    for (const np of newParentIds) {
      if (np === UNKNOWN_FATHER_ID) continue;
      if (this._isAncestor(map, childNewId, np)) return true;
    }
    return false;
  }

  /**
   * **action** `addMother (user: String, motherId: String): (motherId: String)`
   *
   * **requires** no Mother with the given `motherId` and `user` already exists
   * **effects** mother is added to the set of mothers. The next litter for this mother will be assigned ID '1'.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.motherId - The unique identifier for the mother.
   * @returns {{ motherId?: MotherId; error?: string }} The ID of the added mother, or an error.
   */
  async addMother({
    user,
    motherId,
  }: {
    user: string;
    motherId: string;
  }): Promise<{ motherId?: MotherId; error?: string }> {
    const existingMother = await this.mothers.findOne({
      externalId: motherId as ID,
      ownerId: user as UserId,
    });
    if (existingMother) {
      return {
        error:
          `Mother with ID '${motherId}' already exists for user '${user}'.`,
      };
    }

    const newMother: Mother = {
      _id: freshID(),
      ownerId: user as UserId,
      externalId: motherId as ID,
      notes: "", // Default to empty string
      nextLitterNumber: 1, // Initialize for the first litter
    };

    await this.mothers.insertOne(newMother);
    return { motherId: newMother._id };
  }

  /**
   * **action** `removeMother (user: String, motherId: String): (motherId: String)`
   *
   * **requires** a mother with this ID and `user` is in the set of mothers
   * **effects** removes this mother from the set of mothers.
   * **Also, removes any litters associated with this mother, and all offspring associated with those litters, all belonging to the same user.**
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.motherId - The unique identifier of the mother to remove.
   * @returns {{ motherId?: MotherId; error?: string }} The ID of the removed mother, or an error.
   */
  async removeMother({
    user,
    motherId,
  }: {
    user: string;
    motherId: string;
  }): Promise<{ motherId?: MotherId; error?: string }> {
    const existingMother = await this.mothers.findOne({
      externalId: motherId as ID,
      ownerId: user as UserId,
    });
    if (!existingMother) {
      return {
        error: `Mother with ID '${motherId}' not found for user '${user}'.`,
      };
    }

    // 1. Find all litters associated with this mother and user
    const littersToDelete = await this.litters.find({
      motherId: motherId as ID,
      ownerId: user as UserId,
    }).toArray();
    const litterIdsToDelete = littersToDelete.map((litter) => litter._id);

    // 2. Delete all offspring associated with these litters and user
    if (litterIdsToDelete.length > 0) {
      await this.offspring.deleteMany({
        litterId: { $in: litterIdsToDelete },
        ownerId: user as UserId,
      });
    }

    // 3. Delete all litters associated with this mother and user
    await this.litters.deleteMany({
      motherId: motherId as ID,
      ownerId: user as UserId,
    });

    // 4. Delete the mother herself
    const result = await this.mothers.deleteOne({
      _id: existingMother._id,
      ownerId: user as UserId,
    });

    if (result.deletedCount === 0) {
      // This should ideally not happen if existingMother was found, but as a safeguard.
      return {
        error:
          `Mother with ID '${motherId}' not found for user '${user}' during final deletion.`,
      };
    }
    return { motherId: motherId as ID };
  }

  /**
   * **action** `recordLitter (user: String, motherId: String, fatherId: String?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litterID: String)`
   *
   * **requires** motherId exists for the given `user`. The generated litter ID (motherId-sequentialNumber) does not already exist for the given `user`.
   * **effects** Creates a new litter record with the provided information, assigning a sequential ID unique to the mother and user.
   * Also adds the mother to the set of mothers if she isn't there already for this user, initializing her `nextLitterNumber`.
   * Increments the `nextLitterNumber` for the mother owned by this user.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.motherId - The ID of the mother.
   * @param {string} [args.fatherId] - Optional ID of the father.
   * @param {Date} args.birthDate - The birth date of the litter.
   * @param {number} args.reportedLitterSize - The reported number of offspring in the litter.
   * @param {string} [args.notes] - Optional notes for the litter.
   * @returns {{ litterID?: LitterId; error?: string }} The ID of the new litter, or an error.
   */
  async recordLitter({
    user,
    motherId,
    fatherId,
    birthDate,
    reportedLitterSize,
    notes,
  }: {
    user: string;
    motherId: string;
    fatherId?: string;
    birthDate: Date | string;
    reportedLitterSize: number;
    notes?: string;
  }): Promise<{ litterID?: LitterId; error?: string }> {
    // Check if mother exists for this user by externalId. If not, add her with default nextLitterNumber: 1
    let mother = await this.mothers.findOne({
      externalId: motherId as ID,
      ownerId: user as UserId,
    });
    if (!mother) {
      const addMotherResult = await this.addMother({ user, motherId });
      if (addMotherResult.error) {
        return {
          error:
            `Failed to ensure mother exists for user '${user}': ${addMotherResult.error}`,
        };
      }
      // Re-fetch mother to get the initialized nextLitterNumber
      mother = await this.mothers.findOne({
        externalId: motherId as ID,
        ownerId: user as UserId,
      });
      if (!mother) { // Should not happen if addMother was successful
        return {
          error:
            `Internal error: Mother not found for user '${user}' after creation.`,
        };
      }
    }

    // Ensure nextLitterNumber exists on the mother object (for robustness with old data or if not properly initialized)
    if (
      mother.nextLitterNumber === undefined || mother.nextLitterNumber === null
    ) {
      mother.nextLitterNumber = 1; // Default if somehow missing or for legacy data
    }

    const actualMotherId = motherId as ID; // external mother ID
    const actualFatherId: ID = fatherId ? (fatherId as ID) : UNKNOWN_FATHER_ID;

    // Remember nextLitterNumber for sequencing, but litter _id will be system-generated now
    const newLitterNumber = mother.nextLitterNumber;

    // Update mother's nextLitterNumber *before* inserting the litter,
    // to reserve the number. If litter insertion fails, a number might be skipped.
    const updatedNextLitterNumber = newLitterNumber + 1;
    await this.mothers.updateOne(
      { externalId: actualMotherId, ownerId: user as UserId },
      { $set: { nextLitterNumber: updatedNextLitterNumber } },
    );

    // Parse and validate birth date
    const parsedBirthDate = this._toDate(birthDate);
    if (isNaN(parsedBirthDate.getTime())) {
      return { error: "Invalid birth date provided." };
    }

    // Prevent duplicate litters for the same mother/father/date
    const duplicateCombo = await this.litters.findOne({
      ownerId: user as UserId,
      motherId: actualMotherId,
      fatherId: actualFatherId,
      birthDate: parsedBirthDate,
    });
    if (duplicateCombo) {
      const fatherText = actualFatherId === UNKNOWN_FATHER_ID
        ? "none"
        : actualFatherId;
      return {
        error:
          `A litter with mother ${actualMotherId}, father ${fatherText}, and birth date ${parsedBirthDate.toISOString()} already exists for user '${user}'.`,
      };
    }

    const newLitter: Litter = {
      _id: freshID(),
      ownerId: user as UserId, // Assign ownerId to the litter
      motherId: actualMotherId,
      fatherId: actualFatherId,
      birthDate: parsedBirthDate,
      reportedLitterSize,
      notes: notes ?? "", // Optional notes should default to an empty string if not provided
    };
    await this.litters.insertOne(newLitter);
    return { litterID: newLitter._id };
  }

  /**
   * **action** `updateLitter (user: String, litterId: String, motherId: String?, fatherId: String?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litterID: String)`
   *
   * **requires** `litterId` exists for the given `user`. `motherId` cannot be changed for an existing litter.
   * **effects** Updates any given information about the litter.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.litterId - The ID of the litter to update.
   * @param {string} [args.motherId] - New ID of the mother (not allowed to change).
   * @param {string} [args.fatherId] - New optional ID of the father.
   * @param {Date} [args.birthDate] - New birth date.
   * @param {number} [args.reportedLitterSize] - New reported litter size.
   * @param {string} [args.notes] - New optional notes.
   * @returns {{ litterID?: LitterId; error?: string }} The ID of the updated litter, or an error.
   */
  async updateLitter({
    user,
    litterId,
    motherId,
    fatherId,
    birthDate,
    reportedLitterSize,
    notes,
  }: {
    user: string;
    litterId: string;
    motherId?: string;
    fatherId?: string;
    birthDate?: Date | string;
    reportedLitterSize?: number;
    notes?: string;
  }): Promise<{ litterID?: LitterId; error?: string }> {
    const existingLitter = await this.litters.findOne({
      _id: litterId as ID,
      ownerId: user as UserId,
    });
    if (!existingLitter) {
      return {
        error: `Litter with ID '${litterId}' not found for user '${user}'.`,
      };
    }

    // Restriction: Cannot change motherId for an existing litter.
    // Changing motherId would require re-assigning the litter's primary ID (e.g., from 'MotherA-X' to 'MotherB-Y'),
    // which is a complex operation equivalent to deleting and re-creating the litter and its offspring,
    // and is beyond a simple 'updateLitter' action.
    if (motherId !== undefined && motherId !== existingLitter.motherId) {
      return {
        error:
          `Cannot change 'motherId' for an existing litter with ID '${litterId}'. Litter IDs are tied to their mother's sequence.`,
      };
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
    if (birthDate !== undefined) {
      const parsed = this._toDate(birthDate);
      if (isNaN(parsed.getTime())) {
        return { error: "Invalid birth date provided." };
      }
      updateFields.birthDate = parsed;
    }
    if (reportedLitterSize !== undefined) {
      updateFields.reportedLitterSize = reportedLitterSize;
    }
    // Handle notes update: if explicitly provided as undefined, set to empty string.
    // If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], "notes")) {
      updateFields.notes = notes ?? ""; // Optional notes should default to an empty string if not provided
    }

    const result = await this.litters.updateOne(
      { _id: litterId as ID, ownerId: user as UserId },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      // This case indicates that the litter might have been deleted by another operation
      // after the findOne but before the updateOne, or ownerId/litterId didn't match.
      return {
        error:
          `Litter with ID '${litterId}' not found for user '${user}' for update.`,
      };
    }
    return { litterID: litterId as ID };
  }

  /**
   * **action** `recordOffspring (user: String, litterId: String, offspringId: String, sex: Enum [male, female, neutered], notes: String?): (offspringID: String)`
   *
   * **requires** `litterId` exists for the given `user` and `offspringId` does not exist for the given `user`.
   * **effects** creates an individual offspring record linked to the specified litter, owned by the user.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.litterId - The ID of the parent litter.
   * @param {string} args.offspringId - The unique identifier for the offspring.
   * @param {'male' | 'female' | 'neutered'} args.sex - The sex of the offspring.
   * @param {string} [args.notes] - Optional notes for the offspring.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the new offspring, or an error.
   */
  async recordOffspring({
    user,
    litterId,
    offspringId,
    sex,
    notes,
  }: {
    user: string;
    litterId: string;
    offspringId: string;
    sex: "male" | "female" | "neutered";
    notes?: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    // Check requires: litterId exists for this user
    const existingLitter = await this.litters.findOne({
      _id: litterId as ID,
      ownerId: user as UserId,
    });
    if (!existingLitter) {
      return {
        error: `Litter with ID '${litterId}' not found for user '${user}'.`,
      };
    }

    // Check requires: offspring externalId does not exist for this user
    const existingOffspring = await this.offspring.findOne({
      externalId: offspringId as ID,
      ownerId: user as UserId,
    });
    if (existingOffspring) {
      return {
        error:
          `Offspring with ID '${offspringId}' already exists for user '${user}'.`,
      };
    }

    // Cycle detection: adding edges parent->offspringId must not create a cycle
    const prospectiveParents: ID[] = [existingLitter.motherId as ID];
    if (
      existingLitter.fatherId && existingLitter.fatherId !== UNKNOWN_FATHER_ID
    ) {
      prospectiveParents.push(existingLitter.fatherId as ID);
    }
    const cycle = await this._wouldCreateCycleOnAddChild(
      user as UserId,
      offspringId as ID,
      prospectiveParents,
    );
    if (cycle) {
      return {
        error:
          `Invalid parentage: adding offspring '${offspringId}' under mother '${existingLitter.motherId}'` +
          (existingLitter.fatherId &&
              existingLitter.fatherId !== UNKNOWN_FATHER_ID
            ? ` and father '${existingLitter.fatherId}'`
            : "") +
          ` would create an ancestry cycle for user '${user}'.`,
      };
    }

    const newOffspring: Offspring = {
      _id: freshID(),
      ownerId: user as UserId, // Assign ownerId to the offspring
      litterId: litterId as ID,
      externalId: offspringId as ID,
      sex,
      notes: notes ?? "", // Optional notes should default to an empty string if not provided
      isAlive: true, // New offspring are assumed alive
      survivedTillWeaning: false, // Not yet weaned
    };
    await this.offspring.insertOne(newOffspring);
    return { offspringID: newOffspring.externalId };
  }

  /**
   * **action** `updateOffspring (user: String, oldOffspringId: String, newOffspringId: String?, litterId: String?, sex: Enum?, notes: String?): (offspringID: String)`
   *
   * **requires** `oldOffspringId` exists for the given `user`. If `newOffspringId` is provided and different from `oldOffspringId`,
   * it must not already exist for the given `user`. If `litterId` is changed, the new litter must exist for the same `user`.
   * **effects** Finds the offspring by `oldOffspringId` and `user`. If `newOffspringId` is provided and different,
   * renames the offspring's ID to `newOffspringId` (by deleting the old record and inserting a new one
   * with the updated ID and other fields). Otherwise, updates any other given information about the offspring.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.oldOffspringId - The current ID of the offspring to update.
   * @param {string} [args.newOffspringId] - The optional new ID for the offspring. If not provided, `oldOffspringId` is used.
   * @param {string} [args.litterId] - New ID of the parent litter.
   * @param {'male' | 'female' | 'neutered'} [args.sex] - New sex of the offspring.
   * @param {string} [args.notes] - New optional notes.
   * @returns {{ offspringID?: OffspringId; error?: string }} The final ID of the updated offspring, or an error.
   */
  async updateOffspring({
    user,
    oldOffspringId,
    newOffspringId,
    litterId,
    sex,
    notes,
  }: {
    user: string;
    oldOffspringId: string;
    newOffspringId?: string;
    litterId?: string;
    sex?: "male" | "female" | "neutered";
    notes?: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    // Find the offspring by externalId and owner
    const existingOffspring = await this.offspring.findOne({
      externalId: oldOffspringId as ID,
      ownerId: user as UserId,
    });
    if (!existingOffspring) {
      return {
        error:
          `Offspring with ID '${oldOffspringId}' not found for user '${user}'.`,
      };
    }

    // Build update set
    const updateFields: Partial<Offspring> & { externalId?: OffspringId } = {};
    if (litterId !== undefined) {
      const existingLitter = await this.litters.findOne({
        _id: litterId as ID,
        ownerId: user as UserId,
      });
      if (!existingLitter) {
        return {
          error:
            `New litter with ID '${litterId}' not found for user '${user}'.`,
        };
      }
      updateFields.litterId = litterId as ID;
    }
    if (sex !== undefined) updateFields.sex = sex;
    if (Object.prototype.hasOwnProperty.call(arguments[0], "notes")) {
      updateFields.notes = notes ?? "";
    }

    // Handle external ID change
    const finalNewOffspringId: OffspringId =
      (newOffspringId ?? oldOffspringId) as OffspringId;
    if (
      newOffspringId !== undefined &&
      finalNewOffspringId !== oldOffspringId as ID
    ) {
      const conflict = await this.offspring.findOne({
        externalId: finalNewOffspringId,
        ownerId: user as UserId,
      });
      if (conflict) {
        return {
          error:
            `New offspring ID '${finalNewOffspringId}' already exists for user '${user}'. Cannot rename.`,
        };
      }
      updateFields.externalId = finalNewOffspringId; // extend update with externalId
    }

    // Cycle detection on relink/rename
    // Determine current litter and parents (old)
    const currentLitter = await this.litters.findOne({
      _id: existingOffspring.litterId as ID,
      ownerId: user as UserId,
    });
    const oldParents: ID[] | undefined = currentLitter
      ? [currentLitter.motherId as ID].concat(
        (currentLitter.fatherId && currentLitter.fatherId !== UNKNOWN_FATHER_ID)
          ? [currentLitter.fatherId as ID]
          : [],
      )
      : undefined;

    // Determine target litter and parents (new)
    const targetLitterId =
      (updateFields.litterId ?? existingOffspring.litterId) as ID;
    const targetLitter = await this.litters.findOne({
      _id: targetLitterId,
      ownerId: user as UserId,
    });
    if (!targetLitter) {
      return {
        error: `Target litter with ID '${
          String(targetLitterId)
        }' not found for user '${user}'.`,
      };
    }
    const newParents: ID[] = [targetLitter.motherId as ID];
    if (targetLitter.fatherId && targetLitter.fatherId !== UNKNOWN_FATHER_ID) {
      newParents.push(targetLitter.fatherId as ID);
    }

    // Quick self-loop guard on rename vs parents
    if (newParents.includes(finalNewOffspringId as ID)) {
      return {
        error: `Invalid parentage: offspring ID '${
          String(finalNewOffspringId)
        }' matches a parent ID in litter '${String(targetLitterId)}'.`,
      };
    }

    const relinkCycle = await this._wouldCreateCycleOnRelinkChild(
      user as UserId,
      existingOffspring.externalId as ID,
      oldParents,
      finalNewOffspringId as ID,
      newParents,
    );
    if (relinkCycle) {
      return {
        error:
          `Invalid parentage: updating offspring '${oldOffspringId}' would create an ancestry cycle (new ID '${
            String(finalNewOffspringId)
          }').`,
      };
    }

    if (
      Object.keys(updateFields).length === 0 &&
      finalNewOffspringId === existingOffspring.externalId
    ) {
      return { offspringID: finalNewOffspringId };
    }

    const result = await this.offspring.updateOne(
      { externalId: oldOffspringId as ID, ownerId: user as UserId },
      { $set: updateFields },
    );
    if (result.matchedCount === 0) {
      return {
        error:
          `Offspring with ID '${oldOffspringId}' not found for user '${user}' for update.`,
      };
    }
    return { offspringID: finalNewOffspringId };
  }

  /**
   * **action** `recordWeaning (user: String, offspringId: String): (offspringID: String)`
   *
   * **requires** offspring with `offspringId` exists for `user` and is alive
   * **effects** Sets `survivedTillWeaning` to be true for the specified offspring
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.offspringId - The ID of the offspring to mark as weaned.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the offspring, or an error.
   */
  async recordWeaning({
    user,
    offspringId,
  }: {
    user: string;
    offspringId: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({
      externalId: offspringId as ID,
      ownerId: user as UserId,
    });
    if (!existingOffspring) {
      return {
        error:
          `Offspring with ID '${offspringId}' not found for user '${user}'.`,
      };
    }
    if (!existingOffspring.isAlive) {
      return {
        error:
          `Offspring with ID '${offspringId}' for user '${user}' is not alive and cannot be weaned.`,
      };
    }

    await this.offspring.updateOne(
      { externalId: offspringId as ID, ownerId: user as UserId },
      { $set: { survivedTillWeaning: true } },
    );
    return { offspringID: offspringId as ID };
  }

  /**
   * **action** `recordDeath (user: String, offspringId: String): (offspringId: String)`
   *
   * **requires** offspring with `offspringId` exists for `user` and is currently living
   * **effects** Sets the `isAlive` flag of this offspring to false.
   *            The `survivedTillWeaning` status is preserved as it represents a past milestone.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.offspringId - The ID of the offspring to mark as deceased.
   * @returns {{ offspringId?: OffspringId; error?: string }} The ID of the offspring, or an error.
   */
  async recordDeath({
    user,
    offspringId,
  }: {
    user: string;
    offspringId: string;
  }): Promise<{ offspringId?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({
      externalId: offspringId as ID,
      ownerId: user as UserId,
    });
    if (!existingOffspring) {
      return {
        error:
          `Offspring with ID '${offspringId}' not found for user '${user}'.`,
      };
    }
    if (!existingOffspring.isAlive) {
      return {
        error:
          `Offspring with ID '${offspringId}' for user '${user}' is already marked as deceased.`,
      };
    }

    // Corrected logic: only set isAlive to false.
    // 'survivedTillWeaning' is a milestone and should not be revoked upon later death.
    await this.offspring.updateOne(
      { externalId: offspringId as ID, ownerId: user as UserId },
      { $set: { isAlive: false } },
    );
    return { offspringId: offspringId as ID };
  }

  /**
   * **action** `generateReport (user: String, target: String, startDateRange: Date, endDateRange: Date, name: String): (results: string[])`
   *
   * **requires** target animal is in the set of mothers for the given `user`.
   * **effects** If no report with this name exists for this `user` then generate a report on the reproductive performance
   * of the given animal within the specified date range, otherwise add the reproductive performance
   * of this animal to the existing report for this `user`.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.target - The ID of the mother animal for which to generate the report.
   * @param {Date} args.startDateRange - The start date for data collection in the report.
   * @param {Date} args.endDateRange - The end date for data collection in the report.
   * @param {string} args.name - The name of the report.
   * @returns {{ results?: string[]; error?: string }} The results of the generated/updated report, or an error.
   */
  async generateReport({
    user,
    target,
    startDateRange,
    endDateRange,
    name,
  }: {
    user: string;
    target: string;
    startDateRange: Date | string;
    endDateRange: Date | string;
    name: string;
  }): Promise<{ results?: string[]; error?: string }> {
    // Check requires: target mother exists for this user
    const existingMother = await this.mothers.findOne({
      externalId: target as ID,
      ownerId: user as UserId,
    });
    if (!existingMother) {
      return {
        error:
          `Target mother with ID '${target}' not found for user '${user}'.`,
      };
    }

    // Parse and validate date range
    const start = this._toDate(startDateRange);
    const end = this._toDate(endDateRange);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { error: "Invalid date range provided." };
    }
    if (start > end) {
      return { error: "Start date cannot be after end date." };
    }

    // --- Start: Actual report generation logic for the specific target and date range ---
    const relevantLitters = await this.litters.find({
      motherId: target as ID,
      ownerId: user as UserId,
      birthDate: { $gte: start, $lte: end },
    }).toArray();

    const littersCount = relevantLitters.length;
    let totalOffspringCount = 0;
    let survivedWeaningCount = 0;

    if (littersCount > 0) {
      const litterIds = relevantLitters.map((l) => l._id);
      const relevantOffspring = await this.offspring.find({
        litterId: { $in: litterIds },
        ownerId: user as UserId,
      }).toArray();

      totalOffspringCount = relevantOffspring.length;
      survivedWeaningCount = relevantOffspring.filter((o) =>
        o.survivedTillWeaning
      ).length;
    }

    // This string represents the "reproductive performance" for this specific target and date range.
    const newPerformanceEntry =
      `Performance for ${target} (${start.toDateString()} to ${end.toDateString()}): ` +
      `Litters: ${littersCount}, Offspring: ${totalOffspringCount}, ` +
      `Weaning Survival: ${
        totalOffspringCount > 0
          ? ((survivedWeaningCount / totalOffspringCount) * 100).toFixed(2) +
            "%"
          : "N/A"
      }`;
    // --- End: Actual report generation logic ---

    const existingReport = await this.reports.findOne({
      ownerId: user as UserId,
      name: name as ReportName,
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
        { ownerId: user as UserId, name: name as ReportName },
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
        _id: freshID(),
        ownerId: user as UserId, // Assign ownerId to the report
        name: name as ReportName,
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
   * **action** `renameReport (user: String, oldName: String, newName: String): (newName: String)`
   *
   * **requires** oldName of report exists for the given `user`. No report with `newName` exists for the given `user`.
   * **effects** renames the specified report for the given `user`.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.oldName - The current name of the report.
   * @param {string} args.newName - The new name for the report.
   * @returns {{ newName?: ReportName; error?: string }} The new name of the report, or an error.
   */
  async renameReport({
    user,
    oldName,
    newName,
  }: {
    user: string;
    oldName: string;
    newName: string;
  }): Promise<{ newName?: ReportName; error?: string }> {
    const existingReport = await this.reports.findOne({
      ownerId: user as UserId,
      name: oldName as ReportName,
    });
    if (!existingReport) {
      return {
        error: `Report with name '${oldName}' not found for user '${user}'.`,
      };
    }
    const newNameExists = await this.reports.findOne({
      ownerId: user as UserId,
      name: newName as ReportName,
    });
    if (newNameExists) {
      return {
        error:
          `Report with new name '${newName}' already exists for user '${user}'.`,
      };
    }
    // Simple update of the name field
    const updateRes = await this.reports.updateOne(
      { ownerId: user as UserId, name: oldName as ReportName },
      { $set: { name: newName as ReportName } },
    );
    if (updateRes.matchedCount === 0) {
      return {
        error: `Report with name '${oldName}' not found for user '${user}'.`,
      };
    }
    return { newName: newName as ReportName };
  }

  /**
   * **query** `_viewReport (user: String, reportName: String): (Results: String)`
   *
   * **requires** report with the given name exists for the given `user`
   * **effects** returns results of the report
   * @param {object} args - The query arguments.
   * @param {string} args.user - The ID of the user performing the query.
   * @param {string} args.reportName - The name of the report to view.
   * @returns {{ results?: string[]; error?: string }} The results of the report, or an error.
   */
  async _viewReport({
    user,
    reportName,
  }: {
    user: string;
    reportName: string;
  }): Promise<({ results?: string[]; error?: string })[]> {
    const report = await this.reports.findOne({
      ownerId: user as UserId,
      name: reportName as ReportName,
    });
    if (!report) {
      return [{
        error: `Report with name '${reportName}' not found for user '${user}'.`,
      }];
    }
    return [{ results: report.results }];
  }

  /**
   * **action** `deleteReport (user: String, reportName: String)`
   *
   * **requires** report exists for the given `user`
   * **effects** remove the report from the system for the given `user`
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.reportName - The name of the report to delete.
   * @returns {Empty | { error: string }} An empty object on success, or an error.
   */
  async deleteReport(
    { user, reportName }: { user: string; reportName: string },
  ): Promise<Empty | { error: string }> {
    const result = await this.reports.deleteOne({
      ownerId: user as UserId,
      name: reportName as ReportName,
    });
    if (result.deletedCount === 0) {
      return {
        error: `Report with name '${reportName}' not found for user '${user}'.`,
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
Report Name: ${report.name}
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
   * **query** `_aiSummary (user: String, reportName: String): (summary: String)`
   *
   * **requires** report exists for the given `user`
   * **effects** The AI generates a summary of the report, highlighting key takeaways
   * and trends shown in the report, and saves it for future viewing.
   * If a summary already exists, it is returned without calling the AI.
   * @param {object} args - The query arguments.
   * @param {string} args.user - The ID of the user performing the query.
   * @param {string} args.reportName - The name of the report to summarize.
   * @returns {{ summary?: string; error?: string }} The AI-generated summary (as a stringified JSON), or an error.
   */
  async _aiSummary({
    user,
    reportName,
  }: {
    user: string;
    reportName: string;
  }): Promise<({ summary?: string; error?: string })[]> {
    const report = await this.reports.findOne({
      ownerId: user as UserId,
      name: reportName as ReportName,
    });
    if (!report) {
      return [{
        error: `Report with name '${reportName}' not found for user '${user}'.`,
      }];
    }

    // New: If a summary already exists, return it immediately to avoid redundant AI calls.
    if (report.summary !== "") {
      return [{ summary: report.summary }];
    }

    // Otherwise, generate a new summary
    try {
      const generatedSummary = await this._callLLMAndGetSummary(report);

      // Save the generated summary back to the report
      await this.reports.updateOne(
        { ownerId: user as UserId, name: reportName as ReportName },
        { $set: { summary: generatedSummary } },
      );

      return [{ summary: generatedSummary }];
    } catch (llmError: unknown) {
      console.error(
        `Error generating AI summary for user '${user}' report '${reportName}':`,
        llmError,
      );
      const message =
        llmError && typeof llmError === "object" && "message" in llmError
          ? String((llmError as { message?: unknown }).message)
          : "Unknown LLM error";
      return [{
        error:
          `Failed to generate AI summary for user '${user}' report '${reportName}': ${message}`,
      }];
    }
  }

  /**
   * **action** `regenerateAISummary (user: String, reportName: String): (summary: String)`
   *
   * **requires** report exists for the given `user`
   * **effects** Forces the AI to generate a new summary of the report,
   * overwriting any existing summary, and saves it for future viewing.
   * @param {object} args - The action arguments.
   * @param {string} args.user - The ID of the user performing the action.
   * @param {string} args.reportName - The name of the report to re-summarize.
   * @returns {{ summary?: string; error?: string }} The newly AI-generated summary (as a stringified JSON), or an error.
   */
  async regenerateAISummary({
    user,
    reportName,
  }: {
    user: string;
    reportName: string;
  }): Promise<{ summary?: string; error?: string }> {
    const report = await this.reports.findOne({
      ownerId: user as UserId,
      name: reportName as ReportName,
    });
    if (!report) {
      return {
        error: `Report with name '${reportName}' not found for user '${user}'.`,
      };
    }

    // Always generate a new summary, overwriting any existing one
    try {
      const generatedSummary = await this._callLLMAndGetSummary(report);

      // Save the generated summary back to the report
      await this.reports.updateOne(
        { ownerId: user as UserId, name: reportName as ReportName },
        { $set: { summary: generatedSummary } },
      );

      return { summary: generatedSummary };
    } catch (llmError: unknown) {
      console.error(
        `Error regenerating AI summary for user '${user}' report '${reportName}':`,
        llmError,
      );
      const message =
        llmError && typeof llmError === "object" && "message" in llmError
          ? String((llmError as { message?: unknown }).message)
          : "Unknown LLM error";
      return {
        error:
          `Failed to regenerate AI summary for user '${user}' report '${reportName}': ${message}`,
      };
    }
  }

  /**
   * **query** `_listMothers (user: String): (mother: Mother)`
   *
   * **requires** true
   * **effects** Returns a list of all mother animals owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.user - The ID of the user performing the query.
   * @returns {{ mother?: Mother[]; error?: string }} An array of mother objects, or an error.
   */
  async _listMothers({
    user,
  }: {
    user: string;
  }): Promise<({ mother?: Mother[]; error?: string })[]> {
    try {
      const mothers = await this.mothers.find({ ownerId: user as UserId })
        .project({
          _id: 1,
          externalId: 1,
          notes: 1,
          nextLitterNumber: 1,
          ownerId: 1,
        })
        .toArray();
      // Ensure we return an array of objects matching the Mother interface structure
      return [{
        mother: mothers.map((m) => ({
          _id: m._id,
          ownerId: m.ownerId,
          externalId: (m as Mother).externalId,
          notes: m.notes,
          nextLitterNumber: m.nextLitterNumber,
        })),
      }];
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return [{
        error: `Failed to list mothers for user '${user}': ${message}`,
      }];
    }
  }

  /**
   * **query** `_listLittersByMother (user: String, motherId: String): (litter: Litter)`
   *
   * **requires** `motherId` exists for the given `user`
   * **effects** Returns a list of all litters for the specified mother, owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.user - The ID of the user performing the query.
   * @param {string} args.motherId - The ID of the mother whose litters to list.
   * @returns {{ litter?: Litter[]; error?: string }} An array of litter objects, or an error.
   */
  async _listLittersByMother({
    user,
    motherId,
  }: {
    user: string;
    motherId: string;
  }): Promise<({ litter?: Litter[]; error?: string })[]> {
    // Check requires: motherId exists for this user
    const existingMother = await this.mothers.findOne({
      externalId: motherId as ID,
      ownerId: user as UserId,
    });
    if (!existingMother) {
      return [{
        error: `Mother with ID '${motherId}' not found for user '${user}'.`,
      }];
    }

    try {
      const litters = await this.litters.find({
        motherId: motherId as ID,
        ownerId: user as UserId,
      })
        .toArray();
      return [{
        litter: litters.map((l) => ({
          _id: l._id,
          ownerId: l.ownerId,
          motherId: l.motherId,
          fatherId: l.fatherId,
          birthDate: l.birthDate,
          reportedLitterSize: l.reportedLitterSize,
          notes: l.notes,
        })),
      }];
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return [{
        error:
          `Failed to list litters for mother '${motherId}' for user '${user}': ${message}`,
      }];
    }
  }

  /**
   * **query** `_listOffspringByLitter (user: String, litterId: String): (offspring: Offspring)`
   *
   * **requires** `litterId` exists for the given `user`
   * **effects** Returns a list of all offspring linked to the specified litter, owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.user - The ID of the user performing the query.
   * @param {string} args.litterId - The ID of the parent litter.
   * @returns {{ offspring?: Offspring[]; error?: string }} An array of offspring objects, or an error.
   */
  async _listOffspringByLitter({
    user,
    litterId,
  }: {
    user: string;
    litterId: string;
  }): Promise<({ offspring?: Offspring[]; error?: string })[]> {
    // Check requires: litterId exists for this user
    const existingLitter = await this.litters.findOne({
      _id: litterId as ID,
      ownerId: user as UserId,
    });
    if (!existingLitter) {
      return [{
        error: `Litter with ID '${litterId}' not found for user '${user}'.`,
      }];
    }

    try {
      const offspringList = await this.offspring.find({
        litterId: litterId as ID,
        ownerId: user as UserId,
      }).toArray();
      return [{
        offspring: offspringList.map((o) => ({
          _id: o._id,
          ownerId: o.ownerId,
          litterId: o.litterId,
          externalId: o.externalId,
          sex: o.sex,
          notes: o.notes,
          isAlive: o.isAlive,
          survivedTillWeaning: o.survivedTillWeaning,
        })),
      }];
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return [{
        error:
          `Failed to list offspring for litter '${litterId}' for user '${user}': ${message}`,
      }];
    }
  }

  /**
   * **query** `_listReports (user: String): (report: Report)`
   *
   * **requires** true
   * **effects** Returns a list of all reports owned by the specified user.
   * @param {object} args - The query arguments.
   * @param {string} args.user - The ID of the user performing the query.
   * @returns {{ report?: Report[]; error?: string }} An array of report objects, or an error.
   */
  async _listReports({
    user,
  }: {
    user: string;
  }): Promise<({ report?: Report[]; error?: string })[]> {
    try {
      const reports = await this.reports.find({ ownerId: user as UserId })
        .toArray();
      return [{
        report: reports.map((r) => ({
          _id: r._id,
          ownerId: r.ownerId,
          name: r.name,
          dateGenerated: r.dateGenerated,
          target: r.target,
          results: r.results,
          summary: r.summary,
        })),
      }];
    } catch (e: unknown) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Unknown error";
      return [{
        error: `Failed to list reports for user '${user}': ${message}`,
      }];
    }
  }
}
