---
timestamp: 'Tue Oct 14 2025 13:04:13 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251014_130413.918d0dde.md]]'
content_id: 0877bf1e89fa81ef9fc514950ac00c3e4b0a78e82f9568b2b7469af1dbebc514
---

# response:

```typescript
// Assuming these utility types and functions are available at the specified paths.
// For a standalone implementation, you might need to mock them or provide a basic version.

// @utils/types.ts
export type ID = string & { __brand: "ID" };
export type Empty = Record<PropertyKey, never>;

// @utils/database.ts
export function freshID(): ID {
  // A simple UUID generator for demonstration. In a real application,
  // this might generate more MongoDB-friendly ObjectIds or other unique IDs.
  return `id_${crypto.randomUUID().replace(/-/g, '')}` as ID;
}

// And the MongoDB imports:
import { Collection, Db } from "npm:mongodb"; // Using npm:mongodb for Deno environment

/**
 * # concept: Record
 *
 * **purpose** track reproductive outcomes and offspring survivability for breeding animals
 *
 * **principle** a user records birth events for mother animals, optionally linking fathers and offspring;
 * later records weaning outcomes for those offspring when the data becomes available;
 * and uses this data to evaluate reproductive performance and inform breeding decisions.
 */
// file: src/Record/RecordConcept.ts

// Declare collection prefix, use concept name
const PREFIX = "Record" + ".";

// Generic types of this concept (Animal is an external entity, so it's an ID)
type Animal = ID;
type BirthRecordID = ID; // Using a distinct type for BirthRecord IDs for clarity

/**
 * a set of WeightRecords with
 *   a `date` of type `Date`
 *   a `weight` of type `Number`
 *   an optional `notes` of type `String`
 */
interface WeightRecord {
  _id: ID;
  animal: Animal;
  date: Date;
  weight: number;
  notes?: string;
}

/**
 * a set of BirthRecords with
 *   a `mother` of type `Animal`
 *   an optional `father` of type `Animal`
 *   a `birthDate` of type `Date`
 *   a set of `offspring` of type `Animal`
 *   a `countBorn` of type `Number`
 *   an optional `notes` of type `String`
 */
interface BirthRecord {
  _id: BirthRecordID; // Use BirthRecordID for consistency
  mother: Animal;
  father?: Animal;
  birthDate: Date;
  offspring: Animal[]; // Storing as an array of IDs
  countBorn: number;
  notes?: string;
}

/**
 * a set of WeaningRecords with
 *   a `mother` of type `Animal`
 *   a `birthRecord` of type `BirthRecordID`
 *   a `weaningDate` of type `Date`
 *   a `countWeaned` of type `Number`
 *   an optional `notes` of type `String`
 */
interface WeaningRecord {
  _id: ID;
  mother: Animal; // Storing mother ID explicitly for easier querying
  birthRecord: BirthRecordID;
  weaningDate: Date;
  countWeaned: number;
  notes?: string;
}

export default class RecordConcept {
  private weightRecords: Collection<WeightRecord>;
  private birthRecords: Collection<BirthRecord>;
  private weaningRecords: Collection<WeaningRecord>;

  constructor(private readonly db: Db) {
    this.weightRecords = this.db.collection(PREFIX + "weightRecords");
    this.birthRecords = this.db.collection(PREFIX + "birthRecords");
    this.weaningRecords = this.db.collection(PREFIX + "weaningRecords");
  }

  /**
   * **action** `recordWeight (animal: Animal, date: Date, weight: Number, notes: String)`
   * **requires** animal exists (Assumed valid ID from caller/sync)
   * **effects** create a new weight record for this animal
   */
  async recordWeight(
    { animal, date, weight, notes }: {
      animal: Animal;
      date: Date;
      weight: number;
      notes?: string;
    },
  ): Promise<Empty | { error: string }> {
    try {
      // Create a new weight record
      const newWeightRecord: WeightRecord = {
        _id: freshID(),
        animal,
        date,
        weight,
        notes,
      };
      await this.weightRecords.insertOne(newWeightRecord);
      return {};
    } catch (e) {
      console.error("Error recording weight:", e);
      return { error: `Failed to record weight: ${e.message}` };
    }
  }

  /**
   * **query** `viewWeightHistory (animal: Animal): (records: Set<WeightRecord>)`
   * **requires** animal exists (Assumed valid ID from caller/sync)
   * **effects** return all weight records for this animal
   */
  async _viewWeightHistory(
    { animal }: { animal: Animal },
  ): Promise<{ records: WeightRecord[] } | { error: string }> {
    try {
      const records = await this.weightRecords.find({ animal }).toArray();
      return { records };
    } catch (e) {
      console.error("Error viewing weight history:", e);
      return { error: `Failed to retrieve weight history: ${e.message}` };
    }
  }

  /**
   * **action** `recordBirth (mother: Animal, father: Animal?, birthDate: Date, offspring: Set<Animal>, countBorn: Number, notes: String?)`
   * **requires** mother exists and all offspring exist (Assumed valid IDs from caller/sync)
   * **effects** create a new birth record and link offspring to mother and optional father
   */
  async recordBirth(
    { mother, father, birthDate, offspring, countBorn, notes }: {
      mother: Animal;
      father?: Animal;
      birthDate: Date;
      offspring: Animal[];
      countBorn: number;
      notes?: string;
    },
  ): Promise<{ birthRecord: BirthRecordID } | { error: string }> {
    try {
      const newBirthRecord: BirthRecord = {
        _id: freshID(),
        mother,
        father,
        birthDate,
        offspring,
        countBorn,
        notes,
      };
      await this.birthRecords.insertOne(newBirthRecord);
      return { birthRecord: newBirthRecord._id };
    } catch (e) {
      console.error("Error recording birth:", e);
      return { error: `Failed to record birth: ${e.message}` };
    }
  }

  /**
   * **action** `recordWeaning (birthRecord: BirthRecordID, weaningDate: Date, countWeaned: Number, notes: String?)`
   * **requires** birthRecord exists and weaningDate is after birthDate
   * **effects** create a new weaning record linked to the birth record
   */
  async recordWeaning(
    { birthRecord, weaningDate, countWeaned, notes }: {
      birthRecord: BirthRecordID;
      weaningDate: Date;
      countWeaned: number;
      notes?: string;
    },
  ): Promise<Empty | { error: string }> {
    try {
      // Check if birthRecord exists
      const existingBirthRecord = await this.birthRecords.findOne({
        _id: birthRecord,
      });
      if (!existingBirthRecord) {
        return { error: "Birth record not found." };
      }

      // Check if weaningDate is after birthDate
      if (weaningDate <= existingBirthRecord.birthDate) {
        return { error: "Weaning date must be after birth date." };
      }

      // Ensure a weaning record doesn't already exist for this birthRecord
      const existingWeaning = await this.weaningRecords.findOne({
        birthRecord,
      });
      if (existingWeaning) {
        return { error: "Weaning record already exists for this birth record." };
      }

      const newWeaningRecord: WeaningRecord = {
        _id: freshID(),
        mother: existingBirthRecord.mother, // Store mother for direct querying
        birthRecord,
        weaningDate,
        countWeaned,
        notes,
      };
      await this.weaningRecords.insertOne(newWeaningRecord);
      return {};
    } catch (e) {
      console.error("Error recording weaning:", e);
      return { error: `Failed to record weaning: ${e.message}` };
    }
  }

  /**
   * **query** `viewBirths (animal: Animal): (records: Set<BirthRecord>)`
   * **requires** animal exists (Assumed valid ID from caller/sync)
   * **effects** return all birth records where this animal is the mother or father
   */
  async _viewBirths(
    { animal }: { animal: Animal },
  ): Promise<{ records: BirthRecord[] } | { error: string }> {
    try {
      const records = await this.birthRecords.find({
        $or: [{ mother: animal }, { father: animal }],
      }).toArray();
      return { records };
    } catch (e) {
      console.error("Error viewing births:", e);
      return { error: `Failed to retrieve birth records: ${e.message}` };
    }
  }

  /**
   * **query** `viewWeaning (birthRecord: BirthRecordID): (record: WeaningRecord?)`
   * **requires** birthRecord exists
   * **effects** return the weaning record associated with this birth, if any
   */
  async _viewWeaning(
    { birthRecord }: { birthRecord: BirthRecordID },
  ): Promise<{ record: WeaningRecord | null } | { error: string }> {
    try {
      // Check if birthRecord exists first (optional, but good for robust queries)
      const existingBirthRecord = await this.birthRecords.findOne({
        _id: birthRecord,
      });
      if (!existingBirthRecord) {
        return { error: "Birth record not found." };
      }

      const record = await this.weaningRecords.findOne({ birthRecord });
      return { record };
    } catch (e) {
      console.error("Error viewing weaning record:", e);
      return { error: `Failed to retrieve weaning record: ${e.message}` };
    }
  }

  /**
   * **action** `updateBirthRecord (birthRecord: BirthRecordID, birthDate: Date?, offspring: Set<Animal>?, countBorn: Number?, notes: String?)`
   * **requires** birthRecord exists
   * **effects** update any provided fields in the birth record and leave the rest unchanged
   */
  async updateBirthRecord(
    { birthRecord, birthDate, offspring, countBorn, notes }: {
      birthRecord: BirthRecordID;
      birthDate?: Date;
      offspring?: Animal[];
      countBorn?: number;
      notes?: string;
    },
  ): Promise<Empty | { error: string }> {
    try {
      // Check if birthRecord exists
      const existingBirthRecord = await this.birthRecords.findOne({
        _id: birthRecord,
      });
      if (!existingBirthRecord) {
        return { error: "Birth record not found." };
      }

      const updateFields: Partial<Omit<BirthRecord, "_id" | "mother" | "father">> = {};
      if (birthDate !== undefined) updateFields.birthDate = birthDate;
      if (offspring !== undefined) updateFields.offspring = offspring;
      if (countBorn !== undefined) updateFields.countBorn = countBorn;
      if (notes !== undefined) updateFields.notes = notes;

      if (Object.keys(updateFields).length === 0) {
        return { error: "No fields provided for update." };
      }

      await this.birthRecords.updateOne(
        { _id: birthRecord },
        { $set: updateFields },
      );
      return {};
    } catch (e) {
      console.error("Error updating birth record:", e);
      return { error: `Failed to update birth record: ${e.message}` };
    }
  }
}
```
