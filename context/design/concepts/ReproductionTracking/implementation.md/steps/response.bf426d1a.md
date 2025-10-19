---
timestamp: 'Thu Oct 16 2025 18:46:30 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_184630.5f009893.md]]'
content_id: bf426d1a4e6e15be673c37d8ac7686b8163c1ebf14f3a66d5da6c299245546be
---

# response:

To address the requirement of making the `summary` field in the `Report` interface a non-optional string that defaults to an empty string, and to set up the AI summary generation as described, I've made the following modifications:

1. **Updated `Report` Interface**:
   * The `summary` field is now `string` (non-optional).
   * Added `startDateRange: Date;` and `endDateRange: Date;` to the `Report` interface, as these are necessary context for the AI.

2. **Modified `generateReport` Action**:
   * Ensures `startDateRange` and `endDateRange` are stored in the `Report` document when a report is created or updated.
   * When a report is created, `summary` is explicitly initialized to `""`.
   * When an existing report is updated, the `summary` field is explicitly set to `""` in the `$set` clause. This ensures that if the report content changes, any previous AI summary is cleared, marking it as stale.

3. **Modified `_aiSummary` Query**:
   * The logic now fetches the `startDateRange` and `endDateRange` from the stored `Report` document.
   * It gathers detailed `Mother`, `Litter`, and `Offspring` data relevant to the report's `target` and date range.
   * A comprehensive prompt, including the detailed data, is constructed for the AI.
   * A private mock AI service (`_mockAIService`) is implemented to simulate the AI's response, adhering strictly to the specified JSON format and classification rules, including identifying "potential record errors" by analyzing the detailed data.
   * The mock AI response's `insights` field is saved into the `Report` document's `summary` field.
   * The generated `insights` string is returned.

Here's the updated `ReproductionTrackingConcept.ts` file:

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
  notes: string; // Notes about the mother. Stored as "" if not provided.
}

/**
 * Represents a litter of offspring born to a mother animal.
 * Organizes individual offspring into distinct litters.
 * The `fatherId` will always be present, using `UNKNOWN_FATHER_ID` if not specified.
 */
interface Litter {
  _id: LitterId; // The generated ID for this litter.
  motherId: MotherId; // Link to the mother of this litter.
  fatherId: ID; // Link to the father of this litter, or UNKNOWN_FATHER_ID.
  birthDate: Date; // The birth date of the litter.
  reportedLitterSize: number; // The number of offspring reported for this litter.
  notes: string; // Notes about the litter. Stored as "" if not provided.
}

/**
 * Represents an individual offspring, linked to a parent litter.
 */
interface Offspring {
  _id: OffspringId; // The ID of the offspring, provided externally.
  litterId: LitterId; // Link to its parent litter.
  sex: "male" | "female" | "neutered"; // The sex of the offspring.
  notes: string; // Notes about the offspring. Stored as "" if not provided.
  isAlive: boolean; // Indicates if the offspring is currently alive.
  survivedTillWeaning: boolean; // Indicates if the offspring survived till weaning.
}

/**
 * Represents a generated report on reproductive performance.
 * Includes start and end date ranges for context.
 */
interface Report {
  _id: ReportName; // The name of the report, used as its identifier.
  dateGenerated: Date; // The date the report was generated.
  target: ID[]; // A set of target mother animal IDs for this report.
  startDateRange: Date; // The start date for data collection in the report.
  endDateRange: Date; // The end date for data collection in the report.
  results: string[]; // A set of results, each represented as a string.
  summary: string; // An AI-generated summary of the report. Defaults to empty string.
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
      notes: "", // Default to empty string
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

    const actualMotherId = motherId as ID;
    // Use UNKNOWN_FATHER_ID if fatherId is not provided
    const actualFatherId: ID = fatherId ? (fatherId as ID) : UNKNOWN_FATHER_ID;

