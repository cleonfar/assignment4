---
timestamp: 'Sat Oct 18 2025 14:46:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251018_144642.c5723f87.md]]'
content_id: c088b21d24e811a81d3597f6aa72074a06f921602dbade6111eb389fb6b8e3a8
---

# response:

Here's the implementation of the `GrowthTrackingConcept` in TypeScript, following the provided structure and guidelines.

```typescript
// src/GrowthTracking/GrowthTrackingConcept.ts

import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
// Assuming freshID generates string IDs; not explicitly used in this concept
// as animal IDs are external or implicitly created by their first record.

// Declare collection prefix, use concept name
const PREFIX = "GrowthTracking" + ".";

// Generic type for external entity IDs
type Animal = ID;

/**
 * @concept GrowthTracking
 * @purpose track animal growth information
 *
 * @principle
 *   a user records growth data like weight for individual animals;
 *   uses this data to generate reports to track performance and health;
 *   can give the generated reports to an AI for high level summary and suggests;
 */
export default class GrowthTrackingConcept {
  animals: Collection<AnimalDoc>;
  reports: Collection<ReportDoc>;

  /**
   * @state
   *   a set of `WeightRecords` with
   *     a `date` of type `Date`
   *     a `weight` of type `Number`
   *     an optional `notes` of type `String`
   */
  // Interface for embedded weight records within an animal document
  private interface WeightRecord {
    date: Date;
    weight: number;
    notes: string; // Optional string fields are empty strings instead of null/undefined
  }

  /**
   * @state
   *   a set of `animals` with
   *     an `ID` of type `ID`
   *     a set of `WeightRecords`
   */
  // Interface for the animal collection document
  private interface AnimalDoc {
    _id: Animal; // The ID of the animal
    weightRecords: WeightRecord[];
  }

  /**
   * @state
   *   a set of `Reports` with
   *     a `report name` of type `String` (used as `_id` for uniqueness and lookup)
   *     a `dateGenerated` of type `Date`
   *     a `target` of type `set of IDs` (the animals included in the report)
   *     a set of `results` of type `(key-value pairs of data)` (detailed growth metrics)
   *     an optional AI generatedSummary
   */
  // Interface for detailed growth results for a single animal within a report
  private interface ReportResultData {
    animalId: Animal;
    startDate: Date;
    endDate: Date;
    initialWeight?: number;
    finalWeight?: number;
    totalWeightGain?: number;
    daysTracked?: number;
    averageDailyGain?: number; // Average Daily Gain (ADG)
    weightsInPeriod: { date: Date; weight: number; }[]; // All recorded weights within the report period
  }

  // Interface for the report collection document
  private interface ReportDoc {
    _id: string; // Report name (unique identifier)
    dateGenerated: Date;
    targetAnimals: Animal[]; // Set of animal IDs covered by this report
    results: ReportResultData[]; // Array to store results for each targeted animal
    aiGeneratedSummary: string; // Optional AI summary, empty string if not generated
  }

  constructor(private readonly db: Db) {
    this.animals = this.db.collection(PREFIX + "animals");
    this.reports = this.db.collection(PREFIX + "reports");
  }

  /**
   * @action
   * recordWeight (animal: Animal, date: Date, weight: Number, notes: String)
   *
   * @param {object} args
   * @param {Animal} args.animal - The unique identifier of the animal.
   * @param {Date} args.date - The date when the weight was recorded.
   * @param {number} args.weight - The weight value.
   * @param {string} [args.notes=""] - Optional notes associated with this weight record.
   * @returns {Empty | {error: string}} An empty object on success, or an error object.
   *
   * @requires animal exists (or is implicitly created if this is the first record for it).
   * @effects create a new weight record for this animal.
   */
  async recordWeight({
    animal,
    date,
    weight,
    notes = "",
  }: {
    animal: Animal;
    date: Date;
    weight: number;
    notes?: string;
  }): Promise<Empty | { error: string }> {
    if (!animal || !date || typeof weight !== "number") {
      return { error: "Animal ID, date, and weight are required." };
    }
    if (isNaN(date.getTime())) {
      return { error: "Invalid date provided." };
    }
    if (weight <= 0) {
      return { error: "Weight must be a positive number." };
    }

    const newWeightRecord: WeightRecord = {
      date,
      weight,
      notes: notes,
    };

    // Upsert the animal document: if it doesn't exist, create it with this first record.
    // Otherwise, add the new weight record to its array.
    const updateResult = await this.animals.updateOne(
      { _id: animal },
      {
        $push: { weightRecords: newWeightRecord },
      },
      { upsert: true }, // Create the animal document if it doesn't exist
    );

    if (!updateResult.acknowledged) {
      return { error: "Failed to record weight." };
    }

    return {};
  }

  /**
   * @action
   * removeWeightRecord (animal: Animal, date: Date)
   *
   * @param {object} args
   * @param {Animal} args.animal - The unique identifier of the animal.
   * @param {Date} args.date - The date of the weight record to remove.
   * @returns {Empty | {error: string}} An empty object on success, or an error object.
   *
   * @requires there is a weight record for this animal on the given date.
   * @effects remove the given weight record from the animal's set of weight records.
   */
  async removeWeightRecord({
    animal,
    date,
  }: {
    animal: Animal;
    date: Date;
  }): Promise<Empty | { error: string }> {
    if (!animal || !date) {
      return { error: "Animal ID and date are required." };
    }
    if (isNaN(date.getTime())) {
      return { error: "Invalid date provided." };
    }

    const animalDoc = await this.animals.findOne({ _id: animal });
    if (!animalDoc) {
      return { error: `Animal with ID '${animal}' not found.` };
    }

    // Find the exact record to remove. Using toDateString to match date only.
    const recordToRemove = animalDoc.weightRecords.find(
      (rec) => rec.date.toDateString() === date.toDateString(),
    );

    if (!recordToRemove) {
      return {
        error: `No weight record found for animal '${animal}' on ${date.toDateString()}.`,
      };
    }

    // $pull operator removes all instances matching the condition from an array
    const updateResult = await this.animals.updateOne(
      { _id: animal },
      { $pull: { weightRecords: recordToRemove } },
    );

    if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
      return { error: "Failed to remove weight record." };
    }

    return {};
  }

  /**
   * @action
   * generateReport (target: Animal, startDateRange: Date, endDateRange: Date, name: String): (reportId: String)
   *
   * @param {object} args
   * @param {Animal} args.target - The ID of the animal for which to generate/update the report.
   * @param {Date} args.startDateRange - The start date for filtering weight records.
   * @param {Date} args.endDateRange - The end date for filtering weight records.
   * @param {string} args.name - The unique name for the report.
   * @returns {{reportId: string} | {error: string}} The ID of the generated/updated report on success, or an error object.
   *
   * @requires target animal exists.
   * @effects If no report with this name exists, generate a new report. Otherwise, add or update the growth performance for the given animal in the existing report. The report includes weights and average daily rate of gain.
   */
  async generateReport({
    target,
    startDateRange,
    endDateRange,
    name,
  }: {
    target: Animal;
    startDateRange: Date;
    endDateRange: Date;
    name: string;
  }): Promise<{ reportId: string } | { error: string }> {
    if (!target || !startDateRange || !endDateRange || !name) {
      return { error: "Target animal ID, date range, and report name are required." };
    }
    if (isNaN(startDateRange.getTime()) || isNaN(endDateRange.getTime())) {
      return { error: "Invalid date range provided." };
    }
    if (startDateRange > endDateRange) {
      return { error: "Start date cannot be after end date." };
    }

    const animalDoc = await this.animals.findOne({ _id: target });
    if (!animalDoc) {
      return { error: `Animal with ID '${target}' not found.` };
    }

    const relevantRecords = animalDoc.weightRecords
      .filter((rec) => rec.date >= startDateRange && rec.date <= endDateRange)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (relevantRecords.length < 2) {
      // Need at least two records to calculate a gain/loss
      return {
        error: `Not enough weight records for animal '${target}' within the specified range to calculate growth. Requires at least 2 records.`,
      };
    }

    const firstRecord = relevantRecords[0];
    const lastRecord = relevantRecords[relevantRecords.length - 1];

    const initialWeight = firstRecord.weight;
    const finalWeight = lastRecord.weight;
    const totalWeightGain = finalWeight - initialWeight;
    const daysTracked =
      (lastRecord.date.getTime() - firstRecord.date.getTime()) / (1000 * 60 * 60 * 24);

    const averageDailyGain = daysTracked > 0 ? totalWeightGain / daysTracked : 0;

    const newReportResult: ReportResultData = {
      animalId: target,
      startDate: startDateRange,
      endDate: endDateRange,
      initialWeight,
      finalWeight,
      totalWeightGain,
      daysTracked,
      averageDailyGain: parseFloat(averageDailyGain.toFixed(2)), // Format ADG for readability
      weightsInPeriod: relevantRecords.map(r => ({ date: r.date, weight: r.weight }))
    };

    const existingReport = await this.reports.findOne({ _id: name });

    if (existingReport) {
      // Report exists: update it
      const existingResultIndex = existingReport.results.findIndex(
        (r) => r.animalId === target,
      );

      if (existingResultIndex > -1) {
        existingReport.results[existingResultIndex] = newReportResult;
      } else {
        existingReport.results.push(newReportResult);
      }

      // Ensure targetAnimals array includes the current animal
      if (!existingReport.targetAnimals.includes(target)) {
        existingReport.targetAnimals.push(target);
      }
      existingReport.dateGenerated = new Date(); // Update generation date

      await this.reports.replaceOne({ _id: name }, existingReport);
    } else {
      // Report does not exist: create a new one
      const newReportDoc: ReportDoc = {
        _id: name,
        dateGenerated: new Date(),
        targetAnimals: [target], // Start with the current target animal
        results: [newReportResult],
        aiGeneratedSummary: "", // Initialize optional string field as empty
      };
      await this.reports.insertOne(newReportDoc);
    }

    return { reportId: name };
  }

  /**
   * @action
   * renameReport (oldName: String, newName: String): (newName: String)
   *
   * @param {object} args
   * @param {string} args.oldName - The current name of the report.
   * @param {string} args.newName - The new desired name for the report.
   * @returns {{newName: string} | {error: string}} The new name of the report on success, or an error object.
   *
   * @requires oldName of report exists and newName does not exist.
   * @effects renames the specified report.
   */
  async renameReport({
    oldName,
    newName,
  }: {
    oldName: string;
    newName: string;
  }): Promise<{ newName: string } | { error: string }> {
    if (!oldName || !newName) {
      return { error: "Both old and new report names are required." };
    }
    if (oldName === newName) {
      return { error: "Old and new report names cannot be the same." };
    }

    const existingReport = await this.reports.findOne({ _id: oldName });
    if (!existingReport) {
      return { error: `Report with name '${oldName}' not found.` };
    }

    const newNameExists = await this.reports.findOne({ _id: newName });
    if (newNameExists) {
      return { error: `Report with new name '${newName}' already exists. Please choose a different name.` };
    }

    // In MongoDB, renaming an _id requires inserting a new document and deleting the old one.
    const newReport = { ...existingReport, _id: newName };
    const insertResult = await this.reports.insertOne(newReport);

    if (!insertResult.acknowledged) {
      return { error: "Failed to create report with the new name." };
    }

    const deleteResult = await this.reports.deleteOne({ _id: oldName });

    if (!deleteResult.acknowledged || deleteResult.deletedCount === 0) {
      // This is a partial failure scenario; new report exists, old one might still exist.
      // A more robust system might use transactions if supported.
      return { error: "Report renamed successfully, but original report could not be fully deleted." };
    }

    return { newName: newName };
  }

  /**
   * @action
   * deleteReport (reportName: String)
   *
   * @param {object} args
   * @param {string} args.reportName - The name of the report to delete.
   * @returns {Empty | {error: string}} An empty object on success, or an error object.
   *
   * @requires report exists.
   * @effects remove the report from the system.
   */
  async deleteReport({
    reportName,
  }: {
    reportName: string;
  }): Promise<Empty | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }

    const deleteResult = await this.reports.deleteOne({ _id: reportName });

    if (!deleteResult.acknowledged || deleteResult.deletedCount === 0) {
      return { error: `Report with name '${reportName}' not found or failed to delete.` };
    }

    return {};
  }

  /**
   * @action
   * aiSummary (reportName: String): (summary: String)
   *
   * @param {object} args
   * @param {string} args.reportName - The name of the report to generate a summary for.
   * @returns {{summary: string} | {error: string}} The generated AI summary string on success, or an error object.
   *
   * @requires report exists.
   * @effects The AI generates a summary of the report, highlighting key takeaways and trends, and saves it for future viewing.
   */
  async aiSummary({
    reportName,
  }: {
    reportName: string;
  }): Promise<{ summary: string } | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }

    const report = await this.reports.findOne({ _id: reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }

    // --- Placeholder for actual AI summary generation logic ---
    // In a real application, this would involve calling an AI service (e.g., OpenAI, Gemini).
    // The summary would be generated based on the 'report.results' data.
    let generatedSummary = `AI Summary for report '${reportName}':\n\n`;
    if (report.results.length > 0) {
        generatedSummary += `This report tracks the growth performance of ${report.results.length} animal(s) (IDs: ${report.targetAnimals.join(', ')}).\n`;
        report.results.forEach(result => {
            generatedSummary += `\nFor animal '${result.animalId}' over the period from ${result.startDate.toDateString()} to ${result.endDate.toDateString()}:\n`;
            if (result.initialWeight && result.finalWeight) {
                generatedSummary += `  - Initial Weight: ${result.initialWeight} units\n`;
                generatedSummary += `  - Final Weight: ${result.finalWeight} units\n`;
                generatedSummary += `  - Total Weight Gain: ${result.totalWeightGain !== undefined ? result.totalWeightGain : 'N/A'} units\n`;
            }
            if (result.averageDailyGain !== undefined) {
                generatedSummary += `  - Average Daily Gain (ADG): ${result.averageDailyGain} units/day\n`;
            }
            // Add more detailed analysis based on 'weightsInPeriod' if needed
        });
        generatedSummary += "\nOverall trends and key takeaways would be synthesized here by an advanced AI model.";
    } else {
        generatedSummary += "No growth data found for this report to summarize.";
    }
    // --- End of placeholder ---

    const updateResult = await this.reports.updateOne(
      { _id: reportName },
      { $set: { aiGeneratedSummary: generatedSummary, dateGenerated: new Date() } },
    );

    if (!updateResult.acknowledged) {
      return { error: "Failed to save AI summary." };
    }

    return { summary: generatedSummary };
  }

  // --- Queries ---
  // Queries are methods prefixed with an underscore '_' and typically return data without modifying state.

  /**
   * @query
   * _getAnimalWeightRecords (animal: Animal): ({records: WeightRecord[]})
   *
   * @param {object} args
   * @param {Animal} args.animal - The ID of the animal.
   * @returns {{records: WeightRecord[]} | {error: string}} An object containing sorted weight records for the animal, or an error.
   * @effects returns all weight records for the specified animal, sorted by date.
   */
  async _getAnimalWeightRecords({
    animal,
  }: { animal: Animal }): Promise<{ records: WeightRecord[] } | { error: string }> {
    if (!animal) {
      return { error: "Animal ID is required." };
    }
    const animalDoc = await this.animals.findOne({ _id: animal });
    if (!animalDoc) {
      return { error: `Animal with ID '${animal}' not found.` };
    }
    // Return records sorted by date ascending
    return { records: animalDoc.weightRecords.sort((a, b) => a.date.getTime() - b.date.getTime()) };
  }

  /**
   * @query
   * _getReport (reportName: String): ({report: ReportDoc})
   *
   * @param {object} args
   * @param {string} args.reportName - The name of the report.
   * @returns {{report: ReportDoc} | {error: string}} An object containing the specified report document, or an error.
   * @effects returns the specified report document.
   */
  async _getReport({
    reportName,
  }: { reportName: string }): Promise<{ report: ReportDoc } | { error: string }> {
    if (!reportName) {
      return { error: "Report name is required." };
    }
    const reportDoc = await this.reports.findOne({ _id: reportName });
    if (!reportDoc) {
      return { error: `Report with name '${reportName}' not found.` };
    }
    return { report: reportDoc };
  }

  /**
   * @query
   * _listReports(): ({reports: string[]})
   *
   * @returns {{reports: string[]}} An object containing an array of all report names.
   * @effects returns a list of all report names.
   */
  async _listReports(): Promise<{ reports: string[] }> {
    const reportNames = await this.reports.find({})
      .project<{ _id: string }>({ _id: 1 }) // Project only the _id field
      .map(doc => doc._id) // Map to get just the string _id
      .toArray();
    return { reports: reportNames };
  }
}
```
