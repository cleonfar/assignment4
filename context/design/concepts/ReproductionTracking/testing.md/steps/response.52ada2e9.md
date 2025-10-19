---
timestamp: 'Thu Oct 16 2025 14:26:19 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_142619.b16070c9.md]]'
content_id: 52ada2e9a5ccac86bc3f2d047f263ebcaf4e776de1c94b4d26b0f1bae654be43
---

# response:

The errors you're encountering stem from a fundamental mismatch in how `ID` (your branded string type) and MongoDB's `ObjectId` (its native ID type) are being handled. Although your `ID` is defined as a branded `string`, MongoDB internally prefers and often automatically converts `_id` fields to `ObjectId` objects if the string resembles an `ObjectId` hex string. When querying, the MongoDB driver's type definitions often expect `ObjectId` for `_id` fields.

To resolve this, we'll adopt a robust strategy:

1. **Internal Data Models (`Mother`, `Litter`, `Offspring`, `GeneratedReport`)**: These interfaces will explicitly use `ObjectId` for their `_id` fields and any foreign key fields (`motherId`, `litterId`, `fatherId`). This reflects how MongoDB will store them internally.
2. **External Data Transfer Objects (DTOs)**: We'll create new DTO interfaces (e.g., `MotherDTO`, `LitterDTO`) that use your `ID` (branded string) type for all ID fields. These DTOs will be used for all inputs and outputs of your concept's actions, ensuring that the public API adheres to your `ID` type.
3. **Conversion Helpers**: Two helper functions, `brandedIdToObjectId` and `objectIdToBrandedId`, will be introduced to seamlessly convert between `ID` (string) and `ObjectId` during API calls.
4. **`freshID()` usage**: The `freshID()` utility from `@utils/database.ts` (which returns `ID` branded string) will primarily be used for external ID generation (e.g., when the user provides an ID). For internal MongoDB document `_id` generation, we will directly use `new ObjectId()` to ensure we're creating native `ObjectId`s.
5. **Test File Adjustments**:
   * All test `ID` values (e.g., `"mother1"`) must be explicitly "branded" using a `createBrandedId` helper function.
   * Direct database queries in tests (`db.collection(...).findOne({ _id: ... })`) must convert the `ID` string to an `ObjectId` using `brandedIdToObjectId` to match the internal storage type.
   * Assertions for action return values will now expect the DTO types, meaning `_id` and foreign keys will be `ID` (branded string).

Here are the updated concept and test files:

***

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.ts
import { Collection, Db, ObjectId } from "npm:mongodb"; // Import ObjectId
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { Empty, ID } from "@utils/types.ts";
// freshID is not directly used for internal _id generation anymore,
// but for cases where a new branded string ID is needed, if applicable.
// It's assumed to return a branded string that is a valid ObjectId hex string representation.
import { freshID } from "@utils/database.ts"; 

// Declare collection prefix, use concept name
const PREFIX = "ReproductionTracking" + ".";

/**
 * Enum for the sex of an offspring.
 */
export enum Sex {
  Male = "male",
  Female = "female",
  Neuter = "neutered",
}

// --- Internal Data Models (as stored in MongoDB) ---
// These use ObjectId for _id and foreign keys for type safety and MongoDB best practices.

interface Mother {
  _id: ObjectId;
  notes?: string;
}

interface Litter {
  _id: ObjectId;
  motherId: ObjectId; // References Mother's _id (ObjectId)
  fatherId?: ObjectId; // References Father's _id (ObjectId)
  birthDate: Date;
  reportedLitterSize: number;
  notes?: string;
}

interface Offspring {
  _id: ObjectId;
  litterId: ObjectId; // References Litter's _id (ObjectId)
  sex: Sex;
  notes?: string;
  isAlive: boolean;
  survivedTillWeaning: boolean;
}

interface GeneratedReport {
  _id: ObjectId;
  reportName: string;
  dateGenerated: Date;
  target: ObjectId[]; // Array of Mother's _id (ObjectId)
  results: {
    uniqueLittersRecorded: number;
    totalReportedLitterSize: number;
    totalActualOffspringBorn: number;
    totalWeanedOffspring: number;
    totalDeceasedOffspring: number;
    averageReportedLitterSize: number;
    averageActualOffspringPerLitter: number;
    survivabilityRateToWeaning: string;
    motherCount: number;
    reportPeriod: string;
    perMotherPerformance: {
      motherId: ObjectId; // Internal representation for calculations
      littersRecorded: number;
      totalOffspringBorn: number;
      totalOffspringWeaned: number;
      totalDeceasedOffspring: number;
      weaningSurvivabilityRate: string;
      averageActualOffspringPerLitter: number;
    }[];
  };
}

