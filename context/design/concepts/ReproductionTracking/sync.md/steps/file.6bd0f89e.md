---
timestamp: 'Mon Nov 03 2025 18:47:06 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_184706.675c45fd.md]]'
content_id: 6bd0f89ef23bcc417cc29b390061429fb786df2988554acae4c23889e8cddacd
---

# file: src/concepts/GrowthTracking/GrowthTrackingConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

const PREFIX = "GrowthTracking.";

type UserId = ID;
type AnimalId = ID; // Generic ID for an animal
type GrowthRecordId = ID;

/**
 * Represents a growth record for an animal.
 * Each record is owned by a specific user.
 */
interface GrowthRecord {
  _id: GrowthRecordId;
  ownerId: UserId; // The ID of the user who owns this growth record.
  animalId: AnimalId;
  date: Date;
  weight: number; // in some unit, e.g., kg or lbs
  notes: string;
}

/**
 * # concept: GrowthTracking
 *
 * **purpose** Track the growth progress of individual animals over time.
 *
 * **principle** A user can record an animal's weight at different dates,
 * update these records, retrieve a history of growth, and identify the latest
 * measurement for a specific animal, with all records strictly isolated by user.
 */
export default class GrowthTrackingConcept {
  private growthRecords: Collection<GrowthRecord>;

  constructor(private readonly db: Db) {
    this.growthRecords = this.db.collection(PREFIX + "growthRecords");
  }

  // --- Actions ---

  /**
   * **action** `addGrowthRecord (userId: String, animalId: String, date: Date, weight: Number, notes: String?): (recordId: String)`
   *
   * **requires** No growth record with the same `ownerId`, `animalId`, and `date` already exists.
   * **effects** Creates a new growth record for the specified animal, owned by the user.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.animalId - The generic identifier for the animal.
   * @param {Date} args.date - The date of the growth measurement.
   * @param {number} args.weight - The weight recorded.
   * @param {string} [args.notes] - Optional notes for the record.
   * @returns {{ recordId?: GrowthRecordId; error?: string }} The ID of the added growth record, or an error.
   */
  async addGrowthRecord({
    userId,
    animalId,
    date,
    weight,
    notes,
  }: {
    userId: string;
    animalId: string;
    date: Date;
    weight: number;
    notes?: string;
  }): Promise<{ recordId?: GrowthRecordId; error?: string }> {
    // Check precondition: no duplicate record for this user, animal, and date
    const existingRecord = await this.growthRecords.findOne({
      ownerId: userId as UserId,
      animalId: animalId as AnimalId,
      date: date,
    });
    if (existingRecord) {
      return {
        error:
          `Growth record for animal '${animalId}' on '${date.toISOString().split('T')[0]}' already exists for user '${userId}'.`,
      };
    }
    const newRecord: GrowthRecord = {
      _id: freshID() as GrowthRecordId,
      ownerId: userId as UserId,
      animalId: animalId as AnimalId,
      date,
      weight,
      notes: notes ?? "",
    };
    await this.growthRecords.insertOne(newRecord);
    return { recordId: newRecord._id };
  }

  /**
   * **action** `updateGrowthRecord (userId: String, recordId: String, newAnimalId: String?, newDate: Date?, newWeight: Number?, newNotes: String?): (recordId: String)`
   *
   * **requires** A growth record with `recordId` exists for the `userId`.
   * If `newAnimalId` or `newDate` is provided and would result in a duplicate (same `ownerId`, `animalId`, `date`)
   * with another existing record (excluding the one being updated), the action fails.
   * **effects** Updates the specified growth record.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.recordId - The ID of the growth record to update.
   * @param {string} [args.newAnimalId] - The new generic identifier for the animal.
   * @param {Date} [args.newDate] - The new date of the growth measurement.
   * @param {number} [args.newWeight] - The new weight recorded.
   * @param {string} [args.newNotes] - New optional notes for the record.
   * @returns {{ recordId?: GrowthRecordId; error?: string }} The ID of the updated growth record, or an error.
   */
  async updateGrowthRecord({
    userId,
    recordId,
    newAnimalId,
    newDate,
    newWeight,
    newNotes,
  }: {
    userId: string;
    recordId: string;
    newAnimalId?: string;
    newDate?: Date;
    newWeight?: number;
    newNotes?: string;
  }): Promise<{ recordId?: GrowthRecordId; error?: string }> {
    const existingRecord = await this.growthRecords.findOne({
      _id: recordId as GrowthRecordId,
      ownerId: userId as UserId,
    });
    if (!existingRecord) {
      return {
        error: `Growth record '${recordId}' not found for user '${userId}'.`,
      };
    }

    const updateFields: Partial<GrowthRecord> = {};
    if (newAnimalId !== undefined) updateFields.animalId = newAnimalId as AnimalId;
    if (newDate !== undefined) updateFields.date = newDate;
    if (newWeight !== undefined) updateFields.weight = newWeight;
    // Check if newNotes was explicitly passed (even if undefined/null)
    if (Object.prototype.hasOwnProperty.call(arguments[0], "newNotes")) {
      updateFields.notes = newNotes ?? "";
    }

    // Check for potential duplicates if animalId or date is being updated
    if (updateFields.animalId !== undefined || updateFields.date !== undefined) {
      const proposedAnimalId = updateFields.animalId ?? existingRecord.animalId;
      const proposedDate = updateFields.date ?? existingRecord.date;

      const duplicateCheck = await this.growthRecords.findOne({
        ownerId: userId as UserId,
        animalId: proposedAnimalId,
        date: proposedDate,
        _id: { $ne: recordId as GrowthRecordId }, // Exclude the current record being updated
      });
      if (duplicateCheck) {
        return { error: `Update would create a duplicate growth record for animal '${proposedAnimalId}' on '${proposedDate.toISOString().split('T')[0]}' for user '${userId}'.` };
      }
    }

    const result = await this.growthRecords.updateOne(
      { _id: recordId as GrowthRecordId, ownerId: userId as UserId },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      // This should ideally not happen if existingRecord was found, but as a safeguard.
      return {
        error:
          `Growth record '${recordId}' not found for user '${userId}' during update.`,
      };
    }
    return { recordId: recordId as GrowthRecordId };
  }