    // Construct filter for exact duplicate litter check
    const litterFilter = {
      motherId: actualMotherId,
      fatherId: actualFatherId, // Now always a specific ID string (either provided or UNKNOWN_FATHER_ID)
      birthDate: birthDate,
    };

    const duplicateLitter = await this.litters.findOne(litterFilter);
    if (duplicateLitter) {
      return {
        error: `A litter with mother ${motherId}, father ${fatherId || 'none'}, and birth date ${birthDate.toISOString()} already exists.`,
      };
    }

    const newLitterId = freshID();
    const newLitter: Litter = {
      _id: newLitterId,
      motherId: actualMotherId,
      fatherId: actualFatherId, // Store the constant or the provided ID
      birthDate,
      reportedLitterSize,
      notes: notes ?? "", // Optional notes should default to an empty string if not provided
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
    // Handle fatherId update: if explicitly provided as undefined, set to UNKNOWN_FATHER_ID.
    // Otherwise, use the provided fatherId. If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], 'fatherId')) {
      if (fatherId === undefined) {
          updateFields.fatherId = UNKNOWN_FATHER_ID;
      } else {
          updateFields.fatherId = fatherId as ID;
      }
    }
    if (birthDate !== undefined) updateFields.birthDate = birthDate;
    if (reportedLitterSize !== undefined) updateFields.reportedLitterSize = reportedLitterSize;
    // Handle notes update: if explicitly provided as undefined, set to empty string.
    // If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], 'notes')) {
      updateFields.notes = notes ?? ""; // Optional notes should default to an empty string if not provided
    }

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
      notes: notes ?? "", // Optional notes should default to an empty string if not provided
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
    // Handle notes update: if explicitly provided as undefined, set to empty string.
    // If not in args, don't change it.
    if (Object.prototype.hasOwnProperty.call(arguments[0], 'notes')) {
      updateFields.notes = notes ?? ""; // Optional notes should default to an empty string if not provided
    }

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
   * **action** `generateReport (target: String, startDateRange: Date, endDateRange: Date, name: String): (results: string[])`
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
   * @returns {{ results?: string[]; error?: string }} The results of the generated/updated report, or an error.
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
  }): Promise<{ results?: string[]; error?: string }> {
    // Check requires: target mother exists
    const existingMother = await this.mothers.findOne({ _id: target as ID });
    if (!existingMother) {
      return { error: `Target mother with ID '${target}' not found.` };
    }

    // --- Start: Actual report generation logic for the specific target and date range ---
    const relevantLitters = await this.litters.find({
        motherId: target as ID,
        birthDate: { $gte: startDateRange, $lte: endDateRange },
    }).toArray();

    let littersCount = relevantLitters.length;
    let totalOffspringCount = 0;
    let survivedWeaningCount = 0;

    if (littersCount > 0) {
        const litterIds = relevantLitters.map(l => l._id);
        const relevantOffspring = await this.offspring.find({
            litterId: { $in: litterIds }
        }).toArray();

        totalOffspringCount = relevantOffspring.length;
        survivedWeaningCount = relevantOffspring.filter(o => o.survivedTillWeaning).length;
    }

    // This string represents the "reproductive performance" for this specific target and date range.
    const newPerformanceEntry = `Performance for ${target} (${startDateRange.toDateString()} to ${endDateRange.toDateString()}): ` +
                                `Litters: ${littersCount}, Offspring: ${totalOffspringCount}, ` +
                                `Weaning Survival: ${totalOffspringCount > 0 ? ((survivedWeaningCount / totalOffspringCount) * 100).toFixed(2) + '%' : 'N/A'}`;
    // --- End: Actual report generation logic ---

    const reportNameId = name as ReportName;
    const existingReport = await this.reports.findOne({ _id: reportNameId });
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
        { _id: reportNameId },
        {
          $set: {
            dateGenerated: new Date(),
            target: currentReportTargets,
            startDateRange, // Store it
            endDateRange,   // Store it
            results: currentReportResults,
            summary: "", // Clear summary as report content has changed
          },
        },
      );
    } else {
      // Create new report
      const newReport: Report = {
        _id: reportNameId,
        dateGenerated: new Date(),
        target: [target as ID], // Initialize with the first target
        startDateRange, // Store it
        endDateRange,   // Store it
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
    // If a summary already exists and is not an empty string, return it
    if (report.summary !== "") {
      return { summary: report.summary };
    }

    // --- Start: Gather detailed data for AI input ---
    const targetMothers = await this.mothers.find({ _id: { $in: report.target } }).toArray();
    const relevantLitters = await this.litters.find({
        motherId: { $in: report.target },
        birthDate: { $gte: report.startDateRange, $lte: report.endDateRange },
    }).toArray();
    const relevantOffspring = await this.offspring.find({
        litterId: { $in: relevantLitters.map(l => l._id) }
    }).toArray();

    const dataForAI = {
        reportName: report._id,
        dateGenerated: report.dateGenerated,
        targetMothers: targetMothers,
        relevantLitters: relevantLitters,
        relevantOffspring: relevantOffspring,
        summaryResultsStrings: report.results // The aggregated performance strings
    };
    // --- End: Gather detailed data for AI input ---

    // Construct the full prompt for the AI
    const aiPrompt = `You are an expert livestock analyst. Given the following report, respond ONLY with valid JSON in this exact format:
{
"highPerformers": ["animalId1", ...],
"lowPerformers": ["animalId2", ...],
"concerningTrends": ["animalId3", ...],
"averagePerformers": ["animalId4", ...],
"potentialRecordErrors": ["animalId5", ...],
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

Here is the data for the report '${reportName}':
${JSON.stringify(dataForAI, null, 2)}
`;

    // Mock AI service call
    const aiResponseJsonString = await this._mockAIService(aiPrompt, dataForAI);
    let aiParsedResponse: {
      highPerformers: ID[];
      lowPerformers: ID[];
      concerningTrends: ID[];
      averagePerformers: ID[];
      potentialRecordErrors: ID[];
      insights: string;
    };
    try {
      aiParsedResponse = JSON.parse(aiResponseJsonString);
      // Basic validation to ensure all required fields are present
      if (!aiParsedResponse.insights ||
          !Array.isArray(aiParsedResponse.highPerformers) ||
          !Array.isArray(aiParsedResponse.lowPerformers) ||
          !Array.isArray(aiParsedResponse.concerningTrends) ||
          !Array.isArray(aiParsedResponse.averagePerformers) ||
          !Array.isArray(aiParsedResponse.potentialRecordErrors)) {
        throw new Error("Invalid AI response format: missing or malformed fields.");
      }
    } catch (e) {
      console.error("Error parsing AI response:", e);
      return { error: `Failed to parse AI summary: ${e instanceof Error ? e.message : String(e)}` };
    }

    const generatedSummary = aiParsedResponse.insights;

    // Save the generated summary back to the report
    await this.reports.updateOne(
      { _id: reportName as ReportName },
      { $set: { summary: generatedSummary } },
    );

    return { summary: generatedSummary };
  }

  /**
   * Private mock AI service function.
   * In a real application, this would call an external AI API.
   * For demonstration, it generates a plausible response based on the input data and prompt requirements.
   * @param {string} prompt - The full prompt sent to the AI.
   * @param {any} data - The detailed data object provided to the AI.
   * @returns {Promise<string>} A promise resolving to the AI's JSON response string.
   */
  private async _mockAIService(prompt: string, data: any): Promise<string> {
    // This is a mock implementation. It attempts to simulate AI behavior based on the provided data.
    const mothers = data.targetMothers.map((m: Mother) => m._id);
    const litters = data.relevantLitters as Litter[];
    const offspring = data.relevantOffspring as Offspring[];

    let highPerformers: ID[] = [];
    let lowPerformers: ID[] = [];
    let concerningTrends: ID[] = [];
    let averagePerformers: ID[] = [];
    let potentialRecordErrors: ID[] = [];
    let insightsMessages: string[] = [];

    const motherAggregatedData: {
      [motherId: string]: {
        littersCount: number;
        totalReportedLitterSize: number;
        actualOffspringCount: number;
        weanedOffspringCount: number;
        isPotentialError: boolean;
        errorDetails: string[];
      };
    } = {};

    mothers.forEach((mId: ID) => {
      motherAggregatedData[mId] = {
        littersCount: 0,
        totalReportedLitterSize: 0,
        actualOffspringCount: 0,
        weanedOffspringCount: 0,
        isPotentialError: false,
        errorDetails: [],
      };
    });

    litters.forEach((litter: Litter) => {
      const mData = motherAggregatedData[litter.motherId];
      if (mData) {
        mData.littersCount++;
        mData.totalReportedLitterSize += litter.reportedLitterSize;

        const litterOffspring = offspring.filter((o: Offspring) => o.litterId === litter._id);
        mData.actualOffspringCount += litterOffspring.length;
        mData.weanedOffspringCount += litterOffspring.filter((o: Offspring) => o.survivedTillWeaning).length;

        // Check for specific litter-level errors
        if (litterOffspring.length > litter.reportedLitterSize && litter.reportedLitterSize > 0) {
            mData.isPotentialError = true;
            mData.errorDetails.push(`Litter ${litter._id} for mother ${litter.motherId} has more actual offspring (${litterOffspring.length}) than reported (${litter.reportedLitterSize}).`);
        }
        if (litter.reportedLitterSize < 0) {
            mData.isPotentialError = true;
            mData.errorDetails.push(`Litter ${litter._id} for mother ${litter.motherId} has a negative reported litter size.`);
        }
      }
    });

    // Post-aggregation error checks and performance classification
    let totalWeaningSurvivalSumForOverall = 0;
    let totalOffspringCountForOverall = 0;

    for (const motherId of mothers) {
      const mData = motherAggregatedData[motherId];
      if (!mData) {
        // Mother in target list but no litters/offspring data within the date range
        if (!potentialRecordErrors.includes(motherId)) {
            potentialRecordErrors.push(motherId);
            insightsMessages.push(`Mother ${motherId} is targeted but has no associated litters within the report date range. This may indicate missing data.`);
        }
        continue;
      }

      // Check for errors at mother level
      if (mData.weanedOffspringCount > mData.actualOffspringCount) {
        mData.isPotentialError = true;
        mData.errorDetails.push(`Mother ${motherId} has more weaned offspring (${mData.weanedOffspringCount}) than total recorded offspring (${mData.actualOffspringCount}).`);
      }
      if (mData.weanedOffspringCount < 0 || mData.actualOffspringCount < 0 || mData.littersCount < 0) {
        mData.isPotentialError = true;
        mData.errorDetails.push(`Mother ${motherId} has negative counts for litters, offspring, or weaned offspring.`);
      }

      if (mData.isPotentialError) {
        if (!potentialRecordErrors.includes(motherId)) {
          potentialRecordErrors.push(motherId);
        }
        insightsMessages.push(`Potential record errors identified for Mother ${motherId}: ${mData.errorDetails.join(' ')}`);
      }

      // Classify performance (only if not an error)
      if (!potentialRecordErrors.includes(motherId)) {
        if (mData.actualOffspringCount > 0) {
            const weaningSurvivalRate = (mData.weanedOffspringCount / mData.actualOffspringCount) * 100;
            totalWeaningSurvivalSumForOverall += weaningSurvivalRate;
            totalOffspringCountForOverall++; // Count for overall average

            if (weaningSurvivalRate > 90 && mData.littersCount > 0) {
                highPerformers.push(motherId);
            } else if (weaningSurvivalRate < 50) {
                lowPerformers.push(motherId);
            } else {
                averagePerformers.push(motherId);
            }

            if (weaningSurvivalRate === 0 && mData.actualOffspringCount > 0) {
                concerningTrends.push(motherId);
                insightsMessages.push(`Mother ${motherId} had 0% weaning survival across ${mData.actualOffspringCount} offspring, which is a significant concern.`);
            }
        } else if (mData.littersCount > 0) { // Litters > 0 but offspring === 0
            concerningTrends.push(motherId);
            insightsMessages.push(`Mother ${motherId} had ${mData.littersCount} litters recorded but zero actual offspring found in the system for these litters. This is a concerning data inconsistency or performance issue.`);
        } else { // No litters, no offspring (already handled for potential error, but if not error, then average)
            averagePerformers.push(motherId);
        }
      }
    }

    // Ensure all target mothers are classified into at least one category
    const classifiedMotherIds = new Set([
        ...highPerformers, ...lowPerformers, ...concerningTrends,
        ...potentialRecordErrors
    ]);

    for (const motherId of mothers) {
        if (!classifiedMotherIds.has(motherId) && !averagePerformers.includes(motherId)) {
            averagePerformers.push(motherId); // Default to average if not already classified
        }
    }

    // Remove duplicates and filter averagePerformers as per prompt
    highPerformers = [...new Set(highPerformers)];
    lowPerformers = [...new Set(lowPerformers)];
    concerningTrends = [...new Set(concerningTrends)];
    potentialRecordErrors = [...new Set(potentialRecordErrors)];

    averagePerformers = averagePerformers.filter(mId =>
      !highPerformers.includes(mId) &&
      !lowPerformers.includes(mId) &&
      !concerningTrends.includes(mId) &&
      !potentialRecordErrors.includes(mId)
    );
    averagePerformers = [...new Set(averagePerformers)]; // Remove duplicates from average performers


    // Calculate overall average performance for insights
    const overallAvgPerformance = totalOffspringCountForOverall > 0 ?
      totalWeaningSurvivalSumForOverall / totalOffspringCountForOverall : 0;

    let overallPerformanceComment = "";
    if (overallAvgPerformance > 85) {
        overallPerformanceComment = "The group exhibits exceptionally strong overall weaning survival performance.";
    } else if (overallAvgPerformance > 70) {
        overallPerformanceComment = "Overall group performance indicates healthy reproductive outcomes.";
    } else if (overallAvgPerformance < 50 && totalOffspringCountForOverall > 0) {
        overallPerformanceComment = "The overall weaning survival rate for the group is quite low, indicating widespread challenges.";
    } else {
        overallPerformanceComment = "Overall group performance is moderate, with some variability among individuals.";
    }

    // Assemble insights into paragraphs
    const insightParagraphs: string[] = [];
    if (insightsMessages.length > 0) {
        insightParagraphs.push(
            "Specific findings and potential record errors have been identified. For instance, " +
            insightsMessages.join(". ") + ". Immediate attention to these mothers is advised for data verification or management intervention."
        );
    }

    insightParagraphs.push(overallPerformanceComment + " It is crucial to monitor factors influencing weaning survival rates, such as dam nutrition, environmental stressors, and disease management practices.");

    const specificPerformersExist = highPerformers.length > 0 || lowPerformers.length > 0 || concerningTrends.length > 0;
    if (specificPerformersExist) {
        insightParagraphs.push(
            "For high performers, strategies to maintain or scale their success should be explored. For low performers and those with concerning trends, a deeper dive into their health records, breeding history, and environmental conditions could reveal underlying causes and inform targeted interventions."
        );
    } else if (mothers.length > 0) {
         insightParagraphs.push("While no acute issues were flagged, continuous monitoring of all animals is essential for proactive management and sustained productivity.");
    } else {
         insightParagraphs.push("No specific animal performance data was available for deep analysis within this report's scope.");
    }

    const finalInsightsText = insightParagraphs.join("\n\n");

    const mockResponse = {
        highPerformers,
        lowPerformers,
        concerningTrends,
        averagePerformers,
        potentialRecordErrors,
        insights: finalInsightsText,
    };

    return JSON.stringify(mockResponse, null, 2);
  }
}
```