// --- Data Transfer Objects (DTOs) for external API communication ---
// These use ID (branded string) for _id and foreign keys as specified in the concept.

interface MotherDTO {
  _id: ID;
  notes?: string;
}

interface LitterDTO {
  _id: ID;
  motherId: ID;
  fatherId?: ID;
  birthDate: Date;
  reportedLitterSize: number;
  notes?: string;
}

interface OffspringDTO {
  _id: ID;
  litterId: ID;
  sex: Sex;
  notes?: string;
  isAlive: boolean;
  survivedTillWeaning: boolean;
}

interface GeneratedReportDTO {
  _id: ID;
  reportName: string;
  dateGenerated: Date;
  target: ID[]; // Array of Mother IDs (string)
  results: {
    uniqueLittersRecorded: number;
    totalReportedLitterSize: number;
    totalActualOffspringBorn: number;
    totalWeanedOffspring: number;
    totalDeceasedOffspring: number;
    averageReportedLitterSize: number;
    averageActualOffspringPerLitter: number;
    survivabilityRateToWeaning: string;
    motherCount: number;
    reportPeriod: string;
    perMotherPerformance: {
      motherId: ID; // External representation
      littersRecorded: number;
      totalOffspringBorn: number;
      totalOffspringWeaned: number;
      totalDeceasedOffspring: number;
      weaningSurvivabilityRate: string;
      averageActualOffspringPerLitter: number;
    }[];
  };
}


// --- Helper functions for conversion between ID (string) and ObjectId ---

// Converts external branded ID (string) to internal ObjectId for DB operations.
function brandedIdToObjectId(id: ID): ObjectId {
  return new ObjectId(id);
}

// Converts internal ObjectId to external branded ID (string) for API responses.
function objectIdToBrandedId(objId: ObjectId): ID {
  return objId.toHexString() as ID;
}

// Converts an internal Mother object to its DTO representation.
function toMotherDTO(mother: Mother): MotherDTO {
  return {
    _id: objectIdToBrandedId(mother._id),
    notes: mother.notes,
  };
}

// Converts an internal Litter object to its DTO representation.
function toLitterDTO(litter: Litter): LitterDTO {
  return {
    _id: objectIdToBrandedId(litter._id),
    motherId: objectIdToBrandedId(litter.motherId),
    fatherId: litter.fatherId ? objectIdToBrandedId(litter.fatherId) : undefined,
    birthDate: litter.birthDate,
    reportedLitterSize: litter.reportedLitterSize,
    notes: litter.notes,
  };
}

// Converts an internal Offspring object to its DTO representation.
function toOffspringDTO(offspring: Offspring): OffspringDTO {
  return {
    _id: objectIdToBrandedId(offspring._id),
    litterId: objectIdToBrandedId(offspring.litterId),
    sex: offspring.sex,
    notes: offspring.notes,
    isAlive: offspring.isAlive,
    survivedTillWeaning: offspring.survivedTillWeaning,
  };
}

// Converts an internal GeneratedReport object to its DTO representation.
function toGeneratedReportDTO(report: GeneratedReport): GeneratedReportDTO {
  return {
    _id: objectIdToBrandedId(report._id),
    reportName: report.reportName,
    dateGenerated: report.dateGenerated,
    target: report.target.map(objectIdToBrandedId),
    results: {
      ...report.results,
      perMotherPerformance: report.results.perMotherPerformance.map(perf => ({
        ...perf,
        motherId: objectIdToBrandedId(perf.motherId), // Convert internal ObjectId to external ID string
      })),
    },
  };
}