  /**
   * **action** `deleteGrowthRecord (userId: String, recordId: String): Empty`
   *
   * **requires** A growth record with `recordId` exists for the `userId`.
   * **effects** Deletes the specified growth record.
   * @param {object} args - The action arguments.
   * @param {string} args.userId - The ID of the user performing the action.
   * @param {string} args.recordId - The ID of the growth record to delete.
   * @returns {Empty | { error: string }} An empty object on success, or an error.
   */
  async deleteGrowthRecord({
    userId,
    recordId,
  }: {
    userId: string;
    recordId: string;
  }): Promise<Empty | { error: string }> {
    const result = await this.growthRecords.deleteOne({
      _id: recordId as GrowthRecordId,
      ownerId: userId as UserId,
    });
    if (result.deletedCount === 0) {
      return {
        error: `Growth record '${recordId}' not found for user '${userId}'.`,
      };
    }
    return {};
  }

  // --- Queries ---

  /**
   * **query** `_listGrowthRecordsByAnimal (userId: String, animalId: String): (record: GrowthRecord)`
   *
   * **requires** true (any user can query, but only their records are returned).
   * **effects** Returns a list of all growth records for a specific animal owned by the user, sorted by date.
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @param {string} args.animalId - The generic identifier for the animal.
   * @returns {{ record?: GrowthRecord[]; error?: string }} An array of growth record objects, or an error.
   */
  async _listGrowthRecordsByAnimal({
    userId,
    animalId,
  }: {
    userId: string;
    animalId: string;
  }): Promise<{ record?: GrowthRecord[]; error?: string }> {
    try {
      const records = await this.growthRecords.find({
        ownerId: userId as UserId,
        animalId: animalId as AnimalId,
      }).sort({ date: 1 }).toArray(); // Sort by date ascending
      return { record: records };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        error:
          `Failed to list growth records for animal '${animalId}' for user '${userId}': ${message}`,
      };
    }
  }

  /**
   * **query** `_getLatestGrowthRecord (userId: String, animalId: String): (record: GrowthRecord)`
   *
   * **requires** true (any user can query, but only their records are returned).
   * **effects** Returns the latest growth record for a specific animal owned by the user.
   * @param {object} args - The query arguments.
   * @param {string} args.userId - The ID of the user performing the query.
   * @param {string} args.animalId - The generic identifier for the animal.
   * @returns {{ record?: GrowthRecord; error?: string }} The latest growth record object, or an error.
   */
  async _getLatestGrowthRecord({
    userId,
    animalId,
  }: {
    userId: string;
    animalId: string;
  }): Promise<{ record?: GrowthRecord; error?: string }> {
    try {
      const record = await this.growthRecords.findOne(
        {
          ownerId: userId as UserId,
          animalId: animalId as AnimalId,
        },
        { sort: { date: -1 } }, // Sort by date descending to get the latest
      );
      if (!record) {
        return {
          error:
            `No growth records found for animal '${animalId}' for user '${userId}'.`,
        };
      }
      return { record: record };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        error:
          `Failed to get latest growth record for animal '${animalId}' for user '${userId}': ${message}`,
      };
    }
  }
}
```

***
