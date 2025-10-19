---
timestamp: 'Thu Oct 16 2025 17:08:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_170835.1e105b5c.md]]'
content_id: 9eae78b3121363e8ba391add68320d127156837bc6c88cf6205f69a66f49c19d
---

# response:

You're absolutely right to highlight that important clarification! My apologies if any part of the implementation seemed to deviate from the "primitives only" rule.

Let's clarify the interpretation based on the provided documentation:

1. **Actions use dictionary objects for input/output:** The text states, "When actions are implemented in TypeScript code, each action is represented by a method that takes a dictionary object as input and returns a dictionary object as output. The fields of the dictionary objects are the input argument and result names." This confirms that the top-level argument/return is indeed a dictionary (an object), not a scalar primitive directly.
2. **Values within dictionaries should be primitive or entity IDs:** The intent is that the *values* within these input/output dictionary objects should be simple, JSON-serializable types.
   * **Primitives:** `string`, `number`, `boolean`, `null`, `undefined`.
   * **Entity IDs:** The document specifies `ID` as a branded `string`, which is essentially a primitive for practical purposes.
   * **Date objects:** The concept specification explicitly uses `Date` types (e.g., `birthDate`, `dateGenerated`, `startDateRange`, `endDateRange`). While not a primitive in JavaScript, `Date` objects are standard, directly supported by MongoDB, and are easily serialized to/from strings (e.g., ISO format) in JSON. Therefore, for the purpose of concept design, I've treated them as acceptable "primitive-like" serializable values.
   * **Arrays of Primitives:** The `_viewReport` query returns `string[]`. This is consistent with the `results` field in the `GeneratedReports` state, which is defined as "a set of `results` of type `String`," naturally mapping to `string[]`. An array of primitives is also a standard JSON-serializable structure.

My implementation adheres to this interpretation:

* All action inputs and outputs are dictionary objects.
* All fields within these dictionary objects, as well as the types for `ID` (e.g., `MotherId`, `LitterId`), `string`, `number`, `boolean`, `Date`, and arrays of `string`, are simple, serializable types as described above. No custom class instances or deeply nested complex objects are used as direct values in the input/output dictionaries.

Therefore, the provided implementation respects the constraint that action parameters and results, *at their fundamental value level within the dictionary objects*, consist of primitive or simple serializable types.

Here is the updated implementation, which should already satisfy these conditions:

```typescript
import { Collection, Db, ObjectId } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts"; // Assuming this utility exists

// Declare collection prefix, use concept name
const PREFIX = "ReproductionTracking.";

// Generic types of this concept for strong typing of IDs
type MotherId = ID;
type LitterId = ID;
type OffspringId = ID;
type ReportName = string; // As per spec, report name is a string identifier

/**
 * Represents a mother animal in the system.
 * The purpose is to track reproductive outcomes and offspring survivability.
 */
interface Mother {
  _id: MotherId; // The ID of the mother animal, provided externally.
  notes?: string; // Optional notes about the mother.
}

/**
 * Represents a litter of offspring born to a mother animal.
 * Organizes individual offspring into distinct litters.
 */
interface Litter {
  _id: LitterId; // The generated ID for this litter.
  motherId: MotherId; // Link to the mother of this litter.
  fatherId?: ID; // Optional link to the father of this litter.
  birthDate: Date; // The birth date of the litter.
  reportedLitterSize: number; // The number of offspring reported for this litter.
  notes?: string; // Optional notes about the litter.
}

/**
 * Represents an individual offspring, linked to a parent litter.
 */
interface Offspring {
  _id: OffspringId; // The ID of the offspring, provided externally.
  litterId: LitterId; // Link to its parent litter.
  sex: "male" | "female" | "neutered"; // The sex of the offspring.
  notes?: string; // Optional notes about the offspring.
  isAlive: boolean; // Indicates if the offspring is currently alive.
  survivedTillWeaning: boolean; // Indicates if the offspring survived till weaning.
}

/**
 * Represents a generated report on reproductive performance.
 */
interface Report {
  _id: ReportName; // The name of the report, used as its identifier.
  dateGenerated: Date; // The date the report was generated.
  target: MotherId; // The target mother animal for this report.
  startDateRange: Date; // Start date of the report's data range
  endDateRange: Date; // End date of the report's data range
  results: string[]; // A set of results, each represented as a string.
  summary?: string; // An optional AI-generated summary of the report.
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
   * **action** `addMother (motherId: String): (motherId: String)`
   *
   * **requires** mother is not already in the set of mothers
   * **effects** mother is added to the set of mothers
   * @param {object} args - The action arguments.
   * @param {string} args.motherId - The unique identifier for the mother.
   * @returns {{ motherId?: MotherId; error?: string }} The ID of the added mother, or an error.
   */
  async addMother({
    motherId,
  }: {
    motherId: string;
  }): Promise<{ motherId?: MotherId; error?: string }> {
    const existingMother = await this.mothers.findOne({ _id: motherId as ID });
    if (existingMother) {
      return { error: `Mother with ID '${motherId}' already exists.` };
    }

    const newMother: Mother = {
      _id: motherId as ID,
    };

    await this.mothers.insertOne(newMother);
    return { motherId: newMother._id };
  }

  /**
   * **action** `removeMother (motherId: String): (motherId: String)`
   *
   * **requires** a mother with this ID is in the set of mothers
   * **effects** removes this mother from the set of mothers.
   * (Associated litters and offspring will have dangling `motherId` references unless syncs are used for cascade deletion).
   * @param {object} args - The action arguments.
   * @param {string} args.motherId - The unique identifier of the mother to remove.
   * @returns {{ motherId?: MotherId; error?: string }} The ID of the removed mother, or an error.
   */
  async removeMother({
    motherId,
  }: {
    motherId: string;
  }): Promise<{ motherId?: MotherId; error?: string }> {
    const result = await this.mothers.deleteOne({ _id: motherId as ID });
    if (result.deletedCount === 0) {
      return { error: `Mother with ID '${motherId}' not found.` };
    }
    return { motherId: motherId as ID };
  }

  /**
   * **action** `recordLitter (motherId: String, fatherId: String?, birthDate: Date, reportedLitterSize: Number, notes: String?): (litterID: String)`
   *
   * **requires** motherId exists. No litter with same `motherId`, `fatherId`, `birthDate` already exists (to prevent exact duplicates).
   * **effects** creates a new litter record with the provided information. Also adds the mother to the set of mothers if she isn't there already.
   * @param {object} args - The action arguments.
   * @param {string} args.motherId - The ID of the mother.
   * @param {string} [args.fatherId] - Optional ID of the father.
   * @param {Date} args.birthDate - The birth date of the litter.
   * @param {number} args.reportedLitterSize - The reported number of offspring in the litter.
   * @param {string} [args.notes] - Optional notes for the litter.
   * @returns {{ litterID?: LitterId; error?: string }} The ID of the new litter, or an error.
   */
  async recordLitter({
    motherId,
    fatherId,
    birthDate,
    reportedLitterSize,
    notes,
  }: {
    motherId: string;
    fatherId?: string;
    birthDate: Date;
    reportedLitterSize: number;
    notes?: string;
  }): Promise<{ litterID?: LitterId; error?: string }> {
    // Check if mother exists, if not, add her (as per effects)
    const existingMother = await this.mothers.findOne({ _id: motherId as ID });
    if (!existingMother) {
      const addMotherResult = await this.addMother({ motherId });
      if (addMotherResult.error) {
        return { error: `Failed to ensure mother exists: ${addMotherResult.error}` };
      }
    }

    // Check for exact duplicate litter (mother, father, birthDate)
    const duplicateLitter = await this.litters.findOne({
      motherId: motherId as ID,
      fatherId: fatherId ? (fatherId as ID) : null, // Handle optional fatherId for query
      birthDate: birthDate,
    });
    if (duplicateLitter) {
      return {
        error: `A litter with mother ${motherId}, father ${fatherId || 'none'}, and birth date ${birthDate.toISOString()} already exists.`,
      };
    }

    const newLitterId = freshID();
    const newLitter: Litter = {
      _id: newLitterId,
      motherId: motherId as ID,
      fatherId: fatherId ? (fatherId as ID) : undefined, // Store as undefined if not provided
      birthDate,
      reportedLitterSize,
      notes,
    };
    await this.litters.insertOne(newLitter);
    return { litterID: newLitterId };
  }

  /**
   * **action** `updateLitter (litterId: String, motherId: String?, fatherId: String?, birthDate: Date?, reportedLitterSize: Number?, notes: String?): (litterID: String)`
   *
   * **requires** `litterId` exists
   * **effects** Updates any given information about the litter. If `motherId` is changed, ensures the new mother exists.
   * @param {object} args - The action arguments.
   * @param {string} args.litterId - The ID of the litter to update.
   * @param {string} [args.motherId] - New ID of the mother.
   * @param {string} [args.fatherId] - New optional ID of the father.
   * @param {Date} [args.birthDate] - New birth date.
   * @param {number} [args.reportedLitterSize] - New reported litter size.
   * @param {string} [args.notes] - New optional notes.
   * @returns {{ litterID?: LitterId; error?: string }} The ID of the updated litter, or an error.
   */
  async updateLitter({
    litterId,
    motherId,
    fatherId,
    birthDate,
    reportedLitterSize,
    notes,
  }: {
    litterId: string;
    motherId?: string;
    fatherId?: string;
    birthDate?: Date;
    reportedLitterSize?: number;
    notes?: string;
  }): Promise<{ litterID?: LitterId; error?: string }> {
    const existingLitter = await this.litters.findOne({ _id: litterId as ID });
    if (!existingLitter) {
      return { error: `Litter with ID '${litterId}' not found.` };
    }

    const updateFields: Partial<Litter> = {};
    if (motherId !== undefined) {
      const existingMother = await this.mothers.findOne({ _id: motherId as ID });
      if (!existingMother) {
        // Ensure new mother exists as per effects
        const addMotherResult = await this.addMother({ motherId });
        if (addMotherResult.error) {
          return { error: `Failed to ensure new mother for litter exists: ${addMotherResult.error}` };
        }
      }
      updateFields.motherId = motherId as ID;
    }
    if (fatherId !== undefined) updateFields.fatherId = fatherId ? (fatherId as ID) : undefined; // Allow setting fatherId to undefined
    if (birthDate !== undefined) updateFields.birthDate = birthDate;
    if (reportedLitterSize !== undefined) updateFields.reportedLitterSize = reportedLitterSize;
    if (notes !== undefined) updateFields.notes = notes;

    const result = await this.litters.updateOne(
      { _id: litterId as ID },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      return { error: `Litter with ID '${litterId}' not found for update.` };
    }
    return { litterID: litterId as ID };
  }

  /**
   * **action** `recordOffspring (litterId: String, offspringId: String, sex: Enum [male, female, neutered], notes: String?): (offspringID: String)`
   *
   * **requires** `litterId` exists and `offspringId` does not exist.
   * **effects** creates an individual offspring record linked to the specified litter.
   * @param {object} args - The action arguments.
   * @param {string} args.litterId - The ID of the parent litter.
   * @param {string} args.offspringId - The unique identifier for the offspring.
   * @param {'male' | 'female' | 'neutered'} args.sex - The sex of the offspring.
   * @param {string} [args.notes] - Optional notes for the offspring.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the new offspring, or an error.
   */
  async recordOffspring({
    litterId,
    offspringId,
    sex,
    notes,
  }: {
    litterId: string;
    offspringId: string;
    sex: "male" | "female" | "neutered";
    notes?: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    // Check requires: litterId exists
    const existingLitter = await this.litters.findOne({ _id: litterId as ID });
    if (!existingLitter) {
      return { error: `Litter with ID '${litterId}' not found.` };
    }

    // Check requires: offspringId does not exist
    const existingOffspring = await this.offspring.findOne({ _id: offspringId as ID });
    if (existingOffspring) {
      return { error: `Offspring with ID '${offspringId}' already exists.` };
    }

    const newOffspring: Offspring = {
      _id: offspringId as ID,
      litterId: litterId as ID,
      sex,
      notes,
      isAlive: true, // New offspring are assumed alive
      survivedTillWeaning: false, // Not yet weaned
    };
    await this.offspring.insertOne(newOffspring);
    return { offspringID: newOffspring._id };
  }

  /**
   * **action** `updateOffspring (offspringId: String, litterId: String?, sex: Enum?, notes: String?): (offspringID: String)`
   *
   * **requires** `offspringId` exists.
   * **effects** Updates any given information about the offspring. If `litterId` is changed, ensures the new litter exists.
   * @param {object} args - The action arguments.
   * @param {string} args.offspringId - The ID of the offspring to update.
   * @param {string} [args.litterId] - New ID of the parent litter.
   * @param {'male' | 'female' | 'neutered'} [args.sex] - New sex of the offspring.
   * @param {string} [args.notes] - New optional notes.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the updated offspring, or an error.
   */
  async updateOffspring({
    offspringId,
    litterId,
    sex,
    notes,
  }: {
    offspringId: string;
    litterId?: string;
    sex?: "male" | "female" | "neutered";
    notes?: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({ _id: offspringId as ID });
    if (!existingOffspring) {
      return { error: `Offspring with ID '${offspringId}' not found.` };
    }

    const updateFields: Partial<Offspring> = {};
    if (litterId !== undefined) {
      const existingLitter = await this.litters.findOne({ _id: litterId as ID });
      if (!existingLitter) {
        return { error: `New litter with ID '${litterId}' not found.` }; // No auto-creation for litter here, must exist.
      }
      updateFields.litterId = litterId as ID;
    }
    if (sex !== undefined) updateFields.sex = sex;
    if (notes !== undefined) updateFields.notes = notes;

    const result = await this.offspring.updateOne(
      { _id: offspringId as ID },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      return { error: `Offspring with ID '${offspringId}' not found for update.` };
    }
    return { offspringID: offspringId as ID };
  }

  /**
   * **action** `recordWeaning (offspringId: String): (offspringID: String)`
   *
   * **requires** offspring is in the set of offspring and is alive
   * **effects** Sets `survivedTillWeaning` to be true for the specified offspring
   * @param {object} args - The action arguments.
   * @param {string} args.offspringId - The ID of the offspring to mark as weaned.
   * @returns {{ offspringID?: OffspringId; error?: string }} The ID of the offspring, or an error.
   */
  async recordWeaning({
    offspringId,
  }: {
    offspringId: string;
  }): Promise<{ offspringID?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({ _id: offspringId as ID });
    if (!existingOffspring) {
      return { error: `Offspring with ID '${offspringId}' not found.` };
    }
    if (!existingOffspring.isAlive) {
      return { error: `Offspring with ID '${offspringId}' is not alive and cannot be weaned.` };
    }

    await this.offspring.updateOne(
      { _id: offspringId as ID },
      { $set: { survivedTillWeaning: true } },
    );
    return { offspringID: offspringId as ID };
  }

  /**
   * **action** `recordDeath (offspringId: String): (offspringId: String)`
   *
   * **requires** offspring is in the set of offspring and is currently living
   * **effects** Sets the `isAlive` flag of this offspring to false
   * @param {object} args - The action arguments.
   * @param {string} args.offspringId - The ID of the offspring to mark as deceased.
   * @returns {{ offspringId?: OffspringId; error?: string }} The ID of the offspring, or an error.
   */
  async recordDeath({
    offspringId,
  }: {
    offspringId: string;
  }): Promise<{ offspringId?: OffspringId; error?: string }> {
    const existingOffspring = await this.offspring.findOne({ _id: offspringId as ID });
    if (!existingOffspring) {
      return { error: `Offspring with ID '${offspringId}' not found.` };
    }
    if (!existingOffspring.isAlive) {
      return { error: `Offspring with ID '${offspringId}' is already marked as deceased.` };
    }

    await this.offspring.updateOne(
      { _id: offspringId as ID },
      { $set: { isAlive: false, survivedTillWeaning: false } }, // If dead, cannot have survived weaning
    );
    return { offspringId: offspringId as ID };
  }

  /**
   * **action** `generateReport (target: String, startDateRange: Date, endDateRange: Date, name: String): (reportName: String)`
   *
   * **requires** target animal is in the set of mothers
   * **effects** If no report with this name exists then generate a report on the reproductive performance
   * of the given animal within the specified date range, otherwise add the reproductive performance
   * of this animal to the existing report.
   * @param {object} args - The action arguments.
   * @param {string} args.target - The ID of the mother animal for which to generate the report.
   * @param {Date} args.startDateRange - The start date for data collection in the report.
   * @param {Date} args.endDateRange - The end date for data collection in the report.
   * @param {string} args.name - The name of the report.
   * @returns {{ reportName?: ReportName; error?: string }} The name of the generated/updated report, or an error.
   */
  async generateReport({
    target,
    startDateRange,
    endDateRange,
    name,
  }: {
    target: string;
    startDateRange: Date;
    endDateRange: Date;
    name: string;
  }): Promise<{ reportName?: ReportName; error?: string }> {
    // Check requires: target mother exists
    const existingMother = await this.mothers.findOne({ _id: target as ID });
    if (!existingMother) {
      return { error: `Target mother with ID '${target}' not found.` };
    }

    // Placeholder for actual report generation logic
    // In a real scenario, this would involve aggregation queries on litters and offspring
    const generatedResults = [
      `Report for mother: ${target}`,
      `Date range: ${startDateRange.toDateString()} to ${endDateRange.toDateString()}`,
      `Litters recorded: X`, // This would be calculated from this.litters
      `Total offspring: Y`, // This would be calculated from this.offspring
      `Survival rate to weaning: Z%`, // This would be calculated
    ];

    const existingReport = await this.reports.findOne({ _id: name as ReportName });

    if (existingReport) {
      // Add performance to existing report
      await this.reports.updateOne(
        { _id: name as ReportName },
        {
          $set: { dateGenerated: new Date(), target: target as ID, startDateRange, endDateRange },
          $addToSet: { results: { $each: generatedResults } }, // Add new results to the array
        },
      );
    } else {
      // Create new report
      const newReport: Report = {
        _id: name as ReportName,
        dateGenerated: new Date(),
        target: target as ID,
        startDateRange,
        endDateRange,
        results: generatedResults,
      };
      await this.reports.insertOne(newReport);
    }

    return { reportName: name as ReportName };
  }

  /**
   * **action** `renameReport (oldName: String, newName: String): (newName: String)`
   *
   * **requires** oldName of report exists
   * **effects** renames the specified report
   * @param {object} args - The action arguments.
   * @param {string} args.oldName - The current name of the report.
   * @param {string} args.newName - The new name for the report.
   * @returns {{ newName?: ReportName; error?: string }} The new name of the report, or an error.
   */
  async renameReport({
    oldName,
    newName,
  }: {
    oldName: string;
    newName: string;
  }): Promise<{ newName?: ReportName; error?: string }> {
    const existingReport = await this.reports.findOne({ _id: oldName as ReportName });
    if (!existingReport) {
      return { error: `Report with name '${oldName}' not found.` };
    }
    const newNameExists = await this.reports.findOne({ _id: newName as ReportName });
    if (newNameExists) {
      return { error: `Report with new name '${newName}' already exists.` };
    }

    // Since _id is the primary key (report name), we have to delete and re-insert
    // or use a transaction if available and desired for atomicity, but for a simple rename this is okay.
    // In a real-world scenario with strong consistency needs, one might prefer a transaction or disallow _id changes directly.
    await this.reports.deleteOne({ _id: oldName as ReportName });
    const updatedReport = { ...existingReport, _id: newName as ReportName };
    await this.reports.insertOne(updatedReport);

    return { newName: newName as ReportName };
  }

  /**
   * **query** `_viewReport (reportName: String): (Results: String)`
   *
   * **requires** report with the given name exists
   * **effects** returns results of the report
   * @param {object} args - The query arguments.
   * @param {string} args.reportName - The name of the report to view.
   * @returns {{ results?: string[]; error?: string }} The results of the report, or an error.
   */
  async _viewReport({
    reportName,
  }: {
    reportName: string;
  }): Promise<{ results?: string[]; error?: string }> {
    const report = await this.reports.findOne({ _id: reportName as ReportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return { results: report.results };
  }

  /**
   * **action** `deleteReport (reportName: String)`
   *
   * **requires** report exists
   * **effects** remove the report from the system
   * @param {object} args - The action arguments.
   * @param {string} args.reportName - The name of the report to delete.
   * @returns {Empty | { error: string }} An empty object on success, or an error.
   */
  async deleteReport({ reportName }: { reportName: string }): Promise<Empty | { error: string }> {
    const result = await this.reports.deleteOne({ _id: reportName as ReportName });
    if (result.deletedCount === 0) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return {};
  }

  /**
   * **query** `_aiSummary (reportName: String): (summary: String)`
   *
   * **requires** report exists
   * **effects** The AI generates a summary of the report, highlighting key takeaways
   * and trends shown in the report, and saves it for future viewing
   * @param {object} args - The query arguments.
   * @param {string} args.reportName - The name of the report to summarize.
   * @returns {{ summary?: string; error?: string }} The AI-generated summary, or an error.
   */
  async _aiSummary({
    reportName,
  }: {
    reportName: string;
  }): Promise<{ summary?: string; error?: string }> {
    const report = await this.reports.findOne({ _id: reportName as ReportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    // If a summary already exists, return it
    if (report.summary) {
      return { summary: report.summary };
    }

    // Placeholder for actual AI summary generation logic
    const generatedSummary = `AI Summary for '${reportName}': This report highlights key trends in reproductive performance for target mother ${report.target}. It shows X litters resulting in Y offspring. The survival rate to weaning is Z%. Further analysis could focus on factors affecting offspring survival. (This is a mock summary)`;

    // Save the generated summary back to the report
    await this.reports.updateOne(
      { _id: reportName as ReportName },
      { $set: { summary: generatedSummary } },
    );

    return { summary: generatedSummary };
  }
}
```