/**
 * **concept** ReproductionTracking
 *
 * **purpose** track reproductive outcomes and offspring survivability for breeding animals, organizing individual offspring into distinct litters.
 *
 * **principle**
 *   a user records birth events by first creating a litter for a mother animal, optionally linking a father and setting an expected litter size;
 *   then, individual offspring born to that litter are recorded and linked to it;
 *   later records weaning outcomes for those offspring when the data becomes available;
 *   uses this data to generate reports to evaluate reproductive performance and inform breeding decisions, including litter-specific metrics;
 *   can choose to generate an AI summary of generated reports to aide in understanding and decision making;
 */
export default class ReproductionTrackingConcept {
  private mothers: Collection<Mother>;
  private litters: Collection<Litter>;
  private offspring: Collection<Offspring>;
  private generatedReports: Collection<GeneratedReport>;

  constructor(private readonly db: Db) {
    this.mothers = this.db.collection(PREFIX + "mothers");
    this.litters = this.db.collection(PREFIX + "litters");
    this.offspring = this.db.collection(PREFIX + "offspring");
    this.generatedReports = this.db.collection(PREFIX + "generatedReports");
  }

  /**
   * **action** `addMother (motherId: ID): (motherId: ID)`
   *
   * **requires** mother is not already in the set of mothers
   * **effects** mother is added to the set of mothers
   */
  async addMother({ motherId }: { motherId: ID }): Promise<{ motherId?: ID; error?: string }> {
    const motherObjectId = brandedIdToObjectId(motherId);
    const existingMother = await this.mothers.findOne({ _id: motherObjectId });
    if (existingMother) {
      return { error: `Mother with ID ${motherId} already exists.` };
    }

    const newMother: Mother = { _id: motherObjectId };
    await this.mothers.insertOne(newMother);
    return { motherId };
  }

  /**
   * **action** `removeMother (motherId: ID): (motherId: ID)`
   *
   * **requires** a mother with this ID is in the set of mothers
   * **effects** removes this mother from the set of mothers. (Associated litters and offspring will have dangling `motherId` references unless syncs are used for cascade deletion).
   */
  async removeMother({ motherId }: { motherId: ID }): Promise<{ motherId?: ID; error?: string }> {
    const motherObjectId = brandedIdToObjectId(motherId);
    const result = await this.mothers.deleteOne({ _id: motherObjectId });
    if (result.deletedCount === 0) {
      return { error: `Mother with ID ${motherId} not found.` };
    }
    return { motherId };
  }

  /**
   * **action** `recordLitter (motherId: ID, fatherId: ID?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litter: Litter)`
   *
   * **requires** motherId exists. No litter with same `motherId`, `fatherId`, `birthDate` already exists (to prevent exact duplicates).
   * **effects** creates a new litter record with the provided information. Also adds the mother to the set of mothers if she isn't there already.
   */
  async recordLitter(
    { motherId, fatherId, birthDate, reportedLitterSize, notes }:
      { motherId: ID; fatherId?: ID; birthDate: Date; reportedLitterSize: number; notes?: string },
  ): Promise<{ litter?: LitterDTO; error?: string }> {
    const motherObjectId = brandedIdToObjectId(motherId);
    const fatherObjectId = fatherId ? brandedIdToObjectId(fatherId) : undefined;

    // Add mother if she doesn't exist already
    const existingMother = await this.mothers.findOne({ _id: motherObjectId });
    if (!existingMother) {
      // Use the internal addMother which takes ID (string) and converts it to ObjectId
      const addMotherResult = await this.addMother({ motherId });
      if (addMotherResult.error) {
        // This should not happen if motherId is valid for ObjectId conversion
        return { error: `Failed to add mother ${motherId}: ${addMotherResult.error}` };
      }
    }

    // Check for existing litter with similar characteristics to avoid exact duplicates
    const existingLitter = await this.litters.findOne({
      motherId: motherObjectId,
      ...(fatherObjectId && { fatherId: fatherObjectId }), // Only include if fatherId exists
      birthDate: new Date(birthDate),
    });
    if (existingLitter) {
      return { error: `A litter for mother ${motherId} with this father and birth date already exists.` };
    }

    const newLitter: Litter = {
      _id: new ObjectId(), // Generate a new ObjectId for the litter
      motherId: motherObjectId,
      fatherId: fatherObjectId,
      birthDate: new Date(birthDate),
      reportedLitterSize,
      notes,
    };

    await this.litters.insertOne(newLitter);
    return { litter: toLitterDTO(newLitter) };
  }

  /**
   * **action** `updateLitter (litterId: ID, motherId: ID?, fatherId: ID?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litter: Litter)`
   *
   * **requires** `litterId` exists
   * **effects** Updates any given information about the litter. If `motherId` is changed, ensures the new mother exists.
   */
  async updateLitter(
    { litterId, motherId, fatherId, birthDate, reportedLitterSize, notes }:
      { litterId: ID; motherId?: ID; fatherId?: ID; birthDate?: Date; reportedLitterSize?: number; notes?: string },
  ): Promise<{ litter?: LitterDTO; error?: string }> {
    const litterObjectId = brandedIdToObjectId(litterId);
    const existingLitter = await this.litters.findOne({ _id: litterObjectId });
    if (!existingLitter) {
      return { error: `Litter with ID ${litterId} not found.` };
    }

    const updateFields: Partial<Litter> = {};
    // If fatherId is provided, convert it; if it's explicitly null/undefined, set to undefined
    if (fatherId !== undefined) updateFields.fatherId = fatherId ? brandedIdToObjectId(fatherId) : undefined;
    if (birthDate !== undefined) updateFields.birthDate = new Date(birthDate);
    if (reportedLitterSize !== undefined) updateFields.reportedLitterSize = reportedLitterSize;
    if (notes !== undefined) updateFields.notes = notes;

    // Handle mother ID change
    if (motherId !== undefined) {
      const newMotherObjectId = brandedIdToObjectId(motherId);
      // Compare ObjectIds using .equals() method
      if (!newMotherObjectId.equals(existingLitter.motherId)) {
        const existingNewMother = await this.mothers.findOne({ _id: newMotherObjectId });
        if (!existingNewMother) {
          const addMotherResult = await this.addMother({ motherId });
          if (addMotherResult.error) {
            return { error: `Failed to add new mother ${motherId}: ${addMotherResult.error}` };
          }
        }
        updateFields.motherId = newMotherObjectId;
      }
    }

    const updatedLitter = await this.litters.findOneAndUpdate(
      { _id: litterObjectId },
      { $set: updateFields },
      { returnDocument: "after", upsert: false },
    );

    if (!updatedLitter?.value) { // Use .value to get the updated document
      return { error: `Failed to update litter with ID ${litterId}. Document not found or could not be updated.` };
    }
    return { litter: toLitterDTO(updatedLitter.value) };
  }

  /**
   * **action** `recordOffspring (litterId: ID, offspringId: ID, sex: Enum [male, female, neutered], notes: String?): (offspring: Offspring)`
   *
   * **requires** `litterId` exists and `offspringId` does not exist.
   * **effects** creates an individual offspring record linked to the specified litter.
   */
  async recordOffspring(
    { litterId, offspringId, sex, notes }:
      { litterId: ID; offspringId: ID; sex: Sex; notes?: string },
  ): Promise<{ offspring?: OffspringDTO; error?: string }> {
    const litterObjectId = brandedIdToObjectId(litterId);
    const existingLitter = await this.litters.findOne({ _id: litterObjectId });
    if (!existingLitter) {
      return { error: `Litter with ID ${litterId} not found.` };
    }

    const offspringObjectId = brandedIdToObjectId(offspringId);
    const existingOffspring = await this.offspring.findOne({ _id: offspringObjectId });
    if (existingOffspring) {
      return { error: `Offspring with ID ${offspringId} already exists.` };
    }

    const newOffspring: Offspring = {
      _id: offspringObjectId, // Use the provided offspringId as ObjectId
      litterId: litterObjectId,
      sex,
      notes,
      isAlive: true,
      survivedTillWeaning: false,
    };

    await this.offspring.insertOne(newOffspring);
    return { offspring: toOffspringDTO(newOffspring) };
  }

  /**
   * **action** `updateOffspring (offspringId: ID, litterId: ID?, sex: Enum?, notes: String?): (offspring: Offspring)`
   *
   * **requires** `offspringId` exists.
   * **effects** Updates any given information about the offspring. If `litterId` is changed, ensures the new litter exists.
   */
  async updateOffspring(
    { offspringId, litterId, sex, notes }:
      { offspringId: ID; litterId?: ID; sex?: Sex; notes?: string },
  ): Promise<{ offspring?: OffspringDTO; error?: string }> {
    const offspringObjectId = brandedIdToObjectId(offspringId);
    const existingOffspring = await this.offspring.findOne({ _id: offspringObjectId });
    if (!existingOffspring) {
      return { error: `Offspring with ID ${offspringId} not found.` };
    }

    const updateFields: Partial<Offspring> = {};
    if (sex !== undefined) updateFields.sex = sex;
    if (notes !== undefined) updateFields.notes = notes;

    // Handle litter ID change
    if (litterId !== undefined) {
      const newLitterObjectId = brandedIdToObjectId(litterId);
      // Compare ObjectIds using .equals() method
      if (!newLitterObjectId.equals(existingOffspring.litterId)) {
        const existingNewLitter = await this.litters.findOne({ _id: newLitterObjectId });
        if (!existingNewLitter) {
          return { error: `New litter with ID ${litterId} for offspring update not found.` };
        }
        updateFields.litterId = newLitterObjectId;
      }
    }

    const updatedOffspring = await this.offspring.findOneAndUpdate(
      { _id: offspringObjectId },
      { $set: updateFields },
      { returnDocument: "after", upsert: false },
    );

    if (!updatedOffspring?.value) {
      return { error: `Failed to update offspring with ID ${offspringId}. Document not found or could not be updated.` };
    }
    return { offspring: toOffspringDTO(updatedOffspring.value) };
  }

  /**
   * **action** `recordWeaning (offspringId: ID): offspringId: ID`
   *
   * **requires** offspring is in the set of offspring and is alive
   * **effects** Sets `survivedTillWeaning` to be true for the specified offspring
   */
  async recordWeaning({ offspringId }: { offspringId: ID }): Promise<{ offspringId?: ID; error?: string }> {
    const offspringObjectId = brandedIdToObjectId(offspringId);
    const existingOffspring = await this.offspring.findOne({ _id: offspringObjectId });
    if (!existingOffspring) {
      return { error: `Offspring with ID ${offspringId} not found.` };
    }
    if (!existingOffspring.isAlive) {
      return { error: `Offspring with ID ${offspringId} is not alive and cannot be weaned.` };
    }
    if (existingOffspring.survivedTillWeaning) {
      return { error: `Offspring with ID ${offspringId} is already marked as weaned.` };
    }

    const result = await this.offspring.updateOne(
      { _id: offspringObjectId },
      { $set: { survivedTillWeaning: true } },
    );

    if (result.modifiedCount === 0) {
      return { error: `Failed to record weaning for offspring with ID ${offspringId}.` };
    }
    return { offspringId };
  }

  /**
   * **action** `recordDeath (offspringId: ID): (offspringId: ID)`
   *
   * **requires** offspring is in the set of offspring and is currently living
   * **effects** Sets the `isAlive` flag of this offspring to false
   */
  async recordDeath({ offspringId }: { offspringId: ID }): Promise<{ offspringId?: ID; error?: string }> {
    const offspringObjectId = brandedIdToObjectId(offspringId);
    const existingOffspring = await this.offspring.findOne({ _id: offspringObjectId });
    if (!existingOffspring) {
      return { error: `Offspring with ID ${offspringId} not found.` };
    }
    if (!existingOffspring.isAlive) {
      return { error: `Offspring with ID ${offspringId} is already marked as deceased.` };
    }

    const result = await this.offspring.updateOne(
      { _id: offspringObjectId },
      { $set: { isAlive: false } },
    );

    if (result.modifiedCount === 0) {
      return { error: `Failed to record death for offspring with ID ${offspringId}.` };
    }
    return { offspringId };
  }

  /**
   * **action** `viewLittersOfMother (motherId: ID): (litters: Set<Litter>)`
   *
   * **requires** mother exists
   * **effects** returns all litters associated with the given mother ID.
   */
  async viewLittersOfMother({ motherId }: { motherId: ID }): Promise<{ litters?: LitterDTO[]; error?: string }> {
    const motherObjectId = brandedIdToObjectId(motherId);
    const existingMother = await this.mothers.findOne({ _id: motherObjectId });
    if (!existingMother) {
      return { error: `Mother with ID ${motherId} not found.` };
    }
    const littersList = await this.litters.find({ motherId: motherObjectId }).toArray();
    return { litters: littersList.map(toLitterDTO) };
  }

  /**
   * **action** `viewOffspringOfLitter (litterId: ID): (offspring: Set<Offspring>)`
   *
   * **requires** litter exists
   * **effects** returns all offspring associated with the given litter ID.
   */
  async viewOffspringOfLitter({ litterId }: { litterId: ID }): Promise<{ offspring?: OffspringDTO[]; error?: string }> {
    const litterObjectId = brandedIdToObjectId(litterId);
    const existingLitter = await this.litters.findOne({ _id: litterObjectId });
    if (!existingLitter) {
      return { error: `Litter with ID ${litterId} not found.` };
    }
    const offspringList = await this.offspring.find({ litterId: litterObjectId }).toArray();
    return { offspring: offspringList.map(toOffspringDTO) };
  }

  /**
   * **action** `generateReport (target: Set<ID>, startDateRange: Date, endDateRange: Date, name: String?): (report: GeneratedReport)`
   *
   * **requires** All target animals are in the set of mothers
   * **effects** produce a report on the reproductive performance of the given animals within the specified date range and store it.
   */
  async generateReport(
    { target, startDateRange, endDateRange, name }:
      { target: ID[]; startDateRange: Date; endDateRange: Date; name?: string },
  ): Promise<{ report?: GeneratedReportDTO; error?: string }> {
    // Convert target IDs to ObjectIds for database queries
    const targetObjectIds = target.map(brandedIdToObjectId);

    // Validate target mothers
    const mothersExist = await this.mothers.find({ _id: { $in: targetObjectIds } }).toArray();
    if (mothersExist.length !== targetObjectIds.length) {
      // Find missing IDs for the error message
      const existingMotherObjectIds = new Set(mothersExist.map(m => m._id.toHexString()));
      const missingIds = target.filter(id => !existingMotherObjectIds.has(id));
      return { error: `One or more target IDs are not registered mothers: ${missingIds.join(", ")}.` };
    }

    const reportName = name || `Reproduction Report - ${new Date().toISOString().split('T')[0]}`;
    const existingReport = await this.generatedReports.findOne({ reportName });
    if (existingReport) {
      return { error: `Report with name '${reportName}' already exists.` };
    }

    const startDate = new Date(startDateRange);
    const endDate = new Date(endDateRange);

    // --- Overall Report Data Aggregation ---
    const allRelevantLitters = await this.litters.find({
      motherId: { $in: targetObjectIds },
      birthDate: { $gte: startDate, $lte: endDate },
    }).toArray();

    const allLitterObjectIdsInReport = allRelevantLitters.map(l => l._id);

    const allRelevantOffspring = await this.offspring.find({
      litterId: { $in: allLitterObjectIdsInReport },
    }).toArray();

    const overallUniqueLittersRecorded = allRelevantLitters.length;
    const overallTotalReportedLitterSize = allRelevantLitters.reduce((sum, l) => sum + l.reportedLitterSize, 0);
    const overallTotalActualOffspringBorn = allRelevantOffspring.length;
    const overallTotalWeanedOffspring = allRelevantOffspring.filter((o) => o.survivedTillWeaning).length;
    const overallTotalDeceasedOffspring = allRelevantOffspring.filter((o) => !o.isAlive).length;

    const overallAverageReportedLitterSize = overallUniqueLittersRecorded > 0
      ? overallTotalReportedLitterSize / overallUniqueLittersRecorded
      : 0;
    const overallAverageActualOffspringPerLitter = overallUniqueLittersRecorded > 0
      ? overallTotalActualOffspringBorn / overallUniqueLittersRecorded
      : 0;
    const overallSurvivabilityRateToWeaning = overallTotalActualOffspringBorn > 0
      ? (overallTotalWeanedOffspring / overallTotalActualOffspringBorn) * 100
      : 0;

    // --- Per-Mother Performance Aggregation ---
    const perMotherPerformance: GeneratedReport["results"]["perMotherPerformance"] = [];

    for (const motherObjectId of targetObjectIds) {
      const motherLitters = allRelevantLitters.filter(l => l.motherId.equals(motherObjectId));
      const motherLitterObjectIds = motherLitters.map(l => l._id);
      const motherOffspring = allRelevantOffspring.filter(o => motherLitterObjectIds.some(lId => lId.equals(o.litterId)));

      const littersRecorded = motherLitters.length;
      const totalOffspringBorn = motherOffspring.length;
      const totalOffspringWeaned = motherOffspring.filter(o => o.survivedTillWeaning).length;
      const totalDeceasedOffspring = motherOffspring.filter(o => !o.isAlive).length;

      const weaningSurvivabilityRate = totalOffspringBorn > 0
        ? (totalOffspringWeaned / totalOffspringBorn) * 100
        : 0;
      const averageActualOffspringPerLitter = littersRecorded > 0
        ? totalOffspringBorn / littersRecorded
        : 0;

      perMotherPerformance.push({
        motherId: motherObjectId, // Store ObjectId internally
        littersRecorded,
        totalOffspringBorn,
        totalOffspringWeaned,
        totalDeceasedOffspring,
        weaningSurvivabilityRate: `${weaningSurvivabilityRate.toFixed(2)}%`,
        averageActualOffspringPerLitter: parseFloat(averageActualOffspringPerLitter.toFixed(2)),
      });
    }

    const reportResults: GeneratedReport["results"] = {
      uniqueLittersRecorded: overallUniqueLittersRecorded,
      totalReportedLitterSize: overallTotalReportedLitterSize,
      totalActualOffspringBorn: overallTotalActualOffspringBorn,
      totalWeanedOffspring: overallTotalWeanedOffspring,
      totalDeceasedOffspring: overallTotalDeceasedOffspring,
      averageReportedLitterSize: parseFloat(overallAverageReportedLitterSize.toFixed(2)),
      averageActualOffspringPerLitter: parseFloat(overallAverageActualOffspringPerLitter.toFixed(2)),
      survivabilityRateToWeaning: `${overallSurvivabilityRateToWeaning.toFixed(2)}%`,
      motherCount: target.length,
      reportPeriod: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      perMotherPerformance,
    };

    const newReport: GeneratedReport = {
      _id: new ObjectId(), // Generate a new ObjectId for the report
      reportName,
      dateGenerated: new Date(),
      target: targetObjectIds, // Store ObjectIds internally
      results: reportResults,
    };

    await this.generatedReports.insertOne(newReport);
    return { report: toGeneratedReportDTO(newReport) };
  }

  /**
   * **action** `renameReport (oldName: String, newName: String): (report: GeneratedReport)`
   *
   * **requires** oldName of report exists
   * **effects** renames the specified report
   */
  async renameReport(
    { oldName, newName }: { oldName: string; newName: string },
  ): Promise<{ report?: GeneratedReportDTO; error?: string }> {
    const existingReport = await this.generatedReports.findOne({ reportName: oldName });
    if (!existingReport) {
      return { error: `Report with name '${oldName}' not found.` };
    }

    const nameConflict = await this.generatedReports.findOne({ reportName: newName });
    if (nameConflict) {
      return { error: `Report with new name '${newName}' already exists.` };
    }

    const updatedReport = await this.generatedReports.findOneAndUpdate(
      { _id: existingReport._id }, // Query by ObjectId
      { $set: { reportName: newName } },
      { returnDocument: "after", upsert: false },
    );

    if (!updatedReport?.value) {
      return { error: `Failed to rename report '${oldName}'. Document not found or could not be updated.` };
    }
    return { report: toGeneratedReportDTO(updatedReport.value) };
  }

  /**
   * **action** `viewReport (reportName: String): (report: GeneratedReport)`
   *
   * **requires** report with the given name exists
   * **effects** returns the full details (summary and results) of the specified report
   */
  async viewReport({ reportName }: { reportName: string }): Promise<{ report?: GeneratedReportDTO; error?: string }> {
    const report = await this.generatedReports.findOne({ reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return { report: toGeneratedReportDTO(report) };
  }

  /**
   * **action** `listReports (): (reports: Set<GeneratedReport>)`
   *
   * **effects** returns all generated reports in the system
   */
  async listReports(): Promise<{ reports: GeneratedReportDTO[] }> {
    const reports = await this.generatedReports.find({}).toArray();
    return { reports: reports.map(toGeneratedReportDTO) };
  }

  /**
   * **action** `deleteReport (reportName: String)`
   *
   * **requires** report with the given name exists
   * **effects** removes the specified report from the system
   */
  async deleteReport({ reportName }: { reportName: string }): Promise<Empty | { error: string }> {
    const result = await this.generatedReports.deleteOne({ reportName });
    if (result.deletedCount === 0) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return {};
  }

  /**
   * **action** `aiSummary (reportName: String): (summary: String)`
   *
   * **requires** report exists
   * **effects** The AI generates a summary of the report, highlighting key takeaways and trends shown in the report.
   */
  async aiSummary({ reportName }: { reportName: string }): Promise<{ summary?: string; error?: string }> {
    const report = await this.generatedReports.findOne({ reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return { error: "GEMINI_API_KEY environment variable is not set." };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Convert internal report object to its DTO for the AI prompt,
      // ensuring IDs are branded strings.
      const reportDTO = toGeneratedReportDTO(report);

      // Craft the prompt using the detailed report structure
      const prompt = `You are an expert livestock analyst. Given the following animal reproduction report, respond ONLY with valid JSON in this exact format:
    {
        "highPerformers": ["motherId1", ...],
        "lowPerformers": ["motherId2", ...],
        "concerningTrends": ["motherId3", ...],
        "averagePerformers": ["motherId4", ...],
        "potentialRecordErrors": ["motherId5", ...],
        "insights": "A few short paragraphs (2-3) with deeper analysis: summarize the most important findings, discuss possible causes for low performance or concerning trends, and suggest practical management or intervention strategies for these cases. Do not focus on average/moderate performers, but do mention if the overall average performance of the group stands out as particularly good or bad."
    }
    Do not include any explanation, commentary, or text before or after the JSON. Only output valid JSON. If you cannot determine a category, return an empty array for that field. Only include mothers in 'averagePerformers' if they are not in any other category. Every mother in the report must be classified into at least one of the following categories: highPerformers, lowPerformers, concerningTrends, averagePerformers, or potentialRecordErrors. No mother should be left unclassified.

Be highly suspicious of questionable or inconsistent records. Be liberal about classifying something as a potential record error: if there is any reasonable doubt or anything seems odd, include the mother in 'potentialRecordErrors' and mention the issue in 'insights'. Do not hesitate to flag records that seem unusual or inconsistent.

Here are some examples of suspicious or potentially erroneous records for reproduction tracking:
- A mother's 'totalOffspringWeaned' being greater than 'totalOffspringBorn' for the same period.
- An average litter size that is impossibly high or low for a typical animal species (e.g., if a species typically has 1-2 offspring, and a mother shows an average of 15).
- Weaning survivability rates that are unusually high (e.g., 100% across many large litters, which might be suspicious) or unusually low (e.g., 0% across many litters without clear explanation).
- Any value that appears to be a typo (e.g., an extra zero, misplaced decimal).
- Any other data that seems inconsistent, out of range, or highly unlikely for reproductive outcomes.
Mark records as a potential record error if they may include a typo or if the values are impossibly good or bad. Err on the side of caution and flag anything that could possibly be a record error.

Absolutely ensure that every mother you think might have a record error is included in the 'potentialRecordErrors' array—no exceptions. If you mention or suspect a record error for a mother in your analysis, their ID must appear in 'potentialRecordErrors'.

    Here is the reproduction report data in JSON format:
    ${JSON.stringify(reportDTO.results, null, 2)}

    JSON Summary:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text(); // Access text from the response object

      // Attempt to parse the JSON response
      let jsonSummary;
      try {
        jsonSummary = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("AI response was not valid JSON:", responseText, jsonError);
        return { error: `AI response was not valid JSON. Raw response: ${responseText.substring(0, 500)}...` };
      }

      // Basic validation of the JSON structure
      const requiredKeys = [
        "highPerformers",
        "lowPerformers",
        "concerningTrends",
        "averagePerformers",
        "potentialRecordErrors",
        "insights",
      ];
      const missingKeys = requiredKeys.filter((key) => !(key in jsonSummary));
      if (missingKeys.length > 0) {
        return { error: `AI summary missing required keys: ${missingKeys.join(", ")}` };
      }

      // Return the JSON string as the summary
      return { summary: JSON.stringify(jsonSummary, null, 2) };
    } catch (e) {
      console.error("Error generating AI summary:", e);
      return { error: `Failed to generate AI summary: ${e.message || "An unknown error occurred."}` };
    }
  }
}
```
